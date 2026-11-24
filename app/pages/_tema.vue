<script setup lang="ts">
definePageMeta({
  layout: false,
})

useHead({
  htmlAttrs: { lang: 'id' },
  title: 'Acuan Tema · Temandor (Dev)',
  meta: [
    { name: 'description', content: 'Halaman acuan token warna, tipografi, dan komponen dasar Temandor untuk verifikasi berdampingan dengan prototype.' },
  ],
})

const toast = useToast()

const navSections = [
  { id: 'warna', label: 'Warna' },
  { id: 'tipografi', label: 'Tipografi' },
  { id: 'tombol', label: 'Tombol' },
  { id: 'input', label: 'Input' },
  { id: 'dialog', label: 'Dialog' },
  { id: 'editor', label: 'Permukaan Editor' },
]

const surfaceSwatches = [
  { token: 'hazard', hex: '#f2c200', fg: 'text-ink', role: 'Aksi utama, aktif, fokus' },
  { token: 'hazard-hover', hex: '#ffd31a', fg: 'text-ink', role: 'Hover tombol utama' },
  { token: 'ink', hex: '#17191c', fg: 'text-card', role: 'Teks utama, rail, toast' },
  { token: 'paper', hex: '#f3f2ee', fg: 'text-ink', role: 'Latar halaman & bacaan' },
  { token: 'panel', hex: '#fbfaf7', fg: 'text-ink', role: 'Panel samping & dialog' },
  { token: 'card', hex: '#ffffff', fg: 'text-ink', role: 'Kartu & field input' },
  { token: 'line', hex: '#dfdcd4', fg: 'text-ink', role: 'Border 1px & pembatas' },
  { token: 'line-strong', hex: '#c9c5bb', fg: 'text-ink', role: 'Ring hover kartu/tombol' },
  { token: 'hover-tint', hex: '#ece9e1', fg: 'text-ink', role: 'Hover menu & toolbar' },
  { token: 'seg-track', hex: '#ebe9e3', fg: 'text-ink', role: 'Wadah segmented control' },
  { token: 'muted', hex: '#64625d', fg: 'text-card', role: 'Label & teks sekunder' },
  { token: 'placeholder', hex: '#77756f', fg: 'text-card', role: 'Placeholder input' },
  { token: 'reading-gray', hex: '#3f3d39', fg: 'text-card', role: 'Teks bacaan panjang' },
  { token: 'selected-wash', hex: '#fffbe6', fg: 'text-ink', role: 'Kartu alat aktif' },
]

const cadAndStatusSwatches = [
  { token: 'cad-ground', hex: '#14171b', fg: 'text-card', role: 'Kanvas CAD gelap' },
  { token: 'cad-deep', hex: '#101317', fg: 'text-card', role: 'Band gelap punch list' },
  { token: 'cad-foot', hex: '#0e1013', fg: 'text-card', role: 'Footer gelap landing' },
  { token: 'canvas-light', hex: '#f6f7f9', fg: 'text-ink', role: 'Kanvas CAD terang' },
  { token: 'warn-red', hex: '#dc2626', fg: 'text-card', role: 'Pin & daftar warning' },
  { token: 'danger', hex: '#b91c1c', fg: 'text-card', role: 'Teks aksi hapus' },
  { token: 'error-wash', hex: '#fef2f2', fg: 'text-error-ink', role: 'Latar galat (teks error-ink)' },
  { token: 'done-green', hex: '#15803d', fg: 'text-card', role: 'Pin selesai / teratasi' },
  { token: 'stamp-green', hex: '#4ade80', fg: 'text-ink', role: 'Stempel siap export' },
  { token: 'tip-red', hex: '#fca5a5', fg: 'text-ink', role: 'Judul tooltip di atas ink' },
]

const cadLayerPairs = [
  { layer: 'DUCT-SA', screenToken: 'sa-screen', screenHex: '#4ea1ff', screenClass: 'text-sa-screen', screenBg: 'bg-sa-screen', paperToken: 'sa-paper', paperHex: '#1d4ed8', paperClass: 'text-sa-paper', paperBg: 'bg-sa-paper' },
  { layer: 'DUCT-EA', screenToken: 'ea-screen', screenHex: '#f472b6', screenClass: 'text-ea-screen', screenBg: 'bg-ea-screen', paperToken: 'ea-paper', paperHex: '#be185d', paperClass: 'text-ea-paper', paperBg: 'bg-ea-paper' },
  { layer: 'EQUIPMENT', screenToken: 'eq-screen', screenHex: '#4ade80', screenClass: 'text-eq-screen', screenBg: 'bg-eq-screen', paperToken: 'eq-paper', paperHex: '#15803d', paperClass: 'text-eq-paper', paperBg: 'bg-eq-paper' },
  { layer: 'DIFFUSER', screenToken: 'diff-screen', screenHex: '#22d3ee', screenClass: 'text-diff-screen', screenBg: 'bg-diff-screen', paperToken: 'diff-paper', paperHex: '#0e7490', paperClass: 'text-diff-paper', paperBg: 'bg-diff-paper' },
  { layer: 'SELEKSI', screenToken: 'sel-screen', screenHex: '#facc15', screenClass: 'text-sel-screen', screenBg: 'bg-sel-screen', paperToken: 'sel-light', paperHex: '#c2410c', paperClass: 'text-sel-light', paperBg: 'bg-sel-light' },
]

// State interaktif untuk uji komponen (tanpa kontrol mati)
const lastAction = ref('Klik tombol atau ubah kontrol untuk menguji status interaksi.')
const selectedChip = ref<'semua' | 'sa' | 'ea'>('semua')
const ductUnit = ref<'inch' | 'mm'>('inch')
const ductSystem = ref<'SA' | 'EA'>('SA')
const exportFormat = ref<'dxf' | 'png' | 'pdf' | 'json'>('dxf')

const projectName = ref('')
const projectScale = ref('1:100')
const scaleOptions = ['1:50', '1:100', '1:200']
const roomLength = ref(9)
const roomWidth = ref(6)
const formFeedback = ref('')

const modalOpen = ref(false)
const modalProjectName = ref('')
const modalUnit = ref<'inch' | 'mm'>('inch')

const activeRail = ref<'elemen' | 'alat' | 'teks' | 'layer'>('elemen')
const activeToolCard = ref<'duct' | 'room'>('duct')
const viewTool = ref<'select' | 'pan'>('select')
const statusOpts = reactive({ snap: true, ortho: true, grid: false })
const editorLayers = reactive([
  { id: 'sa', name: 'DUCT-SA', color: '#4ea1ff', visible: true, locked: false },
  { id: 'ea', name: 'DUCT-EA', color: '#f472b6', visible: true, locked: false },
  { id: 'eq', name: 'EQUIPMENT', color: '#4ade80', visible: true, locked: true },
  { id: 'diff', name: 'DIFFUSER', color: '#22d3ee', visible: false, locked: false },
])

const roomPreview = computed(() => {
  const p = Math.max(1, Number(roomLength.value) || 1)
  const l = Math.max(1, Number(roomWidth.value) || 1)
  const scale = Math.min(180 / p, 92 / l)
  const w = Math.round(p * scale)
  const h = Math.round(l * scale)
  return {
    x: Math.round((220 - w) / 2),
    y: Math.round((124 - h) / 2),
    w,
    h,
    label: `${p} × ${l} m`,
  }
})

const unitExample = computed(() => (ductUnit.value === 'inch' ? '24"x20"' : '600x500'))

function triggerAction(label: string) {
  lastAction.value = `Aksi dijalankan: ${label}`
}

function submitSampleForm() {
  const nama = projectName.value.trim() || 'Kantor Lt. 2'
  formFeedback.value = `Tersimpan sementara: "${nama}" (${ductUnit.value}, skala ${projectScale.value}, ${roomLength.value} × ${roomWidth.value} m).`
}

function submitModalProject() {
  const nama = modalProjectName.value.trim() || 'Proyek baru'
  modalOpen.value = false
  toast.add({
    title: `Proyek "${nama}" siap (${modalUnit.value})`,
  })
  lastAction.value = `Dialog proyek baru dikirim: ${nama}`
}

function showUndoToast() {
  toast.add({
    title: 'Duct 24"x20" dihapus',
    duration: 6000,
    actions: [
      {
        label: 'Urungkan',
        color: 'primary',
        variant: 'link',
        class: 'text-hazard font-bold px-2 hover:bg-white/10',
        onClick: () => {
          lastAction.value = 'Penghapusan diurungkan dari toast.'
        },
      },
    ],
  })
}
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-paper text-ink">
    <header class="sm:sticky sm:top-0 z-30 bg-panel border-b border-line">
      <div class="tape h-[3px] w-full" />
      <div class="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex items-center gap-2.5">
          <span
            class="grid place-items-center size-8 rounded-[6px] bg-ink shrink-0"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-5"
              fill="none"
              stroke="#f2c200"
              stroke-width="2.2"
            >
              <path d="M3 6h7a8 8 0 0 1 8 8v7M3 12h7a2 2 0 0 1 2 2v7" />
            </svg>
          </span>
          <span class="font-cond font-bold text-xl tracking-wide leading-none">TEMANDOR</span>
          <span class="font-mono text-xs text-muted border-l border-line pl-2.5">/_tema · dev</span>
        </div>

        <nav
          aria-label="Bagian acuan tema"
          class="flex flex-wrap items-center gap-1.5 ml-auto"
        >
          <a
            v-for="item in navSections"
            :key="item.id"
            :href="`#${item.id}`"
            class="btn-ghost max-sm:min-h-11"
          >
            {{ item.label }}
          </a>
        </nav>
      </div>
    </header>

    <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-10 space-y-14">
      <section class="border-b border-line pb-6">
        <h1 class="font-cond font-bold text-4xl sm:text-5xl leading-none">
          Acuan Tema &amp; Token Desain
        </h1>
        <p class="mt-2.5 text-reading-gray max-w-2xl text-[15px] leading-relaxed">
          Halaman internal mode pengembangan untuk membandingkan token warna, tipografi self-host,
          varian Nuxt UI, dan kelas komponen inti dengan prototype secara berdampingan.
        </p>
        <p
          class="mt-3 font-mono text-xs text-muted"
          aria-live="polite"
        >
          Status uji: {{ lastAction }}
        </p>
      </section>

      <!-- 1. WARNA -->
      <section
        id="warna"
        class="scroll-mt-24 space-y-6"
      >
        <div>
          <h2 class="font-cond font-bold text-3xl leading-none">
            Palet Warna
          </h2>
          <p class="mt-1.5 text-sm text-muted">
            Semua nama token mengikuti <code class="font-mono text-ink">DESIGN.md</code>. Rasio kontras pasangan teks mengikuti ambang WCAG AA (4,5:1).
          </p>
        </div>

        <div>
          <h3 class="field-label">
            Aksen &amp; Permukaan Kantor Proyek
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div
              v-for="sw in surfaceSwatches"
              :key="sw.token"
              class="card-surface overflow-hidden"
            >
              <div
                class="h-16 p-2.5 flex items-end justify-between border-b border-line"
                :class="sw.fg"
                :style="{ backgroundColor: sw.hex }"
              >
                <span class="font-mono text-xs font-medium">{{ sw.hex }}</span>
                <span class="font-sans text-xs font-semibold">Aa</span>
              </div>
              <div class="p-2.5">
                <div class="font-mono text-xs font-medium text-ink">
                  {{ sw.token }}
                </div>
                <p class="mt-0.5 text-xs text-muted leading-snug">
                  {{ sw.role }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="field-label">
            Latar CAD &amp; Status
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div
              v-for="sw in cadAndStatusSwatches"
              :key="sw.token"
              class="card-surface overflow-hidden"
            >
              <div
                class="h-14 p-2.5 flex items-end justify-between border-b border-line"
                :class="sw.fg"
                :style="{ backgroundColor: sw.hex }"
              >
                <span class="font-mono text-xs font-medium">{{ sw.hex }}</span>
                <span class="font-sans text-xs font-semibold">Aa</span>
              </div>
              <div class="p-2.5">
                <div class="font-mono text-xs font-medium text-ink">
                  {{ sw.token }}
                </div>
                <p class="mt-0.5 text-xs text-muted leading-snug">
                  {{ sw.role }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="field-label">
            Palet Gambar CAD (Layar Gelap vs Kertas Export)
          </h3>
          <div class="grid md:grid-cols-2 gap-4">
            <div class="rounded-[10px] bg-cad-ground text-card p-4 space-y-2.5">
              <div class="flex items-center justify-between border-b border-white/15 pb-2">
                <span class="font-cond font-bold text-sm tracking-[0.08em] uppercase text-hazard">TEMA LAYAR (CAD-GROUND)</span>
                <span class="font-mono text-xs text-card/75">#14171b</span>
              </div>
              <div
                v-for="row in cadLayerPairs"
                :key="`s-${row.layer}`"
                class="flex items-center gap-3 text-sm"
              >
                <span
                  class="sw"
                  :class="row.screenBg"
                  aria-hidden="true"
                />
                <span class="font-mono text-xs w-24 text-card">{{ row.layer }}</span>
                <span
                  class="font-mono text-xs font-medium"
                  :class="row.screenClass"
                >
                  {{ row.screenToken }} ({{ row.screenHex }})
                </span>
              </div>
            </div>

            <div class="rounded-[10px] bg-card text-ink ring-1 ring-line p-4 space-y-2.5">
              <div class="flex items-center justify-between border-b border-line pb-2">
                <span class="font-cond font-bold text-sm tracking-[0.08em] uppercase text-ink">TEMA KERTAS (EXPORT PNG / PDF)</span>
                <span class="font-mono text-xs text-muted">#ffffff</span>
              </div>
              <div
                v-for="row in cadLayerPairs"
                :key="`p-${row.layer}`"
                class="flex items-center gap-3 text-sm"
              >
                <span
                  class="sw"
                  :class="row.paperBg"
                  aria-hidden="true"
                />
                <span class="font-mono text-xs w-24 text-ink">{{ row.layer }}</span>
                <span
                  class="font-mono text-xs font-medium"
                  :class="row.paperClass"
                >
                  {{ row.paperToken }} ({{ row.paperHex }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. TIPOGRAFI -->
      <section
        id="tipografi"
        class="scroll-mt-24 space-y-5"
      >
        <div>
          <h2 class="font-cond font-bold text-3xl leading-none">
            Tipografi
          </h2>
          <p class="mt-1.5 text-sm text-muted">
            Self-host via <code class="font-mono text-ink">@nuxt/fonts</code>: Barlow Condensed, Barlow, dan JetBrains Mono.
          </p>
        </div>

        <div class="card-surface divide-y divide-line">
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
            <span class="font-mono text-xs text-muted sm:w-40 shrink-0">Display · Condensed</span>
            <p class="font-cond font-bold uppercase tracking-[-0.01em] leading-[0.92] text-[clamp(2.2rem,5vw,3.8rem)]">
              SKETSA DUCTING SIAP DXF
            </p>
          </div>
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
            <span class="font-mono text-xs text-muted sm:w-40 shrink-0">Title · 30px / 700</span>
            <p class="font-cond font-bold text-3xl leading-none">
              Proyek · Kantor Lt. 2
            </p>
          </div>
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
            <span class="font-mono text-xs text-muted sm:w-40 shrink-0">Pane Title · 15px</span>
            <p class="pane-title">
              ALAT GAMBAR &amp; PROPERTI
            </p>
          </div>
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
            <span class="font-mono text-xs text-muted sm:w-40 shrink-0">Body · Barlow 14px</span>
            <p class="text-sm leading-relaxed text-reading-gray max-w-[62ch]">
              Isi ukuran ruangan, lalu rangkai komponen seperti di lapangan: duct, elbow, T, diffuser.
              Ujungnya menempel sendiri dan setiap aksi bisa diurungkan.
            </p>
          </div>
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
            <span class="font-mono text-xs text-muted sm:w-40 shrink-0">Label · 11px Caps</span>
            <p class="field-label mb-0!">
              SATUAN DUCT · SKALA GAMBAR · DAFTAR MATERIAL
            </p>
          </div>
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
            <span class="font-mono text-xs text-muted sm:w-40 shrink-0">Mono · 12px / 500</span>
            <p class="font-mono text-xs font-medium tracking-[0.08em] text-ink">
              24"x20" · DUCT-SA · 5150 × 5650 mm · SKALA 1:100 · <kbd>Ctrl</kbd> + <kbd>Z</kbd>
            </p>
          </div>
        </div>
      </section>

      <!-- 3. TOMBOL & KONTROL -->
      <section
        id="tombol"
        class="scroll-mt-24 space-y-6"
      >
        <div>
          <h2 class="font-cond font-bold text-3xl leading-none">
            Tombol, Chip &amp; Pilihan
          </h2>
          <p class="mt-1.5 text-sm text-muted">
            Perbandingan langsung antara <code class="font-mono text-ink">UButton</code> (Nuxt UI) dan utilitas <code class="font-mono text-ink">.btn-primary</code> / <code class="font-mono text-ink">.btn-ghost</code>.
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <div class="card-surface p-5 space-y-4">
            <span class="field-label">Nuxt UI (UButton)</span>
            <div class="flex flex-wrap items-center gap-2.5">
              <UButton
                icon="i-lucide-plus"
                @click="triggerAction('UButton primary')"
              >
                Proyek baru
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-upload"
                @click="triggerAction('UButton outline (ghost prototype)')"
              >
                Buka file .json
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                @click="triggerAction('UButton borderless ghost')"
              >
                Simpan
              </UButton>
              <UButton
                color="error"
                variant="ghost"
                @click="triggerAction('UButton danger text-only')"
              >
                Hapus
              </UButton>
            </div>
            <div class="flex flex-wrap items-center gap-2.5 pt-2 border-t border-line">
              <UButton
                size="lg"
                @click="triggerAction('UButton CTA 40px')"
              >
                Buat proyek pertama
              </UButton>
              <UButton
                size="xl"
                color="neutral"
                variant="outline"
                @click="triggerAction('UButton CTA 44px')"
              >
                Buka proyek contoh
              </UButton>
              <UButton disabled>
                Nonaktif
              </UButton>
            </div>
          </div>

          <div class="card-surface p-5 space-y-4">
            <span class="field-label">Utilitas CSS Prototype (.btn-primary / .btn-ghost)</span>
            <div class="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                class="btn-primary"
                @click="triggerAction('.btn-primary')"
              >
                Proyek baru
              </button>
              <button
                type="button"
                class="btn-ghost"
                @click="triggerAction('.btn-ghost')"
              >
                Buka file .json
              </button>
              <button
                type="button"
                class="btn-primary"
                disabled
              >
                Nonaktif
              </button>
              <button
                type="button"
                class="btn-ghost"
                disabled
              >
                Ghost nonaktif
              </button>
            </div>

            <div class="pt-2 border-t border-line space-y-2.5">
              <span class="field-label">Filter Chip</span>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="chip"
                  :aria-pressed="selectedChip === 'semua'"
                  @click="selectedChip = 'semua'; triggerAction('Chip Semua')"
                >
                  Semua
                </button>
                <button
                  type="button"
                  class="chip"
                  :aria-pressed="selectedChip === 'sa'"
                  @click="selectedChip = 'sa'; triggerAction('Chip Supply Air')"
                >
                  Supply Air (SA)
                </button>
                <button
                  type="button"
                  class="chip"
                  :aria-pressed="selectedChip === 'ea'"
                  @click="selectedChip = 'ea'; triggerAction('Chip Exhaust Air')"
                >
                  Exhaust Air (EA)
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-surface p-5 space-y-4">
          <span class="field-label">Kartu Opsi Export (.opt)</span>
          <div
            role="radiogroup"
            aria-label="Format export contoh"
            class="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          >
            <label class="opt">
              <input
                v-model="exportFormat"
                type="radio"
                name="tema-fmt"
                value="dxf"
              >
              <strong class="text-sm text-ink">DXF</strong>
              <span class="text-xs text-muted leading-snug">Buka di AutoCAD, layer ikut.</span>
            </label>
            <label class="opt">
              <input
                v-model="exportFormat"
                type="radio"
                name="tema-fmt"
                value="png"
              >
              <strong class="text-sm text-ink">PNG</strong>
              <span class="text-xs text-muted leading-snug">Gambar untuk kirim chat.</span>
            </label>
            <label class="opt">
              <input
                v-model="exportFormat"
                type="radio"
                name="tema-fmt"
                value="pdf"
              >
              <strong class="text-sm text-ink">PDF</strong>
              <span class="text-xs text-muted leading-snug">Cetak vektor berskala.</span>
            </label>
            <label class="opt">
              <input
                v-model="exportFormat"
                type="radio"
                name="tema-fmt"
                value="json"
              >
              <strong class="text-sm text-ink">.json</strong>
              <span class="text-xs text-muted leading-snug">Cadangan file proyek.</span>
            </label>
          </div>
        </div>
      </section>

      <!-- 4. INPUT & FORM -->
      <section
        id="input"
        class="scroll-mt-24 space-y-5"
      >
        <div>
          <h2 class="font-cond font-bold text-3xl leading-none">
            Input, Segmented Control &amp; Field Unit
          </h2>
          <p class="mt-1.5 text-sm text-muted">
            Fokus memakai border <code class="font-mono text-ink">ink</code> ditambah ring <code class="font-mono text-ink">hazard</code> 45%.
          </p>
        </div>

        <form
          class="card-surface p-5 sm:p-6 space-y-5"
          @submit.prevent="submitSampleForm"
        >
          <div class="grid md:grid-cols-2 gap-5">
            <UFormField
              label="Nama proyek (UFormField + UInput)"
              name="nama"
              help="Ditulis di kop gambar dan nama file export."
            >
              <UInput
                v-model="projectName"
                placeholder="mis. Kantor Lt. 2 – Ducting"
              />
            </UFormField>

            <UFormField
              label="Skala gambar (USelect)"
              name="skala"
              help="Mengatur ukuran teks dan label dimensi."
            >
              <USelect
                v-model="projectScale"
                :items="scaleOptions"
              />
            </UFormField>
          </div>

          <div class="grid md:grid-cols-2 gap-5">
            <div>
              <span class="field-label">Satuan duct (.seg)</span>
              <div class="seg">
                <label>
                  <input
                    v-model="ductUnit"
                    type="radio"
                    name="tema-unit"
                    value="inch"
                  >
                  inch
                </label>
                <label>
                  <input
                    v-model="ductUnit"
                    type="radio"
                    name="tema-unit"
                    value="mm"
                  >
                  mm
                </label>
              </div>
              <p class="hint">
                Contoh label: <span class="font-mono text-ink">{{ unitExample }}</span>
              </p>
            </div>

            <div>
              <span class="field-label">Sistem duct (.seg)</span>
              <div class="seg">
                <label>
                  <input
                    v-model="ductSystem"
                    type="radio"
                    name="tema-sys"
                    value="SA"
                  >
                  Supply (SA)
                </label>
                <label>
                  <input
                    v-model="ductSystem"
                    type="radio"
                    name="tema-sys"
                    value="EA"
                  >
                  Exhaust (EA)
                </label>
              </div>
              <p class="hint">
                Layer aktif: <span class="font-mono text-ink">DUCT-{{ ductSystem }}</span>
              </p>
            </div>
          </div>

          <div>
            <span class="field-label">Ruangan awal (.field-unit + pratinjau)</span>
            <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-start">
              <div>
                <label
                  for="tema-panjang"
                  class="sr-only"
                >Panjang ruangan (meter)</label>
                <div class="field-unit">
                  <input
                    id="tema-panjang"
                    v-model.number="roomLength"
                    type="number"
                    min="1"
                    max="200"
                    step="0.5"
                  >
                  <span>m</span>
                </div>
              </div>
              <div>
                <label
                  for="tema-lebar"
                  class="sr-only"
                >Lebar ruangan (meter)</label>
                <div class="field-unit">
                  <input
                    id="tema-lebar"
                    v-model.number="roomWidth"
                    type="number"
                    min="1"
                    max="200"
                    step="0.5"
                  >
                  <span>m</span>
                </div>
              </div>
              <svg
                viewBox="0 0 220 124"
                width="112"
                height="64"
                class="w-28 h-16 rounded-[6px] bg-cad-ground shrink-0"
                aria-hidden="true"
              >
                <rect
                  :x="roomPreview.x"
                  :y="roomPreview.y"
                  :width="roomPreview.w"
                  :height="roomPreview.h"
                  fill="#262b32"
                  stroke="#9aa3ad"
                  stroke-width="2"
                />
                <text
                  x="110"
                  y="68"
                  fill="#e5e7eb"
                  font-size="18"
                  font-family="JetBrains Mono, monospace"
                  text-anchor="middle"
                >
                  {{ roomPreview.label }}
                </text>
              </svg>
            </div>
            <p class="hint">
              Panjang × lebar, ukuran luar dinding.
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
            <p
              v-if="formFeedback"
              class="text-sm text-done-green font-medium"
              role="status"
            >
              {{ formFeedback }}
            </p>
            <p
              v-else
              class="text-xs text-muted"
            >
              Kirim form untuk memverifikasi status submit dan warna pesan.
            </p>
            <div class="flex items-center gap-2 ml-auto">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                @click="projectName = ''; formFeedback = ''"
              >
                Reset
              </UButton>
              <UButton type="submit">
                Simpan uji form
              </UButton>
            </div>
          </div>
        </form>
      </section>

      <!-- 5. DIALOG & TOAST -->
      <section
        id="dialog"
        class="scroll-mt-24 space-y-5"
      >
        <div>
          <h2 class="font-cond font-bold text-3xl leading-none">
            Dialog &amp; Toast
          </h2>
          <p class="mt-1.5 text-sm text-muted">
            Dialog memakai latar <code class="font-mono text-ink">panel</code>, footer <code class="font-mono text-ink">paper</code>, backdrop blur 2px; toast memakai <code class="font-mono text-ink">ink</code> dengan tombol aksi <code class="font-mono text-ink">hazard</code>.
          </p>
        </div>

        <div class="card-surface p-5 flex flex-wrap items-center gap-3">
          <UModal
            v-model:open="modalOpen"
            title="Proyek baru"
            description="Ruangan awal bisa diubah atau ditambah di editor."
          >
            <UButton>Buka dialog proyek baru</UButton>

            <template #body>
              <form
                id="tema-modal-form"
                class="space-y-4"
                @submit.prevent="submitModalProject"
              >
                <UFormField
                  label="Nama proyek"
                  name="modal-nama"
                >
                  <UInput
                    v-model="modalProjectName"
                    placeholder="mis. Ruko 3 Lantai – Exhaust Dapur"
                  />
                </UFormField>

                <div>
                  <span class="field-label">Satuan duct</span>
                  <div class="seg">
                    <label>
                      <input
                        v-model="modalUnit"
                        type="radio"
                        name="modal-unit"
                        value="inch"
                      >
                      inch
                    </label>
                    <label>
                      <input
                        v-model="modalUnit"
                        type="radio"
                        name="modal-unit"
                        value="mm"
                      >
                      mm
                    </label>
                  </div>
                </div>
              </form>
            </template>

            <template #footer>
              <UButton
                color="neutral"
                variant="outline"
                @click="modalOpen = false"
              >
                Batal
              </UButton>
              <UButton
                type="submit"
                form="tema-modal-form"
              >
                Buat proyek
              </UButton>
            </template>
          </UModal>

          <UButton
            color="neutral"
            variant="outline"
            @click="showUndoToast"
          >
            Tampilkan toast + Urungkan
          </UButton>
        </div>
      </section>

      <!-- 6. PERMUKAAN EDITOR -->
      <section
        id="editor"
        class="scroll-mt-24 space-y-5"
      >
        <div>
          <h2 class="font-cond font-bold text-3xl leading-none">
            Permukaan Editor, Layer &amp; BOQ
          </h2>
          <p class="mt-1.5 text-sm text-muted">
            Kartu daftar tetap datar saat diam; bayangan hanya muncul pada elemen melayang di atas kanvas.
          </p>
        </div>

        <div class="grid lg:grid-cols-[72px_18rem_1fr] gap-4 items-stretch">
          <!-- Rail -->
          <nav
            aria-label="Contoh rail editor"
            class="rounded-[10px] bg-ink p-1.5 flex lg:flex-col items-center gap-1"
          >
            <button
              v-for="tab in (['elemen', 'alat', 'teks', 'layer'] as const)"
              :key="tab"
              type="button"
              class="rail-btn capitalize"
              :aria-pressed="activeRail === tab"
              @click="activeRail = tab; triggerAction(`Rail ${tab}`)"
            >
              <UIcon
                :name="tab === 'elemen' ? 'i-lucide-shapes' : tab === 'alat' ? 'i-lucide-pencil-ruler' : tab === 'teks' ? 'i-lucide-type' : 'i-lucide-layers'"
                class="size-5"
                aria-hidden="true"
              />
              <span>{{ tab }}</span>
            </button>
          </nav>

          <!-- Panel kiri contoh (tool card & layer) -->
          <div class="rounded-[10px] bg-panel ring-1 ring-line p-4 space-y-4">
            <h3 class="pane-title">
              Alat &amp; Layer
            </h3>
            <div class="space-y-2">
              <button
                type="button"
                class="tool-card"
                :aria-pressed="activeToolCard === 'duct'"
                @click="activeToolCard = 'duct'; triggerAction('Alat Gambar duct')"
              >
                <UIcon
                  name="i-lucide-git-commit-horizontal"
                  class="size-5 text-ink shrink-0"
                  aria-hidden="true"
                />
                <span class="min-w-0">
                  <strong class="block text-[13px] text-ink">Gambar duct</strong>
                  <small class="block text-[11.5px] text-muted">Elbow dipasang otomatis</small>
                </span>
                <kbd class="ml-auto">D</kbd>
              </button>
              <button
                type="button"
                class="tool-card"
                :aria-pressed="activeToolCard === 'room'"
                @click="activeToolCard = 'room'; triggerAction('Alat Ruangan')"
              >
                <UIcon
                  name="i-lucide-square"
                  class="size-5 text-ink shrink-0"
                  aria-hidden="true"
                />
                <span class="min-w-0">
                  <strong class="block text-[13px] text-ink">Ruangan</strong>
                  <small class="block text-[11.5px] text-muted">Persegi atau bentuk L</small>
                </span>
                <kbd class="ml-auto">K</kbd>
              </button>
            </div>

            <ul
              class="space-y-0.5 pt-2 border-t border-line"
              aria-label="Daftar layer contoh"
            >
              <li
                v-for="layer in editorLayers"
                :key="layer.id"
                class="layer-row"
              >
                <input
                  :id="`layer-${layer.id}`"
                  v-model="layer.visible"
                  type="checkbox"
                  :aria-label="`Tampilkan layer ${layer.name}`"
                >
                <span
                  class="sw"
                  :style="{ background: layer.color }"
                  aria-hidden="true"
                />
                <label
                  :for="`layer-${layer.id}`"
                  class="font-mono text-xs text-ink flex-1"
                >{{ layer.name }}</label>
                <button
                  type="button"
                  class="lock-btn"
                  :aria-pressed="layer.locked"
                  :aria-label="`Kunci layer ${layer.name}`"
                  @click="layer.locked = !layer.locked"
                >
                  <UIcon
                    :name="layer.locked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
                    class="size-3.5"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
          </div>

          <!-- Kanvas gelap + panel melayang + viewbar + status bar -->
          <div class="rounded-[10px] bg-cad-ground overflow-hidden flex flex-col justify-between min-h-[20rem] border border-ink">
            <div class="p-4 flex flex-wrap items-start justify-between gap-4">
              <div class="space-y-1.5">
                <span class="font-mono text-xs uppercase tracking-[0.08em] text-stamp-green">DICEK · SIAP EXPORT</span>
                <p class="font-mono text-xs text-card/80">
                  Contoh – Kantor Lt. 2 · SKALA 1:100
                </p>
              </div>

              <!-- Panel properti melayang -->
              <aside
                aria-label="Contoh panel properti melayang"
                class="panel-surface p-3.5 w-full sm:w-64 space-y-2.5"
              >
                <div class="flex items-center justify-between">
                  <span class="field-label mb-0!">Properti</span>
                  <span class="font-mono text-[11px] text-muted">DUCT-SA</span>
                </div>
                <div class="port-row">
                  <span
                    class="sw bg-sa-paper"
                    aria-hidden="true"
                  />
                  <span class="font-mono text-ink">24"x20"</span>
                  <span class="ml-auto text-muted">Tersambung</span>
                </div>
                <div class="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    class="cb"
                    @click="triggerAction('Putar 90 derajat')"
                  >
                    Putar
                  </button>
                  <span class="cb-sep" />
                  <button
                    type="button"
                    class="cb danger"
                    @click="showUndoToast"
                  >
                    Hapus
                  </button>
                </div>
              </aside>
            </div>

            <div class="p-4 flex flex-wrap items-center justify-between gap-3">
              <!-- Status toggles -->
              <div class="flex flex-wrap items-center gap-1.5 bg-ink px-2.5 py-1.5 rounded-[8px]">
                <button
                  type="button"
                  class="sb-toggle"
                  :aria-pressed="statusOpts.snap"
                  @click="statusOpts.snap = !statusOpts.snap"
                >
                  SNAP
                </button>
                <button
                  type="button"
                  class="sb-toggle"
                  :aria-pressed="statusOpts.ortho"
                  @click="statusOpts.ortho = !statusOpts.ortho"
                >
                  ORTHO
                </button>
                <button
                  type="button"
                  class="sb-toggle"
                  :aria-pressed="statusOpts.grid"
                  @click="statusOpts.grid = !statusOpts.grid"
                >
                  GRID
                </button>
              </div>

              <!-- View bar melayang -->
              <div
                role="toolbar"
                aria-label="Contoh bar tampilan"
                class="inline-flex items-center gap-0.5 p-1 rounded-[12px] bg-panel shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.06)]"
              >
                <button
                  type="button"
                  class="vb-btn"
                  aria-label="Pilih"
                  :aria-pressed="viewTool === 'select'"
                  @click="viewTool = 'select'"
                >
                  <UIcon
                    name="i-lucide-mouse-pointer-2"
                    class="size-4"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="vb-btn"
                  aria-label="Geser kanvas"
                  :aria-pressed="viewTool === 'pan'"
                  @click="viewTool = 'pan'"
                >
                  <UIcon
                    name="i-lucide-hand"
                    class="size-4"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Callout & BOQ -->
        <div class="grid md:grid-cols-2 gap-4 items-start">
          <div class="callout">
            <strong class="font-semibold">Sketsa bantu:</strong> cek ulang ukuran di lapangan sebelum fabrikasi duct atau serah terima ke drafter.
          </div>

          <div class="card-surface p-4 boq-group">
            <h3>Contoh Tabel BOQ</h3>
            <table class="boq">
              <tbody>
                <tr>
                  <td>Duct lurus SA</td>
                  <td class="font-mono">
                    24"x20"
                  </td>
                  <td class="font-mono text-right">
                    12,5 m
                  </td>
                </tr>
                <tr>
                  <td>Elbow 90°</td>
                  <td class="font-mono">
                    24"x20"
                  </td>
                  <td class="font-mono text-right">
                    2 bh
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-line">
      <div class="max-w-6xl mx-auto px-4 py-3 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
        <span>Temandor · halaman acuan tema (mode pengembangan saja)</span>
        <NuxtLink
          to="/"
          class="underline underline-offset-2 text-ink"
        >
          Kembali ke beranda
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>
