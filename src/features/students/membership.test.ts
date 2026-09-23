import { describe, expect, it } from 'vitest'
import type { Player } from '../../domain/types'
import { ageOn, changeGroup, currentSpell, leaveGroup, rejoinGroup, startSpell } from './membership'

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  firstName: 'Ada',
  lastName: 'Yıldız',
  groupId: 'g1',
  status: 'active',
  groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }],
  ...overrides,
})

describe('üyelik dönemleri', () => {
  it('yeni sporcu tek açık dönemle başlar', () => {
    expect(startSpell('g1', '2026-09-23')).toEqual([{ groupId: 'g1', joinedOn: '2026-09-23' }])
  })

  it('grup değişimi açık dönemi kapatır ve yenisini açar', () => {
    const moved = changeGroup(player(), 'g2', '2026-09-23')
    expect(moved.groupId).toBe('g2')
    expect(moved.groupHistory).toEqual([
      { groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-23' },
      { groupId: 'g2', joinedOn: '2026-09-23' },
    ])
  })

  it('aynı gruba taşıma hiçbir şey değiştirmez', () => {
    const before = player()
    expect(changeGroup(before, 'g1', '2026-09-23')).toEqual(before)
  })

  it('ayrılma açık dönemi kapatır ve durumu pasife çeker', () => {
    const left = leaveGroup(player(), '2026-09-23')
    expect(left.status).toBe('inactive')
    expect(left.groupHistory.at(-1)).toEqual({
      groupId: 'g1',
      joinedOn: '2026-09-01',
      leftOn: '2026-09-23',
    })
  })

  it('geri dönüş eski dönemi açmaz, yeni dönem açar', () => {
    const back = rejoinGroup(leaveGroup(player(), '2026-09-23'), 'g2', '2026-10-01')
    expect(back.status).toBe('active')
    expect(back.groupId).toBe('g2')
    expect(back.groupHistory).toHaveLength(2)
    expect(back.groupHistory.at(-1)).toEqual({ groupId: 'g2', joinedOn: '2026-10-01' })
  })

  it('currentSpell yalnız açık dönemi döner', () => {
    expect(currentSpell(player())?.groupId).toBe('g1')
    expect(currentSpell(leaveGroup(player(), '2026-09-23'))).toBeNull()
  })

  it('yaş doğum gününden önce bir eksiktir', () => {
    expect(ageOn('2013-12-31', '2026-09-23')).toBe(12)
    expect(ageOn('2013-01-01', '2026-09-23')).toBe(13)
    expect(ageOn(undefined, '2026-09-23')).toBeNull()
  })
})
