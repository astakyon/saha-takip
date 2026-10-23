// Bugün: günlük özet, günün rotası, yakınımdakiler, zamanı gelen projeler, uzun süredir gidilmeyenler, doğum günleri, uyarılar
import { S } from '../db.js';
import { app } from '../state.js';
import { esc, usd, num, pill, tarih, today, gunEkle, byId, firmaAd, toast, openDrawer, closeDrawer, myLocation, directionsUrl, ACIK } from '../ui.js';
import { km } from '../geo.js';
import { ziyaretForm, gorevForm, zDurum } from './ziyaret.js';
import { waGonder } from '../sablon.js';
import { stokUyarilari } from './urunler.js';
import { kurYazi } from '../kur.js';
import { gecikenler, kalan as tKalan, para as tPara } from './tahsilat.js';
import { ayar, ayarYaz } from '../ayar.js';
import { haftaVerisi, haftaBasi } from './rapor.js';
import { F, saveFilters } from '../state.js';
import { sahipMi } from '../yetki.js';
import { etiketKarti } from '../yorum.js';

// Segmente göre ziyaret sıklığı: A 30, B 60, C 90 gün; segmentsiz firmalarda 45 gün
export const SIKLIK = { A: 30, B: 60, C: 90 };
export const siklik = f => SIKLIK[f.segment] || ayar('ziyaret_siklik', 45);
// Tam yedek hatırlatması: 7 günden eski ya da hiç alınmamışsa
export function yedekGunu() { const s = ayar('son_tam_yedek'); return s ? gunFarki(s.slice(0, 10), today()) : null; }

// Ziyaretin konumu: kendi konumu, yoksa firmanın ya da projenin kesin konumu
export function ziyaretYeri(z) {
  if (z.lat != null) return [z.lat, z.lng];
  for (const r of [byId('firmalar', z.firma_id), byId('projeler', z.proje_id)]) if (r && r.lat != null && !r.konum_yaklasik) return [r.lat, r.lng];
  for (const r of [byId('firmalar', z.firma_id), byId('projeler', z.proje_id)]) if (r && r.lat != null) return [r.lat, r.lng];
  return null;
}
// Günün rotası: saati olanlar saat sırasıyla, olmayanlar en yakın komşu sırasıyla
export function rotaSirala(zs, bas) {
  const yer = zs.map(z => ({ z, p: ziyaretYeri(z) })).filter(x => x.p);
  const saatli = yer.filter(x => x.z.saat).sort((a, b) => a.z.saat.localeCompare(b.z.saat));
  let kalan = yer.filter(x => !x.z.saat), out = [...saatli], cur = saatli.at(-1)?.p || bas;
  while (kalan.length) {
    let bi = 0; if (cur) kalan.forEach((x, i) => { if (km(cur, x.p) < km(cur, kalan[bi].p)) bi = i; });
    const [n] = kalan.splice(bi, 1); out.push(n); cur = n.p;
  }
  return out;
}
// Google Haritalar çok duraklı rota bağlantısı (başlangıç: telefonun konumu; en fazla 9 ara durak)
export function rotaUrl(noktalar) {
  if (!noktalar.length) return null;
  const s = noktalar.slice(0, 10).map(p => `${(+p[0]).toFixed(6)},${(+p[1]).toFixed(6)}`);
  const dest = s.pop();
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${s.length ? '&waypoints=' + encodeURIComponent(s.join('|')) : ''}&travelmode=driving`;
}
// Günün yaklaşık yol mesafesi: ziyaret noktaları arası kuş uçuşu × 1,3
export function gunKm(gun) {
  const pts = S.ziyaretler.filter(z => z.tarih === gun && zDurum(z) === 'Yapıldı').sort((a, b) => (a.saat || a.created_at || '').localeCompare(b.saat || b.created_at || '')).map(ziyaretYeri).filter(Boolean);
  let t = 0; for (let i = 1; i < pts.length; i++) t += km(pts[i - 1], pts[i]);
  return Math.round(t * 1.3);
}
const sonZiyaret = () => { const m = new Map(); for (const z of S.ziyaretler) if (zDurum(z) === 'Yapıldı' && z.firma_id && (!m.has(z.firma_id) || z.tarih > m.get(z.firma_id))) m.set(z.firma_id, z.tarih); return m; };
const gunFarki = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);

export function zamaniGelenler() {
  const t = today(), ay = gunEkle(t, 30), son = new Map();
  for (const z of S.ziyaretler) if (z.proje_id && (!son.has(z.proje_id) || z.tarih > son.get(z.proje_id))) son.set(z.proje_id, z.tarih);
  return S.projeler.filter(p => !p.aday && ACIK.includes(p.durum)).map(p => {
    const neden = [];
    if (p.alim_tarihi && p.alim_tarihi <= ay) neden.push(p.alim_tarihi < t ? `aydınlatma alımı ${tarih(p.alim_tarihi)} bekleniyordu` : `aydınlatma alımı ${tarih(p.alim_tarihi)}`);
    if (['İnce işler', 'Elektrik tesisatı'].includes(p.santiye_asamasi)) neden.push('şantiye ' + p.santiye_asamasi.toLowerCase() + ' aşamasında');
    if (p.beklenen_tarih && p.beklenen_tarih <= ay && p.beklenen_tarih >= gunEkle(t, -60)) neden.push(p.beklenen_tarih < t ? `beklenen sipariş tarihi geçti (${tarih(p.beklenen_tarih)})` : `beklenen sipariş ${tarih(p.beklenen_tarih)}`);
    if (!neden.length) return null;
    const sz = son.get(p.id);
    return { p, neden, sz, oncelik: (p.alim_tarihi || p.beklenen_tarih || '9') };
  }).filter(Boolean).filter(x => !x.sz || gunFarki(x.sz, t) > 14).sort((a, b) => a.oncelik.localeCompare(b.oncelik));
}
export function gidilmeyenler(gun = null) {
  const t = today(), son = sonZiyaret();
  const aktif = new Set();
  for (const p of S.projeler) if (ACIK.includes(p.durum) || p.durum === 'Sipariş') for (const k of ['emut_id', 'gemut_id', 'alici_id', 'bayi_id', 'projeci_id', 'danisman_id']) if (p[k]) aktif.add(p[k]);
  return S.firmalar.filter(f => aktif.has(f.id) || (f.tipler || []).some(x => ['Bayi', 'Emüt', 'Malzeme Alıcısı'].includes(x)))
    .map(f => ({ f, son: son.get(f.id) || null, gun: son.get(f.id) ? gunFarki(son.get(f.id), t) : null, proje: S.projeler.filter(p => ACIK.includes(p.durum) && [p.emut_id, p.gemut_id, p.alici_id, p.bayi_id].includes(f.id)).length }))
    .filter(x => x.gun === null || x.gun > (gun ?? siklik(x.f))).sort((a, b) => (b.proje - a.proje) || ((b.gun ?? 9999) - (a.gun ?? 9999)));
}
export function dogumGunleri(gun = 7) {
  const t = new Date(today() + 'T00:00');
  return S.kisiler.filter(k => k.dogum_gunu).map(k => {
    const d = new Date(k.dogum_gunu + 'T00:00'); const bu = new Date(t.getFullYear(), d.getMonth(), d.getDate());
    if (bu < t) bu.setFullYear(t.getFullYear() + 1);
    return { k, kalan: Math.round((bu - t) / 864e5), gun: bu };
  }).filter(x => x.kalan <= gun).sort((a, b) => a.kalan - b.kalan);
}

// Pazartesi–Çarşamba: geçen haftanın raporu hazır kartı (açılınca ya da kapatılınca o hafta bir daha çıkmaz)
function raporKarti() {
  const t = today(), gun = (new Date(t + 'T00:00').getDay() + 6) % 7; if (gun > 2) return '';
  let gor = null; try { gor = localStorage.getItem('saha-rapor-gor'); } catch {}
  if (gor === haftaBasi(t)) return '';
  const d = haftaVerisi(gunEkle(haftaBasi(t), -7));
  if (!d.ziy.length && !d.sip.length && !d.gec.length) return '';
  return `<section class="card wide rapor-kart"><div class="card-h"><h2>Geçen haftanın raporu hazır</h2><button type="button" class="x" data-raporkapat aria-label="Kartı kapat">×</button></div>
    <p class="muted">${tarih(d.bas)} – ${tarih(d.son)}</p>
    <div class="ledger-mini"><div><b>${d.ziy.length}</b><span>ziyaret · ${d.gunler.length} gün</span></div><div><b>${d.sip.length}</b><span>sipariş${d.sipUsd ? ' · ' + usd(d.sipUsd) : ''}</span></div><div><b>${d.kazan.length}</b><span>kazanılan proje</span></div><div><b>${d.kayb.length}</b><span>kaybedilen</span></div><div><b>${d.yeniP.length}</b><span>yeni proje</span></div></div>
    <div class="btnrow"><button type="button" class="btn primary" data-raporac>Raporu aç</button><span class="hint">PDF, Excel ya da WhatsApp ile gönderebilirsin.</span></div></section>`;
}

// Günün km'si masraflara yazıldı mı (o tarihte km girilmiş masraf var mı)
const kmYazildi = gun => S.masraflar.some(m => m.tarih === gun && +m.km > 0);
// Yakıt tutarı tahmini: km × (litre/100 km) × litre fiyatı (Ayarlar → Genel → Araç)
export const yakitTutar = km => { const l = +ayar('yakit_lt100', 0), f = +ayar('yakit_tl', 0); return l && f ? Math.round(km * l / 100 * f) : 0; };
async function kmMasrafa(gun) {
  const km = gunKm(gun), tutar = yakitTutar(km);
  if (tutar) { await app.db.save('masraflar', { tarih: gun, tip: 'Yakıt', km, tutar, aciklama: 'Saha yolu (ziyaret noktalarından tahmin)' }); toast(`${tarih(gun)}: ${km} km, ${num(tutar)} TL masraflara yazıldı.`); app.refresh(); }
  else { const { masrafForm } = await import('./kayitlar.js'); masrafForm({ tarih: gun, tip: 'Yakıt', km, aciklama: 'Saha yolu (ziyaret noktalarından tahmin)' }); toast('Tutarın kendiliğinden hesaplanması için Ayarlar → Genel → Araç bölümüne tüketim ve litre fiyatını gir.'); }
}

// ---------- Bugün kartlarının sırası ve görünürlüğü (Düzenle) ----------
const KARTLAR = [['plan', 'Bugünün planı'], ['gorev', 'Görevler'], ['yapilan', 'Bugün yapılanlar'], ['zaman', 'Zamanı gelen projeler'], ['gidilmeyen', 'Uzun süredir gidilmeyenler'], ['yarin', 'Yarın'], ['dogum', 'Doğum günleri'], ['uyari', 'Uyarılar'], ['rapor', 'Geçen haftanın raporu'], ['etiket', 'Seni etiketlediler']];
const kartAnahtar = h => { const t = (h || '').trim(); if (/^Bugünün planı/.test(t)) return 'plan'; if (/görevler$|^Görevler/i.test(t) && !/^Bugün/.test(t)) return 'gorev'; if (/^Bugün yapılanlar/.test(t)) return 'yapilan'; if (/^Zamanı gelen/.test(t)) return 'zaman'; if (/^Uzun süredir/.test(t)) return 'gidilmeyen'; if (/^Yarın/.test(t)) return 'yarin'; if (/^Doğum/.test(t)) return 'dogum'; if (/^Uyarılar/.test(t)) return 'uyari'; if (/haftanın raporu/.test(t)) return 'rapor'; if (/^Seni etiketlediler/.test(t)) return 'etiket'; return null; };
const kartAyar = () => ({ sira: [], gizli: [], ...(ayar('bugun_kartlar') || {}) });
function kartDuzeniUygula(el) {
  const a = kartAyar(), dash = el.querySelector('.dash'); if (!dash) return;
  const sira = [...a.sira, ...KARTLAR.map(([k]) => k).filter(k => !a.sira.includes(k))];
  const kartlar = [...dash.children].map(s => ({ s, k: kartAnahtar(s.querySelector('h2')?.textContent) }));
  for (const { s, k } of kartlar) { if (k) s.dataset.kart = k; if (k && a.gizli.includes(k)) s.hidden = true; }
  kartlar.filter(x => x.k).sort((x, y) => sira.indexOf(x.k) - sira.indexOf(y.k)).forEach(({ s }) => dash.appendChild(s));
}
function kartDuzeniPaneli(el) {
  const ciz = () => {
    const a = kartAyar(), sira = [...a.sira, ...KARTLAR.map(([k]) => k).filter(k => !a.sira.includes(k))];
    const p = openDrawer(`<header class="dh"><div><p class="muted">Bugün ekranı</p><h2 id="drawer-title">Kartları düzenle</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody"><p class="hint">Okları kullanarak sırala, istemediğin kartı kapat. Telefonda ve bilgisayarda aynı düzen geçerli olur.</p>
      <ul class="list kart-duzen">${sira.map((k, i) => `<li data-k="${k}"><span class="grow"><b>${esc(KARTLAR.find(x => x[0] === k)[1])}</b></span>
        <button type="button" class="btn sm ghost" data-yukari ${i ? '' : 'disabled'} aria-label="Yukarı">↑</button><button type="button" class="btn sm ghost" data-asagi ${i < sira.length - 1 ? '' : 'disabled'} aria-label="Aşağı">↓</button>
        <label class="tg" title="Göster"><input type="checkbox" data-goster ${a.gizli.includes(k) ? '' : 'checked'} aria-label="Göster"><span></span></label></li>`).join('')}</ul>
      <div class="btnrow"><button type="button" class="btn ghost" data-sifirla>Varsayılan düzen</button></div></div>`);
    const kaydet = async yeni => { await ayarYaz('bugun_kartlar', yeni); bugunView(el); ciz(); };
    p.querySelectorAll('li[data-k]').forEach(li => {
      const k = li.dataset.k, i = sira.indexOf(k);
      li.querySelector('[data-yukari]').onclick = () => { const s = [...sira]; [s[i - 1], s[i]] = [s[i], s[i - 1]]; kaydet({ ...a, sira: s }); };
      li.querySelector('[data-asagi]').onclick = () => { const s = [...sira]; [s[i + 1], s[i]] = [s[i], s[i + 1]]; kaydet({ ...a, sira: s }); };
      li.querySelector('[data-goster]').onchange = e => kaydet({ ...a, sira, gizli: e.target.checked ? a.gizli.filter(x => x !== k) : [...a.gizli, k] });
    });
    p.querySelector('[data-sifirla]').onclick = async () => { await ayarYaz('bugun_kartlar', null); bugunView(el); ciz(); };
  };
  ciz();
}

export function bugunView(el) {
  const t = today(), yarin = gunEkle(t, 1);
  const planli = S.ziyaretler.filter(z => z.tarih === t && zDurum(z) === 'Planlandı');
  const yapilan = S.ziyaretler.filter(z => z.tarih === t && zDurum(z) === 'Yapıldı').sort((a, b) => (a.saat || '').localeCompare(b.saat || ''));
  const ben = (app.db.user?.()?.email || '').toLowerCase(), uye = !sahipMi();
  const gorev = S.gorevler.filter(g => g.durum !== 'Tamam' && (uye ? true : g.son_tarih && g.son_tarih <= t && (!g.atanan || g.atanan === ben))).sort((a, b) => (a.son_tarih || '9').localeCompare(b.son_tarih || '9'));
  const ekipAcik = uye ? [] : S.gorevler.filter(g => g.durum !== 'Tamam' && g.atanan && g.atanan !== ben);
  const ekipBitti = uye ? [] : S.gorevler.filter(g => g.durum === 'Tamam' && g.tamamlayan && g.tamamlayan !== ben && (g.updated_at || '') >= gunEkle(t, -3));
  const kimAd = e => (app.ekip || []).find(u => u.eposta === e)?.ad || e;
  const yarinZ = S.ziyaretler.filter(z => z.tarih === yarin && zDurum(z) === 'Planlandı'), yarinG = S.gorevler.filter(g => g.durum !== 'Tamam' && g.son_tarih === yarin);
  const zg = zamaniGelenler(), gid = gidilmeyenler(), dg = dogumGunleri();
  const stok = stokUyarilari();
  const numune = S.numuneler.filter(n => n.durum === 'Müşteride' && n.iade_tarihi && n.iade_tarihi <= t);
  const servis = S.servis_kayitlari.filter(s => s.durum !== 'Çözüldü');
  const teklif = S.teklifler.filter(x => x.durum === 'Gönderildi' && x.gecerlilik && x.gecerlilik <= gunEkle(t, 7));
  const gecT = gecikenler();
  const dun = gunEkle(t, -1), kmDun = gunKm(dun), kmDunEksik = kmDun > 0 && !kmYazildi(dun);
  const yg = yedekGunu(), yedek = sahipMi() && S.projeler.length > 0 && (yg === null || yg >= 7);
  const kmBugun = gunKm(t);
  const sirali = rotaSirala(planli);
  const rota = rotaUrl(sirali.map(x => x.p));
  const z1 = z => `<li><button type="button" class="linkbtn" data-zid="${z.id}"><b>${z.saat ? esc(z.saat) + ' · ' : ''}${esc(firmaAd(z.firma_id) || 'Ziyaret')}</b></button><span class="muted">${esc([byId('kisiler', z.kisi_id)?.ad_soyad, z.amac, byId('projeler', z.proje_id)?.ad].filter(Boolean).join(' · '))}</span>${z.sonuc_tipi ? `<span class="tag-s res">${esc(z.sonuc_tipi)}</span>` : ''}</li>`;
  const g1 = g => `<li class="${g.son_tarih < t ? 'late' : ''}"><label class="chk"><input type="checkbox" data-done="${g.id}" aria-label="Tamamlandı"></label><button type="button" class="linkbtn" data-gid="${g.id}">${esc(g.baslik)}</button><span class="muted">${!g.son_tarih ? '' : g.son_tarih < t ? tarih(g.son_tarih) : g.son_tarih === t ? 'bugün' : tarih(g.son_tarih)}</span></li>`;
  const gun = new Date(t + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  el.innerHTML = `<header class="vh"><div><h1>Bugün</h1><p class="sum">${esc(gun)} · ${planli.length} planlı ziyaret · ${gorev.length} görev${kmBugun ? ` · yaklaşık ${kmBugun} km yol` : ''}${kurYazi() ? `<br><span class="kur">${kurYazi()}</span>` : ''}</p></div>
    <div class="vh-act"><button class="btn ghost" data-kduzen title="Kartları sırala ve gizle">Düzenle</button><button class="btn ghost" data-yakin>Yakınımdakiler</button><button class="btn primary" data-yeni>Ziyaret kaydet</button></div></header>
    <div class="dash today-grid">
      ${raporKarti()}
      ${etiketKarti()}
      <section class="card wide"><h2>Bugünün planı</h2>
        ${planli.length ? `<ol class="route">${sirali.map((x, i) => `<li><span class="rn">${i + 1}</span><span class="rt"><b>${x.z.saat ? esc(x.z.saat) + ' · ' : ''}${esc(firmaAd(x.z.firma_id) || 'Ziyaret')}</b><small>${esc([byId('kisiler', x.z.kisi_id)?.ad_soyad, x.z.amac, byId('projeler', x.z.proje_id)?.ad].filter(Boolean).join(' · '))}</small></span>
          <span class="ra"><a class="btn sm ghost" href="${directionsUrl(x.p[0], x.p[1])}" target="_blank" rel="noopener">Yol</a><button type="button" class="btn sm" data-yapildi="${x.z.id}">Yapıldı</button></span></li>`).join('')}</ol>
          ${planli.length > sirali.length ? `<p class="hint">${planli.length - sirali.length} ziyaretin konumu bilinmiyor (firmanın yeri haritada işaretli değil); rotaya eklenmedi: ${planli.filter(z => !ziyaretYeri(z)).map(z => esc(firmaAd(z.firma_id) || 'Ziyaret')).join(', ')}.</p>` : ''}
          <div class="btnrow">${rota ? `<a class="btn primary" href="${rota}" target="_blank" rel="noopener">Günün rotasını Google Haritalar'da aç</a>` : ''}<a class="btn ghost" href="#/takvim">Haftalık takvim</a></div>
          ${sirali.length > 10 ? '<p class="hint">Google Haritalar tek rotada en fazla 10 durak gösterir; ilk 10 durak eklendi.</p>' : ''}`
        : `<p class="hint">Bugün için planlı ziyaret yok.</p><div class="btnrow"><a class="btn ghost" href="#/takvim">Takvimden ziyaret planla</a></div>`}
      </section>
      <section class="card"><h2>${uye ? 'Sana atanan görevler' : 'Görevler'}</h2>${gorev.length ? `<ul class="list chk-list">${gorev.slice(0, 10).map(g1).join('')}</ul>` : `<p class="hint">${uye ? 'Sana atanmış açık görev yok.' : 'Bugün için açık görev yok.'}</p>`}${ekipAcik.length ? `<p class="hint">Ekipte ${ekipAcik.length} açık görev: ${esc([...new Set(ekipAcik.map(g => kimAd(g.atanan)))].join(', '))}</p>` : ''}${uye ? '' : '<p><a href="#/gorevler">Görev takvimi</a></p>'}</section>
      <section class="card"><h2>Bugün yapılanlar</h2>${yapilan.length ? `<ul class="list">${yapilan.map(z1).join('')}</ul>` : '<p class="hint">Henüz ziyaret kaydı yok.</p>'}${kmBugun ? `<p class="hint">Ziyaret noktalarına göre yaklaşık ${kmBugun} km.${kmYazildi(t) ? ' Masraflara yazıldı.' : ` <button type="button" class="linkbtn" data-kmyaz="${t}">Masrafa yaz</button>`}</p>` : ''}</section>
      <section class="card"><h2>Zamanı gelen projeler <span class="muted">${zg.length}</span></h2>
        ${zg.length ? `<ul class="list">${zg.slice(0, 8).map(x => `<li><a href="#/proje/${x.p.id}"><b>${esc(x.p.ad)}</b><span class="muted">${esc(x.neden.join(', '))}${x.sz ? ` · son ziyaret ${tarih(x.sz)}` : ' · hiç ziyaret yok'}</span></a>${pill(x.p.durum)}</li>`).join('')}</ul>`
        : '<p class="hint">Aydınlatma alım tarihi ya da şantiye aşaması yaklaşan proje yok. Projelere “Şantiye aşaması” ve “Tahmini aydınlatma alımı” girdikçe burada uyarı alırsın.</p>'}</section>
      <section class="card"><h2>Uzun süredir gidilmeyenler <span class="muted">${gid.length}</span></h2>
        ${gid.length ? `<ul class="list">${gid.slice(0, 8).map(x => `<li><a href="#/firma/${x.f.id}"><b>${esc(x.f.ad)}</b><span class="muted">${x.f.segment ? `<em class="seg-r">${esc(x.f.segment)}</em> ` : ''}${x.son ? `${x.gun} gündür gidilmedi` : 'hiç ziyaret kaydı yok'}${x.proje ? ` · ${x.proje} açık proje` : ''}</span></a><button type="button" class="btn sm ghost" data-planla="${x.f.id}">Planla</button></li>`).join('')}</ul>` : '<p class="hint">Ziyaret aralığı geçen aktif firma yok. Aralık firma segmentine göre: A 30, B 60, C 90 gün, segmentsiz 45 gün.</p>'}</section>
      <section class="card"><h2>Yarın</h2>${yarinZ.length || yarinG.length ? `<ul class="list">${yarinZ.map(z1).join('')}${yarinG.map(g => `<li><button type="button" class="linkbtn" data-gid="${g.id}">○ ${esc(g.baslik)}</button></li>`).join('')}</ul>` : '<p class="hint">Yarın için plan yok.</p>'}</section>
      ${dg.length ? `<section class="card"><h2>Doğum günleri</h2><ul class="list">${dg.map(x => `<li><span><b>${esc(x.k.ad_soyad)}</b><span class="muted"> · ${firmaAd(x.k.firma_id) ? esc(firmaAd(x.k.firma_id)) + ' · ' : ''}${x.kalan === 0 ? 'bugün' : x.kalan === 1 ? 'yarın' : x.gun.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span></span><button type="button" class="btn sm ghost" data-dg="${x.k.id}">Tebrik et</button></li>`).join('')}</ul></section>` : ''}
      ${kmDunEksik || ekipBitti.length || yedek || stok.yetersiz.length || stok.hareketsiz.length || numune.length || servis.length || teklif.length || gecT.length ? `<section class="card"><h2>Uyarılar</h2><ul class="list">
        ${kmDunEksik ? `<li><span><b>Dünün yolu masrafa yazılmadı</b><span class="muted"> · yaklaşık ${kmDun} km${yakitTutar(kmDun) ? ' ≈ ' + num(yakitTutar(kmDun)) + ' TL yakıt' : ''}</span></span><button type="button" class="btn sm" data-kmyaz="${dun}">Masrafa yaz</button></li>` : ''}
        ${ekipBitti.map(g => `<li><button type="button" class="linkrow" data-gid="${g.id}"><b>${esc(kimAd(g.tamamlayan))} görevi tamamladı</b><span class="muted">${esc(g.baslik)}</span></button></li>`).join('')}
        ${yedek ? `<li><a href="#/ayarlar" data-yedekgit><b>${yg === null ? 'Henüz tam yedek almadın' : `Son tam yedek ${yg} gün önce`}</b><span class="muted">Ayarlar → Veri ve yedek → Tam yedek (ZIP); dosyayı bilgisayarında sakla</span></a></li>` : ''}
        ${gecT.length ? `<li><a href="#/tahsilat"><b class="neg">${gecT.length} faturanın vadesi geçti</b><span class="muted">${esc(gecT.slice(0, 3).map(x => (firmaAd(x.firma_id) || x.cari) + ' ' + tPara(tKalan(x), x.para_birimi)).join(', '))}</span></a></li>` : ''}
        ${stok.yetersiz.length ? `<li><a href="#/urunler"><b>${stok.yetersiz.length} üründe stok yetersiz</b><span class="muted">yaklaşan tekliflerin ihtiyacı depodaki stoktan fazla</span></a></li>` : ''}
        ${stok.hareketsiz.length ? `<li><a href="#/urunler"><b>${stok.hareketsiz.length} ürün 60 günü aşkın süredir hareketsiz</b><span class="muted">kampanyaya uygun stok</span></a></li>` : ''}
        ${numune.length ? `<li><a href="#/numuneler"><b>${numune.length} numunenin iade tarihi geldi</b><span class="muted">${esc(numune.slice(0, 3).map(n => firmaAd(n.firma_id) || n.urun_ad).join(', '))}</span></a></li>` : ''}
        ${servis.length ? `<li><a href="#/servis"><b>${servis.length} açık servis kaydı</b><span class="muted">${esc(servis.slice(0, 3).map(s => firmaAd(s.firma_id) || s.tip).join(', '))}</span></a></li>` : ''}
        ${teklif.length ? `<li><a href="#/teklifler"><b>${teklif.length} teklifin geçerliliği doluyor</b><span class="muted">${esc(teklif.slice(0, 3).map(x => byId('projeler', x.proje_id)?.ad || x.teklif_no).join(', '))}</span></a></li>` : ''}
      </ul></section>` : ''}
    </div>`;
  kartDuzeniUygula(el);
  el.querySelector('[data-kduzen]').onclick = () => kartDuzeniPaneli(el);
  el.querySelector('[data-yeni]').onclick = () => ziyaretForm({});
  el.querySelectorAll('[data-kmyaz]').forEach(b => b.onclick = () => kmMasrafa(b.dataset.kmyaz));
  el.querySelector('[data-raporac]')?.addEventListener('click', () => { const g = gunEkle(haftaBasi(today()), -7); try { localStorage.setItem('saha-rapor-gor', haftaBasi(today())); } catch {} const fr = F('rapor', {}); fr.bas = g; saveFilters(); location.hash = '#/rapor'; });
  el.querySelector('[data-raporkapat]')?.addEventListener('click', e => { try { localStorage.setItem('saha-rapor-gor', haftaBasi(today())); } catch {} e.target.closest('section').remove(); });
  el.querySelector('[data-yedekgit]')?.addEventListener('click', () => { try { sessionStorage.setItem('ayar-sekme', 'veri'); } catch {} });
  el.querySelector('[data-yakin]').onclick = () => yakinimdakiler();
  el.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
  el.querySelectorAll('[data-yapildi]').forEach(b => b.onclick = () => { ziyaretForm({ id: b.dataset.yapildi }); setTimeout(() => document.querySelector('[data-done]')?.click(), 200); });
  el.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.gid }));
  el.querySelectorAll('[data-done]').forEach(c => c.onchange = async () => { const g = byId('gorevler', c.dataset.done); try { const y = { ...g, durum: c.checked ? 'Tamam' : 'Açık', tamamlayan: c.checked ? ben || null : null }; await app.db.save('gorevler', y); import('../push.js').then(m => m.gorevBildir(g, y)); toast(c.checked ? 'Görev tamamlandı.' : 'Görev yeniden açıldı.'); } catch (e) { c.checked = !c.checked; toast('Kaydedilemedi: ' + e.message, 'err'); } app.refresh(); });
  el.querySelectorAll('[data-planla]').forEach(b => b.onclick = () => ziyaretForm({ firma_id: b.dataset.planla, durum: 'Planlandı', tarih: yarin }));
  el.querySelectorAll('[data-dg]').forEach(b => b.onclick = () => waGonder({ kisi: byId('kisiler', b.dataset.dg), sablonAdi: 'Doğum günü' }));
}

// ---------- Yakınımdakiler ----------
export async function yakinimdakiler() {
  const p = openDrawer(`<header class="dh"><div><p class="muted">Bulunduğun yere göre</p><h2 id="drawer-title">Yakınımdakiler</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><div class="frow"><div class="seg" role="group" aria-label="Mesafe">${[2, 5, 10, 25].map(k => `<button type="button" data-km="${k}" class="${k === 10 ? 'on' : ''}">${k} km</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Tür"><button type="button" data-tur="hepsi" class="on">Hepsi</button><button type="button" data-tur="firmalar">Firmalar</button><button type="button" data-tur="projeler">Projeler</button></div></div>
      <div data-list><p class="hint">Konum alınıyor…</p></div></div>`);
  let ben; try { ben = await myLocation(); } catch (e) { p.querySelector('[data-list]').innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
  let R = 10, tur = 'hepsi';
  const son = sonZiyaret();
  const ciz = () => {
    const l = [];
    for (const t of tur === 'hepsi' ? ['firmalar', 'projeler'] : [tur]) for (const r of S[t]) {
      if (r.lat == null || r.konum_yaklasik) continue;
      if (t === 'projeler' && !ACIK.includes(r.durum) && r.durum !== 'Sipariş') continue;
      const d = km(ben, [r.lat, r.lng]); if (d <= R) l.push({ t, r, d });
    }
    l.sort((a, b) => a.d - b.d);
    p.querySelector('[data-list]').innerHTML = l.length ? `<p class="hint">${l.length} kayıt · ${R} km içinde</p><ul class="list near">${l.slice(0, 60).map(({ t, r, d }) => `<li>
      <a href="#/${t === 'firmalar' ? 'firma' : 'proje'}/${r.id}"><b>${esc(r.ad)}</b><span class="muted">${d < 1 ? Math.round(d * 1000) + ' m' : num(Math.round(d * 10) / 10) + ' km'} · ${t === 'firmalar' ? esc((r.tipler || []).join(', ') || 'Firma') + (son.get(r.id) ? ` · son ziyaret ${tarih(son.get(r.id))}` : ' · ziyaret yok') : esc(r.durum) + (r.tutar_usd ? ' · ' + usd(r.tutar_usd) : '')}</span></a>
      <span class="ra"><a class="btn sm ghost" href="${directionsUrl(r.lat, r.lng)}" target="_blank" rel="noopener">Yol</a><button type="button" class="btn sm" data-z="${t}:${r.id}">Ziyaret</button></span></li>`).join('')}</ul>`
      : `<p class="hint">${R} km içinde haritada yeri işaretli kayıt yok. Mesafeyi büyüt ya da Harita → “Konum ata” ile projelerin yerini işaretle.</p>`;
    p.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const [tt, id] = b.dataset.z.split(':'); closeDrawer(); ziyaretForm(tt === 'firmalar' ? { firma_id: id } : { proje_id: id, firma_id: byId('projeler', id)?.emut_id || byId('projeler', id)?.alici_id || null }); });
  };
  p.querySelectorAll('[data-km]').forEach(b => b.onclick = () => { R = +b.dataset.km; p.querySelectorAll('[data-km]').forEach(x => x.classList.toggle('on', x === b)); ciz(); });
  p.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { tur = b.dataset.tur; p.querySelectorAll('[data-tur]').forEach(x => x.classList.toggle('on', x === b)); ciz(); });
  ciz();
}
