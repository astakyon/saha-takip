import { S, TABLES, getConfig, setConfig, idbGet } from '../db.js';
import { app } from '../state.js';
import { esc, toast, download, exportXlsx, today, confirmBox, pickFiles, firmaAd } from '../ui.js';
import { projeSatiri } from './projeler.js';
import { birlestir, SIRA } from '../birlestir.js';
import { googleKey, anahtarFormu, anahtarBagla } from '../google.js';
import { iceAktarPaneli } from './ice-aktar.js';
import { openDrawer, closeDrawer } from '../ui.js';
import { INST, isIOS, install, onInstallChange } from '../kurulum.js';

const ORDER = SIRA;
const ETIKET = { bolgeler: 'sanayi bölgesi', firmalar: 'firma', kisiler: 'kişi', projeler: 'proje', proje_gecmis: 'durum geçmişi', ziyaretler: 'ziyaret', gorevler: 'görev', urunler: 'ürün', stok_gecmis: 'stok geçmişi', rakip_fiyatlar: 'rakip fiyatı', siparisler: 'sipariş', hedefler: 'hedef' };

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
    <form class="form" data-login><div class="fld"><label for="l-e">E-posta</label><input id="l-e" type="email" autocomplete="username" required autofocus></div>
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
  el.innerHTML = `<header class="vh"><div><h1>Ayarlar ve veri</h1><p class="sum">${sup ? `Bulut: ${esc(app.db.user()?.email || '')}` : 'Deneme modu: veriler yalnızca bu cihazın tarayıcısında'}</p></div></header>
  <div class="settings">
    <section class="card"><h2>Bağlantı</h2>
      ${sup ? `<p>Supabase'e bağlısın. Telefonda ve bilgisayarda aynı hesapla giriş yapınca aynı veriyi görürsün.${pend ? ` <b>${pend} değişiklik</b> internet bekliyor.` : ''}</p>
        <div class="btnrow"><button class="btn ghost" data-out>Çıkış yap</button></div><details><summary>Bağlantı bilgilerini değiştir</summary>${connForm(cfg)}</details>`
      : `<p>Şu an deneme modundasın. Uygulamayı deneyebilirsin ama veriler sadece bu tarayıcıda durur. Telefon ve bilgisayarda ortak kullanım için Supabase bilgilerini gir.</p>${connForm(cfg)}`}
    </section>
    <section class="card"><h2>Başlangıç verisi</h2>
      <p>Proje takip Excel'inden hazırlanan veri: projeler, firmalar ve yetkilileri, ziyaretler, sanayi bölgeleri, siparişler, bayi stoğu, rakip fiyatları ve hedefler.</p>
      <p class="hint">Kayıtlar ada göre eşleştirilir: tekrar yüklemek kopya oluşturmaz, haritada yerleştirdiğin konumlar korunur.</p>
      <p class="hint">Müşteri bilgilerin internete açık olmasın diye bu veri uygulamanın içinde değil, sana ayrıca verilen <b>baslangic-verisi.json</b> dosyasında. Dosyayı seçince kayıtlar ${sup ? 'buluta' : 'bu tarayıcıya'} yüklenir.</p>
      <div class="btnrow"><button class="btn primary" data-seed>Başlangıç verisi dosyasını seç</button></div><div class="progress" data-prog hidden></div>
      ${sup && localCount ? `<hr><p>Bu tarayıcıda deneme modunda girilmiş <b>${localCount} kayıt</b> var.</p><div class="btnrow"><button class="btn" data-migrate>Deneme verisini buluta taşı</button></div>` : ''}
    </section>
    <section class="card"><h2>Google Haritalar</h2>
      <p>${googleKey() ? '<b>Google API anahtarı kayıtlı.</b> Haritada “Google\'da ara” ile işletmeleri bulup adres, telefon, web ve konumlarını kayıtlarına aktarabilirsin.' : 'Google\'daki işletmeleri arayıp bilgilerini çekmek için bir API anahtarı gerekiyor.'}</p>
      <details ${googleKey() ? '' : 'open'}><summary>${googleKey() ? 'Anahtarı değiştir' : 'Anahtar nasıl alınır?'}</summary>${anahtarFormu()}</details>
      <hr><p><b>Google'dan konum aktar:</b> Google Benim Haritalarım (KML/KMZ), Google Takeout'taki kaydedilen yerler (JSON, CSV) veya Google Haritalar bağlantıları. Bunun için API anahtarı gerekmez.</p>
      <div class="btnrow"><button class="btn" data-gimport>Google'dan konum aktar</button></div>
    </section>
    <section class="card"><h2>Kayıtlar</h2>
      ${counts.length ? `<ul class="counts">${counts.map(([t, n]) => `<li><b>${n}</b> ${ETIKET[t]}</li>`).join('')}</ul>` : '<p class="hint">Henüz kayıt yok.</p>'}
      <div class="btnrow"><button class="btn" data-xlsx>Tümünü Excel'e aktar</button><button class="btn ghost" data-json>Yedek indir (JSON)</button><button class="btn ghost" data-restore>Yedekten geri yükle</button></div>
      <details class="danger-zone"><summary>Tüm verileri sil</summary><p>Bu işlem ${sup ? 'buluttaki' : 'bu tarayıcıdaki'} tüm kayıtları siler ve geri alınamaz. Önce yedek indir.</p><button class="btn danger" data-wipe>Tüm verileri sil</button></details>
    </section>
    <section class="card"><h2>Telefona uygulama olarak yükle</h2>
      ${INST.standalone ? '<p><b>Uygulama yüklü.</b> Ana ekrandaki “Saha Takip” simgesinden açıyorsun.</p>' : `<div class="btnrow"><button class="btn primary" data-install>Uygulamayı yükle</button></div>
      <p class="hint">${INST.evt ? 'Düğmeye basınca telefon yükleme onayı ister.' : isIOS ? 'iPhone\'da Safari\'nin Paylaş düğmesi → “Ana Ekrana Ekle”.' : 'Düğme çalışmazsa Chrome menüsünden (⋮) “Uygulamayı yükle” veya “Ana ekrana ekle”yi seç.'}</p>`}
      <p>Yüklenince uygulama listende ve ana ekranında <b>Saha Takip</b> simgesi olur; tam ekran açılır. Simgeye uzun basınca <b>Ziyaret kaydet</b>, <b>Harita</b>, <b>Takvim</b> ve <b>Projeler</b> kısayolları çıkar.</p>
      <p class="hint">İnternet yokken son yüklenen veriler görünür; değişiklikler bağlantı gelince gönderilir. Uygulama ben yeni sürüm gönderdikçe kendiliğinden güncellenir.</p>
    </section>
  </div>`;
  bindConn(el);
  anahtarBagla(el, () => ayarlarView(el));
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
    });
  };
  el.querySelector('[data-json]').onclick = () => download(`saha-takip-yedek-${today()}.json`, JSON.stringify({ version: 1, tarih: new Date().toISOString(), ...Object.fromEntries(ORDER.map(t => [t, S[t]])) }));
  el.querySelector('[data-restore]').onclick = async () => {
    const [f] = await pickFiles({ accept: '.json,application/json', multiple: false }); if (!f) return;
    try { const d = JSON.parse(await f.text()); await importAll(d, el, 'yedek'); } catch (e) { toast('Yedek okunamadı: ' + e.message, 'err'); }
  };
  el.querySelector('[data-wipe]').onclick = async () => {
    if (!confirmBox('Tüm veriler silinsin mi? Bu işlem geri alınamaz.')) return;
    try { await app.db.clearAll(); toast('Tüm veriler silindi.'); ayarlarView(el); } catch (e) { toast(e.message, 'err'); }
  };
}

async function importAll(d, el, mod = 'guncelle') {
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
    ayarlarView(el);
  } catch (e) { console.error(e); prog.hidden = true; toast('Yükleme durdu: ' + e.message + (/relation|does not exist|schema cache|column/i.test(e.message) ? ' — supabase/schema.sql dosyasını Supabase SQL Editor\'de yeniden çalıştırdın mı?' : ''), 'err'); }
}

async function seedYukle(el) {
  const [f] = await pickFiles({ accept: '.json,application/json', multiple: false });
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (e) { return toast('Dosya okunamadı: ' + e.message, 'err'); }
  if (!d.projeler) return toast('Bu dosya başlangıç verisi değil. baslangic-verisi.json dosyasını seç.', 'err');
  if (!S.projeler.length && !S.firmalar.length) return importAll(d, el, 'guncelle');
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(d.kaynak || 'Başlangıç verisi')}</p><h2 id="drawer-title">Mevcut verilerle birleştir</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p>Uygulamada zaten <b>${S.projeler.length} proje</b> ve <b>${S.firmalar.length} firma</b> var. Dosyadaki ${(d.projeler || []).length} proje ve ${(d.firmalar || []).length} firma adına göre eşleştirilecek; eşleşmeyenler yeni kayıt olarak eklenir, hiçbir kayıt silinmez.</p>
    <p class="hint">Haritada yerleştirdiğin konumlar, fotoğraflar, kartvizitler ve çizdiğin bölge sınırları her iki seçenekte de korunur. Notlar birleştirilir.</p>
    <div class="choice"><button type="button" class="btn primary" data-m="guncelle">Dosyadaki bilgilerle güncelle</button><small>Durum, tutar, firmalar gibi alanlar dosyadaki haliyle değişir. Excel listen daha güncelse bunu seç.</small></div>
    <div class="choice"><button type="button" class="btn" data-m="ekle">Yalnızca eksikleri tamamla</button><small>Uygulamada değiştirdiğin alanlara dokunulmaz; sadece boş alanlar doldurulur ve yeni kayıtlar eklenir.</small></div></div>`);
  p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { closeDrawer(); importAll(d, el, b.dataset.m); });
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
  for (const t of ['firmalar', 'projeler', 'ziyaretler']) for (const r of d[t]) r.fotolar = (await Promise.all((r.fotolar || []).map(conv))).filter(Boolean);
  for (const k of d.kisiler) { k.kartvizit_on = await conv(k.kartvizit_on); k.kartvizit_arka = await conv(k.kartvizit_arka); }
  await importAll(d, el, 'yedek');
}
