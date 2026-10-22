import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, num, pill, tarih, today, DURUMLAR, ACIK, ILLER, ILCELER, OSBLER, RAKIPLER, KAYIP_NEDENLERI, URUN_AILELERI, SEKTORLER,
  byId, firmaAd, match, toast, openDrawer, closeDrawer, exportXlsx, directionsUrl, confirmBox, durumRenk, SANTIYE, olasilik, gunEkle } from '../ui.js';
import { teklifForm } from './teklif.js';
import { numuneForm } from './kayitlar.js';
import { belgeBolumu } from '../belgeler.js';
import { kayitGecmisi } from '../gecmis.js';
import { siparisForm } from './panel.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { googleBul, aramaMetni } from '../google.js';
import { backToList } from '../main.js';
import { ziyaretForm, gorevForm } from './ziyaret.js';

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
  return S.projeler.filter(p =>
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
const fa = id => id ? `<a href="#/firma/${id}" class="flink">${esc(firmaAd(id))}</a>` : '<span class="muted">—</span>';

export function projelerView(el) {
  const f = F('projeler', { q: '', yil: 'Tümü', durumlar: [], il: 'Tümü', kanal: 'Tümü', kritik: false, hedef: false, ziyaret: false, rakip: 'Tümü', sort: 'Duruma göre', gor: 'liste' });
  if (f._v !== 2) { f.yil = 'Tümü'; f.sort = 'Duruma göre'; f._v = 2; saveFilters(); }
  if (!SORTS[f.sort]) f.sort = 'Duruma göre';
  const bayiler = [...new Set(S.projeler.map(p => firmaAd(p.bayi_id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const rakipler = [...new Set(S.projeler.map(p => p.rakip_marka).filter(Boolean))].sort();
  el.innerHTML = `
  <header class="vh"><div><h1>Projeler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="liste" class="${f.gor !== 'huni' ? 'on' : ''}">Liste</button><button type="button" data-gor="huni" class="${f.gor === 'huni' ? 'on' : ''}">Satış hunisi</button></div><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Yeni proje</button></div></header>
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

  const draw = () => {
    const base = S.projeler.filter(p => f.yil === 'Tümü' || String(p.takip_yili) === String(f.yil));
    DURUMLAR.forEach(d => { const c = el.querySelector(`[data-cnt="${d.k}"]`); if (c) c.textContent = base.filter(p => p.durum === d.k).length || ''; });
    const list = filtered(f).sort(SORTS[f.sort]);
    const acik = list.filter(p => ACIK.includes(p.durum));
    const sipT = list.reduce((s, p) => s + (siparisToplam(p) || 0), 0);
    el.querySelector('[data-sum]').innerHTML = `${list.length} proje · açık potansiyel <b>${usd(acik.reduce((s, p) => s + (+p.tutar_usd || 0), 0))}</b> · ağırlıklı <b>${usd(acik.reduce((s, p) => s + (+p.tutar_usd || 0) * olasilik(p) / 100, 0))}</b> · sipariş <b>${usd(sipT)}</b>`;
    if (f.gor === 'huni') return huni(el.querySelector('[data-rows]'), list, draw);
    el.querySelector('[data-rows]').innerHTML = list.length ? `<table class="ptable">
      <thead><tr><th class="c-dur">Durum</th><th class="c-sip r">Sipariş</th><th class="c-ad">Proje</th><th>Yer</th><th>Bölge / OSB</th><th>Yatırımcı</th><th>Projeci</th><th>Danışman</th><th>Gemüt</th><th>Emüt</th><th>Malzeme alıcısı</th><th>Kanal</th><th class="r">Tutar</th><th>Yıl</th><th>Kayıp / rakip</th></tr></thead>
      <tbody>${list.map(p => { const st = siparisToplam(p); return `<tr data-pid="${p.id}" style="--c:${durumRenk(p.durum)}" tabindex="0">
        <td class="c-dur" data-l="Durum"><select class="dsel" data-dsel="${p.id}" aria-label="${esc(p.ad)} durumu" style="--c:${durumRenk(p.durum)}">${DURUMLAR.map(d => `<option ${d.k === p.durum ? 'selected' : ''}>${d.k}</option>`).join('')}</select></td>
        <td class="c-sip r num" data-l="Sipariş">${st ? usd(st) : '<span class="muted">—</span>'}</td>
        <td class="c-ad" data-l="Proje"><b>${esc(p.ad)}</b>${p.kritik ? ' <em class="flag">Kritik</em>' : ''}${p.hedef_listesi ? ' <em class="flag soft">Hedef</em>' : ''}${p.lat == null || p.konum_yaklasik ? ' <em class="flag gray">Konum bekliyor</em>' : ''}${p.notlar ? `<small>${esc(p.notlar.slice(0, 80))}</small>` : ''}</td>
        <td data-l="Yer">${esc([p.belde, p.ilce, p.il].filter(Boolean).join(', ') || p.lokasyon || '—')}</td>
        <td data-l="Bölge / OSB">${esc(p.osb || '—')}</td>
        <td data-l="Yatırımcı">${fa(p.yatirimci_id)}</td><td data-l="Projeci">${fa(p.projeci_id)}</td><td data-l="Danışman">${fa(p.danisman_id)}</td>
        <td data-l="Gemüt">${fa(p.gemut_id)}</td><td data-l="Emüt">${fa(p.emut_id)}</td><td data-l="Malzeme alıcısı">${fa(p.alici_id)}</td>
        <td data-l="Kanal">${p.kanal === 'Direkt' ? 'Direkt' : fa(p.bayi_id)}</td>
        <td class="r num" data-l="Tutar">${usd(p.tutar_usd)}</td><td data-l="Yıl">${p.takip_yili || '—'}</td>
        <td data-l="Kayıp / rakip">${p.durum === 'Kayıp' ? esc([p.rakip_marka, p.kayip_nedeni].filter(Boolean).join(' · ') || '—') : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table>`
      : `<div class="empty"><p>Bu filtrelerle eşleşen proje yok.</p><button class="btn" data-reset2>Filtreleri temizle</button></div>`;
    const r2 = el.querySelector('[data-reset2]'); if (r2) r2.onclick = reset;
    const open = id => { location.hash = '#/proje/' + id; };
    el.querySelectorAll('tr[data-pid]').forEach(tr => {
      tr.onclick = e => { if (e.target.closest('select, a')) return; open(tr.dataset.pid); };
      tr.onkeydown = e => { if (e.key === 'Enter' && !e.target.closest('select, a')) open(tr.dataset.pid); };
    });
    el.querySelectorAll('[data-dsel]').forEach(sel => sel.onchange = async () => {
      const p = byId('projeler', sel.dataset.dsel), eski = p.durum;
      if (await durumDegistir(p, sel.value)) { sel.style.setProperty('--c', durumRenk(sel.value)); sel.closest('tr').style.setProperty('--c', durumRenk(sel.value)); }
      else sel.value = eski;
    });
  };
  const reset = () => { Object.assign(f, { q: '', durumlar: [], il: 'Tümü', kanal: 'Tümü', kritik: false, hedef: false, ziyaret: false, rakip: 'Tümü' }); saveFilters(); projelerView(el); };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-yil]').forEach(b => b.onclick = () => { f.yil = b.dataset.yil; saveFilters(); el.querySelectorAll('[data-yil]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const d = b.dataset.d; f.durumlar = f.durumlar.includes(d) ? f.durumlar.filter(x => x !== d) : [...f.durumlar, d]; b.classList.toggle('on'); saveFilters(); draw(); });
  el.querySelectorAll('[data-k]').forEach(s => s.onchange = () => { f[s.dataset.k] = s.value; saveFilters(); draw(); });
  el.querySelectorAll('[data-b]').forEach(s => s.onchange = () => { f[s.dataset.b] = s.checked; saveFilters(); draw(); });
  el.querySelector('[data-reset]').onclick = reset;
  el.querySelectorAll('[data-gor]').forEach(b => b.onclick = () => { f.gor = b.dataset.gor; saveFilters(); el.querySelectorAll('[data-gor]').forEach(x => x.classList.toggle('on', x === b)); el.classList.toggle('is-huni', f.gor === 'huni'); draw(); });
  el.classList.toggle('is-huni', f.gor === 'huni');
  el.querySelector('[data-ft]').onclick = e => { const o = el.querySelector('.filters').classList.toggle('open'); e.target.setAttribute('aria-expanded', String(o)); };
  el.querySelector('[data-new]').onclick = () => yeniProje({});
  el.querySelector('[data-exp]').onclick = () => exportProjeler(filtered(f).sort(SORTS[f.sort]));
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

export function projeDetay(id, init) {
  const p0 = id ? byId('projeler', id) : { id: uuid(), ...init, _new: true };
  if (!p0) { toast('Proje bulunamadı.', 'err'); return backToList(); }
  const p = { ...p0, takip_yili: p0.takip_yili ? String(p0.takip_yili) : '2026' };
  const ziy = S.ziyaretler.filter(z => z.proje_id === p.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const sip = S.siparisler.filter(s => s.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const gec = S.proje_gecmis.filter(g => g.proje_id === p.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const gor = S.gorevler.filter(g => g.proje_id === p.id);
  const tek = S.teklifler.filter(x => x.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const panel = openDrawer(`
    <header class="dh" style="--c:${durumRenk(p.durum)}"><div><p class="muted">${p._new ? 'Yeni proje' : 'Proje'}</p><h2 id="drawer-title">${esc(p.ad || 'Yeni proje')}</h2>
      ${p._new ? '' : `<div class="dh-meta">${pill(p.durum)}<span>${usd(p.tutar_usd)}</span><span>${esc([p.ilce, p.il].filter(Boolean).join(', '))}</span></div>`}</div>
      <button class="x" data-close aria-label="Kapat">×</button></header>
    ${p._new ? '' : `<div class="dh-actions">
      <button class="btn sm" data-a="ziyaret">Ziyaret ekle</button><button class="btn sm" data-a="gorev">Görev ekle</button><button class="btn sm" data-a="teklif">Teklif hazırla</button><button class="btn sm ghost" data-a="numune">Numune ver</button><button class="btn sm ghost" data-a="google">Google'dan konum al</button>${p.google_url ? `<a class="btn sm ghost" href="${esc(p.google_url)}" target="_blank" rel="noopener">Google Haritalar</a>` : ''}
      ${p.lat != null ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(p.lat, p.lng)}">Yol tarifi</a>` : ''}
      <button class="btn sm ghost danger" data-a="sil">Sil</button></div>
      <div class="quick-durum" role="group" aria-label="Durumu hızlı değiştir">${DURUMLAR.map(d => `<button type="button" data-qd="${d.k}" class="${p.durum === d.k ? 'on' : ''}" style="--c:${d.c}">${d.k}</button>`).join('')}</div>`}
    <form class="dbody form" novalidate>
      ${renderForm(PROJE_FORM, p)}
      <div class="calc" data-calc hidden></div>
      ${p._new ? '' : '<section class="rel" data-belgeler></section>' + related(ziy, sip, gec, gor, tek) + '<section class="rel" data-gecmis></section>'}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div>
    </form>`, { wide: true, onClose: () => backToList() });
  const form = panel.querySelector('form');
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
      const saved = await app.db.save('projeler', o);
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
  return `<section class="rel">
    ${tek.length ? `<h3>Teklifler <span class="muted">${tek.length}</span></h3><ul class="list">${tek.map(x => `<li><button type="button" class="linkbtn" data-tk="${x.id}">${esc(x.teklif_no || 'Teklif')}</button><span class="muted">${tarih(x.tarih)} · ${esc(x.durum)}</span><b class="num">${num(x.toplam)} ${esc(x.para_birimi || '')}</b></li>`).join('')}</ul>` : ''}
    <h3>Ziyaretler <span class="muted">${ziy.length}</span></h3>
    ${ziy.length ? `<ul class="list">${ziy.map(z => `<li><span class="muted">${tarih(z.tarih)}</span><span>${esc(firmaAd(z.firma_id))} — ${esc((z.notlar || '').slice(0, 120))}</span></li>`).join('')}</ul>` : '<p class="hint">Bu projeye bağlı ziyaret yok.</p>'}
    ${gor.length ? `<h3>Görevler <span class="muted">${gor.length}</span></h3><ul class="list">${gor.map(g => `<li><span>${g.durum === 'Tamam' ? '✓' : '○'} ${esc(g.baslik)}</span><span class="muted">${tarih(g.son_tarih)}</span></li>`).join('')}</ul>` : ''}
    <h3>Siparişler <span class="muted">${sip.length}</span></h3>
    ${sip.length ? `<ul class="list">${sip.map(s => `<li class="${s.rapor_disi ? 'disi' : ''}"><span class="muted">${tarih(s.tarih)}</span><button type="button" class="linkrow" data-sp="${s.id}"><b>${esc(s.siparis_no || 'Sipariş')} · ${esc(s.referans || s.musteri_adi || '')}</b>${s.siparis_notu ? `<span class="muted">Not: ${esc(s.siparis_notu.slice(0, 80))}</span>` : ''}</button><b class="num">${num(s.net_deger)} ${esc(s.para_birimi)}</b></li>`).join('')}</ul>
      <p class="hint">Toplam: ${usd(sip.filter(s => s.para_birimi === 'USD').reduce((a, s) => a + +s.net_deger, 0))}</p>` : '<p class="hint">Sipariş listesinde bu projeye bağlı kayıt yok.</p>'}
    ${gec.length ? `<h3>Durum geçmişi</h3><ul class="list">${gec.map(g => `<li><span class="muted">${tarih(g.tarih)}</span><span>${g.eski_durum ? esc(g.eski_durum) + ' → ' : ''}${esc(g.yeni_durum)}${g.notlar ? ' · ' + esc(g.notlar) : ''}</span></li>`).join('')}</ul>` : ''}
  </section>`;
}
