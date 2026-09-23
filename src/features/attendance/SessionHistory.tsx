import type { SessionSummary } from '../../domain/types'
import { dayLabel } from './date'

const PARTS: { key: keyof SessionSummary['counts']; label: string; bar: string }[] = [
  { key: 'present', label: 'var', bar: 'bg-present' },
  { key: 'late', label: 'geç', bar: 'bg-late' },
  { key: 'excused', label: 'izinli', bar: 'bg-excused' },
  { key: 'absent', label: 'yok', bar: 'bg-absent' },
]

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })

/** Geçmiş oturumlar: tıklayınca o güne dönülür ve yoklama düzeltilebilir. */
export function SessionHistory({
  history,
  selectedDate,
  onPick,
}: {
  history: SessionSummary[]
  selectedDate: string
  onPick: (date: string) => void
}) {
  if (history.length === 0) {
    return (
      <p className="rounded-[20px] border border-line bg-surface px-4 py-6 text-center text-sm text-ink-2">
        Bu grupta kayıtlı yoklama yok.
      </p>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold">Kayıtlı yoklamalar</h2>
        <span className="text-xs text-ink-3">düzeltmek için tarihe dokun</span>
      </div>

      <ul className="space-y-2">
        {history.map((summary) => {
          const active = summary.date === selectedDate
          const total = summary.total || 1
          const rate = summary.total
            ? Math.round(((summary.counts.present + summary.counts.late) / summary.total) * 100)
            : 0
          const parts = PARTS.filter((part) => summary.counts[part.key] > 0)
          return (
            <li key={summary.sessionId}>
              <button
                type="button"
                onClick={() => onPick(summary.date)}
                className={`w-full rounded-[20px] border border-line bg-surface p-4 text-left transition hover:opacity-90 ${
                  active ? 'ring-2 ring-brand' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {dayLabel(summary.date)}
                    <span className="ml-2 text-xs text-ink-3">{shortDate(summary.date)}</span>
                  </span>
                  <span className="font-display text-2xl font-semibold tabular-nums">%{rate}</span>
                </div>

                <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
                  {parts.map((part) => (
                    <span
                      key={part.key}
                      className={part.bar}
                      style={{ width: `${(summary.counts[part.key] / total) * 100}%` }}
                    />
                  ))}
                </div>

                <p className="mt-2 text-xs text-ink-2">
                  {parts.map((part) => `${summary.counts[part.key]} ${part.label}`).join(' · ')}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
