import { z } from 'zod'
import { hostAt, isHostedOpening, syncHost } from './archHost'
import { COMPONENTS, componentOf, connect, flowTotals } from './components'
import { pathNodes } from './ductPath'
import { ROOM_SHAPES, applyRoomShape, type RoomShapeKey } from './library'
import { NODE_DEFAULTS, createNode } from './model'
import { resizeRoom } from './room'
import type { DuctShape, Node, NodeType, Point, Project, RoomNode, System } from './types'
import { validate } from './validate'

const r1 = (v: number): number => Math.round(v * 10) / 10

const KEEP_KEYS = ['name', 'tag', 'w', 'h', 'shape', 'sys', 'flow', 'pts', 'g', 'lock', 's'] as const

const NODE_TYPE_SET = new Set<string>(Object.keys(COMPONENTS))

const ROOM_SHAPE_KEYS = Object.keys(ROOM_SHAPES) as RoomShapeKey[]

export const AI_TOOL_LABELS: Readonly<Record<AiToolName, string>> = {
  get_project: 'Membaca gambar',
  list_types: 'Melihat daftar komponen',
  add_nodes: 'Menambah komponen',
  draw_duct: 'Menggambar jalur duct',
  update_nodes: 'Mengubah komponen',
  delete_nodes: 'Menghapus komponen',
}

export interface NodeInfo {
  id: string
  type: NodeType
  x: number
  y: number
  rot?: number
  mir?: boolean
  host?: { room: string, edge: number, s: number }
  [key: string]: unknown
}

/** Ringkas satu node untuk dikembalikan ke model AI / client MCP. */
export function nodeInfo(node: Node): NodeInfo {
  const out: NodeInfo = {
    id: node.id,
    type: node.type,
    x: r1(node.x),
    y: r1(node.y),
  }
  if (node.rot) out.rot = node.rot
  if (node.mir) out.mir = true

  const record = node as unknown as Record<string, unknown>
  const defaults = NODE_DEFAULTS[node.type] as unknown as Record<string, unknown>
  for (const key of [...Object.keys(defaults), ...KEEP_KEYS]) {
    if (record[key] !== undefined && !(key in out)) {
      const val = record[key]
      out[key] = typeof val === 'number' ? r1(val) : val
    }
  }
  if (isHostedOpening(node) && node.host) {
    out.host = { room: node.host.id, edge: node.host.e, s: r1(node.host.s) }
  }
  return out
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} harus angka`)
  }
  return value
}

function findNode(project: Project, id: string): Node {
  const found = project.nodes.find(n => n.id === id)
  if (!found) throw new Error(`Komponen ${id} tidak ada`)
  return found
}

function projectRooms(project: Project): RoomNode[] {
  return project.nodes.filter((n): n is RoomNode => n.type === 'room')
}

/**
 * Terapkan patch properti ke sebuah node secara aman:
 * ruangan memakai `resizeRoom` / `applyRoomShape`, kunci tidak dikenal ditolak.
 */
export function applyProps(node: Node, props: Record<string, unknown> = {}): void {
  const record = node as unknown as Record<string, unknown>
  const defaults = NODE_DEFAULTS[node.type] as unknown as Record<string, unknown>

  for (const [key, value] of Object.entries(props)) {
    if (node.type === 'room' && (key === 'W' || key === 'H')) {
      resizeRoom(node, key, assertFiniteNumber(value, key))
      continue
    }
    if (node.type === 'room' && key === 'shape') {
      if (typeof value !== 'string' || !(value in ROOM_SHAPES)) {
        throw new Error(`Bentuk ruangan: ${ROOM_SHAPE_KEYS.join(', ')}`)
      }
      applyRoomShape(node, value as RoomShapeKey)
      continue
    }
    if (key === 'x' || key === 'y' || key === 'rot') {
      record[key] = assertFiniteNumber(value, key)
      continue
    }
    if (key === 'mir') {
      node.mir = Boolean(value)
      continue
    }
    if (!(key in defaults) && !(KEEP_KEYS as readonly string[]).includes(key)) {
      throw new Error(`${node.type} tidak punya parameter "${key}"`)
    }
    record[key] = typeof record[key] === 'number' ? assertFiniteNumber(value, key) : value
  }
}

/** Tempelkan pintu/jendela/bukaan ke dinding ruangan terdekat (<= 500 mm). */
export function hostIt(project: Project, node: Node): void {
  if (!isHostedOpening(node)) return
  const rooms = projectRooms(project)
  const host = hostAt(node, [node.x, node.y], rooms, 500)
  if (host) {
    node.host = host
    const room = rooms.find(r => r.id === host.id)
    if (room) syncHost(node, room)
  }
}

// ---- Skema input Zod untuk tiap tool ----

export const getProjectInputSchema = z.object({})

export const listTypesInputSchema = z.object({})

export const addNodesInputSchema = z.object({
  nodes: z.array(z.object({
    type: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    rot: z.number().finite().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
  })).min(1, 'nodes kosong'),
})

export const drawDuctInputSchema = z.object({
  points: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(2, 'Minimal 2 titik'),
  w: z.number().finite().positive().optional(),
  h: z.number().finite().positive().optional(),
  shape: z.enum(['rect', 'round']).optional(),
  sys: z.enum(['SA', 'EA']).optional(),
})

export const updateNodesInputSchema = z.object({
  updates: z.array(z.object({
    id: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
  })),
})

export const deleteNodesInputSchema = z.object({
  ids: z.array(z.string().min(1)),
})

export type AiToolName
  = | 'get_project'
    | 'list_types'
    | 'add_nodes'
    | 'draw_duct'
    | 'update_nodes'
    | 'delete_nodes'

export interface AiToolJsonSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

export interface AiToolDefinition {
  readonly name: AiToolName
  readonly readOnly: boolean
  readonly description: string
  readonly schema: z.ZodObject<z.ZodRawShape>
  readonly input_schema: AiToolJsonSchema
  readonly run: (project: Project, input: Record<string, unknown>) => unknown
}

export const AI_TOOLS: readonly AiToolDefinition[] = [
  {
    name: 'get_project',
    readOnly: true,
    description: 'Baca isi proyek: satuan, skala, semua komponen (id, tipe, posisi mm, parameter), total debit per unit, dan daftar warning validasi. Panggil ini dulu sebelum mengubah gambar.',
    schema: getProjectInputSchema,
    input_schema: { type: 'object', properties: {} },
    run(project) {
      const cn = connect(project)
      const flows = flowTotals(project, cn)
      return {
        name: project.name,
        unit_duct: project.unit,
        flow_unit: project.fu,
        scale: project.scale,
        nodes: project.nodes.map(n => nodeInfo(n)),
        flows: Object.entries(flows).map(([id, total]) => ({ id, total })),
        warnings: validate(project, cn).map(w => ({
          kind: w.kind,
          msg: w.msg,
          detail: w.detail,
          id: w.id,
          x: r1(w.pos[0]),
          y: r1(w.pos[1]),
        })),
      }
    },
  },
  {
    name: 'list_types',
    readOnly: true,
    description: 'Daftar tipe komponen yang bisa dipakai beserta parameter bawaannya, bentuk ruangan siap pakai, dan konvensi koordinat.',
    schema: listTypesInputSchema,
    input_schema: { type: 'object', properties: {} },
    run() {
      return {
        coords: 'Satuan mm. x ke kanan, y ke BAWAH. Ruangan: (x,y) = sudut kiri-atas, W lebar, H tinggi. Komponen lain: (x,y) = titik acuan/tengah. rot dalam derajat.',
        duct_size: 'w/h duct dalam satuan duct proyek (inch atau mm). sys: SA (supply) atau EA (exhaust).',
        room_shapes: ROOM_SHAPE_KEYS,
        types: (Object.keys(COMPONENTS) as NodeType[]).map((type) => {
          const comp = componentOf(type)
          return {
            type,
            name: comp.name,
            layer: comp.layer ?? (comp.duct ? 'sa/ea' : ''),
            params: NODE_DEFAULTS[type],
          }
        }),
      }
    },
  },
  {
    name: 'add_nodes',
    readOnly: false,
    description: 'Tambah satu atau lebih komponen. Pintu/jendela/bukaan otomatis menempel ke dinding terdekat. Untuk jalur duct berbelok pakai draw_duct.',
    schema: addNodesInputSchema,
    input_schema: {
      type: 'object',
      required: ['nodes'],
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'x', 'y'],
            properties: {
              type: { type: 'string', description: 'Tipe dari list_types, mis. room, fcu, diffuser, door, column' },
              x: { type: 'number' },
              y: { type: 'number' },
              rot: { type: 'number' },
              props: { type: 'object', description: 'Parameter lain, mis. {"W":6000,"H":5000,"name":"Ruang Rapat"} atau {"flow":300}. Ruangan bisa {"shape":"L"}.' },
            },
          },
        },
      },
    },
    run(project, rawInput) {
      const parsed = addNodesInputSchema.parse(rawInput)
      let roomCount = projectRooms(project).length
      const made: Node[] = parsed.nodes.map((item) => {
        if (!NODE_TYPE_SET.has(item.type)) {
          throw new Error(`Tipe "${item.type}" tidak ada. Lihat list_types.`)
        }
        const nodeType = item.type as NodeType
        const comp = componentOf(nodeType)
        const node = createNode(nodeType, {
          x: item.x,
          y: item.y,
          rot: item.rot ?? 0,
        })
        if (comp.duct && project.unit === 'mm' && (!item.props || item.props.w === undefined)) {
          const rec = node as unknown as Record<string, unknown>
          if ('w' in rec) rec.w = 600
          if ('h' in rec) rec.h = 500
        }
        if (node.type === 'room' && (!item.props || item.props.name === undefined)) {
          roomCount += 1
          node.name = `Ruangan ${roomCount}`
        }
        applyProps(node, item.props)
        hostIt(project, node)
        return node
      })
      project.nodes.push(...made)
      return { added: made.map(n => nodeInfo(n)) }
    },
  },
  {
    name: 'draw_duct',
    readOnly: false,
    description: 'Gambar jalur duct lewat titik-titik (mm). Elbow dipasang otomatis di tiap belokan. Mulai/akhiri tepat di port komponen (mis. sisi supply FCU) supaya tersambung.',
    schema: drawDuctInputSchema,
    input_schema: {
      type: 'object',
      required: ['points'],
      properties: {
        points: {
          type: 'array',
          minItems: 2,
          items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        },
        w: { type: 'number', description: 'Lebar (atau diameter kalau bulat), satuan duct proyek' },
        h: { type: 'number' },
        shape: { type: 'string', enum: ['rect', 'round'] },
        sys: { type: 'string', enum: ['SA', 'EA'] },
      },
    },
    run(project, rawInput) {
      const parsed = drawDuctInputSchema.parse(rawInput)
      const pts: Point[] = parsed.points.map(([x, y]) => [x, y])
      const defSize: [number, number] = project.unit === 'mm' ? [600, 500] : [24, 20]
      const shape: DuctShape = parsed.shape ?? 'rect'
      const sys: System = parsed.sys ?? 'SA'
      const w = parsed.w ?? defSize[0]
      const h = shape === 'round' ? w : (parsed.h ?? defSize[1])
      const added = pathNodes(pts, { w, h, shape, sys }, project.unit)
      if (added.length === 0) throw new Error('Titik terlalu dekat')
      project.nodes.push(...added)
      return { added: added.map(n => ({ id: n.id, type: n.type })) }
    },
  },
  {
    name: 'update_nodes',
    readOnly: false,
    description: 'Ubah parameter/posisi komponen yang sudah ada.',
    schema: updateNodesInputSchema,
    input_schema: {
      type: 'object',
      required: ['updates'],
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'props'],
            properties: {
              id: { type: 'string' },
              props: { type: 'object' },
            },
          },
        },
      },
    },
    run(project, rawInput) {
      const parsed = updateNodesInputSchema.parse(rawInput)
      const updated = parsed.updates.map(({ id, props }) => {
        const node = findNode(project, id)
        applyProps(node, props)
        if (isHostedOpening(node) && node.host && (props.x !== undefined || props.y !== undefined)) {
          delete node.host
          hostIt(project, node)
        }
        return nodeInfo(node)
      })
      return { updated }
    },
  },
  {
    name: 'delete_nodes',
    readOnly: false,
    description: 'Hapus komponen berdasarkan id.',
    schema: deleteNodesInputSchema,
    input_schema: {
      type: 'object',
      required: ['ids'],
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
      },
    },
    run(project, rawInput) {
      const parsed = deleteNodesInputSchema.parse(rawInput)
      const targetIds = new Set(parsed.ids.map(id => findNode(project, id).id))
      project.nodes = project.nodes.filter(
        n => !targetIds.has(n.id) && !(isHostedOpening(n) && n.host && targetIds.has(n.host.id)),
      )
      return { deleted: [...targetIds] }
    },
  },
]

export interface PublicAiToolDef {
  name: AiToolName
  description: string
  input_schema: AiToolJsonSchema
}

/** Daftar definisi tool siap kirim ke Anthropic API / server MCP. */
export function toolDefs(): PublicAiToolDef[] {
  return AI_TOOLS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }))
}

/** Cek apakah tool bersifat read-only (tidak mengubah isi proyek). */
export function toolReadOnly(name: string): boolean {
  return Boolean(AI_TOOLS.find(t => t.name === name)?.readOnly)
}

/** Jalankan satu tool AI/MCP secara murni pada objek `project`. */
export function runTool(
  project: Project,
  name: string,
  input: Record<string, unknown> = {},
): unknown {
  const def = AI_TOOLS.find(t => t.name === name)
  if (!def) throw new Error(`Tool "${name}" tidak ada`)
  try {
    return def.run(project, input ?? {})
  }
  catch (err) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0]
      throw new Error(issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Input tool tidak valid', { cause: err })
    }
    throw err
  }
}
