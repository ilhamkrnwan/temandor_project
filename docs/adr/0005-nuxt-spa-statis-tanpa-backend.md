---
status: accepted
---
# Aplikasi real: Nuxt 4 SPA statis, render SVG, tanpa backend

Prototype (`prototype/app`) terbukti berguna tapi berupa HTML + vanilla JS tanpa tipe dan tanpa build. Aplikasi real ditulis ulang sebagai **satu proyek Nuxt 4 di root repo**, dikeluarkan sebagai situs statis (`nuxt generate`) dan di-host di Cloudflare Pages. Tidak ada server Temandor.

- **Core CAD** (geometri, model, validasi, DXF, BOQ) ditulis sebagai TypeScript murni di satu folder, **tanpa import Vue/Nuxt/DOM**, supaya bisa dites dengan Vitest dan dipakai ulang oleh server MCP nanti.
- **Render tetap SVG** seperti prototype. SVG yang sama dipakai untuk layar, thumbnail, PNG, dan PDF.
- **UI:** Nuxt UI 4 + Tailwind 4, tema dipetakan ke token `DESIGN.md` sehingga tampilan sama dengan prototype.
- **State editor:** Pinia; semua perubahan lewat command supaya undo/redo konsisten.
- **Rute:** `/` landing (prerender), `/proyek` daftar proyek, `/editor/[id]` editor (SPA, `ssr: false`), `/docs` (prerender), 404.
- **Bahasa:** UI Bahasa Indonesia saja, tanpa library i18n.
- **Tooling:** Bun, Node 26 LTS (dikunci lewat `.nvmrc` + `engines`), Vitest + Playwright, GitHub Actions per PR. Semua dependensi versi terbaru saat proyek dibuat; TypeScript 7 hanya jika `vue-tsc` sudah mendukung, kalau belum TypeScript 6.

## Considered Options

- **Canvas 2D** (saran ChatGPT): ditolak untuk sekarang. SVG sudah jalan, memudahkan seleksi/hit-test dan export. Pindah hanya jika profiling membuktikan lambat.
- **Bun workspace** (`apps/web`, `packages/core`, `packages/mcp`): ditunda. Dipecah saat server MCP benar-benar dibuat (M6).
- **Backend (Bun/Elysia/Postgres)**: tidak perlu sebelum ada fitur cloud/kolaborasi.
- **Tailwind murni tanpa Nuxt UI**: ditolak; Nuxt UI memberi dialog, menu, toast, tooltip yang sudah aksesibel.
