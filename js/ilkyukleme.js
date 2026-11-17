// Faz 1: ilk yükleme. (1) Elindeki Excel'den firmalar, kişiler ve projeler (sütun eşleştirme, önizleme, eşleşen kayıt
// güncellenir); boş şablon indirilebilir. (2) Örnek verilerle deneme: kurgusal firmalar ve projeler eklenir, tek
// düğmeyle silinir (eklenen kayıtların kimlikleri ayarlarda "ornek_veri" olarak tutulur).
import { S, uuid, adBol, adBirlestir } from './db.js';
import { vergiKontrol, vergiSahibi } from './cari.js';
import { app } from './state.js';
import { esc, toast, confirmBox, pickFiles, fold, today, gunEkle, DURUMLAR, FIRMA_TIPLERI, pozisyonTahmin } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

const norm = s => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
// Başlık bulma: önce tam eşleşme, sonra bütün kelime, sonra kelime başı (ör. "Notlar" ~ "not"); "il" "Takip yılı"na eşleşmesin
const bul = (h, kul, ...adlar) => {
  const H = h.map((x, i) => ({ i, n: norm(x), k: norm(x).split(' ') })).filter(x => x.n && !kul.has(x.i));
  for (const a of adlar) { const x = H.find(x => x.n === a); if (x) return x.i; }
  for (const a of adlar) { const x = H.find(x => (' ' + x.n + ' ').includes(' ' + a + ' ')); if (x) return x.i; }
  for (const a of adlar.filter(a => a.length >= 3 && !a.includes(' '))) { const x = H.find(x => x.k.some(k => k.startsWith(a))); if (x) return x.i; }
  return -1;
};
const metin = v => v == null ? null : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim() || null);
const sayi = v => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const t = String(v).replace(/[^\d,.-]/g, ''); const n = parseFloat(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')); return isNaN(n) ? null : n; };
const tarih = v => v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : typeof v === 'string' && /^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(v.trim()) ? v.trim().split(/[./]/).reverse().map(x => x.padStart(2, '0')).join('-') : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
const tipler = v => { const l = String(v || '').split(/[,;/]+/).map(x => x.trim()).filter(Boolean); return l.map(x => FIRMA_TIPLERI.find(t => norm(t) === norm(x)) || x); };
const durumBul = v => { if (!v) return null; const n = norm(v); return DURUMLAR.find(d => norm(d.k) === n)?.k || (/kazan|siparis|alindi/.test(n) ? 'Sipariş' : /kayb|kayip|kaybed/.test(n) ? 'Kayıp' : /teklif/.test(n) ? 'Teklif Verildi' : /ihale/.test(n) ? 'İhale' : /sicak/.test(n) ? 'Sıcak' : /bekle/.test(n) ? 'Beklemede' : /iptal/.test(n) ? 'İptal' : 'Proje'); };

// Basit CSV okuyucu: ayraç (; , sekme) ilk satırdan seçilir, tırnaklı alanlar ve satır içi virgül desteklenir
export function csvOku(metin) {
  metin = metin.replace(/^\uFEFF/, '');
  const ilk = metin.split(/\r?\n/)[0] || '', ay = [';', '\t', ','].sort((a, b) => ilk.split(b).length - ilk.split(a).length)[0];
  const satirlar = []; let satir = [], alan = '', tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) { if (c === '"') { if (metin[i + 1] === '"') { alan += '"'; i++; } else tirnak = false; } else alan += c; continue; }
    if (c === '"') tirnak = true;
    else if (c === ay) { satir.push(alan); alan = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && metin[i + 1] === '\n') i++; satir.push(alan); satirlar.push(satir); satir = []; alan = ''; }
    else alan += c;
  }
  if (alan || satir.length) { satir.push(alan); satirlar.push(satir); }
  return satirlar.map(r => r.map(x => x.trim() === '' ? null : x.trim()));
}

export const TURLER = {
  firmalar: { ad: 'Firmalar', alanlar: [
    { k: 'ad', l: 'Firma adı', zorunlu: true, s: ['firma adi', 'firma', 'unvan', 'musteri adi', 'cari adi', 'ad'] }, { k: 'tipler', l: 'Firma tipi (Emüt, Bayi…)', s: ['firma tipi', 'tip', 'tur', 'kategori'] },
    { k: 'telefon', l: 'Telefon', s: ['telefon', 'tel', 'gsm'] }, { k: 'eposta', l: 'E-posta', s: ['e posta', 'eposta', 'email', 'mail'] },
    { k: 'il', l: 'İl', s: ['il', 'sehir'] }, { k: 'ilce', l: 'İlçe', s: ['ilce'] }, { k: 'adres', l: 'Adres', s: ['adres'] },
    { k: 'web', l: 'Web sitesi', s: ['web', 'internet sitesi', 'site'] }, { k: 'vergi_no', l: 'Vergi no', s: ['vergi no', 'vkn', 'vergi'] }, { k: 'segment', l: 'Segment (A/B/C)', s: ['segment'] }, { k: 'notlar', l: 'Notlar', s: ['not', 'aciklama'] },
  ], ornek: [['Yıldız Elektrik (örnek)', 'Emüt', '0322 000 00 00', 'info@ornek.com', 'Adana', 'Seyhan', 'Örnek Mah. 1. Sok.', '', '', 'A', '']] },
  kisiler: { ad: 'Kişiler', alanlar: [
    { k: 'ad_soyad', l: 'Ad soyad (tek sütun)', s: ['ad soyad', 'adi soyadi', 'isim', 'kisi', 'yetkili'] }, { k: 'ad', l: 'Ad (ayrı sütunsa)', s: ['ad', 'adi'] }, { k: 'soyad', l: 'Soyad (ayrı sütunsa)', s: ['soyad', 'soyadi'] },
    { k: 'firma', l: 'Firma adı', s: ['firma adi', 'firma', 'sirket', 'kurum'] }, { k: 'unvan', l: 'Unvan / görev', s: ['unvan', 'gorev', 'pozisyon'] },
    { k: 'telefon', l: 'Cep telefonu', s: ['cep', 'telefon', 'tel', 'gsm'] }, { k: 'eposta', l: 'E-posta', s: ['e posta', 'eposta', 'email', 'mail'] }, { k: 'notlar', l: 'Notlar', s: ['not', 'aciklama'] },
  ], ornek: [['Ali Yılmaz (örnek)', '', '', 'Yıldız Elektrik (örnek)', 'Satınalma Müdürü', '0532 000 00 00', 'ali@ornek.com', '']] },
  projeler: { ad: 'Projeler', alanlar: [
    { k: 'ad', l: 'Proje adı', zorunlu: true, s: ['proje adi', 'proje', 'is adi'] }, { k: 'durum', l: 'Aşama / durum', s: ['durum', 'asama', 'statu'] },
    { k: 'tutar_usd', l: 'Tahmini tutar (USD)', s: ['tutar usd', 'tutar', 'tahmini tutar', 'bedel', 'proje bedeli'] }, { k: 'il', l: 'İl', s: ['il', 'sehir'] }, { k: 'ilce', l: 'İlçe', s: ['ilce'] },
    { k: 'emut', l: 'Emüt (elektrik müteahhidi)', s: ['emut', 'elektrik muteahhidi', 'elektrik yuklenicisi'] }, { k: 'gemut', l: 'Gemüt (genel müteahhit)', s: ['gemut', 'genel muteahhit', 'yuklenici', 'muteahhit'] },
    { k: 'yatirimci', l: 'Yatırımcı / işveren', s: ['yatirimci', 'isveren', 'mal sahibi'] }, { k: 'projeci', l: 'Projeyi çizen firma', s: ['projeci', 'proje burosu', 'tasarim'] }, { k: 'bayi', l: 'Bayi (ya da satış kanalı)', s: ['bayi', 'kanal', 'distributor'] },
    { k: 'beklenen_tarih', l: 'Beklenen sipariş tarihi', s: ['beklenen tarih', 'beklenen', 'tahmini tarih'] }, { k: 'notlar', l: 'Notlar', s: ['notlar', 'not', 'aciklama'] },
    { k: 'alici', l: 'Malzeme alıcısı', s: ['alici', 'malzeme alicisi'] }, { k: 'danisman', l: 'Danışman / kontrolör', s: ['danisman', 'kontrolor', 'musavir'] },
    { k: 'osb', l: 'OSB / sanayi bölgesi', s: ['osb', 'sanayi bolgesi'] }, { k: 'lokasyon', l: 'Lokasyon notu', s: ['lokasyon', 'konum notu'] }, { k: 'sektor', l: 'Sektör', s: ['sektor'] },
    { k: 'olasilik', l: 'Olasılık %', s: ['olasilik'] }, { k: 'takip_yili', l: 'Takip yılı', s: ['takip yili', 'yil'] }, { k: 'takipci', l: 'Takip eden', s: ['takip eden', 'takipci'] },
    { k: 'teklif_no', l: 'Teklif no', s: ['teklif no'] }, { k: 'santiye_asamasi', l: 'Şantiye aşaması', s: ['santiye asamasi', 'santiye'] },
    { k: 'siparis_tutari_usd', l: 'Sipariş tutarı (USD)', s: ['siparis tutari usd', 'siparis tutari'] }, { k: 'kayip_nedeni', l: 'Kayıp nedeni', s: ['kayip nedeni'] }, { k: 'rakip_marka', l: 'İşi alan marka', s: ['isi alan marka', 'rakip marka'] },
    { k: 'lat', l: 'Enlem', s: ['enlem', 'lat', 'latitude'] }, { k: 'lng', l: 'Boylam', s: ['boylam', 'lng', 'lon', 'longitude'] },
  ], ornek: [['Spor Salonu (örnek)', 'Teklif Verildi', 250000, 'Mersin', 'Tarsus', 'Yıldız Elektrik (örnek)', '', 'Belediye (örnek)', '', '', '2027-03-01', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']] },
};

export async function sablonIndir(tur) {
  const T = TURLER[tur]; await (await import('./ui.js')).xlsxYukle();
  const ws = XLSX.utils.aoa_to_sheet([T.alanlar.map(a => a.l.replace(/ \(.*\)$/, '')), ...T.ornek]);
  ws['!cols'] = T.alanlar.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, T.ad);
  XLSX.writeFile(wb, `saha-takip-${tur}-sablon.xlsx`);
}

// Excel / CSV'den firmalar, kişiler ya da projeler
export async function excelIlkYukle(tur, sonra) {
  const T = TURLER[tur]; if (!T) return;
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    let rows;
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') rows = csvOku(await file.text());   // CSV: kütüphane indirmeden
    else {
      await (await import('./ui.js')).xlsxYukle();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    }
    const hi = rows.findIndex(r => r.filter(c => c != null && String(c).trim()).length >= 2);
    if (hi < 0) return toast('Dosyada başlık satırı bulunamadı.', 'err');
    const h = rows[hi].map(c => String(c ?? '').trim());
    const oto = {}; const kul = new Set();
    for (const a of T.alanlar) { const i = bul(h, kul, ...a.s); oto[a.k] = i; if (i >= 0) kul.add(i); }
    const { sutunlariEsle, onizleOnay } = await import('./esle.js');
    const C = await sutunlariEsle('ilk_' + tur, `${T.ad} listesi`, h, rows.slice(hi + 1, hi + 4), T.alanlar.map(({ k, l, zorunlu }) => ({ k, l, zorunlu })), oto);
    if (!C) return toast('Yükleme iptal edildi.');
    const v = (r, k) => C[k] >= 0 ? r[C[k]] : null;
    const veri = rows.slice(hi + 1).filter(r => r.some(c => c != null && String(c).trim()));
    // Firma adından kayıt: yoksa yeni firma (aynı dosyada tekrar edenler bir kez)
    const yeniFirmalar = new Map();
    const firmaId = (ad, tip) => { const a = metin(ad); if (!a) return null; const n = norm(a); const f = S.firmalar.find(x => norm(x.ad) === n); if (f) return f.id; if (!yeniFirmalar.has(n)) yeniFirmalar.set(n, { id: uuid(), ad: a, tipler: tip ? [tip] : [], fotolar: [] }); return yeniFirmalar.get(n).id; };
    const out = []; let guncel = 0, ayni = 0, atla = 0, hv = 0, ke = 0;
    const birlestir = (eski, yeni) => { const o = { ...eski }; let deg = false; for (const [k, x] of Object.entries(yeni)) if (x != null && x !== '' && !(Array.isArray(x) && !x.length) && (eski[k] == null || eski[k] === '' || (Array.isArray(eski[k]) && !eski[k].length))) { o[k] = x; deg = true; } return deg ? o : null; };
    for (const r of veri) {
      let kayit, eski;
      if (tur === 'firmalar') {
        const ad = metin(v(r, 'ad')); if (!ad) { atla++; continue; }
        kayit = { ad, tipler: tipler(v(r, 'tipler')), telefon: metin(v(r, 'telefon')), eposta: metin(v(r, 'eposta')), il: metin(v(r, 'il')), ilce: metin(v(r, 'ilce')), adres: metin(v(r, 'adres')), web: metin(v(r, 'web')), vergi_no: metin(v(r, 'vergi_no')), segment: /^[ABC]$/i.test(metin(v(r, 'segment')) || '') ? metin(v(r, 'segment')).toUpperCase() : null, notlar: metin(v(r, 'notlar')) };
        eski = S.firmalar.find(x => norm(x.ad) === norm(ad)) || out.find(x => norm(x.ad) === norm(ad));
        if (kayit.vergi_no) { const k = vergiKontrol(kayit.vergi_no), sh = k.ok && k.temiz ? vergiSahibi(k.temiz, eski?.id) || out.find(x => x !== eski && x.vergi_no === k.temiz) : null; if (!k.ok || sh) { hv++; kayit.vergi_no = null; } else kayit.vergi_no = k.temiz; }
        if (!eski && !kayit.il && !kayit.adres) ke++;
      } else if (tur === 'kisiler') {
        let ad = metin(v(r, 'ad')), soyad = metin(v(r, 'soyad')); const tam = metin(v(r, 'ad_soyad'));
        if (tam && !ad) ({ ad, soyad } = adBol(tam));
        if (!ad) { atla++; continue; }
        const unvan = metin(v(r, 'unvan'));
        kayit = { ad, soyad: soyad || '', ad_soyad: adBirlestir(ad, soyad || ''), firma_id: firmaId(v(r, 'firma')), unvan, pozisyon: unvan ? pozisyonTahmin(unvan) : null, telefon: metin(v(r, 'telefon')), eposta: metin(v(r, 'eposta')), notlar: metin(v(r, 'notlar')) };
        const tel = String(kayit.telefon || '').replace(/\D/g, '').slice(-10);
        eski = S.kisiler.find(x => (tel.length >= 10 && String(x.telefon || '').replace(/\D/g, '').slice(-10) === tel) || (norm(x.ad_soyad) === norm(kayit.ad_soyad) && (x.firma_id || null) === kayit.firma_id));
      } else {
        const ad = metin(v(r, 'ad')); if (!ad) { atla++; continue; }
        kayit = { ad, durum: durumBul(metin(v(r, 'durum'))) || 'Proje', tutar_usd: sayi(v(r, 'tutar_usd')), il: metin(v(r, 'il')), ilce: metin(v(r, 'ilce')), emut_id: firmaId(v(r, 'emut'), 'Emüt'), gemut_id: firmaId(v(r, 'gemut'), 'Gemüt'), yatirimci_id: firmaId(v(r, 'yatirimci'), 'Yatırımcı'), projeci_id: firmaId(v(r, 'projeci'), 'Proje Bürosu'), alici_id: firmaId(v(r, 'alici'), 'Malzeme Alıcısı'), danisman_id: firmaId(v(r, 'danisman'), 'Danışman'),
          bayi_id: /^direkt$/i.test(metin(v(r, 'bayi')) || '') ? null : firmaId(v(r, 'bayi'), 'Bayi'), kanal: /^direkt$/i.test(metin(v(r, 'bayi')) || '') ? 'Direkt' : metin(v(r, 'bayi')) ? 'Bayi' : null,
          beklenen_tarih: tarih(v(r, 'beklenen_tarih')), notlar: metin(v(r, 'notlar')), takip_yili: parseInt(metin(v(r, 'takip_yili')) || '') || new Date().getFullYear(),
          osb: metin(v(r, 'osb')), lokasyon: metin(v(r, 'lokasyon')), sektor: metin(v(r, 'sektor')), olasilik: sayi(v(r, 'olasilik')), takipci: metin(v(r, 'takipci')), teklif_no: metin(v(r, 'teklif_no')), santiye_asamasi: metin(v(r, 'santiye_asamasi')),
          siparis_tutari_usd: sayi(v(r, 'siparis_tutari_usd')), kayip_nedeni: metin(v(r, 'kayip_nedeni')), rakip_marka: metin(v(r, 'rakip_marka')), lat: sayi(v(r, 'lat')), lng: sayi(v(r, 'lng')) };
        if (kayit.lat != null && (kayit.lat < -90 || kayit.lat > 90 || kayit.lng == null)) { kayit.lat = null; kayit.lng = null; }
        eski = S.projeler.find(x => norm(x.ad) === norm(ad)) || out.find(x => norm(x.ad) === norm(ad));
      }
      if (eski) { const b = birlestir(eski, kayit); if (b) { const i = out.indexOf(eski); if (i >= 0) out[i] = b; else { out.push(b); guncel++; } } else ayni++; }
      else out.push({ id: uuid(), ...kayit, ...(tur === 'firmalar' ? { fotolar: [] } : {}) });
    }
    const yeni = out.length - guncel;
    const { ok } = await onizleOnay({ baslik: `${T.ad}: ${file.name}`, sayilar: [['yeni kayıt', yeni, 'yeni'], ...(hv ? [['hatalı ya da başka firmada kayıtlı vergi no (boş bırakılır)', hv, 'uyari']] : []), ...(ke ? [['konumu (il / adres) eksik yeni firma', ke, 'uyari']] : []), ['boş alanları doldurulacak', guncel, 'gun'], ['değişmeyecek', ayni], ...(yeniFirmalar.size ? [['yeni firma da eklenecek', yeniFirmalar.size, 'yeni']] : []), ...(atla ? [['adı boş, atlanacak', atla]] : [])],
      ornekBaslik: tur === 'kisiler' ? ['Ad soyad', 'Firma', 'Telefon'] : tur === 'firmalar' ? ['Firma', 'Tip', 'İl'] : ['Proje', 'Aşama', 'İl'],
      ornek: out.slice(0, 5).map(x => tur === 'kisiler' ? [x.ad_soyad, S.firmalar.find(f => f.id === x.firma_id)?.ad || [...yeniFirmalar.values()].find(f => f.id === x.firma_id)?.ad || '', x.telefon || ''] : tur === 'firmalar' ? [x.ad, (x.tipler || []).join(', '), x.il || ''] : [x.ad, x.durum, x.il || '']) });
    if (!ok) return;
    if (!out.length && !yeniFirmalar.size) return toast('Eklenecek ya da güncellenecek kayıt yok.');
    toast('Yükleniyor…');
    if (yeniFirmalar.size) await app.db.bulk('firmalar', [...yeniFirmalar.values()]);
    if (out.length) await app.db.bulk(tur, out);
    toast(`${T.ad}: ${yeni} yeni, ${guncel} güncellendi${yeniFirmalar.size ? `, ${yeniFirmalar.size} yeni firma` : ''}.`);
    sonra?.();
  } catch (e) { console.error(e); toast('Yüklenemedi: ' + (e.message || e), 'err'); }
}

// ---------- Örnek verilerle dene ----------
export const ornekVarMi = () => { const o = ayar('ornek_veri'); return !!(o && Object.values(o).some(l => l?.length)); };
export async function ornekYukle(sonra) {
  if (ornekVarMi()) return toast('Örnek veriler zaten yüklü.');
  const id = () => uuid(), t = today();
  const F = [['Yıldız Elektrik (örnek)', 'Emüt', 'Adana', 'Seyhan', 'A'], ['Kuzey İnşaat (örnek)', 'Gemüt', 'Mersin', 'Yenişehir', 'B'], ['Atlas Proje Bürosu (örnek)', 'Proje Bürosu', 'Adana', 'Çukurova', 'A'], ['Güney Bayi (örnek)', 'Bayi', 'Hatay', 'Antakya', 'B'], ['Örnek Belediyesi', 'Kamu', 'Osmaniye', 'Merkez', 'C'], ['Liman Lojistik (örnek)', 'Yatırımcı', 'Mersin', 'Akdeniz', 'B']]
    .map(([ad, tip, il, ilce, segment]) => ({ id: id(), ad, tipler: [tip], il, ilce, segment, fotolar: [], notlar: 'Örnek veri: Ayarlar → Veri ve yedek → Örnek verileri sil ile kaldırılır.' }));
  const f = ad => F.find(x => x.ad.startsWith(ad)).id;
  const K = [['Ali', 'Örnek', 'Yıldız', 'Firma Sahibi', 'Karar verici'], ['Ayşe', 'Deneme', 'Yıldız', 'Satınalma Müdürü', 'Satınalma'], ['Mehmet', 'Örnek', 'Kuzey', 'Şantiye Şefi', 'Saha'], ['Zeynep', 'Deneme', 'Atlas', 'Elektrik Mühendisi', 'Teknik'], ['Can', 'Örnek', 'Güney', 'Satış', 'Etkileyici'], ['Elif', 'Deneme', 'Liman', 'Genel Müdür', 'Karar verici']]
    .map(([ad, soyad, firma, unvan, rol]) => ({ id: id(), ad, soyad, ad_soyad: ad + ' ' + soyad, firma_id: f(firma), unvan, pozisyon: pozisyonTahmin(unvan), rol }));
  const k = ad => K.find(x => x.ad === ad).id;
  const P = [['Lojistik Deposu Aydınlatması (örnek)', 'Teklif Verildi', 180000, 'Mersin', 'Liman', 'Yıldız', 'Atlas', 'Elif'], ['Spor Salonu (örnek)', 'İhale', 95000, 'Osmaniye', 'Örnek Belediyesi', 'Kuzey', 'Atlas', 'Zeynep'], ['Hastane Ek Bina (örnek)', 'Sıcak', 320000, 'Adana', 'Liman', 'Yıldız', 'Atlas', 'Ali'], ['Okul Yenileme (örnek)', 'Proje', 40000, 'Hatay', 'Örnek Belediyesi', 'Kuzey', null, 'Mehmet'], ['Fabrika Genişleme (örnek)', 'Sipariş', 210000, 'Adana', 'Liman', 'Yıldız', 'Atlas', 'Ayşe'], ['Otopark Aydınlatması (örnek)', 'Kayıp', 60000, 'Mersin', 'Örnek Belediyesi', 'Kuzey', null, 'Mehmet']]
    .map(([ad, durum, tutar, il, yat, emut, projeci, kisi]) => ({ id: id(), ad, durum, tutar_usd: tutar, il, yatirimci_id: f(yat), emut_id: f(emut), projeci_id: projeci ? f(projeci) : null, bayi_id: f('Güney'), kanal: 'Bayi', ilgili_kisi_id: k(kisi), takip_yili: new Date().getFullYear(), beklenen_tarih: gunEkle(t, 60), ...(durum === 'Kayıp' ? { kayip_nedeni: 'Fiyat', rakip_marka: 'Rakip marka (örnek)' } : {}), ...(durum === 'Sipariş' ? { siparis_tutari_usd: tutar, siparis_tarihi: gunEkle(t, -10) } : {}) }));
  const Z = [[-14, 'Yıldız', 'Ali', 'Tanışma', 'Yapıldı'], [-3, 'Atlas', 'Zeynep', 'Proje takibi', 'Yapıldı'], [2, 'Kuzey', 'Mehmet', 'Şantiye', 'Planlandı'], [5, 'Liman', 'Elif', 'Teklif', 'Planlandı']]
    .map(([g, firma, kisi, amac, durum]) => ({ id: id(), tarih: gunEkle(t, g), firma_id: f(firma), kisi_id: k(kisi), amac, durum, notlar: 'Örnek ziyaret', fotolar: [] }));
  const G = [['Lojistik deposu teklifini takip et (örnek)', 3], ['Hastane için numune gönder (örnek)', 7]].map(([baslik, g]) => ({ id: id(), baslik, son_tarih: gunEkle(t, g), durum: 'Açık', oncelik: 'Normal' }));
  try {
    toast('Örnek veriler ekleniyor…');
    for (const [tb, l] of [['firmalar', F], ['kisiler', K], ['projeler', P], ['ziyaretler', Z], ['gorevler', G]]) await app.db.bulk(tb, l.map(x => ({ kaynak: null, ...x })));
    await ayarYaz('ornek_veri', { firmalar: F.map(x => x.id), kisiler: K.map(x => x.id), projeler: P.map(x => x.id), ziyaretler: Z.map(x => x.id), gorevler: G.map(x => x.id) });
    toast('Örnek veriler eklendi: 6 firma, 6 kişi, 6 proje, 4 ziyaret, 2 görev. Kendi verine geçince Ayarlar → Veri ve yedek → Örnek verileri sil.');
    sonra?.();
  } catch (e) { toast('Eklenemedi: ' + (e.message || e), 'err'); }
}
export async function ornekSil(sonra) {
  const o = ayar('ornek_veri'); if (!o) return;
  const n = Object.values(o).reduce((a, l) => a + (l?.length || 0), 0);
  if (!confirmBox(`Örnek veriler (${n} kayıt) silinsin mi? Kendi eklediğin kayıtlara dokunulmaz.`)) return;
  try {
    for (const tb of ['gorevler', 'ziyaretler', 'projeler', 'kisiler', 'firmalar']) for (const i of o[tb] || []) if (S[tb].some(x => x.id === i)) await app.db.del(tb, i);
    await ayarYaz('ornek_veri', null); toast('Örnek veriler silindi.'); sonra?.();
  } catch (e) { toast('Silinemedi: ' + (e.message || e), 'err'); }
}

// Boş hesapta Bugün ekranının başındaki "Başla" kartı ve Ayarlar → Veri'deki kart için ortak içerik
export function baslaKarti({ baslik = 'Başlamak için' } = {}) {
  return `<section class="card basla-k"><h2>${esc(baslik)}</h2>
    <p class="hint">Elindeki listeleri Excel'den yükle ya da önce örnek verilerle uygulamayı dene.</p>
    <div class="basla-ad"><b>1. Excel'den yükle</b><small class="muted">Sütunları tanır, sorar ve hatırlar. Aynı ada sahip kayıt varsa yalnızca boş alanları doldurur.</small>
      <div class="btnrow">${Object.entries(TURLER).map(([k, T]) => `<button type="button" class="btn sm" data-ilkyukle="${k}" data-gerek="yaz:${k}">${T.ad}</button>`).join('')}</div>
      <small class="muted">Boş şablon: ${Object.entries(TURLER).map(([k, T]) => `<button type="button" class="linkbtn" data-sablon="${k}">${T.ad.toLocaleLowerCase('tr')}</button>`).join(' · ')}</small></div>
    <div class="basla-ad"><b>2. Örnek verilerle dene</b><small class="muted">Kurgusal 6 firma, 6 kişi, 6 proje, ziyaret ve görev eklenir; tek düğmeyle silinir.</small>
      <div class="btnrow">${ornekVarMi() ? '<button type="button" class="btn sm ghost danger" data-ornek="sil">Örnek verileri sil</button>' : '<button type="button" class="btn sm" data-ornek="yukle" data-gerek="yaz:projeler">Örnek verileri yükle</button>'}</div></div>
  </section>`;
}
export function baslaBagla(kok, sonra) {
  kok.querySelectorAll('[data-ilkyukle]').forEach(b => b.onclick = () => excelIlkYukle(b.dataset.ilkyukle, sonra));
  kok.querySelectorAll('[data-sablon]').forEach(b => b.onclick = () => sablonIndir(b.dataset.sablon));
  kok.querySelectorAll('[data-ornek]').forEach(b => b.onclick = () => b.dataset.ornek === 'sil' ? ornekSil(sonra) : ornekYukle(sonra));
}
