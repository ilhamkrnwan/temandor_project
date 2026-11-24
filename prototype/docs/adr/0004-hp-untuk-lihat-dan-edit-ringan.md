---
status: accepted
---
# HP untuk melihat dan edit ringan, gambar detail di laptop/tablet

Mandor di lapangan kemungkinan memakai HP, tapi menggambar jalur duct presisi dengan jari sulit. Target HP: zoom dan geser dua jari, pilih komponen, ubah properti. Menggambar detail tetap diutamakan di laptop/tablet. Kalau uji ke mandor menunjukkan mereka menggambar di HP, keputusan ini direvisi.

## Consequences

- Kanvas memakai `touch-action: none`, jadi zoom bawaan browser mati; zoom/geser dua jari ditangani sendiri di editor. Satu jari = alat aktif; jari kedua membatalkan gerakan yang sedang berjalan dan beralih ke zoom/geser.
