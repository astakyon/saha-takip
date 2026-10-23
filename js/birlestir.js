// İçe aktarmada mevcut kayıtlarla birleştirme: kayıtlar kimliğe, yoksa ada (doğal anahtara) göre eşleşir.
// Eşleşen kaydın kimliği korunur, bağlantılar (firma, kişi, proje, bölge) yeni kimliklere çevrilir.
// Haritada elle yerleştirilmiş konum, fotoğraflar, kartvizitler ve çizilmiş bölge sınırı hiçbir zaman ezilmez.
import { S, TABLES, pick } from './db.js';
import { fold } from './ui.js';

export const SIRA = ['ayarlar', 'bolgeler', 'firmalar', 'kisiler', 'projeler', 'proje_gecmis', 'ziyaretler', 'gorevler', 'urunler', 'urun_aileleri', 'stok_gecmis', 'rakip_fiyatlar', 'siparisler', 'hedefler', 'teklifler', 'numuneler', 'servis_kayitlari', 'masraflar', 'tahsilatlar', 'belgeler', 'yorumlar'];
const FK = {
  firmalar: ['bolge_id'], kisiler: ['firma_id'],
  projeler: ['bayi_id', 'yatirimci_id', 'projeci_id', 'danisman_id', 'gemut_id', 'emut_id', 'alici_id', 'ilgili_kisi_id', 'bolge_id'],
  proje_gecmis: ['proje_id'], ziyaretler: ['firma_id', 'kisi_id', 'proje_id'], gorevler: ['firma_id', 'proje_id', 'kisi_id'],
  rakip_fiyatlar: ['proje_id'], siparisler: ['firma_id', 'proje_id'],
  teklifler: ['proje_id', 'firma_id', 'kisi_id'], numuneler: ['firma_id', 'kisi_id', 'proje_id'], servis_kayitlari: ['firma_id', 'kisi_id', 'proje_id'],
  tahsilatlar: ['firma_id'], belgeler: ['proje_id', 'firma_id'],
};
const nk = s => fold(s || '').replace(/[^a-z0-9]+/g, '');
const KEY = {
  bolgeler: r => nk(r.ad), firmalar: r => nk(r.ad), projeler: r => nk(r.ad),
  kisiler: r => (r.firma_id || '-') + ':' + nk(r.ad_soyad),
  ziyaretler: r => r.tarih + ':' + (r.firma_id || '-') + ':' + (r.kisi_id || '-') + ':' + nk((r.notlar || '').slice(0, 40)),
  gorevler: r => nk(r.baslik) + ':' + (r.son_tarih || ''),
  urunler: r => String(r.kod || ''), stok_gecmis: r => r.kod + ':' + r.tarih,
  rakip_fiyatlar: r => [r.marka, r.aile, r.lumen_aralik, r.fiyat_metin, r.proje_id].map(nk).join(':'),
  siparisler: r => (r.belge_no || '') + ':' + (r.siparis_no || ''),
  hedefler: r => r.yil + ':' + r.ceyrek, proje_gecmis: r => r.id,
  teklifler: r => r.id, numuneler: r => r.id, servis_kayitlari: r => r.id, masraflar: r => r.id,
  tahsilatlar: r => r.belge_no ? nk(r.cari || r.firma_id) + ':' + nk(r.belge_no) : r.id, belgeler: r => r.id,
  urun_aileleri: r => nk(r.aile), ayarlar: r => String(r.anahtar || ''),
};
const KONUM = ['lat', 'lng', 'konum_yaklasik', 'il', 'ilce', 'belde', 'osb', 'bolge_id', 'adres'];
const KORU = ['fotolar', 'kartvizit_on', 'kartvizit_arka', 'geojson', 'renk', 'google_place_id', 'google_url', 'fis'];
const bos = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
const ayni = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function birlestirSatir(t, ex, inc, mod) {
  if (mod === 'yedek') return { ...ex, ...inc, id: ex.id };
  const out = { ...ex };
  const elleKonum = ex.lat != null && ex.konum_yaklasik === false;
  for (const k of TABLES[t]) {
    if (k === 'id' || !(k in inc)) continue;
    const v = inc[k];
    if (bos(v)) continue;
    if (KORU.includes(k) && !bos(ex[k])) continue;
    if (elleKonum && KONUM.includes(k)) continue;
    if (k === 'tipler') { out.tipler = [...new Set([...(ex.tipler || []), ...v])]; continue; }
    if (k === 'notlar' && !bos(ex.notlar) && ex.notlar !== v) {
      out.notlar = ex.notlar.includes(v) ? ex.notlar : v.includes(ex.notlar) ? v : ex.notlar + '\n' + v; continue;
    }
    if (mod === 'guncelle' || bos(ex[k])) out[k] = v;
  }
  return out;
}

// d: { tablo: [satırlar] } · mod: 'guncelle' (gelen bilgi esas) | 'ekle' (yalnız boş alanlar) | 'yedek' (kimliğe göre tam geri yükleme)
export function birlestir(d, mod = 'guncelle') {
  const idMap = new Map(); const plan = {}; const ozet = { yeni: 0, guncel: 0, ayni: 0 };
  for (const t of SIRA) {
    const gelen = (d[t] || []).filter(r => r && r.id);
    if (!gelen.length) continue;
    const byId = new Map(S[t].map(r => [r.id, r]));
    const byKey = new Map(); for (const r of S[t]) { const k = KEY[t](r); if (k && !byKey.has(k)) byKey.set(k, r); }
    const yaz = [];
    for (const r0 of gelen) {
      const r = { ...r0 };
      for (const f of FK[t] || []) if (r[f] && idMap.has(r[f])) r[f] = idMap.get(r[f]);
      const ex = byId.get(r.id) || (mod === 'yedek' && t !== 'urunler' && t !== 'hedefler' ? null : byKey.get(KEY[t](r)));
      if (!ex) { yaz.push(r); byId.set(r.id, r); byKey.set(KEY[t](r), r); ozet.yeni++; continue; }
      idMap.set(r0.id, ex.id);
      const m = birlestirSatir(t, ex, r, mod);
      if (TABLES[t].every(k => ayni(pick(t, m)[k], pick(t, ex)[k]))) { ozet.ayni++; continue; }
      yaz.push(m); ozet.guncel++;
    }
    if (yaz.length) plan[t] = yaz;
  }
  return { plan, ozet };
}
