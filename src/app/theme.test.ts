import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextTheme } from './theme'

const css = readFileSync('src/index.css', 'utf8')

/** Token dosyasındaki durum renkleri iki temada da WCAG AA (≥4.5:1) geçmek zorunda. */

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const pairs = [...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]])
  return Object.fromEntries(pairs)
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const STATUSES = ['present', 'late', 'excused', 'absent'] as const

describe.each([
  ['açık', block(':root {')],
  ['koyu', block(":root[data-theme='dark']")],
])('%s tema kontrastı', (_, t) => {
  it.each(STATUSES)('%s metni yüzey üstünde AA', (status) => {
    expect(contrast(t[status], t.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(STATUSES)('%s dolgu üstünde bg rengi metin AA', (status) => {
    expect(contrast(t.bg, t[status])).toBeGreaterThanOrEqual(4.5)
  })
  it.each(STATUSES)('%s metni kendi soft zemininde AA', (status) => {
    expect(contrast(t[status], t[`${status}-soft`])).toBeGreaterThanOrEqual(4.5)
  })
  it('ikincil mürekkep yüzeyde AA', () => {
    expect(contrast(t['ink-2'], t.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it('vurgu: yüzeyde metin, dolguda bg metin, soft zeminde metin AA', () => {
    expect(contrast(t.accent, t.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.bg, t.accent)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.accent, t['accent-soft'])).toBeGreaterThanOrEqual(4.5)
  })
  it('başlık metinleri lacivert zeminde AA', () => {
    expect(contrast(t['on-header'], t.header)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['on-header-2'], t.header)).toBeGreaterThanOrEqual(4.5)
  })
  it('aidat rozeti: soft zeminde ve yüzeyde metin AA', () => {
    expect(contrast(t.dues, t['dues-soft'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.dues, t.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it.each([1, 2, 3, 4, 5])('avatar %i metni kendi soft zemininde AA', (i) => {
    expect(contrast(t[`av-${i}`], t[`av-${i}-soft`])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('nextTheme', () => {
  it('sistem → açık → koyu → sistem', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})
