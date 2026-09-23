import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AttendanceScreen } from './AttendanceScreen'
import { DataSourceProvider } from '../../app/dataSource'
import { SelectionProvider } from '../../app/selection'
import { createMockDataSource } from '../../adapters/mock/mockDataSource'
import type { DataSource } from '../../ports/repositories'
import type { ScheduleSlot } from '../../domain/types'
import { todayIso, weekdayOf, WEEKDAY_LABEL } from './date'

/** Bugünün dışındaki bir ISO gün — takvimi olan ama bugün toplanmayan grup için. */
const otherWeekday = () => (weekdayOf(todayIso()) % 7) + 1

async function setup(schedule: ScheduleSlot[] = []) {
  const db: DataSource = createMockDataSource()
  const school = await db.schools.create({ name: 'Atatürk Ortaokulu' })
  const branch = await db.branches.create({ name: 'Voleybol', slug: 'voleybol' })
  const group = await db.groups.create({
    name: 'U14 Kız',
    schoolId: school.id,
    branchId: branch.id,
    coachName: 'Elif Kaya',
    schedule,
  })
  const spell = [{ groupId: group.id, joinedOn: '2026-09-01' }]
  await db.players.create({
    firstName: 'Can',
    lastName: 'Erdoğan',
    status: 'active',
    groupHistory: spell,
  })
  await db.players.create({
    firstName: 'Ada',
    lastName: 'Yıldız',
    status: 'active',
    groupHistory: spell,
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DataSourceProvider value={db}>
        <SelectionProvider>
          <AttendanceScreen />
        </SelectionProvider>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
  return { db, group }
}

/** Satırı aç, içindeki durum butonuna bas. */
async function mark(user: ReturnType<typeof userEvent.setup>, name: string, label: string) {
  await user.click(screen.getByRole('button', { name }))
  const row = screen.getByRole('button', { name }).closest('li')
  if (!row) throw new Error(`"${name}" satırı bulunamadı`)
  await user.click(within(row).getByRole('button', { name: label }))
}

describe('AttendanceScreen', () => {
  afterEach(cleanup)

  it('grubun aktif oyuncularını listeler ve işaretlemeyi kaydeder', async () => {
    const user = userEvent.setup({ delay: null })
    const { db, group } = await setup()

    await screen.findByText('Can Erdoğan')
    await screen.findByText('Ada Yıldız')

    await mark(user, 'Can Erdoğan', 'Var')
    await mark(user, 'Ada Yıldız', 'Yok')

    expect(screen.getByText(/2\/2/)).toBeTruthy()
    expect(screen.getByText(/%50/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Kaydet/ }))

    await waitFor(async () => {
      const session = (await db.sessions.listByGroup(group.id))[0]
      const rows = await db.attendance.listBySession(session.id)
      expect(rows).toHaveLength(2)
      expect(rows.find((row) => row.status === 'absent')).toBeTruthy()
    })
  })

  it('işaret yokken "henüz işaretlenmedi" gösterir, kaydet çubuğu görünmez', async () => {
    await setup()

    await screen.findByText('Can Erdoğan')
    expect(screen.getByText('henüz işaretlenmedi')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Kaydet/ })).toBeNull()
  })

  it('antrenman günü olmayan tarihte uyarı çıkar, kaydetme engellenmez', async () => {
    const user = userEvent.setup({ delay: null })
    const day = otherWeekday()
    await setup([{ weekday: day, startTime: '17:00', durationMinutes: 90 }])

    await screen.findByText(`Bu grubun ${WEEKDAY_LABEL[weekdayOf(todayIso())]} antrenmanı yok`)
    await screen.findByText('Can Erdoğan')
    // Takvim özeti başlıkta ve grup seçicide görünür.
    expect(screen.getAllByText(new RegExp(`${WEEKDAY_LABEL[day]} 17:00`)).length).toBeGreaterThan(0)

    await mark(user, 'Can Erdoğan', 'Var')
    expect(screen.getByRole('button', { name: /Kaydet/ })).toBeTruthy()
  })

  it('takvimi tanımlı olmayan grupta uyarı çıkmaz', async () => {
    await setup()

    await screen.findByText('Can Erdoğan')
    expect(screen.queryByText(/antrenmanı yok/)).toBeNull()
  })

  it('saat yalnız bu oturum için değiştirilir, grubun takvimi durur', async () => {
    const user = userEvent.setup({ delay: null })
    const today = weekdayOf(todayIso())
    const { db, group } = await setup([{ weekday: today, startTime: '17:00', durationMinutes: 90 }])

    await screen.findByRole('button', { name: 'Saat: 17:00' })
    await user.click(screen.getByRole('button', { name: 'Saat: 17:00' }))
    await user.clear(screen.getByLabelText('Oturum saati'))
    await user.type(screen.getByLabelText('Oturum saati'), '18:30')
    await user.click(screen.getByRole('button', { name: 'Yalnız bu oturum' }))

    await screen.findByRole('button', { name: 'Saat: 18:30' })
    expect((await db.sessions.listByGroup(group.id))[0].startTime).toBe('18:30')
    expect((await db.groups.list())[0].schedule[0].startTime).toBe('17:00')
  })

  it('bundan sonra hep seçilince grubun o günkü slotu da güncellenir', async () => {
    const user = userEvent.setup({ delay: null })
    const today = weekdayOf(todayIso())
    const { db, group } = await setup([{ weekday: today, startTime: '17:00', durationMinutes: 90 }])

    await screen.findByRole('button', { name: 'Saat: 17:00' })
    await user.click(screen.getByRole('button', { name: 'Saat: 17:00' }))
    await user.clear(screen.getByLabelText('Oturum saati'))
    await user.type(screen.getByLabelText('Oturum saati'), '18:30')
    await user.click(screen.getByRole('button', { name: 'Bundan sonra hep' }))

    await waitFor(async () =>
      expect((await db.groups.list())[0].schedule[0].startTime).toBe('18:30'),
    )
    expect((await db.sessions.listByGroup(group.id))[0].startTime).toBe('18:30')
  })

  it('takvim dışı günde bundan sonra hep seçeneği çıkmaz', async () => {
    const user = userEvent.setup({ delay: null })
    await setup([{ weekday: otherWeekday(), startTime: '17:00', durationMinutes: 90 }])

    await screen.findByText('Can Erdoğan')
    await user.click(screen.getByRole('button', { name: /^Saat:/ }))
    expect(screen.getByRole('button', { name: 'Yalnız bu oturum' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bundan sonra hep' })).toBeNull()
  })
})
