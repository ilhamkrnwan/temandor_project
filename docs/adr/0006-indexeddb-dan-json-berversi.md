---
status: accepted
---
# Proyek disimpan di IndexedDB, file proyek JSON berversi

Prototype menyimpan proyek di localStorage (batas ~5 MB, sinkron, ikut terhapus bersama data situs). Aplikasi real menyimpan proyek di **IndexedDB lewat `idb-keyval`**. Cadangan dan pertukaran tetap lewat **file `.json`** yang diunduh/dibuka pengguna.

- File proyek punya field `version`. File dari prototype (tanpa `version`) dianggap **v1** dan dimigrasi otomatis saat dibuka.
- Migrasi berupa fungsi murni `vN → vN+1` di core, masing-masing dites dengan file contoh dari prototype.
- Proyek contoh "Kantor Lt. 2" dan file di `prototype/uji-dxf/` jadi bahan tes regresi.

## Consequences

- Data tetap milik pengguna dan ada di perangkatnya; tanpa akun.
- Menghapus data situs di browser menghapus proyek. Beranda mengingatkan untuk mengunduh `.json` sebagai cadangan.
- `dexie` tidak dipakai: belum perlu query/indeks, cukup key-value per proyek.
