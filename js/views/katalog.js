// Ürün kataloğu (aileler) ve referans proje galerisi
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, urunBilgi, fold, URUN_AILELERI, SEKTORLER, waLink } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { sunumAc } from '../sunum.js';
import { teklifForm } from './teklif.js';

const ak = s => fold(s || '').replace(/[^a-z0-9]/g, '');
const ilkFoto = async (yol, img) => { if (!yol) return; const u = await app.db.url(yol); if (u) img.src = u; };
const fotolariYukle = root => root.querySelectorAll('img[data-path]').forEach(img => ilkFoto(img.dataset.path, img));

const AILE_FORM = [{ title: 'Ürün ailesi', fields: [
  { k: 'aile', l: 'Aile kodu', t: 'combo', opts: URUN_AILELERI, help: 'Stok listesindeki ürün kodlarının başı (örn. HBL)' },
  { k: 'ad', l: 'Ticari ad', ph: 'Örn. Highbay LED' },
  { k: 'aciklama', l: 'Kısa tanıtım', t: 'area', rows: 3, full: true, ph: 'Müşteriye bir cümlede anlatacağın şey' },
  { k: 'ozellikler', l: 'Öne çıkan özellikler', t: 'area', rows: 5, full: true, ph: 'Her satıra bir özellik: IP65, 160 lm/W, 5 yıl garanti…' },
  { k: 'datasheet_url', l: 'Teknik föy bağlantısı', full: true, ph: 'https://…' },
  { k: 'fotolar', l: 'Ürün ve uygulama fotoğrafları', t: 'photos' },
]}];

export function aileForm(init = {}) {
  const a0 = init.id ? byId('urun_aileleri', init.id) : { fotolar: [], ...init, _new: true };
  const a = { ...a0 };
  const panel = openDrawer(`<header class="dh"><div><p class="muted">Katalog</p><h2 id="drawer-title">${esc(a.ad || a.aile || 'Yeni ürün ailesi')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${a._new ? '' : '<div class="dh-actions"><button class="btn sm ghost danger" data-sil>Sil</button></div>'}
    <form class="dbody form" novalidate>${renderForm(AILE_FORM, a)}<div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const form = panel.querySelector('form'); bindForm(form, AILE_FORM, a);
  panel.querySelector('[data-sil]')?.addEventListener('click', async () => { if (!confirmBox('Bu aile katalogdan silinsin mi? Stoktaki ürünler etkilenmez.')) return; await app.db.del('urun_aileleri', a.id); closeDrawer(); app.refresh(); });
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, AILE_FORM, a); if (!o.aile) return toast('Aile kodunu yaz.', 'err'); o.aile = o.aile.toUpperCase(); await app.db.save('urun_aileleri', o); toast('Katalog güncellendi.'); closeDrawer(); app.refresh(); };
}

function aileDetay(a, urunler) {
  const ozl = (a.ozellikler || '').split('\n').map(s => s.trim()).filter(Boolean);
  const paylas = [a.ad || a.aile, a.aciklama, ...ozl.map(x => '• ' + x), a.datasheet_url].filter(Boolean).join('\n');
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${esc(a.aile)}</p><h2 id="drawer-title">${esc(a.ad || a.aile)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dh-actions">${(a.fotolar || []).length ? '<button class="btn sm" data-sunum>Sunum modu</button>' : ''}${a.datasheet_url ? `<a class="btn sm ghost" href="${esc(a.datasheet_url)}" target="_blank" rel="noopener">Teknik föy</a>` : ''}<a class="btn sm ghost" href="${waLink('', paylas)}" target="_blank" rel="noopener">WhatsApp'ta paylaş</a>${a.id ? '<button class="btn sm ghost" data-duz>Düzenle</button>' : '<button class="btn sm ghost" data-duz>Katalog bilgisi ekle</button>'}</div>
    <div class="dbody">
      ${(a.fotolar || []).length ? `<div class="gal">${a.fotolar.map(p => `<img alt="" data-path="${esc(p)}">`).join('')}</div>` : ''}
      ${a.aciklama ? `<p>${esc(a.aciklama)}</p>` : ''}${ozl.length ? `<ul class="ozl">${ozl.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h3>Ürünler <span class="muted">${urunler.length}</span></h3>
      ${urunler.length ? `<ul class="list">${urunler.map(x => `<li><span><b>${esc(x.u.aciklama)}</b><small class="muted"> ${[x.w && x.w + ' W', x.lm && num(x.lm) + ' lm', x.verim && x.verim + ' lm/W', x.k && x.k + ' K'].filter(Boolean).join(' · ')}</small></span>
        <span class="r"><b class="num">${x.u.birim_fiyat_usd ? num(x.u.birim_fiyat_usd) + ' $' : '—'}</b><small class="${x.u.stok > 0 ? 'pos' : 'muted'}">${x.u.stok > 0 ? 'stok ' + num(x.u.stok) : 'stok yok'}</small></span><button type="button" class="btn sm ghost" data-t="${esc(x.u.kod)}">Teklif</button></li>`).join('')}</ul>` : '<p class="hint">Stok listesinde bu aileden ürün yok.</p>'}
    </div>`);
  fotolariYukle(panel);
  panel.querySelector('[data-duz]').onclick = () => aileForm(a.id ? { id: a.id } : { aile: a.aile });
  panel.querySelector('[data-sunum]')?.addEventListener('click', () => sunumAc(a.fotolar.map((p, i) => ({ foto: p, baslik: a.ad || a.aile, alt: i === 0 ? a.aciklama : '', satirlar: i === 0 ? ozl.slice(0, 6) : [] })), { baslik: a.ad || a.aile }));
  panel.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const u = S.urunler.find(x => x.kod === b.dataset.t); teklifForm({ kalemler: [{ kod: u.kod, ad: u.aciklama, adet: 1, birim_fiyat: u.birim_fiyat_usd || 0 }] }); });
}

export function katalogView(el) {
  const f = F('katalog', { q: '' });
  el.innerHTML = `<header class="vh"><div><h1>Ürün kataloğu</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn primary" data-new>Aile ekle</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Aile, ürün, özellik ara (örn. IP65, highbay)" value="${esc(f.q)}" aria-label="Katalogda ara"></div>
    <ul class="cards katalog" data-rows></ul>`;
  const draw = () => {
    // Stoktaki armatür aileleri + katalogda tanımlı aileler
    const grup = new Map();
    for (const u of S.urunler) { const b = urunBilgi(u.aciklama); if (!b.w) continue; const k = ak(u.aile); (grup.get(k) || grup.set(k, { aile: u.aile, urunler: [] }).get(k)).urunler.push({ u, ...b }); }
    for (const a of S.urun_aileleri) { const k = ak(a.aile); const g = grup.get(k) || grup.set(k, { aile: a.aile, urunler: [] }).get(k); g.kayit = a; }
    const l = [...grup.values()].filter(g => match(f.q, g.aile, g.kayit?.ad, g.kayit?.aciklama, g.kayit?.ozellikler, ...g.urunler.map(x => x.u.aciklama)))
      .sort((a, b) => (!!b.kayit - !!a.kayit) || b.urunler.length - a.urunler.length);
    el.querySelector('[data-sum]').textContent = `${l.length} ürün ailesi · ${S.urun_aileleri.length} ailenin tanıtım bilgisi girilmiş`;
    el.querySelector('[data-rows]').innerHTML = l.map((g, i) => {
      const ws = g.urunler.map(x => x.w), lms = g.urunler.map(x => x.lm).filter(Boolean), stok = g.urunler.reduce((s, x) => s + (+x.u.stok || 0), 0);
      return `<li><button type="button" class="card-btn kat" data-i="${i}">${g.kayit?.fotolar?.[0] ? `<img alt="" data-path="${esc(g.kayit.fotolar[0])}">` : `<span class="kat-ph" aria-hidden="true">${esc((g.aile || '?').slice(0, 3))}</span>`}
        <span class="cb-top"><b>${esc(g.kayit?.ad || g.aile)}</b><small class="muted">${esc(g.aile)}</small></span>
        <small class="muted">${g.urunler.length ? `${g.urunler.length} model · ${Math.min(...ws)}–${Math.max(...ws)} W${lms.length ? ` · ${num(Math.min(...lms))}–${num(Math.max(...lms))} lm` : ''}` : 'stokta modeli yok'}</small>
        <small class="${stok ? 'pos' : 'muted'}">${stok ? 'Bayide ' + num(stok) + ' adet' : 'Bayide stok yok'}${g.kayit ? '' : ' · tanıtım bilgisi yok'}</small></button></li>`;
    }).join('') || '<li class="empty"><p>Katalog boş. Stok listesi yüklendiğinde armatür aileleri burada kendiliğinden listelenir.</p></li>';
    fotolariYukle(el);
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const g = l[+b.dataset.i]; aileDetay(g.kayit || { aile: g.aile, fotolar: [] }, g.urunler.sort((a, b) => a.w - b.w)); });
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelector('[data-new]').onclick = () => aileForm({});
  draw();
}

// ---------- Referans galerisi ----------
export function referansSlayt(p) {
  return (p.fotolar || []).map((foto, i) => ({ foto, baslik: p.ad, alt: [p.sektor, [p.osb, p.ilce, p.il].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    satirlar: i ? [] : [(p.urun_gruplari || []).length ? 'Ürünler: ' + p.urun_gruplari.join(', ') : '', p.yeni_refit ? 'Uygulama: ' + p.yeni_refit : '', firmaAd(p.emut_id) ? 'Elektrik müteahhidi: ' + firmaAd(p.emut_id) : '', p.referans_not || ''] }));
}
export function referanslarView(el) {
  const f = F('referanslar', { sektor: 'Tümü', q: '' });
  const tum = S.projeler.filter(p => p.referans);
  const sektorler = [...new Set(tum.map(p => p.sektor).filter(Boolean))].sort();
  el.innerHTML = `<header class="vh"><div><h1>Referans projeler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn primary" data-sunum>Sunumu başlat</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Proje, ürün, il ara" value="${esc(f.q)}" aria-label="Referanslarda ara">
      ${sektorler.length > 1 ? `<div class="chips">${['Tümü', ...sektorler].map(s => `<button type="button" class="chip ${f.sektor === s ? 'on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}</div>
    <ul class="cards katalog" data-rows></ul>
    <p class="hint">Bir projeyi referans galerisine eklemek için proje kartında “Referans proje” kutusunu işaretle ve uygulama fotoğraflarını ekle.</p>`;
  const list = () => tum.filter(p => (f.sektor === 'Tümü' || p.sektor === f.sektor) && match(f.q, p.ad, p.il, p.ilce, p.osb, p.sektor, ...(p.urun_gruplari || [])));
  const draw = () => {
    const l = list();
    el.querySelector('[data-sum]').textContent = `${l.length} referans · ${l.reduce((s, p) => s + (p.fotolar || []).length, 0)} fotoğraf`;
    el.querySelector('[data-rows]').innerHTML = l.map(p => `<li><button type="button" class="card-btn kat" data-id="${p.id}">${p.fotolar?.[0] ? `<img alt="" data-path="${esc(p.fotolar[0])}">` : '<span class="kat-ph" aria-hidden="true">foto yok</span>'}
      <span class="cb-top"><b>${esc(p.ad)}</b></span><small class="muted">${esc([p.sektor, p.ilce || p.il].filter(Boolean).join(' · '))}</small><small>${esc((p.urun_gruplari || []).join(', '))}</small></button></li>`).join('')
      || '<li class="empty"><p>Henüz referans proje yok.</p></li>';
    fotolariYukle(el);
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const p = byId('projeler', b.dataset.id); const s = referansSlayt(p); s.length ? sunumAc(s, { baslik: p.ad }) : location.hash = '#/proje/' + p.id; });
  };
  el.querySelector('[data-sunum]').onclick = () => { const s = list().flatMap(referansSlayt); s.length ? sunumAc(s, { baslik: 'Referans projeler' }) : toast('Fotoğraflı referans proje yok.', 'err'); };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { f.sektor = b.dataset.s; saveFilters(); el.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}
