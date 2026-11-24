import { defineStore } from 'pinia'
import {
  DEFAULT_MAX_HISTORY,
  alignSelectedInPlace,
  applyGrip,
  applyGripDblClick,
  applyPropertyToNodes,
  applyRoomShape,
  clearHistory,
  cloneNodesForPaste,
  commitProject,
  componentOf,
  connect,
  createHistory,
  createId,
  ctxOf,
  defaultDuctSpec,
  deletableSelectedIds,
  demoProject,
  fitViewBox,
  groupSelectedInPlace,
  isHostedOpening,
  isLayerLocked,
  isNodeLocked,
  isNodeVisible,
  lockSelectedInPlace,
  mirrorSelectedInPlace,
  newProject,
  nextRoomName,
  pathNodes,
  projectBounds,
  redoProject,
  reorderSelectedInPlace,
  rotateSelectedInPlace,
  selectAllIds,
  syncHosts,
  translateSelectedInPlace,
  undoProject,
  ungroupSelectedInPlace,
  type AlignDirection,
  type DuctPathNode,
  type DuctSpec,
  type EditorTool,
  type HostedMoveOptions,
  type LayerKey,
  type Node,
  type NodePropKey,
  type Point,
  type Project,
  type PropertyUpdateResult,
  type RoomShapeKey,
  type TextNode,
  type ViewBox,
} from '../../shared/cad'
import { indexedDbProjectStorage, type ProjectStorageAdapter } from '../utils/projectStorage'

export const AUTOSAVE_DEBOUNCE_MS = 500

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface EditorViewportState {
  viewBox: ViewBox
  showGrid: boolean
  pxPerMm: number
}

function defaultProjectForId(id: string): Project {
  const base = id === 'contoh' ? demoProject() : newProject({ name: 'Proyek baru' })
  return { ...base, id }
}

function boundsViewBoxOf(project: Project): ViewBox {
  const cn = connect(project)
  const ctx = ctxOf(project, cn)
  return fitViewBox(projectBounds(project, ctx))
}

function formatSavedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const useEditor = defineStore('editor', () => {
  const initialProject = defaultProjectForId('contoh')
  const project = shallowRef<Project>(initialProject)
  const selectedIds = shallowRef<ReadonlySet<string>>(new Set())
  const clipboard = shallowRef<Node[]>([])
  const tool = ref<EditorTool>('select')
  const ductSpec = ref<DuctSpec>(defaultDuctSpec(initialProject.unit))
  const viewBox = ref<ViewBox>(boundsViewBoxOf(initialProject))
  const showGrid = ref(true)
  const snapEnabled = ref(true)
  const orthoEnabled = ref(true)
  const pxPerMm = ref(1)

  const loadedId = ref<string | null>(null)
  const loading = ref(false)
  const notFound = ref(false)
  const saveStatus = ref<SaveStatus>('idle')
  const savedAt = ref<number | null>(null)
  const saveError = ref<string | null>(null)

  const history = createHistory(DEFAULT_MAX_HISTORY)
  const undoCount = ref(0)
  const redoCount = ref(0)
  const undoLabel = ref<string | null>(null)
  const redoLabel = ref<string | null>(null)

  let storage: ProjectStorageAdapter = indexedDbProjectStorage
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saveRevision = 0
  let inFlightSave: Promise<boolean> | null = null
  let openSeq = 0

  const canUndo = computed(() => undoCount.value > 0)
  const canRedo = computed(() => redoCount.value > 0)
  const viewport = computed<EditorViewportState>(() => ({
    viewBox: viewBox.value,
    showGrid: showGrid.value,
    pxPerMm: pxPerMm.value,
  }))
  const saveStatusLabel = computed(() => {
    if (saveStatus.value === 'pending' || saveStatus.value === 'saving') return 'Menyimpan...'
    if (saveStatus.value === 'error') return 'Gagal simpan'
    if (saveStatus.value === 'saved' && savedAt.value != null) {
      return `Tersimpan ${formatSavedTime(savedAt.value)}`
    }
    return 'Tersimpan di browser'
  })

  function syncHistoryMeta() {
    undoCount.value = history.past.length
    redoCount.value = history.future.length
    undoLabel.value = history.past.at(-1)?.label ?? null
    redoLabel.value = history.future.at(-1)?.label ?? null
  }

  function pruneSelection(current: Project) {
    if (selectedIds.value.size === 0) return
    const validIds = new Set(current.nodes.map(n => n.id))
    const next = new Set<string>()
    for (const id of selectedIds.value) {
      if (validIds.has(id)) next.add(id)
    }
    if (next.size !== selectedIds.value.size) {
      selectedIds.value = next
    }
  }

  function cancelPendingSave() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  async function flushSave(): Promise<boolean> {
    cancelPendingSave()
    if (inFlightSave) return inFlightSave

    const targetRevision = saveRevision
    const targetProject = project.value
    saveStatus.value = 'saving'
    saveError.value = null

    const run = (async () => {
      try {
        const updated = await storage.save(targetProject)
        // Hanya perbarui timestamp di state jika belum ada proyek lain yang dibuka
        if (project.value.id === targetProject.id) {
          savedAt.value = updated
        }
        if (saveRevision === targetRevision) {
          saveStatus.value = 'saved'
        }
        return true
      }
      catch (err) {
        saveStatus.value = 'error'
        saveError.value = err instanceof Error ? err.message : 'Gagal menyimpan proyek.'
        return false
      }
      finally {
        inFlightSave = null
        // Jika ada perubahan baru selama proses simpan sebelumnya, jadwalkan simpan ulang
        if (saveRevision !== targetRevision && saveTimer === null) {
          scheduleAutosave()
        }
      }
    })()

    inFlightSave = run
    return run
  }

  function scheduleAutosave() {
    saveRevision += 1
    saveStatus.value = 'pending'
    saveError.value = null
    cancelPendingSave()
    saveTimer = setTimeout(() => {
      saveTimer = null
      void flushSave()
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  function setStorage(adapter: ProjectStorageAdapter) {
    storage = adapter
  }

  function loadProjectIntoState(next: Project, fromStorage: boolean) {
    project.value = next
    loadedId.value = next.id
    ductSpec.value = defaultDuctSpec(next.unit)
    selectedIds.value = new Set()
    clearHistory(history)
    syncHistoryMeta()
    viewBox.value = boundsViewBoxOf(next)
    saveError.value = null
    if (fromStorage) {
      saveStatus.value = 'saved'
      savedAt.value = next.updated
    }
    else {
      saveStatus.value = 'idle'
      savedAt.value = null
    }
  }

  async function openProject(
    id: string,
    fallback?: () => Project,
    options?: { allowCreate?: boolean },
  ): Promise<Project | null> {
    if (saveTimer !== null && loadedId.value && loadedId.value !== id) {
      await flushSave()
    }
    else {
      cancelPendingSave()
    }

    const seq = ++openSeq
    loading.value = true
    notFound.value = false
    const allowCreate = options?.allowCreate ?? true
    try {
      const stored = await storage.load(id)
      if (seq !== openSeq) return project.value
      if (stored) {
        loadProjectIntoState(stored, true)
        return stored
      }
      if (!allowCreate && !fallback && id !== 'contoh' && id !== 'baru') {
        notFound.value = true
        return null
      }
      const created = fallback ? { ...fallback(), id } : defaultProjectForId(id)
      loadProjectIntoState(created, false)
      return created
    }
    catch (err) {
      if (seq !== openSeq) return project.value
      if (!allowCreate && !fallback && id !== 'contoh' && id !== 'baru') {
        notFound.value = true
        return null
      }
      const created = fallback ? { ...fallback(), id } : defaultProjectForId(id)
      loadProjectIntoState(created, false)
      saveStatus.value = 'error'
      saveError.value = err instanceof Error ? err.message : 'Gagal membuka penyimpanan browser.'
      return created
    }
    finally {
      if (seq === openSeq) loading.value = false
    }
  }

  function commit(label: string, mutate: (draft: Project) => void): boolean {
    const result = commitProject(history, project.value, label, (draft) => {
      mutate(draft)
      syncHosts(draft)
    })
    if (!result.changed) return false
    project.value = result.project
    pruneSelection(result.project)
    syncHistoryMeta()
    scheduleAutosave()
    return true
  }

  function undo(): boolean {
    const moved = undoProject(history, project.value)
    if (!moved) return false
    project.value = moved.project
    pruneSelection(moved.project)
    syncHistoryMeta()
    scheduleAutosave()
    return true
  }

  function redo(): boolean {
    const moved = redoProject(history, project.value)
    if (!moved) return false
    project.value = moved.project
    pruneSelection(moved.project)
    syncHistoryMeta()
    scheduleAutosave()
    return true
  }

  function setSelection(ids: Iterable<string>) {
    const validIds = new Set(project.value.nodes.map(n => n.id))
    const next = new Set<string>()
    for (const id of ids) {
      if (validIds.has(id)) next.add(id)
    }
    selectedIds.value = next
  }

  function clearSelection() {
    if (selectedIds.value.size > 0) {
      selectedIds.value = new Set()
    }
  }

  function selectAll() {
    selectedIds.value = selectAllIds(project.value)
  }

  function deleteSelected(): { deletedCount: number, lockedSkipped: number } {
    const deletable = deletableSelectedIds(project.value, selectedIds.value)
    const lockedSkipped = Math.max(0, selectedIds.value.size - deletable.length)
    if (deletable.length === 0) {
      return { deletedCount: 0, lockedSkipped }
    }
    const delSet = new Set(deletable)
    commit('Hapus komponen', (draft) => {
      draft.nodes = draft.nodes.filter(n => !delSet.has(n.id))
    })
    selectedIds.value = new Set()
    return { deletedCount: deletable.length, lockedSkipped }
  }

  function moveSelected(
    dx: number,
    dy: number,
    label = 'Geser komponen',
    hostedOptions?: HostedMoveOptions,
  ): boolean {
    if (selectedIds.value.size === 0) return false
    if (dx === 0 && dy === 0 && (!hostedOptions || (hostedOptions.rawDx === 0 && hostedOptions.rawDy === 0))) {
      return false
    }
    const ids = new Set(selectedIds.value)
    return commit(label, (draft) => {
      translateSelectedInPlace(draft, ids, dx, dy, hostedOptions)
    })
  }

  function rotateSelected(deg = 90, gridStep = 100): boolean {
    if (selectedIds.value.size === 0) return false
    const ids = new Set(selectedIds.value)
    return commit('Putar komponen', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      rotateSelectedInPlace(draft, ids, deg, gridStep, ctx)
    })
  }

  function mirrorSelected(): boolean {
    if (selectedIds.value.size === 0) return false
    const ids = new Set(selectedIds.value)
    return commit('Cerminkan komponen', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      mirrorSelectedInPlace(draft, ids, ctx)
    })
  }

  function copySelected(): number {
    if (selectedIds.value.size === 0) return 0
    const selected = project.value.nodes.filter(n => selectedIds.value.has(n.id))
    if (selected.length === 0) return 0
    clipboard.value = JSON.parse(JSON.stringify(selected)) as Node[]
    return clipboard.value.length
  }

  function pasteClipboard(targetCenter: Point | null = null, gridStep = 100): number {
    if (clipboard.value.length === 0) return 0
    const ctx = ctxOf(project.value, connect(project.value))
    const copies = cloneNodesForPaste(clipboard.value, targetCenter, gridStep, ctx)
    if (copies.length === 0) return 0
    const committed = commit('Tempel komponen', (draft) => {
      draft.nodes.push(...copies)
    })
    if (committed) {
      selectedIds.value = new Set(copies.map(n => n.id))
    }
    return committed ? copies.length : 0
  }

  function duplicateSelected(gridStep = 100): number {
    const copied = copySelected()
    if (copied === 0) return 0
    return pasteClipboard(null, gridStep)
  }

  function applyNodeGrip(nodeId: string, gripId: string, worldPos: Point, baseNode?: Node): boolean {
    return commit('Ubah ukuran komponen', (draft) => {
      const idx = draft.nodes.findIndex(n => n.id === nodeId)
      if (idx < 0) return
      const target = draft.nodes[idx]!
      draft.nodes[idx] = applyGrip(target, gripId, worldPos, draft.unit, baseNode)
    })
  }

  function doubleClickNodeGrip(nodeId: string, gripId: string): boolean {
    return commit('Ubah sudut ruangan', (draft) => {
      const idx = draft.nodes.findIndex(n => n.id === nodeId)
      if (idx < 0) return
      const updated = applyGripDblClick(draft.nodes[idx]!, gripId)
      if (updated) draft.nodes[idx] = updated
    })
  }

  function groupSelected(): boolean {
    if (selectedIds.value.size < 2) return false
    const ids = new Set(selectedIds.value)
    return commit('Group komponen', (draft) => {
      groupSelectedInPlace(draft, ids)
    })
  }

  function ungroupSelected(): boolean {
    if (selectedIds.value.size === 0) return false
    const ids = new Set(selectedIds.value)
    return commit('Ungroup komponen', (draft) => {
      ungroupSelectedInPlace(draft, ids)
    })
  }

  function alignSelected(direction: AlignDirection): boolean {
    if (selectedIds.value.size < 2) return false
    const ids = new Set(selectedIds.value)
    return commit('Ratakan komponen', (draft) => {
      const ctx = ctxOf(draft, connect(draft))
      alignSelectedInPlace(draft, ids, direction, ctx)
    })
  }

  function setSelectedLocked(locked: boolean): boolean {
    if (selectedIds.value.size === 0) return false
    const ids = new Set(selectedIds.value)
    return commit(locked ? 'Kunci komponen' : 'Buka kunci komponen', (draft) => {
      lockSelectedInPlace(draft, ids, locked)
    })
  }

  function reorderSelected(direction: 'front' | 'back'): boolean {
    if (selectedIds.value.size === 0) return false
    const ids = new Set(selectedIds.value)
    return commit(direction === 'front' ? 'Pindah ke depan' : 'Pindah ke belakang', (draft) => {
      reorderSelectedInPlace(draft, ids, direction)
    })
  }

  function setTool(next: EditorTool) {
    tool.value = next
  }

  function setDuctSpec(patch: Partial<DuctSpec>) {
    ductSpec.value = { ...ductSpec.value, ...patch }
  }

  function commitDuctPath(pts: readonly Point[], spec?: DuctSpec): DuctPathNode[] {
    const nodes = pathNodes(pts, spec ?? ductSpec.value, project.value.unit)
    if (nodes.length === 0) return []
    const committed = commit('Gambar jalur duct', (draft) => {
      draft.nodes.push(...nodes)
    })
    return committed ? nodes : []
  }

  function placeNode(node: Node, label?: string): Node | null {
    const placed = JSON.parse(JSON.stringify(node)) as Node
    placed.id = createId()
    if (placed.type === 'room') {
      const taken = new Set(project.value.nodes.filter(n => n.type === 'room').map(n => n.name))
      if (!placed.name || taken.has(placed.name)) {
        placed.name = nextRoomName(project.value)
      }
    }
    const actionLabel = label ?? `Tambah ${componentOf(placed.type).name}`
    const committed = commit(actionLabel, (draft) => {
      draft.nodes.push(placed)
    })
    return committed ? placed : null
  }

  function setRoomShape(roomId: string, shape: RoomShapeKey): boolean {
    return commit('Ubah bentuk ruangan', (draft) => {
      const target = draft.nodes.find(n => n.id === roomId)
      if (!target || target.type !== 'room' || target.lock) return
      applyRoomShape(target, shape)
    })
  }

  function renameRoom(roomId: string, name: string): boolean {
    return updateTextContent(roomId, name)
  }

  function updateTextContent(nodeId: string, text: string): boolean {
    const cleaned = text.trim()
    if (!cleaned) return false
    return commit('Ubah teks', (draft) => {
      const target = draft.nodes.find(n => n.id === nodeId)
      if (!target || target.lock) return
      if (target.type === 'room') target.name = cleaned
      else if (target.type === 'text' || target.type === 'note') target.s = cleaned
    })
  }

  function updateTextStyle(
    nodeId: string,
    patch: Partial<Pick<TextNode, 'tz' | 'col' | 'al' | 'b' | 'it' | 'ul' | 'bx'>>,
  ): boolean {
    return commit('Ubah gaya teks', (draft) => {
      const target = draft.nodes.find(n => n.id === nodeId)
      if (!target || target.lock) return
      if (target.type !== 'text' && target.type !== 'note') return
      if (patch.tz !== undefined) target.tz = patch.tz
      if (patch.col !== undefined) target.col = patch.col
      if (patch.b !== undefined) target.b = patch.b
      if (patch.it !== undefined) target.it = patch.it
      if (patch.ul !== undefined) target.ul = patch.ul
      if (patch.bx !== undefined) target.bx = patch.bx
      if (target.type === 'text' && patch.al !== undefined) target.al = patch.al
    })
  }

  function toggleDoorHinge(nodeId: string): boolean {
    return commit('Balik engsel pintu', (draft) => {
      const target = draft.nodes.find(n => n.id === nodeId)
      if (!target || target.type !== 'door' || target.lock) return
      target.hinge = target.hinge === 'r' ? 'l' : 'r'
    })
  }

  function toggleDoorSwing(nodeId: string): boolean {
    return commit('Balik arah buka pintu', (draft) => {
      const target = draft.nodes.find(n => n.id === nodeId)
      if (!target || target.type !== 'door' || target.lock) return
      target.swing = target.swing === 'out' ? 'in' : 'out'
    })
  }

  function detachHostedOpening(nodeId: string): boolean {
    return commit('Lepas dari dinding', (draft) => {
      const target = draft.nodes.find(n => n.id === nodeId)
      if (!target || !isHostedOpening(target) || target.lock || !target.host) return
      delete target.host
    })
  }

  function updateSelectedProperty(key: NodePropKey, rawValue: unknown): PropertyUpdateResult {
    if (selectedIds.value.size === 0) return { changed: false }
    const ids = new Set(selectedIds.value)
    let result: PropertyUpdateResult = { changed: false }
    commit('Ubah properti', (draft) => {
      result = applyPropertyToNodes(draft, ids, key, rawValue)
    })
    return result
  }

  function flipSelectedFlow(): boolean {
    if (selectedIds.value.size === 0) return false
    const ids = new Set(selectedIds.value)
    return commit('Balik arah aliran', (draft) => {
      for (const node of draft.nodes) {
        if (!ids.has(node.id) || isNodeLocked(draft, node) || node.type !== 'straight') continue
        node.flip = !node.flip
      }
    })
  }

  function resetElbowReducing(nodeId: string): boolean {
    return commit('Samakan ukuran elbow', (draft) => {
      const target = draft.nodes.find(n => n.id === nodeId)
      if (!target || target.type !== 'elbow' || isNodeLocked(draft, target)) return
      target.w2 = null
      target.h2 = null
    })
  }

  function setLayerVisible(key: LayerKey, on: boolean): boolean {
    const current = project.value.layers[key]
    if (!current || current.on === on) return false
    const nextProject: Project = {
      ...project.value,
      layers: {
        ...project.value.layers,
        [key]: { ...current, on },
      },
    }
    project.value = nextProject
    if (!on && selectedIds.value.size > 0) {
      selectedIds.value = new Set(
        nextProject.nodes
          .filter(n => selectedIds.value.has(n.id) && isNodeVisible(nextProject, n))
          .map(n => n.id),
      )
    }
    scheduleAutosave()
    return true
  }

  function setLayerLocked(key: LayerKey, lock: boolean): boolean {
    const current = project.value.layers[key]
    if (!current || current.lock === lock) return false
    const nextProject: Project = {
      ...project.value,
      layers: {
        ...project.value.layers,
        [key]: { ...current, lock },
      },
    }
    project.value = nextProject
    if (lock && selectedIds.value.size > 0) {
      selectedIds.value = new Set(
        nextProject.nodes
          .filter(n => selectedIds.value.has(n.id) && !isLayerLocked(nextProject, n))
          .map(n => n.id),
      )
    }
    scheduleAutosave()
    return true
  }

  function setViewport(patch: Partial<EditorViewportState>) {
    if (patch.viewBox !== undefined) viewBox.value = patch.viewBox
    if (patch.showGrid !== undefined) showGrid.value = patch.showGrid
    if (patch.pxPerMm !== undefined) pxPerMm.value = patch.pxPerMm
  }

  function toggleSnap() {
    snapEnabled.value = !snapEnabled.value
  }

  function toggleOrtho() {
    orthoEnabled.value = !orthoEnabled.value
  }

  return {
    project,
    selectedIds,
    clipboard,
    tool,
    ductSpec,
    viewBox,
    showGrid,
    snapEnabled,
    orthoEnabled,
    pxPerMm,
    viewport,
    loadedId,
    loading,
    notFound,
    saveStatus,
    savedAt,
    saveError,
    saveStatusLabel,
    undoCount,
    redoCount,
    undoLabel,
    redoLabel,
    canUndo,
    canRedo,
    setStorage,
    openProject,
    commit,
    undo,
    redo,
    flushSave,
    cancelPendingSave,
    setSelection,
    clearSelection,
    selectAll,
    deleteSelected,
    moveSelected,
    rotateSelected,
    mirrorSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    applyNodeGrip,
    doubleClickNodeGrip,
    groupSelected,
    ungroupSelected,
    alignSelected,
    setSelectedLocked,
    reorderSelected,
    setTool,
    setDuctSpec,
    commitDuctPath,
    placeNode,
    setRoomShape,
    renameRoom,
    updateTextContent,
    updateTextStyle,
    toggleDoorHinge,
    toggleDoorSwing,
    detachHostedOpening,
    updateSelectedProperty,
    flipSelectedFlow,
    resetElbowReducing,
    setLayerVisible,
    setLayerLocked,
    setViewport,
    toggleSnap,
    toggleOrtho,
  }
})
