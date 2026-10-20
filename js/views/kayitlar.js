// Numune takibi, servis / şikayet kayıtları, kilometre ve masraflar
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, tarih, today, gunEkle, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, exportXlsx, SERVIS_TIP, MASRAF_TIP } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { waGonder } from '../sablon.js';
import { gunKm } from './bugun.js';

const para = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const rpill = (d, renk) => `<span class="pill" style="--c:${renk[d] || '#64748B'}">${esc(d)}</span>`;
const urunListesi = () => S.urunler.map(u => u.kod + ' · ' + u.aciklama);

// Ortak kayıt paneli
function kayitPanel({ tablo, baslik, form, kayit, oncesi, sonrasi, ekBtn = '' }) {
  const r = { ...kayit };
  if (oncesi) oncesi(r);
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${esc(baslik)}</p><h2 id="drawer-title">${r._new ? 'Yeni kayıt' : esc(r._ad || baslik)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${r._new ? '' : `<div class="dh-actions">${ekBtn}<button class="btn sm ghost danger" data-sil>Sil</button></div>`}
    <form class="dbody form" novalidate>${renderForm(form, r)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const f = panel.querySelector('form'); bindForm(f, form, r);
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { if (!confirmBox('Kayıt silinsin mi?')) return; await app.db.del(tablo, r.id); toast('Silindi.'); closeDrawer(); app.refresh(); });
  f.onsubmit = async e => {
    e.preventDefault();
    try { let o = await readForm(f, form, r); delete o._ad; if (sonrasi) o = await sonrasi(o); if (!o) return; await app.db.save(tablo, o); toast('Kaydedildi.'); closeDrawer(); app.refresh(); }
    catch (err) { console.error(err); toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
  return panel;
}
const kodAyikla = s => { const m = /^(\S+) · (.+)$/.exec(s || ''); return m ? { kod: m[1], ad: m[2] } : { kod: null, ad: s || null }; };

// ---------- Numuneler ----------
export const NUMUNE_DURUM = { 'Müşteride': '#7C3AED', 'İade alındı': '#64748B', 'Satışa döndü': '#15803D', 'Kayıp / hurda': '#B91C1C' };
const NUMUNE_FORM = [{ title: 'Numune', fields: [
  { k: 'urun_ad', l: 'Ürün', t: 'combo', opts: urunListesi, full: true, ph: 'Ürün kodu ya da açıklama' },
  { k: 'adet', l: 'Adet', t: 'num' },
  { k: 'durum', l: 'Durum', t: 'sel', opts: Object.keys(NUMUNE_DURUM) },
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar' },
  { k: 'kisi_id', l: 'Teslim alan', t: 'ref', ref: 'kisiler' },
  { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler', full: true },
  { k: 'verilis', l: 'Veriliş tarihi', t: 'date' },
  { k: 'iade_tarihi', l: 'Geri alınacak tarih', t: 'date' },
  { k: 'notlar', l: 'Not', t: 'area' },
]}];
export function numuneForm(init = {}) {
  const n0 = init.id ? byId('numuneler', init.id) : { adet: 1, durum: 'Müşteride', verilis: today(), iade_tarihi: gunEkle(today(), 14), ...init, _new: true };
  const p = kayitPanel({ tablo: 'numuneler', baslik: 'Numune', form: NUMUNE_FORM, kayit: { ...n0, urun_ad: n0.urun_kod ? n0.urun_kod + ' · ' + n0.urun_ad : n0.urun_ad, _ad: n0.urun_ad },
    ekBtn: '<button class="btn sm" data-wa>Hatırlatma mesajı</button>',
    sonrasi: o => { const k = kodAyikla(o.urun_ad); if (!k.ad) { toast('Ürünü yaz.', 'err'); return null; } return { ...o, urun_kod: k.kod, urun_ad: k.ad }; } });
  p.querySelector('[data-wa]')?.addEventListener('click', () => waGonder({ kisi: byId('kisiler', n0.kisi_id), firma: byId('firmalar', n0.firma_id), proje: byId('projeler', n0.proje_id), sablonAdi: 'Numune hatırlatma' }));
}
export function numunelerView(el) {
  const f = F('numuneler', { durum: 'Müşteride', q: '' });
  el.innerHTML = `<header class="vh"><div><h1>Numuneler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn primary" data-new>Numune ver</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Ürün, firma, proje ara" value="${esc(f.q)}" aria-label="Numunelerde ara">
    <div class="seg" role="group" aria-label="Durum">${['Tümü', ...Object.keys(NUMUNE_DURUM)].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div></div><div data-rows></div>`;
  const draw = () => {
    const t = today();
    const l = S.numuneler.filter(n => (f.durum === 'Tümü' || n.durum === f.durum) && match(f.q, n.urun_ad, n.urun_kod, firmaAd(n.firma_id), byId('projeler', n.proje_id)?.ad)).sort((a, b) => (a.iade_tarihi || '9').localeCompare(b.iade_tarihi || '9'));
    const mus = S.numuneler.filter(n => n.durum === 'Müşteride'), don = S.numuneler.filter(n => n.durum === 'Satışa döndü').length, kapali = S.numuneler.filter(n => n.durum !== 'Müşteride').length;
    el.querySelector('[data-sum]').textContent = `Müşteride ${mus.reduce((s, n) => s + (+n.adet || 0), 0)} adet · ${mus.filter(n => n.iade_tarihi && n.iade_tarihi <= t).length} gecikmiş · satışa dönüş %${kapali ? Math.round(don / kapali * 100) : 0}`;
    el.querySelector('[data-rows]').innerHTML = l.length ? `<ul class="list big">${l.map(n => `<li class="${n.durum === 'Müşteride' && n.iade_tarihi && n.iade_tarihi <= t ? 'late' : ''}"><button type="button" class="linkrow" data-id="${n.id}"><b>${num(n.adet)} × ${esc(n.urun_ad)}</b><span class="muted">${esc([firmaAd(n.firma_id), byId('kisiler', n.kisi_id)?.ad_soyad, byId('projeler', n.proje_id)?.ad].filter(Boolean).join(' · '))}</span></button>
      <span class="r">${rpill(n.durum, NUMUNE_DURUM)}<small class="muted">${n.durum === 'Müşteride' ? (n.iade_tarihi ? 'iade ' + tarih(n.iade_tarihi) : 'verildi ' + tarih(n.verilis)) : tarih(n.verilis)}</small></span></li>`).join('')}</ul>`
      : '<div class="empty"><p>Kayıt yok. Müşteriye bıraktığın deneme ürünlerini kaydet; geri alma tarihi geldiğinde Bugün ekranında hatırlatılır.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => numuneForm({ id: b.dataset.id }));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => numuneForm({});
  draw();
}

// ---------- Servis ve şikayet ----------
export const SERVIS_DURUM = { 'Açık': '#B91C1C', 'İşlemde': '#EA580C', 'Çözüldü': '#15803D' };
const SERVIS_FORM = [{ title: 'Servis / şikayet', fields: [
  { k: 'tarih', l: 'Tarih', t: 'date' },
  { k: 'tip', l: 'Tür', t: 'sel', opts: SERVIS_TIP },
  { k: 'durum', l: 'Durum', t: 'sel', opts: Object.keys(SERVIS_DURUM) },
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar' },
  { k: 'kisi_id', l: 'Bildiren', t: 'ref', ref: 'kisiler' },
  { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler' },
  { k: 'urun', l: 'Ürün', t: 'combo', opts: urunListesi, full: true },
  { k: 'adet', l: 'Etkilenen adet', t: 'num' },
  { k: 'aciklama', l: 'Sorun', t: 'area', rows: 3 },
  { k: 'cozum', l: 'Çözüm / yapılan', t: 'area', rows: 2 },
  { k: 'cozum_tarihi', l: 'Çözüm tarihi', t: 'date', show: o => o.durum === 'Çözüldü' },
  { k: 'fotolar', l: 'Fotoğraflar', t: 'photos' },
]}];
export function servisForm(init = {}) {
  const s0 = init.id ? byId('servis_kayitlari', init.id) : { tarih: today(), tip: 'Arıza', durum: 'Açık', fotolar: [], ...init, _new: true };
  kayitPanel({ tablo: 'servis_kayitlari', baslik: 'Servis kaydı', form: SERVIS_FORM, kayit: { ...s0, _ad: [s0.tip, firmaAd(s0.firma_id)].filter(Boolean).join(' · ') },
    sonrasi: o => { if (o.durum === 'Çözüldü' && !o.cozum_tarihi) o.cozum_tarihi = today(); return o; } });
}
export function servisView(el) {
  const f = F('servis', { durum: 'Açık', q: '' });
  el.innerHTML = `<header class="vh"><div><h1>Servis ve şikayetler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Kayıt aç</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Firma, ürün, sorun ara" value="${esc(f.q)}" aria-label="Servis kayıtlarında ara">
    <div class="seg" role="group" aria-label="Durum">${['Tümü', ...Object.keys(SERVIS_DURUM)].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div></div><div data-rows></div>`;
  const list = () => S.servis_kayitlari.filter(s => (f.durum === 'Tümü' || s.durum === f.durum) && match(f.q, firmaAd(s.firma_id), s.urun, s.aciklama, s.cozum, byId('projeler', s.proje_id)?.ad)).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const draw = () => {
    const l = list(), acik = S.servis_kayitlari.filter(s => s.durum !== 'Çözüldü');
    const coz = S.servis_kayitlari.filter(s => s.durum === 'Çözüldü' && s.cozum_tarihi && s.tarih);
    const ort = coz.length ? Math.round(coz.reduce((a, s) => a + (new Date(s.cozum_tarihi) - new Date(s.tarih)) / 864e5, 0) / coz.length) : null;
    el.querySelector('[data-sum]').textContent = `${acik.length} açık kayıt${ort != null ? ` · ortalama çözüm ${ort} gün` : ''}`;
    el.querySelector('[data-rows]').innerHTML = l.length ? `<ul class="list big">${l.map(s => `<li><button type="button" class="linkrow" data-id="${s.id}"><b>${esc(s.tip)} · ${esc(firmaAd(s.firma_id) || 'Firma yok')}</b><span class="muted">${esc([s.urun, s.adet ? num(s.adet) + ' adet' : '', (s.aciklama || '').slice(0, 90)].filter(Boolean).join(' · '))}</span></button>
      <span class="r">${rpill(s.durum, SERVIS_DURUM)}<small class="muted">${tarih(s.tarih)}${s.durum !== 'Çözüldü' ? ' · ' + Math.round((new Date(today()) - new Date(s.tarih)) / 864e5) + ' gün' : ''}</small></span></li>`).join('')}</ul>`
      : '<div class="empty"><p>Kayıt yok.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => servisForm({ id: b.dataset.id }));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => servisForm({});
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`servis-${today()}.xlsx`, { 'Servis': list().map(s => ({ 'Tarih': s.tarih, 'Tür': s.tip, 'Durum': s.durum, 'Firma': firmaAd(s.firma_id), 'Bildiren': byId('kisiler', s.kisi_id)?.ad_soyad, 'Proje': byId('projeler', s.proje_id)?.ad, 'Ürün': s.urun, 'Adet': s.adet, 'Sorun': s.aciklama, 'Çözüm': s.cozum, 'Çözüm tarihi': s.cozum_tarihi })) });
  draw();
}

// ---------- Masraflar ve kilometre ----------
const MASRAF_FORM = [{ title: 'Masraf', fields: [
  { k: 'tarih', l: 'Tarih', t: 'date' },
  { k: 'tip', l: 'Tür', t: 'sel', opts: MASRAF_TIP },
  { k: 'tutar', l: 'Tutar (TL)', t: 'num' },
  { k: 'km', l: 'Kilometre', t: 'num', help: 'O günkü yol; boş bırakırsan ziyaret noktalarından tahmin edilen değer kullanılabilir' },
  { k: 'aciklama', l: 'Açıklama', full: true },
  { k: 'fis', l: 'Fiş fotoğrafı', t: 'photos' },
]}];
export function masrafForm(init = {}) {
  const m0 = init.id ? byId('masraflar', init.id) : { tarih: today(), tip: 'Yakıt', ...init, _new: true };
  const p = kayitPanel({ tablo: 'masraflar', baslik: 'Masraf', form: MASRAF_FORM, kayit: { ...m0, fis: m0.fis ? [m0.fis] : [], _ad: `${m0.tip} · ${para(m0.tutar)} TL` },
    sonrasi: o => ({ ...o, fis: (o.fis || [])[0] || null }) });
  const km = p.querySelector('[name=km]'), tar = p.querySelector('[name=tarih]');
  const oneri = () => { const t = gunKm(tar.value); const h = km.closest('.fld').querySelector('small'); h.innerHTML = t ? `Ziyaret noktalarına göre o gün yaklaşık <button type="button" class="linkbtn" data-km>${t} km</button>` : 'O gün için konumlu ziyaret yok; kilometreyi elle gir.'; h.querySelector('[data-km]')?.addEventListener('click', () => { km.value = t; }); };
  tar.addEventListener('change', oneri); oneri();
}
export function masraflarView(el) {
  const f = F('masraflar', { ay: today().slice(0, 7) });
  const aylar = [...new Set([today().slice(0, 7), ...S.masraflar.map(m => (m.tarih || '').slice(0, 7)).filter(Boolean)])].sort().reverse();
  el.innerHTML = `<header class="vh"><div><h1>Masraf ve kilometre</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Masraf ekle</button></div></header>
    <div class="filters"><div class="frow"><label>Ay <select data-ay>${aylar.map(a => `<option value="${a}" ${a === f.ay ? 'selected' : ''}>${new Date(a + '-01T00:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></label></div></div>
    <section class="ledger" data-ledger></section><div data-rows></div>`;
  const list = () => S.masraflar.filter(m => (m.tarih || '').startsWith(f.ay)).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const draw = () => {
    const l = list();
    const top = l.reduce((s, m) => s + (+m.tutar || 0), 0), km = l.reduce((s, m) => s + (+m.km || 0), 0);
    // Kayıt girilmemiş günlerin tahmini kilometresi
    const gunler = new Set(S.ziyaretler.filter(z => (z.tarih || '').startsWith(f.ay)).map(z => z.tarih));
    const kmli = new Set(l.filter(m => m.km).map(m => m.tarih));
    const tahmin = [...gunler].filter(g => !kmli.has(g)).reduce((s, g) => s + gunKm(g), 0);
    const tipler = {}; for (const m of l) tipler[m.tip] = (tipler[m.tip] || 0) + (+m.tutar || 0);
    el.querySelector('[data-ledger]').innerHTML = `<div><span>Toplam masraf</span><b>${para(top)} TL</b><small>${l.length} kayıt</small></div><div><span>Girilen kilometre</span><b>${num(km)} km</b><small>${tahmin ? `+ yaklaşık ${num(tahmin)} km kayıtsız gün` : 'ziyaret günleri kayıtlı'}</small></div>
      <div><span>En büyük kalem</span><b>${Object.keys(tipler).length ? esc(Object.entries(tipler).sort((a, b) => b[1] - a[1])[0][0]) : '—'}</b><small>${Object.entries(tipler).map(([k, v]) => `${esc(k)} ${para(v)}`).join(' · ')}</small></div>
      <div><span>Ziyaret günü</span><b>${gunler.size}</b><small>bu ay sahada</small></div>`;
    el.querySelector('[data-rows]').innerHTML = l.length ? `<ul class="list big">${l.map(m => `<li><button type="button" class="linkrow" data-id="${m.id}"><b>${esc(m.tip)}${m.aciklama ? ' · ' + esc(m.aciklama) : ''}</b><span class="muted">${tarih(m.tarih)}${m.km ? ' · ' + num(m.km) + ' km' : ''}${m.fis ? ' · fiş var' : ''}</span></button><b class="num">${para(m.tutar)} TL</b></li>`).join('')}</ul>`
      : '<div class="empty"><p>Bu ay masraf yok. Fişin fotoğrafını çekerek hızlıca ekleyebilirsin.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => masrafForm({ id: b.dataset.id }));
  };
  el.querySelector('[data-ay]').onchange = e => { f.ay = e.target.value; saveFilters(); draw(); };
  el.querySelector('[data-new]').onclick = () => masrafForm({});
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`masraflar-${f.ay}.xlsx`, { 'Masraflar': list().map(m => ({ 'Tarih': m.tarih, 'Tür': m.tip, 'Tutar (TL)': m.tutar, 'Kilometre': m.km, 'Açıklama': m.aciklama, 'Fiş': m.fis ? 'Var' : '' })) });
  draw();
}
