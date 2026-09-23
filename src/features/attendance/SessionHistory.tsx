import type { SessionSummary } from '../../domain/types'
import { dayLabel } from './date'

const PARTS: { key: keyof SessionSummary['counts']; label: string; bar: string; text: string }[] = [
  { key: 'present', label: 'var', bar: 'bg-present', text: 'text-present' },
  { key: 'late', label: 'geç', bar: 'bg-late', text: 'text-late' },
  { key: 'excused', label: 'izinli', bar: 'bg-excused', text: 'text-excused' },
  { key: 'absent', label: 'yok', bar: 'bg-absent', text: 'text-absent' },
]

const dayNumber = (iso: string) => new Date(`${iso}T12:00:00`).getDate()
const monthShort = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { month: 'short' })

/** Katılım oranı rengi: yüksek yeşil, orta turuncu, düşük kırmızı. */
const rateTone = (rate: number) =>
  rate >= 75 ? 'text-present' : rate >= 50 ? 'text-late' : 'text-absent'

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
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">
          Kayıtlı yoklamalar
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-bold text-accent">
            {history.length}
          </span>
        </h2>
        <p className="text-xs font-medium text-ink-2">Düzeltmek için tarihe dokun</p>
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
                className={`w-full rounded-[20px] border border-line bg-surface p-3 text-left transition hover:opacity-90 ${
                  active ? 'ring-2 ring-accent' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-header leading-none text-on-header">
                    <span className="font-display text-lg font-bold">{dayNumber(summary.date)}</span>
                    <span className="text-[10px] font-semibold uppercase text-on-header-2">
                      {monthShort(summary.date)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{dayLabel(summary.date)}</span>
                    <span className="mt-1 flex gap-2 text-xs font-semibold">
                      {parts.map((part) => (
                        <span key={part.key} className={part.text}>
                          {`${summary.counts[part.key]} ${part.label}`}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={`font-display text-2xl font-bold tabular-nums ${rateTone(rate)}`}>
                    %{rate}
                  </span>
                </div>

                <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2">
                  {parts.map((part) => (
                    <span
                      key={part.key}
                      className={part.bar}
                      style={{ width: `${(summary.counts[part.key] / total) * 100}%` }}
                    />
                  ))}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
