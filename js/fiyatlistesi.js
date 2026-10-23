// Üretici fiyat listesi güncelleme: yeni liste Excel'i yüklenince açık teklifler (Taslak, Gönderildi) yeni fiyatlarla karşılaştırılır.
// Teklif başına eski / yeni toplam ve fark; istenirse teklif tek dokunuşla yeni fiyatlara çekilir (kalem iskontoları korunur).
// Stok listesindeki birim fiyatlar da istenirse güncellenir. Liste bu cihazda son yükleme olarak hatırlanır.
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, toast, openDrawer, closeDrawer, pickFiles, fold, byId, confirmBox, exportXlsx, today } from './ui.js';
import { ayarYaz, ayar } from './ayar.js';
import { hesapla } from './views/teklif.js';

const ACIK_TEKLIF = ['Taslak', 'Gönderildi'];
const kodN = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const acN = s => fold(String(s ?? '')).replace(/[^a-z0-9]/g, '');
const para = (v, pb = 'USD') => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' ' + ({ USD: '$', EUR: '€', TRY: '₺' }[pb] || pb);
const sayi = v => typeof v === 'number' ? v : v == null ? NaN : parseFloat(String(v).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

// Dosyayı oku → { liste: Map(kodN → {kod, ac, fiyat, pb}), acMap, adet }
async function listeOku(file) {
  await (await import('./ui.js')).xlsxYukle();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  let rows = [];
  for (const ad of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[ad], { header: 1, raw: true, defval: null }); if (r.length > rows.length) rows = r; }
  const hi = Math.max(0, rows.findIndex(r => r.some(c => /fiyat|price/i.test(String(c || ''))) && r.some(c => /kod|code|açıklama|aciklama|ürün|urun/i.test(String(c || '')))));
  const h = (rows[hi] || []).map(c => fold(c || ''));
  const col = (...re) => h.findIndex(x => re.some(r => r.test(x)));
  const { sutunlariEsle } = await import('./esle.js');
  const M = await sutunlariEsle('fiyat_listesi', 'Fiyat listesi', (rows[hi] || []).map(x => String(x ?? '')), rows.slice(hi + 1, hi + 4), [
    { k: 'kod', l: 'Ürün kodu' }, { k: 'ac', l: 'Ürün adı / açıklama' }, { k: 'fiyat', l: 'Liste fiyatı', zorunlu: true }, { k: 'pb', l: 'Para birimi' }],
    { kod: col(/kod/, /code/, /malzeme/), ac: col(/aciklama/, /urun ad/, /tanim/, /description/), fiyat: col(/liste fiyat/, /birim fiyat/, /fiyat/, /price/), pb: col(/para birim/, /doviz/, /currency/) });
  if (!M) return null;
  if (!(M.kod >= 0) && !(M.ac >= 0)) throw new Error('Ürün kodu ya da açıklama sütunlarından en az biri seçilmeli.');
  const liste = new Map(), acMap = new Map();
  for (const r of rows.slice(hi + 1)) {
    const fiyat = sayi(r[M.fiyat]); if (!(fiyat > 0)) continue;
    const kod = M.kod >= 0 ? String(r[M.kod] ?? '').trim() : '', ac = M.ac >= 0 ? String(r[M.ac] ?? '').trim() : '';
    if (!kod && !ac) continue;
    const pb = M.pb >= 0 && r[M.pb] ? (/TL|TRY|₺/i.test(r[M.pb]) ? 'TRY' : /EUR|€/i.test(r[M.pb]) ? 'EUR' : 'USD') : 'USD';
    const o = { kod, ac, fiyat, pb };
    if (kod) liste.set(kodN(kod), o);
    if (ac && acN(ac).length >= 6) acMap.set(acN(ac), o);
  }
  return { liste, acMap, adet: Math.max(liste.size, acMap.size) };
}
const bul = (L, kod, ac) => (kod && L.liste.get(kodN(kod))) || (ac && L.acMap.get(acN(ac))) || null;

// Açık tekliflerin karşılaştırması
export function karsilastir(L) {
  const sonuc = [];
  for (const t of S.teklifler.filter(t => ACIK_TEKLIF.includes(t.durum || 'Taslak'))) {
    const pb = t.para_birimi || 'USD';
    const kalemler = (t.kalemler || []).map(k => {
      const y = bul(L, k.kod, k.ad || k.aciklama);
      if (!y) return { k, durum: 'yok' };
      if (y.pb !== pb) return { k, y, durum: 'pb' };
      const fark = (+y.fiyat || 0) - (+k.birim_fiyat || 0);
      return { k, y, durum: Math.abs(fark) < 0.005 ? 'ayni' : 'degisti', fark };
    });
    const degisen = kalemler.filter(x => x.durum === 'degisti');
    if (!degisen.length && !kalemler.some(x => x.durum === 'yok')) { if (kalemler.length) sonuc.push({ t, pb, kalemler, eski: hesapla(t).net, yeni: hesapla(t).net, degisen: 0 }); continue; }
    const yeniT = { ...t, kalemler: kalemler.map(x => x.durum === 'degisti' ? { ...x.k, birim_fiyat: x.y.fiyat } : x.k) };
    sonuc.push({ t, pb, kalemler, eski: hesapla(t).net, yeni: hesapla(yeniT).net, degisen: degisen.length, yeniKalemler: yeniT.kalemler });
  }
  return sonuc.sort((a, b) => Math.abs(b.yeni - b.eski) - Math.abs(a.yeni - a.eski));
}
// Stoktaki ürünlerin fiyat farkları (yalnızca USD liste fiyatı)
const stokFarklari = L => S.urunler.map(u => { const y = bul(L, u.kod, u.aciklama); return y && y.pb === 'USD' && Math.abs((+u.birim_fiyat_usd || 0) - y.fiyat) >= 0.005 ? { u, y } : null; }).filter(Boolean);

export async function fiyatListesiYukle() {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  let L;
  try { toast('Fiyat listesi okunuyor…'); L = await listeOku(file); } catch (e) { return toast('Okunamadı: ' + e.message, 'err'); }
  if (!L) return toast('Yükleme iptal edildi.');
  if (!L.adet) return toast('Dosyada fiyatlı ürün satırı bulunamadı.', 'err');
  await ayarYaz('fiyat_listesi_son', { ad: file.name, tarih: today(), adet: L.adet });
  fiyatPaneli(L, file.name);
}

function fiyatPaneli(L, dosya) {
  const R = karsilastir(L), sf = stokFarklari(L);
  const degisenT = R.filter(r => r.degisen), topEski = degisenT.reduce((a, r) => a + r.eski, 0), topYeni = degisenT.reduce((a, r) => a + r.yeni, 0);
  const eslesmeyen = R.reduce((a, r) => a + r.kalemler.filter(x => x.durum === 'yok').length, 0), pbFarkli = R.reduce((a, r) => a + r.kalemler.filter(x => x.durum === 'pb').length, 0);
  const yuzde = topEski ? (topYeni - topEski) / topEski * 100 : 0;
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(dosya)} · ${L.adet} ürün</p><h2 id="drawer-title">Yeni fiyat listesi</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">
      <div class="fl-ozet"><span><b>${R.length}</b> açık teklif</span><span><b>${degisenT.length}</b> teklifte fiyat değişiyor</span>${degisenT.length ? `<span>Toplam: ${para(topEski)} → <b>${para(topYeni)}</b> (${yuzde >= 0 ? '+' : ''}%${num(Math.round(yuzde * 10) / 10)})</span>` : ''}</div>
      ${eslesmeyen || pbFarkli ? `<p class="hint">${eslesmeyen ? `${eslesmeyen} kalem listede bulunamadı (kodu ya da adı farklı). ` : ''}${pbFarkli ? `${pbFarkli} kalemin teklifi listeden farklı para biriminde; karşılaştırılmadı.` : ''}</p>` : ''}
      ${degisenT.length ? `<div class="tbl-wrap"><table class="tbl fl-tbl"><thead><tr><th>Teklif</th><th class="r">Şu an</th><th class="r">Yeni fiyatla</th><th class="r">Fark</th><th></th></tr></thead><tbody>
        ${degisenT.map((r, i) => { const f = r.yeni - r.eski; return `<tr><td><b>${esc(r.t.teklif_no || 'Teklif')}</b><br><small class="muted">${esc(byId('projeler', r.t.proje_id)?.ad || byId('firmalar', r.t.firma_id)?.ad || '')} · ${esc(r.t.durum || 'Taslak')} · ${r.degisen} kalem</small></td><td class="r num">${para(r.eski, r.pb)}</td><td class="r num">${para(r.yeni, r.pb)}</td><td class="r num ${f > 0 ? 'artti' : 'azaldi'}">${f > 0 ? '+' : ''}${para(f, r.pb)}</td><td><button type="button" class="btn sm" data-gun="${i}" data-gerek="yaz:teklifler">Güncelle</button></td></tr>
          <tr class="fl-kalem"><td colspan="5"><details><summary>Kalemler</summary><ul class="list">${r.kalemler.filter(x => x.durum === 'degisti').map(x => `<li><span class="grow">${esc(x.k.ad || x.k.kod || '')}<small class="muted"> · ${esc(x.k.kod || '')} · ${num(x.k.adet)} adet</small></span><span class="num">${num(x.k.birim_fiyat)} → <b>${num(x.y.fiyat)}</b></span></li>`).join('')}</ul></details></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="btnrow"><button type="button" class="btn primary" data-hepsi data-gerek="yaz:teklifler">Tüm teklifleri yeni fiyatlara çek</button><button type="button" class="btn ghost" data-xls>Excel'e aktar</button></div>
      <p class="hint">Güncellenen teklifte yalnızca birim fiyatlar değişir; adet, kalem iskontosu ve genel iskonto korunur. Gönderilmiş teklifi güncellediysen müşteriye yeni halini göndermeyi unutma.</p>`
      : `<p>${R.length ? 'Açık tekliflerdeki fiyatlar yeni listeyle aynı.' : 'Açık (Taslak ya da Gönderildi) teklif yok.'}</p>`}
      ${sf.length ? `<h3>Stok listesi</h3><p>${sf.length} ürünün stok listesindeki fiyatı yeni listeden farklı.</p><button type="button" class="btn" data-stok data-gerek="yaz:urunler">Stok fiyatlarını yeni listeye göre güncelle</button>` : ''}
    </div>`, { wide: true });
  const guncelle = async r => { const t = { ...r.t, kalemler: r.yeniKalemler }; t.toplam = Math.round(hesapla(t).net * 100) / 100; t.notlar = [r.t.notlar, `${today()}: fiyatlar yeni listeye göre güncellendi`].filter(Boolean).join('\n'); await app.db.save('teklifler', t); };
  p.querySelectorAll('[data-gun]').forEach(b => b.onclick = async () => { try { await guncelle(degisenT[+b.dataset.gun]); b.replaceWith(Object.assign(document.createElement('span'), { className: 'pos', textContent: '✓ güncellendi' })); } catch (e) { toast('Güncellenemedi: ' + e.message, 'err'); } });
  p.querySelector('[data-hepsi]')?.addEventListener('click', async () => {
    if (!confirmBox(`${degisenT.length} teklifin birim fiyatları yeni listeye çekilsin mi?`)) return;
    try { for (const r of degisenT) await guncelle(r); toast(`${degisenT.length} teklif güncellendi.`); closeDrawer(); app.refresh?.(); } catch (e) { toast('Güncellenemedi: ' + e.message, 'err'); }
  });
  p.querySelector('[data-stok]')?.addEventListener('click', async () => {
    try { for (const { u, y } of sf) await app.db.save('urunler', { ...u, birim_fiyat_usd: y.fiyat }); toast(`${sf.length} ürünün fiyatı güncellendi.`); p.querySelector('[data-stok]').remove(); } catch (e) { toast('Güncellenemedi: ' + e.message, 'err'); }
  });
  p.querySelector('[data-xls]')?.addEventListener('click', () => exportXlsx(`fiyat-farki-${today()}.xlsx`, { 'Fiyat farkı': degisenT.flatMap(r => r.kalemler.filter(x => x.durum === 'degisti').map(x => ({ 'Teklif': r.t.teklif_no, 'Proje': byId('projeler', r.t.proje_id)?.ad || '', 'Kod': x.k.kod || '', 'Ürün': x.k.ad || '', 'Adet': +x.k.adet || 0, 'Eski fiyat': +x.k.birim_fiyat || 0, 'Yeni fiyat': x.y.fiyat, 'Fark': x.fark, 'Para birimi': r.pb }))) }));
}
export const sonFiyatListesi = () => ayar('fiyat_listesi_son');
