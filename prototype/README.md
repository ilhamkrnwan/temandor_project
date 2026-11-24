# Temandor

Tool web untuk membantu **mandor pemula** membuat sketsa 2D jalur ducting dan ventilasi, dengan gaya gambar seperti AutoCAD, tanpa harus menguasai AutoCAD.

> **Arsip Acuan (Prototype P1).** Aplikasi utama Temandor (Nuxt 4 + TypeScript) kini berada di root repositori (`../app/`, `../shared/cad/`). Folder `prototype/` ini dipertahankan sebagai arsip acuan perilaku, regresi DXF/BOQ (`app/test.js`, `uji-dxf/`), serta konfigurasi debug di `.vscode/launch.json`. Keputusan aplikasi real ada di `../docs/adr/` dan `../docs/tickets/`.

## Cara buka prototype

Double-click `app/index.html`, atau jalankan server statis:

```bash
python -m http.server 5179 --directory app
```

Butuh internet untuk Tailwind CDN dan Google Fonts. Tanpa build step, tanpa backend: proyek disimpan di browser (localStorage). Unduh `.json` untuk cadangan.

Halaman depan (landing) untuk pengunjung baru: `app/landing.html` (tautan **Tentang** di beranda). Saat login nanti wajib (ADR 0001), landing ini yang jadi halaman awal.

Dokumentasi pengguna: buka `app/docs.html` (juga lewat tombol **Docs** di beranda). Konteks produk & desain: `../PRODUCT.md`, `../DESIGN.md`.

Cek logika inti (jalur + elbow otomatis, koneksi port, validasi, DXF, aksi AI, server MCP):

```bash
node app/test.js
```

### Yang sudah jalan (P1 + sebagian P2)

| Fitur | Cara pakai |
|-------|-----------|
| Taruh komponen | Menu **Elemen** (rail kiri): seret ke kanvas, atau klik item lalu klik kanvas. Dekat ujung duct → **menempel, berputar, dan ikut ukuran** ujung itu. `R` ganti arah. |
| Gambar duct | `D` (atau ketik `L`), klik titik-titik. **Elbow dipasang otomatis** di tiap belokan (sudut bebas). Ketik angka + Enter = panjang pas (mm). Enter/klik kanan selesai, Backspace hapus titik. |
| Ruangan | `K` (atau `REC`), klik dua sudut, atau klik satu sudut lalu ketik `6x4` (meter) / `6000,4000` (mm). |
| Ukur & teks | `U` (`DIM`) tiga klik: awal, akhir, posisi garis. `T` untuk teks. |
| Pilih & edit | Klik, Shift+klik, tarik kotak (kiri→kanan = window, kanan→kiri = crossing). Seret untuk pindah (menempel ke ujung terbuka). Grip biru: ubah panjang / posisi. Grip putih: ubah ukuran (lebar duct & fitting termasuk elbow, muka diffuser/grille, badan FCU/fan). |
| Ubah | Panel Properti: sistem SA/EA, ukuran W×H atau Ø, panjang, sudut, debit, elevasi, rotasi. Elbow: sudut bebas 5–150° (atau chip 90/60/45/30/22,5/15), ujung b beda ukuran (elbow reducing, satu potong), tipe radius 1,0×W / 1,5×W atau siku + sudu (vane). `R` putar, `M` cermin/balik belokan, `Del`, `Ctrl+C/V/D`, `Ctrl+Z/Y`, panah = geser 10 mm (Shift 100 mm). |
| Group & rata | `Ctrl+G` group, `Ctrl+Shift+G` ungroup, klik ganda = pilih satu isi group. Rata kiri/tengah/kanan/atas/bawah dari panel saat pilih banyak. |
| Bentuk ruangan | Pilih ruangan: seret titik sudut ■ atau tengah sisi ● (sisi ditarik keluar/masuk, dinding baru otomatis). Klik ganda ● tambah titik, klik ganda ■ hapus titik. Bentuk siap pakai Persegi / L / T / U (library, toolbar melayang, panel). `P` (`PL`) = ruangan bebas: klik titik-titik, klik titik awal / Enter untuk menutup. Klik ganda ruangan = ganti nama. |
| Arsitektur | Elemen › **Arsitektur**: kolom, pintu (tunggal/ganda/geser), jendela, bukaan, partisi (`W`, berantai), shaft, balok, tangga (lurus/L), lift, tinggi plafon. Pintu/jendela/bukaan **menempel ke dinding**, memotong garis dinding, bisa digeser sepanjang dinding, ikut saat ruangan digeser/dibentuk ulang. Pintu: `M` engsel, `R` arah buka. |
| Toolbar melayang & klik kanan | Pilih komponen → toolbar aksi cepat di atasnya (ruangan: bentuk, tambah pintu/jendela/kolom/partisi). Klik kanan: salin, tempel, group, putar, ke depan/belakang (`]` `[`), kunci, zoom ke pilihan. |
| Kunci | Kunci per komponen (mis. ruangan) supaya tidak ikut tergeser saat menggambar. Tetap bisa dipilih untuk dibuka. |
| Workspace | Rail kiri seperti Canva: **Elemen, Alat, Teks, Layer, Proyek** (Proyek = tab Semua proyek dengan thumbnail + cari, dan tab Proyek ini untuk pengaturan). Klik = buka panel, klik lagi = tutup (`Ctrl+[`). Properti melayang di kanan, muncul hanya saat ada yang dipilih (`Ctrl+]`). Kanan-bawah: Pilih, Geser, zoom −/+/lihat semua. `Ctrl+.` = mode fokus. Keyboard: fokus ke kanvas lalu `Tab`/`Shift+Tab` memilih komponen, panah menggeser, `Delete` menghapus (bisa diurungkan dari toast). |
| Asisten AI | Tombol **Tanya AI** melayang di bawah kanvas (`Ctrl+K`), seperti Gemini: minta Claude menggambar, mengubah, atau mengecek sketsa dengan bahasa biasa. Belum terkoneksi → hubungkan di Pengaturan › Integrasi AI dengan kunci API Anthropic milik pengguna (disimpan di browser, hanya dikirim ke api.anthropic.com). Model `claude-opus-5-5`, fallback server-side aktif. Tiap langkah AI = satu undo: komponen yang diubah AI langsung terpilih & di-zoom, dan balon langkahnya punya tombol **Urungkan langkah ini**. |
| Server MCP | `mcp/server.js` (Node 18+, tanpa dependensi): Claude Desktop / Claude Code bisa membuat & mengubah file proyek `.json` dan export DXF. Aksi yang sama dengan asisten AI (`app/js/tools.js`). Setup di docs. |
| Docs & donasi | `app/docs.html`: panduan, export/layer, AI, MCP, kontribusi. Tombol **♥ Dukung** (beranda, editor, menu Proyek) → link donasi dari `DONATE` di `app/js/ui.js`; `.github/FUNDING.yml` untuk tombol Sponsor GitHub. |
| Teks & coretan | Menu **Teks**: judul/subjudul/teks biasa, langsung muncul dan diketik di kanvas (tanpa popup). Properti teks: ukuran cepat (Kecil/Sedang/Besar/Judul, ikut skala) atau mm, warna (merah = revisi/cek lapangan, kuning, hijau, biru, putih), rata kiri/tengah/kanan, tebal, miring, garis bawah, kotak berlatar. Semua ikut DXF kecuali tebal. **Catatan + panah**: teks dengan panah penunjuk ke komponen; seret titik biru untuk memindah teksnya. Menu **Alat** › Coretan tangan (`B`) untuk sketsa/markup bebas, layer MARKUP. |
| Tema | Kanvas gelap / terang (tombol ◐), tersimpan di browser. |
| Template (mock) | Beranda: katalog dengan filter. `template.html?id=` detail (pratinjau, isi gambar, ulasan) → `checkout.html?id=` bayar mock (perlu masuk) → template jadi milikmu. `seller.html`: daftar jadi penjual → dasbor penjual (status, statistik, template saya, **Jadikan template** dari proyek; tombol "Simulasikan disetujui" khusus prototype). |
| Akun & pengaturan (mock) | `login.html?mode=masuk\|daftar\|lupa`: masuk/daftar/lupa sandi, opsional (ADR 0001). Setelah masuk: avatar di header, Akun di `settings.html` (ubah profil: nama, email, kota, peran; daftar template dimiliki + Pakai; status penjual; keluar). `settings.html#integrasi`: pilih AI; hanya Claude yang tersambung sungguhan (ADR 0002, 0003). `404.html` halaman tidak ditemukan. |
| Pintasan | Tombol `?` di atas atau tekan `?`: daftar semua pintasan. Petunjuk awal hanya muncul sekali. |
| Bantuan gambar | SNAP (F3), ORTHO (F8, Shift = sementara), GRID (F7), crosshair, info panjang & sudut di kursor, scroll = zoom, **dua jari = zoom + geser di HP/tablet**, tombol tengah / Spasi = geser, `Z` = zoom ke pilihan, `Shift+Z` = lihat semua. |
| Otomatis | Label ukuran, panah aliran, gantungan tiap 1,5 m, ukuran ruangan, total debit per FCU/fan. |
| Warning | Ujung terbuka, ukuran beda tanpa transisi, sistem tercampur, debit kosong, **duct menabrak kolom/tangga/lift**. Hover tanda ! = alasan langsung muncul; klik = pilih komponen, cara perbaikan tampil di panel. Saat daftar warning dibuka, judulnya tampil di kanvas. Tidak pernah melarang. Duct **boleh menembus dinding** (ditandai kotak bobokan, bukan warning). |
| Layer | Tampil/sembunyi dan kunci per layer. |
| Export | DXF R12 (layer DUCT-SA, DUCT-EA, EQUIPMENT, DIFFUSER, HANGER, DIMENSION, TEXT, A-WALL, A-COLS, A-DOOR, A-MISC; mm atau inch), PNG, PDF (lewat print), .json. Setelah export: konfirmasi **File siap** + **Kirim gambar PNG** (menu bagikan bawaan HP; di perangkat tanpa fitur itu PNG diunduh). |
| Daftar material (BOQ) | Dari dialog Export, panel Proyek › Proyek ini, atau ketik `BOQ`: panjang duct per sistem & ukuran, fitting, diffuser/grille, gantungan, equipment, dihitung dari gambar. **Unduh CSV** (Excel Indonesia: pemisah `;`, koma desimal) atau **Salin teks** untuk WhatsApp. Belum termasuk sisa potong & sambungan. |

Belum: uji buka DXF di AutoCAD sungguhan (file + checklist di `uji-dxf/`), linetype putus-putus di DXF (balok/bukaan masih garis penuh), pintu di partisi, double elbow sebagai satu komponen (sementara: gambar duct dengan 2 belokan), RA/FA, harga di BOQ, resize group sekaligus.

## Mock P0

`mock/index.html` dan `mock/editor.html`: mock statis awal, dipakai sebagai acuan tampilan.

- `index.html` – beranda / daftar proyek + dialog Proyek Baru
- `editor.html` – editor utama. Pakai bar **DEMO** di atas kanvas untuk pindah state: Normal, Kosong, Terpilih, Warning, Zoom dekat. Bisa juga lewat link, mis. `editor.html?state=warning`.
- `index.html?kosong` – beranda tanpa proyek (empty state).
- Layer gantungan on/off: centang di panel Layer (kanan).
- Mobile/tablet: rail jadi tab bar bawah, panel jadi bottom sheet. Properti lewat tombol di top bar.
- Kanvas: scroll = zoom, tool Pan (H) atau tombol tengah mouse = geser, klik elbow di R. Rapat = pilih.

---

## 1. Tujuan

- Mandor pemula bisa menyusun denah ruangan + jalur duct dengan **merangkai komponen** (bukan menggambar garis satu per satu).
- Hasil gambar rapi, konsisten, dan bisa **diekspor ke DXF** untuk dibuka di AutoCAD.
- Fokus awal: **ducting dan ventilasi**. Jenis mandor lain (listrik, plumbing, dll.) bukan prioritas.

## 2. Target User

Mandor pemula yang sudah paham kerja lapangan ducting, tapi belum bisa AutoCAD.

## 3. Scope

### Masuk MVP
- Denah 2D (top view), satu lantai
- Ruangan sederhana (kotak/poligon) dengan dimensi input
- Sistem: **Supply Air (SA)** dan **Exhaust Air (EA)**. Return (RA) dan Fresh Air (FA) menyusul.
- Komponen duct: lurus, elbow, double elbow, transisi, T, cabang
- Perlengkapan: diffuser, grille, damper, flexible duct, access door, louver, gantungan
- Equipment: fan (exhaust), indoor ducted (FCU/AHU), outdoor (simbol saja)
- Label ukuran duct, label debit, panah arah aliran
- **User yang menentukan** posisi dan jenis fitting. App hanya memberi warning.
- Simpan/buka proyek (JSON)
- Export DXF (dan PNG/PDF sederhana)

### Tidak masuk MVP
- 3D, potongan/elevasi, isometrik
- Rekomendasi AI (rencana setelah MVP)
- Import denah DXF/PDF dari arsitek
- Daftar material otomatis (BOQ)
- Kolaborasi multi-user, akun, cloud
- Title block / sheet gambar

## 4. Prinsip Desain

1. **Komponen, bukan garis.** Tiap fitting punya titik sambung (*port*).
2. **Aset parametrik.** Fitting digambar dari fungsi `(lebar, tinggi, sudut)`, bukan gambar yang di-scale.
3. **Data terpisah dari tampilan.** Jalur disimpan sebagai data, gambar dirender dari data.
4. **Satuan nyata, bukan pixel.** Ukuran disimpan sesuai input user (inch atau mm) tanpa konversi bolak-balik.
5. **User bebas, app menjaga.** Validasi berupa warning, bukan larangan.
6. **Simpan elevasi dari awal.** Tiap segmen punya atribut tinggi dasar duct, walau MVP hanya denah.

## 5. Fase Pengerjaan

| Fase | Nama | Isi | Output |
|------|------|-----|--------|
| **P0** | Mock UI | Semua layar dan state dibuat statis dengan HTML + Tailwind | Mock yang jadi acuan desain |
| **P1** | Engine 2D | Model data, render parametrik, port snapping, place/move/rotate, ganti ukuran, undo/redo, simpan/buka JSON | Editor yang bisa dipakai menggambar |
| **P2** | Validasi + Export | Warning validasi, anotasi, layer, export DXF/PNG/PDF | **MVP selesai** |
| **P3** | Setelah MVP | Rekomendasi AI, import denah, BOQ, elevasi/potongan, RA/FA | Roadmap |

## 6. P0 – Mock UI (fokus saat ini)

Mock dibuat **statis** (HTML + Tailwind, sedikit JS hanya untuk interaksi UI seperti ganti tool dan buka dialog). Gambar di kanvas berupa **SVG statis** sebagai contoh hasil. Mock ini tetap dipakai sebagai acuan tampilan sampai MVP selesai.

### 6.1 Layar yang harus ada

1. **Beranda / Daftar Proyek**: kartu proyek, tombol proyek baru, buka proyek
2. **Dialog Proyek Baru**: nama, satuan (inch / mm), skala gambar, dimensi ruangan awal
3. **Editor Utama**
   - Top bar: nama proyek, undo/redo, simpan, export
   - Toolbox kiri: Select, Pan, Ruangan, Duct, Fitting, Equipment, Diffuser, Dimensi/Label
   - Library aset kiri: kelompok Duct, Fitting, Perlengkapan, Equipment
   - Kanvas tengah: grid, denah ruangan pudar, duct berwarna di atasnya
   - Panel properti kanan: ukuran (W x H / Ø), sistem (SA/EA), debit, elevasi, rotasi
   - Panel layer kanan: SA, EA, Equipment, Diffuser, Gantungan, Dimensi, Denah (lock)
   - Status bar: koordinat kursor, zoom, satuan, snap on/off
4. **Dialog Export**: format (DXF/PNG/PDF), pilihan layer, skala
5. **Panel Warning**: daftar masalah validasi, klik untuk lompat ke lokasinya

### 6.2 State yang harus ada di mock

- Proyek kosong (empty state)
- Satu komponen terpilih (panel properti terisi)
- Warning validasi (port terbuka, ukuran beda tanpa transisi)
- Layer gantungan on dan off
- Mode zoom dekat (label ukuran terbaca)
- Tampilan mobile/tablet (minimal tidak rusak)

### 6.3 Library aset untuk mock (SVG)

- **Duct:** lurus, elbow 90°, double elbow, transisi, T, cabang
- **Perlengkapan:** diffuser (kotak ber-X), grille, damper, flexible duct, access door, louver, gantungan
- **Equipment:** fan/exhaust, indoor ducted (FCU/AHU), outdoor (simbol)

### 6.4 Konvensi gambar (draft, cek ke kebiasaan mandor/kantor)

| Elemen | Gaya |
|--------|------|
| Duct SA | Garis ganda, biru `#4ea1ff` |
| Duct EA | Garis ganda, magenta `#f472b6` |
| Diffuser/grille/louver | Kotak ber-X / bergaris, cyan `#22d3ee` |
| Equipment | Hijau `#4ade80` |
| Gantungan | Abu-abu, garis melintang + titik rod |
| Denah ruangan | Abu-abu tipis, layer terkunci |
| Label ukuran | Dekat segmen, mis. `24"x20"` atau `600x500` |
| Label debit | Di tiap cabang/diffuser (cfm atau L/s) |
| Arah aliran | Panah di sepanjang duct |

### 6.5 Definisi Selesai (P0)

- [x] Semua layar di 6.1 ada dan bisa dinavigasi
- [x] Semua state di 6.2 bisa ditampilkan (boleh lewat tombol/toggle demo)
- [x] Semua aset di 6.3 ada sebagai SVG yang rapi
- [x] Gaya gambar konsisten dengan tabel 6.4
- [ ] Sudah dilihat minimal satu mandor sungguhan dan feedback-nya dicatat

## 7. Teknis (rencana P1 ke atas)

- **Frontend:** Vite + TypeScript, Tailwind
- **Render 2D:** SVG (alternatif: Konva). Pindah ke canvas/WebGL hanya jika terbukti berat.
- **State:** satu store (mis. Zustand), semua perubahan lewat command agar undo/redo mudah
- **Export DXF:** library penulis DXF di JS, dengan layer rapi (DUCT-SA, DUCT-EA, EQUIPMENT, DIFFUSER, HANGER, DIMENSION, TEXT)
- **Simpan:** file JSON lokal dulu, belum ada backend

### Sketsa model data

```json
{
  "project": { "name": "Contoh", "unit": "inch" },
  "room": { "points": [[0,0],[6000,0],[6000,4000],[0,4000]] },
  "nodes": [
    { "id": "n1", "type": "elbow", "x": 1000, "y": 500, "rotation": 90,
      "w": 24, "h": 20, "system": "SA", "elevation": 2700 }
  ],
  "ports": [
    { "node": "n1", "id": "a", "dir": 0, "w": 24, "h": 20 }
  ],
  "links": [
    { "from": ["n1", "a"], "to": ["n2", "b"] }
  ]
}
```

## 8. Struktur Folder

```
temandor/
├─ README.md
├─ .github/FUNDING.yml    # tombol Sponsor GitHub (isi handle donasi)
├─ uji-dxf/              # contoh DXF + checklist uji di AutoCAD
├─ mcp/server.js          # server MCP stdio: node mcp/server.js (folder proyek: TEMANDOR_DIR)
├─ app/                   # prototype P1 (script biasa, tanpa build)
│  ├─ landing.html        # halaman depan untuk pengunjung baru (lembar gambar + kop = form)
│  ├─ index.html          # beranda: daftar proyek, proyek baru, buka .json
│  ├─ editor.html         # editor
│  ├─ docs.html           # dokumentasi pengguna
│  ├─ settings.html       # pengaturan: akun, integrasi AI, preferensi (mock)
│  ├─ login.html          # masuk / daftar / lupa sandi (mock)
│  ├─ template.html       # detail template
│  ├─ checkout.html       # pembayaran template (mock)
│  ├─ seller.html         # daftar jadi penjual (mock)
│  ├─ 404.html
│  ├─ test.js             # cek logika inti: node app/test.js
│  ├─ css/app.css         # gaya bersama aplikasi
│  ├─ css/landing.css     # gaya khusus landing
│  ├─ assets/svg/         # ikon library
│  └─ js/
│     ├─ geom.js          # komponen parametrik: port, primitive, grip, jalur → duct + elbow
│     ├─ model.js         # layer, koneksi port, validasi, debit, simpan, proyek contoh
│     ├─ render.js        # primitive → SVG (layar, thumbnail, PNG/PDF)
│     ├─ dxf.js           # primitive → DXF R12
│     ├─ tools.js         # aksi gambar untuk AI & MCP (murni, tanpa DOM)
│     ├─ editor.js        # interaksi editor
│     ├─ ai.js            # asisten AI (Claude) di editor
│     ├─ home.js          # beranda
│     ├─ store.js         # katalog template (mock) + helper beli/pakai
│     └─ ui.js            # helper bersama + config Tailwind
├─ mock/
│  ├─ index.html          # beranda / daftar proyek + dialog proyek baru
│  ├─ editor.html         # editor utama + dialog export + panel warning
│  ├─ css/
│  │  └─ mock.css         # gaya bersama + state demo
│  ├─ assets/
│  │  ├─ thumb-denah.svg  # thumbnail kartu proyek
│  │  └─ svg/             # library aset (duct, fitting, perlengkapan, equipment)
│  └─ js/
│     └─ mock.js          # interaksi UI saja, tanpa logika gambar
```

## 9. Keputusan yang Masih Terbuka

- Satuan default: inch, mm, atau pilihan per proyek? (mock: pilihan per proyek, default inch)
- Apakah mandor butuh gambar RA dan FA sejak awal, atau cukup SA + EA?
- Standar warna dan layer: ikut kebiasaan kantor mana?
- Format aset yang sudah ada (DXF/DWG, SVG, PNG)?

## 10. Risiko

| Risiko | Mitigasi |
|--------|----------|
| Scope melebar ke semua jenis mandor | Fokus ducting dan ventilasi sampai MVP selesai |
| Aset di-scale sehingga tampilan cacat | Aset parametrik sejak P1 |
| Skala ekspor DXF salah | Simpan satuan nyata, uji export di AutoCAD sejak awal P2 |
| Hasil gambar dipakai tanpa dicek | Tampilkan asumsi, beri catatan bahwa ini sketsa bantu |
| Mock terlalu bagus lalu dianggap sudah jadi | Label "MOCK · P0" di top bar, status bar, dan bar DEMO |
