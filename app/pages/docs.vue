<script setup lang="ts">
import {
  AI_TOOLS,
  BOQ_DISCLAIMER,
  COMMAND_REFERENCE,
  LAYERS,
  SHORTCUTS,
  SHORTCUT_SECTIONS,
} from '#shared/cad'

useHead({
  htmlAttrs: { lang: 'id' },
})

useSeoMeta({
  title: 'Dokumentasi · Temandor',
  description: 'Panduan lengkap menggunakan Temandor: mulai cepat, ruang kerja, ruangan & arsitektur, duct, validasi warning, export DXF/PDF/PNG/BOQ, pintasan keyboard, dan kontribusi.',
  ogTitle: 'Dokumentasi · Temandor',
  ogDescription: 'Panduan penggunaan Temandor, pintasan keyboard, daftar layer DXF R12, dan cara berkontribusi.',
  ogType: 'article',
})

interface DocSectionLink {
  id: string
  label: string
}

const tocSections: readonly DocSectionLink[] = [
  { id: 'mulai', label: 'Mulai cepat' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'ruangan', label: 'Ruangan & arsitektur' },
  { id: 'duct', label: 'Duct & sambungan' },
  { id: 'warning', label: 'Warning' },
  { id: 'export', label: 'Export & BOQ' },
  { id: 'pintasan', label: 'Pintasan & perintah' },
  { id: 'ai', label: 'Asisten AI' },
  { id: 'mcp', label: 'Server MCP' },
  { id: 'kontribusi', label: 'Kontribusi' },
  { id: 'dukung', label: 'Dukung Temandor' },
]

const shortcutsBySection = SHORTCUT_SECTIONS.map(section => ({
  section,
  items: SHORTCUTS.filter(s => s.section === section),
}))
</script>

<template>
  <div class="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10 items-start">
    <nav
      id="toc"
      data-testid="docs-toc"
      aria-label="Isi dokumentasi"
      class="hidden lg:block sticky top-6 self-start text-sm space-y-0.5 rounded-[10px] bg-panel ring-1 ring-line p-2.5"
    >
      <p class="px-2.5 py-1.5 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
        Daftar isi
      </p>
      <a
        v-for="item in tocSections"
        :key="item.id"
        :href="`#${item.id}`"
        class="block px-2.5 py-1.5 rounded-[6px] text-reading-gray hover:bg-hover-tint hover:text-ink transition-colors"
      >
        {{ item.label }}
      </a>
    </nav>

    <article class="max-w-3xl space-y-10 text-[15px] leading-relaxed text-reading-gray">
      <header class="space-y-3 border-b border-line pb-6">
        <h1 class="font-cond font-bold text-4xl sm:text-5xl leading-none text-ink">
          Dokumentasi
        </h1>
        <p class="text-base text-muted leading-relaxed">
          Temandor adalah aplikasi sketsa 2D ducting &amp; ventilasi untuk teknisi lapangan: gambar denah, rangkai duct, cek kesalahan otomatis, lalu export ke DXF R12 berlayer untuk AutoCAD. Gratis dan open source, jalan di browser, data tersimpan lokal di perangkatmu sendiri.
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <NuxtLink
            to="/proyek"
            class="btn-primary max-sm:min-h-11"
          >
            Buka aplikasi
          </NuxtLink>
          <a
            href="#dukung"
            class="btn-ghost max-sm:min-h-11"
          >
            <UIcon
              name="i-lucide-heart"
              class="size-4 text-danger"
              aria-hidden="true"
            />
            <span>Dukung</span>
          </a>
        </div>

        <!-- Jump links ringkas untuk layar HP/tablet -->
        <nav
          aria-label="Lompat ke bagian"
          class="lg:hidden flex flex-wrap gap-1.5 pt-2"
        >
          <a
            v-for="item in tocSections"
            :key="item.id"
            :href="`#${item.id}`"
            class="inline-flex items-center min-h-9 px-3 rounded-full bg-card ring-1 ring-line text-xs font-semibold text-ink hover:ring-line-strong"
          >
            {{ item.label }}
          </a>
        </nav>
      </header>

      <section
        id="mulai"
        class="space-y-3 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Mulai cepat
        </h2>
        <ol class="list-decimal pl-5 space-y-2">
          <li>
            Di halaman
            <NuxtLink
              to="/proyek"
              class="underline underline-offset-2 text-ink font-medium"
            >
              Proyek
            </NuxtLink>, klik <strong>Proyek baru</strong> lalu isi nama, dimensi ruangan awal, dan satuan duct (inch atau mm).
          </li>
          <li>Buka kategori <strong>Elemen</strong> di panel kiri, seret <strong>Indoor ducted</strong> (FCU) ke dalam ruangan.</li>
          <li>Tekan <kbd class="px-1.5 py-0.5 rounded bg-card ring-1 ring-line font-mono text-xs text-ink">D</kbd>, klik ujung supply FCU, lalu klik titik belokan. Elbow dipasang otomatis. Ketik panjang (mm) + <kbd class="px-1.5 py-0.5 rounded bg-card ring-1 ring-line font-mono text-xs text-ink">Enter</kbd> untuk panjang pas, lalu <kbd class="px-1.5 py-0.5 rounded bg-card ring-1 ring-line font-mono text-xs text-ink">Enter</kbd> lagi untuk selesai.</li>
          <li>Seret <strong>Diffuser</strong> ke ujung duct dan isi debitnya di panel Properti.</li>
          <li>Klik <strong>Export</strong> lalu pilih <strong>DXF</strong>. Layer ikut rapi dan siap dibuka di AutoCAD.</li>
        </ol>
        <p>
          Semua perubahan tersimpan otomatis di browser (IndexedDB). Untuk cadangan atau pindah perangkat, export <code class="font-mono text-xs bg-card px-1.5 py-0.5 rounded ring-1 ring-line text-ink">.json</code> lalu buka kembali lewat <strong>Buka file .json</strong> di halaman Proyek.
        </p>
      </section>

      <section
        id="workspace"
        class="space-y-3 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Workspace
        </h2>
        <p>
          Rail kiri berisi 5 kategori utama. Klik untuk membuka panelnya, klik lagi untuk menutup. Di HP/tablet, rail pindah ke bawah layar dan panel terbuka sebagai lembar bawah.
        </p>
        <div class="overflow-x-auto rounded-[10px] bg-card ring-1 ring-line">
          <table class="w-full border-collapse text-sm">
            <tbody>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink w-32 align-top">
                  Elemen
                </th>
                <td class="py-2.5 px-3">
                  29 komponen siap pakai: arsitektur (kolom, pintu, jendela, tangga, lift, shaft, balok), equipment, duct, fitting, diffuser, dan grille. Seret ke kanvas atau klik lalu klik di kanvas. Dilengkapi kolom cari.
                </td>
              </tr>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink align-top">
                  Alat
                </th>
                <td class="py-2.5 px-3">
                  Alat gambar langsung: jalur duct (<code class="font-mono text-xs text-ink">D</code>), ruangan kotak (<code class="font-mono text-xs text-ink">K</code>), ruangan bebas (<code class="font-mono text-xs text-ink">P</code>), partisi (<code class="font-mono text-xs text-ink">W</code>), ukur (<code class="font-mono text-xs text-ink">U</code>), dan coretan tangan (<code class="font-mono text-xs text-ink">B</code>).
                </td>
              </tr>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink align-top">
                  Teks
                </th>
                <td class="py-2.5 px-3">
                  Judul, subjudul, teks biasa, serta <strong>Catatan + panah</strong> untuk menunjuk komponen lapangan.
                </td>
              </tr>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink align-top">
                  Layer
                </th>
                <td class="py-2.5 px-3">
                  Tampil/sembunyikan dan kunci tiap layer. Layer terkunci tidak ikut terpilih atau tergeser.
                </td>
              </tr>
              <tr>
                <th class="py-2.5 px-3 text-left font-semibold text-ink align-top">
                  Proyek
                </th>
                <td class="py-2.5 px-3">
                  Ringkasan satuan, skala, jumlah komponen, warning, tombol cepat ke
                  <a
                    href="#export"
                    class="underline underline-offset-2 text-ink"
                  >
                    Daftar material (BOQ)
                  </a>, dan tautan ke daftar proyek.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Panel <strong>Properti</strong> melayang di kanan saat ada komponen dipilih. Toolbar konteks muncul di atas pilihan untuk putar, cermin, kunci, duplikat, rata, dan hapus; klik kanan membuka menu lengkap. Tekan <code class="font-mono text-xs text-ink">Ctrl+.</code> untuk mode fokus.
        </p>
      </section>

      <section
        id="ruangan"
        class="space-y-3 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Ruangan &amp; arsitektur
        </h2>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Ruangan kotak (K):</strong> seret dua sudut atau klik sudut pertama lalu ketik <code class="font-mono text-xs text-ink">6x4</code> + Enter (meter).</li>
          <li><strong>Ruangan bebas (P):</strong> klik tiap titik sudut lalu klik titik awal, tekan Enter, atau klik kanan untuk menutup poligon (bentuk L, T, atau custom).</li>
          <li><strong>Edit bentuk:</strong> seret titik sudut atau sisi ruangan. Klik ganda sisi untuk menambah titik baru, klik ganda sudut untuk menghapus titik.</li>
          <li><strong>Pintu, jendela, bukaan:</strong> otomatis menempel ke dinding terdekat, memotong garis dinding, dan ikut bergeser bersama ruangan. Tekan <code class="font-mono text-xs text-ink">M</code> untuk balik engsel dan <code class="font-mono text-xs text-ink">R</code> untuk balik arah buka.</li>
          <li><strong>Partisi, kolom, tangga, lift, shaft:</strong> duct yang menabrak kolom/tangga/lift memicu warning; duct yang menembus dinding ditandai kotak <em>bobokan</em>.</li>
          <li>Klik ganda nama ruangan atau teks untuk mengubah isinya langsung di kanvas.</li>
        </ul>
      </section>

      <section
        id="duct"
        class="space-y-3 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Duct &amp; sambungan
        </h2>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Snap port otomatis:</strong> mendekatkan komponen baru ke ujung duct membantu menyelaraskan posisi dan arah sambungan.</li>
          <li><strong>Elbow parametrik:</strong> mendukung sudut bebas (5° sampai 150°), elbow mengecil (<em>reducing</em>) dengan mengisi ukuran ujung b, serta tipe <strong>Radius</strong> (1,0× atau 1,5× lebar) maupun <strong>Siku + vane</strong>.</li>
          <li><strong>Debit &amp; gantungan:</strong> total debit dari diffuser/grille dihitung ke FCU/fan, dan titik gantungan digambar otomatis tiap jarak yang diatur.</li>
          <li><strong>Catatan + panah:</strong> menunjuk titik tertentu di gambar dengan warna pilihan untuk catatan revisi lapangan.</li>
        </ul>
      </section>

      <section
        id="warning"
        class="space-y-3 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Warning
        </h2>
        <p>
          Temandor mengecek gambar terus-menerus. Warning bersifat pengingat dan tidak pernah menghalangi simpan atau export.
        </p>
        <div class="overflow-x-auto rounded-[10px] bg-card ring-1 ring-line">
          <table class="w-full border-collapse text-sm">
            <tbody>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink w-48">
                  Ujung terbuka
                </th>
                <td class="py-2.5 px-3">
                  Duct atau fitting belum tersambung. Sambungkan jalur atau pasang end cap.
                </td>
              </tr>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink">
                  Ukuran beda tanpa transisi
                </th>
                <td class="py-2.5 px-3">
                  Dua ukuran duct berbeda bertemu langsung. Tambahkan transisi atau pakai elbow reducing.
                </td>
              </tr>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink">
                  Sistem tercampur
                </th>
                <td class="py-2.5 px-3">
                  Duct supply (SA) tersambung langsung ke exhaust (EA).
                </td>
              </tr>
              <tr class="border-b border-line">
                <th class="py-2.5 px-3 text-left font-semibold text-ink">
                  Duct menabrak
                </th>
                <td class="py-2.5 px-3">
                  Jalur duct melewati kolom, tangga, atau lift. Menembus dinding ditandai bobokan (bukan error).
                </td>
              </tr>
              <tr>
                <th class="py-2.5 px-3 text-left font-semibold text-ink">
                  Debit belum diisi
                </th>
                <td class="py-2.5 px-3">
                  Diffuser atau grille belum memiliki angka debit udara.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Arahkan kursor ke tanda <strong class="text-danger">!</strong> untuk melihat penjelasan, atau klik untuk memilih komponen terkait. Klik tombol warning di status bar kanan bawah untuk membuka daftar lengkap.
        </p>
      </section>

      <section
        id="export"
        class="space-y-4 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Export &amp; Daftar material (BOQ)
        </h2>
        <p>
          Satu dialog <strong>Export</strong> menyediakan 4 format: <strong>DXF R12</strong> (untuk AutoCAD / drafter, satuan mm atau inch), <strong>PNG</strong> (latar kertas putih, siap kirim via Web Share / WhatsApp), <strong>PDF vektor berskala + kop</strong> (A4/A3, potret/lanskap, skala 1:50/1:100/1:200 atau muat ke kertas), dan <strong>.json</strong> (cadangan penuh proyek).
        </p>

        <div class="overflow-x-auto rounded-[10px] bg-card ring-1 ring-line">
          <table
            data-testid="docs-layer-table"
            class="w-full border-collapse text-sm"
          >
            <thead>
              <tr class="border-b border-line bg-panel text-left">
                <th class="py-2 px-3 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                  Layer DXF
                </th>
                <th class="py-2 px-3 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                  Isi
                </th>
                <th class="py-2 px-3 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted text-right">
                  ACI
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="layer in LAYERS"
                :key="layer.key"
                class="border-b border-line last:border-b-0"
              >
                <td class="py-2 px-3 font-mono text-xs text-ink">
                  {{ layer.dxf }}
                </td>
                <td class="py-2 px-3">
                  {{ layer.name }}
                </td>
                <td class="py-2 px-3 font-mono text-xs text-muted text-right">
                  {{ layer.aci }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="space-y-2 pt-1">
          <h3 class="font-cond font-bold text-xl text-ink">
            Daftar material (BOQ)
          </h3>
          <p>
            Buka dari dialog <strong>Export</strong>, panel <strong>Proyek</strong>, atau ketik <code class="font-mono text-xs text-ink">BOQ</code> di baris perintah. Menghitung otomatis panjang duct per sistem &amp; ukuran, fitting, diffuser/grille, titik gantungan, dan equipment. Tersedia <strong>Unduh CSV (Excel)</strong> dengan pemisah titik koma &amp; koma desimal Indonesia, serta <strong>Salin teks</strong> untuk WhatsApp.
          </p>
          <p class="rounded-lg bg-panel ring-1 ring-line px-3 py-2 text-xs text-muted">
            Catatan: {{ BOQ_DISCLAIMER }} Tambahkan faktor sisa potong sesuai standar bengkel atau proyek.
          </p>
        </div>
      </section>

      <section
        id="pintasan"
        class="space-y-4 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Pintasan &amp; baris perintah
        </h2>
        <p>
          Tabel di bawah diambil langsung dari sumber tunggal pintasan editor (sama dengan dialog bantuan <code class="font-mono text-xs text-ink">?</code> di editor).
        </p>

        <div class="grid sm:grid-cols-2 gap-4">
          <div
            v-for="group in shortcutsBySection"
            :key="group.section"
            class="rounded-[10px] bg-card ring-1 ring-line p-3.5 space-y-2"
          >
            <h3 class="font-cond text-xs font-bold tracking-[0.1em] uppercase text-muted">
              {{ group.section }}
            </h3>
            <dl class="space-y-1.5 text-xs">
              <div
                v-for="item in group.items"
                :key="item.id"
                class="flex items-center justify-between gap-2 border-b border-line/60 last:border-b-0 pb-1 last:pb-0"
              >
                <dt class="text-ink">
                  {{ item.label }}
                </dt>
                <dd class="flex items-center gap-1 shrink-0">
                  <kbd
                    v-for="k in item.keys"
                    :key="k"
                    class="px-1.5 py-0.5 rounded bg-paper ring-1 ring-line font-mono text-[11px] text-ink"
                  >{{ k }}</kbd>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="rounded-[10px] bg-card ring-1 ring-line p-3.5 space-y-2">
          <h3 class="font-cond text-xs font-bold tracking-[0.1em] uppercase text-muted">
            Perintah baris bawah (#cmd)
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div
              v-for="cmd in COMMAND_REFERENCE"
              :key="cmd.cmd"
              class="rounded bg-paper px-2.5 py-1.5"
            >
              <code class="font-mono font-bold text-ink">{{ cmd.cmd }}</code>
              <span class="block text-muted">{{ cmd.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="ai"
        class="space-y-4 scroll-mt-6"
      >
        <div class="flex items-center gap-2.5">
          <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
            Asisten AI
          </h2>
          <span class="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-hazard text-ink border border-ink font-cond text-xs font-bold tracking-[0.08em]">
            BYOK · CLAUDE
          </span>
        </div>
        <p>
          Di editor, klik tombol melayang <strong>Tanya AI</strong> atau tekan <kbd class="px-1.5 py-0.5 rounded bg-card ring-1 ring-line font-mono text-xs text-ink">Ctrl+K</kbd> untuk meminta bantuan menggambar, menambah ruangan/komponen, merangkai jalur duct, atau menjelaskan warning.
        </p>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Bawa kunci sendiri (BYOK):</strong> masukkan kunci API Anthropic Claude milikmu. Kunci disimpan lokal di browser ini saja (<code class="font-mono text-xs text-ink">localStorage</code>) dan <strong>hanya dikirim langsung ke <code class="font-mono text-xs text-ink">api.anthropic.com</code></strong> tanpa server perantara.</li>
          <li><strong>Aman di-undo:</strong> setiap batch perubahan AI dicatat sebagai <strong>satu langkah undo</strong>, komponen yang diubah langsung dipilih dan di-zoom, dan tersedia tombol <strong>Urungkan langkah ini</strong>.</li>
        </ul>

        <div class="overflow-x-auto rounded-[10px] bg-card ring-1 ring-line">
          <table
            data-testid="docs-ai-tools-table"
            class="w-full border-collapse text-sm"
          >
            <thead>
              <tr class="border-b border-line bg-panel text-left">
                <th class="py-2 px-3 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                  Tool AI
                </th>
                <th class="py-2 px-3 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                  Sifat
                </th>
                <th class="py-2 px-3 font-cond text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
                  Fungsi
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in AI_TOOLS"
                :key="t.name"
                class="border-b border-line last:border-b-0"
              >
                <td class="py-2 px-3 font-mono text-xs text-ink whitespace-nowrap">
                  {{ t.name }}
                </td>
                <td class="py-2 px-3 text-xs text-muted whitespace-nowrap">
                  {{ t.readOnly ? 'Baca saja' : 'Ubah gambar' }}
                </td>
                <td class="py-2 px-3 text-xs">
                  {{ t.description }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="mcp"
        class="space-y-4 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Server MCP
        </h2>
        <p>
          Server <strong>Model Context Protocol (MCP)</strong> di <code class="font-mono text-xs text-ink">packages/mcp/</code> memakai logika CAD yang sama (<code class="font-mono text-xs text-ink">@temandor/core</code>) lewat transport <strong>stdio</strong>. AI seperti <strong>Claude Code</strong> atau <strong>Claude Desktop</strong> bisa membuat proyek, menggambar duct, mengecek warning, lalu menulis file <code class="font-mono text-xs text-ink">.json</code> dan <code class="font-mono text-xs text-ink">.dxf</code> langsung ke satu folder lokal (<code class="font-mono text-xs text-ink">TEMANDOR_DIR</code>, bawaan <code class="font-mono text-xs text-ink">~/Temandor</code>).
        </p>

        <div class="space-y-2">
          <h3 class="font-cond font-bold text-lg text-ink">
            Setup di Claude Code
          </h3>
          <pre
            tabindex="0"
            class="rounded-[10px] bg-ink text-card p-4 overflow-x-auto font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-hazard"
          ><code>claude mcp add temandor \
  -e TEMANDOR_DIR=/path/ke/folder-proyek \
  -- bun /path/ke/temandor/packages/mcp/src/cli.ts</code></pre>
        </div>

        <div class="space-y-2">
          <h3 class="font-cond font-bold text-lg text-ink">
            Setup di Claude Desktop
          </h3>
          <p class="text-sm">
            Tambahkan entri berikut ke <code class="font-mono text-xs text-ink">claude_desktop_config.json</code> lalu mulai ulang Claude Desktop:
          </p>
          <pre
            tabindex="0"
            class="rounded-[10px] bg-ink text-card p-4 overflow-x-auto font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-hazard"
          ><code>{
  "mcpServers": {
    "temandor": {
      "command": "bun",
      "args": ["/path/ke/temandor/packages/mcp/src/cli.ts"],
      "env": {
        "TEMANDOR_DIR": "/path/ke/folder-proyek"
      }
    }
  }
}</code></pre>
        </div>

        <p class="text-sm">
          Selain 6 tool gambar di atas (ditambah parameter <code class="font-mono text-xs text-ink">file</code>), server MCP menyediakan 3 tool berkas: <code class="font-mono text-xs text-ink">list_projects</code>, <code class="font-mono text-xs text-ink">create_project</code>, dan <code class="font-mono text-xs text-ink">export_dxf</code>. Hasil <code class="font-mono text-xs text-ink">.json</code> bisa langsung dibuka di editor Temandor lewat <strong>Buka file .json</strong>.
        </p>
      </section>

      <section
        id="kontribusi"
        class="space-y-3 scroll-mt-6"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Kontribusi
        </h2>
        <p>
          Temandor bersifat open source dengan lisensi <strong>Apache 2.0</strong>. Repositori disusun sebagai <strong>Bun workspace</strong> berisi aplikasi Nuxt 4 SPA statis, paket inti CAD TypeScript murni (<code class="font-mono text-xs text-ink">packages/core/</code>), dan server MCP (<code class="font-mono text-xs text-ink">packages/mcp/</code>).
        </p>
        <pre
          tabindex="0"
          class="rounded-[10px] bg-ink text-card p-4 overflow-x-auto font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-hazard"
        ><code># pasang dependensi &amp; jalankan dev server
bun install
bun run dev

# jalankan server MCP secara manual (stdio)
bun run mcp

# jalankan lint, typecheck, tes unit, dan E2E
bun run lint
bun run typecheck
bun run test
bun run test:e2e</code></pre>
        <ul class="list-disc pl-5 space-y-1 text-sm">
          <li><code class="font-mono text-xs text-ink">packages/core/</code> (<code class="font-mono text-xs text-ink">@temandor/core</code>): tipe proyek v2, geometri, primitive, komponen HVAC, SVG, DXF R12, PDF layout, validasi, BOQ, dan aksi AI (TypeScript murni tanpa dependensi DOM/Vue).</li>
          <li><code class="font-mono text-xs text-ink">packages/mcp/</code> (<code class="font-mono text-xs text-ink">@temandor/mcp</code>): server MCP stdio untuk Claude Code / Claude Desktop yang membaca/menulis proyek <code class="font-mono text-xs text-ink">.json</code> dan export DXF.</li>
          <li><code class="font-mono text-xs text-ink">app/</code>: halaman landing, daftar proyek, editor interaktif + Asisten AI BYOK, dialog export, dan dokumentasi.</li>
          <li><code class="font-mono text-xs text-ink">docs/adr/</code> &amp; <code class="font-mono text-xs text-ink">docs/tickets/</code>: catatan keputusan arsitektur dan daftar tiket.</li>
        </ul>
      </section>

      <section
        id="dukung"
        class="space-y-3 scroll-mt-6 pb-4"
      >
        <h2 class="font-cond font-bold text-[1.9rem] leading-[1.1] text-ink">
          Dukung Temandor
        </h2>
        <p>
          Temandor gratis untuk semua mandor, teknisi, dan drafter HVAC. Cara paling nyata untuk membantu pengembangan:
        </p>
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="rounded-[10px] bg-card ring-1 ring-line p-4 space-y-1.5">
            <h3 class="font-semibold text-ink">
              Uji &amp; laporkan temuan lapangan
            </h3>
            <p class="text-sm text-muted">
              Coba buka hasil DXF di AutoCAD atau DWG TrueView, lalu laporkan ukuran atau layer yang kurang pas beserta file <code class="font-mono text-xs text-ink">.json</code> contohnya.
            </p>
          </div>
          <div class="rounded-[10px] bg-card ring-1 ring-line p-4 space-y-1.5">
            <h3 class="font-semibold text-ink">
              Bagikan ke rekan proyek
            </h3>
            <p class="text-sm text-muted">
              Kirim tautan Temandor ke sesama teknisi atau drafter yang sering membuat sketsa jalur ducting di lapangan.
            </p>
          </div>
        </div>
      </section>
    </article>
  </div>
</template>
