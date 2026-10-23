// Veri kontrolü: eksik, çelişkili ya da mükerrer kayıtları bulur; tek dokunuşla düzeltme
import { S } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, usd, num, tarih, today, gunEkle, byId, firmaAd, toast, confirmBox, ACIK, fold, pill, exportXlsx } from '../ui.js';
import { siparisForm, projeBul } from './panel.js';
import { durumDegistir } from './projeler.js';
import { ceyrekGercek } from '../ceyrek.js';

const cekirdek = s => fold(s || '').replace(/\b(ltd|sti|şti|san|tic|ve|a ?s|aş|elk|elektrik|insaat|inşaat|muhendislik|mühendislik|enerji|proje|taahhut|taahhüt|limited|sirketi|şirketi|ithalat|ihracat|malz|ins)\b\.?/g, ' ').replace(/[^a-z0-9]/g, '');
const ROL = ['yatirimci_id', 'projeci_id', 'danisman_id', 'gemut_id', 'emut_id', 'alici_id', 'bayi_id'];
const sipVar = p => S.siparisler.some(s => s.proje_id === p.id && !s.rapor_disi);

// SAP proje tanımı ve SAS no'daki kelimelerden proje önerisi
const GENEL = /genel proje|bolge genel|stok|depo$/;
const kelimeler = s => fold(s || '').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 3 && !/^(drv|ekol|elk|elektrik|proje|ltd|sti|san|tic|bolge|genel|adana|mersin|hatay|osmaniye|\d+)$/.test(w));
export function oneriProje(s) {
  const p0 = projeBul(s.proje_tanimi); if (p0) return p0;
  const metin = new Set([...kelimeler(s.proje_tanimi), ...kelimeler(s.referans)]); if (!metin.size || GENEL.test(fold(s.proje_tanimi || ''))) return null;
  let en = null, puan = 0;
  for (const p of S.projeler) { const pk = kelimeler(p.ad); if (!pk.length) continue; const ort = pk.filter(w => metin.has(w)).length; const sc = ort / pk.length; if (ort && sc > puan) { puan = sc; en = p; } }
  return puan >= 0.6 ? en : null;
}

export function kontroller() {
  const t = today(), Y = new Date().getFullYear();
  const P = S.projeler.filter(p => !p.aday), acik = P.filter(p => ACIK.includes(p.durum));
  const k = [];
  const ekle = (id, grup, baslik, aciklama, kayitlar, satir) => k.push({ id, grup, baslik, aciklama, kayitlar, satir });
  const pLink = p => `<a href="#/proje/${p.id}"><b>${esc(p.ad)}</b></a>`;
  ekle('sip-yok', 'Projeler', 'Durumu “Sipariş” ama siparişi yok', 'Sipariş listesinde bu projeye bağlı sipariş yok ve sipariş tutarı da girilmemiş. Siparişi bağla ya da durumu düzelt.',
    P.filter(p => p.durum === 'Sipariş' && !sipVar(p) && !p.siparis_tutari_usd), p => `${pLink(p)}<span class="muted">${usd(p.tutar_usd)} · ${esc(firmaAd(p.alici_id) || firmaAd(p.emut_id) || '')}</span>`);
  ekle('sip-acik', 'Projeler', 'Siparişi gelmiş ama hâlâ açık görünen projeler', 'Bağlı siparişi olduğu hâlde durumu açık aşamada.',
    acik.filter(sipVar), p => `${pLink(p)}${pill(p.durum)}<button type="button" class="btn sm" data-sipyap="${p.id}">Sipariş yap</button>`);
  ekle('kayip', 'Projeler', 'Kayıp nedeni ya da işi alan marka eksik', 'Kayıp analizinde ve çeyrek sunumunda boş görünüyor.',
    P.filter(p => p.durum === 'Kayıp' && (!p.kayip_nedeni || !p.rakip_marka)), p => `${pLink(p)}<span class="muted">${[!p.kayip_nedeni && 'neden yok', !p.rakip_marka && 'marka yok'].filter(Boolean).join(', ')}</span>`);
  ekle('tutar', 'Projeler', 'Açık projede tutar yok', 'Potansiyel ve tahmin hesaplarına katılmıyor.', acik.filter(p => !+p.tutar_usd), p => `${pLink(p)}${pill(p.durum)}`);
  ekle('yil', 'Projeler', 'Takip yılı boş', 'Yıl listelerinde ve sunumda çıkmıyor.', P.filter(p => !p.takip_yili), p => `${pLink(p)}${pill(p.durum)}`);
  ekle('gecmis', 'Projeler', 'Beklenen sipariş tarihi 60 günden fazla geçmiş', 'Tarihi güncelle ya da durumu Beklemede / Kayıp yap.',
    acik.filter(p => p.beklenen_tarih && p.beklenen_tarih < gunEkle(t, -60)), p => `${pLink(p)}<span class="muted">${tarih(p.beklenen_tarih)}</span>`);
  ekle('paydas', 'Projeler', 'Hiç paydaşı olmayan açık projeler', 'Yatırımcı, müteahhit, alıcı ya da bayi seçilmemiş.', acik.filter(p => !ROL.some(r => p[r])), p => `${pLink(p)}${pill(p.durum)}`);
  // Siparişler
  const sY = S.siparisler.filter(s => s.tarih?.startsWith(String(Y)) || s.tarih?.startsWith(String(Y - 1)));
  const sLink = s => `<button type="button" class="linkrow" data-sp="${s.id}"><b>${esc(s.siparis_no || 'Sipariş')} · ${esc(s.referans || s.musteri_adi || '')}</b><span class="muted">${tarih(s.tarih)} · ${num(s.net_deger)} ${esc(s.para_birimi)}</span></button>`;
  ekle('sip-proje', 'Siparişler', 'Projeye bağlı olmayan siparişler', 'Proje bazında toplamlarda ve proje kartında görünmüyor. Önerilen proje varsa “Bağla” ile eşleştir.',
    sY.filter(s => !s.proje_id && !s.rapor_disi).map(s => ({ ...s, _oneri: oneriProje(s) })).sort((a, b) => !!b._oneri - !!a._oneri),
    s => `${sLink(s)}${s._oneri ? `<button type="button" class="btn sm" data-bagla="${s.id}:${s._oneri.id}">Bağla: ${esc(s._oneri.ad)}</button>` : `<span class="muted">${esc(s.proje_tanimi || '')}</span>`}`);
  ekle('sip-cari', 'Siparişler', 'Carisi firma listesinde olmayan siparişler', 'Firma kartında ve karnede görünmüyor. Siparişi açıp cariyi seç.', sY.filter(s => !s.firma_id), s => `${sLink(s)}<span class="muted">${esc(s.musteri_adi || '')}</span>`);
  const noSay = new Map(); for (const s of S.siparisler) if (s.siparis_no) noSay.set(s.siparis_no, (noSay.get(s.siparis_no) || 0) + 1);
  const imza = new Map(); for (const s of S.siparisler) { const i = [s.tarih, s.firma_id || s.musteri_adi, s.net_deger].join('|'); imza.set(i, (imza.get(i) || 0) + 1); }
  ekle('sip-mukerrer', 'Siparişler', 'Mükerrer olabilecek siparişler', 'Aynı sipariş numarası ya da aynı gün, aynı cari ve aynı tutar. Gerçekten mükerrerse “Rapor dışı” yap.',
    S.siparisler.filter(s => !s.rapor_disi && ((s.siparis_no && noSay.get(s.siparis_no) > 1) || imza.get([s.tarih, s.firma_id || s.musteri_adi, s.net_deger].join('|')) > 1)), s => `${sLink(s)}<button type="button" class="btn sm ghost" data-disi="${s.id}">Rapor dışı yap</button>`);
  ekle('sip-sifir', 'Siparişler', 'Tutarı sıfır olan siparişler', 'Numune, ihraç kayıtlı ya da bedelsiz olabilir; toplamları etkilemez.', S.siparisler.filter(s => !+s.net_deger && !s.rapor_disi), sLink);
  // Çeyrekler
  const bu = Math.floor(new Date().getMonth() / 3) + 1;
  ekle('ceyrek', 'Çeyrekler', 'Resmi rakamı girilmemiş geçmiş çeyrekler', 'Siparişler ekranı → Çeyrek özeti. Resmi rakam girilince raporlar onu kullanır; girilmezse siparişlerden hesaplanır.',
    [1, 2, 3, 4].filter(c => c < bu).map(c => ({ c, ...ceyrekGercek(Y, c) })).filter(g => g.resmi == null), g => `<a href="#/siparisler" data-cozet="${g.c}"><b>${Y} ${g.c}. çeyrek</b></a><span class="muted">siparişlerden ${usd(g.siparis)}</span>`);
  // Firmalar
  const gr = new Map(); for (const f of S.firmalar) { const c = cekirdek(f.ad); if (c.length >= 3) (gr.get(c) || gr.set(c, []).get(c)).push(f); }
  ekle('firma-cift', 'Firmalar', 'Aynı firma iki kez kayıtlı olabilir', 'Adları benziyor. Aynı firmaysa birleştir: projeler, kişiler, ziyaretler ve siparişler tek kayda taşınır.',
    [...gr.values()].filter(l => l.length > 1), l => `<span class="grow">${l.map(f => `<a href="#/firma/${f.id}">${esc(f.ad)}</a>`).join(' · ')}</span><button type="button" class="btn sm" data-birlestir="${l.map(f => f.id).join(',')}">Birleştir</button>`);
  ekle('konum', 'Firmalar', 'Haritada yeri işaretli olmayan aktif firmalar', 'Rota ve Yakınımdakiler için konum gerekir. Harita → Google\'da ara ile hızlıca eklenebilir.',
    S.firmalar.filter(f => f.lat == null && P.some(p => ACIK.includes(p.durum) && ROL.some(r => p[r] === f.id))), f => `<a href="#/firma/${f.id}"><b>${esc(f.ad)}</b></a>`);
  // Kişiler: aynı ad (aynı firmada ya da firmasız) ya da aynı telefon
  const tel = s => String(s || '').replace(/\D/g, '').slice(-10);
  const kAd = k => fold(k.ad_soyad || '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const kg = new Map(), ekleG = (anahtar, k) => { if (!anahtar) return; (kg.get(anahtar) || kg.set(anahtar, new Set()).get(anahtar)).add(k); };
  for (const x of S.kisiler) { const a = kAd(x); if (a.length >= 5) ekleG('ad:' + a + '|' + (x.firma_id || '-'), x); if (tel(x.telefon).length === 10) ekleG('tel:' + tel(x.telefon), x); }
  // firmasız kişi aynı adlı firmalı kişiyle de eşleşir
  for (const x of S.kisiler.filter(x => !x.firma_id)) for (const y of S.kisiler) if (y !== x && y.firma_id && kAd(y) === kAd(x) && kAd(x).length >= 5) ekleG('ad:' + kAd(x) + '|' + y.firma_id, x);
  const gorulen = new Set(), kGruplar = [];
  for (const set of kg.values()) { const l = [...set]; if (l.length < 2) continue; const anahtar = l.map(k => k.id).sort().join(','); if (gorulen.has(anahtar)) continue; gorulen.add(anahtar); kGruplar.push(l); }
  ekle('kisi-cift', 'Kişiler', 'Aynı kişi iki kez kayıtlı olabilir', 'Adı (aynı firmada) ya da telefonu aynı. Aynı kişiyse birleştir: ziyaretler, görevler, teklifler, numuneler tek kayda taşınır, eksik bilgiler tamamlanır.',
    kGruplar, l => `<span class="grow">${l.map(x => `<a href="#/kisi/${x.id}">${esc(x.ad_soyad)}</a><small class="muted"> ${esc([firmaAd(x.firma_id), x.telefon].filter(Boolean).join(' · '))}</small>`).join(' · ')}</span><button type="button" class="btn sm" data-kbirlestir="${l.map(x => x.id).join(',')}">Birleştir</button>`);
  return k;
}

// Kişileri tek kayda birleştirir (ilk kayıt kalır)
export async function kisiBirlestir(kalanId, gidenIds) {
  const kalan = { ...byId('kisiler', kalanId) };
  const BAG = { ziyaretler: ['kisi_id'], gorevler: ['kisi_id'], teklifler: ['kisi_id'], numuneler: ['kisi_id'], servis_kayitlari: ['kisi_id'], projeler: ['ilgili_kisi_id'] };
  for (const gid of gidenIds) {
    const g = byId('kisiler', gid); if (!g) continue;
    for (const [t, alan] of Object.entries(BAG)) for (const r of (S[t] || []).filter(r => alan.some(a => r[a] === gid))) { const o = { ...r }; for (const a of alan) if (o[a] === gid) o[a] = kalanId; await app.db.save(t, o); }
    for (const a of ['firma_id', 'unvan', 'telefon', 'eposta', 'rol', 'kartvizit_on', 'kartvizit_arka', 'dogum_gunu']) if (!kalan[a] && g[a]) kalan[a] = g[a];
    if (g.telefon && kalan.telefon && g.telefon.replace(/\D/g, '') !== kalan.telefon.replace(/\D/g, '')) kalan.notlar = [kalan.notlar, 'Diğer telefon: ' + g.telefon].filter(Boolean).join('\n');
    if (g.notlar && g.notlar !== kalan.notlar) kalan.notlar = [kalan.notlar, g.notlar].filter(Boolean).join('\n');
    await app.db.save('kisiler', kalan); await app.db.del('kisiler', gid);
  }
}

// İki ya da daha fazla firmayı tek kayda birleştirir (ilk kayıt kalır)
export async function firmaBirlestir(kalanId, gidenIds) {
  const kalan = byId('firmalar', kalanId);
  const BAG = { projeler: ROL, kisiler: ['firma_id'], ziyaretler: ['firma_id'], gorevler: ['firma_id'], siparisler: ['firma_id'], teklifler: ['firma_id'], numuneler: ['firma_id'], servis_kayitlari: ['firma_id'], tahsilatlar: ['firma_id'], belgeler: ['firma_id'] };
  for (const gid of gidenIds) {
    const g = byId('firmalar', gid); if (!g) continue;
    for (const [t, alan] of Object.entries(BAG)) for (const r of S[t].filter(r => alan.some(a => r[a] === gid))) { const o = { ...r }; for (const a of alan) if (o[a] === gid) o[a] = kalanId; await app.db.save(t, o); }
    const birlesik = { ...kalan, tipler: [...new Set([...(kalan.tipler || []), ...(g.tipler || [])])], fotolar: [...new Set([...(kalan.fotolar || []), ...(g.fotolar || [])])], notlar: [kalan.notlar, g.notlar].filter(Boolean).join('\n') || null };
    for (const a of ['il', 'ilce', 'belde', 'osb', 'adres', 'telefon', 'eposta', 'web', 'vergi_no', 'sektor', 'google_place_id', 'google_url']) if (!birlesik[a] && g[a]) birlesik[a] = g[a];
    if (birlesik.lat == null && g.lat != null) Object.assign(birlesik, { lat: g.lat, lng: g.lng, konum_yaklasik: g.konum_yaklasik });
    Object.assign(kalan, birlesik); await app.db.save('firmalar', kalan);
    await app.db.del('firmalar', gid);
  }
}

export function kontrolView(el) {
  const f = F('kontrol', { acik: null });
  const K = kontroller(), sorun = K.filter(x => x.kayitlar.length);
  el.innerHTML = `<header class="vh"><div><h1>Veri kontrolü</h1><p class="sum">${sorun.length ? `${sorun.length} başlıkta ${sorun.reduce((a, x) => a + x.kayitlar.length, 0)} kayıt gözden geçirilmeli` : 'Sorun bulunmadı'}</p></div><div class="vh-act"><button class="btn ghost" data-xls>Excel</button></div></header>
    ${['Projeler', 'Siparişler', 'Çeyrekler', 'Firmalar', 'Kişiler'].map(g => `<section class="kontrol-grup"><h2>${g}</h2>${K.filter(x => x.grup === g).map(x => `<details class="card kontrol" data-k="${x.id}" ${f.acik === x.id ? 'open' : ''}>
      <summary><span class="kb ${x.kayitlar.length ? 'var' : 'yok'}">${x.kayitlar.length || '✓'}</span><b>${esc(x.baslik)}</b></summary>
      ${x.kayitlar.length ? `<p class="hint">${esc(x.aciklama)}</p><ul class="list">${x.kayitlar.slice(0, 40).map(r => `<li>${x.satir(r)}</li>`).join('')}</ul>${x.kayitlar.length > 40 ? `<p class="hint">+${x.kayitlar.length - 40} kayıt daha</p>` : ''}` : '<p class="hint">Sorun yok.</p>'}</details>`).join('')}</section>`).join('')}`;
  el.querySelector('[data-xls]').onclick = () => exportXlsx(`veri-kontrolu-${today()}.xlsx`, { 'Kontrol': sorun.flatMap(x => x.kayitlar.map(r => ({ 'Grup': x.grup, 'Sorun': x.baslik, 'Kayıt': Array.isArray(r) ? r.map(f => f.ad).join(' / ') : r.ad || [r.siparis_no, r.referans || r.musteri_adi].filter(Boolean).join(' · ') || (r.c ? r.c + '. çeyrek' : ''), 'Durum / tarih': r.durum || r.tarih || r.beklenen_tarih || '', 'Tutar': r.tutar_usd || r.net_deger || '' }))) });
  el.querySelectorAll('details[data-k]').forEach(d => d.ontoggle = () => { if (d.open) { f.acik = d.dataset.k; saveFilters(); } });
  el.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => siparisForm({ id: b.dataset.sp }));
  el.querySelectorAll('[data-sipyap]').forEach(b => b.onclick = async () => { if (await durumDegistir(byId('projeler', b.dataset.sipyap), 'Sipariş')) kontrolView(el); });
  el.querySelectorAll('[data-bagla]').forEach(b => b.onclick = async () => { const [sid, pid] = b.dataset.bagla.split(':'); await app.db.save('siparisler', { ...byId('siparisler', sid), proje_id: pid }); toast('Sipariş projeye bağlandı.'); kontrolView(el); });
  el.querySelectorAll('[data-disi]').forEach(b => b.onclick = async () => { await app.db.save('siparisler', { ...byId('siparisler', b.dataset.disi), rapor_disi: true }); toast('Sipariş rapor dışı bırakıldı.'); kontrolView(el); });
  el.querySelectorAll('[data-cozet]').forEach(a => a.onclick = () => { const fs = F('siparisler', {}); fs.gor = 'ceyrek'; fs.yil = new Date().getFullYear(); saveFilters(); });
  el.querySelectorAll('[data-kbirlestir]').forEach(b => b.onclick = async () => {
    const ks = b.dataset.kbirlestir.split(',').map(i => byId('kisiler', i)).filter(Boolean);
    const say = x => ['ziyaretler', 'gorevler', 'teklifler'].reduce((a, t) => a + S[t].filter(r => r.kisi_id === x.id).length, 0) + (x.telefon ? 1 : 0) + (x.eposta ? 1 : 0) + (x.firma_id ? 1 : 0);
    ks.sort((a, c) => say(c) - say(a));
    if (!confirmBox(`Şu kişiler “${ks[0].ad_soyad}” adıyla tek kayıt olacak:\n${ks.map(x => '• ' + x.ad_soyad + (x.telefon ? ' · ' + x.telefon : '')).join('\n')}\n\nBağlı ziyaret, görev ve teklifler taşınır. Devam edilsin mi?`)) return;
    b.disabled = true;
    try { await kisiBirlestir(ks[0].id, ks.slice(1).map(x => x.id)); toast(`${ks.length} kayıt birleştirildi.`); } catch (e) { toast('Birleştirilemedi: ' + e.message, 'err'); }
    kontrolView(el);
  });
  el.querySelectorAll('[data-birlestir]').forEach(b => b.onclick = async () => {
    const ids = b.dataset.birlestir.split(','), fs = ids.map(i => byId('firmalar', i));
    const say = f => S.projeler.filter(p => ROL.some(r => p[r] === f.id)).length + S.siparisler.filter(s => s.firma_id === f.id).length + S.kisiler.filter(k => k.firma_id === f.id).length;
    fs.sort((a, b) => say(b) - say(a));
    if (!confirmBox(`Şu firmalar “${fs[0].ad}” adıyla tek kayıt olacak:\n${fs.map(f => '• ' + f.ad).join('\n')}\n\nBağlı projeler, kişiler, ziyaretler, siparişler taşınır. Devam edilsin mi?`)) return;
    b.disabled = true; toast('Birleştiriliyor…');
    try { await firmaBirlestir(fs[0].id, fs.slice(1).map(f => f.id)); toast(`${fs.length} kayıt “${fs[0].ad}” altında birleştirildi.`); } catch (e) { toast('Birleştirilemedi: ' + e.message, 'err'); }
    kontrolView(el);
  });
}
