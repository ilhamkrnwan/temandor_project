# Changelog

Semua perubahan penting pada **Temandor** dicatat di berkas ini.

## [0.1.0] - 2026-11-24

### Ditambahkan
- **Aplikasi Nuxt 4 SPA statis** tanpa backend dengan penyimpanan lokal IndexedDB (`idb-keyval`) dan ekspor/impor berkas proyek `.json` v2 (+ migrasi otomatis dari berkas v1 prototype).
- **Inti CAD TypeScript murni** (`packages/core/`, `@temandor/core`): model proyek v2 dengan validasi Zod, geometri 2D & primitive, 30 komponen parametrik HVAC + arsitektur, snap/ortho, seleksi, grip interaktif, group/align/lock/order, undo/redo dengan batas riwayat, autosave, dan aksi AI murni.
- **Alat gambar lapangan**: jalur duct dengan elbow otomatis (radius 1,0x/1,5x, siku + vane, sudut bebas, reducing), ruangan kotak (`6x4`) & poligon bebas, pintu/jendela/bukaan menempel dinding, dimensi, teks bergaya, catatan + panah, dan coretan tangan.
- **Anotasi & validasi otomatis**: label ukuran, panah aliran, titik gantungan otomatis, jumlah debit per FCU/fan, dan warning non-blocking (ujung terbuka, ukuran beda tanpa transisi, sistem tercampur, debit kosong, tabrakan kolom/tangga/lift).
- **Export & BOQ terpadu**:
  - **DXF R12 (`AC1009`)** berlayer (12 layer + warna ACI + linetype `DASHED` untuk balok & bukaan, satuan `mm` atau `inch`).
  - **PDF vektor berskala + kop** (`jspdf` + `svg2pdf.js` lazy-loaded, A4/A3 potret/lanskap, skala `1:50`/`1:100`/`1:200` atau muat ke kertas).
  - **PNG** resolusi tinggi berlatar kertas putih + tombol **Kirim gambar PNG** (Web Share API dengan fallback unduh).
  - **Daftar material (BOQ)** otomatis dengan unduh CSV Excel Indonesia (`;` & koma desimal) dan salin teks WhatsApp.
- **Asisten AI (BYOK Claude) & Server MCP**: tombol melayang **Tanya AI** (`Ctrl+K`) dengan `@anthropic-ai/sdk` mode browser (kunci tersimpan lokal, hanya dikirim ke `api.anthropic.com`, 1 langkah undo per batch + zoom otomatis) serta server MCP stdio (`packages/mcp/`, `@temandor/mcp`) untuk Claude Code dan Claude Desktop.
- **Halaman publik & aksesibilitas**: landing page `/` (prerender, gambar vektor nyata dari `demoProject()`, kop form proyek baru), dokumentasi `/docs` (pintasan, layer, AI, dan panduan MCP dari sumber tunggal), halaman error/404 ramah, dan uji otomatis WCAG 2.1 AA (`@axe-core/playwright`) + E2E alur mandor desktop & HP.
