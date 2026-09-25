import { DomainError, duplicate, invalid, inUse, notFound } from '../../domain/errors'
import { DEFAULT_CLUB_SETTINGS } from '../../domain/types'
import type {
  Attendance,
  AttendanceStatus,
  Branch,
  ClubSettings,
  Group,
  Id,
  Player,
  ScheduleSlot,
  School,
  Session,
} from '../../domain/types'
import type {
  AttendanceMark,
  DataSource,
  GroupFilter,
} from '../../ports/repositories'

export interface MockSeed {
  clubIdentity?: { primaryName: string; secondaryName: string; description: string }
  schools?: School[]
  branches?: Branch[]
  groups?: Group[]
  players?: Player[]
  sessions?: Session[]
  attendance?: Attendance[]
  /** Gecikmiş taksiti olan sporcu id'leri (CRM'in yerine). */
  overdue?: Id[]
}

const clone = <T>(rows: T[]): T[] => rows.map((row) => ({ ...row }))

export const emptyCounts = (): Record<AttendanceStatus, number> => ({
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
})

/** Kural 1-2: gün 1-7 aralığında ve gün + saat çifti tekil. */
export const requireValidSchedule = (schedule: ScheduleSlot[]) => {
  const seen = new Set<string>()
  for (const slot of schedule) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7) {
      throw invalid('Antrenman günü', `${slot.weekday} — 1-7 aralığında olmalı`)
    }
    const key = `${slot.weekday}|${slot.startTime}`
    if (seen.has(key)) throw duplicate('Grup', 'gün + saat', key)
    seen.add(key)
  }
}

/** In-memory adapter. Ağ yok, kalıcılık yok — UI'ı gerçek veri kaynağından önce çalıştırır. */
export function createMockDataSource(seed: MockSeed = {}): DataSource {
  const schools = clone(seed.schools ?? [])
  const branches = clone(seed.branches ?? [])
  const groups = clone(seed.groups ?? [])
  const players = clone(seed.players ?? [])
  const sessions = clone(seed.sessions ?? [])
  const attendance = clone(seed.attendance ?? [])
  const overdue = new Set(seed.overdue ?? [])
  const clubIdentity = seed.clubIdentity ?? {
    primaryName: 'ANADOLU SPOR',
    secondaryName: 'Yoklama',
    description: 'OKUL BAZLI YOKLAMA — ÖRNEK VERİ',
  }

  let settings: ClubSettings = { fields: { ...DEFAULT_CLUB_SETTINGS.fields } }

  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${++counter}`

  /** Sporcunun o gruptaki dönemleri — açık dönem üyelik, kapalı dönem geçmiştir. */
  const spellsIn = (player: Player, groupId: Id) =>
    player.groupHistory.filter((spell) => spell.groupId === groupId)

  const requireGroup = (id: Id) => {
    const group = groups.find((row) => row.id === id)
    if (!group) throw notFound('Grup', id)
    return group
  }

  return {
    schools: {
      async list() {
        return clone(schools)
      },
      async create(input) {
        if (schools.some((row) => row.name === input.name)) {
          throw duplicate('Okul', 'ad', input.name)
        }
        const row: School = { ...input, id: nextId('school') }
        schools.push(row)
        return { ...row }
      },
      async remove(id) {
        const index = schools.findIndex((row) => row.id === id)
        if (index < 0) throw notFound('Okul', id)
        schools.splice(index, 1)
        for (const group of groups) if (group.schoolId === id) delete group.schoolId
      },
    },

    branches: {
      async list() {
        return clone(branches)
      },
      async create(input) {
        if (branches.some((row) => row.slug === input.slug)) {
          throw duplicate('Branş', 'slug', input.slug)
        }
        if (branches.some((row) => row.name === input.name)) {
          throw duplicate('Branş', 'ad', input.name)
        }
        const row: Branch = { ...input, id: nextId('branch') }
        branches.push(row)
        return { ...row }
      },
      async remove(id) {
        const users = groups.filter((row) => row.branchId === id).length
        if (users > 0) throw new DomainError('in_use', `${users} grup bu branşı kullanıyor`)
        const index = branches.findIndex((row) => row.id === id)
        if (index < 0) throw notFound('Branş', id)
        branches.splice(index, 1)
      },
    },

    groups: {
      async list(filter: GroupFilter = {}) {
        return clone(
          groups.filter(
            (row) =>
              (!filter.schoolId || row.schoolId === filter.schoolId) &&
              (!filter.branchId || row.branchId === filter.branchId),
          ),
        )
      },
      async create(input) {
        if (input.schoolId && !schools.some((row) => row.id === input.schoolId)) {
          throw notFound('Okul', input.schoolId)
        }
        if (!branches.some((row) => row.id === input.branchId)) {
          throw notFound('Branş', input.branchId)
        }
        requireValidSchedule(input.schedule)
        const row: Group = { ...input, id: nextId('group') }
        groups.push(row)
        return { ...row }
      },
      async update(id, patch) {
        const row = requireGroup(id)
        if (patch.schedule) requireValidSchedule(patch.schedule)
        Object.assign(row, patch)
        return { ...row }
      },
      async remove(id) {
        if (players.some((row) => spellsIn(row, id).length > 0)) throw inUse('Grup', id)
        const index = groups.findIndex((row) => row.id === id)
        if (index < 0) throw notFound('Grup', id)
        groups.splice(index, 1)
      },
    },

    players: {
      async listByGroup(groupId, options = {}) {
        return clone(
          players.filter((row) => {
            const spells = spellsIn(row, groupId)
            return options.includeInactive
              ? spells.length > 0
              : spells.some((spell) => !spell.leftOn)
          }),
        )
      },
      async create(input) {
        for (const spell of input.groupHistory) requireGroup(spell.groupId)
        const row: Player = { ...input, id: nextId('player') }
        players.push(row)
        return { ...row }
      },
      async update(id, patch) {
        const row = players.find((candidate) => candidate.id === id)
        if (!row) throw notFound('Oyuncu', id)
        for (const spell of patch.groupHistory ?? []) requireGroup(spell.groupId)
        Object.assign(row, patch)
        // Durum üyelikten türetilir; çağıranın gönderdiği status'e güvenilmez.
        if (patch.groupHistory) {
          row.status = row.groupHistory.some((spell) => !spell.leftOn) ? 'active' : 'inactive'
        }
        return { ...row }
      },
    },

    sessions: {
      async ensure(groupId, date, startTime) {
        requireGroup(groupId)
        const existing = sessions.find((row) => row.groupId === groupId && row.date === date)
        if (existing) return { ...existing }
        const row: Session = { id: nextId('session'), groupId, date, startTime }
        sessions.push(row)
        return { ...row }
      },
      async update(id, patch) {
        const row = sessions.find((candidate) => candidate.id === id)
        if (!row) throw notFound('Oturum', id)
        Object.assign(row, patch)
        return { ...row }
      },
      async listByGroup(groupId) {
        return clone(sessions.filter((row) => row.groupId === groupId))
      },
    },

    settings: {
      async clubIdentity() {
        return { ...clubIdentity }
      },
      async get() {
        return { fields: { ...settings.fields } }
      },
      async update(patch) {
        settings = { fields: { ...settings.fields, ...patch.fields } }
        return { fields: { ...settings.fields } }
      },
    },

    dues: {
      async overdueByGroup(groupId) {
        return players
          .filter(
            (row) =>
              overdue.has(row.id) && spellsIn(row, groupId).some((spell) => !spell.leftOn),
          )
          .map((row) => row.id)
      },
    },

    attendance: {
      async listBySession(sessionId) {
        return clone(attendance.filter((row) => row.sessionId === sessionId))
      },
      async mark(sessionId, marks: AttendanceMark[]) {
        const session = sessions.find((row) => row.id === sessionId)
        if (!session) throw notFound('Oturum', sessionId)

        for (const mark of marks) {
          const player = players.find((row) => row.id === mark.playerId)
          // Geçmiş yoklama düzeltilebilsin: kapanmış dönem de o gruba aitlik sayılır.
          if (!player || spellsIn(player, session.groupId).length === 0) {
            throw notFound('Grubun oyuncusu', mark.playerId)
          }
        }

        const markedAt = new Date().toISOString()
        for (const mark of marks) {
          const existing = attendance.find(
            (row) => row.sessionId === sessionId && row.playerId === mark.playerId,
          )
          if (existing) {
            existing.status = mark.status
            existing.note = mark.note
            existing.markedAt = markedAt
          } else {
            attendance.push({ sessionId, ...mark, markedAt })
          }
        }
        return clone(attendance.filter((row) => row.sessionId === sessionId))
      },

      async historyByGroup(groupId) {
        const groupSessions = sessions.filter((row) => row.groupId === groupId)
        return groupSessions
          .map((session) => {
            const rows = attendance.filter((row) => row.sessionId === session.id)
            const counts = emptyCounts()
            for (const row of rows) counts[row.status] += 1
            return { sessionId: session.id, date: session.date, counts, total: rows.length }
          })
          .filter((summary) => summary.total > 0)
          .sort((a, b) => b.date.localeCompare(a.date))
      },
    },
  }
}
