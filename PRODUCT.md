# Product

<!-- impeccable:product-schema 1 -->

> Ditulis 2026-11-21 dari README, ADR, dan kode, saat pemilik proyek mendelegasikan keputusan ("semua keputusan berdasarkan rekomendasi"). Fakta bertanda **(asumsi)** belum dikonfirmasi pemilik.

## Platform

web

## Stack

Static HTML + Tailwind CDN + vanilla JS, tanpa build step (`prototype/app`). Data proyek di localStorage. Server MCP Node tanpa dependensi (`prototype/mcp`). Rencana jangka panjang di README: Vite + TypeScript.

## Users

- **Mandor pemula ducting & ventilasi** di Indonesia: paham kerja lapangan (duct, elbow, diffuser, gantungan), belum bisa AutoCAD. Menyusun sketsa jalur duct untuk diserahkan ke drafter atau dipakai sendiri di lapangan.
- Drafter / kontraktor HVAC sebagai penerima file DXF **(asumsi: audiens sekunder)**.
- Penjual template: mandor yang menjual gambar jadi (marketplace masih mock).

## Product Purpose

Membuat sketsa 2D denah + jalur duct dengan gaya gambar AutoCAD tanpa harus menguasai AutoCAD, lalu export DXF berlayer rapi. Berhasil kalau mandor bisa menyerahkan gambar yang dipercaya drafter tanpa digambar ulang.

## Positioning

- **Komponen, bukan garis.** Duct, elbow, T, diffuser punya titik sambung; elbow dipasang otomatis di tiap belokan, ukuran ikut ujung yang ditempeli.
- **App menjaga, tidak melarang.** Warning (ujung terbuka, ukuran beda tanpa transisi, duct menabrak kolom) digambar langsung di sketsa; simpan & export tetap boleh.
- **Keluar sebagai DXF yang rapi** (layer DUCT-SA, DUCT-EA, EQUIPMENT, …), bukan gambar mati.
- Gratis & open source, data di perangkat sendiri.

## Operating Context

Kantor proyek (laptop) dan lapangan (HP, satu tangan, cahaya terang; ADR 0004: HP untuk lihat + edit ringan). Satuan duct inch atau mm, skala 1:50–1:200, sistem SA dan EA (RA/FA menyusul). Hasil dikirim ke drafter / atasan, sering lewat WhatsApp **(asumsi)**.

## Capabilities and Constraints

Nyata di prototype: editor komponen parametrik, duct dengan elbow otomatis (sudut bebas, reducing, siku+vane), ruangan & arsitektur, ukur, teks bergaya & catatan+panah, validasi, layer, export DXF R12 / PNG / PDF / JSON, asisten AI (Claude, kunci API pengguna), server MCP, zoom dua jari.
Mock: akun/login (ADR 0001), marketplace template & pembayaran, penjual, integrasi AI selain Claude (ADR 0002/0003).
Belum ada: BOQ otomatis, RA/FA, import denah, kolaborasi, cloud.

## Brand Commitments

Nama **Temandor** ("teman mandor"). Bahasa Indonesia sehari-hari, lugas. Stempel kejujuran "Sketsa bantu – cek ulang ukuran di lapangan" di setiap export. Label "PROTOTYPE/MOCK" wajib di bagian yang belum sungguhan.

## Evidence on Hand

- Proyek contoh "Contoh – Kantor Lt. 2" (`demoProject()` di `prototype/app/js/model.js`) dan 6 template sketsa (`js/store.js`) bisa dirender langsung sebagai gambar produk asli.
- File DXF contoh: `prototype/uji-dxf/`.
- **Tidak ada**: testimoni, jumlah pengguna, logo klien, liputan, harga final, persentase bagi hasil. Nama penjual & rating di katalog template adalah data mock; jangan dipakai sebagai bukti sosial.

## Product Principles

1. Pemula dulu: istilah lapangan, bukan istilah CAD; setiap aksi bisa diurungkan.
2. Jujur: sebut sketsa bantu, tandai mock, jangan klaim yang belum ada.
3. Hasil harus bisa dipakai orang lain (DXF berlayer, PNG untuk chat).
4. Data milik pengguna: lokal dulu, tanpa akun wajib di prototype.

## Accessibility & Inclusion

WCAG AA sebagai patokan (kontras ≥4,5:1, target sentuh ≥24px, keyboard di kanvas). Pengguna lapangan memakai HP di cahaya terang **(asumsi)**.
