import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, gunEkle, RAKIPLER, URUN_AILELERI, byId, match, toast, openDrawer, closeDrawer, confirmBox, exportXlsx, pickFiles, fold } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { cubuklar, ikili } from '../grafik.js';
import { yuklemeKaydet } from '../belgeler.js';

const num2 = n => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const aileKey = s => fold(s || '').replace(/[^a-z0-9]/g, '');

// Stok uyarıları: açık tekliflerin ihtiyacı stoktan fazla olan ürünler ve 60 günü aşkın süredir stoğu hiç değişmeyen ürünler
export function stokUyarilari(gun = 60) {
  const ihtiyac = new Map();
  for (const t of S.teklifler) if (['Taslak', 'Gönderildi'].includes(t.durum)) for (const k of t.kalemler || []) if (k.kod) ihtiyac.set(k.kod, (ihtiyac.get(k.kod) || 0) + (+k.adet || 0));
  const yetersiz = [];
  for (const [kod, adet] of ihtiyac) { const u = S.urunler.find(x => x.kod === kod); if (u && adet > (+u.stok || 0)) yetersiz.push({ u, ihtiyac: adet, eksik: adet - (+u.stok || 0) }); }
  const sinir = gunEkle(today(), -gun), hist = new Map();
  for (const h of S.stok_gecmis) (hist.get(h.kod) || hist.set(h.kod, []).get(h.kod)).push(h);
  const hareketsiz = [];
  for (const u of S.urunler) {
    if (!(u.stok > 0)) continue;
    const hs = (hist.get(u.kod) || []).sort((a, b) => b.tarih.localeCompare(a.tarih));
    if (!hs.length) continue;
    let ilk = hs[0].tarih; // stoğun bugünkü değere ulaştığı en eski tarih
    for (const h of hs) { if (+h.stok !== +u.stok) break; ilk = h.tarih; }
    if (ilk <= sinir) hareketsiz.push({ u, gun: Math.round((new Date(today()) - new Date(ilk)) / 864e5), deger: (+u.stok || 0) * (+u.birim_fiyat_usd || 0) });
  }
  hareketsiz.sort((a, b) => b.deger - a.deger);
  return { yetersiz, hareketsiz };
}

export function urunlerView(el) {
  const f = F('urunler', { q: '', aile: 'Tümü', stokta: false });
  const aileler = [...new Set(S.urunler.map(u => u.aile).filter(Boolean))].sort();
  const sonTarih = S.urunler.map(u => u.stok_tarihi).filter(Boolean).sort().pop();
  el.innerHTML = `<header class="vh"><div><h1>Stok ve birim fiyat</h1><p class="sum">${S.urunler.length} kalem · ${S.urunler.filter(u => u.stok > 0).length} kalem stokta${sonTarih ? ` · stok tarihi ${tarih(sonTarih)}` : ''}</p></div>
    <div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-up>Stok Excel'i yükle</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Ürün kodu veya açıklama ara (örn. HBL 150)" value="${esc(f.q)}" aria-label="Ürünlerde ara">
      <div class="frow"><label>Ürün ailesi <select data-aile>${['Tümü', ...aileler].map(a => `<option ${f.aile === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label><label class="chk"><input type="checkbox" data-stokta ${f.stokta ? 'checked' : ''}> <span>Sadece stokta olanlar</span></label></div></div>
    <section class="ledger stock-ledger" data-ledger></section>
    <div data-uyari></div>
    <details class="aile-ozet"><summary>Aile bazında ortalama fiyatlar</summary><div data-ozet></div></details>
    <div class="rows products" data-rows></div>`;
  const list = () => S.urunler.filter(u => (f.aile === 'Tümü' || u.aile === f.aile) && (!f.stokta || u.stok > 0) && match(f.q, u.kod, u.aciklama, u.aciklama2)).sort((a, b) => (a.aile || '').localeCompare(b.aile || '') || a.aciklama.localeCompare(b.aciklama));
  const su = stokUyarilari();
  if (su.yetersiz.length || su.hareketsiz.length) el.querySelector('[data-uyari]').innerHTML = `<details class="card warnbox" ${su.yetersiz.length ? 'open' : ''}><summary><b>Stok uyarıları</b> <span class="muted">${su.yetersiz.length} yetersiz · ${su.hareketsiz.length} hareketsiz</span></summary>
    ${su.yetersiz.length ? `<h3>Açık tekliflere yetmeyen stok</h3><ul class="list">${su.yetersiz.map(x => `<li><span><b>${esc(x.u.aciklama)}</b><span class="muted"> · tekliflerde ${num(x.ihtiyac)}, stokta ${num(x.u.stok)}</span></span><b class="neg">${num(x.eksik)} eksik</b></li>`).join('')}</ul>` : ''}
    ${su.hareketsiz.length ? `<h3>${num(su.hareketsiz.length)} ürün 60 günü aşkın süredir hareketsiz</h3><p class="hint">Stok adedi hiç değişmemiş; kampanyaya ya da projeye yönlendirilebilir. Toplam ${num(Math.round(su.hareketsiz.reduce((a, x) => a + x.deger, 0)))} $.</p><ul class="list">${su.hareketsiz.slice(0, 15).map(x => `<li><span><b>${esc(x.u.aciklama)}</b><span class="muted"> · ${num(x.u.stok)} adet · ${x.gun} gün</span></span><span class="num">${x.deger ? num(Math.round(x.deger)) + ' $' : ''}</span></li>`).join('')}</ul>` : ''}
  </details>`;
  const draw = () => {
    const l = list();
    const deger = u => (+u.stok || 0) * (+u.birim_fiyat_usd || 0);
    const topAdet = l.reduce((a, u) => a + (+u.stok || 0), 0), topTutar = l.reduce((a, u) => a + deger(u), 0);
    const fiyatsiz = l.filter(u => u.stok > 0 && u.birim_fiyat_usd == null).length;
    const filtreli = l.length !== S.urunler.length;
    el.querySelector('[data-ledger]').innerHTML = `<div><span>Toplam stok tutarı${filtreli ? ' (filtrelenen)' : ''}</span><b>${num2(topTutar)} $</b><small>${fiyatsiz ? `${fiyatsiz} stoklu kalemin birim fiyatı yok, tutara katılmadı` : 'stok × birim fiyat'}</small></div>
      <div><span>Toplam ürün adedi</span><b>${num(topAdet)}</b><small>${l.filter(u => u.stok > 0).length} kalem stokta</small></div>
      <div><span>Kalem</span><b>${l.length}</b><small>${filtreli ? `tümü ${S.urunler.length} kalem` : 'listede'}</small></div>`;
    el.querySelector('[data-rows]').innerHTML = l.length ? `<div class="row head" aria-hidden="true"><span>Ürün</span><span>Aile</span><span class="r">Stok adedi</span><span class="r">Birim fiyat</span><span class="r">Kalem tutarı</span></div>` +
      l.map(u => `<button type="button" class="row" data-id="${u.id}"><span class="nm"><b>${esc(u.aciklama)}</b><small>${esc(u.kod)}${u.aciklama2 ? ' · ' + esc(u.aciklama2) : ''}</small></span><span class="muted">${esc(u.aile || '')}</span>
        <span class="r num ${u.stok > 0 ? '' : 'muted'}">${num(u.stok)} ${esc((u.birim || '').toLowerCase())}</span><span class="r num">${u.birim_fiyat_usd != null ? num(u.birim_fiyat_usd) + ' $' : '—'}</span><span class="r num ${deger(u) ? '' : 'muted'}">${deger(u) ? num2(deger(u)) + ' $' : '—'}</span></button>`).join('')
      + `<div class="row foot"><span class="nm"><b>Toplam</b><small>${l.length} kalem</small></span><span></span><span class="r num"><b>${num(topAdet)}</b></span><span></span><span class="r num"><b>${num2(topTutar)} $</b></span></div>`
      : '<div class="empty"><p>Ürün yok. Bayinin stok Excel dosyasını “Stok Excel\'i yükle” ile ekle.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => urunDetay(b.dataset.id));
    const groups = {};
    for (const u of S.urunler) (groups[u.aile] ||= []).push(u);
    el.querySelector('[data-ozet]').innerHTML = `<table class="tbl"><thead><tr><th>Aile</th><th class="r">Kalem</th><th class="r">Stok</th><th class="r">Ort. birim fiyat</th><th class="r">Rakip ort.</th></tr></thead><tbody>${
      Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([a, us]) => {
        const rp = S.rakip_fiyatlar.filter(r => aileKey(r.aile) === aileKey(a) && r.birim_fiyat).map(r => +r.birim_fiyat);
        return `<tr><td>${esc(a)}</td><td class="r">${us.length}</td><td class="r">${num(us.reduce((s, u) => s + (+u.stok || 0), 0))}</td><td class="r">${num(avg(us.filter(u => u.birim_fiyat_usd).map(u => +u.birim_fiyat_usd)))} $</td><td class="r">${rp.length ? num(avg(rp)) + ' $' : '—'}</td></tr>`;
      }).join('')}</tbody></table><p class="hint">Rakip ortalaması, “Rakip fiyatları” ekranında aynı aileye girilen birim fiyatlardan hesaplanır.</p>`;
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelector('[data-aile]').onchange = e => { f.aile = e.target.value; saveFilters(); draw(); };
  el.querySelector('[data-stokta]').onchange = e => { f.stokta = e.target.checked; saveFilters(); draw(); };
  el.querySelector('[data-up]').onclick = stokYukle;
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`stok-fiyat-${today()}.xlsx`, { 'Stok': list().map(u => ({ 'Kod': u.kod, 'Açıklama': u.aciklama, 'Aile': u.aile, 'Birim': u.birim, 'Stok': u.stok, 'Birim fiyat (USD)': u.birim_fiyat_usd, 'Kalem tutarı (USD)': Math.round((+u.stok || 0) * (+u.birim_fiyat_usd || 0) * 100) / 100, 'Stok tarihi': u.stok_tarihi, 'Depo': u.depo })) });
  draw();
}

function urunDetay(id) {
  const u = byId('urunler', id);
  const hist = S.stok_gecmis.filter(h => h.kod === u.kod).sort((a, b) => b.tarih.localeCompare(a.tarih));
  const rp = S.rakip_fiyatlar.filter(r => aileKey(r.aile) === aileKey(u.aile));
  const FORM = [{ title: 'Fiyat ve stok', fields: [{ k: 'birim_fiyat_usd', l: 'Birim fiyat (USD)', t: 'num' }, { k: 'stok', l: 'Stok', t: 'num' }, { k: 'aile', l: 'Ürün ailesi', t: 'combo', opts: URUN_AILELERI }, { k: 'depo', l: 'Depo' }] }];
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${esc(u.kod)}</p><h2 id="drawer-title">${esc(u.aciklama)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>${renderForm(FORM, u)}
    <section class="rel"><h3>Rakip fiyatları (${esc(u.aile)} ailesi)</h3>${rp.length ? `<ul class="list">${rp.map(r => `<li><span><b>${esc(r.marka)}</b> ${esc(r.urun_adi || '')} <span class="muted">${esc(r.lumen_aralik || '')}</span></span><b class="num">${esc(r.fiyat_metin || (r.birim_fiyat + ' USD'))}</b></li>`).join('')}</ul>` : '<p class="hint">Bu aile için rakip fiyatı girilmemiş.</p>'}
    <h3>Stok geçmişi</h3>${hist.length ? `<ul class="list">${hist.map(h => `<li><span class="muted">${tarih(h.tarih)}</span><span>${num(h.stok)}</span><span class="num">${h.birim_fiyat_usd != null ? num(h.birim_fiyat_usd) + ' $' : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Yeni stok dosyası yüklendikçe geçmiş burada birikir.</p>'}</section>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, FORM, u);
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FORM, u); await app.db.save('urunler', o); toast('Ürün güncellendi.'); closeDrawer(); app.refresh(); };
}

// Bayinin stok Excel dosyasını okur (aydınlatma depo formatı veya başlıklı genel tablo)
async function stokYukle() {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false });
  if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.some(c => /kod/i.test(String(c || ''))));
    const h = (rows[hi] || []).map(c => fold(c || ''));
    const col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
    let cFiyat0 = col(/fiyat/);
    if (cFiyat0 < 0 && rows.slice(hi + 1).some(r => typeof r[9] === 'number')) cFiyat0 = 9; // depo formatı: sağdaki blokta birim fiyat
    const { sutunlariEsle } = await import('../esle.js');
    const M = await sutunlariEsle('stok', 'Bayi stok listesi', (rows[hi] || []).map(x => String(x ?? '')), rows.slice(hi + 1, hi + 4), [
      { k: 'kod', l: 'Ürün kodu', zorunlu: true }, { k: 'ac', l: 'Açıklama', zorunlu: true }, { k: 'bir', l: 'Birim' }, { k: 'stok', l: 'Stok miktarı', zorunlu: true }, { k: 'fiyat', l: 'Birim fiyat (USD)' }],
      { kod: Math.max(0, col(/uretici kod/, /^kod/, /malzeme/)), ac: Math.max(1, col(/aciklama/)), bir: col(/birim/), stok: col(/fiili stok/, /^stok/, /miktar/), fiyat: cFiyat0 });
    if (!M) return toast('Yükleme iptal edildi.');
    const cKod = M.kod, cAc = M.ac, cBir = M.bir, cStok = M.stok, cFiyat = M.fiyat;
    const gelen = new Map();
    for (const r of rows.slice(hi + 1)) {
      const kod = r[cKod] != null ? String(r[cKod]).trim() : ''; if (!kod || !r[cAc]) continue;
      gelen.set(kod, { kod, aciklama: String(r[cAc]).trim(), birim: cBir >= 0 ? r[cBir] : 'ADET', stok: cStok >= 0 && typeof r[cStok] === 'number' ? r[cStok] : 0, fiyat: cFiyat >= 0 && typeof r[cFiyat] === 'number' ? r[cFiyat] : null });
    }
    if (!gelen.size) return toast('Dosyada ürün satırı bulunamadı. Başlıkta “Kod” ve “Stok” sütunları olmalı.', 'err');
    const mevcut = new Map(S.urunler.map(u => [u.kod, u]));
    const yok = S.urunler.filter(u => !gelen.has(u.kod) && u.stok > 0);
    const sifirla = yok.length && confirmBox(`${gelen.size} ürün okundu. Yeni listede olmayan ${yok.length} ürünün stoğu 0 yapılsın mı?`);
    const t = today(), urunRows = [], gecmis = [];
    for (const g of gelen.values()) {
      const u = mevcut.get(g.kod);
      urunRows.push({ ...(u || { id: uuid(), aile: g.aciklama.split(/\s+/)[0].toUpperCase(), depo: 'Drv Elektrik' }), kod: g.kod, aciklama: g.aciklama, birim: g.birim || u?.birim || 'ADET', stok: g.stok, birim_fiyat_usd: g.fiyat ?? u?.birim_fiyat_usd ?? null, stok_tarihi: t });
      gecmis.push({ id: uuid(), kod: g.kod, stok: g.stok, birim_fiyat_usd: g.fiyat, tarih: t, depo: u?.depo || 'Drv Elektrik' });
    }
    if (sifirla) for (const u of yok) { urunRows.push({ ...u, stok: 0, stok_tarihi: t }); gecmis.push({ id: uuid(), kod: u.kod, stok: 0, birim_fiyat_usd: u.birim_fiyat_usd, tarih: t, depo: u.depo }); }
    toast('Stok kaydediliyor…');
    await app.db.bulk('urunler', urunRows); await app.db.bulk('stok_gecmis', gecmis);
    toast(`Stok güncellendi: ${gelen.size} ürün${sifirla ? `, ${yok.length} ürün sıfırlandı` : ''}.`); app.refresh();
    yuklemeKaydet(file, 'Bayi stok listesi', `${gelen.size} ürün${sifirla ? `, ${yok.length} ürün sıfırlandı` : ''}`);
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
}

// ---------- Rakip fiyatları ----------
const RAKIP_FORM = [{ title: 'Rakip fiyatı', fields: [
  { k: 'marka', l: 'Marka', t: 'combo', opts: RAKIPLER, auto: true },
  { k: 'urun_adi', l: 'Ürün adı / model' },
  { k: 'aile', l: 'Karşılık gelen ürün ailemiz', t: 'combo', opts: URUN_AILELERI },
  { k: 'lumen_aralik', l: 'Lümen aralığı', t: 'combo', opts: ['0-5.000 lm', '5.000-10.000 lm', '10.000-15.000 lm', '15.000-20.000 lm', '20.000-30.000 lm', '30.000 ve daha yüksek lm'] },
  { k: 'birim_fiyat', l: 'Birim fiyat', t: 'num' },
  { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['USD', 'EUR', 'TRY'] },
  { k: 'fiyat_metin', l: 'Fiyat notu', ph: 'Örn. 160–180 USD arası' },
  { k: 'tarih', l: 'Tarih', t: 'date' },
  { k: 'kaynak', l: 'Kaynak', t: 'combo', opts: ['Kayıp proje', 'Müşteri', 'Bayi', 'Rakip teklifi', 'Sunum'] },
  { k: 'proje_id', l: 'İlgili proje', t: 'ref', ref: 'projeler' },
  { k: 'notlar', l: 'Not', t: 'area' },
]}];

export function rakipForm(init = {}) {
  const r0 = init.id ? byId('rakip_fiyatlar', init.id) : { id: uuid(), para_birimi: 'USD', tarih: today(), ...init, _new: true };
  const r = { ...r0 };
  const panel = openDrawer(`<header class="dh"><h2 id="drawer-title">${r._new ? 'Rakip fiyatı ekle' : esc(r.marka)}</h2><button class="x" data-close aria-label="Kapat">×</button></header>
    ${r._new ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>'}
    <form class="dbody form" novalidate>${renderForm(RAKIP_FORM, r)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, RAKIP_FORM, r);
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { await app.db.del('rakip_fiyatlar', r.id); closeDrawer(); app.refresh(); });
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, RAKIP_FORM, r); if (!o.marka) return toast('Markayı yaz.', 'err'); await app.db.save('rakip_fiyatlar', o); toast('Rakip fiyatı kaydedildi.'); closeDrawer(); app.refresh(); };
}

export function rakipView(el) {
  const f = F('rakip', { q: '', marka: 'Tümü', gor: 'fiyat', yil: 'Tümü' });
  if (f.gor === 'analiz') return rakipAnaliz(el, f);
  const markalar = [...new Set(S.rakip_fiyatlar.map(r => r.marka))].sort();
  el.innerHTML = `<header class="vh"><div><h1>Rakip fiyatları</h1><p class="sum">${S.rakip_fiyatlar.length} fiyat kaydı · ${markalar.length} marka</p></div>
    <div class="vh-act">${gorSeg(f)}<button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Fiyat ekle</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Marka, ürün, aile ara" value="${esc(f.q)}" aria-label="Rakip fiyatlarında ara">
      <div class="chips">${['Tümü', ...markalar].map(m => `<button type="button" class="chip ${f.marka === m ? 'on' : ''}" data-m="${esc(m)}" style="--c:#B91C1C">${esc(m)}</button>`).join('')}</div></div>
    <div data-rows></div>`;
  const draw = () => {
    const l = S.rakip_fiyatlar.filter(r => (f.marka === 'Tümü' || r.marka === f.marka) && match(f.q, r.marka, r.urun_adi, r.aile, r.notlar));
    const groups = {}; for (const r of l) (groups[r.aile || 'Ailesi belirtilmemiş'] ||= []).push(r);
    el.querySelector('[data-rows]').innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([a, rs]) => {
      const biz = avg(S.urunler.filter(u => aileKey(u.aile) === aileKey(a) && u.birim_fiyat_usd).map(u => +u.birim_fiyat_usd));
      return `<section class="grp"><h2>${esc(a)} <span class="muted">${biz ? `bizim ortalama birim fiyat ${num(biz)} $` : ''}</span></h2>
        <table class="tbl"><thead><tr><th>Marka</th><th>Ürün</th><th>Lümen</th><th class="r">Fiyat</th><th>Kaynak</th><th>Tarih</th></tr></thead><tbody>${rs.map(r => `<tr data-id="${r.id}" tabindex="0"><td><b>${esc(r.marka)}</b></td><td>${esc(r.urun_adi || '')}${r.proje_id ? `<small>${esc(byId('projeler', r.proje_id)?.ad || '')}</small>` : ''}</td><td>${esc(r.lumen_aralik || '')}</td>
        <td class="r num">${esc(r.fiyat_metin || (r.birim_fiyat != null ? r.birim_fiyat + ' ' + r.para_birimi : ''))}${biz && r.birim_fiyat ? `<small>${r.birim_fiyat < biz ? 'bizden %' + num((biz - r.birim_fiyat) / biz * 100) + ' ucuz' : 'bizden %' + num((r.birim_fiyat - biz) / biz * 100) + ' pahalı'}</small>` : ''}</td><td>${esc(r.kaynak || '')}</td><td>${tarih(r.tarih)}</td></tr>`).join('')}</tbody></table></section>`;
    }).join('') : '<div class="empty"><p>Rakip fiyatı yok. Sahada duyduğun fiyatları “Fiyat ekle” ile kaydet; kayıp projelerdeki birim fiyatlar buraya kendiliğinden düşer.</p></div>';
    el.querySelectorAll('tr[data-id]').forEach(t => { t.onclick = () => rakipForm({ id: t.dataset.id }); t.onkeydown = e => { if (e.key === 'Enter') rakipForm({ id: t.dataset.id }); }; });
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { f.marka = b.dataset.m; el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); saveFilters(); draw(); });
  gorBagla(el, f);
  el.querySelector('[data-new]').onclick = () => rakipForm({});
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`rakip-fiyatlari-${today()}.xlsx`, { 'Rakip fiyatları': S.rakip_fiyatlar.map(r => ({ 'Aile': r.aile, 'Marka': r.marka, 'Ürün': r.urun_adi, 'Lümen': r.lumen_aralik, 'Birim fiyat': r.birim_fiyat, 'Para birimi': r.para_birimi, 'Fiyat notu': r.fiyat_metin, 'Kaynak': r.kaynak, 'Proje': byId('projeler', r.proje_id)?.ad, 'Tarih': r.tarih, 'Not': r.notlar })) });
  draw();
}

const gorSeg = f => `<div class="seg" role="group" aria-label="Görünüm"><button type="button" data-rg="fiyat" class="${f.gor !== 'analiz' ? 'on' : ''}">Fiyatlar</button><button type="button" data-rg="analiz" class="${f.gor === 'analiz' ? 'on' : ''}">Analiz</button></div>`;
const gorBagla = (el, f) => el.querySelectorAll('[data-rg]').forEach(b => b.onclick = () => { f.gor = b.dataset.rg; saveFilters(); rakipView(el); });
const usdK = v => v ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v) + ' $' : '0 $';

// Rakip analizi: kayıplar markaya ve nedene göre, aile bazında fiyat karşılaştırması, çeyreklere göre kazanılan / kaybedilen
function rakipAnaliz(el, f) {
  const yillar = [...new Set(S.projeler.map(p => p.takip_yili).filter(Boolean))].sort();
  const yP = S.projeler.filter(p => f.yil === 'Tümü' || String(p.takip_yili) === String(f.yil));
  const kayip = yP.filter(p => p.durum === 'Kayıp'), kazanc = yP.filter(p => p.durum === 'Sipariş');
  const tutar = p => +p.bizim_teklif_usd || +p.tutar_usd || 0;
  const marka = {}; for (const p of kayip) { const m = p.rakip_marka || 'Belirtilmemiş'; (marka[m] ||= { n: 0, t: 0 }); marka[m].n++; marka[m].t += tutar(p); }
  const neden = {}; for (const p of kayip) { const k = p.kayip_nedeni || 'Belirtilmemiş'; neden[k] = (neden[k] || 0) + 1; }
  const oran = kazanc.length + kayip.length ? Math.round(kazanc.length / (kazanc.length + kayip.length) * 100) : null;
  // Fiyat farkı: kayıp projelerde bizim teklif / rakip toplam
  const fark = kayip.filter(p => p.bizim_teklif_usd && p.rakip_toplam_usd).map(p => (p.bizim_teklif_usd - p.rakip_toplam_usd) / p.rakip_toplam_usd * 100);
  // Aile bazında birim fiyat: bizim ortalama ve markaların ortalaması
  const aileler = {};
  for (const r of S.rakip_fiyatlar) if (r.birim_fiyat && (r.para_birimi || 'USD') === 'USD' && r.aile) ((aileler[r.aile] ||= {})[r.marka] ||= []).push(+r.birim_fiyat);
  // Çeyreklere göre kazanılan / kaybedilen (durum geçmişinden)
  const Y = f.yil === 'Tümü' ? new Date().getFullYear() : +f.yil;
  const ceyrek = [1, 2, 3, 4].map(c => ({ etiket: c + '. çeyrek', a: 0, b: 0 }));
  for (const g of S.proje_gecmis) { if (!g.tarih?.startsWith(String(Y))) continue; const c = Math.floor(new Date(g.tarih).getMonth() / 3); if (g.yeni_durum === 'Sipariş') ceyrek[c].a++; if (g.yeni_durum === 'Kayıp') ceyrek[c].b++; }
  el.innerHTML = `<header class="vh"><div><h1>Rakip analizi</h1><p class="sum">${kayip.length} kayıp · ${kazanc.length} kazanılan${oran != null ? ` · kazanma oranı %${oran}` : ''}</p></div><div class="vh-act">${gorSeg(f)}</div></header>
    <div class="filters"><div class="frow"><label>Takip yılı <select data-yil>${['Tümü', ...yillar].map(y => `<option ${String(f.yil) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div></div>
    <section class="ledger"><div><span>Kaybedilen tutar</span><b>${usdK(kayip.reduce((s, p) => s + tutar(p), 0))}</b><small>${kayip.length} proje</small></div>
      <div><span>Kazanma oranı</span><b>${oran != null ? '%' + oran : '—'}</b><small>sipariş / (sipariş + kayıp)</small></div>
      <div><span>En çok kaybedilen marka</span><b>${esc(Object.entries(marka).filter(([m]) => m !== 'Belirtilmemiş').sort((a, b) => b[1].t - a[1].t)[0]?.[0] || '—')}</b><small>tutara göre</small></div>
      <div><span>Kayıplarda fiyat farkımız</span><b>${fark.length ? (fark.reduce((a, b) => a + b, 0) / fark.length >= 0 ? '+' : '') + '%' + num(Math.round(fark.reduce((a, b) => a + b, 0) / fark.length)) : '—'}</b><small>${fark.length ? fark.length + ' projede bizim teklif rakipten ortalama bu kadar ' + (fark.reduce((a, b) => a + b, 0) >= 0 ? 'pahalı' : 'ucuz') : 'bizim ve rakip tutarı girilen kayıp yok'}</small></div></section>
    <div class="dash">
      <section class="card"><h2>Kayıplar: hangi markaya?</h2>${cubuklar(Object.entries(marka).sort((a, b) => b[1].t - a[1].t).map(([m, v]) => ({ etiket: m, deger: v.t, yazi: usdK(v.t), alt: v.n + ' proje', seri: 1 })), { bos: 'Kayıp proje yok.', baslik: 'Markaya göre kaybedilen tutar' })}</section>
      <section class="card"><h2>Kayıp nedenleri</h2>${cubuklar(Object.entries(neden).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ etiket: k, deger: v, yazi: v + ' proje', seri: 1 })), { bos: 'Kayıp proje yok.', baslik: 'Kayıp nedenleri' })}</section>
      <section class="card wide"><h2>Kazanılan ve kaybedilen projeler (${Y})</h2>${ikili(ceyrek, ['Kazanılan', 'Kaybedilen'], { yazi: v => v + ' proje', bos: 'Bu yıl durum geçmişinde sipariş ya da kayıp yok.' })}</section>
      <section class="card wide"><h2>Aile bazında birim fiyat (USD)</h2>
        ${Object.keys(aileler).length ? Object.entries(aileler).map(([a, ms]) => {
          const biz = avg(S.urunler.filter(u => aileKey(u.aile) === aileKey(a) && u.birim_fiyat_usd).map(u => +u.birim_fiyat_usd));
          const rows = [...(biz ? [{ etiket: 'Bizim ortalama', deger: biz, yazi: num(Math.round(biz)) + ' $', seri: 0 }] : []), ...Object.entries(ms).map(([m, v]) => { const o = avg(v); return { etiket: m, deger: o, yazi: num(Math.round(o)) + ' $', alt: biz ? (o < biz ? 'bizden %' + num(Math.round((biz - o) / biz * 100)) + ' ucuz' : 'bizden %' + num(Math.round((o - biz) / biz * 100)) + ' pahalı') : v.length + ' fiyat', seri: 1 }; }).sort((x, y) => x.deger - y.deger)];
          return `<h3 class="cg-h">${esc(a)}</h3>${cubuklar(rows, { tablo: false, baslik: a + ' birim fiyatları' })}`;
        }).join('') + '<p class="hint">Mavi: bizim stok listesindeki ortalama birim fiyat. Turuncu: rakip markaların girilen fiyatlarının ortalaması. Lümen aralıkları farklı olabilir; kesin karşılaştırma için Fiyatlar sekmesine bak.</p>' : '<p class="hint">Aile ve USD birim fiyatı girilmiş rakip fiyatı yok.</p>'}</section>
    </div>`;
  gorBagla(el, f);
  el.querySelector('[data-yil]').onchange = e => { f.yil = e.target.value; saveFilters(); rakipAnaliz(el, f); };
}
