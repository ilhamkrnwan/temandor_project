# Temandor

Tool web open source untuk membantu **mandor dan teknisi HVAC pemula** membuat sketsa 2D denah ruangan serta jalur ducting dan ventilasi bergaya AutoCAD tanpa harus menguasai AutoCAD, lalu mengekspornya ke **DXF R12 berlayer rapi**, **PDF vektor berskala + kop**, **PNG**, dan **daftar material (BOQ)**.

> Setiap hasil export menyertakan pengingat **"Sketsa bantu - cek ulang ukuran di lapangan"**. Semua data proyek tersimpan lokal di browser perangkatmu tanpa login.

## Fitur Utama (v0.1.0)

- **Editor 2D komponen parametrik**: gambar jalur duct (Supply Air `SA` & Exhaust Air `EA`, kotak & bulat, satuan `inch` atau `mm`) dengan pemasangan **elbow otomatis** di tiap belokan (radius `1,0x`/`1,5x`, siku + vane, sudut bebas, maupun reducing).
- **Denah ruangan & arsitektur**: ruangan kotak (`K` / ketik `6x4`), ruangan bebas poligon (`P`), partisi (`W`), kolom, pintu/jendela/bukaan yang otomatis menempel & memotong dinding, tangga, lift, shaft, balok, garis ukur, teks bergaya, catatan + panah, dan coretan tangan.
- **Validasi non-blocking**: menandai ujung terbuka, ukuran beda tanpa transisi, sistem tercampur, debit kosong, dan duct menabrak kolom/tangga/lift langsung di kanvas tanpa melarang simpan atau export.
- **Export lengkap**:
  - **DXF R12 (`AC1009`)**: 12 layer AutoCAD (`DUCT-SA`, `DUCT-EA`, `EQUIPMENT`, `DIFFUSER`, `HANGER`, `DIMENSION`, `TEXT`, `A-WALL`, `A-COLS`, `A-DOOR`, `A-MISC`, `MARKUP`) + linetype `DASHED`, satuan `mm` atau `inch`.
  - **PDF vektor berskala + kop**: A4/A3, potret/lanskap, skala `1:50`/`1:100`/`1:200` atau muat ke kertas, kop pojok kanan bawah.
  - **PNG & Kirim**: latar kertas putih untuk WhatsApp lewat Web Share API (atau fallback unduh).
  - **Daftar material (BOQ)**: panjang duct, fitting, perlengkapan, gantungan, dan equipment; unduh CSV Excel Indonesia (`;` & koma desimal) atau salin teks WhatsApp.
  - **Cadangan `.json` v2**: simpan lokal di IndexedDB, ekspor/impor `.json`, dan migrasi otomatis dari berkas v1 prototype.

- **Asisten AI (BYOK Claude) & Server MCP**:
  - Di editor, klik **Tanya AI** (`Ctrl+K`) dengan kunci API Anthropic Claude milik sendiri (tersimpan lokal di browser, hanya dikirim langsung ke `api.anthropic.com`). Tiap batch perubahan = 1 langkah undo dan komponen langsung di-zoom.
  - Server MCP stdio (`packages/mcp/`) untuk Claude Code / Claude Desktop memakai inti CAD yang sama (`@temandor/core`), mendukung baca/edit file `.json` dan export `.dxf` di folder `TEMANDOR_DIR`.

## Struktur Repositori (Bun Workspace)

- `app/`: aplikasi **Nuxt 4** SPA statis (landing `/`, daftar proyek `/proyek`, editor `/editor/[id]`, dokumentasi `/docs`, halaman 404/error).
- `packages/core/` (`@temandor/core`, dire-export lewat `shared/cad/`): inti CAD **TypeScript murni** (tanpa impor Vue, Nuxt, Pinia, atau DOM) mencakup skema Zod v2, geometri, komponen, SVG, DXF R12, tata letak PDF, validasi, BOQ, dan aksi AI.
- `packages/mcp/` (`@temandor/mcp`): server MCP stdio (`@modelcontextprotocol/sdk`) untuk integrasi Claude Code / Claude Desktop.
- `tests/e2e/` & `test/nuxt/`: tes integrasi Nuxt, tes unit Vitest, tes aksesibilitas axe-core, dan tes E2E Playwright (desktop + HP).
- [`docs/adr/`](docs/adr/) & [`docs/tickets/`](docs/tickets/): catatan keputusan arsitektur dan tiket implementasi M0 sampai M6.
- [`prototype/`](prototype/): arsip acuan prototype P1 (HTML + vanilla JS) dan server MCP awal.
- [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md), [`CHANGELOG.md`](CHANGELOG.md): konteks produk, sistem desain, dan catatan rilis.

## Cara Mengembangkan

Membutuhkan **Bun 1.4+** (`packageManager` di `package.json`) dan **Node.js 26+** (`.nvmrc`).

```bash
bun install
bun run dev        # jalankan dev server di http://localhost:3000
bun run generate   # bangun situs statis ke .output/public
bun run preview    # pratinjau hasil generate di http://localhost:3000
bun run mcp        # jalankan server MCP (stdio, env TEMANDOR_DIR)
bun run lint       # ESLint
bun run typecheck  # Nuxt + vue-tsc
bun run test       # Vitest (packages/core + packages/mcp + modul Nuxt)
bun run test:e2e   # Playwright (Chromium desktop + viewport HP)
```

> Catatan: TypeScript dikunci pada `^6.0.3` sampai `vue-tsc` mendukung TypeScript 7.

## Menjalankan Arsip Prototype

```bash
python -m http.server 5179 --directory prototype/app
node prototype/app/test.js
```

## Lisensi

Kode sumber dilisensikan di bawah [Apache License 2.0](LICENSE). Nama dan logo Temandor bukan bagian dari lisensi tersebut.
