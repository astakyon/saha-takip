// Google Haritalar: işletme arama (Places), Google haritasında seçme ve bilgileri kayda aktarma.
// Google'ın kullanım koşulları gereği Google verisi Google haritası üzerinde gösterilir; kayda yer kimliği (place_id) yazılır.
import { S, getConfig, setConfig } from './db.js';
import { ayar, ayarYaz } from './ayar.js';
import { app } from './state.js';
import { esc, fold, toast, openDrawer, closeDrawer, IL_MERKEZ } from './ui.js';
import { konumAlgila, konumMetni } from './geo.js';

// Anahtar hesabına kaydedilir: telefonda ve bilgisayarda bir kez girmek yeter (eski sürümde cihazda tutulan anahtar da okunur)
export const googleKey = () => ayar('google_key') || getConfig()?.googleKey || '';
export async function setGoogleKey(k) { const c = { ...(getConfig() || {}) }; delete c.googleKey; setConfig(c); await ayarYaz('google_key', (k || '').trim() || null); gmLoad = null; }

let gmLoad = null;
export function loadGoogle() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (gmLoad) return gmLoad;
  if (ayar('gizli_mod', false) === true) return Promise.reject(Object.assign(new Error('Gizli mod açık: Google servisleri kapalı (Ayarlar → Genel → Gizlilik).'), { code: 'GIZLI' }));
  const key = googleKey();
  if (!key) return Promise.reject(Object.assign(new Error('Google API anahtarı girilmemiş.'), { code: 'NO_KEY' }));
  gmLoad = new Promise((res, rej) => {
    window.__gmReady = () => res(window.google.maps);
    window.gm_authFailure = () => toast('Google API anahtarı reddedildi. Anahtarın bu site için izinli olduğunu ve Maps JavaScript API ile Places API (New) servislerinin açık olduğunu kontrol et.', 'err');
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=tr&region=TR&loading=async&callback=__gmReady`;
    s.async = true;
    s.onerror = () => { gmLoad = null; rej(new Error('Google Haritalar yüklenemedi. İnternet bağlantını kontrol et.')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!window.google?.maps) { gmLoad = null; rej(new Error('Google Haritalar yanıt vermedi.')); } }, 20000);
  });
  return gmLoad;
}

const FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteURI', 'googleMapsURI',
  'rating', 'userRatingCount', 'businessStatus', 'types', 'regularOpeningHours', 'photos'];
const val = v => (v && typeof v === 'object' && 'text' in v ? v.text : v) || '';
export function placeVeri(p) {
  const loc = p.location;
  return {
    google_place_id: p.id, ad: val(p.displayName), adres: p.formattedAddress || '', telefon: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
    web: p.websiteURI || '', google_url: p.googleMapsURI || '', lat: loc ? +(typeof loc.lat === 'function' ? loc.lat() : loc.lat).toFixed(6) : null,
    lng: loc ? +(typeof loc.lng === 'function' ? loc.lng() : loc.lng).toFixed(6) : null, puan: p.rating, yorum: p.userRatingCount,
    durum: p.businessStatus, saatler: p.regularOpeningHours?.weekdayDescriptions || [],
  };
}
// Konumu olmayan kayıtlar için ada göre tek sonuç (toplu içe aktarmada kullanılır)
export async function adaGoreBul(ad, near) {
  await loadGoogle();
  const { Place } = await google.maps.importLibrary('places');
  const c = near || [36.95, 35.2];
  const { places } = await Place.searchByText({ textQuery: ad, fields: ['id', 'displayName', 'location', 'formattedAddress', 'googleMapsURI'], language: 'tr', region: 'tr',
    maxResultCount: 1, locationBias: { center: { lat: c[0], lng: c[1] }, radius: 50000 } });
  return places?.[0] ? placeVeri(places[0]) : null;
}

// Anahtar yokken: nasıl alınacağını anlatan ve anahtarı kaydettiren panel
export function anahtarPaneli(sonra) {
  const p = openDrawer(`<header class="dh"><div><p class="muted">Google Haritalar</p><h2 id="drawer-title">Google API anahtarı gerekiyor</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">${anahtarFormu()}</div>`);
  anahtarBagla(p, sonra);
}
export function anahtarFormu() {
  return `<p>Google'daki işletmeleri arayıp adres, telefon, web sitesi ve konumlarını çekmek için Google Maps Platform'dan ücretsiz bir API anahtarı alman gerekiyor. Bir kez yapılır.</p>
    <ol class="steps">
      <li><b>console.cloud.google.com</b> adresinde Google hesabınla yeni bir proje oluştur.</li>
      <li><b>Faturalandırma</b> hesabı bağla. Google bunu istiyor; aylık ücretsiz kullanım hakkı var ve tek kişilik kullanım genellikle bu hakkın içinde kalır. İstersen <b>Bütçe ve uyarılar</b> bölümünden küçük bir bütçe uyarısı koy.</li>
      <li><b>APIs &amp; Services → Library</b>: <b>Maps JavaScript API</b> ve <b>Places API (New)</b> servislerini etkinleştir.</li>
      <li><b>Credentials → Create credentials → API key</b>. Anahtarı kısıtla: <i>Websites</i> altına <code>https://astakyon.github.io/*</code> ekle, <i>API restrictions</i> altında bu iki servisi seç.</li>
      <li>Anahtarı aşağıya yapıştır.</li>
    </ol>
    <form class="form" data-gkey><div class="fld"><label for="gkey">Google API anahtarı</label><input id="gkey" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(googleKey())}"></div>
    <div class="btnrow"><button class="btn primary" type="submit">Kaydet</button>${googleKey() ? '<button class="btn ghost" type="button" data-gdel>Anahtarı kaldır</button>' : ''}</div></form>
    <p class="hint">Anahtar hesabına kaydedilir; telefonda ve bilgisayarda bir kez girmen yeter. Anahtarı kısıtladığın için başka bir sitede kullanılamaz.</p>`;
}
export function anahtarBagla(root, sonra) {
  const f = root.querySelector('[data-gkey]');
  f.onsubmit = async e => { e.preventDefault(); const k = f.querySelector('#gkey').value.trim(); if (!/^AIza[\w-]{30,}$/.test(k)) return toast('Anahtar “AIza” ile başlamalı ve tam kopyalanmalı.', 'err'); await setGoogleKey(k); toast('Google API anahtarı kaydedildi.'); closeDrawer(); sonra && sonra(); };
  root.querySelector('[data-gdel]')?.addEventListener('click', async () => { await setGoogleKey(''); toast('Anahtar kaldırıldı.'); closeDrawer(); });
}

// ---------- Google'da ara ve seç ----------
// opts: { q, near:[lat,lng], zoom, hedef:{ table, rec }, sonra }
export async function googleBul(opts = {}) {
  if (!googleKey()) return anahtarPaneli(() => googleBul(opts));
  const hedef = opts.hedef;
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${hedef ? esc(hedef.rec.ad) + ' · ' : ''}Google Haritalar</p><h2 id="drawer-title">Google'da ara</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody gpick">
      <form class="gsearch" data-gs><input type="search" name="q" value="${esc(opts.q || '')}" placeholder="Firma veya yer adı, örn. Drv Elektrik Adana" aria-label="Google'da ara" autofocus><button class="btn primary" type="submit">Ara</button></form>
      <div class="gmap" data-gmap><p class="hint">Google Haritalar yükleniyor…</p></div>
      <p class="hint">Haritadaki işletme simgelerine dokunarak da seçebilirsin. Boş bir noktaya dokunursan oraya kendi raptiyeni koyarsın.</p>
      <ul class="glist" data-glist></ul>
      <section class="gcard" data-gcard hidden></section>
    </div>`, { wide: true });
  let G, map, Place, markers = [], selMarker = null, sel = null;
  try {
    const gm = await loadGoogle();
    ({ Place } = await gm.importLibrary('places'));
    await Promise.all([gm.importLibrary('maps'), gm.importLibrary('marker'), gm.importLibrary('core')]);
    G = window.google.maps;
  } catch (e) { panel.querySelector('[data-gmap]').innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
  const center = opts.near || (hedef?.rec?.lat != null ? [hedef.rec.lat, hedef.rec.lng] : null) || (app.mapView ? [app.mapView.c.lat, app.mapView.c.lng] : [36.95, 35.2]);
  const box = panel.querySelector('[data-gmap]'); box.innerHTML = '';
  map = new G.Map(box, { center: { lat: center[0], lng: center[1] }, zoom: opts.zoom || (opts.near ? 17 : 11), mapTypeId: 'hybrid', clickableIcons: true,
    gestureHandling: 'greedy', streetViewControl: false, fullscreenControl: false, mapTypeControl: true });
  const list = panel.querySelector('[data-glist]'), card = panel.querySelector('[data-gcard]');
  const clearMarkers = () => { markers.forEach(m => m.setMap(null)); markers = []; };

  async function sec(place, manual) {
    if (place && !manual) { try { await place.fetchFields({ fields: FIELDS }); } catch (e) { return toast('Google bilgisi alınamadı: ' + e.message, 'err'); } }
    sel = manual ? { ...manual } : placeVeri(place);
    if (selMarker) selMarker.setMap(null);
    selMarker = new G.Marker({ map, position: { lat: sel.lat, lng: sel.lng }, draggable: true, title: sel.ad || 'Seçilen nokta', zIndex: 999 });
    selMarker.addListener('dragend', () => { const p = selMarker.getPosition(); sel.lat = +p.lat().toFixed(6); sel.lng = +p.lng().toFixed(6); kartCiz(); });
    map.panTo({ lat: sel.lat, lng: sel.lng }); if (map.getZoom() < 16) map.setZoom(17);
    const foto = !manual && place.photos?.[0] ? place.photos[0].getURI({ maxWidth: 480, maxHeight: 240 }) : null;
    sel._foto = foto; sel._atif = !manual && place.photos?.[0]?.authorAttributions?.[0];
    kartCiz();
  }
  function enIyiEslesme(ad) {
    const n = fold(ad).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
    let best = null, bs = 0;
    for (const [t, l] of [['firmalar', S.firmalar], ['projeler', S.projeler]]) for (const r of l) {
      const rn = fold(r.ad).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
      if (!rn.length) continue;
      const ortak = rn.filter(w => n.includes(w)).length, sc = ortak / rn.length + (t === 'firmalar' ? 0.01 : 0);
      if (ortak && sc > bs) { bs = sc; best = { t, r }; }
    }
    return bs >= 0.5 ? best : null;
  }
  async function kartCiz() {
    const k = await konumAlgila(sel.lat, sel.lng, { online: false });
    sel._k = k;
    const es = hedef ? null : enIyiEslesme(sel.ad || '');
    const satir = (l, v) => v ? `<div><span>${l}</span> ${v}</div>` : '';
    card.hidden = false;
    card.innerHTML = `${sel._foto ? `<img class="gfoto" src="${esc(sel._foto)}" alt="">${sel._atif ? `<small class="muted">Fotoğraf: <a href="${esc(sel._atif.uri || '#')}" target="_blank" rel="noopener">${esc(sel._atif.displayName || 'Google kullanıcısı')}</a></small>` : ''}` : ''}
      <h3>${esc(sel.ad || 'Seçilen nokta')}</h3>
      <div class="pp-meta">${satir('Adres', esc(sel.adres))}${satir('Telefon', sel.telefon ? `<a href="tel:${esc(sel.telefon)}">${esc(sel.telefon)}</a>` : '')}${satir('Web', sel.web ? `<a href="${esc(sel.web)}" target="_blank" rel="noopener">${esc(sel.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : '')}
      ${satir('Puan', sel.puan ? `${sel.puan} (${sel.yorum || 0} yorum)` : '')}${satir('Durum', sel.durum === 'CLOSED_PERMANENTLY' ? '<b style="color:var(--red)">Kalıcı olarak kapalı</b>' : '')}
      ${satir('Bölge', esc(konumMetni(k)))}${satir('Konum', `${sel.lat}, ${sel.lng}`)}</div>
      ${sel.google_url ? `<p><a href="${esc(sel.google_url)}" target="_blank" rel="noopener">Google Haritalar'da aç</a></p>` : ''}
      ${hedef ? `<fieldset class="gapply"><legend>${esc(hedef.rec.ad)} kaydına aktarılacaklar</legend>
          <label class="chk"><input type="checkbox" data-f="konum" checked> <span>Konum (raptiye)</span></label>
          ${sel.adres ? `<label class="chk"><input type="checkbox" data-f="adres" ${hedef.rec.adres ? '' : 'checked'}> <span>Adres${hedef.rec.adres ? ' (mevcut adresin üstüne yazar)' : ''}</span></label>` : ''}
          ${sel.telefon && hedef.table === 'firmalar' ? `<label class="chk"><input type="checkbox" data-f="telefon" ${hedef.rec.telefon ? '' : 'checked'}> <span>Telefon${hedef.rec.telefon ? ` (mevcut: ${esc(hedef.rec.telefon)})` : ''}</span></label>` : ''}
          ${sel.web && hedef.table === 'firmalar' ? `<label class="chk"><input type="checkbox" data-f="web" ${hedef.rec.web ? '' : 'checked'}> <span>Web sitesi</span></label>` : ''}
        </fieldset><div class="btnrow"><button type="button" class="btn primary" data-a="uygula">Kayda aktar</button></div>`
      : `<div class="btnrow"><button type="button" class="btn primary" data-a="firma">Yeni firma olarak kaydet</button><button type="button" class="btn" data-a="proje">Yeni proje olarak kaydet</button></div>
        <div class="glink"><label for="gl-q">Var olan kayda bağla</label><div class="gl-row"><input id="gl-q" list="gl-dl" value="${es ? esc((es.t === 'firmalar' ? 'Firma: ' : 'Proje: ') + es.r.ad) : ''}" placeholder="Firma veya proje adı">
          <button type="button" class="btn" data-a="bagla">Bağla</button></div>
          <datalist id="gl-dl">${S.firmalar.map(x => `<option value="Firma: ${esc(x.ad)}">`).join('')}${S.projeler.map(x => `<option value="Proje: ${esc(x.ad)}">`).join('')}</datalist>
          ${es ? `<small class="muted">Ada göre en yakın kayıt önerildi; değiştirebilirsin.</small>` : ''}</div>`}`;
    card.querySelectorAll('[data-a]').forEach(b => b.onclick = () => eylem(b.dataset.a));
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function eylem(a) {
    const k = sel._k || {};
    const konum = { lat: sel.lat, lng: sel.lng, konum_yaklasik: false, il: k.il, ilce: k.ilce, osb: k.osb || undefined, bolge_id: k.bolge_id || undefined };
    const gg = sel.google_place_id ? { google_place_id: sel.google_place_id, google_url: sel.google_url || null } : {};
    if (a === 'firma' || a === 'proje') {
      closeDrawer();
      const init = { ...konum, ...gg, ad: sel.ad || '', adres: sel.adres || null, _algila: true };
      if (a === 'firma') { const { yeniFirma } = await import('./views/firmalar.js'); yeniFirma({ ...init, telefon: sel.telefon || null, web: sel.web || null }); }
      else { const { yeniProje } = await import('./views/projeler.js'); yeniProje(init); }
      return;
    }
    let table, rec, alan = { konum: true, adres: !!sel.adres, telefon: !!sel.telefon, web: !!sel.web };
    if (a === 'uygula') {
      ({ table, rec } = hedef);
      card.querySelectorAll('[data-f]').forEach(c => alan[c.dataset.f] = c.checked);
    } else {
      const v = card.querySelector('#gl-q').value; const m = v.match(/^(Firma|Proje): (.*)$/);
      table = m && (m[1] === 'Firma' ? 'firmalar' : 'projeler'); rec = m && S[table].find(x => x.ad === m[2]);
      if (!rec) return toast('Listeden bir firma veya proje seç.', 'err');
      alan = { konum: true, adres: !rec.adres && !!sel.adres, telefon: !rec.telefon && !!sel.telefon, web: !rec.web && !!sel.web };
    }
    rec = S[table].find(x => x.id === rec.id) || rec;
    const upd = { ...rec, ...gg };
    if (alan.konum) Object.assign(upd, Object.fromEntries(Object.entries(konum).filter(([, v]) => v !== undefined)));
    if (alan.adres) upd.adres = sel.adres;
    if (table === 'firmalar' && alan.telefon) upd.telefon = sel.telefon;
    if (table === 'firmalar' && alan.web) upd.web = sel.web;
    try {
      await app.db.save(table, upd);
      toast(`${rec.ad}: Google bilgileri kaydedildi${alan.konum ? ' · ' + (konumMetni(k) || 'konum') : ''}.`);
      closeDrawer(); opts.sonra ? opts.sonra(upd) : app.refresh();
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  }
  async function ara(q) {
    if (!q.trim()) return;
    list.innerHTML = '<li class="muted">Aranıyor…</li>';
    try {
      const b = map.getBounds();
      const { places } = await Place.searchByText({ textQuery: q, fields: ['id', 'displayName', 'formattedAddress', 'location', 'types'], language: 'tr', region: 'tr', maxResultCount: 12,
        ...(b ? { locationBias: b } : {}) });
      clearMarkers();
      if (!places?.length) { list.innerHTML = '<li class="muted">Sonuç yok. Adı farklı yazmayı ya da ilçe adını eklemeyi dene.</li>'; return; }
      const bounds = new G.LatLngBounds();
      list.innerHTML = places.map((p, i) => `<li><button type="button" data-i="${i}"><b>${i + 1}. ${esc(val(p.displayName))}</b><small>${esc(p.formattedAddress || '')}</small></button></li>`).join('');
      places.forEach((p, i) => { const m = new G.Marker({ map, position: p.location, label: String(i + 1), title: val(p.displayName) }); m.addListener('click', () => sec(p)); markers.push(m); bounds.extend(p.location); });
      if (places.length > 1) map.fitBounds(bounds, 60); else map.setCenter(places[0].location);
      list.querySelectorAll('[data-i]').forEach(btn => btn.onclick = () => sec(places[+btn.dataset.i]));
    } catch (e) { list.innerHTML = `<li class="warn">Arama yapılamadı: ${esc(e.message)}</li>`; }
  }
  panel.querySelector('[data-gs]').onsubmit = e => { e.preventDefault(); ara(e.target.q.value); };
  map.addListener('click', e => {
    if (e.placeId) { e.stop(); sec(new Place({ id: e.placeId })); return; }
    sec(null, { ad: hedef?.rec?.ad || '', lat: +e.latLng.lat().toFixed(6), lng: +e.latLng.lng().toFixed(6) });
  });
  if (opts.q) ara(opts.q);
}

// İl merkezine göre varsayılan arama metni
export const aramaMetni = r => [r.ad, r.ilce, r.il && IL_MERKEZ[r.il] ? r.il : ''].filter(Boolean).join(' ');
