import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, tarih, today, ZIYARET_AMAC, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, myLocation, exportXlsx } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';

const ZIYARET_FORM = [
  { title: 'Ziyaret', fields: [
    { k: 'tarih', l: 'Tarih', t: 'date' },
    { k: 'amac', l: 'Amaç', t: 'combo', opts: ZIYARET_AMAC },
    { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar', ph: 'Firma adı' },
    { k: 'kisi_id', l: 'Görüşülen kişi', t: 'ref', ref: 'kisiler', ph: 'Kişi adı (yeni ise yazman yeterli)' },
    { k: 'proje_id', l: 'İlgili proje', t: 'ref', ref: 'projeler' },
    { k: 'notlar', l: 'Görüşme notu', t: 'area', rows: 5, full: true },
    { k: 'sonraki', l: 'Sonraki adım (görev olarak eklenir)', full: true, ph: 'Örn. teklif revize edilip gönderilecek' },
    { k: 'sonraki_tarih', l: 'Sonraki adım tarihi', t: 'date' },
  ]},
  { title: 'Konum ve fotoğraf', fields: [
    { k: 'loc', l: 'Ziyaret konumu', t: 'loc' },
    { k: 'fotolar', l: 'Fotoğraflar', t: 'photos' },
  ]},
];

export function ziyaretForm(init = {}, after) {
  const z0 = init.id ? byId('ziyaretler', init.id) || init : { id: uuid(), tarih: today(), fotolar: [], ...init, _new: true };
  const z = { ...z0 };
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${z._new ? 'Yeni ziyaret' : tarih(z.tarih)}</p><h2 id="drawer-title">${esc(firmaAd(z.firma_id) || 'Ziyaret kaydı')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${z._new ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>'}
    <form class="dbody form" novalidate>${renderForm(ZIYARET_FORM, z)}
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`, { onClose: () => {} });
  const form = panel.querySelector('form');
  bindForm(form, ZIYARET_FORM, z);
  // Yeni ziyarette konumu otomatik al
  if (z._new && z.lat == null) myLocation().then(ll => {
    const b = form.querySelector('[data-loc]'); if (!b || b.dataset.lat) return;
    b.querySelector('[data-loc-me]').click();
  }).catch(() => {});
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { if (confirmBox('Ziyaret silinsin mi?')) { await app.db.del('ziyaretler', z.id); toast('Ziyaret silindi.'); closeDrawer(); app.refresh(); } });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const o = await readForm(form, ZIYARET_FORM, z);
      if (!o.firma_id && !o.notlar) return toast('Firma veya not gir.', 'err');
      if (o.kisi_id && o.firma_id) { const k = byId('kisiler', o.kisi_id); if (k && !k.firma_id) await app.db.save('kisiler', { ...k, firma_id: o.firma_id }); }
      o.tarih = o.tarih || today();
      await app.db.save('ziyaretler', o);
      if (o.sonraki) await app.db.save('gorevler', { baslik: o.sonraki, son_tarih: o.sonraki_tarih, durum: 'Açık', oncelik: 'Normal', firma_id: o.firma_id, proje_id: o.proje_id, kisi_id: o.kisi_id });
      toast('Ziyaret kaydedildi.' + (o.sonraki ? ' Sonraki adım görevlere eklendi.' : ''));
      closeDrawer(); after ? after() : app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

export function ziyaretlerView(el) {
  const f = F('ziyaretler', { q: '', ay: 'Tümü' });
  const aylar = [...new Set(S.ziyaretler.map(z => z.tarih.slice(0, 7)))].sort().reverse();
  el.innerHTML = `<header class="vh"><div><h1>Ziyaretler</h1><p class="sum" data-sum></p></div>
    <div class="vh-act"><button class="btn ghost" data-exp>Excel'e aktar</button><button class="btn primary" data-new>Ziyaret kaydet</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Firma, kişi, not ara" value="${esc(f.q)}" aria-label="Ziyaretlerde ara">
      <div class="frow"><label>Ay <select data-ay>${['Tümü', ...aylar].map(a => `<option value="${a}" ${f.ay === a ? 'selected' : ''}>${a === 'Tümü' ? 'Tümü' : new Date(a + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></label></div></div>
    <div class="timeline" data-rows></div>`;
  const list = () => S.ziyaretler.filter(z => (f.ay === 'Tümü' || z.tarih.startsWith(f.ay)) && match(f.q, firmaAd(z.firma_id), byId('kisiler', z.kisi_id)?.ad_soyad, z.notlar, byId('projeler', z.proje_id)?.ad, z.amac))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || (b.created_at || '').localeCompare(a.created_at || ''));
  const draw = () => {
    const l = list(); el.querySelector('[data-sum]').textContent = `${l.length} ziyaret`;
    let last = '';
    el.querySelector('[data-rows]').innerHTML = l.length ? l.map(z => {
      const d = z.tarih !== last ? `<h3 class="tl-day">${new Date(z.tarih + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>` : ''; last = z.tarih;
      const k = byId('kisiler', z.kisi_id), p = byId('projeler', z.proje_id);
      return `${d}<button type="button" class="tl-item" data-id="${z.id}"><b>${esc(firmaAd(z.firma_id) || 'Firma belirtilmedi')}</b>${k ? `<span class="muted"> · ${esc(k.ad_soyad)}</span>` : ''}${z.amac ? `<span class="tag-s">${esc(z.amac)}</span>` : ''}
        ${p ? `<span class="tl-proj">${esc(p.ad)}</span>` : ''}<p>${esc(z.notlar || '')}</p>${(z.fotolar || []).length ? `<small class="muted">${z.fotolar.length} fotoğraf</small>` : ''}</button>`;
    }).join('') : '<div class="empty"><p>Ziyaret kaydı yok. Sahadayken “Ziyaret kaydet” ile firma, kişi ve notu gir; konum otomatik eklenir.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.id }));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelector('[data-ay]').onchange = e => { f.ay = e.target.value; saveFilters(); draw(); };
  el.querySelector('[data-new]').onclick = () => ziyaretForm({});
  el.querySelector('[data-exp]').onclick = () => exportXlsx(`ziyaretler-${today()}.xlsx`, { 'Ziyaretler': list().map(z => ({ 'Tarih': z.tarih, 'Firma': firmaAd(z.firma_id), 'Kişi': byId('kisiler', z.kisi_id)?.ad_soyad, 'Proje': byId('projeler', z.proje_id)?.ad, 'Amaç': z.amac, 'Not': z.notlar, 'Enlem': z.lat, 'Boylam': z.lng })) });
  draw();
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
]}];

export function gorevForm(init = {}, after) {
  const g0 = init.id ? byId('gorevler', init.id) : { id: uuid(), durum: 'Açık', oncelik: 'Normal', son_tarih: today(), ...init, _new: true };
  const g = { ...g0 };
  const panel = openDrawer(`<header class="dh"><h2 id="drawer-title">${g._new ? 'Yeni görev' : esc(g.baslik)}</h2><button class="x" data-close aria-label="Kapat">×</button></header>
    ${g._new ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>'}
    <form class="dbody form" novalidate>${renderForm(GOREV_FORM, g)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, GOREV_FORM, g);
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { await app.db.del('gorevler', g.id); closeDrawer(); app.refresh(); });
  form.onsubmit = async e => {
    e.preventDefault();
    const o = await readForm(form, GOREV_FORM, g);
    if (!o.baslik) return toast('Görevi yaz.', 'err');
    await app.db.save('gorevler', o); toast('Görev kaydedildi.'); closeDrawer(); after ? after() : app.refresh();
  };
}

export function gorevlerView(el) {
  const f = F('gorevler', { goster: 'Açık' });
  el.innerHTML = `<header class="vh"><div><h1>Görevler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn primary" data-new>Yeni görev</button></div></header>
    <div class="filters"><div class="seg" role="group">${['Açık', 'Tamam', 'Tümü'].map(x => `<button type="button" data-g="${x}" class="${f.goster === x ? 'on' : ''}">${x === 'Tamam' ? 'Tamamlanan' : x}</button>`).join('')}</div></div>
    <ul class="tasks" data-rows></ul>`;
  const draw = () => {
    const t = today();
    const l = S.gorevler.filter(g => f.goster === 'Tümü' || g.durum === f.goster).sort((a, b) => (a.son_tarih || '9').localeCompare(b.son_tarih || '9'));
    el.querySelector('[data-sum]').textContent = `${S.gorevler.filter(g => g.durum !== 'Tamam').length} açık · ${S.gorevler.filter(g => g.durum !== 'Tamam' && g.son_tarih && g.son_tarih < t).length} gecikmiş`;
    el.querySelector('[data-rows]').innerHTML = l.length ? l.map(g => `<li class="${g.durum === 'Tamam' ? 'done' : ''} ${g.son_tarih && g.son_tarih < t && g.durum !== 'Tamam' ? 'late' : ''}">
      <label class="chk"><input type="checkbox" data-done="${g.id}" ${g.durum === 'Tamam' ? 'checked' : ''} aria-label="Tamamlandı"></label>
      <button type="button" class="task-b" data-id="${g.id}"><b>${esc(g.baslik)}</b><small>${[tarih(g.son_tarih), firmaAd(g.firma_id), byId('projeler', g.proje_id)?.ad, g.oncelik !== 'Normal' ? g.oncelik : ''].filter(x => x && x !== '—').map(esc).join(' · ')}</small></button></li>`).join('')
      : '<li class="empty"><p>Görev yok.</p></li>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.id }));
    el.querySelectorAll('[data-done]').forEach(c => c.onchange = async () => { const g = byId('gorevler', c.dataset.done); await app.db.save('gorevler', { ...g, durum: c.checked ? 'Tamam' : 'Açık' }); draw(); });
  };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { f.goster = b.dataset.g; saveFilters(); el.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => gorevForm({});
  draw();
}
