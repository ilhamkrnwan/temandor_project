<script setup lang="ts">
import {
  LAYERS,
  PAL,
  computePdfLayout,
  defaultPdfScale,
  docSVG,
  serializeProjectJson,
  toDXF,
  type LayerKey,
  type PdfOrientation,
  type PdfPaper,
  type PdfScaleOption,
  type Project,
  type Unit,
} from '../../../shared/cad'
import { downloadProjectPdf } from '../../utils/exportPdf'
import { renderProjectPngBlob, shareOrDownloadPng } from '../../utils/exportPng'
import { downloadBlobFile, downloadTextFile, projectSlug } from '../../utils/projectFiles'

export type ExportFormat = 'dxf' | 'png' | 'pdf' | 'json'

interface FormatOption {
  id: ExportFormat
  label: string
  desc: string
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  { id: 'dxf', label: 'DXF', desc: 'Buka di AutoCAD, layer ikut.' },
  { id: 'png', label: 'PNG', desc: 'Gambar untuk chat.' },
  { id: 'pdf', label: 'PDF', desc: 'Cetak vektor berskala + kop.' },
  { id: 'json', label: '.json', desc: 'Cadangan proyek.' },
]

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  project: Project
  warningCount: number
}>()

const emit = defineEmits<{
  updateScale: [scale: string]
  openBoq: []
}>()

const toast = useToast()

const format = ref<ExportFormat>('dxf')
const dxfUnit = ref<Unit>('mm')
const pdfPaper = ref<PdfPaper>('A3')
const pdfOrientation = ref<PdfOrientation>('landscape')
const pdfScale = ref<PdfScaleOption>('1:100')
const selectedLayers = ref<Set<LayerKey>>(new Set())
const includeNote = ref(true)
const doneState = ref<{ filename: string, hint: string } | null>(null)
const cachedPngBlob = ref<Blob | null>(null)
const busy = ref<'export' | 'share' | null>(null)

function syncFromProject() {
  doneState.value = null
  cachedPngBlob.value = null
  pdfScale.value = defaultPdfScale(props.project.scale)
  selectedLayers.value = new Set(
    LAYERS.filter(l => props.project.layers[l.key]?.on !== false).map(l => l.key),
  )
}

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromProject()
  }
  else {
    doneState.value = null
    cachedPngBlob.value = null
  }
})

const previewFilename = computed(() => `${projectSlug(props.project.name)}.${format.value}`)

const allLayersChecked = computed(() => selectedLayers.value.size === LAYERS.length)

const pdfPreviewLayout = computed(() => {
  if (!open.value || format.value !== 'pdf') return null
  const { vb } = docSVG(props.project, {
    pal: 'paper',
    layers: selectedLayers.value,
    note: false,
  })
  return computePdfLayout(vb, {
    paper: pdfPaper.value,
    orientation: pdfOrientation.value,
    scale: pdfScale.value,
  })
})

function toggleLayer(key: LayerKey, checked: boolean) {
  const next = new Set(selectedLayers.value)
  if (checked) next.add(key)
  else next.delete(key)
  selectedLayers.value = next
}

function selectAllLayers() {
  selectedLayers.value = new Set(LAYERS.map(l => l.key))
}

function onScaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value && value !== props.project.scale) {
    emit('updateScale', value)
  }
}

function resetDone() {
  doneState.value = null
  cachedPngBlob.value = null
}

async function handleExport() {
  if (busy.value) return
  busy.value = 'export'
  try {
    const filename = previewFilename.value
    const layers = selectedLayers.value

    if (format.value === 'dxf') {
      const content = toDXF(props.project, {
        layers,
        unit: dxfUnit.value,
        note: includeNote.value,
      })
      downloadTextFile(filename, content, 'application/dxf')
      cachedPngBlob.value = null
      doneState.value = {
        filename,
        hint: 'Buka di AutoCAD atau kirim ke drafter. Layer ikut, catatan "sketsa bantu" ada di bawah gambar.',
      }
      return
    }

    if (format.value === 'png') {
      const blob = await renderProjectPngBlob(props.project, {
        layers,
        note: includeNote.value,
      })
      cachedPngBlob.value = blob
      downloadBlobFile(filename, blob)
      doneState.value = {
        filename,
        hint: 'Siap dikirim lewat chat. Untuk dibuka di AutoCAD, gunakan export DXF.',
      }
      return
    }

    if (format.value === 'pdf') {
      const result = await downloadProjectPdf(props.project, {
        paper: pdfPaper.value,
        orientation: pdfOrientation.value,
        scale: pdfScale.value,
        layers,
      })
      cachedPngBlob.value = null
      const orientLabel = pdfOrientation.value === 'landscape' ? 'lanskap' : 'potret'
      doneState.value = {
        filename: result.filename,
        hint: `PDF vektor ${pdfPaper.value} ${orientLabel} (${result.layout.scaleLabel}) siap dicetak. Pilih "Actual size / 100%" saat cetak agar skala akurat.`,
      }
      return
    }

    downloadTextFile(filename, serializeProjectJson(props.project), 'application/json')
    cachedPngBlob.value = null
    doneState.value = {
      filename,
      hint: 'Cadangan proyek tersimpan. Buka lagi lewat "Buka file .json" di halaman daftar proyek.',
    }
    toast.add({ title: `Cadangan ${filename} diunduh` })
  }
  catch (err) {
    toast.add({
      title: `Export ${format.value.toUpperCase()} gagal`,
      description: err instanceof Error ? err.message : 'Gagal menyiapkan berkas export.',
    })
  }
  finally {
    busy.value = null
  }
}

async function handleSharePng() {
  if (busy.value) return
  busy.value = 'share'
  try {
    const result = await shareOrDownloadPng(props.project, {
      layers: selectedLayers.value,
      note: includeNote.value,
      preRenderedBlob: cachedPngBlob.value ?? undefined,
    })
    if (result.mode === 'shared') {
      toast.add({ title: `Gambar ${result.filename} dibagikan` })
    }
    else if (result.mode === 'downloaded') {
      toast.add({
        title: 'PNG diunduh untuk dikirim',
        description: 'Perangkat ini belum mendukung berbagi langsung. Kirim file PNG lewat WhatsApp Web atau email.',
      })
    }
  }
  catch (err) {
    toast.add({
      title: 'Gagal mengirim PNG',
      description: err instanceof Error ? err.message : 'Tidak dapat menyiapkan gambar PNG.',
    })
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Export gambar"
    description="Hasil export adalah sketsa bantu. Cek ulang ukuran di lapangan."
    :ui="{ content: 'sm:max-w-[580px]', footer: 'flex-wrap items-center gap-2' }"
  >
    <template #body>
      <div
        v-if="doneState"
        data-testid="export-done"
        class="space-y-4 py-1 text-sm text-ink"
        aria-live="polite"
      >
        <div class="flex items-center gap-3">
          <span class="grid place-items-center size-10 rounded-full bg-done-green text-card shrink-0">
            <UIcon
              name="i-lucide-check"
              class="size-5"
              aria-hidden="true"
            />
          </span>
          <div class="min-w-0">
            <strong class="block font-semibold text-ink">File siap</strong>
            <span
              data-testid="export-done-file"
              class="block font-mono text-xs text-muted truncate"
            >
              {{ doneState.filename }}
            </span>
          </div>
        </div>

        <p class="text-sm text-muted leading-relaxed">
          {{ doneState.hint }}
        </p>

        <div class="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="export-share-png"
            class="btn-primary h-10! w-full"
            :disabled="Boolean(busy)"
            @click="handleSharePng"
          >
            <UIcon
              name="i-lucide-share-2"
              class="size-4"
              aria-hidden="true"
            />
            <span>Kirim gambar PNG</span>
          </button>
          <button
            type="button"
            data-testid="export-done-boq"
            class="btn-ghost h-10! w-full"
            @click="emit('openBoq')"
          >
            <UIcon
              name="i-lucide-clipboard-list"
              class="size-4"
              aria-hidden="true"
            />
            <span>Daftar material (BOQ)</span>
          </button>
        </div>
      </div>

      <div
        v-else
        class="space-y-4 text-sm text-ink"
      >
        <fieldset class="space-y-2">
          <legend class="font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
            Format
          </legend>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label
              v-for="opt in FORMAT_OPTIONS"
              :key="opt.id"
              :data-testid="`export-fmt-${opt.id}`"
              class="flex flex-col gap-1 rounded-[8px] bg-card p-2.5 cursor-pointer transition-colors"
              :class="format === opt.id
                ? 'ring-2 ring-ink bg-selected-wash/60'
                : 'ring-1 ring-line hover:ring-line-strong'"
            >
              <input
                v-model="format"
                type="radio"
                name="export-format"
                :value="opt.id"
                class="sr-only"
              >
              <span class="font-mono text-sm font-bold text-ink">
                {{ opt.label }}
              </span>
              <span class="text-xs text-muted leading-snug">
                {{ opt.desc }}
              </span>
            </label>
          </div>
        </fieldset>

        <!-- Pengaturan DXF / PNG -->
        <div
          v-if="format === 'dxf' || format === 'png'"
          class="grid gap-3"
          :class="format === 'dxf' ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <label class="block space-y-1">
            <span class="block font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
              Skala (ukuran teks)
            </span>
            <select
              data-testid="export-scale-select"
              :value="project.scale"
              class="field w-full font-mono text-xs"
              @change="onScaleChange"
            >
              <option value="1:50">1:50</option>
              <option value="1:100">1:100</option>
              <option value="1:200">1:200</option>
            </select>
          </label>

          <label
            v-if="format === 'dxf'"
            class="block space-y-1"
          >
            <span class="block font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
              Satuan file DXF
            </span>
            <select
              v-model="dxfUnit"
              data-testid="export-dxf-unit"
              class="field w-full font-mono text-xs"
            >
              <option value="mm">mm (milimeter)</option>
              <option value="inch">inch (inci)</option>
            </select>
          </label>
        </div>

        <!-- Pengaturan PDF vektor + kop -->
        <div
          v-if="format === 'pdf'"
          class="rounded-[10px] bg-card ring-1 ring-line p-3 space-y-2.5"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
              Pengaturan PDF vektor + kop
            </span>
            <span class="font-mono text-[11px] text-muted">
              {{ pdfPreviewLayout?.scaleLabel ?? pdfScale }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <span class="block font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                Kertas
              </span>
              <div class="seg grid grid-cols-2">
                <button
                  v-for="p in (['A4', 'A3'] as const)"
                  :key="p"
                  type="button"
                  :data-testid="`pdf-paper-${p}`"
                  class="h-7 rounded-[5px] text-xs font-mono font-semibold transition-colors"
                  :class="pdfPaper === p ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'"
                  :aria-pressed="pdfPaper === p"
                  @click="pdfPaper = p"
                >
                  {{ p }}
                </button>
              </div>
            </div>

            <div class="space-y-1">
              <span class="block font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                Orientasi
              </span>
              <div class="seg grid grid-cols-2">
                <button
                  type="button"
                  data-testid="pdf-orient-landscape"
                  class="h-7 rounded-[5px] text-xs font-semibold transition-colors"
                  :class="pdfOrientation === 'landscape' ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'"
                  :aria-pressed="pdfOrientation === 'landscape'"
                  @click="pdfOrientation = 'landscape'"
                >
                  Lanskap
                </button>
                <button
                  type="button"
                  data-testid="pdf-orient-portrait"
                  class="h-7 rounded-[5px] text-xs font-semibold transition-colors"
                  :class="pdfOrientation === 'portrait' ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'"
                  :aria-pressed="pdfOrientation === 'portrait'"
                  @click="pdfOrientation = 'portrait'"
                >
                  Potret
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-1">
            <span class="block font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
              Skala cetak
            </span>
            <div class="seg grid grid-cols-4">
              <button
                v-for="s in (['1:50', '1:100', '1:200', 'fit'] as const)"
                :key="s"
                type="button"
                :data-testid="`pdf-scale-${s}`"
                class="h-7 rounded-[5px] text-xs font-mono font-semibold transition-colors"
                :class="pdfScale === s ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'"
                :aria-pressed="pdfScale === s"
                @click="pdfScale = s"
              >
                {{ s === 'fit' ? 'Muat' : s }}
              </button>
            </div>
          </div>

          <p
            data-testid="pdf-layout-hint"
            class="text-xs leading-relaxed"
            :class="pdfPreviewLayout?.clipped ? 'text-error-ink' : 'text-muted'"
          >
            <template v-if="pdfPreviewLayout?.clipped">
              Pada skala {{ pdfScale }} di {{ pdfPaper }} {{ pdfOrientation === 'landscape' ? 'lanskap' : 'potret' }}, sebagian gambar terpotong. Pilih kertas A3 atau skala Muat.
            </template>
            <template v-else>
              Lembar {{ pdfPaper }} {{ pdfOrientation === 'landscape' ? 'lanskap' : 'potret' }} · {{ pdfPreviewLayout?.scaleLabel ?? pdfScale }} · kop di pojok kanan bawah.
            </template>
          </p>
        </div>

        <!-- Pilihan layer (DXF, PNG, PDF) -->
        <fieldset
          v-if="format !== 'json'"
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <legend class="font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
              Layer yang ikut ({{ selectedLayers.size }}/{{ LAYERS.length }})
            </legend>
            <button
              v-if="!allLayersChecked"
              type="button"
              class="text-xs font-semibold text-ink underline underline-offset-2 hover:text-muted"
              @click="selectAllLayers"
            >
              Pilih semua
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 rounded-[10px] bg-card ring-1 ring-line p-3">
            <label
              v-for="layer in LAYERS"
              :key="layer.key"
              class="flex items-center gap-2 text-xs cursor-pointer select-none min-h-6"
            >
              <input
                type="checkbox"
                :data-testid="`export-layer-${layer.key}`"
                :checked="selectedLayers.has(layer.key)"
                class="accent-ink size-3.5 shrink-0"
                @change="toggleLayer(layer.key, ($event.target as HTMLInputElement).checked)"
              >
              <span
                class="size-2.5 rounded-[2px] shrink-0"
                :style="{ backgroundColor: PAL.paper.col[layer.key] }"
                aria-hidden="true"
              />
              <span class="font-mono text-[11px] text-ink shrink-0">
                {{ layer.dxf }}
              </span>
              <span class="text-muted truncate">
                {{ layer.name }}
              </span>
            </label>
          </div>
        </fieldset>

        <p
          v-else
          class="rounded-[10px] bg-card ring-1 ring-line p-3 text-xs text-muted leading-relaxed"
        >
          Berkas <code class="font-mono text-ink">.json</code> menyimpan seluruh proyek (semua ruangan, duct, layer, dan pengaturan) untuk cadangan atau dibuka kembali di perangkat lain.
        </p>

        <!-- Catatan sketsa bantu (DXF & PNG; di PDF selalu masuk kop) -->
        <label
          v-if="format === 'dxf' || format === 'png'"
          class="flex items-start gap-2 text-xs text-ink cursor-pointer"
        >
          <input
            v-model="includeNote"
            type="checkbox"
            data-testid="export-note-checkbox"
            class="accent-ink mt-0.5 size-3.5 shrink-0"
          >
          <span>Tulis catatan di gambar: <em class="text-muted">"Sketsa bantu - cek ulang ukuran di lapangan"</em></span>
        </label>

        <!-- Status warning non-blocking -->
        <div
          v-if="warningCount > 0"
          data-testid="export-warn-notice"
          class="rounded-lg bg-error-wash ring-1 ring-red-200 p-3 text-xs text-error-ink leading-relaxed"
        >
          <strong class="font-semibold">Ada {{ warningCount }} warning pada gambar.</strong>
          Warning bersifat informasi dan tidak menghalangi simpan atau export.
        </div>
        <div
          v-else
          data-testid="export-warn-clear"
          class="rounded-lg bg-paper ring-1 ring-line p-2.5 text-xs text-muted"
        >
          Tidak ada warning.
        </div>

        <button
          type="button"
          data-testid="export-open-boq"
          class="btn-ghost w-full"
          @click="emit('openBoq')"
        >
          <UIcon
            name="i-lucide-clipboard-list"
            class="size-4"
            aria-hidden="true"
          />
          <span>Lihat daftar material (BOQ)</span>
        </button>
      </div>
    </template>

    <template #footer>
      <template v-if="doneState">
        <button
          type="button"
          data-testid="export-again-btn"
          class="btn-ghost ml-auto"
          @click="resetDone"
        >
          Format lain
        </button>
        <button
          type="button"
          data-testid="export-finish-btn"
          class="btn-primary"
          @click="open = false"
        >
          Selesai
        </button>
      </template>
      <template v-else>
        <span
          data-testid="export-filename"
          class="font-mono text-xs text-muted truncate mr-auto"
        >
          {{ previewFilename }}
        </span>
        <button
          type="button"
          class="btn-ghost"
          @click="open = false"
        >
          Tutup
        </button>
        <button
          type="button"
          data-testid="export-submit-btn"
          class="btn-primary"
          :disabled="Boolean(busy)"
          @click="handleExport"
        >
          {{ busy === 'export' ? 'Menyiapkan...' : `Export ${format === 'json' ? '.json' : format.toUpperCase()}` }}
        </button>
      </template>
    </template>
  </UModal>
</template>
