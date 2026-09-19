import type {
  Attendance,
  AttendanceStatus,
  Branch,
  Group,
  Id,
  Player,
  School,
  Session,
} from '../domain/types'

export interface SchoolRepository {
  list(): Promise<School[]>
  create(input: Omit<School, 'id'>): Promise<School>
  remove(id: Id): Promise<void>
}

export interface BranchRepository {
  list(): Promise<Branch[]>
  create(input: Omit<Branch, 'id'>): Promise<Branch>
  remove(id: Id): Promise<void>
}

export interface GroupFilter {
  schoolId?: Id
  branchId?: Id
}

export interface GroupRepository {
  list(filter?: GroupFilter): Promise<Group[]>
  create(input: Omit<Group, 'id'>): Promise<Group>
  remove(id: Id): Promise<void>
}

export interface PlayerRepository {
  listByGroup(groupId: Id, options?: { includeInactive?: boolean }): Promise<Player[]>
  create(input: Omit<Player, 'id'>): Promise<Player>
  setStatus(id: Id, status: Player['status']): Promise<Player>
}

export interface SessionRepository {
  /** Aynı grup + tarih için ikinci oturum açmaz, var olanı döner. */
  ensure(groupId: Id, date: string, startTime?: string): Promise<Session>
  listByGroup(groupId: Id): Promise<Session[]>
}

export interface AttendanceMark {
  playerId: Id
  status: AttendanceStatus
  note?: string
}

export interface AttendanceRepository {
  listBySession(sessionId: Id): Promise<Attendance[]>
  /** Oyuncu başına tek kayıt: var olanın üzerine yazar. */
  mark(sessionId: Id, marks: AttendanceMark[]): Promise<Attendance[]>
}

export interface DataSource {
  schools: SchoolRepository
  branches: BranchRepository
  groups: GroupRepository
  players: PlayerRepository
  sessions: SessionRepository
  attendance: AttendanceRepository
}
