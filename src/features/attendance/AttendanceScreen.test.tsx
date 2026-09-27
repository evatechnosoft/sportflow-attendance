import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { createQueryClient } from '../../app/queryClient'
import { AttendanceScreen } from './AttendanceScreen'
import { DataSourceProvider } from '../../app/dataSource'
import { SelectionProvider } from '../../app/selection'
import { createMockDataSource } from '../../adapters/mock/mockDataSource'
import type { DataSource } from '../../ports/repositories'
import type { AttendanceWindow, ScheduleSlot } from '../../domain/types'
import { endTime, todayIso, weekdayOf, WEEKDAY_LABEL } from './date'

/** Bugünün dışındaki bir ISO gün — takvimi olan ama bugün toplanmayan grup için. */
const otherWeekday = () => (weekdayOf(todayIso()) % 7) + 1

/** Aidat: Can gecikmiş; `dues: false` alan anahtarını kapatır. Sorgu sayısı döner. */
interface DuesOptions {
  canOverdue?: boolean
  dues?: boolean
  window?: AttendanceWindow
}

/** Aynı gün içinde şimdiden 3 saat uzak ders saati: pencere (-30 dk … bitiş +60 dk) dışında. */
const farTime = () => timeFromNow(new Date().getHours() < 12 ? 180 : -180)

/** Şimdiden `offset` dk sonrası, HH:MM. */
const timeFromNow = (offset: number) => {
  const now = new Date()
  const minutes = (now.getHours() * 60 + now.getMinutes() + offset + 1440) % 1440
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

async function setup(schedule: ScheduleSlot[] = [], dues: DuesOptions = {}) {
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
  const can = await db.players.create({
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
  const duesCalls = { count: 0 }
  db.dues.overdueByGroup = async () => {
    duesCalls.count += 1
    return dues.canOverdue ? [can.id] : []
  }
  if (dues.dues === false) await db.settings.update({ fields: { dues: false } })
  if (dues.window) await db.settings.update({ window: dues.window })

  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <DataSourceProvider value={db}>
        <SelectionProvider>
          <AttendanceScreen />
        </SelectionProvider>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
  return { db, group, duesCalls }
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

  it('aidatı gecikmiş sporcunun satırında rozet çıkar, diğerinde çıkmaz', async () => {
    await setup([], { canOverdue: true })
    const badge = await screen.findByLabelText('Aidat gecikmiş')
    expect(badge.closest('li')?.textContent).toContain('Can Erdoğan')
    expect(screen.getAllByLabelText('Aidat gecikmiş')).toHaveLength(1)
  })

  it('aidat işareti kapalıyken rozet yok ve aidat sorgusu atılmaz', async () => {
    const { duesCalls } = await setup([], { canOverdue: true, dues: false })
    await screen.findByText('Can Erdoğan')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByLabelText('Aidat gecikmiş')).toBeNull()
    expect(duesCalls.count).toBe(0)
  })

  it('okul alanı kapalıyken başlıkta okul adı ve ayırıcısı çıkmaz', async () => {
    const { db } = await setup()
    await db.settings.update({ fields: { school: false } })
    cleanup()
    const client = createQueryClient()
    render(
      <QueryClientProvider client={client}>
        <DataSourceProvider value={db}>
          <SelectionProvider>
            <AttendanceScreen />
          </SelectionProvider>
        </DataSourceProvider>
      </QueryClientProvider>,
    )
    await screen.findByText('Can Erdoğan')
    // Tam eşleşme: "Voleybol" tek başına — başta " · " ayırıcısı kalmamış.
    expect((await screen.findAllByText('Voleybol')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Atatürk/)).toBeNull()
  })

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

  it('çevrimdışı: kaydet asılı kalmaz, yazma veri kaynağına gider', async () => {
    onlineManager.setOnline(false)
    try {
      const user = userEvent.setup({ delay: null })
      const { db, group } = await setup()
      await screen.findByText('Can Erdoğan')
      await mark(user, 'Can Erdoğan', 'Var')
      await user.click(screen.getByRole('button', { name: /Kaydet/ }))
      await screen.findByText('Kaydedildi')
      const session = (await db.sessions.listByGroup(group.id))[0]
      expect(await db.attendance.listBySession(session.id)).toHaveLength(1)
    } finally {
      onlineManager.setOnline(true)
    }
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

  it('bugün ders günü ama saat pencere dışındaysa uyarı çıkar, kaydetme engellenmez', async () => {
    const user = userEvent.setup({ delay: null })
    const startTime = farTime()
    await setup([{ weekday: weekdayOf(todayIso()), startTime, durationMinutes: 60 }])

    await screen.findByText(`Şu an ders saati değil — bugünkü ders ${startTime}–${endTime(startTime, 60)}`)
    await screen.findByText('Can Erdoğan')
    await mark(user, 'Can Erdoğan', 'Var')
    expect(screen.getByRole('button', { name: /Kaydet/ })).toBeTruthy()
  })

  it('pencere ayardan gelir: geniş pencerede 3 saat uzaktaki ders için uyarı çıkmaz', async () => {
    const startTime = farTime()
    await setup([{ weekday: weekdayOf(todayIso()), startTime, durationMinutes: 60 }], {
      window: { beforeMinutes: 240, afterMinutes: 240 },
    })

    await screen.findByRole('button', { name: `Saat: ${startTime}` })
    await screen.findByText('Can Erdoğan')
    expect(screen.queryByText(/Şu an ders saati değil/)).toBeNull()
  })

  it('telafi saati etrafında pencere uyarısı çıkmaz', async () => {
    const user = userEvent.setup({ delay: null })
    const startTime = farTime()
    const makeupTime = timeFromNow(0)
    await setup([{ weekday: weekdayOf(todayIso()), startTime, durationMinutes: 60 }])

    await screen.findByText(/Şu an ders saati değil/)
    await user.click(await screen.findByRole('button', { name: `Saat: ${startTime}` }))
    await user.clear(screen.getByLabelText('Oturum saati'))
    await user.type(screen.getByLabelText('Oturum saati'), makeupTime)
    await user.click(screen.getByRole('button', { name: 'Telafi olarak kaydet (yalnız bu gün)' }))

    await screen.findByRole('button', { name: `Telafi · ${makeupTime}` })
    expect(screen.queryByText(/Şu an ders saati değil/)).toBeNull()
  })

  it('telafi oturumunda antrenman-yok uyarısı çıkmaz', async () => {
    const user = userEvent.setup({ delay: null })
    await setup([{ weekday: otherWeekday(), startTime: '17:00', durationMinutes: 90 }])

    await screen.findByText(/antrenmanı yok/)
    await user.click(await screen.findByRole('button', { name: /^Saat:/ }))
    await user.type(screen.getByLabelText('Oturum saati'), '19:00')
    await user.click(screen.getByRole('button', { name: 'Telafi olarak kaydet (yalnız bu gün)' }))

    await screen.findByRole('button', { name: 'Telafi · 19:00' })
    expect(screen.queryByText(/antrenmanı yok/)).toBeNull()
  })

  it('takvimi tanımlı olmayan grupta uyarı çıkmaz', async () => {
    await setup()

    await screen.findByText('Can Erdoğan')
    expect(screen.queryByText(/antrenmanı yok/)).toBeNull()
  })

  it('telafi yalnız bu günün oturumuna saat + telafi işareti yazar, grubun takvimi durur', async () => {
    const user = userEvent.setup({ delay: null })
    const today = weekdayOf(todayIso())
    const { db, group } = await setup([{ weekday: today, startTime: '17:00', durationMinutes: 90 }])

    await screen.findByRole('button', { name: 'Saat: 17:00' })
    await user.click(screen.getByRole('button', { name: 'Saat: 17:00' }))
    await user.clear(screen.getByLabelText('Oturum saati'))
    await user.type(screen.getByLabelText('Oturum saati'), '18:30')
    await user.click(screen.getByRole('button', { name: 'Telafi olarak kaydet (yalnız bu gün)' }))

    await screen.findByRole('button', { name: 'Telafi · 18:30' })
    const [session] = await db.sessions.listByGroup(group.id)
    expect(session).toMatchObject({ startTime: '18:30', makeup: true })
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
    const [session] = await db.sessions.listByGroup(group.id)
    expect(session.startTime).toBe('18:30')
    expect(session.makeup).toBeUndefined()
  })

  it('takvim dışı günde bundan sonra hep seçeneği çıkmaz', async () => {
    const user = userEvent.setup({ delay: null })
    await setup([{ weekday: otherWeekday(), startTime: '17:00', durationMinutes: 90 }])

    await screen.findByText('Can Erdoğan')
    await user.click(screen.getByRole('button', { name: /^Saat:/ }))
    expect(screen.getByRole('button', { name: 'Telafi olarak kaydet (yalnız bu gün)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bundan sonra hep' })).toBeNull()
  })
})
