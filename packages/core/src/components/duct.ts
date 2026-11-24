import { RAD, dist, mmOf, sizeLabel } from '../geom'
import { LBL, annotateDuct, arc, cir, ductBody, hangers, hit, hitR, ln, pl, rect, txt } from '../prims'
import type { ElbowNode, Point, Prim, TakeoffNode, TeeNode, Unit } from '../types'
import { port, type ComponentDef, type LocalGrip } from './types'

export const ELBOW_ANGLE_RANGE = { min: 5, max: 150 } as const
export const ELBOW_ANGLE_CHIPS = [90, 60, 45, 30, 22.5, 15] as const
export const ELBOW_RADIUS_RATIOS = ['1', '1.5'] as const

export function clampElbowAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 90
  return Math.min(ELBOW_ANGLE_RANGE.max, Math.max(ELBOW_ANGLE_RANGE.min, angle))
}

const lenGrips = (n: { L: number, w: number }, unit: Unit): LocalGrip[] => [
  ['a', 0, 0],
  ['b', n.L, 0],
  ['w', n.L / 2, mmOf(n.w, unit) / 2],
]

const edgeGrips = (n: { w: number }, unit: Unit): LocalGrip[] => [
  ['w', 0, -mmOf(n.w, unit) / 2],
]

type ElbowGeo
  = | { W1: number, W2: number, a: number, sq: true, d: number, K: Point, end: Point }
    | { W1: number, W2: number, a: number, sq: false, R: number, C: Point, end: Point }

export function elbowGeo(n: ElbowNode, unit: Unit): ElbowGeo {
  const W1 = mmOf(n.w, unit)
  const W2 = mmOf(n.w2 ?? n.w, unit)
  const a = n.angle
  if (n.et === 'sq') {
    const d = (Math.max(W1, W2) / 2) * Math.tan((a * RAD) / 2) + 75
    return { W1, W2, a, sq: true, d, K: [d, 0], end: [d + d * Math.cos(a * RAD), d * Math.sin(a * RAD)] }
  }
  const R = (Number(n.rr) || 1) * Math.max(W1, W2)
  return { W1, W2, a, sq: false, R, C: [0, R], end: [R * Math.sin(a * RAD), R - R * Math.cos(a * RAD)] }
}

export function teeGeo(n: TeeNode, unit: Unit) {
  const W = mmOf(n.w, unit)
  const B = mmOf(n.bw, unit)
  return { W, B, Lm: B + 300, Lb: 150 }
}

export function takeoffGeo(n: TakeoffNode, unit: Unit) {
  const W = mmOf(n.w, unit)
  const B = mmOf(n.bw, unit)
  const k = Math.SQRT1_2
  const x0 = 150 + B * k
  const Lb = B * k + 200
  return {
    W,
    B,
    k,
    x0,
    Lb,
    Lm: x0 + B * k + 150,
    P: [x0 + Lb * k, W / 2 + Lb * k] as Point,
  }
}

export const ductComponents: {
  straight: ComponentDef<'straight'>
  flex: ComponentDef<'flex'>
  elbow: ComponentDef<'elbow'>
  transition: ComponentDef<'transition'>
  tee: ComponentDef<'tee'>
  takeoff: ComponentDef<'takeoff'>
  endcap: ComponentDef<'endcap'>
  damper: ComponentDef<'damper'>
  accessdoor: ComponentDef<'accessdoor'>
} = {
  straight: {
    name: 'Duct lurus',
    icon: 'duct-lurus',
    duct: true,
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = mmOf(n.w, c.unit)
      const o = ductBody(n.L, W)
      annotateDuct(o, n, c, n.L, W)
      for (const x of c.pen[n.id] ?? []) {
        o.push(rect(x - 60, -W / 2 - 60, 120, W + 120, { j: 1 }))
      }
      return o.concat(hangers(n.L, W, c))
    },
    grips: lenGrips,
  },
  flex: {
    name: 'Flexible',
    icon: 'flexible',
    duct: true,
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = mmOf(n.w, c.unit)
      const a = W * 0.1
      const lam = Math.max(W * 0.7, 60)
      const steps = Math.max(4, Math.ceil(n.L / (lam / 6)))
      const top: Point[] = []
      const bot: Point[] = []
      for (let i = 0; i <= steps; i++) {
        const x = (n.L * i) / steps
        const y = Math.sin((x / lam) * 2 * Math.PI) * a
        top.push([x, -W / 2 + y])
        bot.push([x, W / 2 - y])
      }
      const o: Prim[] = [
        pl(top),
        pl(bot),
        ln(0, -W / 2, 0, W / 2, { j: 1 }),
        ln(n.L, -W / 2, n.L, W / 2, { j: 1 }),
        hitR(0, -W / 2, n.L, W),
      ]
      if (n.L > c.th * 4) {
        o.push(txt(n.L / 2, -W / 2 - c.th * 0.35, `${sizeLabel(n.w, n.h, 'round', c.unit)} flex`, c.th, LBL))
      }
      return o
    },
    grips: lenGrips,
  },
  elbow: {
    name: 'Elbow',
    icon: 'elbow-90',
    duct: true,
    mirror: true,
    ports(n, u) {
      const g = elbowGeo(n, u)
      return [
        port('a', 0, 0, 180, n),
        n.w2 == null
          ? port('b', g.end[0], g.end[1], n.angle, n)
          : port('b', g.end[0], g.end[1], n.angle, n, { keys: ['w2', 'h2'] }),
      ]
    },
    prims(n, c) {
      const g = elbowGeo(n, c.unit)
      const { W1, W2, a } = g
      if (g.sq) {
        const u2: Point = [Math.cos(a * RAD), Math.sin(a * RAD)]
        const nm2: Point = [-u2[1], u2[0]]
        const meet = (s: number): Point => {
          const y1 = (s * W1) / 2
          const o2: Point = [g.K[0] + (nm2[0] * s * W2) / 2, g.K[1] + (nm2[1] * s * W2) / 2]
          const t = Math.abs(u2[1]) < 1e-9 ? 0 : (y1 - o2[1]) / u2[1]
          return [o2[0] + u2[0] * t, y1]
        }
        const Oc = meet(-1)
        const Ic = meet(1)
        const Ep = g.end
        const eo: Point = [Ep[0] - (nm2[0] * W2) / 2, Ep[1] - (nm2[1] * W2) / 2]
        const ei: Point = [Ep[0] + (nm2[0] * W2) / 2, Ep[1] + (nm2[1] * W2) / 2]
        const out: Prim[] = [
          pl([[0, -W1 / 2], Oc, eo]),
          pl([[0, W1 / 2], Ic, ei]),
          ln(0, -W1 / 2, 0, W1 / 2, { j: 1 }),
          ln(eo[0], eo[1], ei[0], ei[1], { j: 1 }),
        ]
        const k = Math.max(2, Math.round(dist(Ic, Oc) / 100))
        const v = Math.min(W1, W2) / 6
        for (let i = 1; i <= k; i++) {
          const P: Point = [
            Ic[0] + ((Oc[0] - Ic[0]) * i) / (k + 1),
            Ic[1] + ((Oc[1] - Ic[1]) * i) / (k + 1),
          ]
          const m = (-90 + a / 2) * RAD
          out.push(arc([P[0] - v * Math.cos(m), P[1] - v * Math.sin(m)], v, -90, -90 + a, { j: 1 }))
        }
        out.push(hit([[0, -W1 / 2], Oc, eo, ei, Ic, [0, W1 / 2]]))
        return out
      }
      const { R, C } = g
      const a1 = -90 + a
      const at = (r: number, d: number): Point => [C[0] + r * Math.cos(d * RAD), C[1] + r * Math.sin(d * RAD)]
      const half = (t: number) => (W1 + (W2 - W1) * t) / 2
      const outer: Point[] = []
      const inner: Point[] = []
      for (let i = 0; i <= 16; i++) {
        const t = i / 16
        const d = -90 + a * t
        outer.push(at(R + half(t), d))
        inner.push(at(R - half(t), d))
      }
      const p1 = outer[16]!
      const p2 = inner[16]!
      const walls: Prim[] = W1 === W2
        ? [arc(C, R + W1 / 2, -90, a1), arc(C, R - W1 / 2, -90, a1)]
        : [pl(outer), pl(inner)]
      return [
        ...walls,
        ln(0, -W1 / 2, 0, W1 / 2, { j: 1 }),
        ln(p1[0], p1[1], p2[0], p2[1], { j: 1 }),
        hit([...outer, ...inner.reverse()]),
      ]
    },
    grips: edgeGrips,
  },
  transition: {
    name: 'Transisi',
    icon: 'transisi',
    duct: true,
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n, { keys: ['w2', 'h2'] })],
    prims: (n, c) => ductBody(n.L, mmOf(n.w, c.unit), mmOf(n.w2, c.unit)),
    grips: (n, unit) => [
      ['b', n.L, 0],
      ['w', 0, -mmOf(n.w, unit) / 2],
      ['w2', n.L, -mmOf(n.w2, unit) / 2],
    ],
  },
  tee: {
    name: 'T',
    icon: 'tee',
    duct: true,
    mirror: true,
    ports(n, u) {
      const g = teeGeo(n, u)
      return [
        port('a', 0, 0, 180, n),
        port('b', g.Lm, 0, 0, n),
        port('c', g.Lm / 2, g.W / 2 + g.Lb, 90, n, { keys: ['bw', 'bh'] }),
      ]
    },
    prims(n, c) {
      const { W, B, Lm, Lb } = teeGeo(n, c.unit)
      const m = Lm / 2
      const y = W / 2
      return [
        ln(0, -y, Lm, -y),
        pl([[0, y], [m - B / 2, y], [m - B / 2, y + Lb]]),
        pl([[m + B / 2, y + Lb], [m + B / 2, y], [Lm, y]]),
        ln(0, -y, 0, y, { j: 1 }),
        ln(Lm, -y, Lm, y, { j: 1 }),
        ln(m - B / 2, y + Lb, m + B / 2, y + Lb, { j: 1 }),
        hitR(0, -y, Lm, W),
        hitR(m - B / 2, y, B, Lb),
      ]
    },
    grips: edgeGrips,
  },
  takeoff: {
    name: 'Cabang 45°',
    icon: 'cabang',
    duct: true,
    mirror: true,
    ports(n, u) {
      const g = takeoffGeo(n, u)
      return [
        port('a', 0, 0, 180, n),
        port('b', g.Lm, 0, 0, n),
        port('c', g.P[0], g.P[1], 45, n, { keys: ['bw', 'bh'] }),
      ]
    },
    prims(n, c) {
      const { W, B, k, x0, Lm, P } = takeoffGeo(n, c.unit)
      const y = W / 2
      const h = (B / 2) * k
      const e1: Point = [P[0] - h, P[1] + h]
      const e2: Point = [P[0] + h, P[1] - h]
      return [
        ln(0, -y, Lm, -y),
        ln(0, y, x0 - B * k, y),
        ln(x0 + B * k, y, Lm, y),
        ln(x0 - B * k, y, e1[0], e1[1]),
        ln(x0 + B * k, y, e2[0], e2[1]),
        ln(0, -y, 0, y, { j: 1 }),
        ln(Lm, -y, Lm, y, { j: 1 }),
        ln(e1[0], e1[1], e2[0], e2[1], { j: 1 }),
        hitR(0, -y, Lm, W),
        hit([[x0 - B * k, y], [x0 + B * k, y], e2, e1]),
      ]
    },
    grips: edgeGrips,
  },
  endcap: {
    name: 'End cap',
    icon: 'endcap',
    duct: true,
    ports: n => [port('a', 0, 0, 180, n)],
    prims(n, c) {
      const W = mmOf(n.w, c.unit)
      return [rect(0, -W / 2, 60, W), ln(0, -W / 2, 60, W / 2, { j: 1 }), hitR(0, -W / 2, 60, W)]
    },
    grips: edgeGrips,
  },
  damper: {
    name: 'Damper',
    icon: 'damper',
    duct: true,
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = mmOf(n.w, c.unit)
      const m = n.L / 2
      return ductBody(n.L, W).concat([
        ln(m - n.L * 0.3, W * 0.42, m + n.L * 0.3, -W * 0.42),
        cir([m, 0], Math.max(12, W * 0.04)),
        txt(m, -W / 2 - c.th * 0.35, 'VD', c.th * 0.9, LBL),
      ])
    },
    grips: lenGrips,
  },
  accessdoor: {
    name: 'Access door',
    icon: 'access-door',
    duct: true,
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = mmOf(n.w, c.unit)
      const m = n.L / 2
      const d = Math.min(150, n.L / 2 - 20)
      return ductBody(n.L, W).concat([
        rect(m - d, -W / 2 - 100, d * 2, 100, { layer: 'diff' }),
        ln(m - d, -W / 2 - 100, m + d, -W / 2, { layer: 'diff' }),
        txt(m, -W / 2 - 100 - c.th * 0.35, 'AD', c.th * 0.9, LBL),
      ])
    },
    grips: lenGrips,
  },
}
