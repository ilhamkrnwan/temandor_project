# Temandor

Tool web untuk membantu **mandor pemula** membuat sketsa 2D jalur ducting dan ventilasi (bergaya AutoCAD, export ke DXF).

## Struktur

- [`prototype/`](prototype/) — Prototype P1 (`prototype/app/`), server MCP (`prototype/mcp/`), dan mock UI P0 (`prototype/mock/`). Lihat [`prototype/README.md`](prototype/README.md) untuk dokumentasi lengkap.

## Menjalankan Prototype

```bash
# Jalankan server statis lokal
python -m http.server 5179 --directory prototype/app

# Jalankan tes logika inti + server MCP
node prototype/app/test.js
```
