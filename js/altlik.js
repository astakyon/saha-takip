// Harita altlıkları: OpenStreetMap, Esri uydu, Google uydu / harita (Google en güncel görüntü; API anahtarı gerekir)
import { googleKey, loadGoogle } from './google.js';
import { toast } from './ui.js';

const MUTANT = 'https://cdn.jsdelivr.net/npm/leaflet.gridlayer.googlemutant@0.14.1/dist/Leaflet.GoogleMutant.js';
let mutantYuk = null;
const betik = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Google katmanı yüklenemedi.')); document.head.appendChild(s); });

export const ALTLIKLAR = [
  { k: 'google-uydu', ad: 'Google uydu (güncel)', google: true },
  { k: 'google-harita', ad: 'Google harita', google: true },
  { k: 'esri', ad: 'Esri uydu' },
  { k: 'osm', ad: 'Sokak haritası' },
];
export const varsayilanAltlik = f => f.altlik || (googleKey() ? 'google-uydu' : (f.uydu === false ? 'osm' : 'esri'));
export const uyduMu = k => k === 'esri' || k === 'google-uydu';

function esri() {
  return L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 19, attribution: 'Uydu: Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.85 }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  ]);
}
const osm = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });

// İstenen altlığı döndürür; Google yüklenemezse Esri'ye düşer
export async function altlikKatmani(k) {
  if (k === 'osm') return { k, katman: osm() };
  if (k === 'esri' || !String(k).startsWith('google')) return { k: 'esri', katman: esri() };
  try {
    if (!googleKey()) throw new Error('Google uydu görüntüsü için Ayarlar → Google ve harita bölümünden API anahtarı gir.');
    await loadGoogle();
    if (!L.gridLayer?.googleMutant) await (mutantYuk ||= betik(MUTANT));
    if (!L.gridLayer?.googleMutant) throw new Error('Google katmanı yüklenemedi.');
    return { k, katman: L.gridLayer.googleMutant({ type: k === 'google-uydu' ? 'hybrid' : 'roadmap', maxZoom: 21 }) };
  } catch (e) { mutantYuk = null; toast(e.message + ' Esri uydu gösteriliyor.', 'err'); return { k: 'esri', katman: esri() }; }
}
