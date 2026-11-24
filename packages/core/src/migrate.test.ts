import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  CURRENT_PROJECT_VERSION,
  connect,
  detectProjectVersion,
  docSVG,
  flowTotals,
  newProject,
  openProjectJson,
  projectFileName,
  projectFileSlug,
  safeParseProject,
  serializeProjectJson,
  validate,
} from './index'

interface PrototypeExportBundle {
  demo: { json: string, nodeCount: number, name: string }
  templates: Array<{ id: string, name: string, json: string, nodeCount: number }>
}

function loadPrototypeExports(): PrototypeExportBundle {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'store.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  const raw = vm.runInContext(
    `JSON.stringify((() => {
      const demo = demoProject();
      const templates = TEMPLATES.map(t => {
        const p = t.make();
        return { id: t.id, name: p.name, json: JSON.stringify(p), nodeCount: p.nodes.length };
      });
      return {
        demo: { json: JSON.stringify(demo), nodeCount: demo.nodes.length, name: demo.name },
        templates,
      };
    })())`,
    ctx,
  ) as string
  return JSON.parse(raw) as PrototypeExportBundle
}

describe('format file v2 & migrasi dari prototype v1 (M4-02)', () => {
  it('demoProject() dan semua 6 template sketsa prototype (store.js) terbuka, termigrasi v1 -> v2, dan lolos skema Zod', () => {
    const bundle = loadPrototypeExports()
    expect(bundle.templates).toHaveLength(6)

    // 1. demoProject() prototype
    const demoParsedRaw = JSON.parse(bundle.demo.json) as Record<string, unknown>
    expect(detectProjectVersion(demoParsedRaw)).toBe(1)

    const demoResult = openProjectJson(bundle.demo.json)
    expect(demoResult.ok).toBe(true)
    if (!demoResult.ok) return

    expect(demoResult.migratedFrom).toBe(1)
    expect(demoResult.project.version).toBe(CURRENT_PROJECT_VERSION)
    expect(demoResult.project.name).toBe(bundle.demo.name)
    expect(demoResult.project.nodes).toHaveLength(bundle.demo.nodeCount)
    expect(safeParseProject(demoResult.project).success).toBe(true)

    // Validasi & debit & render SVG bekerja identik setelah migrasi
    const cn = connect(demoResult.project)
    expect(validate(demoResult.project, cn).map(w => w.kind).sort()).toEqual(['open', 'size'])
    const flows = flowTotals(demoResult.project, cn)
    const eqFlows = demoResult.project.nodes
      .filter(n => n.type === 'fcu' || n.type === 'fan')
      .map(n => flows[n.id])
    expect(eqFlows).toEqual([1300, 150])
    expect(docSVG(demoResult.project).svg).toContain('<svg ')

    // 2. Semua 6 template sketsa dari prototype/app/js/store.js
    for (const tpl of bundle.templates) {
      const opened = openProjectJson(tpl.json)
      expect(opened.ok, `Template prototype "${tpl.id}" gagal dibuka`).toBe(true)
      if (!opened.ok) continue

      expect(opened.migratedFrom).toBe(1)
      expect(opened.project.version).toBe(2)
      expect(opened.project.name).toBe(tpl.name)
      expect(opened.project.nodes).toHaveLength(tpl.nodeCount)
      expect(safeParseProject(opened.project).success).toBe(true)
      expect(docSVG(opened.project).svg).toContain('<svg ')
    }
  })

  it('migrasi v1 melengkapi layer/field baru yang hilang dan mempertahankan host pintu serta format v2 tetap utuh', () => {
    const legacyV1 = {
      name: 'Sketsa Lama',
      unit: 'mm',
      scale: '1:50',
      layers: { sa: { on: false, lock: true } },
      nodes: [
        { id: 'r1', type: 'room', x: 0, y: 0, W: 6000, H: 4000, t: 150, name: 'Kantor' },
        { id: 'd1', type: 'door', x: 1000, y: 0, dw: 900, t: 150, host: { id: 'r1', e: 0, s: 1000, n: 4 } },
        { id: 'e1', type: 'elbow', x: 2000, y: 1000, w: 400, h: 300, rr: 1.5, angle: 45 },
        { id: 't1', type: 'text', x: 500, y: 500, s: 'Cek', tz: 1.5 },
        { id: 'unknown', type: 'naga', x: 0, y: 0 },
      ],
    }

    const res = openProjectJson(JSON.stringify(legacyV1), { freshId: false })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.migratedFrom).toBe(1)
    expect(res.project.layers.sa).toEqual({ on: false, lock: true })
    expect(res.project.layers.coret).toEqual({ on: true, lock: false })
    expect(res.project.nodes).toHaveLength(4) // tipe tidak dikenal dilewati aman

    const door = res.project.nodes.find(n => n.type === 'door')
    expect(door && door.type === 'door' && door.host?.id).toBe('r1')

    const elbow = res.project.nodes.find(n => n.type === 'elbow')
    expect(elbow && elbow.type === 'elbow' && elbow.rr).toBe('1.5')
    expect(elbow && elbow.type === 'elbow' && elbow.w2).toBeNull()

    const text = res.project.nodes.find(n => n.type === 'text')
    expect(text && text.type === 'text' && text.tz).toBe('1.5')

    // Round-trip v2 tidak memicu migrasi v1 lagi
    const v2Json = serializeProjectJson(res.project)
    const reopened = openProjectJson(v2Json)
    expect(reopened.ok).toBe(true)
    if (reopened.ok) {
      expect(reopened.migratedFrom).toBeNull()
      expect(reopened.project.id).not.toBe(res.project.id) // freshId default true saat impor
    }
  })

  it('file acak, JSON rusak, versi masa depan, atau skema v2 korup menghasilkan pesan error jelas tanpa crash', () => {
    const cases = [
      '',
      'bukan json sama sekali 12345',
      '{"nodes": [',
      'null',
      '[]',
      '"halo"',
      JSON.stringify({ hello: 'world' }),
      JSON.stringify({ version: 99, id: 'x', name: 'Masa Depan', nodes: [] }),
      JSON.stringify({ ...newProject(), nodes: [{ id: 'bad', type: 'straight', x: 0, y: 0, rot: 0, mir: false, L: -100, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700, flip: false }] }),
    ]

    for (const raw of cases) {
      const res = openProjectJson(raw)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.length).toBeGreaterThan(10)
      }
    }

    const future = openProjectJson(JSON.stringify({ version: 99, nodes: [] }))
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.error).toContain('99')
  })

  it('projectFileSlug dan projectFileName menghasilkan nama file .json aman dari nama proyek', () => {
    expect(projectFileSlug('Kantor Lt. 2 – Ducting')).toBe('kantor-lt-2-ducting')
    expect(projectFileName('Gudang #1 / Barat')).toBe('gudang-1-barat.json')
    expect(projectFileName('   ')).toBe('proyek-temandor.json')
  })
})
