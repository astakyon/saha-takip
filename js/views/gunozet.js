// Gün özeti: bir kişinin günü tek ekranda (giriş-çıkışlar, ziyaretler, teklifler, tamamlanan görevler; sahada geçen süre, yol)
// ve aylık çalışma dökümü (gün gün ilk giriş, son çıkış, ziyaret, sahada süre, km; Excel).
// Konum yalnızca giriş-çıkış anında alınmış konumdur; sürekli takip yoktur.
import { app, F, saveFilters } from '../state.js';
import { esc, tarih, today, gunEkle, isoLocal, exportXlsx } from '../ui.js';
import { gunVerisi } from './ekiphar.js';
import { sureYaz } from '../giriscikis.js';
import { planUyumu } from '../mazeret.js';
import { sahipMi } from '../yetki.js';

const benE = () => (app.db?.user?.()?.email || 'ben').toLowerCase();
const saat = d => d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
const IKON = { giris: '→', cikis: '←', ziyaret: '●', teklif: '₺', gorev: '✓' };
const kisiler = () => { const l = [benE(), ...(app.ekip || []).filter(u => u.aktif !== false).map(u => (u.eposta || '').toLowerCase())]; return [...new Set(l.filter(Boolean))]; };
const adOf = e => e === benE() ? 'Ben' : (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === e)?.ad || e.split('@')[0];

export function gunOzeti(gun, kim) {
  const d = gunVerisi(gun), o = d.ozet.find(x => x.k === kim) || null;
  const ak = d.ak.filter(a => a.kim === kim).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  return { o, ak, ilk: o?.ilk || null, son: o?.son || null, uyum: planUyumu(gun, gun, kim) };
}
export function ayDokumu(ay, kim) {
  const bas = ay + '-01', gunler = [];
  for (let g = bas; g.startsWith(ay); g = gunEkle(g, 1)) gunler.push(g);
  return gunler.filter(g => g <= today()).map(g => { const x = gunOzeti(g, kim); return { gun: g, ilk: x.ilk, son: x.son, ziyaret: x.o?.yap || 0, dk: x.o?.dk || 0, km: x.o?.km || 0, teklif: x.o?.teklif || 0, gorev: x.o?.gorev || 0 }; }).filter(r => r.ziyaret || r.ilk || r.teklif || r.gorev);
}

export function gunozetView(el) {
  const f = F('gunozet', { gun: today(), kim: '', gor: 'gun', ay: today().slice(0, 7) });
  const yonetici = sahipMi() || (app.ekip || []).length;
  const kim = (yonetici && f.kim) || benE();
  el.innerHTML = `<header class="vh"><div><h1>Gün özeti</h1><p class="sum">${f.gor === 'gun' ? esc(new Date(f.gun + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : 'Aylık çalışma dökümü'} · ${esc(adOf(kim))}</p></div>
    <div class="vh-act"><div class="seg" role="group" aria-label="Görünüm"><button type="button" data-gor="gun" class="${f.gor === 'gun' ? 'on' : ''}">Gün</button><button type="button" data-gor="ay" class="${f.gor === 'ay' ? 'on' : ''}">Ay dökümü</button></div>
      ${kisiler().length > 1 ? `<select data-kim aria-label="Kişi">${kisiler().map(k => `<option value="${esc(k)}" ${k === kim ? 'selected' : ''}>${esc(adOf(k))}</option>`).join('')}</select>` : ''}</div></header>
    ${f.gor === 'gun' ? `<div class="frow"><div class="seg" role="group" aria-label="Gün"><button type="button" data-g="-1">‹ Önceki</button><button type="button" data-g="0" class="${f.gun === today() ? 'on' : ''}">Bugün</button><button type="button" data-g="1" ${f.gun >= today() ? 'disabled' : ''}>Sonraki ›</button></div><input type="date" data-gun value="${esc(f.gun)}" max="${today()}" aria-label="Gün"></div><div data-gunic></div>`
      : `<div class="frow"><input type="month" data-ay value="${esc(f.ay)}" aria-label="Ay"><button class="btn" data-xlsx>Excel</button></div><div data-ayic></div>`}
    <p class="hint">Konum yalnızca ziyarette giriş ve çıkış anında alınır; gün boyu sürekli izleme yapılmaz. Yol, ziyaret noktaları arasındaki tahmini mesafedir.</p>`;
  el.querySelectorAll('[data-gor]').forEach(b => b.onclick = () => { f.gor = b.dataset.gor; saveFilters(); gunozetView(el); });
  el.querySelector('[data-kim]')?.addEventListener('change', e => { f.kim = e.target.value; saveFilters(); gunozetView(el); });
  if (f.gor === 'gun') {
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { f.gun = +b.dataset.g ? gunEkle(f.gun, +b.dataset.g) : today(); if (f.gun > today()) f.gun = today(); saveFilters(); gunozetView(el); });
    el.querySelector('[data-gun]').onchange = e => { if (e.target.value) { f.gun = e.target.value; saveFilters(); gunozetView(el); } };
    const x = gunOzeti(f.gun, kim), o = x.o;
    el.querySelector('[data-gunic]').innerHTML = `<section class="ledger go-ozet"><div><span>İlk giriş</span><b>${x.ilk ? saat(x.ilk) : '—'}</b><small>${x.son ? 'son ' + saat(x.son) : ''}</small></div>
        <div><span>Ziyaret</span><b>${o?.yap || 0}</b><small>${o?.plan ? o.plan + ' planlı bekliyor' : ''}</small></div>
        <div><span>Sahada süre</span><b>${o?.dk ? sureYaz(o.dk) : '—'}</b><small>${o?.km ? '~' + o.km + ' km yol' : ''}</small></div>
        <div><span>Teklif · görev</span><b>${o?.teklif || 0} · ${o?.gorev || 0}</b><small>${x.uyum.planToplam ? `plana uyum %${x.uyum.uyum}` : ''}</small></div></section>
      <section class="card"><h2>Zaman çizelgesi</h2>${x.ak.length ? `<ol class="go-akis">${x.ak.map(a => `<li class="go-${a.tur}"><time>${saat(a.t)}</time><i aria-hidden="true">${IKON[a.tur] || '•'}</i><span>${a.zid ? `<button type="button" class="linkbtn" data-zid="${a.zid}">${esc(a.m)}</button>` : esc(a.m)}</span></li>`).join('')}</ol>` : '<p class="hint">Bu gün için kayıt yok.</p>'}</section>`;
    el.querySelectorAll('[data-zid]').forEach(b => b.onclick = async () => (await import('./ziyaret.js')).ziyaretForm({ id: b.dataset.zid }));
  } else {
    const ciz = () => {
      const l = ayDokumu(f.ay, kim), t = l.reduce((a, r) => ({ ziyaret: a.ziyaret + r.ziyaret, dk: a.dk + r.dk, km: a.km + r.km, teklif: a.teklif + r.teklif, gorev: a.gorev + r.gorev }), { ziyaret: 0, dk: 0, km: 0, teklif: 0, gorev: 0 });
      el.querySelector('[data-ayic]').innerHTML = l.length ? `<section class="ledger go-ozet"><div><span>Sahada gün</span><b>${l.length}</b></div><div><span>Ziyaret</span><b>${t.ziyaret}</b></div><div><span>Sahada süre</span><b>${sureYaz(t.dk) || '—'}</b></div><div><span>Yol</span><b>~${t.km} km</b></div></section>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Gün</th><th>İlk giriş</th><th>Son çıkış</th><th class="r">Ziyaret</th><th class="r">Sahada</th><th class="r">Yol</th><th class="r">Teklif</th><th class="r">Görev</th></tr></thead><tbody>
        ${l.map(r => `<tr data-gunac="${r.gun}" tabindex="0"><td>${esc(new Date(r.gun + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td>${saat(r.ilk)}</td><td>${saat(r.son)}</td><td class="r num">${r.ziyaret}</td><td class="r num">${r.dk ? sureYaz(r.dk) : ''}</td><td class="r num">${r.km ? '~' + r.km + ' km' : ''}</td><td class="r num">${r.teklif || ''}</td><td class="r num">${r.gorev || ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty"><p>Bu ay için kayıt yok.</p></div>';
      el.querySelectorAll('[data-gunac]').forEach(r => r.onclick = () => { f.gor = 'gun'; f.gun = r.dataset.gunac; saveFilters(); gunozetView(el); });
      return l;
    };
    let l = ciz();
    el.querySelector('[data-ay]').onchange = e => { if (e.target.value) { f.ay = e.target.value; saveFilters(); l = ciz(); } };
    el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`calisma-dokumu-${adOf(kim)}-${f.ay}`, { 'Çalışma dökümü': l.map(r => ({ Gün: r.gun, 'İlk giriş': saat(r.ilk), 'Son çıkış': saat(r.son), Ziyaret: r.ziyaret, 'Sahada (dk)': r.dk, 'Yol (km, tahmini)': r.km, Teklif: r.teklif, Görev: r.gorev })) });
  }
}
