import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  RAD,
  angOf,
  arrow,
  cir,
  dirToWorld,
  dist,
  hit,
  inPoly,
  insetPoly,
  ln,
  localToWorld,
  mmOf,
  moveLocal,
  norm,
  pl,
  polyArea,
  polyHit,
  primBounds,
  ring,
  roomPts,
  rotP,
  scaleDen,
  segX,
  sizeLabel,
  txt,
  worldToLocal,
  arc,
  type Point,
} from './index'

function loadProtoGeom() {
  const ctx = vm.createContext({ structuredClone, Math, JSON })
  const geomSrc = readFileSync(resolve(process.cwd(), 'prototype/app/js/geom.js'), 'utf8')
  const modelSrc = readFileSync(resolve(process.cwd(), 'prototype/app/js/model.js'), 'utf8')
  vm.runInContext(geomSrc, ctx, { filename: 'geom.js' })
  vm.runInContext(modelSrc, ctx, { filename: 'model.js' })
  return (expr: string) => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, ctx))
}

describe('geometri dasar (geom.ts)', () => {
  const proto = loadProtoGeom()

  it('norm() menormalisasi sudut ke rentang yang sama persis dengan prototype', () => {
    const samples = [-540, -360, -270, -180, -90, 0, 45, 90, 179, 180, 270, 360, 450]
    for (const deg of samples) {
      expect(norm(deg), `norm(${deg})`).toBe(proto(`norm(${deg})`))
    }
    expect(RAD).toBeCloseTo(Math.PI / 180, 12)
  })

  it('rotP(), dist(), angOf() cocok dengan prototype', () => {
    const cases: Array<[Point, number]> = [
      [[100, 0], 90],
      [[100, 50], -45],
      [[-30, 80], 135],
      [[0, 0], 180],
    ]
    for (const [p, deg] of cases) {
      const got = rotP(p, deg)
      const exp = proto(`rotP(${JSON.stringify(p)}, ${deg})`) as Point
      expect(got[0]).toBeCloseTo(exp[0], 9)
      expect(got[1]).toBeCloseTo(exp[1], 9)
    }

    expect(dist([0, 0], [300, 400])).toBe(500)
    expect(dist([10, 20], [-20, 60])).toBeCloseTo(proto('dist([10,20],[-20,60])') as number, 9)

    expect(angOf([0, 0], [100, 0])).toBe(0)
    expect(angOf([0, 0], [0, 100])).toBe(90)
    expect(angOf([10, 10], [-90, 10])).toBe(180)
    expect(angOf([0, 0], [100, -100])).toBeCloseTo(proto('angOf([0,0],[100,-100])') as number, 9)
  })

  it('mmOf(), sizeLabel(), scaleDen() menangani inch/mm dan bentuk rect/round', () => {
    expect(mmOf(24, 'inch')).toBeCloseTo(609.6, 9)
    expect(mmOf(600, 'mm')).toBe(600)

    expect(sizeLabel(24, 20, 'rect', 'inch')).toBe('24"x20"')
    expect(sizeLabel(12, 12, 'round', 'inch')).toBe('Ø12"')
    expect(sizeLabel(600, 500, 'rect', 'mm')).toBe('600x500')
    expect(sizeLabel(300, 300, 'round', 'mm')).toBe('Ø300')

    expect(sizeLabel(18, 14, 'rect', 'inch')).toBe(proto('sizeLabel(18, 14, "rect", "inch")'))
    expect(sizeLabel(10, 10, 'round', 'inch')).toBe(proto('sizeLabel(10, 10, "round", "inch")'))
    expect(sizeLabel(500, 400, 'rect', 'mm')).toBe(proto('sizeLabel(500, 400, "rect", "mm")'))

    expect(scaleDen('1:50')).toBe(50)
    expect(scaleDen('1:100')).toBe(100)
    expect(scaleDen('1:200')).toBe(200)
    expect(scaleDen('tidak-valid')).toBe(100)
  })

  it('localToWorld(), worldToLocal(), dirToWorld(), moveLocal() konsisten termasuk saat dicerminkan', () => {
    for (const mir of [false, true]) {
      const t = { x: 1000, y: 2000, rot: 35, mir }
      const local: Point = [250, -120]
      const world = localToWorld(t, local)
      const protoWorld = proto(`localToWorld(${JSON.stringify(t)}, ${JSON.stringify(local)})`) as Point
      expect(world[0]).toBeCloseTo(protoWorld[0], 9)
      expect(world[1]).toBeCloseTo(protoWorld[1], 9)

      const back = worldToLocal(t, world)
      expect(back[0]).toBeCloseTo(local[0], 9)
      expect(back[1]).toBeCloseTo(local[1], 9)

      expect(dirToWorld(t, 90)).toBeCloseTo(proto(`dirToWorld(${JSON.stringify(t)}, 90)`) as number, 9)
    }

    // Fallback default rot/mir
    expect(localToWorld({ x: 10, y: 20 }, [5, 7])).toEqual([15, 27])
    expect(worldToLocal({ x: 10, y: 20 }, [15, 27])).toEqual([5, 7])
    expect(dirToWorld({}, 45)).toBe(45)

    const node = { x: 100, y: 200, rot: 90, mir: true }
    moveLocal(node, 50, 20)
    // mir=true → [50, -20], rot 90° → [20, 50]
    expect(node.x).toBeCloseTo(120, 9)
    expect(node.y).toBeCloseTo(250, 9)
  })

  it('roomPts(), polyArea(), insetPoly() menghitung luas & dinding dalam untuk persegi dan bentuk L', () => {
    const rectPts = roomPts({ W: 6000, H: 4000 })
    expect(rectPts).toEqual([[0, 0], [6000, 0], [6000, 4000], [0, 4000]])
    expect(polyArea(rectPts)).toBe(24_000_000)

    const customPts: Point[] = [[0, 0], [3000, 0], [3000, 2500], [6000, 2500], [6000, 5000], [0, 5000]]
    expect(roomPts({ W: 6000, H: 5000, pts: customPts })).toBe(customPts)
    expect(polyArea(customPts)).toBe(22_500_000)
    expect(polyArea(customPts)).toBe(proto(`polyArea(${JSON.stringify(customPts)})`))

    // Orientasi berlawanan arah jarum jam (luas negatif) tetap menghasilkan inset ke dalam
    const ccwRect = [...rectPts].reverse()
    expect(polyArea(ccwRect)).toBe(-24_000_000)

    for (const poly of [rectPts, ccwRect, customPts]) {
      const got = insetPoly(poly, 150)
      const exp = proto(`insetPoly(${JSON.stringify(poly)}, 150)`) as Point[]
      expect(got.length).toBe(exp.length)
      for (let i = 0; i < got.length; i++) {
        expect(got[i]![0]).toBeCloseTo(exp[i]![0], 6)
        expect(got[i]![1]).toBeCloseTo(exp[i]![1], 6)
      }
    }
  })

  it('segX(), inPoly(), polyHit() mendeteksi perpotongan dan tabrakan seperti prototype', () => {
    // Segmen bersilangan di tengah
    expect(segX([0, 0], [100, 0], [50, -50], [50, 50])).toBeCloseTo(0.5, 9)
    // Segmen sejajar → null
    expect(segX([0, 0], [100, 0], [0, 10], [100, 10])).toBeNull()
    // Segmen tidak bersentuhan → null
    expect(segX([0, 0], [100, 0], [200, -50], [200, 50])).toBeNull()

    const square: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
    expect(inPoly([50, 50], square)).toBe(true)
    expect(inPoly([150, 50], square)).toBe(false)

    const overlapping: Point[] = [[50, 50], [150, 50], [150, 150], [50, 150]]
    const crossBar: Point[] = [[-20, 40], [120, 40], [120, 60], [-20, 60]]
    const separate: Point[] = [[200, 200], [300, 200], [300, 300], [200, 300]]

    expect(polyHit(square, overlapping)).toBe(true)
    expect(polyHit(square, crossBar)).toBe(true)
    expect(polyHit(square, separate)).toBe(false)
    expect(polyHit(square, crossBar)).toBe(proto(`polyHit(${JSON.stringify(square)}, ${JSON.stringify(crossBar)})`))
  })

  it('primBounds() menghitung kotak batas untuk semua jenis primitive', () => {
    const prims = [
      ln(0, 0, 100, 50),
      pl([[-10, 20], [40, 80]]),
      hit([[5, 5], [20, 120]]),
      ring([[0, -30], [10, -30], [10, 0]], [[2, -20], [8, -20], [8, -2]]),
      cir([200, 0], 25),
      arc([-50, 0], 10, 0, 90),
      txt(0, 100, 'SA', 20),
      arrow(10, -60, 0, 15),
    ]
    const got = primBounds(prims)
    const exp = proto(`primBounds(${JSON.stringify(prims)})`) as number[]
    expect(got).toHaveLength(4)
    for (let i = 0; i < 4; i++) {
      expect(got[i]).toBeCloseTo(exp[i]!, 6)
    }
  })
})
