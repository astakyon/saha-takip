// Ürün kodu okuma: kamerayla barkod / QR (tarayıcı destekliyorsa canlı), olmazsa etiketin fotoğrafından yazı okuma.
// Bulunan kod stok listesinde ve katalogda aranır: açıklama, bayi stoğu, fiyat, ürün sayfası.
import { S } from './db.js';
import { esc, toast, openDrawer, closeDrawer, num, fold, pickFiles, urunBilgi } from './ui.js';
import { AILELER as EAE_AILE } from './data/eae-katalog.js';
import { eaeKatalog } from './profil.js';
// Katalog: EAE kullanan için gömülü EAE aileleri, diğerleri için kendi girdiği ürün aileleri
const AILELER_AL = () => eaeKatalog() ? EAE_AILE : (S.urun_aileleri || []).map(a => ({ aile: a.aile, ad: a.ad || a.aile, kategori: '', aciklama: a.aciklama || '', yol: null }));

const BICIMLER = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'qr_code', 'data_matrix', 'itf'];
const detektor = async () => {
  if (!('BarcodeDetector' in window)) return null;
  try { const des = await window.BarcodeDetector.getSupportedFormats(); const f = BICIMLER.filter(x => des.includes(x)); return f.length ? new window.BarcodeDetector({ formats: f }) : null; } catch { return null; }
};
const norm = s => fold(s).replace(/[^a-z0-9]/g, '');

// Metinden (barkod içeriği ya da etiket yazısı) eşleşen ürünleri bul
export function urunAra(metin) {
  const m = String(metin || ''); if (!m.trim()) return { urunler: [], aileler: [] };
  const urunler = new Map();
  // 1) Bayi stok kodu (genelde 7 hane) ya da tam açıklama
  for (const tok of m.match(/\b\d{6,8}\b/g) || []) for (const u of S.urunler) if (String(u.kod) === tok) urunler.set(u.id, u);
  const nm = norm(m);
  for (const u of S.urunler) { const a = norm(u.aciklama); if (a.length >= 8 && nm.includes(a)) urunler.set(u.id, u); }
  // 2) Açıklamanın ilk iki-üç parçası (ör. "ALB 050D 40LN00")
  if (!urunler.size) {
    const satirlar = m.toUpperCase().split(/\n|\|/).map(x => x.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (const st of satirlar) {
      const t = st.split(' ');
      for (let i = 0; i < t.length - 1; i++) {
        const on = norm(t.slice(i, i + 3).join(' ')); if (on.length < 6) continue;
        for (const u of S.urunler) if (norm(u.aciklama).startsWith(on)) urunler.set(u.id, u);
      }
    }
  }
  // 3) EAE ürün sayfası bağlantısı (QR) ya da aile adı
  const aileler = new Set();
  const AILELER = AILELER_AL();
  const url = /eaeaydinlatma\.com\/urun\/([\w-]+)/i.exec(m); if (url) { const a = AILELER.find(x => x.yol === url[1]); if (a) aileler.add(a); }
  const kelimeler = new Set(m.toUpperCase().split(/[^A-Z0-9-]+/).filter(Boolean));
  for (const a of AILELER) if (kelimeler.has(a.aile.toUpperCase())) aileler.add(a);
  for (const u of urunler.values()) { const k = String(u.aciklama || '').split(/\s+/)[0]?.toUpperCase(); const a = AILELER.find(x => x.aile.toUpperCase() === k || (u.aile && x.aile.toUpperCase() === u.aile.toUpperCase())); if (a) aileler.add(a); }
  return { urunler: [...urunler.values()].slice(0, 20), aileler: [...aileler].slice(0, 6) };
}

const sonucHtml = (metin, r) => {
  if (!r.urunler.length && !r.aileler.length) return `<p class="warn">Okunan: <code>${esc(String(metin).slice(0, 120))}</code><br>Stok listesinde ya da katalogda eşleşen ürün bulunamadı. Kodu aşağıya elle yazmayı dene.</p>`;
  return `${r.urunler.length ? `<h3>Stokta eşleşen ürünler <span class="muted">${r.urunler.length}</span></h3><ul class="list kod-sonuc">${r.urunler.map(u => { const b = urunBilgi(u.aciklama); return `<li><span class="grow"><b>${esc(u.aciklama)}</b><small class="muted">Kod ${esc(u.kod || '—')}${u.depo ? ' · ' + esc(u.depo) : ''}${b.w ? ` · ${b.w} W` : ''}${b.lm ? ` · ${num(b.lm)} lm` : ''}${b.k ? ` · ${b.k} K` : ''}</small></span>
      <span class="r"><b class="${+u.stok > 0 ? 'pos' : 'neg'}">${num(+u.stok || 0)} ${esc(u.birim || 'adet')}</b>${u.birim_fiyat_usd != null ? `<small>${num(u.birim_fiyat_usd)} $</small>` : ''}</span></li>`; }).join('')}</ul>` : ''}
    ${r.aileler.length ? `<h3>Ürün ailesi</h3><ul class="list">${r.aileler.map(a => `<li><span class="grow"><b>${esc(a.ad)}</b><small class="muted">${esc(a.kategori || '')}${a.aciklama ? ' · ' + esc(a.aciklama.slice(0, 120)) : ''}</small></span>${a.yol ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.eaeaydinlatma.com/urun/${esc(a.yol)}">Ürün sayfası</a>` : ''}</li>`).join('')}</ul>` : ''}`;
};

export async function kodOku() {
  const det = await detektor();
  let akis = null, dur = false;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Stok ve katalog</p><h2 id="drawer-title">Ürün kodu oku</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      ${det ? `<div class="kod-kamera" data-kam hidden><video playsinline muted></video><span class="kod-cerceve" aria-hidden="true"></span></div>
        <div class="btnrow"><button type="button" class="btn primary" data-canli>Kamerayla barkod / QR tara</button><button type="button" class="btn" data-foto>Etiketin fotoğrafını çek</button></div>`
      : `<div class="btnrow"><button type="button" class="btn primary" data-foto>Etiketin fotoğrafını çek</button></div><p class="hint">Bu tarayıcı canlı barkod taramayı desteklemiyor (ör. iPhone Safari). Etiketin fotoğrafındaki ürün kodu ve açıklama yazıdan okunur.</p>`}
      <div class="liste-ekle"><input data-elle placeholder="Kodu ya da açıklamayı yaz (ör. 3306364, ALB 050D)" aria-label="Ürün kodu"><button type="button" class="btn sm" data-ara>Ara</button></div>
      <div data-durum aria-live="polite"></div><div data-sonuc></div></div>`, { onClose: () => kapat() });
  const durum = p.querySelector('[data-durum]'), sonuc = p.querySelector('[data-sonuc]');
  const goster = metin => { const r = urunAra(metin); sonuc.innerHTML = sonucHtml(metin, r); durum.innerHTML = ''; return r; };
  function kapat() { dur = true; akis?.getTracks().forEach(t => t.stop()); akis = null; }
  const ara = () => { const v = p.querySelector('[data-elle]').value.trim(); if (v) goster(v); };
  p.querySelector('[data-ara]').onclick = ara;
  p.querySelector('[data-elle]').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ara(); } };
  p.querySelector('[data-canli]')?.addEventListener('click', async () => {
    const kam = p.querySelector('[data-kam]'), v = kam.querySelector('video');
    try { akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }); }
    catch { return toast('Kameraya erişilemedi. Tarayıcı ayarlarından kamera iznini ver.', 'err'); }
    kam.hidden = false; v.srcObject = akis; await v.play().catch(() => {}); dur = false; durum.innerHTML = '<p class="hint">Barkodu ya da QR kodu çerçevenin içine getir…</p>';
    const dongu = async () => {
      if (dur || !akis) return;
      try { const b = await det.detect(v); if (b.length) { const deger = b.map(x => x.rawValue).join('\n'); if (navigator.vibrate) navigator.vibrate(60); kapat(); kam.hidden = true; goster(deger); return; } } catch {}
      setTimeout(dongu, 250);
    };
    dongu();
  });
  p.querySelector('[data-foto]').onclick = async () => {
    const [file] = await pickFiles({ capture: true, multiple: false }); if (!file) return;
    kapat(); p.querySelector('[data-kam]')?.setAttribute('hidden', '');
    // Önce fotoğraftaki barkod, yoksa yazı
    if (det) { try { const b = await det.detect(await createImageBitmap(file)); if (b.length) return goster(b.map(x => x.rawValue).join('\n')); } catch {} }
    durum.innerHTML = '<p class="hint">Etiketteki yazı okunuyor… (ilk seferde okuma motoru indirilir)</p>';
    try { const { metinOku } = await import('./ocr.js'); const m = await metinOku(file); goster(m); }
    catch (e) { durum.innerHTML = ''; toast('Okunamadı: ' + e.message, 'err'); }
  };
}
