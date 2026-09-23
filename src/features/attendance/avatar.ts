import type { Player } from '../../domain/types'

export function initials(player: Player): string {
  return `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toLocaleUpperCase('tr-TR')
}

// Tailwind classes must be static (JIT scan) — hence the full-name table.
const TONES = [
  'bg-av-1-soft text-av-1',
  'bg-av-2-soft text-av-2',
  'bg-av-3-soft text-av-3',
  'bg-av-4-soft text-av-4',
  'bg-av-5-soft text-av-5',
] as const

/** Aynı isim her ekranda aynı rengi alır. */
export function avatarTone(name: string): (typeof TONES)[number] {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length]
}
