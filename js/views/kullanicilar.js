// Kullanıcılar ve yetkiler (yalnızca veri sahibi görür): ekip üyesi ekleme, bölüm bazında yetki, davet bağlantısı
import { getConfig } from '../db.js';
import { app } from '../state.js';
import { esc, toast, confirmBox, waLink } from '../ui.js';
import { EKRANLAR, GIZLENEBILIR, ekranSecimi, ekranTablolari, yetkiNesnesi, onizlemeBaslat } from '../yetki.js';
import { BASLIKLAR, SEKME_AD } from '../basliklar.js';
import { kullaniciAdiKaydet, adNormal, kullaniciAdiGecerli } from '../giris.js';

// Kişinin rolü (Bayi, Ekip arkadaşı…) yetkiler içindeki “_rol” anahtarında saklanır; veritabanı yetki kontrolü bu anahtarı kullanmaz.
export const ROLLER = ['Bayi', 'Ekip arkadaşı', 'Satış temsilcisi', 'Yönetici', 'Proje firması', 'Elektrik müteahhidi', 'Diğer'];
export const rolAl = u => u?.yetkiler?._rol || '';
const rolListesi = () => '';
// Rol seçimi: liste + “Başka…” (serbest yazı)
const rolSecici = (deger, id = '') => { const v = deger || ''; const ozel = v && !ROLLER.includes(v); return `<div class="rol-sec"><select data-rolsec ${id ? `id="${id}"` : ''} aria-label="Rol"><option value="">Rol seç</option>${ROLLER.map(r => `<option ${r === v ? 'selected' : ''}>${r}</option>`).join('')}<option value="__baska" ${ozel ? 'selected' : ''}>Başka (yaz)…</option></select><input data-rolyaz placeholder="Rolü yaz" value="${ozel ? v.replace(/"/g, '&quot;') : ''}" ${ozel ? '' : 'hidden'} maxlength="40"></div>`; };
const rolOku = kok => { if (kok.dataset?.rol) return kok.querySelector('[data-rolad]')?.value.trim() || ''; const r = kok.querySelector('[data-uyerol]'); if (r) return ROLLER_DB?.find(x => x.id === r.value)?.ad || ''; const s = kok.querySelector('[data-rolsec]'); if (!s) return ''; return s.value === '__baska' ? kok.querySelector('[data-rolyaz]').value.trim() : s.value; };
// K2: şirketin rolleri (sunucuda "roller" tablosu). null = tablo yok (eski şema) → eski rol etiketi kullanılır
let ROLLER_DB = null;
const uyeRolSecici = (u = {}) => `<div class="fld"><label>Rol</label><select data-uyerol aria-label="Rol"><option value="">Rol yok (kişiye özel ayar)</option>${ROLLER_DB.map(r => `<option value="${r.id}" ${u.rol_id === r.id ? 'selected' : ''}>${esc(r.ad)}</option>`).join('')}</select>
  <label class="chk" data-ozel-l ${u.rol_id ? '' : 'hidden'}><input type="checkbox" data-ozel ${u.ozel ? 'checked' : ''}> <span>Bu kişiye özel ayar yap <small class="muted">(rol değişince bu kişi etkilenmez)</small></span></label></div>`;
// Rol seçimine göre ekran ağacını göster/gizle; rolden gelen ayarı ağaca yazar
function uyeRolBagla(k) {
  const sel = k.querySelector('[data-uyerol]'); if (!sel) return;
  const agac = k.querySelector('[data-agac]'), ozel = k.querySelector('[data-ozel]'), ozelL = k.querySelector('[data-ozel-l]'), bilgi = k.querySelector('[data-rolbilgi]');
  const guncelle = (yaz) => {
    const r = ROLLER_DB.find(x => x.id === sel.value);
    ozelL.hidden = !r; const kendi = !r || ozel.checked;
    agac.hidden = !kendi;
    if (r && yaz) { secimYaz(k, ekranSecimi(r.yetkiler), r.yetkiler._gizli || []); const d = k.querySelector('[data-disa]'); if (d) d.checked = r.yetkiler._disa === true; }
    if (bilgi) bilgi.innerHTML = r && !ozel.checked ? `<p class="hint"><b>${esc(r.ad)}</b> rolünün yetkileri geçerli: ${esc(rolOzeti(r)) || 'hiçbir ekran açık değil'}. Rolü değiştirmek için yukarıdaki Roller bölümünü kullan.</p>` : '';
  };
  sel.onchange = () => guncelle(true); ozel.onchange = () => guncelle(true);
  guncelle(false);
}
const rolOzeti = r => { const s = ekranSecimi(r.yetkiler || {}); return Object.keys(EKRANLAR).filter(k => s[k]).map(k => (SEKME_AD[k] || k) + (s[k] === 'yaz' ? '' : ' (görür)')).join(', '); };
// Kaydedilecek kullanıcı alanları (rol, kişiye özel, yetkiler)
function uyeYetkiAlanlari(k, secim) {
  const sel = k.querySelector('[data-uyerol]');
  if (!sel) return { yetkiler: yetkiOku(k, secim) };
  const r = ROLLER_DB.find(x => x.id === sel.value), ozel = !!r && !!k.querySelector('[data-ozel]')?.checked;
  if (r && !ozel) return { rol_id: r.id, ozel: false, yetkiler: { ...r.yetkiler, _rol: r.ad } };
  return { rol_id: r?.id || null, ozel, yetkiler: yetkiOku(k, secim) };
}
const rolBagla = kok => kok.querySelectorAll('[data-rolsec]').forEach(s => s.onchange = () => { const i = s.parentElement.querySelector('[data-rolyaz]'); i.hidden = s.value !== '__baska'; if (!i.hidden) i.focus(); });
const TUM = Object.keys(EKRANLAR);
const HAZIR = {
  'Bayi': { e: { urunler: 'yaz', bayi: 'yaz', katalog: 'oku', araclar: 'oku', siparisler: 'oku', projeler: 'oku', firmalar: 'oku', harita: 'oku' }, g: [] },
  'Saha ekibi': { e: { harita: 'oku', bolgeler: 'oku', projeler: 'yaz', firmalar: 'yaz', kisiler: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', gorevler: 'yaz', numuneler: 'yaz', servis: 'yaz', katalog: 'oku', araclar: 'oku', referanslar: 'oku', dosyalar: 'yaz' }, g: [] },
  'Proje firması': { e: { projeler: 'oku', referanslar: 'oku', katalog: 'oku', araclar: 'oku' }, g: ['tutar', 'iletisim', 'yorum', 'iliski'] },
  'Sadece görüntüleme': { e: { harita: 'oku', projeler: 'oku', firmalar: 'oku', kisiler: 'oku', takvim: 'oku', ziyaretler: 'oku' }, g: [] },
  'Tam yetki': { e: Object.fromEntries(TUM.map(k => [k, EKRANLAR[k].salt ? 'oku' : 'yaz'])), g: [] },
  'Muhasebe': { e: { siparisler: 'yaz', tahsilat: 'yaz', teklifler: 'oku', firmalar: 'oku', panel: 'oku', masraflar: 'oku' }, g: [] },
  'Satış': { e: { harita: 'oku', bolgeler: 'oku', projeler: 'yaz', firmalar: 'yaz', kisiler: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', gorevler: 'yaz', teklifler: 'yaz', numuneler: 'yaz', katalog: 'oku', araclar: 'oku', referanslar: 'oku', dosyalar: 'yaz' }, g: [] },
  'Satış destek': { e: { teklifler: 'yaz', projeler: 'oku', firmalar: 'oku', kisiler: 'oku', siparisler: 'oku', urunler: 'oku', katalog: 'oku', araclar: 'oku' }, g: [] },
  'Proje': { e: { projeler: 'yaz', dosyalar: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', firmalar: 'oku', kisiler: 'oku', katalog: 'oku', araclar: 'oku' }, g: ['tutar'] },
};
for (const h of Object.values(HAZIR)) for (const k of Object.keys(h.e)) if (!EKRANLAR[k]) delete h.e[k];
const HAZIR_ROLLER = ['Muhasebe', 'Satış', 'Satış destek', 'Proje', 'Bayi'];
const HAZIR_ROL = { 'Bayi': 'Bayi', 'Saha ekibi': 'Ekip arkadaşı', 'Proje firması': 'Proje firması', 'Sadece görüntüleme': 'Yönetici', 'Tam yetki': 'Ekip arkadaşı' };
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function davetLinki(eposta) {
  const c = getConfig();
  return location.origin + location.pathname + '?davet=' + b64(JSON.stringify({ u: c.url, k: c.key, e: eposta }));
}

export async function kullaniciAyarlari(root) {
  if (app.db.mode !== 'supabase') { root.innerHTML = '<p class="hint">Başka kişilere yetki vermek için önce Genel sekmesinden bulut (Supabase) bağlantısını kur.</p>'; return; }
  root.innerHTML = '<p class="hint">Yükleniyor…</p>';
  const { data, error } = await app.db.c.from('ekip_uyeleri').select('*').eq('owner', app.db.sahip || app.db.user().id).order('created_at');
  if (error) { root.innerHTML = `<p class="warn">Kullanıcı tablosu bulunamadı. Supabase SQL Editor'de güncel <b>schema.sql</b> dosyasını çalıştır.</p>`; return; }
  const uyeler = data || [];
  try { const r = await app.db.c.from('roller').select('*').eq('owner', app.db.sahip || app.db.user().id).order('sira').order('ad'); if (r.error) throw r.error; ROLLER_DB = r.data || []; } catch { ROLLER_DB = null; }
  const KAD = new Map(); let kadVar = true;
  try { const r = await app.db.c.from('kullanici_adlari').select('ad,eposta'); if (r.error) throw r.error; for (const x of r.data || []) KAD.set(x.eposta.toLowerCase(), x.ad); } catch { kadVar = false; }
  for (const u of uyeler) u._kad = KAD.get(u.eposta.toLowerCase()) || '';
  root.innerHTML = `<p>Eklediğin kişi bu e-postayla giriş yaptığında <b>yalnızca açtığın ekranları</b> görür. Her ekran için <b>Kapalı</b>, <b>Görür</b> ya da <b>Düzenler</b> seç. Kapalı ekranın kayıtları, fotoğrafları ve belgeleri kişinin telefonuna hiç gönderilmez. Senin ayarlarını, kullanıcı listesini ve Veri kontrolünü hiçbir üye görmez. Kaydettikten sonra <b>Bu kişi gibi gör</b> ile kişinin ekranını kendi telefonunda deneyebilirsin.</p>
    ${rolBolumu(uyeler)}<h3 class="kul-baslik">Kullanıcılar</h3><div class="uyeler">${uyeler.slice().sort((a, b) => rolAl(a).localeCompare(rolAl(b), 'tr') || (a.ad || a.eposta).localeCompare(b.ad || b.eposta, 'tr')).map(u => uyeKarti(u, kadVar)).join('') || '<p class="hint">Henüz kimse eklenmedi.</p>'}</div>
    <details class="card-ic" ${uyeler.length ? '' : 'open'}><summary><b>Kişi ekle</b></summary>
      <form class="form" data-yeni><div class="grid"><div class="fld"><label for="ku-e">E-posta</label><input id="ku-e" type="email" required placeholder="ornek@firma.com"></div><div class="fld"><label for="ku-a">Ad</label><input id="ku-a" placeholder="Örn. Ali (Bayi)"></div>${kadVar ? '<div class="fld"><label for="ku-k">Kullanıcı adı (isteğe bağlı)</label><input id="ku-k" autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. ali.drv"><small>Kişi girişte e-posta yerine bunu yazabilir.</small></div>' : ''}${ROLLER_DB ? uyeRolSecici({}) : `<div class="fld"><label for="ku-r">Rol / ünvan</label>${rolSecici('', 'ku-r')}</div>`}</div><div data-rolbilgi></div><div data-agac>
      <div class="fld"><label>Hazır şablon</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
      ${yetkiDuzeni({})}</div>
      <div class="btnrow"><button type="submit" class="btn primary">Ekle ve davet bağlantısı oluştur</button></div></form></details>`;
  rolBagla(root);
  sirketKarti(root);
  import('../guvenlik.js').then(async g => {
    const sg = await g.sonGirisler();
    root.querySelectorAll('[data-uye]').forEach(k => { const s = k.querySelector('[data-songiris]'); if (!s) return; if (!sg) { s.remove(); return; } s.textContent = g.sonGirisMetni(sg[k.dataset.uye.toLowerCase()]); });
    if (!sg && uyeler.length) root.querySelector('.uyeler')?.insertAdjacentHTML('afterend', '<p class="hint">Son giriş tarihlerini görmek için Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 11).</p>');
  });
  app.db.c.rpc('yetki_surum').then(({ data, error }) => { if (error || (data || 0) < 15) root.insertAdjacentHTML('afterbegin', '<p class="warn">Sunucu kuralları eski: kapalı ekranların fotoğrafları, belgeleri ve ayarları ekip üyesine hâlâ açılabilir. Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 15).</p>'); }, () => {});
  const yeni = root.querySelector('[data-yeni]');
  yeni.querySelectorAll('[data-hazir]').forEach(b => b.onclick = () => { const h = HAZIR[b.dataset.hazir]; secimYaz(yeni, h.e, h.g); const r = yeni.querySelector('#ku-r'); if (!rolOku(yeni) && HAZIR_ROL[b.dataset.hazir]) { r.value = HAZIR_ROL[b.dataset.hazir]; r.dispatchEvent(new Event('change')); } yeni.querySelectorAll('[data-hazir]').forEach(x => x.classList.toggle('on', x === b)); });
  yetkiBagla(yeni); uyeRolBagla(yeni); rolleriBagla(root, uyeler);
  yeni.onsubmit = async e => {
    e.preventDefault();
    const eposta = yeni.querySelector('#ku-e').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(eposta)) return toast('Geçerli bir e-posta yaz.', 'err');
    if (eposta === (app.db.user()?.email || '').toLowerCase()) return toast('Kendini ekleyemezsin; sen zaten şirket yöneticisisin.', 'err');
    const secim = secimOku(yeni), alan = uyeYetkiAlanlari(yeni, secim); if (!alan.rol_id && !Object.values(secim).some(Boolean)) return toast('Bir rol seç ya da en az bir ekranı aç (Görür ya da Düzenler).', 'err');
    const { error } = await app.db.c.from('ekip_uyeleri').insert({ owner: app.db.sahip || app.db.user().id, eposta, ad: yeni.querySelector('#ku-a').value.trim() || null, ...alan, aktif: true });
    if (error) return toast(/duplicate|unique/i.test(error.message) ? 'Bu e-posta zaten ekli.' : 'Eklenemedi: ' + error.message, 'err');
    const kh = await kadKaydet(eposta, yeni.querySelector('#ku-k')?.value, ''); if (kh) toast(kh, 'err');
    toast('Kişi eklendi. Davet bağlantısını gönder.'); await kullaniciAyarlari(root); root.querySelector(`[data-uye="${CSS.escape(eposta)}"] [data-davet]`)?.click();
  };
  root.querySelectorAll('[data-uye]').forEach(k => {
    const u = uyeler.find(x => x.eposta === k.dataset.uye);
    k.querySelector('[data-kaydet]').onclick = async () => {
      const yon = !!k.querySelector('[data-yonetici]')?.checked;
      if (yon && !u.yonetici && !confirmBox(`${u.ad || u.eposta} şirket yöneticisi olsun mu? Her şeyi görür ve düzenler, kullanıcıları ve şirket ayarlarını yönetir.`)) return;
      const { error } = await app.db.c.from('ekip_uyeleri').update({ ad: k.querySelector('[data-ad]').value.trim() || null, aktif: k.querySelector('[data-aktif]').checked, ...uyeYetkiAlanlari(k), ...(k.querySelector('[data-yonetici]') ? { yonetici: yon } : {}) }).eq('id', u.id);
      if (!error) { u.yonetici = yon; k.querySelector('.yon-r').hidden = !yon; }
      if (!error && k.querySelector('[data-kad]')) { const kh = await kadKaydet(u.eposta, k.querySelector('[data-kad]').value, u._kad); if (kh) return toast(kh, 'err'); u._kad = adNormal(k.querySelector('[data-kad]').value); }
      if (!error) { const y = rolOku(k); const rb = k.querySelector('.rol-r:not(.yon-r)'); if (rb) { rb.textContent = y; rb.hidden = !y; } }
      toast(error ? 'Kaydedilemedi: ' + error.message : 'Yetkiler kaydedildi. Kişi uygulamayı yeniden açınca geçerli olur.', error ? 'err' : '');
    };
    yetkiBagla(k); uyeRolBagla(k);
    k.querySelectorAll('[data-hazir]').forEach(b => b.onclick = () => { const h = HAZIR[b.dataset.hazir]; secimYaz(k, h.e, h.g); k.querySelectorAll('[data-hazir]').forEach(x => x.classList.toggle('on', x === b)); });
    k.querySelector('[data-onizle]').onclick = () => { if (!confirmBox(`${u.ad || u.eposta} bu ayarlarla ne görüyor, bunu kendi telefonunda göreceksin. Önizlemede değişiklik kaydedilmez; alttaki düğmeyle çıkarsın. Başlansın mı?`)) return; onizlemeBaslat({ ...u, yetkiler: yetkiOku(k) }); };
    k.querySelector('[data-sil]').onclick = async () => { if (!confirmBox(`${u.eposta} kullanıcılardan çıkarılsın mı? Artık verilerini göremez.`)) return; await app.db.c.from('ekip_uyeleri').delete().eq('id', u.id); toast('Kullanıcı çıkarıldı.'); kullaniciAyarlari(root); };
    k.querySelector('[data-davet]').onclick = () => {
      const l = davetLinki(u.eposta), metin = `Merhaba${u.ad ? ' ' + u.ad : ''}, Saha Takip uygulamasına davetlisin.\n1) Bu bağlantıyı telefonunda aç: ${l}\n2) "İlk giriş" sekmesinde ${u.eposta} adresin için kendine bir şifre belirle.\n3) E-postana onay bağlantısı gelirse ona dokun.\nSonraki girişlerde ${u._kad ? `kullanıcı adın "${u._kad}" ya da ` : ''}e-postan ve şifrenle girersin. Şifreni unutursan giriş ekranındaki "Şifremi unuttum"u kullan.`;
      const kutu = k.querySelector('[data-link]'); kutu.hidden = false;
      kutu.innerHTML = `<input readonly value="${esc(l)}" aria-label="Davet bağlantısı"><div class="btnrow"><button type="button" class="btn sm" data-kopya>Kopyala</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink('', metin)}">WhatsApp ile gönder</a><a class="btn sm ghost" href="mailto:${esc(u.eposta)}?subject=${encodeURIComponent('Saha Takip daveti')}&body=${encodeURIComponent(metin)}">E-posta</a></div>
        <p class="hint">Bağlantı yalnızca uygulamanın adresini ve veritabanı adresini içerir; şifre içermez. Kişi kendi şifresini belirler ve sadece yetki verdiğin bölümleri görür.</p>`;
      kutu.querySelector('[data-kopya]').onclick = async () => { try { await navigator.clipboard.writeText(l); toast('Bağlantı kopyalandı.'); } catch { kutu.querySelector('input').select(); } };
    };
  });
}
// ---------- Ekran ağacı: başlık → ekranlar, her biri Kapalı / Görür / Düzenler ----------
const GRUPLAR = BASLIKLAR.map(b => ({ ...b, r: b.r.filter(r => EKRANLAR[r]) })).filter(b => b.r.length);
const seg3 = (k, v) => `<span class="seg3" role="group" data-ek="${k}" aria-label="${esc(SEKME_AD[k] || k)}">${[['', 'Kapalı'], ['oku', 'Görür'], ...(EKRANLAR[k]?.salt ? [] : [['yaz', 'Düzenler']])].map(([d, t]) => `<button type="button" data-v="${d}" class="${(v || '') === d ? 'on' : ''}" aria-pressed="${(v || '') === d}">${t}</button>`).join('')}</span>`;
const grupSeg = g => `<span class="seg3" role="group" data-grup="${g.k}" aria-label="${esc(g.t)} tümü">${[['', 'Hepsi kapalı'], ['oku', 'Görür'], ['yaz', 'Düzenler']].map(([d, t]) => `<button type="button" data-v="${d}">${t}</button>`).join('')}</span>`;
function yetkiDuzeni(y) {
  const secim = ekranSecimi(y), gizli = y?._gizli || [];
  return `<div class="fld"><label>Hangi ekranları görsün?</label>
    <p class="hint">Kapalı ekran kişinin menüsünde, aramasında, + menüsünde ve diğer ekranların içinde hiç görünmez; verisi telefonuna gelmez. Bugün ekranı ve kendi Ayarlar'ı herkeste açıktır, içinde yalnızca açık ekranların kayıtları görünür.</p>
    <div class="ekran-agac">${GRUPLAR.map(g => `<details data-g="${g.k}"><summary><b>${esc(g.t)}</b><small data-gsay></small></summary>
      <div class="ek-satir"><span><b>Tümü</b></span>${grupSeg(g)}</div>
      ${g.r.map(r => `<div class="ek-satir"><span>${esc(SEKME_AD[r] || r)}</span><small>${esc(EKRANLAR[r].d || '')}</small>${seg3(r, secim[r])}</div>`).join('')}</details>`).join('')}</div></div>
    <div class="fld"><label>Açık ekranlarda da gizlensin</label>${GIZLENEBILIR.map(x => `<label class="chk"><input type="checkbox" data-gz="${x.k}" ${gizli.includes(x.k) ? 'checked' : ''}> <span><b>${esc(x.ad)}</b><small class="muted"> · ${esc(x.d)}</small></span></label>`).join('')}</div>
    ${disaKutusu(y?._disa === true)}<p class="hint">Kapalıyken kişi ekranda görebildiği kayıtları Excel'e ya da sunuma aktaramaz. Yedek alma her zaman yalnızca sende.</p>
    <div class="yetki-ozet" data-yozet aria-live="polite"></div>`;
}
const secimOku = kok => Object.fromEntries([...kok.querySelectorAll('[data-ek]')].map(s => [s.dataset.ek, s.querySelector('button.on')?.dataset.v || null]).filter(([, v]) => v));
const gizliOku = kok => [...kok.querySelectorAll('[data-gz]:checked')].map(i => i.dataset.gz);
const yetkiOku = (kok, secim = secimOku(kok)) => yetkiNesnesi(secim, { rol: rolOku(kok), disa: kok.querySelector('[data-disa]')?.checked, gizli: gizliOku(kok) });
function secimYaz(kok, e, g) {
  kok.querySelectorAll('[data-ek]').forEach(s => { const v = e[s.dataset.ek] || ''; s.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-pressed', b.dataset.v === v); }); });
  if (g) kok.querySelectorAll('[data-gz]').forEach(i => i.checked = g.includes(i.dataset.gz));
  ozetYaz(kok);
}
const TABLO_AD = { projeler: 'Projeler', proje_gecmis: 'Proje durum geçmişi', firmalar: 'Firmalar', kisiler: 'Kişiler', ziyaretler: 'Ziyaretler', gorevler: 'Görevler', bolgeler: 'Sanayi bölgeleri', siparisler: 'Siparişler', hedefler: 'Hedefler', teklifler: 'Teklifler', urunler: 'Stok ve fiyatlar', stok_gecmis: 'Stok geçmişi', urun_aileleri: 'Ürün aileleri', rakip_fiyatlar: 'Rakip fiyatları', tahsilatlar: 'Tahsilat', numuneler: 'Numuneler', servis_kayitlari: 'Servis kayıtları', masraflar: 'Masraflar', belgeler: 'Dosyalar' };
function ozetYaz(kok) {
  const secim = secimOku(kok), kutu = kok.querySelector('[data-yozet]'); if (!kutu) return;
  kok.querySelectorAll('details[data-g]').forEach(d => { const rs = [...d.querySelectorAll('[data-ek]')], acik = rs.filter(s => secim[s.dataset.ek]).length; d.querySelector('[data-gsay]').textContent = acik ? `${acik}/${rs.length} açık` : 'kapalı'; });
  const ad = k => SEKME_AD[k] || k, tum = Object.keys(EKRANLAR);
  const yaz = tum.filter(k => secim[k] === 'yaz'), oku = tum.filter(k => secim[k] === 'oku'), kapali = tum.filter(k => !secim[k]);
  const tablolar = ekranTablolari(secim), tl = Object.entries(tablolar);
  const g = gizliOku(kok).map(k => GIZLENEBILIR.find(x => x.k === k)?.ad).filter(Boolean);
  kutu.innerHTML = !yaz.length && !oku.length ? '<b>Henüz hiçbir ekran açık değil.</b> Kişi giriş yapınca yalnızca boş bir Bugün ekranı görür.'
    : `${yaz.length ? `<div><b>Düzenler:</b> ${esc(yaz.map(ad).join(', '))}</div>` : ''}${oku.length ? `<div><b>Yalnızca görür:</b> ${esc(oku.map(ad).join(', '))}</div>` : ''}
      <div class="kapali"><b>Hiç görmez:</b> ${esc(kapali.map(ad).join(', ') || '—')}, Veri kontrolü, kullanıcılar ve senin ayarların</div>
      ${g.length ? `<div><b>Ayrıca gizli:</b> ${esc(g.join(', '))}</div>` : ''}
      <details><summary>Telefonuna gelen kayıtlar (${tl.length})</summary><p class="hint">Açık ekranların çalışması için gereken kayıtlar sunucudan bu kişiye gönderilir; listede olmayanlar hiçbir şekilde gönderilmez.</p>${esc(tl.map(([t, v]) => (TABLO_AD[t] || t) + (v === 'yaz' ? ' (düzenler)' : ' (görür)')).join(', '))}</details>`;
}
function yetkiBagla(kok) {
  kok.querySelectorAll('[data-ek] button').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); kok.querySelectorAll('[data-hazir]').forEach(x => x.classList.remove('on')); ozetYaz(kok); });
  kok.querySelectorAll('[data-grup] button').forEach(b => b.onclick = () => {
    const d = b.closest('details'); d.querySelectorAll('[data-ek]').forEach(s => { const v = b.dataset.v === 'yaz' && EKRANLAR[s.dataset.ek]?.salt ? 'oku' : b.dataset.v; s.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.v === v); x.setAttribute('aria-pressed', x.dataset.v === v); }); });
    ozetYaz(kok);
  });
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
function uyeKarti(u, kadVar) {
  const secim = ekranSecimi(u.yetkiler);
  const ozet = Object.keys(EKRANLAR).filter(k => secim[k]).map(k => (SEKME_AD[k] || k) + (secim[k] === 'yaz' ? '' : ' (görür)')).join(', ');
  return `<details class="uye" data-uye="${esc(u.eposta)}"><summary><span class="uye-ad"><b>${esc(u.ad || u.eposta)}</b><em class="rol-r yon-r" ${u.yonetici ? '' : 'hidden'}>Şirket yöneticisi</em><em class="rol-r" ${rolAl(u) ? '' : 'hidden'}>${esc(rolAl(u))}</em><small class="muted">${esc(u.eposta)}${u.aktif ? '' : ' · pasif'} · <span data-songiris>…</span></small></span><small class="muted">${esc(ozet || 'yetki yok')}</small></summary>
    <div class="grid"><div class="fld"><label>Ad</label><input data-ad value="${esc(u.ad || '')}"></div>${kadVar ? `<div class="fld"><label>Kullanıcı adı</label><input data-kad autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. ali.drv" value="${esc(u._kad || '')}"></div>` : ''}${ROLLER_DB ? uyeRolSecici(u) : `<div class="fld"><label>Rol / ünvan</label>${rolSecici(rolAl(u))}</div>`}<div class="fld is-chk"><label class="chk"><input type="checkbox" data-aktif ${u.aktif ? 'checked' : ''}> <span>Erişimi açık</span></label></div></div>
    ${'yonetici' in u ? `<label class="chk yon-chk"><input type="checkbox" data-yonetici ${u.yonetici ? 'checked' : ''}> <span><b>Şirket yöneticisi</b><small class="muted"> · her şeyi görür ve düzenler, kullanıcıları ve şirket ayarlarını yönetir; aşağıdaki ekran seçimi onun için geçerli olmaz</small></span></label>` : ''}
    <div data-rolbilgi></div><div data-agac><div class="fld"><label>Hazır şablon</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
    ${yetkiDuzeni(u.yetkiler)}</div>
    <div class="btnrow"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button><button type="button" class="btn sm" data-davet>Davet bağlantısı</button><button type="button" class="btn sm ghost" data-onizle>Bu kişi gibi gör</button><button type="button" class="btn sm ghost danger" data-sil>Çıkar</button></div>
    <div data-link class="davet-kutu" hidden></div></details>`;
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
      <p class="hint">Yönetici eklemek için aşağıdaki kullanıcı kartında “Şirket yöneticisi” kutusunu işaretle.</p></div>
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

// ---------- K2: Roller ----------
function rolBolumu(uyeler) {
  if (!ROLLER_DB) return '';
  const say = id => uyeler.filter(u => u.rol_id === id && u.aktif).length;
  return `<section class="roller-bol"><h3>Roller <span class="muted">${ROLLER_DB.length}</span></h3>
    <p class="hint">Rol, bir grup kişinin hangi ekranları göreceğini belirler. Rolün ayarını değiştirince o roldeki herkes birlikte güncellenir. Kişiye özel ayarı olanlar etkilenmez.</p>
    <div class="roller">${ROLLER_DB.map(r => `<details class="uye rol-k" data-rol="${r.id}"><summary><span class="uye-ad"><b>${esc(r.ad)}</b><small class="muted">${say(r.id)} kişi${r.aciklama ? ' · ' + esc(r.aciklama) : ''}</small></span><small class="muted">${esc(rolOzeti(r) || 'hiçbir ekran açık değil')}</small></summary>
      <div class="grid"><div class="fld"><label>Rol adı</label><input data-rolad value="${esc(r.ad)}"></div><div class="fld"><label>Açıklama</label><input data-rolacik value="${esc(r.aciklama || '')}" placeholder="ör. faturalar ve tahsilat"></div></div>
      <div class="fld"><label>Hazır şablon</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
      ${yetkiDuzeni(r.yetkiler)}
      <div class="btnrow"><button type="button" class="btn sm primary" data-rolkaydet>Kaydet</button><button type="button" class="btn sm ghost" data-rolgor>Bu rol gibi gör</button><button type="button" class="btn sm ghost danger" data-rolsil>Sil</button></div></details>`).join('') || '<p class="hint">Henüz rol yok.</p>'}</div>
    <div class="btnrow">${HAZIR_ROLLER.some(h => !ROLLER_DB.some(r => r.ad === h)) ? `<button type="button" class="btn sm" data-hazirrol>Hazır rolleri ekle (${HAZIR_ROLLER.filter(h => !ROLLER_DB.some(r => r.ad === h)).join(', ')})</button>` : ''}</div>
    <details class="card-ic"><summary><b>Yeni rol</b></summary><div class="form" data-rol="" data-yenirol>
      <div class="grid"><div class="fld"><label>Rol adı</label><input data-rolad placeholder="ör. Satış Adana"></div><div class="fld"><label>Açıklama</label><input data-rolacik placeholder="isteğe bağlı"></div></div>
      <div class="fld"><label>Hazır şablon</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
      ${yetkiDuzeni({})}<div class="btnrow"><button type="button" class="btn primary" data-rolekle>Rolü ekle</button></div></div></details></section>`;
}
function rolleriBagla(root, uyeler) {
  const bol = root.querySelector('.roller-bol'); if (!bol) return;
  const sahip = app.db.sahip || app.db.user().id;
  const yenile = () => kullaniciAyarlari(root);
  // Rolün kaydı: kişilere yayılması sunucuda olur; eski sunucu ya da deneme için burada da yazılır
  const roldekiler = async id => { const { data } = await app.db.c.from('ekip_uyeleri').select('id,rol_id,ozel,aktif').eq('owner', sahip); return (data || []).filter(u => u.rol_id === id); };
  const yay = async (r) => { for (const u of (await roldekiler(r.id)).filter(u => !u.ozel)) await app.db.c.from('ekip_uyeleri').update({ yetkiler: { ...r.yetkiler, _rol: r.ad } }).eq('id', u.id); };
  bol.querySelectorAll('[data-rol]').forEach(k => {
    yetkiBagla(k);
    k.querySelectorAll('[data-hazir]').forEach(b => b.onclick = () => { const h = HAZIR[b.dataset.hazir]; secimYaz(k, h.e, h.g); k.querySelectorAll('[data-hazir]').forEach(x => x.classList.toggle('on', x === b)); const ad = k.querySelector('[data-rolad]'); if (!ad.value.trim()) ad.value = b.dataset.hazir; });
  });
  bol.querySelectorAll('.rol-k').forEach(k => {
    const r = ROLLER_DB.find(x => x.id === k.dataset.rol);
    k.querySelector('[data-rolkaydet]').onclick = async () => {
      const ad = k.querySelector('[data-rolad]').value.trim(); if (!ad) return toast('Rol adı yaz.', 'err');
      const yeni = { ad, aciklama: k.querySelector('[data-rolacik]').value.trim() || null, yetkiler: { ...yetkiOku(k), _rol: undefined } }; delete yeni.yetkiler._rol;
      const n = (await roldekiler(r.id)).filter(u => !u.ozel && u.aktif).length;
      if (n && !confirmBox(`“${ad}” rolündeki ${n} kişinin yetkileri birlikte değişecek. Devam edilsin mi?`)) return;
      const { error } = await app.db.c.from('roller').update(yeni).eq('id', r.id);
      if (error) return toast(/unique|duplicate/i.test(error.message) ? 'Bu adda bir rol zaten var.' : 'Kaydedilemedi: ' + error.message, 'err');
      await yay({ ...r, ...yeni }); toast(n ? `Rol kaydedildi; ${n} kişi güncellendi.` : 'Rol kaydedildi.'); yenile();
    };
    k.querySelector('[data-rolgor]').onclick = () => { if (!confirmBox(`“${r.ad}” rolündeki biri ne görüyor, bunu kendi telefonunda göreceksin. Önizlemede değişiklik kaydedilmez. Başlansın mı?`)) return; onizlemeBaslat({ eposta: 'rol:' + r.ad, ad: r.ad + ' rolü', yetkiler: { ...yetkiOku(k), _rol: r.ad } }); };
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
    const y = yetkiOku(yr); delete y._rol;
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
