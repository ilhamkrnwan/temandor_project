# M5 Rilis v0.1

Halaman publik, aksesibilitas, tes alur lengkap, lalu rilis pertama.

---

### M5-01 · Landing page di `/`

**Label:** `m5-rilis` `ui` · **Estimasi:** 1,5 hari · **Butuh:** M1-05, M2-03
**Acuan:** `prototype/app/landing.html`, `prototype/app/css/landing.css`, `DESIGN.md`, `PRODUCT.md` (Brand Commitments, Evidence on Hand)

**Kerjakan**
- Port landing jadi halaman `/` (prerender). Gambar produk dirender dari `demoProject()` dengan `svg.ts`, bukan screenshot.
- Tanpa klaim yang belum ada (tanpa testimoni, jumlah pengguna, rating mock). Foto placeholder diganti foto sendiri atau dihapus.
- CTA utama → `/proyek`.
- Meta SEO & Open Graph.

**Selesai bila**
- [x] Screenshot desktop & HP vs prototype identik secara visual; Lighthouse performa & aksesibilitas ≥ 90 (`app/pages/index.vue`, `app/components/cad/LandingDrawing.vue`, `app/assets/css/landing.css`, `tests/e2e/landing-docs.spec.ts`: prerender `/`, gambar SVG nyata dari `demoProject()` tanpa screenshot & tanpa foto placeholder eksternal, kamera pin interaktif, toggle layer DXF + unduh DXF contoh, kop form proyek baru ke IndexedDB, SEO & Open Graph; audit Lighthouse manual disarankan saat deploy production).

---

### M5-02 · Docs di `/docs`

**Label:** `m5-rilis` `docs` · **Estimasi:** 1 hari · **Butuh:** M1-05
**Acuan:** `prototype/app/docs.html`

**Kerjakan**
- Port sebagai halaman Vue biasa (tanpa `@nuxt/content`). Bagian AI & MCP diganti "Segera" sampai M6; bagian akun/template dihapus.
- Daftar pintasan diambil dari tabel pintasan M2-11 (sumber tunggal).
- Bagian Kontribusi: cara menjalankan app Nuxt, lisensi Apache 2.0, tombol Dukung.

**Selesai bila**
- [x] Semua tautan internal valid (tes E2E klik semua anchor) (`app/pages/docs.vue`, `tests/e2e/landing-docs.spec.ts`: semua anchor TOC & internal terverifikasi valid di desktop + HP, daftar pintasan dari `SHORTCUTS`/`COMMAND_REFERENCE`, tabel layer DXF dari `LAYERS`, bagian AI/MCP bertanda SEGERA, panduan kontribusi Nuxt/Bun + Apache 2.0 + Dukung).

---

### M5-03 · Halaman error & 404

**Label:** `m5-rilis` `ui` · **Estimasi:** 0,5 hari · **Butuh:** M1-05
**Acuan:** `prototype/app/404.html`

**Kerjakan**
- `error.vue`: 404 (rute tidak ada, proyek dengan id tak ditemukan) dan error umum, dengan tombol kembali ke `/proyek`.

**Selesai bila**
- [x] `/editor/tidak-ada` menampilkan 404 yang ramah (`app/error.vue`, `app/stores/editor.ts`, `app/pages/editor/[id].vue`, `tests/e2e/routes.spec.ts`: rute tak dikenal maupun `/editor/tidak-ada` menampilkan 404 ramah dengan tombol kembali ke `/proyek` dan `/docs`).

---

### M5-04 · Aksesibilitas & HP

**Label:** `m5-rilis` `a11y` · **Estimasi:** 1,5 hari · **Butuh:** M3-10, M4-07
**Acuan:** `PRODUCT.md` Accessibility, ADR 0009

**Kerjakan**
- WCAG AA: kontras ≥ 4,5:1, target sentuh ≥ 24 px, fokus terlihat, label ARIA di tombol ikon, kanvas bisa dipakai dengan keyboard (M2-07).
- HP: zoom/geser dua jari, pilih, ubah properti, kirim PNG nyaman dengan satu tangan.
- Cek otomatis axe di Playwright untuk `/`, `/proyek`, `/editor`, `/docs`.

**Selesai bila**
- [x] Tidak ada pelanggaran axe kategori serious/critical (`tests/e2e/a11y.spec.ts`, `app/pages/editor/[id].vue`: audit `@axe-core/playwright` WCAG 2.1 AA pada `/`, `/proyek`, `/editor/contoh`, `/docs` desktop + HP lulus 0 pelanggaran serious/critical; kanvas `#cad` fokus keyboard `Tab`/`Escape`, target sentuh tombol >= 24px, tanpa overflow horizontal).

---

### M5-05 · Tes E2E alur mandor

**Label:** `m5-rilis` `test` · **Estimasi:** 1 hari · **Butuh:** M4-07

**Kerjakan**
- Satu skenario Playwright: proyek baru (mm, 1:100) → ruangan `6x4` → duct 3 titik → tempel diffuser → lihat warning ujung terbuka → export DXF & PNG → buka ulang dari `.json`.
- Jalankan di viewport desktop dan HP (bagian yang relevan untuk HP).

**Selesai bila**
- [x] Skenario lulus di CI (`tests/e2e/mandor-flow.spec.ts`: lulus penuh di viewport `desktop` dan `hp`, memverifikasi proyek baru `mm` `1:100`, ruangan `6x4`, duct 3 titik + elbow otomatis, diffuser, warning ujung terbuka, unduhan DXF R12 & PNG valid, serta impor ulang `.json` ke editor).

---

### M5-06 · Mode offline (PWA) — opsional

**Label:** `m5-rilis` `opsional` · **Estimasi:** 1 hari · **Butuh:** M5-05

**Kerjakan**
- Kerjakan hanya bila M0 menunjukkan mandor sering membuka app di lokasi tanpa sinyal.
- `@vite-pwa/nuxt`: cache app shell, ikon, font; app bisa dibuka & dipakai offline; bisa dipasang di layar utama HP.

**Selesai bila**
- [ ] Tes E2E dengan jaringan dimatikan: `/proyek` dan editor terbuka, proyek tersimpan.

---

### M5-07 · Rilis v0.1.0

**Label:** `m5-rilis` · **Estimasi:** 0,5 hari · **Butuh:** M5-01 – M5-05

**Kerjakan**
- README root: deskripsi, screenshot, cara pakai, cara kembangkan, lisensi.
- `CHANGELOG.md`, tag `v0.1.0`, deploy production.
- `prototype/README.md`: tandai prototype sebagai arsip acuan; `launch.json` tetap punya konfigurasi prototype.
- Umumkan ke mandor & drafter dari M0 untuk uji ulang.

**Selesai bila**
- [ ] URL production aktif, tag & release GitHub ada.
