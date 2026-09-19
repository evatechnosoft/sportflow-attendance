import type { AttendanceStatus } from '../../domain/types'

/** Kaydırmanın duruma dönüşme eşiği (px). */
export const SWIPE_THRESHOLD = 56

/** Bu mesafeden fazlası kaydırma sayılır; altı tıklama kalır (drag/click çakışması). */
export const DRAG_SLOP = 10

/** Sağa kaydır → geldi, sola kaydır → gelmedi. Eşiğin altı kararsız. */
export function resolveSwipe(offsetX: number): AttendanceStatus | null {
  if (offsetX > SWIPE_THRESHOLD) return 'present'
  if (offsetX < -SWIPE_THRESHOLD) return 'absent'
  return null
}

export function isDrag(offsetX: number): boolean {
  return Math.abs(offsetX) > DRAG_SLOP
}
