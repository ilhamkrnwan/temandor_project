# Temandor

Tool web untuk membantu **mandor pemula** membuat sketsa 2D jalur ducting dan ventilasi (bergaya AutoCAD, export ke DXF).

## Struktur

- **Aplikasi real (Nuxt 4)** di root: `app/`, `shared/cad/`, `docs/`.
- [`prototype/`](prototype/) — Prototype P1 (`prototype/app/`), server MCP (`prototype/mcp/`), dan mock UI P0 (`prototype/mock/`). Lihat [`prototype/README.md`](prototype/README.md); keputusan khusus prototype di [`prototype/docs/adr/`](prototype/docs/adr/).
- [`docs/adr/`](docs/adr/) — Keputusan untuk aplikasi real: stack, penyimpanan, DXF, scope MVP, HP.
- [`docs/tickets/`](docs/tickets/) — Tiket implementasi aplikasi real, M0 validasi sampai M6 AI & MCP.
- [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md) — Konteks produk dan sistem desain.

## Menjalankan aplikasi real

Butuh Node 26 (`.nvmrc`) dan pnpm 12.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm generate   # .output/public (situs statis)
pnpm preview    # pratinjau .output/public di http://localhost:3000 (server statis kecil)
pnpm lint
pnpm typecheck
pnpm test       # Vitest: core CAD + komponen Nuxt
pnpm test:e2e   # Playwright: Chromium desktop + viewport HP
```

TypeScript dipakai di **6.0.3**, bukan 7.0.2: `vue-tsc` 3.3.14 belum mendukung TypeScript 7 (`./lib/tsc` tidak diekspor). Naikkan lagi setelah `vue-tsc` mendukung.

Core CAD di `shared/cad/` adalah TypeScript murni: tidak boleh meng-import Vue, Nuxt, atau DOM.

## Menjalankan prototype

```bash
# Jalankan server statis lokal
python -m http.server 5179 --directory prototype/app

# Jalankan tes logika inti + server MCP
node prototype/app/test.js
```

## Lisensi

Kode sumber: [Apache License 2.0](LICENSE). Nama dan logo Temandor bukan bagian dari lisensi ini.
