import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { DomainError, notFound } from '../../domain/errors'
import type { Attendance, Group, School } from '../../domain/types'
import type { AttendanceMark, DataSource, GroupFilter } from '../../ports/repositories'
import {
  UNASSIGNED_SCHOOL,
  buildAttendanceDoc,
  dedupeGroups,
  fromAttendanceStatus,
  sessionDocId,
  toAttendanceStatus,
  toBranches,
  toClubIdentity,
  toGroup,
  toPlayer,
  type FirestoreAthlete,
  type FirestoreGroup,
  type FirestoreSettings,
} from './mapping'

const readOnly = () =>
  new DomainError('read_only', 'Canlı veritabanı bu sürümde salt okunur açıldı.')

export interface FirestoreOptions {
  /** true olduğunda yoklama canlı Firestore'a yazılır (attendance/{groupId}_{date}). */
  allowWrites?: boolean
  /** Yazarken kurallara gereken coachId — giriş yapmış kullanıcının uid'i. */
  currentUserId?: () => string | null
}

/**
 * Anadolu Spor'un canlı Firestore'una bağlanan adapter.
 * Eski şema korunur: groups · athletes · attendance/{groupId}_{date}
 * Okul ayrı koleksiyon olarak yok; grup belgesinde schoolId varsa kullanılır.
 */
export function createFirestoreDataSource(db: Firestore, options: FirestoreOptions = {}): DataSource {
  const canWrite = options.allowWrites === true

  const loadSettings = async (): Promise<FirestoreSettings | undefined> => {
    const snapshot = await getDoc(doc(db, 'settings', 'features'))
    return snapshot.exists() ? (snapshot.data() as FirestoreSettings) : undefined
  }

  const loadGroups = async (): Promise<Group[]> => {
    const snapshot = await getDocs(collection(db, 'groups'))
    return dedupeGroups(snapshot.docs.map((row) => toGroup(row.id, row.data() as FirestoreGroup)))
  }

  return {
    schools: {
      async list(): Promise<School[]> {
        const snapshot = await getDocs(collection(db, 'schools'))
        const schools = snapshot.docs.map((row) => ({
          id: row.id,
          name: (row.data().name as string) ?? '(isimsiz okul)',
        }))
        // Eski gruplarda okul alanı yok; hepsi tek havuzda görünsün.
        const groups = await loadGroups()
        if (groups.some((group) => group.schoolId === UNASSIGNED_SCHOOL)) {
          schools.push({ id: UNASSIGNED_SCHOOL, name: 'Okul atanmamış' })
        }
        return schools
      },
      async create() {
        throw readOnly()
      },
      async remove() {
        throw readOnly()
      },
    },

    branches: {
      // Branşlar ayrı koleksiyon değil: settings/features belgesinin içinde.
      async list() {
        return toBranches(await loadSettings())
      },
      async create() {
        throw readOnly()
      },
      async remove() {
        throw readOnly()
      },
    },

    groups: {
      async list(filter: GroupFilter = {}) {
        const groups = await loadGroups()
        return groups.filter(
          (group) =>
            (!filter.schoolId || group.schoolId === filter.schoolId) &&
            (!filter.branchId || group.branchId === filter.branchId),
        )
      },
      async create() {
        throw readOnly()
      },
      async remove() {
        throw readOnly()
      },
    },

    players: {
      async listByGroup(groupId, listOptions = {}) {
        const snapshot = await getDocs(
          query(collection(db, 'athletes'), where('groupId', '==', groupId)),
        )
        const players = snapshot.docs.map((row) => toPlayer(row.id, row.data() as FirestoreAthlete))
        return listOptions.includeInactive
          ? players
          : players.filter((player) => player.status === 'active')
      },
      async create() {
        throw readOnly()
      },
      async setStatus() {
        throw readOnly()
      },
    },

    sessions: {
      // Eski şemada oturum ayrı belge değil: kimlik groupId + tarihten türetilir.
      async ensure(groupId, date, startTime) {
        return { id: sessionDocId(groupId, date), groupId, date, startTime }
      },
      async listByGroup(groupId) {
        const snapshot = await getDocs(
          query(collection(db, 'attendance'), where('groupId', '==', groupId)),
        )
        return snapshot.docs.map((row) => ({
          id: row.id,
          groupId,
          date: (row.data().date as string) ?? row.id.split('_').pop() ?? '',
        }))
      },
    },

    settings: {
      // settings/features kuralı: allow read: if true — giriş öncesi de okunur.
      async clubIdentity() {
        return toClubIdentity(await loadSettings())
      },
    },

    attendance: {
      async listBySession(sessionId) {
        const snapshot = await getDoc(doc(db, 'attendance', sessionId))
        if (!snapshot.exists()) return []
        const records = (snapshot.data().records ?? {}) as Record<string, { status?: unknown; notes?: string }>
        const rows: Attendance[] = []
        for (const [playerId, record] of Object.entries(records)) {
          const status = toAttendanceStatus(record.status)
          if (!status) continue
          rows.push({
            sessionId,
            playerId,
            status,
            note: record.notes,
            markedAt: (snapshot.data().updatedAt as string) ?? '',
          })
        }
        return rows
      },

      async mark(sessionId, marks: AttendanceMark[]) {
        if (!canWrite) throw readOnly()
        const [groupId, date] = [sessionId.split('_')[0], sessionId.split('_').pop() ?? '']
        if (!groupId || !date) throw notFound('Oturum', sessionId)

        const coachId = options.currentUserId?.() ?? null
        if (!coachId) {
          throw new DomainError('unauthenticated', 'Yoklama yazmak için giriş gerekiyor.')
        }

        const records = Object.fromEntries(
          marks.map((mark) => [
            mark.playerId,
            { status: fromAttendanceStatus(mark.status), notes: mark.note ?? '' },
          ]),
        )
        await setDoc(
          doc(db, 'attendance', sessionId),
          buildAttendanceDoc({ groupId, date, coachId, records }),
          { merge: true },
        )
        return this.listBySession(sessionId)
      },
    },
  }
}
