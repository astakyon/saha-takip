// Kayıp ve rakip istihbaratı: hangi rakibe, hangi nedenle, hangi il ve sektörde kaybediyoruz; rakiple fiyat farkı;
// rakibe karşı kazandıklarımız ve çeyreklere göre gidişat. Veri: kayıp projelerdeki işi alan marka, neden, fiyatlar
// ve Rakip fiyatları ekranında projeye bağlanmış rakip kayıtları. Hesap telefonda yapılır.
import { S } from '../db.js';
import { F, saveFilters } from '../state.js';
import { esc, usd, num, tarih, byId, openDrawer, exportXlsx, today } from '../ui.js';

const tutar = p => +p.bizim_teklif_usd || +p.tutar_usd || 0;
const B = 'Belirtilmemiş';
const marka = s => (s || '').trim() || B;
// Projenin sonuçlandığı tarih: durum geçmişindeki son Kayıp/Sipariş geçişi, yoksa güncelleme tarihi
function sonucTarihi() {
  const m = new Map();
  for (const g of S.proje_gecmis || []) if (['Kayıp', 'Sipariş'].includes(g.yeni_durum) && (!m.has(g.proje_id) || g.tarih > m.get(g.proje_id))) m.set(g.proje_id, String(g.tarih).slice(0, 10));
  return p => m.get(p.id) || String(p.updated_at || p.created_at || '').slice(0, 10) || (p.takip_yili ? p.takip_yili + '-06-30' : '');
}
const ceyrek = d => d ? `${d.slice(0, 4)}-Ç${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}` : '';

export function analiz({ yil = 'Tümü', il = 'Tümü', sektor = 'Tümü' } = {}) {
  const st = sonucTarihi();
  const uygun = p => !p.aday && (yil === 'Tümü' || st(p).startsWith(String(yil)) || (!st(p) && String(p.takip_yili) === String(yil))) && (il === 'Tümü' || p.il === il) && (sektor === 'Tümü' || p.sektor === sektor);
  const kayip = S.projeler.filter(p => p.durum === 'Kayıp' && uygun(p));
  const kazan = S.projeler.filter(p => p.durum === 'Sipariş' && uygun(p));
  // Kazandığımız projelerde karşımızdaki rakipler: rakip fiyat kaydı projeye bağlıysa ya da projede rakip markası yazılıysa
  const karsi = new Map();   // proje_id → Set(marka)
  for (const r of S.rakip_fiyatlar || []) if (r.proje_id && r.marka) (karsi.get(r.proje_id) || karsi.set(r.proje_id, new Set()).get(r.proje_id)).add(r.marka.trim());
  for (const p of kazan) if (p.rakip_marka) (karsi.get(p.id) || karsi.set(p.id, new Set()).get(p.id)).add(p.rakip_marka.trim());
  const R = {};
  const r = m => (R[m] ||= { m, kayip: [], kazan: [], usd: 0, neden: {}, fark: [], il: {}, sektor: {}, ceyrek: {} });
  for (const p of kayip) {
    const x = r(marka(p.rakip_marka)); x.kayip.push(p); x.usd += tutar(p);
    const n = p.kayip_nedeni || B; x.neden[n] = (x.neden[n] || 0) + 1;
    x.il[p.il || B] = (x.il[p.il || B] || 0) + 1; x.sektor[p.sektor || B] = (x.sektor[p.sektor || B] || 0) + 1;
    const c = ceyrek(st(p)); if (c) x.ceyrek[c] = (x.ceyrek[c] || 0) + 1;
    const biz = +p.bizim_teklif_usd || 0, onlar = +p.rakip_toplam_usd || 0;
    if (biz > 0 && onlar > 0) x.fark.push((biz - onlar) / biz * 100);
  }
  for (const p of kazan) for (const m of karsi.get(p.id) || []) r(m).kazan.push(p);
  const rakipler = Object.values(R).map(x => ({ ...x, oran: x.kazan.length + x.kayip.length ? x.kazan.length / (x.kazan.length + x.kayip.length) * 100 : null,
    ortFark: x.fark.length ? x.fark.reduce((a, b) => a + b, 0) / x.fark.length : null, enNeden: Object.entries(x.neden).filter(([k]) => k !== B).sort((a, b) => b[1] - a[1])[0]?.[0] || null }))
    .sort((a, b) => (a.m === B) - (b.m === B) || b.kayip.length - a.kayip.length || b.usd - a.usd);
  const say = (l, f) => { const o = {}; for (const p of l) { const k = f(p) || B; (o[k] ||= { n: 0, usd: 0 }); o[k].n++; o[k].usd += tutar(p); } return Object.entries(o).sort((a, b) => (a[0] === B) - (b[0] === B) || b[1].n - a[1].n); };
  const fiyatli = kayip.filter(p => +p.bizim_teklif_usd > 0 && +p.rakip_toplam_usd > 0);
  const ceyrekler = [...new Set(kayip.map(p => ceyrek(st(p))).filter(Boolean))].sort().slice(-6);
  return { kayip, kazan, rakipler, neden: say(kayip, p => p.kayip_nedeni), il: say(kayip, p => p.il), sektor: say(kayip, p => p.sektor),
    kayipUsd: kayip.reduce((a, p) => a + tutar(p), 0), kazanUsd: kazan.reduce((a, p) => a + (+p.siparis_tutari_usd || tutar(p)), 0),
    oran: kayip.length + kazan.length ? kazan.length / (kayip.length + kazan.length) * 100 : null, fiyatli,
    ortFark: fiyatli.length ? fiyatli.reduce((a, p) => a + (p.bizim_teklif_usd - p.rakip_toplam_usd) / p.bizim_teklif_usd * 100, 0) / fiyatli.length : null,
    eksik: kayip.filter(p => !p.rakip_marka || !p.kayip_nedeni).length, ceyrekler };
}

const yuzde = v => v == null ? '—' : '%' + num(Math.round(v));
const farkYaz = v => v == null ? '—' : v > 0 ? `%${num(Math.round(v))} ucuz` : v < 0 ? `%${num(Math.round(-v))} pahalı` : 'aynı';
const cubuk = (l, renk, n = 8) => { const m = Math.max(...l.map(([, v]) => v.n), 1); return l.length ? `<ul class="hbars ra-bars">${l.slice(0, n).map(([k, v]) => `<li><span title="${esc(k)}">${esc(k)}</span><span class="hb"><i style="width:${v.n / m * 100}%;--c:${k === B ? 'var(--line)' : renk}"></i></span><b>${v.n}</b><small>${v.usd ? usd(v.usd) : ''}</small></li>`).join('')}</ul>` : '<p class="hint">Kayıt yok.</p>'; };

export function rakipanalizView(el) {
  const f = F('rakipanaliz', { yil: String(new Date().getFullYear()), il: 'Tümü', sektor: 'Tümü' });
  const a = analiz(f);
  const yillar = [...new Set(S.projeler.filter(p => ['Kayıp', 'Sipariş'].includes(p.durum)).map(p => String(p.updated_at || p.takip_yili || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
  const iller = [...new Set(S.projeler.filter(p => p.durum === 'Kayıp').map(p => p.il).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'tr'));
  const sektorler = [...new Set(S.projeler.filter(p => p.durum === 'Kayıp').map(p => p.sektor).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'tr'));
  const sec = (k, l) => `<select data-f="${k}" aria-label="${k}">${['Tümü', ...l].map(v => `<option ${String(f[k]) === String(v) ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  const ilk = a.rakipler.find(x => x.m !== B);
  // Bölge × rakip matrisi (ilk 5 rakip)
  const top5 = a.rakipler.filter(x => x.m !== B).slice(0, 5), illerM = a.il.map(([k]) => k).slice(0, 8);
  const matris = (alan, satirlar) => satirlar.length && top5.length ? `<table class="tbl ra-m"><thead><tr><th></th>${top5.map(x => `<th>${esc(x.m)}</th>`).join('')}</tr></thead><tbody>${satirlar.map(s => `<tr><th>${esc(s)}</th>${top5.map(x => { const v = x[alan][s] || 0, m = Math.max(...top5.map(y => y[alan][s] || 0), 1); return `<td><span class="ra-hucre" style="--a:${v ? 0.15 + 0.7 * v / m : 0}">${v || ''}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table>` : '<p class="hint">Yeterli kayıt yok.</p>';
  el.innerHTML = `<header class="vh"><div><h1>Kayıp ve rakip</h1><p class="sum">${a.kayip.length} kayıp · ${a.kazan.length} kazanılan${a.eksik ? ` · <button type="button" class="linkbtn" data-tamam>${a.eksik} kayıpta bilgi eksik</button>` : ''}</p></div>
    <div class="vh-act"><button class="btn ghost" data-xls>Excel</button></div></header>
    <div class="frow ra-filtre"><label>Yıl ${sec('yil', yillar)}</label><label>İl ${sec('il', iller)}</label>${sektorler.length ? `<label>Sektör ${sec('sektor', sektorler)}</label>` : ''}</div>
    <section class="ledger"><div><span>Kaybedilen</span><b>${usd(a.kayipUsd)}</b><small>${a.kayip.length} proje</small></div><div><span>Kazanılan</span><b>${usd(a.kazanUsd)}</b><small>${a.kazan.length} proje</small></div>
      <div><span>Kazanma oranı</span><b>${yuzde(a.oran)}</b><small>kazanılan / sonuçlanan</small></div><div><span>En çok kaybettiğimiz</span><b>${esc(ilk?.m || '—')}</b><small>${ilk ? `${ilk.kayip.length} proje · ${usd(ilk.usd)}` : ''}</small></div>
      <div><span>Rakip fiyatı ortalama</span><b>${farkYaz(a.ortFark)}</b><small>${a.fiyatli.length} kayıpta iki fiyat da girili</small></div></section>
    <div class="dash">
      <section class="card wide"><h2>Rakipler</h2>${a.rakipler.length ? `<div class="tbl-wrap"><table class="tbl ra-t"><thead><tr><th>Rakip</th><th class="r">Kaybettik</th><th class="r">Tutar</th><th class="r">Kazandık</th><th class="r">Rakibin kazandığı pay</th><th>En sık neden</th><th class="r">Fiyatı</th>${a.ceyrekler.length > 1 ? '<th>Çeyreklere göre kayıp</th>' : ''}</tr></thead><tbody>
        ${a.rakipler.map(x => `<tr data-m="${esc(x.m)}" tabindex="0" role="button"><td><b>${esc(x.m)}</b></td><td class="r">${x.kayip.length || '—'}</td><td class="r">${x.usd ? usd(x.usd) : '—'}</td><td class="r">${x.kazan.length || '—'}</td>
          <td class="r">${x.m === B || x.oran == null ? '—' : yuzde(100 - x.oran)}</td><td>${esc(x.enNeden || '—')}</td><td class="r ${x.ortFark > 0 ? 'neg' : ''}">${farkYaz(x.ortFark)}</td>
          ${a.ceyrekler.length > 1 ? `<td><span class="ra-spark" title="${a.ceyrekler.map(c => `${c}: ${x.ceyrek[c] || 0}`).join(', ')}">${a.ceyrekler.map(c => { const m = Math.max(...a.rakipler.flatMap(y => a.ceyrekler.map(k => y.ceyrek[k] || 0)), 1); return `<i style="height:${Math.max(2, (x.ceyrek[c] || 0) / m * 22)}px"></i>`; }).join('')}</span></td>` : ''}</tr>`).join('')}</tbody></table></div>
        <p class="hint">Rakibin kazandığı pay: o rakiple karşılaştığımız sonuçlanmış projelerde işi onun aldığı oran. Kazandıklarımız, Rakip fiyatları ekranında projeye bağlanan ya da projede rakip markası yazılı olan siparişlerdir. Satıra dokununca projeler açılır.</p>`
        : '<p class="hint">Bu süzgeçte kayıp proje yok.</p>'}</section>
      <section class="card"><h2>Neden kaybediyoruz</h2>${cubuk(a.neden, '#C2410C')}</section>
      <section class="card"><h2>İl</h2>${cubuk(a.il, '#2563EB')}</section>
      ${a.sektor.some(([k]) => k !== B) ? `<section class="card"><h2>Sektör</h2>${cubuk(a.sektor, '#7C3AED')}</section>` : ''}
      <section class="card wide"><h2>İl ve rakip</h2>${matris('il', illerM)}</section>
      ${a.sektor.some(([k]) => k !== B) ? `<section class="card wide"><h2>Sektör ve rakip</h2>${matris('sektor', a.sektor.map(([k]) => k).slice(0, 8))}</section>` : ''}
    </div>`;
  el.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { f[s.dataset.f] = s.value; saveFilters(); rakipanalizView(el); });
  el.querySelector('[data-tamam]')?.addEventListener('click', async () => (await import('../kayip.js')).kayipTamamla(f.yil === 'Tümü' ? null : f.yil, () => rakipanalizView(el)));
  el.querySelectorAll('tr[data-m]').forEach(tr => { const ac = () => rakipDetay(a.rakipler.find(x => x.m === tr.dataset.m)); tr.onclick = ac; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } }; });
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`kayip-rakip-${today()}.xlsx`, {
    'Rakipler': a.rakipler.map(x => ({ 'Rakip': x.m, 'Kaybedilen proje': x.kayip.length, 'Kaybedilen tutar (USD)': Math.round(x.usd), 'Kazanılan proje': x.kazan.length, 'Rakibin kazanma payı %': x.oran == null ? '' : Math.round(100 - x.oran), 'En sık neden': x.enNeden || '', 'Ortalama fiyat farkı %': x.ortFark == null ? '' : Math.round(x.ortFark) })),
    'Kayıplar': a.kayip.map(p => ({ 'Proje': p.ad, 'İl': p.il, 'Sektör': p.sektor, 'İşi alan marka': p.rakip_marka, 'Neden': p.kayip_nedeni, 'Bizim teklif (USD)': p.bizim_teklif_usd, 'Rakip toplam (USD)': p.rakip_toplam_usd, 'Açıklama': p.kayip_aciklama })),
  });
}

function rakipDetay(x) {
  if (!x) return;
  const satir = (p, tur) => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${esc([p.il, p.sektor, tur === 'kayip' ? p.kayip_nedeni : null, tutar(p) ? usd(tutar(p)) : null].filter(Boolean).join(' · '))}${tur === 'kayip' && +p.bizim_teklif_usd > 0 && +p.rakip_toplam_usd > 0 ? ' · rakip ' + farkYaz((p.bizim_teklif_usd - p.rakip_toplam_usd) / p.bizim_teklif_usd * 100) : ''}</span>${p.kayip_aciklama ? `<small>${esc(p.kayip_aciklama)}</small>` : ''}</a></li>`;
  openDrawer(`<header class="dh"><div><p class="muted">Rakip</p><h2 id="drawer-title">${esc(x.m)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><div class="ledger-mini"><div><b>${x.kayip.length}</b><span>kaybettik · ${usd(x.usd)}</span></div><div><b>${x.kazan.length}</b><span>kazandık</span></div><div><b>${farkYaz(x.ortFark)}</b><span>ortalama fiyatı</span></div></div>
    ${Object.keys(x.neden).length ? `<p class="hint">Nedenler: ${Object.entries(x.neden).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</p>` : ''}
    <h3>Kaybettiğimiz projeler</h3>${x.kayip.length ? `<ul class="list">${x.kayip.map(p => satir(p, 'kayip')).join('')}</ul>` : '<p class="hint">Yok.</p>'}
    <h3>Bu rakibe karşı kazandıklarımız</h3>${x.kazan.length ? `<ul class="list">${x.kazan.map(p => satir(p, 'kazan')).join('')}</ul>` : '<p class="hint">Kayıt yok. Kazandığın bir projede rakibin fiyatını Ürünler → Rakip fiyatları ekranında projeye bağlarsan burada görünür.</p>'}</div>`);
}
