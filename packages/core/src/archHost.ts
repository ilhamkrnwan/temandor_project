import { angOf, dist, localToWorld, polyArea, roomPts, rotP } from './geom'
import { createNode } from './model'
import type {
  DoorNode,
  Node,
  NodeType,
  OpeningNode,
  PartitionNode,
  Point,
  Project,
  RoomNode,
  WallHost,
  WinNode,
} from './types'

export type HostedOpeningNode = DoorNode | WinNode | OpeningNode

export const HOSTED_TYPES: ReadonlySet<NodeType> = new Set(['door', 'win', 'opening'])

export const MIN_PARTITION_LENGTH_MM = 100

export interface RoomEdge {
  A: Point
  C: Point
  len: number
  u: Point
  nIn: Point
}

export function isHostedOpening(node: Node): node is HostedOpeningNode {
  return node.type === 'door' || node.type === 'win' || node.type === 'opening'
}

/** Toleransi magnet menempelkan pintu/jendela/bukaan ke dinding ruangan (mm). */
export function hostToleranceMm(pxPerMm: number): number {
  const scale = pxPerMm > 0 ? pxPerMm : 1
  return Math.max(400, 24 / scale)
}

/** Hitung semua sisi dinding dunia beserta vektor arah `u` dan normal ke dalam `nIn`. */
export function roomEdges(room: RoomNode): RoomEdge[] {
  const pts = roomPts(room)
  const count = pts.length
  const sg = Math.sign(polyArea(pts)) || 1
  return pts.map((p, i) => {
    const q = pts[(i + 1) % count]!
    const A = localToWorld(room, p)
    const C = localToWorld(room, q)
    const len = dist(A, C) || 1
    const d = dist(p, q) || 1
    const nl: Point = [(-(q[1] - p[1]) / d) * sg, ((q[0] - p[0]) / d) * sg]
    return {
      A,
      C,
      len,
      u: [(C[0] - A[0]) / len, (C[1] - A[1]) / len],
      nIn: rotP(room.mir ? [nl[0], -nl[1]] : nl, room.rot || 0),
    }
  })
}

/** Daftar ruangan aktif pada layer `denah` yang tidak dikecualikan. */
export function visibleRooms(project: Project, skipIds?: ReadonlySet<string>): RoomNode[] {
  if (project.layers.denah?.on === false) return []
  const out: RoomNode[] = []
  for (const node of project.nodes) {
    if (node.type !== 'room') continue
    if (skipIds?.has(node.id)) continue
    out.push(node)
  }
  return out
}

/**
 * Cari sisi dinding ruangan terdekat dari titik dunia `world` dalam jarak `toleranceMm`.
 * Port langsung dari `hostAt` di prototype/app/js/model.js.
 */
export function hostAt(
  opening: Pick<HostedOpeningNode, 'dw'>,
  world: Point,
  rooms: readonly RoomNode[],
  toleranceMm: number,
): WallHost | null {
  let best: WallHost | null = null
  let bestDist = toleranceMm
  for (const room of rooms) {
    const edges = roomEdges(room)
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i]!
      const t = (world[0] - edge.A[0]) * edge.u[0] + (world[1] - edge.A[1]) * edge.u[1]
      if (t < -opening.dw / 2 || t > edge.len + opening.dw / 2) continue
      const d = Math.abs(
        (world[0] - edge.A[0]) * edge.nIn[0]
        + (world[1] - edge.A[1]) * edge.nIn[1]
        - room.t / 2,
      )
      if (d < bestDist) {
        bestDist = d
        best = {
          id: room.id,
          e: i,
          s: Math.round(Math.max(0, Math.min(t - opening.dw / 2, edge.len - opening.dw))),
          n: edges.length,
        }
      }
    }
  }
  return best
}

/**
 * Selaraskan posisi, rotasi, tebal dinding, dan arah dalam pintu/jendela/bukaan
 * terhadap ruangan induknya (termasuk jika titik poligon ruangan ditambah/dikurangi).
 */
export function syncHost(opening: HostedOpeningNode, room: RoomNode): void {
  const edges = roomEdges(room)
  const h = opening.host
  if (!h || edges.length === 0) return

  if (h.n !== edges.length || !edges[h.e]) {
    const center = localToWorld(opening, [opening.dw / 2, opening.t / 2])
    const rehosted = hostAt(opening, center, [room], Infinity)
    if (!rehosted) return
    Object.assign(h, rehosted)
  }

  const edge = edges[h.e]
  if (!edge) return
  h.s = Math.max(0, Math.min(h.s, Math.max(0, edge.len - opening.dw)))
  opening.t = room.t
  opening.x = edge.A[0] + edge.u[0] * h.s
  opening.y = edge.A[1] + edge.u[1] * h.s
  opening.rot = angOf(edge.A, edge.C)
  const ref = rotP([0, 1], opening.rot)
  opening.mir = ref[0] * edge.nIn[0] + ref[1] * edge.nIn[1] < 0
}

/** Sinkronkan seluruh pintu/jendela/bukaan yang menempel ke dinding pada proyek. */
export function syncHosts(project: Project): void {
  const byId = new Map<string, Node>(project.nodes.map(m => [m.id, m]))
  for (const node of project.nodes) {
    if (!isHostedOpening(node) || !node.host) continue
    const room = byId.get(node.host.id)
    if (room && room.type === 'room') {
      syncHost(node, room)
    }
    else {
      delete node.host
    }
  }
}

/**
 * Tempelkan salinan pintu/jendela/bukaan ke dinding ruangan terdekat bila dalam toleransi,
 * atau lepaskan dan taruh di posisi `fallbackPos` bila jauh dari dinding.
 */
export function applyHostedSnap<T extends HostedOpeningNode>(
  opening: T,
  world: Point,
  fallbackPos: Point,
  rooms: readonly RoomNode[],
  toleranceMm: number,
): T {
  const clone = JSON.parse(JSON.stringify(opening)) as T
  const host = hostAt(clone, world, rooms, toleranceMm)
  if (host) {
    clone.host = host
    const room = rooms.find(r => r.id === host.id)
    if (room) syncHost(clone, room)
  }
  else {
    delete clone.host
    clone.x = fallbackPos[0]
    clone.y = fallbackPos[1]
  }
  return clone
}

/** Buat segmen dinding partisi dari dua titik dunia; null bila panjang < 100 mm. */
export function partitionFromPoints(a: Point, b: Point): PartitionNode | null {
  const len = dist(a, b)
  if (len < MIN_PARTITION_LENGTH_MM) return null
  return createNode('partition', {
    x: a[0],
    y: a[1],
    rot: angOf(a, b),
    L: Math.round(len),
  })
}
