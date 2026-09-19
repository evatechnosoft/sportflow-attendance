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
  fromAttendanceStatus,
  sessionDocId,
  toAttendanceStatus,
  toGroup,
  toPlayer,
  type FirestoreAthlete,
  type FirestoreGroup,
} from './mapping'

const readOnly = () =>
  new DomainError('read_only', 'Canlı veritabanı bu sürümde salt okunur açıldı.')

export interface FirestoreOptions {
  /** true olduğunda yoklama canlı Firestore'a yazılır (attendance/{groupId}_{date}). */
  allowWrites?: boolean
}

/**
 * Anadolu Spor'un canlı Firestore'una bağlanan adapter.
 * Eski şema korunur: groups · athletes · attendance/{groupId}_{date}
 * Okul ayrı koleksiyon olarak yok; grup belgesinde schoolId varsa kullanılır.
 */
export function createFirestoreDataSource(db: Firestore, options: FirestoreOptions = {}): DataSource {
  const canWrite = options.allowWrites === true

  const loadGroups = async (): Promise<Group[]> => {
    const snapshot = await getDocs(collection(db, 'groups'))
    return snapshot.docs.map((row) => toGroup(row.id, row.data() as FirestoreGroup))
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
      async list() {
        const snapshot = await getDocs(collection(db, 'branches'))
        return snapshot.docs.map((row) => ({
          id: row.id,
          name: (row.data().name as string) ?? '(isimsiz branş)',
          slug: (row.data().slug as string) ?? row.id,
        }))
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

        const records = Object.fromEntries(
          marks.map((mark) => [
            mark.playerId,
            { status: fromAttendanceStatus(mark.status), notes: mark.note ?? '' },
          ]),
        )
        await setDoc(
          doc(db, 'attendance', sessionId),
          { groupId, date, type: 'practice', records, updatedAt: new Date().toISOString() },
          { merge: true },
        )
        return this.listBySession(sessionId)
      },
    },
  }
}
