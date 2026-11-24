import { roomEdges, syncHosts, type RoomEdge } from '../archHost'
import {
  dirToWorld,
  dist,
  localToWorld,
  norm,
  primBounds,
  scaleDen,
  segX,
  type Bounds,
} from '../geom'
import { xformPrims, type RenderCtx } from '../prims'
import type { LayerKey, Node, NodeType, Point, Prim, Project, Unit, WorldPort } from '../types'
import { archComponents } from './arch'
import { ductComponents } from './duct'
import { equipmentComponents } from './equipment'
import { markupComponents } from './markup'
import type { ComponentDef, ComponentRegistry } from './types'

export * from './types'
export { roomEdges, type RoomEdge }
export {
  ELBOW_ANGLE_CHIPS,
  ELBOW_ANGLE_RANGE,
  ELBOW_RADIUS_RATIOS,
  clampElbowAngle,
  elbowGeo,
  takeoffGeo,
  teeGeo,
} from './duct'

export const COMPONENTS: ComponentRegistry = {
  ...ductComponents,
  ...equipmentComponents,
  ...archComponents,
  ...markupComponents,
}

export function componentOf<T extends NodeType>(type: T): ComponentDef<T> {
  return COMPONENTS[type]
}

export function layerOf(node: Node): LayerKey {
  const def = COMPONENTS[node.type]
  if (def.layer) return def.layer
  return 'sys' in node && node.sys === 'EA' ? 'ea' : 'sa'
}

export function worldPorts(node: Node, unit: Unit): WorldPort[] {
  const def = COMPONENTS[node.type] as ComponentDef<NodeType>
  if (!def.ports) return []
  return def.ports(node as never, unit).map(p => ({
    ...p,
    pos: localToWorld(node, [p.x, p.y]),
    wdir: dirToWorld(node, p.dir),
    node,
  }))
}

export function worldPrims(node: Node, ctx: RenderCtx): Prim[] {
  const def = COMPONENTS[node.type] as ComponentDef<NodeType>
  const local = def.prims(node as never, ctx)
  return xformPrims(local, node.x, node.y, node.rot || 0, Boolean(node.mir))
}

export interface ConnectionGraph {
  all: WorldPort[]
  link: Map<WorldPort, WorldPort>
  open: WorldPort[]
}

/** Hitung sambungan antar port (posisi < 2 mm dan arah berlawanan). */
export function connect(project: Project): ConnectionGraph {
  const all = project.nodes.flatMap(n => worldPorts(n, project.unit))
  const link = new Map<WorldPort, WorldPort>()
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!
      const b = all[j]!
      if (
        a.node !== b.node
        && !link.has(a)
        && !link.has(b)
        && dist(a.pos, b.pos) < 2
        && Math.abs(norm(a.wdir - b.wdir + 180)) < 1
      ) {
        link.set(a, b)
        link.set(b, a)
      }
    }
  }
  return { all, link, open: all.filter(p => !link.has(p)) }
}

/** Total debit diffuser/grille yang tersambung ke setiap FCU/fan. */
export function flowTotals(project: Project, cn: ConnectionGraph): Record<string, number> {
  const byNode = new Map<Node, WorldPort[]>()
  for (const p of cn.all) {
    const list = byNode.get(p.node)
    if (list) list.push(p)
    else byNode.set(p.node, [p])
  }
  const out: Record<string, number> = {}
  for (const src of project.nodes) {
    if (src.type !== 'fcu' && src.type !== 'fan') continue
    let sum = 0
    const seen = new Set<Node>([src])
    const queue: Node[] = [src]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (current !== src && (current.type === 'diffuser' || current.type === 'grille')) {
        sum += Number(current.flow) || 0
      }
      if (current !== src && (current.type === 'fcu' || current.type === 'fan')) continue
      for (const a of byNode.get(current) ?? []) {
        const b = cn.link.get(a)
        if (b && !seen.has(b.node)) {
          seen.add(b.node)
          queue.push(b.node)
        }
      }
    }
    out[src.id] = sum
  }
  return out
}

/** Bangun konteks render proyek (skala teks, debit FCU/fan, potongan pintu, bobokan dinding). */
export function ctxOf(project: Project, cn?: ConnectionGraph): RenderCtx {
  syncHosts(project)
  const cuts: RenderCtx['cuts'] = {}
  const pen: RenderCtx['pen'] = {}
  const walls: Array<[Point, Point]> = []

  for (const n of project.nodes) {
    if ((n.type === 'door' || n.type === 'win' || n.type === 'opening') && n.host) {
      const byRoom = (cuts[n.host.id] ??= {})
      const byEdge = (byRoom[n.host.e] ??= [])
      byEdge.push([n.host.s, n.host.s + n.dw])
    }
    if (n.type === 'room') {
      for (const edge of roomEdges(n)) walls.push([edge.A, edge.C])
    }
    if (n.type === 'partition') {
      walls.push([[n.x, n.y], localToWorld(n, [n.L, 0])])
    }
  }

  for (const n of project.nodes) {
    if (n.type !== 'straight' && n.type !== 'flex') continue
    const a: Point = [n.x, n.y]
    const b = localToWorld(n, [n.L, 0])
    for (const [c, d] of walls) {
      const t = segX(a, b, c, d)
      if (t !== null) {
        (pen[n.id] ??= []).push(t * n.L)
      }
    }
  }

  return {
    unit: project.unit,
    fu: project.fu || 'cfm',
    th: 1.8 * scaleDen(project.scale),
    hang: project.hang,
    flows: cn ? flowTotals(project, cn) : {},
    cuts,
    pen,
  }
}

export function projectBounds(
  project: Project,
  ctx: RenderCtx,
  filter: (node: Node) => boolean = () => true,
): Bounds {
  let b: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
  for (const n of project.nodes) {
    if (!filter(n)) continue
    const q = primBounds(worldPrims(n, ctx))
    b = [
      Math.min(b[0], q[0]),
      Math.min(b[1], q[1]),
      Math.max(b[2], q[2]),
      Math.max(b[3], q[3]),
    ]
  }
  return Number.isFinite(b[0]) ? b : [0, 0, 6000, 4000]
}
