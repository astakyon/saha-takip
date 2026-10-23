// Güvenlik: iki adımlı doğrulama (TOTP), kullanılmayınca otomatik çıkış, tüm oturumları kapatma, son giriş
import { app } from './state.js';
import { esc, toast, confirmBox, tarih } from './ui.js';
import { idbSet } from './db.js';

const OTO = 'saha-oto-cikis', SON = 'saha-son-etkinlik';
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const SURELER = [[0, 'Kapalı'], [15, '15 dakika'], [30, '30 dakika'], [60, '1 saat'], [240, '4 saat'], [1440, '1 gün']];
const sure = () => +(ls.get(OTO) || 0);
const zaman = t => t ? new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ---------- Otomatik çıkış (cihaza özel) ----------
// Uygulama açılırken: son kullanım süreyi aştıysa oturumu kapatır. true dönerse giriş ekranı gösterilmeli.
export async function otoCikisGerekli() {
  const dk = sure(), son = +(ls.get(SON) || 0);
  if (!dk || !son || Date.now() - son < dk * 60000) { ls.set(SON, Date.now()); return false; }
  await cikis('Uzun süre kullanılmadığı için oturum kapatıldı.');
  return true;
}
async function cikis(mesaj) {
  try { const uid = app.db.user()?.id; if (uid) { await idbSet('cache:' + uid, null); await idbSet('senk:' + uid, null); } } catch {}  // telefonda kayıt kopyası kalmasın (bekleyen değişiklikler korunur)
  try { await app.db.c.auth.signOut({ scope: 'local' }); } catch {}
  try { sessionStorage.setItem('saha-cikis-mesaj', mesaj); } catch {}
  location.reload();
}
export function otoCikisKur() {
  let t = 0;
  const dokundu = () => { const n = Date.now(); if (n - t > 20000) { t = n; ls.set(SON, n); } };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(e => window.addEventListener(e, dokundu, { passive: true, capture: true }));
  const kontrol = () => { const dk = sure(), son = +(ls.get(SON) || 0); if (dk && son && Date.now() - son >= dk * 60000) cikis('Uzun süre kullanılmadığı için oturum kapatıldı.'); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kontrol(); else ls.set(SON, Math.max(+(ls.get(SON) || 0), t)); });
  setInterval(kontrol, 60000);
}

// ---------- İki adımlı doğrulama: girişte kod sorma ----------
// Kişide doğrulanmış bir kod uygulaması varsa ve oturum henüz ikinci adımı geçmediyse kod ekranını gösterir.
export async function ikinciAdimGerekli() {
  try { const { data } = await app.db.c.auth.mfa.getAuthenticatorAssuranceLevel(); return data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2'; } catch { return false; }
}
export function ikinciAdimEkrani(el, done) {
  el.innerHTML = `<div class="login"><div class="login-card"><div class="brand"><span class="bulb big" aria-hidden="true"></span><h1>Saha Takip</h1></div>
    <p><b>İki adımlı doğrulama</b></p><p class="muted">Telefonundaki doğrulama uygulamasında (Google Authenticator, Microsoft Authenticator…) Saha Takip için görünen 6 haneli kodu gir.</p>
    <form class="form" data-kod><div class="fld"><label for="mf-k">Kod</label><input id="mf-k" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus></div>
    <div class="btnrow"><button class="btn primary" type="submit">Doğrula</button><button class="btn ghost" type="button" data-iptal>Farklı hesapla giriş</button></div></form></div></div>`;
  const f = el.querySelector('[data-kod]');
  f.onsubmit = async e => {
    e.preventDefault();
    const code = f.querySelector('#mf-k').value.trim();
    try {
      const { data: l } = await app.db.c.auth.mfa.listFactors();
      const fac = (l?.totp || []).find(x => x.status === 'verified'); if (!fac) return done();
      const { error } = await app.db.c.auth.mfa.challengeAndVerify({ factorId: fac.id, code }); if (error) throw error;
      const { data } = await app.db.c.auth.getSession(); app.db.session = data.session;
      done();
    } catch (err) { toast(/invalid|expired/i.test(err.message) ? 'Kod hatalı ya da süresi geçti. Uygulamadaki yeni kodu gir.' : err.message, 'err'); f.querySelector('#mf-k').select(); }
  };
  el.querySelector('[data-iptal]').onclick = async () => { await app.db.c.auth.signOut({ scope: 'local' }); location.reload(); };
}

// ---------- Ayarlar → Genel → Güvenlik ----------
export async function guvenlikAyarlari(root) {
  if (app.db.mode !== 'supabase') { root.innerHTML = '<p class="hint">Deneme modunda giriş olmadığı için güvenlik ayarları yok. Bulut bağlantısı kurunca iki adımlı doğrulama ve otomatik çıkış açılır.</p>'; return; }
  const u = app.db.user();
  let faktor = null, mfaYok = false;
  try { const { data, error } = await app.db.c.auth.mfa.listFactors(); if (error) throw error; faktor = (data?.totp || []).find(x => x.status === 'verified') || null; } catch { mfaYok = true; }
  root.innerHTML = `<p class="muted">Son giriş: <b>${zaman(u?.last_sign_in_at)}</b></p>
    <h3>İki adımlı doğrulama</h3>
    ${mfaYok ? '<p class="hint">Supabase projende iki adımlı doğrulama kapalı görünüyor (Authentication → Multi-Factor → TOTP).</p>'
      : faktor ? `<p>✓ <b>Açık.</b> Yeni bir cihazda girişte şifreden sonra doğrulama uygulamasındaki kod sorulur. <small class="muted">${zaman(faktor.created_at)} tarihinde açıldı.</small></p><div class="btnrow"><button type="button" class="btn sm ghost" data-mfakapat>Kapat</button></div>`
      : `<p>Şifren başkasının eline geçse bile, telefonundaki doğrulama uygulamasının ürettiği kod olmadan girilemez.</p><div class="btnrow"><button type="button" class="btn sm" data-mfaac>İki adımlı doğrulamayı aç</button></div>`}
    <div data-mfakur hidden></div>
    <h3>Kullanılmayınca otomatik çıkış</h3>
    <div class="fld"><label for="g-oto">Bu cihazda şu kadar süre dokunulmazsa çıkış yap</label><select id="g-oto">${SURELER.map(([v, t]) => `<option value="${v}" ${sure() === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <p class="hint">Çıkışta bu cihazdaki kayıt kopyası da silinir; tekrar girince veriler buluttan iner. İnternet bekleyen değişiklikler silinmez. Ayar yalnızca bu cihaz için geçerli.</p>
    <h3>Telefon kaybolursa</h3>
    <p>Başka bir cihazdan giriş yap ve <b>Tüm cihazlarda çıkış yap</b>'a dokun. Diğer cihazlardaki oturumlar en geç bir saat içinde kapanır; şifreni de değiştirmen önerilir.</p>
    <div class="btnrow"><button type="button" class="btn sm danger" data-hepsi>Tüm cihazlarda çıkış yap</button></div>`;
  root.querySelector('#g-oto').onchange = e => { ls.set(OTO, e.target.value); ls.set(SON, Date.now()); toast(+e.target.value ? 'Otomatik çıkış açıldı.' : 'Otomatik çıkış kapatıldı.'); };
  root.querySelector('[data-hepsi]').onclick = async () => {
    if (!confirmBox('Bu cihaz dahil bütün cihazlardaki oturumlar kapatılsın mı? Her cihazda yeniden giriş gerekir.')) return;
    try { const { error } = await app.db.c.auth.signOut({ scope: 'global' }); if (error) throw error; } catch (e) { return toast('Çıkış yapılamadı: ' + e.message, 'err'); }
    try { sessionStorage.setItem('saha-cikis-mesaj', 'Bütün cihazlarda çıkış yapıldı.'); } catch {}
    location.reload();
  };
  root.querySelector('[data-mfakapat]')?.addEventListener('click', async () => {
    if (!confirmBox('İki adımlı doğrulama kapatılsın mı? Girişte yalnızca şifre sorulur.')) return;
    const { error } = await app.db.c.auth.mfa.unenroll({ factorId: faktor.id });
    if (error) return toast('Kapatılamadı: ' + error.message + ' Çıkış yapıp kodla yeniden girince tekrar dene.', 'err');
    await app.db.c.auth.refreshSession().catch(() => {}); toast('İki adımlı doğrulama kapatıldı.'); guvenlikAyarlari(root);
  });
  root.querySelector('[data-mfaac]')?.addEventListener('click', async () => {
    const kutu = root.querySelector('[data-mfakur]'); kutu.hidden = false; kutu.innerHTML = '<p class="hint">Hazırlanıyor…</p>';
    try {
      // yarım kalmış eski kurulumları temizle
      const { data: l } = await app.db.c.auth.mfa.listFactors();
      for (const x of (l?.all || []).filter(x => x.status !== 'verified')) await app.db.c.auth.mfa.unenroll({ factorId: x.id }).catch(() => {});
      const { data, error } = await app.db.c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Saha Takip ' + new Date().toISOString().slice(0, 10) }); if (error) throw error;
      kutu.innerHTML = `<ol class="mfa-adim"><li>Telefonuna <b>Google Authenticator</b> ya da <b>Microsoft Authenticator</b> yükle.</li>
        <li>Uygulamada “+” → <b>QR kodu tara</b> ile bu kodu okut.${/^data:image|^<svg/.test(data.totp.qr_code) ? `<div class="mfa-qr"><img alt="İki adımlı doğrulama QR kodu" src="${data.totp.qr_code.startsWith('<svg') ? 'data:image/svg+xml;utf8,' + encodeURIComponent(data.totp.qr_code) : esc(data.totp.qr_code)}"></div>` : ''}
          <small class="muted">Bu telefonda okutamıyorsan “kurulum anahtarı gir” seçip şunu yaz: <code>${esc(data.totp.secret)}</code></small></li>
        <li>Uygulamada görünen 6 haneli kodu yaz:</li></ol>
        <div class="liste-ekle"><input data-kod inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="Doğrulama kodu"><button type="button" class="btn sm primary" data-dogrula>Doğrula ve aç</button></div>`;
      kutu.querySelector('[data-dogrula]').onclick = async () => {
        const code = kutu.querySelector('[data-kod]').value.trim();
        const r = await app.db.c.auth.mfa.challengeAndVerify({ factorId: data.id, code });
        if (r.error) return toast('Kod doğrulanamadı: kodun süresi dolmuş olabilir, yenisini gir.', 'err');
        const { data: s } = await app.db.c.auth.getSession(); app.db.session = s.session;
        toast('İki adımlı doğrulama açıldı.'); guvenlikAyarlari(root);
      };
    } catch (e) { kutu.innerHTML = `<p class="warn">Kurulum başlatılamadı: ${esc(e.message)}</p>`; }
  });
}

// ---------- Kullanıcılar sekmesi: ekip üyelerinin son girişi ----------
export async function sonGirisler() {
  try { const { data, error } = await app.db.c.rpc('ekip_son_giris'); if (error) throw error; return Object.fromEntries((data || []).map(r => [String(r.eposta).toLowerCase(), r])); } catch { return null; }
}
export const sonGirisMetni = r => {
  if (!r) return 'henüz giriş yapmadı';
  const t = [r.son_gorulme, r.son_giris].filter(Boolean).sort().pop();
  if (!t) return 'henüz giriş yapmadı';
  const gun = Math.floor((Date.now() - new Date(t)) / 864e5);
  return 'son kullanım: ' + (gun < 1 ? 'bugün' : gun === 1 ? 'dün' : gun < 30 ? gun + ' gün önce' : tarih(t.slice(0, 10)));
};
// Ekip üyesi uygulamayı açtığında "son görülme" yazılır (saatte en fazla bir kez)
export function gorundum() {
  if (app.db.mode !== 'supabase' || app.yetki?.ben_sahip !== false) return;
  const k = 'saha-gorundum', son = +(ls.get(k) || 0); if (Date.now() - son < 3600000) return;
  app.db.c.rpc('gorundum').then(({ error }) => { if (!error) ls.set(k, Date.now()); }).catch(() => {});
}
