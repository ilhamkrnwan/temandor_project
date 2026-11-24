import { nanoid } from 'nanoid'
import type {
  LayerKey,
  LayerMeta,
  LayersMap,
  NewProjectOptions,
  NodeBase,
  NodeOf,
  NodeType,
  Project,
  Unit,
} from './types'

export const LAYERS: readonly LayerMeta[] = [
  { key: 'sa', name: 'Supply Air (SA)', dxf: 'DUCT-SA', aci: 5 },
  { key: 'ea', name: 'Exhaust Air (EA)', dxf: 'DUCT-EA', aci: 6 },
  { key: 'eq', name: 'Equipment', dxf: 'EQUIPMENT', aci: 3 },
  { key: 'diff', name: 'Diffuser & grille', dxf: 'DIFFUSER', aci: 4 },
  { key: 'hanger', name: 'Gantungan', dxf: 'HANGER', aci: 8 },
  { key: 'dim', name: 'Dimensi & teks', dxf: 'DIMENSION', aci: 7 },
  { key: 'denah', name: 'Dinding & ruangan', dxf: 'A-WALL', aci: 8 },
  { key: 'kolom', name: 'Kolom', dxf: 'A-COLS', aci: 8 },
  { key: 'bukaan', name: 'Pintu, jendela, bukaan', dxf: 'A-DOOR', aci: 210 },
  { key: 'arsi', name: 'Tangga, lift, shaft, balok', dxf: 'A-MISC', aci: 9 },
  { key: 'coret', name: 'Coretan tangan', dxf: 'MARKUP', aci: 30 },
] as const

export const LAYER_KEYS: readonly LayerKey[] = LAYERS.map(layer => layer.key)

type NodeDefaultsMap = {
  [K in NodeType]: Omit<NodeOf<K>, keyof NodeBase | 'type'>
}

export const NODE_DEFAULTS: NodeDefaultsMap = {
  straight: { L: 1500, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700, flip: false },
  flex: { L: 1200, w: 8, h: 8, shape: 'round', sys: 'SA', elev: 2700 },
  elbow: { w: 24, h: 20, w2: null, h2: null, shape: 'rect', angle: 90, et: 'r', rr: '1', sys: 'SA', elev: 2700 },
  transition: { L: 300, w: 24, h: 20, w2: 18, h2: 14, shape: 'rect', sys: 'SA', elev: 2700 },
  tee: { w: 24, h: 20, bw: 12, bh: 10, shape: 'rect', sys: 'SA', elev: 2700 },
  takeoff: { w: 24, h: 20, bw: 12, bh: 10, shape: 'rect', sys: 'SA', elev: 2700 },
  endcap: { w: 24, h: 20, shape: 'rect', sys: 'SA' },
  damper: { L: 300, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700 },
  accessdoor: { L: 500, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700 },
  diffuser: { F: 600, flow: 0, tag: 'SD', sys: 'SA' },
  grille: { Fx: 400, Fy: 400, flow: 0, tag: 'EG', sys: 'EA' },
  louver: { F: 600, tag: 'LV', sys: 'EA' },
  fan: { L: 500, B: 450, tag: 'EF-01', sys: 'EA' },
  fcu: { L: 1200, B: 700, w: 24, h: 20, shape: 'rect', tag: 'FCU-01' },
  outdoor: { L: 900, B: 350, tag: 'ODU-01' },
  room: { W: 6000, H: 4000, t: 150, name: 'Ruangan', dims: true },
  dim: { L: 1000, off: -500 },
  column: { shape: 'rect', cw: 400, cd: 400 },
  door: { dw: 900, t: 150, kind: 'single', swing: 'in', hinge: 'l' },
  win: { dw: 1200, t: 150 },
  opening: { dw: 1000, t: 150 },
  partition: { L: 3000, t: 100 },
  shaft: { sw: 800, sd: 600 },
  beam: { L: 4000, bw: 300, be: 3000 },
  stair: { skind: 'straight', sl: 3000, sw: 1200, tr: 250 },
  lift: { sw: 2000, sd: 2000 },
  ceiling: { ch: 2800 },
  sketch: { pts: [[0, 0], [1000, 0]] },
  text: { s: 'Catatan', th: 0, tz: '1', col: '', al: 'start', b: false, it: false, ul: false, bx: false },
  note: { s: 'Cek di lapangan', tx: 1200, ty: -900, th: 0, tz: '1', col: 'merah', b: false, it: false, ul: false, bx: true },
}

export function createId(): string {
  return nanoid(10)
}

export function defaultLayers(): LayersMap {
  return {
    sa: { on: true, lock: false },
    ea: { on: true, lock: false },
    eq: { on: true, lock: false },
    diff: { on: true, lock: false },
    hanger: { on: true, lock: false },
    dim: { on: true, lock: false },
    denah: { on: true, lock: false },
    kolom: { on: true, lock: false },
    bukaan: { on: true, lock: false },
    arsi: { on: true, lock: false },
    coret: { on: true, lock: false },
  }
}

/** Lengkapi proyek lama yang mungkin belum memiliki semua kunci layer terbaru. */
export function withLayers(project: Project): Project {
  const defaults = defaultLayers()
  const next = { ...defaults }
  for (const key of LAYER_KEYS) {
    const existing = project.layers?.[key]
    if (existing) {
      next[key] = { on: Boolean(existing.on), lock: Boolean(existing.lock) }
    }
  }
  return { ...project, layers: next }
}

export function createNode<T extends NodeType>(
  type: T,
  overrides: Partial<Omit<NodeOf<T>, 'type'>> = {},
): NodeOf<T> {
  // TypeScript tidak mendistribusikan intersection generik `{ type: T } & NodeDefaultsMap[T]`
  // kembali ke discriminated union `NodeOf<T>`, meski `NODE_DEFAULTS` sudah dicek statis per tipe.
  return {
    id: createId(),
    type,
    x: 0,
    y: 0,
    rot: 0,
    mir: false,
    ...structuredClone(NODE_DEFAULTS[type]),
    ...overrides,
  } as unknown as NodeOf<T>
}

export function newProject(options: NewProjectOptions = {}): Project {
  const {
    id = createId(),
    name = 'Proyek baru',
    unit = 'inch',
    scale = '1:100',
    fu = 'cfm',
    W = 6000,
    H = 4000,
    updated = Date.now(),
  } = options

  return {
    version: 2,
    id,
    name,
    unit,
    scale,
    fu,
    updated,
    hang: { on: true, sp: 1500 },
    layers: defaultLayers(),
    nodes: [createNode('room', { W, H, name: 'Ruangan 1' })],
  }
}

function mmValue(value: number, unit: Unit): number {
  return unit === 'inch' ? value * 25.4 : value
}

/**
 * Proyek contoh "Contoh – Kantor Lt. 2" (acuan tes & demo, identik dengan prototype/app/js/model.js).
 * Sengaja menyertakan 1 ujung terbuka (cabang 45°) dan 1 perubahan ukuran tanpa transisi (18x14 → 14x12).
 */
export function demoProject(): Project {
  const project = newProject({
    name: 'Contoh – Kantor Lt. 2',
    unit: 'inch',
    scale: '1:100',
    W: 9000,
    H: 9000,
  })

  const u = project.unit
  const w24 = mmValue(24, u)
  const w18 = mmValue(18, u)
  const w12 = mmValue(12, u)
  const k = Math.SQRT1_2

  // Geometri persambungan (mengikuti rumus port di prototype/app/js/geom.js)
  const fcuX = 1400
  const fcuY = 1500
  const s1X = fcuX + 1200 / 2 // 2000
  const toX = s1X + 1200 // 3200
  const toX0 = 150 + w12 * k
  const toLb = w12 * k + 200
  const toLm = toX0 + w12 * k + 150
  const toCX = toX + toX0 + toLb * k
  const toCY = fcuY + w24 / 2 + toLb * k

  const s1bX = toX + toLm
  const t1X = s1bX + 1000
  const teeLm = w12 + 300
  const teeDrop24 = w24 / 2 + 150

  const b1X = t1X + teeLm / 2
  const b1Y = fcuY + teeDrop24
  const d1Y = b1Y + 1600

  const s2X = t1X + teeLm
  const t2X = s2X + 1500
  const b2X = t2X + teeLm / 2
  const b2Y = fcuY + teeDrop24
  const d2Y = b2Y + 1600

  const s3X = t2X + teeLm
  const trX = s3X + 800
  const s4X = trX + 300
  const e1X = s4X + 2400

  // Elbow radius rr='1' → R = W18, belok 90° ke bawah
  const s5X = e1X + w18
  const s5Y = fcuY + w18
  const t3Y = s5Y + 900
  // Tee rot=90 mir=true → cabang 'c' ke kanan (+X)
  const b3X = s5X + (w18 / 2 + 150)
  const b3Y = t3Y + teeLm / 2
  const d3X = b3X + 900

  const s6Y = t3Y + teeLm
  const s7Y = s6Y + 600
  const d4Y = s7Y + 500

  // Jalur Exhaust Air (EA)
  const lvX = 13850
  const lvY = 7200
  const fanX = lvX - 500
  const eaX = fanX - 700

  const mainRoom = project.nodes[0]
  if (mainRoom?.type === 'room') {
    mainRoom.name = 'Kantor'
  }

  project.nodes.push(
    createNode('room', { x: 8850, y: 0, W: 5150, H: 5650, name: 'R. Rapat', dims: false }),
    createNode('room', { x: 8850, y: 5500, W: 2650, H: 3500, name: 'Pantry', dims: false }),
    createNode('room', { x: 11350, y: 5500, W: 2650, H: 3500, name: 'Toilet', dims: false }),

    createNode('fcu', { x: fcuX, y: fcuY }),
    createNode('outdoor', { x: -800, y: fcuY, rot: 90 }),
    createNode('straight', { x: s1X, y: fcuY, L: 1200 }),
    createNode('takeoff', { x: toX, y: fcuY }),
    // Sengaja: ujung terbuka
    createNode('straight', { x: toCX, y: toCY, rot: 45, L: 700, w: 12, h: 10 }),
    createNode('straight', { x: s1bX, y: fcuY, L: 1000 }),
    createNode('tee', { x: t1X, y: fcuY }),
    createNode('straight', { x: b1X, y: b1Y, rot: 90, L: 1600, w: 12, h: 10 }),
    createNode('diffuser', { x: b1X, y: d1Y, rot: 90, flow: 350 }),
    createNode('straight', { x: s2X, y: fcuY, L: 1500 }),
    createNode('tee', { x: t2X, y: fcuY }),
    createNode('straight', { x: b2X, y: b2Y, rot: 90, L: 1600, w: 12, h: 10 }),
    createNode('diffuser', { x: b2X, y: d2Y, rot: 90, flow: 350 }),
    createNode('straight', { x: s3X, y: fcuY, L: 800 }),
    createNode('transition', { x: trX, y: fcuY }),
    createNode('straight', { x: s4X, y: fcuY, L: 2400, w: 18, h: 14 }),
    createNode('elbow', { x: e1X, y: fcuY, w: 18, h: 14 }),
    createNode('straight', { x: s5X, y: s5Y, rot: 90, L: 900, w: 18, h: 14 }),
    createNode('tee', { x: s5X, y: t3Y, rot: 90, mir: true, w: 18, h: 14 }),
    createNode('straight', { x: b3X, y: b3Y, rot: 0, L: 900, w: 12, h: 10 }),
    createNode('diffuser', { x: d3X, y: b3Y, rot: 0, flow: 300 }),
    createNode('straight', { x: s5X, y: s6Y, rot: 90, L: 600, w: 18, h: 14 }),
    // Sengaja: ukuran beda tanpa transisi (18x14 → 14x12)
    createNode('straight', { x: s5X, y: s7Y, rot: 90, L: 500, w: 14, h: 12 }),
    createNode('diffuser', { x: s5X, y: d4Y, rot: 90, flow: 300 }),

    createNode('louver', { x: lvX, y: lvY }),
    createNode('fan', { x: fanX, y: lvY }),
    createNode('straight', { x: eaX, y: lvY, L: 700, w: 10, h: 8, sys: 'EA' }),
    createNode('grille', { x: eaX, y: lvY, rot: -180, flow: 150 }),
  )

  return project
}
