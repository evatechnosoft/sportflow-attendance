import { useEffect, useMemo, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { useSelection } from '../../app/selection'
import type { AttendanceStatus } from '../../domain/types'
import { joinParts, useGroupOptions } from './useGroupOptions'
import { AttendanceRow } from './AttendanceRow'
import { useOverdue } from './useOverdue'
import { GroupSheet } from './GroupSheet'
import { dayLabel, shiftDay, shortDate, todayIso, weekdayOf, WEEKDAY_LABEL } from './date'
import { hasSlotOn } from '../manage/schedule'
import { Sheet } from '../../app/Sheet'
import type { ScheduleSlot } from '../../domain/types'
import { isDirty, marksFromRows, STATUSES, STATUS_LABEL, summarize, type Marks } from './summary'

const SEGMENT: Record<AttendanceStatus, string> = {
  present: 'bg-present',
  late: 'bg-late',
  excused: 'bg-excused',
  absent: 'bg-absent',
}

const CHIP: Record<AttendanceStatus, string> = {
  present: 'bg-present-soft text-present',
  late: 'bg-late-soft text-late',
  excused: 'bg-excused-soft text-excused',
  absent: 'bg-absent-soft text-absent',
}

function Chevron({ turn = '' }: { turn?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`h-5 w-5 ${turn}`}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
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

  const overdue = useOverdue(groupId)
  const [marks, setMarks] = useState<Marks>({})
  const [groupAnchor, setGroupAnchor] = useState<HTMLElement | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [timeAnchor, setTimeAnchor] = useState<HTMLElement | null>(null)
  const dateInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!groupId && groups.data?.length) setGroupId(groups.data[0].id)
  }, [groups.data, groupId, setGroupId])

  const session = useQuery({
    queryKey: ['session', groupId, date],
    enabled: Boolean(groupId),
    queryFn: () => db.sessions.ensure(groupId, date, slotOfDay?.startTime),
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

  const setTime = useMutation({
    mutationFn: async ({ startTime, forever }: { startTime: string; forever: boolean }) => {
      await db.sessions.update(session.data!.id, { startTime })
      if (forever && slotOfDay) {
        const schedule: ScheduleSlot[] = selected!.schedule.map((slot) =>
          slot === slotOfDay ? { ...slot, startTime } : slot,
        )
        await db.groups.update(groupId, { schedule })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', groupId, date] })
      queryClient.invalidateQueries({ queryKey: ['group-options'] })
      setTimeAnchor(null)
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
  const slotOfDay = selected?.schedule.find((slot) => slot.weekday === weekdayOf(date))
  // Kural 4-5: takvimi tanımlı grupta, o güne slot yoksa uyar — kaydetmeyi engelleme.
  const offDay =
    selected && selected.schedule.length > 0 && !hasSlotOn(selected.schedule, weekdayOf(date))
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
        onClick={(event) => setGroupAnchor(event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={groupAnchor !== null}
        disabled={!groups.data?.length}
        className="flex h-14 w-full items-center justify-between gap-3 text-left disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-2xl font-bold tracking-tight">
            {selected?.label ?? 'Grup seç'}
          </span>
          {selected && (
            <span className="block truncate text-xs font-medium text-ink-2">
              {joinParts(selected.schoolName, selected.branchName, selected.scheduleText)}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"
        >
          <Chevron turn="-rotate-90" />
        </span>
      </button>

      <GroupSheet
        open={groupAnchor !== null}
        anchor={groupAnchor}
        groups={groups.data ?? []}
        groupId={groupId}
        onSelect={setGroupId}
        onClose={() => setGroupAnchor(null)}
      />

      {/* 2. Tarih */}
      <div className="mt-2 flex items-center gap-1 rounded-[20px] border border-line bg-surface p-1">
        <button
          type="button"
          aria-label="Önceki gün"
          onClick={() => setDate(shiftDay(date, -1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-ink-2 hover:bg-surface-2"
        >
          <Chevron />
        </button>
        <button
          type="button"
          onClick={() => dateInput.current?.showPicker?.()}
          className="flex min-w-0 flex-1 flex-col items-center leading-tight"
        >
          <span className="font-display text-base font-semibold">{dayLabel(date)}</span>
          <span className="text-xs text-ink-2">{shortDate(date)}</span>
        </button>
        <input
          ref={dateInput}
          type="date"
          aria-label="Tarih"
          value={date}
          max={todayIso()}
          onChange={(event) => event.target.value && setDate(event.target.value)}
          className="sr-only"
        />
        <button
          type="button"
          aria-label="Sonraki gün"
          disabled={date >= todayIso()}
          onClick={() => setDate(shiftDay(date, 1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-ink-2 hover:bg-surface-2 disabled:opacity-30"
        >
          <Chevron turn="rotate-180" />
        </button>
        {session.data && (
          <button
            type="button"
            onClick={(event) => setTimeAnchor(event.currentTarget)}
            aria-haspopup="dialog"
            aria-expanded={timeAnchor !== null}
            className="min-h-11 shrink-0 rounded-2xl bg-surface-2 px-3 text-xs font-semibold text-ink-2"
          >
            {`Saat: ${session.data.startTime ?? '—'}`}
          </button>
        )}
        {alreadySaved && (
          <span className="shrink-0 rounded-full bg-present-soft px-2 py-1 text-xs font-semibold text-present">
            ● kayıtlı
          </span>
        )}
      </div>

      {/* 3. Yığılmış ilerleme + durum çipleri */}
      <div className="py-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">Yoklama</span>
          <span className="font-display text-sm font-bold tabular-nums text-ink">
            {summary.marked}/{summary.total} işaretli
            {summary.rate !== null && ` · %${summary.rate} katılım`}
          </span>
        </div>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2">
          {STATUSES.map((status) => (
            <span
              key={status}
              className={`${SEGMENT[status]} transition-[width] duration-300`}
              style={{
                width: summary.total ? `${(summary.counts[status] / summary.total) * 100}%` : '0%',
              }}
            />
          ))}
        </div>
        {summary.marked === 0 ? (
          <p className="mt-2 text-xs text-ink-2">henüz işaretlenmedi</p>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {STATUSES.map((status) => (
              <span
                key={status}
                className={`flex items-baseline justify-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold ${CHIP[status]} ${
                  summary.counts[status] === 0 ? 'opacity-50' : ''
                }`}
              >
                <span className="font-display text-base font-bold tabular-nums">
                  {summary.counts[status]}
                </span>
                {STATUS_LABEL[status]}
              </span>
            ))}
          </div>
        )}
      </div>

      {offDay && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border-l-4 border-late bg-late-soft px-3 py-2 text-sm font-medium text-late">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {`Bu grubun ${WEEKDAY_LABEL[weekdayOf(date)]} antrenmanı yok`}
        </p>
      )}

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
            overdue={overdue.has(player.id)}
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
              className="h-[52px] w-full rounded-2xl bg-accent font-display font-bold tracking-wide text-bg shadow-sm disabled:opacity-40"
            >
              {save.isPending
                ? 'Kaydediliyor…'
                : `${alreadySaved ? 'Düzeltmeyi kaydet' : 'Kaydet'} · ${summary.marked} işaret`}
            </button>
          </div>
        </div>
      )}

      <TimeSheet
        open={timeAnchor !== null}
        anchor={timeAnchor}
        startTime={session.data?.startTime ?? ''}
        canRepeat={Boolean(slotOfDay)}
        busy={setTime.isPending}
        onSubmit={(startTime, forever) => setTime.mutate({ startTime, forever })}
        onClose={() => setTimeAnchor(null)}
      />

      {/* 7-8. Tek toast yeri */}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(148px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl justify-center px-4">
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

/** Oturum saati: yalnız bu oturum, ya da grubun o günkü slotu da. */
function TimeSheet({
  open,
  startTime,
  canRepeat,
  busy,
  onSubmit,
  onClose,
  anchor,
}: {
  open: boolean
  anchor: HTMLElement | null
  startTime: string
  canRepeat: boolean
  busy: boolean
  onSubmit: (startTime: string, forever: boolean) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(startTime)

  useEffect(() => {
    if (open) setValue(startTime)
  }, [open, startTime])

  return (
    <Sheet open={open} onClose={onClose} anchor={anchor}>
      <p className="mb-3 font-display text-lg font-semibold">Oturum saati</p>
      <input
        type="time"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Oturum saati"
        className="mb-3 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy || !value}
          onClick={() => onSubmit(value, false)}
          className="min-h-[52px] w-full rounded-2xl bg-brand font-medium text-bg disabled:opacity-40"
        >
          Yalnız bu oturum
        </button>
        {canRepeat && (
          <button
            type="button"
            disabled={busy || !value}
            onClick={() => onSubmit(value, true)}
            className="min-h-[52px] w-full rounded-2xl bg-surface-2 font-medium text-ink disabled:opacity-40"
          >
            Bundan sonra hep
          </button>
        )}
      </div>
    </Sheet>
  )
}
