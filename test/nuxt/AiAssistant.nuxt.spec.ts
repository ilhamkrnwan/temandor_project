import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newProject } from '../../shared/cad'
import { useEditor } from '../../app/stores/editor'
import { createMemoryProjectStorage } from '../../app/utils/projectStorage'
import {
  executeAiToolBatchOnProject,
  formatAiError,
  runAiTurn,
  type AiConversationMessage,
  type AiMessagesClient,
  type AiUiEvent,
} from '../../app/utils/aiAssistant'

describe('asisten AI loop tool & undo (M6-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('menjalankan loop multi-langkah (get_project -> add_nodes -> draw_duct -> jawaban) dengan 1 langkah undo per perubahan', async () => {
    const editor = useEditor()
    editor.setStorage(createMemoryProjectStorage())
    await editor.openProject('p-ai', () => newProject({ name: 'Uji AI', unit: 'mm' }))

    const initialNodeCount = editor.project.nodes.length
    const conversation: AiConversationMessage[] = []
    const events: AiUiEvent[] = []
    const focusedBatches: string[][] = []

    const createMessage = vi.fn<AiMessagesClient['createMessage']>()
      // Langkah 1: read-only get_project (tidak menambah undo)
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu-1', name: 'get_project', input: {} },
        ],
      })
      // Langkah 2: mutating batch (add_nodes + draw_duct dalam 1 langkah undo!)
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu-2',
            name: 'add_nodes',
            input: { nodes: [{ type: 'fcu', x: 1500, y: 1200 }] },
          },
          {
            type: 'tool_use',
            id: 'tu-3',
            name: 'draw_duct',
            input: { points: [[2100, 1200], [4000, 1200], [4000, 2800]], w: 400, h: 300 },
          },
        ],
      })
      // Langkah 3: jawaban teks akhir
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'FCU dan jalur duct 3 titik sudah ditambahkan.' },
        ],
      })

    await runAiTurn({
      client: { createMessage },
      conversation,
      userPrompt: 'Pasang FCU dan jalur duct ke kanan lalu belok bawah',
      executeBatch: uses => executeAiToolBatchOnProject(
        uses,
        () => editor.project,
        (label, mutator) => editor.commit(label, mutator),
        () => editor.undoCount,
      ),
      onChangedSelection: ids => focusedBatches.push(ids),
      onEvent: ev => events.push(ev),
    })

    expect(createMessage).toHaveBeenCalledTimes(3)
    // 1 FCU + 2 straight + 1 elbow = 4 node baru, semua dalam TEPAT 1 langkah undo
    expect(editor.project.nodes).toHaveLength(initialNodeCount + 4)
    expect(editor.undoCount).toBe(1)
    expect(focusedBatches).toHaveLength(1)
    expect(focusedBatches[0]).toHaveLength(4)

    // Event tool read-only tidak punya tombol undo, sedangkan batch mutating punya undoMark = 1
    const toolEvents = events.filter(e => e.kind === 'tools')
    expect(toolEvents).toHaveLength(2)
    expect(toolEvents[0]!.canUndo).toBe(false)
    expect(toolEvents[1]!.canUndo).toBe(true)
    expect(toolEvents[1]!.undoMark).toBe(1)

    const textEvents = events.filter(e => e.kind === 'text')
    expect(textEvents[0]?.text).toContain('FCU dan jalur duct')

    // Satu kali undo menghapus seluruh 4 node dari langkah AI
    expect(editor.undo()).toBe(true)
    expect(editor.project.nodes).toHaveLength(initialNodeCount)
  })

  it('mengembalikan is_error ke model untuk tool gagal dan memformat error API dengan ramah', async () => {
    const editor = useEditor()
    editor.setStorage(createMemoryProjectStorage())
    await editor.openProject('p-ai-err', () => newProject({ name: 'Uji Error', unit: 'mm' }))

    const conversation: AiConversationMessage[] = []
    const events: AiUiEvent[] = []
    const createMessage = vi.fn<AiMessagesClient['createMessage']>()
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu-bad', name: 'add_nodes', input: { nodes: [{ type: 'naga', x: 0, y: 0 }] } },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Tipe naga tidak tersedia.' }],
      })

    await runAiTurn({
      client: { createMessage },
      conversation,
      userPrompt: 'Tambah naga',
      executeBatch: uses => executeAiToolBatchOnProject(
        uses,
        () => editor.project,
        (label, mutator) => editor.commit(label, mutator),
        () => editor.undoCount,
      ),
      onEvent: ev => events.push(ev),
    })

    const toolEv = events.find(e => e.kind === 'tools')
    expect(toolEv?.records[0]?.isError).toBe(true)

    expect(formatAiError({ status: 401 })).toContain('Kunci API ditolak')
    expect(formatAiError({ status: 429 })).toContain('Terlalu banyak permintaan')
    expect(formatAiError({ name: 'APIConnectionError' })).toContain('api.anthropic.com')
  })
})
