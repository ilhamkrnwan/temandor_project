# M0 Validasi

Non-kode. Jalan paralel dengan M1–M2. Tujuannya memastikan fitur yang di-port memang dibutuhkan (ADR 0008).

---

### M0-01 · Uji DXF prototype di AutoCAD / DWG TrueView

**Label:** `m0-validasi` · **Estimasi:** 0,5 hari · **Butuh:** —
**Acuan:** `prototype/uji-dxf/CHECKLIST.md`, `kantor-mm.dxf`, `kantor-inch.dxf`

**Kerjakan**
- Buka kedua file di AutoCAD atau DWG TrueView (gratis).
- Isi kolom Hasil untuk 12 cek di checklist, lampirkan screenshot untuk tiap masalah.

**Selesai bila**
- [ ] Semua 12 baris checklist terisi untuk mm dan inch.
- [ ] Masalah yang ditemukan jadi catatan di tiket M4-03 (export DXF).

---

### M0-02 · Naskah wawancara & demo

**Label:** `m0-validasi` · **Estimasi:** 0,5 hari · **Butuh:** —

**Kerjakan**
- Tulis `docs/validasi/naskah.md` berisi dua bagian.
- **Mandor:** biasanya menggambar jalur duct pakai apa (kertas, HP, minta drafter)? Bagian mana yang paling lama? Komponen apa yang paling sering? Seberapa sering revisi? Menggambar di HP atau laptop? Hasilnya dikirim lewat apa?
- **Drafter:** dari mandor biasanya terima apa? Apakah DXF Temandor bisa dipakai tanpa digambar ulang? Perlu block (satu fitting = satu objek) atau dimensi asli? Standar layer kantor?
- Skenario demo 10 menit dengan prototype (proyek contoh "Kantor Lt. 2").

**Selesai bila**
- [ ] Naskah ada di repo dan sudah dicoba sekali (boleh ke teman).

---

### M0-03 · Wawancara & demo ke 3 mandor

**Label:** `m0-validasi` · **Estimasi:** 2 hari (tersebar) · **Butuh:** M0-02

**Kerjakan**
- Demo prototype, minta mandor menggambar satu jalur sendiri. Catat di mana mereka bingung.
- Simpan catatan per orang di `docs/validasi/mandor-<n>.md` (tanpa data pribadi selain peran & kota).

**Selesai bila**
- [ ] 3 catatan wawancara ada.
- [ ] Centang "Sudah dilihat minimal satu mandor" di `prototype/README.md` §6.5.

---

### M0-04 · Uji DXF ke 2 drafter

**Label:** `m0-validasi` · **Estimasi:** 1 hari (tersebar) · **Butuh:** M0-01, M0-02

**Kerjakan**
- Kirim DXF hasil prototype (dari M0-01 atau buatan mandor di M0-03).
- Tanyakan bagian drafter di naskah. Catat di `docs/validasi/drafter-<n>.md`.

**Selesai bila**
- [ ] 2 catatan drafter ada, termasuk jawaban "bisa dipakai tanpa gambar ulang?".

---

### M0-05 · Rangkum temuan, revisi rencana

**Label:** `m0-validasi` · **Estimasi:** 0,5 hari · **Butuh:** M0-03, M0-04

**Kerjakan**
- Tulis `docs/validasi/ringkasan.md`: 5 temuan teratas, kutipan pendek, keputusan.
- Hapus tanda **(asumsi)** di `PRODUCT.md` yang terjawab.
- Revisi urutan/isi tiket M3–M5. Bila drafter butuh BLOCK/DIMENSION asli → ADR baru yang menggantikan bagian DXF di ADR 0007. Bila mandor menggambar di HP → revisi ADR 0009.

**Selesai bila**
- [ ] Ringkasan ada, PRODUCT.md dan tiket diperbarui, ADR baru bila ada keputusan berubah.
