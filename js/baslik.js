// Ortak sayfa başlığı: başlıktaki ikincil düğmeler (Excel'e aktar, Toplu düzelt…) "⋯ Diğer" menüsünde toplanır;
// görünür kalanlar ana düğme (Yeni …), görünüm seçicileri ve yıl gibi seçimler. Telefonda başlık tek satıra iner.
const isle = act => {
  if (act.dataset.duzen) return; act.dataset.duzen = '1';
  const ikincil = [...act.children].filter(x => x.matches('.btn:not(.primary), a.btn:not(.primary)') && !x.matches('[data-kalsin]'));
  if (ikincil.length < 2 && !(ikincil.length && innerWidth < 700 && act.querySelector('.btn.primary'))) return;
  const kutu = document.createElement('div'); kutu.className = 'vh-daha';
  kutu.innerHTML = `<button type="button" class="btn ghost vh-daha-btn" aria-haspopup="menu" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg><span>Diğer</span></button><div class="vh-menu" role="menu" hidden></div>`;
  const menu = kutu.querySelector('.vh-menu'), btn = kutu.querySelector('.vh-daha-btn');
  for (const x of ikincil) { x.setAttribute('role', 'menuitem'); menu.appendChild(x); }
  const ana = act.querySelector('.btn.primary');
  ana ? act.insertBefore(kutu, ana) : act.appendChild(kutu);
  const kapat = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = e => { e.stopPropagation(); if (!menu.hidden) return kapat(); document.querySelectorAll('.vh-menu').forEach(m => m.hidden = true); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  menu.addEventListener('click', () => setTimeout(kapat, 0));
  document.addEventListener('click', e => { if (!kutu.contains(e.target)) kapat(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') kapat(); });
};
export function basliklariIzle(view) {
  const tara = () => view.querySelectorAll('.vh .vh-act:not([data-duzen])').forEach(isle);
  new MutationObserver(tara).observe(view, { childList: true, subtree: true });
  tara();
}
