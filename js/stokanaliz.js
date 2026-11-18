// Stok planlama ve analiz: sipariş önerisi (kritik seviyenin altı + tekliflere yetmeyen) ve stok yaşı / devir hızı (kampanya işareti).
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, usd, today, gunEkle, toast, openDrawer, closeDrawer, exportXlsx, firmaAd } from './ui.js';
import { aktifMi, kritikVar, satirFiyat, satirDegerUsd, teklifteAyrilan, stokAdet, depoAdi } from './stok.js';

const gunFarki = d => d ? Math.round((new Date(today() + 'T00:00') - new Date(String(d).slice(0, 10) + 'T00:00')) / 864e5) : null;

// Sipariş önerisi: kritik seviyeye tamamlama + açık tekliflerin bütün bayilerdeki stoktan fazla kalan kısmı (ürün bayide varsa)
export function siparisOnerisi(firma_id, depo = undefined) {
  const rez = teklifteAyrilan(), l = [];
  const kalemler = (S.bayi_stok || []).filter(s => s.firma_id === firma_id && aktifMi(s) && (depo === undefined || (s.depo || null) === (depo || null)));
  for (const s of kalemler) {
    const adet = +s.adet || 0, kritikEksik = kritikVar(s) ? Math.max(0, +s.kritik - adet) : 0;
    const teklif = rez.get(s.kod) || 0, teklifEksik = teklif ? Math.max(0, teklif - stokAdet({ kod: s.kod })) : 0;
    const oneri = Math.max(kritikEksik, teklifEksik);
    if (oneri > 0) l.push({ s, adet, kritik: kritikVar(s) ? +s.kritik : null, teklif, kritikEksik, teklifEksik, oneri, neden: [kritikEksik ? 'kritik seviyenin altında' : '', teklifEksik ? 'tekliflere yetmiyor' : ''].filter(Boolean).join(', ') });
  }
  return l.sort((a, b) => b.oneri - a.oneri);
}
// Çıkış (satış) miktarı, son N gün: bayinin sattıkları (sell-out) kayıtlıysa onlar, yoksa stok geçmişindeki çıkışlar (sayım, silme, transfer hariç)
export function cikis(firma_id, kod, gun = 90) {
  const sinir = gunEkle(today(), -gun);
  const so = (S.bayi_satis || []).filter(x => x.firma_id === firma_id && x.kod === kod && String(x.tarih || '') >= sinir);
  if (so.length) return so.reduce((a, x) => a + (+x.adet || 0), 0);
  return (S.stok_gecmis || []).filter(h => h.firma_id === firma_id && h.kod === kod && String(h.tarih || '') >= sinir && +h.fark < 0 && ['cikis', 'excel', 'sevk', undefined, null, ''].includes(h.hareket)).reduce((a, h) => a - +h.fark, 0);
}
// Stok yaşı ve devir hızı: kaç gündür hareketsiz, günlük ortalama çıkış, kalan stok kaç günde erir; uzun bekleyenler kampanya adayı
export function stokYasi(firma_id, depo = undefined, gun = 90) {
  return (S.bayi_stok || []).filter(s => s.firma_id === firma_id && aktifMi(s) && +s.adet > 0 && (depo === undefined || (s.depo || null) === (depo || null))).map(s => {
    const c = cikis(firma_id, s.kod, gun), gunluk = c / gun, yas = gunFarki(s.son_hareket);
    const erime = gunluk > 0 ? Math.round((+s.adet || 0) / gunluk) : null;
    return { s, yas, cikis: c, aylik: Math.round(gunluk * 30 * 10) / 10, erime, deger: satirDegerUsd(s), aday: (yas ?? 0) >= 90 || (erime != null && erime > 180) };
  }).sort((a, b) => (b.aday - a.aday) || (b.erime ?? 1e9) - (a.erime ?? 1e9) || b.deger - a.deger);
}

export function planlamaPenceresi({ b, firma_id, depo = undefined, bayiAdi = '', yazabilir = false, sonra }) {
  let sekme = 'oneri';
  const p = openDrawer('<div class="dbody"></div>', { wide: true, onClose: () => sonra?.() });
  const ciz = () => {
    const O = siparisOnerisi(firma_id, depo), Y = stokYasi(firma_id, depo);
    p.innerHTML = `<header class="dh"><div><p class="muted">${esc(bayiAdi)}${depo !== undefined ? ' · ' + esc(depoAdi(depo)) : ''}</p><h2 id="drawer-title">Planlama ve analiz</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody"><div class="seg" role="group" aria-label="Bölüm"><button type="button" data-ps="oneri" class="${sekme === 'oneri' ? 'on' : ''}">Sipariş önerisi (${O.length})</button><button type="button" data-ps="yas" class="${sekme === 'yas' ? 'on' : ''}">Stok yaşı ve devir</button></div><div data-pi></div></div>`;
    const pi = p.querySelector('[data-pi]');
    if (sekme === 'oneri') {
      pi.innerHTML = O.length ? `<p class="hint">Kritik seviyenin altına düşen ve açık tekliflere yetmeyen ürünler. Önerilen miktar kritik seviyeye tamamlar ya da teklif açığını kapatır; değiştirebilirsin.</p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Stok</th><th class="r">Kritik</th><th class="r">Teklifte</th><th>Neden</th><th class="r">Öneri</th></tr></thead><tbody>
        ${O.map((x, i) => `<tr><td class="mono">${esc(x.s.kod)}</td><td>${esc(x.s.aciklama || '')}</td><td class="r num">${num(x.adet)}</td><td class="r num">${x.kritik == null ? '' : num(x.kritik)}</td><td class="r num">${x.teklif ? num(x.teklif) : ''}</td><td><small class="muted">${esc(x.neden)}</small></td><td class="r"><input type="number" inputmode="decimal" step="any" min="0" class="sy-say" data-on="${i}" value="${x.oneri}" aria-label="${esc(x.s.kod)} önerilen miktar"></td></tr>`).join('')}</tbody></table></div>
        <div class="btnrow">${yazabilir ? '<button type="button" class="btn primary" data-oteklif>Teklif taslağı oluştur</button>' : ''}<button type="button" class="btn ghost" data-oxlsx>Excel</button></div>`
        : '<div class="empty"><p>Sipariş önerisi yok: kritik seviyenin altında ya da tekliflere yetmeyen ürün bulunmuyor.</p><p class="hint">Öneri için kalem kartında kritik seviye gir.</p></div>';
      const sec = () => O.map((x, i) => ({ x, m: +pi.querySelector(`[data-on="${i}"]`)?.value || 0 })).filter(y => y.m > 0);
      pi.querySelector('[data-oxlsx]')?.addEventListener('click', () => exportXlsx(`siparis-onerisi-${today()}`, { 'Sipariş önerisi': sec().map(({ x, m }) => ({ Bayi: bayiAdi, Depo: depoAdi(x.s.depo), Kod: x.s.kod, Ürün: x.s.aciklama, Birim: x.s.birim || null, Stok: x.adet, Kritik: x.kritik, Teklifte: x.teklif || null, Neden: x.neden, Öneri: m })) }));
      pi.querySelector('[data-oteklif]')?.addEventListener('click', async () => {
        const l = sec(); if (!l.length) return toast('Önerilen miktar yok.', 'err');
        const { teklifForm } = await import('./views/teklif.js');
        closeDrawer(true);
        teklifForm({ firma_id, kalemler: l.map(({ x, m }) => { const u = (S.urunler || []).find(y => y.kod === x.s.kod); return { kod: x.s.kod, ad: x.s.aciklama || u?.aciklama || x.s.kod, adet: m, birim_fiyat: +u?.birim_fiyat_usd || 0 }; }), notlar: `${bayiAdi} stok önerisi (${today()}): kritik seviyenin altındaki ve tekliflere yetmeyen ürünler.` }, () => sonra?.());
      });
    } else {
      const aday = Y.filter(y => y.aday);
      pi.innerHTML = Y.length ? `<p class="hint">Son 90 günün çıkışına göre: aylık ortalama çıkış ve kalan stoğun kaç günde eriyeceği. 90 günden uzun hareketsiz ya da 180 günden uzun sürede eriyecek kalemler kampanya adayıdır.</p>
        <p><b>${aday.length}</b> kampanya adayı · değeri ~${usd(Math.round(aday.reduce((a, y) => a + y.deger, 0)))}</p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>${yazabilir ? '<th class="bs-c"></th>' : ''}<th>Kod</th><th>Ürün</th><th class="r">Stok</th><th class="r">Hareketsiz</th><th class="r">Aylık çıkış</th><th class="r">Erime</th><th class="r">Değer</th></tr></thead><tbody>
        ${Y.slice(0, 300).map(y => `<tr class="${y.aday ? 'eksik' : ''}">${yazabilir ? `<td class="bs-c"><input type="checkbox" data-kmp="${y.s.id}" ${y.s.kampanya ? 'checked' : ''} aria-label="${esc(y.s.kod)} kampanya"></td>` : ''}<td class="mono">${esc(y.s.kod)}</td><td>${esc(y.s.aciklama || '')}${y.s.kampanya ? ' <em class="sg-rozet">kampanya</em>' : ''}</td><td class="r num">${num(y.s.adet)}</td><td class="r num">${y.yas == null ? '' : y.yas + ' gün'}</td><td class="r num">${y.aylik ? num(y.aylik) : '—'}</td><td class="r num">${y.erime == null ? '<span class="neg">satış yok</span>' : y.erime + ' gün'}</td><td class="r num">${y.deger ? usd(Math.round(y.deger)) : ''}</td></tr>`).join('')}</tbody></table></div>
        <div class="btnrow">${yazabilir ? '<button type="button" class="btn" data-kadaylar>Adayların hepsini kampanyaya işaretle</button>' : ''}<button type="button" class="btn ghost" data-yxlsx>Excel</button></div>`
        : '<div class="empty"><p>Stokta kalem yok.</p></div>';
      pi.querySelectorAll('[data-kmp]').forEach(c => c.onchange = async () => { const s = S.bayi_stok.find(x => x.id === c.dataset.kmp); await app.db.save('bayi_stok', { ...s, kampanya: c.checked }); toast(c.checked ? `${s.kod} kampanyaya işaretlendi.` : `${s.kod} kampanyadan çıkarıldı.`); ciz(); });
      pi.querySelector('[data-kadaylar]')?.addEventListener('click', async () => { const l = aday.filter(y => !y.s.kampanya).map(y => ({ ...y.s, kampanya: true })); if (!l.length) return toast('Adayların hepsi zaten işaretli.'); await app.db.bulk('bayi_stok', l); toast(`${l.length} kalem kampanyaya işaretlendi.`); ciz(); });
      pi.querySelector('[data-yxlsx]')?.addEventListener('click', () => exportXlsx(`stok-yasi-${today()}`, { 'Stok yaşı': Y.map(y => ({ Bayi: bayiAdi, Depo: depoAdi(y.s.depo), Kod: y.s.kod, Ürün: y.s.aciklama, Stok: +y.s.adet, 'Hareketsiz (gün)': y.yas, 'Son 90 gün çıkış': y.cikis, 'Aylık çıkış': y.aylik, 'Erime (gün)': y.erime, 'Değer (USD)': Math.round(y.deger), 'Kampanya adayı': y.aday ? 'Evet' : '', Kampanya: y.s.kampanya ? 'Evet' : '' })) }));
    }
    p.querySelectorAll('[data-ps]').forEach(x => x.onclick = () => { sekme = x.dataset.ps; ciz(); });
  };
  ciz();
}
