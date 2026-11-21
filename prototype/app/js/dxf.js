// Temandor – tulis DXF R12 (ASCII) dari primitive yang sama dengan tampilan layar.
// Y dibalik (DXF: Y ke atas). Satuan model: mm atau inch.
const PICK_ACI = { merah: 1, kuning: 2, hijau: 3, biru: 5, putih: 7 }; // warna pilihan teks → nomor warna AutoCAD
function toDXF(p, o) {
  const cn = connect(p), c = ctxOf(p, cn), k = o.unit === 'inch' ? 1 / 25.4 : 1;
  const F = v => (Math.round(v * k * 1000) / 1000).toString(), FY = v => F(-v), A = a => (((a % 360) + 360) % 360).toFixed(3);
  const name = Object.fromEntries(LAYERS.map(([key, , dxf]) => [key, dxf]));
  const S = s => String(s).replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/²/g, '2').replace(/[^\x20-\x7e]/g, '');
  const e = [];
  const put = (...kv) => { for (let i = 0; i < kv.length; i += 2) e.push(kv[i], kv[i + 1]); };
  const line = (L, a, b) => put(0, 'LINE', 8, L, 10, F(a[0]), 20, FY(a[1]), 11, F(b[0]), 21, FY(b[1]));
  const loop = (L, pts, closed) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) line(L, pts[i], pts[(i + 1) % pts.length]); };

  for (const n of p.nodes) for (const pr of worldPrims(n, c)) {
    const key = pr.layer || layerOf(n);
    if (!o.layers.has(key) || pr.k === 'hit' || pr.nostroke) continue; // isian warna (latar/arsir) tidak ikut DXF
    const L = pr.k === 't' && key !== 'dim' ? 'TEXT' : name[key], start = e.length;
    switch (pr.k) {
      case 'l': line(L, pr.a, pr.b); break;
      case 'pl': loop(L, pr.pts, pr.closed); break;
      case 'ring': loop(L, pr.outer, true); loop(L, pr.inner, true); break;
      case 'c': put(0, 'CIRCLE', 8, L, 10, F(pr.c[0]), 20, FY(pr.c[1]), 40, F(pr.r)); break;
      case 'arc': put(0, 'ARC', 8, L, 10, F(pr.c[0]), 20, FY(pr.c[1]), 40, F(pr.r), 50, A(-pr.a1), 51, A(-pr.a0)); break;
      case 'arrow': {
        const u = rotP([1, 0], pr.dir), v = [-u[1], u[0]], h = pr.h;
        const tip = [pr.p[0] + u[0] * h / 2, pr.p[1] + u[1] * h / 2], b = [pr.p[0] - u[0] * h / 2, pr.p[1] - u[1] * h / 2];
        const p1 = [b[0] + v[0] * h * 0.35, b[1] + v[1] * h * 0.35], p2 = [b[0] - v[0] * h * 0.35, b[1] - v[1] * h * 0.35];
        put(0, 'SOLID', 8, L, 10, F(tip[0]), 20, FY(tip[1]), 11, F(p1[0]), 21, FY(p1[1]), 12, F(p2[0]), 22, FY(p2[1]), 13, F(p2[0]), 23, FY(p2[1]));
        break;
      }
      case 't': {
        const al = { start: 0, middle: 1, end: 2 }[pr.anchor] || 0, x = F(pr.p[0]), y = FY(pr.p[1]);
        put(0, 'TEXT', 8, L, 10, x, 20, y, 40, F(pr.h), 1, (pr.ul ? '%%u' : '') + S(pr.s), 50, A(-pr.rot));
        if (pr.it) put(51, '15.000'); // miring 15° (italic); tebal tidak ada di TEXT R12
        if (al) put(72, al, 11, x, 21, y);
        break;
      }
    }
    // Warna pilihan (teks/catatan): nomor warna AutoCAD setelah kode layer tiap entitas yang baru ditulis
    if (pr.col && PICK_ACI[pr.col]) for (let i = start; i < e.length; i += 2) if (e[i] === 8) { e.splice(i + 2, 0, 62, PICK_ACI[pr.col]); i += 2; }
  }
  if (o.note) {
    const b = projectBounds(p, c);
    put(0, 'TEXT', 8, 'TEXT', 10, F(b[0]), 20, FY(b[3] + c.th * 3), 40, F(c.th), 1, S(`SKETSA BANTU TEMANDOR - CEK ULANG UKURAN DI LAPANGAN. ${p.name} (${p.scale}, duct ${p.unit})`));
  }

  const layers = [...LAYERS.map(([, , dxf, col]) => [dxf, col]), ['TEXT', 7]];
  const head = [0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, o.unit === 'inch' ? 1 : 4, 0, 'ENDSEC',
    0, 'SECTION', 2, 'TABLES',
    0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0', 0, 'ENDTAB',
    0, 'TABLE', 2, 'LAYER', 70, layers.length, ...layers.flatMap(([nm, col]) => [0, 'LAYER', 2, nm, 70, 0, 62, col, 6, 'CONTINUOUS']), 0, 'ENDTAB',
    0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES'];
  return [...head, ...e, 0, 'ENDSEC', 0, 'EOF'].join('\n') + '\n';
}

function projectBounds(p, c, filter = () => true) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const n of p.nodes) if (filter(n)) {
    const q = primBounds(worldPrims(n, c));
    b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])];
  }
  return isFinite(b[0]) ? b : [0, 0, 6000, 4000];
}
