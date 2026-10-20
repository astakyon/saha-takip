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
  if (isci) return isci;
  if (!window.Tesseract) await (yukleniyor ||= betik(TESS));
  isci = await window.Tesseract.createWorker(['tur', 'eng'], 1, { logger: m => ilerleme && m.status && ilerleme(m.status, m.progress) });
  return isci;
}
// Görseli okumadan önce gri tonlama ve kontrast (telefondan çekilen kartvizitlerde sonucu belirgin iyileştirir)
async function onIsle(blob) {
  const img = await createImageBitmap(blob);
  const sc = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g = Math.max(0, Math.min(255, (g - 128) * 1.5 + 140)); p[i] = p[i + 1] = p[i + 2] = g; }
  x.putImageData(d, 0, 0);
  return await new Promise(r => c.toBlob(r, 'image/png'));
}
export async function kartvizitOku(blob, ilerleme) {
  const w = await hazirla(ilerleme);
  const { data } = await w.recognize(await onIsle(blob));
  return { metin: data.text, ...kartvizitAyristir(data.text) };
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
