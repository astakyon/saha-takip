// Sevk ve irsaliye: numaralı sevk belgesi (irsaliye taslağı), stoktan düşme, kısmi sevk, taşıma bilgileri, teslim imzası / fotoğrafı / konumu,
// "yola çıktı" mesajı, sevk takvimi ve rota, iade belgesi, sevk raporu, muhasebe için Excel. Resmî e-İrsaliye entegratör üzerinden ayrıca kesilir.
import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, gunEkle, byId, firmaAd, fold, match, toast, openDrawer, closeDrawer, confirmBox, exportXlsx, waLink } from '../ui.js';
import { toplamaGiren } from '../teklif2.js';
import { renderForm, bindForm, readForm } from '../forms.js';
import { ayar, ayarYaz } from '../ayar.js';
import { izin, sahipMi, disKullanici } from '../yetki.js';
import { bayiStokYaz, ayniKalem, depoAdi, bayiDepolari, ANA_DEPO, usdCevir, PARA_BIRIMLERI } from '../stok.js';
import { firmaAdi } from '../profil.js';
import { benimAdim } from '../sablon.js';

export const SEVK_DURUM = ['Taslak', 'Hazırlanıyor', 'Yolda', 'Teslim edildi', 'İptal'];
export const GONDERIM = ['Kargo', 'Ambar', 'Kendi aracımız', 'Müşteri teslim aldı'];
const yaz = () => sahipMi() || izin('sevk') === 'yaz';
const bayiler = () => (S.bayiler || []).filter(b => (b.durum || 'Aktif') !== 'Ayrıldı');
const kalemToplam = x => (x.kalemler || []).reduce((a, k) => a + (+k.adet || 0), 0);

// Belge numarası: şirket ayarı (önek, yıl, sayaç uzunluğu); sayaç kendiliğinden artar
export function sevkNoDuzeni() { return { onek: 'SVK', yil: true, hane: 4, iade: 'IAD', ...(ayar('sevk_no') || {}) }; }
export function sonrakiSevkNo(tur = 'Sevk') {
  const d = sevkNoDuzeni(), onek = tur === 'İade' ? d.iade || 'IAD' : d.onek || 'SVK', y = today().slice(0, 4), bas = d.yil ? `${onek}-${y}-` : `${onek}-`;
  const n = Math.max(0, ...(S.sevkler || []).map(x => String(x.belge_no || '')).filter(b => b.startsWith(bas)).map(b => parseInt(b.slice(bas.length), 10) || 0));
  return bas + String(n + 1).padStart(+d.hane || 4, '0');
}
// Kısmi sevk: kaynak teklifin kalemlerinden önceki sevklerle gönderilen ve kalan
export function gonderilen(kaynak, haric) {
  const m = new Map();
  for (const x of S.sevkler || []) if (x.id !== haric && x.durum !== 'İptal' && x.tur !== 'İade' && ((kaynak.teklif_id && x.teklif_id === kaynak.teklif_id) || (kaynak.siparis_id && x.siparis_id === kaynak.siparis_id)))
    for (const k of x.kalemler || []) m.set(k.kod, (m.get(k.kod) || 0) + (+k.adet || 0));
  return m;
}
export function teklifSevkDurumu(t) {
  const g = gonderilen({ teklif_id: t.id }), l = (t.kalemler || []).filter(k => k.kod);
  if (!g.size) return null;
  return l.every(k => (g.get(k.kod) || 0) >= (+k.adet || 0)) ? 'Sevk edildi' : 'Kısmen sevk edildi';
}
// Stok: "Yolda" ya da "Teslim edildi" olunca (bir kez) bayi stoğundan düşer; iade belgesi stoğa geri ekler. İptal edilirse geri alınır.
export async function stokIsle(x, geriAl = false) {
  if (!x.firma_id || (!geriAl && x.stok_dustu) || (geriAl && !x.stok_dustu)) return 0;
  const isaret = (x.tur === 'İade' ? 1 : -1) * (geriAl ? -1 : 1), rows = [];
  for (const k of x.kalemler || []) {
    if (!k.kod || !(+k.adet)) continue;
    const s = (S.bayi_stok || []).find(y => ayniKalem(y, x.firma_id, k.kod, x.depo || null));
    rows.push(s ? { ...s, adet: Math.max(0, (+s.adet || 0) + isaret * +k.adet) } : { id: uuid(), firma_id: x.firma_id, depo: x.depo || null, kod: k.kod, aciklama: k.aciklama || null, birim: k.birim || null, adet: Math.max(0, isaret * +k.adet) });
  }
  if (rows.length) await bayiStokYaz(rows, { hareket: x.tur === 'İade' ? 'iade' : 'sevk', aciklama: `${x.belge_no}${geriAl ? ' iptal' : ''} · ${firmaAd(x.alici_id) || ''}` });
  await app.db.save('sevkler', { ...x, stok_dustu: !geriAl });
  return rows.length;
}
export async function sevkKaydet(o, onceki = null) {
  const x = { ...(onceki || {}), ...o };
  if (!x.belge_no) x.belge_no = sonrakiSevkNo(x.tur);
  if (!x.id) x.id = uuid();
  await app.db.save('sevkler', x);
  const yeni = S.sevkler.find(y => y.id === x.id) || x;
  if (['Yolda', 'Teslim edildi'].includes(yeni.durum) && !yeni.stok_dustu) await stokIsle(yeni);
  if (yeni.durum === 'İptal' && yeni.stok_dustu) await stokIsle(yeni, true);
  return S.sevkler.find(y => y.id === x.id) || yeni;
}

// ---------- Belge (PDF / yazdır) ----------
export function sevkHtml(x) {
  const bilgi = ayar('teklif_firma') || {}, al = byId('firmalar', x.alici_id), p = byId('projeler', x.proje_id), gond = byId('firmalar', x.firma_id);
  const satir = (l, v) => v ? `<tr><td>${l}</td><td><b>${esc(v)}</b></td></tr>` : '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(x.belge_no)}</title><style>
    @page { size: A4; margin: 14mm; } body { font: 10pt/1.45 Arial, sans-serif; color: #1D2B36; } h1 { font-size: 18pt; margin: 0; } header { display: flex; justify-content: space-between; border-bottom: 3px solid #1D2B36; padding-bottom: 8px; margin-bottom: 12px; }
    .iki { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; } .iki div { background: #F4F6F8; padding: 8px 10px; border-radius: 4px; } small { color: #66757F; text-transform: uppercase; font-size: 7.5pt; display: block; }
    table { width: 100%; border-collapse: collapse; } th { background: #1D2B36; color: #fff; text-align: left; padding: 5px 8px; font-size: 9pt; } td { padding: 5px 8px; border-bottom: 1px solid #E3E8EC; } .r { text-align: right; }
    .bilgi td { border: 0; padding: 2px 8px 2px 0; } .imza { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 28px; } .imza div { border-top: 1px solid #999; padding-top: 4px; min-height: 60px; } .imza img { max-height: 70px; }
    .not { margin-top: 10px; white-space: pre-wrap; } .uyari { margin-top: 18px; font-size: 8pt; color: #66757F; }
  </style></head><body>
  <header><div><b>${esc(bilgi.ad || firmaAdi())}</b><br>${esc(bilgi.iletisim || '').replace(/\n/g, '<br>')}</div><div class="r"><h1>${x.tur === 'İade' ? 'İADE BELGESİ' : 'SEVK İRSALİYESİ (TASLAK)'}</h1>No: <b>${esc(x.belge_no)}</b><br>Tarih: ${tarih(x.tarih || x.plan_tarih)}</div></header>
  <div class="iki"><div><small>${x.tur === 'İade' ? 'İade eden' : 'Alıcı'}</small><b>${esc(al?.ad || '')}</b>${al?.adres ? '<br>' + esc(al.adres) : ''}${al?.vergi_no ? `<br>VKN: ${esc(al.vergi_no)}${al.vergi_dairesi ? ' · ' + esc(al.vergi_dairesi) : ''}` : ''}</div>
    <div><small>Teslim yeri</small><b>${esc(x.teslim_yeri || p?.ad || '')}</b>${p ? '<br>Proje: ' + esc(p.ad) : ''}<br>Çıkış: ${esc(gond?.ad || '')}${x.depo ? ' · ' + esc(x.depo) : ''}</div></div>
  <table><thead><tr><th>#</th><th>Kod</th><th>Ürün</th><th class="r">Miktar</th><th>Birim</th></tr></thead><tbody>${(x.kalemler || []).map((k, i) => `<tr><td>${i + 1}</td><td>${esc(k.kod || '')}</td><td>${esc(k.aciklama || '')}</td><td class="r">${num(k.adet)}</td><td>${esc(k.birim || 'Adet')}</td></tr>`).join('')}</tbody></table>
  <table class="bilgi" style="margin-top:10px">${satir('Gönderim', x.gonderim)}${satir('Taşıyıcı', x.tasiyici)}${satir('Takip no', x.takip_no)}${satir('Plaka', x.plaka)}${satir('Şoför', [x.sofor, x.sofor_tel].filter(Boolean).join(' · '))}${satir('Palet / koli', [x.palet && x.palet + ' palet', x.koli && x.koli + ' koli'].filter(Boolean).join(', '))}${satir('Ağırlık / desi', [x.agirlik && num(x.agirlik) + ' kg', x.desi && num(x.desi) + ' desi'].filter(Boolean).join(', '))}</table>
  ${x.notlar ? `<div class="not">${esc(x.notlar)}</div>` : ''}
  <div class="imza"><div><small>Teslim eden</small>${esc(benimAdim() || '')}</div><div><small>Teslim alan</small>${esc(x.teslim_alan || '')}${x.teslim_imza ? `<br><img src="${x.teslim_imza}" alt="İmza">` : ''}${x.teslim_zaman ? `<br>${tarih(String(x.teslim_zaman).slice(0, 10))}` : ''}</div></div>
  <p class="uyari">Bu belge sevk bilgisidir; resmî e-İrsaliye yerine geçmez. e-İrsaliye mükellefleri resmî belgeyi entegratör ya da muhasebe programı üzerinden keser.</p>
  </body></html>`;
}
export function sevkYazdir(x) {
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fr); fr.srcdoc = sevkHtml(x);
  fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast('Yazdırma açılamadı.', 'err'); } setTimeout(() => fr.remove(), 60000); };
  toast('Yazdırma ekranında “PDF olarak kaydet”i seç.');
}
const kalemMetni = x => (x.kalemler || []).map(k => `• ${k.kod ? k.kod + ' ' : ''}${k.aciklama || ''}: ${num(k.adet)} ${k.birim || 'adet'}`).join('\n');
export const yolaCiktiMetni = x => `${x.belge_no} numaralı sevkiniz yola çıktı.${x.plaka ? `\nAraç: ${x.plaka}` : ''}${x.sofor ? `\nŞoför: ${x.sofor}${x.sofor_tel ? ' (' + x.sofor_tel + ')' : ''}` : ''}${x.tasiyici ? `\nTaşıyıcı: ${x.tasiyici}` : ''}${x.takip_no ? `\nTakip no: ${x.takip_no}` : ''}\n\n${kalemMetni(x)}`;
const aliciTel = x => (S.kisiler || []).find(k => k.firma_id === x.alici_id && k.telefon)?.telefon || byId('firmalar', x.alici_id)?.telefon || '';

// ---------- Form ----------
export function sevkFormu(init = {}, sonra) {
  const x0 = init.id ? { ...S.sevkler.find(y => y.id === init.id) } : { tur: 'Sevk', durum: 'Taslak', plan_tarih: today(), kalemler: [], tasima_pb: 'TRY', odeyen: 'Gönderici', ...init, _new: true };
  let kalemler = (x0.kalemler || []).map(k => ({ ...k }));
  const kaynak = { teklif_id: x0.teklif_id, siparis_id: x0.siparis_id }, once = gonderilen(kaynak, x0.id);
  const tasiyicilar = () => [...new Set([...(S.sevkler || []).map(y => y.tasiyici).filter(Boolean), ...(ayar('tasiyicilar') || [])])];
  const FM = [{ title: 'Belge', fields: [{ k: 'tur', l: 'Tür', t: 'sel', opts: ['Sevk', 'İade'] }, { k: 'durum', l: 'Durum', t: 'sel', opts: SEVK_DURUM }, { k: 'plan_tarih', l: 'Planlanan tarih', t: 'date' }, { k: 'tarih', l: 'Sevk tarihi', t: 'date' },
      { k: 'firma_id', l: 'Çıkış (bayi stoğu)', t: 'sel', opts: bayiler().map(b => ({ v: b.firma_id, l: firmaAd(b.firma_id) })) }, { k: 'depo', l: 'Depo', t: 'combo', opts: () => bayiDepolari((S.bayiler || []).find(b => b.firma_id === x0.firma_id)).filter(Boolean), ph: ANA_DEPO },
      { k: 'alici_id', l: 'Alıcı', t: 'ref', ref: 'firmalar' }, { k: 'proje_id', l: 'Proje', t: 'ref', ref: 'projeler' }, { k: 'teslim_yeri', l: 'Teslim yeri / adres', full: true }] },
    { title: 'Taşıma', kapali: o => !o.gonderim, fields: [{ k: 'gonderim', l: 'Gönderim şekli', t: 'sel', opts: GONDERIM }, { k: 'tasiyici', l: 'Kargo / ambar firması', t: 'combo', opts: tasiyicilar }, { k: 'takip_no', l: 'Takip no' },
      { k: 'tasima_ucreti', l: 'Taşıma ücreti', t: 'num' }, { k: 'tasima_pb', l: 'Para birimi', t: 'sel', opts: PARA_BIRIMLERI }, { k: 'odeyen', l: 'Ödeyen', t: 'sel', opts: ['Gönderici', 'Alıcı'] },
      { k: 'palet', l: 'Palet', t: 'num' }, { k: 'koli', l: 'Koli', t: 'num' }, { k: 'agirlik', l: 'Ağırlık (kg)', t: 'num' }, { k: 'desi', l: 'Desi', t: 'num' },
      { k: 'plaka', l: 'Plaka' }, { k: 'sofor', l: 'Şoför' }, { k: 'sofor_tel', l: 'Şoför telefonu', t: 'tel' }] },
    { title: 'Not', kapali: true, fields: [{ k: 'notlar', l: 'Not', t: 'area', full: true }] }];
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(x0.belge_no || 'Yeni belge')}</p><h2 id="drawer-title">${x0._new ? (x0.tur === 'İade' ? 'İade belgesi' : 'Sevk belgesi') : esc(x0.belge_no)}</h2></div>
    ${x0._new ? '' : `<div class="dh-actions"><button class="btn sm" data-sa="pdf">PDF / yazdır</button><button class="btn sm" data-sa="wa">WhatsApp</button><button class="btn sm" data-sa="eposta">E-posta</button><button class="btn sm" data-sa="yola">Yola çıktı mesajı</button><button class="btn sm" data-sa="teslim">Teslim alındı</button>${x0.tur !== 'İade' ? '<button class="btn sm" data-sa="iade">İade belgesi</button>' : ''}</div>`}
    <button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>${renderForm(FM, x0)}
      <h3>Kalemler</h3><div class="tbl-wrap"><table class="tbl sv-k"><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Miktar</th><th>Birim</th>${once.size || kalemler.some(k => k.siparis_adet) ? '<th class="r">Sipariş / önce</th>' : ''}<th></th></tr></thead><tbody data-kl></tbody></table></div>
      <div class="frow"><input data-kara placeholder="Ürün kodu ya da adı" list="sv-urun" autocomplete="off" aria-label="Kalem ekle"><datalist id="sv-urun"></datalist><button type="button" class="btn sm" data-kekle>Ekle</button></div>
      ${x0.teslim_zaman ? `<p class="hint">Teslim alındı: ${tarih(String(x0.teslim_zaman).slice(0, 10))}${x0.teslim_alan ? ' · ' + esc(x0.teslim_alan) : ''}${x0.teslim_konum ? ` · <a target="_blank" rel="noopener" href="https://maps.google.com/?q=${esc(x0.teslim_konum)}">konum</a>` : ''}</p>${x0.teslim_imza ? `<img class="sv-imza" src="${x0.teslim_imza}" alt="Teslim alan imzası">` : ''}` : ''}
      <p class="hint">“Yolda” ya da “Teslim edildi” olunca kalemler çıkış stoğundan bir kez düşer (iade belgesi ekler); “İptal” geri alır. Hareket kaydına belge numarasıyla yazılır.</p>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`, { wide: true });
  const form = p.querySelector('form'); bindForm(form, FM, x0);
  const firmaSel = form.querySelector('[name=firma_id]');
  const urunListe = () => { const fid = firmaSel?.value, l = (S.bayi_stok || []).filter(s => s.firma_id === fid && s.aktif !== false); p.querySelector('#sv-urun').innerHTML = [...new Map([...l, ...(S.urunler || [])].map(u => [u.kod, u])).values()].slice(0, 800).map(u => `<option value="${esc(u.kod)}">${esc(u.aciklama || '')}${u.firma_id ? ' · stok ' + num(u.adet) : ''}</option>`).join(''); };
  const kCiz = () => {
    const fid = firmaSel?.value, dp = String(form.querySelector('[name=depo]')?.value || '').trim() || null;
    p.querySelector('[data-kl]').innerHTML = kalemler.map((k, i) => { const st = (S.bayi_stok || []).find(s => ayniKalem(s, fid, k.kod, dp)); const o = once.get(k.kod) || 0;
      return `<tr><td class="mono">${esc(k.kod || '')}</td><td>${esc(k.aciklama || '')}${st ? `<br><small class="muted">stokta ${num(st.adet)}</small>` : k.kod ? '<br><small class="neg">çıkış stoğunda yok</small>' : ''}</td><td class="r"><input type="number" inputmode="decimal" step="any" min="0" class="sy-say" data-km="${i}" value="${k.adet ?? ''}" aria-label="${esc(k.kod)} miktar"></td><td>${esc(k.birim || 'Adet')}</td>${once.size || kalemler.some(y => y.siparis_adet) ? `<td class="r num">${k.siparis_adet ? num(k.siparis_adet) : '—'}${o ? ` / ${num(o)}` : ''}</td>` : ''}<td><button type="button" class="btn sm ghost" data-ksil="${i}" aria-label="${esc(k.kod)} çıkar">×</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Kalem yok.</td></tr>';
    p.querySelectorAll('[data-km]').forEach(i => i.onchange = () => { kalemler[+i.dataset.km].adet = +i.value || 0; });
    p.querySelectorAll('[data-ksil]').forEach(b => b.onclick = () => { kalemler.splice(+b.dataset.ksil, 1); kCiz(); });
  };
  const ekle = () => { const v = p.querySelector('[data-kara]').value.trim(); if (!v) return; const fid = firmaSel?.value;
    const s = (S.bayi_stok || []).find(y => y.firma_id === fid && (y.kod === v || fold(y.aciklama || '') === fold(v))) || (S.urunler || []).find(u => u.kod === v || fold(u.aciklama || '') === fold(v));
    kalemler.push({ kod: s?.kod || v, aciklama: s?.aciklama || (s ? '' : v), birim: s?.birim || 'Adet', adet: 1 }); p.querySelector('[data-kara]').value = ''; kCiz(); };
  p.querySelector('[data-kekle]').onclick = ekle; p.querySelector('[data-kara]').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } };
  firmaSel?.addEventListener('change', () => { urunListe(); kCiz(); }); form.querySelector('[name=depo]')?.addEventListener('change', kCiz);
  urunListe(); kCiz();
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, x0);
    o.depo = String(o.depo || '').trim(); if (!o.depo || fold(o.depo) === fold(ANA_DEPO)) o.depo = null;
    o.kalemler = kalemler.filter(k => k.kod || k.aciklama);
    if (!o.alici_id && o.tur !== 'İade') return toast('Alıcıyı seç.', 'err');
    if (!o.kalemler.length) return toast('En az bir kalem ekle.', 'err');
    if (['Yolda', 'Teslim edildi'].includes(o.durum) && !o.tarih) o.tarih = today();
    if (['Yolda', 'Teslim edildi'].includes(o.durum) && !x0.stok_dustu && o.firma_id) {
      const eksik = o.kalemler.filter(k => { const st = (S.bayi_stok || []).find(s => ayniKalem(s, o.firma_id, k.kod, o.depo)); return o.tur !== 'İade' && (+st?.adet || 0) < (+k.adet || 0); });
      if (eksik.length && !confirmBox(`Çıkış stoğu yetmiyor:\n${eksik.map(k => `• ${k.kod}: ${num(k.adet)} isteniyor`).join('\n')}\n\nYine de kaydedilsin mi? (stok sıfırın altına inmez)`)) return;
    }
    if (o.tasiyici && !(ayar('tasiyicilar') || []).includes(o.tasiyici)) await ayarYaz('tasiyicilar', [...(ayar('tasiyicilar') || []), o.tasiyici]);
    const { _new, ...temiz } = x0;
    try { const r = await sevkKaydet({ ...temiz, ...o, teklif_id: x0.teklif_id || null, siparis_id: x0.siparis_id || null }, x0._new ? null : S.sevkler.find(y => y.id === x0.id));
      toast(`${r.belge_no} kaydedildi${r.stok_dustu && !x0.stok_dustu ? '; stok güncellendi' : ''}.`); closeDrawer(true); sonra?.(r); } catch (er) { toast('Kaydedilemedi: ' + er.message, 'err'); } };
  p.querySelectorAll('[data-sa]').forEach(b => b.onclick = async () => { const x = S.sevkler.find(y => y.id === x0.id) || x0, a = b.dataset.sa;
    if (a === 'pdf') sevkYazdir(x);
    else if (a === 'wa') window.open(waLink(aliciTel(x), `${x.tur === 'İade' ? 'İade belgesi' : 'Sevk belgesi'} ${x.belge_no}\n${tarih(x.tarih || x.plan_tarih)}${x.teslim_yeri ? '\nTeslim yeri: ' + x.teslim_yeri : ''}\n\n${kalemMetni(x)}`), '_blank', 'noopener');
    else if (a === 'eposta') { const ep = (S.kisiler || []).find(k => k.firma_id === x.alici_id && k.eposta)?.eposta || byId('firmalar', x.alici_id)?.eposta || ''; location.href = `mailto:${encodeURIComponent(ep)}?subject=${encodeURIComponent(`${x.belge_no} ${x.tur === 'İade' ? 'iade' : 'sevk'} belgesi`)}&body=${encodeURIComponent(`${kalemMetni(x)}\n\n${benimAdim() || ''}`)}`; }
    else if (a === 'yola') { if (x.durum !== 'Yolda' && x.durum !== 'Teslim edildi') { await sevkKaydet({ durum: 'Yolda', tarih: x.tarih || today() }, x); toast(`${x.belge_no} yolda; stok güncellendi.`); } window.open(waLink(aliciTel(x), yolaCiktiMetni(S.sevkler.find(y => y.id === x.id) || x)), '_blank', 'noopener'); }
    else if (a === 'teslim') teslimPenceresi(x, () => sonra?.());
    else if (a === 'iade') { closeDrawer(true); sevkFormu({ tur: 'İade', durum: 'Taslak', firma_id: x.firma_id, depo: x.depo, alici_id: x.alici_id, proje_id: x.proje_id, teklif_id: x.teklif_id, notlar: `${x.belge_no} iadesi`, kalemler: (x.kalemler || []).map(k => ({ ...k, adet: 0, siparis_adet: k.adet })) }, sonra); }
  });
}
// Teslim alındı: parmakla imza, teslim fotoğrafı, konum; belge "Teslim edildi" olur
export function teslimPenceresi(x, sonra) {
  const FM = [{ title: 'Teslim', fields: [{ k: 'teslim_alan', l: 'Teslim alan', req: true }, { k: 'teslim_foto', l: 'Teslim fotoğrafı', t: 'photos' }] }];
  const o0 = { teslim_alan: x.teslim_alan || '', teslim_foto: x.teslim_foto || [] };
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(x.belge_no)}</p><h2 id="drawer-title">Teslim alındı</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>${renderForm(FM, o0)}<label class="fld"><span>İmza (parmakla)</span></label><canvas class="sv-cizim" width="600" height="200" data-imza aria-label="İmza alanı"></canvas><div class="btnrow"><button type="button" class="btn sm ghost" data-temizle>Temizle</button><label class="chk"><input type="checkbox" data-konum checked> <span>Konumu ekle</span></label></div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Teslimi kaydet</button></div></form>`);
  const form = p.querySelector('form'); bindForm(form, FM, o0);
  const cv = p.querySelector('[data-imza]'), cx = cv.getContext('2d'); let ciz = false, bos = true;
  cx.lineWidth = 3; cx.lineCap = 'round'; cx.strokeStyle = '#1D2B36';
  const nokta = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.onpointerdown = e => { ciz = true; bos = false; cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.moveTo(...nokta(e)); };
  cv.onpointermove = e => { if (!ciz) return; cx.lineTo(...nokta(e)); cx.stroke(); };
  cv.onpointerup = () => { ciz = false; };
  p.querySelector('[data-temizle]').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); bos = true; };
  form.onsubmit = async e => { e.preventDefault(); const o = await readForm(form, FM, o0); if (!o.teslim_alan) return toast('Teslim alanın adını yaz.', 'err');
    let konum = null;
    if (p.querySelector('[data-konum]').checked && navigator.geolocation) konum = await new Promise(r => navigator.geolocation.getCurrentPosition(g => r(`${g.coords.latitude.toFixed(6)},${g.coords.longitude.toFixed(6)}`), () => r(null), { timeout: 8000, maximumAge: 60000 }));
    await sevkKaydet({ ...o, teslim_imza: bos ? null : cv.toDataURL('image/png'), teslim_konum: konum, teslim_zaman: new Date().toISOString(), durum: 'Teslim edildi', tarih: x.tarih || today() }, S.sevkler.find(y => y.id === x.id) || x);
    toast('Teslim kaydedildi.'); closeDrawer(true); sonra?.(); };
}

// ---------- Liste, takvim, rapor ----------
export function sevkView(el) {
  const f = F('sevk', { q: '', sek: 'liste', durum: '' });
  const d = disKullanici(), l0 = (S.sevkler || []).filter(x => !d || x.firma_id === d.firma_id || x.alici_id === d.firma_id);
  const yz = yaz() || !!d;
  el.innerHTML = `<header class="vh"><div><h1>Sevk ve irsaliye</h1><p class="sum" data-sum></p></div><div class="vh-act">${yz ? '<button class="btn primary" data-yeni>+ Sevk belgesi</button><button class="btn" data-tekliften>Tekliften</button><button class="btn" data-siparisten>Siparişten</button><button class="btn ghost" data-yiade>+ İade belgesi</button>' : ''}<button class="btn ghost" data-xlsx>Muhasebe için Excel</button>${yz && !d ? '<button class="btn ghost" data-noayar>Numara düzeni</button>' : ''}</div></header>
    <div class="frow"><input type="search" data-q value="${esc(f.q)}" placeholder="Belge no, alıcı, proje, takip no" aria-label="Ara">
      <div class="seg" role="group" aria-label="Görünüm">${[['liste', 'Liste'], ['takvim', 'Takvim'], ['rapor', 'Rapor']].map(([k, t]) => `<button type="button" data-sek="${k}" class="${f.sek === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <select data-durum aria-label="Durum"><option value="">Bütün durumlar</option>${SEVK_DURUM.map(s => `<option ${f.durum === s ? 'selected' : ''}>${s}</option>`).join('')}<option value="_bekleyen" ${f.durum === '_bekleyen' ? 'selected' : ''}>Bekleyen</option><option value="_geciken" ${f.durum === '_geciken' ? 'selected' : ''}>Geciken</option></select></div>
    <div data-l></div>`;
  const bekleyen = x => ['Taslak', 'Hazırlanıyor', 'Yolda'].includes(x.durum), geciken = x => bekleyen(x) && x.plan_tarih && x.plan_tarih < today();
  const ciz = () => {
    const l = l0.filter(x => match(f.q, x.belge_no, firmaAd(x.alici_id), byId('projeler', x.proje_id)?.ad, x.takip_no, x.teslim_yeri, x.tasiyici) && (!f.durum || (f.durum === '_bekleyen' ? bekleyen(x) : f.durum === '_geciken' ? geciken(x) : x.durum === f.durum)))
      .sort((a, b) => String(b.plan_tarih || b.tarih || '').localeCompare(String(a.plan_tarih || a.tarih || '')));
    el.querySelector('[data-sum]').textContent = `${l0.length} belge · ${l0.filter(bekleyen).length} bekleyen · ${l0.filter(geciken).length} geciken`;
    const lc = el.querySelector('[data-l]');
    if (f.sek === 'takvim') {
      const gunler = new Map(); for (const x of l0.filter(x => bekleyen(x) || (x.plan_tarih && x.plan_tarih >= gunEkle(today(), -7)))) { const g = x.plan_tarih || x.tarih || today(); (gunler.get(g) || gunler.set(g, []).get(g)).push(x); }
      const gl = [...gunler.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      lc.innerHTML = gl.length ? gl.map(([g, xs]) => { const nok = xs.map(x => x.teslim_yeri || byId('projeler', x.proje_id)?.adres || firmaAd(x.alici_id)).filter(Boolean);
        return `<section class="card sv-gun"><h3>${tarih(g)}${g < today() ? ' <em class="flag">geçti</em>' : g === today() ? ' <em class="flag soft">bugün</em>' : ''} <small class="muted">${xs.length} sevk</small>${nok.length ? ` <a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/${nok.map(encodeURIComponent).join('/')}">Haritada rota</a>` : ''}</h3>
          <ul class="list">${xs.map(x => `<li><button type="button" class="linkbtn" data-ac="${x.id}">${esc(x.belge_no)}</button> <span class="muted">${esc(firmaAd(x.alici_id) || '')} · ${esc(x.teslim_yeri || byId('projeler', x.proje_id)?.ad || '')} · ${num(kalemToplam(x))} birim · ${esc(x.durum)}</span></li>`).join('')}</ul></section>`; }).join('')
        : '<div class="empty"><p>Planlanmış sevk yok.</p></div>';
    } else if (f.sek === 'rapor') {
      const ay = x => String(x.tarih || x.plan_tarih || '').slice(0, 7), sev = l0.filter(x => x.durum !== 'İptal' && x.tur !== 'İade');
      const grup = (anahtar, ad) => { const m = new Map(); for (const x of sev) { const k = anahtar(x) || '—'; const e = m.get(k) || { ad: ad(k), n: 0, birim: 0, tasima: 0 }; e.n++; e.birim += kalemToplam(x); e.tasima += usdCevir(+x.tasima_ucreti || 0, x.tasima_pb || 'TRY'); m.set(k, e); } return [...m.values()].sort((a, b) => b.n - a.n); };
      const tablo = (bas, rows) => `<h3>${bas}</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">Sevk</th><th class="r">Birim</th><th class="r">Taşıma (USD)</th></tr></thead><tbody>${rows.slice(0, 30).map(r => `<tr><td>${esc(r.ad)}</td><td class="r num">${r.n}</td><td class="r num">${num(r.birim)}</td><td class="r num">${r.tasima ? usd(Math.round(r.tasima)) : ''}</td></tr>`).join('')}</tbody></table></div>`;
      lc.innerHTML = `<div class="sv-rapor">${tablo('Ay', grup(ay, k => k)) + tablo('Bayi (çıkış)', grup(x => x.firma_id, k => firmaAd(k) || '—')) + tablo('Proje', grup(x => x.proje_id, k => byId('projeler', k)?.ad || '—')) + tablo('Taşıyıcı (taşıma maliyeti)', grup(x => x.tasiyici, k => k))}
        <h3>Geciken teslimler</h3>${l0.filter(geciken).length ? `<ul class="list">${l0.filter(geciken).map(x => `<li><button type="button" class="linkbtn" data-ac="${x.id}">${esc(x.belge_no)}</button> <span class="muted">${esc(firmaAd(x.alici_id) || '')} · plan ${tarih(x.plan_tarih)} · ${esc(x.durum)}</span></li>`).join('')}</ul>` : '<p class="muted">Geciken teslim yok.</p>'}</div>`;
    } else {
      lc.innerHTML = l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Belge</th><th>Tarih</th><th>Alıcı</th><th>Proje / teslim yeri</th><th class="r">Birim</th><th>Gönderim</th><th>Durum</th></tr></thead><tbody>${l.slice(0, 400).map(x => `<tr><td><button type="button" class="linkbtn mono" data-ac="${x.id}">${esc(x.belge_no)}</button>${x.tur === 'İade' ? ' <em class="flag soft">iade</em>' : ''}</td><td>${tarih(x.tarih || x.plan_tarih)}</td><td>${esc(firmaAd(x.alici_id) || '')}</td><td>${esc(byId('projeler', x.proje_id)?.ad || x.teslim_yeri || '')}</td><td class="r num">${num(kalemToplam(x))}</td><td>${esc([x.gonderim, x.tasiyici].filter(Boolean).join(' · '))}</td><td>${esc(x.durum)}${geciken(x) ? ' <em class="flag">gecikti</em>' : ''}${x.teslim_imza ? ' <em class="flag soft">imzalı</em>' : ''}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty"><p>${l0.length ? 'Süzgece uyan belge yok.' : 'Henüz sevk belgesi yok.'}</p>${!l0.length && yz ? '<p class="hint">“+ Sevk belgesi” ile başla ya da onaylanmış bir tekliften oluştur. Sevk “Yolda” olunca kalemler bayi stoğundan düşer.</p>' : ''}</div>`;
    }
    el.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => sevkFormu({ id: b.dataset.ac }, () => sevkView(el)));
  };
  el.querySelector('[data-q]').oninput = e => { f.q = e.target.value; saveFilters(); ciz(); };
  el.querySelectorAll('[data-sek]').forEach(b => b.onclick = () => { f.sek = b.dataset.sek; saveFilters(); el.querySelectorAll('[data-sek]').forEach(y => y.classList.toggle('on', y === b)); ciz(); });
  el.querySelector('[data-durum]').onchange = e => { f.durum = e.target.value; saveFilters(); ciz(); };
  el.querySelector('[data-yeni]')?.addEventListener('click', () => sevkFormu(d ? { firma_id: d.firma_id } : {}, () => sevkView(el)));
  el.querySelector('[data-yiade]')?.addEventListener('click', () => sevkFormu({ tur: 'İade', ...(d ? { firma_id: d.firma_id } : {}) }, () => sevkView(el)));
  el.querySelector('[data-tekliften]')?.addEventListener('click', () => kaynakSec('teklif', () => sevkView(el)));
  el.querySelector('[data-siparisten]')?.addEventListener('click', () => kaynakSec('siparis', () => sevkView(el)));
  el.querySelector('[data-noayar]')?.addEventListener('click', () => numaraAyari());
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`sevkler-${today()}`, { Sevkler: l0.map(x => ({ 'Belge no': x.belge_no, Tür: x.tur, Durum: x.durum, Tarih: x.tarih || x.plan_tarih, Alıcı: firmaAd(x.alici_id), 'Alıcı VKN': byId('firmalar', x.alici_id)?.vergi_no || null, Proje: byId('projeler', x.proje_id)?.ad || null, 'Teslim yeri': x.teslim_yeri, Çıkış: firmaAd(x.firma_id), Depo: x.depo ? x.depo : null, Gönderim: x.gonderim, Taşıyıcı: x.tasiyici, 'Takip no': x.takip_no, 'Taşıma ücreti': +x.tasima_ucreti || null, 'Taşıma PB': x.tasima_ucreti ? x.tasima_pb : null, Ödeyen: x.odeyen, Palet: x.palet, Koli: x.koli, 'Ağırlık': x.agirlik, Desi: x.desi, Plaka: x.plaka, Şoför: x.sofor, 'Teslim alan': x.teslim_alan })),
    Kalemler: l0.flatMap(x => (x.kalemler || []).map(k => ({ 'Belge no': x.belge_no, Tarih: x.tarih || x.plan_tarih, Alıcı: firmaAd(x.alici_id), Kod: k.kod, Ürün: k.aciklama, Miktar: +k.adet || 0, Birim: k.birim || 'Adet' }))) });
  ciz();
}
// Tekliften / siparişten: kaynak seçilir, kalemler (kalan miktarla) gelir
// Teklif kalemleriyle sevk belgesi (alternatifli teklifte yalnız seçili seçenek); önceki sevkler düşülür
export function tekliftenSevk(x, sonra) {
  const g = gonderilen({ teklif_id: x.id });
  sevkFormu({ teklif_id: x.id, alici_id: x.firma_id, proje_id: x.proje_id, teslim_yeri: x.teslim_yeri || null, notlar: `Teklif ${x.teklif_no || ''}`.trim(), kalemler: toplamaGiren(x).filter(k => k.kod || k.ad).map(k => ({ kod: k.kod || '', aciklama: k.ad || '', birim: (S.urunler || []).find(u => u.kod === k.kod)?.birim || 'Adet', siparis_adet: +k.adet || 0, adet: Math.max(0, (+k.adet || 0) - (g.get(k.kod) || 0)) })).filter(k => k.adet > 0 || !g.size) }, sonra);
}
function kaynakSec(tur, sonra) {
  const l = tur === 'teklif' ? (S.teklifler || []).filter(t => ['Kabul', 'Gönderildi'].includes(t.durum) && (t.kalemler || []).length).sort((a, b) => String(b.tarih).localeCompare(String(a.tarih))).slice(0, 80)
    : (S.siparisler || []).filter(x => !x.rapor_disi).sort((a, b) => String(b.tarih).localeCompare(String(a.tarih))).slice(0, 80);
  const p = openDrawer(`<header class="dh"><div><h2 id="drawer-title">${tur === 'teklif' ? 'Tekliften sevk' : 'Siparişten sevk'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">${l.length ? `<ul class="list">${l.map(x => `<li><button type="button" class="linkbtn" data-ks="${x.id}">${esc(tur === 'teklif' ? x.teklif_no || 'Teklif' : x.siparis_no || x.belge_no || 'Sipariş')}</button> <span class="muted">${esc(firmaAd(x.firma_id) || x.musteri_adi || '')} · ${tarih(x.tarih)}${tur === 'teklif' ? ' · ' + esc(x.durum) + (teklifSevkDurumu(x) ? ' · ' + teklifSevkDurumu(x) : '') : ''}</span></li>`).join('')}</ul>` : `<p class="muted">${tur === 'teklif' ? 'Kalemli, gönderilmiş ya da kabul edilmiş teklif yok.' : 'Sipariş yok.'}</p>`}</div>`);
  p.querySelectorAll('[data-ks]').forEach(b => b.onclick = () => { const x = l.find(y => y.id === b.dataset.ks); closeDrawer(true);
    if (tur === 'teklif') tekliftenSevk(x, sonra);
    else sevkFormu({ siparis_id: x.id, alici_id: x.firma_id, proje_id: x.proje_id, notlar: `Sipariş ${x.siparis_no || ''}${x.referans ? ' · ' + x.referans : ''}`.trim(), kalemler: [] }, sonra); });
}
function numaraAyari() {
  const d = sevkNoDuzeni();
  const p = openDrawer(`<header class="dh"><div><h2 id="drawer-title">Sevk numara düzeni</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate><label class="fld"><span>Sevk öneki</span><input name="onek" value="${esc(d.onek)}"></label><label class="fld"><span>İade öneki</span><input name="iade" value="${esc(d.iade)}"></label>
    <label class="chk"><input type="checkbox" name="yil" ${d.yil ? 'checked' : ''}> <span>Yılı ekle</span></label><label class="fld"><span>Sayaç hanesi</span><input name="hane" type="number" value="${+d.hane || 4}"></label>
    <p class="hint" data-ornek></p><div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  const oku = () => ({ onek: p.querySelector('[name=onek]').value.trim() || 'SVK', iade: p.querySelector('[name=iade]').value.trim() || 'IAD', yil: p.querySelector('[name=yil]').checked, hane: Math.min(8, Math.max(2, +p.querySelector('[name=hane]').value || 4)) });
  const orn = () => { const o = oku(); p.querySelector('[data-ornek]').textContent = `Örnek: ${o.onek}-${o.yil ? today().slice(0, 4) + '-' : ''}${'1'.padStart(o.hane, '0')}`; };
  p.querySelectorAll('input').forEach(i => i.oninput = orn); orn();
  p.querySelector('form').onsubmit = async e => { e.preventDefault(); await ayarYaz('sevk_no', oku()); toast('Numara düzeni kaydedildi.'); closeDrawer(true); };
}
