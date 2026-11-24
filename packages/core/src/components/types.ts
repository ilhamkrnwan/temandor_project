import type { DuctShape, LayerKey, Node, NodeOf, NodeType, Port, Prim, Unit } from '../types'
import type { RenderCtx } from '../prims'

export type LocalGrip = readonly [id: string, x: number, y: number]

export interface ComponentDef<T extends NodeType = NodeType> {
  readonly name: string
  readonly icon?: string
  readonly layer?: LayerKey
  readonly duct?: boolean
  readonly mirror?: boolean
  ports?: (node: NodeOf<T>, unit: Unit) => Port[]
  prims: (node: NodeOf<T>, ctx: RenderCtx) => Prim[]
  grips?: (node: NodeOf<T>, unit: Unit) => LocalGrip[]
}

export type ComponentRegistry = {
  [K in NodeType]: ComponentDef<K>
}

export type PortSizeKey = 'w' | 'h' | 'w2' | 'h2' | 'bw' | 'bh'

export interface PortSizedNode {
  w: number
  h: number
  shape: DuctShape
  w2?: number | null
  h2?: number | null
  bw?: number
  bh?: number
}

export function port(
  id: string,
  x: number,
  y: number,
  dir: number,
  n: PortSizedNode,
  opts: Partial<Omit<Port, 'keys'>> & { keys?: [PortSizeKey, PortSizeKey] | null } = {},
): Port {
  const keys = opts.keys === undefined ? (['w', 'h'] as [PortSizeKey, PortSizeKey]) : opts.keys
  const wVal = keys ? (n[keys[0]] ?? undefined) : undefined
  const hVal = keys ? (n[keys[1]] ?? undefined) : undefined
  return {
    id,
    x,
    y,
    dir,
    w: wVal,
    h: hVal,
    shape: n.shape,
    keys,
    ...opts,
  }
}

export function anyPort(id: string, x: number, y: number, dir: number, opts: Partial<Port> = {}): Port {
  return {
    id,
    x,
    y,
    dir,
    any: true,
    keys: null,
    ...opts,
  }
}

export type DuctLikeNode = Extract<Node, { sys: unknown }>
