// Kullanıcılar ve yetkiler (yalnızca veri sahibi görür): ekip üyesi ekleme, bölüm bazında yetki, davet bağlantısı
import { getConfig, S } from '../db.js';
import { app } from '../state.js';
import { esc, toast, confirmBox, waLink } from '../ui.js';
import { EKRANLAR, GIZLENEBILIR, ekranSecimi, ekranTablolari, yetkiNesnesi, onizlemeBaslat } from '../yetki.js';
import { BASLIKLAR, SEKME_AD, BUGUN_KARTLAR } from '../basliklar.js';
import { kullaniciAdiKaydet, adNormal, kullaniciAdiGecerli } from '../giris.js';

// Kişinin rolü (Bayi, Ekip arkadaşı…) yetkiler içindeki “_rol” anahtarında saklanır; veritabanı yetki kontrolü bu anahtarı kullanmaz.
export const ROLLER = ['Bayi', 'Ekip arkadaşı', 'Satış temsilcisi', 'Yönetici', 'Proje firması', 'Elektrik müteahhidi', 'Diğer'];
export const rolAl = u => u?.yetkiler?._rol || '';
const rolListesi = () => '';
// Rol seçimi: liste + “Başka…” (serbest yazı)
const rolSecici = (deger, id = '') => { const v = deger || ''; const ozel = v && !ROLLER.includes(v); return `<div class="rol-sec"><select data-rolsec ${id ? `id="${id}"` : ''} aria-label="Rol"><option value="">Rol seç</option>${ROLLER.map(r => `<option ${r === v ? 'selected' : ''}>${r}</option>`).join('')}<option value="__baska" ${ozel ? 'selected' : ''}>Başka (yaz)…</option></select><input data-rolyaz placeholder="Rolü yaz" value="${ozel ? v.replace(/"/g, '&quot;') : ''}" ${ozel ? '' : 'hidden'} maxlength="40"></div>`; };
const rolOku = kok => { if (kok.dataset?.rol) return kok.querySelector('[data-rolad]')?.value.trim() || ''; const r = kok.querySelector('[data-uyerol]'); if (r) return ROLLER_DB?.find(x => x.id === r.value)?.ad || ''; const s = kok.querySelector('[data-rolsec]'); if (!s) return ''; return s.value === '__baska' ? kok.querySelector('[data-rolyaz]').value.trim() : s.value; };
// K2: şirketin rolleri (sunucuda "roller" tablosu). null = tablo yok (eski şema) → eski rol etiketi kullanılır
let ROLLER_DB = null, EKIPLER_DB = null;
// K5: dış kullanıcı (bayi / proje firması) — firması seçilirse yalnızca o firmanın yer aldığı projeleri görür
let DIS_VAR = false;
const disSecici = (u = {}) => {
  if (!DIS_VAR) return '';
  const fl = (S.firmalar || []).slice().sort((a, b) => ((b.tipler || []).includes('Bayi') - (a.tipler || []).includes('Bayi')) || a.ad.localeCompare(b.ad, 'tr'));
  return `<div class="fld dis-fld"><label>Dış kullanıcı (bayi / proje firması)</label><select data-uyedis aria-label="Dış kullanıcının firması"><option value="">Hayır, şirket çalışanı</option>${fl.map(f => `<option value="${f.id}" ${u.dis_firma_id === f.id ? 'selected' : ''}>${esc(f.ad)}${(f.tipler || []).length ? ' · ' + esc(f.tipler.join(', ')) : ''}</option>`).join('')}</select><small>Firma seçilirse bu kişi yalnızca o firmanın yer aldığı projeleri (ve tekliflerini), firmanın kendisini ve kişilerini görür; satış haritası, ziyaretler ve diğer firmalar ona kapalıdır. Ekranları ve gizli bölümleri yine rolünden seçilir.</small></div>`;
};
const disOku = k => k.querySelector('[data-uyedis]') ? { dis_firma_id: k.querySelector('[data-uyedis]').value || null } : {};
// Ekip seçici (kullanıcı kartı)
const ekipSecici = (u = {}) => EKIPLER_DB?.length ? `<div class="fld"><label>Ekip</label><select data-uyeekip aria-label="Ekip"><option value="">Ekip yok</option>${ekipSecenekleri(u.ekip_id)}</select></div>` : '';
const ekipYolu = id => { const l = []; let e = EKIPLER_DB?.find(x => x.id === id), n = 0; while (e && n++ < 20) { l.unshift(e.ad); e = EKIPLER_DB.find(x => x.id === e.ust_ekip_id); } return l.join(' › '); };
const ekipSecenekleri = (sec, haric) => (EKIPLER_DB || []).filter(e => e.id !== haric).map(e => ({ e, y: ekipYolu(e.id) })).sort((a, b) => a.y.localeCompare(b.y, 'tr')).map(({ e, y }) => `<option value="${e.id}" ${sec === e.id ? 'selected' : ''}>${esc(y)}</option>`).join('');
const uyeRolSecici = (u = {}) => `<div class="fld"><label>Rol</label><select data-uyerol aria-label="Rol">${ROLLER_DB.map(r => `<option value="${r.id}" ${u.rol_id === r.id ? 'selected' : ''}>${esc(r.ad)}</option>`).join('')}<option value="" ${u.rol_id || (u.yeni && ROLLER_DB.length) ? '' : 'selected'}>Rolsüz (ekranları tek tek seç)</option></select>
  <label class="chk" data-ozel-l ${u.rol_id ? '' : 'hidden'}><input type="checkbox" data-ozel ${u.ozel ? 'checked' : ''}> <span>Bu kişiye özel ayar yap <small class="muted">(rol değişince bu kişi etkilenmez)</small></span></label></div>`;
// Rol seçimine göre ekran ağacını göster/gizle; rolden gelen ayarı ağaca yazar
function uyeRolBagla(k) {
  const sel = k.querySelector('[data-uyerol]'); if (!sel) return;
  const agac = k.querySelector('[data-agac]'), ozel = k.querySelector('[data-ozel]'), ozelL = k.querySelector('[data-ozel-l]'), bilgi = k.querySelector('[data-rolbilgi]');
  const guncelle = (yaz) => {
    const r = ROLLER_DB.find(x => x.id === sel.value);
    ozelL.hidden = !r; const kendi = !r || ozel.checked;
    agac.hidden = !kendi;
    if (r && yaz) { secimYaz(k, ekranSecimi(r.yetkiler), r.yetkiler._gizli || []); const d = k.querySelector('[data-disa]'); if (d) d.checked = r.yetkiler._disa === true; const kp = r.yetkiler._kapsam || 'tum'; k.querySelectorAll('[data-kapsam] button').forEach(b => { b.classList.toggle('on', b.dataset.v === kp); b.setAttribute('aria-pressed', b.dataset.v === kp); }); }
    const yon = k.querySelector('[data-yonetici]')?.checked;
    if (bilgi) bilgi.innerHTML = yon ? '<p class="hint"><b>Şirket yöneticisi</b> her ekranı görür ve düzenler; rol ayarı onun için geçerli olmaz.</p>' : r && !ozel.checked ? rolKutusu(r) : '';
    if (yon) agac.hidden = true;
  };
  sel.onchange = () => guncelle(true); ozel.onchange = () => guncelle(true); k.querySelector('[data-yonetici]')?.addEventListener('change', () => guncelle(false));
  guncelle(false);
}
function rolKutusu(r) {
  const s = ekranSecimi(r.yetkiler || {}), ad = k => esc(SEKME_AD[k] || k), tum = Object.keys(EKRANLAR);
  const yaz = tum.filter(k => s[k] === 'yaz'), oku = tum.filter(k => s[k] === 'oku');
  const kp = { ekip: 'Ekibinin kayıtları', kendi: 'Yalnız kendi kayıtları' }[r.yetkiler?._kapsam] || 'Tüm şirketin kayıtları';
  const gz = (r.yetkiler?._gizli || []).map(k => GIZLENEBILIR.find(x => x.k === k)?.ad).filter(Boolean);
  return `<div class="rol-kutu"><p><b>${esc(r.ad)}</b> rolünün ayarı geçerli <small class="muted">· değiştirmek için Roller sekmesi</small></p>
    ${yaz.length ? `<div class="rk-satir"><span>Düzenler</span><div class="chips">${yaz.map(k => `<em class="ck yaz">${ad(k)}</em>`).join('')}</div></div>` : ''}
    ${oku.length ? `<div class="rk-satir"><span>Görür</span><div class="chips">${oku.map(k => `<em class="ck oku">${ad(k)}</em>`).join('')}</div></div>` : ''}
    ${!yaz.length && !oku.length ? '<p class="warn">Bu rolde hiçbir ekran açık değil.</p>' : ''}
    <div class="rk-satir"><span>Kayıtlar</span><div>${esc(kp)}${gz.length ? ' · gizli: ' + esc(gz.join(', ')) : ''}</div></div></div>`;
}
const rolOzeti = r => { const s = ekranSecimi(r.yetkiler || {}); const kp = { ekip: 'Ekibinin kayıtları · ', kendi: 'Yalnız kendi kayıtları · ' }[r.yetkiler?._kapsam] || ''; return kp + Object.keys(EKRANLAR).filter(k => s[k]).map(k => (SEKME_AD[k] || k) + (s[k] === 'yaz' ? '' : ' (görür)')).join(', '); };
// Kaydedilecek kullanıcı alanları (rol, kişiye özel, yetkiler)
function uyeYetkiAlanlari(k, secim) {
  const sel = k.querySelector('[data-uyerol]');
  if (!sel) return { yetkiler: yetkiOku(k, secim) };
  const r = ROLLER_DB.find(x => x.id === sel.value), ozel = !!r && !!k.querySelector('[data-ozel]')?.checked;
  if (r && !ozel) return { rol_id: r.id, ozel: false, yetkiler: { ...r.yetkiler, _rol: r.ad } };
  return { rol_id: r?.id || null, ozel, yetkiler: { ...yetkiOku(k, secim), ...(r?.yetkiler?._gorunum ? { _gorunum: r.yetkiler._gorunum } : {}) } };
}
const rolBagla = kok => kok.querySelectorAll('[data-rolsec]').forEach(s => s.onchange = () => { const i = s.parentElement.querySelector('[data-rolyaz]'); i.hidden = s.value !== '__baska'; if (!i.hidden) i.focus(); });
const TUM = Object.keys(EKRANLAR);
const HAZIR = {
  'Bayi': { e: { urunler: 'yaz', bayi: 'yaz', katalog: 'oku', araclar: 'oku', siparisler: 'oku', projeler: 'oku', firmalar: 'oku', harita: 'oku' }, g: [] },
  'Saha ekibi': { e: { harita: 'oku', bolgeler: 'oku', projeler: 'yaz', firmalar: 'yaz', kisiler: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', gorevler: 'yaz', numuneler: 'yaz', servis: 'yaz', katalog: 'oku', araclar: 'oku', referanslar: 'oku', dosyalar: 'yaz' }, g: [] },
  'Proje firması': { e: { projeler: 'oku', referanslar: 'oku', katalog: 'oku', araclar: 'oku' }, g: ['tutar', 'iletisim', 'yorum', 'iliski'] },
  'Sadece görüntüleme': { e: { harita: 'oku', projeler: 'oku', firmalar: 'oku', kisiler: 'oku', takvim: 'oku', ziyaretler: 'oku' }, g: [] },
  'Tam yetki': { e: Object.fromEntries(TUM.map(k => [k, EKRANLAR[k].salt ? 'oku' : 'yaz'])), g: [] },
  'Muhasebe': { e: { siparisler: 'yaz', tahsilat: 'yaz', teklifler: 'oku', firmalar: 'oku', panel: 'oku', masraflar: 'oku', finans: 'oku', cari: 'yaz', yaslandirma: 'oku', kur: 'oku', muhasebe: 'oku', cekler: 'yaz', nakit: 'oku', banka: 'yaz' }, g: [] },
  'Satış': { e: { harita: 'oku', bolgeler: 'oku', projeler: 'yaz', firmalar: 'yaz', kisiler: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', gorevler: 'yaz', teklifler: 'yaz', numuneler: 'yaz', katalog: 'oku', araclar: 'oku', referanslar: 'oku', dosyalar: 'yaz' }, g: [] },
  'Satış destek': { e: { teklifler: 'yaz', projeler: 'oku', firmalar: 'oku', kisiler: 'oku', siparisler: 'oku', urunler: 'oku', katalog: 'oku', araclar: 'oku' }, g: [] },
  'Dış kullanıcı': { e: { bayistok: 'yaz', bayisatis: 'yaz', projeler: 'oku', firmalar: 'oku', kisiler: 'oku', teklifler: 'oku', katalog: 'oku', araclar: 'oku', urunler: 'oku' }, g: ['iliski', 'yorum'] },
  'Proje': { e: { projeler: 'yaz', dosyalar: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', firmalar: 'oku', kisiler: 'oku', katalog: 'oku', araclar: 'oku' }, g: ['tutar'] },
};
for (const h of Object.values(HAZIR)) for (const k of Object.keys(h.e)) if (!EKRANLAR[k]) delete h.e[k];
const HAZIR_ROLLER = ['Muhasebe', 'Satış', 'Satış destek', 'Proje', 'Bayi'];
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Giriş bilgisi bağlantısı: bu cihazı şirketin veritabanına bağlar, kullanıcı adını doldurur (şifre içermez)
export function girisLinki(kad) {
  const c = getConfig();
  return location.origin + location.pathname + '?davet=' + b64(JSON.stringify({ u: c.url, k: c.key, kad }));
}
export const SENTETIK = /@kullanici\.saha-takip\.invalid$/;
export function geciciSifre() {
  const h = 'abcdefghjkmnpqrstuvwxyz', r = '23456789', b = new Uint8Array(10); crypto.getRandomValues(b);
  const s = [...b].map((x, i) => (i % 3 === 2 ? r[x % r.length] : h[x % h.length])).join('');
  return s.slice(0, 4) + '-' + s.slice(4);
}
// "kullanici" Edge Function'ı: hesap aç / şifre sıfırla. Hata metni ya da sonuç döner.
export async function hesapIslemi(govde) {
  try {
    const { data, error } = await app.db.c.functions.invoke('kullanici', { body: { sahip: app.db.sahip || app.db.user().id, ...govde } });
    if (error) {
      let m = error.message; try { const j = await error.context?.json?.(); if (j?.hata) m = j.hata; } catch {}
      if (/Failed to send|not found|404|FunctionsFetchError|FunctionsRelayError/i.test(m + ' ' + (error.name || ''))) return { hata: 'Hesap açma fonksiyonu sunucuda yok. Supabase → Edge Functions\'a "kullanici" fonksiyonunu yükle (supabase/functions/kullanici/index.ts) ve schema.sql (sürüm 37) çalıştır.', kurulum: true };
      return { hata: m };
    }
    return data?.hata ? { hata: data.hata } : data;
  } catch (e) { return { hata: e.message }; }
}
function girisBilgisiKutusu(kutu, { ad, kad, sifre }) {
  const l = girisLinki(kad), metin = `Merhaba${ad ? ' ' + ad : ''}, Saha Takip giriş bilgilerin:\n\n1) Bu bağlantıyı telefonunda aç: ${l}\n2) Kullanıcı adı: ${kad}\n3) Geçici şifre: ${sifre}\n\nİlk girişte kendine yeni bir şifre belirleyeceksin. Uygulamayı ana ekrana eklemek için menüde "Telefona yükle"ye dokun.`;
  kutu.hidden = false;
  kutu.innerHTML = `<div class="giris-bilgi"><p><b>Giriş bilgileri</b> <small class="muted">bu ekranı kapatınca şifre bir daha gösterilmez</small></p>
    <dl class="profil-dl"><dt>Kullanıcı adı</dt><dd><b>${esc(kad)}</b></dd><dt>Geçici şifre</dt><dd><b class="mono">${esc(sifre)}</b></dd></dl>
    <div class="btnrow"><a class="btn sm primary" target="_blank" rel="noopener" href="${waLink('', metin)}">WhatsApp ile gönder</a><button type="button" class="btn sm" data-gbkopya>Kopyala</button></div>
    <p class="hint">Mesajdaki bağlantı kişinin telefonunu şirketinin veritabanına bağlar ve kullanıcı adını doldurur; şifre bağlantıda değil, mesajın içinde. İlk girişte kişi kendi şifresini belirler.</p></div>`;
  kutu.querySelector('[data-gbkopya]').onclick = async () => { try { await navigator.clipboard.writeText(metin); toast('Giriş bilgileri kopyalandı.'); } catch { toast(metin); } };
}
export function davetLinki(eposta) {
  const c = getConfig();
  return location.origin + location.pathname + '?davet=' + b64(JSON.stringify({ u: c.url, k: c.key, e: eposta }));
}

export async function kullaniciAyarlari(root, bolum = 'kullanicilar') {
  if (app.db.mode !== 'supabase') { root.innerHTML = '<p class="hint">Başka kişilere yetki vermek için önce Genel sekmesinden bulut (Supabase) bağlantısını kur.</p>'; return; }
  root.innerHTML = '<p class="hint">Yükleniyor…</p>';
  const { data, error } = await app.db.c.from('ekip_uyeleri').select('*').eq('owner', app.db.sahip || app.db.user().id).order('created_at');
  if (error) { root.innerHTML = `<p class="warn">Kullanıcı tablosu bulunamadı. Supabase SQL Editor'de güncel <b>schema.sql</b> dosyasını çalıştır.</p>`; return; }
  const uyeler = data || [];
  // dis_firma_id sütunu sunucuda varsa (şema 31) dış kullanıcı seçimi gösterilir
  DIS_VAR = uyeler.some(u => 'dis_firma_id' in u) || (!uyeler.length && await app.db.c.rpc('yetki_surum').then(r => (r.data || 0) >= 31, () => false));
  try { const e = await app.db.c.from('ekipler').select('*').eq('owner', app.db.sahip || app.db.user().id).order('ad'); if (e.error) throw e.error; EKIPLER_DB = e.data || []; } catch { EKIPLER_DB = null; }
  try { const r = await app.db.c.from('roller').select('*').eq('owner', app.db.sahip || app.db.user().id).order('sira').order('ad'); if (r.error) throw r.error; ROLLER_DB = r.data || []; } catch { ROLLER_DB = null; }
  const KAD = new Map(); let kadVar = true;
  try { const r = await app.db.c.from('kullanici_adlari').select('ad,eposta'); if (r.error) throw r.error; for (const x of r.data || []) KAD.set(x.eposta.toLowerCase(), x.ad); } catch { kadVar = false; }
  for (const u of uyeler) u._kad = KAD.get(u.eposta.toLowerCase()) || '';
  // Hesap durumu (sürüm 37): hesabı var mı, son giriş
  let HESAP = null; try { const r = await app.db.c.rpc('uye_hesaplari', { p_sahip: app.db.sahip || app.db.user().id }); if (r.error) throw r.error; HESAP = new Map((r.data || []).map(x => [x.eposta, x])); } catch {}
  for (const u of uyeler) { const h = HESAP?.get(u.eposta.toLowerCase()); u._hesap = HESAP ? !!h?.hesap_var : null; u._sonGiris = h?.son_giris || null; if (!u._kad && h?.kad) u._kad = h.kad; }
  const yenile = () => kullaniciAyarlari(root, bolum);
  const durumSay = { aktif: uyeler.filter(u => u.aktif && u._hesap !== false).length, hesapsiz: uyeler.filter(u => u.aktif && u._hesap === false).length, ilk: uyeler.filter(u => u.aktif && u._hesap && !u._sonGiris).length };
  if (bolum === 'sirket') { root.innerHTML = ''; return sirketKarti(root); }
  if (bolum === 'roller') {
    root.innerHTML = ROLLER_DB ? rolBolumu(uyeler) : '<p class="warn">Roller için Supabase\'de güncel schema.sql dosyasını çalıştır.</p>';
    rolleriBagla(root, uyeler, yenile); return;
  }
  if (bolum === 'ekipler') {
    root.innerHTML = EKIPLER_DB ? ekipBolumu(uyeler) : '<p class="warn">Ekipler için Supabase\'de güncel schema.sql dosyasını çalıştır.</p>';
    ekipleriBagla(root, yenile); return;
  }
  const pasifN = uyeler.filter(u => !u.aktif).length;
  root.innerHTML = `<div class="kul-ust"><p class="kul-say"><b>${uyeler.filter(u => u.aktif).length}</b> aktif kullanıcı${durumSay.ilk ? ` · <b>${durumSay.ilk}</b> ilk girişini bekliyor` : ''}${durumSay.hesapsiz ? ` · <b>${durumSay.hesapsiz}</b> hesabı açılmamış` : ''}${pasifN ? ` · ${pasifN} pasif` : ''}</p>
      <button type="button" class="btn primary" data-kisiekle>+ Kişi ekle</button></div>
    <div class="kul-ekle card-ic" data-ekleform hidden>
      <form class="form" data-yeni novalidate><h3>Yeni kullanıcı</h3>
        <section class="uye-b"><h4>1 · Kişi</h4><div class="grid">
          <div class="fld"><label for="ku-a">Ad soyad</label><input id="ku-a" placeholder="ör. Ali Yılmaz" autocomplete="off"></div>
          ${kadVar ? '<div class="fld"><label for="ku-k">Kullanıcı adı</label><input id="ku-k" autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. ali.yilmaz"><small>Addan önerilir. Küçük harf, rakam, nokta, tire.</small></div>' : ''}
          <div class="fld"><label for="ku-s">Geçici şifre</label><div class="liste-ekle"><input id="ku-s" class="mono" value="${geciciSifre()}" autocomplete="off" spellcheck="false"><button type="button" class="btn sm ghost" data-yenisifre>Yenile</button></div><small>İlk girişte kendi şifresini belirler.</small></div>
          <div class="fld"><label for="ku-e">E-posta <span class="muted">(isteğe bağlı)</span></label><input id="ku-e" type="email" placeholder="yoksa boş bırak"></div></div></section>
        <section class="uye-b"><h4>2 · Rol ve ekip</h4><div class="grid">${ROLLER_DB ? uyeRolSecici({ yeni: true }) : `<div class="fld"><label for="ku-r">Rol / ünvan</label>${rolSecici('', 'ku-r')}</div>`}${ekipSecici({})}${disSecici({})}</div>
          ${ROLLER_DB && !ROLLER_DB.length ? '<p class="hint">Henüz rol yok. <b>Roller</b> sekmesinden rol eklersen (Satış, Muhasebe, Bayi…) kişiye tek seçimle yetki verirsin.</p>' : ''}</section>
        <section class="uye-b"><h4>3 · Ne görür?</h4><div data-rolbilgi></div><div data-agac>${yetkiDuzeni({})}</div></section>
        <div class="btnrow"><button type="submit" class="btn primary">Hesabı aç</button><button type="button" class="btn ghost" data-eklevaz>Vazgeç</button></div></form>
      <div data-yenibilgi hidden></div></div>
    ${uyeler.length > 1 ? `<div class="kul-arac"><input type="search" data-kulara placeholder="Kişi, kullanıcı adı, rol ara" aria-label="Kullanıcı ara"><div class="seg" role="group" aria-label="Duruma göre">${[['', 'Hepsi'], ['ok', 'Aktif'], ['bekle', 'Bekleyen'], ['pasif', 'Pasif']].map(([v, t], i) => `<button type="button" data-kulsuz="${v}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div></div>` : ''}
    <div class="uyeler">${uyeler.length ? `<div class="uye-baslik" aria-hidden="true"><span>Kişi</span><span>Kullanıcı adı</span><span>Rol · ekip</span><span>Durum</span></div>` : ''}${uyeler.slice().sort((a, b) => (b.aktif - a.aktif) || rolAl(a).localeCompare(rolAl(b), 'tr') || (a.ad || a.eposta).localeCompare(b.ad || b.eposta, 'tr')).map(u => uyeKarti(u, kadVar)).join('') || '<p class="hint">Henüz kimse eklenmedi. “Kişi ekle” ile kullanıcı adı ve geçici şifreyle hesap aç.</p>'}<p class="hint" data-kulbos hidden>Aramaya uyan kişi yok.</p></div>
    <p class="hint">Kişi yalnızca rolünün açtığı ekranları görür; kapalı ekranların kayıtları telefonuna hiç gönderilmez. Satıra dokunup <b>Bu kişi gibi gör</b> ile kişinin ekranını deneyebilirsin.</p>`;
  { const ara = root.querySelector('[data-kulara]'); let suz = '';
    const uygula = () => { const q = (ara?.value || '').trim().toLocaleLowerCase('tr'); let n = 0; root.querySelectorAll('[data-uye]').forEach(d => { const ok = (!q || d.dataset.ara.includes(q)) && (!suz || d.dataset.durum === suz || (suz === 'bekle' && ['bekle', 'uyari'].includes(d.dataset.durum))); d.hidden = !ok; n += ok; }); const b = root.querySelector('[data-kulbos]'); if (b) b.hidden = !!n; };
    ara?.addEventListener('input', uygula);
    root.querySelectorAll('[data-kulsuz]').forEach(b => b.onclick = () => { suz = b.dataset.kulsuz; root.querySelectorAll('[data-kulsuz]').forEach(x => x.classList.toggle('on', x === b)); uygula(); }); }
  rolBagla(root);
  const ekleKutu = root.querySelector('[data-ekleform]');
  root.querySelector('[data-kisiekle]').onclick = () => { ekleKutu.hidden = false; root.querySelector('[data-kisiekle]').hidden = true; root.querySelectorAll('[data-uye][open]').forEach(d => d.open = false); ekleKutu.querySelector('#ku-a').focus(); };
  ekleKutu.querySelector('[data-eklevaz]').onclick = () => { ekleKutu.hidden = true; root.querySelector('[data-kisiekle]').hidden = false; };
  ekleKutu.querySelector('[data-yenisifre]').onclick = () => { ekleKutu.querySelector('#ku-s').value = geciciSifre(); };
  { const a = ekleKutu.querySelector('#ku-a'), k = ekleKutu.querySelector('#ku-k'); let elle = false; k?.addEventListener('input', () => { elle = true; }); a.addEventListener('input', () => { if (k && !elle) k.value = adNormal(a.value).replace(/[^a-z0-9._-]/g, '').slice(0, 30); }); }
  import('../guvenlik.js').then(async g => {
    const sg = await g.sonGirisler();
    root.querySelectorAll('[data-uye]').forEach(k => { const s = k.querySelector('[data-songiris]'); if (!s) return; const u = uyeler.find(x => x.eposta === k.dataset.uye), r = sg?.[k.dataset.uye.toLowerCase()] || (u?._sonGiris ? { son_giris: u._sonGiris } : null); if (!sg && !r) { s.remove(); return; } s.textContent = g.sonGirisMetni(r); });
    if (!sg && uyeler.length) root.querySelector('.uyeler')?.insertAdjacentHTML('afterend', '<p class="hint">Son giriş tarihlerini görmek için Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 11).</p>');
  });
  app.db.c.rpc('yetki_surum').then(({ data, error }) => { if (error || (data || 0) < 15) root.insertAdjacentHTML('afterbegin', '<p class="warn">Sunucu kuralları eski: kapalı ekranların fotoğrafları, belgeleri ve ayarları ekip üyesine hâlâ açılabilir. Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 15).</p>'); }, () => {});
  const yeni = root.querySelector('[data-yeni]');
  yetkiBagla(yeni); uyeRolBagla(yeni);
  yeni.onsubmit = async e => {
    e.preventDefault();
    const btn = yeni.querySelector('[type=submit]');
    const ad = yeni.querySelector('#ku-a').value.trim(), kad = adNormal(yeni.querySelector('#ku-k')?.value || ''), sifre = yeni.querySelector('#ku-s').value.trim();
    let eposta = yeni.querySelector('#ku-e').value.trim().toLowerCase();
    if (!ad) return toast('Kişinin adını yaz.', 'err');
    if (kadVar && !kullaniciAdiGecerli(kad)) return toast('Kullanıcı adı 3–30 karakter olmalı: küçük harf, rakam, nokta, tire.', 'err');
    if (eposta && !/^\S+@\S+\.\S+$/.test(eposta)) return toast('E-posta geçersiz; yoksa boş bırak.', 'err');
    if (eposta && eposta === (app.db.user()?.email || '').toLowerCase()) return toast('Kendini ekleyemezsin; sen zaten şirket yöneticisisin.', 'err');
    const secim = secimOku(yeni), alan = uyeYetkiAlanlari(yeni, secim); if (!alan.rol_id && !Object.values(secim).some(Boolean)) return toast('Bir rol seç ya da en az bir ekranı aç (Görür ya da Düzenler).', 'err');
    if (!/^(?=.*[a-zçğıöşü])(?=.*\d).{8,}$/i.test(sifre)) return toast('Geçici şifre en az 8 karakter olmalı, harf ve rakam içermeli.', 'err');
    btn.disabled = true;
    try {
      // 1) Hesap: kullanıcı adı ve geçici şifreyle (sunucudaki "kullanici" fonksiyonu). Yoksa e-postalı davete düşer.
      let hesapAcildi = false;
      if (kadVar) {
        const r = await hesapIslemi({ islem: 'olustur', kad, sifre, eposta: eposta || null });
        if (r?.tamam) { eposta = r.eposta; hesapAcildi = true; }
        else if (!(r?.kurulum && eposta)) return toast(r?.hata || 'Hesap açılamadı.', 'err');
        else toast(r.hata + ' Şimdilik e-postalı davetle ekleniyor.', 'err');
      } else if (!eposta) return toast('Sunucu güncel değil: e-posta yaz ya da schema.sql (sürüm 37) çalıştır.', 'err');
      // 2) Şirkete üye olarak ekle (rol, ekip, yetkiler)
      const { error } = await app.db.c.from('ekip_uyeleri').insert({ owner: app.db.sahip || app.db.user().id, eposta, ad, ...alan, ...disOku(yeni), ...(yeni.querySelector('[data-uyeekip]') ? { ekip_id: yeni.querySelector('[data-uyeekip]').value || null } : {}), aktif: true });
      if (error) return toast(/duplicate|unique/i.test(error.message) ? 'Bu kişi zaten ekli.' : 'Eklenemedi: ' + error.message, 'err');
      if (!hesapAcildi && kad) { const kh = await kadKaydet(eposta, kad, ''); if (kh) toast(kh, 'err'); }
      if (hesapAcildi) {
        yeni.hidden = true; girisBilgisiKutusu(ekleKutu.querySelector('[data-yenibilgi]'), { ad, kad, sifre });
        ekleKutu.querySelector('[data-yenibilgi]').insertAdjacentHTML('beforeend', '<div class="btnrow"><button type="button" class="btn ghost" data-tamam>Tamam, listeye dön</button></div>');
        ekleKutu.querySelector('[data-tamam]').onclick = () => yenile();
        toast('Hesap açıldı. Giriş bilgilerini kişiye gönder.');
      } else { toast('Kişi eklendi. Davet bağlantısını gönder.'); await yenile(); root.querySelector(`[data-uye="${CSS.escape(eposta)}"] summary`)?.click(); root.querySelector(`[data-uye="${CSS.escape(eposta)}"] [data-davet]`)?.click(); }
    } finally { if (btn.isConnected) btn.disabled = false; }
  };
  root.querySelectorAll('[data-uye]').forEach(k => {
    const u = uyeler.find(x => x.eposta === k.dataset.uye);
    k.querySelector('[data-kaydet]').onclick = async () => {
      const yon = !!k.querySelector('[data-yonetici]')?.checked;
      if (yon && !u.yonetici && !confirmBox(`${u.ad || u.eposta} şirket yöneticisi olsun mu? Her şeyi görür ve düzenler, kullanıcıları ve şirket ayarlarını yönetir.`)) return;
      const aktif = k.querySelector('[data-aktif]').checked;
      const { error } = await app.db.c.from('ekip_uyeleri').update({ ad: k.querySelector('[data-ad]').value.trim() || null, aktif, ...uyeYetkiAlanlari(k), ...disOku(k), ...(k.querySelector('[data-yonetici]') ? { yonetici: yon } : {}), ...(k.querySelector('[data-uyeekip]') ? { ekip_id: k.querySelector('[data-uyeekip]').value || null } : {}) }).eq('id', u.id);
      if (!error && u.aktif && !aktif && EKIPLER_DB && confirmBox(`${u.ad || u.eposta} pasife alındı. Sorumlusu olduğu kayıtlar (firma, proje, ziyaret, teklif…) başkasına devredilsin mi? Hayır dersen kayıtlar şirkette kalır, sonra da devredebilirsin.`)) await devret(u.eposta, null);
      if (!error) u.aktif = aktif;
      if (!error) { u.yonetici = yon; k.querySelector('.yon-r').hidden = !yon; }
      if (!error && k.querySelector('[data-kad]')) { const kh = await kadKaydet(u.eposta, k.querySelector('[data-kad]').value, u._kad); if (kh) return toast(kh, 'err'); u._kad = adNormal(k.querySelector('[data-kad]').value); }
      if (!error) { const y = rolOku(k); const rb = k.querySelector('.rol-r:not(.yon-r)'); if (rb) { rb.textContent = y; rb.hidden = !y; } }
      toast(error ? 'Kaydedilemedi: ' + error.message : 'Yetkiler kaydedildi. Kişi uygulamayı yeniden açınca geçerli olur.', error ? 'err' : '');
    };
    yetkiBagla(k); uyeRolBagla(k);
    k.querySelector('[data-devret]')?.addEventListener('click', () => {
      const kutu = k.querySelector('[data-devretk]'); kutu.hidden = !kutu.hidden; if (kutu.hidden) return;
      const hedefler = [...(app.ekipTum || []).filter(x => x.eposta !== u.eposta.toLowerCase())];
      kutu.innerHTML = `<div class="fld"><label>${esc(u.ad || u.eposta)} kişisinin sorumlu olduğu bütün kayıtlar kime geçsin?</label><select data-devhedef><option value="">Otomatik: ekip yöneticisine (yoksa kurucuya)</option>${hedefler.map(x => `<option value="${esc(x.eposta)}">${esc(x.ad)} · ${esc(x.eposta)}</option>`).join('')}</select></div><div class="btnrow"><button type="button" class="btn sm primary" data-devyap>Devret</button></div>`;
      kutu.querySelector('[data-devyap]').onclick = async () => { const h = kutu.querySelector('[data-devhedef]').value || null; if (!confirmBox(`${u.ad || u.eposta} kişisinin kayıtları ${h || 'ekip yöneticisine'} devredilsin mi?`)) return; await devret(u.eposta, h); kutu.hidden = true; };
    });
    k.querySelector('[data-onizle]').onclick = () => { if (!confirmBox(`${u.ad || u.eposta} bu ayarlarla ne görüyor, bunu kendi telefonunda göreceksin. Önizlemede değişiklik kaydedilmez; alttaki düğmeyle çıkarsın. Başlansın mı?`)) return; onizlemeBaslat({ ...u, yetkiler: yetkiOku(k) }); };
    k.querySelector('[data-sil]').onclick = async () => { if (!confirmBox(`${u.ad || u._kad || u.eposta} kullanıcılardan çıkarılsın mı? Artık verilerini göremez.`)) return; await app.db.c.from('ekip_uyeleri').delete().eq('id', u.id); toast('Kullanıcı çıkarıldı.'); yenile(); };
    k.querySelector('[data-sifirla]')?.addEventListener('click', async () => {
      if (!confirmBox(`${u.ad || u._kad} için yeni geçici şifre oluşturulsun mu? Eski şifresi geçersiz olur; ilk girişte yenisini belirler.`)) return;
      const sifre = geciciSifre(), r = await hesapIslemi({ islem: 'sifre', eposta: u.eposta, sifre });
      if (!r?.tamam) return toast(r?.hata || 'Sıfırlanamadı.', 'err');
      girisBilgisiKutusu(k.querySelector('[data-link]'), { ad: u.ad, kad: u._kad || u.eposta, sifre }); toast('Yeni geçici şifre oluşturuldu.');
    });
    k.querySelector('[data-hesapac]')?.addEventListener('click', async () => {
      const kad = adNormal(k.querySelector('[data-kad]')?.value || u._kad || '');
      if (!kullaniciAdiGecerli(kad)) return toast('Önce yukarıya bir kullanıcı adı yaz (3–30 karakter).', 'err');
      const sifre = geciciSifre(), r = await hesapIslemi({ islem: 'olustur', kad, sifre, eposta: SENTETIK.test(u.eposta) ? null : u.eposta });
      if (!r?.tamam) return toast(r?.hata || 'Hesap açılamadı.', 'err');
      if (r.eposta !== u.eposta.toLowerCase()) await app.db.c.from('ekip_uyeleri').update({ eposta: r.eposta }).eq('id', u.id);
      girisBilgisiKutusu(k.querySelector('[data-link]'), { ad: u.ad, kad, sifre }); toast('Hesap açıldı.');
    });
    k.querySelector('[data-davet]')?.addEventListener('click', () => {
      const l = davetLinki(u.eposta), metin = `Merhaba${u.ad ? ' ' + u.ad : ''}, Saha Takip uygulamasına davetlisin.\n1) Bu bağlantıyı telefonunda aç: ${l}\n2) "İlk giriş" sekmesinde ${u.eposta} adresin için kendine bir şifre belirle.\n3) E-postana onay bağlantısı gelirse ona dokun.\nSonraki girişlerde ${u._kad ? `kullanıcı adın "${u._kad}" ya da ` : ''}e-postan ve şifrenle girersin. Şifreni unutursan giriş ekranındaki "Şifremi unuttum"u kullan.`;
      const kutu = k.querySelector('[data-link]'); kutu.hidden = false;
      kutu.innerHTML = `<input readonly value="${esc(l)}" aria-label="Davet bağlantısı"><div class="btnrow"><button type="button" class="btn sm" data-kopya>Kopyala</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink('', metin)}">WhatsApp ile gönder</a><a class="btn sm ghost" href="mailto:${esc(u.eposta)}?subject=${encodeURIComponent('Saha Takip daveti')}&body=${encodeURIComponent(metin)}">E-posta</a></div>
        <p class="hint">Bağlantı yalnızca uygulamanın adresini ve veritabanı adresini içerir; şifre içermez. Kişi kendi şifresini belirler ve sadece yetki verdiğin bölümleri görür.</p>`;
      kutu.querySelector('[data-kopya]').onclick = async () => { try { await navigator.clipboard.writeText(l); toast('Bağlantı kopyalandı.'); } catch { kutu.querySelector('input').select(); } };
    });
  });
}
// ---------- Ekran ağacı: başlık → ekranlar, her biri Kapalı / Görür / Düzenler ----------
const GRUPLAR = BASLIKLAR.map(b => ({ ...b, r: b.r.filter(r => EKRANLAR[r]) })).filter(b => b.r.length);
const seg3 = (k, v) => `<span class="seg3" role="group" data-ek="${k}" aria-label="${esc(SEKME_AD[k] || k)}">${[['', 'Kapalı'], ['oku', 'Görür'], ...(EKRANLAR[k]?.salt ? [] : [['yaz', 'Düzenler']])].map(([d, t]) => `<button type="button" data-v="${d}" class="${(v || '') === d ? 'on' : ''}" aria-pressed="${(v || '') === d}">${t}</button>`).join('')}</span>`;
const grupSeg = g => `<span class="seg3 seg3-grup" role="group" data-grup="${g.k}" aria-label="${esc(g.t)} tümü">${[['', 'Kapalı'], ['oku', 'Görür'], ['yaz', 'Düzenler']].map(([d, t]) => `<button type="button" data-v="${d}">${t}</button>`).join('')}</span>`;
// Yetki paneli: sekmeler hâlinde Ekranlar · Kayıtlar ve gizlilik · (Açılış ve menü) · Özet. Bütün alanlar sayfada durur, yalnızca görünür olan değişir.
function yetkiDuzeni(y, { gorunum = false, g = {} } = {}) {
  const secim = ekranSecimi(y), gizli = y?._gizli || [], kp = y?._kapsam || 'tum';
  const SEK = [['ekran', 'Ekranlar'], ['kayit', 'Kayıtlar ve gizlilik'], ...(gorunum ? [['gorunum', 'Açılış ve menü']] : []), ['ozet', 'Özet']];
  return `<div class="yp" data-yp><div class="yp-sekme" role="tablist">${SEK.map(([k, t], i) => `<button type="button" role="tab" data-ypk="${k}" class="${i ? '' : 'on'}" aria-selected="${!i}">${t}${k === 'ekran' ? ' <small data-ypsay></small>' : ''}</button>`).join('')}</div>
    <div class="yp-ic" data-ypp="ekran">
      <div class="yp-ust"><p class="hint">Her ekran için seç: <b>Kapalı</b> (menüde yok, verisi telefona gelmez) · <b>Görür</b> · <b>Düzenler</b>.</p>
        <select data-sablon aria-label="Şablondan doldur"><option value="">Şablondan doldur…</option>${Object.keys(HAZIR).map(h => `<option>${esc(h)}</option>`).join('')}</select></div>
      <div class="ekran-agac">${GRUPLAR.map(gr => `<div class="ek-grup" data-g="${gr.k}"><div class="ek-gbas"><b>${esc(gr.t)}</b><small data-gsay></small>${gr.r.length > 1 ? grupSeg(gr) : ''}</div>
        ${gr.r.map(r => `<div class="ek-satir"><span>${esc(SEKME_AD[r] || r)}<small>${esc(EKRANLAR[r].d || '')}</small></span>${seg3(r, secim[r])}</div>`).join('')}</div>`).join('')}</div>
      <p class="hint">Bugün ekranı ve kişinin kendi Ayarlar'ı herkeste açıktır; içinde yalnızca açık ekranların kayıtları görünür.</p></div>
    <div class="yp-ic" data-ypp="kayit" hidden>
      <div class="fld"><label>Hangi kayıtları görsün?</label><span class="seg3 kapsam-seg" role="group" data-kapsam aria-label="Kayıt kapsamı">${KAPSAM.map(([v, t]) => `<button type="button" data-v="${v}" class="${kp === v ? 'on' : ''}" aria-pressed="${kp === v}">${t}</button>`).join('')}</span>
        <small class="muted">Tüm şirketin: açık ekranlardaki bütün kayıtlar · Ekibinin: kendi ekibi ve alt ekiplerinin kayıtları · Sadece kendinin: sorumlusu olduğu kayıtlar.</small></div>
      <div class="fld"><label>Açık ekranlarda da gizlensin</label>${GIZLENEBILIR.map(x => `<label class="chk"><input type="checkbox" data-gz="${x.k}" ${gizli.includes(x.k) ? 'checked' : ''}> <span><b>${esc(x.ad)}</b><small class="muted"> · ${esc(x.d)}</small></span></label>`).join('')}</div>
      <div class="fld"><label>Dışa aktarma</label>${disaKutusu(y?._disa === true)}<small class="muted">Kapalıyken Excel'e ya da sunuma aktaramaz. Yedek alma her zaman yalnızca şirket yöneticisinde.</small></div></div>
    ${gorunum ? `<div class="yp-ic" data-ypp="gorunum" hidden>${gorunumDuzeni(g)}</div>` : ''}
    <div class="yp-ic" data-ypp="ozet" hidden><div class="yetki-ozet" data-yozet aria-live="polite"></div></div></div>`;
}
const secimOku = kok => Object.fromEntries([...kok.querySelectorAll('[data-ek]')].map(s => [s.dataset.ek, s.querySelector('button.on')?.dataset.v || null]).filter(([, v]) => v));
const gizliOku = kok => [...kok.querySelectorAll('[data-gz]:checked')].map(i => i.dataset.gz);
const KAPSAM = [['tum', 'Tüm şirketin'], ['ekip', 'Ekibinin'], ['kendi', 'Sadece kendinin']];
const yetkiOku = (kok, secim = secimOku(kok)) => { const o = yetkiNesnesi(secim, { rol: rolOku(kok), disa: kok.querySelector('[data-disa]')?.checked, gizli: gizliOku(kok) }); const kp = kok.querySelector('[data-kapsam] button.on')?.dataset.v; if (kp && kp !== 'tum') o._kapsam = kp; return o; };
function secimYaz(kok, e, g) {
  kok.querySelectorAll('[data-ek]').forEach(s => { const v = e[s.dataset.ek] || ''; s.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-pressed', b.dataset.v === v); }); });
  if (g) kok.querySelectorAll('[data-gz]').forEach(i => i.checked = g.includes(i.dataset.gz));
  ozetYaz(kok);
}
const TABLO_AD = { projeler: 'Projeler', proje_gecmis: 'Proje durum geçmişi', firmalar: 'Firmalar', kisiler: 'Kişiler', ziyaretler: 'Ziyaretler', gorevler: 'Görevler', bolgeler: 'Sanayi bölgeleri', siparisler: 'Siparişler', hedefler: 'Hedefler', teklifler: 'Teklifler', urunler: 'Stok ve fiyatlar', stok_gecmis: 'Stok geçmişi', urun_aileleri: 'Ürün aileleri', rakip_fiyatlar: 'Rakip fiyatları', tahsilatlar: 'Tahsilat', numuneler: 'Numuneler', servis_kayitlari: 'Servis kayıtları', masraflar: 'Masraflar', belgeler: 'Dosyalar' };
function ozetYaz(kok) {
  const secim = secimOku(kok), kutu = kok.querySelector('[data-yozet]'); if (!kutu) return;
  kok.querySelectorAll('[data-g]').forEach(d => { const rs = [...d.querySelectorAll('[data-ek]')], acik = rs.filter(s => secim[s.dataset.ek]).length; d.querySelector('[data-gsay]').textContent = acik ? `${acik}/${rs.length} açık` : 'kapalı'; d.classList.toggle('kapali', !acik); });
  { const n = Object.values(secim).filter(Boolean).length, say = kok.querySelector('[data-ypsay]'); if (say) say.textContent = n ? `(${n} açık)` : '(hiçbiri)'; }
  const ad = k => SEKME_AD[k] || k, tum = Object.keys(EKRANLAR);
  const yaz = tum.filter(k => secim[k] === 'yaz'), oku = tum.filter(k => secim[k] === 'oku'), kapali = tum.filter(k => !secim[k]);
  const tablolar = ekranTablolari(secim), tl = Object.entries(tablolar);
  const g = gizliOku(kok).map(k => GIZLENEBILIR.find(x => x.k === k)?.ad).filter(Boolean);
  kutu.innerHTML = !yaz.length && !oku.length ? '<b>Henüz hiçbir ekran açık değil.</b> Kişi giriş yapınca yalnızca boş bir Bugün ekranı görür.'
    : `${yaz.length ? `<div><b>Düzenler:</b> ${esc(yaz.map(ad).join(', '))}</div>` : ''}${oku.length ? `<div><b>Yalnızca görür:</b> ${esc(oku.map(ad).join(', '))}</div>` : ''}
      <div class="kapali"><b>Hiç görmez:</b> ${esc(kapali.map(ad).join(', ') || '—')}, Veri kontrolü, kullanıcılar ve senin ayarların</div>
      <div><b>Kayıtlar:</b> ${esc(KAPSAM.find(x => x[0] === (kok.querySelector('[data-kapsam] button.on')?.dataset.v || 'tum'))?.[1] || 'Tüm şirketin')}</div>
      ${g.length ? `<div><b>Ayrıca gizli:</b> ${esc(g.join(', '))}</div>` : ''}
      <details><summary>Telefonuna gelen kayıtlar (${tl.length})</summary><p class="hint">Açık ekranların çalışması için gereken kayıtlar sunucudan bu kişiye gönderilir; listede olmayanlar hiçbir şekilde gönderilmez.</p>${esc(tl.map(([t, v]) => (TABLO_AD[t] || t) + (v === 'yaz' ? ' (düzenler)' : ' (görür)')).join(', '))}</details>`;
}
function yetkiBagla(kok) {
  kok.querySelectorAll('[data-yp]').forEach(yp => yp.querySelectorAll('[data-ypk]').forEach(b => b.onclick = () => { yp.querySelectorAll('[data-ypk]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); yp.querySelectorAll('[data-ypp]').forEach(p => p.hidden = p.dataset.ypp !== b.dataset.ypk); }));
  kok.querySelectorAll('[data-sablon]').forEach(s => s.onchange = () => { const h = HAZIR[s.value]; if (!h) return; secimYaz(kok, h.e, h.g); const ad = kok.querySelector('[data-rolad]'); if (ad && !ad.value.trim()) ad.value = s.value; toast(`“${s.value}” şablonu uygulandı; istediğin ekranı değiştirebilirsin.`); s.value = ''; });
  kok.querySelectorAll('[data-ek] button').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); ozetYaz(kok); });
  kok.querySelectorAll('[data-grup] button').forEach(b => b.onclick = () => {
    const d = b.closest('[data-g]'); d.querySelectorAll('[data-ek]').forEach(s => { const v = b.dataset.v === 'yaz' && EKRANLAR[s.dataset.ek]?.salt ? 'oku' : b.dataset.v; s.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.v === v); x.setAttribute('aria-pressed', x.dataset.v === v); }); });
    ozetYaz(kok);
  });
  kok.querySelectorAll('[data-kapsam] button').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); ozetYaz(kok); });
  kok.querySelectorAll('[data-gz]').forEach(i => i.onchange = () => ozetYaz(kok));
  ozetYaz(kok);
}
const disaKutusu = v => `<label class="chk"><input type="checkbox" data-disa ${v ? 'checked' : ''}> <span>Excel'e aktarabilir ve sunum çıktısı alabilir</span></label>`;
// Kullanıcı adı değiştiyse kaydeder; hata metni döner
async function kadKaydet(eposta, deger, eski) {
  const ad = adNormal(deger || '');
  if (ad === (eski || '')) return null;
  if (!ad) { await app.db.c.from('kullanici_adlari').delete().eq('eposta', eposta.toLowerCase()); return null; }
  if (!kullaniciAdiGecerli(ad)) return 'Kullanıcı adı 3–30 karakter olmalı: küçük harf, rakam, nokta, tire.';
  return kullaniciAdiKaydet(eposta, ad);
}
const basHarf = t => esc(String(t || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toLocaleUpperCase('tr') || '?');
function uyeKarti(u, kadVar) {
  const durum = !u.aktif ? ['Pasif', 'pasif'] : u._hesap === false ? ['Hesabı yok', 'uyari'] : u._hesap && !u._sonGiris ? ['İlk girişi bekliyor', 'bekle'] : ['Aktif', 'ok'];
  const ekip = u.ekip_id ? ekipYolu(u.ekip_id) : '', sentetik = SENTETIK.test(u.eposta);
  return `<details class="uye uye-satir" data-uye="${esc(u.eposta)}" data-durum="${durum[1]}" data-ara="${esc([u.ad, u._kad, u.eposta, rolAl(u), ekip].join(' ').toLocaleLowerCase('tr'))}"><summary><span class="uye-ad"><i class="uye-av" aria-hidden="true">${basHarf(u.ad || u._kad || u.eposta)}</i><span><b>${esc(u.ad || u._kad || u.eposta)}</b><em class="rol-r yon-r" ${u.yonetici ? '' : 'hidden'}>Şirket yöneticisi</em><small class="muted">${sentetik ? 'e-postasız hesap' : esc(u.eposta)}</small></span></span>
    <span class="uye-kad">${u._kad ? esc(u._kad) : '<small class="muted">—</small>'}</span><span class="uye-rol"><em class="rol-r" ${rolAl(u) ? '' : 'hidden'}>${esc(rolAl(u))}</em>${rolAl(u) ? '' : '<small class="muted">rol yok</small>'}${ekip ? `<small class="muted">${esc(ekip)}</small>` : ''}</span>
    <span class="uye-durum"><em class="durum-r ${durum[1]}">${durum[0]}</em><small class="muted" data-songiris>…</small></span></summary>
    <div class="uye-ic">
      <section class="uye-b"><h4>Kişi</h4><div class="grid"><div class="fld"><label>Ad soyad</label><input data-ad value="${esc(u.ad || '')}"></div>${kadVar ? `<div class="fld"><label>Kullanıcı adı</label><input data-kad autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. ali.yilmaz" value="${esc(u._kad || '')}"><small>Girişte bunu yazar.</small></div>` : ''}</div>
        <p class="muted uye-eposta">${sentetik ? 'E-postası yok; şifresini sen sıfırlarsın.' : 'E-posta: ' + esc(u.eposta)}</p>
        <label class="chk"><input type="checkbox" data-aktif ${u.aktif ? 'checked' : ''}> <span>Erişimi açık <small class="muted">· kapatırsan giriş yapamaz, kayıtları şirkette kalır</small></span></label></section>
      <section class="uye-b"><h4>Rol ve ekip</h4><div class="grid">${ROLLER_DB ? uyeRolSecici(u) : `<div class="fld"><label>Rol / ünvan</label>${rolSecici(rolAl(u))}</div>`}${ekipSecici(u)}${disSecici(u)}</div>
        ${'yonetici' in u ? `<label class="chk yon-chk"><input type="checkbox" data-yonetici ${u.yonetici ? 'checked' : ''}> <span><b>Şirket yöneticisi</b><small class="muted"> · her şeyi görür ve düzenler, kullanıcıları ve şirket ayarlarını yönetir</small></span></label>` : ''}</section>
      <section class="uye-b"><h4>Ne görür?</h4><div data-rolbilgi></div><div data-agac>${yetkiDuzeni(u.yetkiler)}</div></section>
      <section class="uye-b"><h4>Giriş</h4><p class="hint" data-girisdurum>${u._hesap === false ? 'Bu kişinin henüz hesabı yok. Kullanıcı adı yazıp hesap aç; giriş bilgilerini WhatsApp ile gönderirsin.' : u._hesap && !u._sonGiris ? 'Hesabı açık, henüz giriş yapmadı. Giriş bilgilerini kaybettiyse yeni geçici şifre oluştur.' : 'Şifresini unutursa yeni geçici şifre oluştur; ilk girişte kendi şifresini belirler.'}</p>
        <div class="btnrow">${u._hesap === false ? `<button type="button" class="btn sm" data-hesapac>Kullanıcı adıyla hesap aç</button>` : u._hesap ? '<button type="button" class="btn sm" data-sifirla>Yeni geçici şifre</button>' : ''}${sentetik ? '' : '<button type="button" class="btn sm ghost" data-davet>E-posta daveti</button>'}</div>
        <div data-link class="davet-kutu" hidden></div></section>
    </div>
    <div class="uye-alt"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button><button type="button" class="btn sm ghost" data-onizle>Bu kişi gibi gör</button><span class="grow"></span>${EKIPLER_DB ? '<button type="button" class="btn sm ghost" data-devret>Kayıtlarını devret</button>' : ''}<button type="button" class="btn sm ghost danger" data-sil>Çıkar</button></div><div class="devret-kutu" data-devretk hidden></div></details>`;
}

// ---------- Şirket: adı, kurucusu, yöneticileri ----------
async function sirketKarti(root) {
  const { data: b, error } = await app.db.c.rpc('sirket_bilgisi');
  if (error || !b) { if (error && /function|schema cache/i.test(error.message)) root.insertAdjacentHTML('afterbegin', '<p class="warn">Şirket yönetimi için Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 25).</p>'); return; }
  const kutu = document.createElement('section'); kutu.className = 'sirket-kart';
  const yon = [{ eposta: b.kurucu_eposta, ad: 'Kurucu', kurucu: true }, ...(b.yoneticiler || [])].filter(x => x.eposta && !(x.kurucu && b.kurucu_ayrildi));
  kutu.innerHTML = `<h3>Şirket</h3>
    <div class="fld"><label for="sk-ad">Şirket adı</label><div class="satir-btn"><input id="sk-ad" value="${esc(b.ad || '')}" placeholder="Şirketinin adı"><button type="button" class="btn sm" data-sk-ad>Kaydet</button></div></div>
    <p class="hint">Şirket kişiden bağımsızdır: kayıtlar şirkete aittir. Birden fazla yönetici olabilir; kurucu ayrılsa da şirket ve kayıtları yönetici(ler)le devam eder. ${b.kullanici_sayisi} aktif kullanıcı.</p>
    <div class="fld"><label>Şirket yöneticileri</label><ul class="list sk-yon">${yon.map(x => `<li><span class="grow"><b>${esc(x.ad && !x.kurucu ? x.ad : x.eposta)}</b><small class="muted"> ${esc(x.kurucu ? 'kurucu · ' + x.eposta : x.eposta)}</small></span></li>`).join('')}</ul>
      <p class="hint">Yönetici eklemek için Kullanıcılar sekmesinde kişiyi açıp “Şirket yöneticisi” kutusunu işaretle.</p></div>
    ${b.ben_kurucu ? '' : b.kurucu_ayrildi
      ? `<p class="warn">Kurucu (${esc(b.kurucu_eposta || '')}) şirketten ayrıldı olarak işaretli; şirkete giremez.</p><button type="button" class="btn sm ghost" data-sk-kurucu="0">Kurucuyu geri al</button>`
      : `<button type="button" class="btn sm ghost danger" data-sk-kurucu="1">Kurucu şirketten ayrıldı</button>`}`;
  root.prepend(kutu);
  kutu.querySelector('[data-sk-ad]').onclick = async () => { const { error: e } = await app.db.c.rpc('sirket_adi', { p_ad: kutu.querySelector('#sk-ad').value }); toast(e ? 'Kaydedilemedi: ' + e.message : 'Şirket adı kaydedildi.', e ? 'err' : ''); };
  kutu.querySelector('[data-sk-kurucu]')?.addEventListener('click', async ev => {
    const ayrildi = ev.target.dataset.skKurucu === '1';
    if (ayrildi && !confirmBox(`Kurucu (${b.kurucu_eposta}) şirketten ayrıldı olarak işaretlensin mi? Artık şirkete giremez; kayıtları şirkette kalır.`)) return;
    const { error: e } = await app.db.c.rpc('kurucu_ayrildi', { p_ayrildi: ayrildi });
    if (e) return toast(e.message, 'err');
    toast(ayrildi ? 'Kurucu ayrıldı olarak işaretlendi.' : 'Kurucu geri alındı.'); kutu.remove(); sirketKarti(root);
  });
}

// ---------- Rol görünümü: açılış ekranı, alt menü, Bugün kartları ----------
const ANA_SINIR = 5;
function gorunumDuzeni(g = {}) {
  const rotalar = Object.keys(SEKME_AD).filter(k => k === 'bugun' || EKRANLAR[k] || ['talepler', 'plan', 'ekiphar', 'rakipanaliz'].includes(k));
  const menu = g.menu || [], gizli = g.kartGizli || [];
  return `<div class="gorunum" data-gorunum>
    <p class="hint">Bu roldeki kişi uygulamayı açınca ne görsün? Kişi kendi menüsünü ve Bugün kartlarını sonradan değiştirebilir.</p>
    <div class="grid"><div class="fld"><label>Açılış ekranı</label><select data-gacilis aria-label="Açılış ekranı"><option value="">Bugün</option>${rotalar.filter(k => k !== 'bugun').map(k => `<option value="${k}" ${g.acilis === k ? 'selected' : ''}>${esc(SEKME_AD[k])}</option>`).join('')}</select><small>Ekran rolde kapalıysa Bugün açılır.</small></div></div>
    <div class="fld"><label>Alt menü (telefonda en fazla ${ANA_SINIR})</label><div class="chips gor-chips">${BASLIKLAR.map(b => `<label class="chip-chk"><input type="checkbox" data-gmenu="${b.k}" ${menu.includes(b.k) ? 'checked' : ''}><span>${esc(b.t)}</span></label>`).join('')}</div><small>Hiçbiri seçilmezse varsayılan menü. Rolde kapalı başlıklar kişide zaten görünmez.</small></div>
    <div class="fld"><label>Bugün ekranındaki kartlar</label><div class="chips gor-chips">${BUGUN_KARTLAR.map(([k, t]) => `<label class="chip-chk"><input type="checkbox" data-gkart="${k}" ${gizli.includes(k) ? '' : 'checked'}><span>${esc(t)}</span></label>`).join('')}</div></div></div>`;
}
function gorunumOku(k) {
  const f = k.querySelector('[data-gorunum]'); if (!f) return undefined;
  const acilis = f.querySelector('[data-gacilis]').value || null;
  const menu = [...f.querySelectorAll('[data-gmenu]:checked')].map(i => i.dataset.gmenu).slice(0, ANA_SINIR);
  const kartGizli = [...f.querySelectorAll('[data-gkart]:not(:checked)')].map(i => i.dataset.gkart);
  return acilis || menu.length || kartGizli.length ? { ...(acilis ? { acilis } : {}), ...(menu.length ? { menu } : {}), ...(kartGizli.length ? { kartGizli } : {}) } : undefined;
}
function gorunumBagla(k) {
  k.querySelectorAll('[data-gmenu]').forEach(i => i.onchange = () => { const s = k.querySelectorAll('[data-gmenu]:checked'); if (s.length > ANA_SINIR) { i.checked = false; toast(`Alt menüye en fazla ${ANA_SINIR} başlık sığar.`, 'err'); } });
}

// ---------- K2: Roller ----------
function rolBolumu(uyeler) {
  if (!ROLLER_DB) return '';
  const kisiler = id => uyeler.filter(u => u.rol_id === id && u.aktif);
  const kisa = r => { const s = ekranSecimi(r.yetkiler || {}), v = Object.values(s); const y = v.filter(x => x === 'yaz').length, o = v.filter(x => x === 'oku').length; return [y ? `${y} ekran düzenler` : '', o ? `${o} ekran görür` : '', { ekip: 'ekibinin kayıtları', kendi: 'yalnız kendi kayıtları' }[r.yetkiler?._kapsam] || ''].filter(Boolean).join(' · ') || 'hiçbir ekran açık değil'; };
  const eksikHazir = HAZIR_ROLLER.filter(h => !ROLLER_DB.some(r => r.ad === h));
  return `<section class="roller-bol">
    <div class="kul-ust"><p class="kul-say"><b>${ROLLER_DB.length}</b> rol</p><div class="btnrow">${eksikHazir.length ? `<button type="button" class="btn sm ghost" data-hazirrol title="${esc(eksikHazir.join(', '))}">Hazır rolleri ekle (${eksikHazir.length})</button>` : ''}<button type="button" class="btn primary" data-rolac>+ Yeni rol</button></div></div>
    <div class="card-ic rol-yeni" data-yenirolk hidden><div class="form" data-rol="" data-yenirol><h3>Yeni rol</h3>
      <div class="grid"><div class="fld"><label>Rol adı</label><input data-rolad placeholder="ör. Satış Adana"></div><div class="fld"><label>Açıklama</label><input data-rolacik placeholder="isteğe bağlı"></div></div>
      ${yetkiDuzeni({}, { gorunum: true })}<div class="btnrow"><button type="button" class="btn primary" data-rolekle>Rolü ekle</button><button type="button" class="btn ghost" data-rolvaz>Vazgeç</button></div></div></div>
    <div class="roller">${ROLLER_DB.map(r => { const k = kisiler(r.id); return `<details class="uye rol-k" data-rol="${r.id}"><summary><span class="uye-ad"><i class="uye-av rol-av" aria-hidden="true">${basHarf(r.ad)}</i><span><b>${esc(r.ad)}</b><small class="muted">${esc(r.aciklama || kisa(r))}</small></span></span><span class="rol-kisi"><span><b>${k.length}</b> kişi</span>${k.length ? `<small class="muted">${esc(k.slice(0, 3).map(u => u.ad || u._kad || u.eposta).join(', '))}${k.length > 3 ? '…' : ''}</small>` : ''}</span></summary>
      <div class="uye-ic"><div class="grid"><div class="fld"><label>Rol adı</label><input data-rolad value="${esc(r.ad)}"></div><div class="fld"><label>Açıklama</label><input data-rolacik value="${esc(r.aciklama || '')}" placeholder="ör. faturalar ve tahsilat"></div></div>
      ${yetkiDuzeni(r.yetkiler, { gorunum: true, g: r.yetkiler?._gorunum })}</div>
      <div class="uye-alt"><button type="button" class="btn sm primary" data-rolkaydet>Kaydet</button><button type="button" class="btn sm ghost" data-rolgor>Bu rol gibi gör</button><span class="grow"></span><button type="button" class="btn sm ghost danger" data-rolsil>Sil</button></div></details>`; }).join('') || '<p class="hint">Henüz rol yok. “Hazır rolleri ekle” ile başla ya da yeni rol oluştur.</p>'}</div></section>`;
}
function rolleriBagla(root, uyeler, yenile0) {
  const bol = root.querySelector('.roller-bol'); if (!bol) return;
  const sahip = app.db.sahip || app.db.user().id;
  const yenile = yenile0 || (() => kullaniciAyarlari(root, 'roller'));
  // Rolün kaydı: kişilere yayılması sunucuda olur; eski sunucu ya da deneme için burada da yazılır
  const roldekiler = async id => { const { data } = await app.db.c.from('ekip_uyeleri').select('id,rol_id,ozel,aktif').eq('owner', sahip); return (data || []).filter(u => u.rol_id === id); };
  const yay = async (r) => { for (const u of (await roldekiler(r.id)).filter(u => !u.ozel)) await app.db.c.from('ekip_uyeleri').update({ yetkiler: { ...r.yetkiler, _rol: r.ad } }).eq('id', u.id); };
  bol.querySelectorAll('[data-rol]').forEach(k => { yetkiBagla(k); gorunumBagla(k); });
  const yk = bol.querySelector('[data-yenirolk]'), ac = bol.querySelector('[data-rolac]');
  ac.onclick = () => { yk.hidden = false; ac.hidden = true; bol.querySelectorAll('.rol-k[open]').forEach(d => d.open = false); yk.querySelector('[data-rolad]').focus(); };
  bol.querySelector('[data-rolvaz]').onclick = () => { yk.hidden = true; ac.hidden = false; };
  bol.querySelectorAll('.rol-k').forEach(k => {
    const r = ROLLER_DB.find(x => x.id === k.dataset.rol);
    k.querySelector('[data-rolkaydet]').onclick = async () => {
      const ad = k.querySelector('[data-rolad]').value.trim(); if (!ad) return toast('Rol adı yaz.', 'err');
      const yeni = { ad, aciklama: k.querySelector('[data-rolacik]').value.trim() || null, yetkiler: { ...yetkiOku(k), _rol: undefined, _gorunum: gorunumOku(k) } }; delete yeni.yetkiler._rol; if (!yeni.yetkiler._gorunum) delete yeni.yetkiler._gorunum;
      const n = (await roldekiler(r.id)).filter(u => !u.ozel && u.aktif).length;
      if (n && !confirmBox(`“${ad}” rolündeki ${n} kişinin yetkileri birlikte değişecek. Devam edilsin mi?`)) return;
      const { error } = await app.db.c.from('roller').update(yeni).eq('id', r.id);
      if (error) return toast(/unique|duplicate/i.test(error.message) ? 'Bu adda bir rol zaten var.' : 'Kaydedilemedi: ' + error.message, 'err');
      await yay({ ...r, ...yeni }); toast(n ? `Rol kaydedildi; ${n} kişi güncellendi.` : 'Rol kaydedildi.'); yenile();
    };
    k.querySelector('[data-rolgor]').onclick = () => { if (!confirmBox(`“${r.ad}” rolündeki biri ne görüyor, bunu kendi telefonunda göreceksin. Önizlemede değişiklik kaydedilmez. Başlansın mı?`)) return; onizlemeBaslat({ eposta: 'rol:' + r.ad, ad: r.ad + ' rolü', yetkiler: { ...yetkiOku(k), _rol: r.ad, ...(gorunumOku(k) ? { _gorunum: gorunumOku(k) } : {}) } }); };
    k.querySelector('[data-rolsil]').onclick = async () => {
      const liste = await roldekiler(r.id), n = liste.length;
      if (!confirmBox(n ? `“${r.ad}” rolünde ${n} kişi var. Rol silinirse bu kişiler şimdiki yetkilerini korur ama rolsüz kalır. Silinsin mi?` : `“${r.ad}” rolü silinsin mi?`)) return;
      for (const u of liste) await app.db.c.from('ekip_uyeleri').update({ rol_id: null, ozel: true }).eq('id', u.id);
      const { error } = await app.db.c.from('roller').delete().eq('id', r.id); if (error) return toast('Silinemedi: ' + error.message, 'err');
      toast('Rol silindi.'); yenile();
    };
  });
  const yr = bol.querySelector('[data-yenirol]');
  yr.querySelector('[data-rolekle]').onclick = async () => {
    const ad = yr.querySelector('[data-rolad]').value.trim(); if (!ad) return toast('Rol adı yaz.', 'err');
    const y = yetkiOku(yr); delete y._rol; const gr = gorunumOku(yr); if (gr) y._gorunum = gr;
    const { error } = await app.db.c.from('roller').insert({ owner: sahip, ad, aciklama: yr.querySelector('[data-rolacik]').value.trim() || null, yetkiler: y, sira: ROLLER_DB.length });
    if (error) return toast(/unique|duplicate/i.test(error.message) ? 'Bu adda bir rol zaten var.' : 'Eklenemedi: ' + error.message, 'err');
    toast('Rol eklendi. Kullanıcı kartından bu rolü verebilirsin.'); yenile();
  };
  bol.querySelector('[data-hazirrol]')?.addEventListener('click', async () => {
    const eksik = HAZIR_ROLLER.filter(h => !ROLLER_DB.some(r => r.ad === h));
    for (const [i, h] of eksik.entries()) { const t = HAZIR[h]; await app.db.c.from('roller').insert({ owner: sahip, ad: h, yetkiler: yetkiNesnesi(t.e, { gizli: t.g }), sira: ROLLER_DB.length + i }); }
    toast(`${eksik.length} hazır rol eklendi. İstersen her birini açıp düzenleyebilirsin.`); yenile();
  });
}

// ---------- K3: Kayıt devri ----------
async function devret(kimden, kime) {
  const { data, error } = await app.db.c.rpc('kayit_devret', { p_kimden: kimden, p_kime: kime });
  if (error) return toast('Devredilemedi: ' + error.message, 'err');
  toast(data?.toplam ? `${data.toplam} kayıt ${data.kime} kişisine devredildi.` : 'Devredilecek kayıt yok.');
  try { await app.db.loadAll?.(); app.refresh?.(); } catch {}
}
// ---------- K3: Ekipler ----------
function ekipBolumu(uyeler) {
  if (!EKIPLER_DB) return '';
  const say = id => uyeler.filter(u => u.ekip_id === id && u.aktif).length;
  const yonSec = sec => `<option value="">Yönetici yok</option>${(app.ekipTum || []).map(x => `<option value="${esc(x.eposta)}" ${sec && x.eposta === sec.toLowerCase() ? 'selected' : ''}>${esc(x.ad)} · ${esc(x.eposta)}</option>`).join('')}${sec && !(app.ekipTum || []).some(x => x.eposta === sec.toLowerCase()) ? `<option selected>${esc(sec)}</option>` : ''}`;
  const dal = (ustId, d = 0) => EKIPLER_DB.filter(e => (e.ust_ekip_id || null) === ustId).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(e => `<details class="uye ekip-k" data-ekip="${e.id}" style="margin-left:${Math.min(d, 4) * 16}px"><summary><span class="uye-ad"><b>${d ? '↳ ' : ''}${esc(e.ad)}</b><small class="muted">${say(e.id)} kişi${e.yonetici_eposta ? ' · yönetici: ' + esc((app.ekipTum || []).find(x => x.eposta === e.yonetici_eposta.toLowerCase())?.ad || e.yonetici_eposta) : ''}</small></span></summary>
      <div class="grid"><div class="fld"><label>Ekip adı</label><input data-ekad value="${esc(e.ad)}"></div><div class="fld"><label>Üst ekip</label><select data-ekust><option value="">Yok (en üst)</option>${ekipSecenekleri(e.ust_ekip_id, e.id)}</select></div><div class="fld"><label>Ekip yöneticisi</label><select data-ekyon>${yonSec(e.yonetici_eposta)}</select><small>Yönetici, rolü ne olursa olsun bu ekibin ve alt ekiplerinin kayıtlarını görür.</small></div></div>
      <div class="btnrow"><button type="button" class="btn sm primary" data-ekkaydet>Kaydet</button><button type="button" class="btn sm ghost danger" data-eksil>Sil</button></div></details>${dal(e.id, d + 1)}`).join('');
  return `<section class="ekipler-bol"><h3>Ekipler <span class="muted">${EKIPLER_DB.length}</span></h3>
    <p class="hint">Ekip ya da departman (ör. Satış → Satış Adana, Muhasebe). Kullanıcıyı kartından bir ekibe koy; kapsamı “Ekibinin” olan rol, ekibin ve alt ekiplerinin kayıtlarını görür.</p>
    <div class="ekipler">${dal(null) || '<p class="hint">Henüz ekip yok.</p>'}</div>
    <details class="card-ic"><summary><b>Yeni ekip</b></summary><div class="form" data-yeniekip><div class="grid"><div class="fld"><label>Ekip adı</label><input data-ekad placeholder="ör. Satış Adana"></div><div class="fld"><label>Üst ekip</label><select data-ekust><option value="">Yok (en üst)</option>${ekipSecenekleri(null)}</select></div><div class="fld"><label>Ekip yöneticisi</label><select data-ekyon>${yonSec(null)}</select></div></div><div class="btnrow"><button type="button" class="btn primary" data-ekekle>Ekibi ekle</button></div></div></details></section>`;
}
function ekipleriBagla(root, yenile0) {
  const bol = root.querySelector('.ekipler-bol'); if (!bol) return;
  const sahip = app.db.sahip || app.db.user().id, yenile = yenile0 || (() => kullaniciAyarlari(root, 'ekipler'));
  const oku = k => ({ ad: k.querySelector('[data-ekad]').value.trim(), ust_ekip_id: k.querySelector('[data-ekust]').value || null, yonetici_eposta: k.querySelector('[data-ekyon]').value || null });
  bol.querySelectorAll('.ekip-k').forEach(k => {
    const id = k.dataset.ekip;
    k.querySelector('[data-ekkaydet]').onclick = async () => { const o = oku(k); if (!o.ad) return toast('Ekip adı yaz.', 'err'); const { error } = await app.db.c.from('ekipler').update(o).eq('id', id); if (error) return toast(/unique|duplicate/i.test(error.message) ? 'Bu adda bir ekip zaten var.' : 'Kaydedilemedi: ' + error.message, 'err'); toast('Ekip kaydedildi.'); yenile(); };
    k.querySelector('[data-eksil]').onclick = async () => { if (!confirmBox('Ekip silinsin mi? Üyeleri ve kayıtları ekipsiz kalır, alt ekipler en üste çıkar.')) return; const { error } = await app.db.c.from('ekipler').delete().eq('id', id); if (error) return toast('Silinemedi: ' + error.message, 'err'); toast('Ekip silindi.'); yenile(); };
  });
  const y = bol.querySelector('[data-yeniekip]');
  y.querySelector('[data-ekekle]').onclick = async () => { const o = oku(y); if (!o.ad) return toast('Ekip adı yaz.', 'err'); const { error } = await app.db.c.from('ekipler').insert({ owner: sahip, ...o }); if (error) return toast(/unique|duplicate/i.test(error.message) ? 'Bu adda bir ekip zaten var.' : 'Eklenemedi: ' + error.message, 'err'); toast('Ekip eklendi.'); yenile(); };
}
