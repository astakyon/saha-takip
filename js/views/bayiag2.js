// Bayi ve partner (2. aşama): her bayinin ayrı stoğu, bayinin sattıkları (sell-out) ile bize alımı (sell-in), hedef ve prim, ağ analizi.
// Bayinin kendi kullanıcısı (dış kullanıcı) yalnızca kendi stoğunu ve satışlarını görür / girer (veritabanı kuralı).
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, gunEkle, byId, firmaAd, fold, match, toast, openDrawer, closeDrawer, confirmBox, pickFiles, exportXlsx, ACIK } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { ayar, ayarYaz } from '../ayar.js';
import { siparisUsd } from '../ceyrek.js';
import { kur } from '../kur.js';
import { usdYap, firmaRiski } from '../vaderisk.js';
import { profil } from '../profil.js';
import { izin, sahipMi, disKullanici } from '../yetki.js';
import { bayiAd, bayiOzeti, bayiSiparisleri } from './bayiag.js';

const yaz = r => sahipMi() || izin(r) === 'yaz';
const dis = () => disKullanici();
const bayiler = () => (S.bayiler || []).filter(b => (b.durum || 'Aktif') !== 'Ayrıldı').sort((a, b) => bayiAd(a).localeCompare(bayiAd(b), 'tr'));
// Seçili bayi: dış kullanıcıda her zaman kendi firması
function seciliBayi(f) {
  const d = dis(); if (d) return (S.bayiler || []).find(b => b.firma_id === d.firma_id) || { id: 'dis', firma_id: d.firma_id, tur: 'Bayi' };
  const l = bayiler(); return l.find(b => b.id === f.id) || l.find(b => b.id === F('bayikarne', {}).id) || l[0] || null;
}
const bayiSecici = (f, b) => dis() ? '' : `<select data-bsec aria-label="Bayi seç"><option value="*" ${f.id === '*' ? 'selected' : ''}>Bütün bayiler</option>${bayiler().map(x => `<option value="${x.id}" ${x.id === b?.id && f.id !== '*' ? 'selected' : ''}>${esc(bayiAd(x))}</option>`).join('')}</select>`;
const gunFark = d => d ? Math.round((new Date(today() + 'T00:00') - new Date(String(d).slice(0, 10) + 'T00:00')) / 864e5) : null;

// ---------- Stoklar ----------
// Bayinin stok satırları: bayi_stok tablosu + (atamada depo adı varsa) Stok ve fiyat listesindeki o deponun ürünleri
export function bayiStoklari(b) {
  const l = (S.bayi_stok || []).filter(s => s.firma_id === b.firma_id).map(s => ({ ...s, kaynak: 'bayi', fiyat: +s.birim_fiyat || +S.urunler.find(u => u.kod === s.kod)?.birim_fiyat_usd || 0 }));
  if (b.depo) for (const u of S.urunler.filter(u => u.depo === b.depo && !l.some(x => x.kod === u.kod))) l.push({ id: u.id, kod: u.kod, aciklama: u.aciklama, adet: +u.stok || 0, fiyat: +u.birim_fiyat_usd || 0, son_hareket: u.stok_tarihi || String(u.updated_at || '').slice(0, 10), kaynak: 'depo' });
  return l;
}
export function bayistokView(el) {
  const f = F('bayistok', { id: '', q: '', sadece: 'tum' });
  const b = seciliBayi(f);
  if (!b) { el.innerHTML = `<header class="vh"><div><h1>Bayi stokları</h1></div></header><div class="empty"><p>Önce Ağ'dan bir bayi ata.</p></div>`; return; }
  const hepsi = f.id === '*' && !dis();
  const satirlar = (hepsi ? bayiler() : [b]).flatMap(x => bayiStoklari(x).map(s => ({ ...s, bayi: x })));
  const yazabilir = yaz('bayistok') || !!dis();
  el.innerHTML = `<header class="vh"><div><h1>${hepsi ? 'Bütün bayilerin stoğu' : 'Stok · ' + esc(bayiAd(b))}</h1><p class="sum" data-sum></p></div>
    <div class="vh-act">${bayiSecici(f, b)}${yazabilir && !hepsi ? '<button class="btn" data-yukle>Excel\'den yükle</button><button class="btn primary" data-ekle>+ Ürün</button>' : ''}<button class="btn ghost" data-xlsx>Excel</button></div></header>
    <div class="frow"><input type="search" data-q value="${esc(f.q)}" placeholder="${hepsi ? 'Ürün kodu ya da adı: hangi bayide var?' : 'Ürün ara'}" aria-label="Ara">
      <div class="seg" role="group" aria-label="Göster">${[['tum', 'Tümü'], ['az', 'Az kalan'], ['olu', 'Hareketsiz (90+ gün)']].map(([k, t]) => `<button type="button" data-s="${k}" class="${f.sadece === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div data-l></div>`;
  const ciz = () => {
    const g = satirlar.filter(s => match(f.q, s.kod, s.aciklama, hepsi ? bayiAd(s.bayi) : '') && (f.sadece === 'tum' || (f.sadece === 'az' ? s.adet > 0 && s.adet <= 5 : gunFark(s.son_hareket) >= 90 && s.adet > 0)))
      .sort((a, c) => (c.adet * c.fiyat) - (a.adet * a.fiyat));
    const deger = g.reduce((a, s) => a + s.adet * s.fiyat, 0);
    el.querySelector('[data-sum]').textContent = `${g.filter(s => s.adet > 0).length} kalem · stok değeri ~${usd(Math.round(deger))} · ${g.filter(s => gunFark(s.son_hareket) >= 90 && s.adet > 0).length} hareketsiz`;
    el.querySelector('[data-l]').innerHTML = g.length ? `<div class="tbl-wrap"><table class="tbl bs-t"><thead><tr>${hepsi ? '<th>Bayi</th>' : ''}<th>Kod</th><th>Ürün</th><th class="r">Adet</th><th class="r">Değer</th><th>Son hareket</th></tr></thead><tbody>
      ${g.slice(0, 400).map(s => { const gun = gunFark(s.son_hareket); return `<tr>${hepsi ? `<td>${esc(bayiAd(s.bayi))}</td>` : ''}<td class="mono">${esc(s.kod)}</td><td>${esc(s.aciklama || '')}</td>
        <td class="r num">${yazabilir && !hepsi && s.kaynak === 'bayi' ? `<input type="number" inputmode="decimal" class="bs-adet" data-adet="${s.id}" value="${s.adet}" aria-label="${esc(s.kod)} adet">` : num(s.adet)}</td>
        <td class="r num">${s.fiyat ? usd(Math.round(s.adet * s.fiyat)) : ''}</td><td>${s.son_hareket ? tarih(s.son_hareket) : ''}${gun >= 90 && s.adet > 0 ? ` <em class="flag soft">${gun} gün hareketsiz</em>` : ''}${s.adet > 0 && s.adet <= 5 ? ' <em class="flag">az</em>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><p>${satirlar.length ? 'Süzgece uyan ürün yok.' : 'Bu bayinin stok kaydı yok.'}</p>${!satirlar.length && yazabilir && !hepsi ? '<p class="hint">Bayinin stok listesini Excel\'den yükle ya da ürün ekle. Atamada stok deposu adı girildiyse Stok ve fiyat listesindeki o deponun ürünleri de burada görünür.</p>' : ''}</div>`;
    el.querySelectorAll('[data-adet]').forEach(i => i.onchange = async () => { const s = S.bayi_stok.find(x => x.id === i.dataset.adet); const v = +i.value || 0; if (!s || v === +s.adet) return; await app.db.save('bayi_stok', { ...s, adet: v, son_hareket: today() }); toast(`${s.kod}: ${num(v)}`); });
  };
  el.querySelector('[data-q]').oninput = e => { f.q = e.target.value; saveFilters(); ciz(); };
  el.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { f.sadece = x.dataset.s; saveFilters(); el.querySelectorAll('[data-s]').forEach(y => y.classList.toggle('on', y === x)); ciz(); });
  el.querySelector('[data-bsec]')?.addEventListener('change', e => { f.id = e.target.value; saveFilters(); bayistokView(el); });
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`bayi-stok-${today()}`, { Stok: satirlar.map(s => ({ Bayi: bayiAd(s.bayi), Kod: s.kod, Ürün: s.aciklama, Adet: s.adet, 'Birim fiyat (USD)': s.fiyat || null, 'Değer (USD)': Math.round(s.adet * s.fiyat) || null, 'Son hareket': s.son_hareket })) });
  el.querySelector('[data-ekle]')?.addEventListener('click', () => stokSatirFormu(b, () => bayistokView(el)));
  el.querySelector('[data-yukle]')?.addEventListener('click', () => stokExcel(b, () => bayistokView(el)));
  ciz();
}
function stokSatirFormu(b, sonra) {
  const FM = [{ title: 'Ürün', fields: [{ k: 'kod', l: 'Ürün kodu', req: true }, { k: 'aciklama', l: 'Ürün adı' }, { k: 'adet', l: 'Adet', t: 'num' }, { k: 'birim_fiyat', l: 'Birim fiyat (USD)', t: 'num' }] }];
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(bayiAd(b))}</p><h2 id="drawer-title">Stoğa ürün</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><form class="dbody form" novalidate>${renderForm(FM, {})}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, {});
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, {}); if (!o.kod) return toast('Kodu yaz.', 'err'); const var_ = (S.bayi_stok || []).find(s => s.firma_id === b.firma_id && s.kod === o.kod);
    if (!o.aciklama) o.aciklama = S.urunler.find(u => u.kod === o.kod)?.aciklama || null;
    await app.db.save('bayi_stok', { ...(var_ || {}), firma_id: b.firma_id, ...o, son_hareket: today() }); toast('Kaydedildi.'); closeDrawer(); sonra?.(); };
}
async function stokExcel(b, sonra) {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    await (await import('../ui.js')).xlsxYukle();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.some(c => /kod/i.test(String(c || '')))); if (hi < 0) return toast('Başlıkta "Kod" sütunu bulunamadı.', 'err');
    const h = rows[hi].map(c => fold(c || '')), col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
    const cK = col(/kod/), cA = col(/aciklama/, /urun/, /ad/), cS = col(/stok/, /miktar/, /adet/), cF = col(/fiyat/);
    if (cS < 0) return toast('Başlıkta "Stok", "Miktar" ya da "Adet" sütunu bulunamadı.', 'err');
    const mevcut = new Map((S.bayi_stok || []).filter(s => s.firma_id === b.firma_id).map(s => [s.kod, s]));
    const kayit = [];
    for (const r of rows.slice(hi + 1)) {
      const kod = r[cK] != null ? String(r[cK]).trim() : ''; if (!kod) continue;
      const adet = typeof r[cS] === 'number' ? r[cS] : +String(r[cS] || '').replace(',', '.') || 0, eski = mevcut.get(kod);
      kayit.push({ ...(eski || {}), firma_id: b.firma_id, kod, aciklama: cA >= 0 && r[cA] ? String(r[cA]).trim() : eski?.aciklama || null, adet, birim_fiyat: cF >= 0 && typeof r[cF] === 'number' ? r[cF] : eski?.birim_fiyat ?? null, son_hareket: !eski || +eski.adet !== adet ? today() : eski.son_hareket || today() });
    }
    if (!kayit.length) return toast('Dosyada ürün satırı yok.', 'err');
    if (!confirmBox(`${bayiAd(b)} stoğu güncellensin mi? ${kayit.length} ürün (${kayit.filter(k => !mevcut.has(k.kod)).length} yeni).`)) return;
    for (const k of kayit) await app.db.save('bayi_stok', k);
    toast(`${kayit.length} ürün güncellendi.`); sonra?.();
  } catch (e) { toast('Dosya okunamadı: ' + e.message, 'err'); }
}

// ---------- Satışlar: bize alım (sell-in) ve bayinin sattıkları (sell-out) ----------
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const selloutUsd = s => usdYap(s.tutar, s.para_birimi || 'USD');
export function bayisatisView(el) {
  const f = F('bayisatis', { id: '', yil: today().slice(0, 4) });
  const b = seciliBayi(f);
  if (!b) { el.innerHTML = `<header class="vh"><div><h1>Bayi satışları</h1></div></header><div class="empty"><p>Önce Ağ'dan bir bayi ata.</p></div>`; return; }
  const hepsi = f.id === '*' && !dis(), grup = hepsi ? bayiler() : [b], k = kur()?.USD;
  const sin = grup.flatMap(x => bayiSiparisleri(x)).filter(s => String(s.tarih || '').startsWith(f.yil));
  const sout = (S.bayi_satis || []).filter(s => grup.some(x => x.firma_id === s.firma_id) && String(s.tarih || '').startsWith(f.yil));
  const aylik = AYLAR.map((a, i) => ({ a, in: sin.filter(s => +String(s.tarih).slice(5, 7) === i + 1).reduce((t, s) => t + siparisUsd(s, k), 0), out: sout.filter(s => +String(s.tarih).slice(5, 7) === i + 1).reduce((t, s) => t + selloutUsd(s), 0) }));
  const topIn = aylik.reduce((t, x) => t + x.in, 0), topOut = aylik.reduce((t, x) => t + x.out, 0);
  const stokDeger = grup.flatMap(bayiStoklari).reduce((t, s) => t + s.adet * s.fiyat, 0);
  const son90 = (S.bayi_satis || []).filter(s => grup.some(x => x.firma_id === s.firma_id) && s.tarih >= gunEkle(today(), -90)).reduce((t, s) => t + selloutUsd(s), 0);
  const devir = stokDeger ? son90 * 4 / stokDeger : null;
  const max = Math.max(1, ...aylik.flatMap(x => [x.in, x.out]));
  const aile = {}; for (const s of sout) { const a = S.urunler.find(u => u.kod === s.kod)?.aile || s.urun || 'Diğer'; aile[a] = (aile[a] || 0) + selloutUsd(s); }
  const yazabilir = yaz('bayisatis') || !!dis();
  el.innerHTML = `<header class="vh"><div><h1>${hepsi ? 'Bütün bayilerin satışı' : 'Satışlar · ' + esc(bayiAd(b))}</h1><p class="sum">${f.yil}</p></div>
    <div class="vh-act">${bayiSecici(f, b)}<select data-yil aria-label="Yıl">${[0, 1, 2].map(i => String(+today().slice(0, 4) - i)).map(y => `<option ${y === f.yil ? 'selected' : ''}>${y}</option>`).join('')}</select>${yazabilir && !hepsi ? '<button class="btn primary" data-sat>+ Satış bildir</button>' : ''}</div></header>
    <div class="fn-kartlar"><div class="fn-kart"><span>Bize alım (sell-in)</span><b>${usd(Math.round(topIn))}</b><small>${sin.length} sipariş</small></div><div class="fn-kart"><span>Bayinin sattığı (sell-out)</span><b>${usd(Math.round(topOut))}</b><small>${sout.length} bildirim</small></div>
      <div class="fn-kart"><span>Stok değeri</span><b>${stokDeger ? usd(Math.round(stokDeger)) : '—'}</b></div><div class="fn-kart"><span>Stok devir hızı</span><b>${devir != null ? devir.toFixed(1).replace('.', ',') + '×/yıl' : '—'}</b><small>son 90 gün satışına göre</small></div></div>
    <section class="card"><h2>Aylık</h2><p class="cg-leg"><span><i class="fn-b satis"></i>Bize alım</span><span><i class="fn-b tahsil"></i>Bayinin sattığı</span></p>
      <div class="fn-grafik">${aylik.map(x => `<div class="fn-ay"><div class="fn-cub"><i class="fn-b satis" style="height:${Math.max(x.in ? 2 : 0, x.in / max * 100)}%" title="Bize alım ${usd(Math.round(x.in))}"></i><i class="fn-b tahsil" style="height:${Math.max(x.out ? 2 : 0, x.out / max * 100)}%" title="Sattığı ${usd(Math.round(x.out))}"></i></div><small>${x.a}</small></div>`).join('')}</div></section>
    ${Object.keys(aile).length ? `<section class="card"><h2>Bayinin sattığı ürün aileleri</h2><ul class="list">${Object.entries(aile).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([a, v]) => `<li><span class="grow">${esc(a)}</span><b class="num">${usd(Math.round(v))}</b></li>`).join('')}</ul></section>` : ''}
    <section class="card"><h2>Satış bildirimleri <span class="muted">${sout.length}</span></h2>${sout.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tarih</th>${hepsi ? '<th>Bayi</th>' : ''}<th>Müşteri / proje</th><th>Ürün</th><th class="r">Adet</th><th class="r">Tutar</th></tr></thead><tbody>${sout.sort((a, c) => (c.tarih || '').localeCompare(a.tarih || '')).slice(0, 200).map(s => `<tr data-sid="${s.id}"><td>${tarih(s.tarih)}</td>${hepsi ? `<td>${esc(firmaAd(s.firma_id))}</td>` : ''}<td>${esc([s.musteri, byId('projeler', s.proje_id)?.ad, s.il].filter(Boolean).join(' · '))}</td><td>${esc([s.kod, s.urun].filter(Boolean).join(' · '))}</td><td class="r num">${s.adet ? num(s.adet) : ''}</td><td class="r num">${s.tutar ? num(s.tutar) + ' ' + esc(s.para_birimi || 'USD') : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Bayinin kendi müşterisine sattıklarını bayi kendi kullanıcısıyla ya da sen "Satış bildir" ile girersin.</p>'}</section>`;
  el.querySelector('[data-bsec]')?.addEventListener('change', e => { f.id = e.target.value; saveFilters(); bayisatisView(el); });
  el.querySelector('[data-yil]').onchange = e => { f.yil = e.target.value; saveFilters(); bayisatisView(el); };
  el.querySelector('[data-sat]')?.addEventListener('click', () => satisFormu(b, {}, () => bayisatisView(el)));
  el.querySelectorAll('[data-sid]').forEach(r => r.onclick = () => yazabilir && satisFormu(b, S.bayi_satis.find(x => x.id === r.dataset.sid), () => bayisatisView(el)));
}
function satisFormu(b, s0, sonra) {
  const FM = [{ title: 'Satış', fields: [{ k: 'tarih', l: 'Tarih', t: 'date' }, { k: 'musteri', l: 'Müşteri' }, { k: 'proje_id', l: 'Proje (varsa)', t: 'ref', ref: 'projeler' }, { k: 'il', l: 'İl' },
    { k: 'kod', l: 'Ürün kodu' }, { k: 'urun', l: 'Ürün / aile' }, { k: 'adet', l: 'Adet', t: 'num' }, { k: 'tutar', l: 'Tutar', t: 'num' }, { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['USD', 'EUR', 'TRY'] }, { k: 'notlar', l: 'Not', t: 'area', rows: 2, full: true }] }];
  const s = { tarih: today(), para_birimi: 'USD', ...(s0 || {}) };
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(bayiAd(b))} · bayinin sattığı</p><h2 id="drawer-title">${s0?.id ? 'Satış bildirimi' : 'Satış bildir'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${s0?.id ? '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>' : ''}<form class="dbody form" novalidate>${renderForm(FM, s)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, s);
  p.querySelector('[data-sil]')?.addEventListener('click', async () => { if (!confirmBox('Silinsin mi?')) return; await app.db.del('bayi_satis', s0.id); closeDrawer(); sonra?.(); });
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, s); if (!(o.tutar > 0) && !(o.adet > 0)) return toast('Adet ya da tutar yaz.', 'err'); await app.db.save('bayi_satis', { ...s, ...o, firma_id: b.firma_id }); toast('Kaydedildi.'); closeDrawer(); sonra?.(); };
}

// ---------- Hedef ve prim ----------
export const primKurali = () => ({ esik: 100, oran: 2, ...(ayar('bayi_prim') || {}) });
export function bayihedefView(el) {
  const f = F('bayihedef', { yil: today().slice(0, 4) });
  const Y = +f.yil, k = kur()?.USD, kural = primKurali();
  const buYil = Y === +today().slice(0, 4), gecen = buYil ? (new Date() - new Date(Y, 0, 1)) / (new Date(Y + 1, 0, 1) - new Date(Y, 0, 1)) : 1;
  const l = bayiler().map(b => { const sip = bayiSiparisleri(b).filter(s => String(s.tarih || '').startsWith(String(Y))); const satis = sip.reduce((a, s) => a + siparisUsd(s, k), 0);
    const c = [1, 2, 3, 4].map(q => sip.filter(s => Math.ceil(+String(s.tarih).slice(5, 7) / 3) === q).reduce((a, s) => a + siparisUsd(s, k), 0));
    const hedef = +b.hedef_yil || 0, yuzde = hedef ? satis / hedef * 100 : null, tahmin = buYil && gecen > 0.05 ? satis / gecen : satis;
    return { b, satis, c, hedef, yuzde, tahmin, tahminYuzde: hedef ? tahmin / hedef * 100 : null, prim: yuzde != null && yuzde >= kural.esik ? satis * kural.oran / 100 : 0 }; })
    .sort((a, c) => (c.yuzde ?? -1) - (a.yuzde ?? -1) || c.satis - a.satis);
  const yazabilir = sahipMi();
  el.innerHTML = `<header class="vh"><div><h1>Bayi hedef ve prim</h1><p class="sum">${Y} · prim kuralı: hedefin %${kural.esik}'ü ve üstünde satışın %${num(kural.oran)}'i</p></div>
    <div class="vh-act"><select data-yil aria-label="Yıl">${[0, 1, 2].map(i => String(+today().slice(0, 4) - i)).map(y => `<option ${y === f.yil ? 'selected' : ''}>${y}</option>`).join('')}</select>${yazabilir ? '<button class="btn ghost" data-kural>Prim kuralı</button>' : ''}<button class="btn ghost" data-xlsx>Excel</button></div></header>
    ${l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Bayi</th><th class="r">Ç1</th><th class="r">Ç2</th><th class="r">Ç3</th><th class="r">Ç4</th><th class="r">Yıl</th><th class="r">Hedef</th><th class="r">Gerçekleşme</th>${buYil ? '<th class="r">Yıl sonu tahmini</th>' : ''}<th class="r">Prim</th></tr></thead><tbody>
      ${l.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(bayiAd(x.b))}</b></td>${x.c.map(v => `<td class="r num">${v ? usd(Math.round(v)) : ''}</td>`).join('')}<td class="r num"><b>${usd(Math.round(x.satis))}</b></td><td class="r num">${x.hedef ? usd(Math.round(x.hedef)) : '—'}</td>
        <td class="r"><span class="hedef-bar"><i style="width:${Math.min(100, x.yuzde || 0)}%" class="${x.yuzde >= 100 ? 'ok' : x.yuzde < 50 ? 'neg' : ''}"></i></span>${x.yuzde != null ? '%' + Math.round(x.yuzde) : '—'}</td>${buYil ? `<td class="r num ${x.tahminYuzde != null && x.tahminYuzde < 100 ? 'neg' : ''}">${usd(Math.round(x.tahmin))}${x.tahminYuzde != null ? ` <small>(%${Math.round(x.tahminYuzde)})</small>` : ''}</td>` : ''}<td class="r num">${x.prim ? usd(Math.round(x.prim)) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>Atanmış bayi yok.</p></div>'}
    <p class="hint">Hedef, bayi atama kartındaki yıllık hedeftir. Yıl sonu tahmini, şu ana kadarki satışın yılın kalanına aynı hızla devam etmesi varsayımıdır.</p>`;
  el.querySelector('[data-yil]').onchange = e => { f.yil = e.target.value; saveFilters(); bayihedefView(el); };
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`bayi-hedef-${Y}`, { Hedef: l.map(x => ({ Bayi: bayiAd(x.b), 'Ç1': Math.round(x.c[0]), 'Ç2': Math.round(x.c[1]), 'Ç3': Math.round(x.c[2]), 'Ç4': Math.round(x.c[3]), 'Yıl (USD)': Math.round(x.satis), 'Hedef (USD)': x.hedef || null, 'Gerçekleşme %': x.yuzde != null ? Math.round(x.yuzde) : null, 'Prim (USD)': Math.round(x.prim) || null })) });
  el.querySelector('[data-kural]')?.addEventListener('click', async () => {
    const esik = prompt('Prim için hedefin yüzde kaçı gerçekleşmeli?', kural.esik); if (esik == null) return;
    const oran = prompt('Satışın yüzde kaçı prim olarak hesaplansın?', kural.oran); if (oran == null) return;
    await ayarYaz('bayi_prim', { esik: +esik || 100, oran: +String(oran).replace(',', '.') || 0 }); toast('Prim kuralı kaydedildi.'); bayihedefView(el);
  });
}

// ---------- Analiz ----------
export function bayianalizView(el) {
  const Y = +today().slice(0, 4), l = bayiler().map(b => ({ b, o: bayiOzeti(b, Y) }));
  const top = l.reduce((a, x) => a + x.o.satis, 0);
  const iller = profil().iller || [], bayiIller = new Set(l.flatMap(({ b }) => [b.il, ...String(b.bolge || '').split(/\s*,\s*/), byId('firmalar', b.firma_id)?.il]).filter(Boolean).map(x => fold(x)));
  const bosluk = iller.filter(il => !bayiIller.has(fold(il)));
  const satir = l.map(({ b, o }) => { const r = firmaRiski(b.firma_id); const kk = o.kazanilan.length + o.kayip.length;
    return { b, o, pay: top ? o.satis / top * 100 : 0, buyume: o.gecen ? (o.satis - o.gecen) / o.gecen * 100 : null, odeme: r?.ortGec, kayipOran: kk ? o.kayip.length / kk * 100 : null }; }).sort((a, c) => c.pay - a.pay);
  el.innerHTML = `<header class="vh"><div><h1>Bayi ağı analizi</h1><p class="sum">${Y} · ${l.length} bayi/partner · toplam ${usd(Math.round(top))}</p></div></header>
    ${l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bayi</th><th class="r">Satış</th><th class="r">Pay</th><th class="r">Büyüme</th><th class="r">Ort. ödeme</th><th class="r">Kayıp oranı</th><th class="r">Açık proje</th><th class="r">Stok</th></tr></thead><tbody>
      ${satir.map(x => `<tr><td><b>${esc(bayiAd(x.b))}</b><small class="muted"> · ${esc(x.b.tur || 'Bayi')}</small></td><td class="r num">${usd(Math.round(x.o.satis))}</td><td class="r"><span class="hedef-bar"><i style="width:${x.pay}%"></i></span>%${Math.round(x.pay)}</td>
        <td class="r num ${x.buyume == null ? '' : x.buyume >= 0 ? 'pos' : 'neg'}">${x.buyume == null ? '—' : (x.buyume >= 0 ? '+' : '') + Math.round(x.buyume) + '%'}</td><td class="r num">${x.odeme == null ? '—' : x.odeme > 0 ? x.odeme + ' gün geç' : 'zamanında'}</td>
        <td class="r num ${x.kayipOran >= 50 ? 'neg' : ''}">${x.kayipOran == null ? '—' : '%' + Math.round(x.kayipOran)}</td><td class="r num">${x.o.acikProj.length || ''}</td><td class="r num">${x.o.stokDeger ? usd(Math.round(x.o.stokDeger)) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>Atanmış bayi yok.</p></div>'}
    <section class="card"><h2>Bölge boşlukları</h2>${!iller.length ? '<p class="hint">Şirket profilinde çalışılan iller girilmedi.</p>' : bosluk.length ? `<p>Bayisi olmayan iller: ${bosluk.map(il => `<span class="chip">${esc(il)}</span>`).join(' ')}</p>` : '<p class="hint">Çalışılan her ilde en az bir bayi ya da partner var.</p>'}</section>`;
}
