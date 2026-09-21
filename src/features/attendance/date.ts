/** Yerel gün — UTC değil; TR'de 00:00–03:00 arası bir önceki güne kaymasın. */
export const todayIso = (now: Date = new Date()) => now.toLocaleDateString('en-CA')

export function shiftDay(iso: string, delta: number): string {
  const day = new Date(`${iso}T12:00:00`)
  day.setDate(day.getDate() + delta)
  return todayIso(day)
}

/** "Bugün" / "Dün" / "Yarın", diğer günler "Cumartesi 20 Eylül". */
export function dayLabel(iso: string, today: string = todayIso()): string {
  if (iso === today) return 'Bugün'
  if (iso === shiftDay(today, -1)) return 'Dün'
  if (iso === shiftDay(today, 1)) return 'Yarın'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
