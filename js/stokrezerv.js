// Projeye stok ayırma (rezerv), kritik seviye bildirimi ve hızlı stok sorgusu (okut, yaz ya da sesle sor → hangi bayide kaç).
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, tarih, today, fold, toast, openDrawer, closeDrawer, confirmBox, firmaAd, byId } from './ui.js';
import { renderForm, bindForm, readForm } from './forms.js';
import { aktifMi, kritikVar, depoAdi } from './stok.js';
import { bildir, kisaAd, sesSecici, sesSeciciBagla } from './okutmases.js';

// ---------- Rezerv ----------
export const rezervler = (firma_id, kod, depo) => (S.stok_rezerv || []).filter(r => r.durum === 'Aktif' && r.firma_id === firma_id && r.kod === kod && (depo === undefined || (r.depo || null) === (depo || null)));
export const rezerveAdet = (firma_id, kod, depo) => rezervler(firma_id, kod, depo).reduce((a, r) => a + (+r.adet || 0), 0);
export const serbest = s => (+s.adet || 0) - rezerveAdet(s.firma_id, s.kod, s.depo ?? null);
export function rezervFormu({ s, init = {}, sonra }) {
  const x0 = init.id ? { ...S.stok_rezerv.find(y => y.id === init.id) } : { firma_id: s.firma_id, kod: s.kod, depo: s.depo ?? null, adet: Math.max(1, serbest(s)), durum: 'Aktif', ...init, _new: true };
  const FM = [{ title: 'Ayırma', fields: [{ k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler' }, { k: 'musteri_id', l: 'Müşteri', t: 'ref', ref: 'firmalar' }, { k: 'adet', l: 'Ayrılacak miktar', t: 'num', req: true }, { k: 'son_tarih', l: 'Ne zamana kadar', t: 'date' }, { k: 'durum', l: 'Durum', t: 'sel', opts: ['Aktif', 'Sevk edildi', 'İptal'] }, { k: 'notlar', l: 'Not', t: 'area', full: true }] }];
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(firmaAd(s.firma_id) || '')} · ${esc(depoAdi(s.depo))}</p><h2 id="drawer-title">${esc(s.kod)} projeye ayır</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate><p class="hint">${esc(s.aciklama || '')} · stokta ${num(s.adet)}, başka projelere ayrılmış ${num(rezerveAdet(s.firma_id, s.kod, s.depo ?? null) - (x0._new ? 0 : +x0.adet || 0))}. Ayrılan miktar listede “ayrıldı” görünür; başka müşteriye çıkışta ve sevkte uyarı verilir, bu projeye sevk edilince düşülür.</p>${renderForm(FM, x0)}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, x0);
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, x0); if (!(+o.adet > 0)) return toast('Miktarı yaz.', 'err'); if (!o.proje_id && !o.musteri_id) return toast('Projeyi ya da müşteriyi seç.', 'err');
    const diger = rezerveAdet(s.firma_id, s.kod, s.depo ?? null) - (x0._new || x0.durum !== 'Aktif' ? 0 : +x0.adet || 0);
    if (o.durum === 'Aktif' && diger + +o.adet > (+s.adet || 0) && !confirmBox(`Ayrılan toplam (${num(diger + +o.adet)}) stoktan (${num(s.adet)}) fazla olacak. Yine de kaydedilsin mi?`)) return;
    const { _new, ...temiz } = x0; if (!o.musteri_id && o.proje_id) o.musteri_id = byId('projeler', o.proje_id)?.alici_id || null;
    await app.db.save('stok_rezerv', { ...temiz, ...o, adet: +o.adet }); toast(`${s.kod}: ${num(o.adet)} ayrıldı.`); closeDrawer(true); sonra?.(); };
}
export function rezervBolumu(s) {
  const l = (S.stok_rezerv || []).filter(r => r.firma_id === s.firma_id && r.kod === s.kod && (r.depo || null) === (s.depo ?? null) && r.durum === 'Aktif');
  return `<section class="rz-bolum" data-rz="${s.id}"><h3>Projelere ayrılan <small class="muted">${l.length ? num(l.reduce((a, r) => a + (+r.adet || 0), 0)) + ' · serbest ' + num(serbest(s)) : ''}</small></h3>
    ${l.length ? `<ul class="list">${l.map(r => `<li><span><b>${num(r.adet)}</b> · ${esc(byId('projeler', r.proje_id)?.ad || firmaAd(r.musteri_id) || '')}${r.son_tarih ? ` <small class="${String(r.son_tarih) < today() ? 'neg' : 'muted'}">${tarih(r.son_tarih)}'e kadar</small>` : ''}${r.notlar ? `<br><small class="muted">${esc(r.notlar)}</small>` : ''}</span><span class="btnrow"><button type="button" class="btn sm ghost" data-rzduz="${r.id}">Düzenle</button><button type="button" class="btn sm ghost danger" data-rziptal="${r.id}">Kaldır</button></span></li>`).join('')}</ul>` : '<p class="muted">Ayrılan yok.</p>'}
    <button type="button" class="btn sm" data-rzyeni>+ Projeye ayır</button></section>`;
}
export function rezervBolumuBagla(kok, s, yenile) {
  const b = kok.querySelector(`[data-rz="${s.id}"]`); if (!b) return;
  b.querySelector('[data-rzyeni]').onclick = () => { closeDrawer(true); rezervFormu({ s, sonra: yenile }); };
  b.querySelectorAll('[data-rzduz]').forEach(x => x.onclick = () => { closeDrawer(true); rezervFormu({ s, init: { id: x.dataset.rzduz }, sonra: yenile }); });
  b.querySelectorAll('[data-rziptal]').forEach(x => x.onclick = async () => { const r = S.stok_rezerv.find(y => y.id === x.dataset.rziptal); if (!confirmBox(`${num(r.adet)} adetlik ayırma kaldırılsın mı?`)) return; await app.db.save('stok_rezerv', { ...r, durum: 'İptal' }); toast('Ayırma kaldırıldı.'); yenile(); });
}
// Sevk yola çıkınca: aynı projeye / müşteriye ayrılmış miktardan düş
export async function sevkRezervDus(sevk) {
  const ilgili = r => r.durum === 'Aktif' && r.firma_id === sevk.firma_id && ((sevk.proje_id && r.proje_id === sevk.proje_id) || (!r.proje_id && sevk.alici_id && r.musteri_id === sevk.alici_id));
  for (const k of sevk.kalemler || []) {
    let kalan = +k.adet || 0;
    for (const r of (S.stok_rezerv || []).filter(r => ilgili(r) && r.kod === k.kod)) { if (kalan <= 0) break; const d = Math.min(kalan, +r.adet || 0); kalan -= d; const yeni = (+r.adet || 0) - d;
      await app.db.save('stok_rezerv', { ...r, adet: Math.max(0, yeni), durum: yeni <= 0 ? 'Sevk edildi' : 'Aktif' }); }
  }
}
// Çıkış başka bir projeye ayrılmış miktara dokunuyor mu? (çıkıştan sonra serbest < 0)
export function rezervUyarisi(s, cikis, { proje_id = null, musteri_id = null } = {}) {
  if (!s) return '';
  const baska = rezervler(s.firma_id, s.kod, s.depo ?? null).filter(r => !(proje_id && r.proje_id === proje_id) && !(musteri_id && r.musteri_id === musteri_id));
  const ayr = baska.reduce((a, r) => a + (+r.adet || 0), 0); if (!ayr) return '';
  const kalan = (+s.adet || 0) - cikis;
  return kalan < ayr ? `${num(ayr)} adet ${baska.map(r => byId('projeler', r.proje_id)?.ad || firmaAd(r.musteri_id) || 'projeye').slice(0, 2).join(', ')} için ayrılmış` : '';
}

// ---------- Kritik seviye ----------
export const kritikAltindakiler = firma_id => (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && aktifMi(s) && kritikVar(s) && (+s.adet || 0) <= +s.kritik);

// ---------- Hızlı stok sorgusu ----------
const DOLGU = new Set(['kac', 'tane', 'adet', 'var', 'mi', 'mu', 'stok', 'stokta', 'nerede', 'hangi', 'bayide', 'depoda', 'bize', 'bizde', 'elimizde', 'ne', 'kadar', 'kalmis', 'lazim', 'acaba', 'tan', 'watt']);
export function stokAra(sorgu) {
  const kelime = fold(String(sorgu || '')).replace(/[?!.,]/g, ' ').split(/\s+/).filter(x => x.length >= 2 && !DOLGU.has(x));
  const q = kelime.join(' '); if (!q) return [];
  const kodlu = (S.bayi_stok || []).filter(s => [s.kod, s.firma_kodu, s.uretici_kodu, s.barkod].some(v => v && fold(String(v)) === q.replace(/\s/g, '')) || (s.barkod && String(s.barkod) === String(sorgu).trim()));
  const esl = (S.stok_barkodlari || []).filter(b => b.barkod === String(sorgu).trim()).map(b => b.kod);
  const l = kodlu.length ? kodlu : esl.length ? (S.bayi_stok || []).filter(s => esl.includes(s.kod)) : (S.bayi_stok || []).filter(s => { const t = fold([s.kod, s.firma_kodu, s.aciklama, s.detay, s.raf, ...(s.ozel ? Object.values(s.ozel) : [])].join(' ')); return kelime.length && kelime.every(k => t.includes(k)); });
  const m = new Map(); for (const s of l.filter(aktifMi)) { const e = m.get(s.kod) || { kod: s.kod, aciklama: s.aciklama || '', yerler: [] }; e.yerler.push({ s, bayi: firmaAd(s.firma_id) || '', depo: depoAdi(s.depo), adet: +s.adet || 0, ayrilan: rezerveAdet(s.firma_id, s.kod, s.depo ?? null), raf: s.raf }); m.set(s.kod, e); }
  return [...m.values()].map(e => ({ ...e, toplam: e.yerler.reduce((a, y) => a + y.adet, 0), yerler: e.yerler.sort((a, b) => b.adet - a.adet) })).sort((a, b) => b.toplam - a.toplam).slice(0, 20);
}
export const sorguMetni = sonuc => !sonuc.length ? 'Bulunamadı' : sonuc.slice(0, 2).map(e => `${kisaAd(e, e.kod)}: ${e.yerler.filter(y => y.adet > 0).slice(0, 3).map(y => `${y.bayi} ${num(y.adet)}`).join(', ') || 'stok yok'}`).join('. ');
export function hizliSorguPenceresi() {
  let dinliyor = null;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Stok</p><h2 id="drawer-title">Hızlı stok sorgusu</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><p class="hint">Ürün kodunu ya da barkodu okut, adını yaz ya da 🎤 ile sor (“Fontana 33 watt kaç tane var?”). Bütün bayilerdeki miktar, ayrılan ve raf yeri görünür.</p>
      <div class="frow"><input type="search" data-hq placeholder="Kod, barkod ya da ürün adı" aria-label="Stok sorgusu" autocomplete="off" enterkeyhint="search">${'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? '<button type="button" class="btn" data-hmik aria-label="Sesle sor">🎤 Sor</button>' : ''}</div>
      ${sesSecici()}<div data-hs></div></div>`, { onClose: () => { try { dinliyor?.stop(); } catch {} } });
  sesSeciciBagla(p);
  const inp = p.querySelector('[data-hq]');
  const sor = (q, soyle = false) => { const R = stokAra(q), k = p.querySelector('[data-hs]');
    k.innerHTML = R.length ? R.map(e => `<div class="hs-kart"><p><b class="mono">${esc(e.kod)}</b> ${esc(e.aciklama)} · <b>toplam ${num(e.toplam)}</b></p><table class="tbl"><tbody>${e.yerler.map(y => `<tr><td>${esc(y.bayi)}</td><td class="muted">${esc(y.depo)}${y.raf ? ' · ▦ ' + esc(y.raf) : ''}</td><td class="r num">${num(y.adet)}</td><td class="r"><small class="muted">${y.ayrilan ? `${num(y.ayrilan)} ayrıldı · serbest ${num(y.adet - y.ayrilan)}` : ''}</small></td></tr>`).join('')}</tbody></table></div>`).join('') : `<p class="muted">“${esc(q)}” için stokta ürün bulunamadı.</p>`;
    if (soyle || R.length) bildir(R.length ? 'ok' : 'hata', sorguMetni(R)); };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); sor(inp.value); } };
  p.querySelector('[data-hmik]')?.addEventListener('click', e => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (dinliyor) { dinliyor.stop(); return; }
    const r = new SR(); r.lang = 'tr-TR'; r.interimResults = false; r.maxAlternatives = 1; dinliyor = r; e.target.textContent = '● Dinliyorum…';
    r.onresult = ev => { const t = ev.results[0][0].transcript; inp.value = t; sor(t, true); };
    r.onerror = ev => toast('Ses anlaşılamadı: ' + ev.error, 'err');
    r.onend = () => { dinliyor = null; e.target.textContent = '🎤 Sor'; };
    r.start();
  });
  setTimeout(() => inp.focus(), 50);
}
