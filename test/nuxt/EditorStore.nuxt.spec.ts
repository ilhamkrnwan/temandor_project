import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ALL_LIBRARY_ITEMS,
  clickSelect,
  createLibraryNode,
  createNode,
  newProject,
  safeParseProject,
  selectAllIds,
  withLayers,
  worldPorts,
} from '../../shared/cad'
import { AUTOSAVE_DEBOUNCE_MS, useEditor } from '../../app/stores/editor'
import { createMemoryProjectStorage, type ProjectStorageAdapter } from '../../app/utils/projectStorage'

describe('Pinia store useEditor (undo/redo & autosave)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('3 perubahan lewat commit() -> undo 2 -> redo 1 menghasilkan state yang benar dan memangkas seleksi', async () => {
    const storage = createMemoryProjectStorage()
    const editor = useEditor()
    editor.setStorage(storage)
    await editor.openProject('p-uji', () => newProject({ name: 'Proyek Awal', unit: 'mm', scale: '1:100' }))

    // 1. Ubah nama proyek
    expect(editor.commit('Ubah nama', (p) => {
      p.name = 'Kantor A'
    })).toBe(true)

    // 2. Tambah komponen duct baru dan pilih komponen itu
    const duct = createNode('straight', { x: 500, y: 500, L: 1500 })
    expect(editor.commit('Tambah duct', (p) => {
      p.nodes.push(duct)
    })).toBe(true)
    editor.setSelection([duct.id])
    expect(editor.selectedIds.has(duct.id)).toBe(true)

    // 3. Ubah skala
    expect(editor.commit('Ubah skala', (p) => {
      p.scale = '1:50'
    })).toBe(true)

    expect(editor.undoCount).toBe(3)
    expect(editor.canUndo).toBe(true)
    expect(editor.canRedo).toBe(false)

    // Undo 1 (mundur dari perubahan skala)
    expect(editor.undo()).toBe(true)
    expect(editor.project.scale).toBe('1:100')
    expect(editor.selectedIds.has(duct.id)).toBe(true)

    // Undo 2 (mundur dari tambah duct -> seleksi komponen yang hilang otomatis bersih)
    expect(editor.undo()).toBe(true)
    expect(editor.project.name).toBe('Kantor A')
    expect(editor.project.nodes.some(n => n.id === duct.id)).toBe(false)
    expect(editor.selectedIds.size).toBe(0)

    // Redo 1 (kembali ke kondisi setelah tambah duct)
    expect(editor.redo()).toBe(true)
    expect(editor.project.name).toBe('Kantor A')
    expect(editor.project.scale).toBe('1:100')
    expect(editor.project.nodes.some(n => n.id === duct.id)).toBe(true)
    expect(editor.undoLabel).toBe('Tambah duct')
    expect(editor.redoLabel).toBe('Ubah skala')
  })

  it('autosave debounce 500 ms menulis ke penyimpanan dan openProject memuat ulang perubahan terakhir', async () => {
    vi.useFakeTimers()
    const storage = createMemoryProjectStorage()
    const saveSpy = vi.spyOn(storage, 'save')

    const editor = useEditor()
    editor.setStorage(storage)
    await editor.openProject('p-simpan', () => newProject({ name: 'Sebelum Edit' }))

    editor.commit('Edit 1', (p) => {
      p.name = 'Edit Pertama'
    })
    expect(editor.saveStatus).toBe('pending')

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 100)
    expect(saveSpy).not.toHaveBeenCalled()

    // Edit cepat kedua menggeser jendela debounce
    editor.commit('Edit 2', (p) => {
      p.name = 'Edit Terakhir'
    })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 100)
    expect(saveSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(editor.saveStatus).toBe('saved')
    expect(editor.saveStatusLabel).toMatch(/^Tersimpan /)

    // Simulasi reload halaman: Pinia baru membuka id yang sama dari storage yang sama
    setActivePinia(createPinia())
    const reloaded = useEditor()
    reloaded.setStorage(storage)
    await reloaded.openProject('p-simpan')

    expect(reloaded.project.name).toBe('Edit Terakhir')
    expect(reloaded.saveStatus).toBe('saved')
    expect(reloaded.canUndo).toBe(false)
  })

  it('menangani kegagalan penyimpanan tanpa crash dan menampilkan status gagal', async () => {
    const failingStorage: ProjectStorageAdapter = {
      async load() {
        return null
      },
      async save() {
        throw new Error('QuotaExceededError')
      },
      async remove() {},
      async list() {
        return []
      },
    }
    const editor = useEditor()
    editor.setStorage(failingStorage)
    await editor.openProject('p-gagal')

    editor.commit('Ubah nama', (p) => {
      p.name = 'Gagal Simpan'
    })
    const ok = await editor.flushSave()
    expect(ok).toBe(false)
    expect(editor.saveStatus).toBe('error')
    expect(editor.saveStatusLabel).toBe('Gagal simpan')
    expect(editor.saveError).toContain('QuotaExceededError')
  })

  it('commitDuctPath() menambahkan 2 duct + 1 elbow sebagai tepat satu langkah undo (M3-03)', async () => {
    const storage = createMemoryProjectStorage()
    const editor = useEditor()
    editor.setStorage(storage)
    await editor.openProject('p-duct-undo', () => newProject({ name: 'Jalur Duct', unit: 'inch' }))

    const initialCount = editor.project.nodes.length
    const added = editor.commitDuctPath([[0, 0], [3000, 0], [3000, 2000]])

    expect(added.map(n => n.type)).toEqual(['straight', 'elbow', 'straight'])
    expect(editor.project.nodes).toHaveLength(initialCount + 3)
    expect(editor.undoCount).toBe(1)

    // Satu kali undo menghapus ketiga komponen jalur duct sekaligus
    expect(editor.undo()).toBe(true)
    expect(editor.project.nodes).toHaveLength(initialCount)
    expect(editor.undoCount).toBe(0)

    // Satu kali redo mengembalikan ketiga komponen sekaligus
    expect(editor.redo()).toBe(true)
    expect(editor.project.nodes).toHaveLength(initialCount + 3)
    expect(editor.project.nodes.slice(initialCount).map(n => n.type)).toEqual(['straight', 'elbow', 'straight'])
  })

  it('semua 29 item library dapat ditaruh lewat placeNode() dan diurungkan bersih (M3-04)', async () => {
    const storage = createMemoryProjectStorage()
    const editor = useEditor()
    editor.setStorage(storage)
    await editor.openProject('p-lib-all', () => newProject({ name: 'Uji Library', unit: 'inch' }))

    const baseCount = editor.project.nodes.length

    for (const itemId of ALL_LIBRARY_ITEMS) {
      const node = createLibraryNode(itemId, {
        project: editor.project,
        ductSpec: editor.ductSpec,
        position: [1500, 1200],
      })
      const placed = editor.placeNode(node)
      expect(placed, `Gagal menaruh item library ${itemId}`).not.toBeNull()
      expect(editor.project.nodes).toHaveLength(baseCount + 1)

      expect(editor.undo()).toBe(true)
      expect(editor.project.nodes).toHaveLength(baseCount)
    }
  })

  it('updateSelectedProperty() mengubah lebar duct dengan koma desimal dalam 1 langkah undo dan memperbarui port (M3-10)', async () => {
    const storage = createMemoryProjectStorage()
    const editor = useEditor()
    editor.setStorage(storage)
    await editor.openProject('p-prop-undo', () => newProject({ name: 'Uji Properti', unit: 'inch' }))

    const duct = editor.placeNode(createNode('straight', { x: 1000, y: 1000, L: 1500, w: 24, h: 20 }))!
    editor.setSelection([duct.id])
    const undoBefore = editor.undoCount

    const res = editor.updateSelectedProperty('w', '16,5')
    expect(res.changed).toBe(true)
    expect(editor.undoCount).toBe(undoBefore + 1)

    const updated = editor.project.nodes.find(n => n.id === duct.id)!
    expect(updated.type === 'straight' && updated.w).toBe(16.5)
    expect(worldPorts(updated, 'inch')[0]!.w).toBe(16.5)

    // Satu langkah undo mengembalikan lebar dan port ke 24"
    expect(editor.undo()).toBe(true)
    const reverted = editor.project.nodes.find(n => n.id === duct.id)!
    expect(reverted.type === 'straight' && reverted.w).toBe(24)
    expect(worldPorts(reverted, 'inch')[0]!.w).toBe(24)
  })

  it('setLayerVisible() & setLayerLocked() memangkas seleksi, melarang pilih layer tersembunyi, dan bertahan setelah reload (M3-11)', async () => {
    const storage = createMemoryProjectStorage()
    const editor = useEditor()
    editor.setStorage(storage)
    await editor.openProject('p-layer', () => newProject({ name: 'Uji Layer', unit: 'mm' }))

    const ductSa = editor.placeNode(createNode('straight', { x: 1000, y: 1000, L: 1500, sys: 'SA' }))!
    const fcu = editor.placeNode(createNode('fcu', { x: 2500, y: 1000 }))!
    editor.setSelection([ductSa.id, fcu.id])

    // Sembunyikan layer SA -> ductSa keluar dari seleksi dan tidak bisa dipilih lagi
    expect(editor.setLayerVisible('sa', false)).toBe(true)
    expect(editor.selectedIds.has(ductSa.id)).toBe(false)
    expect(editor.selectedIds.has(fcu.id)).toBe(true)
    expect(clickSelect(editor.project, new Set(), ductSa.id, false).size).toBe(0)
    expect(selectAllIds(editor.project).has(ductSa.id)).toBe(false)

    // Kunci layer Equipment -> fcu keluar dari seleksi
    expect(editor.setLayerLocked('eq', true)).toBe(true)
    expect(editor.selectedIds.has(fcu.id)).toBe(false)
    expect(clickSelect(editor.project, new Set(), fcu.id, false).size).toBe(0)

    // Simpan lalu muat ulang dari storage -> status layer tersimpan di proyek
    expect(await editor.flushSave()).toBe(true)
    setActivePinia(createPinia())
    const reloaded = useEditor()
    reloaded.setStorage(storage)
    await reloaded.openProject('p-layer')
    expect(reloaded.project.layers.sa.on).toBe(false)
    expect(reloaded.project.layers.eq.lock).toBe(true)

    // withLayers & safeParseProject melengkapi proyek lama yang kehilangan kunci layer baru
    const legacy = JSON.parse(JSON.stringify(newProject())) as Record<string, unknown>
    const legacyLayers = { ...(legacy.layers as Record<string, unknown>) }
    delete legacyLayers.coret
    legacy.layers = legacyLayers
    const parsed = safeParseProject(legacy)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.layers.coret).toEqual({ on: true, lock: false })
    expect(withLayers(reloaded.project).layers.sa.on).toBe(false)
  })
})
