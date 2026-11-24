import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createTemandorMcpServer, resolveProjectFile } from './server'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'temandor-mcp-'))
  tempDirs.push(dir)
  return dir
}

function parseToolJson(result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> {
  const items = Array.isArray(result.content) ? result.content as Array<{ type: string, text?: string }> : []
  const text = items.find(c => c.type === 'text')?.text ?? '{}'
  return JSON.parse(text) as Record<string, unknown>
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('server MCP Temandor (M6-03)', () => {
  it('resolveProjectFile menolak path traversal dan ekstensi non-json', () => {
    const dir = makeTempDir()
    expect(resolveProjectFile(dir, 'kantor.json')).toBe(path.join(dir, 'kantor.json'))
    expect(() => resolveProjectFile(dir, '../luar.json')).toThrow(/File harus \.json/)
    expect(() => resolveProjectFile(dir, 'sub/../../luar.json')).toThrow(/File harus \.json/)
    expect(() => resolveProjectFile(dir, 'catatan.txt')).toThrow(/File harus \.json/)
    expect(() => resolveProjectFile(dir, '')).toThrow(/File harus \.json/)
  })

  it('alur lengkap via MCP client: listTools -> create_project -> add_nodes -> draw_duct -> get_project -> update/delete -> export_dxf', async () => {
    const dir = makeTempDir()
    const server = createTemandorMcpServer(dir)
    const client = new Client({ name: 'temandor-test-client', version: '0.1.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await server.connect(serverTransport)
    await client.connect(clientTransport)

    try {
      // 1. Cek semua 9 tool terdaftar
      const listed = await client.listTools()
      const names = listed.tools.map(t => t.name).sort()
      expect(names).toEqual([
        'add_nodes',
        'create_project',
        'delete_nodes',
        'draw_duct',
        'export_dxf',
        'get_project',
        'list_projects',
        'list_types',
        'update_nodes',
      ])

      // 2. Buat proyek baru
      const createdRes = await client.callTool({
        name: 'create_project',
        arguments: { name: 'Kantor Uji MCP', unit: 'mm' },
      })
      expect(createdRes.isError).not.toBe(true)
      const created = parseToolJson(createdRes)
      expect(created.file).toBe('kantor-uji-mcp.json')
      expect(fs.existsSync(String(created.path))).toBe(true)

      // 3. Cek list_projects menampilkan file proyek baru
      const projectsRes = await client.callTool({ name: 'list_projects', arguments: {} })
      const projectsBody = parseToolJson(projectsRes) as { projects: Array<{ file: string, name: string, unit: string }> }
      expect(projectsBody.projects).toHaveLength(1)
      expect(projectsBody.projects[0]?.file).toBe('kantor-uji-mcp.json')
      expect(projectsBody.projects[0]?.unit).toBe('mm')

      // 4. Tambah FCU, diffuser, dan pintu yang menempel dinding ruangan
      const addRes = await client.callTool({
        name: 'add_nodes',
        arguments: {
          file: 'kantor-uji-mcp.json',
          nodes: [
            { type: 'fcu', x: 1000, y: 1500 },
            { type: 'diffuser', x: 4200, y: 2800, props: { flow: 300 } },
            { type: 'door', x: 3000, y: 4000 },
          ],
        },
      })
      expect(addRes.isError).not.toBe(true)
      const added = (parseToolJson(addRes) as { added: Array<{ id: string, type: string, host?: unknown }> }).added
      expect(added).toHaveLength(3)
      const door = added.find(n => n.type === 'door')
      expect(door?.host).toBeDefined()

      // 5. Gambar jalur duct 3 titik (2 straight + 1 elbow otomatis)
      const ductRes = await client.callTool({
        name: 'draw_duct',
        arguments: {
          file: 'kantor-uji-mcp.json',
          points: [[1600, 1500], [4200, 1500], [4200, 2800]],
          w: 400,
          h: 300,
          sys: 'SA',
        },
      })
      expect(ductRes.isError).not.toBe(true)
      const ductAdded = (parseToolJson(ductRes) as { added: Array<{ id: string, type: string }> }).added
      expect(ductAdded.map(n => n.type)).toEqual(['straight', 'elbow', 'straight'])

      // 6. Baca proyek lewat get_project dan verifikasi node & warning terbaca
      const stateRes = await client.callTool({
        name: 'get_project',
        arguments: { file: 'kantor-uji-mcp.json' },
      })
      const state = parseToolJson(stateRes) as { nodes: Array<{ id: string, type: string }>, warnings: unknown[] }
      // 1 room awal + 3 add_nodes + 3 draw_duct = 7 node
      expect(state.nodes).toHaveLength(7)
      expect(Array.isArray(state.warnings)).toBe(true)

      // 7. Update diffuser lalu hapus door untuk uji mutasi & persistensi
      const diffId = added.find(n => n.type === 'diffuser')!.id
      const updRes = await client.callTool({
        name: 'update_nodes',
        arguments: {
          file: 'kantor-uji-mcp.json',
          updates: [{ id: diffId, props: { flow: 350 } }],
        },
      })
      expect(updRes.isError).not.toBe(true)

      const delRes = await client.callTool({
        name: 'delete_nodes',
        arguments: {
          file: 'kantor-uji-mcp.json',
          ids: [door!.id],
        },
      })
      expect(delRes.isError).not.toBe(true)

      // 8. Export DXF R12 ke disk & verifikasi kontennya
      const dxfRes = await client.callTool({
        name: 'export_dxf',
        arguments: { file: 'kantor-uji-mcp.json', unit: 'mm' },
      })
      expect(dxfRes.isError).not.toBe(true)
      const dxfOut = parseToolJson(dxfRes) as { path: string, unit: string }
      expect(dxfOut.path.endsWith('kantor-uji-mcp.dxf')).toBe(true)
      expect(fs.existsSync(dxfOut.path)).toBe(true)

      const dxfText = fs.readFileSync(dxfOut.path, 'utf8')
      expect(dxfText).toContain('AC1009')
      expect(dxfText).toContain('DUCT-SA')
      expect(dxfText).toContain('EQUIPMENT')
      expect(dxfText).toContain('DIFFUSER')
      expect(dxfText).toContain('A-WALL')
      expect(dxfText.trimEnd().endsWith('EOF')).toBe(true)

      // 9. Path traversal ditolak ramah (isError: true, tidak memutus koneksi)
      const badRes = await client.callTool({
        name: 'get_project',
        arguments: { file: '../rahasia.json' },
      })
      expect(badRes.isError).toBe(true)
    }
    finally {
      await client.close()
      await server.close()
    }
  })

  it('transport stdio CLI (packages/mcp/src/cli.ts) dapat dihubungi klien MCP sungguhan', async () => {
    const dir = makeTempDir()
    const cliPath = path.resolve(process.cwd(), 'packages/mcp/src/cli.ts')
    const transport = new StdioClientTransport({
      command: 'bun',
      args: [cliPath],
      env: { ...process.env, TEMANDOR_DIR: dir } as Record<string, string>,
      stderr: 'pipe',
    })
    const client = new Client({ name: 'temandor-stdio-test', version: '0.1.0' })

    await client.connect(transport)
    try {
      const createdRes = await client.callTool({
        name: 'create_project',
        arguments: { name: 'Proyek Stdio', demo: true },
      })
      expect(createdRes.isError).not.toBe(true)
      const created = parseToolJson(createdRes) as { file: string }
      expect(created.file).toBe('proyek-stdio.json')

      const dxfRes = await client.callTool({
        name: 'export_dxf',
        arguments: { file: created.file, unit: 'mm' },
      })
      expect(dxfRes.isError).not.toBe(true)
      const dxfInfo = parseToolJson(dxfRes) as { path: string }
      expect(fs.readFileSync(dxfInfo.path, 'utf8')).toContain('AC1009')
    }
    finally {
      await client.close()
    }
  }, 20_000)
})
