import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TemaPage from '../../app/pages/_tema.vue'

function parseThemeTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, hex] = match
    if (name && hex) {
      tokens[name] = hex.toLowerCase()
    }
  }
  return tokens
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => {
    const srgb = Number.parseInt(clean.slice(offset, offset + 2), 16) / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex)
  const l2 = relativeLuminance(bgHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('token tema & kontras DESIGN.md', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/assets/css/main.css'), 'utf8')
  const tokens = parseThemeTokens(css)

  it('memuat semua warna utama dari DESIGN.md', () => {
    const requiredTokens: Record<string, string> = {
      'hazard': '#f2c200',
      'hazard-hover': '#ffd31a',
      'ink': '#17191c',
      'cad-ground': '#14171b',
      'cad-deep': '#101317',
      'cad-foot': '#0e1013',
      'paper': '#f3f2ee',
      'panel': '#fbfaf7',
      'card': '#ffffff',
      'line': '#dfdcd4',
      'line-strong': '#c9c5bb',
      'hover-tint': '#ece9e1',
      'seg-track': '#ebe9e3',
      'muted': '#64625d',
      'placeholder': '#77756f',
      'reading-gray': '#3f3d39',
      'selected-wash': '#fffbe6',
      'warn-red': '#dc2626',
      'danger': '#b91c1c',
      'error-ink': '#991b1b',
      'error-wash': '#fef2f2',
      'done-green': '#15803d',
      'stamp-green': '#4ade80',
      'tip-red': '#fca5a5',
      'sa-screen': '#4ea1ff',
      'ea-screen': '#f472b6',
      'eq-screen': '#4ade80',
      'diff-screen': '#22d3ee',
      'sa-paper': '#1d4ed8',
      'ea-paper': '#be185d',
      'eq-paper': '#15803d',
      'diff-paper': '#0e7490',
      'sel-screen': '#facc15',
      'sel-light': '#c2410c',
      'canvas-light': '#f6f7f9',
    }

    for (const [name, hex] of Object.entries(requiredTokens)) {
      expect(tokens[name], `token --color-${name}`).toBe(hex)
    }
  })

  it('memenuhi kontras teks WCAG AA (>= 4,5:1) untuk semua pasangan teks & latar', () => {
    const pairs: Array<[string, string]> = [
      ['ink', 'paper'],
      ['ink', 'panel'],
      ['ink', 'card'],
      ['ink', 'hazard'],
      ['ink', 'hazard-hover'],
      ['muted', 'paper'],
      ['muted', 'panel'],
      ['muted', 'card'],
      ['muted', 'seg-track'],
      ['placeholder', 'card'],
      ['reading-gray', 'paper'],
      ['card', 'ink'],
      ['card', 'cad-ground'],
      ['hazard', 'ink'],
      ['hazard', 'cad-ground'],
      ['danger', 'panel'],
      ['error-ink', 'error-wash'],
      ['done-green', 'card'],
      ['card', 'done-green'],
      ['stamp-green', 'cad-ground'],
      ['tip-red', 'ink'],
      ['card', 'warn-red'],
      ['sa-screen', 'cad-ground'],
      ['ea-screen', 'cad-ground'],
      ['eq-screen', 'cad-ground'],
      ['diff-screen', 'cad-ground'],
      ['sa-paper', 'card'],
      ['ea-paper', 'card'],
      ['eq-paper', 'card'],
      ['diff-paper', 'card'],
    ]

    for (const [fg, bg] of pairs) {
      const fgHex = tokens[fg]
      const bgHex = tokens[bg]
      expect(fgHex, `token ${fg}`).toBeDefined()
      expect(bgHex, `token ${bg}`).toBeDefined()
      const ratio = contrastRatio(fgHex!, bgHex!)
      expect(ratio, `${fg} (${fgHex}) di atas ${bg} (${bgHex}) = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('merender halaman acuan /_tema tanpa error', async () => {
    const wrapper = await mountSuspended(TemaPage)

    expect(wrapper.find('h1').text()).toContain('Acuan Tema')
    expect(wrapper.text()).toContain('DUCT-SA')
    expect(wrapper.text()).toContain('Proyek baru')
  })
})
