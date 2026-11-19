// Temandor – beranda: daftar proyek dari browser, proyek baru, buka .json.
const go = id => { location.href = 'editor.html?id=' + id; };
const ago = t => {
  const s = (Date.now() - t) / 1000, rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
  if (s < 60) return 'baru saja';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 7) return rtf.format(-Math.round(s / 86400), 'day');
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const thumbPal = () => (document.documentElement.classList.contains('light') ? 'light' : 'screen');

if (!localStorage.getItem('temandor.seeded')) { saveProject(demoProject()); localStorage.setItem('temandor.seeded', '1'); }

function list() {
  const ps = listProjects();
  document.body.classList.toggle('is-empty', !ps.length);
  $('#count').textContent = `${ps.length} proyek · disimpan di browser ini`;
  $('#projects').innerHTML = ps.map(p => {
    const cn = connect(p), w = validate(p, cn).length, sys = ['SA', 'EA'].filter(s => p.nodes.some(n => n.sys === s && TYPES[n.type].duct));
    return `<article data-name="${esc(p.name)}" class="card relative bg-panel rounded-xl ring-1 ring-line hover:ring-ink overflow-hidden transition">
      <a href="editor.html?id=${p.id}" class="block">
        <div class="card-thumb h-40 bg-cad overflow-hidden">${docSVG(p, { pal: thumbPal(), sw: 0 }).svg.replace('<svg ', '<svg class="w-full h-full" preserveAspectRatio="xMidYMid meet" ')}</div>
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
      <div class="absolute right-2 bottom-2 flex gap-1">
        <button class="btn-ghost !h-7 !px-2 !text-xs bg-panel" data-dl="${p.id}" title="Unduh file .json">Unduh</button>
        <button class="btn-ghost !h-7 !px-2 !text-xs bg-panel !text-red-700" data-del="${p.id}" title="Hapus proyek">Hapus</button>
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
    if (confirm(`Hapus proyek "${p.name}"?\nProyek dihapus dari browser ini dan tidak bisa dikembalikan (kecuali kamu punya file .json-nya).`)) { deleteProject(p.id); list(); toast('Proyek dihapus'); }
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

// ================= Template (MOCK) =================
// ponytail: katalog statis di sini; pindah ke server saat marketplace benar-benar jalan.
function sketch({ name, rooms, fcu, path, br = [], difs = [], ea }) {
  const p = newProject({ name, unit: 'inch' }), N = p.nodes = [];
  rooms.forEach(([x, y, W, H, nm, pts]) => N.push(mk('room', { x, y, W, H, name: nm, dims: false, ...(pts ? { pts } : {}) })));
  const f = mk('fcu', { x: fcu[0], y: fcu[1], rot: fcu[2] || 0 });
  N.push(f);
  const add = (pts, spec) => pathNodes(pts, { shape: 'rect', ...spec }, 'inch').forEach(n => N.push({ ...n, id: uid() }));
  add([worldPorts(f, 'inch')[0].pos, ...path], { w: 18, h: 14, sys: 'SA' });
  br.forEach(b => add(b, { w: 10, h: 8, sys: 'SA' }));
  difs.forEach(([x, y]) => N.push(mk('diffuser', { x, y, flow: 300 })));
  if (ea) { N.push(mk('fan', { x: ea[0], y: ea[1] })); add([[ea[0] + 500, ea[1]], [ea[0] + 2500, ea[1]]], { w: 10, h: 8, sys: 'EA' }); }
  return p;
}
const TEMPLATES = [
  { id: 'kantor', cat: 'Kantor', price: 0, seller: 'Temandor', rate: 4.9, n: 312, make: demoProject },
  { id: 'ruko', cat: 'Ruko', price: 49000, seller: 'Mandor Agus · Bekasi', rate: 4.8, n: 87, make: () => sketch({
    name: 'Ruko 1 lantai – toko', rooms: [[0, 0, 5000, 14000, 'Toko']], fcu: [1300, 1100], path: [[2500, 1100], [2500, 12500]],
    br: [[[2729, 4000], [3300, 4000]], [[2729, 8000], [3300, 8000]], [[2729, 11500], [3300, 11500]]], difs: [[3300, 4000], [3300, 8000], [3300, 11500]] }) },
  { id: 'rumah', cat: 'Rumah', price: 39000, seller: 'CV Sejuk Abadi', rate: 4.7, n: 54, make: () => sketch({
    name: 'Rumah tipe 45', rooms: [[0, 0, 4000, 3500, 'R. Tamu'], [4000, 0, 3000, 3500, 'Kamar 1'], [4000, 3500, 3000, 3000, 'Kamar 2'], [0, 3500, 4000, 3000, 'Dapur']],
    fcu: [1300, 900], path: [[3500, 900], [3500, 5000], [5000, 5000]], br: [[[3729, 2000], [5000, 2000]]], difs: [[5000, 2000], [5000, 5000]] }) },
  { id: 'resto', cat: 'Resto', price: 79000, seller: 'Mandor Rizal · Bandung', rate: 4.9, n: 41, make: () => sketch({
    name: 'Restoran + dapur', rooms: [[0, 0, 12000, 10000, 'Restoran', [[0, 0], [12000, 0], [12000, 6000], [7000, 6000], [7000, 10000], [0, 10000]]]],
    fcu: [1500, 1200], path: [[9500, 1200], [9500, 4500]], br: [[[4000, 1429], [4000, 4000]], [[7000, 1429], [7000, 4000]]],
    difs: [[4000, 4000], [7000, 4000], [9500, 4500]], ea: [2000, 8000] }) },
  { id: 'klinik', cat: 'Kantor', price: 59000, seller: 'PT Udara Bersih', rate: 4.6, n: 23, make: () => sketch({
    name: 'Klinik pratama', rooms: [[0, 0, 4000, 4000, 'Praktik 1'], [4000, 0, 4000, 4000, 'Praktik 2'], [8000, 0, 4000, 4000, 'Farmasi'], [0, 4000, 12000, 3500, 'Ruang tunggu']],
    fcu: [1500, 5200], path: [[10500, 5200]], br: [[[2000, 4971], [2000, 2500]], [[6000, 4971], [6000, 2500]], [[10000, 4971], [10000, 2500]]],
    difs: [[2000, 2500], [6000, 2500], [10000, 2500]] }) },
  { id: 'gudang', cat: 'Gudang', price: 99000, seller: 'Mandor Dedi · Surabaya', rate: 4.8, n: 16, make: () => sketch({
    name: 'Workshop ventilasi', rooms: [[0, 0, 18000, 10000, 'Workshop']], fcu: [2000, 2000], path: [[16000, 2000], [16000, 8000]],
    br: [[[6000, 2229], [6000, 5000]], [[11000, 2229], [11000, 5000]]], difs: [[6000, 5000], [11000, 5000], [16000, 8000]], ea: [2000, 8500] }) },
];
const rp = v => (v ? 'Rp ' + v.toLocaleString('id-ID') : 'Gratis');
let tplCat = 'Semua';
function tplList() {
  const cats = ['Semua', ...new Set(TEMPLATES.map(t => t.cat)), 'Gratis'];
  $('#tpl-filter').innerHTML = cats.map(c => `<button class="chip" data-cat="${c}" aria-pressed="${c === tplCat}">${c}</button>`).join('');
  $('#tpl').innerHTML = TEMPLATES.filter(t => tplCat === 'Semua' || t.cat === tplCat || (tplCat === 'Gratis' && !t.price)).map(t => {
    const p = t.make(), rooms = p.nodes.filter(n => n.type === 'room');
    const m2 = Math.round(rooms.reduce((a, n) => a + Math.abs(polyArea(roomPts(n))), 0) / 1e6), nd = p.nodes.filter(n => n.type === 'diffuser').length;
    return `<article class="card relative bg-panel rounded-xl ring-1 ring-line hover:ring-ink overflow-hidden transition flex flex-col">
      <div class="card-thumb relative h-40 bg-cad overflow-hidden">${docSVG(p, { pal: thumbPal(), sw: 0 }).svg.replace('<svg ', '<svg class="w-full h-full" preserveAspectRatio="xMidYMid meet" ')}
        <span class="absolute left-2 top-2 text-xs font-semibold rounded px-1.5 py-0.5 ${t.price ? 'bg-ink text-white' : 'bg-green-600 text-white'}">${rp(t.price)}</span></div>
      <div class="p-4 flex-1 flex flex-col">
        <div class="flex items-start gap-2"><h3 class="font-semibold leading-snug mr-auto">${esc(p.name)}</h3><span class="shrink-0 text-xs text-muted">${t.cat}</span></div>
        <p class="mt-0.5 text-xs text-muted">oleh ${esc(t.seller)}</p>
        <p class="mt-2 font-mono text-xs text-muted">${m2} m² · ${rooms.length} ruangan · ${nd} diffuser</p>
        <div class="mt-auto pt-4 flex items-center gap-2">
          <span class="text-xs"><span class="text-hazard">★</span> <b>${t.rate}</b> <span class="text-muted">(${t.n})</span></span>
          <button class="ml-auto ${t.price ? 'btn-ghost' : 'btn-primary'} !h-8" data-tpl="${t.id}">${t.price ? 'Beli' : 'Pakai gratis'}</button>
        </div>
      </div>
    </article>`;
  }).join('');
}
$('#tpl-filter').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { tplCat = b.dataset.cat; tplList(); } });
$('#tpl').addEventListener('click', e => {
  const b = e.target.closest('[data-tpl]');
  if (!b) return;
  const t = TEMPLATES.find(x => x.id === b.dataset.tpl);
  if (t.price) return toast(`Mock: pembayaran belum aktif. "${b.closest('article').querySelector('h3').textContent}" – ${rp(t.price)}`);
  const p = t.make(); saveProject(p); go(p.id);
});
$('#sell').onclick = () => toast('Mock: pendaftaran penjual template belum dibuka.');
tplList();

$('#theme').onclick = () => {
  const light = document.documentElement.classList.toggle('light');
  localStorage.setItem('temandor.theme', light ? 'light' : 'screen');
  list(); tplList();
};
