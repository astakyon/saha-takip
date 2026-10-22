// Sanayi bölgeleri: haritada çizilen sınırlar, gruplar, bölgedeki projeler
import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, pill, ILLER, BOLGE_TIPLERI, BOLGE_RENKLERI, ACIK, toast, openDrawer, closeDrawer, confirmBox, fold, match, exportXlsx, today } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { toMulti, inMulti, OSB_MERKEZ } from '../geo.js';
import { go } from '../main.js';

const hash = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
export const bolgeRenk = b => b.renk || BOLGE_RENKLERI[hash(b.grup || b.ad) % BOLGE_RENKLERI.length];

export function bolgeProjeleri(b) {
  const m = toMulti(b.geojson);
  return S.projeler.filter(p => p.bolge_id === b.id || (p.osb && fold(p.osb) === fold(b.ad)) || (m && p.lat != null && !p.konum_yaklasik && inMulti(p.lng, p.lat, m)));
}

// Sınır içindeki kesin konumlu projelere bölgeyi yazar
export async function bolgeyeAta(b) {
  const m = toMulti(b.geojson); if (!m) return 0;
  let n = 0;
  for (const t of ['projeler', 'firmalar']) for (const r of S[t]) {
    if (r.lat == null || r.konum_yaklasik || !inMulti(r.lng, r.lat, m)) continue;
    if (r.bolge_id === b.id && r.osb === b.ad) continue;
    await app.db.save(t, { ...r, bolge_id: b.id, osb: b.ad }); n++;
  }
  return n;
}

const FORM = [{ title: 'Bölge', fields: [
  { k: 'ad', l: 'Bölge adı', auto: true, full: true, ph: 'Örn. Adana Hacı Sabancı OSB' },
  { k: 'tip', l: 'Tip', t: 'sel', opts: BOLGE_TIPLERI },
  { k: 'grup', l: 'Grup', t: 'combo', opts: () => [...new Set(S.bolgeler.map(b => b.grup).filter(Boolean))], help: 'Bölgeleri gruplamak için: örn. “Tarsus hattı”, “Ceyhan–Yumurtalık”' },
  { k: 'il', l: 'İl', t: 'sel', opts: [...ILLER, 'Diğer'] },
  { k: 'ilce', l: 'İlçe' },
  { k: 'renk', l: 'Renk', t: 'sel', opts: [{ v: '', l: 'Gruba göre otomatik' }, ...BOLGE_RENKLERI.map((c, i) => ({ v: c, l: ['Mavi', 'Turuncu', 'Yeşil', 'Mor', 'Kırmızı', 'Camgöbeği', 'Hardal', 'Pembe'][i] }))] },
  { k: 'notlar', l: 'Notlar', t: 'area' },
]}];

export function bolgeForm(init = {}, after) {
  const b0 = init.id ? (S.bolgeler.find(x => x.id === init.id) || init) : { id: uuid(), tip: 'OSB', ...init, _new: true };
  const b = { ...b0, ...init };
  const panel = openDrawer(`<header class="dh" style="--c:${bolgeRenk(b)}"><div><p class="muted">${b._new ? 'Yeni bölge' : 'Bölge'}</p><h2 id="drawer-title">${esc(b.ad || 'Yeni bölge')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${b._new ? '' : `<div class="dh-actions"><button class="btn sm" data-a="ciz">${b.geojson ? 'Sınırı yeniden çiz' : 'Haritada sınır çiz'}</button><button class="btn sm ghost danger" data-a="sil">Sil</button></div>`}
    <form class="dbody form" novalidate>${renderForm(FORM, b)}
    <p class="hint">${b.geojson ? 'Sınır çizildi. Kaydedince içinde kalan projelere bu bölge otomatik yazılır.' : 'Sınır henüz çizilmedi. Kaydettikten sonra “Haritada sınır çiz” ile işaretleyebilirsin.'}</p>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, FORM, b);
  panel.querySelectorAll('[data-a]').forEach(x => x.onclick = async () => {
    if (x.dataset.a === 'ciz') { closeDrawer(); app.pendingDraw = b; go('#/harita'); }
    if (x.dataset.a === 'sil' && confirmBox(`“${b.ad}” bölgesi silinsin mi? Projeler silinmez, yalnızca bölge bağlantısı kalkar.`)) {
      for (const p of S.projeler.filter(p => p.bolge_id === b.id)) await app.db.save('projeler', { ...p, bolge_id: null });
      await app.db.del('bolgeler', b.id); toast('Bölge silindi.'); closeDrawer(); after ? after() : app.refresh();
    }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, FORM, b);
      if (!o.ad) return toast('Bölge adını yaz.', 'err');
      o.renk = o.renk || null;
      await app.db.save('bolgeler', o);
      const n = await bolgeyeAta(o);
      toast(`${o.ad} kaydedildi.${n ? ` ${n} kayda bölge yazıldı.` : ''}`);
      closeDrawer(); after ? after() : app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

export function bolgelerView(el) {
  const f = F('bolgeler', { q: '', il: 'Tümü' });
  el.innerHTML = `<header class="vh"><div><h1>Sanayi bölgeleri</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn primary" data-otomatik>OSB'leri otomatik getir</button><button class="btn ghost" data-osb>Bilinen OSB'leri listeye ekle</button><button class="btn ghost" data-new>Haritada bölge çiz</button><button class="btn ghost" data-xls>Excel</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Bölge, grup ara" value="${esc(f.q)}" aria-label="Bölgelerde ara">
      <div class="frow"><label>İl <select data-il>${['Tümü', ...ILLER].map(x => `<option ${f.il === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div></div>
    <div data-rows></div>`;
  const draw = () => {
    const list = S.bolgeler.filter(b => (f.il === 'Tümü' || b.il === f.il) && match(f.q, b.ad, b.grup, b.ilce));
    el.querySelector('[data-sum]').textContent = `${list.length} bölge · ${new Set(list.map(b => b.grup).filter(Boolean)).size} grup · ${list.filter(b => !b.geojson).length} bölgenin sınırı çizilmedi`;
    const groups = {}; for (const b of list) (groups[b.grup || 'Grupsuz'] ||= []).push(b);
    el.querySelector('[data-rows]').innerHTML = list.length ? Object.entries(groups).sort((a, b) => a[0] === 'Grupsuz' ? 1 : b[0] === 'Grupsuz' ? -1 : a[0].localeCompare(b[0], 'tr')).map(([g, bs]) => {
      const all = bs.flatMap(bolgeProjeleri), acik = all.filter(p => ACIK.includes(p.durum));
      return `<section class="grp"><h2>${esc(g)} <span class="muted">${bs.length} bölge · ${all.length} proje · açık potansiyel ${usd(acik.reduce((s, p) => s + (+p.tutar_usd || 0), 0))}</span></h2>
      <table class="tbl"><thead><tr><th>Bölge</th><th>Tip</th><th>Yer</th><th class="r">Proje</th><th class="r">Açık potansiyel</th><th class="r">Sipariş</th><th></th></tr></thead><tbody>${bs.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(b => {
        const ps = bolgeProjeleri(b), ac = ps.filter(p => ACIK.includes(p.durum));
        return `<tr><td><span class="dot" style="--c:${bolgeRenk(b)};display:inline-block;margin-right:6px"></span><b>${esc(b.ad)}</b>${b.geojson ? '' : '<small class="muted">Sınır çizilmedi</small>'}</td><td>${esc(b.tip || '')}</td><td>${esc([b.ilce, b.il].filter(Boolean).join(', '))}</td>
          <td class="r">${ps.length}</td><td class="r">${usd(ac.reduce((s, p) => s + (+p.tutar_usd || 0), 0))}</td><td class="r">${ps.filter(p => p.durum === 'Sipariş').length}</td>
          <td class="r nowrap"><button type="button" class="btn sm ghost" data-map="${b.id}">${b.geojson ? 'Haritada' : 'Çiz'}</button> <button type="button" class="btn sm ghost" data-ps="${b.id}">Projeler</button> <button type="button" class="btn sm ghost" data-ed="${b.id}">Düzenle</button></td></tr>`;
      }).join('')}</tbody></table></section>`;
    }).join('') : `<div class="empty"><p>Henüz bölge yok. “Haritada bölge çiz” ile bir OSB'nin sınırını köşelerine dokunarak çiz, ya da bilinen OSB'leri listeye ekleyip sonra sınırlarını çiz.</p></div>`;
    const byid = id => S.bolgeler.find(b => b.id === id);
    el.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => bolgeForm(byid(x.dataset.ed)));
    el.querySelectorAll('[data-map]').forEach(x => x.onclick = () => {
      const b = byid(x.dataset.map), m = toMulti(b.geojson);
      if (m) { app.mapFocus = { bounds: m[0][0].map(([lng, lat]) => [lat, lng]) }; go('#/harita'); }
      else { app.pendingDraw = b; const o = OSB_MERKEZ.find(o => o[0] === b.ad); if (o) app.mapFocus = { c: [o[2], o[3]], z: 15 }; go('#/harita'); }
    });
    el.querySelectorAll('[data-ps]').forEach(x => x.onclick = () => { const b = byid(x.dataset.ps); app.filters.projeler = { ...(app.filters.projeler || {}), q: b.ad, yil: 'Tümü', durumlar: [] }; saveFilters(); go('#/projeler'); });
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelector('[data-il]').onchange = e => { f.il = e.target.value; saveFilters(); draw(); };
  el.querySelector('[data-new]').onclick = () => { app.pendingDraw = {}; go('#/harita'); };
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`sanayi-bolgeleri-${today()}.xlsx`, { 'Bölgeler': S.bolgeler.map(b => { const ps = bolgeProjeleri(b); return { 'Bölge': b.ad, 'Tip': b.tip, 'Grup': b.grup, 'İl': b.il, 'İlçe': b.ilce, 'Proje': ps.length, 'Açık potansiyel (USD)': ps.filter(p => ACIK.includes(p.durum)).reduce((s, p) => s + (+p.tutar_usd || 0), 0), 'Sipariş alınan proje': ps.filter(p => p.durum === 'Sipariş').length, 'Sınır çizili': b.geojson ? 'Evet' : 'Hayır', 'Not': b.notlar }; }) });
  el.querySelector('[data-otomatik]').onclick = async () => { const { osbPaneli } = await import('../osm-bolge.js'); osbPaneli(draw); };
  el.querySelector('[data-osb]').onclick = async () => {
    const yeni = OSB_MERKEZ.filter(o => !S.bolgeler.some(b => fold(b.ad) === fold(o[0])));
    if (!yeni.length) return toast('Bilinen OSB\'lerin hepsi zaten listede.');
    try {
      for (const [ad, il] of yeni) await app.db.save('bolgeler', { ad, il, tip: /serbest/i.test(ad) ? 'Serbest bölge' : /sanayi sitesi/i.test(ad) ? 'Sanayi sitesi' : /havalimanı/i.test(ad) ? 'Diğer' : 'OSB', grup: il });
      toast(`${yeni.length} bölge eklendi. Sınırlarını “Çiz” ile işaretleyebilirsin.`); draw();
    } catch (e) { toast(e.message, 'err'); }
  };
  draw();
}
