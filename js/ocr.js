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
  const YASAL = /(?<!\p{L})(ltd|şti|sti|a\.?ş|a\.s|inc|gmbh|san\.|tic\.|sanayi|ticaret)(?!\p{L})/iu;
  if (!firma) firma = aday.find(s => YASAL.test(s)) || [...aday].filter(s => FIRMA.test(s) && !UNVAN.test(s)).sort((a, b) => b.length - a.length)[0] || null;
  const buyuk = w => w.length > 3 && w === w.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(w);
  if (firma && !firmaId) firma = firma.replace(/^(?:[A-ZÇĞİÖŞÜ0-9]{1,2}\s+)+(?=\S+\s+\S)/, '');   // logonun yanlış okunan harfleri
  if (firma && !firmaId) firma = firma.split(/\s+/).map(w => buyuk(w.replace(/[.,]/g, '')) ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  if (firma && !firmaId) firma = firma.replace(/(?<!\p{L})tic\.?\s*ltd\.?/giu, 'Tic. Ltd.').replace(/(?<!\p{L})san\.?(?!\p{L})/giu, 'San.').replace(/(?<!\p{L})ve(?!\p{L})/giu, 've')
    .replace(/(?<!\p{L})tic\.?(?!\p{L})/giu, 'Tic.').replace(/(?<!\p{L})ltd\.?(?!\p{L})/giu, 'Ltd.').replace(/(?<!\p{L})şt[iİı]\.?(?!\p{L})/giu, 'Şti.').replace(/(?<!\p{L})a\.?ş\.?(?!\p{L})/giu, 'A.Ş.').replace(/\s{2,}/g, ' ').trim();
  const unvan = aday.find(s => s !== firma && UNVAN.test(s) && s.split(' ').length <= 6) || null;
  // Ad soyad: 2-4 kelime, harflerden oluşan, unvan/firma olmayan; büyük harfle başlayan ilk aday
  const adAday = aday.filter(s => s !== firma && s !== unvan && !FIRMA.test(s) && !UNVAN.test(s) && /^[A-Za-zÇĞİÖŞÜçğıöşü.'\s-]+$/.test(s) && s.split(/\s+/).length >= 2 && s.split(/\s+/).length <= 4);
  // Kartta en büyük yazılan uygun satır genellikle kişinin adıdır
  const boyu = s => satirBilgi?.find(x => x.metin === s)?.boy || 0;
  let ad = (satirBilgi ? [...adAday].sort((a, b) => boyu(b) - boyu(a)) : adAday)[0] || null;
  if (ad) ad = ad.split(/\s+/).map(w => w.length > 1 && w === w.toLocaleUpperCase('tr') ? w[0] + w.slice(1).toLocaleLowerCase('tr') : w).join(' ');
  const adres = satirlar.filter(s => ADRES.test(s) && !/@|www\./.test(s)).map(temiz).join(', ') || null;
  const cep = telefonlar.find(t => t.tur === 'cep'), sabit = telefonlar.find(t => t.tur === 'sabit');
  return { ad_soyad: ad, unvan, firma, firma_id: firmaId, eposta, web, telefon: (cep || sabit)?.no || null, sabit: sabit?.no || null, telefonlar, adres };
}
