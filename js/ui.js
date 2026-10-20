import { S } from './db.js';

// ---------- Sabit listeler ----------
export const DURUMLAR = [
  { k: 'Proje', c: '#64748B' }, { k: 'İhale', c: '#2563EB' }, { k: 'Teklif Verildi', c: '#7C3AED' },
  { k: 'Sıcak', c: '#EA580C' }, { k: 'Beklemede', c: '#A1A1AA' }, { k: 'Sipariş', c: '#15803D' },
  { k: 'Kayıp', c: '#B91C1C' }, { k: 'İptal', c: '#52525B' },
];
export const durumRenk = d => (DURUMLAR.find(x => x.k === d) || DURUMLAR[0]).c;
export const ACIK = ['Proje', 'İhale', 'Teklif Verildi', 'Sıcak', 'Beklemede'];
export const ILLER = ['Adana', 'Mersin', 'Hatay', 'Osmaniye'];
export const IL_MERKEZ = { Adana: [37.0, 35.3213, 10], Mersin: [36.75, 34.3, 9], Hatay: [36.45, 36.2, 9], Osmaniye: [37.15, 36.25, 10] };
export const ILCELER = {
  Adana: ['Seyhan', 'Yüreğir', 'Çukurova', 'Sarıçam', 'Ceyhan', 'Kozan', 'Karataş', 'Yumurtalık', 'İmamoğlu', 'Pozantı', 'Karaisalı', 'Aladağ', 'Feke', 'Saimbeyli', 'Tufanbeyli'],
  Mersin: ['Akdeniz', 'Yenişehir', 'Mezitli', 'Toroslar', 'Tarsus', 'Erdemli', 'Silifke', 'Mut', 'Anamur', 'Gülnar', 'Bozyazı', 'Aydıncık', 'Çamlıyayla'],
  Hatay: ['Antakya', 'Defne', 'İskenderun', 'Arsuz', 'Dörtyol', 'Erzin', 'Payas', 'Belen', 'Kırıkhan', 'Reyhanlı', 'Samandağ', 'Hassa', 'Altınözü', 'Yayladağı', 'Kumlu'],
  Osmaniye: ['Merkez', 'Kadirli', 'Düziçi', 'Bahçe', 'Toprakkale', 'Sumbas', 'Hasanbeyli'],
};
export const OSBLER = {
  Adana: ['Adana Hacı Sabancı OSB (AOSB)', 'Ceyhan OSB', 'Yumurtalık Serbest Bölge', 'Karataş OSB (kurulacak)', 'Adanorm Sanayi Sitesi'],
  Mersin: ['Tarsus Karma OSB', 'Mersin-Tarsus OSB', 'Tarsus TUİ OSB', 'Mersin 3. OSB', 'Silifke OSB', 'Mersin Serbest Bölge', 'Mersin Limanı', 'Çukurova Havalimanı (ÇHL)'],
  Hatay: ['Erzin OSB', 'İskenderun OSB', 'Antakya OSB', 'Antakya Serbest Bölge', 'İskenderun Serbest Bölge', 'İskenderun Limanı'],
  Osmaniye: ['Osmaniye OSB', 'Kadirli OSB'],
};
export const FIRMA_TIPLERI = ['Emüt', 'Gemüt', 'Proje Bürosu', 'Danışman', 'Bayi', 'Yatırımcı', 'Malzeme Alıcısı', 'Panocu', 'Müşteri', 'Kamu'];
export const RAKIPLER = ['Ledvance', 'Philips', 'Pelsan', 'İkizler', 'Proton', 'Cemdağ', 'Alkan', 'Pedaş', 'Niki', 'Lamptime', 'Yavuz', 'Gecem', 'Seva', 'Korg', 'Nade', 'Gersan', 'Üç-El', 'EEC'];
export const KAYIP_NEDENLERI = ['Fiyat', 'Şartname dışı kaldık', 'Müşteri ilişkisi', 'Teslim süresi', 'Ödeme koşulu', 'Teknik yetersizlik', 'Proje iptal', 'Bayi tercihi', 'Diğer'];
export const URUN_AILELERI = ['HBL', 'RVX', 'REVOLED X', 'TRD', 'BLM', 'DWL', 'STL', 'EXT', 'YPL', 'PRK', 'VLR', 'ALB', 'REV', 'SROUND', 'ETANJ', 'INFINOO', '60x60', 'DOWNLED', 'PROLIT', 'RA-HORUS-OSIRIS', 'FLP', 'BB'];
export const SEKTORLER = ['Endüstriyel', 'Gıda', 'Metal / Demir Çelik', 'Kimya', 'Enerji', 'Lojistik / Depo', 'Konut', 'Ofis', 'AVM / Ticari', 'Hastane', 'Okul', 'Kamu', 'Otopark / Çevre', 'Tekstil', 'Kağıt / Ambalaj', 'Havalimanı / Altyapı', 'Diğer'];
export const ZIYARET_DURUM = [{ k: 'Planlandı', c: '#7C3AED' }, { k: 'Yapıldı', c: '#0E7490' }, { k: 'İptal', c: '#A1A1AA' }];
export const SONUC_TIPLERI = ['Sipariş alındı', 'Pazarlık sürüyor', 'Olumlu', 'Teklif istendi', 'Takip edilecek', 'Bilgi alındı', 'Olumsuz', 'Görüşülemedi'];
export const BOLGE_TIPLERI = ['OSB', 'Sanayi sitesi', 'Serbest bölge', 'Liman', 'Küçük sanayi', 'Diğer'];
export const BOLGE_RENKLERI = ['#2563EB', '#EA580C', '#15803D', '#7C3AED', '#B91C1C', '#0E7490', '#A16207', '#DB2777'];
export const ZIYARET_AMAC = ['Sipariş', 'Pazarlık', 'Teklif', 'Fiyat görüşmesi', 'Proje takibi', 'Keşif', 'Ürün sunumu', 'Numune / Demo', 'Tanışma', 'Genel ziyaret', 'Toplantı', 'Teknik destek', 'Şikayet / servis', 'Tahsilat', 'Şantiye'];

// ---------- Biçimlendirme ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const usd = n => n == null || n === '' || isNaN(n) ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' $';
export const num = n => n == null || n === '' ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);
export const tarih = d => d ? new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const today = () => new Date().toISOString().slice(0, 10);
export const trLower = s => String(s ?? '').replace(/I/g, 'ı').replace(/İ/g, 'i').toLocaleLowerCase('tr');
export const fold = s => trLower(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
export const match = (q, ...fields) => { const f = fold(q).trim(); if (!f) return true; const hay = fold(fields.filter(Boolean).join(' ')); return f.split(/\s+/).every(w => hay.includes(w)); };
export const byId = (t, id) => id ? S[t].find(x => x.id === id) : null;
export const firmaAd = id => byId('firmalar', id)?.ad || '';

export function pill(d) { return `<span class="pill" style="--c:${durumRenk(d)}">${esc(d)}</span>`; }

// ---------- Toast ----------
let tt;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show ' + kind;
  clearTimeout(tt); tt = setTimeout(() => el.className = '', kind === 'err' ? 6000 : 2800);
}

// ---------- Çekmece (detay / form paneli) ----------
const drawer = () => document.getElementById('drawer');
let onCloseCb = null;
export function openDrawer(html, { wide = false, onClose } = {}) {
  const d = drawer(); const p = d.querySelector('.drawer-panel');
  p.innerHTML = html; p.classList.toggle('wide', wide);
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
  onCloseCb = onClose || null;
  p.scrollTop = 0;
  setTimeout(() => p.querySelector('[autofocus]')?.focus(), 50);
  return p;
}
export function closeDrawer() {
  const d = drawer(); if (!d.classList.contains('open')) return;
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
  const cb = onCloseCb; onCloseCb = null; cb && cb();
}
export const drawerPanel = () => drawer().querySelector('.drawer-panel');
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

export function confirmBox(msg) { return window.confirm(msg); }

// ---------- Dosya seçici ----------
export function pickFiles({ accept = 'image/*', multiple = true, capture = false } = {}) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.multiple = multiple;
    if (capture) i.setAttribute('capture', 'environment');
    i.onchange = () => res([...i.files]); i.click();
  });
}

// ---------- Konum ----------
export function myLocation() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Bu cihaz konum vermiyor.'));
    navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude]),
      e => rej(new Error(e.code === 1 ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin ver.' : 'Konum alınamadı.')),
      { enableHighAccuracy: true, timeout: 12000 });
  });
}
export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

// ---------- İndirme ----------
export function download(name, content, type = 'application/json') {
  const b = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function exportXlsx(name, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [sn, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sn.slice(0, 31));
  XLSX.writeFile(wb, name);
}
