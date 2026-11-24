import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  annotateDuct,
  arc,
  arrow,
  boxTag,
  cir,
  dimPrims,
  doorLeaf,
  ductBody,
  gapLines,
  hangers,
  hit,
  hitR,
  jambs,
  ln,
  pl,
  rect,
  ring,
  styledText,
  textHeight,
  txt,
  xformPrims,
  type Prim,
} from './index'

function loadProtoGeom() {
  const ctx = vm.createContext({ structuredClone, Math, JSON })
  const geomSrc = readFileSync(resolve(process.cwd(), 'prototype/app/js/geom.js'), 'utf8')
  vm.runInContext(geomSrc, ctx, { filename: 'geom.js' })
  return (expr: string) => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, ctx))
}

describe('primitive & transformasi (prims.ts)', () => {
  const proto = loadProtoGeom()

  it('pembuat primitive menghasilkan struktur identik dengan prototype', () => {
    expect(ln(0, 10, 100, 20, { j: 1 })).toEqual(proto('ln(0, 10, 100, 20, { j: 1 })'))
    expect(pl([[0, 0], [10, 20]], { closed: true })).toEqual(proto('pl([[0,0],[10,20]], { closed: true })'))
    expect(rect(10, 20, 300, 200, { fill: 'wall' })).toEqual(proto('rect(10, 20, 300, 200, { fill: "wall" })'))
    expect(arc([0, 500], 500, -90, 0)).toEqual(proto('arc([0, 500], 500, -90, 0)'))
    expect(cir([50, 60], 25, { layer: 'hanger', fill: 1 })).toEqual(proto('cir([50, 60], 25, { layer: "hanger", fill: 1 })'))
    expect(txt(100, 50, '24"x20"', 180, { anchor: 'start' })).toEqual(proto('txt(100, 50, \'24"x20"\', 180, { anchor: "start" })'))
    expect(arrow(50, 0, 180, 120)).toEqual(proto('arrow(50, 0, 180, 120)'))
    expect(hit([[0, 0], [10, 0], [10, 10]])).toEqual(proto('hit([[0,0],[10,0],[10,10]])'))
    expect(hitR(0, -100, 500, 200)).toEqual(proto('hitR(0, -100, 500, 200)'))
  })

  it('xformPrims() menangani rotasi dan cermin untuk arc, garis, panah, ring, dan teks', () => {
    const sample: Prim[] = [
      ln(0, -100, 1000, -100),
      pl([[0, 0], [200, 100]], { closed: false }),
      hit([[0, -50], [200, -50], [200, 50], [0, 50]]),
      ring([[0, 0], [1000, 0], [1000, 1000], [0, 1000]], [[150, 150], [850, 150], [850, 850], [150, 850]]),
      cir([100, 50], 20),
      arc([0, 500], 500, -90, 0),
      arrow(500, 0, 0, 100),
      txt(500, -150, '24"x20"', 180, { anchor: 'start' }),
      txt(0, 0, 'FCU-01', 160, { box: [1200, 700], gap: 200 }),
    ]

    for (const [rot, mir] of [[0, false], [90, false], [180, false], [135, true], [-90, true]] as const) {
      const got = xformPrims(sample, 1000, 500, rot, mir)
      const exp = proto(`xformPrims(${JSON.stringify(sample)}, 1000, 500, ${rot}, ${mir})`) as Prim[]
      expect(got).toHaveLength(exp.length)

      // Cek khusus cermin arc: sudut dibalik (-a1.. -a0) lalu ditambah rot
      const gotArc = got[5]!
      const expArc = exp[5]!
      expect(gotArc.k).toBe('arc')
      if (gotArc.k === 'arc' && expArc.k === 'arc') {
        expect(gotArc.c[0]).toBeCloseTo(expArc.c[0], 6)
        expect(gotArc.c[1]).toBeCloseTo(expArc.c[1], 6)
        expect(gotArc.a0).toBeCloseTo(expArc.a0, 6)
        expect(gotArc.a1).toBeCloseTo(expArc.a1, 6)
      }

      // Cek flip teks agar tetap terbaca pada rot 180°
      const gotTxt = got[7]!
      const expTxt = exp[7]!
      if (gotTxt.k === 't' && expTxt.k === 't') {
        expect(gotTxt.p[0]).toBeCloseTo(expTxt.p[0], 6)
        expect(gotTxt.p[1]).toBeCloseTo(expTxt.p[1], 6)
        expect(gotTxt.rot).toBeCloseTo(expTxt.rot, 6)
        expect(gotTxt.anchor).toBe(expTxt.anchor)
      }

      // Cek teks ber-box tetap mendatar (rot = 0)
      const gotBox = got[8]!
      const expBox = exp[8]!
      if (gotBox.k === 't' && expBox.k === 't') {
        expect(gotBox.rot).toBe(0)
        expect(gotBox.p[0]).toBeCloseTo(expBox.p[0], 6)
        expect(gotBox.p[1]).toBeCloseTo(expBox.p[1], 6)
      }
    }
  })

  it('helper komposit (ductBody, annotateDuct, hangers, dimPrims, styledText, gapLines, jambs, doorLeaf, boxTag) cocok dengan prototype', () => {
    expect(ductBody(1500, 600, 450)).toEqual(proto('body(1500, 600, 450)'))

    const ctx = { unit: 'inch' as const, th: 180, hang: { on: true, sp: 1500 } }
    const ann: Prim[] = []
    annotateDuct(ann, { w: 24, h: 20, shape: 'rect', flip: false }, ctx, 2000, 609.6)
    const protoAnn = proto(`(() => { const o = []; annotate(o, { w: 24, h: 20, shape: 'rect', flip: false }, ${JSON.stringify(ctx)}, 2000, 609.6); return o; })()`)
    expect(ann).toEqual(protoAnn)

    expect(hangers(3200, 600, ctx)).toEqual(proto(`hangers(3200, 600, ${JSON.stringify(ctx)})`))
    expect(hangers(3200, 600, { th: 180, hang: { on: false, sp: 1500 } })).toEqual([])

    expect(dimPrims(3000, -500, 180, { layer: 'dim' })).toEqual(proto('dimPrims(3000, -500, 180, { layer: "dim" })'))
    expect(dimPrims(3000, 500, 180)).toEqual(proto('dimPrims(3000, 500, 180)'))

    expect(textHeight({ th: 0, tz: '1.4' }, ctx)).toBeCloseTo(252, 9)
    expect(textHeight({ th: 300, tz: '1' }, ctx)).toBe(300)

    const stNode = { s: 'CEK PLAFON', th: 0, tz: '1', col: 'merah' as const, b: true, it: false, ul: true, bx: true }
    expect(styledText(stNode, ctx, 100, 200, 'middle')).toEqual(
      proto(`styledText(${JSON.stringify(stNode)}, ${JSON.stringify(ctx)}, 100, 200, 'middle')`),
    )

    const gOut: Prim[] = []
    gapLines(gOut, [0, 0], [1, 0], [0, 0], 0, 5000, [[1000, 1900], [3000, 4200]])
    const protoGaps = proto('(() => { const o = []; gapLines(o, [0,0], [1,0], [0,0], 0, 5000, [[1000, 1900], [3000, 4200]]); return o; })()')
    expect(gOut).toEqual(protoGaps)

    expect(jambs({ dw: 900, t: 150 })).toEqual(proto('jambs({ dw: 900, t: 150 })'))

    const leafOut: Prim[] = []
    doorLeaf(leafOut, 0, 1, 150, 1, 900)
    doorLeaf(leafOut, 900, -1, 0, -1, 900)
    const protoLeaf = proto('(() => { const o = []; leaf(o, 0, 1, 150, 1, 900); leaf(o, 900, -1, 0, -1, 900); return o; })()')
    expect(leafOut).toEqual(protoLeaf)

    expect(boxTag('SHAFT', ctx, 800, 600)).toEqual(proto(`tag('SHAFT', {}, ${JSON.stringify(ctx)}, 800, 600)`))
  })
})
