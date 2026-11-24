import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  applyGripDblClick,
  applyHostedSnap,
  connect,
  createNode,
  ctxOf,
  hostAt,
  mirrorSelectedInPlace,
  newProject,
  nodeSVG,
  partitionFromPoints,
  rotateSelectedInPlace,
  syncHosts,
  translateSelectedInPlace,
  worldPrims,
  type DoorNode,
  type Node,
  type Project,
  type RoomNode,
} from './index'

function loadPrototypeVm() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'render.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return {
    projectNodeSVG(project: Project, nodeIndex: number, pal: 'screen' | 'paper' | 'light') {
      return vm.runInContext(
        `(() => { const p = ${JSON.stringify(project)}; const c = ctxOf(p, connect(p)); return JSON.stringify(nodeSVG(p.nodes[${nodeIndex}], c, { pal: ${JSON.stringify(pal)}, sw: 1.4, live: true })); })()`,
        ctx,
      ) as string
    },
  }
}

describe('arsitektur: host dinding, syncHosts, partisi, dan paritas render (M3-06)', () => {
  const proto = loadPrototypeVm()

  it('pintu menempel ke dinding, memotong garis dinding, dan ikut saat ruangan digeser/ditambah titik (port test.js 4d)', () => {
    const p = newProject({ unit: 'mm' })
    const r = p.nodes[0] as RoomNode
    r.x = 1000
    r.y = 1000

    const d = createNode('door')
    d.host = hostAt(d, [3000, 1075], [r], 500) ?? undefined
    expect(d.host).toBeDefined()
    p.nodes.push(d)

    // 1. Posisi & potongan dinding awal
    const c1 = ctxOf(p, connect(p))
    expect([d.x, d.y, d.rot, d.mir, d.host?.s]).toEqual([2550, 1000, 0, false, 1550])
    expect(c1.cuts[r.id]?.[0]).toEqual([[1550, 2450]])

    // 2. Ruangan digeser +500 mm -> pintu ikut bergeser ke x=3050
    r.x += 500
    ctxOf(p, connect(p))
    expect(d.x).toBe(3050)

    // 3. Tambah titik di tengah sisi atas ruangan (x=3000 lokal) -> pintu tetap di tempatnya (3050, 1000) pada sisi e=0
    const reshaped = applyGripDblClick(r, 'e0') as RoomNode
    p.nodes[0] = reshaped
    const c3 = ctxOf(p, connect(p))
    expect([Math.round(d.x), Math.round(d.y)]).toEqual([3050, 1000])
    expect(d.host?.e).toBe(0)
    expect(d.host?.n).toBe(5)
    expect(worldPrims(reshaped, c3).filter(q => q.k === 'l').length).toBeGreaterThanOrEqual(12)

    // 4. Menghapus ruangan induk melepas host tanpa crash
    p.nodes = [d]
    syncHosts(p)
    expect(d.host).toBeUndefined()
  })

  it('pintu menempel dinding: R balik arah buka, M balik engsel, seret geser di dinding & lepas bila jauh', () => {
    const p = newProject({ unit: 'mm' })
    const r = p.nodes[0] as RoomNode
    const d = applyHostedSnap(createNode('door'), [2500, 50], [2500, 50], [r], 500)
    expect(d.host?.id).toBe(r.id)
    p.nodes.push(d)

    const ids = new Set([d.id])
    const ctx = ctxOf(p, connect(p))

    // R pada pintu menempel dinding -> balik swing (in <-> out)
    expect(d.swing).toBe('in')
    rotateSelectedInPlace(p, ids, 90, 100, ctx)
    expect((p.nodes[1] as DoorNode).swing).toBe('out')

    // M pada pintu menempel dinding -> balik engsel (l <-> r)
    expect(d.hinge).toBe('l')
    mirrorSelectedInPlace(p, ids, ctx)
    expect((p.nodes[1] as DoorNode).hinge).toBe('r')

    // Seret sepanjang dinding +600 mm -> tetap menempel, s bergeser +600 mm
    const prevS = (p.nodes[1] as DoorNode).host!.s
    translateSelectedInPlace(p, ids, 600, 0, { rawDx: 600, rawDy: 0, toleranceMm: 400 })
    expect((p.nodes[1] as DoorNode).host?.id).toBe(r.id)
    expect((p.nodes[1] as DoorNode).host?.s).toBe(prevS + 600)

    // Seret jauh ke tengah ruangan (+2000 mm ke bawah) -> lepas dari dinding
    translateSelectedInPlace(p, ids, 0, 2000, { rawDx: 0, rawDy: 2000, toleranceMm: 400 })
    expect((p.nodes[1] as DoorNode).host).toBeUndefined()
  })

  it('partitionFromPoints menolak segmen < 100 mm dan membuat partisi tepat untuk >= 100 mm', () => {
    expect(partitionFromPoints([0, 0], [80, 0])).toBeNull()
    const wall = partitionFromPoints([1000, 500], [1000, 3500])!
    expect(wall.type).toBe('partition')
    expect([wall.x, wall.y, wall.L, wall.rot]).toEqual([1000, 500, 3000, 90])
  })

  it('render SVG semua 10 jenis komponen arsitektur & variasi (termasuk dinding terpotong pintu) 100% identik dengan prototype', () => {
    // 1. Komponen arsitektur mandiri
    const standalone: Node[] = [
      createNode('column', { x: 400, y: 400, shape: 'rect', cw: 500, cd: 400 }),
      createNode('column', { x: 400, y: 400, shape: 'round', cw: 450, cd: 450 }),
      createNode('door', { x: 200, y: 200, kind: 'single', swing: 'in', hinge: 'l' }),
      createNode('door', { x: 200, y: 200, kind: 'single', swing: 'out', hinge: 'r' }),
      createNode('door', { x: 200, y: 200, kind: 'double', swing: 'in' }),
      createNode('door', { x: 200, y: 200, kind: 'sliding' }),
      createNode('win', { x: 200, y: 200, dw: 1500 }),
      createNode('opening', { x: 200, y: 200, dw: 1200 }),
      createNode('partition', { x: 100, y: 300, L: 2800, rot: 90 }),
      createNode('shaft', { x: 500, y: 500, sw: 900, sd: 700 }),
      createNode('beam', { x: 0, y: 0, L: 4500, bw: 350, be: 2900 }),
      createNode('stair', { x: 0, y: 0, skind: 'straight', sl: 3000, sw: 1200, tr: 250 }),
      createNode('stair', { x: 0, y: 0, skind: 'L', sl: 2500, sw: 1100, tr: 250 }),
      createNode('lift', { x: 500, y: 500, sw: 2200, sd: 2000 }),
      createNode('ceiling', { x: 500, y: 500, ch: 2750 }),
    ]

    for (const pal of ['screen', 'paper', 'light'] as const) {
      for (const node of standalone) {
        const p = newProject({ unit: 'mm', scale: '1:100' })
        p.nodes = [node]
        const ctx = ctxOf(p, connect(p))
        const ours = JSON.stringify(nodeSVG(node, ctx, { pal, sw: 1.4, live: true }))
        expect(ours).toBe(proto.projectNodeSVG(p, 0, pal))
      }
    }

    // 2. Ruangan dengan pintu + jendela + bukaan yang memotong dinding (gapLines)
    const hostedProj = newProject({ unit: 'mm', scale: '1:100' })
    const room = hostedProj.nodes[0] as RoomNode
    const door = applyHostedSnap(createNode('door', { kind: 'double' }), [1500, 50], [1500, 50], [room], 500)
    const win = applyHostedSnap(createNode('win'), [4200, 50], [4200, 50], [room], 500)
    const opening = applyHostedSnap(createNode('opening'), [5950, 2000], [5950, 2000], [room], 500)
    hostedProj.nodes.push(door, win, opening)

    for (const pal of ['screen', 'paper', 'light'] as const) {
      const ctx = ctxOf(hostedProj, connect(hostedProj))
      for (let i = 0; i < hostedProj.nodes.length; i++) {
        const ours = JSON.stringify(nodeSVG(hostedProj.nodes[i]!, ctx, { pal, sw: 1.4, live: true }))
        expect(ours).toBe(proto.projectNodeSVG(hostedProj, i, pal))
      }
    }
  })
})
