import { S, uuid } from '../db.js';
import { kayipKarti, kayipTamamla } from '../kayip.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, num, tarih, today, DURUMLAR, ACIK, byId, firmaAd, match, toast, exportXlsx, pickFiles, fold, durumRenk, openDrawer, closeDrawer, pill, olasilik, confirmBox } from '../ui.js';
import { gorevForm } from './ziyaret.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { yilGercek, ceyrekGercek, hedefKaydi, siparisUsd, donemKuru, ceyrekOf } from '../ceyrek.js';
import { kur } from '../kur.js';
import { yuklemeKaydet } from '../belgeler.js';

const q = d => Math.floor((new Date(d).getMonth()) / 3) + 1;
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);

export function panelView(el) {
  const f = F('panel', { yil: 2026 });
  const Y = +f.yil;
  const G = yilGercek(Y);
  const hed = G.map(g => g.hedef);
  const gercek = G.map(g => g.gercek);
  const toplamHedef = hed.reduce((a, b) => a + b, 0), toplamG = gercek.reduce((a, b) => a + b, 0);
  const yP = S.projeler.filter(p => p.takip_yili === Y);
  const acik = yP.filter(p => ACIK.includes(p.durum));
  const next = S.projeler.filter(p => p.takip_yili === Y + 1 && ACIK.includes(p.durum));
  const kayip = yP.filter(p => p.durum === 'Kayıp');
  const t = today();
  const gorev = S.gorevler.filter(g => g.durum !== 'Tamam').sort((a, b) => (a.son_tarih || '9').localeCompare(b.son_tarih || '9')).slice(0, 8);
  const beklenen = S.projeler.filter(p => ACIK.includes(p.durum) && p.beklenen_tarih).sort((a, b) => a.beklenen_tarih.localeCompare(b.beklenen_tarih)).slice(0, 10);
  const maxQ = Math.max(...hed, ...gercek, 1);

  const markalar = {};
  for (const p of kayip) { const m = p.rakip_marka || 'Belirtilmemiş'; (markalar[m] ||= { n: 0, biz: 0, rakip: 0 }); markalar[m].n++; markalar[m].biz += +p.bizim_teklif_usd || +p.tutar_usd || 0; markalar[m].rakip += +p.rakip_toplam_usd || 0; }
  const nedenler = {}; for (const p of kayip) nedenler[p.kayip_nedeni || 'Belirtilmemiş'] = (nedenler[p.kayip_nedeni || 'Belirtilmemiş'] || 0) + 1;
  const firmaPerf = {};
  for (const p of yP) for (const [k, rol] of [['emut_id', 'Emüt'], ['gemut_id', 'Gemüt'], ['alici_id', 'Alıcı']]) {
    if (!p[k]) continue; const r = (firmaPerf[p[k]] ||= { rol, n: 0, w: 0, l: 0 }); r.n++; if (p.durum === 'Sipariş') r.w++; if (p.durum === 'Kayıp') r.l++;
  }
  const topFirma = Object.entries(firmaPerf).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const durumMax = Math.max(...DURUMLAR.map(d => yP.filter(p => p.durum === d.k).length), 1);
  const tah = tahmin(Y, gercek, hed);
  const ROL = KARNE_ROL[f.karne] ? f.karne : 'bayi_id';
  const karne = bayiKarnesi(Y, ROL);

  el.innerHTML = `<header class="vh"><div><h1>Panel</h1><p class="sum">${Y} yılı, bugün ${tarih(t)}</p></div>
    <div class="vh-act"><button class="btn ghost" data-xls>Excel</button><label>Yıl <select data-yil>${[2025, 2026, 2027].map(y => `<option ${y === Y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div></header>
  <section class="ledger">
    <div><span>Sipariş / hedef</span><b>${usd(toplamG)}</b><small>${toplamHedef ? `hedefin %${num(toplamG / toplamHedef * 100)}'i · hedef ${usd(toplamHedef)}` : 'Hedef girilmemiş'}</small></div>
    <div><span>Açık potansiyel (${Y})</span><b>${usd(sum(acik, p => p.tutar_usd))}</b><small>${acik.length} açık proje</small></div>
    <div><span>${Y + 1} beklenen</span><b>${usd(sum(next, p => p.tutar_usd))}</b><small>${next.length} proje</small></div>
    <div><span>Kaybedilen (${Y})</span><b>${usd(sum(kayip, p => p.bizim_teklif_usd || p.tutar_usd))}</b><small>${kayip.length} proje</small></div>
  </section>
  <div class="dash">
    <section class="card wide"><h2>Çeyrek bazında sipariş ve hedef</h2>
      <div class="qbars">${[0, 1, 2, 3].map(i => `<div class="qb"><div class="qb-cols"><span class="bar target" style="height:${hed[i] / maxQ * 100}%" title="Hedef ${usd(hed[i])}"></span><span class="bar real ${gercek[i] >= hed[i] && hed[i] ? 'ok' : ''}" style="height:${gercek[i] / maxQ * 100}%" title="Gerçekleşen ${usd(gercek[i])}"></span></div>
        <b>${i + 1}. çeyrek</b><small>${usd(gercek[i])}${hed[i] ? ` · %${num(gercek[i] / hed[i] * 100)}` : ''}</small></div>`).join('')}</div>
      <p class="legend-line"><span class="sw target"></span>Hedef <span class="sw real"></span>Gerçekleşen${G.some(g => g.kaynak === 'resmi') ? ` (${G.map((g, i) => g.kaynak === 'resmi' ? i + 1 + '. çeyrek resmi rakam' : null).filter(Boolean).join(', ')}; diğerleri siparişlerden)` : ' (siparişlerden)'} · <a href="#/siparisler" data-ozet>Çeyrek rakamlarını düzenle</a></p></section>
    <section class="card wide"><h2>Olasılıklı tahmin (${Y})</h2>
      <p class="hint">Açık projelerin tutarı kazanma olasılığıyla çarpılır (olasılık girilmemişse aşamaya göre: Proje %10, İhale %25, Teklif %40, Sıcak %70, Beklemede %15). Çeyrek, beklenen sipariş ya da aydınlatma alım tarihinden; tarihsiz projeler “Tarihsiz” sütununda.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${[1, 2, 3, 4].map(c => `<th class="r">${c}. çeyrek</th>`).join('')}<th class="r">Tarihsiz</th><th class="r">Yıl</th></tr></thead><tbody>
        <tr><td>Gerçekleşen${G.some(g => g.kaynak === 'resmi') ? ' (resmi / sipariş)' : ' sipariş'}</td>${gercek.map(v => `<td class="r num">${usd(v)}</td>`).join('')}<td></td><td class="r num"><b>${usd(toplamG)}</b></td></tr>
        <tr><td>Ağırlıklı açık potansiyel</td>${tah.ag.map(v => `<td class="r num">${v ? usd(v) : '—'}</td>`).join('')}<td class="r num">${usd(tah.tarihsiz)}</td><td class="r num"><b>${usd(tah.agTop)}</b></td></tr>
        <tr class="em"><td>Tahmini toplam</td>${[0, 1, 2, 3].map(i => `<td class="r num">${usd(gercek[i] + tah.ag[i])}</td>`).join('')}<td></td><td class="r num"><b>${usd(toplamG + tah.agTop)}</b></td></tr>
        <tr><td>Hedef</td>${hed.map(v => `<td class="r num">${v ? usd(v) : '—'}</td>`).join('')}<td></td><td class="r num">${toplamHedef ? usd(toplamHedef) : '—'}</td></tr>
        ${toplamHedef ? `<tr><td>Tahmin / hedef</td>${[0, 1, 2, 3].map(i => `<td class="r ${hed[i] && gercek[i] + tah.ag[i] < hed[i] ? 'neg' : 'pos'}">${hed[i] ? '%' + num(Math.round((gercek[i] + tah.ag[i]) / hed[i] * 100)) : ''}</td>`).join('')}<td></td><td class="r ${toplamG + tah.agTop < toplamHedef ? 'neg' : 'pos'}"><b>%${num(Math.round((toplamG + tah.agTop) / toplamHedef * 100))}</b></td></tr>` : ''}
      </tbody></table></div>
      ${tah.buyuk.length ? `<p class="hint">Tahmini en çok etkileyen projeler: ${tah.buyuk.map(p => `<a href="#/proje/${p.id}">${esc(p.ad)}</a> (${usd(p.tutar_usd)} × %${olasilik(p)})`).join(', ')}</p>` : ''}</section>
    <section class="card wide"><div class="card-h"><h2>Firma karnesi (${Y})</h2><div class="seg sm" role="group" aria-label="Rol">${Object.entries(KARNE_ROL).map(([k, v]) => `<button type="button" data-karne="${k}" class="${k === ROL ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      ${karne.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${KARNE_ROL[ROL]}</th><th class="r">Proje</th><th class="r">Açık potansiyel</th><th class="r">Kazanılan</th><th class="r">Kaybedilen</th><th class="r">Kazanma oranı</th><th>Kaybettiğimiz marka</th><th class="r">Sipariş (${Y})</th>${ROL === 'bayi_id' ? '<th class="r">Stok değeri</th>' : ''}<th>Son ziyaret</th></tr></thead><tbody>
        ${karne.map(k => `<tr><td><a href="#/firma/${k.f.id}"><b>${esc(k.f.ad)}</b></a></td><td class="r">${k.n}</td><td class="r num">${usd(k.acik)}</td><td class="r">${k.w}${k.wT ? `<small>${usd(k.wT)}</small>` : ''}</td><td class="r">${k.l}${k.lT ? `<small>${usd(k.lT)}</small>` : ''}</td>
          <td class="r ${k.oran != null && k.oran < 40 ? 'neg' : ''}">${k.oran != null ? '%' + k.oran : '—'}</td><td>${esc(k.rakip || '—')}</td><td class="r num"><b>${k.sip ? usd(k.sip) : '—'}</b>${k.sipN ? `<small>${k.sipN} sipariş</small>` : ''}</td>${ROL === 'bayi_id' ? `<td class="r num">${k.stok ? usd(k.stok) : '—'}</td>` : ''}<td class="${k.gun != null && k.gun > 30 ? 'neg' : ''}">${k.son ? tarih(k.son) : '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="hint">Kazanma oranı = kazanılan / (kazanılan + kaybedilen). Sipariş, cari adı firmayla eşleşen SAP siparişlerinden${ROL === 'bayi_id' ? '; stok değeri, depo adı bayiyle eşleşen ürünlerden' : ''} hesaplanır.</p>` : `<p class="hint">Projelerde ${KARNE_ROL[ROL].toLowerCase()} seçilmemiş.</p>`}</section>
    <section class="card"><h2>Durumlara göre projeler (${Y})</h2>
      <ul class="hbars">${DURUMLAR.map(d => { const ps = yP.filter(p => p.durum === d.k); return ps.length ? `<li><span>${d.k}</span><span class="hb"><i style="width:${ps.length / durumMax * 100}%;--c:${d.c}"></i></span><b>${ps.length}</b><small>${usd(sum(ps, p => p.tutar_usd))}</small></li>` : ''; }).join('')}</ul></section>
    ${kayipKarti(Y)}
    <section class="card"><h2>Yaklaşan beklenen siparişler</h2>
      ${beklenen.length ? `<ul class="list">${beklenen.map(p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${tarih(p.beklenen_tarih)} · ${usd(p.tutar_usd)}</span></a>${pill(p.durum)}</li>`).join('')}</ul>` : '<p class="hint">Beklenen sipariş tarihi girilmiş açık proje yok.</p>'}</section>
    <section class="card"><h2>Açık görevler</h2>
      ${gorev.length ? `<ul class="list">${gorev.map(g => `<li class="${g.son_tarih && g.son_tarih < t ? 'late' : ''}"><button type="button" class="linkbtn" data-g="${g.id}">${esc(g.baslik)}</button><span class="muted">${tarih(g.son_tarih)}</span></li>`).join('')}</ul>` : '<p class="hint">Açık görev yok.</p>'}
      <p><a href="#/gorevler">Tüm görevler</a></p></section>
    <section class="card"><h2>En çok çalıştığın firmalar (${Y})</h2>
      ${topFirma.length ? `<table class="tbl"><thead><tr><th>Firma</th><th>Rol</th><th class="r">Proje</th><th class="r">Sipariş</th><th class="r">Kayıp</th></tr></thead><tbody>${topFirma.map(([id, v]) => `<tr><td><a href="#/firma/${id}">${esc(firmaAd(id))}</a></td><td>${v.rol}</td><td class="r">${v.n}</td><td class="r">${v.w}</td><td class="r">${v.l}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Veri yok.</p>'}</section>
    <section class="card wide"><h2>Toplantı sunumu tabloları</h2>
      <p class="hint">Çeyrek ve yarı dönem sunumlarındaki tablo düzeninde Excel dosyası indirir; satırları sunuma kopyalayabilirsin.</p>
      <div class="btnrow"><button class="btn primary" data-pptx>Çeyrek sunumu (PowerPoint)</button><button class="btn" data-s="kayip">Kayıp projeler</button><button class="btn" data-s="pot">Potansiyel projeler (${Y})</button><button class="btn" data-s="str">${Y + 1} potansiyel ve stratejik projeler</button><button class="btn ghost" data-s="hedef">Hedef proje listesi</button></div></section>
  </div>`;
  el.querySelector('[data-yil]').onchange = e => { f.yil = +e.target.value; saveFilters(); panelView(el); };
  el.querySelector('[data-ozet]').onclick = () => { const fs = F('siparisler', {}); fs.gor = 'ceyrek'; fs.yil = Y; saveFilters(); };
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`panel-${Y}-${today()}.xlsx`, {
    'Çeyrekler': G.map((g, i) => ({ 'Çeyrek': i + 1, 'Hedef (USD)': g.hedef, 'Siparişlerden (USD)': Math.round(g.siparis), 'Resmi rakam (USD)': g.resmi != null ? Math.round(g.resmi) : '', 'Raporlarda kullanılan (USD)': Math.round(g.gercek), 'Hedefe oran %': g.hedef ? Math.round(g.gercek / g.hedef * 100) : '', 'Ağırlıklı açık potansiyel (USD)': Math.round(tah.ag[i]) })),
    'Firma karnesi': karne.map(k => ({ [KARNE_ROL[ROL]]: k.f.ad, 'Proje': k.n, 'Açık potansiyel (USD)': k.acik, 'Kazanılan': k.w, 'Kazanılan tutar': k.wT, 'Kaybedilen': k.l, 'Kaybedilen tutar': k.lT, 'Kazanma oranı %': k.oran, 'Kaybettiğimiz marka': k.rakip, 'Sipariş (USD)': Math.round(k.sip), 'Son ziyaret': k.son })),
    'Durumlar': DURUMLAR.map(d => { const ps = yP.filter(p => p.durum === d.k); return { 'Durum': d.k, 'Proje': ps.length, 'Tutar (USD)': sum(ps, p => p.tutar_usd) }; }),
  });
  el.querySelectorAll('[data-karne]').forEach(b => b.onclick = () => { f.karne = b.dataset.karne; saveFilters(); const y = window.scrollY; panelView(el); window.scrollTo(0, y); });
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.g }));
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => sunum(b.dataset.s, Y));
  el.querySelector('[data-kayiptamam]')?.addEventListener('click', () => kayipTamamla(Y, () => { const y = window.scrollY; panelView(el); window.scrollTo(0, y); }));
  el.querySelector('[data-pptx]').onclick = async () => { const { ceyrekSunumu } = await import('../pptx.js'); ceyrekSunumu(Y); };
}

// Olasılıklı tahmin: açık projeler × olasılık, beklenen tarihin çeyreğine
export function tahmin(Y, gercek, hed) {
  const ag = [0, 0, 0, 0]; let tarihsiz = 0; const katki = [];
  for (const p of S.projeler) {
    if (!ACIK.includes(p.durum) || !p.tutar_usd) continue;
    const d = p.beklenen_tarih || p.alim_tarihi;
    const v = +p.tutar_usd * olasilik(p) / 100;
    if (d && d.startsWith(String(Y))) { ag[q(d) - 1] += v; katki.push([p, v]); }
    else if (!d && +p.takip_yili === Y) { tarihsiz += v; katki.push([p, v]); }
  }
  return { ag, tarihsiz, agTop: ag.reduce((a, b) => a + b, 0) + tarihsiz, buyuk: katki.sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]) };
}
export const KARNE_ROL = { bayi_id: 'Bayi', emut_id: 'Emüt', gemut_id: 'Gemüt', alici_id: 'Malzeme alıcısı', projeci_id: 'Projeci', danisman_id: 'Danışman', yatirimci_id: 'Yatırımcı' };
export function bayiKarnesi(Y, rol = 'bayi_id') {
  const ids = new Set(S.projeler.map(p => p[rol]).filter(Boolean));
  if (rol === 'bayi_id') for (const f of S.firmalar) if ((f.tipler || []).includes('Bayi')) ids.add(f.id);
  const t = today();
  return [...ids].map(id => byId('firmalar', id)).filter(Boolean).map(f => {
    const ps = S.projeler.filter(p => p[rol] === f.id && (!p.takip_yili || +p.takip_yili === Y || ACIK.includes(p.durum)));
    const rk = {}; for (const p of ps) if (p.durum === 'Kayıp' && p.rakip_marka) rk[p.rakip_marka] = (rk[p.rakip_marka] || 0) + 1;
    const won = ps.filter(p => p.durum === 'Sipariş'), lost = ps.filter(p => p.durum === 'Kayıp');
    const ilk = fold(f.ad).split(/\s+/)[0];
    const sp = S.siparisler.filter(s => s.tarih?.startsWith(String(Y)) && s.para_birimi === 'USD' && !s.rapor_disi && (s.firma_id === f.id || (ilk.length > 2 && fold(s.musteri_adi || '').startsWith(ilk))));
    const stok = rol !== 'bayi_id' ? 0 : S.urunler.filter(u => u.depo && fold(u.depo).startsWith(ilk)).reduce((a, u) => a + (+u.stok || 0) * (+u.birim_fiyat_usd || 0), 0);
    const son = S.ziyaretler.filter(z => z.firma_id === f.id && (z.durum || 'Yapıldı') === 'Yapıldı').map(z => z.tarih).sort().pop() || null;
    return { f, n: ps.length, acik: sum(ps.filter(p => ACIK.includes(p.durum)), p => p.tutar_usd), w: won.length, wT: sum(won, p => p.siparis_tutari_usd || p.tutar_usd), l: lost.length, lT: sum(lost, p => p.bizim_teklif_usd || p.tutar_usd),
      oran: won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : null, sip: sum(sp, s => s.net_deger), sipN: sp.length, stok, rakip: Object.entries(rk).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n})`).slice(0, 2).join(', '), son, gun: son ? Math.round((new Date(t) - new Date(son)) / 864e5) : null };
  }).filter(k => k.n || k.sip).sort((a, b) => b.sip - a.sip || b.acik - a.acik || b.n - a.n).slice(0, 40);
}

function sunum(kind, Y) {
  const kimden = p => [p.yatirimci_id && 'Yatırımcı', p.projeci_id && 'Projeci', p.gemut_id && 'Müteahhit', p.bayi_id && 'Bayi'].filter(Boolean).join(', ');
  const pot = ps => ps.map((p, i) => ({ 'NO': i + 1, 'PROJE ADI': p.ad, 'SEKTÖR': p.sektor, 'PROJENİN KİMDEN GELDİĞİ': kimden(p), 'YATIRIMCI UNVANI': firmaAd(p.yatirimci_id), 'PROJECİ FİRMA UNVANI': firmaAd(p.projeci_id),
    'MÜTEAHHİT UNVANI': firmaAd(p.gemut_id) || firmaAd(p.emut_id), 'PROJENİN AŞAMASI': p.durum, 'REFİT Mİ / YENİ Mİ': p.yeni_refit, 'PROJEDE KULLANILAN ÜRÜNLER': (p.urun_gruplari || []).join(' - '), 'TUTAR (USD)': p.tutar_usd, 'RAKİP': p.rakip_marka }));
  if (kind === 'kayip') {
    const ps = S.projeler.filter(p => p.durum === 'Kayıp' && p.takip_yili === Y);
    exportXlsx(`${Y}-kayip-projeler.xlsx`, { 'Kayıp projeler': ps.map(p => ({ 'PROJE ADI': p.ad, 'DANIŞMAN/TASARIMCI': firmaAd(p.danisman_id) || firmaAd(p.projeci_id) || '-', 'MÜTEAHHİT': firmaAd(p.gemut_id) || firmaAd(p.emut_id), 'SEKTÖR': p.sektor, 'REFİT Mİ YENİ Mİ': p.yeni_refit,
      'BİZİM TEKLİF TUTARIMIZ VE ÜRÜNÜMÜZ': [p.bizim_teklif_usd && num(p.bizim_teklif_usd) + ' USD', p.bizim_urun].filter(Boolean).join(' · '), 'İŞİ KAZANAN FİRMA VE ÜRÜNÜ': [p.rakip_marka, p.rakip_urun].filter(Boolean).join(' · '),
      'İŞİ KAZANAN FİRMANIN TUTARI': p.rakip_toplam_usd, 'RAKİP BİRİM FİYAT': p.rakip_birim_fiyat, 'NEDEN': [p.kayip_nedeni, p.kayip_aciklama].filter(Boolean).join(': ') })) });
  }
  if (kind === 'pot') exportXlsx(`${Y}-potansiyel-projeler.xlsx`, { 'Potansiyel projeler': pot(S.projeler.filter(p => p.takip_yili === Y && ACIK.includes(p.durum)).sort((a, b) => (b.tutar_usd || 0) - (a.tutar_usd || 0))) });
  if (kind === 'str') exportXlsx(`${Y + 1}-stratejik-projeler.xlsx`, { 'Stratejik projeler': pot(S.projeler.filter(p => p.takip_yili === Y + 1 && ACIK.includes(p.durum))) });
  if (kind === 'hedef') exportXlsx(`${Y}-hedef-proje-listesi.xlsx`, { 'Hedef proje listesi': S.projeler.filter(p => p.hedef_listesi).map((p, i) => ({ 'S.NO': i + 1, 'P.DURUMU': p.durum, 'PROJE ADI': p.ad, 'PROJENİN YERİ': p.ilce || p.il || p.lokasyon, 'YATIRIMCI': firmaAd(p.yatirimci_id), 'PROJECİ': firmaAd(p.projeci_id), 'GENEL MÜT.': firmaAd(p.gemut_id), 'ELK.MÜT.(TAŞERON)': firmaAd(p.emut_id), 'MALZ ALICI FİRMA': firmaAd(p.alici_id), 'AYDINLATMA': p.tutar_usd })) });
  toast('Excel dosyası indirildi.');
}

// ---------- Siparişler ----------
// Alanlar: Sipariş no = SAP sipariş numarası (2000…), SAS no = sipariş açıklamasına yazılan not (cari ve proje),
// Satış belgesi = SAP belge numarası, Sipariş notu = siparişin içeriğine dair özel / ekstra bilgiler.
export function siparislerView(el) {
  const f = F('siparisler', { q: '', yil: 2026, ceyrek: 'Tümü', kanal: 'Tümü', cari: 'Tümü', gor: 'liste' });
  const cariler = [...new Set(S.siparisler.map(s => s.musteri_adi).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  el.innerHTML = `<header class="vh"><div><h1>Siparişler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn ghost" data-up>Sipariş Excel'i yükle</button><button class="btn primary" data-yeni>Sipariş ekle</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Sipariş no, SAS no, cari, proje, not ara" value="${esc(f.q)}" aria-label="Siparişlerde ara">
      <div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="liste" class="${f.gor === 'liste' ? 'on' : ''}">Sipariş listesi</button><button type="button" data-gor="ceyrek" class="${f.gor === 'ceyrek' ? 'on' : ''}">Çeyrek özeti</button><button type="button" data-gor="cari" class="${f.gor === 'cari' ? 'on' : ''}">Cari bazında</button><button type="button" data-gor="proje" class="${f.gor === 'proje' ? 'on' : ''}">Proje bazında</button></div>
      <div class="frow"><label>Yıl <select data-k="yil">${[2025, 2026, 2027].map(y => `<option ${y == f.yil ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label>Çeyrek <select data-k="ceyrek">${['Tümü', '1', '2', '3', '4'].map(c => `<option value="${c}" ${String(f.ceyrek) === c ? 'selected' : ''}>${c === 'Tümü' ? 'Tümü' : c + '. çeyrek'}</option>`).join('')}</select></label>
      <label>Kanal <select data-k="kanal">${['Tümü', 'Drv', 'Drv harici'].map(c => `<option ${f.kanal === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Cari <select data-k="cari"><option>Tümü</option>${cariler.map(c => `<option ${f.cari === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div></div>
    <div class="ptable-wrap" data-rows></div>`;
  const pAd = s => s.proje_id ? (byId('projeler', s.proje_id)?.ad || s.proje_tanimi) : s.proje_tanimi;
  const list = () => S.siparisler.filter(s => s.tarih && s.tarih.startsWith(String(f.yil)) && (f.ceyrek === 'Tümü' || q(s.tarih) == f.ceyrek) && (f.kanal === 'Tümü' || (f.kanal === 'Drv') === !!s.drv)
    && (f.cari === 'Tümü' || s.musteri_adi === f.cari) && match(f.q, s.musteri_adi, s.proje_tanimi, pAd(s), s.referans, s.belge_no, s.siparis_no, s.siparis_notu))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || (b.siparis_no || '').localeCompare(a.siparis_no || ''));
  const tut = s => `${num(s.net_deger)} ${s.para_birimi === 'USD' ? '$' : esc(s.para_birimi)}`;
  const grupla = (l, key) => { const g = new Map(); for (const s of l.filter(x => !x.rapor_disi)) { const k = key(s) || '—'; const r = g.get(k) || { k, n: 0, usd: 0, tl: 0, son: '', ids: new Set(), cari: new Set() }; r.n++; if (s.para_birimi === 'USD') r.usd += +s.net_deger || 0; else r.tl += +s.net_deger || 0; if (s.tarih > r.son) r.son = s.tarih; if (s.proje_id) r.ids.add(s.proje_id); if (s.musteri_adi) r.cari.add(s.musteri_adi); g.set(k, r); } return [...g.values()].sort((a, b) => b.usd - a.usd); };
  const draw = () => {
    const l = list(), dahil = l.filter(s => !s.rapor_disi);
    const u = sum(dahil.filter(s => s.para_birimi === 'USD'), s => s.net_deger), tl = sum(dahil.filter(s => s.para_birimi !== 'USD'), s => s.net_deger);
    el.querySelector('[data-sum]').innerHTML = `${l.length} sipariş · ${new Set(l.map(s => s.musteri_adi)).size} cari · <b>${usd(u)}</b>${tl ? ` + ${num(tl)} TL` : ''}${l.length - dahil.length ? ` · ${l.length - dahil.length} sipariş rapor dışı` : ''}`;
    const box = el.querySelector('[data-rows]');
    if (f.gor === 'ceyrek') return ceyrekOzeti(box, +f.yil, () => draw());
    if (!l.length) { box.innerHTML = '<div class="empty"><p>Bu filtrelerde sipariş yok. SAP sipariş listesini “Sipariş Excel\'i yükle” ile ekleyebilir ya da “Sipariş ekle” ile elle girebilirsin.</p></div>'; return; }
    if (f.gor === 'liste') {
      box.innerHTML = `<table class="ptable otable"><thead><tr><th>Tarih</th><th>Sipariş no</th><th>SAS no</th><th>Cari</th><th>Proje</th><th class="r">Net değer</th></tr></thead><tbody>${l.map(s => `<tr data-sid="${s.id}" tabindex="0" class="${s.rapor_disi ? 'disi' : ''}">
        <td data-l="Tarih" class="nowrap">${tarih(s.tarih)}</td>
        <td data-l="Sipariş no" class="num nowrap"><b>${esc(s.siparis_no || '—')}</b>${s.belge_no ? `<small>Satış belgesi ${esc(s.belge_no)}</small>` : ''}</td>
        <td data-l="SAS no"><span class="sas">${esc(s.referans || '—')}</span>${s.siparis_notu ? `<small class="snot">Not: ${esc(s.siparis_notu.slice(0, 90))}</small>` : ''}</td>
        <td data-l="Cari">${s.firma_id ? `<a href="#/firma/${s.firma_id}" class="flink">${esc(s.musteri_adi || '')}</a>` : esc(s.musteri_adi || '—')}${s.drv ? ' <em class="flag soft">Drv</em>' : ''}</td>
        <td data-l="Proje">${s.proje_id ? `<a href="#/proje/${s.proje_id}" class="flink">${esc(pAd(s))}</a>` : `<span class="muted">${esc(s.proje_tanimi || '—')}</span> <small class="muted">projeye bağlı değil</small>`}</td>
        <td data-l="Net değer" class="r num nowrap"><b>${tut(s)}</b>${s.rapor_disi ? '<small class="neg">rapor dışı</small>' : ''}</td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('tr[data-sid]').forEach(tr => { tr.onclick = e => { if (!e.target.closest('a')) siparisForm({ id: tr.dataset.sid }); }; tr.onkeydown = e => { if (e.key === 'Enter') siparisForm({ id: tr.dataset.sid }); }; });
    } else if (f.gor === 'cari') {
      const g = grupla(l, s => s.musteri_adi);
      box.innerHTML = `<table class="ptable"><thead><tr><th>Cari</th><th class="r">Sipariş</th><th class="r">Proje</th><th class="r">Toplam (USD)</th><th class="r">TL</th><th class="r">Pay</th><th>Son sipariş</th></tr></thead><tbody>${g.map(r => `<tr data-cari="${esc(r.k)}" tabindex="0">
        <td data-l="Cari"><b>${esc(r.k)}</b></td><td data-l="Sipariş" class="r">${r.n}</td><td data-l="Proje" class="r">${r.ids.size}</td><td data-l="Toplam" class="r num"><b>${usd(r.usd)}</b></td><td data-l="TL" class="r num">${r.tl ? num(r.tl) : '—'}</td>
        <td data-l="Pay" class="r"><span class="share"><i style="width:${u ? r.usd / u * 100 : 0}%"></i></span> %${num(u ? r.usd / u * 100 : 0)}</td><td data-l="Son sipariş">${tarih(r.son)}</td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('tr[data-cari]').forEach(tr => tr.onclick = () => { f.cari = tr.dataset.cari; f.gor = 'liste'; saveFilters(); siparislerView(el); });
    } else {
      const g = grupla(l, pAd);
      box.innerHTML = `<table class="ptable"><thead><tr><th>Proje</th><th>Cari</th><th class="r">Sipariş</th><th class="r">Toplam (USD)</th><th>Son sipariş</th></tr></thead><tbody>${g.map(r => `<tr data-pq="${esc(r.k)}" tabindex="0">
        <td data-l="Proje"><b>${esc(r.k)}</b></td><td data-l="Cari">${esc([...r.cari].join(', '))}</td><td data-l="Sipariş" class="r">${r.n}</td><td data-l="Toplam" class="r num"><b>${usd(r.usd)}</b></td><td data-l="Son sipariş">${tarih(r.son)}</td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('tr[data-pq]').forEach(tr => tr.onclick = () => { f.q = tr.dataset.pq; f.gor = 'liste'; saveFilters(); siparislerView(el); });
    }
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-k]').forEach(s => s.onchange = () => { f[s.dataset.k] = s.dataset.k === 'yil' ? +s.value : s.value; saveFilters(); draw(); });
  el.querySelectorAll('[data-gor]').forEach(b => b.onclick = () => { f.gor = b.dataset.gor; saveFilters(); el.querySelectorAll('[data-gor]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-up]').onclick = siparisYukle;
  el.querySelector('[data-yeni]').onclick = () => siparisForm({});
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`siparisler-${today()}.xlsx`, { 'Siparişler': list().map(s => ({ 'Tarih': s.tarih, 'Sipariş no': s.siparis_no, 'SAS no': s.referans, 'Satış belgesi': s.belge_no, 'Cari': s.musteri_adi, 'Cari no': s.musteri_no, 'Proje': pAd(s), 'SAP proje tanımı': s.proje_tanimi, 'Net değer': s.net_deger, 'Para birimi': s.para_birimi, 'Sipariş notu': s.siparis_notu, 'Drv': s.drv ? 'Evet' : '', 'Rapor dışı': s.rapor_disi ? 'Evet' : '' })) });
  draw();
}

const SIPARIS_FORM = [
  { title: 'Sipariş', fields: [
    { k: 'tarih', l: 'Sipariş tarihi', t: 'date', help: 'Hangi çeyreğe sayılacağını bu tarih belirler' },
    { k: 'siparis_no', l: 'Sipariş no', ph: '2000…' },
    { k: 'referans', l: 'SAS no', full: true, ph: 'Örn. DRV_EKOL_ELK_KILIÇLAR_HADDE_2809', help: 'SAP sipariş açıklamasına yazdığın not: kime ait, hangi proje' },
    { k: 'firma_id', l: 'Cari (firma)', t: 'ref', ref: 'firmalar' },
    { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler' },
    { k: 'net_deger', l: 'Net değer', t: 'num' },
    { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['USD', 'TRY', 'EUR'] },
    { k: 'teslim_tarihi', l: 'Teslim tarihi', t: 'date' },
    { k: 'belge_no', l: 'Satış belgesi', help: 'SAP belge numarası' },
    { k: 'drv', l: 'Kanal', t: 'chk', cl: 'Drv üzerinden' },
    { k: 'rapor_disi', l: 'Rapor', t: 'chk', cl: 'Çeyrek toplamlarına katma (iade, iptal, mükerrer…)' },
  ]},
  { title: 'Sipariş notu', note: 'Siparişin içeriğinde özel ya da ekstra olması gerekenler: özel renk sıcaklığı, optik, kablo boyu, montaj aparatı, etiket, teslim şartı…', fields: [
    { k: 'siparis_notu', l: 'Sipariş notu', t: 'area', rows: 4, full: true },
  ]},
];
export function siparisForm(init = {}) {
  const s0 = init.id ? byId('siparisler', init.id) : { tarih: today(), para_birimi: 'USD', drv: true, rapor_disi: false, ...init, _new: true };
  if (!s0) return;
  const s = { ...s0 };
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${s._new ? 'Yeni sipariş' : 'Sipariş no ' + esc(s.siparis_no || '—') + ' · ' + tarih(s.tarih)}</p><h2 id="drawer-title">${esc(s.referans || s.musteri_adi || 'Sipariş')}</h2>
      ${s._new ? '' : `<div class="dh-meta"><span><b>${num(s.net_deger)} ${esc(s.para_birimi)}</b></span><span>${esc(s.musteri_adi || '')}</span>${s.rapor_disi ? '<span class="neg">rapor dışı</span>' : ''}</div>`}</div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${s._new ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>'}
    <form class="dbody form" novalidate>${renderForm(SIPARIS_FORM, s)}
      ${s._new ? '' : `<details><summary>SAP'den gelen bilgiler</summary><dl class="kv-list"><dt>Cari adı (SAP)</dt><dd>${esc(s.musteri_adi || '—')}</dd><dt>Cari no</dt><dd>${esc(s.musteri_no || '—')}</dd><dt>Belge türü</dt><dd>${esc(s.belge_turu || '—')}</dd><dt>SAP proje tanımı</dt><dd>${esc(s.proje_tanimi || '—')}</dd></dl></details>`}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`, { wide: true });
  const form = panel.querySelector('form'); bindForm(form, SIPARIS_FORM, s);
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { if (!confirmBox('Sipariş silinsin mi? SAP listesini yeniden yüklersen tekrar gelir; yalnızca toplamlardan çıkarmak istiyorsan “Çeyrek toplamlarına katma”yı işaretle.')) return; await app.db.del('siparisler', s.id); toast('Sipariş silindi.'); closeDrawer(); app.refresh(); });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, SIPARIS_FORM, s);
      if (!o.tarih) return toast('Sipariş tarihini yaz.', 'err');
      if (o.net_deger == null) return toast('Tutarı yaz.', 'err');
      if (o.firma_id && (s._new || o.firma_id !== s0.firma_id)) o.musteri_adi = firmaAd(o.firma_id);
      if (o.proje_id && !o.proje_tanimi) o.proje_tanimi = byId('projeler', o.proje_id)?.ad;
      await app.db.save('siparisler', o); toast('Sipariş kaydedildi.'); closeDrawer(); app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

// Çeyrek özeti: siparişlerden hesaplanan ile resmi (dönemsel tablo) rakamların karşılaştırması
function ceyrekOzeti(box, Y, yenile) {
  const G = [1, 2, 3, 4].map(c => ceyrekGercek(Y, c));
  const top = k => G.reduce((a, g) => a + (+g[k] || 0), 0);
  const fark = v => v == null ? '—' : `<span class="${Math.abs(v) < 1 ? '' : v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${usd(v)}</span>`;
  box.innerHTML = `<div class="card ceyrek-ozet"><div class="card-h"><h2>${Y} çeyrek özeti</h2><button type="button" class="btn sm primary" data-duz>Hedef ve resmi rakamları düzenle</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${G.map((_, i) => `<th class="r">${i + 1}. çeyrek</th>`).join('')}<th class="r">Yıl</th></tr></thead><tbody>
      <tr><td>Hedef</td>${G.map(g => `<td class="r num">${g.hedef ? usd(g.hedef) : '—'}</td>`).join('')}<td class="r num"><b>${usd(top('hedef'))}</b></td></tr>
      <tr><td>Siparişlerden (USD)</td>${G.map(g => `<td class="r num">${usd(g.usd)}</td>`).join('')}<td class="r num">${usd(top('usd'))}</td></tr>
      <tr><td>Siparişlerden (TL)</td>${G.map(g => `<td class="r num">${g.tl ? num(g.tl) + ' ₺' : '—'}</td>`).join('')}<td class="r num">${top('tl') ? num(top('tl')) + ' ₺' : '—'}</td></tr>
      <tr><td>Siparişlerden toplam (USD)<small>TL, çeyreğin kuruyla çevrilir</small></td>${G.map(g => `<td class="r num"><b>${usd(g.siparis)}</b><small>${g.adet} sipariş${g.haric ? ` · ${g.haric} rapor dışı` : ''}</small></td>`).join('')}<td class="r num"><b>${usd(top('siparis'))}</b></td></tr>
      <tr><td>Resmi rakam (USD)<small>dönemsel tablodaki</small></td>${G.map(g => `<td class="r num">${g.resmi != null ? `<b>${usd(g.resmi)}</b><small>${usd(+g.resmiUsd || 0)}${+g.resmiTl ? ` + ${num(g.resmiTl)} ₺` : ''}</small>` : '—'}</td>`).join('')}<td class="r num">${G.some(g => g.resmi != null) ? '<b>' + usd(G.reduce((a, g) => a + (g.resmi ?? 0), 0)) + '</b>' : '—'}</td></tr>
      <tr class="em"><td>Fark (resmi − sipariş)</td>${G.map(g => `<td class="r num">${fark(g.fark)}</td>`).join('')}<td class="r num">${G.some(g => g.fark != null) ? fark(G.reduce((a, g) => a + (g.fark ?? 0), 0)) : '—'}</td></tr>
      <tr><td>Raporlarda kullanılan</td>${G.map(g => `<td class="r num"><b>${usd(g.gercek)}</b><small>${g.kaynak === 'resmi' ? 'resmi rakam' : 'siparişlerden'}${g.hedef ? ' · %' + num(Math.round(g.gercek / g.hedef * 100)) : ''}</small></td>`).join('')}<td class="r num"><b>${usd(top('gercek'))}</b></td></tr>
      <tr><td>Kur (TL/USD)</td>${G.map(g => `<td class="r num">${g.kur ? num(g.kur) : '—'}</td>`).join('')}<td></td></tr>
    </tbody></table></div>
    <p class="hint">Resmi rakamı girdiğin çeyrekte panel, tahmin ve PowerPoint sunumu resmi rakamı kullanır; girmezsen siparişlerden hesaplanır. Fark çıkan çeyrekte sipariş listesini o çeyreğe göre filtreleyip eksik siparişi ekleyebilir, tarihini düzeltebilir ya da iade / iptal edilenleri “rapor dışı” yapabilirsin.</p>
    ${G.map((g, i) => g.not ? `<p class="hint"><b>${i + 1}. çeyrek notu:</b> ${esc(g.not)}</p>` : '').join('')}
    <div class="btnrow">${G.map((g, i) => `<button type="button" class="btn sm ghost" data-cq="${i + 1}">${i + 1}. çeyrek siparişleri</button>`).join('')}</div></div>`;
  box.querySelector('[data-duz]').onclick = () => hedefForm(Y);
  box.querySelectorAll('[data-cq]').forEach(b => b.onclick = () => { const f = F('siparisler', {}); f.gor = 'liste'; f.ceyrek = b.dataset.cq; f.yil = Y; saveFilters(); app.refresh(); });
}

export function hedefForm(Y) {
  const v = (c, k) => { const h = hedefKaydi(Y, c); return h?.[k] ?? ''; };
  const k0 = kur()?.USD ? Math.round(kur().USD * 10000) / 10000 : '';
  const panel = openDrawer(`<header class="dh"><div><p class="muted">Satış hedefleri ve resmi rakamlar</p><h2 id="drawer-title">${Y} çeyrekleri</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form"><p class="hint">Resmi rakam: şirketin dönemsel tablosundaki toplam USD ve TL satış. Boş bırakılan çeyrekte gerçekleşen siparişlerden hesaplanır. TL satış, girdiğin kurla dolara çevrilir.</p>
      ${[1, 2, 3, 4].map(c => `<fieldset class="fs"><legend>${c}. çeyrek</legend><div class="grid">
        <div class="fld"><label for="h${c}">Hedef (USD)</label><input id="h${c}" data-k="tutar_usd" data-c="${c}" type="number" inputmode="decimal" step="any" value="${v(c, 'tutar_usd')}"></div>
        <div class="fld"><label for="ru${c}">Resmi USD satış</label><input id="ru${c}" data-k="resmi_usd" data-c="${c}" type="number" inputmode="decimal" step="any" value="${v(c, 'resmi_usd')}"></div>
        <div class="fld"><label for="rt${c}">Resmi TL satış</label><input id="rt${c}" data-k="resmi_tl" data-c="${c}" type="number" inputmode="decimal" step="any" value="${v(c, 'resmi_tl')}"></div>
        <div class="fld"><label for="k${c}">Kur (TL/USD)</label><input id="k${c}" data-k="kur" data-c="${c}" type="number" inputmode="decimal" step="any" value="${v(c, 'kur')}" placeholder="${k0}"></div>
        <div class="fld full"><label for="n${c}">Not</label><input id="n${c}" data-k="notlar" data-c="${c}" value="${esc(v(c, 'notlar'))}" placeholder="Örn. 2 sipariş Nisan faturasına kaydı"></div></div></fieldset>`).join('')}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`, { wide: true });
  panel.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    for (const c of [1, 2, 3, 4]) {
      const o = { ...(hedefKaydi(Y, c) || {}), yil: Y, ceyrek: c };
      panel.querySelectorAll(`[data-c="${c}"]`).forEach(i => { const x = i.value.trim(); o[i.dataset.k] = i.dataset.k === 'notlar' ? (x || null) : (x === '' ? null : parseFloat(x)); });
      if (hedefKaydi(Y, c) || ['tutar_usd', 'resmi_usd', 'resmi_tl', 'kur', 'notlar'].some(k => o[k] != null)) await app.db.save('hedefler', o);
    }
    toast('Çeyrek rakamları kaydedildi.'); closeDrawer(); app.refresh();
  };
}

const normName = s => fold(s || '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export function projeBul(tanim) {
  const k = normName(tanim); if (!k || k.includes('genel proje')) return null;
  return S.projeler.find(p => normName(p.ad) === k) || S.projeler.find(p => { const pk = normName(p.ad); return pk.length >= 6 && k.length >= 6 && (pk.startsWith(k) || k.startsWith(pk)); }) || null;
}

async function siparisYukle() {
  const [file] = await pickFiles({ accept: '.xls,.xlsx', multiple: false });
  if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.some(c => /sipariş no|satış belgesi/i.test(String(c || ''))));
    if (hi < 0) return toast('“Müşteri Sipariş No” başlığı bulunamadı. SAP sipariş listesini seç.', 'err');
    const h = rows[hi].map(c => String(c || '').trim());
    const c = n => h.findIndex(x => x.toLocaleLowerCase('tr').startsWith(n));
    const C = { no: c('müşteri sipariş'), belge: c('satış belgesi'), tur: c('belge türü'), mno: c('müşteri'), mad: c('müşteri adı'), tar: c('yaratma'), tes: c('teslimat'), ref: c('müşteri referans'), net: c('net değer'), pb: c('belge para'), pt: c('proje tanım') };
    C.mno = h.findIndex(x => x === 'Müşteri');
    const dt = v => v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : (typeof v === 'string' && /\d{2}\.\d{2}\.\d{4}/.test(v) ? v.split('.').reverse().join('-') : null);
    const byBelge = new Map(S.siparisler.map(s => [s.belge_no + '|' + s.siparis_no, s]));
    const drv = S.firmalar.find(x => /^drv/i.test(x.ad));
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      if (!r[C.belge] && !r[C.mad]) continue;
      const mad = r[C.mad] ? String(r[C.mad]).trim() : null;
      const isDrv = !!mad && /^drv/i.test(mad);
      const fm = mad && (isDrv ? drv : S.firmalar.find(x => normName(x.ad) === normName(mad)));
      const pt = r[C.pt] ? String(r[C.pt]).trim() : null;
      const key = String(r[C.belge] ?? '') + '|' + String(r[C.no] ?? '');
      const ex = byBelge.get(key);
      out.push({ ...(ex || { id: uuid() }), siparis_no: r[C.no] != null ? String(r[C.no]) : null, belge_no: r[C.belge] != null ? String(r[C.belge]) : null, belge_turu: r[C.tur], musteri_no: r[C.mno] != null ? String(r[C.mno]) : null,
        musteri_adi: mad, firma_id: fm?.id || ex?.firma_id || null, tarih: dt(r[C.tar]) || dt(r[C.tes]), teslim_tarihi: dt(r[C.tes]), referans: r[C.ref], net_deger: +r[C.net] || 0, para_birimi: r[C.pb] || 'USD', proje_tanimi: pt,
        proje_id: ex?.proje_id || projeBul(pt)?.id || null, drv: isDrv });
    }
    const yeni = out.filter(o => !byBelge.has(o.belge_no + '|' + o.siparis_no)).length;
    await app.db.bulk('siparisler', out);
    toast(`${out.length} sipariş okundu, ${yeni} yeni kayıt eklendi.`); app.refresh();
    yuklemeKaydet(file, 'SAP sipariş listesi', `${out.length} sipariş, ${yeni} yeni`);
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
}
