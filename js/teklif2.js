// Teklif (Aşama 10): şablonlar (logo, antet, renk, banka, alt bilgi, imza, sütunlar, dil), numara düzeni, hazır metin blokları,
// mahal / kat gruplama ve ara toplamlar, alternatifli kalemler (Seçenek A / B), teknik ekler, teslim şartları, kur sabitleme,
// belge (PDF) ve anında önizleme, revizyon karşılaştırma, teklif raporu.
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, tarih, byId, firmaAd, toast, openDrawer, closeDrawer, confirmBox, fold, urunBilgi } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { firmaAdi } from './profil.js';
import { benimAdim } from './sablon.js';
import { disKullanici, sahipMi } from './yetki.js';

const PB = { USD: '$', EUR: '€', TRY: '₺' };
const para = (v, pb = 'USD', dil = 'tr') => new Intl.NumberFormat(dil === 'en' ? 'en-US' : 'tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' ' + (PB[pb] || pb);
const ben = () => String(app.db?.user?.()?.email || '').toLowerCase();

// ---------- Sözlük (belge dili) ----------
export const DILLER = { tr: 'Türkçe', en: 'English' };
const SOZ = {
  tr: { baslik: 'TEKLİF', no: 'No', tarih: 'Tarih', gec: 'Geçerlilik', sayin: 'Sayın', proje: 'Proje', urun: 'Ürün', ara: 'Ara toplam', isk: 'İskonto', net: 'KDV hariç toplam', kdv: 'KDV', genel: 'Genel toplam', secenek: 'Seçenek', secilirse: 'seçilirse genel toplam', teslim: 'Teslim şartları', sure: 'Teslim süresi', yer: 'Teslim yeri', sekil: 'Teslim şekli', kur: 'Teklif kuru', kurMadde: 'Kur farkı alıcıya aittir.', ekler: 'Ekler', banka: 'Banka bilgileri', araToplam: 'ara toplam', not: 'Notlar' },
  en: { baslik: 'QUOTATION', no: 'No', tarih: 'Date', gec: 'Valid until', sayin: 'To', proje: 'Project', urun: 'Product', ara: 'Subtotal', isk: 'Discount', net: 'Total excl. VAT', kdv: 'VAT', genel: 'Grand total', secenek: 'Option', secilirse: 'grand total if selected', teslim: 'Delivery terms', sure: 'Delivery time', yer: 'Delivery place', sekil: 'Incoterms', kur: 'Exchange rate', kurMadde: 'Exchange rate differences are borne by the buyer.', ekler: 'Attachments', banka: 'Bank details', araToplam: 'subtotal', not: 'Notes' },
};
export const TESLIM_SEKILLERI = ['', 'EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'Şantiye teslim', 'Depo teslim'];

// ---------- Sütunlar ----------
export const SUTUNLAR = [
  { k: 'sira', tr: '#', en: '#' }, { k: 'kod', tr: 'Kod', en: 'Code' }, { k: 'uretici_kodu', tr: 'Üretici kodu', en: 'Mfr. code' }, { k: 'aciklama', tr: 'Ürün', en: 'Product' },
  { k: 'gorsel', tr: 'Görsel', en: 'Image' }, { k: 'birim', tr: 'Birim', en: 'Unit' }, { k: 'adet', tr: 'Miktar', en: 'Qty' }, { k: 'fiyat', tr: 'Birim fiyat', en: 'Unit price' },
  { k: 'iskonto', tr: 'İsk. %', en: 'Disc. %' }, { k: 'kdv', tr: 'KDV %', en: 'VAT %' }, { k: 'tutar', tr: 'Tutar', en: 'Amount' }];
export const VARSAYILAN_SUTUN = ['sira', 'aciklama', 'adet', 'fiyat', 'iskonto', 'tutar'];

// ---------- Şablonlar ----------
// kapsam: sirket (herkes), kisi (yalnız oluşturan kullanıcı), bayi (bayinin kendi müşterisine; bayi kullanıcısı ve şirket görür)
export const sablonlar = () => (ayar('teklif_sablonlari', []) || []);
export function gorunenSablonlar() {
  const d = disKullanici(), e = ben();
  return sablonlar().filter(s => s.kapsam === 'sirket' || !s.kapsam || (s.kapsam === 'kisi' && (s.sahip === e || sahipMi())) || (s.kapsam === 'bayi' && (!d || s.firma_id === d.firma_id)));
}
export function sablonBul(id) {
  const l = gorunenSablonlar(), d = disKullanici();
  return l.find(s => s.id === id) || (d && l.find(s => s.kapsam === 'bayi' && s.firma_id === d.firma_id)) || l.find(s => s.kapsam === 'kisi' && s.sahip === ben() && s.varsayilan) || l.find(s => s.varsayilan) || l[0] || null;
}
// Belgede kullanılan bilgiler: şablon + eski "Teklif bilgileri" (ad, iletişim, koşullar)
export function belgeBilgisi(t) {
  const b = ayar('teklif_firma') || {}, s = sablonBul(t?.sablon_id) || {};
  return { ad: s.ad_firma || b.ad || firmaAdi(), iletisim: s.iletisim || b.iletisim || '', kosullar: s.kosullar ?? b.kosullar ?? '', logo: s.logo || null, renk: s.renk || '#1D2B36', vurgu: s.vurgu || '#F5B700',
    banka: s.banka || '', alt: s.alt_bilgi || '', imza: s.imza || benimAdim() || '', sutunlar: s.sutunlar?.length ? s.sutunlar : VARSAYILAN_SUTUN, dil: t?.dil || s.dil || 'tr', sablon: s };
}
export async function sablonKaydet(o) {
  const l = sablonlar().filter(s => s.id !== o.id), yeni = { ...o, id: o.id || 'sb' + Date.now().toString(36) };
  if (yeni.varsayilan) for (const s of l) if (s.kapsam === yeni.kapsam && (yeni.kapsam !== 'kisi' || s.sahip === yeni.sahip)) s.varsayilan = false;
  await ayarYaz('teklif_sablonlari', [...l, yeni]); return yeni;
}

// ---------- Numara ----------
export const noDuzeni = () => ({ onek: 'T', yil: true, hane: 3, kisi: false, ...(ayar('teklif_no_duzen') || {}) });
const basHarf = () => { const a = String(app.db?.user?.()?.user_metadata?.ad || ayar('benim_adim') || ben().split('@')[0] || '').trim(); return a.split(/[\s._-]+/).filter(Boolean).map(x => x[0]).join('').toLocaleUpperCase('tr').slice(0, 3) || 'X'; };
export function yeniNo() {
  const d = noDuzeni(), bas = [d.onek || 'T', d.kisi ? basHarf() : null, d.yil ? String(new Date().getFullYear()) : null].filter(Boolean).join('-') + '-';
  const max = (S.teklifler || []).map(t => String(t.teklif_no || '').replace(/-R\d+$/i, '')).filter(n => n.startsWith(bas)).map(n => parseInt(n.slice(bas.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return bas + String(max + 1).padStart(+d.hane || 3, '0');
}

// ---------- Hazır metin blokları ----------
const METIN_VARSAYILAN = [
  { ad: 'Ödeme şartları', metin: 'Ödeme: siparişte %30 avans, kalan teslimde.' },
  { ad: 'Teslim süresi', metin: 'Teslim: sipariş onayından itibaren 3–4 hafta.' },
  { ad: 'Garanti', metin: 'Garanti: armatürlerde 5 yıl, sürücülerde 3 yıl üretici garantisi.' },
  { ad: 'Geçerlilik', metin: 'Teklifimiz 15 gün geçerlidir.' }];
export const metinBloklari = () => ayar('teklif_metinleri') || METIN_VARSAYILAN;

// ---------- Alternatifler ve gruplar ----------
export const secenekler = t => [...new Set((t.kalemler || []).map(k => k.secenek).filter(Boolean))].sort();
export const secim = t => { const s = secenekler(t); return s.length ? (s.includes(t.secim) ? t.secim : s[0]) : null; };
// Toplama giren kalemler: alternatifsizler + seçili seçenek
export const toplamaGiren = (t, sec = secim(t)) => (t.kalemler || []).filter(k => !k.secenek || k.secenek === sec);
export const kalemTutar = k => (+k.adet || 0) * (+k.birim_fiyat || 0) * (1 - (+k.iskonto || 0) / 100);
export function hesapla2(t, sec) {
  const ara = toplamaGiren(t, sec).reduce((s, k) => s + kalemTutar(k), 0);
  const isk = ara * (+t.iskonto || 0) / 100, net = ara - isk, kdv = net * (+t.kdv || 0) / 100;
  return { ara, isk, net, kdv, genel: net + kdv };
}
// Mahal / kat grupları (kalem sırası korunur)
export function gruplar(kalemler) {
  const m = new Map(); for (const k of kalemler) { const g = String(k.grup || '').trim(); (m.get(g) || m.set(g, []).get(g)).push(k); }
  return [...m.entries()].map(([grup, l]) => ({ grup, kalemler: l, tutar: l.reduce((a, k) => a + kalemTutar(k), 0) }));
}
// Kâr: kalem maliyeti (kalemde ya da ürün listesinde USD) ve marj — yalnız içeride
export function kalemMaliyet(k) { if (k.maliyet != null && k.maliyet !== '') return +k.maliyet; const u = (S.urunler || []).find(x => x.kod === k.kod); return u?.maliyet_usd != null ? +u.maliyet_usd : null; }
export function karHesapla(t) {
  const l = toplamaGiren(t).map(k => ({ k, net: kalemTutar(k) * (1 - (+t.iskonto || 0) / 100), mal: kalemMaliyet(k) })).filter(x => x.mal != null);
  const net = l.reduce((a, x) => a + x.net, 0), mal = l.reduce((a, x) => a + x.mal * (+x.k.adet || 0), 0);
  return l.length ? { net, maliyet: mal, kar: net - mal, marj: net ? (net - mal) / net * 100 : null } : null;
}

// ---------- Fiyat: bu firmaya daha önce verilen fiyat, iskonto sınırı ----------
const revKok0 = no => String(no || '').replace(/-R\d+$/i, '');
export function oncekiFiyat(firma_id, kod, haric) {
  if (!firma_id || !kod) return null;
  const l = (S.teklifler || []).filter(t => t.firma_id === firma_id && t.id !== haric && (t.kalemler || []).some(k => k.kod === kod)).sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')) || String(b.teklif_no || '').localeCompare(String(a.teklif_no || '')));
  const t = l.find(x => x.durum === 'Kabul') || l[0]; if (!t) return null;
  const k = t.kalemler.find(x => x.kod === kod);
  return { fiyat: +k.birim_fiyat || 0, iskonto: +k.iskonto || 0, pb: t.para_birimi || 'USD', teklif_no: t.teklif_no, durum: t.durum, kok: revKok0(t.teklif_no) };
}
export const iskontoSiniri = () => { const v = ayar('teklif_iskonto_siniri'); return v === null || v === undefined || v === '' ? null : +v; };
// Kalem iskontosu ile genel iskontonun birleşik etkisi (%), toplama giren kalemlerin en yükseği
export const enYuksekIskonto = t => toplamaGiren(t).reduce((m, k) => Math.max(m, (1 - (1 - (+k.iskonto || 0) / 100) * (1 - (+t.iskonto || 0) / 100)) * 100), (+t.iskonto || 0));
export const KAYIP_NEDENLERI = ['Fiyat', 'Teslim süresi', 'Teknik uygunluk', 'Rakip marka tercih edildi', 'Proje iptal / ertelendi', 'Ödeme şartları', 'Yanıt alınamadı', 'Diğer'];

// ---------- Teknik ekler ----------
export function ekListesi(t) {
  const l = [...(t.ekler || [])], var_ = new Set(l.map(x => x.url));
  for (const k of t.kalemler || []) { const u = k.kod && (S.urunler || []).find(x => x.kod === k.kod); if (!u) continue;
    for (const [alan, ad] of [['foy_url', 'ürün föyü'], ['sertifika_url', 'sertifika'], ['fotometri_url', 'fotometrik dosya']]) if (u[alan] && !var_.has(u[alan])) { var_.add(u[alan]); l.push({ ad: `${u.kod} ${ad}`, url: u[alan] }); } }
  return l;
}

// ---------- Belge ----------
export function teklifBelgesi(t) {
  const B = belgeBilgisi(t), D = SOZ[B.dil] || SOZ.tr, pb = t.para_birimi || 'USD', P = v => para(v, pb, B.dil);
  const f = byId('firmalar', t.firma_id), k = byId('kisiler', t.kisi_id), p = byId('projeler', t.proje_id), sec = secim(t), h = hesapla2(t, sec);
  const kol = B.sutunlar.filter(c => SUTUNLAR.some(s => s.k === c)), bas = c => (SUTUNLAR.find(s => s.k === c) || {})[B.dil] || c;
  const sag = new Set(['adet', 'fiyat', 'iskonto', 'kdv', 'tutar']);
  let sira = 0;
  const hucre = (c, x) => { const u = x.kod && (S.urunler || []).find(y => y.kod === x.kod);
    switch (c) { case 'sira': return ++sira; case 'kod': return esc(x.kod || ''); case 'uretici_kodu': return esc(x.uretici_kodu || u?.aciklama2 || '');
      case 'aciklama': { const b = urunBilgi(x.ad || ''), alt = [!kol.includes('kod') && x.kod && 'Kod ' + x.kod, b.w && b.w + ' W', b.lm && num(b.lm) + ' lm', b.k && b.k + ' K'].filter(Boolean).join(' · '); return `${esc(x.ad || '')}${alt ? `<br><small>${esc(alt)}</small>` : ''}${x.not ? `<br><small>${esc(x.not)}</small>` : ''}`; } case 'gorsel': return x.gorsel || u?.gorsel ? `<img src="${esc(x.gorsel || u.gorsel)}" alt="" style="max-height:38px">` : '';
      case 'birim': return esc(x.birim || u?.birim || ''); case 'adet': return num(x.adet); case 'fiyat': return P(x.birim_fiyat); case 'iskonto': return +x.iskonto ? num(x.iskonto) : '';
      case 'kdv': return num(t.kdv); case 'tutar': return P(kalemTutar(x)); default: return ''; } };
  const tablo = l => `<table><thead><tr>${kol.map(c => `<th class="${sag.has(c) ? 'r' : ''}">${esc(bas(c))}</th>`).join('')}</tr></thead><tbody>${gruplar(l).map(g => `${g.grup ? `<tr class="g"><td colspan="${kol.length}">${esc(g.grup)}</td></tr>` : ''}${g.kalemler.map(x => `<tr>${kol.map(c => `<td class="${sag.has(c) ? 'r' : ''}">${hucre(c, x)}</td>`).join('')}</tr>`).join('')}${g.grup && gruplar(l).length > 1 ? `<tr class="gt"><td colspan="${kol.length - 1}" class="r">${esc(g.grup)} ${D.araToplam}</td><td class="r">${P(g.tutar)}</td></tr>` : ''}`).join('')}</tbody></table>`;
  const ss = secenekler(t), temel = (t.kalemler || []).filter(x => !x.secenek);
  const ekl = ekListesi(t), tes = [t.teslim_suresi && `${D.sure}: ${esc(t.teslim_suresi)}`, t.teslim_yeri && `${D.yer}: ${esc(t.teslim_yeri)}`, t.teslim_sekli && `${D.sekil}: ${esc(t.teslim_sekli)}`].filter(Boolean);
  return `<!doctype html><html lang="${B.dil}"><head><meta charset="utf-8"><title>${esc(t.teklif_no)} ${esc(f?.ad || '')}</title><style>
    @page { size: A4; margin: 15mm 13mm; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { font: 9.5pt/1.45 Arial, Helvetica, sans-serif; color: #1D2B36; margin: 0; }
    thead { display: table-header-group; } tr { break-inside: avoid; } header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid ${esc(B.vurgu)}; padding-bottom: 10px; margin-bottom: 14px; }
    .logo { max-height: 56px; max-width: 200px; display: block; margin-bottom: 6px; } h1 { font-size: 20pt; margin: 0; color: ${esc(B.renk)}; letter-spacing: .5px; } .firm b { font-size: 12.5pt; } .firm, .meta { font-size: 9pt; color: #4A5A66; } .meta { text-align: right; }
    .to { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; } .to div { background: #F4F6F8; padding: 8px 10px; border-radius: 4px; } .to small { color: #66757F; display: block; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .4px; }
    table { width: 100%; border-collapse: collapse; } th { background: ${esc(B.renk)}; color: #fff; text-align: left; padding: 6px 7px; font-size: 8.5pt; } td { padding: 5px 7px; border-bottom: 1px solid #E3E8EC; vertical-align: top; } td small { color: #66757F; }
    tr.g td { background: #EEF2F5; font-weight: 700; } tr.gt td { font-style: italic; color: #4A5A66; border-bottom: 2px solid #DCE2E6; } .r { text-align: right; white-space: nowrap; }
    h2 { font-size: 11pt; margin: 16px 0 6px; color: ${esc(B.renk)}; } .tot { margin-left: auto; width: 55%; margin-top: 10px; } .tot td { border: 0; padding: 3px 7px; } .tot tr.gn td { border-top: 2px solid ${esc(B.renk)}; font-weight: 700; font-size: 11.5pt; }
    .kutu { margin-top: 12px; padding: 8px 10px; background: #F7F8FA; border-radius: 4px; white-space: pre-wrap; } footer { margin-top: 26px; font-size: 8.5pt; color: #4A5A66; display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #DCE2E6; padding-top: 6px; }
    .ek a { color: ${esc(B.renk)}; }
  </style></head><body>
  <header><div class="firm">${B.logo ? `<img class="logo" src="${B.logo}" alt="">` : ''}<b>${esc(B.ad)}</b><br>${esc(B.iletisim).replace(/\n/g, '<br>')}</div><div class="meta"><h1>${D.baslik}</h1>${D.no}: <b>${esc(t.teklif_no || '')}</b><br>${D.tarih}: ${tarih(t.tarih)}${t.gecerlilik ? `<br>${D.gec}: ${tarih(t.gecerlilik)}` : ''}</div></header>
  <div class="to"><div><small>${D.sayin}</small><b>${esc(f?.ad || '')}</b>${k ? `<br>${esc(k.ad_soyad)}${k.unvan ? ' · ' + esc(k.unvan) : ''}` : ''}${f?.adres ? `<br>${esc(f.adres)}` : ''}</div><div><small>${D.proje}</small><b>${esc(p?.ad || '—')}</b>${p?.il ? `<br>${esc([p.ilce, p.il].filter(Boolean).join(' / '))}` : ''}</div></div>
  ${temel.length ? tablo(temel) : ''}
  ${ss.map(s => { const l = (t.kalemler || []).filter(x => x.secenek === s), hs = hesapla2(t, s); return `<h2>${D.secenek} ${esc(s)}${s === sec && ss.length > 1 ? ' ✓' : ''}</h2>${tablo(l)}${ss.length > 1 ? `<p class="r"><small>${D.secenek} ${esc(s)} ${D.secilirse}: <b>${P(hs.genel)}</b></small></p>` : ''}`; }).join('')}
  <table class="tot"><tr><td>${D.ara}${ss.length ? ` (${D.secenek} ${esc(sec)})` : ''}</td><td class="r">${P(h.ara)}</td></tr>${h.isk ? `<tr><td>${D.isk} (%${num(t.iskonto)})</td><td class="r">−${P(h.isk)}</td></tr>` : ''}<tr><td>${D.net}</td><td class="r"><b>${P(h.net)}</b></td></tr><tr><td>${D.kdv} (%${num(t.kdv)})</td><td class="r">${P(h.kdv)}</td></tr><tr class="gn"><td>${D.genel}</td><td class="r">${P(h.genel)}</td></tr></table>
  ${tes.length ? `<h2>${D.teslim}</h2><div>${tes.join('<br>')}</div>` : ''}
  ${t.kur ? `<div class="kutu">${D.kur}: 1 ${esc(pb === 'TRY' ? 'USD' : pb)} = ${num(t.kur)} ₺${t.kur_tarihi ? ' (' + tarih(t.kur_tarihi) + ')' : ''}${t.kur_maddesi ? '\n' + D.kurMadde : ''}</div>` : t.kur_maddesi ? `<div class="kutu">${D.kurMadde}</div>` : ''}
  ${t.notlar || B.kosullar ? `<h2>${D.not}</h2><div class="kutu">${esc([t.notlar, B.kosullar].filter(Boolean).join('\n\n'))}</div>` : ''}
  ${ekl.length ? `<h2>${D.ekler}</h2><div class="ek">${ekl.map(e => `• <a href="${esc(e.url)}">${esc(e.ad || e.url)}</a>`).join('<br>')}</div>` : ''}
  ${B.banka ? `<h2>${D.banka}</h2><div class="kutu">${esc(B.banka)}</div>` : ''}
  <footer><span>${esc(B.imza)}</span><span>${esc(B.alt || B.ad)}</span></footer>
  </body></html>`;
}

// ---------- Anında önizleme ----------
export function onizlemeBagla(panel, t, oku) {
  const kutu = panel.querySelector('[data-onizleme]'); if (!kutu) return () => {};
  let zm;
  const yenile = () => { if (kutu.hidden) return; clearTimeout(zm); zm = setTimeout(() => { const fr = kutu.querySelector('iframe'); fr.srcdoc = teklifBelgesi({ ...t, ...(oku?.() || {}) }); }, 250); };
  panel.querySelector('[data-onizle]')?.addEventListener('click', e => { kutu.hidden = !kutu.hidden; e.target.textContent = kutu.hidden ? 'Önizleme' : 'Önizlemeyi kapat'; yenile(); });
  return yenile;
}

// ---------- Revizyon karşılaştırma ----------
export function revizyonFarki(a, b) {
  const anah = k => k.kod || fold(k.ad || ''), ma = new Map((a.kalemler || []).map(k => [anah(k), k])), mb = new Map((b.kalemler || []).map(k => [anah(k), k]));
  const satir = [];
  for (const [x, kb] of mb) { const ka = ma.get(x); if (!ka) satir.push({ tur: 'yeni', k: kb }); else { const d = ['adet', 'birim_fiyat', 'iskonto'].filter(f => (+ka[f] || 0) !== (+kb[f] || 0)); if (d.length) satir.push({ tur: 'deg', k: kb, eski: ka, alan: d }); } }
  for (const [x, ka] of ma) if (!mb.has(x)) satir.push({ tur: 'cikti', k: ka });
  return { satir, toplamA: hesapla2(a).net, toplamB: hesapla2(b).net };
}
export function revizyonPenceresi(a, b) {
  const F = revizyonFarki(a, b), pb = b.para_birimi || 'USD', ad = { adet: 'miktar', birim_fiyat: 'fiyat', iskonto: 'iskonto' };
  openDrawer(`<header class="dh"><div><p class="muted">Revizyon karşılaştırma</p><h2 id="drawer-title">${esc(a.teklif_no)} → ${esc(b.teklif_no)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p>Toplam (KDV hariç): ${para(F.toplamA, a.para_birimi)} → <b>${para(F.toplamB, pb)}</b> <span class="${F.toplamB < F.toplamA ? 'neg' : 'pos'}">(${F.toplamB >= F.toplamA ? '+' : ''}${para(F.toplamB - F.toplamA, pb)})</span></p>
    ${F.satir.length ? `<div class="tbl-wrap"><table class="tbl rv-t"><thead><tr><th>Kalem</th><th>Değişiklik</th></tr></thead><tbody>${F.satir.map(x => `<tr class="rv-${x.tur}"><td>${esc(x.k.kod || '')} ${esc(x.k.ad || '')}</td><td>${x.tur === 'yeni' ? `eklendi: ${num(x.k.adet)} × ${para(x.k.birim_fiyat, pb)}` : x.tur === 'cikti' ? 'çıkarıldı' : x.alan.map(f => `${ad[f]} ${f === 'birim_fiyat' ? para(x.eski[f], pb) + ' → ' + para(x.k[f], pb) : num(x.eski[f] || 0) + ' → ' + num(x.k[f] || 0)}`).join(', ')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Kalemlerde değişiklik yok.</p>'}</div>`, { wide: true });
}

// ---------- Teklif raporu ----------
const revKok = no => String(no || '').replace(/-R\d+$/i, '');
const revNo = no => { const m = /-R(\d+)$/i.exec(no || ''); return m ? +m[1] : 1; };
export function teklifRaporu() {
  const son = new Map(); for (const t of S.teklifler || []) { const k = revKok(t.teklif_no); if (!son.has(k) || revNo(t.teklif_no) > revNo(son.get(k).teklif_no)) son.set(k, t); }
  const l = [...son.values()].filter(t => ['Kabul', 'Red', 'Gönderildi'].includes(t.durum));
  const grupla = (anahtar, ad) => { const m = new Map(); for (const t of l) for (const g of [].concat(anahtar(t))) { const k = g || '—'; const e = m.get(k) || { ad: ad(k), kabul: 0, red: 0, bekleyen: 0, isk: [], sure: [] }; e[t.durum === 'Kabul' ? 'kabul' : t.durum === 'Red' ? 'red' : 'bekleyen']++;
      const ort = (t.kalemler || []).length ? (t.kalemler || []).reduce((a, x) => a + (+x.iskonto || 0), 0) / t.kalemler.length + (+t.iskonto || 0) : +t.iskonto || 0; e.isk.push(ort);
      if (t.yanit_tarihi && (t.gonderim_tarihi || t.tarih)) e.sure.push(Math.max(0, Math.round((new Date(t.yanit_tarihi) - new Date(t.gonderim_tarihi || t.tarih)) / 864e5))); m.set(k, e); }
    return [...m.values()].map(e => ({ ...e, oran: e.kabul + e.red ? Math.round(e.kabul / (e.kabul + e.red) * 100) : null, ortIsk: e.isk.length ? e.isk.reduce((a, b) => a + b, 0) / e.isk.length : null, ortSure: e.sure.length ? Math.round(e.sure.reduce((a, b) => a + b, 0) / e.sure.length) : null })).sort((a, b) => (b.kabul + b.red + b.bekleyen) - (a.kabul + a.red + a.bekleyen)); };
  const aile = t => [...new Set((t.kalemler || []).map(x => (S.urunler || []).find(u => u.kod === x.kod)?.aile).filter(Boolean))];
  return { genel: grupla(() => 'Hepsi', () => 'Hepsi')[0] || null, firma: grupla(t => t.firma_id, k => firmaAd(k) || '—'), aile: grupla(t => aile(t).length ? aile(t) : ['—'], k => k), tur: grupla(t => byId('projeler', t.proje_id)?.sektor || byId('projeler', t.proje_id)?.yeni_refit, k => k), kisi: grupla(t => t.sorumlu || t.olusturan, k => k) };
}
export function teklifRaporuPenceresi() {
  const R = teklifRaporu(), tab = (bas, l) => `<h3>${bas}</h3>${l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">Kabul</th><th class="r">Red</th><th class="r">Bekleyen</th><th class="r">Kazanma</th><th class="r">Ort. iskonto</th><th class="r">Yanıt süresi</th></tr></thead><tbody>${l.slice(0, 25).map(e => `<tr><td>${esc(e.ad)}</td><td class="r num">${e.kabul}</td><td class="r num">${e.red}</td><td class="r num">${e.bekleyen}</td><td class="r num">${e.oran == null ? '—' : '%' + e.oran}</td><td class="r num">${e.ortIsk == null ? '—' : '%' + num(Math.round(e.ortIsk * 10) / 10)}</td><td class="r num">${e.ortSure == null ? '—' : e.ortSure + ' gün'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Veri yok.</p>'}`;
  openDrawer(`<header class="dh"><div><p class="muted">Teklifler</p><h2 id="drawer-title">Teklif raporu</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="hint">Her teklifin son revizyonu sayılır. Kazanma oranı = kabul / (kabul + red). Yanıt süresi: gönderimden kabul ya da red tarihine.</p>
    ${R.genel ? `<p><b>Kazanma oranı ${R.genel.oran == null ? '—' : '%' + R.genel.oran}</b> · ${R.genel.kabul} kabul, ${R.genel.red} red, ${R.genel.bekleyen} bekleyen · ortalama iskonto ${R.genel.ortIsk == null ? '—' : '%' + num(Math.round(R.genel.ortIsk * 10) / 10)} · yanıt süresi ${R.genel.ortSure == null ? '—' : R.genel.ortSure + ' gün'}</p>` : ''}
    ${tab('Firma', R.firma)}${tab('Ürün grubu', R.aile)}${tab('Proje türü', R.tur)}${tab('Kullanıcı', R.kisi)}</div>`, { wide: true });
}

// ---------- Ayarlar: şablonlar, numara düzeni, metin blokları ----------
function logoKucult(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 400 / img.width, 160 / img.height), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; img.onerror = rej; img.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
}
export function sablonPenceresi(sonra) {
  const d = disKullanici(), yonetici = sahipMi();
  const ciz = () => { const l = gorunenSablonlar(), n = noDuzeni(), m = metinBloklari();
    return `<header class="dh"><div><p class="muted">Teklifler</p><h2 id="drawer-title">Şablonlar ve numaralar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      <h3>Şablonlar</h3><p class="hint">Logo, antet, renk, banka bilgileri, alt bilgi, imza, sütunlar ve dil. Şirket şablonu herkesin; kişisel şablon yalnız senin; bayi şablonu bayinin kendi müşterisine verdiği teklif içindir. Teklif kesilirken şablon seçilir.</p>
      ${l.length ? `<ul class="list">${l.map(s => `<li><span><b>${esc(s.ad)}</b> <small class="muted">${{ sirket: 'şirket', kisi: 'kişisel', bayi: 'bayi: ' + esc(firmaAd(s.firma_id) || '') }[s.kapsam || 'sirket']}${s.varsayilan ? ' · varsayılan' : ''} · ${DILLER[s.dil || 'tr']}</small></span><span class="btnrow"><button type="button" class="btn sm" data-sduz="${s.id}">Düzenle</button>${yonetici || s.sahip === ben() ? `<button type="button" class="btn sm ghost danger" data-ssil="${s.id}">Sil</button>` : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Henüz şablon yok; teklifler “Teklif bilgileri”yle basılır.</p>'}
      <button type="button" class="btn" data-syeni>+ Şablon</button>
      ${!d ? `<h3>Teklif numarası</h3><div class="frow"><label class="fld"><span>Önek</span><input data-no="onek" value="${esc(n.onek)}"></label><label class="fld"><span>Sayaç hanesi</span><input data-no="hane" type="number" value="${+n.hane || 3}"></label></div>
        <label class="chk"><input type="checkbox" data-no="yil" ${n.yil ? 'checked' : ''}> <span>Yılı ekle</span></label><label class="chk"><input type="checkbox" data-no="kisi" ${n.kisi ? 'checked' : ''}> <span>Her kullanıcıya ayrı seri (adının baş harfleri)</span></label>
        <p class="hint" data-noornek></p><button type="button" class="btn sm" data-nokaydet>Numara düzenini kaydet</button>
        ${yonetici ? `<h3>İskonto ve kâr sınırı</h3><div class="frow"><label class="fld"><span>İskonto sınırı (%)</span><input data-isinir type="number" inputmode="decimal" value="${iskontoSiniri() ?? ''}" placeholder="sınır yok"></label><label class="fld"><span>En düşük kâr marjı (%)</span><input data-mmarj type="number" inputmode="decimal" value="${ayar('teklif_min_marj') ?? ''}" placeholder="uyarı yok"></label></div>
        <p class="hint">Ekip üyesi sınırı aşan iskonto verirse teklif Onay kuyruğuna düşer, onaylanana kadar müşteriye gönderilemez. Marj sınırın altına inerse teklif ekranında kırmızı görünür.</p><button type="button" class="btn sm" data-iskaydet>Sınırları kaydet</button>` : ''}
        <h3>Hazır metin blokları</h3><p class="hint">Teklif notuna tek tuşla eklenir. Her satır: başlık | metin</p><textarea data-metin rows="6">${esc(m.map(x => `${x.ad} | ${x.metin}`).join('\n'))}</textarea><button type="button" class="btn sm" data-mkaydet>Metinleri kaydet</button>` : ''}
    </div>`; };
  const p = openDrawer(ciz(), { wide: true });
  const bagla = () => {
    const yen = () => { p.innerHTML = ciz(); bagla(); sonra?.(); };
    p.querySelector('[data-syeni]').onclick = () => sablonFormu({ kapsam: d ? 'bayi' : 'sirket', firma_id: d?.firma_id || null, sutunlar: VARSAYILAN_SUTUN, dil: 'tr', renk: '#1D2B36', vurgu: '#F5B700' }, yen);
    p.querySelectorAll('[data-sduz]').forEach(b => b.onclick = () => sablonFormu(sablonlar().find(s => s.id === b.dataset.sduz), yen));
    p.querySelectorAll('[data-ssil]').forEach(b => b.onclick = async () => { const s = sablonlar().find(x => x.id === b.dataset.ssil); if (!confirmBox(`“${s.ad}” şablonu silinsin mi?`)) return; await ayarYaz('teklif_sablonlari', sablonlar().filter(x => x.id !== s.id)); toast('Şablon silindi.'); yen(); });
    const noOku = () => ({ onek: p.querySelector('[data-no=onek]').value.trim() || 'T', hane: Math.min(8, Math.max(2, +p.querySelector('[data-no=hane]').value || 3)), yil: p.querySelector('[data-no=yil]').checked, kisi: p.querySelector('[data-no=kisi]').checked });
    const orn = () => { const o = noOku(); const e = p.querySelector('[data-noornek]'); if (e) e.textContent = 'Örnek: ' + [o.onek, o.kisi ? basHarf() : null, o.yil ? new Date().getFullYear() : null].filter(Boolean).join('-') + '-' + '1'.padStart(o.hane, '0') + ' · revizyon: …-R2'; };
    p.querySelectorAll('[data-no]').forEach(i => i.oninput = orn); if (p.querySelector('[data-no]')) orn();
    p.querySelector('[data-nokaydet]')?.addEventListener('click', async () => { await ayarYaz('teklif_no_duzen', noOku()); toast('Numara düzeni kaydedildi.'); });
    p.querySelector('[data-iskaydet]')?.addEventListener('click', async () => { const v = p.querySelector('[data-isinir]').value, m = p.querySelector('[data-mmarj]').value; await ayarYaz('teklif_iskonto_siniri', v === '' ? null : +v); await ayarYaz('teklif_min_marj', m === '' ? null : +m); toast('Sınırlar kaydedildi.'); });
    p.querySelector('[data-mkaydet]')?.addEventListener('click', async () => { const l = p.querySelector('[data-metin]').value.split('\n').map(s => s.split('|')).filter(x => x[0]?.trim() && x[1]?.trim()).map(([a, ...b]) => ({ ad: a.trim(), metin: b.join('|').trim() })); await ayarYaz('teklif_metinleri', l); toast(`${l.length} metin bloğu kaydedildi.`); });
  };
  bagla();
}
function sablonFormu(s0, sonra) {
  const s = { ...s0 }, d = disKullanici(), b = ayar('teklif_firma') || {};
  const p = openDrawer(`<header class="dh"><div><p class="muted">Teklif şablonu</p><h2 id="drawer-title">${esc(s.ad || 'Yeni şablon')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>
      <label class="fld"><span>Şablon adı</span><input name="ad" value="${esc(s.ad || '')}" placeholder="Proje teklifi, Bayi fiyat listesi, İngilizce teklif…" required></label>
      ${d ? '' : `<label class="fld"><span>Kapsam</span><select name="kapsam"><option value="sirket" ${s.kapsam === 'sirket' ? 'selected' : ''}>Şirket (herkes)</option><option value="kisi" ${s.kapsam === 'kisi' ? 'selected' : ''}>Kişisel (yalnız ben)</option><option value="bayi" ${s.kapsam === 'bayi' ? 'selected' : ''}>Bayi şablonu</option></select></label>
        <label class="fld" data-bayisec ${s.kapsam === 'bayi' ? '' : 'hidden'}><span>Bayi</span><select name="firma_id">${(S.bayiler || []).map(x => `<option value="${x.firma_id}" ${x.firma_id === s.firma_id ? 'selected' : ''}>${esc(firmaAd(x.firma_id))}</option>`).join('')}</select></label>`}
      <label class="fld"><span>Logo</span><input type="file" accept="image/*" data-logo>${s.logo ? `<img src="${s.logo}" alt="" class="sb-logo">` : ''}</label>
      <div class="frow"><label class="fld"><span>Ana renk</span><input type="color" name="renk" value="${esc(s.renk || '#1D2B36')}"></label><label class="fld"><span>Vurgu rengi</span><input type="color" name="vurgu" value="${esc(s.vurgu || '#F5B700')}"></label><label class="fld"><span>Dil</span><select name="dil">${Object.entries(DILLER).map(([k, v]) => `<option value="${k}" ${(s.dil || 'tr') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <label class="fld"><span>Firma adı (antet)</span><input name="ad_firma" value="${esc(s.ad_firma || b.ad || firmaAdi())}"></label>
      <label class="fld"><span>İletişim (antet)</span><textarea name="iletisim" rows="3">${esc(s.iletisim ?? b.iletisim ?? '')}</textarea></label>
      <label class="fld"><span>Banka bilgileri</span><textarea name="banka" rows="3" placeholder="Banka, şube, IBAN">${esc(s.banka || '')}</textarea></label>
      <label class="fld"><span>Standart koşullar</span><textarea name="kosullar" rows="3">${esc(s.kosullar ?? b.kosullar ?? '')}</textarea></label>
      <div class="frow"><label class="fld"><span>Alt bilgi</span><input name="alt_bilgi" value="${esc(s.alt_bilgi || '')}"></label><label class="fld"><span>İmza</span><input name="imza" value="${esc(s.imza || '')}" placeholder="${esc(benimAdim() || 'Ad Soyad · Ünvan')}"></label></div>
      <fieldset class="sg-sec"><legend>Sütunlar (işaretle, ↑↓ ile sırala)</legend><ul class="sb-sutun">${[...(s.sutunlar || VARSAYILAN_SUTUN), ...SUTUNLAR.map(x => x.k).filter(k => !(s.sutunlar || VARSAYILAN_SUTUN).includes(k))].map(k => `<li data-k="${k}"><label class="chk"><input type="checkbox" ${(s.sutunlar || VARSAYILAN_SUTUN).includes(k) ? 'checked' : ''}> <span>${esc(SUTUNLAR.find(x => x.k === k)?.tr || k)}</span></label><button type="button" class="btn sm ghost" data-yuk aria-label="Yukarı">↑</button><button type="button" class="btn sm ghost" data-asa aria-label="Aşağı">↓</button></li>`).join('')}</ul></fieldset>
      <label class="chk"><input type="checkbox" name="varsayilan" ${s.varsayilan ? 'checked' : ''}> <span>Bu kapsamda varsayılan şablon</span></label>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`, { wide: true });
  p.querySelector('[name=kapsam]')?.addEventListener('change', e => { p.querySelector('[data-bayisec]').hidden = e.target.value !== 'bayi'; });
  p.querySelector('[data-logo]').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { s.logo = await logoKucult(f); toast('Logo hazır.'); } catch { toast('Logo okunamadı.', 'err'); } };
  const ul = p.querySelector('.sb-sutun');
  ul.onclick = e => { const li = e.target.closest('li'); if (!li) return; if (e.target.matches('[data-yuk]') && li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling); if (e.target.matches('[data-asa]') && li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li); };
  p.querySelector('form').onsubmit = async e => { e.preventDefault(); const v = n => p.querySelector(`[name=${n}]`);
    const o = { ...s, ad: v('ad').value.trim(), kapsam: d ? 'bayi' : v('kapsam').value, firma_id: d ? d.firma_id : (v('kapsam').value === 'bayi' ? v('firma_id')?.value : null), renk: v('renk').value, vurgu: v('vurgu').value, dil: v('dil').value,
      ad_firma: v('ad_firma').value.trim(), iletisim: v('iletisim').value.trim(), banka: v('banka').value.trim(), kosullar: v('kosullar').value.trim(), alt_bilgi: v('alt_bilgi').value.trim(), imza: v('imza').value.trim(), varsayilan: v('varsayilan').checked,
      sutunlar: [...ul.querySelectorAll('li')].filter(li => li.querySelector('input').checked).map(li => li.dataset.k) };
    if (!o.ad) return toast('Şablon adını yaz.', 'err');
    if (o.kapsam === 'kisi') o.sahip = s.sahip || ben();
    await sablonKaydet(o); toast('Şablon kaydedildi.'); closeDrawer(true); sonra?.(); };
}
