// Raporlar → Eksik bilgiler: veri kontrol merkezi. Varlık varlık (firmalar ve cari, kişiler, projeler, satış, finans, bayiler, ürünler)
// doluluk, hangi kayıtta hangi alan eksik, listeden yerinde ve toplu doldurma, "bilinmiyor / yok" işareti, diğer verilerden öneri,
// önem puanına göre sıra, sorumluya görev, Excel ile doldurma; haftalık ilerleme ve kişi bazında doluluk.
import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, toast, today, gunEkle, fold, match, firmaAd, byId, exportXlsx, pickFiles, confirmBox, FIRMA_TIPLERI, ILLER, ILCELER } from '../ui.js';
import { ayar, ayarYaz } from '../ayar.js';
import { sahipMi, izin } from '../yetki.js';
import { VARLIKLAR, varlik, parcalar, kayitEksik, onemPuani, oneri, yoklar, yokAnahtar, kayitDegeri, ONEM } from '../alanlar.js';
import { vergiKontrol, vergiSahibi, firmaSec } from '../cari.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const kisiler = () => [...new Set([ben(), ...(app.ekip || []).filter(u => u.aktif !== false && !u.dis_firma_id).map(u => (u.eposta || '').toLowerCase())].filter(Boolean))];
const adOf = e => !e ? '—' : e === ben() ? 'Ben' : (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === e)?.ad || e.split('@')[0];
const yazabilir = t => sahipMi() || izin(t) === 'yaz';
const hedef = () => +ayar('doluluk_hedef', 0) || 90;

// Bir varlığın bütün eksik satırları
export function eksikSatirlar(v, Y = yoklar()) {
  const out = []; let top = 0, dolu = 0, kayit = 0;
  for (const p of parcalar(v)) for (const x of p.kapsam()) {
    const ke = kayitEksik(p, x, Y); if (!ke.top) continue;
    top += ke.top; dolu += ke.dolu; kayit++;
    if (ke.eksik.length) out.push({ p, x, ke, puan: onemPuani(p.tablo, x, ke.eksik) });
  }
  return { satirlar: out, yuzde: top ? Math.round(dolu / top * 100) : 100, kayit };
}
export function genelDoluluk() {
  const Y = yoklar(), r = {}; let top = 0, dolu = 0;
  for (const v of VARLIKLAR) { let t = 0, d = 0; for (const p of parcalar(v)) for (const x of p.kapsam()) { const k = kayitEksik(p, x, Y); t += k.top; d += k.dolu; } r[v.k] = t ? Math.round(d / t * 100) : 100; top += t; dolu += d; }
  return { genel: top ? Math.round(dolu / top * 100) : 100, ...r };
}
// En çok etki eden eksikler (bütün varlıklar)
export function enOnemliEksikler(n = 20) {
  const Y = yoklar(), l = [];
  for (const v of VARLIKLAR) l.push(...eksikSatirlar(v, Y).satirlar);
  return l.sort((a, b) => b.puan - a.puan).slice(0, n);
}

// ---------- Kayda yazma ----------
async function alanYaz(p, x, a, deger) {
  const r = byId(p.tablo, x.id) || x; let patch;
  if (a.t === 'il') patch = deger;                                  // { il, ilce } ya da { lat, lng }
  else if (a.t === 'ref') patch = deger;                            // { firma_id } / { emut_id } …
  else if (a.t === 'tip') patch = { tipler: [...new Set([...(r.tipler || []), deger])] };
  else if (a.t === 'num') patch = { [a.k]: deger === '' ? null : +String(deger).replace(',', '.') };
  else patch = { [a.k]: deger === '' ? null : deger };
  if (p.tablo === 'firmalar' && patch.vergi_no) {
    const k = vergiKontrol(patch.vergi_no); if (!k.ok) throw new Error(k.hata);
    const s = vergiSahibi(k.temiz, r.id); if (s) throw new Error(`Bu vergi numarası zaten "${s.ad}" firmasında.`);
    patch.vergi_no = k.temiz;
  }
  await app.db.save(p.tablo, { ...r, ...patch });
}
function editor(p, x, a, i) {
  const id = `ek-${i}-${a.k}`, ilSec = (v = '') => `<select data-il aria-label="İl"><option value="">İl</option>${ILLER.map(il => `<option ${il === v ? 'selected' : ''}>${esc(il)}</option>`).join('')}</select>`;
  switch (a.t) {
    case 'il': return `${ilSec(x.il)}<input data-ilce list="ek-ilce-${esc(x.il || '')}" placeholder="İlçe" aria-label="İlçe" value="${esc(x.ilce || '')}"><button type="button" class="btn sm" data-ilkaydet>Kaydet</button>`;
    case 'num': return `<input id="${id}" data-ed type="number" inputmode="decimal" placeholder="${esc(a.l)}" aria-label="${esc(a.l)}">`;
    case 'date': return `<input id="${id}" data-ed type="date" aria-label="${esc(a.l)}">`;
    case 'sel': { const o = typeof a.opts === 'function' ? a.opts(x) : a.opts; return `<select id="${id}" data-ed aria-label="${esc(a.l)}"><option value="">${esc(a.l)}</option>${o.map(v => `<option>${esc(v)}</option>`).join('')}</select>`; }
    case 'tip': return `<select id="${id}" data-ed aria-label="Firma tipi"><option value="">Tip seç</option>${FIRMA_TIPLERI.map(v => `<option>${esc(v)}</option>`).join('')}</select>`;
    case 'kisi': return `<select id="${id}" data-ed aria-label="Sorumlu"><option value="">Sorumlu</option>${kisiler().map(e => `<option value="${esc(e)}">${esc(adOf(e))}</option>`).join('')}</select>`;
    case 'ref': return `${a.k === 'paydas' ? `<select data-rol aria-label="Rol"><option value="emut_id">Emüt</option><option value="gemut_id">Gemüt</option><option value="alici_id">Alıcı</option></select>` : ''}<button type="button" class="btn sm" data-refsec>Firma seç</button>`;
    case 'proje': case 'link': return `<a class="btn sm ghost" href="${esc(a.git ? a.git(x) : p.link(x))}">Aç</a>`;
    default: return `<input id="${id}" data-ed placeholder="${esc(a.l)}" aria-label="${esc(a.l)}"${a.k === 'vergi_no' ? ' inputmode="numeric"' : ''}>`;
  }
}

export function eksiklerView(el) {
  const f = F('eksikler', { v: 'firmalar', alan: '', q: '', benim: false, sira: 'onem' });
  if (!varlik(f.v)) f.v = 'firmalar';
  const Y = yoklar(), v = varlik(f.v), sonuc = eksikSatirlar(v, Y), gd = genelDoluluk();
  ilerlemeKaydet(gd);
  let l = sonuc.satirlar.filter(r => (!f.alan || r.ke.eksik.some(e => e.a.k === f.alan)) && (!f.q || match(f.q, r.p.baslik(r.x))) && (!f.benim || (r.x.sorumlu || '').toLowerCase() === ben()));
  l.sort(f.sira === 'ad' ? (a, b) => String(a.p.baslik(a.x)).localeCompare(String(b.p.baslik(b.x)), 'tr') : (a, b) => b.puan - a.puan);
  const alanSay = new Map(); for (const r of sonuc.satirlar) for (const e of r.ke.eksik) { const k = e.a.k; const o = alanSay.get(k) || { a: e.a, n: 0, onem: e.onem }; o.n++; if (ONEM[e.onem].w > ONEM[o.onem].w) o.onem = e.onem; alanSay.set(k, o); }
  const seciliAlan = f.alan && alanSay.get(f.alan)?.a;
  const topluOlur = seciliAlan && ['text', 'num', 'date', 'sel', 'kisi', 'tip', 'il'].includes(seciliAlan.t) && !seciliAlan.alt;
  const goster = l.slice(0, 150);
  el.innerHTML = `<header class="vh"><div><h1>Eksik bilgiler</h1><p class="sum">Genel doluluk %${gd.genel} · hedef %${hedef()}${gd.genel >= hedef() ? ' ✓' : ''}</p></div>
    <div class="vh-act"><button class="btn ghost" data-xls>Excel'e aktar</button>${yazabilir(parcalar(v)[0].tablo) ? '<button class="btn ghost" data-xlsyukle>Excel\'den doldur</button>' : ''}<a class="btn ghost" href="#/kontrol">Kontroller</a></div></header>
    <nav class="ek-sekme" aria-label="Kayıt türü">${VARLIKLAR.map(x => { const s = x.k === f.v ? sonuc : null; return `<button type="button" data-v="${x.k}" class="${x.k === f.v ? 'on' : ''}"><b>${esc(x.ad)}</b><span class="ek-yuz ${gd[x.k] >= hedef() ? 'ok' : gd[x.k] < 60 ? 'neg' : ''}">%${gd[x.k]}</span>${s ? `<small>${s.satirlar.length} eksik kayıt</small>` : ''}</button>`; }).join('')}</nav>
    <div class="ek-alanlar" role="group" aria-label="Eksik alana göre süz"><button type="button" class="chip-s ${!f.alan ? 'on' : ''}" data-alan="">Hepsi <i>${sonuc.satirlar.length}</i></button>${[...alanSay.values()].sort((a, b) => ONEM[b.onem].w - ONEM[a.onem].w || b.n - a.n).map(o => `<button type="button" class="chip-s ${f.alan === o.a.k ? 'on' : ''} ek-${o.onem}" data-alan="${o.a.k}" title="${esc(o.a.neden || '')}">${esc(o.a.l)} <i>${o.n}</i></button>`).join('')}</div>
    ${seciliAlan ? `<p class="ek-neden"><b>${esc(seciliAlan.l)}</b> neden önemli: ${esc(seciliAlan.neden || '')}</p>` : ''}
    <div class="frow"><input type="search" data-q value="${esc(f.q)}" placeholder="Ara" aria-label="Kayıt ara"><label class="chk"><input type="checkbox" data-benim ${f.benim ? 'checked' : ''}> Yalnız benim sorumlu olduklarım</label>
      <select data-sira aria-label="Sıra"><option value="onem" ${f.sira === 'onem' ? 'selected' : ''}>En çok etki eden önce</option><option value="ad" ${f.sira === 'ad' ? 'selected' : ''}>Ada göre</option></select></div>
    ${l.length ? `<div class="ek-toplu" data-toplu hidden><span data-secsay></span>
      ${topluOlur ? `<span class="ek-ed" data-toplued>${editor(parcalar(v)[0], {}, seciliAlan, 't')}</span><button type="button" class="btn sm primary" data-topluuygula>Seçilenlere uygula</button>` : '<small class="muted">Toplu doldurmak için yukarıdan bir alan seç.</small>'}
      <select data-atakim aria-label="Görev atanacak kişi">${kisiler().map(e => `<option value="${esc(e)}">${esc(adOf(e))}</option>`).join('')}</select><button type="button" class="btn sm" data-ata>Görev aç</button></div>
    <div class="tbl-wrap"><table class="tbl ek-t"><thead><tr><th><input type="checkbox" data-hepsi aria-label="Hepsini seç"></th><th>Kayıt</th><th>Eksik alanlar</th></tr></thead><tbody>
      ${goster.map((r, i) => `<tr data-i="${i}"><td><input type="checkbox" data-sec aria-label="Seç"></td>
        <td><a href="${esc(r.p.link(r.x))}"><b>${esc(r.p.baslik(r.x))}</b></a><small class="muted"> %${r.ke.yuzde} dolu${kayitDegeri(r.p.tablo, r.x) ? ' · ' + usd(Math.round(kayitDegeri(r.p.tablo, r.x))) : ''}${r.x.sorumlu ? ' · ' + esc(adOf(r.x.sorumlu.toLowerCase())) : ''}</small></td>
        <td class="ek-hucre">${r.ke.eksik.filter(e => !f.alan || e.a.k === f.alan).map(e => { const o = oneri(r.p.tablo, r.x, e.a);
          return `<div class="ek-alan ek-${e.onem}" data-k="${e.a.k}"><span class="ek-ad" title="${esc(e.a.neden || '')}">${esc(e.a.l)}</span><span class="ek-ed">${editor(r.p, r.x, e.a, i)}</span>${o ? `<button type="button" class="btn sm ek-oneri" data-oneri title="Öneri: ${esc(o.kaynak)}">Öneri: ${esc(o.metin)} ✓</button>` : ''}<button type="button" class="linkbtn ek-yok" data-yok title="Bu kayıtta bu bilgi yok ya da bilinmiyor; bir daha sorma">yok</button></div>`; }).join('')}</td></tr>`).join('')}</tbody></table></div>
    ${l.length > goster.length ? `<p class="hint">${l.length} kaydın ilk ${goster.length} tanesi gösteriliyor; arama ya da alan süzgeciyle daralt.</p>` : ''}`
    : `<div class="empty"><p>${sonuc.satirlar.length ? 'Süzgece uyan eksik yok.' : 'Bu bölümde eksik bilgi yok. ✓'}</p></div>`}
    <datalist id="ek-ilce-">${[]}</datalist>${ILLER.map(il => `<datalist id="ek-ilce-${esc(il)}">${(ILCELER[il] || []).map(i => `<option value="${esc(i)}">`).join('')}</datalist>`).join('')}
    ${ilerlemeHtml(gd)}`;

  const yenile = () => eksiklerView(el);
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { f.v = b.dataset.v; f.alan = ''; saveFilters(); yenile(); });
  el.querySelectorAll('[data-alan]').forEach(b => b.onclick = () => { f.alan = b.dataset.alan; saveFilters(); yenile(); });
  el.querySelector('[data-q]')?.addEventListener('change', e => { f.q = e.target.value; saveFilters(); yenile(); });
  el.querySelector('[data-benim]')?.addEventListener('change', e => { f.benim = e.target.checked; saveFilters(); yenile(); });
  el.querySelector('[data-sira]')?.addEventListener('change', e => { f.sira = e.target.value; saveFilters(); yenile(); });
  el.querySelector('[data-hedef]')?.addEventListener('click', async () => { const h = prompt('Şirketin doluluk hedefi (%)', hedef()); if (h == null) return; await ayarYaz('doluluk_hedef', Math.min(100, Math.max(1, +h || 90))); yenile(); });

  // Yerinde doldurma
  const kaydet = async (r, a, deger, hucre) => {
    try { await alanYaz(r.p, r.x, a, deger); toast(`${a.l} kaydedildi.`); hucre?.classList.add('ek-tamam'); setTimeout(yenile, 250); }
    catch (e) { toast(e.message, 'err'); }
  };
  el.querySelectorAll('.ek-t tr[data-i]').forEach(tr => {
    const r = goster[+tr.dataset.i];
    tr.querySelectorAll('.ek-alan').forEach(h => {
      const a = r.ke.eksik.find(e => e.a.k === h.dataset.k)?.a; if (!a) return;
      const ed = h.querySelector('[data-ed]');
      if (ed) { const yaz = () => { const v = ed.value.trim(); if (v) kaydet(r, a, a.t === 'kisi' ? v.toLowerCase() : v, h); };
        ed.addEventListener('change', yaz); ed.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ed.blur(); } }); }
      h.querySelector('[data-il]')?.addEventListener('change', e => { const i = h.querySelector('[data-ilce]'); i.setAttribute('list', 'ek-ilce-' + e.target.value); });
      h.querySelector('[data-ilkaydet]')?.addEventListener('click', () => { const il = h.querySelector('[data-il]').value, ilce = h.querySelector('[data-ilce]').value.trim();
        if (!il) return toast('İli seç.', 'err'); if (r.p.tablo === 'firmalar' && !ilce) return toast('İlçeyi de yaz.', 'err'); kaydet(r, a, { il, ilce: ilce || null }, h); });
      h.querySelector('[data-refsec]')?.addEventListener('click', async () => { const o = oneri(r.p.tablo, r.x, a); const fid = await firmaSec((a.oneriAd && a.oneriAd(r.x)) || '', o?.deger?.firma_id ? byId('firmalar', o.deger.firma_id) : null); if (!fid) return;
        const alan = a.k === 'paydas' ? h.querySelector('[data-rol]').value : (a.alanAd || a.k); kaydet(r, a, { [alan]: fid }, h); });
      h.querySelector('[data-oneri]')?.addEventListener('click', () => { const o = oneri(r.p.tablo, r.x, a); if (o) kaydet(r, { ...a, t: 'il' }, o.deger, h); });
      h.querySelector('[data-yok]').onclick = async () => { await ayarYaz('eksik_yok', { ...yoklar(), [yokAnahtar(r.p.tablo, r.x.id, a.k)]: today() }); toast(`${a.l}: bu kayıtta yok olarak işaretlendi.`); yenile(); };
    });
  });

  // Seçim, toplu doldurma, görev
  const secili = () => [...el.querySelectorAll('.ek-t [data-sec]:checked')].map(c => goster[+c.closest('tr').dataset.i]);
  const secGuncelle = () => { const n = secili().length, t = el.querySelector('[data-toplu]'); if (!t) return; t.hidden = !n; t.querySelector('[data-secsay]').textContent = `${n} kayıt seçili`; };
  el.querySelectorAll('.ek-t [data-sec]').forEach(c => c.onchange = secGuncelle);
  el.querySelector('[data-hepsi]')?.addEventListener('change', e => { el.querySelectorAll('.ek-t [data-sec]').forEach(c => c.checked = e.target.checked); secGuncelle(); });
  el.querySelector('[data-toplued] [data-il]')?.addEventListener('change', e => el.querySelector('[data-toplued] [data-ilce]')?.setAttribute('list', 'ek-ilce-' + e.target.value));
  el.querySelector('[data-topluuygula]')?.addEventListener('click', async () => {
    const s = secili(), kutu = el.querySelector('[data-toplued]'); let deger;
    if (seciliAlan.t === 'il') { const il = kutu.querySelector('[data-il]').value, ilce = kutu.querySelector('[data-ilce]').value.trim(); if (!il) return toast('İli seç.', 'err'); deger = { il, ilce: ilce || null }; }
    else { deger = kutu.querySelector('[data-ed]').value.trim(); if (!deger) return toast('Değeri yaz ya da seç.', 'err'); if (seciliAlan.t === 'kisi') deger = deger.toLowerCase(); }
    if (seciliAlan.k === 'vergi_no') return toast('Vergi numarası her firmada farklıdır; toplu verilemez.', 'err');
    if (!confirmBox(`${s.length} kayda "${seciliAlan.l}" yazılsın mı?`)) return;
    let n = 0; for (const r of s) { try { await alanYaz(r.p, r.x, seciliAlan, deger); n++; } catch {} }
    toast(`${n} kayıt güncellendi.`); yenile();
  });
  el.querySelector('[data-ata]')?.addEventListener('click', async () => {
    const s = secili(); if (!s.length) return; const kim = el.querySelector('[data-atakim]').value;
    const alanlar = [...new Set(s.flatMap(r => r.ke.eksik.filter(e => !f.alan || e.a.k === f.alan).map(e => e.a.l.toLowerCase())))];
    await app.db.save('gorevler', { id: uuid(), baslik: `${s.length} ${v.ad.toLowerCase()} kaydında eksik bilgiyi tamamla (${alanlar.slice(0, 3).join(', ')})`, son_tarih: gunEkle(today(), 7), durum: 'Açık', oncelik: 'Normal', atanan: kim, kaynak: 'veri',
      notlar: s.map(r => `• ${r.p.baslik(r.x)}: ${r.ke.eksik.map(e => e.a.l).join(', ')}`).join('\n').slice(0, 4000) });
    toast(`${adOf(kim)} için görev açıldı.`);
  });

  // Excel ile doldurma
  el.querySelector('[data-xls]')?.addEventListener('click', () => {
    const alanlar = [...alanSay.values()].filter(o => !['ref', 'proje', 'link'].includes(o.a.t)).map(o => o.a);
    exportXlsx(`eksik-bilgiler-${v.k}-${today()}`, { [v.ad.slice(0, 30)]: l.map(r => ({ 'Kayıt no': `${r.p.tablo}:${r.x.id}`, Kayıt: r.p.baslik(r.x), 'Doluluk %': r.ke.yuzde,
      ...Object.fromEntries(alanlar.map(a => [a.t === 'il' ? 'İl' : a.l, r.ke.eksik.some(e => e.a.k === a.k) ? '' : '(dolu)'])), ...(alanlar.some(a => a.t === 'il') ? { 'İlçe': '' } : {}) })) });
  });
  el.querySelector('[data-xlsyukle]')?.addEventListener('click', async () => {
    const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
    try {
      await (await import('../ui.js')).xlsxYukle();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' });
      let n = 0, h = 0;
      for (const row of rows) {
        const [t, id] = String(row['Kayıt no'] || '').split(':'); const p = parcalar(v).find(p => p.tablo === t), x = p && byId(t, id); if (!x) continue;
        for (const a of p.alanlar) {
          const ad = a.t === 'il' ? 'İl' : a.l, d = String(row[ad] ?? '').trim(); if (!d || d === '(dolu)' || !a.eksik(x)) continue;
          try { await alanYaz(p, byId(t, id), a, a.t === 'il' ? { il: d, ilce: String(row['İlçe'] || '').trim() || null } : a.t === 'kisi' ? d.toLowerCase() : d); n++; } catch { h++; }
        }
      }
      toast(`${n} bilgi dolduruldu${h ? `, ${h} hatalı değer atlandı` : ''}.`); yenile();
    } catch (e) { toast('Dosya okunamadı: ' + e.message, 'err'); }
  });
}

// ---------- İlerleme: haftalık doluluk ve kişi bazında ----------
const haftaBasi = () => { const d = new Date(today() + 'T00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); };
function ilerlemeKaydet(gd) {
  if (!sahipMi()) return;
  const g = ayar('doluluk_gecmis') || [], h = haftaBasi(), son = g.at(-1);
  if (son?.h === h && son.genel === gd.genel) return;
  const yeni = [...g.filter(x => x.h !== h), { h, genel: gd.genel, firmalar: gd.firmalar, projeler: gd.projeler, kisiler: gd.kisiler }].slice(-26);
  ayarYaz('doluluk_gecmis', yeni).catch(() => {});
}
export function kisiDoluluk() {
  const Y = yoklar(), m = new Map();
  for (const k of ['firmalar', 'projeler']) { const v = varlik(k); for (const p of parcalar(v)) for (const x of p.kapsam()) { const e = (x.sorumlu || ben() || '').toLowerCase(); const ke = kayitEksik(p, x, Y); if (!ke.top) continue; const o = m.get(e) || { top: 0, dolu: 0, eksik: 0 }; o.top += ke.top; o.dolu += ke.dolu; o.eksik += ke.eksik.length ? 1 : 0; m.set(e, o); } }
  return [...m.entries()].map(([e, o]) => ({ e, ad: adOf(e), yuzde: Math.round(o.dolu / o.top * 100), eksik: o.eksik })).sort((a, b) => a.yuzde - b.yuzde);
}
function ilerlemeHtml(gd) {
  const g = ayar('doluluk_gecmis') || [], kd = kisiDoluluk();
  return `<section class="card ek-ilerleme"><h2>İlerleme</h2>
    <div class="ek-hafta" role="img" aria-label="Haftalık genel doluluk">${g.length ? g.map(x => `<div class="ek-hb" title="${x.h}: %${x.genel}"><i style="height:${x.genel}%" class="${x.genel >= hedef() ? 'ok' : ''}"></i><small>${new Date(x.h + 'T00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</small></div>`).join('') : '<p class="hint">Haftalık doluluk her hafta ilk açılışta kaydedilir.</p>'}<span class="ek-hedefcizgi" style="bottom:${hedef()}%"></span></div>
    <p class="hint">Hedef %${hedef()}${sahipMi() ? ' · <button type="button" class="linkbtn" data-hedef>Hedefi değiştir</button>' : ''}</p>
    ${kd.length > 1 ? `<h3>Kişi bazında (firma ve projeler)</h3><ul class="list">${kd.map(x => `<li><span class="grow">${esc(x.ad)}<small class="muted"> · ${x.eksik} kayıtta eksik</small></span><span class="hedef-bar"><i style="width:${x.yuzde}%" class="${x.yuzde >= hedef() ? 'ok' : x.yuzde < 60 ? 'neg' : ''}"></i></span><b class="num">%${x.yuzde}</b></li>`).join('')}</ul>` : ''}</section>`;
}
