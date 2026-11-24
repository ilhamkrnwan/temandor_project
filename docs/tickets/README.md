# Tiket implementasi Temandor (Nuxt)

Tiket untuk menulis ulang prototype (`prototype/app`) menjadi aplikasi real. Keputusan dasarnya ada di [`docs/adr/`](../adr/) 0005–0009. Draf ini direview dulu, lalu dibuat jadi GitHub Issues (satu tiket = satu issue, milestone = M0–M6, label sesuai baris **Label**).

## Milestone

| Milestone | Isi | Tiket |
|---|---|---|
| [M0 Validasi](M0-validasi.md) | Uji DXF di AutoCAD, wawancara mandor & drafter. Non-kode, paralel dengan M1–M2. | 5 |
| [M1 Fondasi](M1-fondasi.md) | Proyek Nuxt, tooling, CI, tema, rute, deploy. | 6 |
| [M2 Core & editor dasar](M2-core-editor.md) | Tipe data, geometri, render SVG, viewport, store + undo, seleksi, transformasi, shell workspace. | 11 |
| [M3 HVAC & arsitektur](M3-hvac.md) | Fitting parametrik, port, gambar duct, perlengkapan, ruangan, arsitektur, anotasi, validasi, properti, layer. | 11 |
| [M4 File & export](M4-file-export.md) | Daftar proyek, format file + migrasi, DXF, PNG, PDF, BOQ. | 7 |
| [M5 Rilis v0.1](M5-rilis.md) | Landing, docs, aksesibilitas & HP, E2E, PWA (opsional), rilis. | 7 |
| [M6 AI & MCP](M6-ai-mcp.md) | Setelah MVP: asisten AI BYOK Claude, server MCP. | 3 |

Urutan: M0 jalan paralel dengan M1–M2. M3 → M4 → M5 berurutan. Hasil M0 boleh mengubah urutan atau isi M3–M5 (ADR 0008). M6 setelah v0.1 rilis.

## Konvensi

- **ID:** `M<milestone>-<nomor>`, dipakai juga di judul issue dan nama branch (`feat/m2-04-render-svg`).
- **Estimasi:** 0,5–2 hari kerja untuk satu orang. Lebih dari itu = pecah tiket.
- **Butuh:** tiket yang harus selesai dulu.
- **Acuan:** file prototype yang di-port. Perilaku prototype = spesifikasi, kecuali tiket menyebut beda.
- **Selesai bila:** semua kotak tercentang, tes lulus di CI, tampilan dicek berdampingan dengan prototype (untuk tiket UI).
- Core CAD (`shared/cad/`) tidak boleh import Vue, Nuxt, atau DOM. Setiap file core punya tes Vitest.

## Versi (dicek dari registry npm, 2026-11-21)

Pakai versi terbaru saat `M1-01` dikerjakan. Tabel ini batas bawah; jangan turun di bawahnya.

| Paket | Versi | Catatan |
|---|---|---|
| Node.js | 26.13.1 LTS | `.nvmrc` + `engines`. Nuxt butuh ≥22.22.3 |
| bun | 1.4.4 | `packageManager` di `package.json` |
| nuxt | 4.6.4 | Belum ada Nuxt 5 |
| vue | 3.5.46 | |
| vite | 8.3.8 | Bawaan Nuxt |
| typescript | 7.0.2 | Hanya jika `vue-tsc` + `nuxi typecheck` lulus; jika tidak, TS 6 terbaru (catat di README) |
| vue-tsc | 3.3.14 | |
| @nuxt/ui | 4.13.0 | Wajib Tailwind 4 |
| tailwindcss | 4.3.5 | |
| @nuxt/fonts | 1.2.0 | Barlow, Barlow Condensed, JetBrains Mono |
| @nuxt/icon | 2.6.3 | + `@iconify-json/lucide` 1.2.157 |
| pinia / @pinia/nuxt | 4.1.0 / 1.0.3 | |
| @vueuse/nuxt | 15.0.0 | |
| idb-keyval | 6.3.0 | ADR 0006 |
| zod | 4.6.7 | Validasi file `.json` yang dibuka pengguna |
| nanoid | 6.0.2 | ID komponen |
| jspdf / svg2pdf.js | 4.2.1 / 2.9.0 | ADR 0007 |
| @nuxt/eslint / eslint | 1.17.0 / 10.15.0 | Stylistic dari `@nuxt/eslint`, tanpa Prettier |
| vitest | 5.1.1 | |
| @nuxt/test-utils | 4.4.0 | + `happy-dom` 21.0.4, `@vue/test-utils` 2.6.0 |
| @playwright/test | 1.65.1 | |
| wrangler | 4.166.0 | Deploy Cloudflare Pages (M1-06) |
| @vite-pwa/nuxt | 2.0.3 | Opsional (M5-06) |
| @anthropic-ai/sdk | 1.12.0 | M6 |
| @modelcontextprotocol/sdk | 1.32.2 | M6 |

Sengaja tidak dipakai: `@nuxt/content` dan `@nuxtjs/i18n` (ADR 0005), `dexie` (ADR 0006), `dxf-writer`, `dxf-parser`, `pdf-lib` (tidak terawat, ADR 0007).
