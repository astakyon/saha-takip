// Zorunlu alanlar: hangi kayıtta hangi alan zorunlu / önemli. Kurallar Şirket profili → "Zorunlu alanlar"dan ayarlanır.
// Firma eksik bilgiyle açılabilir ("Cari bilgisi eksik" rozeti); müşteri ve bayi gibi tiplerde vergi no ve vergi dairesi
// teklif, sipariş, tahsilat ya da çek girilmeden önce küçük bir pencerede istenir.
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, firmaAd, byId, today, FIRMA_TIPLERI, ACIK } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { sahipMi } from './yetki.js';
import { vergiKontrol, vergiSahibi, vergiTemiz } from './cari.js';

export const VARSAYILAN = {
  firmaKonum: 'zorunlu',          // zorunlu | onemli | kapali — harita noktası ya da il + ilçe
  vergi: 'islem',                 // islem: teklif / sipariş / tahsilat / çek öncesi · zorunlu: her kayıtta · kapali
  vergiTipler: ['Müşteri', 'Bayi', 'Emüt', 'Gemüt', 'Malzeme Alıcısı', 'Panocu'],
  projeIl: 'zorunlu',             // il ya da harita konumu
  projeTutar: 'onemli',           // açık projede tutar ve beklenen sipariş tarihi
  kisiFirma: 'zorunlu',
  kisiIletisim: 'onemli',         // telefon ya da e-posta
};
export const kurallar = () => ({ ...VARSAYILAN, ...(ayar('zorunlu_alanlar') || {}) });
const ISLEM_AD = { teklif: 'teklif', siparis: 'sipariş', tahsilat: 'fatura / tahsilat', cek: 'çek / senet' };

// ---------- Firma ----------
const konumVar = f => f.lat != null || (f.il && f.ilce);
// Vergi bilgisi bu firmada istenir mi? (tipi boş firma da müşteri sayılır; rakip, danışman, proje bürosu, yatırımcı istenmez)
export const vergiIstenir = f => { const k = kurallar(), t = f?.tipler || []; return k.vergi !== 'kapali' && !f?.sube_ana_id && (!t.length || t.some(x => k.vergiTipler.includes(x))); };
export function cariEksik(f) {
  if (!f || !vergiIstenir(f)) return [];
  return [!vergiTemiz(f.vergi_no) && 'vergi no', !f.vergi_dairesi && 'vergi dairesi'].filter(Boolean);
}
// { zorunlu: [...], onemli: [...] } — rozet, veri kontrolü ve doluluk için
export function firmaEksik(f) {
  const k = kurallar(), z = [], o = [];
  if (!konumVar(f)) (k.firmaKonum === 'zorunlu' ? z : k.firmaKonum === 'onemli' ? o : []).push('konum');
  const c = cariEksik(f); if (c.length) (k.vergi === 'zorunlu' ? z : o).push(...c);
  if (!f.telefon && !f.eposta) o.push('telefon / e-posta');
  return { zorunlu: z, onemli: o };
}
// Firma formu kaydedilirken: zorunlu eksik varsa hata metni ve odaklanılacak alan.
// Konum yeni kayıtta istenir; eski kayıtta eksikse düzenlemeyi engellemez (rozet ve veri kontrolünde görünür).
export function firmaFormHatasi(o, yeni = true) {
  const k = kurallar();
  if (yeni && k.firmaKonum === 'zorunlu' && !konumVar(o)) return { metin: 'Konum zorunlu: haritada yerini işaretle ya da en az il ve ilçeyi seç.', alan: 'il' };
  if (k.vergi === 'zorunlu' && vergiIstenir(o)) { const c = cariEksik(o); if (c.length) return { metin: `Bu firma tipinde ${c.join(' ve ')} zorunlu.`, alan: c[0] === 'vergi no' ? 'vergi_no' : 'vergi_dairesi' }; }
  return null;
}
export function firmaRozet(f) {
  const c = cariEksik(f), k = !konumVar(f) && kurallar().firmaKonum !== 'kapali';
  if (!c.length && !k) return '';
  return `<span class="eksik-rozet" title="Eksik bilgiler">${c.length ? `Cari bilgisi eksik: ${esc(c.join(', '))}` : ''}${c.length && k ? ' · ' : ''}${k ? 'konum eksik' : ''} <button type="button" class="linkbtn" data-eksikdoldur="${f.id}" data-gerek="yaz:firmalar">Tamamla</button></span>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest?.('[data-eksikdoldur]'); if (!b) return;
  const f = byId('firmalar', b.dataset.eksikdoldur); if (!f) return;
  (await import('./views/firmalar.js')).firmaFormu(f.id, null, { odak: cariEksik(f).length ? (vergiTemiz(f.vergi_no) ? 'vergi_dairesi' : 'vergi_no') : 'il' });
});

// ---------- Teklif / sipariş / tahsilat / çek öncesi cari bilgisi ----------
// true: devam edilebilir · false: kullanıcı vazgeçti. Çekmece (drawer) açıkken de çalışsın diye ayrı bir pencere (dialog) açar.
export function cariIste(firmaId, islem) {
  const f = byId('firmalar', firmaId);
  if (!f || kurallar().vergi === 'kapali') return Promise.resolve(true);
  const eksik = cariEksik(f); if (!eksik.length) return Promise.resolve(true);
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'org-dlg cari-dlg';
    d.innerHTML = `<form method="dialog" class="form" novalidate><h3>Cari bilgisi gerekli</h3>
      <p class="muted"><b>${esc(f.ad)}</b> için ${esc(ISLEM_AD[islem] || islem)} girmeden önce ${esc(eksik.join(' ve '))} gerekiyor.</p>
      <div class="fld"><label for="ci-u">Resmi ticari unvan</label><input id="ci-u" name="unvan" value="${esc(f.unvan || '')}" placeholder="${esc(f.ad)}"></div>
      <div class="fld"><label for="ci-v">Vergi no / T.C. kimlik no</label><input id="ci-v" name="vergi_no" inputmode="numeric" value="${esc(f.vergi_no || '')}"><small class="neg" data-ci-h aria-live="polite"></small></div>
      <div class="fld"><label for="ci-d">Vergi dairesi</label><input id="ci-d" name="vergi_dairesi" value="${esc(f.vergi_dairesi || '')}" list="ci-dl"><datalist id="ci-dl">${[...new Set((S.firmalar || []).map(x => x.vergi_dairesi).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="btnrow"><button type="button" class="btn ghost" data-ci-vaz>Vazgeç</button>${sahipMi() ? '<button type="button" class="btn ghost" data-ci-gec>Şimdilik geç</button>' : ''}<span class="grow"></span><button type="submit" class="btn primary" data-ci-kay>Kaydet ve devam et</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    let bitti = false; const son = v => { if (bitti) return; bitti = true; try { d.close(); } catch {} d.remove(); res(v); };
    d.addEventListener('cancel', e => { e.preventDefault(); son(false); });
    d.querySelector('[data-ci-vaz]').onclick = () => son(false);
    d.querySelector('[data-ci-gec]')?.addEventListener('click', async () => {
      const g = { ...(ayar('cari_gecildi') || {}) }; g[f.id] = { kim: (app.db?.user?.()?.email || '').toLowerCase(), tarih: today(), islem }; await ayarYaz('cari_gecildi', g);
      son(true);
    });
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const v = d.querySelector('#ci-v').value.trim(), dai = d.querySelector('#ci-d').value.trim(), u = d.querySelector('#ci-u').value.trim(), h = d.querySelector('[data-ci-h]');
      const k = vergiKontrol(v);
      if (!k.temiz) { h.textContent = 'Vergi numarasını yaz.'; return d.querySelector('#ci-v').focus(); }
      if (!k.ok) { h.textContent = k.hata; return d.querySelector('#ci-v').focus(); }
      const sh = vergiSahibi(k.temiz, f.id); if (sh) { h.textContent = `Bu numara zaten "${sh.ad}" firmasında. Firma kartından birleştir ya da şube işaretle.`; return; }
      if (!dai) { h.textContent = 'Vergi dairesini yaz.'; return d.querySelector('#ci-d').focus(); }
      try { await app.db.save('firmalar', { ...f, vergi_no: k.temiz, vergi_dairesi: dai, unvan: u || f.unvan || null }); toast(`${f.ad}: cari bilgisi kaydedildi.`); son(true); }
      catch (err) { h.textContent = 'Kaydedilemedi: ' + err.message; }
    };
  });
}
// "Şimdilik geç" denilen firmalar (uyarı akışı için)
export const cariGecilenler = () => Object.entries(ayar('cari_gecildi') || {}).map(([id, v]) => ({ f: byId('firmalar', id), ...v })).filter(x => x.f && cariEksik(x.f).length);

// ---------- Proje ve kişi ----------
export function projeFormHatasi(o, yeni = true) {
  const k = kurallar();
  if (yeni && k.projeIl === 'zorunlu' && !o.il && o.lat == null) return { metin: 'Projenin ilini seç ya da haritada yerini işaretle.', alan: 'il' };
  return null;
}
export function projeEksik(p) {
  const k = kurallar(), z = [], o = [];
  if (!p.il && p.lat == null && k.projeIl !== 'kapali') (k.projeIl === 'zorunlu' ? z : o).push('il');
  if (ACIK.includes(p.durum) && k.projeTutar !== 'kapali') { if (!(+p.tutar_usd > 0)) o.push('tutar'); if (!p.beklenen_tarih) o.push('beklenen sipariş tarihi'); }
  return { zorunlu: z, onemli: o };
}
export function kisiFormHatasi(o, yeni = true) {
  if (yeni && kurallar().kisiFirma === 'zorunlu' && !o.firma_id) return { metin: 'Kişinin çalıştığı firmayı seç (listede yoksa adını yaz, yeni firma açılır).', alan: 'firma_id' };
  return null;
}
export function kisiEksik(x) {
  const k = kurallar(), z = [], o = [];
  if (!x.firma_id && k.kisiFirma !== 'kapali') (k.kisiFirma === 'zorunlu' ? z : o).push('firma');
  if (!x.telefon && !x.eposta && k.kisiIletisim !== 'kapali') o.push('telefon / e-posta');
  return { zorunlu: z, onemli: o };
}

// ---------- Şirket profili → Zorunlu alanlar ----------
const SEC = (ad, deger, secenek) => `<select data-zk="${ad}" aria-label="${ad}">${secenek.map(([v, l]) => `<option value="${v}" ${deger === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const ZOE = [['zorunlu', 'Zorunlu'], ['onemli', 'Önemli (uyarır, engellemez)'], ['kapali', 'Denetlenmesin']];
export function zorunluAyarKarti() {
  const k = kurallar();
  return `<section class="card zorunlu-k"><h2>Zorunlu alanlar</h2>
    <div class="zk-satir"><span><b>Firma konumu</b><small class="muted">harita noktası ya da il + ilçe</small></span>${SEC('firmaKonum', k.firmaKonum, ZOE)}</div>
    <div class="zk-satir"><span><b>Vergi no ve vergi dairesi</b><small class="muted">aşağıda seçilen firma tiplerinde</small></span>${SEC('vergi', k.vergi, [['islem', 'Teklif / sipariş / tahsilat öncesi istensin'], ['zorunlu', 'Firma kaydında zorunlu'], ['kapali', 'Denetlenmesin']])}</div>
    <div class="zk-tipler" role="group" aria-label="Vergi bilgisi istenen firma tipleri">${FIRMA_TIPLERI.map(t => `<label class="chk"><input type="checkbox" data-zt value="${esc(t)}" ${k.vergiTipler.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
    <div class="zk-satir"><span><b>Projenin ili</b><small class="muted">ya da harita konumu</small></span>${SEC('projeIl', k.projeIl, ZOE)}</div>
    <div class="zk-satir"><span><b>Açık projede tutar ve beklenen tarih</b></span>${SEC('projeTutar', k.projeTutar, ZOE.slice(1))}</div>
    <div class="zk-satir"><span><b>Kişinin firması</b></span>${SEC('kisiFirma', k.kisiFirma, ZOE)}</div>
    <div class="zk-satir"><span><b>Kişinin telefonu ya da e-postası</b></span>${SEC('kisiIletisim', k.kisiIletisim, ZOE.slice(1))}</div>
    <p class="hint">Zorunlu alan eksikse kayıt kaydedilmez. "Önemli" alanlar Veri kontrolünde ve kayıt sayfasında eksik olarak görünür. Tipi boş firma müşteri sayılır.</p>
    <div class="frow"><button type="button" class="btn" data-zkaydet>Kaydet</button></div></section>`;
}
export function zorunluAyarBagla(root) {
  root.querySelector('[data-zkaydet]')?.addEventListener('click', async () => {
    const o = {}; root.querySelectorAll('[data-zk]').forEach(s => o[s.dataset.zk] = s.value);
    o.vergiTipler = [...root.querySelectorAll('[data-zt]:checked')].map(c => c.value);
    await ayarYaz('zorunlu_alanlar', o); toast('Zorunlu alan kuralları kaydedildi.');
  });
}
