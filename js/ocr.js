// Kartvizit okuma: Tesseract.js (tarayıcıda, ücretsiz) ile metin çıkarma ve alanlara ayırma.
// İlk kullanımda okuma motoru ve Türkçe dil verisi (~15 MB) indirilir, sonra tarayıcı önbelleğinden gelir.
import { S } from './db.js';
import { fold } from './ui.js';

const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let yukleniyor = null, isci = null;
function betik(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Okuma motoru indirilemedi. İnternet bağlantını kontrol et.')); document.head.appendChild(s); });
}
async function hazirla(ilerleme) {
  if (isci) { isci._ilerleme = ilerleme; return isci; }
  if (!window.Tesseract) await (yukleniyor ||= betik(window.__TESS_YOL?.betik || TESS));
  if (!window.Tesseract) { yukleniyor = null; throw new Error('Okuma motoru indirilemedi. İnternet bağlantını kontrol et.'); }
  const yol = window.__TESS_YOL || {};   // yalnızca testlerde yerel dosyalar kullanılır
  let w = null;
  w = await window.Tesseract.createWorker(['tur', 'eng'], 1, { ...(yol.workerPath ? { workerPath: yol.workerPath, corePath: yol.corePath, langPath: yol.langPath } : {}), logger: m => w?._ilerleme?.(m.status, m.progress) });
  w._ilerleme = ilerleme; isci = w;
  return isci;
}
// Okumadan önce: telefonun yön bilgisi uygulanır, küçük görsel büyütülür, gri tonlama ve otomatik kontrast (yüzdelik germe)
async function tuval(blob, uzun = 1800) {
  const { gorselYukle } = await import('./kirp.js');
  const k = await gorselYukle(blob, 4000);
  const sc = uzun / Math.max(k.width, k.height);
  if (Math.abs(sc - 1) < 0.05) return k;
  const c = document.createElement('canvas'); c.width = Math.round(k.width * sc); c.height = Math.round(k.height * sc);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(k, 0, 0, c.width, c.height);
  return c;
}
function onIsle(kaynak) {
  const c = document.createElement('canvas'); c.width = kaynak.width; c.height = kaynak.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(kaynak, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Uint32Array(256), n = p.length / 4;
  for (let i = 0; i < p.length; i += 4) { const g = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); p[i] = g; hist[g]++; }
  let alt = 0, ust = 255, s = 0; for (let i = 0; i < 256; i++) { s += hist[i]; if (s >= n * 0.01) { alt = i; break; } }
  s = 0; for (let i = 255; i >= 0; i--) { s += hist[i]; if (s >= n * 0.02) { ust = i; break; } }
  const ar = Math.max(40, ust - alt);
  for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (p[i] - alt) * 255 / ar)); p[i] = p[i + 1] = p[i + 2] = g; }
  x.putImageData(d, 0, 0);
  return c;
}
// Okumanın ne kadar anlamlı olduğu: güvenle okunan harf/rakam sayısı (yanlış yönde okunan metin düşük güvenle döner)
export function okumaPuani(data) {
  let p = 0; for (const w of data.words || []) { const t = (w.text || '').replace(/[^\p{L}\p{N}@.]/gu, ''); if (t.length >= 2 && w.confidence >= 60) p += t.length * w.confidence / 100; }
  return p;
}
// Genel metin okuma (ürün etiketi, şantiye tabelası)
async function tani(w, c, psm) { await w.setParameters({ tessedit_pageseg_mode: psm }); return (await w.recognize(c)).data; }
export async function metinOku(blob, ilerleme) {
  const w = await hazirla(ilerleme);
  return (await tani(w, onIsle(await tuval(blob)), '3')).text || '';
}
// Tabela: lacivert / koyu zeminli kutulardaki açık renkli yazı (etiket hücreleri) bölgesel olarak ters çevrilir,
// böylece bütün yazı açık zemin üstünde koyu olur. Karar, pencere içindeki koyu piksel oranıyla verilir (kalın siyah logo yazısı ters çevrilmez).
export function tersBolge(kaynak) {
  const W = kaynak.width, H = kaynak.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(kaynak, 0, 0);
  const d = x.getImageData(0, 0, W, H), p = d.data, g = new Uint8Array(W * H), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); g[j] = v; hist[v]++; }
  // Otsu eşiği: koyu / açık ayrımı
  let top = 0; for (let i = 0; i < 256; i++) top += i * hist[i];
  let wB = 0, sB = 0, en = 0, esik = 128; for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = W * H - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (top - sB) / wF, ara = wB * wF * (mB - mF) ** 2; if (ara > en) { en = ara; esik = i; } }
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let sat = 0; for (let xx = 0; xx < W; xx++) { sat += g[y * W + xx] < esik ? 1 : 0; I[(y + 1) * (W + 1) + xx + 1] = I[y * (W + 1) + xx + 1] + sat; } }
  const r = Math.max(12, Math.round(Math.min(W, H) / 18));
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let xx = 0; xx < W; xx++) {
      const x0 = Math.max(0, xx - r), x1 = Math.min(W, xx + r + 1);
      const koyu = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      const v = koyu > 0.55 ? 255 - g[y * W + xx] : g[y * W + xx], o = (y * W + xx) * 4;
      p[o] = p[o + 1] = p[o + 2] = v;
    }
  }
  x.putImageData(d, 0, 0);
  return c;
}
// Satırlar konumlarıyla: tabelada etiket solda, değeri sağdaki hücrede olduğundan eşleştirme konuma göre yapılır
const satirKonum = data => (data.lines || []).map(l => {
  const ws = (l.words || []).filter(w => w.confidence >= 35 && /[\p{L}\p{N}]/u.test(w.text));
  if (!ws.length) return null;
  return { metin: ws.map(w => w.text).join(' ').replace(/\s{2,}/g, ' ').trim(), x0: Math.min(...ws.map(w => w.bbox.x0)), x1: Math.max(...ws.map(w => w.bbox.x1)), y0: Math.min(...ws.map(w => w.bbox.y0)), y1: Math.max(...ws.map(w => w.bbox.y1)), guven: l.confidence };
}).filter(x => x && x.metin.replace(/[^\p{L}\p{N}]/gu, '').length >= 2);
// Tabelanın etiket hücreleri: koyu zeminli (lacivert, kırmızı…) dikdörtgen kutular. Görsel küçük karelere bölünür,
// çoğu koyu olan kareler birleştirilip dikdörtgen gibi dolu ve aynı sütunda (sol kenarları hizalı) duranlar etiket hücresi sayılır.
export function hucreBul(gri) {
  const W = gri.width, H = gri.height, x = gri.getContext('2d', { willReadFrequently: true }), p = x.getImageData(0, 0, W, H).data;
  const B = Math.max(6, Math.round(W / 90)), gw = Math.ceil(W / B), gh = Math.ceil(H / B), koyu = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let k = 0, n = 0;
    for (let y = gy * B; y < Math.min(H, gy * B + B); y += 2) for (let xx = gx * B; xx < Math.min(W, gx * B + B); xx += 2) { n++; if (p[(y * W + xx) * 4] < 110) k++; }
    koyu[gy * gw + gx] = k / n > 0.5 ? 1 : 0;
  }
  // Kapanış: harflerin açtığı delikleri doldur (genişlet + daralt)
  const genis = (a, deger) => { const b = new Uint8Array(a.length); for (let y = 0; y < gh; y++) for (let xx = 0; xx < gw; xx++) { let v = deger ? 0 : 1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, x2 = xx + dx; const q = yy < 0 || yy >= gh || x2 < 0 || x2 >= gw ? 1 - deger : a[yy * gw + x2]; if (deger ? q : !q) v = deger; } b[y * gw + xx] = v; } return b; };
  const m = koyu;
  const gor = new Uint8Array(m.length), parca = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || gor[i]) continue;
    const yigin = [i]; gor[i] = 1; let x0 = gw, y0 = gh, x1 = 0, y1 = 0, n = 0;
    while (yigin.length) { const c = yigin.pop(), cx = c % gw, cy = (c - cx) / gw; n++; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const j = ny * gw + nx; if (m[j] && !gor[j]) { gor[j] = 1; yigin.push(j); } } }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (!(n / (w * h) >= 0.6 && w * B >= W * 0.12 && w * B <= W * 0.7 && h * B >= H * 0.025)) continue;
    // Alt alta bitişik kutular tek parça görünür: aralarındaki ince açık çizgilerden (koyu oranı düşük piksel satırları) bölünür
    const X0 = x0 * B, X1 = Math.min(W, (x1 + 1) * B), Y0 = y0 * B, Y1 = Math.min(H, (y1 + 1) * B);
    const ic0 = X0 + Math.round((X1 - X0) * 0.1), ic1 = X1 - Math.round((X1 - X0) * 0.1);
    let bas = null;
    for (let y = Y0; y <= Y1; y++) {
      let k = 0, t = 0; if (y < Y1) for (let xx = ic0; xx < ic1; xx += 2) { t++; if (p[(y * W + xx) * 4] < 110) k++; }
      const dolu = y < Y1 && k / t > 0.15;
      if (dolu && bas === null) bas = y;
      if (!dolu && bas !== null) { if (y - bas >= H * 0.022) parca.push({ x0: X0, y0: bas, x1: X1, y1: y }); bas = null; }
    }
  }
  if (parca.length < 2) return [];
  // Aynı sütundakiler: sol kenarı en çok hücrenin hizalandığı yer
  const hiza = parca.map(a => parca.filter(b => Math.abs(b.x0 - a.x0) < W * 0.05).length), en = Math.max(...hiza);
  const sutun = parca.filter((a, i) => hiza[i] === en);
  return en >= 2 ? sutun.sort((a, b) => a.y0 - b.y0) : [];
}
const kes = (kaynak, r, ters = false) => {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(r.x1 - r.x0)); c.height = Math.max(1, Math.round(r.y1 - r.y0));
  const x = c.getContext('2d'); if (ters) x.filter = 'invert(1)'; x.fillStyle = ters ? '#000' : '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(kaynak, r.x0, r.y0, c.width, c.height, 0, 0, c.width, c.height); return c;
};
const satirlar = t => String(t || '').split(/\n+/).map(s => s.replace(/[|_~]+/g, ' ').replace(/\s{2,}/g, ' ').trim()).filter(s => s.replace(/[^\p{L}\p{N}]/gu, '').length >= 2);
// Tabela okuma: etiket hücreleri bulunursa her satır ayrı okunur (etiket kutusu ters çevrilip, değeri sağındaki alandan);
// bulunamazsa bütün tabela konumlu satırlarla okunur (tabela.js etiket ile değeri yan yana getirir)
export async function tabelaOku(blob, ilerleme) {
  const w = await hazirla(ilerleme);
  const gri = onIsle(await tuval(blob, 2400)), W = gri.width;
  const hucre = hucreBul(gri);
  if (hucre.length >= 2) {
    const sag = Math.max(...hucre.map(h => h.x1)), pay = Math.round(W * 0.01), sonuc = [];
    for (const [i, h] of hucre.entries()) {
      ilerleme?.('satır okunuyor', i / hucre.length);
      const etiket = satirlar((await tani(w, kes(gri, { x0: h.x0 + pay, y0: h.y0 + pay / 2, x1: h.x1 - pay, y1: h.y1 - pay / 2 }, true), '6')).text);
      const degerler = satirlar((await tani(w, kes(gri, { x0: sag + pay, y0: h.y0, x1: Math.min(W - pay, h.x1 + (h.x1 - h.x0) * 2.4), y1: h.y1 }), '4')).text);
      sonuc.push({ etiket, degerler });
    }
    // Hücrelerin üstü: logo ve başlık (proje adı burada olabilir)
    const ust = hucre[0].y0 > gri.height * 0.06 ? satirlar((await tani(w, kes(gri, { x0: 0, y0: 0, x1: W, y1: hucre[0].y0 }), '3')).text) : [];
    return { hucreler: sonuc, ust, metin: [...ust, ...sonuc.flatMap(h => [...h.etiket, ...h.degerler])].join('\n'), satirlar: [] };
  }
  const temel = onIsle(tersBolge(gri));
  let data = await tani(w, temel, '3'), puan = okumaPuani(data);
  if (puan < 120) { ilerleme?.('yeniden okunuyor', 0); const d2 = await tani(w, temel, '11'), p2 = okumaPuani(d2); if (p2 > puan * 1.15) { data = d2; puan = p2; } }
  return { metin: data.text || '', satirlar: satirKonum(data), guven: Math.round(data.confidence || 0) };
}
// Ürün / koli etiketi: yön denenir (etiket yan ya da ters çekilmiş olabilir), seyrek metin (11) ve blok (6) okumaları birleştirilir; tablo hücreleri ikisinden birinde yakalanır
export async function etiketOku(blob, ilerleme) {
  const w = await hazirla(ilerleme);
  const { dondur } = await import('./kirp.js');
  const temel = onIsle(await tuval(blob, 2000));
  let en = null;
  for (const aci of [0, 90, 270, 180]) {
    if (aci) ilerleme?.('yön deneniyor', 0);
    const data = await tani(w, dondur(temel, aci), '11');
    const puan = okumaPuani(data);
    if (!en || puan > en.puan) en = { data, puan, aci };
    if (en.puan >= 60) break;
  }
  ilerleme?.('tablo okunuyor', 0);
  const blok = await tani(w, dondur(temel, en.aci), '6');
  return { metin: [en.data.text || '', blok.text || ''].join('\n'), donus: en.aci, guven: Math.round(en.data.confidence || 0) };
}
// Okunan satırlar: düşük güvenli satırlar ve kelimeler (QR kod, logo, desen) atılır; her satırın yazı yüksekliği tutulur
export function satirlariAl(data) {
  const ort = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  return (data.lines || []).map(l => {
    const ws = (l.words || []).filter(w => w.confidence >= 45 && /[\p{L}\p{N}@]/u.test(w.text));
    return { metin: ws.map(w => w.text).join(' ').replace(/\s{2,}/g, ' ').trim(), boy: ort(ws.map(w => w.bbox.y1 - w.bbox.y0)), guven: l.confidence };
  }).filter(x => x.metin.replace(/[^\p{L}\p{N}]/gu, '').length >= 2 && x.guven >= 50);
}
// Kartvizit: dağınık yazı düzeninde okunur (isim, logo ve iletişim blokları ayrı yerlerde olduğu için).
// Sonuç zayıfsa 180°, 90° ve 270° döndürülerek denenir, en anlamlı okuma seçilir.
// donus: kartın kaç derece döndürülünce düz okunduğu (kaydedilen fotoğraf da buna göre çevrilir).
export async function kartvizitOku(blob, ilerleme, { yonDene = true } = {}) {
  const w = await hazirla(ilerleme);
  const { dondur } = await import('./kirp.js');
  const temel = await tuval(blob);
  let en = null;
  for (const aci of yonDene ? [0, 180, 90, 270] : [0]) {
    if (aci) ilerleme?.('yön deneniyor', 0);
    const data = await tani(w, dondur(temel, aci), '11');
    const puan = okumaPuani(data);
    if (!en || puan > en.puan) en = { data, puan, aci };
    if (en.puan >= 40 && (data.confidence || 0) >= 65) break;
  }
  const satir = satirlariAl(en.data);
  return { metin: satir.map(x => x.metin).join('\n'), donus: en.aci, guven: Math.round(en.data.confidence || 0), ...kartvizitAyristir(satir.map(x => x.metin).join('\n'), satir) };
}

// Unvan: kişinin görevini anlatan sözcükler (\"Mühendislik\", \"Elektrik\" gibi firma sözcükleri tek başına unvan sayılmaz)
const UNVAN = /(genel müdür|müdür|mudur|mühendis(?!lik)|muhendis(?!lik)|\bşef\b|\bsef\b|yönetici|yonetici|sorumlu|uzman|direktör|direktor|başkan|baskan|koordinatör|koordinator|tekniker|teknisyen|\bortak\b|kurucu|sahibi|temsilci|danışman|danisman|asistan|manager|engineer|director|purchasing|\bceo\b|\bcfo\b|\bcoo\b|\bcto\b|owner|partner|specialist|representative)/i;
const FIRMA = /((?<!\p{L})(?:ltd|şti|sti|a\.?ş|a\.s|inc|gmbh|san\.|tic\.)(?!\p{L})|sanayi|ticaret|elektrik|elektronik|inşaat|insaat|mühendislik|muhendislik|enerji|yapı|yapi|holding|grup|group|aydınlatma|aydinlatma|otomasyon|taahhüt|taahhut|mimarlık|mimarlik|proje)/iu;
const ADRES = /(mah\.?|mahalle|cad\.?|cadde|sok\.?|sokak|bulv|blv|no ?:|no\.|kat|osb|organize|sanayi sitesi|\/ ?(adana|mersin|hatay|osmaniye|istanbul|ankara|izmir)|\b\d{5}\b)/i;

// Kartvizit metnini alanlara ayırır
export function kartvizitAyristir(metin, satirBilgi = null) {
  // Satır temizliği: logo/simgeden kalan baştaki küçük harfli kısa parçalar ("vs", "kA") atılır; "$" çoğu zaman "ş"dir (I$ → İş)
  const satirlar = String(metin || '').split(/\n+/).map(s => s.replace(/[|_~•·]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    .replace(/^(?:[a-zçğıöşü][\p{L}]?\s+)+(?=\p{L}{3,})/u, '').replace(/(?<=\p{L})\$|\$(?=\p{L})/gu, 'ş').replace(/(?<!\p{L})I[şŞ](?!\p{L})/gu, 'İş')).filter(s => s.length > 1);
  const tum = satirlar.join('\n');
  const eposta = (/[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(tum) || [''])[0].replace(/\s/g, '').toLowerCase() || null;
  const web = (/(?:https?:\/\/)?(?:www\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/i.exec(tum) || [''])[0].toLowerCase() || (eposta && !/gmail|hotmail|yahoo|outlook|icloud|yandex/.test(eposta) ? 'www.' + eposta.split('@')[1] : null);
  // Telefonlar: +90 5xx xxx xx xx, 0 (322) xxx xx xx, 0532-xxx-xx-xx…
  const telefonlar = [];
  for (const m of tum.matchAll(/(?:\+?\s?90[\s.-]?)?\(?0?\s?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g)) {
    let n = m[0].replace(/\D/g, ''); if (n.startsWith('90')) n = n.slice(2); if (n.startsWith('0')) n = n.slice(1);
    if (n.length !== 10) continue;
    const once = tum.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
    const tur = /fax|faks|f\s*[:.]/.test(once) ? 'faks' : n.startsWith('5') ? 'cep' : 'sabit';
    const bicim = '0' + n.slice(0, 3) + ' ' + n.slice(3, 6) + ' ' + n.slice(6, 8) + ' ' + n.slice(8);
    if (!telefonlar.some(t => t.no === bicim)) telefonlar.push({ no: bicim, tur });
  }
  const temiz = s => s.replace(/(e-?posta|e-?mail|mail|tel|gsm|cep|mobile|fax|faks|web)\s*[:.]?/gi, '').trim();
  const aday = satirlar.filter(s => !/@|www\.|https?:/i.test(s) && (s.match(/\d/g) || []).length < 4 && !ADRES.test(s));
  // Firma: kayıtlı firmalardan eşleşen ya da şirket ekleri içeren satır
  let firma = null, firmaId = null;
  // E-posta ve web adresinden ipuçları: alan adı genelde firmanın, e-postanın başı genelde kişinin adıdır
  const GENEL = /^(gmail|hotmail|yahoo|outlook|icloud|yandex|live|msn|mynet)\./;
  const alanAdi = (eposta && !GENEL.test(eposta.split('@')[1]) ? eposta.split('@')[1] : (web || '').replace(/^(https?:\/\/)?(www\.)?/, '')).split('.')[0] || '';
  const yerel = eposta ? eposta.split('@')[0].replace(/[^a-z]/g, '') : '';
  const harf = s => fold(s).replace(/[^a-z]/g, '');
  const sirketMi = s => { const h = harf(s); return alanAdi.length >= 3 && h.length >= 3 && (alanAdi.includes(h) || fold(s).split(/\s+/).some(w => w.replace(/[^a-z]/g, '').length >= 4 && alanAdi.includes(w.replace(/[^a-z]/g, '')))); };
  const kisiMi = s => { const w = fold(s).split(/\s+/).map(x => x.replace(/[^a-z]/g, '')).filter(x => x.length >= 3); return !!yerel && w.length > 0 && w.some(x => yerel.includes(x)); };
  if (alanAdi) for (const f of S.firmalar || []) { const d = [f.web, f.eposta].map(x => String(x || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('@').pop().split('.')[0]); if (d.includes(alanAdi)) { firma = f.ad; firmaId = f.id; break; } }
  const fk = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!firma) for (const f of S.firmalar || []) { const k = fk(f.ad).split(' ').slice(0, 2).join(' '); if (k.length >= 4 && fk(tum).includes(k)) { firma = f.ad; firmaId = f.id; break; } }
  const YASAL = /(?<!\p{L})(ltd|şti|sti|a\.?ş|a\.s|inc|gmbh|san\.|tic\.|sanayi|ticaret)(?!\p{L})/iu;
  if (!firma) firma = aday.find(s => YASAL.test(s)) || [...aday].filter(s => FIRMA.test(s) && !UNVAN.test(s)).sort((a, b) => b.length - a.length)[0] || aday.find(s => sirketMi(s) && !kisiMi(s) && !UNVAN.test(s)) || null;
  const buyuk = w => w.length > 3 && w === w.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(w);
  if (firma && !firmaId) firma = firma.replace(/^(?:[A-ZÇĞİÖŞÜ0-9]{1,2}\s+)+(?=\S+\s+\S)/, '');   // logonun yanlış okunan harfleri
  if (firma && !firmaId) firma = firma.split(/\s+/).map(w => buyuk(w.replace(/[.,]/g, '')) ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  if (firma && !firmaId) firma = firma.replace(/(?<!\p{L})tic\.?\s*ltd\.?/giu, 'Tic. Ltd.').replace(/(?<!\p{L})san\.?(?!\p{L})/giu, 'San.').replace(/(?<!\p{L})ve(?!\p{L})/giu, 've')
    .replace(/(?<!\p{L})tic\.?(?!\p{L})/giu, 'Tic.').replace(/(?<!\p{L})ltd\.?(?!\p{L})/giu, 'Ltd.').replace(/(?<!\p{L})şt[iİı]\.?(?!\p{L})/giu, 'Şti.').replace(/(?<!\p{L})a\.?ş\.?(?!\p{L})/giu, 'A.Ş.').replace(/\s{2,}/g, ' ').trim();
  let unvan = aday.find(s => s !== firma && UNVAN.test(s) && s.split(' ').length <= 6) || null;
  if (unvan) unvan = unvan.split(/\s+/).map(w => buyuk(w) ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  // Ad soyad: 2-4 kelime, harflerden oluşan, unvan/firma olmayan; büyük harfle başlayan ilk aday
  const adAday = aday.filter(s => s !== firma && !(sirketMi(s) && !kisiMi(s)) && !UNVAN.test(s) && s !== unvan && !FIRMA.test(s) && !UNVAN.test(s) && /^[A-Za-zÇĞİÖŞÜçğıöşü.'\s-]+$/.test(s) && s.split(/\s+/).length >= 2 && s.split(/\s+/).length <= 4);
  // Kartta en büyük yazılan uygun satır genellikle kişinin adıdır
  const boyu = s => satirBilgi?.find(x => x.metin === s)?.boy || 0;
  // E-postanın başında geçen ad (merihdoner → Merih Döner) en güçlü ipucu; sonra yazı büyüklüğü
  let ad = [...adAday].sort((a, b) => (kisiMi(b) - kisiMi(a)) || (satirBilgi ? boyu(b) - boyu(a) : 0))[0] || null;
  if (ad) ad = ad.split(/\s+/).map(w => w.length > 1 && w === w.toLocaleUpperCase('tr') ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  const adres = satirlar.filter(s => ADRES.test(s) && !/@|www\./.test(s)).map(temiz).join(', ') || null;
  const cep = telefonlar.find(t => t.tur === 'cep'), sabit = telefonlar.find(t => t.tur === 'sabit');
  return { ad_soyad: ad, unvan, firma, firma_id: firmaId, eposta, web, telefon: (cep || sabit)?.no || null, sabit: sabit?.no || null, telefonlar, adres };
}
