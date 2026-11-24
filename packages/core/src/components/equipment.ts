import { RAD } from '../geom'
import { LBL, cir, hitR, ln, rect, txt } from '../prims'
import type { Point, Prim } from '../types'
import { anyPort, type ComponentDef } from './types'

export const equipmentComponents: {
  diffuser: ComponentDef<'diffuser'>
  grille: ComponentDef<'grille'>
  louver: ComponentDef<'louver'>
  fan: ComponentDef<'fan'>
  fcu: ComponentDef<'fcu'>
  outdoor: ComponentDef<'outdoor'>
} = {
  diffuser: {
    name: 'Diffuser',
    icon: 'diffuser',
    layer: 'diff',
    ports: () => [anyPort('a', 0, 0, 180)],
    prims(n, c) {
      const F = n.F
      const h = F / 2
      const inset = F * 0.3
      return [
        rect(0, -h, F, F),
        ln(0, -h, F, h),
        ln(F, -h, 0, h),
        rect(inset, -h + inset, F - 2 * inset, F - 2 * inset, { j: 1 }),
        hitR(0, -h, F, F),
        txt(F / 2, 0, `${n.flow || 0} ${c.fu}`, c.th * 0.9, { box: [F, F], gap: c.th * 1.15, ...LBL }),
      ]
    },
    grips: n => [['s', n.F, n.F / 2]],
  },
  grille: {
    name: 'Grille',
    icon: 'grille',
    layer: 'diff',
    ports: () => [anyPort('a', 0, 0, 180)],
    prims(n, c) {
      const h = n.Fy / 2
      const o: Prim[] = [
        rect(0, -h, n.Fx, n.Fy),
        hitR(0, -h, n.Fx, n.Fy),
        txt(n.Fx / 2, 0, `${n.flow || 0} ${c.fu}`, c.th * 0.9, { box: [n.Fx, n.Fy], gap: c.th * 1.15, ...LBL }),
      ]
      for (let k = 1; k < 5; k++) {
        o.push(ln(0, -h + (n.Fy * k) / 5, n.Fx, -h + (n.Fy * k) / 5, { j: 1 }))
      }
      return o
    },
    grips: n => [['s', n.Fx, n.Fy / 2]],
  },
  louver: {
    name: 'Louver',
    icon: 'louver',
    layer: 'diff',
    ports: () => [anyPort('a', 0, 0, 180)],
    prims(n) {
      const h = n.F / 2
      const o: Prim[] = [rect(0, -h, 120, n.F), hitR(0, -h, 120, n.F)]
      for (let y = -h + 40; y < h - 40; y += 100) {
        o.push(ln(0, y, 120, y + 60, { j: 1 }))
      }
      return o
    },
    grips: n => [['s', 120, n.F / 2]],
  },
  fan: {
    name: 'Fan / exhaust',
    icon: 'fan',
    layer: 'eq',
    ports: n => [anyPort('a', 0, 0, 180), anyPort('b', n.L, 0, 0)],
    prims(n, c) {
      const r = Math.min(n.L, n.B) * 0.36
      const C: Point = [n.L / 2, 0]
      const o: Prim[] = [rect(0, -n.B / 2, n.L, n.B), cir(C, r), hitR(0, -n.B / 2, n.L, n.B)]
      for (const d of [-90, 30, 150]) {
        o.push(ln(C[0], 0, C[0] + r * Math.cos(d * RAD), r * Math.sin(d * RAD), { j: 1 }))
      }
      const f = c.flows[n.id]
      o.push(txt(n.L / 2, 0, f ? `${n.tag} · ${f} ${c.fu}` : n.tag, c.th * 0.9, { box: [n.L, n.B], gap: c.th * 1.15, ...LBL }))
      return o
    },
    grips: n => [['s', n.L, n.B / 2]],
  },
  fcu: {
    name: 'Indoor ducted',
    icon: 'indoor-ducted',
    layer: 'eq',
    ports: n => [
      anyPort('s', n.L / 2, 0, 0, { w: n.w, h: n.h, shape: n.shape, keys: ['w', 'h'] }),
      anyPort('r', -n.L / 2, 0, 180, { opt: true }),
    ],
    prims(n, c) {
      const x = -n.L / 2
      const y = -n.B / 2
      const f = c.flows[n.id] ?? 0
      return [
        rect(x, y, n.L, n.B),
        ln(x + 80, y, x + 80, -y, { j: 1 }),
        ln(x + 130, y, x + 130, -y, { j: 1 }),
        hitR(x, y, n.L, n.B),
        txt(0, 0, `${n.tag} · ${f} ${c.fu}`, c.th * 0.9, { box: [n.L, n.B], gap: c.th * 1.15, ...LBL }),
      ]
    },
    grips: n => [['s', n.L / 2, n.B / 2]],
  },
  outdoor: {
    name: 'Outdoor',
    icon: 'outdoor',
    layer: 'eq',
    prims(n, c) {
      const x = -n.L / 2
      const y = -n.B / 2
      const r = n.B * 0.38
      const C: Point = [x + n.B * 0.55, 0]
      const k = r * 0.7
      const o: Prim[] = [
        rect(x, y, n.L, n.B),
        cir(C, r),
        ln(C[0] - k, -k, C[0] + k, k, { j: 1 }),
        ln(C[0] - k, k, C[0] + k, -k, { j: 1 }),
        hitR(x, y, n.L, n.B),
        txt(0, 0, n.tag, c.th * 0.9, { box: [n.L, n.B], gap: c.th * 1.15, ...LBL }),
      ]
      for (let gx = C[0] + r + 80; gx < -x - 40; gx += 60) {
        o.push(ln(gx, y + 40, gx, -y - 40, { j: 1 }))
      }
      return o
    },
    grips: n => [['s', n.L / 2, n.B / 2]],
  },
}
