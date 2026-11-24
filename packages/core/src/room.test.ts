import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  ROOM_SHAPES,
  applyGrip,
  applyGripDblClick,
  applyRoomShape,
  connect,
  createNode,
  ctxOf,
  isClosingPolyPoint,
  newProject,
  nextRoomName,
  nodeSVG,
  nodeSchema,
  polyTargetPoint,
  resizeRoom,
  roomFromCorners,
  roomFromDimensions,
  roomFromPolygon,
  roomInnerAreaM2,
  roomOuterAreaM2,
  roomPts,
  type Project,
  type RoomNode,
  type RoomShapeKey,
} from './index'

function loadPrototypeVm() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'render.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return {
    nodeSVG(project: Project, pal: 'screen' | 'paper' | 'light') {
      return vm.runInContext(
        `(() => { const p = ${JSON.stringify(project)}; const c = ctxOf(p, connect(p)); return JSON.stringify(nodeSVG(p.nodes[0], c, { pal: ${JSON.stringify(pal)}, sw: 1.4, live: true })); })()`,
        ctx,
      ) as string
    },
  }
}

describe('ruangan: bentuk, luas, edit sudut, dan paritas prototype (M3-05)', () => {
  const proto = loadPrototypeVm()

  it('bentuk Persegi, L, T, U memiliki jumlah sudut & luas tepat serta render SVG identik dengan prototype', () => {
    const expected: Record<RoomShapeKey, { verts: number, outerM2: number }> = {
      rect: { verts: 4, outerM2: 30 },
      L: { verts: 6, outerM2: 22.5 },
      T: { verts: 8, outerM2: 18 },
      U: { verts: 8, outerM2: 24 },
    }

    for (const shape of Object.keys(ROOM_SHAPES) as RoomShapeKey[]) {
      const room = createNode('room', { W: 6000, H: 5000, t: 150, name: `Ruang ${shape}` })
      applyRoomShape(room, shape)

      expect(() => nodeSchema.parse(room)).not.toThrow()
      expect(roomPts(room)).toHaveLength(expected[shape].verts)
      expect(roomOuterAreaM2(room)).toBeCloseTo(expected[shape].outerM2, 2)
      expect(roomInnerAreaM2(room)).toBeLessThan(roomOuterAreaM2(room))
      expect(roomInnerAreaM2(room)).toBeGreaterThan(0)

      const p = newProject({ unit: 'mm', scale: '1:100' })
      p.nodes = [room]
      const ctx = ctxOf(p, connect(p))
      for (const pal of ['screen', 'paper', 'light'] as const) {
        const ours = JSON.stringify(nodeSVG(room, ctx, { pal, sw: 1.4, live: true }))
        expect(ours).toBe(proto.nodeSVG(p, pal))
      }
    }
  })

  it('pembuatan ruangan kotak (2 sudut / 6x4), ruangan poligon bebas, resizeRoom, dan nextRoomName', () => {
    // 2 sudut & batas minimum 600 mm
    expect(roomFromCorners([0, 0], [500, 500], 'Kecil')).toBeNull()
    const r2 = roomFromCorners([1000, 2000], [7000, 6000], 'Ruangan 2')!
    expect(r2.x).toBe(1000)
    expect(r2.y).toBe(2000)
    expect(r2.W).toBe(6000)
    expect(r2.H).toBe(4000)
    expect(roomOuterAreaM2(r2)).toBeCloseTo(24, 4)
    // Dinding tebal 150 mm di semua sisi: dalam = 5700 x 3700 = 21.09 m²
    expect(roomInnerAreaM2(r2)).toBeCloseTo(21.09, 2)

    // 6x4 dari sudut awal mengikuti kuadran kursor
    const rDim = roomFromDimensions([1000, 1000], [1500, 1500], 6000, 4000, 'Ruangan 3')!
    expect([rDim.x, rDim.y, rDim.W, rDim.H]).toEqual([1000, 1000, 6000, 4000])
    const rNeg = roomFromDimensions([7000, 5000], [5000, 3000], 6000, 4000, 'Ruangan 4')!
    expect([rNeg.x, rNeg.y, rNeg.W, rNeg.H]).toEqual([1000, 1000, 6000, 4000])

    // Poligon bebas (bentuk L) & tolak yang terlalu kecil (< 0.36 m²)
    expect(roomFromPolygon([[0, 0], [400, 0], [400, 400]], 'Mini')).toBeNull()
    const poly = roomFromPolygon([[500, 500], [3500, 500], [3500, 2500], [6500, 2500], [6500, 4500], [500, 4500]], 'L')!
    expect(poly.x).toBe(500)
    expect(poly.y).toBe(500)
    expect(poly.W).toBe(6000)
    expect(poly.H).toBe(4000)
    expect(roomOuterAreaM2(poly)).toBeCloseTo(18, 2)

    // resizeRoom ikut menskalakan titik poligon
    resizeRoom(poly, 'W', 9000)
    expect(poly.W).toBe(9000)
    expect(Math.max(...poly.pts!.map(p => p[0]))).toBe(9000)
    expect(roomOuterAreaM2(poly)).toBeCloseTo(27, 2)

    // nextRoomName berlanjut dari angka maksimum ruangan yang ada
    const proj = newProject()
    proj.nodes.push(createNode('room', { name: 'Ruangan 4' }))
    expect(nextRoomName(proj)).toBe('Ruangan 5')

    // Helper poligon bebas
    expect(polyTargetPoint([[0, 0]], { p: [2000, 250], kind: 'grid' }, true, false)).toEqual([2000, 0])
    expect(polyTargetPoint([[0, 0]], { p: [2000, 250], kind: 'end' }, true, false)).toEqual([2000, 250])
    expect(isClosingPolyPoint([[0, 0], [3000, 0], [3000, 2000]], [0.2, 0.2])).toBe(true)
    expect(isClosingPolyPoint([[0, 0], [3000, 0]], [0, 0])).toBe(false)
  })

  it('edit sudut & sisi ruangan: klik ganda tambah titik + tarik sisi jadi L terbalik + klik ganda hapus titik (port test.js 4c)', () => {
    const r0 = createNode('room', { W: 6000, H: 4000 })
    const r1 = applyGripDblClick(r0, 'e0') as RoomNode
    expect(r1).not.toBeNull()
    expect(r1.pts).toHaveLength(5)

    // Tarik separuh sisi atas (e1) ke atas 1 m -> bentuk L terbalik 6 titik, luas 27 m²
    const r2 = applyGrip(r1, 'e1', [4500, -1000], 'mm', r1) as RoomNode
    expect(r2.pts).toEqual([[0, 1000], [3000, 1000], [3000, 0], [6000, 0], [6000, 5000], [0, 5000]])
    expect(r2.y).toBe(-1000)
    expect(r2.H).toBe(5000)
    expect(roomOuterAreaM2(r2)).toBeCloseTo(27, 4)

    // Klik ganda sudut v1 menghapus sudut tersebut
    const r3 = applyGripDblClick(r2, 'v1') as RoomNode
    expect(r3.pts).toHaveLength(5)
  })
})
