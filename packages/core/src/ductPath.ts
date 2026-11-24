import { angOf, dist, mmOf, norm, RAD, rotP } from './geom'
import { createNode } from './model'
import { orthoPoint, type SnapResult } from './snap'
import type { DuctShape, ElbowNode, Point, StraightNode, System, Unit } from './types'

export interface DuctSpec {
  w: number
  h: number
  shape: DuctShape
  sys: System
  elev?: number
}

export type DuctPathNode = StraightNode | ElbowNode

/** Spesifikasi duct bawaan per satuan proyek (identik dengan prototype/app/js/editor.js). */
export function defaultDuctSpec(unit: Unit): DuctSpec {
  return unit === 'mm'
    ? { w: 600, h: 500, shape: 'rect', sys: 'SA', elev: 2700 }
    : { w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700 }
}

/**
 * Konversi rangkaian titik jalur duct menjadi daftar komponen `straight` + `elbow`
 * yang langsung tersambung di tiap belokan (port dari `pathNodes` di prototype/app/js/geom.js).
 */
export function pathNodes(
  pts: readonly Point[],
  spec: DuctSpec,
  unit: Unit,
): DuctPathNode[] {
  if (pts.length < 2) return []

  const P: Point[] = [[pts[0]![0], pts[0]![1]]]
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!
    if (dist(p, P[P.length - 1]!) > 1) {
      P.push([p[0], p[1]])
    }
  }

  for (let i = P.length - 2; i > 0; i--) {
    if (Math.abs(norm(angOf(P[i]!, P[i + 1]!) - angOf(P[i - 1]!, P[i]!))) < 0.5) {
      P.splice(i, 1)
    }
  }

  if (P.length < 2) return []

  const R = mmOf(spec.w, unit)
  const dirs: number[] = []
  for (let i = 0; i < P.length - 1; i++) {
    dirs.push(angOf(P[i]!, P[i + 1]!))
  }

  const tan: number[] = Array.from({ length: P.length }, () => 0)
  const turnAngles: number[] = Array.from({ length: P.length }, () => 0)
  for (let i = 1; i < P.length - 1; i++) {
    const th = norm(dirs[i]! - dirs[i - 1]!)
    turnAngles[i] = th
    const absTh = Math.abs(th)
    // Hindari singularitas tan(90°) jika pengguna menarik garis berbalik tepat 180°
    tan[i] = absTh < 179.5 ? R * Math.tan((absTh / 2) * RAD) : 0
  }

  const base = {
    w: spec.w,
    h: spec.h,
    shape: spec.shape,
    sys: spec.sys,
    elev: spec.elev ?? 2700,
  }

  const out: DuctPathNode[] = []
  for (let i = 0; i < P.length - 1; i++) {
    if (i > 0) {
      const th = turnAngles[i]!
      const absTh = Math.abs(th)
      if (absTh >= 0.5 && absTh < 179.5) {
        const uPrev = rotP([1, 0], dirs[i - 1]!)
        out.push(createNode('elbow', {
          ...base,
          angle: Math.round(absTh * 100) / 100,
          mir: th < 0,
          rot: dirs[i - 1]!,
          x: P[i]![0] - uPrev[0] * tan[i]!,
          y: P[i]![1] - uPrev[1] * tan[i]!,
        }))
      }
    }

    const u = rotP([1, 0], dirs[i]!)
    const L = dist(P[i]!, P[i + 1]!) - tan[i]! - tan[i + 1]!
    if (L >= 1) {
      out.push(createNode('straight', {
        ...base,
        L: Math.round(L * 10) / 10,
        rot: dirs[i]!,
        x: P[i]![0] + u[0] * tan[i]!,
        y: P[i]![1] + u[1] * tan[i]!,
      }))
    }
  }

  return out
}

/**
 * Tentukan titik target segmen duct berikutnya dari titik snap & status ORTHO/Shift.
 * Jika snap mengenai ujung/port komponen yang ada, titik snap dipakai apa adanya.
 */
export function ductTargetPoint(
  pts: readonly Point[],
  snapped: SnapResult,
  orthoEnabled: boolean,
  shiftHeld = false,
): Point {
  const last = pts[pts.length - 1]
  if (!last || snapped.kind === 'port' || snapped.kind === 'end') {
    return [snapped.p[0], snapped.p[1]]
  }
  return orthoPoint(last, snapped.p, orthoEnabled, shiftHeld)
}

/**
 * Hitung titik berikutnya pada jarak tepat `lengthMm` mengikuti arah kursor/segmen terakhir.
 * Dipakai saat pengguna mengetik angka + Enter di baris perintah.
 */
export function ductPointByLength(
  pts: readonly Point[],
  target: Point,
  lengthMm: number,
): Point | null {
  if (pts.length === 0 || !Number.isFinite(lengthMm) || lengthMm <= 0) return null
  const last = pts[pts.length - 1]!
  const ang = dist(target, last) > 1
    ? angOf(last, target)
    : pts.length > 1
      ? angOf(pts[pts.length - 2]!, last)
      : 0
  const u = rotP([1, 0], ang)
  return [last[0] + u[0] * lengthMm, last[1] + u[1] * lengthMm]
}

export interface FreeCornerOptions {
  pxPerMm: number
  snapEnabled: boolean
  gridStep: number
}

/**
 * Deteksi belokan 90° otomatis saat pengguna menyeret jalur duct dalam mode ORTHO.
 */
export function stepFreeDuctCorner(
  lastPoint: Point,
  worldPoint: Point,
  axis: 'x' | 'y' | null,
  options: FreeCornerOptions,
): { nextAxis: 'x' | 'y' | null, corner: Point | null } {
  const scale = options.pxPerMm > 0 ? options.pxPerMm : 1
  const threshold = 16 / scale
  const dx = worldPoint[0] - lastPoint[0]
  const dy = worldPoint[1] - lastPoint[1]

  if (!axis) {
    if (Math.hypot(dx, dy) > threshold) {
      return { nextAxis: Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y', corner: null }
    }
    return { nextAxis: null, corner: null }
  }

  if (Math.abs(axis === 'x' ? dy : dx) < threshold) {
    return { nextAxis: axis, corner: null }
  }

  const g = options.snapEnabled && options.gridStep > 0 ? options.gridStep : 1
  const round = (v: number) => Math.round(v / g) * g
  const corner: Point = axis === 'x'
    ? [round(worldPoint[0]), lastPoint[1]]
    : [lastPoint[0], round(worldPoint[1])]
  const nextAxis = axis === 'x' ? 'y' : 'x'

  if (dist(corner, lastPoint) * scale < 8) {
    return { nextAxis, corner: null }
  }
  return { nextAxis, corner }
}
