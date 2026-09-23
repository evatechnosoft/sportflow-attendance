/** Yerel gün — UTC değil; TR'de 00:00–03:00 arası bir önceki güne kaymasın. */
export const todayIso = (now: Date = new Date()) => now.toLocaleDateString('en-CA')

export function shiftDay(iso: string, delta: number): string {
  const day = new Date(`${iso}T12:00:00`)
  day.setDate(day.getDate() + delta)
  return todayIso(day)
}

/** ISO-8601 haftagünü: 1 = Pazartesi … 7 = Pazar. */
export function weekdayOf(iso: string): number {
  // Öğlen saatiyle kur — gece yarısı UTC'ye çevrilince gün kayabilir.
  const day = new Date(`${iso}T12:00:00`).getDay()
  return day === 0 ? 7 : day
}

export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
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

/** "21 Eyl" — başlık altı kısa tarih. */
export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
