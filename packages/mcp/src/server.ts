import fs from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  AI_TOOLS,
  LAYERS,
  demoProject,
  newProject,
  openProjectJson,
  projectFileSlug,
  runTool,
  serializeProjectJson,
  toDXF,
  toolReadOnly,
  type Project,
} from '@temandor/core'
import { z } from 'zod'

export const MCP_SERVER_INFO = {
  name: 'temandor',
  version: '0.1.0',
} as const

export const MCP_SERVER_INSTRUCTIONS = 'Temandor: sketsa ducting & ventilasi. Satuan mm, y ke bawah. Panggil get_project sebelum mengubah gambar, lalu cek warnings setelahnya.'

const fileFieldSchema = z.string().min(1).describe('Nama file proyek di folder Temandor, mis. "kantor-lt-2.json"')

function textResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

function errorResult(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err)
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/**
 * Validasi path file `.json` agar selalu berada di dalam `baseDir`.
 * Menolak path traversal (`../`), path absolut ke luar folder, dan ekstensi selain `.json`.
 */
export function resolveProjectFile(baseDir: string, name: string): string {
  const resolvedBase = path.resolve(baseDir)
  const raw = String(name ?? '').trim()
  if (!raw) {
    throw new Error(`File harus .json di dalam ${resolvedBase}`)
  }
  const target = path.resolve(resolvedBase, raw)
  const rel = path.relative(resolvedBase, target)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !target.toLowerCase().endsWith('.json')) {
    throw new Error(`File harus .json di dalam ${resolvedBase}`)
  }
  return target
}

function loadProjectFile(baseDir: string, name: string): Project {
  const filePath = resolveProjectFile(baseDir, name)
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${name} tidak ada. Pakai list_projects atau create_project.`)
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const opened = openProjectJson(raw, { freshId: false })
  if (!opened.ok) {
    throw new Error(`${name} bukan file proyek Temandor: ${opened.error}`)
  }
  return opened.project
}

function saveProjectFile(baseDir: string, name: string, project: Project): string {
  const filePath = resolveProjectFile(baseDir, name)
  project.updated = Date.now()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, serializeProjectJson(project, 2), 'utf8')
  return filePath
}

function uniqueProjectFileName(baseDir: string, projectName: string): string {
  const baseSlug = projectFileSlug(projectName)
  let candidate = `${baseSlug}.json`
  for (let i = 2; fs.existsSync(path.join(baseDir, candidate)); i++) {
    candidate = `${baseSlug}-${i}.json`
  }
  return candidate
}

/** Buat instance McpServer Temandor yang membaca & menulis proyek `.json` serta DXF di `dir`. */
export function createTemandorMcpServer(dir: string): McpServer {
  const baseDir = path.resolve(dir)
  fs.mkdirSync(baseDir, { recursive: true })

  const server = new McpServer(MCP_SERVER_INFO, {
    instructions: MCP_SERVER_INSTRUCTIONS,
  })

  // 1. list_projects
  server.registerTool(
    'list_projects',
    {
      description: `Daftar file proyek Temandor (.json) di ${baseDir}.`,
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => {
      try {
        const files = fs.readdirSync(baseDir)
          .filter(f => f.toLowerCase().endsWith('.json'))
          .sort()
        const projects = files.map((file) => {
          try {
            const raw = fs.readFileSync(path.join(baseDir, file), 'utf8')
            const opened = openProjectJson(raw, { freshId: false })
            if (!opened.ok) return { file, error: 'tidak terbaca' }
            return {
              file,
              name: opened.project.name,
              unit: opened.project.unit,
              nodes: opened.project.nodes.length,
            }
          }
          catch {
            return { file, error: 'tidak terbaca' }
          }
        })
        return textResult({ folder: baseDir, projects })
      }
      catch (err) {
        return errorResult(err)
      }
    },
  )

  // 2. create_project
  server.registerTool(
    'create_project',
    {
      description: 'Buat file proyek baru (berisi satu ruangan 6 x 4 m). Isi demo=true untuk proyek contoh lengkap.',
      inputSchema: {
        name: z.string().min(1).describe('Nama proyek baru'),
        unit: z.enum(['inch', 'mm']).optional().describe('Satuan ukuran duct (default inch)'),
        demo: z.boolean().optional().describe('Jika true, isi dengan proyek contoh Kantor Lt. 2'),
      },
      annotations: { readOnlyHint: false },
    },
    ({ name, unit, demo }) => {
      try {
        const project = demo
          ? Object.assign(demoProject(), { name })
          : newProject({ name, unit: unit ?? 'inch' })
        const file = uniqueProjectFileName(baseDir, name)
        const savedPath = saveProjectFile(baseDir, file, project)
        return textResult({ file, path: savedPath })
      }
      catch (err) {
        return errorResult(err)
      }
    },
  )

  // 3. export_dxf
  server.registerTool(
    'export_dxf',
    {
      description: 'Export proyek ke file .dxf (DXF R12 untuk AutoCAD) di sebelah file .json-nya, semua layer.',
      inputSchema: {
        file: fileFieldSchema,
        unit: z.enum(['mm', 'inch']).optional().describe('Satuan file DXF (default mm)'),
      },
      annotations: { readOnlyHint: false },
    },
    ({ file, unit }) => {
      try {
        const project = loadProjectFile(baseDir, file)
        const dxfUnit = unit ?? 'mm'
        const outPath = resolveProjectFile(baseDir, file).replace(/\.json$/i, '.dxf')
        const dxf = toDXF(project, {
          layers: new Set(LAYERS.map(l => l.key)),
          unit: dxfUnit,
          note: true,
        })
        fs.writeFileSync(outPath, dxf, 'utf8')
        return textResult({ path: outPath, unit: dxfUnit })
      }
      catch (err) {
        return errorResult(err)
      }
    },
  )

  // 4-9. Semua aksi gambar murni dari @temandor/core (`AI_TOOLS`), ditambah parameter `file`
  for (const def of AI_TOOLS) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: {
          file: fileFieldSchema,
          ...def.schema.shape,
        },
        annotations: { readOnlyHint: def.readOnly },
      },
      (args) => {
        try {
          const { file, ...rest } = args as { file: string, [key: string]: unknown }
          const project = loadProjectFile(baseDir, file)
          const output = runTool(project, def.name, rest)
          if (!toolReadOnly(def.name)) {
            saveProjectFile(baseDir, file, project)
          }
          return textResult(output)
        }
        catch (err) {
          return errorResult(err)
        }
      },
    )
  }

  return server
}
