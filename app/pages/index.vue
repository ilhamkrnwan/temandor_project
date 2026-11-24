<script setup lang="ts">
import '~/assets/css/landing.css'
import {
  LAYERS,
  PAL,
  connect,
  ctxOf,
  demoProject,
  newProject,
  primBounds,
  projectBounds,
  sizeLabel,
  toDXF,
  validate,
  worldPrims,
  type Bounds,
  type LayerKey,
  type Node,
  type Point,
  type Unit,
} from '#shared/cad'
import type { LandingPin } from '../components/cad/LandingDrawing.vue'
import { downloadTextFile } from '../utils/projectFiles'
import { indexedDbProjectStorage } from '../utils/projectStorage'

definePageMeta({
  layout: false,
})

useHead({
  htmlAttrs: { lang: 'id' },
})

useSeoMeta({
  title: 'Temandor · Sketsa ducting rapi tanpa harus jago AutoCAD',
  description: 'Rangkai duct, elbow, dan diffuser seperti di lapangan. Temandor menandai yang janggal dan mengeluarkan DXF berlayer rapi untuk drafter. Gratis, jalan di browser.',
  ogTitle: 'Temandor · Sketsa ducting rapi tanpa harus jago AutoCAD',
  ogDescription: 'Buat sketsa 2D jalur ducting dan ventilasi gaya AutoCAD, validasi otomatis, lalu export DXF R12 berlayer, PDF vektor berskala, PNG, dan BOQ.',
  ogType: 'website',
  ogLocale: 'id_ID',
  twitterCard: 'summary_large_image',
})

const toast = useToast()

// Proyek contoh asli dirender langsung oleh core SVG (bukan tangkapan layar).
// ID node dinormalisasi deterministik agar urutan warning validate() identik antara SSR prerender dan hidrasi klien.
const demo = demoProject()
demo.nodes.forEach((node, index) => {
  node.id = `demo-${String(index).padStart(2, '0')}`
})
const demoConn = connect(demo)
const demoCtx = ctxOf(demo, demoConn)
const demoWarns = validate(demo, demoConn)

function nodeCenter(node: Node | undefined): Point {
  if (!node) return [0, 0]
  const b = primBounds(worldPrims(node, demoCtx))
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
}

const longestStraight = [...demo.nodes]
  .filter(n => n.type === 'straight')
  .sort((a, b) => (b.type === 'straight' ? b.L : 0) - (a.type === 'straight' ? a.L : 0))[0]
const firstElbow = demo.nodes.find(n => n.type === 'elbow')
const firstFcu = demo.nodes.find(n => n.type === 'fcu')
const warnOpen = demoWarns.find(w => w.kind === 'open') ?? demoWarns[0]
const warnSize = demoWarns.find(w => w.kind === 'size') ?? demoWarns[0]

const rawBounds = projectBounds(demo, demoCtx)
const margin = demoCtx.th * 3
const fullVb: Bounds = [
  rawBounds[0] - margin,
  rawBounds[1] - margin,
  rawBounds[2] - rawBounds[0] + 2 * margin,
  rawBounds[3] - rawBounds[1] + 2 * margin,
]
const pinR = fullVb[2] / 58

interface PinSpec {
  kind: 'feat' | 'warn'
  pos: Point
  title: string
  desc: string
  shortcut?: string
}

const sizeExampleText = warnSize?.detail.split('. ')[0] ?? 'Ukuran duct berbeda'

const punchItems: readonly PinSpec[] = [
  {
    kind: 'feat',
    pos: nodeCenter(firstElbow),
    title: 'Elbow dipasang sendiri',
    desc: 'Tekan D, klik titik demi titik. Tiap belokan langsung dapat elbow sesuai ukuran duct.',
    shortcut: 'D',
  },
  {
    kind: 'warn',
    pos: warnOpen?.pos ?? [4000, 2000],
    title: 'Ujung yang belum tersambung',
    desc: 'Ditandai merah di gambar. Klik tanda seru untuk melihat cara perbaikannya.',
  },
  {
    kind: 'warn',
    pos: warnSize?.pos ?? [9000, 4000],
    title: 'Ukuran beda tanpa transisi',
    desc: `${sizeExampleText}? Ditandai langsung, lengkap dengan saran pemasangan transisi.`,
  },
  {
    kind: 'feat',
    pos: nodeCenter(firstFcu),
    title: 'Debit dijumlah otomatis',
    desc: 'Total debit dari tiap diffuser dan grille dijumlahkan otomatis ke FCU dan fan.',
  },
  {
    kind: 'feat',
    pos: nodeCenter(longestStraight),
    title: 'Gantungan tiap 1,5 m',
    desc: 'Titik gantungan dan label ukuran duct digambar otomatis mengikuti jalur.',
  },
]

const heroPins: readonly LandingPin[] = punchItems.map((item, index) => ({
  kind: item.kind,
  pos: item.pos,
  index,
}))

const activePin = ref<number>(-1)
const camPins = computed<LandingPin[]>(() => punchItems.map((item, index) => ({
  kind: item.kind,
  pos: item.pos,
  index,
  active: index === activePin.value,
  done: activePin.value >= 0 && index < activePin.value,
})))

const camViewBox = computed<Bounds>(() => {
  if (activePin.value < 0 || activePin.value >= punchItems.length) return fullVb
  const target = punchItems[activePin.value]!.pos
  const aspect = fullVb[3] / fullVb[2]
  const w = fullVb[2] * 0.44
  const h = w * aspect
  const cx = target[0] + pinR * 0.75
  const cy = target[1] - pinR * 1.15
  return [cx - w / 2, cy - h / 2, w, h]
})

// Pratinjau potongan gambar di mockup ponsel (di sekitar elbow pertama)
const elbowPos = nodeCenter(firstElbow)
const phoneSpan = pinR * 16
const phoneVb: Bounds = [
  elbowPos[0] - phoneSpan * 0.55,
  elbowPos[1] - phoneSpan * 0.5,
  phoneSpan,
  phoneSpan * 1.25,
]
const elbowSizeText = firstElbow && firstElbow.type === 'elbow'
  ? sizeLabel(firstElbow.w, firstElbow.h, firstElbow.shape, demo.unit)
  : '18x14"'
const elbowAngleText = firstElbow && firstElbow.type === 'elbow'
  ? `${firstElbow.angle}°`
  : '90°'

// Layer DXF interaktif (10 layer inti CAD, tanpa coret)
const dxfLayerList = LAYERS.filter(l => l.key !== 'coret')
const activeDxfLayers = ref<Set<LayerKey>>(new Set(dxfLayerList.map(l => l.key)))

function toggleDxfLayer(key: LayerKey) {
  const next = new Set(activeDxfLayers.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  activeDxfLayers.value = next
}

function handleDownloadSampleDxf() {
  const content = toDXF(demoProject(), {
    layers: activeDxfLayers.value,
    unit: 'mm',
    note: true,
  })
  downloadTextFile('contoh-temandor.dxf', content, 'application/dxf')
  toast.add({
    title: 'DXF contoh diunduh',
    description: 'contoh-temandor.dxf siap dibuka di AutoCAD atau DWG TrueView.',
  })
}

// Form kop gambar = buat proyek baru sungguhan di IndexedDB
const formName = ref('')
const formLengthM = ref('9')
const formWidthM = ref('6')
const formUnit = ref<Unit>('inch')
const creatingProject = ref(false)

function parseMeters(raw: string, fallback: number): number {
  const parsed = Number(raw.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) return fallback
  return parsed
}

async function handleCreateFromKop() {
  if (creatingProject.value) return
  creatingProject.value = true
  try {
    const wMm = Math.round(parseMeters(formLengthM.value, 9) * 1000)
    const hMm = Math.round(parseMeters(formWidthM.value, 6) * 1000)
    const created = newProject({
      name: formName.value.trim() || 'Proyek baru',
      unit: formUnit.value,
      scale: '1:100',
      W: wMm,
      H: hMm,
    })
    await indexedDbProjectStorage.save(created)
    await navigateTo(`/editor/${created.id}`)
  }
  catch {
    toast.add({
      title: 'Gagal membuat proyek baru',
      description: 'Penyimpanan browser penuh atau dibatasi. Buka daftar proyek untuk mengelola proyek lama.',
    })
  }
  finally {
    creatingProject.value = false
  }
}

const faqs: ReadonlyArray<{ q: string, a: string }> = [
  {
    q: 'Harus bisa AutoCAD dulu?',
    a: 'Tidak. Temandor memakai istilah lapangan (duct, elbow, diffuser, gantungan). AutoCAD hanya dipakai drafter untuk membuka file DXF-nya.',
  },
  {
    q: 'Berapa biayanya?',
    a: 'Gratis dan open source (lisensi Apache 2.0). Berjalan langsung di browser tanpa berlangganan atau daftar akun.',
  },
  {
    q: 'Gambar saya disimpan di mana?',
    a: 'Tersimpan lokal di browser perangkatmu (IndexedDB). Untuk cadangan atau pindah perangkat, unduh file .json lalu buka lagi dari halaman Proyek.',
  },
  {
    q: 'DXF-nya bisa dibuka di AutoCAD?',
    a: 'Ya, memakai format DXF R12 (AC1009) berlayer rapi dengan pilihan satuan mm atau inch. Tetap cek ulang ukuran di lapangan sebelum fabrikasi.',
  },
  {
    q: 'Sistem apa saja yang bisa digambar?',
    a: 'Supply Air (SA) dan Exhaust Air (EA) dengan duct kotak maupun bulat, ukuran inch atau mm. Return dan fresh air menyusul di versi berikutnya.',
  },
]
</script>

<template>
  <div class="lp min-h-dvh flex flex-col">
    <a
      href="#mulai"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-primary"
    >
      Langsung ke form proyek baru
    </a>

    <!-- BAR ATAS -->
    <header class="lp-bar">
      <div class="tape absolute inset-x-0 top-0 h-[3px]" />
      <div class="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center gap-6">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 shrink-0 rounded-[6px]"
          aria-label="Temandor, halaman depan"
        >
          <span
            class="grid place-items-center size-8 rounded-[6px] bg-hazard"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-5"
              fill="none"
              stroke="#17191c"
              stroke-width="2.4"
            >
              <path d="M3 6h7a8 8 0 0 1 8 8v7M3 12h7a2 2 0 0 1 2 2v7" />
            </svg>
          </span>
          <span class="font-cond font-bold text-xl tracking-wide text-card">TEMANDOR</span>
        </NuxtLink>

        <nav
          class="hidden md:flex items-center gap-5 text-sm text-card/80"
          aria-label="Navigasi landing"
        >
          <a
            href="#cara-kerja"
            class="hover:text-card"
          >Cara kerja</a>
          <a
            href="#dxf"
            class="hover:text-card"
          >Hasil DXF</a>
          <a
            href="#tanya"
            class="hover:text-card"
          >Tanya jawab</a>
          <NuxtLink
            to="/docs"
            class="hover:text-card"
          >Docs</NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <NuxtLink
            to="/proyek"
            data-testid="landing-open-app"
            class="btn-primary h-9! px-4!"
          >
            Buka aplikasi
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <!-- HERO: LEMBAR GAMBAR MANDOR -->
      <section
        class="lp-hero"
        aria-labelledby="h-hero"
      >
        <div
          class="lp-grid"
          aria-hidden="true"
        />
        <div class="lp-frame">
          <div
            class="lp-zones lp-zones-x"
            aria-hidden="true"
          >
            <span>A</span><span>B</span><span>C</span><span>D</span><span>E</span><span>F</span>
          </div>
          <div
            class="lp-zones lp-zones-y"
            aria-hidden="true"
          >
            <span>1</span><span>2</span><span>3</span><span>4</span>
          </div>

          <div class="lp-hero-copy">
            <h1
              id="h-hero"
              class="lp-display text-card"
            >
              Sketsa ducting rapi.<br><span class="text-hazard">Tanpa harus jago AutoCAD.</span>
            </h1>
            <p class="mt-4 lg:mt-5 text-base lg:text-lg text-card/85 max-w-lg leading-relaxed">
              Rangkai duct, Temandor tandai yang janggal, keluar DXF berlayer siap buka di AutoCAD.
            </p>
            <div class="mt-5 flex flex-wrap items-center gap-2.5">
              <NuxtLink
                to="/proyek"
                class="btn-ghost lp-ghost h-10! px-4!"
              >
                Buka daftar proyek
              </NuxtLink>
              <NuxtLink
                to="/editor/contoh"
                class="btn-ghost lp-ghost h-10! px-4!"
              >
                Lihat proyek contoh
              </NuxtLink>
            </div>
          </div>

          <figure
            class="lp-hero-art"
            aria-labelledby="cap-hero"
          >
            <figcaption
              id="cap-hero"
              class="lp-art-cap"
            >
              <span>Contoh: Kantor Lt. 2, skala 1:100</span>
              <span class="flex gap-4">
                <span class="lg-key warn">peringatan</span>
                <span class="lg-key feat">otomatis</span>
              </span>
            </figcaption>
            <div
              data-testid="landing-hero-drawing"
              class="lp-hero-art-canvas"
            >
              <CadLandingDrawing
                :project="demo"
                palette="screen"
                :view-box="fullVb"
                :pins="heroPins"
                :pin-radius="pinR"
                aria-label="Gambar contoh nyata: denah kantor dengan jalur duct supply dan exhaust, dilengkapi 5 penanda fitur dan peringatan"
              />
            </div>
          </figure>

          <!-- Kop gambar = form proyek baru sungguhan -->
          <form
            id="mulai"
            data-testid="landing-kop-form"
            class="kop"
            aria-label="Buat proyek baru"
            @submit.prevent="handleCreateFromKop"
          >
            <div class="kop-row kop-title">
              <span class="kop-brand">TEMANDOR</span>
              <span>LEMBAR BARU · SKALA 1:100</span>
            </div>
            <div class="kop-row">
              <label class="kop-cell col-span-2">
                <span>Nama proyek</span>
                <input
                  v-model="formName"
                  data-testid="kop-name"
                  type="text"
                  autocomplete="off"
                  placeholder="Boleh dikosongkan"
                >
              </label>
            </div>
            <div class="kop-row">
              <div class="kop-cell">
                <span id="lbl-ruang">Ruangan (m)</span>
                <div
                  class="flex items-center gap-2"
                  role="group"
                  aria-labelledby="lbl-ruang"
                >
                  <input
                    v-model="formLengthM"
                    data-testid="kop-w"
                    type="text"
                    inputmode="decimal"
                    aria-label="Panjang ruangan dalam meter"
                    class="w-16!"
                  >
                  <span
                    class="text-card/70"
                    aria-hidden="true"
                  >×</span>
                  <input
                    v-model="formWidthM"
                    data-testid="kop-h"
                    type="text"
                    inputmode="decimal"
                    aria-label="Lebar ruangan dalam meter"
                    class="w-16!"
                  >
                </div>
              </div>
              <div class="kop-cell">
                <span id="lbl-unit">Satuan duct</span>
                <div
                  class="kop-seg"
                  role="radiogroup"
                  aria-labelledby="lbl-unit"
                >
                  <label>
                    <input
                      v-model="formUnit"
                      type="radio"
                      name="satuan"
                      value="inch"
                    >
                    inch
                  </label>
                  <label>
                    <input
                      v-model="formUnit"
                      type="radio"
                      name="satuan"
                      value="mm"
                    >
                    mm
                  </label>
                </div>
              </div>
            </div>
            <div class="kop-foot">
              <button
                type="submit"
                data-testid="kop-submit"
                class="btn-primary h-11! px-6! text-[15px]!"
                :disabled="creatingProject"
              >
                <span>{{ creatingProject ? 'Membuka...' : 'Mulai gambar' }}</span>
                <UIcon
                  name="i-lucide-arrow-right"
                  class="size-4"
                  aria-hidden="true"
                />
              </button>
              <p class="text-sm text-card/75">
                Gratis, tanpa daftar, tersimpan di browser ini.
              </p>
            </div>
          </form>
        </div>
      </section>

      <!-- PUNCH LIST + KAMERA INTERAKTIF -->
      <section
        id="cara-kerja"
        class="lp-punch"
        aria-labelledby="h-punch"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <h2
            id="h-punch"
            class="lp-h2 max-w-3xl text-card"
          >
            Saat kamu menggambar, Temandor ikut mengecek.
          </h2>
          <p class="mt-3 text-sm text-card/75 max-w-xl">
            Klik salah satu catatan di kanan untuk menyorot langsung titik komponennya pada gambar contoh.
          </p>

          <div class="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div class="lp-cam-wrap">
              <div
                data-testid="landing-cam"
                class="lp-cam"
              >
                <CadLandingDrawing
                  :project="demo"
                  palette="screen"
                  :view-box="camViewBox"
                  :pins="camPins"
                  :pin-radius="pinR"
                  decorative
                />
              </div>
              <div class="lp-cam-foot">
                <span class="flex gap-4">
                  <span class="lg-key warn">peringatan</span>
                  <span class="lg-key feat">otomatis</span>
                </span>
                <p class="lp-stamp">
                  {{ demoWarns.length }} CATATAN · TETAP BISA EXPORT
                </p>
              </div>
            </div>

            <ol class="lp-list">
              <li
                v-for="(item, idx) in punchItems"
                :key="item.title"
                :class="[item.kind, { on: activePin === idx }]"
              >
                <button
                  type="button"
                  :data-testid="`landing-pin-btn-${idx}`"
                  class="lp-punch-btn"
                  :aria-pressed="activePin === idx"
                  @click="activePin = activePin === idx ? -1 : idx"
                >
                  <span
                    class="lp-num"
                    aria-hidden="true"
                  >{{ idx + 1 }}</span>
                  <div>
                    <h3>{{ item.title }}</h3>
                    <p>{{ item.desc }}</p>
                  </div>
                </button>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <!-- HASIL DXF BERLAYER -->
      <section
        id="dxf"
        class="lp-paper"
        aria-labelledby="h-dxf"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
          <div>
            <h2
              id="h-dxf"
              class="lp-h2 text-ink"
            >
              Keluar sebagai DXF yang bisa dipakai drafter.
            </h2>
            <p class="mt-4 text-[17px] text-reading-gray max-w-xl leading-relaxed">
              Tiap jenis garis dipisahkan ke layer AutoCAD sendiri. Pilih satuan mm atau inch, atau cetak langsung ke PDF vektor berskala lengkap dengan kop.
            </p>
            <div class="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="landing-download-dxf"
                class="btn-primary h-11! px-5! text-[15px]!"
                @click="handleDownloadSampleDxf"
              >
                <UIcon
                  name="i-lucide-download"
                  class="size-4"
                  aria-hidden="true"
                />
                <span>Unduh DXF contoh</span>
              </button>
              <NuxtLink
                to="/editor/contoh"
                class="btn-ghost h-11! px-5! text-[15px]!"
              >
                Buka di editor
              </NuxtLink>
            </div>
            <p class="lp-note mt-8">
              Tiap export menyertakan catatan <strong>"Sketsa bantu - cek ulang ukuran di lapangan"</strong>.
            </p>
          </div>

          <div class="lp-layers">
            <div
              data-testid="landing-dxf-preview"
              class="lp-dxf-view"
            >
              <CadLandingDrawing
                :project="demo"
                palette="paper"
                :layers="activeDxfLayers"
                aria-label="Pratinjau file DXF contoh dengan layer yang sedang menyala"
              />
            </div>
            <div class="lp-layers-head">
              <span id="lbl-layers">Layer di file DXF</span>
              <span
                data-testid="landing-layers-count"
                aria-live="polite"
              >{{ activeDxfLayers.size }} dari {{ dxfLayerList.length }} menyala</span>
            </div>
            <div
              class="lp-layer-grid"
              role="group"
              aria-labelledby="lbl-layers"
            >
              <button
                v-for="layer in dxfLayerList"
                :key="layer.key"
                type="button"
                :data-testid="`landing-layer-${layer.key}`"
                class="lp-layer"
                :aria-pressed="activeDxfLayers.has(layer.key)"
                @click="toggleDxfLayer(layer.key)"
              >
                <i
                  :style="{ backgroundColor: PAL.paper.col[layer.key] }"
                  aria-hidden="true"
                />
                <code>{{ layer.dxf }}</code>
                <span>{{ layer.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- DI HP + ASISTEN AI & MCP -->
      <section
        class="lp-band"
        aria-labelledby="h-lap"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid gap-12 lg:grid-cols-2">
          <div>
            <h2
              id="h-lap"
              class="lp-h2 text-card"
            >
              Di HP: buka, cek, ubah sedikit.
            </h2>
            <div class="mt-8 grid gap-10 sm:grid-cols-[15.5rem_minmax(0,1fr)] items-center">
              <figure
                class="lp-device"
                aria-label="Pratinjau tampilan editor Temandor di HP dengan gambar contoh nyata"
              >
                <div
                  class="dv-screen"
                  aria-hidden="true"
                >
                  <div class="ph-bar">
                    <b>Contoh - Kantor Lt. 2</b>
                    <span class="ph-export">Export</span>
                  </div>
                  <div class="ph-canvas">
                    <CadLandingDrawing
                      :project="demo"
                      palette="screen"
                      :view-box="phoneVb"
                      preserve-aspect-ratio="xMidYMid slice"
                      decorative
                    />
                  </div>
                  <div class="ph-sheet">
                    <b>Elbow</b>
                    <span class="ph-row">
                      <span>Ukuran</span>
                      <span class="font-mono">{{ elbowSizeText }}</span>
                    </span>
                    <span class="ph-row">
                      <span>Sudut</span>
                      <span class="font-mono">{{ elbowAngleText }}</span>
                    </span>
                  </div>
                  <div class="ph-rail">
                    <span class="on" />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <figcaption class="sr-only">
                  Pratinjau vektor dari proyek contoh yang sama dengan editor
                </figcaption>
              </figure>

              <dl class="lp-facts">
                <div>
                  <dt>Dua jari</dt>
                  <dd>Zoom dan geser kanvas langsung di layar HP.</dd>
                </div>
                <div>
                  <dt>Ketuk</dt>
                  <dd>Ubah ukuran duct, sudut elbow, atau debit diffuser.</dd>
                </div>
                <div>
                  <dt>Kirim PNG</dt>
                  <dd>Bagikan gambar berlatar kertas putih langsung lewat WhatsApp.</dd>
                </div>
              </dl>
            </div>
          </div>

          <div aria-labelledby="h-ai">
            <h2
              id="h-ai"
              class="lp-h2 text-card"
            >
              Atau minta bantuan Asisten AI &amp; MCP.
            </h2>
            <div
              class="lp-chat mt-8"
              aria-label="Contoh percakapan Asisten AI di editor Temandor"
            >
              <span class="lp-chat-tag">BYOK · CLAUDE &amp; MCP</span>
              <p class="lp-chat-user">
                Tambah ruang rapat 6x5 m di sebelah kanan, dengan pintu dan 2 diffuser
              </p>
              <p class="lp-chat-tool">
                <span>Membaca gambar</span>
                <span>Menambah komponen</span>
                <span>Menggambar jalur duct</span>
              </p>
              <p class="lp-chat-bot">
                Sudah: ruang rapat 6×5 m, 1 pintu, 2 diffuser 300 cfm tersambung.
              </p>
            </div>
            <p class="mt-4 text-card/75 text-sm max-w-md leading-relaxed">
              Tekan <kbd class="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-card">Ctrl+K</kbd> di editor dengan kunci API Claude milikmu (hanya dikirim ke <code class="font-mono text-xs text-card">api.anthropic.com</code>), atau sambungkan Claude Code / Claude Desktop lewat
              <NuxtLink
                to="/docs#mcp"
                class="underline underline-offset-2 text-card hover:text-hazard"
              >
                server MCP
              </NuxtLink>.
            </p>
          </div>
        </div>
      </section>

      <!-- TANYA JAWAB -->
      <section
        id="tanya"
        class="lp-paper"
        aria-labelledby="h-faq"
      >
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <h2
            id="h-faq"
            class="lp-h2 text-ink"
          >
            Tanya jawab
          </h2>
          <div class="lp-faq mt-8">
            <details
              v-for="item in faqs"
              :key="item.q"
            >
              <summary>{{ item.q }}</summary>
              <p>{{ item.a }}</p>
            </details>
          </div>
        </div>
      </section>

      <!-- PENUTUP -->
      <section
        class="lp-close"
        aria-labelledby="h-close"
      >
        <div
          class="lp-grid"
          aria-hidden="true"
        />
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] items-center">
          <div>
            <h2
              id="h-close"
              class="lp-h2 uppercase text-card"
            >
              Ukur ruangannya,<br>sisanya kita rangkai.
            </h2>
            <div class="mt-8 flex flex-wrap gap-2.5">
              <NuxtLink
                to="/proyek"
                class="btn-primary h-12! px-6! text-base!"
              >
                Buka daftar proyek
              </NuxtLink>
              <NuxtLink
                to="/editor/contoh"
                class="btn-ghost lp-ghost h-12! px-6! text-base!"
              >
                Lihat proyek contoh
              </NuxtLink>
            </div>
          </div>

          <div class="rounded-[10px] border border-white/15 bg-cad-deep/90 p-5 space-y-3 text-sm">
            <p class="font-mono text-xs uppercase tracking-[0.08em] text-hazard">
              Format keluaran siap pakai
            </p>
            <dl class="space-y-2 text-card/85">
              <div class="flex justify-between gap-3 border-b border-white/10 pb-2">
                <dt class="font-mono text-card">
                  DXF R12
                </dt>
                <dd class="text-right text-card/75">
                  12 layer AutoCAD, mm / inch
                </dd>
              </div>
              <div class="flex justify-between gap-3 border-b border-white/10 pb-2">
                <dt class="font-mono text-card">
                  PDF Vektor
                </dt>
                <dd class="text-right text-card/75">
                  A4 / A3 berskala + kop gambar
                </dd>
              </div>
              <div class="flex justify-between gap-3 border-b border-white/10 pb-2">
                <dt class="font-mono text-card">
                  PNG &amp; BOQ
                </dt>
                <dd class="text-right text-card/75">
                  Kirim WhatsApp &amp; CSV Excel
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="font-mono text-card">
                  .json v2
                </dt>
                <dd class="text-right text-card/75">
                  Cadangan lokal tanpa akun
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>

    <footer class="lp-foot">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-card/75">
        <span class="font-cond font-bold text-card tracking-wide">TEMANDOR</span>
        <span>Sketsa 2D ducting &amp; ventilasi · lisensi Apache 2.0</span>
        <nav
          class="flex flex-wrap gap-x-5 gap-y-2 ml-auto"
          aria-label="Tautan bawah"
        >
          <NuxtLink
            to="/proyek"
            class="hover:text-card"
          >Aplikasi</NuxtLink>
          <NuxtLink
            to="/docs"
            class="hover:text-card"
          >Dokumentasi</NuxtLink>
          <NuxtLink
            to="/docs#kontribusi"
            class="hover:text-card"
          >Kontribusi</NuxtLink>
          <NuxtLink
            to="/docs#dukung"
            class="hover:text-card"
          >Dukung</NuxtLink>
        </nav>
      </div>
    </footer>
  </div>
</template>
