import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LAYER_KEYS,
  createNode,
  demoProject,
  newProject,
  toDXF,
} from './index'

function normalizeLineEndings(raw: string): string {
  return raw.replace(/\r\n/g, '\n')
}

function splitDxfSections(dxf: string) {
  const norm = normalizeLineEndings(dxf)
  const ltypeStart = norm.indexOf('0\nTABLE\n2\nLTYPE\n')
  const layerStart = norm.indexOf('0\nTABLE\n2\nLAYER\n')
  return {
    beforeLtype: norm.slice(0, ltypeStart),
    ltypeTable: norm.slice(ltypeStart, layerStart),
    fromLayerToEnd: norm.slice(layerStart),
  }
}

function assertValidDxfR12Structure(dxf: string) {
  const lines = normalizeLineEndings(dxf).trimEnd().split('\n')
  expect(lines.length % 2).toBe(0)
  expect(lines[lines.length - 1]).toBe('EOF')
  expect(dxf.split('\nSECTION\n').length).toBe(dxf.split('\nENDSEC\n').length)

  for (let i = 0; i < lines.length; i += 2) {
    const codeStr = lines[i]!
    const valueStr = lines[i + 1]!
    expect(codeStr, `kode grup baris ${i + 1}`).toMatch(/^-?\d+$/)
    const code = Number(codeStr)
    if ((code >= 10 && code <= 59) || code === 62 || code === 70 || code === 72 || code === 73) {
      expect(Number.isFinite(Number(valueStr)), `nilai angka baris ${i + 2}: "${valueStr}"`).toBe(true)
    }
  }
}

describe('export DXF R12 (M4-03)', () => {
  it('regresi: demoProject() cocok dengan prototype/uji-dxf/kantor-mm.dxf dan kantor-inch.dxf selain tabel LTYPE DASHED yang disengaja', () => {
    const allLayers = new Set(LAYER_KEYS)
    const demo = demoProject()

    for (const [unit, fixtureName] of [['mm', 'kantor-mm.dxf'], ['inch', 'kantor-inch.dxf']] as const) {
      const generated = toDXF(demo, { layers: allLayers, unit, note: true })
      const expected = readFileSync(resolve(process.cwd(), 'prototype/uji-dxf', fixtureName), 'utf8')

      assertValidDxfR12Structure(generated)

      const genParts = splitDxfSections(generated)
      const expParts = splitDxfSections(expected)

      // HEADER ($ACADVER, $INSUNITS) identik 100%
      expect(genParts.beforeLtype).toBe(expParts.beforeLtype)

      // Tabel LTYPE menambahkan linetype DASHED (perbaikan disengaja dari CHECKLIST.md M0-01)
      expect(genParts.ltypeTable).toContain('0\nLTYPE\n2\nCONTINUOUS\n')
      expect(genParts.ltypeTable).toContain('0\nLTYPE\n2\nDASHED\n')

      // Seluruh tabel LAYER dan seluruh section ENTITIES (4000+ baris) identik karakter-per-karakter!
      expect(genParts.fromLayerToEnd).toBe(expParts.fromLayerToEnd)
    }
  })

  it('balok dan bukaan memakai linetype DASHED pada DXF R12 (perbaikan temuan CHECKLIST.md M0-01)', () => {
    const p = newProject({ unit: 'mm' })
    p.nodes = [
      createNode('beam', { x: 0, y: 0, L: 4000, bw: 300, be: 3000 }),
      createNode('opening', { x: 1000, y: 1000, dw: 1000, t: 150 }),
    ]

    const dxf = toDXF(p, { layers: new Set(LAYER_KEYS), unit: 'mm', note: false })
    assertValidDxfR12Structure(dxf)

    // 2 garis sejajar balok + 2 garis putus-putus bukaan = 4 entitas LINE dengan kode 6 DASHED
    const dashedMatches = dxf.match(/\n6\nDASHED\n/g) ?? []
    expect(dashedMatches.length).toBe(4)

    // Pastikan panjang total pola (kode 40) tepat sama dengan |dash| + |gap|
    const ltypeMatch = /2\nDASHED\n70\n0\n3\n[^\n]+\n72\n65\n73\n2\n40\n([^\n]+)\n49\n([^\n]+)\n49\n([^\n]+)\n/.exec(dxf)
    expect(ltypeMatch).not.toBeNull()
    const total = Number(ltypeMatch![1])
    const dash = Number(ltypeMatch![2])
    const gap = Number(ltypeMatch![3])
    expect(dash).toBeGreaterThan(0)
    expect(gap).toBeLessThan(0)
    expect(Math.abs(total - (Math.abs(dash) + Math.abs(gap)))).toBeLessThan(1e-6)
  })

  it('teks bergaya (underline, italic, warna ACI merah), simbol Ø/°, filter layer, dan catatan sketsa bantu terekspor benar', () => {
    const p = newProject({ unit: 'mm', name: 'Uji Teks' })
    p.nodes = [
      createNode('text', { s: 'CEK Ø300 45°', col: 'merah', it: true, ul: true }),
      createNode('straight', { x: 0, y: 0, L: 2000, w: 300, h: 300, shape: 'round', sys: 'SA' }),
      createNode('straight', { x: 0, y: 1000, L: 2000, w: 300, h: 300, shape: 'rect', sys: 'EA' }),
    ]

    // Export hanya layer dim & sa (layer ea disaring keluar)
    const dxf = toDXF(p, { layers: new Set(['dim', 'sa']), unit: 'mm', note: true })
    assertValidDxfR12Structure(dxf)

    expect(dxf).toContain('%%uCEK %%c300 45%%d')
    expect(dxf).toMatch(/\n51\n15\.000\n/)
    expect(dxf).toMatch(/\n8\nDIMENSION\n62\n1\n/)
    expect(dxf).toContain('SKETSA BANTU TEMANDOR - CEK ULANG UKURAN DI LAPANGAN. Uji Teks (1:100, duct mm)')
    expect(dxf).toContain('\n8\nDUCT-SA\n')
    expect(dxf).not.toContain('\n8\nDUCT-EA\n')
  })
})
