import { createContext } from 'react'
import type { EvaluationSource } from './evaluations'

/** Değerlendirme kaynağı + giriş e-postası (kendi kaydını silme); yoksa bölüm görünmez. */
export const EvaluationsContext = createContext<{ source: EvaluationSource; me: string } | null>(null)
