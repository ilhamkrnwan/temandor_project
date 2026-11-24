---
status: accepted
---
# Login opsional selama prototype, wajib di fase berikutnya

Prototype dipakai untuk validasi ke mandor, jadi aplikasi harus bisa langsung dipakai tanpa daftar: semua fitur gambar jalan tanpa akun dan proyek disimpan di browser (localStorage). Halaman masuk/daftar sudah ada sebagai tampilan (mock) supaya alur lengkap, tapi belum terhubung ke server. Setelah prototype, login jadi wajib.

## Consequences

- Saat login jadi wajib, proyek lokal tidak dibuang: login pertama menawarkan "Pindahkan N proyek ke akun".
- Status "masuk" di prototype hanya flag mock di browser, bukan sesi asli. Jangan dipakai untuk hal yang butuh keamanan.
