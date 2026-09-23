import { describe, expect, it } from 'vitest'
import { buildSeed } from './seed'
import { createMockDataSource } from './mockDataSource'

describe('buildSeed', () => {
  const seed = buildSeed()

  it('okul, branş ve grup üretir', () => {
    expect(seed.schools).toHaveLength(3)
    expect(seed.branches).toHaveLength(3)
    expect(seed.groups?.length).toBeGreaterThan(3)
  })

  it('her dönem var olan bir gruba bağlıdır', () => {
    const groupIds = new Set(seed.groups?.map((group) => group.id))
    expect(
      seed.players?.every((player) =>
        player.groupHistory.every((spell) => groupIds.has(spell.groupId)),
      ),
    ).toBe(true)
  })

  it('demo için 1-2 aktif sporcunun aidatı gecikmiştir', () => {
    const active = new Set(seed.players?.filter((p) => p.status === 'active').map((p) => p.id))
    expect(seed.overdue?.length).toBeGreaterThanOrEqual(1)
    expect(seed.overdue?.length).toBeLessThanOrEqual(2)
    expect(seed.overdue?.every((id) => active.has(id))).toBe(true)
  })

  it('en az bir sporcu aynı anda iki gruptadır', () => {
    const multi = seed.players?.filter(
      (player) => player.groupHistory.filter((spell) => !spell.leftOn).length > 1,
    )
    expect(multi?.length).toBeGreaterThan(0)
  })

  it('geçmiş oturumların yoklaması yalnız aktif oyuncular için yazılır', () => {
    const activeIds = new Set(
      seed.players?.filter((player) => player.status === 'active').map((player) => player.id),
    )
    expect(seed.attendance?.every((row) => activeIds.has(row.playerId))).toBe(true)
  })

  it('demo veride ayrılmış sporcu ve iki dönemli sporcu bulunur', () => {
    const players = seed.players!
    expect(players.some((player) => player.status === 'inactive')).toBe(true)
    expect(players.some((player) => player.groupHistory.length > 1)).toBe(true)
    // Ayrılan sporcunun son dönemi kapalı, aktif sporcununki açık.
    for (const player of players) {
      const open = player.groupHistory.at(-1)!.leftOn === undefined
      expect(open).toBe(player.status === 'active')
    }
  })

  it('oturum tarihleri grubun gününe denk gelir', () => {
    const group = seed.groups![0]
    const session = seed.sessions!.find((row) => row.groupId === group.id)!
    const isoWeekday = new Date(`${session.date}T00:00:00Z`).getUTCDay() || 7
    expect(isoWeekday).toBe(group.schedule[0].weekday)
  })

  it('seed yüklenmiş DataSource yoklama okur', async () => {
    const db = createMockDataSource(buildSeed())
    const group = (await db.groups.list())[0]
    const session = (await db.sessions.listByGroup(group.id))[0]
    expect((await db.attendance.listBySession(session.id)).length).toBeGreaterThan(0)
  })
})
