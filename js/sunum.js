// Tam ekran sunum modu: fotoğraflı slaytlar (referans projeler, ürün katalogu)
import { app } from './state.js';
import { esc } from './ui.js';

// slaytlar: [{ foto: 'yol', baslik, alt, satirlar: [..] }]
export async function sunumAc(slaytlar, { baslik = 'Sunum' } = {}) {
  if (!slaytlar.length) return;
  let i = 0;
  const el = document.createElement('div');
  el.className = 'sunum'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', baslik);
  el.innerHTML = `<div class="sn-img"><img alt=""></div><div class="sn-cap"><p class="sn-n"></p><h2></h2><p class="sn-alt"></p><ul></ul></div>
    <button type="button" class="sn-x" aria-label="Sunumu kapat">×</button><button type="button" class="sn-prev" aria-label="Önceki">‹</button><button type="button" class="sn-next" aria-label="Sonraki">›</button>`;
  document.body.appendChild(el);
  const img = el.querySelector('img');
  const goster = async () => {
    const s = slaytlar[i];
    el.querySelector('.sn-n').textContent = `${i + 1} / ${slaytlar.length}`;
    el.querySelector('h2').textContent = s.baslik || '';
    el.querySelector('.sn-alt').textContent = s.alt || '';
    el.querySelector('ul').innerHTML = (s.satirlar || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('');
    el.classList.toggle('no-img', !s.foto);
    img.removeAttribute('src');
    if (s.foto) { const u = /^(https?:|data:|blob:)/.test(s.foto) ? s.foto : await app.db.url(s.foto); if (slaytlar[i] === s && u) img.src = u; }
  };
  const git = d => { i = (i + d + slaytlar.length) % slaytlar.length; goster(); };
  const kapat = () => { document.removeEventListener('keydown', key); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); el.remove(); };
  const key = e => { if (e.key === 'Escape') kapat(); if (e.key === 'ArrowRight' || e.key === ' ') git(1); if (e.key === 'ArrowLeft') git(-1); };
  document.addEventListener('keydown', key);
  el.querySelector('.sn-x').onclick = kapat;
  el.querySelector('.sn-prev').onclick = () => git(-1);
  el.querySelector('.sn-next').onclick = () => git(1);
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 == null) return; const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 50) git(d < 0 ? 1 : -1); x0 = null; });
  try { await el.requestFullscreen?.(); } catch {}
  el.querySelector('.sn-next').focus();
  goster();
}
