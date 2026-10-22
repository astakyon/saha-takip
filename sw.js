// Saha Takip service worker: uygulama dosyalarını ve harita karolarını önbelleğe alır
const V = 'saha-v12';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-180.png', 'icons/icon.svg', 'js/kurulum.js', 'js/birlestir.js', 'js/google.js', 'js/views/ice-aktar.js',
  'js/main.js', 'js/altlik.js', 'js/osm-bolge.js', 'js/tasima.js', 'js/yetki.js', 'js/views/kullanicilar.js', 'js/menu.js', 'js/hizli.js', 'js/db.js', 'js/ui.js', 'js/forms.js', 'js/state.js',
  'js/views/map.js', 'js/views/projeler.js', 'js/views/firmalar.js', 'js/views/ziyaret.js',
  'js/views/urunler.js', 'js/views/panel.js', 'js/views/ayarlar.js', 'js/views/bolgeler.js', 'js/geo.js', 'js/data/iller.js',
  'js/ayar.js', 'js/sablon.js', 'js/sunum.js', 'js/zip.js', 'js/pptx.js', 'js/pptx-tema.js', 'js/paylas.js',
  'js/views/bugun.js', 'js/views/araclar.js', 'js/views/teklif.js', 'js/views/katalog.js', 'js/views/kayitlar.js',
  'js/belgeler.js', 'js/ocr.js', 'js/ses.js', 'js/grafik.js', 'js/kur.js', 'js/bildirim.js', 'js/views/tahsilat.js', 'js/views/rapor.js', 'js/ceyrek.js', 'js/views/kontrol.js', 'js/data/eae-katalog.js', 'js/views/dosyalar.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'tiles').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname.endsWith('supabase.co') || u.hostname.endsWith('supabase.in')) return;   // veri her zaman canlı
  if (/googleapis\.com$|gstatic\.com$|google\.com$|nominatim\./.test(u.hostname)) return;   // Google ve adres servisleri önbelleğe alınmaz
  const tile = /tile\.openstreetmap\.org|arcgisonline\.com/.test(u.hostname);
  if (tile) {
    e.respondWith(caches.open('tiles').then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // uygulama ve kütüphaneler: önce ağ, yoksa önbellek
  e.respondWith(fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(h => h || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

// ---------- Günlük hatırlatma bildirimi ----------
// Uygulamanın IndexedDB önbelleğindeki verilerden o günün özetini çıkarır (internet gerekmez).
function idbAc() { return new Promise((res, rej) => { const r = indexedDB.open('saha-takip', 2); r.onupgradeneeded = () => { const d = r.result; for (const s of ['kv', 'photos']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function idbIstek(d, fn, mod = 'readonly') { return new Promise((res, rej) => { const tx = d.transaction('kv', mod); const q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); }); }
const yerelTarih = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
async function veriOku(d) {
  const keys = await idbIstek(d, s => s.getAllKeys());
  const c = keys.find(k => String(k).startsWith('cache:') && k !== 'cache:undefined');
  if (c) return await idbIstek(d, s => s.get(c));
  const S = {}; for (const t of ['ziyaretler', 'gorevler', 'kisiler', 'firmalar', 'tahsilatlar', 'ayarlar']) S[t] = (await idbIstek(d, s => s.get('t:' + t))) || []; return S;
}
async function ozetGoster(zorla) {
  const d = await idbAc();
  const ay = (await idbIstek(d, s => s.get('bildirim-ayar'))) || {};
  if (!zorla && !ay.acik) return;
  const bugun = yerelTarih(), simdi = new Date(), [hh, mm] = String(ay.saat || '08:00').split(':').map(Number);
  const son = await idbIstek(d, s => s.get('bildirim-son'));
  if (!zorla && (son === bugun || simdi.getHours() * 60 + simdi.getMinutes() < hh * 60 + (mm || 0))) return;
  const S = await veriOku(d);
  const fa = id => (S.firmalar || []).find(f => f.id === id)?.ad || '';
  const z = (S.ziyaretler || []).filter(x => x.tarih === bugun && x.durum === 'Planlandı').sort((a, b) => (a.saat || '99').localeCompare(b.saat || '99'));
  const g = (S.gorevler || []).filter(x => x.durum !== 'Tamam' && x.son_tarih && x.son_tarih <= bugun);
  const md = bugun.slice(5);
  const dg = (S.kisiler || []).filter(k => k.dogum_gunu && k.dogum_gunu.slice(5) === md);
  const th = (S.tahsilatlar || []).filter(t => (+t.tutar || 0) - (+t.odenen || 0) > 0 && t.vade && t.vade < bugun);
  const satir = [];
  if (z.length) satir.push(`${z.length} ziyaret: ` + z.slice(0, 4).map(x => (x.saat ? x.saat + ' ' : '') + (fa(x.firma_id) || 'Ziyaret')).join(', ') + (z.length > 4 ? '…' : ''));
  if (g.length) satir.push(`${g.length} görev: ` + g.slice(0, 3).map(x => x.baslik).join(', ') + (g.length > 3 ? '…' : ''));
  if (dg.length) satir.push('Doğum günü: ' + dg.map(k => k.ad_soyad).join(', '));
  if (th.length) satir.push(`${th.length} faturanın vadesi geçti`);
  if (!satir.length && !zorla) { await idbIstek(d, s => s.put(bugun, 'bildirim-son'), 'readwrite'); return; }
  await self.registration.showNotification('Saha Takip · Bugün', { body: satir.join('\n') || 'Bugün için planlı ziyaret ya da görev yok.', icon: 'icons/icon-192.png', badge: 'icons/icon-mono-512.png', tag: 'gunluk-ozet', data: { url: './#/bugun' } });
  await idbIstek(d, s => s.put(bugun, 'bildirim-son'), 'readwrite');
}
self.addEventListener('periodicsync', e => { if (e.tag === 'gunluk-ozet') e.waitUntil(ozetGoster(false)); });
self.addEventListener('message', e => { if (e.data?.tip === 'ozet-goster') e.waitUntil(ozetGoster(!!e.data.zorla)); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.includes(self.registration.scope)); if (c) { c.focus(); return c.navigate ? c.navigate(self.registration.scope + '#/bugun') : null; } return self.clients.openWindow(e.notification.data?.url || './#/bugun'); }));
});
