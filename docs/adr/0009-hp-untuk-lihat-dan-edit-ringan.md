---
status: accepted
---
# HP untuk melihat dan edit ringan, gambar detail di laptop/tablet

Dibawa dari ADR prototype 0004, tetap berlaku untuk aplikasi real.

Mandor di lapangan kemungkinan memakai HP, tapi menggambar jalur duct presisi dengan jari sulit. Target HP: zoom dan geser dua jari, pilih komponen, ubah properti, kirim PNG. Menggambar detail diutamakan di laptop/tablet. Kalau validasi (M0) menunjukkan mandor menggambar di HP, keputusan ini direvisi.

## Consequences

- Kanvas memakai `touch-action: none`; zoom/geser dua jari ditangani editor sendiri. Satu jari = alat aktif; jari kedua membatalkan gerakan yang berjalan dan beralih ke zoom/geser.
- Di layar sempit, rail jadi tab bar bawah dan panel jadi bottom sheet.
