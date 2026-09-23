import { describe, expect, it } from 'vitest'
import { avatarTone } from './avatar'

describe('avatarTone', () => {
  it('aynı isim aynı tonu, farklı isimler paletin birden fazla tonunu alır', () => {
    expect(avatarTone('Ada Yıldız')).toBe(avatarTone('Ada Yıldız'))
    const names = ['Ada Yıldız', 'Can Erdoğan', 'Deniz Ak', 'Mert Kaya', 'Zeynep Kaya', 'Ece Tan']
    expect(new Set(names.map(avatarTone)).size).toBeGreaterThan(1)
  })
})
