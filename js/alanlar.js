// Alan kuralları: hangi kayıtta hangi alan zorunlu / önemli / ek, nasıl doldurulur, neden önemli, ağırlığı.
// Veri kontrol merkezi (Raporlar → Eksik bilgiler), doluluk puanı, günlük eksik veri kartı ve uyarılar bu tek tanımdan beslenir.
import { S } from './db.js';
import { app } from './state.js';
import { byId, firmaAd, fold, today, gunEkle, ACIK, FIRMA_TIPLERI, ILLER, ILCELER } from './ui.js';
import { ayar } from './ayar.js';
import { kurallar, vergiIstenir } from './zorunlu.js';
import { vergiTemiz, firmaOner } from './cari.js';
import { siparisUsd } from './ceyrek.js';
import { kur } from './kur.js';
import { usdYap } from './vaderisk.js';

export const ONEM = { zorunlu: { ad: 'Zorunlu', w: 3 }, onemli: { ad: 'Önemli', w: 2 }, ek: { ad: 'Ek', w: 1 } };
const zoe = v => v === 'kapali' ? null : v;            // kural değeri → önem
const bos = v => v == null || v === '' || (Array.isArray(v) && !v.length);
const ekipVar = () => (app.ekip || []).filter(u => u.aktif !== false && !u.dis_firma_id).length > 0;
const ROL = ['emut_id', 'gemut_id', 'alici_id', 'bayi_id'];

// t: text | num | date | sel | il (il + ilçe) | ref (firma seç) | tip (firma tipi) | kisi (sorumlu)
export const VARLIKLAR = [
  { k: 'firmalar', ad: 'Firmalar ve cari', tablo: 'firmalar', baslik: x => x.ad, link: x => '#/firma/' + x.id, kapsam: () => (S.firmalar || []),
    alanlar: [
      { k: 'konum', l: 'Konum (il + ilçe ya da harita)', t: 'il', onem: () => zoe(kurallar().firmaKonum), eksik: x => x.lat == null && !(x.il && x.ilce), neden: 'Harita, rota, yakındaki firmalar ve bölge raporları konumla çalışır.' },
      { k: 'vergi_no', l: 'Vergi no', t: 'text', onem: x => vergiIstenir(x) ? (kurallar().vergi === 'zorunlu' ? 'zorunlu' : 'onemli') : null, eksik: x => !vergiTemiz(x.vergi_no), neden: 'Fatura, cari hesap ve muhasebeye aktarım bu numarayla eşleşir; teklif ve siparişte istenir.' },
      { k: 'vergi_dairesi', l: 'Vergi dairesi', t: 'text', onem: x => vergiIstenir(x) ? (kurallar().vergi === 'zorunlu' ? 'zorunlu' : 'onemli') : null, eksik: x => bos(x.vergi_dairesi), neden: 'Fatura ve cari kayıt için gerekir.' },
      { k: 'unvan', l: 'Ticari unvan', t: 'text', onem: x => vergiIstenir(x) ? 'ek' : null, eksik: x => bos(x.unvan), neden: 'Faturadaki tam ad; muhasebe listesiyle eşleştirmeyi kolaylaştırır.' },
      { k: 'tipler', l: 'Firma tipi', t: 'tip', onem: () => 'onemli', eksik: x => bos(x.tipler), neden: 'Hangi rolde olduğu (emüt, bayi, müşteri…) raporları ve zorunlu alan kurallarını belirler.' },
      { k: 'telefon', l: 'Telefon', t: 'text', onem: () => 'onemli', eksik: x => bos(x.telefon), neden: 'Tek dokunuşla arama ve WhatsApp için.' },
      { k: 'eposta', l: 'E-posta', t: 'text', onem: () => 'ek', eksik: x => bos(x.eposta), neden: 'Teklif ve ekstre gönderimi için.' },
      { k: 'sorumlu', l: 'Sorumlu', t: 'kisi', onem: () => ekipVar() ? 'onemli' : null, eksik: x => bos(x.sorumlu), neden: 'Kimin takip ettiği belli olmazsa firma unutulur; ekip raporları sorumluya göre çıkar.' },
    ] },
  { k: 'kisiler', ad: 'Kişiler', tablo: 'kisiler', baslik: x => x.ad_soyad || x.ad, link: x => '#/kisi/' + x.id, kapsam: () => (S.kisiler || []),
    alanlar: [
      { k: 'firma_id', l: 'Firması', t: 'ref', onem: () => zoe(kurallar().kisiFirma), eksik: x => !x.firma_id, neden: 'Kişi firma kartında, organizasyon şemasında ve projelerde ancak firmasıyla görünür.' },
      { k: 'telefon', l: 'Telefon', t: 'text', onem: () => zoe(kurallar().kisiIletisim), eksik: x => bos(x.telefon) && bos(x.eposta), neden: 'Ulaşamadığın kişiyle ilişki sıcak tutulamaz.' },
      { k: 'eposta', l: 'E-posta', t: 'text', onem: () => 'ek', eksik: x => bos(x.eposta), neden: 'Teklif ve bülten gönderimi için.' },
      { k: 'unvan', l: 'Görevi / unvanı', t: 'text', onem: () => 'ek', eksik: x => bos(x.unvan) && bos(x.pozisyon), neden: 'Karar verici kim, organizasyon şemasında görünür.' },
      { k: 'ticari_ileti', l: 'Tanıtım mesajı izni', t: 'sel', opts: () => ['Evet', 'Hayır'], onem: () => 'ek', eksik: x => bos(x.ticari_ileti), neden: 'Tanıtım e-postası, SMS ya da WhatsApp göndermeden önce izin olup olmadığı bilinmeli (İYS / KVKK).' },
    ] },
  { k: 'projeler', ad: 'Projeler', tablo: 'projeler', baslik: x => x.ad, link: x => '#/proje/' + x.id, kapsam: () => (S.projeler || []).filter(p => !p.aday),
    alanlar: [
      { k: 'il', l: 'İl', t: 'il', onem: () => zoe(kurallar().projeIl), eksik: x => !x.il && x.lat == null, neden: 'Harita, bölge raporları ve yakındaki projeler.' },
      { k: 'tutar_usd', l: 'Tutar (USD)', t: 'num', onem: x => ACIK.includes(x.durum) ? zoe(kurallar().projeTutar) : null, eksik: x => !(+x.tutar_usd > 0), neden: 'Satış hunisi, tahmin ve hedef raporları tutarsız eksik çıkar.' },
      { k: 'beklenen_tarih', l: 'Beklenen sipariş tarihi', t: 'date', onem: x => ACIK.includes(x.durum) ? zoe(kurallar().projeTutar) : null, eksik: x => bos(x.beklenen_tarih), neden: 'Çeyrek tahmini ve "bu ay kapanacaklar" listesi bu tarihle çalışır.' },
      { k: 'paydas', l: 'Emüt / gemüt / alıcı', t: 'ref', alanAd: 'emut_id', onem: x => ACIK.includes(x.durum) || x.durum === 'Sipariş' ? 'onemli' : null, eksik: x => !ROL.some(r => x[r]), neden: 'Projeyi kimin üzerinden sattığın; firma kartında ve kayıp analizinde görünür.' },
      { k: 'olasilik', l: 'Olasılık (%)', t: 'num', onem: x => ACIK.includes(x.durum) ? 'ek' : null, eksik: x => bos(x.olasilik), neden: 'Ağırlıklı satış tahmini için.' },
      { k: 'rakip_marka', l: 'Kaybedilen marka', t: 'text', onem: x => x.durum === 'Kayıp' ? 'onemli' : null, eksik: x => bos(x.rakip_marka), neden: 'Kayıp analizi ve rakip raporu.' },
      { k: 'sorumlu', l: 'Sorumlu', t: 'kisi', onem: x => ekipVar() && ACIK.includes(x.durum) ? 'onemli' : null, eksik: x => bos(x.sorumlu), neden: 'Ekipte kimin takip ettiği.' },
    ] },
  { k: 'satis', ad: 'Teklif ve sipariş', tablo: null, alt: [
    { tablo: 'teklifler', baslik: x => `Teklif ${x.teklif_no || ''}`.trim(), link: () => '#/teklifler', kapsam: () => (S.teklifler || []).filter(t => t.durum !== 'Reddedildi'),
      alanlar: [{ k: 'firma_id', l: 'Firma', t: 'ref', onem: () => 'onemli', eksik: x => !x.firma_id, neden: 'Firmaya bağlı olmayan teklif firma kartında ve cari hesapta görünmez.' },
        { k: 'proje_id', l: 'Proje', t: 'proje', onem: () => 'ek', eksik: x => !x.proje_id, neden: 'Proje hunisinde teklif görünür.' }] },
    { tablo: 'siparisler', baslik: x => `Sipariş ${x.siparis_no || x.belge_no || ''} ${x.musteri_adi ? '· ' + x.musteri_adi : ''}`.trim(), link: () => '#/siparisler', kapsam: () => (S.siparisler || []).filter(s => !s.rapor_disi),
      alanlar: [{ k: 'firma_id', l: 'Firma', t: 'ref', onem: () => 'onemli', eksik: x => !x.firma_id, oneriAd: x => x.musteri_adi, neden: 'Firma kartı, bayi karnesi ve cari hesap siparişi firmayla bulur.' },
        { k: 'proje_id', l: 'Proje', t: 'proje', onem: () => 'ek', eksik: x => !x.proje_id, neden: 'Projenin kazanıldığını ve tutarını gösterir.' }] },
  ] },
  { k: 'finans', ad: 'Finans', tablo: null, alt: [
    { tablo: 'tahsilatlar', baslik: x => `${x.tur || 'Fatura'} ${x.belge_no || ''} · ${x.cari || firmaAd(x.firma_id) || ''}`.trim(), link: () => '#/tahsilat', kapsam: () => (S.tahsilatlar || []),
      alanlar: [{ k: 'firma_id', l: 'Firma', t: 'ref', onem: () => 'onemli', eksik: x => !x.firma_id, oneriAd: x => x.cari, neden: 'Cari hesap ve yaşlandırma firmaya göre çıkar.' },
        { k: 'vade', l: 'Vade', t: 'date', onem: x => (x.tur || 'Fatura') === 'Fatura' ? 'onemli' : null, eksik: x => bos(x.vade), neden: 'Yaşlandırma, gecikme ve nakit akışı vadeyle hesaplanır.' }] },
    { tablo: 'cekler', baslik: x => `${x.tur || 'Çek'} ${x.belge_no || ''} · ${firmaAd(x.firma_id) || x.kesideci || ''}`.trim(), link: () => '#/cekler', kapsam: () => (S.cekler || []),
      alanlar: [{ k: 'firma_id', l: 'Firma', t: 'ref', onem: () => 'onemli', eksik: x => !x.firma_id, oneriAd: x => x.kesideci, neden: 'Çek firmanın carisinde ve risk hesabında görünür.' },
        { k: 'durum', l: 'Durum (vadesi geçti)', t: 'sel', opts: x => x.yon === 'Verilen' ? ['Ödendi', 'Ödenecek', 'İade'] : ['Tahsil edildi', 'Bankada tahsilde', 'Ciro edildi', 'Karşılıksız', 'İade'], onem: x => x.vade && x.vade < today() && ['Portföyde', 'Ödenecek'].includes(x.durum || 'Portföyde') ? 'onemli' : null, eksik: () => true, neden: 'Nakit akışı ve uyarılar vadesi geçmiş çekin akıbetini bilmeli.' }] },
  ] },
  { k: 'bayiler', ad: 'Bayiler', tablo: 'bayiler', baslik: x => firmaAd(x.firma_id) || 'Bayi', link: () => '#/bayiag', kapsam: () => (S.bayiler || []).filter(b => (b.durum || 'Aktif') !== 'Ayrıldı'),
    alanlar: [
      { k: 'hedef_yil', l: 'Yıllık hedef (USD)', t: 'num', onem: () => 'onemli', eksik: x => !(+x.hedef_yil > 0), neden: 'Hedef ve prim, uyarılar ve sıralama hedefle hesaplanır.' },
      { k: 'sorumlu', l: 'Sorumlu', t: 'kisi', onem: () => ekipVar() ? 'onemli' : null, eksik: x => bos(x.sorumlu), neden: 'Bayiyi kim takip ediyor.' },
      { k: 'il', l: 'İl / bölge', t: 'sel', opts: () => ILLER, onem: () => 'ek', eksik: x => bos(x.il) && bos(x.bolge) && !byId('firmalar', x.firma_id)?.il, neden: 'Bölge boşlukları analizi.' },
      { k: 'stok', l: 'Stok (30 günde güncellenmedi)', t: 'link', git: () => '#/bayistok', onem: () => 'onemli', eksik: x => { const l = (S.bayi_stok || []).filter(s => s.firma_id === x.firma_id); return !l.length || !l.some(s => (s.son_hareket || String(s.updated_at || '').slice(0, 10)) >= gunEkle(today(), -30)); }, neden: 'Teklifte stok bilgisi, devir hızı ve hareketsiz stok uyarısı güncel stokla doğru çıkar.' },
    ] },
  { k: 'urunler', ad: 'Ürünler', tablo: 'urunler', baslik: x => `${x.kod} · ${x.aciklama || ''}`, link: () => '#/urunler', kapsam: () => (S.urunler || []),
    alanlar: [
      { k: 'birim_fiyat_usd', l: 'Birim fiyat (USD)', t: 'num', onem: () => 'onemli', eksik: x => x.birim_fiyat_usd == null || x.birim_fiyat_usd === '', neden: 'Teklif, stok değeri ve hareketsiz stok tutarı fiyatla hesaplanır.' },
      { k: 'aile', l: 'Ürün ailesi', t: 'text', onem: () => 'ek', eksik: x => bos(x.aile), neden: 'Katalog ve satış analizleri aileye göre gruplanır.' },
      { k: 'birim', l: 'Birim', t: 'text', onem: () => 'ek', eksik: x => bos(x.birim), neden: 'Teklif satırında birim.' },
    ] },
];
export const varlik = k => VARLIKLAR.find(v => v.k === k);
export const parcalar = v => v.alt || [{ tablo: v.tablo, baslik: v.baslik, link: v.link, kapsam: v.kapsam, alanlar: v.alanlar }];

// "Bilinmiyor / yok" işaretleri: o alan o kayıtta bir daha sorulmaz, eksik sayılmaz
export const yokAnahtar = (t, id, k) => `${t}:${id}:${k}`;
export const yoklar = () => ayar('eksik_yok') || {};

// Bir kaydın eksikleri: [{ alan, onem }] + doluluk %
export function kayitEksik(p, x, Y = yoklar()) {
  let top = 0, dolu = 0; const eksik = [];
  for (const a of p.alanlar) {
    const o = a.onem(x); if (!o) continue;
    const w = ONEM[o].w; top += w;
    if (a.eksik(x) && !Y[yokAnahtar(p.tablo, x.id, a.k)]) eksik.push({ a, onem: o }); else dolu += w;
  }
  return { eksik, top, dolu, yuzde: top ? Math.round(dolu / top * 100) : 100 };
}
export function firmaDoluluk(f) { return kayitEksik(parcalar(varlik('firmalar'))[0], f); }

// ---------- Kaydın değeri (önem puanı için) ----------
let _deg = null, _degT = 0;
function degerHaritasi() {
  if (_deg && Date.now() - _degT < 3000) return _deg;
  const k = kur()?.USD, yil = gunEkle(today(), -365), m = new Map(), ekle = (id, v) => id && m.set(id, (m.get(id) || 0) + v);
  for (const s of S.siparisler || []) if ((s.tarih || '') >= yil && !s.rapor_disi) { const v = siparisUsd(s, k); ekle(s.firma_id, v); ekle(s.bayi_id, v * 0.5); }
  for (const p of S.projeler || []) if (ACIK.includes(p.durum)) for (const r of ROL) ekle(p[r], (+p.tutar_usd || 0) * 0.5);
  for (const t of S.tahsilatlar || []) if (t.firma_id) ekle(t.firma_id, usdYap(Math.max(0, (+t.tutar || 0) - (+t.odenen || 0)), t.para_birimi));
  _deg = m; _degT = Date.now(); return m;
}
export function kayitDegeri(tablo, x) {
  const m = degerHaritasi();
  if (tablo === 'firmalar') return m.get(x.id) || 0;
  if (tablo === 'kisiler') return (m.get(x.firma_id) || 0) * 0.5;
  if (tablo === 'projeler') return ACIK.includes(x.durum) ? +x.tutar_usd || 20000 : 0;
  if (tablo === 'bayiler') return (m.get(x.firma_id) || 0) + (+x.hedef_yil || 0) * 0.2;
  if (tablo === 'tahsilatlar') return usdYap(+x.tutar || 0, x.para_birimi);
  if (tablo === 'cekler') return usdYap(+x.tutar || 0, x.para_birimi || 'TRY');
  if (tablo === 'siparisler') return siparisUsd(x, kur()?.USD);
  if (tablo === 'teklifler') return usdYap(+x.toplam || 0, x.para_birimi || 'USD');
  return 0;
}
// Önem puanı: eksik alan ağırlıkları × (1 + kaydın değerinin büyüklüğü)
export const onemPuani = (tablo, x, eksik) => Math.round(eksik.reduce((a, e) => a + ONEM[e.onem].w, 0) * (1 + Math.log10(1 + kayitDegeri(tablo, x) / 1000)) * 10) / 10;

// ---------- Diğer verilerden öneri ----------
// { deger, metin, kaynak } ya da null
export function oneri(tablo, x, a) {
  if (tablo === 'firmalar' && a.k === 'konum') {
    const z = (S.ziyaretler || []).filter(v => v.firma_id === x.id && v.lat != null && (v.giris_mesafe == null || v.giris_mesafe < 300));
    if (z.length) { const ort = k => z.reduce((s, v) => s + +v[k], 0) / z.length; return { deger: { lat: +ort('lat').toFixed(6), lng: +ort('lng').toFixed(6), konum_yaklasik: false }, metin: `${z.length} ziyaret girişinin konumu`, kaynak: 'ziyaret' }; }
    const adr = fold(x.adres || '');
    for (const il of ILLER) { if (!adr.includes(fold(il)) && x.il !== il) continue; const ilce = (ILCELER[il] || []).find(i => adr.includes(fold(i))); if (ilce || x.il === il) return ilce ? { deger: { il, ilce }, metin: `${il} / ${ilce} (adresten)`, kaynak: 'adres' } : null; }
    const p = (S.projeler || []).find(p => ROL.some(r => p[r] === x.id) && p.il && p.ilce);
    if (p) return { deger: { il: p.il, ilce: p.ilce }, metin: `${p.il} / ${p.ilce} (projesinden)`, kaynak: 'proje' };
  }
  if (tablo === 'firmalar' && (a.k === 'telefon' || a.k === 'eposta')) {
    const k = (S.kisiler || []).find(k => k.firma_id === x.id && k[a.k]); if (k) return { deger: { [a.k]: k[a.k] }, metin: `${k[a.k]} (${k.ad_soyad || 'kişisi'})`, kaynak: 'kisi' };
  }
  if (tablo === 'projeler' && a.k === 'il') {
    const f = ROL.map(r => byId('firmalar', x[r])).find(f => f?.il); if (f) return { deger: { il: f.il, ilce: f.ilce || null }, metin: `${f.il} (${f.ad})`, kaynak: 'firma' };
  }
  if (tablo === 'kisiler' && a.k === 'firma_id' && x.eposta && /@/.test(x.eposta)) {
    const d = x.eposta.split('@')[1].toLowerCase(); if (!/gmail|hotmail|yahoo|outlook|icloud|yandex/.test(d)) { const f = (S.firmalar || []).find(f => (f.eposta || '').toLowerCase().endsWith('@' + d) || (f.web || '').toLowerCase().includes(d)); if (f) return { deger: { firma_id: f.id }, metin: `${f.ad} (e-posta alan adı)`, kaynak: 'eposta' }; }
  }
  if (a.t === 'ref' && a.k === 'firma_id' && a.oneriAd) { const f = firmaOner(a.oneriAd(x)); if (f) return { deger: { firma_id: f.id }, metin: `${f.ad} (adı benziyor)`, kaynak: 'ad' }; }
  return null;
}
