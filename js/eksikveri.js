// Günlük eksik veri kartı: Bugün ekranında her gün en fazla 3 kısa soru; cevap yerinde verilir, tek dokunuşla kaydedilir.
// Radar, kayıp analizi ve tahminler ancak bu alanlar doldukça doğru çalışır. "Atla" o soruyu 30 gün sormaz.
import { S } from './db.js';
import { app } from './state.js';
import { esc, usd, tarih, today, gunEkle, byId, firmaAd, toast, ACIK, RAKIPLER, KAYIP_NEDENLERI } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { ozellikSay } from './saglik.js';

const GUNLUK = 3;
const ROL = ['emut_id', 'gemut_id', 'alici_id', 'bayi_id', 'projeci_id', 'danisman_id', 'yatirimci_id'];
const atlananlar = () => { const a = ayar('eksik_atla') || {}, t = today(); return Object.fromEntries(Object.entries(a).filter(([, d]) => d > t)); };
const sayac = () => { try { const o = JSON.parse(localStorage.getItem('saha-eksik-gun') || 'null'); return o?.g === today() ? o : { g: today(), n: 0, ek: 0 }; } catch { return { g: today(), n: 0, ek: 0 }; } };
const sayacYaz = o => { try { localStorage.setItem('saha-eksik-gun', JSON.stringify(o)); } catch {} };
// Günün sırası: önce önem, eşitlerde güne göre karışık (her gün aynı sorular üst üste gelmesin)
const karis = (k, g) => { let h = 0; for (const c of k + g) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };

export function sorular() {
  const Y = new Date().getFullYear(), t = today(), P = S.projeler.filter(p => !p.aday), l = [];
  const pAd = p => `<a href="#/proje/${p.id}"><b>${esc(p.ad)}</b></a>`;
  for (const p of P.filter(p => p.durum === 'Kayıp' && (!p.kayip_nedeni || !p.rakip_marka)))
    l.push({ k: 'kayip:' + p.id, t: 'projeler', id: p.id, onem: 3 + (+p.tutar_usd || 0) / 1e5, soru: `${pAd(p)} projesini neden ve kime kaybettik?`,
      alan: `${!p.kayip_nedeni ? `<select data-a="kayip_nedeni" aria-label="Kayıp nedeni"><option value="">Neden?</option>${KAYIP_NEDENLERI.map(n => `<option>${n}</option>`).join('')}</select>` : ''}${!p.rakip_marka ? `<input data-a="rakip_marka" list="ev-rakip" placeholder="İşi alan marka" aria-label="İşi alan marka">` : ''}<button type="button" class="btn sm primary" data-kaydet>Kaydet</button>` });
  for (const p of P.filter(p => ACIK.includes(p.durum) && !+p.tutar_usd))
    l.push({ k: 'tutar:' + p.id, t: 'projeler', id: p.id, onem: ['Sıcak', 'İhale', 'Teklif Verildi'].includes(p.durum) ? 3.5 : 2, soru: `${pAd(p)} (${esc(p.durum)}) için aydınlatma tutarı yaklaşık ne kadar?`,
      alan: `<input data-a="tutar_usd" type="number" min="0" step="1000" inputmode="numeric" placeholder="USD" aria-label="Tutar (USD)"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button>` });
  for (const p of P.filter(p => ACIK.includes(p.durum) && p.beklenen_tarih && p.beklenen_tarih < gunEkle(t, -60)))
    l.push({ k: 'gecikti:' + p.id, t: 'projeler', id: p.id, onem: 3 + (+p.tutar_usd || 0) / 2e5, soru: `${pAd(p)}: beklenen sipariş tarihi ${tarih(p.beklenen_tarih)} idi. Durum ne?`,
      alan: `<button type="button" class="btn sm" data-hizli='{"beklenen_tarih":"${gunEkle(t, 30)}"}'>1 ay ileri at</button><button type="button" class="btn sm" data-hizli='{"durum":"Beklemede"}'>Beklemede</button><button type="button" class="btn sm ghost" data-kayip>Kaybettik</button>` });
  for (const p of P.filter(p => ACIK.includes(p.durum) && !p.takip_yili))
    l.push({ k: 'yil:' + p.id, t: 'projeler', id: p.id, onem: 1.5, soru: `${pAd(p)} hangi yıl takip ediliyor?`,
      alan: [Y, Y + 1, Y + 2].map(y => `<button type="button" class="btn sm" data-hizli='{"takip_yili":${y}}'>${y}</button>`).join('') });
  const aktif = new Set(); for (const p of P) if (ACIK.includes(p.durum) || p.durum === 'Sipariş') for (const r of ROL) if (p[r]) aktif.add(p[r]);
  for (const f of S.firmalar.filter(f => aktif.has(f.id) && !f.segment))
    l.push({ k: 'segment:' + f.id, t: 'firmalar', id: f.id, onem: 1.8, soru: `<a href="#/firma/${f.id}"><b>${esc(f.ad)}</b></a> senin için ne kadar önemli?`,
      alan: [['A', 'A: kilit'], ['B', 'B: düzenli'], ['C', 'C: ara sıra']].map(([v, a]) => `<button type="button" class="btn sm" data-hizli='{"segment":"${v}"}'>${a}</button>`).join('') });
  // İçerideyken: firmanın konumu yoksa buradan kaydet
  const ic = (S.ziyaretler || []).find(z => z.giris && !z.cikis && z.lat != null), fi = ic && byId('firmalar', ic.firma_id);
  if (fi && fi.lat == null) l.push({ k: 'konum:' + fi.id, t: 'firmalar', id: fi.id, onem: 9, soru: `Şu an <b>${esc(fi.ad)}</b>'dasın ve firmanın haritada yeri yok. Girişteki konum firmanın yeri olarak kaydedilsin mi?`,
    alan: `<button type="button" class="btn sm primary" data-hizli='{"lat":${ic.lat},"lng":${ic.lng},"konum_yaklasik":false}'>Evet, kaydet</button>` });
  const a = atlananlar(), g = today();
  return l.filter(x => !a[x.k]).sort((x, y) => Math.round(y.onem) - Math.round(x.onem) || karis(x.k, g) - karis(y.k, g));
}

export function eksikKarti() {
  if (!app.db || !S.projeler.length) return '';
  const s = sayac(), l = sorular(), kalan = Math.max(0, GUNLUK + s.ek - s.n);
  if (!l.length) return '';
  if (!kalan) return `<section class="card eksik-k" data-eksik><div class="card-h"><h2>Bugünün soruları</h2></div><p class="hint">Bugünlük bu kadar, teşekkürler. ${l.length} eksik daha var.</p><div class="btnrow"><button type="button" class="btn sm ghost" data-birdaha>Bir tane daha</button><a class="btn sm ghost" href="#/kontrol">Veri kontrolü</a></div></section>`;
  const g = l.slice(0, Math.min(kalan, 3));
  return `<section class="card eksik-k" data-eksik><div class="card-h"><h2>Bugünün soruları <span class="muted">${s.n}/${GUNLUK + s.ek}</span></h2></div>
    <p class="hint">Radar, kayıp analizi ve tahminler bu bilgilerle doğru çalışır. Her gün en fazla ${GUNLUK} soru.</p>
    <datalist id="ev-rakip">${RAKIPLER.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
    <ul class="eksik-l">${g.map(x => `<li data-ek="${esc(x.k)}"><p>${x.soru}</p><div class="eksik-a">${x.alan}<button type="button" class="linkbtn" data-atla title="30 gün sorma">Atla</button></div></li>`).join('')}</ul></section>`;
}

export function eksikBagla(kok, yenile) {
  const k = kok.querySelector('[data-eksik]'); if (!k) return;
  const bul = key => sorular().find(x => x.k === key);
  const bitti = async (x, alan) => {
    const r = byId(x.t, x.id); if (!r) return;
    if (x.t === 'projeler' && alan.durum) { const { durumDegistir } = await import('./views/projeler.js'); if (!await durumDegistir(r, alan.durum)) return; }
    else try { await app.db.save(x.t, { ...r, ...alan }); } catch (e) { return toast('Kaydedilemedi: ' + e.message, 'err'); }
    const s = sayac(); s.n++; sayacYaz(s); ozellikSay('eksik-veri'); toast('Kaydedildi.'); yenile?.();
  };
  k.querySelectorAll('li[data-ek]').forEach(li => {
    const x = () => bul(li.dataset.ek);
    li.querySelectorAll('[data-hizli]').forEach(b => b.onclick = () => { const q = x(); if (q) bitti(q, JSON.parse(b.dataset.hizli)); });
    li.querySelector('[data-kaydet]')?.addEventListener('click', () => {
      const q = x(); if (!q) return; const alan = {};
      li.querySelectorAll('[data-a]').forEach(i => { const v = i.value.trim(); if (v) alan[i.dataset.a] = i.type === 'number' ? +v : v; });
      if (!Object.keys(alan).length) return toast('Bir değer seç ya da yaz.', 'err');
      bitti(q, alan);
    });
    li.querySelector('[data-kayip]')?.addEventListener('click', () => { const q = x(); if (q) bitti(q, { durum: 'Kayıp' }); });
    li.querySelector('[data-atla]').onclick = async () => { await ayarYaz('eksik_atla', { ...atlananlar(), [li.dataset.ek]: gunEkle(today(), 30) }); yenile?.(); };
  });
  k.querySelector('[data-birdaha]')?.addEventListener('click', () => { const s = sayac(); s.ek++; sayacYaz(s); yenile?.(); });
}
