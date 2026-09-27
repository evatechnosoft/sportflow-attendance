import type { AttendanceWindow, ScheduleSlot } from '../../domain/types'
import { WEEKDAY_LABEL } from '../attendance/date'

const isValidWeekday = (weekday: number) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7

const byDayAndTime = (a: ScheduleSlot, b: ScheduleSlot) =>
  a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)

/** "Salı 17:00 · Cumartesi 10:00"; takvim boşsa boş metin. */
export function scheduleLabel(slots: ScheduleSlot[]): string {
  return [...slots]
    .sort(byDayAndTime)
    .map((slot) => `${WEEKDAY_LABEL[slot.weekday] ?? '?'} ${slot.startTime}`)
    .join(' · ')
}

/** Geçersiz gün ve aynı gün + saat yinelemesi sessizce atlanır; asıl kapı adaptörde. */
export function addSlot(slots: ScheduleSlot[], slot: ScheduleSlot): ScheduleSlot[] {
  if (!isValidWeekday(slot.weekday)) return slots
  if (slots.some((row) => row.weekday === slot.weekday && row.startTime === slot.startTime)) {
    return slots
  }
  return [...slots, slot].sort(byDayAndTime)
}

export function hasSlotOn(slots: ScheduleSlot[], weekday: number): boolean {
  return slots.some((slot) => slot.weekday === weekday)
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** Ders penceresi: başlangıçtan `beforeMinutes` önce açılır, bitişten `afterMinutes` sonra kapanır. */
export function inWindow(
  lesson: Pick<ScheduleSlot, 'startTime' | 'durationMinutes'>,
  time: string,
  window: AttendanceWindow,
): boolean {
  const now = minutesOf(time)
  const start = minutesOf(lesson.startTime)
  return now >= start - window.beforeMinutes && now <= start + lesson.durationMinutes + window.afterMinutes
}

/** Şu anki saate denk gelen slot; pencere kulüp ayarından gelir. */
export function slotNow(
  slots: ScheduleSlot[],
  weekday: number,
  time: string,
  window: AttendanceWindow,
): ScheduleSlot | null {
  return slots.find((slot) => slot.weekday === weekday && inWindow(slot, time, window)) ?? null
}
