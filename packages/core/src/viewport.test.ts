import { describe, expect, it } from 'vitest'
import {
  MAX_VIEWBOX_WIDTH,
  MIN_VIEWBOX_WIDTH,
  adaptiveGridStep,
  clientToWorld,
  fitViewBox,
  formatGridStep,
  panViewBox,
  pinchViewBox,
  pixelsPerMm,
  resizeViewBox,
  zoomViewBoxAt,
  zoomViewBoxCenter,
  zoomViewBoxToBounds,
  type ViewBox,
} from './index'

describe('matematika viewport (viewport.ts)', () => {
  it('pixelsPerMm() dan adaptiveGridStep() memilih langkah grid adaptif >= 12 px', () => {
    expect(pixelsPerMm([0, 0, 10_000, 5_000], 1000, 500)).toBeCloseTo(0.1, 9)
    expect(pixelsPerMm([0, 0, 0, 0], 1000, 500)).toBe(1)

    expect(adaptiveGridStep(2)).toBe(10)
    expect(adaptiveGridStep(0.12)).toBe(100)
    expect(adaptiveGridStep(0.05)).toBe(500)
    expect(adaptiveGridStep(0.005)).toBe(5000)
    expect(adaptiveGridStep(0.0001)).toBe(20_000)

    expect(formatGridStep(100)).toBe('Grid 100 mm')
    expect(formatGridStep(500)).toBe('Grid 500 mm')
    expect(formatGridStep(1000)).toBe('Grid 1 m')
    expect(formatGridStep(2000)).toBe('Grid 2 m')
  })

  it('zoomViewBoxAt() menahan titik kursor dunia tetap di posisi layar yang sama', () => {
    const vb: ViewBox = [0, 0, 10_000, 6_000]
    const anchor: [number, number] = [3000, 2000]
    const relXBefore = (anchor[0] - vb[0]) / vb[2]
    const relYBefore = (anchor[1] - vb[1]) / vb[3]

    const zoomedIn = zoomViewBoxAt(vb, anchor, 1 / 1.15)
    expect(zoomedIn[2]).toBeCloseTo(10_000 / 1.15, 6)
    expect((anchor[0] - zoomedIn[0]) / zoomedIn[2]).toBeCloseTo(relXBefore, 9)
    expect((anchor[1] - zoomedIn[1]) / zoomedIn[3]).toBeCloseTo(relYBefore, 9)

    // Batas minimum & maksimum zoom
    expect(zoomViewBoxAt(vb, anchor, 1e-6)[2]).toBeCloseTo(MIN_VIEWBOX_WIDTH, 6)
    expect(zoomViewBoxAt(vb, anchor, 1e6)[2]).toBeCloseTo(MAX_VIEWBOX_WIDTH, 6)
  })

  it('zoomViewBoxCenter(), fitViewBox(), dan zoomViewBoxToBounds() menghitung batas dengan benar', () => {
    const vb: ViewBox = [0, 0, 10_000, 5_000]
    const centered = zoomViewBoxCenter(vb, 0.5)
    expect(centered).toEqual([2500, 1250, 5000, 2500])

    const fitted = fitViewBox([0, 0, 10_000, 8_000])
    // margin = 10000 * 0.08 + 500 = 1300
    expect(fitted).toEqual([-1300, -1300, 12_600, 10_600])

    const selZoom = zoomViewBoxToBounds([0, 0, 10_000, 5_000], [1000, 1000, 3000, 2000])
    expect(selZoom[0] + selZoom[2] / 2).toBeCloseTo(2000, 6)
    expect(selZoom[1] + selZoom[3] / 2).toBeCloseTo(1500, 6)
    expect(selZoom[2] / selZoom[3]).toBeCloseTo(2, 6)
  })

  it('clientToWorld(), panViewBox(), pinchViewBox(), dan resizeViewBox() menggeser dan menskalakan viewBox akurat', () => {
    const vb: ViewBox = [1000, 500, 10_000, 6_000]
    const rect = { left: 100, top: 50, width: 1200, height: 600 }
    // Skala meet = min(1200/10000, 600/6000) = 0.1 px/mm, offsetX = (1200 - 1000)/2 = 100 px
    expect(clientToWorld(vb, rect, 200, 50)).toEqual([1000, 500])
    expect(clientToWorld(vb, rect, 700, 350)).toEqual([6000, 3500])

    // Geser pointer ke kanan 100 px pada skala 0.1 px/mm -> viewBox geser kiri 1000 mm
    expect(panViewBox(vb, 100, -50, 0.1)).toEqual([0, 1000, 10_000, 6_000])

    // Pinch melebar 2x (zoom in 2x) sambil geser midpoint: titik dunia di bawah midpoint lama tetap di midpoint baru
    const prevMid: [number, number] = [400, 250]
    const nextMid: [number, number] = [460, 220]
    const worldBefore = clientToWorld(vb, rect, prevMid[0], prevMid[1])
    const pinched = pinchViewBox(vb, rect, prevMid, nextMid, 100, 200)
    expect(pinched[2]).toBeCloseTo(5000, 6)
    expect(pinched[3]).toBeCloseTo(3000, 6)
    const worldAfter = clientToWorld(pinched, rect, nextMid[0], nextMid[1])
    expect(worldAfter[0]).toBeCloseTo(worldBefore[0], 6)
    expect(worldAfter[1]).toBeCloseTo(worldBefore[1], 6)

    // Resize kanvas melebar dari 1000px ke 1200px pada skala 0.1 px/mm -> viewBox melebar 2000 mm tanpa melar
    const resized = resizeViewBox(
      [0, 0, 10_000, 6_000],
      { left: 0, top: 0, width: 1000, height: 600 },
      { left: 0, top: 0, width: 1200, height: 600 },
      0.1,
    )
    expect(resized).toEqual([0, 0, 12_000, 6_000])
  })
})
