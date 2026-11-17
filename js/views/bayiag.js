// Bayi ve partner: ağdaki her bayiyi ayrı izlemek. Atama kartı (tür, bölge, sorumlu, koşullar, hedef), ağ listesi ve bayi karnesi.
// Bayi = bir firma kaydı + "bayiler" tablosunda atama. Satış (bize alım / sell-in): firmanın siparişleri, siparişte "bayi"
// olarak seçildiği siparişler ve ana bayi ise eski "ana bayi üzerinden" işaretli siparişler.
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, ACIK, pill, exportXlsx } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { ayar, ayarYaz } from '../ayar.js';
import { siparisUsd } from '../ceyrek.js';
import { kur } from '../kur.js';
import { firmaRiski, SEVIYE, usdYap } from '../vaderisk.js';
import { kalan } from './tahsilat.js';
import { anaBayi, anaBayiMi } from '../profil.js';
import { izin, sahipMi } from '../yetki.js';

export const BAYI_TURLERI = ['Bayi', 'Alt bayi', 'Distribütör', 'Çözüm ortağı', 'Proje ortağı'];
const DURUM = ['Aktif', 'Askıda', 'Ayrıldı'], DRENK = { Aktif: '#15803D', Askıda: '#C2410C', Ayrıldı: '#64748B' };
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const kimAd = e => !e ? '—' : (app.ekip || []).find(u => u.eposta?.toLowerCase() === e.toLowerCase())?.ad || (e.toLowerCase() === (app.db.user?.()?.email || '').toLowerCase() ? 'Sen' : e.split('@')[0]);
export const bayiAd = b => firmaAd(b?.firma_id) || 'Bayi';
export const bayiOf = fid => (S.bayiler || []).find(b => b.firma_id === fid) || null;

// ---------- Hesaplar ----------
export function bayiSiparisleri(b) {
  const ana = anaBayiMi(firmaAd(b.firma_id));
  return S.siparisler.filter(s => !s.rapor_disi && (s.firma_id === b.firma_id || s.bayi_id === b.firma_id || (ana && s.drv)));
}
export function bayiOzeti(b, Y = +today().slice(0, 4)) {
  const sip = bayiSiparisleri(b), k = kur()?.USD;
  const yilda = y => sip.filter(s => String(s.tarih || '').startsWith(String(y)));
  const satis = yilda(Y).reduce((a, s) => a + siparisUsd(s, k), 0), gecen = yilda(Y - 1).reduce((a, s) => a + siparisUsd(s, k), 0);
  const aylik = AYLAR.map((_, i) => yilda(Y).filter(s => +String(s.tarih).slice(5, 7) === i + 1).reduce((a, s) => a + siparisUsd(s, k), 0));
  const proj = S.projeler.filter(p => p.bayi_id === b.firma_id);
  const tah = S.tahsilatlar.filter(t => t.firma_id === b.firma_id && kalan(t) > 0);
  const stok = b.depo ? S.urunler.filter(u => u.depo === b.depo) : [];
  const bs = (S.bayi_stok || []).filter(s => s.firma_id === b.firma_id);
  const ziy = S.ziyaretler.filter(z => z.firma_id === b.firma_id && (z.durum || 'Yapıldı') === 'Yapıldı').sort((a, c) => (c.tarih || '').localeCompare(a.tarih || ''));
  return {
    satis, gecen, aylik, sipN: yilda(Y).length, hedef: +b.hedef_yil || 0, hedefYuzde: +b.hedef_yil ? Math.round(satis / b.hedef_yil * 100) : null,
    proj, acikProj: proj.filter(p => ACIK.includes(p.durum)), kazanilan: proj.filter(p => p.durum === 'Sipariş'), kayip: proj.filter(p => p.durum === 'Kayıp'),
    alacak: tah.reduce((a, t) => a + usdYap(kalan(t), t.para_birimi), 0), risk: firmaRiski(b.firma_id),
    stokKalem: stok.filter(u => +u.stok > 0).length + bs.filter(s => +s.adet > 0).length,
    stokDeger: stok.reduce((a, u) => a + (+u.stok || 0) * (+u.birim_fiyat_usd || 0), 0) + bs.reduce((a, s) => a + (+s.adet || 0) * (+s.birim_fiyat || +S.urunler.find(u => u.kod === s.kod)?.birim_fiyat_usd || 0), 0),
    sonZiyaret: ziy[0]?.tarih || null, ziy,
  };
}

// ---------- Atama formu ----------
const FORM = () => [{ title: 'Atama', fields: [
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar', full: true, req: true },
  { k: 'tur', l: 'Tür', t: 'sel', opts: BAYI_TURLERI },
  { k: 'durum', l: 'Durum', t: 'sel', opts: DURUM },
  { k: 'il', l: 'Ana il' },
  { k: 'bolge', l: 'Bölge / sorumlu olduğu iller', ph: 'ör. Adana, Osmaniye' },
  { k: 'sorumlu', l: 'Bizden sorumlu kişi', t: 'sel', opts: ['', ...(app.ekip || []).map(u => u.eposta), (app.db.user?.()?.email || '').toLowerCase()].filter((v, i, a) => a.indexOf(v) === i), ph: 'Seç' },
  { k: 'baslangic', l: 'Başlangıç', t: 'date' },
  { k: 'bitis', l: 'Sözleşme bitişi', t: 'date' },
]}, { title: 'Ticari koşullar ve hedef', fields: [
  { k: 'iskonto', l: 'İskonto (%)', t: 'num', help: 'Boş bırakılırsa firmanın cari bilgisindeki değer geçerli' },
  { k: 'vade_gun', l: 'Ödeme vadesi (gün)', t: 'num' },
  { k: 'kredi_limiti', l: 'Kredi limiti', t: 'num' },
  { k: 'para_birimi', l: 'Para birimi', t: 'sel', ph: 'Firmadaki', opts: ['USD', 'EUR', 'TRY'] },
  { k: 'hedef_yil', l: 'Yıllık satış hedefi (USD)', t: 'num' },
  { k: 'depo', l: 'Stok deposu adı', help: 'Eski tek depolu stok listesinde bu bayinin deposunun adı; yalnızca eski stoğu bayiye taşırken eşleştirme için kullanılır.' },
  { k: 'notlar', l: 'Not', t: 'area', rows: 2, full: true },
]}];
export function bayiAtamaFormu(init = {}, sonra) {
  const b0 = init.id ? (S.bayiler || []).find(x => x.id === init.id) : { tur: 'Bayi', durum: 'Aktif', para_birimi: 'USD', baslangic: today(), ...(init.firma_id ? bayiOf(init.firma_id) || {} : {}), ...init };
  const yeni = !b0.id;
  const b = { ...b0 }; if (b.firma_id && !b.il) b.il = byId('firmalar', b.firma_id)?.il || '';
  const fm = FORM();
  const p = openDrawer(`<header class="dh"><div><p class="muted">Bayi ve partner</p><h2 id="drawer-title">${yeni ? 'Bayi / partner ata' : esc(bayiAd(b))}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${yeni ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-kaldir>Atamayı kaldır</button></div>'}
    <form class="dbody form" novalidate>${renderForm(fm, b)}<p class="hint">Bayinin kendi kullanıcısı Şirket profili → Kullanıcılar'da "Dış kullanıcı" olarak eklenir; yalnızca kendi firmasının kayıtlarını görür.</p>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, fm, b);
  p.querySelector('[data-kaldir]')?.addEventListener('click', async () => { if (!confirmBox('Bayi ataması kaldırılsın mı? Firma kaydı ve siparişleri kalır.')) return; await app.db.del('bayiler', b0.id); toast('Atama kaldırıldı.'); closeDrawer(); (sonra || app.refresh)?.(); });
  form.onsubmit = async e => {
    e.preventDefault();
    const o = await readForm(form, fm, b);
    if (!o.firma_id) return toast('Firmayı seç.', 'err');
    const var_ = bayiOf(o.firma_id); if (var_ && var_.id !== b0.id) return toast('Bu firma zaten atanmış; kaydını düzenle.', 'err');
    await app.db.save('bayiler', { ...b0, ...o });
    // Ticari koşulların asıl yeri firmanın cari kaydı: firmada boşsa bayi kartında girilen değer firmaya da yazılır
    const fr = byId('firmalar', o.firma_id || b0.firma_id), ek = {};
    if (fr) { for (const k of KOSUL) if (o[k] != null && o[k] !== '' && (fr[k] == null || fr[k] === '')) ek[k] = o[k]; if (Object.keys(ek).length) try { await app.db.save('firmalar', { ...fr, ...ek }); } catch {} }
    const f = byId('firmalar', o.firma_id);
    if (f && !(f.tipler || []).includes('Bayi') && ['Bayi', 'Alt bayi', 'Distribütör'].includes(o.tur)) await app.db.save('firmalar', { ...f, tipler: [...(f.tipler || []), 'Bayi'] });
    if (ayar('bayi_agi') !== true && sahipMi()) await ayarYaz('bayi_agi', true);
    toast(yeni ? 'Bayi atandı.' : 'Kaydedildi.'); closeDrawer(); (sonra || app.refresh)?.();
  };
}

// ---------- Ağ ----------
// Ticari koşul: bayi kartında girildiyse o, yoksa firmanın cari bilgisi (tek kaynak firmadır)
const KOSUL = ['iskonto', 'vade_gun', 'kredi_limiti', 'para_birimi'];
export function bayiKosul(b, k) { const v = b?.[k]; if (v != null && v !== '') return v; const f = byId('firmalar', b?.firma_id)?.[k]; return f != null && f !== '' ? f : null; }
// Ağ haritası: konumu bilinen bayiler; nokta büyüklüğü yıl satışına, rengi türe göre
const TUR_RENK = ['#2a78d6', '#15803D', '#7C3AED', '#C2410C', '#0F766E', '#B91C1C', '#64748B'];
let agHarita = null;
async function agHaritasi(kutu, g) {
  if (!kutu) return;
  if (agHarita) { try { agHarita.remove(); } catch {} agHarita = null; }
  const nk = g.map(x => ({ ...x, f: byId('firmalar', x.b.firma_id) })).filter(x => x.f?.lat != null && x.f?.lng != null);
  if (typeof L === 'undefined' || !nk.length) { kutu.hidden = true; return; }
  kutu.hidden = false;
  agHarita = L.map(kutu, { zoomControl: true, attributionControl: false, maxZoom: 18 }).setView([nk[0].f.lat, nk[0].f.lng], 8);
  try { const { altlikKatmani } = await import('../altlik.js'); const { katman } = await altlikKatmani('osm'); katman.addTo(agHarita); } catch {}
  const max = Math.max(1, ...nk.map(x => x.o.satis));
  for (const x of nk) L.circleMarker([x.f.lat, x.f.lng], { radius: 6 + 12 * Math.sqrt(x.o.satis / max), color: '#fff', weight: 2, fillColor: TUR_RENK[Math.max(0, BAYI_TURLERI.indexOf(x.b.tur || 'Bayi')) % TUR_RENK.length], fillOpacity: 0.9 })
    .addTo(agHarita).bindPopup(`<b>${esc(bayiAd(x.b))}</b><br>${esc(x.b.tur || 'Bayi')}${x.b.bolge ? ' · ' + esc(x.b.bolge) : ''}<br>${usd(Math.round(x.o.satis))}${x.o.hedefYuzde != null ? ' · hedef %' + x.o.hedefYuzde : ''}`);
  if (nk.length > 1) agHarita.fitBounds(nk.map(x => [x.f.lat, x.f.lng]), { padding: [30, 30], maxZoom: 12 });
  setTimeout(() => agHarita?.invalidateSize(), 200);
}
export function bayiagView(el) {
  const f = F('bayiag', { q: '', tur: 'Tümü', durum: 'Aktif' });
  const yaz = sahipMi() || izin('bayiag') === 'yaz';
  const l = (S.bayiler || []).map(b => ({ b, o: bayiOzeti(b) }));
  const anaAd = anaBayi(), anaFirma = anaAd ? S.firmalar.find(x => anaBayiMi(x.ad)) : null, oneri = anaFirma && !bayiOf(anaFirma.id);
  el.innerHTML = `<header class="vh"><div><h1>Bayi ve partner ağı</h1><p class="sum" data-sum></p></div><div class="vh-act">${l.length ? '<button class="btn" data-xlsx>Excel</button>' : ''}${yaz ? '<button class="btn primary" data-ata>+ Bayi / partner ata</button>' : ''}</div></header>
    ${oneri && yaz ? `<section class="card bayi-oneri"><p><b>${esc(anaFirma.ad)}</b> şirket profilinde ana bayi olarak yazılı ama ağa atanmamış. Atarsan "ana bayi üzerinden" işaretli siparişler bu bayinin satışı sayılır.</p><div class="btnrow"><button class="btn primary sm" data-anaata>Bayi olarak ata</button></div></section>` : ''}
    <div class="frow"><input type="search" data-q placeholder="Bayi, il, sorumlu ara" value="${esc(f.q)}" aria-label="Ara">
      <select data-tur aria-label="Tür">${['Tümü', ...BAYI_TURLERI].map(t => `<option ${f.tur === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="Durum">${['Aktif', 'Tümü', 'Askıda', 'Ayrıldı'].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>
    <div data-l></div>`;
  const Y = +today().slice(0, 4);
  const ciz = () => {
    const g = l.filter(({ b }) => (f.tur === 'Tümü' || b.tur === f.tur) && (f.durum === 'Tümü' || (b.durum || 'Aktif') === f.durum) && match(f.q, bayiAd(b), b.il, b.bolge, kimAd(b.sorumlu), b.tur)).sort((a, c) => c.o.satis - a.o.satis);
    const top = g.reduce((a, x) => a + x.o.satis, 0);
    el.querySelector('[data-sum]').textContent = l.length ? `${g.length} bayi/partner · ${Y} satışı ${usd(Math.round(top))} · açık alacak ${usd(Math.round(g.reduce((a, x) => a + x.o.alacak, 0)))}` : '';
    const iller = {}; for (const { b } of g) { const k = b.il || byId('firmalar', b.firma_id)?.il || '—'; iller[k] = (iller[k] || 0) + 1; }
    el.querySelector('[data-l]').innerHTML = !l.length ? `<div class="empty"><p>Henüz bayi ya da partner atanmadı.</p><p class="hint">Bir firmayı bayi, alt bayi, distribütör ya da çözüm ortağı olarak ata: satışları, hedefi, stoğu ve cari bakiyesi ayrı izlenir.</p></div>`
      : `<div class="chips bayi-il">${Object.entries(iller).sort((a, c) => c[1] - a[1]).map(([il, n]) => `<span class="chip">${esc(il)} · ${n}</span>`).join('')}</div>
      <div class="ba-map" data-bmap aria-label="Bayi ağı haritası"></div>
      <div class="tbl-wrap"><table class="tbl bayi-t"><thead><tr><th>Bayi / partner</th><th>Tür</th><th>Bölge</th><th>Sorumlu</th><th class="r">${Y} satış</th><th class="r">Hedef</th><th class="r">Açık alacak</th><th class="r">Açık proje</th><th>Son ziyaret</th></tr></thead><tbody>
      ${g.map(({ b, o }) => `<tr data-bk="${b.id}" tabindex="0"><td><b>${esc(bayiAd(b))}</b> <span class="pill" style="--c:${DRENK[b.durum || 'Aktif']}">${esc(b.durum || 'Aktif')}</span>${o.risk?.seviye ? ` <em class="vr-rozet" style="--c:${SEVIYE[o.risk.seviye].c}">${SEVIYE[o.risk.seviye].ad}</em>` : ''}</td>
        <td>${esc(b.tur || 'Bayi')}</td><td>${esc([b.il, b.bolge].filter(Boolean).join(' · ') || byId('firmalar', b.firma_id)?.il || '')}</td><td>${esc(kimAd(b.sorumlu))}</td>
        <td class="r num">${usd(Math.round(o.satis))}${o.gecen ? `<small class="${o.satis >= o.gecen ? 'pos' : 'neg'}"> ${o.satis >= o.gecen ? '▲' : '▼'}${Math.abs(Math.round((o.satis - o.gecen) / o.gecen * 100))}%</small>` : ''}</td>
        <td class="r num">${o.hedefYuzde != null ? `<span class="hedef-r ${o.hedefYuzde >= 100 ? 'pos' : o.hedefYuzde < 50 ? 'neg' : ''}">%${o.hedefYuzde}</span>` : '—'}</td>
        <td class="r num ${o.risk?.gecikmis ? 'neg' : ''}">${o.alacak ? usd(Math.round(o.alacak)) : ''}</td><td class="r num">${o.acikProj.length || ''}</td><td>${o.sonZiyaret ? tarih(o.sonZiyaret) : '<span class="muted">hiç</span>'}</td></tr>`).join('')}</tbody></table></div>`;
    agHaritasi(el.querySelector('[data-bmap]'), g);
    el.querySelectorAll('[data-bk]').forEach(r => { const ac = () => { F('bayikarne', {}).id = r.dataset.bk; saveFilters(); location.hash = '#/bayikarne'; }; r.onclick = ac; r.onkeydown = e => { if (e.key === 'Enter') ac(); }; });
  };
  el.querySelector('[data-q]').oninput = e => { f.q = e.target.value; saveFilters(); ciz(); };
  el.querySelector('[data-tur]').onchange = e => { f.tur = e.target.value; saveFilters(); ciz(); };
  el.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { f.durum = x.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(y => y.classList.toggle('on', y === x)); ciz(); });
  el.querySelector('[data-ata]')?.addEventListener('click', () => bayiAtamaFormu({}, () => bayiagView(el)));
  el.querySelector('[data-anaata]')?.addEventListener('click', () => bayiAtamaFormu({ firma_id: anaFirma.id, tur: 'Bayi', depo: S.urunler.find(u => u.depo)?.depo || '' }, () => bayiagView(el)));
  el.querySelector('[data-xlsx]')?.addEventListener('click', () => exportXlsx(`bayi-agi-${today()}`, { 'Bayi ağı': l.map(({ b, o }) => ({ Bayi: bayiAd(b), Tür: b.tur, Durum: b.durum, İl: b.il, Bölge: b.bolge, Sorumlu: kimAd(b.sorumlu), [`${Y} satış (USD)`]: Math.round(o.satis), [`${Y - 1} satış (USD)`]: Math.round(o.gecen), 'Hedef (USD)': o.hedef || null, 'Hedef %': o.hedefYuzde, 'Açık alacak (USD)': Math.round(o.alacak), 'Açık proje': o.acikProj.length, 'Son ziyaret': o.sonZiyaret, İskonto: b.iskonto, Vade: b.vade_gun, 'Kredi limiti': b.kredi_limiti })) }));
  ciz();
}

// ---------- Bayi karnesi ----------
export function bayikarneView(el) {
  const f = F('bayikarne', { id: '' });
  const l = (S.bayiler || []).slice().sort((a, b) => bayiAd(a).localeCompare(bayiAd(b), 'tr'));
  if (!l.length) { el.innerHTML = `<header class="vh"><div><h1>Bayi karnesi</h1></div></header><div class="empty"><p>Önce Ağ'dan bir bayi ya da partner ata.</p><p><a class="btn" href="#/bayiag">Bayi ağı</a></p></div>`; return; }
  const b = l.find(x => x.id === f.id) || l[0], o = bayiOzeti(b), Y = +today().slice(0, 4), fr = byId('firmalar', b.firma_id);
  const max = Math.max(1, ...o.aylik), yaz = sahipMi() || izin('bayiag') === 'yaz';
  const kart = (ad, v, alt = '', cls = '') => `<div class="fn-kart ${cls}"><span>${ad}</span><b>${v}</b>${alt ? `<small>${alt}</small>` : ''}</div>`;
  const kayipMarka = {}; for (const p of o.kayip) if (p.rakip_marka) kayipMarka[p.rakip_marka] = (kayipMarka[p.rakip_marka] || 0) + 1;
  const kisiler = S.kisiler.filter(k => k.firma_id === b.firma_id).slice(0, 6);
  el.innerHTML = `<header class="vh"><div><p class="muted">Bayi karnesi</p><h1>${esc(bayiAd(b))}</h1><p class="sum">${esc([b.tur, b.durum, b.il, b.bolge, b.sorumlu ? 'sorumlu ' + kimAd(b.sorumlu) : ''].filter(Boolean).join(' · '))}</p></div>
    <div class="vh-act"><select data-bsec aria-label="Bayi seç">${l.map(x => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(bayiAd(x))}</option>`).join('')}</select>${yaz ? '<button class="btn" data-duz>Atamayı düzenle</button>' : ''}${fr ? `<a class="btn ghost" href="#/firma/${fr.id}">Firma sayfası</a>` : ''}</div></header>
    <div class="fn-kartlar">
      ${kart(`${Y} satış`, usd(Math.round(o.satis)), `${o.sipN} sipariş${o.gecen ? ` · ${Y - 1}: ${usd(Math.round(o.gecen))}` : ''}`)}
      ${kart('Hedef', o.hedef ? usd(Math.round(o.hedef)) : '—', o.hedefYuzde != null ? `%${o.hedefYuzde} gerçekleşti` : 'hedef girilmedi', o.hedefYuzde >= 100 ? 'ok' : '')}
      ${kart('Açık alacak', usd(Math.round(o.alacak)), o.risk?.metin || 'gecikme yok', o.risk?.gecikmis ? 'neg' : '')}
      ${kart('Projeler', `${o.acikProj.length} açık`, `${o.kazanilan.length} kazanılan · ${o.kayip.length} kaybedilen`)}
      ${kart('Stok', o.stokKalem ? usd(Math.round(o.stokDeger)) : '—', o.stokKalem ? `${o.stokKalem} kalem${b.depo ? ' · depo ' + esc(b.depo) : ''} · <a href="#/bayistok">Stoklar</a>` : 'stok kaydı yok · <a href="#/bayistok">Stoklar</a>')}
      ${kart('Son ziyaret', o.sonZiyaret ? tarih(o.sonZiyaret) : 'hiç', `${o.ziy.length} ziyaret`)}
    </div>
    <section class="card"><h2>${Y} aylık satış (bize alım)</h2><div class="fn-grafik bk-grafik">${o.aylik.map((v, i) => `<div class="fn-ay"><div class="fn-cub"><i class="fn-b satis" style="height:${Math.max(v ? 2 : 0, v / max * 100)}%;width:60%" title="${AYLAR[i]}: ${usd(Math.round(v))}"></i></div><small>${AYLAR[i]}</small></div>`).join('')}</div></section>
    <div class="bk-izgara">
      <section class="card"><h2>Üzerinden giden projeler <span class="muted">${o.proj.length}</span></h2>${o.proj.length ? `<ul class="list">${o.proj.sort((a, c) => ACIK.includes(c.durum) - ACIK.includes(a.durum) || (+c.tutar_usd || 0) - (+a.tutar_usd || 0)).slice(0, 10).map(p => `<li><a href="#/proje/${p.id}" class="grow"><b>${esc(p.ad)}</b><span class="muted">${usd(p.tutar_usd)}${p.durum === 'Kayıp' && p.rakip_marka ? ' · ' + esc(p.rakip_marka) : ''}</span></a>${pill(p.durum)}</li>`).join('')}</ul>${Object.keys(kayipMarka).length ? `<p class="hint">Kaybedilen markalar: ${Object.entries(kayipMarka).map(([m, n]) => esc(m) + ' ' + n).join(' · ')}</p>` : ''}` : '<p class="hint">Bu bayiye bağlı proje yok. Projede "Bayi" alanını seçince burada görünür.</p>'}</section>
      <section class="card"><h2>Koşullar</h2><dl class="profil-dl">${[['İskonto', bayiKosul(b, 'iskonto') != null ? '%' + num(bayiKosul(b, 'iskonto')) : ''], ['Ödeme vadesi', bayiKosul(b, 'vade_gun') ? bayiKosul(b, 'vade_gun') + ' gün' : ''], ['Kredi limiti', bayiKosul(b, 'kredi_limiti') ? num(bayiKosul(b, 'kredi_limiti')) + ' ' + (bayiKosul(b, 'para_birimi') || 'USD') : ''], ['Başlangıç', b.baslangic ? tarih(b.baslangic) : ''], ['Sözleşme bitişi', b.bitis ? tarih(b.bitis) + (b.bitis < today() ? ' (doldu)' : '') : '']].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('') || '<dt>—</dt><dd>Koşul girilmedi</dd>'}</dl>${bayiKosul(b, 'kredi_limiti') && o.alacak > +bayiKosul(b, 'kredi_limiti') ? '<p class="warn">Açık alacak kredi limitini aşıyor.</p>' : ''}${b.notlar ? `<p>${esc(b.notlar)}</p>` : ''}</section>
      <section class="card"><h2>Son ziyaretler</h2>${o.ziy.length ? `<ul class="list">${o.ziy.slice(0, 5).map(z => `<li><span class="grow"><b>${tarih(z.tarih)}</b><span class="muted">${esc([z.amac, z.sonuc_tipi, (z.notlar || '').slice(0, 80)].filter(Boolean).join(' · '))}</span></span></li>`).join('')}</ul>` : '<p class="hint">Ziyaret yok.</p>'}</section>
      <section class="card"><h2>Kişiler</h2>${kisiler.length ? `<ul class="list">${kisiler.map(k => `<li><a href="#/kisi/${k.id}" class="grow"><b>${esc(k.ad_soyad)}</b><span class="muted">${esc(k.unvan || '')}</span></a>${k.telefon ? `<a class="btn sm ghost" href="tel:${esc(k.telefon)}">Ara</a>` : ''}</li>`).join('')}</ul>` : '<p class="hint">Kişi yok.</p>'}</section>
    </div>`;
  el.querySelector('[data-bsec]').onchange = e => { f.id = e.target.value; saveFilters(); bayikarneView(el); };
  el.querySelector('[data-duz]')?.addEventListener('click', () => bayiAtamaFormu({ id: b.id }, () => bayikarneView(el)));
}
