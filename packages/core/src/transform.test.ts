import { describe, expect, it } from 'vitest'
import {
  alignSelectedInPlace,
  applyGrip,
  applyGripDblClick,
  cloneNodesForPaste,
  commitProject,
  computeMoveDelta,
  connect,
  createHistory,
  createNode,
  ctxOf,
  groupSelectedInPlace,
  isSelectionGrouped,
  lockSelectedInPlace,
  mirrorSelectedInPlace,
  newProject,
  nodeBounds,
  nodeGrips,
  previewMovedNodes,
  reorderSelectedInPlace,
  rotateSelectedInPlace,
  translateSelectedInPlace,
  undoProject,
  ungroupSelectedInPlace,
  type StraightNode,
} from './index'

describe('transformasi komponen & grip murni (grips.ts, transform.ts)', () => {
  it('pindah (geser + snap port), putar (R), cermin (M), salin/tempel masing-masing 1 langkah undo', () => {
    const history = createHistory()
    let project = newProject({ name: 'Uji Edit', unit: 'inch', W: 6000, H: 4000 })
    const duct = createNode('straight', { x: 1000, y: 1500, L: 1500, w: 20, h: 16 })
    const locked = createNode('diffuser', { x: 4000, y: 1500, lock: true })
    project.nodes.push(duct, locked)

    const sel = new Set([duct.id, locked.id])

    // 1. Geser 100 mm ke kanan: duct bergerak, locked tetap di posisi semula
    project = commitProject(history, project, 'Geser', (draft) => {
      translateSelectedInPlace(draft, sel, 100, -50)
    }).project
    expect(project.nodes.find(n => n.id === duct.id)).toMatchObject({ x: 1100, y: 1450 })
    expect(project.nodes.find(n => n.id === locked.id)).toMatchObject({ x: 4000, y: 1500 })

    // 2. Putar 90° (R): hanya duct yang diputar
    project = commitProject(history, project, 'Putar', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      rotateSelectedInPlace(draft, new Set([duct.id]), 90, 100, ctx)
    }).project
    expect(project.nodes.find(n => n.id === duct.id)?.rot).toBe(90)

    // 3. Cermin tunggal (M): membalik `mir`
    project = commitProject(history, project, 'Cermin', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      mirrorSelectedInPlace(draft, new Set([duct.id]), ctx)
    }).project
    expect(project.nodes.find(n => n.id === duct.id)?.mir).toBe(true)

    // 4. Salin & tempel (Ctrl+C / Ctrl+V) mempertahankan group baru & memberi ID unik
    const ctx = ctxOf(project, connect(project))
    const pasted = cloneNodesForPaste([project.nodes.find(n => n.id === duct.id)!], null, 100, ctx)
    expect(pasted).toHaveLength(1)
    expect(pasted[0]!.id).not.toBe(duct.id)
    expect(pasted[0]!.x).toBe(project.nodes.find(n => n.id === duct.id)!.x + 500)

    project = commitProject(history, project, 'Tempel', (draft) => {
      draft.nodes.push(...pasted)
    }).project
    expect(history.past).toHaveLength(4)

    // Undo 4 kali mengembalikan duct ke kondisi awal (1000, 1500, rot 0, mir false)
    for (let i = 0; i < 4; i++) {
      project = undoProject(history, project)!.project
    }
    expect(project.nodes.find(n => n.id === duct.id)).toMatchObject({ x: 1000, y: 1500, rot: 0, mir: false })
  })

  it('computeMoveDelta() melakukan snap grid dan magnet ke port terbuka terdekat', () => {
    const project = newProject({ name: 'Snap Move', unit: 'mm' })
    const anchor = createNode('straight', { x: 0, y: 0, L: 1000 }) // port b di (1000, 0) arah 0°
    const moving = createNode('straight', { x: 2000, y: 0, L: 1000 }) // port a di (2000, 0) arah 180°
    project.nodes.push(anchor, moving)

    const cn = connect(project)
    const movingIds = new Set([moving.id])
    const openPorts = cn.open.filter(p => !movingIds.has(p.node.id))

    // Geser mendekati (1000, 0) sejauh -995 -> harus menempel tepat -1000
    const [dx, dy] = computeMoveDelta(project, movingIds, -995, 3, {
      snapEnabled: true,
      gridStep: 100,
      pxPerMm: 1,
      openPorts,
    })
    expect([dx, dy]).toEqual([-1000, 0])

    const ghosts = previewMovedNodes(project, movingIds, dx, dy)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]!.x).toBe(1000)
  })

  it('nodeGrips(), applyGrip(), dan applyGripDblClick() mengubah panjang/ukuran/sudut ruangan dengan akurat', () => {
    // Duct lurus: grip 'b' (biru panjang) dan grip 'w' (putih ukuran)
    const duct = createNode('straight', { x: 0, y: 0, L: 1500, w: 20, h: 16 }) as StraightNode
    const grips = nodeGrips(duct, 'inch')
    expect(grips.map(g => [g.id, g.kind])).toEqual([
      ['a', 'pos'],
      ['b', 'pos'],
      ['w', 'size'],
    ])

    const longer = applyGrip(duct, 'b', [2200, 0], 'inch') as StraightNode
    expect(longer.L).toBe(2200)

    // Tarik grip lebar 'w' dari tengah (y = 381 mm -> 2*381 / 25.4 = 30 inch, h ikut rasio 16*30/20 = 24 inch)
    const wider = applyGrip(duct, 'w', [750, 381], 'inch') as StraightNode
    expect(wider.w).toBe(30)
    expect(wider.h).toBe(24)

    // Tarik grip 'a' ke kanan 300 mm -> x geser +300, L berkurang 300
    const trimmed = applyGrip(duct, 'a', [300, 0], 'inch') as StraightNode
    expect(trimmed.x).toBe(300)
    expect(trimmed.L).toBe(1200)

    // Diffuser: grip putih 's' mengubah F kelipatan 50 mm
    const dif = createNode('diffuser', { x: 0, y: 0, F: 600 })
    expect(nodeGrips(dif, 'inch')[0]?.kind).toBe('size')
    const biggerDif = applyGrip(dif, 's', [810, 405], 'inch')
    expect(biggerDif.type === 'diffuser' && biggerDif.F).toBe(800)

    // Ruangan: klik ganda sisi e0 menambah sudut ke-5, klik ganda sudut v0 menghapus kembali jadi 4
    const room = createNode('room', { x: 0, y: 0, W: 6000, H: 4000 })
    const roomGrips = nodeGrips(room, 'mm')
    expect(roomGrips.filter(g => g.kind === 'pos')).toHaveLength(4)
    expect(roomGrips.filter(g => g.kind === 'edge')).toHaveLength(4)

    const fiveVerts = applyGripDblClick(room, 'e0')
    expect(fiveVerts?.type === 'room' && fiveVerts.pts?.length).toBe(5)

    const backFour = applyGripDblClick(fiveVerts!, 'v1')
    expect(backFour?.type === 'room' && backFour.pts?.length).toBe(4)
  })

  it('group, ungroup, rata (6 arah + group sebagai kesatuan), kunci, dan urutan masing-masing 1 langkah undo', () => {
    const history = createHistory()
    let project = newProject({ name: 'Uji Tata Letak', unit: 'mm', W: 8000, H: 6000 })
    const a = createNode('column', { x: 1000, y: 1000, cw: 400, cd: 400 })
    const b = createNode('column', { x: 2000, y: 1500, cw: 400, cd: 400 })
    const c = createNode('column', { x: 4000, y: 3000, cw: 400, cd: 400 })
    project.nodes.push(a, b, c)

    // 1. Group a + b
    project = commitProject(history, project, 'Group', (draft) => {
      groupSelectedInPlace(draft, new Set([a.id, b.id]))
    }).project
    expect(isSelectionGrouped(project, new Set([a.id, b.id]))).toBe(true)

    // 2. Rata kanan antara group(a+b) dan c: a dan b bergeser bersama menjaga jarak relatif 1000 mm
    project = commitProject(history, project, 'Rata kanan', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      alignSelectedInPlace(draft, new Set([a.id, b.id, c.id]), 'right', ctx)
    }).project
    const aAfterRight = project.nodes.find(n => n.id === a.id)!
    const bAfterRight = project.nodes.find(n => n.id === b.id)!
    const cAfterRight = project.nodes.find(n => n.id === c.id)!
    expect(bAfterRight.x - aAfterRight.x).toBe(1000)
    expect(bAfterRight.x).toBe(cAfterRight.x)

    // 3. Ungroup a + b, lalu rata atas semua 3 kolom
    project = commitProject(history, project, 'Ungroup', (draft) => {
      ungroupSelectedInPlace(draft, new Set([a.id, b.id]))
    }).project
    expect(isSelectionGrouped(project, new Set([a.id, b.id]))).toBe(false)

    project = commitProject(history, project, 'Rata atas', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      alignSelectedInPlace(draft, new Set([a.id, b.id, c.id]), 'top', ctx)
    }).project
    const ctxTop = ctxOf(project, connect(project))
    const topY = nodeBounds(project.nodes.find(n => n.id === a.id)!, ctxTop)[1]
    expect(nodeBounds(project.nodes.find(n => n.id === b.id)!, ctxTop)[1]).toBe(topY)
    expect(nodeBounds(project.nodes.find(n => n.id === c.id)!, ctxTop)[1]).toBe(topY)

    // 4. Kunci & buka kunci c
    project = commitProject(history, project, 'Kunci', (draft) => {
      lockSelectedInPlace(draft, new Set([c.id]), true)
    }).project
    expect(project.nodes.find(n => n.id === c.id)?.lock).toBe(true)

    project = commitProject(history, project, 'Buka kunci', (draft) => {
      lockSelectedInPlace(draft, new Set([c.id]), false)
    }).project
    expect(project.nodes.find(n => n.id === c.id)?.lock).toBeUndefined()

    // 5. Urutan ke depan (]) dan ke belakang ([)
    project = commitProject(history, project, 'Ke depan', (draft) => {
      reorderSelectedInPlace(draft, new Set([a.id]), 'front')
    }).project
    expect(project.nodes.at(-1)?.id).toBe(a.id)

    project = commitProject(history, project, 'Ke belakang', (draft) => {
      reorderSelectedInPlace(draft, new Set([a.id]), 'back')
    }).project
    expect(project.nodes[0]?.id).toBe(a.id)

    // Undo semua 8 langkah kembali ke keadaan awal
    expect(history.past).toHaveLength(8)
    for (let i = 0; i < 8; i++) {
      project = undoProject(history, project)!.project
    }
    expect(project.nodes.find(n => n.id === a.id)).toMatchObject({ x: 1000, y: 1000 })
    expect(project.nodes.find(n => n.id === c.id)?.lock).toBeUndefined()
  })
})
