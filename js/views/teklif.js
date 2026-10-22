// Hızlı teklif taslağı: ürün kalemleri, yazdırılabilir PDF, WhatsApp özeti
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, tarih, today, gunEkle, byId, firmaAd, match, toast, openDrawer, closeDrawer, confirmBox, waLink, ACIK, urunBilgi, exportXlsx } from '../ui.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { ayar, ayarYaz } from '../ayar.js';
import { benimAdim } from '../sablon.js';
import { tl, kur } from '../kur.js';

export const TEKLIF_DURUM = [{ k: 'Taslak', c: '#64748B' }, { k: 'Gönderildi', c: '#7C3AED' }, { k: 'Kabul', c: '#15803D' }, { k: 'Red', c: '#B91C1C' }];
const tpill = d => `<span class="pill" style="--c:${(TEKLIF_DURUM.find(x => x.k === d) || TEKLIF_DURUM[0]).c}">${esc(d)}</span>`;
const PB = { USD: '$', EUR: '€', TRY: '₺' };
const para = (v, pb = 'USD') => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' ' + (PB[pb] || pb);

export function hesapla(t) {
  const ara = (t.kalemler || []).reduce((s, k) => s + (+k.adet || 0) * (+k.birim_fiyat || 0) * (1 - (+k.iskonto || 0) / 100), 0);
  const isk = ara * (+t.iskonto || 0) / 100, net = ara - isk, kdv = net * (+t.kdv || 0) / 100;
  return { ara, isk, net, kdv, genel: net + kdv };
}
export function yeniTeklifNo() {
  const y = new Date().getFullYear();
  const max = S.teklifler.map(t => /-(\d+)$/.exec(t.teklif_no || '')).filter(Boolean).map(m => +m[1]).reduce((a, b) => Math.max(a, b), 0);
  return `T-${y}-${String(max + 1).padStart(3, '0')}`;
}

const FORM = [{ title: 'Teklif', fields: [
  { k: 'teklif_no', l: 'Teklif no' },
  { k: 'durum', l: 'Durum', t: 'sel', opts: TEKLIF_DURUM.map(d => d.k) },
  { k: 'tarih', l: 'Tarih', t: 'date' },
  { k: 'gecerlilik', l: 'Geçerlilik tarihi', t: 'date' },
  { k: 'firma_id', l: 'Firma', t: 'ref', ref: 'firmalar' },
  { k: 'kisi_id', l: 'Yetkili', t: 'ref', ref: 'kisiler' },
  { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler', full: true },
  { k: 'para_birimi', l: 'Para birimi', t: 'sel', opts: ['USD', 'EUR', 'TRY'] },
  { k: 'iskonto', l: 'Genel iskonto (%)', t: 'num' },
  { k: 'kdv', l: 'KDV (%)', t: 'num' },
]}];
const NOT_FORM = [{ title: 'Not ve koşullar', fields: [{ k: 'notlar', l: 'Teklif notu', t: 'area', rows: 3, ph: 'Teslim süresi, ödeme koşulu, garanti…' }] }];

// Revizyon: aynı kök numaralı teklifler (T-2026-014, T-2026-014-R2, -R3…)
export const revKok = no => String(no || '').replace(/-R\d+$/i, '');
export const revNo = no => { const m = /-R(\d+)$/i.exec(no || ''); return m ? +m[1] : 1; };
export function teklifForm(init = {}, after) {
  const t0 = init.id ? byId('teklifler', init.id) : null;
  const t = t0 ? { ...t0, kalemler: (t0.kalemler || []).map(k => ({ ...k })) } : {
    teklif_no: yeniTeklifNo(), tarih: today(), gecerlilik: gunEkle(today(), 15), para_birimi: 'USD', iskonto: 0, kdv: 20, durum: 'Taslak', kalemler: [], _new: true,
    ...init, ...(init.proje_id && !init.firma_id ? { firma_id: byId('projeler', init.proje_id)?.emut_id || byId('projeler', init.proje_id)?.alici_id || null } : {}),
  };
  t.kalemler = t.kalemler || [];
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${t._new ? 'Yeni teklif' : 'Teklif'}</p><h2 id="drawer-title">${esc(t.teklif_no || 'Teklif')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    ${t._new ? '' : `<div class="dh-actions"><button class="btn sm" data-a="pdf">PDF / yazdır</button><button class="btn sm" data-a="wa">WhatsApp</button><button class="btn sm" data-a="revize">Revize et</button><button class="btn sm ghost" data-a="kopya">Kopyasını oluştur</button><button class="btn sm ghost danger" data-a="sil">Sil</button></div>`}
    ${(() => { if (t._new) return ''; const rv = S.teklifler.filter(x => revKok(x.teklif_no) === revKok(t.teklif_no)).sort((a, b) => revNo(a.teklif_no) - revNo(b.teklif_no)); return rv.length > 1 ? `<div class="rev-list"><b>Revizyonlar</b>${rv.map(x => `<button type="button" class="chip ${x.id === t.id ? 'on' : ''}" data-rev="${x.id}">${esc(x.teklif_no)} · ${esc(x.durum)} · ${para(x.toplam, x.para_birimi)}</button>`).join('')}</div>` : ''; })()}
    <form class="dbody form" novalidate>${renderForm(FORM, t)}
      <fieldset class="fs"><legend>Ürünler</legend>
        <div class="kalem-ekle"><input data-ara list="tk-ul" placeholder="Ürün kodu ya da açıklama yaz (örn. HBL 152)" aria-label="Ürün ekle" autocomplete="off"><datalist id="tk-ul">${S.urunler.filter(u => urunBilgi(u.aciklama).w || u.birim_fiyat_usd).map(u => `<option value="${esc(u.kod + ' · ' + u.aciklama)}">`).join('')}</datalist><button type="button" class="btn sm" data-bos>Serbest kalem</button></div>
        <div data-kalemler></div>
        <div class="tk-top" data-top aria-live="polite"></div>
      </fieldset>
      ${renderForm(NOT_FORM, t)}
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button>${t._new ? '<button type="button" class="btn" data-kaydet-pdf>Kaydet ve PDF</button>' : ''}<button type="submit" class="btn primary">Kaydet</button></div>
    </form>`, { wide: true });
  panel.querySelectorAll('[data-rev]').forEach(b => b.onclick = () => { if (b.dataset.rev !== t.id) teklifForm({ id: b.dataset.rev }, after); });
  const form = panel.querySelector('form');
  bindForm(form, [...FORM, ...NOT_FORM], t, { onChange: o => { Object.assign(t, { iskonto: o.iskonto, kdv: o.kdv, para_birimi: o.para_birimi }); toplam(); } });
  const kbox = form.querySelector('[data-kalemler]');
  const toplam = () => {
    const h = hesapla(t), pb = t.para_birimi || 'USD';
    form.querySelector('[data-top]').innerHTML = t.kalemler.length ? `<dl><dt>Ara toplam</dt><dd>${para(h.ara, pb)}</dd>${h.isk ? `<dt>İskonto (%${num(t.iskonto)})</dt><dd>−${para(h.isk, pb)}</dd>` : ''}<dt>KDV hariç toplam</dt><dd><b>${para(h.net, pb)}</b></dd><dt>KDV (%${num(t.kdv)})</dt><dd>${para(h.kdv, pb)}</dd><dt>Genel toplam</dt><dd><b>${para(h.genel, pb)}</b></dd>${pb !== 'TRY' && tl(h.genel, pb) ? `<dt class="muted">TL karşılığı</dt><dd class="muted">≈ ${para(tl(h.genel, pb), 'TRY')}</dd>` : ''}</dl>${pb !== 'TRY' && kur() ? `<p class="hint r">Kur: ${kur()[pb]?.toLocaleString('tr-TR')} ₺ · ${esc(kur().kaynak || '')}</p>` : ''}` : '<p class="hint">Yukarıdan ürün ekle.</p>';
  };
  const ciz = () => {
    kbox.innerHTML = t.kalemler.length ? `<table class="tk-tbl"><thead><tr><th>Ürün</th><th class="r">Adet</th><th class="r">Birim fiyat</th><th class="r">İsk. %</th><th class="r">Tutar</th><th></th></tr></thead><tbody>${t.kalemler.map((k, i) => {
      const u = k.kod && S.urunler.find(x => x.kod === k.kod);
      return `<tr><td data-l="Ürün"><input data-k="ad" data-i="${i}" value="${esc(k.ad)}" aria-label="Ürün açıklaması"><small class="muted">${esc(k.kod || 'serbest kalem')}${u ? ` · stok ${num(u.stok)}${+k.adet > +u.stok ? ' <b class="neg">yetersiz</b>' : ''}` : ''}</small></td>
      <td data-l="Adet" class="r"><input data-k="adet" data-i="${i}" type="number" inputmode="decimal" value="${k.adet ?? ''}" aria-label="Adet"></td>
      <td data-l="Birim fiyat" class="r"><input data-k="birim_fiyat" data-i="${i}" type="number" inputmode="decimal" step="any" value="${k.birim_fiyat ?? ''}" aria-label="Birim fiyat"></td>
      <td data-l="İskonto %" class="r"><input data-k="iskonto" data-i="${i}" type="number" inputmode="decimal" value="${k.iskonto ?? ''}" aria-label="Kalem iskontosu"></td>
      <td data-l="Tutar" class="r num" data-tut="${i}"></td><td><button type="button" class="x" data-sil="${i}" aria-label="Kalemi sil">×</button></td></tr>`; }).join('')}</tbody></table>` : '';
    const tut = () => t.kalemler.forEach((k, i) => { const c = kbox.querySelector(`[data-tut="${i}"]`); if (c) c.textContent = para((+k.adet || 0) * (+k.birim_fiyat || 0) * (1 - (+k.iskonto || 0) / 100), t.para_birimi); });
    kbox.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => { const k = t.kalemler[+inp.dataset.i]; k[inp.dataset.k] = inp.type === 'number' ? (inp.value === '' ? null : parseFloat(inp.value)) : inp.value; tut(); toplam(); });
    kbox.querySelectorAll('[data-sil]').forEach(b => b.onclick = () => { t.kalemler.splice(+b.dataset.sil, 1); ciz(); });
    tut(); toplam();
  };
  const ara = form.querySelector('[data-ara]');
  ara.onchange = () => {
    const kod = ara.value.split(' · ')[0].trim();
    const u = S.urunler.find(x => x.kod === kod) || S.urunler.find(x => match(ara.value, x.kod, x.aciklama));
    if (!u) return toast('Ürün bulunamadı; listeden seç ya da “Serbest kalem” ekle.', 'err');
    t.kalemler.push({ kod: u.kod, ad: u.aciklama, adet: 1, birim_fiyat: u.birim_fiyat_usd || 0, iskonto: null });
    ara.value = ''; ciz(); kbox.querySelectorAll('[data-k="adet"]')[t.kalemler.length - 1]?.select();
  };
  form.querySelector('[data-bos]').onclick = () => { t.kalemler.push({ kod: null, ad: '', adet: 1, birim_fiyat: 0 }); ciz(); kbox.querySelectorAll('[data-k="ad"]')[t.kalemler.length - 1]?.focus(); };
  ciz();
  const kaydet = async () => {
    const o = await readForm(form, [...FORM, ...NOT_FORM], t);
    o.kalemler = t.kalemler.filter(k => k.ad || k.kod);
    o.toplam = Math.round(hesapla(o).net * 100) / 100;
    o.durum = o.durum || 'Taslak';
    const s = await app.db.save('teklifler', o);
    // Proje bağlantısı: teklif gönderilince proje aşaması, tutarı ve teklif numarası güncellenir
    const p = o.proje_id && byId('projeler', o.proje_id);
    if (p && ACIK.includes(p.durum)) {
      const yeni = { ...p };
      if (o.durum === 'Gönderildi' && ['Proje', 'İhale', 'Beklemede'].includes(p.durum)) yeni.durum = 'Teklif Verildi';
      if (!p.teklif_no) yeni.teklif_no = o.teklif_no;
      if (!p.tutar_usd && o.para_birimi === 'USD') yeni.tutar_usd = o.toplam;
      if (JSON.stringify(yeni) !== JSON.stringify(p)) {
        await app.db.save('projeler', yeni);
        if (yeni.durum !== p.durum) { await app.db.save('proje_gecmis', { proje_id: p.id, tarih: new Date().toISOString(), eski_durum: p.durum, yeni_durum: yeni.durum, notlar: 'Teklif ' + o.teklif_no }); toast(`${p.ad}: ${p.durum} → ${yeni.durum}`); }
      }
    }
    return s;
  };
  panel.querySelector('[data-kaydet-pdf]')?.addEventListener('click', async () => { const s = await kaydet(); closeDrawer(); app.refresh(); teklifYazdir(s); });
  form.onsubmit = async e => { e.preventDefault(); try { await kaydet(); toast('Teklif kaydedildi.'); closeDrawer(); after ? after() : app.refresh(); } catch (err) { console.error(err); toast('Kaydedilemedi: ' + err.message, 'err'); } };
  panel.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'pdf') teklifYazdir(t0);
    if (a === 'wa') { const k = byId('kisiler', t0.kisi_id); window.open(waLink(k?.telefon || byId('firmalar', t0.firma_id)?.telefon || '', teklifMetni(t0)), '_blank', 'noopener'); }
    if (a === 'revize') { const { id, created_at, updated_at, ...r } = t0; const kok = revKok(t0.teklif_no); const n = Math.max(1, ...S.teklifler.filter(x => revKok(x.teklif_no) === kok).map(x => revNo(x.teklif_no))) + 1; teklifForm({ ...r, teklif_no: `${kok}-R${n}`, tarih: today(), gecerlilik: gunEkle(today(), 15), durum: 'Taslak', kalemler: (t0.kalemler || []).map(k => ({ ...k })), notlar: [t0.notlar, `${t0.teklif_no} teklifinin revizyonu.`].filter(Boolean).join('\n') }, after); }
    if (a === 'kopya') { const { id, created_at, updated_at, ...r } = t0; teklifForm({ ...r, teklif_no: yeniTeklifNo(), tarih: today(), gecerlilik: gunEkle(today(), 15), durum: 'Taslak', kalemler: (t0.kalemler || []).map(k => ({ ...k })) }); }
    if (a === 'sil' && confirmBox(`${t0.teklif_no} silinsin mi?`)) { await app.db.del('teklifler', t0.id); toast('Teklif silindi.'); closeDrawer(); app.refresh(); }
  });
}

export function teklifMetni(t) {
  const h = hesapla(t), pb = t.para_birimi || 'USD', k = byId('kisiler', t.kisi_id), p = byId('projeler', t.proje_id);
  return [`Merhaba${k ? ' ' + k.ad_soyad.split(' ')[0] + ' Bey/Hanım' : ''},`, `${p ? p.ad + ' için ' : ''}aydınlatma teklifimiz (${t.teklif_no}):`, '',
    ...(t.kalemler || []).map(x => `• ${x.ad} — ${num(x.adet)} adet × ${para(x.birim_fiyat * (1 - (+x.iskonto || 0) / 100), pb)}`), '',
    `Toplam: ${para(h.net, pb)} + KDV${t.iskonto ? ` (%${num(t.iskonto)} iskonto dahil)` : ''}`, t.gecerlilik ? `Geçerlilik: ${tarih(t.gecerlilik)}` : '', t.notlar || '', '', benimAdim()].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').trim();
}

// Yazdırılabilir teklif (tarayıcıda “PDF olarak kaydet”)
export function teklifHtml(t) {
  const h = hesapla(t), pb = t.para_birimi || 'USD', f = byId('firmalar', t.firma_id), k = byId('kisiler', t.kisi_id), p = byId('projeler', t.proje_id);
  const bilgi = ayar('teklif_firma') || {};
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(t.teklif_no)} ${esc(f?.ad || '')}</title><style>
    @page { size: A4; margin: 16mm 14mm; } * { box-sizing: border-box; } body { font: 10.5pt/1.45 "Segoe UI", Roboto, Arial, sans-serif; color: #1D2B36; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #F5B700; padding-bottom: 10px; margin-bottom: 16px; }
    h1 { font-size: 20pt; margin: 0; letter-spacing: .5px; } .firm b { font-size: 13pt; } .firm, .meta { font-size: 9.5pt; color: #4A5A66; } .meta { text-align: right; }
    .to { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; } .to div { background: #F4F6F8; padding: 8px 10px; border-radius: 4px; } .to small { color: #66757F; display: block; text-transform: uppercase; font-size: 8pt; letter-spacing: .5px; }
    table { width: 100%; border-collapse: collapse; } th { background: #1D2B36; color: #fff; font-weight: 600; text-align: left; padding: 6px 8px; font-size: 9pt; } td { padding: 6px 8px; border-bottom: 1px solid #E3E8EC; vertical-align: top; } td small { color: #66757F; }
    .r { text-align: right; white-space: nowrap; } .tot { margin-left: auto; width: 55%; margin-top: 10px; } .tot td { border: 0; padding: 3px 8px; } .tot tr.g td { border-top: 2px solid #1D2B36; font-weight: 700; font-size: 12pt; }
    .not { margin-top: 18px; white-space: pre-wrap; font-size: 9.5pt; } footer { margin-top: 28px; font-size: 9pt; color: #4A5A66; display: flex; justify-content: space-between; }
  </style></head><body>
  <header><div class="firm"><b>${esc(bilgi.ad || 'EAE Aydınlatma')}</b><br>${esc(bilgi.iletisim || '').replace(/\n/g, '<br>')}</div><div class="meta"><h1>TEKLİF</h1>No: <b>${esc(t.teklif_no || '')}</b><br>Tarih: ${tarih(t.tarih)}${t.gecerlilik ? `<br>Geçerlilik: ${tarih(t.gecerlilik)}` : ''}</div></header>
  <div class="to"><div><small>Sayın</small><b>${esc(f?.ad || '')}</b>${k ? `<br>${esc(k.ad_soyad)}${k.unvan ? ' · ' + esc(k.unvan) : ''}` : ''}${f?.adres ? `<br>${esc(f.adres)}` : ''}</div><div><small>Proje</small><b>${esc(p?.ad || '—')}</b>${p ? `<br>${esc([p.osb, p.ilce, p.il].filter(Boolean).join(', '))}` : ''}</div></div>
  <table><thead><tr><th>#</th><th>Ürün</th><th class="r">Adet</th><th class="r">Birim fiyat</th>${(t.kalemler || []).some(x => +x.iskonto) ? '<th class="r">İsk.</th>' : ''}<th class="r">Tutar</th></tr></thead><tbody>
  ${(t.kalemler || []).map((x, i) => { const b = urunBilgi(x.ad); return `<tr><td>${i + 1}</td><td>${esc(x.ad)}${x.kod || b.w ? `<br><small>${esc([x.kod && 'Kod ' + x.kod, b.w && b.w + ' W', b.lm && num(b.lm) + ' lm', b.k && b.k + ' K'].filter(Boolean).join(' · '))}</small>` : ''}</td><td class="r">${num(x.adet)}</td><td class="r">${para(x.birim_fiyat, pb)}</td>${(t.kalemler || []).some(y => +y.iskonto) ? `<td class="r">${x.iskonto ? '%' + num(x.iskonto) : ''}</td>` : ''}<td class="r">${para((+x.adet || 0) * (+x.birim_fiyat || 0) * (1 - (+x.iskonto || 0) / 100), pb)}</td></tr>`; }).join('')}</tbody></table>
  <table class="tot"><tr><td>Ara toplam</td><td class="r">${para(h.ara, pb)}</td></tr>${h.isk ? `<tr><td>İskonto (%${num(t.iskonto)})</td><td class="r">−${para(h.isk, pb)}</td></tr>` : ''}<tr><td>KDV hariç toplam</td><td class="r"><b>${para(h.net, pb)}</b></td></tr><tr><td>KDV (%${num(t.kdv)})</td><td class="r">${para(h.kdv, pb)}</td></tr><tr class="g"><td>Genel toplam</td><td class="r">${para(h.genel, pb)}</td></tr></table>
  ${t.notlar || bilgi.kosullar ? `<div class="not">${esc([t.notlar, bilgi.kosullar].filter(Boolean).join('\n\n'))}</div>` : ''}
  <footer><span>${esc(benimAdim())}</span><span>${esc(bilgi.ad || 'EAE Aydınlatma')}</span></footer>
  </body></html>`;
}
export function teklifYazdir(t) {
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fr);
  fr.srcdoc = teklifHtml(t);
  fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast('Yazdırma açılamadı.', 'err'); } setTimeout(() => fr.remove(), 60000); };
  toast('Yazdırma ekranında “PDF olarak kaydet”i seç.');
}

// Teklif bilgileri (Ayarlar)
export function teklifAyarlari(root) {
  const b = ayar('teklif_firma') || {};
  root.innerHTML = `<div class="fld"><label for="tf-ad">Firma adı</label><input id="tf-ad" value="${esc(b.ad || 'EAE Aydınlatma')}"></div>
    <div class="fld"><label for="tf-il">İletişim bilgileri</label><textarea id="tf-il" rows="3" placeholder="Adres, telefon, e-posta">${esc(b.iletisim || '')}</textarea></div>
    <div class="fld"><label for="tf-k">Standart koşullar</label><textarea id="tf-k" rows="4" placeholder="Fiyatlarımıza KDV dahil değildir. Teslim: …  Ödeme: …  Garanti: …">${esc(b.kosullar || '')}</textarea></div>
    <div class="btnrow"><button type="button" class="btn primary" data-k>Kaydet</button></div>`;
  root.querySelector('[data-k]').onclick = async () => { await ayarYaz('teklif_firma', { ad: root.querySelector('#tf-ad').value.trim(), iletisim: root.querySelector('#tf-il').value.trim(), kosullar: root.querySelector('#tf-k').value.trim() }); toast('Teklif bilgileri kaydedildi.'); };
}

export function tekliflerView(el) {
  const f = F('teklifler', { q: '', durum: 'Tümü' });
  el.innerHTML = `<header class="vh"><div><h1>Teklifler</h1><p class="sum" data-sum></p></div><div class="vh-act"><button class="btn ghost" data-xls>Excel</button><button class="btn primary" data-new>Yeni teklif</button></div></header>
    <div class="filters"><input type="search" data-q placeholder="Teklif no, firma, proje ara" value="${esc(f.q)}" aria-label="Tekliflerde ara">
      <div class="seg" role="group" aria-label="Durum">${['Tümü', ...TEKLIF_DURUM.map(d => d.k)].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>
    <div data-rows></div>`;
  const draw = () => {
    const l = S.teklifler.filter(t => (f.durum === 'Tümü' || t.durum === f.durum) && match(f.q, t.teklif_no, firmaAd(t.firma_id), byId('projeler', t.proje_id)?.ad, t.notlar)).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '') || (b.teklif_no || '').localeCompare(a.teklif_no || ''));
    const acik = l.filter(t => ['Taslak', 'Gönderildi'].includes(t.durum) && t.para_birimi === 'USD');
    const son = new Map(); for (const t of S.teklifler) { const k = revKok(t.teklif_no); if (!son.has(k) || revNo(t.teklif_no) > revNo(son.get(k).teklif_no)) son.set(k, t); }   // her teklifin son revizyonu
    const sonlar = [...son.values()], kabul = sonlar.filter(t => t.durum === 'Kabul'), red = sonlar.filter(t => t.durum === 'Red');
    const oran = kabul.length + red.length ? Math.round(kabul.length / (kabul.length + red.length) * 100) : null;
    const usdTop = a => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(a.filter(t => (t.para_birimi || 'USD') === 'USD').reduce((s, t) => s + (+t.toplam || 0), 0));
    el.querySelector('[data-sum]').innerHTML = `${l.length} teklif · bekleyen ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(acik.reduce((a, t) => a + (+t.toplam || 0), 0))} $ · kazanma oranı <b>${oran == null ? '—' : '%' + oran}</b> <span class="muted">(${kabul.length} kabul ${usdTop(kabul)} $, ${red.length} red ${usdTop(red)} $; revizyonlarda son hali sayılır)</span>`;
    const t0 = today();
    el.querySelector('[data-rows]').innerHTML = l.length ? `<ul class="cards">${l.map(t => `<li><button type="button" class="card-btn" data-id="${t.id}"><span class="cb-top"><b>${esc(t.teklif_no || 'Teklif')}</b>${S.teklifler.some(x => x !== t && revKok(x.teklif_no) === revKok(t.teklif_no)) ? `<em class="rol-r">${revNo(t.teklif_no) > 1 ? 'Revizyon ' + revNo(t.teklif_no) : 'İlk teklif'}</em>` : ''}${tpill(t.durum)}</span>
      <span>${esc(firmaAd(t.firma_id) || '—')}</span><small class="muted">${esc(byId('projeler', t.proje_id)?.ad || '')}</small>
      <span class="cb-bot"><b class="num">${para(t.toplam, t.para_birimi)}</b><small class="${t.durum === 'Gönderildi' && t.gecerlilik && t.gecerlilik < t0 ? 'neg' : 'muted'}">${tarih(t.tarih)}${t.gecerlilik ? ' · geçerlilik ' + tarih(t.gecerlilik) : ''}</small></span></button></li>`).join('')}</ul>`
      : '<div class="empty"><p>Teklif yok. “Yeni teklif” ile ürün ekleyip PDF ya da WhatsApp olarak gönderebilirsin.</p></div>';
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => teklifForm({ id: b.dataset.id }));
  };
  let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); draw(); }, 200); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  el.querySelector('[data-new]').onclick = () => teklifForm({});
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`teklifler-${today()}.xlsx`, {
    'Teklifler': S.teklifler.map(t => ({ 'Teklif no': t.teklif_no, 'Tarih': t.tarih, 'Geçerlilik': t.gecerlilik, 'Durum': t.durum, 'Firma': firmaAd(t.firma_id), 'Yetkili': byId('kisiler', t.kisi_id)?.ad_soyad, 'Proje': byId('projeler', t.proje_id)?.ad, 'İskonto %': t.iskonto, 'KDV %': t.kdv, 'Toplam (KDV hariç)': t.toplam, 'Para birimi': t.para_birimi, 'Not': t.notlar })),
    'Kalemler': S.teklifler.flatMap(t => (t.kalemler || []).map(k => ({ 'Teklif no': t.teklif_no, 'Ürün kodu': k.kod, 'Ürün': k.ad, 'Adet': k.adet, 'Birim fiyat': k.birim_fiyat, 'İskonto %': k.iskonto, 'Tutar': Math.round((+k.adet || 0) * (+k.birim_fiyat || 0) * (1 - (+k.iskonto || 0) / 100) * 100) / 100, 'Para birimi': t.para_birimi }))) });
  draw();
}
