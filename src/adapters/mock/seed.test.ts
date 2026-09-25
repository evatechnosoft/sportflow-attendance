import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildSeed, DEMO_CLUB, pastSessionDates, seasonStart } from './seed'
import { createMockDataSource } from './mockDataSource'

/**
 * clubcrm's `src/data/demo-club.json` must list the same students. The same
 * constant is asserted there; change both files together.
 */
const ROSTER_SHA256 = '585f56e37ea80800b1b2f2494a70b45bcea860ddf4dd25e9b9ac090e20f329b7'

const rosterKey = () =>
  DEMO_CLUB.families
    .flatMap((family) => family.children.map((c) => `${c.id}|${c.firstName}|${c.lastName}|${c.birthDate}|${c.groupId}`))
    .join('\n')

describe('buildSeed (demo)', () => {
  const today = new Date('2026-09-25T12:00:00')
  const seed = buildSeed(today)

  it('öğrenci listesi clubcrm ile aynıdır', () => {
    expect(createHash('sha256').update(rosterKey()).digest('hex')).toBe(ROSTER_SHA256)
  })

  it('tek branş, iki saat grubu, yaş kategorisi yok', () => {
    expect(seed.branches?.map((b) => b.name)).toEqual(['Voleybol'])
    expect(seed.groups?.map((g) => g.name)).toEqual(['12:00–13:00', '13:00–14:00'])
    expect(seed.groups?.every((g) => !/U\d/.test(g.name))).toBe(true)
    for (const group of seed.groups!) {
      expect(group.schedule.map((slot) => slot.weekday)).toEqual([6, 7])
    }
  })

  it('10 aileden 20 aktif öğrenci, gruplarda 10ar', async () => {
    expect(DEMO_CLUB.families).toHaveLength(10)
    expect(seed.players).toHaveLength(20)
    expect(seed.players?.every((p) => p.status === 'active' && p.guardianName && p.guardianPhone)).toBe(true)
    const db = createMockDataSource(seed)
    for (const group of seed.groups!) {
      expect(await db.players.listByGroup(group.id)).toHaveLength(10)
    }
  })

  it('bazı kardeşler farklı gruplardadır', () => {
    const split = DEMO_CLUB.families.filter((f) => new Set(f.children.map((c) => c.groupId)).size > 1)
    expect(split.length).toBeGreaterThan(0)
  })

  it('son 6 haftanın her antrenmanında herkesin yoklaması var, devamsızlık gerçekçi', () => {
    expect(seed.sessions).toHaveLength(24)
    expect(seed.attendance).toHaveLength(24 * 10)
    const absent = seed.attendance!.filter((row) => row.status === 'absent').length
    expect(absent / seed.attendance!.length).toBeGreaterThan(0.03)
    expect(absent / seed.attendance!.length).toBeLessThan(0.2)
  })

  it('oturumlar bugünden önce ve grubun günlerinde', () => {
    for (const session of seed.sessions!) {
      expect(session.date < '2026-09-25').toBe(true)
      expect([6, 7]).toContain(new Date(`${session.date}T00:00:00Z`).getUTCDay() || 7)
    }
  })

  it('tarihler bugüne göredir', () => {
    expect(seasonStart('2026-09-25')).toBe('2026-06-01')
    expect(seasonStart('2026-02-10')).toBe('2025-11-01')
    expect(pastSessionDates('2026-09-27', [6, 7], 3)).toEqual(['2026-09-19', '2026-09-20', '2026-09-26'])
  })

  it('aidatı geciken ailelerin çocukları gecikmiş görünür', () => {
    const late = DEMO_CLUB.families.filter((f) => f.payment !== 'onTime' && f.payment !== 'early')
    expect(late.length).toBeGreaterThanOrEqual(2)
    expect(seed.overdue).toEqual(late.flatMap((f) => f.children.map((c) => c.id)))
  })

  it('seed yüklenmiş DataSource geçmiş yoklamayı okur', async () => {
    const db = createMockDataSource(buildSeed())
    const group = (await db.groups.list())[0]
    const history = await db.attendance.historyByGroup(group.id)
    expect(history).toHaveLength(12)
    expect(history[0].total).toBe(10)
  })
})
