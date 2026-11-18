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
import { bayiStokYaz, stokUyarilariHesapla, tasimaPlani, tasimaUygula } from '../stok.js';
import { anaBayi } from '../profil.js';

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

// ---------- Kod sütunu denetimi ----------
const urunKodlari = () => new Set((S.urunler || []).filter(u => !(/^\d{1,3}$/.test(String(u.kod ?? '').trim()) && /^[A-Za-z0-9.\-\/_]{4,}$/.test(String(u.aciklama ?? '').trim()))).map(u => String(u.kod ?? '').trim()));
const urunAd = kod => (S.urunler || []).find(u => String(u.kod) === String(kod))?.aciklama || null;
const kodGibi = v => /^[A-Za-z0-9][A-Za-z0-9.\-\/_]{3,}$/.test(String(v ?? '').trim());
// Sıra numarası sütunu: 1, 2, 3… diye artan küçük tam sayılar
export const siraSutunu = deg => { const v = deg.map(x => String(x ?? '').trim()).filter(Boolean); if (v.length < 2) return false; let n = 0; v.forEach((x, i) => { if (/^\d{1,4}$/.test(x) && +x === +v[0] + i) n++; }); return n / v.length >= 0.8; };
// Excel'den gelen eşlemeyi içerikle doğrular: kod sütunu sıra no ise ya da başka sütun ürün listesindeki kodlarla daha çok eşleşiyorsa düzeltir
export function kodSutunuDenetle(h, veri, M) {
  const kodlar = urunKodlari(), sut = i => i < 0 ? [] : veri.map(r => r[i]).filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim());
  const esl = i => sut(i).filter(x => kodlar.has(x)).length, hf = h.map(x => fold(x || '')), M2 = { ...M }, yasak = new Set([M.stok, M.fiyat].filter(i => i >= 0));
  const adaylar = h.map((_, i) => i).filter(i => !yasak.has(i));
  const enIyi = adaylar.reduce((a, i) => esl(i) > esl(a) ? i : a, M.kod);
  if (enIyi !== M.kod && esl(enIyi) > esl(M.kod)) M2.kod = enIyi;
  else if (siraSutunu(sut(M.kod))) {
    const alt = adaylar.find(i => i !== M.kod && /kod|code|sku|malzeme no/.test(hf[i]) && !siraSutunu(sut(i))) ?? adaylar.find(i => i !== M.kod && !siraSutunu(sut(i)) && sut(i).length && sut(i).every(kodGibi));
    if (alt != null) M2.kod = alt;
  }
  if (M2.ac === M2.kod || (M2.ac >= 0 && sut(M2.ac).length && sut(M2.ac).every(x => kodlar.has(x) || (kodGibi(x) && !/[a-zçğıöşü]{3}/i.test(x))))) {
    M2.ac = adaylar.find(i => i !== M2.kod && /aciklama|tanim|urun ad|malzeme ad|^ad$|^urun$/.test(hf[i]) && !sut(i).every(kodGibi)) ?? -1;
  }
  return { M: M2, degisti: M2.kod !== M.kod || M2.ac !== M.ac };
}
// Önceki hatalı yüklemeden kalan satırlar: kod alanında sıra no (1, 2…), açıklamada gerçek ürün kodu
const sahteUrunMu = u => /^\d{1,3}$/.test(String(u.kod ?? '').trim()) && kodGibi(u.aciklama) && !/\s/.test(String(u.aciklama).trim());
export function yanlisKodluSatirlar(firma_id) {
  const kodlar = new Set((S.urunler || []).filter(u => !sahteUrunMu(u)).map(u => String(u.kod ?? '').trim()));
  return (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && /^\d{1,3}$/.test(String(s.kod ?? '').trim()) && !kodlar.has(String(s.kod).trim()) && kodGibi(s.aciklama) && !/\s/.test(String(s.aciklama).trim()));
}
export async function yanlisKodlariDuzelt(firma_id) {
  const l = yanlisKodluSatirlar(firma_id); let duz = 0, bir = 0;
  for (const s of l) {
    const kod = String(s.aciklama).trim(), var_ = (S.bayi_stok || []).find(x => x.id !== s.id && x.firma_id === s.firma_id && x.kod === kod);
    if (var_) { if ((s.son_hareket || '') >= (var_.son_hareket || '')) await app.db.save('bayi_stok', { ...var_, adet: s.adet, son_hareket: s.son_hareket || var_.son_hareket }); await app.db.del('bayi_stok', s.id); bir++; }
    else { await app.db.save('bayi_stok', { ...s, kod, aciklama: urunAd(kod) }); duz++; }
  }
  // Aynı yüklemenin ürün listesine eklediği sahte ürünler (kod: sıra no, açıklama: ürün kodu)
  const kodSet = new Set(l.map(s => String(s.aciklama).trim()));
  const sahte = (S.urunler || []).filter(u => sahteUrunMu(u) && kodSet.has(String(u.aciklama ?? '').trim()));
  let sil = 0; if (sahte.length && (sahipMi() || izin('urunler') === 'yaz')) for (const u of sahte) { try { await app.db.del('urunler', u.id); sil++; } catch {} }
  return { duz, bir, sil };
}

// ---------- Stoklar ----------
// Bayinin stok satırları: bayi_stok tablosu + (henüz taşınmadıysa) eski depo listesindeki o deponun ürünleri
export function bayiStoklari(b) {
  const l = (S.bayi_stok || []).filter(s => s.firma_id === b.firma_id).map(s => ({ ...s, aciklama: s.aciklama || urunAd(s.kod), kaynak: 'bayi', fiyat: +s.birim_fiyat || +S.urunler.find(u => u.kod === s.kod)?.birim_fiyat_usd || 0 }));
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
    <div data-tasi></div><div data-kodduz></div><div data-uyari></div>
    <div data-l></div>`;
  // Hatalı yüklemeden kalan satırlar (kod yerine sıra no) için tek dokunuşla düzeltme
  const yk = yazabilir ? yanlisKodluSatirlar(hepsi ? null : b.firma_id) : [];
  if (yk.length) {
    const kb = el.querySelector('[data-kodduz]');
    kb.innerHTML = `<section class="card bs-tasi"><h2>${yk.length} satırda ürün kodu yanlış sütundan gelmiş</h2><p> Kod yerine sıra numarası (${esc(yk.slice(0, 3).map(s => s.kod).join(', '))}…) yazılmış, gerçek kod (${esc(yk.slice(0, 3).map(s => s.aciklama).join(', '))}…) açıklamada duruyor. Bu yüzden ürün tanımı çıkmıyor.</p><div class="btnrow"><button type="button" class="btn sm primary" data-kodduzelt>Kodları düzelt</button></div></section>`;
    kb.querySelector('[data-kodduzelt]').onclick = async e => {
      if (!confirmBox(`${yk.length} stok satırında açıklamadaki kod, ürün kodu olarak yazılacak ve ürün tanımı ürün listesinden alınacak. Aynı kod zaten varsa adetler birleşir. O yüklemenin ürün listesine eklediği "1, 2, 3…" kodlu sahte ürünler silinecek. Devam edilsin mi?`)) return;
      e.target.disabled = true;
      try { const r = await yanlisKodlariDuzelt(hepsi ? null : b.firma_id); toast(`${r.duz + r.bir} satır düzeltildi${r.bir ? ` (${r.bir} tanesi var olan satırla birleşti)` : ''}${r.sil ? `, ${r.sil} sahte ürün silindi` : ''}.`); } catch (er) { toast('Düzeltilemedi: ' + er.message, 'err'); }
      bayistokView(el);
    };
  }
  // Eski "Stok ve fiyat" deposundaki stok henüz bayiye taşınmadıysa tek seferlik taşıma
  const plan = !dis() && (sahipMi() || yaz('urunler')) ? tasimaPlani(anaBayi()) : { gruplar: [], eslesmeyen: [] };
  if (plan.gruplar.length) {
    el.querySelector('[data-tasi]').innerHTML = `<section class="card bs-tasi"><h2>Ürünler'deki depo stoğu bayiye taşınmadı</h2><p>${plan.gruplar.map(g => `<b>${esc(bayiAd(g.b))}</b>: ${g.urunler.length} kalem`).join(' · ')}${plan.eslesmeyen.length ? ` · ${plan.eslesmeyen.length} kalemin deposu bir bayiye bağlanamadı (bayi atamasındaki depo adını kontrol et)` : ''}</p>
      <p class="hint">Stok artık bayi başına tutuluyor. Taşıyınca bu adetler ilgili bayinin stoğuna ve geçmişine aktarılır; Ürünler'de yalnız ürün ve fiyat bilgisi kalır.</p><button class="btn primary" data-tasibtn>Stokları bayiye taşı</button></section>`;
    el.querySelector('[data-tasibtn]').onclick = async () => {
      const { onizleOnay } = await import('../esle.js');
      const on = await onizleOnay({ baslik: 'Stokları bayiye taşı', sayilar: plan.gruplar.map(g => [bayiAd(g.b), g.urunler.length, 'yeni']), ornekBaslik: ['Bayi', 'Kod', 'Ürün', 'Adet'], ornek: plan.gruplar.flatMap(g => g.urunler.slice(0, 4).map(u => [bayiAd(g.b), u.kod, u.aciklama, u.stok])).slice(0, 8) });
      if (!on.ok) return;
      try { const n = await tasimaUygula(plan); toast(`${n} kalem bayi stoğuna taşındı.`); bayistokView(el); } catch (e) { toast('Taşınamadı: ' + e.message, 'err'); }
    };
  }
  if (!dis()) {
    const su = stokUyarilariHesapla(), hb = su.hareketsiz.filter(x => hepsi || x.firma_id === b.firma_id);
    if (su.yetersiz.length || hb.length) el.querySelector('[data-uyari]').innerHTML = `<details class="card warnbox" ${su.yetersiz.length ? 'open' : ''}><summary><b>Stok uyarıları</b> <span class="muted">${su.yetersiz.length ? su.yetersiz.length + ' ürün tekliflere yetmiyor' : ''}${su.yetersiz.length && hb.length ? ' · ' : ''}${hb.length ? hb.length + ' kalem 60+ gün hareketsiz' : ''}</span></summary>
      ${su.yetersiz.length ? `<h3>Açık tekliflere yetmeyen stok (bütün bayiler)</h3><ul class="list">${su.yetersiz.map(x => `<li><span><b>${esc(x.u.aciklama || x.u.kod)}</b><span class="muted"> · tekliflerde ${num(x.ihtiyac)}, bayilerde toplam ${num(x.stok)}</span></span><b class="num neg">−${num(x.eksik)}</b></li>`).join('')}</ul>` : ''}
      ${hb.length ? `<h3>60 günü aşkın hareketsiz stok</h3><ul class="list">${hb.slice(0, 30).map(x => `<li><span><b>${esc(x.u.aciklama || x.u.kod)}</b><span class="muted"> · ${esc(x.bayi || '')} · ${x.gun} gün</span></span><b class="num">${x.deger ? usd(Math.round(x.deger)) : ''}</b></li>`).join('')}</ul>` : ''}</details>`;
  }
  const ciz = () => {
    const g = satirlar.filter(s => match(f.q, s.kod, s.aciklama, hepsi ? bayiAd(s.bayi) : '') && (f.sadece === 'tum' || (f.sadece === 'az' ? s.adet > 0 && s.adet <= 5 : gunFark(s.son_hareket) >= 90 && s.adet > 0)))
      .sort((a, c) => (c.adet * c.fiyat) - (a.adet * a.fiyat));
    const deger = g.reduce((a, s) => a + s.adet * s.fiyat, 0);
    el.querySelector('[data-sum]').textContent = `${g.filter(s => s.adet > 0).length} kalem · stok değeri ~${usd(Math.round(deger))} · ${g.filter(s => gunFark(s.son_hareket) >= 90 && s.adet > 0).length} hareketsiz`;
    el.querySelector('[data-l]').innerHTML = g.length ? `<div class="tbl-wrap"><table class="tbl bs-t"><thead><tr>${hepsi ? '<th>Bayi</th>' : ''}<th>Kod</th><th>Ürün</th><th class="r">Adet</th><th class="r">Değer</th><th>Son hareket</th></tr></thead><tbody>
      ${g.slice(0, 400).map(s => { const gun = gunFark(s.son_hareket); return `<tr>${hepsi ? `<td>${esc(bayiAd(s.bayi))}</td>` : ''}<td class="mono">${esc(s.kod)}</td><td>${s.aciklama ? esc(s.aciklama) : '<span class="muted">ürün listesinde tanımı yok</span>'}</td>
        <td class="r num">${yazabilir && !hepsi && s.kaynak === 'bayi' ? `<span class="bs-hizli"><button type="button" class="btn sm ghost" data-art="-1" data-sid="${s.id}" aria-label="${esc(s.kod)} bir azalt">−</button><input type="number" inputmode="decimal" class="bs-adet" data-adet="${s.id}" value="${s.adet}" aria-label="${esc(s.kod)} adet"><button type="button" class="btn sm ghost" data-art="1" data-sid="${s.id}" aria-label="${esc(s.kod)} bir artır">+</button></span>` : num(s.adet)}</td>
        <td class="r num">${s.fiyat ? usd(Math.round(s.adet * s.fiyat)) : ''}</td><td>${s.son_hareket ? tarih(s.son_hareket) : ''}${gun >= 90 && s.adet > 0 ? ` <em class="flag soft">${gun} gün hareketsiz</em>` : ''}${s.adet > 0 && s.adet <= 5 ? ' <em class="flag">az</em>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><p>${satirlar.length ? 'Süzgece uyan ürün yok.' : 'Bu bayinin stok kaydı yok.'}</p>${!satirlar.length && yazabilir && !hepsi ? '<p class="hint">Bayinin stok listesini Excel\'den yükle ya da ürün ekle. Excel\'de ürün kodu ve stok sütunu olması yeter; yeni ürün kodları Ürün ve fiyat listesine de eklenir.</p>' : ''}</div>`;
    const adetYaz = async (id, v) => { const s = S.bayi_stok.find(x => x.id === id); if (!s || v === +s.adet || v < 0) return; await bayiStokYaz([{ ...s, adet: v }]); toast(`${s.kod}: ${num(v)}`); };
    el.querySelectorAll('[data-adet]').forEach(i => { i.onchange = () => adetYaz(i.dataset.adet, +i.value || 0); i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }; });
    el.querySelectorAll('[data-art]').forEach(bt => bt.onclick = async () => { const i = el.querySelector(`[data-adet="${bt.dataset.sid}"]`); const v = Math.max(0, (+i.value || 0) + +bt.dataset.art); i.value = v; await adetYaz(bt.dataset.sid, v); });
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
    await bayiStokYaz([{ ...(var_ || {}), firma_id: b.firma_id, ...o, adet: +o.adet || 0 }]); toast('Kaydedildi.'); closeDrawer(); sonra?.(); };
}
// Bayinin stok Excel dosyası (aydınlatma depo formatı ya da başlıklı genel tablo): sütun eşleme, önizleme, listede olmayanları sıfırlama
async function stokExcel(b, sonra) {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    await (await import('../ui.js')).xlsxYukle();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.some(c => /kod/i.test(String(c || '')))); if (hi < 0) return toast('Başlıkta "Kod" sütunu bulunamadı.', 'err');
    const h = rows[hi].map(c => fold(c || '')), col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
    let cF0 = col(/fiyat/); if (cF0 < 0 && rows.slice(hi + 1).some(r => typeof r[9] === 'number')) cF0 = 9;   // depo formatı: sağdaki blokta birim fiyat
    const { sutunlariEsle, onizleOnay } = await import('../esle.js');
    const M = await sutunlariEsle('stok', `${bayiAd(b)} stok listesi`, rows[hi].map(x => String(x ?? '')), rows.slice(hi + 1, hi + 4), [
      { k: 'kod', l: 'Ürün kodu', zorunlu: true }, { k: 'ac', l: 'Açıklama' }, { k: 'bir', l: 'Birim' }, { k: 'stok', l: 'Stok miktarı', zorunlu: true }, { k: 'fiyat', l: 'Birim fiyat (USD)' }],
      { kod: Math.max(0, col(/uretici kod/, /^kod/, /urun kod/, /malzeme kod/, /kod/, /malzeme/)), ac: col(/aciklama/, /tanim/, /urun ad/, /malzeme ad/, /^urun$/), bir: col(/birim/), stok: col(/fiili stok/, /^stok/, /miktar/, /adet/), fiyat: cF0 });
    if (!M) return toast('Yükleme iptal edildi.');
    const den = kodSutunuDenetle(rows[hi].map(x => String(x ?? '')), rows.slice(hi + 1), M);
    if (den.degisti) {
      Object.assign(M, den.M); const ad = i => i >= 0 ? String(rows[hi][i] ?? `Sütun ${i + 1}`) : 'yok';
      toast(`Kod sütunu düzeltildi: “${ad(M.kod)}” ürün kodu, açıklama “${ad(M.ac)}”.`);
      const k = ayar('excel_esle', {}) || {}; if (k.stok) { k.stok = { ...k.stok, kod: M.kod >= 0 ? String(rows[hi][M.kod] ?? '') : null, ac: M.ac >= 0 ? String(rows[hi][M.ac] ?? '') : null }; await ayarYaz('excel_esle', k); }
    }
    const sayi = v => typeof v === 'number' ? v : +String(v ?? '').replace(/\./g, '').replace(',', '.') || 0;
    const gelen = new Map();
    for (const r of rows.slice(hi + 1)) { const kod = r[M.kod] != null ? String(r[M.kod]).trim() : ''; if (!kod) continue;
      gelen.set(kod, { kod, aciklama: M.ac >= 0 && r[M.ac] ? String(r[M.ac]).trim() : null, birim: M.bir >= 0 ? r[M.bir] : null, adet: M.stok >= 0 ? sayi(r[M.stok]) : 0, fiyat: M.fiyat >= 0 && typeof r[M.fiyat] === 'number' ? r[M.fiyat] : null }); }
    if (!gelen.size) return toast('Dosyada ürün satırı bulunamadı.', 'err');
    const mevcut = new Map((S.bayi_stok || []).filter(s => s.firma_id === b.firma_id).map(s => [s.kod, s]));
    const gl = [...gelen.values()], yeni = gl.filter(g => !mevcut.has(g.kod)), degisen = gl.filter(g => mevcut.has(g.kod) && +mevcut.get(g.kod).adet !== g.adet);
    const yok = [...mevcut.values()].filter(s => !gelen.has(s.kod) && +s.adet > 0);
    const on = await onizleOnay({ baslik: `${bayiAd(b)} stok listesi`, sayilar: [['yeni ürün', yeni.length, 'yeni'], ['stoğu değişen', degisen.length, 'guncel'], ['aynı kalan', gl.length - yeni.length - degisen.length, ''], ['listede olmayan', yok.length, yok.length ? 'uyari' : '']],
      ornekBaslik: ['Kod', 'Açıklama', 'Eski stok', 'Yeni stok'], ornek: [...degisen, ...yeni].slice(0, 8).map(g => [g.kod, g.aciklama || '', mevcut.get(g.kod)?.adet ?? '—', g.adet]),
      secenek: yok.length ? { metin: `Yeni listede olmayan ${yok.length} ürünün stoğunu 0 yap`, varsayilan: true } : null });
    if (!on.ok) return toast('İçe aktarma iptal edildi.');
    const kayit = gl.map(g => { const e = mevcut.get(g.kod); return { ...(e || {}), firma_id: b.firma_id, kod: g.kod, aciklama: g.aciklama || e?.aciklama || S.urunler.find(u => u.kod === g.kod)?.aciklama || null, adet: g.adet, birim_fiyat: g.fiyat ?? e?.birim_fiyat ?? null }; });
    if (yok.length && on.secim) for (const e of yok) kayit.push({ ...e, adet: 0 });
    toast('Stok kaydediliyor…');
    await bayiStokYaz(kayit);
    // Ürün listesinde olmayan kodlar ürün ve fiyat listesine eklenir (stoksuz)
    if (sahipMi() || izin('urunler') === 'yaz') { const { uuid } = await import('../db.js'); const yeniU = gl.filter(g => !S.urunler.some(u => u.kod === g.kod) && g.aciklama && !siraSutunu([g.kod]) && /\s|[a-zçğıöşü]{3}/i.test(g.aciklama));
      if (yeniU.length) try { await app.db.bulk('urunler', yeniU.map(g => ({ id: uuid(), kod: g.kod, aciklama: g.aciklama, birim: g.birim || 'ADET', aile: g.aciklama.split(/\s+/)[0].toUpperCase(), birim_fiyat_usd: g.fiyat }))); } catch {} }
    try { (await import('../belgeler.js')).yuklemeKaydet(file, `${bayiAd(b)} stok listesi`, `${gelen.size} ürün`); } catch {}
    toast(`${bayiAd(b)}: ${gelen.size} ürün güncellendi.`); sonra?.();
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
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
