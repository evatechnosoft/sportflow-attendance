import { useContext, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EvaluationForm, type EvaluationDraft } from './EvaluationForm'
import { EvaluationsContext } from './context'
import { latestByStudent, latestTwo, skillAverages, type Evaluation, type EvaluationKind, type Skill } from './evaluations'
import { RadarChart } from './RadarChart'

const dmy = (iso: string) => iso.split('-').reverse().join('.')

/** Yeni kayıt / paylaşım / silme; başarıda grubun değerlendirmeleri yeniden okunur. */
function useEvaluationWrites(groupId: string) {
  const context = useContext(EvaluationsContext)
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const options = {
    onSuccess: () => {
      setError('')
      return queryClient.invalidateQueries({ queryKey: ['evaluations', groupId] })
    },
    onError: (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.'),
  }
  const create = useMutation({
    mutationFn: (input: { kind: EvaluationKind; studentId?: string; skills: Skill[]; draft: EvaluationDraft }) =>
      context!.source.create({
        kind: input.kind,
        groupId,
        studentId: input.studentId,
        skills: input.skills,
        ...input.draft,
      }),
    ...options,
  })
  const share = useMutation({
    mutationFn: (row: Evaluation) => context!.source.setShared(row.id, !row.shared),
    ...options,
  })
  const remove = useMutation({ mutationFn: (id: string) => context!.source.remove(id), ...options })
  return { create, share, remove, error, me: context?.me ?? '' }
}

/** Son (dolu) ve bir önceki (kesikli) değerlendirme; eksenler son kaydın kendi yetenekleri. */
function EvaluationChart({ title, rows }: { title: string; rows: Evaluation[] }) {
  const [latest, previous] = latestTwo(rows)
  if (!latest) return <p className="text-sm text-ink-2">Henüz değerlendirme yok.</p>
  return (
    <div className="space-y-2">
      <RadarChart
        title={title}
        axes={latest.skills}
        current={{ label: dmy(latest.date), values: latest.scores }}
        previous={previous && { label: dmy(previous.date), values: previous.scores }}
      />
      {latest.note && (
        <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-2 text-sm">
          {latest.note}
          <span className="mt-1 block text-xs text-ink-2">{latest.createdByName}</span>
        </p>
      )}
    </div>
  )
}

/** Sporcu kartında: gelişim grafiği, yeni değerlendirme, geçmiş + veliyle paylaşım. */
export function PlayerEvaluations({
  name,
  studentId,
  groupId,
  rows,
  skills,
}: {
  name: string
  studentId: string
  groupId: string
  rows: Evaluation[]
  skills: Skill[]
}) {
  const [adding, setAdding] = useState(false)
  const { create, share, remove, error, me } = useEvaluationWrites(groupId)
  return (
    <div className="space-y-3 border-t border-line p-3">
      <EvaluationChart title={`${name} yetenek değerlendirmesi`} rows={rows} />
      {adding ? (
        <EvaluationForm
          kind="player"
          skills={skills}
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(draft) =>
            create.mutate({ kind: 'player', studentId, skills, draft }, { onSuccess: () => setAdding(false) })
          }
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="min-h-11 w-full rounded-xl bg-accent-soft text-sm font-bold text-accent">
          Yeni değerlendirme
        </button>
      )}
      {error && <p className="text-sm font-medium text-absent">{error}</p>}
      {rows.length > 0 && (
        <ul aria-label="Değerlendirme geçmişi" className="divide-y divide-line text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex min-h-11 items-center gap-2 py-1">
              <span className="min-w-0 flex-1 truncate">
                {dmy(row.date)} <span className="text-xs text-ink-2">· {row.createdByName}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={row.shared}
                aria-label={`Veliyle paylaş · ${dmy(row.date)}`}
                disabled={share.isPending}
                onClick={() => share.mutate(row)}
                className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold ${
                  row.shared ? 'bg-present-soft text-present' : 'bg-surface-2 text-ink-2'
                }`}
              >
                {row.shared ? 'Velide görünür' : 'Veliyle paylaş'}
              </button>
              {row.createdBy === me && (
                <button
                  type="button"
                  aria-label={`Sil · ${dmy(row.date)}`}
                  disabled={remove.isPending}
                  onClick={() => window.confirm('Bu değerlendirme silinsin mi?') && remove.mutate(row.id)}
                  className="h-11 w-11 shrink-0 rounded-xl text-absent"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Grup: takım değerlendirmesi radarı + sporcuların son değerlendirmelerinin yetenek ortalaması. */
export function TeamEvaluations({
  groupId,
  studentIds,
  rows,
  skills,
}: {
  groupId: string
  studentIds: string[]
  rows: Evaluation[]
  skills: Skill[]
}) {
  const [adding, setAdding] = useState(false)
  const { create, error } = useEvaluationWrites(groupId)
  const members = new Set(studentIds)
  const latest = latestByStudent(rows).filter((row) => members.has(row.studentId ?? ''))
  const averages = skillAverages(latest, skills)
  return (
    <section aria-label="Takım değerlendirmesi" className="mb-3 rounded-2xl border border-line bg-surface">
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-display text-sm font-bold uppercase tracking-wide text-ink-2">
          Takım değerlendirmesi
        </summary>
        <div className="space-y-4 border-t border-line p-3">
          <EvaluationChart title="Takım değerlendirmesi" rows={rows.filter((row) => row.kind === 'team')} />
          {adding ? (
            <EvaluationForm
              kind="team"
              skills={skills}
              busy={create.isPending}
              onCancel={() => setAdding(false)}
              onSubmit={(draft) => create.mutate({ kind: 'team', skills, draft }, { onSuccess: () => setAdding(false) })}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="min-h-11 w-full rounded-xl bg-accent-soft text-sm font-bold text-accent">
              Takım değerlendirmesi gir
            </button>
          )}
          {error && <p className="text-sm font-medium text-absent">{error}</p>}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Sporcu ortalaması</h3>
            <p className="text-xs text-ink-2">
              {latest.length === 0 ? 'Henüz sporcu değerlendirmesi yok.' : `${latest.length} sporcunun son değerlendirmesi`}
            </p>
            {latest.length > 0 && (
              <ul className="space-y-1.5">
                {skills.map((skill) => {
                  const value = averages[skill.key]
                  return (
                    <li key={skill.key} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm">
                      <span className="truncate">{skill.label}</span>
                      <div
                        role="meter"
                        aria-label={skill.label}
                        aria-valuemin={1}
                        aria-valuemax={10}
                        aria-valuenow={value}
                        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
                      >
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(value ?? 0) * 10}%` }} />
                      </div>
                      <span className="text-right font-bold tabular-nums">{value === undefined ? '—' : String(value).replace('.', ',')}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </details>
    </section>
  )
}
