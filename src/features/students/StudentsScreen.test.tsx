import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StudentsScreen } from './StudentsScreen'
import { DataSourceProvider } from '../../app/dataSource'
import { SelectionProvider } from '../../app/selection'
import { createMockDataSource } from '../../adapters/mock/mockDataSource'
import type { DataSource } from '../../ports/repositories'

async function setup() {
  const db: DataSource = createMockDataSource()
  const school = await db.schools.create({ name: 'Atatürk Ortaokulu' })
  const branch = await db.branches.create({ name: 'Voleybol', slug: 'voleybol' })
  const group = await db.groups.create({
    name: 'Voleybol U12',
    schoolId: school.id,
    branchId: branch.id,
    schedule: [],
  })
  const other = await db.groups.create({
    name: 'Voleybol U14',
    schoolId: school.id,
    branchId: branch.id,
    schedule: [],
  })
  await db.players.create({
    firstName: 'Ada',
    lastName: 'Yıldız',
    birthDate: '2013-05-04',
    groupId: group.id,
    status: 'active',
    groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01' }],
  })
  await db.players.create({
    firstName: 'Can',
    lastName: 'Erdoğan',
    groupId: group.id,
    status: 'active',
    groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01' }],
  })
  await db.players.create({
    firstName: 'Deniz',
    lastName: 'Ak',
    groupId: group.id,
    status: 'inactive',
    groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-15' }],
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DataSourceProvider value={db}>
        <SelectionProvider>
          <StudentsScreen />
        </SelectionProvider>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
  return { db, group, other }
}

/** Satırın ⋯ menüsünü aç, içindeki eyleme bas. */
async function act(user: ReturnType<typeof userEvent.setup>, name: string, action: string) {
  await user.click(screen.getByRole('button', { name: `${name} işlemleri` }))
  const row = screen.getByRole('button', { name: `${name} işlemleri` }).closest('li')
  if (!row) throw new Error(`"${name}" satırı bulunamadı`)
  await user.click(within(row).getByRole('button', { name: action }))
}

describe('StudentsScreen', () => {
  afterEach(cleanup)

  it('grubun aktif sporcularını listeler, ayrılanları katlanır bölümde tutar', async () => {
    await setup()

    await screen.findByText('Ada Yıldız')
    expect(screen.getByText('Can Erdoğan')).toBeTruthy()

    const leftSection = screen.getByText(/Ayrılanlar \(1\)/).closest('details')
    if (!leftSection) throw new Error('Ayrılanlar bölümü yok')
    expect(within(leftSection).getByText('Deniz Ak')).toBeTruthy()
  })

  it('ad ve soyad ile yeni sporcu ekler, liste anında büyür', async () => {
    const user = userEvent.setup({ delay: null })
    const { db, group } = await setup()

    await screen.findByText('Ada Yıldız')
    await user.click(screen.getByRole('button', { name: /Sporcu ekle/ }))
    await user.type(screen.getByLabelText('Ad'), 'Mert')
    await user.type(screen.getByLabelText('Soyad'), 'Kaya')
    await user.click(screen.getByRole('button', { name: 'Ekle' }))

    await screen.findByText('Mert Kaya')
    const saved = await db.players.listByGroup(group.id)
    expect(saved).toHaveLength(3)
    expect(saved.find((row) => row.firstName === 'Mert')?.groupHistory).toHaveLength(1)
  })

  it('grup değiştirince sporcu listeden düşer', async () => {
    const user = userEvent.setup({ delay: null })
    const { db, group, other } = await setup()

    await screen.findByText('Ada Yıldız')
    await act(user, 'Ada Yıldız', 'Grubu değiştir')
    await user.click(screen.getByRole('button', { name: /Voleybol U14/ }))
    await user.click(screen.getByRole('button', { name: 'Taşı' }))

    await waitFor(() => expect(screen.queryByText('Ada Yıldız')).toBeNull())
    expect(await db.players.listByGroup(group.id)).toHaveLength(1)
    const moved = (await db.players.listByGroup(other.id))[0]
    expect(moved.groupHistory).toHaveLength(2)
    expect(moved.groupHistory.at(-1)?.leftOn).toBeUndefined()
  })

  it('ayrıldı işaretlenince sporcu Ayrılanlar bölümüne geçer', async () => {
    const user = userEvent.setup({ delay: null })
    const { db, group } = await setup()

    await screen.findByText('Ada Yıldız')
    await act(user, 'Ada Yıldız', 'Ayrıldı')
    await user.click(screen.getByRole('button', { name: 'Ayrıldı olarak işaretle' }))

    await screen.findByText(/Ayrılanlar \(2\)/)
    expect(await db.players.listByGroup(group.id)).toHaveLength(1)
    const left = (await db.players.listByGroup(group.id, { includeInactive: true })).find(
      (row) => row.firstName === 'Ada',
    )
    expect(left?.status).toBe('inactive')
    expect(left?.groupHistory.at(-1)?.leftOn).toBeTruthy()
  })
})
