// Google'dan konum içe aktarma: Google Benim Haritalarım (KML/KMZ), Google Takeout (Kaydedilen yerler .json, liste .csv)
// ve yapıştırılan Google Haritalar bağlantıları. Noktalar mevcut firma/projeyle ada göre eşleştirilir ya da yeni kayıt olur.
import { S, uuid } from '../db.js';
import { app } from '../state.js';
import { esc, fold, toast, openDrawer, closeDrawer, pickFiles } from '../ui.js';
import { konumAlgila, inMulti, toMulti } from '../geo.js';
import { googleKey, adaGoreBul } from '../google.js';
import { yuklemeKaydet } from '../belgeler.js';

// ---------- Google Haritalar bağlantısından koordinat ----------
export function linkCoz(url) {
  const u = decodeURIComponent(String(url || '').replace(/\+/g, ' '));
  let m;
  const r = { url: String(url || '').trim(), ad: null, lat: null, lng: null, kisa: /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(u) };
  if ((m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(u))) [r.lat, r.lng] = [+m[1], +m[2]];
  else if ((m = /[?&](?:q|query|ll|destination|center|sll)=(?:loc:)?\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(u))) [r.lat, r.lng] = [+m[1], +m[2]];
  else if ((m = /\/maps\/(?:search|place|dir)\/\s*(-?\d{1,2}\.\d+)\s*,\s*\+?\s*(-?\d{1,3}\.\d+)/.exec(u))) [r.lat, r.lng] = [+m[1], +m[2]];
  else if ((m = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(u))) [r.lat, r.lng] = [+m[1], +m[2]];
  else if ((m = /^\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*$/.exec(u))) [r.lat, r.lng] = [+m[1], +m[2]];
  if ((m = /\/maps\/place\/([^/@?]+)/.exec(u)) && !/^-?\d/.test(m[1])) r.ad = m[1].trim();
  else if ((m = /[?&]q=([^&]+)/.exec(u)) && !/^-?\d/.test(m[1])) r.ad = m[1].trim();
  return r;
}

// ---------- Dosya ayrıştırıcıları ----------
const strip = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
function kml(text, kaynak) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('KML dosyası okunamadı.');
  const out = [];
  for (const pm of doc.getElementsByTagNameNS('*', 'Placemark')) {
    const tag = (el, n) => el.getElementsByTagNameNS('*', n)[0];
    const ad = tag(pm, 'name')?.textContent.trim() || 'Adsız nokta';
    const not = strip(tag(pm, 'description')?.textContent);
    let grup = null; for (let p = pm.parentElement; p; p = p.parentElement) if (p.localName === 'Folder') { grup = [...p.children].find(c => c.localName === 'name')?.textContent.trim(); break; }
    const pt = tag(pm, 'Point'), poly = tag(pm, 'Polygon');
    if (pt) {
      const [lng, lat] = tag(pt, 'coordinates').textContent.trim().split(/[\s,]+/).map(Number);
      out.push({ tur: 'nokta', ad, not, grup, lat, lng, kaynak });
    } else if (poly) {
      const ring = tag(tag(poly, 'outerBoundaryIs'), 'coordinates').textContent.trim().split(/\s+/).map(c => c.split(',').slice(0, 2).map(Number)).filter(c => c.length === 2 && !isNaN(c[0]));
      if (ring.length >= 3) out.push({ tur: 'alan', ad, not, grup, geojson: { type: 'Polygon', coordinates: [ring] }, lat: ring.reduce((a, c) => a + c[1], 0) / ring.length, lng: ring.reduce((a, c) => a + c[0], 0) / ring.length, kaynak });
    }
  }
  return out;
}
async function kmz(buf, kaynak) {
  if (!window.JSZip) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('KMZ açıcı yüklenemedi; internet bağlantını kontrol et.')); document.head.appendChild(s); });
  const z = await JSZip.loadAsync(buf);
  const f = Object.values(z.files).find(f => /\.kml$/i.test(f.name));
  if (!f) throw new Error('KMZ içinde KML dosyası yok.');
  return kml(await f.async('string'), kaynak);
}
function geojson(d, kaynak) {
  const feats = d.type === 'FeatureCollection' ? d.features : d.type === 'Feature' ? [d] : [];
  const out = [];
  for (const ft of feats) {
    const p = ft.properties || {}, g = ft.geometry || {};
    const L = p.location || p.Location || {};
    const ad = p.name || p.Title || p.title || L.name || L['Business Name'] || L.address || L.Address || 'Adsız nokta';
    const url = p.google_maps_url || p['Google Maps URL'] || p.url || null;
    const not = [p.comment || p.Comment || p.description, L.address || L.Address].filter(Boolean).join('\n');
    if (g.type === 'Point') {
      let [lng, lat] = g.coordinates || [];
      const gc = L['Geo Coordinates']; if ((!lat && !lng) && gc) { lat = +gc.Latitude; lng = +gc.Longitude; }
      const lc = linkCoz(url);
      if (!lat && !lng && lc.lat != null) { lat = lc.lat; lng = lc.lng; }
      out.push({ tur: 'nokta', ad, not, adres: L.address || L.Address || null, url, lat: lat || null, lng: lng || null, kaynak });
    } else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const m = toMulti(g); const ring = m[0][0];
      out.push({ tur: 'alan', ad, not, geojson: g, lat: ring.reduce((a, c) => a + c[1], 0) / ring.length, lng: ring.reduce((a, c) => a + c[0], 0) / ring.length, kaynak });
    }
  }
  return out;
}
function csvSatirlari(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',' || c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function csv(text, kaynak) {
  const rows = csvSatirlari(text.replace(/^﻿/, ''));
  if (!rows.length) return [];
  const h = rows[0].map(x => fold(x).trim());
  const col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
  const ci = { ad: col(/^title$/, /baslik/, /^ad$/, /^name$/, /^isim$/), not: col(/^note$/, /^not$/, /comment/, /aciklama/), url: col(/url/, /link/, /baglanti/),
    lat: col(/^lat/, /enlem/), lng: col(/^(lng|lon)/, /boylam/), adres: col(/adres/, /address/) };
  const out = [];
  for (const r of rows.slice(1)) {
    const ad = (r[ci.ad] || '').trim();
    // Tırnaksız bağlantıdaki virgüller sütunları kaydırmasın (bağlantı son sütunsa kalanı birleştir)
    const url = (ci.url >= 0 && ci.url === h.length - 1 && r.length > h.length ? r.slice(ci.url).join(',') : (r[ci.url] || '')).trim();
    if (!ad && !url) continue;
    const lc = linkCoz(url);
    let lat = ci.lat >= 0 ? parseFloat(String(r[ci.lat]).replace(',', '.')) : null, lng = ci.lng >= 0 ? parseFloat(String(r[ci.lng]).replace(',', '.')) : null;
    if (isNaN(lat) || isNaN(lng) || lat == null) { lat = lc.lat; lng = lc.lng; }
    out.push({ tur: 'nokta', ad: ad || lc.ad || 'Adsız nokta', not: (r[ci.not] || '').trim(), adres: ci.adres >= 0 ? r[ci.adres] : null, url: url || null, lat, lng, kisa: lc.kisa, kaynak });
  }
  return out;
}
function metin(text) {
  const out = [];
  for (const line of text.split(/\n+/).map(x => x.trim()).filter(Boolean)) {
    const um = /(https?:\/\/\S+)/.exec(line);
    const url = um ? um[1] : line;
    const adKismi = um ? line.replace(um[1], '').replace(/[|:\-–]+\s*$/, '').replace(/^\s*[|:\-–]+/, '').trim() : '';
    const lc = linkCoz(url);
    out.push({ tur: 'nokta', ad: adKismi || lc.ad || (lc.lat != null ? `Nokta ${lc.lat.toFixed(4)}, ${lc.lng.toFixed(4)}` : 'Adsız nokta'), url: um ? url : null, lat: lc.lat, lng: lc.lng, kisa: lc.kisa, kaynak: 'Bağlantı' });
  }
  return out;
}
export async function dosyaOku(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.kmz')) return kmz(await file.arrayBuffer(), file.name);
  const text = await file.text();
  if (n.endsWith('.kml') || /^\s*<\?xml|<kml/i.test(text.slice(0, 200))) return kml(text, file.name);
  if (n.endsWith('.json') || n.endsWith('.geojson')) return geojson(JSON.parse(text), file.name);
  if (n.endsWith('.csv') || n.endsWith('.txt')) return text.includes('http') && !text.split('\n')[0].includes(',') ? metin(text) : csv(text, file.name);
  throw new Error(file.name + ': desteklenmeyen dosya türü. KML, KMZ, JSON veya CSV seç.');
}

// ---------- Eşleştirme ----------
const toks = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !/^(ltd|sti|san|tic|elk|elektrik|insaat|muhendislik|ve|osb|a s)$/.test(w));
function eslestir(n, hedef) {
  if (n.tur === 'alan') { const b = S.bolgeler.find(b => fold(b.ad) === fold(n.ad)); return b ? 'bolgeler:' + b.id : 'yeni:bolgeler'; }
  const nt = toks(n.ad); let best = null, bs = 0;
  for (const t of ['firmalar', 'projeler']) for (const r of S[t]) {
    if (fold(r.ad) === fold(n.ad)) return t + ':' + r.id;
    const rt = toks(r.ad); if (!rt.length || !nt.length) continue;
    const ortak = rt.filter(w => nt.includes(w)).length;
    const sc = ortak / Math.max(rt.length, nt.length) + (t === hedef ? 0.05 : 0);
    if (ortak && sc > bs) { bs = sc; best = t + ':' + r.id; }
  }
  return bs >= 0.5 ? best : 'yeni:' + hedef;
}

// ---------- Panel ----------
export function iceAktarPaneli(sonra) {
  let noktalar = []; const dosyalar = [];
  const p = openDrawer(`<header class="dh"><div><p class="muted">Google Haritalar</p><h2 id="drawer-title">Google'dan konum aktar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody imp">
      <details class="howto"><summary>Konumları Google'dan nasıl alırım?</summary>
        <p><b>Google Benim Haritalarım (My Maps):</b> haritayı aç → ⋮ menü → <i>KML/KMZ'ye aktar</i> → dosyayı burada seç. Klasörler ve çizdiğin alanlar (OSB sınırları) da gelir.</p>
        <p><b>Google Haritalar'da kaydettiğin yerler:</b> takeout.google.com → yalnızca <i>Haritalar (yerleriniz)</i> ve <i>Kaydedilenler</i>'i seç → indir. Zip içindeki <code>Kaydedilen Yerler.json</code> (Saved Places.json) ve listelerin <code>.csv</code> dosyalarını burada seç.</p>
        <p><b>Tek tek yerler:</b> Google Haritalar'da yeri aç → <i>Paylaş → Bağlantıyı kopyala</i> → aşağıya yapıştır. Her satıra bir bağlantı; istersen başına adını yaz: <code>Drv Depo | https://…</code>. Telefondaki kısa bağlantılar (maps.app.goo.gl) koordinat içermez; onları tarayıcıda açıp adres çubuğundaki uzun bağlantıyı kopyala.</p>
      </details>
      <div class="btnrow"><button type="button" class="btn primary" data-file>Dosya seç (KML, KMZ, JSON, CSV)</button></div>
      <div class="fld"><label for="imp-links">ya da Google Haritalar bağlantılarını yapıştır</label><textarea id="imp-links" rows="3" placeholder="Drv Depo | https://www.google.com/maps/place/…/@36.99,35.33,17z/…"></textarea>
        <div class="btnrow"><button type="button" class="btn" data-links>Bağlantıları oku</button></div></div>
      <div data-prev></div>
    </div>`, { wide: true });
  const prev = p.querySelector('[data-prev]');
  const ekle = yeni => { noktalar = noktalar.concat(yeni.map(n => ({ ...n, _id: uuid(), sec: !(n.lat == null && /^Adsız/.test(n.ad)) }))); ciz(); };
  p.querySelector('[data-file]').onclick = async () => {
    const files = await pickFiles({ accept: '.kml,.kmz,.json,.geojson,.csv,.txt', multiple: true });
    for (const f of files) { try { const r = await dosyaOku(f); if (r.length) dosyalar.push(f); if (!r.length) toast(f.name + ': nokta bulunamadı.', 'err'); ekle(r); } catch (e) { toast(e.message, 'err'); } }
  };
  p.querySelector('[data-links]').onclick = () => { const t = p.querySelector('#imp-links').value; if (!t.trim()) return; ekle(metin(t)); p.querySelector('#imp-links').value = ''; };

  let hedefTip = 'firmalar';
  function ciz() {
    if (!noktalar.length) { prev.innerHTML = ''; return; }
    for (const n of noktalar) if (!n.es || n.es.startsWith('yeni:')) n.es = eslestir(n, hedefTip);
    const konumsuz = noktalar.filter(n => n.tur === 'nokta' && n.lat == null);
    const opt = (n) => {
      const cur = n.es;
      const aday = n.tur === 'alan' ? [['yeni:bolgeler', 'Yeni sanayi bölgesi'], ...S.bolgeler.map(b => ['bolgeler:' + b.id, 'Bölge: ' + b.ad])]
        : [['yeni:firmalar', 'Yeni firma'], ['yeni:projeler', 'Yeni proje']];
      if (!aday.some(a => a[0] === cur) && cur && !cur.startsWith('yeni:')) { const [t, id] = cur.split(':'); const r = S[t].find(x => x.id === id); if (r) aday.push([cur, (t === 'firmalar' ? 'Firma: ' : t === 'projeler' ? 'Proje: ' : 'Bölge: ') + r.ad]); }
      return `<select data-es="${n._id}" aria-label="${esc(n.ad)} nereye aktarılsın">${aday.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}<option value="ara">Başka kayıt seç…</option></select>`;
    };
    prev.innerHTML = `<hr><div class="imp-head"><h3>${noktalar.length} nokta okundu</h3>
      <label>Eşleşmeyenler <select data-hedef><option value="firmalar" ${hedefTip === 'firmalar' ? 'selected' : ''}>yeni firma olsun</option><option value="projeler" ${hedefTip === 'projeler' ? 'selected' : ''}>yeni proje olsun</option></select></label></div>
      ${konumsuz.length ? `<p class="warn">${konumsuz.length} noktanın bağlantısında koordinat yok.${googleKey() ? ` <button type="button" class="btn sm" data-gfind>Google'da adlarına göre bul</button>` : ' Bunlar konumsuz aktarılır ve “Konum ata” listesine düşer. Ayarlar\'a Google API anahtarı girersen adlarına göre bulunabilir.'}</p>` : ''}
      <div class="ptable-wrap"><table class="ptable imp-t"><thead><tr><th><input type="checkbox" data-all checked aria-label="Tümünü seç"></th><th>Ad</th><th>Konum</th><th>Nereye</th><th>Kaynak</th></tr></thead><tbody>
      ${noktalar.map(n => `<tr><td><input type="checkbox" data-sec="${n._id}" ${n.sec ? 'checked' : ''} aria-label="${esc(n.ad)}"></td>
        <td><b>${esc(n.ad)}</b>${n.grup ? `<small>${esc(n.grup)}</small>` : ''}${n.not ? `<small>${esc(n.not.slice(0, 80))}</small>` : ''}</td>
        <td class="nowrap">${n.tur === 'alan' ? 'Alan (sınır)' : n.lat != null ? `${(+n.lat).toFixed(5)}, ${(+n.lng).toFixed(5)}` : `<span class="muted">${n.kisa ? 'kısa bağlantı, koordinat yok' : 'yok'}</span>`}</td>
        <td>${opt(n)}</td><td class="muted">${esc(n.kaynak || '')}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Var olan bir kayda eşleşen noktada yalnızca konum (ve boşsa adres) güncellenir; diğer bilgilerine dokunulmaz.</p>
      <div class="btnrow"><button type="button" class="btn primary" data-go>Seçilenleri aktar</button><button type="button" class="btn ghost" data-clear>Listeyi temizle</button></div>`;
    prev.querySelector('[data-hedef]').onchange = e => { hedefTip = e.target.value; for (const n of noktalar) if (n.es?.startsWith('yeni:') && n.tur !== 'alan') n.es = null; ciz(); };
    prev.querySelector('[data-all]').onchange = e => { noktalar.forEach(n => n.sec = e.target.checked); ciz(); };
    prev.querySelectorAll('[data-sec]').forEach(c => c.onchange = () => { noktalar.find(n => n._id === c.dataset.sec).sec = c.checked; });
    prev.querySelectorAll('[data-es]').forEach(s => s.onchange = () => {
      const n = noktalar.find(x => x._id === s.dataset.es);
      if (s.value !== 'ara') { n.es = s.value; return; }
      const v = prompt(`“${n.ad}” hangi kayda bağlansın? Firma veya proje adını yaz:`);
      const f = v && fold(v.trim());
      const hit = f && (S.firmalar.find(x => fold(x.ad) === f) && 'firmalar:' + S.firmalar.find(x => fold(x.ad) === f).id || S.projeler.find(x => fold(x.ad) === f) && 'projeler:' + S.projeler.find(x => fold(x.ad) === f).id
        || S.firmalar.find(x => fold(x.ad).includes(f)) && 'firmalar:' + S.firmalar.find(x => fold(x.ad).includes(f)).id || S.projeler.find(x => fold(x.ad).includes(f)) && 'projeler:' + S.projeler.find(x => fold(x.ad).includes(f)).id);
      if (hit) n.es = hit; else toast('Bu adla kayıt bulunamadı.', 'err');
      ciz();
    });
    prev.querySelector('[data-gfind]')?.addEventListener('click', async e => {
      e.target.disabled = true; let ok = 0;
      for (const n of konumsuz) { try { const r = await adaGoreBul(n.ad); if (r) { n.lat = r.lat; n.lng = r.lng; n.adres = n.adres || r.adres; n.google_place_id = r.google_place_id; n.url = n.url || r.google_url; ok++; } } catch (er) { toast(er.message, 'err'); break; } }
      toast(`${ok}/${konumsuz.length} nokta Google'da bulundu. Aktarmadan önce kontrol et.`); ciz();
    });
    prev.querySelector('[data-clear]').onclick = () => { noktalar = []; ciz(); };
    prev.querySelector('[data-go]').onclick = () => aktar();
  }

  async function aktar() {
    const sec = noktalar.filter(n => n.sec && n.es);
    if (!sec.length) return toast('Aktarılacak nokta seçilmedi.', 'err');
    const go = prev.querySelector('[data-go]'); go.disabled = true; go.textContent = 'Aktarılıyor…';
    const yaz = { firmalar: [], projeler: [], bolgeler: [] };
    let yeni = 0, guncel = 0;
    for (const n of sec) {
      const k = n.lat != null ? await konumAlgila(n.lat, n.lng, { online: false }) : {};
      const konum = n.lat != null ? { lat: +(+n.lat).toFixed(6), lng: +(+n.lng).toFixed(6), konum_yaklasik: false, il: k.il, ilce: k.ilce, ...(k.osb ? { osb: k.osb, bolge_id: k.bolge_id } : {}) } : {};
      const g = { ...(n.google_place_id ? { google_place_id: n.google_place_id } : {}), ...(n.url ? { google_url: n.url } : {}) };
      const [t, id] = n.es.split(':');
      if (t === 'yeni') {
        const not = [n.not, n.grup ? `Google listesi: ${n.grup}` : null].filter(Boolean).join('\n') || null;
        if (id === 'bolgeler') yaz.bolgeler.push({ id: uuid(), ad: n.ad, tip: /serbest/i.test(n.ad) ? 'Serbest bölge' : /sanayi sitesi/i.test(n.ad) ? 'Sanayi sitesi' : 'OSB', grup: n.grup || k.il || null, il: k.il, ilce: k.ilce, geojson: n.geojson, notlar: n.not || null });
        else if (id === 'firmalar') yaz.firmalar.push({ id: uuid(), ad: n.ad, tipler: [], adres: n.adres || null, notlar: not, fotolar: [], konum_yaklasik: true, ...konum, ...g });
        else yaz.projeler.push({ id: uuid(), ad: n.ad, durum: 'Proje', takip_yili: new Date().getFullYear(), adres: n.adres || null, notlar: not, fotolar: [], urun_gruplari: [], konum_yaklasik: true, ...konum, ...g });
        yeni++;
      } else {
        const r = S[t].find(x => x.id === id); if (!r) continue;
        if (t === 'bolgeler') yaz.bolgeler.push({ ...r, geojson: n.geojson || r.geojson });
        else yaz[t].push({ ...r, ...konum, ...g, adres: r.adres || n.adres || null });
        guncel++;
      }
    }
    try {
      for (const t of ['bolgeler', 'firmalar', 'projeler']) if (yaz[t].length) await app.db.bulk(t, yaz[t]);
      // Yeni çizilen alanların içinde kalan kayıtlara bölgeyi yaz
      for (const b of yaz.bolgeler) {
        const m = toMulti(b.geojson); if (!m) continue;
        const ic = ['projeler', 'firmalar'].flatMap(t => S[t].filter(r => r.lat != null && !r.konum_yaklasik && inMulti(r.lng, r.lat, m) && r.bolge_id !== b.id).map(r => [t, { ...r, bolge_id: b.id, osb: b.ad }]));
        for (const [t, r] of ic) await app.db.save(t, r);
      }
      toast(`${yeni} yeni kayıt eklendi, ${guncel} kaydın konumu güncellendi.`);
      for (const f of dosyalar) yuklemeKaydet(f, 'Google konumları', `${yeni} yeni, ${guncel} güncellenen kayıt`);
      closeDrawer(); sonra ? sonra() : app.refresh();
    } catch (e) { go.disabled = false; go.textContent = 'Seçilenleri aktar'; toast('Aktarılamadı: ' + e.message, 'err'); }
  }
}
