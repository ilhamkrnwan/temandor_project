# Uji DXF di AutoCAD

File contoh dari proyek demo "Contoh – Kantor Lt. 2" (duct inch, skala 1:100). Dibuat ulang dengan export DXF di editor kapan saja.

| File | Satuan model |
|------|--------------|
| `kantor-mm.dxf` | mm |
| `kantor-inch.dxf` | inch |

Buka di AutoCAD (atau DWG TrueView, gratis dari Autodesk). Tulis hasil di kolom **Hasil** (OK / masalah + screenshot).

| # | Cek | Cara | Harapan | Hasil mm | Hasil inch |
|---|-----|------|---------|----------|------------|
| 1 | File terbuka | `OPEN` | Tanpa error / recover | | |
| 2 | Satuan | `UNITS` | mm / inch sesuai nama file | | |
| 3 | Ukuran ruangan Kantor | `DIST` sudut ke sudut | 9000 mm (mm) · 354,33" (inch) | | |
| 4 | Ukuran R. Rapat | `DIST` | 5150 × 5650 mm | | |
| 5 | Layer | `LAYER` | DUCT-SA, DUCT-EA, EQUIPMENT, DIFFUSER, HANGER, DIMENSION, TEXT, A-WALL… | | |
| 6 | Warna per layer | lihat gambar | SA biru, EA magenta, equipment hijau | | |
| 7 | Elbow | zoom ke belokan | Busur rapi, menyambung ke duct lurus | | |
| 8 | Teks & label ukuran | zoom | Terbaca, tidak terlalu kecil/besar untuk 1:100 | | |
| 9 | Simbol Ø dan ° | cari label duct bulat / sudut | Tampil sebagai Ø dan ° | | |
| 10 | Catatan sketsa | bawah gambar | "SKETSA BANTU TEMANDOR – CEK ULANG…" | | |
| 11 | Plot / print | `PLOT` skala 1:100 | Ukuran di kertas wajar | | |
| 12 | Edit | pindah satu garis duct | Bisa diedit seperti gambar biasa | | |

Masalah yang sudah diketahui: balok dan bukaan masih garis penuh (belum putus-putus).
