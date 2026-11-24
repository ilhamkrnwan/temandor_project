import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  connect,
  countNodeHangers,
  countProjectHangers,
  createNode,
  ctxOf,
  demoProject,
  ductAnnotationSummary,
  equipmentFlowSummaries,
  flowTotals,
  newProject,
  nodeSVG,
  worldPrims,
  type ArrowPrim,
} from './index'

function loadPrototypeMetrics() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return vm.runInContext(
    `(() => {
      const p = demoProject();
      const cn = connect(p);
      const flows = flowTotals(p, cn);
      const eqFlows = p.nodes.filter(n => n.type === 'fcu' || n.type === 'fan').map(n => flows[n.id]);
      const hangRow = boq(p).find(r => r.item.includes('Gantungan'));
      return JSON.stringify({ eqFlows, hangers: hangRow ? hangRow.qty : 0 });
    })()`,
    ctx,
  ) as string
}

describe('anotasi otomatis: ukuran duct, panah aliran, gantungan 1,5 m, dan total debit FCU/fan (M3-08)', () => {
  it('demoProject() menghasilkan jumlah gantungan dan total debit FCU/fan identik dengan prototype', () => {
    const demo = demoProject()
    const cn = connect(demo)
    const ctx = ctxOf(demo, cn)
    const proto = JSON.parse(loadPrototypeMetrics()) as { eqFlows: number[], hangers: number }

    // Total debit FCU-01 = 1300 cfm, EF-01 = 150 cfm
    const summaries = equipmentFlowSummaries(demo, cn)
    expect(summaries.map(s => ({ tag: s.tag, flow: s.flow, fu: s.fu }))).toEqual([
      { tag: 'FCU-01', flow: 1300, fu: 'cfm' },
      { tag: 'EF-01', flow: 150, fu: 'cfm' },
    ])
    expect(summaries.map(s => s.flow)).toEqual(proto.eqFlows)

    // Label total debit tampil pada SVG FCU dan fan
    const fcu = demo.nodes.find(n => n.type === 'fcu')!
    const fan = demo.nodes.find(n => n.type === 'fan')!
    expect(nodeSVG(fcu, ctx, { pal: 'screen', sw: 1.4, live: true }).eq).toContain('FCU-01 · 1300 cfm')
    expect(nodeSVG(fan, ctx, { pal: 'screen', sw: 1.4, live: true }).eq).toContain('EF-01 · 150 cfm')

    // Jumlah titik gantungan tiap 1,5 m pada demoProject() = 14 titik (identik dengan BOQ prototype)
    expect(countProjectHangers(demo, ctx)).toBe(14)
    expect(countProjectHangers(demo, ctx)).toBe(proto.hangers)

    // Mematikan gantungan otomatis -> 0; memperrapat jarak ke 1000 mm -> lebih banyak gantungan
    demo.hang.on = false
    expect(countProjectHangers(demo)).toBe(0)

    demo.hang.on = true
    demo.hang.sp = 1000
    expect(countProjectHangers(demo)).toBeGreaterThan(14)
  })

  it('label ukuran duct, arah panah aliran (normal & flip), dan penyesuaian terhadap skala', () => {
    const rectInch = createNode('straight', { L: 2000, w: 24, h: 20, shape: 'rect', flip: false })
    expect(ductAnnotationSummary(rectInch, { unit: 'inch', th: 180 })).toEqual({
      sizeText: '24"x20"',
      hasArrow: true,
      arrowDir: 0,
    })

    const flipped = createNode('straight', { L: 2000, w: 24, h: 20, shape: 'rect', flip: true })
    expect(ductAnnotationSummary(flipped, { unit: 'inch', th: 180 }).arrowDir).toBe(180)
    const p = newProject({ unit: 'inch', scale: '1:100' })
    p.nodes = [flipped]
    const ar = worldPrims(flipped, ctxOf(p, connect(p))).find((q): q is ArrowPrim => q.k === 'arrow')!
    expect(Math.abs(ar.dir)).toBe(180)

    // Duct bulat dalam inch & mm
    const roundInch = createNode('straight', { L: 1800, w: 12, h: 12, shape: 'round' })
    expect(ductAnnotationSummary(roundInch, { unit: 'inch', th: 180 }).sizeText).toBe('Ø12"')
    const roundMm = createNode('straight', { L: 1800, w: 300, h: 300, shape: 'round' })
    expect(ductAnnotationSummary(roundMm, { unit: 'mm', th: 180 }).sizeText).toBe('Ø300')

    // Segmen terlalu pendek menyembunyikan teks/panah pada skala 1:100, namun tampil pada 1:50 (th = 90)
    const shortDuct = createNode('straight', { L: 500, w: 12, h: 10, shape: 'rect' })
    expect(ductAnnotationSummary(shortDuct, { unit: 'inch', th: 180 })).toEqual({
      sizeText: null,
      hasArrow: true,
      arrowDir: 0,
    })
    expect(ductAnnotationSummary(shortDuct, { unit: 'inch', th: 90 }).sizeText).toBe('12"x10"')

    // Gantungan tiap 1,5 m pada duct 4500 mm: 750, 2250, 3750 -> 3 titik
    const longDuct = createNode('straight', { L: 4500 })
    const pLong = newProject({ unit: 'mm' })
    pLong.nodes = [longDuct]
    expect(countNodeHangers(longDuct, ctxOf(pLong, connect(pLong)))).toBe(3)
  })

  it('total debit menghormati isolasi jaringan, satuan l/s, dan menandai bobokan dinding pada duct lurus', () => {
    const p = newProject({ unit: 'mm', fu: 'l/s' })
    const fcu = createNode('fcu', { x: 1000, y: 1000, L: 1200, B: 700, w: 400, h: 300, tag: 'AHU-01' })
    const duct = createNode('straight', { x: 1600, y: 1000, L: 2000, w: 400, h: 300 })
    const diffConnected = createNode('diffuser', { x: 3600, y: 1000, flow: 420 })
    const diffDetached = createNode('diffuser', { x: 5000, y: 3000, flow: 999 })
    // Duct yang menembus dinding kanan Ruangan 1 (x = 6000)
    const crossingDuct = createNode('straight', { x: 5000, y: 2000, L: 2000, w: 400, h: 300 })

    p.nodes.push(fcu, duct, diffConnected, diffDetached, crossingDuct)
    const cn = connect(p)
    const ctx = ctxOf(p, cn)

    expect(flowTotals(p, cn)[fcu.id]).toBe(420)
    expect(equipmentFlowSummaries(p, cn)).toEqual([
      { id: fcu.id, type: 'fcu', tag: 'AHU-01', flow: 420, fu: 'l/s' },
    ])
    expect(nodeSVG(fcu, ctx, { pal: 'screen', sw: 1.4, live: true }).eq).toContain('AHU-01 · 420 l/s')

    // Titik bobokan dinding pada crossingDuct tepat di x lokal = 1000 (6000 - 5000)
    expect(ctx.pen[crossingDuct.id]?.map(Math.round)).toEqual([1000])
  })
})
