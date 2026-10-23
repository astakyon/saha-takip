// Kullanıcı yetkileri: veri sahibi her şeyi görür; ekip üyesi yalnızca açılan ekranları ve bölümleri görür / düzenler.
// Sunucu (Supabase RLS) tablo bazında karar verir: kapalı tablonun verisi kişinin telefonuna hiç gelmez.
// Ekran yetkileri (yetkiler._ekran) tablo yetkilerine çevrilerek kaydedilir; ekran içindeki bölümler tablo yetkisine göre gizlenir.
import { app } from './state.js';
import { S } from './db.js';

// Eski sürüm: bölüm → tablolar ve ekranlar (yalnızca _ekran olmayan eski kayıtlar için)
export const MODULLER = [
  { k: 'projeler', ad: 'Projeler', t: ['projeler', 'proje_gecmis'], rota: ['projeler', 'referanslar'] },
  { k: 'firmalar', ad: 'Firmalar ve kişiler', t: ['firmalar', 'kisiler'], rota: ['firmalar', 'kisiler'] },
  { k: 'ziyaretler', ad: 'Ziyaretler ve görevler', t: ['ziyaretler', 'gorevler'], rota: ['ziyaretler', 'gorevler', 'takvim', 'rapor'] },
  { k: 'bolgeler', ad: 'Sanayi bölgeleri', t: ['bolgeler'], rota: ['bolgeler'] },
  { k: 'siparisler', ad: 'Siparişler, hedefler ve panel', t: ['siparisler', 'hedefler'], rota: ['siparisler', 'panel'] },
  { k: 'teklifler', ad: 'Teklifler', t: ['teklifler'], rota: ['teklifler'] },
  { k: 'stok', ad: 'Stok, fiyat ve katalog', t: ['urunler', 'stok_gecmis', 'urun_aileleri'], rota: ['urunler', 'bayi', 'katalog', 'araclar'] },
  { k: 'rakip', ad: 'Rakip fiyatları', t: ['rakip_fiyatlar'], rota: ['rakip'] },
  { k: 'tahsilat', ad: 'Tahsilat', t: ['tahsilatlar'], rota: ['tahsilat'] },
  { k: 'numune', ad: 'Numune ve servis', t: ['numuneler', 'servis_kayitlari'], rota: ['numuneler', 'servis'] },
  { k: 'masraf', ad: 'Masraf ve km', t: ['masraflar'], rota: ['masraflar'] },
  { k: 'belgeler', ad: 'Dosyalar ve belgeler', t: ['belgeler'], rota: ['dosyalar'] },
];

// Ekranlar: t = ekranın kendi tabloları (seçilen seviyeyi alır), o = ekranın çalışması için okunan tablolar,
// salt = ekranda düzenlenecek bir şey yok (yalnızca Kapalı / Görür), d = kişiye gösterilen açıklama
export const EKRANLAR = {
  harita:     { t: [], o: ['projeler', 'firmalar'], salt: true, d: 'Projeler ve firmalar haritada; ziyaret katmanı yalnızca Ziyaretler açıksa' },
  bolgeler:   { t: ['bolgeler'], o: [], d: 'Sanayi bölgeleri ve sınırları' },
  projeler:   { t: ['projeler', 'proje_gecmis'], o: ['firmalar'], d: 'Proje listesi ve kartı; firma adları görünür' },
  referanslar:{ t: [], o: ['projeler'], salt: true, d: 'Tamamlanan referans projeler' },
  firmalar:   { t: ['firmalar', 'kisiler'], o: [], d: 'Firma listesi ve kartı, firmadaki kişiler' },
  kisiler:    { t: ['kisiler'], o: ['firmalar'], d: 'Kişi listesi, telefon ve e-postalar' },
  takvim:     { t: ['ziyaretler', 'gorevler'], o: ['firmalar', 'projeler'], d: 'Planlı ziyaretler ve görevler takvimde' },
  ziyaretler: { t: ['ziyaretler'], o: ['firmalar', 'projeler'], d: 'Ziyaret kayıtları ve notları' },
  gorevler:   { t: ['gorevler'], o: ['firmalar', 'projeler'], d: 'Görev listesi (kendisine atanan görevleri her zaman görür)' },
  teklifler:  { t: ['teklifler'], o: ['firmalar', 'projeler', 'urunler'], d: 'Teklifler, kalemler ve fiyatlar' },
  siparisler: { t: ['siparisler'], o: ['firmalar'], d: 'SAP siparişleri' },
  tahsilat:   { t: ['tahsilatlar'], o: ['firmalar'], d: 'Açık faturalar ve ödemeler' },
  numuneler:  { t: ['numuneler'], o: ['firmalar', 'projeler'], d: 'Verilen numuneler' },
  servis:     { t: ['servis_kayitlari'], o: ['firmalar', 'projeler'], d: 'Servis ve şikayet kayıtları' },
  urunler:    { t: ['urunler', 'stok_gecmis'], o: [], d: 'Stok listesi ve fiyatlar' },
  bayi:       { t: ['urunler', 'stok_gecmis'], o: ['firmalar'], d: 'Bayinin stoğu; sipariş ve projeler yalnızca o ekranlar açıksa' },
  katalog:    { t: ['urun_aileleri'], o: [], d: 'Ürün kataloğu' },
  rakip:      { t: ['rakip_fiyatlar'], o: [], d: 'Rakip marka fiyatları' },
  araclar:    { t: [], o: [], salt: true, d: 'Aydınlatma hesap araçları' },
  panel:      { t: ['hedefler'], o: ['siparisler', 'projeler'], d: 'Hedefler, satış grafikleri ve özetler' },
  rapor:      { t: [], o: ['ziyaretler', 'gorevler', 'projeler', 'firmalar'], salt: true, d: 'Haftalık faaliyet raporu' },
  masraflar:  { t: ['masraflar'], o: [], d: 'Masraf ve km kayıtları' },
  dosyalar:   { t: ['belgeler'], o: [], d: 'Yüklenen dosyalar ve belgeler' },
};
// Kişiye gösterilmeyen ekstra bölümler (ekran açık olsa bile)
export const GIZLENEBILIR = [
  { k: 'tutar', ad: 'Tutar, fiyat ve hedefler', d: 'Proje tutarları, teklif ve stok fiyatları "•••" görünür. Bu bir görüntü ayarıdır: ilgili ekranın verisi telefona yine gelir.' },
  { k: 'iletisim', ad: 'Kişilerin telefon ve e-postası', d: 'Kişi kartlarında telefon, e-posta ve WhatsApp düğmesi gizlenir (görüntü ayarı).' },
  { k: 'yorum', ad: 'Yorumlar', d: 'Proje ve firma kartındaki yorumlar bölümü hiç görünmez.' },
  { k: 'iliski', ad: 'Firma ilişki ağı', d: 'Firma kartındaki ilişki ağı ve "kimin üzerinden ulaşırım" bölümü görünmez.' },
];
const SAHIBE_OZEL = ['kontrol'];
const ILETISIM = ['telefon', 'eposta', 'kartvizit_on', 'kartvizit_arka', 'dogum_gunu'];
const HER_ZAMAN = ['bugun', 'ayarlar'];
export const VERI_TABLOLARI = [...new Set(MODULLER.flatMap(m => m.t))];
const SEV = { oku: 1, yaz: 2 };
const ust = (a, b) => (SEV[b] || 0) > (SEV[a] || 0) ? b : a;

export const sahipMi = () => !app.yetki || app.yetki.ben_sahip !== false;
export const onizlemede = () => !!app.yetki?.onizleme;
const yt = () => app.yetki?.yetkiler || {};
// Excel / sunum çıktısı: veri sahibi her zaman; ekip üyesi yalnızca izin verildiyse (yetkiler._disa)
export const disaAktarabilir = () => sahipMi() || yt()._disa === true;
// Ekstra bölüm gizli mi? ('tutar', 'iletisim', 'yorum', 'iliski')
export const gizliBolum = k => !sahipMi() && (yt()._gizli || []).includes(k);
// tablo için 'oku' | 'yaz' | null
export function izin(tablo) {
  if (sahipMi()) return 'yaz';
  if (tablo === 'yorumlar') return gizliBolum('yorum') ? null : 'oku';
  return yt()[tablo] || null;
}
export const modulIzni = m => { const v = m.t.map(izin); return v.includes('yaz') ? 'yaz' : v.includes('oku') ? 'oku' : null; };
const ekranlar = () => (yt()._ekran && typeof yt()._ekran === 'object') ? yt()._ekran : null;
function eskiRota(k) {
  if (k === 'harita') return !!(izin('projeler') || izin('firmalar'));
  const m = MODULLER.find(m => m.rota.includes(k));
  return m ? modulIzni(m) : null;
}
export function rotaIzinli(k) {
  if (sahipMi() || HER_ZAMAN.includes(k)) return true;
  if (SAHIBE_OZEL.includes(k)) return false;
  const e = ekranlar();
  return e ? !!e[k] : !!eskiRota(k);
}
export const rotaYazilabilir = k => {
  if (sahipMi()) return true;
  if (onizlemede()) return false;
  if (HER_ZAMAN.includes(k)) return true;
  const e = ekranlar();
  return e ? e[k] === 'yaz' && !EKRANLAR[k]?.salt : eskiRota(k) === 'yaz';
};
// Kişinin ekran seçimi (eski kayıtlar ekranlara çevrilir)
export function ekranSecimi(yetkiler) {
  if (yetkiler?._ekran) return { ...yetkiler._ekran };
  const o = {};
  for (const k of Object.keys(EKRANLAR)) {
    let v = null;
    if (k === 'harita') v = (yetkiler?.projeler || yetkiler?.firmalar) ? 'oku' : null;
    else { const m = MODULLER.find(m => m.rota.includes(k)); if (m) { const s = m.t.map(t => yetkiler?.[t]); v = s.includes('yaz') ? 'yaz' : s.includes('oku') ? 'oku' : null; } }
    if (v && EKRANLAR[k].salt) v = 'oku';
    if (v) o[k] = v;
  }
  return o;
}
// Ekran seçimini tablo yetkilerine çevirir: ekranın kendi tabloları seçilen seviyeyi, yardımcı tablolar 'oku' alır
export function ekranTablolari(secim) {
  const o = {};
  for (const [k, v] of Object.entries(secim || {})) {
    const e = EKRANLAR[k]; if (!e || !v) continue;
    const sev = e.salt ? 'oku' : v;
    for (const t of e.t) o[t] = ust(o[t], sev);
    for (const t of e.o) o[t] = ust(o[t], 'oku');
  }
  return o;
}
// Kaydedilecek yetki nesnesi
export function yetkiNesnesi(secim, { rol, disa, gizli } = {}) {
  const temiz = Object.fromEntries(Object.entries(secim).filter(([k, v]) => v && EKRANLAR[k]).map(([k, v]) => [k, EKRANLAR[k].salt ? 'oku' : v]));
  const o = { ...ekranTablolari(temiz), _ekran: temiz };
  const r = String(rol || '').trim(); if (r) o._rol = r.slice(0, 40);
  if (disa) o._disa = true;
  const g = (gizli || []).filter(k => GIZLENEBILIR.some(x => x.k === k)); if (g.length) o._gizli = g;
  return o;
}
// Eski arayüz uyumluluğu
export function tabloYetkileri(secim) {
  const o = {};
  for (const m of MODULLER) if (secim[m.k]) for (const t of m.t) o[t] = secim[m.k];
  if (o.projeler && !o.firmalar) { o.firmalar = 'oku'; o.kisiler = 'oku'; }
  return o;
}
export const modulSecimi = yetkiler => Object.fromEntries(MODULLER.map(m => { const v = m.t.map(t => yetkiler?.[t]); return [m.k, v.includes('yaz') ? 'yaz' : v.includes('oku') ? 'oku' : null]; }));

// ---------- Önizleme: veri sahibi, bir kişinin ne gördüğünü kendi telefonunda dener (değişiklik yapılamaz) ----------
const ON = 'saha-onizleme';
export function onizlemeBaslat(u) { try { sessionStorage.setItem(ON, JSON.stringify({ eposta: u.eposta, ad: u.ad || '', yetkiler: u.yetkiler || {} })); } catch {} location.hash = '#/bugun'; location.reload(); }
export function onizlemeBitir() { try { sessionStorage.removeItem(ON); } catch {} location.hash = '#/ayarlar/ekip'; location.reload(); }
const onizlemeOku = () => { try { return JSON.parse(sessionStorage.getItem(ON) || 'null'); } catch { return null; } };

// Açılışta ve her tazelemede çağrılır: yetkiyi belirler, yetkisi olmayan tabloların telefondaki kopyasını ekrandan siler
export function yetkiUygula() {
  const gercek = app.db?.yetki || null;
  const on = onizlemeOku();
  const sahip = !gercek || gercek.ben_sahip !== false;
  if (on && sahip && app.db?.mode !== 'local') {
    app.yetki = { ben_sahip: false, onizleme: true, sahip: gercek?.sahip, yetkiler: on.yetkiler, ad: on.ad, eposta: on.eposta };
  } else { if (on) { try { sessionStorage.removeItem(ON); } catch {} } app.yetki = gercek; }
  if (app.db) app.db.onizleme = onizlemede();
  document.documentElement.dataset.tutar = gizliBolum('tutar') ? 'gizli' : '';
  if (app.db) app.db.gizliAlan = gizliBolum('iletisim') ? { kisiler: ILETISIM } : null;
  if (sahipMi()) return;
  if (gizliBolum('iletisim') && Array.isArray(S.kisiler)) S.kisiler = S.kisiler.map(k => { const o = { ...k }; for (const a of ILETISIM) delete o[a]; return o; });
  const ben = (onizlemede() ? app.yetki.eposta : app.db?.user?.()?.email || '').toLowerCase();
  for (const t of VERI_TABLOLARI) {
    if (izin(t) || !Array.isArray(S[t])) continue;
    S[t] = t === 'gorevler' ? S[t].filter(g => g.atanan && g.atanan.toLowerCase() === ben) : [];
  }
  if (!izin('yorumlar') && Array.isArray(S.yorumlar)) S.yorumlar = [];
  else if (Array.isArray(S.yorumlar)) S.yorumlar = S.yorumlar.filter(y => izin(y.tablo));
}

// ---------- Ekran içi bölümler: data-gerek="ziyaretler,gorevler" (biri yeterli), "yaz:teklifler", "!tutar", "sahip" ----------
export function gerekVar(ifade) {
  if (sahipMi() && !onizlemede()) return true;
  return String(ifade).split(/\s+/).every(grup => grup.split(',').some(tok => {
    tok = tok.trim(); if (!tok) return true;
    if (tok === 'sahip') return sahipMi();
    if (tok.startsWith('!')) return !gizliBolum(tok.slice(1));
    if (tok.startsWith('yaz:')) return !onizlemede() && izin(tok.slice(4)) === 'yaz';
    if (tok.startsWith('ekran:')) return rotaIzinli(tok.slice(6));
    return !!izin(tok);
  }));
}
// Bağlantılar: kapalı ekrana ya da yetkisi olmayan kayda giden bağlantı düz yazıya döner (adres çubuğu da ayrıca korunur)
const DETAY_T = { proje: 'projeler', firma: 'firmalar', kisi: 'kisiler' };
function baglantiAcik(href) {
  const m = /^#\/([a-z]+)/.exec(href || ''); if (!m) return true;
  const k = m[1];
  if (DETAY_T[k]) return !!izin(DETAY_T[k]);
  if (EKRANLAR[k] || SAHIBE_OZEL.includes(k)) return rotaIzinli(k);
  return true;
}
export function gerekUygula(kok) {
  if (!kok || sahipMi()) return;
  const sec = '[data-gerek]', els = [];
  if (kok.matches?.(sec)) els.push(kok);
  els.push(...(kok.querySelectorAll?.(sec) || []));
  for (const el of els) {
    if (!el.isConnected && el !== kok) continue;
    if (gerekVar(el.dataset.gerek)) continue;
    // Düğme, sekme ve bağlantı tamamen kaldırılır; içi sonradan dolan bölümler boşaltılıp gizlenir (kodun başvurusu bozulmasın)
    if (el.matches('button, a, [role=tab], li, option')) {
      const sekmeSeciliydi = el.matches('[role=tab]') && el.classList.contains('on'), sekmeler = el.parentElement;
      el.remove();
      if (sekmeSeciliydi) sekmeler?.querySelector('[role=tab]')?.click();
    } else { el.innerHTML = ''; el.hidden = true; el.dataset.gizlendi = ''; el.removeAttribute('data-gerek'); }
  }
  const linkler = kok.matches?.('a[href^="#/"]') ? [kok] : [...(kok.querySelectorAll?.('a[href^="#/"]') || [])];
  for (const a of linkler) {
    if (baglantiAcik(a.getAttribute('href'))) continue;
    const sp = document.createElement('span'); sp.className = a.className.replace(/\b(btn|on)\b/g, '').trim(); sp.innerHTML = a.innerHTML;
    if (a.matches('.btn, .nav-main a, .nav-rest a, .alt-sekme a') || !sp.textContent.trim()) a.remove(); else a.replaceWith(sp);
  }
}
