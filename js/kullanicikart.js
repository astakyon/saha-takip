// Kullanıcı hareketleri ekranları:
//  - Şirket → Hareketler: dönem seçimi, kişi başına etkin süre, etkin gün, giriş, ekran, ekleme / değişiklik / silme, çıktı, son görülme
//  - Kullanıcı kartı: özet, sayılar (önceki döneme göre), gün × saat çalışma haritası, gün gün hareket akışı (süzgeçli), Excel'e aktarma
// Veriler: kullanici_hareketleri (giriş, ekran, çıktı…) + degisiklikler (ekleme, değişiklik, silme). Yönetici herkesinkini, kişi kendininkini görür.
import { app } from './state.js';
import { esc, toast, openDrawer, num, exportXlsx, today } from './ui.js';

const GUN = 864e5;
export const DONEM = [['bugun', 'Bugün'], ['7', '7 gün'], ['30', '30 gün'], ['ay', 'Bu ay'], ['gecenay', 'Geçen ay']];
export function donemAraligi(k) {
  const bugun = new Date(today() + 'T00:00:00'), yarin = new Date(+bugun + GUN);
  if (k === 'bugun') return [bugun, yarin];
  if (k === '7') return [new Date(+yarin - 7 * GUN), yarin];
  if (k === '30') return [new Date(+yarin - 30 * GUN), yarin];
  if (k === 'ay') return [new Date(bugun.getFullYear(), bugun.getMonth(), 1), yarin];
  if (k === 'gecenay') return [new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1), new Date(bugun.getFullYear(), bugun.getMonth(), 1)];
  return [new Date(+yarin - 7 * GUN), yarin];
}
const oncekiAralik = ([b, s]) => [new Date(+b - (s - b)), b];
export const sureMetni = sn => { sn = Math.round(sn || 0); if (sn < 60) return sn ? sn + ' sn' : '—'; const dk = Math.round(sn / 60); return dk < 60 ? dk + ' dk' : `${Math.floor(dk / 60)} sa ${dk % 60 ? (dk % 60) + ' dk' : ''}`.trim(); };
const saat = z => new Date(z).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const gunAd = z => new Date(z).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const goreli = z => { if (!z) return '—'; const d = (Date.now() - new Date(z)) / 6e4; return d < 2 ? 'şimdi' : d < 60 ? Math.round(d) + ' dk önce' : d < 1440 ? Math.round(d / 60) + ' sa önce' : Math.round(d / 1440) + ' gün önce'; };

export const TUR = { giris: 'Giriş', oturum: 'Uygulamayı açtı', cikis: 'Çıkış', aktif: 'Etkin süre', ekran: 'Ekran', disa_aktarma: 'Excel / dışa aktarma', cikti: 'Çıktı (PDF)', indirme: 'İndirme', yazdirma: 'Yazdırma', paylasim: 'Paylaşım', iletisim: 'İletişim', ice_aktarma: 'İçe aktarma (Excel)', okuma: 'Okutma', yukleme: 'Dosya / fotoğraf yükleme', islem: 'İşlem', ekleme: 'Ekleme', 'değişiklik': 'Değişiklik', silme: 'Silme' };
export const TABLO = { projeler: 'Proje', firmalar: 'Firma', kisiler: 'Kişi', ziyaretler: 'Ziyaret', gorevler: 'Görev', siparisler: 'Sipariş', teklifler: 'Teklif', urunler: 'Ürün', tahsilatlar: 'Tahsilat', numuneler: 'Numune', servis_kayitlari: 'Servis', belgeler: 'Belge', bolgeler: 'Bölge', hedefler: 'Hedef', bayi_stok: 'Stok kalemi', stok_gruplari: 'Stok grubu', stok_barkodlari: 'Barkod', stok_hasar: 'Hasar', stok_rezerv: 'Stok ayırma', urun_belgeleri: 'Ürün belgesi', sevkler: 'Sevk', stok_seri: 'Seri / parti', stok_paylasimlari: 'Stok paylaşımı', stok_sayimlari: 'Sayım', bayi_satis: 'Bayi satışı', bayiler: 'Bayi', masraflar: 'Masraf', cekler: 'Çek', urun_aileleri: 'Ürün ailesi', yorumlar: 'Yorum', rakip_fiyatlar: 'Rakip fiyatı', ekip_uyeleri: 'Kullanıcı', roller: 'Rol', ekipler: 'Ekip', proje_gecmis: 'Aşama' };
const EKRAN = { bugun: 'Bugün', harita: 'Harita', projeler: 'Projeler', firmalar: 'Firmalar', kisiler: 'Kişiler', 'proje/:id': 'Proje sayfası', 'firma/:id': 'Firma sayfası', 'kisi/:id': 'Kişi sayfası', bayistok: 'Stoklar', sevk: 'Sevk', satis: 'Satış', urunler: 'Ürünler', raporlar: 'Raporlar', dosyalar: 'Dosyalar', ayarlar: 'Ayarlar', sirket: 'Şirket', takvim: 'Takvim', gorevler: 'Görevler', teklifler: 'Teklifler', finans: 'Finans', panel: 'Panel', profilim: 'Profilim' };
export const ekranMetni = e => { if (!e) return ''; if (EKRAN[e]) return EKRAN[e]; const [a, b, c] = e.split('/'); const k = EKRAN[b === ':id' ? a + '/:id' : a] || a; return c ? `${k} · ${c}` : b && b !== ':id' ? `${k} · ${b}` : k; };
const KAYIT_YOL = { projeler: 'proje', firmalar: 'firma', kisiler: 'kisi' };

// Dönem için kişi başına özet (sunucu fonksiyonu); eski sunucuda null
export async function etkinlikOzeti([bas, bit]) {
  const { data, error } = await app.db.c.rpc('kullanici_etkinlik', { p_bas: bas.toISOString(), p_bit: bit.toISOString() });
  if (error) throw error;
  const m = new Map();
  for (const r of data || []) {
    const k = (r.kim || '').toLowerCase(); if (!k) continue;
    const o = m.get(k) || m.set(k, { kim: k, kim_id: r.kim_id, sure: 0, gunler: 0, son: null, tur: {}, tablo: {}, ekran: {} }).get(k);
    if (r.kaynak === 'hareket') { o.tur[r.tur] = (o.tur[r.tur] || 0) + +r.adet; if (r.tur === 'aktif') o.sure += +r.sure; if (r.tur === 'ekran' && r.alt) o.ekran[r.alt] = (o.ekran[r.alt] || 0) + +r.adet; }
    else { o.tur[r.tur] = (o.tur[r.tur] || 0) + +r.adet; const t = o.tablo[r.alt] ||= {}; t[r.tur] = (t[r.tur] || 0) + +r.adet; }
    o.gunler = Math.max(o.gunler, +r.gun || 0); if (!o.son || r.son > o.son) o.son = r.son;
  }
  return m;
}
// Etkin gün sayısı için ayrıca: kişinin hareket ve değişiklik satırları (kart) — özet fonksiyonu türe göre ayrık sayar
async function satirlar(eposta, [bas, bit], limit = 3000) {
  const e = eposta.toLowerCase(), sahip = app.db.sahip;
  const [h, d] = await Promise.all([
    app.db.c.from('kullanici_hareketleri').select('*').eq('owner', sahip).eq('kim', e).gte('zaman', bas.toISOString()).lt('zaman', bit.toISOString()).order('zaman', { ascending: false }).limit(limit),
    app.db.c.from('degisiklikler').select('id,tablo,kayit_id,islem,kim,zaman,ozet,degisen').eq('owner', sahip).eq('kim', e).gte('zaman', bas.toISOString()).lt('zaman', bit.toISOString()).order('zaman', { ascending: false }).limit(limit)]);
  if (h.error && d.error) throw h.error;
  return [...(h.data || []).map(x => ({ ...x, kaynak: 'h' })), ...(d.data || []).map(x => ({ ...x, kaynak: 'd', tur: x.islem }))].sort((a, b) => (b.zaman > a.zaman ? 1 : -1));
}
const kisiler = async () => {
  const ben = (app.db.user()?.email || '').toLowerCase();
  let uy = []; try { const { data } = await app.db.c.from('ekip_uyeleri').select('eposta,ad,aktif,yetkiler').eq('owner', app.db.sahip); uy = data || []; } catch {}
  const l = [...uy.map(u => ({ eposta: u.eposta.toLowerCase(), ad: u.ad || u.eposta, aktif: u.aktif, rol: u.yetkiler?._rol || '' }))];
  if (!l.some(x => x.eposta === ben)) l.unshift({ eposta: ben, ad: (app.db.user()?.user_metadata?.ad) || 'Sen', aktif: true, rol: 'Şirket kurucusu', ben: true });
  return l;
};

// ---------- Şirket → Hareketler ----------
export async function hareketlerSekmesi(kutu) {
  if (!kutu) return;
  if (app.db?.mode !== 'supabase') { kutu.innerHTML = '<h2>Kullanıcı hareketleri</h2><p class="hint">Hareketler bulut bağlantısıyla tutulur.</p>'; return; }
  let donem = '7';
  const ciz = async () => {
    kutu.innerHTML = `<div class="card-h"><h2>Kullanıcı hareketleri</h2><div class="seg" role="group" aria-label="Dönem">${DONEM.map(([k, t]) => `<button type="button" data-dn="${k}" class="${k === donem ? 'on' : ''}" aria-pressed="${k === donem}">${t}</button>`).join('')}</div></div><p class="hint">Yükleniyor…</p>`;
    kutu.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { donem = b.dataset.dn; ciz(); });
    let oz, ki; try { [oz, ki] = await Promise.all([etkinlikOzeti(donemAraligi(donem)), kisiler()]); }
    catch (e) { kutu.querySelector('.hint').outerHTML = `<p class="warn">Hareket kaydı sunucuda henüz yok (veritabanı sürüm 67 gerekli). ${esc(e.message || '')}</p>`; return; }
    for (const k of oz.keys()) if (!ki.some(x => x.eposta === k)) ki.push({ eposta: k, ad: k, aktif: false });
    const sat = ki.map(u => ({ u, o: oz.get(u.eposta) || { sure: 0, gunler: 0, tur: {}, son: null } })).sort((a, b) => (b.o.sure - a.o.sure) || ((b.o.son || '') > (a.o.son || '') ? 1 : -1));
    const t = (o, ...k) => k.reduce((a, x) => a + (o.tur[x] || 0), 0);
    kutu.querySelector('.hint').outerHTML = `<div class="tbl-wrap"><table class="tbl kh-t"><thead><tr><th>Kişi</th><th class="r">Etkin süre</th><th class="r">Etkin gün</th><th class="r">Giriş</th><th class="r">Ekran</th><th class="r">Ekleme</th><th class="r">Değişiklik</th><th class="r">Silme</th><th class="r">Çıktı</th><th>Son hareket</th><th></th></tr></thead><tbody>
      ${sat.map(({ u, o }) => `<tr><td><b>${esc(u.ad)}</b>${u.rol ? ` <small class="muted">${esc(u.rol)}</small>` : ''}${u.aktif === false ? ' <em class="flag soft">kapalı</em>' : ''}</td><td class="r num">${sureMetni(o.sure)}</td><td class="r num">${o.gunler || '—'}</td><td class="r num">${t(o, 'giris', 'oturum') || '—'}</td><td class="r num">${t(o, 'ekran') || '—'}</td><td class="r num">${t(o, 'ekleme') || '—'}</td><td class="r num">${t(o, 'değişiklik') || '—'}</td><td class="r num ${t(o, 'silme') >= 20 ? 'neg' : ''}">${t(o, 'silme') || '—'}</td><td class="r num">${t(o, 'disa_aktarma', 'cikti', 'indirme', 'yazdirma') || '—'}</td><td>${o.son ? goreli(o.son) : '<span class="muted">hareket yok</span>'}</td><td><button type="button" class="btn sm" data-kart="${esc(u.eposta)}">Ayrıntı</button></td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Etkin süre: uygulamanın ekranda açık olduğu süre. Ekleme, değişiklik ve silme kayıtların kendisinden; giriş, ekran, çıktı ve paylaşım uygulamadan kaydedilir. Kayıtlar 12 ay saklanır; arama metinleri, şifreler ve sürekli konum kaydedilmez.</p>`;
    kutu.querySelectorAll('[data-kart]').forEach(b => b.onclick = () => { const u = ki.find(x => x.eposta === b.dataset.kart); kullaniciKarti({ eposta: u.eposta, ad: u.ad, rol: u.rol, donem }); });
  };
  ciz();
}

// ---------- Kullanıcı kartı ----------
const SUZGEC = [['', 'Hepsi'], ['oturum', 'Giriş / çıkış'], ['ekran', 'Ekranlar'], ['veri', 'Ekleme / değişiklik / silme'], ['cikti', 'Çıktı ve paylaşım'], ['diger', 'İçe aktarma, okutma, yükleme']];
const suzUyar = (s, x) => !s || (s === 'oturum' ? ['giris', 'oturum', 'cikis', 'aktif'].includes(x.tur) : s === 'ekran' ? x.tur === 'ekran' : s === 'veri' ? x.kaynak === 'd' : s === 'cikti' ? ['disa_aktarma', 'cikti', 'indirme', 'yazdirma', 'paylasim', 'iletisim'].includes(x.tur) : ['ice_aktarma', 'okuma', 'yukleme', 'islem'].includes(x.tur));
const ALAN_AD = { ad: 'Ad', durum: 'Durum', tutar_usd: 'Tutar', adet: 'Adet', aciklama: 'Açıklama', telefon: 'Telefon', eposta: 'E-posta', il: 'İl', notlar: 'Notlar', aktif: 'Aktif', yetkiler: 'Yetkiler', santiye_asamasi: 'Şantiye aşaması', ust_proje_id: 'Ana proje', kategori: 'Kategori' };
const deger = v => v == null || v === '' ? '—' : typeof v === 'object' ? (Array.isArray(v) ? v.join(', ') : '…') : String(v).slice(0, 60);
function satirHtml(x) {
  const ic = x.kaynak === 'd'
    ? `<b>${esc(TUR[x.tur] || x.tur)}</b> · ${esc(TABLO[x.tablo] || x.tablo)}${x.ozet ? `: ${KAYIT_YOL[x.tablo] && x.tur !== 'silme' ? `<a href="#/${KAYIT_YOL[x.tablo]}/${x.kayit_id}">${esc(x.ozet)}</a>` : esc(x.ozet)}` : ''}${x.degisen ? `<small class="kh-deg">${Object.entries(x.degisen).slice(0, 4).map(([k, v]) => `${esc(ALAN_AD[k] || k)}: ${esc(deger(v?.e))} → ${esc(deger(v?.y))}`).join(' · ')}${Object.keys(x.degisen).length > 4 ? ' …' : ''}</small>` : ''}`
    : x.tur === 'ekran' ? `${esc(ekranMetni(x.ekran))}${x.ozet ? `: ${x.kayit_id && KAYIT_YOL[x.tablo] ? `<a href="#/${KAYIT_YOL[x.tablo]}/${x.kayit_id}">${esc(x.ozet)}</a>` : esc(x.ozet)}` : ''}`
    : x.tur === 'aktif' ? `Etkin: <b>${sureMetni(x.ayrinti?.sn)}</b>${x.ozet ? ` <small class="muted">(${esc(x.ozet)})</small>` : ''}`
    : `<b>${esc(TUR[x.tur] || x.tur)}</b>${x.ozet ? `: ${esc(x.ozet)}` : ''}${x.cihaz && ['giris', 'oturum'].includes(x.tur) ? ` <small class="muted">${esc(x.cihaz)}${x.surum ? ' · v' + esc(x.surum) : ''}</small>` : ''}${x.ekran && !['giris', 'oturum', 'cikis'].includes(x.tur) ? ` <small class="muted">${esc(ekranMetni(x.ekran))}</small>` : ''}`;
  return `<li class="kh-s kh-${x.kaynak === 'd' ? 'veri' : esc(x.tur)}"><time>${saat(x.zaman)}</time><span>${ic}</span></li>`;
}
function isiHaritasi(l) {
  const m = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const x of l) { const d = new Date(x.zaman); const g = (d.getDay() + 6) % 7; m[g][d.getHours()] += x.tur === 'aktif' ? Math.round((x.ayrinti?.sn || 0) / 60) : 1; }
  const en = Math.max(1, ...m.flat()), GA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  return `<div class="kh-isi" role="img" aria-label="Gün ve saate göre hareket yoğunluğu"><span></span>${Array.from({ length: 24 }, (_, s) => `<span class="kh-sa">${s % 3 ? '' : s}</span>`).join('')}
    ${m.map((r, g) => `<span class="kh-ga">${GA[g]}</span>${r.map((v, s) => `<i style="--y:${v ? 0.15 + 0.85 * v / en : 0}" title="${GA[g]} ${s}:00 · ${v}"></i>`).join('')}`).join('')}</div>`;
}
export async function kullaniciKarti({ eposta, ad = '', rol = '', donem = '7' }) {
  let dn = donem, suz = '';
  const p = openDrawer(`<header class="dh"><div><p class="muted">Kullanıcı hareketleri</p><h2 id="drawer-title">${esc(ad || eposta)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><div class="dbody kh"></div>`, { wide: true });
  const govde = p.querySelector('.kh');
  const ciz = async () => {
    govde.innerHTML = `<div class="kh-ust"><div class="seg" role="group" aria-label="Dönem">${DONEM.map(([k, t]) => `<button type="button" data-dn="${k}" class="${k === dn ? 'on' : ''}" aria-pressed="${k === dn}">${t}</button>`).join('')}</div><button type="button" class="btn sm ghost" data-xls>Excel'e aktar</button></div><p class="hint">Yükleniyor…</p>`;
    govde.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { dn = b.dataset.dn; ciz(); });
    const ar = donemAraligi(dn);
    let l, oz, ozO;
    try { [l, oz, ozO] = await Promise.all([satirlar(eposta, ar), etkinlikOzeti(ar).then(m => m.get(eposta.toLowerCase())), etkinlikOzeti(oncekiAralik(ar)).then(m => m.get(eposta.toLowerCase()))]); }
    catch (e) { govde.querySelector('.hint').outerHTML = `<p class="warn">Hareketler okunamadı: ${esc(e.message)}</p>`; return; }
    oz ||= { sure: 0, tur: {}, tablo: {}, ekran: {}, son: null }; ozO ||= { sure: 0, tur: {}, tablo: {} };
    const gunSay = new Set(l.map(x => x.zaman.slice(0, 10))).size, son = l[0]?.zaman, ilkGiris = l.filter(x => ['giris', 'oturum'].includes(x.tur)).pop(), sonCihaz = l.find(x => x.cihaz)?.cihaz;
    const say = (o, ...k) => k.reduce((a, x) => a + (o.tur?.[x] || 0), 0), tab = (o, t, i) => o.tablo?.[t]?.[i] || 0;
    const fark = (a, b) => b ? (a === b ? '' : `<small class="${a > b ? 'pos' : 'neg'}">${a > b ? '▲' : '▼'} ${num(Math.abs(a - b))}</small>`) : '';
    const kutu = (t, v, o, ham = false) => `<div class="kh-k"><span>${t}</span><b>${ham ? v : num(v)}</b>${o ?? ''}</div>`;
    const ekranlar = Object.entries(oz.ekran || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const gorunen = l.filter(x => suzUyar(suz, x)).slice(0, 600);
    const gunler = []; for (const x of gorunen) { const g = x.zaman.slice(0, 10); let s = gunler[gunler.length - 1]; if (!s || s.g !== g) gunler.push(s = { g, l: [] }); s.l.push(x); }
    govde.querySelector('.hint').outerHTML = `
      <div class="kh-oz">${kutu('Etkin süre', sureMetni(oz.sure), fark(Math.round(oz.sure / 60), Math.round(ozO.sure / 60)), true)}${kutu('Etkin gün', gunSay)}${kutu('Giriş', say(oz, 'giris', 'oturum'), fark(say(oz, 'giris', 'oturum'), say(ozO, 'giris', 'oturum')))}${kutu('Gezilen ekran', say(oz, 'ekran'), fark(say(oz, 'ekran'), say(ozO, 'ekran')))}
        ${kutu('Ziyaret', tab(oz, 'ziyaretler', 'ekleme'), fark(tab(oz, 'ziyaretler', 'ekleme'), tab(ozO, 'ziyaretler', 'ekleme')))}${kutu('Yeni proje', tab(oz, 'projeler', 'ekleme'), fark(tab(oz, 'projeler', 'ekleme'), tab(ozO, 'projeler', 'ekleme')))}${kutu('Yeni firma / kişi', tab(oz, 'firmalar', 'ekleme') + tab(oz, 'kisiler', 'ekleme'))}${kutu('Teklif', tab(oz, 'teklifler', 'ekleme'), fark(tab(oz, 'teklifler', 'ekleme'), tab(ozO, 'teklifler', 'ekleme')))}
        ${kutu('Ekleme', say(oz, 'ekleme'))}${kutu('Değişiklik', say(oz, 'değişiklik'))}${kutu('Silme', say(oz, 'silme'))}${kutu('Çıktı / dışa aktarma', say(oz, 'disa_aktarma', 'cikti', 'indirme', 'yazdirma'))}</div>
      <p class="muted kh-bilgi">${[rol, son ? 'son hareket ' + goreli(son) : 'bu dönemde hareket yok', sonCihaz ? 'cihaz: ' + sonCihaz : '', ilkGiris ? 'dönemin ilk girişi ' + new Date(ilkGiris.zaman).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : ''].filter(Boolean).map(esc).join(' · ')}</p>
      ${l.length ? `<div class="kh-iki"><section><h3>Çalışma saatleri</h3>${isiHaritasi(l)}</section>${ekranlar.length ? `<section><h3>En çok gezilen ekranlar</h3><ul class="list kh-ek">${ekranlar.map(([e, n]) => `<li><span>${esc(ekranMetni(e))}</span><b class="num">${num(n)}</b></li>`).join('')}</ul></section>` : ''}</div>` : ''}
      <h3>Hareket akışı</h3>
      <div class="seg kh-suz" role="group" aria-label="Hareket türü">${SUZGEC.map(([k, t]) => `<button type="button" data-suz="${k}" class="${k === suz ? 'on' : ''}" aria-pressed="${k === suz}">${t}</button>`).join('')}</div>
      ${gunler.length ? gunler.map(g => `<section class="kh-gun"><h4>${esc(gunAd(g.g + 'T12:00:00'))} <small class="muted">${g.l.length} hareket${(s => s ? ' · etkin ' + sureMetni(s) : '')(g.l.filter(x => x.tur === 'aktif').reduce((a, x) => a + (x.ayrinti?.sn || 0), 0))}</small></h4><ul class="kh-akis">${g.l.map(satirHtml).join('')}</ul></section>`).join('') : '<p class="muted">Bu dönemde bu türde hareket yok.</p>'}
      ${l.length >= 3000 ? '<p class="hint">Çok hareket var; en yeni 3000 kayıt gösteriliyor. Daha kısa bir dönem seç.</p>' : ''}`;
    govde.querySelectorAll('[data-suz]').forEach(b => b.onclick = () => { suz = b.dataset.suz; ciz(); });
    govde.querySelectorAll('.kh-akis a[href^="#/"]').forEach(a => a.addEventListener('click', () => p.querySelector('[data-close]')?.click()));
    govde.querySelector('[data-xls]').onclick = () => exportXlsx(`hareketler-${(ad || eposta).replace(/[^\p{L}\p{N}]+/gu, '-')}-${today()}.xlsx`, { Hareketler: l.map(x => ({ Zaman: new Date(x.zaman).toLocaleString('tr-TR'), Tür: TUR[x.tur] || x.tur, Kayıt: x.kaynak === 'd' ? TABLO[x.tablo] || x.tablo : '', Ekran: ekranMetni(x.ekran), Özet: x.ozet || '', Ayrıntı: x.kaynak === 'd' && x.degisen ? Object.entries(x.degisen).map(([k, v]) => `${ALAN_AD[k] || k}: ${deger(v?.e)} → ${deger(v?.y)}`).join('; ') : x.tur === 'aktif' ? sureMetni(x.ayrinti?.sn) : '', Cihaz: x.cihaz || '', Sürüm: x.surum || '' })) });
  };
  ciz();
}
export const hareketlerim = () => kullaniciKarti({ eposta: (app.db.user()?.email || '').toLowerCase(), ad: 'Hareketlerim' });
