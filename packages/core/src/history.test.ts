import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_HISTORY,
  clearHistory,
  commitProject,
  createHistory,
  createNode,
  newProject,
  redoProject,
  undoProject,
} from './index'

describe('riwayat undo/redo proyek (history.ts)', () => {
  it('3 perubahan -> undo 2 -> redo 1 menghasilkan state yang tepat', () => {
    const history = createHistory()
    let project = newProject({ name: 'Awal', unit: 'mm', scale: '1:100' })
    const initialCount = project.nodes.length

    // Perubahan 1: ganti nama proyek
    const r1 = commitProject(history, project, 'Ubah nama', (draft) => {
      draft.name = 'Tahap 1'
    })
    expect(r1.changed).toBe(true)
    project = r1.project

    // Perubahan 2: tambah duct lurus
    const duct = createNode('straight', { x: 1000, y: 1000, L: 2000 })
    const r2 = commitProject(history, project, 'Tambah duct', (draft) => {
      draft.nodes.push(duct)
    })
    expect(r2.changed).toBe(true)
    project = r2.project
    const snapshotAfter2 = JSON.stringify(project)

    // Perubahan 3: ubah skala
    const r3 = commitProject(history, project, 'Ubah skala', (draft) => {
      draft.scale = '1:50'
    })
    expect(r3.changed).toBe(true)
    project = r3.project

    expect(history.past).toHaveLength(3)
    expect(history.future).toHaveLength(0)

    // Undo 1 (mundur dari Perubahan 3 -> state setelah Perubahan 2)
    const u1 = undoProject(history, project)
    expect(u1).not.toBeNull()
    expect(u1!.label).toBe('Ubah skala')
    project = u1!.project
    expect(project.scale).toBe('1:100')
    expect(project.nodes).toHaveLength(initialCount + 1)

    // Undo 2 (mundur dari Perubahan 2 -> state setelah Perubahan 1)
    const u2 = undoProject(history, project)
    expect(u2).not.toBeNull()
    expect(u2!.label).toBe('Tambah duct')
    project = u2!.project
    expect(project.name).toBe('Tahap 1')
    expect(project.nodes).toHaveLength(initialCount)
    expect(history.past).toHaveLength(1)
    expect(history.future).toHaveLength(2)

    // Redo 1 (maju ke Perubahan 2 -> state persis sama dengan setelah Perubahan 2)
    const re1 = redoProject(history, project)
    expect(re1).not.toBeNull()
    expect(re1!.label).toBe('Tambah duct')
    project = re1!.project
    expect(JSON.stringify(project)).toBe(snapshotAfter2)
    expect(project.name).toBe('Tahap 1')
    expect(project.nodes).toHaveLength(initialCount + 1)
    expect(project.scale).toBe('1:100')
    expect(history.past).toHaveLength(2)
    expect(history.future).toHaveLength(1)
  })

  it('mutasi tanpa perubahan tidak menambah riwayat dan commit baru mengosongkan redo', () => {
    const history = createHistory()
    let project = newProject({ name: 'Tetap' })

    const noop = commitProject(history, project, 'Tidak berubah', (draft) => {
      draft.name = 'Tetap'
    })
    expect(noop.changed).toBe(false)
    expect(noop.project).toBe(project)
    expect(history.past).toHaveLength(0)

    project = commitProject(history, project, 'Ubah 1', (draft) => {
      draft.name = 'Satu'
    }).project
    project = undoProject(history, project)!.project
    expect(history.future).toHaveLength(1)

    project = commitProject(history, project, 'Cabang baru', (draft) => {
      draft.name = 'Dua'
    }).project
    expect(history.future).toHaveLength(0)
    expect(redoProject(history, project)).toBeNull()

    clearHistory(history)
    expect(undoProject(history, project)).toBeNull()
  })

  it('membatasi riwayat maksimal 200 langkah (membuang langkah paling lama)', () => {
    expect(DEFAULT_MAX_HISTORY).toBe(200)
    const history = createHistory()
    let project = newProject({ name: 'Step 0' })

    for (let i = 1; i <= 205; i++) {
      project = commitProject(history, project, `Langkah ${i}`, (draft) => {
        draft.name = `Step ${i}`
      }).project
    }

    expect(history.past).toHaveLength(200)
    expect(history.past[0]?.label).toBe('Langkah 6')
    expect(history.past[199]?.label).toBe('Langkah 205')

    // Undo semua 200 langkah berhenti di Step 5 (5 langkah awal sudah terbuang)
    let steps = 0
    while (true) {
      const prev = undoProject(history, project)
      if (!prev) break
      project = prev.project
      steps++
    }
    expect(steps).toBe(200)
    expect(project.name).toBe('Step 5')
  })
})
