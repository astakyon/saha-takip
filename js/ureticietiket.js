// Üretici etiketini tanıma: koli ya da ürün üstündeki etiketin fotoğrafı (yazı + barkod) ya da okuyucuyla okutulan barkod → stoktaki kalem ve adet.
// Markalar (Pelsan, Osram / Ledvance, EAE…) tanım listesiyle ayırt edilir; yeni marka eklenebilir. Onaylanan barkod "barkod → kod, adet" olarak öğrenilir,
// bir sonraki okutmada fotoğrafa gerek kalmaz (koli barkodu kolideki adedi, ürün barkodu 1 adedi taşır).
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, fold, toast } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { disKullanici } from './yetki.js';

// ---------- Marka tanımları ----------
// kelime: etikette geçen marka yazısı; ean: GS1 firma önekleri; kod: ürün kodundan önce yazan etiket sözcükleri; adetOnce: "Miktar 6" gibi; adetSonra: "6 PCS" gibi
export const HAZIR_MARKALAR = [
  { ad: 'Pelsan', kelime: ['pelsan', 'plsetj'], ean: ['8693119'], kod: ['code', 'kod'], adetOnce: [], adetSonra: ['pcs', 'pc'], onek: ['plsetj', 'emera', 'lecto', 'monte', 'largo', 'fontana', 'rigo'], site: 'pelsan.com.tr' },
  { ad: 'Osram / Ledvance', kelime: ['osram', 'ledvance'], ean: ['4099854', '4058075', '4052899', '4050300', '4008321'], kod: ['ean', 'model', 'product code'], adetOnce: ['qty', 'quantity'], adetSonra: ['pcs', 'pc', 'adet'], onek: ['eco cl', 'sl pro', 'osram', 'ledvance'], site: 'ledvance.com' },
  { ad: 'EAE', kelime: ['eae aydinlatma', 'eae', 'elektrikticaret'], ean: [], kod: ['ürün kodu', 'urun kodu', 'prdc.code', 'prdc code', 'product code'], adetOnce: ['miktar'], adetSonra: [], onek: ['hbl', 'blm', 'revos'], site: '' },
  { ad: 'Philips / Signify', kelime: ['philips', 'signify'], ean: ['8718699', '8719514', '8710163', '8718291', '8711500'], kod: ['12nc', 'eoc', 'code'], adetOnce: ['qty', 'quantity'], adetSonra: ['pcs', 'pc'], onek: ['philips'], site: '' },
];
const GENEL = { kod: ['ürün kodu', 'urun kodu', 'stok kodu', 'kod', 'code', 'art.no', 'art no', 'article', 'item', 'ref', 'mat.no', 'material', 'prdc.code', 'product code', 'model'], adetOnce: ['miktar', 'adet', 'qty', 'quantity', 'menge', 'pcs/box'], adetSonra: ['pcs', 'pc', 'adet', 'ad', 'stk', 'units'] };
export const markalar = () => markalarTum();
// Kullanıcının hazır markada değiştirdiği (ön ek, site…) tanım hazırın yerine geçer
export const markalarTum = () => { const k = ayar('etiket_markalari', []) || []; return [...k, ...HAZIR_MARKALAR.filter(h => !k.some(x => fold(x.ad) === fold(h.ad)))]; };
export async function markaKaydet(m) { const l = (ayar('etiket_markalari', []) || []).filter(x => fold(x.ad) !== fold(m.ad)); await ayarYaz('etiket_markalari', [...l, m]); }

// ---------- EAN / GTIN ----------
export function eanGecerli(k) {
  if (!/^\d{8}$|^\d{12,14}$/.test(k)) return false;
  const d = k.split('').map(Number), c = d.pop();
  const t = d.reverse().reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0);
  return (10 - t % 10) % 10 === c;
}
// Metindeki barkod numaraları: "8 693119 588280" gibi boşluklu yazılanlar da birleştirilir; sağlama hanesi tutanlar alınır
export function eanlar(metin) {
  const t = String(metin || ''), l = new Set();
  for (const m of t.matchAll(/(?<!\d)(\d[\d \t]{6,18}\d)(?!\d)/g)) {
    const ham = m[1], tek = ham.replace(/\s/g, '');
    if (eanGecerli(tek)) l.add(tek);
    for (const p of ham.split(/\s+/)) if (eanGecerli(p)) l.add(p);
  }
  return [...l].filter(x => x.length >= 12 || l.size === 1);
}

// ---------- Metni ayrıştır ----------
const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
const satirlar = t => String(t || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
export function markaBul(metin, barkodlar = []) {
  const f = ' ' + fold(metin) + ' ';
  return markalar().find(m => (m.ean || []).some(p => barkodlar.some(b => b.startsWith(p) || b.startsWith('0' + p)))) || markalar().find(m => (m.kelime || []).some(k => new RegExp(`(^|[^\\p{L}])${rx(fold(k))}([^\\p{L}]|$)`, 'u').test(f))) || null;
}
export function etiketAyristir(metin, { barkodlar = [] } = {}) {
  const t = String(metin || ''), L = satirlar(t), E = [...new Set([...barkodlar.map(String), ...eanlar(t)])];
  const m = markaBul(t, E), kodE = [...new Set([...(m?.kod || []), ...GENEL.kod])], once = [...new Set([...(m?.adetOnce || []), ...GENEL.adetOnce])], sonra = [...new Set([...(m?.adetSonra || []), ...GENEL.adetSonra])];
  // Kod: etiket sözcüğünden sonra gelen ilk kod biçimli parça (aynı satırda ya da alt satırda)
  const kodlar = [];
  const kodBicim = /^[A-Z0-9][A-Z0-9.\-/]{3,24}$/i;
  for (let i = 0; i < L.length; i++) for (const e of kodE) {
    const r = new RegExp(`(?:^|[^\\p{L}])${rx(e)}\\s*[:.#|(\\[]*\\s*(.*)$`, 'iu'), mm = r.exec(L[i]); if (!mm) continue;
    const parcalar = [...(mm[1] || '').split(/[\s|()[\]]+/), ...(L[i + 1] || '').split(/[\s|()[\]]+/)].map(x => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
    const k = parcalar.find(x => kodBicim.test(x) && /\d/.test(x) && !/^\d{1,3}$/.test(x) && !/^(19|20)\d{2}$/.test(x) && !/(w|v|hz|k|lm|mm|kg)$/i.test(x));
    if (k && !kodlar.includes(k)) kodlar.push(k);
  }
  // Ham sayılar ve kod biçimli parçalar (stokla eşleşirse işe yarar)
  const parcalar = [...new Set(t.split(/[\s|,;()[\]]+/).map(x => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(x => x.length >= 4 && x.length <= 24 && /\d/.test(x)))];
  // Adet: "Miktar 6", "6 PCS" (sayı ve PCS ayrı satırda olabilir), "6X1"
  let adet = null, adetKaynak = '';
  for (const e of once) { const r = new RegExp(`(?:^|[^\\p{L}])${rx(e)}\\s*[:.|]*\\s*(\\d{1,5})(?!\\d)`, 'iu').exec(t); if (r) { adet = +r[1]; adetKaynak = e; break; } }
  if (adet == null) for (const e of sonra) { const r = new RegExp(`(?<![\\d.,])(\\d{1,3})\\s*(?:\\n\\s*)?${rx(e)}(?![\\p{L}])`, 'iu').exec(t); if (r) { adet = +r[1]; adetKaynak = e; break; } }
  // Açıklama: en uzun büyük harfli ürün satırı (adres, yönetmelik, imalat bilgisi değil)
  const aday = L.filter(x => x.length >= 12 && /[A-Z]/.test(x) && /\d/.test(x) && !/(made in|mahalle|sokak|no:|yönetmeli|regulation|energy|enerji|adres|www\.|http|220-240|50-60|@)/i.test(x));
  const aciklama = aday.sort((a, b) => (b.match(/\b\d+\s?(w|k|lm|mm)\b/gi) || []).length - (a.match(/\b\d+\s?(w|k|lm|mm)\b/gi) || []).length || b.length - a.length)[0] || '';
  return { marka: m?.ad || null, eanlar: E, kodlar, parcalar, adet, adetKaynak, aciklama };
}

// ---------- Barkod eşlemeleri ----------
export function barkodBul(barkod, firma_id = null) {
  const b = String(barkod || '').trim(); if (!b) return null;
  const l = (S.stok_barkodlari || []).filter(x => x.barkod === b || x.barkod === b.replace(/^0+/, '') || '0' + x.barkod === b);
  return l.find(x => firma_id && x.firma_id === firma_id) || l.find(x => !x.firma_id) || l[0] || null;
}
export async function barkodKaydet({ barkod, kod, adet = 1, marka = null, firma_id = null }) {
  const d = disKullanici(), fid = d ? d.firma_id : firma_id || null;
  const var_ = (S.stok_barkodlari || []).find(x => x.barkod === barkod && (x.firma_id || null) === fid);
  const o = { ...(var_ || {}), barkod, kod, adet: +adet || 1, marka, firma_id: fid };
  await app.db.save('stok_barkodlari', o); return o;
}

// ---------- Aday kalemler ----------
const kelimeler = s => new Set(fold(s).split(/[^a-z0-9]+/).filter(x => x.length >= 2 && !/^(ip|pc|st|std|led|ce|tr)$/.test(x)));
const yakin = (a, b) => { if (a === b) return 0; if (Math.abs(a.length - b.length) > 1) return 9; let i = 0; while (i < a.length && a[i] === b[i]) i++; let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++; return Math.max(a.length, b.length) - i - j; };
export function adaylar(ayr, kalemler, firma_id = null) {
  const sonuc = new Map(), ekle = (s, puan, neden) => { const k = s.kod; const e = sonuc.get(k); if (!e || e.puan < puan) sonuc.set(k, { s, puan, neden }); };
  const kodAlan = s => [s.kod, s.firma_kodu, s.uretici_kodu, s.barkod].filter(Boolean).map(x => fold(String(x)).replace(/\s/g, ''));
  for (const b of ayr.eanlar) { const e = barkodBul(b, firma_id); if (e) { const s = kalemler.find(x => x.kod === e.kod) || { kod: e.kod, aciklama: '', yeni: true }; ekle(s, 100, `barkod ${b} kayıtlı (${num(e.adet)} adet)`); } for (const s of kalemler) if (s.barkod && String(s.barkod) === b) ekle(s, 95, 'barkod kalem kartında'); }
  const kodlar = [...ayr.kodlar.map(x => [x, 90]), ...ayr.parcalar.map(x => [x, 70])];
  for (const [k0, p] of kodlar) { const k = fold(k0).replace(/\s/g, ''); for (const s of kalemler) for (const a of kodAlan(s)) { if (a === k) ekle(s, p, `kod ${k0}`); else if (a.length >= 5 && yakin(a, k) === 1) ekle(s, p - 25, `kod ${k0} ≈ ${a}`); } }
  const ak = kelimeler(ayr.aciklama); if (ak.size >= 2) for (const s of kalemler) { const sk = kelimeler([s.aciklama, s.uretici_aciklama].join(' ')); if (!sk.size) continue; let o = 0; for (const x of ak) if (sk.has(x)) o++; const r = o / Math.min(ak.size, sk.size); if (o >= 2 && r >= 0.4) ekle(s, Math.round(30 + r * 30), `açıklama benziyor (${o} kelime)`); }
  return [...sonuc.values()].sort((a, b) => b.puan - a.puan).slice(0, 5);
}

// ---------- Fotoğraftan tanı ----------
async function gorseldenBarkod(blob) {
  if (!('BarcodeDetector' in window)) return [];
  try { const bm = await createImageBitmap(blob); const r = await new window.BarcodeDetector().detect(bm); return r.map(x => x.rawValue).filter(Boolean); } catch { return []; }
}
export async function fotoTani(blob, ilerleme) {
  const [barkodlar, ok] = await Promise.all([gorseldenBarkod(blob), import('./ocr.js').then(m => m.etiketOku(blob, ilerleme))]);
  const qr = barkodlar.filter(x => !/^\d{8,14}$/.test(x));   // QR içeriği de metin olarak ayrıştırılır
  return { ...etiketAyristir([ok.metin, ...qr].join('\n'), { barkodlar: barkodlar.filter(x => /^\d{8,14}$/.test(x)) }), metin: ok.metin, guven: ok.guven };
}

// ---------- Formlara eklenen tanıma kutusu ----------
// kutu: içine çizilecek eleman; kalemler(): aday aranacak stok; onEkle({ kod, adet, s }): seçilen kalem eklenir; firma_id: eşleme kapsamı
export function taniKutusu(kutu, { kalemler, onEkle, firma_id = null, yeniKalem = true }) {
  let durum = null;   // { ayr, aday, barkod } ya da null
  const ciz = () => {
    if (!durum) { kutu.innerHTML = `<label class="btn sm et-foto">Etiket fotoğrafından tanı<input type="file" accept="image/*" capture="environment" hidden data-ufoto></label>`; kutu.querySelector('[data-ufoto]').onchange = e => { const f = e.target.files[0]; if (f) foto(f); }; return; }
    const { ayr, aday } = durum, ilk = aday[0];
    kutu.innerHTML = `<div class="ut-kart">
      <p class="ut-bas"><b>${esc(ayr.marka || 'Marka tanınmadı')}</b>${ayr.eanlar.length ? ` · barkod ${esc(ayr.eanlar.join(', '))}` : ''}${ayr.kodlar.length ? ` · kod ${esc(ayr.kodlar.join(', '))}` : ''}</p>
      ${ayr.aciklama ? `<p class="hint">${esc(ayr.aciklama)}</p>` : ''}
      <div class="frow"><label class="fld"><span>Stoktaki ürün</span><input data-ukod list="ut-liste" value="${esc(ilk?.s.kod || ayr.kodlar[0] || '')}" placeholder="kod ya da ad yaz" autocomplete="off"></label>
        <label class="fld ut-adet"><span>Adet${ayr.adet > 1 ? ' (koli)' : ''}</span><input data-uadet type="number" inputmode="numeric" min="1" value="${durum.adet ?? ayr.adet ?? 1}"></label></div>
      <datalist id="ut-liste">${kalemler().slice(0, 1500).map(s => `<option value="${esc(s.kod)}">${esc(s.aciklama || '')}</option>`).join('')}</datalist>
      ${aday.length ? `<div class="ut-aday">${aday.map((a, i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-uaday="${esc(a.s.kod)}" title="${esc(a.neden)}">${esc(a.s.kod)}${a.s.aciklama ? ' · ' + esc(a.s.aciklama.slice(0, 40)) : ''}</button>`).join('')}</div>` : '<p class="hint">Stokta eşleşen ürün bulunamadı; kodu yaz ya da listeden seç.</p>'}
      ${ayr.eanlar.length ? `<label class="chk"><input type="checkbox" data-uhatirla checked> <span>Bu barkodu hatırla: sonra okutunca doğrudan bu ürün ve adet gelsin</span></label>` : ''}
      <div class="btnrow"><button type="button" class="btn primary sm" data-uekle>Ekle</button><button type="button" class="btn ghost sm" data-uvaz>Vazgeç</button>${durum.metin ? '<button type="button" class="btn ghost sm" data-umetin>Okunan yazı</button>' : ''}</div>
      <pre class="ut-metin" hidden>${esc(durum.metin || '')}</pre></div>`;
    kutu.querySelectorAll('[data-uaday]').forEach(b => b.onclick = () => { kutu.querySelector('[data-ukod]').value = b.dataset.uaday; kutu.querySelectorAll('[data-uaday]').forEach(x => x.classList.toggle('on', x === b)); });
    kutu.querySelector('[data-uvaz]').onclick = () => { durum = null; ciz(); };
    kutu.querySelector('[data-umetin]')?.addEventListener('click', () => { const m = kutu.querySelector('.ut-metin'); m.hidden = !m.hidden; });
    kutu.querySelector('[data-uekle]').onclick = async () => {
      const kod = kutu.querySelector('[data-ukod]').value.trim(), adet = Math.max(1, +kutu.querySelector('[data-uadet]').value || 1);
      if (!kod) return toast('Ürün kodunu yaz ya da seç.', 'err');
      const s = kalemler().find(x => x.kod === kod) || kalemler().find(x => [x.firma_kodu, x.uretici_kodu].includes(kod));
      if (!s && !yeniKalem) return toast(`${kod}: bu stokta yok.`, 'err');
      if (ayr.eanlar.length && kutu.querySelector('[data-uhatirla]')?.checked) { try { for (const b of durum.barkod ? [durum.barkod] : ayr.eanlar.slice(0, 1)) await barkodKaydet({ barkod: b, kod: s?.kod || kod, adet, marka: ayr.marka, firma_id }); } catch (e) { toast('Barkod kaydedilemedi: ' + e.message, 'err'); } }
      onEkle({ kod: s?.kod || kod, adet, s, aciklama: s?.aciklama || ayr.aciklama || '', marka: ayr.marka });
      durum = null; ciz();
    };
  };
  const foto = async f => {
    kutu.innerHTML = '<p class="hint" data-uil>Etiket okunuyor… (ilk seferde okuma motoru indirilir)</p>';
    try { const ayr = await fotoTani(f, (st, pr) => { const e = kutu.querySelector('[data-uil]'); if (e) e.textContent = `Etiket okunuyor: ${st}${pr ? ' %' + Math.round(pr * 100) : ''}`; });
      durum = { ayr, aday: adaylar(ayr, kalemler(), firma_id), metin: ayr.metin }; ciz();
    } catch (e) { toast('Etiket okunamadı: ' + e.message, 'err'); durum = null; ciz(); }
  };
  ciz();
  // Okuyucuyla okutulan, kayıtlı olmayan barkod: eşleme kartını aç
  return { bilinmeyenBarkod: (barkod, ipucu = '') => { const ayr = etiketAyristir(ipucu, { barkodlar: [barkod] }); durum = { ayr: { ...ayr, eanlar: [barkod] }, aday: adaylar({ ...ayr, eanlar: [barkod] }, kalemler(), firma_id), barkod }; ciz(); kutu.scrollIntoView?.({ block: 'nearest' }); } };
}

// ---------- Markalar ve öğrenilen barkodlar penceresi ----------
export async function markalarPenceresi({ sonra } = {}) {
  const { openDrawer, confirmBox } = await import('./ui.js');
  const p = openDrawer('<div class="dbody"></div>', { wide: true, onClose: () => sonra?.() });
  const virgul = a => (a || []).join(', '), ayir = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const ciz = () => {
    const kendi = ayar('etiket_markalari', []) || [], B = [...(S.stok_barkodlari || [])].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    p.innerHTML = `<header class="dh"><div><p class="muted">Stoklar</p><h2 id="drawer-title">Etiket markaları ve barkodlar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      <p class="hint">Logo yüklediğin marka, stok listesinde her kalemin başında küçük logo olarak görünür; logosu olmayan markada baş harfler gösterilir.</p>
      <p class="hint">Üretici etiketinin fotoğrafı çekilince marka buradaki tanımlarla bulunur: etikette geçen yazı ya da barkodun ilk haneleri (firma öneki). Ürün kodu “kod sözcüğü”nden sonra, adet “Miktar 6” ya da “6 PCS” gibi yazılır. Yeni bir marka için etikette gördüğün sözcükleri yaz.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Logo</th><th>Marka</th><th>Etikette geçen</th><th>Barkod öneki</th><th>Ürün adı başı</th><th>Site</th><th>Kod sözcüğü</th><th>Adet</th><th></th></tr></thead><tbody>
      ${markalar().map(m => { const k = kendi.some(x => x.ad === m.ad); return `<tr><td class="mk-hucre">${markaLogo(m.ad, { buyuk: true })}<button type="button" class="btn sm ghost" data-mlogo="${esc(m.ad)}" aria-label="${esc(m.ad)} logosu yükle">${m.logo ? 'Değiştir' : 'Logo yükle'}</button>${m.logo ? `<button type="button" class="btn sm ghost danger" data-mlogosil="${esc(m.ad)}" aria-label="${esc(m.ad)} logosunu kaldır">×</button>` : ''}</td><td><b>${esc(m.ad)}</b>${k ? '' : ' <small class="muted">hazır</small>'}</td><td>${esc(virgul(m.kelime))}</td><td class="mono">${esc(virgul(m.ean))}</td><td>${esc(virgul(m.onek))}</td><td>${esc(m.site || '')}</td><td>${esc(virgul(m.kod))}</td><td>${esc([virgul(m.adetOnce) && virgul(m.adetOnce) + ' N', virgul(m.adetSonra) && 'N ' + virgul(m.adetSonra)].filter(Boolean).join(' · '))}</td><td class="btnrow"><button type="button" class="btn sm ghost" data-mduz="${esc(m.ad)}">Düzenle</button>${k ? `<button type="button" class="btn sm ghost danger" data-msil="${esc(m.ad)}">${HAZIR_MARKALAR.some(h => h.ad === m.ad) ? 'Hazıra dön' : 'Sil'}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
      <h3 data-mbas>Marka ekle</h3>
      <div class="frow"><label class="fld"><span>Marka adı</span><input data-m="ad" placeholder="ör. Schneider"></label><label class="fld"><span>Etikette geçen yazı (virgülle)</span><input data-m="kelime" placeholder="ör. schneider, se"></label></div>
      <div class="frow"><label class="fld"><span>Barkod öneki (virgülle)</span><input data-m="ean" inputmode="numeric" placeholder="ör. 3606480"></label><label class="fld"><span>Kod sözcüğü (virgülle)</span><input data-m="kod" placeholder="ör. ref, code"></label></div>
      <div class="frow"><label class="fld"><span>Ürün adı başlangıçları (virgülle)</span><input data-m="onek" placeholder="ör. plsetj, emera, lecto"></label><label class="fld"><span>Üretici sitesi</span><input data-m="site" placeholder="ör. pelsan.com.tr" inputmode="url"></label></div>
      <p class="hint">Ürün adı bu sözcükle başlıyorsa “Markaları doldur” markayı yazar. Site yazılırsa ürünün belgelerinde “Üreticide ara” o sitede ürün kodunu arar.</p>
      <div class="frow"><label class="fld"><span>Adetten önce yazan</span><input data-m="adetOnce" placeholder="ör. miktar, qty"></label><label class="fld"><span>Adetten sonra yazan</span><input data-m="adetSonra" placeholder="ör. pcs, adet"></label></div>
      <button type="button" class="btn" data-mekle>Markayı kaydet</button>
      <h3>Öğrenilen barkodlar (${B.length})</h3>
      <p class="hint">Fotoğraftan tanıyıp “Bu barkodu hatırla” dediğin barkodlar. Okuyucuyla okutunca doğrudan bu ürün ve adet gelir.</p>
      ${B.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Barkod</th><th>Ürün kodu</th><th class="r">Adet</th><th>Marka</th><th></th></tr></thead><tbody>${B.slice(0, 500).map(b => `<tr><td class="mono">${esc(b.barkod)}</td><td class="mono">${esc(b.kod)}</td><td class="r num">${num(b.adet)}</td><td>${esc(b.marka || '')}</td><td><button type="button" class="btn sm ghost danger" data-bsil="${b.id}">Sil</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Henüz yok.</p>'}
    </div>`;
    p.querySelector('[data-mekle]').onclick = async () => { const v = k => p.querySelector(`[data-m="${k}"]`).value.trim(); const ad = v('ad');
      if (!ad || !(ayir(v('kelime')).length || ayir(v('ean')).length)) return toast('Marka adını ve etikette geçen yazıyı ya da barkod önekini yaz.', 'err');
      const eski = markalar().find(x => fold(x.ad) === fold(ad)) || {};
      await markaKaydet({ ...(eski.logo ? { logo: eski.logo } : {}), ...(eski.renk ? { renk: eski.renk } : {}), ad, kelime: ayir(v('kelime')).map(x => x.toLocaleLowerCase('tr')), ean: ayir(v('ean')).filter(x => /^\d{3,9}$/.test(x)), kod: ayir(v('kod')).map(x => x.toLocaleLowerCase('tr')), adetOnce: ayir(v('adetOnce')).map(x => x.toLocaleLowerCase('tr')), adetSonra: ayir(v('adetSonra')).map(x => x.toLocaleLowerCase('tr')), onek: ayir(v('onek')).map(x => x.toLocaleLowerCase('tr')), site: v('site').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '') });
      toast(`${ad} eklendi.`); ciz(); };
    p.querySelectorAll('[data-mlogo]').forEach(b => b.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const m = markalar().find(x => x.ad === b.dataset.mlogo); await markaKaydet({ ...m, logo: await logoKucult(f) }); toast(`${m.ad} logosu kaydedildi.`); ciz(); } catch { toast('Logo okunamadı; PNG ya da JPG seç.', 'err'); } }; i.click(); });
    p.querySelectorAll('[data-mlogosil]').forEach(b => b.onclick = async () => { const m = markalar().find(x => x.ad === b.dataset.mlogosil); const { logo, ...r } = m; await markaKaydet(r); toast('Logo kaldırıldı.'); ciz(); });
    p.querySelectorAll('[data-mduz]').forEach(b => b.onclick = () => { const m = markalar().find(x => x.ad === b.dataset.mduz); for (const k of ['ad', 'kelime', 'ean', 'kod', 'adetOnce', 'adetSonra', 'onek']) p.querySelector(`[data-m="${k}"]`).value = Array.isArray(m[k]) ? m[k].join(', ') : (m[k] || ''); p.querySelector('[data-m="site"]').value = m.site || ''; p.querySelector('[data-mbas]').textContent = `${m.ad} tanımını düzenle`; p.querySelector('[data-mbas]').scrollIntoView({ block: 'start' }); });
    p.querySelectorAll('[data-msil]').forEach(b => b.onclick = async () => { if (!confirmBox(`${b.dataset.msil} tanımı silinsin mi?`)) return; await ayarYaz('etiket_markalari', (ayar('etiket_markalari', []) || []).filter(x => x.ad !== b.dataset.msil)); ciz(); });
    p.querySelectorAll('[data-bsil]').forEach(b => b.onclick = async () => { const x = S.stok_barkodlari.find(y => y.id === b.dataset.bsil); if (!confirmBox(`${x.barkod} → ${x.kod} eşlemesi silinsin mi?`)) return; await app.db.del('stok_barkodlari', x.id); toast('Eşleme silindi.'); ciz(); });
  };
  ciz();
}

// ---------- Markayı kalemden bul ----------
// Sıra: aynı kodlu başka kalemde yazan marka → barkodun firma öneki → ürün adının başı (ön ekler) → ürün adında marka yazısı
export function markaTahmin(s) {
  const baska = (S.bayi_stok || []).find(x => x !== s && x.kod === s.kod && x.ozel && Object.keys(x.ozel).some(k => fold(k) === 'marka' && x.ozel[k]));
  if (baska) { const k = Object.keys(baska.ozel).find(k => fold(k) === 'marka'); return baska.ozel[k]; }
  const L = markalar();
  const bk = String(s.barkod || ''); if (bk) { const m = L.find(m => (m.ean || []).some(p => bk.startsWith(p))); if (m) return markaAdi(m); }
  const ac = fold([s.aciklama, s.uretici_aciklama].filter(Boolean).join(' ')).trim();
  if (ac) { const m = L.find(m => (m.onek || []).some(o => ac.startsWith(fold(o) + ' ') || ac === fold(o))) || L.find(m => (m.kelime || []).some(k => k.length >= 4 && new RegExp(`(^|[^\\p{L}])${rx(fold(k))}([^\\p{L}]|$)`, 'u').test(ac))); if (m) return markaAdi(m); }
  return null;
}
// Kısa marka adı: "Osram / Ledvance" → kalemde "Ledvance"? Tanımdaki adın ilk parçası yazılır (kullanıcı değiştirebilir)
const markaAdi = m => String(m.ad || '').split('/')[0].trim().toLocaleUpperCase('tr');
// Marka logosu: tanımdaki küçük logo; yoksa marka renginde baş harfler
export const markaTanimi = marka => { const f = fold(marka || '').trim(); if (!f) return null; return markalar().find(x => fold(x.ad) === f || fold(x.ad).split('/').map(t => t.trim()).includes(f)) || null; };
const RENKLER = ['#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be123c', '#0e7490', '#4d7c0f', '#9a3412'];
const renkSec = ad => { let h = 0; for (const c of String(ad)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return RENKLER[h % RENKLER.length]; };
export function markaLogo(marka, { buyuk = false } = {}) {
  const ad = String(marka || '').trim(); if (!ad) return '';
  const m = markaTanimi(ad), cls = buyuk ? ' mk-b' : '';
  if (m?.logo) return `<img class="mk-logo${cls}" src="${esc(m.logo)}" alt="${esc(ad)}" title="${esc(ad)}">`;
  const bas = ad.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean); const kisa = (bas.length > 1 ? bas.map(x => x[0]).join('') : ad).slice(0, 3).toLocaleUpperCase('tr');
  return `<span class="mk-bas${cls}" style="--mk:${esc(m?.renk || renkSec(fold(ad)))}" title="${esc(ad)}" aria-label="${esc(ad)}">${esc(kisa)}</span>`;
}
export function logoKucult(file, h = 64, w = 192) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, w / img.width, h / img.height), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; img.onerror = rej; img.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
}
export function markaSitesi(marka) { const m = markalar().find(x => fold(x.ad).split('/').map(t => t.trim()).includes(fold(marka || '').trim()) || fold(x.ad) === fold(marka || '')); return m?.site || ''; }
export const ureticideAra = (marka, kod, ac = '') => { const site = markaSitesi(marka); const q = [kod, site ? '' : marka, site ? '' : ac.split(/\s+/).slice(0, 3).join(' ')].filter(Boolean).join(' '); return `https://www.google.com/search?q=${encodeURIComponent((site ? `site:${site} ` : '') + q)}`; };
