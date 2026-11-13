// Benzer kayıtlar: aynı telefon, e-posta, isim (kişi) ya da aynı ad, telefon, vergi no, web adresi (firma) taşıyan
// kayıtları bulur; iki kaydı alan alan yan yana gösterir. Kullanıcı her alan için hangi değerin kalacağını seçer ya da
// değeri elle düzeltir; sonra birleştirir, kartı açıp düzenler ya da "Farklı kayıtlar" diyerek bir daha göstermez.
import { S } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, confirmBox, firmaAd, byId, openDrawer, closeDrawer } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

const ROL = ['yatirimci_id', 'projeci_id', 'danisman_id', 'gemut_id', 'emut_id', 'alici_id', 'bayi_id'];
const tel = s => String(s || '').replace(/\D/g, '').slice(-10);
const kisiAdi = k => fold(k.ad_soyad || '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const firmaCekirdek = s => fold(s || '').replace(/\b(ltd|sti|şti|san|tic|ve|a ?s|aş|elk|elektrik|insaat|inşaat|muhendislik|mühendislik|enerji|proje|taahhut|taahhüt|limited|sirketi|şirketi|ithalat|ihracat|malz|ins|aydinlatma|aydınlatma)\b\.?/g, ' ').replace(/[^a-z0-9]/g, '');
const GENEL = /^(gmail|hotmail|yahoo|outlook|icloud|yandex|live|msn|mynet)\./;
const alanAdi = s => { const m = String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/@]/); const d = (String(s).includes('@') ? m[1] : m[0]) || ''; return d && !GENEL.test(d) && d.includes('.') ? d : ''; };
const ciftAnahtar = (a, b) => [a, b].sort().join('|');
const farkliSet = () => new Set(ayar('cift_farkli', []) || []);

// Gruplar: [{ kayitlar: [..], nedenler: Map('idA|idB' → ['aynı telefon', …]) }]
function grupla(tablo, liste, anahtarlar) {
  const farkli = farkliSet(), ciftler = new Map(), kova = new Map();
  for (const r of liste) for (const [ad, f] of anahtarlar) { const k = f(r); if (!k) continue; const kk = ad + ':' + k; (kova.get(kk) || kova.set(kk, []).get(kk)).push(r); }
  for (const [kk, l] of kova) {
    if (l.length < 2 || l.length > 12) continue;   // çok kalabalık anahtar (ör. "Ahmet") anlamsız
    const neden = kk.split(':')[0];
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const c = ciftAnahtar(l[i].id, l[j].id); if (farkli.has(tablo + ':' + c)) continue;
      const n = ciftler.get(c) || ciftler.set(c, { a: l[i], b: l[j], nedenler: new Set() }).get(c); n.nedenler.add(neden);
    }
  }
  // Birleşik gruplar (A~B, B~C → A,B,C)
  const ust = new Map(), bul = x => { while (ust.get(x) !== x) { ust.set(x, ust.get(ust.get(x))); x = ust.get(x); } return x; };
  for (const { a, b } of ciftler.values()) { for (const x of [a.id, b.id]) if (!ust.has(x)) ust.set(x, x); ust.set(bul(a.id), bul(b.id)); }
  const gruplar = new Map();
  for (const [c, v] of ciftler) { const r = bul(v.a.id); const g = gruplar.get(r) || gruplar.set(r, { kayitlar: new Map(), ciftler: [] }).get(r); g.kayitlar.set(v.a.id, v.a); g.kayitlar.set(v.b.id, v.b); g.ciftler.push({ ...v, nedenler: [...v.nedenler] }); }
  return [...gruplar.values()].map(g => ({ kayitlar: [...g.kayitlar.values()], ciftler: g.ciftler }));
}
export function kisiCiftleri() {
  return grupla('kisiler', S.kisiler || [], [
    ['aynı telefon', k => tel(k.telefon).length === 10 ? tel(k.telefon) : ''],
    ['aynı e-posta', k => String(k.eposta || '').trim().toLowerCase()],
    ['aynı isim', k => kisiAdi(k).length >= 5 && kisiAdi(k).includes(' ') ? kisiAdi(k) : ''],
  ]);
}
export function firmaCiftleri() {
  return grupla('firmalar', S.firmalar || [], [
    ['benzer ad', f => { const c = firmaCekirdek(f.ad); return c.length >= 3 ? c : ''; }],
    ['aynı telefon', f => tel(f.telefon).length === 10 ? tel(f.telefon) : ''],
    ['aynı vergi no', f => String(f.vergi_no || '').replace(/\D/g, '').length >= 10 ? String(f.vergi_no).replace(/\D/g, '') : ''],
    ['aynı web / e-posta adresi', f => alanAdi(f.web) || alanAdi(f.eposta)],
    ['aynı Google kaydı', f => f.google_place_id || ''],
  ]);
}
export const benzerSayisi = tablo => (tablo === 'kisiler' ? kisiCiftleri() : firmaCiftleri()).length;
export function benzerleri(tablo, id) {
  const g = (tablo === 'kisiler' ? kisiCiftleri() : firmaCiftleri()).find(g => g.kayitlar.some(r => r.id === id));
  return g ? g.ciftler.filter(c => c.a.id === id || c.b.id === id).map(c => ({ diger: c.a.id === id ? c.b : c.a, nedenler: c.nedenler })) : [];
}

// ---------- Bağlı kayıt sayıları (hangisi kalacak, ekranda gösterim) ----------
const KISI_BAG = { ziyaretler: ['kisi_id'], gorevler: ['kisi_id'], teklifler: ['kisi_id'], numuneler: ['kisi_id'], servis_kayitlari: ['kisi_id'], projeler: ['ilgili_kisi_id'] };
const FIRMA_BAG = { projeler: ROL, kisiler: ['firma_id'], ziyaretler: ['firma_id'], gorevler: ['firma_id'], siparisler: ['firma_id'], teklifler: ['firma_id'], numuneler: ['firma_id'], servis_kayitlari: ['firma_id'], tahsilatlar: ['firma_id'], belgeler: ['firma_id'] };
const AD = { ziyaretler: 'ziyaret', gorevler: 'görev', teklifler: 'teklif', numuneler: 'numune', servis_kayitlari: 'servis', projeler: 'proje', kisiler: 'kişi', siparisler: 'sipariş', tahsilatlar: 'fatura', belgeler: 'belge' };
const bagSay = (tablo, id) => Object.entries(tablo === 'kisiler' ? KISI_BAG : FIRMA_BAG).map(([t, al]) => [t, (S[t] || []).filter(r => al.some(a => r[a] === id)).length]).filter(x => x[1]);
const bagMetni = (tablo, id) => bagSay(tablo, id).map(([t, n]) => `${n} ${AD[t]}`).join(', ') || 'bağlı kayıt yok';

// ---------- Karşılaştırılan alanlar ----------
const KISI_ALAN = [['ad', 'Ad'], ['soyad', 'Soyad'], ['firma_id', 'Firma', 'firma'], ['unvan', 'Unvan'], ['telefon', 'Telefon'], ['eposta', 'E-posta'], ['web', 'İnternet sitesi'], ['adres', 'Adres'], ['rol', 'Karar rolü'], ['dogum_gunu', 'Doğum günü']];
const FIRMA_ALAN = [['ad', 'Firma adı'], ['il', 'İl'], ['ilce', 'İlçe'], ['adres', 'Adres'], ['telefon', 'Telefon'], ['eposta', 'E-posta'], ['web', 'İnternet sitesi'], ['vergi_no', 'Vergi no'], ['sektor', 'Sektör'], ['segment', 'Segment']];
const adBol = s => { const p = String(s || '').trim().split(/\s+/).filter(Boolean); return p.length < 2 ? { ad: p[0] || '', soyad: '' } : { ad: p.slice(0, -1).join(' '), soyad: p[p.length - 1] }; };
const deger = (tablo, r, k) => tablo === 'kisiler' && (k === 'ad' || k === 'soyad') && !r.ad && !r.soyad ? adBol(r.ad_soyad)[k] : r[k] ?? '';
const goster = (tur, v) => tur === 'firma' ? (firmaAd(v) || '') : String(v ?? '');
const ayni = (a, b) => fold(String(a ?? '')).replace(/\s+/g, ' ').trim() === fold(String(b ?? '')).replace(/\s+/g, ' ').trim() || (tel(a).length === 10 && tel(a) === tel(b));

// ---------- Benzer kayıtlar listesi ----------
export function benzerListesi(tablo) {
  const gruplar = tablo === 'kisiler' ? kisiCiftleri() : firmaCiftleri();
  const ad = r => tablo === 'kisiler' ? r.ad_soyad : r.ad;
  const alt = r => tablo === 'kisiler' ? [firmaAd(r.firma_id), r.telefon].filter(Boolean).join(' · ') : [r.il, r.telefon].filter(Boolean).join(' · ');
  const panel = openDrawer(`<header class="dh"><div><p class="muted">${tablo === 'kisiler' ? 'Kişiler' : 'Firmalar'}</p><h2 id="drawer-title">Benzer kayıtlar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">${gruplar.length ? `<p class="hint">Aynı ${tablo === 'kisiler' ? 'kişi' : 'firma'} iki kez kayıtlı olabilir. Karşılaştır: alan alan hangisinin kalacağını seç, birleştir; ya da farklıysa “Farklı kayıtlar” de.</p>
      <ul class="list cift-l">${gruplar.map(g => g.ciftler.map(c => `<li><span class="grow"><b>${esc(ad(c.a))}</b> <small class="muted">${esc(alt(c.a))}</small><br><b>${esc(ad(c.b))}</b> <small class="muted">${esc(alt(c.b))}</small><br><small class="cift-neden">${esc(c.nedenler.join(', '))}</small></span><button type="button" class="btn sm" data-kars="${c.a.id}|${c.b.id}">Karşılaştır</button></li>`).join('')).join('')}</ul>`
      : '<p>Benzer kayıt yok. 👍</p>'}</div>`);
  panel.querySelectorAll('[data-kars]').forEach(b => b.onclick = () => { const [x, y] = b.dataset.kars.split('|'); karsilastir(tablo, x, y, () => benzerListesi(tablo)); });
}

// ---------- Karşılaştırma ekranı ----------
export function karsilastir(tablo, idA, idB, sonra) {
  let A = byId(tablo, idA), B = byId(tablo, idB); if (!A || !B) return toast('Kayıt bulunamadı.', 'err');
  // Kalacak kayıt: bağlı kaydı çok olan (kimliği korunur; kullanıcı değiştirebilir)
  const toplam = r => bagSay(tablo, r.id).reduce((s, x) => s + x[1], 0);
  if (toplam(B) > toplam(A)) [A, B] = [B, A];
  const ALAN = tablo === 'kisiler' ? KISI_ALAN : FIRMA_ALAN, ad = r => tablo === 'kisiler' ? r.ad_soyad : r.ad;
  const yol = r => tablo === 'kisiler' ? `#/kisi/${r.id}` : `#/firma/${r.id}`;
  const satir = ([k, l, tur]) => {
    const a = deger(tablo, A, k), b = deger(tablo, B, k), va = goster(tur, a), vb = goster(tur, b);
    const sec = va && vb && !ayni(va, vb) ? (va.length >= vb.length ? 'a' : 'b') : (va ? 'a' : 'b');
    const sonuc = sec === 'a' ? va : vb;
    if (!va && !vb) return '';
    const ayniMi = ayni(va, vb) || !va || !vb;
    return `<div class="cift-alan ${ayniMi ? 'ayni' : 'fark'}" data-alan="${k}" data-tur="${tur || ''}"><div class="cift-baslik"><b>${l}</b>${ayniMi ? '<small class="muted">' + (va && vb ? 'aynı' : 'yalnız birinde') + '</small>' : '<small class="cift-neden">farklı — birini seç ya da düzelt</small>'}</div>
      ${ayniMi ? '' : `<div class="cift-sec" role="radiogroup" aria-label="${l}"><button type="button" class="chip ${sec === 'a' ? 'on' : ''}" data-v="a" role="radio" aria-checked="${sec === 'a'}">1: ${esc(va)}</button><button type="button" class="chip ${sec === 'b' ? 'on' : ''}" data-v="b" role="radio" aria-checked="${sec === 'b'}">2: ${esc(vb)}</button></div>`}
      ${tur === 'firma' ? `<input type="hidden" data-son value="${esc(sec === 'a' ? a : b)}"><div class="cift-sonuc">${esc(sonuc)}</div>` : `<input data-son value="${esc(sonuc)}" aria-label="${l} (birleşik)">`}</div>`;
  };
  const panel = openDrawer(`<header class="dh"><div><p class="muted">Benzer kayıtları karşılaştır</p><h2 id="drawer-title">${esc(ad(A))}${ayni(ad(A), ad(B)) ? '' : ' · ' + esc(ad(B))}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">
      <div class="cift-kayitlar">${[A, B].map((r, i) => `<div class="cift-kayit"><span class="cift-no">${i + 1}</span><span class="grow"><b>${esc(ad(r))}</b><small class="muted">${esc(bagMetni(tablo, r.id))}${i === 0 ? ' · kalacak kayıt' : ''}</small></span><a class="btn sm ghost" href="${yol(r)}" data-ac>Kartı aç</a></div>`).join('')}</div>
      <p class="hint">Her alanda kalacak değere dokun ya da kutudaki değeri düzelt. Birleştirince 2 numaralı kaydın ${tablo === 'kisiler' ? 'ziyaret, görev, teklif ve projeleri' : 'proje, kişi, ziyaret, sipariş ve belgeleri'} 1 numaraya taşınır, notlar ve ${tablo === 'kisiler' ? 'kartvizitler' : 'fotoğraflar, firma türleri'} birleştirilir, 2 numara silinir.</p>
      <div class="cift-alanlar">${ALAN.map(satir).join('')}</div>
      ${(A.notlar || B.notlar) ? `<div class="cift-alan ayni"><div class="cift-baslik"><b>Notlar</b><small class="muted">ikisi de korunur</small></div></div>` : ''}
    </div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-farkli>Farklı kayıtlar</button><button type="button" class="btn ghost" data-kaydet>Yalnız 1'i güncelle</button><button type="button" class="btn primary" data-birlestir>Birleştir</button></div>`, { wide: true });
  panel.querySelectorAll('.cift-alan').forEach(al => al.querySelectorAll('[data-v]').forEach(ch => ch.onclick = () => {
    al.querySelectorAll('[data-v]').forEach(x => { x.classList.toggle('on', x === ch); x.setAttribute('aria-checked', x === ch); });
    const k = al.dataset.alan, tur = al.dataset.tur, r = ch.dataset.v === 'a' ? A : B, v = deger(tablo, r, k);
    al.querySelector('[data-son]').value = v ?? ''; const s = al.querySelector('.cift-sonuc'); if (s) s.textContent = goster(tur, v);
  }));
  const secilen = () => { const o = {}; panel.querySelectorAll('.cift-alan[data-alan]').forEach(al => { const v = al.querySelector('[data-son]').value.trim(); o[al.dataset.alan] = v || null; }); return o; };
  const uygula = o => { const x = { ...A, ...o }; if (tablo === 'kisiler') { x.ad_soyad = [x.ad, x.soyad].filter(Boolean).join(' ') || A.ad_soyad; } else if (!x.ad) x.ad = A.ad; return x; };
  panel.querySelector('[data-farkli]').onclick = async () => {
    const l = ayar('cift_farkli', []) || []; l.push(tablo + ':' + ciftAnahtar(A.id, B.id)); await ayarYaz('cift_farkli', [...new Set(l)]);
    toast('Bu iki kayıt bir daha benzer olarak gösterilmeyecek.'); closeDrawer(); sonra?.();
  };
  panel.querySelector('[data-kaydet]').onclick = async () => {
    try { await app.db.save(tablo, uygula(secilen())); toast('1 numaralı kayıt güncellendi; ikisi de duruyor.'); closeDrawer(); app.refresh?.(); sonra?.(); } catch (e) { toast(e.message, 'err'); }
  };
  panel.querySelector('[data-birlestir]').onclick = async e => {
    if (!confirmBox(`“${ad(B)}” kaydı “${ad(A)}” ile birleştirilecek ve silinecek. Bağlı kayıtları taşınacak. Devam edilsin mi?`)) return;
    e.target.disabled = true;
    try {
      const yeni = uygula(secilen());
      // Kullanıcının seçmediği değerler kaybolmasın: 2'nin farklı telefonu ve notları 1'in notlarına eklenir
      if (tablo === 'kisiler' && B.telefon && yeni.telefon && tel(B.telefon) !== tel(yeni.telefon)) yeni.notlar = [yeni.notlar, 'Diğer telefon: ' + B.telefon].filter(Boolean).join('\n');
      if (B.notlar && B.notlar !== yeni.notlar) yeni.notlar = [yeni.notlar, B.notlar].filter(Boolean).join('\n');
      if (tablo === 'kisiler') { for (const a of ['kartvizit_on', 'kartvizit_arka']) if (!yeni[a] && B[a]) yeni[a] = B[a]; }
      else { yeni.tipler = [...new Set([...(A.tipler || []), ...(B.tipler || [])])]; yeni.fotolar = [...new Set([...(A.fotolar || []), ...(B.fotolar || [])])]; if (yeni.lat == null && B.lat != null) Object.assign(yeni, { lat: B.lat, lng: B.lng, konum_yaklasik: B.konum_yaklasik }); for (const a of ['belde', 'osb', 'google_place_id', 'google_url', 'bolge_id']) if (!yeni[a] && B[a]) yeni[a] = B[a]; }
      await app.db.save(tablo, yeni);
      const BAG = tablo === 'kisiler' ? KISI_BAG : FIRMA_BAG;
      for (const [t, alan] of Object.entries(BAG)) for (const r of (S[t] || []).filter(r => alan.some(a => r[a] === B.id))) { const o = { ...r }; for (const a of alan) if (o[a] === B.id) o[a] = A.id; await app.db.save(t, o); }
      await app.db.del(tablo, B.id);
      toast('Kayıtlar birleştirildi.'); closeDrawer(); app.refresh?.(); sonra?.();
    } catch (err) { toast('Birleştirilemedi: ' + err.message, 'err'); e.target.disabled = false; }
  };
  panel.querySelectorAll('[data-ac]').forEach(a => a.addEventListener('click', () => closeDrawer()));
}
