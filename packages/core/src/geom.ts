import type { DuctShape, Point, Prim, RoomNode, Unit } from './types'

export const RAD = Math.PI / 180

export type Bounds = [number, number, number, number]

export interface Transform2D {
  x: number
  y: number
  rot?: number
  mir?: boolean
}

/** Normalisasi sudut derajat ke rentang (-180, 180] (sama persis dengan prototype). */
export function norm(deg: number): number {
  return ((deg % 360) + 540) % 360 - 180
}

/** Putar titik 2D terhadap titik asal sebesar `deg` derajat (searah jarum jam pada sumbu Y ke bawah). */
export function rotP([x, y]: readonly [number, number], deg: number): Point {
  const c = Math.cos(deg * RAD)
  const s = Math.sin(deg * RAD)
  return [x * c - y * s, x * s + y * c]
}

/** Jarak Euclidean dua titik 2D. */
export function dist(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Sudut derajat dari titik `a` ke titik `b` (0 = kanan, 90 = bawah). */
export function angOf(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD
}

/** Konversi ukuran duct dari satuan proyek (`inch` atau `mm`) ke mm. */
export function mmOf(value: number, unit: Unit): number {
  return unit === 'inch' ? value * 25.4 : value
}

/** Format label ukuran duct sesuai bentuk dan satuan (`24"x20"`, `Ø12"`, `600x500`, `Ø300`). */
export function sizeLabel(w: number, h: number, shape: DuctShape, unit: Unit): string {
  const q = unit === 'inch' ? '"' : ''
  return shape === 'round' ? `Ø${w}${q}` : `${w}${q}x${h}${q}`
}

/** Penyebut skala gambar (`'1:100'` → `100`). */
export function scaleDen(scale: string): number {
  return Number(String(scale).split(':')[1]) || 100
}

/** Ubah titik koordinat lokal node ke koordinat dunia. */
export function localToWorld(t: Transform2D, p: readonly [number, number]): Point {
  const q = rotP(t.mir ? [p[0], -p[1]] : p, t.rot ?? 0)
  return [q[0] + t.x, q[1] + t.y]
}

/** Ubah titik koordinat dunia ke koordinat lokal node. */
export function worldToLocal(t: Transform2D, g: readonly [number, number]): Point {
  const r = rotP([g[0] - t.x, g[1] - t.y], -(t.rot ?? 0))
  return t.mir ? [r[0], -r[1]] : r
}

/** Geser posisi node sebesar `(dx, dy)` dalam koordinat lokal node. */
export function moveLocal(n: Transform2D, dx: number, dy: number): void {
  const g = rotP(n.mir ? [dx, -dy] : [dx, dy], n.rot ?? 0)
  n.x += g[0]
  n.y += g[1]
}

/** Ubah arah sudut lokal node ke arah sudut dunia ternormalisasi. */
export function dirToWorld(t: Pick<Transform2D, 'rot' | 'mir'>, dir: number): number {
  return norm((t.mir ? -dir : dir) + (t.rot ?? 0))
}

/** Titik sudut ruangan dalam koordinat lokal (fallback ke persegi `W × H` jika `pts` kosong). */
export function roomPts(room: Pick<RoomNode, 'W' | 'H' | 'pts'>): Point[] {
  return room.pts ?? [[0, 0], [room.W, 0], [room.W, room.H], [0, room.H]]
}

/** Luas bertanda poligon 2D (rumus shoelace, mm²). */
export function polyArea(pts: readonly Point[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    area += p[0] * q[1] - q[0] * p[1]
  }
  return area / 2
}

/** Poligon dinding dalam dengan offset miter sebesar tebal `t` ke arah dalam poligon. */
export function insetPoly(pts: readonly Point[], t: number): Point[] {
  const s = Math.sign(polyArea(pts)) || 1
  const n = pts.length
  const nrm = (a: Point, b: Point): Point => {
    const d = dist(a, b) || 1
    return [(-(b[1] - a[1]) / d) * s, ((b[0] - a[0]) / d) * s]
  }

  return pts.map((p, i): Point => {
    const n1 = nrm(pts[(i + n - 1) % n]!, p)
    const n2 = nrm(p, pts[(i + 1) % n]!)
    const denom = 1 + n1[0] * n2[0] + n1[1] * n2[1]
    const k = t / (denom || 1)
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k]
  })
}

/** Titik potong ruas `a-b` dengan `c-d` → parameter `t` pada `a-b` dalam `(0, 1)`, atau `null`. */
export function segX(a: Point, b: Point, c: Point, d: Point): number | null {
  const r: Point = [b[0] - a[0], b[1] - a[1]]
  const s: Point = [d[0] - c[0], d[1] - c[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return null
  const q: Point = [c[0] - a[0], c[1] - a[1]]
  const t = (q[0] * s[1] - q[1] * s[0]) / den
  const v = (q[0] * r[1] - q[1] * r[0]) / den
  return t > 0 && t < 1 && v >= 0 && v <= 1 ? t : null
}

/** Uji apakah titik `p` berada di dalam poligon `pts` (ray casting). */
export function inPoly(p: Point, pts: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }
  return inside
}

/** Uji apakah dua poligon saling bertumpuk atau berpotongan. */
export function polyHit(a: readonly Point[], b: readonly Point[]): boolean {
  return (
    a.some(p => inPoly(p, b))
    || b.some(p => inPoly(p, a))
    || a.some((p, i) =>
      b.some((c, j) => segX(p, a[(i + 1) % a.length]!, c, b[(j + 1) % b.length]!) !== null),
    )
  )
}

/** Bounding box `[minX, minY, maxX, maxY]` dari sekumpulan primitive dunia. */
export function primBounds(prims: readonly Prim[]): Bounds {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity

  const add = (p: Point, r = 0) => {
    x0 = Math.min(x0, p[0] - r)
    y0 = Math.min(y0, p[1] - r)
    x1 = Math.max(x1, p[0] + r)
    y1 = Math.max(y1, p[1] + r)
  }

  for (const p of prims) {
    switch (p.k) {
      case 'l':
        add(p.a)
        add(p.b)
        break
      case 'pl':
      case 'hit':
        for (const q of p.pts) add(q)
        break
      case 'ring':
        for (const q of p.outer) add(q)
        break
      case 'c':
      case 'arc':
        add(p.c, p.r)
        break
      case 't':
        add(p.p, p.h * p.s.length * 0.35)
        break
      case 'arrow':
        add(p.p, p.h)
        break
    }
  }

  return [x0, y0, x1, y1]
}
