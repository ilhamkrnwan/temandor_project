// Temandor – beranda: daftar proyek dari browser, proyek baru, buka .json.
const go = id => { location.href = 'editor.html?id=' + id; };


if (!localStorage.getItem('temandor.seeded')) { saveProject(demoProject()); localStorage.setItem('temandor.seeded', '1'); }

function list() {
  const ps = listProjects();
  document.body.classList.toggle('is-empty', !ps.length);
  $('#count').textContent = `${ps.length} proyek · disimpan di browser ini`;
  $('#projects').innerHTML = ps.map(p => {
    const cn = connect(p), w = validate(p, cn).length, sys = ['SA', 'EA'].filter(s => p.nodes.some(n => n.sys === s && TYPES[n.type].duct));
    return `<article data-name="${esc(p.name)}" class="card relative bg-panel rounded-xl ring-1 ring-line hover:ring-ink overflow-hidden transition">
      <a href="editor.html?id=${p.id}" class="block">
        <div class="card-thumb h-40 bg-cad overflow-hidden">${thumbSVG(p)}</div>
        <div class="p-4">
          <div class="flex items-start gap-2">
            <h2 class="font-semibold leading-snug mr-auto">${esc(p.name)}</h2>
            ${w ? `<span class="shrink-0 text-xs font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 rounded px-1.5 py-0.5">${w} warning</span>` : '<span class="shrink-0 text-xs font-semibold text-green-800 bg-green-50 ring-1 ring-green-200 rounded px-1.5 py-0.5">Aman</span>'}
          </div>
          <div class="mt-2 flex items-center gap-1.5 text-xs">
            ${sys.map(s => `<span class="px-1.5 py-0.5 rounded font-mono font-medium ${s === 'SA' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}">${s}</span>`).join('')}
            <span class="font-mono text-muted ml-1">${p.unit} · ${p.scale}</span>
          </div>
          <p class="mt-3 text-xs text-muted">Diubah ${ago(p.updated)}</p>
        </div>
      </a>
      <div class="absolute right-2 bottom-2 flex gap-2">
        <button class="btn-ghost !h-8 !px-2.5 !text-xs bg-panel" data-dl="${p.id}" title="Unduh file .json">Unduh</button>
        <button class="btn-ghost !h-8 !px-2.5 !text-xs bg-panel !text-red-700" data-del="${p.id}" title="Hapus proyek">Hapus</button>
      </div>
    </article>`;
  }).join('') + `<button data-open-new class="min-h-[15rem] rounded-xl border-2 border-dashed border-line hover:border-ink text-muted hover:text-ink grid place-items-center transition">
      <span class="flex flex-col items-center gap-2"><svg viewBox="0 0 24 24" class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg><span class="font-semibold">Proyek baru</span></span></button>`;
  $('#search').dispatchEvent(new Event('input'));
}

$('#projects').addEventListener('click', e => {
  const del = e.target.closest('[data-del]'), dl = e.target.closest('[data-dl]');
  if (e.target.closest('[data-open-new]')) return $('#dlg-new').showModal();
  if (dl) { const p = loadProject(dl.dataset.dl); return download(slug(p.name) + '.json', JSON.stringify(p, null, 1), 'application/json'); }
  if (del) {
    const p = loadProject(del.dataset.del);
    if (confirm(`Hapus proyek "${p.name}"?\nProyek dihapus dari browser ini. Masih bisa diurungkan beberapa detik setelahnya; setelah itu hanya bisa dipulihkan dari file .json.`)) { deleteProject(p.id); list(); toast('Proyek dihapus', { label: 'Urungkan', fn: () => { saveProject(p); list(); } }); }
  }
});
$('#search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  $$('#projects [data-name]').forEach(c => { c.style.display = c.dataset.name.toLowerCase().includes(q) ? '' : 'none'; });
});
$('#add-demo').onclick = () => { const p = demoProject(); saveProject(p); go(p.id); };

$('#open-file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { const p = importProject(JSON.parse(await f.text())); saveProject(p); go(p.id); }
  catch (err) { toast('Gagal membuka: ' + (err.message.includes('Temandor') ? err.message : 'file bukan JSON proyek Temandor')); }
});

// Dialog proyek baru
const f = $('#form-new'), room = $('#prev-room');
function preview() {
  const p = +f.p.value || 1, l = +f.l.value || 1, k = Math.min(170 / p, 96 / l);
  Object.entries({ width: p * k, height: l * k, x: (220 - p * k) / 2, y: (124 - l * k) / 2 }).forEach(([a, v]) => room.setAttribute(a, v));
  $('#prev-dim').textContent = `${p} × ${l} m`;
  $('#unit-eg').textContent = f.satuan.value === 'mm' ? '600x500' : '24"x20"';
}
f.addEventListener('input', preview);
f.addEventListener('submit', e => {
  e.preventDefault();
  const p = newProject({ name: f.nama.value.trim(), unit: f.satuan.value, scale: f.skala.value, W: Math.round(+f.p.value * 1000), H: Math.round(+f.l.value * 1000) });
  try { saveProject(p); go(p.id); } catch { toast('Penyimpanan browser penuh. Hapus proyek lama dulu.'); }
});
preview();
list();

// ================= Template (MOCK) – data di store.js =================
let tplCat = 'Semua';
function tplList() {
  const cats = ['Semua', ...new Set(TEMPLATES.map(t => t.cat)), 'Gratis'];
  $('#tpl-filter').innerHTML = cats.map(c => `<button class="chip" data-cat="${c}" aria-pressed="${c === tplCat}">${c}</button>`).join('');
  $('#tpl').innerHTML = TEMPLATES.filter(t => tplCat === 'Semua' || t.cat === tplCat || (tplCat === 'Gratis' && !t.price)).map(t => {
    const { p, rooms, m2, dif } = tplInfo(t), use = canUse(t);
    return `<article class="card relative bg-panel rounded-xl ring-1 ring-line hover:ring-ink overflow-hidden transition flex flex-col">
      <a href="template.html?id=${t.id}" class="card-thumb relative block h-40 bg-cad overflow-hidden" aria-label="Lihat detail ${esc(p.name)}">${thumbSVG(p)}
        <span class="absolute left-2 top-2 text-xs font-semibold rounded px-1.5 py-0.5 ${t.price ? 'bg-ink text-white' : 'bg-green-700 text-white'}">${t.price && use ? 'Dimiliki' : rp(t.price)}</span></a>
      <div class="p-4 flex-1 flex flex-col">
        <div class="flex items-start gap-2"><h3 class="font-semibold leading-snug mr-auto"><a href="template.html?id=${t.id}" class="hover:underline underline-offset-2">${esc(p.name)}</a></h3><span class="shrink-0 text-xs text-muted">${t.cat}</span></div>
        <p class="mt-0.5 text-xs text-muted">oleh ${esc(t.seller)}</p>
        <p class="mt-2 font-mono text-xs text-muted">${m2} m² · ${rooms} ruangan · ${dif} diffuser</p>
        <div class="mt-auto pt-4 flex items-center gap-2">
          <span class="text-xs">${STAR} <b>${t.rate}</b> <span class="text-muted">(${t.n})</span></span>
          ${use ? `<button class="ml-auto btn-primary !h-8" data-tpl="${t.id}">Pakai</button>` : `<a class="ml-auto btn-ghost !h-8" href="template.html?id=${t.id}">Lihat &amp; beli</a>`}
        </div>
      </div>
    </article>`;
  }).join('');
}
$('#tpl-filter').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { tplCat = b.dataset.cat; tplList(); } });
$('#tpl').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) useTemplate(tplById(b.dataset.tpl)); });
tplList();

$('#theme').onclick = () => {
  const light = document.documentElement.classList.toggle('light');
  localStorage.setItem('temandor.theme', light ? 'light' : 'screen');
  list(); tplList();
};
if (location.hash === '#new') { history.replaceState(null, '', location.pathname); $('#dlg-new').showModal(); } // dari menu Proyek di editor
