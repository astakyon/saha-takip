// Tekrarlayan ziyaret kuralı: firma kartında "2 haftada bir" gibi; haftalık plan açılınca vadesi gelen ziyaretler kendiliğinden planlanır.
// Bir kez eklenip plandan çıkarılan ziyaret aynı hafta için yeniden eklenmez (bu cihazda hatırlanır).
import { S } from './db.js';
import { app } from './state.js';
import { today, gunEkle } from './ui.js';

export const TEKRAR_SECENEK = [{ v: '7', l: 'Her hafta' }, { v: '14', l: '2 haftada bir' }, { v: '21', l: '3 haftada bir' }, { v: '30', l: 'Ayda bir' }, { v: '60', l: '2 ayda bir' }, { v: '90', l: '3 ayda bir' }];
export const HAFTA_GUNU = [{ v: '1', l: 'Pazartesi' }, { v: '2', l: 'Salı' }, { v: '3', l: 'Çarşamba' }, { v: '4', l: 'Perşembe' }, { v: '5', l: 'Cuma' }];
export const tekrarAd = g => TEKRAR_SECENEK.find(x => +x.v === +g)?.l || (g ? `${g} günde bir` : '');
const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const benim = f => !f.sorumlu || !ben() || f.sorumlu.toLowerCase() === ben();
const hg = d => ((new Date(d + 'T00:00').getDay() + 6) % 7) + 1;   // 1 = Pazartesi

// Bu hafta (bas..son) için vadesi gelen kural ziyaretleri: [{ f, gun, son }]
export function tekrarVadeleri(bas, son, { hepsi = false } = {}) {
  const t = today(), out = [];
  for (const f of S.firmalar || []) {
    const n = +f.tekrar_gun; if (!n || (!hepsi && !benim(f))) continue;
    const z = (S.ziyaretler || []).filter(x => x.firma_id === f.id && x.durum !== 'Yapılmadı');
    if (z.some(x => x.tarih >= bas && x.tarih <= son)) continue;   // bu hafta zaten var
    const sonZ = z.filter(x => x.tarih < bas).map(x => x.tarih).sort().at(-1);
    const vade = sonZ ? gunEkle(sonZ, n) : bas;
    if (vade > son) continue;
    // Gün: tercih edilen hafta günü, yoksa vade günü; geçmişe düşmesin, hafta içinde kalsın
    let gun = f.tekrar_haftagun ? gunEkle(bas, +f.tekrar_haftagun - 1) : (vade < bas ? bas : vade);
    if (gun < t) gun = t;
    if (gun > son || hg(gun) > 5) { gun = null; for (let d = t > bas ? t : bas; d <= son; d = gunEkle(d, 1)) if (hg(d) <= 5) { gun = d; break; } }
    if (gun) out.push({ f, gun, son: sonZ || null });
  }
  return out;
}
const anahtar = (fid, bas) => `tekrar:${fid}:${bas}`;
export async function tekrarDoldur(bas, son) {
  const l = tekrarVadeleri(bas, son).filter(x => { try { return !localStorage.getItem(anahtar(x.f.id, bas)); } catch { return true; } });
  let n = 0;
  for (const x of l) {
    try { await app.db.save('ziyaretler', { firma_id: x.f.id, tarih: x.gun, durum: 'Planlandı', amac: 'Rutin ziyaret', notlar: `Tekrarlayan ziyaret (${tekrarAd(x.f.tekrar_gun)})`, fotolar: [] }); n++; try { localStorage.setItem(anahtar(x.f.id, bas), '1'); } catch {} }
    catch { break; }
  }
  return n;
}
