// Tam dışa aktarma (ZIP) ve başka sunucuya taşıma: tüm tablolar (JSON + CSV), tüm fotoğraf ve belgeler, veritabanı şeması.
import { S, TABLES } from './db.js';
import { app } from './state.js';
import { download, today, toast } from './ui.js';
import { zipYaz } from './zip.js';

const DOSYA_ALANLARI = [['projeler', 'fotolar'], ['firmalar', 'fotolar'], ['ziyaretler', 'fotolar'], ['servis_kayitlari', 'fotolar'], ['urun_aileleri', 'fotolar'], ['kisiler', 'kartvizit_on'], ['kisiler', 'kartvizit_arka'], ['masraflar', 'fis'], ['belgeler', 'yol']];
const yerel = y => y && typeof y === 'string' && !/^https?:/.test(y);
export function tumYollar() {
  const s = new Set();
  for (const [t, a] of DOSYA_ALANLARI) for (const r of S[t] || []) { const v = r[a]; (Array.isArray(v) ? v : [v]).forEach(y => yerel(y) && s.add(y)); }
  return [...s];
}
const csvHucre = v => { if (v === null || v === undefined) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function csvYaz(t) {
  const alanlar = ['id', ...TABLES[t].filter(k => k !== 'id'), 'created_at', 'updated_at'];
  return '﻿' + [alanlar.join(','), ...(S[t] || []).map(r => alanlar.map(k => csvHucre(r[k])).join(','))].join('\r\n');
}
const OKUBENI = `SAHA TAKİP — TAM YEDEK
=====================
Bu ZIP dosyasında bütün verilerin var:
  veri.json        Tüm kayıtlar (uygulamaya geri yüklemek için)
  csv/*.csv        Her tablo ayrı CSV (Excel, Google E-Tablolar ya da başka bir veritabanına aktarmak için; UTF-8, virgülle ayrılmış)
  dosyalar/...     Eklediğin bütün fotoğraflar, kartvizitler, fişler ve belgeler (asıl dosyalar)
  schema.sql       Veritabanı tabloları ve güvenlik kuralları (PostgreSQL / Supabase)

BAŞKA BİR SUPABASE HESABINA TAŞIMA
1. Yeni Supabase projesi aç → SQL Editor → schema.sql dosyasının tamamını yapıştır → Run.
2. Saha Takip → Ayarlar → Genel → Bağlantı bilgilerine yeni projenin adresini ve anon anahtarını gir, hesap oluşturup giriş yap.
3. Ayarlar → Veri ve yedek → "Tam yedekten geri yükle" → bu ZIP dosyasını seç. Kayıtlar ve bütün dosyalar yeni hesaba yüklenir.

BAŞKA BİR SUNUCUYA / VERİTABANINA TAŞIMA
- schema.sql standart PostgreSQL'dir; Supabase'e özgü kısımlar (auth, storage, yetki kuralları) dışında her PostgreSQL sunucusunda çalışır.
- csv klasöründeki dosyalar aynı adlı tablolara doğrudan aktarılabilir (ör. PostgreSQL: \\copy projeler FROM 'projeler.csv' CSV HEADER).
- Fotoğraf ve belge yolları kayıtlarda "dosyalar/" klasöründeki dosya adlarıyla aynıdır.
`;

export async function tamYedekIndir(ilerleme = () => {}) {
  const dosyalar = [];
  const veri = { version: 2, tarih: new Date().toISOString(), uygulama: 'Saha Takip', ...Object.fromEntries(Object.keys(TABLES).map(t => [t, S[t]])) };
  dosyalar.push(['OKUBENI.txt', OKUBENI], ['veri.json', JSON.stringify(veri, null, 1)]);
  for (const t of Object.keys(TABLES)) dosyalar.push([`csv/${t}.csv`, csvYaz(t)]);
  try { const r = await fetch('supabase/schema.sql'); if (r.ok) dosyalar.push(['schema.sql', await r.text()]); } catch {}
  const yollar = tumYollar(); let eksik = 0;
  for (let i = 0; i < yollar.length; i++) {
    ilerleme(`Dosyalar ekleniyor ${i + 1}/${yollar.length}`, (i + 1) / yollar.length);
    try { const u = await app.db.url(yollar[i]); const r = await fetch(u); if (!r.ok) throw 0; dosyalar.push(['dosyalar/' + yollar[i], new Uint8Array(await r.arrayBuffer())]); }
    catch { eksik++; }
  }
  const zip = zipYaz(dosyalar);
  const ad = `saha-takip-tam-yedek-${today()}.zip`;
  download(ad, zip);
  return { kayit: Object.keys(TABLES).reduce((a, t) => a + S[t].length, 0), dosya: yollar.length - eksik, eksik, boyut: zip.size };
}

// ---------- ZIP okuma (sıkıştırmasız ya da deflate) ----------
export async function zipOku(buf) {
  const d = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let e = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (d.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ZIP dosyası okunamadı.');
  const n = d.getUint16(e + 10, true); let p = d.getUint32(e + 16, true); const out = new Map();
  for (let k = 0; k < n; k++) {
    const yontem = d.getUint16(p + 10, true), csize = d.getUint32(p + 20, true), nl = d.getUint16(p + 28, true), xl = d.getUint16(p + 30, true), cl = d.getUint16(p + 32, true), lofs = d.getUint32(p + 42, true);
    const ad = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    const lnl = d.getUint16(lofs + 26, true), lxl = d.getUint16(lofs + 28, true), bas = lofs + 30 + lnl + lxl;
    const ham = u8.subarray(bas, bas + csize);
    out.set(ad, async () => yontem === 0 ? ham : new Uint8Array(await new Response(new Blob([ham]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
    p += 46 + nl + xl + cl;
  }
  return out;
}
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', json: 'application/json', csv: 'text/csv', kml: 'application/vnd.google-earth.kml+xml' };
// ZIP'teki veri.json ve dosyaları okur, dosyaları bu hesaba yükler, kayıtlardaki yolları yenileriyle değiştirir
export async function tamYedekHazirla(file, ilerleme = () => {}) {
  const z = await zipOku(await file.arrayBuffer());
  if (!z.has('veri.json')) throw new Error('Bu dosya Saha Takip tam yedeği değil (veri.json yok).');
  const d = JSON.parse(new TextDecoder().decode(await z.get('veri.json')()));
  const esle = new Map(); const ds = [...z.keys()].filter(k => k.startsWith('dosyalar/') && !k.endsWith('/')); let hata = 0;
  for (let i = 0; i < ds.length; i++) {
    ilerleme(`Dosyalar yükleniyor ${i + 1}/${ds.length}`, (i + 1) / ds.length);
    const eski = ds[i].slice('dosyalar/'.length), ext = (eski.split('.').pop() || '').toLowerCase();
    try { const b = await z.get(ds[i])(); const yeni = await app.db.uploadFile(new File([b], eski.split('/').pop(), { type: MIME[ext] || 'application/octet-stream' })); esle.set(eski, yeni); }
    catch { hata++; }
  }
  const cevir = y => (y && esle.get(y)) || y;
  for (const [t, a] of DOSYA_ALANLARI) for (const r of d[t] || []) r[a] = Array.isArray(r[a]) ? r[a].map(cevir) : cevir(r[a]);
  return { d, dosya: esle.size, hata };
}
