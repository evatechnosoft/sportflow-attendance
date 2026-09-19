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

  it('her oyuncu var olan bir gruba bağlıdır', () => {
    const groupIds = new Set(seed.groups?.map((group) => group.id))
    expect(seed.players?.every((player) => groupIds.has(player.groupId))).toBe(true)
  })

  it('geçmiş oturumların yoklaması yalnız aktif oyuncular için yazılır', () => {
    const activeIds = new Set(
      seed.players?.filter((player) => player.status === 'active').map((player) => player.id),
    )
    expect(seed.attendance?.every((row) => activeIds.has(row.playerId))).toBe(true)
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
