import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { useSelection } from '../../app/selection'
import type { AttendanceStatus } from '../../domain/types'
import { useGroupOptions } from './useGroupOptions'
import { AttendanceRow } from './AttendanceRow'
import { GroupSheet } from './GroupSheet'
import { dayLabel, shiftDay } from './date'
import { isDirty, marksFromRows, STATUSES, STATUS_LABEL, summarize, type Marks } from './summary'

const SEGMENT: Record<AttendanceStatus, string> = {
  present: 'bg-present',
  late: 'bg-late',
  excused: 'bg-excused',
  absent: 'bg-absent',
}

interface Toast {
  text: string
  /** Geri-al toast'ında önceki işaret durumu; kaydet toast'ında yok. */
  undo?: () => void
}

export function AttendanceScreen() {
  const db = useDataSource()
  const queryClient = useQueryClient()
  const groups = useGroupOptions()
  const { groupId, date, setGroupId, setDate } = useSelection()

  const [marks, setMarks] = useState<Marks>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!groupId && groups.data?.length) setGroupId(groups.data[0].id)
  }, [groups.data, groupId, setGroupId])

  const session = useQuery({
    queryKey: ['session', groupId, date],
    enabled: Boolean(groupId),
    queryFn: () => db.sessions.ensure(groupId, date),
  })

  const players = useQuery({
    queryKey: ['players', groupId],
    enabled: Boolean(groupId),
    queryFn: () => db.players.listByGroup(groupId),
  })

  const saved = useQuery({
    queryKey: ['attendance', session.data?.id],
    enabled: Boolean(session.data),
    queryFn: () => db.attendance.listBySession(session.data!.id),
  })

  // Kaydedilmiş yoklama tabloya geri yüklenir (US-1).
  useEffect(() => {
    if (!saved.data) return
    setMarks(marksFromRows(saved.data))
  }, [saved.data])

  const save = useMutation({
    mutationFn: () =>
      db.attendance.mark(
        session.data!.id,
        Object.entries(marks).map(([playerId, status]) => ({ playerId, status })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', session.data?.id] })
      setToast({ text: 'Kaydedildi' })
    },
  })

  // Tek toast; yenisi eskisini ezer, süre dolunca söner.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.undo ? 4000 : 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const summary = useMemo(
    () => summarize(marks, players.data?.length ?? 0),
    [marks, players.data],
  )

  const selected = groups.data?.find((group) => group.id === groupId)
  const savedMarks = useMemo(() => marksFromRows(saved.data ?? []), [saved.data])
  const alreadySaved = (saved.data?.length ?? 0) > 0
  const dirty = isDirty(marks, savedMarks)
  const failure = [groups.error, players.error, session.error, saved.error, save.error].find(Boolean)
  if (failure) console.error('AttendanceScreen', failure)

  const handleChange = (playerId: string, name: string, status: AttendanceStatus) => {
    const previous = marks[playerId]
    setMarks((prev) => ({ ...prev, [playerId]: status }))
    setToast({
      text: `${name} → ${STATUS_LABEL[status]}`,
      undo: () =>
        setMarks((prev) => {
          if (!previous) {
            const { [playerId]: _dropped, ...rest } = prev
            return rest
          }
          return { ...prev, [playerId]: previous }
        }),
    })
  }

  return (
    <section>
      {/* 1. Başlık: grup seçici */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={!groups.data?.length}
        className="flex h-14 w-full items-center justify-between gap-3 text-left disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-semibold">
            {selected?.label ?? 'Grup seç'}
          </span>
          {selected && (
            <span className="block truncate text-xs text-ink-2">
              {selected.schoolName} · {selected.branchName}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="shrink-0 text-ink-2">
          ▾
        </span>
      </button>

      <GroupSheet
        open={sheetOpen}
        groups={groups.data ?? []}
        groupId={groupId}
        onSelect={setGroupId}
        onClose={() => setSheetOpen(false)}
      />

      {/* 2. Tarih */}
      <div className="flex items-center gap-2 border-y border-line py-2">
        <button
          type="button"
          aria-label="Önceki gün"
          onClick={() => setDate(shiftDay(date, -1))}
          className="h-11 w-11 shrink-0 rounded-full text-ink-2"
        >
          ◀
        </button>
        <label className="flex min-w-0 flex-1 flex-col items-center">
          <span className="font-display text-sm font-semibold">{dayLabel(date)}</span>
          <input
            type="date"
            aria-label="Tarih"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="bg-transparent text-sm text-ink-2"
          />
        </label>
        <button
          type="button"
          aria-label="Sonraki gün"
          onClick={() => setDate(shiftDay(date, 1))}
          className="h-11 w-11 shrink-0 rounded-full text-ink-2"
        >
          ▶
        </button>
        {alreadySaved && (
          <span className="shrink-0 rounded-full bg-present-soft px-2 py-1 text-xs font-medium text-present">
            ● kayıtlı
          </span>
        )}
      </div>

      {/* 3. Yığılmış ilerleme */}
      <div className="py-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
          {STATUSES.map((status) => (
            <span
              key={status}
              className={SEGMENT[status]}
              style={{
                width: summary.total ? `${(summary.counts[status] / summary.total) * 100}%` : '0%',
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-ink-2">
          {summary.marked === 0 ? (
            <span>henüz işaretlenmedi</span>
          ) : (
            <span className="truncate">
              {STATUSES.filter((status) => summary.counts[status] > 0)
                .map((status) => `${summary.counts[status]} ${STATUS_LABEL[status].toLocaleLowerCase('tr-TR')}`)
                .join(' · ')}
            </span>
          )}
          <span className="shrink-0 font-medium text-ink">
            {summary.marked}/{summary.total}
            {summary.rate !== null && ` · %${summary.rate}`}
          </span>
        </div>
      </div>

      {/* 4-5. Liste ve boş/hata durumları */}
      {failure && (
        <p className="rounded-2xl bg-absent-soft px-4 py-3 text-sm text-absent">
          Veri alınamadı, bağlantını kontrol et.
        </p>
      )}
      {!groups.isLoading && groups.data?.length === 0 && (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-2">
          Görünür grup yok. Tanımlar sekmesinden grup ekleyebilirsin.
        </p>
      )}

      <ul className="space-y-2 pb-40">
        {players.data?.map((player) => (
          <AttendanceRow
            key={player.id}
            player={player}
            status={marks[player.id]}
            onChange={(status) =>
              handleChange(player.id, `${player.firstName} ${player.lastName}`, status)
            }
          />
        ))}
      </ul>

      {players.data?.length === 0 && (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-2">
          Bu grupta aktif oyuncu yok.
        </p>
      )}

      {/* 6. Sticky kaydet */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-3xl px-4">
          <div className="rounded-[20px] border border-line bg-surface/90 p-2 backdrop-blur">
            <button
              type="button"
              disabled={!session.data || save.isPending}
              onClick={() => save.mutate()}
              className="h-[52px] w-full rounded-2xl bg-brand font-display font-semibold text-bg disabled:opacity-40"
            >
              {save.isPending
                ? 'Kaydediliyor…'
                : `${alreadySaved ? 'Düzeltmeyi kaydet' : 'Kaydet'} · ${summary.marked} işaret`}
            </button>
          </div>
        </div>
      )}

      {/* 7-8. Tek toast yeri */}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(128px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-present px-4 py-2 text-sm font-medium text-bg">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.()
                  setToast(null)
                }}
                className="underline"
              >
                Geri al
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
