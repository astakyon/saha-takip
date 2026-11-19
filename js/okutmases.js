// Okutma sesi: sesli okuma ("Fontana, 6 adet eklendi"), yalnız uyarı sesi (bip) ya da sessiz (yalnız titreşim).
// Seçim cihazda saklanır; her okutma ekranında tek dokunuşla değişir. Ses telefonun kendi seslendirmesiyle çalışır, internet gerekmez.
import { esc } from './ui.js';

const K = 'saha-okutma-ses';
export const MODLAR = { konus: { ad: 'Sesli', ikon: '🔊', ac: 'Ürünü ve adedi sesli söyler' }, bip: { ad: 'Bip', ikon: '🔔', ac: 'Yalnız uyarı sesi' }, sessiz: { ad: 'Sessiz', ikon: '📳', ac: 'Ses yok, yalnız titreşim' } };
export const sesModu = () => { try { const v = localStorage.getItem(K); return MODLAR[v] ? v : 'bip'; } catch { return 'bip'; } };
export const sesModuYaz = m => { try { localStorage.setItem(K, m); } catch {} try { speechSynthesis?.cancel(); } catch {} };

let ctx = null;
function bip(tur) {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const notalar = tur === 'ok' ? [[880, 0, 0.09]] : tur === 'uyari' ? [[660, 0, 0.12], [660, 0.16, 0.12]] : [[220, 0, 0.18], [180, 0.22, 0.25]];
    for (const [f, t, d] of notalar) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tur === 'ok' ? 'sine' : 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.02);
    }
  } catch {}
}
let ses = null;
const turkceSes = () => { try { return ses ||= speechSynthesis.getVoices().find(v => /^tr/i.test(v.lang)) || null; } catch { return null; } };
try { speechSynthesis?.addEventListener?.('voiceschanged', () => { ses = null; turkceSes(); }); } catch {}
function konus(metin) {
  try {
    if (!('speechSynthesis' in window) || !metin) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(metin).replace(/×/g, ' çarpı ').slice(0, 160));
    u.lang = 'tr-TR'; const v = turkceSes(); if (v) u.voice = v; u.rate = 1.1;
    speechSynthesis.speak(u); return true;
  } catch { return false; }
}
// tur: 'ok' | 'uyari' | 'hata'; metin: sesli modda söylenecek kısa cümle
export function bildir(tur = 'ok', metin = '') {
  const m = sesModu();
  try { navigator.vibrate?.(tur === 'ok' ? 60 : tur === 'uyari' ? [60, 80, 60] : [120, 80, 120, 80, 120]); } catch {}
  if (m === 'sessiz') return;
  if (m === 'bip' || tur !== 'ok') bip(tur);
  if (m === 'konus') { if (tur === 'ok') konus(metin); else setTimeout(() => konus(metin), 450); }
  window.__geribildirim?.push?.({ tur, metin, mod: m });   // testler için
}
// Sesli okumada kısa ürün adı: açıklamanın ilk iki anlamlı sözcüğü ya da kod
export function kisaAd(s, kod = '') {
  const a = String(s?.aciklama || '').replace(/^(PLSETJ|PL|LED)\s+/i, '').split(/\s+/).filter(x => x.length > 1 && !/^\d+$/.test(x) && !/^IP\d/i.test(x)).slice(0, 2).join(' ');
  return a || kod || s?.kod || '';
}
// Okutma ekranlarına konan seçici; değişince hemen geçerli olur
export function sesSecici() {
  const m = sesModu();
  return `<div class="seg ses-sec" role="group" aria-label="Okutma sesi">${Object.entries(MODLAR).map(([k, v]) => `<button type="button" data-sesmod="${k}" class="${k === m ? 'on' : ''}" title="${esc(v.ac)}" aria-pressed="${k === m}">${v.ikon} ${esc(v.ad)}</button>`).join('')}</div>`;
}
export function sesSeciciBagla(kok) {
  kok.querySelectorAll('[data-sesmod]').forEach(b => b.onclick = () => { sesModuYaz(b.dataset.sesmod); kok.querySelectorAll('[data-sesmod]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); if (b.dataset.sesmod !== 'sessiz') bildir('ok', 'Ses açık'); else bildir('ok'); });
}
// Onaydan sonra ekranda kalan özet kartı (kapatılana kadar durur)
export function ozetGoster({ baslik, satirlar = [], konus: soyle = '' }) {
  let k = document.getElementById('okutma-ozet');
  if (!k) { k = document.createElement('div'); k.id = 'okutma-ozet'; k.setAttribute('role', 'status'); document.body.appendChild(k); }
  k.innerHTML = `<div class="oz-ic"><b>${esc(baslik)}</b>${satirlar.length ? `<ul>${satirlar.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}<button type="button" class="x" aria-label="Kapat">×</button></div>`;
  k.hidden = false; k.querySelector('.x').onclick = () => { k.hidden = true; };
  clearTimeout(k._t); k._t = setTimeout(() => { k.hidden = true; }, 12000);
  bildir('ok', soyle || baslik);
}
