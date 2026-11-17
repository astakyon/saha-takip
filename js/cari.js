// Cari ve vergi bilgisi: VKN / TCKN denetimi, şirket içinde tekil vergi no, firmaya bağlı olmayan fatura ve siparişleri bağlama,
// herhangi bir Excel cari listesinden (unvan, vergi no, vergi dairesi, adres…) firmaları eşleştirip boş alanları doldurma.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, firmaAd, byId, openDrawer, closeDrawer, confirmBox, pickFiles } from './ui.js';

// ---------- Numara denetimi ----------
export const vergiTemiz = s => String(s ?? '').replace(/\D/g, '');
// VKN (10 hane, Gelir İdaresi kontrol hanesi)
export function vknGecerli(s) {
  const d = vergiTemiz(s); if (!/^\d{10}$/.test(d)) return false;
  let top = 0;
  for (let i = 0; i < 9; i++) {
    const t = (+d[i] + 9 - i) % 10;
    let v = (t * 2 ** (9 - i)) % 9;
    if (t !== 0 && v === 0) v = 9;
    top += v;
  }
  return (10 - (top % 10)) % 10 === +d[9];
}
// TCKN (11 hane, şahıs firmaları)
export function tcknGecerli(s) {
  const d = vergiTemiz(s); if (!/^[1-9]\d{10}$/.test(d)) return false;
  const n = [...d].map(Number), tek = n[0] + n[2] + n[4] + n[6] + n[8], cift = n[1] + n[3] + n[5] + n[7];
  return ((tek * 7 - cift) % 10 + 10) % 10 === n[9] && n.slice(0, 10).reduce((a, x) => a + x, 0) % 10 === n[10];
}
// { ok, tur: 'VKN'|'TCKN'|null, temiz, hata }
export function vergiKontrol(s) {
  const temiz = vergiTemiz(s);
  if (!temiz) return { ok: true, tur: null, temiz: '', hata: null };
  if (String(s).replace(/[\s.\-]/g, '').length !== temiz.length) return { ok: false, tur: null, temiz, hata: 'Vergi numarasında yalnız rakam olmalı.' };
  if (temiz.length === 10) return vknGecerli(temiz) ? { ok: true, tur: 'VKN', temiz } : { ok: false, tur: 'VKN', temiz, hata: 'Bu 10 haneli vergi numarası geçerli değil (kontrol hanesi tutmuyor). Rakamları kontrol et.' };
  if (temiz.length === 11) return tcknGecerli(temiz) ? { ok: true, tur: 'TCKN', temiz } : { ok: false, tur: 'TCKN', temiz, hata: 'Bu 11 haneli T.C. kimlik numarası geçerli değil. Rakamları kontrol et.' };
  return { ok: false, tur: null, temiz, hata: 'Vergi numarası 10 hane (şirket) ya da 11 hane (şahıs firması, T.C. kimlik no) olmalı.' };
}
// Aynı vergi numarası başka firmada mı? (şube olarak işaretlenenler hariç)
export const vergiSahibi = (no, haricId) => { const t = vergiTemiz(no); if (t.length < 10) return null; return (S.firmalar || []).find(f => f.id !== haricId && !f.sube_ana_id && vergiTemiz(f.vergi_no) === t) || null; };
export function vergiCiftleri() {
  const m = new Map();
  for (const f of S.firmalar || []) { if (f.sube_ana_id) continue; const t = vergiTemiz(f.vergi_no); if (t.length < 10) continue; (m.get(t) || m.set(t, []).get(t)).push(f); }
  return [...m.entries()].filter(([, l]) => l.length > 1).map(([no, firmalar]) => ({ no, firmalar }));
}
export const hataliVergi = () => (S.firmalar || []).filter(f => f.vergi_no && !vergiKontrol(f.vergi_no).ok);

// Firma formunda: yazarken uyarı ("bu numara X firmasında") ve geçersiz numarayı engelleme
export function vergiAlaniBagla(form, firmaId) {
  const i = form.querySelector('[name="vergi_no"]'); if (!i) return;
  let kutu = form.querySelector('[data-vergiuyari]');
  if (!kutu) { kutu = document.createElement('div'); kutu.dataset.vergiuyari = ''; kutu.className = 'vergi-uyari'; kutu.setAttribute('aria-live', 'polite'); i.closest('.fld, label, div')?.appendChild(kutu); }
  const kontrol = () => {
    const k = vergiKontrol(i.value), sahip = k.ok && k.temiz ? vergiSahibi(k.temiz, firmaId) : null;
    i.setAttribute('aria-invalid', String(!k.ok));
    kutu.innerHTML = !k.ok ? `<span class="neg">${esc(k.hata)}</span>`
      : sahip ? `<span class="neg">Bu numara zaten <b>${esc(sahip.ad)}</b> firmasında.</span> <a href="#/firma/${sahip.id}" data-close>O firmaya git</a>${firmaId ? ` · <button type="button" class="linkbtn" data-vbirlestir="${sahip.id}">Birleştir</button>` : ''} · <button type="button" class="linkbtn" data-vsube="${sahip.id}">Bu firma onun şubesi</button>`
      : k.tur ? `<small class="muted">${k.tur === 'VKN' ? 'Vergi kimlik numarası' : 'T.C. kimlik no (şahıs firması)'} geçerli.</small>` : '';
    kutu.querySelector('[data-vbirlestir]')?.addEventListener('click', async () => { closeDrawer(); (await import('./cift.js')).karsilastir('firmalar', sahip.id, firmaId); });
    kutu.querySelector('[data-vsube]')?.addEventListener('click', () => { const s = form.querySelector('[name="sube_ana_id"]'); if (s) { s.value = sahip.id; s.dispatchEvent(new Event('change', { bubbles: true })); } form.dataset.subeAna = sahip.id; kutu.innerHTML = `<small class="muted">Şube olarak kaydedilecek: ana firma ${esc(sahip.ad)}.</small>`; });
  };
  i.addEventListener('input', kontrol); i.addEventListener('change', kontrol); kontrol();
}
// Kaydetmeden önce: geçersiz numara ya da başka firmada kayıtlı numara → hata metni (null: sorun yok)
export function vergiKayitHatasi(o, firmaId) {
  if (!o.vergi_no) return null;
  const k = vergiKontrol(o.vergi_no); if (!k.ok) return k.hata;
  if (o.sube_ana_id) return null;
  const s = vergiSahibi(k.temiz, firmaId);
  return s ? `Bu vergi numarası zaten "${s.ad}" firmasında kayıtlı. Aynı firmaysa birleştir; şubesiyse "Şubesi olduğu firma"yı seç.` : null;
}

// ---------- Firmaya bağlı olmayan fatura ve siparişler ----------
export const CARI_ALAN = { tahsilatlar: 'cari', siparisler: 'musteri_adi' };
const cekirdek = s => fold(s || '').replace(/\b(ltd|sti|şti|san|tic|ve|a ?s|aş|elk|elektrik|insaat|inşaat|muhendislik|mühendislik|enerji|proje|taahhut|taahhüt|limited|sirketi|şirketi|ithalat|ihracat|malz|ins|aydinlatma|aydınlatma)\b\.?/g, ' ').replace(/[^a-z0-9]/g, '');
export function firmaOner(ad) {
  const c = cekirdek(ad); if (c.length < 3) return null;
  return (S.firmalar || []).find(f => cekirdek(f.ad) === c || cekirdek(f.unvan) === c) || (S.firmalar || []).find(f => { const k = cekirdek(f.ad); return k.length >= 4 && (k.startsWith(c) || c.startsWith(k)); }) || null;
}
export function bagsizGruplar(tablo) {
  const alan = CARI_ALAN[tablo], m = new Map();
  for (const r of S[tablo] || []) { if (r.firma_id) continue; const k = String(r[alan] || '').trim(); if (!k) continue; (m.get(k) || m.set(k, []).get(k)).push(r); }
  return [...m.entries()].map(([ad, l]) => ({ ad, l, oneri: firmaOner(ad) })).sort((a, b) => !!b.oneri - !!a.oneri || b.l.length - a.l.length);
}
export async function grubuBagla(tablo, ad, firmaId) {
  const alan = CARI_ALAN[tablo], l = (S[tablo] || []).filter(r => !r.firma_id && String(r[alan] || '').trim() === ad);
  await app.db.bulk(tablo, l.map(r => ({ ...r, firma_id: firmaId })));
  return l.length;
}
// Firma seç ya da yeni firma aç → firma id
export function firmaSec(ad, oneri) {
  return new Promise(res => {
    let bitti = false;
    const aday = (S.firmalar || []).filter(f => { const c = cekirdek(ad).slice(0, 5); return c && (cekirdek(f.ad).includes(c) || cekirdek(f.unvan).includes(c)); }).slice(0, 8);
    const p = openDrawer(`<header class="dh"><div><p class="muted">Firmaya bağla</p><h2 id="drawer-title">${esc(ad)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody"><div class="fld"><label for="fs-q">Firma ara</label><input id="fs-q" type="search" placeholder="Firma adı" value="${esc(oneri?.ad || '')}"></div><ul class="list" data-fsl></ul>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn" data-fsyeni>“${esc(ad)}” adıyla yeni firma aç</button></div></div>`, { onClose: () => { if (!bitti) res(null); } });
    const ciz = q => { const l = q ? (S.firmalar || []).filter(f => fold(f.ad + ' ' + (f.unvan || '')).includes(fold(q))).slice(0, 12) : aday;
      p.querySelector('[data-fsl]').innerHTML = l.map(f => `<li><span class="grow"><b>${esc(f.ad)}</b><small class="muted"> ${esc([f.il, f.vergi_no].filter(Boolean).join(' · '))}</small></span><button type="button" class="btn sm primary" data-fs="${f.id}">Seç</button></li>`).join('') || '<li class="muted">Eşleşen firma yok.</li>';
      p.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { bitti = true; closeDrawer(); res(b.dataset.fs); }); };
    p.querySelector('#fs-q').oninput = e => ciz(e.target.value.trim()); ciz(oneri?.ad || '');
    p.querySelector('[data-fsyeni]').onclick = async () => { const f = await app.db.save('firmalar', { id: uuid(), ad, tipler: ['Müşteri'] }); bitti = true; closeDrawer(); res(f?.id || (S.firmalar || []).find(x => x.ad === ad)?.id || null); };
  });
}
export function baglaListesi(tablo, sonra) {
  const g = bagsizGruplar(tablo), adlar = { tahsilatlar: ['fatura', 'Firmaya bağlı olmayan faturalar'], siparisler: ['sipariş', 'Carisi firma listesinde olmayan siparişler'] }[tablo];
  const p = openDrawer(`<header class="dh"><div><p class="muted">Cari bağlama</p><h2 id="drawer-title">${adlar[1]}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">${g.length ? `<p class="hint">Aynı cari adıyla girilmiş bütün ${adlar[0]}lar birlikte bağlanır. Öneri doğruysa “Bağla”, değilse “Firma seç”.</p><ul class="list">${g.map((x, i) => `<li><span class="grow"><b>${esc(x.ad)}</b><small class="muted"> ${x.l.length} ${adlar[0]}</small></span>${x.oneri ? `<button type="button" class="btn sm primary" data-bg="${i}">Bağla: ${esc(x.oneri.ad)}</button>` : ''}<button type="button" class="btn sm ghost" data-bs="${i}">Firma seç</button></li>`).join('')}</ul>` : '<p>Bağlanmamış kayıt yok.</p>'}</div>`);
  const bitir = async (i, fid) => { if (!fid) return; const n = await grubuBagla(tablo, g[i].ad, fid); toast(`${n} ${adlar[0]} ${firmaAd(fid)} firmasına bağlandı.`); closeDrawer(); sonra?.(); };
  p.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => bitir(+b.dataset.bg, g[+b.dataset.bg].oneri.id));
  p.querySelectorAll('[data-bs]').forEach(b => b.onclick = async () => { const i = +b.dataset.bs; closeDrawer(); bitir(i, await firmaSec(g[i].ad, g[i].oneri)); });
}

// ---------- Excel cari listesi ----------
// Herhangi bir Excel (e-Fatura portalı, banka, eski kayıtlar): unvan, vergi no, vergi dairesi, adres, cari kodu, telefon, e-posta, il.
// Vergi no ya da unvanla firmaya eşleştirilir; yalnızca boş alanlar doldurulur. Eşleşmeyenler istenirse yeni firma olarak eklenir.
const CARI_SUTUN = [{ k: 'unvan', l: 'Unvan / firma adı', zorunlu: true }, { k: 'vergi_no', l: 'Vergi no / TCKN' }, { k: 'vergi_dairesi', l: 'Vergi dairesi' }, { k: 'adres', l: 'Adres' }, { k: 'il', l: 'İl' },
  { k: 'cari_kodu', l: 'Cari kodu' }, { k: 'telefon', l: 'Telefon' }, { k: 'eposta', l: 'E-posta' }];
export async function cariListesiYukle(sonra) {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    await (await import('./ui.js')).xlsxYukle();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
    const hi = Math.max(0, rows.findIndex(r => r.filter(c => c != null && String(c).trim()).length >= 2));
    const h = (rows[hi] || []).map(c => fold(c || '')), col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
    const { sutunlariEsle, onizleOnay } = await import('./esle.js');
    const M = await sutunlariEsle('cari', 'Cari listesi', (rows[hi] || []).map(x => String(x ?? '')), rows.slice(hi + 1, hi + 4), CARI_SUTUN,
      { unvan: col(/unvan/, /firma/, /cari ad/, /^ad/, /musteri/), vergi_no: col(/vergi no/, /vkn/, /tckn/, /vergi numara/, /kimlik/), vergi_dairesi: col(/vergi daire/, /^vd/), adres: col(/adres/), il: col(/^il$/, /sehir/), cari_kodu: col(/cari kod/, /hesap kod/, /^kod/), telefon: col(/tel/), eposta: col(/posta/, /mail/) });
    if (!M) return toast('Yükleme iptal edildi.');
    const v = (r, k) => M[k] >= 0 && r[M[k]] != null ? String(r[M[k]]).trim() || null : null;
    const satirlar = rows.slice(hi + 1).map(r => Object.fromEntries(CARI_SUTUN.map(s => [s.k, v(r, s.k)]))).filter(r => r.unvan);
    if (!satirlar.length) return toast('Dosyada cari satırı bulunamadı.', 'err');
    const eslesen = [], yeni = [], hatali = [];
    for (const r of satirlar) {
      const k = vergiKontrol(r.vergi_no); if (r.vergi_no && !k.ok) { hatali.push(r); r.vergi_no = null; } else if (k.temiz) r.vergi_no = k.temiz;
      const f = (r.vergi_no && vergiSahibi(r.vergi_no, null)) || firmaOner(r.unvan);
      if (f) { const dol = {}; for (const [a, b] of [['unvan', 'unvan'], ['vergi_no', 'vergi_no'], ['vergi_dairesi', 'vergi_dairesi'], ['adres', 'fatura_adresi'], ['cari_kodu', 'cari_kodu'], ['telefon', 'telefon'], ['eposta', 'eposta'], ['il', 'il']]) if (r[a] && !f[b]) dol[b] = r[a];
        if (dol.vergi_no && vergiSahibi(dol.vergi_no, f.id)) delete dol.vergi_no;
        eslesen.push({ f, dol }); }
      else yeni.push(r);
    }
    const doldur = eslesen.filter(x => Object.keys(x.dol).length);
    const on = await onizleOnay({ baslik: 'Cari listesi', sayilar: [['firmaya eşleşti', eslesen.length, 'guncel'], ['boş alanı doldurulacak', doldur.length, 'yeni'], ['eşleşmeyen', yeni.length, yeni.length ? 'uyari' : ''], ['hatalı vergi no (boş bırakılır)', hatali.length, hatali.length ? 'uyari' : '']],
      ornekBaslik: ['Firma', 'Doldurulacak'], ornek: doldur.slice(0, 8).map(x => [x.f.ad, Object.keys(x.dol).join(', ')]),
      secenek: yeni.length ? { metin: `Eşleşmeyen ${yeni.length} cariyi yeni firma olarak ekle`, varsayilan: false } : null });
    if (!on.ok) return toast('İçe aktarma iptal edildi.');
    for (const x of doldur) await app.db.save('firmalar', { ...x.f, ...x.dol });
    let n = 0;
    if (on.secim && yeni.length) { await app.db.bulk('firmalar', yeni.map(r => ({ id: uuid(), ad: r.unvan, unvan: r.unvan, vergi_no: r.vergi_no, vergi_dairesi: r.vergi_dairesi, fatura_adresi: r.adres, adres: r.adres, il: r.il, cari_kodu: r.cari_kodu, telefon: r.telefon, eposta: r.eposta, tipler: ['Müşteri'], kaynak: 'Cari listesinden aktarıldı' }))); n = yeni.length; }
    try { (await import('./belgeler.js')).yuklemeKaydet(file, 'Cari listesi', `${doldur.length} firma dolduruldu${n ? ', ' + n + ' yeni' : ''}`); } catch {}
    toast(`${doldur.length} firmanın cari bilgisi dolduruldu${n ? `, ${n} yeni firma eklendi` : ''}.`); sonra?.();
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
}
