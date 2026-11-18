// Hızlı teklif taslağı: ürün kalemleri, yazdırılabilir PDF, WhatsApp özeti
import { ozellikSay } from '../saglik.js';
import { cariIste } from '../zorunlu.js';
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, tarih, today, gunEkle, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, waLink, ACIK, urunBilgi, exportXlsx } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { ayar, ayarYaz } from '../ayar.js';
import { benimAdim } from '../sablon.js';
import { tl, kur } from '../kur.js';
import { firmaAdi } from '../profil.js';
import { stokAdet, stokMetni } from '../stok.js';
import { hesapla2, yeniNo, teklifBelgesi, toplamaGiren, secenekler, secim, karHesapla, kalemMaliyet, kalemTutar, gorunenSablonlar, sablonBul, DILLER, TESLIM_SEKILLERI, metinBloklari, ekListesi, onizlemeBagla, revizyonPenceresi, teklifRaporuPenceresi, sablonPenceresi, oncekiFiyat, iskontoSiniri, enYuksekIskonto, KAYIP_NEDENLERI } from '../teklif2.js';
import { sahipMi, disKullanici } from '../yetki.js';

export const TEKLIF_DURUM = [{ k: 'Taslak', c: '#64748B' }, { k: 'Gönderildi', c: '#7C3AED' }, { k: 'Kabul', c: '#15803D' }, { k: 'Red', c: '#B91C1C' }];
const tpill = d => `<span class="pill" style="--c:${(TEKLIF_DURUM.find(x => x.k === d) || TEKLIF_DURUM[0]).c}">${esc(d)}</span>`;
const PB = { USD: '$', EUR: '€', TRY: '₺' };
const para = (v, pb = 'USD') => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' ' + (PB[pb] || pb);

// Alternatifli teklifte (Seçenek A / B) yalnız seçili seçenek toplama girer
export const hesapla = t => hesapla2(t);
// Numara düzeni Teklifler → Şablonlar'dan (önek, yıl, hane, kişi serisi); varsayılan T-YYYY-NNN
export const yeniTeklifNo = () => yeniNo();

const formu = () => [{ title: 'Teklif', fields: [
  { k: 'teklif_no', l: 'Teklif no' },
  { k: 'durum', l: 'Durum', t: 'sel', opts: TEKLIF_DURUM.map(d => d.k) },
  { k: 'tarih', l: 'Tarih', t: 'date' },
  { k: 'gecerlilik', l: 'Geçerlilik tarihi', t: 'date' },
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar' },
  { k: 'kisi_id', l: 'Yetkili', t: 'ref', ref: 'kisiler' },
  { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler', full: true },
  { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['USD', 'EUR', 'TRY'] },
  { k: 'iskonto', l: 'Genel iskonto (%)', t: 'num' },
  { k: 'kdv', l: 'KDV (%)', t: 'num' },
  ...(gorunenSablonlar().length ? [{ k: 'sablon_id', l: 'Şablon', t: 'sel', ph: 'Varsayılan', opts: gorunenSablonlar().map(s => ({ v: s.id, l: s.ad })) }] : []),
  { k: 'dil', l: 'Belge dili', t: 'sel', ph: 'Şablondaki', opts: Object.entries(DILLER).map(([v, l]) => ({ v, l })) },
]}, { title: 'Teslim ve kur', kapali: o => !(o.teslim_suresi || o.teslim_yeri || o.teslim_sekli || o.kur), ozet: 'teslim süresi, yeri, şekli, teklif kuru', fields: [
  { k: 'teslim_suresi', l: 'Teslim süresi', ph: 'Sipariş onayından itibaren 3–4 hafta' },
  { k: 'teslim_yeri', l: 'Teslim yeri', ph: 'Şantiye, depo, adres…' },
  { k: 'teslim_sekli', l: 'Teslim şekli', t: 'combo', opts: TESLIM_SEKILLERI.filter(Boolean) },
  { k: 'kur', l: 'Teklif kuru (1 USD / EUR = ₺)', t: 'num', help: 'Teklif gününün kuru belgeye yazılır' },
  { k: 'kur_tarihi', l: 'Kur tarihi', t: 'date' },
  { k: 'kur_maddesi', l: 'Kur maddesi', t: 'chk', cl: '“Kur farkı alıcıya aittir” maddesi eklensin' },
]}, { title: 'Kayıp nedeni', id: 'kayip', show: o => o.durum === 'Red', note: 'Red edilen teklifte neden zorunlu; kayıp analizi ve teklif raporu bunu kullanır.', fields: [
  { k: 'kayip_neden', l: 'Neden', t: 'sel', opts: KAYIP_NEDENLERI, req: true },
  { k: 'kayip_rakip', l: 'Kazanan rakip / marka' },
  { k: 'kayip_fiyat', l: 'Rakibin fiyatı (toplam)', t: 'num' },
]}];
const NOT_FORM = [{ title: 'Not ve koşullar', fields: [{ k: 'notlar', l: 'Teklif notu', t: 'area', rows: 3, ph: 'Teslim süresi, ödeme koşulu, garanti…' }] }];

// Revizyon: aynı kök numaralı teklifler (T-2026-014, T-2026-014-R2, -R3…)
export const revKok = no => String(no || '').replace(/-R\d+$/i, '');
export const revNo = no => { const m = /-R(\d+)$/i.exec(no || ''); return m ? +m[1] : 1; };
export function teklifForm(init = {}, after) {
  const FORM = formu();
  const t0 = init.id ? byId('teklifler', init.id) : null;
  const t = t0 ? { ...t0, kalemler: (t0.kalemler || []).map(k => ({ ...k })) } : {
    teklif_no: yeniTeklifNo(), tarih: today(), kur: init.para_birimi === 'TRY' ? null : (kur()?.USD || null), kur_tarihi: kur()?.USD ? today() : null, dil: sablonBul()?.dil || 'tr', gecerlilik: gunEkle(today(), 15), para_birimi: 'USD', iskonto: 0, kdv: 20, durum: 'Taslak', kalemler: [], _new: true,
    ...init, ...(init.proje_id && !init.firma_id ? { firma_id: byId('projeler', init.proje_id)?.emut_id || byId('projeler', init.proje_id)?.alici_id || null } : {}),
  };
  t.kalemler = t.kalemler || [];
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${t._new ? 'Yeni teklif' : 'Teklif'}</p><h2 id="drawer-title">${esc(t.teklif_no || 'Teklif')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${t._new ? '' : `<div class="dh-actions"><button class="btn sm" data-a="pdf">PDF / yazdır</button><button class="btn sm" data-a="wa">WhatsApp</button><button class="btn sm" data-a="eposta" title="Firmanın teklif e-postası kendiliğinden dolar">E-posta</button><button class="btn sm" data-a="baglanti" title="Müşteri teklifi bağlantıdan açıp onaylar">Onay bağlantısı</button><button class="btn sm" data-a="revize">Revize et</button>${S.teklifler.filter(x => revKok(x.teklif_no) === revKok(t.teklif_no)).length > 1 && revNo(t.teklif_no) > 1 ? '<button class="btn sm ghost" data-a="karsilastir" title="Önceki revizyonla karşılaştır">Karşılaştır</button>' : ''}${['Kabul', 'Gönderildi'].includes(t.durum) && (t.kalemler || []).length ? '<button class="btn sm ghost" data-a="sevk" title="Teklif kalemleriyle sevk belgesi">Sevk belgesi</button>' : ''}${t.durum !== 'Red' ? '<button class="btn sm ghost" data-a="siparis" title="Teklifi Kabul yap, projeyi Sipariş aşamasına al, sipariş kaydını aç">Sipariş oldu</button>' : ''}<button class="btn sm ghost" data-a="kopya">Kopyasını oluştur</button><button class="btn sm ghost danger" data-a="sil">Sil</button></div>`}
    ${(() => { if (t._new) return ''; const rv = S.teklifler.filter(x => revKok(x.teklif_no) === revKok(t.teklif_no)).sort((a, b) => revNo(a.teklif_no) - revNo(b.teklif_no)); return rv.length > 1 ? `<div class="rev-list"><b>Revizyonlar</b>${rv.map(x => `<button type="button" class="chip ${x.id === t.id ? 'on' : ''}" data-rev="${x.id}">${esc(x.teklif_no)} · ${esc(x.durum)} · ${para(x.toplam, x.para_birimi)}</button>`).join('')}</div>` : ''; })()}
    ${t.onay === 'Bekliyor' ? '<p class="uyari-k warn">İskonto sınırı aşıldığı için yönetici onayı bekleniyor; onaylanana kadar müşteriye gönderilemez.</p>' : t.onay === 'Reddedildi' ? '<p class="uyari-k neg">Yönetici iskontoyu onaylamadı; iskontoyu düşürüp yeniden kaydet.</p>' : ''}
    <form class="dbody form" novalidate><div data-vrisk></div>${renderForm(FORM, t)}
      <fieldset class="fs"><legend>Ürünler</legend>
        <div class="kalem-ekle"><input data-ara list="tk-ul" placeholder="Ürün kodu ya da açıklama yaz (örn. HBL 152)" aria-label="Ürün ekle" autocomplete="off"><datalist id="tk-ul">${S.urunler.filter(u => urunBilgi(u.aciklama).w || u.birim_fiyat_usd).map(u => `<option value="${esc(u.kod + ' · ' + u.aciklama)}">`).join('')}</datalist><button type="button" class="btn sm" data-bos>Serbest kalem</button></div>
        <datalist id="tk-grup"></datalist><div data-kalemler></div>
        <div class="tk-top" data-top aria-live="polite"></div>
      </fieldset>
      ${renderForm(NOT_FORM, t)}
      <div class="chips tk-mb" aria-label="Hazır metinler">${metinBloklari().map((m, i) => `<button type="button" class="chip" data-mb="${i}" title="${esc(m.metin)}">+ ${esc(m.ad)}</button>`).join('')}</div>
      <fieldset class="fs"><legend>Ekler</legend><p class="hint">Teklif belgesinin sonunda bağlantı olarak listelenir. Ürün kartındaki föy, sertifika ve fotometrik dosyalar kendiliğinden eklenir.</p><div data-ekler></div>
        <div class="frow"><input data-ekad placeholder="Ek adı (ör. Aydınlatma hesabı)" aria-label="Ek adı"><input data-ekurl placeholder="Bağlantı (https://…)" inputmode="url" aria-label="Ek bağlantısı"><button type="button" class="btn sm" data-ekekle>Ekle</button></div></fieldset>
      <div class="tk-onizle" data-onizleme hidden><iframe title="Teklif önizleme"></iframe></div>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-onizle>Önizleme</button><button type="button" class="btn ghost" data-close>Vazgeç</button>${t._new ? '<button type="button" class="btn" data-kaydet-pdf>Kaydet ve PDF</button>' : ''}<button type="submit" class="btn primary">Kaydet</button></div>
    </form>`, { wide: true });
  panel.querySelectorAll('[data-rev]').forEach(b => b.onclick = () => { if (b.dataset.rev !== t.id) teklifForm({ id: b.dataset.rev }, after); });
  import('../vaderisk.js').then(m => m.riskBagla(panel, 'teklif', t.firma_id)).catch(() => {});
  const form = panel.querySelector('form');
  const son = {};
  let onizle = () => {};
  bindForm(form, [...FORM, ...NOT_FORM], t, { onChange: o => { Object.assign(son, o); Object.assign(t, { iskonto: o.iskonto === '' ? null : +o.iskonto, kdv: o.kdv === '' ? null : +o.kdv, para_birimi: o.para_birimi }); toplam(); onizle(); } });
  onizle = onizlemeBagla(panel, t, () => son);
  t.ekler = [...(t.ekler || [])];
  const ekCiz = () => { const oto = ekListesi({ ...t, ekler: [] }); form.querySelector('[data-ekler]').innerHTML = `${t.ekler.length ? `<ul class="list">${t.ekler.map((e, i) => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.ad || e.url)}</a><button type="button" class="x" data-eksil="${i}" aria-label="Eki kaldır">×</button></li>`).join('')}</ul>` : ''}${oto.length ? `<p class="hint">Ürünlerden: ${oto.map(e => esc(e.ad)).join(', ')}</p>` : ''}`;
    form.querySelectorAll('[data-eksil]').forEach(b => b.onclick = () => { t.ekler.splice(+b.dataset.eksil, 1); ekCiz(); onizle(); }); };
  form.querySelector('[data-ekekle]').onclick = () => { const ad = form.querySelector('[data-ekad]').value.trim(), url = form.querySelector('[data-ekurl]').value.trim(); if (!/^https?:\/\//i.test(url)) return toast('Bağlantı https:// ile başlamalı.', 'err'); t.ekler.push({ ad: ad || url, url }); form.querySelector('[data-ekad]').value = form.querySelector('[data-ekurl]').value = ''; ekCiz(); onizle(); };
  form.querySelectorAll('[data-mb]').forEach(b => b.onclick = () => { const ta = form.querySelector('[name=notlar]'), m = metinBloklari()[+b.dataset.mb]; ta.value = [ta.value.trim(), m.metin].filter(Boolean).join('\n'); ta.dispatchEvent(new Event('change', { bubbles: true })); });
  const maliyetGor = !disKullanici();
  const kbox = form.querySelector('[data-kalemler]');
  const toplam = () => {
    const h = hesapla(t), pb = t.para_birimi || 'USD', ss = secenekler(t), kr = maliyetGor && pb === 'USD' ? karHesapla(t) : null;
    form.querySelector('[data-top]').innerHTML = (ss.length ? `<label class="fld tk-secim"><span>Toplama giren seçenek</span><select data-secim>${ss.map(x => `<option ${x === secim(t) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><small class="muted">${ss.map(x => `${esc(x)}: ${para(hesapla2(t, x).net, pb)}`).join(' · ')}</small></label>` : '') + (t.kalemler.length ? `<dl><dt>Ara toplam</dt><dd>${para(h.ara, pb)}</dd>${h.isk ? `<dt>İskonto (%${num(t.iskonto)})</dt><dd>−${para(h.isk, pb)}</dd>` : ''}<dt>KDV hariç toplam</dt><dd><b>${para(h.net, pb)}</b></dd><dt>KDV (%${num(t.kdv)})</dt><dd>${para(h.kdv, pb)}</dd><dt>Genel toplam</dt><dd><b>${para(h.genel, pb)}</b></dd>${kr ? `<dt class="muted">Kâr (içeride)</dt><dd class="${kr.marj < (+ayar('teklif_min_marj') || 0) ? 'neg' : 'muted'}">${para(kr.kar, pb)} · %${num(Math.round(kr.marj * 10) / 10)}</dd>` : ''}${pb !== 'TRY' && tl(h.genel, pb) ? `<dt class="muted">TL karşılığı</dt><dd class="muted">≈ ${para(tl(h.genel, pb), 'TRY')}</dd>` : ''}</dl>${pb !== 'TRY' && kur() ? `<p class="hint r">Kur: ${kur()[pb]?.toLocaleString('tr-TR')} ₺ · ${esc(kur().kaynak || '')}</p>` : ''}` : '<p class="hint">Yukarıdan ürün ekle.</p>');
    form.querySelector('[data-secim]')?.addEventListener('change', e => { t.secim = e.target.value; toplam(); onizle(); });
  };
  const ciz = () => {
    kbox.innerHTML = t.kalemler.length ? `<table class="tk-tbl"><thead><tr><th>Ürün</th><th class="r">Adet</th><th class="r">Birim fiyat</th><th class="r">İsk. %</th><th class="r">Tutar</th><th></th></tr></thead><tbody>${t.kalemler.map((k, i) => {
      const u = k.kod && S.urunler.find(x => x.kod === k.kod);
      const of = k.kod && t.firma_id ? oncekiFiyat(t.firma_id, k.kod, t.id) : null, ml = maliyetGor ? kalemMaliyet(k) : null;
      return `<tr><td data-l="Ürün"><input data-k="ad" data-i="${i}" value="${esc(k.ad)}" aria-label="Ürün açıklaması"><small class="muted">${esc(k.kod || 'serbest kalem')}${u ? ` · stok ${num(stokAdet(u))}${stokMetni(u) ? ` <span class="tk-stok">(${esc(stokMetni(u))})</span>` : ''}${+k.adet > stokAdet(u) ? ' <b class="neg">yetersiz</b>' : ''}` : ''}${of ? ` · <button type="button" class="linkbtn" data-ofy="${i}" title="Bu firmaya ${esc(of.teklif_no)} teklifinde verilen fiyatı uygula">son verilen ${para(of.fiyat, of.pb)}${of.iskonto ? ' %' + num(of.iskonto) + ' isk.' : ''}</button>` : ''}</small>
        <div class="tk-ek"><input data-k="grup" data-i="${i}" list="tk-grup" value="${esc(k.grup || '')}" placeholder="Mahal / kat" aria-label="Mahal ya da kat"><select data-k="secenek" data-i="${i}" aria-label="Alternatif seçenek"><option value="">Her seçenekte</option>${['A', 'B', 'C'].map(x => `<option ${k.secenek === x ? 'selected' : ''}>${x}</option>`).join('')}</select>${maliyetGor ? `<input data-k="maliyet" data-i="${i}" type="number" inputmode="decimal" step="any" value="${k.maliyet ?? ''}" placeholder="${ml != null && (k.maliyet == null || k.maliyet === '') ? 'maliyet ' + num(ml) : 'Maliyet'}" aria-label="Birim maliyet (içeride)">` : ''}<input data-k="rakip_fiyat" data-i="${i}" type="number" inputmode="decimal" step="any" value="${k.rakip_fiyat ?? ''}" placeholder="Rakip fiyatı" aria-label="Rakibin birim fiyatı">${+k.rakip_fiyat && +k.birim_fiyat ? `<small class="${kalemTutar({ ...k, adet: 1 }) > +k.rakip_fiyat ? 'neg' : 'pos'}">rakipten %${num(Math.round((kalemTutar({ ...k, adet: 1 }) / +k.rakip_fiyat - 1) * 1000) / 10)}</small>` : ''}</div></td>
      <td data-l="Adet" class="r"><input data-k="adet" data-i="${i}" type="number" inputmode="decimal" value="${k.adet ?? ''}" aria-label="Adet"></td>
      <td data-l="Birim fiyat" class="r"><input data-k="birim_fiyat" data-i="${i}" type="number" inputmode="decimal" step="any" value="${k.birim_fiyat ?? ''}" aria-label="Birim fiyat"></td>
      <td data-l="İskonto %" class="r"><input data-k="iskonto" data-i="${i}" type="number" inputmode="decimal" value="${k.iskonto ?? ''}" aria-label="Kalem iskontosu"></td>
      <td data-l="Tutar" class="r num" data-tut="${i}"></td><td><button type="button" class="x" data-sil="${i}" aria-label="Kalemi sil">×</button></td></tr>`; }).join('')}</tbody></table>` : '';
    const tut = () => t.kalemler.forEach((k, i) => { const c = kbox.querySelector(`[data-tut="${i}"]`); if (c) c.innerHTML = (k.secenek ? `<small class="muted">${esc(k.secenek)}</small> ` : '') + para(kalemTutar(k), t.para_birimi); });
    form.querySelector('#tk-grup').innerHTML = [...new Set(t.kalemler.map(k => k.grup).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('');
    kbox.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => { const k = t.kalemler[+inp.dataset.i]; k[inp.dataset.k] = inp.type === 'number' ? (inp.value === '' ? null : parseFloat(inp.value)) : (inp.value || null); tut(); toplam(); onizle(); if (inp.dataset.k === 'secenek') ciz(); });
    kbox.querySelectorAll('[data-ofy]').forEach(b => b.onclick = () => { const k = t.kalemler[+b.dataset.ofy], of = oncekiFiyat(t.firma_id, k.kod, t.id); Object.assign(k, { birim_fiyat: of.fiyat, iskonto: of.iskonto || null }); ciz(); });
    kbox.querySelectorAll('[data-sil]').forEach(b => b.onclick = () => { t.kalemler.splice(+b.dataset.sil, 1); ciz(); });
    tut(); toplam(); ekCiz(); onizle();
  };
  const ara = form.querySelector('[data-ara]');
  ara.onchange = () => {
    const kod = ara.value.split(' · ')[0].trim();
    const u = S.urunler.find(x => x.kod === kod) || S.urunler.find(x => match(ara.value, x.kod, x.aciklama));
    if (!u) return toast('Ürün bulunamadı; listeden seç ya da “Serbest kalem” ekle.', 'err');
    const bi = t.firma_id ? +(S.bayiler || []).find(b => b.firma_id === t.firma_id)?.iskonto || 0 : 0, sonG = t.kalemler[t.kalemler.length - 1];
    t.kalemler.push({ kod: u.kod, ad: u.aciklama, adet: 1, birim_fiyat: u.birim_fiyat_usd || 0, iskonto: bi || null, grup: sonG?.grup || null, secenek: sonG?.secenek || null });
    if (bi) toast(`Bayi iskontosu %${num(bi)} uygulandı.`);
    ara.value = ''; ciz(); kbox.querySelectorAll('[data-k="adet"]')[t.kalemler.length - 1]?.select();
  };
  form.querySelector('[data-bos]').onclick = () => { t.kalemler.push({ kod: null, ad: '', adet: 1, birim_fiyat: 0 }); ciz(); kbox.querySelectorAll('[data-k="ad"]')[t.kalemler.length - 1]?.focus(); };
  ciz();
  const kaydet = async () => {
    const o = await readForm(form, [...FORM, ...NOT_FORM], t);
    o.kalemler = t.kalemler.filter(k => k.ad || k.kod);
    o.secim = secenekler(o).length ? (secenekler(o).includes(t.secim) ? t.secim : secenekler(o)[0]) : null;
    o.ekler = t.ekler;
    o.toplam = Math.round(hesapla(o).net * 100) / 100;
    o.durum = o.durum || 'Taslak';
    if (o.durum === 'Red' && !o.kayip_neden) { toast('Red edilen teklifte kayıp nedenini seç.', 'err'); form.querySelector('[name=kayip_neden]')?.focus(); throw new Error('İPTAL'); }
    if (o.durum === 'Gönderildi' && !o.gonderim_tarihi) o.gonderim_tarihi = today();
    if (['Kabul', 'Red'].includes(o.durum) && o.durum !== t0?.durum) o.yanit_tarihi = today();
    if (t0?.olusturan) o.olusturan = t0.olusturan;
    // İskonto sınırı: aşılırsa yönetici onayına düşer; onaylanana kadar Gönderildi yapılamaz
    const sinir = iskontoSiniri(), enY = enYuksekIskonto(o);
    if (sinir != null && !sahipMi() && enY > sinir) {
      const onayli = t0?.onay === 'Onaylandı' && enYuksekIskonto(t0) >= enY - 1e-9;   // onaylanandan fazla iskonto yeniden onay ister
      if (!onayli) { o.onay = 'Bekliyor'; if (o.durum === 'Gönderildi') o.durum = 'Taslak'; toast(`İskonto %${num(Math.round(enY * 10) / 10)}; sınır %${num(sinir)}. Yönetici onayına gönderildi.`); }
    } else if (o.onay === 'Bekliyor') o.onay = null;
    // Müşteri / bayi tipindeki firmaya ilk teklifte vergi no ve vergi dairesi istenir
    if (o.firma_id && o.firma_id !== t0?.firma_id && !(await cariIste(o.firma_id, 'teklif'))) throw new Error('İPTAL');
    const s = await app.db.save('teklifler', o);
    // Proje bağlantısı: teklif gönderilince proje aşaması, tutarı ve teklif numarası güncellenir
    const p = o.proje_id && byId('projeler', o.proje_id);
    if (p && ACIK.includes(p.durum)) {
      const yeni = { ...p };
      if (o.durum === 'Gönderildi' && ['Proje', 'İhale', 'Beklemede'].includes(p.durum)) yeni.durum = 'Teklif Verildi';
      if (!p.teklif_no) yeni.teklif_no = o.teklif_no;
      if (!p.tutar_usd && o.para_birimi === 'USD') yeni.tutar_usd = o.toplam;
      if (JSON.stringify(yeni) !== JSON.stringify(p)) {
        await app.db.save('projeler', yeni);
        if (yeni.durum !== p.durum) { await app.db.save('proje_gecmis', { proje_id: p.id, tarih: new Date().toISOString(), eski_durum: p.durum, yeni_durum: yeni.durum, notlar: 'Teklif ' + o.teklif_no }); toast(`${p.ad}: ${p.durum} → ${yeni.durum}`); }
      }
    }
    return s;
  };
  panel.querySelector('[data-kaydet-pdf]')?.addEventListener('click', async () => { let s; try { s = await kaydet(); } catch (err) { if (err.message !== 'İPTAL') toast('Kaydedilemedi: ' + err.message, 'err'); return; } closeDrawer(); app.refresh(); teklifYazdir(s); });
  form.onsubmit = async e => { e.preventDefault(); try { await kaydet(); toast('Teklif kaydedildi.'); closeDrawer(); after ? after() : app.refresh(); } catch (err) { if (err.message === 'İPTAL') return; console.error(err); toast('Kaydedilemedi: ' + err.message, 'err'); } };
  panel.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'pdf') { ozellikSay('teklif-pdf'); teklifYazdir(t0); }
    if (a === 'wa') ozellikSay('teklif-wa');
    if (['baglanti', 'wa', 'eposta', 'pdf'].includes(a) && t0.onay === 'Bekliyor') return toast('İskonto onayı bekleniyor; onaylanınca gönderebilirsin.', 'err');
    if (a === 'karsilastir') { const rv = S.teklifler.filter(x => revKok(x.teklif_no) === revKok(t0.teklif_no) && revNo(x.teklif_no) < revNo(t0.teklif_no)).sort((x, y) => revNo(y.teklif_no) - revNo(x.teklif_no)); if (rv[0]) revizyonPenceresi(rv[0], t0); return; }
    if (a === 'sevk') { closeDrawer(true); (await import('./sevk.js')).tekliftenSevk(t0, () => app.refresh()); return; }
    if (a === 'siparis') return siparisOldu(t0);
    if (a === 'baglanti') { closeDrawer(); (await import('../onaybaglanti.js')).baglantiPenceresi(byId('teklifler', t0.id) || t0, () => app.refresh()); }
    if (a === 'wa') { const k = byId('kisiler', t0.kisi_id); window.open(waLink(k?.telefon || byId('firmalar', t0.firma_id)?.telefon || '', teklifMetni(t0)), '_blank', 'noopener'); }
    if (a === 'eposta') { ozellikSay('teklif-eposta'); location.href = teklifEpostaLinki(t0); if ((t0.durum || 'Taslak') === 'Taslak') toast('Gönderdiysen teklifin durumunu "Gönderildi" yap.'); }
    if (a === 'revize') { const { id, created_at, updated_at, onay, onaylayan, gonderim_tarihi, yanit_tarihi, kayip_neden, kayip_rakip, kayip_fiyat, ...r } = t0; const kok = revKok(t0.teklif_no); const n = Math.max(1, ...S.teklifler.filter(x => revKok(x.teklif_no) === kok).map(x => revNo(x.teklif_no))) + 1; teklifForm({ ...r, teklif_no: `${kok}-R${n}`, tarih: today(), gecerlilik: gunEkle(today(), 15), durum: 'Taslak', kalemler: (t0.kalemler || []).map(k => ({ ...k })), notlar: [t0.notlar, `${t0.teklif_no} teklifinin revizyonu.`].filter(Boolean).join('\n') }, after); }
    if (a === 'kopya') { const { id, created_at, updated_at, onay, onaylayan, gonderim_tarihi, yanit_tarihi, kayip_neden, kayip_rakip, kayip_fiyat, olusturan, ...r } = t0; teklifForm({ ...r, teklif_no: yeniTeklifNo(), tarih: today(), gecerlilik: gunEkle(today(), 15), durum: 'Taslak', kalemler: (t0.kalemler || []).map(k => ({ ...k })) }); }
    if (a === 'sil' && confirmBox(`${t0.teklif_no} silinsin mi?`)) { await app.db.del('teklifler', t0.id); toast('Teklif silindi.'); closeDrawer(); app.refresh(); }
  });
}

// "Sipariş oldu": teklif Kabul, proje Sipariş aşamasına; sipariş kaydı teklif bilgileriyle açılır
async function siparisOldu(t0) {
  const t = { ...t0, durum: 'Kabul', yanit_tarihi: t0.yanit_tarihi || today() };
  if (t0.durum !== 'Kabul') await app.db.save('teklifler', t);
  const p = t.proje_id && byId('projeler', t.proje_id);
  if (p && p.durum !== 'Sipariş') { await app.db.save('projeler', { ...p, durum: 'Sipariş', siparis_tutari_usd: p.siparis_tutari_usd || (t.para_birimi === 'USD' ? t.toplam : p.siparis_tutari_usd) }); await app.db.save('proje_gecmis', { proje_id: p.id, tarih: new Date().toISOString(), eski_durum: p.durum, yeni_durum: 'Sipariş', notlar: 'Teklif ' + t.teklif_no + ' siparişe döndü' }); }
  closeDrawer(true); toast(`${t.teklif_no} Kabul${p ? `, ${p.ad} Sipariş aşamasında` : ''}. Sipariş kaydını tamamla.`);
  const { siparisForm } = await import('./panel.js');
  siparisForm({ firma_id: t.firma_id, proje_id: t.proje_id, net_deger: t.toplam, para_birimi: t.para_birimi || 'USD', referans: `${t.teklif_no}${p ? ' · ' + p.ad : ''}` });
}

// Alıcı: firmanın teklif e-postası, yoksa ilgili kişinin, o da yoksa firmanın genel e-postası
export function teklifAlicisi(t) {
  const f = byId('firmalar', t.firma_id) || byId('firmalar', byId('projeler', t.proje_id)?.alici_id) || byId('firmalar', byId('projeler', t.proje_id)?.emut_id);
  return f?.teklif_eposta || byId('kisiler', t.kisi_id)?.eposta || f?.eposta || '';
}
export const teklifEpostaLinki = t => `mailto:${encodeURIComponent(teklifAlicisi(t)).replace(/%40/g, '@').replace(/%2C/g, ',')}?subject=${encodeURIComponent(`Teklif ${t.teklif_no || ''}`.trim())}&body=${encodeURIComponent(teklifMetni(t))}`;
export function teklifMetni(t) {
  const h = hesapla(t), pb = t.para_birimi || 'USD', k = byId('kisiler', t.kisi_id), p = byId('projeler', t.proje_id);
  return [`Merhaba${k ? ' ' + k.ad_soyad.split(' ')[0] + ' Bey/Hanım' : ''},`, `${p ? p.ad + ' için ' : ''}aydınlatma teklifimiz (${t.teklif_no}):`, '',
    ...toplamaGiren(t).map(x => `• ${x.ad} — ${num(x.adet)} adet × ${para(x.birim_fiyat * (1 - (+x.iskonto || 0) / 100), pb)}`), '',
    ...(secenekler(t).length > 1 ? [`(Seçenek ${secim(t)}; diğer seçenekler: ${secenekler(t).filter(x => x !== secim(t)).map(x => `${x} ${para(hesapla2(t, x).net, pb)}`).join(', ')})`, ''] : []),
    `Toplam: ${para(h.net, pb)} + KDV${t.iskonto ? ` (%${num(t.iskonto)} iskonto dahil)` : ''}`, t.gecerlilik ? `Geçerlilik: ${tarih(t.gecerlilik)}` : '', t.notlar || '', '', benimAdim()].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').trim();
}

// Yazdırılabilir teklif (tarayıcıda “PDF olarak kaydet”): şablona göre logo, antet, renk, sütunlar, dil, mahal ara toplamları, seçenekler
export const teklifHtml = t => teklifBelgesi(t);
export function teklifYazdir(t) {
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fr);
  fr.srcdoc = teklifHtml(t);
  fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast('Yazdırma açılamadı.', 'err'); } setTimeout(() => fr.remove(), 60000); };
  toast('Yazdırma ekranında “PDF olarak kaydet”i seç.');
}

// Teklif bilgileri (Ayarlar)
export function teklifAyarlari(root) {
  const b = ayar('teklif_firma') || {};
  root.innerHTML = `<div class="fld"><label for="tf-ad">Firma adı</label><input id="tf-ad" value="${esc(b.ad || firmaAdi())}"></div>
    <div class="fld"><label for="tf-il">İletişim bilgileri</label><textarea id="tf-il" rows="3" placeholder="Adres, telefon, e-posta">${esc(b.iletisim || '')}</textarea></div>
    <div class="fld"><label for="tf-k">Standart koşullar</label><textarea id="tf-k" rows="4" placeholder="Fiyatlarımıza KDV dahil değildir. Teslim: …  Ödeme: …  Garanti: …">${esc(b.kosullar || '')}</textarea></div>
    <div class="btnrow"><button type="button" class="btn primary" data-k>Kaydet</button></div>`;
  root.querySelector('[data-k]').onclick = async () => { await ayarYaz('teklif_firma', { ad: root.querySelector('#tf-ad').value.trim(), iletisim: root.querySelector('#tf-il').value.trim(), kosullar: root.querySelector('#tf-k').value.trim() }); toast('Teklif bilgileri kaydedildi.'); };
}

export function tekliflerView(el) {
  const f = F('teklifler', { q: '', durum: 'Tümü' });
  el.innerHTML = `<header class="vh"><div><h1>Teklifler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn ghost" data-sablon title="Şablonlar (logo, antet, sütunlar, dil), numara düzeni, hazır metinler, iskonto sınırı">Şablonlar</button><button class="btn ghost" data-rapor title="Kazanma oranı, ortalama iskonto, yanıt süresi">Rapor</button><button class="btn ghost" data-teklifb data-gerek="yaz:teklifler">Teklif bilgileri</button><button class="btn ghost" data-fl data-gerek="yaz:teklifler" title="Üreticinin yeni fiyat listesini yükle, açık tekliflerle karşılaştır">Fiyat listesi</button><button class="btn ghost" data-xls>Excel</button><button class="btn primary" data-new>Yeni teklif</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Teklif no, firma, proje ara" value="${esc(f.q)}" aria-label="Tekliflerde ara">
      <div class="seg" role="group" aria-label="Durum">${['Tümü', ...TEKLIF_DURUM.map(d => d.k)].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>
    <div data-rows></div>`;
  let sinir = 200;   // uzun listede ilk 200 kart; "Daha fazla göster" ile artar
  const draw = () => {
    const l = S.teklifler.filter(t => (f.durum === 'Tümü' || t.durum === f.durum) && match(f.q, t.teklif_no, firmaAd(t.firma_id), byId('projeler', t.proje_id)?.ad, t.notlar)).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '') || (b.teklif_no || '').localeCompare(a.teklif_no || ''));
    const acik = l.filter(t => ['Taslak', 'Gönderildi'].includes(t.durum) && t.para_birimi === 'USD');
    const son = new Map(); for (const t of S.teklifler) { const k = revKok(t.teklif_no); if (!son.has(k) || revNo(t.teklif_no) > revNo(son.get(k).teklif_no)) son.set(k, t); }   // her teklifin son revizyonu
    const sonlar = [...son.values()], kabul = sonlar.filter(t => t.durum === 'Kabul'), red = sonlar.filter(t => t.durum === 'Red');
    const oran = kabul.length + red.length ? Math.round(kabul.length / (kabul.length + red.length) * 100) : null;
    const usdTop = a => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(a.filter(t => (t.para_birimi || 'USD') === 'USD').reduce((s, t) => s + (+t.toplam || 0), 0));
    el.querySelector('[data-sum]').innerHTML = `${l.length} teklif · bekleyen ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(acik.reduce((a, t) => a + (+t.toplam || 0), 0))} $ · kazanma oranı <b>${oran == null ? '—' : '%' + oran}</b> <span class="muted">(${kabul.length} kabul ${usdTop(kabul)} $, ${red.length} red ${usdTop(red)} $; revizyonlarda son hali sayılır)</span>`;
    const t0 = today(), kokSay = new Map(); for (const x of S.teklifler) { const k = revKok(x.teklif_no); kokSay.set(k, (kokSay.get(k) || 0) + 1); }
    const goster = l.slice(0, sinir);
    el.querySelector('[data-rows]').innerHTML = l.length ? `<ul class="cards">${goster.map(t => `<li><button type="button" class="card-btn" data-id="${t.id}"><span class="cb-top"><b>${esc(t.teklif_no || 'Teklif')}</b>${kokSay.get(revKok(t.teklif_no)) > 1 ? `<em class="rol-r">${revNo(t.teklif_no) > 1 ? 'Revizyon ' + revNo(t.teklif_no) : 'İlk teklif'}</em>` : ''}${tpill(t.durum)}${t.onay === 'Bekliyor' ? '<em class="tag-s warn">onay bekliyor</em>' : ''}${secenekler(t).length > 1 ? `<em class="tag-s">${secenekler(t).length} seçenek</em>` : ''}</span>
      <span>${esc(firmaAd(t.firma_id) || '—')}</span>${t.durum === 'Red' && t.kayip_neden ? `<small class="muted">Kayıp: ${esc(t.kayip_neden)}${t.kayip_rakip ? ' · ' + esc(t.kayip_rakip) : ''}</small>` : ''}<small class="muted">${esc(byId('projeler', t.proje_id)?.ad || '')}</small>
      <span class="cb-bot"><b class="num">${para(t.toplam, t.para_birimi)}</b><small class="${t.durum === 'Gönderildi' && t.gecerlilik && t.gecerlilik < t0 ? 'neg' : 'muted'}">${tarih(t.tarih)}${t.gecerlilik ? ' · geçerlilik ' + tarih(t.gecerlilik) : ''}</small></span></button></li>`).join('')}</ul>${l.length > sinir ? `<div class="btnrow"><button type="button" class="btn ghost" data-dahafazla>Daha fazla göster (${l.length - sinir})</button></div>` : ''}`
      : '<div class="empty"><p>Teklif yok. “Yeni teklif” ile ürün ekleyip PDF ya da WhatsApp olarak gönderebilirsin.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => teklifForm({ id: b.dataset.id }));
    el.querySelector('[data-dahafazla]')?.addEventListener('click', () => { sinir += 200; draw(); });
    if (app.db?.mode === 'supabase') import('../onaybaglanti.js').then(async m => { const d = await m.durumHaritasi(); el.querySelectorAll('.card-btn[data-id]').forEach(b => { const r = m.durumRozeti(d.get(b.dataset.id)); if (r) b.querySelector('.cb-top')?.insertAdjacentHTML('beforeend', r); }); });
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => teklifForm({});
  el.querySelector('[data-teklifb]')?.addEventListener('click', () => { const pn = openDrawer(`<header class="dh"><div><p class="muted">Teklifler</p><h2 id="drawer-title">Teklif bilgileri</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><div class="dbody form"><p class="hint">PDF teklifin üst bilgisi (firma adı, iletişim) ve alt koşulları. Bütün tekliflerde kullanılır.</p><div data-teklifb-ic></div></div>`); teklifAyarlari(pn.querySelector('[data-teklifb-ic]')); });
  el.querySelector('[data-sablon]').onclick = () => sablonPenceresi(() => draw());
  el.querySelector('[data-rapor]').onclick = () => teklifRaporuPenceresi();
  el.querySelector('[data-fl]')?.addEventListener('click', async () => (await import('../fiyatlistesi.js')).fiyatListesiYukle());
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`teklifler-${today()}.xlsx`, {
    'Teklifler': S.teklifler.map(t => ({ 'Teklif no': t.teklif_no, 'Tarih': t.tarih, 'Geçerlilik': t.gecerlilik, 'Durum': t.durum, 'Firma': firmaAd(t.firma_id), 'Yetkili': byId('kisiler', t.kisi_id)?.ad_soyad, 'Proje': byId('projeler', t.proje_id)?.ad, 'İskonto %': t.iskonto, 'KDV %': t.kdv, 'Toplam (KDV hariç)': t.toplam, 'Para birimi': t.para_birimi, 'Seçenek': t.secim, 'Teslim süresi': t.teslim_suresi, 'Teslim şekli': t.teslim_sekli, 'Kur': t.kur, 'Gönderim': t.gonderim_tarihi, 'Yanıt': t.yanit_tarihi, 'Kayıp nedeni': t.kayip_neden, 'Kazanan rakip': t.kayip_rakip, 'Rakip fiyatı': t.kayip_fiyat, 'Not': t.notlar })),
    'Kalemler': S.teklifler.flatMap(t => (t.kalemler || []).map(k => ({ 'Teklif no': t.teklif_no, 'Mahal': k.grup, 'Seçenek': k.secenek, 'Ürün kodu': k.kod, 'Ürün': k.ad, 'Adet': k.adet, 'Birim fiyat': k.birim_fiyat, 'İskonto %': k.iskonto, 'Tutar': Math.round((+k.adet || 0) * (+k.birim_fiyat || 0) * (1 - (+k.iskonto || 0) / 100) * 100) / 100, 'Para birimi': t.para_birimi, 'Rakip fiyatı': k.rakip_fiyat }))) });
  draw();
}
