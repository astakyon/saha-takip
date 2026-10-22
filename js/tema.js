// Görünüm: açık, koyu ya da cihaza göre. Tercih ayarlarda saklanır (cihazlar arasında eşitlenir), açılışta index.html'deki küçük betik titremeyi önler.
import { ayar, ayarYaz } from './ayar.js';
export const TEMALAR = [['acik', 'Açık'], ['koyu', 'Koyu'], ['oto', 'Cihaza göre']];
export function temaUygula(t = ayar('tema', 'acik')) {
  const v = TEMALAR.some(([k]) => k === t) ? t : 'acik';
  document.documentElement.dataset.tema = v;
  const koyu = v === 'koyu' || (v === 'oto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', koyu ? '#0A1015' : '#1D2B36');
}
export async function temaSec(t) { await ayarYaz('tema', t); temaUygula(t); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => temaUygula()); } catch {}
