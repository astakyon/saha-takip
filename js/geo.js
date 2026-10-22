// Konum algılama: il (sınır içinde mi), ilçe (en yakın merkez), belde/mahalle (çevrimiçi adres sorgusu)
// ve sanayi bölgesi (kullanıcının çizdiği bölgeler + bilinen OSB merkezleri).
import { S, idbGet, idbSet } from './db.js';
import { gizliMod } from './gizli.js';
import { IL_SINIR } from './data/iller.js';

export const ILLER4 = ['Adana', 'Mersin', 'Hatay', 'Osmaniye'];

// İlçe merkezleri (yaklaşık) [enlem, boylam]
export const ILCE_MERKEZ = {
  Adana: { Seyhan: [36.99, 35.30], Yüreğir: [36.98, 35.37], Çukurova: [37.05, 35.28], Sarıçam: [37.03, 35.42], Ceyhan: [37.029, 35.812], Kozan: [37.455, 35.815], Karataş: [36.57, 35.38], Yumurtalık: [36.768, 35.79], İmamoğlu: [37.27, 35.66], Pozantı: [37.43, 34.87], Karaisalı: [37.256, 35.06], Aladağ: [37.546, 35.40], Feke: [37.815, 35.91], Saimbeyli: [37.99, 36.09], Tufanbeyli: [38.26, 36.22] },
  Mersin: { Akdeniz: [36.80, 34.65], Yenişehir: [36.80, 34.58], Mezitli: [36.75, 34.52], Toroslar: [36.83, 34.60], Tarsus: [36.918, 34.893], Erdemli: [36.605, 34.31], Silifke: [36.377, 33.934], Mut: [36.645, 33.437], Anamur: [36.075, 32.835], Gülnar: [36.34, 33.40], Bozyazı: [36.11, 32.96], Aydıncık: [36.145, 33.32], Çamlıyayla: [37.17, 34.60] },
  Hatay: { Antakya: [36.2025, 36.1606], Defne: [36.19, 36.14], İskenderun: [36.587, 36.173], Arsuz: [36.41, 35.885], Dörtyol: [36.84, 36.23], Erzin: [36.955, 36.20], Payas: [36.755, 36.215], Belen: [36.49, 36.19], Kırıkhan: [36.50, 36.36], Reyhanlı: [36.27, 36.567], Samandağ: [36.08, 35.98], Hassa: [36.80, 36.52], Altınözü: [36.11, 36.24], Yayladağı: [35.90, 36.06], Kumlu: [36.37, 36.46] },
  Osmaniye: { Merkez: [37.0742, 36.2464], Kadirli: [37.37, 36.10], Düziçi: [37.24, 36.45], Bahçe: [37.20, 36.57], Toprakkale: [37.06, 36.15], Sumbas: [37.45, 36.03], Hasanbeyli: [37.13, 36.55] },
};

// Bilinen sanayi bölgeleri (yaklaşık merkez, yarıçap km) — kullanıcı sınır çizene kadar yedek
export const OSB_MERKEZ = [
  ['Adana Hacı Sabancı OSB (AOSB)', 'Adana', 37.025, 35.515, 3.5], ['Ceyhan OSB', 'Adana', 37.05, 35.75, 2.5], ['Yumurtalık Serbest Bölge', 'Adana', 36.80, 35.75, 4],
  ['Adanorm Sanayi Sitesi', 'Adana', 37.01, 35.36, 1.2], ['Tarsus Karma OSB', 'Mersin', 36.96, 34.97, 2.5], ['Mersin-Tarsus OSB', 'Mersin', 36.87, 34.77, 2.5],
  ['Tarsus TUİ OSB', 'Mersin', 36.95, 34.83, 1.5], ['Silifke OSB', 'Mersin', 36.40, 33.97, 1.5], ['Mersin Serbest Bölge', 'Mersin', 36.79, 34.65, 1.2],
  ['Çukurova Havalimanı (ÇHL)', 'Mersin', 36.98, 35.03, 2.5], ['Osmaniye OSB', 'Osmaniye', 37.04, 36.20, 2.5], ['Kadirli OSB', 'Osmaniye', 37.35, 36.08, 1.5],
  ['Erzin OSB', 'Hatay', 36.93, 36.17, 2], ['İskenderun OSB', 'Hatay', 36.70, 36.20, 2.5], ['Antakya OSB', 'Hatay', 36.30, 36.25, 2],
];

// ---------- Geometri ----------
function inRing(lng, lat, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
export function inMulti(lng, lat, multi) {
  return multi.some(poly => inRing(lng, lat, poly[0]) && !poly.slice(1).some(h => inRing(lng, lat, h)));
}
export function km(a, b) { // [lat,lng]
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// GeoJSON geometrisini MultiPolygon koordinatlarına çevir
export function toMulti(g) {
  if (!g) return null;
  if (g.type === 'Feature') g = g.geometry;
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return null;
}

// ---------- İl sınırları (gömülü; çevrimiçiyken ayrıntılısı indirilir) ----------
let detayli = null;
export async function ilSinirlari() {
  if (!detayli) { try { detayli = (await idbGet('il-sinir-detay')) || {}; } catch { detayli = {}; } }
  return Object.fromEntries(ILLER4.map(il => [il, detayli[il] || IL_SINIR[il]]));
}
export async function detayliSinirIndir() {
  if (!navigator.onLine) return;
  await ilSinirlari();
  let changed = false;
  for (const il of ILLER4) {
    if (detayli[il]) continue;
    try {
      const u = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(il)}&countrycodes=tr&featureType=state&format=geojson&polygon_geojson=1&polygon_threshold=0.0008&limit=1`;
      const r = await fetch(u, { headers: { 'Accept-Language': 'tr' } });
      const j = await r.json();
      const m = toMulti(j.features?.[0]);
      if (m && m.length) { detayli[il] = m; changed = true; }
      await new Promise(r => setTimeout(r, 1100)); // Nominatim kullanım kuralı: saniyede 1 istek
    } catch { break; }
  }
  if (changed) { try { await idbSet('il-sinir-detay', detayli); } catch {} }
  return changed;
}

export async function ilBul(lat, lng) {
  const s = await ilSinirlari();
  for (const il of ILLER4) if (inMulti(lng, lat, s[il])) return il;
  return null;
}
export function ilceBul(il, lat, lng) {
  const m = ILCE_MERKEZ[il]; if (!m) return null;
  let best = null, bd = 1e9;
  for (const [n, c] of Object.entries(m)) { const d = km([lat, lng], c); if (d < bd) { bd = d; best = n; } }
  return best;
}
// Kullanıcının çizdiği bölge, yoksa bilinen OSB merkezine yakınlık
export function bolgeBul(lat, lng) {
  for (const b of S.bolgeler || []) { const m = toMulti(b.geojson); if (m && inMulti(lng, lat, m)) return { bolge: b, ad: b.ad }; }
  for (const [ad, , la, ln, r] of OSB_MERKEZ) if (km([lat, lng], [la, ln]) <= r) {
    const b = (S.bolgeler || []).find(x => x.ad === ad);
    return { bolge: b || null, ad };
  }
  return null;
}

// Çevrimiçi adres sorgusu (OpenStreetMap Nominatim). Sonuçlar önbelleğe alınır.
const revCache = new Map();
let lastRev = 0;
export async function adresBul(lat, lng) {
  if (!navigator.onLine || gizliMod()) return null;
  const key = lat.toFixed(4) + ',' + lng.toFixed(4);
  if (revCache.has(key)) return revCache.get(key);
  const wait = 1100 - (Date.now() - lastRev); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRev = Date.now();
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`, { headers: { 'Accept-Language': 'tr' }, signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json(); const a = j.address || {};
    const clean = s => s ? String(s).replace(/ (İli|ili|Province)$/, '') : null;
    const res = {
      il: clean(a.province || a.state),
      ilce: a.town || a.county || a.city_district || a.municipality || null,
      belde: a.suburb || a.quarter || a.village || a.neighbourhood || a.hamlet || null,
      sanayi: a.industrial || (j.category === 'landuse' && j.type === 'industrial' ? j.name : null) || null,
      adres: j.display_name || null,
    };
    revCache.set(key, res); return res;
  } catch { return null; }
}

// Hepsini birleştir: önce cihazda hesaplanan, varsa çevrimiçi ayrıntı
export async function konumAlgila(lat, lng, { online = true } = {}) {
  const il = await ilBul(lat, lng);
  const out = { il, ilce: il ? ilceBul(il, lat, lng) : null, belde: null, osb: null, bolge_id: null, adres: null, kaynak: 'cihaz' };
  const b = bolgeBul(lat, lng);
  if (b) { out.osb = b.ad; out.bolge_id = b.bolge?.id || null; }
  if (online) {
    const a = await adresBul(lat, lng);
    if (a) {
      out.kaynak = 'adres';
      if (a.il && ILLER4.includes(a.il)) out.il = a.il;
      else if (a.il && !out.il) out.il = 'Diğer';
      if (a.ilce && ILCE_MERKEZ[out.il]?.[a.ilce]) out.ilce = a.ilce;
      else if (a.ilce && out.il === 'Diğer') out.ilce = a.ilce;
      out.belde = a.belde;
      if (!out.osb && a.sanayi) out.osb = a.sanayi;
      out.adres = a.adres;
    }
  }
  if (!out.il) out.il = 'Diğer';
  return out;
}
export const konumMetni = k => [k.belde, k.ilce, k.il].filter(Boolean).join(', ') + (k.osb ? ' · ' + k.osb : '');
