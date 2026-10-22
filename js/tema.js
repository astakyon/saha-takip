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
// Yazı boyutu: normal, büyük (%12), çok büyük (%25) — harita dışındaki ekranlar ölçeklenir
export function yaziUygula(y = ayar('yazi', 'normal')) { document.documentElement.dataset.yazi = ['buyuk', 'cokbuyuk'].includes(y) ? y : 'normal'; }
export async function yaziSec(y) { await ayarYaz('yazi', y); yaziUygula(y); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => temaUygula()); } catch {}
