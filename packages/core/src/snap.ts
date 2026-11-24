import { connect, layerOf, type ConnectionGraph } from './components'
import { angOf, dist, insetPoly, localToWorld, roomPts } from './geom'
import type { Point, Project, WorldPort } from './types'

export type SnapKind = 'port' | 'end' | 'mid' | 'grid' | 'none'

export interface SnapResult {
  p: Point
  kind: SnapKind
  port?: WorldPort
  nodeId?: string
}

export interface SnapOptions {
  enabled?: boolean
  gridStep?: number
  pxPerMm?: number
  tolerancePx?: number
  skipIds?: ReadonlySet<string>
  closePoint?: Point | null
}

export interface CursorMeasure {
  lengthMm: number
  angleDeg: number
  label: string
}

export interface RectMeasure {
  widthMm: number
  heightMm: number
  label: string
}

function isLayerVisible(project: Project, layer: ReturnType<typeof layerOf>): boolean {
  return project.layers[layer]?.on !== false
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

/**
 * Cari titik snap murni di sekitar posisi dunia `world`.
 * Urutan prioritas:
 * 1. `closePoint` (tutup poligon) jika diberikan
 * 2. `port` terbuka terdekat dalam toleransi
 * 3. `end` (ujung/sudut ruangan, partisi, duct lurus/fleksibel, dimensi) terdekat dalam toleransi
 * 4. `mid` (titik tengah sisi ruangan, partisi, duct lurus/fleksibel) terdekat dalam toleransi
 * 5. `grid` (pembulatan ke `gridStep` terdekat)
 */
export function snapAt(
  project: Project,
  world: Point,
  options: SnapOptions = {},
  graph?: ConnectionGraph,
): SnapResult {
  const {
    enabled = true,
    gridStep = 100,
    pxPerMm = 1,
    tolerancePx = 14,
    skipIds,
    closePoint = null,
  } = options

  if (!enabled) {
    return { p: [world[0], world[1]], kind: 'none' }
  }

  const tol = tolerancePx / (pxPerMm > 0 ? pxPerMm : 1)

  if (closePoint && dist(closePoint, world) < tol) {
    return { p: [closePoint[0], closePoint[1]], kind: 'end' }
  }

  const cn = graph ?? connect(project)

  // 1. Port terbuka
  let bestPort: SnapResult | null = null
  let bestPortDist = tol
  for (const a of cn.open) {
    if (skipIds?.has(a.node.id)) continue
    if (!isLayerVisible(project, layerOf(a.node))) continue
    const d = dist(a.pos, world)
    if (d < bestPortDist) {
      bestPortDist = d
      bestPort = { p: [a.pos[0], a.pos[1]], kind: 'port', port: a, nodeId: a.node.id }
    }
  }
  if (bestPort) return bestPort

  // 2. Ujung (end) dan 3. Tengah (mid)
  let bestEnd: SnapResult | null = null
  let bestEndDist = tol
  let bestMid: SnapResult | null = null
  let bestMidDist = tol

  const considerEnd = (pt: Point, nodeId: string) => {
    const d = dist(pt, world)
    if (d < bestEndDist) {
      bestEndDist = d
      bestEnd = { p: [pt[0], pt[1]], kind: 'end', nodeId }
    }
  }

  const considerMid = (a: Point, b: Point, nodeId: string) => {
    const m = midpoint(a, b)
    const d = dist(m, world)
    if (d < bestMidDist) {
      bestMidDist = d
      bestMid = { p: m, kind: 'mid', nodeId }
    }
  }

  for (const n of project.nodes) {
    if (skipIds?.has(n.id)) continue
    if (!isLayerVisible(project, layerOf(n))) continue

    if (n.type === 'room') {
      const outerLocal = roomPts(n)
      const outerWorld = outerLocal.map(pt => localToWorld(n, pt))
      const innerWorld = insetPoly(outerLocal, n.t).map(pt => localToWorld(n, pt))

      for (let i = 0; i < outerWorld.length; i++) {
        const a = outerWorld[i]!
        const b = outerWorld[(i + 1) % outerWorld.length]!
        considerEnd(a, n.id)
        considerMid(a, b, n.id)
      }
      for (const pt of innerWorld) {
        considerEnd(pt, n.id)
      }
    }
    else if (n.type === 'partition' || n.type === 'straight' || n.type === 'flex' || n.type === 'dim') {
      const a = localToWorld(n, [0, 0])
      const b = localToWorld(n, [n.L, 0])
      considerEnd(a, n.id)
      considerEnd(b, n.id)
      considerMid(a, b, n.id)
    }
  }

  if (bestEnd) return bestEnd
  if (bestMid) return bestMid

  // 4. Grid
  const step = gridStep > 0 ? gridStep : 100
  return {
    p: [Math.round(world[0] / step) * step, Math.round(world[1] / step) * step],
    kind: 'grid',
  }
}

/**
 * Kunci arah garis ke horizontal/vertikal (ortho).
 * Menahan `Shift` membalik status ortho sementara (sama dengan AutoCAD & prototype).
 */
export function orthoPoint(
  origin: Point,
  target: Point,
  orthoEnabled: boolean,
  shiftHeld = false,
): Point {
  const active = orthoEnabled !== shiftHeld
  if (!active) return [target[0], target[1]]
  return Math.abs(target[0] - origin[0]) >= Math.abs(target[1] - origin[1])
    ? [target[0], origin[1]]
    : [origin[0], target[1]]
}

/** Hitung panjang (mm) dan sudut AutoCAD (0° kanan, 90° atas) antara dua titik untuk info di kursor. */
export function cursorMeasure(origin: Point, target: Point): CursorMeasure {
  const lengthMm = Math.round(dist(origin, target))
  const rawAngle = Math.round(((-angOf(origin, target)) % 360 + 360) % 360) % 360
  const angleDeg = Object.is(rawAngle, -0) ? 0 : rawAngle
  return {
    lengthMm,
    angleDeg,
    label: `${lengthMm} mm  ${angleDeg}°`,
  }
}

/** Hitung ukuran kotak panjang x lebar (mm) untuk preview gambar ruangan di kursor. */
export function rectMeasure(origin: Point, target: Point): RectMeasure {
  const widthMm = Math.round(Math.abs(target[0] - origin[0]))
  const heightMm = Math.round(Math.abs(target[1] - origin[1]))
  return {
    widthMm,
    heightMm,
    label: `${widthMm} × ${heightMm} mm`,
  }
}
