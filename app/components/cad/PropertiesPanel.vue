<script setup lang="ts">
import {
  ALIGN_PROPERTY_OPTIONS,
  LAYERS,
  PAL,
  PROPERTY_FIELD_META,
  ROOM_SHAPES,
  SHAPE_OPTIONS,
  SYSTEM_OPTIONS,
  TEXT_COLOR_OPTIONS,
  TEXT_STYLE_FLAGS,
  componentOf,
  formatPropNumber,
  isHostedOpening,
  isLayerLocked,
  layerOf,
  visibleFieldsForNode,
  type AlignDirection,
  type DuctSpec,
  type Node,
  type NodePropKey,
  type NodePortSummary,
  type Project,
  type PropertyFieldId,
  type RoomShapeKey,
  type TextColor,
  type ValidationWarning,
} from '../../../shared/cad'
import { getComponentIconUrl } from '../../utils/componentIcons'

const LAYER_LABELS = Object.fromEntries(LAYERS.map(l => [l.key, l.name]))
const ROOM_SHAPE_KEYS = Object.keys(ROOM_SHAPES) as RoomShapeKey[]

const props = withDefaults(defineProps<{
  visible: boolean
  showReopenTab: boolean
  project: Project
  selectedNodes: readonly Node[]
  ductSpec: DuctSpec
  showDuctSpec?: boolean
  warnings?: readonly ValidationWarning[]
  penetrationCount?: number
  portSummaries?: readonly NodePortSummary[]
  grouped?: boolean
  canAlign?: boolean
  canvasLight?: boolean
}>(), {
  showDuctSpec: false,
  warnings: () => [],
  penetrationCount: 0,
  portSummaries: () => [],
  grouped: false,
  canAlign: false,
  canvasLight: false,
})

const emit = defineEmits<{
  close: []
  reopen: []
  updateProp: [key: NodePropKey, value: unknown]
  updateDuctSpec: [key: 'sys' | 'shape' | 'w' | 'h' | 'elev', value: unknown]
  rotate: [delta: number]
  mirror: []
  duplicate: []
  delete: []
  lock: [locked: boolean]
  group: []
  ungroup: []
  align: [direction: AlignDirection]
  flipFlow: []
  roomShape: [shape: RoomShapeKey]
  detachHost: []
  resetElbowReducing: [nodeId: string]
}>()

const singleNode = computed<Node | null>(() => (
  props.selectedNodes.length === 1 ? props.selectedNodes[0]! : null
))

const singleDef = computed(() => (singleNode.value ? componentOf(singleNode.value.type) : null))
const singleLayer = computed(() => (singleNode.value ? layerOf(singleNode.value) : null))
const singleLayerLabel = computed(() => (singleLayer.value ? (LAYER_LABELS[singleLayer.value] ?? singleLayer.value) : ''))
const singleIconUrl = computed(() => getComponentIconUrl(singleDef.value?.icon))

const singleLayerLocked = computed(() => Boolean(singleNode.value && isLayerLocked(props.project, singleNode.value)))
const singleNodeLocked = computed(() => Boolean(singleNode.value?.lock))
const singleDisabled = computed(() => singleLayerLocked.value || singleNodeLocked.value)

const singleHostRoomName = computed<string | null>(() => {
  const n = singleNode.value
  if (!n || !isHostedOpening(n) || !n.host) return null
  const room = props.project.nodes.find(m => m.id === n.host!.id)
  return room && room.type === 'room' ? room.name : null
})

const singleFields = computed<PropertyFieldId[]>(() => (
  singleNode.value ? visibleFieldsForNode(singleNode.value) : []
))

const allMultiLocked = computed(() => (
  props.selectedNodes.length > 1 && props.selectedNodes.every(n => Boolean(n.lock))
))

const multiWithSys = computed(() => props.selectedNodes.filter((n): n is Extract<Node, { sys: 'SA' | 'EA' }> => 'sys' in n))
const multiSharedSys = computed<'SA' | 'EA' | ''>(() => {
  if (multiWithSys.value.length === 0) return ''
  const first = multiWithSys.value[0]!.sys
  return multiWithSys.value.every(n => n.sys === first) ? first : ''
})

function rawNodeProp(node: Node, key: NodePropKey): unknown {
  if (key === 'rot') return node.rot || 0
  return (node as unknown as Record<string, unknown>)[key]
}

function numPropDisplay(node: Node, key: NodePropKey): string {
  const raw = rawNodeProp(node, key)
  if ((key === 'w2' || key === 'h2') && raw == null && node.type === 'elbow') {
    return formatPropNumber(key === 'w2' ? node.w : node.h)
  }
  return formatPropNumber(Number(raw ?? 0))
}

function stringProp(node: Node, key: NodePropKey): string {
  return String(rawNodeProp(node, key) ?? '')
}

function boolProp(node: Node, key: NodePropKey): boolean {
  const v = rawNodeProp(node, key)
  if (key === 'dims') return v !== false
  return Boolean(v)
}

function isRoundDuct(node: Node): boolean {
  return 'shape' in node && node.shape === 'round'
}

function showShapeToggleForField(node: Node, fieldId: PropertyFieldId): boolean {
  return fieldId === 'size' && 'shape' in node && Boolean(componentOf(node.type).duct)
}

function swatchBg(col: TextColor): string {
  if (!col) return 'transparent'
  return PAL[props.canvasLight ? 'paper' : 'screen'].pick[col]
}

function onInputEnter(e: Event) {
  ;(e.target as HTMLInputElement | null)?.blur()
}

function onNumPropChange(key: NodePropKey, e: Event) {
  const input = e.target as HTMLInputElement
  emit('updateProp', key, input.value)
  nextTick(() => {
    if (singleNode.value) {
      input.value = numPropDisplay(singleNode.value, key)
    }
  })
}

function onTextPropChange(key: NodePropKey, e: Event) {
  const input = e.target as HTMLInputElement
  emit('updateProp', key, input.value)
}

function onSpecNumChange(key: 'w' | 'h' | 'elev', e: Event) {
  const input = e.target as HTMLInputElement
  emit('updateDuctSpec', key, input.value)
  nextTick(() => {
    input.value = formatPropNumber(props.ductSpec[key] ?? (key === 'elev' ? 2700 : 0))
  })
}

function unitForNumField(unit: 'mm' | 'flow'): string {
  return unit === 'flow' ? (props.project.fu || 'cfm') : 'mm'
}
</script>

<template>
  <button
    v-if="props.showReopenTab"
    id="show-side"
    type="button"
    data-testid="reopen-side"
    class="editor-side-tab"
    title="Buka properti (Ctrl+])"
    aria-label="Buka properti"
    @pointerdown.stop
    @click="emit('reopen')"
  >
    <UIcon
      name="i-lucide-chevrons-left"
      class="size-4"
      aria-hidden="true"
    />
  </button>

  <aside
    id="side"
    data-testid="workspace-side"
    aria-label="Properti"
    class="editor-side"
    :class="{ 'is-hidden': !props.visible }"
    @pointerdown.stop
    @contextmenu.stop
  >
    <div class="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line shrink-0">
      <span class="field-label mb-0!">Properti</span>
      <button
        type="button"
        class="panel-x grid"
        title="Tutup panel (Ctrl+])"
        aria-label="Tutup properti"
        @click="emit('close')"
      >
        <UIcon
          name="i-lucide-x"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </div>

    <section
      id="props"
      class="p-4 overflow-y-auto space-y-4 text-sm min-h-0"
    >
      <!-- Mode 1: Ukuran duct baru saat menggambar duct atau menaruh komponen duct -->
      <template v-if="!singleNode && props.selectedNodes.length === 0 && props.showDuctSpec">
        <div
          data-testid="props-duct-spec"
          class="space-y-4"
        >
          <h3 class="field-label text-ink! text-xs! mb-0!">
            Ukuran duct baru
          </h3>

          <div>
            <span class="field-label">Sistem</span>
            <div class="seg">
              <label
                v-for="opt in SYSTEM_OPTIONS"
                :key="opt.value"
              >
                <input
                  type="radio"
                  name="spec-sys"
                  :value="opt.value"
                  :checked="props.ductSpec.sys === opt.value"
                  @change="emit('updateDuctSpec', 'sys', opt.value)"
                >
                {{ opt.label }}
              </label>
            </div>
          </div>

          <div>
            <span class="field-label">Ukuran ({{ props.project.unit }})</span>
            <div class="seg">
              <label
                v-for="opt in SHAPE_OPTIONS"
                :key="opt.value"
              >
                <input
                  type="radio"
                  name="spec-shape"
                  :value="opt.value"
                  :checked="props.ductSpec.shape === opt.value"
                  @change="emit('updateDuctSpec', 'shape', opt.value)"
                >
                {{ opt.label }}
              </label>
            </div>
            <div class="flex items-center gap-1.5 mt-1.5">
              <div class="field-unit flex-1 min-w-0">
                <input
                  type="text"
                  inputmode="decimal"
                  data-testid="spec-w"
                  :aria-label="props.ductSpec.shape === 'round' ? 'Diameter duct baru' : 'Lebar duct baru'"
                  :value="formatPropNumber(props.ductSpec.w)"
                  @change="onSpecNumChange('w', $event)"
                  @keydown.enter.prevent="onInputEnter"
                >
                <span>{{ props.ductSpec.shape === 'round' ? 'Ø' : 'W' }}</span>
              </div>
              <template v-if="props.ductSpec.shape !== 'round'">
                <span class="text-muted text-xs">×</span>
                <div class="field-unit flex-1 min-w-0">
                  <input
                    type="text"
                    inputmode="decimal"
                    data-testid="spec-h"
                    aria-label="Tinggi duct baru"
                    :value="formatPropNumber(props.ductSpec.h)"
                    @change="onSpecNumChange('h', $event)"
                    @keydown.enter.prevent="onInputEnter"
                  >
                  <span>H</span>
                </div>
              </template>
            </div>
          </div>

          <div>
            <span class="field-label">Elevasi dasar duct (BOD)</span>
            <div class="field-unit">
              <input
                type="text"
                inputmode="decimal"
                data-testid="spec-elev"
                aria-label="Elevasi dasar duct baru"
                :value="formatPropNumber(props.ductSpec.elev ?? 2700)"
                @change="onSpecNumChange('elev', $event)"
                @keydown.enter.prevent="onInputEnter"
              >
              <span>mm</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Mode 2: Multi-select -->
      <template v-else-if="props.selectedNodes.length > 1">
        <div
          data-testid="props-multi"
          class="space-y-4"
        >
          <h3 class="field-label text-ink! text-xs! mb-0!">
            {{ props.grouped ? `Group · ${props.selectedNodes.length} komponen` : `${props.selectedNodes.length} komponen dipilih` }}
          </h3>

          <button
            v-if="allMultiLocked"
            type="button"
            class="btn-ghost w-full"
            @click="emit('lock', false)"
          >
            Buka kunci semua
          </button>

          <template v-else>
            <button
              v-if="props.grouped"
              type="button"
              class="btn-ghost w-full"
              title="Ctrl+Shift+G"
              @click="emit('ungroup')"
            >
              Ungroup
            </button>
            <button
              v-else
              type="button"
              class="btn-primary w-full"
              title="Ctrl+G"
              @click="emit('group')"
            >
              Group
            </button>

            <div v-if="props.canAlign">
              <span class="field-label">Rata</span>
              <div class="grid grid-cols-6 gap-1">
                <button
                  v-for="item in ALIGN_PROPERTY_OPTIONS"
                  :key="item.direction"
                  type="button"
                  class="btn-ghost px-0!"
                  :data-testid="`prop-align-${item.direction}`"
                  :title="item.label"
                  :aria-label="item.label"
                  @click="emit('align', item.direction)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="size-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    aria-hidden="true"
                  >
                    <path :d="item.path" />
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="multiWithSys.length > 0">
              <span class="field-label">Sistem (semua)</span>
              <div class="seg">
                <label
                  v-for="opt in SYSTEM_OPTIONS"
                  :key="opt.value"
                >
                  <input
                    type="radio"
                    name="multi-sys"
                    :value="opt.value"
                    :checked="multiSharedSys === opt.value"
                    @change="emit('updateProp', 'sys', opt.value)"
                  >
                  {{ opt.label }}
                </label>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="btn-ghost"
                title="Putar kiri 90°"
                @click="emit('rotate', -90)"
              >
                ⟲ Putar
              </button>
              <button
                type="button"
                class="btn-ghost"
                title="Putar kanan 90° (R)"
                @click="emit('rotate', 90)"
              >
                ⟳ Putar
              </button>
              <button
                type="button"
                class="btn-ghost"
                title="Ctrl+D"
                @click="emit('duplicate')"
              >
                Duplikat
              </button>
              <button
                type="button"
                class="btn-ghost text-danger!"
                title="Delete"
                @click="emit('delete')"
              >
                Hapus
              </button>
              <button
                type="button"
                class="btn-ghost col-span-2"
                @click="emit('lock', true)"
              >
                Kunci
              </button>
            </div>

            <button
              type="button"
              class="btn-ghost w-full"
              @click="emit('mirror')"
            >
              ⇋ Cermin (M)
            </button>
          </template>
        </div>
      </template>

      <!-- Mode 3: Single-select -->
      <template v-else-if="singleNode && singleDef">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg bg-card ring-1 ring-line grid place-items-center shrink-0">
            <img
              v-if="singleIconUrl"
              :src="singleIconUrl"
              alt=""
              class="size-7"
            >
            <span
              v-else-if="singleLayer"
              class="sw size-4!"
              :style="{ background: PAL.screen.col[singleLayer] }"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-ink truncate">
              {{ singleDef.name }}
            </div>
            <div class="font-mono text-xs text-muted truncate">
              {{ singleLayerLabel }}
            </div>
          </div>
        </div>

        <div
          v-for="(w, idx) in props.warnings"
          :key="`pw-${idx}-${w.kind}`"
          data-testid="prop-warning"
          :data-warn-kind="w.kind"
          class="p-2.5 rounded-lg bg-error-wash ring-1 ring-red-200 text-xs text-error-ink leading-relaxed"
        >
          <strong class="block font-semibold">! {{ w.msg }}</strong>
          <span>{{ w.detail }}</span>
        </div>

        <p
          v-if="singleLayerLocked"
          class="p-2.5 rounded-lg bg-hazard/20 text-xs text-ink"
        >
          Layer terkunci. Buka kunci di panel Layer untuk mengubah.
        </p>
        <div
          v-else-if="singleNodeLocked"
          class="p-2.5 rounded-lg bg-hazard/20 text-xs text-ink flex items-center gap-2"
        >
          <span class="flex-1">Terkunci, tidak bisa digeser.</span>
          <button
            type="button"
            class="btn-ghost h-7! px-2!"
            @click="emit('lock', false)"
          >
            Buka kunci
          </button>
        </div>

        <p
          v-if="singleHostRoomName"
          class="text-xs text-muted leading-relaxed"
        >
          Menempel di dinding <strong class="text-ink">{{ singleHostRoomName }}</strong>. Seret untuk geser sepanjang dinding.
        </p>

        <p
          v-if="props.penetrationCount > 0"
          data-testid="prop-penetration"
          class="text-xs text-muted leading-relaxed"
        >
          Menembus dinding di {{ props.penetrationCount }} titik (perlu bobokan, ditandai kotak di gambar).
        </p>

        <fieldset
          :disabled="singleDisabled"
          class="space-y-4 min-w-0 disabled:opacity-60"
        >
          <template
            v-for="fieldId in singleFields"
            :key="`${singleNode.id}-${fieldId}`"
          >
            <!-- Sistem SA/EA -->
            <div v-if="PROPERTY_FIELD_META[fieldId].kind === 'sys'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <div class="seg">
                <label
                  v-for="opt in SYSTEM_OPTIONS"
                  :key="opt.value"
                >
                  <input
                    type="radio"
                    :name="`prop-sys-${singleNode.id}`"
                    :data-testid="`prop-sys-${opt.value}`"
                    :value="opt.value"
                    :checked="stringProp(singleNode, 'sys') === opt.value"
                    @change="emit('updateProp', 'sys', opt.value)"
                  >
                  {{ opt.label }}
                </label>
              </div>
            </div>

            <!-- Ukuran duct (kotak/bulat + W x H atau Ø) -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'size'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }} ({{ props.project.unit }})</span>
              <div
                v-if="showShapeToggleForField(singleNode, fieldId)"
                class="seg mb-1.5"
              >
                <label
                  v-for="opt in SHAPE_OPTIONS"
                  :key="opt.value"
                >
                  <input
                    type="radio"
                    :name="`prop-shape-${singleNode.id}`"
                    :data-testid="`prop-shape-${opt.value}`"
                    :value="opt.value"
                    :checked="stringProp(singleNode, 'shape') === opt.value"
                    @change="emit('updateProp', 'shape', opt.value)"
                  >
                  {{ opt.label }}
                </label>
              </div>

              <div class="flex items-center gap-1.5">
                <div class="field-unit flex-1 min-w-0">
                  <input
                    type="text"
                    inputmode="decimal"
                    :data-testid="`prop-${PROPERTY_FIELD_META[fieldId].keys[0]}`"
                    :aria-label="`${PROPERTY_FIELD_META[fieldId].label} ${isRoundDuct(singleNode) ? 'diameter' : 'lebar'}`"
                    :value="numPropDisplay(singleNode, PROPERTY_FIELD_META[fieldId].keys[0])"
                    @change="onNumPropChange(PROPERTY_FIELD_META[fieldId].keys[0], $event)"
                    @keydown.enter.prevent="onInputEnter"
                  >
                  <span>{{ isRoundDuct(singleNode) ? 'Ø' : 'W' }}</span>
                </div>
                <template v-if="!isRoundDuct(singleNode)">
                  <span class="text-muted text-xs">×</span>
                  <div class="field-unit flex-1 min-w-0">
                    <input
                      type="text"
                      inputmode="decimal"
                      :data-testid="`prop-${PROPERTY_FIELD_META[fieldId].keys[1]}`"
                      :aria-label="`${PROPERTY_FIELD_META[fieldId].label} tinggi`"
                      :value="numPropDisplay(singleNode, PROPERTY_FIELD_META[fieldId].keys[1])"
                      @change="onNumPropChange(PROPERTY_FIELD_META[fieldId].keys[1], $event)"
                      @keydown.enter.prevent="onInputEnter"
                    >
                    <span>H</span>
                  </div>
                </template>
              </div>

              <template v-if="singleNode.type === 'elbow' && fieldId === 'size2'">
                <p class="hint">
                  {{ singleNode.w2 == null ? 'Sama dengan ujung a. Isi ukuran lain untuk elbow mengecil (reducing).' : 'Elbow mengecil: satu potong, tidak perlu transisi.' }}
                </p>
                <button
                  v-if="singleNode.w2 != null"
                  type="button"
                  data-testid="elbow-reset-reducing"
                  class="btn-ghost mt-1.5 h-7! text-xs! w-full"
                  @click="emit('resetElbowReducing', singleNode.id)"
                >
                  Samakan dengan ujung a
                </button>
              </template>
            </div>

            <!-- Sudut elbow + chips + tombol Balik -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'ang'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <div class="flex gap-1.5">
                <div class="field-unit flex-1 min-w-0">
                  <input
                    type="text"
                    inputmode="decimal"
                    data-testid="prop-angle"
                    aria-label="Sudut belok elbow"
                    :value="numPropDisplay(singleNode, 'angle')"
                    @change="onNumPropChange('angle', $event)"
                    @keydown.enter.prevent="onInputEnter"
                  >
                  <span>°</span>
                </div>
                <button
                  v-if="singleDef.mirror"
                  type="button"
                  class="btn-ghost shrink-0 px-2.5!"
                  title="Belok ke sisi lain (M)"
                  @click="emit('mirror')"
                >
                  ⇋ Balik
                </button>
              </div>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <button
                  v-for="ang in PROPERTY_FIELD_META[fieldId].presets"
                  :key="ang"
                  type="button"
                  class="chip h-7! px-2.5! text-xs!"
                  :data-testid="`prop-angle-chip-${ang}`"
                  :aria-pressed="Number(rawNodeProp(singleNode, 'angle')) === ang"
                  @click="emit('updateProp', 'angle', ang)"
                >
                  {{ formatPropNumber(ang) }}°
                </button>
              </div>
            </div>

            <!-- Segmented option -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'opt'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <div class="seg">
                <label
                  v-for="opt in PROPERTY_FIELD_META[fieldId].options"
                  :key="opt.value"
                >
                  <input
                    type="radio"
                    :name="`prop-${PROPERTY_FIELD_META[fieldId].key}-${singleNode.id}`"
                    :data-testid="`prop-${PROPERTY_FIELD_META[fieldId].key}-${opt.value}`"
                    :value="opt.value"
                    :checked="stringProp(singleNode, PROPERTY_FIELD_META[fieldId].key) === opt.value"
                    @change="emit('updateProp', PROPERTY_FIELD_META[fieldId].key, opt.value)"
                  >
                  {{ opt.label }}
                </label>
              </div>
            </div>

            <!-- Warna teks (swatch) -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'col'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <div
                class="flex gap-1.5"
                role="radiogroup"
                aria-label="Warna teks"
              >
                <label
                  v-for="opt in TEXT_COLOR_OPTIONS"
                  :key="opt.value || 'layer'"
                  class="swatch"
                  :title="opt.label"
                >
                  <input
                    type="radio"
                    :name="`prop-col-${singleNode.id}`"
                    :data-testid="`prop-col-${opt.value || 'default'}`"
                    :value="opt.value"
                    :checked="stringProp(singleNode, 'col') === opt.value"
                    :aria-label="opt.label"
                    @change="emit('updateProp', 'col', opt.value)"
                  >
                  <span :style="{ background: swatchBg(opt.value) }">
                    <svg
                      v-if="!opt.value"
                      viewBox="0 0 24 24"
                      class="size-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path d="M5 19 19 5" />
                    </svg>
                  </span>
                </label>
              </div>
            </div>

            <!-- Gaya teks (B / I / U / A) -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'sty'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <div class="flex gap-1.5">
                <label
                  v-for="flag in TEXT_STYLE_FLAGS"
                  :key="flag.key"
                  class="sty"
                  :title="flag.label"
                >
                  <input
                    type="checkbox"
                    :data-testid="`prop-sty-${flag.key}`"
                    :checked="boolProp(singleNode, flag.key)"
                    :aria-label="flag.label"
                    @change="emit('updateProp', flag.key, ($event.target as HTMLInputElement).checked)"
                  >
                  <strong v-if="flag.key === 'b'">B</strong>
                  <em
                    v-else-if="flag.key === 'it'"
                    class="font-serif"
                  >I</em>
                  <span
                    v-else-if="flag.key === 'ul'"
                    class="underline"
                  >U</span>
                  <span
                    v-else
                    class="inline-block px-1 ring-1 ring-current rounded-sm leading-tight text-xs"
                  >A</span>
                </label>
              </div>
            </div>

            <!-- Input angka desimal -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'num'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <div class="field-unit">
                <input
                  type="text"
                  inputmode="decimal"
                  :data-testid="`prop-${PROPERTY_FIELD_META[fieldId].key}`"
                  :aria-label="PROPERTY_FIELD_META[fieldId].label"
                  :value="numPropDisplay(singleNode, PROPERTY_FIELD_META[fieldId].key)"
                  @change="onNumPropChange(PROPERTY_FIELD_META[fieldId].key, $event)"
                  @keydown.enter.prevent="onInputEnter"
                >
                <span>{{ unitForNumField(PROPERTY_FIELD_META[fieldId].unit) }}</span>
              </div>
            </div>

            <!-- Checkbox (ukuran otomatis ruangan) -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'chk'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <label class="flex items-center gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  :data-testid="`prop-${PROPERTY_FIELD_META[fieldId].key}`"
                  class="accent-ink size-4"
                  :checked="boolProp(singleNode, PROPERTY_FIELD_META[fieldId].key)"
                  @change="emit('updateProp', PROPERTY_FIELD_META[fieldId].key, ($event.target as HTMLInputElement).checked)"
                >
                {{ PROPERTY_FIELD_META[fieldId].checkLabel }}
              </label>
            </div>

            <!-- Input teks -->
            <div v-else-if="PROPERTY_FIELD_META[fieldId].kind === 'text'">
              <span class="field-label">{{ PROPERTY_FIELD_META[fieldId].label }}</span>
              <input
                type="text"
                class="field"
                :data-testid="`prop-${PROPERTY_FIELD_META[fieldId].key}`"
                :aria-label="PROPERTY_FIELD_META[fieldId].label"
                :value="stringProp(singleNode, PROPERTY_FIELD_META[fieldId].key)"
                @change="onTextPropChange(PROPERTY_FIELD_META[fieldId].key, $event)"
                @keydown.enter.prevent="onInputEnter"
              >
            </div>
          </template>

          <!-- Rotasi (sembunyikan untuk pintu/jendela yang menempel di dinding) -->
          <div v-if="!singleHostRoomName">
            <span class="field-label">Rotasi</span>
            <div class="flex gap-1.5">
              <button
                type="button"
                class="btn-ghost px-2.5!"
                title="Putar kiri 90°"
                aria-label="Putar kiri 90 derajat"
                @click="emit('rotate', -90)"
              >
                ⟲
              </button>
              <div class="field-unit flex-1 min-w-0">
                <input
                  type="text"
                  inputmode="decimal"
                  data-testid="prop-rot"
                  aria-label="Sudut rotasi"
                  :value="numPropDisplay(singleNode, 'rot')"
                  @change="onNumPropChange('rot', $event)"
                  @keydown.enter.prevent="onInputEnter"
                >
                <span>°</span>
              </div>
              <button
                type="button"
                class="btn-ghost px-2.5!"
                title="Putar kanan 90° (R)"
                aria-label="Putar kanan 90 derajat"
                @click="emit('rotate', 90)"
              >
                ⟳
              </button>
            </div>
          </div>

          <!-- Balik arah aliran untuk duct lurus -->
          <button
            v-if="singleNode.type === 'straight'"
            type="button"
            data-testid="prop-flip"
            class="btn-ghost w-full"
            @click="emit('flipFlow')"
          >
            ⇄ Balik arah aliran
          </button>

          <!-- Daftar status sambungan port -->
          <div v-if="props.portSummaries.length > 0">
            <span class="field-label">Sambungan</span>
            <ul class="space-y-1">
              <li
                v-for="p in props.portSummaries"
                :key="p.id"
                data-testid="prop-port-row"
                class="port-row"
              >
                <span
                  class="size-2 rounded-full shrink-0"
                  :class="p.connected ? 'bg-done-green' : p.optional ? 'bg-line-strong' : 'bg-warn-red'"
                  aria-hidden="true"
                />
                <strong class="font-mono text-ink">{{ p.id }}</strong>
                <span class="text-muted truncate">{{ p.statusText }}</span>
                <span
                  v-if="p.sizeText"
                  class="ml-auto font-mono text-ink shrink-0"
                >
                  {{ p.sizeText }}
                </span>
              </li>
            </ul>
          </div>

          <!-- Bentuk ruangan -->
          <div v-if="singleNode.type === 'room'">
            <span class="field-label">Bentuk</span>
            <div class="grid grid-cols-4 gap-1">
              <button
                v-for="shapeKey in ROOM_SHAPE_KEYS"
                :key="shapeKey"
                type="button"
                class="btn-ghost px-0!"
                :data-testid="`prop-room-shape-${shapeKey}`"
                :title="ROOM_SHAPES[shapeKey].label"
                :aria-label="ROOM_SHAPES[shapeKey].label"
                @click="emit('roomShape', shapeKey)"
              >
                <img
                  :src="getComponentIconUrl(`ruang-${shapeKey.toLowerCase()}`)"
                  :alt="ROOM_SHAPES[shapeKey].label"
                  class="size-5"
                >
              </button>
            </div>
            <p class="hint">
              Seret ■ titik / ● sisi. Klik ganda ● tambah titik, ■ hapus.
            </p>
          </div>

          <button
            v-if="singleHostRoomName"
            type="button"
            class="btn-ghost w-full"
            @click="emit('detachHost')"
          >
            Lepas dari dinding
          </button>

          <button
            v-if="singleNode.g"
            type="button"
            class="btn-ghost w-full"
            @click="emit('ungroup')"
          >
            Keluarkan dari group
          </button>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="btn-ghost"
              title="Putar kiri 90°"
              @click="emit('rotate', -90)"
            >
              ⟲ Putar
            </button>
            <button
              type="button"
              class="btn-ghost"
              title="Putar kanan 90° (R)"
              @click="emit('rotate', 90)"
            >
              ⟳ Putar
            </button>
            <button
              type="button"
              class="btn-ghost"
              title="Ctrl+D"
              @click="emit('duplicate')"
            >
              Duplikat
            </button>
            <button
              type="button"
              class="btn-ghost text-danger!"
              title="Delete"
              @click="emit('delete')"
            >
              Hapus
            </button>
            <button
              type="button"
              class="btn-ghost col-span-2"
              title="Komponen tidak bisa digeser atau dihapus sampai dibuka"
              @click="emit('lock', true)"
            >
              Kunci
            </button>
          </div>
        </fieldset>
      </template>

      <template v-else>
        <p class="text-[13px] text-muted leading-relaxed">
          Pilih komponen di kanvas untuk melihat dan mengubah propertinya.
        </p>
      </template>
    </section>
  </aside>
</template>
