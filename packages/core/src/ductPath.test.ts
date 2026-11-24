import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  connect,
  defaultDuctSpec,
  ductPointByLength,
  ductTargetPoint,
  newProject,
  parseProject,
  pathNodes,
  stepFreeDuctCorner,
  type DuctSpec,
  type ElbowNode,
  type Point,
  type StraightNode,
  type Unit,
} from './index'

function loadPrototypePathNodes() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return (pts: readonly Point[], spec: DuctSpec, unit: Unit) => {
    return vm.runInContext(
      `JSON.parse(JSON.stringify(pathNodes(${JSON.stringify(pts)}, ${JSON.stringify(spec)}, ${JSON.stringify(unit)})))`,
      ctx,
    ) as Array<Record<string, unknown>>
  }
}

describe('jalur duct dengan elbow otomatis (M3-03)', () => {
  const protoPathNodes = loadPrototypePathNodes()

  it('jalur 3 titik belok kanan & kiri menghasilkan 2 straight + 1 elbow tersambung (port test.js prototype)', () => {
    const spec: DuctSpec = { w: 24, h: 20, shape: 'rect', sys: 'SA' }
    const R = 24 * 25.4 // 609.6 mm

    for (const [y, mir] of [[2000, false], [-2000, true]] as const) {
      const p = newProject({ unit: 'inch' })
      const nodes = pathNodes([[0, 0], [3000, 0], [3000, y]], spec, 'inch')
      p.nodes = nodes

      expect(nodes.map(n => n.type)).toEqual(['straight', 'elbow', 'straight'])

      const s1 = nodes[0] as StraightNode
      const el = nodes[1] as ElbowNode
      const s2 = nodes[2] as StraightNode

      expect(s1.w).toBe(24)
      expect(s1.h).toBe(20)
      expect(s1.L).toBeCloseTo(3000 - R, 1)
      expect(el.w).toBe(24)
      expect(el.h).toBe(20)
      expect(el.angle).toBe(90)
      expect(el.mir).toBe(mir)
      expect(s2.w).toBe(24)
      expect(s2.h).toBe(20)
      expect(s2.L).toBeCloseTo(2000 - R, 1)

      const cn = connect(p)
      expect(cn.open).toHaveLength(2)
      const ends = cn.open.map(a => a.pos.map(Math.round).join(',')).sort()
      expect(ends).toEqual(['0,0', `3000,${y}`].sort())

      // Valid menurut schema proyek v2
      expect(() => parseProject(p)).not.toThrow()
    }
  })

  it('mendukung sudut belok bebas (45°, 35°, 120°), jalur multi-belokan (Z), dan paritas prototype (inch & mm)', () => {
    const cases: Array<{ pts: Point[], spec: DuctSpec, unit: Unit, expectedAngles: number[] }> = [
      {
        pts: [[0, 0], [3000, 0], [5000, 2000]],
        spec: defaultDuctSpec('inch'),
        unit: 'inch',
        expectedAngles: [45],
      },
      {
        pts: [[0, 0], [4000, 0], [4000 + 3000 * Math.cos(35 * Math.PI / 180), -3000 * Math.sin(35 * Math.PI / 180)]],
        spec: defaultDuctSpec('mm'),
        unit: 'mm',
        expectedAngles: [35],
      },
      {
        pts: [[0, 0], [3000, 0], [1500, 2598.076211]],
        spec: { w: 400, h: 300, shape: 'rect', sys: 'EA', elev: 2800 },
        unit: 'mm',
        expectedAngles: [120],
      },
      {
        pts: [[0, 0], [3000, 0], [3000, 2500], [6000, 2500]],
        spec: { w: 20, h: 16, shape: 'rect', sys: 'SA', elev: 2700 },
        unit: 'inch',
        expectedAngles: [90, 90],
      },
    ]

    for (const c of cases) {
      const ours = pathNodes(c.pts, c.spec, c.unit)
      const theirs = protoPathNodes(c.pts, c.spec, c.unit)

      expect(ours).toHaveLength(theirs.length)
      const elbows = ours.filter((n): n is ElbowNode => n.type === 'elbow')
      expect(elbows.map(e => Math.round(e.angle))).toEqual(c.expectedAngles)

      for (let i = 0; i < ours.length; i++) {
        const a = ours[i]!
        const b = theirs[i]!
        expect(a.type).toBe(b.type)
        expect(a.x).toBeCloseTo(Number(b.x), 6)
        expect(a.y).toBeCloseTo(Number(b.y), 6)
        expect(a.rot).toBeCloseTo(Number(b.rot), 6)
        expect(a.mir).toBe(Boolean(b.mir))
        if (a.type === 'straight') {
          expect(a.L).toBeCloseTo(Number(b.L), 6)
        }
        else {
          expect(a.angle).toBeCloseTo(Number(b.angle), 6)
        }
      }

      const p = newProject({ unit: c.unit })
      p.nodes = ours
      const cn = connect(p)
      expect(cn.open).toHaveLength(2)
      expect(() => parseProject(p)).not.toThrow()
    }
  })

  it('menghapus titik duplikat/segaris dan tetap aman pada input pendek atau balik arah 180°', () => {
    const spec = defaultDuctSpec('mm')

    // Kurang dari 2 titik valid -> kosong
    expect(pathNodes([], spec, 'mm')).toEqual([])
    expect(pathNodes([[100, 100]], spec, 'mm')).toEqual([])
    expect(pathNodes([[100, 100], [100.4, 100.3]], spec, 'mm')).toEqual([])

    // Titik segaris digabung menjadi 1 duct lurus tanpa elbow
    const straight = pathNodes([[0, 0], [1000, 0], [2500, 0]], spec, 'mm')
    expect(straight).toHaveLength(1)
    expect(straight[0]?.type).toBe('straight')
    expect((straight[0] as StraightNode).L).toBe(2500)

    // Balik arah tepat 180° tidak menghasilkan Infinity/NaN dan tetap valid di schema
    const uTurn = pathNodes([[0, 0], [2000, 0], [0, 0]], spec, 'mm')
    const p = newProject({ unit: 'mm' })
    p.nodes = uTurn
    expect(() => parseProject(p)).not.toThrow()
  })

  it('helper interaksi duct: ductTargetPoint, ductPointByLength, dan stepFreeDuctCorner', () => {
    // Ortho aktif vs Shift (bebas) vs snap end
    expect(ductTargetPoint([[0, 0]], { p: [2000, 300], kind: 'grid' }, true, false)).toEqual([2000, 0])
    expect(ductTargetPoint([[0, 0]], { p: [2000, 300], kind: 'grid' }, true, true)).toEqual([2000, 300])
    expect(ductTargetPoint([[0, 0]], { p: [2000, 300], kind: 'end' }, true, false)).toEqual([2000, 300])

    // Input angka panjang mengikuti arah kursor atau segmen terakhir
    const p1 = ductPointByLength([[0, 0]], [500, 0], 3000)!
    expect(p1[0]).toBeCloseTo(3000, 6)
    expect(p1[1]).toBeCloseTo(0, 6)

    const p2 = ductPointByLength([[0, 0], [3000, 0]], [3000, 400], 2000)!
    expect(p2[0]).toBeCloseTo(3000, 6)
    expect(p2[1]).toBeCloseTo(2000, 6)

    // Panjang tak valid ditolak
    expect(ductPointByLength([], [100, 0], 1000)).toBeNull()
    expect(ductPointByLength([[0, 0]], [100, 0], 0)).toBeNull()
    expect(ductPointByLength([[0, 0]], [100, 0], -500)).toBeNull()

    // Deteksi belokan otomatis saat seret ORTHO
    const s1 = stepFreeDuctCorner([0, 0], [1000, 0], null, { pxPerMm: 0.1, snapEnabled: true, gridStep: 100 })
    expect(s1).toEqual({ nextAxis: 'x', corner: null })
    const s2 = stepFreeDuctCorner([0, 0], [1520, 400], 'x', { pxPerMm: 0.1, snapEnabled: true, gridStep: 100 })
    expect(s2).toEqual({ nextAxis: 'y', corner: [1500, 0] })
  })
})
