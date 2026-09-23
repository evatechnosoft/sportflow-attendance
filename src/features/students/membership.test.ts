import { describe, expect, it } from 'vitest'
import type { Player } from '../../domain/types'
import {
  ageOn,
  changeGroup,
  isInGroup,
  joinGroup,
  leaveGroup,
  openSpells,
  startSpell,
} from './membership'

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  firstName: 'Ada',
  lastName: 'Yıldız',
  status: 'active',
  groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }],
  ...overrides,
})

/** İki açık dönemli sporcu: normal grubu + maç kadrosu. */
const inTwoGroups = () => joinGroup(player(), 'g2', '2026-09-23')

describe('üyelik dönemleri', () => {
  it('yeni sporcu tek açık dönemle başlar', () => {
    expect(startSpell('g1', '2026-09-23')).toEqual([{ groupId: 'g1', joinedOn: '2026-09-23' }])
  })

  it('ikinci gruba eklenen sporcu iki grupta birden görünür', () => {
    const both = inTwoGroups()
    expect(openSpells(both)).toHaveLength(2)
    expect(isInGroup(both, 'g1')).toBe(true)
    expect(isInGroup(both, 'g2')).toBe(true)
  })

  it('zaten üye olduğu gruba ekleme hiçbir şey değiştirmez', () => {
    const before = player()
    expect(joinGroup(before, 'g1', '2026-09-23')).toEqual(before)
  })

  it('gruptan çıkarma yalnız o dönemi kapatır, diğer üyelik durur', () => {
    const left = leaveGroup(inTwoGroups(), 'g1', '2026-09-30')
    expect(left.status).toBe('active')
    expect(isInGroup(left, 'g1')).toBe(false)
    expect(isInGroup(left, 'g2')).toBe(true)
    expect(left.groupHistory).toHaveLength(2)
  })

  it('son açık dönem de kapanınca sporcu pasife düşer', () => {
    const out = leaveGroup(leaveGroup(inTwoGroups(), 'g1', '2026-09-30'), 'g2', '2026-10-01')
    expect(out.status).toBe('inactive')
    expect(openSpells(out)).toHaveLength(0)
  })

  it('üye olmadığı gruptan çıkarma hiçbir şey değiştirmez', () => {
    const before = player()
    expect(leaveGroup(before, 'g9', '2026-09-30')).toEqual(before)
  })

  it('geri dönüş yeni dönem açar, eski dönem geri açılmaz', () => {
    const back = joinGroup(leaveGroup(player(), 'g1', '2026-09-23'), 'g1', '2026-10-01')
    expect(back.status).toBe('active')
    expect(back.groupHistory).toEqual([
      { groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-23' },
      { groupId: 'g1', joinedOn: '2026-10-01' },
    ])
  })

  it('grup değişimi yalnız kaynağı kapatır, diğer gruplar durur', () => {
    const moved = changeGroup(inTwoGroups(), 'g1', 'g3', '2026-09-30')
    expect(isInGroup(moved, 'g1')).toBe(false)
    expect(isInGroup(moved, 'g2')).toBe(true)
    expect(isInGroup(moved, 'g3')).toBe(true)
    expect(moved.groupHistory.find((spell) => spell.groupId === 'g1')?.leftOn).toBe('2026-09-30')
  })

  it('hedefine zaten üye olan sporcu taşınınca kaynak yine kapanır', () => {
    const moved = changeGroup(inTwoGroups(), 'g1', 'g2', '2026-09-30')
    expect(isInGroup(moved, 'g1')).toBe(false)
    expect(openSpells(moved)).toHaveLength(1)
  })

  it('kapanmış dönemler silinmez', () => {
    const out = leaveGroup(player(), 'g1', '2026-09-23')
    expect(out.groupHistory).toHaveLength(1)
    expect(out.groupHistory[0].leftOn).toBe('2026-09-23')
  })

  it('yaş doğum gününden önce bir eksiktir', () => {
    expect(ageOn('2013-12-31', '2026-09-23')).toBe(12)
    expect(ageOn('2013-01-01', '2026-09-23')).toBe(13)
    expect(ageOn(undefined, '2026-09-23')).toBeNull()
  })
})
