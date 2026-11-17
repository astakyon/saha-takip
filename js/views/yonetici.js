// Yönetici görünümü: uyarı akışı (dikkat isteyen olaylar, en yeni üstte) ve ekip sıralaması.
// Şirket profili → Genel'deki konum doğrulama kuralı ve KVKK konum metni de burada tanımlı kartla ayarlanır.
import { S } from '../db.js';
import { cariGecilenler } from '../zorunlu.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, gunEkle, byId, firmaAd, toast, ACIK, exportXlsx } from '../ui.js';
import { ayar, ayarYaz } from '../ayar.js';
import { siparisUsd } from '../ceyrek.js';
import { kur } from '../kur.js';
import { usdYap } from '../vaderisk.js';
import { kalan, gecikme } from './tahsilat.js';
import { planUyumu } from '../mazeret.js';
import { sureDk, mesafeYaz } from '../giriscikis.js';
import { konumKurali, KONUM_MODLARI, kvkkMetni, varsayilanKvkk } from '../konum.js';
import { onayListesi } from '../onay.js';
import { stokUyarilariHesapla } from '../stok.js';
import { sahipMi } from '../yetki.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const kisiOf = x => (x.sorumlu || x.olusturan || ben() || 'ben').toLowerCase();
const adOf = e => e === ben() ? 'Ben' : (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === e)?.ad || String(e).split('@')[0];
const BUYUK = () => +ayar('uyari_buyuk_teklif', 0) || 50000;

// ---------- Uyarı akışı ----------
export const UYARI_TUR = { konum: 'Uzaktan giriş', yapilmadi: 'Yapılmayan ziyaret', buyuk: 'Büyük teklif', kayip: 'Kayıp proje', gecikme: 'Geciken tahsilat', hareketsiz: 'Hareketsiz proje', onay: 'Onay bekliyor', kisa: 'Çok kısa ziyaret', cek: 'Çek / senet vadesi', bayi: 'Bayi geride', stok: 'Stok yetersiz', cari: 'Cari bilgisi geçildi' };
export function uyarilar(gun = 14) {
  const bas = gunEkle(today(), -gun), kural = konumKurali(), k = kur()?.USD, l = [];
  for (const z of S.ziyaretler || []) {
    if ((z.tarih || '') < bas) continue;
    if (z.giris_mesafe != null && z.giris_mesafe > kural.mesafe) l.push({ tur: 'konum', t: z.giris || z.tarih, kim: kisiOf(z), m: `${firmaAd(z.firma_id) || 'Ziyaret'}: firmaya ${mesafeYaz(z.giris_mesafe)} uzaktan giriş`, git: { zid: z.id }, onem: 2 });
    if (z.durum === 'Yapılmadı') l.push({ tur: 'yapilmadi', t: z.updated_at || z.tarih, kim: kisiOf(z), m: `${firmaAd(z.firma_id) || 'Ziyaret'} yapılmadı${z.mazeret ? ': ' + z.mazeret : ''}`, git: { zid: z.id }, onem: 1 });
    const dk = sureDk(z); if (dk != null && dk < 5) l.push({ tur: 'kisa', t: z.cikis, kim: kisiOf(z), m: `${firmaAd(z.firma_id) || 'Ziyaret'}: ${dk} dakikalık ziyaret`, git: { zid: z.id }, onem: 1 });
  }
  for (const x of S.teklifler || []) { const v = usdYap(x.toplam, x.para_birimi || 'USD'); if ((x.tarih || '') >= bas && v >= BUYUK()) l.push({ tur: 'buyuk', t: x.created_at || x.tarih, kim: kisiOf(x), m: `Teklif ${x.teklif_no || ''} · ${byId('projeler', x.proje_id)?.ad || firmaAd(x.firma_id) || ''} · ${usd(Math.round(v))}`, git: { rota: 'teklifler' }, onem: 1 }); }
  for (const p of S.projeler || []) {
    if (p.durum === 'Kayıp' && String(p.updated_at || '').slice(0, 10) >= bas) l.push({ tur: 'kayip', t: p.updated_at, kim: kisiOf(p), m: `${p.ad} kaybedildi${p.kayip_nedeni ? ': ' + p.kayip_nedeni : ''}${p.tutar_usd ? ' · ' + usd(p.tutar_usd) : ''}`, git: { pid: p.id }, onem: 2 });
    if (ACIK.includes(p.durum) && +p.tutar_usd >= BUYUK() / 2 && String(p.updated_at || '').slice(0, 10) < gunEkle(today(), -45)) l.push({ tur: 'hareketsiz', t: p.updated_at, kim: kisiOf(p), m: `${p.ad}: 45 günden uzun süredir hareket yok · ${usd(p.tutar_usd)}`, git: { pid: p.id }, onem: 1 });
  }
  for (const x of S.tahsilatlar || []) { const g = gecikme(x); if (g >= 30) l.push({ tur: 'gecikme', t: x.vade, kim: kisiOf(x), m: `${firmaAd(x.firma_id) || x.cari || ''} · ${g} gün gecikmiş · kalan ${usd(Math.round(usdYap(kalan(x), x.para_birimi)))}`, git: { rota: 'tahsilat' }, onem: g >= 60 ? 2 : 1 }); }
  for (const c of S.cekler || []) if (['Portföyde', 'Bankada tahsilde', 'Ödenecek'].includes(c.durum) && c.vade && c.vade < today() && c.vade >= gunEkle(today(), -60)) l.push({ id: c.id, tur: 'cek', t: c.vade, kim: '', m: `${c.yon === 'Verilen' ? 'Verilen' : 'Alınan'} ${c.tur || 'çek'} ${c.belge_no || ''} · ${firmaAd(c.firma_id) || c.kesideci || ''} · vadesi ${tarih(c.vade)} geçti, durumu güncellenmedi`, git: { rota: 'cekler' }, onem: 2 });
  if ((S.bayiler || []).length) { const Y = +today().slice(0, 4), oran = (Date.now() - new Date(Y, 0, 1)) / (new Date(Y + 1, 0, 1) - new Date(Y, 0, 1));
    for (const b of S.bayiler.filter(b => (b.durum || 'Aktif') === 'Aktif' && +b.hedef_yil > 0)) { const sat = (S.siparisler || []).filter(x => (x.firma_id === b.firma_id || x.bayi_id === b.firma_id) && String(x.tarih || '').startsWith(String(Y))).reduce((a, x) => a + siparisUsd(x, k), 0);
      const y = sat / (b.hedef_yil * oran) * 100; if (oran > 0.15 && y < 60) l.push({ id: b.id, tur: 'bayi', t: today(), kim: (b.sorumlu || '').toLowerCase(), m: `${firmaAd(b.firma_id)}: yılın bu noktasında hedefin %${Math.round(y)}'inde (${usd(Math.round(sat))} / ${usd(Math.round(b.hedef_yil))})`, git: { rota: 'bayihedef' }, onem: 1 }); } }
  for (const x of stokUyarilariHesapla().yetersiz) l.push({ id: 'stok-' + x.u.kod, tur: 'stok', t: today(), kim: '', m: `${x.u.aciklama || x.u.kod}: açık tekliflerde ${num(x.ihtiyac)}, bayi depolarında toplam ${num(x.stok)}`, git: { rota: 'bayistok' }, onem: 1 });
  for (const x of cariGecilenler()) l.push({ id: 'cari-' + x.f.id, tur: 'cari', t: x.tarih, kim: x.kim, m: `${x.f.ad}: ${x.islem === 'siparis' ? 'sipariş' : x.islem === 'cek' ? 'çek' : x.islem} vergi bilgisi olmadan girildi (şimdilik geç)`, git: { rota: 'firma/' + x.f.id }, onem: 1 });
  for (const o of onayListesi()) l.push({ tur: 'onay', t: o.tarih, kim: (o.kim || '').toLowerCase(), m: `${o.tur.ad}: ${o.baslik}${o.tutar ? ' · ' + o.tutar : ''}`, git: { rota: o.tur.rota }, onem: 1 });
  for (const u of l) u.key = u.tur + ':' + (u.id || u.git.zid || u.git.pid || '') + ':' + String(u.t || '').slice(0, 10) + ':' + (u.id || u.git.zid || u.git.pid ? '' : u.m.slice(0, 40));
  return l.sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')));
}
export function uyarilarView(el) {
  const f = F('uyarilar', { tur: '', gun: 14, islenen: false });
  const isl = ayar('uyari_islenen') || {};
  const tum = uyarilar(+f.gun), hepsi = tum.filter(u => f.islenen || !isl[u.key]), l = hepsi.filter(u => !f.tur || u.tur === f.tur);
  const say = {}; for (const u of hepsi) say[u.tur] = (say[u.tur] || 0) + 1;
  el.innerHTML = `<header class="vh"><div><h1>Uyarı akışı</h1><p class="sum">Son ${f.gun} gün · ${hepsi.length} uyarı${tum.length > hepsi.length ? ` · ${tum.length - hepsi.length} müdahale edildi` : ''}</p></div><div class="vh-act"><label class="chk"><input type="checkbox" data-isl ${f.islenen ? 'checked' : ''}> Müdahale edilenler</label><select data-gun aria-label="Dönem">${[7, 14, 30].map(g => `<option value="${g}" ${+f.gun === g ? 'selected' : ''}>Son ${g} gün</option>`).join('')}</select></div></header>
    <div class="frow uy-turler"><button type="button" class="chip-s ${!f.tur ? 'on' : ''}" data-tur="">Hepsi <i>${hepsi.length}</i></button>${Object.entries(UYARI_TUR).filter(([k]) => say[k]).map(([k, t]) => `<button type="button" class="chip-s ${f.tur === k ? 'on' : ''}" data-tur="${k}">${t} <i>${say[k]}</i></button>`).join('')}</div>
    ${l.length ? `<ol class="uy-akis">${l.slice(0, 300).map((u, i) => `<li class="uy-${u.tur} ${u.onem > 1 ? 'onemli' : ''}"><span class="uy-tur">${UYARI_TUR[u.tur]}</span><button type="button" class="linkbtn" data-u="${i}">${esc(u.m)}</button><small class="muted">${u.kim ? esc(adOf(u.kim)) + ' · ' : ''}${tarih(String(u.t || '').slice(0, 10))}${isl[u.key] ? ' · ✓ ' + esc(adOf(isl[u.key].kim)) : ''}</small>${!isl[u.key] && sahipMi() ? `<button type="button" class="btn sm ghost" data-isle="${i}">Müdahale edildi</button>` : ''}</li>`).join('')}</ol>`
      : '<div class="empty"><p>Dikkat isteyen bir şey yok.</p></div>'}
    <p class="hint">Uzaktan giriş eşiği ${mesafeYaz(konumKurali().mesafe)} (Şirket profili → Genel). Büyük teklif eşiği ${usd(BUYUK())}.</p>`;
  el.querySelector('[data-gun]').onchange = e => { f.gun = +e.target.value; saveFilters(); uyarilarView(el); };
  el.querySelector('[data-isl]').onchange = e => { f.islenen = e.target.checked; saveFilters(); uyarilarView(el); };
  el.querySelectorAll('[data-isle]').forEach(b => b.onclick = async () => { const u = l[+b.dataset.isle], yeni = { ...(ayar('uyari_islenen') || {}) };
    for (const [k, v] of Object.entries(yeni)) if (v.tarih < gunEkle(today(), -60)) delete yeni[k];   // eski işaretleri temizle
    yeni[u.key] = { kim: ben(), tarih: today() }; await ayarYaz('uyari_islenen', yeni); uyarilarView(el); });
  el.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { f.tur = b.dataset.tur; saveFilters(); uyarilarView(el); });
  el.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => { const g = l[+b.dataset.u].git;
    if (g.zid) (await import('./ziyaret.js')).ziyaretForm({ id: g.zid }); else if (g.pid) location.hash = '#/proje/' + g.pid; else if (g.rota) location.hash = '#/' + g.rota; });
}

// ---------- Ekip sıralaması ----------
export function siralama(bas, son) {
  const ic = d => { const x = String(d || '').slice(0, 10); return x >= bas && x <= son; }, k = kur()?.USD;
  const kisiler = [...new Set([ben(), ...(app.ekip || []).filter(u => u.aktif !== false && !u.dis_firma_id).map(u => (u.eposta || '').toLowerCase())].filter(Boolean))];
  return kisiler.map(e => {
    const z = (S.ziyaretler || []).filter(x => ic(x.tarih) && kisiOf(x) === e && (x.durum || 'Yapıldı') === 'Yapıldı');
    const t = (S.teklifler || []).filter(x => ic(x.tarih) && kisiOf(x) === e);
    const s = (S.siparisler || []).filter(x => ic(x.tarih) && !x.rapor_disi && kisiOf(x) === e);
    const yeniP = (S.projeler || []).filter(x => ic(x.created_at) && kisiOf(x) === e);
    const u = planUyumu(bas, son, e);
    return { e, ad: adOf(e), ziyaret: z.length, firma: new Set(z.map(x => x.firma_id)).size, teklif: t.length, siparis: s.reduce((a, x) => a + siparisUsd(x, k), 0), yeniProje: yeniP.length, uyum: u.uyum };
  });
}
const OLCU = [['ziyaret', 'Ziyaret'], ['firma', 'Farklı firma'], ['teklif', 'Teklif'], ['siparis', 'Sipariş'], ['yeniProje', 'Yeni proje'], ['uyum', 'Plana uyum']];
export function siralamaView(el) {
  const f = F('siralama', { donem: 'ay', olcu: 'ziyaret' });
  const t = today(), bas = f.donem === 'hafta' ? gunEkle(t, -((new Date(t + 'T00:00').getDay() + 6) % 7)) : f.donem === 'ay' ? t.slice(0, 8) + '01' : t.slice(0, 5) + '01-01';
  const l = siralama(bas, t).sort((a, b) => (b[f.olcu] ?? -1) - (a[f.olcu] ?? -1));
  const deger = (x, k) => k === 'siparis' ? usd(Math.round(x[k])) : k === 'uyum' ? (x[k] == null ? '—' : '%' + x[k]) : num(x[k]);
  const max = Math.max(1, ...l.map(x => +x[f.olcu] || 0));
  el.innerHTML = `<header class="vh"><div><h1>Ekip sıralaması</h1><p class="sum">${tarih(bas)} – ${tarih(t)}</p></div><div class="vh-act"><div class="seg" role="group" aria-label="Dönem">${[['hafta', 'Bu hafta'], ['ay', 'Bu ay'], ['yil', 'Bu yıl']].map(([k, a]) => `<button type="button" data-d="${k}" class="${f.donem === k ? 'on' : ''}">${a}</button>`).join('')}</div><button class="btn ghost" data-xlsx>Excel</button></div></header>
    <div class="frow">${OLCU.map(([k, a]) => `<button type="button" class="chip-s ${f.olcu === k ? 'on' : ''}" data-o="${k}">${a}</button>`).join('')}</div>
    <ol class="sira-l">${l.map((x, i) => `<li><span class="sira-n">${i + 1}</span><span class="grow"><b>${esc(x.ad)}</b><small class="muted"> ${OLCU.filter(([k]) => k !== f.olcu).map(([k, a]) => `${a.toLowerCase()} ${deger(x, k)}`).join(' · ')}</small><span class="hedef-bar sira-bar"><i style="width:${(+x[f.olcu] || 0) / max * 100}%"></i></span></span><b class="num">${deger(x, f.olcu)}</b></li>`).join('')}</ol>`;
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.donem = b.dataset.d; saveFilters(); siralamaView(el); });
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { f.olcu = b.dataset.o; saveFilters(); siralamaView(el); });
  el.querySelector('[data-xlsx]').onclick = () => exportXlsx(`ekip-siralamasi-${t}`, { Sıralama: l.map(x => ({ Kişi: x.ad, Ziyaret: x.ziyaret, 'Farklı firma': x.firma, Teklif: x.teklif, 'Sipariş (USD)': Math.round(x.siparis), 'Yeni proje': x.yeniProje, 'Plana uyum %': x.uyum })) });
}

// ---------- Konum kuralı ve KVKK metni (Şirket profili → Genel) ----------
export function konumAyarKarti() {
  const k = konumKurali();
  return `<section class="card konum-k"><h2>Konum doğrulama</h2>
    <div class="fld"><label for="kd-m">Ziyarette giriş için firmaya en fazla uzaklık (metre)</label><input id="kd-m" type="number" inputmode="numeric" data-kdm value="${k.mesafe}" min="50" step="50"></div>
    <div class="fld"><label for="kd-mod">Uzaktaysa</label><select id="kd-mod" data-kdmod>${Object.entries(KONUM_MODLARI).map(([v, t]) => `<option value="${v}" ${k.mod === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="fld"><label for="kd-kvkk">KVKK konum aydınlatma metni</label><textarea id="kd-kvkk" rows="6" data-kvkk placeholder="${esc(varsayilanKvkk())}">${esc(ayar('kvkk_konum_metni') || '')}</textarea><small class="muted">Boş bırakılırsa hazır metin kullanılır. Her kullanıcı ilk girişte metni görür ve onaylar; metin değişince yeniden sorulur.</small></div>
    <div class="frow"><button type="button" class="btn" data-kdkaydet>Kaydet</button><a href="#/uyarilar" class="linkbtn">Uyarı akışı</a></div></section>`;
}
export function konumAyarBagla(root) {
  root.querySelector('[data-kdkaydet]')?.addEventListener('click', async () => {
    await ayarYaz('konum_dogrulama', { mesafe: Math.max(50, +root.querySelector('[data-kdm]').value || 1000), mod: root.querySelector('[data-kdmod]').value });
    await ayarYaz('kvkk_konum_metni', root.querySelector('[data-kvkk]').value.trim() || null);
    toast('Konum kuralı ve KVKK metni kaydedildi.');
  });
}
