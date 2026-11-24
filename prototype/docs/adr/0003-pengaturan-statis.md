---
status: accepted
---
# Halaman Pengaturan statis, kecuali kunci Claude

`settings.html` (Akun, Integrasi AI, Preferensi, Data) dibuat sebagai tampilan statis supaya alur aplikasi lengkap untuk slicing, tanpa backend. Satu pengecualian: kartu Claude tetap menyimpan kunci API asli, supaya asisten AI yang sudah berfungsi tidak hilang. Panel AI di editor tidak lagi meminta kunci; saat belum terkoneksi ia mengarahkan ke `settings.html#integrasi`.
