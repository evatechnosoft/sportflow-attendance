import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AttendanceScreen } from './AttendanceScreen'
import { DataSourceProvider } from '../../app/dataSource'
import { createMockDataSource } from '../../adapters/mock/mockDataSource'
import type { DataSource } from '../../ports/repositories'

async function setup() {
  const db: DataSource = createMockDataSource()
  const school = await db.schools.create({ name: 'Atatürk Ortaokulu' })
  const branch = await db.branches.create({ name: 'Voleybol', slug: 'voleybol' })
  const group = await db.groups.create({
    name: 'U14 Kız',
    schoolId: school.id,
    branchId: branch.id,
    coachName: 'Elif Kaya',
    schedule: [],
  })
  await db.players.create({ firstName: 'Can', lastName: 'Erdoğan', groupId: group.id, status: 'active' })
  await db.players.create({ firstName: 'Ada', lastName: 'Yıldız', groupId: group.id, status: 'active' })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DataSourceProvider value={db}>
        <AttendanceScreen />
      </DataSourceProvider>
    </QueryClientProvider>,
  )
  return { db, group }
}

describe('AttendanceScreen', () => {
  it('grubun aktif oyuncularını listeler ve işaretlemeyi kaydeder', async () => {
    const user = userEvent.setup()
    const { db, group } = await setup()

    await screen.findByText('Can Erdoğan')
    await screen.findByText('Ada Yıldız')

    const [canRow, adaRow] = screen.getAllByRole('listitem')
    await user.click(within(canRow, 'Var'))
    await user.click(within(adaRow, 'Yok'))

    expect(screen.getByText('2/2 işaretlendi')).toBeTruthy()
    expect(screen.getByText('%50')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Yoklamayı kaydet' }))

    await waitFor(async () => {
      const session = (await db.sessions.listByGroup(group.id))[0]
      const rows = await db.attendance.listBySession(session.id)
      expect(rows).toHaveLength(2)
      expect(rows.find((row) => row.status === 'absent')).toBeTruthy()
    })
  })
})

function within(row: HTMLElement, label: string): HTMLElement {
  const button = Array.from(row.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === label,
  )
  if (!button) throw new Error(`"${label}" butonu bulunamadı`)
  return button
}
