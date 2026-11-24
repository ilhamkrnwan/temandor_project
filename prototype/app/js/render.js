// Temandor – primitive → SVG. Dipakai kanvas editor, thumbnail beranda, export PNG/PDF.
const PAL = {
  screen: { bg: '#14171b', wall: '#242930', col: { sa: '#4ea1ff', ea: '#f472b6', eq: '#4ade80', diff: '#22d3ee', hanger: '#8b95a3', dim: '#9aa3ad', denah: '#6b7480', kolom: '#a3acb8', bukaan: '#c4b5fd', arsi: '#8792a0', coret: '#fb923c' },
    lbl: { sa: '#9cc8ff', ea: '#f9a8d4', eq: '#86efac', diff: '#67e8f9', hanger: '#8b95a3', dim: '#c3c9d0', denah: '#7d8692', kolom: '#c3c9d0', bukaan: '#ddd6fe', arsi: '#aab3bf', coret: '#fdba74' } },
  paper: { bg: '#ffffff', wall: '#e8ebef', col: { sa: '#1d4ed8', ea: '#be185d', eq: '#15803d', diff: '#0e7490', hanger: '#64748b', dim: '#334155', denah: '#475569', kolom: '#1e293b', bukaan: '#6d28d9', arsi: '#64748b', coret: '#c2410c' },
    lbl: { sa: '#1d4ed8', ea: '#be185d', eq: '#15803d', diff: '#0e7490', hanger: '#64748b', dim: '#1e293b', denah: '#475569', kolom: '#1e293b', bukaan: '#6d28d9', arsi: '#475569', coret: '#c2410c' } },
};
// Warna pilihan teks/catatan. Nama sama di semua tema; nilainya disesuaikan supaya tetap terbaca
// ("putih" di kertas jadi hitam, seperti warna 7 di AutoCAD). Nomor warna DXF: PICK_ACI di dxf.js.
PAL.screen.pick = { merah: '#f87171', kuning: '#facc15', hijau: '#4ade80', biru: '#60a5fa', putih: '#f3f4f6' };
PAL.paper.pick = { merah: '#dc2626', kuning: '#a16207', hijau: '#15803d', biru: '#1d4ed8', putih: '#111827' };
// Kanvas terang: warna garis seperti kertas, latar sedikit abu supaya tidak silau
PAL.light = { ...PAL.paper, bg: '#f6f7f9', wall: '#e2e6eb' };
const f1 = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ptsD = (pts, close) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');

// o: { pal, sw (tebal garis), live (true = garis tetap tipis berapa pun zoom) }
function primSVG(pr, layer, o) {
  const pal = PAL[o.pal], col = pr.col ? pal.pick[pr.col] : pal.col[layer], w = o.sw * (pr.j ? 0.65 : 1);
  const fl = pr.fill === 'wall' ? pal.wall : pr.fill ? pal.bg : 'none';  // fill: 'wall' = arsir dinding, lainnya = warna latar (menutup)
  const st = pr.nostroke ? `class="wall" stroke="none" fill="${fl}"` : `stroke="${col}" stroke-width="${f1(w * 100) / 100}" fill="${fl}"${pr.dash ? ` stroke-dasharray="${f1(o.sw * 6)} ${f1(o.sw * 4)}"` : ''}`;
  switch (pr.k) {
    case 'l': return `<path d="M${f1(pr.a[0])} ${f1(pr.a[1])}L${f1(pr.b[0])} ${f1(pr.b[1])}" ${st}/>`;
    case 'pl': return `<path d="${ptsD(pr.pts, pr.closed)}" ${st}/>`;
    case 'ring': return `<path class="wall" d="${ptsD(pr.outer, 1)}${ptsD(pr.inner, 1)}" fill-rule="evenodd" fill="${pal.wall}" ${pr.nostroke ? 'stroke="none"' : `stroke="${col}" stroke-width="${w}"`}/>`;
    case 'c': return `<circle cx="${f1(pr.c[0])}" cy="${f1(pr.c[1])}" r="${f1(pr.r)}" ${st}/>`;
    case 'arc': {
      const P = a => [pr.c[0] + pr.r * Math.cos(a * RAD), pr.c[1] + pr.r * Math.sin(a * RAD)], p0 = P(pr.a0), p1 = P(pr.a1);
      return `<path d="M${f1(p0[0])} ${f1(p0[1])}A${f1(pr.r)} ${f1(pr.r)} 0 ${pr.a1 - pr.a0 > 180 ? 1 : 0} 1 ${f1(p1[0])} ${f1(p1[1])}" ${st}/>`;
    }
    case 'arrow': {
      const u = rotP([1, 0], pr.dir), v = [-u[1], u[0]], h = pr.h, b = [pr.p[0] - u[0] * h / 2, pr.p[1] - u[1] * h / 2];
      return `<path class="arw" d="${ptsD([[pr.p[0] + u[0] * h / 2, pr.p[1] + u[1] * h / 2], [b[0] + v[0] * h * 0.35, b[1] + v[1] * h * 0.35], [b[0] - v[0] * h * 0.35, b[1] - v[1] * h * 0.35]], 1)}" fill="${col}" stroke="none"/>`;
    }
    case 't': {
      const tr = pr.rot ? ` transform="rotate(${f1(pr.rot)} ${f1(pr.p[0])} ${f1(pr.p[1])})"` : '';
      const sty = (pr.b ? ' font-weight="700"' : '') + (pr.it ? ' font-style="italic"' : '') + (pr.ul ? ' text-decoration="underline"' : '');
      return `<text x="${f1(pr.p[0])}" y="${f1(pr.p[1])}" font-size="${f1(pr.h)}" text-anchor="${pr.anchor}" fill="${pr.col ? pal.pick[pr.col] : pal.lbl[layer]}"${sty}${tr}>${esc(pr.s)}</text>`;
    }
    case 'hit': return o.live ? `<path class="hit" d="${ptsD(pr.pts, 1)}" fill="transparent" stroke="none"/>` : '';
  }
  return '';
}

// Satu node → { layer: '<g …>…</g>' } (node bisa punya primitive di beberapa layer, mis. gantungan)
function nodeSVG(n, c, o, extraCls = '') {
  const base = layerOf(n), parts = {};
  for (const pr of worldPrims(n, c)) { const L = pr.layer || base; (parts[L] = parts[L] || []).push(primSVG(pr, L, o)); }
  const out = {};
  for (const L in parts) out[L] = `<g data-id="${n.id}"${extraCls ? ` class="${extraCls}"` : ''}>${parts[L].join('')}</g>`;
  return out;
}

// Seluruh proyek, dikelompokkan per layer (urutan: denah paling bawah)
const DRAW_ORDER = ['denah', 'arsi', 'kolom', 'bukaan', 'dim', 'hanger', 'eq', 'diff', 'sa', 'ea', 'coret'];
function projectSVG(p, c, o) {
  const buckets = Object.fromEntries(DRAW_ORDER.map(k => [k, []]));
  for (const n of p.nodes) {
    const parts = nodeSVG(n, c, o, o.sel && o.sel.has(n.id) ? 'sel' : '');
    for (const L in parts) if (p.layers[L] ? p.layers[L].on : true) buckets[L].push(parts[L]);
  }
  return DRAW_ORDER.map(k => `<g data-layer="${k}"${p.layers[k] && p.layers[k].lock ? ' class="lock"' : ''}>${buckets[k].join('')}</g>`).join('');
}

// Dokumen SVG mandiri (thumbnail / PNG / PDF). opt: { pal, layers:Set|null, note }
function docSVG(p, opt = {}) {
  const cn = connect(p), c = ctxOf(p, cn), pal = opt.pal || 'paper';
  const q = { ...p, layers: Object.fromEntries(LAYERS.map(([k]) => [k, { on: opt.layers ? opt.layers.has(k) : p.layers[k].on, lock: false }])) };
  const b = projectBounds(p, c), m = c.th * 3, note = opt.note ? c.th * 3 : 0;
  const vb = [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m + note];
  const sw = opt.sw || vb[2] / 900;
  const body = projectSVG(q, c, { pal, sw, live: false });
  const noteSVG = opt.note ? `<text x="${f1(b[0])}" y="${f1(b[3] + m + note * 0.5)}" font-size="${f1(c.th * 0.9)}" fill="${PAL[pal].lbl.dim}">Sketsa bantu Temandor – cek ulang ukuran di lapangan. ${esc(p.name)} · ${p.scale} · duct ${p.unit}</text>` : '';
  return { vb, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f1).join(' ')}" font-family="'JetBrains Mono', ui-monospace, monospace"><rect x="${f1(vb[0])}" y="${f1(vb[1])}" width="${f1(vb[2])}" height="${f1(vb[3])}" fill="${PAL[pal].bg}"/>${body}${noteSVG}</svg>` };
}
