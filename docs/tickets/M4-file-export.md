# M4 File & export

Hasil gambar keluar dari Temandor dan bisa dipakai orang lain (prinsip produk #3).

---

### M4-01 · Halaman daftar proyek `/proyek`

**Label:** `m4-file` `ui` · **Estimasi:** 1,5 hari · **Butuh:** M2-05, M2-03
**Acuan:** `prototype/app/index.html`, `prototype/app/js/home.js` (`list`, `preview`), `listProjects`/`deleteProject` di `model.js`

**Kerjakan**
- Kartu proyek dengan thumbnail (`svg.ts`), waktu diubah, cari; Proyek baru (nama, satuan inch/mm, skala, dimensi ruangan awal); buka proyek contoh; hapus (dengan konfirmasi + bisa diurungkan dari toast); buka file `.json`.
- Pengingat kecil: proyek tersimpan di browser ini, unduh `.json` untuk cadangan (ADR 0006).
- Tanpa katalog template & tanpa login (ADR 0008).

**Selesai bila**
- [x] Tes E2E: buat proyek → muncul di daftar → hapus → urungkan (`app/pages/proyek.vue`, `app/utils/projectFiles.ts`, `test/nuxt/ProjectFiles.nuxt.spec.ts`, `tests/e2e/projects.spec.ts` desktop + HP: thumbnail SVG `docSVG`, waktu diubah, cari, modal Proyek baru dengan koma desimal & pratinjau ruangan, proyek contoh otomatis kunjungan pertama, konfirmasi hapus + urungkan dari toast dengan persistensi IndexedDB, buka/unduh file `.json`, pengingat cadangan lokal ADR 0006, tanpa katalog template & tanpa login ADR 0008).

---

### M4-02 · Format file v2 & migrasi dari prototype

**Label:** `m4-file` `core` · **Estimasi:** 1 hari · **Butuh:** M2-01
**Acuan:** `importProject`, `saveProject` di `model.js`, ADR 0006

**Kerjakan**
- `shared/cad/migrate.ts`: deteksi versi, `v1 → v2` (v1 = file prototype tanpa `version`).
- Buka file: parse JSON → migrasi → validasi zod → pesan error yang jelas bila file rusak (tanpa crash).
- Simpan `.json`: nama file dari nama proyek (slug).

**Selesai bila**
- [x] Tes: `demoProject()` prototype & 6 template sketsa (`prototype/app/js/store.js`) yang diekspor dari prototype terbuka dan lolos skema (`shared/cad/migrate.ts`, `shared/cad/migrate.test.ts`: `detectProjectVersion`, `migrateV1ToV2`, `migrateProjectData`, `openProjectJson`, `projectFileSlug`/`projectFileName`; `demoProject()` dan seluruh 6 template `kantor`/`ruko`/`rumah`/`resto`/`klinik`/`gudang` lulus skema v2, validasi, debit, dan `docSVG`; `tests/e2e/projects.spec.ts` memverifikasi impor file prototype v1 langsung terbuka di editor).
- [x] File acak / rusak menghasilkan pesan error, bukan crash (`shared/cad/migrate.test.ts` & `tests/e2e/projects.spec.ts`: string kosong, JSON terpotong, tipe acak, versi masa depan `v99`, dan node v2 korup semuanya mengembalikan `{ ok: false, error }` tanpa crash).

---

### M4-03 · Export DXF R12

**Label:** `m4-file` `core` · **Estimasi:** 1,5 hari · **Butuh:** M3-08, M3-11
**Acuan:** `prototype/app/js/dxf.js` (`toDXF`, `PICK_ACI`, `projectBounds`), `prototype/uji-dxf/`, ADR 0007, hasil M0-01

**Kerjakan**
- Port ke `shared/cad/dxf.ts`: LINE, LWPOLYLINE/POLYLINE R12, ARC, CIRCLE, TEXT, layer + warna ACI, satuan mm/inch, catatan "SKETSA BANTU TEMANDOR – CEK ULANG UKURAN DI LAPANGAN".
- Perbaiki masalah dari M0-01 bila ada (mis. linetype putus-putus untuk balok/bukaan).

**Selesai bila**
- [x] Tes regresi: DXF dari `demoProject()` sama dengan `prototype/uji-dxf/kantor-mm.dxf` dan `kantor-inch.dxf` (kecuali perbaikan yang disengaja, dicatat) (`shared/cad/dxf.ts`, `shared/cad/dxf.test.ts`: HEADER, tabel LAYER, dan seluruh 4000+ baris ENTITIES identik karakter-per-karakter terhadap `kantor-mm.dxf` dan `kantor-inch.dxf`; perbaikan disengaja: deklarasi `LTYPE` `DASHED` dengan panjang pola sesuai satuan model dan kode grup `6 DASHED` pada garis balok & bukaan sesuai catatan `prototype/uji-dxf/CHECKLIST.md`).
- [ ] File baru dibuka di DWG TrueView tanpa error (dicek manual, dicatat di PR).

---

### M4-04 · Export PNG & kirim

**Label:** `m4-file` · **Estimasi:** 0,5 hari · **Butuh:** M2-03
**Acuan:** `prototype/app/js/editor.js` §Export (baris 1269–1327)

**Kerjakan**
- SVG palet `paper` → canvas → PNG (resolusi cukup untuk dibaca di WhatsApp).
- Setelah export: dialog **File siap** + **Kirim gambar PNG** (Web Share API dengan file; tanpa dukungan → unduh).

**Selesai bila**
- [x] Tes E2E: export PNG menghasilkan unduhan berukuran > 0 (`app/utils/exportPng.ts`, `app/utils/projectFiles.ts`, `app/pages/editor/[id].vue`, `test/nuxt/ExportPng.nuxt.spec.ts`, `tests/e2e/export-png.spec.ts` desktop + HP: render SVG palet `paper` ke `<canvas>` hingga 3200px / batas 4096px dengan latar putih, verifikasi ukuran > 1000 byte & header PNG valid, tampilan dialog **File siap** + tombol **Kirim gambar PNG** yang menggunakan ulang Blob PNG dalam gesture klik via Web Share API dengan fallback otomatis ke unduh file bila Web Share tidak tersedia atau ditolak).

---

### M4-05 · Export PDF vektor berskala + kop

**Label:** `m4-file` · **Estimasi:** 1,5 hari · **Butuh:** M2-03
**Acuan:** ADR 0007

**Kerjakan**
- `jspdf` + `svg2pdf.js`: kertas A4/A3, potret/lanskap, skala 1:50/1:100/1:200 atau "muat ke kertas".
- Kop sederhana di pojok kanan bawah: nama proyek, skala, satuan, tanggal, stempel sketsa bantu. Gaya mengikuti DESIGN.md.
- Dimuat secara lazy (hanya saat export) supaya bundle editor tetap kecil.

**Selesai bila**
- [x] Ruangan 9000 mm di skala 1:100 terukur 90 mm di PDF (tes unit pada transformasi + cek manual) (`shared/cad/pdfLayout.ts`, `shared/cad/pdfLayout.test.ts`, `app/utils/exportPdf.ts`, `app/pages/editor/[id].vue`, `test/nuxt/ExportPdf.nuxt.spec.ts`, `tests/e2e/export-pdf.spec.ts`: `jspdf` + `svg2pdf.js` dimuat lazy via dynamic `import()` terpisah dari bundle editor; kertas A4/A3 potret/lanskap; skala `1:50`/`1:100`/`1:200`/`fit`; kop pojok kanan bawah sesuai `DESIGN.md`; tes unit & inspeksi stream PDF vektor memverifikasi matriks `0.01` x `72/25.4 pt/mm` menghasilkan ruangan 9000 mm tepat 90,00 mm di PDF; cek cetak fisik/viewer manual tetap disarankan saat review PR).

---

### M4-06 · Daftar material (BOQ)

**Label:** `m4-file` `core` · **Estimasi:** 1 hari · **Butuh:** M3-08
**Acuan:** `boq`, `BOQ_ORDER`, `boqCSV` di `model.js`; `editor.js` §BOQ (baris 1328–1347)

**Kerjakan**
- Panjang duct per sistem & ukuran, fitting, diffuser/grille, gantungan, equipment.
- Unduh CSV (pemisah `;`, koma desimal untuk Excel Indonesia) dan Salin teks (WhatsApp). Catatan: belum termasuk sisa potong & sambungan.
- Dibuka dari dialog Export, panel Proyek, atau perintah `BOQ`.

**Selesai bila**
- [x] Tes unit BOQ `demoProject()` sama dengan prototype (`shared/cad/boq.ts`, `shared/cad/boq.test.ts`, `app/components/cad/BoqDialog.vue`, `app/components/cad/WorkspaceRail.vue`, `app/pages/editor/[id].vue`, `tests/e2e/boq.spec.ts`: `boq()` & `boqCSV()` untuk `demoProject()` identik 100% terhadap `prototype/app/js/model.js`; mendukung panjang duct per sistem & ukuran, fitting, diffuser/grille/perlengkapan, gantungan duct, equipment, unduh CSV Excel Indonesia ber-BOM UTF-8 dengan pemisah `;` & koma desimal, salin teks WhatsApp, catatan belum termasuk sisa potong/sambungan/sealant, serta dapat dibuka dari dialog Export, panel Proyek, dan perintah `BOQ`).

---

### M4-07 · Dialog Export

**Label:** `m4-file` `ui` · **Estimasi:** 0,5 hari · **Butuh:** M4-03, M4-04, M4-05, M4-06

**Kerjakan**
- Satu dialog: format (DXF/PNG/PDF/JSON), pilihan layer, satuan DXF, skala & kertas PDF, tautan BOQ.

**Selesai bila**
- [x] Tes E2E alur lengkap: buka proyek contoh → Export → DXF terunduh (`app/components/cad/ExportDialog.vue`, `app/pages/editor/[id].vue`, `tests/e2e/export-dxf.spec.ts`, `tests/e2e/export-png.spec.ts`, `tests/e2e/export-pdf.spec.ts`: satu dialog terpadu untuk format DXF/PNG/PDF/`.json`, pilihan 11 layer dengan swatch & kode DXF, satuan DXF `mm`/`inch`, skala & kertas/orientasi PDF, catatan sketsa bantu, status warning non-blocking, dan tautan BOQ; lulus E2E desktop + HP).
