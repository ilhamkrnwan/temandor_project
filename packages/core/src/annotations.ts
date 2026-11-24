import { componentOf, connect, ctxOf, flowTotals, worldPrims, type ConnectionGraph } from './components'
import { sizeLabel } from './geom'
import type { RenderCtx } from './prims'
import type { FlowUnit, Node, Project, StraightNode } from './types'

export interface EquipmentFlowSummary {
  readonly id: string
  readonly type: 'fcu' | 'fan'
  readonly tag: string
  readonly flow: number
  readonly fu: FlowUnit
}

export interface DuctAnnotationSummary {
  readonly sizeText: string | null
  readonly hasArrow: boolean
  readonly arrowDir: 0 | 180
}

/** Hitung jumlah titik gantungan otomatis (rod + support) pada satu komponen duct. */
export function countNodeHangers(node: Node, ctx: RenderCtx): number {
  if (!componentOf(node.type).duct) return 0
  let count = 0
  for (const pr of worldPrims(node, ctx)) {
    if (pr.layer === 'hanger' && pr.k === 'l') count += 1
  }
  return count
}

/** Hitung total titik gantungan otomatis pada seluruh komponen duct di proyek. */
export function countProjectHangers(project: Project, ctx?: RenderCtx): number {
  const renderCtx = ctx ?? ctxOf(project, connect(project))
  let total = 0
  for (const node of project.nodes) {
    total += countNodeHangers(node, renderCtx)
  }
  return total
}

/** Ringkasan total debit udara (cfm atau l/s) yang tersambung ke setiap unit FCU dan fan. */
export function equipmentFlowSummaries(
  project: Project,
  cn?: ConnectionGraph,
): EquipmentFlowSummary[] {
  const graph = cn ?? connect(project)
  const totals = flowTotals(project, graph)
  const out: EquipmentFlowSummary[] = []
  for (const node of project.nodes) {
    if (node.type !== 'fcu' && node.type !== 'fan') continue
    out.push({
      id: node.id,
      type: node.type,
      tag: node.tag,
      flow: totals[node.id] ?? 0,
      fu: project.fu || 'cfm',
    })
  }
  return out
}

/** Ringkasan anotasi ukuran dan panah aliran yang tampil pada satu segmen duct lurus. */
export function ductAnnotationSummary(
  node: Pick<StraightNode, 'L' | 'w' | 'h' | 'shape' | 'flip'>,
  ctx: Pick<RenderCtx, 'unit' | 'th'>,
): DuctAnnotationSummary {
  const label = sizeLabel(node.w, node.h, node.shape, ctx.unit)
  const showText = node.L > label.length * ctx.th * 0.65
  const hasArrow = node.L > ctx.th * 2.2
  return {
    sizeText: showText ? label : null,
    hasArrow,
    arrowDir: node.flip ? 180 : 0,
  }
}
