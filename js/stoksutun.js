// Stokta kullanıcının eklediği sütunlar (Excel mantığı): Marka, Raf, Renk, Garanti… Değerler kalemin "ozel" alanında ({ "Marka": "Pelsan" }) tutulur.
// Sütun tanımı ayar "stok_sutunlari" içinde: şirket sütunu (bütün bayilerde) ya da tek bayinin sütunu. Veride olup tanımda olmayan sütunlar da gösterilir.
import { S } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, openDrawer, closeDrawer, confirmBox } from './ui.js';
import { ayarYaz } from './ayar.js';

const K = 'stok_sutunlari';
const benimSatir = () => { const ben = app.db?.user?.()?.id; return (S.ayarlar || []).filter(r => r.anahtar === K && (!ben || !r.owner || r.owner === ben)).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0]; };
const benimTanim = () => { const d = benimSatir()?.deger; if (d) return { sutunlar: [...(d.sutunlar || [])], gizle: [...(d.gizle || [])] }; try { const v = JSON.parse(localStorage.getItem('saha-ayar:' + K)); if (v) return { sutunlar: v.sutunlar || [], gizle: v.gizle || [] }; } catch {} return { sutunlar: [], gizle: [] }; };
// Bütün görünür tanımlar (sahibin ve ekibin ayar satırları birleşir)
function tanimlar() {
  const satirlar = (S.ayarlar || []).filter(r => r.anahtar === K && r.deger);
  const l = satirlar.length ? satirlar.map(r => r.deger) : [benimTanim()];
  return { sutunlar: l.flatMap(d => d.sutunlar || []), gizle: new Set(l.flatMap(d => d.gizle || []).map(fold)) };
}
export const ozelDeger = (s, ad) => { const o = s?.ozel; if (!o || typeof o !== 'object') return null; if (o[ad] != null) return o[ad]; const k = Object.keys(o).find(x => fold(x) === fold(ad)); return k ? o[k] : null; };
// Bayinin (firma_id) sütunları: şirket sütunları + o bayinin sütunları + o bayinin kalemlerinde değeri olanlar. firma_id yoksa (bütün bayiler) hepsi.
export function ozelSutunlar(firma_id = null) {
  const T = tanimlar(), m = new Map();
  const ekle = ad => { const a = String(ad || '').trim(); if (a && !m.has(fold(a)) && !T.gizle.has(fold(a))) m.set(fold(a), a); };
  for (const s of T.sutunlar) if (!s.firma_id || !firma_id || s.firma_id === firma_id) ekle(s.ad);
  for (const s of S.bayi_stok || []) if ((!firma_id || s.firma_id === firma_id) && s.ozel && typeof s.ozel === 'object') for (const [k, v] of Object.entries(s.ozel)) if (v != null && v !== '') ekle(k);
  return [...m.values()];
}
const YASAK = /^(urun kodu|kod|aciklama|miktar|adet|birim|birim fiyat|para birimi|aktif|depo|firma stok kodu|uretici kodu|uretici aciklamasi|bayi)$/;
export async function sutunEkle(ad, firma_id = null) {
  ad = String(ad || '').trim().replace(/\s+/g, ' ');
  if (!ad) throw new Error('Sütun adını yaz.');
  if (ad.length > 40) throw new Error('Sütun adı en çok 40 harf olsun.');
  if (YASAK.test(fold(ad))) throw new Error(`“${ad}” zaten hazır bir sütun.`);
  if (ozelSutunlar(firma_id).some(x => fold(x) === fold(ad))) throw new Error(`“${ad}” sütunu zaten var.`);
  const t = benimTanim();
  t.gizle = t.gizle.filter(x => fold(x) !== fold(ad));
  t.sutunlar.push({ ad, firma_id: firma_id || null });
  await ayarYaz(K, t); return ad;
}
// Kalemin sütun değerini yaz (stok hareketi oluşturmaz)
export async function ozelYaz(s, ad, deger) {
  const o = { ...(s.ozel && typeof s.ozel === 'object' ? s.ozel : {}) };
  for (const k of Object.keys(o)) if (fold(k) === fold(ad) && k !== ad) delete o[k];
  const v = deger == null ? '' : String(deger).trim();
  if (v === '') delete o[ad]; else o[ad] = v;
  const satir = { ...s, ozel: o }; await app.db.save('bayi_stok', satir); return satir;
}
export async function topluYaz(kalemler, ad, deger) {
  const l = kalemler.map(s => { const o = { ...(s.ozel && typeof s.ozel === 'object' ? s.ozel : {}) }; for (const k of Object.keys(o)) if (fold(k) === fold(ad)) delete o[k]; const v = String(deger ?? '').trim(); if (v) o[ad] = v; return { ...s, ozel: o }; });
  if (l.length) await app.db.bulk('bayi_stok', l); return l.length;
}
const kapsamKalemleri = firma_id => (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && s.ozel && Object.keys(s.ozel).length);
export async function sutunAdiDegistir(eski, yeni, firma_id = null) {
  yeni = String(yeni || '').trim().replace(/\s+/g, ' ');
  if (!yeni || fold(yeni) === fold(eski)) return 0;
  if (YASAK.test(fold(yeni))) throw new Error(`“${yeni}” zaten hazır bir sütun.`);
  if (ozelSutunlar(firma_id).some(x => fold(x) === fold(yeni))) throw new Error(`“${yeni}” sütunu zaten var.`);
  const t = benimTanim();
  t.sutunlar = t.sutunlar.map(s => fold(s.ad) === fold(eski) ? { ...s, ad: yeni } : s);
  if (!t.sutunlar.some(s => fold(s.ad) === fold(yeni))) t.sutunlar.push({ ad: yeni, firma_id: firma_id || null });
  if (!t.gizle.some(x => fold(x) === fold(eski))) t.gizle.push(eski);
  t.gizle = t.gizle.filter(x => fold(x) !== fold(yeni));
  await ayarYaz(K, t);
  const l = kapsamKalemleri(null).filter(s => ozelDeger(s, eski) != null).map(s => { const o = { ...s.ozel }; let v; for (const k of Object.keys(o)) if (fold(k) === fold(eski)) { v = o[k]; delete o[k]; } o[yeni] = v; return { ...s, ozel: o }; });
  if (l.length) await app.db.bulk('bayi_stok', l); return l.length;
}
// Sütunu kaldır: tanımdan çıkar ve (bu bayide ya da her yerde) değerlerini sil
export async function sutunSil(ad, firma_id = null) {
  const t = benimTanim();
  t.sutunlar = t.sutunlar.filter(s => fold(s.ad) !== fold(ad) || (firma_id && s.firma_id !== firma_id && s.firma_id));
  const baskaVar = kapsamKalemleri(null).some(s => (firma_id && s.firma_id !== firma_id) && ozelDeger(s, ad) != null);
  if (!firma_id || !baskaVar) { if (!t.gizle.some(x => fold(x) === fold(ad))) t.gizle.push(ad); }
  await ayarYaz(K, t);
  const l = kapsamKalemleri(firma_id).filter(s => ozelDeger(s, ad) != null).map(s => { const o = { ...s.ozel }; for (const k of Object.keys(o)) if (fold(k) === fold(ad)) delete o[k]; return { ...s, ozel: o }; });
  if (l.length) await app.db.bulk('bayi_stok', l); return l.length;
}

// Sütunları yönet: ekle, adını değiştir, sil
export function sutunlarPenceresi({ firma_id, bayiAdi = '', sirketYazar = false, sonra }) {
  const ciz = () => { const l = ozelSutunlar(firma_id);
    return `<header class="dh"><div><p class="muted">${esc(bayiAdi)}</p><h2 id="drawer-title">Ek sütunlar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><p class="hint">Excel'deki gibi istediğin sütunu ekle (Marka, Raf yeri, Renk, Garanti…). Değerleri tabloda hücreye yazarak, kalem kartından, seçili kalemlere toplu ya da Excel'den doldurursun.</p>
      ${l.length ? `<ul class="list ss-liste">${l.map(ad => `<li><input data-ad="${esc(ad)}" value="${esc(ad)}" aria-label="Sütun adı"><small class="muted">${(S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && ozelDeger(s, ad) != null).length} dolu</small><button type="button" class="btn sm ghost danger" data-ssil="${esc(ad)}">Sil</button></li>`).join('')}</ul>` : '<p class="muted">Henüz ek sütun yok.</p>'}
      <div class="frow"><input data-yeni placeholder="Yeni sütun adı (ör. Marka)" aria-label="Yeni sütun adı" autocomplete="off"><button type="button" class="btn primary" data-ekle>Sütun ekle</button></div>
      ${sirketYazar && firma_id ? `<label class="chk"><input type="checkbox" data-sirket checked> <span>Bütün bayilerde görünsün (kapalıysa yalnız bu bayide)</span></label>` : ''}
    </div>`; };
  const p = openDrawer(ciz());
  const bagla = () => {
    const yen = () => { p.innerHTML = ciz(); bagla(); sonra?.(); };
    const ekle = async () => { const i = p.querySelector('[data-yeni]'); try { const ad = await sutunEkle(i.value, sirketYazar && p.querySelector('[data-sirket]')?.checked !== false ? null : firma_id); toast(`“${ad}” sütunu eklendi.`); yen(); } catch (er) { toast(er.message, 'err'); } };
    p.querySelector('[data-ekle]').onclick = ekle;
    p.querySelector('[data-yeni]').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } };
    p.querySelectorAll('[data-ad]').forEach(i => i.onchange = async () => { try { await sutunAdiDegistir(i.dataset.ad, i.value, firma_id); toast('Sütun adı değişti.'); yen(); } catch (er) { toast(er.message, 'err'); i.value = i.dataset.ad; } });
    p.querySelectorAll('[data-ssil]').forEach(b => b.onclick = async () => { const ad = b.dataset.ssil, n = (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && ozelDeger(s, ad) != null).length;
      if (!confirmBox(`“${ad}” sütunu silinsin mi?${n ? `\n\n${n} kalemdeki değerleri de silinir.` : ''} Stok miktarları değişmez.`)) return; await sutunSil(ad, firma_id); toast(`“${ad}” sütunu silindi.`); yen(); });
  };
  bagla();
  setTimeout(() => p.querySelector('[data-yeni]')?.focus(), 50);
}
// Seçili kalemlere bir sütunun değerini toplu yaz
export function topluYazPenceresi({ firma_id, kalemler, sonra }) {
  const l = ozelSutunlar(firma_id);
  const p = openDrawer(`<header class="dh"><div><p class="muted">${kalemler.length} kalem</p><h2 id="drawer-title">Sütuna değer yaz</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>
      <label class="fld"><span>Sütun</span><select name="sutun">${l.map(ad => `<option>${esc(ad)}</option>`).join('')}<option value="_yeni">+ Yeni sütun…</option></select></label>
      <label class="fld" data-yenif ${l.length ? 'hidden' : ''}><span>Yeni sütun adı</span><input name="yeni" placeholder="ör. Marka" autocomplete="off"></label>
      <label class="fld"><span>Değer</span><input name="deger" placeholder="ör. Pelsan (boş bırakılırsa değer silinir)" autocomplete="off"></label>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Yaz</button></div></form>`);
  const sel = p.querySelector('[name=sutun]'); if (!l.length) sel.value = '_yeni';
  sel.onchange = () => { p.querySelector('[data-yenif]').hidden = sel.value !== '_yeni'; };
  p.querySelector('form').onsubmit = async e => { e.preventDefault();
    try { let ad = sel.value; if (ad === '_yeni') ad = await sutunEkle(p.querySelector('[name=yeni]').value, null);
      const n = await topluYaz(kalemler, ad, p.querySelector('[name=deger]').value); toast(`${n} kalemde “${ad}” yazıldı.`); closeDrawer(); sonra?.(); } catch (er) { toast(er.message, 'err'); } };
}
// Excel yüklemede eşlenmemiş sütunlar: hangileri ek sütun olarak alınsın?
export function ekSutunSec(basliklar, firma_id) {
  const var_ = new Set(ozelSutunlar(firma_id).map(fold));
  return new Promise(res => {
    let bitti = false; const son = v => { if (bitti) return; bitti = true; res(v); };
    const p = openDrawer(`<header class="dh"><div><p class="muted">Excel yükleme</p><h2 id="drawer-title">Diğer sütunlar da alınsın mı?</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody form"><p class="hint">Dosyada eşlenmemiş sütunlar var. İşaretlediklerin stokta ek sütun olur ve değerleri her ürüne yazılır (ör. Marka). Var olan ek sütunlar işaretli gelir.</p>
        <div class="sg-sec">${basliklar.map(([i, ad, ornek]) => `<label class="chk"><input type="checkbox" value="${i}" ${var_.has(fold(ad)) ? 'checked' : ''}> <span><b>${esc(ad)}</b>${ornek ? ` <small class="muted">ör. ${esc(String(ornek).slice(0, 40))}</small>` : ''}</span></label>`).join('')}</div>
        <div class="dfoot sticky"><button type="button" class="btn ghost" data-gec>Hiçbirini alma</button><button type="button" class="btn primary" data-al>Devam</button></div></div>`, { onClose: () => son([]) });
    p.querySelector('[data-gec]').onclick = () => { son([]); closeDrawer(true); };
    p.querySelector('[data-al]').onclick = () => { son([...p.querySelectorAll('.sg-sec input:checked')].map(c => +c.value)); closeDrawer(true); };
  });
}
