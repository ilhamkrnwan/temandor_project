import { angOf, dist, insetPoly, norm, polyArea, roomPts, rotP } from '../geom'
import { LBL, arrow, boxTag, cir, dimPrims, doorLeaf, gapLines, hitR, jambs, ln, pl, rect, ring, txt, xformPrims } from '../prims'
import type { Point, Prim } from '../types'
import type { ComponentDef, LocalGrip } from './types'

export const archComponents: {
  room: ComponentDef<'room'>
  dim: ComponentDef<'dim'>
  column: ComponentDef<'column'>
  door: ComponentDef<'door'>
  win: ComponentDef<'win'>
  opening: ComponentDef<'opening'>
  partition: ComponentDef<'partition'>
  shaft: ComponentDef<'shaft'>
  beam: ComponentDef<'beam'>
  stair: ComponentDef<'stair'>
  lift: ComponentDef<'lift'>
  ceiling: ComponentDef<'ceiling'>
} = {
  room: {
    name: 'Ruangan',
    layer: 'denah',
    prims(n, c) {
      const P = roomPts(n)
      const I = insetPoly(P, n.t)
      const s = Math.sign(polyArea(P)) || 1
      const dimStyle = { layer: 'dim' as const }
      const off = c.th * 2.2
      const area = (Math.abs(polyArea(I)) / 1e6).toFixed(1)
      const corner = I.reduce((m, p) => (p[1] - p[0] > m[1] - m[0] ? p : m))
      const cuts = c.cuts[n.id] ?? {}
      const count = P.length
      const o: Prim[] = [
        ring(P, I, { nostroke: 1 }),
        txt(corner[0] + c.th * 0.6, corner[1] - c.th * 1.6, n.name.toUpperCase(), c.th, { anchor: 'start', ...LBL }),
        txt(corner[0] + c.th * 0.6, corner[1] - c.th * 0.5, `${area} m²`, c.th * 0.75, { anchor: 'start', ...LBL }),
      ]
      for (let i = 0; i < count; i++) {
        const p = P[i]!
        const q = P[(i + 1) % count]!
        const len = dist(p, q) || 1
        const u: Point = [(q[0] - p[0]) / len, (q[1] - p[1]) / len]
        const a = I[i]!
        const b = I[(i + 1) % count]!
        const pa = (a[0] - p[0]) * u[0] + (a[1] - p[1]) * u[1]
        const pb = (b[0] - p[0]) * u[0] + (b[1] - p[1]) * u[1]
        const gaps = (cuts[i] ?? []).slice().sort((x, y) => x[0] - y[0])
        gapLines(o, p, u, [0, 0], 0, len, gaps)
        gapLines(o, p, u, [a[0] - p[0] - u[0] * pa, a[1] - p[1] - u[1] * pa], pa, pb, gaps)
      }
      if (n.dims === false) return o
      const seen: Array<[number, number]> = []
      for (let i = 0; i < count; i++) {
        const p = P[i]!
        const q = P[(i + 1) % count]!
        const len = dist(p, q)
        const ang = angOf(p, q)
        if (len < 1 || seen.some(([l, g]) => Math.abs(l - len) < 1 && Math.abs(norm(g - ang + 180)) < 0.5)) {
          continue
        }
        seen.push([len, ang])
        o.push(...xformPrims(dimPrims(len, -off * s, c.th, dimStyle), p[0], p[1], ang, false))
      }
      return o
    },
    grips(n) {
      const pts = roomPts(n)
      const verts: LocalGrip[] = pts.map((p, i) => [`v${i}`, p[0], p[1]])
      const edges: LocalGrip[] = pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length]!
        return [`e${i}`, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
      })
      return [...verts, ...edges]
    },
  },
  dim: {
    name: 'Garis ukur',
    layer: 'dim',
    prims(n, c) {
      const o = dimPrims(n.L, n.off, c.th)
      const lo = Math.min(0, n.off) - c.th * 1.2
      const hi = Math.max(0, n.off) + c.th * 0.3
      return o.concat([hitR(0, lo, n.L, hi - lo)])
    },
    grips: n => [['p1', 0, 0], ['p2', n.L, 0], ['off', n.L / 2, n.off]],
  },
  column: {
    name: 'Kolom',
    icon: 'kolom',
    layer: 'kolom',
    prims(n) {
      const w = n.cw / 2
      const d = n.shape === 'round' ? w : n.cd / 2
      const k = n.shape === 'round' ? 0.7 : 1
      return [
        n.shape === 'round' ? cir([0, 0], w, { fill: 'wall' }) : rect(-w, -d, 2 * w, 2 * d, { fill: 'wall' }),
        ln(-w * k, -d * k, w * k, d * k, { j: 1 }),
        ln(-w * k, d * k, w * k, -d * k, { j: 1 }),
        hitR(-w, -d, 2 * w, 2 * d),
      ]
    },
    grips: n => [['s', n.cw / 2, (n.shape === 'round' ? n.cw : n.cd) / 2]],
  },
  door: {
    name: 'Pintu',
    icon: 'pintu',
    layer: 'bukaan',
    prims(n) {
      const o = jambs(n)
      const W = n.dw
      const out = n.swing === 'out'
      const y0 = out ? 0 : n.t
      const sy = out ? -1 : 1
      if (n.kind === 'sliding') {
        const h = n.t * 0.2
        o.push(rect(0, n.t * 0.28, W * 0.55, h), rect(W * 0.45, n.t * 0.52, W * 0.55, h))
        return o
      }
      if (n.kind === 'double') {
        doorLeaf(o, 0, 1, y0, sy, W / 2)
        doorLeaf(o, W, -1, y0, sy, W / 2)
      }
      else if (n.hinge === 'r') {
        doorLeaf(o, W, -1, y0, sy, W)
      }
      else {
        doorLeaf(o, 0, 1, y0, sy, W)
      }
      o.push(hitR(0, out ? -W : n.t, W, W))
      return o
    },
    grips: n => [['s', n.dw, n.t / 2]],
  },
  win: {
    name: 'Jendela',
    icon: 'jendela',
    layer: 'bukaan',
    prims: n => [
      ...jambs(n),
      ln(0, 0, n.dw, 0),
      ln(0, n.t, n.dw, n.t),
      ln(0, n.t / 2, n.dw, n.t / 2, { j: 1 }),
    ],
    grips: n => [['s', n.dw, n.t / 2]],
  },
  opening: {
    name: 'Bukaan',
    icon: 'bukaan',
    layer: 'bukaan',
    prims: n => [
      ...jambs(n),
      ln(0, 0, n.dw, 0, { dash: 1 }),
      ln(0, n.t, n.dw, n.t, { dash: 1 }),
    ],
    grips: n => [['s', n.dw, n.t / 2]],
  },
  partition: {
    name: 'Partisi',
    icon: 'partisi',
    layer: 'denah',
    prims: n => [rect(0, -n.t / 2, n.L, n.t, { fill: 'wall' }), hitR(0, -n.t / 2, n.L, n.t)],
    grips: n => [['p1', 0, 0], ['p2', n.L, 0]],
  },
  shaft: {
    name: 'Shaft',
    icon: 'shaft',
    layer: 'arsi',
    prims(n, c) {
      const w = n.sw / 2
      const d = n.sd / 2
      return [
        rect(-w, -d, n.sw, n.sd),
        ln(-w, -d, w, d, { j: 1 }),
        ln(-w, d, w, -d, { j: 1 }),
        hitR(-w, -d, n.sw, n.sd),
        boxTag('SHAFT', c, n.sw, n.sd),
      ]
    },
    grips: n => [['s', n.sw / 2, n.sd / 2]],
  },
  beam: {
    name: 'Balok',
    icon: 'balok',
    layer: 'arsi',
    prims(n, c) {
      const h = n.bw / 2
      return [
        ln(0, -h, n.L, -h, { dash: 1 }),
        ln(0, h, n.L, h, { dash: 1 }),
        txt(n.L / 2, -h - c.th * 0.35, `B${n.bw} · BB +${n.be}`, c.th * 0.8, LBL),
        hitR(0, -h, n.L, n.bw),
      ]
    },
    grips: n => [['p1', 0, 0], ['p2', n.L, 0]],
  },
  stair: {
    name: 'Tangga',
    icon: 'tangga',
    layer: 'arsi',
    prims(n, c) {
      const { sl, sw } = n
      const tr = Math.max(150, n.tr)
      const o: Prim[] = [rect(0, 0, sl, sw), hitR(0, 0, sl, sw)]
      const isL = n.skind === 'L'
      for (let x = tr; x < sl - 1; x += tr) {
        o.push(ln(x, 0, x, sw, { j: 1 }))
      }
      let path: Point[] = [[0, sw / 2], [sl, sw / 2]]
      let dir = 0
      if (isL) {
        o.push(rect(sl, 0, sw, sw), rect(sl, sw, sw, sl), hitR(sl, 0, sw, sw + sl))
        for (let y = sw + tr; y < sw + sl - 1; y += tr) {
          o.push(ln(sl, y, sl + sw, y, { j: 1 }))
        }
        path = [[0, sw / 2], [sl + sw / 2, sw / 2], [sl + sw / 2, sw + sl]]
        dir = 90
      }
      const end = path[path.length - 1]!
      const h = Math.min(sw * 0.3, c.th)
      const u = rotP([1, 0], dir)
      o.push(
        pl(path, { j: 1 }),
        arrow(end[0] - (u[0] * h) / 2, end[1] - (u[1] * h) / 2, dir, h),
        txt(c.th * 0.4, sw / 2 - c.th * 0.3, 'NAIK', c.th * 0.7, { anchor: 'start', ...LBL }),
      )
      return o
    },
    grips: n => [['s', n.sl, n.sw]],
  },
  lift: {
    name: 'Lift',
    icon: 'lift',
    layer: 'arsi',
    prims(n, c) {
      const w = n.sw / 2
      const d = n.sd / 2
      const inset = Math.min(w, d) * 0.15
      return [
        rect(-w, -d, n.sw, n.sd),
        rect(-w + inset, -d + inset, n.sw - 2 * inset, n.sd - 2 * inset, { j: 1 }),
        ln(-w + inset, -d + inset, w - inset, d - inset, { j: 1 }),
        ln(-w + inset, d - inset, w - inset, -d + inset, { j: 1 }),
        hitR(-w, -d, n.sw, n.sd),
        boxTag('LIFT', c, n.sw, n.sd),
      ]
    },
    grips: n => [['s', n.sw / 2, n.sd / 2]],
  },
  ceiling: {
    name: 'Tinggi plafon',
    icon: 'plafon',
    layer: 'arsi',
    prims(n, c) {
      const s = `PLAFON +${n.ch}`
      const h = c.th * 0.8
      const w = s.length * h * 0.62 + h
      const H = h * 1.7
      return [rect(-w / 2, -H / 2, w, H), txt(0, h * 0.35, s, h, LBL), hitR(-w / 2, -H / 2, w, H)]
    },
  },
}
