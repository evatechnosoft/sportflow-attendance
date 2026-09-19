import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { DomainError } from '../../domain/errors'

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

  const schools = useQuery({ queryKey: ['schools'], queryFn: () => db.schools.list() })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => db.branches.list() })
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => db.groups.list() })

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
  const addGroup = useMutation({
    mutationFn: (input: { name: string; schoolId: string; branchId: string }) =>
      db.groups.create({ ...input, schedule: [] }),
    onSuccess: refresh,
    onError: fail,
  })

  return (
    <section className="space-y-4">
      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      <Card title="Okullar" count={schools.data?.length}>
        <NameForm placeholder="Okul adı" onSubmit={(name) => addSchool.mutate(name)} />
        <Chips items={schools.data?.map((row) => row.name) ?? []} />
      </Card>

      <Card title="Branşlar" count={branches.data?.length}>
        <NameForm placeholder="Branş adı" onSubmit={(name) => addBranch.mutate(name)} />
        <Chips items={branches.data?.map((row) => `${row.name} (${row.slug})`) ?? []} />
      </Card>

      <Card title="Gruplar" count={groups.data?.length}>
        <GroupForm
          schools={schools.data ?? []}
          branches={branches.data ?? []}
          onSubmit={(input) => addGroup.mutate(input)}
        />
        <ul className="mt-3 space-y-1 text-sm">
          {groups.data?.map((group) => {
            const school = schools.data?.find((row) => row.id === group.schoolId)
            const branch = branches.data?.find((row) => row.id === group.branchId)
            return (
              <li key={group.id} className="flex justify-between rounded-lg bg-surface px-3 py-2">
                <span className="font-medium">{group.name}</span>
                <span className="text-ink/50">
                  {school?.name ?? '—'} · {branch?.name ?? '—'}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
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
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display font-semibold">{title}</h2>
        <span className="text-xs text-ink/40">{count ?? 0} kayıt</span>
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
        className="flex-1 rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
        Ekle
      </button>
    </form>
  )
}

function GroupForm({
  schools,
  branches,
  onSubmit,
}: {
  schools: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  onSubmit: (input: { name: string; schoolId: string; branchId: string }) => void
}) {
  const [name, setName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [branchId, setBranchId] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !schoolId || !branchId) return
    onSubmit({ name: name.trim(), schoolId, branchId })
    setName('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Grup adı"
        aria-label="Grup adı"
        className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm sm:col-span-2"
      />
      <select
        value={schoolId}
        onChange={(event) => setSchoolId(event.target.value)}
        aria-label="Okul"
        className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm"
      >
        <option value="">Okul seç</option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
      <select
        value={branchId}
        onChange={(event) => setBranchId(event.target.value)}
        aria-label="Branş"
        className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm"
      >
        <option value="">Branş seç</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white sm:col-span-4"
      >
        Grup ekle
      </button>
    </form>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-surface px-3 py-1 text-xs text-ink/70">
          {item}
        </span>
      ))}
    </div>
  )
}
