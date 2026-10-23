import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, num, pill, tarih, today, DURUMLAR, ACIK, ILLER, ILCELER, OSBLER, RAKIPLER, KAYIP_NEDENLERI, URUN_AILELERI, SEKTORLER,
  byId, firmaAd, match, toast, openDrawer, closeDrawer, exportXlsx, directionsUrl, confirmBox, durumRenk, SANTIYE, olasilik, gunEkle, fold } from '../ui.js';
import { teklifForm } from './teklif.js';
import { numuneForm } from './kayitlar.js';
import { belgeBolumu, belgeleri } from '../belgeler.js';
import { kayitGecmisi } from '../gecmis.js';
import { siparisForm } from './panel.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { googleBul, aramaMetni } from '../google.js';
import { backToList } from '../main.js';
import { ziyaretForm, gorevForm } from './ziyaret.js';
import { ayar, ayarYaz } from '../ayar.js';

// Proje formu: yeni projede yalnızca gerekli alanlar açık; ayrıntılar açılır bölümlerde
const yeniMi = o => !!o._new;
export const PROJE_FORM = [
  { title: 'Proje', fields: [
    { k: 'ad', l: 'Proje adı', auto: true, full: true, req: true, ph: 'Örn. Oyak Çimento Ek Kapsam' },
    { k: 'durum', l: 'Aşama', t: 'sel', opts: DURUMLAR.map(d => d.k), ph: 'Seç' },
    { k: 'tutar_usd', l: 'Tahmini tutar (USD)', t: 'num' },
    { k: 'beklenen_tarih', l: 'Beklenen sipariş tarihi', t: 'date' },
    { k: 'takip_yili', l: 'Takip yılı', t: 'sel', opts: [2025, 2026, 2027, 2028].map(String) },
  ]},
  { title: 'Firmalar', ozet: 'Emüt, Gemüt, alıcı, bayi…', kapali: o => !yeniMi(o), note: 'Firma adını yaz. Listede yoksa kaydederken yeni firma olarak eklenir.', fields: [
    { k: 'emut_id', l: 'Emüt (elektrik müteahhidi)', t: 'ref', ref: 'firmalar', tip: 'Emüt' },
    { k: 'alici_id', l: 'Malzeme alıcısı', t: 'ref', ref: 'firmalar', tip: 'Malzeme Alıcısı' },
    { k: 'gemut_id', l: 'Gemüt (genel müteahhit)', t: 'ref', ref: 'firmalar', tip: 'Gemüt' },
    { k: 'yatirimci_id', l: 'Yatırımcı / işveren', t: 'ref', ref: 'firmalar', tip: 'Yatırımcı' },
    { k: 'kanal', l: 'Satış kanalı', t: 'sel', opts: ['Bayi', 'Direkt'] },
    { k: 'bayi_id', l: 'Bayi', t: 'ref', ref: 'firmalar', tip: 'Bayi', show: o => o.kanal !== 'Direkt' },
    { k: 'projeci_id', l: 'Projeyi çizen firma', t: 'ref', ref: 'firmalar', tip: 'Proje Bürosu' },
    { k: 'danisman_id', l: 'Danışman / kontrolör', t: 'ref', ref: 'firmalar', tip: 'Danışman' },
    { k: 'ilgili_kisi_id', l: 'Proje ilgilisi (kişi)', t: 'ref', ref: 'kisiler' },
    { k: 'takipci', l: 'Takip eden (bayi / ekip)' },
    { k: 'takipci_tel', l: 'Takip eden telefonu', t: 'tel' },
    { k: 'calisildi', l: 'Proje çalışıldı mı?', t: 'combo', opts: ['Çalışıldı - Drv', 'Çalışıldı - EAE', 'Çalışıldı - Ben', 'Çalışılmadı'] },
  ]},
  { title: 'Konum', ozet: 'harita, il, ilçe, OSB', kapali: o => !yeniMi(o), fields: [
    { k: 'loc', l: 'Harita konumu', t: 'loc' },
    { k: 'il', l: 'İl', t: 'sel', opts: [...ILLER, 'Diğer'] },
    { k: 'ilce', l: 'İlçe', t: 'combo', opts: o => ILCELER[o.il] || [] },
    { k: 'osb', l: 'OSB / sanayi bölgesi', t: 'combo', opts: o => OSBLER[o.il] || Object.values(OSBLER).flat() },
    { k: 'belde', l: 'Belde / mahalle' },
    { k: 'lokasyon', l: 'Lokasyon notu' },
    { k: 'adres', l: 'Adres', full: true },
  ]},
  { id: 'sip', title: 'Sipariş', show: o => o.durum === 'Sipariş', fields: [
    { k: 'siparis_tutari_usd', l: 'Sipariş tutarı (USD)', t: 'num' },
    { k: 'siparis_tarihi', l: 'Sipariş tarihi', t: 'date' },
  ]},
  { id: 'kayip', title: 'Kayıp bilgisi', show: o => o.durum === 'Kayıp', note: 'Birim fiyat girersen rakip fiyat listesine de eklenir.', fields: [
    { k: 'kayip_nedeni', l: 'Kayıp nedeni', t: 'sel', opts: KAYIP_NEDENLERI },
    { k: 'rakip_marka', l: 'İşi alan marka', t: 'combo', opts: RAKIPLER },
    { k: 'rakip_urun', l: 'Rakip ürün' },
    { k: 'rakip_birim_fiyat', l: 'Rakip birim fiyat (USD)', t: 'num' },
    { k: 'rakip_miktar', l: 'Miktar (adet)', t: 'num' },
    { k: 'rakip_toplam_usd', l: 'Rakip toplam fiyat (USD)', t: 'num', help: 'Birim fiyat × miktar girilince otomatik hesaplanır' },
    { k: 'bizim_teklif_usd', l: 'Bizim teklif tutarı (USD)', t: 'num' },
    { k: 'bizim_urun', l: 'Bizim teklif ettiğimiz ürün' },
    { k: 'kayip_aciklama', l: 'Kayıp nedeni detayı', t: 'area', full: true },
  ]},
  { title: 'Notlar ve fotoğraflar', kapali: false, fields: [
    { k: 'notlar', l: 'Notlar', t: 'area', rows: 3 },
    { k: 'fotolar', l: 'Proje fotoğrafları', t: 'photos' },
  ]},
  { title: 'Satış ayrıntıları', ozet: 'olasılık, şantiye, ürünler, teklif no', kapali: true, fields: [
    { k: 'olasilik', l: 'Kazanma olasılığı (%)', t: 'num', help: 'Boş bırakırsan aşamaya göre hesaplanır' },
    { k: 'santiye_asamasi', l: 'Şantiye aşaması', t: 'sel', opts: SANTIYE, help: 'İnce işler ve elektrik tesisatı aşamasında Bugün ekranı ziyaret hatırlatır' },
    { k: 'alim_tarihi', l: 'Tahmini aydınlatma alımı', t: 'date', help: '30 gün kala Bugün ekranında uyarı çıkar' },
    { k: 'urun_gruplari', l: 'Ürün grupları', t: 'tags', opts: URUN_AILELERI, free: true },
    { k: 'teklif_no', l: 'Teklif no' },
    { k: 'crm_kodu', l: 'CRM kart no' },
    { k: 'durum_alt', l: 'Durum notu', t: 'combo', opts: ['Drv depodan', 'AOSB genişleme', 'Sözlü onay', 'İhaleye çıkacak'], ph: 'İsteğe bağlı' },
    { k: 'sorulacak', l: 'Sorulacak / yapılacak' },
    { k: 'ziyaret_edilecek', l: 'Ziyaret', t: 'chk', cl: 'Ziyaret edilecek' },
  ]},
  { title: 'Sınıflandırma', ozet: 'sektör, kapsam, listeler', kapali: true, fields: [
    { k: 'sektor', l: 'Sektör', t: 'combo', opts: SEKTORLER },
    { k: 'alt_sektor', l: 'Alt sektör' },
    { k: 'yeni_refit', l: 'Yeni mi, refit mi?', t: 'sel', opts: ['Yeni', 'Refit', 'Yeni + Refit'] },
    { k: 'icerik', l: 'Kapsam', t: 'combo', opts: ['AYD', 'AYD + BB', 'BB'], help: 'AYD aydınlatma, BB busbar' },
    { k: 'kritik', l: 'Kritik', t: 'chk', cl: 'Kritik proje' },
    { k: 'hedef_listesi', l: 'Hedef listesi', t: 'chk', cl: 'Yıllık hedef proje listesinde' },
    { k: 'baska_bolge', l: 'Başka bölge', t: 'chk', cl: 'Başka bölgeyle ortak takip' },
    { k: 'referans', l: 'Referans', t: 'chk', cl: 'Referans proje (galeride ve sunumda göster)' },
  ]},
];

const ROLLER = [['yatirimci_id', 'Yatırımcı'], ['projeci_id', 'Projeci'], ['danisman_id', 'Danışman'], ['gemut_id', 'Gemüt'], ['emut_id', 'Emüt'], ['alici_id', 'Alıcı'], ['bayi_id', 'Bayi']];
export const projeRolleri = (p, firmaId) => ROLLER.filter(([k]) => p[k] === firmaId).map(r => r[1]);

function filtered(f) {
  return S.projeler.filter(p => !p.aday &&
    (f.yil === 'Tümü' || String(p.takip_yili) === String(f.yil)) &&
    (!f.durumlar.length || f.durumlar.includes(p.durum)) &&
    (f.il === 'Tümü' || p.il === f.il) &&
    (f.kanal === 'Tümü' || (f.kanal === 'Direkt' ? p.kanal === 'Direkt' : firmaAd(p.bayi_id) === f.kanal)) &&
    (!f.kritik || p.kritik) && (!f.hedef || p.hedef_listesi) && (!f.ziyaret || p.ziyaret_edilecek) &&
    (f.rakip === 'Tümü' || p.rakip_marka === f.rakip) &&
    match(f.q, p.ad, p.lokasyon, p.osb, p.ilce, p.belde, p.notlar, p.teklif_no, p.takipci, ...ROLLER.map(([k]) => firmaAd(p[k]))));
}
const siparisToplam = p => { const ss = S.siparisler.filter(x => x.proje_id === p.id && x.para_birimi === 'USD' && !x.rapor_disi); return ss.length ? ss.reduce((a, x) => a + (+x.net_deger || 0), 0) : (p.siparis_tutari_usd || null); };
const SORTS = {
  'Duruma göre': (a, b) => DURUMLAR.findIndex(d => d.k === a.durum) - DURUMLAR.findIndex(d => d.k === b.durum) || a.ad.localeCompare(b.ad, 'tr'),
  'Son güncellenen': (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
  'Sipariş (büyükten)': (a, b) => (siparisToplam(b) || 0) - (siparisToplam(a) || 0),
  'Tutar (büyükten)': (a, b) => (b.tutar_usd || 0) - (a.tutar_usd || 0),
  'Ada göre': (a, b) => a.ad.localeCompare(b.ad, 'tr'),
  'Beklenen tarih': (a, b) => (a.beklenen_tarih || '9').localeCompare(b.beklenen_tarih || '9'),
};
// ---------- Tablo sütunları (Sütunlar düğmesiyle seçilir, başlığa dokununca sıralanır) ----------
const SUTUNLAR = [
  { k: 'sip', l: 'Sipariş', cls: 'c-sip r num', td: p => { const st = siparisToplam(p); return st ? usd(st) : '<span class="muted">—</span>'; }, v: p => siparisToplam(p) || 0 },
  { k: 'ad', l: 'Proje', cls: 'c-ad', sabit: true, td: p => `<b>${esc(p.ad)}</b>${p.kritik ? ' <em class="flag">Kritik</em>' : ''}${p.hedef_listesi ? ' <em class="flag soft">Hedef</em>' : ''}${p.lat == null || p.konum_yaklasik ? ' <em class="flag gray">Konum bekliyor</em>' : ''}${p.notlar ? `<small>${esc(p.notlar.slice(0, 80))}</small>` : ''}`, v: p => p.ad },
  { k: 'yer', l: 'Yer', td: p => esc([p.belde, p.ilce, p.il].filter(Boolean).join(', ') || p.lokasyon || '—'), v: p => [p.il, p.ilce].join(' ') },
  { k: 'osb', l: 'Bölge / OSB', td: p => esc(p.osb || '—'), v: p => p.osb || '' },
  { k: 'yatirimci_id', l: 'Yatırımcı', td: p => fa(p.yatirimci_id), v: p => firmaAd(p.yatirimci_id) || '' },
  { k: 'projeci_id', l: 'Projeci', td: p => fa(p.projeci_id), v: p => firmaAd(p.projeci_id) || '' },
  { k: 'danisman_id', l: 'Danışman', td: p => fa(p.danisman_id), v: p => firmaAd(p.danisman_id) || '' },
  { k: 'gemut_id', l: 'Gemüt', td: p => fa(p.gemut_id), v: p => firmaAd(p.gemut_id) || '' },
  { k: 'emut_id', l: 'Emüt', td: p => fa(p.emut_id), v: p => firmaAd(p.emut_id) || '' },
  { k: 'alici_id', l: 'Malzeme alıcısı', td: p => fa(p.alici_id), v: p => firmaAd(p.alici_id) || '' },
  { k: 'kanal', l: 'Kanal', td: p => p.kanal === 'Direkt' ? 'Direkt' : fa(p.bayi_id), v: p => p.kanal === 'Direkt' ? 'Direkt' : firmaAd(p.bayi_id) || '' },
  { k: 'tutar', l: 'Tutar', cls: 'r num', td: p => usd(p.tutar_usd), v: p => +p.tutar_usd || 0 },
  { k: 'olasilik', l: 'Olasılık', cls: 'r num', varsayilanKapali: true, td: p => '%' + olasilik(p), v: p => olasilik(p) },
  { k: 'beklenen', l: 'Beklenen tarih', varsayilanKapali: true, td: p => p.beklenen_tarih ? tarih(p.beklenen_tarih) : '<span class="muted">—</span>', v: p => p.beklenen_tarih || '9' },
  { k: 'santiye', l: 'Şantiye aşaması', varsayilanKapali: true, td: p => esc(p.santiye_asamasi || '—'), v: p => p.santiye_asamasi || '' },
  { k: 'guncel', l: 'Son güncelleme', varsayilanKapali: true, td: p => p.updated_at ? tarih(p.updated_at.slice(0, 10)) : '—', v: p => p.updated_at || '' },
  { k: 'yil', l: 'Yıl', td: p => p.takip_yili || '—', v: p => p.takip_yili || 0 },
  { k: 'kayip', l: 'Kayıp / rakip', td: p => p.durum === 'Kayıp' ? esc([p.rakip_marka, p.kayip_nedeni].filter(Boolean).join(' · ') || '—') : '<span class="muted">—</span>', v: p => p.rakip_marka || '' },
];
const sutunAyar = () => { const a = ayar('proje_sutunlar'); return Array.isArray(a) ? a : null; };
function gorunenSutunlar() { const a = sutunAyar(); return SUTUNLAR.filter(c => c.sabit || (a ? a.includes(c.k) : !c.varsayilanKapali)); }
function siralayici(f) {
  if (!f.sk) return SORTS[f.sort] || SORTS['Duruma göre'];
  const c = f.sk === 'durum' ? { v: p => DURUMLAR.findIndex(d => d.k === p.durum) } : SUTUNLAR.find(x => x.k === f.sk);
  if (!c) return SORTS[f.sort];
  const d = f.sd === -1 ? -1 : 1;
  return (a, b) => { const x = c.v(a), y = c.v(b); return d * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) || a.ad.localeCompare(b.ad, 'tr'); };
}
function sutunPaneli(sonra) {
  const sec = new Set(gorunenSutunlar().map(c => c.k));
  const p = openDrawer(`<header class="dh"><div><p class="muted">Projeler tablosu</p><h2 id="drawer-title">Sütunlar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><p class="hint">Tabloda görmek istediğin sütunları seç. Seçim her cihazda geçerli olur. Sıralamak için tablodaki sütun başlığına dokun; ikinci dokunuş tersine çevirir, üçüncü kapatır.</p>
      <ul class="list sutun-l">${SUTUNLAR.map(c => `<li><label class="chk"><input type="checkbox" data-c="${c.k}" ${sec.has(c.k) ? 'checked' : ''} ${c.sabit ? 'disabled' : ''}> <span>${c.l}${c.sabit ? ' <small class="muted">(her zaman)</small>' : ''}</span></label></li>`).join('')}</ul>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-vars>Varsayılan</button><button type="button" class="btn primary" data-ok>Uygula</button></div></div>`);
  p.querySelector('[data-vars]').onclick = async () => { await ayarYaz('proje_sutunlar', null); closeDrawer(); sonra(); };
  p.querySelector('[data-ok]').onclick = async () => { await ayarYaz('proje_sutunlar', [...p.querySelectorAll('[data-c]:checked')].map(i => i.dataset.c)); closeDrawer(); sonra(); };
}
// Kart görünümü: telefonda ve hızlı göz atmada daha rahat
function kartlar(kutu, list, daha) {
  kutu.classList.add('is-kart');
  kutu.innerHTML = list.length ? `<ul class="p-kartlar">${list.map(p => { const st = siparisToplam(p); return `<li><a href="#/proje/${p.id}" class="p-kart" style="--c:${durumRenk(p.durum)}">
      <span class="pk-ust">${pill(p.durum)}${p.kritik ? '<em class="flag">Kritik</em>' : ''}${p.hedef_listesi ? '<em class="flag soft">Hedef</em>' : ''}</span>
      <b>${esc(p.ad)}</b>
      <small class="muted">${esc([p.osb, p.ilce || p.il].filter(Boolean).join(' · ') || '—')}</small>
      <span class="pk-f">${esc([firmaAd(p.emut_id) && 'Emüt: ' + firmaAd(p.emut_id), firmaAd(p.gemut_id) && 'Gemüt: ' + firmaAd(p.gemut_id), p.kanal === 'Direkt' ? 'Direkt' : firmaAd(p.bayi_id) && 'Bayi: ' + firmaAd(p.bayi_id)].filter(Boolean).join(' · '))}</span>
      <span class="pk-alt"><span>${usd(p.tutar_usd)}${st ? ` · sipariş ${usd(st)}` : ''}</span><span class="muted">${p.beklenen_tarih ? 'beklenen ' + tarih(p.beklenen_tarih) : p.takip_yili || ''}</span></span></a></li>`; }).join('')}</ul>${daha ? '<div class="daha"><button type="button" class="btn" data-kdaha>Daha fazla göster</button></div>' : ''}`
    : '<div class="empty"><p>Bu filtrelerle eşleşen proje yok.</p></div>';
  kutu.querySelector('[data-kdaha]')?.addEventListener('click', daha);
}
const fa = id => id ? `<a href="#/firma/${id}" class="flink">${esc(firmaAd(id))}</a>` : '<span class="muted">—</span>';

export function projelerView(el) {
  const f = F('projeler', { q: '', yil: 'Tümü', durumlar: [], il: 'Tümü', kanal: 'Tümü', kritik: false, hedef: false, ziyaret: false, rakip: 'Tümü', sort: 'Duruma göre', gor: 'liste' });
  if (f._v !== 2) { f.yil = 'Tümü'; f.sort = 'Duruma göre'; f._v = 2; saveFilters(); }
  if (!SORTS[f.sort]) f.sort = 'Duruma göre';
  if (!f._gorSecim && innerWidth < 700 && f.gor !== 'huni') f.gor = 'kart';   // telefonda varsayılan kart görünümü
  const bayiler = [...new Set(S.projeler.map(p => firmaAd(p.bayi_id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const rakipler = [...new Set(S.projeler.map(p => p.rakip_marka).filter(Boolean))].sort();
  el.innerHTML = `
  <header class="vh"><div><h1>Projeler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="liste" class="${!['huni', 'kart'].includes(f.gor) ? 'on' : ''}">Tablo</button><button type="button" data-gor="kart" class="${f.gor === 'kart' ? 'on' : ''}">Kart</button><button type="button" data-gor="huni" class="${f.gor === 'huni' ? 'on' : ''}">Satış hunisi</button></div><button class="btn ghost" data-sutun aria-haspopup="dialog" ${['huni', 'kart'].includes(f.gor) ? 'hidden' : ''}>Sütunlar</button><button class="btn ghost" data-toplu aria-pressed="false">Toplu düzelt</button><button class="btn ghost" data-adaylar>Adaylar <i data-adaysay></i></button><button class="btn ghost" data-tabela data-gerek="yaz:projeler" title="Şantiye tabelasının fotoğrafından yeni proje">Tabeladan proje</button><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Yeni proje</button></div></header>
  <div class="filters">
    <input type="search" data-q placeholder="Proje, firma (Emüt, Gemüt…), OSB, not ara" value="${esc(f.q)}" aria-label="Projelerde ara">
    <div class="seg" role="group" aria-label="Takip yılı">${['Tümü', '2026', '2027'].map(y => `<button type="button" data-yil="${y}" class="${String(f.yil) === y ? 'on' : ''}">${y === 'Tümü' ? 'Tüm projeler' : y + ' listesi'}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Durum">${DURUMLAR.map(d => `<button type="button" class="chip ${f.durumlar.includes(d.k) ? 'on' : ''}" style="--c:${d.c}" data-d="${d.k}">${d.k} <i data-cnt="${d.k}"></i></button>`).join('')}</div>
    <button type="button" class="btn sm ghost f-toggle" data-ft aria-expanded="false">Diğer filtreler</button>
    <div class="frow f-more">
      <label>İl <select data-k="il">${['Tümü', ...ILLER, 'Diğer'].map(x => `<option ${f.il === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>Kanal <select data-k="kanal">${['Tümü', 'Direkt', ...bayiler].map(x => `<option ${f.kanal === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label>Kaybedilen marka <select data-k="rakip">${['Tümü', ...rakipler].map(x => `<option ${f.rakip === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label>Sırala <select data-k="sort">${Object.keys(SORTS).map(x => `<option ${f.sort === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" data-b="kritik" ${f.kritik ? 'checked' : ''}> <span>Kritik</span></label>
      <label class="chk"><input type="checkbox" data-b="hedef" ${f.hedef ? 'checked' : ''}> <span>Hedef listesi</span></label>
      <label class="chk"><input type="checkbox" data-b="ziyaret" ${f.ziyaret ? 'checked' : ''}> <span>Ziyaret edilecek</span></label>
      <button type="button" class="linkbtn" data-reset>Filtreleri temizle</button>
    </div>
  </div>
  <div class="ptable-wrap" data-rows></div>`;

  let goster = 80;   // uzun listede ilk 80 satır, sonra “daha fazla”
  let secMod = false; const secili = new Set();   // toplu düzeltme
  const draw = () => {
    const base = S.projeler.filter(p => !p.aday && (f.yil === 'Tümü' || String(p.takip_yili) === String(f.yil)));
    const as = el.querySelector('[data-adaysay]'); if (as) as.textContent = S.projeler.filter(p => p.aday).length || '';
    DURUMLAR.forEach(d => { const c = el.querySelector(`[data-cnt="${d.k}"]`); if (c) c.textContent = base.filter(p => p.durum === d.k).length || ''; });
    const list = filtered(f).sort(siralayici(f));
    const acik = list.filter(p => ACIK.includes(p.durum));
    const sipT = list.reduce((s, p) => s + (siparisToplam(p) || 0), 0);
    el.querySelector('[data-sum]').innerHTML = `${list.length} proje · açık potansiyel <b>${usd(acik.reduce((s, p) => s + (+p.tutar_usd || 0), 0))}</b> · ağırlıklı <b>${usd(acik.reduce((s, p) => s + (+p.tutar_usd || 0) * olasilik(p) / 100, 0))}</b> · sipariş <b>${usd(sipT)}</b>`;
    el.querySelector('[data-rows]').classList.remove('is-kart');
    if (f.gor === 'huni') return huni(el.querySelector('[data-rows]'), list, draw);
    if (f.gor === 'kart' && !secMod) return kartlar(el.querySelector('[data-rows]'), list.slice(0, goster), list.length > goster ? () => { goster += 80; draw(); } : null);
    const gor = gorunenSutunlar();
    const okIsaret = k => f.sk === k ? (f.sd === -1 ? ' ↓' : ' ↑') : '';
    el.querySelector('[data-rows]').innerHTML = list.length ? `<table class="ptable ${gor.some(c => c.k === 'sip') ? '' : 'no-sip'}">
      <thead><tr><th class="c-dur">${secMod ? `<label class="sec-k"><input type="checkbox" data-hepsi ${list.length && list.every(p => secili.has(p.id)) ? 'checked' : ''} aria-label="Listedeki tüm projeleri seç"></label>` : ''}<button type="button" class="th-s" data-sk="durum">Durum${okIsaret('durum')}</button></th>${gor.map(c => `<th class="${c.cls || ''}"><button type="button" class="th-s" data-sk="${c.k}">${c.l}${okIsaret(c.k)}</button></th>`).join('')}</tr></thead>
      <tbody>${list.slice(0, goster).map(p => `<tr data-pid="${p.id}" style="--c:${durumRenk(p.durum)}" tabindex="0">
        <td class="c-dur" data-l="Durum">${secMod ? `<label class="sec-k"><input type="checkbox" data-sec="${p.id}" ${secili.has(p.id) ? 'checked' : ''} aria-label="${esc(p.ad)} seç"></label>` : ''}<select class="dsel" data-dsel="${p.id}" aria-label="${esc(p.ad)} durumu" style="--c:${durumRenk(p.durum)}">${DURUMLAR.map(d => `<option ${p.durum === d.k ? 'selected' : ''}>${d.k}</option>`).join('')}</select></td>
        ${gor.map(c => `<td class="${c.cls || ''}" data-l="${c.l}">${c.td(p)}</td>`).join('')}</tr>`).join('')}</tbody></table>${list.length > goster ? `<div class="daha"><button type="button" class="btn" data-daha>${Math.min(80, list.length - goster)} proje daha göster</button> <span class="muted">${goster} / ${list.length}</span></div>` : ''}`
      : `<div class="empty"><p>Bu filtrelerle eşleşen proje yok.</p><button class="btn" data-reset2>Filtreleri temizle</button></div>`;
    const r2 = el.querySelector('[data-reset2]'); if (r2) r2.onclick = reset;
    el.querySelector('[data-daha]')?.addEventListener('click', () => { const y = window.scrollY; goster += 80; draw(); window.scrollTo(0, y); });
    el.querySelectorAll('[data-sk]').forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.sk; if (f.sk === k) { if (f.sd === -1) f.sk = null; else f.sd = -1; } else { f.sk = k; f.sd = 1; } saveFilters(); draw(); });
    const open = id => { location.hash = '#/proje/' + id; };
    el.querySelectorAll('tr[data-pid]').forEach(tr => {
      tr.onclick = e => { if (e.target.closest('select, a, label')) return; if (secMod) { const c = tr.querySelector('[data-sec]'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); return; } open(tr.dataset.pid); };
      tr.onkeydown = e => { if (e.key === 'Enter' && !e.target.closest('select, a')) open(tr.dataset.pid); };
    });
    el.querySelectorAll('[data-sec]').forEach(c => c.onchange = () => { c.checked ? secili.add(c.dataset.sec) : secili.delete(c.dataset.sec); topluBar(); });
    el.querySelector('[data-hepsi]')?.addEventListener('change', e => { for (const p of list) e.target.checked ? secili.add(p.id) : secili.delete(p.id); draw(); });
    topluBar();
    el.querySelectorAll('[data-dsel]').forEach(sel => sel.onchange = async () => {
      const p = byId('projeler', sel.dataset.dsel), eski = p.durum;
      if (await durumDegistir(p, sel.value)) { sel.style.setProperty('--c', durumRenk(sel.value)); sel.closest('tr').style.setProperty('--c', durumRenk(sel.value)); }
      else sel.value = eski;
    });
  };
  // ---------- Toplu düzeltme ----------
  const bayiListesi = () => S.firmalar.filter(x => (x.tipler || []).includes('Bayi') || S.projeler.some(p => p.bayi_id === x.id)).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  function topluBar() {
    let bar = el.querySelector('[data-tbar]');
    if (!secMod) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'toplu-bar'; bar.dataset.tbar = '';
      const sec = (k, ad, opts) => `<label>${ad} <select data-tk="${k}"><option value="">Değiştirme</option>${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;
      bar.innerHTML = `<b data-tsay></b>
        ${sec('durum', 'Aşama', DURUMLAR.map(d => [d.k, d.k]))}
        ${sec('takip_yili', 'Takip yılı', ['2025', '2026', '2027', '2028'].map(y => [y, y]))}
        ${sec('il', 'İl', [...ILLER, 'Diğer'].map(x => [x, x]))}
        ${sec('kanal', 'Kanal', [['Direkt', 'Direkt'], ...bayiListesi().map(x => ['bayi:' + x.id, 'Bayi: ' + x.ad])])}
        ${sec('hedef_listesi', 'Hedef listesi', [['1', 'Ekle'], ['0', 'Çıkar']])}
        ${sec('kritik', 'Kritik', [['1', 'İşaretle'], ['0', 'Kaldır']])}
        <span class="tb-act"><button type="button" class="btn primary" data-tuygula>Uygula</button><button type="button" class="btn ghost" data-tbitir>Bitir</button></span>`;
      el.appendChild(bar);
      bar.querySelector('[data-tbitir]').onclick = () => { secMod = false; secili.clear(); el.querySelector('[data-toplu]').setAttribute('aria-pressed', 'false'); el.querySelector('[data-toplu]').classList.remove('on'); draw(); };
      bar.querySelector('[data-tuygula]').onclick = topluUygula;
    }
    bar.querySelector('[data-tsay]').textContent = secili.size ? `${secili.size} proje seçili` : 'Satırlara dokunarak proje seç';
  }
  async function topluUygula() {
    const bar = el.querySelector('[data-tbar]'), d = Object.fromEntries([...bar.querySelectorAll('[data-tk]')].map(s => [s.dataset.tk, s.value]).filter(([, v]) => v !== ''));
    if (!secili.size) return toast('Önce proje seç.', 'err');
    if (!Object.keys(d).length) return toast('Değiştirilecek en az bir alan seç.', 'err');
    const ps = [...secili].map(id => byId('projeler', id)).filter(Boolean);
    const ozet = Object.entries(d).map(([k, v]) => ({ durum: 'aşama', takip_yili: 'takip yılı', il: 'il', kanal: 'kanal', hedef_listesi: 'hedef listesi', kritik: 'kritik' })[k] + ': ' + (k === 'kanal' && v.startsWith('bayi:') ? firmaAd(v.slice(5)) : v === '1' ? 'evet' : v === '0' ? 'hayır' : v)).join(', ');
    if (!confirmBox(`${ps.length} projede şu değişiklik yapılacak:\n${ozet}\n\nDevam edilsin mi?`)) return;
    const simdi = new Date().toISOString(), gecmis = [];
    const yeni = ps.map(p => {
      const o = { ...p };
      if (d.durum && d.durum !== p.durum) { o.durum = d.durum; gecmis.push({ id: uuid(), proje_id: p.id, tarih: simdi, eski_durum: p.durum, yeni_durum: d.durum, notlar: 'Toplu düzeltme' }); if (d.durum === 'Sipariş' && !p.siparis_tarihi) o.siparis_tarihi = today(); }
      if (d.takip_yili) o.takip_yili = +d.takip_yili;
      if (d.il) o.il = d.il;
      if (d.kanal) { if (d.kanal === 'Direkt') { o.kanal = 'Direkt'; o.bayi_id = null; } else { o.kanal = 'Bayi'; o.bayi_id = d.kanal.slice(5); } }
      if (d.hedef_listesi) o.hedef_listesi = d.hedef_listesi === '1';
      if (d.kritik) o.kritik = d.kritik === '1';
      return o;
    });
    try {
      toast('Kaydediliyor…');
      await app.db.bulk('projeler', yeni); if (gecmis.length) await app.db.bulk('proje_gecmis', gecmis);
      toast(`${yeni.length} proje güncellendi.${d.durum === 'Kayıp' ? ' Kayıp bilgisini Panel → Kayıp analizi → Eksikleri tamamla ile girebilirsin.' : ''}`);
      secili.clear(); bar.querySelectorAll('[data-tk]').forEach(s => s.value = ''); draw();
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  }
  el.querySelector('[data-toplu]').onclick = e => { secMod = !secMod; secili.clear(); e.currentTarget.setAttribute('aria-pressed', String(secMod)); e.currentTarget.classList.toggle('on', secMod); if (secMod && f.gor === 'huni') { f.gor = 'liste'; saveFilters(); el.querySelectorAll('[data-gor]').forEach(x => x.classList.toggle('on', x.dataset.gor === 'liste')); el.classList.remove('is-huni'); } draw(); if (secMod) toast('Satırlara dokunarak projeleri seç, alttaki çubuktan değiştir.'); };
  const reset = () => { Object.assign(f, { q: '', durumlar: [], il: 'Tümü', kanal: 'Tümü', kritik: false, hedef: false, ziyaret: false, rakip: 'Tümü' }); saveFilters(); projelerView(el); };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-yil]').forEach(b => b.onclick = () => { f.yil = b.dataset.yil; saveFilters(); el.querySelectorAll('[data-yil]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const d = b.dataset.d; f.durumlar = f.durumlar.includes(d) ? f.durumlar.filter(x => x !== d) : [...f.durumlar, d]; b.classList.toggle('on'); saveFilters(); draw(); });
  el.querySelectorAll('[data-k]').forEach(s => s.onchange = () => { f[s.dataset.k] = s.value; if (s.dataset.k === 'sort') f.sk = null; saveFilters(); draw(); });
  el.querySelectorAll('[data-b]').forEach(s => s.onchange = () => { f[s.dataset.b] = s.checked; saveFilters(); draw(); });
  el.querySelector('[data-reset]').onclick = reset;
  el.querySelectorAll('[data-gor]').forEach(b => b.onclick = () => { f.gor = b.dataset.gor; f._gorSecim = 1; saveFilters(); el.querySelector('[data-sutun]').hidden = ['huni', 'kart'].includes(f.gor); el.querySelectorAll('[data-gor]').forEach(x => x.classList.toggle('on', x === b)); el.classList.toggle('is-huni', f.gor === 'huni'); draw(); });
  el.classList.toggle('is-huni', f.gor === 'huni');
  el.querySelector('[data-ft]').onclick = e => { const o = el.querySelector('.filters').classList.toggle('open'); e.target.setAttribute('aria-expanded', String(o)); };
  el.querySelector('[data-new]').onclick = () => yeniProje({});
  el.querySelector('[data-sutun]').onclick = () => sutunPaneli(draw);
  el.querySelector('[data-tabela]')?.addEventListener('click', async () => (await import('../tabela.js')).tabeladanProje());
  el.querySelector('[data-adaylar]').onclick = async () => (await import('../aday.js')).adaylarPaneli(() => draw());
  el.querySelector('[data-exp]').onclick = () => exportProjeler(filtered(f).sort(siralayici(f)));
  draw();
}

export async function durumDegistir(p, yeni) {
  const eski = p.durum; if (eski === yeni) return true;
  try {
    const o = { ...p, durum: yeni };
    if (yeni === 'Sipariş' && !p.siparis_tarihi) o.siparis_tarihi = today();
    await app.db.save('projeler', o);
    await app.db.save('proje_gecmis', { proje_id: p.id, tarih: new Date().toISOString(), eski_durum: eski, yeni_durum: yeni });
    toast(`${p.ad}: ${eski} → ${yeni}`);
    if (yeni === 'Kayıp' && !document.querySelector('.drawer.open')) import('../kayip.js').then(m => m.kayipSor(o, () => app.refresh && app.refresh()));
    return true;
  } catch (e) { toast(e.message, 'err'); return false; }
}

// Satış hunisi: aşama sütunları, sürükle-bırak (dokunmatikte kart üzerindeki seçimle)
const HUNI = ['Proje', 'İhale', 'Teklif Verildi', 'Sıcak', 'Beklemede', 'Sipariş', 'Kayıp'];
function huni(box, list, yenile) {
  const t = today();
  box.innerHTML = `<div class="huni">${HUNI.map(d => { const ps = list.filter(p => p.durum === d).sort((a, b) => (b.tutar_usd || 0) - (a.tutar_usd || 0));
    const top = ps.reduce((s, p) => s + (+p.tutar_usd || 0), 0), ag = ps.reduce((s, p) => s + (+p.tutar_usd || 0) * olasilik(p) / 100, 0);
    return `<section class="hcol" data-col="${d}" style="--c:${durumRenk(d)}" aria-label="${d}"><header><b>${d}</b><span>${ps.length}</span><small>${usd(top)}${ACIK.includes(d) && top ? ` · ağırlıklı ${usd(ag)}` : ''}</small></header>
      <div class="hcards">${ps.slice(0, 80).map(p => `<article class="hcard" draggable="true" data-id="${p.id}" tabindex="0">
        <b>${esc(p.ad)}</b><small>${esc([firmaAd(p.emut_id) || firmaAd(p.alici_id), p.ilce || p.il].filter(Boolean).join(' · '))}</small>
        <span class="hc-bot"><span class="num">${usd(p.tutar_usd)}</span>${ACIK.includes(p.durum) ? `<small>%${olasilik(p)}</small>` : ''}${p.beklenen_tarih ? `<small class="${p.beklenen_tarih < t && ACIK.includes(p.durum) ? 'neg' : ''}">${tarih(p.beklenen_tarih)}</small>` : ''}</span>
        <select data-tasi aria-label="${esc(p.ad)} aşamasını değiştir">${HUNI.concat('İptal').map(x => `<option ${x === p.durum ? 'selected' : ''}>${x}</option>`).join('')}</select></article>`).join('')}
        ${ps.length > 80 ? `<p class="hint">+${ps.length - 80} proje daha; filtreyle daralt.</p>` : ''}</div></section>`; }).join('')}</div>`;
  const tasi = async (id, d) => { const p = byId('projeler', id); if (p && p.durum !== d && await durumDegistir(p, d)) yenile(); };
  box.querySelectorAll('.hcard').forEach(c => {
    c.ondragstart = e => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('drag'); };
    c.ondragend = () => c.classList.remove('drag');
    c.onclick = e => { if (!e.target.closest('select')) location.hash = '#/proje/' + c.dataset.id; };
    c.onkeydown = e => { if (e.key === 'Enter' && !e.target.closest('select')) location.hash = '#/proje/' + c.dataset.id; };
    c.querySelector('[data-tasi]').onchange = e => tasi(c.dataset.id, e.target.value);
  });
  box.querySelectorAll('.hcol').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('over'); };
    col.ondragleave = () => col.classList.remove('over');
    col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); tasi(e.dataTransfer.getData('text/plain'), col.dataset.col); };
  });
}

export function projeSatiri(p) {
  return {
    'Proje': p.ad, 'Durum': p.durum, 'Durum notu': p.durum_alt, 'Takip yılı': p.takip_yili, 'Kritik': p.kritik ? 'Evet' : '', 'Hedef listesi': p.hedef_listesi ? 'Evet' : '',
    'İl': p.il, 'İlçe': p.ilce, 'OSB': p.osb, 'Lokasyon': p.lokasyon, 'Sektör': p.sektor, 'Yeni/Refit': p.yeni_refit,
    'Yatırımcı': firmaAd(p.yatirimci_id), 'Projeci': firmaAd(p.projeci_id), 'Danışman': firmaAd(p.danisman_id), 'Gemüt': firmaAd(p.gemut_id), 'Emüt': firmaAd(p.emut_id), 'Alıcı': firmaAd(p.alici_id),
    'Kanal': p.kanal === 'Direkt' ? 'Direkt' : firmaAd(p.bayi_id), 'Takip eden': p.takipci, 'Çalışıldı': p.calisildi,
    'Tutar (USD)': p.tutar_usd, 'Olasılık %': p.olasilik, 'Beklenen tarih': p.beklenen_tarih, 'Şantiye aşaması': p.santiye_asamasi, 'Aydınlatma alımı': p.alim_tarihi, 'Referans': p.referans ? 'Evet' : '', 'Teklif no': p.teklif_no, 'Ürün grupları': (p.urun_gruplari || []).join(', '),
    'Sipariş tutarı (USD)': p.siparis_tutari_usd, 'Kayıp nedeni': p.kayip_nedeni, 'İşi alan marka': p.rakip_marka, 'Rakip ürün': p.rakip_urun,
    'Rakip birim fiyat': p.rakip_birim_fiyat, 'Rakip miktar': p.rakip_miktar, 'Rakip toplam (USD)': p.rakip_toplam_usd, 'Bizim teklif (USD)': p.bizim_teklif_usd, 'Kayıp detayı': p.kayip_aciklama,
    'Notlar': p.notlar, 'Enlem': p.lat, 'Boylam': p.lng,
  };
}
function exportProjeler(list) {
  exportXlsx(`projeler-${today()}.xlsx`, { 'Projeler': list.map(projeSatiri) });
  toast(`${list.length} proje Excel'e aktarıldı.`);
}

// ---------- Detay ----------
export function yeniProje(init) {
  projeDetay(null, { durum: 'Proje', takip_yili: new Date().getFullYear() >= 2026 ? 2026 : 2026, kanal: 'Bayi', bayi_id: S.firmalar.find(x => x.ad === 'Drv Elektrik')?.id || null, fotolar: [], urun_gruplari: [], konum_yaklasik: false, ...init });
}

// Şantiye ilerleme fotoğrafları: projenin ve projeye bağlı ziyaretlerin fotoğrafları tarih sırasıyla
function santiyeBolumu(kutu, p) {
  if (!kutu) return;
  const ciz = async () => {
    const pr = byId('projeler', p.id) || p;
    const gruplar = S.ziyaretler.filter(z => z.proje_id === p.id && (z.fotolar || []).length).sort((a, b) => b.tarih.localeCompare(a.tarih)).map(z => ({ tarih: z.tarih, baslik: z.notlar || z.amac || 'Ziyaret', fotolar: z.fotolar }));
    if ((pr.fotolar || []).length) gruplar.push({ tarih: null, baslik: 'Proje fotoğrafları', fotolar: pr.fotolar });
    kutu.innerHTML = `<h3>Şantiye ilerlemesi <span class="muted">${gruplar.reduce((a, g) => a + g.fotolar.length, 0)} fotoğraf</span></h3>
      <div class="btnrow"><button type="button" class="btn sm" data-sfoto>Şantiye fotoğrafı çek</button>${pr.santiye_asamasi ? `<span class="muted">Aşama: ${esc(pr.santiye_asamasi)}</span>` : ''}</div>
      ${gruplar.length ? `<ol class="santiye">${gruplar.map(g => `<li><div class="st-h"><b>${g.tarih ? tarih(g.tarih) : 'Tarihsiz'}</b><small class="muted">${esc(String(g.baslik).slice(0, 90))}</small></div><div class="st-f">${g.fotolar.map(y => `<img alt="" loading="lazy" data-yol="${esc(y)}">`).join('')}</div></li>`).join('')}</ol>`
        : '<p class="hint">Her şantiye ziyaretinde bir fotoğraf çek; elektrik aşamasına ne kadar kaldığı burada tarih sırasıyla görünür.</p>'}`;
    kutu.querySelectorAll('img[data-yol]').forEach(async im => { const u = await app.db.url(im.dataset.yol, true); if (u) { im.src = u; im.onclick = () => window.open(u, '_blank', 'noopener'); } });
    kutu.querySelector('[data-sfoto]').onclick = async () => {
      const { pickFiles } = await import('../ui.js');
      const fs = await pickFiles({ accept: 'image/*', multiple: false, capture: true }); if (!fs.length) return;
      const asama = prompt('Şantiye aşaması (isteğe bağlı): ' + SANTIYE.join(' / '), pr.santiye_asamasi || '');
      try {
        toast('Fotoğraf yükleniyor…');
        const yol = await app.db.upload(fs[0]);
        await app.db.save('ziyaretler', { tarih: today(), durum: 'Yapıldı', amac: 'Şantiye', proje_id: p.id, firma_id: pr.emut_id || pr.gemut_id || pr.alici_id || null, notlar: 'Şantiye fotoğrafı' + (asama ? ' – ' + asama : ''), fotolar: [yol] });
        if (asama && SANTIYE.includes(asama) && asama !== pr.santiye_asamasi) await app.db.save('projeler', { ...pr, santiye_asamasi: asama });
        toast('Şantiye fotoğrafı eklendi.'); ciz();
      } catch (e) { toast('Yüklenemedi: ' + e.message, 'err'); }
    };
  };
  ciz();
}
const projeSekme = { id: null, k: 'bilgi' };
const PS_GEREK = { ziyaret: 'ziyaretler,gorevler', satis: 'teklifler,siparisler', yorum: 'yorumlar' };   // aynı proje yeniden açılınca son sekme
export function projeDetay(id, init) {
  const p0 = id ? byId('projeler', id) : { id: uuid(), ...init, _new: true };
  if (!p0) { toast('Proje bulunamadı.', 'err'); return backToList(); }
  const p = { ...p0, takip_yili: p0.takip_yili ? String(p0.takip_yili) : '2026' };
  const ziy = S.ziyaretler.filter(z => z.proje_id === p.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const sip = S.siparisler.filter(s => s.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const gec = S.proje_gecmis.filter(g => g.proje_id === p.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const gor = S.gorevler.filter(g => g.proje_id === p.id);
  const tek = S.teklifler.filter(x => x.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const sekme = ['bilgi', 'ziyaret', 'satis', 'belge', 'yorum', 'gecmis'].includes(init?.sekme) ? init.sekme : (projeSekme.id === p.id ? projeSekme.k : 'bilgi');
  const panel = openDrawer(`
    <header class="dh" style="--c:${durumRenk(p.durum)}"><div><p class="muted">${p._new ? 'Yeni proje' : 'Proje'}</p><h2 id="drawer-title">${esc(p.ad || 'Yeni proje')}</h2>
      ${p._new ? '' : `<div class="dh-meta">${pill(p.durum)}<span>${usd(p.tutar_usd)}</span><span>${esc([p.ilce, p.il].filter(Boolean).join(', '))}</span></div>`}</div>
      <button class="x" data-close aria-label="Kapat">×</button></header>
    ${p._new ? '' : `<div class="dh-actions">
      <button class="btn sm" data-a="ziyaret" data-gerek="yaz:ziyaretler">Ziyaret ekle</button><button class="btn sm" data-a="gorev" data-gerek="yaz:gorevler">Görev ekle</button><button class="btn sm" data-a="teklif" data-gerek="yaz:teklifler">Teklif hazırla</button><button class="btn sm ghost" data-a="numune" data-gerek="yaz:numuneler">Numune ver</button><button class="btn sm ghost" data-a="google" data-gerek="yaz:projeler">Google'dan konum al</button>${p.google_url ? `<a class="btn sm ghost" href="${esc(p.google_url)}" target="_blank" rel="noopener">Google Haritalar</a>` : ''}
      ${p.lat != null ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(p.lat, p.lng)}">Yol tarifi</a>` : ''}
      <button class="btn sm ghost danger" data-a="sil" data-gerek="yaz:projeler">Sil</button></div>
      <div class="quick-durum" data-gerek="yaz:projeler" role="group" aria-label="Durumu hızlı değiştir">${DURUMLAR.map(d => `<button type="button" data-qd="${d.k}" class="${p.durum === d.k ? 'on' : ''}" style="--c:${d.c}">${d.k}</button>`).join('')}</div>
      <div class="p-sekme" role="tablist" aria-label="Proje bölümleri">${[['bilgi', 'Bilgiler', ''], ['ziyaret', 'Ziyaret ve görev', ziy.length + gor.length], ['satis', 'Teklif ve sipariş', tek.length + sip.length], ['belge', 'Belgeler', belgeleri({ proje_id: p.id }).length], ['yorum', 'Yorumlar', (S.yorumlar || []).filter(y => y.kayit_id === p.id).length], ['gecmis', 'Geçmiş', gec.length]].map(([k, t, n]) => `<button type="button" role="tab" data-psk="${k}" ${PS_GEREK[k] ? `data-gerek="${PS_GEREK[k]}"` : ''} aria-selected="${k === sekme}" class="${k === sekme ? 'on' : ''}">${t}${n ? ` <i>${n}</i>` : ''}</button>`).join('')}</div>`}
    <form class="dbody form" novalidate>
      <div data-ps="bilgi" ${p._new || sekme === 'bilgi' ? '' : 'hidden'}>${renderForm(PROJE_FORM, p)}
      <div class="calc" data-calc hidden></div></div>
      ${p._new ? '' : (() => { const r = related(ziy, sip, gec, gor, tek); return `<div data-ps="ziyaret" data-gerek="${PS_GEREK.ziyaret}" ${sekme === 'ziyaret' ? '' : 'hidden'}>${r.ziyaret}</div><div data-ps="satis" data-gerek="${PS_GEREK.satis}" ${sekme === 'satis' ? '' : 'hidden'}>${r.satis}<section class="rel" data-oneri data-gerek="teklifler"></section><section class="rel" data-sartname data-gerek="teklifler"></section></div><div data-ps="belge" ${sekme === 'belge' ? '' : 'hidden'}><section class="rel" data-santiye></section><section class="rel" data-belgeler data-gerek="belgeler"></section></div><div data-ps="yorum" data-gerek="yorumlar" ${sekme === 'yorum' ? '' : 'hidden'}><section class="rel" data-yorumlar></section></div><div data-ps="gecmis" ${sekme === 'gecmis' ? '' : 'hidden'}>${r.gecmis}<section class="rel" data-gecmis></section></div>`; })()}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div>
    </form>`, { wide: true, onClose: () => backToList() });
  const form = panel.querySelector('form');
  panel.querySelectorAll('[data-psk]').forEach(b => b.onclick = () => {
    const k = b.dataset.psk; projeSekme.id = p.id; projeSekme.k = k;
    panel.querySelectorAll('[data-psk]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    panel.querySelectorAll('[data-ps]').forEach(x => x.hidden = x.dataset.ps !== k);
    if (k === 'bilgi') panel.querySelectorAll('[data-loc]').forEach(m => setTimeout(() => m._map?.invalidateSize(), 50));
    panel.scrollTop = 0;
  });
  if (!p._new) import('../oneri.js').then(m => { m.oneriBolumu(panel.querySelector('[data-oneri]'), p); m.sartnameBolumu(panel.querySelector('[data-sartname]'), p); });
  if (!p._new) santiyeBolumu(panel.querySelector('[data-santiye]'), p);
  if (!p._new) import('../yorum.js').then(m => m.yorumBolumu(panel.querySelector('[data-yorumlar]'), 'projeler', p));
  if (!p._new) { belgeBolumu(panel.querySelector('[data-belgeler]'), { proje_id: p.id }); kayitGecmisi(panel.querySelector('[data-gecmis]'), 'projeler', p.id); }
  const calc = (o, root) => {
    const box = root.querySelector('[data-calc]');
    if (o.durum !== 'Kayıp') { box.hidden = true; return; }
    const tot = root.querySelector('[name=rakip_toplam_usd]');
    if (o.rakip_birim_fiyat && o.rakip_miktar && document.activeElement !== tot) tot.value = Math.round(o.rakip_birim_fiyat * o.rakip_miktar * 100) / 100;
    const rt = parseFloat(tot.value), bz = o.bizim_teklif_usd;
    if (rt && bz) { const d = (bz - rt) / rt * 100; box.hidden = false; box.innerHTML = `Bizim teklif rakipten <b>%${num(Math.abs(d))} ${d >= 0 ? 'pahalı' : 'ucuz'}</b> (${usd(bz - rt)} fark).`; }
    else box.hidden = true;
  };
  bindForm(form, PROJE_FORM, p, { onChange: calc });
  calc(p, form);
  panel.querySelectorAll('[data-qd]').forEach(b => b.onclick = async () => {
    const d = b.dataset.qd; form.querySelector('[name=durum]').value = d; form.dispatchEvent(new Event('change'));
    panel.querySelectorAll('[data-qd]').forEach(x => x.classList.toggle('on', x === b));
    if (d === 'Kayıp') form.querySelector('[data-show="kayip"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  panel.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => siparisForm({ id: b.dataset.sp }));
  panel.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => teklifForm({ id: b.dataset.tk }, () => projeDetay(p.id)));
  panel.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'ziyaret') ziyaretForm({ proje_id: p.id, firma_id: p.emut_id || p.alici_id || p.bayi_id }, () => projeDetay(p.id));
    if (a === 'teklif') teklifForm({ proje_id: p.id }, () => projeDetay(p.id));
    if (a === 'numune') numuneForm({ proje_id: p.id, firma_id: p.emut_id || p.alici_id || null });
    if (a === 'gorev') gorevForm({ proje_id: p.id, baslik: '' }, () => projeDetay(p.id));
    if (a === 'google') googleBul({ q: aramaMetni(p), hedef: { table: 'projeler', rec: p }, sonra: () => projeDetay(p.id) });
    if (a === 'sil' && confirmBox(`“${p.ad}” silinsin mi? Bu işlem geri alınamaz.`)) { await app.db.del('projeler', p.id); toast('Proje silindi.'); closeDrawer(); app.refresh(); }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, PROJE_FORM, p);
      if (!o.ad) { toast('Proje adını yaz.', 'err'); form.querySelector('[name=ad]').focus(); return; }
      o.takip_yili = o.takip_yili ? parseInt(o.takip_yili) : null;
      o.durum = o.durum || 'Proje';
      if (o.durum === 'Kayıp' && o.rakip_birim_fiyat && o.rakip_miktar && !o.rakip_toplam_usd) o.rakip_toplam_usd = o.rakip_birim_fiyat * o.rakip_miktar;
      if (o.lat != null && p0.lat == null && init?.lat == null) o.konum_yaklasik = false;
      if (p._new) {
        const ad = fold(o.ad).replace(/[^a-z0-9]/g, ''), dup = ad.length >= 5 && S.projeler.find(x => fold(x.ad).replace(/[^a-z0-9]/g, '') === ad);
        if (dup && !confirmBox(`“${dup.ad}” adında bir proje zaten var${dup.aday ? ' (aday listesinde)' : ''}. Yine de yeni proje açılsın mı?`)) return;
      }
      const saved = await app.db.save('projeler', o);
      if (p._new && o.lat == null) setTimeout(() => toast('Proje kaydedildi. Haritada görünmesi için Harita → Araçlar → Konum ata ile yerini işaretleyebilirsin.'), 1500);
      if (!p._new && p0.durum !== o.durum) await app.db.save('proje_gecmis', { proje_id: o.id, tarih: new Date().toISOString(), eski_durum: p0.durum, yeni_durum: o.durum });
      if (p._new) await app.db.save('proje_gecmis', { proje_id: o.id, tarih: new Date().toISOString(), eski_durum: null, yeni_durum: o.durum, notlar: 'Kayıt oluşturuldu' });
      if (o.durum === 'Kayıp' && o.rakip_marka && o.rakip_birim_fiyat) {
        const ex = S.rakip_fiyatlar.find(r => r.proje_id === o.id && r.kaynak === 'Kayıp proje');
        await app.db.save('rakip_fiyatlar', { ...(ex || {}), aile: (o.urun_gruplari || [])[0] || o.bizim_urun || null, marka: o.rakip_marka, urun_adi: o.rakip_urun,
          birim_fiyat: o.rakip_birim_fiyat, fiyat_metin: `${o.rakip_birim_fiyat} USD`, para_birimi: 'USD', tarih: today(), kaynak: 'Kayıp proje', proje_id: o.id, notlar: o.kayip_aciklama });
      }
      toast(`${saved.ad} kaydedildi.`);
      closeDrawer(); app.refresh();
    } catch (err) { console.error(err); toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

function related(ziy, sip, gec, gor, tek) {
  return {
    ziyaret: `<section class="rel">
    <h3>Ziyaretler <span class="muted">${ziy.length}</span></h3>
    ${ziy.length ? `<ul class="list">${ziy.map(z => `<li><span class="muted">${tarih(z.tarih)}</span><span>${esc(firmaAd(z.firma_id))} — ${esc((z.notlar || '').slice(0, 120))}</span></li>`).join('')}</ul>` : '<p class="hint">Bu projeye bağlı ziyaret yok.</p>'}
    ${gor.length ? `<h3>Görevler <span class="muted">${gor.length}</span></h3><ul class="list">${gor.map(g => `<li><span>${g.durum === 'Tamam' ? '✓' : '○'} ${esc(g.baslik)}</span><span class="muted">${tarih(g.son_tarih)}</span></li>`).join('')}</ul>` : ''}
  </section>`,
    satis: `<section class="rel">
    ${tek.length ? `<h3>Teklifler <span class="muted">${tek.length}</span></h3><ul class="list">${tek.map(x => `<li><button type="button" class="linkbtn" data-tk="${x.id}">${esc(x.teklif_no || 'Teklif')}</button><span class="muted">${tarih(x.tarih)} · ${esc(x.durum)}</span><b class="num">${num(x.toplam)} ${esc(x.para_birimi || '')}</b></li>`).join('')}</ul>` : ''}
    <h3>Siparişler <span class="muted">${sip.length}</span></h3>
    ${sip.length ? `<ul class="list">${sip.map(s => `<li class="${s.rapor_disi ? 'disi' : ''}"><span class="muted">${tarih(s.tarih)}</span><button type="button" class="linkrow" data-sp="${s.id}"><b>${esc(s.siparis_no || 'Sipariş')} · ${esc(s.referans || s.musteri_adi || '')}</b>${s.siparis_notu ? `<span class="muted">Not: ${esc(s.siparis_notu.slice(0, 80))}</span>` : ''}</button><b class="num">${num(s.net_deger)} ${esc(s.para_birimi)}</b></li>`).join('')}</ul>
      <p class="hint">Toplam: ${usd(sip.filter(s => s.para_birimi === 'USD').reduce((a, s) => a + +s.net_deger, 0))}</p>` : '<p class="hint">Sipariş listesinde bu projeye bağlı kayıt yok.</p>'}
  </section>`,
    gecmis: `<section class="rel">
    ${gec.length ? `<h3>Durum geçmişi</h3><ul class="list">${gec.map(g => `<li><span class="muted">${tarih(g.tarih)}</span><span>${g.eski_durum ? esc(g.eski_durum) + ' → ' : ''}${esc(g.yeni_durum)}${g.notlar ? ' · ' + esc(g.notlar) : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Durum değişikliği kaydı yok.</p>'}
  </section>`,
  };
}
