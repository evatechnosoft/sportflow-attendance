import { describe, expect, it } from 'vitest'
import { WEEKDAY_LABEL, dayLabel, shiftDay, todayIso, weekdayOf } from './date'

describe('todayIso', () => {
  it('yerel günü verir, UTC gününü değil', () => {
    // 21 Eylül 00:30 yerel; UTC+3'te toISOString 20'sini gösterirdi.
    const local = new Date(2026, 8, 21, 0, 30)
    expect(todayIso(local)).toBe('2026-09-21')
  })
})

describe('shiftDay', () => {
  it('ay ve yıl sınırını geçer', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('dayLabel', () => {
  const today = '2026-09-21'
  it('bugün / dün / yarın', () => {
    expect(dayLabel('2026-09-21', today)).toBe('Bugün')
    expect(dayLabel('2026-09-20', today)).toBe('Dün')
    expect(dayLabel('2026-09-22', today)).toBe('Yarın')
  })
  it('uzak gün: haftanın günü + gün + ay', () => {
    expect(dayLabel('2026-09-19', today)).toMatch(/Cumartesi/)
    expect(dayLabel('2026-09-19', today)).toMatch(/19 Eylül/)
  })
})

describe('weekdayOf', () => {
  it('ISO-8601 gününü verir: 1 = Pazartesi, 7 = Pazar', () => {
    expect(weekdayOf('2026-09-21')).toBe(1)
    expect(weekdayOf('2026-09-19')).toBe(6)
    expect(weekdayOf('2026-09-20')).toBe(7)
  })

  it('bir haftanın yedi günü 1-7 aralığını bir kez doldurur', () => {
    const week = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']
    expect(week.map(weekdayOf)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('etiketler günle eşleşir', () => {
    expect(WEEKDAY_LABEL[weekdayOf('2026-09-19')]).toBe('Cumartesi')
    expect(WEEKDAY_LABEL[1]).toBe('Pazartesi')
    expect(WEEKDAY_LABEL[7]).toBe('Pazar')
  })
})
