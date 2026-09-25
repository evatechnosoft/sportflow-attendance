import demo from '../../data/demo-club.json'
import type { Attendance, AttendanceStatus, Branch, Group, Player, Session } from '../../domain/types'
import type { MockSeed } from './mockDataSource'

/**
 * Shared demo fixture: the same file lives in clubcrm (`src/data/demo-club.json`),
 * so both apps show the same club, groups, students and attendance.
 */
export interface DemoClub {
  club: string
  branch: Branch
  groups: Array<{
    id: string
    name: string
    startTime: string
    durationMinutes: number
    weekdays: number[]
    coachId: string
  }>
  staff: Array<{ id: string; displayName: string; email: string; role: string }>
  families: Array<{
    id: string
    address: string
    payment: 'onTime' | 'early' | 'late1' | 'late2' | 'partial'
    guardians: Array<{ id: string; fullName: string; phone: string; email: string }>
    children: Array<{
      id: string
      firstName: string
      lastName: string
      birthDate: string
      gender: 'male' | 'female'
      groupId: string
      /** One letter per past session, oldest first: P present, A absent, L late, E excused. */
      attendance: string
      discounts: string[]
    }>
  }>
}

export const DEMO_CLUB = demo as DemoClub

const STATUS: Record<string, AttendanceStatus> = { P: 'present', A: 'absent', L: 'late', E: 'excused' }

/** Families whose dues are behind (CRM decides the same from the same fixture). */
const LATE_PAYMENTS = new Set(['late1', 'late2', 'partial'])

const localIso = (date: Date) => date.toLocaleDateString('en-CA')

const shift = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const isoWeekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() || 7

/** Season start: first day of the month three months before `today` (CRM plans start there too). */
export function seasonStart(today: string): string {
  const [year, month] = today.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 - 3, 1)).toISOString().slice(0, 10)
}

/** The last `count` training dates strictly before `today`, oldest first. */
export function pastSessionDates(today: string, weekdays: number[], count: number): string[] {
  const dates: string[] = []
  for (let day = shift(today, -1); dates.length < count; day = shift(day, -1)) {
    if (weekdays.includes(isoWeekday(day))) dates.unshift(day)
  }
  return dates
}

/** Demo data relative to `today`: same input, same output. */
export function buildSeed(today = new Date()): MockSeed {
  const todayIso = localIso(today)
  const joinedOn = seasonStart(todayIso)
  const coachName = (id: string) => DEMO_CLUB.staff.find((user) => user.id === id)?.displayName

  const groups: Group[] = DEMO_CLUB.groups.map((group) => ({
    id: group.id,
    name: group.name,
    branchId: DEMO_CLUB.branch.id,
    coachName: coachName(group.coachId),
    schedule: group.weekdays.map((weekday) => ({
      weekday,
      startTime: group.startTime,
      durationMinutes: group.durationMinutes,
    })),
  }))

  const players: Player[] = DEMO_CLUB.families.flatMap((family) =>
    family.children.map((child) => ({
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      birthDate: child.birthDate,
      gender: child.gender,
      status: 'active' as const,
      guardianName: family.guardians[0].fullName,
      guardianPhone: family.guardians[0].phone,
      groupHistory: [{ groupId: child.groupId, joinedOn }],
    })),
  )

  const children = DEMO_CLUB.families.flatMap((family) => family.children)
  const sessions: Session[] = []
  const attendance: Attendance[] = []
  for (const group of DEMO_CLUB.groups) {
    const members = children.filter((child) => child.groupId === group.id)
    const sessionCount = Math.max(...members.map((child) => child.attendance.length))
    pastSessionDates(todayIso, group.weekdays, sessionCount).forEach((date, index) => {
      const session: Session = { id: `session-${group.id}-${date}`, groupId: group.id, date, startTime: group.startTime }
      sessions.push(session)
      // Marked at the end of training, Istanbul time.
      const markedAt = new Date(
        new Date(`${date}T${group.startTime}:00+03:00`).getTime() + group.durationMinutes * 60_000,
      ).toISOString()
      for (const child of members) {
        attendance.push({ sessionId: session.id, playerId: child.id, status: STATUS[child.attendance[index]], markedAt })
      }
    })
  }

  const overdue = DEMO_CLUB.families
    .filter((family) => LATE_PAYMENTS.has(family.payment))
    .flatMap((family) => family.children.map((child) => child.id))

  return {
    clubIdentity: { primaryName: 'ANADOLU SPOR', secondaryName: 'Yoklama', description: 'VOLEYBOL — ÖRNEK VERİ' },
    schools: [],
    branches: [DEMO_CLUB.branch],
    groups,
    players,
    sessions,
    attendance,
    overdue,
  }
}
