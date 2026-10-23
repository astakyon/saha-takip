import { ALTLIKLAR, varsayilanAltlik, altlikKatmani, uyduMu } from '../altlik.js';
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, pill, durumRenk, DURUMLAR, ACIK, ILLER, IL_MERKEZ, BOLGE_RENKLERI, byId, firmaAd, match, tarih, myLocation, toast, directionsUrl, openDrawer, closeDrawer, fold } from '../ui.js';
import { ilSinirlari, detayliSinirIndir, konumAlgila, konumMetni, toMulti, inMulti } from '../geo.js';
import { yeniProje } from './projeler.js';
import { yeniFirma } from './firmalar.js';
import { ziyaretForm } from './ziyaret.js';
import { bolgeForm, bolgeRenk, bolgeProjeleri, bolgeyeAta } from './bolgeler.js';
import { googleBul, aramaMetni } from '../google.js';
import { iceAktarPaneli } from './ice-aktar.js';

let map, cluster, regionLayer, borderLayer, drawLayer, meMarker;
let mode = null, moveOn = false;            // null | {t:'pin'} | {t:'assign', table, rec} | {t:'draw', pts:[], bolge}
const REGION = [[35.75, 32.6], [38.0, 36.75]];
const LABEL_ZOOM = 14, REGION_LABEL_ZOOM = 11;

function markerIcon(kind, color, approx) {
  return L.divIcon({ className: 'mk-wrap', iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -28], tooltipAnchor: [0, -30],
    html: `<span class="mk mk-${kind} ${approx ? 'approx' : ''}" style="--c:${color}"><i></i></span>` });
}
const needsLoc = r => !r.aday && (r.lat == null || r.konum_yaklasik);

export async function mapView(el) {
  const f = F('harita', { il: 'Tümü', proje: true, yaklasik: false, firma: true, ziyaret: false, bolge: true, yil: 'Tümü', durumlar: DURUMLAR.map(d => d.k), q: '', uydu: true });
  if (f.uydu === undefined) f.uydu = true;
  if (f.yaklasik === undefined) f.yaklasik = false;
  if (f.bolge === undefined) f.bolge = true;
  mode = null; moveOn = false;
  el.innerHTML = `
  <div class="mapwrap">
    <div id="map" aria-label="Bölge haritası"></div>
    <div class="map-top">
      <div class="seg" role="group" aria-label="İl seç">${['Tümü', ...ILLER].map(i => `<button type="button" data-il="${i}" class="${f.il === i ? 'on' : ''}">${i}</button>`).join('')}</div>
      <div class="map-search"><input type="search" placeholder="Raptiyelerde ara" value="${esc(f.q)}" aria-label="Haritada ara"></div>
      <div class="map-tools">
        <label class="altlik-sec"><span class="sr-only">Harita görüntüsü</span><select data-altlik aria-label="Harita görüntüsü">${ALTLIKLAR.map(a => `<option value="${a.k}" ${varsayilanAltlik(f) === a.k ? 'selected' : ''}>${a.ad}</option>`).join('')}</select></label>
        <button type="button" class="btn sm ghost tbtn" data-tool="google">Google'da ara</button>
        <button type="button" class="btn sm ghost tbtn" data-tool="assign">Konum ata <b data-need></b></button>
        <button type="button" class="btn sm ghost tbtn" data-tool="move" aria-pressed="false">Raptiye taşı</button>
        <button type="button" class="btn sm ghost tbtn" data-tool="draw">Bölge çiz</button>
        <button type="button" class="btn sm ghost tbtn" data-tool="import">İçe aktar</button>
        <button type="button" class="btn sm ghost tbtn" data-tool="layers" aria-expanded="false">Katmanlar</button>
      </div>
    </div>
    <div class="map-panel" data-layers hidden>
      <div class="lrow"><label class="chk"><input type="checkbox" data-layer="proje" ${f.proje ? 'checked' : ''}> <span>Projeler</span></label>
      <label class="chk"><input type="checkbox" data-layer="yaklasik" ${f.yaklasik ? 'checked' : ''}> <span>Yaklaşık konumlu projeler</span></label>
      <label class="chk"><input type="checkbox" data-layer="firma" ${f.firma ? 'checked' : ''}> <span>Firmalar</span></label>
      <label class="chk"><input type="checkbox" data-layer="ziyaret" ${f.ziyaret ? 'checked' : ''}> <span>Ziyaretler</span></label>
      <label class="chk"><input type="checkbox" data-layer="bolge" ${f.bolge ? 'checked' : ''}> <span>Sanayi bölgeleri</span></label>
      <label class="chk"><input type="checkbox" data-layer="isi" ${f.isi ? 'checked' : ''}> <span>Ziyaret yoğunluğu (son 90 gün)</span></label></div>
      <div class="isi-lejant" data-isilej ${f.isi ? '' : 'hidden'}><span style="--c:#B91C1C">hiç</span><span style="--c:#EA580C">1–2</span><span style="--c:#CA8A04">3–5</span><span style="--c:#15803D">6+</span> ziyaret (bölge) · firmalar: son ziyaret 20 / 45 / 90 gün</div>
      <p class="hint karo-bilgi" data-karo></p>
      <div class="lrow"><label>Takip yılı <select data-yil>${['Tümü', 2026, 2027].map(y => `<option ${f.yil == y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>
      <div class="legend">${DURUMLAR.map(d => `<label class="lg"><input type="checkbox" data-durum="${d.k}" ${f.durumlar.includes(d.k) ? 'checked' : ''}><span class="dot" style="--c:${d.c}"></span>${d.k}</label>`).join('')}</div>
      <p class="hint">Yakınlaştırınca proje adları raptiyelerin üstünde görünür. Yaklaşık konumlu projeler (ilçe veya OSB merkezine yerleştirilmiş olanlar) varsayılan olarak gizli; “Konum ata” ile tek tek yerleştir.</p>
    </div>
    <aside class="assign-panel" data-assign hidden aria-label="Konum atanacak kayıtlar">
      <header><h2>Konum ata</h2><button type="button" class="x" data-assign-close aria-label="Kapat">×</button></header>
      <div class="seg sm" role="group"><button type="button" data-at="projeler" class="on">Projeler</button><button type="button" data-at="firmalar">Firmalar</button></div>
      <input type="search" data-assign-q placeholder="Ara" aria-label="Konumsuz kayıtlarda ara">
      <p class="hint">Listeden seç, sonra haritada gerçek yerine dokun. İl, ilçe, belde ve sanayi bölgesi otomatik yazılır.</p>
      <ul class="alist" data-assign-list></ul>
    </aside>
    <div class="map-fabs">
      <button type="button" class="fab ghost" data-me aria-label="Bulunduğum yere git"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg></button>
      <button type="button" class="fab" data-pin aria-pressed="false"><span>+ Raptiye</span></button>
    </div>
    <div class="map-info"></div>
    <div class="mode-bar" data-modebar hidden><span data-modetxt></span><span class="mode-btns"></span></div>
  </div>`;

  if (map) { try { map.remove(); } catch {} map = null; meMarker = null; }
  map = L.map('map', { zoomControl: false, maxBounds: [[33, 29], [41, 40]], doubleClickZoom: true });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // Altlık: Google uydu (güncel, anahtar gerekir), Esri uydu ya da sokak haritası
  let altKatman = null, altSira = 0;
  const altlik = async k => {
    const sira = ++altSira; const { k: gercek, katman } = await altlikKatmani(k);
    if (sira !== altSira || !map) return;
    if (altKatman) map.removeLayer(altKatman); altKatman = katman; katman.addTo(map); katman.bringToBack?.();
    f.altlik = gercek; f.uydu = uyduMu(gercek); saveFilters();
    map.getContainer().classList.toggle('sat', uyduMu(gercek));
    const s = el.querySelector('[data-altlik]'); if (s) s.value = gercek;
  };
  altlik(varsayilanAltlik(f));
  borderLayer = L.layerGroup().addTo(map);
  regionLayer = L.layerGroup().addTo(map);
  drawLayer = L.layerGroup().addTo(map);
  cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 16 });
  map.addLayer(cluster);
  const cont = map.getContainer();
  const zoomCls = () => { const z = map.getZoom(); cont.classList.toggle('labels-on', z >= LABEL_ZOOM); cont.classList.toggle('rlabels-on', z >= REGION_LABEL_ZOOM); };
  map.on('zoomend', zoomCls);
  if (app.mapFocus) { const fc = app.mapFocus; app.mapFocus = null; if (fc.bounds) map.fitBounds(fc.bounds, { maxZoom: 16, padding: [30, 30] }); else map.setView(fc.c, fc.z || 16); }
  else if (app.mapView) map.setView(app.mapView.c, app.mapView.z);
  else fly(f.il, false);
  zoomCls();
  map.on('moveend', () => app.mapView = { c: map.getCenter(), z: map.getZoom() });

  // ---------- Üst çubuk ----------
  const top = el.querySelector('.map-top');
  top.querySelectorAll('[data-il]').forEach(b => b.onclick = () => { f.il = b.dataset.il; saveFilters(); top.querySelectorAll('[data-il]').forEach(x => x.classList.toggle('on', x === b)); fly(f.il); drawBorders(); draw(); });
  el.querySelector('[data-altlik]').onchange = e => altlik(e.target.value);
  const lp = el.querySelector('[data-layers]'), ap = el.querySelector('[data-assign]');
  top.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => {
    const t = b.dataset.tool;
    if (t === 'layers') { lp.hidden = !lp.hidden; ap.hidden = true; b.setAttribute('aria-expanded', String(!lp.hidden)); }
    if (t === 'assign') { ap.hidden = !ap.hidden; lp.hidden = true; if (!ap.hidden) drawAssignList(); }
    if (t === 'draw') startDraw(null);
    if (t === 'google') { lp.hidden = true; ap.hidden = true; googleBul({ near: [map.getCenter().lat, map.getCenter().lng], zoom: Math.max(map.getZoom(), 12), sonra: () => { draw(); drawRegions(); } }); }
    if (t === 'import') { lp.hidden = true; ap.hidden = true; iceAktarPaneli(() => { draw(); drawRegions(); }); }
    if (t === 'move') {
      moveOn = !moveOn; b.setAttribute('aria-pressed', String(moveOn)); b.classList.toggle('on', moveOn);
      cont.classList.toggle('moving', moveOn);
      toast(moveOn ? 'Taşıma açık: raptiyeyi basılı tutup yeni yerine sürükle. Bitince tekrar “Raptiye taşı”ya bas.' : 'Taşıma kapatıldı.');
      draw();
    }
  });
  lp.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.layer) f[t.dataset.layer] = t.checked;
    if (t.dataset.yil !== undefined) f.yil = t.value;
    if (t.dataset.durum) f.durumlar = [...lp.querySelectorAll('[data-durum]:checked')].map(x => x.dataset.durum);
    saveFilters(); draw(); drawRegions();
  });
  let qt; top.querySelector('input[type=search]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(true); }, 250); };

  el.querySelector('[data-me]').onclick = async () => {
    try {
      const ll = await myLocation();
      if (meMarker) meMarker.setLatLng(ll); else meMarker = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }).addTo(map);
      map.setView(ll, 16);
    } catch (e) { toast(e.message, 'err'); }
  };
  const pinBtn = el.querySelector('[data-pin]');
  pinBtn.onclick = () => setMode(mode?.t === 'pin' ? null : { t: 'pin' });

  // ---------- Mod çubuğu (raptiye / konum ata / çizim) ----------
  const bar = el.querySelector('[data-modebar]'), barTxt = el.querySelector('[data-modetxt]'), barBtns = bar.querySelector('.mode-btns');
  function setMode(m) {
    mode = m; drawLayer.clearLayers();
    cont.classList.toggle('picking', !!m);
    pinBtn.setAttribute('aria-pressed', String(m?.t === 'pin'));
    if (!m) { bar.hidden = true; return; }
    bar.hidden = false;
    if (m.t === 'pin') { barTxt.textContent = 'Raptiye koymak için haritada bir noktaya dokun.'; barBtns.innerHTML = '<button type="button" class="btn sm ghost" data-mb="cancel">Vazgeç</button>'; }
    if (m.t === 'assign') { barTxt.innerHTML = `<b>${esc(m.rec.ad)}</b> için haritada gerçek yere dokun.`; barBtns.innerHTML = '<button type="button" class="btn sm ghost" data-mb="cancel">Vazgeç</button>'; }
    if (m.t === 'draw') { updDraw(); }
  }
  bar.addEventListener('click', e => {
    const a = e.target.dataset.mb; if (!a) return;
    if (a === 'cancel') setMode(null);
    if (a === 'undo' && mode?.t === 'draw') { mode.pts.pop(); updDraw(); }
    if (a === 'finish' && mode?.t === 'draw') finishDraw();
  });
  map.on('click', async e => {
    if (!mode) return;
    const ll = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)];
    if (mode.t === 'pin') { setMode(null); pinMenu(e.latlng); }
    else if (mode.t === 'assign') { const m = mode; setMode(null); await yerlestir(m.table, m.rec, ll); }
    else if (mode.t === 'draw') { mode.pts.push(ll); updDraw(); }
  });
  map.on('contextmenu', e => { if (!mode) pinMenu(e.latlng); });

  // ---------- Konum ata paneli ----------
  let atTable = 'projeler', aq = '';
  ap.querySelectorAll('[data-at]').forEach(b => b.onclick = () => { atTable = b.dataset.at; ap.querySelectorAll('[data-at]').forEach(x => x.classList.toggle('on', x === b)); drawAssignList(); });
  ap.querySelector('[data-assign-q]').oninput = e => { aq = e.target.value; drawAssignList(); };
  ap.querySelector('[data-assign-close]').onclick = () => { ap.hidden = true; };
  function drawAssignList() {
    const list = S[atTable].filter(r => needsLoc(r) && (f.il === 'Tümü' || r.il === f.il || !r.il) && match(aq, r.ad, r.lokasyon, r.osb, r.ilce))
      .sort((a, b) => (ACIK.includes(b.durum) - ACIK.includes(a.durum)) || a.ad.localeCompare(b.ad, 'tr'));
    ap.querySelector('[data-assign-list]').innerHTML = list.length ? list.slice(0, 300).map(r => `<li><button type="button" data-rid="${r.id}">
      <b>${esc(r.ad)}</b><small>${esc([r.lokasyon, r.osb, r.ilce, r.il].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || 'Lokasyon bilgisi yok')}</small>
      ${r.durum ? pill(r.durum) : ''}${r.lat != null ? '<em>yaklaşık</em>' : ''}</button></li>`).join('') : '<li class="muted">Bu ilde konum atanacak kayıt kalmadı.</li>';
    ap.querySelectorAll('[data-rid]').forEach(b => b.onclick = () => {
      const rec = byId(atTable, b.dataset.rid);
      if (rec.lat != null) map.setView([rec.lat, rec.lng], Math.max(map.getZoom(), 14));
      if (window.matchMedia('(max-width: 899px)').matches) ap.hidden = true;
      setMode({ t: 'assign', table: atTable, rec });
    });
    updNeed();
  }
  const updNeed = () => { const n = S.projeler.filter(needsLoc).length; el.querySelector('[data-need]').textContent = n ? n : ''; };

  async function yerlestir(table, rec, ll) {
    toast('Konum algılanıyor…');
    const k = await konumAlgila(ll[0], ll[1]);
    const prev = { lat: rec.lat, lng: rec.lng, konum_yaklasik: rec.konum_yaklasik, il: rec.il, ilce: rec.ilce, belde: rec.belde, osb: rec.osb, bolge_id: rec.bolge_id };
    const upd = { ...rec, lat: ll[0], lng: ll[1], konum_yaklasik: false, il: k.il || rec.il, ilce: k.ilce || rec.ilce, belde: k.belde || null, osb: k.osb || rec.osb || null, bolge_id: k.bolge_id || null };
    try {
      await app.db.save(table, upd);
      draw(); drawRegions(); if (!ap.hidden) drawAssignList(); updNeed();
      toastUndo(`${rec.ad}: ${konumMetni(k) || 'konum kaydedildi'}`, async () => { await app.db.save(table, { ...upd, ...prev }); draw(); if (!ap.hidden) drawAssignList(); updNeed(); });
      if (window.matchMedia('(max-width: 899px)').matches && S[table].some(needsLoc)) setTimeout(() => { ap.hidden = false; drawAssignList(); }, 1600);
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  }

  // ---------- Bölge çizimi ----------
  function startDraw(bolge) { lp.hidden = true; ap.hidden = true; setMode({ t: 'draw', pts: [], bolge }); }
  function updDraw() {
    const pts = mode.pts; drawLayer.clearLayers();
    if (pts.length) {
      (pts.length >= 3 ? L.polygon(pts, { color: '#F5B800', weight: 2.5, dashArray: '6 4', fillOpacity: 0.12 }) : L.polyline(pts, { color: '#F5B800', weight: 2.5, dashArray: '6 4' })).addTo(drawLayer);
      pts.forEach(p => L.circleMarker(p, { radius: 5, color: '#1D2B36', weight: 2, fillColor: '#F5B800', fillOpacity: 1 }).addTo(drawLayer));
    }
    barTxt.innerHTML = `${mode.bolge ? `<b>${esc(mode.bolge.ad)}</b> sınırı: ` : 'Bölge sınırı: '}köşelere sırayla dokun (${pts.length} nokta)`;
    barBtns.innerHTML = `<button type="button" class="btn sm ghost" data-mb="undo" ${pts.length ? '' : 'disabled'}>Geri al</button><button type="button" class="btn sm primary" data-mb="finish" ${pts.length >= 3 ? '' : 'disabled'}>Bitir</button><button type="button" class="btn sm ghost" data-mb="cancel">Vazgeç</button>`;
  }
  async function finishDraw() {
    const pts = mode.pts, target = mode.bolge; setMode(null);
    const ring = pts.map(p => [p[1], p[0]]); ring.push(ring[0]);
    const geojson = { type: 'Polygon', coordinates: [ring] };
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    const k = await konumAlgila(c[0], c[1], { online: false });
    bolgeForm(target ? { ...target, geojson } : { geojson, il: k.il, ilce: k.ilce, tip: 'OSB' }, () => { draw(); drawRegions(); });
  }

  // ---------- Çizimler ----------
  async function drawBorders() {
    borderLayer.clearLayers();
    const s = await ilSinirlari();
    for (const il of ILLER) {
      const on = f.il === il, any = f.il === 'Tümü';
      const coords = s[il].map(poly => poly.map(ring => ring.map(([x, y]) => [y, x])));
      L.polygon(coords, { color: on ? '#1D2B36' : '#46606F', weight: on ? 3 : (any ? 1.6 : 1), opacity: on ? 0.9 : (any ? 0.6 : 0.35), fillColor: '#1D2B36', fillOpacity: on ? 0.03 : 0, dashArray: on ? null : '4 4', interactive: false }).addTo(borderLayer);
    }
  }
  // Ziyaret yoğunluğu: son 90 günde bölgedeki yapılan ziyaretler (firma/proje bölgesi ya da konum bölge içinde)
  const isiRenk = n => n === 0 ? '#B91C1C' : n <= 2 ? '#EA580C' : n <= 5 ? '#CA8A04' : '#15803D';
  function isiSay(b, multi) {
    const sinir = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    let n = 0;
    for (const z of S.ziyaretler) {
      if ((z.durum || 'Yapıldı') !== 'Yapıldı' || z.tarih < sinir) continue;
      const fi = byId('firmalar', z.firma_id), pr = byId('projeler', z.proje_id);
      const yer = z.lat != null ? [z.lat, z.lng] : pr?.lat != null ? [pr.lat, pr.lng] : fi?.lat != null ? [fi.lat, fi.lng] : null;
      if (pr?.bolge_id === b.id || fi?.bolge_id === b.id || (yer && inMulti(yer[1], yer[0], multi))) n++;
    }
    return { n };
  }
  const sonZiyaretGun = id => { const t = S.ziyaretler.filter(z => z.firma_id === id && (z.durum || 'Yapıldı') === 'Yapıldı').map(z => z.tarih).sort().pop(); return t ? Math.round((Date.now() - new Date(t)) / 864e5) : null; };
  const aktifAltlik = () => el.querySelector('[data-altlik]')?.value || 'osm';
  async function updKaro() {
    const kutu = el.querySelector('[data-karo]'); if (!kutu) return;
    const { karoSay, karoTemizle } = await import('../karo.js'); const n = await karoSay();
    kutu.innerHTML = n ? `Çevrimdışı: ${n} harita karosu kayıtlı. <button type="button" class="linkbtn" data-karosil>Temizle</button>` : 'Çevrimdışı kullanım: gezdiğin yerler kaydedilir; bölge balonundan “Çevrimdışı için indir” ile OSB\'yi önceden indirebilirsin.';
    kutu.querySelector('[data-karosil]')?.addEventListener('click', async () => { await karoTemizle(); updKaro(); });
  }
  updKaro();
  function drawRegions() {
    const lej = el.querySelector('[data-isilej]'); if (lej) lej.hidden = !f.isi;
    regionLayer.clearLayers();
    if (!f.bolge && !f.isi) return;
    for (const b of S.bolgeler || []) {
      const m = toMulti(b.geojson); if (!m) continue;
      if (f.il !== 'Tümü' && b.il && b.il !== f.il) continue;
      const isi = f.isi ? isiSay(b, m) : null;
      const col = isi ? isiRenk(isi.n) : bolgeRenk(b);
      const poly = L.polygon(m.map(p => p.map(r => r.map(([x, y]) => [y, x]))), { color: col, weight: 2, fillColor: col, fillOpacity: 0.12 });
      poly.bindTooltip(esc(b.ad) + (isi ? ` · ${isi.n} ziyaret` : ''), { permanent: true, direction: 'center', className: 'bolge-label' });
      if (isi) poly.setStyle({ fillOpacity: 0.3 });
      poly.bindPopup(() => bolgePopup(b), { maxWidth: 300 });
      poly.on('click', e => { if (mode) { L.DomEvent.stop(e); map.fire('click', e); } });
      poly.addTo(regionLayer);
    }
  }
  function draw(zoomToResults) {
    cluster.clearLayers();
    const ilOk = r => f.il === 'Tümü' || r.il === f.il;
    let n = 0; const pts = [];
    if (f.proje || f.yaklasik) for (const p of S.projeler) {
      if (p.aday || p.lat == null || !ilOk(p) || !f.durumlar.includes(p.durum) || (f.yil !== 'Tümü' && p.takip_yili != f.yil)) continue;
      if (p.konum_yaklasik ? !f.yaklasik : !f.proje) continue;
      if (!match(f.q, p.ad, p.lokasyon, p.osb, p.belde, firmaAd(p.emut_id), firmaAd(p.gemut_id), p.notlar)) continue;
      const m = L.marker([p.lat, p.lng], { icon: markerIcon('p', durumRenk(p.durum), p.konum_yaklasik), title: p.ad, keyboard: true, draggable: moveOn, autoPan: true });
      if (moveOn) m.on('dragend', () => { const ll = m.getLatLng(); yerlestir('projeler', p, [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]); });
      m.bindTooltip(esc(p.ad), { permanent: true, direction: 'top', className: 'mk-label', offset: [0, -2] });
      m.bindPopup(() => projePopup(p), { maxWidth: 320, minWidth: 260 });
      cluster.addLayer(m); n++; pts.push([p.lat, p.lng]);
    }
    if (f.firma) for (const x of S.firmalar) {
      if (!ilOk(x) || x.lat == null || (x.konum_yaklasik && !f.yaklasik) || !match(f.q, x.ad, x.notlar)) continue;
      const m = L.marker([x.lat, x.lng], { icon: markerIcon('f', f.isi ? (g => g == null || g > 90 ? '#B91C1C' : g > 45 ? '#EA580C' : g > 20 ? '#CA8A04' : '#15803D')(sonZiyaretGun(x.id)) : '#1D2B36', x.konum_yaklasik), title: x.ad, draggable: moveOn, autoPan: true });
      if (moveOn) m.on('dragend', () => { const ll = m.getLatLng(); yerlestir('firmalar', x, [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]); });
      m.bindTooltip(esc(x.ad), { permanent: true, direction: 'top', className: 'mk-label', offset: [0, -2] });
      m.bindPopup(() => firmaPopup(x), { maxWidth: 300, minWidth: 230 });
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
    const yak = S.projeler.filter(p => p.lat != null && p.konum_yaklasik && ilOk(p)).length;
    const yok = S.projeler.filter(p => p.lat == null && ilOk(p)).length;
    el.querySelector('.map-info').innerHTML = `<b>${n}</b> raptiye${yak + yok ? ` · <button type="button" class="linkbtn" data-open-assign>${yak + yok} proje konum bekliyor</button>` : ''}`;
    const oa = el.querySelector('[data-open-assign]'); if (oa) oa.onclick = () => { ap.hidden = false; lp.hidden = true; drawAssignList(); };
    if (zoomToResults && f.q && pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
    updNeed();
  }

  // ---------- Açılır pencereler ----------
  async function photoBlock(paths) {
    if (!paths || !paths.length) return '';
    const urls = (await Promise.all(paths.slice(0, 4).map(p => app.db.url(p)))).filter(Boolean);
    if (!urls.length) return '';
    return `<a class="pp-hero" href="${urls[0]}" target="_blank" rel="noopener"><img src="${urls[0]}" alt=""></a>${urls.length > 1 ? `<div class="pp-photos">${urls.slice(1).map(u => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt=""></a>`).join('')}</div>` : ''}`;
  }
  function projePopup(p) {
    const div = document.createElement('div'); div.className = 'pp';
    const roles = [['Emüt', p.emut_id], ['Gemüt', p.gemut_id], ['Alıcı', p.alici_id], ['Projeci', p.projeci_id]].filter(r => r[1]).map(r => `<div><span>${r[0]}</span> ${esc(firmaAd(r[1]))}</div>`).join('');
    div.innerHTML = `<div class="pp-ph"></div>
      <div class="pp-h">${pill(p.durum)}${p.kritik ? '<span class="pill" style="--c:#B91C1C">Kritik</span>' : ''}<span class="yr">${p.takip_yili || ''}</span></div>
      <h3>${esc(p.ad)}</h3>
      <p class="muted">${esc(konumMetni(p) || p.lokasyon || '')}</p>
      <div class="pp-meta"><div><span>Tutar</span> ${usd(p.tutar_usd)}</div>${roles}</div>
      ${p.notlar ? `<p class="pp-note">${esc(p.notlar.slice(0, 200))}${p.notlar.length > 200 ? '…' : ''}</p>` : ''}
      ${p.konum_yaklasik ? '<p class="hint">Yaklaşık konum. “Konumu taşı” ile gerçek yerine koy.</p>' : ''}
      <div class="pp-act"><a class="btn sm" href="#/proje/${p.id}">Detay</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(p.lat, p.lng)}">Yol tarifi</a><button type="button" class="btn sm ghost" data-move>Konumu taşı</button><button type="button" class="btn sm ghost" data-g>Google</button></div>`;
    div.querySelector('.pp-act').insertAdjacentHTML('afterbegin', '<button type="button" class="btn sm primary" data-ziy>Ziyaret ekle</button>');
    div.querySelector('[data-ziy]').onclick = () => { map.closePopup(); ziyaretForm({ proje_id: p.id, firma_id: p.emut_id || p.alici_id || p.bayi_id || null }); };
    div.querySelector('[data-move]').onclick = () => { map.closePopup(); setMode({ t: 'assign', table: 'projeler', rec: p }); };
    div.querySelector('[data-g]').onclick = () => { map.closePopup(); googleBul({ q: aramaMetni(p), near: [p.lat, p.lng], hedef: { table: 'projeler', rec: p }, sonra: () => draw() }); };
    photoBlock(p.fotolar).then(h => { div.querySelector('.pp-ph').innerHTML = h; });
    return div;
  }
  function firmaPopup(x) {
    const div = document.createElement('div'); div.className = 'pp';
    const pc = S.projeler.filter(p => [p.emut_id, p.gemut_id, p.alici_id, p.bayi_id, p.yatirimci_id, p.projeci_id, p.danisman_id].includes(x.id)).length;
    div.innerHTML = `<div class="pp-ph"></div><div class="pp-h">${(x.tipler || []).map(t => `<span class="pill" style="--c:#1D2B36">${esc(t)}</span>`).join('')}</div>
      <h3>${esc(x.ad)}</h3><p class="muted">${esc(konumMetni(x))}</p>
      <div class="pp-meta"><div><span>Proje</span> ${pc}</div>${x.telefon ? `<div><span>Tel</span> <a href="tel:${esc(x.telefon)}">${esc(x.telefon)}</a></div>` : ''}</div>
      ${x.notlar ? `<p class="pp-note">${esc(x.notlar.slice(0, 200))}</p>` : ''}
      <div class="pp-act"><a class="btn sm" href="#/firma/${x.id}">Detay</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(x.lat, x.lng)}">Yol tarifi</a><button type="button" class="btn sm ghost" data-move>Konumu taşı</button><button type="button" class="btn sm ghost" data-g>Google</button></div>`;
    div.querySelector('.pp-act').insertAdjacentHTML('afterbegin', '<button type="button" class="btn sm primary" data-ziy>Ziyaret ekle</button>');
    div.querySelector('[data-ziy]').onclick = () => { map.closePopup(); ziyaretForm({ firma_id: x.id }); };
    div.querySelector('[data-move]').onclick = () => { map.closePopup(); setMode({ t: 'assign', table: 'firmalar', rec: x }); };
    div.querySelector('[data-g]').onclick = () => { map.closePopup(); googleBul({ q: aramaMetni(x), near: [x.lat, x.lng], hedef: { table: 'firmalar', rec: x }, sonra: () => draw() }); };
    photoBlock(x.fotolar).then(h => { div.querySelector('.pp-ph').innerHTML = h; });
    return div;
  }
  function ziyaretPopup(z) {
    const div = document.createElement('div'); div.className = 'pp';
    const k = byId('kisiler', z.kisi_id);
    div.innerHTML = `<div class="pp-ph"></div><p class="muted">${tarih(z.tarih)} · ${esc(z.durum || 'Yapıldı')}</p><h3>${esc(firmaAd(z.firma_id) || 'Ziyaret')}</h3>
      ${k ? `<p>${esc(k.ad_soyad)}</p>` : ''}${z.sonuc_tipi ? `<p><b>${esc(z.sonuc_tipi)}</b> ${esc(z.sonuc || '')}</p>` : ''}${z.notlar ? `<p class="pp-note">${esc(z.notlar.slice(0, 240))}</p>` : ''}
      <div class="pp-act"><button type="button" class="btn sm" data-z>Aç</button></div>`;
    div.querySelector('[data-z]').onclick = () => ziyaretForm(z);
    photoBlock(z.fotolar).then(h => { div.querySelector('.pp-ph').innerHTML = h; });
    return div;
  }
  function bolgePopup(b) {
    const div = document.createElement('div'); div.className = 'pp';
    const ps = bolgeProjeleri(b);
    const acik = ps.filter(p => ACIK.includes(p.durum));
    div.innerHTML = `<div class="pp-h"><span class="pill" style="--c:${bolgeRenk(b)}">${esc(b.tip || 'Bölge')}</span>${b.grup ? `<span class="muted">${esc(b.grup)}</span>` : ''}</div>
      <h3>${esc(b.ad)}</h3><p class="muted">${esc([b.ilce, b.il].filter(Boolean).join(', '))}</p>
      <div class="pp-meta"><div><span>Proje</span> ${ps.length} (${acik.length} açık)</div><div><span>Potansiyel</span> ${usd(acik.reduce((s, p) => s + (+p.tutar_usd || 0), 0))}</div><div><span>Sipariş</span> ${ps.filter(p => p.durum === 'Sipariş').length}</div></div>
      <div class="pp-act"><a class="btn sm" href="#/bolgeler">Bölgeler</a><button type="button" class="btn sm ghost" data-ed>Düzenle</button><button type="button" class="btn sm ghost" data-redraw>Sınırı yeniden çiz</button></div>`;
    div.querySelector('[data-ed]').onclick = () => { map.closePopup(); bolgeForm(b, () => { draw(); drawRegions(); }); };
    div.querySelector('[data-redraw]').onclick = () => { map.closePopup(); startDraw(b); };
    div.querySelector('.pp-act').insertAdjacentHTML('beforeend', '<button type="button" class="btn sm ghost" data-cevrim>Çevrimdışı için indir</button>');
    div.querySelector('[data-cevrim]').onclick = async e => {
      const k = await import('../karo.js'), kutu = k.bolgeKutusu(b); if (!kutu) return toast('Bu bölgenin sınırı yok.', 'err');
      const alt = String(aktifAltlik()).startsWith('google') || aktifAltlik() === 'esri' ? 'esri' : 'osm';
      const btn = e.currentTarget; btn.disabled = true;
      try { const r = await k.karoIndir(kutu, alt, (i, n) => { btn.textContent = `İndiriliyor ${i}/${n}`; }); btn.textContent = 'İndirildi ✓'; toast(`${b.ad}: ${r.ok} harita karosu kaydedildi (${alt === 'esri' ? 'Esri uydu' : 'sokak haritası'}).${r.kirpildi ? ' Alan büyük olduğu için en yakın görünüm indirilmedi.' : ''} İnternet yokken bu bölge haritada görünür.`); updKaro(); }
      catch (err) { btn.disabled = false; btn.textContent = 'Çevrimdışı için indir'; toast(err.message, 'err'); }
    };
    return div;
  }

  async function pinMenu(latlng) {
    const ll = [+latlng.lat.toFixed(6), +latlng.lng.toFixed(6)];
    const div = document.createElement('div'); div.className = 'pp pin-menu';
    div.innerHTML = `<h3>Bu konuma ne kaydedilsin?</h3><p class="muted" data-det>Konum algılanıyor…</p>
      <div class="pin-opts"><button type="button" class="btn" data-a="p">Yeni proje</button><button type="button" class="btn" data-a="f">Yeni firma</button>
      <button type="button" class="btn" data-a="z">Ziyaret kaydet</button><button type="button" class="btn ghost" data-a="m">Var olan kaydı buraya taşı</button><button type="button" class="btn ghost" data-a="g">Google'da buradaki işletmeyi seç</button></div>`;
    L.popup({ maxWidth: 280 }).setLatLng(latlng).setContent(div).openOn(map);
    const kp = konumAlgila(ll[0], ll[1]);
    kp.then(k => { const d = div.querySelector('[data-det]'); if (d) d.textContent = konumMetni(k) || `${ll[0]}, ${ll[1]}`; });
    div.onclick = async e => {
      const a = e.target.dataset.a; if (!a) return; map.closePopup();
      const k = await kp;
      const loc = { lat: ll[0], lng: ll[1], konum_yaklasik: false, il: k.il, ilce: k.ilce, belde: k.belde, osb: k.osb, bolge_id: k.bolge_id };
      if (a === 'p') yeniProje(loc);
      if (a === 'f') yeniFirma(loc);
      if (a === 'z') ziyaretForm({ lat: ll[0], lng: ll[1], durum: 'Yapıldı' });
      if (a === 'm') tasi(ll);
      if (a === 'g') googleBul({ near: ll, zoom: 18, sonra: () => { draw(); drawRegions(); } });
    };
  }
  function tasi(ll) {
    const p = openDrawer(`<header class="dh"><h2 id="drawer-title">Kaydı bu konuma taşı</h2><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody"><label class="fld">Proje veya firma<input list="tasi-dl" id="tasi-q" autofocus placeholder="Adını yaz"></label>
      <datalist id="tasi-dl">${S.projeler.map(x => `<option value="Proje: ${esc(x.ad)}">`).join('')}${S.firmalar.map(x => `<option value="Firma: ${esc(x.ad)}">`).join('')}</datalist>
      <div class="dfoot"><button class="btn primary" data-ok>Taşı</button></div></div>`);
    p.querySelector('[data-ok]').onclick = async () => {
      const v = p.querySelector('#tasi-q').value; const m = v.match(/^(Proje|Firma): (.*)$/);
      const t = m && (m[1] === 'Proje' ? 'projeler' : 'firmalar');
      const rec = m && S[t].find(x => x.ad === m[2]);
      if (!rec) return toast('Listeden bir kayıt seç.', 'err');
      closeDrawer(); await yerlestir(t, rec, ll);
    };
  }

  // Her katman ayrı: biri hata verirse diğerleri yine çizilir ve hata ekranda görünür
  const dene = (ad, fn) => { try { const r = fn(); r?.catch?.(e => haritaHata(ad, e)); } catch (e) { haritaHata(ad, e); } };
  function haritaHata(ad, e) { console.error('Harita', ad, e); const mi = el.querySelector('.map-info'); if (mi) mi.insertAdjacentHTML('beforeend', `<span class="neg"> · ${esc(ad)} çizilemedi: ${esc(e?.message || String(e))}</span>`); }
  dene('İl sınırları', drawBorders); dene('Sanayi bölgeleri', drawRegions); dene('Raptiyeler', () => draw());
  setTimeout(() => map.invalidateSize(), 100);
  if (app.pendingDraw) { const b = app.pendingDraw; app.pendingDraw = null; if (b.geojson) { const m = toMulti(b.geojson); map.fitBounds(m[0][0].map(([x, y]) => [y, x]), { maxZoom: 16 }); } startDraw(b.id ? b : null); }
  // Çevrimiçiyse ayrıntılı il sınırlarını bir kez indir
  detayliSinirIndir().then(ch => { if (ch && map) drawBorders(); }).catch(() => {});
}

function fly(il, anim = true) {
  if (il === 'Tümü') map.fitBounds(REGION, { animate: anim });
  else ilSinirlari().then(s => { const pts = s[il].flatMap(p => p[0].map(([x, y]) => [y, x])); map.fitBounds(pts, { animate: anim, padding: [20, 20] }); });
}

let undoT;
function toastUndo(msg, undo) {
  const el = document.getElementById('toast');
  el.innerHTML = `${esc(msg)} <button type="button" class="linkbtn undo">Geri al</button>`;
  el.className = 'show interactive';
  el.querySelector('.undo').onclick = async () => { el.className = ''; await undo(); toast('Geri alındı.'); };
  clearTimeout(undoT); undoT = setTimeout(() => { if (el.className.includes('interactive')) el.className = ''; }, 6000);
}
