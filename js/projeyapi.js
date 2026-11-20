// Proje yapısı: Firma → Şantiye (ana proje) → Blok (alt proje) → Kapsam.
// Ana projenin blokları ve özeti, şantiye aşamasına göre aydınlatma alımı tahmini, yakındaki şantiyeler, aşamada bekleme günü.
import { S } from './db.js';
import { today, ACIK, gunEkle } from './ui.js';
import { km } from './geo.js';

export const bloklari = p => p ? S.projeler.filter(x => x.ust_proje_id === p.id) : [];
export const anaProje = p => p?.ust_proje_id ? S.projeler.find(x => x.id === p.ust_proje_id) || null : null;

// Blokların özeti: sayısı, aşamaları, toplam / kazanılan / kaybedilen tutar (kaybedilende rakip markalar)
export function blokOzeti(p) {
  const l = bloklari(p), tut = x => +(x.durum === 'Sipariş' ? x.siparis_tutari_usd || x.tutar_usd : x.tutar_usd) || 0;
  const asama = {}; for (const b of l) asama[b.durum || 'Proje'] = (asama[b.durum || 'Proje'] || 0) + 1;
  const kaz = l.filter(b => b.durum === 'Sipariş'), kay = l.filter(b => b.durum === 'Kayıp');
  return { n: l.length, asama, toplam: l.filter(b => b.durum !== 'İptal').reduce((a, b) => a + tut(b), 0), kazanilan: kaz.reduce((a, b) => a + tut(b), 0), kazN: kaz.length,
    kaybedilen: kay.reduce((a, b) => a + (+b.rakip_toplam_usd || tut(b)), 0), kayN: kay.length, rakipler: [...new Set(kay.map(b => b.rakip_marka).filter(Boolean))], acik: l.filter(b => ACIK.includes(b.durum)).length };
}

// Aşamaya giriş günü (aşama geçmişinden; yoksa kayıt tarihi) ve o aşamada geçen gün
export function asamadaGun(p) {
  let t = null; for (const g of S.proje_gecmis || []) if (g.proje_id === p.id && g.yeni_durum === p.durum) { const d = String(g.tarih || '').slice(0, 10); if (!t || d > t) t = d; }
  const bas = t || String(p.created_at || '').slice(0, 10); if (!bas) return null;
  return Math.max(0, Math.round((new Date(today() + 'T00:00') - new Date(bas + 'T00:00')) / 864e5));
}
// Uzun süre aynı aşamada kalan açık projeler / bloklar (Bugün ekranı)
export const BEKLEME_SINIRI = { 'Teklif Verildi': 30, 'Sıcak': 30, 'İhale': 45, 'Proje': 120, 'Beklemede': 90 };
export function asamadaBekleyenler() {
  return S.projeler.filter(p => !p.aday && ACIK.includes(p.durum) && BEKLEME_SINIRI[p.durum]).map(p => ({ p, gun: asamadaGun(p) })).filter(x => x.gun != null && x.gun >= BEKLEME_SINIRI[x.p.durum]).sort((a, b) => b.gun - a.gun);
}

// Şantiye aşamasına göre aydınlatma alımına kalan ay (deneyime dayalı ortalama; proje kartında elle düzeltilir)
export const ALIM_AY = { 'Proje aşamasında': 9, 'Temel / kaba inşaat': 5, 'İnce işler': 2, 'Elektrik tesisatı': 1, 'Tamamlanmak üzere': 0.5, 'Tamamlandı': 0 };
export function alimTahmini(p) {
  const ay = ALIM_AY[p?.santiye_asamasi]; if (ay == null) return null;
  // Başlangıç: aşamanın girildiği son şantiye ziyareti, yoksa bugün
  const z = S.ziyaretler.filter(x => x.proje_id === p.id && x.amac === 'Şantiye' && String(x.notlar || '').includes(p.santiye_asamasi)).map(x => x.tarih).sort().pop();
  const bas = z || today(), tarih = gunEkle(bas, Math.round(ay * 30));
  return { tarih: tarih < today() ? today() : tarih, ay, bas };
}

// Yakındaki şantiyeler: konumu olan, açık projeler (kendisi ve blokları hariç), kuş uçuşu km
export function yakindakiler(p, { sinir = 10, n = 6 } = {}) {
  if (p?.lat == null || p?.lng == null) return [];
  const haric = new Set([p.id, ...bloklari(p).map(b => b.id), p.ust_proje_id].filter(Boolean));
  return S.projeler.filter(x => !haric.has(x.id) && !x.ust_proje_id && x.lat != null && x.lng != null && !x.aday && ACIK.includes(x.durum))
    .map(x => ({ p: x, km: km([+p.lat, +p.lng], [+x.lat, +x.lng]) })).filter(x => x.km <= sinir).sort((a, b) => a.km - b.km).slice(0, n);
}
