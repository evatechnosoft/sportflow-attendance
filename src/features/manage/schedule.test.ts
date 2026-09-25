import { describe, expect, it } from 'vitest'
import type { ScheduleSlot } from '../../domain/types'
import { addSlot, hasSlotOn, scheduleLabel } from './schedule'

const slot = (weekday: number, startTime = '17:00'): ScheduleSlot => ({
  weekday,
  startTime,
  durationMinutes: 90,
})

describe('scheduleLabel', () => {
  it('gün ve saati okunur biçimde birleştirir', () => {
    expect(scheduleLabel([slot(2), slot(6, '10:00')])).toBe('Salı 17:00 · Cumartesi 10:00')
  })

  it('gün tanımlı değilse boş metin döner', () => {
    expect(scheduleLabel([])).toBe('')
  })
})

describe('addSlot', () => {
  it('slotları güne ve saate göre sıralı tutar', () => {
    const slots = addSlot(addSlot([], slot(6, '10:00')), slot(2))
    expect(slots.map((row) => row.weekday)).toEqual([2, 6])
  })

  it('aynı gün + saat ikinci kez eklenmez', () => {
    const slots = addSlot(addSlot([], slot(2)), slot(2))
    expect(slots).toHaveLength(1)
  })

  it('aynı günün farklı saati ayrı slottur', () => {
    expect(addSlot(addSlot([], slot(2)), slot(2, '19:00'))).toHaveLength(2)
  })

  it('1-7 dışındaki gün eklenmez', () => {
    expect(addSlot([], slot(0))).toHaveLength(0)
    expect(addSlot([], slot(8))).toHaveLength(0)
  })
})

describe('hasSlotOn', () => {
  const slots = [slot(2), slot(6, '10:00')]

  it('o güne slot varsa true', () => {
    expect(hasSlotOn(slots, 2)).toBe(true)
    expect(hasSlotOn(slots, 3)).toBe(false)
  })

  it('takvim boşsa her gün false', () => {
    expect(hasSlotOn([], 2)).toBe(false)
  })
})
