// Muhasebe ve finans: para ile ilgili her şey tek menüde. Özet, cari hesaplar (ekstre), alacak yaşlandırma, kur, muhasebeye aktarma.
// Tutarlar yaklaşık USD karşılığıyla toplanır (Finans → Kur); her kaydın kendi para birimi ekstrede ayrıca görünür.
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, byId, firmaAd, match, toast, openDrawer, exportXlsx, waLink } from '../ui.js';
import { usdYap, firmaRiski, SEVIYE } from '../vaderisk.js';
import { kalan, gecikme, alacakMi, para } from './tahsilat.js';
import { siparisUsd } from '../ceyrek.js';
import { kur, kurYazi } from '../kur.js';
import { izin } from '../yetki.js';

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const yil = d => String(d || '').slice(0, 4), ay = d => +String(d || '').slice(5, 7);
const kurTL = () => kur()?.USD || null;
const tlUsd = v => { const k = kurTL(); return k ? (+v || 0) / k : 0; };
const tamUsd = v => usd(Math.round(v || 0));
const tlYaz = v => { const k = kurTL(); return k ? '≈ ' + new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v * k) + ' ₺' : ''; };
const cariAd = t => firmaAd(t.firma_id) || t.cari || '—';
const cariKey = t => t.firma_id || 'c:' + (t.cari || '—');

// ---------- Hesaplar ----------
// Bir dönemin rakamları (y: yıl, a: ay 1-12 ya da 0 = bütün yıl)
export function donemOzeti(y, a = 0) {
  const icinde = d => yil(d) === String(y) && (!a || ay(d) === a);
  const sip = S.siparisler.filter(s => icinde(s.tarih) && !s.rapor_disi);
  const satis = sip.reduce((t, s) => t + siparisUsd(s, kurTL()), 0);
  const tahsil = S.tahsilatlar.reduce((t, x) => t + (alacakMi(x) ? (icinde(x.odeme_tarihi) ? usdYap(x.odenen, x.para_birimi) : 0) : (icinde(x.tarih) && x.tur === 'Ödeme' ? usdYap(x.tutar, x.para_birimi) : 0)), 0);
  const masrafTL = S.masraflar.filter(m => icinde(m.tarih)).reduce((t, m) => t + (+m.tutar || 0), 0);
  const acik = S.tahsilatlar.filter(t => kalan(t) > 0);
  return {
    satis, sipN: sip.length, tahsil, masrafTL, masraf: tlUsd(masrafTL),
    acik: acik.reduce((t, x) => t + usdYap(kalan(x), x.para_birimi), 0),
    gecikmis: acik.filter(t => gecikme(t) > 0).reduce((t, x) => t + usdYap(kalan(x), x.para_birimi), 0),
    pb: acik.reduce((o, x) => { const p = x.para_birimi || 'USD'; o[p] = (o[p] || 0) + kalan(x); return o; }, {}),
  };
}
// Cari hesap: firma bazında hareketler ve bakiye (para birimi başına)
export function cariHareketler(key) {
  const l = S.tahsilatlar.filter(t => cariKey(t) === key), h = [];
  for (const t of l) {
    const pb = t.para_birimi || 'USD';
    if (alacakMi(t)) {
      h.push({ tarih: t.tarih || t.vade || '', tur: 'Fatura', belge: t.belge_no || '', vade: t.vade || '', borc: +t.tutar || 0, alacak: 0, pb, id: t.id });
      if (+t.odenen > 0) h.push({ tarih: t.odeme_tarihi || t.tarih || '', tur: 'Ödeme', belge: t.belge_no ? t.belge_no + ' ödemesi' : '', vade: '', borc: 0, alacak: +t.odenen, pb, id: t.id });
    } else h.push({ tarih: t.tarih || '', tur: t.tur, belge: t.belge_no || '', vade: '', borc: 0, alacak: +t.tutar || 0, pb, id: t.id });
  }
  h.sort((a, b) => a.tarih.localeCompare(b.tarih) || (a.borc ? -1 : 1));
  const bak = {}; for (const x of h) { bak[x.pb] = (bak[x.pb] || 0) + x.borc - x.alacak; x.bakiye = bak[x.pb]; }
  return { h, bakiye: bak };
}
export function cariListesi() {
  const m = new Map();
  for (const t of S.tahsilatlar) {
    const k = cariKey(t); let c = m.get(k);
    if (!c) m.set(k, c = { key: k, firma_id: t.firma_id || null, ad: cariAd(t), borc: 0, alacak: 0, gecikmis: 0, maxGun: 0, n: 0, son: '' });
    const ps = v => usdYap(v, t.para_birimi);
    if (alacakMi(t)) { c.borc += ps(t.tutar); c.alacak += ps(t.odenen); c.n++; if (gecikme(t) > 0) { c.gecikmis += ps(kalan(t)); c.maxGun = Math.max(c.maxGun, gecikme(t)); } }
    else c.alacak += ps(t.tutar);
    c.son = [c.son, t.tarih, t.odeme_tarihi].filter(Boolean).sort().at(-1) || '';
  }
  return [...m.values()].map(c => ({ ...c, bakiye: c.borc - c.alacak, risk: c.firma_id ? firmaRiski(c.firma_id) : null }));
}
// Yaşlandırma: açık alacak vadeye göre dilimler
export const DILIMLER = [['gelmedi', 'Vadesi gelmemiş'], ['d30', '0–30 gün'], ['d60', '31–60 gün'], ['d90', '61–90 gün'], ['d90p', '90+ gün']];
const dilimOf = t => { const g = gecikme(t); return !g ? 'gelmedi' : g <= 30 ? 'd30' : g <= 60 ? 'd60' : g <= 90 ? 'd90' : 'd90p'; };
export function yaslandirma(grup = 'firma') {
  const m = new Map(), top = Object.fromEntries(DILIMLER.map(([k]) => [k, 0]));
  for (const t of S.tahsilatlar.filter(x => kalan(x) > 0)) {
    const k = grup === 'sorumlu' ? (t.sorumlu || '').toLowerCase() || '—' : cariKey(t);
    let r = m.get(k); if (!r) m.set(k, r = { key: k, ad: grup === 'sorumlu' ? kimAd(k) : cariAd(t), firma_id: grup === 'firma' ? t.firma_id : null, top: 0, ...Object.fromEntries(DILIMLER.map(([d]) => [d, 0])) });
    const v = usdYap(kalan(t), t.para_birimi), d = dilimOf(t); r[d] += v; r.top += v; top[d] += v;
  }
  return { satir: [...m.values()].sort((a, b) => (b.d90p + b.d90 + b.d60 + b.d30) - (a.d90p + a.d90 + a.d60 + a.d30) || b.top - a.top), top, genel: Object.values(top).reduce((a, b) => a + b, 0) };
}
const kimAd = e => !e || e === '—' ? 'Atanmamış' : (app.ekip || []).find(u => u.eposta?.toLowerCase() === e)?.ad || (e === (app.db.user?.()?.email || '').toLowerCase() ? 'Sen' : e.split('@')[0]);

// ---------- Ortak parçalar ----------
const kurNotu = () => kurTL() ? `<p class="hint fn-kur">Tutarlar yaklaşık USD karşılığı (${esc(kurYazi())}). <a href="#/kur">Kur</a></p>` : '<p class="warn">Kur girilmedi: TL ve EUR tutarlar USD toplamına katılmıyor. <a href="#/kur">Kuru gir</a></p>';
const kart = (ad, v, alt = '', cls = '') => `<div class="fn-kart ${cls}"><span>${ad}</span><b>${v}</b>${alt ? `<small>${alt}</small>` : ''}</div>`;
function yilSecici(f) {
  const yillar = [...new Set([today().slice(0, 4), ...S.siparisler.map(s => yil(s.tarih)), ...S.tahsilatlar.map(t => yil(t.tarih)), ...S.masraflar.map(m => yil(m.tarih))].filter(Boolean))].sort().reverse();
  return `<select data-yil aria-label="Yıl">${yillar.map(y => `<option ${String(f.yil) === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
    <select data-ay aria-label="Ay"><option value="0">Bütün yıl</option>${AYLAR.map((a, i) => `<option value="${i + 1}" ${+f.ay === i + 1 ? 'selected' : ''}>${a}</option>`).join('')}</select>`;
}

// ---------- Özet ----------
export function finansView(el) {
  const f = F('finans', { yil: today().slice(0, 4), ay: 0 });
  const o = donemOzeti(f.yil, +f.ay), net = o.satis - o.masraf;
  const aylik = AYLAR.map((a, i) => ({ a, ...donemOzeti(f.yil, i + 1) }));
  const max = Math.max(1, ...aylik.flatMap(x => [x.satis, x.tahsil, x.masraf]));
  const bar = (v, c, ad) => `<i class="fn-b ${c}" style="height:${Math.max(v ? 2 : 0, v / max * 100)}%" title="${ad}: ${tamUsd(v)}"></i>`;
  el.innerHTML = `<header class="vh"><div><h1>Finans özeti</h1><p class="sum">${esc(String(f.yil))}${+f.ay ? ' · ' + AYLAR[f.ay - 1] : ''}</p></div><div class="vh-act fn-sec">${yilSecici(f)}</div></header>
    <div class="fn-kartlar">
      ${kart('Satış (sipariş)', tamUsd(o.satis), `${o.sipN} sipariş · ${tlYaz(o.satis)}`)}
      ${kart('Tahsil edilen', tamUsd(o.tahsil), tlYaz(o.tahsil), 'ok')}
      ${kart('Açık alacak', tamUsd(o.acik), Object.entries(o.pb).filter(([, v]) => v).map(([p, v]) => para(v, p)).join(' + ') || 'yok')}
      ${kart('Gecikmiş alacak', tamUsd(o.gecikmis), o.acik ? '%' + Math.round(o.gecikmis / o.acik * 100) + ' açık alacağın' : '', o.gecikmis ? 'neg' : '')}
      ${kart('Masraf', new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(o.masrafTL) + ' ₺', o.masraf ? '≈ ' + tamUsd(o.masraf) : '')}
      ${kart('Net (satış − masraf)', tamUsd(net), '', net >= 0 ? 'ok' : 'neg')}
    </div>
    ${kurNotu()}
    <section class="card"><div class="card-h"><h2>Aylık satış, tahsilat ve masraf</h2></div>
      <p class="cg-leg"><span><i class="fn-b satis"></i>Satış</span><span><i class="fn-b tahsil"></i>Tahsilat</span><span><i class="fn-b masraf"></i>Masraf</span></p>
      <div class="fn-grafik" role="img" aria-label="Aylık satış, tahsilat ve masraf">${aylik.map(x => `<div class="fn-ay"><div class="fn-cub">${bar(x.satis, 'satis', 'Satış')}${bar(x.tahsil, 'tahsil', 'Tahsilat')}${bar(x.masraf, 'masraf', 'Masraf')}</div><small>${x.a}</small></div>`).join('')}</div>
      <details class="cg-t"><summary>Tablo olarak gör</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ay</th><th class="r">Satış</th><th class="r">Tahsilat</th><th class="r">Masraf</th><th class="r">Net</th></tr></thead><tbody>${aylik.map(x => `<tr><td>${x.a}</td><td class="r num">${tamUsd(x.satis)}</td><td class="r num">${tamUsd(x.tahsil)}</td><td class="r num">${tamUsd(x.masraf)}</td><td class="r num">${tamUsd(x.satis - x.masraf)}</td></tr>`).join('')}</tbody></table></div></details></section>
    <section class="card"><div class="card-h"><h2>En çok borcu olan cariler</h2><a class="linkbtn" href="#/cari">Cari hesaplar</a></div>${cariTablo(cariListesi().filter(c => c.bakiye > 0.5).sort((a, b) => b.bakiye - a.bakiye).slice(0, 8))}</section>`;
  el.querySelector('[data-yil]').onchange = e => { f.yil = e.target.value; saveFilters(); finansView(el); };
  el.querySelector('[data-ay]').onchange = e => { f.ay = +e.target.value; saveFilters(); finansView(el); };
  bagla(el);
}
const cariTablo = l => l.length ? `<div class="tbl-wrap"><table class="tbl fn-cari"><thead><tr><th>Cari</th><th class="r">Fatura</th><th class="r">Ödenen</th><th class="r">Bakiye</th><th class="r">Gecikmiş</th><th class="r">En uzun</th></tr></thead><tbody>
  ${l.map(c => `<tr data-cari="${esc(c.key)}" tabindex="0"><td><b>${esc(c.ad)}</b>${c.risk?.seviye ? ` <em class="vr-rozet" style="--c:${SEVIYE[c.risk.seviye].c}">${SEVIYE[c.risk.seviye].ad}</em>` : ''}${c.risk?.ortGec != null && c.risk.odenmisN >= 2 ? `<small class="muted"> · ort. ${c.risk.ortGec > 0 ? c.risk.ortGec + ' gün geç' : 'zamanında'}</small>` : ''}</td>
    <td class="r num">${tamUsd(c.borc)}</td><td class="r num">${tamUsd(c.alacak)}</td><td class="r num"><b>${tamUsd(c.bakiye)}</b></td><td class="r num ${c.gecikmis ? 'neg' : ''}">${c.gecikmis ? tamUsd(c.gecikmis) : ''}</td><td class="r num">${c.maxGun ? c.maxGun + ' gün' : ''}</td></tr>`).join('')}</tbody></table></div>`
  : '<p class="hint">Kayıt yok. Faturaları Tahsilat\'tan ekler ya da cari ekstresini yüklersin.</p>';
const bagla = el => el.querySelectorAll('[data-cari]').forEach(r => { r.onclick = () => ekstreAc(r.dataset.cari); r.onkeydown = e => { if (e.key === 'Enter') ekstreAc(r.dataset.cari); }; });

// ---------- Cari hesaplar ----------
export function cariView(el) {
  const f = F('cari', { q: '', sadece: 'borclu' });
  const l = cariListesi();
  el.innerHTML = `<header class="vh"><div><h1>Cari hesaplar</h1><p class="sum" data-sum></p></div><div class="vh-act">${izin('tahsilat') === 'yaz' || izin('cari') === 'yaz' ? '<button class="btn primary" data-yeni data-gerek="yaz:tahsilatlar">+ Fatura / ödeme</button>' : ''}</div></header>
    <div class="frow"><input type="search" data-q placeholder="Cari ara" value="${esc(f.q)}" aria-label="Cari ara"><div class="seg" role="group" aria-label="Göster">${[['borclu', 'Bakiyesi olan'], ['gecikmis', 'Gecikmiş'], ['tum', 'Tümü']].map(([k, t]) => `<button type="button" data-s="${k}" class="${f.sadece === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    ${kurNotu()}<div data-l></div>`;
  const ciz = () => {
    const g = l.filter(c => match(f.q, c.ad) && (f.sadece === 'tum' || (f.sadece === 'gecikmis' ? c.gecikmis > 0 : Math.abs(c.bakiye) > 0.5))).sort((a, b) => b.gecikmis - a.gecikmis || b.bakiye - a.bakiye);
    el.querySelector('[data-sum]').textContent = `${l.length} cari · toplam bakiye ${tamUsd(l.reduce((a, c) => a + c.bakiye, 0))} · gecikmiş ${tamUsd(l.reduce((a, c) => a + c.gecikmis, 0))}`;
    el.querySelector('[data-l]').innerHTML = cariTablo(g); bagla(el);
  };
  el.querySelector('[data-q]').oninput = e => { f.q = e.target.value; saveFilters(); ciz(); };
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { f.sadece = b.dataset.s; saveFilters(); el.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); ciz(); });
  el.querySelector('[data-yeni]')?.addEventListener('click', async () => (await import('./tahsilat.js')).tahsilatForm({}));
  ciz();
}
export function ekstreAc(key) {
  const { h, bakiye } = cariHareketler(key), ilk = S.tahsilatlar.find(t => cariKey(t) === key);
  if (!ilk) return toast('Cari bulunamadı.', 'err');
  const ad = cariAd(ilk), f = byId('firmalar', ilk.firma_id), r = ilk.firma_id ? firmaRiski(ilk.firma_id) : null;
  const bakYaz = Object.entries(bakiye).filter(([, v]) => Math.abs(v) > 0.005).map(([p, v]) => para(v, p)).join(' + ') || '0';
  const p = openDrawer(`<header class="dh"><div><p class="muted">Cari hesap ekstresi</p><h2 id="drawer-title">${esc(ad)}</h2><div class="dh-meta"><span>Bakiye <b>${esc(bakYaz)}</b></span>${r?.seviye ? `<em class="vr-rozet" style="--c:${SEVIYE[r.seviye].c}">${esc(r.metin)}</em>` : ''}</div></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dh-actions"><button class="btn sm" data-x="xlsx">Excel</button><button class="btn sm" data-x="pdf">PDF / yazdır</button><button class="btn sm" data-x="wa">WhatsApp</button>${f ? `<a class="btn sm ghost" href="#/firma/${f.id}">Firma sayfası</a>` : ''}</div>
    <div class="dbody"><div class="tbl-wrap"><table class="tbl ekstre"><thead><tr><th>Tarih</th><th>Hareket</th><th>Belge</th><th class="r">Borç</th><th class="r">Alacak</th><th class="r">Bakiye</th></tr></thead><tbody>
      ${h.map(x => `<tr><td>${tarih(x.tarih)}</td><td>${esc(x.tur)}${x.vade ? `<small class="muted"> · vade ${tarih(x.vade)}</small>` : ''}</td><td>${esc(x.belge)}</td><td class="r num">${x.borc ? para(x.borc, x.pb) : ''}</td><td class="r num">${x.alacak ? para(x.alacak, x.pb) : ''}</td><td class="r num"><b>${para(x.bakiye, x.pb)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="hint">Hareket yok.</td></tr>'}</tbody></table></div></div>`);
  p.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
    const x = b.dataset.x;
    if (x === 'xlsx') exportXlsx(`ekstre-${ad}-${today()}`, { Ekstre: h.map(r => ({ Tarih: r.tarih, Hareket: r.tur, Belge: r.belge, Vade: r.vade, 'Para birimi': r.pb, Borç: r.borc || null, Alacak: r.alacak || null, Bakiye: Math.round(r.bakiye * 100) / 100 })) });
    if (x === 'pdf') yazdir(ad, h, bakYaz);
    if (x === 'wa') { const tel = S.kisiler.find(k => k.firma_id === ilk.firma_id && k.telefon)?.telefon || f?.telefon || ''; const acik = S.tahsilatlar.filter(t => cariKey(t) === key && kalan(t) > 0); window.open(waLink(tel, `Merhaba, ${ad} cari hesap özetiniz (${tarih(today())}):\nBakiye: ${bakYaz}\n${acik.map(t => `• ${t.belge_no || 'Fatura'} · ${para(kalan(t), t.para_birimi)} · vade ${tarih(t.vade)}${gecikme(t) ? ' (' + gecikme(t) + ' gün geçti)' : ''}`).join('\n')}\nİyi çalışmalar.`), '_blank', 'noopener'); }
  });
}
function yazdir(ad, h, bakYaz) {
  const w = window.open('', '_blank'); if (!w) return toast('Açılır pencereye izin ver.', 'err');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Ekstre ${esc(ad)}</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}.r{text-align:right}</style>
    <h1>Cari hesap ekstresi · ${esc(ad)}</h1><div>${tarih(today())} · Bakiye: <b>${esc(bakYaz)}</b></div>
    <table><thead><tr><th>Tarih</th><th>Hareket</th><th>Belge</th><th class="r">Borç</th><th class="r">Alacak</th><th class="r">Bakiye</th></tr></thead><tbody>${h.map(x => `<tr><td>${tarih(x.tarih)}</td><td>${esc(x.tur)}</td><td>${esc(x.belge)}</td><td class="r">${x.borc ? para(x.borc, x.pb) : ''}</td><td class="r">${x.alacak ? para(x.alacak, x.pb) : ''}</td><td class="r">${para(x.bakiye, x.pb)}</td></tr>`).join('')}</tbody></table>`);
  w.document.close(); setTimeout(() => w.print(), 300);
}

// ---------- Yaşlandırma ----------
export function yaslandirmaView(el) {
  const f = F('yaslandirma', { grup: 'firma' });
  const { satir, top, genel } = yaslandirma(f.grup);
  const yuz = v => genel ? '%' + Math.round(v / genel * 100) : '';
  el.innerHTML = `<header class="vh"><div><h1>Alacak yaşlandırma</h1><p class="sum">Açık alacak ${tamUsd(genel)} · vadesi geçen ${tamUsd(genel - top.gelmedi)}</p></div>
    <div class="vh-act"><div class="seg" role="group" aria-label="Grupla">${[['firma', 'Firmaya göre'], ['sorumlu', 'Sorumluya göre']].map(([k, t]) => `<button type="button" data-g="${k}" class="${f.grup === k ? 'on' : ''}">${t}</button>`).join('')}</div><button class="btn" data-xlsx>Excel</button></div></header>
    <div class="fn-dilim">${DILIMLER.map(([k, t]) => `<div class="fn-d ${k}"><span>${t}</span><b>${tamUsd(top[k])}</b><small>${yuz(top[k])}</small><i style="width:${genel ? top[k] / genel * 100 : 0}%"></i></div>`).join('')}</div>
    ${kurNotu()}
    ${satir.length ? `<div class="tbl-wrap"><table class="tbl fn-yas"><thead><tr><th>${f.grup === 'sorumlu' ? 'Sorumlu' : 'Cari'}</th>${DILIMLER.map(([, t]) => `<th class="r">${t}</th>`).join('')}<th class="r">Toplam</th></tr></thead><tbody>
      ${satir.map(r => `<tr ${f.grup === 'firma' ? `data-cari="${esc(r.key)}" tabindex="0"` : ''}><td><b>${esc(r.ad)}</b></td>${DILIMLER.map(([k]) => `<td class="r num ${k !== 'gelmedi' && r[k] ? 'neg' : ''}">${r[k] ? tamUsd(r[k]) : ''}</td>`).join('')}<td class="r num"><b>${tamUsd(r.top)}</b></td></tr>`).join('')}
      <tr class="toplam"><td><b>Toplam</b></td>${DILIMLER.map(([k]) => `<td class="r num"><b>${tamUsd(top[k])}</b></td>`).join('')}<td class="r num"><b>${tamUsd(genel)}</b></td></tr></tbody></table></div>` : '<div class="empty"><p>Açık alacak yok.</p></div>'}`;
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { f.grup = b.dataset.g; saveFilters(); yaslandirmaView(el); });
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`alacak-yaslandirma-${today()}`, { Yaşlandırma: satir.map(r => ({ [f.grup === 'sorumlu' ? 'Sorumlu' : 'Cari']: r.ad, ...Object.fromEntries(DILIMLER.map(([k, t]) => [t + ' (USD)', Math.round(r[k])])), 'Toplam (USD)': Math.round(r.top) })) });
  bagla(el);
}

// ---------- Kur ----------
export async function kurView(el) {
  el.innerHTML = `<header class="vh"><div><h1>Döviz kuru</h1><p class="sum">Tutarların TL ve USD karşılıkları bu kurla hesaplanır; ekipteki herkes aynı kuru görür.</p></div></header><section class="card sk-kur"><div data-kur></div></section>`;
  (await import('../kur.js')).kurAyarlari(el.querySelector('[data-kur]'));
}

// ---------- Muhasebeye aktar ----------
export function muhasebeView(el) {
  const f = F('muhasebe', { bas: today().slice(0, 8) + '01', bit: today(), s: ['siparis', 'fatura', 'odeme', 'masraf'] });
  const SAY = [['siparis', 'Siparişler', 'siparisler'], ['fatura', 'Faturalar (alacaklar)', 'tahsilatlar'], ['odeme', 'Tahsilatlar (ödemeler)', 'tahsilatlar'], ['masraf', 'Masraflar', 'masraflar'], ...(S.cekler ? [['cek', 'Çek ve senetler', 'cekler']] : [])];
  el.innerHTML = `<header class="vh"><div><h1>Muhasebeye aktar</h1><p class="sum">Seçtiğin dönemin kayıtları, muhasebecinin işleyebileceği düz Excel sayfaları olarak.</p></div></header>
    <section class="card"><div class="grid"><div class="fld"><label for="mh-b">Başlangıç</label><input id="mh-b" type="date" value="${esc(f.bas)}"></div><div class="fld"><label for="mh-s">Bitiş</label><input id="mh-s" type="date" value="${esc(f.bit)}"></div></div>
      <div class="fld"><label>Sayfalar</label>${SAY.map(([k, t]) => `<label class="chk"><input type="checkbox" data-s="${k}" ${f.s.includes(k) ? 'checked' : ''}> <span>${t} <small class="muted" data-n="${k}"></small></span></label>`).join('')}</div>
      <div class="btnrow"><button class="btn primary" data-indir>Excel'i indir</button></div>
      <p class="hint">Logo, Mikro, Paraşüt gibi programlara doğrudan bağlantı ileride eklenecek; şimdilik bu dosya muhasebe programına içe aktarılabilir ya da muhasebeciye gönderilir.</p></section>`;
  const ara = () => [el.querySelector('#mh-b').value, el.querySelector('#mh-s').value];
  const ic = (d, [b, s]) => d && d.slice(0, 10) >= b && d.slice(0, 10) <= s;
  const sayfalar = () => {
    const r = ara(), o = {};
    if (f.s.includes('siparis')) o['Siparişler'] = S.siparisler.filter(s => ic(s.tarih, r)).map(s => ({ Tarih: s.tarih, 'Sipariş no': s.siparis_no, 'Belge no': s.belge_no, Cari: firmaAd(s.firma_id) || s.musteri_adi, 'Müşteri no': s.musteri_no, Tutar: +s.net_deger || 0, 'Para birimi': s.para_birimi || 'USD', Proje: s.proje_tanimi || byId('projeler', s.proje_id)?.ad || '' }));
    if (f.s.includes('fatura')) o['Faturalar'] = S.tahsilatlar.filter(t => alacakMi(t) && ic(t.tarih, r)).map(t => ({ Tarih: t.tarih, Vade: t.vade, 'Belge no': t.belge_no, Cari: cariAd(t), Tutar: +t.tutar || 0, Ödenen: +t.odenen || 0, Kalan: kalan(t), 'Para birimi': t.para_birimi || 'USD' }));
    if (f.s.includes('odeme')) o['Tahsilatlar'] = [...S.tahsilatlar.filter(t => alacakMi(t) && +t.odenen > 0 && ic(t.odeme_tarihi, r)).map(t => ({ Tarih: t.odeme_tarihi, Tür: 'Fatura ödemesi', 'Belge no': t.belge_no, Cari: cariAd(t), Tutar: +t.odenen, 'Para birimi': t.para_birimi || 'USD' })),
      ...S.tahsilatlar.filter(t => !alacakMi(t) && ic(t.tarih, r)).map(t => ({ Tarih: t.tarih, Tür: t.tur, 'Belge no': t.belge_no, Cari: cariAd(t), Tutar: +t.tutar || 0, 'Para birimi': t.para_birimi || 'USD' }))];
    if (f.s.includes('masraf')) o['Masraflar'] = S.masraflar.filter(m => ic(m.tarih, r)).map(m => ({ Tarih: m.tarih, Tür: m.tip, 'Tutar (TL)': +m.tutar || 0, Km: +m.km || null, Açıklama: m.aciklama || '' }));
    if (f.s.includes('cek') && S.cekler) o['Çek ve senet'] = S.cekler.filter(c => ic(c.vade, r) || ic(c.tarih, r)).map(c => ({ Tür: c.tur, 'Belge no': c.belge_no, Keşideci: c.kesideci || firmaAd(c.firma_id), Banka: c.banka, Vade: c.vade, Tutar: +c.tutar || 0, 'Para birimi': c.para_birimi || 'TRY', Durum: c.durum }));
    return o;
  };
  const say = () => { const o = sayfalar(); SAY.forEach(([k, t]) => { const n = el.querySelector(`[data-n="${k}"]`); const ad = { siparis: 'Siparişler', fatura: 'Faturalar', odeme: 'Tahsilatlar', masraf: 'Masraflar', cek: 'Çek ve senet' }[k]; if (n) n.textContent = o[ad] ? `(${o[ad].length})` : ''; }); };
  el.querySelectorAll('#mh-b, #mh-s').forEach(i => i.onchange = () => { [f.bas, f.bit] = ara(); saveFilters(); say(); });
  el.querySelectorAll('[data-s]').forEach(c => c.onchange = () => { f.s = [...el.querySelectorAll('[data-s]:checked')].map(x => x.dataset.s); saveFilters(); say(); });
  el.querySelector('[data-indir]').onclick = () => { const o = sayfalar(); if (!Object.keys(o).length) return toast('En az bir sayfa seç.', 'err'); exportXlsx(`muhasebe-${f.bas}-${f.bit}`, o); };
  say();
}
