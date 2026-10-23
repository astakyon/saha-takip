import { S, makeAdapter, getConfig, setConfig } from './db.js';
import { app, loadFilters } from './state.js';
import { esc, toast, closeDrawer } from './ui.js';
import { listeleriUygula } from './listeler.js';
import { kisayolAl, canInstall, install, onInstallChange } from './kurulum.js';
import { paylasimAl, paylasimPaneli } from './paylas.js';
import { rotaIzinli, sahipMi, rotaYazilabilir } from './yetki.js';
import { menuDuzeni } from './menu.js';
import { BASLIKLAR, SEKME_AD, baslikOf } from './basliklar.js';
import { hizliKur, aramaAc } from './hizli.js';
import { filtreIzle } from './filtre.js';
import { temaUygula, yaziUygula } from './tema.js';
import { kurGuncelle } from './kur.js';
import { bildirimHazirla } from './bildirim.js';

// Ekranlar ancak açılınca yüklenir (ilk açılış hızlı)
const yukle = (yol, ad) => { let f = null; return async el => { f ||= (await import('./' + yol))[ad]; return f(el); }; };
const ROUTES = {
  bugun:     { t: 'Bugün', ico: 'sun', v: yukle('views/bugun.js', 'bugunView'), main: true, g: 'Saha' },
  harita:    { t: 'Harita', ico: 'map', v: yukle('views/map.js', 'mapView'), main: true, g: 'Saha' },
  projeler:  { t: 'Projeler', ico: 'folder', v: yukle('views/projeler.js', 'projelerView'), main: true, g: 'Saha' },
  takvim:    { t: 'Takvim', ico: 'cal', v: yukle('views/ziyaret.js', 'takvimView'), main: true, g: 'Saha' },
  firmalar:  { t: 'Firmalar', ico: 'building', v: yukle('views/firmalar.js', 'firmalarView'), main: true, g: 'Saha' },
  ziyaretler:{ t: 'Ziyaretler', ico: 'pin', v: yukle('views/ziyaret.js', 'ziyaretlerView'), g: 'Saha' },
  gorevler:  { t: 'Görevler', ico: 'check', v: yukle('views/ziyaret.js', 'gorevlerView'), g: 'Saha' },
  kisiler:   { t: 'Kişiler', ico: 'user', v: yukle('views/firmalar.js', 'kisilerView'), g: 'Saha' },
  bolgeler:  { t: 'Sanayi bölgeleri', ico: 'zone', v: yukle('views/bolgeler.js', 'bolgelerView'), g: 'Saha' },
  masraflar: { t: 'Masraf ve km', ico: 'wallet', v: yukle('views/kayitlar.js', 'masraflarView'), g: 'Saha' },
  dosyalar:  { t: 'Dosyalar', ico: 'doc', v: yukle('views/dosyalar.js', 'dosyalarView'), g: 'Saha' },
  tahsilat:  { t: 'Tahsilat', ico: 'coins', v: yukle('views/tahsilat.js', 'tahsilatView'), g: 'Satış' },
  bayi:      { t: 'Bayi paneli', ico: 'box', v: yukle('views/bayi.js', 'bayiView'), g: 'Satış' },
  teklifler: { t: 'Teklifler', ico: 'doc', v: yukle('views/teklif.js', 'tekliflerView'), g: 'Satış' },
  araclar:   { t: 'Aydınlatma araçları', ico: 'calc', v: yukle('views/araclar.js', 'araclarView'), g: 'Satış' },
  katalog:   { t: 'Ürün kataloğu', ico: 'book', v: yukle('views/katalog.js', 'katalogView'), g: 'Satış' },
  referanslar:{ t: 'Referanslar', ico: 'star', v: yukle('views/katalog.js', 'referanslarView'), g: 'Satış' },
  numuneler: { t: 'Numuneler', ico: 'gift', v: yukle('views/kayitlar.js', 'numunelerView'), g: 'Satış' },
  servis:    { t: 'Servis ve şikayet', ico: 'wrench', v: yukle('views/kayitlar.js', 'servisView'), g: 'Satış' },
  panel:     { t: 'Panel', ico: 'chart', v: yukle('views/panel.js', 'panelView'), g: 'Rapor' },
  rapor:     { t: 'Haftalık rapor', ico: 'report', v: yukle('views/rapor.js', 'raporView'), g: 'Rapor' },
  kontrol:   { t: 'Veri kontrolü', ico: 'check', v: yukle('views/kontrol.js', 'kontrolView'), g: 'Rapor' },
  siparisler:{ t: 'Siparişler', ico: 'receipt', v: yukle('views/panel.js', 'siparislerView'), g: 'Rapor' },
  urunler:   { t: 'Stok ve fiyat', ico: 'box', v: yukle('views/urunler.js', 'urunlerView'), g: 'Rapor' },
  rakip:     { t: 'Rakip fiyatları', ico: 'tag', v: yukle('views/urunler.js', 'rakipView'), g: 'Rapor' },
  ayarlar:   { t: 'Ayarlar', ico: 'gear', v: yukle('views/ayarlar.js', 'ayarlarView'), g: 'Rapor' },
};
const detay = (yol, ad) => async (...a) => (await import('./' + yol))[ad](...a);
const DETAIL = { proje: detay('views/projeler.js', 'projeDetay'), firma: detay('views/firmalar.js', 'firmaDetay'), kisi: detay('views/firmalar.js', 'kisiDetay') };
app.rotalar = ROUTES;

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

let navSon = 'bugun';
window.addEventListener('menu', () => renderNav(navSon));
const sonAlt = {};   // her başlıkta en son açılan ekran
const baslikRotasi = b => { const { gizli } = menuDuzeni(ROUTES); const rs = b.r.filter(r => ROUTES[r] && !gizli.has(r) && rotaIzinli(r)); if (b.k === 'urunler' && app.yetki?.yetkiler?._rol === 'Bayi' && rs.includes('bayi')) rs.unshift('bayi'); return rs.includes(sonAlt[b.k]) ? sonAlt[b.k] : rs[0]; };
function renderNav(cur) {
  const nav = document.getElementById('nav');
  const { ana, gorunur } = menuDuzeni(ROUTES);
  navSon = cur;
  const aktif = baslikOf(cur)?.k;
  const item = b => { const r = baslikRotasi(b); return r ? `<a href="#/${r}" class="${b.k === aktif ? 'on' : ''}" ${b.k === aktif ? 'aria-current="page"' : ''}>${icon(b.ico)}<span>${b.t}</span></a>` : ''; };
  const mode = app.db.mode === 'local' ? '<span class="mode-badge">Deneme modu</span>' : !sahipMi() ? `<span class="mode-badge">${esc(app.yetki?.yetkiler?._rol || 'Ekip üyesi')}${app.yetki?.ad ? ' · ' + esc(app.yetki.ad) : ''}</span>` : '';
  const anaB = ana.map(k => BASLIKLAR.find(b => b.k === k)).filter(Boolean), digerB = BASLIKLAR.filter(b => !ana.includes(b.k) && gorunur(b));
  nav.innerHTML = `
    <div class="brand"><span class="bulb" aria-hidden="true"></span><b>Saha Takip</b>${mode}</div>
    <button type="button" class="nav-ara" data-navara><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Ara</span><kbd>/</kbd></button>
    <div class="nav-main">${anaB.map(item).join('')}
      <button class="nav-more ${!ana.includes(aktif) ? 'on' : ''}" type="button" aria-haspopup="true">${icon('more')}<span>Diğer</span></button></div>
    <div class="nav-rest">${digerB.map(item).join('')}
      <button type="button" class="nav-inst" data-inst ${canInstall() ? '' : 'hidden'}>${icon('down')}<span>Telefona yükle</span></button>
      <a href="#/ayarlar" class="nav-duzen" data-menuduzen>${icon('gear', 18)}<span>Menüyü düzenle</span></a></div>`;
  nav.querySelector('[data-navara]').onclick = () => aramaAc();
  // Bekleyen kayıt rozeti menüden bağımsız (telefonda menü başlığı gizli olduğu için)
  if (!document.getElementById('bekleyen')) { const b = document.createElement('button'); b.type = 'button'; b.id = 'bekleyen'; b.className = 'bekleyen'; b.hidden = true; b.title = 'Buluta gönderilmeyi bekleyen kayıtlar'; b.onclick = async () => (await import('./bekleyen.js')).bekleyenPaneli(); document.body.appendChild(b); }
  bekleyenGuncelle();
  nav.querySelector('[data-menuduzen]').addEventListener('click', () => { try { sessionStorage.setItem('menu-ac', '1'); } catch {} if (location.hash === '#/ayarlar') window.dispatchEvent(new HashChangeEvent('hashchange')); });
  nav.querySelector('[data-inst]').onclick = () => { nav.classList.remove('more-open'); install(); };
  nav.querySelector('.nav-more').onclick = () => nav.classList.toggle('more-open');
  nav.querySelectorAll('.nav-rest a').forEach(a => a.addEventListener('click', () => nav.classList.remove('more-open')));
}

let lastView = null, lastShown = null; const kayKonum = {};
const saltOku = k => document.body.classList.toggle('salt-oku', !sahipMi() && !rotaYazilabilir(k));
async function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'bugun').split('/');
  const [k, id] = parts;
  if (DETAIL[k] && !rotaIzinli({ proje: 'projeler', firma: 'firmalar', kisi: 'kisiler' }[k])) { location.hash = '#/bugun'; return; }
  if (DETAIL[k]) {
    if (!lastView) await show('bugun');
    saltOku({ proje: 'projeler', firma: 'firmalar', kisi: 'kisiler' }[k]);
    DETAIL[k](id);
    return;
  }
  closeDrawer();
  if (ROUTES[k] && !rotaIzinli(k)) { location.hash = '#/bugun'; return; }
  await show(ROUTES[k] && rotaIzinli(k) ? k : 'bugun');
}
async function show(k) {
  lastView = k;
  saltOku(k);
  renderNav(k);
  const donus = lastShown !== k ? kayKonum[k] : null;
  if (lastShown && lastShown !== k) kayKonum[lastShown] = window.scrollY;   // içerik değişmeden önce
  const kok = document.getElementById('view');
  kok.className = 'view-' + k;
  document.title = ROUTES[k].t + ' · Saha Takip';
  // Başlığın içindeki ekranlar üstte sekme olarak (harita kendi araç çubuğunu kullanır)
  const b = baslikOf(k); if (b) sonAlt[b.k] = k;
  const { gizli } = menuDuzeni(ROUTES);
  const sekmeler = b ? b.r.filter(r => ROUTES[r] && !gizli.has(r) && rotaIzinli(r)) : [];
  kok.innerHTML = (k !== 'harita' && sekmeler.length > 1 ? `<nav class="alt-sekme" aria-label="${esc(b.t)}">${sekmeler.map(r => `<a href="#/${r}" class="${r === k ? 'on' : ''}" ${r === k ? 'aria-current="page"' : ''}>${esc(SEKME_AD[r] || ROUTES[r].t)}</a>`).join('')}</nav>` : '')
    + `<button type="button" class="sayfa-ara" aria-label="Ara" title="Ara (/)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button><div class="view-ic"></div>`;
  kok.querySelector('.sayfa-ara').onclick = () => aramaAc();
  const el = kok.querySelector('.view-ic');
  app.refresh = () => ROUTES[k].v(el);
  // Ekranlar arası geçişte her ekranın kaydırma konumu hatırlanır
  if (lastShown !== k) { window.scrollTo(0, 0); el.scrollTop = 0; } lastShown = k;
  await ROUTES[k].v(el);
  if (donus > 0) {
    for (let i = 0; i < 30 && document.documentElement.scrollHeight < donus + innerHeight; i++) { const p = kok.querySelector('.parcali-kok')?._parcali; if (!p || !p.ekle(200)) break; }
    window.scrollTo(0, donus);
  }
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
let otoKuruldu = false;
async function boot() {
  loadFilters();
  davetAl();
  app.db = makeAdapter();
  const view = document.getElementById('view');
  view.innerHTML = '<div class="boot"><span class="bulb big"></span><p>Veriler yükleniyor…</p></div>';
  try {
    const ok = await app.db.init();
    if (app.db.mode === 'supabase' && !ok) { document.getElementById('nav').innerHTML = ''; return (await import('./views/ayarlar.js')).loginView(view, boot); }
    if (app.db.mode === 'supabase') {
      const g = await import('./guvenlik.js');
      if (await g.otoCikisGerekli()) return;
      if (await g.ikinciAdimGerekli()) { document.getElementById('nav').innerHTML = ''; return g.ikinciAdimEkrani(view, boot); }
      if (!otoKuruldu) { otoKuruldu = true; g.otoCikisKur(); }
    }
    await app.db.loadAll({ hizli: true });
    app.yetki = app.db.yetki || null;
    listeleriUygula();
    if (app.db.mode === 'supabase') import('./guvenlik.js').then(g => g.gorundum());
    temaUygula(); yaziUygula();
    app.ekip = [];
    if (app.db.mode === 'supabase' && sahipMi()) app.db.c.from('ekip_uyeleri').select('eposta,ad,aktif,yetkiler').then(({ data }) => { app.ekip = (data || []).filter(u => u.aktif); if (app.ekip.length && ['gorevler', 'bugun'].includes(lastView) && !document.querySelector('.drawer.open')) app.refresh(); }).catch(() => {});
    if (app.db.offline) toast('Çevrimdışısın: son kaydedilen veriler gösteriliyor.');
  } catch (e) {
    view.innerHTML = `<div class="empty"><h2>Veriler yüklenemedi</h2><p>${esc(e.message)}</p><p><a class="btn" href="#/ayarlar">Bağlantı ayarlarını aç</a></p></div>`;
    renderNav('ayarlar'); app.refresh = () => ROUTES.ayarlar.v(view);
    window.addEventListener('hashchange', () => {}, { once: true });
    return;
  }
  const act = kisayolAl();
  const pay = paylasimAl();
  const empty = Object.values(S).every(a => !a.length);
  if (empty && !location.hash) location.hash = '#/ayarlar';
  filtreIzle(document.getElementById('view'), () => lastView);
  import('./baslik.js').then(m => m.basliklariIzle(document.getElementById('view')));
  await route();
  hizliKur();
  if (act === 'ziyaret') import('./views/ziyaret.js').then(m => m.ziyaretForm({}));
  if (act === 'ara') aramaAc();
  if (pay) paylasimPaneli(pay);
  kurGuncelle().then(k => { if (k && lastView === 'bugun' && !document.querySelector('.drawer.open')) app.refresh(); }).catch(() => {});
  bildirimHazirla().catch(() => {});
  // Boşta: haftalık otomatik yedek ve Excel aracını önceden önbelleğe alma (çevrimdışı Excel için)
  setTimeout(() => {
    import('./otoyedek.js').then(m => m.otoYedekKontrol()).catch(() => {});
    if (!navigator.connection?.saveData) fetch('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', { mode: 'no-cors' }).catch(() => {});
  }, 20000);
}
// Açılışta telefondaki kopya gösterildi; buluttaki yeni veri gelince ekranı sessizce yenile
window.addEventListener('veri-tazelendi', () => {
  const yetkiDegisti = JSON.stringify(app.yetki) !== JSON.stringify(app.db.yetki);
  app.yetki = app.db.yetki || app.yetki; listeleriUygula(); sonTazele = Date.now();
  if (yetkiDegisti) renderNav(navSon);
  if (!document.querySelector('.drawer.open') && !document.activeElement?.matches?.('input, textarea, select') && app.refresh) { const y = window.scrollY; Promise.resolve(app.refresh()).then(() => window.scrollTo(0, y)); }
  bekleyenGuncelle();
});
window.addEventListener('schema-old', () => toast('Veritabanı güncel değil: Supabase SQL Editor\'de supabase/schema.sql dosyasını yeniden çalıştır. Yeni alanlar (Google bilgileri) o zamana kadar kaydedilmez.', 'err'));
window.addEventListener('outbox', e => { if (e.detail) toast('Bağlantı yok: değişiklik kaydedildi, internet gelince gönderilecek.'); bekleyenGuncelle(); });
window.addEventListener('outbox-gonderim', () => bekleyenGuncelle());
// Gönderilmeyi bekleyen kayıt sayısı (menüde rozet); sıfıra inince “gönderildi” bildirimi
let sonBekleyen = 0;
async function bekleyenGuncelle() {
  const n = app.db?.pending ? await app.db.pending().catch(() => 0) : 0;
  const b = document.getElementById('bekleyen');
  const hata = n && app.db?.bekleyenler ? (await app.db.bekleyenler()).some(o => o.hata) : false;
  if (b) { b.hidden = !n; b.textContent = n ? `${n} kayıt ${hata ? 'gönderilemedi' : 'bekliyor'}` : ''; b.classList.toggle('hata', hata); }
  if (sonBekleyen && !n) toast('Bekleyen kayıtlar gönderildi.');
  sonBekleyen = n;
}
window.addEventListener('online', () => setTimeout(bekleyenGuncelle, 3000));
setInterval(bekleyenGuncelle, 30000);
window.__reboot = boot;
// Ekipten gelen değişiklikler: uygulamaya geri dönüldüğünde (2 dk'dan fazla geçtiyse) ve açıkken 5 dk'da bir verileri sessizce tazele
let sonTazele = Date.now(), tazeleniyor = false;
async function tazele(zorla) {
  if (tazeleniyor || !app.db || app.db.mode !== 'supabase' || !navigator.onLine || document.hidden) return;
  if (!zorla && Date.now() - sonTazele < 120000) return;
  tazeleniyor = true;
  try { await (app.db.tazeYukle ? app.db.tazeYukle() : app.db.loadAll()); app.yetki = app.db.yetki || app.yetki; listeleriUygula(); sonTazele = Date.now(); if (!document.querySelector('.drawer.open') && !document.activeElement?.matches?.('input, textarea, select')) { const y = window.scrollY; app.refresh(); window.scrollTo(0, y); } }
  catch {} finally { tazeleniyor = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) tazele(); });
window.addEventListener('focus', () => tazele());
setInterval(() => { if (Date.now() - sonTazele > 300000) tazele(true); }, 60000);
onInstallChange(() => { const b = document.querySelector('[data-inst]'); if (b) b.hidden = !canInstall(); });

// Beklenmeyen hatalar: ekranda kısa bir not (sorunu bildirmek için ekran görüntüsü yeterli olsun)
let sonHata = 0;
function hataGoster(m, dosya, satir) {
  if (!m || /^Script error|ResizeObserver/i.test(m) || Date.now() - sonHata < 3000) return; sonHata = Date.now();
  const yer = dosya ? ' (' + String(dosya).split('/').slice(-2).join('/').replace(/\?.*$/, '') + (satir ? ':' + satir : '') + ')' : '';
  console.error('Saha Takip hata:', m, yer);
  try { toast('Hata: ' + m + yer, 'err'); } catch {}
}
window.addEventListener('error', e => hataGoster(e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e => { const r = e.reason; hataGoster(r?.message || String(r || ''), (r?.stack || '').match(/https?:\/\/[^\s)]+?\.js/)?.[0], (r?.stack || '').match(/\.js:(\d+)/)?.[1]); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Yeni sürüm kurulunca: güvenli anda kendiliğinden yenile, değilse haber ver
  const ilkKontrol = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!ilkKontrol) return;
    const guvenli = () => !document.querySelector('.drawer.open') && !document.activeElement?.matches?.('input, textarea, select');
    if (guvenli() && document.hidden) location.reload();
    else { toast('Uygulamanın yeni sürümü hazır. Yenilemek için dokun.'); const t = document.getElementById('toast'); if (t) { t.classList.add('tik'); t.onclick = () => location.reload(); setTimeout(() => { t.onclick = null; t.classList.remove('tik'); }, 8000); } document.addEventListener('visibilitychange', () => { if (document.hidden && guvenli()) location.reload(); }, { once: true }); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
