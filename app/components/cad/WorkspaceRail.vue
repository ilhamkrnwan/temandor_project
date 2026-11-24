<script setup lang="ts">
import {
  LAYERS,
  LIBRARY_GROUPS,
  PAL,
  libraryItemInfo,
  type EditorTool,
  type LayerKey,
  type LibraryItemId,
  type LibraryItemInfo,
  type Project,
  type TextPresetKind,
} from '../../../shared/cad'
import { RAIL_CATEGORIES, type RailCategory } from '../../composables/useWorkspacePanels'
import { getComponentIconUrl } from '../../utils/componentIcons'

const props = withDefaults(defineProps<{
  activeCat: RailCategory
  libVisible: boolean
  project: Project
  activeTool?: EditorTool
  activePlaceItem?: LibraryItemId | null
  warningCount?: number
}>(), {
  activeTool: 'select',
  activePlaceItem: null,
  warningCount: 0,
})

const emit = defineEmits<{
  selectCategory: [cat: RailCategory]
  toggleLib: []
  closeMobile: []
  selectTool: [tool: EditorTool]
  selectPlace: [itemId: LibraryItemId]
  startDragPlace: [itemId: LibraryItemId]
  endDragPlace: []
  addTextPreset: [preset: TextPresetKind]
  startPlaceNote: []
  toggleLayerVisible: [key: LayerKey, on: boolean]
  toggleLayerLock: [key: LayerKey, lock: boolean]
  openBoq: []
}>()

function iconUrl(name: string): string {
  return getComponentIconUrl(name)
}

const searchQuery = ref('')

interface ResolvedLibraryGroup {
  id: string
  name: string
  items: LibraryItemInfo[]
}

const allResolvedGroups: readonly ResolvedLibraryGroup[] = LIBRARY_GROUPS.map(group => ({
  id: group.id,
  name: group.name,
  items: group.items.map(id => libraryItemInfo(id)),
}))

const filteredGroups = computed<ResolvedLibraryGroup[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return [...allResolvedGroups]

  const out: ResolvedLibraryGroup[] = []
  for (const group of allResolvedGroups) {
    if (group.name.toLowerCase().includes(q)) {
      out.push(group)
      continue
    }
    const items = group.items.filter(item => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q))
    if (items.length > 0) {
      out.push({ ...group, items })
    }
  }
  return out
})

let blankDragImage: HTMLImageElement | null = null

function onItemDragStart(itemId: LibraryItemId, e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', itemId)
    e.dataTransfer.effectAllowed = 'copy'
    if (import.meta.client) {
      if (!blankDragImage) {
        blankDragImage = new Image()
        blankDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      }
      e.dataTransfer.setDragImage(blankDragImage, 0, 0)
    }
  }
  emit('startDragPlace', itemId)
}

function onItemDragEnd() {
  emit('endDragPlace')
}

const paneMeta: Record<RailCategory, { title: string }> = {
  elemen: { title: 'Elemen' },
  alat: { title: 'Alat gambar' },
  teks: { title: 'Teks' },
  layer: { title: 'Layer' },
  proyek: { title: 'Proyek' },
}
</script>

<template>
  <nav
    id="rail"
    aria-label="Menu panel"
    class="editor-rail"
  >
    <button
      v-for="cat in RAIL_CATEGORIES"
      :key="cat.id"
      type="button"
      class="rail-btn"
      :data-cat="cat.id"
      :title="cat.title"
      :aria-pressed="props.libVisible && props.activeCat === cat.id"
      @click="emit('selectCategory', cat.id)"
    >
      <svg
        v-if="cat.id === 'elemen'"
        viewBox="0 0 24 24"
        class="size-[22px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <rect
          x="3.5"
          y="3.5"
          width="7"
          height="7"
          rx="1.5"
        />
        <circle
          cx="17"
          cy="7"
          r="3.5"
        />
        <path d="M7 13.5l3.8 6.5H3.2zM13.5 13.5h7v7h-7z" />
      </svg>
      <svg
        v-else-if="cat.id === 'alat'"
        viewBox="0 0 24 24"
        class="size-[22px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
        <path d="M14.5 6.5l3 3" />
      </svg>
      <svg
        v-else-if="cat.id === 'teks'"
        viewBox="0 0 24 24"
        class="size-[22px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M5 7V5h14v2M12 5v14M9 19h6" />
      </svg>
      <svg
        v-else-if="cat.id === 'layer'"
        viewBox="0 0 24 24"
        class="size-[22px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 3l9 5-9 5-9-5z" />
        <path d="M3 13l9 5 9-5" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        class="size-[22px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      </svg>
      <span>{{ cat.label }}</span>
    </button>
  </nav>

  <aside
    id="lib"
    data-testid="workspace-lib"
    aria-label="Panel"
    class="editor-lib"
    :class="{ 'is-hidden': !props.libVisible }"
  >
    <div
      v-if="props.activeCat === 'elemen'"
      class="flex items-center gap-2 p-3 border-b border-line"
    >
      <input
        id="lib-search"
        v-model="searchQuery"
        type="search"
        placeholder="Cari: elbow, pintu, diffuser..."
        aria-label="Cari komponen"
        class="field"
      >
      <button
        type="button"
        class="panel-x grid lg:hidden shrink-0"
        title="Tutup panel"
        aria-label="Tutup panel"
        @click="emit('closeMobile')"
      >
        <UIcon
          name="i-lucide-x"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </div>

    <div
      v-else
      class="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-line"
    >
      <h2 class="pane-title">
        {{ paneMeta[props.activeCat].title }}
      </h2>
      <button
        type="button"
        class="panel-x grid lg:hidden"
        title="Tutup panel"
        aria-label="Tutup panel"
        @click="emit('closeMobile')"
      >
        <UIcon
          name="i-lucide-x"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </div>

    <div
      :data-pane="props.activeCat"
      class="flex-1 min-h-0 overflow-y-auto"
      :class="props.activeCat === 'elemen' ? 'p-2 space-y-1' : 'p-3.5 space-y-3'"
    >
      <template v-if="props.activeCat === 'elemen'">
        <div
          id="lib-groups"
          class="space-y-1"
        >
          <details
            v-for="group in filteredGroups"
            :key="group.id"
            class="lib-group"
            :data-lib-group="group.id"
            open
          >
            <summary>
              <span>{{ group.name }}</span>
              <span class="ml-auto font-mono font-normal text-muted">{{ group.items.length }}</span>
            </summary>
            <div class="grid grid-cols-3 gap-1 p-1">
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                class="lib-item"
                draggable="true"
                :data-place="item.id"
                :aria-pressed="props.activeTool === 'place' && props.activePlaceItem === item.id"
                title="Seret ke kanvas, atau klik lalu klik di kanvas"
                @click="emit('selectPlace', item.id)"
                @dragstart="onItemDragStart(item.id, $event)"
                @dragend="onItemDragEnd"
              >
                <img
                  :src="iconUrl(item.icon)"
                  alt=""
                  draggable="false"
                >
                <span>{{ item.name }}</span>
              </button>
            </div>
          </details>

          <p
            v-if="filteredGroups.length === 0"
            data-testid="lib-empty"
            class="text-xs text-muted text-center py-6"
          >
            Tidak ada komponen yang cocok.
          </p>
        </div>
      </template>

      <template v-else-if="props.activeCat === 'alat'">
        <div class="space-y-1.5">
          <button
            type="button"
            data-testid="tool-btn-duct"
            class="tool-card w-full text-left"
            :aria-pressed="props.activeTool === 'duct'"
            @click="emit('selectTool', 'duct')"
          >
            <img
              :src="iconUrl('duct-lurus')"
              alt=""
              class="size-7 shrink-0"
              draggable="false"
            >
            <span class="min-w-0 flex-1">
              <strong class="block text-[13px] font-semibold text-ink">Gambar jalur duct</strong>
              <small class="block text-[11px] text-muted">Klik titik, elbow otomatis di tiap belokan</small>
            </span>
            <kbd>D</kbd>
          </button>

          <button
            type="button"
            data-testid="tool-btn-room"
            class="tool-card w-full text-left"
            :aria-pressed="props.activeTool === 'room'"
            @click="emit('selectTool', 'room')"
          >
            <img
              :src="iconUrl('ruang-rect')"
              alt=""
              class="size-7 shrink-0"
              draggable="false"
            >
            <span class="min-w-0 flex-1">
              <strong class="block text-[13px] font-semibold text-ink">Ruangan kotak</strong>
              <small class="block text-[11px] text-muted">Seret 2 sudut, atau ketik 6x4 + Enter</small>
            </span>
            <kbd>K</kbd>
          </button>

          <button
            type="button"
            data-testid="tool-btn-poly"
            class="tool-card w-full text-left"
            :aria-pressed="props.activeTool === 'poly'"
            @click="emit('selectTool', 'poly')"
          >
            <img
              :src="iconUrl('ruang-l')"
              alt=""
              class="size-7 shrink-0"
              draggable="false"
            >
            <span class="min-w-0 flex-1">
              <strong class="block text-[13px] font-semibold text-ink">Ruangan bebas</strong>
              <small class="block text-[11px] text-muted">Klik tiap sudut, klik titik awal / Enter tutup</small>
            </span>
            <kbd>P</kbd>
          </button>

          <button
            type="button"
            data-testid="tool-btn-wall"
            class="tool-card w-full text-left"
            :aria-pressed="props.activeTool === 'wall'"
            @click="emit('selectTool', 'wall')"
          >
            <img
              :src="iconUrl('partisi')"
              alt=""
              class="size-7 shrink-0"
              draggable="false"
            >
            <span class="min-w-0 flex-1">
              <strong class="block text-[13px] font-semibold text-ink">Partisi</strong>
              <small class="block text-[11px] text-muted">Dinding dalam ruangan, bisa bersambung</small>
            </span>
            <kbd>W</kbd>
          </button>

          <button
            type="button"
            data-testid="tool-btn-dim"
            class="tool-card w-full text-left"
            :aria-pressed="props.activeTool === 'dim'"
            @click="emit('selectTool', 'dim')"
          >
            <img
              :src="iconUrl('dimensi')"
              alt=""
              class="size-7 shrink-0"
              draggable="false"
            >
            <span class="min-w-0 flex-1">
              <strong class="block text-[13px] font-semibold text-ink">Ukur / dimensi</strong>
              <small class="block text-[11px] text-muted">Klik 2 titik, lalu posisi garis</small>
            </span>
            <kbd>U</kbd>
          </button>

          <button
            type="button"
            data-testid="tool-btn-pen"
            class="tool-card w-full text-left"
            :aria-pressed="props.activeTool === 'pen'"
            @click="emit('selectTool', 'pen')"
          >
            <img
              :src="iconUrl('coretan')"
              alt=""
              class="size-7 shrink-0"
              draggable="false"
            >
            <span class="min-w-0 flex-1">
              <strong class="block text-[13px] font-semibold text-ink">Coretan tangan</strong>
              <small class="block text-[11px] text-muted">Sketsa bebas untuk tanda &amp; catatan</small>
            </span>
            <kbd>B</kbd>
          </button>

          <p class="hint">
            Pilih &amp; geser kanvas ada di kanan bawah. Tekan <kbd>Esc</kbd> untuk kembali ke Pilih.
          </p>
        </div>
      </template>

      <template v-else-if="props.activeCat === 'teks'">
        <div class="space-y-2">
          <button
            type="button"
            data-testid="text-preset-heading"
            class="text-preset text-2xl font-bold"
            @click="emit('addTextPreset', 'heading')"
          >
            Tambah judul
          </button>
          <button
            type="button"
            data-testid="text-preset-subheading"
            class="text-preset text-lg font-semibold"
            @click="emit('addTextPreset', 'subheading')"
          >
            Tambah subjudul
          </button>
          <button
            type="button"
            data-testid="text-preset-body"
            class="text-preset text-sm"
            @click="emit('addTextPreset', 'body')"
          >
            Tambah teks biasa
          </button>
          <button
            type="button"
            data-testid="text-preset-note"
            class="text-preset text-sm flex! items-center gap-3"
            @click="emit('startPlaceNote')"
          >
            <svg
              viewBox="0 0 32 24"
              class="w-8 h-6 shrink-0 text-warn-red"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="M3 21 14 9h15" />
              <path
                d="M3 21l1.5-6 4 4z"
                fill="currentColor"
              />
              <rect
                x="14"
                y="3"
                width="15"
                height="7"
                rx="1"
              />
            </svg>
            <span>
              <strong class="block font-semibold text-ink">Catatan + panah</strong>
              <span class="text-xs text-muted">Klik komponen yang ditunjuk, mis. &quot;cek plafon&quot;</span>
            </span>
          </button>
          <p class="hint">
            Teks langsung muncul di tengah layar, tinggal ketik. Klik ganda teks atau catatan untuk mengubah isinya.
          </p>
        </div>
      </template>

      <template v-else-if="props.activeCat === 'layer'">
        <ul
          id="layers"
          class="space-y-0.5"
        >
          <li
            v-for="layer in LAYERS"
            :key="layer.key"
            class="flex items-center gap-1"
          >
            <label class="layer-row flex-1 min-w-0">
              <input
                type="checkbox"
                :data-testid="`layer-toggle-${layer.key}`"
                :aria-label="`Tampilkan layer ${layer.name}`"
                :checked="props.project.layers[layer.key]?.on !== false"
                @change="emit('toggleLayerVisible', layer.key, ($event.target as HTMLInputElement).checked)"
              >
              <span
                class="sw"
                :style="{ background: PAL.screen.col[layer.key] }"
                aria-hidden="true"
              />
              <span class="flex-1 text-xs font-medium text-ink truncate">{{ layer.name }}</span>
              <span class="font-mono text-[10px] text-muted shrink-0">{{ layer.dxf }}</span>
            </label>
            <button
              type="button"
              class="lock-btn shrink-0"
              :data-testid="`layer-lock-${layer.key}`"
              :aria-pressed="Boolean(props.project.layers[layer.key]?.lock)"
              :title="props.project.layers[layer.key]?.lock ? `Buka kunci layer ${layer.name}` : `Kunci layer ${layer.name}`"
              :aria-label="props.project.layers[layer.key]?.lock ? `Buka kunci layer ${layer.name}` : `Kunci layer ${layer.name}`"
              @click="emit('toggleLayerLock', layer.key, !props.project.layers[layer.key]?.lock)"
            >
              <UIcon
                :name="props.project.layers[layer.key]?.lock ? 'i-lucide-lock' : 'i-lucide-lock-open'"
                class="size-3.5"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
        <p class="hint">
          Centang = tampil. Gembok = tidak bisa dipilih atau diubah. Nama layer ikut ke DXF.
        </p>
      </template>

      <template v-else-if="props.activeCat === 'proyek'">
        <dl class="rounded-[10px] bg-card ring-1 ring-line p-3 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted">
              Nama
            </dt>
            <dd class="font-semibold text-ink truncate">
              {{ props.project.name }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted">
              Satuan duct
            </dt>
            <dd class="font-mono text-ink">
              {{ props.project.unit }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted">
              Skala
            </dt>
            <dd class="font-mono text-ink">
              {{ props.project.scale }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted">
              Komponen
            </dt>
            <dd class="font-mono text-ink">
              {{ props.project.nodes.length }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted">
              Warning
            </dt>
            <dd class="font-mono text-ink">
              {{ props.warningCount }}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          data-testid="proyek-open-boq"
          class="btn-ghost w-full"
          @click="emit('openBoq')"
        >
          <UIcon
            name="i-lucide-clipboard-list"
            class="size-4"
            aria-hidden="true"
          />
          <span>Daftar material (BOQ)</span>
        </button>
        <NuxtLink
          to="/proyek"
          class="btn-ghost w-full"
        >
          Buka daftar proyek
        </NuxtLink>
      </template>
    </div>

    <button
      type="button"
      data-testid="lib-handle"
      class="editor-lib-handle"
      title="Tutup panel (Ctrl+[)"
      aria-label="Tutup panel"
      @click="emit('toggleLib')"
    >
      <UIcon
        name="i-lucide-chevron-left"
        class="size-3.5"
        aria-hidden="true"
      />
    </button>
  </aside>
</template>
