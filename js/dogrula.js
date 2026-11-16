// "Bilgiler doğru" onayı: Excel'den / toplu içe aktarmayla gelen firma ve projelerde "doğrulanmadı" rozeti;
// kayıt sayfasında "Bilgiler doğru, onaylıyorum" ile kim ve ne zaman doğruladığı yazılır. Veri kontrolü doğrulanmamışları listeler.
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, today, tarih } from './ui.js';

export const dogrulanmamis = t => (S[t] || []).filter(x => x.kaynak && !x.dogrulandi && !x.aday);
export function dogrulamaRozet(t, x) {
  if (!x) return '';
  if (x.dogrulandi) { const [kim, gun] = String(x.dogrulandi).split('|'); return `<span class="dg-ok" title="Bilgileri doğrulayan: ${esc(kim || '')}">✓ Bilgiler doğrulandı${gun ? ' · ' + esc(tarih(gun)) : ''}</span>`; }
  if (!x.kaynak) return '';
  return `<span class="dg-bek">${esc(x.kaynak)} · doğrulanmadı <button type="button" class="linkbtn" data-dogrula="${t}:${x.id}" data-gerek="yaz:${t}">Bilgiler doğru, onaylıyorum</button></span>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest?.('[data-dogrula]'); if (!b) return;
  const [t, id] = b.dataset.dogrula.split(':'), x = (S[t] || []).find(r => r.id === id); if (!x) return;
  try { await app.db.save(t, { ...x, dogrulandi: `${(app.db?.user?.()?.email || 'ben').toLowerCase()}|${today()}` }); toast('Bilgiler doğrulandı olarak işaretlendi.'); app.refresh?.(); }
  catch (err) { toast(err.message, 'err'); }
});
