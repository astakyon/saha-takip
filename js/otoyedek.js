// Otomatik yedek: veri sahibi açtıysa, uygulama açıldığında son yedek 7 günden eskiyse bütün kayıtlar
// Supabase depolamasına (yalnızca sahibin görebildiği yedek klasörüne) JSON olarak yazılır; son 8 yedek tutulur.
import { S, TABLES } from './db.js';
import { app } from './state.js';
import { esc, toast, today, download } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { sahipMi } from './yetki.js';

const KLASOR = () => `${app.db.user().id}/yedek`;
const guvenliMi = async () => { try { const { data, error } = await app.db.c.rpc('yedek_guvenli'); return !error && data === true; } catch { return false; } };
const gun = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;

export async function yedekAl() {
  const veri = { version: 2, tarih: new Date().toISOString(), uygulama: 'Saha Takip', ...Object.fromEntries(Object.keys(TABLES).map(t => [t, S[t]])) };
  const ad = `saha-yedek-${today()}.json`, yol = `${KLASOR()}/${ad}`;
  const { error } = await app.db.c.storage.from('fotograflar').upload(yol, new Blob([JSON.stringify(veri)], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
  if (error) throw error;
  await ayarYaz('oto_yedek_son', new Date().toISOString());
  const l = await yedekler();
  const fazla = l.slice(8).map(x => `${KLASOR()}/${x.name}`);
  if (fazla.length) await app.db.c.storage.from('fotograflar').remove(fazla).catch(() => {});
  return ad;
}
export async function yedekler() {
  const { data, error } = await app.db.c.storage.from('fotograflar').list(KLASOR(), { limit: 50, sortBy: { column: 'name', order: 'desc' } });
  if (error) throw error;
  return (data || []).filter(x => x.name.endsWith('.json'));
}
// Açılışta (sessiz)
export async function otoYedekKontrol() {
  if (app.db?.mode !== 'supabase' || !sahipMi() || !navigator.onLine || ayar('oto_yedek') !== true) return;
  const g = gun(ayar('oto_yedek_son')); if (g != null && g < 7) return;
  if (!(await guvenliMi())) return;
  try { await yedekAl(); toast('Haftalık otomatik yedek alındı.'); } catch (e) { console.warn('Otomatik yedek', e); }
}
export async function otoYedekAyarlari(kutu) {
  if (!kutu) return;
  if (app.db?.mode !== 'supabase') { kutu.innerHTML = '<p class="hint">Otomatik yedek bulut bağlantısıyla çalışır. Deneme modunda “Tam yedek indir (ZIP)” kullan.</p>'; return; }
  const guvenli = await guvenliMi();
  const acik = ayar('oto_yedek') === true, son = ayar('oto_yedek_son');
  kutu.innerHTML = `<label class="chk"><input type="checkbox" data-oto ${acik ? 'checked' : ''} ${guvenli ? '' : 'disabled'}> <span>Haftada bir kendiliğinden yedek al</span></label>
    <p class="hint">${guvenli ? `Uygulamayı açtığında son yedek 7 günden eskiyse bütün kayıtlar Supabase'deki, yalnızca senin görebildiğin yedek klasörüne yazılır; son 8 yedek tutulur. Fotoğraflar zaten Supabase'de durduğu için yedeğe girmez.` : 'Açmak için önce Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 13): yedek klasörünü ekip üyelerine kapatır.'}</p>
    <p>${son ? `Son otomatik yedek: <b>${new Date(son).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</b>` : 'Henüz otomatik yedek alınmadı.'}</p>
    <div class="btnrow"><button type="button" class="btn sm" data-simdi ${guvenli ? '' : 'disabled'}>Şimdi yedekle</button></div><div data-liste></div>`;
  kutu.querySelector('[data-oto]').onchange = async e => { await ayarYaz('oto_yedek', e.target.checked); toast(e.target.checked ? 'Otomatik yedek açıldı.' : 'Otomatik yedek kapatıldı.'); if (e.target.checked) otoYedekKontrol().then(() => otoYedekAyarlari(kutu)); };
  kutu.querySelector('[data-simdi]').onclick = async e => { e.target.disabled = true; try { const ad = await yedekAl(); toast(ad + ' kaydedildi.'); otoYedekAyarlari(kutu); } catch (err) { e.target.disabled = false; toast('Yedek alınamadı: ' + err.message, 'err'); } };
  if (!guvenli) return;
  try {
    const l = await yedekler();
    kutu.querySelector('[data-liste]').innerHTML = l.length ? `<h3>Buluttaki yedekler</h3><ul class="list">${l.map(x => `<li><span class="grow">${esc(x.name)}<small class="muted"> · ${x.metadata?.size ? Math.round(x.metadata.size / 1024) + ' KB' : ''}</small></span><button type="button" class="btn sm ghost" data-indir="${esc(x.name)}">İndir</button></li>`).join('')}</ul><p class="hint">İndirdiğin dosyayı geri yüklemek için Veri ve yedek → “JSON yedekten geri yükle” kullanılır.</p>` : '';
    kutu.querySelectorAll('[data-indir]').forEach(b => b.onclick = async () => { const { data, error } = await app.db.c.storage.from('fotograflar').download(`${KLASOR()}/${b.dataset.indir}`); if (error) return toast('İndirilemedi: ' + error.message, 'err'); download(b.dataset.indir, data); });
  } catch {}
}
