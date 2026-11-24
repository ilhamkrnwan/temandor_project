<script setup lang="ts">
import {
  DRAW_ORDER,
  PAL,
  connect,
  ctxOf,
  f1,
  fitViewBox,
  isNodeLocked,
  layerOf,
  nodeBounds,
  nodeGrips,
  nodesBounds,
  projectBounds,
  ptsPath,
  worldPrims,
  type GripPoint,
  type LayerKey,
  type Node,
  type PaletteName,
  type Point,
  type Project,
  type SnapResult,
  type ValidationWarning,
  type ViewBox,
} from '../../../shared/cad'
import type { CanvasTheme } from '../../composables/useCanvasTheme'
import type { ViewportTool } from '../../composables/useViewport'

export interface SelectionBoxRect {
  start: Point
  end: Point
}

const props = withDefaults(defineProps<{
  project: Project
  theme?: CanvasTheme
  viewBox?: ViewBox | null
  selectedIds?: ReadonlySet<string>
  showGrid?: boolean
  gridStep?: number
  strokeWidth?: number
  live?: boolean
  tool?: ViewportTool
  panning?: boolean
  cursorWorld?: Point
  cursorInside?: boolean
  pxPerMm?: number
  snap?: SnapResult | null
  showSnapMarker?: boolean
  cursorMeasureLabel?: string | null
  selectionBox?: SelectionBoxRect | null
  ghostNodes?: readonly Node[]
  drawPoints?: readonly Point[]
  drawGuideLine?: readonly [Point, Point] | null
  penStroke?: readonly Point[] | null
  warnings?: readonly ValidationWarning[]
  showWarningLabels?: boolean
}>(), {
  theme: 'dark',
  viewBox: null,
  selectedIds: undefined,
  showGrid: true,
  gridStep: 100,
  strokeWidth: 1.4,
  live: true,
  tool: 'select',
  panning: false,
  cursorWorld: () => [0, 0] as Point,
  cursorInside: false,
  pxPerMm: 0.1,
  snap: null,
  showSnapMarker: false,
  cursorMeasureLabel: null,
  selectionBox: null,
  ghostNodes: () => [],
  drawPoints: () => [],
  drawGuideLine: null,
  penStroke: null,
  warnings: () => [],
  showWarningLabels: false,
})

const svgRef = ref<SVGSVGElement | null>(null)
defineExpose({ svgEl: svgRef })

const gridId = useId()
const g1Id = computed(() => `g1-${gridId}`)
const g2Id = computed(() => `g2-${gridId}`)

const isLight = computed(() => props.theme === 'light')
const palette = computed<PaletteName>(() => (isLight.value ? 'light' : 'screen'))

const connectionGraph = computed(() => connect(props.project))
const renderCtx = computed(() => ctxOf(props.project, connectionGraph.value))

const activeViewBox = computed<ViewBox>(() => {
  if (props.viewBox) return props.viewBox
  return fitViewBox(projectBounds(props.project, renderCtx.value))
})

const viewBoxAttr = computed(() => activeViewBox.value.map(f1).join(' '))

// Kelompokkan node ke tiap layer yang ditempati primitive-nya agar render mengikuti DRAW_ORDER
// namun tetap memakai satu komponen <CadNode> per (node, layer) untuk reaktivitas per node.
const nodesByLayer = computed<Record<LayerKey, Node[]>>(() => {
  const buckets: Record<LayerKey, Node[]> = {
    denah: [],
    arsi: [],
    kolom: [],
    bukaan: [],
    dim: [],
    hanger: [],
    eq: [],
    diff: [],
    sa: [],
    ea: [],
    coret: [],
  }
  const ctx = renderCtx.value
  for (const node of props.project.nodes) {
    const base = layerOf(node)
    const layersPresent = new Set<LayerKey>()
    for (const pr of worldPrims(node, ctx)) {
      layersPresent.add(pr.layer ?? base)
    }
    for (const layer of layersPresent) {
      buckets[layer].push(node)
    }
  }
  return buckets
})

const gridMinorStep = computed(() => Math.max(10, props.gridStep))
const gridMajorStep = computed(() => gridMinorStep.value * 5)
const gridMinorColor = computed(() => (isLight.value ? '#eceff3' : '#1c2127'))
const gridMajorColor = computed(() => (isLight.value ? '#dde2e8' : '#2a3038'))

const showCrosshair = computed(() => props.cursorInside && props.tool !== 'pan' && !props.panning)
const crosshairColor = computed(() => (isLight.value ? '#334155' : '#cbd5e1'))
const pickBoxColor = computed(() => (isLight.value ? '#334155' : '#e2e8f0'))
const highlightColor = computed(() => (isLight.value ? '#c2410c' : '#facc15'))
const warnLabelColor = computed(() => (isLight.value ? '#b91c1c' : '#fca5a5'))
const warnBangColor = computed(() => (isLight.value ? '#991b1b' : '#fecaca'))
const haloColor = computed(() => (isLight.value ? '#ffffff' : '#14171b'))
const mmPerPx = computed(() => 1 / (props.pxPerMm || 1))
const pickBoxHalf = computed(() => 5 * mmPerPx.value)
const snapHalf = computed(() => 7 * mmPerPx.value)

const activeSnapMarker = computed(() => {
  if (!props.showSnapMarker || !props.cursorInside || !props.snap) return null
  if (props.snap.kind === 'port' || props.snap.kind === 'end' || props.snap.kind === 'mid') {
    return props.snap
  }
  return null
})

const crosshairPos = computed<Point>(() => {
  if (props.snap && props.showSnapMarker && props.tool !== 'select') {
    return props.snap.p
  }
  return props.cursorWorld
})

const selectedNodes = computed(() => {
  if (!props.selectedIds || props.selectedIds.size === 0) return []
  return props.project.nodes.filter(n => props.selectedIds!.has(n.id))
})

const selectedPorts = computed(() => {
  if (!props.selectedIds || props.selectedIds.size === 0) return []
  const cn = connectionGraph.value
  return cn.all
    .filter(p => props.selectedIds!.has(p.node.id))
    .map(p => ({ pos: p.pos, connected: cn.link.has(p) }))
})

const multiSelectionFrame = computed(() => {
  if (props.tool !== 'select' || selectedNodes.value.length <= 1) return null
  const b = nodesBounds(selectedNodes.value, renderCtx.value)
  if (!b) return null
  const m = 6 * mmPerPx.value
  return {
    x: b[0] - m,
    y: b[1] - m,
    width: b[2] - b[0] + 2 * m,
    height: b[3] - b[1] + 2 * m,
  }
})

const lockedSelectedPositions = computed(() => {
  const out: Array<{ id: string, x: number, y: number }> = []
  for (const n of selectedNodes.value) {
    if (!n.lock) continue
    const b = nodeBounds(n, renderCtx.value)
    if (Number.isFinite(b[0])) {
      out.push({ id: n.id, x: b[0], y: b[1] - 16 * mmPerPx.value })
    }
  }
  return out
})

const selectionBoxGeom = computed(() => {
  if (!props.selectionBox) return null
  const { start, end } = props.selectionBox
  const mode = end[0] > start[0] ? 'window' : 'crossing'
  return {
    mode,
    x: Math.min(start[0], end[0]),
    y: Math.min(start[1], end[1]),
    width: Math.abs(end[0] - start[0]),
    height: Math.abs(end[1] - start[1]),
  }
})

const activeGrips = computed<Array<GripPoint & { title: string }>>(() => {
  if (props.tool !== 'select' || selectedNodes.value.length !== 1) return []
  const single = selectedNodes.value[0]!
  if (isNodeLocked(props.project, single)) return []
  return nodeGrips(single, props.project.unit).map(g => ({
    ...g,
    title: g.kind === 'edge'
      ? 'Seret: tarik sisi · klik ganda: tambah titik'
      : g.kind === 'size'
        ? 'Seret untuk ubah ukuran'
        : single.type === 'room'
          ? 'Seret: geser sudut · klik ganda: hapus titik'
          : 'Seret untuk ubah panjang/posisi',
  }))
})

const ghostEntries = computed<Array<{ key: string, node: Node, layer: LayerKey }>>(() => {
  if (!props.ghostNodes || props.ghostNodes.length === 0) return []
  const out: Array<{ key: string, node: Node, layer: LayerKey }> = []
  const ctx = renderCtx.value
  for (let i = 0; i < props.ghostNodes.length; i++) {
    const node = props.ghostNodes[i]!
    const base = layerOf(node)
    const layersPresent = new Set<LayerKey>()
    for (const pr of worldPrims(node, ctx)) {
      layersPresent.add(pr.layer ?? base)
    }
    for (const layer of layersPresent) {
      out.push({ key: `${i}-${node.id}-${layer}`, node, layer })
    }
  }
  return out
})
</script>

<template>
  <div
    data-testid="cad-canvas"
    class="cad-stage relative flex-1 min-w-0 min-h-0 overflow-hidden"
    :class="isLight ? 'cad-light bg-canvas-light' : 'bg-cad-ground'"
  >
    <svg
      id="cad"
      ref="svgRef"
      :viewBox="viewBoxAttr"
      :data-tool="tool"
      tabindex="0"
      role="application"
      aria-label="Kanvas gambar 2D Temandor"
      class="cad-svg absolute inset-0 w-full h-full select-none touch-none"
      :class="{ panning }"
      font-family="'JetBrains Mono', ui-monospace, monospace"
    >
      <defs>
        <pattern
          :id="g1Id"
          :width="gridMinorStep"
          :height="gridMinorStep"
          patternUnits="userSpaceOnUse"
        >
          <path
            :d="`M${gridMinorStep} 0H0V${gridMinorStep}`"
            fill="none"
            :stroke="gridMinorColor"
            stroke-width="1"
          />
        </pattern>
        <pattern
          :id="g2Id"
          :width="gridMajorStep"
          :height="gridMajorStep"
          patternUnits="userSpaceOnUse"
        >
          <rect
            :width="gridMajorStep"
            :height="gridMajorStep"
            :fill="`url(#${g1Id})`"
          />
          <path
            :d="`M${gridMajorStep} 0H0V${gridMajorStep}`"
            fill="none"
            :stroke="gridMajorColor"
            stroke-width="1"
          />
        </pattern>
      </defs>

      <rect
        v-if="showGrid"
        id="grid"
        x="-1000000"
        y="-1000000"
        width="2000000"
        height="2000000"
        :fill="`url(#${g2Id})`"
      />

      <g id="world">
        <g
          v-for="layerKey in DRAW_ORDER"
          :key="layerKey"
          :data-layer="layerKey"
          :class="{ lock: project.layers[layerKey]?.lock }"
        >
          <template v-if="project.layers[layerKey]?.on !== false">
            <CadNode
              v-for="node in nodesByLayer[layerKey]"
              :key="`${layerKey}-${node.id}`"
              :node="node"
              :layer="layerKey"
              :ctx="renderCtx"
              :palette="palette"
              :stroke-width="strokeWidth"
              :live="live"
              :selected="selectedIds?.has(node.id) ?? false"
            />
          </template>
        </g>
      </g>

      <g id="overlay">
        <slot name="overlay" />
        <g
          v-if="ghostEntries.length > 0"
          class="ghost"
          data-testid="drag-ghost"
        >
          <CadNode
            v-for="entry in ghostEntries"
            :key="entry.key"
            :node="entry.node"
            :layer="entry.layer"
            :ctx="renderCtx"
            :palette="palette"
            :stroke-width="strokeWidth"
            :live="false"
            :selected="false"
          />
        </g>
        <path
          v-if="penStroke && penStroke.length > 1"
          data-testid="pen-stroke"
          :d="ptsPath(penStroke)"
          :stroke="PAL[palette].col.coret"
          stroke-width="1.4"
          fill="none"
          stroke-linejoin="round"
        />
        <line
          v-if="drawGuideLine"
          data-testid="draw-guide"
          :x1="f1(drawGuideLine[0][0])"
          :y1="f1(drawGuideLine[0][1])"
          :x2="f1(drawGuideLine[1][0])"
          :y2="f1(drawGuideLine[1][1])"
          :stroke="highlightColor"
          stroke-width="1.4"
          stroke-dasharray="6 4"
        />
        <circle
          v-for="(pt, idx) in drawPoints"
          :key="`dp-${idx}`"
          data-testid="draw-point"
          :cx="f1(pt[0])"
          :cy="f1(pt[1])"
          :r="f1(3 * mmPerPx)"
          :fill="highlightColor"
        />
        <circle
          v-for="(port, idx) in selectedPorts"
          :key="`sp-${idx}`"
          :cx="f1(port.pos[0])"
          :cy="f1(port.pos[1])"
          :r="f1(4.5 * mmPerPx)"
          :fill="port.connected ? '#4ade80' : '#ef4444'"
          :stroke="haloColor"
          stroke-width="1"
        />
        <template
          v-for="grip in activeGrips"
          :key="`grip-${grip.id}`"
        >
          <circle
            v-if="grip.kind === 'edge'"
            :data-grip="grip.id"
            data-grip-kind="edge"
            :cx="f1(grip.world[0])"
            :cy="f1(grip.world[1])"
            :r="f1(4.5 * mmPerPx)"
            fill="#ffffff"
            stroke="#3b82f6"
            stroke-width="1"
            style="pointer-events: all; cursor: move"
          >
            <title>{{ grip.title }}</title>
          </circle>
          <rect
            v-else
            :data-grip="grip.id"
            :data-grip-kind="grip.kind"
            :x="f1(grip.world[0] - 5 * mmPerPx)"
            :y="f1(grip.world[1] - 5 * mmPerPx)"
            :width="f1(10 * mmPerPx)"
            :height="f1(10 * mmPerPx)"
            :fill="grip.kind === 'size' ? '#ffffff' : '#3b82f6'"
            :stroke="grip.kind === 'size' ? '#3b82f6' : '#dbeafe'"
            stroke-width="1"
            :style="{ pointerEvents: 'all', cursor: grip.kind === 'size' ? 'nwse-resize' : 'move' }"
          >
            <title>{{ grip.title }}</title>
          </rect>
        </template>
        <rect
          v-if="multiSelectionFrame"
          data-testid="selection-frame"
          :x="f1(multiSelectionFrame.x)"
          :y="f1(multiSelectionFrame.y)"
          :width="f1(multiSelectionFrame.width)"
          :height="f1(multiSelectionFrame.height)"
          fill="none"
          :stroke="highlightColor"
          stroke-dasharray="5 4"
          stroke-width="1"
        />
        <g
          v-for="lk in lockedSelectedPositions"
          :key="`lk-${lk.id}`"
          data-testid="lock-badge"
          :transform="`translate(${f1(lk.x)} ${f1(lk.y)}) scale(${f1(mmPerPx * 0.65)})`"
          fill="none"
          :stroke="highlightColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <rect
            x="4"
            y="11"
            width="16"
            height="10"
            rx="2"
          />
        </g>
        <g
          v-for="(w, idx) in warnings"
          :key="`warn-${idx}-${w.id}-${w.kind}`"
          :data-warn="idx"
          :data-warn-kind="w.kind"
          data-testid="warn-marker"
          :transform="`translate(${f1(w.pos[0])} ${f1(w.pos[1])})`"
          style="pointer-events: all; cursor: pointer"
        >
          <circle
            :r="f1(10 * mmPerPx)"
            fill="#ef444433"
            stroke="#ef4444"
            stroke-width="1.5"
            :class="{ 'warn-pulse': showWarningLabels }"
          />
          <text
            :y="f1(4 * mmPerPx)"
            :font-size="f1(12 * mmPerPx)"
            text-anchor="middle"
            :fill="warnBangColor"
            stroke="none"
            font-weight="700"
          >!</text>
          <text
            v-if="showWarningLabels"
            data-testid="warn-marker-label"
            :x="f1(14 * mmPerPx)"
            :y="f1(4 * mmPerPx)"
            :font-size="f1(11 * mmPerPx)"
            :fill="warnLabelColor"
            :stroke-width="f1(3 * mmPerPx)"
            font-weight="600"
          >{{ w.msg }}</text>
        </g>
        <rect
          v-if="selectionBoxGeom"
          data-testid="selection-box"
          :data-box-mode="selectionBoxGeom.mode"
          :x="f1(selectionBoxGeom.x)"
          :y="f1(selectionBoxGeom.y)"
          :width="f1(selectionBoxGeom.width)"
          :height="f1(selectionBoxGeom.height)"
          :fill="selectionBoxGeom.mode === 'window' ? '#3b82f622' : '#22c55e22'"
          :stroke="selectionBoxGeom.mode === 'window' ? '#60a5fa' : '#4ade80'"
          :stroke-dasharray="selectionBoxGeom.mode === 'window' ? undefined : '6 4'"
          stroke-width="1"
        />
        <g
          v-if="activeSnapMarker"
          data-testid="snap-marker"
          :data-snap-kind="activeSnapMarker.kind"
        >
          <path
            v-if="activeSnapMarker.kind === 'mid'"
            :d="`M${f1(activeSnapMarker.p[0])} ${f1(activeSnapMarker.p[1] - snapHalf * 1.15)}L${f1(activeSnapMarker.p[0] + snapHalf)} ${f1(activeSnapMarker.p[1] + snapHalf * 0.85)}H${f1(activeSnapMarker.p[0] - snapHalf)}Z`"
            fill="none"
            :stroke="highlightColor"
            stroke-width="2"
          />
          <rect
            v-else
            :x="f1(activeSnapMarker.p[0] - snapHalf)"
            :y="f1(activeSnapMarker.p[1] - snapHalf)"
            :width="f1(snapHalf * 2)"
            :height="f1(snapHalf * 2)"
            fill="none"
            :stroke="highlightColor"
            stroke-width="2"
          />
        </g>
        <text
          v-if="cursorMeasureLabel && cursorInside"
          data-testid="cursor-measure"
          :x="f1(cursorWorld[0] + 16 * mmPerPx)"
          :y="f1(cursorWorld[1] - 14 * mmPerPx)"
          :font-size="f1(12 * mmPerPx)"
          :fill="highlightColor"
          :stroke="haloColor"
          :stroke-width="f1(3 * mmPerPx)"
        >
          {{ cursorMeasureLabel }}
        </text>
        <g
          v-if="showCrosshair"
          data-testid="crosshair"
        >
          <path
            :d="`M${f1(activeViewBox[0] - activeViewBox[2])} ${f1(crosshairPos[1])}H${f1(activeViewBox[0] + activeViewBox[2] * 2)}M${f1(crosshairPos[0])} ${f1(activeViewBox[1] - activeViewBox[3])}V${f1(activeViewBox[1] + activeViewBox[3] * 2)}`"
            :stroke="crosshairColor"
            stroke-opacity="0.35"
            stroke-width="1"
            fill="none"
          />
          <rect
            v-if="tool === 'select'"
            :x="f1(crosshairPos[0] - pickBoxHalf)"
            :y="f1(crosshairPos[1] - pickBoxHalf)"
            :width="f1(pickBoxHalf * 2)"
            :height="f1(pickBoxHalf * 2)"
            fill="none"
            :stroke="pickBoxColor"
            stroke-width="1"
          />
        </g>
      </g>
    </svg>

    <svg
      width="44"
      height="44"
      viewBox="0 0 48 48"
      class="absolute left-3 bottom-3 w-11 h-11 pointer-events-none"
      fill="none"
      :stroke="isLight ? '#64748b' : '#7d8692'"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M8 40V8M8 40H40M4 13l4-6 4 6M35 36l6 4-6 4" />
      <text
        x="14"
        y="12"
        :fill="isLight ? '#64748b' : '#7d8692'"
        stroke="none"
        font-size="10"
        font-family="JetBrains Mono, monospace"
      >Y</text>
      <text
        x="36"
        y="32"
        :fill="isLight ? '#64748b' : '#7d8692'"
        stroke="none"
        font-size="10"
        font-family="JetBrains Mono, monospace"
      >X</text>
    </svg>

    <slot name="hud" />
  </div>
</template>
