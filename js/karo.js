// Çevrimdışı harita: gezdiğin harita karoları zaten önbelleğe alınır (sw.js, "tiles").
// Sık gidilen bir OSB'nin karolarını önceden indirmek için: sınır kutusu, yakınlaştırma 13–16, en fazla ~300 karo.
// Google katmanı kullanım koşulları gereği indirilmez; sokak haritası ya da Esri uydu indirilir.
import { toast } from './ui.js';
import { toMulti } from './geo.js';

const UST = 300;
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
const URLLER = {
  osm: (z, x, y) => [`https://${'abc'[Math.abs(x + y) % 3]}.tile.openstreetmap.org/${z}/${x}/${y}.png`],
  esri: (z, x, y) => ['World_Imagery', 'Reference/World_Transportation', 'Reference/World_Boundaries_and_Places'].map(k => `https://server.arcgisonline.com/ArcGIS/rest/services/${k}/MapServer/tile/${z}/${y}/${x}`),
};
export function karolar(bbox, altlik) {
  const [w, s, e, n] = bbox, f = URLLER[altlik] || URLLER.osm, out = [];
  for (let z = 13; z <= 16; z++) {
    const x0 = lon2x(w, z), x1 = lon2x(e, z), y0 = lat2y(n, z), y1 = lat2y(s, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(...f(z, x, y));
    if (out.length > UST * (altlik === 'esri' ? 3 : 1)) return { urller: out, fazla: true, z };
  }
  return { urller: out, fazla: false, z: 16 };
}
export function bolgeKutusu(b, pay = 0.004) {
  const m = toMulti(b.geojson); if (!m) return null;
  let w = 180, s = 90, e = -180, n = -90;
  for (const poly of m) for (const ring of poly) for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [w - pay, s - pay, e + pay, n + pay];
}
export async function karoIndir(bbox, altlik, ilerleme) {
  if (!('caches' in window)) throw new Error('Bu tarayıcı çevrimdışı önbelleği desteklemiyor.');
  let { urller, fazla } = karolar(bbox, altlik);
  if (fazla) { // alan büyük: en yüksek yakınlaştırmayı bırak
    const kis = []; for (const u of urller) if (!/\/16\//.test(u)) kis.push(u); urller = kis.slice(0, UST * (altlik === 'esri' ? 3 : 1));
  }
  const c = await caches.open('tiles'); let i = 0, ok = 0;
  const sira = [...urller];
  const isci = async () => { while (sira.length) { const u = sira.shift(); try { if (!(await c.match(u))) { const r = await fetch(u, { mode: 'cors' }).catch(() => fetch(u, { mode: 'no-cors' })); if (r.ok || r.type === 'opaque') { await c.put(u, r); ok++; } } else ok++; } catch {} i++; ilerleme?.(i, urller.length); } };
  await Promise.all([isci(), isci(), isci()]);   // aynı anda en fazla 3 istek
  return { toplam: urller.length, ok, kirpildi: fazla };
}
export async function karoSay() { try { return (await (await caches.open('tiles')).keys()).length; } catch { return null; } }
export async function karoTemizle() { try { await caches.delete('tiles'); toast('Kayıtlı harita karoları silindi.'); } catch {} }
