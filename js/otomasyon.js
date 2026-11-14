// Faz 1: yinelenen görevler ve otomasyon.
// (1) Tekrar: tekrarlanan görev "Tamam" olunca bir sonraki kendiliğinden açılır (aynı başlık, firma, proje, kişi, atanan).
// (2) Kurallar: proje aşaması değişince ya da bir tarih yaklaşınca görev açılır. Kurallar şirket ayarıdır ("otomasyon");
//     her otomatik görevin "kaynak" anahtarı vardır (ör. oto:teklif_sure:<id>), aynı görev ikinci kez açılmaz.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, today, gunEkle, byId, firmaAd } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

export const TEKRARLAR = [{ v: 'gun', l: 'Her iş günü' }, { v: 'hafta', l: 'Her hafta' }, { v: '2hafta', l: '2 haftada bir' }, { v: 'ay', l: 'Her ay' }, { v: '3ay', l: '3 ayda bir' }, { v: 'yil', l: 'Her yıl' }];
export const tekrarAd = v => TEKRARLAR.find(t => t.v === v)?.l || '';

const ayEkle = (s, n) => { const [y, m, g] = s.split('-').map(Number); const hedef = new Date(y, m - 1 + n, 1), son = new Date(hedef.getFullYear(), hedef.getMonth() + 1, 0).getDate(); return `${hedef.getFullYear()}-${String(hedef.getMonth() + 1).padStart(2, '0')}-${String(Math.min(g, son)).padStart(2, '0')}`; };
export function sonrakiTarih(t, tekrar) {
  const bas = t || today();
  if (tekrar === 'gun') { let d = gunEkle(bas, 1); while ([0, 6].includes(new Date(d + 'T00:00').getDay())) d = gunEkle(d, 1); return d; }
  if (tekrar === 'hafta') return gunEkle(bas, 7);
  if (tekrar === '2hafta') return gunEkle(bas, 14);
  if (tekrar === 'ay') return ayEkle(bas, 1);
  if (tekrar === '3ay') return ayEkle(bas, 3);
  if (tekrar === 'yil') return ayEkle(bas, 12);
  return null;
}

// Görev kaydedildikten sonra: tekrarlanan görev tamamlandıysa sonrakini aç
export async function gorevSonrasi(eski, yeni) {
  if (!yeni?.tekrar || yeni.durum !== 'Tamam' || eski?.durum === 'Tamam') return;
  const kok = yeni.kaynak?.startsWith('tekrar:') ? yeni.kaynak : 'tekrar:' + yeni.id;
  // Geçmişte kalmış bir tarihten tamamlandıysa bir sonraki gelecekte olsun
  let t = sonrakiTarih(yeni.son_tarih || today(), yeni.tekrar); for (let i = 0; t && t < today() && i < 400; i++) t = sonrakiTarih(t, yeni.tekrar);
  if (!t || S.gorevler.some(g => g.kaynak === kok && g.durum !== 'Tamam' && g.id !== yeni.id)) return;
  const { id, tamamlayan, created_at, updated_at, ...kopya } = yeni;
  try {
    await app.db.save('gorevler', { ...kopya, id: uuid(), durum: 'Açık', son_tarih: t, kaynak: kok });
    toast(`Tekrarlanan görev: bir sonraki ${new Date(t + 'T00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}.`);
  } catch (e) { toast('Sonraki görev açılamadı: ' + e.message, 'err'); }
}

// ---------- Kurallar ----------
export const KURALLAR = [
  { k: 'teklif_takip', ad: 'Teklif verilince takip görevi', ac: 'Proje aşaması "Teklif Verildi" olunca, seçilen gün sonra "Teklifi takip et" görevi açılır.', gun: 3, metin: p => `Teklifi takip et: ${p.ad}` },
  { k: 'sicak_ziyaret', ad: 'Sıcak projede ziyaret görevi', ac: 'Proje "Sıcak" olunca karar vericiyi görmek için görev açılır.', gun: 2, metin: p => `Karar vericiyle görüş: ${p.ad}` },
  { k: 'siparis_sonrasi', ad: 'Siparişten sonra teslimat takibi', ac: 'Proje "Sipariş" olunca teslimat ve montajı takip etme görevi açılır.', gun: 14, metin: p => `Teslimat ve montajı takip et: ${p.ad}` },
  { k: 'teklif_sure', ad: 'Teklif süresi dolmadan hatırlat', ac: 'Gönderilmiş teklifin geçerliliği bitmeden seçilen gün kala görev açılır.', gun: 2, tarama: true },
  { k: 'numune_iade', ad: 'Numune iade günü', ac: 'Müşterideki numunenin iade tarihi gelince "Numuneyi geri al" görevi açılır.', gun: 0, tarama: true },
  { k: 'tahsilat_vade', ad: 'Vadesi geçen fatura', ac: 'Açık faturanın vadesi seçilen gün geçince tahsilat görevi açılır.', gun: 1, tarama: true },
];
export function kurallar() {
  const a = ayar('otomasyon', null) || {};
  return KURALLAR.map(r => ({ ...r, acik: a[r.k]?.acik ?? true, gun: a[r.k]?.gun ?? r.gun }));
}
const yazabilir = () => app.db && !app.db.onizleme && !app.db.yazamaz?.('gorevler');
// Silinen otomatik görevler bir daha açılmasın: anahtarları bu cihazda ve (yöneticiyse) şirket ayarında tutulur
const silinenler = () => { let l = []; try { l = JSON.parse(localStorage.getItem('oto-silinen') || '[]'); } catch {} return new Set([...l, ...(ayar('oto_silinen', null) || [])]); };
export async function otoGorevSilindi(g) {
  if (!g?.kaynak?.startsWith('oto:')) return;
  try { const l = [...silinenler(), g.kaynak].slice(-500); localStorage.setItem('oto-silinen', JSON.stringify(l)); } catch {}
  try { const { sahipMi } = await import('./yetki.js'); if (sahipMi()) await ayarYaz('oto_silinen', [...new Set([...(ayar('oto_silinen', null) || []), g.kaynak])].slice(-500)); } catch {}
}
const varMi = kaynak => S.gorevler.some(g => g.kaynak === kaynak) || silinenler().has(kaynak);
async function ac(kaynak, g) {
  if (varMi(kaynak)) return false;
  await app.db.save('gorevler', { id: uuid(), durum: 'Açık', oncelik: 'Normal', ...g, kaynak });
  return true;
}

// Proje aşaması değişince (aşama şeridi ya da proje formu)
export async function projeAsamasi(p, eski, yeni) {
  if (!yazabilir() || !p || eski === yeni) return;
  const harita = { 'Teklif Verildi': 'teklif_takip', 'Sıcak': 'sicak_ziyaret', 'Sipariş': 'siparis_sonrasi' };
  const r = kurallar().find(x => x.k === harita[yeni]); if (!r?.acik) return;
  try {
    const firma = p.emut_id || p.alici_id || p.bayi_id || null;
    if (await ac(`oto:${r.k}:${p.id}`, { baslik: r.metin(p), son_tarih: gunEkle(today(), r.gun), proje_id: p.id, firma_id: firma, kisi_id: p.ilgili_kisi_id || null, oncelik: yeni === 'Sıcak' ? 'Yüksek' : 'Normal' }))
      toast(`Otomatik görev açıldı: ${r.metin(p)}`);
  } catch (e) { console.warn('otomasyon', e); }
}

// Tarih kuralları: açılışta günde bir kez taranır
export async function otomasyonTara({ zorla = false } = {}) {
  if (!yazabilir()) return 0;
  const anahtar = 'oto-tarama:' + (app.db.sahip || ''), t = today();
  try { if (!zorla && localStorage.getItem(anahtar) === t) return 0; localStorage.setItem(anahtar, t); } catch {}
  const R = Object.fromEntries(kurallar().map(r => [r.k, r]));
  let n = 0;
  try {
    if (R.teklif_sure.acik) for (const x of S.teklifler || []) {
      if (!x.gecerlilik || x.durum !== 'Gönderildi') continue;
      if (gunEkle(x.gecerlilik, -R.teklif_sure.gun) <= t && x.gecerlilik >= gunEkle(t, -1))
        n += await ac(`oto:teklif_sure:${x.id}`, { baslik: `Teklif süresi doluyor: ${x.teklif_no || 'teklif'}${x.firma_id ? ' (' + firmaAd(x.firma_id) + ')' : ''}`, son_tarih: x.gecerlilik, firma_id: x.firma_id || null, proje_id: x.proje_id || null, kisi_id: x.kisi_id || null, oncelik: 'Yüksek' }) ? 1 : 0;
    }
    if (R.numune_iade.acik) for (const x of S.numuneler || []) {
      if (!x.iade_tarihi || (x.durum && x.durum !== 'Müşteride')) continue;
      if (gunEkle(x.iade_tarihi, -R.numune_iade.gun) <= t)
        n += await ac(`oto:numune_iade:${x.id}`, { baslik: `Numuneyi geri al: ${[x.urun_kod, x.urun_ad].filter(Boolean).join(' · ') || 'numune'}${x.firma_id ? ' (' + firmaAd(x.firma_id) + ')' : ''}`, son_tarih: x.iade_tarihi < t ? t : x.iade_tarihi, firma_id: x.firma_id || null, proje_id: x.proje_id || null, kisi_id: x.kisi_id || null }) ? 1 : 0;
    }
    if (R.tahsilat_vade.acik) for (const x of S.tahsilatlar || []) {
      if (!x.vade || (+x.tutar || 0) <= (+x.odenen || 0)) continue;
      if (gunEkle(x.vade, R.tahsilat_vade.gun) <= t)
        n += await ac(`oto:tahsilat_vade:${x.id}`, { baslik: `Tahsilat: ${firmaAd(x.firma_id) || x.cari || 'cari'}${x.belge_no ? ' · fatura ' + x.belge_no : ''}`, son_tarih: t, firma_id: x.firma_id || null, oncelik: 'Yüksek' }) ? 1 : 0;
    }
  } catch (e) { console.warn('otomasyon tarama', e); }
  if (n) toast(`${n} otomatik görev açıldı (Bugün → Görevler).`);
  return n;
}

// Ayar ekranı (Şirket profili → Otomasyonlar)
export function otomasyonAyarlari(kok, { yetkili = true } = {}) {
  const ciz = () => {
    kok.innerHTML = `<p class="hint">Açık kurallar görevleri kendiliğinden açar; aynı kayıt için görev bir kez açılır. Görevi tamamlayınca ya da silince tekrar açılmaz. Kurallar ekipteki herkes için geçerlidir.</p>
      <ul class="list oto-liste">${kurallar().map(r => `<li><label class="chk grow"><input type="checkbox" data-oto="${r.k}" ${r.acik ? 'checked' : ''} ${yetkili ? '' : 'disabled'}><span><b>${esc(r.ad)}</b><small class="muted">${esc(r.ac)}</small></span></label>
        <label class="oto-gun">${r.k === 'numune_iade' ? 'kaç gün önce' : r.k === 'tahsilat_vade' ? 'vadeden kaç gün sonra' : r.tarama ? 'kaç gün kala' : 'kaç gün sonra'}<input type="number" min="0" max="90" data-otogun="${r.k}" value="${r.gun}" ${yetkili ? '' : 'disabled'}></label></li>`).join('')}</ul>
      <div class="btnrow"><button type="button" class="btn sm ghost" data-ototara>Şimdi tara</button></div>
      <p class="hint">Tekrarlanan görev için görev penceresinde "Tekrar" seç (ör. her ay cari ekstresi iste). Tamamlayınca bir sonraki kendiliğinden açılır.</p>`;
    const kaydet = async () => { const o = {}; for (const r of KURALLAR) o[r.k] = { acik: kok.querySelector(`[data-oto="${r.k}"]`).checked, gun: Math.max(0, +kok.querySelector(`[data-otogun="${r.k}"]`).value || 0) }; await ayarYaz('otomasyon', o); toast('Kaydedildi.'); };
    kok.querySelectorAll('[data-oto], [data-otogun]').forEach(i => i.onchange = kaydet);
    kok.querySelector('[data-ototara]').onclick = async () => { const n = await otomasyonTara({ zorla: true }); if (!n) toast('Açılacak yeni görev yok.'); app.refresh?.(); };
  };
  ciz();
}
