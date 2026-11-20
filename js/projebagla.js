// Mevcut projeleri şantiye (ana proje) → blok (alt proje) düzenine sokma:
// - proje sayfasında "Bir şantiyeye bağla" / "Ana projeden ayır"
// - ana projenin bloklar kartında "Mevcut projeyi ekle"
// - proje listesinde seçilen projeleri "Bir şantiyede topla" (birini ana yap ya da yeni ana proje aç)
// Kurallar: iki katman (bloğun bloğu olmaz); blokları olan proje başka şantiyeye blok yapılamaz.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, openDrawer, closeDrawer, byId, firmaAd, pill } from './ui.js';
import { km } from './geo.js';
import { altProjeAlanlari, ORTAK_ALANLAR } from './tabelaesle.js';

const bloklari = p => S.projeler.filter(x => x.ust_proje_id === p.id);
// Bir projeye benzerlik puanı: aynı yatırımcı / müteahhit, ad benzerliği, yakınlık
function yakinlik(a, b) {
  let n = 0;
  if (a.yatirimci_id && a.yatirimci_id === b.yatirimci_id) n += 4;
  if (a.gemut_id && a.gemut_id === b.gemut_id) n += 2;
  const ka = fold(a.ad || '').split(/\s+/).filter(t => t.length > 2), kb = new Set(fold(b.ad || '').split(/\s+/).filter(t => t.length > 2));
  n += ka.filter(t => kb.has(t)).length * 1.5;
  if (a.lat != null && b.lat != null) { const d = km([+a.lat, +a.lng], [+b.lat, +b.lng]); if (d < 1) n += 3; else if (d < 5) n += 1; }
  if (a.il && a.il === b.il) n += 0.5;
  return n;
}

// Proje seçme penceresi: arama, önerilenler üstte; coklu ise onay kutuları
function projeSec({ baslik, ust, aciklama, adaylar, referans, coklu = false, dugme = 'Seç', doldurSor = true }) {
  return new Promise(coz => {
    const sirali = adaylar.map(p => ({ p, n: referans ? yakinlik(referans, p) : 0 })).sort((a, b) => b.n - a.n || (a.p.ad || '').localeCompare(b.p.ad || '', 'tr'));
    let bitti = false; const son = v => { if (bitti) return; bitti = true; coz(v); };
    const d = openDrawer(`<header class="dh"><div><p class="muted">${esc(ust || '')}</p><h2 id="drawer-title">${esc(baslik)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody form"><p class="hint">${aciklama}</p>
        <label class="fld"><span>Ara</span><input data-pq placeholder="Proje adı, firma, il" autocomplete="off"></label>
        <ul class="list pb-liste" data-pl></ul>
        ${doldurSor ? '<label class="chk"><input type="checkbox" data-doldur checked> <span>Bloğun boş ortak bilgilerini (yatırımcı, müteahhit, konum, ruhsat, ada / parsel, müellifler) ana projeden doldur</span></label>' : ''}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-pok ${coklu ? 'disabled' : ''}>${esc(dugme)}</button></div></div>`, { onClose: () => son(null) });
    const sec = new Set();
    const ciz = () => {
      const q = fold(d.querySelector('[data-pq]').value.trim());
      const l = sirali.filter(({ p }) => !q || fold([p.ad, firmaAd(p.yatirimci_id), firmaAd(p.gemut_id), p.il].filter(Boolean).join(' ')).includes(q)).slice(0, 60);
      d.querySelector('[data-pl]').innerHTML = l.length ? l.map(({ p, n }) => `<li><label class="pb-satir">${coklu ? `<input type="checkbox" data-pid="${p.id}" ${sec.has(p.id) ? 'checked' : ''}>` : `<input type="radio" name="pb" data-pid="${p.id}" ${sec.has(p.id) ? 'checked' : ''}>`}
        <span><b>${esc(p.ad)}</b>${n >= 3 ? ' <em class="flag soft">önerilen</em>' : ''}<small class="muted">${esc([firmaAd(p.yatirimci_id), p.il, bloklari(p).length ? bloklari(p).length + ' blok' : ''].filter(Boolean).join(' · '))}</small></span>${pill(p.durum)}</label></li>`).join('') : '<li class="muted">Uygun proje bulunamadı.</li>';
      d.querySelectorAll('[data-pid]').forEach(i => i.onchange = () => { if (!coklu) sec.clear(); i.checked ? sec.add(i.dataset.pid) : sec.delete(i.dataset.pid); d.querySelector('[data-pok]').disabled = !sec.size; });
    };
    d.querySelector('[data-pq]').oninput = ciz; ciz();
    d.querySelector('[data-pok]').disabled = !sec.size;
    d.querySelector('[data-pok]').onclick = () => { const doldur = d.querySelector('[data-doldur]')?.checked ?? false; son({ ids: [...sec], doldur }); closeDrawer(); };
  });
}

// Bloğa çevir: ust_proje_id ve (istenirse) boş ortak alanları ana projeden doldur
const blokYap = (p, ana, doldur) => { const o = { ...p, ust_proje_id: ana.id }; if (doldur) for (const [k, v] of Object.entries(altProjeAlanlari(ana))) if (o[k] == null || o[k] === '') o[k] = v; return o; };

// Proje sayfası: bu projeyi bir şantiyenin bloğu yap
export async function santiyeyeBagla(p) {
  if (bloklari(p).length) return toast(`“${p.ad}” projesinin kendi blokları var; önce onları ayır ya da bu projeyi ana proje olarak bırak.`, 'err');
  const adaylar = S.projeler.filter(x => x.id !== p.id && !x.ust_proje_id && !x.aday);
  const r = await projeSec({ baslik: 'Bir şantiyeye bağla', ust: p.ad, aciklama: `“${esc(p.ad)}” hangi şantiyenin (ana projenin) bloğu? Aynı yatırımcı, müteahhit ya da yakın konumdaki projeler üstte.`, adaylar, referans: p, dugme: 'Bloğu olarak bağla' });
  if (!r?.ids.length) return;
  const ana = byId('projeler', r.ids[0]);
  try { await app.db.save('projeler', blokYap(p, ana, r.doldur)); toast(`“${p.ad}” artık “${ana.ad}” şantiyesinin bloğu.`); app.refresh(); } catch (e) { toast(e.message, 'err'); }
}
export async function anaProjedenAyir(p) {
  const ana = byId('projeler', p.ust_proje_id);
  try { await app.db.save('projeler', { ...p, ust_proje_id: null }); toast(`“${p.ad}” ${ana ? `“${ana.ad}” şantiyesinden ` : ''}ayrıldı; artık bağımsız proje.`); app.refresh(); } catch (e) { toast(e.message, 'err'); }
}
// Ana proje: mevcut projeleri blok olarak ekle
export async function mevcutBlokEkle(ana) {
  if (ana.ust_proje_id) return toast('Bu proje bir blok; blok eklemek için ana projesine git.', 'err');
  const adaylar = S.projeler.filter(x => x.id !== ana.id && !x.ust_proje_id && !x.aday && !bloklari(x).length);
  const r = await projeSec({ baslik: 'Mevcut projeyi blok olarak ekle', ust: ana.ad, aciklama: `Seçtiğin projeler “${esc(ana.ad)}” şantiyesinin bloğu olur; teklif, tutar ve aşamaları kendilerinde kalır.`, adaylar, referans: ana, coklu: true, dugme: 'Blok olarak ekle' });
  if (!r?.ids.length) return;
  try { await app.db.bulk('projeler', r.ids.map(id => blokYap(byId('projeler', id), ana, r.doldur))); toast(`${r.ids.length} proje “${ana.ad}” şantiyesine blok olarak eklendi.`); app.refresh(); } catch (e) { toast(e.message, 'err'); }
}
// Proje listesi: seçilen projeleri bir şantiyede topla (birini ana yap ya da yeni ana proje aç)
export function santiyedeTopla(ids, sonra) {
  const ps = ids.map(id => byId('projeler', id)).filter(Boolean);
  if (ps.length < 2) { toast('En az iki proje seç: biri ana proje, diğerleri blok olur (ya da yeni ana proje aç).', 'err'); return; }
  const bloklu = ps.filter(p => bloklari(p).some(b => !ids.includes(b.id)));
  const ortakAd = (() => { const t = ps.map(p => fold(p.ad || '').split(/\s+/)); const ilk = (ps[0].ad || '').split(/\s+/); let n = 0; while (n < ilk.length && t.every(x => x[n] === fold(ilk[n]))) n++; return ilk.slice(0, n).join(' ').replace(/[–-]\s*$/, '').trim(); })();
  const d = openDrawer(`<header class="dh"><div><p class="muted">${ps.length} proje seçili</p><h2 id="drawer-title">Bir şantiyede topla</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><p class="hint">Hangisi şantiye (ana proje) olsun? Diğerleri onun bloğu olur; teklif, tutar ve aşamaları kendilerinde kalır.</p>
      <ul class="list pb-liste">${ps.map((p, i) => `<li><label class="pb-satir"><input type="radio" name="ana" value="${p.id}" ${i === 0 ? 'checked' : ''}><span><b>${esc(p.ad)}</b><small class="muted">${esc([firmaAd(p.yatirimci_id), p.il].filter(Boolean).join(' · '))}</small></span>${pill(p.durum)}</label></li>`).join('')}
        <li><label class="pb-satir"><input type="radio" name="ana" value="_yeni"><span><b>Yeni ana proje aç</b><small class="muted">Seçilenlerin hepsi blok olur</small></span></label></li></ul>
      <label class="fld" data-yeniad hidden><span>Yeni ana projenin adı</span><input data-ad value="${esc(ortakAd || ps[0].ad)}"></label>
      <label class="chk"><input type="checkbox" data-doldur checked> <span>Blokların boş ortak bilgilerini (yatırımcı, müteahhit, konum, ruhsat, ada / parsel, müellifler) ana projeden doldur</span></label>
      ${bloklu.length ? `<p class="warn">${bloklu.map(p => esc(p.ad)).join(', ')} projesinin başka blokları var; bu proje yalnız ana proje olabilir.</p>` : ''}
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-topla>Topla</button></div></div>`);
  d.querySelectorAll('[name=ana]').forEach(r => r.onchange = () => { d.querySelector('[data-yeniad]').hidden = d.querySelector('[name=ana]:checked').value !== '_yeni'; });
  d.querySelector('[data-topla]').onclick = async () => {
    const secim = d.querySelector('[name=ana]:checked').value, doldur = d.querySelector('[data-doldur]').checked;
    let ana;
    if (secim === '_yeni') {
      const ad = d.querySelector('[data-ad]').value.trim(); if (!ad) return toast('Ana projeye ad ver.', 'err');
      // Yeni ana proje: seçilenlerde ortak olan bilgiler (hepsinde aynıysa) taşınır
      const ortak = Object.fromEntries(ORTAK_ALANLAR.map(k => [k, ps.map(p => p[k]).find(v => v != null && v !== '')]).filter(([k, v]) => v != null && ps.every(p => p[k] == null || p[k] === '' || String(p[k]) === String(v))));
      ana = { id: uuid(), ad, durum: 'Proje', takip_yili: ps[0].takip_yili || null, fotolar: [], kapsam: [], ...ortak, notlar: 'Bloklardan toplanarak açıldı' };
    } else {
      ana = byId('projeler', secim);
      if (ana.ust_proje_id) ana = { ...ana, ust_proje_id: null };   // bloğu ana proje yapınca bağı kalkar
    }
    if (bloklu.some(p => p.id !== ana.id)) return toast('Başka blokları olan proje ancak ana proje olabilir.', 'err');
    const kayit = [ana, ...ps.filter(p => p.id !== ana.id).map(p => blokYap(p, ana, doldur))];
    try { await app.db.bulk('projeler', kayit); toast(`“${ana.ad}” şantiyesinde ${kayit.length - 1} blok toplandı.`); closeDrawer(); sonra?.(ana); } catch (e) { toast(e.message, 'err'); }
  };
}
