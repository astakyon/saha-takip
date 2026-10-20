// Çeyrek gerçekleşenleri: siparişlerden hesaplanan rakam ve (girildiyse) resmi rakam.
// Resmi rakam = şirketin dönemsel tablosundaki "Toplam USD satış" + "Toplam TL satış" / kur. Girildiyse raporlarda o kullanılır.
import { S } from './db.js';
import { kur } from './kur.js';

export const ceyrekOf = d => Math.floor(new Date(d).getMonth() / 3) + 1;
export const hedefKaydi = (Y, c) => S.hedefler.find(h => +h.yil === +Y && +h.ceyrek === +c) || null;
const dolu = v => v !== null && v !== undefined && v !== '' && !isNaN(+v);

// Çeyreğin TL → USD kuru: çeyrek kaydına girilen kur, yoksa güncel kur
export const donemKuru = (Y, c) => +(hedefKaydi(Y, c)?.kur) || kur()?.USD || null;

// Siparişin USD karşılığı (rapor dışı bırakılanlar 0)
export function siparisUsd(s, kurTL) {
  if (s.rapor_disi) return 0;
  const v = +s.net_deger || 0;
  if (!s.para_birimi || s.para_birimi === 'USD') return v;
  if (/TRY|TL/.test(s.para_birimi)) return kurTL ? v / kurTL : 0;
  if (s.para_birimi === 'EUR') { const k = kur(); return k?.EUR && k?.USD ? v * k.EUR / k.USD : 0; }
  return 0;
}

export function ceyrekGercek(Y, c) {
  const h = hedefKaydi(Y, c), k = donemKuru(Y, c);
  const sp = S.siparisler.filter(s => s.tarih && s.tarih.startsWith(String(Y)) && ceyrekOf(s.tarih) === +c);
  const dahil = sp.filter(s => !s.rapor_disi), haric = sp.filter(s => s.rapor_disi);
  const usd = dahil.filter(s => !s.para_birimi || s.para_birimi === 'USD').reduce((a, s) => a + (+s.net_deger || 0), 0);
  const tl = dahil.filter(s => /TRY|TL/.test(s.para_birimi || '')).reduce((a, s) => a + (+s.net_deger || 0), 0);
  const siparis = dahil.reduce((a, s) => a + siparisUsd(s, k), 0);
  const resmiVar = h && (dolu(h.resmi_usd) || dolu(h.resmi_tl));
  const resmi = resmiVar ? (+h.resmi_usd || 0) + (k && +h.resmi_tl ? +h.resmi_tl / k : 0) : null;
  return { hedef: +(h?.tutar_usd) || 0, siparis, usd, tl, kur: k, adet: dahil.length, haric: haric.length, haricUsd: haric.reduce((a, s) => a + siparisUsd({ ...s, rapor_disi: false }, k), 0),
    resmi, resmiUsd: h?.resmi_usd ?? null, resmiTl: h?.resmi_tl ?? null, gercek: resmi ?? siparis, kaynak: resmi != null ? 'resmi' : 'siparis', fark: resmi != null ? resmi - siparis : null, not: h?.notlar || '' };
}
export const yilGercek = Y => [1, 2, 3, 4].map(c => ceyrekGercek(Y, c));
