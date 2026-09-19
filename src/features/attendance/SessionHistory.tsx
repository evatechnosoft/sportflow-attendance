import type { SessionSummary } from '../../domain/types'

const LABELS: { key: keyof SessionSummary['counts']; label: string; classes: string }[] = [
  { key: 'present', label: 'V', classes: 'bg-brand/10 text-brand' },
  { key: 'late', label: 'G', classes: 'bg-warn/15 text-warn' },
  { key: 'excused', label: 'İ', classes: 'bg-ink/10 text-ink/70' },
  { key: 'absent', label: 'Y', classes: 'bg-danger/10 text-danger' },
]

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
  })

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
      <p className="rounded-2xl bg-white px-4 py-4 text-center text-sm text-ink/50">
        Bu grupta kayıtlı yoklama yok.
      </p>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold">Kayıtlı yoklamalar</h3>
        <span className="text-xs text-ink/40">düzeltmek için tarihe dokun</span>
      </div>

      <ul className="space-y-1">
        {history.map((summary) => {
          const active = summary.date === selectedDate
          const rate = summary.total
            ? Math.round(((summary.counts.present + summary.counts.late) / summary.total) * 100)
            : 0
          return (
            <li key={summary.sessionId}>
              <button
                type="button"
                onClick={() => onPick(summary.date)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                  active ? 'bg-brand/10 ring-1 ring-brand/30' : 'bg-surface hover:bg-surface/60'
                }`}
              >
                <span className="font-medium">{formatDate(summary.date)}</span>
                <span className="flex items-center gap-1">
                  {LABELS.map((item) => (
                    <span
                      key={item.key}
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${item.classes}`}
                      title={item.label}
                    >
                      {item.label}
                      {summary.counts[item.key]}
                    </span>
                  ))}
                  <span className="ml-1 w-10 text-right text-xs text-ink/50">%{rate}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
