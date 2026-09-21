import type { Attendance, AttendanceStatus } from '../../domain/types'

export const STATUSES: AttendanceStatus[] = ['present', 'late', 'excused', 'absent']

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Var',
  late: 'Geç',
  excused: 'İzinli',
  absent: 'Yok',
}

export type Marks = Record<string, AttendanceStatus>

export interface Summary {
  counts: Record<AttendanceStatus, number>
  marked: number
  total: number
  /** Katılım yüzdesi (var + geç). Hiç işaret yoksa null → "henüz işaretlenmedi". */
  rate: number | null
}

export function summarize(marks: Marks, total: number): Summary {
  const counts: Record<AttendanceStatus, number> = { present: 0, late: 0, excused: 0, absent: 0 }
  for (const status of Object.values(marks)) counts[status] += 1
  const marked = Object.values(marks).length
  const rate = marked && total ? Math.round(((counts.present + counts.late) / total) * 100) : null
  return { counts, marked, total, rate }
}

export function marksFromRows(rows: Attendance[]): Marks {
  return Object.fromEntries(rows.map((row) => [row.playerId, row.status]))
}

/** Ekrandaki işaretler kayıtlı olandan farklı mı — kaydet çubuğu yalnız o zaman görünür. */
export function isDirty(marks: Marks, saved: Marks): boolean {
  const keys = new Set([...Object.keys(marks), ...Object.keys(saved)])
  for (const key of keys) if (marks[key] !== saved[key]) return true
  return false
}
