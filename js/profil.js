// Firma profili: uygulamanın kime göre çalıştığı (firma, temsil edilen marka, sektör, bölge, ana bayi, katalog).
// Kurulum sihirbazında doldurulur, "firma_profil" ayarında saklanır; ekip üyeleri veri sahibinin profilini kullanır.
// Profil yoksa ilk sürümün ayarları (EAE, Çukurova bölgesi, Drv Elektrik) geçerlidir; böylece eski kurulumlar hiç değişmez.
import { ayar } from './ayar.js';
import { fold, ILLER, IL_MERKEZ, ILCELER, OSBLER, BOLGE_KUTU, RAKIPLER, URUN_AILELERI } from './ui.js';
import { TR_ILLER } from './data/tr-iller.js';

export const SEKTOR = { aydinlatma: 'Aydınlatma', elektrik: 'Elektrik malzemesi ve tesisat', diger: 'Başka bir sektör' };
export const ESKI = { firma: 'EAE Aydınlatma', marka: 'EAE', sektor: 'aydinlatma', iller: ['Adana', 'Mersin', 'Hatay', 'Osmaniye'], bayi: 'Drv Elektrik', katalog: 'eae' };
export const TUM_ILLER = Object.keys(TR_ILLER).sort((a, b) => a.localeCompare(b, 'tr'));

// Sektöre göre başlangıç listeleri (kişi Ayarlar → Listeler'den değiştirebilir)
const ILK_RAKIP = [...RAKIPLER], ILK_AILE = [...URUN_AILELERI];
const ILK_MERKEZ = { ...IL_MERKEZ }, ILK_ILCE = JSON.parse(JSON.stringify(ILCELER)), ILK_OSB = JSON.parse(JSON.stringify(OSBLER));
export const SEKTOR_LISTE = {
  aydinlatma: {
    RAKIPLER: ['Ledvance', 'Philips', 'Pelsan', 'İkizler', 'Proton', 'Cemdağ', 'Alkan', 'Pedaş', 'Niki', 'Lamptime', 'Yavuz', 'Gecem', 'Seva', 'Korg', 'Nade', 'Gersan', 'Üç-El', 'EEC'],
    URUN_AILELERI: ['Downlight', 'Panel', 'Lineer', 'Projektör', 'Yol / sokak', 'Endüstriyel (high bay)', 'Etanj', 'Acil aydınlatma', 'Dış cephe', 'Ray spot', 'Peyzaj'],
  },
  elektrik: {
    RAKIPLER: ['Schneider', 'ABB', 'Siemens', 'Legrand', 'Hager', 'Eaton', 'Viko', 'Makel', 'Klemsan', 'Mutlusan', 'Prysmian', 'Nexans', 'Hes Kablo', 'Öznur Kablo'],
    URUN_AILELERI: ['Kablo', 'Şalt ve pano malzemesi', 'Anahtar ve priz', 'Sigorta / kaçak akım', 'Kompanzasyon', 'Kablo taşıma', 'Topraklama ve paratoner', 'Otomasyon', 'Aydınlatma', 'Zayıf akım'],
  },
  diger: { RAKIPLER: [], URUN_AILELERI: [] },
};

let onbellek = null, imza = '';
export function profil() {
  const p = ayar('firma_profil');
  const k = JSON.stringify(p || null); if (onbellek && k === imza) return onbellek;
  imza = k; onbellek = p ? { ...ESKI, katalog: 'kendi', bayi: '', marka: '', ...p, iller: (p.iller || []).filter(il => TR_ILLER[il] || ILK_MERKEZ[il]) } : { ...ESKI, eski: true };
  if (!onbellek.iller.length) onbellek.iller = [...ESKI.iller];
  return onbellek;
}
export const profilVar = () => !!ayar('firma_profil');
export const eaeKatalog = () => profil().katalog === 'eae';
export const aydinlatmaMi = () => profil().sektor === 'aydinlatma';
export const firmaAdi = () => profil().firma || 'Firma';
export const markaAdi = () => profil().marka || profil().firma || '';
export const anaBayi = () => profil().bayi || '';
// Kısa ad: ekranda (kanal süzgeci, rozet) gösterilir; çok kelimeliyse ilk iki kelime
export const anaBayiKisa = () => anaBayi().split(/\s+/).slice(0, anaBayi().split(/\s+/).length > 2 ? 2 : 1).join(' ');
const ilkKelime = () => anaBayi().split(/\s+/)[0] || '';
// Sipariş carisi ana bayi mi (ilk kelimesiyle)
export const anaBayiMi = ad => { const k = fold(ilkKelime()); return !!k && fold(String(ad || '')).trim().startsWith(k); };
export const sektorListesi = k => profil().eski ? (k === 'RAKIPLER' ? ILK_RAKIP : k === 'URUN_AILELERI' ? ILK_AILE : null) : (SEKTOR_LISTE[profil().sektor] || SEKTOR_LISTE.diger)[k] || null;

// Bölge: il listesi, harita merkezleri, ilçe ve OSB önerileri, bölgenin sınır kutusu
export function profilUygula() {
  const p = profil();
  ILLER.splice(0, ILLER.length, ...p.iller);
  for (const k of Object.keys(IL_MERKEZ)) delete IL_MERKEZ[k];
  for (const k of Object.keys(ILCELER)) delete ILCELER[k];
  for (const k of Object.keys(OSBLER)) delete OSBLER[k];
  let s = 90, w = 180, n = -90, e = -180;
  for (const il of p.iller) {
    const t = TR_ILLER[il];
    IL_MERKEZ[il] = ILK_MERKEZ[il] || (t ? t.m : [39, 35, 6]);
    if (ILK_ILCE[il]) ILCELER[il] = ILK_ILCE[il];
    if (ILK_OSB[il]) OSBLER[il] = ILK_OSB[il];
    for (const poly of t?.s || []) for (const [x, y] of poly[0]) { if (y < s) s = y; if (y > n) n = y; if (x < w) w = x; if (x > e) e = x; }
  }
  if (s > n) { s = 35.8; w = 32.5; n = 38.05; e = 36.75; }
  Object.assign(BOLGE_KUTU, { s: +(s - 0.05).toFixed(3), w: +(w - 0.05).toFixed(3), n: +(n + 0.05).toFixed(3), e: +(e + 0.05).toFixed(3) });
}
export const ilSiniri = il => TR_ILLER[il]?.s || null;
