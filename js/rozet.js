// Menüde bekleyen iş sayısı: başlığın ve üstteki sekmenin yanında küçük rozet. Hızlı olmalı (her ekran değişiminde hesaplanır).
import { S } from './db.js';
import { app } from './state.js';
import { today } from './ui.js';
import { sahipMi } from './yetki.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const benimGorev = g => g.durum !== 'Tamam' && (g.atanan ? g.atanan.toLowerCase() === ben() : sahipMi() || !ben());
// Sekme (rota) bazında sayılar
export function rotaRozet(r) {
  const t = today();
  if (r === 'gorevler') return (S.gorevler || []).filter(g => benimGorev(g) && g.son_tarih && g.son_tarih <= t).length;
  if (r === 'talepler') return app.talepAcik || 0;
  if (r === 'tahsilat') return app.rozetGecikmis ?? 0;
  if (r === 'onay') return app.onayBekleyen || 0;
  return 0;
}
// Başlık bazında: içindeki sekmelerin toplamı
export function baslikRozet(b, izinli) { return b.r.filter(izinli).reduce((a, r) => a + rotaRozet(r), 0); }
export const rozetHtml = n => n > 0 ? `<em class="nav-rozet" aria-label="${n} bekleyen">${n > 99 ? '99+' : n}</em>` : '';
