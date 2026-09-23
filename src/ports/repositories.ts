import type {
  Attendance,
  AttendanceStatus,
  Branch,
  ClubIdentity,
  Group,
  Id,
  Player,
  School,
  Session,
  SessionSummary,
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
  /** Ad, okul/branş ve antrenman takvimi tek kapıdan güncellenir. */
  update(id: Id, patch: Partial<Omit<Group, 'id'>>): Promise<Group>
  remove(id: Id): Promise<void>
}

export interface PlayerRepository {
  listByGroup(groupId: Id, options?: { includeInactive?: boolean }): Promise<Player[]>
  create(input: Omit<Player, 'id'>): Promise<Player>
  /** Durum, grup ve dönem geçmişi tek kapıdan güncellenir. */
  update(id: Id, patch: Partial<Omit<Player, 'id'>>): Promise<Player>
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
  /** Grubun kayıtlı oturumları, yeniden eskiye — geçmişe dönüp düzeltmek için. */
  historyByGroup(groupId: Id): Promise<SessionSummary[]>
}

export interface SettingsRepository {
  /** Kulüp adı ve alt başlık — giriş ekranı ve başlık buradan beslenir. */
  clubIdentity(): Promise<ClubIdentity>
}

export interface DataSource {
  schools: SchoolRepository
  branches: BranchRepository
  groups: GroupRepository
  players: PlayerRepository
  sessions: SessionRepository
  attendance: AttendanceRepository
  settings: SettingsRepository
}
