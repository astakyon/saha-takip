// Kendi sayfasında açılan kartlar (firma, kişi) için ortak parçalar: simgeler, "⋯" menüsü, sekmeler
import { app } from './state.js';

const ik = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const IK = {
  tel: ik('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  wa: ik('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20Z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5"/>'),
  yol: ik('<path d="M12 2 20 20l-8-4-8 4 8-18Z"/>'),
  arti: ik('<path d="M12 5v14M5 12h14"/>'),
  pin: ik('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  kisi: ik('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  gor: ik('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>'),
  tek: ik('<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  num: ik('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5L12 12 4 7.5"/>'),
  srv: ik('<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 0-5-5l2.6 2.6-2.1 2.1L9.6 5.8a4 4 0 0 0 5.1.5Z"/>'),
  ara: ik('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  mail: ik('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  rehber: ik('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 16c.8-1.6 2-2.4 3.5-2.4s2.7.8 3.5 2.4"/>'),
  web: ik('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  sil: ik('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};
// Başlıktaki açılır menüler: masaüstünde düğmenin altında, telefonda alttan açılan panel
export function acilirKur(el) {
  const kutular = [...el.querySelectorAll('[data-acilir]')];
  let perde = null;
  const kapat = () => { kutular.forEach(k => { const m = k._menu; m.hidden = true; if (m.parentElement !== k) k.appendChild(m); k.querySelector('[aria-haspopup]').setAttribute('aria-expanded', 'false'); }); perde?.remove(); perde = null; };
  for (const k of kutular) {
    const menu = k.querySelector('.fs-menu'), btn = k.querySelector('[aria-haspopup]'); k._menu = menu;
    // Yetkiyle boşalan menü gizlenir; art arda ya da uçta kalan ayraçlar kaldırılır
    menu.querySelectorAll('hr').forEach(h => { const o = h.previousElementSibling, s = h.nextElementSibling; if (!o || !s || o.matches('hr, .fs-menu-bas') || s.matches('hr')) h.remove(); });
    if (!menu.querySelector('[role=menuitem]')) { k.remove(); continue; }
    btn.onclick = e => {
      e.stopPropagation(); const acikti = !menu.hidden; kapat(); if (acikti) return;
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if (matchMedia('(max-width: 760px)').matches) { perde = document.createElement('div'); perde.className = 'fs-perde'; perde.onclick = kapat; document.body.append(perde, menu); }   // alt menünün ve artı düğmesinin üstünde kalsın
      menu.querySelector('[role=menuitem]')?.focus({ preventScroll: true });
    };
    menu.addEventListener('click', () => setTimeout(kapat, 0));
  }
  const disari = e => { if (!el.isConnected) return document.removeEventListener('click', disari); if (!e.target.closest('[data-acilir]')) kapat(); };
  document.addEventListener('click', disari);
  el.addEventListener('keydown', e => { if (e.key === 'Escape') kapat(); });
  window.addEventListener('hashchange', kapat, { once: true });
}
// Yetkiyle boşalan simge kutularını kaldır
export function araciTemizle(el) { el.querySelectorAll('.fs-grp').forEach(g => { if (!g.querySelector('a, button')) g.remove(); }); }

// Sekmeler: [data-fsk] düğmeleri, [data-fs] panelleri. Seçili sekme adres çubuğuna yazılır (#/<taban>/<sekme>);
// her sekmenin içeriği (KUR) ilk açılışta kurulur, şema ve listeler görünürken ölçülsün.
export function sekmeKur(el, { taban, sekme, KUR = {}, ilk = 'ozet' }) {
  const kuruldu = new Set();
  const ac = (k, { kaydir = false } = {}) => {
    if (!k || !el.querySelector(`[data-fsk="${k}"]`)) k = el.querySelector(`[data-fsk="${ilk}"]`) ? ilk : el.querySelector('[data-fsk]')?.dataset.fsk;   // yetkisi olmayan sekme
    el.querySelectorAll('[data-fsk]').forEach(b => { const on = b.dataset.fsk === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) { const s = b.parentElement; if (b.offsetLeft < s.scrollLeft || b.offsetLeft + b.offsetWidth > s.scrollLeft + s.clientWidth) s.scrollLeft = b.offsetLeft - 16; } });
    el.querySelectorAll('[data-fs]').forEach(p => p.hidden = p.dataset.fs !== k);
    const yol = taban + (k === ilk ? '' : '/' + k);
    if (location.hash !== '#/' + yol) history.replaceState(history.state, '', '#/' + yol);
    app.sayfaYolu?.(yol);
    if (!kuruldu.has(k)) { kuruldu.add(k); try { KUR[k]?.(); } catch (e) { console.error(e); } }
    if (kaydir) { const s = el.querySelector('.fs-sekme'); if (s && s.getBoundingClientRect().top < 0) s.scrollIntoView({ block: 'start' }); }
  };
  app.sayfaSekme = k => ac(k || ilk);
  el.querySelectorAll('[data-fsk]').forEach(b => b.onclick = () => ac(b.dataset.fsk, { kaydir: true }));
  el.querySelectorAll('[data-git]').forEach(b => b.onclick = () => ac(b.dataset.git, { kaydir: true }));
  el.querySelector('[data-devam]')?.addEventListener('click', e => { el.querySelectorAll('[data-fazla]').forEach(li => li.hidden = false); e.currentTarget.remove(); });
  ac(sekme || location.hash.split('/')[3]);
}
