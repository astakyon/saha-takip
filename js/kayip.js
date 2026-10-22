// Kayıp satış: eksik rakip/neden bilgisini hızlı tamamlama ve analiz
import { S } from './db.js';
import { app } from './state.js';
import { esc, usd, num, byId, toast, openDrawer, closeDrawer, RAKIPLER, KAYIP_NEDENLERI } from './ui.js';

const tutar = p => +p.bizim_teklif_usd || +p.tutar_usd || 0;
export const kayiplar = Y => S.projeler.filter(p => p.durum === 'Kayıp' && (!Y || !p.takip_yili || +p.takip_yili === +Y));
const markalar = () => [...new Set([...RAKIPLER, ...S.projeler.map(p => p.rakip_marka).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'tr'));

export function kayipOzet(Y) {
  const l = kayiplar(Y);
  const grup = f => { const o = {}; for (const p of l) { const k = f(p) || 'Belirtilmemiş'; (o[k] ||= { n: 0, usd: 0 }); o[k].n++; o[k].usd += tutar(p); } return Object.entries(o).sort((a, b) => (a[0] === 'Belirtilmemiş') - (b[0] === 'Belirtilmemiş') || b[1].usd - a[1].usd); };
  return { l, toplam: l.reduce((a, p) => a + tutar(p), 0), markaVar: l.filter(p => p.rakip_marka).length, nedenVar: l.filter(p => p.kayip_nedeni).length,
    marka: grup(p => p.rakip_marka), neden: grup(p => p.kayip_nedeni), il: grup(p => p.il) };
}
const bars = (g, renk) => { const m = Math.max(...g.map(([, v]) => v.usd), 1); return `<ul class="hbars k-bars">${g.slice(0, 8).map(([k, v]) => `<li><span title="${esc(k)}">${esc(k)}</span><span class="hb"><i style="width:${v.usd / m * 100}%;--c:${k === 'Belirtilmemiş' ? '#CBD3D9' : renk}"></i></span><b>${v.n}</b><small>${usd(v.usd)}</small></li>`).join('')}</ul>`; };

// Panel kartı
export function kayipKarti(Y) {
  const o = kayipOzet(Y);
  if (!o.l.length) return `<section class="card wide"><h2>Kayıp analizi (${Y})</h2><p class="hint">Bu yıl kayıp proje yok.</p></section>`;
  const eksik = o.l.filter(p => !p.rakip_marka || !p.kayip_nedeni).length;
  return `<section class="card wide" data-kayip><div class="card-h"><h2>Kayıp analizi (${Y}) <span class="muted">${o.l.length} proje · ${usd(o.toplam)}</span></h2>${eksik ? `<button type="button" class="btn sm primary" data-kayiptamam>Eksikleri tamamla (${eksik})</button>` : ''}</div>
    <p class="${o.markaVar < o.l.length * 0.7 ? 'warn' : 'hint'}">${o.l.length} kayıptan ${o.markaVar} tanesinde işi alan marka, ${o.nedenVar} tanesinde kayıp nedeni girili.${o.markaVar < o.l.length * 0.7 ? ' Bilgi eksik olduğu için aşağıdaki dağılım yanıltıcı olabilir; “Eksikleri tamamla” ile birkaç dakikada doldurabilirsin.' : ''}</p>
    <div class="k-grid"><div><h3>İşi alan marka</h3>${bars(o.marka, 'var(--ink)')}</div><div><h3>Neden</h3>${bars(o.neden, '#C2410C')}</div><div><h3>İl</h3>${bars(o.il, '#2563EB')}</div></div>
    <p class="hint">Tutar: bizim teklifimiz, yoksa proje tutarı (USD). Çubuk uzunluğu tutara göre; sayı proje adedi.</p></section>`;
}

// Eksik kayıp bilgisini tamamlama paneli
export function kayipTamamla(Y, sonra) {
  const l = kayiplar(Y).sort((a, b) => (!!(a.rakip_marka && a.kayip_nedeni)) - (!!(b.rakip_marka && b.kayip_nedeni)) || tutar(b) - tutar(a));
  const p = openDrawer(`<header class="dh"><div><p class="muted">${l.length} kayıp proje${Y ? ' · ' + Y : ''}</p><h2 id="drawer-title">Kayıp bilgisini tamamla</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="hint">Her satırda seçtiğin anda kaydedilir. Bilmediğini boş bırak.</p>
    <datalist id="dl-kmarka">${markalar().map(m => `<option value="${esc(m)}">`).join('')}</datalist>
    <ul class="list k-list">${l.map(x => `<li data-id="${x.id}" class="${x.rakip_marka && x.kayip_nedeni ? 'tamam' : ''}"><div class="k-ad"><a href="#/proje/${x.id}"><b>${esc(x.ad)}</b></a><small class="muted">${esc([x.il, usd(tutar(x))].filter(Boolean).join(' · '))}</small></div>
      <div class="k-sec"><input list="dl-kmarka" data-f="rakip_marka" value="${esc(x.rakip_marka || '')}" placeholder="İşi alan marka" aria-label="${esc(x.ad)}: işi alan marka">
      <select data-f="kayip_nedeni" aria-label="${esc(x.ad)}: kayıp nedeni"><option value="">Neden?</option>${KAYIP_NEDENLERI.map(n => `<option ${n === x.kayip_nedeni ? 'selected' : ''}>${n}</option>`).join('')}</select></div></li>`).join('')}</ul></div>
    <div class="dfoot sticky"><button type="button" class="btn primary" data-close>Bitti</button></div>`, { wide: true, onClose: () => sonra && sonra() });
  let n = 0;
  p.querySelectorAll('[data-f]').forEach(i => i.addEventListener('change', async () => {
    const li = i.closest('li'), x = byId('projeler', li.dataset.id); if (!x) return;
    const v = i.value.trim() || null; if ((x[i.dataset.f] || null) === v) return;
    try { const y = await app.db.save('projeler', { ...x, [i.dataset.f]: v }); li.classList.toggle('tamam', !!(y.rakip_marka && y.kayip_nedeni)); n++; toast(`Kaydedildi (${n})`); }
    catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  }));
}

// Proje Kayıp'a çekildiğinde tek projelik soru
export function kayipSor(x, sonra) {
  if (!x || (x.rakip_marka && x.kayip_nedeni)) return;
  const p = openDrawer(`<header class="dh" style="--c:#C2410C"><div><p class="muted">Kayıp olarak işaretlendi</p><h2 id="drawer-title">${esc(x.ad)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form"><datalist id="dl-kmarka">${markalar().map(m => `<option value="${esc(m)}">`).join('')}</datalist>
      <div class="grid"><div class="fld"><label for="ks-m">İşi alan marka</label><input id="ks-m" list="dl-kmarka" value="${esc(x.rakip_marka || '')}" autofocus></div>
      <div class="fld"><label for="ks-n">Kayıp nedeni</label><select id="ks-n"><option value="">Seç</option>${KAYIP_NEDENLERI.map(n => `<option ${n === x.kayip_nedeni ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="fld"><label for="ks-t">Rakibin toplam fiyatı (USD)</label><input id="ks-t" type="number" inputmode="decimal" step="any" value="${x.rakip_toplam_usd ?? ''}"></div>
      <div class="fld full"><label for="ks-a">Açıklama</label><input id="ks-a" value="${esc(x.kayip_aciklama || '')}" placeholder="Örn. %12 daha ucuz verdiler, şartname değişti"></div></div>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Sonra</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  p.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const v = id => p.querySelector(id).value.trim() || null;
    await app.db.save('projeler', { ...byId('projeler', x.id), rakip_marka: v('#ks-m'), kayip_nedeni: v('#ks-n'), rakip_toplam_usd: v('#ks-t') ? +v('#ks-t') : null, kayip_aciklama: v('#ks-a') });
    toast('Kayıp bilgisi kaydedildi.'); closeDrawer(); sonra && sonra();
  };
}
