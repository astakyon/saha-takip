// Veri paketi (.json): CRM, SAP ve plan dosyalarından hazırlanmış toplu veriyi tek seferde içe aktarır.
// Paketteki kayıtlar birbirine geçici anahtarla bağlıdır (_k, firma_k, yatirimci_k…). İçe aktarırken her kayıt
// mevcut verideki karşılığıyla eşleştirilir; eşleşen kayıtta yalnızca boş alanlar dolar, hiçbir kayıt silinmez.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { toast, pickFiles, fold } from './ui.js';

const DUR = ['Proje', 'İhale', 'Teklif Verildi', 'Sıcak', 'Beklemede', 'Sipariş', 'Kayıp', 'İptal'];
const STOP = new Set('a s as anonim sirket sirketi sirketleri ltd limited sti san sanayi sanayii ve tic ticaret ith ihr ithalat ihracat ic dis paz pazarlama ltdsti tas'.split(' '));
// Firma anahtarı: Türkçe harfsiz, şirket türü ekleri atılmış, boşluksuz ("Drv Elektrik … San.ve Tic.Ltd.Şti." → "drvelektrik…")
export const firmaAnahtar = s => fold(String(s || '')).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
  .map(x => x.replace(/^(\w{4,})ve$/, '$1')).filter(x => x && !STOP.has(x)).join('');
// Aynı firma mı: anahtarlar eşit ya da kısa olan (en az 10 harf) uzun olanın başı (kesilmiş SAP adları için)
export const anahtarEsles = (a, b) => { if (!a || !b) return false; if (a === b) return true; const [k, u] = a.length <= b.length ? [a, b] : [b, a]; return k.length >= 10 && u.startsWith(k); };
const projeAnahtar = s => fold(String(s || '')).replace(/[^a-z0-9]/g, '');
const bos = v => v == null || v === '' || (Array.isArray(v) && !v.length);

// Paketi mevcut veriyle eşleştirip yazılacak kayıtları hazırlar (yazmaz). Testte de kullanılır.
export function paketHazirla(P) {
  if (!P || P.tur !== 'saha-takip-paket') throw new Error('Bu dosya bir Saha Takip veri paketi değil.');
  const sayi = { firmaYeni: 0, firmaGun: 0, kisiYeni: 0, kisiGun: 0, projeYeni: 0, projeGun: 0, sipYeni: 0, sipAyni: 0, ziyYeni: 0, ziyAtla: 0, hedefYeni: 0 };
  const yaz = { firmalar: new Map(), kisiler: [], projeler: new Map(), siparisler: [], ziyaretler: [], hedefler: [], proje_gecmis: [] };
  // --- Firmalar
  const mevcut = (S.firmalar || []).map(f => ({ f, a: firmaAnahtar(f.ad) }));
  const fId = new Map();   // paket anahtarı → firma id
  for (const p of P.firmalar || []) {
    const a = firmaAnahtar(p.ad);
    const eski = (p.cari_kodu && (S.firmalar || []).find(f => f.cari_kodu && String(f.cari_kodu) === String(p.cari_kodu))) || mevcut.find(x => anahtarEsles(x.a, a))?.f;
    const { _k, not_ekle, ...alan } = p;
    if (alan.segment && !/^[ABC]$/.test(alan.segment)) delete alan.segment;
    if (eski) {
      const o = { ...(yaz.firmalar.get(eski.id) || eski) }; let deg = false;
      for (const [k, v] of Object.entries(alan)) {
        if (k === 'ad' || bos(v)) continue;
        if (k === 'tipler') { const t = [...new Set([...(o.tipler || []), ...v])]; if (t.length !== (o.tipler || []).length) { o.tipler = t; deg = true; } }
        else if (k === 'key_account') { if (v && !o.key_account) { o.key_account = true; deg = true; } }
        else if (bos(o[k])) { o[k] = v; deg = true; }
      }
      for (const n of not_ekle || []) if (!(o.notlar || '').includes(n)) { o.notlar = [o.notlar, n].filter(Boolean).join('\n'); deg = true; }
      fId.set(_k, eski.id);
      if (deg) { if (!yaz.firmalar.has(eski.id)) sayi.firmaGun++; yaz.firmalar.set(eski.id, o); }
    } else {
      const id = uuid(); fId.set(_k, id); sayi.firmaYeni++;
      const o = { id, ...alan, tipler: alan.tipler || [], fotolar: [], notlar: (not_ekle || []).join('\n') || null, kaynak: 'Veri paketinden aktarıldı' };
      yaz.firmalar.set(id, o); mevcut.push({ f: o, a });
    }
  }
  // --- Kişiler
  for (const p of P.kisiler || []) {
    const firma_id = fId.get(p.firma_k) || null;
    const eski = (S.kisiler || []).find(k => (p.eposta && k.eposta && fold(k.eposta) === fold(p.eposta)) || (fold(k.ad_soyad) === fold(p.ad_soyad) && (k.firma_id || null) === firma_id));
    const { firma_k, ...alan } = p;
    if (eski) {
      const o = { ...eski }; let deg = false;
      for (const [k, v] of Object.entries({ ...alan, firma_id })) if (!bos(v) && bos(o[k])) { o[k] = v; deg = true; }
      if (deg) { yaz.kisiler.push(o); sayi.kisiGun++; }
    } else { yaz.kisiler.push({ id: uuid(), ...alan, firma_id }); sayi.kisiYeni++; }
  }
  // --- Projeler
  const pId = new Map();
  const ROL = ['yatirimci', 'projeci', 'gemut', 'emut', 'alici', 'bayi'];
  for (const p of P.projeler || []) {
    const { _k, not_ekle, ...alan } = p;
    for (const r of ROL) if (alan[r + '_k']) { alan[r + '_id'] = fId.get(alan[r + '_k']) || null; delete alan[r + '_k']; }
    if (!DUR.includes(alan.durum)) alan.durum = 'Proje';
    const eski = (alan.crm_kodu && (S.projeler || []).find(x => x.crm_kodu && x.crm_kodu === alan.crm_kodu)) || (S.projeler || []).find(x => projeAnahtar(x.ad) === projeAnahtar(alan.ad));
    if (eski) {
      const o = { ...eski }; let deg = false;
      for (const [k, v] of Object.entries(alan)) {
        if (k === 'ad' || k === 'durum' || bos(v)) continue;
        if ((k === 'hedef_listesi' || k === 'kritik') && v && !o[k]) { o[k] = true; deg = true; }
        else if (bos(o[k])) { o[k] = v; deg = true; }
      }
      // Aşama yalnızca kayıt hâlâ başlangıçtaysa ("Proje") ya da paket siparişe dönüştüğünü söylüyorsa ilerler
      if (alan.durum !== o.durum && (o.durum === 'Proje' || (alan.durum === 'Sipariş' && !['Sipariş', 'İptal'].includes(o.durum)))) {
        yaz.proje_gecmis.push({ id: uuid(), proje_id: o.id, tarih: new Date().toISOString().slice(0, 10), eski_durum: o.durum, yeni_durum: alan.durum, notlar: 'Veri paketinden' }); o.durum = alan.durum; deg = true;
      }
      for (const n of not_ekle || []) if (!(o.notlar || '').includes(n)) { o.notlar = [o.notlar, n].filter(Boolean).join('\n'); deg = true; }
      pId.set(_k, o.id); if (deg) { sayi.projeGun++; yaz.projeler.set(o.id, o); }
    } else {
      const id = uuid(); pId.set(_k, id); sayi.projeYeni++;
      yaz.projeler.set(id, { id, ...alan, urun_gruplari: [], fotolar: [], notlar: (not_ekle || []).join('\n') || null, kaynak: 'Veri paketinden aktarıldı' });
    }
  }
  // --- Siparişler (SAP): satış belgesi + sipariş no ile tekil
  const varSip = new Set((S.siparisler || []).map(s => s.belge_no + '|' + s.siparis_no));
  const no = v => String(v ?? '').trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
  for (const p of P.siparisler || []) {
    // Aynı belge + no ya da aynı sipariş no'lu, belgesi boş/aynı kayıt varsa eklenmez (kopya oluşmasın)
    if (varSip.has(p.belge_no + '|' + p.siparis_no) || (no(p.siparis_no) && (S.siparisler || []).some(s => no(s.siparis_no) === no(p.siparis_no) && (!s.belge_no || !p.belge_no || String(s.belge_no) === String(p.belge_no))))) { sayi.sipAyni++; continue; }
    const { firma_k, ...alan } = p; varSip.add(p.belge_no + '|' + p.siparis_no);
    yaz.siparisler.push({ id: uuid(), ...alan, firma_id: fId.get(firma_k) || null }); sayi.sipYeni++;
  }
  // --- Geçmiş ziyaretler: firmada o tarihte ya da sonrasında ziyaret varsa eklenmez
  for (const p of P.ziyaretler || []) {
    const firma_id = fId.get(p.firma_k); if (!firma_id) continue;
    if ((S.ziyaretler || []).some(z => z.firma_id === firma_id && z.tarih >= p.tarih && z.durum !== 'Planlandı' && z.durum !== 'İptal')) { sayi.ziyAtla++; continue; }
    const { firma_k, ...alan } = p; yaz.ziyaretler.push({ id: uuid(), ...alan, firma_id, planli: false, fotolar: [] }); sayi.ziyYeni++;
  }
  // --- Hedefler: yalnızca o çeyrek boşsa
  for (const h of P.hedefler || []) if (!(S.hedefler || []).some(x => +x.yil === +h.yil && +x.ceyrek === +h.ceyrek)) { yaz.hedefler.push({ id: uuid(), ...h }); sayi.hedefYeni++; }
  return { sayi, yaz };
}

// Hazırlanan kayıtları yazar; siparişleri yeni projelere adından bağlar
export async function paketYaz({ yaz }, ilerle = () => {}) {
  const sira = [['firmalar', [...yaz.firmalar.values()]], ['kisiler', yaz.kisiler], ['projeler', [...yaz.projeler.values()]], ['proje_gecmis', yaz.proje_gecmis]];
  for (const [t, l] of sira) if (l.length) { ilerle(t); await app.db.bulk(t, l); }
  if (yaz.siparisler.length) {
    ilerle('siparisler');
    const { projeBul } = await import('./views/panel.js');
    const { anaBayiMi } = await import('./profil.js');
    await app.db.bulk('siparisler', yaz.siparisler.map(s => ({ ...s, proje_id: s.proje_id || projeBul(s.proje_tanimi)?.id || null, drv: anaBayiMi(s.musteri_adi) })));
  }
  if (yaz.ziyaretler.length) { ilerle('ziyaretler'); await app.db.bulk('ziyaretler', yaz.ziyaretler); }
  if (yaz.hedefler.length) { ilerle('hedefler'); await app.db.bulk('hedefler', yaz.hedefler); }
}

export async function paketYukle(sonra) {
  const [file] = await pickFiles({ accept: '.json,application/json', multiple: false }); if (!file) return;
  try {
    const P = JSON.parse(await file.text());
    const h = paketHazirla(P), s = h.sayi;
    const { onizleOnay } = await import('./esle.js');
    const { ok } = await onizleOnay({ baslik: `Veri paketi: ${file.name}`,
      sayilar: [['yeni firma', s.firmaYeni, 'yeni'], ['bilgisi tamamlanacak firma', s.firmaGun, 'gun'], ['yeni kişi', s.kisiYeni, 'yeni'], ['yeni proje', s.projeYeni, 'yeni'], ['güncellenecek proje', s.projeGun, 'gun'],
        ['yeni sipariş', s.sipYeni, 'yeni'], ['zaten kayıtlı sipariş', s.sipAyni], ['geçmiş ziyaret (son ziyaret tarihi)', s.ziyYeni, 'yeni'], ...(s.hedefYeni ? [['çeyrek hedefi', s.hedefYeni, 'yeni']] : [])],
      ornekBaslik: ['Kayıt', 'Tür', 'Bilgi'],
      ornek: [...[...h.yaz.firmalar.values()].slice(0, 3).map(f => [f.ad, 'Firma', [f.il, (f.tipler || []).join(', ')].filter(Boolean).join(' · ')]), ...[...h.yaz.projeler.values()].slice(0, 3).map(p => [p.ad, 'Proje', [p.durum, p.il].filter(Boolean).join(' · ')])] });
    if (!ok) return toast('İçe aktarma iptal edildi.');
    toast('Yükleniyor…');
    await paketYaz(h, t => toast(`Yükleniyor: ${t}…`));
    toast(`Veri paketi aktarıldı: ${s.firmaYeni} firma, ${s.projeYeni} proje, ${s.sipYeni} sipariş eklendi.`);
    sonra?.();
  } catch (e) { console.error(e); toast('Paket yüklenemedi: ' + (e.message || e), 'err'); }
}
