import type {
  Attendance,
  AttendanceStatus,
  Branch,
  ClubIdentity,
  ClubSettings,
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
  /** Okulu kullanan grupların schoolId'si temizlenir; gruplar silinmez. */
  remove(id: Id): Promise<void>
}

export interface BranchRepository {
  list(): Promise<Branch[]>
  create(input: Omit<Branch, 'id'>): Promise<Branch>
  /** Grup kullanıyorsa in_use ("N grup bu branşı kullanıyor") ile reddedilir. */
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
  /** Salon sınav olunca saat kayar — yalnız o oturumu etkiler. */
  update(id: Id, patch: { startTime?: string }): Promise<Session>
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
  /** Alan anahtarları; kapalı alan gizlenir, verisi silinmez. */
  get(): Promise<ClubSettings>
  update(patch: { fields?: Partial<ClubSettings['fields']> }): Promise<ClubSettings>
}

/**
 * CRM'in aidat verisine tek yönlü, salt okuma bakış. Yoklama asla yazmaz;
 * yalnız "gecikmiş" bilgisi taşınır — tutar/detay koçun işi değil.
 */
export interface DuesRepository {
  /** Grubun aktif sporcularından gecikmiş taksiti olanların id'leri. */
  overdueByGroup(groupId: Id): Promise<Id[]>
}

export interface DataSource {
  schools: SchoolRepository
  branches: BranchRepository
  groups: GroupRepository
  players: PlayerRepository
  sessions: SessionRepository
  attendance: AttendanceRepository
  settings: SettingsRepository
  dues: DuesRepository
}
