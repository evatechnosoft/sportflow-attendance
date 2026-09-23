export type Id = string

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type PlayerStatus = 'active' | 'inactive'
export type Gender = 'male' | 'female' | 'other'

export interface School {
  id: Id
  name: string
  district?: string
}

export interface Branch {
  id: Id
  name: string
  slug: string
}

export interface ScheduleSlot {
  /** 1 = Monday ... 7 = Sunday (ISO-8601) */
  weekday: number
  startTime: string
  durationMinutes: number
}

export interface Group {
  id: Id
  name: string
  branchId: Id
  /** Okul isteğe bağlı: okulsuz kulüp grupları da olur. */
  schoolId?: Id
  coachName?: string
  schedule: ScheduleSlot[]
}

/** Bir sporcunun bir gruptaki dönemi. Açık dönem: leftOn yok. */
export interface GroupSpell {
  groupId: Id
  /** ISO date, YYYY-MM-DD */
  joinedOn: string
  /** ISO date; yoksa sporcu bu grupta hâlâ aktif. */
  leftOn?: string
}

export interface Player {
  id: Id
  firstName: string
  lastName: string
  birthDate?: string
  gender?: Gender
  /** Kulüp geneli durum: hiç açık dönemi kalmayan sporcu pasiftir. */
  status: PlayerStatus
  guardianName?: string
  guardianPhone?: string
  /** Geçmişten bugüne, joinedOn'a göre artan. Son kayıt güncel dönemdir. */
  groupHistory: GroupSpell[]
}

export interface Session {
  id: Id
  groupId: Id
  /** ISO date, YYYY-MM-DD */
  date: string
  startTime?: string
}

export interface Attendance {
  sessionId: Id
  playerId: Id
  status: AttendanceStatus
  note?: string
  markedAt: string
}

export interface ClubIdentity {
  primaryName: string
  secondaryName: string
  description: string
}

/** Kulübün açıp kapatabildiği alanlar; ileride genişler. */
export type OptionalField = 'school'

export interface ClubSettings {
  fields: Record<OptionalField, boolean>
}

export const DEFAULT_CLUB_SETTINGS: ClubSettings = { fields: { school: true } }

export interface SessionSummary {
  sessionId: Id
  date: string
  counts: Record<AttendanceStatus, number>
  total: number
}
