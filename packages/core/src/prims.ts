import { RAD, norm, rotP, sizeLabel } from './geom'
import type {
  ArcPrim,
  ArrowPrim,
  CirclePrim,
  DuctShape,
  FlowUnit,
  HangerConfig,
  HitPrim,
  LayerKey,
  LinePrim,
  Point,
  PolylinePrim,
  Prim,
  PrimStyle,
  RingPrim,
  TextAlign,
  TextColor,
  TextPrim,
  Unit,
} from './types'

export interface RenderCtx {
  unit: Unit
  fu: FlowUnit
  th: number
  hang: HangerConfig
  flows: Record<string, number>
  cuts: Record<string, Record<number, Array<[number, number]>>>
  pen: Record<string, number[]>
}

export const LBL: Pick<PrimStyle, 'lbl'> = { lbl: 1 }

// ---- Pembuat primitive (koordinat lokal) ----

export function ln(x1: number, y1: number, x2: number, y2: number, style?: PrimStyle): LinePrim {
  return { k: 'l', a: [x1, y1], b: [x2, y2], ...style }
}

export function pl(pts: Point[], opts?: PrimStyle & { closed?: boolean }): PolylinePrim {
  return { k: 'pl', pts, ...opts }
}

export function rect(x: number, y: number, w: number, h: number, style?: PrimStyle): PolylinePrim {
  return pl([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { closed: true, ...style })
}

export function ring(outer: Point[], inner: Point[], style?: PrimStyle): RingPrim {
  return { k: 'ring', outer, inner, ...style }
}

export function arc(c: Point, r: number, a0: number, a1: number, style?: PrimStyle): ArcPrim {
  return { k: 'arc', c, r, a0, a1, ...style }
}

export function cir(c: Point, r: number, style?: PrimStyle): CirclePrim {
  return { k: 'c', c, r, ...style }
}

export type TextPrimOptions = PrimStyle & Partial<Pick<TextPrim, 'rot' | 'anchor' | 'b' | 'it' | 'ul' | 'box' | 'gap'>>

export function txt(x: number, y: number, s: string | number, h: number, opts?: TextPrimOptions): TextPrim {
  return { k: 't', p: [x, y], s: String(s), h, rot: 0, anchor: 'middle', ...opts }
}

export function arrow(x: number, y: number, dir: number, h: number, style?: PrimStyle): ArrowPrim {
  return { k: 'arrow', p: [x, y], dir, h, ...style }
}

export function hit(pts: Point[], layer?: LayerKey): HitPrim {
  return layer ? { k: 'hit', pts, layer } : { k: 'hit', pts }
}

export function hitR(x: number, y: number, w: number, h: number, layer?: LayerKey): HitPrim {
  return hit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], layer)
}

// ---- Transformasi primitive lokal → dunia ----

const FLIP_ANCHOR: Record<TextAlign, TextAlign> = {
  start: 'end',
  middle: 'middle',
  end: 'start',
}

export function xformPrims(prims: readonly Prim[], x: number, y: number, rot: number, mir: boolean): Prim[] {
  const transformPoint = (p: Point): Point => {
    const q = rotP(mir ? [p[0], -p[1]] : p, rot)
    return [q[0] + x, q[1] + y]
  }

  return prims.map((pr): Prim => {
    switch (pr.k) {
      case 'l':
        return { ...pr, a: transformPoint(pr.a), b: transformPoint(pr.b) }
      case 'pl':
        return { ...pr, pts: pr.pts.map(transformPoint) }
      case 'hit':
        return { ...pr, pts: pr.pts.map(transformPoint) }
      case 'ring':
        return { ...pr, outer: pr.outer.map(transformPoint), inner: pr.inner.map(transformPoint) }
      case 'c':
        return { ...pr, c: transformPoint(pr.c) }
      case 'arc': {
        const [a0, a1]: [number, number] = mir ? [-pr.a1, -pr.a0] : [pr.a0, pr.a1]
        return { ...pr, c: transformPoint(pr.c), a0: a0 + rot, a1: a1 + rot }
      }
      case 'arrow':
        return { ...pr, p: transformPoint(pr.p), dir: norm((mir ? -pr.dir : pr.dir) + rot) }
      case 't': {
        if (pr.box) {
          const a = rot * RAD
          const hh = (Math.abs(Math.sin(a)) * pr.box[0]) / 2 + (Math.abs(Math.cos(a)) * pr.box[1]) / 2
          const c = transformPoint(pr.p)
          return { ...pr, p: [c[0], c[1] + hh + (pr.gap ?? 0)], rot: 0 }
        }
        const t = norm((mir ? -pr.rot : pr.rot) + rot)
        const p = transformPoint(pr.p)
        if (t < 90 && t >= -90) {
          return { ...pr, p, rot: t }
        }
        const u = rotP([0, -pr.h * 0.75], t)
        return {
          ...pr,
          p: [p[0] + u[0], p[1] + u[1]],
          rot: norm(t + 180),
          anchor: FLIP_ANCHOR[pr.anchor],
        }
      }
    }
  })
}

// ---- Helper primitive komposit (duct, anotasi, gantungan, dimensi, arsitektur) ----

/** Badan duct lurus atau mengecil: dua garis sisi + garis sambungan di kedua ujung + area klik. */
export function ductBody(len: number, w1: number, w2 = w1): Prim[] {
  return [
    ln(0, -w1 / 2, len, -w2 / 2),
    ln(0, w1 / 2, len, w2 / 2),
    ln(0, -w1 / 2, 0, w1 / 2, { j: 1 }),
    ln(len, -w2 / 2, len, w2 / 2, { j: 1 }),
    hit([[0, -w1 / 2], [len, -w2 / 2], [len, w2 / 2], [0, w1 / 2]]),
  ]
}

/** Tambahkan label ukuran dan panah aliran di tengah segmen duct. */
export function annotateDuct(
  out: Prim[],
  node: { w: number, h: number, shape: DuctShape, flip?: boolean },
  ctx: Pick<RenderCtx, 'unit' | 'th'>,
  len: number,
  widthMm: number,
): void {
  const s = sizeLabel(node.w, node.h, node.shape, ctx.unit)
  if (len > s.length * ctx.th * 0.65) {
    out.push(txt(len / 2, -widthMm / 2 - ctx.th * 0.35, s, ctx.th, LBL))
  }
  if (len > ctx.th * 2.2) {
    out.push(arrow(len / 2, 0, node.flip ? 180 : 0, Math.min(ctx.th * 0.8, widthMm * 0.7)))
  }
}

/** Tinggi teks efektif (mm): memakai `th` eksplisit atau faktor `tz × ctx.th`. */
export function textHeight(node: { th: number, tz: string }, ctx: Pick<RenderCtx, 'th'>): number {
  return node.th || ctx.th * (Number(node.tz) || 1)
}

/** Teks bergaya dengan kotak latar opsional dan area klik. */
export function styledText(
  node: {
    s: string
    th: number
    tz: string
    col?: TextColor
    b?: boolean
    it?: boolean
    ul?: boolean
    bx?: boolean
  },
  ctx: Pick<RenderCtx, 'th'>,
  x: number,
  y: number,
  anchor: TextAlign,
): Prim[] {
  const h = textHeight(node, ctx)
  const w = Math.max(h, String(node.s).length * h * 0.62)
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  const colStyle: PrimStyle = node.col ? { col: node.col } : {}
  const pad = h * 0.3
  const out: Prim[] = []

  if (node.bx) {
    out.push(rect(x0 - pad, y - h * 0.95, w + 2 * pad, h * 1.3, { fill: 1, ...colStyle }))
  }
  out.push(
    txt(x, y, node.s, h, { anchor, b: node.b, it: node.it, ul: node.ul, ...colStyle, ...LBL }),
    hitR(x0, y - h, w, h * 1.25),
  )
  return out
}

/** Gantungan otomatis di sepanjang segmen duct (layer `hanger`). */
export function hangers(len: number, widthMm: number, ctx: Pick<RenderCtx, 'th' | 'hang'>): Prim[] {
  if (!ctx.hang?.on || !(ctx.hang.sp > 0)) return []
  const out: Prim[] = []
  const e = widthMm / 2 + Math.max(40, widthMm * 0.15)
  const style: PrimStyle = { layer: 'hanger' }
  const r = Math.max(18, ctx.th * 0.12)
  for (let s = Math.min(ctx.hang.sp / 2, len / 2); s < len; s += ctx.hang.sp) {
    out.push(
      ln(s, -e, s, e, style),
      cir([s, -e], r, { ...style, fill: 1 }),
      cir([s, e], r, { ...style, fill: 1 }),
    )
  }
  return out
}

/** Garis dimensi dari `(0, 0)` ke `(len, 0)` dengan garis ukur pada `y = off`. */
export function dimPrims(len: number, off: number, th: number, style?: PrimStyle): Prim[] {
  const sg = off < 0 ? -1 : 1
  const g = th * 0.25
  const t = th * 0.25
  return [
    ln(0, sg * g, 0, off + sg * g, style),
    ln(len, sg * g, len, off + sg * g, style),
    ln(-g, off, len + g, off, style),
    ln(-t, off + t, t, off - t, style),
    ln(len - t, off + t, len + t, off - t, style),
    txt(len / 2, off < 0 ? off - th * 0.3 : off + th * 1.05, Math.round(Math.abs(len)), th, { ...style, ...LBL }),
  ]
}

/** Pecah garis lurus dari `s0` ke `s1` sepanjang vektor satuan `u` dengan membuang celah `gaps`. */
export function gapLines(
  out: Prim[],
  p: Point,
  u: Point,
  off: Point,
  s0: number,
  s1: number,
  gaps: readonly [number, number][],
): void {
  const at = (t: number): Point => [p[0] + u[0] * t + off[0], p[1] + u[1] * t + off[1]]
  let s = s0
  for (const [g0, g1] of gaps) {
    if (g0 > s) {
      const a = at(s)
      const b = at(Math.min(g0, s1))
      out.push(ln(a[0], a[1], b[0], b[1]))
    }
    s = Math.max(s, g1)
    if (s >= s1) return
  }
  const a = at(s)
  const b = at(s1)
  out.push(ln(a[0], a[1], b[0], b[1]))
}

/** Kusen penutup dinding untuk pintu, jendela, dan bukaan. */
export function jambs(node: { dw: number, t: number }): Prim[] {
  return [
    pl([[0, 0], [node.dw, 0], [node.dw, node.t], [0, node.t]], { closed: true, fill: 'bg', nostroke: 1 }),
    ln(0, 0, 0, node.t),
    ln(node.dw, 0, node.dw, node.t),
    hitR(0, 0, node.dw, node.t),
  ]
}

/** Daun pintu + busur ayunan (engsel di `(hx, y0)`). */
export function doorLeaf(out: Prim[], hx: number, sx: number, y0: number, sy: number, r: number): void {
  const ax = sx > 0 ? 0 : 180
  const ay = sx < 0 && sy < 0 ? 270 : sy > 0 ? 90 : -90
  out.push(
    ln(hx, y0, hx, y0 + sy * r),
    arc([hx, y0], r, Math.min(ax, ay), Math.max(ax, ay), { j: 1 }),
  )
}

/** Label mendatar di bawah komponen berkotak (shaft, lift, equipment). */
export function boxTag(label: string, ctx: Pick<RenderCtx, 'th'>, w: number, d: number): TextPrim {
  return txt(0, 0, label, ctx.th * 0.8, { box: [w, d], gap: ctx.th * 1.1, ...LBL })
}
