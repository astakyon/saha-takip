// Saha Takip service worker: uygulama dosyalarını ve harita karolarını önbelleğe alır
const V = 'saha-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-180.png', 'icons/icon.svg', 'js/kurulum.js', 'js/birlestir.js', 'js/google.js', 'js/views/ice-aktar.js',
  'js/main.js', 'js/db.js', 'js/ui.js', 'js/forms.js', 'js/state.js',
  'js/views/map.js', 'js/views/projeler.js', 'js/views/firmalar.js', 'js/views/ziyaret.js',
  'js/views/urunler.js', 'js/views/panel.js', 'js/views/ayarlar.js', 'js/views/bolgeler.js', 'js/geo.js', 'js/data/iller.js'];
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
