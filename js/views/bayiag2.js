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
import { bayiStokYaz, bayiStokSil, bayiStokAktif, stokUyarilariHesapla, tasimaPlani, tasimaUygula, satirFiyat, satirDegerUsd, aktifMi, stokBirimleri, birimEkle, PARA_BIRIMLERI, pbNorm, kritikMi, kritikVar, azMi, teklifteAyrilan, usddenCevir, stokAdet, HAREKET_AD, ANA_DEPO, depoAdi, ayniKalem, bayiDepolari, stokTransfer } from '../stok.js';
import { anaBayi } from '../profil.js';
import { acikSayim, sayimPenceresi } from '../sayim.js';
import { planlamaPenceresi } from '../stokanaliz.js';
import { GRUPSUZ, gorunenGruplar, sekmede, kalemGruplari, gruplaPenceresi, gruplarPenceresi, gruptanCikar } from '../stokgrup.js';

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
    const kod = String(s.aciklama).trim(), var_ = (S.bayi_stok || []).find(x => x.id !== s.id && ayniKalem(x, s.firma_id, kod, s.depo));
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
  const l = (S.bayi_stok || []).filter(s => s.firma_id === b.firma_id).map(s => { const { fiyat, pb } = satirFiyat(s); return { ...s, aciklama: s.aciklama || urunAd(s.kod), kaynak: 'bayi', fiyat, pb, deger: satirDegerUsd(s), birim: s.birim || S.urunler.find(u => u.kod === s.kod)?.birim || null }; });
  if (b.depo) for (const u of S.urunler.filter(u => u.depo === b.depo && !l.some(x => x.kod === u.kod))) l.push({ id: u.id, kod: u.kod, aciklama: u.aciklama, adet: +u.stok || 0, fiyat: +u.birim_fiyat_usd || 0, pb: 'USD', deger: (+u.stok || 0) * (+u.birim_fiyat_usd || 0), birim: u.birim, son_hareket: u.stok_tarihi || String(u.updated_at || '').slice(0, 10), kaynak: 'depo' });
  return l;
}
const birimKisa = b => b ? ' ' + String(b).toLocaleLowerCase('tr') : '';
export function bayistokView(el) {
  const f = F('bayistok', { id: '', q: '', sadece: 'tum', grup: '', pb: 'USD', depo: '' });
  const b = seciliBayi(f);
  if (!b) { el.innerHTML = `<header class="vh"><div><h1>Bayi stokları</h1></div></header><div class="empty"><p>Önce Ağ'dan bir bayi ata.</p></div>`; return; }
  const hepsi = f.id === '*' && !dis();
  // Depolar: ana depo + bayinin diğer depoları; seçili depo ('' = hepsi, '_ana' = ana depo)
  const DEP = hepsi ? [null] : bayiDepolari(b), cokDepo = DEP.length > 1;
  if (f.depo && f.depo !== '_ana' && !DEP.includes(f.depo)) f.depo = '';
  const depoSecili = f.depo ? (f.depo === '_ana' ? null : f.depo) : undefined;   // undefined: bütün depolar
  const depoUygun = s => depoSecili === undefined || (s.depo || null) === depoSecili;
  const satirlar = (hepsi ? bayiler() : [b]).flatMap(x => bayiStoklari(x).map(s => ({ ...s, bayi: x }))).filter(depoUygun);
  const yazabilir = yaz('bayistok') || !!dis();
  const duzenler = yazabilir && !hepsi;
  const sirketYazar = !dis() && yaz('bayistok');
  const secili = new Set();
  // Gruplar (sekmeler): şirket grupları önce, bayinin kendi grupları sonra; ürünü olmayan grubun sekmesi gizlenir
  const GR = gorunenGruplar(hepsi ? null : b.firma_id), grupAd = id => GR.find(g => g.id === id)?.ad;
  if (f.grup && f.grup !== GRUPSUZ && !grupAd(f.grup)) f.grup = '';
  const aktifSatir = satirlar.filter(s => f.sadece === 'pasif' ? !aktifMi(s) : aktifMi(s));
  const say = id => aktifSatir.filter(s => sekmede(s, id, hepsi ? null : b.firma_id)).length;
  const sekmeler = GR.length ? [['', 'Tümü', aktifSatir.length], ...GR.map(g => [g.id, g.ad, say(g.id), g.katman]).filter(x => x[2] || x[0] === f.grup), [GRUPSUZ, 'Grupsuz', say(GRUPSUZ)]] : [];
  const grupSecili = f.grup && f.grup !== GRUPSUZ;
  el.innerHTML = `<header class="vh"><div><h1>${hepsi ? 'Bütün bayilerin stoğu' : 'Stok · ' + esc(bayiAd(b))}</h1><p class="sum" data-sum></p></div>
    <div class="vh-act">${bayiSecici(f, b)}${!hepsi && (cokDepo || yazabilir) ? `<select data-dsec aria-label="Depo seç">${cokDepo ? `<option value="" ${!f.depo ? 'selected' : ''}>Bütün depolar</option>` : ''}${DEP.map(d => `<option value="${d ? esc(d) : '_ana'}" ${(f.depo || (cokDepo ? '' : '_ana')) === (d || '_ana') ? 'selected' : ''}>${esc(depoAdi(d))}</option>`).join('')}${yazabilir ? '<option value="_yeni">+ Depo ekle…</option>' : ''}</select>` : ''}${duzenler ? '<button class="btn" data-yukle>Excel\'den yükle</button><button class="btn primary" data-ekle>+ Ürün</button>' : ''}${duzenler ? `<button class="btn ghost" data-sayim>${acikSayim(b.firma_id, grupSecili ? f.grup : null, cokDepo ? depoSecili : undefined) ? 'Sayıma devam' : 'Sayım'}</button>` : ''}${!hepsi ? '<button class="btn ghost" data-planlama>Planlama</button>' : ''}<button class="btn ghost" data-hareket>Hareketler</button><button class="btn ghost" data-xlsx>Excel</button><button class="btn ghost" data-sablon>Boş şablon</button>${yazabilir ? '<button class="btn ghost" data-gruplar>Gruplar</button>' : ''}${duzenler ? `<button class="btn ghost danger" data-hepsinisil>${grupSecili ? 'Bu gruptaki stoğu sil' : 'Bütün stoğu sil'}</button>` : ''}</div></header>
    <div class="frow"><input type="search" data-q value="${esc(f.q)}" placeholder="${hepsi ? 'Ürün kodu ya da adı: hangi bayide var?' : 'Ürün, firma kodu ya da üretici kodu ara'}" aria-label="Ara">
      <div class="seg" role="group" aria-label="Göster">${[['tum', 'Tümü'], ['az', 'Kritik / az'], ['olu', 'Hareketsiz (90+ gün)'], ['pasif', 'Pasif']].map(([k, t]) => `<button type="button" data-s="${k}" class="${f.sadece === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    ${sekmeler.length || yazabilir ? `<nav class="sg-sekmeler" aria-label="Stok grupları">${sekmeler.map(([id, ad, n, kat]) => `<button type="button" data-grup="${id}" class="${(f.grup || '') === id ? 'on' : ''}${kat === 'bayi' ? ' sg-bayi' : ''}" ${kat === 'bayi' ? 'title="Bu bayiye özel grup"' : ''}>${esc(ad)} <small>${n}</small></button>`).join('')}${yazabilir && !sekmeler.length ? '<button type="button" class="sg-ilk" data-gruplar2>+ Grup oluştur</button>' : ''}</nav>` : ''}
    <div data-tasi></div><div data-kodduz></div><div data-uyari></div>
    <div class="bs-secim" data-secim hidden></div>
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
    const su = stokUyarilariHesapla(), hb = su.hareketsiz.filter(x => hepsi || x.firma_id === b.firma_id), kr = su.kritik.filter(x => hepsi || x.firma_id === b.firma_id);
    if (su.yetersiz.length || hb.length || kr.length) el.querySelector('[data-uyari]').innerHTML = `<details class="card warnbox" ${su.yetersiz.length || kr.length ? 'open' : ''}><summary><b>Stok uyarıları</b> <span class="muted">${[kr.length ? kr.length + ' kalem kritik seviyede' : '', su.yetersiz.length ? su.yetersiz.length + ' ürün tekliflere yetmiyor' : '', hb.length ? hb.length + ' kalem 60+ gün hareketsiz' : ''].filter(Boolean).join(' · ')}</span></summary>
      ${kr.length ? `<h3>Kritik seviyenin altında</h3><ul class="list">${kr.slice(0, 40).map(x => `<li><span><b>${esc(x.s.aciklama || x.s.kod)}</b><span class="muted"> · ${hepsi ? esc(x.bayi || '') + ' · ' : ''}kritik ${num(x.s.kritik)}</span></span><b class="num neg">${num(x.s.adet)}${birimKisa(x.s.birim)}</b></li>`).join('')}</ul>` : ''}
      ${su.yetersiz.length ? `<h3>Açık tekliflere yetmeyen stok (bütün bayiler)</h3><ul class="list">${su.yetersiz.map(x => `<li><span><b>${esc(x.u.aciklama || x.u.kod)}</b><span class="muted"> · tekliflerde ${num(x.ihtiyac)}, bayilerde toplam ${num(x.stok)}</span></span><b class="num neg">−${num(x.eksik)}</b></li>`).join('')}</ul>` : ''}
      ${hb.length ? `<h3>60 günü aşkın hareketsiz stok</h3><ul class="list">${hb.slice(0, 30).map(x => `<li><span><b>${esc(x.u.aciklama || x.u.kod)}</b><span class="muted"> · ${esc(x.bayi || '')} · ${x.gun} gün</span></span><b class="num">${x.deger ? usd(Math.round(x.deger)) : ''}</b></li>`).join('')}</ul>` : ''}</details>`;
  }
  const gorunen = () => satirlar.filter(s => match(f.q, s.kod, s.aciklama, s.firma_kodu, s.uretici_kodu, s.uretici_aciklama, hepsi ? bayiAd(s.bayi) : '')
    && sekmede(s, f.grup, hepsi ? null : b.firma_id) && (f.sadece === 'pasif' ? !aktifMi(s) : aktifMi(s) && (f.sadece === 'tum' || (f.sadece === 'az' ? azMi(s) : gunFark(s.son_hareket) >= 90 && s.adet > 0))))
    .sort((a, c) => c.deger - a.deger || String(a.kod).localeCompare(String(c.kod), 'tr'));
  const secimCiz = () => {
    const sb = el.querySelector('[data-secim]'); sb.hidden = !secili.size; if (!secili.size) return;
    const l = satirlar.filter(s => secili.has(s.id) && s.kaynak === 'bayi'), pasifVar = l.some(s => !aktifMi(s)), aktifVar = l.some(aktifMi);
    sb.innerHTML = `<b>${secili.size} kalem seçili</b><span class="grow"></span><button type="button" class="btn sm" data-sgrupla>Grupla</button>${!hepsi ? '<button type="button" class="btn sm" data-stransfer>Transfer</button>' : ''}${grupSecili ? `<button type="button" class="btn sm" data-scikar>Gruptan çıkar</button>` : ''}${aktifVar ? '<button type="button" class="btn sm" data-spasif>Pasife al</button>' : ''}${pasifVar ? '<button type="button" class="btn sm" data-saktif>Aktif yap</button>' : ''}<button type="button" class="btn sm danger" data-ssil>Sil</button><button type="button" class="btn sm ghost" data-stemizle>Seçimi kaldır</button>`;
    sb.querySelector('[data-stemizle]').onclick = () => { secili.clear(); ciz(); };
    sb.querySelector('[data-stransfer]')?.addEventListener('click', () => transferPenceresi(b, l.map(s => S.bayi_stok.find(x => x.id === s.id)).filter(Boolean), () => bayistokView(el)));
    sb.querySelector('[data-sgrupla]').onclick = () => gruplaPenceresi({ firma_id: b.firma_id, kalemler: l.map(s => S.bayi_stok.find(x => x.id === s.id)).filter(Boolean), sirketYazar, sonra: () => bayistokView(el) });
    sb.querySelector('[data-scikar]')?.addEventListener('click', async () => { const n = await gruptanCikar(l.map(s => S.bayi_stok.find(x => x.id === s.id)).filter(Boolean), f.grup); toast(`${n} kalem “${grupAd(f.grup)}” grubundan çıkarıldı; stokta duruyor.`); bayistokView(el); });
    sb.querySelector('[data-spasif]')?.addEventListener('click', async () => { await bayiStokAktif(l.filter(aktifMi), false); toast(`${l.filter(aktifMi).length} kalem pasife alındı; geçmişi duruyor.`); bayistokView(el); });
    sb.querySelector('[data-saktif]')?.addEventListener('click', async () => { await bayiStokAktif(l.filter(s => !aktifMi(s)), true); toast('Kalemler yeniden aktif.'); bayistokView(el); });
    sb.querySelector('[data-ssil]').onclick = async () => {
      if (!confirmBox(`${l.length} stok kalemi silinecek:\n${l.slice(0, 8).map(s => `• ${s.kod}${s.aciklama ? ' – ' + s.aciklama : ''} (${num(s.adet)}${birimKisa(s.birim)})`).join('\n')}${l.length > 8 ? `\n… ve ${l.length - 8} kalem daha` : ''}\n\nGeçmiş hareketleri raporlarda kalır. Satılmayan ürünü silmek yerine pasife de alabilirsin. Silinsin mi?`)) return;
      const n = await bayiStokSil(l, 'Seçerek silindi'); toast(`${n} kalem silindi; geçmişi raporlarda duruyor.`); bayistokView(el);
    };
  };
  const rez = teklifteAyrilan();
  const ciz = () => {
    const g = gorunen();
    const deger = g.reduce((a, s) => a + s.deger, 0), pasifN = satirlar.filter(s => !aktifMi(s)).length;
    const dg = usddenCevir(deger, f.pb), dgYazi = f.pb === 'USD' || dg == null ? usd(Math.round(deger)) : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(dg) + (f.pb === 'EUR' ? ' €' : ' ₺');
    el.querySelector('[data-sum]').innerHTML = esc(`${g.filter(s => s.adet > 0).length} kalem · stok değeri ~`) + `<button type="button" class="linkbtn" data-pbdeg title="Para birimini değiştir">${esc(dgYazi)}</button>` + esc(` · ${g.filter(s => gunFark(s.son_hareket) >= 90 && s.adet > 0).length} hareketsiz${pasifN && f.sadece !== 'pasif' ? ` · ${pasifN} pasif` : ''}`) + (f.pb !== 'USD' && dg == null ? ' <small class="muted">(kur yok, USD gösteriliyor)</small>' : '') + (cokDepo && depoSecili === undefined ? '<br><small class="muted">' + DEP.map(d => `${esc(depoAdi(d))}: ${usd(Math.round(g.filter(s => (s.depo || null) === d).reduce((a, s) => a + s.deger, 0)))}`).join(' · ') + '</small>' : '');
    el.querySelector('[data-pbdeg]').onclick = () => { f.pb = { USD: 'EUR', EUR: 'TRY', TRY: 'USD' }[f.pb] || 'USD'; saveFilters(); ciz(); };
    const sec = duzenler, tum = g.length && g.every(s => secili.has(s.id));
    el.querySelector('[data-l]').innerHTML = g.length ? `<div class="tbl-wrap"><table class="tbl bs-t"><thead><tr>${sec ? `<th class="bs-c"><input type="checkbox" data-tumu ${tum ? 'checked' : ''} aria-label="Görünen hepsini seç"></th>` : ''}${hepsi ? '<th>Bayi</th>' : ''}${cokDepo && depoSecili === undefined ? '<th>Depo</th>' : ''}<th>Kod</th><th>Ürün</th><th class="r">Miktar</th><th class="r">Değer</th><th>Son hareket</th></tr></thead><tbody>
      ${g.slice(0, 400).map(s => { const gun = gunFark(s.son_hareket); return `<tr class="${aktifMi(s) ? '' : 'pasif'}" data-row="${s.id}">${sec ? `<td class="bs-c">${s.kaynak === 'bayi' ? `<input type="checkbox" data-sec="${s.id}" ${secili.has(s.id) ? 'checked' : ''} aria-label="${esc(s.kod)} seç">` : ''}</td>` : ''}${hepsi ? `<td>${esc(bayiAd(s.bayi))}</td>` : ''}${cokDepo && depoSecili === undefined ? `<td>${esc(depoAdi(s.depo))}</td>` : ''}
        <td class="mono">${sec && s.kaynak === 'bayi' ? `<button type="button" class="linkbtn mono" data-kart="${s.id}">${esc(s.kod)}</button>` : esc(s.kod)}${s.firma_kodu ? `<br><small class="muted" title="Firma stok kodu">${esc(s.firma_kodu)}</small>` : ''}</td>
        <td>${s.aciklama ? esc(s.aciklama) : '<span class="muted">ürün listesinde tanımı yok</span>'}${s.uretici_kodu || s.uretici_aciklama ? `<br><small class="muted">Üretici: ${esc([s.uretici_kodu, s.uretici_aciklama].filter(Boolean).join(' · '))}</small>` : ''}${aktifMi(s) ? '' : ' <em class="flag soft">pasif</em>'}${s.kampanya ? ' <em class="sg-rozet">kampanya</em>' : ''}${kalemGruplari(s).map(grupAd).filter(Boolean).map(a => ` <em class="sg-rozet">${esc(a)}</em>`).join('')}</td>
        <td class="r num">${duzenler && s.kaynak === 'bayi' ? `<span class="bs-hizli"><button type="button" class="btn sm ghost" data-art="-1" data-sid="${s.id}" aria-label="${esc(s.kod)} bir azalt">−</button><input type="number" inputmode="decimal" class="bs-adet" data-adet="${s.id}" value="${s.adet}" aria-label="${esc(s.kod)} miktar"><button type="button" class="btn sm ghost" data-art="1" data-sid="${s.id}" aria-label="${esc(s.kod)} bir artır">+</button></span>${s.birim ? `<small class="muted bs-birim">${esc(s.birim)}</small>` : ''}` : num(s.adet) + birimKisa(s.birim)}</td>
        <td class="r num">${s.deger ? usd(Math.round(s.deger)) : ''}${s.fiyat && s.pb !== 'USD' ? `<br><small class="muted">${num(s.fiyat)} ${s.pb === 'TRY' ? '₺' : '€'}/${esc(s.birim || 'birim')}</small>` : ''}</td><td>${s.son_hareket ? tarih(s.son_hareket) : ''}${gun >= 90 && s.adet > 0 ? ` <em class="flag soft">${gun} gün hareketsiz</em>` : ''}${kritikMi(s) ? ` <em class="flag">kritik (≤${num(s.kritik)})</em>` : !kritikVar(s) && s.adet > 0 && s.adet <= 5 ? ' <em class="flag">az</em>' : ''}${rez.get(s.kod) ? (x => ` <em class="flag soft ${x < 0 ? 'neg' : ''}" title="Açık tekliflerde ayrılmış ${num(rez.get(s.kod))}; bütün bayilerdeki stoktan kalan serbest ${num(x)}">teklifte ${num(rez.get(s.kod))} · serbest ${num(x)}</em>`)(stokAdet({ kod: s.kod }) - rez.get(s.kod)) : ''}${s.adet === 0 || +s.adet === 0 ? ' <em class="flag soft">sıfır</em>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><p>${satirlar.length ? (f.sadece === 'pasif' ? 'Pasif kalem yok.' : 'Süzgece uyan ürün yok.') : 'Bu bayinin stok kaydı yok.'}</p>${!satirlar.length && duzenler ? '<p class="hint">Bayinin stok listesini Excel\'den yükle ya da ürün ekle. "Boş şablon" bütün sütunları içeren Excel\'i indirir; ürün kodu ve miktar sütunu olması yeter.</p>' : ''}</div>`;
    const adetYaz = async (id, v) => { const s = S.bayi_stok.find(x => x.id === id); if (!s || v === +s.adet || v < 0) return; await bayiStokYaz([{ ...s, adet: v }]); toast(`${s.kod}: ${num(v)}${birimKisa(s.birim)}`); };
    el.querySelectorAll('[data-adet]').forEach(i => { i.onchange = () => adetYaz(i.dataset.adet, +i.value || 0); i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }; });
    el.querySelectorAll('[data-art]').forEach(bt => bt.onclick = async () => { const i = el.querySelector(`[data-adet="${bt.dataset.sid}"]`); const v = Math.max(0, (+i.value || 0) + +bt.dataset.art); i.value = v; await adetYaz(bt.dataset.sid, v); });
    el.querySelectorAll('[data-sec]').forEach(c => c.onchange = () => { c.checked ? secili.add(c.dataset.sec) : secili.delete(c.dataset.sec); el.querySelector('[data-tumu]').checked = g.every(s => secili.has(s.id)); secimCiz(); });
    el.querySelector('[data-tumu]')?.addEventListener('change', e => { g.filter(s => s.kaynak === 'bayi').forEach(s => e.target.checked ? secili.add(s.id) : secili.delete(s.id)); ciz(); });
    el.querySelectorAll('[data-kart]').forEach(k => k.onclick = () => stokSatirFormu(b, () => bayistokView(el), S.bayi_stok.find(x => x.id === k.dataset.kart)));
    secimCiz();
  };
  el.querySelector('[data-q]').oninput = e => { f.q = e.target.value; saveFilters(); ciz(); };
  el.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { f.sadece = x.dataset.s; saveFilters(); secili.clear(); el.querySelectorAll('[data-s]').forEach(y => y.classList.toggle('on', y === x)); ciz(); });
  el.querySelector('[data-bsec]')?.addEventListener('change', e => { f.id = e.target.value; f.grup = ''; f.depo = ''; saveFilters(); bayistokView(el); });
  el.querySelector('[data-dsec]')?.addEventListener('change', async e => {
    if (e.target.value === '_yeni') { const ad = (window.prompt('Yeni depo adı (ör. Şube, Şantiye – Mersin):') || '').trim(); if (!ad) { bayistokView(el); return; }
      if (DEP.some(d => d && fold(d) === fold(ad))) { f.depo = DEP.find(d => d && fold(d) === fold(ad)); }
      else { if (!dis() && b.id !== 'dis') { try { await app.db.save('bayiler', { ...b, depolar: [...(Array.isArray(b.depolar) ? b.depolar : []), ad] }); } catch {} } else (b.depolar = [...(b.depolar || []), ad]); f.depo = ad; toast(`“${ad}” deposu eklendi. Ürün eklerken ya da transferle bu depoya stok girebilirsin.`); }
      saveFilters(); bayistokView(el); return; }
    f.depo = e.target.value; saveFilters(); bayistokView(el); });
  el.querySelectorAll('[data-grup]').forEach(x => x.onclick = () => { f.grup = x.dataset.grup; saveFilters(); bayistokView(el); });
  const gy = () => gruplarPenceresi({ firma_id: hepsi ? null : b.firma_id, bayiListesi: bayiler().map(x => ({ firma_id: x.firma_id, ad: bayiAd(x) })), sirketYazar, sonra: () => bayistokView(el) });
  el.querySelector('[data-gruplar]')?.addEventListener('click', gy); el.querySelector('[data-gruplar2]')?.addEventListener('click', gy);
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`bayi-stok-${today()}`, { Stok: satirlar.map(s => ({ ...(hepsi ? { Bayi: bayiAd(s.bayi) } : {}), ...sablonSatiri(s), 'Değer (USD)': Math.round(s.deger) || null, 'Son hareket': s.son_hareket })) });
  el.querySelector('[data-hareket]').onclick = () => hareketlerPenceresi(hepsi ? null : b);
  el.querySelector('[data-planlama]')?.addEventListener('click', () => planlamaPenceresi({ b, firma_id: b.firma_id, depo: cokDepo ? depoSecili : undefined, bayiAdi: bayiAd(b), yazabilir: duzenler && !dis(), sonra: () => bayistokView(el) }));
  el.querySelector('[data-sayim]')?.addEventListener('click', () => { if (cokDepo && depoSecili === undefined) return toast('Sayım depo depo yapılır: önce üstten depoyu seç.', 'err'); sayimPenceresi({ b, firma_id: b.firma_id, grup_id: grupSecili ? f.grup : null, grupAd: grupSecili ? grupAd(f.grup) : null, depo: cokDepo ? depoSecili : undefined, bayiAdi: bayiAd(b), sonra: () => bayistokView(el) }); });
  el.querySelector('[data-sablon]').onclick = () => exportXlsx('stok-sablonu', { Stok: [sablonSatiri({ kod: '117887', firma_kodu: 'ATI-0001', aciklama: 'Örnek ürün açıklaması', uretici_kodu: 'UR-123', uretici_aciklama: 'Üreticinin ürün adı', birim: 'Adet', adet: 10, birim_fiyat: 12.5, para_birimi: 'USD', aktif: true })] });
  el.querySelector('[data-ekle]')?.addEventListener('click', () => stokSatirFormu(b, () => bayistokView(el), null, depoSecili ?? null));
  el.querySelector('[data-yukle]')?.addEventListener('click', () => { if (cokDepo && depoSecili === undefined) return toast('Excel depo depo yüklenir: önce üstten depoyu seç.', 'err'); grupSorVeYukle(b, grupSecili ? f.grup : null, GR, () => bayistokView(el), depoSecili ?? null); });
  el.querySelector('[data-hepsinisil]')?.addEventListener('click', () => komplesil(b, satirlar.filter(s => s.kaynak === 'bayi' && (!grupSecili || kalemGruplari(s).includes(f.grup))), () => bayistokView(el), grupSecili ? grupAd(f.grup) : null, cokDepo && depoSecili !== undefined ? depoAdi(depoSecili) : null));
  ciz();
}
// Stok hareketleri: kim, ne zaman, ne kadar (stok geçmişinden; silinen kalemlerin geçmişi de durur)
function hareketListesi(l, n = 300, bayiSutun = true) {
  l = [...l].sort((a, c) => String(c.tarih || '').localeCompare(String(a.tarih || '')) || String(c.created_at || c.id).localeCompare(String(a.created_at || a.id))).slice(0, n);
  if (!l.length) return '<p class="muted">Hareket kaydı yok.</p>';
  return `<h3>Hareketler</h3><div class="tbl-wrap"><table class="tbl bs-h"><thead><tr><th>Tarih</th>${bayiSutun ? '<th>Bayi</th>' : ''}<th>Kod</th><th>Hareket</th><th class="r">Fark</th><th class="r">Kalan</th><th>Açıklama</th></tr></thead><tbody>${l.map(h => `<tr><td>${tarih(h.tarih)}</td>${bayiSutun ? `<td>${esc(firmaAd(h.firma_id) || '')}</td>` : ''}<td class="mono">${esc(h.kod)}</td><td>${esc(HAREKET_AD[h.hareket] || h.hareket || 'Güncelleme')}</td><td class="r num ${+h.fark < 0 ? 'neg' : +h.fark > 0 ? 'pos' : ''}">${h.fark == null ? '' : (+h.fark > 0 ? '+' : '') + num(h.fark)}</td><td class="r num">${num(h.stok)}${birimKisa(h.birim)}</td><td><small class="muted">${esc(h.aciklama || '')}</small></td></tr>`).join('')}</tbody></table></div>`;
}
function hareketlerPenceresi(b) {
  const l = (S.stok_gecmis || []).filter(h => h.firma_id && (!b || h.firma_id === b.firma_id));
  const p = openDrawer(`<header class="dh"><div><p class="muted">${b ? esc(bayiAd(b)) : 'Bütün bayiler'}</p><h2 id="drawer-title">Stok hareketleri</h2></div><div class="dh-actions"><button type="button" class="btn sm ghost" data-hxlsx>Excel</button></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="hint">Giriş, çıkış, Excel yüklemesi, düzeltme, pasife alma ve silme: kim, ne zaman, kaç birim. Silinen kalemlerin geçmişi de burada kalır. Son 300 hareket gösterilir.</p>${hareketListesi(l, 300, !b)}</div>`, { wide: true });
  p.querySelector('[data-hxlsx]').onclick = () => exportXlsx(`stok-hareketleri-${today()}`, { Hareketler: l.sort((a, c) => String(c.tarih).localeCompare(String(a.tarih))).map(h => ({ Tarih: h.tarih, Bayi: firmaAd(h.firma_id), Kod: h.kod, Hareket: HAREKET_AD[h.hareket] || h.hareket || '', Fark: h.fark, Kalan: h.stok, Birim: h.birim, Açıklama: h.aciklama })) });
}
// Transfer: işaretli kalemler başka bayiye ya da aynı bayinin başka deposuna; miktar kalem kalem (varsayılan hepsi)
function transferPenceresi(b, kalemler, sonra) {
  const hedefler = dis() ? [b] : bayiler();
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(bayiAd(b))}</p><h2 id="drawer-title">Transfer</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>
      <div class="frow"><label class="fld"><span>Hedef bayi</span><select name="hb">${hedefler.map(x => `<option value="${x.firma_id}" ${x.firma_id === b.firma_id ? 'selected' : ''}>${esc(bayiAd(x))}</option>`).join('')}</select></label>
        <label class="fld"><span>Hedef depo</span><input name="hd" list="tr-depolar" placeholder="${ANA_DEPO}" autocomplete="off"><datalist id="tr-depolar"></datalist></label></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kod</th><th>Ürün</th><th>Nereden</th><th class="r">Mevcut</th><th class="r">Aktarılacak</th></tr></thead><tbody>
        ${kalemler.map(s => `<tr><td class="mono">${esc(s.kod)}</td><td>${esc(s.aciklama || '')}</td><td>${esc(depoAdi(s.depo))}</td><td class="r num">${num(s.adet)}${birimKisa(s.birim)}</td><td class="r"><input type="number" inputmode="decimal" step="any" min="0" max="${+s.adet || 0}" value="${+s.adet || 0}" data-tm="${s.id}" class="sy-say" aria-label="${esc(s.kod)} aktarılacak"></td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Kaynak azalır, hedefte ürün yoksa kalem kartı bilgileriyle açılır. İki taraf da hareket kaydına “Transfer” olarak yazılır.</p>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Aktar</button></div></form>`, { wide: true });
  const hb = p.querySelector('[name=hb]'), dl = p.querySelector('#tr-depolar');
  const depolar = () => { const h = hedefler.find(x => x.firma_id === hb.value); dl.innerHTML = bayiDepolari(h).filter(Boolean).map(d => `<option value="${esc(d)}">`).join(''); };
  hb.onchange = depolar; depolar();
  p.querySelector('form').onsubmit = async e => { e.preventDefault();
    const firma_id = hb.value, hdx = p.querySelector('[name=hd]').value.trim(), depo = !hdx || fold(hdx) === fold(ANA_DEPO) ? null : hdx, hedef = hedefler.find(x => x.firma_id === firma_id);
    const l = kalemler.map(s => ({ s, miktar: +p.querySelector(`[data-tm="${s.id}"]`).value || 0 })).filter(x => x.miktar > 0);
    if (!l.length) return toast('Aktarılacak miktar yok.', 'err');
    if (l.every(x => x.s.firma_id === firma_id && (x.s.depo || null) === depo)) return toast('Kaynak ve hedef aynı.', 'err');
    if (l.some(x => x.miktar > +x.s.adet)) return toast('Aktarılacak miktar mevcut stoktan fazla olamaz.', 'err');
    const hedefAd = `${bayiAd(hedef)}${depo ? ' · ' + depo : ''}`, kaynakAd = bayiAd(b);
    try { const n = await stokTransfer(l, { firma_id, depo, kaynakAd, hedefAd }); toast(`${n} kalem ${hedefAd} hedefine aktarıldı.`); closeDrawer(true); sonra?.(); } catch (er) { toast('Aktarılamadı: ' + er.message, 'err'); }
  };
}
// Şablon ve dışa aktarma: aynı sütunlar (dışa aktarılan dosya düzenlenip geri yüklenebilir)
export const SABLON_SUTUN = ['Ürün kodu', 'Firma stok kodu', 'Açıklama', 'Üretici kodu', 'Üretici açıklaması', 'Birim', 'Miktar', 'Birim fiyat', 'Para birimi', 'Aktif'];
const sablonSatiri = s => Object.fromEntries(SABLON_SUTUN.map((k, i) => [k, [s.kod, s.firma_kodu, s.aciklama, s.uretici_kodu, s.uretici_aciklama, s.birim, +s.adet || 0, s.birim_fiyat ?? (s.kaynak === 'depo' ? s.fiyat : null), s.para_birimi || (s.birim_fiyat != null ? 'USD' : null), aktifMi(s) ? 'Evet' : 'Hayır'][i] ?? null]));
// Bütün stoğu sil: yanlışlıkla basılmasın diye bayinin adı yazılarak onaylanır
function komplesil(b, l, sonra, grup = null, depo = null) {
  if (!l.length) return toast('Silinecek stok kaydı yok.');
  const ad = grup || bayiAd(b);
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(bayiAd(b))}${depo ? ' · ' + esc(depo) : ''}</p><h2 id="drawer-title">${grup ? `“${esc(grup)}” grubundaki stoğu sil` : depo ? `${esc(depo)} deposundaki stoğu sil` : 'Bütün stoğu sil'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate><p><b>${l.length} kalem</b> silinecek (${l.filter(aktifMi).length} aktif, ${l.filter(s => !aktifMi(s)).length} pasif). Stok geçmişi ve raporlardaki eski hareketler kalır.</p>
    ${grup ? '<p class="hint">Bu kalemler başka gruplarda da olsa stoktan tamamen silinir. Yalnız gruptan çıkarmak için kalemleri işaretleyip “Gruptan çıkar”ı kullan.</p>' : ''}
    <p class="hint">Onaylamak için ${grup ? 'grubun' : 'bayinin'} adını yaz: <b>${esc(ad)}</b></p><label class="fld"><span>${grup ? 'Grup adı' : 'Bayi adı'}</span><input data-onayad autocomplete="off" aria-label="${grup ? 'Grup adı' : 'Bayi adı'}"></label>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn danger" data-komple disabled>${grup ? 'Gruptaki stoğu sil' : 'Bütün stoğu sil'}</button></div></form>`);
  const inp = p.querySelector('[data-onayad]'), btn = p.querySelector('[data-komple]');
  inp.oninput = () => { btn.disabled = fold(inp.value.trim()) !== fold(ad); };
  p.querySelector('form').onsubmit = async e => { e.preventDefault(); if (btn.disabled) return; btn.disabled = true;
    try { const n = await bayiStokSil(l, grup ? `“${grup}” grubu silindi` : 'Bütün stok silindi'); toast(`${ad}: ${n} kalem silindi; geçmişi raporlarda duruyor.`); closeDrawer(); sonra?.(); } catch (er) { btn.disabled = false; toast('Silinemedi: ' + er.message, 'err'); } };
}
// Kalem kartı: ürün kodu (ana anahtar), firmanın kendi stok kodu, üretici kodu ve açıklaması, birim, fiyat ve para birimi, aktif / pasif
function stokSatirFormu(b, sonra, x = null, depo0 = null) {
  const FM = [{ title: 'Ürün', fields: [{ k: 'kod', l: 'Ürün kodu', req: true }, { k: 'firma_kodu', l: 'Firma stok kodu', ph: 'Bayinin kendi kodu' }, { k: 'depo', l: 'Depo', t: 'combo', opts: bayiDepolari(b).filter(Boolean), ph: ANA_DEPO }, { k: 'aciklama', l: 'Ürün açıklaması', full: true }] },
    { title: 'Üretici', fields: [{ k: 'uretici_kodu', l: 'Üretici kodu' }, { k: 'uretici_aciklama', l: 'Üretici açıklaması', full: true }] },
    { title: 'Miktar ve fiyat', fields: [{ k: 'adet', l: 'Miktar', t: 'num' }, { k: 'birim', l: 'Birim', t: 'combo', opts: stokBirimleri(), ph: 'Adet, metre, kg…' }, { k: 'birim_fiyat', l: 'Birim fiyat', t: 'num' }, { k: 'kritik', l: 'Kritik seviye', t: 'num', ph: 'Altına düşünce uyarı' }, { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: PARA_BIRIMLERI.map(v => ({ v, l: { USD: 'USD ($)', EUR: 'EUR (€)', TRY: 'TL (₺)' }[v] })) },
      { k: 'aktif', l: 'Durum', t: 'chk', cl: 'Aktif (pasif kalem listeden ve toplamlardan çıkar, geçmişi durur)' }, { k: 'notlar', l: 'Not', t: 'area', full: true }] }];
  const o0 = x ? { ...x, aktif: aktifMi(x) } : { aktif: true, para_birimi: 'USD', birim: 'Adet', depo: depo0 || null };
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(bayiAd(b))}</p><h2 id="drawer-title">${x ? esc(x.kod) : 'Stoğa ürün'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><form class="dbody form" novalidate>${renderForm(FM, o0)}${x ? hareketListesi((S.stok_gecmis || []).filter(h => h.firma_id === b.firma_id && h.kod === x.kod), 20, false) : ''}
    <div class="dfoot sticky">${x ? '<button type="button" class="btn ghost danger" data-ksil>Sil</button>' : ''}<button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, o0);
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, o0); o.kod = String(o.kod || '').trim(); if (!o.kod) return toast('Ürün kodunu yaz.', 'err');
    o.depo = String(o.depo || '').trim(); if (!o.depo || fold(o.depo) === fold(ANA_DEPO)) o.depo = null;
    const cakisan = (S.bayi_stok || []).find(s => ayniKalem(s, b.firma_id, o.kod, o.depo) && s.id !== x?.id);
    if (cakisan && x) return toast(`${o.kod} kodu bu depoda zaten var.`, 'err');
    if (!o.aciklama) o.aciklama = S.urunler.find(u => u.kod === o.kod)?.aciklama || null;
    if (o.birim) await birimEkle(o.birim);
    const satir = { ...(cakisan || x || {}), firma_id: b.firma_id, ...o, adet: +o.adet || 0, birim_fiyat: o.birim_fiyat === '' || o.birim_fiyat == null ? null : +o.birim_fiyat, kritik: o.kritik === '' || o.kritik == null ? null : +o.kritik, para_birimi: o.para_birimi || 'USD', aktif: !!o.aktif };
    await bayiStokYaz([satir], { hareket: x || cakisan ? 'duzeltme' : 'giris', aciklama: 'Kalem kartı' }); toast('Kaydedildi.'); closeDrawer(); sonra?.(); };
  p.querySelector('[data-ksil]')?.addEventListener('click', async () => {
    if (!confirmBox(`${x.kod}${x.aciklama ? ' – ' + x.aciklama : ''} stoktan silinsin mi?\n\nGeçmiş hareketleri raporlarda kalır. Satılmayan ürünü silmek yerine "Aktif" işaretini kaldırıp pasife de alabilirsin.`)) return;
    await bayiStokSil([x], 'Kalem kartından silindi'); toast(`${x.kod} silindi.`); closeDrawer(); sonra?.();
  });
}
// Varsayılan sütun eşlemesi (başlık adlarından): şablon, aydınlatma depo formatı ve genel tablolar
export function stokVarsayilanEsleme(baslik, veri = []) {
  const h = baslik.map(c => fold(c || '')), col = (...re) => { for (const r of re) { const i = h.findIndex(x => r.test(x)); if (i >= 0) return i; } return -1; };
  let cF0 = col(/fiyat/); if (cF0 < 0 && veri.some(r => typeof r[9] === 'number')) cF0 = 9;   // depo formatı: sağdaki blokta birim fiyat
  // Ürün kodu: "Ürün kodu" / "Kod" / "Malzeme kodu"; bunlar yoksa (eski depo formatı) üretici kodu ürün kodudur
  const cKod = col(/^urun kod/, /^kod$/, /^kod\b/, /^malzeme kod/, /uretici kod/, /^(?!.*(firma|bayi|stok kod|uretici)).*kod/, /malzeme/);
  const cUk = col(/uretici kod/, /imalatci kod/), cFk = col(/firma (stok )?kod/, /bayi kod/, /kendi kod/, /^stok kod/);
  return { kod: Math.max(0, cKod), fk: cFk, ac: col(/^aciklama/, /^urun tanim/, /^tanim/, /urun ad/, /malzeme ad/, /^urun$/), uk: cUk === cKod ? -1 : cUk, ua: col(/uretici ac/, /uretici tanim/),
    bir: col(/^birim$/, /^olcu birim/, /^birim(?!.*fiyat)/), stok: col(/fiili stok/, /^stok$/, /^stok miktar/, /^miktar/, /miktar/, /adet/), fiyat: cF0, pb: col(/para birim/, /^doviz/, /^pb$/, /currency/), aktif: col(/^aktif/, /^durum/) };
}
// Sayı: Excel sayısı olduğu gibi; metinde "1.250,50" (TR), "1,5" ve "12.5" biçimleri
export const stokSayi = v => { if (typeof v === 'number') return v; let x = String(v ?? '').trim().replace(/\s/g, ''); if (!x) return 0;
  if (x.includes(',') && x.includes('.')) x = x.lastIndexOf(',') > x.lastIndexOf('.') ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
  else if (x.includes(',')) x = x.replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, '');
  return +x || 0; };
// Satırları okur: kod → { kod, firma_kodu, aciklama, uretici_kodu, uretici_aciklama, birim, adet, fiyat, pb, aktif }
export function stokSatirlariOku(veri, M) {
  const sayi = stokSayi;
  const metin = i => (r => i >= 0 && r[i] != null && String(r[i]).trim() !== '' ? String(r[i]).trim() : null);
  const gelen = new Map();
  for (const r of veri) { const kod = r[M.kod] != null ? String(r[M.kod]).trim() : ''; if (!kod) continue;
    const fy = M.fiyat >= 0 && r[M.fiyat] != null && String(r[M.fiyat]).trim() !== '' ? sayi(r[M.fiyat]) : null, akt = metin(M.aktif)(r);
    gelen.set(kod, { kod, firma_kodu: metin(M.fk)(r), aciklama: metin(M.ac)(r), uretici_kodu: metin(M.uk)(r), uretici_aciklama: metin(M.ua)(r), birim: metin(M.bir)(r), adet: M.stok >= 0 ? sayi(r[M.stok]) : 0,
      fiyat: fy, pb: pbNorm(metin(M.pb)(r)), aktif: akt == null ? null : !/^(hayir|hayır|pasif|0|false|yok|h)$/i.test(akt) }); }
  return gelen;
}
// Excel yüklemeden önce: bu liste hangi gruba? (grup sekmesi açıksa o grup; gruplar varsa sorulur)
function grupSorVeYukle(b, grup, GR, sonra, depo = null) {
  if (grup || !GR.length) return stokExcel(b, sonra, grup, depo);
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(bayiAd(b))}</p><h2 id="drawer-title">Bu liste hangi gruba?</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="hint">Bir grup seçersen yüklenen ürünler o gruba eklenir ve listede olmayanları sıfırlama yalnız o grubun içinde yapılır. Böylece kablo listesi yüklenince aydınlatma stoğu sıfırlanmaz.</p>
    <div class="sg-sec"><label class="chk"><input type="radio" name="hg" value="" checked> <span>Grup yok (bütün stok)</span></label>${GR.map(g => `<label class="chk"><input type="radio" name="hg" value="${g.id}"> <span>${esc(g.ad)}</span></label>`).join('')}</div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-hgdevam>Dosya seç</button></div></div>`);
  p.querySelector('[data-hgdevam]').onclick = () => { const g = p.querySelector('[name=hg]:checked')?.value || null; closeDrawer(true); stokExcel(b, sonra, g, depo); };
}
// Bayinin stok Excel dosyası (aydınlatma depo formatı, şablon ya da başlıklı genel tablo): sütun eşleme, önizleme, listede olmayanları sıfırlama
async function stokExcel(b, sonra, grup = null, depo = null) {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    await (await import('../ui.js')).xlsxYukle();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.some(c => /kod/i.test(String(c || '')))); if (hi < 0) return toast('Başlıkta "Kod" sütunu bulunamadı.', 'err');
    const VARS = stokVarsayilanEsleme(rows[hi], rows.slice(hi + 1));
    const { sutunlariEsle, onizleOnay } = await import('../esle.js');
    const M = await sutunlariEsle('stok', `${bayiAd(b)} stok listesi`, rows[hi].map(x => String(x ?? '')), rows.slice(hi + 1, hi + 4), [
      { k: 'kod', l: 'Ürün kodu', zorunlu: true }, { k: 'fk', l: 'Firma stok kodu' }, { k: 'ac', l: 'Açıklama' }, { k: 'uk', l: 'Üretici kodu' }, { k: 'ua', l: 'Üretici açıklaması' },
      { k: 'bir', l: 'Birim' }, { k: 'stok', l: 'Miktar', zorunlu: true }, { k: 'fiyat', l: 'Birim fiyat' }, { k: 'pb', l: 'Para birimi' }, { k: 'aktif', l: 'Aktif / pasif' }],
      VARS);
    if (!M) return toast('Yükleme iptal edildi.');
    for (const k of ['fk', 'uk', 'ua', 'pb', 'aktif']) if (M[k] == null) M[k] = -1;
    const den = kodSutunuDenetle(rows[hi].map(x => String(x ?? '')), rows.slice(hi + 1), M);
    if (den.degisti) {
      Object.assign(M, den.M); const ad = i => i >= 0 ? String(rows[hi][i] ?? `Sütun ${i + 1}`) : 'yok';
      toast(`Kod sütunu düzeltildi: “${ad(M.kod)}” ürün kodu, açıklama “${ad(M.ac)}”.`);
      const k = ayar('excel_esle', {}) || {}; if (k.stok) { k.stok = { ...k.stok, kod: M.kod >= 0 ? String(rows[hi][M.kod] ?? '') : null, ac: M.ac >= 0 ? String(rows[hi][M.ac] ?? '') : null }; await ayarYaz('excel_esle', k); }
    }
    const gelen = stokSatirlariOku(rows.slice(hi + 1), M);
    if (!gelen.size) return toast('Dosyada ürün satırı bulunamadı.', 'err');
    const mevcut = new Map((S.bayi_stok || []).filter(s => s.firma_id === b.firma_id && (s.depo || null) === (depo || null)).map(s => [s.kod, s]));
    const gl = [...gelen.values()], yeni = gl.filter(g => !mevcut.has(g.kod)), degisen = gl.filter(g => mevcut.has(g.kod) && +mevcut.get(g.kod).adet !== g.adet);
    const grupAdi = grup ? (S.stok_gruplari || []).find(g => g.id === grup)?.ad : null;
    const yok = [...mevcut.values()].filter(s => !gelen.has(s.kod) && +s.adet > 0 && (!grup || kalemGruplari(s).includes(grup)));
    const on = await onizleOnay({ baslik: `${bayiAd(b)}${depo ? ' · ' + depo : ''} stok listesi${grupAdi ? ' → ' + grupAdi : ''}`, sayilar: [['yeni ürün', yeni.length, 'yeni'], ['miktarı değişen', degisen.length, 'guncel'], ['aynı kalan', gl.length - yeni.length - degisen.length, ''], ['listede olmayan', yok.length, yok.length ? 'uyari' : '']],
      ornekBaslik: ['Kod', 'Açıklama', 'Eski', 'Yeni'], ornek: [...degisen, ...yeni].slice(0, 8).map(g => [g.kod, g.aciklama || '', mevcut.get(g.kod)?.adet ?? '—', `${g.adet}${birimKisa(g.birim)}`]),
      secenek: yok.length ? { metin: `Yeni listede olmayan ${yok.length} ürünün miktarını 0 yap${grupAdi ? ` (yalnız “${grupAdi}” grubunda)` : ''} (kayıtları silinmez)`, varsayilan: true } : null });
    if (!on.ok) return toast('İçe aktarma iptal edildi.');
    for (const bi of new Set(gl.map(g => g.birim).filter(Boolean))) await birimEkle(bi);
    const kayit = gl.map(g => { const e = mevcut.get(g.kod); const ilk = (k, v) => v ?? e?.[k] ?? null;
      return { ...(e || {}), firma_id: b.firma_id, depo: depo || null, kod: g.kod, aciklama: g.aciklama || e?.aciklama || S.urunler.find(u => u.kod === g.kod)?.aciklama || null, firma_kodu: ilk('firma_kodu', g.firma_kodu), uretici_kodu: ilk('uretici_kodu', g.uretici_kodu), uretici_aciklama: ilk('uretici_aciklama', g.uretici_aciklama),
        birim: ilk('birim', g.birim), adet: g.adet, birim_fiyat: g.fiyat ?? e?.birim_fiyat ?? null, para_birimi: g.pb || e?.para_birimi || (g.fiyat != null ? 'USD' : e?.para_birimi ?? null), aktif: g.aktif ?? e?.aktif ?? true,
        gruplar: grup ? [...new Set([...kalemGruplari(e), grup])] : kalemGruplari(e) }; });
    if (yok.length && on.secim) for (const e of yok) kayit.push({ ...e, adet: 0 });
    toast('Stok kaydediliyor…');
    await bayiStokYaz(kayit, { hareket: 'excel', aciklama: file.name });
    // Ürün listesinde olmayan kodlar ürün ve fiyat listesine eklenir (stoksuz)
    if (sahipMi() || izin('urunler') === 'yaz') { const { uuid } = await import('../db.js'); const yeniU = gl.filter(g => !S.urunler.some(u => u.kod === g.kod) && g.aciklama && !siraSutunu([g.kod]) && /\s|[a-zçğıöşü]{3}/i.test(g.aciklama));
      if (yeniU.length) try { await app.db.bulk('urunler', yeniU.map(g => ({ id: uuid(), kod: g.kod, aciklama: g.aciklama, birim: g.birim || 'ADET', aile: g.aciklama.split(/\s+/)[0].toUpperCase(), birim_fiyat_usd: (g.pb || 'USD') === 'USD' ? g.fiyat : null }))); } catch {} }
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
