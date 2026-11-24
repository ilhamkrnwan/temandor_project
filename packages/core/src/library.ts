import { componentOf } from './components'
import type { DuctSpec } from './ductPath'
import { setRoomPoints } from './grips'
import { createNode } from './model'
import type { Node, NodeType, Point, Project, RoomNode } from './types'

export type RoomShapeKey = 'rect' | 'L' | 'T' | 'U'

export interface RoomShapeDef {
  readonly key: RoomShapeKey
  readonly label: string
  readonly polygon: readonly Point[] | null
}

/** Bentuk ruangan siap pakai dalam kotak referensi 6 x 5 (port dari prototype/app/js/geom.js). */
export const ROOM_SHAPES: Readonly<Record<RoomShapeKey, RoomShapeDef>> = {
  rect: { key: 'rect', label: 'Persegi', polygon: null },
  L: {
    key: 'L',
    label: 'Bentuk L',
    polygon: [[0, 0], [3, 0], [3, 2.5], [6, 2.5], [6, 5], [0, 5]],
  },
  T: {
    key: 'T',
    label: 'Bentuk T',
    polygon: [[0, 0], [6, 0], [6, 2], [4, 2], [4, 5], [2, 5], [2, 2], [0, 2]],
  },
  U: {
    key: 'U',
    label: 'Bentuk U',
    polygon: [[0, 0], [2, 0], [2, 3], [4, 3], [4, 0], [6, 0], [6, 5], [0, 5]],
  },
}

/** Terapkan bentuk preset (persegi, L, T, U) pada ruangan dengan skala W x H. */
export function applyRoomShape(room: RoomNode, shape: RoomShapeKey): void {
  const poly = ROOM_SHAPES[shape].polygon
  if (!poly) {
    delete room.pts
    return
  }
  setRoomPoints(
    room,
    poly.map(([x, y]): Point => [Math.round((x * room.W) / 6), Math.round((y * room.H) / 5)]),
  )
}

/** Buat nama ruangan urut berikutnya ("Ruangan 1", "Ruangan 2", ...). */
export function nextRoomName(project: Pick<Project, 'nodes'>): string {
  let maxNum = 0
  for (const n of project.nodes) {
    if (n.type !== 'room') continue
    const match = /^Ruangan (\d+)$/.exec(n.name || '')
    if (match) {
      maxNum = Math.max(maxNum, Number(match[1]))
    }
  }
  return `Ruangan ${maxNum + 1}`
}

export type LibraryRoomItemId = `room:${RoomShapeKey}`

export type LibraryComponentType
  = | 'column'
    | 'door'
    | 'win'
    | 'opening'
    | 'partition'
    | 'shaft'
    | 'beam'
    | 'stair'
    | 'lift'
    | 'ceiling'
    | 'fan'
    | 'fcu'
    | 'outdoor'
    | 'straight'
    | 'flex'
    | 'elbow'
    | 'transition'
    | 'tee'
    | 'takeoff'
    | 'endcap'
    | 'diffuser'
    | 'grille'
    | 'damper'
    | 'accessdoor'
    | 'louver'

export type LibraryItemId = LibraryRoomItemId | LibraryComponentType

export interface LibraryGroup {
  readonly id: string
  readonly name: string
  readonly items: readonly LibraryItemId[]
}

export interface LibraryItemInfo {
  readonly id: LibraryItemId
  readonly name: string
  readonly icon: string
}

/** Urutan kelompok panel Elemen (identik dengan LIBRARY di prototype/app/js/geom.js). */
export const LIBRARY_GROUPS: readonly LibraryGroup[] = [
  { id: 'ruangan', name: 'Ruangan', items: ['room:rect', 'room:L', 'room:T', 'room:U'] },
  {
    id: 'arsitektur',
    name: 'Arsitektur',
    items: ['column', 'door', 'win', 'opening', 'partition', 'shaft', 'beam', 'stair', 'lift', 'ceiling'],
  },
  { id: 'equipment', name: 'Equipment', items: ['fan', 'fcu', 'outdoor'] },
  { id: 'duct', name: 'Duct', items: ['straight', 'flex'] },
  { id: 'fitting', name: 'Fitting', items: ['elbow', 'transition', 'tee', 'takeoff', 'endcap'] },
  { id: 'perlengkapan', name: 'Perlengkapan', items: ['diffuser', 'grille', 'damper', 'accessdoor', 'louver'] },
] as const

export const ALL_LIBRARY_ITEMS: readonly LibraryItemId[] = LIBRARY_GROUPS.flatMap(g => g.items)

const LIBRARY_ITEM_SET = new Set<string>(ALL_LIBRARY_ITEMS)

export function isLibraryItemId(value: string): value is LibraryItemId {
  return LIBRARY_ITEM_SET.has(value)
}

export function libraryItemInfo(id: LibraryItemId): LibraryItemInfo {
  if (id.startsWith('room:')) {
    const shape = id.slice(5) as RoomShapeKey
    return {
      id,
      name: shape === 'rect' ? 'Ruangan' : `Ruangan ${shape}`,
      icon: `ruang-${shape.toLowerCase()}`,
    }
  }
  const def = componentOf(id as NodeType)
  return {
    id,
    name: def.name,
    icon: def.icon ?? id,
  }
}

export interface CreateLibraryNodeOptions {
  project: Pick<Project, 'nodes' | 'unit'>
  ductSpec?: DuctSpec
  position?: Point
}

/** Buat node baru dari ID item library dengan ukuran/sistem duct aktif dan nama ruangan urut. */
export function createLibraryNode(id: LibraryItemId, options: CreateLibraryNodeOptions): Node {
  const [x, y] = options.position ?? [0, 0]

  if (id.startsWith('room:')) {
    const shape = id.slice(5) as RoomShapeKey
    const room = createNode('room', {
      x,
      y,
      W: 6000,
      H: 5000,
      name: nextRoomName(options.project),
    })
    applyRoomShape(room, shape)
    return room
  }

  const type = id as LibraryComponentType
  const node = createNode(type, { x, y } as never) as Node
  const def = componentOf(node.type)
  const spec = options.ductSpec

  if (def.duct && spec && 'w' in node && 'h' in node && 'shape' in node && 'sys' in node) {
    node.w = spec.w
    node.h = spec.h
    node.shape = spec.shape
    node.sys = spec.sys
    if ('elev' in node && spec.elev != null) {
      node.elev = spec.elev
    }
  }
  else if (node.type === 'fcu' && options.project.unit === 'mm') {
    node.w = spec?.w ?? 600
    node.h = spec?.h ?? 500
    if (spec?.shape) node.shape = spec.shape
  }

  return node
}
