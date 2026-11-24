<script setup lang="ts">
import {
  DRAW_ORDER,
  PAL,
  connect,
  ctxOf,
  f1,
  layerOf,
  primToRenderItem,
  projectBounds,
  worldPrims,
  type Bounds,
  type LayerKey,
  type PaletteName,
  type Point,
  type Project,
  type SvgRenderItem,
} from '#shared/cad'

export interface LandingPin {
  readonly kind: 'feat' | 'warn'
  readonly pos: Point
  readonly index: number
  readonly active?: boolean
  readonly done?: boolean
}

const props = withDefaults(defineProps<{
  project: Project
  palette?: PaletteName
  layers?: ReadonlySet<LayerKey> | null
  viewBox?: Bounds | null
  pins?: readonly LandingPin[]
  pinRadius?: number
  preserveAspectRatio?: string
  ariaLabel?: string
  decorative?: boolean
}>(), {
  palette: 'screen',
  layers: null,
  viewBox: null,
  pins: () => [],
  pinRadius: 0,
  preserveAspectRatio: 'xMidYMid meet',
  ariaLabel: '',
  decorative: false,
})

const graph = computed(() => connect(props.project))
const ctx = computed(() => ctxOf(props.project, graph.value))

const defaultBounds = computed<Bounds>(() => {
  const b = projectBounds(props.project, ctx.value)
  const margin = ctx.value.th * 3
  return [
    b[0] - margin,
    b[1] - margin,
    b[2] - b[0] + 2 * margin,
    b[3] - b[1] + 2 * margin,
  ]
})

const activeVb = computed<Bounds>(() => props.viewBox ?? defaultBounds.value)
const strokeWidth = computed(() => defaultBounds.value[2] / 900)
const bgColor = computed(() => PAL[props.palette].bg)

const layeredItems = computed<Array<{ layer: LayerKey, items: SvgRenderItem[] }>>(() => {
  const buckets: Record<LayerKey, SvgRenderItem[]> = {
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
  const renderOpts = { pal: props.palette, sw: strokeWidth.value, live: false }

  for (const node of props.project.nodes) {
    const base = layerOf(node)
    for (const pr of worldPrims(node, ctx.value)) {
      const layer = pr.layer ?? base
      const visible = props.layers ? props.layers.has(layer) : props.project.layers[layer]?.on !== false
      if (!visible) continue
      const item = primToRenderItem(pr, layer, renderOpts)
      if (item) buckets[layer].push(item)
    }
  }

  return DRAW_ORDER.map(layer => ({ layer, items: buckets[layer] }))
})

const resolvedPinR = computed(() => props.pinRadius > 0 ? props.pinRadius : defaultBounds.value[2] / 58)
const resolvedPins = computed(() => {
  const r = resolvedPinR.value
  const ox = r * 1.5
  const oy = -r * 2.3
  return props.pins.map((pin) => {
    const qx = pin.pos[0] + ox
    const qy = pin.pos[1] + oy
    return {
      ...pin,
      r,
      px: f1(pin.pos[0]),
      py: f1(pin.pos[1]),
      qx: f1(qx),
      qy: f1(qy),
      checkPath: `M${f1(-r * 0.45)} 0l${f1(r * 0.32)} ${f1(r * 0.34)}l${f1(r * 0.6)} ${f1(-r * 0.7)}`,
    }
  })
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="activeVb.map(f1).join(' ')"
    :preserveAspectRatio="props.preserveAspectRatio"
    :role="props.decorative ? undefined : 'img'"
    :aria-label="props.decorative ? undefined : props.ariaLabel"
    :aria-hidden="props.decorative ? 'true' : undefined"
    class="w-full h-full block"
    font-family="'JetBrains Mono', ui-monospace, monospace"
  >
    <rect
      :x="f1(defaultBounds[0] - defaultBounds[2])"
      :y="f1(defaultBounds[1] - defaultBounds[3])"
      :width="f1(defaultBounds[2] * 3)"
      :height="f1(defaultBounds[3] * 3)"
      :fill="bgColor"
    />

    <g
      v-for="group in layeredItems"
      :key="group.layer"
      :data-layer="group.layer"
    >
      <template
        v-for="(item, idx) in group.items"
        :key="idx"
      >
        <path
          v-if="item.tag === 'path'"
          :d="item.d"
          :class="item.className"
          :stroke="item.stroke"
          :stroke-width="item.strokeWidth"
          :fill="item.fill"
          :fill-rule="item.fillRule"
          :stroke-dasharray="item.strokeDasharray"
        />
        <circle
          v-else-if="item.tag === 'circle'"
          :cx="item.cx"
          :cy="item.cy"
          :r="item.r"
          :class="item.className"
          :stroke="item.stroke"
          :stroke-width="item.strokeWidth"
          :fill="item.fill"
          :stroke-dasharray="item.strokeDasharray"
        />
        <text
          v-else
          :x="item.x"
          :y="item.y"
          :font-size="item.fontSize"
          :text-anchor="item.textAnchor"
          :fill="item.fill"
          :font-weight="item.fontWeight"
          :font-style="item.fontStyle"
          :text-decoration="item.textDecoration"
          :transform="item.transform"
        >{{ item.text }}</text>
      </template>
    </g>

    <g
      v-if="resolvedPins.length > 0"
      class="pins"
    >
      <g
        v-for="pin in resolvedPins"
        :key="pin.index"
        class="pin"
        :class="[pin.kind, { on: pin.active, done: pin.done }]"
        :data-pin-index="pin.index"
      >
        <path
          class="pin-lead"
          :d="`M${pin.px} ${pin.py}L${pin.qx} ${pin.qy}`"
          :stroke-width="f1(pin.r * 0.12)"
        />
        <circle
          class="pin-at"
          :cx="pin.px"
          :cy="pin.py"
          :r="f1(pin.r * 0.28)"
        />
        <g :transform="`translate(${pin.qx} ${pin.qy})`">
          <circle
            class="pin-halo"
            :r="f1(pin.r * 1.6)"
          />
          <circle
            class="pin-dot"
            :r="f1(pin.r)"
            :stroke-width="f1(pin.r * 0.16)"
          />
          <text
            class="pin-n"
            :y="f1(pin.r * 0.36)"
            :font-size="f1(pin.r * 1.05)"
            text-anchor="middle"
          >{{ pin.index + 1 }}</text>
          <path
            class="pin-ok"
            :d="pin.checkPath"
            fill="none"
            :stroke-width="f1(pin.r * 0.28)"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>
      </g>
    </g>
  </svg>
</template>
