# M6 AI & MCP (setelah v0.1)

Fitur yang sudah jalan di prototype tapi bukan inti MVP (ADR 0008). Dikerjakan setelah v0.1 rilis dan ada masukan pengguna.

---

### M6-01 · Aksi gambar murni untuk AI & MCP

**Label:** `m6-ai` `core` · **Estimasi:** 1 hari · **Butuh:** M5-07
**Acuan:** `prototype/app/js/tools.js` (`AI_TOOLS`, `runTool`, `applyProps`, `hostIt`, `toolReadOnly`)

**Kerjakan**
- Port ke `shared/cad/tools.ts`: definisi tool (nama, deskripsi Bahasa Indonesia, skema input dari zod) + `runTool(project, name, input)` murni.
- Tool read-only ditandai.

**Selesai bila**
- [x] Tes unit tiap tool pada `demoProject()`.

---

### M6-02 · Asisten AI di editor (BYOK Claude)

**Label:** `m6-ai` `ui` · **Estimasi:** 2 hari · **Butuh:** M6-01
**Acuan:** `prototype/app/js/ai.js`, ADR prototype 0002 & 0003

**Kerjakan**
- Tombol **Tanya AI** melayang (`Ctrl+K`). Kunci API Anthropic milik pengguna disimpan di browser, hanya dikirim ke `api.anthropic.com` (`@anthropic-ai/sdk` mode browser).
- Model default mengikuti prototype (`claude-opus-5-5`); cek model terbaru saat dikerjakan.
- Tiap langkah AI = satu undo; komponen yang diubah langsung terpilih & di-zoom; tombol **Urungkan langkah ini**.
- Halaman/dialog pengaturan minimal: hanya kunci Claude (tanpa kartu provider mock).

**Selesai bila**
- [x] Tes unit loop tool dengan respons API yang di-mock; kunci tidak pernah dikirim ke host lain (tes jaringan di Playwright).

---

### M6-03 · Server MCP

**Label:** `m6-ai` `core` · **Estimasi:** 1,5 hari · **Butuh:** M6-01
**Acuan:** `prototype/mcp/server.js`, ADR 0005 (workspace ditunda sampai tiket ini)

**Kerjakan**
- Pecah repo jadi Bun workspace: `packages/core` (isi `shared/cad/`), app Nuxt, `packages/mcp`.
- `packages/mcp` dengan `@modelcontextprotocol/sdk`: transport stdio, tool sama dengan M6-01 + `file`, export DXF ke disk (`TEMANDOR_DIR`).
- Panduan setup Claude Desktop / Claude Code di `/docs`.

**Selesai bila**
- [x] Tes integrasi: buat proyek, tambah duct, export DXF lewat MCP client tes.
