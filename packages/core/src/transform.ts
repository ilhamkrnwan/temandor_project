import { hostAt, isHostedOpening, syncHost, syncHosts, visibleRooms } from './archHost'
import { worldPorts } from './components'
import { dist, localToWorld, norm, rotP } from './geom'
import { createId } from './model'
import type { RenderCtx } from './prims'
import { isNodeLocked, nodesBounds } from './select'
import type { Node, Point, Project, RoomNode, WorldPort } from './types'

export interface MoveSnapOptions {
  snapEnabled: boolean
  gridStep: number
  pxPerMm: number
  openPorts: readonly WorldPort[]
}

export interface HostedMoveOptions {
  rawDx: number
  rawDy: number
  toleranceMm: number
}

/**
 * Hitung delta geser (mm) dengan snap grid dan magnet port terbuka ke port komponen yang sedang digeser.
 * Komponen terkunci tidak ikut dihitung.
 */
export function computeMoveDelta(
  project: Project,
  movingIds: ReadonlySet<string>,
  rawDx: number,
  rawDy: number,
  options: MoveSnapOptions,
): Point {
  const step = options.gridStep > 0 ? options.gridStep : 100
  let dx = options.snapEnabled ? Math.round(rawDx / step) * step : rawDx
  let dy = options.snapEnabled ? Math.round(rawDy / step) * step : rawDy

  if (options.snapEnabled && options.openPorts.length > 0) {
    const tol = 14 / (options.pxPerMm > 0 ? options.pxPerMm : 1)
    let best: Point | null = null
    let bestDist = tol

    for (const node of project.nodes) {
      if (!movingIds.has(node.id) || isNodeLocked(project, node)) continue
      const moved = { ...node, x: node.x + dx, y: node.y + dy }
      for (const a of worldPorts(moved, project.unit)) {
        for (const b of options.openPorts) {
          if (Math.abs(norm(a.wdir - b.wdir + 180)) > 1) continue
          const d = dist(a.pos, b.pos)
          if (d < bestDist) {
            bestDist = d
            best = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]]
          }
        }
      }
    }

    if (best) {
      dx += best[0]
      dy += best[1]
    }
  }

  return [dx, dy]
}

/** Buat salinan ghost dari komponen terpilih yang digeser `(dx, dy)` tanpa menyentuh proyek. */
export function previewMovedNodes(
  project: Project,
  movingIds: ReadonlySet<string>,
  dx: number,
  dy: number,
  hostedOptions?: HostedMoveOptions,
): Node[] {
  const staticRooms = hostedOptions ? visibleRooms(project, movingIds) : []
  const movedRoomsById = new Map<string, RoomNode>()
  const out: Node[] = []

  for (const node of project.nodes) {
    if (!movingIds.has(node.id) || isNodeLocked(project, node)) continue
    const clone = JSON.parse(JSON.stringify(node)) as Node

    if (hostedOptions && isHostedOpening(clone) && !(clone.host && movingIds.has(clone.host.id))) {
      const center0 = localToWorld(node, [clone.dw / 2, clone.t / 2])
      const targetCenter: Point = [center0[0] + hostedOptions.rawDx, center0[1] + hostedOptions.rawDy]
      const nextHost = hostAt(clone, targetCenter, staticRooms, hostedOptions.toleranceMm)
      if (nextHost) {
        clone.host = nextHost
        const hostRoom = staticRooms.find(r => r.id === nextHost.id)
        if (hostRoom) syncHost(clone, hostRoom)
      }
      else {
        delete clone.host
        clone.x += dx
        clone.y += dy
      }
      out.push(clone)
      continue
    }

    clone.x += dx
    clone.y += dy
    if (clone.type === 'room') movedRoomsById.set(clone.id, clone)
    out.push(clone)
  }

  // Sertakan pintu/jendela yang menempel pada ruangan yang sedang digeser agar ghost terlihat ikut pindah
  if (movedRoomsById.size > 0) {
    for (const node of project.nodes) {
      if (movingIds.has(node.id) || !isHostedOpening(node) || !node.host) continue
      const movedRoom = movedRoomsById.get(node.host.id)
      if (!movedRoom) continue
      const clone = JSON.parse(JSON.stringify(node)) as typeof node
      syncHost(clone, movedRoom)
      out.push(clone)
    }
  }

  return out
}

/** Geser semua komponen terpilih yang tidak terkunci pada draft proyek. */
export function translateSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  dx: number,
  dy: number,
  hostedOptions?: HostedMoveOptions,
): boolean {
  if (dx === 0 && dy === 0 && (!hostedOptions || (hostedOptions.rawDx === 0 && hostedOptions.rawDy === 0))) {
    return false
  }
  const staticRooms = hostedOptions ? visibleRooms(draft, selectedIds) : []
  let moved = false

  for (const node of draft.nodes) {
    if (!selectedIds.has(node.id) || isNodeLocked(draft, node)) continue

    if (hostedOptions && isHostedOpening(node) && !(node.host && selectedIds.has(node.host.id))) {
      const center0 = localToWorld(node, [node.dw / 2, node.t / 2])
      const targetCenter: Point = [center0[0] + hostedOptions.rawDx, center0[1] + hostedOptions.rawDy]
      const nextHost = hostAt(node, targetCenter, staticRooms, hostedOptions.toleranceMm)
      if (nextHost) {
        node.host = nextHost
        const hostRoom = staticRooms.find(r => r.id === nextHost.id)
        if (hostRoom) syncHost(node, hostRoom)
      }
      else {
        delete node.host
        node.x += dx
        node.y += dy
      }
      moved = true
      continue
    }

    node.x += dx
    node.y += dy
    moved = true
  }

  if (moved) {
    syncHosts(draft)
  }
  return moved
}

/**
 * Putar komponen terpilih sebesar `deg` derajat (default 90°).
 * - Pintu tunggal yang menempel di dinding: membalik arah buka (`in` <-> `out`).
 * - Komponen lain: diputar mengelilingi pusat bbox (dibulatkan ke `gridStep`).
 */
export function rotateSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  deg: number,
  gridStep: number,
  ctx: RenderCtx,
): boolean {
  const movable = draft.nodes.filter(n => selectedIds.has(n.id) && !isNodeLocked(draft, n))
  if (movable.length === 0) return false

  if (movable.length === 1) {
    const only = movable[0]!
    if (only.type === 'door' && only.host) {
      only.swing = only.swing === 'out' ? 'in' : 'out'
      return true
    }
  }

  const b = nodesBounds(movable, ctx)
  if (!b) return false
  const step = gridStep > 0 ? gridStep : 100
  const center: Point = [
    Math.round(((b[0] + b[2]) / 2) / step) * step,
    Math.round(((b[1] + b[3]) / 2) / step) * step,
  ]

  for (const node of movable) {
    const q = rotP([node.x - center[0], node.y - center[1]], deg)
    node.x = center[0] + q[0]
    node.y = center[1] + q[1]
    node.rot = norm((node.rot || 0) + deg)
  }
  return true
}

/**
 * Cerminkan komponen terpilih.
 * - Pintu tunggal yang menempel di dinding: membalik sisi engsel (`l` <-> `r`).
 * - Satu komponen: membalik properti `mir` (port `a` tetap di tempat).
 * - Banyak komponen: mencerminkan terhadap sumbu vertikal tengah bbox pilihan.
 */
export function mirrorSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  ctx: RenderCtx,
): boolean {
  const movable = draft.nodes.filter(n => selectedIds.has(n.id) && !isNodeLocked(draft, n))
  if (movable.length === 0) return false

  if (movable.length === 1) {
    const only = movable[0]!
    if (only.type === 'door' && only.host) {
      only.hinge = only.hinge === 'r' ? 'l' : 'r'
      return true
    }
    only.mir = !only.mir
    return true
  }

  const b = nodesBounds(movable, ctx)
  if (!b) return false
  const cx = (b[0] + b[2]) / 2

  for (const node of movable) {
    node.x = 2 * cx - node.x
    node.rot = norm(180 - (node.rot || 0))
    node.mir = !node.mir
  }
  return true
}

/**
 * Siapkan salinan node dari clipboard untuk ditempel ke proyek:
 * ID baru, ID group baru per group lama, offset ke kursor (atau `5 * gridStep`), serta remap `host` pintu/jendela.
 */
export function cloneNodesForPaste(
  clipboard: readonly Node[],
  targetCenter: Point | null,
  gridStep: number,
  ctx: RenderCtx,
  idFactory: () => string = createId,
): Node[] {
  if (clipboard.length === 0) return []
  const b = nodesBounds(clipboard, ctx)
  const step = gridStep > 0 ? gridStep : 100
  const offset: Point = targetCenter && b
    ? [
        Math.round((targetCenter[0] - (b[0] + b[2]) / 2) / step) * step,
        Math.round((targetCenter[1] - (b[1] + b[3]) / 2) / step) * step,
      ]
    : [step * 5, step * 5]

  const idMap = new Map<string, string>()
  const groupMap = new Map<string, string>()
  for (const n of clipboard) {
    idMap.set(n.id, idFactory())
  }

  return clipboard.map((orig) => {
    const copy = JSON.parse(JSON.stringify(orig)) as Node
    copy.id = idMap.get(orig.id)!
    copy.x += offset[0]
    copy.y += offset[1]
    if (copy.lock) delete copy.lock

    if (orig.g) {
      let nextGroup = groupMap.get(orig.g)
      if (!nextGroup) {
        nextGroup = idFactory()
        groupMap.set(orig.g, nextGroup)
      }
      copy.g = nextGroup
    }

    if ((copy.type === 'door' || copy.type === 'win' || copy.type === 'opening') && copy.host) {
      const remappedRoomId = idMap.get(copy.host.id)
      if (remappedRoomId) {
        copy.host.id = remappedRoomId
      }
      else {
        copy.host.s += copy.dw + 200
      }
    }

    return copy
  })
}

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** Periksa apakah pilihan (>= 2 komponen) tergabung dalam satu group yang sama. */
export function isSelectionGrouped(project: Project, selectedIds: ReadonlySet<string>): boolean {
  const selected = project.nodes.filter(n => selectedIds.has(n.id))
  if (selected.length < 2) return false
  const firstGroup = selected[0]?.g
  return Boolean(firstGroup && selected.every(n => n.g === firstGroup))
}

/** Gabungkan komponen terpilih yang tidak terkunci (>= 2) ke dalam satu group baru. */
export function groupSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  idFactory: () => string = createId,
): string | null {
  const movable = draft.nodes.filter(n => selectedIds.has(n.id) && !isNodeLocked(draft, n))
  if (movable.length < 2) return null
  const groupId = idFactory()
  for (const node of movable) {
    node.g = groupId
  }
  return groupId
}

/** Lepas ikatan group dari semua komponen terpilih. */
export function ungroupSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
): boolean {
  let changed = false
  for (const node of draft.nodes) {
    if (!selectedIds.has(node.id) || !node.g) continue
    delete node.g
    changed = true
  }
  return changed
}

/**
 * Ratakan posisi komponen terpilih (`left`, `center`, `right`, `top`, `middle`, `bottom`).
 * Komponen dalam satu group dihitung sebagai satu kesatuan.
 */
export function alignSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  direction: AlignDirection,
  ctx: RenderCtx,
): boolean {
  const movable = draft.nodes.filter(n => selectedIds.has(n.id) && !isNodeLocked(draft, n))
  if (movable.length < 2) return false

  const units = new Map<string, Node[]>()
  for (const node of movable) {
    const key = node.g || node.id
    const bucket = units.get(key)
    if (bucket) bucket.push(node)
    else units.set(key, [node])
  }
  if (units.size < 2) return false

  const totalBounds = nodesBounds(movable, ctx)
  if (!totalBounds) return false

  let changed = false
  for (const unit of units.values()) {
    const b = nodesBounds(unit, ctx)
    if (!b) continue
    let dx = 0
    let dy = 0
    if (direction === 'left') dx = totalBounds[0] - b[0]
    else if (direction === 'right') dx = totalBounds[2] - b[2]
    else if (direction === 'center') dx = (totalBounds[0] + totalBounds[2] - b[0] - b[2]) / 2
    else if (direction === 'top') dy = totalBounds[1] - b[1]
    else if (direction === 'bottom') dy = totalBounds[3] - b[3]
    else if (direction === 'middle') dy = (totalBounds[1] + totalBounds[3] - b[1] - b[3]) / 2

    if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
      for (const node of unit) {
        node.x += dx
        node.y += dy
      }
      changed = true
    }
  }
  return changed
}

/** Kunci atau buka kunci per komponen pada pilihan saat ini. */
export function lockSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  locked: boolean,
): boolean {
  let changed = false
  for (const node of draft.nodes) {
    if (!selectedIds.has(node.id)) continue
    if (locked) {
      if (!node.lock) {
        node.lock = true
        changed = true
      }
    }
    else if (node.lock) {
      delete node.lock
      changed = true
    }
  }
  return changed
}

/** Pindahkan komponen terpilih ke paling depan (`front`, `]`) atau paling belakang (`back`, `[`). */
export function reorderSelectedInPlace(
  draft: Project,
  selectedIds: ReadonlySet<string>,
  direction: 'front' | 'back',
): boolean {
  if (selectedIds.size === 0) return false
  const selected = draft.nodes.filter(n => selectedIds.has(n.id))
  const others = draft.nodes.filter(n => !selectedIds.has(n.id))
  if (selected.length === 0 || others.length === 0) return false

  const next = direction === 'front' ? [...others, ...selected] : [...selected, ...others]
  const sameOrder = next.every((n, i) => n === draft.nodes[i])
  if (sameOrder) return false

  draft.nodes = next
  return true
}
