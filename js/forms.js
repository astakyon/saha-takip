// Genel form oluşturucu: alan tanımlarından form üretir, değerleri okur.
import { S } from './db.js';
import { esc, byId, fold, pickFiles, myLocation, toast, IL_MERKEZ } from './ui.js';
import { app } from './state.js';
import { konumAlgila, konumMetni } from './geo.js';
import { mikDugme, mikBagla } from './ses.js';
import { altlikKatmani, varsayilanAltlik } from './altlik.js';

let fseq = 0;
function datalistFor(t) {
  const id = 'dl-' + t;
  let dl = document.getElementById(id);
  if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.appendChild(dl); }
  const key = { firmalar: 'ad', kisiler: 'ad_soyad', projeler: 'ad' }[t];
  dl.innerHTML = S[t].slice().sort((a, b) => (a[key] || '').localeCompare(b[key] || '', 'tr')).map(x => `<option value="${esc(x[key])}">`).join('');
  return id;
}

function control(f, v, obj) {
  const id = 'f' + (++fseq);
  const name = `name="${f.k}" id="${id}"`;
  const ph = f.ph ? `placeholder="${esc(f.ph)}"` : '';
  switch (f.t) {
    case 'area': return [id, `<div class="area-wrap"><textarea ${name} rows="${f.rows || 3}" ${ph}>${esc(v)}</textarea>${mikDugme()}</div>`];
    case 'num': return [id, `<input ${name} type="number" inputmode="decimal" step="any" value="${v ?? ''}" ${ph}>`];
    case 'date': return [id, `<input ${name} type="date" value="${v ? String(v).slice(0, 10) : ''}">`];
    case 'time': return [id, `<input ${name} type="time" value="${esc(v || '')}">`];
    case 'chk': return [id, `<label class="chk"><input ${name} type="checkbox" ${v ? 'checked' : ''}> <span>${esc(f.cl || f.l)}</span></label>`];
    case 'sel': {
      const opts = typeof f.opts === 'function' ? f.opts(obj) : f.opts;
      const has = v != null && v !== '' && !opts.some(o => (o.v ?? o) === v);
      return [id, `<select ${name}><option value="">${esc(f.ph || 'Seç')}</option>${has ? `<option selected>${esc(v)}</option>` : ''}${opts.map(o => { const val = o.v ?? o; return `<option value="${esc(val)}" ${val == v ? 'selected' : ''}>${esc(o.l ?? o)}</option>`; }).join('')}</select>`];
    }
    case 'combo': { // seçenekli ama serbest yazılabilir
      const lid = 'dlc-' + f.k;
      return [id, `<input ${name} list="${lid}" value="${esc(v)}" ${ph} autocomplete="off"><datalist id="${lid}">${(typeof f.opts === 'function' ? f.opts(obj) : f.opts).map(o => `<option value="${esc(o)}">`).join('')}</datalist>`];
    }
    case 'tags': {
      const sel = new Set(v || []);
      const all = [...new Set([...(f.opts || []), ...sel])];
      return [id, `<div class="tags" data-tags="${f.k}">${all.map(o => `<label class="tag"><input type="checkbox" value="${esc(o)}" ${sel.has(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}${f.free ? `<input class="tag-add" placeholder="+ ekle" data-tag-add>` : ''}</div>`];
    }
    case 'ref': { // firmalar / kisiler / projeler
      const key = { firmalar: 'ad', kisiler: 'ad_soyad', projeler: 'ad' }[f.ref];
      const cur = byId(f.ref, v);
      return [id, `<input ${name} data-ref="${f.ref}" list="${datalistFor(f.ref)}" value="${esc(cur ? cur[key] : '')}" autocomplete="off" placeholder="${esc(f.ph || 'Yaz veya listeden seç')}">`];
    }
    case 'photos': {
      return [id, `<div class="photos" data-photos="${f.k}" data-val='${esc(JSON.stringify(v || []))}'><div class="ph-list"></div>
        <div class="ph-btns"><button type="button" class="btn sm" data-ph-cam>Fotoğraf çek</button><button type="button" class="btn sm ghost" data-ph-gal>Galeriden ekle</button></div></div>`];
    }
    case 'loc': {
      return [id, `<div class="locfield" data-loc data-lat="${obj.lat ?? ''}" data-lng="${obj.lng ?? ''}">
        <div class="minimap"></div>
        <div class="loc-row"><span class="loc-txt"></span>
        <button type="button" class="btn sm" data-loc-me>Bulunduğum yer</button>
        <button type="button" class="btn sm ghost" data-loc-clear>Temizle</button></div>
        <p class="hint loc-det" aria-live="polite">Haritaya dokunarak raptiyeyi yerleştir, sürükleyerek düzelt. İl, ilçe, belde ve sanayi bölgesi otomatik algılanır.</p></div>`];
    }
    default: return [id, `<input ${name} type="${f.t === 'tel' ? 'tel' : f.t === 'email' ? 'email' : 'text'}" value="${esc(v)}" ${ph} ${f.auto && obj._new ? 'autofocus' : ''}>`];
  }
}

// Bölüm seçenekleri: kapali: true | (obj) => bool  → açılır-kapanır bölüm (başlıkta dolu alan sayısı görünür)
const dolu = v => v !== null && v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && !v.length);
export function renderForm(sections, obj) {
  return sections.map(sec => {
    const kap = typeof sec.kapali === 'function' ? sec.kapali(obj) : sec.kapali;
    const icerik = renderFields(sec, obj);
    const gizli = sec.show && !sec.show(obj) ? 'hidden' : '';
    if (sec.kapali !== undefined) {
      const n = obj._new ? 0 : sec.fields.filter(f => f.t !== 'loc' && dolu(obj[f.k])).length;
      return `<details class="fs fs-d" ${sec.show ? `data-show="${sec.id}"` : ''} ${gizli} ${kap ? '' : 'open'}><summary><b>${esc(sec.title)}</b><span class="muted">${sec.ozet ? esc(sec.ozet) : ''}${n ? ` · ${n} alan dolu` : ''}</span></summary>${icerik}</details>`;
    }
    return `<fieldset class="fs" ${sec.show ? `data-show="${sec.id}"` : ''} ${gizli}>${sec.title ? `<legend>${esc(sec.title)}</legend>` : ''}${icerik}</fieldset>`;
  }).join('');
}
function renderFields(sec, obj) {
  return `
      ${sec.note ? `<p class="hint">${esc(sec.note)}</p>` : ''}
      <div class="grid">
      ${sec.fields.map(f => {
        const [id, html] = control(f, obj[f.k], obj);
        return `<div class="fld ${f.full || ['area', 'photos', 'loc', 'tags'].includes(f.t) ? 'full' : ''} ${f.t === 'chk' ? 'is-chk' : ''}" ${f.show ? `data-showf="${f.k}"` : ''} ${f.show && !f.show(obj) ? 'hidden' : ''}>
          ${f.t === 'chk' ? '' : `<label for="${id}">${esc(f.l)}${f.req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>`}${html}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
      }).join('')}
      </div>`;
}

// Form alanlarını bağlar (fotoğraf, konum, koşullu gösterim, hesaplama)
export function bindForm(root, sections, obj, { onChange } = {}) {
  mikBagla(root);
  root.querySelectorAll('details.fs-d').forEach(d => d.addEventListener('toggle', () => { if (d.open) d.querySelectorAll('[data-loc]').forEach(b => setTimeout(() => b._map?.invalidateSize(), 50)); }));
  // fotoğraflar
  root.querySelectorAll('[data-photos]').forEach(box => {
    const list = () => JSON.parse(box.dataset.val || '[]');
    const draw = async () => {
      const arr = list();
      box.querySelector('.ph-list').innerHTML = arr.map((p, i) => `<figure class="thumb" data-i="${i}"><img alt="" data-path="${esc(p)}"><button type="button" class="x" data-ph-del="${i}" aria-label="Fotoğrafı kaldır">×</button></figure>`).join('');
      for (const img of box.querySelectorAll('img[data-path]')) { const u = await app.db.url(img.dataset.path); if (u) img.src = u; }
    };
    const add = async capture => {
      const files = await pickFiles({ capture, multiple: !capture });
      if (!files.length) return;
      try {
        toast('Fotoğraf yükleniyor…');
        const arr = list();
        for (const f of files) arr.push(await app.db.upload(f));
        box.dataset.val = JSON.stringify(arr); draw(); toast('Fotoğraf eklendi.');
      } catch (e) { toast(e.message, 'err'); }
    };
    box.querySelector('[data-ph-cam]').onclick = () => add(true);
    box.querySelector('[data-ph-gal]').onclick = () => add(false);
    box.addEventListener('click', e => {
      const d = e.target.closest('[data-ph-del]');
      if (d) { const arr = list(); arr.splice(+d.dataset.phDel, 1); box.dataset.val = JSON.stringify(arr); draw(); return; }
      const img = e.target.closest('img[src]'); if (img) window.open(img.src, '_blank');
    });
    draw();
  });
  // etiket ekleme
  root.querySelectorAll('[data-tag-add]').forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const v = inp.value.trim().toUpperCase(); if (!v) return;
    inp.insertAdjacentHTML('beforebegin', `<label class="tag"><input type="checkbox" value="${esc(v)}" checked><span>${esc(v)}</span></label>`);
    inp.value = '';
  }));
  // konum mini haritası
  root.querySelectorAll('[data-loc]').forEach(box => {
    const el = box.querySelector('.minimap');
    const lat = parseFloat(box.dataset.lat), lng = parseFloat(box.dataset.lng);
    const il = obj.il && IL_MERKEZ[obj.il];
    const m = box._map = L.map(el, { zoomControl: true, attributionControl: false }).setView(!isNaN(lat) ? [lat, lng] : il ? [il[0], il[1]] : [36.9, 35.3], !isNaN(lat) ? 14 : il ? 10 : 8);
    altlikKatmani(varsayilanAltlik(app.filters.harita || {})).then(({ katman }) => katman.addTo(m));
    let mk = null, seq = 0;
    const txt = box.querySelector('.loc-txt'), det = box.querySelector('.loc-det');
    const algila = async ll => {
      const my = ++seq; det.textContent = 'Konum algılanıyor…';
      const k = await konumAlgila(ll[0], ll[1]);
      if (my !== seq) return;
      box.dataset.bolge = k.bolge_id || '';
      const put = (n, v) => { const el = root.querySelector(`[name="${n}"]`); if (el && v) { if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === v)) el.add(new Option(v, v)); el.value = v; } };
      put('il', k.il); put('ilce', k.ilce); put('belde', k.belde); put('osb', k.osb);
      det.innerHTML = `Algılanan: <b>${esc(konumMetni(k) || 'bölge dışı')}</b>${k.kaynak === 'cihaz' ? ' (çevrimdışı tahmin; ilçe en yakın merkeze göre)' : ''}`;
      root.dispatchEvent(new Event('change'));
    };
    const set = (ll, pan) => {
      box.dataset.lat = ll ? ll[0].toFixed(6) : ''; box.dataset.lng = ll ? ll[1].toFixed(6) : '';
      box.dataset.moved = '1';
      if (!ll) { mk && m.removeLayer(mk); mk = null; txt.textContent = 'Konum yok'; return; }
      if (!mk) { mk = L.marker(ll, { draggable: true }).addTo(m); mk.on('dragend', () => { const p = mk.getLatLng(); set([p.lat, p.lng]); }); }
      else mk.setLatLng(ll);
      txt.textContent = `${(+ll[0]).toFixed(5)}, ${(+ll[1]).toFixed(5)}`;
      if (pan) m.setView(ll, Math.max(m.getZoom(), 15));
      if (!box.dataset.init) algila(ll);
    };
    if (!isNaN(lat)) { box.dataset.init = '1'; set([lat, lng]); delete box.dataset.moved; delete box.dataset.init; } else txt.textContent = 'Konum yok';
    if (obj._algila && !isNaN(lat)) algila([lat, lng]);
    if (!isNaN(lat) && obj.konum_yaklasik) txt.textContent += ' · yaklaşık';
    m.on('click', e => set([e.latlng.lat, e.latlng.lng]));
    box.querySelector('[data-loc-me]').onclick = async () => { try { set(await myLocation(), true); } catch (e) { toast(e.message, 'err'); } };
    box.querySelector('[data-loc-clear]').onclick = () => set(null);
    setTimeout(() => m.invalidateSize(), 250);
  });
  // koşullu alanlar
  const refresh = () => {
    const cur = { ...obj, ...readRaw(root) };
    for (const sec of sections) {
      if (sec.show) { const el = root.querySelector(`[data-show="${sec.id}"]`); if (el) el.hidden = !sec.show(cur); }
      for (const f of sec.fields) if (f.show) { const el = root.querySelector(`[data-showf="${f.k}"]`); if (el) el.hidden = !f.show(cur); }
    }
    onChange && onChange(cur, root);
  };
  root.addEventListener('change', refresh);
  root.addEventListener('input', e => { if (e.target.matches('input[type=number]')) refresh(); });
}

function readRaw(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach(el => {
    if (el.closest('[data-tags]')) return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : parseFloat(el.value);
    else o[el.name] = el.value.trim() === '' ? null : el.value.trim();
  });
  root.querySelectorAll('[data-tags]').forEach(b => o[b.dataset.tags] = [...b.querySelectorAll('input[type=checkbox]:checked')].map(x => x.value));
  root.querySelectorAll('[data-photos]').forEach(b => o[b.dataset.photos] = JSON.parse(b.dataset.val || '[]'));
  return o;
}

// Formu okur; ref alanlarında yazılan yeni isimler için kayıt oluşturur.
export async function readForm(root, sections, obj) {
  const raw = readRaw(root);
  const out = { ...obj };
  const fields = sections.flatMap(s => s.fields);
  for (const f of fields) {
    if (f.t === 'loc') continue;
    let v = raw[f.k];
    if (f.t === 'ref') {
      const key = { firmalar: 'ad', kisiler: 'ad_soyad', projeler: 'ad' }[f.ref];
      if (!v) v = null;
      else {
        const same = S[f.ref].filter(x => fold(x[key]) === fold(v));
        // Kişide önce seçili firmanın çalışanı, sonra firmasız kayıt; başka firmanın aynı adlı çalışanı seçilmez
        const hit = f.ref !== 'kisiler' || !raw.firma_id_resolved ? same[0]
          : same.find(x => x.firma_id === raw.firma_id_resolved) || same.find(x => !x.firma_id);
        if (hit) {
          v = hit.id;
          if (f.ref === 'firmalar' && f.tip && !(hit.tipler || []).includes(f.tip)) await app.db.save('firmalar', { ...hit, tipler: [...(hit.tipler || []), f.tip] });
        } else if (f.ref === 'firmalar') {
          const nf = await app.db.save('firmalar', { ad: v, tipler: f.tip ? [f.tip] : [], il: raw.il || obj.il || null, fotolar: [] });
          v = nf.id; toast(`Yeni firma eklendi: ${nf.ad}`);
        } else if (f.ref === 'kisiler') {
          const nk = await app.db.save('kisiler', { ad_soyad: v, firma_id: raw.firma_id_resolved || null });
          v = nk.id;
        } else v = null;
      }
    }
    out[f.k] = v;
    if (f.k === 'firma_id') raw.firma_id_resolved = v;
  }
  const lb = root.querySelector('[data-loc]');
  if (lb) {
    const la = parseFloat(lb.dataset.lat), ln = parseFloat(lb.dataset.lng);
    out.lat = isNaN(la) ? null : la; out.lng = isNaN(ln) ? null : ln;
    if (lb.dataset.moved) out.konum_yaklasik = false;
    if (lb.dataset.bolge !== undefined) out.bolge_id = lb.dataset.bolge || null;
  }
  return out;
}
