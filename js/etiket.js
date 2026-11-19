// Etiketler: ürün etiketi (üstünde 1 adet) ve koli etiketi (kolideki adet). Etiketteki QR kod: STK1|kod|adet|parti
// Okutunca koli etiketi kolideki adedi, ürün etiketi ya da üreticinin barkodu 1 adet sayar. Etiketle stoğa giriş, depodan çıkış, sevk ve sayım.
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, tarih, today, fold, toast, openDrawer, closeDrawer, confirmBox } from './ui.js';
import { bayiStokYaz, ayniKalem, depoAdi, aktifMi } from './stok.js';
import { barkodBul, eanGecerli, taniKutusu } from './ureticietiket.js';

// ---------- Etiket içeriği ----------
const temiz = v => String(v ?? '').replace(/\|/g, '/').trim();
export const etiketMetni = ({ kod, adet = 1, parti = '' }) => ['STK1', temiz(kod), +adet || 1, temiz(parti)].join('|').replace(/\|$/, '');
// Okunan metin → { kod, adet, parti, koli }. Bizim etiketimiz değilse (üretici barkodu, elle yazılan kod) 1 adet.
export function etiketCoz(metin) {
  const m = String(metin ?? '').trim(); if (!m) return null;
  const p = m.split('|');
  if (p[0] === 'STK1' && p[1]) { const adet = Math.max(1, +String(p[2] || '1').replace(',', '.') || 1); return { kod: p[1].trim(), adet, parti: (p[3] || '').trim() || null, koli: adet > 1, etiket: true }; }
  // "kod x 20" ya da "kod*20" elle hızlı giriş
  const c = /^(.+?)\s*[x*×]\s*(\d+(?:[.,]\d+)?)$/i.exec(m);
  if (c) return { kod: c[1].trim(), adet: +c[2].replace(',', '.'), parti: null, koli: false, etiket: false };
  return { kod: m, adet: 1, parti: null, koli: false, etiket: false };
}
// Okunan kod hangi kalem: ürün kodu, firma stok kodu, üretici kodu ya da barkod
export function kalemBul(kalemler, kod) {
  const k = fold(String(kod || '').trim()); if (!k) return null;
  return kalemler.find(s => fold(String(s.kod || '')) === k) || kalemler.find(s => [s.firma_kodu, s.uretici_kodu, s.barkod].some(v => v && fold(String(v)) === k)) || null;
}

// Okunanı çöz: bizim etiketimiz (STK1) → kod ve adet; öğrenilmiş üretici barkodu → eşlenen kod ve adet (koli barkodu kolideki adet);
// kalem kodu / firma kodu / üretici kodu / kalem barkodu → 1 adet. bilinmeyen: stokta karşılığı olmayan geçerli bir EAN (eşleme ister).
export function okunaniCoz(metin, kalemler, firma_id = null) {
  const e = etiketCoz(metin); if (!e) return null;
  if (!e.etiket) { const m = barkodBul(e.kod, firma_id);
    if (m) { const s = kalemler.find(x => x.kod === m.kod) || null; return { ...e, kod: m.kod, adet: (+m.adet || 1) * (e.adet || 1), koli: (+m.adet || 1) > 1, s, eslesme: m }; } }
  const s = kalemBul(kalemler, e.kod);
  if (s) return { ...e, kod: s.kod, s };
  return { ...e, s: null, bilinmeyen: !e.etiket && eanGecerli(e.kod) };
}

// ---------- QR kod (js/vendor/qrcode.js, MIT, Kazuhiko Arase) ----------
let qrSoz = null;
export const qrYukle = () => window.qrcode ? Promise.resolve(window.qrcode) : (qrSoz ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('./vendor/qrcode.js', import.meta.url).href; s.onload = () => { try { window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8']; } catch {} res(window.qrcode); }; s.onerror = () => { qrSoz = null; rej(new Error('QR kütüphanesi yüklenemedi')); }; document.head.appendChild(s); }));
export function qrSvg(metin) {
  const q = window.qrcode(0, 'M'); q.addData(metin); q.make();
  const n = q.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ---------- Etiket boyutları ----------
export const BOYUTLAR = {
  '50x25': { ad: '50 × 25 mm (termal)', w: 50, h: 25 },
  '70x40': { ad: '70 × 40 mm (termal)', w: 70, h: 40 },
  '100x50': { ad: '100 × 50 mm (koli, termal)', w: 100, h: 50 },
  '100x150': { ad: '100 × 150 mm (koli, kargo boyu)', w: 100, h: 150 },
  'a4-24': { ad: 'A4 yapışkan yaprak, 3 × 8 (70 × 37 mm)', w: 70, h: 37, a4: [3, 8] },
};
// Etiket listesi: [{ s, tur: 'urun'|'koli', adet, parti, kopya }]
export function etiketBelgesi(liste, { boyut = '50x25', baslik = '', bayi = '' } = {}) {
  const B = BOYUTLAR[boyut] || BOYUTLAR['50x25'], buyuk = B.h >= 50, kare = Math.min(B.h - 4, B.w * 0.45);
  const tek = e => `<div class="et ${e.tur}"><div class="qr">${qrSvg(etiketMetni({ kod: e.s.kod, adet: e.tur === 'koli' ? e.adet : 1, parti: e.parti }))}</div>
    <div class="tx"><b class="kod">${esc(e.s.kod)}</b>${e.s.firma_kodu ? `<span class="fk">${esc(e.s.firma_kodu)}</span>` : ''}<span class="ac">${esc(e.s.aciklama || '')}</span>
    <span class="ad">${e.tur === 'koli' ? `KOLİ · ${num(e.adet)} ${esc(e.s.birim || 'Adet')}` : `1 ${esc(e.s.birim || 'Adet')}`}</span>${e.parti ? `<span class="pt">Parti ${esc(e.parti)}</span>` : ''}${buyuk && (bayi || baslik) ? `<span class="by">${esc([bayi, baslik].filter(Boolean).join(' · '))}</span>` : ''}${buyuk ? `<span class="tr">${tarih(today())}</span>` : ''}</div></div>`;
  const hepsi = liste.flatMap(e => Array.from({ length: Math.max(0, Math.min(500, +e.kopya || 0)) }, () => e));
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Etiketler</title><style>
    @page { size: ${B.a4 ? 'A4' : `${B.w}mm ${B.h}mm`}; margin: ${B.a4 ? '10mm 0 0 0' : '0'}; }
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { font-family: Arial, Helvetica, sans-serif; color: #000; }
    .sayfa { ${B.a4 ? `display: grid; grid-template-columns: repeat(${B.a4[0]}, ${B.w}mm); grid-auto-rows: ${B.h}mm; justify-content: center;` : ''} }
    .et { width: ${B.w}mm; height: ${B.h}mm; box-sizing: border-box; padding: ${buyuk ? 3 : 1.5}mm; display: flex; gap: 2mm; align-items: ${buyuk ? 'flex-start' : 'center'}; overflow: hidden; ${B.a4 ? '' : 'page-break-after: always; break-after: page;'} }
    .et .qr { width: ${kare}mm; height: ${kare}mm; flex: 0 0 auto; } .et .qr svg { width: 100%; height: 100%; display: block; }
    .tx { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; font-size: ${buyuk ? 10 : 6.5}pt; }
    .kod { font-size: ${buyuk ? 15 : 9}pt; } .fk, .pt, .by, .tr { color: #222; } .ac { overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${buyuk ? 4 : 2}; -webkit-box-orient: vertical; }
    .ad { font-weight: 700; font-size: ${buyuk ? 16 : 8}pt; margin-top: 1mm; } .koli .ad { ${buyuk ? 'border: 0.6mm solid #000; padding: 0.5mm 1.5mm; align-self: flex-start;' : ''} }
    @media screen { body { background: #ddd; } .sayfa { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; } .et { background: #fff; } }
  </style></head><body><div class="sayfa">${hepsi.map(tek).join('')}</div></body></html>`;
}
const yazdir = html => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; f.srcdoc = html; document.body.appendChild(f);
  f.onload = () => { setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Yazdırılamadı: ' + e.message, 'err'); } setTimeout(() => f.remove(), 60000); }, 200); }; };

// ---------- Etiket yazdır penceresi ----------
export function etiketPenceresi({ kalemler, bayiAdi = '', sonra }) {
  let tur = 'urun';
  const B0 = (() => { try { return localStorage.getItem('saha-etiket-boyut') || '50x25'; } catch { return '50x25'; } })();
  const satirlar = kalemler.map(s => ({ s, koliIci: +s.koli_ici || 0, kopya: 1, parti: '' }));
  const p = openDrawer('<div class="dbody"></div>', { wide: true });
  const varsayilanKopya = r => tur === 'urun' ? Math.max(1, Math.round(+r.s.adet || 1)) : (r.koliIci ? Math.max(1, Math.ceil((+r.s.adet || 0) / r.koliIci)) : 1);
  const ciz = () => {
    p.innerHTML = `<header class="dh"><div><p class="muted">${esc(bayiAdi)} · ${kalemler.length} kalem</p><h2 id="drawer-title">Etiket yazdır</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      <div class="seg" role="group" aria-label="Etiket türü"><button type="button" data-tur="urun" class="${tur === 'urun' ? 'on' : ''}">Ürün etiketi (1 adet)</button><button type="button" data-tur="koli" class="${tur === 'koli' ? 'on' : ''}">Koli etiketi (kolideki adet)</button></div>
      <p class="hint">${tur === 'urun' ? 'Her ürünün üstüne yapıştırılır; okutunca 1 adet sayılır. Kopya sayısı stok miktarından gelir.' : 'Koliye yapıştırılır; okutunca kolideki adet kadar sayılır (giriş, çıkış, sevk, sayım). Koli içi adedi kalem kartına kaydedilir.'}</p>
      <label class="fld"><span>Etiket boyutu</span><select data-boyut>${Object.entries(BOYUTLAR).map(([k, v]) => `<option value="${k}" ${k === B0 ? 'selected' : ''}>${esc(v.ad)}</option>`).join('')}</select></label>
      <div class="tbl-wrap"><table class="tbl et-t"><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Stok</th>${tur === 'koli' ? '<th class="r">Koli içi</th>' : ''}<th>Parti / lot</th><th class="r">Etiket sayısı</th></tr></thead><tbody>
      ${satirlar.map((r, i) => `<tr><td class="mono">${esc(r.s.kod)}</td><td>${esc(r.s.aciklama || '')}</td><td class="r num">${num(r.s.adet)}</td>${tur === 'koli' ? `<td class="r"><input type="number" inputmode="numeric" min="1" class="sy-say" data-koli="${i}" value="${r.koliIci || ''}" placeholder="adet" aria-label="${esc(r.s.kod)} koli içi adet"></td>` : ''}<td><input data-parti="${i}" value="${esc(r.parti)}" placeholder="isteğe bağlı" aria-label="${esc(r.s.kod)} parti"></td><td class="r"><input type="number" inputmode="numeric" min="0" class="sy-say" data-kopya="${i}" value="${r.kopya}" aria-label="${esc(r.s.kod)} etiket sayısı"></td></tr>`).join('')}</tbody></table></div>
      <p data-ozet class="hint"></p>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-onizle>Önizleme</button><button type="button" class="btn primary" data-yazdir>Yazdır</button></div>
      <div class="tk-onizle" data-on hidden><iframe title="Etiket önizleme"></iframe></div>
    </div>`;
    const oz = () => { const n = satirlar.reduce((a, r) => a + (+r.kopya || 0), 0); p.querySelector('[data-ozet]').textContent = `${n} etiket${tur === 'koli' ? ` · ${num(satirlar.reduce((a, r) => a + (+r.kopya || 0) * (+r.koliIci || 0), 0))} adet ürün` : ''}`; };
    p.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { tur = b.dataset.tur; satirlar.forEach(r => { r.kopya = varsayilanKopya(r); }); ciz(); });
    p.querySelectorAll('[data-koli]').forEach(i => i.oninput = () => { const r = satirlar[+i.dataset.koli]; r.koliIci = +i.value || 0; r.kopya = varsayilanKopya(r); p.querySelector(`[data-kopya="${i.dataset.koli}"]`).value = r.kopya; oz(); });
    p.querySelectorAll('[data-kopya]').forEach(i => i.oninput = () => { satirlar[+i.dataset.kopya].kopya = Math.max(0, Math.round(+i.value || 0)); oz(); });
    p.querySelectorAll('[data-parti]').forEach(i => i.oninput = () => { satirlar[+i.dataset.parti].parti = i.value.trim(); });
    p.querySelector('[data-boyut]').onchange = e => { try { localStorage.setItem('saha-etiket-boyut', e.target.value); } catch {} };
    const hazir = async () => {
      if (tur === 'koli') { const eksik = satirlar.filter(r => r.kopya > 0 && !(r.koliIci > 0)); if (eksik.length) { toast(`Koli içi adedini yaz: ${eksik.slice(0, 3).map(r => r.s.kod).join(', ')}`, 'err'); return null; } }
      const l = satirlar.filter(r => r.kopya > 0); if (!l.length) { toast('Etiket sayısı 0.', 'err'); return null; }
      if (l.reduce((a, r) => a + r.kopya, 0) > 2000) { toast('Tek seferde en çok 2000 etiket.', 'err'); return null; }
      try { await qrYukle(); } catch (e) { toast(e.message, 'err'); return null; }
      return etiketBelgesi(l.map(r => ({ s: r.s, tur, adet: r.koliIci, parti: r.parti, kopya: r.kopya })), { boyut: p.querySelector('[data-boyut]').value, bayi: bayiAdi });
    };
    p.querySelector('[data-onizle]').onclick = async () => { const h = await hazir(); if (!h) return; const k = p.querySelector('[data-on]'); k.hidden = false; k.querySelector('iframe').srcdoc = h; };
    p.querySelector('[data-yazdir]').onclick = async () => { const h = await hazir(); if (!h) return; yazdir(h);
      if (tur === 'koli') { const deg = satirlar.filter(r => r.koliIci > 0 && r.koliIci !== (+r.s.koli_ici || 0)); if (deg.length) { try { await app.db.bulk('bayi_stok', deg.map(r => ({ ...(S.bayi_stok.find(x => x.id === r.s.id) || r.s), koli_ici: r.koliIci }))); r0(deg); } catch {} } }
      sonra?.(); };
    oz();
  };
  const r0 = deg => deg.forEach(r => { r.s = { ...r.s, koli_ici: r.koliIci }; });
  satirlar.forEach(r => { r.kopya = varsayilanKopya(r); });
  ciz();
}

// ---------- Kamera ile okuma ----------
export async function kameraBaslat(video, onKod) {
  if (!('BarcodeDetector' in window)) throw new Error('Bu tarayıcı kamerayla barkod okumayı desteklemiyor; okuyucu tabanca ya da elle yazma kullan.');
  const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = st; video.hidden = false; await video.play();
  const det = new window.BarcodeDetector(); let son = '', zaman = 0, dur = false;
  const tara = async () => { if (dur || video.hidden || !video.isConnected) { st.getTracks().forEach(t => t.stop()); return; }
    try { const r = await det.detect(video); const k = r[0]?.rawValue; if (k && (k !== son || Date.now() - zaman > 1500)) { son = k; zaman = Date.now(); try { navigator.vibrate?.(60); } catch {} await onKod(k); } } catch {}
    setTimeout(tara, 300); };
  tara();
  return () => { dur = true; st.getTracks().forEach(t => t.stop()); video.hidden = true; };
}

// ---------- Etiketle giriş / çıkış ----------
// mod: 'giris' stoğa ekler, 'cikis' depodan düşer. Okutulanlar listede toplanır, "Kaydet" ile stok hareketi yazılır.
export function etiketHareketPenceresi({ b, firma_id, depo = null, mod = 'giris', bayiAdi = '', sonra }) {
  const liste = new Map();   // anahtar kod → { s, kod, aciklama, birim, adet, parti:Set }
  let durdur = null, tani = null;
  const kalemler = () => (S.bayi_stok || []).filter(s => s.firma_id === firma_id && (s.depo || null) === (depo || null));
  const p = openDrawer('<div class="dbody"></div>', { wide: true, onClose: () => { durdur?.(); sonra?.(); } });
  const iskelet = () => {
    p.innerHTML = `<header class="dh"><div><p class="muted">${esc(bayiAdi)} · ${esc(depoAdi(depo))}</p><h2 id="drawer-title">${mod === 'giris' ? 'Etiketle stoğa giriş' : 'Etiketle depodan çıkış'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      <div class="seg" role="group" aria-label="Yön"><button type="button" data-mod="giris" class="${mod === 'giris' ? 'on' : ''}">Giriş (+)</button><button type="button" data-mod="cikis" class="${mod === 'cikis' ? 'on' : ''}">Çıkış (−)</button></div>
      <p class="hint">Koli etiketi kolideki adedi, ürün etiketi ya da üreticinin barkodu 1 adet sayar. Okuyucu tabancayla okut ya da kodu yazıp Enter'a bas (“kod x 12” 12 adet ekler). Kaydet'e basana kadar stok değişmez.</p>
      <div class="frow"><input type="search" data-okut placeholder="Etiketi okut ya da kodu yaz, Enter" aria-label="Etiket okut" autocomplete="off" enterkeyhint="go">${'BarcodeDetector' in window ? '<button type="button" class="btn" data-kam>Kamerayla okut</button>' : ''}</div>
      <video data-vid playsinline muted hidden class="et-vid"></video>
      <div data-utani class="ut-kutu"></div>
      <div data-l></div>
      <label class="fld"><span>Açıklama</span><input data-not placeholder="${mod === 'giris' ? 'ör. Tedarikçi irsaliyesi 12345' : 'ör. Şantiye teslimi, fire'}"></label>
    </div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-kaydet>Kaydet</button></div>`;
    p.querySelectorAll('[data-mod]').forEach(x => x.onclick = () => { mod = x.dataset.mod; p.querySelectorAll('[data-mod]').forEach(y => y.classList.toggle('on', y === x)); p.querySelector('#drawer-title').textContent = mod === 'giris' ? 'Etiketle stoğa giriş' : 'Etiketle depodan çıkış'; ciz(); });
    const inp = p.querySelector('[data-okut]');
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); okut(inp.value); inp.value = ''; } };
    p.querySelector('[data-kam]')?.addEventListener('click', async e => {
      if (durdur) { durdur(); durdur = null; e.target.textContent = 'Kamerayla okut'; return; }
      try { durdur = await kameraBaslat(p.querySelector('[data-vid]'), k => okut(k)); e.target.textContent = 'Kamerayı kapat'; } catch (er) { toast(er.message, 'err'); }
    });
    p.querySelector('[data-kaydet]').onclick = kaydet;
    tani = taniKutusu(p.querySelector('[data-utani]'), { kalemler, firma_id, yeniKalem: true, onEkle: ({ kod, adet, s: s0, aciklama }) => {
      const s = s0 || null; if (!s && mod === 'cikis') return toast(`${kod}: bu depoda böyle bir kalem yok.`, 'err');
      const u = !s && (S.urunler || []).find(x => x.kod === kod), r = liste.get(kod) || { s, kod, aciklama: s?.aciklama || u?.aciklama || aciklama || '', birim: s?.birim || u?.birim || 'Adet', adet: 0, parti: new Set(), yeni: !s };
      r.adet += adet; liste.set(kod, r); toast(`${kod}: ${mod === 'giris' ? '+' : '−'}${num(adet)}`); ciz(); } });
    setTimeout(() => inp.focus(), 50);
  };
  const okut = metin => {
    const e = okunaniCoz(metin, kalemler(), firma_id); if (!e) return;
    if (e.bilinmeyen) { tani?.bilinmeyenBarkod(e.kod); toast(`${e.kod}: bu barkod henüz tanımlı değil; ürünü seçip eşle.`, 'err'); return; }
    const s = e.s, u = !s && (S.urunler || []).find(x => fold(String(x.kod)) === fold(e.kod));
    if (!s && mod === 'cikis') { toast(`${e.kod}: bu depoda böyle bir kalem yok.`, 'err'); return; }
    const kod = s?.kod || u?.kod || e.kod, r = liste.get(kod) || { s, kod, aciklama: s?.aciklama || u?.aciklama || '', birim: s?.birim || u?.birim || 'Adet', adet: 0, parti: new Set(), yeni: !s };
    r.adet += e.adet; if (e.parti) r.parti.add(e.parti); liste.set(kod, r);
    toast(`${kod}: ${mod === 'giris' ? '+' : '−'}${num(e.adet)}${e.koli ? ' (koli)' : ''} · toplam ${num(r.adet)}`); ciz();
  };
  const ciz = () => {
    const l = [...liste.values()], kutu = p.querySelector('[data-l]'); if (!kutu) return;
    kutu.innerHTML = l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Stokta</th><th class="r">${mod === 'giris' ? 'Girecek' : 'Çıkacak'}</th><th class="r">Sonra</th><th></th></tr></thead><tbody>
      ${l.map((r, i) => { const st = +r.s?.adet || 0, sonra_ = mod === 'giris' ? st + r.adet : st - r.adet; return `<tr><td class="mono">${esc(r.kod)}${r.yeni ? ' <em class="flag soft">yeni kalem</em>' : ''}</td><td>${esc(r.aciklama)}${r.parti.size ? `<br><small class="muted">Parti ${esc([...r.parti].join(', '))}</small>` : ''}</td><td class="r num">${num(st)}</td><td class="r"><input type="number" inputmode="decimal" step="any" min="0" class="sy-say" data-m="${i}" value="${r.adet}" aria-label="${esc(r.kod)} miktar"></td><td class="r num ${sonra_ < 0 ? 'neg' : ''}">${num(sonra_)}</td><td><button type="button" class="x" data-sil="${i}" aria-label="${esc(r.kod)} çıkar">×</button></td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint">${l.length} kalem · ${num(l.reduce((a, r) => a + r.adet, 0))} adet</p>` : '<p class="muted">Henüz okutulan yok.</p>';
    kutu.querySelectorAll('[data-m]').forEach(i => i.onchange = () => { l[+i.dataset.m].adet = Math.max(0, +i.value || 0); ciz(); });
    kutu.querySelectorAll('[data-sil]').forEach(x => x.onclick = () => { liste.delete(l[+x.dataset.sil].kod); ciz(); });
  };
  const kaydet = async e => {
    const l = [...liste.values()].filter(r => r.adet > 0); if (!l.length) return toast('Okutulan kalem yok.', 'err');
    const eksi = mod === 'cikis' ? l.filter(r => (+r.s?.adet || 0) < r.adet) : [];
    if (eksi.length && !confirmBox(`${eksi.length} kalemde çıkış stoktan fazla:\n${eksi.slice(0, 6).map(r => `• ${r.kod}: stok ${num(r.s?.adet || 0)}, çıkış ${num(r.adet)}`).join('\n')}\n\nStok 0'ın altına düşmez, 0'da kalır. Devam edilsin mi?`)) return;
    e.target.disabled = true;
    const not = p.querySelector('[data-not]').value.trim();
    try {
      const rows = l.map(r => { const s = r.s && S.bayi_stok.find(x => x.id === r.s.id), st = +s?.adet || 0, yeni = mod === 'giris' ? st + r.adet : Math.max(0, st - r.adet);
        return s ? { ...s, adet: yeni } : { firma_id, depo: depo || null, kod: r.kod, aciklama: r.aciklama || null, birim: r.birim || 'Adet', adet: yeni, aktif: true, para_birimi: 'USD' }; });
      await bayiStokYaz(rows, { hareket: mod, aciklama: ['Etiketle ' + (mod === 'giris' ? 'giriş' : 'çıkış'), not].filter(Boolean).join(': ') });
      toast(`${l.length} kalem ${mod === 'giris' ? 'stoğa girdi' : 'depodan çıktı'}.`); liste.clear(); closeDrawer(true);
    } catch (er) { e.target.disabled = false; toast('Kaydedilemedi: ' + er.message, 'err'); }
  };
  iskelet(); ciz();
}
