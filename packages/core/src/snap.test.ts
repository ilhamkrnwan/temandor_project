import { describe, expect, it } from 'vitest'
import {
  createNode,
  cursorMeasure,
  newProject,
  orthoPoint,
  rectMeasure,
  snapAt,
} from './index'

describe('snap & ortho murni (snap.ts)', () => {
  it('snap ke port terbuka, ujung (end), tengah (mid), grid, dan nonaktif (none)', () => {
    const project = newProject({ name: 'Uji Snap', W: 6000, H: 4000 })
    // Tambah duct lurus di tengah ruangan: (1000, 2000) -> (3000, 2000)
    // Port a = (1000, 2000), Port b = (3000, 2000), tengah = (2000, 2000)
    const duct = createNode('straight', { x: 1000, y: 2000, L: 2000 })
    const wall = createNode('partition', { x: 1000, y: 3200, L: 2000 })
    project.nodes.push(duct, wall)

    // 1. Snap port terbuka (prioritas tertinggi di dekat ujung duct)
    const portSnap = snapAt(project, [1005, 2004], { pxPerMm: 1, tolerancePx: 14, gridStep: 100 })
    expect(portSnap.kind).toBe('port')
    expect(portSnap.p).toEqual([1000, 2000])
    expect(portSnap.port?.node.id).toBe(duct.id)

    // 2. Snap ujung (end): sudut ruangan (6000, 0) & ujung partisi (1000, 3200)
    const cornerSnap = snapAt(project, [5995, 6], { pxPerMm: 1, tolerancePx: 14, gridStep: 100 })
    expect(cornerSnap.kind).toBe('end')
    expect(cornerSnap.p).toEqual([6000, 0])

    const wallEndSnap = snapAt(project, [1006, 3196], { pxPerMm: 1, tolerancePx: 14, gridStep: 100 })
    expect(wallEndSnap.kind).toBe('end')
    expect(wallEndSnap.p).toEqual([1000, 3200])
    expect(wallEndSnap.nodeId).toBe(wall.id)

    // 3. Snap tengah (mid): titik tengah duct (2000, 2000) & titik tengah dinding ruangan atas (3000, 0)
    const ductMidSnap = snapAt(project, [2005, 1996], { pxPerMm: 1, tolerancePx: 14, gridStep: 100 })
    expect(ductMidSnap.kind).toBe('mid')
    expect(ductMidSnap.p).toEqual([2000, 2000])
    expect(ductMidSnap.nodeId).toBe(duct.id)

    const roomMidSnap = snapAt(project, [2996, 4], { pxPerMm: 1, tolerancePx: 14, gridStep: 100 })
    expect(roomMidSnap.kind).toBe('mid')
    expect(roomMidSnap.p).toEqual([3000, 0])

    // 4. Snap grid: jauh dari port/ujung/tengah
    const gridSnap = snapAt(project, [4142, 2368], { pxPerMm: 1, tolerancePx: 14, gridStep: 100 })
    expect(gridSnap.kind).toBe('grid')
    expect(gridSnap.p).toEqual([4100, 2400])

    // 5. Snap dimatikan (F3 OFF) -> mengembalikan titik asli tanpa pembulatan
    const offSnap = snapAt(project, [1005, 2004], { enabled: false, gridStep: 100 })
    expect(offSnap.kind).toBe('none')
    expect(offSnap.p).toEqual([1005, 2004])
  })

  it('menghormati closePoint, skipIds, dan layer tersembunyi', () => {
    const project = newProject({ name: 'Filter Snap', W: 4000, H: 4000 })
    const duct = createNode('straight', { x: 1000, y: 1000, L: 1000 })
    project.nodes.push(duct)

    // closePoint mengalahkan target lain saat menutup poligon
    const close = snapAt(project, [1002, 1002], {
      pxPerMm: 1,
      tolerancePx: 14,
      closePoint: [1000, 1000],
    })
    expect(close.kind).toBe('end')
    expect(close.p).toEqual([1000, 1000])

    // skipIds melewati duct sendiri sehingga jatuh ke grid
    const skipped = snapAt(project, [1005, 1005], {
      pxPerMm: 1,
      tolerancePx: 14,
      gridStep: 50,
      skipIds: new Set([duct.id]),
    })
    expect(skipped.kind).toBe('grid')
    expect(skipped.p).toEqual([1000, 1000])

    // Layer SA disembunyikan -> port duct tidak di-snap
    project.layers.sa.on = false
    const hiddenLayer = snapAt(project, [1005, 1005], {
      pxPerMm: 1,
      tolerancePx: 14,
      gridStep: 50,
    })
    expect(hiddenLayer.kind).toBe('grid')
  })

  it('orthoPoint() mengunci horizontal/vertikal dan Shift membalik sementara', () => {
    // ORTHO aktif: dominan horizontal -> kunci Y
    expect(orthoPoint([100, 200], [450, 260], true, false)).toEqual([450, 200])
    // ORTHO aktif: dominan vertikal -> kunci X
    expect(orthoPoint([100, 200], [140, 520], true, false)).toEqual([100, 520])
    // ORTHO aktif + tahan Shift -> bebas sudut sementara
    expect(orthoPoint([100, 200], [450, 260], true, true)).toEqual([450, 260])
    // ORTHO nonaktif -> bebas sudut
    expect(orthoPoint([100, 200], [450, 260], false, false)).toEqual([450, 260])
    // ORTHO nonaktif + tahan Shift -> kunci ortho sementara
    expect(orthoPoint([100, 200], [450, 260], false, true)).toEqual([450, 200])
  })

  it('cursorMeasure() dan rectMeasure() menghitung panjang, sudut AutoCAD, dan dimensi kotak', () => {
    // Kanan (0°), Atas (90°, Y SVG mengecil), Kiri (180°), Bawah (270°, Y SVG membesar)
    expect(cursorMeasure([0, 0], [1200, 0])).toEqual({ lengthMm: 1200, angleDeg: 0, label: '1200 mm  0°' })
    expect(cursorMeasure([0, 0], [0, -800])).toEqual({ lengthMm: 800, angleDeg: 90, label: '800 mm  90°' })
    expect(cursorMeasure([0, 0], [-500, 0])).toEqual({ lengthMm: 500, angleDeg: 180, label: '500 mm  180°' })
    expect(cursorMeasure([0, 0], [0, 600])).toEqual({ lengthMm: 600, angleDeg: 270, label: '600 mm  270°' })
    expect(cursorMeasure([0, 0], [1000, -1000])).toEqual({ lengthMm: 1414, angleDeg: 45, label: '1414 mm  45°' })

    expect(rectMeasure([100, 200], [6100, 4200])).toEqual({
      widthMm: 6000,
      heightMm: 4000,
      label: '6000 × 4000 mm',
    })
  })
})
