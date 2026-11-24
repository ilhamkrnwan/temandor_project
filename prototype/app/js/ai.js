// Temandor – asisten AI di editor (menu "AI"). Claude membaca & mengubah gambar lewat aksi di tools.js.
// Kunci API milik pengguna, disimpan di browser ini, hanya dikirim ke api.anthropic.com.
const AI = { msgs: [], busy: false, client: null, Anthropic: null };
const AI_KEY = 'temandor.ai.key';
const AI_SYSTEM = `Kamu asisten di Temandor, aplikasi sketsa ducting & ventilasi (HVAC) untuk teknisi lapangan di Indonesia.
Kamu bisa membaca dan mengubah gambar lewat tool. Satuan posisi mm, x ke kanan, y ke bawah.
- Panggil get_project dulu untuk tahu isi gambar; panggil list_types kalau butuh tipe/parameter komponen.
- Setelah mengubah gambar, cek warnings di get_project dan sebutkan yang masih tersisa.
- Ukuran duct (w/h) memakai satuan duct proyek. Jalur duct berbelok: draw_duct (elbow otomatis).
- Jawab singkat dalam bahasa Indonesia sehari-hari. Ini sketsa bantu: ingatkan cek ukuran di lapangan bila relevan.
- Kalau permintaan kurang jelas (mis. ukuran ruangan), pakai nilai wajar dan sebutkan asumsinya.`;

const aiLog = $('#ai-log');
function aiBubble(role, html) {
  aiLog.querySelector('.ai-empty')?.remove();
  const el = Object.assign(document.createElement('div'), { className: 'ai-msg ' + role, innerHTML: html });
  aiLog.append(el); aiLog.scrollTop = aiLog.scrollHeight;
  return el;
}
const aiText = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
const TOOL_LABEL = { get_project: 'Membaca gambar', list_types: 'Melihat daftar komponen', add_nodes: 'Menambah komponen', draw_duct: 'Menggambar jalur duct', update_nodes: 'Mengubah komponen', delete_nodes: 'Menghapus komponen' };

// Kunci diatur di settings.html#integrasi
function aiKeyUI() {
  const has = !!localStorage.getItem(AI_KEY);
  $('#ai-key-box').hidden = has;
  $('#ai-form').hidden = !has;
  $('#ai-model').innerHTML = has ? '<img src="assets/svg/ai/claude.svg" alt="" class="w-3 h-3">Claude' : '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Belum terkoneksi';
}
// Jendela melayang: buka/tutup lewat tombol, Ctrl+K, Esc
function aiOpen(on) {
  $('#ai-win').hidden = !on;
  document.body.classList.toggle('ai-open', on); // panel properti mengalah selama AI terbuka
  $('#ai-fab').setAttribute('aria-expanded', on);
  if (on) ($('#ai-form').hidden ? $('#ai-key-box a') : $('#ai-in')).focus(); else $('#ai-fab').focus();
}
$('#ai-fab').onclick = () => aiOpen(true);
$('#ai-close').onclick = () => aiOpen(false);
$('#ai-win').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); aiOpen(false); } });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); aiOpen($('#ai-win').hidden); } }, true);
addEventListener('pageshow', () => { AI.client = null; aiKeyUI(); }); // balik dari Pengaturan (bfcache)
$('#ai-clear').onclick = () => { AI.msgs = []; aiLog.innerHTML = AI_EMPTY; };

async function aiClient() {
  if (AI.client) return AI.client;
  // SDK resmi Anthropic dari CDN (aplikasi ini tanpa build step)
  const { default: Anthropic } = await import('https://esm.sh/@anthropic-ai/sdk');
  AI.Anthropic = Anthropic;
  AI.client = new Anthropic({ apiKey: localStorage.getItem(AI_KEY), dangerouslyAllowBrowser: true });
  return AI.client;
}
function aiErr(e) {
  const A = AI.Anthropic;
  if (A && e instanceof A.AuthenticationError) return 'Kunci API ditolak. Cek atau ganti kuncinya.';
  if (A && e instanceof A.PermissionDeniedError) return 'Kunci API ini tidak punya akses ke model yang dipakai.';
  if (A && e instanceof A.RateLimitError) return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  if (A && e instanceof A.APIConnectionError) return 'Tidak bisa terhubung ke server AI. Cek koneksi internet.';
  if (A && e instanceof A.APIError) return `Server AI error (${e.status || '?'}): ${e.message}`;
  return 'Gagal memuat asisten AI: ' + e.message;
}

async function aiSend(text) {
  if (AI.busy || !text.trim()) return;
  AI.busy = true; $('#ai-send').disabled = true;
  aiBubble('user', aiText(text));
  AI.msgs.push({ role: 'user', content: text });
  const wait = aiBubble('bot wait', '<span class="ai-dots"><i></i><i></i><i></i></span>');
  try {
    const client = await aiClient();
    for (let step = 0; step < 15; step++) {
      const r = await client.beta.messages.create({
        model: 'claude-opus-5-5', max_tokens: 16000,
        thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', // kalau ditolak filter keamanan, server mencoba model cadangan
        system: AI_SYSTEM, tools: toolDefs(), messages: AI.msgs,
      });
      AI.msgs.push({ role: 'assistant', content: r.content }); // dikirim balik apa adanya (termasuk blok thinking)
      for (const b of r.content) if (b.type === 'text' && b.text.trim()) wait.before(aiBubble('bot', aiText(b.text)));
      if (r.stop_reason === 'refusal') { wait.before(aiBubble('bot', 'Maaf, permintaan ini tidak bisa diproses.')); break; }
      if (r.stop_reason === 'pause_turn') continue;
      const uses = r.content.filter(b => b.type === 'tool_use');
      if (!uses.length) { if (r.stop_reason === 'max_tokens') wait.before(aiBubble('bot', 'Jawaban terpotong (terlalu panjang).')); break; }
      const results = [];
      const before = new Map(P.nodes.map(n => [n.id, JSON.stringify(n)]));
      commit(() => { // satu langkah AI = satu undo
        for (const u of uses) {
          try { results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(runTool(P, u.name, u.input)) }); }
          catch (e) { results.push({ type: 'tool_result', tool_use_id: u.id, content: e.message, is_error: true }); }
        }
      });
      // Perubahan AI terlihat: komponen baru/berubah dipilih & di-zoom, langkah ini bisa diurungkan dari balonnya
      const changed = P.nodes.filter(n => before.get(n.id) !== JSON.stringify(n)).map(n => n.id), gone = [...before.keys()].filter(id => !node(id)).length, mark = hist.length;
      if (changed.length) { sel = new Set(changed); refresh(); zoomSel(); }
      const bubble = aiBubble('tool', uses.map((u, i) => `<span class="${results[i].is_error ? 'err' : ''}">${TOOL_LABEL[u.name] || u.name}${results[i].is_error ? ' – gagal' : ''}</span>`).join('')
        + (changed.length || gone ? `<button type="button" class="ai-undo">Urungkan langkah ini</button>` : ''));
      const ub = bubble.querySelector('.ai-undo');
      if (ub) ub.onclick = () => { if (hist.length !== mark) return toast('Sudah ada perubahan lain sesudahnya. Pakai Ctrl+Z untuk mundur satu per satu.'); undo(); ub.disabled = true; ub.textContent = 'Diurungkan'; };
      wait.before(bubble);
      AI.msgs.push({ role: 'user', content: results });
    }
  } catch (e) {
    wait.before(aiBubble('bot err', esc(aiErr(e))));
    if (AI.msgs.at(-1).role === 'user' && typeof AI.msgs.at(-1).content === 'string') AI.msgs.pop(); // permintaan gagal: boleh dikirim ulang
  } finally {
    wait.remove(); AI.busy = false; $('#ai-send').disabled = false;
    aiLog.scrollTop = aiLog.scrollHeight;
  }
}
const AI_EMPTY = `<div class="ai-empty"><b class="block font-cond text-xl leading-tight">Mau digambarkan apa?</b><p>AI bisa menggambar, mengubah, atau mengecek sketsa. Semua perubahan bisa di-undo (Ctrl+Z).</p>
  ${['Cek gambar ini dan jelaskan warning-nya', 'Tambah ruangan rapat 6x5 m di sebelah kanan, dengan pintu dan 2 diffuser', 'Sambungkan ujung duct yang masih terbuka']
    .map(s => `<button class="ai-sug" type="button">${s}</button>`).join('')}</div>`;
aiLog.innerHTML = AI_EMPTY;
aiLog.addEventListener('click', e => { const b = e.target.closest('.ai-sug'); if (b && localStorage.getItem(AI_KEY)) aiSend(b.textContent); else if (b) toast('Hubungkan Claude dulu untuk memakai saran ini', { label: 'Hubungkan', fn: () => { location.href = 'settings.html#integrasi'; } }); });
$('#ai-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#ai-in').value; $('#ai-in').value = ''; aiSend(v); });
$('#ai-in').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ai-form').requestSubmit(); } });
aiKeyUI();
