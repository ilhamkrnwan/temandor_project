# M1 Fondasi

Proyek Nuxt siap dikembangkan: tooling, CI, tema yang sama dengan prototype, rute, dan deploy.

---

### M1-01 · Inisialisasi proyek Nuxt 4 di root

**Label:** `m1-fondasi` `setup` · **Estimasi:** 0,5 hari · **Butuh:** —
**Acuan:** ADR 0005, tabel versi di [README](README.md)

**Kerjakan**
- `bun create nuxt` di root repo (Nuxt 4, struktur `app/`). `prototype/` tetap utuh dan tidak ikut build.
- `.nvmrc` = `26`, `engines.node` = `>=26`, `packageManager` = Bun terbaru.
- Semua dependensi di tabel versi dipasang di versi terbaru (yang belum dipakai menyusul di tiketnya masing-masing).
- `tsconfig` strict. Coba TypeScript 7; jalankan `bunx nuxi typecheck`. Gagal karena `vue-tsc` → TypeScript 6 terbaru + catatan alasan di README.
- Folder core: `shared/cad/` (Nuxt 4 melarang import Vue/Nitro dari `shared/`, cocok dengan aturan core murni).
- `.gitignore` untuk `.nuxt/`, `.output/`, `node_modules/`, `dist/`.
- Tambah konfigurasi `nuxt` (port 3000) di `.claude/launch.json`.

**Selesai bila**
- [x] `bun run dev` jalan, `bun run generate` menghasilkan `.output/public`.
- [x] `bunx nuxi typecheck` lulus.
- [x] README root menjelaskan cara menjalankan app real dan prototype.

---

### M1-02 · Lint & tes

**Label:** `m1-fondasi` `setup` · **Estimasi:** 0,5 hari · **Butuh:** M1-01

**Kerjakan**
- `@nuxt/eslint` dengan stylistic (tanpa Prettier).
- Vitest: project `unit` (`shared/cad/**`, environment node) dan project `nuxt` (`@nuxt/test-utils`, happy-dom) untuk komponen.
- Playwright (Chromium + viewport HP) dengan `webServer` dari `bun run generate` + preview.
- Script: `dev`, `build`, `generate`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`.
- Satu tes contoh di tiap lapisan.

**Selesai bila**
- [x] `bun run lint && bun run typecheck && bun run test && bun run test:e2e` lulus di lokal.

> Catatan: `nuxt generate` memakai Nitro preset `static` (tanpa `.output/server`), jadi `preview` memakai server statis kecil di `scripts/serve.mjs`. Playwright memakai port 3100 agar tidak bentrok dengan `bun run dev` di 3000.

---

### M1-03 · CI GitHub Actions

**Label:** `m1-fondasi` `ci` · **Estimasi:** 0,5 hari · **Butuh:** M1-02

**Kerjakan**
- Workflow `ci.yml` untuk PR dan push ke `main`: setup Bun dengan cache + Node dari `.nvmrc`, `bun install --frozen-lockfile`, lint, typecheck, test, `generate`, Playwright (Chromium), unggah laporan Playwright saat gagal.
- Tetap jalankan `node prototype/app/test.js` sampai core selesai di-port (jaring pengaman).

**Selesai bila**
- [x] PR contoh menampilkan semua check hijau.

> Workflow `.github/workflows/ci.yml` diverifikasi di PR #52 dengan Bun 1.4.4: job `ci` lulus (1m39s) — run [44922601170](https://github.com/ilhamkrnwan/temandor_project/actions/runs/44922601170).

---

### M1-04 · Tema & token desain sama dengan prototype

**Label:** `m1-fondasi` `ui` · **Estimasi:** 1,5 hari · **Butuh:** M1-01
**Acuan:** `DESIGN.md` (frontmatter colors/typography), `prototype/app/css/app.css`, `prototype/app/js/ui.js` (config Tailwind)

**Kerjakan**
- `app/assets/css/main.css`: `@import "tailwindcss"; @import "@nuxt/ui";` + `@theme` berisi semua warna & font dari DESIGN.md (nama token sama: `hazard`, `ink`, `paper`, `panel`, `line`, `muted`, `sa-screen`, …).
- `@nuxt/fonts`: Barlow, Barlow Condensed, JetBrains Mono (self-host, tanpa Google Fonts CDN).
- `app.config.ts`: warna Nuxt UI (`primary` = hazard, `neutral` = skala ink/paper), radius & varian tombol meniru prototype.
- Port kelas komponen dari `app.css` (mis. `btn-ghost`, kartu, panel) sebagai varian Nuxt UI atau `@utility`. Jangan menyalin kelas yang tidak dipakai di MVP (marketplace, checkout).
- Halaman `/_tema` (dev saja) berisi semua token & komponen dasar untuk dicek berdampingan dengan prototype.

**Selesai bila**
- [x] Screenshot `/_tema` vs prototype: warna, font, tombol, input, dialog identik secara visual.
- [x] Kontras teks ≥ 4,5:1 (cek otomatis di Playwright dengan axe atau manual tercatat).

> Catatan: semua 30 pasangan warna teks/latar `DESIGN.md` diverifikasi ≥ 4,5:1 di `test/nuxt/ThemeTokens.nuxt.spec.ts` dan `contrast-check.py`; `/_tema` otomatis dibuang saat `bun run generate` (`!nuxt.options.dev`).

---

### M1-05 · Rute & layout dasar

**Label:** `m1-fondasi` · **Estimasi:** 0,5 hari · **Butuh:** M1-04
**Acuan:** ADR 0005

**Kerjakan**
- Halaman kosong berjudul untuk `/` (landing), `/proyek`, `/editor/[id]`, `/docs`, dan `error.vue` (404).
- `routeRules`: `/` dan `/docs` prerender; `/proyek/**` dan `/editor/**` `ssr: false`.
- Layout `default` (header beranda) dan `editor` (layar penuh, tanpa header).
- `useHead` per halaman (judul, deskripsi, bahasa `id`).

**Selesai bila**
- [x] `bun run generate` menghasilkan HTML statis untuk `/` dan `/docs`; `/editor/abc` jalan setelah di-deploy statis (fallback SPA).
- [x] Tes E2E: tiap rute terbuka tanpa error konsol.

> Catatan: `routeRules` mem-prerender `/` dan `/docs`, sementara `/proyek/**` dan `/editor/**` memakai `ssr: false` dengan fallback `200.html` (`public/_redirects` & `scripts/serve.mjs`). Seluruh 20 tes Playwright (desktop + HP) lulus.

---

### M1-06 · Deploy Cloudflare Pages

**Label:** `m1-fondasi` `ci` · **Estimasi:** 0,5 hari · **Butuh:** M1-03, M1-05

**Kerjakan**
- Pemilik repo membuat proyek Cloudflare Pages dan menyimpan `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` di GitHub Secrets.
- Job deploy di CI: `bun run generate` → `wrangler pages deploy .output/public`. Preview untuk tiap PR, production dari `main`.
- Fallback SPA untuk `/editor/*` dan `/proyek` (`_redirects` atau setting Pages).

**Selesai bila**
- [ ] URL preview muncul di PR; refresh di `/editor/<id>` tidak 404.
