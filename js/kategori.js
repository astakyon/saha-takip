// Ürün kategorisi (etanj, yüksek tavan, projektör, spot…): kalemin "kategori" alanı. Kategoriler ve tanıma sözcükleri şirkete göre düzenlenir;
// ürün adındaki sözcüklerden kategori önerilir ("Kategorileri doldur"). Varsayılan liste aydınlatma için; başka sektörde liste değiştirilir.
import { S } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, openDrawer } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

export const VARSAYILAN_KATEGORI = [
  { ad: 'Etanj', soz: ['etanj', 'damp proof', 'tri-proof', 'triproof', 'su gecirmez armatur'] },
  { ad: 'Yüksek tavan', soz: ['highbay', 'high bay', 'yuksek tavan', 'hbl', 'ufo'] },
  { ad: 'Projektör', soz: ['floodlight', 'projektor', 'projector', 'flood'] },
  { ad: 'Ray spot', soz: ['track', 'ray spot', 'ray'] },
  { ad: 'Spot', soz: ['spot', 'downlight', 'gomme spot'] },
  { ad: 'Panel', soz: ['panel', '60x60', '30x120', 'backlit'] },
  { ad: 'Acil aydınlatma', soz: ['emergency', 'acil', 'exit', 'emg'] },
  { ad: 'Sokak / yol', soz: ['street', 'road', 'sokak', 'yol armaturu'] },
  { ad: 'Lineer', soz: ['lineer', 'linear', 'line'] },
  { ad: 'Sıva üstü armatür', soz: ['surf. mount', 'surface mount', 'sivaustu', 'siva ustu'] },
  { ad: 'Aplik', soz: ['aplik', 'wall', 'duvar'] },
  { ad: 'Şerit LED', soz: ['serit', 'strip', 'led tape'] },
  { ad: 'Ampul / tüp', soz: ['ampul', 'bulb', 'lamp', 'tup', 't8', 'tube'] },
  { ad: 'Sürücü / aksesuar', soz: ['surucu', 'driver', 'aski', 'kablo', 'konnektor', 'aksesuar'] },
];
export const kategoriler = () => { const l = ayar('stok_kategorileri', null); return Array.isArray(l) && l.length ? l : VARSAYILAN_KATEGORI; };
export const kategoriAdlari = () => [...new Set([...kategoriler().map(k => k.ad), ...(S.bayi_stok || []).map(s => s.kategori).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'tr'));
const kelimeVar = (metin, s) => new RegExp(`(^|[^a-z0-9])${fold(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')}([^a-z0-9]|$)`).test(metin);
// Önce aynı koddaki başka kalemin kategorisi, sonra ürün adındaki sözcük (listede üstteki kategori önce gelir)
export function kategoriTahmin(s) {
  const baska = (S.bayi_stok || []).find(x => x !== s && x.id !== s.id && x.kod === s.kod && x.kategori); if (baska) return baska.kategori;
  const m = fold([s.aciklama, s.uretici_aciklama, s.detay].filter(Boolean).join(' ')); if (!m) return null;
  return kategoriler().find(k => (k.soz || []).some(x => x && kelimeVar(m, x)))?.ad || null;
}
export async function kategorileriDoldur(firma_id, { ustune = false } = {}) {
  const l = (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && (ustune || !s.kategori)).map(s => [s, kategoriTahmin(s)]).filter(([s, k]) => k && k !== s.kategori);
  if (l.length) await app.db.bulk('bayi_stok', l.map(([s, k]) => ({ ...s, kategori: k })));
  return { yazilan: l.length, bos: (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && !s.kategori).length };
}
export function kategoriPenceresi({ firma_id, sonra } = {}) {
  const p = openDrawer('<div class="dbody"></div>', { onClose: () => sonra?.() });
  const ciz = () => {
    const l = kategoriler(), say = ad => (S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && s.kategori === ad).length;
    p.innerHTML = `<header class="dh"><div><p class="muted">Stoklar</p><h2 id="drawer-title">Ürün kategorileri</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><p class="hint">Her satır bir kategori: önce adı, iki noktadan sonra ürün adında aranacak sözcükler (virgülle). Üstteki kategori önce denenir. “Boş olanları doldur” ürün adına göre kategori yazar; kalem kartından elle de seçilir.</p>
      <textarea data-katmetin rows="12">${esc(l.map(k => `${k.ad}: ${(k.soz || []).join(', ')}`).join('\n'))}</textarea>
      <div class="btnrow"><button type="button" class="btn" data-katkaydet>Listeyi kaydet</button><button type="button" class="btn ghost" data-katvars>Varsayılana dön</button></div>
      <h3>Bu bayide</h3><ul class="list">${kategoriAdlari().map(ad => `<li><span>${esc(ad)}</span><b class="num">${say(ad)}</b></li>`).join('')}<li><span class="muted">Kategorisiz</span><b class="num">${(S.bayi_stok || []).filter(s => (!firma_id || s.firma_id === firma_id) && !s.kategori).length}</b></li></ul>
      <div class="btnrow"><button type="button" class="btn primary" data-katdoldur>Boş olanları doldur</button><button type="button" class="btn ghost" data-katyeniden>Hepsini yeniden hesapla</button></div></div>`;
    p.querySelector('[data-katkaydet]').onclick = async () => { const yeni = p.querySelector('[data-katmetin]').value.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const [ad, ...r] = x.split(':'); return { ad: ad.trim(), soz: r.join(':').split(',').map(t => fold(t.trim())).filter(Boolean) }; }).filter(k => k.ad);
      if (!yeni.length) return toast('En az bir kategori yaz.', 'err'); await ayarYaz('stok_kategorileri', yeni); toast(`${yeni.length} kategori kaydedildi.`); ciz(); };
    p.querySelector('[data-katvars]').onclick = async () => { await ayarYaz('stok_kategorileri', null); toast('Varsayılan liste geri geldi.'); ciz(); };
    const doldur = async ustune => { const r = await kategorileriDoldur(firma_id, { ustune }); toast(r.yazilan ? `${r.yazilan} kaleme kategori yazıldı${r.bos ? `; ${r.bos} kalem kategorisiz kaldı` : ''}.` : 'Yazılacak kategori bulunamadı.'); ciz(); };
    p.querySelector('[data-katdoldur]').onclick = () => doldur(false);
    p.querySelector('[data-katyeniden]').onclick = () => { if (window.confirm('Elle seçilenler dahil bütün kategoriler ürün adına göre yeniden yazılsın mı?')) doldur(true); };
  };
  ciz();
}
