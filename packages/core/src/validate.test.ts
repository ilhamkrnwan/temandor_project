import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  connect,
  createNode,
  ctxOf,
  demoProject,
  newProject,
  validate,
  worldPorts,
  zoomViewBoxToPoint,
  type ViewBox,
} from './index'

function loadPrototypeDemoWarnings(): string[] {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  const raw = vm.runInContext(
    `JSON.stringify((() => {
      const p = demoProject();
      return validate(p, connect(p)).map(w => w.kind).sort();
    })())`,
    ctx,
  ) as string
  return JSON.parse(raw) as string[]
}

describe('validasi jaringan ducting & warning (M3-09)', () => {
  it('demoProject() hanya memunculkan 2 warning yang disengaja (open + size) identik dengan prototype (port test.js #2)', () => {
    const demo = demoProject()
    const cn = connect(demo)
    const warnings = validate(demo, cn)
    const kinds = warnings.map(w => w.kind).sort()

    expect(kinds).toEqual(['open', 'size'])
    expect(kinds).toEqual(loadPrototypeDemoWarnings())

    const openWarn = warnings.find(w => w.kind === 'open')!
    const sizeWarn = warnings.find(w => w.kind === 'size')!
    expect(openWarn.msg).toBe('Ujung terbuka')
    expect(openWarn.detail).toContain('end cap')
    expect(sizeWarn.msg).toBe('Ukuran beda tanpa transisi')
    expect(sizeWarn.detail).toContain('Tambah transisi')
  })

  it('ujung terbuka terdeteksi dan hilang setelah ditutup end cap, sedangkan port opsional tidak diperingatkan', () => {
    const p = newProject({ unit: 'mm' })
    const fcu = createNode('fcu', { x: 1000, y: 1000, L: 1200, B: 700, w: 400, h: 300 })
    const duct = createNode('straight', { x: 1600, y: 1000, L: 1500, w: 400, h: 300 })
    p.nodes = [fcu, duct]

    // Port supply FCU tersambung ke duct; port return FCU opsional (tidak jadi warning); hanya ujung b duct terbuka.
    const wBefore = validate(p)
    expect(wBefore.map(w => w.kind)).toEqual(['open'])
    expect(wBefore[0]!.id).toBe(duct.id)

    // Pasang end cap pada ujung b duct -> semua ujung wajib tertutup.
    const cap = createNode('endcap', { x: 3100, y: 1000, w: 400, h: 300 })
    p.nodes.push(cap)
    expect(validate(p)).toEqual([])
  })

  it('ukuran beda tanpa transisi dan beda bentuk terdeteksi, sedangkan elbow reducing tidak memicu warning ukuran', () => {
    // 1) Duct 18x14 langsung ke 14x12 -> warning size
    const pMismatch = newProject({ unit: 'inch' })
    const a = createNode('straight', { x: 0, y: 0, L: 1000, w: 18, h: 14 })
    const b = createNode('straight', { x: 1000, y: 0, L: 1000, w: 14, h: 12 })
    const capA = createNode('endcap', { x: 0, y: 0, rot: 180, w: 18, h: 14 })
    const capB = createNode('endcap', { x: 2000, y: 0, w: 14, h: 12 })
    pMismatch.nodes = [capA, a, b, capB]

    const sizeWarns = validate(pMismatch)
    expect(sizeWarns.map(w => w.kind)).toEqual(['size'])
    expect(sizeWarns[0]!.detail).toContain('18"x14"')
    expect(sizeWarns[0]!.detail).toContain('14"x12"')

    // 2) Duct kotak ke bulat dengan lebar sama -> tetap warning size karena beda bentuk
    const pShape = newProject({ unit: 'mm' })
    const rectDuct = createNode('straight', { x: 0, y: 0, L: 1000, w: 400, h: 400, shape: 'rect' })
    const roundDuct = createNode('straight', { x: 1000, y: 0, L: 1000, w: 400, h: 400, shape: 'round' })
    pShape.nodes = [rectDuct, roundDuct]
    expect(validate(pShape).filter(w => w.kind === 'size')).toHaveLength(1)

    // 3) Elbow reducing 24x20 -> 18x14 tersambung ke duct 18x14 -> 0 warning size (port test.js #7b)
    const pRed = newProject({ unit: 'inch' })
    const elbowRed = createNode('elbow', { x: 0, y: 0, w: 24, h: 20, w2: 18, h2: 14 })
    const portB = worldPorts(elbowRed, 'inch').find(q => q.id === 'b')!
    const ductAfter = createNode('straight', {
      x: portB.pos[0],
      y: portB.pos[1],
      rot: portB.wdir,
      L: 1000,
      w: 18,
      h: 14,
    })
    pRed.nodes = [elbowRed, ductAfter]
    expect(validate(pRed).filter(w => w.kind === 'size')).toHaveLength(0)
  })

  it('sistem SA tersambung ke EA memunculkan warning sys', () => {
    const p = newProject({ unit: 'mm' })
    const sa = createNode('straight', { x: 0, y: 0, L: 1000, w: 300, h: 300, sys: 'SA' })
    const ea = createNode('straight', { x: 1000, y: 0, L: 1000, w: 300, h: 300, sys: 'EA' })
    p.nodes = [sa, ea]

    const sysWarns = validate(p).filter(w => w.kind === 'sys')
    expect(sysWarns).toHaveLength(1)
    expect(sysWarns[0]!.msg).toBe('Sistem tercampur')
    expect(sysWarns[0]!.detail).toContain('SA')
    expect(sysWarns[0]!.detail).toContain('EA')
  })

  it('diffuser dan grille tanpa debit memunculkan warning flow, lalu hilang saat debit diisi', () => {
    const p = newProject({ unit: 'mm' })
    const diff = createNode('diffuser', { x: 1000, y: 1000, flow: 0, tag: 'SD-1' })
    const grille = createNode('grille', { x: 2500, y: 1000, flow: 0, tag: 'EG-1' })
    const louver = createNode('louver', { x: 4000, y: 1000, tag: 'LV-1' })
    p.nodes = [diff, grille, louver]

    const flowWarns = validate(p).filter(w => w.kind === 'flow')
    expect(flowWarns).toHaveLength(2)
    expect(flowWarns.map(w => w.id)).toEqual([diff.id, grille.id])
    expect(flowWarns[0]!.detail).toContain('SD-1')

    diff.flow = 300
    grille.flow = 200
    expect(validate(p).filter(w => w.kind === 'flow')).toHaveLength(0)
  })

  it('duct menabrak kolom/tangga/lift jadi warning clash; tembus dinding ruangan/partisi jadi kotak bobokan bukan warning (port test.js #4e)', () => {
    const p = newProject({ unit: 'inch' })
    const duct = createNode('straight', { x: -1000, y: 2000, L: 4000 })
    const col = createNode('column', { x: 1500, y: 2000 })
    p.nodes.push(duct, col)

    const cn = connect(p)
    const warnings = validate(p, cn)
    expect(warnings.map(w => w.kind)).toContain('clash')
    expect(ctxOf(p, cn).pen[duct.id]?.map(Math.round)).toEqual([1000])

    // Cek juga tabrakan terhadap tangga dan lift, serta bebas clash terhadap partisi.
    const pAll = newProject({ unit: 'mm' })
    const ductStair = createNode('straight', { x: 0, y: 1000, L: 3000, w: 400, h: 300 })
    const stair = createNode('stair', { x: 800, y: 600, sl: 2000, sw: 1200 })
    const ductLift = createNode('straight', { x: 0, y: 4000, L: 3000, w: 400, h: 300 })
    const lift = createNode('lift', { x: 1500, y: 4000, sw: 1800, sd: 1800 })
    const ductWallOnly = createNode('straight', { x: 5000, y: 2000, L: 2000, w: 400, h: 300 })
    const part = createNode('partition', { x: 5500, y: 1500, rot: 90, L: 1500 })
    pAll.nodes.push(ductStair, stair, ductLift, lift, ductWallOnly, part)

    const allWarns = validate(pAll)
    const clashes = allWarns.filter(w => w.kind === 'clash')
    expect(clashes).toHaveLength(2)
    expect(clashes.map(w => w.msg).sort()).toEqual(['Duct menabrak lift', 'Duct menabrak tangga'])
    expect(clashes.some(w => w.id === ductWallOnly.id)).toBe(false)
    // ductWallOnly menembus partisi (x=5500 -> lokal 500) dan dinding kanan ruangan (x=6000 -> lokal 1000)
    expect(ctxOf(pAll, connect(pAll)).pen[ductWallOnly.id]?.map(Math.round).sort((a, b) => a - b)).toEqual([500, 1000])
  })

  it('zoomViewBoxToPoint memusatkan viewport pada posisi warning dengan menjaga rasio aspek', () => {
    const vb: ViewBox = [0, 0, 16000, 8000]
    const next = zoomViewBoxToPoint(vb, [3500, 2200], 7000)
    expect(next).toEqual([0, 450, 7000, 3500])

    // Jika sudah lebih dekat dari 7000 mm, pertahankan lebar zoom saat ini.
    const closeVb: ViewBox = [0, 0, 4000, 2000]
    const nextClose = zoomViewBoxToPoint(closeVb, [3500, 2200], 7000)
    expect(nextClose).toEqual([1500, 1200, 4000, 2000])
  })
})
