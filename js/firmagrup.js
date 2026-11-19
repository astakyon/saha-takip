// Grup şirketleri: firmanın bağlı olduğu ana şirket (holding), alt ve kardeş şirketleri; grubun toplamları, ortak kişiler ve "aynı gruba ait olabilir" önerileri.
// Şubeden farkı: şube aynı vergi numaralı ikinci adres; grup şirketi ayrı tüzel kişilik.
import { S } from './db.js';
import { app } from './state.js';
import { esc, usd, num, fold, toast, confirmBox, byId, ACIK } from './ui.js';
import { firmaProjeleri } from './views/firmalar.js';

export const ILISKI = ['Bağlı şirket', 'Kardeş şirket', 'Ortaklık', 'İştirak'];
const firma = id => (S.firmalar || []).find(f => f.id === id);
// En üstteki şirket (döngüye karşı korumalı)
export function grupKoku(f) { let x = f; const goruldu = new Set(); while (x?.ust_firma_id && !goruldu.has(x.id)) { goruldu.add(x.id); const u = firma(x.ust_firma_id); if (!u) break; x = u; } return x; }
export function grupUyeleri(f) {
  const kok = grupKoku(f); if (!kok) return [];
  const l = [kok], kuyruk = [kok.id], var_ = new Set([kok.id]);
  while (kuyruk.length) { const id = kuyruk.shift(); for (const c of (S.firmalar || []).filter(x => x.ust_firma_id === id && !var_.has(x.id))) { var_.add(c.id); l.push(c); kuyruk.push(c.id); } }
  return l;
}
export const grupVar = f => !!f && (!!f.ust_firma_id || (S.firmalar || []).some(x => x.ust_firma_id === f.id));
// Grubun toplamları (USD siparişler, açık bakiye, açık teklif ve projeler)
export function grupToplamlari(uyeler) {
  const ids = new Set(uyeler.map(f => f.id));
  const sip = (S.siparisler || []).filter(s => ids.has(s.firma_id)), tek = (S.teklifler || []).filter(t => ids.has(t.firma_id) && ['Taslak', 'Gönderildi'].includes(t.durum));
  const tah = (S.tahsilatlar || []).filter(t => ids.has(t.firma_id)), bakiye = tah.reduce((a, t) => a + Math.max(0, (+t.tutar || 0) - (+t.odenen || 0)), 0);
  const proj = new Map(); for (const f of uyeler) for (const p of firmaProjeleri(f.id)) proj.set(p.id, p);
  const acikP = [...proj.values()].filter(p => ACIK.includes(p.durum));
  return { uyeler: uyeler.length, siparisN: sip.length, siparisUsd: sip.filter(s => (s.para_birimi || 'USD') === 'USD').reduce((a, s) => a + (+s.net_deger || 0), 0), teklifN: tek.length, teklifTutar: tek.reduce((a, t) => a + (+t.toplam || 0), 0), bakiye, projeN: acikP.length, projeUsd: acikP.reduce((a, p) => a + (+p.tutar_usd || 0), 0) };
}
// Birden fazla grup şirketinde görünen kişiler (aynı e-posta ya da telefon, ya da eski çalışan)
export function ortakKisiler(uyeler) {
  const ids = new Set(uyeler.map(f => f.id)), m = new Map();
  const anahtar = k => [k.eposta && fold(k.eposta), k.telefon && String(k.telefon).replace(/\D/g, '').slice(-10)].filter(Boolean);
  for (const k of (S.kisiler || []).filter(k => ids.has(k.firma_id) || (k.eski_firmalar || []).some(g => ids.has(g.firma_id)))) {
    const firmalar = new Set([k.firma_id, ...(k.eski_firmalar || []).map(g => g.firma_id)].filter(id => ids.has(id)));
    for (const a of anahtar(k)) { const e = m.get(a) || { kisiler: new Set(), firmalar: new Set() }; e.kisiler.add(k); firmalar.forEach(x => e.firmalar.add(x)); m.set(a, e); }
  }
  const sonuc = new Map(); for (const e of m.values()) if (e.firmalar.size > 1) for (const k of e.kisiler) sonuc.set(k.id, { k, firmalar: [...e.firmalar] });
  return [...sonuc.values()];
}
// Aynı gruba ait olabilecek firmalar: vergi no farklı (ya da boş), ama adres, telefon ya da kurumsal e-posta alan adı aynı
const GENEL_ALAN = /^(gmail|hotmail|outlook|yahoo|yandex|icloud|live|msn|mynet|windowslive)\./;
const alanAdi = e => { const a = String(e || '').toLowerCase().split('@')[1]; return a && !GENEL_ALAN.test(a) ? a : null; };
const telNo = t => String(t || '').replace(/\D/g, '').slice(-10);
const adresNo = a => fold(a || '').replace(/[^a-z0-9]/g, '');
export function grupOnerileri(f) {
  const uyeler = new Set(grupUyeleri(f).map(x => x.id)), d = alanAdi(f.eposta), t = telNo(f.telefon), a = adresNo(f.adres);
  const l = [];
  for (const x of S.firmalar || []) {
    if (uyeler.has(x.id) || x.id === f.id || (f.vergi_no && x.vergi_no && f.vergi_no === x.vergi_no)) continue;
    const neden = [d && alanAdi(x.eposta) === d && `aynı e-posta alan adı (${d})`, t.length >= 10 && telNo(x.telefon) === t && 'aynı telefon', a.length >= 15 && adresNo(x.adres) === a && 'aynı adres',
      (S.kisiler || []).some(k => k.firma_id === x.id && alanAdi(k.eposta) && alanAdi(k.eposta) === d) && !(alanAdi(x.eposta) === d) && 'kişilerinin e-postası aynı alan adında'].filter(Boolean);
    if (neden.length) l.push({ f: x, neden });
  }
  return l.slice(0, 8);
}
async function ustSec(x, ust, iliski) {
  // döngü: üst şirket, x'in alt şirketlerinden biri olamaz
  if (ust) { let y = firma(ust); const g = new Set(); while (y && !g.has(y.id)) { if (y.id === x.id) throw new Error('Bu firma, seçtiğin şirketin üst şirketi; döngü olur.'); g.add(y.id); y = y.ust_firma_id ? firma(y.ust_firma_id) : null; } }
  await app.db.save('firmalar', { ...x, ust_firma_id: ust || null, grup_iliski: ust ? (iliski || x.grup_iliski || 'Bağlı şirket') : null });
}
// Firma kartındaki bölüm
export function grupBolumu(kutu, x, yenile) {
  if (!kutu) return;
  const yaz = app.db && !app.db.onizleme && !app.db.yazamaz?.('firmalar');
  const uyeler = grupUyeleri(x), grupta = uyeler.length > 1, kok = grupKoku(x), T = grupta ? grupToplamlari(uyeler) : null, ortak = grupta ? ortakKisiler(uyeler) : [], oneri = yaz ? grupOnerileri(x) : [];
  const dal = (f, d = 0) => { const c = (S.firmalar || []).filter(y => y.ust_firma_id === f.id).sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'));
    return `<li class="${f.id === x.id ? 'fg-ben' : ''}"><a href="#/firma/${f.id}">${esc(f.ad)}</a>${f.ust_firma_id ? ` <small class="muted">${esc(f.grup_iliski || 'Bağlı şirket')}</small>` : d === 0 && grupta ? ' <small class="muted">ana şirket</small>' : ''}${c.length && d < 6 ? `<ul>${c.map(y => dal(y, d + 1)).join('')}</ul>` : ''}</li>`; };
  kutu.innerHTML = `<div class="fs-kb"><h2>Grup şirketleri ${grupta ? `<span class="muted">${uyeler.length}</span>` : ''}</h2></div>
    ${grupta ? `<ul class="fg-agac">${dal(kok)}</ul>
      <dl class="profil-dl fg-top"><dt>Açık projeler</dt><dd>${T.projeN}${T.projeUsd ? ' · ' + usd(T.projeUsd) : ''}</dd><dt>Siparişler</dt><dd>${T.siparisN}${T.siparisUsd ? ' · ' + usd(T.siparisUsd) : ''}</dd><dt>Açık teklifler</dt><dd>${T.teklifN}${T.teklifTutar ? ' · ' + num(Math.round(T.teklifTutar)) : ''}</dd><dt>Açık bakiye</dt><dd>${T.bakiye ? num(Math.round(T.bakiye)) : '—'}</dd></dl>
      ${ortak.length ? `<h3>Birden fazla grup şirketinde görünen kişiler</h3><ul class="list">${ortak.slice(0, 8).map(o => `<li><a href="#/kisi/${o.k.id}"><b>${esc(o.k.ad_soyad)}</b></a> <small class="muted">${o.firmalar.map(id => esc(firma(id)?.ad || '')).join(', ')}</small></li>`).join('')}</ul>` : ''}`
    : '<p class="hint">Bağlı olduğu ana şirket ya da kendisine ait başka şirketler varsa burada birleştir; grubun projeleri, siparişleri ve bakiyesi toplu görünür.</p>'}
    ${yaz ? `<div class="fg-ekle">
      <label class="fld"><span>${x.ust_firma_id ? 'Üst şirketi değiştir' : 'Bağlı olduğu ana şirket'}</span><input data-fgara placeholder="Firma adı yaz…" autocomplete="off" aria-label="Üst şirket ara"></label>
      <label class="fld"><span>İlişki</span><select data-fgil>${ILISKI.map(i => `<option ${i === (x.grup_iliski || 'Bağlı şirket') ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
      <ul class="list fg-sonuc" data-fgsonuc></ul>
      <div class="btnrow"><button type="button" class="btn sm ghost" data-fgalt>+ Alt şirket ekle</button>${x.ust_firma_id ? '<button type="button" class="btn sm ghost danger" data-fgcik>Gruptan çıkar</button>' : ''}</div></div>
      ${oneri.length ? `<h3>Aynı gruba ait olabilir</h3><ul class="list">${oneri.map(o => `<li><span><a href="#/firma/${o.f.id}"><b>${esc(o.f.ad)}</b></a><br><small class="muted">${esc(o.neden.join(', '))}</small></span><span class="btnrow"><button type="button" class="btn sm" data-fgoner="${o.f.id}" data-yon="alt">Alt şirketi yap</button><button type="button" class="btn sm ghost" data-fgoner="${o.f.id}" data-yon="ust">Üst şirketi yap</button></span></li>`).join('')}</ul>` : ''}` : ''}`;
  if (!yaz) return;
  let altMod = false;
  const ara = kutu.querySelector('[data-fgara]'), sonuc = kutu.querySelector('[data-fgsonuc]');
  const listele = () => { const q = fold(ara.value.trim()); if (q.length < 2) { sonuc.innerHTML = ''; return; }
    const haric = new Set([x.id]); if (!altMod) grupUyeleri(x).filter(y => { let z = y; while (z) { if (z.id === x.id) return true; z = z.ust_firma_id ? firma(z.ust_firma_id) : null; } return false; }).forEach(y => haric.add(y.id));
    sonuc.innerHTML = (S.firmalar || []).filter(f => !haric.has(f.id) && fold(f.ad).includes(q)).slice(0, 8).map(f => `<li><button type="button" class="linkrow" data-fgsec="${f.id}"><span><b>${esc(f.ad)}</b> <small class="muted">${esc([f.il, f.vergi_no].filter(Boolean).join(' · '))}</small></span></button></li>`).join('') || '<li class="muted">Firma bulunamadı.</li>';
    sonuc.querySelectorAll('[data-fgsec]').forEach(b => b.onclick = async () => { const il = kutu.querySelector('[data-fgil]').value;
      try { if (altMod) await ustSec(firma(b.dataset.fgsec), x.id, il); else await ustSec(x, b.dataset.fgsec, il); toast(altMod ? `${firma(b.dataset.fgsec).ad} alt şirket olarak eklendi.` : 'Üst şirket kaydedildi.'); yenile(); } catch (e) { toast(e.message, 'err'); } }); };
  ara.oninput = listele;
  kutu.querySelector('[data-fgalt]').onclick = () => { altMod = true; ara.placeholder = 'Alt şirket olacak firmayı yaz…'; ara.closest('.fld').querySelector('span').textContent = 'Alt şirket ekle'; ara.focus(); listele(); };
  kutu.querySelector('[data-fgil]').onchange = async e => { if (x.ust_firma_id) { await app.db.save('firmalar', { ...x, grup_iliski: e.target.value }); toast('İlişki türü kaydedildi.'); } };
  kutu.querySelector('[data-fgcik]')?.addEventListener('click', async () => { if (!confirmBox(`${x.ad} gruptan çıkarılsın mı? (alt şirketleri kendisine bağlı kalır)`)) return; await ustSec(x, null); toast('Gruptan çıkarıldı.'); yenile(); });
  kutu.querySelectorAll('[data-fgoner]').forEach(b => b.onclick = async () => { const o = firma(b.dataset.fgoner);
    try { if (b.dataset.yon === 'alt') await ustSec(o, x.id, 'Bağlı şirket'); else await ustSec(x, o.id, 'Bağlı şirket'); toast('Gruba eklendi.'); yenile(); } catch (e) { toast(e.message, 'err'); } });
}
// Firmalar listesinde rozet
export function grupRozeti(f) { if (!grupVar(f)) return ''; const k = grupKoku(f); return ` <em class="flag soft" title="Grup: ${esc(k?.ad || '')}">${k?.id === f.id ? 'grup ana şirketi' : 'grup: ' + esc(k?.ad || '')}</em>`; }
