// Uygulamanın sağlığı: hata günlüğü (Supabase'e otomatik yazılır, veri sahibi görür) ve kullanım ölçümü (yalnızca bu cihazda).
import { app, SURUM } from './state.js';
import { esc, toast, confirmBox } from './ui.js';
import { sahipMi, rotaIzinli } from './yetki.js';

// ---------- Hata günlüğü ----------
const KUYRUK = 'saha-hata-kuyruk';
const oturumda = new Map();    // aynı hata bir oturumda bir kez gönderilir, tekrarlar sayılır
let gonderilen = 0, zamanlayici = null;
const lsAl = (k, v) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? v; } catch { return v; } };
const lsYaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const tarayici = () => { const u = navigator.userAgent; const os = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Diğer'; const t = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : '?'; return `${os} · ${t}${matchMedia('(display-mode: standalone)').matches ? ' · yüklü' : ''}`; };

export function hataKaydet(mesaj, yer = '') {
  const m = String(mesaj || '').slice(0, 500); if (!m) return;
  const anahtar = m + '|' + yer;
  if (oturumda.has(anahtar)) { oturumda.get(anahtar).adet++; return; }
  if (gonderilen >= 25) return;   // bir oturumda en fazla 25 farklı hata
  gonderilen++;
  const k = { zaman: new Date().toISOString(), surum: SURUM, ekran: (location.hash.split('/')[1] || 'bugun').slice(0, 30), mesaj: m, yer: String(yer).slice(0, 200), tarayici: tarayici(), adet: 1 };
  oturumda.set(anahtar, k);
  const q = lsAl(KUYRUK, []); q.push(k); lsYaz(KUYRUK, q.slice(-50));
  clearTimeout(zamanlayici); zamanlayici = setTimeout(hataGonder, 4000);
}
export async function hataGonder() {
  if (!app.db || app.db.mode !== 'supabase' || !navigator.onLine || !app.db.user?.() || app.db.onizleme) return;
  const q = lsAl(KUYRUK, []); if (!q.length) return;
  lsYaz(KUYRUK, []);
  try { const { error } = await app.db.c.from('hata_gunlugu').insert(q); if (error && !/does not exist|schema cache|Could not find/i.test(error.message)) throw error; }
  catch { const k = lsAl(KUYRUK, []); lsYaz(KUYRUK, [...q, ...k].slice(-50)); }
}
window.addEventListener('online', () => setTimeout(hataGonder, 3000));

export async function hataGunluguKarti(kok) {
  if (!kok) return;
  if (app.db.mode !== 'supabase') { const q = lsAl(KUYRUK, []); kok.innerHTML = `<p class="hint">Deneme modunda hatalar yalnızca bu cihazda tutulur (${q.length}).</p>`; return; }
  if (!sahipMi()) { kok.innerHTML = '<p class="hint">Uygulamada bir hata olursa, düzeltilebilmesi için kısa bir kayıt veri sahibine otomatik iletilir (hata metni, ekran, sürüm, telefon türü). Kayıtlarının içeriği gönderilmez.</p>'; return; }
  kok.innerHTML = '<p class="hint">Yükleniyor…</p>';
  const { data, error } = await app.db.c.from('hata_gunlugu').select('*').order('zaman', { ascending: false }).limit(300);
  if (error) { kok.innerHTML = '<p class="warn">Hata günlüğü için Supabase\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 17).</p>'; return; }
  const gruplar = new Map();
  for (const h of data || []) { const k = h.mesaj + '|' + (h.yer || ''); const g = gruplar.get(k) || { ...h, toplam: 0, kisiler: new Set(), surumler: new Set(), ilk: h.zaman }; g.toplam += h.adet || 1; g.kisiler.add(h.kim || '?'); g.surumler.add(h.surum); if (h.zaman < g.ilk) g.ilk = h.zaman; gruplar.set(k, g); }
  const l = [...gruplar.values()];
  const zaman = t => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  kok.innerHTML = `<p class="hint">Telefonlarda (senin ve ekibinin) oluşan hatalar burada toplanır. Kayıt içeriği gönderilmez; yalnızca hata metni, ekran, sürüm ve telefon türü.</p>
    ${l.length ? `<ul class="list hata-l">${l.slice(0, 40).map(g => `<li><span class="grow"><b>${esc(g.mesaj.slice(0, 160))}</b><small class="muted">${g.toplam} kez · ${esc([...g.kisiler].join(', '))} · ekran: ${esc(g.ekran)} · sürüm ${esc([...g.surumler].join(', '))} · son ${zaman(g.zaman)}${g.yer ? ' · ' + esc(g.yer) : ''} · ${esc(g.tarayici || '')}</small></span></li>`).join('')}</ul>
      <div class="btnrow"><button type="button" class="btn sm" data-hkopya>Kopyala (bildirmek için)</button><button type="button" class="btn sm ghost danger" data-htemizle>Günlüğü temizle</button></div>`
    : '<p>Kayıtlı hata yok. 👍</p>'}`;
  kok.querySelector('[data-hkopya]')?.addEventListener('click', async () => { const t = l.map(g => `${g.toplam}× ${g.mesaj} ${g.yer || ''} [ekran ${g.ekran}, sürüm ${[...g.surumler].join('/')}, ${g.tarayici || ''}]`).join('\n'); try { await navigator.clipboard.writeText(t); toast('Kopyalandı.'); } catch { toast('Kopyalanamadı.', 'err'); } });
  kok.querySelector('[data-htemizle]')?.addEventListener('click', async () => { if (!confirmBox('Hata günlüğü temizlensin mi?')) return; const { error: e } = await app.db.c.from('hata_gunlugu').delete().gte('id', 0); toast(e ? 'Temizlenemedi: ' + e.message : 'Temizlendi.', e ? 'err' : ''); hataGunluguKarti(kok); });
}

// ---------- Kullanım ölçümü (yalnızca bu cihazda; hiçbir yere gönderilmez) ----------
const KUL = 'saha-kullanim';
export function kullanimSay(rota) {
  const k = lsAl(KUL, null) || { bas: new Date().toISOString().slice(0, 10), r: {} };
  const g = new Date().toISOString().slice(0, 10), r = k.r[rota] || { n: 0, son: g, gunler: [] };
  r.n++; r.son = g; if (!r.gunler.includes(g)) r.gunler = [...r.gunler, g].slice(-90);
  k.r[rota] = r; lsYaz(KUL, k);
}
export const kullanimVerisi = () => lsAl(KUL, null);
export function kullanimKarti(kok, { rotalar, gizli, ad, gizle }) {
  if (!kok) return;
  const k = kullanimVerisi();
  if (!k) { kok.innerHTML = '<p class="hint">Henüz ölçüm yok.</p>'; return; }
  const gun = Math.max(1, Math.round((Date.now() - new Date(k.bas)) / 864e5));
  const otuz = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const satir = Object.keys(rotalar).filter(r => r !== 'ayarlar' && rotaIzinli(r)).map(r => { const x = k.r[r] || { n: 0, gunler: [] }; return { r, n: x.n, gun30: x.gunler.filter(d => d >= otuz).length, son: x.son }; }).sort((a, b) => b.gun30 - a.gun30 || b.n - a.n);
  const enCok = Math.max(1, ...satir.map(s => s.gun30));
  const oneri = gun >= 21 ? satir.filter(s => !s.n && !gizli.has(s.r) && !['bugun'].includes(s.r)) : [];
  kok.innerHTML = `<p class="hint">Hangi ekranı ne sıklıkla açtığın yalnızca bu cihazda sayılır; hiçbir yere gönderilmez. Ölçüm ${gun} gündür sürüyor.</p>
    ${oneri.length ? `<div class="kul-oneri"><b>Hiç açmadığın ${oneri.length} ekran var.</b> Menüyü sadeleştirmek için kaldırabilirsin (Ayarlar → Menü'den geri açılır).<div class="chips">${oneri.map(s => `<button type="button" class="chip" data-kgizle="${s.r}">${esc(ad(s.r))} ✕</button>`).join('')}</div><button type="button" class="btn sm" data-khepsi>Hepsini menüden kaldır</button></div>` : gun < 21 ? `<p class="hint">Kullanmadığın ekranlar için öneri ${21 - gun} gün sonra çıkar.</p>` : ''}
    <ul class="list kul-l">${satir.filter(s => s.n).slice(0, 15).map(s => `<li><span class="grow">${esc(ad(s.r))}<small class="muted"> · son 30 günde ${s.gun30} gün · toplam ${s.n} kez</small></span><span class="kul-bar" style="--w:${Math.round(s.gun30 / enCok * 100)}%"></span></li>`).join('')}</ul>
    <button type="button" class="btn sm ghost" data-ksifirla>Ölçümü sıfırla</button>`;
  kok.querySelectorAll('[data-kgizle]').forEach(b => b.onclick = async () => { await gizle([b.dataset.kgizle]); toast(ad(b.dataset.kgizle) + ' menüden kaldırıldı.'); });
  kok.querySelector('[data-khepsi]')?.addEventListener('click', async () => { await gizle(oneri.map(s => s.r)); toast(oneri.length + ' ekran menüden kaldırıldı.'); });
  kok.querySelector('[data-ksifirla]').onclick = () => { if (!confirmBox('Kullanım ölçümü sıfırlansın mı?')) return; try { localStorage.removeItem(KUL); } catch {} kullanimKarti(kok, { rotalar, gizli, ad, gizle }); };
}
