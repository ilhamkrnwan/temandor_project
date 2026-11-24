<script setup lang="ts">
import {
  layerOf,
  primToRenderItem,
  worldPrims,
  type LayerKey,
  type Node,
  type PaletteName,
  type RenderCtx,
  type SvgRenderItem,
} from '../../../shared/cad'

const props = withDefaults(defineProps<{
  node: Node
  layer: LayerKey
  ctx: RenderCtx
  palette: PaletteName
  strokeWidth: number
  live?: boolean
  selected?: boolean
}>(), {
  live: true,
  selected: false,
})

const items = computed<SvgRenderItem[]>(() => {
  const base = layerOf(props.node)
  const opts = { pal: props.palette, sw: props.strokeWidth, live: props.live }
  const out: SvgRenderItem[] = []
  for (const pr of worldPrims(props.node, props.ctx)) {
    const targetLayer = pr.layer ?? base
    if (targetLayer !== props.layer) continue
    const item = primToRenderItem(pr, targetLayer, opts)
    if (item) out.push(item)
  }
  return out
})
</script>

<template>
  <g
    v-if="items.length > 0"
    :data-id="node.id"
    :class="{ sel: selected }"
  >
    <template
      v-for="(item, index) in items"
      :key="index"
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
        v-else-if="item.tag === 'text'"
        :x="item.x"
        :y="item.y"
        :font-size="item.fontSize"
        :text-anchor="item.textAnchor"
        :fill="item.fill"
        :font-weight="item.fontWeight"
        :font-style="item.fontStyle"
        :text-decoration="item.textDecoration"
        :transform="item.transform"
      >
        {{ item.text }}
      </text>
    </template>
  </g>
</template>
