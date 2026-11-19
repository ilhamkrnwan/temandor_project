// Temandor – editor. Semua perubahan data lewat commit() supaya undo/redo & simpan otomatis jalan.
const svg = $('#cad'), world = $('#world'), over = $('#overlay');
let P = loadProject(new URLSearchParams(location.search).get('id'));
if (!P) { location.replace('index.html'); throw new Error('Proyek tidak ditemukan'); }

let cn, ctx, warns = [];
let sel = new Set(), tool = 'select', ghost = null, cycle = 0;
let drag = null, draw = null, cur = [0, 0], snap = null, shift = false, spaceDown = false, inside = false;
let vb = [0, 0, 10000, 6000], fitPx = 1, pxmm = 0, box0 = null, vbAnim = 0;
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
const hist = [], fut = [];
const opt = { snap: true, ortho: true, grid: true };
const spec = P.unit === 'mm' ? { w: 600, h: 500, shape: 'rect', sys: 'SA', elev: 2700 } : { w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700 };

const node = id => P.nodes.find(n => n.id === id);
const selNodes = () => [...sel].map(node).filter(Boolean);
const ppu = () => Math.min(svg.clientWidth / vb[2], svg.clientHeight / vb[3]) || 1;  // pixel per mm
const toWorld = e => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
const visible = n => P.layers[layerOf(n)].on;
const layerLocked = n => P.layers[layerOf(n)].lock;
const locked = n => layerLocked(n) || !!n.lock;  // n.lock = kunci per komponen (tetap bisa dipilih, tidak bisa digeser)
const rooms = () => P.nodes.filter(n => n.type === 'room' && visible(n));
const hostTol = () => Math.max(400, 24 / ppu());
function nextRoom() { const k = Math.max(0, ...P.nodes.map(n => +((/^Ruangan (\d+)$/.exec(n.name || '') || [])[1]) || 0)); return 'Ruangan ' + (k + 1); }
const r2 = v => Math.round(v * 100) / 100;
const LAYER_NAME = Object.fromEntries(LAYERS.map(l => [l[0], l[1]]));
const SIZE_GRIP = new Set(['w', 'w2', 's']);
// Tema kanvas: gelap (default, seperti AutoCAD) atau terang. Warna overlay ikut tema.
const THEME = {
  screen: { hl: '#facc15', cross: '#cbd5e1', halo: '#14171b', box: '#e2e8f0', warn: '#fca5a5' },
  light: { hl: '#c2410c', cross: '#334155', halo: '#ffffff', box: '#334155', warn: '#b91c1c' },
};
let pal = document.documentElement.classList.contains('light') ? 'light' : 'screen';
function setTheme(t) {
  pal = t;
  document.documentElement.classList.toggle('light', t === 'light');
  localStorage.setItem('temandor.theme', t);
  render(); projUI();
}
// Group (seperti Canva): node dengan g yang sama dipilih & dipindah bersama
const groupIds = n => (n.g ? P.nodes.filter(m => m.g === n.g).map(m => m.id) : [n.id]);
const withGroups = ids => new Set([...ids].flatMap(id => { const n = node(id); return n ? groupIds(n) : []; }));

// ================= Data, riwayat, simpan =================
let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { saveProject(P); $('#saved').textContent = 'Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
    catch { toast('Gagal menyimpan: penyimpanan browser penuh. Export .json sebagai cadangan.'); }
  }, 250);
}
function pushHist(s) { hist.push(s); if (hist.length > 200) hist.shift(); fut.length = 0; }
function commit(fn) {
  const before = JSON.stringify(P);
  fn();
  if (JSON.stringify(P) !== before) { pushHist(before); persist(); }
  refresh();
}
function swap(from, to) {
  if (!from.length) return;
  to.push(JSON.stringify(P));
  P = JSON.parse(from.pop());
  sel = new Set([...sel].filter(node));
  $('#proj-name').value = P.name;
  persist(); refresh();
}
const undo = () => swap(hist, fut), redo = () => swap(fut, hist);

function render() {
  cn = connect(P); ctx = ctxOf(P, cn); warns = validate(P, cn);
  world.innerHTML = projectSVG(P, ctx, { pal, sw: 1.4, live: true, sel });
  const empty = !P.nodes.some(n => n.type !== 'room');
  document.body.classList.toggle('is-empty', empty);
  if (!empty) localStorage.setItem('temandor.nohint', 1); // sudah pernah menggambar → petunjuk tidak muncul lagi
  overlay();
}
function refresh() { render(); propsUI(); projUI(); layersUI(); warnUI(); statusUI(); }

// ================= Tampilan (zoom/pan/grid) =================
function gridStep() { const s = ppu(); for (const g of [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) if (g * s >= 12) return g; return 20000; }
function setVB(v) {
  vb = v;
  svg.setAttribute('viewBox', v.map(f1).join(' '));
  const st = gridStep();
  $('#g1').setAttribute('width', st); $('#g1').setAttribute('height', st); $('#g1 path').setAttribute('d', `M${st} 0H0V${st}`);
  $('#g2').setAttribute('width', st * 5); $('#g2').setAttribute('height', st * 5);
  $('#g2 rect').setAttribute('width', st * 5); $('#g2 rect').setAttribute('height', st * 5); $('#g2 path').setAttribute('d', `M${st * 5} 0H0V${st * 5}`);
  pxmm = ppu(); box0 = svg.getBoundingClientRect();
  $('#zoom').textContent = Math.round(pxmm / fitPx * 100) + '%';
  $('#grid-step').textContent = `Grid ${st >= 1000 ? st / 1000 + ' m' : st + ' mm'}`;
  overlay();
}
// Zoom/geser halus ke viewBox t (ease-out). Scroll & pan tetap langsung supaya responsif.
function animVB(t, ms = 280) {
  cancelAnimationFrame(vbAnim);
  if (REDUCE.matches) return setVB(t);
  const s = [...vb], t0 = performance.now();
  const step = now => {
    const x = Math.min(1, (now - t0) / ms), k = 1 - (1 - x) ** 3;
    setVB(s.map((v, i) => v + (t[i] - v) * k));
    if (x < 1) vbAnim = requestAnimationFrame(step);
  };
  vbAnim = requestAnimationFrame(step);
}
function fit(now) {
  const b = projectBounds(P, ctx), m = Math.max(b[2] - b[0], b[3] - b[1]) * 0.08 + 500, t = [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m];
  fitPx = Math.min(svg.clientWidth / t[2], svg.clientHeight / t[3]) || 1;
  if (now === true) setVB(t); else animVB(t);
}
function zoomTo(p, w = Math.min(vb[2], 7000)) { animVB([p[0] - w / 2, p[1] - w * vb[3] / vb[2] / 2, w, w * vb[3] / vb[2]]); }
// Kanvas berubah ukuran (panel dibuka/ditutup, jendela di-resize): gambar tetap diam di layar, tidak ikut melar
new ResizeObserver(() => {
  if (!pxmm || !box0) return;
  const b = svg.getBoundingClientRect();
  if (!b.width || !b.height) return;
  const x0 = vb[0] - (box0.width / pxmm - vb[2]) / 2, y0 = vb[1] - (box0.height / pxmm - vb[3]) / 2; // tepi kiri-atas yang benar-benar terlihat
  setVB([x0 - (box0.left - b.left) / pxmm, y0 - (box0.top - b.top) / pxmm, b.width / pxmm, b.height / pxmm]);
}).observe(svg);

// ================= Snap =================
function snapAt(w, skip) {
  if (!opt.snap) return { p: w };
  const tol = (tool === 'place' ? 32 : 14) / ppu(); // saat menaruh komponen, ujung duct lebih "magnet"
  let best = null, bd = tol;
  if (draw && draw.k === 'poly' && draw.pts.length >= 3 && dist(draw.pts[0], w) < tol) return { p: draw.pts[0], kind: 'end' }; // tutup poligon
  for (const a of cn.open) if (!(skip && skip.has(a.node.id)) && visible(a.node)) { const d = dist(a.pos, w); if (d < bd) { bd = d; best = { p: a.pos, kind: 'port', port: a }; } }
  if (!best) for (const n of P.nodes) if ((n.type === 'room' || n.type === 'partition') && visible(n) && !(skip && skip.has(n.id))) {
    const R = n.type === 'room' ? roomPts(n) : [[0, 0], [n.L, 0]];
    for (const c of n.type === 'room' ? [...R, ...insetPoly(R, n.t)] : R) {
      const g = localToWorld(n, c), d = dist(g, w);
      if (d < bd) { bd = d; best = { p: g, kind: 'end' }; }
    }
  }
  if (best) return best;
  const s = gridStep();
  return { p: [Math.round(w[0] / s) * s, Math.round(w[1] / s) * s], kind: 'grid' };
}
const sp = () => (snap ? snap.p : cur);

// ================= Tool =================
const PLACE_BTN = { fitting: 'elbow', equip: 'fcu', diffuser: 'diffuser' };
function setTool(t, type) {
  tool = t; ghost = null; cycle = 0; draw = null;
  if (PLACE_BTN[t]) return setTool('place', PLACE_BTN[t]);
  if (t === 'place') {
    if (type.startsWith('room:')) { ghost = mk('room', { W: 6000, H: 5000, name: nextRoom() }); roomShape(ghost, type.slice(5)); }
    else ghost = mk(type);
    if (TYPES[ghost.type].duct) Object.assign(ghost, { w: spec.w, h: spec.h, shape: spec.shape, sys: spec.sys });
    ghost.hidden = true;
  }
  if (['duct', 'room', 'dim', 'poly', 'wall'].includes(t)) draw = { k: t, pts: [], spec: { ...spec } };
  svg.dataset.tool = t;
  const btn = t === 'place' ? (Object.keys(PLACE_BTN).find(k => PLACE_BTN[k] === type) || '') : t;
  $$('button[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === btn));
  $$('[data-place]').forEach(b => b.classList.toggle('!border-ink', t === 'place' && b.dataset.place === type));
  if (t !== 'select') sel.clear();
  if (document.body.classList.contains('open-lib')) { document.body.classList.remove('open-lib'); setPanels({}); } // HP: sheet ditutup supaya bisa langsung menggambar
  refresh(); hint();
}

function hint() {
  const d = draw, n = d && d.pts.length;
  const H = {
    place: () => TYPES[ghost.type].name,
    duct: () => (!n ? `Duct ${sizeLabel(d.spec.w, d.spec.h, d.spec.shape, P.unit)} – titik awal` : 'Titik berikut / panjang'),
    room: () => (!d.p0 ? 'Ruangan – sudut 1' : 'Sudut 2 / P x L'),
    poly: () => (!n ? 'Ruangan bebas – titik 1' : n < 3 ? 'Titik berikut / panjang' : 'Titik berikut · klik titik awal / Enter = tutup'),
    wall: () => (!n ? 'Partisi – titik awal' : 'Titik akhir / panjang · Esc selesai'),
    dim: () => ['Ukur – titik 1', 'Ukur – titik 2', 'Posisi garis'][n || 0],
    text: () => 'Teks – klik posisi, lalu ketik',
    pen: () => 'Coretan tangan – tahan & seret · Esc selesai',
  };
  $('#hint').textContent = H[tool] ? H[tool]() : '';
}

function positionGhost() {
  if (!ghost) return;
  ghost.hidden = false;
  if (HOSTED.has(ghost.type)) { // pintu/jendela: menempel ke dinding terdekat
    const h = hostAt(ghost, cur, rooms(), hostTol());
    if (h) { ghost.host = h; syncHost(ghost, node(h.id)); } else { delete ghost.host; ghost.x = sp()[0]; ghost.y = sp()[1]; }
    return;
  }
  const T = TYPES[ghost.type], near = snap && snap.kind === 'port' ? snap.port : null;
  if (near && T.ports) {
    const cands = [];
    for (const mir of T.mirror ? [false, true] : [!!ghost.mir]) for (const lp of T.ports({ ...ghost, mir }, P.unit)) {
      const n = { ...ghost, mir };
      if (!lp.any) adoptSize(n, lp.id, near, P.unit);
      attach(n, lp.id, near, P.unit);
      const b = primBounds(worldPrims(n, ctx));
      cands.push({ n, d: dist([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], cur) });
    }
    cands.sort((a, b) => a.d - b.d);
    Object.assign(ghost, cands[cycle % cands.length].n);
  } else { ghost.x = sp()[0]; ghost.y = sp()[1]; }
}
function placeGhost() {
  if (!ghost || ghost.hidden) return;
  const n = { ...structuredClone(ghost), id: uid() };
  delete n.hidden;
  if (n.type === 'room') n.name = nextRoom();
  commit(() => P.nodes.push(n));
}

// --- Gambar duct (seperti LINE di AutoCAD, elbow otomatis di tiap belokan)
function ductPoint() {
  const d = draw, last = d.pts[d.pts.length - 1], p = sp();
  if (!last || (snap && (snap.kind === 'port' || snap.kind === 'end'))) return p;
  if (d.pts.length === 1 && d.start) {  // segmen pertama keluar lurus dari port
    const u = rotP([1, 0], d.start.wdir), t = Math.max(0, (p[0] - last[0]) * u[0] + (p[1] - last[1]) * u[1]);
    return [last[0] + u[0] * t, last[1] + u[1] * t];
  }
  return orthoPt(last, p);
}
const orthoPt = (a, p) => (opt.ortho !== shift ? (Math.abs(p[0] - a[0]) >= Math.abs(p[1] - a[1]) ? [p[0], a[1]] : [a[0], p[1]]) : p);

function ductClick() {
  const d = draw;
  if (!d.pts.length) {
    d.pts.push(sp());
    const a = snap && snap.kind === 'port' ? snap.port : null;
    if (a) {
      d.start = a;
      if (a.keys && a.w != null) Object.assign(d.spec, { w: a.w, h: a.h, shape: a.shape || 'rect' });
      if (a.node.sys) d.spec.sys = a.node.sys;
    }
    return hint();
  }
  const p = ductPoint();
  if (dist(p, d.pts[d.pts.length - 1]) < 1) return;
  d.pts.push(p);
  if (snap && snap.kind === 'port' && snap.port !== d.start) finishDuct();
  hint();
}
function finishDuct() {
  const d = draw;
  if (d && d.pts.length >= 2) {
    const ns = pathNodes(d.pts, d.spec, P.unit);
    commit(() => ns.forEach(n => P.nodes.push({ ...n, id: uid() })));
  }
  draw = { k: 'duct', pts: [], spec: { ...spec } };
  hint(); overlay();
}

function roomFrom(a, b) {
  const W = Math.round(Math.abs(b[0] - a[0])), H = Math.round(Math.abs(b[1] - a[1]));
  if (W < 600 || H < 600) return null;
  return mk('room', { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), W, H, name: nextRoom() });
}
// --- Ruangan bebas (poligon): klik titik-titik, klik titik awal / Enter / klik ganda untuk menutup
function polyPt() { const d = draw, last = d.pts[d.pts.length - 1]; return last && !(snap && snap.kind === 'end') ? orthoPt(last, sp()) : sp(); }
function polyRoom(pts) { const r = mk('room', { name: nextRoom() }); setRoom(r, pts.map(p => p.map(Math.round))); return r; }
function polyClick() {
  const d = draw, p = polyPt();
  if (d.pts.length >= 3 && dist(p, d.pts[0]) < 1) return finishPoly();
  if (d.pts.length && dist(p, d.pts[d.pts.length - 1]) < 1) return;
  d.pts.push(p); hint();
}
function finishPoly() {
  const d = draw;
  if (d.pts.length >= 3) {
    const r = polyRoom(d.pts);
    if (Math.abs(polyArea(roomPts(r))) < 0.36e6) toast('Ruangan terlalu kecil'); else commit(() => P.nodes.push(r));
  }
  draw = { k: 'poly', pts: [], spec: { ...spec } }; hint(); overlay();
}
// --- Partisi: berantai seperti LINE (titik akhir jadi titik awal berikutnya)
const wallFrom = (a, b) => mk('partition', { x: a[0], y: a[1], rot: angOf(a, b), L: Math.round(dist(a, b)) });
function addWall(a, b) {
  if (dist(a, b) < 100) return;
  commit(() => P.nodes.push(wallFrom(a, b)));
  draw.pts = [b];
}
function dimFrom(p1, p2, offPt) {
  const n = mk('dim', { x: p1[0], y: p1[1], rot: angOf(p1, p2), L: dist(p1, p2) });
  n.off = offPt ? Math.round(worldToLocal(n, offPt)[1]) : -ctx.th * 2;
  return n;
}

function canvasClick(e) {
  if (tool === 'place') return placeGhost();
  if (tool === 'duct') return ductClick();
  if (tool === 'poly') return polyClick();
  if (tool === 'wall') {
    if (!draw.pts.length) { draw.pts.push(sp()); return hint(); }
    addWall(draw.pts[0], orthoPt(draw.pts[0], sp())); return hint();
  }
  if (tool === 'room') {
    if (!draw.p0) { draw.p0 = sp(); return hint(); }
    const r = roomFrom(draw.p0, sp());
    if (r) commit(() => P.nodes.push(r)); else toast('Ruangan terlalu kecil (min. 600 mm)');
    draw.p0 = null; return hint();
  }
  if (tool === 'dim') {
    const p = draw.pts.length === 1 ? orthoPt(draw.pts[0], sp()) : sp();
    if (draw.pts.length < 2) { if (!draw.pts.length || dist(p, draw.pts[0]) > 1) draw.pts.push(p); return hint(); }
    const n = dimFrom(draw.pts[0], draw.pts[1], p);
    commit(() => P.nodes.push(n));
    draw.pts = []; return hint();
  }
  if (tool === 'text') newText(sp(), e);
}
// Teks baru langsung bisa diketik di kanvas (tanpa popup)
function newText(p, e, th = 0, s = 'Teks') {
  const n = mk('text', { x: p[0], y: p[1], s, th });
  setTool('select');
  commit(() => P.nodes.push(n));
  sel = new Set([n.id]); refresh();
  setTimeout(() => inlineEdit(n, e)); // tunggu fokus bawaan klik selesai
}
function addText(m) {
  const r = svg.getBoundingClientRect(), e = { clientX: r.left + r.width / 2 - 60, clientY: r.top + r.height / 2 }, p = toWorld(e);
  newText(p, e, m === 1 ? 0 : Math.round(ctx.th * m), m >= 2 ? 'Judul' : m > 1 ? 'Subjudul' : 'Teks');
}

// Ketikan di baris perintah: panjang duct, ukuran ruangan, atau nama perintah
const COMMANDS = { L: 'duct', LINE: 'duct', DUCT: 'duct', REC: 'room', RUANG: 'room', PL: 'poly', POLY: 'poly', WALL: 'wall', PARTISI: 'wall', DIM: 'dim', UKUR: 'dim', TEXT: 'text', TEKS: 'text', SELECT: 'select', PAN: 'pan', PEN: 'pen', CORET: 'pen' };
function typed(raw) {
  const v = raw.trim();
  if (!v) { if (draw && draw.k === 'duct') finishDuct(); return; }
  const nums = v.split(/[x,*\s]+/i).map(Number);
  if (nums.every(isFinite)) {
    if (draw && draw.k === 'duct' && draw.pts.length && nums.length === 1 && nums[0] > 0) {
      const last = draw.pts[draw.pts.length - 1], tgt = ductPoint();
      const ang = dist(tgt, last) > 1 ? angOf(last, tgt) : draw.pts.length > 1 ? angOf(draw.pts[draw.pts.length - 2], last) : draw.start ? draw.start.wdir : 0;
      const u = rotP([1, 0], ang);
      draw.pts.push([last[0] + u[0] * nums[0], last[1] + u[1] * nums[0]]);
      hint(); return overlay();
    }
    if (draw && (draw.k === 'poly' || draw.k === 'wall') && draw.pts.length && nums.length === 1 && nums[0] > 0) {
      const last = draw.pts[draw.pts.length - 1], tgt = orthoPt(last, sp()), u = rotP([1, 0], dist(tgt, last) > 1 ? angOf(last, tgt) : 0);
      const p = [last[0] + u[0] * nums[0], last[1] + u[1] * nums[0]];
      if (draw.k === 'wall') addWall(last, p); else draw.pts.push(p);
      hint(); return overlay();
    }
    if (draw && draw.k === 'room' && draw.p0 && nums.length === 2) {
      let [w, h] = nums;
      if (w < 100 && h < 100) { w *= 1000; h *= 1000; }
      const a = draw.p0, b = [a[0] + (cur[0] >= a[0] ? w : -w), a[1] + (cur[1] >= a[1] ? h : -h)], r = roomFrom(a, b);
      if (r) commit(() => P.nodes.push(r));
      draw.p0 = null; return hint();
    }
    return toast('Angka dipakai saat menggambar duct, partisi, ruangan bebas (panjang) atau ruangan (P x L).');
  }
  const c = v.toUpperCase();
  if (c === 'Z' || c === 'ZOOM') return fit();
  if (c === 'ZS') return zoomSel();
  if (c === 'U' || c === 'UNDO') return undo();
  if (COMMANDS[c]) return setTool(COMMANDS[c]);
  toast(`Perintah "${v}" tidak dikenal. Coba: L (duct), REC (ruangan), PL (ruangan bebas), WALL (partisi), DIM, TEXT, Z`);
}

// ================= Edit =================
function bboxOf(ns) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const n of ns) { const q = primBounds(worldPrims(n, ctx)); b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])]; }
  return b;
}
function rotateSel(deg) {
  if (tool === 'place' && ghost) {
    if (ghost.host && ghost.type === 'door') ghost.swing = ghost.swing === 'out' ? 'in' : 'out';
    else if (snap && snap.kind === 'port') cycle++; else ghost.rot = norm((ghost.rot || 0) + deg);
    positionGhost(); return overlay();
  }
  const ns = selNodes().filter(n => !locked(n));
  if (!ns.length) return;
  if (ns.length === 1 && ns[0].host) return ns[0].type === 'door' && doAct('swing'); // menempel di dinding: R = balik arah buka
  const b = bboxOf(ns), s = gridStep(), c = [Math.round((b[0] + b[2]) / 2 / s) * s, Math.round((b[1] + b[3]) / 2 / s) * s];
  commit(() => ns.forEach(n => { const q = rotP([n.x - c[0], n.y - c[1]], deg); n.x = c[0] + q[0]; n.y = c[1] + q[1]; n.rot = norm((n.rot || 0) + deg); }));
}
function mirrorSel() {
  if (tool === 'place' && ghost) { if (ghost.host) ghost.hinge = ghost.hinge === 'r' ? 'l' : 'r'; else ghost.mir = !ghost.mir; positionGhost(); return overlay(); }
  const ns = selNodes().filter(n => !locked(n));
  if (!ns.length) return;
  if (ns.length === 1 && ns[0].host) return ns[0].type === 'door' && doAct('hinge'); // M = balik engsel
  if (ns.length === 1) return commit(() => { ns[0].mir = !ns[0].mir; }); // satu komponen: balik sisi, port 'a' tetap
  const b = bboxOf(ns), cx = (b[0] + b[2]) / 2;
  commit(() => ns.forEach(n => { n.x = 2 * cx - n.x; n.rot = norm(180 - (n.rot || 0)); n.mir = !n.mir; }));
}
function delSel() { const ids = new Set(selNodes().filter(n => !locked(n)).map(n => n.id)); if (!ids.size) return; commit(() => { P.nodes = P.nodes.filter(n => !ids.has(n.id)); }); sel.clear(); refresh(); }
let clip = null;
function copySel() { const ns = selNodes(); if (ns.length) { clip = structuredClone(ns); toast(`${ns.length} komponen disalin`); } }
function paste(at) {
  if (!clip) return;
  const b = bboxOf(clip), s = gridStep(), d = at ? [Math.round((at[0] - (b[0] + b[2]) / 2) / s) * s, Math.round((at[1] - (b[1] + b[3]) / 2) / s) * s] : [s * 5, s * 5];
  const gm = {}, im = Object.fromEntries(clip.map(n => [n.id, uid()]));
  const ns = clip.map(n => {
    const m = { ...structuredClone(n), id: im[n.id], x: n.x + d[0], y: n.y + d[1], ...(n.g ? { g: (gm[n.g] ||= uid()) } : {}) };
    if (m.host) { if (im[m.host.id]) m.host.id = im[m.host.id]; else m.host.s += m.dw + 200; } // duplikat pintu: di sebelahnya, dinding yang sama
    return m;
  });
  commit(() => P.nodes.push(...ns));
  sel = new Set(ns.map(n => n.id)); refresh();
}

function groupSel() {
  const ns = selNodes().filter(n => !locked(n));
  if (ns.length < 2) return toast('Pilih minimal 2 komponen untuk di-group');
  const g = uid();
  commit(() => ns.forEach(n => { n.g = g; }));
}
function ungroupSel() { commit(() => selNodes().forEach(n => { delete n.g; })); }
// Rata kiri/tengah/kanan/atas/tengah/bawah. Group dihitung satu kesatuan.
function alignSel(k) {
  const ns = selNodes().filter(n => !locked(n));
  if (ns.length < 2) return;
  const B = bboxOf(ns), units = new Map();
  for (const n of ns) { const key = n.g || n.id; units.set(key, [...(units.get(key) || []), n]); }
  commit(() => units.forEach(u => {
    const b = bboxOf(u);
    const dx = { l: B[0] - b[0], r: B[2] - b[2], c: (B[0] + B[2] - b[0] - b[2]) / 2 }[k] || 0;
    const dy = { t: B[1] - b[1], b: B[3] - b[3], m: (B[1] + B[3] - b[1] - b[3]) / 2 }[k] || 0;
    u.forEach(n => { n.x += dx; n.y += dy; });
  }));
}
function orderSel(front) {
  if (!sel.size) return;
  commit(() => { const a = P.nodes.filter(n => sel.has(n.id)), b = P.nodes.filter(n => !sel.has(n.id)); P.nodes = front ? [...b, ...a] : [...a, ...b]; });
}
function lockSel(on) { commit(() => selNodes().forEach(n => { if (on) n.lock = true; else delete n.lock; })); }
function zoomSel() {
  if (!sel.size) return fit();
  const b = bboxOf(selNodes()), m = Math.max(b[2] - b[0], b[3] - b[1]) * 0.25 + 400;
  zoomTo([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], Math.max(b[2] - b[0] + 2 * m, (b[3] - b[1] + 2 * m) * vb[2] / vb[3]));
}
function nudge(dx, dy) { const ns = selNodes().filter(n => !locked(n)); if (ns.length) commit(() => ns.forEach(n => { n.x += dx; n.y += dy; })); }

// ================= Pointer =================
let lastGrip = null;
svg.addEventListener('contextmenu', e => e.preventDefault());
svg.addEventListener('pointerdown', e => {
  cur = toWorld(e); shift = e.shiftKey;
  closeMenu(); $('#tip').style.display = 'none';
  if (e.button === 1 || tool === 'pan' || spaceDown) {
    e.preventDefault();
    cancelAnimationFrame(vbAnim);
    drag = { k: 'pan', x: e.clientX, y: e.clientY, vb: [...vb] };
    svg.classList.add('panning');
    return svg.setPointerCapture(e.pointerId);
  }
  if (e.button === 2) {
    if (draw && draw.k === 'duct' && draw.pts.length >= 2) finishDuct();
    else if (draw && draw.k === 'poly' && draw.pts.length >= 3) finishPoly();
    else if (draw && (draw.pts.length || draw.p0)) { draw = { k: draw.k, pts: [], spec: { ...spec } }; hint(); overlay(); }
    else if (tool !== 'select') setTool('select');
    else openMenu(e);
    return;
  }
  if (e.button !== 0) return;
  if (tool === 'pen') { drag = { k: 'pen', pts: [cur] }; return svg.setPointerCapture(e.pointerId); }
  if (tool !== 'select') { snap = snapAt(cur); if (tool === 'place') positionGhost(); return canvasClick(e); }

  const wEl = e.target.closest('[data-warn]');  // klik tanda ! → pilih komponennya, cara perbaikan tampil di panel
  if (wEl) { const w = warns[+wEl.dataset.warn]; sel = new Set([w.id]); if (!panels.side) setPanels({ side: true }); return refresh(); }
  const gEl = e.target.closest('[data-grip]');
  if (gEl) {
    const gn = node([...sel][0]), g = gEl.dataset.grip, now = Date.now(), T = TYPES[gn.type];
    if (T.gripDbl && lastGrip && lastGrip.g === g && now - lastGrip.t < 350) { lastGrip = null; return commit(() => T.gripDbl(gn, g)); }
    lastGrip = { g, t: now };
    drag = { k: 'grip', id: gn.id, g, pre: JSON.stringify(P), base: structuredClone(gn) };
    return svg.setPointerCapture(e.pointerId);
  }
  const hitEl = e.target.closest('#world [data-id]'), n = hitEl && node(hitEl.dataset.id);
  if (n && layerLocked(n)) toast(`Layer ${LAYER_NAME[layerOf(n)]} terkunci. Buka kuncinya di panel Layer.`);
  if (n && !layerLocked(n)) {
    if (e.shiftKey) { const ids = groupIds(n), on = sel.has(n.id); ids.forEach(id => (on ? sel.delete(id) : sel.add(id))); return refresh(); }
    if (!sel.has(n.id)) { sel = new Set(groupIds(n)); refresh(); }
    if (n.lock) return; // terkunci: bisa dipilih, tidak ikut tergeser
    const moving = new Set(sel);
    drag = {
      k: 'move', start: cur, pre: JSON.stringify(P), moved: false, moving,
      orig: selNodes().filter(m => !locked(m)).map(m => [m, m.x, m.y, HOSTED.has(m.type) ? localToWorld(m, [m.dw / 2, m.t / 2]) : null]),
      open: cn.all.filter(a => !moving.has(a.node.id) && (!cn.link.has(a) || moving.has(cn.link.get(a).node.id))),
    };
  } else drag = { k: 'box', start: cur, shift: e.shiftKey };
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener('pointermove', e => {
  cur = toWorld(e); shift = e.shiftKey; inside = true;
  tipAt(e);
  $('#coord').textContent = `X ${Math.round(cur[0])}  Y ${Math.round(-cur[1])}`;
  if (!drag) {
    snap = tool === 'select' || tool === 'pan' || tool === 'pen' ? null : snapAt(cur);
    if (tool === 'place') positionGhost();
    return overlay();
  }
  if (drag.k === 'pan') {
    const k = 1 / ppu();
    return setVB([drag.vb[0] - (e.clientX - drag.x) * k, drag.vb[1] - (e.clientY - drag.y) * k, vb[2], vb[3]]);
  }
  if (drag.k === 'pen') { if (dist(drag.pts[drag.pts.length - 1], cur) * ppu() >= 3) drag.pts.push(cur); return overlay(); }
  if (drag.k === 'move') {
    if (!drag.moved && dist(cur, drag.start) * ppu() < 4) return;
    drag.moved = true;
    let dx = cur[0] - drag.start[0], dy = cur[1] - drag.start[1];
    if (opt.snap) { const s = gridStep(); dx = Math.round(dx / s) * s; dy = Math.round(dy / s) * s; }
    drag.orig.forEach(([m, x, y]) => { m.x = x + dx; m.y = y + dy; });
    if (opt.snap) {  // tempel ke ujung terbuka terdekat
      const tol = 14 / ppu();
      let best = null, bd = tol;
      for (const [m] of drag.orig) for (const a of worldPorts(m, P.unit)) for (const b of drag.open) {
        if (Math.abs(norm(a.wdir - b.wdir + 180)) > 1) continue;
        const d = dist(a.pos, b.pos);
        if (d < bd) { bd = d; best = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]]; }
      }
      if (best) drag.orig.forEach(([m]) => { m.x += best[0]; m.y += best[1]; });
    }
    // pintu/jendela: geser sepanjang dinding, pindah dinding, atau lepas kalau dibawa jauh
    for (const [m, , , c0] of drag.orig) if (c0 && !(m.host && drag.moving.has(m.host.id))) {
      const h = hostAt(m, [c0[0] + cur[0] - drag.start[0], c0[1] + cur[1] - drag.start[1]], rooms().filter(r => !drag.moving.has(r.id)), hostTol());
      if (h) m.host = h; else delete m.host;
    }
    return render();
  }
  if (drag.k === 'grip') {
    const n = node(drag.id), free = SIZE_GRIP.has(drag.g); // grip ukuran: tanpa snap grid, dibulatkan sendiri
    snap = free ? null : snapAt(cur, new Set([n.id]));
    const p = free ? cur : snap.p;
    TYPES[n.type].grip(n, drag.g, worldToLocal(n, p), p, P.unit, drag.base);
    drag.moved = true;
    return render();
  }
  overlay(); // kotak seleksi
});

svg.addEventListener('pointerup', () => {
  const d = drag;
  drag = null;
  svg.classList.remove('panning');
  if (!d) return;
  if (d.k === 'pen') {
    const [x, y] = d.pts[0];
    if (d.pts.length > 1) commit(() => P.nodes.push(mk('sketch', { x: Math.round(x), y: Math.round(y), pts: d.pts.map(p => [Math.round(p[0] - x), Math.round(p[1] - y)]) })));
    return overlay();
  }
  if ((d.k === 'move' || d.k === 'grip') && d.moved) {
    if (JSON.stringify(P) !== d.pre) { pushHist(d.pre); persist(); }
    return refresh();
  }
  if (d.k === 'box') {
    const px = dist(cur, d.start) * ppu();
    if (px < 4) { if (!d.shift) { sel.clear(); refresh(); } return; }
    const r = [Math.min(d.start[0], cur[0]), Math.min(d.start[1], cur[1]), Math.max(d.start[0], cur[0]), Math.max(d.start[1], cur[1])];
    const win = cur[0] > d.start[0];  // kiri→kanan = window (harus masuk penuh), kanan→kiri = crossing (kena sedikit)
    if (!d.shift) sel.clear();
    for (const n of P.nodes) {
      if (!visible(n) || locked(n)) continue;
      const q = primBounds(worldPrims(n, ctx));
      const ok = win ? q[0] >= r[0] && q[1] >= r[1] && q[2] <= r[2] && q[3] <= r[3] : q[0] <= r[2] && q[2] >= r[0] && q[1] <= r[3] && q[3] >= r[1];
      if (ok) sel.add(n.id);
    }
    sel = withGroups(sel);
    refresh();
  }
});
svg.addEventListener('pointerleave', () => { inside = false; $('#tip').style.display = 'none'; overlay(); });
svg.addEventListener('dblclick', e => {
  if (draw && draw.k === 'duct') return finishDuct();
  if (draw && draw.k === 'poly') return finishPoly();
  const el = tool === 'select' && e.target.closest('#world [data-id]'), n = el && node(el.dataset.id);
  if (!n || locked(n)) return;
  if (n.g && sel.size > 1) { sel = new Set([n.id]); return refresh(); } // masuk ke dalam group
  if (n.type === 'room' || n.type === 'text') inlineEdit(n, e);
});
// Ganti nama ruangan / isi teks langsung di kanvas
function inlineEdit(n, e) {
  const box = $('#canvas').getBoundingClientRect(), inp = $('#inline'), k = n.type === 'room' ? 'name' : 's';
  inp.value = n[k];
  Object.assign(inp.style, { display: 'block', left: Math.min(e.clientX - box.left, box.width - 230) + 'px', top: e.clientY - box.top - 18 + 'px' });
  inp.focus(); inp.select();
  inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = n[k]; inp.blur(); } };
  inp.onblur = () => { inp.style.display = 'none'; const v = inp.value.trim(); if (v && v !== n[k]) commit(() => { n[k] = v; }); };
}
// Tooltip tanda warning (langsung muncul saat kursor di atas !)
function tipAt(e) {
  const el = !drag && e.target.closest && e.target.closest('[data-warn]'), tip = $('#tip');
  if (!el) { tip.style.display = 'none'; return; }
  const w = warns[+el.dataset.warn], cb = $('#canvas').getBoundingClientRect();
  if (!w) return;
  tip.innerHTML = `<b>${esc(w.msg)}</b><span>${esc(w.detail)}</span><i>Klik untuk pilih komponennya</i>`;
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX - cb.left + 16, cb.width - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.min(e.clientY - cb.top + 16, cb.height - tip.offsetHeight - 8) + 'px';
}
svg.addEventListener('wheel', e => {
  e.preventDefault(); cancelAnimationFrame(vbAnim);
  const p = toWorld(e), k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
  setVB([p[0] - (p[0] - vb[0]) * k, p[1] - (p[1] - vb[1]) * k, vb[2] * k, vb[3] * k]);
}, { passive: false });

// Seret dari library ke kanvas
let dropped = false;
svg.addEventListener('dragover', e => { e.preventDefault(); cur = toWorld(e); snap = snapAt(cur); inside = true; positionGhost(); overlay(); });
svg.addEventListener('drop', e => { e.preventDefault(); dropped = true; placeGhost(); setTool('select'); });

// ================= Overlay (ghost, grip, snap, kotak seleksi, crosshair) =================
function overlay() {
  if (!cn) return;
  const k = 1 / ppu(), o = [], C = THEME[pal];
  const sw = `stroke-width="1"`;
  let gs = [];
  if (tool === 'place' && ghost && !ghost.hidden && inside) gs = [ghost];
  if (draw && inside) {
    if (draw.k === 'duct' && draw.pts.length) gs = pathNodes([...draw.pts, ductPoint()], draw.spec, P.unit);
    if (draw.k === 'room' && draw.p0) { const r = roomFrom(draw.p0, sp()); if (r) gs = [r]; }
    if (draw.k === 'dim' && draw.pts.length === 1) gs = [dimFrom(draw.pts[0], orthoPt(draw.pts[0], sp()))];
    if (draw.k === 'dim' && draw.pts.length === 2) gs = [dimFrom(draw.pts[0], draw.pts[1], sp())];
    if (draw.k === 'poly' && draw.pts.length) {
      const q = [...draw.pts, polyPt()];
      if (q.length >= 3) gs = [polyRoom(q)]; else o.push(`<path d="${ptsD(q)}" stroke="${C.hl}" fill="none" ${sw}/>`);
    }
    if (draw.k === 'wall' && draw.pts.length) { const b = orthoPt(draw.pts[0], sp()); if (dist(b, draw.pts[0]) > 1) gs = [wallFrom(draw.pts[0], b)]; }
  }
  if (drag && drag.k === 'pen') o.push(`<path d="${ptsD(drag.pts)}" stroke="${PAL[pal].col.coret}" stroke-width="1.4" fill="none" stroke-linejoin="round"/>`);
  if (gs.length) o.push(`<g class="ghost">${gs.map(n => Object.values(nodeSVG(n, ctx, { pal, sw: 1.4, live: false })).join('')).join('')}</g>`);
  if (draw && (draw.k === 'duct' || draw.k === 'poly' || draw.k === 'wall')) for (const p of draw.pts) o.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${3 * k}" fill="${C.hl}"/>`);

  // titik sambung komponen terpilih: hijau = nyambung, merah = terbuka
  for (const a of cn.all) if (sel.has(a.node.id)) o.push(`<circle cx="${f1(a.pos[0])}" cy="${f1(a.pos[1])}" r="${f1(4.5 * k)}" fill="${cn.link.has(a) ? '#4ade80' : '#ef4444'}" stroke="#14171b" ${sw}/>`);
  // grip
  if (sel.size === 1 && tool === 'select') {
    const n = node([...sel][0]), T = n && TYPES[n.type];
    if (T && T.grips && !locked(n)) for (const [g, x, y] of T.grips(n, P.unit)) {
      const q = localToWorld(n, [x, y]), sz = SIZE_GRIP.has(g);  // putih = ubah ukuran, biru = ubah posisi/panjang
      if (/^e\d/.test(g)) { o.push(`<circle data-grip="${g}" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(4.5 * k)}" fill="#fff" stroke="#3b82f6" ${sw} style="cursor:move"><title>Seret: tarik sisi · klik ganda: tambah titik</title></circle>`); continue; }
      o.push(`<rect data-grip="${g}" x="${f1(q[0] - 5 * k)}" y="${f1(q[1] - 5 * k)}" width="${f1(10 * k)}" height="${f1(10 * k)}" fill="${sz ? '#fff' : '#3b82f6'}" stroke="${sz ? '#3b82f6' : '#dbeafe'}" ${sw} style="cursor:${sz ? 'nwse-resize' : 'move'}"><title>${sz ? 'Seret untuk ubah ukuran' : n.type === 'room' ? 'Seret: geser sudut · klik ganda: hapus titik' : 'Seret untuk ubah panjang/posisi'}</title></rect>`);
    }
  }
  // kotak seleksi banyak / group (garis putus seperti Canva)
  if (sel.size > 1 && tool === 'select') {
    const b = bboxOf(selNodes()), m = 6 * k;
    o.push(`<rect x="${f1(b[0] - m)}" y="${f1(b[1] - m)}" width="${f1(b[2] - b[0] + 2 * m)}" height="${f1(b[3] - b[1] + 2 * m)}" fill="none" stroke="${C.hl}" stroke-dasharray="5 4" ${sw}/>`);
  }
  // komponen terkunci
  for (const n of selNodes()) if (n.lock) { const b = bboxOf([n]); o.push(`<text x="${f1(b[0])}" y="${f1(b[1] - 6 * k)}" font-size="${f1(13 * k)}" style="stroke:none">🔒</text>`); }
  // penanda warning: hover = tooltip, klik = pilih. Saat daftar warning terbuka, judulnya tampil langsung.
  const showW = document.body.classList.contains('show-warn'), pulse = showW ? ' class="pulse"' : '';
  warns.forEach((w, i) => o.push(`<g data-warn="${i}" transform="translate(${f1(w.pos[0])} ${f1(w.pos[1])})" style="cursor:pointer"><circle r="${f1(10 * k)}" fill="#ef444433" stroke="#ef4444" stroke-width="1.5"${pulse}/><text y="${f1(4 * k)}" font-size="${f1(12 * k)}" text-anchor="middle" fill="#fecaca" stroke="none" font-weight="700">!</text>${showW ? `<text x="${f1(14 * k)}" y="${f1(4 * k)}" font-size="${f1(11 * k)}" fill="${C.warn}" stroke-width="${f1(3 * k)}" font-weight="600">${esc(w.msg)}</text>` : ''}</g>`));
  // kotak seleksi
  if (drag && drag.k === 'box') {
    const a = drag.start, win = cur[0] > a[0];
    o.push(`<rect x="${Math.min(a[0], cur[0])}" y="${Math.min(a[1], cur[1])}" width="${Math.abs(cur[0] - a[0])}" height="${Math.abs(cur[1] - a[1])}" fill="${win ? '#3b82f622' : '#22c55e22'}" stroke="${win ? '#60a5fa' : '#4ade80'}" ${sw}${win ? '' : ' stroke-dasharray="6 4"'}/>`);
  }
  // penanda snap
  if (snap && (snap.kind === 'port' || snap.kind === 'end') && tool !== 'select') o.push(`<rect x="${f1(snap.p[0] - 7 * k)}" y="${f1(snap.p[1] - 7 * k)}" width="${f1(14 * k)}" height="${f1(14 * k)}" fill="none" stroke="${C.hl}" stroke-width="2"/>`);
  // info panjang/ukuran di samping kursor (seperti dynamic input AutoCAD)
  let info = '';
  if (draw && draw.k === 'duct' && draw.pts.length) { const a = draw.pts[draw.pts.length - 1], b = ductPoint(); info = `${Math.round(dist(a, b))} mm  ${Math.round(((-angOf(a, b)) % 360 + 360) % 360)}°`; }
  if (draw && draw.k === 'room' && draw.p0) info = `${Math.round(Math.abs(sp()[0] - draw.p0[0]))} × ${Math.round(Math.abs(sp()[1] - draw.p0[1]))} mm`;
  if (draw && draw.k === 'dim' && draw.pts.length === 1) info = `${Math.round(dist(draw.pts[0], orthoPt(draw.pts[0], sp())))} mm`;
  if (draw && draw.k === 'wall' && draw.pts.length) info = `${Math.round(dist(draw.pts[0], orthoPt(draw.pts[0], sp())))} mm`;
  if (draw && draw.k === 'poly' && draw.pts.length) info = `${Math.round(dist(draw.pts[draw.pts.length - 1], polyPt()))} mm`;
  if (info && inside) o.push(`<text x="${f1(cur[0] + 16 * k)}" y="${f1(cur[1] - 14 * k)}" font-size="${f1(12 * k)}" fill="${C.hl}" stroke="${C.halo}" stroke-width="${f1(3 * k)}">${info}</text>`);
  // crosshair
  if (inside && tool !== 'pan') {
    const c = snap && tool !== 'select' ? snap.p : cur;
    o.push(`<path d="M${f1(vb[0])} ${f1(c[1])}H${f1(vb[0] + vb[2])}M${f1(c[0])} ${f1(vb[1])}V${f1(vb[1] + vb[3])}" stroke="${C.cross}" stroke-opacity=".35" ${sw}/>`);
    if (tool === 'select') o.push(`<rect x="${f1(c[0] - 5 * k)}" y="${f1(c[1] - 5 * k)}" width="${f1(10 * k)}" height="${f1(10 * k)}" fill="none" stroke="${C.box}" ${sw}/>`);
  }
  over.innerHTML = o.join('');
  $('#grid').style.display = opt.grid ? '' : 'none';
  placeBar();
}

// ================= Toolbar melayang (seperti Canva) & menu klik kanan =================
const IC = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"/>', unlock: '<path d="M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z"/>',
  dup: '<path d="M8 8h12v12H8zM4 16V4h12"/>', del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  rot: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', mir: '<path d="M12 3v18M8 7 3 12l5 5M16 7l5 5-5 5"/>',
  hinge: '<path d="M4 20V4M4 4a16 16 0 0 1 16 16M4 20h16"/>', swing: '<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>', detach: '<path d="M3 12h7M14 12h7M10 8v8M14 8v8"/>',
};
const ic = k => `<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">${IC[k]}</svg>`;
const cbtn = (act, inner, title, cls = '') => `<button class="cb${cls}" data-act="${act}" title="${title}" aria-label="${title}">${inner}</button>`;
const SEP = '<span class="cb-sep"></span>';
function barUI(ns) {
  if (!ns.length) return '';
  if (ns.every(n => n.lock)) return cbtn('unlock', ic('unlock') + 'Buka kunci', 'Buka kunci');
  const tail = cbtn('lock', ic('lock'), 'Kunci (tidak ikut tergeser)') + cbtn('dup', ic('dup'), 'Duplikat (Ctrl+D)') + cbtn('del', ic('del'), 'Hapus (Del)', ' danger');
  if (ns.length > 1) {
    const grouped = ns[0].g && ns.every(n => n.g === ns[0].g);
    return (grouped ? cbtn('ungroup', 'Ungroup', 'Ctrl+Shift+G') : cbtn('group', 'Group', 'Ctrl+G')) + SEP + cbtn('rotr', ic('rot'), 'Putar 90° (R)') + cbtn('mirror', ic('mir'), 'Cermin (M)') + SEP + tail;
  }
  const n = ns[0];
  let h = '';
  if (n.type === 'room') {
    h = Object.keys(ROOM_SHAPES).map(k => cbtn('shape-' + k, `<img src="assets/svg/ruang-${k.toLowerCase()}.svg" alt="">`, ROOM_SHAPES[k][0])).join('') + SEP +
      ['door', 'win', 'column', 'partition'].map(t => cbtn('add-' + t, `<img src="assets/svg/${TYPES[t].icon}.svg" alt="">${TYPES[t].name}`, 'Tambah ' + TYPES[t].name.toLowerCase())).join('') + SEP;
  } else if (n.host) {
    h = (n.type === 'door' ? cbtn('hinge', ic('hinge') + 'Engsel', 'Balik engsel kiri/kanan (M)') + cbtn('swing', ic('swing') + 'Arah buka', 'Buka ke dalam/luar (R)') : '') + cbtn('detach', ic('detach') + 'Lepas', 'Lepas dari dinding') + SEP;
  } else h = cbtn('rotr', ic('rot'), 'Putar 90° (R)') + cbtn('mirror', ic('mir'), 'Cermin (M)') + SEP;
  return h + tail;
}
function placeBar() {
  const bar = $('#ctxbar'), ns = selNodes();
  const show = ns.length && tool === 'select' && !drag && bar.innerHTML && $('#inline').style.display !== 'block';
  bar.style.display = show ? 'flex' : 'none';
  if (!show) return;
  const b = bboxOf(ns), M = svg.getScreenCTM(), cb = $('#canvas').getBoundingClientRect();
  const X = x => M.a * x + M.e - cb.left, Y = y => M.d * y + M.f - cb.top, w = bar.offsetWidth, h = bar.offsetHeight;
  let top = Y(b[1]) - h - 16;
  if (top < 8) top = Math.min(Y(b[3]) + 16, cb.height - h - 8);
  bar.style.left = Math.max(8, Math.min((X(b[0]) + X(b[2])) / 2 - w / 2, cb.width - w - 8)) + 'px';
  bar.style.top = Math.max(8, top) + 'px';
}
let menuAt = null;
function openMenu(e) {
  const el = e.target.closest('#world [data-id]'), n = el && node(el.dataset.id);
  if (n && !layerLocked(n) && !sel.has(n.id)) sel = new Set(groupIds(n));
  if (!n) sel.clear();
  refresh();
  menuAt = cur;
  const ns = selNodes(), it = (act, label, key = '', cls = '') => `<button class="cm-item${cls}" data-act="${act}"><span>${label}</span><kbd>${key}</kbd></button>`;
  const lk = ns.length && ns.every(m => m.lock), grouped = ns.length > 1 && ns[0].g && ns.every(m => m.g === ns[0].g), pst = clip ? '' : ' opacity-40';
  const m = $('#ctxmenu');
  m.innerHTML = ns.length
    ? it('copy', 'Salin', 'Ctrl+C') + it('paste', 'Tempel', 'Ctrl+V', pst) + it('dup', 'Duplikat', 'Ctrl+D') + '<hr>' +
      (ns.length > 1 ? (grouped ? it('ungroup', 'Ungroup', 'Ctrl+Shift+G') : it('group', 'Group', 'Ctrl+G')) : '') +
      it('rotr', 'Putar 90°', 'R') + it('mirror', 'Cermin', 'M') + it('front', 'Ke depan', ']') + it('back', 'Ke belakang', '[') + '<hr>' +
      it(lk ? 'unlock' : 'lock', lk ? 'Buka kunci' : 'Kunci') + it('zoomsel', 'Zoom ke pilihan', 'Z') + '<hr>' + it('del', 'Hapus', 'Del', ' danger')
    : it('paste', 'Tempel di sini', 'Ctrl+V', pst) + it('selall', 'Pilih semua', 'Ctrl+A') + it('fit', 'Lihat semua', 'Shift+Z');
  const cb = $('#canvas').getBoundingClientRect();
  m.style.display = 'block';
  m.style.left = Math.min(e.clientX - cb.left, cb.width - m.offsetWidth - 8) + 'px';
  m.style.top = Math.min(e.clientY - cb.top, cb.height - m.offsetHeight - 8) + 'px';
}
function closeMenu() { $('#ctxmenu').style.display = 'none'; }
$('#ctxmenu').addEventListener('pointerdown', e => e.stopPropagation());
document.addEventListener('pointerdown', e => { if (e.button !== 2 && !e.target.closest('#ctxmenu')) closeMenu(); });

// ================= Panel properti =================
const FIELDS = {
  sys: ['Sistem', 'sys'], size: ['Ukuran', 'size', ['w', 'h']], size2: ['Ukuran ujung b', 'size', ['w2', 'h2']], bsize: ['Ukuran cabang', 'size', ['bw', 'bh']],
  L: ['Panjang', 'num', 'mm'], angle: ['Sudut belok', 'sel', [90, 60, 45, 30, 22.5]], elev: ['Elevasi dasar duct (BOD)', 'num', 'mm'],
  flow: ['Debit', 'num', 'flow'], tag: ['Kode', 'text'], F: ['Ukuran muka', 'num', 'mm'], Fx: ['Muka – lebar', 'num', 'mm'], Fy: ['Muka – panjang', 'num', 'mm'],
  B: ['Lebar badan', 'num', 'mm'], name: ['Nama ruangan', 'text'], W: ['Panjang', 'num', 'mm'], H: ['Lebar', 'num', 'mm'], t: ['Tebal dinding', 'num', 'mm'],
  off: ['Jarak garis ukur', 'num', 'mm'], dims: ['Ukuran otomatis', 'chk'], s: ['Isi teks', 'text'], th: ['Tinggi teks (0 = otomatis)', 'num', 'mm'],
  shape: ['Bentuk', 'opt', [['rect', 'Kotak'], ['round', 'Bulat']]], cw: ['Lebar kolom', 'num', 'mm'], cd: ['Tebal kolom (kotak)', 'num', 'mm'],
  kind: ['Jenis pintu', 'opt', [['single', 'Tunggal'], ['double', 'Ganda'], ['sliding', 'Geser']]], dw: ['Lebar bukaan', 'num', 'mm'],
  swing: ['Arah buka', 'opt', [['in', 'Ke dalam'], ['out', 'Ke luar']]], hinge: ['Engsel', 'opt', [['l', 'Kiri'], ['r', 'Kanan']]],
  sw: ['Lebar', 'num', 'mm'], sd: ['Panjang', 'num', 'mm'], bw: ['Lebar balok', 'num', 'mm'], be: ['Tinggi bawah balok (BB)', 'num', 'mm'],
  skind: ['Jenis tangga', 'opt', [['straight', 'Lurus'], ['L', 'Bentuk L']]], sl: ['Panjang lajur', 'num', 'mm'], tr: ['Lebar anak tangga', 'num', 'mm'],
  ch: ['Tinggi plafon', 'num', 'mm'],
};
const ALIGN = [
  ['l', 'Rata kiri', 'M4 3v18M8 7h10v4H8zM8 13h6v4H8z'], ['c', 'Rata tengah (horizontal)', 'M12 3v18M6 7h12v4H6zM8 13h8v4H8z'], ['r', 'Rata kanan', 'M20 3v18M6 7h10v4H6zM10 13h6v4h-6z'],
  ['t', 'Rata atas', 'M3 4h18M7 8h4v10H7zM13 8h4v6h-4z'], ['m', 'Rata tengah (vertikal)', 'M3 12h18M7 6h4v12H7zM13 8h4v8h-4z'], ['b', 'Rata bawah', 'M3 20h18M7 6h4v10H7zM13 10h4v6h-4z'],
];
const row = (label, inner) => `<div><span class="field-label">${label}</span>${inner}</div>`;
const seg = (k, opts, v) => `<div class="seg">${opts.map(([val, lab]) => `<label><input type="radio" name="${k}" data-k="${k}" value="${val}"${val === v ? ' checked' : ''}>${lab}</label>`).join('')}</div>`;
const numIn = (k, v, unit, attrs = '') => `<div class="field-unit"><input type="number" step="any" data-k="${k}" value="${r2(v)}"${attrs}><span>${unit}</span></div>`;

function fieldHTML(n, key) {
  const [label, kind, x] = FIELDS[key];
  if (kind === 'sys') return row(label, seg('sys', [['SA', 'Supply (SA)'], ['EA', 'Exhaust (EA)']], n.sys));
  if (kind === 'opt') return row(label, seg(key, x, n[key]));
  if (kind === 'size') {
    const round = n.shape === 'round';
    return row(`${label} (${P.unit})`, (key === 'size' && 'shape' in n && TYPES[n.type].duct ? seg('shape', [['rect', 'Kotak'], ['round', 'Bulat']], n.shape) : '') +
      `<div class="flex items-center gap-2 ${key === 'size' && TYPES[n.type].duct ? 'mt-1.5' : ''}">${numIn(x[0], n[x[0]], round ? 'Ø' : 'W', ' min="0.1"')}${round ? '' : `<span class="text-muted">×</span>${numIn(x[1], n[x[1]], 'H', ' min="0.1"')}`}</div>`);
  }
  if (kind === 'num') return row(label, numIn(key, n[key], x === 'flow' ? P.fu : x));
  if (kind === 'chk') return row(label, `<label class="flex items-center gap-2"><input type="checkbox" data-k="${key}" class="accent-ink w-4 h-4"${n[key] !== false ? ' checked' : ''}> Tampilkan garis ukur</label>`);
  if (kind === 'text') return row(label, `<input class="field" data-k="${key}" value="${esc(n[key])}">`);
  if (kind === 'sel') {
    const opts = x.includes(n[key]) ? x : [n[key], ...x];
    return row(label, `<div class="flex gap-2"><select class="field" data-k="${key}" data-num>${opts.map(v => `<option value="${v}"${v === n[key] ? ' selected' : ''}>${v}°</option>`).join('')}</select>${TYPES[n.type].mirror ? `<button class="btn-ghost shrink-0" data-act="mirror" title="Belok ke sisi lain (M)">⇋ Balik</button>` : ''}</div>`);
  }
  return '';
}

let propsKey = '';
function propsUI() {
  const has = propsPanel();
  document.body.classList.toggle('side-empty', !has); $('#ctxbar').innerHTML = barUI(selNodes()); placeBar();
  const key = [...sel].join() + tool;  // isi panel berganti (bukan sekadar nilai diubah) → masuk halus
  if (key !== propsKey && !REDUCE.matches) $('#props').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
  propsKey = key;
}
function propsPanel() {
  const box = $('#props'), ns = selNodes();
  const title = t => `<h3 class="field-label !text-ink !text-xs mb-3">${t}</h3>`;
  if (!ns.length) {
    if (tool === 'duct' || (tool === 'place' && ghost && TYPES[ghost.type].duct)) {
      const d = { ...spec, type: 'straight' };
      box.innerHTML = title('Ukuran duct baru') + `<div class="space-y-4" data-spec>${fieldHTML(d, 'sys')}${fieldHTML(d, 'size')}${fieldHTML(d, 'elev')}</div>`;
      return true;
    }
    box.innerHTML = '<p class="text-muted text-sm py-6 text-center">Pilih komponen di kanvas untuk melihat dan mengubah propertinya.</p>';
    return false;
  }
  return propsBody(box, ns, title);
}
// Pengaturan proyek (menu Proyek di kiri)
function projUI() {
  const nn = P.nodes.filter(n => n.type !== 'room').length, flows = Object.entries(ctx.flows);
  $('#proj').innerHTML = `<div class="space-y-4">
      <dl class="grid grid-cols-2 gap-y-2 text-xs">
        <dt class="text-muted">Satuan duct</dt><dd class="font-mono text-right">${P.unit}</dd>
        <dt class="text-muted">Komponen</dt><dd class="font-mono text-right">${nn}</dd>
        ${flows.map(([id, f]) => `<dt class="text-muted">${esc(node(id).tag)}</dt><dd class="font-mono text-right">${f} ${P.fu}</dd>`).join('')}
      </dl>
      ${row('Skala gambar', `<select class="field" data-proj="scale">${['1:50', '1:100', '1:200'].map(s => `<option${s === P.scale ? ' selected' : ''}>${s}</option>`).join('')}</select>`)}
      ${row('Gantungan otomatis', `<div class="flex items-center gap-2"><label class="flex items-center gap-2 shrink-0"><input type="checkbox" data-proj="hang-on" class="accent-ink w-4 h-4"${P.hang.on ? ' checked' : ''}> Tiap</label><div class="field-unit flex-1"><input type="number" min="300" step="100" data-proj="hang-sp" value="${P.hang.sp}"><span>mm</span></div></div>`)}
      ${row('Tema kanvas', seg('theme', [['screen', 'Gelap'], ['light', 'Terang']], pal))}
      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-line"><a class="btn-ghost" href="docs.html" target="_blank">Dokumentasi</a><a class="btn-ghost" href="docs.html#dukung" target="_blank"><span class="text-red-600">♥</span> Dukung</a></div></div>`;
}
function propsBody(box, ns, title) {
  const actions = `<div class="grid grid-cols-2 gap-2">
    <button class="btn-ghost" data-act="rotl" title="Putar kiri 90°">⟲ Putar</button><button class="btn-ghost" data-act="rotr" title="Putar kanan 90° (R)">⟳ Putar</button>
    <button class="btn-ghost" data-act="dup" title="Ctrl+D">Duplikat</button><button class="btn-ghost !text-red-700" data-act="del" title="Delete">Hapus</button>
    <button class="btn-ghost col-span-2" data-act="lock" title="Komponen tidak bisa digeser/dihapus sampai dibuka">${ic('lock')} Kunci</button></div>`;
  if (ns.length > 1) {
    const withSys = ns.filter(n => 'sys' in n), s0 = withSys[0] && withSys[0].sys, grouped = ns[0].g && ns.every(n => n.g === ns[0].g);
    const al = ALIGN.map(([k, t, d]) => `<button class="btn-ghost !px-0" data-act="align-${k}" title="${t}" aria-label="${t}"><svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${d}"/></svg></button>`).join('');
    box.innerHTML = title(grouped ? `Group · ${ns.length} komponen` : `${ns.length} komponen dipilih`) + `<div class="space-y-4">
      ${grouped ? '<button class="btn-ghost w-full" data-act="ungroup" title="Ctrl+Shift+G">Ungroup</button>' : '<button class="btn-primary w-full" data-act="group" title="Ctrl+G">Group</button>'}
      ${row('Rata', `<div class="grid grid-cols-6 gap-1">${al}</div>`)}
      ${withSys.length ? row('Sistem (semua)', seg('sys', [['SA', 'Supply (SA)'], ['EA', 'Exhaust (EA)']], withSys.every(n => n.sys === s0) ? s0 : '')) : ''}
      ${actions}<button class="btn-ghost w-full" data-act="mirror">⇋ Cermin (M)</button></div>`;
    return true;
  }
  const n = ns[0], T = TYPES[n.type], lk = locked(n), L = layerOf(n), nw = warns.filter(w => w.id === n.id);
  const room = n.host && node(n.host.id), pen = (ctx.pen[n.id] || []).length;
  const ports = cn.all.filter(a => a.node === n).map(a => {
    const b = cn.link.get(a);
    return `<li class="port-row"><span class="w-2 h-2 rounded-full ${b ? 'bg-green-500' : a.opt ? 'bg-gray-300' : 'bg-red-500'}"></span><b class="font-mono">${a.id}</b>
      <span class="text-muted truncate">${b ? 'ke ' + TYPES[b.node.type].name : a.opt ? 'boleh kosong' : 'belum tersambung'}</span>${a.keys && a.w != null ? `<span class="ml-auto font-mono">${sizeLabel(a.w, a.h, a.shape, P.unit)}</span>` : ''}</li>`;
  }).join('');
  box.innerHTML = `<div class="flex items-center gap-3 mb-4">
      <div class="w-11 h-11 rounded-lg bg-white ring-1 ring-line grid place-items-center">${T.icon ? `<img src="assets/svg/${T.icon}.svg" alt="" class="w-8 h-8">` : `<span class="sw" style="width:18px;height:18px;background:${PAL.screen.col[L]}"></span>`}</div>
      <div class="mr-auto min-w-0"><div class="font-semibold truncate">${T.name}</div><div class="font-mono text-xs text-muted">${LAYER_NAME[L]}</div></div>
    </div>
    ${nw.map(w => `<div class="mb-3 p-2.5 rounded-lg bg-red-50 ring-1 ring-red-200 text-xs text-red-900"><b class="block">! ${esc(w.msg)}</b>${esc(w.detail)}</div>`).join('')}
    ${layerLocked(n) ? `<p class="mb-3 p-2 rounded bg-hazard/20 text-xs">Layer terkunci – buka kunci di panel Layer untuk mengubah.</p>`
      : n.lock ? `<div class="mb-3 p-2 rounded bg-hazard/20 text-xs flex items-center gap-2">${ic('lock')}<span class="flex-1">Terkunci, tidak bisa digeser.</span><button class="btn-ghost !h-7" data-act="unlock">Buka kunci</button></div>` : ''}
    ${room ? `<p class="mb-3 text-xs text-muted">Menempel di dinding <b class="text-ink">${esc(room.name)}</b>. Seret untuk geser sepanjang dinding.</p>` : ''}
    ${pen ? `<p class="mb-3 text-xs text-muted">Menembus dinding di ${pen} titik (perlu bobokan, ditandai kotak di gambar).</p>` : ''}
    <fieldset class="space-y-4 min-w-0"${lk ? ' disabled' : ''}>
      ${T.f.map(k => fieldHTML(n, k)).join('')}
      ${n.host ? '' : row('Rotasi', `<div class="flex gap-2"><button class="btn-ghost !px-2.5" data-act="rotl" title="Putar kiri 90°">⟲</button>${numIn('rot', n.rot || 0, '°')}<button class="btn-ghost !px-2.5" data-act="rotr" title="Putar kanan 90°">⟳</button></div>`)}
      ${n.type === 'straight' ? `<button class="btn-ghost w-full" data-act="flip">⇄ Balik arah aliran</button>` : ''}
      ${ports ? row('Sambungan', `<ul class="space-y-1">${ports}</ul>`) : ''}
      ${n.type === 'room' ? row('Bentuk', `<div class="grid grid-cols-4 gap-1">${Object.keys(ROOM_SHAPES).map(k => `<button class="btn-ghost !px-0" data-act="shape-${k}" title="${ROOM_SHAPES[k][0]}"><img src="assets/svg/ruang-${k.toLowerCase()}.svg" alt="${ROOM_SHAPES[k][0]}" class="w-5 h-5"></button>`).join('')}</div><p class="hint">Seret ■ titik / ● sisi. Klik ganda ● tambah titik, ■ hapus.</p>`) : ''}
      ${n.host ? `<button class="btn-ghost w-full" data-act="detach">Lepas dari dinding</button>` : ''}
      ${n.g ? `<button class="btn-ghost w-full" data-act="ungroup">Keluarkan dari group</button>` : ''}
      ${actions}
    </fieldset>`;
  return true;
}

$('#proj').addEventListener('change', e => {
  const el = e.target, pk = el.dataset.proj;
  if (el.dataset.k === 'theme') return setTheme(el.value);
  if (pk) commit(() => {
    if (pk === 'scale') P.scale = el.value;
    if (pk === 'hang-on') P.hang.on = el.checked;
    if (pk === 'hang-sp') P.hang.sp = Math.max(300, +el.value || 1500);
  });
});
$('#props').addEventListener('change', e => {
  const el = e.target, k = el.dataset.k;
  if (!k) return;
  const isNum = el.type === 'number' || 'num' in el.dataset;
  let v = el.type === 'checkbox' ? el.checked : isNum ? parseFloat(el.value) : el.value;
  if (isNum && !isFinite(v)) return refresh();
  if (isNum && k !== 'rot' && k !== 'off' && k !== 'th' && k !== 'elev' && k !== 'flow' && v <= 0) { toast('Nilai harus lebih dari 0'); return refresh(); }
  if (k === 'rot') v = norm(v);
  if (el.closest('[data-spec]')) { spec[k] = v; if (draw) draw.spec[k] = v; if (ghost && k in ghost) ghost[k] = v; return refresh(), hint(); }
  const ns = selNodes().filter(n => !locked(n));
  commit(() => ns.forEach(n => { if (n.type === 'room' && (k === 'W' || k === 'H')) resizeRoom(n, k, v); else if (k in n || k === 'rot') n[k] = v; }));
});
$('#props').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) doAct(a.dataset.act); });
$('#ctxbar').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) doAct(a.dataset.act); });
$('#ctxmenu').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) { closeMenu(); doAct(a.dataset.act); } });
function doAct(act) {
  if (act === 'rotl') rotateSel(-90);
  if (act === 'rotr') rotateSel(90);
  if (act === 'mirror') mirrorSel();
  if (act === 'del') delSel();
  if (act === 'dup') { copySel(); paste(); }
  if (act.startsWith('shape-')) commit(() => selNodes().filter(n => n.type === 'room').forEach(n => roomShape(n, act.slice(6))));
  if (act.startsWith('add-')) { const t = act.slice(4); if (t === 'partition') setTool('wall'); else setTool('place', t); }
  if (act === 'lock') lockSel(true);
  if (act === 'unlock') lockSel(false);
  if (act === 'hinge') commit(() => selNodes().forEach(n => { if (n.type === 'door') n.hinge = n.hinge === 'r' ? 'l' : 'r'; }));
  if (act === 'swing') commit(() => selNodes().forEach(n => { if (n.type === 'door') n.swing = n.swing === 'out' ? 'in' : 'out'; }));
  if (act === 'detach') commit(() => selNodes().forEach(n => { delete n.host; }));
  if (act === 'copy') copySel();
  if (act === 'paste') paste(menuAt);
  if (act === 'front') orderSel(true);
  if (act === 'back') orderSel(false);
  if (act === 'zoomsel') zoomSel();
  if (act === 'fit') fit();
  if (act === 'selall') { sel = new Set(P.nodes.filter(n => visible(n) && !locked(n)).map(n => n.id)); refresh(); }
  if (act === 'theme') setTheme(pal === 'light' ? 'screen' : 'light');
  if (act === 'group') groupSel();
  if (act === 'ungroup') ungroupSel();
  if (act.startsWith('align-')) alignSel(act.slice(6));
  if (act === 'flip') commit(() => selNodes().forEach(n => { n.flip = !n.flip; }));
}

// ================= Layer, warning, status =================
const LOCK_SVG = '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
function layersUI() {
  $('#layers').innerHTML = LAYERS.map(([k, nm, dxf]) => `<li class="flex items-center gap-1"><label class="layer-row flex-1"><input type="checkbox" data-layer="${k}"${P.layers[k].on ? ' checked' : ''}>
    <span class="sw" style="background:${PAL.screen.col[k]}"></span><span class="flex-1">${nm}</span><span class="font-mono text-[10px] text-muted">${dxf}</span></label>
    <button class="lock-btn" data-lock="${k}" aria-pressed="${P.layers[k].lock}" title="${P.layers[k].lock ? 'Buka kunci' : 'Kunci'} layer">${LOCK_SVG}</button></li>`).join('');
}
$('#layers').addEventListener('change', e => {
  const k = e.target.dataset.layer;
  if (!k) return;
  P.layers[k].on = e.target.checked;
  if (!e.target.checked) sel = new Set(selNodes().filter(visible).map(n => n.id));
  persist(); refresh();
});
$('#layers').addEventListener('click', e => {
  const b = e.target.closest('[data-lock]');
  if (!b) return;
  const L = P.layers[b.dataset.lock];
  L.lock = !L.lock;
  if (L.lock) sel = new Set(selNodes().filter(n => !locked(n)).map(n => n.id));
  persist(); refresh();
});

function warnUI() {
  $$('.warn-count').forEach(el => { el.textContent = warns.length; });
  $('#warn-btn').classList.toggle('!text-green-300', !warns.length);
  $('#warn-list').innerHTML = warns.length ? warns.map((w, i) => `<li><button class="warn-item" data-wi="${i}">
    <span class="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold">!</span>
    <span class="flex-1"><b class="block">${w.msg}</b><span class="block text-muted text-xs mt-0.5">${esc(w.detail)}</span><span class="block font-mono text-[11px] text-muted mt-1">X ${Math.round(w.pos[0])} · Y ${Math.round(-w.pos[1])}</span></span>
    <span class="text-xs font-semibold self-center">Lihat →</span></button></li>`).join('')
    : '<li class="px-4 py-6 text-center text-muted">Tidak ada masalah. Gambar siap di-export.</li>';
}
$('#warn-list').addEventListener('click', e => {
  const b = e.target.closest('[data-wi]');
  if (!b) return;
  const w = warns[+b.dataset.wi];
  if (tool !== 'select') setTool('select');
  sel = new Set([w.id]); zoomTo(w.pos); refresh();
});
$('#warn-btn').onclick = () => { document.body.classList.toggle('show-warn'); overlay(); };
$('#warn-close').onclick = () => { document.body.classList.remove('show-warn'); overlay(); };

function statusUI() {
  $('#unit').textContent = P.unit; $('#scale').textContent = P.scale;
  $$('[data-opt]').forEach(b => b.setAttribute('aria-pressed', opt[b.dataset.opt]));
  $('#undo').disabled = !hist.length; $('#redo').disabled = !fut.length;
}
$$('[data-opt]').forEach(b => b.addEventListener('click', () => { opt[b.dataset.opt] = !opt[b.dataset.opt]; statusUI(); overlay(); }));

// ================= Library =================
$('#lib-groups').innerHTML = LIBRARY.map(([g, ts]) => `<details class="lib-group" open><summary>${g}<span class="ml-auto font-mono font-normal text-muted">${ts.length}</span></summary>
  <div class="grid grid-cols-3 gap-1 p-1">${ts.map(t => { const I = libInfo(t); return `<button class="lib-item" draggable="true" data-place="${t}" title="Seret ke kanvas, atau klik lalu klik di kanvas"><img src="assets/svg/${I.icon}.svg" alt="" draggable="false">${I.name}</button>`; }).join('')}</div></details>`).join('');
$('#lib').addEventListener('click', e => { const b = e.target.closest('[data-place]'); if (b) setTool('place', b.dataset.place); });
// Menu Alat: alat gambar (Pilih & Geser ada di bar kanan-bawah)
const TOOL_CARDS = [
  ['duct', 'duct-lurus', 'Gambar jalur duct', 'Klik titik demi titik, elbow dipasang otomatis', 'D'],
  ['room', 'ruang-rect', 'Ruangan kotak', 'Seret 2 sudut, atau ketik 6x4 + Enter', 'K'],
  ['poly', 'ruang-l', 'Ruangan bebas', 'Klik tiap sudut: bentuk L, T, custom', 'P'],
  ['wall', 'partisi', 'Partisi', 'Dinding dalam ruangan, bisa bersambung', 'W'],
  ['dim', 'dimensi', 'Ukur / dimensi', 'Klik 2 titik, lalu posisi garis', 'U'],
  ['pen', 'coretan', 'Coretan tangan', 'Sketsa bebas untuk tanda & catatan', 'B'],
];
$('#tool-list').innerHTML = TOOL_CARDS.map(([t, icon, nm, d, k]) => `<button class="tool-card" data-tool="${t}"><img src="assets/svg/${icon}.svg" alt=""><span class="min-w-0"><b>${nm}</b><small>${d}</small></span><kbd>${k}</kbd></button>`).join('') +
  '<p class="hint !mt-3">Pilih & geser kanvas ada di kanan bawah. <kbd>Esc</kbd> kembali ke Pilih.</p>';
$$('[data-text]').forEach(b => b.addEventListener('click', () => addText(+b.dataset.text)));
const BLANK = new Image();
BLANK.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
$('#lib-groups').addEventListener('dragstart', e => {
  const b = e.target.closest('[data-place]');
  if (!b) return;
  e.dataTransfer.setData('text/plain', b.dataset.place);
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setDragImage(BLANK, 0, 0);
  dropped = false;
  setTool('place', b.dataset.place);
});
$('#lib-groups').addEventListener('dragend', () => { if (!dropped) setTool('select'); });
$('#lib-search').oninput = e => {
  const s = e.target.value.toLowerCase();
  $$('.lib-item').forEach(i => { i.style.display = i.textContent.toLowerCase().includes(s) ? '' : 'none'; });
  if (s) $$('.lib-group').forEach(g => { g.open = true; });
};

// ================= Tombol, keyboard =================
$$('button[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$$('[data-hint-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.hintTool)));
$('#hint-close').onclick = () => { localStorage.setItem('temandor.nohint', 1); $('#empty-hint').remove(); };
if (localStorage.getItem('temandor.nohint')) $('#empty-hint').remove();
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#save').onclick = () => { try { saveProject(P); toast('Tersimpan di browser ini'); } catch { toast('Gagal menyimpan: penyimpanan browser penuh.'); } };
$('#zoom-fit').onclick = fit;
const zoomBy = k => { const c = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2]; animVB([c[0] - vb[2] * k / 2, c[1] - vb[3] * k / 2, vb[2] * k, vb[3] * k], 200); };
$('#zoom-in').onclick = () => zoomBy(1 / 1.25);
$('#zoom-out').onclick = () => zoomBy(1.25);
$('#theme').onclick = () => setTheme(pal === 'light' ? 'screen' : 'light');
$('#proj-name').addEventListener('change', e => commit(() => { P.name = e.target.value.trim() || 'Tanpa nama'; }));
$$('[data-drawer]').forEach(b => b.addEventListener('click', () => {
  const c = 'open-' + b.dataset.drawer, on = !document.body.classList.contains(c);
  document.body.classList.remove('open-lib', 'open-side');
  document.body.classList.toggle(c, on);
  setPanels({});
}));
$('#scrim').onclick = () => { document.body.classList.remove('open-lib', 'open-side'); setPanels({}); };
// Rail kiri (seperti Canva): klik kategori = buka panelnya, klik lagi = tutup. Desktop tersimpan di browser; HP jadi bottom sheet.
const DESK = matchMedia('(min-width: 1024px)');
const panels = { lib: true, side: true, cat: 'elemen' };
try { Object.assign(panels, JSON.parse(localStorage.getItem('temandor.panels') || '{}')); } catch { /* abaikan */ }
function setPanels(o) {
  Object.assign(panels, o);
  document.body.classList.toggle('hide-lib', !panels.lib);
  document.body.classList.toggle('hide-side', !panels.side);
  const libOn = DESK.matches ? panels.lib : document.body.classList.contains('open-lib');
  $$('[data-cat]').forEach(b => b.setAttribute('aria-pressed', libOn && b.dataset.cat === panels.cat));
  $$('[data-pane]').forEach(p => p.classList.toggle('on', p.dataset.pane === panels.cat));
  $('#focus').setAttribute('aria-pressed', !panels.lib && !panels.side);
  localStorage.setItem('temandor.panels', JSON.stringify(panels));
}
function openCat(c) {
  const b = document.body, open = DESK.matches ? panels.lib : b.classList.contains('open-lib'), close = open && panels.cat === c;
  if (DESK.matches) return setPanels({ cat: c, lib: !close });
  b.classList.remove('open-side'); b.classList.toggle('open-lib', !close); setPanels({ cat: c });
}
$$('[data-cat]').forEach(b => b.addEventListener('click', () => openCat(b.dataset.cat)));
DESK.addEventListener('change', () => { document.body.classList.remove('open-lib', 'open-side'); setPanels({}); });
const focusMode = () => { const any = panels.lib || panels.side; setPanels({ lib: !any, side: !any }); };
$$('[data-panel]').forEach(b => b.addEventListener('click', () => setPanels({ [b.dataset.panel]: !panels[b.dataset.panel] })));
$('#focus').onclick = focusMode;
document.body.classList.add('instant'); setPanels({}); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('instant'))); // saat halaman dibuka: tanpa animasi

$('#cmd').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; e.target.value = ''; typed(v); }
  if (e.key === 'Escape') { e.target.value = ''; e.target.blur(); }
});

const KEYS = { v: 'select', h: 'pan', k: 'room', p: 'poly', w: 'wall', d: 'duct', f: 'fitting', e: 'equip', g: 'diffuser', u: 'dim', t: 'text', b: 'pen' };
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.target.closest('input, select, textarea, dialog')) {
    if (ctrl && k === 's') { e.preventDefault(); $('#save').click(); }
    return;
  }
  if (ctrl) {
    const act = { '[': () => setPanels({ lib: !panels.lib }), ']': () => setPanels({ side: !panels.side }), z: () => (e.shiftKey ? redo() : undo()), y: redo, c: copySel, v: () => paste(inside ? cur : null), d: () => { copySel(); paste(); }, s: () => $('#save').click(), g: () => (e.shiftKey ? ungroupSel() : groupSel()),
      a: () => { setTool('select'); sel = new Set(P.nodes.filter(n => visible(n) && !locked(n)).map(n => n.id)); refresh(); } }[k];
    if (act) { e.preventDefault(); act(); }
    return;
  }
  if (e.key === '?') return $('#dlg-keys').showModal();
  if (e.key === 'Tab' && e.target === document.body) { e.preventDefault(); return focusMode(); }
  if (e.key === ']' || e.key === '[') return orderSel(e.key === ']');
  const AR = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (AR && sel.size) { e.preventDefault(); const st = e.shiftKey ? 100 : 10; return nudge(AR[0] * st, AR[1] * st); }
  if (e.key === 'F8') { e.preventDefault(); opt.ortho = !opt.ortho; statusUI(); return overlay(); }
  if (e.key === 'F3') { e.preventDefault(); opt.snap = !opt.snap; statusUI(); return overlay(); }
  if (e.key === 'F7') { e.preventDefault(); opt.grid = !opt.grid; statusUI(); return overlay(); }
  if (draw && /^[0-9.]$/.test(e.key)) { $('#cmd').focus(); return; } // angka langsung masuk ke baris perintah
  if (e.key === ' ') { spaceDown = true; e.preventDefault(); return; }
  if (e.key === 'Escape') {
    if (draw && (draw.pts.length || draw.p0)) { draw = { k: draw.k, pts: [], spec: { ...spec } }; hint(); return overlay(); }
    closeMenu();
    document.body.classList.remove('show-warn');
    sel.clear(); return setTool('select');
  }
  if (e.key === 'Enter') { if (draw && draw.k === 'duct') finishDuct(); if (draw && draw.k === 'poly') finishPoly(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (draw && (draw.k === 'duct' || draw.k === 'poly') && draw.pts.length) { draw.pts.pop(); if (!draw.pts.length) draw.start = null; hint(); return overlay(); }
    return delSel();
  }
  if (k === 'r') return rotateSel(90);
  if (k === 'm') return mirrorSel();
  if (k === 'z') return e.shiftKey ? fit() : zoomSel();
  if (e.key === '+' || e.key === '=') return zoomBy(1 / 1.25);
  if (e.key === '-') return zoomBy(1.25);
  if (KEYS[k]) setTool(KEYS[k]);
});
document.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; });

// ================= Export =================
$('[data-open="dlg-export"]').addEventListener('click', () => {
  const f = $('#form-export');
  $('#exp-layers').innerHTML = LAYERS.map(([k, nm, dxf]) => `<label class="flex items-center gap-2"><input type="checkbox" name="layer" value="${k}"${P.layers[k].on ? ' checked' : ''} class="accent-ink"><span class="font-mono text-xs">${dxf}</span><span class="text-xs text-muted truncate">${nm}</span></label>`).join('');
  f.scale.value = P.scale;
  $('#exp-warn').innerHTML = warns.length ? `<b>!</b><span>Masih ada ${warns.length} warning. Export tetap bisa, tapi sebaiknya dicek dulu.</span>` : '<span>Tidak ada warning.</span>';
  $('#exp-warn').className = warns.length ? 'flex gap-2 rounded-lg bg-red-50 ring-1 ring-red-200 p-3 text-xs text-red-900' : 'flex gap-2 rounded-lg bg-green-50 ring-1 ring-green-200 p-3 text-xs text-green-900';
  updateExpName();
});
const updateExpName = () => { $('#exp-file').textContent = slug(P.name) + '.' + $('#form-export').fmt.value; };
$('#form-export').addEventListener('change', e => {
  if (e.target.name === 'scale') commit(() => { P.scale = e.target.value; });
  updateExpName();
});
$('#do-export').addEventListener('click', () => {
  const f = $('#form-export'), fmt = f.fmt.value, name = slug(P.name);
  const layers = new Set($$('input[name=layer]:checked', f).map(i => i.value)), note = f.note.checked;
  if (fmt === 'json') return download(name + '.json', JSON.stringify(P, null, 1), 'application/json');
  if (fmt === 'dxf') return download(name + '.dxf', toDXF(P, { layers, unit: f.unit.value, note }), 'application/dxf');
  const { svg: doc, vb: v } = docSVG(P, { pal: 'paper', layers, note });
  if (fmt === 'pdf') {
    const w = window.open('', '_blank');
    if (!w) return toast('Popup diblokir browser. Izinkan popup untuk export PDF.');
    w.document.write(`<!doctype html><title>${esc(P.name)}</title><style>@page{size:A3 landscape;margin:10mm}html,body{margin:0;height:100%}svg{width:100%;height:100%}</style>${doc}<script>onload=()=>setTimeout(()=>print(),300)<\/script>`);
    return w.document.close();
  }
  const img = new Image(), W = 3200, H = Math.round(W * v[3] / v[2]);
  img.onload = () => {
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    c.toBlob(b => download(name + '.png', b));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(doc);
});

// ================= Mulai =================
$('#proj-name').value = P.name;
document.title = P.name + ' · Temandor';
render(); fit(true); setTool('select');
