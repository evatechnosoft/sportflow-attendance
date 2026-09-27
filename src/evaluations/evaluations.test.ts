import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SKILLS,
  addSkill,
  buildEvaluation,
  isValidScore,
  latestByStudent,
  latestTwo,
  skillAverages,
  validateEvaluation,
  validateSkills,
  type Evaluation,
} from './evaluations'

// Kept identical in clubcrm and sportflow (src/evaluations/evaluations.test.ts).

const skills = [
  { key: 'servis', label: 'Servis' },
  { key: 'pas', label: 'Pas' },
]

const evaluation = (patch: Partial<Evaluation>): Evaluation => ({
  id: 'e1',
  kind: 'player',
  groupId: 'g1',
  studentId: 's1',
  date: '2026-09-01',
  skills,
  scores: { servis: 5, pas: 6 },
  shared: false,
  createdBy: 'koc@gmail.com',
  createdByName: 'Koç',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...patch,
})

describe('puan doğrulama', () => {
  it('yalnız 1-10 arası tam sayı geçerlidir', () => {
    expect([1, 5, 10].every(isValidScore)).toBe(true)
    expect([0, 11, 7.5, -1, Number.NaN].some(isValidScore)).toBe(false)
  })

  it('her yetenek puanlanmalı, fazladan anahtar olmamalı', () => {
    expect(validateEvaluation({ skills, scores: { servis: 5, pas: 6 } })).toBeNull()
    expect(validateEvaluation({ skills, scores: { servis: 5 } })).toMatch(/Pas/)
    expect(validateEvaluation({ skills, scores: { servis: 5, pas: 11 } })).toMatch(/1-10/)
    expect(validateEvaluation({ skills, scores: { servis: 5, pas: 6, blok: 3 } })).toMatch(/yetenek/)
    expect(validateEvaluation({ skills: [], scores: {} })).toMatch(/yetenek/)
  })

  it('not en fazla 500 karakter', () => {
    expect(validateEvaluation({ skills, scores: { servis: 5, pas: 6 }, note: 'x'.repeat(501) })).toMatch(/500/)
  })
})

describe('son iki değerlendirme', () => {
  it('tarihe, aynı günse kayıt saatine göre en yeni ikisini verir', () => {
    const rows = [
      evaluation({ id: 'a', date: '2026-08-01' }),
      evaluation({ id: 'b', date: '2026-09-10', createdAt: '2026-09-10T09:00:00Z' }),
      evaluation({ id: 'c', date: '2026-09-10', createdAt: '2026-09-10T11:00:00Z' }),
    ]
    const [latest, previous] = latestTwo(rows)
    expect(latest?.id).toBe('c')
    expect(previous?.id).toBe('b')
  })

  it('tek ya da hiç değerlendirme yoksa eksik kalır', () => {
    expect(latestTwo([evaluation({ id: 'a' })]).map((row) => row?.id)).toEqual(['a', undefined])
    expect(latestTwo([])).toEqual([undefined, undefined])
  })

  it('sporcu başına en yeni değerlendirme; takım kaydı sayılmaz', () => {
    const rows = [
      evaluation({ id: 'a', studentId: 's1', date: '2026-08-01' }),
      evaluation({ id: 'b', studentId: 's1', date: '2026-09-01' }),
      evaluation({ id: 'c', studentId: 's2', date: '2026-07-01' }),
      evaluation({ id: 't', kind: 'team', studentId: undefined, date: '2026-09-20' }),
    ]
    expect(latestByStudent(rows).map((row) => row.id).sort()).toEqual(['b', 'c'])
  })
})

describe('yetenek ortalaması', () => {
  it('yetenek başına ortalama, bir ondalık; puanı olmayan sayılmaz', () => {
    const rows = [
      evaluation({ scores: { servis: 5, pas: 6 } }),
      evaluation({ scores: { servis: 8 }, skills: [skills[0]] }),
    ]
    expect(skillAverages(rows, skills)).toEqual({ servis: 6.5, pas: 6 })
  })

  it('hiç puan yoksa yetenek boş kalır', () => {
    expect(skillAverages([], skills)).toEqual({})
  })
})

describe('yetenek listesi', () => {
  it('hazır liste voleybol yeteneklerini içerir', () => {
    expect(DEFAULT_SKILLS.map((skill) => skill.label)).toEqual([
      'Servis', 'Smaç', 'Manşet', 'Pas', 'Blok', 'Savunma', 'Takım koordinasyonu', 'Oyun disiplini',
    ])
    expect(validateSkills(DEFAULT_SKILLS)).toBeNull()
  })

  it('eklenen yeteneğe tekil anahtar üretilir', () => {
    const next = addSkill(skills, 'Pas ')
    expect(next.at(-1)).toEqual({ key: 'pas-2', label: 'Pas' })
    expect(addSkill(skills, 'Smaç').at(-1)).toEqual({ key: 'smac', label: 'Smaç' })
  })

  it('boş ad, aynı ad ya da boş liste geçersiz', () => {
    expect(validateSkills([])).toMatch(/en az/i)
    expect(validateSkills([{ key: 'a', label: ' ' }])).toMatch(/boş/)
    expect(validateSkills([{ key: 'a', label: 'Pas' }, { key: 'b', label: 'pas' }])).toMatch(/iki kez/)
  })
})

describe('belge', () => {
  const author = { email: 'Koc@Gmail.com', name: 'Koç' }
  const now = '2026-09-27T10:00:00.000Z'

  it('takım değerlendirmesi paylaşılmaz, sporcu alanı yazılmaz', () => {
    const row = buildEvaluation(
      { kind: 'team', groupId: 'g1', studentId: 's1', date: '2026-09-27', skills, scores: { servis: 7, pas: 8 }, shared: true },
      author,
      now,
    )
    expect(row.shared).toBe(false)
    expect('studentId' in row).toBe(false)
    expect(row.createdBy).toBe('koc@gmail.com')
  })

  it('boş not yazılmaz; geçersiz puan ya da sporcusuz kayıt reddedilir', () => {
    const base = { kind: 'player' as const, groupId: 'g1', studentId: 's1', date: '2026-09-27', skills, scores: { servis: 7, pas: 8 }, shared: true }
    const row = buildEvaluation({ ...base, note: '  ' }, author, now)
    expect('note' in row).toBe(false)
    expect(row.shared).toBe(true)
    expect(() => buildEvaluation({ ...base, scores: { servis: 0, pas: 8 } }, author, now)).toThrow(/1-10/)
    expect(() => buildEvaluation({ ...base, studentId: undefined }, author, now)).toThrow(/Sporcu/)
  })
})
