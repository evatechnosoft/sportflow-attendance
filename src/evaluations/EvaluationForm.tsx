import { useState } from 'react'
import { todayIso } from '../features/attendance/date'
import { NOTE_MAX, validateEvaluation, type EvaluationKind, type Skill } from './evaluations'

export interface EvaluationDraft {
  date: string
  scores: Record<string, number>
  note: string
  shared: boolean
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Yetenek başına 1-10 (44px dokunma hedefi), not; sporcuda "veliyle paylaş". */
export function EvaluationForm({
  kind,
  skills,
  busy,
  onSubmit,
  onCancel,
}: {
  kind: EvaluationKind
  skills: Skill[]
  busy: boolean
  onSubmit: (draft: EvaluationDraft) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(todayIso())
  const [scores, setScores] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [shared, setShared] = useState(false)
  const [error, setError] = useState('')

  const submit = () => {
    const invalid = validateEvaluation({ skills, scores, note })
    if (invalid) return setError(invalid)
    if (!date || date > todayIso()) return setError('Tarih bugünden ileri olamaz.')
    setError('')
    onSubmit({ date, scores, note, shared: kind === 'player' && shared })
  }

  return (
    <div className="space-y-3 rounded-2xl bg-surface-2 p-3">
      <label className="block text-xs font-semibold text-ink-2">
        Tarih
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink"
        />
      </label>
      {skills.map((skill) => (
        <div key={skill.key}>
          <p id={`skill-${kind}-${skill.key}`} className="mb-1 text-sm font-semibold">
            {skill.label}
          </p>
          <div role="radiogroup" aria-labelledby={`skill-${kind}-${skill.key}`} className="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {SCORES.map((value) => {
              const checked = scores[skill.key] === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setScores({ ...scores, [skill.key]: value })}
                  className={`min-h-11 rounded-xl text-sm font-bold tabular-nums transition ${
                    checked ? 'bg-accent text-bg' : 'border border-line bg-surface text-ink'
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <label className="block text-xs font-semibold text-ink-2">
        Koç notu
        <textarea
          value={note}
          rows={2}
          maxLength={NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-surface p-2 text-base text-ink"
        />
      </label>
      {kind === 'player' && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} className="h-5 w-5 accent-accent" />
          Veliyle paylaş
        </label>
      )}
      {error && <p role="alert" className="text-sm font-medium text-absent">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-xl bg-surface text-sm font-medium text-ink-2">
          Vazgeç
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="min-h-11 flex-1 rounded-xl bg-brand text-sm font-bold text-bg disabled:opacity-40"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}
