import { S, makeAdapter, getConfig, setConfig } from './db.js';
import { app, loadFilters } from './state.js';
import { esc, toast, closeDrawer } from './ui.js';
import { mapView } from './views/map.js';
import { projelerView, projeDetay } from './views/projeler.js';
import { firmalarView, firmaDetay, kisilerView, kisiDetay } from './views/firmalar.js';
import { ziyaretlerView, gorevlerView, ziyaretForm, takvimView } from './views/ziyaret.js';
import { bolgelerView } from './views/bolgeler.js';
import { urunlerView, rakipView } from './views/urunler.js';
import { panelView, siparislerView } from './views/panel.js';
import { ayarlarView, loginView } from './views/ayarlar.js';
import { kisayolAl, canInstall, install, onInstallChange } from './kurulum.js';
import { bugunView } from './views/bugun.js';
import { araclarView } from './views/araclar.js';
import { tekliflerView } from './views/teklif.js';
import { katalogView, referanslarView } from './views/katalog.js';
import { numunelerView, servisView, masraflarView } from './views/kayitlar.js';
import { paylasimAl, paylasimPaneli } from './paylas.js';
import { tahsilatView } from './views/tahsilat.js';
import { raporView } from './views/rapor.js';
import { kontrolView } from './views/kontrol.js';
import { dosyalarView } from './views/dosyalar.js';
import { rotaIzinli, sahipMi } from './yetki.js';
import { kurGuncelle } from './kur.js';
import { bildirimHazirla } from './bildirim.js';

const ROUTES = {
  bugun:     { t: 'Bugün', ico: 'sun', v: bugunView, main: true },
  harita:    { t: 'Harita', ico: 'map', v: mapView, main: true },
  projeler:  { t: 'Projeler', ico: 'folder', v: projelerView, main: true },
  takvim:    { t: 'Takvim', ico: 'cal', v: takvimView, main: true },
  firmalar:  { t: 'Firmalar', ico: 'building', v: firmalarView, main: true },
  ziyaretler:{ t: 'Ziyaretler', ico: 'pin', v: ziyaretlerView, g: 'Saha' },
  gorevler:  { t: 'Görevler', ico: 'check', v: gorevlerView, g: 'Saha' },
  kisiler:   { t: 'Kişiler', ico: 'user', v: kisilerView, g: 'Saha' },
  bolgeler:  { t: 'Sanayi bölgeleri', ico: 'zone', v: bolgelerView, g: 'Saha' },
  masraflar: { t: 'Masraf ve km', ico: 'wallet', v: masraflarView, g: 'Saha' },
  dosyalar:  { t: 'Dosyalar', ico: 'doc', v: dosyalarView, g: 'Saha' },
  tahsilat:  { t: 'Tahsilat', ico: 'coins', v: tahsilatView, g: 'Satış' },
  teklifler: { t: 'Teklifler', ico: 'doc', v: tekliflerView, g: 'Satış' },
  araclar:   { t: 'Aydınlatma araçları', ico: 'calc', v: araclarView, g: 'Satış' },
  katalog:   { t: 'Ürün kataloğu', ico: 'book', v: katalogView, g: 'Satış' },
  referanslar:{ t: 'Referanslar', ico: 'star', v: referanslarView, g: 'Satış' },
  numuneler: { t: 'Numuneler', ico: 'gift', v: numunelerView, g: 'Satış' },
  servis:    { t: 'Servis ve şikayet', ico: 'wrench', v: servisView, g: 'Satış' },
  panel:     { t: 'Panel', ico: 'chart', v: panelView, g: 'Rapor' },
  rapor:     { t: 'Haftalık rapor', ico: 'report', v: raporView, g: 'Rapor' },
  kontrol:   { t: 'Veri kontrolü', ico: 'check', v: kontrolView, g: 'Rapor' },
  siparisler:{ t: 'Siparişler', ico: 'receipt', v: siparislerView, g: 'Rapor' },
  urunler:   { t: 'Stok ve fiyat', ico: 'box', v: urunlerView, g: 'Rapor' },
  rakip:     { t: 'Rakip fiyatları', ico: 'tag', v: rakipView, g: 'Rapor' },
  ayarlar:   { t: 'Ayarlar', ico: 'gear', v: ayarlarView, g: 'Rapor' },
};
const DETAIL = { proje: projeDetay, firma: firmaDetay, kisi: kisiDetay };

const ICONS = {
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m6 7H2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h4"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5L12 12 4 7.5"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  zone: '<path d="M4 7l6-3 6 3 4-2v13l-4 2-6-3-6 3V7Z" stroke-dasharray="3 2"/><circle cx="12" cy="11" r="2"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  doc: '<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2m3 0h3M8 16h2m3 0h3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5Z"/><path d="M4 20a2 2 0 0 0 2 1h13v-3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  gift: '<rect x="4" y="9" width="16" height="12" rx="1"/><path d="M3 9h18M12 9v12M12 9c-1.5-4-6-4-5-1.5S12 9 12 9Zm0 0c1.5-4 6-4 5-1.5S12 9 12 9Z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 0-5-5l2.6 2.6-2.1 2.1L9.6 5.8a4 4 0 0 0 5.1.5Z"/><path d="M3 21l6-6"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 12v5c0 1.7 2.7 3 6 3 1.2 0 2.3-.2 3.2-.5"/><circle cx="17" cy="16" r="4"/>',
  report: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2M6 6l9-3 2 3"/>',
};
export const icon = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

function renderNav(cur) {
  const nav = document.getElementById('nav');
  const item = (k, r) => `<a href="#/${k}" class="${k === cur ? 'on' : ''}" ${k === cur ? 'aria-current="page"' : ''}>${icon(r.ico)}<span>${r.t}</span></a>`;
  const mode = app.db.mode === 'local' ? '<span class="mode-badge">Deneme modu</span>' : !sahipMi() ? `<span class="mode-badge">Ekip üyesi${app.yetki?.ad ? ' · ' + esc(app.yetki.ad) : ''}</span>` : '';
  nav.innerHTML = `
    <div class="brand"><span class="bulb" aria-hidden="true"></span><b>Saha Takip</b>${mode}</div>
    <div class="nav-main">${Object.entries(ROUTES).filter(([k, r]) => r.main && rotaIzinli(k)).map(([k, r]) => item(k, r)).join('')}
      <button class="nav-more ${!ROUTES[cur]?.main ? 'on' : ''}" type="button" aria-haspopup="true">${icon('more')}<span>Diğer</span></button></div>
    <div class="nav-rest">${['Saha', 'Satış', 'Rapor'].map(g => `<p class="nav-g">${g}</p>` + Object.entries(ROUTES).filter(([k, r]) => r.g === g && rotaIzinli(k)).map(([k, r]) => item(k, r)).join('')).join('')}
      <button type="button" class="nav-inst" data-inst ${canInstall() ? '' : 'hidden'}>${icon('down')}<span>Telefona yükle</span></button></div>`;
  nav.querySelector('[data-inst]').onclick = () => { nav.classList.remove('more-open'); install(); };
  nav.querySelector('.nav-more').onclick = () => nav.classList.toggle('more-open');
  nav.querySelectorAll('.nav-rest a').forEach(a => a.addEventListener('click', () => nav.classList.remove('more-open')));
}

let lastView = null, lastShown = null;
async function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'bugun').split('/');
  const [k, id] = parts;
  if (DETAIL[k] && !rotaIzinli({ proje: 'projeler', firma: 'firmalar', kisi: 'kisiler' }[k])) { location.hash = '#/bugun'; return; }
  if (DETAIL[k]) {
    if (!lastView) await show('bugun');
    DETAIL[k](id);
    return;
  }
  closeDrawer();
  if (ROUTES[k] && !rotaIzinli(k)) { location.hash = '#/bugun'; return; }
  await show(ROUTES[k] && rotaIzinli(k) ? k : 'bugun');
}
async function show(k) {
  lastView = k;
  renderNav(k);
  const el = document.getElementById('view');
  el.className = 'view-' + k;
  document.title = ROUTES[k].t + ' · Saha Takip';
  app.refresh = () => ROUTES[k].v(el);
  if (lastShown !== k) { window.scrollTo(0, 0); el.scrollTop = 0; } lastShown = k;
  await ROUTES[k].v(el);
}
// Detay paneli kapanınca adres çubuğunu listeye döndür (görünümü yeniden çizmeden)
export function backToList(redraw = false) {
  if (lastView && /^#\/(proje|firma|kisi)\//.test(location.hash)) history.replaceState(null, '', '#/' + lastView);
  if (redraw) app.refresh();
}
export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.addEventListener('hashchange', route);

// Davet bağlantısı: ?davet=… (Supabase adresi ve herkese açık anahtar) → bu cihazı aynı veritabanına bağlar
function davetAl() {
  let q; try { q = new URLSearchParams(location.search); } catch { return; }
  const d = q.get('davet'); if (!d) return;
  try {
    const j = JSON.parse(decodeURIComponent(escape(atob(d.replace(/-/g, '+').replace(/_/g, '/')))));
    if (/^https:\/\//.test(j.u) && j.k) { setConfig({ mode: 'supabase', url: j.u, key: j.k }); if (j.e) sessionStorage.setItem('saha-davet', j.e); }
  } catch {}
  history.replaceState(null, '', location.pathname + location.hash);
}
async function boot() {
  loadFilters();
  davetAl();
  app.db = makeAdapter();
  const view = document.getElementById('view');
  view.innerHTML = '<div class="boot"><span class="bulb big"></span><p>Veriler yükleniyor…</p></div>';
  try {
    const ok = await app.db.init();
    if (app.db.mode === 'supabase' && !ok) { document.getElementById('nav').innerHTML = ''; return loginView(view, boot); }
    await app.db.loadAll();
    app.yetki = app.db.yetki || null;
    if (app.db.offline) toast('Çevrimdışısın: son kaydedilen veriler gösteriliyor.');
  } catch (e) {
    view.innerHTML = `<div class="empty"><h2>Veriler yüklenemedi</h2><p>${esc(e.message)}</p><p><a class="btn" href="#/ayarlar">Bağlantı ayarlarını aç</a></p></div>`;
    renderNav('ayarlar'); app.refresh = () => ayarlarView(view);
    window.addEventListener('hashchange', () => {}, { once: true });
    return;
  }
  const act = kisayolAl();
  const pay = paylasimAl();
  const empty = Object.values(S).every(a => !a.length);
  if (empty && !location.hash) location.hash = '#/ayarlar';
  await route();
  if (act === 'ziyaret') ziyaretForm({});
  if (pay) paylasimPaneli(pay);
  kurGuncelle().then(k => { if (k && lastView === 'bugun' && !document.querySelector('.drawer.open')) app.refresh(); }).catch(() => {});
  bildirimHazirla().catch(() => {});
}
window.addEventListener('schema-old', () => toast('Veritabanı güncel değil: Supabase SQL Editor\'de supabase/schema.sql dosyasını yeniden çalıştır. Yeni alanlar (Google bilgileri) o zamana kadar kaydedilmez.', 'err'));
window.addEventListener('outbox', e => { if (e.detail) toast('Bağlantı yok: değişiklik kaydedildi, internet gelince gönderilecek.'); });
window.__reboot = boot;
onInstallChange(() => { const b = document.querySelector('[data-inst]'); if (b) b.hidden = !canInstall(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
