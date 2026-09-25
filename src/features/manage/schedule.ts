import type { ScheduleSlot } from '../../domain/types'
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
