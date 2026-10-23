// Giriş ekranı ve hesap: e-posta ya da kullanıcı adıyla şifreli giriş, e-postaya giriş bağlantısı, şifremi unuttum,
// davetle ilk şifre, şifreyi göster/gizle, son kullanılan adı hatırlama; Ayarlar → Hesap'ta kullanıcı adı ve şifre değiştirme.
import { getConfig, setConfig } from './db.js';
import { app } from './state.js';
import { esc, toast } from './ui.js';

const SON = 'saha-son-giris';
const donusAdresi = () => location.origin + location.pathname;
const ls = { al: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, yaz: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} } };
const ss = { al: k => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }, sil: k => { try { sessionStorage.removeItem(k); } catch {} } };
export const kullaniciAdiGecerli = s => /^[a-z0-9._-]{3,30}$/.test(s);
export const adNormal = s => String(s || '').trim().toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, '.');

// Supabase hata mesajları → Türkçe
export function hataMetni(err) {
  const m = String(err?.message || err || '');
  if (/Invalid login/i.test(m)) return 'Kullanıcı adı, e-posta ya da şifre hatalı.';
  if (/not confirmed/i.test(m)) return 'E-posta adresin henüz onaylanmamış. Gelen kutundaki onay bağlantısına dokun (gereksiz klasörüne de bak).';
  if (/already registered|already been registered/i.test(m)) return 'Bu e-postayla zaten hesap var. "Şifremi unuttum" ile yeni şifre belirleyebilirsin.';
  if (/security purposes|rate limit|too many/i.test(m)) return 'Çok sık denendi. Bir dakika bekleyip tekrar dene.';
  if (/Signups not allowed|signup.*disabled/i.test(m)) return 'Bu e-postayla hesap yok ve yeni hesap açma kapalı. Veri sahibinden davet iste.';
  if (/should be at least|weak/i.test(m)) return 'Şifre çok kısa ya da zayıf. En az 8 karakter, harf ve rakam kullan.';
  if (/different from the old/i.test(m)) return 'Yeni şifre eskisiyle aynı olamaz.';
  if (/fetch|network/i.test(m)) return 'İnternete bağlanılamadı. Bağlantını kontrol et.';
  return m;
}
const sifreKutusu = (id, etiket, ac = 'current-password', ek = '') => `<div class="fld"><label for="${id}">${etiket}</label><div class="sifre-kutu"><input id="${id}" type="password" autocomplete="${ac}" minlength="6" required ${ek}><button type="button" class="sifre-goz" data-goz aria-label="Şifreyi göster" aria-pressed="false">Göster</button></div></div>`;
const gozBagla = kok => kok.querySelectorAll('[data-goz]').forEach(b => b.onclick = () => { const i = b.previousElementSibling, ac = i.type === 'password'; i.type = ac ? 'text' : 'password'; b.textContent = ac ? 'Gizle' : 'Göster'; b.setAttribute('aria-pressed', ac); b.setAttribute('aria-label', ac ? 'Şifreyi gizle' : 'Şifreyi göster'); i.focus(); });
const sifreUygun = p => p.length >= 8 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(p) && /\d/.test(p);

// Kullanıcı adı → e-posta (schema sürüm 16). Adında @ varsa e-postadır.
async function epostaBul(kimlik) {
  const k = kimlik.trim();
  if (k.includes('@')) return k.toLowerCase();
  const { data, error } = await app.db.c.rpc('giris_epostasi', { ad: adNormal(k) });
  if (error) throw new Error(/does not exist|Could not find/i.test(error.message) ? 'Kullanıcı adıyla giriş henüz açık değil (sunucu güncellenmemiş). E-posta adresinle giriş yap.' : error.message);
  if (!data) throw new Error('Bu kullanıcı adı bulunamadı. E-posta adresinle giriş yapmayı dene.');
  return data;
}

// ---------- Bağlantı ayarları (Supabase adresi ve anahtarı) ----------
export function connForm(cfg) {
  return `<form class="form conn" data-conn>
    <div class="grid"><div class="fld full"><label for="c-url">Supabase proje adresi (Project URL)</label><input id="c-url" placeholder="https://xxxx.supabase.co" value="${esc(cfg?.url || '')}" autocomplete="off"></div>
    <div class="fld full"><label for="c-key">Anon public anahtar</label><textarea id="c-key" rows="3" placeholder="eyJhbGciOi…">${esc(cfg?.key || '')}</textarea>
    <small>Supabase panelinde Project Settings → API bölümünde bulunur. “service_role” anahtarını değil, “anon public” anahtarı gir.</small></div></div>
    <div class="btnrow"><button class="btn primary" type="submit">Supabase'e bağlan</button>${cfg?.mode === 'supabase' ? '<button class="btn ghost" type="button" data-demo>Deneme moduna dön</button>' : ''}</div></form>`;
}
export function bindConn(root) {
  const f = root.querySelector('[data-conn]'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    const url = f.querySelector('#c-url').value.trim().replace(/\/$/, ''), key = f.querySelector('#c-key').value.trim();
    if (!/^https:\/\/.+/.test(url) || key.length < 40) return toast('Adres https:// ile başlamalı ve anahtar tam olmalı.', 'err');
    setConfig({ mode: 'supabase', url, key }); toast('Bağlantı kaydedildi.'); location.hash = '#/ayarlar'; location.reload();
  };
  f.querySelector('[data-demo]')?.addEventListener('click', () => { setConfig({ ...(getConfig() || {}), mode: 'local' }); location.reload(); });
}

// ---------- Giriş ekranı ----------
export function loginView(el, done) {
  const cfg = getConfig();
  const davet = ss.al('saha-davet');
  let cikis = ss.al('saha-cikis-mesaj'); ss.sil('saha-cikis-mesaj');
  let mod = davet || ss.al('saha-yeni') ? 'ilk' : 'sifre';
  const son = ls.al(SON);
  const ciz = (mesaj = '') => {
    el.innerHTML = `<div class="login"><div class="login-card"><div class="brand"><span class="bulb big" aria-hidden="true"></span><h1>Saha Takip</h1></div>
      ${cikis ? `<p class="davet">${esc(cikis)}</p>` : ''}${mesaj}
      ${mod === 'ilk' ? `<p class="davet"><b>Saha Takip'e davet edildin.</b> İlk girişte kendine bir şifre belirle. Sonraki girişlerde bu e-posta ve şifreyi kullanırsın.</p>` : ''}
      <div class="seg giris-mod" role="tablist" aria-label="Giriş yöntemi">${[['sifre', 'Şifreyle'], ['baglanti', 'Bağlantıyla'], ['ilk', 'İlk giriş']].map(([k, t]) => `<button type="button" role="tab" data-mod="${k}" class="${mod === k ? 'on' : ''}" aria-selected="${mod === k}">${t}</button>`).join('')}</div>
      ${mod === 'sifre' ? `<form class="form" data-giris novalidate>
          <div class="fld"><label for="l-e">E-posta ya da kullanıcı adı</label><input id="l-e" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${esc(son)}" ${son ? '' : 'autofocus'}></div>
          ${sifreKutusu('l-p', 'Şifre', 'current-password', son ? 'autofocus' : '')}
          <label class="chk"><input type="checkbox" data-hatirla ${son || !ls.al(SON + '-yok') ? 'checked' : ''}> <span>Adımı bu cihazda hatırla</span></label>
          <div class="btnrow"><button class="btn primary" type="submit">Giriş yap</button><button class="btn ghost" type="button" data-unuttum>Şifremi unuttum</button></div></form>`
      : mod === 'baglanti' ? `<form class="form" data-otp novalidate>
          <p class="hint">Şifre yazmadan gir: e-postana tek kullanımlık bir giriş bağlantısı gelir. Bağlantıyı <b>bu telefonda</b> aç.</p>
          <div class="fld"><label for="l-o">E-posta ya da kullanıcı adı</label><input id="l-o" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${esc(son)}"></div>
          <div class="btnrow"><button class="btn primary" type="submit">Giriş bağlantısı gönder</button></div></form>`
      : `<form class="form" data-ilk novalidate>
          <div class="fld"><label for="l-ie">E-posta (davet edildiğin adres)</label><input id="l-ie" type="email" autocomplete="username" required value="${esc(davet || '')}"></div>
          ${sifreKutusu('l-ip', 'Yeni şifre (en az 8 karakter, harf ve rakam)', 'new-password')}
          ${sifreKutusu('l-ip2', 'Yeni şifre (tekrar)', 'new-password')}
          <div class="btnrow"><button class="btn primary" type="submit">Hesabımı oluştur</button></div>
          <p class="hint">Hesap oluşturunca e-postana onay bağlantısı gelebilir; ona dokunup buraya dönersin. Hesabın zaten varsa "Şifreyle" sekmesinden gir ya da "Şifremi unuttum"u kullan.</p></form>`}
      <details><summary>Bağlantı ayarları</summary><p class="muted">${esc((cfg.url || '').replace('https://', ''))}</p>${connForm(cfg)}</details></div></div>`;
    bindConn(el); gozBagla(el);
    el.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { mod = b.dataset.mod; cikis = ''; ciz(); });
    const kilit = async (form, is) => { const btn = form.querySelector('[type=submit]'); btn.disabled = true; try { await is(); } catch (e) { toast(hataMetni(e), 'err'); } finally { if (btn.isConnected) btn.disabled = false; } };
    el.querySelector('[data-giris]')?.addEventListener('submit', e => { e.preventDefault(); const f = e.target; kilit(f, async () => {
      const kim = f.querySelector('#l-e').value.trim(), p = f.querySelector('#l-p').value;
      if (!kim || !p) throw new Error('E-posta ya da kullanıcı adını ve şifreni yaz.');
      const eposta = await epostaBul(kim);
      await app.db.signIn(eposta, p);
      const hat = f.querySelector('[data-hatirla]').checked; ls.yaz(SON, hat ? kim : ''); ls.yaz(SON + '-yok', hat ? '' : '1');
      ls.yaz('saha-son-etkinlik', String(Date.now())); ss.sil('saha-davet'); ss.sil('saha-yeni');
      done();
    }); });
    el.querySelector('[data-unuttum]')?.addEventListener('click', () => { const kim = el.querySelector('#l-e').value.trim(); sifremiUnuttum(kim, m => ciz(m)); });
    el.querySelector('[data-otp]')?.addEventListener('submit', e => { e.preventDefault(); const f = e.target; kilit(f, async () => {
      const kim = f.querySelector('#l-o').value.trim(); if (!kim) throw new Error('E-posta ya da kullanıcı adını yaz.');
      const eposta = await epostaBul(kim);
      const { error } = await app.db.c.auth.signInWithOtp({ email: eposta, options: { emailRedirectTo: donusAdresi(), shouldCreateUser: false } });
      if (error) throw error;
      ls.yaz(SON, kim);
      ciz(`<p class="davet ok">Giriş bağlantısı <b>${esc(maskele(eposta))}</b> adresine gönderildi. E-postadaki bağlantıya bu telefondan dokun; uygulama açılır ve giriş yapılmış olur. Gelmediyse gereksiz klasörüne bak.</p>`);
    }); });
    el.querySelector('[data-ilk]')?.addEventListener('submit', e => { e.preventDefault(); const f = e.target; kilit(f, async () => {
      const eposta = f.querySelector('#l-ie').value.trim().toLowerCase(), p = f.querySelector('#l-ip').value, p2 = f.querySelector('#l-ip2').value;
      if (!/^\S+@\S+\.\S+$/.test(eposta)) throw new Error('Geçerli bir e-posta yaz.');
      if (!sifreUygun(p)) throw new Error('Şifre en az 8 karakter olmalı, harf ve rakam içermeli.');
      if (p !== p2) throw new Error('İki şifre aynı değil.');
      const r = await app.db.signUp(eposta, p);
      ls.yaz(SON, eposta); ss.sil('saha-davet'); ss.sil('saha-yeni');
      if (r?.user && Array.isArray(r.user.identities) && !r.user.identities.length) { mod = 'sifre'; return ciz('<p class="davet">Bu e-postayla zaten bir hesap var. Şifreni hatırlamıyorsan "Şifremi unuttum"a dokun.</p>'); }
      if (!r.session) { mod = 'sifre'; return ciz(`<p class="davet ok">Hesabın oluşturuldu. <b>${esc(maskele(eposta))}</b> adresine gelen onay bağlantısına dokun, sonra burada şifrenle giriş yap.</p>`); }
      ls.yaz('saha-son-etkinlik', String(Date.now())); done();
    }); });
  };
  ciz();
}
const maskele = e => { const [a, b] = String(e).split('@'); return b ? a.slice(0, 2) + '•••@' + b : e; };

export async function sifremiUnuttum(kim, sonra) {
  if (!kim) return toast('Önce e-posta ya da kullanıcı adını yaz, sonra "Şifremi unuttum"a dokun.', 'err');
  try {
    const eposta = await epostaBul(kim);
    const { error } = await app.db.c.auth.resetPasswordForEmail(eposta, { redirectTo: donusAdresi() });
    if (error) throw error;
    sonra?.(`<p class="davet ok">Şifre yenileme bağlantısı <b>${esc(maskele(eposta))}</b> adresine gönderildi. Bağlantıya dokununca uygulama açılır ve yeni şifreni belirlersin.</p>`);
  } catch (e) { toast(hataMetni(e), 'err'); }
}

// ---------- Şifre yenileme bağlantısından dönüş: yeni şifre belirle ----------
export function yeniSifreEkrani(el, done) {
  el.innerHTML = `<div class="login"><div class="login-card"><div class="brand"><span class="bulb big" aria-hidden="true"></span><h1>Yeni şifre</h1></div>
    <p class="muted">${esc(app.db.user()?.email || '')}</p>
    <form class="form" data-yeni novalidate>${sifreKutusu('y-p', 'Yeni şifre (en az 8 karakter, harf ve rakam)', 'new-password', 'autofocus')}${sifreKutusu('y-p2', 'Yeni şifre (tekrar)', 'new-password')}
    <div class="btnrow"><button class="btn primary" type="submit">Şifreyi kaydet</button><button class="btn ghost" type="button" data-sonra>Şimdi değil</button></div></form></div></div>`;
  gozBagla(el);
  el.querySelector('[data-sonra]').onclick = () => done();
  el.querySelector('[data-yeni]').onsubmit = async e => {
    e.preventDefault();
    const p = el.querySelector('#y-p').value, p2 = el.querySelector('#y-p2').value;
    if (!sifreUygun(p)) return toast('Şifre en az 8 karakter olmalı, harf ve rakam içermeli.', 'err');
    if (p !== p2) return toast('İki şifre aynı değil.', 'err');
    const { error } = await app.db.c.auth.updateUser({ password: p });
    if (error) return toast(hataMetni(error), 'err');
    toast('Yeni şifren kaydedildi.'); done();
  };
}

// ---------- Ayarlar → Hesap: kullanıcı adı ve şifre ----------
export async function hesapGirisAyarlari(kok) {
  if (!kok || app.db.mode !== 'supabase') return;
  const eposta = (app.db.user()?.email || '').toLowerCase();
  let ad = null, eski = false;
  try { const { data, error } = await app.db.c.from('kullanici_adlari').select('ad').eq('eposta', eposta).maybeSingle(); if (error) throw error; ad = data?.ad || null; } catch { eski = true; }
  kok.innerHTML = `<p>Giriş e-postan: <b>${esc(eposta)}</b></p>
    <form class="form" data-kad novalidate><div class="fld"><label for="h-ad">Kullanıcı adı</label><div class="liste-ekle"><input id="h-ad" autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. burak" value="${esc(ad || '')}" ${eski ? 'disabled' : ''}><button class="btn sm" type="submit" ${eski ? 'disabled' : ''}>Kaydet</button></div>
      <small>${eski ? 'Kullanıcı adıyla giriş için Supabase\'de güncel schema.sql dosyasını çalıştır (sürüm 16).' : 'Girişte e-posta yerine bunu yazabilirsin. Küçük harf, rakam, nokta, tire; 3–30 karakter.'}</small></div></form>
    <details class="card-ic"><summary><b>Şifreyi değiştir</b></summary><form class="form" data-sdeg novalidate>${sifreKutusu('h-p', 'Yeni şifre (en az 8 karakter, harf ve rakam)', 'new-password')}${sifreKutusu('h-p2', 'Yeni şifre (tekrar)', 'new-password')}
      <div class="btnrow"><button class="btn primary" type="submit">Şifreyi değiştir</button><button class="btn ghost" type="button" data-sunut>Bağlantıyla yenile</button></div>
      <p class="hint">Şifren değişince diğer cihazlardaki oturumlar açık kalır; kapatmak için aşağıdaki "Tüm cihazlarda çıkış yap"ı kullan.</p></form></details>`;
  gozBagla(kok);
  kok.querySelector('[data-kad]').onsubmit = async e => {
    e.preventDefault();
    const yeni = adNormal(kok.querySelector('#h-ad').value);
    if (!yeni) { const { error } = await app.db.c.from('kullanici_adlari').delete().eq('eposta', eposta); return toast(error ? hataMetni(error) : 'Kullanıcı adı kaldırıldı.', error ? 'err' : ''); }
    if (!kullaniciAdiGecerli(yeni)) return toast('Kullanıcı adı 3–30 karakter olmalı: küçük harf, rakam, nokta, tire.', 'err');
    const r = await kullaniciAdiKaydet(eposta, yeni);
    if (r) return toast(r, 'err');
    kok.querySelector('#h-ad').value = yeni; ls.yaz(SON, yeni); toast('Kullanıcı adın kaydedildi: ' + yeni);
  };
  kok.querySelector('[data-sdeg]').onsubmit = async e => {
    e.preventDefault();
    const p = kok.querySelector('#h-p').value, p2 = kok.querySelector('#h-p2').value;
    if (!sifreUygun(p)) return toast('Şifre en az 8 karakter olmalı, harf ve rakam içermeli.', 'err');
    if (p !== p2) return toast('İki şifre aynı değil.', 'err');
    const { error } = await app.db.c.auth.updateUser({ password: p });
    if (error) return toast(/reauthentication|nonce/i.test(error.message) ? 'Güvenlik için yeniden doğrulama gerekiyor: "Bağlantıyla yenile"ye dokun.' : hataMetni(error), 'err');
    kok.querySelector('[data-sdeg]').reset(); toast('Şifren değiştirildi.');
  };
  kok.querySelector('[data-sunut]').onclick = () => sifremiUnuttum(eposta, () => toast('Şifre yenileme bağlantısı e-postana gönderildi.'));
}
// Kullanıcı adı kaydı (kendisi ya da veri sahibi ekip üyesi için). Hata metni döner, başarıda null.
export async function kullaniciAdiKaydet(eposta, ad) {
  const c = app.db.c;
  const { data: var_ } = await c.rpc('giris_epostasi', { ad });
  if (var_ && var_.toLowerCase() !== eposta.toLowerCase()) return 'Bu kullanıcı adı başkası tarafından alınmış.';
  await c.from('kullanici_adlari').delete().eq('eposta', eposta);
  const { error } = await c.from('kullanici_adlari').insert({ ad, eposta: eposta.toLowerCase() });
  if (error) return /duplicate|unique/i.test(error.message) ? 'Bu kullanıcı adı başkası tarafından alınmış.' : hataMetni(error);
  return null;
}
