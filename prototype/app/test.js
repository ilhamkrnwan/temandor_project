// Cek cepat logika inti (tanpa browser): node app/test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ctx = vm.createContext({ structuredClone, console, Math, JSON });
for (const f of ['geom.js', 'model.js', 'dxf.js', 'tools.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', f), 'utf8'), ctx, { filename: f });
const run = code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, ctx));

// 1. Jalur L belok kanan & kiri → lurus + elbow + lurus, semua tersambung
for (const [y, mir] of [[2000, false], [-2000, true]]) {
  const r = run(`(() => { const p = newProject(); p.nodes = pathNodes([[0,0],[3000,0],[3000,${y}]], {w:24,h:20,shape:'rect',sys:'SA'}, 'inch');
    const cn = connect(p); return { types: p.nodes.map(n => n.type), mir: p.nodes[1].mir, open: cn.open.length, end: cn.open.map(a => a.pos.map(Math.round)) }; })()`);
  assert.deepStrictEqual(r.types, ['straight', 'elbow', 'straight']);
  assert.strictEqual(r.mir, mir);
  assert.strictEqual(r.open, 2, 'hanya 2 ujung luar yang terbuka');
  assert.deepStrictEqual(r.end.map(String).sort(), ['0,0', `3000,${y}`].sort());
}

// 2. Proyek contoh: warning yang memang disengaja saja
const kinds = run(`(() => { const p = demoProject(); return validate(p, connect(p)).map(w => w.kind).sort(); })()`);
assert.deepStrictEqual(kinds, ['open', 'size'], 'contoh harus punya 1 ujung terbuka + 1 beda ukuran, dapat: ' + kinds);
const flows = run(`(() => { const p = demoProject(); const f = flowTotals(p, connect(p)); return p.nodes.filter(n => n.type==='fcu' || n.type==='fan').map(n => f[n.id]); })()`);
assert.deepStrictEqual(flows, [1300, 150]);

// 3. Grip ujung 'a' duct lurus: ujung 'b' tidak bergeser
const g = run(`(() => { const n = mk('straight', {x:100, y:50, rot:30, L:2000}); const b0 = localToWorld(n, [n.L,0]);
  TYPES.straight.grip(n, 'a', [500, 0]); const b1 = localToWorld(n, [n.L,0]); return [dist(b0,b1), n.L]; })()`);
assert.ok(g[0] < 1e-6 && g[1] === 1500);

// 4. Cermin elbow: port a tetap di tempat, belokan pindah sisi
const m = run(`(() => { const n = mk('elbow', {x:10, y:20, rot:90}); const a0 = worldPorts(n,'mm')[0].pos, b0 = worldPorts(n,'mm')[1].pos;
  n.mir = true; const a1 = worldPorts(n,'mm')[0].pos, b1 = worldPorts(n,'mm')[1].pos; return [dist(a0,a1), Math.round(b0[0]+b1[0])]; })()`);
assert.ok(m[0] < 1e-6 && m[1] === 20);

// 4b. Grip ukuran elbow: seret tepi ke 6" dari garis tengah → 12"x10", port a tetap
const e = run(`(() => { const n = mk('elbow', {x:10, y:20, rot:90}); const a0 = worldPorts(n,'inch')[0].pos;
  TYPES.elbow.grip(n, 'w', [0, -6 * 25.4], null, 'inch'); return [n.w, n.h, dist(a0, worldPorts(n,'inch')[0].pos)]; })()`);
assert.deepStrictEqual(e.slice(0, 2), [12, 10]);
assert.ok(e[2] < 1e-6);

// 4c. Ruangan: tambah titik di sisi atas, tarik separuh sisi ke atas 1 m → bentuk L terbalik (6 titik)
const rm = run(`(() => { const n = mk('room', {W:6000, H:4000}); TYPES.room.gripDbl(n, 'e0');
  const b = structuredClone(n); TYPES.room.grip(n, 'e1', null, [4500, -1000], 'mm', b);
  return { pts: n.pts, y: n.y, H: n.H, area: Math.abs(polyArea(roomPts(n))) }; })()`);
assert.deepStrictEqual(rm.pts, [[0, 1000], [3000, 1000], [3000, 0], [6000, 0], [6000, 5000], [0, 5000]]);
assert.ok(rm.y === -1000 && rm.H === 5000 && rm.area === 27e6);

// 4d. Pintu menempel di dinding: ikut ruangan digeser, tetap di tempat saat titik ruangan ditambah, dinding terpotong
const dr = run(`(() => { const p = newProject(); const r = p.nodes[0]; Object.assign(r, { x: 1000, y: 1000 });
  const d = mk('door'); d.host = hostAt(d, [3000, 1075], [r], 500); p.nodes.push(d); const c1 = ctxOf(p);
  const a = [d.x, d.y, d.rot, d.mir, d.host.s]; r.x += 500; ctxOf(p); const b = d.x;
  TYPES.room.gripDbl(r, 'e0'); const c3 = ctxOf(p);
  return { a, b, c: [Math.round(d.x), Math.round(d.y)], e: d.host.e, cut: c1.cuts[r.id][0], lines: worldPrims(r, c3).filter(q => q.k === 'l').length }; })()`);
assert.deepStrictEqual(dr.a, [2550, 1000, 0, false, 1550]);
assert.strictEqual(dr.b, 3050);
assert.deepStrictEqual(dr.c, [3050, 1000]);
assert.deepStrictEqual(dr.cut, [[1550, 2450]]);
assert.strictEqual(dr.e, 0, 'titik baru di x=3000, pintu (1550..2450) tetap di separuh pertama sisi atas');

// 4e. Duct menabrak kolom → warning clash; duct menembus dinding → tanda bobokan, bukan warning
const cl = run(`(() => { const p = newProject(); p.nodes.push(mk('straight', { x: -1000, y: 2000, L: 4000 }), mk('column', { x: 1500, y: 2000 }));
  const cn = connect(p); return { kinds: validate(p, cn).map(w => w.kind), pen: ctxOf(p, cn).pen[p.nodes[1].id] }; })()`);
assert.ok(cl.kinds.includes('clash'));
assert.deepStrictEqual(cl.pen.map(Math.round), [1000]);

// 5. Ekspor DXF berisi layer dan entitas
const dxf = run(`toDXF(demoProject(), { layers: new Set(LAYERS.map(l => l[0])), unit: 'mm', note: true })`);
assert.ok(dxf.includes('DUCT-SA') && dxf.includes('DUCT-EA') && dxf.trim().endsWith('EOF'));
assert.ok((dxf.match(/\nLINE\n/g) || []).length > 100 && dxf.includes('\nARC\n') && dxf.includes('\nTEXT\n'));

// 6. Struktur DXF: baris berpasangan (kode grup angka, nilai), SECTION/ENDSEC seimbang, angka valid
const L = dxf.trimEnd().split('\n');
assert.strictEqual(L.length % 2, 0);
for (let i = 0; i < L.length; i += 2) {
  assert.ok(/^-?\d+$/.test(L[i]), `kode grup baris ${i + 1}: "${L[i]}"`);
  const g = +L[i];
  if ((g >= 10 && g <= 59) || g === 62 || g === 70 || g === 72) assert.ok(isFinite(+L[i + 1]), `nilai angka baris ${i + 2}: "${L[i + 1]}"`);
}
assert.strictEqual(dxf.split('\nSECTION\n').length, dxf.split('\nENDSEC\n').length);

// 7. Aksi AI/MCP: tambah FCU + pintu (menempel dinding), jalur duct berbelok, ubah, hapus, tipe salah ditolak
const ai = run(`(() => { const p = newProject({ unit: 'mm' }); const r = p.nodes[0];
  const a = runTool(p, 'add_nodes', { nodes: [{ type: 'fcu', x: 1500, y: 1000 }, { type: 'door', x: 3000, y: 10 }] });
  const d = runTool(p, 'draw_duct', { points: [[2100, 1000], [4000, 1000], [4000, 3000]], w: 400, h: 300 });
  runTool(p, 'update_nodes', { updates: [{ id: r.id, props: { W: 8000, name: 'Lobby' } }] });
  let bad = ''; try { runTool(p, 'add_nodes', { nodes: [{ type: 'naga', x: 0, y: 0 }] }); } catch (e) { bad = e.message; }
  runTool(p, 'delete_nodes', { ids: [a.added[0].id] });
  const g = runTool(p, 'get_project');
  return { types: d.added.map(n => n.type), door: !!a.added[1].host, W: r.W, name: r.name, bad, n: g.nodes.length, warn: g.warnings.length > 0, tools: toolDefs().length }; })()`);
assert.deepStrictEqual(ai.types, ['straight', 'elbow', 'straight']);
assert.ok(ai.door, 'pintu menempel ke dinding');
assert.ok(ai.W === 8000 && ai.name === 'Lobby' && ai.bad.includes('naga') && ai.n === 5 && ai.warn && ai.tools === 6);

// 8. Server MCP: initialize, tools/list, buat proyek, tambah ruangan, export DXF (folder sementara)
const os = require('os'), cp = require('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'temandor-'));
const rpc = (id, method, params) => JSON.stringify({ jsonrpc: '2.0', id, method, params });
const out = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'mcp', 'server.js')], {
  env: { ...process.env, TEMANDOR_DIR: tmp }, encoding: 'utf8',
  input: [rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), rpc(2, 'tools/list'),
    rpc(3, 'tools/call', { name: 'create_project', arguments: { name: 'Uji MCP', unit: 'mm' } }),
    rpc(4, 'tools/call', { name: 'add_nodes', arguments: { file: 'uji-mcp.json', nodes: [{ type: 'diffuser', x: 2000, y: 2000 }] } }),
    rpc(5, 'tools/call', { name: 'export_dxf', arguments: { file: 'uji-mcp.json' } }),
    rpc(6, 'tools/call', { name: 'add_nodes', arguments: { file: '../luar.json', nodes: [] } })].join('\n') + '\n',
}).stdout.trim().split('\n').map(l => JSON.parse(l));
assert.deepStrictEqual(out.map(m => m.id), [1, 2, 3, 4, 5, 6], 'notifikasi tidak dibalas, sisanya dibalas berurutan');
assert.strictEqual(out[0].result.serverInfo.name, 'temandor');
assert.ok(out[1].result.tools.some(t => t.name === 'draw_duct') && out[1].result.tools.some(t => t.name === 'export_dxf'));
assert.ok(!out[3].result.isError && JSON.parse(fs.readFileSync(path.join(tmp, 'uji-mcp.json'), 'utf8')).nodes.length === 2);
assert.ok(fs.readFileSync(path.join(tmp, 'uji-mcp.dxf'), 'utf8').trim().endsWith('EOF'));
assert.ok(out[5].result.isError, 'file di luar folder proyek ditolak');
fs.rmSync(tmp, { recursive: true, force: true });

console.log('OK – semua cek lulus');
