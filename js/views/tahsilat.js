// Tahsilat takibi: açık faturalar, vade ve gecikme, ödeme kaydı, cari bazında bakiye, Excel'den yükleme
import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, tarih, today, gunEkle, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, exportXlsx, pickFiles, fold } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { waGonder } from '../sablon.js';
import { yuklemeKaydet } from '../belgeler.js';

const PB = { USD: '$', EUR: '€', TRY: '₺', TL: '₺' };
export const para = (v, pb = 'USD') => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' ' + (PB[pb] || pb || '');
export const kalan = t => Math.max(0, Math.round(((+t.tutar || 0) - (+t.odenen || 0)) * 100) / 100);
export const durumu = t => kalan(t) <= 0 ? 'Ödendi' : (+t.odenen > 0 ? 'Kısmi' : 'Açık');
export const gecikme = t => kalan(t) > 0 && t.vade && t.vade < today() ? Math.round((new Date(today()) - new Date(t.vade)) / 864e5) : 0;
const cariAd = t => firmaAd(t.firma_id) || t.cari || '—';
const RENK = { 'Açık': '#2563EB', 'Kısmi': '#EA580C', 'Ödendi': '#15803D' };
const tpill = t => { const d = durumu(t), g = gecikme(t); return `<span class="pill" style="--c:${g ? '#B91C1C' : RENK[d]}">${g ? g + ' gün gecikti' : d}</span>`; };

// Para birimine göre toplamlar: { USD: 1200, TRY: 5000 }
const topla = (l, f) => l.reduce((o, t) => { const pb = t.para_birimi || 'USD'; o[pb] = (o[pb] || 0) + f(t); return o; }, {});
const toplamYaz = o => Object.entries(o).filter(([, v]) => v).map(([pb, v]) => para(v, pb)).join(' + ') || '0';
export const acikTahsilatlar = () => S.tahsilatlar.filter(t => kalan(t) > 0);
export const gecikenler = () => acikTahsilatlar().filter(t => gecikme(t) > 0).sort((a, b) => gecikme(b) - gecikme(a));

const FORM = [{ title: 'Fatura / alacak', fields: [
  { k: 'firma_id', l: 'Cari (firma)', t: 'ref', ref: 'firmalar', full: true },
  { k: 'belge_no', l: 'Fatura / belge no' },
  { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['USD', 'EUR', 'TRY'] },
  { k: 'tarih', l: 'Fatura tarihi', t: 'date' },
  { k: 'vade', l: 'Vade tarihi', t: 'date' },
  { k: 'tutar', l: 'Tutar', t: 'num' },
  { k: 'odenen', l: 'Ödenen', t: 'num' },
  { k: 'odeme_tarihi', l: 'Son ödeme tarihi', t: 'date' },
  { k: 'notlar', l: 'Not', t: 'area', rows: 2 },
]}];

export function tahsilatForm(init = {}) {
  const t0 = init.id ? byId('tahsilatlar', init.id) : { para_birimi: 'USD', tarih: today(), vade: gunEkle(today(), 60), odenen: 0, ...init, _new: true };
  const t = { ...t0 };
  const kisi = S.kisiler.find(k => k.firma_id === t.firma_id && k.telefon);
  const panel = openDrawer(`<header class="dh"><div><p class="muted">Tahsilat</p><h2 id="drawer-title">${t._new ? 'Yeni alacak' : esc(cariAd(t))}</h2>
      ${t._new ? '' : `<div class="dh-meta">${tpill(t)}<span>Kalan <b>${para(kalan(t), t.para_birimi)}</b></span></div>`}</div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${t._new ? '' : `<div class="dh-actions">${kalan(t) > 0 ? '<button class="btn sm primary" data-a="odeme">Ödeme al</button><button class="btn sm" data-a="wa">Hatırlatma mesajı</button>' : ''}<button class="btn sm ghost danger" data-a="sil">Sil</button></div>`}
    <form class="dbody form" novalidate><div data-odeme hidden class="odeme-kutu"><div class="fld"><label for="od-t">Alınan tutar</label><input id="od-t" type="number" inputmode="decimal" step="any" value="${kalan(t)}"></div><div class="fld"><label for="od-d">Ödeme tarihi</label><input id="od-d" type="date" value="${today()}"></div><button type="button" class="btn primary" data-od-kaydet>Ödemeyi kaydet</button></div>
      ${renderForm(FORM, t)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, FORM, t);
  panel.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'odeme') { const k = panel.querySelector('[data-odeme]'); k.hidden = false; k.querySelector('input').select(); }
    if (a === 'wa') waGonder({ kisi, firma: byId('firmalar', t.firma_id), sablonAdi: 'Tahsilat hatırlatma', alanlar: { tutar: para(kalan(t), t.para_birimi), vade: tarih(t.vade), belge: t.belge_no || '' } });
    if (a === 'sil' && confirmBox('Kayıt silinsin mi?')) { await app.db.del('tahsilatlar', t.id); toast('Silindi.'); closeDrawer(); app.refresh(); }
  });
  panel.querySelector('[data-od-kaydet]').onclick = async () => {
    const v = parseFloat(panel.querySelector('#od-t').value); if (!(v > 0)) return toast('Tutarı yaz.', 'err');
    const o = { ...t0, odenen: Math.round(((+t0.odenen || 0) + v) * 100) / 100, odeme_tarihi: panel.querySelector('#od-d').value || today() };
    o.durum = durumu(o); await app.db.save('tahsilatlar', o);
    toast(o.durum === 'Ödendi' ? 'Fatura kapandı.' : `Ödeme kaydedildi; kalan ${para(kalan(o), o.para_birimi)}.`); closeDrawer(); app.refresh();
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const o = await readForm(form, FORM, t);
    if (!o.firma_id && !o.cari) return toast('Cariyi yaz.', 'err');
    if (!(o.tutar > 0)) return toast('Tutarı yaz.', 'err');
    o.cari = firmaAd(o.firma_id) || o.cari; o.durum = durumu(o);
    await app.db.save('tahsilatlar', o); toast('Kaydedildi.'); closeDrawer(); app.refresh();
  };
}

// Firma kartındaki özet
export function tahsilatOzeti(kutu, f) {
  const l = S.tahsilatlar.filter(t => t.firma_id === f.id);
  if (!l.length) { kutu.innerHTML = ''; return; }
  const acik = l.filter(t => kalan(t) > 0), gec = acik.filter(t => gecikme(t));
  kutu.innerHTML = `<h3>Tahsilat <span class="muted">${acik.length} açık fatura</span></h3>
    <p>${acik.length ? `Bakiye <b>${toplamYaz(topla(acik, kalan))}</b>${gec.length ? ` · <span class="neg">${gec.length} fatura vadesi geçti (en eski ${Math.max(...gec.map(gecikme))} gün)</span>` : ''}` : 'Açık bakiye yok.'}</p>
    ${acik.length ? `<ul class="list">${acik.slice(0, 6).map(t => `<li><button type="button" class="linkrow" data-th="${t.id}"><b>${esc(t.belge_no || 'Fatura')} · ${para(kalan(t), t.para_birimi)}</b><span class="muted">vade ${tarih(t.vade)}</span></button>${tpill(t)}</li>`).join('')}</ul>` : ''}`;
  kutu.querySelectorAll('[data-th]').forEach(b => b.onclick = () => tahsilatForm({ id: b.dataset.th }));
}

export function tahsilatView(el) {
  const f = F('tahsilat', { q: '', durum: 'Açık', gor: 'liste' });
  el.innerHTML = `<header class="vh"><div><h1>Tahsilat</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn ghost" data-up>Excel'den yükle</button><button class="btn primary" data-new>Alacak ekle</button></div></header>
    <section class="ledger" data-ledger></section>
    <div class="filters"><input type="search" data-q placeholder="Cari, fatura no ara" value="${esc(f.q)}" aria-label="Tahsilatlarda ara">
      <div class="frow"><div class="seg" role="group" aria-label="Durum">${['Açık', 'Vadesi geçen', 'Ödendi', 'Tümü'].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="liste" class="${f.gor === 'liste' ? 'on' : ''}">Faturalar</button><button type="button" data-gor="cari" class="${f.gor === 'cari' ? 'on' : ''}">Cari bakiyeleri</button></div></div></div>
    <div data-rows></div>`;
  const list = () => S.tahsilatlar.filter(t => (f.durum === 'Tümü' || (f.durum === 'Açık' && kalan(t) > 0) || (f.durum === 'Vadesi geçen' && gecikme(t) > 0) || (f.durum === 'Ödendi' && kalan(t) <= 0)) && match(f.q, cariAd(t), t.belge_no, t.notlar))
    .sort((a, b) => (gecikme(b) - gecikme(a)) || (a.vade || '9').localeCompare(b.vade || '9'));
  const draw = () => {
    const acik = acikTahsilatlar(), gec = gecikenler(), yakin = acik.filter(t => t.vade && t.vade >= today() && t.vade <= gunEkle(today(), 30));
    const odenmis = S.tahsilatlar.filter(t => kalan(t) <= 0 && t.odeme_tarihi && t.vade);
    const ortGec = odenmis.length ? Math.round(odenmis.reduce((s, t) => s + Math.max(0, (new Date(t.odeme_tarihi) - new Date(t.vade)) / 864e5), 0) / odenmis.length) : null;
    el.querySelector('[data-sum]').textContent = `${acik.length} açık fatura · ${new Set(acik.map(cariAd)).size} cari`;
    el.querySelector('[data-ledger]').innerHTML = `<div><span>Açık alacak</span><b>${toplamYaz(topla(acik, kalan))}</b><small>${acik.length} fatura</small></div>
      <div><span>Vadesi geçen</span><b class="${gec.length ? 'neg-l' : ''}">${toplamYaz(topla(gec, kalan))}</b><small>${gec.length} fatura${gec.length ? ` · en eski ${gecikme(gec[0])} gün` : ''}</small></div>
      <div><span>30 gün içinde vadesi gelen</span><b>${toplamYaz(topla(yakin, kalan))}</b><small>${yakin.length} fatura</small></div>
      <div><span>Ortalama ödeme gecikmesi</span><b>${ortGec != null ? ortGec + ' gün' : '—'}</b><small>kapanan faturalara göre</small></div>`;
    const l = list(), box = el.querySelector('[data-rows]');
    if (!S.tahsilatlar.length) { box.innerHTML = '<div class="empty"><p>Henüz alacak kaydı yok. Faturaları tek tek ekleyebilir ya da SAP / muhasebe cari ekstresini Excel olarak yükleyebilirsin (sütunlar: Cari, Fatura no, Tarih, Vade, Tutar, Para birimi, Ödenen).</p></div>'; return; }
    if (f.gor === 'cari') {
      const g = new Map(); for (const t of l) { const k = cariAd(t); const r = g.get(k) || { k, id: t.firma_id, n: 0, bak: {}, gec: 0, maxG: 0 }; r.n++; const pb = t.para_birimi || 'USD'; r.bak[pb] = (r.bak[pb] || 0) + kalan(t); if (gecikme(t)) { r.gec++; r.maxG = Math.max(r.maxG, gecikme(t)); } g.set(k, r); }
      box.innerHTML = `<table class="ptable"><thead><tr><th>Cari</th><th class="r">Fatura</th><th class="r">Bakiye</th><th class="r">Vadesi geçen</th></tr></thead><tbody>${[...g.values()].sort((a, b) => b.maxG - a.maxG || (b.bak.USD || 0) - (a.bak.USD || 0)).map(r => `<tr data-cari="${esc(r.k)}" tabindex="0">
        <td data-l="Cari">${r.id ? `<a href="#/firma/${r.id}" class="flink"><b>${esc(r.k)}</b></a>` : `<b>${esc(r.k)}</b>`}</td><td data-l="Fatura" class="r">${r.n}</td><td data-l="Bakiye" class="r num"><b>${toplamYaz(r.bak)}</b></td><td data-l="Vadesi geçen" class="r ${r.gec ? 'neg' : 'muted'}">${r.gec ? `${r.gec} fatura · ${r.maxG} gün` : '—'}</td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('tr[data-cari]').forEach(tr => tr.onclick = e => { if (e.target.closest('a')) return; f.q = tr.dataset.cari; f.gor = 'liste'; saveFilters(); tahsilatView(el); });
      return;
    }
    box.innerHTML = l.length ? `<ul class="list big">${l.map(t => `<li><button type="button" class="linkrow" data-id="${t.id}"><b>${esc(cariAd(t))}</b><span class="muted">${esc(t.belge_no || 'Fatura')} · fatura ${tarih(t.tarih)} · vade ${tarih(t.vade)}${+t.odenen ? ` · ödenen ${para(t.odenen, t.para_birimi)}` : ''}</span></button>
      <span class="r"><b class="num">${para(kalan(t) || t.tutar, t.para_birimi)}</b>${tpill(t)}</span></li>`).join('')}</ul>` : '<div class="empty"><p>Bu filtrede kayıt yok.</p></div>';
    box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => tahsilatForm({ id: b.dataset.id }));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelectorAll('[data-gor]').forEach(b => b.onclick = () => { f.gor = b.dataset.gor; saveFilters(); el.querySelectorAll('[data-gor]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => tahsilatForm({});
  el.querySelector('[data-up]').onclick = tahsilatYukle;
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`tahsilat-${today()}.xlsx`, { 'Tahsilat': list().map(t => ({ 'Cari': cariAd(t), 'Fatura no': t.belge_no, 'Fatura tarihi': t.tarih, 'Vade': t.vade, 'Tutar': +t.tutar, 'Ödenen': +t.odenen || 0, 'Kalan': kalan(t), 'Para birimi': t.para_birimi, 'Durum': durumu(t), 'Gecikme (gün)': gecikme(t) || '', 'Not': t.notlar })) });
  draw();
}

const nn = s => fold(s || '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
async function tahsilatYukle() {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.some(c => /tutar|borç|borc|bakiye|tutarı/i.test(String(c || ''))) && r.some(c => /cari|müşteri|musteri|firma|unvan/i.test(String(c || ''))));
    if (hi < 0) return toast('Başlık satırı bulunamadı: “Cari” ve “Tutar” sütunları olmalı.', 'err');
    const h = rows[hi].map(c => fold(c || ''));
    const col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
    const C0 = { cari: col(/cari ad|musteri ad|unvan/, /^cari$/, /cari|musteri|firma/), no: col(/fatura no|belge no|evrak no/, /fatura|belge|evrak/), tarih: col(/fatura tarihi|belge tarihi/, /^tarih/), vade: col(/vade/),
      tutar: col(/^tutar/, /fatura tutari|borc|tutar/), pb: col(/para birimi|doviz|pb$|cinsi/), odenen: col(/odenen|tahsil edilen|alacak/) };
    const { sutunlariEsle } = await import('../esle.js');
    const C = await sutunlariEsle('tahsilat', 'Cari ekstresi', rows[hi].map(x => String(x ?? '')), rows.slice(hi + 1, hi + 4), [
      { k: 'cari', l: 'Cari / müşteri adı', zorunlu: true }, { k: 'no', l: 'Fatura no' }, { k: 'tarih', l: 'Fatura tarihi' }, { k: 'vade', l: 'Vade tarihi' }, { k: 'tutar', l: 'Tutar', zorunlu: true }, { k: 'pb', l: 'Para birimi' }, { k: 'odenen', l: 'Ödenen' }], C0);
    if (!C) return toast('Yükleme iptal edildi.');
    const dt = v => v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : typeof v === 'string' && /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(v) ? v.split(/[./]/).reverse().map(x => x.padStart(2, '0')).join('-') : typeof v === 'number' && v > 30000 ? new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10) : null;
    const sayi = v => typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
    const mevcut = new Map(S.tahsilatlar.map(t => [nn(cariAd(t)) + '|' + nn(t.belge_no), t]));
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const cari = r[C.cari] ? String(r[C.cari]).trim() : ''; const tutar = sayi(r[C.tutar]);
      if (!cari || !tutar || /toplam/i.test(cari)) continue;
      const fm = S.firmalar.find(x => nn(x.ad) === nn(cari)) || S.firmalar.find(x => nn(x.ad).length > 5 && nn(cari).startsWith(nn(x.ad)));
      const no = C.no >= 0 && r[C.no] != null ? String(r[C.no]).trim() : null;
      const ex = mevcut.get(nn(fm?.ad || cari) + '|' + nn(no));
      const pb = C.pb >= 0 && r[C.pb] ? String(r[C.pb]).trim().toUpperCase().replace('TL', 'TRY') : (ex?.para_birimi || 'USD');
      const o = { ...(ex || { id: uuid() }), firma_id: fm?.id || ex?.firma_id || null, cari: fm?.ad || cari, belge_no: no, tarih: dt(r[C.tarih]) || ex?.tarih || null, vade: dt(r[C.vade]) || ex?.vade || null, tutar, para_birimi: /USD|EUR|TRY/.test(pb) ? pb : 'USD', odenen: C.odenen >= 0 ? sayi(r[C.odenen]) : (ex?.odenen || 0) };
      o.durum = durumu(o); out.push(o);
    }
    if (!out.length) return toast('Dosyada alacak satırı bulunamadı.', 'err');
    const yeni = out.filter(o => !S.tahsilatlar.some(t => t.id === o.id)).length, eslesmeyen = out.filter(o => !o.firma_id).length;
    await app.db.bulk('tahsilatlar', out);
    yuklemeKaydet(file, 'Cari ekstresi', `${out.length} fatura, ${yeni} yeni`);
    toast(`${out.length} fatura okundu: ${yeni} yeni, ${out.length - yeni} güncellendi.${eslesmeyen ? ` ${eslesmeyen} faturanın carisi firma listesinde bulunamadı.` : ''}`);
    app.refresh();
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
}
