import raw from '../../data/players.seed.json'
import type { Attendance, Branch, Group, Player, School, Session } from '../../domain/types'
import type { MockSeed } from './mockDataSource'

interface RawPlayer {
  ParentName: string
  Phone: string
  PlayerName: string
  PlayerLastName: string
  PlayerBirthDate: string
  PlayerGender: string
}

const SCHOOLS = ['Atatürk Ortaokulu', 'Cumhuriyet İlkokulu', 'Fatih Anadolu Lisesi']
const BRANCHES = [
  { name: 'Voleybol', slug: 'voleybol' },
  { name: 'Basketbol', slug: 'basketbol' },
  { name: 'Hentbol', slug: 'hentbol' },
]

/** Kaç hafta geriye oturum üretilsin. */
const WEEKS_BACK = 4

/** Deterministik mock veri: aynı girdi → aynı çıktı, test ve demo tekrar edilebilir olsun. */
export function buildSeed(today = new Date('2026-09-19')): MockSeed {
  const schools: School[] = SCHOOLS.map((name, index) => ({ id: `school-${index + 1}`, name }))
  const branches: Branch[] = BRANCHES.map((branch, index) => ({
    ...branch,
    id: `branch-${index + 1}`,
  }))

  const groups: Group[] = []
  schools.forEach((school, schoolIndex) => {
    branches.forEach((branch, branchIndex) => {
      // Her okulda her branş yok: 3x3'ün köşegen dışı bir kısmı boş kalsın, gerçeğe yakın.
      if ((schoolIndex + branchIndex) % 3 === 2) return
      groups.push({
        id: `group-${school.id}-${branch.id}`,
        name: `${branch.name} U${12 + schoolIndex * 2}`,
        schoolId: school.id,
        branchId: branch.id,
        coachName: ['Serkan Demir', 'Elif Kaya', 'Murat Şahin'][(schoolIndex + branchIndex) % 3],
        schedule: [{ weekday: 2 + branchIndex, startTime: '17:00', durationMinutes: 90 }],
      })
    })
  })

  const players: Player[] = (raw as RawPlayer[]).map((row, index) => ({
    id: `player-${index + 1}`,
    firstName: row.PlayerName,
    lastName: row.PlayerLastName,
    birthDate: row.PlayerBirthDate,
    gender: row.PlayerGender === 'female' ? 'female' : 'male',
    groupId: groups[index % groups.length].id,
    status: index % 17 === 0 ? 'inactive' : 'active',
    guardianName: row.ParentName,
    guardianPhone: row.Phone,
  }))

  const sessions: Session[] = []
  const attendance: Attendance[] = []
  groups.forEach((group) => {
    const weekday = group.schedule[0]?.weekday ?? 2
    for (let week = WEEKS_BACK; week >= 1; week--) {
      const date = isoDateOfWeekday(today, weekday, week)
      const session: Session = {
        id: `session-${group.id}-${date}`,
        groupId: group.id,
        date,
        startTime: group.schedule[0]?.startTime,
      }
      sessions.push(session)

      players
        .filter((player) => player.groupId === group.id && player.status === 'active')
        .forEach((player, index) => {
          const roll = (index + week) % 7
          attendance.push({
            sessionId: session.id,
            playerId: player.id,
            status: roll === 0 ? 'absent' : roll === 3 ? 'late' : 'present',
            markedAt: `${date}T18:30:00.000Z`,
          })
        })
    }
  })

  return { schools, branches, groups, players, sessions, attendance }
}

/** `weeksAgo` hafta önceki, verilen ISO haftagününe denk gelen tarih. */
function isoDateOfWeekday(today: Date, weekday: number, weeksAgo: number): string {
  const date = new Date(today)
  const currentIso = date.getDay() === 0 ? 7 : date.getDay()
  date.setDate(date.getDate() - (currentIso - weekday) - weeksAgo * 7)
  return date.toISOString().slice(0, 10)
}
