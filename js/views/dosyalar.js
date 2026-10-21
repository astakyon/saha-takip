// Dosyalar: eklediğin her dosya ve fotoğraf tek tek — belgeler, yüklenen Excel/JSON dosyaları, proje/firma/ziyaret fotoğrafları, kartvizitler, fişler
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, tarih, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox } from '../ui.js';
import { turAd, boyutYaz, belgeAc } from '../belgeler.js';

const gorselMi = (yol, tur) => /^image\//.test(tur || '') || /\.(jpe?g|png|webp|gif)$/i.test(yol || '');
const yerel = yol => yol && !/^https?:/.test(yol);
// Tüm dosyaları tek listede toplar
export function tumDosyalar() {
  const l = [];
  const ekle = (o) => l.push({ ...o, gorsel: gorselMi(o.yol, o.tur) });
  for (const b of S.belgeler) {
    const yk = /^Yükleme/.test(b.kategori || '');
    ekle({ id: 'b:' + b.id, yol: b.yol, ad: b.ad, tur: b.tur, boyut: b.boyut, tarih: b.created_at, grup: yk ? 'Yüklemeler' : 'Belgeler', alt: yk ? b.kategori.replace(/^Yükleme:\s*/, '') + (b.notlar ? ' · ' + b.notlar : '') : b.notlar,
      kayit: b.proje_id ? { t: 'proje', id: b.proje_id, ad: byId('projeler', b.proje_id)?.ad } : b.firma_id ? { t: 'firma', id: b.firma_id, ad: firmaAd(b.firma_id) } : null, sil: { t: 'belgeler', id: b.id } });
  }
  const foto = (t, grup, kt, adf) => { for (const r of S[t]) (r.fotolar || []).forEach((yol, i) => { if (yerel(yol)) ekle({ id: `${t}:${r.id}:${i}`, yol, ad: `${adf(r)} · fotoğraf ${i + 1}`, tarih: r.updated_at || r.created_at, grup, kayit: kt(r), cikar: { t, id: r.id, alan: 'fotolar', yol } }); }); };
  foto('projeler', 'Fotoğraflar', r => ({ t: 'proje', id: r.id, ad: r.ad }), r => r.ad);
  foto('firmalar', 'Fotoğraflar', r => ({ t: 'firma', id: r.id, ad: r.ad }), r => r.ad);
  foto('ziyaretler', 'Fotoğraflar', r => r.firma_id ? { t: 'firma', id: r.firma_id, ad: firmaAd(r.firma_id) } : null, r => `Ziyaret ${tarih(r.tarih)}${r.firma_id ? ' · ' + firmaAd(r.firma_id) : ''}`);
  foto('servis_kayitlari', 'Fotoğraflar', r => r.firma_id ? { t: 'firma', id: r.firma_id, ad: firmaAd(r.firma_id) } : null, r => `Servis ${tarih(r.tarih)}`);
  foto('urun_aileleri', 'Fotoğraflar', () => null, r => r.ad || r.aile);
  for (const k of S.kisiler) for (const [alan, y] of [['kartvizit_on', 'ön'], ['kartvizit_arka', 'arka']]) if (yerel(k[alan])) ekle({ id: `kv:${k.id}:${alan}`, yol: k[alan], ad: `${k.ad_soyad} · kartvizit ${y} yüz`, tarih: k.updated_at || k.created_at, grup: 'Kartvizitler', alt: firmaAd(k.firma_id), kayit: { t: 'kisi', id: k.id, ad: k.ad_soyad }, cikar: { t: 'kisiler', id: k.id, alan } });
  for (const m of S.masraflar) if (yerel(m.fis)) ekle({ id: 'fis:' + m.id, yol: m.fis, ad: `Fiş · ${m.tip} ${tarih(m.tarih)}`, tarih: m.tarih, grup: 'Fişler', alt: m.tutar ? m.tutar + ' TL' : '', kayit: null, cikar: { t: 'masraflar', id: m.id, alan: 'fis' } });
  return l.sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')));
}
const GRUPLAR = ['Tümü', 'Belgeler', 'Yüklemeler', 'Fotoğraflar', 'Kartvizitler', 'Fişler'];
const IKON = { PDF: '#B91C1C', Excel: '#15803D', Word: '#2563EB', Sunum: '#EA580C', JSON: '#7C3AED', KML: '#0E7490', KMZ: '#0E7490' };

export function dosyalarView(el) {
  const f = F('dosyalar', { grup: 'Tümü', q: '' });
  const tum = tumDosyalar();
  el.innerHTML = `<header class="vh"><div><h1>Dosyalar</h1><p class="sum">${tum.length} dosya · eklediğin her belge, fotoğraf ve yüklediğin her Excel dosyası</p></div></header>
    <div class="filters"><input type="search" data-q placeholder="Dosya adı, proje, firma ara" value="${esc(f.q)}" aria-label="Dosyalarda ara">
      <div class="chips">${GRUPLAR.map(g => `<button type="button" class="chip ${f.grup === g ? 'on' : ''}" data-g="${g}">${g} <i>${g === 'Tümü' ? tum.length : tum.filter(x => x.grup === g).length || ''}</i></button>`).join('')}</div></div>
    <ul class="dosya-grid" data-rows></ul>`;
  const draw = () => {
    const l = tum.filter(x => (f.grup === 'Tümü' || x.grup === f.grup) && match(f.q, x.ad, x.alt, x.kayit?.ad));
    const box = el.querySelector('[data-rows]');
    box.innerHTML = l.length ? l.slice(0, 300).map((x, i) => { const ta = turAd(x.tur, x.ad);
      return `<li><button type="button" class="dosya" data-i="${i}">${x.gorsel ? `<img alt="" loading="lazy" data-yol="${esc(x.yol)}">` : `<span class="dosya-ikon" style="--c:${IKON[ta] || '#64748B'}">${esc(ta)}</span>`}
        <span class="dosya-ad">${esc(x.ad)}</span><small class="muted">${esc([x.grup === 'Yüklemeler' ? x.alt : x.kayit?.ad || x.alt, x.boyut ? boyutYaz(x.boyut) : '', x.tarih ? tarih(String(x.tarih).slice(0, 10)) : ''].filter(Boolean).join(' · '))}</small></button></li>`; }).join('')
      : `<li class="empty"><p>${f.grup === 'Yüklemeler' ? 'Bundan sonra yüklediğin her stok, sipariş, tahsilat Excel\'i ve yedek dosyası burada ayrı ayrı saklanır.' : 'Bu grupta dosya yok.'}</p></li>`;
    box.querySelectorAll('img[data-yol]').forEach(async img => { const u = await app.db.url(img.dataset.yol); if (u) img.src = u; });
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => onizle(l[+b.dataset.i], () => dosyalarView(el)));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { f.grup = b.dataset.g; saveFilters(); el.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

async function onizle(x, yenile) {
  const kayitLink = x.kayit ? `<a class="btn sm ghost" href="#/${x.kayit.t}/${x.kayit.id}">${x.kayit.t === 'proje' ? 'Projeye' : x.kayit.t === 'firma' ? 'Firmaya' : 'Kişiye'} git: ${esc(x.kayit.ad || '')}</a>` : '';
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(x.grup)}${x.alt ? ' · ' + esc(x.alt) : ''}</p><h2 id="drawer-title">${esc(x.ad)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dh-actions"><button class="btn sm primary" data-ac>Aç</button><button class="btn sm" data-indir>İndir</button>${kayitLink}${x.sil || x.cikar ? '<button class="btn sm ghost danger" data-sil>Sil</button>' : ''}</div>
    <div class="dbody">${x.gorsel ? '<img class="onizleme" alt="" data-img>' : `<p class="hint">${esc(turAd(x.tur, x.ad))}${x.boyut ? ' · ' + boyutYaz(x.boyut) : ''}${x.tarih ? ' · ' + tarih(String(x.tarih).slice(0, 10)) : ''}</p><p>Dosyayı görmek için <b>Aç</b>'a dokun.</p>`}</div>`, { wide: x.gorsel });
  const u = await app.db.url(x.yol);
  if (x.gorsel && u) p.querySelector('[data-img]').src = u;
  p.querySelector('[data-ac]').onclick = () => belgeAc({ yol: x.yol, ad: x.ad, tur: x.tur });
  p.querySelector('[data-indir]').onclick = async () => { const v = await app.db.url(x.yol); if (!v) return toast('Dosya alınamadı.', 'err'); const a = document.createElement('a'); a.href = v; a.download = x.ad; a.target = '_blank'; a.click(); };
  p.querySelector('[data-sil]')?.addEventListener('click', async () => {
    if (!confirmBox(`“${x.ad}” silinsin mi?`)) return;
    if (x.sil) await app.db.del(x.sil.t, x.sil.id);
    else { const r = byId(x.cikar.t, x.cikar.id); if (r) { const o = { ...r }; if (Array.isArray(o[x.cikar.alan])) o[x.cikar.alan] = o[x.cikar.alan].filter(y => y !== x.cikar.yol); else o[x.cikar.alan] = null; await app.db.save(x.cikar.t, o); } }
    try { await app.db.removePhoto(x.yol); } catch {}
    toast('Dosya silindi.'); closeDrawer(); yenile();
  });
}
