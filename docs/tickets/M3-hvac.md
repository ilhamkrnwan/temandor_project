# M3 HVAC & arsitektur

Pembeda utama Temandor: komponen, bukan garis. Semua komponen parametrik `(lebar, tinggi, sudut)` dengan port.

---

### M3-01 · Registry komponen & fitting duct parametrik

**Label:** `m3-hvac` `core` · **Estimasi:** 2 hari · **Butuh:** M2-02
**Acuan:** `prototype/app/js/geom.js` (`port`, `body`, registry `TYPES` mulai baris 224: duct lurus, Elbow, T, Cabang 45°, transisi, endcap, flexible, damper, access door)

**Kerjakan**
- `shared/cad/components/`: satu definisi per jenis (`name`, `icon`, `ports(node)`, `prims(node)`, `grips(node)`, opsi `duct`/`mirror`).
- Elbow: sudut bebas 5–150°, chip 90/60/45/30/22,5/15, ujung b beda ukuran (reducing), radius 1,0×W / 1,5×W atau siku + vane. Sama lebar = ARC asli.

**Selesai bila**
- [x] Tes posisi & arah port tiap jenis setelah rotasi dan cermin (`shared/cad/components/duct.test.ts`: 9 komponen duct/fitting × 5 kombinasi rotasi/cermin/unit diverifikasi identik dengan `prototype/app/js/geom.js`, termasuk elbow 5..150°, chip sudut, reducing, radius 1.0/1.5×W ARC asli, siku + vane, serta grip lokal tunggal via registry).
- [x] Render tiap jenis vs prototype identik secara visual (`shared/cad/components/duct.test.ts`: output `nodeSVG` 100% identik karakter-per-karakter terhadap `prototype/app/js/render.js` untuk 9 jenis + variasi elbow/tee/takeoff pada palet `screen`, `paper`, dan `light`).

---

### M3-02 · Koneksi port

**Label:** `m3-hvac` `core` · **Estimasi:** 1 hari · **Butuh:** M3-01, M2-06
**Acuan:** `connect` di `prototype/app/js/model.js`, `anyPort` di `geom.js`

**Kerjakan**
- Komponen didekatkan ke ujung duct terbuka → menempel, berputar, dan ikut ukuran ujung itu; `R` ganti arah.
- Seret komponen yang tersambung → menempel lagi ke ujung terbuka terdekat.

**Selesai bila**
- [ ] Tes unit `connect` (ukuran ikut, rotasi benar); tes E2E tempel elbow ke ujung duct.

---

### M3-03 · Alat gambar duct dengan elbow otomatis

**Label:** `m3-hvac` · **Estimasi:** 1,5 hari · **Butuh:** M3-02
**Acuan:** `prototype/app/js/editor.js` baris 209–253, fungsi jalur → duct + elbow di `geom.js`

**Kerjakan**
- `D` / `L`: klik titik-titik; elbow dipasang di tiap belokan (sudut bebas); ketik angka + Enter = panjang pas (mm); Enter / klik kanan selesai; Backspace hapus titik terakhir.

**Selesai bila**
- [x] Tes unit jalur 3 titik → 2 duct + 1 elbow dengan ukuran benar (port dari test.js prototype) (`shared/cad/ductPath.test.ts`: 3 titik belok kanan/kiri, sudut bebas 45°/35°/120°, jalur Z multi-belokan, dan paritas `pathNodes` terhadap `prototype/app/js/geom.js`).
- [x] Satu jalur = satu langkah undo (`test/nuxt/EditorStore.nuxt.spec.ts` & `tests/e2e/duct-draw.spec.ts` di desktop + HP: gambar jalur via `D`/klik/ketik angka + `Enter`/`Backspace`/klik kanan, lalu 1× `Ctrl+Z` menghapus seluruh jalur sekaligus).

---

### M3-04 · Perlengkapan, equipment, dan library

**Label:** `m3-hvac` `ui` · **Estimasi:** 1,5 hari · **Butuh:** M3-01, M2-10
**Acuan:** `prototype/app/assets/svg/*.svg`, `prototype/app/js/editor.js` §Library (1124–1158) dan seret dari library (668)

**Kerjakan**
- Diffuser, grille, louver, gantungan, fan, indoor ducted (FCU/AHU), outdoor.
- Panel **Elemen**: kelompok Duct, Fitting, Perlengkapan, Equipment, Arsitektur, Ruangan; seret ke kanvas atau klik lalu klik kanvas. Ikon SVG prototype dipindah ke `app/assets/svg/`.

**Selesai bila**
- [x] Semua item library bisa ditaruh dan diurungkan; tes E2E seret diffuser (`shared/cad/components/equipment.test.ts`: paritas SVG 6 komponen perlengkapan/equipment + gantungan otomatis dan 29 item × 33 ikon SVG di `app/assets/svg/`; `test/nuxt/EditorStore.nuxt.spec.ts`: semua 29 item ditaruh + undo; `tests/e2e/library-place.spec.ts` desktop + HP: 6 kelompok, cari, seret diffuser + undo/redo, klik-taruh FCU + putar `R`).

---

### M3-05 · Ruangan

**Label:** `m3-hvac` · **Estimasi:** 1,5 hari · **Butuh:** M2-08
**Acuan:** `roomPts`, `setRoom`, `resizeRoom`, `ROOM_SHAPES`, `roomShape` di `geom.js`; `editor.js` baris 254–270

**Kerjakan**
- `K` / `REC`: dua sudut, atau satu sudut + ketik `6x4` (m) / `6000,4000` (mm). Bentuk Persegi/L/T/U. `P` / `PL` ruangan bebas.
- Edit: seret titik sudut ■ / tengah sisi ●, klik ganda tambah/hapus titik, klik ganda ruangan = ganti nama, label luas & ukuran.

**Selesai bila**
- [x] Tes unit bentuk & luas; tes E2E buat ruangan `6x4` (`shared/cad/room.test.ts`: bentuk Persegi/L/T/U, luas dalam/luar, `resizeRoom`, paritas SVG prototype, port tes 4c edit sudut/sisi; `tests/e2e/room.spec.ts` desktop + HP: buat ruangan `6x4` via `K`, ubah bentuk L, klik ganda grip sisi tambah titik, klik ganda ruangan ganti nama inline, buat ruangan bebas via `P`, serta undo/redo).

---

### M3-06 · Arsitektur

**Label:** `m3-hvac` · **Estimasi:** 2 hari · **Butuh:** M3-05
**Acuan:** `roomEdges`, `hostAt`, `syncHost`, `syncHosts` di `model.js`; `gapLines` di `geom.js`; `editor.js` baris 271–321

**Kerjakan**
- Kolom, pintu (tunggal/ganda/geser; `M` engsel, `R` arah buka), jendela, bukaan, partisi (`W`, berantai), shaft, balok, tangga (lurus/L), lift, tinggi plafon.
- Pintu/jendela/bukaan menempel ke dinding, memotong garis dinding, ikut saat ruangan digeser/dibentuk ulang.

**Selesai bila**
- [x] Tes unit `syncHosts` setelah ruangan diubah; render vs prototype identik (`shared/cad/archHost.test.ts`: port tes 4d `prototype/app/test.js` untuk `hostAt`/`syncHosts` saat ruangan digeser & ditambah titik, `R`/`M`/geser/lepas pintu, `partitionFromPoints`, serta paritas SVG 10 jenis arsitektur + dinding terpotong `gapLines`; `tests/e2e/arch.spec.ts` desktop + HP: tempel & potong dinding, `R`/`M`, pintu ikut ruangan bergeser, dan partisi berantai `W`).

---

### M3-07 · Ukur, teks, catatan, coretan

**Label:** `m3-hvac` · **Estimasi:** 1,5 hari · **Butuh:** M2-08
**Acuan:** `dimPrims`, `styledText`, `textH` di `geom.js`; `editor.js` baris 322–372 dan 642–650

**Kerjakan**
- `U` / `DIM` tiga klik. Menu **Teks**: judul/subjudul/teks, diketik langsung di kanvas; properti ukuran, warna, rata, tebal/miring/garis bawah, kotak berlatar.
- Catatan + panah (seret titik biru), coretan tangan `B` di layer MARKUP.

**Selesai bila**
- [x] Tes E2E tambah teks dan ketik di kanvas; dimensi menampilkan panjang benar (`shared/cad/markupTools.test.ts`: `dimFromPoints`, `textFromPreset`, `sketchFromWorldPoints`, ujung panah catatan tepat di titik tunjuk, dan paritas SVG vs `prototype/app/js/render.js`; `tests/e2e/markup.spec.ts` desktop + HP: menu Teks + ketik langsung di kanvas + gaya teks, catatan + panah + seret titik biru, dimensi `U` 3 klik menampilkan `3000`, dan coretan tangan `B` di layer `coret` + undo).

---

### M3-08 · Anotasi otomatis

**Label:** `m3-hvac` `core` · **Estimasi:** 1 hari · **Butuh:** M3-03, M3-04
**Acuan:** `annotate`, `hangers` di `geom.js`; `flowTotals` di `model.js`

**Kerjakan**
- Label ukuran duct, panah aliran, gantungan tiap 1,5 m, total debit per FCU/fan.

**Selesai bila**
- [x] Tes unit jumlah gantungan dan total debit untuk `demoProject()` (`shared/cad/annotations.ts`, `shared/cad/annotations.test.ts`: paritas 14 titik gantungan tiap 1,5 m serta total debit `FCU-01 = 1300 cfm` dan `EF-01 = 150 cfm` identik terhadap `prototype/app/js/model.js`, label ukuran & panah aliran `annotateDuct` dengan skala/flip, isolasi jaringan, satuan `l/s`, dan titik bobokan dinding).

---

### M3-09 · Validasi & warning

**Label:** `m3-hvac` `core` · **Estimasi:** 1,5 hari · **Butuh:** M3-02, M3-06
**Acuan:** `validate`, `ctxOf` di `model.js`; `editor.js` baris 651–667 dan 1072–1123

**Kerjakan**
- Ujung terbuka, ukuran beda tanpa transisi, sistem tercampur, debit kosong, duct menabrak kolom/tangga/lift. Duct menembus dinding = kotak bobokan, bukan warning.
- Tanda ! di kanvas, tooltip saat hover, klik = pilih + cara perbaikan di panel; panel daftar warning. Tidak pernah melarang simpan/export.

**Selesai bila**
- [x] Tes unit tiap jenis warning (port dari test.js prototype) (`shared/cad/validate.ts`, `shared/cad/validate.test.ts`: port tes #2 `demoProject()` = `['open', 'size']`, tes #4e `clash` kolom/tangga/lift vs bobokan dinding `ctxOf().pen` bukan warning, serta tes lengkap untuk `open`, `size`, `sys`, `flow`, `clash`, dan `zoomViewBoxToPoint`; `WarningDrawer.vue`, `CadCanvas.vue`, `PropertiesPanel.vue`, `app/pages/editor/[id].vue`, `tests/e2e/validate.spec.ts` desktop + HP: tanda `!` di kanvas, tooltip hover, klik pilih + cara perbaikan di panel, drawer daftar warning + zoom ke titik warning, dan non-blocking saat simpan/export).

---

### M3-10 · Panel properti

**Label:** `m3-hvac` `ui` · **Estimasi:** 1,5 hari · **Butuh:** M3-01, M2-10
**Acuan:** `prototype/app/js/editor.js` §Panel properti (baris 831–1071)

**Kerjakan**
- Per jenis: sistem SA/EA, W×H atau Ø, panjang, sudut, debit, elevasi, rotasi; opsi elbow; properti teks; rata saat banyak terpilih.
- Input angka menerima koma desimal; satuan sesuai proyek.

**Selesai bila**
- [x] Ubah lebar duct dari panel = satu langkah undo, render & port ikut berubah (`shared/cad/properties.ts`, `shared/cad/properties.test.ts`: parser koma desimal `parseDecimalInput`, definisi field lengkap 30 jenis komponen + opsi elbow + properti teks + `applyPropertyToNodes` & `nodePortSummaries`; `PropertiesPanel.vue`, `app/stores/editor.ts`, `app/pages/editor/[id].vue`, `test/nuxt/EditorStore.nuxt.spec.ts`, `tests/e2e/properties.spec.ts` desktop + HP: ubah lebar duct pakai koma desimal `14,5` = 1 langkah undo + render & port ikut berubah, panel Ukuran duct baru, opsi elbow chip `22,5°`/reducing/siku+vane, dan rata multi-pilih).

---

### M3-11 · Panel layer

**Label:** `m3-hvac` `ui` · **Estimasi:** 0,5 hari · **Butuh:** M2-10
**Acuan:** `LAYERS`, `layerOf`, `withLayers` di `model.js`

**Kerjakan**
- Tampil/sembunyi dan kunci per layer (DUCT-SA, DUCT-EA, EQUIPMENT, DIFFUSER, HANGER, DIMENSION, TEXT, MARKUP, A-WALL, A-COLS, A-DOOR, A-MISC).

**Selesai bila**
- [x] Layer tersembunyi tidak bisa dipilih; status layer tersimpan di proyek (`shared/cad/model.ts`, `shared/cad/schema.ts`: `withLayers` & normalisasi layer proyek lama; `app/stores/editor.ts`: `setLayerVisible` & `setLayerLocked` memangkas seleksi & autosave ke IndexedDB; `WorkspaceRail.vue`, `app/pages/editor/[id].vue`: panel Layer interaktif tampil/sembunyi + gembok 11 layer DXF dan guard `isNodeVisible` pada klik/klik ganda/klik kanan/warning; `test/nuxt/EditorStore.nuxt.spec.ts` & `tests/e2e/layers.spec.ts` desktop + HP: layer tersembunyi tidak bisa dipilih dan status bertahan setelah reload).
