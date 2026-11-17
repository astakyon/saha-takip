// Stok tek yerden: bayilerin depoları (bayi_stok) + isteğe bağlı "kendi depomuz" (urunler.stok).
// Ürünler ekranı bizim ürün ve fiyat listemizdir; bayi stoğu Bayi ve partner → Stoklar'dadır.
import { S, uuid } from './db.js';
import { app, F, saveFilters } from './state.js';
import { today, gunEkle, firmaAd } from './ui.js';
import { ayar } from './ayar.js';

export const kendiDepo = () => ayar('kendi_depo') === true;

// kod → [{ firma_id, adet, son_hareket }] (kısa önbellek; liste ekranlarında ürün başına çağrılır)
let _ref = null, _len = -1, _t = 0, _m = new Map();
function harita() {
  const a = S.bayi_stok || [];
  if (a !== _ref || a.length !== _len || Date.now() - _t > 400) {
    _m = new Map();
    for (const s of a) { if (!s.kod) continue; (_m.get(s.kod) || _m.set(s.kod, []).get(s.kod)).push({ firma_id: s.firma_id, adet: +s.adet || 0, son_hareket: s.son_hareket }); }
    _ref = a; _len = a.length; _t = Date.now();
  }
  return _m;
}
export const bayiStokKod = kod => harita().get(kod) || [];
// Ürünün toplam stoğu: bütün bayiler + kendi depomuz (taşınmamış eski depo stoğu da urunler.stok'ta durur)
export const stokAdet = u => u ? (+u.stok || 0) + bayiStokKod(u.kod).reduce((a, x) => a + x.adet, 0) : 0;
// Ürün nerede, kaç adet: [{ ad, adet }]
export function stokNerede(u) {
  const l = bayiStokKod(u?.kod).filter(x => x.adet > 0).map(x => ({ ad: firmaAd(x.firma_id) || 'Bayi', adet: x.adet, firma_id: x.firma_id }));
  if (+u?.stok > 0) l.push({ ad: kendiDepo() ? 'Kendi depomuz' : (u.depo || 'Depo'), adet: +u.stok });
  return l.sort((a, b) => b.adet - a.adet);
}
export const stokMetni = u => stokNerede(u).map(x => `${x.ad} ${x.adet.toLocaleString('tr-TR')}`).join(' · ');

// Stok uyarıları: açık tekliflerin ihtiyacı toplam stoktan fazla olan ürünler; bayi deposunda / kendi depomuzda N günü aşkın hareketsiz stok
export function stokUyarilariHesapla(gun = 60) {
  const ihtiyac = new Map();
  for (const t of S.teklifler || []) if (['Taslak', 'Gönderildi'].includes(t.durum)) for (const k of t.kalemler || []) if (k.kod) ihtiyac.set(k.kod, (ihtiyac.get(k.kod) || 0) + (+k.adet || 0));
  const yetersiz = [];
  for (const [kod, adet] of ihtiyac) { const u = (S.urunler || []).find(x => x.kod === kod); if (!u) continue; const st = stokAdet(u); if (adet > st) yetersiz.push({ u, ihtiyac: adet, stok: st, eksik: adet - st }); }
  const sinir = gunEkle(today(), -gun), hareketsiz = [];
  for (const s of S.bayi_stok || []) {
    if (!(+s.adet > 0) || !s.son_hareket || s.son_hareket > sinir) continue;
    const u = (S.urunler || []).find(x => x.kod === s.kod) || { kod: s.kod, aciklama: s.aciklama || s.kod };
    const fiyat = +s.birim_fiyat || +u.birim_fiyat_usd || 0;
    hareketsiz.push({ u, bayi: firmaAd(s.firma_id), firma_id: s.firma_id, gun: Math.round((new Date(today()) - new Date(s.son_hareket)) / 864e5), deger: (+s.adet || 0) * fiyat });
  }
  // Kendi depomuz (ya da henüz taşınmamış eski depo): stok geçmişinden
  const hist = new Map();
  for (const h of S.stok_gecmis || []) if (!h.firma_id) (hist.get(h.kod) || hist.set(h.kod, []).get(h.kod)).push(h);
  for (const u of S.urunler || []) {
    if (!(+u.stok > 0)) continue;
    const hs = (hist.get(u.kod) || []).sort((a, b) => b.tarih.localeCompare(a.tarih)); if (!hs.length) continue;
    let ilk = hs[0].tarih; for (const h of hs) { if (+h.stok !== +u.stok) break; ilk = h.tarih; }
    if (ilk <= sinir) hareketsiz.push({ u, bayi: kendiDepo() ? 'Kendi depomuz' : (u.depo || ''), gun: Math.round((new Date(today()) - new Date(ilk)) / 864e5), deger: (+u.stok || 0) * (+u.birim_fiyat_usd || 0) });
  }
  hareketsiz.sort((a, b) => b.deger - a.deger);
  return { yetersiz, hareketsiz };
}

// Bayi stok satırlarını yazar; adedi değişenler için stok geçmişine (firma_id ile) satır ekler
export async function bayiStokYaz(rows) {
  const t = today(), gecmis = [];
  for (const r of rows) {
    const eski = (S.bayi_stok || []).find(s => s.firma_id === r.firma_id && s.kod === r.kod);
    const row = { ...(eski || {}), ...r };
    if (!eski || +eski.adet !== +row.adet) { row.son_hareket = t; gecmis.push({ id: uuid(), firma_id: row.firma_id, kod: row.kod, stok: +row.adet || 0, birim_fiyat_usd: row.birim_fiyat ?? null, tarih: t }); }
    await app.db.save('bayi_stok', row);
  }
  if (gecmis.length) { try { await app.db.bulk('stok_gecmis', gecmis); } catch {} }
  return gecmis.length;
}

// ---------- Eski depo stoğunu bayilere taşıma (tek seferlik) ----------
// Ürünler'deki depo adı dolu (ya da şirket profilindeki ana bayiye ait) stoklar, o depoya bağlı bayinin stoğuna aktarılır.
const fold1 = s => String(s || '').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü ]/g, ' ').trim().split(/\s+/)[0] || '';
export function depoBayisi(depo, anaBayiAd) {
  const bl = S.bayiler || [];
  const ad = depo || anaBayiAd; if (!ad) return null;
  const tam = bl.find(b => b.depo && b.depo === ad); if (tam) return tam;
  const k = fold1(ad); if (k.length < 3) return null;
  return bl.find(b => fold1(firmaAd(b.firma_id)) === k) || null;
}
export function tasimaPlani(anaBayiAd) {
  if (kendiDepo()) return { gruplar: [], eslesmeyen: [] };
  const gruplar = new Map(), eslesmeyen = [];
  for (const u of S.urunler || []) {
    if (!(+u.stok > 0)) continue;
    const b = depoBayisi(u.depo, anaBayiAd);
    if (!b) { eslesmeyen.push(u); continue; }
    (gruplar.get(b.id) || gruplar.set(b.id, { b, urunler: [] }).get(b.id)).urunler.push(u);
  }
  return { gruplar: [...gruplar.values()], eslesmeyen };
}
export async function tasimaUygula(plan) {
  let n = 0;
  for (const { b, urunler } of plan.gruplar) {
    const depo = urunler[0]?.depo || null;
    const rows = urunler.map(u => { const eski = (S.bayi_stok || []).find(s => s.firma_id === b.firma_id && s.kod === u.kod);
      return { ...(eski || {}), firma_id: b.firma_id, kod: u.kod, aciklama: u.aciklama, adet: (+eski?.adet || 0) + (+u.stok || 0), birim_fiyat: eski?.birim_fiyat ?? null, son_hareket: u.stok_tarihi || eski?.son_hareket || today() }; });
    for (const r of rows) await app.db.save('bayi_stok', r);
    // Geçmiş: bu deponun eski stok geçmişi bayiye bağlanır
    const hs = (S.stok_gecmis || []).filter(h => !h.firma_id && (h.depo === depo || (!h.depo && urunler.some(u => u.kod === h.kod))));
    if (hs.length) { try { await app.db.bulk('stok_gecmis', hs.map(h => ({ ...h, firma_id: b.firma_id }))); } catch {} }
    // Ürün listesinde stok artık bayide: ürünün kendi stoğu boşaltılır (fiyat ve ürün bilgisi kalır)
    await app.db.bulk('urunler', urunler.map(u => ({ ...u, stok: null, depo: null })));
    n += rows.length;
  }
  return n;
}

// "Bayi stoklarında aç" bağlantıları: hangi bayinin stoğu açılacak
document.addEventListener('click', e => {
  const a = e.target.closest?.('[data-stokbayi],[data-bayi]'); if (!a) return;
  const fid = a.dataset.stokbayi || a.dataset.bayi, b = (S.bayiler || []).find(x => x.firma_id === fid);
  if (b) { F('bayistok', {}).id = b.id; saveFilters(); }
}, true);
