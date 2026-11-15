// Tahsilat ve vade riski: firma bazında gecikmiş alacak, en uzun gecikme ve geçmişte ne kadar geç ödediği.
// Teklif ve ziyaret penceresinde, firma sayfasında, Bugün'ün planında ve Panel'de uyarı olarak görünür.
// Tutarlar yaklaşık USD'ye çevrilir (Şirket profili → Kur). Veri: Satış → Tahsilat (cari ekstresi yüklenebilir).
import { S } from './db.js';
import { esc, usd, today, byId, fold } from './ui.js';
import { kur } from './kur.js';
import { kalan, gecikme } from './views/tahsilat.js';

const gunFark = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
export function usdYap(v, pb = 'USD') {
  v = +v || 0; if (!v) return 0; pb = pb === 'TL' ? 'TRY' : (pb || 'USD');
  if (pb === 'USD') return v;
  const k = kur(); if (!k?.USD) return 0;
  return pb === 'TRY' ? v / k.USD : k[pb] ? v * k[pb] / k.USD : 0;
}
export const SEVIYE = { yuksek: { ad: 'Yüksek risk', c: '#B91C1C' }, orta: { ad: 'Dikkat', c: '#C2410C' }, gec: { ad: 'Geç öder', c: '#A16207' } };

// Firma için risk özeti (tahsilat kaydı yoksa null)
export function firmaRiski(fid) {
  if (!fid) return null;
  const l = (S.tahsilatlar || []).filter(t => t.firma_id === fid);
  if (!l.length) return null;
  const acikL = l.filter(t => kalan(t) > 0), gecL = acikL.filter(t => gecikme(t) > 0);
  const acik = acikL.reduce((a, t) => a + usdYap(kalan(t), t.para_birimi), 0);
  const gecikmis = gecL.reduce((a, t) => a + usdYap(kalan(t), t.para_birimi), 0);
  const maxGun = Math.max(0, ...gecL.map(gecikme));
  // Geçmiş davranış: kapanmış faturalarda vadeden kaç gün sonra ödedi
  const odenmis = l.filter(t => kalan(t) <= 0 && t.vade && t.odeme_tarihi).map(t => gunFark(t.vade, String(t.odeme_tarihi).slice(0, 10)));
  const ortGec = odenmis.length ? Math.round(odenmis.reduce((a, b) => a + b, 0) / odenmis.length) : null;
  const seviye = gecikmis > 0 && (maxGun >= 60 || gecikmis >= 50000) ? 'yuksek' : gecikmis > 0 && maxGun >= 15 ? 'orta' : ortGec != null && odenmis.length >= 3 && ortGec >= 30 ? 'gec' : null;
  const parca = [gecikmis > 0 ? `${usd(Math.round(gecikmis))} gecikmiş (en uzun ${maxGun} gün)` : '', acik > gecikmis ? `${usd(Math.round(acik - gecikmis))} vadesi gelmemiş` : '', ortGec != null && odenmis.length >= 2 ? `geçmişte ortalama ${ortGec > 0 ? ortGec + ' gün geç' : 'zamanında'} ödüyor` : ''].filter(Boolean);
  return { fid, acik, gecikmis, maxGun, ortGec, odenmisN: odenmis.length, seviye, gecN: gecL.length, metin: parca.join(' · ') };
}

// Riskli firmalar, önem sırasıyla
export function riskListesi() {
  const ids = [...new Set((S.tahsilatlar || []).map(t => t.firma_id).filter(Boolean))];
  const sira = { yuksek: 3, orta: 2, gec: 1 };
  return ids.map(firmaRiski).filter(r => r?.seviye).sort((a, b) => sira[b.seviye] - sira[a.seviye] || b.gecikmis - a.gecikmis || b.maxGun - a.maxGun);
}

export const riskRozeti = fid => { const r = firmaRiski(fid); return r?.seviye ? `<em class="vr-rozet" style="--c:${SEVIYE[r.seviye].c}" title="${esc(r.metin)}">${r.gecikmis > 0 ? usd(Math.round(r.gecikmis)) + ' gecikmiş' : SEVIYE[r.seviye].ad}</em>` : ''; };
export function riskUyarisi(fid, baglam = 'teklif') {
  const r = firmaRiski(fid); if (!r?.seviye) return '';
  const ne = baglam === 'teklif' ? (r.seviye === 'yuksek' ? 'Yeni teklifte vade ve ödeme koşulunu buna göre belirle; gerekirse önce tahsilatı konuş.' : 'Ödeme koşulunu netleştirmekte fayda var.')
    : baglam === 'ziyaret' ? 'Ziyarette tahsilatı da konuş.' : '';
  return `<div class="vr-uyari" style="--c:${SEVIYE[r.seviye].c}" role="note"><b>${SEVIYE[r.seviye].ad}: ${esc(byId('firmalar', fid)?.ad || '')}</b><span>${esc(r.metin)}${ne ? '. ' + esc(ne) : ''}</span><a href="#/tahsilat">Tahsilat →</a></div>`;
}

// Panel kartı
export function riskKarti() {
  const l = riskListesi();
  if (!(S.tahsilatlar || []).length) return '';
  const top = l.reduce((a, r) => a + r.gecikmis, 0);
  return `<section class="card vr-k"><div class="card-h"><h2>Vade riski <span class="muted">${l.length}</span></h2><a class="linkbtn" href="#/tahsilat">Tahsilat</a></div>
    ${l.length ? `<p class="hint">Toplam gecikmiş alacak yaklaşık ${usd(Math.round(top))}.</p><ul class="list vr-l">${l.slice(0, 8).map(r => `<li><span class="vr-n" style="--c:${SEVIYE[r.seviye].c}"></span><a href="#/firma/${r.fid}" class="grow"><b>${esc(byId('firmalar', r.fid)?.ad || '')}</b><small class="muted">${esc(SEVIYE[r.seviye].ad)} · ${esc(r.metin)}</small></a></li>`).join('')}</ul>`
      : '<p class="hint">Gecikmiş alacağı olan ya da düzenli geç ödeyen firma yok.</p>'}</section>`;
}

// Pencerede: firma alanı değiştikçe uyarıyı günceller (firma alanı ad olarak yazılır)
export function riskBagla(panel, baglam, fid0) {
  const kutu = panel.querySelector('[data-vrisk]'); if (!kutu) return;
  const ciz = fid => { kutu.innerHTML = riskUyarisi(fid, baglam); };
  ciz(fid0);
  const inp = panel.querySelector('[name=firma_id]');
  inp?.addEventListener('change', () => { const f = (S.firmalar || []).find(x => fold(x.ad) === fold(inp.value)); ciz(f?.id || null); });
}
