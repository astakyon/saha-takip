// Finans (2. aşama): çek ve senet portföyü, 13 haftalık nakit akışı, satış primi ve kişi hedefleri, banka ekstresini açık faturalarla eşleştirme.
import { S } from '../db.js';
import { cariIste } from '../zorunlu.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, gunEkle, byId, firmaAd, fold, match, toast, openDrawer, closeDrawer, confirmBox, pickFiles, exportXlsx, xlsxYukle } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { ayar, ayarYaz } from '../ayar.js';
import { usdYap } from '../vaderisk.js';
import { kalan, para } from './tahsilat.js';
import { siparisUsd } from '../ceyrek.js';
import { kur } from '../kur.js';
import { sahipMi, izin } from '../yetki.js';

const yaz = t => sahipMi() || izin(t) === 'yaz';
const tamUsd = v => usd(Math.round(v || 0));
const pazartesi = d => { const x = new Date(d + 'T00:00'); const g = (x.getDay() + 6) % 7; x.setDate(x.getDate() - g); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const kisaGun = d => new Date(d + 'T00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

// ---------- Çek ve senet ----------
export const CEK_DURUM = { Alınan: ['Portföyde', 'Bankada tahsilde', 'Tahsil edildi', 'Ciro edildi', 'Karşılıksız', 'İade'], Verilen: ['Ödenecek', 'Ödendi', 'İade'] };
const ACIK_CEK = ['Portföyde', 'Bankada tahsilde', 'Ödenecek'];
export const cekAcik = c => ACIK_CEK.includes(c.durum || (c.yon === 'Verilen' ? 'Ödenecek' : 'Portföyde'));
const cekForm = c => [{ title: 'Belge', fields: [
  { k: 'yon', l: 'Yön', t: 'sel', opts: ['Alınan', 'Verilen'] }, { k: 'tur', l: 'Tür', t: 'sel', opts: ['Çek', 'Senet'] },
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar', full: true }, { k: 'kesideci', l: 'Keşideci / borçlu (firmada yoksa)' },
  { k: 'belge_no', l: 'Çek / senet no' }, { k: 'banka', l: 'Banka / şube' },
  { k: 'tarih', l: 'Alınış / veriliş tarihi', t: 'date' }, { k: 'vade', l: 'Vade', t: 'date', req: true },
  { k: 'tutar', l: 'Tutar', t: 'num', req: true }, { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['TRY', 'USD', 'EUR'] },
  { k: 'durum', l: 'Durum', t: 'sel', opts: [...new Set([...CEK_DURUM.Alınan, ...CEK_DURUM.Verilen])] }, { k: 'ciro', l: 'Ciro edildiyse kime' },
  { k: 'notlar', l: 'Not', t: 'area', rows: 2, full: true }] }];
export function cekFormu(init = {}, sonra) {
  const c = init.id ? { ...S.cekler.find(x => x.id === init.id) } : { yon: 'Alınan', tur: 'Çek', tarih: today(), para_birimi: 'TRY', durum: 'Portföyde', ...init };
  const FM = cekForm(c);
  const p = openDrawer(`<header class="dh"><div><p class="muted">Çek ve senet</p><h2 id="drawer-title">${c.id ? esc([c.tur, c.belge_no].filter(Boolean).join(' ')) : 'Yeni çek / senet'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${c.id ? '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>' : ''}<form class="dbody form" novalidate>${renderForm(FM, c)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, c);
  p.querySelector('[data-sil]')?.addEventListener('click', async () => { if (!confirmBox('Silinsin mi?')) return; await app.db.del('cekler', c.id); closeDrawer(); sonra?.(); });
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, c); if (!o.vade || !(o.tutar > 0)) return toast('Vade ve tutarı yaz.', 'err');
    if (o.firma_id && (!c.id || o.firma_id !== c.firma_id) && (o.yon || c.yon) !== 'Verilen' && !(await cariIste(o.firma_id, 'cek'))) return;
    if (o.yon === 'Verilen' && CEK_DURUM.Alınan.includes(o.durum) && !CEK_DURUM.Verilen.includes(o.durum)) o.durum = 'Ödenecek';
    await app.db.save('cekler', { ...c, ...o }); toast('Kaydedildi.'); closeDrawer(); sonra?.(); };
}
export function ceklerView(el) {
  if (!S.cekler) { el.innerHTML = `<header class="vh"><div><h1>Çek ve senet</h1></div></header><div class="empty"><p>Bu ekran için veritabanı güncellemesi gerekiyor (schema.sql, sürüm 42).</p></div>`; return; }
  const f = F('cekler', { yon: 'Alınan', durum: 'acik', q: '' });
  el.innerHTML = `<header class="vh"><div><h1>Çek ve senet</h1><p class="sum" data-sum></p></div><div class="vh-act">${yaz('cekler') ? '<button class="btn primary" data-yeni>+ Çek / senet</button>' : ''}<button class="btn ghost" data-xlsx>Excel</button></div></header>
    <div class="frow"><div class="seg" role="group" aria-label="Yön">${['Alınan', 'Verilen'].map(y => `<button type="button" data-yon="${y}" class="${f.yon === y ? 'on' : ''}">${y}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Durum">${[['acik', 'Açık'], ['hepsi', 'Hepsi']].map(([k, t]) => `<button type="button" data-d="${k}" class="${f.durum === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <input type="search" data-q value="${esc(f.q)}" placeholder="Firma, no, banka" aria-label="Ara"></div><div data-l></div>`;
  const ciz = () => {
    const l = S.cekler.filter(c => (c.yon || 'Alınan') === f.yon && (f.durum === 'hepsi' || cekAcik(c)) && match(f.q, firmaAd(c.firma_id), c.kesideci, c.belge_no, c.banka)).sort((a, b) => (a.vade || '').localeCompare(b.vade || ''));
    const acik = S.cekler.filter(c => (c.yon || 'Alınan') === f.yon && cekAcik(c)), t = today();
    const top = acik.reduce((a, c) => a + usdYap(c.tutar, c.para_birimi || 'TRY'), 0), gecen = acik.filter(c => c.vade < t);
    el.querySelector('[data-sum]').textContent = `${f.yon === 'Alınan' ? 'Portföyde' : 'Ödenecek'} ${acik.length} belge · ~${tamUsd(top)}${gecen.length ? ` · ${gecen.length} vadesi geçmiş` : ''}`;
    el.querySelector('[data-l]').innerHTML = l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vade</th><th>Tür</th><th>Firma</th><th>No · banka</th><th class="r">Tutar</th><th>Durum</th></tr></thead><tbody>${l.map(c => { const g = cekAcik(c) && c.vade < t;
      return `<tr data-cek="${c.id}" tabindex="0" class="tikla"><td>${tarih(c.vade)}${g ? ' <em class="flag">geçti</em>' : ''}</td><td>${esc(c.tur || 'Çek')}</td><td>${esc(firmaAd(c.firma_id) || c.kesideci || '—')}</td><td>${esc([c.belge_no, c.banka].filter(Boolean).join(' · '))}</td><td class="r num">${para(c.tutar, c.para_birimi || 'TRY')}</td><td>${esc(c.durum || '')}${c.ciro ? ' → ' + esc(c.ciro) : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><p>${f.yon === 'Alınan' ? 'Müşteriden alınan' : 'Tedarikçiye verilen'} açık çek / senet yok.</p></div>`;
    el.querySelectorAll('[data-cek]').forEach(r => r.onclick = () => yaz('cekler') && cekFormu({ id: r.dataset.cek }, ciz));
  };
  el.querySelectorAll('[data-yon]').forEach(b => b.onclick = () => { f.yon = b.dataset.yon; saveFilters(); ceklerView(el); });
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); ceklerView(el); });
  el.querySelector('[data-q]').oninput = e => { f.q = e.target.value; saveFilters(); ciz(); };
  el.querySelector('[data-yeni]')?.addEventListener('click', () => cekFormu({ yon: f.yon, durum: f.yon === 'Verilen' ? 'Ödenecek' : 'Portföyde' }, ciz));
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`cek-senet-${today()}`, { 'Çek ve senet': S.cekler.map(c => ({ Yön: c.yon, Tür: c.tur, Firma: firmaAd(c.firma_id) || c.kesideci, No: c.belge_no, Banka: c.banka, Tarih: c.tarih, Vade: c.vade, Tutar: +c.tutar || 0, 'Para birimi': c.para_birimi, Durum: c.durum, Ciro: c.ciro })) });
  ciz();
}

// ---------- Nakit akışı (13 hafta) ----------
export function nakitAkisi(hafta = 13) {
  const bas = pazartesi(today()), t = today(), H = [];
  for (let i = 0; i < hafta; i++) { const b = gunEkle(bas, i * 7); H.push({ bas: b, son: gunEkle(b, 6), giris: 0, cikis: 0, kalem: [] }); }
  const koy = (d, v, yon, ad) => { let i = d < bas ? 0 : Math.floor((new Date(d + 'T00:00') - new Date(bas + 'T00:00')) / (7 * 864e5)); if (i >= hafta || i < 0) return; H[i][yon] += v; H[i].kalem.push({ ad, v, yon, d }); };
  for (const x of S.tahsilatlar || []) { const k = kalan(x); if (k > 0) koy(x.vade || t, usdYap(k, x.para_birimi), 'giris', `${firmaAd(x.firma_id) || x.cari || 'Fatura'} ${x.belge_no || ''}`.trim()); }
  for (const c of S.cekler || []) if (cekAcik(c) && c.vade) koy(c.vade, usdYap(c.tutar, c.para_birimi || 'TRY'), c.yon === 'Verilen' ? 'cikis' : 'giris', `${c.tur || 'Çek'} ${firmaAd(c.firma_id) || c.kesideci || ''}`.trim());
  // Masraf: son 90 günün haftalık ortalaması (TL → USD)
  const m90 = (S.masraflar || []).filter(m => m.tarih >= gunEkle(t, -90) && m.onay !== 'Reddedildi').reduce((a, m) => a + (+m.tutar || 0), 0), k = kur()?.USD;
  const haftalikMasraf = k ? m90 / k / 13 : 0;
  const sabit = +ayar('nakit_sabit_gider', 0) || 0;
  for (const h of H) { if (haftalikMasraf) { h.cikis += haftalikMasraf; h.kalem.push({ ad: 'Masraf (son 90 gün ortalaması)', v: haftalikMasraf, yon: 'cikis' }); } if (sabit) { h.cikis += sabit; h.kalem.push({ ad: 'Sabit gider', v: sabit, yon: 'cikis' }); } }
  let bakiye = +ayar('nakit_bakiye', 0) || 0;
  for (const h of H) { bakiye += h.giris - h.cikis; h.bakiye = bakiye; }
  return { H, baslangic: +ayar('nakit_bakiye', 0) || 0, haftalikMasraf, sabit };
}
export function nakitView(el) {
  const n = nakitAkisi(), max = Math.max(1, ...n.H.flatMap(h => [h.giris, h.cikis]));
  const eksi = n.H.find(h => h.bakiye < 0);
  el.innerHTML = `<header class="vh"><div><h1>Nakit akışı</h1><p class="sum">Önümüzdeki 13 hafta · yaklaşık USD</p></div><div class="vh-act">${sahipMi() ? '<button class="btn ghost" data-bakiye>Başlangıç bakiyesi ve sabit gider</button>' : ''}<button class="btn ghost" data-xlsx>Excel</button></div></header>
    <div class="fn-kartlar"><div class="fn-kart"><span>Beklenen giriş</span><b>${tamUsd(n.H.reduce((a, h) => a + h.giris, 0))}</b><small>açık faturalar + alınan çekler</small></div><div class="fn-kart"><span>Beklenen çıkış</span><b>${tamUsd(n.H.reduce((a, h) => a + h.cikis, 0))}</b><small>verilen çekler + masraf${n.sabit ? ' + sabit gider' : ''}</small></div>
      <div class="fn-kart ${eksi ? 'neg' : 'ok'}"><span>13. hafta sonu</span><b>${tamUsd(n.H.at(-1).bakiye)}</b><small>${eksi ? kisaGun(eksi.bas) + ' haftasında eksiye düşüyor' : 'başlangıç ' + tamUsd(n.baslangic)}</small></div></div>
    <section class="card"><p class="cg-leg"><span><i class="fn-b tahsil"></i>Giriş</span><span><i class="fn-b masraf"></i>Çıkış</span></p>
      <div class="fn-grafik nk-grafik" role="img" aria-label="Haftalık giriş ve çıkış">${n.H.map(h => `<div class="fn-ay"><div class="fn-cub"><i class="fn-b tahsil" style="height:${h.giris ? Math.max(2, h.giris / max * 100) : 0}%"></i><i class="fn-b masraf" style="height:${h.cikis ? Math.max(2, h.cikis / max * 100) : 0}%"></i></div><small>${kisaGun(h.bas)}</small></div>`).join('')}</div></section>
    <div class="tbl-wrap"><table class="tbl nk-t"><thead><tr><th>Hafta</th><th class="r">Giriş</th><th class="r">Çıkış</th><th class="r">Net</th><th class="r">Bakiye</th></tr></thead><tbody>${n.H.map((h, i) => `<tr data-h="${i}" class="tikla"><td>${kisaGun(h.bas)} – ${kisaGun(h.son)}${i === 0 ? ' <small class="muted">(gecikmişler dahil)</small>' : ''}</td><td class="r num">${h.giris ? tamUsd(h.giris) : ''}</td><td class="r num">${h.cikis ? tamUsd(h.cikis) : ''}</td><td class="r num ${h.giris - h.cikis < 0 ? 'neg' : 'pos'}">${tamUsd(h.giris - h.cikis)}</td><td class="r num ${h.bakiye < 0 ? 'neg' : ''}"><b>${tamUsd(h.bakiye)}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Giriş: vadesine göre açık faturaların kalanı (vadesi geçmişler ilk haftada) ve portföydeki alınan çek/senetler. Çıkış: verilen çek/senetler, son 90 günün haftalık masraf ortalaması${n.sabit ? ' ve haftalık sabit gider' : ''}. Satıra dokununca kalemler açılır.</p>`;
  el.querySelectorAll('[data-h]').forEach(r => r.onclick = () => { const h = n.H[+r.dataset.h];
    openDrawer(`<header class="dh"><div><p class="muted">Nakit akışı</p><h2 id="drawer-title">${kisaGun(h.bas)} – ${kisaGun(h.son)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><div class="dbody"><ul class="list">${h.kalem.sort((a, b) => b.v - a.v).map(k => `<li><span class="grow">${esc(k.ad)}${k.d ? ` <small class="muted">${tarih(k.d)}</small>` : ''}</span><b class="num ${k.yon === 'cikis' ? 'neg' : 'pos'}">${k.yon === 'cikis' ? '−' : '+'}${tamUsd(k.v)}</b></li>`).join('') || '<li>Kalem yok</li>'}</ul></div>`); });
  el.querySelector('[data-bakiye]')?.addEventListener('click', async () => {
    const b = prompt('Bugünkü nakit + banka bakiyesi (USD karşılığı):', n.baslangic || ''); if (b == null) return;
    const s = prompt('Haftalık sabit gider (kira, maaş vb., USD; yoksa boş bırak):', n.sabit || ''); if (s == null) return;
    await ayarYaz('nakit_bakiye', +String(b).replace(',', '.') || 0); await ayarYaz('nakit_sabit_gider', +String(s).replace(',', '.') || 0); nakitView(el); });
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`nakit-akisi-${today()}`, { 'Nakit akışı': n.H.map(h => ({ 'Hafta başı': h.bas, 'Giriş (USD)': Math.round(h.giris), 'Çıkış (USD)': Math.round(h.cikis), 'Bakiye (USD)': Math.round(h.bakiye) })) });
}

// ---------- Satış primi ve kişi hedefleri ----------
const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const kisiler = () => [...new Set([ben(), ...(app.ekip || []).filter(u => u.aktif !== false && !u.dis_firma_id).map(u => (u.eposta || '').toLowerCase())].filter(Boolean))];
const adOf = e => e === ben() ? 'Ben' : (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === e)?.ad || e.split('@')[0];
export const satisPrimKurali = () => ({ esik: 100, oran: 1, tahsilat: false, ...(ayar('satis_prim') || {}) });
export function primTablosu(Y, c = 0) {
  const kural = satisPrimKurali(), hedefler = ayar('kisi_hedef') || {}, k = kur()?.USD;
  const icinde = d => String(d || '').startsWith(String(Y)) && (!c || Math.ceil(+String(d).slice(5, 7) / 3) === c);
  return kisiler().map(e => {
    const sip = (S.siparisler || []).filter(s => !s.rapor_disi && icinde(s.tarih) && (s.sorumlu ? s.sorumlu.toLowerCase() === e : e === ben()));
    const satis = sip.reduce((a, s) => a + siparisUsd(s, k), 0);
    const tah = (S.tahsilatlar || []).filter(t => (t.sorumlu ? t.sorumlu.toLowerCase() === e : e === ben()) && icinde(t.odeme_tarihi)).reduce((a, t) => a + usdYap(t.odenen, t.para_birimi), 0);
    const yh = +hedefler[e]?.[Y] || 0, hedef = c ? yh / 4 : yh, taban = kural.tahsilat ? tah : satis;
    const yuzde = hedef ? satis / hedef * 100 : null;
    return { e, ad: adOf(e), satis, tah, hedef, yuzde, sipN: sip.length, prim: yuzde != null && yuzde >= kural.esik ? taban * kural.oran / 100 : 0 };
  }).sort((a, b) => (b.yuzde ?? -1) - (a.yuzde ?? -1) || b.satis - a.satis);
}
export function primView(el) {
  const f = F('prim', { yil: today().slice(0, 4), c: 0 }), Y = +f.yil, kural = satisPrimKurali();
  const l = primTablosu(Y, +f.c), yon = sahipMi();
  const tumu = yon ? l : l.filter(x => x.e === ben());
  el.innerHTML = `<header class="vh"><div><h1>Prim ve hedef</h1><p class="sum">${Y}${+f.c ? ' · ' + f.c + '. çeyrek' : ''} · kural: hedefin %${kural.esik}'ü ve üstünde ${kural.tahsilat ? 'tahsilatın' : 'satışın'} %${num(kural.oran)}'i</p></div>
    <div class="vh-act"><select data-yil aria-label="Yıl">${[0, 1].map(i => String(+today().slice(0, 4) - i)).map(y => `<option ${y === f.yil ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select data-c aria-label="Dönem"><option value="0">Bütün yıl</option>${[1, 2, 3, 4].map(c => `<option value="${c}" ${+f.c === c ? 'selected' : ''}>${c}. çeyrek</option>`).join('')}</select>${yon ? '<button class="btn ghost" data-kural>Prim kuralı</button>' : ''}<button class="btn ghost" data-xlsx>Excel</button></div></header>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Kişi</th><th class="r">Sipariş</th><th class="r">Satış</th><th class="r">Tahsilat</th><th class="r">Hedef</th><th class="r">Gerçekleşme</th><th class="r">Prim</th></tr></thead><tbody>
      ${tumu.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.ad)}</b></td><td class="r num">${x.sipN}</td><td class="r num">${tamUsd(x.satis)}</td><td class="r num">${x.tah ? tamUsd(x.tah) : ''}</td>
        <td class="r num">${yon ? `<input type="number" inputmode="decimal" class="bs-adet" data-kh="${esc(x.e)}" value="${(ayar('kisi_hedef') || {})[x.e]?.[Y] || ''}" placeholder="yıllık" aria-label="${esc(x.ad)} yıllık hedef">` : x.hedef ? tamUsd(x.hedef) : '—'}${+f.c && x.hedef ? `<small class="muted"> ç: ${tamUsd(x.hedef)}</small>` : ''}</td>
        <td class="r"><span class="hedef-bar"><i style="width:${Math.min(100, x.yuzde || 0)}%" class="${x.yuzde >= 100 ? 'ok' : x.yuzde < 50 ? 'neg' : ''}"></i></span>${x.yuzde != null ? '%' + Math.round(x.yuzde) : '—'}</td><td class="r num">${x.prim ? tamUsd(x.prim) : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Satış, siparişin sorumlusuna yazılır (sorumlusu boş siparişler şirket yetkilisine). Hedef yıllıktır; çeyrek seçilince dörtte biri kullanılır.${yon ? ' Hedefi tablodan girebilirsin.' : ''}</p>`;
  el.querySelector('[data-yil]').onchange = e => { f.yil = e.target.value; saveFilters(); primView(el); };
  el.querySelector('[data-c]').onchange = e => { f.c = +e.target.value; saveFilters(); primView(el); };
  el.querySelectorAll('[data-kh]').forEach(i => i.onchange = async () => { const h = { ...(ayar('kisi_hedef') || {}) }; h[i.dataset.kh] = { ...(h[i.dataset.kh] || {}), [Y]: +i.value || 0 }; await ayarYaz('kisi_hedef', h); toast('Hedef kaydedildi.'); primView(el); });
  el.querySelector('[data-kural]')?.addEventListener('click', async () => {
    const esik = prompt('Prim için hedefin yüzde kaçı gerçekleşmeli?', kural.esik); if (esik == null) return;
    const oran = prompt('Yüzde kaç prim?', kural.oran); if (oran == null) return;
    const tah = confirmBox('Prim tahsil edilen tutar üzerinden mi hesaplansın? (Tamam: tahsilat, İptal: satış)');
    await ayarYaz('satis_prim', { esik: +esik || 100, oran: +String(oran).replace(',', '.') || 0, tahsilat: tah }); primView(el); });
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`prim-${Y}${+f.c ? '-c' + f.c : ''}`, { Prim: tumu.map(x => ({ Kişi: x.ad, 'E-posta': x.e, Sipariş: x.sipN, 'Satış (USD)': Math.round(x.satis), 'Tahsilat (USD)': Math.round(x.tah), 'Hedef (USD)': Math.round(x.hedef) || null, 'Gerçekleşme %': x.yuzde != null ? Math.round(x.yuzde) : null, 'Prim (USD)': Math.round(x.prim) || null })) });
}

// ---------- Banka ekstresi eşleştirme ----------
// Ekstredeki her giriş tutarı için açık faturalar arasında aday arar: açıklamada firma adı geçiyorsa ve kalan tutar yakınsa güçlü aday.
const tlYap = (v, pb) => { const k = kur(); if (pb === 'TRY' || pb === 'TL' || !pb) return +v || 0; return k?.[pb] ? (+v || 0) * k[pb] : null; };
export function ekstreAdaylari(satir) {
  const ac = fold(satir.aciklama || ''), out = [];
  for (const t of S.tahsilatlar || []) {
    const k = kalan(t); if (!(k > 0)) continue;
    const ad = fold(firmaAd(t.firma_id) || t.cari || ''), kelime = ad.split(/\s+/).filter(w => w.length >= 4);
    const adUyar = kelime.length && kelime.filter(w => ac.includes(w)).length / kelime.length;
    const kTl = satir.pb === 'TRY' ? tlYap(k, t.para_birimi) : (t.para_birimi === satir.pb ? k : null);
    const fark = kTl ? Math.abs(kTl - satir.tutar) / kTl : 1;
    const belge = t.belge_no && ac.includes(fold(t.belge_no));
    const puan = (adUyar || 0) * 50 + (fark < 0.005 ? 40 : fark < 0.03 ? 25 : 0) + (belge ? 40 : 0);
    if (puan >= 40) out.push({ t, puan, kTl });
  }
  return out.sort((a, b) => b.puan - a.puan).slice(0, 5);
}
export function ekstreOku(rows) {
  const hi = rows.findIndex(r => r.some(c => /tutar|alacak|miktar/i.test(String(c || ''))) && r.some(c => /a[cç][iı]klama|detay/i.test(String(c || ''))));
  if (hi < 0) throw new Error('Başlıkta "Açıklama" ve "Tutar" (ya da "Alacak") sütunları bulunamadı.');
  const h = rows[hi].map(c => fold(c || '')), col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
  const cT = col(/tarih/), cA = col(/aciklama/, /detay/), cAl = col(/^alacak/, /gelen/), cTu = col(/tutar/, /miktar/), cPb = col(/doviz/, /para/);
  const sayi = v => typeof v === 'number' ? v : +String(v ?? '').replace(/\./g, '').replace(',', '.') || 0;
  const gun = v => { if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); } const m = String(v || '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : String(v || '').slice(0, 10) || today(); };
  return rows.slice(hi + 1).map(r => ({ tarih: gun(r[cT]), aciklama: String(r[cA] ?? '').trim(), tutar: cAl >= 0 ? sayi(r[cAl]) : sayi(r[cTu]), pb: cPb >= 0 && r[cPb] ? String(r[cPb]).toUpperCase().replace('TL', 'TRY') : 'TRY' })).filter(s => s.tutar > 0 && s.aciklama);
}
export function bankaView(el) {
  el.innerHTML = `<header class="vh"><div><h1>Banka ekstresi eşleştirme</h1><p class="sum">Bankadan indirdiğin hareket listesini (Excel) yükle; gelen ödemeler açık faturalarla eşleşsin.</p></div><div class="vh-act">${yaz('tahsilatlar') ? '<button class="btn primary" data-yukle>Ekstre yükle</button>' : ''}</div></header>
    <div data-l><div class="empty"><p>Ekstrede "Tarih", "Açıklama" ve "Tutar" (ya da "Alacak") sütunları olmalı. Dosya yalnızca bu cihazda okunur; ekstrenin kendisi kaydedilmez, yalnızca eşleştirdiğin ödemeler faturaya işlenir.</p></div></div>`;
  el.querySelector('[data-yukle]')?.addEventListener('click', async () => {
    const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
    try { await xlsxYukle(); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); ekstreCiz(el, ekstreOku(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }))); }
    catch (e) { toast('Ekstre okunamadı: ' + e.message, 'err'); }
  });
}
export function ekstreCiz(el, satirlar) {
  const l = satirlar.map(s => ({ s, ad: ekstreAdaylari(s) }));
  const kutu = el.querySelector('[data-l]');
  kutu.innerHTML = `<p class="hint">${l.length} giriş hareketi · ${l.filter(x => x.ad.length).length} için aday fatura bulundu. Doğru olanları seç ve "Eşleştir"e bas.</p>
    <div class="tbl-wrap"><table class="tbl bk-t"><thead><tr><th></th><th>Tarih</th><th>Açıklama</th><th class="r">Tutar</th><th>Fatura</th></tr></thead><tbody>${l.map((x, i) => `<tr><td><input type="checkbox" data-sec="${i}" ${x.ad[0]?.puan >= 80 ? 'checked' : ''} ${x.ad.length ? '' : 'disabled'} aria-label="Eşleştir"></td><td>${tarih(x.s.tarih)}</td><td>${esc(x.s.aciklama)}</td><td class="r num">${para(x.s.tutar, x.s.pb)}</td>
      <td>${x.ad.length ? `<select data-ad="${i}" aria-label="Fatura">${x.ad.map((a, j) => `<option value="${j}">${esc(firmaAd(a.t.firma_id) || a.t.cari || '')} · ${esc(a.t.belge_no || tarih(a.t.vade))} · kalan ${para(kalan(a.t), a.t.para_birimi)}${a.puan >= 80 ? ' ✓' : ''}</option>`).join('')}</select>` : '<span class="muted">aday yok</span>'}</td></tr>`).join('')}</tbody></table></div>
    <div class="frow"><button class="btn primary" data-esle>Seçilenleri eşleştir</button></div>`;
  kutu.querySelector('[data-esle]').onclick = async () => {
    const sec = [...kutu.querySelectorAll('[data-sec]:checked')].map(c => +c.dataset.sec); if (!sec.length) return toast('Seçili satır yok.', 'err');
    let n = 0;
    for (const i of sec) { const x = l[i], a = x.ad[+kutu.querySelector(`[data-ad="${i}"]`).value]; const t = S.tahsilatlar.find(y => y.id === a.t.id);
      const odeme = x.s.pb === (t.para_birimi || 'TRY') ? x.s.tutar : (a.kTl ? x.s.tutar / a.kTl * kalan(t) : 0);
      const yeni = Math.min(+t.tutar || 0, (+t.odenen || 0) + odeme);
      await app.db.save('tahsilatlar', { ...t, odenen: Math.round(yeni * 100) / 100, odeme_tarihi: x.s.tarih, notlar: [t.notlar, `Banka: ${x.s.tarih} ${x.s.aciklama.slice(0, 60)}`].filter(Boolean).join('\n') }); n++; }
    toast(`${n} ödeme faturaya işlendi.`); bankaView(el);
  };
}
