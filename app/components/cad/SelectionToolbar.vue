<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  PAL,
  ROOM_SHAPES,
  TEXT_ALIGN_OPTIONS,
  TEXT_COLOR_OPTIONS,
  TEXT_SIZE_OPTIONS,
  TEXT_STYLE_FLAGS,
  type AlignDirection,
  type LibraryItemId,
  type NodeType,
  type RoomShapeKey,
  type TextAlign,
  type TextColor,
  type TextStyleFlag,
} from '../../../shared/cad'

export interface SelectionTextStyle {
  tz: string
  col: TextColor
  al?: TextAlign
  b: boolean
  it: boolean
  ul: boolean
  bx: boolean
}

const props = withDefaults(defineProps<{
  left: number
  top: number
  count: number
  allLocked: boolean
  grouped: boolean
  canAlign: boolean
  singleNodeType?: NodeType | null
  singleHosted?: boolean
  singleTextStyle?: SelectionTextStyle | null
}>(), {
  singleNodeType: null,
  singleHosted: false,
  singleTextStyle: null,
})

const emit = defineEmits<{
  group: []
  ungroup: []
  align: [direction: AlignDirection]
  roomShape: [shape: RoomShapeKey]
  addToRoom: [itemId: LibraryItemId]
  doorHinge: []
  doorSwing: []
  detachHost: []
  editText: []
  updateTextStyle: [patch: Partial<SelectionTextStyle>]
  rotate: []
  mirror: []
  reorder: [direction: 'front' | 'back']
  lock: [locked: boolean]
  duplicate: []
  delete: []
}>()

const isTextLike = computed(() => props.singleNodeType === 'text' || props.singleNodeType === 'note')

const activeSizeLabel = computed(() => {
  const cur = props.singleTextStyle?.tz ?? '1'
  return TEXT_SIZE_OPTIONS.find(o => o.value === cur)?.label ?? 'Sedang'
})

const activeAlignLabel = computed(() => {
  const cur = props.singleTextStyle?.al ?? 'start'
  return TEXT_ALIGN_OPTIONS.find(o => o.value === cur)?.label ?? 'Kiri'
})

const activeSwatchColor = computed(() => {
  const col = props.singleTextStyle?.col ?? ''
  return col ? PAL.paper.pick[col] : 'transparent'
})

const roomShapeItems = computed<DropdownMenuItem[][]>(() => [
  (Object.keys(ROOM_SHAPES) as RoomShapeKey[]).map(shape => ({
    label: ROOM_SHAPES[shape].label,
    onSelect: () => emit('roomShape', shape),
  })),
])

const roomAddItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Pintu', onSelect: () => emit('addToRoom', 'door') },
    { label: 'Jendela', onSelect: () => emit('addToRoom', 'win') },
    { label: 'Kolom', onSelect: () => emit('addToRoom', 'column') },
    { label: 'Partisi', onSelect: () => emit('addToRoom', 'partition') },
  ],
])

const textSizeItems = computed<DropdownMenuItem[][]>(() => [
  TEXT_SIZE_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit('updateTextStyle', { tz: opt.value }),
  })),
])

const textColorItems = computed<DropdownMenuItem[][]>(() => [
  TEXT_COLOR_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit('updateTextStyle', { col: opt.value }),
  })),
])

const textAlignItems = computed<DropdownMenuItem[][]>(() => [
  TEXT_ALIGN_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit('updateTextStyle', { al: opt.value }),
  })),
])

function toggleTextFlag(flag: TextStyleFlag) {
  const cur = Boolean(props.singleTextStyle?.[flag])
  emit('updateTextStyle', { [flag]: !cur })
}

const alignItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Rata kiri',
      icon: 'i-lucide-align-start-vertical',
      onSelect: () => emit('align', 'left'),
    },
    {
      label: 'Rata tengah (horizontal)',
      icon: 'i-lucide-align-center-vertical',
      onSelect: () => emit('align', 'center'),
    },
    {
      label: 'Rata kanan',
      icon: 'i-lucide-align-end-vertical',
      onSelect: () => emit('align', 'right'),
    },
  ],
  [
    {
      label: 'Rata atas',
      icon: 'i-lucide-align-start-horizontal',
      onSelect: () => emit('align', 'top'),
    },
    {
      label: 'Rata tengah (vertikal)',
      icon: 'i-lucide-align-center-horizontal',
      onSelect: () => emit('align', 'middle'),
    },
    {
      label: 'Rata bawah',
      icon: 'i-lucide-align-end-horizontal',
      onSelect: () => emit('align', 'bottom'),
    },
  ],
])

const orderItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Ke depan',
      icon: 'i-lucide-bring-to-front',
      kbds: [']'],
      onSelect: () => emit('reorder', 'front'),
    },
    {
      label: 'Ke belakang',
      icon: 'i-lucide-send-to-back',
      kbds: ['['],
      onSelect: () => emit('reorder', 'back'),
    },
  ],
])
</script>

<template>
  <div
    data-testid="selection-toolbar"
    role="toolbar"
    aria-label="Aksi pilihan"
    class="absolute z-20 flex items-center gap-0.5 p-1 rounded-[10px] bg-panel shadow-[0_10px_28px_-8px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.06)] max-w-[calc(100%-16px)] overflow-x-auto"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @pointerdown.stop
    @contextmenu.stop
  >
    <template v-if="props.allLocked">
      <button
        type="button"
        class="cb"
        title="Buka kunci komponen"
        @click="emit('lock', false)"
      >
        <UIcon
          name="i-lucide-lock-open"
          class="size-4"
          aria-hidden="true"
        />
        <span>Buka kunci</span>
      </button>
    </template>

    <template v-else>
      <template v-if="props.count > 1">
        <button
          v-if="props.grouped"
          type="button"
          class="cb"
          title="Pisahkan group (Ctrl+Shift+G)"
          @click="emit('ungroup')"
        >
          Ungroup
        </button>
        <button
          v-else
          type="button"
          class="cb"
          title="Gabungkan jadi group (Ctrl+G)"
          @click="emit('group')"
        >
          Group
        </button>

        <UDropdownMenu
          v-if="props.canAlign"
          :items="alignItems"
          :content="{ align: 'center', sideOffset: 6 }"
        >
          <button
            type="button"
            class="cb"
            title="Ratakan komponen"
            aria-label="Rata"
          >
            <UIcon
              name="i-lucide-align-start-vertical"
              class="size-4"
              aria-hidden="true"
            />
            <span>Rata</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
          </button>
        </UDropdownMenu>

        <span class="cb-sep" />
      </template>

      <template v-else-if="props.singleNodeType === 'room'">
        <UDropdownMenu
          :items="roomShapeItems"
          :content="{ align: 'center', sideOffset: 6 }"
        >
          <button
            type="button"
            data-testid="room-shape-btn"
            class="cb"
            title="Ganti bentuk ruangan"
            aria-label="Bentuk"
          >
            <span>Bentuk</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
          </button>
        </UDropdownMenu>

        <UDropdownMenu
          :items="roomAddItems"
          :content="{ align: 'center', sideOffset: 6 }"
        >
          <button
            type="button"
            data-testid="room-add-btn"
            class="cb"
            title="Tambah komponen ke ruangan"
            aria-label="Tambah"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-3.5"
              aria-hidden="true"
            />
            <span>Tambah</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
          </button>
        </UDropdownMenu>

        <span class="cb-sep" />
      </template>

      <template v-else-if="props.singleHosted">
        <button
          v-if="props.singleNodeType === 'door'"
          type="button"
          data-testid="door-hinge-btn"
          class="cb"
          title="Balik engsel kiri/kanan (M)"
          @click="emit('doorHinge')"
        >
          <UIcon
            name="i-lucide-flip-horizontal-2"
            class="size-4"
            aria-hidden="true"
          />
          <span>Engsel</span>
        </button>
        <button
          v-if="props.singleNodeType === 'door'"
          type="button"
          data-testid="door-swing-btn"
          class="cb"
          title="Buka ke dalam/luar (R)"
          @click="emit('doorSwing')"
        >
          <UIcon
            name="i-lucide-flip-vertical-2"
            class="size-4"
            aria-hidden="true"
          />
          <span>Arah buka</span>
        </button>
        <button
          type="button"
          data-testid="opening-detach-btn"
          class="cb"
          title="Lepas dari dinding"
          @click="emit('detachHost')"
        >
          <UIcon
            name="i-lucide-unlink"
            class="size-4"
            aria-hidden="true"
          />
          <span>Lepas</span>
        </button>

        <span class="cb-sep" />
      </template>

      <template v-else-if="isTextLike && props.singleTextStyle">
        <button
          type="button"
          data-testid="text-edit-btn"
          class="cb"
          title="Ubah isi teks (klik ganda)"
          @click="emit('editText')"
        >
          Edit
        </button>

        <span class="cb-sep" />

        <UDropdownMenu
          :items="textSizeItems"
          :content="{ align: 'center', sideOffset: 6 }"
        >
          <button
            type="button"
            data-testid="text-size-btn"
            class="cb"
            title="Ukuran teks"
            aria-label="Ukuran teks"
          >
            <span>{{ activeSizeLabel }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
          </button>
        </UDropdownMenu>

        <UDropdownMenu
          :items="textColorItems"
          :content="{ align: 'center', sideOffset: 6 }"
        >
          <button
            type="button"
            data-testid="text-color-btn"
            class="cb"
            title="Warna teks"
            aria-label="Warna teks"
          >
            <span
              class="size-3.5 rounded-full ring-1 ring-black/20 grid place-items-center"
              :style="{ background: activeSwatchColor }"
            >
              <svg
                v-if="!props.singleTextStyle.col"
                viewBox="0 0 24 24"
                class="size-2.5 text-muted"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                aria-hidden="true"
              >
                <path d="M5 19 19 5" />
              </svg>
            </span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
          </button>
        </UDropdownMenu>

        <UDropdownMenu
          v-if="props.singleNodeType === 'text'"
          :items="textAlignItems"
          :content="{ align: 'center', sideOffset: 6 }"
        >
          <button
            type="button"
            data-testid="text-align-btn"
            class="cb"
            title="Rata teks"
            aria-label="Rata teks"
          >
            <span>{{ activeAlignLabel }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
          </button>
        </UDropdownMenu>

        <span class="cb-sep" />

        <button
          v-for="flag in TEXT_STYLE_FLAGS"
          :key="flag.key"
          type="button"
          :data-testid="`text-flag-${flag.key}`"
          class="cb px-0! w-7 aria-pressed:bg-ink! aria-pressed:text-card!"
          :aria-pressed="Boolean(props.singleTextStyle[flag.key])"
          :title="flag.label"
          :aria-label="flag.label"
          @click="toggleTextFlag(flag.key)"
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
            class="inline-block px-1 ring-1 ring-current rounded-sm leading-tight text-[11px]"
          >A</span>
        </button>

        <span class="cb-sep" />
      </template>

      <template v-if="!props.singleHosted && !isTextLike">
        <button
          type="button"
          class="cb px-0! w-8"
          title="Putar 90° (R)"
          aria-label="Putar 90°"
          @click="emit('rotate')"
        >
          <UIcon
            name="i-lucide-rotate-cw"
            class="size-4"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="cb px-0! w-8"
          title="Cermin (M)"
          aria-label="Cermin"
          @click="emit('mirror')"
        >
          <UIcon
            name="i-lucide-flip-horizontal-2"
            class="size-4"
            aria-hidden="true"
          />
        </button>
      </template>

      <UDropdownMenu
        :items="orderItems"
        :content="{ align: 'center', sideOffset: 6 }"
      >
        <button
          type="button"
          class="cb px-0! w-8"
          title="Urutan lapisan ([ / ])"
          aria-label="Urutan"
        >
          <UIcon
            name="i-lucide-layers"
            class="size-4"
            aria-hidden="true"
          />
        </button>
      </UDropdownMenu>

      <span class="cb-sep" />

      <button
        type="button"
        class="cb px-0! w-8"
        title="Kunci (tidak ikut tergeser)"
        aria-label="Kunci"
        @click="emit('lock', true)"
      >
        <UIcon
          name="i-lucide-lock"
          class="size-4"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="cb px-0! w-8"
        title="Duplikat (Ctrl+D)"
        aria-label="Duplikat"
        @click="emit('duplicate')"
      >
        <UIcon
          name="i-lucide-copy"
          class="size-4"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="cb danger px-0! w-8"
        title="Hapus (Delete)"
        aria-label="Hapus"
        @click="emit('delete')"
      >
        <UIcon
          name="i-lucide-trash-2"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </template>
  </div>
</template>
