import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  BOQ_ORDER,
  boq,
  boqCSV,
  boqSummary,
  boqText,
  createNode,
  demoProject,
  newProject,
  type BoqRow,
} from './index'

function loadPrototypeBoqDemo(): { rows: BoqRow[], csv: string } {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const name of ['geom.js', 'model.js']) {
    const filePath = resolve(process.cwd(), 'prototype/app/js', name)
    vm.runInContext(readFileSync(filePath, 'utf8'), ctx, { filename: name })
  }
  const raw = vm.runInContext(
    '(() => { const p = demoProject(); const rows = boq(p); return JSON.stringify({ rows, csv: boqCSV(rows) }); })()',
    ctx,
  ) as string
  return JSON.parse(raw) as { rows: BoqRow[], csv: string }
}

describe('daftar material / BOQ (M4-06)', () => {
  it('hasil boq() dan boqCSV() untuk demoProject() identik 100% dengan prototype', () => {
    const demo = demoProject()
    const rows = boq(demo)
    const csv = boqCSV(rows)
    const proto = loadPrototypeBoqDemo()

    expect(rows).toEqual(proto.rows)
    expect(csv).toBe(proto.csv)

    // Verifikasi urutan kategori & nilai kunci
    const categories = [...new Set(rows.map(r => r.kat))]
    expect(categories).toEqual([...BOQ_ORDER])

    const ductTotalFromNodes = Math.round(
      demo.nodes
        .filter(n => n.type === 'straight')
        .reduce((sum, n) => sum + n.L, 0) / 100,
    ) / 10
    const summary = boqSummary(rows)
    expect(summary.totalDuctMeters).toBe(ductTotalFromNodes)
    expect(summary.count).toBe(rows.length)
    expect(csv.startsWith('\uFEFFKategori;Item;Spesifikasi;Jumlah;Satuan\r\n')).toBe(true)
  })

  it('menghitung proyek kosong, elbow siku reducing, perlengkapan duct, dan opsi gantungan mati', () => {
    expect(boq(newProject())).toEqual([])
    expect(boqSummary([]).label).toBe('')

    const project = newProject({ name: 'Ruko 2 Lantai', unit: 'mm' })
    project.hang = { on: false, sp: 1500 }
    project.nodes.push(
      createNode('flex', { x: 0, y: 0, L: 1250, w: 200, h: 200, shape: 'round', sys: 'SA' }),
      createNode('elbow', { x: 1500, y: 0, w: 500, h: 400, w2: 400, h2: 300, et: 'sq', angle: 90, sys: 'SA' }),
      createNode('damper', { x: 2500, y: 0, w: 500, h: 400, sys: 'SA' }),
      createNode('accessdoor', { x: 3000, y: 0, w: 500, h: 400, sys: 'SA' }),
      createNode('endcap', { x: 3500, y: 0, w: 500, h: 400, sys: 'SA' }),
      createNode('grille', { x: 4000, y: 0, Fx: 450, Fy: 300, sys: 'EA' }),
    )

    const rows = boq(project)
    expect(rows.find(r => r.item === 'Flexible SA')).toMatchObject({
      kat: 'Duct',
      spec: 'Ø200',
      qty: 1.3,
      unit: 'm',
    })
    expect(rows.find(r => r.item === 'Elbow siku + vane SA')).toMatchObject({
      kat: 'Fitting',
      spec: '500x400 → 400x300 · 90°',
      qty: 1,
      unit: 'bh',
    })
    expect(rows.find(r => r.item === 'Grille EA')).toMatchObject({
      kat: 'Perlengkapan',
      spec: '450×300 mm',
      qty: 1,
      unit: 'bh',
    })
    // Gantungan dimatikan -> tidak ada baris gantungan
    expect(rows.find(r => r.item.startsWith('Gantungan'))).toBeUndefined()

    // CSV memakai pemisah titik koma dan koma desimal untuk Excel Indonesia
    const csv = boqCSV(rows)
    expect(csv).toContain(';1,3;m')

    // Format teks WhatsApp memuat nama proyek, daftar item, dan catatan sisa potong
    const text = boqText(project.name, rows)
    expect(text).toContain('Daftar material - Ruko 2 Lantai')
    expect(text).toContain('Flexible SA Ø200: 1,3 m')
    expect(text).toContain('belum termasuk sisa potong')
  })
})
