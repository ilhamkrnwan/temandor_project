// Temandor – helper UI bersama. Dimuat di <head> tepat setelah Tailwind CDN.
if (window.tailwind) tailwind.config = {
  theme: { extend: {
    fontFamily: { sans: ['Barlow', 'sans-serif'], cond: ['"Barlow Condensed"', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] },
    colors: { paper: '#f3f2ee', panel: '#fbfaf7', ink: '#17191c', line: '#dfdcd4', muted: '#6d6b66', hazard: '#f2c200', cad: '#14171b' },
  } },
};

if (localStorage.getItem('temandor.theme') === 'light') document.documentElement.classList.add('light');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove('show'), 2800);
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

const slug = s => (s || 'proyek').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyek';

document.addEventListener('DOMContentLoaded', () => {
  $$('[data-open]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.open).showModal()));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
});
