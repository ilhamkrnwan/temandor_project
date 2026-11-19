// Temandor – aksi gambar untuk AI. Dipakai asisten AI di editor (js/ai.js) dan server MCP (mcp/server.js).
// Murni: hanya membaca/mengubah objek proyek p, tanpa DOM. Butuh geom.js + model.js.
const r1 = v => Math.round(v * 10) / 10;
const KEEP = ['name', 'tag', 'w', 'h', 'shape', 'sys', 'flow', 'pts', 'g', 'lock', 's'];
function nodeInfo(p, n) {
  const o = { id: n.id, type: n.type, x: r1(n.x), y: r1(n.y) };
  if (n.rot) o.rot = n.rot;
  if (n.mir) o.mir = true;
  for (const k of [...Object.keys(TYPES[n.type].def), ...KEEP]) if (n[k] !== undefined && !(k in o)) o[k] = typeof n[k] === 'number' ? r1(n[k]) : n[k];
  if (n.host) o.host = { room: n.host.id, edge: n.host.e, s: r1(n.host.s) };
  return o;
}
const num = (v, what) => { if (typeof v !== 'number' || !isFinite(v)) throw new Error(`${what} harus angka`); return v; };
const findNode = (p, id) => { const n = p.nodes.find(m => m.id === id); if (!n) throw new Error(`Komponen ${id} tidak ada`); return n; };
const ROOMS = p => p.nodes.filter(n => n.type === 'room');
// Isi parameter komponen. Ruangan: W/H lewat resizeRoom, shape lewat roomShape. Kunci tak dikenal ditolak.
function applyProps(n, props = {}) {
  for (const [k, v] of Object.entries(props)) {
    if (n.type === 'room' && (k === 'W' || k === 'H')) { resizeRoom(n, k, num(v, k)); continue; }
    if (n.type === 'room' && k === 'shape') { if (!ROOM_SHAPES[v]) throw new Error(`Bentuk ruangan: ${Object.keys(ROOM_SHAPES).join(', ')}`); roomShape(n, v); continue; }
    if (['x', 'y', 'rot'].includes(k)) { n[k] = num(v, k); continue; }
    if (k === 'mir') { n.mir = !!v; continue; }
    if (!(k in TYPES[n.type].def) && !KEEP.includes(k)) throw new Error(`${n.type} tidak punya parameter "${k}"`);
    n[k] = typeof n[k] === 'number' ? num(v, k) : v;
  }
}
// Pintu/jendela/bukaan menempel ke dinding ruangan terdekat (≤ 500 mm)
function hostIt(p, n) {
  if (!HOSTED.has(n.type)) return;
  const h = hostAt(n, [n.x, n.y], ROOMS(p), 500);
  if (h) { n.host = h; syncHost(n, ROOMS(p).find(r => r.id === h.id)); }
}

const AI_TOOLS = [
  {
    name: 'get_project', readOnly: true,
    description: 'Baca isi proyek: satuan, skala, semua komponen (id, tipe, posisi mm, parameter), total debit per unit, dan daftar warning validasi. Panggil ini dulu sebelum mengubah gambar.',
    input_schema: { type: 'object', properties: {} },
    run(p) {
      const cn = connect(p), f = flowTotals(p, cn);
      return {
        name: p.name, unit_duct: p.unit, flow_unit: p.fu, scale: p.scale,
        nodes: p.nodes.map(n => nodeInfo(p, n)),
        flows: Object.entries(f).map(([id, v]) => ({ id, total: v })),
        warnings: validate(p, cn).map(w => ({ kind: w.kind, msg: w.msg, detail: w.detail, id: w.id, x: r1(w.pos[0]), y: r1(w.pos[1]) })),
      };
    },
  },
  {
    name: 'list_types', readOnly: true,
    description: 'Daftar tipe komponen yang bisa dipakai beserta parameter bawaannya, bentuk ruangan siap pakai, dan konvensi koordinat.',
    input_schema: { type: 'object', properties: {} },
    run() {
      return {
        coords: 'Satuan mm. x ke kanan, y ke BAWAH. Ruangan: (x,y) = sudut kiri-atas, W lebar, H tinggi. Komponen lain: (x,y) = titik acuan/tengah. rot dalam derajat.',
        duct_size: 'w/h duct dalam satuan duct proyek (inch atau mm). sys: SA (supply) atau EA (exhaust).',
        room_shapes: Object.keys(ROOM_SHAPES),
        types: Object.entries(TYPES).map(([type, T]) => ({ type, name: T.name, layer: T.layer || (T.duct ? 'sa/ea' : ''), params: T.def })),
      };
    },
  },
  {
    name: 'add_nodes',
    description: 'Tambah satu atau lebih komponen. Pintu/jendela/bukaan otomatis menempel ke dinding terdekat. Untuk jalur duct berbelok pakai draw_duct.',
    input_schema: {
      type: 'object', required: ['nodes'],
      properties: { nodes: { type: 'array', items: { type: 'object', required: ['type', 'x', 'y'], properties: {
        type: { type: 'string', description: 'Tipe dari list_types, mis. room, fcu, diffuser, door, column' },
        x: { type: 'number' }, y: { type: 'number' }, rot: { type: 'number' },
        props: { type: 'object', description: 'Parameter lain, mis. {"W":6000,"H":5000,"name":"Ruang Rapat"} atau {"flow":300}. Ruangan bisa {"shape":"L"}.' },
      } } } },
    },
    run(p, { nodes }) {
      if (!Array.isArray(nodes) || !nodes.length) throw new Error('nodes kosong');
      const made = nodes.map(o => {
        if (!TYPES[o.type]) throw new Error(`Tipe "${o.type}" tidak ada. Lihat list_types.`);
        const n = mk(o.type, { x: num(o.x, 'x'), y: num(o.y, 'y'), rot: o.rot ? num(o.rot, 'rot') : 0 });
        if (TYPES[o.type].duct && p.unit === 'mm' && !(o.props && o.props.w)) Object.assign(n, { w: 600, h: 500 });
        if (o.type === 'room' && !(o.props && o.props.name)) n.name = 'Ruangan ' + (ROOMS(p).length + 1);
        applyProps(n, o.props);
        hostIt(p, n);
        return n;
      });
      p.nodes.push(...made);
      return { added: made.map(n => nodeInfo(p, n)) };
    },
  },
  {
    name: 'draw_duct',
    description: 'Gambar jalur duct lewat titik-titik (mm). Elbow dipasang otomatis di tiap belokan. Mulai/akhiri tepat di port komponen (mis. sisi supply FCU) supaya tersambung.',
    input_schema: {
      type: 'object', required: ['points'],
      properties: {
        points: { type: 'array', minItems: 2, items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
        w: { type: 'number', description: 'Lebar (atau Ø kalau bulat), satuan duct proyek' }, h: { type: 'number' },
        shape: { type: 'string', enum: ['rect', 'round'] }, sys: { type: 'string', enum: ['SA', 'EA'] },
      },
    },
    run(p, { points, w, h, shape = 'rect', sys = 'SA' }) {
      if (!Array.isArray(points) || points.length < 2) throw new Error('Minimal 2 titik');
      const pts = points.map(q => [num(q[0], 'x'), num(q[1], 'y')]), d = p.unit === 'mm' ? [600, 500] : [24, 20];
      const ns = pathNodes(pts, { w: w || d[0], h: h || d[1], shape, sys }, p.unit);
      if (!ns.length) throw new Error('Titik terlalu dekat');
      p.nodes.push(...ns);
      return { added: ns.map(n => ({ id: n.id, type: n.type })) };
    },
  },
  {
    name: 'update_nodes',
    description: 'Ubah parameter/posisi komponen yang sudah ada.',
    input_schema: {
      type: 'object', required: ['updates'],
      properties: { updates: { type: 'array', items: { type: 'object', required: ['id', 'props'], properties: { id: { type: 'string' }, props: { type: 'object' } } } } },
    },
    run(p, { updates }) {
      const out = (updates || []).map(({ id, props }) => { const n = findNode(p, id); applyProps(n, props); if (n.host && (props.x !== undefined || props.y !== undefined)) { delete n.host; hostIt(p, n); } return nodeInfo(p, n); });
      return { updated: out };
    },
  },
  {
    name: 'delete_nodes',
    description: 'Hapus komponen berdasarkan id.',
    input_schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } } } },
    run(p, { ids }) {
      const set = new Set((ids || []).map(id => findNode(p, id).id));
      p.nodes = p.nodes.filter(n => !set.has(n.id) && !(n.host && set.has(n.host.id))); // pintu ikut terhapus bersama ruangannya
      return { deleted: [...set] };
    },
  },
];
const toolDefs = () => AI_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
function runTool(p, name, input) {
  const t = AI_TOOLS.find(x => x.name === name);
  if (!t) throw new Error(`Tool "${name}" tidak ada`);
  return t.run(p, input || {});
}
const toolReadOnly = name => !!(AI_TOOLS.find(x => x.name === name) || {}).readOnly;
