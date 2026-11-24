import { RAD } from '../geom'
import { arrow, hit, ln, pl, styledText, textHeight } from '../prims'
import type { Point, PrimStyle } from '../types'
import type { ComponentDef } from './types'

export const markupComponents: {
  sketch: ComponentDef<'sketch'>
  text: ComponentDef<'text'>
  note: ComponentDef<'note'>
} = {
  sketch: {
    name: 'Coretan tangan',
    icon: 'coretan',
    layer: 'coret',
    prims(n) {
      const w = 60
      const band = (a: Point, b: Point) => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const v: Point = [(-(b[1] - a[1]) / d) * w, ((b[0] - a[0]) / d) * w]
        return hit([
          [a[0] + v[0], a[1] + v[1]],
          [b[0] + v[0], b[1] + v[1]],
          [b[0] - v[0], b[1] - v[1]],
          [a[0] - v[0], a[1] - v[1]],
        ])
      }
      return [pl(n.pts), ...n.pts.slice(1).map((b, i) => band(n.pts[i]!, b))]
    },
  },
  text: {
    name: 'Teks',
    layer: 'dim',
    prims: (n, c) => styledText(n, c, 0, 0, n.al || 'start'),
  },
  note: {
    name: 'Catatan + panah',
    layer: 'dim',
    prims(n, c) {
      const h = textHeight(n, c)
      const right = n.tx >= 0
      const gap = h * 0.4
      const ah = h * 0.9
      const colStyle: PrimStyle = n.col ? { col: n.col } : {}
      const len = Math.hypot(n.tx, n.ty) || 1
      const d: Point = [n.tx / len, n.ty / len]
      return [
        ln(n.tx, n.ty, d[0] * ah, d[1] * ah, colStyle),
        arrow((d[0] * ah) / 2, (d[1] * ah) / 2, Math.atan2(-d[1], -d[0]) / RAD, ah, colStyle),
        ...styledText(n, c, n.tx + (right ? gap : -gap), n.ty + h * 0.35, right ? 'start' : 'end'),
        hit([[0, -h / 2], [n.tx, n.ty - h / 2], [n.tx, n.ty + h / 2], [0, h / 2]]),
      ]
    },
    grips: n => [['t', n.tx, n.ty]],
  },
}
