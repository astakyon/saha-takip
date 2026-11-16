// Plan ve gerçekleşen: tarihi geçmiş ama "Planlandı" kalan ziyaretler Bugün'de sorulur: yapıldı mı, yapılmadıysa neden?
// Neden (mazeret) seçilince ziyaret "Yapılmadı" olur; "Ertele" tarihi ileri alır ve "ertelendi" diye not düşer.
import { S } from './db.js';
import { app } from './state.js';
import { esc, tarih, today, gunEkle, firmaAd, toast, MAZERETLER } from './ui.js';
import { sahipMi } from './yetki.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
export const yapilmayanlar = () => S.ziyaretler.filter(z => z.durum === 'Planlandı' && z.tarih && z.tarih < today() && (!z.sorumlu || z.sorumlu.toLowerCase() === ben() || (sahipMi() && !z.sorumlu)))
  .sort((a, b) => b.tarih.localeCompare(a.tarih));
export function mazeretKarti() {
  const l = yapilmayanlar(); if (!l.length) return '';
  return `<section class="card mazeret-k" data-gerek="yaz:ziyaretler"><h2>Yapılmayan planlı ziyaretler <span class="muted">${l.length}</span></h2>
    <p class="hint">Plandaydı ama kaydı yok. Yapıldıysa kaydet; yapılmadıysa nedenini seç ya da ileri bir güne ertele.</p>
    <ul class="list mz-l">${l.slice(0, 8).map(z => `<li data-mz="${z.id}"><span class="grow"><b>${esc(firmaAd(z.firma_id) || 'Ziyaret')}</b><span class="muted">${tarih(z.tarih)}${z.amac ? ' · ' + esc(z.amac) : ''}</span></span>
      <span class="mz-is"><button type="button" class="btn sm" data-mzyap>Yapıldı</button><select data-mzneden aria-label="Neden yapılmadı"><option value="">Yapılmadı, çünkü…</option>${MAZERETLER.map(m => `<option>${esc(m)}</option>`).join('')}</select><button type="button" class="btn sm ghost" data-mzertele>Yarına ertele</button></span></li>`).join('')}</ul>
    ${l.length > 8 ? `<p class="hint">+${l.length - 8} ziyaret daha; Ziyaretler'de "Planlandı" süzgeciyle görürsün.</p>` : ''}</section>`;
}
export function mazeretBagla(el, sonra) {
  el.querySelectorAll('[data-mz]').forEach(li => {
    const z = () => S.ziyaretler.find(x => x.id === li.dataset.mz);
    li.querySelector('[data-mzyap]').onclick = async () => (await import('./views/ziyaret.js')).ziyaretForm({ id: li.dataset.mz, durum: 'Yapıldı' });
    li.querySelector('[data-mzneden]').onchange = async e => { const m = e.target.value; if (!m) return; try { await app.db.save('ziyaretler', { ...z(), durum: 'Yapılmadı', mazeret: m }); toast('Kaydedildi: yapılmadı · ' + m); sonra?.(); } catch (er) { toast(er.message, 'err'); } };
    li.querySelector('[data-mzertele]').onclick = async () => { const x = z(); try { await app.db.save('ziyaretler', { ...x, tarih: gunEkle(today(), 1), mazeret: 'Ertelendi (' + tarih(x.tarih) + ')' }); toast('Yarına ertelendi.'); sonra?.(); } catch (er) { toast(er.message, 'err'); } };
  });
}
// Plana uyum: bir tarih aralığında planlı / plansız / mazeretli ziyaretler
export function planUyumu(bas, son, kim = null) {
  const ic = z => z.tarih && z.tarih >= bas && z.tarih <= son && z.tarih < today() && (!kim || (z.sorumlu || ben() || 'ben').toLowerCase() === kim);
  const l = S.ziyaretler.filter(ic);
  const yapildi = l.filter(z => (z.durum || 'Yapıldı') === 'Yapıldı');
  const planliYapilan = yapildi.filter(z => z.planli), plansiz = yapildi.filter(z => !z.planli);
  const yapilmadi = l.filter(z => z.durum === 'Yapılmadı'), bekleyen = l.filter(z => z.durum === 'Planlandı');
  const planToplam = planliYapilan.length + yapilmadi.length + bekleyen.length;
  const nedenler = {}; for (const z of yapilmadi) { const k = (z.mazeret || 'Belirtilmedi').replace(/ \(.*$/, ''); nedenler[k] = (nedenler[k] || 0) + 1; }
  return { planliYapilan: planliYapilan.length, plansiz: plansiz.length, yapilmadi: yapilmadi.length, bekleyen: bekleyen.length, planToplam, uyum: planToplam ? Math.round(planliYapilan.length / planToplam * 100) : null, nedenler: Object.entries(nedenler).sort((a, b) => b[1] - a[1]) };
}
