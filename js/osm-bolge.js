// OpenStreetMap'ten organize sanayi bölgesi ve sanayi sitesi sınırlarını otomatik getirir (Overpass API).
// Sorguda yalnızca bölgenin koordinat kutusu gönderilir; kişisel veri gitmez.
import { S } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, openDrawer, closeDrawer, num, BOLGE_KUTU, ILLER } from './ui.js';
import { ilBul, ilceBul } from './geo.js';

// Arama kutusu: firma profilindeki illerin sınırları (s,w,n,e)
const kutu = () => `${BOLGE_KUTU.s},${BOLGE_KUTU.w},${BOLGE_KUTU.n},${BOLGE_KUTU.e}`;
const AD = 'OSB|Organize|Sanayi Sitesi|Sanayi Bölgesi|Serbest Bölge|Küçük Sanayi|KSS|Sanayi Çarşısı|Teknopark';
export const SORGU = () => `[out:json][timeout:90];(way["landuse"="industrial"]["name"~"${AD}",i](${kutu()});relation["landuse"="industrial"]["name"~"${AD}",i](${kutu()});way["place"="industrial"]["name"~"${AD}",i](${kutu()});relation["boundary"]["name"~"Organize Sanayi",i](${kutu()}););out geom;`;
const SUNUCU = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const anahtar = p => p.map(c => c[0].toFixed(6) + ',' + c[1].toFixed(6));
const kapat = r => { if (r.length && (r[0][0] !== r.at(-1)[0] || r[0][1] !== r.at(-1)[1])) r.push([...r[0]]); return r; };
// Parçalı yolları uç uca ekleyerek kapalı halkalar oluşturur
export function halkalar(parcalar) {
  const kalan = parcalar.map(p => p.slice()).filter(p => p.length > 1), out = [];
  while (kalan.length) {
    let r = kalan.shift();
    for (let g = 0; g < 500 && kalan.length; g++) {
      const [bas] = anahtar([r[0]]), [son] = anahtar([r.at(-1)]);
      if (bas === son) break;
      const i = kalan.findIndex(p => { const [a] = anahtar([p[0]]), [b] = anahtar([p.at(-1)]); return a === son || b === son || a === bas || b === bas; });
      if (i < 0) break;
      const p = kalan.splice(i, 1)[0], [a] = anahtar([p[0]]), [b] = anahtar([p.at(-1)]);
      if (a === son) r = r.concat(p.slice(1)); else if (b === son) r = r.concat(p.reverse().slice(1));
      else if (b === bas) r = p.concat(r.slice(1)); else r = p.reverse().concat(r.slice(1));
    }
    if (r.length >= 4) out.push(kapat(r));
  }
  return out;
}
const alanKm2 = ring => { let s = 0; const lat0 = ring[0][1] * Math.PI / 180; for (let i = 1; i < ring.length; i++) s += (ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1]); return Math.abs(s / 2) * 111.32 * 111.32 * Math.cos(lat0); };
const merkez = ring => { let x = 0, y = 0; for (const c of ring) { x += c[0]; y += c[1]; } return [y / ring.length, x / ring.length]; };

// Overpass yanıtını { ad, geojson, alan, merkez } listesine çevirir; aynı adlı parçalar tek bölgede birleşir
export function overpassCevir(json) {
  const gruplar = new Map();
  for (const e of json.elements || []) {
    const ad = (e.tags?.name || '').trim(); if (!ad) continue;
    let rings = [];
    if (e.type === 'way' && e.geometry) rings = halkalar([e.geometry.map(g => [g.lon, g.lat])]);
    if (e.type === 'relation') rings = halkalar((e.members || []).filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => m.geometry.map(g => [g.lon, g.lat])));
    rings = rings.filter(r => alanKm2(r) > 0.02);
    if (!rings.length) continue;
    const k = fold(ad).replace(/[^a-z0-9]/g, '');
    const g = gruplar.get(k) || { ad, polys: [], alan: 0 };
    for (const r of rings) { g.polys.push([r]); g.alan += alanKm2(r); }
    gruplar.set(k, g);
  }
  return [...gruplar.values()].map(g => {
    const enBuyuk = g.polys.slice().sort((a, b) => alanKm2(b[0]) - alanKm2(a[0]))[0][0];
    return { ad: g.ad, alan: g.alan, merkez: merkez(enBuyuk), geojson: g.polys.length === 1 ? { type: 'Polygon', coordinates: g.polys[0] } : { type: 'MultiPolygon', coordinates: g.polys } };
  }).sort((a, b) => b.alan - a.alan);
}
const tipBul = ad => /serbest/i.test(ad) ? 'Serbest bölge' : /küçük sanayi|kss|sanayi sitesi|sanayi çarşısı/i.test(ad) ? 'Sanayi sitesi' : /teknopark/i.test(ad) ? 'Diğer' : 'OSB';
// Var olan bölgeyle ad eşleşmesi: kelimelerin çoğu ortaksa aynı bölge sayılır
const kel = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !/^(osb|organize|sanayi|bolgesi|bolge|sitesi|mudurlugu|karma)$/.test(w));
export function eslesen(ad) {
  const k = kel(ad); if (!k.length) return S.bolgeler.find(b => fold(b.ad) === fold(ad)) || null;
  let en = null, p = 0;
  for (const b of S.bolgeler) { const bk = kel(b.ad); if (!bk.length) continue; const o = bk.filter(w => k.includes(w)).length / Math.max(bk.length, k.length); if (o > p) { p = o; en = b; } }
  return p >= 0.5 ? en : null;
}

export async function osbGetir() {
  let son;
  for (const u of SUNUCU) {
    try { const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(SORGU()), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); if (r.ok) return overpassCevir(await r.json()); son = new Error('Sunucu yanıtı ' + r.status); }
    catch (e) { son = e; }
  }
  throw new Error('OpenStreetMap sunucusuna ulaşılamadı (' + (son?.message || '') + '). Biraz sonra tekrar dene.');
}

export async function osbPaneli(sonra) {
  const p = openDrawer(`<header class="dh"><div><p class="muted">OpenStreetMap</p><h2 id="drawer-title">Sanayi bölgelerini otomatik getir</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody" data-govde><p class="hint">${esc(ILLER.join(', '))} illerindeki OSB, sanayi sitesi ve serbest bölge sınırları aranıyor…</p><div class="progress"><span style="width:30%"></span></div></div>`, { wide: true });
  const g = p.querySelector('[data-govde]');
  let l;
  try { l = await osbGetir(); } catch (e) { g.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
  for (const x of l) { x.il = await ilBul(x.merkez[0], x.merkez[1]); x.ilce = x.il ? ilceBul(x.il, x.merkez[0], x.merkez[1]) : null; x.esl = eslesen(x.ad); }
  l = l.filter(x => x.il);
  if (!l.length) { g.innerHTML = '<p class="hint">Bölgede adı OSB / sanayi olan sınır bulunamadı.</p>'; return; }
  g.innerHTML = `<p>${l.length} sanayi bölgesi bulundu. İşaretli olanlar eklenir; listede aynı adla olan bölgenin sınırı yoksa sınırı eklenir. Var olan çizimlerine dokunulmaz.</p>
    <div class="btnrow"><button type="button" class="btn sm ghost" data-hepsi>Tümünü seç</button><button type="button" class="btn sm ghost" data-hic>Hiçbirini seçme</button></div>
    <table class="tbl osb-tbl"><thead><tr><th></th><th>Bölge</th><th>Yer</th><th class="r">Alan</th><th>Durum</th></tr></thead><tbody>${l.map((x, i) => {
      const durum = x.esl ? (x.esl.geojson ? 'listede, sınırı var' : `sınırı eklenecek → ${x.esl.ad}`) : 'yeni bölge';
      const sec = !(x.esl && x.esl.geojson);
      return `<tr><td><input type="checkbox" data-i="${i}" ${sec ? 'checked' : ''} aria-label="${esc(x.ad)}"></td><td><b>${esc(x.ad)}</b><small class="muted">${tipBul(x.ad)}</small></td><td>${esc([x.ilce, x.il].filter(Boolean).join(', '))}</td><td class="r num">${x.alan >= 1 ? num(Math.round(x.alan * 10) / 10) + ' km²' : num(Math.round(x.alan * 100)) + ' ha'}</td><td class="${x.esl ? 'muted' : 'pos'}">${esc(durum)}</td></tr>`; }).join('')}</tbody></table>
    <p class="hint">Sınır verisi © OpenStreetMap katkıcıları. Eksik ya da hatalı sınırları sonra haritada “Bölge çiz” ile düzeltebilirsin.</p>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-ekle>Seçilenleri ekle</button></div>`;
  g.querySelector('[data-hepsi]').onclick = () => g.querySelectorAll('[data-i]').forEach(c => c.checked = true);
  g.querySelector('[data-hic]').onclick = () => g.querySelectorAll('[data-i]').forEach(c => c.checked = false);
  g.querySelector('[data-ekle]').onclick = async () => {
    const sec = [...g.querySelectorAll('[data-i]:checked')].map(c => l[+c.dataset.i]);
    if (!sec.length) return toast('Bölge seçilmedi.', 'err');
    const btn = g.querySelector('[data-ekle]'); btn.disabled = true; btn.textContent = 'Ekleniyor…';
    let yeni = 0, sinir = 0, atanan = 0;
    const { bolgeyeAta } = await import('./views/bolgeler.js');
    try {
      for (const x of sec) {
        let b;
        if (x.esl) { if (x.esl.geojson) continue; b = await app.db.save('bolgeler', { ...x.esl, geojson: x.geojson, il: x.esl.il || x.il, ilce: x.esl.ilce || x.ilce }); sinir++; }
        else { b = await app.db.save('bolgeler', { ad: x.ad, tip: tipBul(x.ad), grup: x.il, il: x.il, ilce: x.ilce, geojson: x.geojson, notlar: 'Sınır: OpenStreetMap' }); yeni++; }
        atanan += await bolgeyeAta(b);
      }
      toast(`${yeni} yeni bölge eklendi, ${sinir} bölgenin sınırı tamamlandı${atanan ? `, ${atanan} proje/firma bölgeye atandı` : ''}.`);
      closeDrawer(); sonra && sonra();
    } catch (e) { btn.disabled = false; btn.textContent = 'Seçilenleri ekle'; toast('Eklenemedi: ' + e.message, 'err'); }
  };
}
