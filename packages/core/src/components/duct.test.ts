import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  COMPONENTS,
  ELBOW_ANGLE_CHIPS,
  ELBOW_ANGLE_RANGE,
  ELBOW_RADIUS_RATIOS,
  clampElbowAngle,
  connect,
  createNode,
  ctxOf,
  newProject,
  nodeGrips,
  nodeSVG,
  worldPorts,
  worldPrims,
  type Node,
  type NodeType,
  type Unit,
} from '../index'

const DUCT_TYPES = [
  'straight',
  'flex',
  'elbow',
  'transition',
  'tee',
  'takeoff',
  'endcap',
  'damper',
  'accessdoor',
] as const satisfies readonly NodeType[]

function loadPrototypeVm() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'render.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return {
    worldPorts(node: Node, unit: Unit) {
      return vm.runInContext(
        `JSON.parse(JSON.stringify(worldPorts(${JSON.stringify(node)}, ${JSON.stringify(unit)}).map(p => ({ id: p.id, pos: p.pos, wdir: p.wdir, w: p.w, h: p.h, shape: p.shape, keys: p.keys ?? null }))))`,
        ctx,
      ) as Array<{ id: string, pos: [number, number], wdir: number, w?: number, h?: number, shape?: string, keys: [string, string] | null }>
    },
    nodeSVG(node: Node, unit: Unit, pal: 'screen' | 'paper' | 'light') {
      const p = newProject({ unit, scale: '1:100' })
      p.nodes = [node]
      return vm.runInContext(
        `(() => { const p = ${JSON.stringify(p)}; const c = ctxOf(p, connect(p)); return JSON.stringify(nodeSVG(p.nodes[0], c, { pal: ${JSON.stringify(pal)}, sw: 1.4, live: true })); })()`,
        ctx,
      ) as string
    },
  }
}

describe('registry komponen & fitting duct parametrik (M3-01)', () => {
  const proto = loadPrototypeVm()

  it('setiap dari 9 komponen duct/fitting memiliki definisi lengkap (name, icon, duct, ports, prims, grips)', () => {
    for (const type of DUCT_TYPES) {
      const def = COMPONENTS[type]
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.icon).toBeTruthy()
      expect(def.duct).toBe(true)
      expect(typeof def.ports).toBe('function')
      expect(typeof def.prims).toBe('function')
      expect(typeof def.grips).toBe('function')

      const sample = createNode(type)
      expect(worldPorts(sample, 'inch').length).toBeGreaterThanOrEqual(1)
      expect(nodeGrips(sample, 'inch').length).toBeGreaterThanOrEqual(1)
    }

    // Fitting asimetris mendukung mirror
    expect(COMPONENTS.elbow.mirror).toBe(true)
    expect(COMPONENTS.tee.mirror).toBe(true)
    expect(COMPONENTS.takeoff.mirror).toBe(true)
  })

  it('posisi & arah port tiap jenis identik dengan prototype setelah rotasi dan cermin (inch & mm)', () => {
    const cases: Array<{ rot: number, mir: boolean, unit: Unit }> = [
      { rot: 0, mir: false, unit: 'inch' },
      { rot: 90, mir: false, unit: 'inch' },
      { rot: 35, mir: true, unit: 'inch' },
      { rot: -45, mir: true, unit: 'mm' },
      { rot: 180, mir: true, unit: 'mm' },
    ]

    for (const type of DUCT_TYPES) {
      for (const { rot, mir, unit } of cases) {
        const sizeOverrides = unit === 'mm'
          ? (type === 'transition'
              ? { w: 600, h: 500, w2: 450, h2: 350 }
              : type === 'tee' || type === 'takeoff'
                ? { w: 600, h: 500, bw: 300, bh: 250 }
                : { w: 600, h: 500 })
          : {}
        const node = createNode(type, { x: 250, y: -180, rot, mir, ...sizeOverrides } as never)
        const ours = worldPorts(node, unit).map(p => ({
          id: p.id,
          pos: p.pos,
          wdir: p.wdir,
          w: p.w,
          h: p.h,
          shape: p.shape,
          keys: p.keys ?? null,
        }))
        const theirs = proto.worldPorts(node, unit)

        expect(ours).toHaveLength(theirs.length)
        for (let i = 0; i < ours.length; i++) {
          expect(ours[i]!.id).toBe(theirs[i]!.id)
          expect(ours[i]!.pos[0]).toBeCloseTo(theirs[i]!.pos[0], 6)
          expect(ours[i]!.pos[1]).toBeCloseTo(theirs[i]!.pos[1], 6)
          expect(ours[i]!.wdir).toBeCloseTo(theirs[i]!.wdir, 6)
          expect(ours[i]!.w).toBe(theirs[i]!.w)
          expect(ours[i]!.h).toBe(theirs[i]!.h)
          expect(ours[i]!.keys).toEqual(theirs[i]!.keys)
        }
      }
    }
  })

  it('elbow parametrik: sudut 5..150° & chip, reducing, radius 1.0/1.5×W (ARC asli), siku + vane, serta cermin', () => {
    expect(ELBOW_ANGLE_RANGE).toEqual({ min: 5, max: 150 })
    expect(ELBOW_ANGLE_CHIPS).toEqual([90, 60, 45, 30, 22.5, 15])
    expect(ELBOW_RADIUS_RATIOS).toEqual(['1', '1.5'])
    expect(clampElbowAngle(2)).toBe(5)
    expect(clampElbowAngle(170)).toBe(150)
    expect(clampElbowAngle(35)).toBe(35)

    const p = newProject({ unit: 'inch', scale: '1:100' })
    const ctx = ctxOf(p, connect(p))

    // 1. Sama lebar radius -> 2 ARC asli (bukan polyline dinding)
    for (const angle of [5, ...ELBOW_ANGLE_CHIPS, 35, 150]) {
      for (const rr of ELBOW_RADIUS_RATIOS) {
        const el = createNode('elbow', { angle, rr, et: 'r', w2: null, h2: null })
        const prims = worldPrims(el, ctx)
        expect(prims.filter(q => q.k === 'arc')).toHaveLength(2)
        expect(prims.filter(q => q.k === 'pl')).toHaveLength(0)

        // Port b arah tepat = angle
        const pb = worldPorts(el, 'inch')[1]!
        expect(pb.wdir).toBeCloseTo(angle, 6)
      }
    }

    // 2. Reducing elbow -> port b memakai keys ['w2', 'h2'] dan dinding berupa 2 polyline mulus
    const red = createNode('elbow', { w: 24, h: 20, w2: 18, h2: 14, angle: 90, et: 'r' })
    const redPorts = worldPorts(red, 'inch')
    expect(redPorts[1]?.w).toBe(18)
    expect(redPorts[1]?.h).toBe(14)
    expect(redPorts[1]?.keys).toEqual(['w2', 'h2'])
    expect(worldPrims(red, ctx).filter(q => q.k === 'pl')).toHaveLength(2)

    // 3. Siku + vane -> >= 2 busur sudu pengarah (vane)
    const sq = createNode('elbow', { angle: 90, et: 'sq', w: 24, h: 20 })
    expect(worldPrims(sq, ctx).filter(q => q.k === 'arc').length).toBeGreaterThanOrEqual(2)

    // 4. Cermin elbow pada rot 90°: port a tetap di tempat, port b berpindah ke sisi seberang
    const base = createNode('elbow', { x: 10, y: 20, rot: 90, mir: false })
    const mirrored = createNode('elbow', { x: 10, y: 20, rot: 90, mir: true })
    const [a0, b0] = worldPorts(base, 'mm')
    const [a1, b1] = worldPorts(mirrored, 'mm')
    expect(a0!.pos[0]).toBeCloseTo(a1!.pos[0], 6)
    expect(a0!.pos[1]).toBeCloseTo(a1!.pos[1], 6)
    expect(Math.round(b0!.pos[0] + b1!.pos[0])).toBe(20)
  })

  it('render SVG (nodeSVG) tiap jenis duct/fitting & variasi elbow 100% identik dengan prototype', () => {
    const samples: Node[] = [
      ...DUCT_TYPES.map(t => createNode(t, { x: 100, y: 200, rot: 30, mir: false } as never)),
      createNode('elbow', { x: 100, y: 200, angle: 45, rr: '1.5', rot: 90, mir: true }),
      createNode('elbow', { x: 100, y: 200, angle: 60, w2: 16, h2: 12, rot: 0, mir: false }),
      createNode('elbow', { x: 100, y: 200, angle: 90, et: 'sq', rot: 15, mir: true }),
      createNode('tee', { x: 300, y: 400, rot: 90, mir: true }),
      createNode('takeoff', { x: 300, y: 400, rot: 45, mir: true }),
    ]

    for (const pal of ['screen', 'paper', 'light'] as const) {
      for (const node of samples) {
        const p = newProject({ unit: 'inch', scale: '1:100' })
        p.nodes = [node]
        const ctx = ctxOf(p, connect(p))
        const ours = JSON.stringify(nodeSVG(node, ctx, { pal, sw: 1.4, live: true }))
        const theirs = proto.nodeSVG(node, 'inch', pal)
        expect(ours).toBe(theirs)
      }
    }
  })
})
