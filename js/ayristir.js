// Konuşarak ziyaret kaydı: söylenen (ya da yazılan) cümleden firma, kişi, proje, sonuç, amaç ve sonraki adımı çıkarır.
// Kurala dayalıdır ve tamamen telefonda çalışır; metin hiçbir servise gönderilmez. Bulamadığı alanı boş bırakır.
import { S } from './db.js';
import { fold, today, gunEkle } from './ui.js';

// Firma ve proje adlarında ayırt edici olmayan kelimeler
const GENEL = new Set(['elektrik', 'elektrık', 'insaat', 'ins', 'ltd', 'sti', 'as', 'a.s', 'san', 'sanayi', 'tic', 'ticaret', 've', 'muhendislik', 'muh', 'proje', 'projesi', 'enerji', 'aydinlatma', 'taahhut', 'yapi', 'grup', 'group', 'limited', 'sirketi', 'anonim', 'ltd.sti', 'otomasyon', 'mimarlik', 'danismanlik', 'ins.', 'tic.', 'san.', 'the', 'co', 'emut', 'gemut']);
const kelimeler = s => fold(s).replace(/[^a-z0-9çğıöşü\s]/g, ' ').split(/\s+/).filter(Boolean);
const ayirt = s => kelimeler(s).filter(k => k.length >= 3 && !GENEL.has(k));
// Metindeki kelime, aranan kelimeyle başlıyor mu (Türkçe ekler: Yıldız'da, Yıldızlara…)
// İki yönlü kök eşleşmesi: "hastane" ↔ "hastanesi", "yıldız" ↔ "yıldız'da"
const kok = (a, b) => { const [k, u] = a.length <= b.length ? [a, b] : [b, a]; return k.length >= 4 && u.startsWith(k) && u.length - k.length <= 5; };
const kelimedeVar = (metinK, k) => metinK.some(m => m === k || kok(m, k));

function enIyi(adaylar, metinK, metinF, ad, esik = 0.5) {
  let en = null;
  for (const x of adaylar) {
    const tam = fold(ad(x) || ''); if (!tam) continue;
    const ks = ayirt(ad(x)); if (!ks.length) continue;
    const eslesen = ks.filter(k => kelimedeVar(metinK, k)).length;
    if (!eslesen) continue;
    let puan = eslesen / ks.length + (metinF.includes(tam) ? 1 : 0) + (eslesen === ks.length ? 0.5 : 0) + eslesen * 0.1;
    if (!en || puan > en.puan) en = { x, puan };
  }
  return en && en.puan >= esik ? en.x : null;
}

const SONUCLAR = [
  ['Sipariş alındı', /siparis (verdi|verdiler|gecti|geçti|aldik|aldım|aldim|alindi|kesinles)|siparisi (aldik|aldim|verdi)|onay verdi/],
  ['Olumsuz', /olumsuz|istemedi|vazgecti|vazgectiler|rakibe verdi|rakip(e)? (verdi|gitti)|kaybettik|is (gitti|kacti)|almayacak/],
  ['Görüşülemedi', /gorusemedim|goruşemedim|gorusulemedi|yoktu|bulamadim|musait degildi|kapaliydi|ulasamadim/],
  ['Teklif istendi', /teklif (istedi|istediler|istiyor|istiyorlar|ister|bekliyor)|fiyat (istedi|istiyor)|teklif hazırla|teklif hazirla|teklif gonder/],
  ['Pazarlık sürüyor', /pazarlik|indirim (istedi|istiyor)|iskonto|fiyat(i)? (yuksek|pahali) buldu|fiyatta anlas/],
  ['Olumlu', /olumlu|begendi|begendiler|ilgilendi|sicak bakti|sicak bakiyor|memnun kaldi|onayladi/],
  ['Bilgi alındı', /bilgi aldim|ogrendim|bilgi verdi|soyledi ki|haber verdi/],
  ['Takip edilecek', /takip|tekrar ara|arayacagim|arayacak|sonra gorus|donus yapacak|haber verecek/],
];
const AMACLAR = [
  ['Numune / Demo', /numune|demo|ornek urun/], ['Ürün sunumu', /sunum|katalog|tanitim/], ['Tahsilat', /tahsilat|odeme|cek aldim|vade/],
  ['Şikayet / servis', /sikayet|ariza|servis|bozuk/], ['Keşif', /kesif|olcu|olcum/], ['Şantiye', /santiye/], ['Pazarlık', /pazarlik|indirim/],
  ['Sipariş', /siparis/], ['Teklif', /teklif|fiyat/], ['Tanışma', /tanistim|tanisma|ilk gorusme/], ['Proje takibi', /proje|ihale/],
];
const GUNLER = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];
const AYLAR = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];

// Metindeki tarih ifadesi → YYYY-AA-GG (bugüne göre). Yoksa null.
export function tarihBul(f, t = today()) {
  const bugun = new Date(t + 'T00:00'), gd = bugun.getDay();
  if (/\bobur gun|\bertesi gun|\byarindan sonra/.test(f)) return gunEkle(t, 2);
  if (/\byarin/.test(f)) return gunEkle(t, 1);
  let m = f.match(/\b(\d{1,2}) gun sonra/); if (m) return gunEkle(t, +m[1]);
  m = f.match(/\b(\d{1,2}|bir|iki|uc) hafta sonra/); if (m) return gunEkle(t, 7 * ({ bir: 1, iki: 2, uc: 3 }[m[1]] || +m[1]));
  m = f.match(new RegExp(`\\b(\\d{1,2})(?:'?\\s*)(${AYLAR.join('|')})`)); if (m) { const a = AYLAR.indexOf(m[2]); let y = bugun.getFullYear(); const d = new Date(y, a, +m[1]); if (d < bugun) d.setFullYear(y + 1); return iso(d); }
  m = f.match(/\bayin (\d{1,2})/); if (m) { const d = new Date(bugun.getFullYear(), bugun.getMonth(), +m[1]); if (d < bugun) d.setMonth(d.getMonth() + 1); return iso(d); }
  if (/\bay sonu/.test(f)) return iso(new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0));
  const haftaya = /\bhaftaya|\bgelecek hafta|\bonumuzdeki hafta/.test(f);
  for (let i = 0; i < 7; i++) {
    if (!new RegExp(`\\b${GUNLER[i]}(ya|ye|a|e|i|u|gunu)?\\b`).test(f)) continue;
    if (haftaya) { const pzt = (8 - gd) % 7 || 7; return gunEkle(t, pzt + (i + 6) % 7); }
    return gunEkle(t, (i - gd + 7) % 7 || 7);
  }
  if (haftaya) return gunEkle(t, 7);
  if (/\bbugun/.test(f)) return t;
  return null;
}
const byIdF = id => id ? (S.firmalar || []).find(x => x.id === id) : null;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ayristir(metin, t = today()) {
  const f = fold(metin || '').replace(/[’']/g, "'"), metinK = kelimeler(metin), sonuc = {};
  // Firma
  const firma = enIyi(S.firmalar || [], metinK, f, x => x.ad);
  if (firma) sonuc.firma_id = firma.id;
  // Kişi: önce firmanın kişileri; ad + Bey/Hanım ya da ad soyad
  const kisiAday = (S.kisiler || []).filter(k => !firma || k.firma_id === firma.id);
  let kisi = null;
  for (const k of kisiAday) {
    const ad = fold(k.ad || (k.ad_soyad || '').split(' ')[0]), soyad = fold(k.soyad || '');
    if (!ad || ad.length < 2) continue;
    const tam = soyad && f.includes(ad + ' ' + soyad), hitap = new RegExp(`\\b${ad} (bey|hanim|hn|bei)`).test(f), sadece = firma && new RegExp(`\\b${ad}(la|le|e|a|i|ı|'|\\b)`).test(f);
    const puan = tam ? 3 : hitap ? 2 : sadece ? 1 : 0;
    if (puan && (!kisi || puan > kisi.puan)) kisi = { k, puan };
  }
  if (kisi && (kisi.puan >= 2 || firma)) { sonuc.kisi_id = kisi.k.id; if (!firma && kisi.k.firma_id) sonuc.firma_id = kisi.k.firma_id; }
  // Proje: firmanın açık projeleri önce
  const fid = sonuc.firma_id, rol = p => [p.emut_id, p.gemut_id, p.alici_id, p.bayi_id, p.projeci_id, p.danisman_id, p.yatirimci_id].includes(fid);
  const projeler = (S.projeler || []).filter(p => !p.aday);
  const proje = (fid && enIyi(projeler.filter(rol), metinK, f, x => x.ad, 0.3)) || enIyi(projeler.filter(p => !['Kayıp', 'İptal'].includes(p.durum)), metinK, f, x => x.ad);
  if (proje) { sonuc.proje_id = proje.id; if (!sonuc.firma_id) sonuc.firma_id = proje.emut_id || proje.alici_id || proje.gemut_id || null; }
  // Sonuç ve amaç
  for (const [ad, re] of SONUCLAR) if (re.test(f)) { sonuc.sonuc_tipi = ad; break; }
  for (const [ad, re] of AMACLAR) if (re.test(f)) { sonuc.amac = ad; break; }
  // Ziyaret tarihi: "dün", "bu sabah" vb.
  sonuc.tarih = /\bdun\b|\bdunku/.test(f) ? gunEkle(t, -1) : t;
  // Sonraki adım: eylem + (varsa) tarih
  const tarih = tarihBul(f.replace(/\bdun(ku)?\b/g, ''), t);
  const fAd = (byIdF(sonuc.firma_id)?.ad || '').replace(/\s+(ltd\.?|şti\.?|a\.?ş\.?|san\.?|tic\.?|ve|taahhüt|limited|şirketi|anonim)(?=\s|$)/gi, '').replace(/\s+/g, ' ').trim(), kAd = kisi && sonuc.kisi_id ? (kisi.k.ad_soyad || '') : '';
  const kim = [fAd, kAd && `(${kAd})`].filter(Boolean).join(' ');
  let gorev = null;
  if (/teklif (gonder|hazirla|ver|yolla|cikar|atacag|atilacak)|teklif(i)? (gonderecegim|hazirlayacagim|verecegim)/.test(f)) gorev = `Teklif gönder: ${kim}`;
  else if (/numune (gotur|birak|gonder|getir|teslim)/.test(f)) gorev = `Numune götür: ${kim}`;
  else if (/\bara(yacagim|yalim|yin|ma)?\b|\barayacag|telefon (et|edecegim|ac)|\bdonus yap/.test(f)) gorev = `Ara: ${kim}`;
  else if (/tekrar (git|ugra|gel|ziyaret)|yeniden (git|ugra)|ugrayacagim|gidecegim|ziyaret edecegim/.test(f)) gorev = `Tekrar ziyaret: ${kim}`;
  else if (/katalog (gonder|ilet|yolla)|mail (at|gonder)|e-?posta (at|gonder)/.test(f)) gorev = `Gönder: ${kim}`;
  else if (sonuc.sonuc_tipi === 'Teklif istendi') gorev = `Teklif gönder: ${kim}`;
  else if (tarih && sonuc.sonuc_tipi === 'Takip edilecek') gorev = `Takip: ${kim}`;
  if (gorev) sonuc.gorev = { baslik: gorev.replace(/:\s*$/, ''), son_tarih: tarih || gunEkle(t, sonuc.sonuc_tipi === 'Teklif istendi' ? 2 : 3), tarihVar: !!tarih };
  else if (tarih) sonuc.gorev = { baslik: `Takip: ${kim}`.replace(/:\s*$/, ''), son_tarih: tarih, tarihVar: true };
  return sonuc;
}
