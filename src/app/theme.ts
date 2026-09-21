import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'sportflow.theme'
const MODES: ThemeMode[] = ['system', 'light', 'dark']

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: 'Sistem',
  light: 'Açık',
  dark: 'Koyu',
}

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** `data-theme` yalnız elle seçimde yazılır; sistem tercihi CSS media query ile gelir. */
export function applyTheme(mode: ThemeMode, root: HTMLElement = document.documentElement) {
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length]
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStored)
  useEffect(() => {
    applyTheme(mode)
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* depolama kapalıysa tercih oturumla sınırlı kalır */
    }
  }, [mode])
  return { mode, cycle: () => setMode(nextTheme) }
}
