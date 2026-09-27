import { buildEvaluation, byNewest, type Evaluation, type EvaluationSource } from './evaluations'

/** Demo ve testler için bellekte; Firestore sürümüyle aynı doğrulama. */
export function createMemoryEvaluations(author = { email: 'demo@anadolu.spor', name: 'Demo koç' }): EvaluationSource {
  const rows: Evaluation[] = []
  let counter = 0
  const find = (id: string) => {
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) throw new Error(`Değerlendirme bulunamadı: ${id}`)
    return row
  }
  return {
    async listByGroup(groupId) {
      return rows.filter((row) => row.groupId === groupId).map((row) => ({ ...row })).sort(byNewest)
    },
    async listShared(studentId) {
      return rows.filter((row) => row.studentId === studentId && row.shared).map((row) => ({ ...row })).sort(byNewest)
    },
    async create(input) {
      const row = { ...buildEvaluation(input, author, new Date().toISOString()), id: `evaluation-${++counter}` }
      rows.push(row)
      return { ...row }
    },
    async setShared(id, shared) {
      find(id).shared = shared
    },
    async remove(id) {
      rows.splice(rows.indexOf(find(id)), 1)
    },
  }
}
