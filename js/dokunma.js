// Telefonda dokunma kısayolları: liste satırını sola kaydırınca hızlı işlemler; sayfanın en üstünde aşağı çekince yenileme
import { S } from './db.js';
import { app } from './state.js';
import { esc, byId, directionsUrl, toast } from './ui.js';

const SATIR = 'a.row[href^="#/firma/"], a.pcard[href^="#/kisi/"]';
let bas = null, kayan = null, tikEngel = false;

function islemSayfasi(el) {
  const [, tur, id] = el.getAttribute('href').match(/#\/(firma|kisi)\/(.+)$/) || [];
  const k = tur === 'kisi' ? byId('kisiler', id) : null, f = tur === 'firma' ? byId('firmalar', id) : byId('firmalar', k?.firma_id);
  if (!k && !f) return;
  const tel = k?.telefon || f?.telefon || S.kisiler.find(x => x.firma_id === f?.id && x.telefon)?.telefon;
  const yer = f?.lat != null ? [f.lat, f.lng] : null;
  document.querySelector('.islem-sayfa')?.remove();
  const d = document.createElement('div'); d.className = 'islem-sayfa';
  d.innerHTML = `<div class="is-perde" data-kapat></div><div class="is-kutu" role="dialog" aria-label="Hızlı işlemler"><p class="is-bas"><b>${esc(k?.ad_soyad || f.ad)}</b>${k && f ? `<small>${esc(f.ad)}</small>` : ''}</p>
    ${tel ? `<a class="is-btn" href="tel:${esc(tel)}">Ara <small>${esc(tel)}</small></a><button type="button" class="is-btn" data-wa>WhatsApp</button>` : ''}
    <button type="button" class="is-btn" data-ziy>Ziyaret ekle</button>
    ${yer ? `<a class="is-btn" target="_blank" rel="noopener" href="${directionsUrl(yer[0], yer[1])}">Yol tarifi</a>` : ''}
    <a class="is-btn" href="${el.getAttribute('href')}">Aç</a>
    <button type="button" class="is-btn is-vaz" data-kapat>Vazgeç</button></div>`;
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('acik'));
  const kapat = () => { d.classList.remove('acik'); setTimeout(() => d.remove(), 200); };
  d.querySelectorAll('[data-kapat], a.is-btn').forEach(x => x.addEventListener('click', kapat));
  d.querySelector('[data-wa]')?.addEventListener('click', async () => { kapat(); (await import('./sablon.js')).waGonder({ kisi: k || S.kisiler.find(x => x.firma_id === f?.id && x.telefon) || null, firma: f }); });
  d.querySelector('[data-ziy]').onclick = async () => { kapat(); (await import('./views/ziyaret.js')).ziyaretForm({ firma_id: f?.id || null, kisi_id: k?.id || null }); };
}

export function dokunmaKur() {
  // Sola kaydırma
  document.addEventListener('touchstart', e => {
    const el = e.target.closest(SATIR); if (!el || e.touches.length > 1) { bas = null; return; }
    bas = { x: e.touches[0].clientX, y: e.touches[0].clientY, el, yatay: null }; tikEngel = false;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!bas) return;
    const dx = e.touches[0].clientX - bas.x, dy = e.touches[0].clientY - bas.y;
    if (bas.yatay === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) bas.yatay = Math.abs(dx) > Math.abs(dy) * 1.5;
    if (!bas.yatay) return;
    kayan = bas.el; kayan.style.transition = 'none'; kayan.style.transform = `translateX(${Math.max(-90, Math.min(0, dx))}px)`;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!bas) return;
    const dx = (e.changedTouches[0]?.clientX ?? bas.x) - bas.x, el = bas.el, yatay = bas.yatay; bas = null;
    if (kayan) { kayan.style.transition = 'transform .2s'; kayan.style.transform = ''; kayan = null; }
    if (yatay && dx < -60) { tikEngel = true; islemSayfasi(el); }
  }, { passive: true });
  document.addEventListener('click', e => { if (tikEngel && e.target.closest(SATIR)) { e.preventDefault(); e.stopPropagation(); tikEngel = false; } }, true);

  // Aşağı çekerek yenile (yalnızca sayfanın en üstünde, açık pencere yokken, harita dışında)
  let cek = null; const gosterge = document.createElement('div'); gosterge.className = 'cek-yenile'; gosterge.textContent = 'Yenilemek için bırak'; document.body.appendChild(gosterge);
  document.addEventListener('touchstart', e => {
    if (window.scrollY > 0 || document.querySelector('.drawer.open, .islem-sayfa') || document.getElementById('view')?.classList.contains('view-harita') || e.target.closest('input, textarea, select, .leaflet-container')) { cek = null; return; }
    cek = { y: e.touches[0].clientY, d: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!cek) return; cek.d = e.touches[0].clientY - cek.y;
    if (cek.d > 12 && window.scrollY <= 0) { gosterge.classList.add('gor'); gosterge.style.transform = `translate(-50%, ${Math.min(cek.d, 110) - 40}px)`; gosterge.classList.toggle('hazir', cek.d > 90); }
  }, { passive: true });
  document.addEventListener('touchend', async () => {
    if (!cek) return; const d = cek.d; cek = null;
    gosterge.classList.remove('gor', 'hazir'); gosterge.style.transform = '';
    if (d > 90 && window.scrollY <= 0) { toast('Yenileniyor…'); try { await app.yenile?.(); } catch {} }
  }, { passive: true });
}
