import { describe, expect, it } from 'vitest'
import {
  AI_TOOLS,
  demoProject,
  newProject,
  runTool,
  toolDefs,
  toolReadOnly,
} from './index'

describe('aksi gambar murni untuk AI & MCP (M6-01)', () => {
  it('get_project & list_types bersifat read-only dan membaca demoProject() dengan akurat', () => {
    const demo = demoProject()

    expect(toolReadOnly('get_project')).toBe(true)
    expect(toolReadOnly('list_types')).toBe(true)
    expect(toolReadOnly('add_nodes')).toBe(false)
    expect(toolReadOnly('draw_duct')).toBe(false)
    expect(toolReadOnly('update_nodes')).toBe(false)
    expect(toolReadOnly('delete_nodes')).toBe(false)
    expect(AI_TOOLS).toHaveLength(6)
    expect(toolDefs()).toHaveLength(6)

    const proj = runTool(demo, 'get_project') as {
      name: string
      unit_duct: string
      nodes: Array<{ id: string, type: string }>
      flows: Array<{ id: string, total: number }>
      warnings: Array<{ kind: string }>
    }
    expect(proj.unit_duct).toBe('inch')
    expect(proj.nodes.length).toBe(demo.nodes.length)
    expect(proj.warnings.map(w => w.kind).sort()).toEqual(['open', 'size'])
    expect(proj.flows.map(f => f.total).sort((a, b) => a - b)).toEqual([150, 1300])

    const listed = runTool(demo, 'list_types') as {
      room_shapes: string[]
      types: Array<{ type: string, name: string }>
    }
    expect(listed.room_shapes).toEqual(expect.arrayContaining(['rect', 'L', 'T', 'U']))
    expect(listed.types.length).toBe(30)
  })

  it('add_nodes, draw_duct, update_nodes, dan delete_nodes bekerja pada proyek baru maupun demoProject()', () => {
    const project = newProject({ unit: 'mm' })
    const room = project.nodes[0]!

    // Tambah FCU + pintu (otomatis menempel dinding atas)
    const added = runTool(project, 'add_nodes', {
      nodes: [
        { type: 'fcu', x: 1500, y: 1000 },
        { type: 'door', x: 3000, y: 10 },
      ],
    }) as { added: Array<{ id: string, type: string, host?: { room: string } }> }
    expect(added.added).toHaveLength(2)
    expect(added.added[1]!.host?.room).toBe(room.id)

    // Gambar jalur duct 3 titik -> lurus + elbow + lurus
    const duct = runTool(project, 'draw_duct', {
      points: [[2100, 1000], [4000, 1000], [4000, 3000]],
      w: 400,
      h: 300,
    }) as { added: Array<{ id: string, type: string }> }
    expect(duct.added.map(n => n.type)).toEqual(['straight', 'elbow', 'straight'])

    // Ubah lebar, nama, dan bentuk ruangan
    const updated = runTool(project, 'update_nodes', {
      updates: [{ id: room.id, props: { W: 8000, name: 'Lobby', shape: 'L' } }],
    }) as { updated: Array<{ W: number, name: string, pts: unknown[] }> }
    expect(updated.updated[0]!.W).toBe(8000)
    expect(updated.updated[0]!.name).toBe('Lobby')
    expect(updated.updated[0]!.pts.length).toBe(6)

    // Hapus FCU
    const delFcu = runTool(project, 'delete_nodes', { ids: [added.added[0]!.id] }) as { deleted: string[] }
    expect(delFcu.deleted).toEqual([added.added[0]!.id])
    expect(project.nodes.some(n => n.id === added.added[0]!.id)).toBe(false)

    // Hapus ruangan -> pintu yang menempel di dinding ruangan ikut terhapus
    runTool(project, 'delete_nodes', { ids: [room.id] })
    expect(project.nodes.some(n => n.id === added.added[1]!.id)).toBe(false)

    // Tipe tidak dikenal, tool tidak dikenal, dan input tidak valid ditolak dengan pesan jelas
    expect(() => runTool(project, 'add_nodes', { nodes: [{ type: 'naga', x: 0, y: 0 }] })).toThrow(/naga/)
    expect(() => runTool(project, 'tool_asing', {})).toThrow(/tidak ada/)
    expect(() => runTool(project, 'draw_duct', { points: [[0, 0]] })).toThrow(/Minimal 2 titik/)
    expect(() => runTool(project, 'delete_nodes', { ids: ['id-gaib'] })).toThrow(/tidak ada/)
  })
})
