---
status: accepted
---
# Scope MVP real: inti gambar duct; fitur mock dibuang, AI & MCP ditunda

Pengguna utama tetap **mandor pemula** yang belum bisa AutoCAD. Drafter/kontraktor HVAC adalah penerima DXF sekaligus validator: MVP berhasil kalau drafter bisa memakai DXF tanpa menggambar ulang.

**Masuk MVP** (di-port dari prototype): editor komponen parametrik, duct dengan elbow otomatis, fitting & perlengkapan, ruangan & arsitektur, ukur/teks/catatan, validasi (warning, tidak melarang), layer, undo/redo, simpan/buka, export DXF/PNG/PDF/JSON, daftar material (BOQ), landing, docs.

**Dibuang** (mock di prototype, ADR prototype 0001 & 0003): marketplace template, checkout, dasbor penjual, login/akun, halaman pengaturan mock.

**Ditunda ke M6**: asisten AI (BYOK Claude, ADR prototype 0002) dan server MCP.

**Tidak dikejar**: fitur CAD umum (line/circle bebas, snap perpotongan) untuk drafter; 3D; cloud; kolaborasi.

## Consequences

- Validasi ke pengguna (M0) berjalan paralel dengan fondasi. Hasilnya boleh mengubah urutan tiket M3–M5.
- Monetisasi belum dibangun. Donasi (`.github/FUNDING.yml`) tetap.
