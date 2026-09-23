import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ManageScreen } from './ManageScreen'
import { DataSourceProvider } from '../../app/dataSource'
import { createMockDataSource } from '../../adapters/mock/mockDataSource'
import type { DataSource } from '../../ports/repositories'

async function setup(withGroup = false) {
  const db: DataSource = createMockDataSource()
  const school = await db.schools.create({ name: 'Atatürk Ortaokulu' })
  const branch = await db.branches.create({ name: 'Voleybol', slug: 'voleybol' })
  if (withGroup) {
    await db.groups.create({
      name: 'Voleybol U12',
      schoolId: school.id,
      branchId: branch.id,
      schedule: [],
    })
  }

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DataSourceProvider value={db}>
        <ManageScreen />
      </DataSourceProvider>
    </QueryClientProvider>,
  )
  return { db }
}

describe('ManageScreen — grup takvimi', () => {
  afterEach(cleanup)

  it('gün seçilerek grup eklenir, takvim özeti listede görünür', async () => {
    const user = userEvent.setup({ delay: null })
    const { db } = await setup()

    await screen.findAllByText('Atatürk Ortaokulu')
    await user.type(screen.getByLabelText('Grup adı'), 'Voleybol U14')
    await user.selectOptions(screen.getByLabelText('Okul'), 'Atatürk Ortaokulu')
    await user.selectOptions(screen.getByLabelText('Branş'), 'Voleybol')
    await user.click(screen.getByRole('button', { name: 'Salı' }))
    await user.click(screen.getByRole('button', { name: 'Grup ekle' }))

    await screen.findByText('Salı 17:00')
    const saved = (await db.groups.list())[0]
    expect(saved.schedule).toEqual([{ weekday: 2, startTime: '17:00', durationMinutes: 90 }])
  })

  it('var olan grubun günleri listeden düzenlenir', async () => {
    const user = userEvent.setup({ delay: null })
    const { db } = await setup(true)

    const row = (await screen.findByText('Voleybol U12')).closest('li')
    if (!row) throw new Error('Grup satırı bulunamadı')
    expect(within(row).getByText('gün tanımlı değil')).toBeTruthy()

    await user.click(within(row).getByRole('button', { name: 'Günleri düzenle' }))
    await user.click(within(row).getByRole('button', { name: 'Cumartesi' }))
    await user.click(within(row).getByRole('button', { name: 'Kaydet' }))

    await screen.findByText('Cumartesi 17:00')
    expect((await db.groups.list())[0].schedule).toHaveLength(1)
  })
})
