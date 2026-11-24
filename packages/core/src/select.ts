import { componentOf, layerOf, worldPrims } from './components'
import { primBounds, type Bounds } from './geom'
import type { RenderCtx } from './prims'
import type { Node, Point, Project } from './types'

export type SelectionBoxMode = 'window' | 'crossing'

export interface SelectionBoxResult {
  ids: Set<string>
  mode: SelectionBoxMode
}

export interface TabSelectionStep {
  next: Set<string>
  node: Node | null
  index: number
  total: number
  exitCanvas: boolean
}

export function isNodeVisible(project: Project, node: Node): boolean {
  return project.layers[layerOf(node)]?.on !== false
}

export function isLayerLocked(project: Project, node: Node): boolean {
  return Boolean(project.layers[layerOf(node)]?.lock)
}

/** Komponen terkunci jika layer-nya terkunci ATAU komponen itu sendiri memiliki `lock: true`. */
export function isNodeLocked(project: Project, node: Node): boolean {
  return isLayerLocked(project, node) || Boolean(node.lock)
}

export function groupIdsOf(project: Project, node: Node): string[] {
  if (!node.g) return [node.id]
  return project.nodes.filter(m => m.g === node.g).map(m => m.id)
}

export function expandGroups(project: Project, ids: Iterable<string>): Set<string> {
  const byId = new Map(project.nodes.map(n => [n.id, n]))
  const out = new Set<string>()
  for (const id of ids) {
    const n = byId.get(id)
    if (!n) continue
    for (const memberId of groupIdsOf(project, n)) {
      out.add(memberId)
    }
  }
  return out
}

export function nodeBounds(node: Node, ctx: RenderCtx): Bounds {
  return primBounds(worldPrims(node, ctx))
}

export function nodesBounds(nodes: readonly Node[], ctx: RenderCtx): Bounds | null {
  if (nodes.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const n of nodes) {
    const q = nodeBounds(n, ctx)
    if (!Number.isFinite(q[0])) continue
    x0 = Math.min(x0, q[0])
    y0 = Math.min(y0, q[1])
    x1 = Math.max(x1, q[2])
    y1 = Math.max(y1, q[3])
  }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : null
}

/**
 * Seleksi klik tunggal / `Shift`+klik.
 * - Layer terkunci: tidak bisa dipilih.
 * - Komponen terkunci (`node.lock = true`): TETAP bisa dipilih agar pengguna bisa membuka kuncinya.
 */
export function clickSelect(
  project: Project,
  current: ReadonlySet<string>,
  nodeId: string,
  shiftKey: boolean,
): Set<string> {
  const target = project.nodes.find(n => n.id === nodeId)
  if (!target || !isNodeVisible(project, target) || isLayerLocked(project, target)) {
    return new Set(current)
  }

  const groupIds = groupIdsOf(project, target)
  if (shiftKey) {
    const next = new Set(current)
    const alreadySelected = next.has(target.id)
    for (const id of groupIds) {
      if (alreadySelected) next.delete(id)
      else next.add(id)
    }
    return next
  }

  return new Set(groupIds)
}

/**
 * Seleksi kotak tarik (marquee):
 * - Kiri -> kanan (`end[0] > start[0]`): `window`, komponen harus masuk penuh di dalam kotak.
 * - Kanan -> kiri (`end[0] <= start[0]`): `crossing`, cukup bersinggungan dengan kotak.
 */
export function selectByBox(
  project: Project,
  start: Point,
  end: Point,
  ctx: RenderCtx,
): SelectionBoxResult {
  const mode: SelectionBoxMode = end[0] > start[0] ? 'window' : 'crossing'
  const r0 = Math.min(start[0], end[0])
  const r1 = Math.min(start[1], end[1])
  const r2 = Math.max(start[0], end[0])
  const r3 = Math.max(start[1], end[1])

  const matched = new Set<string>()
  for (const n of project.nodes) {
    if (!isNodeVisible(project, n) || isNodeLocked(project, n)) continue
    const q = nodeBounds(n, ctx)
    if (!Number.isFinite(q[0])) continue
    const ok = mode === 'window'
      ? q[0] >= r0 && q[1] >= r1 && q[2] <= r2 && q[3] <= r3
      : q[0] <= r2 && q[2] >= r0 && q[1] <= r3 && q[3] >= r1
    if (ok) matched.add(n.id)
  }

  return {
    ids: expandGroups(project, matched),
    mode,
  }
}

/** Daftar komponen yang dapat dilewati dengan `Tab` di kanvas (satu entri per group; komponen terkunci tetap bisa dipilih). */
export function tabSelectableNodes(project: Project): Node[] {
  const seenGroups = new Set<string>()
  const list: Node[] = []
  for (const n of project.nodes) {
    if (!isNodeVisible(project, n) || isLayerLocked(project, n)) continue
    if (n.g) {
      if (seenGroups.has(n.g)) continue
      seenGroups.add(n.g)
    }
    list.push(n)
  }
  return list
}

/**
 * Pindah seleksi satu langkah dengan `Tab` / `Shift+Tab`.
 * Setelah komponen terakhir (atau sebelum komponen pertama), seleksi dibersihkan dan `exitCanvas = true`
 * agar fokus keyboard keluar dari kanvas secara alami (bukan jebakan fokus).
 */
export function stepTabSelection(
  project: Project,
  current: ReadonlySet<string>,
  reverse: boolean,
): TabSelectionStep {
  const list = tabSelectableNodes(project)
  if (list.length === 0) {
    return { next: new Set(), node: null, index: -1, total: 0, exitCanvas: true }
  }

  let index: number
  if (current.size > 0) {
    const currentIdx = list.findIndex(n => current.has(n.id))
    index = currentIdx >= 0
      ? currentIdx + (reverse ? -1 : 1)
      : (reverse ? list.length - 1 : 0)
  }
  else {
    index = reverse ? list.length - 1 : 0
  }

  if (index < 0 || index >= list.length) {
    return { next: new Set(), node: null, index: -1, total: list.length, exitCanvas: true }
  }

  const picked = list[index]!
  return {
    next: new Set(groupIdsOf(project, picked)),
    node: picked,
    index,
    total: list.length,
    exitCanvas: false,
  }
}

/** ID komponen terpilih yang boleh digeser (tidak terkunci layer maupun `node.lock`). */
export function movableSelectedIds(project: Project, selectedIds: ReadonlySet<string>): string[] {
  return project.nodes
    .filter(n => selectedIds.has(n.id) && !isNodeLocked(project, n))
    .map(n => n.id)
}

/** ID komponen terpilih yang boleh dihapus (tidak terkunci layer maupun `node.lock`). */
export function deletableSelectedIds(project: Project, selectedIds: ReadonlySet<string>): string[] {
  return movableSelectedIds(project, selectedIds)
}

/** Semua ID komponen yang tampil dan tidak terkunci (`Ctrl+A`). */
export function selectAllIds(project: Project): Set<string> {
  return new Set(
    project.nodes
      .filter(n => isNodeVisible(project, n) && !isNodeLocked(project, n))
      .map(n => n.id),
  )
}

/** Nama manusiawi komponen untuk pengumuman pembaca layar (`aria-live`). */
export function nodeDisplayName(node: Node): string {
  const base = componentOf(node.type).name
  if ('name' in node && node.name) return `${base} ${node.name}`
  if ('tag' in node && node.tag) return `${base} ${node.tag}`
  return base
}
