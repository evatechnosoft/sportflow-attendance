import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { useSelection } from '../../app/selection'
import { Sheet } from '../../app/Sheet'
import { DomainError } from '../../domain/errors'
import type { Id, Player } from '../../domain/types'
import { GroupSheet } from '../attendance/GroupSheet'
import { joinParts, useGroupOptions } from '../attendance/useGroupOptions'
import { todayIso } from '../attendance/date'
import { avatarTone, initials } from '../attendance/avatar'
import { DuesBadge } from '../attendance/DuesBadge'
import { useOverdue } from '../attendance/useOverdue'
import {
  ageOn,
  changeGroup,
  isInGroup,
  joinGroup,
  leaveGroup,
  openSpells,
  startSpell,
} from './membership'

/** Onay bekleyen eylem: hedef grubuyla taşıma/ekleme, ya da bu gruptan çıkarma. */
type Pending =
  | { kind: 'move' | 'join'; player: Player; groupId: Id; groupLabel: string }
  | { kind: 'leave'; player: Player }

const fullName = (player: Player) => `${player.firstName} ${player.lastName}`

/** `readOnly`: coach view — list only; roster writes are memur+ (Firestore rules). */
export function StudentsScreen({ readOnly = false }: { readOnly?: boolean }) {
  const db = useDataSource()
  const queryClient = useQueryClient()
  const groups = useGroupOptions()
  const { groupId, setGroupId } = useSelection()

  const overdue = useOverdue(groupId)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [menuFor, setMenuFor] = useState<Id | null>(null)
  const [pickFor, setPickFor] = useState<{ player: Player; kind: 'move' | 'join' } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Header trigger anchors the picker on desktop; row actions open it centered.
  const [groupAnchor, setGroupAnchor] = useState<HTMLElement | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    if (!groupId && groups.data?.length) setGroupId(groups.data[0].id)
  }, [groups.data, groupId, setGroupId])

  // Tek sorgu: aktif/pasif ayrımı bellekte yapılır.
  const players = useQuery({
    queryKey: ['players', groupId, 'all'],
    enabled: Boolean(groupId),
    queryFn: () => db.players.listByGroup(groupId, { includeInactive: true }),
  })

  // Ekran grup bağlamında çalışır: bu grupta açık dönemi olan üye, kapalısı ayrılmış.
  const { active, left } = useMemo(() => {
    const rows = players.data ?? []
    return {
      active: rows.filter((row) => isInGroup(row, groupId)),
      left: rows.filter((row) => !isInGroup(row, groupId)),
    }
  }, [players.data, groupId])

  const refresh = () => {
    setError('')
    queryClient.invalidateQueries({ queryKey: ['players'] })
  }

  const fail = (cause: unknown) =>
    setError(cause instanceof DomainError ? cause.message : 'Beklenmeyen hata')

  const add = useMutation({
    mutationFn: (input: { firstName: string; lastName: string; birthDate?: string }) =>
      db.players.create({
        ...input,
        status: 'active',
        groupHistory: startSpell(groupId, todayIso()),
      }),
    onSuccess: () => {
      refresh()
      setAdding(false)
    },
    onError: fail,
  })

  // Dönem mantığı membership.ts'te kalır; burada yalnız değişen alanlar taşınır.
  const patch = useMutation({
    mutationFn: (next: Player) =>
      db.players.update(next.id, {
        status: next.status,
        groupHistory: next.groupHistory,
      }),
    onSuccess: () => {
      refresh()
      setPending(null)
      setMenuFor(null)
    },
    onError: fail,
  })

  const selected = groups.data?.find((group) => group.id === groupId)

  const confirm = () => {
    if (!pending) return
    const on = todayIso()
    if (pending.kind === 'move') {
      patch.mutate(changeGroup(pending.player, groupId, pending.groupId, on))
    } else if (pending.kind === 'join') {
      patch.mutate(joinGroup(pending.player, pending.groupId, on))
    } else {
      patch.mutate(leaveGroup(pending.player, groupId, on))
    }
  }

  const startPick = (player: Player, kind: 'move' | 'join') => {
    setPickFor({ player, kind })
    setGroupAnchor(null)
    setSheetOpen(true)
  }

  return (
    <section>
      {/* Başlık: listelenen grubu değiştirir — Yoklama ekranıyla aynı seçici. */}
      <button
        type="button"
        onClick={(event) => {
          setPickFor(null)
          setGroupAnchor(event.currentTarget)
          setSheetOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen && pickFor === null}
        disabled={!groups.data?.length}
        className="flex h-14 w-full items-center justify-between gap-3 text-left disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-2xl font-bold tracking-tight">
            {selected?.label ?? 'Grup seç'}
          </span>
          {selected && (
            <span className="block truncate text-xs font-medium text-ink-2">
              {joinParts(selected.schoolName, selected.branchName)}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
          {active.length} aktif
          <span aria-hidden="true">▾</span>
        </span>
      </button>

      {error && (
        <p className="mb-3 rounded-xl bg-absent-soft px-4 py-2 text-sm text-absent">{error}</p>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={() => setAdding((prev) => !prev)}
          disabled={!groupId}
          className="mb-3 mt-2 min-h-11 w-full rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft px-4 text-sm font-bold text-accent disabled:opacity-50"
        >
          + Sporcu ekle
        </button>
      )}

      {adding && !readOnly && <AddForm onSubmit={(input) => add.mutate(input)} onInvalid={setError} />}

      <ul className="space-y-2">
        {active.map((player) => (
          <StudentRow
            key={player.id}
            player={player}
            overdue={overdue.has(player.id)}
            readOnly={readOnly}
            open={menuFor === player.id}
            onToggle={() => setMenuFor((prev) => (prev === player.id ? null : player.id))}
            onMove={() => startPick(player, 'move')}
            onJoin={() => startPick(player, 'join')}
            onLeave={() => setPending({ kind: 'leave', player })}
          />
        ))}
      </ul>

      {players.data?.length === 0 && (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-2">
          Bu grupta sporcu yok.
        </p>
      )}

      {left.length > 0 && (
        <details className="mt-4 rounded-[20px] border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Ayrılanlar ({left.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {left.map((player) => (
              <li
                key={player.id}
                className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-surface-2 px-4"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink-2">
                  {fullName(player)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    disabled={patch.isPending}
                    onClick={() => patch.mutate(joinGroup(player, groupId, todayIso()))}
                    className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-medium text-bg disabled:opacity-40"
                  >
                    Geri al
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <GroupSheet
        open={sheetOpen}
        anchor={groupAnchor}
        groups={groups.data ?? []}
        groupId={groupId}
        onSelect={(id) => {
          const target = groups.data?.find((group) => group.id === id)
          if (pickFor && target) {
            setPending({
              kind: pickFor.kind,
              player: pickFor.player,
              groupId: id,
              groupLabel: target.label,
            })
          } else {
            setGroupId(id)
          }
        }}
        onClose={() => {
          setSheetOpen(false)
          setPickFor(null)
        }}
      />

      <ConfirmSheet
        pending={pending}
        busy={patch.isPending}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </section>
  )
}

function StudentRow({
  player,
  open,
  onToggle,
  onMove,
  onJoin,
  onLeave,
  overdue,
  readOnly,
}: {
  player: Player
  overdue: boolean
  readOnly: boolean
  open: boolean
  onToggle: () => void
  onMove: () => void
  onJoin: () => void
  onLeave: () => void
}) {
  const age = ageOn(player.birthDate, todayIso())
  const groupCount = openSpells(player).length
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex min-h-[72px] items-center gap-3 pl-3 pr-2">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${avatarTone(fullName(player))}`}
        >
          {initials(player)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">
              {fullName(player)}
              {groupCount > 1 && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                  {`${groupCount} grup`}
                </span>
              )}
            </span>
            {overdue && <DuesBadge />}
          </span>
          {player.birthDate && (
            <span className="block text-xs text-ink-2">
              {player.birthDate.slice(0, 4)}
              {age !== null && ` · ${age} yaş`}
            </span>
          )}
        </span>
        {!readOnly && (
          <button
            type="button"
            aria-label={`${fullName(player)} işlemleri`}
            aria-expanded={open}
            onClick={onToggle}
            className="h-11 w-11 shrink-0 rounded-full text-lg font-bold text-ink-2 hover:bg-surface-2"
          >
            ⋯
          </button>
        )}
      </div>
      {open && !readOnly && (
        <div className="flex flex-wrap gap-1 border-t border-line p-1">
          <button
            type="button"
            onClick={onMove}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 px-2 text-xs font-medium text-ink-2"
          >
            Grubu değiştir
          </button>
          <button
            type="button"
            onClick={onJoin}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 px-2 text-xs font-medium text-ink-2"
          >
            Başka gruba ekle
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-11 flex-1 rounded-xl bg-absent-soft px-2 text-xs font-medium text-absent"
          >
            Gruptan çıkar
          </button>
        </div>
      )}
    </li>
  )
}

function AddForm({
  onSubmit,
  onInvalid,
}: {
  onSubmit: (input: { firstName: string; lastName: string; birthDate?: string }) => void
  onInvalid: (message: string) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    // Doğum tarihi opsiyonel ama gelecekte olamaz.
    if (birthDate && birthDate > todayIso()) {
      onInvalid('Doğum tarihi gelecekte olamaz.')
      return
    }
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate || undefined,
    })
    setFirstName('')
    setLastName('')
    setBirthDate('')
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 grid gap-2 rounded-[20px] border border-line bg-surface p-4 sm:grid-cols-3"
    >
      <input
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        placeholder="Ad"
        aria-label="Ad"
        className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <input
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        placeholder="Soyad"
        aria-label="Soyad"
        className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <input
        type="date"
        max={todayIso()}
        value={birthDate}
        onChange={(event) => setBirthDate(event.target.value)}
        aria-label="Doğum tarihi"
        className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="min-h-11 rounded-xl bg-brand px-4 text-sm font-medium text-bg sm:col-span-3"
      >
        Ekle
      </button>
    </form>
  )
}

function ConfirmSheet({
  pending,
  busy,
  onConfirm,
  onClose,
}: {
  pending: Pending | null
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const question =
    pending === null
      ? ''
      : pending.kind === 'move'
        ? `${fullName(pending.player)} → ${pending.groupLabel} grubuna taşınsın mı?`
        : pending.kind === 'join'
          ? `${fullName(pending.player)} ${pending.groupLabel} grubuna da eklensin mi? Mevcut grupları durur.`
          : `${fullName(pending.player)} bu gruptan çıkarılsın mı? Geçmiş yoklamalarda görünmeye devam eder.`
  const action =
    pending?.kind === 'move' ? 'Taşı' : pending?.kind === 'join' ? 'Ekle' : 'Çıkar'

  return (
    <Sheet open={pending !== null} onClose={onClose}>
      <p className="mb-4 text-sm">{question}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-2xl bg-surface-2 text-sm font-medium text-ink-2"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="min-h-11 flex-1 rounded-2xl bg-brand text-sm font-medium text-bg disabled:opacity-40"
        >
          {action}
        </button>
      </div>
    </Sheet>
  )
}
