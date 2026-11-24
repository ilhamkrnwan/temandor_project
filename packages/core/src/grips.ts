import { componentOf } from './components'
import { angOf, dist, localToWorld, moveLocal, roomPts, worldToLocal } from './geom'
import type { Node, Point, RoomNode, Unit } from './types'

export type GripKind = 'pos' | 'size' | 'edge'

export interface GripPoint {
  id: string
  local: Point
  world: Point
  kind: GripKind
}

export const SIZE_GRIP_IDS = new Set(['w', 'w2', 's'])

type DuctWidthNode = Extract<Node, { w: number, h: number, shape: 'rect' | 'round' }>
type DuctWidth2Node = Extract<Node, { w2: number, h2: number, shape: 'rect' | 'round' }>

function roundSize50(v: number): number {
  return Math.max(100, Math.round(Math.abs(v) / 50) * 50)
}

/** Ubah lebar duct dari posisi grip tepi lokal sambil menjaga rasio W:H (dibulatkan 1" / 50 mm). */
export function widthGrip(
  node: DuctWidthNode | DuctWidth2Node,
  local: Point,
  unit: Unit,
  which: 'primary' | 'secondary' = 'primary',
): void {
  const step = unit === 'mm' ? 50 : 1
  const round = (v: number) => Math.max(step * 2, Math.round(v / step) * step)
  const w = round((2 * Math.abs(local[1])) / (unit === 'mm' ? 1 : 25.4))

  if (which === 'secondary' && 'w2' in node && typeof node.w2 === 'number' && typeof node.h2 === 'number') {
    if (node.shape !== 'round' && node.w2 > 0) {
      node.h2 = round((node.h2 * w) / node.w2)
    }
    node.w2 = w
    return
  }

  if ('w' in node && 'h' in node) {
    if (node.shape !== 'round' && node.w > 0) {
      node.h = round((node.h * w) / node.w)
    }
    node.w = w
  }
}

/** Atur ulang titik poligon ruangan dengan origin lokal dinormalisasi ke (0, 0). */
export function setRoomPoints(room: RoomNode, points: readonly Point[]): void {
  const cleaned = points.filter((p, i) => dist(p, points[(i + 1) % points.length]!) >= 1)
  if (cleaned.length < 3) return
  const x0 = Math.min(...cleaned.map(p => p[0]))
  const y0 = Math.min(...cleaned.map(p => p[1]))
  moveLocal(room, x0, y0)
  room.pts = cleaned.map(p => [p[0] - x0, p[1] - y0])
  room.W = Math.max(...room.pts.map(p => p[0]))
  room.H = Math.max(...room.pts.map(p => p[1]))
}

function gripKindOf(id: string): GripKind {
  if (SIZE_GRIP_IDS.has(id)) return 'size'
  if (/^e\d+$/.test(id)) return 'edge'
  return 'pos'
}

/** Hitung semua handle grip (lokal & dunia) untuk sebuah komponen dari registry `COMPONENTS`. */
export function nodeGrips(node: Node, unit: Unit): GripPoint[] {
  const def = componentOf(node.type)
  const localList = def.grips ? def.grips(node as never, unit) : []
  return localList.map(([id, lx, ly]) => {
    const local: Point = [lx, ly]
    return {
      id,
      local,
      world: localToWorld(node, local),
      kind: gripKindOf(id),
    }
  })
}

function applyEndGrip(n: Extract<Node, { L: number }>, id: string, world: Point): void {
  const p1: Point = [n.x, n.y]
  const p2 = localToWorld(n, [n.L, 0])
  const [a, b] = id === 'p1' ? [world, p2] : [p1, world]
  if (dist(a, b) < 10) return
  n.x = a[0]
  n.y = a[1]
  n.rot = angOf(a, b)
  n.L = Math.round(dist(a, b))
}

function applyLenGrip(
  n: Extract<Node, { L: number, w: number, h: number, shape: 'rect' | 'round' }>,
  id: string,
  local: Point,
  unit: Unit,
): void {
  if (id === 'w') {
    widthGrip(n, local, unit, 'primary')
    return
  }
  if (id === 'b') {
    n.L = Math.max(20, Math.round(local[0]))
    return
  }
  const d = Math.min(Math.round(local[0]), n.L - 20)
  moveLocal(n, d, 0)
  n.L -= d
}

function applyRoomGrip(n: RoomNode, id: string, world: Point, baseRoom: RoomNode): void {
  const pts = roomPts(baseRoom).map(p => [p[0], p[1]] as Point)
  const count = pts.length
  const idx = Number(id.slice(1))
  const local = worldToLocal(baseRoom, world)
  n.x = baseRoom.x
  n.y = baseRoom.y

  if (id.startsWith('v')) {
    if (idx >= 0 && idx < count) {
      pts[idx] = [Math.round(local[0]), Math.round(local[1])]
      setRoomPoints(n, pts)
    }
    return
  }

  if (!id.startsWith('e') || idx < 0 || idx >= count) return
  const A = pts[idx]!
  const C = pts[(idx + 1) % count]!
  const len = dist(A, C) || 1
  const U: Point = [(C[0] - A[0]) / len, (C[1] - A[1]) / len]
  const nr: Point = [-U[1], U[0]]
  const d = Math.round((local[0] - A[0]) * nr[0] + (local[1] - A[1]) * nr[1])
  if (!d) {
    setRoomPoints(n, pts)
    return
  }
  const mv = (p: Point): Point => [p[0] + nr[0] * d, p[1] + nr[1] * d]
  const perp = (p: Point, q: Point) => Math.abs((q[0] - p[0]) * U[0] + (q[1] - p[1]) * U[1]) < 1
  const prev = pts[(idx + count - 1) % count]!
  const next = pts[(idx + 2) % count]!
  const out: Point[] = []
  pts.forEach((p, j) => {
    if (j === idx) {
      out.push(...(perp(prev, A) ? [mv(A)] : [A, mv(A)]))
    }
    else if (j === (idx + 1) % count) {
      out.push(...(perp(C, next) ? [mv(C)] : [mv(C), C]))
    }
    else {
      out.push(p)
    }
  })
  setRoomPoints(n, out)
}

/** Terapkan perpindahan grip secara murni dan kembalikan salinan komponen baru. */
export function applyGrip(
  node: Node,
  gripId: string,
  worldPos: Point,
  unit: Unit,
  baseNode?: Node,
): Node {
  const n = JSON.parse(JSON.stringify(node)) as Node
  const local = worldToLocal(n, worldPos)

  switch (n.type) {
    case 'straight':
    case 'flex':
    case 'damper':
    case 'accessdoor':
      applyLenGrip(n, gripId, local, unit)
      break
    case 'elbow':
    case 'tee':
    case 'takeoff':
    case 'endcap':
      if (gripId === 'w') widthGrip(n, local, unit, 'primary')
      break
    case 'transition':
      if (gripId === 'b') n.L = Math.max(50, Math.round(local[0]))
      else if (gripId === 'w') widthGrip(n, local, unit, 'primary')
      else if (gripId === 'w2') widthGrip(n, local, unit, 'secondary')
      break
    case 'diffuser':
      n.F = Math.max(150, roundSize50(Math.max(local[0], 2 * Math.abs(local[1]))))
      break
    case 'grille':
      n.Fx = roundSize50(local[0])
      n.Fy = roundSize50(2 * local[1])
      break
    case 'louver':
      n.F = roundSize50(2 * local[1])
      break
    case 'fan':
      n.L = Math.max(200, roundSize50(local[0]))
      n.B = roundSize50(2 * local[1])
      break
    case 'fcu':
    case 'outdoor':
      n.L = Math.max(200, roundSize50(2 * local[0]))
      n.B = roundSize50(2 * local[1])
      break
    case 'room': {
      const refRoom = baseNode && baseNode.type === 'room' ? baseNode : n
      applyRoomGrip(n, gripId, worldPos, refRoom)
      break
    }
    case 'dim':
      if (gripId === 'off') n.off = Math.round(local[1])
      else applyEndGrip(n, gripId, worldPos)
      break
    case 'column':
      n.cw = roundSize50(2 * local[0])
      if (n.shape !== 'round') n.cd = roundSize50(2 * local[1])
      break
    case 'door':
    case 'win':
    case 'opening':
      n.dw = Math.max(300, Math.round(local[0] / 50) * 50)
      break
    case 'partition':
    case 'beam':
      applyEndGrip(n, gripId, worldPos)
      break
    case 'shaft':
    case 'lift':
      n.sw = roundSize50(2 * local[0])
      n.sd = roundSize50(2 * local[1])
      break
    case 'stair':
      n.sl = roundSize50(local[0])
      n.sw = roundSize50(local[1])
      break
    case 'note':
      n.tx = Math.round(local[0])
      n.ty = Math.round(local[1])
      break
  }

  return n
}

/** Klik ganda pada grip ruangan: hapus sudut (`v*`) atau tambah sudut tengah (`e*`). */
export function applyGripDblClick(node: Node, gripId: string): Node | null {
  if (node.type !== 'room') return null
  const n = JSON.parse(JSON.stringify(node)) as RoomNode
  const pts = roomPts(n).map(p => [p[0], p[1]] as Point)
  const idx = Number(gripId.slice(1))
  if (gripId.startsWith('v')) {
    if (pts.length <= 3 || idx < 0 || idx >= pts.length) return null
    pts.splice(idx, 1)
    setRoomPoints(n, pts)
    return n
  }
  if (gripId.startsWith('e')) {
    if (idx < 0 || idx >= pts.length) return null
    const a = pts[idx]!
    const b = pts[(idx + 1) % pts.length]!
    pts.splice(idx + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)])
    setRoomPoints(n, pts)
    return n
  }
  return null
}
