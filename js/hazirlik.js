// Ziyarete hazırlık: firmanın son 12 ayı ve konuşulacaklar tek ekranda; ziyaretten önce 30 saniyede okunur.
// Bugün'ün planındaki her ziyaretten ve firma sayfasından açılır. Hesap telefonda yapılır.
import { S } from './db.js';
import { esc, usd, tarih, today, gunEkle, byId, toast, openDrawer, directionsUrl, ACIK, pill } from './ui.js';
import { firmaProjeleri } from './views/firmalar.js';
import { firmaRiski, SEVIYE, usdYap } from './vaderisk.js';
import { radarListesi } from './radar.js';
import { haritaUyarilari } from './satisharitasi.js';
import { ozellikSay } from './saglik.js';
import { gizliBolum } from './yetki.js';

const gunOnce = d => d ? Math.round((new Date(today() + 'T00:00') - new Date(String(d).slice(0, 10) + 'T00:00')) / 864e5) : null;
const kisa = (s, n = 140) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export function hazirlikVerisi(fid) {
  const f = byId('firmalar', fid); if (!f) return null;
  const t = today(), yil = gunEkle(t, -365);
  const projeler = firmaProjeleri(fid), acik = projeler.filter(p => ACIK.includes(p.durum)).sort((a, b) => (+b.tutar_usd || 0) - (+a.tutar_usd || 0));
  const ziy = S.ziyaretler.filter(z => z.firma_id === fid && (z.durum || 'Yapıldı') === 'Yapıldı').sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const tek = S.teklifler.filter(x => x.firma_id === fid).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const sip = (S.siparisler || []).filter(s => s.firma_id === fid && (s.tarih || '') >= yil && !s.rapor_disi);
  const yilP = projeler.filter(p => String(p.updated_at || '').slice(0, 10) >= yil);
  const son12 = {
    ziyaret: ziy.filter(z => z.tarih >= yil).length,
    teklif: tek.filter(x => (x.tarih || '') >= yil).length,
    teklifUsd: tek.filter(x => (x.tarih || '') >= yil).reduce((a, x) => a + usdYap(x.toplam, x.para_birimi), 0),
    siparisUsd: sip.reduce((a, s) => a + usdYap(s.net_deger, s.para_birimi), 0), siparis: sip.length,
    kazan: yilP.filter(p => p.durum === 'Sipariş').length, kayip: yilP.filter(p => p.durum === 'Kayıp').length,
  };
  // Konuşulacaklar
  const konu = [];
  const r = firmaRiski(fid); if (r?.seviye) konu.push({ c: SEVIYE[r.seviye].c, m: `Tahsilat: ${r.metin}` });
  for (const g of S.gorevler.filter(g => g.firma_id === fid && g.durum !== 'Tamam').slice(0, 4)) konu.push({ c: g.son_tarih && g.son_tarih < t ? '#B91C1C' : '#2563EB', m: `Görev: ${g.baslik}${g.son_tarih ? ' · ' + tarih(g.son_tarih) : ''}` });
  for (const x of tek.filter(x => x.durum === 'Gönderildi').slice(0, 3)) konu.push({ c: '#7C3AED', m: `Teklif ${x.teklif_no || ''} cevap bekliyor${x.gecerlilik ? ` · geçerlilik ${x.gecerlilik < t ? 'doldu' : tarih(x.gecerlilik)}` : ''}${byId('projeler', x.proje_id) ? ' · ' + byId('projeler', x.proje_id).ad : ''}` });
  for (const x of radarListesi().filter(x => x.tur === 'sessiz' && acik.some(p => x.k === 'sessiz:' + p.id)).slice(0, 3)) konu.push({ c: '#EA580C', m: `${x.baslik}: ${x.alt.split(' · ')[1] || 'sessiz'}` });
  if (!gizliBolum('harita')) for (const p of acik.slice(0, 6)) { const u = haritaUyarilari(p).find(u => u.s === 'kirmizi'); if (u) konu.push({ c: '#B91C1C', m: `${p.ad}: ${u.m.replace(/\.$/, '')}` }); }
  for (const n of (S.numuneler || []).filter(n => n.firma_id === fid && n.durum === 'Müşteride')) konu.push({ c: '#A16207', m: `Numune müşteride${n.iade_tarihi ? ' · iade ' + tarih(n.iade_tarihi) : ''}${n.urun_ad || n.urun_kod ? ' · ' + (n.urun_ad || n.urun_kod) : ''}` });
  for (const s of (S.servis_kayitlari || []).filter(s => s.firma_id === fid && s.durum !== 'Çözüldü')) konu.push({ c: '#B91C1C', m: `Açık servis kaydı: ${kisa([s.tip, s.urun, s.aciklama].filter(Boolean).join(' · '), 70)}` });
  // Kişiler: karar vericiler önce, sonra telefonu olanlar; yakın doğum günü
  const karar = new Map(); for (const p of acik) for (const k of p.karar_grubu || []) if (k.kisi_id && !karar.has(k.kisi_id)) karar.set(k.kisi_id, k.rol);
  const kisiler = S.kisiler.filter(k => k.firma_id === fid).sort((a, b) => (karar.has(b.id) - karar.has(a.id)) || (!!b.telefon - !!a.telefon)).slice(0, 4)
    .map(k => { let dg = null; if (k.dogum_gunu) { const d = new Date(k.dogum_gunu + 'T00:00'), bu = new Date(new Date().getFullYear(), d.getMonth(), d.getDate()); const fark = Math.round((bu - new Date(t + 'T00:00')) / 864e5); if (fark >= 0 && fark <= 14) dg = fark; } return { k, rol: karar.get(k.id) || null, dg }; });
  const kayipMarka = {}; for (const p of projeler.filter(p => p.durum === 'Kayıp' && p.rakip_marka)) kayipMarka[p.rakip_marka] = (kayipMarka[p.rakip_marka] || 0) + 1;
  return { f, son12, konu, kisiler, acik, ziy: ziy.slice(0, 2), sonZiyaretGun: gunOnce(ziy[0]?.tarih), sonTeklif: tek[0] || null, kayipMarka: Object.entries(kayipMarka).sort((a, b) => b[1] - a[1]) };
}

export function hazirlikAc(fid) {
  const d = hazirlikVerisi(fid); if (!d) return toast('Firma bulunamadı.', 'err');
  ozellikSay('hazirlik');
  const f = d.f, s = d.son12;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Ziyarete hazırlık</p><h2 id="drawer-title">${esc(f.ad)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody hz-ic">
      <p class="hz-alt">${esc([f.segment ? f.segment + ' segmenti' : '', (f.tipler || []).join(', '), d.sonZiyaretGun == null ? 'daha önce ziyaret edilmemiş' : d.sonZiyaretGun === 0 ? 'bugün ziyaret edildi' : `son ziyaret ${d.sonZiyaretGun} gün önce`].filter(Boolean).join(' · '))}</p>
      <div class="ledger-mini hz-12"><div><b>${s.ziyaret}</b><span>ziyaret</span></div><div><b>${s.teklif}</b><span>teklif${s.teklifUsd ? ' · ' + usd(Math.round(s.teklifUsd)) : ''}</span></div><div><b>${s.siparis}</b><span>sipariş${s.siparisUsd ? ' · ' + usd(Math.round(s.siparisUsd)) : ''}</span></div><div><b>${s.kazan}/${s.kayip}</b><span>kazanılan / kaybedilen</span></div></div>
      <p class="hint hz-not">Son 12 ay</p>
      <h3>Konuşulacaklar</h3>${d.konu.length ? `<ul class="hz-konu">${d.konu.map(k => `<li style="--c:${k.c}">${esc(k.m)}</li>`).join('')}</ul>` : '<p class="hint">Bekleyen iş yok.</p>'}
      ${d.acik.length ? `<h3>Açık projeler <span class="muted">${d.acik.length}</span></h3><ul class="list">${d.acik.slice(0, 5).map(p => `<li><a href="#/proje/${p.id}" class="grow"><b>${esc(p.ad)}</b><span class="muted">${usd(p.tutar_usd)}</span></a>${pill(p.durum)}</li>`).join('')}</ul>` : ''}
      ${d.kisiler.length ? `<h3>Kiminle</h3><ul class="list">${d.kisiler.map(x => `<li><a href="#/kisi/${x.k.id}" class="grow"><b>${esc(x.k.ad_soyad)}</b><span class="muted">${esc([x.k.unvan, x.rol, x.dg != null ? (x.dg === 0 ? 'bugün doğum günü' : `${x.dg} gün sonra doğum günü`) : ''].filter(Boolean).join(' · '))}</span></a>${x.k.telefon ? `<a class="btn sm ghost" href="tel:${esc(x.k.telefon)}">Ara</a>` : ''}</li>`).join('')}</ul>` : ''}
      ${d.ziy.length ? `<h3>Son görüşmeler</h3><ul class="hz-gor">${d.ziy.map(z => `<li><b>${tarih(z.tarih)}</b>${z.sonuc_tipi ? ` · ${esc(z.sonuc_tipi)}` : ''}${byId('kisiler', z.kisi_id) ? ` · ${esc(byId('kisiler', z.kisi_id).ad_soyad)}` : ''}${z.notlar ? `<p>${esc(kisa(z.notlar))}</p>` : ''}</li>`).join('')}</ul>` : ''}
      ${d.kayipMarka.length ? `<p class="hint">Bu firmada kaybettiğimiz işler: ${d.kayipMarka.map(([m, n]) => `${esc(m)} ${n}`).join(' · ')}</p>` : ''}
    </div>
    <div class="dfoot sticky">${f.lat != null ? `<a class="btn ghost" href="${directionsUrl(f.lat, f.lng)}" target="_blank" rel="noopener">Yol</a>` : ''}<a class="btn ghost" href="#/firma/${f.id}" data-sayfa>Firma sayfası</a><button type="button" class="btn primary" data-hzgiris data-gerek="yaz:ziyaretler">Giriş yap</button></div>`);
  p.querySelector('[data-hzgiris]').onclick = async () => { p.querySelector('[data-close]').click(); setTimeout(async () => (await import('./giriscikis.js')).girisYap({ firma_id: f.id }), 350); };
}
