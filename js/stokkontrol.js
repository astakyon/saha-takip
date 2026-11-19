// Mal kabul (teslimat) kontrolü: irsaliyedeki beklenen liste ile okutulanın karşılaştırılması; fark tutanağı.
// Hasarlı ürün kayıtları: gelen malda hasar, depoda hasar, müşteri iadesi; fotoğraf, üreticiye bildirim, tutanak.
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, tarih, today, fold, toast, openDrawer, closeDrawer, confirmBox, pickFiles, firmaAd } from './ui.js';
import { renderForm, bindForm, readForm } from './forms.js';
import { bayiStokYaz, ayniKalem, depoAdi } from './stok.js';
import { benimAdim } from './sablon.js';

// ---------- Beklenen liste ----------
// Metin: her satır "kod miktar" (boşluk, sekme, ; ya da x ile); miktarsız satır 1 sayılır
export function beklenenMetinden(metin) {
  const m = new Map();
  for (const satir of String(metin || '').split(/\n+/)) {
    const t = satir.trim(); if (!t) continue;
    const r = /^(.+?)[\s;,\t×x*]+(\d+(?:[.,]\d+)?)\s*(?:adet|ad|pcs|pc)?\.?$/i.exec(t);
    const kod = (r ? r[1] : t).trim().replace(/[;,]$/, ''), adet = r ? +r[2].replace(',', '.') : 1;
    if (kod) m.set(kod, (m.get(kod) || 0) + adet);
  }
  return m;
}
export async function beklenenExcelden() {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return null;
  await (await import('./ui.js')).xlsxYukle();
  const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  const hi = rows.findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 2); if (hi < 0) throw new Error('Dosyada başlık satırı bulunamadı.');
  const h = rows[hi].map(c => fold(String(c ?? ''))), bul = (...re) => { for (const r of re) { const i = h.findIndex(x => r.test(x)); if (i >= 0) return i; } return -1; };
  const ck = bul(/urun kod/, /^kod/, /malzeme kod/, /stok kod/, /code/, /kod/), cm = bul(/miktar/, /adet/, /qty|quantity/);
  if (ck < 0 || cm < 0) throw new Error('Kod ve miktar sütunları bulunamadı (başlıkta “Kod” ve “Miktar” olmalı).');
  const m = new Map();
  for (const r of rows.slice(hi + 1)) { const kod = String(r[ck] ?? '').trim(); const a = +String(r[cm] ?? '').replace(',', '.') || 0; if (kod && a) m.set(kod, (m.get(kod) || 0) + a); }
  return m;
}
// Karşılaştırma: kalemBul ile beklenen kod, okutulan kalemin kod / firma / üretici koduyla eşleşir
export function farkHesapla(beklenen, okutulan, kalemler = []) {
  const anahtar = kod => { const k = fold(String(kod)); const s = kalemler.find(x => [x.kod, x.firma_kodu, x.uretici_kodu, x.barkod].some(v => v && fold(String(v)) === k)); return s?.kod || kod; };
  const B = new Map(); for (const [k, a] of beklenen) { const kk = anahtar(k); B.set(kk, (B.get(kk) || 0) + a); }
  const l = [];
  for (const [kod, b] of B) { const o = okutulan.get(kod) || 0; l.push({ kod, beklenen: b, okutulan: o, durum: o === b ? 'tamam' : o < b ? 'eksik' : 'fazla' }); }
  for (const [kod, o] of okutulan) if (!B.has(kod) && o > 0) l.push({ kod, beklenen: 0, okutulan: o, durum: 'listede yok' });
  return l;
}
export const DURUM_AD = { tamam: 'Tamam', eksik: 'Eksik', fazla: 'Fazla', 'listede yok': 'Listede yok' };
export function farkTutanagi({ baslik = 'Mal kabul fark tutanağı', bayi = '', belge = '', satirlar, hasarlar = [] }) {
  const ad = kod => (S.bayi_stok || []).find(s => s.kod === kod)?.aciklama || (S.urunler || []).find(u => u.kod === kod)?.aciklama || '';
  const fark = satirlar.filter(x => x.durum !== 'tamam');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title><style>@page { size: A4; margin: 14mm; } body { font: 10pt/1.45 Arial, sans-serif; color: #111; } h1 { font-size: 15pt; margin: 0 0 4px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; } .r { text-align: right; } .imza { display: flex; justify-content: space-between; margin-top: 40px; } .imza div { width: 40%; border-top: 1px solid #000; padding-top: 4px; text-align: center; }</style></head><body>
    <h1>${esc(baslik)}</h1><p>${esc([bayi, belge && 'Belge: ' + belge, 'Tarih: ' + tarih(today())].filter(Boolean).join(' · '))}</p>
    <table><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Beklenen</th><th class="r">Gelen</th><th class="r">Fark</th><th>Durum</th></tr></thead><tbody>
    ${(fark.length ? fark : satirlar).map(x => `<tr><td>${esc(x.kod)}</td><td>${esc(ad(x.kod))}</td><td class="r">${num(x.beklenen)}</td><td class="r">${num(x.okutulan)}</td><td class="r">${x.okutulan - x.beklenen > 0 ? '+' : ''}${num(x.okutulan - x.beklenen)}</td><td>${DURUM_AD[x.durum]}</td></tr>`).join('')}</tbody></table>
    ${fark.length ? '' : '<p>Gelen mal irsaliyeyle uyumlu; fark yok.</p>'}
    ${hasarlar.length ? `<h2 style="font-size:12pt">Hasarlı gelen</h2><table><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Adet</th><th>Açıklama</th></tr></thead><tbody>${hasarlar.map(h => `<tr><td>${esc(h.kod)}</td><td>${esc(ad(h.kod))}</td><td class="r">${num(h.adet)}</td><td>${esc(h.notlar || '')}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="imza"><div>Teslim eden</div><div>Teslim alan${benimAdim() ? '<br>' + esc(benimAdim()) : ''}</div></div></body></html>`;
}
export const yazdir = html => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; f.srcdoc = html; document.body.appendChild(f);
  f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Yazdırılamadı: ' + e.message, 'err'); } setTimeout(() => f.remove(), 60000); }, 300); };

// ---------- Hasar kayıtları ----------
export const HASAR_TUR = ['Hasarlı geldi', 'Depoda hasar', 'Müşteri iadesi'];
export const HASAR_DURUM = ['Açık', 'Üreticiye bildirildi', 'Değişim geldi', 'İade edildi', 'Kapandı'];
const acikMi = h => !['Kapandı', 'Değişim geldi', 'İade edildi'].includes(h.durum);
export async function hasarKaydet(o, { stoktanDus = false } = {}) {
  const r = { ...o, adet: +o.adet || 1, tarih: o.tarih || today(), durum: o.durum || 'Açık', tur: o.tur || 'Hasarlı geldi', fotolar: o.fotolar || [] };
  if (stoktanDus && !r.stoktan_dustu) {
    const s = (S.bayi_stok || []).find(x => ayniKalem(x, r.firma_id, r.kod, r.depo || null));
    if (s) { await bayiStokYaz([{ ...s, adet: Math.max(0, (+s.adet || 0) - r.adet) }], { hareket: 'hasar', aciklama: `Hasar: ${r.tur}${r.notlar ? ' – ' + r.notlar : ''}` }); r.stoktan_dustu = true; }
  }
  await app.db.save('stok_hasar', r); return r;
}
export function hasarFormu(init, sonra) {
  const x0 = init.id ? { ...S.stok_hasar.find(y => y.id === init.id) } : { tur: 'Depoda hasar', durum: 'Açık', adet: 1, tarih: today(), fotolar: [], ...init, _new: true };
  const s0 = (S.bayi_stok || []).find(s => ayniKalem(s, x0.firma_id, x0.kod, x0.depo || null));
  const FM = [{ title: 'Hasar', fields: [{ k: 'kod', l: 'Ürün kodu', req: true, t: 'combo', opts: () => (S.bayi_stok || []).filter(s => s.firma_id === x0.firma_id).map(s => s.kod) }, { k: 'adet', l: 'Adet', t: 'num' }, { k: 'tur', l: 'Tür', t: 'sel', opts: HASAR_TUR }, { k: 'durum', l: 'Durum', t: 'sel', opts: HASAR_DURUM },
      { k: 'tarih', l: 'Tarih', t: 'date' }, { k: 'tedarikci', l: 'Tedarikçi / üretici', ph: 'ör. Pelsan' }, { k: 'belge_no', l: 'İrsaliye / belge no' }, { k: 'fotolar', l: 'Fotoğraflar (kanıt)', t: 'photos', damga: true }, { k: 'notlar', l: 'Hasarın açıklaması', t: 'area', full: true, ph: 'Kırık kapak, ezik koli, çalışmıyor…' }] }];
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(firmaAd(x0.firma_id) || '')}${s0 ? ' · ' + esc(s0.aciklama || '') : ''}</p><h2 id="drawer-title">${x0._new ? 'Hasarlı ürün kaydı' : esc(x0.kod) + ' hasarı'}</h2></div>
    ${x0._new ? '' : '<div class="dh-actions"><button type="button" class="btn sm" data-ht="pdf">Tutanak</button><button type="button" class="btn sm" data-ht="wa">WhatsApp</button></div>'}<button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>${renderForm(FM, x0)}
      ${x0.stoktan_dustu ? '<p class="hint">Bu adet stoktan düşüldü.</p>' : `<label class="chk"><input type="checkbox" data-hdus ${x0.tur === 'Depoda hasar' ? 'checked' : ''}> <span>Hasarlı adedi satılabilir stoktan düş${s0 ? ` (stokta ${num(s0.adet)})` : ''}</span></label>`}
      <div class="dfoot sticky">${x0._new ? '' : '<button type="button" class="btn ghost danger" data-hsil>Sil</button>'}<button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, x0);
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, x0); if (!String(o.kod || '').trim()) return toast('Ürün kodunu yaz.', 'err');
    const { _new, ...temiz } = x0; const s = (S.bayi_stok || []).find(y => ayniKalem(y, x0.firma_id, o.kod, x0.depo || null));
    try { await hasarKaydet({ ...temiz, ...o, kod: String(o.kod).trim(), aciklama: s?.aciklama || temiz.aciklama || null }, { stoktanDus: !!form.querySelector('[data-hdus]')?.checked }); toast('Hasar kaydedildi.'); closeDrawer(true); sonra?.(); } catch (er) { toast('Kaydedilemedi: ' + er.message, 'err'); } };
  p.querySelector('[data-hsil]')?.addEventListener('click', async () => { if (!confirmBox('Hasar kaydı silinsin mi? (stoktan düşülen adet geri eklenmez)')) return; await app.db.del('stok_hasar', x0.id); toast('Silindi.'); closeDrawer(true); sonra?.(); });
  p.querySelectorAll('[data-ht]').forEach(b => b.onclick = async () => { const x = S.stok_hasar.find(y => y.id === x0.id) || x0;
    if (b.dataset.ht === 'pdf') yazdir(await hasarTutanagi(x));
    else window.open(`https://wa.me/?text=${encodeURIComponent(hasarMetni(x))}`, '_blank', 'noopener'); });
}
export const hasarMetni = x => [`Hasarlı ürün bildirimi${x.belge_no ? ' · ' + x.belge_no : ''}`, `${x.kod}${x.aciklama ? ' – ' + x.aciklama : ''}`, `Adet: ${num(x.adet)} · ${x.tur} · ${tarih(x.tarih)}`, x.notlar || '', (x.fotolar || []).length ? `${x.fotolar.length} fotoğraf ektedir.` : '', benimAdim() || ''].filter(Boolean).join('\n');
export async function hasarTutanagi(x) {
  const res = []; for (const f of (x.fotolar || []).slice(0, 8)) { try { const u = await app.db.url(f); if (u) res.push(u); } catch {} }
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Hasar tutanağı ${esc(x.kod)}</title><style>@page { size: A4; margin: 14mm; } body { font: 10.5pt/1.5 Arial, sans-serif; } h1 { font-size: 15pt; } td { padding: 3px 8px 3px 0; vertical-align: top; } .ft { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 8mm; } .ft img { width: 100%; max-height: 80mm; object-fit: contain; border: 1px solid #ccc; } .imza { display: flex; justify-content: space-between; margin-top: 30px; } .imza div { width: 40%; border-top: 1px solid #000; text-align: center; padding-top: 4px; }</style></head><body>
    <h1>Hasar tutanağı</h1><table><tr><td><b>Bayi / depo</b></td><td>${esc(firmaAd(x.firma_id) || '')}${x.depo ? ' · ' + esc(depoAdi(x.depo)) : ''}</td></tr><tr><td><b>Ürün</b></td><td>${esc(x.kod)}${x.aciklama ? ' – ' + esc(x.aciklama) : ''}</td></tr>
    <tr><td><b>Adet</b></td><td>${num(x.adet)}</td></tr><tr><td><b>Tür</b></td><td>${esc(x.tur)}</td></tr><tr><td><b>Tarih</b></td><td>${tarih(x.tarih)}</td></tr>${x.tedarikci ? `<tr><td><b>Tedarikçi</b></td><td>${esc(x.tedarikci)}</td></tr>` : ''}${x.belge_no ? `<tr><td><b>Belge no</b></td><td>${esc(x.belge_no)}</td></tr>` : ''}<tr><td><b>Durum</b></td><td>${esc(x.durum)}</td></tr></table>
    ${x.notlar ? `<p><b>Açıklama:</b> ${esc(x.notlar)}</p>` : ''}${res.length ? `<div class="ft">${res.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>` : ''}
    <div class="imza"><div>Teslim eden / taşıyıcı</div><div>Tespit eden${benimAdim() ? '<br>' + esc(benimAdim()) : ''}</div></div></body></html>`;
}
export function hasarlarPenceresi({ firma_id = null, bayiAdi = '', sonra } = {}) {
  let sadeceAcik = true;
  const p = openDrawer('<div class="dbody"></div>', { wide: true, onClose: () => sonra?.() });
  const ciz = () => {
    const l = (S.stok_hasar || []).filter(h => (!firma_id || h.firma_id === firma_id) && (!sadeceAcik || acikMi(h))).sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')));
    const acik = (S.stok_hasar || []).filter(h => (!firma_id || h.firma_id === firma_id) && acikMi(h));
    p.innerHTML = `<header class="dh"><div><p class="muted">${esc(bayiAdi)}</p><h2 id="drawer-title">Hasarlı ürünler</h2></div>${firma_id ? '<div class="dh-actions"><button type="button" class="btn sm primary" data-hyeni>+ Hasar kaydı</button></div>' : ''}<button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p><b>${acik.length}</b> açık kayıt · ${num(acik.reduce((a, h) => a + (+h.adet || 0), 0))} adet</p>
      <div class="seg" role="group" aria-label="Göster"><button type="button" data-ha="1" class="${sadeceAcik ? 'on' : ''}">Açık olanlar</button><button type="button" data-ha="0" class="${sadeceAcik ? '' : 'on'}">Hepsi</button></div>
      ${l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tarih</th><th>Kod</th><th>Ürün</th><th class="r">Adet</th><th>Tür</th><th>Durum</th><th>Tedarikçi</th><th></th></tr></thead><tbody>
      ${l.map(h => `<tr><td>${tarih(h.tarih)}</td><td class="mono">${esc(h.kod)}</td><td>${esc(h.aciklama || '')}${(h.fotolar || []).length ? ` <span title="${h.fotolar.length} fotoğraf">📷</span>` : ''}</td><td class="r num">${num(h.adet)}</td><td>${esc(h.tur)}</td><td><select data-hd="${h.id}" aria-label="${esc(h.kod)} durum">${HASAR_DURUM.map(d => `<option ${d === h.durum ? 'selected' : ''}>${d}</option>`).join('')}</select></td><td>${esc(h.tedarikci || '')}</td><td><button type="button" class="btn sm ghost" data-hac="${h.id}">Aç</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Kayıt yok.</p>'}</div>`;
    p.querySelectorAll('[data-ha]').forEach(b => b.onclick = () => { sadeceAcik = b.dataset.ha === '1'; ciz(); });
    p.querySelectorAll('[data-hd]').forEach(s => s.onchange = async () => { const h = S.stok_hasar.find(y => y.id === s.dataset.hd); await app.db.save('stok_hasar', { ...h, durum: s.value }); toast(`${h.kod}: ${s.value}`); ciz(); });
    p.querySelectorAll('[data-hac]').forEach(b => b.onclick = () => { closeDrawer(true); hasarFormu({ id: b.dataset.hac }, () => hasarlarPenceresi({ firma_id, bayiAdi, sonra })); });
    p.querySelector('[data-hyeni]')?.addEventListener('click', () => { closeDrawer(true); hasarFormu({ firma_id }, () => hasarlarPenceresi({ firma_id, bayiAdi, sonra })); });
  };
  ciz();
}
