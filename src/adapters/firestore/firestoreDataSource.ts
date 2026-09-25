import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { DomainError, duplicate, inUse, notFound } from '../../domain/errors'
import { emptyCounts, requireValidSchedule } from '../mock/mockDataSource'
import {
  DEFAULT_CLUB_SETTINGS,
  type Attendance,
  type Branch,
  type ClubIdentity,
  type ClubSettings,
  type Group,
  type Id,
  type Player,
  type School,
} from '../../domain/types'
import type { DataSource, GroupFilter } from '../../ports/repositories'
import {
  buildAttendanceDoc,
  chunks,
  diffMemberships,
  isOverdue,
  parseSessionId,
  primaryGuardianId,
  recordsOf,
  sessionDocId,
  toGroup,
  toPlayer,
  toStudentGender,
  type Guardian,
  type GroupDoc,
  type InstallmentDoc,
  type MembershipDoc,
  type StudentDoc,
} from './mapping'

const readOnly = () =>
  new DomainError('read_only', 'Canlı veritabanı bu sürümde salt okunur açıldı.')

const unauthenticated = () =>
  new DomainError('unauthenticated', 'Yoklama yazmak için giriş gerekiyor.')

/** Kurallar girişten önce okumayı reddeder; kimlik sabit kalır. */
const CLUB_IDENTITY: ClubIdentity = { primaryName: 'ANADOLU SPOR', secondaryName: '', description: '' }

export interface FirestoreOptions {
  /** true olduğunda canlı Firestore'a yazılır. */
  allowWrites?: boolean
  /** Kuralların istediği takenBy: giriş e-postası, küçük harf. */
  currentUserEmail?: () => string | null
}

interface SportflowSettings {
  schools: School[]
  branches: Branch[]
  fields: ClubSettings['fields']
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const isDenied = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'permission-denied'

/**
 * Çevrimdışıyken yazma yerel önbelleğe düşer, bağlantı gelince gider — beklersek
 * söz bağlantıya kadar asılı kalır. Çevrimiçiyken bekleriz ki ret hatası görünsün.
 */
async function commit(write: Promise<unknown>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    write.catch((error) => console.error('Firestore yazması reddedildi', error))
    return
  }
  await write
}

/**
 * Anadolu Spor Firestore'u, CRM v2 sözleşmesi (clubcrm docs/faz-b-kurgu.md):
 * groups · students · memberships · guardianships → customers · attendance/{groupId}_{date}
 * · settings/sportflow · plans → installments (aidat, salt okuma).
 * Sorgular tek alanlı where; bileşik index gerekmez, süzme JS'de.
 */
export function createFirestoreDataSource(db: Firestore, options: FirestoreOptions = {}): DataSource {
  const requireWrites = () => {
    if (options.allowWrites !== true) throw readOnly()
  }

  const byIds = async (name: string, ids: string[]) => {
    const rows: { id: string; data: DocumentData }[] = []
    for (const part of chunks([...new Set(ids)])) {
      const snapshot = await getDocs(query(collection(db, name), where(documentId(), 'in', part)))
      for (const row of snapshot.docs) rows.push({ id: row.id, data: row.data() })
    }
    return rows
  }

  const whereIn = async (name: string, field: string, values: string[]) => {
    const rows: { id: string; data: DocumentData }[] = []
    for (const part of chunks([...new Set(values)])) {
      const snapshot = await getDocs(query(collection(db, name), where(field, 'in', part)))
      for (const row of snapshot.docs) rows.push({ id: row.id, data: row.data() })
    }
    return rows
  }

  const membershipsOf = async (studentIds: string[]): Promise<MembershipDoc[]> =>
    (await whereIn('memberships', 'studentId', studentIds)).map(
      ({ id, data }) => ({ ...data, id }) as MembershipDoc,
    )

  /** Veli adı/telefonu memur+ okur; izin yoksa (koç) veli bilgisi boş kalır. */
  const guardiansOf = async (studentIds: string[]): Promise<Map<string, Guardian>> => {
    const result = new Map<string, Guardian>()
    try {
      const links = (await whereIn('guardianships', 'studentId', studentIds)).map(
        ({ data }) => data as { studentId: string; customerId: string; rank?: number },
      )
      const chosen = new Map<string, string>()
      for (const studentId of studentIds) {
        const customerId = primaryGuardianId(links, studentId)
        if (customerId) chosen.set(studentId, customerId)
      }
      const customers = new Map(
        (await byIds('customers', [...chosen.values()])).map(({ id, data }) => [id, data as Guardian]),
      )
      for (const [studentId, customerId] of chosen) {
        const customer = customers.get(customerId)
        if (customer) result.set(studentId, { fullName: customer.fullName, phone: customer.phone })
      }
    } catch (error) {
      if (!isDenied(error)) throw error
    }
    return result
  }

  const loadPlayers = async (studentIds: string[]): Promise<Player[]> => {
    if (studentIds.length === 0) return []
    const [students, memberships, guardians] = await Promise.all([
      byIds('students', studentIds),
      membershipsOf(studentIds),
      guardiansOf(studentIds),
    ])
    return students.map(({ id, data }) =>
      toPlayer(id, data as StudentDoc, memberships, guardians.get(id)),
    )
  }

  /** Aktif = grupta açık üyelik ve öğrenci aktif; includeInactive kapanmış dönemleri de verir. */
  const listPlayers = async (groupId: Id, listOptions: { includeInactive?: boolean } = {}) => {
    const members = await getDocs(query(collection(db, 'memberships'), where('groupId', '==', groupId)))
    const players = await loadPlayers(members.docs.map((row) => row.data().studentId as string))
    return players
      .filter((player) => {
        const spells = player.groupHistory.filter((spell) => spell.groupId === groupId)
        return listOptions.includeInactive
          ? spells.length > 0
          : player.status === 'active' && spells.some((spell) => !spell.leftOn)
      })
      .sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'tr'),
      )
  }

  const loadSettings = async (): Promise<SportflowSettings> => {
    const snapshot = await getDoc(doc(db, 'settings', 'sportflow'))
    const value = (snapshot.exists() ? snapshot.data().value : undefined) as
      | Partial<SportflowSettings>
      | undefined
    return {
      schools: value?.schools ?? [],
      branches: value?.branches ?? [],
      fields: { ...DEFAULT_CLUB_SETTINGS.fields, ...value?.fields },
    }
  }

  const saveSettings = (value: SportflowSettings) =>
    commit(setDoc(doc(db, 'settings', 'sportflow'), { id: 'sportflow', value }))

  const requireGroup = async (id: Id): Promise<Group> => {
    const snapshot = await getDoc(doc(db, 'groups', id))
    if (!snapshot.exists()) throw notFound('Grup', id)
    return toGroup(snapshot.id, snapshot.data() as GroupDoc)
  }

  const takenBy = () => {
    const email = options.currentUserEmail?.()?.toLowerCase()
    if (!email) throw unauthenticated()
    return email
  }

  return {
    schools: {
      async list() {
        return (await loadSettings()).schools
      },
      async create(input) {
        requireWrites()
        const settings = await loadSettings()
        if (settings.schools.some((row) => row.name === input.name)) {
          throw duplicate('Okul', 'ad', input.name)
        }
        const row: School = { ...input, id: newId('school') }
        await saveSettings({ ...settings, schools: [...settings.schools, row] })
        return row
      },
      async remove(id) {
        requireWrites()
        const settings = await loadSettings()
        if (!settings.schools.some((row) => row.id === id)) throw notFound('Okul', id)
        const users = await getDocs(query(collection(db, 'groups'), where('schoolId', '==', id)))
        const batch = writeBatch(db)
        for (const row of users.docs) batch.update(row.ref, { schoolId: deleteField() })
        batch.set(doc(db, 'settings', 'sportflow'), {
          id: 'sportflow',
          value: { ...settings, schools: settings.schools.filter((row) => row.id !== id) },
        })
        await commit(batch.commit())
      },
    },

    branches: {
      async list() {
        return (await loadSettings()).branches
      },
      async create(input) {
        requireWrites()
        const settings = await loadSettings()
        if (settings.branches.some((row) => row.slug === input.slug)) {
          throw duplicate('Branş', 'slug', input.slug)
        }
        if (settings.branches.some((row) => row.name === input.name)) {
          throw duplicate('Branş', 'ad', input.name)
        }
        const row: Branch = { ...input, id: newId('branch') }
        await saveSettings({ ...settings, branches: [...settings.branches, row] })
        return row
      },
      async remove(id) {
        requireWrites()
        const users = await getDocs(query(collection(db, 'groups'), where('branchId', '==', id)))
        if (users.size > 0) throw new DomainError('in_use', `${users.size} grup bu branşı kullanıyor`)
        const settings = await loadSettings()
        if (!settings.branches.some((row) => row.id === id)) throw notFound('Branş', id)
        await saveSettings({ ...settings, branches: settings.branches.filter((row) => row.id !== id) })
      },
    },

    groups: {
      // Yalnız antrenman grupları yoklamada; maç kadroları CRM'de kalır.
      async list(filter: GroupFilter = {}) {
        const snapshot = await getDocs(query(collection(db, 'groups'), where('kind', '==', 'training')))
        return snapshot.docs
          .map((row) => toGroup(row.id, row.data() as GroupDoc))
          .filter(
            (group) =>
              (!filter.schoolId || group.schoolId === filter.schoolId) &&
              (!filter.branchId || group.branchId === filter.branchId),
          )
          .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      },
      async create(input) {
        requireWrites()
        const settings = await loadSettings()
        if (input.schoolId && !settings.schools.some((row) => row.id === input.schoolId)) {
          throw notFound('Okul', input.schoolId)
        }
        if (!settings.branches.some((row) => row.id === input.branchId)) {
          throw notFound('Branş', input.branchId)
        }
        requireValidSchedule(input.schedule)
        const group: Group = { ...input, id: newId('group') }
        const { id, ...fields } = group
        await commit(setDoc(doc(db, 'groups', id), { ...fields, kind: 'training' }))
        return group
      },
      // Alan alan: CRM'in grup alanları korunur. undefined değer alanı siler.
      async update(id, patch) {
        requireWrites()
        const current = await requireGroup(id)
        if (patch.schedule) requireValidSchedule(patch.schedule)
        const fields = Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, value === undefined ? deleteField() : value]),
        )
        if (Object.keys(fields).length > 0) await commit(updateDoc(doc(db, 'groups', id), fields))
        return { ...current, ...patch }
      },
      async remove(id) {
        requireWrites()
        const members = await getDocs(query(collection(db, 'memberships'), where('groupId', '==', id)))
        if (members.size > 0) throw inUse('Grup', id)
        await requireGroup(id)
        await commit(writeBatch(db).delete(doc(db, 'groups', id)).commit())
      },
    },

    players: {
      listByGroup: listPlayers,
      // Öğrenci + üyelik tek writeBatch; veli CRM'de eklenir.
      async create(input) {
        requireWrites()
        for (const spell of input.groupHistory) await requireGroup(spell.groupId)
        const id = newId('student')
        const batch = writeBatch(db)
        batch.set(doc(db, 'students', id), {
          id,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate,
          gender: toStudentGender(input.gender),
          status: input.groupHistory.some((spell) => !spell.leftOn) ? 'active' : 'inactive',
        })
        for (const spell of input.groupHistory) {
          const membershipId = newId('membership')
          batch.set(doc(db, 'memberships', membershipId), {
            id: membershipId,
            studentId: id,
            groupId: spell.groupId,
            joinedOn: spell.joinedOn || todayIso(),
            leftOn: spell.leftOn,
          })
        }
        await commit(batch.commit())
        return { ...input, id, guardianName: undefined, guardianPhone: undefined }
      },
      // Öğrenci belgesi alan alan (updateDoc): CRM'in photo/extra alanları korunur.
      async update(id, patch) {
        requireWrites()
        const ref = doc(db, 'students', id)
        const snapshot = await getDoc(ref)
        if (!snapshot.exists()) throw notFound('Oyuncu', id)
        for (const spell of patch.groupHistory ?? []) await requireGroup(spell.groupId)

        const batch = writeBatch(db)
        const fields: DocumentData = {}
        if ('firstName' in patch) fields.firstName = patch.firstName
        if ('lastName' in patch) fields.lastName = patch.lastName
        if ('birthDate' in patch) fields.birthDate = patch.birthDate || deleteField()
        if ('gender' in patch) fields.gender = toStudentGender(patch.gender) ?? deleteField()
        if (patch.status) fields.status = patch.status
        if (patch.groupHistory) {
          // Durum üyelikten türetilir; çağıranın gönderdiği status'e güvenilmez.
          fields.status = patch.groupHistory.some((spell) => !spell.leftOn) ? 'active' : 'inactive'
          const diff = diffMemberships(await membershipsOf([id]), patch.groupHistory, todayIso())
          for (const row of diff.close) {
            batch.update(doc(db, 'memberships', row.id), { leftOn: row.leftOn })
          }
          for (const row of diff.open) {
            const membershipId = newId('membership')
            batch.set(doc(db, 'memberships', membershipId), {
              id: membershipId,
              studentId: id,
              groupId: row.groupId,
              joinedOn: row.joinedOn,
            })
          }
        }
        if (Object.keys(fields).length > 0) batch.update(ref, fields)
        await commit(batch.commit())
        const [player] = await loadPlayers([id])
        return player
      },
    },

    sessions: {
      // Oturum ayrı belge değil: kimlik groupId + tarihten; belge ilk yoklamada doğar.
      async ensure(groupId, date, startTime) {
        return { id: sessionDocId(groupId, date), groupId, date, startTime }
      },
      async update(id, patch) {
        requireWrites()
        const session = parseSessionId(id)
        if (!session) throw notFound('Oturum', id)
        const ref = doc(db, 'attendance', id)
        const data: DocumentData = {
          ...session,
          startTime: patch.startTime,
          takenBy: takenBy(),
          updatedAt: new Date().toISOString(),
        }
        // Kurallar records haritasını ister; boş harita merge'de var olanı ezer,
        // bu yüzden yalnız belge yokken yazılır.
        // ponytail: önbellekte olmayan belge çevrimdışı okunamaz → records'suz yazılır,
        // belge sunucuda da yoksa kural reddeder ve saat kaybolur.
        const exists = await getDoc(ref).then((row) => row.exists(), () => true)
        if (!exists) data.records = {}
        await commit(setDoc(ref, data, { merge: true }))
        return { id, ...session, startTime: patch.startTime }
      },
      async listByGroup(groupId) {
        const snapshot = await getDocs(query(collection(db, 'attendance'), where('groupId', '==', groupId)))
        return snapshot.docs.map((row) => ({
          id: row.id,
          groupId,
          date: (row.data().date as string) ?? parseSessionId(row.id)?.date ?? '',
          startTime: (row.data().startTime as string | undefined) || undefined,
        }))
      },
    },

    settings: {
      async clubIdentity() {
        return { ...CLUB_IDENTITY }
      },
      async get() {
        return { fields: (await loadSettings()).fields }
      },
      async update(patch) {
        requireWrites()
        const settings = await loadSettings()
        const fields = { ...settings.fields, ...patch.fields }
        await saveSettings({ ...settings, fields })
        return { fields }
      },
    },

    dues: {
      // CRM'in aidatına salt okuma: plans(playerId) → installments(planId).
      // Koç okuyamaz (kurallar memur+): rozet çıkmaz, hata da yok.
      async overdueByGroup(groupId) {
        try {
          const players = await listPlayers(groupId)
          const plans = await whereIn('plans', 'playerId', players.map((player) => player.id))
          const playerOfPlan = new Map(plans.map(({ id, data }) => [id, data.playerId as string]))
          const installments = await whereIn('installments', 'planId', [...playerOfPlan.keys()])
          const today = todayIso()
          const overdue = new Set<string>()
          for (const { data } of installments) {
            const row = data as InstallmentDoc
            if (isOverdue(row, today)) overdue.add(playerOfPlan.get(row.planId) ?? '')
          }
          overdue.delete('')
          return [...overdue]
        } catch (error) {
          if (isDenied(error)) return []
          throw error
        }
      },
    },

    attendance: {
      async listBySession(sessionId) {
        const snapshot = await getDoc(doc(db, 'attendance', sessionId))
        if (!snapshot.exists()) return []
        return recordsOf(snapshot.data().records).map(
          ({ playerId, record }): Attendance => ({ sessionId, playerId, ...record }),
        )
      },

      // Tek sorgu: grubun tüm yoklama belgeleri, her biri records haritası taşıyor.
      async historyByGroup(groupId) {
        const snapshot = await getDocs(query(collection(db, 'attendance'), where('groupId', '==', groupId)))
        return snapshot.docs
          .map((row) => {
            const counts = emptyCounts()
            const records = recordsOf(row.data().records)
            for (const { record } of records) counts[record.status] += 1
            return {
              sessionId: row.id,
              date: (row.data().date as string) ?? parseSessionId(row.id)?.date ?? '',
              counts,
              total: records.length,
            }
          })
          .filter((summary) => summary.total > 0)
          .sort((a, b) => b.date.localeCompare(a.date))
      },

      // runTransaction yok: sabit kimlikli belgeye merge — tekrar gönderim zararsız,
      // çevrimdışı kuyrukta bekler (faz-b-kurgu § B3/B4 çevrimdışı kararı).
      async mark(sessionId, marks) {
        requireWrites()
        const session = parseSessionId(sessionId)
        if (!session) throw notFound('Oturum', sessionId)
        const now = new Date().toISOString()
        const data = buildAttendanceDoc({ ...session, takenBy: takenBy(), marks, now })
        // Boş records merge'de var olan kayıtları ezer: işaret yoksa yazma.
        if (marks.length > 0) {
          await commit(setDoc(doc(db, 'attendance', sessionId), data, { merge: true }))
        }
        return Object.entries(data.records).map(
          ([playerId, record]): Attendance => ({ sessionId, playerId, ...record }),
        )
      },
    },
  }
}
