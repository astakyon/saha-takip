import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, fold, tarih, today, ZIYARET_AMAC, ZIYARET_DURUM, SONUC_TIPLERI, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, exportXlsx, silGeriAl } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';

export const zDurum = z => z.durum || 'Yapıldı';
const durumRenk = d => (ZIYARET_DURUM.find(x => x.k === d) || ZIYARET_DURUM[1]).c;
const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const monday = s => { const d = new Date(s + 'T00:00'); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); };
const weekNo = s => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const y = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - y) / 864e5 - 3 + (y.getDay() + 6) % 7) / 7); };

const ZIYARET_FORM = [
  { title: 'Ziyaret', fields: [
    { k: 'durum', l: 'Durum', t: 'sel', opts: ZIYARET_DURUM.map(d => d.k), ph: 'Seç' },
    { k: 'amac', l: 'Amaç', t: 'sel', opts: ZIYARET_AMAC, ph: 'Seç' },
    { k: 'tarih', l: 'Tarih', t: 'date' },
    { k: 'saat', l: 'Saat', t: 'time' },
    { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar', ph: 'Firma adı' },
    { k: 'kisi_id', l: 'Görüşülen kişi (firma yetkilisi)', t: 'ref', ref: 'kisiler', ph: 'Firma seçince yetkilisi gelir; yeni ise adını yaz' },
    { k: 'proje_id', l: 'İlgili proje', t: 'ref', ref: 'projeler', full: true },
    { k: 'notlar', l: 'Ziyaret notu / gündem', t: 'area', rows: 4, full: true },
  ]},
  { id: 'sonuc', title: 'Ziyaret sonucu', show: o => (o.durum || 'Yapıldı') === 'Yapıldı', fields: [
    { k: 'sonuc_tipi', l: 'Sonuç', t: 'sel', opts: SONUC_TIPLERI },
    { k: 'sonuc', l: 'Sonuç notu', full: true, ph: 'Örn. teklif revize istendi, karar kasım sonunda' },
    { k: 'sonraki', l: 'Sonraki adım (görev olarak eklenir)', full: true, ph: 'Örn. HBL teklifini revize et' },
    { k: 'sonraki_tarih', l: 'Sonraki adım tarihi', t: 'date' },
    { k: 'sonraki_ziyaret', l: 'Takip ziyareti planla', t: 'date', help: 'Tarih seçersen bu firmaya yeni bir planlı ziyaret eklenir' },
  ]},
  { title: 'Konum ve fotoğraf', fields: [
    { k: 'loc', l: 'Ziyaret konumu', t: 'loc' },
    { k: 'fotolar', l: 'Fotoğraflar', t: 'photos' },
  ]},
];

// Firma seçilince yetkilisini getir; kişi listesini o firmanın çalışanlarıyla sınırla
export function firmaYetkilileri(firmaId) {
  if (!firmaId) return [];
  const ks = S.kisiler.filter(k => k.firma_id === firmaId);
  const son = new Map();
  for (const z of S.ziyaretler) if (z.firma_id === firmaId && z.kisi_id && (!son.has(z.kisi_id) || z.tarih > son.get(z.kisi_id))) son.set(z.kisi_id, z.tarih);
  const rolSira = r => ['Karar verici', 'Satınalma', 'Teknik', 'Etkileyici', 'Saha'].indexOf(r) + 1 || 9;
  return ks.sort((a, b) => (son.get(b.id) || '').localeCompare(son.get(a.id) || '') || rolSira(a.rol) - rolSira(b.rol) || a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
}
function yetkiliBagla(form) {
  const fi = form.querySelector('[name=firma_id]'), ki = form.querySelector('[name=kisi_id]');
  if (!fi || !ki) return;
  const dl = document.createElement('datalist'); dl.id = 'dl-yetkili-' + Math.random().toString(36).slice(2); form.appendChild(dl);
  const box = document.createElement('div'); box.className = 'yetkili'; ki.closest('.fld').appendChild(box);
  const firmaBul = () => { const v = fold(fi.value.trim()); return v ? S.firmalar.find(x => fold(x.ad) === v) : null; };
  let oto = false, sonFirma;
  const yenile = (doldur) => {
    const f = firmaBul(), ks = f ? firmaYetkilileri(f.id) : [];
    if (doldur && (f?.id || null) === sonFirma) return;   // aynı firma: seçimi bozma
    sonFirma = f?.id || null;
    dl.innerHTML = [...ks, ...S.kisiler.filter(k => !ks.includes(k))].map(k => `<option value="${esc(k.ad_soyad)}">${esc(firmaAd(k.firma_id) || '')}</option>`).join('');
    ki.setAttribute('list', dl.id);
    box.innerHTML = f ? (ks.length ? `<span class="muted">${esc(f.ad)} yetkilileri:</span> ${ks.slice(0, 6).map(k => `<button type="button" class="chip-s ${fold(ki.value) === fold(k.ad_soyad) ? 'on' : ''}" data-k="${esc(k.ad_soyad)}">${esc(k.ad_soyad)}${k.unvan ? ` <i>${esc(k.unvan)}</i>` : ''}</button>`).join('')}`
      : `<span class="muted">${esc(f.ad)} için kayıtlı yetkili yok. Adını yazarsan bu firmaya eklenir.</span>`) : '';
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { ki.value = b.dataset.k; oto = false; yenile(false); });
    if (!doldur || !f) return;
    const cur = fold(ki.value.trim());
    const curK = cur && S.kisiler.find(k => fold(k.ad_soyad) === cur);
    if (ks.length && (!cur || oto || (curK && curK.firma_id && curK.firma_id !== f.id))) { ki.value = ks[0].ad_soyad; oto = true; yenile(false); }
  };
  fi.addEventListener('change', () => yenile(true));
  fi.addEventListener('input', () => { if (firmaBul()) yenile(true); });
  ki.addEventListener('input', () => { oto = false; });
  ki.addEventListener('change', () => {
    if (fi.value.trim()) return yenile(false);
    const k = S.kisiler.find(x => fold(x.ad_soyad) === fold(ki.value.trim()));
    if (k?.firma_id) { fi.value = firmaAd(k.firma_id); yenile(false); }
  });
  yenile(!ki.value);
}

export function ziyaretForm(init = {}, after) {
  const z0 = init.id ? byId('ziyaretler', init.id) || init : { id: uuid(), tarih: today(), durum: 'Yapıldı', fotolar: [], ...init, _new: true };
  const z = { ...z0, durum: zDurum(z0) };
  const panel = openDrawer(`<header class="dh" style="--c:${durumRenk(z.durum)}"><div><p class="muted">${z._new ? 'Yeni ziyaret' : `${tarih(z.tarih)}${z.saat ? ' · ' + esc(z.saat) : ''} · ${esc(z.durum)}`}</p><h2 id="drawer-title">${esc(firmaAd(z.firma_id) || 'Ziyaret kaydı')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${z._new ? '' : `<div class="dh-actions">${z.durum === 'Planlandı' ? '<button class="btn sm primary" data-done>Yapıldı olarak işaretle</button>' : ''}<button class="btn sm ghost danger" data-sil>Sil</button></div>`}
    <form class="dbody form" novalidate>${renderForm(ZIYARET_FORM, z)}
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`, { onClose: () => {} });
  const form = panel.querySelector('form');
  bindForm(form, ZIYARET_FORM, z);
  yetkiliBagla(form);
  // Yapılan yeni ziyarette konumu otomatik al
  const autoLoc = () => { const b = form.querySelector('[data-loc]'); if (b && !b.dataset.lat) b.querySelector('[data-loc-me]').click(); };
  if (z._new && z.lat == null && z.durum === 'Yapıldı' && (!z.tarih || z.tarih === today())) setTimeout(autoLoc, 300);
  panel.querySelector('[data-done]')?.addEventListener('click', () => {
    const s = form.querySelector('[name=durum]'); s.value = 'Yapıldı'; form.querySelector('[name=tarih]').value = form.querySelector('[name=tarih]').value || today();
    form.dispatchEvent(new Event('change')); autoLoc();
    form.querySelector('[data-show="sonuc"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => form.querySelector('[name=sonuc_tipi]')?.focus(), 400);
  });
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { closeDrawer(); await silGeriAl('ziyaretler', z0, 'Ziyaret', () => after ? after() : app.refresh()); });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, ZIYARET_FORM, z);
      if (!o.firma_id && !o.notlar) return toast('Firma veya not gir.', 'err');
      if (o.kisi_id && o.firma_id) { const k = byId('kisiler', o.kisi_id); if (k && !k.firma_id) await app.db.save('kisiler', { ...k, firma_id: o.firma_id }); }
      o.tarih = o.tarih || today(); o.durum = o.durum || 'Yapıldı';
      await app.db.save('ziyaretler', o);
      const extra = [];
      if (o.durum === 'Yapıldı' && o.sonraki) { await app.db.save('gorevler', { baslik: o.sonraki, son_tarih: o.sonraki_tarih, durum: 'Açık', oncelik: 'Normal', firma_id: o.firma_id, proje_id: o.proje_id, kisi_id: o.kisi_id }); extra.push('sonraki adım görevlere eklendi'); }
      if (o.durum === 'Yapıldı' && o.sonraki_ziyaret) { await app.db.save('ziyaretler', { tarih: o.sonraki_ziyaret, durum: 'Planlandı', firma_id: o.firma_id, kisi_id: o.kisi_id, proje_id: o.proje_id, amac: 'Proje takibi', notlar: o.sonraki || null, fotolar: [] }); extra.push('takip ziyareti takvime eklendi'); }
      toast(`Ziyaret kaydedildi${extra.length ? ': ' + extra.join(', ') : ''}.`);
      closeDrawer(); after ? after() : app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

// ---------- Ziyaret listesi ----------
export function ziyaretlerView(el) {
  const f = F('ziyaretler', { q: '', ay: 'Tümü', durum: 'Tümü' });
  const aylar = [...new Set(S.ziyaretler.map(z => z.tarih.slice(0, 7)))].sort().reverse();
  el.innerHTML = `<header class="vh"><div><h1>Ziyaretler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><a class="btn ghost" href="#/takvim">Haftalık takvim</a><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Ziyaret kaydet</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Firma, kişi, not, sonuç ara" value="${esc(f.q)}" aria-label="Ziyaretlerde ara">
      <div class="seg" role="group">${['Tümü', ...ZIYARET_DURUM.map(d => d.k)].map(x => `<button type="button" data-d="${x}" class="${f.durum === x ? 'on' : ''}">${x === 'Planlandı' ? 'Planlanan' : x === 'Yapıldı' ? 'Yapılan' : x}</button>`).join('')}</div>
      <div class="frow"><label>Ay <select data-ay>${['Tümü', ...aylar].map(a => `<option value="${a}" ${f.ay === a ? 'selected' : ''}>${a === 'Tümü' ? 'Tümü' : new Date(a + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></label></div></div>
    <div class="timeline" data-rows></div>`;
  const list = () => S.ziyaretler.filter(z => (f.ay === 'Tümü' || z.tarih.startsWith(f.ay)) && (f.durum === 'Tümü' || zDurum(z) === f.durum) && match(f.q, firmaAd(z.firma_id), byId('kisiler', z.kisi_id)?.ad_soyad, z.notlar, z.sonuc, z.sonuc_tipi, byId('projeler', z.proje_id)?.ad, z.amac))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || (b.saat || '').localeCompare(a.saat || ''));
  const draw = () => {
    const l = list(); el.querySelector('[data-sum]').textContent = `${l.length} ziyaret · ${S.ziyaretler.filter(z => zDurum(z) === 'Planlandı' && z.tarih >= today()).length} planlı ziyaret bekliyor`;
    let last = '';
    el.querySelector('[data-rows]').innerHTML = l.length ? l.map(z => {
      const d = z.tarih !== last ? `<h3 class="tl-day">${new Date(z.tarih + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>` : ''; last = z.tarih;
      return d + ziyaretKart(z);
    }).join('') : '<div class="empty"><p>Ziyaret kaydı yok. Sahadayken “Ziyaret kaydet” ile firma, kişi ve notu gir; konum otomatik eklenir.</p></div>';
    el.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelector('[data-ay]').onchange = e => { f.ay = e.target.value; saveFilters(); draw(); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => ziyaretForm({});
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`ziyaretler-${today()}.xlsx`, { 'Ziyaretler': list().map(z => ({ 'Tarih': z.tarih, 'Saat': z.saat, 'Durum': zDurum(z), 'Firma': firmaAd(z.firma_id), 'Kişi': byId('kisiler', z.kisi_id)?.ad_soyad, 'Proje': byId('projeler', z.proje_id)?.ad, 'Amaç': z.amac, 'Not': z.notlar, 'Sonuç': z.sonuc_tipi, 'Sonuç notu': z.sonuc, 'Enlem': z.lat, 'Boylam': z.lng })) });
  draw();
}

function ziyaretKart(z, compact) {
  const k = byId('kisiler', z.kisi_id), p = byId('projeler', z.proje_id), d = zDurum(z);
  return `<button type="button" class="tl-item ${compact ? 'compact' : ''} z-${d === 'Planlandı' ? 'plan' : d === 'İptal' ? 'iptal' : 'done'}" data-zid="${z.id}" style="--c:${durumRenk(d)}">
    <span class="tl-top">${z.saat ? `<span class="tl-time">${esc(z.saat)}</span>` : ''}<b>${esc(firmaAd(z.firma_id) || 'Firma belirtilmedi')}</b>${k ? `<span class="muted"> · ${esc(k.ad_soyad)}</span>` : ''}</span>
    <span class="tl-tags"><span class="tag-s" style="--c:${durumRenk(d)}">${esc(d)}</span>${z.amac ? `<span class="tag-s">${esc(z.amac)}</span>` : ''}${z.sonuc_tipi ? `<span class="tag-s res">${esc(z.sonuc_tipi)}</span>` : ''}</span>
    ${p ? `<span class="tl-proj">${esc(p.ad)}</span>` : ''}
    ${z.notlar && !compact ? `<p>${esc(z.notlar)}</p>` : ''}${z.sonuc ? `<p class="tl-res">${esc(z.sonuc)}</p>` : ''}
    ${(z.fotolar || []).length && !compact ? `<small class="muted">${z.fotolar.length} fotoğraf</small>` : ''}</button>`;
}

// ---------- Haftalık takvim ----------
export function takvimView(el) {
  const f = F('takvim', { hafta: monday(today()) });
  const start = f.hafta, days = [...Array(7)].map((_, i) => addDays(start, i)), end = days[6], t = today();
  const zs = S.ziyaretler.filter(z => z.tarih >= start && z.tarih <= end);
  const gs = S.gorevler.filter(g => g.son_tarih && g.son_tarih >= start && g.son_tarih <= end);
  const geciken = S.ziyaretler.filter(z => zDurum(z) === 'Planlandı' && z.tarih < t);
  const fmt = (d, o) => new Date(d + 'T00:00').toLocaleDateString('tr-TR', o);
  const sonuc = {}; for (const z of zs.filter(z => zDurum(z) === 'Yapıldı' && z.sonuc_tipi)) sonuc[z.sonuc_tipi] = (sonuc[z.sonuc_tipi] || 0) + 1;
  el.innerHTML = `<header class="vh"><div><h1>Ziyaret takvimi</h1><p class="sum">${weekNo(start)}. hafta · ${fmt(start, { day: 'numeric', month: 'long' })} – ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    <div class="vh-act"><button class="btn ghost" data-w="-7" aria-label="Önceki hafta">‹ Önceki</button><button class="btn ghost" data-w="0">Bu hafta</button><button class="btn ghost" data-w="7" aria-label="Sonraki hafta">Sonraki ›</button><button class="btn primary" data-new>Ziyaret planla</button></div></header>
    <section class="week-sum"><span><b>${zs.filter(z => zDurum(z) === 'Planlandı').length}</b> planlı</span><span><b>${zs.filter(z => zDurum(z) === 'Yapıldı').length}</b> yapıldı</span><span><b>${zs.filter(z => zDurum(z) === 'İptal').length}</b> iptal</span><span><b>${gs.filter(g => g.durum !== 'Tamam').length}</b> görev</span>
      ${Object.keys(sonuc).length ? `<span class="muted">Sonuçlar: ${Object.entries(sonuc).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}</span>` : ''}</section>
    ${geciken.length ? `<div class="warn">Tarihi geçmiş ${geciken.length} planlı ziyaret var: ${geciken.slice(0, 4).map(z => `<button type="button" class="linkbtn" data-zid="${z.id}">${esc(firmaAd(z.firma_id) || 'Ziyaret')} (${fmt(z.tarih, { day: 'numeric', month: 'short' })})</button>`).join(', ')}${geciken.length > 4 ? '…' : ''}. Yapıldıysa sonucunu gir, yapılmadıysa yeni tarihe al.</div>` : ''}
    <div class="week">${days.map(d => {
      const dz = zs.filter(z => z.tarih === d).sort((a, b) => (a.saat || '99').localeCompare(b.saat || '99'));
      const dg = gs.filter(g => g.son_tarih === d);
      return `<section class="day ${d === t ? 'today' : ''} ${[5, 6].includes(days.indexOf(d)) ? 'wkend' : ''}">
        <header><b>${fmt(d, { weekday: 'long' })}</b><span>${fmt(d, { day: 'numeric', month: 'short' })}</span><button type="button" class="add" data-add="${d}" aria-label="${fmt(d, { day: 'numeric', month: 'long' })} için ziyaret planla">+</button></header>
        <div class="day-body">${dz.map(z => ziyaretKart(z, true)).join('')}
        ${dg.map(g => `<button type="button" class="task-chip ${g.durum === 'Tamam' ? 'done' : ''}" data-gid="${g.id}">${g.durum === 'Tamam' ? '✓' : '○'} ${esc(g.baslik)}</button>`).join('')}
        ${!dz.length && !dg.length ? '<p class="day-empty">Boş</p>' : ''}</div></section>`;
    }).join('')}</div>`;
  el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const n = +b.dataset.w; f.hafta = n ? addDays(f.hafta, n) : monday(today()); saveFilters(); takvimView(el); });
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => ziyaretForm({ tarih: b.dataset.add, durum: b.dataset.add < t ? 'Yapıldı' : 'Planlandı' }));
  el.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
  el.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.gid }));
  el.querySelector('[data-new]').onclick = () => ziyaretForm({ tarih: t >= start && t <= end ? t : start, durum: 'Planlandı' });
}

// ---------- Görevler ----------
const GOREV_FORM = [{ title: 'Görev', fields: [
  { k: 'baslik', l: 'Yapılacak iş', auto: true, full: true },
  { k: 'son_tarih', l: 'Son tarih', t: 'date' },
  { k: 'oncelik', l: 'Öncelik', t: 'sel', opts: ['Yüksek', 'Normal', 'Düşük'] },
  { k: 'durum', l: 'Durum', t: 'sel', opts: ['Açık', 'Tamam'] },
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar' },
  { k: 'kisi_id', l: 'Kişi', t: 'ref', ref: 'kisiler' },
  { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler' },
  { k: 'notlar', l: 'Not', t: 'area' },
  { k: 'atanan', l: 'Kime atandı', t: 'sel', ph: 'Bana', opts: () => (app.ekip || []).map(u => ({ v: u.eposta, l: (u.ad || u.eposta) + (u.yetkiler?._rol ? ' — ' + u.yetkiler._rol : '') })), show: () => (app.ekip || []).length > 0, help: 'Atadığın kişi görevi kendi Bugün ekranında görür ve tamamlar' },
]}];

export function gorevForm(init = {}, after) {
  const g0 = init.id ? byId('gorevler', init.id) : { id: uuid(), durum: 'Açık', oncelik: 'Normal', son_tarih: today(), ...init, _new: true };
  const g = { ...g0 };
  const panel = openDrawer(`<header class="dh"><h2 id="drawer-title">${g._new ? 'Yeni görev' : esc(g.baslik)}</h2><button class="x" data-close aria-label="Kapat">×</button></header>
    ${g._new ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>'}
    <form class="dbody form" novalidate>${renderForm(GOREV_FORM, g)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, GOREV_FORM, g);
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { closeDrawer(); await silGeriAl('gorevler', g0, 'Görev', () => after ? after() : app.refresh()); });
  form.onsubmit = async e => {
    e.preventDefault();
    const o = await readForm(form, GOREV_FORM, g);
    if (!o.baslik) return toast('Görevi yaz.', 'err');
    o.atanan = o.atanan || null;
    if (o.durum === 'Tamam' && g.durum !== 'Tamam') o.tamamlayan = (app.db.user?.()?.email || '').toLowerCase() || null; else if (o.durum !== 'Tamam') o.tamamlayan = null;
    await app.db.save('gorevler', o); toast('Görev kaydedildi.'); closeDrawer(); after ? after() : app.refresh();
  };
}

export function gorevlerView(el) {
  const f = F('gorevler', { goster: 'Tümü', kim: 'Herkes', gor: 'takvim', ay: today().slice(0, 7), gun: today(), ziyaret: true });
  const t = today();
  if (f._gv !== 2) { f.goster = 'Tümü'; f._gv = 2; saveFilters(); }
  if (!f.kim) f.kim = 'Herkes';
  const ben = (app.db.user?.()?.email || '').toLowerCase();
  const kimAd = e => !e ? 'Ben' : e === ben ? 'Ben' : (app.ekip || []).find(u => u.eposta === e)?.ad || e.split('@')[0];
  const kisaAd = e => kimAd(e).split(/[\s(]/)[0];
  const ekipVar = (app.ekip || []).length > 0 || S.gorevler.some(g => g.atanan);
  el.innerHTML = `<header class="vh"><div><h1>Görevler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn ghost" data-xls>Excel</button><button class="btn primary" data-new>Yeni görev</button></div></header>
    <div class="filters">
      <div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="takvim" class="${f.gor === 'takvim' ? 'on' : ''}">Takvim</button><button type="button" data-gor="liste" class="${f.gor === 'liste' ? 'on' : ''}">Liste</button></div>
      <div class="frow"><div class="seg" role="group" aria-label="Durum">${['Açık', 'Tamam', 'Tümü'].map(x => `<button type="button" data-g="${x}" class="${f.goster === x ? 'on' : ''}">${x === 'Tamam' ? 'Tamamlanan' : x}</button>`).join('')}</div>
      ${ekipVar ? `<label>Kişi <select data-kim>${['Herkes', 'Ben', ...(app.ekip || []).map(u => u.eposta), ...new Set(S.gorevler.map(g => g.atanan).filter(a => a && !(app.ekip || []).some(u => u.eposta === a)))].map(v => `<option value="${esc(v)}" ${f.kim === v ? 'selected' : ''}>${esc(v === 'Herkes' || v === 'Ben' ? v : kimAd(v))}</option>`).join('')}</select></label>` : ''}
      <label class="chk" data-zv ${f.gor === 'takvim' ? '' : 'hidden'}><input type="checkbox" data-z ${f.ziyaret ? 'checked' : ''}> <span>Planlı ziyaretleri de göster</span></label></div></div>
    <div data-body></div>`;
  const kimFilt = g => f.kim === 'Herkes' || (f.kim === 'Ben' ? !g.atanan || g.atanan === ben : g.atanan === f.kim);
  const filt = g => kimFilt(g) && (f.goster === 'Tümü' || (f.goster === 'Tamam' ? g.durum === 'Tamam' : g.durum !== 'Tamam'));
  const durumYazi = g => g.durum === 'Tamam' ? `<span class="gdur tamam">✓ Tamamlandı${g.tamamlayan ? ' · ' + esc(kimAd(g.tamamlayan)) : ''}${g.updated_at ? ' · ' + tarih(String(g.updated_at).slice(0, 10)) : ''}</span>` : geciken(g) ? '<span class="gdur gec">Gecikti</span>' : '<span class="gdur acik">Açık</span>';
  const geciken = g => g.son_tarih && g.son_tarih < t && g.durum !== 'Tamam';
  const gorevSatir = g => `<li class="${g.durum === 'Tamam' ? 'done' : ''} ${geciken(g) ? 'late' : ''} pr-${g.oncelik === 'Yüksek' ? 'hi' : g.oncelik === 'Düşük' ? 'lo' : 'n'}">
      <label class="chk"><input type="checkbox" data-done="${g.id}" ${g.durum === 'Tamam' ? 'checked' : ''} aria-label="Tamamlandı"></label>
      <button type="button" class="task-b" data-id="${g.id}"><b>${esc(g.baslik)}${g.atanan ? `<span class="atanan-r">→ ${esc(kimAd(g.atanan))}</span>` : ''}</b><small>${durumYazi(g)} · ${[g.son_tarih ? 'son tarih ' + tarih(g.son_tarih) : 'Tarihsiz', firmaAd(g.firma_id), byId('projeler', g.proje_id)?.ad, g.oncelik && g.oncelik !== 'Normal' ? g.oncelik + ' öncelik' : ''].filter(Boolean).map(esc).join(' · ')}</small></button></li>`;
  const bagla = root => {
    root.querySelectorAll('[data-id]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.id }));
    root.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
    root.querySelectorAll('[data-done]').forEach(c => c.onchange = async () => { const g = byId('gorevler', c.dataset.done); await app.db.save('gorevler', { ...g, durum: c.checked ? 'Tamam' : 'Açık', tamamlayan: c.checked ? (app.db.user?.()?.email || '').toLowerCase() || null : null }); draw(); });
  };
  const draw = () => {
    const acik = S.gorevler.filter(g => g.durum !== 'Tamam');
    el.querySelector('[data-sum]').textContent = `${acik.length} açık · ${acik.filter(geciken).length} gecikmiş · ${acik.filter(g => g.son_tarih === t).length} bugün`;
    const body = el.querySelector('[data-body]');
    if (f.gor === 'liste') {
      const l = S.gorevler.filter(filt).sort((a, b) => (a.son_tarih || '9').localeCompare(b.son_tarih || '9'));
      body.innerHTML = `<ul class="tasks">${l.length ? l.map(gorevSatir).join('') : '<li class="empty"><p>Görev yok.</p></li>'}</ul>`;
      return bagla(body);
    }
    // Aylık takvim
    const [Y, M] = f.ay.split('-').map(Number);
    const first = new Date(Y, M - 1, 1), start = new Date(first); start.setDate(1 - (first.getDay() + 6) % 7);
    const days = [...Array(42)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return iso(d); });
    const son = days[41];
    const gs = S.gorevler.filter(g => filt(g) && g.son_tarih && g.son_tarih >= days[0] && g.son_tarih <= son);
    const zs = f.ziyaret ? S.ziyaretler.filter(z => zDurum(z) === 'Planlandı' && z.tarih >= days[0] && z.tarih <= son) : [];
    const tarihsiz = S.gorevler.filter(g => filt(g) && !g.son_tarih);
    const gunG = d => gs.filter(g => g.son_tarih === d), gunZ = d => zs.filter(z => z.tarih === d);
    if (!days.includes(f.gun) || f.gun.slice(0, 7) !== f.ay) f.gun = f.ay === t.slice(0, 7) ? t : f.ay + '-01';
    const ayAd = first.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const sec = f.gun, secG = S.gorevler.filter(g => filt(g) && g.son_tarih === sec), secZ = f.ziyaret ? S.ziyaretler.filter(z => zDurum(z) === 'Planlandı' && z.tarih === sec) : [];
    body.innerHTML = `<div class="month-head"><button type="button" class="btn ghost" data-m="-1" aria-label="Önceki ay">‹</button><h2>${esc(ayAd)}</h2><button type="button" class="btn ghost" data-m="1" aria-label="Sonraki ay">›</button><button type="button" class="btn ghost sm" data-m="0">Bugün</button></div>
      <div class="month" role="grid" aria-label="${esc(ayAd)} görev takvimi">
        ${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(x => `<div class="mh" role="columnheader">${x}</div>`).join('')}
        ${days.map(d => { const g = gunG(d), z = gunZ(d), n = g.length + z.length;
          return `<div class="mc ${d.slice(0, 7) !== f.ay ? 'out' : ''} ${d === t ? 'today' : ''} ${d === sec ? 'sel' : ''} ${g.some(geciken) ? 'has-late' : ''}" role="gridcell" data-d="${d}" tabindex="0" aria-label="${new Date(d + 'T00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${g.length} görev${z.length ? `, ${z.length} ziyaret` : ''}">
            <span class="dn">${+d.slice(8)}</span>
            <div class="mc-items">${g.slice(0, 3).map(x => `<span class="mi ${x.durum === 'Tamam' ? 'done' : ''} ${geciken(x) ? 'late' : ''} ${x.oncelik === 'Yüksek' ? 'hi' : ''}">${x.durum === 'Tamam' ? '✓ ' : ''}${esc(x.baslik)}${x.atanan ? ` <em>· ${esc(kisaAd(x.atanan))}</em>` : ''}</span>`).join('')}${z.slice(0, Math.max(0, 3 - g.length)).map(x => `<span class="mi zi">${esc(firmaAd(x.firma_id) || 'Ziyaret')}</span>`).join('')}${n > 3 ? `<span class="more">+${n - 3}</span>` : ''}</div>
            ${n ? `<span class="dots">${g.length ? `<i class="dg">${g.length}</i>` : ''}${z.length ? `<i class="dz">${z.length}</i>` : ''}</span>` : ''}</div>`; }).join('')}
      </div>
      <section class="day-detail"><header><h3>${new Date(sec + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><button type="button" class="btn sm primary" data-add="${sec}">+ Görev ekle</button></header>
        ${secG.length || secZ.length ? `<ul class="tasks">${secG.map(gorevSatir).join('')}${secZ.map(z => `<li class="zi-row"><span class="zi-dot" aria-hidden="true"></span><button type="button" class="task-b" data-zid="${z.id}"><b>${esc(firmaAd(z.firma_id) || 'Ziyaret')}</b><small>Planlı ziyaret${z.saat ? ' · ' + esc(z.saat) : ''}${z.amac ? ' · ' + esc(z.amac) : ''}</small></button></li>`).join('')}</ul>` : '<p class="hint">Bu gün için görev yok.</p>'}
      </section>
      ${tarihsiz.length ? `<section class="day-detail"><header><h3>Tarihsiz görevler <span class="muted">${tarihsiz.length}</span></h3></header><ul class="tasks">${tarihsiz.map(gorevSatir).join('')}</ul></section>` : ''}`;
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const n = +b.dataset.m; if (!n) { f.ay = t.slice(0, 7); f.gun = t; } else { const d = new Date(Y, M - 1 + n, 1); f.ay = iso(d).slice(0, 7); } saveFilters(); draw(); });
    body.querySelectorAll('[data-d]').forEach(c => { const go = () => { f.gun = c.dataset.d; if (f.gun.slice(0, 7) !== f.ay) f.ay = f.gun.slice(0, 7); saveFilters(); draw(); }; c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; c.ondblclick = () => gorevForm({ son_tarih: c.dataset.d }); });
    body.querySelector('[data-add]').onclick = () => gorevForm({ son_tarih: sec });
    bagla(body);
  };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { f.goster = b.dataset.g; saveFilters(); el.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelectorAll('[data-gor]').forEach(b => b.onclick = () => { f.gor = b.dataset.gor; saveFilters(); el.querySelectorAll('[data-gor]').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('[data-zv]').hidden = f.gor !== 'takvim'; draw(); });
  el.querySelector('[data-z]').onchange = e => { f.ziyaret = e.target.checked; saveFilters(); draw(); };
  el.querySelector('[data-kim]')?.addEventListener('change', e => { f.kim = e.target.value; saveFilters(); draw(); });
  el.querySelector('[data-new]').onclick = () => gorevForm({ son_tarih: f.gor === 'takvim' ? f.gun : today() });
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`gorevler-${today()}.xlsx`, { 'Görevler': S.gorevler.slice().sort((a, b) => (a.son_tarih || '9').localeCompare(b.son_tarih || '9')).map(g => ({ 'Görev': g.baslik, 'Son tarih': g.son_tarih, 'Öncelik': g.oncelik, 'Durum': g.durum, 'Atanan': g.atanan ? kimAd(g.atanan) : '', 'Tamamlayan': g.tamamlayan ? kimAd(g.tamamlayan) : '', 'Firma': firmaAd(g.firma_id), 'Proje': byId('projeler', g.proje_id)?.ad, 'Kişi': byId('kisiler', g.kisi_id)?.ad_soyad, 'Not': g.notlar })) });
  draw();
}
