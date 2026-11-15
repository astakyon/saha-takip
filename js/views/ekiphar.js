// Ekip haritası ve canlı akış (yönetici için): seçilen gün kim nerede giriş yaptı, kim şu an içeride,
// saat sırasıyla olanlar (giriş, çıkış, ziyaret, teklif, tamamlanan görev) ve kişi başına özet.
// Konum yalnızca giriş-çıkış anında alınmış konumdur; sürekli takip yoktur. Görünen veri kişinin yetki kapsamıyla sınırlıdır.
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, tarih, today, gunEkle, firmaAd, byId, usd } from '../ui.js';
import { zDurum } from './ziyaret.js';
import { ziyaretYeri } from './bugun.js';
import { sureDk, sureYaz } from '../giriscikis.js';
import { km } from '../geo.js';

const RENK = ['#2563EB', '#EA580C', '#15803D', '#7C3AED', '#B91C1C', '#0F766E', '#A16207', '#DB2777', '#4F46E5', '#65A30D'];
const benEposta = () => (app.db?.user?.()?.email || '').toLowerCase();
const kisiOf = r => (r.sorumlu || r.tamamlayan || benEposta() || 'ben').toLowerCase();
const adOf = e => e === benEposta() ? 'Sen' : (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === e)?.ad || e.split('@')[0];
const saat = d => new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const gunAd = d => new Date(d + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

// Seçilen günün verisi
export function gunVerisi(gun) {
  const z = (S.ziyaretler || []).filter(x => x.tarih === gun);
  const tek = (S.teklifler || []).filter(x => x.tarih === gun);
  const gor = (S.gorevler || []).filter(x => x.durum === 'Tamam' && String(x.updated_at || '').slice(0, 10) === gun);
  const kisiler = [...new Set([...z, ...tek].map(kisiOf).concat(gor.map(g => (g.tamamlayan || g.sorumlu || benEposta()).toLowerCase())))].filter(Boolean);
  const renk = Object.fromEntries(kisiler.map((k, i) => [k, RENK[i % RENK.length]]));
  // Akış
  const ak = [];
  for (const x of z) {
    const kim = kisiOf(x), f = firmaAd(x.firma_id) || 'Ziyaret';
    if (x.giris) ak.push({ t: x.giris, kim, tur: 'giris', m: `${f} · giriş${x.giris_mesafe != null ? ` (firmaya ${x.giris_mesafe < 1000 ? Math.round(x.giris_mesafe) + ' m' : (x.giris_mesafe / 1000).toFixed(1).replace('.', ',') + ' km'})` : ''}`, zid: x.id });
    if (x.cikis) ak.push({ t: x.cikis, kim, tur: 'cikis', m: `${f} · çıkış (${sureYaz(sureDk(x))})${x.sonuc_tipi ? ' · ' + x.sonuc_tipi : ''}`, zid: x.id });
    if (!x.giris && zDurum(x) === 'Yapıldı') ak.push({ t: x.saat ? `${gun}T${x.saat}` : (x.created_at || gun + 'T12:00'), kim, tur: 'ziyaret', m: `${f} · ziyaret${x.sonuc_tipi ? ' · ' + x.sonuc_tipi : ''}`, zid: x.id });
  }
  for (const x of tek) ak.push({ t: x.created_at && String(x.created_at).slice(0, 10) === gun ? x.created_at : gun + 'T12:00', kim: kisiOf(x), tur: 'teklif', m: `Teklif ${x.teklif_no || ''} · ${firmaAd(x.firma_id) || byId('projeler', x.proje_id)?.ad || ''}${x.toplam != null && (x.para_birimi || 'USD') === 'USD' ? ' · ' + usd(x.toplam) : ''}` });
  for (const g of gor) ak.push({ t: g.updated_at, kim: (g.tamamlayan || g.sorumlu || benEposta()).toLowerCase(), tur: 'gorev', m: `Görev tamamlandı · ${g.baslik}` });
  ak.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  // Kişi özeti
  const ozet = kisiler.map(k => {
    const zk = z.filter(x => kisiOf(x) === k), yap = zk.filter(x => zDurum(x) === 'Yapıldı'), plan = zk.filter(x => zDurum(x) === 'Planlandı');
    const icerde = zk.filter(x => x.giris && !x.cikis), dk = zk.reduce((a, x) => a + (sureDk(x) || 0), 0);
    const pts = yap.slice().sort((a, b) => String(a.giris || a.saat || a.created_at).localeCompare(String(b.giris || b.saat || b.created_at))).map(ziyaretYeri).filter(Boolean);
    let yol = 0; for (let i = 1; i < pts.length; i++) yol += km(pts[i - 1], pts[i]);
    const ilk = zk.map(x => x.giris).filter(Boolean).sort()[0], son = zk.map(x => x.cikis || x.giris).filter(Boolean).sort().at(-1);
    return { k, ad: adOf(k), renk: renk[k], yap: yap.length, plan: plan.length, icerde: icerde[0] || null, dk, km: Math.round(yol * 1.3), teklif: tek.filter(x => kisiOf(x) === k).length, gorev: gor.filter(g => (g.tamamlayan || g.sorumlu || benEposta()).toLowerCase() === k).length, ilk, son };
  }).sort((a, b) => (b.icerde ? 1 : 0) - (a.icerde ? 1 : 0) || b.yap - a.yap);
  // Harita noktaları
  const nokta = z.filter(x => zDurum(x) === 'Yapıldı' || x.giris).map(x => ({ x, p: x.lat != null ? [x.lat, x.lng] : ziyaretYeri(x), kim: kisiOf(x) })).filter(n => n.p);
  return { z, tek, gor, ak, ozet, nokta, renk };
}

let harita = null;
export function ekipharView(el) {
  const f = F('ekiphar', { gun: today(), kisi: 'Tümü' });
  if (f.gun > today()) f.gun = today();
  const d = gunVerisi(f.gun), bugunMu = f.gun === today();
  const kisiSec = f.kisi !== 'Tümü' && d.ozet.some(o => o.k === f.kisi) ? f.kisi : 'Tümü';
  const ak = d.ak.filter(a => kisiSec === 'Tümü' || a.kim === kisiSec);
  const IKON = { giris: '→', cikis: '←', ziyaret: '●', teklif: '₺', gorev: '✓' };
  el.innerHTML = `<header class="vh"><div><h1>Ekip haritası</h1><p class="sum">${esc(gunAd(f.gun))}${bugunMu ? ' · bugün' : ''} · ${d.ozet.length} kişi · ${d.z.filter(x => zDurum(x) === 'Yapıldı').length} ziyaret</p></div>
</header>
    <div class="eh-ust"><span class="hp-nav"><button type="button" class="btn sm ghost" data-g="-1" aria-label="Önceki gün">‹</button><button type="button" class="btn sm ghost" data-g="0">Bugün</button><button type="button" class="btn sm ghost" data-g="1" aria-label="Sonraki gün" ${bugunMu ? 'disabled' : ''}>›</button></span>
    ${d.ozet.length > 1 ? `<div class="seg eh-kisi" role="group" aria-label="Kişi"><button type="button" data-k="Tümü" class="${kisiSec === 'Tümü' ? 'on' : ''}">Tümü</button>${d.ozet.map(o => `<button type="button" data-k="${esc(o.k)}" class="${kisiSec === o.k ? 'on' : ''}"><i style="--c:${o.renk}"></i>${esc(o.ad)}</button>`).join('')}</div>` : ''}</div>
    <div class="eh">
      <section class="card eh-harita"><div id="eh-map" role="img" aria-label="Ziyaret noktaları haritası"></div><p class="hint" data-hnot></p></section>
      <section class="card eh-ozet"><h2>Kişi özeti</h2>${d.ozet.length ? `<div class="tbl-wrap"><table class="tbl eh-t"><thead><tr><th>Kişi</th><th class="r">Ziyaret</th><th class="r">İçeride</th><th class="r">Yol</th><th class="r">Teklif</th><th class="r">Görev</th></tr></thead><tbody>
        ${d.ozet.map(o => `<tr><td><span class="eh-ad"><i style="--c:${o.renk}"></i><b>${esc(o.ad)}</b></span><small class="muted">${o.icerde ? `<span class="eh-canli">şu an ${esc(firmaAd(o.icerde.firma_id) || 'ziyarette')} · ${saat(o.icerde.giris)}'den beri</span>` : o.ilk ? `${saat(o.ilk)} – ${saat(o.son)}` : o.plan ? `${o.plan} planlı ziyaret` : ''}</small></td>
          <td class="r">${o.yap}${o.plan ? `<small class="muted">/${o.yap + o.plan}</small>` : ''}</td><td class="r">${o.dk ? sureYaz(o.dk) : '—'}</td><td class="r">${o.km ? o.km + ' km' : '—'}</td><td class="r">${o.teklif || '—'}</td><td class="r">${o.gorev || '—'}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="hint">${bugunMu ? 'Bugün henüz giriş ya da ziyaret kaydı yok.' : 'Bu gün kayıt yok.'}</p>`}
        <p class="hint">Konum yalnızca ziyarete giriş ve çıkış anında alınır; sürekli takip yapılmaz. Yol, ziyaret noktaları arasından tahmindir.</p></section>
      <section class="card eh-akis"><h2>Akış</h2>${ak.length ? `<ol class="eh-l">${ak.map(a => `<li class="eh-${a.tur}"><time>${String(a.t).length > 10 ? saat(a.t) : ''}</time><span class="eh-i" style="--c:${d.renk[a.kim] || '#64748B'}" aria-hidden="true">${IKON[a.tur]}</span><span class="grow">${d.ozet.length > 1 ? `<b>${esc(adOf(a.kim))}</b> · ` : ''}${a.zid ? `<button type="button" class="linkbtn" data-zid="${a.zid}">${esc(a.m)}</button>` : esc(a.m)}</span></li>`).join('')}</ol>` : '<p class="hint">Kayıt yok.</p>'}</section>
    </div>`;
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const n = +b.dataset.g; f.gun = n ? gunEkle(f.gun, n) : today(); if (f.gun > today()) f.gun = today(); saveFilters(); ekipharView(el); });
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { f.kisi = b.dataset.k; saveFilters(); ekipharView(el); });
  el.querySelectorAll('[data-zid]').forEach(b => b.onclick = async () => (await import('./ziyaret.js')).ziyaretForm({ id: b.dataset.zid }));
  haritaCiz(el, d, kisiSec);
}

async function haritaCiz(el, d, kisiSec) {
  const kutu = el.querySelector('#eh-map'), not = el.querySelector('[data-hnot]');
  if (harita) { try { harita.remove(); } catch {} harita = null; }
  const nk = d.nokta.filter(n => kisiSec === 'Tümü' || n.kim === kisiSec);
  if (typeof L === 'undefined') { kutu.hidden = true; not.textContent = 'Harita yüklenemedi (internet yok). Akış ve özet aşağıda.'; return; }
  if (!nk.length) { kutu.classList.add('bos'); not.textContent = 'Bu gün konumu bilinen ziyaret yok.'; }
  harita = L.map(kutu, { zoomControl: true, attributionControl: false, maxZoom: 19 }).setView([36.95, 35.3], 8);
  try { const { altlikKatmani } = await import('../altlik.js'); const { katman } = await altlikKatmani('osm'); katman.addTo(harita); } catch {}
  const sinir = [];
  for (const n of nk) {
    const c = d.renk[n.kim] || '#64748B', ic = n.x.giris && !n.x.cikis;
    const m = L.circleMarker(n.p, { radius: ic ? 10 : 8, color: '#fff', weight: 2, fillColor: c, fillOpacity: n.x.cikis || !n.x.giris ? 0.95 : 1, className: ic ? 'eh-canli-nokta' : '' }).addTo(harita);
    m.bindPopup(`<b>${esc(firmaAd(n.x.firma_id) || 'Ziyaret')}</b><br>${esc(adOf(n.kim))}${n.x.giris ? '<br>' + saat(n.x.giris) + (n.x.cikis ? '–' + saat(n.x.cikis) + ' · ' + sureYaz(sureDk(n.x)) : ' · içeride') : ''}${n.x.sonuc_tipi ? '<br>' + esc(n.x.sonuc_tipi) : ''}`);
    sinir.push(n.p);
  }
  // Kişi başına güzergâh çizgisi (saat sırasıyla)
  for (const o of d.ozet.filter(o => kisiSec === 'Tümü' || o.k === kisiSec)) {
    const yol = nk.filter(n => n.kim === o.k).sort((a, b) => String(a.x.giris || a.x.saat || a.x.created_at).localeCompare(String(b.x.giris || b.x.saat || b.x.created_at))).map(n => n.p);
    if (yol.length > 1) L.polyline(yol, { color: o.renk, weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(harita);
  }
  if (sinir.length) harita.fitBounds(sinir, { padding: [30, 30], maxZoom: 14 });
  setTimeout(() => harita?.invalidateSize(), 200);
}
