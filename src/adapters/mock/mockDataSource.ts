import { duplicate, inUse, notFound } from '../../domain/errors'
import type {
  Attendance,
  AttendanceStatus,
  Branch,
  Group,
  Id,
  Player,
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
}

const clone = <T>(rows: T[]): T[] => rows.map((row) => ({ ...row }))

export const emptyCounts = (): Record<AttendanceStatus, number> => ({
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
})

/** In-memory adapter. Ağ yok, kalıcılık yok — UI'ı gerçek veri kaynağından önce çalıştırır. */
export function createMockDataSource(seed: MockSeed = {}): DataSource {
  const schools = clone(seed.schools ?? [])
  const branches = clone(seed.branches ?? [])
  const groups = clone(seed.groups ?? [])
  const players = clone(seed.players ?? [])
  const sessions = clone(seed.sessions ?? [])
  const attendance = clone(seed.attendance ?? [])
  const clubIdentity = seed.clubIdentity ?? {
    primaryName: 'SPORTFLOW',
    secondaryName: 'DEMO KULÜBÜ',
    description: 'OKUL BAZLI YOKLAMA — ÖRNEK VERİ',
  }

  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${++counter}`

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
        if (groups.some((row) => row.schoolId === id)) throw inUse('Okul', id)
        const index = schools.findIndex((row) => row.id === id)
        if (index < 0) throw notFound('Okul', id)
        schools.splice(index, 1)
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
        if (groups.some((row) => row.branchId === id)) throw inUse('Branş', id)
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
        if (!schools.some((row) => row.id === input.schoolId)) {
          throw notFound('Okul', input.schoolId)
        }
        if (!branches.some((row) => row.id === input.branchId)) {
          throw notFound('Branş', input.branchId)
        }
        const row: Group = { ...input, id: nextId('group') }
        groups.push(row)
        return { ...row }
      },
      async remove(id) {
        if (players.some((row) => row.groupId === id)) throw inUse('Grup', id)
        const index = groups.findIndex((row) => row.id === id)
        if (index < 0) throw notFound('Grup', id)
        groups.splice(index, 1)
      },
    },

    players: {
      async listByGroup(groupId, options = {}) {
        return clone(
          players.filter(
            (row) =>
              row.groupId === groupId &&
              (options.includeInactive || row.status === 'active'),
          ),
        )
      },
      async create(input) {
        requireGroup(input.groupId)
        const row: Player = { ...input, id: nextId('player') }
        players.push(row)
        return { ...row }
      },
      async setStatus(id, status) {
        const row = players.find((candidate) => candidate.id === id)
        if (!row) throw notFound('Oyuncu', id)
        row.status = status
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
      async listByGroup(groupId) {
        return clone(sessions.filter((row) => row.groupId === groupId))
      },
    },

    settings: {
      async clubIdentity() {
        return { ...clubIdentity }
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
          if (!player || player.groupId !== session.groupId) {
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
