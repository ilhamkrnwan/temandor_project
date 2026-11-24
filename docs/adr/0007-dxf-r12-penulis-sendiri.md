---
status: accepted
---
# DXF R12 ditulis sendiri, PDF vektor lewat jspdf + svg2pdf.js

**DXF:** penulis DXF R12 di prototype (`prototype/app/js/dxf.js`, ±60 baris) di-port ke TypeScript di core. R12 (AC1009) terbuka di hampir semua software CAD, dan formatnya cukup untuk garis, polyline, busur, lingkaran, teks, dan layer.

Cek per 2026-11-21: tidak ada satu library npm terawat yang baca + tulis DXF. `@tarikjabiri/dxf` (terawat) hanya menulis R2007; `dxf-writer` dan `dxf-parser` tidak diperbarui > 2 tahun.

**PDF:** `jspdf` + `svg2pdf.js` dari SVG yang sama dengan layar, supaya skala kertas tepat (mis. 1:100 di A3) dan kop/title block bisa ditambahkan. Cetak lewat browser (cara prototype) tidak menjamin skala.

## Considered Options

- **`@tarikjabiri/dxf`**: dipakai nanti bila uji ke drafter menunjukkan butuh BLOCK (satu fitting = satu objek di AutoCAD) atau entitas DIMENSION asli.
- **Import DXF** (`dxf` 5.x untuk parsing): bukan MVP. Masuk backlog bila validasi menunjukkan mandor perlu memakai denah dari arsitek.
- **`pdf-lib`**: tidak terawat sejak 2021.
