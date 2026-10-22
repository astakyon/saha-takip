// Kullanıcı yetkileri: veri sahibi her şeyi görür; ekip üyesi yalnızca yetki verilen bölümleri görür / düzenler.
import { app } from './state.js';

// Bölüm → tablolar ve ekranlar
export const MODULLER = [
  { k: 'projeler', ad: 'Projeler', t: ['projeler', 'proje_gecmis'], rota: ['projeler', 'referanslar'] },
  { k: 'firmalar', ad: 'Firmalar ve kişiler', t: ['firmalar', 'kisiler'], rota: ['firmalar', 'kisiler'] },
  { k: 'ziyaretler', ad: 'Ziyaretler ve görevler', t: ['ziyaretler', 'gorevler'], rota: ['ziyaretler', 'gorevler', 'takvim', 'rapor'] },
  { k: 'bolgeler', ad: 'Sanayi bölgeleri', t: ['bolgeler'], rota: ['bolgeler'] },
  { k: 'siparisler', ad: 'Siparişler, hedefler ve panel', t: ['siparisler', 'hedefler'], rota: ['siparisler', 'panel'] },
  { k: 'teklifler', ad: 'Teklifler', t: ['teklifler'], rota: ['teklifler'] },
  { k: 'stok', ad: 'Stok, fiyat ve katalog', t: ['urunler', 'stok_gecmis', 'urun_aileleri'], rota: ['urunler', 'katalog', 'araclar'] },
  { k: 'rakip', ad: 'Rakip fiyatları', t: ['rakip_fiyatlar'], rota: ['rakip'] },
  { k: 'tahsilat', ad: 'Tahsilat', t: ['tahsilatlar'], rota: ['tahsilat'] },
  { k: 'numune', ad: 'Numune ve servis', t: ['numuneler', 'servis_kayitlari'], rota: ['numuneler', 'servis'] },
  { k: 'masraf', ad: 'Masraf ve km', t: ['masraflar'], rota: ['masraflar'] },
  { k: 'belgeler', ad: 'Dosyalar ve belgeler', t: ['belgeler'], rota: ['dosyalar'] },
];
export const sahipMi = () => !app.yetki || app.yetki.ben_sahip !== false;
// tablo için 'oku' | 'yaz' | null
export function izin(tablo) {
  if (sahipMi()) return 'yaz';
  return app.yetki.yetkiler?.[tablo] || null;
}
export const modulIzni = m => { const v = m.t.map(izin); return v.includes('yaz') ? 'yaz' : v.includes('oku') ? 'oku' : null; };
const HER_ZAMAN = ['bugun', 'ayarlar'];
const SAHIBE_OZEL = ['kontrol'];
export function rotaIzinli(k) {
  if (sahipMi() || HER_ZAMAN.includes(k)) return true;
  if (SAHIBE_OZEL.includes(k)) return false;
  if (k === 'harita') return !!(izin('projeler') || izin('firmalar'));
  const m = MODULLER.find(m => m.rota.includes(k));
  return m ? !!modulIzni(m) : false;
}
export const rotaYazilabilir = k => { if (sahipMi()) return true; const m = MODULLER.find(m => m.rota.includes(k)); return m ? modulIzni(m) === 'yaz' : true; };
// Modül seçimini tablo yetkilerine çevirir: { projeler: 'yaz', firmalar: 'oku' } → { projeler: 'yaz', proje_gecmis: 'yaz', firmalar: 'oku', kisiler: 'oku' }
export function tabloYetkileri(secim) {
  const o = {};
  for (const m of MODULLER) if (secim[m.k]) for (const t of m.t) o[t] = secim[m.k];
  // Proje ekranında firma adları ve durum geçmişi görünsün diye: proje gören, firmaları en az okur
  if (o.projeler && !o.firmalar) { o.firmalar = 'oku'; o.kisiler = 'oku'; }
  return o;
}
export const modulSecimi = yetkiler => Object.fromEntries(MODULLER.map(m => { const v = m.t.map(t => yetkiler?.[t]); return [m.k, v.includes('yaz') ? 'yaz' : v.includes('oku') ? 'oku' : null]; }));
