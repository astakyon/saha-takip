// Ekran düzeni: otomatik, telefon ya da geniş (bilgisayar). Tercih yalnız bu cihazda saklanır (eşitlenmez).
// Otomatik: telefonda tarayıcının "Masaüstü sitesi / Masaüstü sürümü" ayarı açık kaldıysa sayfa ~1000 px genişlikte açılır
// ve bilgisayar düzeni küçük yazılarla görünür; bu durum algılanıp telefon düzenine geçilir.
// Yöntem: önce sayfa genişliği istenir (viewport); tarayıcı uymazsa sayfa yakınlaştırılır ve genişliğe bağlı
// CSS kuralları istenen genişliğe göre yeniden değerlendirilir.
const K = 'saha-gorunum', META = 'width=device-width, initial-scale=1, viewport-fit=cover';
export const GORUNUMLER = [['oto', 'Otomatik'], ['telefon', 'Telefon'], ['genis', 'Bilgisayar']];
export const tercih = () => { try { const t = localStorage.getItem(K); return GORUNUMLER.some(([k]) => k === t) ? t : 'oto'; } catch { return 'oto'; } };
let durum = { W: 0, yol: '', z: 1 }, orjMM = null, sira = 0;
export const durumu = () => ({ ...durum });

const dokunmatik = () => { try { return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; } catch { return false; } };
const cihazEni = () => Math.round(screen.width || 0);
// Masaüstü sitesi açık telefon: dokunmatik, ekran dar, ama sayfa genişliği ekrandan belirgin büyük
export function masaustuModu() { const e = cihazEni(); return dokunmatik() && e > 0 && e < 900 && innerWidth > e * 1.25; }
function hedef(t = tercih()) {
  const e = cihazEni();
  if (t === 'telefon') return e && e < 900 ? e : 412;
  if (t === 'genis') return innerWidth >= 900 ? 0 : 1180;
  return masaustuModu() ? e : 0;
}

// Genişliğe bağlı medya kuralları: (max-width: N) / (min-width: N) — istenen genişliğe göre açılır / kapanır
const BASIT = /^\s*\(\s*(max|min)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)\s*$/i;
const uyar = (q, W) => { const m = BASIT.exec(q); return m ? (m[1].toLowerCase() === 'max' ? W <= +m[2] : W >= +m[2]) : null; };
function kurallar(kok, f) { let l; try { l = kok.cssRules; } catch { return; } for (const r of l || []) { if (r.media && r.cssRules) { f(r); kurallar(r, f); } else { if (r.style) f(r); if (r.cssRules?.length) kurallar(r, f); } } }
function medyaYaz(W) {
  for (const s of document.styleSheets) kurallar(s, r => {
    if (r.media && r.cssRules) {
      if (r.__orj == null) r.__orj = r.media.mediaText;
      const u = W ? uyar(r.__orj, W) : null;
      try { r.media.mediaText = u == null ? r.__orj : (u ? 'all' : 'not all'); } catch {}
    } else if (r.style && W) {
      // vh / vw yakınlaştırmayla büyür: ekran yüksekliğine / istenen genişliğe göre düzelt
      if (r.__vh == null) { r.__vh = []; for (const p of r.style) { const v = r.style.getPropertyValue(p); if (/\d(?:d|s|l)?v[hw]\b/.test(v)) r.__vh.push([p, v, r.style.getPropertyPriority(p)]); } }
      for (const [p, v, o] of r.__vh) r.style.setProperty(p, v.replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g, 'calc($1 * var(--gvh, 1vh))').replace(/(-?\d*\.?\d+)(?:d|s|l)?vw\b/g, 'calc($1 * var(--gvw, 1vw))'), o);
    } else if (r.style && r.__vh?.length && !W) for (const [p, v, o] of r.__vh) r.style.setProperty(p, v, o);
  });
}
function mmYama(W) {
  if (!orjMM) orjMM = window.matchMedia.bind(window);
  if (!W) { window.matchMedia = orjMM; return; }
  window.matchMedia = q => { const u = uyar(q, W); if (u == null) return orjMM(q); const n = () => {}; return { matches: u, media: q, onchange: null, addEventListener: n, removeEventListener: n, addListener: n, removeListener: n, dispatchEvent: () => false }; };
}
const meta = () => document.querySelector('meta[name=viewport]');
const kare = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

export async function uygula(t = tercih()) {
  const benim = ++sira, kok = document.documentElement;
  // Önce eski düzeltmeyi kaldır, gerçek genişliği ölç
  if (durum.yol) { kok.style.zoom = ''; kok.classList.remove('gorunum-zum'); medyaYaz(0); mmYama(0); meta()?.setAttribute('content', META); durum = { W: 0, yol: '', z: 1 }; window.__gW = 0; await kare(); if (benim !== sira) return durum; }
  const W = hedef(t); kok.dataset.gorunum = t;
  if (!W || Math.abs(innerWidth - W) < 24) return durum;
  // 1) Tarayıcıdan sayfa genişliği iste
  meta()?.setAttribute('content', `width=${W}, viewport-fit=cover`); await kare(); if (benim !== sira) return durum;
  if (Math.abs(innerWidth - W) < 40) { durum = { W, yol: 'meta', z: 1 }; window.__gW = 0; return durum; }
  // 2) Tarayıcı uymadı (masaüstü sitesi viewport'u yok sayar): yakınlaştır ve kuralları istenen genişliğe göre değerlendir
  meta()?.setAttribute('content', META);
  const z = innerWidth / W;
  kok.style.setProperty('--gvh', (innerHeight / 100 / z).toFixed(3) + 'px'); kok.style.setProperty('--gvw', (W / 100).toFixed(3) + 'px');
  kok.style.zoom = z.toFixed(4); kok.classList.add('gorunum-zum');
  medyaYaz(W); mmYama(W); window.__gW = W;
  durum = { W, yol: 'zum', z };
  return durum;
}
export async function sec(t) { try { localStorage.setItem(K, t); } catch {} return uygula(t); }
// Ekran genişliği (uygulamanın gördüğü): düzeltme varsa istenen genişlik
export const genislik = () => window.__gW || innerWidth;

// Açılışta ve döndürmede uygula; stil dosyası sonradan yüklenirse kurallar yeniden değerlendirilir
// (sayfa genişliğini kendimiz değiştirdiğimizde de resize gelir; yalnız ekran döndüğünde yeniden hesaplanır)
let bekle = null, sonEkran = screen.width;
addEventListener('resize', () => { clearTimeout(bekle); bekle = setTimeout(() => { if (screen.width !== sonEkran) { sonEkran = screen.width; uygula(); } else if (durum.yol === 'zum') { const k = document.documentElement; k.style.setProperty('--gvh', (innerHeight / 100 / durum.z).toFixed(3) + 'px'); } }, 300); });
uygula();
document.querySelectorAll('link[rel=stylesheet]').forEach(l => { if (!l.sheet) l.addEventListener('load', () => { if (durum.yol === 'zum') medyaYaz(durum.W); }, { once: true }); });
