// Temandor – geometri komponen parametrik.
// Dunia dalam mm, sumbu Y ke bawah (sama dengan SVG). Sudut dalam derajat: 0 = kanan, 90 = bawah.
// Ukuran duct (w, h) disimpan dalam satuan proyek (inch / mm) dan baru dikonversi ke mm saat digambar.
// Tiap komponen: titik asal (x, y), rot, mir (cermin sumbu Y lokal), plus parameter tipe.

const RAD = Math.PI / 180;
const norm = a => ((a % 360) + 540) % 360 - 180;           // (-180, 180]
const rotP = ([x, y], d) => { const c = Math.cos(d * RAD), s = Math.sin(d * RAD); return [x * c - y * s, x * s + y * c]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
const mmOf = (v, unit) => unit === 'inch' ? v * 25.4 : v;

function sizeLabel(w, h, shape, unit) {
  const q = unit === 'inch' ? '"' : '';
  return shape === 'round' ? `Ø${w}${q}` : `${w}${q}x${h}${q}`;
}

// ---- Primitive (koordinat lokal) ----
const ln = (x1, y1, x2, y2, o) => ({ k: 'l', a: [x1, y1], b: [x2, y2], ...o });
const pl = (pts, o) => ({ k: 'pl', pts, ...o });
const rect = (x, y, w, h, o) => pl([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { closed: true, ...o });
const arc = (c, r, a0, a1, o) => ({ k: 'arc', c, r, a0, a1, ...o });
const cir = (c, r, o) => ({ k: 'c', c, r, ...o });
const txt = (x, y, s, h, o) => ({ k: 't', p: [x, y], s: String(s), h, rot: 0, anchor: 'middle', ...o });
const arrow = (x, y, dir, h) => ({ k: 'arrow', p: [x, y], dir, h });
const hit = pts => ({ k: 'hit', pts });
const hitR = (x, y, w, h) => hit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const lbl = { lbl: 1 };

// Port: titik sambung. keys = properti ukuran yang diwakili port ini (untuk salin ukuran saat menempel).
function port(id, x, y, dir, n, o = {}) {
  const keys = o.keys || ['w', 'h'];
  return { id, x, y, dir, w: n[keys[0]], h: n[keys[1]], shape: n.shape, keys, ...o };
}
const anyPort = (id, x, y, dir, o) => ({ id, x, y, dir, any: true, keys: null, ...o });

// Badan duct lurus/mengecil: dua garis + garis sambungan di ujung
function body(len, W1, W2 = W1) {
  return [
    ln(0, -W1 / 2, len, -W2 / 2), ln(0, W1 / 2, len, W2 / 2),
    ln(0, -W1 / 2, 0, W1 / 2, { j: 1 }), ln(len, -W2 / 2, len, W2 / 2, { j: 1 }),
    hit([[0, -W1 / 2], [len, -W2 / 2], [len, W2 / 2], [0, W1 / 2]]),
  ];
}

// Label ukuran + panah aliran di tengah segmen
function annotate(out, n, c, len, W) {
  const s = sizeLabel(n.w, n.h, n.shape, c.unit);
  if (len > s.length * c.th * 0.65) out.push(txt(len / 2, -W / 2 - c.th * 0.35, s, c.th, lbl));
  if (len > c.th * 2.2) out.push(arrow(len / 2, 0, n.flip ? 180 : 0, Math.min(c.th * 0.8, W * 0.7)));
}

// Teks bergaya (komponen Teks & Catatan): ukuran = th (mm) atau faktor tz × tinggi teks skala gambar.
// Lebar diperkirakan dari font mono (±0,62 em per huruf) untuk kotak latar & area klik.
const textH = (n, c) => n.th || c.th * (+n.tz || 1);
function styledText(n, c, x, y, anchor) {
  const h = textH(n, c), w = Math.max(h, String(n.s).length * h * 0.62), x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const col = n.col ? { col: n.col } : {}, p = h * 0.3, out = [];
  if (n.bx) out.push(rect(x0 - p, y - h * 0.95, w + 2 * p, h * 1.3, { fill: 1, ...col })); // kotak berlatar: teks terbaca di atas garis duct
  out.push(txt(x, y, n.s, h, { anchor, b: n.b, it: n.it, ul: n.ul, ...col, ...lbl }), hitR(x0, y - h, w, h * 1.25));
  return out;
}

// Gantungan otomatis di sepanjang duct (layer HANGER)
function hangers(len, W, c) {
  if (!c.hang || !c.hang.on || !(c.hang.sp > 0)) return [];
  const out = [], e = W / 2 + Math.max(40, W * 0.15), o = { layer: 'hanger' }, r = Math.max(18, c.th * 0.12);
  for (let s = Math.min(c.hang.sp / 2, len / 2); s < len; s += c.hang.sp) {
    out.push(ln(s, -e, s, e, o), cir([s, -e], r, { ...o, fill: 1 }), cir([s, e], r, { ...o, fill: 1 }));
  }
  return out;
}

// Garis ukur dari (0,0) ke (len,0), garis dimensi di y = off
function dimPrims(len, off, th, o = {}) {
  const sg = off < 0 ? -1 : 1, g = th * 0.25, t = th * 0.25;
  return [
    ln(0, sg * g, 0, off + sg * g, o), ln(len, sg * g, len, off + sg * g, o),
    ln(-g, off, len + g, off, o),
    ln(-t, off + t, t, off - t, o), ln(len - t, off + t, len + t, off - t, o),
    txt(len / 2, off < 0 ? off - th * 0.3 : off + th * 1.05, Math.round(Math.abs(len)), th, { ...o, ...lbl }), // teks di sisi luar garis
  ];
}

// Ubah primitive lokal → dunia sesuai x, y, rot, mir (dipakai juga untuk sub-transform)
function xformPrims(prims, x, y, r, mir) {
  const P = p => { const q = rotP(mir ? [p[0], -p[1]] : p, r); return [q[0] + x, q[1] + y]; };
  return prims.map(pr => {
    switch (pr.k) {
      case 'l': return { ...pr, a: P(pr.a), b: P(pr.b) };
      case 'pl': case 'hit': return { ...pr, pts: pr.pts.map(P) };
      case 'ring': return { ...pr, outer: pr.outer.map(P), inner: pr.inner.map(P) };
      case 'c': return { ...pr, c: P(pr.c) };
      case 'arc': { const [a0, a1] = mir ? [-pr.a1, -pr.a0] : [pr.a0, pr.a1]; return { ...pr, c: P(pr.c), a0: a0 + r, a1: a1 + r }; }
      case 'arrow': return { ...pr, p: P(pr.p), dir: norm((mir ? -pr.dir : pr.dir) + r) };
      case 't': {
        if (pr.box) { // label komponen: selalu mendatar, tepat di bawah badan komponen (berapa pun rotasinya)
          const a = r * RAD, hh = Math.abs(Math.sin(a)) * pr.box[0] / 2 + Math.abs(Math.cos(a)) * pr.box[1] / 2, c = P(pr.p);
          return { ...pr, p: [c[0], c[1] + hh + pr.gap], rot: 0 };
        }
        const t = norm((mir ? -pr.rot : pr.rot) + r), p = P(pr.p);
        if (t < 90 && t >= -90) return { ...pr, p, rot: t };
        // Teks dibalik 180° supaya terbaca (kiri→kanan / bawah→atas). Geser baseline & tukar anchor
        // supaya teks tetap menempati sisi yang sama (tidak menimpa garis duct).
        const u = rotP([0, -pr.h * 0.75], t);
        return { ...pr, p: [p[0] + u[0], p[1] + u[1]], rot: norm(t + 180), anchor: { start: 'end', end: 'start' }[pr.anchor] || pr.anchor };
      }
    }
    return pr;
  });
}

const W_ = (n, c) => mmOf(n.w, c.unit);

// ---- Grip ukuran (seperti handle resize di Canva) ----
// 'w' = tepi duct: lebar ikut jarak ke garis tengah, rasio W:H tetap. Dibulatkan 1" / 50 mm.
function widthGrip(n, l, u, kw = 'w', kh = 'h') {
  const st = u === 'mm' ? 50 : 1, r = v => Math.max(st * 2, Math.round(v / st) * st);
  const w = r(2 * Math.abs(l[1]) / (u === 'mm' ? 1 : 25.4));
  if (n.shape !== 'round') n[kh] = r(n[kh] * w / n[kw]);
  n[kw] = w;
}
const g50 = v => Math.max(100, Math.round(Math.abs(v) / 50) * 50);
const lenGrips = (n, u) => [['a', 0, 0], ['b', n.L, 0], ['w', n.L / 2, mmOf(n.w, u) / 2]];
const edgeGrip = (n, u) => [['w', 0, -mmOf(n.w, u) / 2]];
function lenGrip(n, id, l, g, u) {
  if (id === 'w') return widthGrip(n, l, u);
  if (id === 'b') n.L = Math.max(20, Math.round(l[0]));
  else { const d = Math.min(Math.round(l[0]), n.L - 20); moveLocal(n, d, 0); n.L -= d; }
}

// ---- Ruangan poligon ----
// Ruangan lama hanya punya W×H; begitu bentuknya diedit, titik sudut disimpan di n.pts (koordinat lokal, min = 0).
const roomPts = n => n.pts || [[0, 0], [n.W, 0], [n.W, n.H], [0, n.H]];
function polyArea(P) { let a = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a / 2; }
// Garis dalam dinding setebal t (sambungan miter di tiap sudut)
function insetPoly(P, t) {
  const s = Math.sign(polyArea(P)) || 1, N = P.length;
  const nrm = (a, b) => { const d = dist(a, b) || 1; return [-(b[1] - a[1]) / d * s, (b[0] - a[0]) / d * s]; };
  return P.map((p, i) => {
    const n1 = nrm(P[(i + N - 1) % N], p), n2 = nrm(p, P[(i + 1) % N]), k = t / (1 + n1[0] * n2[0] + n1[1] * n2[1] || 1);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
}
function setRoom(n, P) {
  P = P.filter((p, i) => dist(p, P[(i + 1) % P.length]) >= 1);
  if (P.length < 3) return;
  const x0 = Math.min(...P.map(p => p[0])), y0 = Math.min(...P.map(p => p[1]));
  moveLocal(n, x0, y0);
  n.pts = P.map(p => [p[0] - x0, p[1] - y0]);
  n.W = Math.max(...n.pts.map(p => p[0])); n.H = Math.max(...n.pts.map(p => p[1]));
}
// Ubah panjang/lebar dari panel: bentuk diskalakan
function resizeRoom(n, k, v) {
  if (n.pts) { const i = k === 'W' ? 0 : 1, f = v / (n[k] || 1); n.pts = n.pts.map(p => (i ? [p[0], Math.round(p[1] * f)] : [Math.round(p[0] * f), p[1]])); }
  n[k] = v;
}
// Bentuk siap pakai (dalam kotak 6 × 5, diskalakan ke W × H ruangan)
const ROOM_SHAPES = {
  rect: ['Persegi', null],
  L: ['Bentuk L', [[0, 0], [3, 0], [3, 2.5], [6, 2.5], [6, 5], [0, 5]]],
  T: ['Bentuk T', [[0, 0], [6, 0], [6, 2], [4, 2], [4, 5], [2, 5], [2, 2], [0, 2]]],
  U: ['Bentuk U', [[0, 0], [2, 0], [2, 3], [4, 3], [4, 0], [6, 0], [6, 5], [0, 5]]],
};
function roomShape(n, k) {
  const S = ROOM_SHAPES[k][1];
  if (!S) { delete n.pts; return; }
  setRoom(n, S.map(([x, y]) => [Math.round(x * n.W / 6), Math.round(y * n.H / 5)]));
}
// Garis lurus dari s0 ke s1 sepanjang u, dengan celah (pintu/jendela) dibuang
function gapLines(o, p, u, off, s0, s1, gaps) {
  const at = t => [p[0] + u[0] * t + off[0], p[1] + u[1] * t + off[1]];
  let s = s0;
  for (const [g0, g1] of gaps) {
    if (g0 > s) o.push(ln(...at(s), ...at(Math.min(g0, s1))));
    s = Math.max(s, g1);
    if (s >= s1) return;
  }
  o.push(ln(...at(s), ...at(s1)));
}
// Titik potong ruas a-b dengan c-d → parameter t di a-b (0..1), atau null
function segX(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const q = [c[0] - a[0], c[1] - a[1]], t = (q[0] * s[1] - q[1] * s[0]) / den, v = (q[0] * r[1] - q[1] * r[0]) / den;
  return t > 0 && t < 1 && v >= 0 && v <= 1 ? t : null;
}
function inPoly(p, P) {
  let ins = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
const polyHit = (A, B) => A.some(p => inPoly(p, B)) || B.some(p => inPoly(p, A)) ||
  A.some((a, i) => B.some((c, j) => segX(a, A[(i + 1) % A.length], c, B[(j + 1) % B.length]) != null));

// ---- Elemen arsitektur ----
// Pintu/jendela/bukaan: lokal x = sepanjang dinding (0..dw), y = 0 muka luar → t muka dalam ruangan.
const HOSTED = new Set(['door', 'win', 'opening']);
function jambs(n) {
  return [pl([[0, 0], [n.dw, 0], [n.dw, n.t], [0, n.t]], { closed: true, fill: 'bg', nostroke: 1 }), ln(0, 0, 0, n.t), ln(n.dw, 0, n.dw, n.t), hitR(0, 0, n.dw, n.t)];
}
const openGrips = n => [['s', n.dw, n.t / 2]];
const openGrip = (n, id, l) => { n.dw = Math.max(300, Math.round(l[0] / 50) * 50); };
// Daun pintu: engsel di (hx, y0), tertutup ke arah sx, membuka ke arah sy
function leaf(o, hx, sx, y0, sy, r) {
  const ax = sx > 0 ? 0 : 180, ay = sx < 0 && sy < 0 ? 270 : sy > 0 ? 90 : -90;
  o.push(ln(hx, y0, hx, y0 + sy * r), arc([hx, y0], r, Math.min(ax, ay), Math.max(ax, ay), { j: 1 }));
}
// Grip ujung untuk elemen garis (partisi, balok, garis ukur)
function endGrip(n, id, l, g) {
  const p1 = [n.x, n.y], p2 = localToWorld(n, [n.L, 0]);
  const [a, b] = id === 'p1' ? [g, p2] : [p1, g];
  if (dist(a, b) < 10) return;
  n.x = a[0]; n.y = a[1]; n.rot = angOf(a, b); n.L = Math.round(dist(a, b));
}
const centerGrip = (kw, kd) => ({ grips: n => [['s', n[kw] / 2, n[kd] / 2]], grip(n, id, l) { n[kw] = g50(2 * l[0]); n[kd] = g50(2 * l[1]); } });
const tag = (s, n, c, w, d) => txt(0, 0, s, c.th * 0.8, { box: [w, d], gap: c.th * 1.1, ...lbl });

// ---- Definisi tipe komponen ----
// layer(n), def, ports(n, unit), prims(n, ctx), grips(n, unit) → [[id, x, y]], grip(n, id, local, world, unit)
const TYPES = {
  straight: {
    name: 'Duct lurus', icon: 'duct-lurus', duct: 1,
    def: { L: 1500, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700, flip: false },
    f: ['sys', 'size', 'L', 'elev'],
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = W_(n, c), o = body(n.L, W); annotate(o, n, c, n.L, W);
      for (const x of (c.pen && c.pen[n.id]) || []) o.push(rect(x - 60, -W / 2 - 60, 120, W + 120, { j: 1 })); // tembus dinding: bobokan
      return o.concat(hangers(n.L, W, c));
    },
    grips: lenGrips, grip: lenGrip,
  },
  flex: {
    name: 'Flexible', icon: 'flexible', duct: 1,
    def: { L: 1200, w: 8, h: 8, shape: 'round', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'L', 'elev'],
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = W_(n, c), a = W * 0.1, lam = Math.max(W * 0.7, 60), steps = Math.max(4, Math.ceil(n.L / (lam / 6)));
      const t = [], b = [];
      for (let i = 0; i <= steps; i++) { const x = n.L * i / steps, y = Math.sin(x / lam * 2 * Math.PI) * a; t.push([x, -W / 2 + y]); b.push([x, W / 2 - y]); }
      const o = [pl(t), pl(b), ln(0, -W / 2, 0, W / 2, { j: 1 }), ln(n.L, -W / 2, n.L, W / 2, { j: 1 }), hitR(0, -W / 2, n.L, W)];
      if (n.L > c.th * 4) o.push(txt(n.L / 2, -W / 2 - c.th * 0.35, sizeLabel(n.w, n.h, 'round', c.unit) + ' flex', c.th, lbl));
      return o;
    },
    grips: lenGrips, grip: lenGrip,
  },
  elbow: {
    name: 'Elbow', icon: 'elbow-90', duct: 1, mirror: 1,
    // et: 'r' = radius (rr × lebar, 1 atau 1.5), 'sq' = siku + sudu pengarah (vane).
    // w2/h2 = ukuran ujung b (elbow mengecil/reducing); kosong = sama dengan ujung a.
    def: { w: 24, h: 20, w2: null, h2: null, shape: 'rect', angle: 90, et: 'r', rr: '1', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'size2', 'angle', 'et', 'rr', 'elev'],
    geo(n, u) {
      const W1 = mmOf(n.w, u), W2 = mmOf(n.w2 ?? n.w, u), a = n.angle;
      if (n.et === 'sq') { // garis tengah: lurus d → belok a → lurus d (sudut di K)
        const d = Math.max(W1, W2) / 2 * Math.tan(a * RAD / 2) + 75; // +75 mm leher supaya ada tempat sambungan
        return { W1, W2, a, sq: 1, d, K: [d, 0], end: [d + d * Math.cos(a * RAD), d * Math.sin(a * RAD)] };
      }
      const R = (+n.rr || 1) * Math.max(W1, W2); // radius garis tengah; ≥ lebar terbesar supaya sisi dalam tidak terbalik
      return { W1, W2, a, R, C: [0, R], end: [R * Math.sin(a * RAD), R - R * Math.cos(a * RAD)] };
    },
    ports(n, u) {
      const g = this.geo(n, u);
      // Belum reducing: ujung b mewakili ukuran utama (menempel = salin ke seluruh elbow, seperti sebelumnya)
      return [port('a', 0, 0, 180, n), n.w2 == null ? port('b', g.end[0], g.end[1], n.angle, n) : port('b', g.end[0], g.end[1], n.angle, n, { keys: ['w2', 'h2'] })];
    },
    prims(n, c) {
      const g = this.geo(n, c.unit), { W1, W2, a } = g;
      if (g.sq) {
        // Dinding = garis offset ±W/2 tiap kaki, bertemu di garis miter (sudut luar & dalam)
        const u2 = [Math.cos(a * RAD), Math.sin(a * RAD)], nm2 = [-u2[1], u2[0]];
        const meet = s => { // s = -1 sisi luar, +1 sisi dalam
          const y1 = s * W1 / 2, o2 = [g.K[0] + nm2[0] * s * W2 / 2, g.K[1] + nm2[1] * s * W2 / 2];
          const t = Math.abs(u2[1]) < 1e-9 ? 0 : (y1 - o2[1]) / u2[1];
          return [o2[0] + u2[0] * t, y1];
        };
        const Oc = meet(-1), Ic = meet(1), Ep = g.end, eo = [Ep[0] - nm2[0] * W2 / 2, Ep[1] - nm2[1] * W2 / 2], ei = [Ep[0] + nm2[0] * W2 / 2, Ep[1] + nm2[1] * W2 / 2];
        const out = [pl([[0, -W1 / 2], Oc, eo]), pl([[0, W1 / 2], Ic, ei]), ln(0, -W1 / 2, 0, W1 / 2, { j: 1 }), ln(eo[0], eo[1], ei[0], ei[1], { j: 1 })];
        // Sudu pengarah: busur kecil sepanjang garis miter, tiap ±100 mm (min. 2)
        const k = Math.max(2, Math.round(dist(Ic, Oc) / 100)), v = Math.min(W1, W2) / 6;
        for (let i = 1; i <= k; i++) {
          const P = [Ic[0] + (Oc[0] - Ic[0]) * i / (k + 1), Ic[1] + (Oc[1] - Ic[1]) * i / (k + 1)], m = (-90 + a / 2) * RAD;
          out.push(arc([P[0] - v * Math.cos(m), P[1] - v * Math.sin(m)], v, -90, -90 + a, { j: 1 }));
        }
        out.push(hit([[0, -W1 / 2], Oc, eo, ei, Ic, [0, W1 / 2]]));
        return out;
      }
      const { R, C } = g, a1 = -90 + a, at = (r, d) => [C[0] + r * Math.cos(d * RAD), C[1] + r * Math.sin(d * RAD)];
      const half = t => (W1 + (W2 - W1) * t) / 2; // lebar berubah merata di sepanjang lengkung (reducing)
      const outer = [], inner = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16, d = -90 + a * t; outer.push(at(R + half(t), d)); inner.push(at(R - half(t), d)); }
      const p1 = outer[16], p2 = inner[16];
      const walls = W1 === W2 ? [arc(C, R + W1 / 2, -90, a1), arc(C, R - W1 / 2, -90, a1)] : [pl(outer), pl(inner)]; // sama lebar: ARC asli di DXF
      return [...walls, ln(0, -W1 / 2, 0, W1 / 2, { j: 1 }), ln(p1[0], p1[1], p2[0], p2[1], { j: 1 }), hit([...outer, ...inner.reverse()])];
    },
    grips: edgeGrip, grip: (n, id, l, g, u) => widthGrip(n, l, u),
  },
  transition: {
    name: 'Transisi', icon: 'transisi', duct: 1,
    def: { L: 300, w: 24, h: 20, w2: 18, h2: 14, shape: 'rect', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'size2', 'L', 'elev'],
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n, { keys: ['w2', 'h2'] })],
    prims(n, c) { return body(n.L, W_(n, c), mmOf(n.w2, c.unit)); },
    grips: (n, u) => [['b', n.L, 0], ['w', 0, -mmOf(n.w, u) / 2], ['w2', n.L, -mmOf(n.w2, u) / 2]],
    grip(n, id, l, g, u) { if (id === 'b') n.L = Math.max(50, Math.round(l[0])); else if (id === 'w') widthGrip(n, l, u); else widthGrip(n, l, u, 'w2', 'h2'); },
  },
  tee: {
    name: 'T', icon: 'tee', duct: 1, mirror: 1,
    def: { w: 24, h: 20, bw: 12, bh: 10, shape: 'rect', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'bsize', 'elev'],
    geo(n, u) { const W = mmOf(n.w, u), B = mmOf(n.bw, u); return { W, B, Lm: B + 300, Lb: 150 }; },
    ports(n, u) { const g = this.geo(n, u); return [port('a', 0, 0, 180, n), port('b', g.Lm, 0, 0, n), port('c', g.Lm / 2, g.W / 2 + g.Lb, 90, n, { keys: ['bw', 'bh'] })]; },
    prims(n, c) {
      const { W, B, Lm, Lb } = this.geo(n, c.unit), m = Lm / 2, y = W / 2;
      return [
        ln(0, -y, Lm, -y), pl([[0, y], [m - B / 2, y], [m - B / 2, y + Lb]]), pl([[m + B / 2, y + Lb], [m + B / 2, y], [Lm, y]]),
        ln(0, -y, 0, y, { j: 1 }), ln(Lm, -y, Lm, y, { j: 1 }), ln(m - B / 2, y + Lb, m + B / 2, y + Lb, { j: 1 }),
        hitR(0, -y, Lm, W), hitR(m - B / 2, y, B, Lb),
      ];
    },
    grips: edgeGrip, grip: (n, id, l, g, u) => widthGrip(n, l, u),
  },
  takeoff: {
    name: 'Cabang 45°', icon: 'cabang', duct: 1, mirror: 1,
    def: { w: 24, h: 20, bw: 12, bh: 10, shape: 'rect', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'bsize', 'elev'],
    geo(n, u) {
      const W = mmOf(n.w, u), B = mmOf(n.bw, u), k = Math.SQRT1_2, x0 = 150 + B * k, Lb = B * k + 200;
      return { W, B, k, x0, Lb, Lm: x0 + B * k + 150, P: [x0 + Lb * k, W / 2 + Lb * k] };
    },
    ports(n, u) { const g = this.geo(n, u); return [port('a', 0, 0, 180, n), port('b', g.Lm, 0, 0, n), port('c', g.P[0], g.P[1], 45, n, { keys: ['bw', 'bh'] })]; },
    prims(n, c) {
      const { W, B, k, x0, Lm, P } = this.geo(n, c.unit), y = W / 2, h = B / 2 * k;
      const e1 = [P[0] - h, P[1] + h], e2 = [P[0] + h, P[1] - h];
      return [
        ln(0, -y, Lm, -y), ln(0, y, x0 - B * k, y), ln(x0 + B * k, y, Lm, y),
        ln(x0 - B * k, y, e1[0], e1[1]), ln(x0 + B * k, y, e2[0], e2[1]),
        ln(0, -y, 0, y, { j: 1 }), ln(Lm, -y, Lm, y, { j: 1 }), ln(e1[0], e1[1], e2[0], e2[1], { j: 1 }),
        hitR(0, -y, Lm, W), hit([[x0 - B * k, y], [x0 + B * k, y], e2, e1]),
      ];
    },
    grips: edgeGrip, grip: (n, id, l, g, u) => widthGrip(n, l, u),
  },
  endcap: {
    name: 'End cap', icon: 'endcap', duct: 1,
    def: { w: 24, h: 20, shape: 'rect', sys: 'SA' },
    f: ['sys', 'size'],
    ports: n => [port('a', 0, 0, 180, n)],
    prims(n, c) { const W = W_(n, c); return [rect(0, -W / 2, 60, W), ln(0, -W / 2, 60, W / 2, { j: 1 }), hitR(0, -W / 2, 60, W)]; },
    grips: edgeGrip, grip: (n, id, l, g, u) => widthGrip(n, l, u),
  },
  damper: {
    name: 'Damper', icon: 'damper', duct: 1,
    def: { L: 300, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'L'],
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = W_(n, c), m = n.L / 2;
      return body(n.L, W).concat([
        ln(m - n.L * 0.3, W * 0.42, m + n.L * 0.3, -W * 0.42), cir([m, 0], Math.max(12, W * 0.04)),
        txt(m, -W / 2 - c.th * 0.35, 'VD', c.th * 0.9, lbl),
      ]);
    },
    grips: lenGrips, grip: lenGrip,
  },
  accessdoor: {
    name: 'Access door', icon: 'access-door', duct: 1,
    def: { L: 500, w: 24, h: 20, shape: 'rect', sys: 'SA', elev: 2700 },
    f: ['sys', 'size', 'L'],
    ports: n => [port('a', 0, 0, 180, n), port('b', n.L, 0, 0, n)],
    prims(n, c) {
      const W = W_(n, c), m = n.L / 2, d = Math.min(150, n.L / 2 - 20);
      return body(n.L, W).concat([rect(m - d, -W / 2 - 100, d * 2, 100, { layer: 'diff' }), ln(m - d, -W / 2 - 100, m + d, -W / 2, { layer: 'diff' }), txt(m, -W / 2 - 100 - c.th * 0.35, 'AD', c.th * 0.9, lbl)]);
    },
    grips: lenGrips, grip: lenGrip,
  },
  diffuser: {
    name: 'Diffuser', icon: 'diffuser', layer: 'diff',
    def: { F: 600, flow: 0, tag: 'SD', sys: 'SA' },
    f: ['sys', 'tag', 'flow', 'F'],
    ports: () => [anyPort('a', 0, 0, 180)],
    prims(n, c) {
      const F = n.F, h = F / 2, i = F * 0.3;
      return [rect(0, -h, F, F), ln(0, -h, F, h), ln(F, -h, 0, h), rect(i, -h + i, F - 2 * i, F - 2 * i, { j: 1 }), hitR(0, -h, F, F),
        txt(F / 2, 0, `${n.flow || 0} ${c.fu}`, c.th * 0.9, { box: [F, F], gap: c.th * 1.15, ...lbl })];
    },
    grips: n => [['s', n.F, n.F / 2]],
    grip(n, id, l) { n.F = Math.max(150, g50(Math.max(l[0], 2 * Math.abs(l[1])))); },
  },
  grille: {
    name: 'Grille', icon: 'grille', layer: 'diff',
    def: { Fx: 400, Fy: 400, flow: 0, tag: 'EG', sys: 'EA' },
    f: ['sys', 'tag', 'flow', 'Fx', 'Fy'],
    ports: () => [anyPort('a', 0, 0, 180)],
    prims(n, c) {
      const h = n.Fy / 2, o = [rect(0, -h, n.Fx, n.Fy), hitR(0, -h, n.Fx, n.Fy), txt(n.Fx / 2, 0, `${n.flow || 0} ${c.fu}`, c.th * 0.9, { box: [n.Fx, n.Fy], gap: c.th * 1.15, ...lbl })];
      for (let k = 1; k < 5; k++) o.push(ln(0, -h + n.Fy * k / 5, n.Fx, -h + n.Fy * k / 5, { j: 1 }));
      return o;
    },
    grips: n => [['s', n.Fx, n.Fy / 2]],
    grip(n, id, l) { n.Fx = g50(l[0]); n.Fy = g50(2 * l[1]); },
  },
  louver: {
    name: 'Louver', icon: 'louver', layer: 'diff',
    def: { F: 600, tag: 'LV', sys: 'EA' },
    f: ['sys', 'tag', 'F'],
    ports: () => [anyPort('a', 0, 0, 180)],
    prims(n) {
      const h = n.F / 2, o = [rect(0, -h, 120, n.F), hitR(0, -h, 120, n.F)];
      for (let y = -h + 40; y < h - 40; y += 100) o.push(ln(0, y, 120, y + 60, { j: 1 }));
      return o;
    },
    grips: n => [['s', 120, n.F / 2]],
    grip(n, id, l) { n.F = g50(2 * l[1]); },
  },
  fan: {
    name: 'Fan / exhaust', icon: 'fan', layer: 'eq',
    def: { L: 500, B: 450, tag: 'EF-01', sys: 'EA' },
    f: ['sys', 'tag', 'L', 'B'],
    ports: n => [anyPort('a', 0, 0, 180), anyPort('b', n.L, 0, 0)],
    prims(n, c) {
      const r = Math.min(n.L, n.B) * 0.36, C = [n.L / 2, 0], o = [rect(0, -n.B / 2, n.L, n.B), cir(C, r), hitR(0, -n.B / 2, n.L, n.B)];
      for (const d of [-90, 30, 150]) o.push(ln(C[0], 0, C[0] + r * Math.cos(d * RAD), r * Math.sin(d * RAD), { j: 1 }));
      const f = c.flows && c.flows[n.id];
      o.push(txt(n.L / 2, 0, f ? `${n.tag} · ${f} ${c.fu}` : n.tag, c.th * 0.9, { box: [n.L, n.B], gap: c.th * 1.15, ...lbl }));
      return o;
    },
    grips: n => [['s', n.L, n.B / 2]],
    grip(n, id, l) { n.L = Math.max(200, g50(l[0])); n.B = g50(2 * l[1]); },
  },
  fcu: {
    name: 'Indoor ducted', icon: 'indoor-ducted', layer: 'eq',
    def: { L: 1200, B: 700, w: 24, h: 20, shape: 'rect', tag: 'FCU-01' },
    f: ['tag', 'L', 'B', 'size'],
    ports: n => [anyPort('s', n.L / 2, 0, 0, { w: n.w, h: n.h, shape: n.shape, keys: ['w', 'h'] }), anyPort('r', -n.L / 2, 0, 180, { opt: true })],
    prims(n, c) {
      const x = -n.L / 2, y = -n.B / 2, f = (c.flows && c.flows[n.id]) || 0;
      return [rect(x, y, n.L, n.B), ln(x + 80, y, x + 80, -y, { j: 1 }), ln(x + 130, y, x + 130, -y, { j: 1 }), hitR(x, y, n.L, n.B),
        txt(0, 0, `${n.tag} · ${f} ${c.fu}`, c.th * 0.9, { box: [n.L, n.B], gap: c.th * 1.15, ...lbl })];
    },
    grips: n => [['s', n.L / 2, n.B / 2]],
    grip(n, id, l) { n.L = Math.max(200, g50(2 * l[0])); n.B = g50(2 * l[1]); },
  },
  outdoor: {
    name: 'Outdoor', icon: 'outdoor', layer: 'eq',
    def: { L: 900, B: 350, tag: 'ODU-01' },
    f: ['tag', 'L', 'B'],
    prims(n, c) {
      const x = -n.L / 2, y = -n.B / 2, r = n.B * 0.38, C = [x + n.B * 0.55, 0], k = r * 0.7, o = [rect(x, y, n.L, n.B), cir(C, r), ln(C[0] - k, -k, C[0] + k, k, { j: 1 }), ln(C[0] - k, k, C[0] + k, -k, { j: 1 }), hitR(x, y, n.L, n.B),
        txt(0, 0, n.tag, c.th * 0.9, { box: [n.L, n.B], gap: c.th * 1.15, ...lbl })];
      for (let gx = C[0] + r + 80; gx < -x - 40; gx += 60) o.push(ln(gx, y + 40, gx, -y - 40, { j: 1 }));
      return o;
    },
    grips: n => [['s', n.L / 2, n.B / 2]],
    grip(n, id, l) { n.L = Math.max(200, g50(2 * l[0])); n.B = g50(2 * l[1]); },
  },
  room: {
    name: 'Ruangan', layer: 'denah',
    def: { W: 6000, H: 4000, t: 150, name: 'Ruangan', dims: true },
    f: ['name', 'W', 'H', 't', 'dims'],
    prims(n, c) {
      const P = roomPts(n), I = insetPoly(P, n.t), s = Math.sign(polyArea(P)) || 1, d = { layer: 'dim' }, off = c.th * 2.2;
      const area = (Math.abs(polyArea(I)) / 1e6).toFixed(1), L = I.reduce((m, p) => (p[1] - p[0] > m[1] - m[0] ? p : m)); // sudut kiri-bawah
      const cuts = (c.cuts && c.cuts[n.id]) || {}, N = P.length;
      const o = [
        { k: 'ring', outer: P, inner: I, nostroke: 1 },
        txt(L[0] + c.th * 0.6, L[1] - c.th * 1.6, n.name.toUpperCase(), c.th, { anchor: 'start', ...lbl }),
        txt(L[0] + c.th * 0.6, L[1] - c.th * 0.5, `${area} m²`, c.th * 0.75, { anchor: 'start', ...lbl }),
      ];
      P.forEach((p, i) => { // garis dinding luar & dalam, terpotong di pintu/jendela
        const q = P[(i + 1) % N], len = dist(p, q) || 1, u = [(q[0] - p[0]) / len, (q[1] - p[1]) / len], a = I[i], b = I[(i + 1) % N];
        const pa = (a[0] - p[0]) * u[0] + (a[1] - p[1]) * u[1], pb = (b[0] - p[0]) * u[0] + (b[1] - p[1]) * u[1];
        const gaps = (cuts[i] || []).slice().sort((x, y) => x[0] - y[0]);
        gapLines(o, p, u, [0, 0], 0, len, gaps);
        gapLines(o, p, u, [a[0] - p[0] - u[0] * pa, a[1] - p[1] - u[1] * pa], pa, pb, gaps);
      });
      if (n.dims === false) return o;
      const seen = []; // sisi seberang yang sama panjang (persegi) tidak diukur dua kali
      P.forEach((p, i) => {
        const q = P[(i + 1) % P.length], len = dist(p, q), ang = angOf(p, q);
        if (len < 1 || seen.some(([l, g]) => Math.abs(l - len) < 1 && Math.abs(norm(g - ang + 180)) < 0.5)) return;
        seen.push([len, ang]);
        o.push(...xformPrims(dimPrims(len, -off * s, c.th, d), p[0], p[1], ang, false));
      });
      return o;
    },
    // v* = titik sudut (geser bebas), e* = tengah sisi (tarik sisi keluar/masuk). Klik ganda: v hapus titik, e tambah titik.
    grips(n) {
      const P = roomPts(n);
      return [...P.map((p, i) => ['v' + i, p[0], p[1]]), ...P.map((p, i) => { const q = P[(i + 1) % P.length]; return ['e' + i, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; })];
    },
    grip(n, id, l, g, u, b) {
      b = b || structuredClone(n);
      const P = roomPts(b).map(p => [...p]), N = P.length, i = +id.slice(1), L = g ? worldToLocal(b, g) : l;
      n.x = b.x; n.y = b.y;
      if (id[0] === 'v') { P[i] = L.map(Math.round); return setRoom(n, P); }
      const A = P[i], C = P[(i + 1) % N], len = dist(A, C) || 1, U = [(C[0] - A[0]) / len, (C[1] - A[1]) / len], nr = [-U[1], U[0]];
      const d = Math.round((L[0] - A[0]) * nr[0] + (L[1] - A[1]) * nr[1]);
      if (!d) return setRoom(n, P);
      const mv = p => [p[0] + nr[0] * d, p[1] + nr[1] * d];
      const perp = (p, q) => Math.abs((q[0] - p[0]) * U[0] + (q[1] - p[1]) * U[1]) < 1; // sisi p→q tegak lurus sisi yang ditarik
      const prev = P[(i + N - 1) % N], next = P[(i + 2) % N], out = [];
      P.forEach((p, j) => {
        if (j === i) out.push(...(perp(prev, A) ? [mv(A)] : [A, mv(A)]));          // sisi tetangga miring/segaris → tambah dinding baru
        else if (j === (i + 1) % N) out.push(...(perp(C, next) ? [mv(C)] : [mv(C), C]));
        else out.push(p);
      });
      setRoom(n, out);
    },
    gripDbl(n, id) {
      const P = roomPts(n).map(p => [...p]), i = +id.slice(1);
      if (id[0] === 'v') { if (P.length > 3) P.splice(i, 1); }
      else { const q = P[(i + 1) % P.length]; P.splice(i + 1, 0, [Math.round((P[i][0] + q[0]) / 2), Math.round((P[i][1] + q[1]) / 2)]); }
      setRoom(n, P);
    },
  },
  dim: {
    name: 'Garis ukur', layer: 'dim',
    def: { L: 1000, off: -500 },
    f: ['off'],
    prims(n, c) {
      const o = dimPrims(n.L, n.off, c.th), lo = Math.min(0, n.off) - c.th * 1.2, hi = Math.max(0, n.off) + c.th * 0.3;
      return o.concat([hitR(0, lo, n.L, hi - lo)]);
    },
    grips: n => [['p1', 0, 0], ['p2', n.L, 0], ['off', n.L / 2, n.off]],
    grip(n, id, l, g) { if (id === 'off') n.off = Math.round(l[1]); else endGrip(n, id, l, g); },
  },
  // ---- Arsitektur ----
  column: {
    name: 'Kolom', icon: 'kolom', layer: 'kolom',
    def: { shape: 'rect', cw: 400, cd: 400 },
    f: ['shape', 'cw', 'cd'],
    prims(n) {
      const w = n.cw / 2, d = n.shape === 'round' ? w : n.cd / 2, k = n.shape === 'round' ? 0.7 : 1;
      return [n.shape === 'round' ? cir([0, 0], w, { fill: 'wall' }) : rect(-w, -d, 2 * w, 2 * d, { fill: 'wall' }),
        ln(-w * k, -d * k, w * k, d * k, { j: 1 }), ln(-w * k, d * k, w * k, -d * k, { j: 1 }), hitR(-w, -d, 2 * w, 2 * d)];
    },
    grips: n => [['s', n.cw / 2, (n.shape === 'round' ? n.cw : n.cd) / 2]],
    grip(n, id, l) { n.cw = g50(2 * l[0]); if (n.shape !== 'round') n.cd = g50(2 * l[1]); },
  },
  door: {
    name: 'Pintu', icon: 'pintu', layer: 'bukaan',
    def: { dw: 900, t: 150, kind: 'single', swing: 'in', hinge: 'l' },
    f: ['kind', 'dw', 'swing', 'hinge'],
    prims(n) {
      const o = jambs(n), W = n.dw, out = n.swing === 'out', y0 = out ? 0 : n.t, sy = out ? -1 : 1;
      if (n.kind === 'sliding') { const h = n.t * 0.2; o.push(rect(0, n.t * 0.28, W * 0.55, h), rect(W * 0.45, n.t * 0.52, W * 0.55, h)); return o; }
      if (n.kind === 'double') { leaf(o, 0, 1, y0, sy, W / 2); leaf(o, W, -1, y0, sy, W / 2); }
      else if (n.hinge === 'r') leaf(o, W, -1, y0, sy, W); else leaf(o, 0, 1, y0, sy, W);
      o.push(hitR(0, out ? -W : n.t, W, W));
      return o;
    },
    grips: openGrips, grip: openGrip,
  },
  win: {
    name: 'Jendela', icon: 'jendela', layer: 'bukaan',
    def: { dw: 1200, t: 150 },
    f: ['dw'],
    prims: n => [...jambs(n), ln(0, 0, n.dw, 0), ln(0, n.t, n.dw, n.t), ln(0, n.t / 2, n.dw, n.t / 2, { j: 1 })],
    grips: openGrips, grip: openGrip,
  },
  opening: {
    name: 'Bukaan', icon: 'bukaan', layer: 'bukaan',
    def: { dw: 1000, t: 150 },
    f: ['dw'],
    prims: n => [...jambs(n), ln(0, 0, n.dw, 0, { dash: 1 }), ln(0, n.t, n.dw, n.t, { dash: 1 })],
    grips: openGrips, grip: openGrip,
  },
  partition: {
    name: 'Partisi', icon: 'partisi', layer: 'denah',
    def: { L: 3000, t: 100 },
    f: ['L', 't'],
    prims: n => [rect(0, -n.t / 2, n.L, n.t, { fill: 'wall' }), hitR(0, -n.t / 2, n.L, n.t)],
    grips: n => [['p1', 0, 0], ['p2', n.L, 0]], grip: endGrip,
  },
  shaft: {
    name: 'Shaft', icon: 'shaft', layer: 'arsi',
    def: { sw: 800, sd: 600 },
    f: ['sw', 'sd'],
    prims(n, c) { const w = n.sw / 2, d = n.sd / 2; return [rect(-w, -d, n.sw, n.sd), ln(-w, -d, w, d, { j: 1 }), ln(-w, d, w, -d, { j: 1 }), hitR(-w, -d, n.sw, n.sd), tag('SHAFT', n, c, n.sw, n.sd)]; },
    ...centerGrip('sw', 'sd'),
  },
  beam: {
    name: 'Balok', icon: 'balok', layer: 'arsi',
    def: { L: 4000, bw: 300, be: 3000 },
    f: ['L', 'bw', 'be'],
    prims(n, c) { const h = n.bw / 2; return [ln(0, -h, n.L, -h, { dash: 1 }), ln(0, h, n.L, h, { dash: 1 }), txt(n.L / 2, -h - c.th * 0.35, `B${n.bw} · BB +${n.be}`, c.th * 0.8, lbl), hitR(0, -h, n.L, n.bw)]; },
    grips: n => [['p1', 0, 0], ['p2', n.L, 0]], grip: endGrip,
  },
  stair: {
    name: 'Tangga', icon: 'tangga', layer: 'arsi',
    def: { skind: 'straight', sl: 3000, sw: 1200, tr: 250 },
    f: ['skind', 'sl', 'sw', 'tr'],
    prims(n, c) {
      const { sl, sw } = n, tr = Math.max(150, n.tr), o = [rect(0, 0, sl, sw), hitR(0, 0, sl, sw)], L = n.skind === 'L';
      for (let x = tr; x < sl - 1; x += tr) o.push(ln(x, 0, x, sw, { j: 1 }));
      let path = [[0, sw / 2], [sl, sw / 2]], dir = 0;
      if (L) {
        o.push(rect(sl, 0, sw, sw), rect(sl, sw, sw, sl), hitR(sl, 0, sw, sw + sl));
        for (let y = sw + tr; y < sw + sl - 1; y += tr) o.push(ln(sl, y, sl + sw, y, { j: 1 }));
        path = [[0, sw / 2], [sl + sw / 2, sw / 2], [sl + sw / 2, sw + sl]]; dir = 90;
      }
      const e = path[path.length - 1], h = Math.min(sw * 0.3, c.th), u = rotP([1, 0], dir);
      o.push(pl(path, { j: 1 }), arrow(e[0] - u[0] * h / 2, e[1] - u[1] * h / 2, dir, h), txt(c.th * 0.4, sw / 2 - c.th * 0.3, 'NAIK', c.th * 0.7, { anchor: 'start', ...lbl }));
      return o;
    },
    grips: n => [['s', n.sl, n.sw]],
    grip(n, id, l) { n.sl = g50(l[0]); n.sw = g50(l[1]); },
  },
  lift: {
    name: 'Lift', icon: 'lift', layer: 'arsi',
    def: { sw: 2000, sd: 2000 },
    f: ['sw', 'sd'],
    prims(n, c) {
      const w = n.sw / 2, d = n.sd / 2, i = Math.min(w, d) * 0.15;
      return [rect(-w, -d, n.sw, n.sd), rect(-w + i, -d + i, n.sw - 2 * i, n.sd - 2 * i, { j: 1 }), ln(-w + i, -d + i, w - i, d - i, { j: 1 }), ln(-w + i, d - i, w - i, -d + i, { j: 1 }), hitR(-w, -d, n.sw, n.sd), tag('LIFT', n, c, n.sw, n.sd)];
    },
    ...centerGrip('sw', 'sd'),
  },
  ceiling: {
    name: 'Tinggi plafon', icon: 'plafon', layer: 'arsi',
    def: { ch: 2800 },
    f: ['ch'],
    prims(n, c) { const s = `PLAFON +${n.ch}`, h = c.th * 0.8, w = s.length * h * 0.62 + h, H = h * 1.7; return [rect(-w / 2, -H / 2, w, H), txt(0, h * 0.35, s, h, lbl), hitR(-w / 2, -H / 2, w, H)]; },
  },
  // Coretan tangan bebas (markup). pts lokal; hit = pita tipis sepanjang garis
  sketch: {
    name: 'Coretan tangan', icon: 'coretan', layer: 'coret',
    def: { pts: [[0, 0], [1000, 0]] },
    f: [],
    prims(n) {
      const w = 60, band = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, v = [-(b[1] - a[1]) / d * w, (b[0] - a[0]) / d * w];
        return hit([[a[0] + v[0], a[1] + v[1]], [b[0] + v[0], b[1] + v[1]], [b[0] - v[0], b[1] - v[1]], [a[0] - v[0], a[1] - v[1]]]); };
      return [pl(n.pts), ...n.pts.slice(1).map((b, i) => band(n.pts[i], b))];
    },
  },
  text: {
    name: 'Teks', layer: 'dim',
    def: { s: 'Catatan', th: 0, tz: '1', col: '', al: 'start', b: false, it: false, ul: false, bx: false },
    f: ['s', 'tz', 'th', 'col', 'al', 'sty'],
    prims(n, c) { return styledText(n, c, 0, 0, n.al || 'start'); },
  },
  // Catatan dengan panah penunjuk (leader): (x, y) = ujung panah di komponen, (tx, ty) = letak teks
  note: {
    name: 'Catatan + panah', layer: 'dim',
    def: { s: 'Cek di lapangan', tx: 1200, ty: -900, th: 0, tz: '1', col: 'merah', b: false, it: false, ul: false, bx: true },
    f: ['s', 'tz', 'th', 'col', 'sty'],
    prims(n, c) {
      const h = textH(n, c), right = n.tx >= 0, gap = h * 0.4, ah = h * 0.9, col = n.col ? { col: n.col } : {};
      const L = Math.hypot(n.tx, n.ty) || 1, d = [n.tx / L, n.ty / L]; // arah dari ujung panah ke teks
      return [
        ln(n.tx, n.ty, d[0] * ah, d[1] * ah, col),                                            // garis teks → pangkal panah
        { ...arrow(d[0] * ah / 2, d[1] * ah / 2, Math.atan2(-d[1], -d[0]) / RAD, ah), ...col }, // ujung panah tepat di (0, 0)
        ...styledText(n, c, n.tx + (right ? gap : -gap), n.ty + h * 0.35, right ? 'start' : 'end'),
        hit([[0, -h / 2], [n.tx, n.ty - h / 2], [n.tx, n.ty + h / 2], [0, h / 2]]),
      ];
    },
    grips: n => [['t', n.tx, n.ty]],
    grip(n, id, l) { n.tx = Math.round(l[0]); n.ty = Math.round(l[1]); },
  },
};

// Kelompok library (urutan tampil)
const LIBRARY = [
  ['Ruangan', ['room:rect', 'room:L', 'room:T', 'room:U']],
  ['Arsitektur', ['column', 'door', 'win', 'opening', 'partition', 'shaft', 'beam', 'stair', 'lift', 'ceiling']],
  ['Equipment', ['fan', 'fcu', 'outdoor']],
  ['Duct', ['straight', 'flex']],
  ['Fitting', ['elbow', 'transition', 'tee', 'takeoff', 'endcap']],
  ['Perlengkapan', ['diffuser', 'grille', 'damper', 'accessdoor', 'louver']],
];
// Nama & ikon item library ('room:L' = ruangan bentuk L)
const libInfo = t => (t.startsWith('room:') ? { name: t === 'room:rect' ? 'Ruangan' : 'Ruangan ' + t.slice(5), icon: 'ruang-' + t.slice(5).toLowerCase() } : TYPES[t]);

// ---- Transformasi node ----
function localToWorld(n, p) { const q = rotP(n.mir ? [p[0], -p[1]] : p, n.rot || 0); return [q[0] + n.x, q[1] + n.y]; }
function worldToLocal(n, g) { const r = rotP([g[0] - n.x, g[1] - n.y], -(n.rot || 0)); return n.mir ? [r[0], -r[1]] : r; }
function moveLocal(n, dx, dy) { const g = rotP(n.mir ? [dx, -dy] : [dx, dy], n.rot || 0); n.x += g[0]; n.y += g[1]; }
const dirToWorld = (n, d) => norm((n.mir ? -d : d) + (n.rot || 0));

function worldPorts(n, unit) {
  const T = TYPES[n.type];
  return (T.ports ? T.ports(n, unit) : []).map(p => ({ ...p, pos: localToWorld(n, [p.x, p.y]), wdir: dirToWorld(n, p.dir), node: n }));
}
function worldPrims(n, c) { return xformPrims(TYPES[n.type].prims(n, c), n.x, n.y, n.rot || 0, n.mir); }

// Tempelkan port `pid` milik n ke port dunia `tp` (posisi sama, arah berlawanan).
function attach(n, pid, tp, unit) {
  const lp = TYPES[n.type].ports(n, unit).find(p => p.id === pid);
  n.rot = Math.round(norm(tp.wdir + 180 - (n.mir ? -lp.dir : lp.dir)) * 1000) / 1000;
  const o = rotP(n.mir ? [lp.x, -lp.y] : [lp.x, lp.y], n.rot);
  n.x = tp.pos[0] - o[0]; n.y = tp.pos[1] - o[1];
  return n;
}

// Salin ukuran/sistem dari port target ke port pid milik n (supaya komponen baru langsung pas)
function adoptSize(n, pid, tp, unit) {
  const lp = TYPES[n.type].ports(n, unit).find(p => p.id === pid);
  if (lp.keys && tp.w != null && tp.keys) { n[lp.keys[0]] = tp.w; n[lp.keys[1]] = tp.h; if ('shape' in n && tp.shape) n.shape = tp.shape; }
  if ('sys' in n && tp.node.sys) n.sys = tp.node.sys;
}

function primBounds(prims) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (p, r = 0) => { x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); };
  for (const p of prims) {
    if (p.k === 'l') { add(p.a); add(p.b); }
    else if (p.k === 'pl' || p.k === 'hit') p.pts.forEach(q => add(q));
    else if (p.k === 'ring') p.outer.forEach(q => add(q));
    else if (p.k === 'c' || p.k === 'arc') add(p.c, p.r); // ponytail: arc pakai lingkaran penuh, cukup untuk seleksi & zoom
    else if (p.k === 't') add(p.p, p.h * p.s.length * 0.35);
    else if (p.k === 'arrow') add(p.p, p.h);
  }
  return [x0, y0, x1, y1];
}

// Jalur duct dari titik-titik → duct lurus + elbow otomatis di tiap belokan.
function pathNodes(pts, spec, unit) {
  const P = [pts[0]];
  for (const p of pts.slice(1)) if (dist(p, P[P.length - 1]) > 1) P.push(p);
  for (let i = P.length - 2; i > 0; i--) if (Math.abs(norm(angOf(P[i], P[i + 1]) - angOf(P[i - 1], P[i]))) < 0.5) P.splice(i, 1);
  if (P.length < 2) return [];
  const R = mmOf(spec.w, unit), dirs = [], tan = [0], out = [];
  for (let i = 0; i < P.length - 1; i++) dirs.push(angOf(P[i], P[i + 1]));
  for (let i = 1; i < P.length - 1; i++) tan[i] = R * Math.tan(Math.abs(norm(dirs[i] - dirs[i - 1])) / 2 * RAD);
  tan[P.length - 1] = 0;
  const base = { w: spec.w, h: spec.h, shape: spec.shape, sys: spec.sys, elev: spec.elev ?? 2700 };
  for (let i = 0; i < P.length - 1; i++) {
    if (i > 0) {
      const th = norm(dirs[i] - dirs[i - 1]), u = rotP([1, 0], dirs[i - 1]);
      out.push({ ...TYPES.elbow.def, ...base, type: 'elbow', angle: Math.round(Math.abs(th) * 100) / 100, mir: th < 0, rot: dirs[i - 1], x: P[i][0] - u[0] * tan[i], y: P[i][1] - u[1] * tan[i] });
    }
    const u = rotP([1, 0], dirs[i]), L = dist(P[i], P[i + 1]) - tan[i] - tan[i + 1];
    if (L >= 1) out.push({ ...TYPES.straight.def, ...base, type: 'straight', L: Math.round(L * 10) / 10, rot: dirs[i], x: P[i][0] + u[0] * tan[i], y: P[i][1] + u[1] * tan[i] });
  }
  return out;
}
