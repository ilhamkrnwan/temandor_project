// Temandor – katalog template (MOCK), dipakai beranda, detail template, checkout.
// Butuh geom.js + model.js.
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
const tplById = id => TEMPLATES.find(t => t.id === id);
function tplInfo(t) {
  const p = t.make(), rooms = p.nodes.filter(n => n.type === 'room');
  return { p, rooms: rooms.length, m2: Math.round(rooms.reduce((a, n) => a + Math.abs(polyArea(roomPts(n))), 0) / 1e6), dif: p.nodes.filter(n => n.type === 'diffuser').length };
}
const thumbSVG = p => docSVG(p, { pal: document.documentElement.classList.contains('light') ? 'light' : 'screen', sw: 0 }).svg.replace('<svg ', '<svg class="w-full h-full" preserveAspectRatio="xMidYMid meet" ');
// Template yang sudah "dibeli" (mock, di browser)
const OWNED = 'temandor.owned';
const owned = () => JSON.parse(localStorage.getItem(OWNED) || '[]');
const own = id => localStorage.setItem(OWNED, JSON.stringify([...new Set([...owned(), id])]));
const canUse = t => !t.price || owned().includes(t.id);
function useTemplate(t) { const p = t.make(); saveProject(p); location.href = 'editor.html?id=' + p.id; }
const STAR = '<svg viewBox="0 0 24 24" class="inline w-3.5 h-3.5 -mt-0.5 text-hazard" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
