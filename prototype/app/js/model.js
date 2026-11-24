// Temandor – model proyek: layer, koneksi antar port, validasi, debit, simpan/buka.

// [kunci, nama, layer DXF, warna ACI]
const LAYERS = [
  ['sa', 'Supply Air (SA)', 'DUCT-SA', 5],
  ['ea', 'Exhaust Air (EA)', 'DUCT-EA', 6],
  ['eq', 'Equipment', 'EQUIPMENT', 3],
  ['diff', 'Diffuser & grille', 'DIFFUSER', 4],
  ['hanger', 'Gantungan', 'HANGER', 8],
  ['dim', 'Dimensi & teks', 'DIMENSION', 7],
  ['denah', 'Dinding & ruangan', 'A-WALL', 8],
  ['kolom', 'Kolom', 'A-COLS', 8],
  ['bukaan', 'Pintu, jendela, bukaan', 'A-DOOR', 210],
  ['arsi', 'Tangga, lift, shaft, balok', 'A-MISC', 9],
  ['coret', 'Coretan tangan', 'MARKUP', 30],
];
// Proyek lama belum punya layer baru → tambahkan
function withLayers(p) { if (p && p.layers) for (const [k] of LAYERS) p.layers[k] = p.layers[k] || { on: true, lock: false }; return p; }

const uid = () => Math.random().toString(36).slice(2, 9);
const scaleDen = s => +String(s).split(':')[1] || 100;
const layerOf = n => TYPES[n.type].layer || (n.sys === 'EA' ? 'ea' : 'sa');

function mk(type, o = {}) {
  return { id: uid(), type, x: 0, y: 0, rot: 0, mir: false, ...structuredClone(TYPES[type].def), ...o };
}

function newProject({ name = 'Proyek baru', unit = 'inch', scale = '1:100', W = 6000, H = 4000 } = {}) {
  return {
    v: 1, id: uid(), name, unit, scale, fu: 'cfm', updated: Date.now(),
    hang: { on: true, sp: 1500 },
    layers: Object.fromEntries(LAYERS.map(([k]) => [k, { on: true, lock: false }])),
    nodes: [mk('room', { W, H, name: 'Ruangan 1' })],
  };
}

// Port yang posisinya sama dan arahnya berlawanan dianggap tersambung (koneksi tidak disimpan, dihitung).
// ponytail: scan O(n²) semua port; ganti grid-hash kalau proyek > ~2000 port.
function connect(p) {
  const all = p.nodes.flatMap(n => worldPorts(n, p.unit)), link = new Map();
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.node !== b.node && !link.has(a) && !link.has(b) && dist(a.pos, b.pos) < 2 && Math.abs(norm(a.wdir - b.wdir + 180)) < 1) { link.set(a, b); link.set(b, a); }
  }
  return { all, link, open: all.filter(a => !link.has(a)) };
}

// Total debit diffuser/grille yang terhubung ke tiap FCU/fan
function flowTotals(p, cn) {
  const byNode = new Map();
  for (const a of cn.all) { if (!byNode.has(a.node)) byNode.set(a.node, []); byNode.get(a.node).push(a); }
  const out = {};
  for (const src of p.nodes.filter(n => n.type === 'fcu' || n.type === 'fan')) {
    let sum = 0;
    const seen = new Set([src]), q = [src];
    while (q.length) {
      const n = q.shift();
      if (n !== src && (n.type === 'diffuser' || n.type === 'grille')) sum += +n.flow || 0;
      if (n !== src && (n.type === 'fcu' || n.type === 'fan')) continue;
      for (const a of byNode.get(n) || []) { const b = cn.link.get(a); if (b && !seen.has(b.node)) { seen.add(b.node); q.push(b.node); } }
    }
    out[src.id] = sum;
  }
  return out;
}

// ---- Pintu/jendela/bukaan menempel di dinding ruangan ----
// n.host = { id: ruangan, e: index sisi, s: jarak dari titik awal sisi (mm), n: jumlah titik ruangan saat ditempel }
function roomEdges(r) {
  const P = roomPts(r), N = P.length, sg = Math.sign(polyArea(P)) || 1;
  return P.map((p, i) => {
    const q = P[(i + 1) % N], A = localToWorld(r, p), C = localToWorld(r, q), len = dist(A, C) || 1;
    const d = dist(p, q) || 1, nl = [-(q[1] - p[1]) / d * sg, (q[0] - p[0]) / d * sg];
    return { A, C, len, u: [(C[0] - A[0]) / len, (C[1] - A[1]) / len], nIn: rotP(r.mir ? [nl[0], -nl[1]] : nl, r.rot || 0) };
  });
}
// Sisi dinding terdekat dari titik w (dalam jarak tol) → data host, atau null
function hostAt(n, w, rooms, tol) {
  let best = null, bd = tol;
  for (const r of rooms) roomEdges(r).forEach((E, i, all) => {
    const t = (w[0] - E.A[0]) * E.u[0] + (w[1] - E.A[1]) * E.u[1];
    if (t < -n.dw / 2 || t > E.len + n.dw / 2) return;
    const d = Math.abs((w[0] - E.A[0]) * E.nIn[0] + (w[1] - E.A[1]) * E.nIn[1] - r.t / 2);
    if (d < bd) { bd = d; best = { id: r.id, e: i, s: Math.round(Math.max(0, Math.min(t - n.dw / 2, E.len - n.dw))), n: all.length }; }
  });
  return best;
}
function syncHost(n, r) {
  const E = roomEdges(r), h = n.host;
  if (h.n !== E.length || !E[h.e]) { // titik ruangan bertambah/berkurang → tempel ulang ke sisi terdekat
    const b = hostAt(n, localToWorld(n, [n.dw / 2, n.t / 2]), [r], Infinity);
    if (!b) return;
    Object.assign(h, b);
  }
  const e = E[h.e];
  h.s = Math.max(0, Math.min(h.s, e.len - n.dw));
  n.t = r.t; n.x = e.A[0] + e.u[0] * h.s; n.y = e.A[1] + e.u[1] * h.s; n.rot = angOf(e.A, e.C);
  const ref = rotP([0, 1], n.rot);
  n.mir = ref[0] * e.nIn[0] + ref[1] * e.nIn[1] < 0; // lokal +y selalu ke dalam ruangan
}
function syncHosts(p) {
  const byId = new Map(p.nodes.map(m => [m.id, m]));
  for (const n of p.nodes) if (n.host) { const r = byId.get(n.host.id); if (r && r.type === 'room') syncHost(n, r); else delete n.host; }
}

function ctxOf(p, cn) {
  syncHosts(p);
  const cuts = {}, pen = {}, walls = [];
  for (const n of p.nodes) {
    if (n.host) ((cuts[n.host.id] = cuts[n.host.id] || {})[n.host.e] = cuts[n.host.id][n.host.e] || []).push([n.host.s, n.host.s + n.dw]);
    if (n.type === 'room') roomEdges(n).forEach(E => walls.push([E.A, E.C]));
    if (n.type === 'partition') walls.push([[n.x, n.y], localToWorld(n, [n.L, 0])]);
  }
  // Duct lurus yang menembus dinding → titik bobokan (bukan warning)
  for (const n of p.nodes) if (n.type === 'straight' || n.type === 'flex') {
    const a = [n.x, n.y], b = localToWorld(n, [n.L, 0]);
    for (const [c, d] of walls) { const t = segX(a, b, c, d); if (t != null) (pen[n.id] = pen[n.id] || []).push(t * n.L); }
  }
  return { unit: p.unit, fu: p.fu || 'cfm', th: 1.8 * scaleDen(p.scale), hang: p.hang, flows: cn ? flowTotals(p, cn) : {}, cuts, pen };
}

// Validasi: hanya warning, tidak pernah melarang.
function validate(p, cn) {
  const W = [], nm = n => TYPES[n.type].name;
  for (const a of cn.all) {
    const b = cn.link.get(a);
    if (!b) {
      if (!a.opt) W.push({ kind: 'open', msg: 'Ujung terbuka', detail: `${nm(a.node)} belum tersambung. Sambungkan atau pasang end cap.`, pos: a.pos, id: a.node.id });
      continue;
    }
    if (a.node.id > b.node.id) continue; // cek tiap pasangan sekali
    if (!a.any && !b.any && (a.shape !== b.shape || a.w !== b.w || (a.shape !== 'round' && a.h !== b.h))) {
      W.push({ kind: 'size', msg: 'Ukuran beda tanpa transisi', detail: `${sizeLabel(a.w, a.h, a.shape, p.unit)} langsung ke ${sizeLabel(b.w, b.h, b.shape, p.unit)}. Tambah transisi.`, pos: a.pos, id: a.node.id });
    }
    if (a.node.sys && b.node.sys && a.node.sys !== b.node.sys) {
      W.push({ kind: 'sys', msg: 'Sistem tercampur', detail: `${a.node.sys} tersambung ke ${b.node.sys}.`, pos: a.pos, id: a.node.id });
    }
  }
  for (const n of p.nodes) if ((n.type === 'diffuser' || n.type === 'grille') && !(+n.flow > 0)) {
    W.push({ kind: 'flow', msg: 'Debit belum diisi', detail: `${nm(n)} ${n.tag || ''} belum punya debit.`, pos: [n.x, n.y], id: n.id });
  }
  // Duct menabrak kolom / tangga / lift. Tembus dinding tidak dihitung (dibobok di lapangan).
  const c = { unit: p.unit, th: 1.8 * scaleDen(p.scale), hang: { on: false }, flows: {} };
  const hits = n => worldPrims(n, c).filter(q => q.k === 'hit').map(q => q.pts);
  const obs = p.nodes.filter(n => n.type === 'column' || n.type === 'stair' || n.type === 'lift').map(n => [n, hits(n)]);
  if (obs.length) for (const d of p.nodes) if (TYPES[d.type].duct) {
    const hd = hits(d);
    for (const [o, ho] of obs) if (hd.some(A => ho.some(B => polyHit(A, B)))) {
      const b = primBounds(worldPrims(o, c));
      W.push({ kind: 'clash', msg: `Duct menabrak ${nm(o).toLowerCase()}`, detail: `${nm(d)} ${sizeLabel(d.w, d.h, d.shape, p.unit)} melewati ${nm(o).toLowerCase()}. Geser jalur duct menjauh, atau belokkan dengan elbow.`, pos: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], id: d.id });
    }
  }
  return W;
}

// ---- Daftar material (BOQ): dihitung dari gambar, bukan diketik ----
// ponytail: tanpa harga, tanpa faktor sisa potong/sambungan; tambah kolom itu kalau mandor memintanya.
const BOQ_ORDER = ['Duct', 'Fitting', 'Perlengkapan', 'Equipment'];
function boq(p) {
  const U = p.unit, c = ctxOf(p, connect(p)), rows = new Map();
  const sz = (w, h, shape) => sizeLabel(w, h, shape, U);
  const add = (kat, item, spec, qty, unit) => {
    const k = [kat, item, spec, unit].join('|'), r = rows.get(k) || { kat, item, spec, qty: 0, unit };
    r.qty += qty; rows.set(k, r);
  };
  let hang = 0;
  for (const n of p.nodes) {
    const T = TYPES[n.type], sys = n.sys ? ' ' + n.sys : '';
    switch (n.type) {
      case 'straight': case 'flex': add('Duct', T.name + sys, sz(n.w, n.h, n.shape), n.L / 1000, 'm'); break;
      case 'elbow': {
        const red = n.w2 != null && (n.w2 !== n.w || n.h2 !== n.h);
        add('Fitting', `Elbow ${n.et === 'sq' ? 'siku + vane' : 'radius'}${sys}`, `${sz(n.w, n.h, n.shape)}${red ? ' → ' + sz(n.w2, n.h2, n.shape) : ''} · ${n.angle}°`, 1, 'bh'); break;
      }
      case 'transition': add('Fitting', T.name + sys, `${sz(n.w, n.h, n.shape)} → ${sz(n.w2, n.h2, n.shape)}`, 1, 'bh'); break;
      case 'tee': case 'takeoff': add('Fitting', T.name + sys, `${sz(n.w, n.h, n.shape)} / cabang ${sz(n.bw, n.bh, n.shape)}`, 1, 'bh'); break;
      case 'endcap': case 'damper': case 'accessdoor': add('Perlengkapan', T.name + sys, sz(n.w, n.h, n.shape), 1, 'bh'); break;
      case 'diffuser': case 'louver': add('Perlengkapan', T.name + sys, `${n.F}×${n.F} mm`, 1, 'bh'); break;
      case 'grille': add('Perlengkapan', T.name + sys, `${n.Fx}×${n.Fy} mm`, 1, 'bh'); break;
      case 'fan': case 'fcu': case 'outdoor': add('Equipment', T.name, n.tag || '', 1, 'unit'); break;
    }
    if (T.duct) hang += worldPrims(n, c).filter(pr => pr.layer === 'hanger' && pr.k === 'l').length; // tiap titik gantungan = 1 garis
  }
  if (hang) add('Perlengkapan', 'Gantungan duct (rod + support)', c.hang && c.hang.sp ? `tiap ${c.hang.sp} mm` : '', hang, 'titik');
  return [...rows.values()]
    .map(r => ({ ...r, qty: r.unit === 'm' ? Math.round(r.qty * 10) / 10 : r.qty }))
    .sort((a, b) => BOQ_ORDER.indexOf(a.kat) - BOQ_ORDER.indexOf(b.kat) || a.item.localeCompare(b.item) || a.spec.localeCompare(b.spec, 'id', { numeric: true }));
}
// CSV untuk Excel (pemisah ; dan koma desimal, seperti Excel berbahasa Indonesia)
const boqCSV = rows => '﻿' + [['Kategori', 'Item', 'Spesifikasi', 'Jumlah', 'Satuan'], ...rows.map(r => [r.kat, r.item, r.spec, String(r.qty).replace('.', ','), r.unit])]
  .map(r => r.map(v => /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(';')).join('\r\n');

// ---- Simpan di browser (localStorage) ----
const KEY = 'temandor.p.';
function listProjects() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(KEY)) try { out.push(withLayers(JSON.parse(localStorage.getItem(k)))); } catch { /* data rusak dilewati */ }
  }
  return out.sort((a, b) => b.updated - a.updated);
}
const loadProject = id => { try { return withLayers(JSON.parse(localStorage.getItem(KEY + id))); } catch { return null; } };
function saveProject(p) { p.updated = Date.now(); localStorage.setItem(KEY + p.id, JSON.stringify(p)); }
const deleteProject = id => localStorage.removeItem(KEY + id);

// File .json dari luar: ambil hanya komponen yang dikenal, beri id baru.
function importProject(o) {
  if (!o || !Array.isArray(o.nodes)) throw new Error('Bukan file proyek Temandor');
  const p = newProject({ name: String(o.name || 'Proyek impor'), unit: o.unit === 'mm' ? 'mm' : 'inch', scale: o.scale || '1:100' });
  p.hang = { on: !!(o.hang ? o.hang.on : true), sp: +(o.hang && o.hang.sp) || 1500 };
  if (o.layers) for (const [k] of LAYERS) if (o.layers[k]) p.layers[k] = { on: !!o.layers[k].on, lock: !!o.layers[k].lock };
  p.nodes = o.nodes.filter(n => n && TYPES[n.type] && isFinite(n.x) && isFinite(n.y)).map(n => ({ ...mk(n.type), ...n, id: uid() }));
  return p;
}

// ---- Proyek contoh ----
function demoProject() {
  const p = newProject({ name: 'Contoh – Kantor Lt. 2', unit: 'inch', scale: '1:100', W: 9000, H: 9000 });
  const U = p.unit, N = p.nodes;
  N[0].name = 'Kantor';
  N.push(mk('room', { x: 8850, W: 5150, H: 5650, name: 'R. Rapat', dims: false }), mk('room', { x: 8850, y: 5500, W: 2650, H: 3500, name: 'Pantry', dims: false }), mk('room', { x: 11350, y: 5500, W: 2650, H: 3500, name: 'Toilet', dims: false }));
  const put = (type, o, pid, t, tpid) => { const n = mk(type, o); if (t) attach(n, pid, worldPorts(t, U).find(q => q.id === tpid), U); N.push(n); return n; };

  const fcu = put('fcu', { x: 1400, y: 1500 });
  put('outdoor', { x: -800, y: 1500, rot: 90 });
  const s1 = put('straight', { L: 1200 }, 'a', fcu, 's');
  const to = put('takeoff', {}, 'a', s1, 'b');
  put('straight', { L: 700, w: 12, h: 10 }, 'a', to, 'c');                     // sengaja: ujung terbuka
  const s1b = put('straight', { L: 1000 }, 'a', to, 'b');
  const t1 = put('tee', {}, 'a', s1b, 'b');
  const b1 = put('straight', { L: 1600, w: 12, h: 10 }, 'a', t1, 'c');
  put('diffuser', { flow: 350 }, 'a', b1, 'b');
  const s2 = put('straight', { L: 1500 }, 'a', t1, 'b');
  const t2 = put('tee', {}, 'a', s2, 'b');
  const b2 = put('straight', { L: 1600, w: 12, h: 10 }, 'a', t2, 'c');
  put('diffuser', { flow: 350 }, 'a', b2, 'b');
  const s3 = put('straight', { L: 800 }, 'a', t2, 'b');
  const tr = put('transition', {}, 'a', s3, 'b');
  const s4 = put('straight', { L: 2400, w: 18, h: 14 }, 'a', tr, 'b');
  const e1 = put('elbow', { w: 18, h: 14 }, 'a', s4, 'b');
  const s5 = put('straight', { L: 900, w: 18, h: 14 }, 'a', e1, 'b');
  const t3 = put('tee', { w: 18, h: 14, mir: true }, 'a', s5, 'b');
  const b3 = put('straight', { L: 900, w: 12, h: 10 }, 'a', t3, 'c');
  put('diffuser', { flow: 300 }, 'a', b3, 'b');
  const s6 = put('straight', { L: 600, w: 18, h: 14 }, 'a', t3, 'b');
  const s7 = put('straight', { L: 500, w: 14, h: 12 }, 'a', s6, 'b');          // sengaja: ukuran beda tanpa transisi
  put('diffuser', { flow: 300 }, 'a', s7, 'b');

  const lv = put('louver', { x: 13850, y: 7200 });
  const fan = put('fan', {}, 'b', lv, 'a');
  const ea = put('straight', { L: 700, w: 10, h: 8, sys: 'EA' }, 'b', fan, 'a');
  put('grille', { flow: 150 }, 'a', ea, 'a');
  return p;
}
