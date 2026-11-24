// Temandor – helper UI bersama. Dimuat di <head> tepat setelah Tailwind CDN.
if (window.tailwind) tailwind.config = {
  theme: { extend: {
    fontFamily: { sans: ['Barlow', 'sans-serif'], cond: ['"Barlow Condensed"', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] },
    colors: { paper: '#f3f2ee', panel: '#fbfaf7', ink: '#17191c', line: '#dfdcd4', muted: '#64625d', hazard: '#f2c200', cad: '#14171b' },
  } },
};

if (localStorage.getItem('temandor.theme') === 'light') document.documentElement.classList.add('light');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// toast('Pesan') atau toast('Pesan', { label: 'Urungkan', fn }) → tombol aksi, tampil lebih lama
function toast(msg, action) {
  let t = $('#toast');
  if (!t) { t = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast', role: 'status' }); document.body.append(t); }
  t.replaceChildren(msg);
  if (action) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'toast-act', textContent: action.label });
    b.onclick = () => { t.classList.remove('show'); action.fn(); };
    t.append(b);
  }
  t.classList.add('show');
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 2800);
}

function download(name, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Link donasi (Temandor open source). Isi url akun kamu; yang kosong tampil sebagai "segera".
const DONATE = [
  { name: 'Saweria', url: '', note: 'QRIS, GoPay, OVO, DANA, bank' },
  { name: 'Trakteer', url: '', note: 'Traktir kopi, e-wallet & bank' },
  { name: 'GitHub Sponsors', url: '', note: 'Kartu, bisa rutin bulanan' },
  { name: 'Ko-fi', url: '', note: 'PayPal & kartu, dari luar negeri' },
];
const donateHTML = () => DONATE.map(d => d.url
  ? `<a class="donate-card" href="${d.url}" target="_blank" rel="noopener"><b>${d.name}</b><span>${d.note}</span></a>`
  : `<div class="donate-card off" title="Link belum tersedia"><b>${d.name}</b><span>${d.note} · segera</span></div>`).join('');

// Waktu relatif: "5 menit yang lalu"
const ago = t => {
  const s = (Date.now() - t) / 1000, rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
  if (s < 60) return 'baru saja';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 7) return rtf.format(-Math.round(s / 86400), 'day');
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
const slug = s => (s || 'proyek').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyek';

// Akun MOCK (ADR 0001): hanya flag di browser ini, bukan sesi asli.
const USER_KEY = 'temandor.mockUser';
const mockUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
const here = () => encodeURIComponent(location.pathname.split('/').pop() + location.search);
const loginURL = (mode = 'masuk') => `login.html?mode=${mode}&next=${here()}`;
function authSlot() { // isi <span data-auth>: tombol Masuk, atau avatar → Pengaturan
  const el = $('[data-auth]'), u = mockUser();
  if (!el) return;
  if (!u) { el.innerHTML = `<a class="btn-ghost" href="${loginURL()}">Masuk</a>`; return; }
  const a = Object.assign(document.createElement('a'), { href: 'settings.html#akun', className: 'avatar', title: `${u.name} · Pengaturan akun`, textContent: u.name.trim()[0].toUpperCase() });
  a.setAttribute('aria-label', 'Akun ' + u.name);
  el.replaceChildren(a);
}

document.addEventListener('DOMContentLoaded', () => {
  authSlot();
  $$('[data-open]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.open).showModal()));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
});
