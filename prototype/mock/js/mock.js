// Temandor mock P0 – interaksi UI saja. Tidak ada logika gambar / model data.
// Dimuat di <head> tepat setelah Tailwind CDN supaya config ini terbaca.
if (window.tailwind) tailwind.config = {
  theme: { extend: {
    fontFamily: { sans: ['Barlow', 'sans-serif'], cond: ['"Barlow Condensed"', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] },
    colors: { paper: '#f3f2ee', panel: '#fbfaf7', ink: '#17191c', line: '#dfdcd4', muted: '#6d6b66', hazard: '#f2c200', cad: '#14171b' },
  } },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

document.addEventListener('DOMContentLoaded', () => {
  $$('[data-open]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.open).showModal()));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('[data-toast]').forEach(b => b.addEventListener('click', () => toast(b.dataset.toast)));
  if ($('#projects')) home();
  if ($('#cad')) editor();
});

// ---------------- Beranda ----------------
function home() {
  const demo = $('#demo-empty');
  const apply = () => document.body.classList.toggle('is-empty', demo.checked);
  demo.checked = new URLSearchParams(location.search).has('kosong');
  demo.onchange = apply;
  apply();

  $('#search').oninput = e => {
    const q = e.target.value.toLowerCase();
    $$('#projects [data-name]').forEach(c => { c.style.display = c.dataset.name.toLowerCase().includes(q) ? '' : 'none'; });
  };
  $('#open-file').onchange = () => toast('Mock: buka file .json belum aktif (P1)');

  // Pratinjau ruangan di dialog Proyek Baru
  const f = $('#form-new'), room = $('#prev-room');
  const update = () => {
    const p = +f.p.value || 1, l = +f.l.value || 1, k = Math.min(170 / p, 96 / l);
    Object.entries({ width: p * k, height: l * k, x: (220 - p * k) / 2, y: (124 - l * k) / 2 }).forEach(([a, v]) => room.setAttribute(a, v));
    $('#prev-dim').textContent = `${p} × ${l} m`;
    $('#unit-eg').textContent = f.satuan.value === 'mm' ? '600x500' : '24"x20"';
  };
  f.addEventListener('input', update);
  update();
}

// ---------------- Editor ----------------
function editor() {
  const body = document.body, svg = $('#cad');
  const FULL = [-220, -120, 1760, 1080];
  let vb = [...FULL], tool = 'select', drag = null, moved = false;

  const setVB = v => {
    vb = v;
    svg.setAttribute('viewBox', v.join(' '));
    $('#zoom').textContent = Math.round(FULL[2] / v[2] * 100) + '%';
  };
  const toWorld = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const select = on => body.classList.toggle('has-selection', on);

  // State demo (README 6.2)
  const setState = s => {
    body.classList.toggle('is-empty', s === 'kosong');
    body.classList.toggle('show-warn', s === 'warning');
    select(s === 'terpilih' || s === 'zoom');
    setVB(s === 'zoom' ? [940, 60, 420, 300] : FULL);
    $$('.demo-bar [data-state]').forEach(b => b.setAttribute('aria-pressed', b.dataset.state === s));
  };
  $$('[data-state]').forEach(b => b.addEventListener('click', () => setState(b.dataset.state)));

  // Data dari dialog Proyek Baru (beranda)
  const q = new URLSearchParams(location.search);
  if (q.get('nama')) $('#proj-name').value = q.get('nama');
  if (q.get('satuan')) $$('.unit').forEach(el => { el.textContent = q.get('satuan'); });
  if (q.get('skala')) $$('.scale').forEach(el => { el.textContent = q.get('skala'); });
  if (q.get('p')) $('#room-size').textContent = `${q.get('p')} × ${q.get('l')} m`;
  setState(q.get('state') || (q.has('baru') ? 'kosong' : 'normal')); // ?state=warning dst. untuk link demo

  // Tools
  const setTool = t => {
    tool = t;
    svg.dataset.tool = t;
    $$('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
    $('#tool-name').textContent = $(`[data-tool="${t}"]`).title.split(' (')[0];
  };
  $$('[data-tool]').forEach(b => b.addEventListener('click', () => {
    setTool(b.dataset.tool);
    if (!['select', 'pan'].includes(b.dataset.tool)) toast(`Mock: tool ${b.title.split(' (')[0]} baru aktif di P1`);
  }));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey) {
      if ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) { e.preventDefault(); toast('Mock: undo/redo aktif di P1'); }
      return;
    }
    if (e.key === 'Escape') { select(false); setTool('select'); return; }
    const b = $(`[data-key="${e.key.toLowerCase()}"]`);
    if (b) setTool(b.dataset.tool);
  });

  // Zoom (scroll), pan (tool Pan / tombol tengah), crosshair + koordinat
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = toWorld(e), k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setVB([p.x - (p.x - vb[0]) * k, p.y - (p.y - vb[1]) * k, vb[2] * k, vb[3] * k]);
  }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    moved = false;
    if (tool === 'pan' || e.button === 1) { e.preventDefault(); drag = { x: e.clientX, y: e.clientY, vb: [...vb] }; svg.setPointerCapture(e.pointerId); }
  });
  svg.addEventListener('pointermove', e => {
    const p = toWorld(e), s = 1 / svg.getScreenCTM().a;
    // ponytail: denah dimulai di (0,0) atas-kiri, tinggi 900 unit; Y dibalik supaya mirip AutoCAD (Y ke atas)
    $('#coord').textContent = `X ${Math.round(p.x * 10)}  Y ${Math.round((900 - p.y) * 10)}`;
    $('#xh-h').setAttribute('y1', p.y); $('#xh-h').setAttribute('y2', p.y);
    $('#xh-v').setAttribute('x1', p.x); $('#xh-v').setAttribute('x2', p.x);
    Object.entries({ x: p.x - 5 * s, y: p.y - 5 * s, width: 10 * s, height: 10 * s }).forEach(([a, v]) => $('#xh-box').setAttribute(a, v));
    if (drag) {
      moved = true;
      setVB([drag.vb[0] - (e.clientX - drag.x) * s, drag.vb[1] - (e.clientY - drag.y) * s, vb[2], vb[3]]);
    }
  });
  svg.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointerenter', () => { $('#xhair').style.display = ''; });
  svg.addEventListener('pointerleave', () => { $('#xhair').style.display = 'none'; });
  svg.addEventListener('click', e => { if (!moved && tool === 'select') select(!!e.target.closest('#E1')); });
  $('#zoom-fit').onclick = () => setVB(FULL);

  // Layer on/off
  $$('[data-layer]').forEach(c => c.addEventListener('change', () => { $('#layer-' + c.dataset.layer).style.display = c.checked ? '' : 'none'; }));

  // Warning: buka/tutup panel, lompat ke lokasi
  $('#warn-btn').onclick = () => body.classList.toggle('show-warn');
  $('#warn-close').onclick = () => body.classList.remove('show-warn');
  $$('[data-vb]').forEach(b => b.addEventListener('click', () => { select(false); setVB(b.dataset.vb.split(' ').map(Number)); }));

  // Snap, rotasi, export, laci mobile
  $('#snap').onclick = e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', on);
    e.currentTarget.querySelector('b').textContent = on ? 'ON' : 'OFF';
  };
  $$('[data-rot]').forEach(b => b.addEventListener('click', () => { const r = $('#rot'); r.value = ((+r.value + +b.dataset.rot) % 360 + 360) % 360; }));
  $('#form-export').addEventListener('change', e => { $('#exp-file').textContent = 'kantor-lt-2.' + e.currentTarget.fmt.value; });
  $$('[data-drawer]').forEach(b => b.addEventListener('click', () => {
    const c = 'open-' + b.dataset.drawer, on = !body.classList.contains(c);
    body.classList.remove('open-lib', 'open-side');
    body.classList.toggle(c, on);
  }));
  $('#scrim').onclick = () => body.classList.remove('open-lib', 'open-side');

  // Cari di library
  $('#lib-search').oninput = e => {
    const q = e.target.value.toLowerCase();
    $$('.lib-item').forEach(i => { i.style.display = i.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    if (q) $$('.lib-group').forEach(g => { g.open = true; });
  };
}
