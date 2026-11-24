# M2 Core & editor dasar

Core CAD murni di `shared/cad/` dan editor yang bisa memilih, menggeser, dan mengurungkan. Belum ada komponen HVAC (M3); tes memakai primitive & ruangan sederhana.

---

### M2-01 · Tipe data proyek v2

**Label:** `m2-core` `core` · **Estimasi:** 1 hari · **Butuh:** M1-02
**Acuan:** `prototype/app/js/model.js` (`newProject`, `mk`, `LAYERS`, `demoProject`), sketsa model data di `prototype/README.md` §7

**Kerjakan**
- `shared/cad/types.ts`: `Project`, `Node` (union per jenis komponen), `Port`, `Room`, `Layer`, `Prim` (`ln`, `pl`, `rect`, `arc`, `c`, `txt`, …), `Unit` (`mm` | `inch`), `System` (`SA` | `EA`).
- `shared/cad/schema.ts`: skema zod untuk `Project` v2 (dipakai saat membuka file, M4-02).
- `version: 2` di root proyek. Satuan nyata disimpan tanpa konversi (prinsip prototype §4).
- `newProject()` dan `demoProject()` di-port sebagai fixture tes.

**Selesai bila**
- [x] `demoProject()` lolos skema zod; tes tipe & skema lulus.

> Catatan: `zod@4.6.7` dan `nanoid@6.0.2` dipasang. `shared/cad/` memuat `types.ts`, `schema.ts`, `model.ts`, dan `model.test.ts` (30 tipe komponen, 11 layer, `version: 2`, serta verifikasi kecocokan 32 node `demoProject()` terhadap `prototype/app/js/model.js`).

---

### M2-02 · Geometri & primitive

**Label:** `m2-core` `core` · **Estimasi:** 1 hari · **Butuh:** M2-01
**Acuan:** `prototype/app/js/geom.js` baris 1–223 (`norm`, `rotP`, `dist`, `angOf`, `mmOf`, `sizeLabel`, pembuat primitive, `xformPrims`, `polyArea`, `insetPoly`)

**Kerjakan**
- Port ke `shared/cad/geom.ts` dan `shared/cad/prims.ts` dengan tipe.
- Tes per fungsi: rotasi, cermin (termasuk `arc`), luas poligon, label ukuran mm/inch (`Ø`, `"`).

**Selesai bila**
- [x] Cakupan tes `geom.ts` ≥ 90 %; hasil sama dengan prototype untuk input yang sama.

> Catatan: `shared/cad/geom.ts` dan `shared/cad/prims.ts` mencapai cakupan **100,00% fungsi & 100,00% baris** (`bun test --coverage`, 409 assertion), dengan paritas output diverifikasi langsung terhadap `prototype/app/js/geom.js`.

---

### M2-03 · Render SVG

**Label:** `m2-core` `ui` · **Estimasi:** 1,5 hari · **Butuh:** M2-02, M1-04
**Acuan:** `prototype/app/js/render.js` (`PAL`, `primSVG`, `nodeSVG`, `DRAW_ORDER`, `projectSVG`, `docSVG`)

**Kerjakan**
- `shared/cad/svg.ts`: fungsi murni proyek → string SVG (palet `screen` dan `paper`), dipakai untuk thumbnail, PNG, PDF.
- `app/components/cad/CadCanvas.vue`: render reaktif per node (komponen Vue per node supaya hanya node yang berubah yang di-render ulang), urutan gambar sesuai `DRAW_ORDER`, sumbu Y sama dengan prototype.
- Tema kanvas gelap/terang (tombol ◐, tersimpan di `localStorage`).

**Selesai bila**
- [x] Snapshot SVG `demoProject()` dari `svg.ts` stabil di tes.
- [x] Screenshot kanvas vs prototype untuk proyek contoh identik secara visual (kedua tema).

> Catatan: `shared/cad/svg.ts` (`PAL`, `DRAW_ORDER`, `primToRenderItem`, `primSVG`, `nodeSVG`, `projectSVG`, `docSVG`) lolos tes snapshot + paritas 100% identik terhadap `prototype/app/js/render.js` untuk `screen`, `paper`, dan `light`. `CadCanvas.vue` + `CadNode.vue` + `useCanvasTheme` (simpan `temandor.theme` di `localStorage`) diverifikasi di Vitest, Playwright (desktop + HP), dan perbandingan screenshot gelap/terang vs prototype.

---

### M2-04 · Viewport: zoom, geser, grid, sentuh

**Label:** `m2-editor` `ui` · **Estimasi:** 1 hari · **Butuh:** M2-03
**Acuan:** `prototype/app/js/editor.js` §Tampilan (baris 82–122) dan §Pointer dua jari (baris ~453), ADR 0009

**Kerjakan**
- Scroll = zoom di titik kursor; tombol tengah / Spasi = geser; `Z` zoom ke pilihan, `Shift+Z` lihat semua; grid (F7) adaptif terhadap zoom; crosshair; koordinat kursor (mm) di status.
- `touch-action: none`; dua jari = zoom + geser, jari kedua membatalkan gerakan satu jari.

**Selesai bila**
- [x] Tes E2E: zoom & geser dengan mouse dan sentuh (Playwright touch) mengubah viewBox sesuai.

> Catatan: Matematika viewport murni di `shared/cad/viewport.ts` (`pixelsPerMm`, `adaptiveGridStep`, `formatGridStep`, `fitViewBox`, `clientToWorld`, `zoomViewBoxAt`, `zoomViewBoxCenter`, `zoomViewBoxToBounds`, `panViewBox`, `pinchViewBox`, `resizeViewBox`) + composable `app/composables/useViewport.ts` + bar tampilan & status bar di `app/pages/editor/[id].vue` + crosshair & grid adaptif di `CadCanvas.vue`. Terverifikasi unit test (`viewport.test.ts`) dan E2E desktop + HP (`tests/e2e/viewport.spec.ts`, termasuk pinch+pan dua jari dan pembatalan gestur satu jari).

---

### M2-05 · Store editor, command, undo/redo, autosave

**Label:** `m2-editor` `core` · **Estimasi:** 1,5 hari · **Butuh:** M2-01
**Acuan:** `prototype/app/js/editor.js` §Data, riwayat, simpan (baris 44–81)

**Kerjakan**
- Pinia store `useEditor`: proyek aktif, seleksi, alat aktif, viewport.
- Semua perubahan lewat `commit(label, mutasi)` → riwayat undo/redo (`Ctrl+Z`/`Ctrl+Y`), satu aksi pengguna = satu langkah. Batas riwayat 200 langkah.
- Autosave ke IndexedDB (`idb-keyval`), debounce 500 ms, indikator "Tersimpan".

**Selesai bila**
- [x] Tes unit: 3 perubahan → undo 2 → redo 1 menghasilkan state yang benar.
- [x] Reload halaman editor memuat ulang perubahan terakhir.

> Catatan: `pinia@4.1.0`, `@pinia/nuxt@1.0.3`, dan `idb-keyval@6.3.0` terpasang. Mesin riwayat murni di `shared/cad/history.ts` (batas 200 langkah, deteksi no-op), adapter penyimpanan IndexedDB di `app/utils/projectStorage.ts` (ADR 0006), dan Pinia store `useEditor` di `app/stores/editor.ts` (autosave debounce 500 ms + flush `pagehide`, indikator "Tersimpan"). Terverifikasi lewat `shared/cad/history.test.ts`, `test/nuxt/EditorStore.nuxt.spec.ts`, dan `tests/e2e/editor-store.spec.ts` (desktop + HP).

---

### M2-06 · Snap & ortho

**Label:** `m2-editor` `core` · **Estimasi:** 1 hari · **Butuh:** M2-04
**Acuan:** `prototype/app/js/editor.js` §Snap (baris 123–142)

**Kerjakan**
- Fungsi snap murni di core (ujung, tengah, port terbuka, grid) + penanda snap di overlay.
- SNAP (F3), ORTHO (F8, `Shift` sementara), info panjang & sudut di kursor.

**Selesai bila**
- [x] Tes unit snap untuk tiap jenis; toggle tampil di status bar.

> Catatan: Fungsi murni di `shared/cad/snap.ts` (`snapAt` dengan prioritas `closePoint` → `port` → `end` → `mid` → `grid`, `orthoPoint` dengan `Shift` sementara, `cursorMeasure`, `rectMeasure`), penanda snap (kotak port/ujung, segitiga tengah) & info panjang/sudut kursor di `CadCanvas.vue`, serta toggle `SNAP` (`F3`) dan `ORTHO` (`F8` + `Shift`) di status bar `app/pages/editor/[id].vue`. Terverifikasi lewat `shared/cad/snap.test.ts`, `test/nuxt/CadCanvas.nuxt.spec.ts`, dan `tests/e2e/snap-ortho.spec.ts` (desktop + HP).

---

### M2-07 · Seleksi

**Label:** `m2-editor` · **Estimasi:** 1 hari · **Butuh:** M2-05
**Acuan:** `prototype/app/js/editor.js` §Pointer (baris 452–641), `hit`/`hitR` di `geom.js`, `bbox` di `geom.js` ~baris 715

**Kerjakan**
- Klik, `Shift`+klik, tarik kotak (kiri→kanan window, kanan→kiri crossing).
- Keyboard: fokus kanvas, `Tab`/`Shift+Tab` pindah komponen, `Delete` hapus + toast "Urungkan".
- Komponen terkunci tetap bisa dipilih (untuk dibuka) tapi tidak ikut tergeser.

**Selesai bila**
- [x] Tes E2E window vs crossing dan seleksi keyboard.

> Catatan: Logika seleksi murni di `shared/cad/select.ts` (`clickSelect`, `selectByBox` window vs crossing, `stepTabSelection` tanpa jebakan fokus, `movableSelectedIds`/`deletableSelectedIds`, `selectAllIds`, komponen `node.lock` tetap dapat dipilih namun tidak digeser/dihapus), overlay kotak biru/hijau + bingkai multi-seleksi + titik port + lencana kunci di `CadCanvas.vue`, serta interaksi klik, `Shift`+klik, tarik kotak, `Tab`/`Shift+Tab`, `Ctrl+A`, `Escape`, dan `Delete` + toast `"Urungkan"` di `app/pages/editor/[id].vue`. Terverifikasi lewat `shared/cad/select.test.ts` dan `tests/e2e/selection.spec.ts` (desktop + HP).

---

### M2-08 · Pindah, salin, putar, cermin, grip

**Label:** `m2-editor` · **Estimasi:** 1,5 hari · **Butuh:** M2-06, M2-07
**Acuan:** `prototype/app/js/editor.js` §Edit (baris 373–451), §Overlay grip (673–741), `lenGrip`/`widthGrip`/`edgeGrip` di `geom.js`

**Kerjakan**
- Seret untuk pindah; panah = 10 mm, `Shift` = 100 mm; `Ctrl+C/V/D`; `R` putar; `M` cermin.
- Grip biru (panjang/posisi) dan putih (ukuran) dengan ghost selama diseret.

**Selesai bila**
- [x] Tiap operasi = satu langkah undo; tes E2E pindah + undo.

> Catatan: Logika grip murni untuk seluruh komponen di `shared/cad/grips.ts` (`nodeGrips`, `applyGrip`, `applyGripDblClick`, `widthGrip`, `setRoomPoints`) dan transformasi murni di `shared/cad/transform.ts` (`computeMoveDelta` dengan snap grid + magnet port terbuka, `previewMovedNodes`, `translateSelectedInPlace`, `rotateSelectedInPlace`, `mirrorSelectedInPlace`, `cloneNodesForPaste`). Aksi store di `app/stores/editor.ts`, handle grip biru/putih + ghost preview di `CadCanvas.vue`, serta interaksi seret, panah 10/100 mm, `R`, `M`, `Ctrl+C/V/D`, dan grip di `app/pages/editor/[id].vue`. Terverifikasi lewat `shared/cad/transform.test.ts` dan `tests/e2e/transform.spec.ts` (desktop + HP).

---

### M2-09 · Group, rata, kunci, urutan, menu klik kanan

**Label:** `m2-editor` · **Estimasi:** 1 hari · **Butuh:** M2-08
**Acuan:** `prototype/app/js/editor.js` §Toolbar melayang & menu klik kanan (baris 742–830)

**Kerjakan**
- `Ctrl+G` / `Ctrl+Shift+G`, klik ganda = pilih isi group; rata kiri/tengah/kanan/atas/bawah; kunci; `]` `[` urutan.
- Menu klik kanan dan toolbar melayang di atas pilihan (`UContextMenu`, popover Nuxt UI).

**Selesai bila**
- [x] Semua aksi menu bisa diurungkan; menu bisa dipakai dengan keyboard.

> Catatan: Operasi murni `groupSelectedInPlace`, `ungroupSelectedInPlace`, `isSelectionGrouped`, `alignSelectedInPlace` (6 arah, group sebagai kesatuan), `lockSelectedInPlace`, dan `reorderSelectedInPlace` di `shared/cad/transform.ts`, aksi Pinia store di `app/stores/editor.ts`, toolbar melayang di atas pilihan (`app/components/cad/SelectionToolbar.vue` + `UDropdownMenu` Rata & Urutan), serta menu klik kanan `UContextMenu`, klik ganda masuk group, `Ctrl+G`/`Ctrl+Shift+G`, dan `]`/`[` di `app/pages/editor/[id].vue`. Terverifikasi lewat `shared/cad/transform.test.ts` dan `tests/e2e/arrange-menu.spec.ts` (desktop + HP).

---

### M2-10 · Shell workspace

**Label:** `m2-editor` `ui` · **Estimasi:** 2 hari · **Butuh:** M1-04, M2-03
**Acuan:** `prototype/app/editor.html`, `prototype/app/css/app.css`, README prototype baris "Workspace"

**Kerjakan**
- Top bar (nama proyek, undo/redo, status simpan, Export), rail kiri (Elemen, Alat, Teks, Layer, Proyek; klik = buka, klik lagi = tutup, `Ctrl+[`), panel properti melayang kanan (`Ctrl+]`, muncul saat ada pilihan), bar kanan-bawah (Pilih, Geser, zoom −/+/semua), status bar, mode fokus `Ctrl+.`.
- Layar sempit: rail jadi tab bar bawah, panel jadi bottom sheet (ADR 0009).
- Isi panel menyusul di tiket masing-masing; di sini cukup kerangka + state buka/tutup.

**Selesai bila**
- [x] Screenshot desktop & HP vs prototype identik secara visual.

> Catatan: Shell workspace penuh di `app/composables/useWorkspacePanels.ts` (`temandor.panels` di `localStorage`, `Ctrl+[`, `Ctrl+]`, `Ctrl+.`), `app/components/cad/WorkspaceRail.vue` (5 kategori rail kiri desktop + tab bar bawah & bottom sheet HP sesuai ADR 0009), `app/components/cad/PropertiesPanel.vue` (panel properti melayang kanan + tab buka-ulang), top bar (merek, nama proyek, undo/redo, mode fokus, tema, simpan, modal Export `.json`), dan gaya layout di `app/assets/css/main.css`. Terverifikasi lewat `tests/e2e/workspace-shell.spec.ts` dan perbandingan visual screenshot desktop (1440×900) & HP (393×851) berdampingan dengan `prototype/app/editor.html`.

---

### M2-11 · Pintasan, baris perintah, bantuan

**Label:** `m2-editor` · **Estimasi:** 1 hari · **Butuh:** M2-10
**Acuan:** `prototype/app/js/editor.js` §Tombol, keyboard (baris 1159–1268)

**Kerjakan**
- Satu tabel pintasan (sumber tunggal) dipakai untuk handler keyboard dan dialog `?`.
- Ketik perintah gaya AutoCAD (`L`, `REC`, `PL`, `DIM`, `BOQ`, …) dengan Enter.
- Petunjuk awal hanya muncul sekali (disimpan di `localStorage`).

**Selesai bila**
- [x] Dialog `?` menampilkan semua pintasan dari tabel; tes unit pemetaan perintah → alat.

> Catatan: Sumber tunggal `SHORTCUTS`, `matchShortcut()`, `COMMAND_ALIASES`, `COMMAND_REFERENCE`, dan `parseCommand()` di `shared/cad/commands.ts` (tanpa Vue/DOM); baris perintah gaya AutoCAD di `app/components/cad/CommandBar.vue`; dialog pintasan `?` yang membaca langsung dari `SHORTCUTS` + `COMMAND_REFERENCE` di `app/components/cad/ShortcutsDialog.vue`; serta petunjuk awal sekali tampil (`temandor.nohint` di `localStorage`) di `app/components/cad/OnboardingHint.vue`. Terverifikasi lewat `shared/cad/commands.test.ts`, `test/nuxt/ShortcutsDialog.nuxt.spec.ts`, dan `tests/e2e/commands-help.spec.ts` (desktop + HP).
