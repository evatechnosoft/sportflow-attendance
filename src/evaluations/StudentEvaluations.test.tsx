import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '../app/queryClient'
import { DataSourceProvider } from '../app/dataSource'
import { SelectionProvider } from '../app/selection'
import { createMockDataSource } from '../adapters/mock/mockDataSource'
import { StudentsScreen } from '../features/students/StudentsScreen'
import { todayIso } from '../features/attendance/date'
import { EvaluationsContext } from './context'
import { DEFAULT_SKILLS, type NewEvaluation } from './evaluations'
import { createMemoryEvaluations } from './memoryEvaluations'

const allScores = (value: number) => Object.fromEntries(DEFAULT_SKILLS.map((skill) => [skill.key, value]))

async function setup({ readOnly = true } = {}) {
  const db = createMockDataSource()
  const branch = await db.branches.create({ name: 'Voleybol', slug: 'voleybol' })
  const group = await db.groups.create({ name: 'Voleybol U12', branchId: branch.id, schedule: [] })
  const spell = [{ groupId: group.id, joinedOn: '2026-09-01' }]
  const ada = await db.players.create({ firstName: 'Ada', lastName: 'Yıldız', status: 'active', groupHistory: spell })
  const can = await db.players.create({ firstName: 'Can', lastName: 'Erdoğan', status: 'active', groupHistory: spell })
  const source = createMemoryEvaluations({ email: 'koc@gmail.com', name: 'Koç Elif' })
  const seed = (patch: Partial<NewEvaluation>) =>
    source.create({
      kind: 'player',
      groupId: group.id,
      studentId: ada.id,
      date: '2026-09-01',
      skills: DEFAULT_SKILLS,
      scores: allScores(4),
      shared: false,
      ...patch,
    })

  render(
    <QueryClientProvider client={createQueryClient()}>
      <DataSourceProvider value={db}>
        <SelectionProvider>
          <EvaluationsContext.Provider value={{ source, me: 'koc@gmail.com' }}>
            <StudentsScreen readOnly={readOnly} />
          </EvaluationsContext.Provider>
        </SelectionProvider>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
  return { source, group, ada, can, seed, user: userEvent.setup({ delay: null }) }
}

const card = async (name: string) => {
  const row = (await screen.findByText(name)).closest('li')
  if (!row) throw new Error(`${name} kartı yok`)
  return within(row)
}

async function score(scope: ReturnType<typeof within>, user: ReturnType<typeof userEvent.setup>, value: number, skip = '') {
  for (const skill of DEFAULT_SKILLS) {
    if (skill.label === skip) continue
    await user.click(within(scope.getByRole('radiogroup', { name: skill.label })).getByRole('radio', { name: String(value) }))
  }
}

describe('yetenek değerlendirmesi — sporcu', () => {
  afterEach(cleanup)

  it('koç sporcu kartından puanlar, veliyle paylaşır; radar ve tablo görünür', async () => {
    const { source, group, ada, user } = await setup()
    const ada1 = await card('Ada Yıldız')
    await user.click(ada1.getByRole('button', { name: 'Değerlendir' }))
    await user.click(ada1.getByRole('button', { name: 'Yeni değerlendirme' }))
    await score(ada1, user, 7)
    await user.type(ada1.getByLabelText('Koç notu'), 'Servisi gelişti')
    await user.click(ada1.getByRole('checkbox', { name: 'Veliyle paylaş' }))
    await user.click(ada1.getByRole('button', { name: 'Kaydet' }))

    const chart = await ada1.findByRole('img', { name: /Servis 7/ })
    expect(chart).toBeTruthy()
    expect(ada1.getByText('Servisi gelişti')).toBeTruthy()
    const [saved] = await source.listByGroup(group.id)
    expect(saved).toMatchObject({ kind: 'player', studentId: ada.id, shared: true, date: todayIso() })
    expect(saved.scores.servis).toBe(7)
  })

  it('eksik puanla kaydedilmez', async () => {
    const { source, group, user } = await setup()
    const ada1 = await card('Ada Yıldız')
    await user.click(ada1.getByRole('button', { name: 'Değerlendir' }))
    await user.click(ada1.getByRole('button', { name: 'Yeni değerlendirme' }))
    await score(ada1, user, 6, 'Smaç')
    await user.click(ada1.getByRole('button', { name: 'Kaydet' }))

    await ada1.findByText('Smaç puanlanmadı.')
    expect(await source.listByGroup(group.id)).toHaveLength(0)
  })

  it('son iki değerlendirme üst üste; geçmişte paylaşım açılıp kapanır', async () => {
    const { source, seed, user } = await setup()
    await seed({ date: '2026-08-01', scores: allScores(3) })
    const latest = await seed({ date: '2026-09-15', scores: allScores(8) })
    await seed({ date: '2026-07-01', scores: allScores(2) })

    const ada1 = await card('Ada Yıldız')
    await user.click(ada1.getByRole('button', { name: 'Değerlendir' }))
    const chart = await ada1.findByRole('img', { name: /15\.09\.2026: Servis 8.*01\.08\.2026: Servis 3/ })
    expect(chart).toBeTruthy()
    expect(ada1.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Yetenek', '15.09.2026', '01.08.2026'])

    const history = ada1.getByRole('list', { name: 'Değerlendirme geçmişi' })
    expect(within(history).getAllByRole('listitem')).toHaveLength(3)
    await user.click(within(history).getAllByRole('switch', { name: /Veliyle paylaş/ })[0])
    await waitFor(async () => expect((await source.listShared(latest.studentId!)).map((row) => row.id)).toEqual([latest.id]))
  })

  it('eski yetenek listesiyle kaydedilmiş değerlendirme kendi etiketleriyle görünür', async () => {
    const { seed, user } = await setup()
    await seed({ skills: [{ key: 'eski', label: 'Eski yetenek' }], scores: { eski: 9 } })
    const ada1 = await card('Ada Yıldız')
    await user.click(ada1.getByRole('button', { name: 'Değerlendir' }))
    expect(await ada1.findByRole('img', { name: /Eski yetenek 9/ })).toBeTruthy()
  })
})

describe('yetenek değerlendirmesi — takım', () => {
  afterEach(cleanup)

  it('takım değerlendirmesi girilir; sporcuların son değerlendirmelerinin ortalaması görünür', async () => {
    const { source, group, ada, can, seed, user } = await setup()
    await seed({ studentId: ada.id, date: '2026-08-01', scores: allScores(2) })
    await seed({ studentId: ada.id, date: '2026-09-01', scores: allScores(6) })
    await seed({ studentId: can.id, date: '2026-09-01', scores: allScores(9) })

    await user.click(await screen.findByText('Takım değerlendirmesi'))
    const team = within(screen.getByRole('region', { name: 'Takım değerlendirmesi' }))
    await team.findByText('2 sporcunun son değerlendirmesi')
    expect(team.getByRole('meter', { name: 'Servis' }).getAttribute('aria-valuenow')).toBe('7.5')

    await user.click(team.getByRole('button', { name: 'Takım değerlendirmesi gir' }))
    expect(team.queryByRole('checkbox', { name: 'Veliyle paylaş' })).toBeNull()
    await score(team, user, 5)
    await user.click(team.getByRole('button', { name: 'Kaydet' }))

    expect(await team.findByRole('img', { name: /Takım.*Servis 5/ })).toBeTruthy()
    const rows = await source.listByGroup(group.id)
    expect(rows.filter((row) => row.kind === 'team')).toHaveLength(1)
  })
})
