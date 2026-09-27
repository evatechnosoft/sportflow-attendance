import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'

// Kept identical in clubcrm and sportflow (src/evaluations/evaluations.ts).

/** Değerlendirilen yetenek; anahtar sabit kalır, etiket değişebilir. */
export interface Skill {
  key: string
  label: string
}

export type EvaluationKind = 'player' | 'team'

/**
 * Koçun yetenek puanları (1-10). Belge o anki yetenek listesini kendi içinde taşır:
 * Tanımlar'da yetenek değişse de eski değerlendirme okunur kalır.
 */
export interface Evaluation {
  id: string
  kind: EvaluationKind
  groupId: string
  /** Yalnız kind === 'player'. */
  studentId?: string
  /** YYYY-MM-DD */
  date: string
  skills: Skill[]
  scores: Record<string, number>
  note?: string
  /** Veli yalnız paylaşılanı görür; takım değerlendirmesi paylaşılmaz. */
  shared: boolean
  createdBy: string
  createdByName: string
  /** ISO datetime */
  createdAt: string
}

export type NewEvaluation = Pick<Evaluation, 'kind' | 'groupId' | 'studentId' | 'date' | 'skills' | 'scores' | 'note' | 'shared'>

export const NOTE_MAX = 500
export const SKILLS_MAX = 20

export const DEFAULT_SKILLS: Skill[] = [
  { key: 'servis', label: 'Servis' },
  { key: 'smac', label: 'Smaç' },
  { key: 'manset', label: 'Manşet' },
  { key: 'pas', label: 'Pas' },
  { key: 'blok', label: 'Blok' },
  { key: 'savunma', label: 'Savunma' },
  { key: 'takim-koordinasyonu', label: 'Takım koordinasyonu' },
  { key: 'oyun-disiplini', label: 'Oyun disiplini' },
]

export const isValidScore = (value: number) => Number.isInteger(value) && value >= 1 && value <= 10

export function validateEvaluation(input: Pick<Evaluation, 'skills' | 'scores' | 'note'>): string | null {
  if (input.skills.length === 0) return 'Değerlendirilecek yetenek yok.'
  const keys = new Set(input.skills.map((skill) => skill.key))
  if (Object.keys(input.scores).some((key) => !keys.has(key))) return 'Listede olmayan yetenek puanlanmış.'
  const missing = input.skills.find((skill) => input.scores[skill.key] === undefined)
  if (missing) return `${missing.label} puanlanmadı.`
  if (!Object.values(input.scores).every(isValidScore)) return 'Puan 1-10 arası tam sayı olmalı.'
  if ((input.note ?? '').trim().length > NOTE_MAX) return `Not en fazla ${NOTE_MAX} karakter.`
  return null
}

export function validateSkills(skills: Skill[]): string | null {
  if (skills.length === 0) return 'En az bir yetenek olmalı.'
  if (skills.length > SKILLS_MAX) return `En fazla ${SKILLS_MAX} yetenek.`
  if (skills.some((skill) => !skill.label.trim())) return 'Yetenek adı boş olamaz.'
  const labels = skills.map((skill) => skill.label.trim().toLocaleLowerCase('tr'))
  if (new Set(labels).size !== labels.length) return 'Aynı yetenek iki kez yazılmış.'
  if (new Set(skills.map((skill) => skill.key)).size !== skills.length) return 'Yetenek anahtarı tekil olmalı.'
  return null
}

const slug = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'yetenek'

/** Yeni yetenek; anahtar ad'dan, çakışırsa -2, -3… */
export function addSkill(skills: Skill[], label: string): Skill[] {
  const base = slug(label)
  const taken = new Set(skills.map((skill) => skill.key))
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`
  return [...skills, { key, label: label.trim() }]
}

/** Yeni önce: tarih, aynı günse kayıt saati. */
export const byNewest = (a: Evaluation, b: Evaluation) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

/** [son, bir önceki] — gelişim grafiği üst üste çizer. */
export function latestTwo(rows: Evaluation[]): [Evaluation | undefined, Evaluation | undefined] {
  const [latest, previous] = [...rows].sort(byNewest)
  return [latest, previous]
}

/** Sporcu başına en yeni değerlendirme (takım kayıtları hariç). */
export function latestByStudent(rows: Evaluation[]): Evaluation[] {
  const latest = new Map<string, Evaluation>()
  for (const row of [...rows].sort(byNewest)) {
    if (row.kind === 'player' && row.studentId && !latest.has(row.studentId)) latest.set(row.studentId, row)
  }
  return [...latest.values()]
}

/** Yetenek başına ortalama (bir ondalık); puanı olmayan değerlendirme o yetenekte sayılmaz. */
export function skillAverages(rows: Evaluation[], skills: Skill[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const { key } of skills) {
    const values = rows.map((row) => row.scores[key]).filter((value): value is number => value !== undefined)
    if (values.length > 0) result[key] = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
  }
  return result
}

export interface EvaluationSource {
  /** Grubun tüm değerlendirmeleri (sporcu + takım); koç kuralı grup eşitliğiyle okutur. */
  listByGroup(groupId: string): Promise<Evaluation[]>
  /** Veli: çocuğun paylaşılmış değerlendirmeleri. */
  listShared(studentId: string): Promise<Evaluation[]>
  create(input: NewEvaluation): Promise<Evaluation>
  setShared(id: string, shared: boolean): Promise<void>
  remove(id: string): Promise<void>
}

/** Çevrimdışıyken yazma kuyruğa düşer; beklemek bağlantıya kadar asılı kalır. */
async function commit(write: Promise<unknown>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    write.catch((error: unknown) => console.error('Değerlendirme yazılamadı', error))
    return
  }
  await write
}

const rowsOf = (snapshot: { docs: { id: string; data: () => unknown }[] }) =>
  snapshot.docs.map((row) => ({ ...(row.data() as Omit<Evaluation, 'id'>), id: row.id })).sort(byNewest)

/** Doğrulanmış, boş alanları atılmış belge; takım değerlendirmesi paylaşılmaz. */
export function buildEvaluation(input: NewEvaluation, author: { email: string; name: string }, now: string): Omit<Evaluation, 'id'> {
  const invalid = validateEvaluation(input)
  if (invalid) throw new Error(invalid)
  if (input.kind === 'player' && !input.studentId) throw new Error('Sporcu seçilmedi.')
  const note = input.note?.trim()
  return {
    kind: input.kind,
    groupId: input.groupId,
    ...(input.kind === 'player' && { studentId: input.studentId }),
    date: input.date,
    skills: input.skills.map(({ key, label }) => ({ key, label })),
    scores: { ...input.scores },
    ...(note && { note }),
    shared: input.kind === 'player' && input.shared,
    createdBy: author.email.toLowerCase(),
    createdByName: author.name,
    createdAt: now,
  }
}

/**
 * Firestore evaluations/{id}. runTransaction yok: tek belge yazılır, çevrimdışı kuyrukta
 * bekler. Veli sorgusu kuralın baktığı alanlarla eşitlik (bileşik index gerekmez).
 */
export function createFirestoreEvaluations(db: Firestore, who: () => { email: string; name: string } | null): EvaluationSource {
  return {
    async listByGroup(groupId) {
      return rowsOf(await getDocs(query(collection(db, 'evaluations'), where('groupId', '==', groupId))))
    },
    async listShared(studentId) {
      return rowsOf(
        await getDocs(
          query(
            collection(db, 'evaluations'),
            where('studentId', '==', studentId),
            where('kind', '==', 'player'),
            where('shared', '==', true),
          ),
        ),
      )
    },
    async create(input) {
      const author = who()
      if (!author) throw new Error('Değerlendirme için giriş gerekiyor.')
      const data = buildEvaluation(input, author, new Date().toISOString())
      const ref = doc(collection(db, 'evaluations'))
      await commit(setDoc(ref, data))
      return { ...data, id: ref.id }
    },
    async setShared(id, shared) {
      await commit(updateDoc(doc(db, 'evaluations', id), { shared }))
    },
    async remove(id) {
      await commit(deleteDoc(doc(db, 'evaluations', id)))
    },
  }
}
