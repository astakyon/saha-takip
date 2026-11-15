// Haftalık saha planı: haftayı günlere ve bölgelere böl, önerilerden sürükle (ya da gün düğmesine dokun), her gün için rota.
// Öneriler: Fırsat radarı, ziyaret aralığı geçen firmalar, zamanı gelen projeler. Planlar uygulamadaki planlı ziyaretlerdir;
// Google Takvim'e ya da başka bir yere gönderilmez.
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, tarih, today, gunEkle, byId, firmaAd, toast, confirmBox, ILLER } from '../ui.js';
import { ayar, ayarYaz } from '../ayar.js';
import { zDurum, ziyaretForm } from './ziyaret.js';
import { haftaBasi } from './rapor.js';
import { gidilmeyenler, zamaniGelenler, rotaSirala, rotaUrl } from './bugun.js';
import { radarListesi } from '../radar.js';
import { izin } from '../yetki.js';

const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const fmt = (d, o) => new Date(d + 'T00:00').toLocaleDateString('tr-TR', o);
const ilOf = (f, p) => f?.il || p?.il || null;
// Hafta sonu açılınca gelecek hafta gösterilir
const planHaftasi = () => { const t = today(), g = (new Date(t + 'T00:00').getDay() + 6) % 7; return g >= 5 ? haftaBasi(gunEkle(t, 7 - g)) : haftaBasi(t); };

// Gün bölgeleri: { 'YYYY-AA-GG': 'Adana' }
const bolgeler = () => ayar('hafta_bolge') || {};
async function bolgeYaz(gun, il) { const b = { ...bolgeler() }; if (il) b[gun] = il; else delete b[gun]; const esik = gunEkle(today(), -60); for (const k of Object.keys(b)) if (k < esik) delete b[k]; await ayarYaz('hafta_bolge', b); }

// Öneri listesi: firma başına bir satır, en önemli neden önde
export function oneriler(bas, son) {
  const planli = new Set(S.ziyaretler.filter(z => zDurum(z) === 'Planlandı' && z.tarih >= bas && z.tarih <= son).map(z => z.firma_id).filter(Boolean));
  const m = new Map();
  const ekle = (firma_id, proje_id, neden, puan, tur) => {
    if (!firma_id || planli.has(firma_id)) return;
    const f = byId('firmalar', firma_id); if (!f) return;
    const o = m.get(firma_id);
    if (o) { if (!o.nedenler.includes(neden)) o.nedenler.push(neden); o.puan += puan * 0.3; if (!o.proje_id && proje_id) o.proje_id = proje_id; return; }
    m.set(firma_id, { firma_id, proje_id, nedenler: [neden], puan, tur, il: ilOf(f, byId('projeler', proje_id)) });
  };
  for (const x of radarListesi()) {
    if (x.tur === 'uzak') ekle(x.eylem.firma_id, null, x.alt.split(' · ').slice(1, 2).join('') || 'önemli müşteri', x.puan, 'uzak');
    else if (x.tur === 'sessiz') ekle(x.eylem.firma_id, x.eylem.proje_id, `${x.baslik}: ${x.alt.split(' · ')[1] || 'sessiz'}`, x.puan, 'sessiz');
    else if (x.tur === 'teklif') ekle(x.eylem.firma_id, x.eylem.proje_id, `teklif ${x.alt.split(' · ').at(-1)}`, x.puan, 'teklif');
  }
  for (const x of zamaniGelenler()) ekle(x.p.emut_id || x.p.alici_id || x.p.gemut_id, x.p.id, `${x.p.ad}: ${x.neden[0]}`, Math.max(+x.p.tutar_usd || 0, 3000) * 0.5, 'zaman');
  for (const x of gidilmeyenler()) ekle(x.f.id, null, x.son ? `${x.gun} gündür gidilmedi` : 'hiç ziyaret yok', 3000 + (x.proje * 4000) + Math.min(x.gun ?? 120, 180) * 20, 'aralik');
  return [...m.values()].sort((a, b) => b.puan - a.puan);
}

export function haftaplanView(el) {
  const f = F('haftaplan', { hafta: planHaftasi(), il: 'Tümü', cmt: false });
  if (f.hafta < haftaBasi(today()) && !f._gezdi) f.hafta = planHaftasi();
  const bas = f.hafta, gunler = [...Array(f.cmt ? 6 : 5)].map((_, i) => gunEkle(bas, i)), son = gunler.at(-1), t = today();
  const zs = S.ziyaretler.filter(z => z.tarih >= bas && z.tarih <= son);
  const plan = zs.filter(z => zDurum(z) === 'Planlandı'), yap = zs.filter(z => zDurum(z) === 'Yapıldı');
  const kacan = plan.filter(z => z.tarih < t);
  const B = bolgeler();
  const ol = oneriler(bas, son);
  const iller = [...new Set([...ILLER, ...ol.map(x => x.il).filter(Boolean)])];
  const olG = ol.filter(x => f.il === 'Tümü' || x.il === f.il);
  const yaz = izin('ziyaretler') === 'yaz';
  const gecmisMi = son < t;

  const kart = z => { const p = byId('projeler', z.proje_id), y = zDurum(z) === 'Yapıldı';
    return `<li class="hp-z ${y ? 'yapildi' : z.tarih < t ? 'kacti' : ''}" data-zid="${z.id}"><button type="button" class="linkbtn grow" data-zac="${z.id}"><b>${y ? '✓ ' : ''}${esc(firmaAd(z.firma_id) || 'Ziyaret')}</b>${p || z.amac ? `<small>${esc([p?.ad, z.amac].filter(Boolean).join(' · '))}</small>` : ''}</button>${!y && yaz ? `<button type="button" class="x sm" data-zsil="${z.id}" aria-label="Plandan çıkar">×</button>` : ''}</li>`; };
  const gunSutun = d => {
    const dz = zs.filter(z => z.tarih === d).sort((a, b) => (zDurum(a) === 'Yapıldı' ? 0 : 1) - (zDurum(b) === 'Yapıldı' ? 0 : 1) || (a.saat || '99').localeCompare(b.saat || '99'));
    const rota = rotaUrl(rotaSirala(dz.filter(z => zDurum(z) === 'Planlandı')).map(x => x.p));
    return `<section class="hp-gun ${d === t ? 'today' : ''} ${d < t ? 'gecmis' : ''}" data-gun="${d}">
      <header><b>${fmt(d, { weekday: 'long' })}</b><span>${fmt(d, { day: 'numeric', month: 'short' })}</span></header>
      <select data-bolge="${d}" aria-label="${fmt(d, { weekday: 'long' })} bölgesi" ${yaz ? '' : 'disabled'}><option value="">Bölge seç</option>${iller.map(i => `<option ${B[d] === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select>
      <ul class="hp-l">${dz.map(kart).join('') || `<li class="hp-bos">${d < t ? 'Ziyaret yok' : 'Buraya sürükle'}</li>`}</ul>
      ${rota ? `<a class="btn sm ghost hp-rota" href="${rota}" target="_blank" rel="noopener">Rotayı aç</a>` : ''}</section>`;
  };
  const oneriSatir = x => `<li class="hp-o" draggable="${yaz}" data-of="${x.firma_id}" ${x.proje_id ? `data-op="${x.proje_id}"` : ''}>
    <div class="grow"><a href="#/firma/${x.firma_id}"><b>${esc(firmaAd(x.firma_id))}</b></a>${x.il ? ` <span class="hp-il">${esc(x.il)}</span>` : ''}<small>${esc(x.nedenler.slice(0, 2).join(' · '))}</small></div>
    ${yaz ? `<span class="hp-gunb" role="group" aria-label="Güne ekle">${gunler.filter(d => d >= t).map(d => `<button type="button" data-ekle="${d}" class="${B[d] && x.il === B[d] ? 'uygun' : ''}" title="${fmt(d, { weekday: 'long' })}${B[d] ? ' · ' + B[d] : ''}">${GUN_KISA[gunler.indexOf(d)]}</button>`).join('')}</span>` : ''}</li>`;

  el.innerHTML = `<header class="vh"><div><h1>Haftalık saha planı</h1><p class="sum">${fmt(bas, { day: 'numeric', month: 'long' })} – ${fmt(son, { day: 'numeric', month: 'long' })}</p></div>
    <div class="vh-act">${yaz && !gecmisMi ? '<button class="btn primary" data-dagit title="Bölgesi seçili günlere en önemli önerileri yerleştirir">Otomatik dağıt</button>' : ''}</div></header>
    <section class="week-sum hp-ozet"><span class="hp-nav"><button type="button" class="btn sm ghost" data-w="-7" aria-label="Önceki hafta">‹</button><button type="button" class="btn sm ghost" data-w="0">Bu hafta</button><button type="button" class="btn sm ghost" data-w="7" aria-label="Sonraki hafta">›</button></span><span><b>${plan.length + yap.length}</b> plan</span><span><b>${yap.length}</b> yapıldı</span>${kacan.length ? `<span class="neg"><b>${kacan.length}</b> kaçtı</span>` : ''}<span class="muted">${ol.length} öneri</span>
      <label class="tg-l"><input type="checkbox" data-cmt ${f.cmt ? 'checked' : ''}> Cumartesi</label></section>
    ${kacan.length ? `<p class="hint">Kaçan ziyaretleri bir güne sürükleyerek ya da öneri listesinden yeniden planlayabilirsin.</p>` : ''}
    <div class="hp">
      <aside class="hp-oneri card"><div class="card-h"><h2>Öneriler</h2></div>
        <div class="seg sm hp-ils" role="group" aria-label="İl">${['Tümü', ...iller.filter(i => ol.some(x => x.il === i))].map(i => `<button type="button" data-il="${esc(i)}" class="${f.il === i ? 'on' : ''}">${esc(i)}${i === 'Tümü' ? '' : ` <i>${ol.filter(x => x.il === i).length}</i>`}</button>`).join('')}</div>
        ${olG.length ? `<ul class="hp-ol">${olG.slice(0, 40).map(oneriSatir).join('')}</ul>${olG.length > 40 ? `<p class="hint">İlk 40 öneri gösteriliyor (${olG.length}).</p>` : ''}` : '<p class="hint">Bu hafta için öneri yok. Ziyaret aralığı geçen firmalar, sıcak projeler ve süresi dolan teklifler burada çıkar.</p>'}
        <p class="hint">${yaz ? 'Firmayı bir güne sürükle ya da gün düğmesine dokun. Sarı düğme o gün seçtiğin bölgeyle aynı ildeki günü gösterir.' : ''}</p></aside>
      <div class="hp-hafta" style="--n:${gunler.length}">${gunler.map(gunSutun).join('')}</div>
    </div>`;

  const yenile = () => haftaplanView(el);
  const planla = async (firma_id, proje_id, gun, varolan) => {
    try {
      if (varolan) { const z = byId('ziyaretler', varolan); if (!z || z.tarih === gun) return; await app.db.save('ziyaretler', { ...z, tarih: gun }); }
      else await app.db.save('ziyaretler', { firma_id, proje_id: proje_id || null, tarih: gun, durum: 'Planlandı', fotolar: [] });
      toast(`${firmaAd(firma_id || byId('ziyaretler', varolan)?.firma_id)} · ${fmt(gun, { weekday: 'long' })} planlandı.`);
      yenile();
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  };
  el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const n = +b.dataset.w; f.hafta = n ? gunEkle(f.hafta, n) : planHaftasi(); f._gezdi = !!n; saveFilters(); yenile(); });
  el.querySelector('[data-cmt]').onchange = e => { f.cmt = e.target.checked; saveFilters(); yenile(); };
  el.querySelectorAll('[data-il]').forEach(b => b.onclick = () => { f.il = b.dataset.il; saveFilters(); yenile(); });
  el.querySelectorAll('[data-bolge]').forEach(s => s.onchange = async () => { await bolgeYaz(s.dataset.bolge, s.value); if (s.value && f.il === 'Tümü') { f.il = ol.some(x => x.il === s.value) ? s.value : 'Tümü'; saveFilters(); } yenile(); });
  el.querySelectorAll('[data-ekle]').forEach(b => b.onclick = () => { const li = b.closest('[data-of]'); planla(li.dataset.of, li.dataset.op, b.dataset.ekle); });
  el.querySelectorAll('[data-zac]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zac }, yenile));
  el.querySelectorAll('[data-zsil]').forEach(b => b.onclick = async () => { const z = byId('ziyaretler', b.dataset.zsil); if (!confirmBox(`${firmaAd(z?.firma_id) || 'Ziyaret'} plandan çıkarılsın mı?`)) return; try { await app.db.del('ziyaretler', z.id); yenile(); } catch (e) { toast('Silinemedi: ' + e.message, 'err'); } });
  // Sürükle-bırak: öneriden güne ya da günden güne (planlı ziyaret)
  if (yaz) {
    el.querySelectorAll('.hp-o[draggable=true]').forEach(li => li.ondragstart = e => { e.dataTransfer.setData('text/plain', JSON.stringify({ f: li.dataset.of, p: li.dataset.op || null })); e.dataTransfer.effectAllowed = 'copy'; });
    el.querySelectorAll('.hp-z:not(.yapildi)').forEach(li => { li.draggable = true; li.ondragstart = e => { e.dataTransfer.setData('text/plain', JSON.stringify({ z: li.dataset.zid })); e.dataTransfer.effectAllowed = 'move'; }; });
    el.querySelectorAll('.hp-gun').forEach(g => {
      if (g.dataset.gun < t) return;
      g.ondragover = e => { e.preventDefault(); g.classList.add('uzerinde'); };
      g.ondragleave = () => g.classList.remove('uzerinde');
      g.ondrop = e => { e.preventDefault(); g.classList.remove('uzerinde'); let v; try { v = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; } planla(v.f, v.p, g.dataset.gun, v.z); };
    });
  }
  el.querySelector('[data-dagit]')?.addEventListener('click', async () => {
    const gunlerB = gunler.filter(d => d >= t && B[d]);
    if (!gunlerB.length) return toast('Önce günlere bölge seç (Adana, Mersin…). Otomatik dağıt, her güne o ildeki en önemli önerileri koyar.', 'err');
    const enFazla = +ayar('hafta_gunluk', 4) || 4, kul = new Set(), yeni = [];
    for (const d of gunlerB) {
      const mevcut = plan.filter(z => z.tarih === d).length;
      for (const x of ol.filter(x => x.il === B[d] && !kul.has(x.firma_id)).slice(0, Math.max(0, enFazla - mevcut))) { kul.add(x.firma_id); yeni.push({ x, d }); }
    }
    if (!yeni.length) return toast('Seçili bölgelerde yerleştirilecek öneri kalmadı.');
    if (!confirmBox(`${yeni.length} ziyaret planlanacak (${gunlerB.map(d => GUN_KISA[gunler.indexOf(d)] + ' ' + B[d]).join(', ')}; günde en fazla ${enFazla}). Devam edilsin mi?`)) return;
    try { for (const { x, d } of yeni) await app.db.save('ziyaretler', { firma_id: x.firma_id, proje_id: x.proje_id || null, tarih: d, durum: 'Planlandı', fotolar: [] }); toast(`${yeni.length} ziyaret planlandı.`); }
    catch (e) { toast('Bir kısmı kaydedilemedi: ' + e.message, 'err'); }
    yenile();
  });
}
