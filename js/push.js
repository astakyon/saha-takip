// Anlık bildirim (Web Push): bu cihazı abone eder, görev atama/tamamlamada “bildir” Edge Function'ını çağırır.
import { app } from './state.js';
import { esc, toast } from './ui.js';
import { sahipMi } from './yetki.js';

const b64uCoz = s => { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const pushDestek = () => 'PushManager' in window && 'serviceWorker' in navigator && 'Notification' in window;
const bulut = () => app.db?.mode === 'supabase';
const kayit = () => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 3000))]);

export async function sunucuAnahtari() {
  const { data, error } = await app.db.c.functions.invoke('bildir', { method: 'GET' });
  if (error || !data?.anahtar) throw new Error(data?.hata || 'Bildirim sunucusu kurulmamış.');
  return data.anahtar;
}
export async function mevcutAbonelik() { const r = await kayit(); return r ? r.pushManager.getSubscription() : null; }
export async function aboneOl() {
  if (!pushDestek()) throw new Error('Bu tarayıcı anlık bildirimi desteklemiyor.');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Bildirim izni verilmedi. Telefon ayarlarından Saha Takip için bildirimlere izin ver.');
  const r = await kayit(); if (!r) throw new Error('Uygulama servisi hazır değil; sayfayı yenileyip tekrar dene.');
  const anahtar = await sunucuAnahtari();
  let sub = await r.pushManager.getSubscription();
  if (sub && b64u(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== anahtar) { try { await sub.unsubscribe(); } catch {} sub = null; }
  sub ||= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uCoz(anahtar) });
  const j = sub.toJSON();
  const { error } = await app.db.c.from('push_abonelikleri').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, cihaz: navigator.userAgent.slice(0, 160) }, { onConflict: 'endpoint' });
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'Abonelik tablosu yok: güncel schema.sql dosyasını çalıştır.' : error.message);
}
export async function abonelikKapat() {
  const sub = await mevcutAbonelik(); if (!sub) return;
  try { await app.db.c.from('push_abonelikleri').delete().eq('endpoint', sub.endpoint); } catch {}
  await sub.unsubscribe();
}
export async function gonder(olay, gorev_id) {
  if (!bulut()) return null;
  try { const { data } = await app.db.c.functions.invoke('bildir', { body: { olay, gorev_id } }); return data; } catch { return null; }
}
// Görev kaydedildikten sonra: sahip birine atadıysa ona, ekip üyesi tamamladıysa sahibe
export function gorevBildir(eski, yeni) {
  if (!bulut() || !yeni?.atanan) return;
  if (sahipMi() && yeni.atanan !== (eski?.atanan || null) && yeni.durum !== 'Tamam') gonder('atandi', yeni.id);
  else if (!sahipMi() && yeni.durum === 'Tamam' && eski?.durum !== 'Tamam') gonder('tamamlandi', yeni.id);
}
// VAPID anahtar çifti: tarayıcıda üretilir, hiçbir yere gönderilmez; sahibi Supabase Secrets'a yapıştırır
export async function anahtarUret() {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
  return { genel: b64u(await crypto.subtle.exportKey('raw', k.publicKey)), gizli: jwk.d };
}

// Ayarlar → Genel → Bildirimler kartının “Anlık bildirim” bölümü
export async function pushAyarlari(root) {
  if (!root) return;
  if (!bulut()) { root.innerHTML = '<h3>Anlık bildirim</h3><p class="hint">Görev atandığında ya da tamamlandığında telefona bildirim için bulut (Supabase) bağlantısı gerekir.</p>'; return; }
  if (!pushDestek()) { root.innerHTML = '<h3>Anlık bildirim</h3><p class="hint">Bu tarayıcı anlık bildirimi desteklemiyor. iPhone\'da önce uygulamayı ana ekrana ekle (iOS 16.4 ve sonrası).</p>'; return; }
  root.innerHTML = '<h3>Anlık bildirim</h3><p class="hint">Kontrol ediliyor…</p>';
  let kurulu = true; try { await sunucuAnahtari(); } catch { kurulu = false; }
  const sub = await mevcutAbonelik(), izin = Notification.permission;
  const yuklu = matchMedia('(display-mode: standalone)').matches;
  root.innerHTML = `<h3>Anlık bildirim</h3>
    <p>${sahipMi() ? 'Ekip üyesi kendisine atanan görevi tamamlayınca bu cihaza bildirim gelir; birine görev atadığında da o kişinin telefonuna gider.' : 'Sana görev atandığında bu cihaza bildirim gelir.'}</p>
    ${!kurulu ? (sahipMi() ? kurulumHtml() : '<p class="warn">Bildirim sunucusu henüz kurulmamış. Veri sahibinin kurulumu tamamlaması gerekiyor.</p>')
      : `${izin === 'denied' ? '<p class="warn">Bildirim izni reddedilmiş. Telefon ayarları → Uygulamalar → Saha Takip (ya da Chrome) → Bildirimler bölümünden izin ver.</p>' : ''}
      <p><b>${sub && izin === 'granted' ? 'Bu cihazda açık.' : 'Bu cihazda kapalı.'}</b></p>
      <div class="btnrow">${sub && izin === 'granted' ? '<button type="button" class="btn" data-pdeneme>Deneme bildirimi gönder</button><button type="button" class="btn ghost" data-pkapat>Bu cihazda kapat</button>' : '<button type="button" class="btn primary" data-pac>Bu cihazda aç</button>'}</div>
      ${!yuklu ? '<p class="hint">En güvenilir çalışma için uygulamayı telefona yükle (Telefona yükle). iPhone\'da yalnızca ana ekrana eklenmiş uygulamada çalışır.</p>' : ''}`}`;
  const yenile = () => pushAyarlari(root);
  root.querySelector('[data-pac]')?.addEventListener('click', async e => { e.target.disabled = true; try { await aboneOl(); toast('Bu cihazda anlık bildirim açıldı.'); } catch (err) { toast(err.message, 'err'); } yenile(); });
  root.querySelector('[data-pkapat]')?.addEventListener('click', async () => { await abonelikKapat(); toast('Bu cihazda kapatıldı.'); yenile(); });
  root.querySelector('[data-pdeneme]')?.addEventListener('click', async () => { const d = await gonder('deneme'); toast(d?.gonderilen ? `Deneme gönderildi (${d.gonderilen} cihaz).` : 'Gönderilemedi: ' + (d?.hata || 'abone cihaz bulunamadı'), d?.gonderilen ? '' : 'err'); });
  root.querySelector('[data-anahtar]')?.addEventListener('click', async () => {
    const k = await anahtarUret(); const kutu = root.querySelector('[data-anahtarlar]');
    kutu.innerHTML = [['VAPID_PUBLIC_KEY', k.genel], ['VAPID_PRIVATE_KEY', k.gizli], ['VAPID_SUBJECT', 'mailto:' + (app.db.user?.()?.email || 'adresin@ornek.com')]].map(([ad, v]) => `<div class="anahtar"><label>${ad}</label><div><input readonly value="${esc(v)}" aria-label="${ad}"><button type="button" class="btn sm" data-kopya="${esc(v)}">Kopyala</button></div></div>`).join('') + '<p class="hint">Gizli anahtarı (PRIVATE) yalnızca Supabase Secrets\'a yapıştır; kimseyle paylaşma. Bu ekran kapanınca anahtarlar kaybolur; gerekirse yenisini üretirsin.</p>';
    kutu.querySelectorAll('[data-kopya]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.kopya); toast('Kopyalandı.'); } catch { b.previousElementSibling.select(); } });
  });
  root.querySelector('[data-pkontrol]')?.addEventListener('click', yenile);
}
function kurulumHtml() {
  return `<div class="kurulum"><p class="warn">Bildirim sunucusu henüz kurulmamış. Bir kez yapılır, yaklaşık 10 dakika sürer:</p>
    <ol>
      <li>Önce güncel <b>schema.sql</b> dosyasını Supabase SQL Editor'de çalıştır.</li>
      <li><button type="button" class="btn sm" data-anahtar>Anahtar üret</button> ile üç değeri al.<div data-anahtarlar></div></li>
      <li>Supabase paneli → <b>Edge Functions</b> → <b>Secrets</b> → üç değeri aynı adlarla ekle.</li>
      <li>Edge Functions → <b>Deploy a new function</b> → <b>Via Editor</b> → adı <b>bildir</b> → GitHub'daki <code>supabase/functions/bildir/index.ts</code> içeriğini yapıştır → <b>Deploy</b>.</li>
      <li><button type="button" class="btn sm ghost" data-pkontrol>Kurulumu kontrol et</button></li>
    </ol></div>`;
}
