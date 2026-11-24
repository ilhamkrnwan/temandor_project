---
status: accepted
---
# AI pakai kunci API pengguna sendiri, hanya Claude yang benar-benar terhubung

Selama prototype, asisten AI memakai kunci API Anthropic milik pengguna (BYOK), disimpan di browser dan hanya dikirim ke api.anthropic.com. Tidak ada server Temandor, kuota, atau tagihan. Aksi gambar untuk AI (`app/js/tools.js`) memakai format tool Anthropic, jadi ChatGPT, Gemini, dan model lokal tampil di Pengaturan sebagai kartu mock saja.

## Considered Options

- AI terkelola Temandor (kuota/berbayar): butuh login, server, dan tagihan. Ditunda sampai ada pengguna nyata.
- Multi-provider sungguhan: butuh lapisan adapter format tool per provider. Ditunda sampai ada permintaan.
