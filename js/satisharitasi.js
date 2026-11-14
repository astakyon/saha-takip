// Satış haritası (Ş2 + Ş5): projenin karar grubu, firmalar arası tek ekranda.
// projeler.karar_grubu = [{ kisi_id, rol, tutum, etki, not }]
//   rol:   Onaylayan · Teknik değerlendiren · Satınalma · Etkileyici · Kullanıcı / saha
//   tutum: Destekliyor · Tarafsız · Bilinmiyor · Rakipçi
//   etki:  Yüksek · Orta · Düşük
import { S } from './db.js';
import { app } from './state.js';
import { esc, tarih, today, byId, firmaAd, match, toast } from './ui.js';

export const ROLLER = ['Onaylayan', 'Teknik değerlendiren', 'Satınalma', 'Etkileyici', 'Kullanıcı / saha'];
export const TUTUMLAR = [
  { k: 'Destekliyor', c: '#15803D', ac: 'Bizi destekliyor, ürünümüzü öneriyor' },
  { k: 'Tarafsız', c: '#64748B', ac: 'Fikri yok ya da açık değil' },
  { k: 'Bilinmiyor', c: '#A1A1AA', ac: 'Henüz görüşülmedi' },
  { k: 'Rakipçi', c: '#B91C1C', ac: 'Rakip markayı istiyor' },
];
export const ETKILER = ['Yüksek', 'Orta', 'Düşük'];
const KISI_ROL = { 'Karar verici': 'Onaylayan', Teknik: 'Teknik değerlendiren', Satınalma: 'Satınalma', Etkileyici: 'Etkileyici', Saha: 'Kullanıcı / saha' };
const tutumRenk = t => (TUTUMLAR.find(x => x.k === t) || TUTUMLAR[2]).c;

export const grubu = p => (Array.isArray(p?.karar_grubu) ? p.karar_grubu : []).filter(g => g?.kisi_id && byId('kisiler', g.kisi_id));
// Kişiyle son görüşme (yapılmış ziyaret; projeden bağımsız)
export const sonTemas = kid => S.ziyaretler.filter(z => z.kisi_id === kid && (z.durum || 'Yapıldı') === 'Yapıldı').reduce((a, z) => (z.tarih || '') > a ? z.tarih : a, '');
const gunOnce = d => d ? Math.round((new Date(today()) - new Date(d)) / 864e5) : null;

// Projenin satış haritasındaki eksikler: en önemlisi önce
export function haritaUyarilari(p) {
  const g = grubu(p), u = [];
  if (!g.length) return [{ s: 'bilgi', m: 'Satış haritası boş: bu projede kimin karar verdiğini, kimin teknik değerlendirdiğini ekle.' }];
  const onay = g.filter(x => x.rol === 'Onaylayan');
  if (!onay.length) u.push({ s: 'kirmizi', m: 'Karar vericiyi bilmiyorsun: haritada "Onaylayan" rolünde kimse yok.' });
  for (const o of onay) {
    const k = byId('kisiler', o.kisi_id), t = sonTemas(o.kisi_id), gun = gunOnce(t);
    if (!t) u.push({ s: 'kirmizi', m: `Karar vericiye ulaşılmadı: ${k.ad_soyad} ile hiç görüşme kaydı yok.`, kid: k.id });
    else if (gun > 90) u.push({ s: 'sari', m: `Karar verici ${k.ad_soyad} ile ${gun} gündür görüşülmedi.`, kid: k.id });
    if (o.tutum === 'Rakipçi') u.push({ s: 'kirmizi', m: `Karar verici ${k.ad_soyad} rakip markayı istiyor.`, kid: k.id });
  }
  for (const r of g.filter(x => x.tutum === 'Rakipçi' && x.rol !== 'Onaylayan' && x.etki === 'Yüksek')) u.push({ s: 'sari', m: `${byId('kisiler', r.kisi_id).ad_soyad} rakipçi ve etkisi yüksek.`, kid: r.kisi_id });
  if (!g.some(x => x.tutum === 'Destekliyor')) u.push({ s: 'sari', m: 'Projede seni destekleyen kimse yok.' });
  if (!g.some(x => x.rol === 'Teknik değerlendiren')) u.push({ s: 'bilgi', m: 'Teknik değerlendiren kişi eklenmemiş (şartnameyi kim yazıyor, ürünü kim onaylıyor?).' });
  return u;
}

// Özet sekmesi için kısa kart
export function haritaOzeti(p) {
  const g = grubu(p), u = haritaUyarilari(p);
  return `<div class="sh-sayac">${TUTUMLAR.map(t => { const n = g.filter(x => (x.tutum || 'Bilinmiyor') === t.k).length; return `<span style="--c:${t.c}" class="${n ? '' : 'sifir'}"><b>${n}</b>${t.k}</span>`; }).join('')}</div>
    ${u.length ? `<p class="sh-uyari ${u[0].s}">${esc(u[0].m)}${u.length > 1 ? ` <small>+${u.length - 1} uyarı</small>` : ''}</p>` : '<p class="sh-uyari yesil">Karar grubu tamam görünüyor.</p>'}`;
}

// Satış haritası sekmesi: uyarılar, tutuma göre dört sütun, kişi ekleme
export function haritaBolumu(kutu, p, { yazar = true } = {}) {
  if (!kutu) return;
  const kaydet = async liste => {
    try { await app.db.save('projeler', { ...(byId('projeler', p.id) || p), karar_grubu: liste.length ? liste : null }); app.refresh?.(); }
    catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  };
  const g = grubu(p), u = haritaUyarilari(p);
  const kart = x => {
    const k = byId('kisiler', x.kisi_id), t = sonTemas(k.id), gun = gunOnce(t);
    return `<li class="sh-kart" data-shk="${k.id}" ${yazar ? 'draggable="true" tabindex="0" role="button"' : ''} aria-label="${esc(k.ad_soyad)}: ${esc(x.rol || 'rol yok')}, ${esc(x.tutum || 'Bilinmiyor')}">
      <b>${esc(k.ad_soyad)}</b><small class="muted">${esc([firmaAd(k.firma_id), k.unvan].filter(Boolean).join(' · '))}</small>
      <span class="sh-alt">${x.rol ? `<span class="sh-rol ${x.rol === 'Onaylayan' ? 'onay' : ''}">${esc(x.rol)}</span>` : '<span class="sh-rol bos">rol seç</span>'}<span class="sh-etki" title="Etkisi: ${esc(x.etki || 'Orta')}">${[0, 1, 2].map(i => `<i class="${i < 3 - ETKILER.indexOf(x.etki || 'Orta') ? 'on' : ''}"></i>`).join('')}</span></span>
      <small class="${t ? (gun > 90 ? 'neg' : 'muted') : 'neg'}">${t ? 'son görüşme ' + tarih(t) : 'hiç görüşülmedi'}</small>${x.not ? `<small class="sh-not">${esc(x.not)}</small>` : ''}</li>`;
  };
  kutu.innerHTML = `<div class="fs-kb"><h2>Satış haritası <span class="muted">${g.length}</span></h2>${yazar ? '<button type="button" class="btn sm" data-shekle>Kişi ekle</button>' : ''}</div>
    <p class="hint">Projede kim karar veriyor, kim bizi destekliyor, kim rakipçi? Firmalar fark etmeksizin herkes tek ekranda.${yazar ? ' Kişiye dokunup rolünü ve tutumunu değiştir; masaüstünde sütunlar arasında sürükleyebilirsin.' : ''}</p>
    ${u.length ? `<ul class="sh-uyarilar">${u.map(x => `<li class="sh-uyari ${x.s}">${esc(x.m)}${x.kid ? ` <a href="#/kisi/${x.kid}">Kişiye git</a>` : ''}</li>`).join('')}</ul>` : ''}
    <div class="sh-pano">${TUTUMLAR.map(t => { const l = g.filter(x => (x.tutum || 'Bilinmiyor') === t.k).sort((a, b) => ROLLER.indexOf(a.rol) - ROLLER.indexOf(b.rol)); return `<section class="sh-sutun" data-sht="${t.k}" style="--c:${t.c}"><h3>${t.k} <span class="muted">${l.length}</span></h3><small class="muted">${t.ac}</small><ul>${l.map(kart).join('')}</ul></section>`; }).join('')}</div>`;
  if (!yazar) return;
  kutu.querySelector('[data-shekle]').onclick = () => kisiSec(p, g, kaydet);
  kutu.querySelectorAll('[data-shk]').forEach(el => {
    el.onclick = () => duzenle(p, g, el.dataset.shk, kaydet);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } };
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', el.dataset.shk); el.classList.add('surukle'); });
    el.addEventListener('dragend', () => el.classList.remove('surukle'));
  });
  kutu.querySelectorAll('[data-sht]').forEach(s => {
    s.addEventListener('dragover', e => { e.preventDefault(); s.classList.add('hedef'); });
    s.addEventListener('dragleave', () => s.classList.remove('hedef'));
    s.addEventListener('drop', e => { e.preventDefault(); s.classList.remove('hedef'); const kid = e.dataTransfer.getData('text/plain'); const x = g.find(y => y.kisi_id === kid); if (!x || (x.tutum || 'Bilinmiyor') === s.dataset.sht) return; kaydet(g.map(y => y.kisi_id === kid ? { ...y, tutum: s.dataset.sht } : y)); });
  });
}

const dlg = html => { const d = document.createElement('dialog'); d.className = 'org-dlg sh-dlg'; d.innerHTML = html; document.body.appendChild(d); d.showModal(); d.addEventListener('close', () => d.remove()); return d; };

function duzenle(p, g, kid, kaydet) {
  const x = g.find(y => y.kisi_id === kid), k = byId('kisiler', kid); if (!x || !k) return;
  const d = dlg(`<form method="dialog" class="form"><h3>${esc(k.ad_soyad)}</h3><p class="muted">${esc([firmaAd(k.firma_id), k.unvan].filter(Boolean).join(' · '))}</p>
    <div class="fld"><label>Tutumu</label><div class="seg sh-seg" role="group" aria-label="Tutumu">${TUTUMLAR.map(t => `<button type="button" data-tt="${t.k}" style="--c:${t.c}" class="${(x.tutum || 'Bilinmiyor') === t.k ? 'on' : ''}">${t.k}</button>`).join('')}</div></div>
    <div class="fld"><label for="sh-r">Bu projedeki rolü</label><select id="sh-r"><option value="">Seç</option>${ROLLER.map(r => `<option ${x.rol === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="fld"><label>Etkisi</label><div class="seg" role="group" aria-label="Etkisi">${ETKILER.map(e => `<button type="button" data-et="${e}" class="${(x.etki || 'Orta') === e ? 'on' : ''}">${e}</button>`).join('')}</div></div>
    <div class="fld"><label for="sh-n">Not</label><input id="sh-n" value="${esc(x.not || '')}" placeholder="ör. Philips'i şartnameye yazdırdı"></div>
    <div class="btnrow"><button type="button" class="btn ghost danger" data-cikar>Haritadan çıkar</button><a class="btn ghost" href="#/kisi/${k.id}" data-kart>Kişi kartı</a><span class="grow"></span><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="submit" class="btn primary" data-kay>Kaydet</button></div></form>`);
  const seg = sel => d.querySelectorAll(sel).forEach(b => b.onclick = () => d.querySelectorAll(sel).forEach(y => y.classList.toggle('on', y === b)));
  seg('[data-tt]'); seg('[data-et]');
  d.querySelector('[data-vaz]').onclick = () => d.close();
  d.querySelector('[data-kart]').onclick = () => d.close();
  d.querySelector('[data-cikar]').onclick = () => { d.close(); kaydet(g.filter(y => y.kisi_id !== kid)); };
  d.querySelector('form').onsubmit = e => { e.preventDefault();
    const o = { ...x, tutum: d.querySelector('[data-tt].on')?.dataset.tt || 'Bilinmiyor', rol: d.querySelector('#sh-r').value || null, etki: d.querySelector('[data-et].on')?.dataset.et || 'Orta', not: d.querySelector('#sh-n').value.trim() || null };
    d.close(); kaydet(g.map(y => y.kisi_id === kid ? o : y)); };
}

// Kişi ekle: önce projedeki firmaların kişileri (işaretle, topluca ekle), altta tüm kişilerde arama
export function kisiSec(p, g, kaydet, onSecili = []) {
  const firmalar = new Set(['yatirimci_id', 'projeci_id', 'danisman_id', 'gemut_id', 'emut_id', 'alici_id', 'bayi_id'].map(r => p[r]).filter(Boolean));
  const var_ = new Set(g.map(x => x.kisi_id));
  const oneri = S.kisiler.filter(k => !var_.has(k.id) && (firmalar.has(k.firma_id) || k.id === p.ilgili_kisi_id)).sort((a, b) => firmaAd(a.firma_id).localeCompare(firmaAd(b.firma_id), 'tr') || a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
  const satir = k => `<li><label class="chk"><input type="checkbox" value="${k.id}" ${onSecili.includes(k.id) ? 'checked' : ''}><span><b>${esc(k.ad_soyad)}</b> <small class="muted">${esc([firmaAd(k.firma_id), k.unvan].filter(Boolean).join(' · '))}</small></span></label></li>`;
  const d = dlg(`<form method="dialog" class="form"><h3>Satış haritasına kişi ekle</h3>
    ${oneri.length ? `<p class="muted">Projedeki firmalardan</p><ul class="list sh-sec" data-oneri>${oneri.map(satir).join('')}</ul>` : '<p class="hint">Projedeki firmalarda haritaya eklenmemiş kişi yok.</p>'}
    <div class="fld"><label for="sh-ara">Başka bir kişi ara</label><input id="sh-ara" type="search" placeholder="Ad, firma, telefon…" autocomplete="off"></div><ul class="list sh-sec" data-sonuc></ul>
    <div class="btnrow"><span class="grow"></span><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="submit" class="btn primary">Ekle</button></div></form>`);
  const ara = d.querySelector('#sh-ara'), sonuc = d.querySelector('[data-sonuc]');
  ara.oninput = () => { const q = ara.value.trim(); if (q.length < 2) { sonuc.innerHTML = ''; return; } const os = new Set(oneri.map(k => k.id)); sonuc.innerHTML = S.kisiler.filter(k => !var_.has(k.id) && !os.has(k.id) && match(q, k.ad_soyad, firmaAd(k.firma_id), k.telefon, k.unvan)).slice(0, 8).map(satir).join('') || '<li class="hint">Eşleşen kişi yok.</li>'; };
  d.querySelector('[data-vaz]').onclick = () => d.close();
  d.querySelector('form').onsubmit = e => { e.preventDefault();
    const sec = [...d.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value); d.close(); if (!sec.length) return;
    kaydet([...g, ...sec.map(id => { const k = byId('kisiler', id); return { kisi_id: id, rol: KISI_ROL[k.rol] || null, tutum: 'Bilinmiyor', etki: k.rol === 'Karar verici' ? 'Yüksek' : 'Orta', not: null }; })]);
    toast(sec.length === 1 ? 'Kişi haritaya eklendi.' : `${sec.length} kişi haritaya eklendi.`); };
  (d.querySelector('[data-oneri] input') || ara).focus();
}

// Kişinin yer aldığı projelerdeki tutumu (kişi sayfası)
export const kisininProjeleri = kid => S.projeler.flatMap(p => { const x = grubu(p).find(g => g.kisi_id === kid); return x ? [{ p, ...x }] : []; });
export { tutumRenk };
