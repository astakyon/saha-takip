// Ziyaret fotoğrafına zaman ve konum damgası: çekildiği saat, konum (alınabildiyse) ve galeriden seçildiyse "Galeriden".
// Damga fotoğrafın altına şerit olarak yazılır; böylece fotoğrafın o an, o yerde çekildiği görünür.
import { myLocation } from './ui.js';

const konumAl = () => Promise.race([myLocation().catch(() => null), new Promise(r => setTimeout(() => r(null), 5000))]);
export async function damgala(file, { kamera = false } = {}) {
  if (!file?.type?.startsWith('image/')) return file;
  const simdi = new Date(), eski = !kamera || (file.lastModified && simdi - file.lastModified > 10 * 60e3);
  const konum = await konumAl();
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const sc = Math.min(1, 1600 / Math.max(img.width, img.height));
  const w = Math.round(img.width * sc), h = Math.round(img.height * sc), bant = Math.max(28, Math.round(w / 30));
  const c = document.createElement('canvas'); c.width = w; c.height = h + bant;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(img.src);
  x.fillStyle = '#111827'; x.fillRect(0, h, w, bant);
  const zaman = (eski && file.lastModified ? new Date(file.lastModified) : simdi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const metin = [zaman, konum ? `${konum[0].toFixed(5)}, ${konum[1].toFixed(5)}` : 'konum yok', eski ? 'Galeriden' : 'Saha Takip'].join('  ·  ');
  x.fillStyle = eski ? '#FBBF24' : '#F9FAFB'; x.font = `600 ${Math.round(bant * 0.5)}px system-ui, sans-serif`; x.textBaseline = 'middle';
  x.fillText(metin, Math.round(bant * 0.35), h + bant / 2, w - bant * 0.7);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: simdi.getTime() });
}
