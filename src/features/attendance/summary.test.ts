import { describe, expect, it } from 'vitest'
import { isDirty, summarize } from './summary'

describe('summarize', () => {
  it('boşken yüzde vermez', () => {
    expect(summarize({}, 10).rate).toBeNull()
  })
  it('var + geç katılım sayılır', () => {
    const summary = summarize({ a: 'present', b: 'late', c: 'absent', d: 'excused' }, 5)
    expect(summary.counts).toEqual({ present: 1, late: 1, excused: 1, absent: 1 })
    expect(summary.marked).toBe(4)
    expect(summary.rate).toBe(40)
  })
})

describe('isDirty', () => {
  it('aynı işaretler temiz', () => {
    expect(isDirty({ a: 'present' }, { a: 'present' })).toBe(false)
  })
  it('yeni, değişen veya eksik işaret kirli', () => {
    expect(isDirty({ a: 'present' }, {})).toBe(true)
    expect(isDirty({ a: 'absent' }, { a: 'present' })).toBe(true)
    expect(isDirty({}, { a: 'present' })).toBe(true)
  })
})
