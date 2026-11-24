<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import { storeToRefs } from 'pinia'
import {
  LAYERS,
  SIZE_GRIP_IDS,
  TOOL_HINTS,
  applyDuctSpecProperty,
  applyGrip,
  applyHostedSnap,
  clickSelect,
  clientToWorld,
  componentOf,
  computeMoveDelta,
  connect,
  createLibraryNode,
  createNode,
  ctxOf,
  cursorMeasure,
  dimFromPoints,
  dist,
  ductPointByLength,
  ductTargetPoint,
  hostToleranceMm,
  isClosingPolyPoint,
  isHostedOpening,
  isLayerLocked,
  isLibraryItemId,
  isNodeLocked,
  isNodeVisible,
  isSelectionGrouped,
  layerOf,
  libraryItemInfo,
  matchShortcut,
  movableSelectedIds,
  nextRoomName,
  nodeDisplayName,
  nodePortSummaries,
  nodesBounds,
  norm,
  orthoPoint,
  parseCommand,
  partitionFromPoints,
  pathNodes,
  pixelsPerMm,
  polyTargetPoint,
  previewMovedNodes,
  projectBounds,
  rectMeasure,
  roomFromCorners,
  roomFromDimensions,
  roomFromPolygon,
  selectByBox,
  sizeLabel,
  sketchFromWorldPoints,
  snapAt,
  stepFreeDuctCorner,
  stepTabSelection,
  textFromPreset,
  validate,
  visibleRooms,
  type AlignDirection,
  type EditorTool,
  type LibraryItemId,
  type Node,
  type NodePropKey,
  type Point,
  type RoomShapeKey,
  type ShortcutDef,
  type TextPresetKind,
  type ValidationWarning,
  type WorldPort,
} from '../../../shared/cad'
import type { SelectionTextStyle } from '../../components/cad/SelectionToolbar.vue'
import { useEditor } from '../../stores/editor'

definePageMeta({
  layout: 'editor',
})

const LAYER_LABELS = Object.fromEntries(LAYERS.map(l => [l.key, l.name]))
const ONBOARDING_STORAGE_KEY = 'temandor.nohint'

const route = useRoute()
const projectId = computed(() => String(route.params.id ?? 'baru'))

const toast = useToast()
const editor = useEditor()
const {
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
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  saveStatus,
  saveStatusLabel,
  saveError,
} = storeToRefs(editor)

const { theme, isLight, toggle: toggleCanvasTheme } = useCanvasTheme()
const panels = useWorkspacePanels()

const canvasRef = ref<{ svgEl: SVGSVGElement | null } | null>(null)
const cmdBarRef = ref<{ focus: () => void, blur: () => void, startTyping: (char: string) => void } | null>(null)
const singleTouchCancelledCount = ref(0)
const shiftDown = ref(false)
const projectNameDraft = ref(project.value.name)
const srAnnouncement = ref('')
const menuWorldPoint = ref<Point | null>(null)
const stageSize = ref<{ width: number, height: number }>({ width: 0, height: 0 })
const exportModalOpen = ref(false)
const boqModalOpen = ref(false)
const aiOpen = ref(false)
const shortcutsOpen = ref(false)
const onboardingDismissed = ref(true)
const warnDrawerOpen = ref(false)
const hoveredWarn = ref<{ index: number, left: number, top: number } | null>(null)
let lastWarnCount: number | null = null

interface BoxDragState {
  pointerId: number
  start: Point
  end: Point
  shift: boolean
}

interface MoveDragState {
  pointerId: number
  start: Point
  dx: number
  dy: number
  rawDx: number
  rawDy: number
  moved: boolean
  movingIds: Set<string>
  openPorts: WorldPort[]
}

interface GripDragState {
  pointerId: number
  nodeId: string
  gripId: string
  isSize: boolean
  baseNode: Node
  previewNode: Node
  targetWorld: Point
  moved: boolean
}

interface DuctDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  moved: boolean
  free: boolean
  axis: 'x' | 'y' | null
}

interface RoomDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  moved: boolean
}

interface InlineEditState {
  nodeId: string
  label: string
  initialValue: string
  value: string
  left: number
  top: number
}

interface PenDragState {
  pointerId: number
  pts: Point[]
}

const boxDrag = ref<BoxDragState | null>(null)
const moveDrag = ref<MoveDragState | null>(null)
const gripDrag = ref<GripDragState | null>(null)
const ductPoints = ref<Point[]>([])
const ductDrag = ref<DuctDragState | null>(null)
const roomOrigin = ref<Point | null>(null)
const roomDrag = ref<RoomDragState | null>(null)
const polyPoints = ref<Point[]>([])
const polyDrag = ref<DuctDragState | null>(null)
const wallStart = ref<Point | null>(null)
const wallDrag = ref<RoomDragState | null>(null)
const dimPoints = ref<Point[]>([])
const dimDrag = ref<RoomDragState | null>(null)
const penDrag = ref<PenDragState | null>(null)
const placeItemId = ref<LibraryItemId | null>(null)
const placeGhostNode = ref<Node | null>(null)
const placeGhostVisible = ref(false)
const inlineEdit = ref<InlineEditState | null>(null)
const inlineInputRef = ref<HTMLInputElement | null>(null)
let libDragDropped = false
let lastGripClick: { nodeId: string, gripId: string, time: number } | null = null

const effectiveOrtho = computed(() => orthoEnabled.value !== shiftDown.value)
const connectionGraph = computed(() => connect(project.value))
const renderCtx = computed(() => ctxOf(project.value, connectionGraph.value))
const warnings = computed(() => validate(project.value, connectionGraph.value))

const activeHoveredWarning = computed(() => {
  if (!hoveredWarn.value) return null
  const warning = warnings.value[hoveredWarn.value.index]
  if (!warning) return null
  return {
    warning,
    left: hoveredWarn.value.left,
    top: hoveredWarn.value.top,
  }
})

watch(() => warnings.value.length, (next) => {
  if (lastWarnCount !== null && lastWarnCount !== next) {
    announce(next > 0 ? `${next} warning` : 'Tidak ada warning')
  }
  lastWarnCount = next
})

const isProjectEmpty = computed(() => !project.value.nodes.some(n => n.type !== 'room'))
const showOnboardingHint = computed(() => !onboardingDismissed.value && isProjectEmpty.value)
const commandHint = computed(() => {
  if (tool.value === 'place' && placeGhostNode.value) {
    const label = placeItemId.value ? libraryItemInfo(placeItemId.value).name : 'Catatan + panah'
    return `${label} · klik kanvas untuk taruh · R putar · M cermin · Esc batal`
  }
  if (tool.value === 'duct') {
    if (ductPoints.value.length === 0) {
      return `Duct ${sizeLabel(ductSpec.value.w, ductSpec.value.h, ductSpec.value.shape, project.value.unit)} · klik titik awal`
    }
    if (ductPoints.value.length === 1) {
      return 'Duct · titik berikut atau ketik panjang (mm) + Enter · Backspace hapus titik'
    }
    return 'Duct · titik berikut / panjang (mm) · Enter atau klik kanan selesai · Backspace hapus titik'
  }
  if (tool.value === 'room') {
    return roomOrigin.value
      ? 'Ruangan · klik sudut 2 atau ketik P x L (mis. 6x4 atau 6000,4000) + Enter'
      : 'Ruangan · klik sudut 1 (atau seret 2 sudut)'
  }
  if (tool.value === 'poly') {
    if (polyPoints.value.length === 0) return 'Ruangan bebas · klik titik sudut pertama'
    if (polyPoints.value.length < 3) return 'Ruangan bebas · klik titik berikut atau ketik panjang (mm) + Enter'
    return 'Ruangan bebas · klik titik awal / Enter / klik kanan untuk tutup · Backspace hapus titik'
  }
  if (tool.value === 'wall') {
    return wallStart.value
      ? 'Partisi · klik titik akhir atau ketik panjang (mm) + Enter · Esc selesai'
      : 'Partisi · klik titik awal (berantai seperti garis)'
  }
  if (tool.value === 'dim') {
    if (dimPoints.value.length === 0) return 'Ukur · klik titik 1'
    if (dimPoints.value.length === 1) return 'Ukur · klik titik 2'
    return 'Ukur · klik posisi garis ukur'
  }
  return TOOL_HINTS[tool.value] ?? ''
})

const selectedNodes = computed(() => {
  if (selectedIds.value.size === 0) return []
  return project.value.nodes.filter(n => selectedIds.value.has(n.id))
})

const hasSelection = computed(() => selectedNodes.value.length > 0)
const showDuctSpecPanel = computed(() => (
  selectedNodes.value.length === 0
  && (tool.value === 'duct' || (tool.value === 'place' && Boolean(placeGhostNode.value && componentOf(placeGhostNode.value.type).duct)))
))
const hasPropsContent = computed(() => hasSelection.value || showDuctSpecPanel.value)
const sidePanelVisible = computed(() => !aiOpen.value && panels.isSideVisible(hasPropsContent.value))
const reopenSideVisible = computed(() => !aiOpen.value && panels.showReopenSideTab(hasPropsContent.value))

const allSelectedLocked = computed(() => (
  selectedNodes.value.length > 0 && selectedNodes.value.every(n => Boolean(n.lock))
))

const selectionGrouped = computed(() => isSelectionGrouped(project.value, selectedIds.value))

const canAlignSelection = computed(() => {
  const units = new Set<string>()
  for (const n of selectedNodes.value) {
    if (isNodeLocked(project.value, n)) continue
    units.add(n.g || n.id)
  }
  return units.size >= 2
})

watch(() => project.value.name, (next) => {
  projectNameDraft.value = next
})

watch(isProjectEmpty, (empty) => {
  if (!empty && !onboardingDismissed.value) {
    dismissOnboarding()
  }
})

function dismissOnboarding() {
  onboardingDismissed.value = true
  if (!import.meta.client) return
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  }
  catch {
    // Abaikan jika penyimpanan dibatasi browser.
  }
}

function announce(message: string) {
  srAnnouncement.value = ''
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      srAnnouncement.value = message
    })
  }
  else {
    srAnnouncement.value = message
  }
}

function commitProjectName() {
  const cleaned = projectNameDraft.value.trim() || 'Proyek baru'
  projectNameDraft.value = cleaned
  editor.commit('Ubah nama proyek', (draft) => {
    draft.name = cleaned
  })
}

function onNameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitProjectName()
    ;(e.target as HTMLInputElement | null)?.blur()
  }
  else if (e.key === 'Escape') {
    projectNameDraft.value = project.value.name
    ;(e.target as HTMLInputElement | null)?.blur()
  }
}

function handleExportScaleChange(nextScale: string) {
  editor.commit('Ubah skala', (draft) => {
    draft.scale = nextScale
  })
}

function handleAiFocusNodes(ids: string[]) {
  if (ids.length === 0) return
  editor.setSelection(ids)
  void nextTick(() => {
    viewport.zoomToSelection()
  })
}

watch(tool, (next) => {
  if (next !== 'duct') {
    ductPoints.value = []
    ductDrag.value = null
  }
  if (next !== 'room') {
    roomOrigin.value = null
    roomDrag.value = null
  }
  if (next !== 'poly') {
    polyPoints.value = []
    polyDrag.value = null
  }
  if (next !== 'wall') {
    wallStart.value = null
    wallDrag.value = null
  }
  if (next !== 'dim') {
    dimPoints.value = []
    dimDrag.value = null
  }
  if (next !== 'pen') {
    penDrag.value = null
  }
  if (next !== 'place') {
    placeItemId.value = null
    placeGhostNode.value = null
    placeGhostVisible.value = false
  }
  if (next !== 'select') {
    inlineEdit.value = null
  }
})

function cancelActiveInteractions() {
  boxDrag.value = null
  moveDrag.value = null
  gripDrag.value = null
  ductPoints.value = []
  ductDrag.value = null
  roomOrigin.value = null
  roomDrag.value = null
  polyPoints.value = []
  polyDrag.value = null
  wallStart.value = null
  wallDrag.value = null
  dimPoints.value = []
  dimDrag.value = null
  penDrag.value = null
  placeItemId.value = null
  placeGhostNode.value = null
  placeGhostVisible.value = false
  inlineEdit.value = null
}

const viewport = useViewport({
  viewBoxRef: viewBox,
  showGridRef: showGrid,
  pxPerMmRef: pxPerMm,
  toolRef: tool,
  handleShortcuts: false,
  getFitBounds() {
    return projectBounds(project.value, renderCtx.value)
  },
  getSelectionBounds() {
    if (selectedNodes.value.length === 0) return null
    return nodesBounds(selectedNodes.value, renderCtx.value)
  },
  onCancelSingleTouch() {
    cancelActiveInteractions()
    singleTouchCancelledCount.value += 1
  },
})

const activeSnap = computed(() => {
  const skipIds = gripDrag.value
    ? new Set([gripDrag.value.nodeId])
    : moveDrag.value?.movingIds
  const closePoint = tool.value === 'poly' && polyPoints.value.length >= 3
    ? polyPoints.value[0]!
    : null
  return snapAt(
    project.value,
    viewport.cursorWorld.value,
    {
      enabled: snapEnabled.value && !(gripDrag.value?.isSize),
      gridStep: viewport.gridStep.value,
      pxPerMm: pxPerMm.value,
      tolerancePx: 14,
      skipIds,
      closePoint,
    },
    connectionGraph.value,
  )
})

const ductPreviewTarget = computed<Point | null>(() => {
  if (tool.value !== 'duct' || ductPoints.value.length === 0) return null
  return ductTargetPoint(ductPoints.value, activeSnap.value, orthoEnabled.value, shiftDown.value)
})

const polyPreviewTarget = computed<Point | null>(() => {
  if (tool.value !== 'poly' || polyPoints.value.length === 0) return null
  return polyTargetPoint(polyPoints.value, activeSnap.value, orthoEnabled.value, shiftDown.value)
})

const wallPreviewTarget = computed<Point | null>(() => {
  if (tool.value !== 'wall' || !wallStart.value) return null
  return orthoPoint(wallStart.value, activeSnap.value.p, orthoEnabled.value, shiftDown.value)
})

const activeDrawPoints = computed<readonly Point[]>(() => {
  if (tool.value === 'duct') return ductPoints.value
  if (tool.value === 'poly') return polyPoints.value
  if (tool.value === 'room' && roomOrigin.value) return [roomOrigin.value]
  if (tool.value === 'wall' && wallStart.value) return [wallStart.value]
  if (tool.value === 'dim') return dimPoints.value
  return []
})

const activeDrawGuideLine = computed<readonly [Point, Point] | null>(() => {
  if (
    tool.value === 'poly'
    && polyPoints.value.length === 1
    && viewport.cursorInside.value
    && polyPreviewTarget.value
  ) {
    return [polyPoints.value[0]!, polyPreviewTarget.value]
  }
  return null
})

const ghostNodes = computed<Node[]>(() => {
  if (tool.value === 'place' && placeGhostNode.value && placeGhostVisible.value) {
    return [placeGhostNode.value]
  }
  if (tool.value === 'duct' && ductPoints.value.length > 0) {
    if (viewport.cursorInside.value && ductPreviewTarget.value) {
      return pathNodes([...ductPoints.value, ductPreviewTarget.value], ductSpec.value, project.value.unit)
    }
    if (ductPoints.value.length >= 2) {
      return pathNodes(ductPoints.value, ductSpec.value, project.value.unit)
    }
  }
  if (tool.value === 'room' && roomOrigin.value && viewport.cursorInside.value) {
    const previewRoom = roomFromCorners(roomOrigin.value, activeSnap.value.p, nextRoomName(project.value))
    if (previewRoom) return [previewRoom]
  }
  if (tool.value === 'poly' && polyPoints.value.length > 0) {
    const pts = viewport.cursorInside.value && polyPreviewTarget.value
      ? [...polyPoints.value, polyPreviewTarget.value]
      : polyPoints.value
    if (pts.length >= 3) {
      const previewPoly = roomFromPolygon(pts, nextRoomName(project.value))
      if (previewPoly) return [previewPoly]
    }
  }
  if (tool.value === 'wall' && wallStart.value && viewport.cursorInside.value && wallPreviewTarget.value) {
    const previewWall = partitionFromPoints(wallStart.value, wallPreviewTarget.value)
    if (previewWall) return [previewWall]
  }
  if (tool.value === 'dim' && dimPoints.value.length > 0 && viewport.cursorInside.value) {
    if (dimPoints.value.length === 1) {
      const p2 = orthoPoint(dimPoints.value[0]!, activeSnap.value.p, orthoEnabled.value, shiftDown.value)
      const previewDim = dimFromPoints(dimPoints.value[0]!, p2, null, renderCtx.value.th)
      if (previewDim) return [previewDim]
    }
    else if (dimPoints.value.length === 2) {
      const previewDim = dimFromPoints(dimPoints.value[0]!, dimPoints.value[1]!, activeSnap.value.p, renderCtx.value.th)
      if (previewDim) return [previewDim]
    }
  }
  if (gripDrag.value?.moved) {
    return [gripDrag.value.previewNode]
  }
  if (moveDrag.value?.moved) {
    return previewMovedNodes(
      project.value,
      moveDrag.value.movingIds,
      moveDrag.value.dx,
      moveDrag.value.dy,
      {
        rawDx: moveDrag.value.rawDx,
        rawDy: moveDrag.value.rawDy,
        toleranceMm: hostToleranceMm(pxPerMm.value),
      },
    )
  }
  return []
})

const cursorMeasureLabel = computed<string | null>(() => {
  if (tool.value === 'duct' && ductPoints.value.length > 0 && ductPreviewTarget.value) {
    const last = ductPoints.value[ductPoints.value.length - 1]!
    return cursorMeasure(last, ductPreviewTarget.value).label
  }
  if (tool.value === 'room' && roomOrigin.value) {
    return rectMeasure(roomOrigin.value, activeSnap.value.p).label
  }
  if (tool.value === 'poly' && polyPoints.value.length > 0 && polyPreviewTarget.value) {
    const last = polyPoints.value[polyPoints.value.length - 1]!
    return `${Math.round(dist(last, polyPreviewTarget.value))} mm`
  }
  if (tool.value === 'wall' && wallStart.value && wallPreviewTarget.value) {
    return `${Math.round(dist(wallStart.value, wallPreviewTarget.value))} mm`
  }
  if (tool.value === 'dim' && dimPoints.value.length === 1) {
    const p2 = orthoPoint(dimPoints.value[0]!, activeSnap.value.p, orthoEnabled.value, shiftDown.value)
    return `${Math.round(dist(dimPoints.value[0]!, p2))} mm`
  }
  if (moveDrag.value?.moved) {
    const { dx, dy } = moveDrag.value
    if (dx !== 0 || dy !== 0) {
      return cursorMeasure([0, 0], [dx, dy]).label
    }
  }
  if (gripDrag.value?.moved) {
    const p = gripDrag.value.previewNode
    if (gripDrag.value.isSize && 'w' in p && 'h' in p && 'shape' in p) {
      const w = gripDrag.value.gripId === 'w2' && 'w2' in p && typeof p.w2 === 'number' ? p.w2 : p.w
      const h = gripDrag.value.gripId === 'w2' && 'h2' in p && typeof p.h2 === 'number' ? p.h2 : p.h
      return sizeLabel(w, h, p.shape, project.value.unit)
    }
    if ('L' in p && typeof p.L === 'number') {
      return `${Math.round(p.L)} mm`
    }
  }
  return null
})

const isInteracting = computed(() => (
  Boolean(boxDrag.value || moveDrag.value?.moved || gripDrag.value?.moved || viewport.isPanning.value || inlineEdit.value)
))

const singleSelectedNode = computed<Node | null>(() => (
  selectedNodes.value.length === 1 ? selectedNodes.value[0]! : null
))

const singleSelectedWarnings = computed<ValidationWarning[]>(() => {
  const n = singleSelectedNode.value
  if (!n) return []
  return warnings.value.filter(w => w.id === n.id)
})

const singleSelectedPenetrationCount = computed(() => {
  const n = singleSelectedNode.value
  if (!n) return 0
  return renderCtx.value.pen[n.id]?.length ?? 0
})

const singleSelectedPortSummaries = computed(() => {
  const n = singleSelectedNode.value
  if (!n) return []
  return nodePortSummaries(n, project.value, connectionGraph.value)
})

const singleSelectedHosted = computed(() => Boolean(
  singleSelectedNode.value
  && isHostedOpening(singleSelectedNode.value)
  && singleSelectedNode.value.host,
))

const singleSelectedTextStyle = computed<SelectionTextStyle | null>(() => {
  const n = singleSelectedNode.value
  if (!n || (n.type !== 'text' && n.type !== 'note')) return null
  return {
    tz: n.tz,
    col: n.col,
    al: n.type === 'text' ? n.al : undefined,
    b: n.b,
    it: n.it,
    ul: n.ul,
    bx: n.bx,
  }
})

const selectionToolbarPos = computed<{ left: number, top: number } | null>(() => {
  if (selectedNodes.value.length === 0 || tool.value !== 'select' || isInteracting.value) return null
  const { width, height } = stageSize.value
  if (!(width > 0) || !(height > 0)) return null
  const b = nodesBounds(selectedNodes.value, renderCtx.value)
  if (!b) return null

  const vb = viewBox.value
  const scale = pixelsPerMm(vb, width, height)
  const ox = (width - vb[2] * scale) / 2
  const oy = (height - vb[3] * scale) / 2
  const toStageX = (wx: number) => ox + (wx - vb[0]) * scale
  const toStageY = (wy: number) => oy + (wy - vb[1]) * scale

  const approxWidth = allSelectedLocked.value ? 124 : (selectedNodes.value.length > 1 ? 330 : 210)
  const barHeight = 40
  const centerX = (toStageX(b[0]) + toStageX(b[2])) / 2
  const maxRight = panels.isDesktop.value && sidePanelVisible.value ? width - 288 : width - 8
  const left = Math.max(8, Math.min(centerX - approxWidth / 2, Math.max(8, maxRight - approxWidth)))
  let top = toStageY(b[1]) - barHeight - 14
  if (top < 8) {
    top = Math.min(toStageY(b[3]) + 14, height - barHeight - 60)
  }
  return { left: Math.round(left), top: Math.max(8, Math.round(top)) }
})

function handleGroup() {
  if (!editor.groupSelected()) {
    toast.add({ title: 'Pilih minimal 2 komponen yang tidak terkunci untuk di-group' })
  }
}

function handleCopy() {
  const copied = editor.copySelected()
  if (copied > 0) {
    toast.add({ title: `${copied} komponen disalin` })
  }
}

function handleAlign(direction: AlignDirection) {
  editor.alignSelected(direction)
}

function handleRoomShape(shape: RoomShapeKey) {
  const single = singleSelectedNode.value
  if (!single || single.type !== 'room') return
  editor.setRoomShape(single.id, shape)
}

function handleAddToRoom(itemId: LibraryItemId) {
  if (itemId === 'partition') {
    selectWorkspaceTool('wall')
    return
  }
  startPlaceItem(itemId, true)
}

function handleUpdateProp(key: NodePropKey, value: unknown) {
  const res = editor.updateSelectedProperty(key, value)
  if (res.error) {
    toast.add({ title: res.error })
    return
  }
  if (res.warning) {
    toast.add({ title: res.warning })
  }
}

function handleUpdateDuctSpec(key: 'sys' | 'shape' | 'w' | 'h' | 'elev', value: unknown) {
  const res = applyDuctSpecProperty(ductSpec.value, key, value)
  if (res.error) {
    toast.add({ title: res.error })
    return
  }
  editor.setDuctSpec(res.next)
  if (placeGhostNode.value && componentOf(placeGhostNode.value.type).duct) {
    const updated = { ...placeGhostNode.value } as Record<string, unknown>
    if (key in updated) {
      updated[key] = res.next[key]
      placeGhostNode.value = updated as unknown as Node
    }
  }
}

function openInlineEdit(nodeId: string, currentValue: string, label: string, clientX: number, clientY: number) {
  const svg = canvasRef.value?.svgEl
  const rect = svg?.getBoundingClientRect()
  const boxW = rect?.width || 400
  const boxH = rect?.height || 300
  const left = rect ? Math.max(8, Math.min(clientX - rect.left - 40, boxW - 232)) : 16
  const top = rect ? Math.max(8, Math.min(clientY - rect.top - 18, boxH - 44)) : 16
  inlineEdit.value = {
    nodeId,
    label,
    initialValue: currentValue,
    value: currentValue,
    left: Math.round(left),
    top: Math.round(top),
  }
  void nextTick(() => {
    inlineInputRef.value?.focus()
    inlineInputRef.value?.select()
  })
}

function openInlineEditForSelected() {
  const n = singleSelectedNode.value
  if (!n || isNodeLocked(project.value, n)) return
  if (n.type !== 'room' && n.type !== 'text' && n.type !== 'note') return
  const svg = canvasRef.value?.svgEl
  const rect = svg?.getBoundingClientRect()
  const cx = rect ? rect.left + (selectionToolbarPos.value?.left ?? rect.width / 2) + 80 : 120
  const cy = rect ? rect.top + (selectionToolbarPos.value?.top ?? rect.height / 2) + 54 : 120
  const current = n.type === 'room' ? n.name : n.s
  const label = n.type === 'room' ? 'Ubah nama ruangan' : 'Ubah isi teks'
  openInlineEdit(n.id, current, label, cx, cy)
}

function commitInlineEdit() {
  const state = inlineEdit.value
  if (!state) return
  inlineEdit.value = null
  const cleaned = state.value.trim()
  if (cleaned && cleaned !== state.initialValue) {
    editor.updateTextContent(state.nodeId, cleaned)
  }
}

function addTextAt(worldPos: Point, preset: TextPresetKind, clientX: number, clientY: number) {
  const node = textFromPreset(worldPos, preset)
  editor.setTool('select')
  const added = editor.placeNode(node, 'Tambah teks')
  if (!added) return
  editor.setSelection([added.id])
  announce('Teks ditambahkan, ketik isi teks lalu tekan Enter.')
  openInlineEdit(added.id, node.s, 'Ubah isi teks', clientX, clientY)
}

function handleAddTextPreset(preset: TextPresetKind) {
  if (!panels.isDesktop.value) panels.closeMobileSheets()
  const svg = canvasRef.value?.svgEl
  const rect = svg?.getBoundingClientRect()
  if (!rect) return
  const cx = rect.left + rect.width / 2 - 40
  const cy = rect.top + rect.height / 2
  const world = worldFromClient(cx, cy) ?? [0, 0]
  addTextAt(world, preset, cx, cy)
}

function handleStartPlaceNote() {
  editor.clearSelection()
  placeItemId.value = null
  placeGhostNode.value = createNode('note')
  placeGhostVisible.value = false
  editor.setTool('place')
  if (!panels.isDesktop.value) panels.closeMobileSheets()
  toast.add({
    title: 'Catatan + panah aktif',
    description: 'Klik titik yang ditunjuk panah. Seret titik biru untuk memindah teksnya.',
  })
}

function handleUpdateTextStyle(patch: Partial<SelectionTextStyle>) {
  const n = singleSelectedNode.value
  if (!n || (n.type !== 'text' && n.type !== 'note')) return
  editor.updateTextStyle(n.id, patch)
}

function cancelInlineEdit() {
  inlineEdit.value = null
}

function onInlineEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitInlineEdit()
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    cancelInlineEdit()
  }
}

function handleOpenBoq() {
  exportModalOpen.value = false
  if (!panels.isDesktop.value) panels.closeMobileSheets()
  boqModalOpen.value = true
}

function selectWorkspaceTool(next: EditorTool) {
  editor.setTool(next)
  if (next !== 'select') editor.clearSelection()
  if (!panels.isDesktop.value) panels.closeMobileSheets()
}

function startPlaceItem(itemId: LibraryItemId, closeMobile = true) {
  editor.clearSelection()
  placeItemId.value = itemId
  placeGhostNode.value = createLibraryNode(itemId, {
    project: project.value,
    ductSpec: ductSpec.value,
  })
  placeGhostVisible.value = false
  editor.setTool('place')
  if (closeMobile && !panels.isDesktop.value) {
    panels.closeMobileSheets()
  }
}

function onStartDragPlace(itemId: LibraryItemId) {
  libDragDropped = false
  startPlaceItem(itemId, false)
}

function onEndDragPlace() {
  if (!libDragDropped && tool.value === 'place') {
    editor.setTool('select')
  }
}

function positionPlaceGhostAt(world: Point) {
  if (!placeGhostNode.value) return
  const snapped = snapWorldPoint(world)
  if (isHostedOpening(placeGhostNode.value)) {
    placeGhostNode.value = applyHostedSnap(
      placeGhostNode.value,
      world,
      snapped.p,
      visibleRooms(project.value),
      hostToleranceMm(pxPerMm.value),
    )
    placeGhostVisible.value = true
    return
  }
  placeGhostNode.value = {
    ...placeGhostNode.value,
    x: snapped.p[0],
    y: snapped.p[1],
  }
  placeGhostVisible.value = true
}

function onCanvasDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  if (!placeGhostNode.value) {
    const raw = e.dataTransfer?.getData('text/plain')
    if (raw && isLibraryItemId(raw)) {
      startPlaceItem(raw, false)
    }
  }
  const world = worldFromClient(e.clientX, e.clientY)
  if (world) {
    positionPlaceGhostAt(world)
  }
}

function onCanvasDrop(e: DragEvent) {
  e.preventDefault()
  const world = worldFromClient(e.clientX, e.clientY)
  const snappedPos: Point = world ? snapWorldPoint(world).p : [0, 0]

  let candidate: Node | null = null
  let itemId = placeItemId.value

  if (placeGhostNode.value) {
    candidate = {
      ...placeGhostNode.value,
      x: snappedPos[0],
      y: snappedPos[1],
    }
  }
  else {
    const raw = e.dataTransfer?.getData('text/plain')
    if (raw && isLibraryItemId(raw)) {
      itemId = raw
      candidate = createLibraryNode(raw, {
        project: project.value,
        ductSpec: ductSpec.value,
        position: snappedPos,
      })
    }
  }

  if (candidate && world && isHostedOpening(candidate)) {
    candidate = applyHostedSnap(
      candidate,
      world,
      snappedPos,
      visibleRooms(project.value),
      hostToleranceMm(pxPerMm.value),
    )
  }

  if (candidate) {
    const added = editor.placeNode(candidate)
    if (added && itemId) {
      announce(`${libraryItemInfo(itemId).name} ditambahkan.`)
    }
  }
  libDragDropped = true
  editor.setTool('select')
}

function snapWorldPoint(world: Point, skipIds?: ReadonlySet<string>, closePoint: Point | null = null) {
  return snapAt(
    project.value,
    world,
    {
      enabled: snapEnabled.value,
      gridStep: viewport.gridStep.value,
      pxPerMm: pxPerMm.value,
      tolerancePx: 14,
      skipIds,
      closePoint,
    },
    connectionGraph.value,
  )
}

function commitRectRoom(origin: Point, opposite: Point) {
  const room = roomFromCorners(origin, opposite, nextRoomName(project.value))
  if (!room) {
    toast.add({ title: 'Ruangan terlalu kecil (min. 600 mm)' })
    return
  }
  const added = editor.placeNode(room, 'Buat ruangan')
  if (added) {
    announce(`${room.name} ditambahkan.`)
  }
}

function finishPoly() {
  const pts = polyPoints.value
  polyPoints.value = []
  polyDrag.value = null
  if (pts.length < 3) return
  const room = roomFromPolygon(pts, nextRoomName(project.value))
  if (!room) {
    toast.add({ title: 'Ruangan terlalu kecil (min. 0,36 m²)' })
    return
  }
  const added = editor.placeNode(room, 'Buat ruangan bebas')
  if (added) {
    announce(`${room.name} ditambahkan.`)
  }
}

function addPolyPoint(world: Point) {
  const closePt = polyPoints.value.length >= 3 ? polyPoints.value[0]! : null
  const snapped = snapWorldPoint(world, undefined, closePt)
  const target = polyTargetPoint(polyPoints.value, snapped, orthoEnabled.value, shiftDown.value)
  if (isClosingPolyPoint(polyPoints.value, target, 1)) {
    finishPoly()
    return
  }
  const last = polyPoints.value[polyPoints.value.length - 1]
  if (last && dist(target, last) < 1) return
  polyPoints.value = [...polyPoints.value, target]
}

function commitPartitionSegment(a: Point, b: Point) {
  const wall = partitionFromPoints(a, b)
  if (!wall) return
  const added = editor.placeNode(wall, 'Buat partisi')
  if (added) {
    wallStart.value = [b[0], b[1]]
    announce('Partisi ditambahkan.')
  }
}

function addDuctPoint(world: Point) {
  const snapped = snapWorldPoint(world)
  if (ductPoints.value.length === 0) {
    ductPoints.value = [snapped.p]
    return
  }
  const target = ductTargetPoint(ductPoints.value, snapped, orthoEnabled.value, shiftDown.value)
  const last = ductPoints.value[ductPoints.value.length - 1]!
  if (dist(target, last) < 1) return
  ductPoints.value = [...ductPoints.value, target]
}

function finishDuct() {
  const pts = ductPoints.value
  ductPoints.value = []
  ductDrag.value = null
  if (pts.length < 2) return
  const added = editor.commitDuctPath(pts)
  if (added.length > 0) {
    announce(`Jalur duct ditambahkan (${added.length} komponen).`)
  }
}

function handleCommandSubmit(raw: string) {
  const parsed = parseCommand(raw)
  switch (parsed.kind) {
    case 'empty':
      if (tool.value === 'duct' && ductPoints.value.length >= 2) {
        finishDuct()
        cmdBarRef.value?.blur()
        canvasRef.value?.svgEl?.focus({ preventScroll: true })
      }
      else if (tool.value === 'poly' && polyPoints.value.length >= 3) {
        finishPoly()
        cmdBarRef.value?.blur()
        canvasRef.value?.svgEl?.focus({ preventScroll: true })
      }
      return
    case 'tool':
      editor.setTool(parsed.tool)
      if (parsed.tool !== 'select') editor.clearSelection()
      return
    case 'action':
      if (parsed.action === 'view:zoom-fit') viewport.fit()
      else if (parsed.action === 'view:zoom-selection') viewport.zoomToSelection()
      else if (parsed.action === 'edit:undo') editor.undo()
      else if (parsed.action === 'edit:redo') editor.redo()
      else if (parsed.action === 'dialog:boq') handleOpenBoq()
      else if (parsed.action === 'help:shortcuts') shortcutsOpen.value = true
      return
    case 'length':
      if (tool.value === 'duct' && ductPoints.value.length > 0) {
        const target = ductPreviewTarget.value ?? ductPoints.value[ductPoints.value.length - 1]!
        const nextPt = ductPointByLength(ductPoints.value, target, parsed.mm)
        if (nextPt) {
          ductPoints.value = [...ductPoints.value, nextPt]
        }
        cmdBarRef.value?.blur()
        canvasRef.value?.svgEl?.focus({ preventScroll: true })
        return
      }
      if (tool.value === 'poly' && polyPoints.value.length > 0) {
        const target = polyPreviewTarget.value ?? polyPoints.value[polyPoints.value.length - 1]!
        const nextPt = ductPointByLength(polyPoints.value, target, parsed.mm)
        if (nextPt) {
          polyPoints.value = [...polyPoints.value, nextPt]
        }
        cmdBarRef.value?.blur()
        canvasRef.value?.svgEl?.focus({ preventScroll: true })
        return
      }
      if (tool.value === 'wall' && wallStart.value) {
        const target = wallPreviewTarget.value ?? wallStart.value
        const endPt = ductPointByLength([wallStart.value], target, parsed.mm)
        if (endPt) {
          commitPartitionSegment(wallStart.value, endPt)
        }
        cmdBarRef.value?.blur()
        canvasRef.value?.svgEl?.focus({ preventScroll: true })
        return
      }
      toast.add({
        title: 'Angka diterima',
        description: 'Klik titik awal duct, partisi, atau ruangan bebas dulu, lalu ketik panjang (mm) + Enter.',
      })
      return
    case 'dimensions':
      if (tool.value === 'room' && roomOrigin.value) {
        const room = roomFromDimensions(
          roomOrigin.value,
          viewport.cursorWorld.value,
          parsed.widthMm,
          parsed.heightMm,
          nextRoomName(project.value),
        )
        roomOrigin.value = null
        roomDrag.value = null
        if (room) {
          const added = editor.placeNode(room, 'Buat ruangan')
          if (added) announce(`${room.name} ditambahkan.`)
        }
        else {
          toast.add({ title: 'Ruangan terlalu kecil (min. 600 mm)' })
        }
        cmdBarRef.value?.blur()
        canvasRef.value?.svgEl?.focus({ preventScroll: true })
        return
      }
      toast.add({
        title: 'Angka diterima',
        description: 'Aktifkan alat Ruangan (K / REC) dan klik sudut 1 dulu, lalu ketik P x L (mis. 6x4) + Enter.',
      })
      return
    case 'unknown':
      toast.add({
        title: `Perintah "${parsed.raw}" tidak dikenal`,
        description: 'Coba: L (duct), REC (ruangan), PL, WALL, DIM, TEXT, BOQ, Z, atau ?.',
      })
  }
}

const contextMenuItems = computed<ContextMenuItem[][]>(() => {
  const hasClipboard = clipboard.value.length > 0

  if (selectedNodes.value.length === 0) {
    return [
      [
        {
          label: 'Tempel di sini',
          icon: 'i-lucide-clipboard-paste',
          kbds: ['ctrl', 'V'],
          disabled: !hasClipboard,
          onSelect: () => {
            editor.pasteClipboard(menuWorldPoint.value, viewport.gridStep.value)
          },
        },
        {
          label: 'Pilih semua',
          icon: 'i-lucide-check-square',
          kbds: ['ctrl', 'A'],
          onSelect: () => {
            editor.setTool('select')
            editor.selectAll()
          },
        },
        {
          label: 'Lihat semua',
          icon: 'i-lucide-maximize-2',
          kbds: ['shift', 'Z'],
          onSelect: () => {
            viewport.fit()
          },
        },
      ],
    ]
  }

  const locked = allSelectedLocked.value
  const arrangeGroup: ContextMenuItem[] = []

  if (selectedNodes.value.length > 1) {
    arrangeGroup.push(
      selectionGrouped.value
        ? {
            label: 'Ungroup',
            icon: 'i-lucide-ungroup',
            kbds: ['ctrl', 'shift', 'G'],
            onSelect: () => {
              editor.ungroupSelected()
            },
          }
        : {
            label: 'Group',
            icon: 'i-lucide-group',
            kbds: ['ctrl', 'G'],
            disabled: locked,
            onSelect: () => {
              handleGroup()
            },
          },
    )
  }

  if (canAlignSelection.value) {
    arrangeGroup.push({
      label: 'Rata',
      icon: 'i-lucide-align-start-vertical',
      children: [
        [
          { label: 'Rata kiri', onSelect: () => handleAlign('left') },
          { label: 'Rata tengah (horizontal)', onSelect: () => handleAlign('center') },
          { label: 'Rata kanan', onSelect: () => handleAlign('right') },
        ],
        [
          { label: 'Rata atas', onSelect: () => handleAlign('top') },
          { label: 'Rata tengah (vertikal)', onSelect: () => handleAlign('middle') },
          { label: 'Rata bawah', onSelect: () => handleAlign('bottom') },
        ],
      ],
    })
  }

  arrangeGroup.push(
    {
      label: 'Putar 90°',
      icon: 'i-lucide-rotate-cw',
      kbds: ['R'],
      disabled: locked,
      onSelect: () => {
        editor.rotateSelected(90, viewport.gridStep.value)
      },
    },
    {
      label: 'Cermin',
      icon: 'i-lucide-flip-horizontal-2',
      kbds: ['M'],
      disabled: locked,
      onSelect: () => {
        editor.mirrorSelected()
      },
    },
    {
      label: 'Ke depan',
      icon: 'i-lucide-bring-to-front',
      kbds: [']'],
      onSelect: () => {
        editor.reorderSelected('front')
      },
    },
    {
      label: 'Ke belakang',
      icon: 'i-lucide-send-to-back',
      kbds: ['['],
      onSelect: () => {
        editor.reorderSelected('back')
      },
    },
  )

  return [
    [
      {
        label: 'Salin',
        icon: 'i-lucide-copy',
        kbds: ['ctrl', 'C'],
        onSelect: () => handleCopy(),
      },
      {
        label: 'Tempel',
        icon: 'i-lucide-clipboard-paste',
        kbds: ['ctrl', 'V'],
        disabled: !hasClipboard,
        onSelect: () => {
          editor.pasteClipboard(menuWorldPoint.value, viewport.gridStep.value)
        },
      },
      {
        label: 'Duplikat',
        icon: 'i-lucide-copy-plus',
        kbds: ['ctrl', 'D'],
        onSelect: () => {
          editor.duplicateSelected(viewport.gridStep.value)
        },
      },
    ],
    arrangeGroup,
    [
      {
        label: locked ? 'Buka kunci' : 'Kunci',
        icon: locked ? 'i-lucide-lock-open' : 'i-lucide-lock',
        onSelect: () => {
          editor.setSelectedLocked(!locked)
        },
      },
      {
        label: 'Zoom ke pilihan',
        icon: 'i-lucide-zoom-in',
        kbds: ['Z'],
        onSelect: () => {
          viewport.zoomToSelection()
        },
      },
    ],
    [
      {
        label: 'Hapus',
        icon: 'i-lucide-trash-2',
        color: 'error',
        kbds: ['Del'],
        disabled: locked,
        onSelect: () => handleDeleteSelected(),
      },
    ],
  ]
})

function worldFromClient(clientX: number, clientY: number): Point | null {
  const svg = canvasRef.value?.svgEl
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  return clientToWorld(viewBox.value, {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }, clientX, clientY)
}

function capturePointer(pointerId: number) {
  try {
    canvasRef.value?.svgEl?.setPointerCapture(pointerId)
  }
  catch {
    // Synthetic pointer event di tes mungkin tidak memiliki pointer aktif.
  }
}

function onSvgContextMenu(e: MouseEvent) {
  if (tool.value === 'place') {
    e.preventDefault()
    e.stopPropagation()
    editor.setTool('select')
    return
  }
  if (tool.value === 'room') {
    e.preventDefault()
    e.stopPropagation()
    if (roomOrigin.value) {
      roomOrigin.value = null
      roomDrag.value = null
    }
    else {
      editor.setTool('select')
    }
    return
  }
  if (tool.value === 'poly') {
    e.preventDefault()
    e.stopPropagation()
    if (polyPoints.value.length >= 3) {
      finishPoly()
    }
    else if (polyPoints.value.length > 0) {
      polyPoints.value = []
      polyDrag.value = null
    }
    else {
      editor.setTool('select')
    }
    return
  }
  if (tool.value === 'wall') {
    e.preventDefault()
    e.stopPropagation()
    if (wallStart.value) {
      wallStart.value = null
      wallDrag.value = null
    }
    else {
      editor.setTool('select')
    }
    return
  }
  if (tool.value === 'dim') {
    e.preventDefault()
    e.stopPropagation()
    if (dimPoints.value.length > 0) {
      dimPoints.value = []
      dimDrag.value = null
    }
    else {
      editor.setTool('select')
    }
    return
  }
  if (tool.value === 'text' || tool.value === 'pen') {
    e.preventDefault()
    e.stopPropagation()
    penDrag.value = null
    editor.setTool('select')
    return
  }
  if (tool.value !== 'duct') return
  e.preventDefault()
  e.stopPropagation()
  if (ductPoints.value.length >= 2) {
    finishDuct()
  }
  else if (ductPoints.value.length > 0) {
    ductPoints.value = []
    ductDrag.value = null
  }
  else {
    editor.setTool('select')
  }
}

function onCanvasContextMenu(e: MouseEvent) {
  if (tool.value !== 'select') return
  menuWorldPoint.value = worldFromClient(e.clientX, e.clientY)
  const hitEl = (e.target as Element | null)?.closest('#world [data-id]')
  const hitId = hitEl?.getAttribute('data-id')
  const hitNode = hitId ? project.value.nodes.find(n => n.id === hitId) : null

  if (hitNode && isNodeVisible(project.value, hitNode) && !isLayerLocked(project.value, hitNode)) {
    if (!selectedIds.value.has(hitNode.id)) {
      editor.setSelection(clickSelect(project.value, selectedIds.value, hitNode.id, false))
    }
  }
  else if (!hitNode) {
    editor.clearSelection()
  }
}

function onCanvasDblClick(e: MouseEvent) {
  if (tool.value === 'duct') {
    if (ductPoints.value.length >= 2) finishDuct()
    return
  }
  if (tool.value === 'poly') {
    if (polyPoints.value.length >= 3) finishPoly()
    return
  }
  if (tool.value !== 'select') return
  const under = document.elementFromPoint(e.clientX, e.clientY)
  if (under?.closest('[data-grip]')) return
  const hitEl = under?.closest('#world [data-id]')
  const hitId = hitEl?.getAttribute('data-id')
  const hitNode = hitId ? project.value.nodes.find(n => n.id === hitId) : null
  if (!hitNode || !isNodeVisible(project.value, hitNode) || isNodeLocked(project.value, hitNode)) return

  if (hitNode.g && selectedIds.value.size > 1) {
    editor.setSelection([hitNode.id])
    return
  }
  if (hitNode.type === 'room') {
    openInlineEdit(hitNode.id, hitNode.name, 'Ubah nama ruangan', e.clientX, e.clientY)
  }
  else if (hitNode.type === 'text' || hitNode.type === 'note') {
    openInlineEdit(hitNode.id, hitNode.s, 'Ubah isi teks', e.clientX, e.clientY)
  }
}

function onCanvasPointerDown(e: PointerEvent) {
  hoveredWarn.value = null
  if (e.button !== 0) return
  if (viewport.isPanMode.value) return

  const world = worldFromClient(e.clientX, e.clientY)
  if (!world) return

  if (tool.value === 'place') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    positionPlaceGhostAt(world)
    if (placeGhostNode.value) {
      const isNote = placeGhostNode.value.type === 'note'
      const added = editor.placeNode(placeGhostNode.value)
      if (added) {
        if (isNote) {
          editor.setTool('select')
          editor.setSelection([added.id])
          announce('Catatan ditambahkan. Seret titik biru untuk memindah teks.')
        }
        else if (placeItemId.value) {
          announce(`${libraryItemInfo(placeItemId.value).name} ditambahkan.`)
        }
      }
    }
    return
  }

  if (tool.value === 'pen') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    penDrag.value = { pointerId: e.pointerId, pts: [world] }
    capturePointer(e.pointerId)
    return
  }

  if (tool.value === 'text') {
    const snapped = snapWorldPoint(world)
    addTextAt(snapped.p, 'body', e.clientX, e.clientY)
    return
  }

  if (tool.value === 'dim') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    const snapped = snapWorldPoint(world)
    if (dimPoints.value.length === 0) {
      dimPoints.value = [snapped.p]
      dimDrag.value = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
      }
      capturePointer(e.pointerId)
    }
    else if (dimPoints.value.length === 1) {
      const p2 = orthoPoint(dimPoints.value[0]!, snapped.p, orthoEnabled.value, shiftDown.value)
      if (dist(p2, dimPoints.value[0]!) > 1) {
        dimPoints.value = [dimPoints.value[0]!, p2]
      }
    }
    else {
      const dim = dimFromPoints(dimPoints.value[0]!, dimPoints.value[1]!, snapped.p, renderCtx.value.th)
      if (dim) {
        editor.placeNode(dim, 'Buat garis ukur')
        announce(`Garis ukur ${Math.round(dim.L)} mm ditambahkan.`)
      }
      dimPoints.value = []
      dimDrag.value = null
    }
    return
  }

  if (tool.value === 'duct') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    const snapped = snapWorldPoint(world)
    const last = ductPoints.value[ductPoints.value.length - 1]
    if (!last || dist(snapped.p, last) * (pxPerMm.value || 1) >= 10) {
      addDuctPoint(world)
    }
    ductDrag.value = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      free: effectiveOrtho.value,
      axis: null,
    }
    capturePointer(e.pointerId)
    return
  }

  if (tool.value === 'room') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    const snapped = snapWorldPoint(world)
    if (!roomOrigin.value) {
      roomOrigin.value = snapped.p
      roomDrag.value = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
      }
      capturePointer(e.pointerId)
    }
    else {
      commitRectRoom(roomOrigin.value, snapped.p)
      roomOrigin.value = null
      roomDrag.value = null
    }
    return
  }

  if (tool.value === 'poly') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    const closePt = polyPoints.value.length >= 3 ? polyPoints.value[0]! : null
    const snapped = snapWorldPoint(world, undefined, closePt)
    const last = polyPoints.value[polyPoints.value.length - 1]
    if (!last || dist(snapped.p, last) * (pxPerMm.value || 1) >= 10) {
      addPolyPoint(world)
    }
    if (polyPoints.value.length > 0) {
      polyDrag.value = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
        free: effectiveOrtho.value,
        axis: null,
      }
      capturePointer(e.pointerId)
    }
    return
  }

  if (tool.value === 'wall') {
    canvasRef.value?.svgEl?.focus({ preventScroll: true })
    const snapped = snapWorldPoint(world)
    if (!wallStart.value) {
      wallStart.value = snapped.p
      wallDrag.value = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
      }
      capturePointer(e.pointerId)
    }
    else {
      const end = orthoPoint(wallStart.value, snapped.p, orthoEnabled.value, shiftDown.value)
      commitPartitionSegment(wallStart.value, end)
    }
    return
  }

  if (tool.value !== 'select') return

  const warnEl = (e.target as Element | null)?.closest('[data-warn]')
  if (warnEl) {
    const idx = Number(warnEl.getAttribute('data-warn'))
    const warn = Number.isInteger(idx) ? warnings.value[idx] : undefined
    if (warn) {
      selectWarning(warn)
      return
    }
  }

  const gripEl = (e.target as Element | null)?.closest('[data-grip]')
  if (gripEl && selectedIds.value.size === 1) {
    const gripId = gripEl.getAttribute('data-grip')
    const [singleId] = selectedIds.value
    const singleNode = singleId ? project.value.nodes.find(n => n.id === singleId) : null
    if (gripId && singleNode && !singleNode.lock) {
      const now = Date.now()
      if (
        lastGripClick
        && lastGripClick.nodeId === singleNode.id
        && lastGripClick.gripId === gripId
        && now - lastGripClick.time < 350
      ) {
        lastGripClick = null
        editor.doubleClickNodeGrip(singleNode.id, gripId)
        return
      }
      lastGripClick = { nodeId: singleNode.id, gripId, time: now }
      const baseClone = JSON.parse(JSON.stringify(singleNode)) as Node
      gripDrag.value = {
        pointerId: e.pointerId,
        nodeId: singleNode.id,
        gripId,
        isSize: SIZE_GRIP_IDS.has(gripId),
        baseNode: baseClone,
        previewNode: baseClone,
        targetWorld: world,
        moved: false,
      }
      capturePointer(e.pointerId)
      return
    }
  }

  const hitEl = (e.target as Element | null)?.closest('#world [data-id]')
  const hitId = hitEl?.getAttribute('data-id')
  const hitNode = hitId ? project.value.nodes.find(n => n.id === hitId) : null

  if (hitNode && isNodeVisible(project.value, hitNode)) {
    if (isLayerLocked(project.value, hitNode)) {
      const layerName = LAYER_LABELS[layerOf(hitNode)] ?? layerOf(hitNode)
      toast.add({
        title: `Layer ${layerName} terkunci`,
        description: 'Buka kunci layer terlebih dahulu untuk memilih komponennya.',
      })
      return
    }
    if (e.shiftKey) {
      editor.setSelection(clickSelect(project.value, selectedIds.value, hitNode.id, true))
      return
    }
    if (!selectedIds.value.has(hitNode.id)) {
      editor.setSelection(clickSelect(project.value, selectedIds.value, hitNode.id, false))
    }
    if (hitNode.lock) return

    const movable = movableSelectedIds(project.value, selectedIds.value)
    if (movable.length === 0) return

    const movingIds = new Set(movable)
    const cn = connectionGraph.value
    const openPorts = cn.all.filter((a) => {
      if (movingIds.has(a.node.id)) return false
      const linked = cn.link.get(a)
      return !linked || movingIds.has(linked.node.id)
    })

    moveDrag.value = {
      pointerId: e.pointerId,
      start: world,
      dx: 0,
      dy: 0,
      rawDx: 0,
      rawDy: 0,
      moved: false,
      movingIds,
      openPorts,
    }
    capturePointer(e.pointerId)
    return
  }

  boxDrag.value = {
    pointerId: e.pointerId,
    start: world,
    end: world,
    shift: e.shiftKey,
  }
  capturePointer(e.pointerId)
}

function isAnyCanvasDragActive(): boolean {
  return Boolean(
    boxDrag.value
    || moveDrag.value
    || gripDrag.value
    || ductDrag.value
    || roomDrag.value
    || polyDrag.value
    || wallDrag.value
    || dimDrag.value
    || penDrag.value
    || viewport.isPanning.value,
  )
}

function updateHoveredWarning(e: PointerEvent) {
  if (isAnyCanvasDragActive()) {
    hoveredWarn.value = null
    return
  }
  const el = (e.target as Element | null)?.closest('[data-warn]')
  if (!el) {
    hoveredWarn.value = null
    return
  }
  const idx = Number(el.getAttribute('data-warn'))
  if (!Number.isInteger(idx) || !warnings.value[idx]) {
    hoveredWarn.value = null
    return
  }
  const svg = canvasRef.value?.svgEl
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const left = Math.max(8, Math.min(e.clientX - rect.left + 16, Math.max(8, rect.width - 280)))
  const top = Math.max(8, Math.min(e.clientY - rect.top + 16, Math.max(8, rect.height - 96)))
  hoveredWarn.value = { index: idx, left: Math.round(left), top: Math.round(top) }
}

function selectWarning(warning: ValidationWarning, options?: { zoom?: boolean }) {
  hoveredWarn.value = null
  const targetNode = project.value.nodes.find(n => n.id === warning.id)
  if (!targetNode) return
  if (!isNodeVisible(project.value, targetNode)) {
    const layerName = LAYER_LABELS[layerOf(targetNode)] ?? layerOf(targetNode)
    toast.add({
      title: `Layer ${layerName} disembunyikan`,
      description: 'Tampilkan layer di panel Layer untuk memilih komponennya.',
    })
    return
  }
  if (tool.value !== 'select') editor.setTool('select')
  editor.setSelection(new Set([warning.id]))
  if (!panels.isDesktop.value) warnDrawerOpen.value = false
  panels.openSide()
  if (options?.zoom) viewport.zoomToPoint(warning.pos)
  announce(`${warning.msg}: ${warning.detail}`)
}

function onCanvasPointerLeave() {
  hoveredWarn.value = null
}

function onCanvasPointerMove(e: PointerEvent) {
  updateHoveredWarning(e)
  const world = worldFromClient(e.clientX, e.clientY)
  if (!world) return

  if (tool.value === 'place' && placeGhostNode.value) {
    positionPlaceGhostAt(world)
    return
  }

  if (ductDrag.value && ductDrag.value.pointerId === e.pointerId) {
    const d = ductDrag.value
    const moved = d.moved || Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY) > 8
    let nextAxis = d.axis
    if (d.free && ductPoints.value.length > 0) {
      const last = ductPoints.value[ductPoints.value.length - 1]!
      const step = stepFreeDuctCorner(last, world, d.axis, {
        pxPerMm: pxPerMm.value,
        snapEnabled: snapEnabled.value,
        gridStep: viewport.gridStep.value,
      })
      nextAxis = step.nextAxis
      if (step.corner) {
        ductPoints.value = [...ductPoints.value, step.corner]
      }
    }
    ductDrag.value = { ...d, moved, axis: nextAxis }
    return
  }

  if (roomDrag.value && roomDrag.value.pointerId === e.pointerId) {
    const r = roomDrag.value
    const moved = r.moved || Math.hypot(e.clientX - r.startClientX, e.clientY - r.startClientY) > 8
    roomDrag.value = { ...r, moved }
    return
  }

  if (polyDrag.value && polyDrag.value.pointerId === e.pointerId) {
    const p = polyDrag.value
    const moved = p.moved || Math.hypot(e.clientX - p.startClientX, e.clientY - p.startClientY) > 8
    let nextAxis = p.axis
    if (p.free && polyPoints.value.length > 0) {
      const last = polyPoints.value[polyPoints.value.length - 1]!
      const step = stepFreeDuctCorner(last, world, p.axis, {
        pxPerMm: pxPerMm.value,
        snapEnabled: snapEnabled.value,
        gridStep: viewport.gridStep.value,
      })
      nextAxis = step.nextAxis
      if (step.corner) {
        polyPoints.value = [...polyPoints.value, step.corner]
      }
    }
    polyDrag.value = { ...p, moved, axis: nextAxis }
    return
  }

  if (penDrag.value && penDrag.value.pointerId === e.pointerId) {
    const last = penDrag.value.pts[penDrag.value.pts.length - 1]!
    if (dist(last, world) * (pxPerMm.value || 1) >= 3) {
      penDrag.value = { ...penDrag.value, pts: [...penDrag.value.pts, world] }
    }
    return
  }

  if (dimDrag.value && dimDrag.value.pointerId === e.pointerId) {
    const d = dimDrag.value
    const moved = d.moved || Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY) > 8
    dimDrag.value = { ...d, moved }
    return
  }

  if (wallDrag.value && wallDrag.value.pointerId === e.pointerId) {
    const w = wallDrag.value
    const moved = w.moved || Math.hypot(e.clientX - w.startClientX, e.clientY - w.startClientY) > 8
    wallDrag.value = { ...w, moved }
    return
  }

  if (gripDrag.value && gripDrag.value.pointerId === e.pointerId) {
    const g = gripDrag.value
    const snapped = g.isSize
      ? world
      : snapAt(project.value, world, {
        enabled: snapEnabled.value,
        gridStep: viewport.gridStep.value,
        pxPerMm: pxPerMm.value,
        tolerancePx: 14,
        skipIds: new Set([g.nodeId]),
      }, connectionGraph.value).p
    const preview = applyGrip(g.baseNode, g.gripId, snapped, project.value.unit, g.baseNode)
    gripDrag.value = {
      ...g,
      previewNode: preview,
      targetWorld: snapped,
      moved: true,
    }
    return
  }

  if (moveDrag.value && moveDrag.value.pointerId === e.pointerId) {
    const m = moveDrag.value
    if (!m.moved && dist(world, m.start) * (pxPerMm.value || 1) < 4) return
    const rawDx = world[0] - m.start[0]
    const rawDy = world[1] - m.start[1]
    const [dx, dy] = computeMoveDelta(
      project.value,
      m.movingIds,
      rawDx,
      rawDy,
      {
        snapEnabled: snapEnabled.value,
        gridStep: viewport.gridStep.value,
        pxPerMm: pxPerMm.value,
        openPorts: m.openPorts,
      },
    )
    moveDrag.value = { ...m, dx, dy, rawDx, rawDy, moved: true }
    return
  }

  if (boxDrag.value && boxDrag.value.pointerId === e.pointerId) {
    boxDrag.value = { ...boxDrag.value, end: world }
  }
}

function onCanvasPointerUp(e: PointerEvent) {
  if (penDrag.value && penDrag.value.pointerId === e.pointerId) {
    const stroke = penDrag.value
    penDrag.value = null
    const sketch = sketchFromWorldPoints(stroke.pts)
    if (sketch) {
      editor.placeNode(sketch, 'Buat coretan')
      announce('Coretan tangan ditambahkan.')
    }
    return
  }

  if (dimDrag.value && dimDrag.value.pointerId === e.pointerId) {
    const d = dimDrag.value
    dimDrag.value = null
    if (d.moved && tool.value === 'dim' && dimPoints.value.length === 1) {
      const endWorld = worldFromClient(e.clientX, e.clientY)
      if (endWorld) {
        const p2 = orthoPoint(dimPoints.value[0]!, snapWorldPoint(endWorld).p, orthoEnabled.value, shiftDown.value)
        if (dist(p2, dimPoints.value[0]!) > 1) {
          dimPoints.value = [dimPoints.value[0]!, p2]
        }
      }
    }
    return
  }

  if (ductDrag.value && ductDrag.value.pointerId === e.pointerId) {
    const d = ductDrag.value
    ductDrag.value = null
    if (d.moved && tool.value === 'duct') {
      const endWorld = worldFromClient(e.clientX, e.clientY)
      if (endWorld) addDuctPoint(endWorld)
    }
    return
  }

  if (roomDrag.value && roomDrag.value.pointerId === e.pointerId) {
    const r = roomDrag.value
    roomDrag.value = null
    if (r.moved && tool.value === 'room' && roomOrigin.value) {
      const endWorld = worldFromClient(e.clientX, e.clientY)
      if (endWorld) {
        commitRectRoom(roomOrigin.value, snapWorldPoint(endWorld).p)
      }
      roomOrigin.value = null
    }
    return
  }

  if (polyDrag.value && polyDrag.value.pointerId === e.pointerId) {
    const p = polyDrag.value
    polyDrag.value = null
    if (p.moved && tool.value === 'poly') {
      const endWorld = worldFromClient(e.clientX, e.clientY)
      if (endWorld) {
        if (p.free && polyPoints.value.length >= 3 && dist(endWorld, polyPoints.value[0]!) * (pxPerMm.value || 1) < 24) {
          finishPoly()
        }
        else {
          addPolyPoint(endWorld)
        }
      }
    }
    return
  }

  if (wallDrag.value && wallDrag.value.pointerId === e.pointerId) {
    const w = wallDrag.value
    wallDrag.value = null
    if (w.moved && tool.value === 'wall' && wallStart.value) {
      const endWorld = worldFromClient(e.clientX, e.clientY)
      if (endWorld) {
        const end = orthoPoint(wallStart.value, snapWorldPoint(endWorld).p, orthoEnabled.value, shiftDown.value)
        commitPartitionSegment(wallStart.value, end)
      }
    }
    return
  }

  if (gripDrag.value && gripDrag.value.pointerId === e.pointerId) {
    const g = gripDrag.value
    gripDrag.value = null
    if (g.moved) {
      editor.applyNodeGrip(g.nodeId, g.gripId, g.targetWorld, g.baseNode)
    }
    return
  }

  if (moveDrag.value && moveDrag.value.pointerId === e.pointerId) {
    const m = moveDrag.value
    moveDrag.value = null
    if (m.moved && (m.dx !== 0 || m.dy !== 0 || m.rawDx !== 0 || m.rawDy !== 0)) {
      editor.moveSelected(m.dx, m.dy, 'Geser komponen', {
        rawDx: m.rawDx,
        rawDy: m.rawDy,
        toleranceMm: hostToleranceMm(pxPerMm.value),
      })
    }
    return
  }

  const drag = boxDrag.value
  if (!drag || drag.pointerId !== e.pointerId) return
  boxDrag.value = null

  const endWorld = worldFromClient(e.clientX, e.clientY) ?? drag.end
  const dragPx = dist(endWorld, drag.start) * (pxPerMm.value || 1)
  if (dragPx < 4) {
    if (!drag.shift) editor.clearSelection()
    return
  }

  const result = selectByBox(project.value, drag.start, endWorld, renderCtx.value)
  if (drag.shift) {
    const merged = new Set(selectedIds.value)
    for (const id of result.ids) merged.add(id)
    editor.setSelection(merged)
  }
  else {
    editor.setSelection(result.ids)
  }
}

function onCanvasPointerCancel(e: PointerEvent) {
  if (penDrag.value?.pointerId === e.pointerId) penDrag.value = null
  if (dimDrag.value?.pointerId === e.pointerId) dimDrag.value = null
  if (ductDrag.value?.pointerId === e.pointerId) ductDrag.value = null
  if (roomDrag.value?.pointerId === e.pointerId) roomDrag.value = null
  if (polyDrag.value?.pointerId === e.pointerId) polyDrag.value = null
  if (wallDrag.value?.pointerId === e.pointerId) wallDrag.value = null
  if (gripDrag.value?.pointerId === e.pointerId) gripDrag.value = null
  if (moveDrag.value?.pointerId === e.pointerId) moveDrag.value = null
  if (boxDrag.value?.pointerId === e.pointerId) boxDrag.value = null
}

function handleDeleteSelected() {
  const { deletedCount, lockedSkipped } = editor.deleteSelected()
  if (deletedCount > 0) {
    toast.add({
      title: `${deletedCount} komponen dihapus`,
      actions: [
        {
          label: 'Urungkan',
          color: 'primary',
          variant: 'solid',
          onClick: () => {
            editor.undo()
          },
        },
      ],
    })
    return
  }
  if (lockedSkipped > 0) {
    toast.add({
      title: 'Komponen terkunci tidak dapat dihapus',
      description: 'Buka kunci komponen terlebih dahulu.',
    })
  }
}

function dispatchShortcut(def: ShortcutDef, e: KeyboardEvent) {
  const nudgeStep = e.shiftKey ? 100 : 10
  switch (def.id) {
    case 'tool:select':
      editor.setTool('select')
      return
    case 'tool:pan':
      editor.setTool('pan')
      return
    case 'tool:room':
      editor.setTool('room')
      editor.clearSelection()
      return
    case 'tool:poly':
      editor.setTool('poly')
      editor.clearSelection()
      return
    case 'tool:wall':
      editor.setTool('wall')
      editor.clearSelection()
      return
    case 'tool:duct':
      editor.setTool('duct')
      editor.clearSelection()
      return
    case 'tool:fitting':
    case 'tool:equip':
    case 'tool:diffuser':
      panels.openCategory('elemen')
      return
    case 'tool:dim':
      editor.setTool('dim')
      editor.clearSelection()
      return
    case 'tool:text':
      editor.setTool('text')
      editor.clearSelection()
      return
    case 'tool:pen':
      editor.setTool('pen')
      editor.clearSelection()
      return
    case 'edit:rotate':
      if (tool.value === 'place' && placeGhostNode.value) {
        e.preventDefault()
        if (placeGhostNode.value.type === 'door' && placeGhostNode.value.host) {
          placeGhostNode.value = {
            ...placeGhostNode.value,
            swing: placeGhostNode.value.swing === 'out' ? 'in' : 'out',
          }
          return
        }
        placeGhostNode.value = {
          ...placeGhostNode.value,
          rot: norm((placeGhostNode.value.rot || 0) + 90),
        }
        return
      }
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.rotateSelected(90, viewport.gridStep.value)
      }
      return
    case 'edit:mirror':
      if (tool.value === 'place' && placeGhostNode.value) {
        e.preventDefault()
        if (placeGhostNode.value.type === 'door' && placeGhostNode.value.host) {
          placeGhostNode.value = {
            ...placeGhostNode.value,
            hinge: placeGhostNode.value.hinge === 'r' ? 'l' : 'r',
          }
          return
        }
        placeGhostNode.value = {
          ...placeGhostNode.value,
          mir: !placeGhostNode.value.mir,
        }
        return
      }
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.mirrorSelected()
      }
      return
    case 'edit:delete':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        handleDeleteSelected()
      }
      return
    case 'edit:copy':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        handleCopy()
      }
      return
    case 'edit:paste':
      e.preventDefault()
      editor.pasteClipboard(
        viewport.cursorInside.value ? viewport.cursorWorld.value : null,
        viewport.gridStep.value,
      )
      return
    case 'edit:duplicate':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.duplicateSelected(viewport.gridStep.value)
      }
      return
    case 'edit:group':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        handleGroup()
      }
      return
    case 'edit:ungroup':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.ungroupSelected()
      }
      return
    case 'edit:nudge-left':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.moveSelected(-nudgeStep, 0, 'Geser komponen')
      }
      return
    case 'edit:nudge-right':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.moveSelected(nudgeStep, 0, 'Geser komponen')
      }
      return
    case 'edit:nudge-up':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.moveSelected(0, -nudgeStep, 'Geser komponen')
      }
      return
    case 'edit:nudge-down':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.moveSelected(0, nudgeStep, 'Geser komponen')
      }
      return
    case 'edit:select-all':
      e.preventDefault()
      editor.setTool('select')
      editor.selectAll()
      return
    case 'edit:undo':
      e.preventDefault()
      editor.undo()
      return
    case 'edit:redo':
      e.preventDefault()
      editor.redo()
      return
    case 'edit:save':
      e.preventDefault()
      void editor.flushSave()
      return
    case 'edit:order-front':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.reorderSelected('front')
      }
      return
    case 'edit:order-back':
      if (selectedIds.value.size > 0) {
        e.preventDefault()
        editor.reorderSelected('back')
      }
      return
    case 'edit:escape':
      hoveredWarn.value = null
      if (shortcutsOpen.value) {
        shortcutsOpen.value = false
        return
      }
      if (warnDrawerOpen.value) {
        warnDrawerOpen.value = false
        return
      }
      if (panels.showMobileScrim.value) {
        panels.closeMobileSheets()
        return
      }
      if (tool.value === 'duct' && ductPoints.value.length > 0) {
        ductPoints.value = []
        ductDrag.value = null
        return
      }
      if (tool.value === 'room' && roomOrigin.value) {
        roomOrigin.value = null
        roomDrag.value = null
        return
      }
      if (tool.value === 'poly' && polyPoints.value.length > 0) {
        polyPoints.value = []
        polyDrag.value = null
        return
      }
      if (tool.value === 'wall' && wallStart.value) {
        wallStart.value = null
        wallDrag.value = null
        return
      }
      if (tool.value === 'dim' && dimPoints.value.length > 0) {
        dimPoints.value = []
        dimDrag.value = null
        return
      }
      cancelActiveInteractions()
      editor.clearSelection()
      editor.setTool('select')
      return
    case 'view:zoom-selection':
      e.preventDefault()
      viewport.zoomToSelection()
      return
    case 'view:zoom-fit':
      e.preventDefault()
      viewport.fit()
      return
    case 'view:zoom-in':
      e.preventDefault()
      viewport.zoomIn()
      return
    case 'view:zoom-out':
      e.preventDefault()
      viewport.zoomOut()
      return
    case 'view:toggle-snap':
      e.preventDefault()
      editor.toggleSnap()
      return
    case 'view:toggle-grid':
      e.preventDefault()
      viewport.toggleGrid()
      return
    case 'view:toggle-ortho':
      e.preventDefault()
      editor.toggleOrtho()
      return
    case 'view:focus-mode':
      e.preventDefault()
      panels.toggleFocusMode()
      return
    case 'view:toggle-lib':
      e.preventDefault()
      panels.toggleLib()
      return
    case 'view:toggle-side':
      e.preventDefault()
      panels.toggleSide()
      return
    case 'help:ai':
      e.preventDefault()
      aiOpen.value = !aiOpen.value
      return
    case 'help:shortcuts':
      e.preventDefault()
      shortcutsOpen.value = !shortcutsOpen.value
  }
}

function onEditorKeydown(e: KeyboardEvent) {
  if (e.key === 'Shift') {
    shiftDown.value = true
  }

  const target = e.target as HTMLElement | null
  const inInput = Boolean(target?.closest('input, select, textarea, dialog, [role="dialog"]'))

  // Tab / Shift+Tab di kanvas memindahkan seleksi antar komponen tanpa menjebak fokus
  if (!inInput && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Tab' && target === canvasRef.value?.svgEl) {
    const step = stepTabSelection(project.value, selectedIds.value, e.shiftKey)
    if (step.exitCanvas) {
      editor.clearSelection()
      return
    }
    e.preventDefault()
    if (tool.value !== 'select') editor.setTool('select')
    editor.setSelection(step.next)
    if (step.node) {
      const lockNote = step.node.lock ? ' (terkunci)' : ''
      announce(`${nodeDisplayName(step.node)}${lockNote} dipilih, ${step.index + 1} dari ${step.total}. Panah untuk geser, Delete untuk hapus.`)
    }
    return
  }

  // Saat alat gambar aktif (duct / room / poly): angka masuk baris perintah, Enter selesai, Backspace hapus titik
  if (!inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (tool.value === 'duct') {
      if (ductPoints.value.length > 0 && /^[0-9.]$/.test(e.key)) {
        e.preventDefault()
        cmdBarRef.value?.startTyping(e.key)
        return
      }
      if (e.key === 'Enter' && ductPoints.value.length >= 2) {
        e.preventDefault()
        finishDuct()
        return
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && ductPoints.value.length > 0) {
        e.preventDefault()
        ductPoints.value = ductPoints.value.slice(0, -1)
        return
      }
    }
    else if (tool.value === 'room') {
      if (roomOrigin.value && /^[0-9.]$/.test(e.key)) {
        e.preventDefault()
        cmdBarRef.value?.startTyping(e.key)
        return
      }
    }
    else if (tool.value === 'poly') {
      if (polyPoints.value.length > 0 && /^[0-9.]$/.test(e.key)) {
        e.preventDefault()
        cmdBarRef.value?.startTyping(e.key)
        return
      }
      if (e.key === 'Enter' && polyPoints.value.length >= 3) {
        e.preventDefault()
        finishPoly()
        return
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && polyPoints.value.length > 0) {
        e.preventDefault()
        polyPoints.value = polyPoints.value.slice(0, -1)
        return
      }
    }
    else if (tool.value === 'wall') {
      if (wallStart.value && /^[0-9.]$/.test(e.key)) {
        e.preventDefault()
        cmdBarRef.value?.startTyping(e.key)
        return
      }
    }
  }

  const matched = matchShortcut(e, inInput)
  if (matched) {
    dispatchShortcut(matched, e)
  }
}

function onEditorKeyup(e: KeyboardEvent) {
  if (e.key === 'Shift') {
    shiftDown.value = false
  }
}

function onWindowBlur() {
  shiftDown.value = false
  cancelActiveInteractions()
}

function onPageHide() {
  if (saveStatus.value === 'pending') {
    void editor.flushSave()
  }
}

async function loadRouteProject(id: string) {
  cancelActiveInteractions()
  warnDrawerOpen.value = false
  hoveredWarn.value = null
  lastWarnCount = null
  const allowCreate = id === 'contoh' || id === 'baru' || route.query.baru === '1'
  const opened = await editor.openProject(id, undefined, { allowCreate })
  if (!opened) {
    showError({
      statusCode: 404,
      statusMessage: 'Proyek tidak ditemukan',
      message: `Proyek "${id}" tidak ada di browser ini atau sudah dihapus. Proyek lain tetap aman di daftar proyek.`,
    })
    return
  }
  lastWarnCount = warnings.value.length
  await nextTick()
  viewport.fit(true)
}

let boundSelectionSvg: SVGSVGElement | null = null
let stageResizeObserver: ResizeObserver | null = null

function updateStageSize(svg: SVGSVGElement | null) {
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    stageSize.value = { width: rect.width, height: rect.height }
  }
}

function bindSelectionListeners(svg: SVGSVGElement | null) {
  if (boundSelectionSvg) {
    boundSelectionSvg.removeEventListener('pointerdown', onCanvasPointerDown)
    boundSelectionSvg.removeEventListener('pointermove', onCanvasPointerMove)
    boundSelectionSvg.removeEventListener('pointerup', onCanvasPointerUp)
    boundSelectionSvg.removeEventListener('pointercancel', onCanvasPointerCancel)
    boundSelectionSvg.removeEventListener('pointerleave', onCanvasPointerLeave)
    boundSelectionSvg.removeEventListener('dblclick', onCanvasDblClick)
    boundSelectionSvg.removeEventListener('contextmenu', onSvgContextMenu)
    boundSelectionSvg = null
  }
  stageResizeObserver?.disconnect()
  stageResizeObserver = null

  if (!svg) return
  boundSelectionSvg = svg
  svg.addEventListener('pointerdown', onCanvasPointerDown)
  svg.addEventListener('pointermove', onCanvasPointerMove)
  svg.addEventListener('pointerup', onCanvasPointerUp)
  svg.addEventListener('pointercancel', onCanvasPointerCancel)
  svg.addEventListener('pointerleave', onCanvasPointerLeave)
  svg.addEventListener('dblclick', onCanvasDblClick)
  svg.addEventListener('contextmenu', onSvgContextMenu)

  updateStageSize(svg)
  if (typeof ResizeObserver !== 'undefined') {
    stageResizeObserver = new ResizeObserver(() => updateStageSize(svg))
    stageResizeObserver.observe(svg)
  }
}

onMounted(() => {
  try {
    onboardingDismissed.value = localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  }
  catch {
    onboardingDismissed.value = false
  }

  const svg = canvasRef.value?.svgEl ?? null
  viewport.bindSvg(svg)
  bindSelectionListeners(svg)
  void loadRouteProject(projectId.value)
  window.addEventListener('keydown', onEditorKeydown)
  window.addEventListener('keyup', onEditorKeyup)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('pagehide', onPageHide)
})

watch(projectId, (nextId, prevId) => {
  if (nextId !== prevId) {
    void loadRouteProject(nextId)
  }
})

onBeforeUnmount(() => {
  bindSelectionListeners(null)
  window.removeEventListener('keydown', onEditorKeydown)
  window.removeEventListener('keyup', onEditorKeyup)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('pagehide', onPageHide)
  if (saveStatus.value === 'pending') {
    void editor.flushSave()
  }
})

useHead(() => ({
  htmlAttrs: { lang: 'id' },
  title: `Editor (${projectId.value}) · Temandor`,
  meta: [
    {
      name: 'description',
      content: 'Ruang kerja editor 2D jalur ducting dan ventilasi Temandor.',
    },
  ],
}))
</script>

<template>
  <div class="editor-shell flex-1 flex flex-col min-h-0 overflow-hidden bg-paper text-ink">
    <header class="relative h-12 shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 bg-panel border-b border-line">
      <div class="tape absolute inset-x-0 top-0 h-[3px]" />

      <NuxtLink
        to="/proyek"
        class="flex items-center gap-2 pr-1.5 sm:pr-3 sm:border-r border-line rounded-md focus-visible:outline-2 focus-visible:outline-hazard focus-visible:outline-offset-2"
        aria-label="TEMANDOR - Kembali ke proyek"
        title="Kembali ke daftar proyek"
      >
        <span class="grid place-items-center size-7 rounded bg-ink shrink-0">
          <svg
            viewBox="0 0 24 24"
            class="size-[18px]"
            fill="none"
            stroke="#f2c200"
            stroke-width="2.2"
            aria-hidden="true"
          >
            <path d="M3 6h7a8 8 0 0 1 8 8v7M3 12h7a2 2 0 0 1 2 2v7" />
          </svg>
        </span>
        <span class="hidden md:block font-cond font-bold text-lg tracking-wide text-ink">
          TEMANDOR
        </span>
      </NuxtLink>

      <h1 class="sr-only">
        Ruang Kerja Editor
      </h1>

      <input
        id="proj-name"
        v-model="projectNameDraft"
        type="text"
        aria-label="Nama proyek"
        autocomplete="off"
        spellcheck="false"
        class="min-w-0 flex-1 sm:flex-none sm:w-56 h-8 bg-transparent font-semibold text-sm text-ink px-2 rounded-md hover:bg-black/5 focus:bg-card focus:outline-none focus:ring-2 focus:ring-hazard truncate"
        @change="commitProjectName"
        @keydown="onNameKeydown"
      >

      <div
        role="group"
        aria-label="Riwayat perubahan"
        class="flex items-center sm:ml-1"
      >
        <button
          type="button"
          class="tool text-ink/75! hover:bg-black/5! hover:text-ink! disabled:opacity-35"
          :disabled="!canUndo"
          :title="undoLabel ? `Urungkan: ${undoLabel} (Ctrl+Z)` : 'Urungkan (Ctrl+Z)'"
          aria-label="Urungkan"
          @mousedown.prevent
          @click="editor.undo()"
        >
          <UIcon
            name="i-lucide-undo-2"
            class="size-[18px]"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="tool text-ink/75! hover:bg-black/5! hover:text-ink! disabled:opacity-35"
          :disabled="!canRedo"
          :title="redoLabel ? `Ulangi: ${redoLabel} (Ctrl+Y)` : 'Ulangi (Ctrl+Y)'"
          aria-label="Ulangi"
          @mousedown.prevent
          @click="editor.redo()"
        >
          <UIcon
            name="i-lucide-redo-2"
            class="size-[18px]"
            aria-hidden="true"
          />
        </button>
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-testid="mobile-props-btn"
          class="lg:hidden btn-ghost px-2! sm:px-2.5!"
          :aria-pressed="!panels.isDesktop.value && panels.mobileSideOpen.value"
          title="Properti"
          aria-label="Properti"
          @click="panels.toggleSide()"
        >
          <UIcon
            name="i-lucide-sliders-horizontal"
            class="size-4 sm:hidden"
            aria-hidden="true"
          />
          <span class="max-sm:sr-only">Properti</span>
        </button>

        <button
          id="focus"
          type="button"
          data-testid="focus-mode-btn"
          class="hidden lg:grid tool text-ink/75! hover:bg-black/5! hover:text-ink! aria-pressed:bg-hazard! aria-pressed:text-ink!"
          :aria-pressed="panels.isFocusMode.value"
          title="Mode fokus: tutup semua panel (Ctrl+.)"
          aria-label="Mode fokus"
          @click="panels.toggleFocusMode()"
        >
          <UIcon
            name="i-lucide-maximize"
            class="size-[18px]"
            aria-hidden="true"
          />
        </button>

        <button
          id="theme"
          type="button"
          class="tool text-ink/75! hover:bg-black/5! hover:text-ink!"
          :aria-pressed="isLight"
          :title="isLight ? 'Ganti ke kanvas gelap' : 'Ganti ke kanvas terang'"
          aria-label="Ganti tema kanvas"
          @click="toggleCanvasTheme"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            class="size-[18px]"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
            />
            <path
              d="M12 4a8 8 0 0 1 0 16z"
              fill="currentColor"
            />
          </svg>
        </button>

        <button
          type="button"
          data-testid="shortcuts-btn"
          class="hidden sm:inline-flex btn-ghost px-0! w-8"
          title="Pintasan keyboard (?)"
          aria-label="Pintasan keyboard"
          @click="shortcutsOpen = true"
        >
          ?
        </button>

        <button
          id="save"
          type="button"
          class="hidden sm:inline-flex btn-ghost"
          title="Simpan sekarang (Ctrl+S)"
          @click="editor.flushSave()"
        >
          Simpan
        </button>

        <button
          type="button"
          class="btn-primary"
          @click="exportModalOpen = true"
        >
          Export
        </button>
      </div>
    </header>

    <div class="flex-1 flex min-h-0 overflow-hidden">
      <CadWorkspaceRail
        :active-cat="panels.activeCat.value"
        :lib-visible="panels.isLibVisible.value"
        :project="project"
        :active-tool="tool"
        :active-place-item="placeItemId"
        :warning-count="warnings.length"
        @select-category="panels.openCategory($event)"
        @toggle-lib="panels.toggleLib()"
        @close-mobile="panels.closeMobileSheets()"
        @select-tool="selectWorkspaceTool"
        @select-place="startPlaceItem($event, true)"
        @start-drag-place="onStartDragPlace($event)"
        @end-drag-place="onEndDragPlace()"
        @add-text-preset="handleAddTextPreset($event)"
        @start-place-note="handleStartPlaceNote()"
        @toggle-layer-visible="editor.setLayerVisible"
        @toggle-layer-lock="editor.setLayerLocked"
        @open-boq="handleOpenBoq"
      />

      <UContextMenu
        :items="contextMenuItems"
        :modal="false"
      >
        <main
          id="canvas"
          class="relative flex-1 flex min-w-0 min-h-0 overflow-hidden"
          aria-label="Kanvas gambar"
          :data-pinch-cancelled="singleTouchCancelledCount"
          @contextmenu="onCanvasContextMenu"
          @dragover="onCanvasDragOver"
          @drop="onCanvasDrop"
        >
          <CadCanvas
            ref="canvasRef"
            :project="project"
            :theme="theme"
            :view-box="viewport.viewBox.value"
            :selected-ids="selectedIds"
            :show-grid="viewport.showGrid.value"
            :grid-step="viewport.gridStep.value"
            :tool="viewport.isPanMode.value ? 'pan' : viewport.tool.value"
            :panning="viewport.isPanning.value"
            :cursor-world="viewport.cursorWorld.value"
            :cursor-inside="viewport.cursorInside.value"
            :px-per-mm="viewport.pxPerMm.value"
            :snap="activeSnap"
            :show-snap-marker="snapEnabled && !viewport.isPanMode.value"
            :cursor-measure-label="cursorMeasureLabel"
            :selection-box="boxDrag ? { start: boxDrag.start, end: boxDrag.end } : null"
            :ghost-nodes="ghostNodes"
            :draw-points="activeDrawPoints"
            :draw-guide-line="activeDrawGuideLine"
            :pen-stroke="penDrag?.pts ?? null"
            :warnings="warnings"
            :show-warning-labels="warnDrawerOpen"
          >
            <template #hud>
              <div
                v-if="activeHoveredWarning"
                id="tip"
                data-testid="warn-tooltip"
                role="tooltip"
                class="warn-tooltip"
                :style="{ left: `${activeHoveredWarning.left}px`, top: `${activeHoveredWarning.top}px` }"
              >
                <strong class="block text-[13px] font-semibold text-tip-red">{{ activeHoveredWarning.warning.msg }}</strong>
                <span class="block text-card/85 mt-0.5">{{ activeHoveredWarning.warning.detail }}</span>
                <span class="block mt-1 text-hazard text-[11px]">Klik untuk pilih komponennya</span>
              </div>

              <input
                v-if="inlineEdit"
                ref="inlineInputRef"
                v-model="inlineEdit.value"
                type="text"
                data-testid="inline-edit"
                :aria-label="inlineEdit.label"
                autocomplete="off"
                spellcheck="false"
                class="absolute z-30 w-56 h-[2.1rem] px-2.5 rounded-md bg-card text-ink font-semibold text-sm border-2 border-hazard outline-none shadow-[0_8px_24px_-6px_rgb(0_0_0/0.5)]"
                :style="{ left: `${inlineEdit.left}px`, top: `${inlineEdit.top}px` }"
                @pointerdown.stop
                @contextmenu.stop
                @keydown="onInlineEditKeydown"
                @blur="commitInlineEdit"
              >

              <CadOnboardingHint
                v-if="showOnboardingHint"
                @dismiss="dismissOnboarding"
                @open-elemen="dismissOnboarding(); panels.openCategory('elemen')"
                @start-duct="dismissOnboarding(); editor.setTool('duct')"
              />

              <CadSelectionToolbar
                v-if="selectionToolbarPos"
                :left="selectionToolbarPos.left"
                :top="selectionToolbarPos.top"
                :count="selectedNodes.length"
                :all-locked="allSelectedLocked"
                :grouped="selectionGrouped"
                :can-align="canAlignSelection"
                :single-node-type="singleSelectedNode?.type ?? null"
                :single-hosted="singleSelectedHosted"
                :single-text-style="singleSelectedTextStyle"
                @group="handleGroup"
                @ungroup="editor.ungroupSelected()"
                @align="handleAlign"
                @room-shape="handleRoomShape"
                @add-to-room="handleAddToRoom"
                @door-hinge="singleSelectedNode && editor.toggleDoorHinge(singleSelectedNode.id)"
                @door-swing="singleSelectedNode && editor.toggleDoorSwing(singleSelectedNode.id)"
                @detach-host="singleSelectedNode && editor.detachHostedOpening(singleSelectedNode.id)"
                @edit-text="openInlineEditForSelected()"
                @update-text-style="handleUpdateTextStyle($event)"
                @rotate="editor.rotateSelected(90, viewport.gridStep.value)"
                @mirror="editor.mirrorSelected()"
                @reorder="editor.reorderSelected($event)"
                @lock="editor.setSelectedLocked($event)"
                @duplicate="editor.duplicateSelected(viewport.gridStep.value)"
                @delete="handleDeleteSelected()"
              />

              <CadWarningDrawer
                :open="warnDrawerOpen"
                :warnings="warnings"
                @close="warnDrawerOpen = false"
                @select="selectWarning($event, { zoom: true })"
              />

              <CadPropertiesPanel
                :visible="sidePanelVisible"
                :show-reopen-tab="reopenSideVisible"
                :project="project"
                :selected-nodes="selectedNodes"
                :duct-spec="ductSpec"
                :show-duct-spec="showDuctSpecPanel"
                :warnings="singleSelectedWarnings"
                :penetration-count="singleSelectedPenetrationCount"
                :port-summaries="singleSelectedPortSummaries"
                :grouped="selectionGrouped"
                :can-align="canAlignSelection"
                :canvas-light="isLight"
                @close="panels.toggleSide()"
                @reopen="panels.toggleSide()"
                @update-prop="handleUpdateProp"
                @update-duct-spec="handleUpdateDuctSpec"
                @rotate="editor.rotateSelected($event, viewport.gridStep.value)"
                @mirror="editor.mirrorSelected()"
                @duplicate="editor.duplicateSelected(viewport.gridStep.value)"
                @delete="handleDeleteSelected()"
                @lock="editor.setSelectedLocked($event)"
                @group="handleGroup()"
                @ungroup="editor.ungroupSelected()"
                @align="handleAlign($event)"
                @flip-flow="editor.flipSelectedFlow()"
                @room-shape="handleRoomShape($event)"
                @detach-host="singleSelectedNode && editor.detachHostedOpening(singleSelectedNode.id)"
                @reset-elbow-reducing="editor.resetElbowReducing($event)"
              />

              <div
                id="viewbar"
                role="toolbar"
                aria-label="Tampilan"
                class="absolute right-3 bottom-3 z-16 flex items-center gap-0.5 p-1 rounded-[12px] bg-panel shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.06)]"
              >
                <button
                  type="button"
                  class="vb-btn"
                  :aria-pressed="viewport.tool.value === 'select'"
                  title="Pilih (V)"
                  aria-label="Pilih"
                  @mousedown.prevent
                  @click="viewport.setTool('select')"
                >
                  <UIcon
                    name="i-lucide-mouse-pointer-2"
                    class="size-[18px]"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="vb-btn"
                  :aria-pressed="viewport.tool.value === 'pan'"
                  title="Geser kanvas (H / Spasi)"
                  aria-label="Geser kanvas"
                  @mousedown.prevent
                  @click="viewport.setTool('pan')"
                >
                  <UIcon
                    name="i-lucide-hand"
                    class="size-[18px]"
                    aria-hidden="true"
                  />
                </button>
                <span class="cb-sep" />
                <button
                  type="button"
                  class="vb-btn"
                  title="Perkecil (-)"
                  aria-label="Perkecil"
                  @mousedown.prevent
                  @click="viewport.zoomOut()"
                >
                  <UIcon
                    name="i-lucide-minus"
                    class="size-4"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  data-testid="zoom-fit"
                  class="vb-btn w-14! font-mono text-xs"
                  title="Lihat semua (Shift+Z)"
                  :aria-label="`${viewport.zoomPercent.value}% · Lihat semua`"
                  @mousedown.prevent
                  @click="viewport.fit()"
                >
                  <strong>{{ viewport.zoomPercent.value }}%</strong>
                </button>
                <button
                  type="button"
                  class="vb-btn"
                  title="Perbesar (+)"
                  aria-label="Perbesar"
                  @mousedown.prevent
                  @click="viewport.zoomIn()"
                >
                  <UIcon
                    name="i-lucide-plus"
                    class="size-4"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <CadAiAssistant
                v-model:open="aiOpen"
                :get-project="() => project"
                :commit-draft="(label, fn) => editor.commit(label, fn)"
                :get-undo-count="() => editor.undoCount"
                :undo-last="() => editor.undo()"
                :focus-nodes="handleAiFocusNodes"
              />
            </template>
          </CadCanvas>
        </main>
      </UContextMenu>
    </div>

    <div
      id="scrim"
      data-testid="mobile-scrim"
      class="editor-scrim"
      :class="{ 'is-open': panels.showMobileScrim.value }"
      @click="panels.closeMobileSheets()"
    />

    <div
      id="sr"
      data-testid="sr-announce"
      class="sr-only"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ srAnnouncement }}
    </div>

    <CadCommandBar
      ref="cmdBarRef"
      :hint="commandHint"
      @submit="handleCommandSubmit"
    />

    <footer
      aria-label="Status kanvas"
      class="h-8 shrink-0 flex items-center gap-3 px-3 bg-ink text-card/80 text-xs font-mono whitespace-nowrap overflow-x-auto"
    >
      <span
        data-testid="coord"
        class="w-36 text-card"
      >
        {{ viewport.coordLabel.value }}
      </span>
      <span
        data-testid="grid-step"
        class="hidden sm:inline"
      >
        {{ viewport.gridStepLabel.value }}
      </span>
      <button
        type="button"
        class="sb-toggle"
        :aria-pressed="snapEnabled"
        title="Snap ke ujung, tengah, port, & grid (F3)"
        @click="editor.toggleSnap()"
      >
        SNAP
      </button>
      <button
        type="button"
        class="sb-toggle"
        :aria-pressed="effectiveOrtho"
        title="Garis lurus horizontal/vertikal (F8). Tahan Shift untuk sementara."
        @click="editor.toggleOrtho()"
      >
        ORTHO
      </button>
      <button
        type="button"
        class="sb-toggle"
        :aria-pressed="viewport.showGrid.value"
        title="Tampilkan grid (F7)"
        @click="viewport.toggleGrid()"
      >
        GRID
      </button>
      <span
        v-if="selectedIds.size > 0"
        data-testid="selection-count"
        class="text-hazard"
      >
        {{ selectedIds.size }} dipilih
      </span>
      <span class="text-card/75">
        EDITOR · ID {{ projectId }}
      </span>
      <span class="hidden md:inline">
        Duct <strong class="text-card">{{ project.unit }}</strong>
      </span>
      <span class="hidden md:inline">
        Skala <strong class="text-card">{{ project.scale }}</strong>
      </span>
      <span
        data-testid="save-status"
        role="status"
        aria-live="polite"
        class="ml-auto"
        :class="saveStatus === 'error' ? 'text-red-300' : 'text-card/80'"
        :title="saveError ?? undefined"
      >
        {{ saveStatusLabel }}
      </span>
      <button
        id="warn-btn"
        type="button"
        data-testid="warn-btn"
        aria-controls="warn-drawer"
        :aria-expanded="warnDrawerOpen"
        class="inline-flex items-center gap-1.5 min-h-6 px-1.5 rounded hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-hazard"
        :class="warnings.length > 0 ? 'text-red-300 hover:text-red-200' : 'text-green-300 hover:text-green-200'"
        title="Daftar warning validasi"
        @click="warnDrawerOpen = !warnDrawerOpen"
      >
        <span
          class="size-1.5 rounded-full shrink-0"
          :class="warnings.length > 0 ? 'bg-red-400' : 'bg-green-400'"
          aria-hidden="true"
        />
        <span>{{ warnings.length }} warning</span>
      </button>
    </footer>

    <CadShortcutsDialog v-model:open="shortcutsOpen" />

    <CadBoqDialog
      v-model:open="boqModalOpen"
      :project="project"
    />

    <CadExportDialog
      v-model:open="exportModalOpen"
      :project="project"
      :warning-count="warnings.length"
      @update-scale="handleExportScaleChange"
      @open-boq="handleOpenBoq"
    />
  </div>
</template>
