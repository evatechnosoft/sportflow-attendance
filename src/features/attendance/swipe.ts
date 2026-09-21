import type { AttendanceStatus } from '../../domain/types'

/** Kaydırmanın duruma dönüşme eşiği (px). */
export const SWIPE_THRESHOLD = 56

/** Hızlı fırlatma: bu hızın (px/s) üstünde kısa mesafe de yeter. */
export const FLICK_VELOCITY = 600

/** Bu mesafeden fazlası kaydırma sayılır; altı tıklama kalır (drag/click çakışması). */
export const DRAG_SLOP = 10

/** Sağa → geldi, sola → gelmedi. Eşik altı ancak hızlı fırlatmayla geçer. */
export function resolveSwipe(offsetX: number, velocityX = 0): AttendanceStatus | null {
  const flick = Math.abs(velocityX) > FLICK_VELOCITY && Math.sign(velocityX) === Math.sign(offsetX)
  const far = Math.abs(offsetX) > SWIPE_THRESHOLD
  if (!far && !(flick && Math.abs(offsetX) > DRAG_SLOP)) return null
  return offsetX > 0 ? 'present' : 'absent'
}

export function isDrag(offsetX: number): boolean {
  return Math.abs(offsetX) > DRAG_SLOP
}
