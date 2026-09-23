import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { Sheet } from '../../app/Sheet'
import { DomainError } from '../../domain/errors'
import { DEFAULT_CLUB_SETTINGS, type Id, type ScheduleSlot } from '../../domain/types'
import { WEEKDAY_LABEL } from '../attendance/date'
import { joinParts } from '../attendance/useGroupOptions'
import { addSlot, hasSlotOn, removeSlot, scheduleLabel } from './schedule'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** Silme onayı bekleyen kayıt. */
interface PendingRemove {
  kind: 'school' | 'branch'
  id: Id
  name: string
}

const slugify = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function ManageScreen() {
  const db = useDataSource()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null)

  const schools = useQuery({ queryKey: ['schools'], queryFn: () => db.schools.list() })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => db.branches.list() })
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => db.groups.list() })
  const settings = useQuery({ queryKey: ['club-settings'], queryFn: () => db.settings.get() })
  const showSchool = (settings.data ?? DEFAULT_CLUB_SETTINGS).fields.school

  const refresh = () => {
    setError('')
    queryClient.invalidateQueries()
  }

  const fail = (cause: unknown) =>
    setError(cause instanceof DomainError ? cause.message : 'Beklenmeyen hata')

  const addSchool = useMutation({
    mutationFn: (name: string) => db.schools.create({ name }),
    onSuccess: refresh,
    onError: fail,
  })
  const addBranch = useMutation({
    mutationFn: (name: string) => db.branches.create({ name, slug: slugify(name) }),
    onSuccess: refresh,
    onError: fail,
  })
  const toggleSchool = useMutation({
    mutationFn: (school: boolean) => db.settings.update({ fields: { school } }),
    onSuccess: refresh,
    onError: fail,
  })
  // Hata onay sayfasında gösterilir; başarıda sayfa kapanır.
  const remove = useMutation({
    mutationFn: (target: PendingRemove) =>
      target.kind === 'school' ? db.schools.remove(target.id) : db.branches.remove(target.id),
    onSuccess: () => {
      refresh()
      setPendingRemove(null)
    },
  })
  const closeRemove = () => {
    setPendingRemove(null)
    remove.reset()
  }
  const addGroup = useMutation({
    mutationFn: (input: {
      name: string
      schoolId?: string
      branchId: string
      schedule: ScheduleSlot[]
    }) => db.groups.create(input),
    onSuccess: refresh,
    onError: fail,
  })
  const setSchedule = useMutation({
    mutationFn: (input: { id: Id; schedule: ScheduleSlot[] }) =>
      db.groups.update(input.id, { schedule: input.schedule }),
    onSuccess: refresh,
    onError: fail,
  })

  return (
    <section className="space-y-4">
      <div className="flex h-14 flex-col justify-center">
        <h2 className="font-display text-2xl font-bold tracking-tight">Tanımlar</h2>
        <p className="text-xs font-medium text-ink-2">Alanlar, branşlar ve grupların antrenman günleri</p>
      </div>

      {error && (
        <p className="rounded-xl bg-absent-soft px-4 py-2 text-sm text-absent">{error}</p>
      )}

      <Card title="Alanlar">
        <FieldSwitch
          label="Okul"
          hint="Kapalıyken okul hiçbir ekranda görünmez; kayıtlar silinmez."
          checked={showSchool}
          busy={toggleSchool.isPending}
          onChange={(value) => toggleSchool.mutate(value)}
        />
      </Card>

      {showSchool && (
        <Card title="Okullar" count={schools.data?.length}>
          <NameForm placeholder="Okul adı" onSubmit={(name) => addSchool.mutate(name)} />
          <Chips
            items={schools.data?.map((row) => ({ id: row.id, name: row.name, label: row.name })) ?? []}
            onRemove={(item) => setPendingRemove({ kind: 'school', ...item })}
          />
        </Card>
      )}

      <Card title="Branşlar" count={branches.data?.length}>
        <NameForm placeholder="Branş adı" onSubmit={(name) => addBranch.mutate(name)} />
        <Chips
          items={
            branches.data?.map((row) => ({
              id: row.id,
              name: row.name,
              label: `${row.name} (${row.slug})`,
            })) ?? []
          }
          onRemove={(item) => setPendingRemove({ kind: 'branch', ...item })}
        />
      </Card>

      <Card title="Gruplar" count={groups.data?.length}>
        <GroupForm
          showSchool={showSchool}
          schools={schools.data ?? []}
          branches={branches.data ?? []}
          onSubmit={(input) => addGroup.mutate(input)}
        />
        <ul className="mt-3 space-y-1 text-sm">
          {groups.data?.map((group) => {
            const school = schools.data?.find((row) => row.id === group.schoolId)
            const branch = branches.data?.find((row) => row.id === group.branchId)
            return (
              <li key={group.id} className="rounded-2xl border border-line bg-surface-2 px-3 py-2.5">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{group.name}</span>
                  <span className="min-w-0 truncate text-ink-2">
                    {joinParts(showSchool ? school?.name : undefined, branch?.name)}
                  </span>
                </div>
                <ScheduleRow
                  schedule={group.schedule}
                  busy={setSchedule.isPending}
                  onSave={(schedule) => setSchedule.mutate({ id: group.id, schedule })}
                />
              </li>
            )
          })}
        </ul>
      </Card>

      <Sheet open={pendingRemove !== null} onClose={closeRemove}>
        <p className="mb-1 font-display text-lg font-bold">{`${pendingRemove?.name ?? ''} silinsin mi?`}</p>
        <p className="mb-4 text-sm text-ink-2">
          {pendingRemove?.kind === 'school'
            ? 'Bu okulu kullanan gruplar okulsuz kalır.'
            : 'Grup kullanıyorsa branş silinmez.'}
        </p>
        {remove.error && (
          <p role="alert" className="mb-3 rounded-xl bg-absent-soft px-4 py-2 text-sm font-medium text-absent">
            {remove.error instanceof DomainError ? remove.error.message : 'Beklenmeyen hata'}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeRemove}
            className="min-h-11 flex-1 rounded-2xl bg-surface-2 text-sm font-medium text-ink-2"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => pendingRemove && remove.mutate(pendingRemove)}
            className="min-h-11 flex-1 rounded-2xl bg-absent text-sm font-bold text-bg disabled:opacity-40"
          >
            Sil
          </button>
        </div>
      </Sheet>
    </section>
  )
}

/** Erişilebilir aç/kapa anahtarı; tüm satır dokunma hedefidir. */
function FieldSwitch({
  label,
  hint,
  checked,
  busy,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  busy: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 text-left disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-ink-2">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm transition-[left] ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function Card({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden="true" className="h-5 w-1.5 rounded-full bg-accent" />
          {title}
        </h3>
        {count !== undefined && (
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2">
            {count} kayıt
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function NameForm({
  placeholder,
  onSubmit,
}: {
  placeholder: string
  onSubmit: (name: string) => void
}) {
  const [value, setValue] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    onSubmit(value.trim())
    setValue('')
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90">
        Ekle
      </button>
    </form>
  )
}

function GroupForm({
  showSchool,
  schools,
  branches,
  onSubmit,
}: {
  showSchool: boolean
  schools: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  onSubmit: (input: {
    name: string
    schoolId?: string
    branchId: string
    schedule: ScheduleSlot[]
  }) => void
}) {
  const [name, setName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !branchId) return
    onSubmit({
      name: name.trim(),
      schoolId: showSchool && schoolId ? schoolId : undefined,
      branchId,
      schedule,
    })
    setName('')
    setSchedule([])
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Grup adı"
        aria-label="Grup adı"
        className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm sm:col-span-2"
      />
      {showSchool && (
        <select
          value={schoolId}
          onChange={(event) => setSchoolId(event.target.value)}
          aria-label="Okul"
          className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
        >
          <option value="">Okul yok</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      )}
      <select
        value={branchId}
        onChange={(event) => setBranchId(event.target.value)}
        aria-label="Branş"
        className={`min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm ${
          showSchool ? '' : 'sm:col-span-2'
        }`}
      >
        <option value="">Branş seç</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <div className="sm:col-span-4">
        <SlotPicker schedule={schedule} onChange={setSchedule} />
      </div>
      <button
        type="submit"
        className="min-h-11 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 sm:col-span-4"
      >
        Grup ekle
      </button>
    </form>
  )
}

function Chips({
  items,
  onRemove,
}: {
  items: { id: Id; name: string; label: string }[]
  onRemove: (item: { id: Id; name: string }) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className="flex min-h-11 items-center rounded-full border border-line bg-surface-2 pl-3 text-xs font-medium text-ink"
        >
          {item.label}
          <button
            type="button"
            aria-label={`${item.name} sil`}
            onClick={() => onRemove({ id: item.id, name: item.name })}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-absent"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" aria-hidden="true" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  )
}

/** Gün düğmeleri + saat + süre. Gün açılınca o saatte slot açılır, kapanınca silinir. */
function SlotPicker({
  schedule,
  onChange,
}: {
  schedule: ScheduleSlot[]
  onChange: (schedule: ScheduleSlot[]) => void
}) {
  const [startTime, setStartTime] = useState('17:00')
  const [durationMinutes, setDurationMinutes] = useState(90)

  const toggle = (weekday: number) => {
    const exists = schedule.some(
      (slot) => slot.weekday === weekday && slot.startTime === startTime,
    )
    onChange(
      exists
        ? removeSlot(schedule, weekday, startTime)
        : addSlot(schedule, { weekday, startTime, durationMinutes }),
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map((weekday) => {
          const on = hasSlotOn(schedule, weekday)
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(weekday)}
              className={`min-h-11 flex-1 rounded-xl px-2 text-xs font-medium ${
                on ? 'bg-brand text-bg' : 'bg-surface-2 text-ink-2'
              }`}
            >
              {WEEKDAY_LABEL[weekday]}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="time"
          value={startTime}
          onChange={(event) => event.target.value && setStartTime(event.target.value)}
          aria-label="Başlangıç saati"
          className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={15}
          step={15}
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(Number(event.target.value) || 90)}
          aria-label="Süre (dakika)"
          className="min-h-11 w-28 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-ink-2">{scheduleLabel(schedule) || 'gün tanımlı değil'}</p>
    </div>
  )
}

/** Liste satırında takvim özeti; düzenleme aynı SlotPicker ile açılır. */
function ScheduleRow({
  schedule,
  busy,
  onSave,
}: {
  schedule: ScheduleSlot[]
  busy: boolean
  onSave: (schedule: ScheduleSlot[]) => void
}) {
  const [draft, setDraft] = useState<ScheduleSlot[] | null>(null)

  if (draft === null) {
    return (
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-2">{scheduleLabel(schedule) || 'gün tanımlı değil'}</span>
        <button
          type="button"
          onClick={() => setDraft(schedule)}
          className="min-h-11 shrink-0 font-semibold text-accent underline-offset-2 hover:underline"
        >
          Günleri düzenle
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <SlotPicker schedule={draft} onChange={setDraft} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="min-h-11 flex-1 rounded-xl bg-surface-2 text-sm font-medium text-ink-2"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onSave(draft)
            setDraft(null)
          }}
          className="min-h-11 flex-1 rounded-xl bg-brand text-sm font-medium text-bg disabled:opacity-40"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}
