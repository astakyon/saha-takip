import { S } from './db.js';
import { disaAktarabilir, gizliBolum, gerekUygula } from './yetki.js';

// ---------- Sabit listeler ----------
export const DURUMLAR = [
  { k: 'Proje', c: '#64748B' }, { k: 'İhale', c: '#2563EB' }, { k: 'Teklif Verildi', c: '#7C3AED' },
  { k: 'Sıcak', c: '#EA580C' }, { k: 'Beklemede', c: '#A1A1AA' }, { k: 'Sipariş', c: '#15803D' },
  { k: 'Kayıp', c: '#B91C1C' }, { k: 'İptal', c: '#52525B' },
];
export const durumRenk = d => (DURUMLAR.find(x => x.k === d) || DURUMLAR[0]).c;
export const ACIK = ['Proje', 'İhale', 'Teklif Verildi', 'Sıcak', 'Beklemede'];
export const ILLER = ['Adana', 'Mersin', 'Hatay', 'Osmaniye'];   // firma profilindeki bölgeye göre profil.js değiştirir
export const BOLGE_KUTU = { s: 35.8, w: 32.5, n: 38.05, e: 36.75 };
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
// Kazanma olasılığı girilmemiş projelerde aşamaya göre varsayılan (%)
export const OLASILIK = { 'Proje': 10, 'İhale': 25, 'Teklif Verildi': 40, 'Sıcak': 70, 'Beklemede': 15, 'Sipariş': 100, 'Kayıp': 0, 'İptal': 0 };
export const olasilik = p => p.olasilik !== null && p.olasilik !== undefined && p.olasilik !== '' ? +p.olasilik : (OLASILIK[p.durum] ?? 10);
export const SANTIYE = ['Proje aşamasında', 'Temel / kaba inşaat', 'İnce işler', 'Elektrik tesisatı', 'Tamamlanmak üzere', 'Tamamlandı'];
export const SERVIS_TIP = ['Arıza', 'Garanti', 'İade', 'Şikayet', 'Montaj desteği', 'Diğer'];
export const MASRAF_TIP = ['Yakıt', 'Yemek', 'Otopark', 'Konaklama', 'Köprü / otoyol', 'Ulaşım', 'Diğer'];
// WhatsApp bağlantısı (Türkiye numarası 0 ile başlıyorsa 90 eklenir)
export function waLink(tel, metin) {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '90' + n.slice(1); else if (n.length === 10) n = '90' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(metin || '')}`;
}
// Ürün açıklamasından güç (W), ışık akısı (lm) ve renk sıcaklığı (K): "HBL 152U 65OA00 90 23K9 IP65" → 152 W, 23 900 lm, 6500 K
export function urunBilgi(ac) {
  const t = String(ac || '').trim().split(/\s+/);
  const w = /^(\d{2,4})[A-Z]$/.exec(t[1] || ''); const k = /^(\d{2})[A-Z]{2}/.exec(t[2] || '');
  const lmTok = t.slice(2).find(x => /^\d{1,3}K\d{1,2}$/.test(x)); const lm = lmTok && /^(\d+)K(\d{1,2})$/.exec(lmTok);
  const W = w ? +w[1] : null, LM = lm ? Math.round(parseFloat(lm[1] + '.' + lm[2]) * 1000) : null;
  return { w: W, lm: LM, k: k ? +k[1] * 100 : null, verim: W && LM ? Math.round(LM / W) : null };
}
export const ZIYARET_DURUM = [{ k: 'Planlandı', c: '#7C3AED' }, { k: 'Yapıldı', c: '#0E7490' }, { k: 'İptal', c: '#A1A1AA' }];
export const SONUC_TIPLERI = ['Sipariş alındı', 'Pazarlık sürüyor', 'Olumlu', 'Teklif istendi', 'Takip edilecek', 'Bilgi alındı', 'Olumsuz', 'Görüşülemedi'];
export const BOLGE_TIPLERI = ['OSB', 'Sanayi sitesi', 'Serbest bölge', 'Liman', 'Küçük sanayi', 'Diğer'];
export const BOLGE_RENKLERI = ['#2563EB', '#EA580C', '#15803D', '#7C3AED', '#B91C1C', '#0E7490', '#A16207', '#DB2777'];
export const ZIYARET_AMAC = ['Sipariş', 'Pazarlık', 'Teklif', 'Fiyat görüşmesi', 'Proje takibi', 'Keşif', 'Ürün sunumu', 'Numune / Demo', 'Tanışma', 'Genel ziyaret', 'Toplantı', 'Teknik destek', 'Şikayet / servis', 'Tahsilat', 'Şantiye'];

// ---------- Biçimlendirme ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const usd = n => gizliBolum('tutar') ? '•••' : n == null || n === '' || isNaN(n) ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' $';
export const num = n => n == null || n === '' ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);
export const tarih = d => d ? new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const isoLocal = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const today = () => isoLocal(new Date());
export const gunEkle = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
export const trLower = s => String(s ?? '').replace(/I/g, 'ı').replace(/İ/g, 'i').toLocaleLowerCase('tr');
export const fold = s => trLower(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
// Arama: Türkçe karakterden bağımsız (cukurova = Çukurova); 4+ harfli kelimede bir harflik yazım hatasına tolerans
const birHarf = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, f = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++f > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return f + (a.length - i) + (b.length - j) <= 1; };
export const kelimeUyar = (w, hay) => hay.includes(w) || (w.length >= 4 && hay.split(/[^a-z0-9]+/).some(t => t.length >= w.length - 1 && (birHarf(w, t.slice(0, w.length)) || birHarf(w, t.slice(0, w.length + 1)) || birHarf(w, t.slice(0, w.length - 1)))));
export const match = (q, ...fields) => { const f = fold(q).trim(); if (!f) return true; const hay = fold(fields.filter(Boolean).join(' ')); return f.split(/\s+/).every(w => kelimeUyar(w, hay)); };
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
  gerekUygula(p);
  aksiyonlariDuzenle(p);
  // Kaydedilmemiş değişiklik izi: formda yazılınca işaretlenir, kaydedilince temizlenir
  kirli = false;
  p.querySelectorAll('form').forEach(f => {
    const isaretle = e => { if (!e.target.matches('[type=search], [data-ymetin], .liste-ekle input, [data-s]') && !e.target.closest('[data-sartname], [data-oneri], [data-yorumlar], [data-iliski], .y-yaz')) kirli = true; };
    f.addEventListener('input', isaretle); f.addEventListener('change', e => { if (e.isTrusted) isaretle(e); });
    f.addEventListener('submit', () => { kirli = false; }, true);
  });
  // Sekmeler başlığın altında yapışık kalsın
  requestAnimationFrame(() => { const dh = p.querySelector('.dh'), ps = p.querySelector('.p-sekme'); if (dh && ps) ps.style.top = dh.offsetHeight + 'px'; });
  // Telefonun geri tuşu pencereyi kapatsın: pencere için geçmişe bir adım eklenir
  try { if (!geriBekleniyor && !history.state?.cekmece) history.pushState({ cekmece: true }, '', location.href); } catch {}
  setTimeout(() => p.querySelector('[autofocus]')?.focus(), 50);
  return p;
}
let geriBekleniyor = false, geriSonra = null;
let kirli = false;
const birakilsinMi = () => !kirli || window.confirm('Kaydedilmemiş değişiklikler var. Kaydetmeden kapatılsın mı?');
export function closeDrawer(zorla = false) {
  const d = drawer(); if (!d.classList.contains('open')) return;
  if (!zorla && !birakilsinMi()) return;
  kirli = false;
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
  const cb = onCloseCb; onCloseCb = null;
  // Pencerenin geçmiş adımını geri al; adres değişikliği (listeye dönüş) ondan sonra yapılır
  if (history.state?.cekmece) { geriBekleniyor = true; geriSonra = cb; try { history.back(); } catch { geriBekleniyor = false; geriSonra = null; cb && cb(); } }
  else cb && cb();
}
window.addEventListener('popstate', () => {
  if (geriBekleniyor) { geriBekleniyor = false; const c = geriSonra; geriSonra = null; c && c(); if (drawer().classList.contains('open') && !history.state?.cekmece) try { history.pushState({ cekmece: true }, '', location.href); } catch {} return; }
  if (drawer().classList.contains('open')) { if (!birakilsinMi()) { try { history.pushState({ cekmece: true }, '', location.href); } catch {} return; } kirli = false; const d = drawer(); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); const cb = onCloseCb; onCloseCb = null; cb && cb(); }
});
// Pencere başlığındaki düğmeler: ilk üçü görünür, kalanı (ve Sil) “⋯” menüsünde
function aksiyonlariDuzenle(p) {
  const act = p.querySelector('.dh-actions'); if (!act || act.dataset.duzen) return; act.dataset.duzen = '1';
  const hepsi = [...act.children].filter(x => x.matches('.btn, a.btn'));
  const sil = hepsi.filter(x => x.matches('.danger, [data-a="sil"]')), digerleri = hepsi.filter(x => !sil.includes(x));
  const kalan = [...digerleri.slice(3), ...sil]; if (kalan.length < 2) return;
  const kutu = document.createElement('div'); kutu.className = 'vh-daha';
  kutu.innerHTML = '<button type="button" class="btn sm ghost vh-daha-btn" aria-haspopup="menu" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg><span>Diğer</span></button><div class="vh-menu" role="menu" hidden></div>';
  const menu = kutu.querySelector('.vh-menu'), btn = kutu.querySelector('.vh-daha-btn');
  for (const x of kalan) { x.setAttribute('role', 'menuitem'); menu.appendChild(x); }
  act.appendChild(kutu);
  const kapat = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = e => { e.stopPropagation(); if (!menu.hidden) return kapat(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  menu.addEventListener('click', () => setTimeout(kapat, 0));
  p.addEventListener('click', e => { if (!kutu.contains(e.target)) kapat(); });
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
// Excel kütüphanesi (~900 KB) yalnızca Excel'e aktarırken ya da Excel yüklerken indirilir
let xlsxSoz = null;
export function xlsxYukle() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxSoz ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxSoz = null; rej(new Error('Excel aracı indirilemedi. İnternet bağlantını kontrol et.')); }; document.head.appendChild(s); });
}
// Excel çıktısı: sütun genişlikleri ve filtre düğmeleriyle; bir kopyası “Dosyalar → Çıktılar”a kaydedilir
export async function exportXlsx(name, sheets) {
  if (!disaAktarabilir()) return toast('Excel\'e aktarma yetkin yok. Gerekirse veri sahibinden iste.', 'err');
  try { await xlsxYukle(); } catch (e) { return toast(e.message, 'err'); }
  const wb = XLSX.utils.book_new();
  for (const [sn, rows0] of Object.entries(sheets)) {
    // Tarihler Excel'de tarih, tutarlar sayı olarak açılsın (sıralama ve toplam alınabilsin)
    const tarihMi = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v);
    const rows = (rows0.length ? rows0 : [{ 'Kayıt yok': '' }]).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, tarihMi(v) ? new Date(v.length === 10 ? v + 'T00:00:00' : v) : v])));
    const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: 'dd.mm.yyyy' });
    for (const [adr, c] of Object.entries(ws)) { if (adr[0] === '!' || !c) continue; if (c.t === 'd') c.z = 'dd.mm.yyyy'; else if (c.t === 'n' && !/^[A-Z]+1$/.test(adr)) c.z = Number.isInteger(c.v) ? (Math.abs(c.v) >= 10000 ? '#,##0' : '0') : '#,##0.00'; }
    const basliklar = Object.keys(rows.reduce((o, r) => Object.assign(o, r), {}));
    ws['!cols'] = basliklar.map(h => ({ wch: Math.min(60, Math.max(String(h).length + 2, ...rows.slice(0, 300).map(r => r[h] instanceof Date ? 11 : String(r[h] ?? '').length + 1))) }));
    if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws, sn.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31));
  }
  if (!XLSX.write) return XLSX.writeFile(wb, name);
  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  download(name, blob);
  import('./belgeler.js').then(m => m.ciktiKaydet(blob, name, 'Excel', Object.entries(sheets).map(([k, v]) => `${k}: ${v.length} satır`).join(', '))).catch(() => {});
}

// Geri alınabilir bildirim: “Silindi — Geri al” (10 sn). geriAl() çağrılırsa sonuc false olur.
let gaT = null, gaBekleyen = null;
export function geriAlToast(msg, geriAl, bitince) {
  if (gaBekleyen) { const b = gaBekleyen; gaBekleyen = null; b(); }   // önceki bekleyen silmeyi tamamla
  const el = document.getElementById('toast');
  clearTimeout(tt); clearTimeout(gaT);
  el.innerHTML = `<span></span><button type="button" class="toast-geri">Geri al</button>`;
  el.firstChild.textContent = msg; el.className = 'show act';
  const bitir = () => { el.className = ''; gaBekleyen = null; bitince && bitince(); };
  gaBekleyen = bitir;
  el.querySelector('.toast-geri').onclick = async () => { clearTimeout(gaT); gaBekleyen = null; el.className = ''; await geriAl(); toast('Geri alındı.'); };
  gaT = setTimeout(bitir, 10000);
}
// Kaydı sil, 10 sn içinde geri alınabilsin. dosyaYolu verilirse dosya süre dolunca silinir.
export async function silGeriAl(tablo, kayit, ad, yenile, dosyaYolu) {
  const { app } = await import('./state.js');
  await app.db.del(tablo, kayit.id); yenile && yenile();
  geriAlToast(`${ad} silindi.`, async () => { await app.db.save(tablo, kayit); yenile && yenile(); }, dosyaYolu ? () => app.db.removePhoto(dosyaYolu).catch(() => {}) : null);
}

// ---------- Uzun listeler: parça parça çizim ----------
// satirlar: HTML parçaları dizisi. İlk "ilk" kadarı hemen, kalanı kaydırdıkça eklenir.
// sar: dış kalıp (ör. tablo); satırlar içindeki [data-parca] öğesine, yoksa doğrudan kutuya eklenir. sonra: her eklemeden sonra (olay bağlamak için)
export function parcali(kutu, satirlar, { ilk = 60, adim = 80, sar = x => x, sonra } = {}) {
  let n = Math.min(ilk, satirlar.length), gozcu = null, nokta = null;
  kutu.innerHTML = sar(satirlar.slice(0, n).join(''));
  const icerik = kutu.querySelector('[data-parca]');
  const ekle = (k = adim) => {
    if (n >= satirlar.length) return false;
    const yeni = satirlar.slice(n, n + k).join(''); n = Math.min(satirlar.length, n + k);
    if (icerik) icerik.insertAdjacentHTML('beforeend', yeni); else nokta.insertAdjacentHTML('beforebegin', yeni);
    sonra?.(kutu);
    if (n >= satirlar.length) { gozcu?.disconnect(); nokta?.remove(); }
    else requestAnimationFrame(() => { if (nokta?.isConnected && nokta.getBoundingClientRect().top < innerHeight + 800) ekle(); });
    return true;
  };
  if (n < satirlar.length) {
    nokta = document.createElement('div'); nokta.className = 'parca-son'; nokta.setAttribute('aria-hidden', 'true'); kutu.appendChild(nokta);
    if ('IntersectionObserver' in window) { gozcu = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) ekle(); }, { rootMargin: '800px 0px' }); gozcu.observe(nokta); }
    else ekle(satirlar.length);
  }
  sonra?.(kutu);
  kutu.classList.add('parcali-kok');
  kutu._parcali = { ekle, hepsi: () => ekle(satirlar.length), kalan: () => satirlar.length - n };
  return kutu._parcali;
}
// Görüntüler ekrana yaklaşınca yüklenir (kişi avatarları, foto önizlemeleri)
export function gorununce(ogeler, yukle) {
  if (!('IntersectionObserver' in window)) { ogeler.forEach(yukle); return; }
  const g = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { g.unobserve(e.target); yukle(e.target); } }), { rootMargin: '300px 0px' });
  ogeler.forEach(o => { if (!o._izleniyor) { o._izleniyor = true; g.observe(o); } });
}
export const pencereKirli = () => kirli;
