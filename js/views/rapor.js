// Haftalık rapor: haftanın ziyaretleri, proje hareketleri, teklif, sipariş, numune, servis, tahsilat ve masrafları; gelecek haftanın planı
import { S } from '../db.js';
import { F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, gunEkle, isoLocal, byId, firmaAd, toast, exportXlsx, waLink, ACIK } from '../ui.js';
import { zDurum } from './ziyaret.js';
import { benimAdim } from '../sablon.js';
import { gunKm } from './bugun.js';

export const haftaBasi = d => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return isoLocal(x); };
const ara = (d, a, b) => d && d.slice(0, 10) >= a && d.slice(0, 10) <= b;
const sayac = (l, f) => { const o = {}; for (const x of l) { const k = f(x) || 'Belirtilmemiş'; o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]); };

export function haftaVerisi(bas) {
  const son = gunEkle(bas, 6), sonrakiB = gunEkle(bas, 7), sonrakiS = gunEkle(bas, 13);
  const ziy = S.ziyaretler.filter(z => zDurum(z) === 'Yapıldı' && ara(z.tarih, bas, son)).sort((a, b) => (a.tarih + (a.saat || '')).localeCompare(b.tarih + (b.saat || '')));
  const gec = S.proje_gecmis.filter(g => ara(g.tarih, bas, son) && g.eski_durum && g.eski_durum !== g.yeni_durum);
  // Yeni proje: uygulamada oluşturulanlar (durum geçmişindeki ilk kayıt); Excel'den toplu yüklenenler sayılmaz
  const yeniIds = new Set(S.proje_gecmis.filter(g => !g.eski_durum && ara(g.tarih, bas, son)).map(g => g.proje_id));
  const yeniP = S.projeler.filter(p => yeniIds.has(p.id)).map(p => ({ ...p, created_at: S.proje_gecmis.find(g => g.proje_id === p.id && !g.eski_durum)?.tarih || p.created_at }));
  const tek = S.teklifler.filter(t => ara(t.tarih, bas, son));
  const sip = S.siparisler.filter(s => ara(s.tarih, bas, son));
  const num_ = S.numuneler.filter(n => ara(n.verilis, bas, son));
  const srvA = S.servis_kayitlari.filter(s => ara(s.tarih, bas, son)), srvC = S.servis_kayitlari.filter(s => ara(s.cozum_tarihi, bas, son));
  const tah = S.tahsilatlar.filter(t => ara(t.odeme_tarihi, bas, son));
  const mas = S.masraflar.filter(m => ara(m.tarih, bas, son));
  const gunler = [...new Set(ziy.map(z => z.tarih))];
  const km = mas.reduce((s, m) => s + (+m.km || 0), 0) || gunler.reduce((s, g) => s + gunKm(g), 0);
  const plan = S.ziyaretler.filter(z => zDurum(z) === 'Planlandı' && ara(z.tarih, sonrakiB, sonrakiS)).sort((a, b) => (a.tarih + (a.saat || '')).localeCompare(b.tarih + (b.saat || '')));
  const gorev = S.gorevler.filter(g => g.durum !== 'Tamam' && g.son_tarih && g.son_tarih <= sonrakiS).sort((a, b) => a.son_tarih.localeCompare(b.son_tarih));
  const kazan = gec.filter(g => g.yeni_durum === 'Sipariş'), kayb = gec.filter(g => g.yeni_durum === 'Kayıp');
  return { bas, son, ziy, gec, yeniP, tek, sip, num: num_, srvA, srvC, tah, mas, gunler, km, plan, gorev, kazan, kayb,
    sipUsd: sip.filter(s => s.para_birimi === 'USD').reduce((a, s) => a + (+s.net_deger || 0), 0), tekUsd: tek.filter(t => (t.para_birimi || 'USD') === 'USD').reduce((a, t) => a + (+t.toplam || 0), 0),
    amac: sayac(ziy, z => z.amac), sonuc: sayac(ziy.filter(z => z.sonuc_tipi), z => z.sonuc_tipi) };
}
const aralik = d => `${tarih(d.bas)} – ${tarih(d.son)}`;
const pAd = id => byId('projeler', id)?.ad || '';

export function raporMetni(d) {
  const L = [`*Haftalık rapor* ${aralik(d)}${benimAdim() ? '\n' + benimAdim() : ''}`, '',
    `Ziyaret: ${d.ziy.length} (${d.gunler.length} gün sahada${d.km ? ', ~' + num(Math.round(d.km)) + ' km' : ''})`,
    ...(d.amac.length ? ['Amaç: ' + d.amac.map(([k, v]) => `${k} ${v}`).join(', ')] : []),
    ...(d.sonuc.length ? ['Sonuç: ' + d.sonuc.map(([k, v]) => `${k} ${v}`).join(', ')] : []),
    `Teklif: ${d.tek.length}${d.tekUsd ? ' · ' + usd(d.tekUsd) : ''}`, `Sipariş: ${d.sip.length}${d.sipUsd ? ' · ' + usd(d.sipUsd) : ''}`,
    ...(d.kazan.length ? ['Kazanılan: ' + d.kazan.map(g => pAd(g.proje_id)).join(', ')] : []),
    ...(d.kayb.length ? ['Kaybedilen: ' + d.kayb.map(g => { const p = byId('projeler', g.proje_id); return (p?.ad || '') + (p?.rakip_marka ? ' (' + p.rakip_marka + ')' : ''); }).join(', ')] : []),
    ...(d.yeniP.length ? ['Yeni proje: ' + d.yeniP.map(p => p.ad).join(', ')] : []),
    ...(d.num.length ? [`Numune: ${d.num.length}`] : []), ...(d.srvA.length || d.srvC.length ? [`Servis: ${d.srvA.length} açıldı, ${d.srvC.length} çözüldü`] : []),
    '', '*Öne çıkan görüşmeler*', ...d.ziy.filter(z => z.notlar || z.sonuc).slice(0, 8).map(z => `• ${firmaAd(z.firma_id) || 'Ziyaret'}${z.proje_id ? ' / ' + pAd(z.proje_id) : ''}: ${(z.sonuc || z.notlar || '').replace(/\s+/g, ' ').slice(0, 140)}`),
    '', `*Gelecek hafta* ${d.plan.length} planlı ziyaret`, ...d.plan.slice(0, 10).map(z => `• ${tarih(z.tarih)} ${firmaAd(z.firma_id) || ''}${z.amac ? ' (' + z.amac + ')' : ''}`)];
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function raporHtml(d) {
  const tablo = (bas, satirlar) => satirlar.length ? `<table><thead><tr>${bas.map(b => `<th>${b}</th>`).join('')}</tr></thead><tbody>${satirlar.map(r => `<tr>${r.map(c => `<td>${esc(c ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="bos">Kayıt yok.</p>';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Haftalık rapor ${d.bas}</title><style>
    @page { size: A4; margin: 14mm; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; } thead { display: table-header-group; } tr, .tot, footer, .to, h2 + table tr:first-child { break-inside: avoid; page-break-inside: avoid; } h2 { break-after: avoid; } body { font: 10pt/1.45 "Segoe UI", Roboto, Arial, sans-serif; color: #1D2B36; } h1 { font-size: 18pt; margin: 0 0 2px; } h2 { font-size: 12pt; margin: 16px 0 6px; border-bottom: 2px solid #F5B700; padding-bottom: 3px; }
    .k { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; } .k div { background: #F4F6F8; padding: 8px; border-radius: 4px; } .k b { display: block; font-size: 15pt; } .k span { color: #66757F; font-size: 8.5pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; } th { text-align: left; background: #1D2B36; color: #fff; padding: 4px 6px; font-weight: 600; } td { padding: 4px 6px; border-bottom: 1px solid #E3E8EC; vertical-align: top; } .bos, .alt { color: #66757F; }
  </style></head><body><h1>Haftalık rapor</h1><div class="alt">${aralik(d)}${benimAdim() ? ' · ' + esc(benimAdim()) : ''}</div>
  <div class="k"><div><span>Ziyaret</span><b>${d.ziy.length}</b>${d.gunler.length} gün sahada</div><div><span>Teklif</span><b>${d.tek.length}</b>${d.tekUsd ? usd(d.tekUsd) : ''}</div><div><span>Sipariş</span><b>${d.sip.length}</b>${d.sipUsd ? usd(d.sipUsd) : ''}</div><div><span>Kazanılan / kaybedilen</span><b>${d.kazan.length} / ${d.kayb.length}</b>proje</div></div>
  <h2>Ziyaretler</h2>${tablo(['Tarih', 'Firma', 'Kişi', 'Proje', 'Amaç', 'Sonuç', 'Not'], d.ziy.map(z => [tarih(z.tarih), firmaAd(z.firma_id), byId('kisiler', z.kisi_id)?.ad_soyad, pAd(z.proje_id), z.amac, z.sonuc_tipi, (z.sonuc || z.notlar || '').slice(0, 160)]))}
  <h2>Proje hareketleri</h2>${tablo(['Tarih', 'Proje', 'Değişim'], [...d.gec.map(g => [tarih(g.tarih.slice(0, 10)), pAd(g.proje_id), `${g.eski_durum} → ${g.yeni_durum}`]), ...d.yeniP.map(p => [tarih(p.created_at.slice(0, 10)), p.ad, 'Yeni proje'])])}
  <h2>Teklifler</h2>${tablo(['Tarih', 'Teklif no', 'Firma', 'Proje', 'Tutar', 'Durum'], d.tek.map(t => [tarih(t.tarih), t.teklif_no, firmaAd(t.firma_id), pAd(t.proje_id), num(t.toplam) + ' ' + (t.para_birimi || ''), t.durum]))}
  <h2>Siparişler</h2>${tablo(['Tarih', 'Sipariş no', 'SAS no', 'Cari', 'Proje', 'Net değer'], d.sip.map(s => [tarih(s.tarih), s.siparis_no, s.referans, s.musteri_adi, pAd(s.proje_id) || s.proje_tanimi, num(s.net_deger) + ' ' + s.para_birimi]))}
  ${d.num.length || d.srvA.length || d.srvC.length || d.tah.length ? `<h2>Numune, servis ve tahsilat</h2>${tablo(['Tür', 'Firma', 'Açıklama'], [...d.num.map(n => ['Numune', firmaAd(n.firma_id), `${n.adet} × ${n.urun_ad}`]), ...d.srvA.map(s => ['Servis açıldı', firmaAd(s.firma_id), s.aciklama]), ...d.srvC.map(s => ['Servis çözüldü', firmaAd(s.firma_id), s.cozum]), ...d.tah.map(t => ['Tahsilat', firmaAd(t.firma_id) || t.cari, `${t.belge_no || ''} ${num(t.odenen)} ${t.para_birimi}`])])}` : ''}
  <h2>Gelecek hafta</h2>${tablo(['Tarih', 'Firma / görev', 'Amaç'], [...d.plan.map(z => [tarih(z.tarih) + (z.saat ? ' ' + z.saat : ''), firmaAd(z.firma_id), z.amac]), ...d.gorev.map(g => [tarih(g.son_tarih), '○ ' + g.baslik, g.son_tarih < today() ? 'gecikmiş görev' : 'görev'])])}
  ${d.mas.length ? `<p class="alt">Masraf: ${num(d.mas.reduce((s, m) => s + (+m.tutar || 0), 0))} TL${d.km ? ' · ' + num(Math.round(d.km)) + ' km' : ''}</p>` : ''}
  </body></html>`;
}
function yazdir(html) {
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fr); fr.srcdoc = html;
  fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast('Yazdırma açılamadı.', 'err'); } setTimeout(() => fr.remove(), 60000); };
  toast('Yazdırma ekranında “PDF olarak kaydet”i seç.');
}

export function raporView(el) {
  const f = F('rapor', { bas: null });
  if (!f.bas) f.bas = haftaBasi(today());
  const d = haftaVerisi(f.bas);
  const metin = raporMetni(d);
  const li = (l, fn) => l.length ? `<ul class="list">${l.map(fn).join('')}</ul>` : '<p class="hint">Kayıt yok.</p>';
  el.innerHTML = `<header class="vh"><div><h1>Haftalık rapor</h1><p class="sum">${aralik(d)}</p></div>
    <div class="vh-act"><div class="seg" role="group" aria-label="Hafta"><button type="button" data-h="-7" aria-label="Önceki hafta">‹ Önceki</button><button type="button" data-h="0" class="${f.bas === haftaBasi(today()) ? 'on' : ''}">Bu hafta</button><button type="button" data-h="7" aria-label="Sonraki hafta">Sonraki ›</button></div>
      <button class="btn ghost" data-xlsx>Excel</button><button class="btn ghost" data-kopya>Metni kopyala</button><a class="btn ghost" target="_blank" rel="noopener" href="${waLink('', metin)}">WhatsApp</a><button class="btn primary" data-pdf>PDF / yazdır</button></div></header>
    <section class="ledger"><div><span>Ziyaret</span><b>${d.ziy.length}</b><small>${d.gunler.length} gün sahada${d.km ? ` · ~${num(Math.round(d.km))} km` : ''}</small></div>
      <div><span>Teklif</span><b>${d.tek.length}</b><small>${d.tekUsd ? usd(d.tekUsd) : 'bu hafta teklif yok'}</small></div>
      <div><span>Sipariş</span><b>${usd(d.sipUsd)}</b><small>${d.sip.length} sipariş</small></div>
      <div><span>Kazanılan / kaybedilen</span><b>${d.kazan.length} / ${d.kayb.length}</b><small>${d.gec.length} durum değişikliği · ${d.yeniP.length} yeni proje</small></div></section>
    <div class="dash">
      <section class="card wide"><h2>Ziyaretler <span class="muted">${d.ziy.length}</span></h2>
        ${d.amac.length ? `<p class="hint">Amaç: ${d.amac.map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}${d.sonuc.length ? `<br>Sonuç: ${d.sonuc.map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}` : ''}</p>` : ''}
        ${li(d.ziy, z => `<li><span class="muted nowrap">${tarih(z.tarih)}</span><span class="grow"><b>${esc(firmaAd(z.firma_id) || 'Ziyaret')}</b>${z.proje_id ? ` · <a href="#/proje/${z.proje_id}">${esc(pAd(z.proje_id))}</a>` : ''}<br><small class="muted">${esc([z.amac, (z.sonuc || z.notlar || '').slice(0, 140)].filter(Boolean).join(' · '))}</small></span>${z.sonuc_tipi ? `<span class="tag-s res">${esc(z.sonuc_tipi)}</span>` : ''}</li>`)}</section>
      <section class="card"><h2>Proje hareketleri</h2>${li([...d.gec.map(g => ({ t: g.tarih, p: g.proje_id, x: `${g.eski_durum} → ${g.yeni_durum}` })), ...d.yeniP.map(p => ({ t: p.created_at, p: p.id, x: 'Yeni proje' }))], g => `<li><a href="#/proje/${g.p}"><b>${esc(pAd(g.p))}</b><span class="muted">${tarih(g.t.slice(0, 10))} · ${esc(g.x)}</span></a></li>`)}</section>
      <section class="card"><h2>Teklif ve sipariş</h2>${li([...d.tek.map(t => `<li><span>${esc(t.teklif_no)} · ${esc(firmaAd(t.firma_id))}</span><b class="num">${num(t.toplam)} ${esc(t.para_birimi || '')}</b></li>`), ...d.sip.map(s => `<li><span>${esc(s.siparis_no || '')} · ${esc(s.referans || s.musteri_adi || '')}</span><b class="num">${num(s.net_deger)} ${esc(s.para_birimi)}</b></li>`)], x => x)}</section>
      <section class="card"><h2>Gelecek hafta</h2>${li([...d.plan.map(z => `<li><span class="muted nowrap">${tarih(z.tarih)}</span><span class="grow">${esc(firmaAd(z.firma_id) || 'Ziyaret')}${z.amac ? ' · ' + esc(z.amac) : ''}</span></li>`), ...d.gorev.map(g => `<li class="${g.son_tarih < today() ? 'late' : ''}"><span class="grow">○ ${esc(g.baslik)}</span><span class="muted">${tarih(g.son_tarih)}</span></li>`)], x => x)}</section>
      <section class="card"><h2>Gönderilecek özet</h2><pre class="rapor-metin">${esc(metin)}</pre></section>
    </div>`;
  el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { f.bas = +b.dataset.h ? gunEkle(f.bas, +b.dataset.h) : haftaBasi(today()); saveFilters(); raporView(el); });
  el.querySelector('[data-pdf]').onclick = () => yazdir(raporHtml(d));
  el.querySelector('[data-kopya]').onclick = async () => { try { await navigator.clipboard.writeText(metin); toast('Rapor metni kopyalandı.'); } catch { toast('Kopyalanamadı.', 'err'); } };
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`haftalik-rapor-${d.bas}.xlsx`, {
    'Ziyaretler': d.ziy.map(z => ({ Tarih: z.tarih, Saat: z.saat, Firma: firmaAd(z.firma_id), Kişi: byId('kisiler', z.kisi_id)?.ad_soyad, Proje: pAd(z.proje_id), Amaç: z.amac, Sonuç: z.sonuc_tipi, Not: z.sonuc || z.notlar })),
    'Proje hareketleri': d.gec.map(g => ({ Tarih: g.tarih.slice(0, 10), Proje: pAd(g.proje_id), Önceki: g.eski_durum, Yeni: g.yeni_durum })),
    'Teklifler': d.tek.map(t => ({ Tarih: t.tarih, 'Teklif no': t.teklif_no, Firma: firmaAd(t.firma_id), Proje: pAd(t.proje_id), Tutar: t.toplam, 'Para birimi': t.para_birimi, Durum: t.durum })),
    'Siparişler': d.sip.map(s => ({ Tarih: s.tarih, 'Sipariş no': s.siparis_no, 'SAS no': s.referans, 'Sipariş notu': s.siparis_notu, Cari: s.musteri_adi, Proje: pAd(s.proje_id) || s.proje_tanimi, 'Net değer': s.net_deger, 'Para birimi': s.para_birimi })),
    'Gelecek hafta': [...d.plan.map(z => ({ Tarih: z.tarih, Tür: 'Ziyaret', Konu: firmaAd(z.firma_id), Amaç: z.amac })), ...d.gorev.map(g => ({ Tarih: g.son_tarih, Tür: 'Görev', Konu: g.baslik }))],
  });
}
