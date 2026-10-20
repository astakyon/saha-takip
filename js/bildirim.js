// Günlük hatırlatma bildirimi: telefona yüklü uygulamada, Chrome'un "periyodik arka plan eşitleme" özelliğiyle
// günde bir kez (saatini Chrome belirler, genelde sabah ilk uygun anda) o günün ziyaretlerini ve görevlerini bildirir.
import { idbSet, idbGet } from './db.js';
import { toast, esc } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

export const bildirimDestek = () => 'Notification' in window && 'serviceWorker' in navigator;
async function kayit() { return navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 2000))]) : null; }
async function periyodikDestek() { const r = await kayit(); return !!(r && 'periodicSync' in r); }

export async function bildirimAc(saat = '08:00') {
  if (!bildirimDestek()) throw new Error('Bu tarayıcı bildirim desteklemiyor.');
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') throw new Error('Bildirim izni verilmedi. Telefon ayarlarından Saha Takip için bildirimlere izin ver.');
  const r = await kayit();
  let periyodik = false;
  if (r && 'periodicSync' in r) {
    try {
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') { await r.periodicSync.register('gunluk-ozet', { minInterval: 12 * 60 * 60 * 1000 }); periyodik = true; }
    } catch (e) { console.warn('periodicSync', e); }
  }
  await idbSet('bildirim-ayar', { acik: true, saat });
  await ayarYaz('bildirim', { acik: true, saat });
  return { periyodik };
}
export async function bildirimKapat() {
  const r = await kayit(); try { await r?.periodicSync?.unregister('gunluk-ozet'); } catch {}
  await idbSet('bildirim-ayar', { acik: false }); await ayarYaz('bildirim', { acik: false });
}
// Uygulama açılışında: bildirim açıksa ayarı servis çalışanıyla eşitle, kaydı tazele
export async function bildirimHazirla() {
  const b = ayar('bildirim'); if (!b?.acik || !bildirimDestek() || Notification.permission !== 'granted') return;
  await idbSet('bildirim-ayar', b);
  const r = await kayit();
  try {
    if (r && 'periodicSync' in r) { const tags = await r.periodicSync.getTags(); if (!tags.includes('gunluk-ozet')) await r.periodicSync.register('gunluk-ozet', { minInterval: 12 * 60 * 60 * 1000 }); }
    else r?.active?.postMessage({ tip: 'ozet-goster' });
  } catch { r?.active?.postMessage({ tip: 'ozet-goster' }); }
}
export async function denemeBildirimi() {
  const r = await kayit(); if (!r) throw new Error('Servis çalışanı hazır değil.');
  r.active?.postMessage({ tip: 'ozet-goster', zorla: true });
}

export function bildirimAyarlari(root) {
  const ciz = async () => {
    const b = ayar('bildirim') || {}, izin = bildirimDestek() ? Notification.permission : 'yok', per = await periyodikDestek();
    const yuklu = matchMedia('(display-mode: standalone)').matches;
    root.innerHTML = !bildirimDestek() ? '<p class="hint">Bu tarayıcı bildirim desteklemiyor.</p>' : `
      <p>${b.acik && izin === 'granted' ? '<b>Günlük hatırlatma açık.</b> Sabah o günün ziyaretleri, görevleri, doğum günleri ve vadesi geçen tahsilatlar bildirilir.' : 'Sabah o günün ziyaretlerini, görevlerini, doğum günlerini ve vadesi geçen tahsilatları bildirim olarak al.'}</p>
      ${izin === 'denied' ? '<p class="warn">Bildirim izni reddedilmiş. Telefon ayarları → Uygulamalar → Saha Takip (veya Chrome) → Bildirimler bölümünden izin ver.</p>' : ''}
      <div class="frow"><label>Saat <input type="time" data-saat value="${esc(b.saat || '08:00')}"></label></div>
      <div class="btnrow">${b.acik && izin === 'granted' ? '<button type="button" class="btn" data-deneme>Şimdi dene</button><button type="button" class="btn ghost" data-kapat>Kapat</button>' : '<button type="button" class="btn primary" data-ac>Bildirimleri aç</button>'}</div>
      <p class="hint">${!yuklu ? 'Bildirimlerin kendiliğinden gelmesi için uygulamanın telefona <b>yüklü</b> olması gerekir. ' : ''}${per ? 'Bildirim zamanını Chrome belirler: seçtiğin saatten sonraki ilk uygun anda, günde bir kez gelir. Telefon uzun süre kullanılmazsa gecikebilir.' : 'Bu cihaz arka planda zamanlanmış bildirimi desteklemiyor; hatırlatma uygulamayı açtığında gösterilir.'}</p>`;
    root.querySelector('[data-ac]')?.addEventListener('click', async () => { try { const { periyodik } = await bildirimAc(root.querySelector('[data-saat]').value); toast(periyodik ? 'Günlük hatırlatma açıldı.' : 'Bildirim izni verildi; hatırlatma uygulamayı açtığında gösterilecek.'); ciz(); } catch (e) { toast(e.message, 'err'); ciz(); } });
    root.querySelector('[data-kapat]')?.addEventListener('click', async () => { await bildirimKapat(); toast('Günlük hatırlatma kapatıldı.'); ciz(); });
    root.querySelector('[data-deneme]')?.addEventListener('click', async () => { try { await denemeBildirimi(); } catch (e) { toast(e.message, 'err'); } });
    root.querySelector('[data-saat]').onchange = async e => { if ((ayar('bildirim') || {}).acik) { await ayarYaz('bildirim', { acik: true, saat: e.target.value }); await idbSet('bildirim-ayar', { acik: true, saat: e.target.value }); toast('Saat kaydedildi.'); } };
  };
  ciz();
}
