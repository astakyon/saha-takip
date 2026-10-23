import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, num, pill, tarih, today, ILLER, ILCELER, OSBLER, FIRMA_TIPLERI, SEKTORLER, byId, firmaAd, match, toast, openDrawer, closeDrawer,
  exportXlsx, directionsUrl, confirmBox, download, ACIK } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { googleBul, aramaMetni } from '../google.js';
import { backToList } from '../main.js';
import { projeRolleri } from './projeler.js';
import { ziyaretForm } from './ziyaret.js';
import { waGonder } from '../sablon.js';
import { teklifForm } from './teklif.js';
import { numuneForm, servisForm } from './kayitlar.js';
import { belgeBolumu } from '../belgeler.js';
import { kayitGecmisi } from '../gecmis.js';
import { tahsilatOzeti } from './tahsilat.js';

const FIRMA_FORM = [
  { title: 'Firma', fields: [
    { k: 'ad', l: 'Firma adı', auto: true, full: true, req: true },
    { k: 'tipler', l: 'Firma tipi', t: 'tags', opts: FIRMA_TIPLERI },
    { k: 'telefon', l: 'Telefon', t: 'tel' }, { k: 'eposta', l: 'E-posta', t: 'email' },
  ]},
  { title: 'Konum', ozet: 'harita, il, ilçe, adres', kapali: o => !o._new, fields: [
    { k: 'loc', l: 'Harita konumu', t: 'loc' },
    { k: 'il', l: 'İl', t: 'sel', opts: [...ILLER, 'Diğer'] },
    { k: 'ilce', l: 'İlçe', t: 'combo', opts: o => ILCELER[o.il] || [] },
    { k: 'osb', l: 'OSB / sanayi bölgesi', t: 'combo', opts: o => OSBLER[o.il] || Object.values(OSBLER).flat() },
    { k: 'belde', l: 'Belde / mahalle' },
    { k: 'adres', l: 'Adres', full: true },
  ]},
  { title: 'Notlar ve fotoğraflar', kapali: false, fields: [
    { k: 'notlar', l: 'Notlar', t: 'area', rows: 3 },
    { k: 'fotolar', l: 'Fotoğraflar (ofis, şantiye, logo)', t: 'photos' },
  ]},
  { title: 'Diğer bilgiler', ozet: 'segment, sektör, web, vergi no', kapali: true, fields: [
    { k: 'segment', l: 'Segment', t: 'sel', opts: ['A', 'B', 'C'] },
    { k: 'sektor', l: 'Sektör', t: 'combo', opts: SEKTORLER },
    { k: 'web', l: 'Web sitesi' }, { k: 'vergi_no', l: 'Vergi no' },
    { k: 'key_account', l: 'Key account', t: 'chk', cl: 'Key account (stratejik müşteri)' },
  ]},
];

const KISI_FORM = [
  { title: 'Kişi', fields: [
    { k: 'ad_soyad', l: 'Ad soyad', auto: true, req: true, full: true },
    { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar' },
    { k: 'unvan', l: 'Unvan / görev', t: 'combo', opts: ['Genel Müdür', 'Satınalma Müdürü', 'Satınalma', 'Proje Müdürü', 'Elektrik Mühendisi', 'Şantiye Şefi', 'Teknik Müdür', 'Firma Sahibi', 'Satış'] },
    { k: 'telefon', l: 'Cep telefonu', t: 'tel' }, { k: 'eposta', l: 'E-posta', t: 'email' },
  ]},
  { title: 'Diğer bilgiler', ozet: 'rol, doğum günü, notlar', kapali: o => !o.notlar, fields: [
    { k: 'rol', l: 'Karar sürecindeki rolü', t: 'sel', opts: ['Karar verici', 'Etkileyici', 'Teknik', 'Satınalma', 'Saha'] },
    { k: 'dogum_gunu', l: 'Doğum günü', t: 'date' },
    { k: 'notlar', l: 'Notlar', t: 'area' },
  ]},
];

const firmaProjeleri = id => S.projeler.filter(p => projeRolleri(p, id).length);

export function firmalarView(el) {
  const f = F('firmalar', { q: '', tip: 'Tümü', il: 'Tümü', key: false, sort: 'Ada göre' });
  el.innerHTML = `
  <header class="vh"><div><h1>Firmalar</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn ghost" data-duyuru>Toplu duyuru</button><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Yeni firma</button></div></header>
  <div class="filters">
    <input type="search" data-q placeholder="Firma adı, not ara" value="${esc(f.q)}" aria-label="Firmalarda ara">
    <div class="chips" role="group" aria-label="Firma tipi">${['Tümü', ...FIRMA_TIPLERI].map(t => `<button type="button" class="chip ${f.tip === t ? 'on' : ''}" data-t="${t}" style="--c:#1D2B36">${t}</button>`).join('')}</div>
    <div class="frow"><label>İl <select data-k="il">${['Tümü', ...ILLER, 'Diğer'].map(x => `<option ${f.il === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>Sırala <select data-k="sort">${['Ada göre', 'Proje sayısı', 'Son ziyaret'].map(x => `<option ${f.sort === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" data-b="key" ${f.key ? 'checked' : ''}> <span>Key account</span></label></div>
  </div>
  <div class="rows firms" data-rows></div>`;
  const stats = new Map(S.firmalar.map(x => [x.id, { p: 0, k: 0, s: 0, z: null }]));
  for (const p of S.projeler) for (const id of new Set([p.yatirimci_id, p.projeci_id, p.danisman_id, p.gemut_id, p.emut_id, p.alici_id, p.bayi_id])) { const s = stats.get(id); if (s) { s.p++; if (p.durum === 'Sipariş') s.k++; if (p.durum === 'Kayıp') s.s++; } }
  for (const z of S.ziyaretler) { const s = stats.get(z.firma_id); if (s && (!s.z || z.tarih > s.z)) s.z = z.tarih; }
  const list = () => S.firmalar.filter(x => (f.tip === 'Tümü' || (x.tipler || []).includes(f.tip)) && (f.il === 'Tümü' || x.il === f.il) && (!f.key || x.key_account) && match(f.q, x.ad, x.notlar, x.telefon))
    .sort(f.sort === 'Proje sayısı' ? (a, b) => stats.get(b.id).p - stats.get(a.id).p : f.sort === 'Son ziyaret' ? (a, b) => (stats.get(b.id).z || '').localeCompare(stats.get(a.id).z || '') : (a, b) => a.ad.localeCompare(b.ad, 'tr'));
  const draw = () => {
    const l = list();
    el.querySelector('[data-sum]').textContent = `${l.length} firma`;
    el.querySelector('[data-rows]').innerHTML = l.length ? `<div class="row head" aria-hidden="true"><span>Firma</span><span>Tip</span><span>İl</span><span>Projeler</span><span class="r">Son ziyaret</span></div>` +
      l.map(x => { const s = stats.get(x.id); return `<a class="row" href="#/firma/${x.id}"><span class="nm"><b>${esc(x.ad)}</b>${x.key_account ? ' <em class="flag soft">Key account</em>' : ''}<small>${esc(x.telefon || '')}</small></span>
      <span class="muted">${esc((x.tipler || []).join(', ') || '—')}</span><span class="muted">${esc(x.il || '—')}</span>
      <span class="muted">${s.p ? `${s.p} proje · ${s.k} sipariş · ${s.s} kayıp` : '—'}</span><span class="r muted">${s.z ? tarih(s.z) : '—'}</span></a>`; }).join('')
      : '<div class="empty"><p>Eşleşen firma yok.</p></div>';
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { f.tip = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); saveFilters(); draw(); });
  el.querySelectorAll('[data-k]').forEach(s => s.onchange = () => { f[s.dataset.k] = s.value; saveFilters(); draw(); });
  el.querySelectorAll('[data-b]').forEach(s => s.onchange = () => { f[s.dataset.b] = s.checked; saveFilters(); draw(); });
  el.querySelector('[data-new]').onclick = () => yeniFirma({});
  el.querySelector('[data-duyuru]').onclick = async () => (await import('../duyuru.js')).topluDuyuru();
  el.querySelector('[data-exp]').onclick = () => {
    exportXlsx(`firmalar-${today()}.xlsx`, {
      'Firmalar': list().map(x => ({ 'Firma': x.ad, 'Tip': (x.tipler || []).join(', '), 'İl': x.il, 'İlçe': x.ilce, 'Telefon': x.telefon, 'E-posta': x.eposta, 'Segment': x.segment, 'Key account': x.key_account ? 'Evet' : '', 'Proje': stats.get(x.id).p, 'Sipariş': stats.get(x.id).k, 'Kayıp': stats.get(x.id).s, 'Son ziyaret': stats.get(x.id).z, 'Notlar': x.notlar })),
      'Kişiler': S.kisiler.map(k => ({ 'Ad soyad': k.ad_soyad, 'Firma': firmaAd(k.firma_id), 'Unvan': k.unvan, 'Rol': k.rol, 'Telefon': k.telefon, 'E-posta': k.eposta })),
    });
  };
  draw();
}

export function yeniFirma(init) { firmaDetay(null, { tipler: [], fotolar: [], konum_yaklasik: false, ...init }); }

export function firmaDetay(id, init) {
  const x0 = id ? byId('firmalar', id) : { id: uuid(), ...init, _new: true };
  if (!x0) { toast('Firma bulunamadı.', 'err'); return backToList(); }
  const x = { ...x0 };
  const projeler = firmaProjeleri(x.id);
  const kisiler = S.kisiler.filter(k => k.firma_id === x.id);
  const ziy = S.ziyaretler.filter(z => z.firma_id === x.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const sip = S.siparisler.filter(s => s.firma_id === x.id);
  const sipT = sip.filter(s => s.para_birimi === 'USD').reduce((a, s) => a + +s.net_deger, 0);
  const won = projeler.filter(p => p.durum === 'Sipariş').length, lost = projeler.filter(p => p.durum === 'Kayıp').length;
  const stok = (x.tipler || []).includes('Bayi') ? S.urunler.filter(u => u.depo && x.ad.toLowerCase().startsWith(u.depo.toLowerCase().split(' ')[0])) : [];
  const panel = openDrawer(`
    <header class="dh"><div><p class="muted">${x._new ? 'Yeni firma' : esc((x.tipler || []).join(', ') || 'Firma')}</p><h2 id="drawer-title">${esc(x.ad || 'Yeni firma')}</h2>
      ${x._new ? '' : (() => { const acik = projeler.filter(p => ACIK.includes(p.durum)), acikT = acik.reduce((a, p) => a + (+p.tutar_usd || 0), 0); const sonZ = ziy.find(z => (z.durum || 'Yapıldı') === 'Yapıldı'); const gun = sonZ ? Math.round((new Date(today()) - new Date(sonZ.tarih)) / 864e5) : null; const tah = S.tahsilatlar.filter(t => t.firma_id === x.id && (+t.tutar || 0) > (+t.odenen || 0)); return `<div class="dh-meta"><span>${acik.length} açık proje${acikT ? ' · ' + usd(acikT) : ''}</span><span>${won} sipariş · ${lost} kayıp</span>${sip.length ? `<span>${usd(sipT)} SAP sipariş</span>` : ''}<span class="${gun == null || gun > 60 ? 'neg' : ''}">${gun == null ? 'hiç ziyaret yok' : gun === 0 ? 'bugün ziyaret edildi' : `son ziyaret ${gun} gün önce`}</span>${tah.length ? `<span class="neg">${tah.length} açık fatura</span>` : ''}${x.segment ? `<span>Segment ${esc(x.segment)}</span>` : ''}</div>`; })()}</div>
      <button class="x" data-close aria-label="Kapat">×</button></header>
    ${x._new ? '' : `<div class="dh-actions"><button class="btn sm" data-a="kisi">Kişi ekle</button><button class="btn sm" data-a="ziyaret">Ziyaret ekle</button><button class="btn sm ghost" data-a="google">Google'dan bilgi al</button>${x.google_url ? `<a class="btn sm ghost" href="${esc(x.google_url)}" target="_blank" rel="noopener">Google Haritalar</a>` : ''}
      <button class="btn sm ghost" data-a="wa">WhatsApp</button><button class="btn sm ghost" data-a="teklif">Teklif</button><button class="btn sm ghost" data-a="numune">Numune</button><button class="btn sm ghost" data-a="servis">Servis kaydı</button>
      ${x.telefon ? `<a class="btn sm ghost" href="tel:${esc(x.telefon)}">Ara</a>` : ''}
      ${x.lat != null ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(x.lat, x.lng)}">Yol tarifi</a>` : ''}
      <button class="btn sm ghost danger" data-a="sil">Sil</button></div>`}
    <form class="dbody form" novalidate>
      ${x._new ? '' : `<section class="rel top">
        <h3>Kişiler <span class="muted">${kisiler.length}</span></h3>
        ${kisiler.length ? `<ul class="cards">${kisiler.map(k => `<li><a href="#/kisi/${k.id}" class="pcard"><span class="avatar" data-kv="${esc(k.kartvizit_on || '')}">${esc(k.ad_soyad.slice(0, 1))}</span><span><b>${esc(k.ad_soyad)}</b><small>${esc([k.unvan, k.telefon].filter(Boolean).join(' · '))}</small></span></a></li>`).join('')}</ul>` : '<p class="hint">Henüz kişi eklenmedi.</p>'}
        <h3>Projeler <span class="muted">${projeler.length}</span></h3>
        ${projeler.length ? `<ul class="list">${projeler.map(p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${projeRolleri(p, x.id).join(', ')} · ${usd(p.tutar_usd)}</span></a>${pill(p.durum)}</li>`).join('')}</ul>` : '<p class="hint">Bu firmanın yer aldığı proje yok.</p>'}
        ${stok.length ? `<h3>Depo stoğu</h3><p class="hint">${stok.filter(u => u.stok > 0).length} kalem stokta. <a href="#/urunler">Stok ve fiyat ekranında aç</a></p>` : ''}
        <div data-tahsilat></div><div data-iliski></div><div data-yorumlar></div><div data-belgeler></div><div data-gecmis></div>
        <h3>Ziyaretler <span class="muted">${ziy.length}</span></h3>
        ${ziy.length ? `<ul class="list">${ziy.slice(0, 12).map(z => `<li><span class="muted">${tarih(z.tarih)}</span><span>${esc(byId('kisiler', z.kisi_id)?.ad_soyad || '')} ${esc((z.notlar || '').slice(0, 140))}</span></li>`).join('')}</ul>` : '<p class="hint">Ziyaret kaydı yok.</p>'}
      </section>`}
      ${renderForm(FIRMA_FORM, x)}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div>
    </form>`, { wide: true, onClose: () => backToList() });
  const form = panel.querySelector('form');
  bindForm(form, FIRMA_FORM, x);
  if (!x._new) { belgeBolumu(panel.querySelector('[data-belgeler]'), { firma_id: x.id }); tahsilatOzeti(panel.querySelector('[data-tahsilat]'), x); kayitGecmisi(panel.querySelector('[data-gecmis]'), 'firmalar', x.id); import('../yorum.js').then(m => m.yorumBolumu(panel.querySelector('[data-yorumlar]'), 'firmalar', x)); import('../iliski.js').then(m => m.iliskiBolumu(panel.querySelector('[data-iliski]'), x)); }
  panel.querySelectorAll('.avatar[data-kv]').forEach(async a => { if (a.dataset.kv) { const u = await app.db.url(a.dataset.kv); if (u) { a.style.backgroundImage = `url("${u}")`; a.textContent = ''; } } });
  panel.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'kisi') kisiDetay(null, { firma_id: x.id });
    if (a === 'wa') waGonder({ firma: x, kisi: kisiler.find(k => k.telefon) || null });
    if (a === 'teklif') teklifForm({ firma_id: x.id, kisi_id: kisiler[0]?.id || null });
    if (a === 'numune') numuneForm({ firma_id: x.id, kisi_id: kisiler[0]?.id || null });
    if (a === 'servis') servisForm({ firma_id: x.id });
    if (a === 'ziyaret') ziyaretForm({ firma_id: x.id }, () => firmaDetay(x.id));
    if (a === 'google') googleBul({ q: aramaMetni(x), hedef: { table: 'firmalar', rec: x }, sonra: () => firmaDetay(x.id) });
    if (a === 'sil' && confirmBox(`“${x.ad}” silinsin mi? Projelerdeki bağlantıları boşaltılır.`)) {
      await app.db.del('firmalar', x.id);
      for (const p of S.projeler) { const ch = {}; for (const k of ['yatirimci_id', 'projeci_id', 'danisman_id', 'gemut_id', 'emut_id', 'alici_id', 'bayi_id']) if (p[k] === x.id) ch[k] = null; if (Object.keys(ch).length) await app.db.save('projeler', { ...p, ...ch }); }
      toast('Firma silindi.'); closeDrawer(); app.refresh();
    }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, FIRMA_FORM, x);
      if (!o.ad) return toast('Firma adını yaz.', 'err');
      const dup = x._new && S.firmalar.find(f => f.ad.toLocaleLowerCase('tr') === o.ad.toLocaleLowerCase('tr'));
      if (dup && !confirmBox(`“${dup.ad}” adında bir firma zaten var. Yine de yeni kayıt açılsın mı?`)) return;
      await app.db.save('firmalar', o); toast(`${o.ad} kaydedildi.`); closeDrawer(); app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

// ---------- Kartvizit okuma ----------
async function kartvizitPaneli(panel, form, yol, hazir) {
  const kutu = panel.querySelector('[data-ocr]');
  kutu.innerHTML = '<div class="ocr-box"><p class="hint" aria-live="polite" data-oc-d>Okuma motoru hazırlanıyor… (ilk seferde ~15 MB indirilir)</p><div class="progress"><span style="width:5%"></span></div></div>';
  const d = kutu.querySelector('[data-oc-d]'), bar = kutu.querySelector('.progress span');
  let r = hazir;
  try {
    if (!r) {
      const { kartvizitOku } = await import('../ocr.js');
      const u = await app.db.url(yol); const blob = await (await fetch(u)).blob();
      const AD = { 'loading tesseract core': 'Okuma motoru indiriliyor', 'initializing tesseract': 'Hazırlanıyor', 'loading language traineddata': 'Türkçe dil verisi indiriliyor', 'initializing api': 'Hazırlanıyor', 'recognizing text': 'Kartvizit okunuyor' };
      r = await kartvizitOku(blob, (st, pr) => { d.textContent = (AD[st] || st) + '…'; bar.style.width = Math.round((pr || 0) * 100) + '%'; });
    }
  } catch (e) { console.error(e); kutu.innerHTML = `<p class="warn">Kartvizit okunamadı: ${esc(e.message)}</p>`; return; }
  const alan = [['ad_soyad', 'Ad soyad', r.ad_soyad], ['unvan', 'Unvan', r.unvan], ['telefon', 'Telefon', r.telefon], ['eposta', 'E-posta', r.eposta], ['firma_id', 'Firma', r.firma],
    ['_ek', 'Notlara ekle', [r.sabit && r.sabit !== r.telefon ? 'Sabit tel: ' + r.sabit : '', r.web ? 'Web: ' + r.web : '', r.adres ? 'Adres: ' + r.adres : ''].filter(Boolean).join(' · ')]].filter(x => x[2]);
  kutu.innerHTML = `<div class="ocr-box"><h3>Kartvizitten okunanlar</h3>${alan.length ? `<p class="hint">Kontrol et, gerekirse düzelt; işaretli olanlar forma yazılır.</p>
    ${alan.map(([k, l, v]) => `<label class="ocr-row"><input type="checkbox" data-ok="${k}" checked><span>${l}</span><input data-ov="${k}" value="${esc(v)}" aria-label="${l}"></label>`).join('')}
    <div class="btnrow"><button type="button" class="btn sm primary" data-oc-yaz>Forma yaz</button></div>` : '<p class="hint">Metin çıkarılamadı. Kartviziti düz bir zeminde, gölgesiz ve yakından tekrar çek.</p>'}
    <details><summary>Okunan metnin tamamı</summary><pre class="ocr-raw">${esc(r.metin || '')}</pre></details></div>`;
  kutu.querySelector('[data-oc-yaz]')?.addEventListener('click', () => {
    kutu.querySelectorAll('[data-ok]:checked').forEach(c => {
      const k = c.dataset.ok, v = kutu.querySelector(`[data-ov="${k}"]`).value.trim(); if (!v) return;
      if (k === '_ek') { const n = form.querySelector('[name=notlar]'); n.value = [n.value, v].filter(Boolean).join('\n'); return; }
      const inp = form.querySelector(`[name=${k}]`); if (inp) inp.value = v;
    });
    form.dispatchEvent(new Event('change')); toast('Bilgiler forma yazıldı. Kontrol edip kaydet.'); kutu.innerHTML = '';
  });
}
// Kişiler ekranından: kartvizit fotoğrafı çek → oku → yeni kişi formu
export async function kartvizittenKisi() {
  const { pickFiles } = await import('../ui.js');
  const [file] = await pickFiles({ capture: true, multiple: false }); if (!file) return;
  try {
    toast('Kartvizit yükleniyor…');
    const yol = await app.db.upload(file);
    kisiDetay(null, { kartvizit_on: yol });
  } catch (e) { toast(e.message, 'err'); }
}

// ---------- Kişiler ----------
export function kisilerView(el) {
  const f = F('kisiler', { q: '' });
  el.innerHTML = `<header class="vh"><div><h1>Kişiler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn ghost" data-xls>Excel</button><button class="btn" data-kv>Kartvizitten ekle</button><button class="btn primary" data-new>Yeni kişi</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Ad, firma, telefon ara" value="${esc(f.q)}" aria-label="Kişilerde ara"></div>
    <ul class="cards grid-cards" data-rows></ul>`;
  const draw = () => {
    const l = S.kisiler.filter(k => match(f.q, k.ad_soyad, firmaAd(k.firma_id), k.telefon, k.eposta, k.unvan)).sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
    el.querySelector('[data-sum]').textContent = `${l.length} kişi`;
    el.querySelector('[data-rows]').innerHTML = l.length ? l.map(k => `<li><a href="#/kisi/${k.id}" class="pcard"><span class="avatar" data-kv="${esc(k.kartvizit_on || '')}">${esc(k.ad_soyad.slice(0, 1))}</span>
      <span><b>${esc(k.ad_soyad)}</b><small>${esc(firmaAd(k.firma_id) || 'Firma yok')}</small><small>${esc([k.unvan, k.telefon].filter(Boolean).join(' · '))}</small></span></a></li>`).join('')
      : '<li class="empty"><p>Kişi bulunamadı. Kartvizit eklemek için “Yeni kişi”ye dokun.</p></li>';
    el.querySelectorAll('.avatar[data-kv]').forEach(async a => { if (a.dataset.kv) { const u = await app.db.url(a.dataset.kv); if (u) { a.style.backgroundImage = `url("${u}")`; a.textContent = ''; } } });
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelector('[data-new]').onclick = () => kisiDetay(null, {});
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`kisiler-${today()}.xlsx`, { 'Kişiler': S.kisiler.slice().sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr')).map(k => ({ 'Ad soyad': k.ad_soyad, 'Firma': firmaAd(k.firma_id), 'Unvan': k.unvan, 'Rol': k.rol, 'Telefon': k.telefon, 'E-posta': k.eposta, 'Doğum günü': k.dogum_gunu, 'Notlar': k.notlar })) });
  el.querySelector('[data-kv]').onclick = kartvizittenKisi;
  draw();
}

export function kisiDetay(id, init) {
  const k0 = id ? byId('kisiler', id) : { id: uuid(), ...init, _new: true };
  if (!k0) { toast('Kişi bulunamadı.', 'err'); return backToList(); }
  const k = { ...k0 };
  const projeler = S.projeler.filter(p => p.ilgili_kisi_id === k.id);
  const ziy = S.ziyaretler.filter(z => z.kisi_id === k.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const panel = openDrawer(`
    <header class="dh"><div><p class="muted">${k._new ? 'Yeni kişi' : esc(firmaAd(k.firma_id) || 'Kişi')}</p><h2 id="drawer-title">${esc(k.ad_soyad || 'Yeni kişi')}</h2></div>
      <button class="x" data-close aria-label="Kapat">×</button></header>
    ${k._new ? '' : `<div class="dh-actions">${k.telefon ? `<a class="btn sm" href="tel:${esc(k.telefon)}">Ara</a><button type="button" class="btn sm ghost" data-a="wa">WhatsApp</button>` : ''}
      ${k.eposta ? `<a class="btn sm ghost" href="mailto:${esc(k.eposta)}">E-posta</a>` : ''}<button class="btn sm ghost" data-a="vcf">Rehbere kaydet</button>
      <button class="btn sm ghost danger" data-a="sil">Sil</button></div>`}
    <form class="dbody form" novalidate>
      ${k._new && !k.kartvizit_on ? `<div class="kv-cta-row"><button type="button" class="kv-cta" data-kv-hizli="cam"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span><b>Kartviziti çek</b><small>Ad, telefon, e-posta ve firma kendiliğinden dolar</small></span></button><button type="button" class="linkbtn" data-kv-hizli="gal">ya da galeriden seç</button></div>` : ''}
      <div data-ocr></div>
      ${renderForm(KISI_FORM, k)}
      <details class="fs fs-d kv-d" ${!k._new && (k.kartvizit_on || k.kartvizit_arka) ? 'open' : ''}><summary><b>Kartvizit fotoğrafı</b><span class="muted">${k.kartvizit_on ? 'ön yüz' + (k.kartvizit_arka ? ' ve arka yüz' : '') + ' var' : 'yok'}</span></summary>
        <div class="kv-pair">${['kartvizit_on', 'kartvizit_arka'].map(s => `<div class="kv" data-kvs="${s}" data-val="${esc(k[s] || '')}"><div class="kv-img" role="img" aria-label="${s === 'kartvizit_on' ? 'Ön yüz' : 'Arka yüz'}"><span>${s === 'kartvizit_on' ? 'Ön yüz' : 'Arka yüz'}</span></div>
          <div class="ph-btns"><button type="button" class="btn sm" data-kv-cam>Çek</button><button type="button" class="btn sm ghost" data-kv-gal>Galeri</button><button type="button" class="btn sm ghost" data-kv-del hidden>Kaldır</button></div></div>`).join('')}</div>
        <div class="btnrow"><button type="button" class="btn sm" data-ocr-btn ${k.kartvizit_on ? '' : 'hidden'}>Kartviziti oku ve formu doldur</button></div>
      </details>
      ${projeler.length || ziy.length ? `<section class="rel"><h3>Projeler</h3><ul class="list">${projeler.map(p => `<li><a href="#/proje/${p.id}">${esc(p.ad)}</a>${pill(p.durum)}</li>`).join('') || '<li class="muted">—</li>'}</ul>
        <h3>Ziyaretler</h3><ul class="list">${ziy.map(z => `<li><span class="muted">${tarih(z.tarih)}</span><span>${esc((z.notlar || '').slice(0, 140))}</span></li>`).join('') || '<li class="muted">—</li>'}</ul></section>` : ''}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div>
    </form>`, { onClose: () => backToList() });
  const form = panel.querySelector('form');
  bindForm(form, KISI_FORM, k);
  panel.querySelectorAll('[data-kvs]').forEach(box => {
    const img = box.querySelector('.kv-img'), del = box.querySelector('[data-kv-del]');
    let show = async () => { const p = box.dataset.val; del.hidden = !p; if (!p) { img.style.backgroundImage = ''; img.classList.remove('has'); return; } const u = await app.db.url(p); if (u) { img.style.backgroundImage = `url("${u}")`; img.classList.add('has'); img.onclick = () => window.open(u, '_blank'); } };
    const add = async cap => {
      const { pickFiles } = await import('../ui.js');
      const [file] = await pickFiles({ capture: cap, multiple: false }); if (!file) return;
      try { toast('Kartvizit yükleniyor…'); box.dataset.val = await app.db.upload(file); await show(); toast('Kartvizit eklendi. Kaydetmeyi unutma.');
        if (box.dataset.kvs === 'kartvizit_on') { panel.querySelector('.kv-cta-row')?.remove(); kartvizitPaneli(panel, form, box.dataset.val); panel.querySelector('[data-ocr]').scrollIntoView({ block: 'nearest' }); } } catch (e) { toast(e.message, 'err'); }
    };
    box.querySelector('[data-kv-cam]').onclick = () => add(true);
    box.querySelector('[data-kv-gal]').onclick = () => add(false);
    del.onclick = () => { box.dataset.val = ''; show(); };
    const eskiShow = show; show = async () => { await eskiShow(); if (box.dataset.kvs === 'kartvizit_on') panel.querySelector('[data-ocr-btn]').hidden = !box.dataset.val; };
    show();
  });
  panel.querySelector('[data-ocr-btn]').onclick = () => kartvizitPaneli(panel, form, panel.querySelector('[data-kvs="kartvizit_on"]').dataset.val, k._ocr);
  if (k._new && k.kartvizit_on) kartvizitPaneli(panel, form, k.kartvizit_on);
  panel.querySelectorAll('[data-kv-hizli]').forEach(b => b.onclick = () => { panel.querySelector(`[data-kvs="kartvizit_on"] ${b.dataset.kvHizli === 'cam' ? '[data-kv-cam]' : '[data-kv-gal]'}`).click(); });
  panel.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    if (b.dataset.a === 'wa') waGonder({ kisi: k });
    if (b.dataset.a === 'vcf') {
      const fa = firmaAd(k.firma_id);
      const v = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${k.ad_soyad}`, `N:${k.ad_soyad.split(' ').slice(-1)};${k.ad_soyad.split(' ').slice(0, -1).join(' ')};;;`, fa && `ORG:${fa}`, k.unvan && `TITLE:${k.unvan}`, k.telefon && `TEL;TYPE=CELL:${k.telefon}`, k.eposta && `EMAIL:${k.eposta}`, 'END:VCARD'].filter(Boolean).join('\r\n');
      download(`${k.ad_soyad}.vcf`, v, 'text/vcard');
    }
    if (b.dataset.a === 'sil' && confirmBox(`${k.ad_soyad} silinsin mi?`)) { await app.db.del('kisiler', k.id); toast('Kişi silindi.'); closeDrawer(); app.refresh(); }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, KISI_FORM, k);
      if (!o.ad_soyad) return toast('Ad soyad yaz.', 'err');
      panel.querySelectorAll('[data-kvs]').forEach(b => o[b.dataset.kvs] = b.dataset.val || null);
      await app.db.save('kisiler', o); toast(`${o.ad_soyad} kaydedildi.`); closeDrawer(); app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}
