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
export async function metinOku(blob, ilerleme) {
  const w = await hazirla(ilerleme);
  const { data } = await w.recognize(onIsle(await tuval(blob)));
  return data.text || '';
}
// Kartvizit: önce olduğu gibi okunur; sonuç zayıfsa 180°, 90° ve 270° döndürülerek denenir, en anlamlı okuma seçilir.
// donus: kartın kaç derece döndürülünce düz okunduğu (kaydedilen fotoğraf da buna göre çevrilir).
export async function kartvizitOku(blob, ilerleme, { yonDene = true } = {}) {
  const w = await hazirla(ilerleme);
  const { dondur } = await import('./kirp.js');
  const temel = onIsle(await tuval(blob));
  let en = null;
  for (const aci of yonDene ? [0, 180, 90, 270] : [0]) {
    if (aci) ilerleme?.('yön deneniyor', 0);
    const { data } = await w.recognize(dondur(temel, aci));
    const puan = okumaPuani(data);
    if (!en || puan > en.puan) en = { data, puan, aci };
    if (en.puan >= 40 && (data.confidence || 0) >= 70) break;
  }
  return { metin: en.data.text, donus: en.aci, guven: Math.round(en.data.confidence || 0), ...kartvizitAyristir(en.data.text) };
}

const UNVAN = /(genel müdür|müdür|mudur|müdürü|mühendis|muhendis|şef|sef|yönetici|yonetici|sorumlu|uzman|direktör|direktor|başkan|baskan|koordinatör|koordinator|satınalma|satin alma|satış|satis|teknik|proje|elektrik|tekniker|teknisyen|ortak|kurucu|sahibi|manager|engineer|director|sales|purchasing|ceo|cfo|coo|cto|owner|partner|specialist)/i;
const FIRMA = /(ltd|şti|sti|a\.?ş\.?|a\.s\.|inc|gmbh|san\.|tic\.|sanayi|ticaret|elektrik|elektronik|inşaat|insaat|mühendislik|muhendislik|enerji|yapı|yapi|holding|grup|group|aydınlatma|aydinlatma|otomasyon|taahhüt|taahhut|mimarlık|mimarlik|proje)/i;
const ADRES = /(mah\.?|mahalle|cad\.?|cadde|sok\.?|sokak|bulv|blv|no ?:|no\.|kat|osb|organize|sanayi sitesi|\/ ?(adana|mersin|hatay|osmaniye|istanbul|ankara|izmir)|\b\d{5}\b)/i;

// Kartvizit metnini alanlara ayırır
export function kartvizitAyristir(metin) {
  const satirlar = String(metin || '').split(/\n+/).map(s => s.replace(/[|_~•·]+/g, ' ').replace(/\s{2,}/g, ' ').trim()).filter(s => s.length > 1);
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
  const fk = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const f of S.firmalar || []) { const k = fk(f.ad).split(' ').slice(0, 2).join(' '); if (k.length >= 4 && fk(tum).includes(k)) { firma = f.ad; firmaId = f.id; break; } }
  if (!firma) firma = aday.find(s => FIRMA.test(s) && !UNVAN.test(s.split(' ')[0])) || null;
  const buyuk = w => w.length > 3 && w === w.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(w);
  if (firma && !firmaId) firma = firma.replace(/^(?:[A-ZÇĞİÖŞÜ0-9]{1,2}\s+)+(?=\S+\s+\S)/, '');   // logonun yanlış okunan harfleri
  if (firma && !firmaId) firma = firma.split(/\s+/).map(w => buyuk(w.replace(/[.,]/g, '')) ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  const unvan = aday.find(s => s !== firma && UNVAN.test(s) && s.split(' ').length <= 6) || null;
  // Ad soyad: 2-4 kelime, harflerden oluşan, unvan/firma olmayan; büyük harfle başlayan ilk aday
  const adAday = aday.filter(s => s !== firma && s !== unvan && !FIRMA.test(s) && !UNVAN.test(s) && /^[A-Za-zÇĞİÖŞÜçğıöşü.'\s-]+$/.test(s) && s.split(/\s+/).length >= 2 && s.split(/\s+/).length <= 4);
  let ad = adAday[0] || null;
  if (ad) ad = ad.split(/\s+/).map(w => w.length > 1 && w === w.toLocaleUpperCase('tr') ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  const adres = satirlar.filter(s => ADRES.test(s) && !/@|www\./.test(s)).map(temiz).join(', ') || null;
  const cep = telefonlar.find(t => t.tur === 'cep'), sabit = telefonlar.find(t => t.tur === 'sabit');
  return { ad_soyad: ad, unvan, firma, firma_id: firmaId, eposta, web, telefon: (cep || sabit)?.no || null, sabit: sabit?.no || null, telefonlar, adres };
}
