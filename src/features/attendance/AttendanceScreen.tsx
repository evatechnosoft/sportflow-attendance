import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import type { AttendanceStatus } from '../../domain/types'
import { useGroupOptions } from './useGroupOptions'
import { AttendanceRow } from './AttendanceRow'
import { SessionHistory } from './SessionHistory'

const todayIso = () => new Date().toISOString().slice(0, 10)

export function AttendanceScreen() {
  const db = useDataSource()
  const queryClient = useQueryClient()
  const groups = useGroupOptions()

  const [groupId, setGroupId] = useState('')
  const [date, setDate] = useState(todayIso)
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})

  useEffect(() => {
    if (!groupId && groups.data?.length) setGroupId(groups.data[0].id)
  }, [groups.data, groupId])

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
    setMarks(Object.fromEntries(saved.data.map((row) => [row.playerId, row.status])))
  }, [saved.data])

  const history = useQuery({
    queryKey: ['history', groupId],
    enabled: Boolean(groupId),
    queryFn: () => db.attendance.historyByGroup(groupId),
  })

  const save = useMutation({
    mutationFn: () =>
      db.attendance.mark(
        session.data!.id,
        Object.entries(marks).map(([playerId, status]) => ({ playerId, status })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', session.data?.id] })
      queryClient.invalidateQueries({ queryKey: ['history', groupId] })
    },
  })

  const summary = useMemo(() => {
    const values = Object.values(marks)
    const present = values.filter((status) => status === 'present' || status === 'late').length
    const total = players.data?.length ?? 0
    return { marked: values.length, present, total, rate: total ? Math.round((present / total) * 100) : 0 }
  }, [marks, players.data])

  const selected = groups.data?.find((group) => group.id === groupId)
  const alreadySaved = (saved.data?.length ?? 0) > 0
  const failure = [groups.error, players.error, session.error, saved.error, save.error].find(
    Boolean,
  )

  return (
    <section className="space-y-4">
      {failure && (
        <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">
          {failure instanceof Error ? failure.message : 'Veri alınamadı'}
        </p>
      )}
      {groups.isLoading && (
        <p className="rounded-xl bg-white px-4 py-2 text-sm text-ink/50">Gruplar yükleniyor…</p>
      )}
      {!groups.isLoading && groups.data?.length === 0 && (
        <p className="rounded-xl bg-white px-4 py-2 text-sm text-ink/50">
          Görünür grup yok. Tanımlar sekmesinden grup ekleyebilirsin.
        </p>
      )}
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink/60">Grup</span>
          <select
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            disabled={!groups.data?.length}
            className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 disabled:opacity-50"
          >
            {!groups.data?.length && <option value="">Grup yok</option>}
            {groups.data?.map((group) => (
              <option key={group.id} value={group.id}>
                {group.schoolName} · {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink/60">Tarih</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2"
          />
        </label>
        {selected && (
          <p className="text-xs text-ink/50 sm:col-span-2">
            {selected.branchName}
            {alreadySaved && (
              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
                bu gün kayıtlı · düzeltebilirsin
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
        <div>
          <p className="font-display text-2xl font-semibold">%{summary.rate}</p>
          <p className="text-xs text-white/60">katılım</p>
        </div>
        <p className="text-sm text-white/80">
          {summary.marked}/{summary.total} işaretlendi
        </p>
      </div>

      <ul className="space-y-2">
        {players.data?.map((player) => (
          <AttendanceRow
            key={player.id}
            player={player}
            status={marks[player.id]}
            onChange={(status) => setMarks((prev) => ({ ...prev, [player.id]: status }))}
          />
        ))}
      </ul>

      {players.data?.length === 0 && (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-ink/50">
          Bu grupta aktif oyuncu yok.
        </p>
      )}

      <button
        type="button"
        disabled={!session.data || summary.marked === 0 || save.isPending}
        onClick={() => save.mutate()}
        className="w-full rounded-2xl bg-brand py-3 font-display font-semibold text-white shadow-sm transition disabled:opacity-40"
      >
        {save.isPending ? 'Kaydediliyor…' : alreadySaved ? 'Düzeltmeyi kaydet' : 'Yoklamayı kaydet'}
      </button>
      {save.isSuccess && <p className="text-center text-sm text-brand">Kaydedildi.</p>}

      <SessionHistory
        history={history.data ?? []}
        selectedDate={date}
        onPick={(picked) => setDate(picked)}
      />
    </section>
  )
}
