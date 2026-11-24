import { componentOf, connect, worldPrims, type ConnectionGraph } from './components'
import { polyHit, primBounds, scaleDen, sizeLabel } from './geom'
import type { RenderCtx } from './prims'
import type { DuctShape, HitPrim, Node, Point, Project } from './types'

export type WarningKind = 'open' | 'size' | 'sys' | 'flow' | 'clash'

export interface ValidationWarning {
  kind: WarningKind
  msg: string
  detail: string
  pos: Point
  id: string
}

type DuctSizedNode = Extract<Node, { w: number, h: number, shape: DuctShape }>

function hasDuctSize(node: Node): node is DuctSizedNode {
  return 'w' in node && 'h' in node && 'shape' in node
}

/**
 * Validasi jaringan ducting dan tabrakan struktur.
 * Hanya menghasilkan warning (tidak pernah melarang simpan atau export).
 * Duct yang menembus dinding/partisi ditandai kotak bobokan di `ctxOf`, bukan warning.
 */
export function validate(project: Project, cn?: ConnectionGraph): ValidationWarning[] {
  const graph = cn ?? connect(project)
  const warnings: ValidationWarning[] = []
  const nodeName = (node: Node) => componentOf(node.type).name

  for (const a of graph.all) {
    const b = graph.link.get(a)
    if (!b) {
      if (!a.opt) {
        warnings.push({
          kind: 'open',
          msg: 'Ujung terbuka',
          detail: `${nodeName(a.node)} belum tersambung. Sambungkan atau pasang end cap.`,
          pos: a.pos,
          id: a.node.id,
        })
      }
      continue
    }

    // Cek tiap pasangan node tersambung satu kali saja.
    if (a.node.id > b.node.id) continue

    if (
      !a.any
      && !b.any
      && a.w != null
      && a.h != null
      && a.shape != null
      && b.w != null
      && b.h != null
      && b.shape != null
      && (a.shape !== b.shape || a.w !== b.w || (a.shape !== 'round' && a.h !== b.h))
    ) {
      warnings.push({
        kind: 'size',
        msg: 'Ukuran beda tanpa transisi',
        detail: `${sizeLabel(a.w, a.h, a.shape, project.unit)} langsung ke ${sizeLabel(b.w, b.h, b.shape, project.unit)}. Tambah transisi.`,
        pos: a.pos,
        id: a.node.id,
      })
    }

    if (
      'sys' in a.node
      && 'sys' in b.node
      && a.node.sys
      && b.node.sys
      && a.node.sys !== b.node.sys
    ) {
      warnings.push({
        kind: 'sys',
        msg: 'Sistem tercampur',
        detail: `${a.node.sys} tersambung ke ${b.node.sys}.`,
        pos: a.pos,
        id: a.node.id,
      })
    }
  }

  for (const node of project.nodes) {
    if ((node.type === 'diffuser' || node.type === 'grille') && !(Number(node.flow) > 0)) {
      const label = node.tag ? `${nodeName(node)} ${node.tag}` : nodeName(node)
      warnings.push({
        kind: 'flow',
        msg: 'Debit belum diisi',
        detail: `${label} belum punya debit.`,
        pos: [node.x, node.y],
        id: node.id,
      })
    }
  }

  // Duct menabrak kolom / tangga / lift. Tembus dinding tidak dihitung (dibobok di lapangan).
  const ctx: RenderCtx = {
    unit: project.unit,
    fu: project.fu || 'cfm',
    th: 1.8 * scaleDen(project.scale),
    hang: { on: false, sp: 1500 },
    flows: {},
    cuts: {},
    pen: {},
  }
  const hitPolys = (node: Node): Point[][] =>
    worldPrims(node, ctx)
      .filter((pr): pr is HitPrim => pr.k === 'hit')
      .map(pr => pr.pts)

  const obstacles = project.nodes
    .filter(n => n.type === 'column' || n.type === 'stair' || n.type === 'lift')
    .map(node => ({ node, hits: hitPolys(node) }))

  if (obstacles.length > 0) {
    for (const duct of project.nodes) {
      if (!componentOf(duct.type).duct || !hasDuctSize(duct)) continue
      const ductHits = hitPolys(duct)
      for (const obstacle of obstacles) {
        if (ductHits.some(a => obstacle.hits.some(b => polyHit(a, b)))) {
          const bounds = primBounds(worldPrims(obstacle.node, ctx))
          const obsLabel = nodeName(obstacle.node).toLowerCase()
          warnings.push({
            kind: 'clash',
            msg: `Duct menabrak ${obsLabel}`,
            detail: `${nodeName(duct)} ${sizeLabel(duct.w, duct.h, duct.shape, project.unit)} melewati ${obsLabel}. Geser jalur duct menjauh, atau belokkan dengan elbow.`,
            pos: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
            id: duct.id,
          })
        }
      }
    }
  }

  return warnings
}
