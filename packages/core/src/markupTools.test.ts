import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  connect,
  createNode,
  ctxOf,
  dimFromPoints,
  layerOf,
  newProject,
  nodeSVG,
  nodeSchema,
  rotP,
  sketchFromWorldPoints,
  textFromPreset,
  worldPrims,
  type ArrowPrim,
  type Node,
  type Project,
} from './index'

function loadPrototypeVm() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'render.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return {
    nodeSVG(project: Project, pal: 'screen' | 'paper' | 'light') {
      return vm.runInContext(
        `(() => { const p = ${JSON.stringify(project)}; const c = ctxOf(p, connect(p)); return JSON.stringify(nodeSVG(p.nodes[0], c, { pal: ${JSON.stringify(pal)}, sw: 1.4, live: true })); })()`,
        ctx,
      ) as string
    },
  }
}

describe('ukur, teks, catatan + panah, dan coretan tangan (M3-07)', () => {
  const proto = loadPrototypeVm()

  it('dimFromPoints, textFromPreset, dan sketchFromWorldPoints menghasilkan node valid & panjang tepat', () => {
    expect(dimFromPoints([0, 0], [0.5, 0], null, 180)).toBeNull()
    const d1 = dimFromPoints([1000, 1000], [4000, 1000], [2500, 400], 180)!
    expect(d1.L).toBe(3000)
    expect(d1.rot).toBe(0)
    expect(d1.off).toBe(-600)
    expect(() => nodeSchema.parse(d1)).not.toThrow()

    const p = newProject({ unit: 'mm', scale: '1:100' })
    const ctx = ctxOf(p, connect(p))
    const dimPrimsOut = worldPrims(d1, ctx)
    const dimText = dimPrimsOut.find(q => q.k === 't')
    expect(dimText && dimText.k === 't' ? dimText.s : '').toBe('3000')

    // Preset teks
    const h = textFromPreset([500, 600], 'heading')
    const sub = textFromPreset([500, 600], 'subheading')
    const body = textFromPreset([500, 600], 'body')
    expect([h.tz, h.b, h.s]).toEqual(['2.2', true, 'Judul'])
    expect([sub.tz, sub.s]).toEqual(['1.5', 'Subjudul'])
    expect([body.tz, body.s]).toEqual(['1', 'Teks'])
    for (const n of [h, sub, body]) expect(() => nodeSchema.parse(n)).not.toThrow()

    // Coretan tangan di layer coret (MARKUP)
    expect(sketchFromWorldPoints([[10, 20]])).toBeNull()
    expect(sketchFromWorldPoints([[10, 20], [10.1, 20.1]])).toBeNull()
    const sk = sketchFromWorldPoints([[100, 200], [350, 220], [600, 400]])!
    expect(layerOf(sk)).toBe('coret')
    expect([sk.x, sk.y]).toEqual([100, 200])
    expect(sk.pts).toEqual([[0, 0], [250, 20], [500, 200]])
    expect(() => nodeSchema.parse(sk)).not.toThrow()
  })

  it('ujung panah catatan tepat di titik yang ditunjuk dan render SVG 100% identik dengan prototype', () => {
    const p = newProject({ unit: 'mm', scale: '1:100' })
    const ctx = ctxOf(p, connect(p))

    // Port test 7b: ujung panah catatan tepat di (100, 200)
    const note = createNode('note', { x: 100, y: 200, s: 'Cek elevasi plafon' })
    const ar = worldPrims(note, ctx).find((q): q is ArrowPrim => q.k === 'arrow')!
    const tip = rotP([ar.h / 2, 0], ar.dir)
    expect(ar.p[0] + tip[0]).toBeCloseTo(100, 1)
    expect(ar.p[1] + tip[1]).toBeCloseTo(200, 1)

    const samples: Node[] = [
      createNode('dim', { x: 0, y: 0, L: 3000, off: -500 }),
      createNode('dim', { x: 200, y: 300, L: 2450, rot: 45, off: 400 }),
      createNode('text', { x: 400, y: 500, s: 'Judul Proyek', tz: '2.2', b: true, col: 'biru', al: 'middle', bx: true }),
      createNode('text', { x: 400, y: 500, s: 'Revisi lapangan', tz: '1', it: true, ul: true, col: 'merah', al: 'end' }),
      note,
      createNode('note', { x: 500, y: 600, tx: -1100, ty: 700, s: 'Arah kiri', col: 'hijau', bx: false }),
      createNode('sketch', { x: 100, y: 200, pts: [[0, 0], [300, 100], [600, -50], [900, 150]] }),
    ]

    for (const pal of ['screen', 'paper', 'light'] as const) {
      for (const node of samples) {
        const proj = newProject({ unit: 'mm', scale: '1:100' })
        proj.nodes = [node]
        const c = ctxOf(proj, connect(proj))
        const ours = JSON.stringify(nodeSVG(node, c, { pal, sw: 1.4, live: true }))
        expect(ours).toBe(proto.nodeSVG(proj, pal))
      }
    }
  })
})
