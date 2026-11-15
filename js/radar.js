// Fırsat radarı: kaçmak üzere olan işler tek listede, önem sırasıyla.
//   sessiz   : Sıcak / İhale / Teklif Verildi projede uzun süredir hiçbir hareket yok
//   uzak     : A segmenti ya da key account firmaya ziyaret aralığı geçti
//   karar    : sıcak projede karar verici belirsiz, ulaşılmamış ya da rakipçi
//   teklif   : gönderilmiş teklifin geçerliliği doluyor ya da yeni doldu, cevap yok
// Puan: yaklaşık değer (tutar × olasılık) × aciliyet. Hesap telefonda yapılır.
import { ozellikSay } from './saglik.js';
import { S } from './db.js';
import { app } from './state.js';
import { esc, usd, tarih, today, gunEkle, byId, firmaAd, olasilik, toast, openDrawer } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { kur } from './kur.js';
import { haritaUyarilari } from './satisharitasi.js';
import { gizliBolum } from './yetki.js';

export const TURLER = {
  sessiz: { ad: 'Sessiz sıcak proje', c: '#EA580C' },
  karar: { ad: 'Karar verici belirsiz', c: '#B91C1C' },
  teklif: { ad: 'Teklif süresi doluyor', c: '#7C3AED' },
  uzak: { ad: 'Uzaklaşan önemli müşteri', c: '#2563EB' },
};
const SICAK = ['Sıcak', 'İhale', 'Teklif Verildi'];
const gunFarki = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(String(a).slice(0, 10) + 'T00:00')) / 864e5);
const enGec = (...l) => l.filter(Boolean).map(x => String(x).slice(0, 10)).sort().at(-1) || null;
export const sessizGun = () => +ayar('radar_sessiz', 14) || 14;

// Teklif tutarını yaklaşık USD'ye çevir
function teklifUsd(t) {
  const v = +t.toplam || 0, pb = t.para_birimi || 'USD';
  if (pb === 'USD') return v;
  const k = kur(); if (!k?.USD) return 0;
  if (pb === 'TRY' || pb === 'TL') return v / k.USD;
  return k[pb] ? v * k[pb] / k.USD : 0;
}
const deger = p => Math.max((+p.tutar_usd || 0) * olasilik(p) / 100, 0);

// Projenin son hareketi: ziyaret, teklif, durum değişikliği, görev ya da kayıt güncellemesi
function sonHareketler() {
  const m = new Map(), yaz = (id, d) => { if (id && d && (!m.has(id) || d > m.get(id))) m.set(id, String(d).slice(0, 10)); };
  for (const z of S.ziyaretler || []) if ((z.durum || 'Yapıldı') === 'Yapıldı') yaz(z.proje_id, z.tarih);
  for (const t of S.teklifler || []) yaz(t.proje_id, t.tarih);
  for (const g of S.proje_gecmis || []) yaz(g.proje_id, g.tarih);
  for (const g of S.gorevler || []) yaz(g.proje_id, g.updated_at || g.created_at);
  for (const p of S.projeler || []) yaz(p.id, p.updated_at || p.created_at);
  return m;
}

// Ertelenenler: { anahtar: 'YYYY-AA-GG' } o güne kadar listede görünmez
const ertelenen = () => { const e = ayar('radar_ertele') || {}; const t = today(); return Object.fromEntries(Object.entries(e).filter(([, d]) => d > t)); };
export async function ertele(anahtar, gun = 7) {
  ozellikSay('radar-ertele'); await ayarYaz('radar_ertele', { ...ertelenen(), [anahtar]: gunEkle(today(), gun) }); }

export function radarListesi({ hepsi = false } = {}) {
  const t = today(), son = sonHareketler(), esik = sessizGun(), l = [];
  const projeler = (S.projeler || []).filter(p => !p.aday && SICAK.includes(p.durum));
  // 1) Sessiz sıcak projeler
  for (const p of projeler) {
    const s = son.get(p.id), gun = s ? gunFarki(s, t) : 999;
    if (gun < esik) continue;
    const v = deger(p);
    l.push({ k: 'sessiz:' + p.id, tur: 'sessiz', href: `#/proje/${p.id}`, baslik: p.ad, tutar: p.tutar_usd ?? null,
      alt: [p.durum, s ? `${gun} gündür hareket yok` : 'hiç hareket yok', firmaAd(p.emut_id || p.alici_id)].filter(Boolean).join(' · '),
      puan: Math.max(v, 2000) * (1 + Math.min(gun, 120) / 30), eylem: { tip: 'ziyaret', proje_id: p.id, firma_id: p.emut_id || p.alici_id || p.gemut_id || null } });
  }
  // 2) Karar verici belirsiz (yalnızca sıcak ve teklif aşamasındakiler)
  for (const p of gizliBolum('harita') ? [] : projeler.filter(p => p.durum !== 'İhale' || (p.karar_grubu || []).length)) {
    const u = haritaUyarilari(p).find(x => x.s === 'kirmizi' || /Satış haritası boş/.test(x.m));
    if (!u) continue;
    if (p.durum === 'Teklif Verildi' && /Satış haritası boş/.test(u.m) && deger(p) < 20000) continue;
    l.push({ k: 'karar:' + p.id, tur: 'karar', href: `#/proje/${p.id}/harita`, baslik: p.ad, tutar: p.tutar_usd ?? null,
      alt: /Satış haritası boş/.test(u.m) ? 'karar grubu hiç girilmemiş' : u.m.replace(/\.$/, ''),
      puan: Math.max(deger(p), 2000) * 1.2, eylem: { tip: 'harita', proje_id: p.id } });
  }
  // 3) Teklifin geçerliliği doluyor (7 gün içinde) ya da son 30 günde doldu, cevap yok
  const sonTeklif = new Map();
  for (const x of S.teklifler || []) { const kok = String(x.teklif_no || x.id).replace(/-R\d+$/, ''); const o = sonTeklif.get(kok); if (!o || (x.tarih || '') >= (o.tarih || '')) sonTeklif.set(kok, x); }
  for (const x of sonTeklif.values()) {
    if (x.durum !== 'Gönderildi' || !x.gecerlilik) continue;
    const kalan = gunFarki(t, x.gecerlilik);
    if (kalan > 7 || kalan < -30) continue;
    const p = byId('projeler', x.proje_id), v = teklifUsd(x);
    l.push({ k: 'teklif:' + x.id, tur: 'teklif', href: `#/teklifler`, tid: x.id, baslik: p?.ad || firmaAd(x.firma_id) || x.teklif_no, tutar: v || null,
      alt: [x.teklif_no, firmaAd(x.firma_id), kalan < 0 ? `geçerlilik ${-kalan} gün önce doldu` : kalan === 0 ? 'geçerlilik bugün doluyor' : `geçerlilik ${kalan} gün sonra (${tarih(x.gecerlilik)})`].filter(Boolean).join(' · '),
      puan: Math.max(v * (p ? olasilik(p) / 100 : 0.4), 2000) * (kalan < 0 ? 1.3 : 1.6), eylem: { tip: 'ara', firma_id: x.firma_id, proje_id: x.proje_id } });
  }
  // 4) Uzaklaşan A / key account müşteriler
  const sz = new Map();
  for (const z of S.ziyaretler || []) if ((z.durum || 'Yapıldı') === 'Yapıldı' && z.firma_id && (!sz.has(z.firma_id) || z.tarih > sz.get(z.firma_id))) sz.set(z.firma_id, z.tarih);
  // Firma başına: projesi var mı, açık işlerinin değeri (tek geçişte)
  const projeli = new Set(), acikD = new Map(), ACIK_D = new Set(SICAK.concat('Proje', 'Beklemede'));
  for (const p of S.projeler || []) {
    for (const k of ['emut_id', 'gemut_id', 'alici_id', 'bayi_id']) if (p[k]) projeli.add(p[k]);
    if (ACIK_D.has(p.durum)) { const v = deger(p); for (const id of new Set([p.emut_id, p.gemut_id, p.alici_id, p.bayi_id, p.projeci_id, p.danisman_id].filter(Boolean))) acikD.set(id, (acikD.get(id) || 0) + v); }
  }
  for (const f of (S.firmalar || []).filter(f => f.segment === 'A' || f.key_account)) {
    const s = sz.get(f.id), aralik = f.segment === 'A' ? 30 : +ayar('ziyaret_siklik', 45) || 45, gun = s ? gunFarki(s, t) : null;
    if (gun !== null && gun <= aralik) continue;
    if (gun === null && !projeli.has(f.id)) continue;
    const acikDeger = acikD.get(f.id) || 0;
    l.push({ k: 'uzak:' + f.id, tur: 'uzak', href: `#/firma/${f.id}`, baslik: f.ad, tutar: null,
      alt: [f.segment ? f.segment + ' müşterisi' : 'Key account', gun === null ? 'hiç ziyaret kaydı yok' : `${gun} gündür gidilmedi (aralık ${aralik} gün)`, acikDeger ? `açık işlerin değeri ${usd(acikDeger)}` : ''].filter(Boolean).join(' · '),
      puan: Math.max(acikDeger, 5000) * (1 + Math.min(gun ?? aralik * 2, 365) / aralik / 2), eylem: { tip: 'planla', firma_id: f.id } });
  }
  const e = hepsi ? {} : ertelenen();
  return l.filter(x => !e[x.k]).sort((a, b) => b.puan - a.puan);
}

const EYLEM_AD = { ziyaret: 'Planla', harita: 'Haritaya', ara: 'Planla', planla: 'Planla' };
const satir = x => `<li class="radar-s" data-rk="${esc(x.k)}"><span class="radar-tur" style="--c:${TURLER[x.tur].c}" title="${esc(TURLER[x.tur].ad)}"></span>
  <a href="${x.href}" ${x.tid ? `data-rtid="${esc(x.tid)}"` : ''} class="grow"><b>${esc(x.baslik || '')}</b><span class="muted">${esc(TURLER[x.tur].ad)} · ${esc(x.alt)}</span></a>
  ${x.tutar ? `<b class="num radar-t">${usd(x.tutar)}</b>` : ''}
  <span class="ra"><button type="button" class="btn sm ghost" data-reylem="${esc(x.k)}" data-gerek="${x.eylem.tip === 'harita' ? 'yaz:projeler' : 'yaz:ziyaretler'}">${EYLEM_AD[x.eylem.tip]}</button><button type="button" class="btn sm ghost" data-rertele="${esc(x.k)}" title="7 gün gösterme" aria-label="7 gün ertele">Ertele</button></span></li>`;

// Bugün ve Panel kartı
export function radarKarti({ n = 5, baslik = 'Fırsat radarı' } = {}) {
  const l = radarListesi();
  if (!l.length) return `<section class="card radar-k"><h2>${baslik}</h2><p class="hint">Kaçmak üzere görünen iş yok. Sıcak projeler ${sessizGun()} günden uzun sessiz kalınca, teklif süresi dolarken ya da A müşterisine gidilmeyince burada çıkar.</p></section>`;
  const say = Object.keys(TURLER).map(k => [k, l.filter(x => x.tur === k).length]).filter(([, v]) => v);
  return `<section class="card wide radar-k"><div class="card-h"><h2>${baslik} <span class="muted">${l.length}</span></h2><button type="button" class="linkbtn" data-radartum>Tümü</button></div>
    <p class="radar-say">${say.map(([k, v]) => `<span style="--c:${TURLER[k].c}"><b>${v}</b> ${esc(TURLER[k].ad.toLowerCase())}</span>`).join('')}</p>
    <ul class="list radar-l">${l.slice(0, n).map(satir).join('')}</ul></section>`;
}

async function eylemYap(x) {
  ozellikSay('radar');
  const { ziyaretForm } = await import('./views/ziyaret.js');
  const e = x.eylem;
  if (e.tip === 'harita') { location.hash = x.href; return; }
  ziyaretForm({ firma_id: e.firma_id || null, proje_id: e.proje_id || null, durum: 'Planlandı', tarih: gunEkle(today(), 1), amac: e.tip === 'ara' ? 'Teklif takibi' : undefined });
}

export function radarBagla(kok, yenile) {
  const bul = k => radarListesi({ hepsi: true }).find(x => x.k === k);
  kok.querySelectorAll('[data-reylem]').forEach(b => b.onclick = () => { const x = bul(b.dataset.reylem); if (x) eylemYap(x); });
  kok.querySelectorAll('[data-rertele]').forEach(b => b.onclick = async () => { try { await ertele(b.dataset.rertele); toast('7 gün boyunca radarda gösterilmeyecek.'); yenile?.(); } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); } });
  kok.querySelectorAll('[data-rtid]').forEach(a => a.onclick = async ev => { ev.preventDefault(); const { teklifForm } = await import('./views/teklif.js'); teklifForm(byId('teklifler', a.dataset.rtid)); });
  kok.querySelector('[data-radartum]')?.addEventListener('click', () => radarPenceresi(yenile));
}

export function radarPenceresi(yenile) {
  let tur = 'hepsi';
  const p = openDrawer(`<header class="dh"><div><p class="muted">Kaçmak üzere olan işler</p><h2 id="drawer-title">Fırsat radarı</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><div class="seg" role="group" aria-label="Tür"><button type="button" data-rt="hepsi" class="on">Hepsi</button>${Object.entries(TURLER).map(([k, v]) => `<button type="button" data-rt="${k}">${esc(v.ad)}</button>`).join('')}</div>
    <div data-rl></div>
    <details class="radar-ayar"><summary>Ayarlar</summary><label class="fld">Sıcak proje kaç gün sessiz kalınca çıksın<input type="number" min="3" max="90" value="${sessizGun()}" data-resik inputmode="numeric"></label>
      <p class="hint">Sırayı projenin tutarı, olasılığı ve ne kadar süredir sessiz kaldığı belirler. Ertelediklerin 7 gün sonra yeniden görünür.</p>
      <button type="button" class="btn sm ghost" data-rsifirla>Ertelenenleri geri getir</button></details></div>`, { onClose: () => yenile?.() });
  const ciz = () => {
    const l = radarListesi().filter(x => tur === 'hepsi' || x.tur === tur);
    p.querySelector('[data-rl]').innerHTML = l.length ? `<ul class="list radar-l">${l.map(satir).join('')}</ul>` : '<p class="hint">Bu türde kayıt yok.</p>';
    radarBagla(p, ciz);
  };
  p.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { tur = b.dataset.rt; p.querySelectorAll('[data-rt]').forEach(x => x.classList.toggle('on', x === b)); ciz(); });
  p.querySelector('[data-resik]').onchange = async e => { await ayarYaz('radar_sessiz', Math.max(3, Math.min(90, +e.target.value || 14))); ciz(); };
  p.querySelector('[data-rsifirla]').onclick = async () => { await ayarYaz('radar_ertele', null); ciz(); };
  ciz();
}
