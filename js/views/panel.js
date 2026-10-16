import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, num, tarih, today, DURUMLAR, ACIK, byId, firmaAd, match, toast, exportXlsx, pickFiles, fold, durumRenk, openDrawer, closeDrawer, pill } from '../ui.js';
import { gorevForm } from './ziyaret.js';
import { renderForm, bindForm, readForm } from '../forms.js';

const q = d => Math.floor((new Date(d).getMonth()) / 3) + 1;
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);

export function panelView(el) {
  const f = F('panel', { yil: 2026 });
  const Y = +f.yil;
  const sip = S.siparisler.filter(s => s.tarih && s.tarih.startsWith(String(Y)) && s.para_birimi === 'USD');
  const hed = [1, 2, 3, 4].map(c => +(S.hedefler.find(h => h.yil === Y && h.ceyrek === c)?.tutar_usd || 0));
  const gercek = [1, 2, 3, 4].map(c => sum(sip.filter(s => q(s.tarih) === c), s => s.net_deger));
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

  el.innerHTML = `<header class="vh"><div><h1>Panel</h1><p class="sum">${Y} yılı, bugün ${tarih(t)}</p></div>
    <div class="vh-act"><label>Yıl <select data-yil>${[2025, 2026, 2027].map(y => `<option ${y === Y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div></header>
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
      <p class="legend-line"><span class="sw target"></span>Hedef <span class="sw real"></span>Gerçekleşen (USD siparişler) · <a href="#/siparisler">Siparişler ve hedefler</a></p></section>
    <section class="card"><h2>Durumlara göre projeler (${Y})</h2>
      <ul class="hbars">${DURUMLAR.map(d => { const ps = yP.filter(p => p.durum === d.k); return ps.length ? `<li><span>${d.k}</span><span class="hb"><i style="width:${ps.length / durumMax * 100}%;--c:${d.c}"></i></span><b>${ps.length}</b><small>${usd(sum(ps, p => p.tutar_usd))}</small></li>` : ''; }).join('')}</ul></section>
    <section class="card"><h2>Kayıplar: hangi markaya?</h2>
      ${Object.keys(markalar).length ? `<table class="tbl"><thead><tr><th>Marka</th><th class="r">Proje</th><th class="r">Bizim teklif</th><th class="r">Rakip</th></tr></thead><tbody>${Object.entries(markalar).sort((a, b) => b[1].n - a[1].n).map(([m, v]) => `<tr><td>${esc(m)}</td><td class="r">${v.n}</td><td class="r">${usd(v.biz)}</td><td class="r">${v.rakip ? usd(v.rakip) : '—'}</td></tr>`).join('')}</tbody></table>
      <p class="hint">Nedenler: ${Object.entries(nedenler).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}</p>` : '<p class="hint">Bu yıl kayıp proje yok.</p>'}</section>
    <section class="card"><h2>Yaklaşan beklenen siparişler</h2>
      ${beklenen.length ? `<ul class="list">${beklenen.map(p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${tarih(p.beklenen_tarih)} · ${usd(p.tutar_usd)}</span></a>${pill(p.durum)}</li>`).join('')}</ul>` : '<p class="hint">Beklenen sipariş tarihi girilmiş açık proje yok.</p>'}</section>
    <section class="card"><h2>Açık görevler</h2>
      ${gorev.length ? `<ul class="list">${gorev.map(g => `<li class="${g.son_tarih && g.son_tarih < t ? 'late' : ''}"><button type="button" class="linkbtn" data-g="${g.id}">${esc(g.baslik)}</button><span class="muted">${tarih(g.son_tarih)}</span></li>`).join('')}</ul>` : '<p class="hint">Açık görev yok.</p>'}
      <p><a href="#/gorevler">Tüm görevler</a></p></section>
    <section class="card"><h2>En çok çalıştığın firmalar (${Y})</h2>
      ${topFirma.length ? `<table class="tbl"><thead><tr><th>Firma</th><th>Rol</th><th class="r">Proje</th><th class="r">Sipariş</th><th class="r">Kayıp</th></tr></thead><tbody>${topFirma.map(([id, v]) => `<tr><td><a href="#/firma/${id}">${esc(firmaAd(id))}</a></td><td>${v.rol}</td><td class="r">${v.n}</td><td class="r">${v.w}</td><td class="r">${v.l}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Veri yok.</p>'}</section>
    <section class="card wide"><h2>Toplantı sunumu tabloları</h2>
      <p class="hint">Çeyrek ve yarı dönem sunumlarındaki tablo düzeninde Excel dosyası indirir; satırları sunuma kopyalayabilirsin.</p>
      <div class="btnrow"><button class="btn" data-s="kayip">Kayıp projeler</button><button class="btn" data-s="pot">Potansiyel projeler (${Y})</button><button class="btn" data-s="str">${Y + 1} potansiyel ve stratejik projeler</button><button class="btn ghost" data-s="hedef">Hedef proje listesi</button></div></section>
  </div>`;
  el.querySelector('[data-yil]').onchange = e => { f.yil = +e.target.value; saveFilters(); panelView(el); };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.g }));
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => sunum(b.dataset.s, Y));
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
export function siparislerView(el) {
  const f = F('siparisler', { q: '', yil: 2026, ceyrek: 'Tümü', kanal: 'Tümü', cari: 'Tümü', gor: 'liste' });
  const cariler = [...new Set(S.siparisler.map(s => s.musteri_adi).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  el.innerHTML = `<header class="vh"><div><h1>Siparişler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn ghost" data-hedef>Hedefleri düzenle</button><button class="btn primary" data-up>Sipariş Excel'i yükle</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Cari, proje, SAS no, referans ara" value="${esc(f.q)}" aria-label="Siparişlerde ara">
      <div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="liste" class="${f.gor === 'liste' ? 'on' : ''}">Sipariş listesi</button><button type="button" data-gor="cari" class="${f.gor === 'cari' ? 'on' : ''}">Cari bazında</button><button type="button" data-gor="proje" class="${f.gor === 'proje' ? 'on' : ''}">Proje bazında</button></div>
      <div class="frow"><label>Yıl <select data-k="yil">${[2025, 2026, 2027].map(y => `<option ${y == f.yil ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label>Çeyrek <select data-k="ceyrek">${['Tümü', '1', '2', '3', '4'].map(c => `<option value="${c}" ${String(f.ceyrek) === c ? 'selected' : ''}>${c === 'Tümü' ? 'Tümü' : c + '. çeyrek'}</option>`).join('')}</select></label>
      <label>Kanal <select data-k="kanal">${['Tümü', 'Drv', 'Drv harici'].map(c => `<option ${f.kanal === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Cari <select data-k="cari"><option>Tümü</option>${cariler.map(c => `<option ${f.cari === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div></div>
    <div class="ptable-wrap" data-rows></div>`;
  const pAd = s => s.proje_id ? (byId('projeler', s.proje_id)?.ad || s.proje_tanimi) : s.proje_tanimi;
  const list = () => S.siparisler.filter(s => s.tarih && s.tarih.startsWith(String(f.yil)) && (f.ceyrek === 'Tümü' || q(s.tarih) == f.ceyrek) && (f.kanal === 'Tümü' || (f.kanal === 'Drv') === !!s.drv)
    && (f.cari === 'Tümü' || s.musteri_adi === f.cari) && match(f.q, s.musteri_adi, s.proje_tanimi, pAd(s), s.referans, s.belge_no, s.siparis_no))
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
  const tut = s => `${num(s.net_deger)} ${s.para_birimi === 'USD' ? '$' : esc(s.para_birimi)}`;
  const grupla = (l, key) => { const g = new Map(); for (const s of l) { const k = key(s) || '—'; const r = g.get(k) || { k, n: 0, usd: 0, tl: 0, son: '', ids: new Set(), cari: new Set() }; r.n++; if (s.para_birimi === 'USD') r.usd += +s.net_deger || 0; else r.tl += +s.net_deger || 0; if (s.tarih > r.son) r.son = s.tarih; if (s.proje_id) r.ids.add(s.proje_id); if (s.musteri_adi) r.cari.add(s.musteri_adi); g.set(k, r); } return [...g.values()].sort((a, b) => b.usd - a.usd); };
  const draw = () => {
    const l = list();
    const u = sum(l.filter(s => s.para_birimi === 'USD'), s => s.net_deger), tl = sum(l.filter(s => s.para_birimi !== 'USD'), s => s.net_deger);
    el.querySelector('[data-sum]').innerHTML = `${l.length} sipariş · ${new Set(l.map(s => s.musteri_adi)).size} cari · <b>${usd(u)}</b>${tl ? ` + ${num(tl)} TL` : ''}`;
    const box = el.querySelector('[data-rows]');
    if (!l.length) { box.innerHTML = '<div class="empty"><p>Bu filtrelerde sipariş yok. SAP sipariş listesini “Sipariş Excel\'i yükle” ile ekleyebilirsin.</p></div>'; return; }
    if (f.gor === 'liste') {
      box.innerHTML = `<table class="ptable otable"><thead><tr><th>Tarih</th><th>SAS no</th><th>Cari</th><th>Proje</th><th>Müşteri referansı</th><th class="r">Net değer</th></tr></thead><tbody>${l.map(s => `<tr data-sid="${s.id}" tabindex="0">
        <td data-l="Tarih" class="nowrap">${tarih(s.tarih)}</td>
        <td data-l="SAS no" class="num nowrap"><b>${esc(s.belge_no || '—')}</b>${s.siparis_no ? `<small>Sipariş ${esc(s.siparis_no)}</small>` : ''}</td>
        <td data-l="Cari">${s.firma_id ? `<a href="#/firma/${s.firma_id}" class="flink">${esc(s.musteri_adi || '')}</a>` : esc(s.musteri_adi || '—')}${s.drv ? ' <em class="flag soft">Drv</em>' : ''}</td>
        <td data-l="Proje">${s.proje_id ? `<a href="#/proje/${s.proje_id}" class="flink">${esc(pAd(s))}</a>` : `<span class="muted">${esc(s.proje_tanimi || '—')}</span> <small class="muted">projeye bağlı değil</small>`}</td>
        <td data-l="Referans" class="muted">${esc(s.referans || '—')}</td>
        <td data-l="Net değer" class="r num nowrap"><b>${tut(s)}</b></td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('tr[data-sid]').forEach(tr => { tr.onclick = e => { if (!e.target.closest('a')) siparisDetay(tr.dataset.sid); }; tr.onkeydown = e => { if (e.key === 'Enter') siparisDetay(tr.dataset.sid); }; });
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
  el.querySelector('[data-hedef]').onclick = () => hedefForm(+f.yil);
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`siparisler-${today()}.xlsx`, { 'Siparişler': list().map(s => ({ 'Tarih': s.tarih, 'SAS no': s.belge_no, 'Müşteri sipariş no': s.siparis_no, 'Cari': s.musteri_adi, 'Cari no': s.musteri_no, 'Proje': pAd(s), 'Müşteri referansı': s.referans, 'Net değer': s.net_deger, 'Para birimi': s.para_birimi, 'Drv': s.drv ? 'Evet' : '' })) });
  draw();
}

// Siparişi bir projeye bağla
function siparisDetay(id) {
  const s = byId('siparisler', id); if (!s) return;
  const FORM = [{ title: 'Sipariş', fields: [{ k: 'proje_id', l: 'Bağlı proje', t: 'ref', ref: 'projeler', full: true, help: 'Proje adını yaz ve listeden seç. Boş bırakırsan bağlantı kalkar.' }] }];
  const panel = openDrawer(`<header class="dh"><div><p class="muted">SAS no ${esc(s.belge_no || '—')} · ${tarih(s.tarih)}</p><h2 id="drawer-title">${esc(s.musteri_adi || 'Sipariş')}</h2>
      <div class="dh-meta"><span><b>${num(s.net_deger)} ${esc(s.para_birimi)}</b></span>${s.drv ? '<span>Drv</span>' : ''}</div></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate><dl class="kv-list"><dt>Müşteri sipariş no</dt><dd>${esc(s.siparis_no || '—')}</dd><dt>Cari no</dt><dd>${esc(s.musteri_no || '—')}</dd><dt>Belge türü</dt><dd>${esc(s.belge_turu || '—')}</dd>
      <dt>Müşteri referansı</dt><dd>${esc(s.referans || '—')}</dd><dt>SAP proje tanımı</dt><dd>${esc(s.proje_tanimi || '—')}</dd><dt>Teslim tarihi</dt><dd>${tarih(s.teslim_tarihi)}</dd></dl>
      ${renderForm(FORM, s)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, FORM, s);
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FORM, s); await app.db.save('siparisler', o); toast('Sipariş güncellendi.'); closeDrawer(); app.refresh(); };
}

function hedefForm(Y) {
  const panel = openDrawer(`<header class="dh"><h2 id="drawer-title">${Y} satış hedefleri (USD)</h2><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form"><div class="grid">${[1, 2, 3, 4].map(c => `<div class="fld"><label for="h${c}">${c}. çeyrek</label><input id="h${c}" type="number" inputmode="decimal" value="${S.hedefler.find(h => h.yil === Y && h.ceyrek === c)?.tutar_usd ?? ''}"></div>`).join('')}</div>
    <div class="dfoot"><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  panel.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    for (const c of [1, 2, 3, 4]) { const v = parseFloat(panel.querySelector('#h' + c).value); const ex = S.hedefler.find(h => h.yil === Y && h.ceyrek === c); if (!isNaN(v)) await app.db.save('hedefler', { ...(ex || {}), yil: Y, ceyrek: c, tutar_usd: v }); }
    toast('Hedefler kaydedildi.'); closeDrawer(); app.refresh();
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
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
}
