#!/usr/bin/env node
// Temandor MCP server – stdio, tanpa dependensi. Membaca & mengubah file proyek Temandor (.json) di satu folder,
// memakai logika yang sama dengan editor (app/js). File .json bisa dibuka di editor lewat "Buka file .json".
// Folder proyek: env TEMANDOR_DIR, default ~/Temandor.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), readline = require('readline');

const ctx = vm.createContext({ structuredClone, Math, JSON, console: { log() {}, warn() {}, error: (...a) => process.stderr.write(a.join(' ') + '\n') } });
for (const f of ['geom.js', 'model.js', 'dxf.js', 'tools.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'js', f), 'utf8'), ctx, { filename: f });
const G = code => vm.runInContext(code, ctx);
const { newProject, demoProject, withLayers, toDXF } = ctx, LAYERS = G('LAYERS'), toolDefs = G('toolDefs'), runTool = G('runTool'), toolReadOnly = G('toolReadOnly');

const DIR = path.resolve(process.env.TEMANDOR_DIR || path.join(os.homedir(), 'Temandor'));
fs.mkdirSync(DIR, { recursive: true });
// Hanya file .json di dalam DIR (tolak ../ dan path absolut ke luar)
function fileOf(name) {
  const f = path.resolve(DIR, String(name || ''));
  if (!f.startsWith(DIR + path.sep) || !f.endsWith('.json')) throw new Error(`File harus .json di dalam ${DIR}`);
  return f;
}
function load(name) {
  const f = fileOf(name);
  if (!fs.existsSync(f)) throw new Error(`File ${name} tidak ada. Pakai list_projects atau create_project.`);
  const p = withLayers(JSON.parse(fs.readFileSync(f, 'utf8')));
  if (!p || !Array.isArray(p.nodes)) throw new Error(`${name} bukan file proyek Temandor`);
  return p;
}
const save = (name, p) => { p.updated = Date.now(); fs.writeFileSync(fileOf(name), JSON.stringify(p, null, 1)); };
const slug = s => (s || 'proyek').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyek';
const FILE = { file: { type: 'string', description: 'Nama file proyek di folder Temandor, mis. "kantor-lt-2.json"' } };

const FILE_TOOLS = [
  {
    name: 'list_projects', description: `Daftar file proyek Temandor di ${DIR}.`, input_schema: { type: 'object', properties: {} },
    run: () => ({ folder: DIR, projects: fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(file => {
      try { const p = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); return { file, name: p.name, unit: p.unit, nodes: (p.nodes || []).length }; } catch { return { file, error: 'tidak terbaca' }; }
    }) }),
  },
  {
    name: 'create_project', description: 'Buat file proyek baru (berisi satu ruangan 6 x 4 m). demo=true untuk proyek contoh lengkap.',
    input_schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, unit: { type: 'string', enum: ['inch', 'mm'], description: 'Satuan ukuran duct' }, demo: { type: 'boolean' } } },
    run({ name, unit = 'inch', demo }) {
      const p = demo ? Object.assign(demoProject(), { name }) : newProject({ name, unit });
      let file = slug(name) + '.json';
      for (let i = 2; fs.existsSync(path.join(DIR, file)); i++) file = `${slug(name)}-${i}.json`;
      save(file, p);
      return { file, path: path.join(DIR, file) };
    },
  },
  {
    name: 'export_dxf', description: 'Export proyek ke file .dxf (AutoCAD) di sebelah file .json-nya, semua layer.',
    input_schema: { type: 'object', required: ['file'], properties: { ...FILE, unit: { type: 'string', enum: ['mm', 'inch'], description: 'Satuan file DXF' } } },
    run({ file, unit = 'mm' }) {
      const p = load(file), out = fileOf(file).replace(/\.json$/, '.dxf');
      fs.writeFileSync(out, toDXF(p, { layers: new Set(LAYERS.map(l => l[0])), unit, note: true }));
      return { path: out };
    },
  },
];
// Aksi gambar dari app/js/tools.js, ditambah parameter file
const PROJECT_TOOLS = toolDefs().map(t => ({
  ...t,
  input_schema: { ...t.input_schema, required: ['file', ...(t.input_schema.required || [])], properties: { ...FILE, ...t.input_schema.properties } },
  run({ file, ...input }) { const p = load(file), out = runTool(p, t.name, input); if (!toolReadOnly(t.name)) save(file, p); return out; },
}));
const TOOLS = [...FILE_TOOLS, ...PROJECT_TOOLS];

function handle({ method, params = {} }) {
  if (method === 'initialize') return {
    protocolVersion: params.protocolVersion || '2025-06-18',
    capabilities: { tools: {} },
    serverInfo: { name: 'temandor', version: '0.1.0' },
    instructions: 'Temandor: sketsa ducting & ventilasi. Satuan mm, y ke bawah. Panggil get_project sebelum mengubah gambar, lalu cek warnings setelahnya.',
  };
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: TOOLS.map(({ name, description, input_schema }) => ({ name, description, inputSchema: input_schema })) };
  if (method === 'tools/call') {
    const t = TOOLS.find(x => x.name === params.name);
    if (!t) throw Object.assign(new Error(`Tool ${params.name} tidak ada`), { code: -32602 });
    try { return { content: [{ type: 'text', text: JSON.stringify(t.run(params.arguments || {}), null, 1) }] }; }
    catch (e) { return { content: [{ type: 'text', text: e.message }], isError: true }; } // salah input: kembalikan ke model, bukan error protokol
  }
  throw Object.assign(new Error(`Method ${method} tidak didukung`), { code: -32601 });
}

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
readline.createInterface({ input: process.stdin }).on('line', line => {
  let m;
  try { m = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON tidak valid' } }); }
  if (m.id === undefined) return; // notifikasi
  try { send({ jsonrpc: '2.0', id: m.id, result: handle(m) }); }
  catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: e.code || -32603, message: e.message } }); }
});
