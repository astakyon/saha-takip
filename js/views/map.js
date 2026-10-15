import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, pill, durumRenk, DURUMLAR, ILLER, IL_MERKEZ, byId, firmaAd, match, tarih, myLocation, toast, directionsUrl, openDrawer, closeDrawer } from '../ui.js';
import { go } from '../main.js';
import { yeniProje } from './projeler.js';
import { yeniFirma } from './firmalar.js';
import { ziyaretForm } from './ziyaret.js';

let map, cluster, meMarker, pinMode = false;
const REGION = [[35.75, 32.6], [38.0, 36.75]];

function markerIcon(kind, color, approx) {
  return L.divIcon({ className: 'mk-wrap', iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -28],
    html: `<span class="mk mk-${kind} ${approx ? 'approx' : ''}" style="--c:${color}"><i></i></span>` });
}

export async function mapView(el) {
  const f = F('harita', { il: 'Tümü', proje: true, firma: true, ziyaret: false, yil: 'Tümü', durumlar: DURUMLAR.map(d => d.k), q: '' });
  el.innerHTML = `
  <div class="mapwrap">
    <div id="map" aria-label="Bölge haritası"></div>
    <div class="map-top">
      <div class="seg" role="group" aria-label="İl seç">${['Tümü', ...ILLER].map(i => `<button type="button" data-il="${i}" class="${f.il === i ? 'on' : ''}">${i}</button>`).join('')}</div>
      <div class="map-search"><input type="search" placeholder="Raptiyelerde ara" value="${esc(f.q)}" aria-label="Haritada ara"></div>
      <button type="button" class="btn sm ghost map-filter-btn" aria-expanded="false">Katmanlar</button>
    </div>
    <div class="map-panel" hidden>
      <div class="row"><label class="chk"><input type="checkbox" data-layer="proje" ${f.proje ? 'checked' : ''}> <span>Projeler</span></label>
      <label class="chk"><input type="checkbox" data-layer="firma" ${f.firma ? 'checked' : ''}> <span>Firmalar</span></label>
      <label class="chk"><input type="checkbox" data-layer="ziyaret" ${f.ziyaret ? 'checked' : ''}> <span>Ziyaretler</span></label></div>
      <div class="row"><label>Takip yılı <select data-yil>${['Tümü', 2026, 2027].map(y => `<option ${f.yil == y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>
      <div class="legend">${DURUMLAR.map(d => `<label class="lg"><input type="checkbox" data-durum="${d.k}" ${f.durumlar.includes(d.k) ? 'checked' : ''}><span class="dot" style="--c:${d.c}"></span>${d.k}</label>`).join('')}</div>
      <p class="hint">Kesik kenarlı raptiyeler yaklaşık konumdadır (ilçe veya OSB merkezi). Kaydı açıp gerçek yerine taşıyabilirsin.</p>
    </div>
    <div class="map-fabs">
      <button type="button" class="fab ghost" data-me aria-label="Bulunduğum yere git"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg></button>
      <button type="button" class="fab" data-pin aria-pressed="false"><span>+ Raptiye</span></button>
    </div>
    <div class="map-info"></div>
    <div class="pin-banner" hidden>Raptiye koymak için haritada bir noktaya dokun <button type="button" class="btn sm ghost" data-pin-cancel>Vazgeç</button></div>
  </div>`;

  if (map) { try { map.remove(); } catch {} map = null; meMarker = null; }
  map = L.map('map', { zoomControl: false, maxBounds: [[33, 29], [41, 40]] });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Maxar' });
  osm.addTo(map);
  L.control.layers({ 'Harita': osm, 'Uydu': sat }, null, { position: 'bottomright' }).addTo(map);
  cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, spiderfyOnMaxZoom: true });
  map.addLayer(cluster);
  const v = app.mapView;
  if (v) map.setView(v.c, v.z); else fly(f.il, false);
  map.on('moveend', () => app.mapView = { c: map.getCenter(), z: map.getZoom() });

  const top = el.querySelector('.map-top');
  top.querySelectorAll('[data-il]').forEach(b => b.onclick = () => { f.il = b.dataset.il; saveFilters(); top.querySelectorAll('[data-il]').forEach(x => x.classList.toggle('on', x === b)); fly(f.il); draw(); });
  const panel = el.querySelector('.map-panel'), fb = el.querySelector('.map-filter-btn');
  fb.onclick = () => { panel.hidden = !panel.hidden; fb.setAttribute('aria-expanded', String(!panel.hidden)); };
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.layer) f[t.dataset.layer] = t.checked;
    if (t.dataset.yil !== undefined) f.yil = t.value;
    if (t.dataset.durum) f.durumlar = [...panel.querySelectorAll('[data-durum]:checked')].map(x => x.dataset.durum);
    saveFilters(); draw();
  });
  let qt; top.querySelector('input[type=search]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(true); }, 250); };

  el.querySelector('[data-me]').onclick = async () => {
    try {
      const ll = await myLocation();
      if (meMarker) meMarker.setLatLng(ll); else meMarker = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }).addTo(map);
      map.setView(ll, 15);
    } catch (e) { toast(e.message, 'err'); }
  };
  const pinBtn = el.querySelector('[data-pin]'), banner = el.querySelector('.pin-banner');
  const setPin = on => { pinMode = on; banner.hidden = !on; pinBtn.setAttribute('aria-pressed', String(on)); el.querySelector('#map').classList.toggle('picking', on); };
  pinBtn.onclick = () => setPin(!pinMode);
  el.querySelector('[data-pin-cancel]').onclick = () => setPin(false);
  map.on('click', e => { if (pinMode) { setPin(false); pinMenu(e.latlng); } });
  map.on('contextmenu', e => pinMenu(e.latlng));

  function draw(zoomToResults) {
    cluster.clearLayers();
    const ilOk = r => f.il === 'Tümü' || r.il === f.il;
    let n = 0, noloc = 0; const pts = [];
    if (f.proje) for (const p of S.projeler) {
      if (!ilOk(p) || !f.durumlar.includes(p.durum) || (f.yil !== 'Tümü' && p.takip_yili != f.yil)) continue;
      if (!match(f.q, p.ad, p.lokasyon, p.osb, firmaAd(p.emut_id), firmaAd(p.gemut_id), p.notlar)) continue;
      if (p.lat == null) { noloc++; continue; }
      const m = L.marker([p.lat, p.lng], { icon: markerIcon('p', durumRenk(p.durum), p.konum_yaklasik), title: p.ad, keyboard: true });
      m.bindPopup(() => projePopup(p), { maxWidth: 300, minWidth: 240 });
      cluster.addLayer(m); n++; pts.push([p.lat, p.lng]);
    }
    if (f.firma) for (const x of S.firmalar) {
      if (!ilOk(x) || x.lat == null || !match(f.q, x.ad, x.notlar)) continue;
      const m = L.marker([x.lat, x.lng], { icon: markerIcon('f', '#1D2B36', x.konum_yaklasik), title: x.ad });
      m.bindPopup(() => firmaPopup(x), { maxWidth: 300, minWidth: 220 });
      cluster.addLayer(m); n++; pts.push([x.lat, x.lng]);
    }
    if (f.ziyaret) for (const z of S.ziyaretler) {
      if (z.lat == null) continue;
      const fi = byId('firmalar', z.firma_id);
      if (!match(f.q, fi?.ad, z.notlar)) continue;
      const m = L.marker([z.lat, z.lng], { icon: markerIcon('z', '#0E7490', false), title: fi?.ad || 'Ziyaret' });
      m.bindPopup(() => ziyaretPopup(z), { maxWidth: 300 });
      cluster.addLayer(m); n++; pts.push([z.lat, z.lng]);
    }
    el.querySelector('.map-info').innerHTML = `<b>${n}</b> raptiye${noloc ? ` · <button type="button" class="linkbtn" data-noloc>${noloc} proje konumsuz</button>` : ''}`;
    const nl = el.querySelector('[data-noloc]'); if (nl) nl.onclick = () => konumsuzlar(f);
    if (zoomToResults && f.q && pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  }
  draw();
  setTimeout(() => map.invalidateSize(), 100);
}

function fly(il, anim = true) {
  if (il === 'Tümü') map.fitBounds(REGION, { animate: anim });
  else { const c = IL_MERKEZ[il]; map.setView([c[0], c[1]], c[2], { animate: anim }); }
}

async function photoStrip(paths) {
  if (!paths || !paths.length) return '';
  const urls = await Promise.all(paths.slice(0, 3).map(p => app.db.url(p)));
  return `<div class="pp-photos">${urls.filter(Boolean).map(u => `<img src="${u}" alt="">`).join('')}</div>`;
}

function projePopup(p) {
  const div = document.createElement('div'); div.className = 'pp';
  const roles = [['Emüt', p.emut_id], ['Gemüt', p.gemut_id], ['Alıcı', p.alici_id]].filter(r => r[1]).map(r => `<div><span>${r[0]}</span> ${esc(firmaAd(r[1]))}</div>`).join('');
  div.innerHTML = `<div class="pp-h">${pill(p.durum)}${p.kritik ? '<span class="pill" style="--c:#B91C1C">Kritik</span>' : ''}<span class="yr">${p.takip_yili || ''}</span></div>
    <h3>${esc(p.ad)}</h3>
    <p class="muted">${esc([p.ilce, p.il].filter(Boolean).join(', ') || p.lokasyon || '')}${p.osb ? ' · ' + esc(p.osb) : ''}</p>
    <div class="pp-meta"><div><span>Tutar</span> ${usd(p.tutar_usd)}</div>${roles}</div>
    ${p.notlar ? `<p class="pp-note">${esc(p.notlar.slice(0, 220))}${p.notlar.length > 220 ? '…' : ''}</p>` : ''}
    <div class="pp-ph"></div>
    ${p.konum_yaklasik ? '<p class="hint">Yaklaşık konum. Detaydan düzeltebilirsin.</p>' : ''}
    <div class="pp-act"><a class="btn sm" href="#/proje/${p.id}">Detay</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(p.lat, p.lng)}">Yol tarifi</a></div>`;
  photoStrip(p.fotolar).then(h => div.querySelector('.pp-ph').innerHTML = h);
  return div;
}
function firmaPopup(x) {
  const div = document.createElement('div'); div.className = 'pp';
  const pc = S.projeler.filter(p => [p.emut_id, p.gemut_id, p.alici_id, p.bayi_id, p.yatirimci_id, p.projeci_id, p.danisman_id].includes(x.id)).length;
  const kc = S.kisiler.filter(k => k.firma_id === x.id).length;
  div.innerHTML = `<div class="pp-h">${(x.tipler || []).map(t => `<span class="pill" style="--c:#1D2B36">${esc(t)}</span>`).join('')}</div>
    <h3>${esc(x.ad)}</h3><p class="muted">${esc([x.ilce, x.il].filter(Boolean).join(', '))}</p>
    <div class="pp-meta"><div><span>Proje</span> ${pc}</div><div><span>Kişi</span> ${kc}</div>${x.telefon ? `<div><span>Tel</span> <a href="tel:${esc(x.telefon)}">${esc(x.telefon)}</a></div>` : ''}</div>
    ${x.notlar ? `<p class="pp-note">${esc(x.notlar.slice(0, 200))}</p>` : ''}<div class="pp-ph"></div>
    <div class="pp-act"><a class="btn sm" href="#/firma/${x.id}">Detay</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(x.lat, x.lng)}">Yol tarifi</a></div>`;
  photoStrip(x.fotolar).then(h => div.querySelector('.pp-ph').innerHTML = h);
  return div;
}
function ziyaretPopup(z) {
  const div = document.createElement('div'); div.className = 'pp';
  const k = byId('kisiler', z.kisi_id);
  div.innerHTML = `<p class="muted">${tarih(z.tarih)} · ziyaret</p><h3>${esc(firmaAd(z.firma_id) || 'Ziyaret')}</h3>
    ${k ? `<p>${esc(k.ad_soyad)}</p>` : ''}${z.notlar ? `<p class="pp-note">${esc(z.notlar.slice(0, 260))}</p>` : ''}<div class="pp-ph"></div>
    <div class="pp-act"><button type="button" class="btn sm" data-z>Aç</button></div>`;
  div.querySelector('[data-z]').onclick = () => ziyaretForm(z);
  photoStrip(z.fotolar).then(h => div.querySelector('.pp-ph').innerHTML = h);
  return div;
}

function pinMenu(ll) {
  const loc = { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6), konum_yaklasik: false };
  const il = guessIl(ll);
  const div = document.createElement('div'); div.className = 'pp pin-menu';
  div.innerHTML = `<h3>Bu konuma ne kaydedilsin?</h3><p class="muted">${loc.lat}, ${loc.lng}${il ? ' · ' + il : ''}</p>
    <div class="pin-opts"><button type="button" class="btn" data-a="p">Yeni proje</button><button type="button" class="btn" data-a="f">Yeni firma</button>
    <button type="button" class="btn" data-a="z">Ziyaret kaydet</button><button type="button" class="btn ghost" data-a="m">Var olan kaydı buraya taşı</button></div>`;
  const pop = L.popup({ maxWidth: 280 }).setLatLng(ll).setContent(div).openOn(map);
  div.onclick = e => {
    const a = e.target.dataset.a; if (!a) return; map.closePopup(pop);
    if (a === 'p') yeniProje({ ...loc, il });
    if (a === 'f') yeniFirma({ ...loc, il });
    if (a === 'z') ziyaretForm({ lat: loc.lat, lng: loc.lng });
    if (a === 'm') tasi(loc, il);
  };
}

function guessIl(ll) {
  let best = null, bd = 1e9;
  for (const [il, c] of Object.entries(IL_MERKEZ)) { const d = (c[0] - ll.lat) ** 2 + (c[1] - ll.lng) ** 2; if (d < bd) { bd = d; best = il; } }
  return bd < 1.2 ? best : null;
}

function tasi(loc, il) {
  const p = openDrawer(`<header class="dh"><h2 id="drawer-title">Kaydı bu konuma taşı</h2><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><label class="fld">Proje veya firma<input list="tasi-dl" id="tasi-q" autofocus placeholder="Adını yaz"></label>
    <datalist id="tasi-dl">${S.projeler.map(x => `<option value="Proje: ${esc(x.ad)}">`).join('')}${S.firmalar.map(x => `<option value="Firma: ${esc(x.ad)}">`).join('')}</datalist>
    <p class="hint">Konumu yaklaşık olan kayıtlar listenin başında değil; adını yazman yeterli.</p>
    <div class="dfoot"><button class="btn" data-ok>Taşı</button></div></div>`);
  p.querySelector('[data-ok]').onclick = async () => {
    const v = p.querySelector('#tasi-q').value; const m = v.match(/^(Proje|Firma): (.*)$/);
    const t = m && (m[1] === 'Proje' ? 'projeler' : 'firmalar');
    const rec = m && S[t].find(x => x.ad === m[2]);
    if (!rec) return toast('Listeden bir kayıt seç.', 'err');
    await app.db.save(t, { ...rec, ...loc, il: rec.il || il });
    toast(`${rec.ad} yeni konumuna taşındı.`); closeDrawer(); app.refresh();
  };
}

function konumsuzlar(f) {
  const list = S.projeler.filter(p => p.lat == null && (f.il === 'Tümü' || p.il === f.il));
  openDrawer(`<header class="dh"><h2 id="drawer-title">Konumu olmayan projeler</h2><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="hint">Bir projeyi açıp “Konum” bölümünde haritaya dokunarak yerini belirle.</p>
    <ul class="list">${list.map(p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${esc(p.lokasyon || 'Lokasyon yok')}</span></a>${pill(p.durum)}</li>`).join('')}</ul></div>`);
}
