// Hedefe kalan: bu çeyreğin hedefine ne kadar kaldı, kalan haftalarda haftada ne kadar sipariş gerekiyor,
// ve bunu karşılayabilecek sıcak projeler (olasılık ve beklenen tarihe göre sıralı, kalanı kapatana kadar).
import { S } from './db.js';
import { esc, usd, num, tarih, today, ACIK, olasilik, pill } from './ui.js';
import { ceyrekGercek, ceyrekOf } from './ceyrek.js';

export function hedefDurumu(t = today()) {
  const Y = +t.slice(0, 4), c = ceyrekOf(t);
  const g = ceyrekGercek(Y, c);
  const bitis = new Date(Y, c * 3, 0); const bitisIso = `${Y}-${String(c * 3).padStart(2, '0')}-${String(bitis.getDate()).padStart(2, '0')}`;
  const gunKalan = Math.max(0, Math.round((bitis - new Date(t + 'T00:00')) / 864e5) + 1);
  const hafta = Math.max(1, Math.ceil(gunKalan / 7));
  const kalan = Math.max(0, g.hedef - g.gercek);
  // Aday projeler: açık, tutarı belli; bu çeyrek içinde beklenen ya da Sıcak aşamada olanlar önce
  const adaylar = S.projeler.filter(p => ACIK.includes(p.durum) && !p.aday && +p.tutar_usd > 0).map(p => {
    const d = p.beklenen_tarih || p.alim_tarihi || '';
    const bu = d && d <= bitisIso && d >= `${Y}-01-01`;
    const ol = olasilik(p);
    return { p, d, bu, ol, beklenen: +p.tutar_usd * ol / 100, puan: (bu ? 2 : 0) + (p.durum === 'Sıcak' ? 1.5 : 0) + ol / 100 };
  }).filter(x => x.bu || x.p.durum === 'Sıcak' || x.ol >= 50).sort((a, b) => b.puan - a.puan || b.beklenen - a.beklenen);
  let top = 0; const liste = [];
  for (const x of adaylar) { if (top >= kalan * 1.2 && liste.length >= 3) break; liste.push(x); top += +x.p.tutar_usd; if (liste.length >= 12) break; }
  const beklenenToplam = liste.reduce((a, x) => a + x.beklenen, 0);
  return { Y, c, g, kalan, gunKalan, hafta, haftalik: kalan / hafta, bitisIso, liste, top, beklenenToplam };
}

export function hedefKalanKarti(t) {
  const h = hedefDurumu(t);
  if (!h.g.hedef) return `<section class="card wide hedef-k"><h2>${h.c}. çeyrek hedefi</h2><p class="hint">Bu çeyrek için hedef girilmemiş. Hedefi girersen burada kalan tutar, haftalık ihtiyaç ve onu karşılayabilecek projeler görünür.</p><div class="btnrow"><button type="button" class="btn sm" data-hedefgir data-gerek="yaz:hedefler">Çeyrek hedeflerini gir</button></div></section>`;
  const yuzde = Math.min(100, h.g.gercek / h.g.hedef * 100);
  const tamam = h.kalan <= 0;
  return `<section class="card wide hedef-k"><h2>${h.c}. çeyrek hedefine ${tamam ? 'ulaşıldı' : 'kalan'}</h2>
    <div class="hk-ust"><div><b class="hk-buyuk ${tamam ? 'pos' : ''}">${tamam ? usd(h.g.gercek - h.g.hedef) + ' fazla' : usd(h.kalan)}</b><small>hedef ${usd(h.g.hedef)} · gerçekleşen ${usd(h.g.gercek)} (%${num(Math.round(yuzde))})</small></div>
      ${tamam ? '' : `<div><b class="hk-buyuk">${usd(h.haftalik)}</b><small>haftada sipariş gerekiyor · ${h.gunKalan} gün (${h.hafta} hafta) kaldı</small></div>`}</div>
    <div class="hk-cubuk" role="img" aria-label="Hedefin yüzde ${Math.round(yuzde)} kadarı gerçekleşti"><span style="width:${yuzde}%"></span></div>
    ${tamam ? '' : h.liste.length ? `<h3>Bunu karşılayabilecek projeler</h3>
      <ul class="list">${h.liste.map(x => `<li><a href="#/proje/${x.p.id}"><b>${esc(x.p.ad)}</b><span class="muted">${usd(x.p.tutar_usd)} · olasılık %${x.ol}${x.d ? ' · beklenen ' + tarih(x.d) : ' · tarih yok'}${x.bu ? '' : ' · çeyrek dışı'}</span></a>${pill(x.p.durum)}</li>`).join('')}</ul>
      <p class="hint">Bu ${h.liste.length} projenin toplamı ${usd(h.top)}; olasılıkla ağırlıklı beklenen ${usd(h.beklenenToplam)}${h.beklenenToplam < h.kalan ? ` — kalanı karşılamak için <b>${usd(h.kalan - h.beklenenToplam)}</b> daha gerekiyor; yeni teklif ve sıcak proje lazım.` : ' — kalanı karşılayabilir.'}</p>`
      : '<p class="hint">Bu çeyrekte beklenen ya da sıcak aşamada açık proje yok. Projelere beklenen sipariş tarihi ve olasılık girersen burada sıralanır.</p>'}
  </section>`;
}
