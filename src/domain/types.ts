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
  schoolId: Id
  coachName?: string
  schedule: ScheduleSlot[]
}

export interface Player {
  id: Id
  firstName: string
  lastName: string
  birthDate?: string
  gender?: Gender
  groupId: Id
  status: PlayerStatus
  guardianName?: string
  guardianPhone?: string
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
