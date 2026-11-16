// Satır içi "İşle": görev listesinde işin altına ne yapıldığını yaz → Enter. Görev tamamlanır, yazılan görevin notuna
// tarihle eklenir ve görev bir projeye ya da firmaya bağlıysa onun yorumlarına (geçmişine) düşer.
import { app } from './state.js';
import { esc, toast, byId, today, tarih } from './ui.js';
import { benBilgisi } from './ben.js';

export const isleKutusu = g => !g || g.durum === 'Tamam' ? '' :
  `<form class="isle" data-isle="${g.id}" novalidate><input name="n" autocomplete="off" enterkeyhint="done" placeholder="Ne yaptın? Yaz, Enter ile tamamla" aria-label="${esc(g.baslik)}: yapılanı yaz ve tamamla"><button type="submit" class="btn sm">İşle</button></form>`;

export async function isle(g, metin) {
  const ben = (app.db?.user?.()?.email || '').toLowerCase() || null;
  metin = String(metin || '').trim();
  const y = { ...g, durum: 'Tamam', tamamlayan: ben, notlar: metin ? [g.notlar, `${tarih(today())}: ${metin}`].filter(Boolean).join('\n') : g.notlar };
  await app.db.save('gorevler', y);
  import('./push.js').then(m => m.gorevBildir?.(g, y)).catch(() => {});
  try { await (await import('./otomasyon.js')).gorevSonrasi(g, y); } catch {}
  // Bağlı kaydın geçmişine: proje öncelikli, yoksa firma
  const [tablo, id] = g.proje_id && byId('projeler', g.proje_id) ? ['projeler', g.proje_id] : g.firma_id && byId('firmalar', g.firma_id) ? ['firmalar', g.firma_id] : [];
  if (tablo && metin) {
    try { await app.db.save('yorumlar', { tablo, kayit_id: id, metin: `✓ ${g.baslik}: ${metin}`, yazan: ben || 'ben', yazan_ad: benBilgisi().ad, etiketler: [], created_at: new Date().toISOString() }); } catch {}
  }
  return y;
}

export function isleBagla(root, sonra) {
  root.querySelectorAll('[data-isle]').forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const g = byId('gorevler', f.dataset.isle); if (!g) return;
    const inp = f.querySelector('[name=n]'), btn = f.querySelector('button'); btn.disabled = true;
    try { await isle(g, inp.value); toast(inp.value.trim() ? 'İşlendi: görev tamamlandı, not geçmişe yazıldı.' : 'Görev tamamlandı.'); sonra?.(); }
    catch (er) { toast('Kaydedilemedi: ' + er.message, 'err'); btn.disabled = false; }
  });
}
