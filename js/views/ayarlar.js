import { S, TABLES, getConfig, setConfig, idbGet } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, toast, download, exportXlsx, today, confirmBox, pickFiles, firmaAd } from '../ui.js';
import { projeSatiri } from './projeler.js';
import { birlestir, SIRA } from '../birlestir.js';
import { googleKey, anahtarFormu, anahtarBagla } from '../google.js';
import { iceAktarPaneli } from './ice-aktar.js';
import { openDrawer, closeDrawer } from '../ui.js';
import { INST, isIOS, install, onInstallChange } from '../kurulum.js';
import { sablonDuzenleyici } from '../sablon.js';
import { teklifAyarlari } from './teklif.js';
import { kmlIndir } from '../paylas.js';
import { kurAyarlari } from '../kur.js';
import { bildirimAyarlari } from '../bildirim.js';
import { yuklemeKaydet } from '../belgeler.js';
import { ayar, ayarYaz } from '../ayar.js';
import { sahipMi } from '../yetki.js';
import { kullaniciAyarlari } from './kullanicilar.js';
import { menuAyarlari } from '../menu.js';

const ORDER = SIRA;
const ETIKET = { bolgeler: 'sanayi bölgesi', firmalar: 'firma', kisiler: 'kişi', projeler: 'proje', proje_gecmis: 'durum geçmişi', ziyaretler: 'ziyaret', gorevler: 'görev', urunler: 'ürün', stok_gecmis: 'stok geçmişi', rakip_fiyatlar: 'rakip fiyatı', siparisler: 'sipariş', hedefler: 'hedef', teklifler: 'teklif', numuneler: 'numune', servis_kayitlari: 'servis kaydı', masraflar: 'masraf', urun_aileleri: 'ürün ailesi', ayarlar: 'ayar', tahsilatlar: 'tahsilat kaydı', belgeler: 'belge' };

function connForm(cfg) {
  return `<form class="form conn" data-conn>
    <div class="grid"><div class="fld full"><label for="c-url">Supabase proje adresi (Project URL)</label><input id="c-url" placeholder="https://xxxx.supabase.co" value="${esc(cfg?.url || '')}" autocomplete="off"></div>
    <div class="fld full"><label for="c-key">Anon public anahtar</label><textarea id="c-key" rows="3" placeholder="eyJhbGciOi…">${esc(cfg?.key || '')}</textarea>
    <small>Supabase panelinde Project Settings → API bölümünde bulunur. “service_role” anahtarını değil, “anon public” anahtarı gir.</small></div></div>
    <div class="btnrow"><button class="btn primary" type="submit">Supabase'e bağlan</button>${cfg?.mode === 'supabase' ? '<button class="btn ghost" type="button" data-demo>Deneme moduna dön</button>' : ''}</div></form>`;
}
function bindConn(root) {
  const f = root.querySelector('[data-conn]');
  f.onsubmit = e => {
    e.preventDefault();
    const url = f.querySelector('#c-url').value.trim().replace(/\/$/, ''), key = f.querySelector('#c-key').value.trim();
    if (!/^https:\/\/.+/.test(url) || key.length < 40) return toast('Adres https:// ile başlamalı ve anahtar tam olmalı.', 'err');
    setConfig({ mode: 'supabase', url, key }); toast('Bağlantı kaydedildi.'); location.hash = '#/ayarlar'; location.reload();
  };
  f.querySelector('[data-demo]')?.addEventListener('click', () => { setConfig({ ...(getConfig() || {}), mode: 'local' }); location.reload(); });
}

export function loginView(el, done) {
  const cfg = getConfig();
  el.innerHTML = `<div class="login"><div class="login-card"><div class="brand"><span class="bulb big" aria-hidden="true"></span><h1>Saha Takip</h1></div>
    <p class="muted">${esc(cfg.url.replace('https://', ''))}</p>
    ${sessionStorage.getItem('saha-davet') ? '<p class="davet">Saha Takip\'e davet edildin. <b>İlk girişte</b> bu e-postayla bir şifre belirleyip “Hesap oluştur”a dokun; sonra giriş yap.</p>' : ''}
    <form class="form" data-login><div class="fld"><label for="l-e">E-posta</label><input id="l-e" type="email" autocomplete="username" required autofocus value="${esc(sessionStorage.getItem('saha-davet') || '')}"></div>
    <div class="fld"><label for="l-p">Şifre</label><input id="l-p" type="password" autocomplete="current-password" minlength="6" required></div>
    <div class="btnrow"><button class="btn primary" type="submit">Giriş yap</button><button class="btn ghost" type="button" data-up>Hesap oluştur</button></div></form>
    <details><summary>Bağlantı ayarları</summary>${connForm(cfg)}</details></div></div>`;
  bindConn(el);
  const f = el.querySelector('[data-login]');
  const go = async up => {
    const e = f.querySelector('#l-e').value.trim(), p = f.querySelector('#l-p').value;
    if (!e || p.length < 6) return toast('E-posta ve en az 6 karakterli şifre gir.', 'err');
    try {
      if (up) { const r = await app.db.signUp(e, p); if (!r.session) return toast('Hesap oluşturuldu. E-postana gelen onay bağlantısına tıkla, sonra giriş yap.'); }
      else await app.db.signIn(e, p);
      done();
    } catch (err) { toast(/Invalid login/i.test(err.message) ? 'E-posta veya şifre hatalı.' : /not confirmed/i.test(err.message) ? 'E-posta adresin henüz onaylanmamış. Gelen kutundaki bağlantıya tıkla.' : err.message, 'err'); }
  };
  f.onsubmit = e => { e.preventDefault(); go(false); };
  el.querySelector('[data-up]').onclick = () => go(true);
}

export async function ayarlarView(el) {
  const cfg = getConfig();
  const sup = app.db.mode === 'supabase';
  const counts = ORDER.map(t => [t, S[t].length]).filter(([, n]) => n);
  let localCount = 0;
  if (sup) for (const t of ORDER) localCount += ((await idbGet('t:' + t)) || []).length;
  const pend = sup ? await app.db.pending() : 0;
  const f = F('ayarlar', { sekme: 'genel' });
  if (!S.projeler.length && !S.firmalar.length && f.sekme === 'genel' && !f._ilk) { f.sekme = 'veri'; f._ilk = 1; }
  const SEKME = sahipMi() ? [['genel', 'Genel'], ['kullanici', 'Kullanıcılar'], ['veri', 'Veri ve yedek'], ['google', 'Google ve harita'], ['mesaj', 'Mesaj ve teklif']] : [['genel', 'Genel']];
  let menuAc = false; try { menuAc = !!sessionStorage.getItem('menu-ac'); sessionStorage.removeItem('menu-ac'); } catch {}
  if (menuAc) f.sekme = 'genel';
  try { const s = sessionStorage.getItem('ayar-sekme'); if (s) { f.sekme = s; sessionStorage.removeItem('ayar-sekme'); } } catch {}
  if (!SEKME.some(([k]) => k === f.sekme)) f.sekme = 'genel';
  const toplam = counts.reduce((a, [, n]) => a + n, 0);
  el.innerHTML = `<header class="vh"><div><h1>Ayarlar</h1><p class="sum">${sup ? `Hesap: ${esc(app.db.user()?.email || '')}` : 'Deneme modu: veriler yalnızca bu cihazda'}${pend ? ` · <b>${pend} değişiklik internet bekliyor</b>` : ''}</p></div></header>
  <div class="seg ayar-sekme" role="tablist">${SEKME.map(([k, t]) => `<button type="button" role="tab" data-sekme="${k}" aria-selected="${f.sekme === k}" class="${f.sekme === k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <div class="settings">
    <section class="card" data-tab="genel"><h2>Hesap</h2>
      ${sup ? `<p>Bulut hesabına bağlısın; telefonda ve bilgisayarda aynı verileri görürsün.</p><div class="btnrow"><button class="btn ghost" data-out>Çıkış yap</button></div><details class="gelismis"><summary>Bağlantı bilgileri (Supabase)</summary>${connForm(cfg)}</details>`
      : `<p>Şu an <b>deneme modundasın</b>: veriler yalnızca bu tarayıcıda durur. Telefon ve bilgisayarda ortak kullanmak için Supabase bilgilerini gir.</p>${connForm(cfg)}`}
    </section>
    ${sahipMi() ? '' : `<section class="card" data-tab="genel"><h2>Ekip üyesi</h2><p>Bu hesapla veri sahibinin sana açtığı bölümleri görüyorsun. Yeni bölüm için veri sahibinden yetki iste.</p></section>`}
    <section class="card wide-card" data-tab="kullanici"><h2>Kullanıcılar ve yetkiler</h2><div data-kullanici></div></section>
    <section class="card wide-card" data-tab="kullanici" data-sondeg></section>
    <section class="card" data-tab="genel" id="menu-karti"><h2>Menü</h2><div data-menu></div></section>
    <section class="card" data-tab="genel"><h2>Görünüm</h2><div class="seg" role="group" aria-label="Tema" data-tema>${[['acik', 'Açık'], ['koyu', 'Koyu'], ['oto', 'Cihaza göre']].map(([k, t]) => `<button type="button" data-tm="${k}" class="${(ayar('tema', 'acik') || 'acik') === k ? 'on' : ''}">${t}</button>`).join('')}</div><p class="hint">Koyu tema akşam ve gece kullanımında gözü daha az yorar. “Cihaza göre” telefonun gece/gündüz ayarını izler.</p></section>
    <section class="card" data-tab="genel"><h2>Gizlilik</h2>
      <label class="chk"><input type="checkbox" data-gizli ${ayar('gizli_mod', false) === true ? 'checked' : ''}> <span><b>Gizli mod</b>: kayıtlarımı ve konumumu dış servislere gönderme</span></label>
      <p class="hint">Açıkken kapananlar: Google uydu/harita katmanı ve Google'da firma arama, OpenStreetMap ile adres ve il/ilçe bulma, sesle yazma (Google konuşma tanıma). Konum yine telefonda alınır, il ve sanayi bölgesi cihazda hesaplanır. Açık kalanlar: kendi Supabase veritabanın, harita görüntüsü (Esri ya da OpenStreetMap; yalnızca baktığın bölgenin görüntüsü istenir), döviz kuru.</p></section>
    <section class="card" data-tab="genel"><h2>Uygulama sürümü</h2><p>Bu cihazda açık sürüm: <b data-surum></b></p><p class="hint">Yeni bir özellik görünmüyorsa “Şimdi güncelle”ye dokun; uygulama en son sürümü indirip yeniden açılır. Verilerin silinmez.</p><div class="btnrow"><button type="button" class="btn" data-guncelle>Şimdi güncelle</button></div></section>
    <section class="card" data-tab="genel"><h2>Telefona yükle</h2>
      ${INST.standalone ? '<p><b>Uygulama yüklü.</b> Simgeye uzun basınca Ziyaret kaydet, Harita, Takvim ve Projeler kısayolları çıkar.</p>' : `<p>Ana ekrana Saha Takip simgesi eklenir, tam ekran açılır ve internet yokken de çalışır.</p><div class="btnrow"><button class="btn primary" data-install>Uygulamayı yükle</button></div>
      <p class="hint">${INST.evt ? 'Düğmeye basınca telefon onay ister.' : isIOS ? 'iPhone: Safari Paylaş düğmesi → “Ana Ekrana Ekle”.' : 'Düğme çalışmazsa Chrome menüsü (⋮) → “Uygulamayı yükle”.'}</p>`}
    </section>
    <section class="card" data-tab="genel"><h2>Bildirimler</h2><div data-bildirim></div></section>
    <section class="card" data-tab="genel"><h2>Döviz kuru</h2><div data-kur></div></section>

    <section class="card" data-tab="veri"><h2>Kayıtlar</h2>
      ${counts.length ? `<p><b>${toplam}</b> kayıt</p><ul class="counts">${counts.map(([t, n]) => `<li><b>${n}</b> ${ETIKET[t]}</li>`).join('')}</ul>` : '<p class="hint">Henüz kayıt yok. Aşağıdan başlangıç verisini yükleyebilirsin.</p>'}
      <div class="btnrow"><a class="btn" href="#/dosyalar">Yüklediğin dosyalar</a><a class="btn ghost" href="#/kontrol">Veri kontrolü</a></div>
    </section>
    <section class="card" data-tab="veri"><h2>Tüm verilerini al ve taşı</h2>
      <p><b>Tam yedek (ZIP):</b> bütün kayıtlar (JSON ve her tablo ayrı CSV), bütün fotoğraf ve belgeler, veritabanı şeması ve taşıma talimatı tek dosyada. Başka bir Supabase hesabına ya da başka bir sunucuya taşımak için bunu kullan.</p>
      <div class="btnrow"><button class="btn primary" data-zip>Tam yedek indir (ZIP)</button><button class="btn ghost" data-zipyukle>Tam yedekten geri yükle</button></div><div class="progress" data-zprog hidden></div>
      <hr><div class="btnrow"><button class="btn" data-xlsx>Tümünü Excel'e aktar</button><button class="btn ghost" data-json>Kayıt yedeği (JSON)</button><button class="btn ghost" data-restore>JSON yedekten geri yükle</button></div>
      <p class="hint">Sipariş, cari ekstresi ve stok Excel'lerinde sütun eşleştirmesi ilk yüklemede sorulur ve hatırlanır. ${Object.keys(ayar('excel_esle', {}) || {}).length ? `Kayıtlı: ${Object.keys(ayar('excel_esle', {})).map(k => ({ siparis: 'sipariş', tahsilat: 'cari ekstresi', stok: 'stok' })[k] || k).join(', ')}. <button type="button" class="linkbtn" data-eslesifirla>Sıfırla</button>` : ''}</p>
      <label class="chk"><input type="checkbox" data-cikti ${ayar('cikti_sakla', true) !== false ? 'checked' : ''}> <span>Aldığım Excel ve PowerPoint çıktılarının bir kopyasını Dosyalar'da sakla</span></label>
    </section>
    <section class="card" data-tab="veri"><h2>Başlangıç verisi</h2>
      <p>Proje takip Excel'inden hazırlanan <b>baslangic-verisi.json</b> dosyası: projeler, firmalar, kişiler, siparişler, stok, rakip fiyatları ve hedefler.</p>
      <div class="btnrow"><button class="btn primary" data-seed>Dosyayı seç ve yükle</button></div><div class="progress" data-prog hidden></div>
      <p class="hint">Kayıtlar ada göre eşleşir: tekrar yüklemek kopya oluşturmaz, haritadaki konumların korunur.</p>
      ${sup && localCount ? `<hr><p>Bu tarayıcıda deneme modunda girilmiş <b>${localCount} kayıt</b> var.</p><div class="btnrow"><button class="btn" data-migrate>Deneme verisini buluta taşı</button></div>` : ''}
    </section>
    <section class="card danger-card" data-tab="veri"><details class="danger-zone"><summary>Tüm verileri sil</summary><p>${sup ? 'Buluttaki' : 'Bu tarayıcıdaki'} tüm kayıtlar silinir ve geri alınamaz. Önce yedek indir.</p><button class="btn danger" data-wipe>Tüm verileri sil</button></details></section>

    <section class="card" data-tab="google"><h2>Google'da arama</h2>
      <p>${googleKey() ? '<b>Google anahtarı kayıtlı.</b> Haritada “Google\'da ara” ile işletmelerin adres, telefon ve konumunu kayıtlarına aktarabilirsin.' : 'Haritada Google\'daki işletmeleri aramak için bir API anahtarı gerekiyor.'}</p>
      <details ${googleKey() ? '' : 'open'}><summary>${googleKey() ? 'Anahtarı değiştir' : 'Anahtar nasıl alınır?'}</summary>${anahtarFormu()}</details>
    </section>
    <section class="card" data-tab="google"><h2>Konum aktar ve dışa aktar</h2>
      <p>Google Benim Haritalarım (KML/KMZ), Takeout'taki kaydedilen yerler ya da Google Haritalar bağlantıları. Anahtar gerekmez.</p>
      <div class="btnrow"><button class="btn" data-gimport>Google'dan konum aktar</button><button class="btn ghost" data-kml>Haritayı KML olarak indir</button></div>
      <p class="hint">KML dosyasını mymaps.google.com'a yükleyince projelerin Google Haritalar'da da görünür.</p>
    </section>
    <section class="card" data-tab="google"><h2>Google Haritalar'dan paylaş</h2>
      <p>Google Haritalar'da bir yere dokun → <b>Paylaş</b> → <b>Saha Takip</b>. Yer yeni firma ya da proje olarak kaydedilir veya mevcut kayda konum atanır. Uygulamanın telefona yüklü olması gerekir.</p>
      <details class="gelismis"><summary>Gelişmiş: kısa bağlantılardan tam konum</summary>
        <p class="hint">Google çoğu zaman <code>maps.app.goo.gl</code> kısa bağlantısı gönderir. Konumu tam okumak için Supabase'e bir kez küçük bir fonksiyon eklenir: Supabase paneli → <b>Edge Functions</b> → <b>Deploy a new function</b> → <b>Via Editor</b> → adı <code>kisa-link</code> → depodaki <code>supabase/functions/kisa-link/index.ts</code> içeriğini yapıştır → <b>Deploy</b>. Eklenmezse konum ad ve adresten bulunur.</p></details>
    </section>

    <section class="card" data-tab="mesaj"><h2>WhatsApp mesaj şablonları</h2><p class="hint">Kişi ve firma kartındaki WhatsApp düğmesi bu şablonları kullanır.</p><div data-sablon></div></section>
    <section class="card" data-tab="mesaj"><h2>Teklif bilgileri</h2><p class="hint">PDF teklifin üst bilgisi ve alt koşulları.</p><div data-teklifb></div></section>
  </div>`;
  let kulYuklendi = false;
  const sekmeGoster = k => {
    if (k === 'kullanici' && !kulYuklendi) { kulYuklendi = true; kullaniciAyarlari(el.querySelector('[data-kullanici]')); import('../gecmis.js').then(m => m.sonDegisiklikler(el.querySelector('[data-sondeg]'))); } el.querySelectorAll('[data-tab]').forEach(x => x.hidden = x.dataset.tab !== k); el.querySelectorAll('[data-sekme]').forEach(b => { b.classList.toggle('on', b.dataset.sekme === k); b.setAttribute('aria-selected', b.dataset.sekme === k); }); };
  el.querySelectorAll('[data-sekme]').forEach(b => b.onclick = () => { f.sekme = b.dataset.sekme; saveFilters(); sekmeGoster(f.sekme); });
  sekmeGoster(f.sekme);
  bindConn(el);
  anahtarBagla(el, () => ayarlarView(el));
  sablonDuzenleyici(el.querySelector('[data-sablon]'));
  kurAyarlari(el.querySelector('[data-kur]'));
  menuAyarlari(el.querySelector('[data-menu]'));
  if (menuAc) setTimeout(() => el.querySelector('#menu-karti')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  bildirimAyarlari(el.querySelector('[data-bildirim]'));
  teklifAyarlari(el.querySelector('[data-teklifb]'));
  el.querySelector('[data-kml]').onclick = () => kmlIndir();
  el.querySelector('[data-gimport]').onclick = () => iceAktarPaneli(() => ayarlarView(el));
  el.querySelector('[data-install]')?.addEventListener('click', install);
  el.querySelector('[data-out]')?.addEventListener('click', async () => { await app.db.signOut(); location.reload(); });
  el.querySelector('[data-seed]').onclick = () => seedYukle(el);
  el.querySelector('[data-migrate]')?.addEventListener('click', () => migrate(el));
  el.querySelector('[data-xlsx]').onclick = () => {
    exportXlsx(`saha-takip-${today()}.xlsx`, {
      'Projeler': S.projeler.map(projeSatiri),
      'Firmalar': S.firmalar.map(f => ({ Firma: f.ad, Tip: (f.tipler || []).join(', '), İl: f.il, İlçe: f.ilce, Telefon: f.telefon, 'E-posta': f.eposta, Notlar: f.notlar })),
      'Kişiler': S.kisiler.map(k => ({ 'Ad soyad': k.ad_soyad, Firma: firmaAd(k.firma_id), Unvan: k.unvan, Telefon: k.telefon, 'E-posta': k.eposta })),
      'Ziyaretler': S.ziyaretler.map(z => ({ Tarih: z.tarih, Firma: firmaAd(z.firma_id), Not: z.notlar })),
      'Siparişler': S.siparisler.map(s => ({ Tarih: s.tarih, Müşteri: s.musteri_adi, Referans: s.referans, Proje: s.proje_tanimi, 'Net değer': s.net_deger, 'Para birimi': s.para_birimi })),
      'Stok': S.urunler.map(u => ({ Kod: u.kod, Açıklama: u.aciklama, Aile: u.aile, Stok: u.stok, 'Birim fiyat': u.birim_fiyat_usd })),
      'Rakip fiyatları': S.rakip_fiyatlar.map(r => ({ Aile: r.aile, Marka: r.marka, Ürün: r.urun_adi, Fiyat: r.birim_fiyat, Not: r.fiyat_metin })),
      'Teklifler': S.teklifler.map(t => ({ 'Teklif no': t.teklif_no, Tarih: t.tarih, Durum: t.durum, Firma: firmaAd(t.firma_id), Proje: S.projeler.find(p => p.id === t.proje_id)?.ad, Kalem: (t.kalemler || []).length, 'Toplam (KDV hariç)': t.toplam, 'Para birimi': t.para_birimi })),
      'Numuneler': S.numuneler.map(n => ({ Ürün: n.urun_ad, Adet: n.adet, Firma: firmaAd(n.firma_id), Veriliş: n.verilis, İade: n.iade_tarihi, Durum: n.durum })),
      'Servis': S.servis_kayitlari.map(x => ({ Tarih: x.tarih, Tür: x.tip, Durum: x.durum, Firma: firmaAd(x.firma_id), Ürün: x.urun, Sorun: x.aciklama, Çözüm: x.cozum })),
      'Tahsilat': S.tahsilatlar.map(t => ({ Cari: firmaAd(t.firma_id) || t.cari, 'Fatura no': t.belge_no, Tarih: t.tarih, Vade: t.vade, Tutar: t.tutar, Ödenen: t.odenen, 'Para birimi': t.para_birimi })),
      'Masraflar': S.masraflar.map(m => ({ Tarih: m.tarih, Tür: m.tip, Tutar: m.tutar, Km: m.km, Açıklama: m.aciklama })),
    });
  };
  import('../state.js').then(m => { const b = el.querySelector('[data-surum]'); if (b) b.textContent = m.SURUM; });
  el.querySelector('[data-guncelle]').onclick = async () => {
    toast('Güncelleniyor…');
    try { const rs = await navigator.serviceWorker?.getRegistrations?.() || []; await Promise.all(rs.map(r => r.update().catch(() => {}))); } catch {}
    try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k !== 'tiles').map(k => caches.delete(k))); } catch {}
    location.reload();
  };
  el.querySelectorAll('[data-tm]').forEach(b => b.onclick = async () => { const { temaSec } = await import('../tema.js'); await temaSec(b.dataset.tm); el.querySelectorAll('[data-tm]').forEach(x => x.classList.toggle('on', x === b)); });
  el.querySelector('[data-cikti]').onchange = e => ayarYaz('cikti_sakla', e.target.checked);
  el.querySelector('[data-eslesifirla]')?.addEventListener('click', async () => { await ayarYaz('excel_esle', null); toast('Excel sütun eşleştirmeleri sıfırlandı; bir sonraki yüklemede yeniden sorulur.'); });
  el.querySelector('[data-gizli]').onchange = async e => { await ayarYaz('gizli_mod', e.target.checked); toast(e.target.checked ? 'Gizli mod açık: Google ve adres servisleri kapatıldı.' : 'Gizli mod kapalı.'); };
  const zprog = el.querySelector('[data-zprog]'), zil = (t, o) => { zprog.hidden = false; zprog.innerHTML = `<span style="width:${Math.round((o || 0) * 100)}%"></span><b>${t}</b>`; };
  el.querySelector('[data-zip]').onclick = async e => {
    e.target.disabled = true; zil('Hazırlanıyor…', 0.02);
    try { const { tamYedekIndir } = await import('../tasima.js'); const r = await tamYedekIndir(zil); zprog.hidden = true; ayarYaz('son_tam_yedek', new Date().toISOString()); toast(`Tam yedek indirildi: ${r.kayit} kayıt, ${r.dosya} dosya, ${(r.boyut / 1048576).toFixed(1).replace('.', ',')} MB${r.eksik ? ` (${r.eksik} dosya alınamadı)` : ''}.`); }
    catch (err) { zprog.hidden = true; toast('Yedek alınamadı: ' + err.message, 'err'); }
    e.target.disabled = false;
  };
  el.querySelector('[data-zipyukle]').onclick = async () => {
    const [f] = await pickFiles({ accept: '.zip,application/zip', multiple: false }); if (!f) return;
    if (!confirmBox('Yedekteki kayıtlar bu hesaba yüklenecek: aynı kimlikli kayıtlar yedekteki haliyle güncellenir, diğerleri eklenir, hiçbir şey silinmez. Devam edilsin mi?')) return;
    try { const { tamYedekHazirla } = await import('../tasima.js'); const r = await tamYedekHazirla(f, zil); zprog.hidden = true; await importAll(r.d, el, 'yedek', null); toast(`Geri yüklendi: ${r.dosya} dosya aktarıldı${r.hata ? `, ${r.hata} dosya yüklenemedi` : ''}.`); }
    catch (err) { zprog.hidden = true; toast('Geri yüklenemedi: ' + err.message, 'err'); }
  };
  el.querySelector('[data-json]').onclick = () => { const ad = `saha-takip-yedek-${today()}.json`, bl = new Blob([JSON.stringify({ version: 1, tarih: new Date().toISOString(), ...Object.fromEntries(ORDER.map(t => [t, S[t]])) })], { type: 'application/json' }); download(ad, bl); import('../belgeler.js').then(m => m.ciktiKaydet(bl, ad, 'Yedek')); };
  el.querySelector('[data-restore]').onclick = async () => {
    const [f] = await pickFiles({ accept: '.json,application/json', multiple: false }); if (!f) return;
    try { const d = JSON.parse(await f.text()); await importAll(d, el, 'yedek', f); } catch (e) { toast('Yedek okunamadı: ' + e.message, 'err'); }
  };
  el.querySelector('[data-wipe]').onclick = async () => {
    if (!confirmBox('Tüm veriler silinsin mi? Bu işlem geri alınamaz.')) return;
    try { await app.db.clearAll(); toast('Tüm veriler silindi.'); ayarlarView(el); } catch (e) { toast(e.message, 'err'); }
  };
}

async function importAll(d, el, mod = 'guncelle', dosya = null) {
  const prog = el.querySelector('[data-prog]'); prog.hidden = false;
  try {
    const { plan, ozet } = birlestir(d, mod);
    const total = Object.values(plan).reduce((a, r) => a + r.length, 0); let done = 0;
    for (const t of ORDER) {
      const rows = plan[t]; if (!rows) continue;
      const base = done;
      await app.db.bulk(t, rows, n => { done = base + n; prog.innerHTML = `<span style="width:${done / Math.max(total, 1) * 100}%"></span><b>${ETIKET[t]} yükleniyor · ${done}/${total}</b>`; });
      done = base + rows.length;
    }
    prog.hidden = true;
    toast(`${ozet.yeni} yeni kayıt eklendi, ${ozet.guncel} kayıt güncellendi${ozet.ayni ? `, ${ozet.ayni} kayıt zaten günceldi` : ''}.`);
    if (dosya) await yuklemeKaydet(dosya, mod === 'yedek' ? 'Yedek' : 'Başlangıç verisi', `${ozet.yeni} yeni, ${ozet.guncel} güncellenen kayıt`);
    ayarlarView(el);
  } catch (e) { console.error(e); prog.hidden = true; toast('Yükleme durdu: ' + e.message + (/relation|does not exist|schema cache|column/i.test(e.message) ? ' — supabase/schema.sql dosyasını Supabase SQL Editor\'de yeniden çalıştırdın mı?' : ''), 'err'); }
}

async function seedYukle(el) {
  const [f] = await pickFiles({ accept: '.json,application/json', multiple: false });
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (e) { return toast('Dosya okunamadı: ' + e.message, 'err'); }
  if (!d.projeler) return toast('Bu dosya başlangıç verisi değil. baslangic-verisi.json dosyasını seç.', 'err');
  if (!S.projeler.length && !S.firmalar.length) return importAll(d, el, 'guncelle', f);
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(d.kaynak || 'Başlangıç verisi')}</p><h2 id="drawer-title">Mevcut verilerle birleştir</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p>Uygulamada zaten <b>${S.projeler.length} proje</b> ve <b>${S.firmalar.length} firma</b> var. Dosyadaki ${(d.projeler || []).length} proje ve ${(d.firmalar || []).length} firma adına göre eşleştirilecek; eşleşmeyenler yeni kayıt olarak eklenir, hiçbir kayıt silinmez.</p>
    <p class="hint">Haritada yerleştirdiğin konumlar, fotoğraflar, kartvizitler ve çizdiğin bölge sınırları her iki seçenekte de korunur. Notlar birleştirilir.</p>
    <div class="choice"><button type="button" class="btn primary" data-m="guncelle">Dosyadaki bilgilerle güncelle</button><small>Durum, tutar, firmalar gibi alanlar dosyadaki haliyle değişir. Excel listen daha güncelse bunu seç.</small></div>
    <div class="choice"><button type="button" class="btn" data-m="ekle">Yalnızca eksikleri tamamla</button><small>Uygulamada değiştirdiğin alanlara dokunulmaz; sadece boş alanlar doldurulur ve yeni kayıtlar eklenir.</small></div></div>`);
  p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { closeDrawer(); importAll(d, el, b.dataset.m, f); });
}

// Deneme modunda (tarayıcıda) girilen veriyi ve fotoğrafları Supabase'e taşır
async function migrate(el) {
  if (!confirmBox('Bu tarayıcıdaki deneme verisi buluta kopyalansın mı?')) return;
  const d = {};
  for (const t of ORDER) d[t] = (await idbGet('t:' + t)) || [];
  const map = new Map();
  const conv = async p => {
    if (!p || !String(p).startsWith('local/')) return p;
    if (map.has(p)) return map.get(p);
    const b = await idbGet(p, 'photos'); if (!b) return null;
    const np = await app.db.upload(new File([b], 'foto.jpg', { type: 'image/jpeg' })); map.set(p, np); return np;
  };
  toast('Fotoğraflar aktarılıyor…');
  for (const t of ['firmalar', 'projeler', 'ziyaretler', 'servis_kayitlari', 'urun_aileleri']) for (const r of d[t]) r.fotolar = (await Promise.all((r.fotolar || []).map(conv))).filter(Boolean);
  for (const m of d.masraflar) m.fis = await conv(m.fis);
  for (const b of d.belgeler) if (String(b.yol).startsWith('local/')) { const blob = await idbGet(b.yol, 'photos'); b.yol = blob ? await app.db.uploadFile(new File([blob], b.ad, { type: b.tur || blob.type })) : null; }
  d.belgeler = d.belgeler.filter(b => b.yol);
  for (const k of d.kisiler) { k.kartvizit_on = await conv(k.kartvizit_on); k.kartvizit_arka = await conv(k.kartvizit_arka); }
  await importAll(d, el, 'yedek');
}
