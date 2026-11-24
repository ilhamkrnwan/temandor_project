import { describe, expect, it } from 'vitest'
import {
  clickSelect,
  connect,
  createNode,
  ctxOf,
  deletableSelectedIds,
  movableSelectedIds,
  newProject,
  selectAllIds,
  selectByBox,
  stepTabSelection,
} from './index'

describe('logika seleksi murni (select.ts)', () => {
  it('clickSelect() mendukung klik tunggal, Shift+klik, group, dan komponen terkunci tetap bisa dipilih', () => {
    const project = newProject({ name: 'Uji Seleksi', W: 6000, H: 4000 })
    const a = createNode('diffuser', { x: 1000, y: 1000, g: 'grp1' })
    const b = createNode('diffuser', { x: 2000, y: 1000, g: 'grp1' })
    const lockedComp = createNode('fcu', { x: 3500, y: 1500, lock: true })
    const layerLockedComp = createNode('straight', { x: 1000, y: 2500, L: 1000, sys: 'EA' })
    project.layers.ea.lock = true
    project.nodes.push(a, b, lockedComp, layerLockedComp)

    // Klik salah satu anggota group memilih seluruh group
    let sel = clickSelect(project, new Set(), a.id, false)
    expect([...sel].sort()).toEqual([a.id, b.id].sort())

    // Shift+klik komponen terkunci tetap menambahkannya ke seleksi agar bisa dibuka kuncinya
    sel = clickSelect(project, sel, lockedComp.id, true)
    expect(sel.has(lockedComp.id)).toBe(true)
    expect(sel.size).toBe(3)

    // Namun komponen terkunci TIDAK masuk daftar yang boleh digeser/dihapus
    expect(movableSelectedIds(project, sel).sort()).toEqual([a.id, b.id].sort())
    expect(deletableSelectedIds(project, sel).sort()).toEqual([a.id, b.id].sort())

    // Shift+klik lagi pada anggota group menghapus seluruh group dari seleksi
    sel = clickSelect(project, sel, b.id, true)
    expect([...sel]).toEqual([lockedComp.id])

    // Komponen pada layer terkunci tidak dapat dipilih
    const afterLockedLayer = clickSelect(project, sel, layerLockedComp.id, false)
    expect([...afterLockedLayer]).toEqual([lockedComp.id])
  })

  it('selectByBox() membedakan window (kiri->kanan) dan crossing (kanan->kiri)', () => {
    const project = newProject({ name: 'Uji Kotak', W: 8000, H: 6000 })
    const room = project.nodes[0]!
    const d1 = createNode('diffuser', { x: 1500, y: 1500, F: 600 })
    const d2 = createNode('straight', { x: 2500, y: 1500, L: 3000 })
    const locked = createNode('diffuser', { x: 1500, y: 2500, F: 600, lock: true })
    project.nodes.push(d1, d2, locked)

    const ctx = ctxOf(project, connect(project))

    // Window (kiri -> kanan): hanya d1 yang seluruh bbox-nya berada di dalam [1000..3000, 900..2600]
    // d2 keluar ke kanan (x sampai 5500), room keluar ke segala arah, locked diabaikan kotak tarik
    const win = selectByBox(project, [1000, 900], [3000, 2600], ctx)
    expect(win.mode).toBe('window')
    expect([...win.ids]).toEqual([d1.id])

    // Crossing (kanan -> kiri) pada area yang sama: d1, d2, dan room semua bersinggungan (locked tetap dilewati)
    const cross = selectByBox(project, [3000, 2600], [1000, 900], ctx)
    expect(cross.mode).toBe('crossing')
    expect(cross.ids.has(d1.id)).toBe(true)
    expect(cross.ids.has(d2.id)).toBe(true)
    expect(cross.ids.has(room.id)).toBe(true)
    expect(cross.ids.has(locked.id)).toBe(false)
  })

  it('stepTabSelection() melangkah per komponen/group, menyertakan komponen terkunci, dan keluar kanvas di ujung', () => {
    const project = newProject({ name: 'Uji Tab', W: 5000, H: 4000 })
    const room = project.nodes[0]!
    const g1 = createNode('diffuser', { x: 1000, y: 1000, g: 'g' })
    const g2 = createNode('diffuser', { x: 2000, y: 1000, g: 'g' })
    const locked = createNode('fcu', { x: 3000, y: 1500, lock: true })
    project.nodes.push(g1, g2, locked)

    // Total 3 entri Tab: room, group(g1+g2), locked
    const s1 = stepTabSelection(project, new Set(), false)
    expect(s1.exitCanvas).toBe(false)
    expect(s1.total).toBe(3)
    expect([...s1.next]).toEqual([room.id])

    const s2 = stepTabSelection(project, s1.next, false)
    expect([...s2.next].sort()).toEqual([g1.id, g2.id].sort())

    const s3 = stepTabSelection(project, s2.next, false)
    expect([...s3.next]).toEqual([locked.id])

    // Tab setelah terakhir keluar dari kanvas (bukan jebakan fokus)
    const s4 = stepTabSelection(project, s3.next, false)
    expect(s4.exitCanvas).toBe(true)
    expect(s4.next.size).toBe(0)

    // Shift+Tab dari kosong masuk dari elemen terakhir
    const rev1 = stepTabSelection(project, new Set(), true)
    expect(rev1.exitCanvas).toBe(false)
    expect([...rev1.next]).toEqual([locked.id])

    // Ctrl+A memilih semua yang tampil & tidak terkunci
    const all = selectAllIds(project)
    expect(all.has(room.id)).toBe(true)
    expect(all.has(g1.id)).toBe(true)
    expect(all.has(g2.id)).toBe(true)
    expect(all.has(locked.id)).toBe(false)
  })
})
