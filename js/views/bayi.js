// Bayi paneli: bayinin (ör. Drv Elektrik) stok adetlerini tek tek hızlıca güncellediği, siparişlerini ve üzerinden giden açık projeleri gördüğü sade ekran
import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, fold, match, toast, pill, ACIK } from '../ui.js';
import { izin, rotaYazilabilir } from '../yetki.js';
import { stokUyarilari } from './urunler.js';

const ilk = s => fold(s || '').split(/\s+/)[0] || '';
const depolar = () => [...new Set(S.urunler.map(u => u.depo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
const bayiFirma = depo => { const k = ilk(depo); return k.length > 2 ? S.firmalar.find(f => fold(f.ad).startsWith(k)) : null; };

async function stokKaydet(u, yeni) {
  const t = today();
  await app.db.save('urunler', { ...u, stok: yeni, stok_tarihi: t });
  try { await app.db.save('stok_gecmis', { id: uuid(), kod: u.kod, stok: yeni, birim_fiyat_usd: u.birim_fiyat_usd ?? null, tarih: t, depo: u.depo || null }); } catch {}
}

export function bayiView(el) {
  const dl = depolar();
  const f = F('bayi', { depo: dl[0] || '', q: '', sadece: 'Tümü' });
  if (dl.length && !dl.includes(f.depo)) f.depo = dl[0];
  const yazar = rotaYazilabilir('bayi');
  const urunler = () => S.urunler.filter(u => !f.depo || !dl.length || u.depo === f.depo || (!u.depo && dl.length <= 1));
  const firma = bayiFirma(f.depo);
  const k = ilk(f.depo);
  const sip = izin('siparisler') ? S.siparisler.filter(s => (firma && s.firma_id === firma.id) || (k.length > 2 && fold(s.musteri_adi || '').startsWith(k)) || (s.drv && k === 'drv')).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')) : [];
  const proj = izin('projeler') && firma ? S.projeler.filter(p => p.bayi_id === firma.id && ACIK.includes(p.durum)).sort((a, b) => (+b.tutar_usd || 0) - (+a.tutar_usd || 0)) : [];
  const yetersiz = izin('teklifler') ? stokUyarilari().yetersiz : [];
  const son = urunler().map(u => u.stok_tarihi).filter(Boolean).sort().pop();
  const yil = String(new Date().getFullYear());
  const sipYil = sip.filter(s => (s.tarih || '').startsWith(yil) && (s.para_birimi || 'USD') === 'USD' && !s.rapor_disi).reduce((a, s) => a + (+s.net_deger || 0), 0);
  el.innerHTML = `<header class="vh"><div><h1>Bayi paneli</h1><p class="sum">${esc(f.depo || 'Bayi')} · ${urunler().length} ürün · ${urunler().filter(u => u.stok > 0).length} kalem stokta${son ? ` · son stok güncellemesi ${tarih(son)}` : ''}</p></div>
    <div class="vh-act">${dl.length > 1 ? `<label>Bayi <select data-depo>${dl.map(d => `<option ${d === f.depo ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>` : ''}${yazar ? '<a class="btn ghost" href="#/urunler">Stok Excel\'i yükle</a>' : ''}</div></header>
    <section class="ledger">
      <div><span>Stoktaki kalem</span><b>${num(urunler().filter(u => u.stok > 0).length)}</b><small>${num(urunler().reduce((a, u) => a + (+u.stok || 0), 0))} adet</small></div>
      ${izin('siparisler') ? `<div><span>Sipariş (${yil})</span><b>${usd(sipYil)}</b><small>${sip.filter(s => (s.tarih || '').startsWith(yil)).length} sipariş</small></div>` : ''}
      ${izin('projeler') ? `<div><span>Bayi üzerinden açık proje</span><b>${proj.length}</b><small>${usd(proj.reduce((a, p) => a + (+p.tutar_usd || 0), 0))}</small></div>` : ''}
      ${yetersiz.length ? `<div><span>Tekliflere yetmeyen stok</span><b class="neg">${yetersiz.length}</b><small>kalem</small></div>` : ''}
    </section>
    <div class="dash">
      <section class="card wide"><div class="card-h"><h2>Stok adetleri</h2>${yazar ? '<span class="hint">Adedi değiştirip Enter\'a bas ya da − / + kullan; anında kaydedilir.</span>' : '<span class="hint">Yalnızca görüntüleyebilirsin.</span>'}</div>
        <div class="filters"><input type="search" data-q placeholder="Ürün kodu ya da adı ara" value="${esc(f.q)}" aria-label="Stokta ara">
          <div class="seg sm" role="group" aria-label="Göster">${['Tümü', 'Stokta', 'Stokta yok', ...(yetersiz.length ? ['Tekliflere yetmeyen'] : [])].map(x => `<button type="button" data-s="${x}" class="${f.sadece === x ? 'on' : ''}">${x}</button>`).join('')}</div></div>
        <ul class="list bstok" data-rows></ul></section>
      ${izin('siparisler') ? `<section class="card"><h2>Son siparişler <span class="muted">${sip.length}</span></h2>${sip.length ? `<ul class="list">${sip.slice(0, 15).map(s => `<li><span><b>${esc(s.siparis_no || s.belge_no || 'Sipariş')}</b><span class="muted"> · ${tarih(s.tarih)}${s.referans ? ' · ' + esc(s.referans) : ''}${s.teslim_tarihi ? ' · teslim ' + tarih(s.teslim_tarihi) : ''}</span></span><b class="num">${num(s.net_deger)} ${esc(s.para_birimi || '')}</b></li>`).join('')}</ul>` : '<p class="hint">Bu bayiye ait sipariş bulunamadı.</p>'}</section>` : ''}
      ${izin('projeler') ? `<section class="card"><h2>Bayi üzerinden açık projeler <span class="muted">${proj.length}</span></h2>${proj.length ? `<ul class="list">${proj.slice(0, 15).map(p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${esc([p.il, p.tutar_usd ? usd(p.tutar_usd) : '', p.beklenen_tarih ? 'beklenen ' + tarih(p.beklenen_tarih) : ''].filter(Boolean).join(' · '))}</span></a>${pill(p.durum)}</li>`).join('')}</ul>` : `<p class="hint">${firma ? 'Kanalı bu bayi olan açık proje yok.' : 'Bayi firması bulunamadı; firmanın adı depo adıyla aynı kelimeyle başlamalı.'}</p>`}</section>` : ''}
    </div>`;
  const yetMap = new Map(yetersiz.map(x => [x.u.id, x]));
  const draw = () => {
    const l = urunler().filter(u => match(f.q, u.kod, u.aciklama, u.aciklama2) && (f.sadece === 'Tümü' || (f.sadece === 'Stokta' ? u.stok > 0 : f.sadece === 'Stokta yok' ? !(u.stok > 0) : yetMap.has(u.id))))
      .sort((a, b) => (yetMap.has(b.id) - yetMap.has(a.id)) || (a.aciklama || '').localeCompare(b.aciklama || '', 'tr'));
    const box = el.querySelector('[data-rows]');
    box.innerHTML = l.length ? l.slice(0, 150).map(u => { const y = yetMap.get(u.id);
      return `<li data-id="${u.id}"><span class="bs-ad"><b>${esc(u.aciklama)}</b><small class="muted">${esc(u.kod)}${u.stok_tarihi ? ' · ' + tarih(u.stok_tarihi) : ''}${y ? ` · <span class="neg">tekliflerde ${num(y.ihtiyac)} isteniyor</span>` : ''}</small></span>
        <span class="bs-adet">${yazar ? `<button type="button" class="btn sm ghost" data-eks aria-label="Azalt">−</button><input type="number" inputmode="numeric" min="0" step="1" value="${+u.stok || 0}" data-adet aria-label="${esc(u.aciklama)} stok adedi"><button type="button" class="btn sm ghost" data-art aria-label="Artır">+</button>` : `<b class="num">${num(u.stok)}</b>`}<small class="muted">${esc((u.birim || 'adet').toLowerCase())}</small></span></li>`; }).join('') + (l.length > 150 ? `<li class="hint">+${l.length - 150} ürün daha; aramayla daralt.</li>` : '')
      : '<li class="empty"><p>Ürün bulunamadı.</p></li>';
    if (!yazar) return;
    box.querySelectorAll('li[data-id]').forEach(li => {
      const u0 = () => S.urunler.find(x => x.id === li.dataset.id), inp = li.querySelector('[data-adet]');
      let zam;
      const kaydet = async () => {
        clearTimeout(zam); const u = u0(); const v = Math.max(0, Math.round(+inp.value || 0));
        if (!u || v === (+u.stok || 0)) return;
        try { await stokKaydet(u, v); li.classList.add('kaydedildi'); setTimeout(() => li.classList.remove('kaydedildi'), 900); toast(`${u.aciklama}: ${num(v)}`); }
        catch (e) { inp.value = +u.stok || 0; toast('Kaydedilemedi: ' + e.message, 'err'); }
      };
      inp.addEventListener('change', kaydet);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      const degistir = d => { inp.value = Math.max(0, (+inp.value || 0) + d); clearTimeout(zam); zam = setTimeout(kaydet, 700); };
      li.querySelector('[data-eks]').onclick = () => degistir(-1);
      li.querySelector('[data-art]').onclick = () => degistir(1);
    });
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { f.sadece = b.dataset.s; saveFilters(); el.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-depo]')?.addEventListener('change', e => { f.depo = e.target.value; saveFilters(); bayiView(el); });
  draw();
}
