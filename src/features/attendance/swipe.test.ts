import { describe, expect, it } from 'vitest'
import { DRAG_SLOP, SWIPE_THRESHOLD, isDrag, resolveSwipe } from './swipe'

describe('resolveSwipe', () => {
  it('sağa eşiği aşan kaydırma "geldi"', () => {
    expect(resolveSwipe(SWIPE_THRESHOLD + 1)).toBe('present')
  })

  it('sola eşiği aşan kaydırma "gelmedi"', () => {
    expect(resolveSwipe(-SWIPE_THRESHOLD - 1)).toBe('absent')
  })

  it('eşiğin altındaki hareket durumu değiştirmez', () => {
    expect(resolveSwipe(SWIPE_THRESHOLD)).toBeNull()
    expect(resolveSwipe(-SWIPE_THRESHOLD)).toBeNull()
    expect(resolveSwipe(0)).toBeNull()
  })
})

describe('isDrag', () => {
  it('küçük hareket tıklama sayılır, kart açılır', () => {
    expect(isDrag(DRAG_SLOP)).toBe(false)
  })

  it('eşikten büyük hareket kaydırmadır, tıklamayı yutar', () => {
    expect(isDrag(DRAG_SLOP + 1)).toBe(true)
    expect(isDrag(-DRAG_SLOP - 1)).toBe(true)
  })
})

describe('resolveSwipe · hız', () => {
  it('hızlı fırlatma kısa mesafeyle de karar verir', () => {
    expect(resolveSwipe(24, 900)).toBe('present')
    expect(resolveSwipe(-24, -900)).toBe('absent')
  })
  it('ters yönde hız sayılmaz, slop altı hiç sayılmaz', () => {
    expect(resolveSwipe(24, -900)).toBeNull()
    expect(resolveSwipe(5, 900)).toBeNull()
  })
})
