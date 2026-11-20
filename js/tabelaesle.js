// Şantiye tabelasından okunan bilgilerin projeye işlenmesi: eşleştirme ekranı.
// Tabeladaki her isim bir satırdır: kayıtlı firma / kişi bulunduysa bağlanır (benzer adaylar listelenir), yoksa yeni kayıt açılır ya da atlanır.
// Ruhsat, ada / parsel, yapı denetim ve müellifler projenin kendi alanlarına yazılır; konum fotoğrafın GPS bilgisinden alınır;
// aynı ruhsat ya da ada / parsel ile kayıtlı proje varsa uyarılır. Kayıtlı projede "Tabeladan doldur" yalnızca boş alanları doldurur.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, closeDrawer, fold, ILLER, byId, today } from './ui.js';

// ---------- Fotoğrafın GPS konumu (JPEG EXIF) ----------
export async function exifKonum(file) {
  try {
    const b = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (b.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < b.byteLength) {
      const m = b.getUint16(o), uz = b.getUint16(o + 2);
      if (m === 0xFFE1 && b.getUint32(o + 4) === 0x45786966) return gpsOku(b, o + 10);
      if ((m & 0xFF00) !== 0xFF00) break; o += 2 + uz;
    }
  } catch { /* okunamadı */ }
  return null;
}
function gpsOku(b, t) {
  const le = b.getUint16(t) === 0x4949, u16 = i => b.getUint16(i, le), u32 = i => b.getUint32(i, le);
  const ifd = (bas, ara) => { const n = u16(t + bas); for (let i = 0; i < n; i++) { const e = t + bas + 2 + i * 12; if (u16(e) === ara) return e; } return null; };
  const gpsG = ifd(u32(t + 4), 0x8825); if (!gpsG) return null;
  const g = u32(gpsG + 8), oku = etiket => { const e = ifd(g, etiket); return e; };
  const ras = e => { const o = t + u32(e + 8); return [0, 1, 2].map(i => u32(o + i * 8) / (u32(o + i * 8 + 4) || 1)); };
  const yon = e => e ? String.fromCharCode(b.getUint8(e + 8)) : '';
  const enE = oku(2), boyE = oku(4); if (!enE || !boyE) return null;
  const d = ([a, m, s]) => a + m / 60 + s / 3600;
  let lat = d(ras(enE)), lng = d(ras(boyE));
  if (yon(oku(1)) === 'S') lat = -lat; if (yon(oku(3)) === 'W') lng = -lng;
  return lat && lng && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: +lat.toFixed(6), lng: +lng.toFixed(6) } : null;
}

// ---------- Metinden iletişim bilgileri ----------
export function iletisimBul(metin) {
  const m = String(metin || '');
  const tel = [...new Set((m.match(/(\+?\s?90[\s-]*)?\(?0?\s?[2-58]\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/g) || []).map(t => t.replace(/[^\d+]/g, '')).filter(t => t.replace(/\D/g, '').length >= 10))];
  const web = [...new Set((m.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]{2,}\.(?:com\.tr|net\.tr|org\.tr|gen\.tr|com|net|org|tr)\b/gi) || []).map(w => w.toLowerCase().replace(/^https?:\/\//, '')))];
  const eposta = [...new Set(m.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || [])];
  return { tel, web: web.filter(w => !eposta.some(e => e.toLowerCase().endsWith(w))), eposta };
}

// ---------- Değerleri ayırma ----------
const buyukHarf = s => String(s || '').toLocaleLowerCase('tr').replace(/(^|[\s.\-'])\S/g, c => c.toLocaleUpperCase('tr'));
// "İnşaat Mühendisi H. İbrahim Taşdemir" → { ad: "H. İbrahim Taşdemir", unvan: "İnşaat Mühendisi" }
export function kisiAyir(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  // Büyük harfli Türkçe (İNŞAAT) için eşleşme sadeleştirilmiş metinde aranır; uzunluk aynı kalır
  const m = /^((insaat|elektrik|elektronik|makin[ae]|mimar|harita|jeoloji|jeofizik|cevre)\s*(y\.?\s*)?(muhendis[i]?|muh\.?|tekniker)|y(uksek)?\.?\s*mimar|mimar|dr\.?|prof\.?)\s*[:\-–]?\s*/.exec(fold(t));
  return { ad: buyukHarf(t.slice(m ? m[0].length : 0).trim() || t), unvan: m ? buyukHarf(t.slice(0, m[0].length).replace(/[:\-–]\s*$/, '').trim()) : null };
}
export function ruhsatAyir(s) {
  const t = String(s || ''); const d = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(t);
  const tarih = d ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : null;
  const kalan = d ? t.replace(d[0], ' ') : t;
  const no = (/no\.?\s*:?\s*([\w/.-]*\d[\w/.-]*)/i.exec(kalan) || /\b(\d[\d/.-]{3,})\b/.exec(kalan) || [])[1] || null;
  return { no, tarih };
}
export function parselAyir(s) {
  const t = String(s || '');
  const ada = (/ada\D{0,4}(\d[\w-]*)/i.exec(t) || [])[1], parsel = (/parsel\D{0,4}(\d[\w-]*)/i.exec(t) || [])[1];
  if (ada || parsel) return { ada: ada || null, parsel: parsel || null };
  const b = /(\d+)\s*\/\s*(\d+)/.exec(t); return b ? { ada: b[1], parsel: b[2] } : { ada: null, parsel: null };
}

// ---------- Kayıtlı firma / kişi adayları (benzerlik sırasıyla) ----------
const EK = /\b(ltd|sti|a s|as|anonim|limited|sirketi|san|sanayi|tic|ticaret|insaat|ins|muh|muhendislik|taahhut|elektrik|enerji|yapi|ve|ithalat|ihracat|pazarlama|gida)\b/g;
const cekirdek = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(EK, ' ').replace(/\s+/g, ' ').trim();
const mesafe = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let o = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, o + (a[i - 1] === b[j - 1] ? 0 : 1)); o = t; } } return d[b.length]; };
const benzerlik = (a, b) => { if (!a || !b) return 0; if (a === b) return 1; if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.9; const d = mesafe(a, b); const o = 1 - d / Math.max(a.length, b.length); const ta = new Set(a.split(' ')), tb = b.split(' '); const ortak = tb.filter(x => x.length > 2 && ta.has(x)).length / Math.max(ta.size, tb.length); return Math.max(o, ortak * 0.85); };
export function firmaAdaylari(ad, n = 3) {
  const c = cekirdek(ad); if (c.length < 2) return [];
  return S.firmalar.map(f => ({ f, p: benzerlik(c, cekirdek(f.ad)) })).filter(x => x.p >= 0.6).sort((a, b) => b.p - a.p).slice(0, n);
}
export function kisiAdaylari(ad, n = 3) {
  const c = fold(ad).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); if (c.length < 3) return [];
  const soyad = c.split(' ').pop();
  return (S.kisiler || []).map(k => { const x = fold(k.ad_soyad || '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); return { k, p: x === c ? 1 : x.split(' ').pop() === soyad ? Math.max(0.65, benzerlik(c, x)) : benzerlik(c, x) }; })
    .filter(x => x.p >= 0.75).sort((a, b) => b.p - a.p).slice(0, n);
}

// ---------- Mükerrer proje ----------
export function mukerrerProje({ ruhsat_no, ada, parsel, il }, haric = null) {
  const r = String(ruhsat_no || '').replace(/\D/g, '');
  return S.projeler.filter(p => p.id !== haric && !p.ust_proje_id && (
    (r.length >= 5 && String(p.ruhsat_no || '').replace(/\D/g, '') === r) ||
    (ada && parsel && String(p.ada || '') === String(ada) && String(p.parsel || '') === String(parsel) && (!il || !p.il || p.il === il))));
}

// Tabela rollerinden projenin alanları
export const FIRMA_ROL = [['yatirimci', 'Yatırımcı / işveren', 'yatirimci_id', 'Yatırımcı'], ['gemut', 'Genel müteahhit (yüklenici)', 'gemut_id', 'Gemüt'], ['emut', 'Elektrik yüklenicisi (Emüt)', 'emut_id', 'Emüt'], ['danisman', 'Kontrollük / danışman', 'danisman_id', 'Danışman']];
export const KISI_ROL = [['santiye_sefi', 'Şantiye şefi', 'santiye_sefi_id', 'Şantiye şefi', 'gemut_id'], ['elektrik_proje', 'Elektrik projecisi', 'elektrik_projeci_id', 'Elektrik proje müellifi', null], ['projeci', 'Mimar', 'mimar_id', 'Mimari proje müellifi', null], ['statik', 'Statik projeci', 'statik_id', 'Statik proje müellifi', null], ['mekanik', 'Mekanik projeci', 'mekanik_id', 'Mekanik proje müellifi', null]];
const EK_BILGI = [['baslama', 'Başlama'], ['bitis', 'Bitiş'], ['bedel', 'Bedel'], ['alan', 'İnşaat alanı']];

/**
 * Eşleştirme ekranı. proje verilirse "Tabeladan doldur" (mevcut projeye uygular), verilmezse yeni proje formunu açar.
 * o: tabelaAyristir sonucu; metin: okunan metin; dosya: özgün fotoğraf; kirpik: çerçevelenmiş hâli
 */
export async function eslestirmeEkrani({ o = {}, metin = '', dosya = null, kirpik = null, proje = null, kayitliFoto = null }) {
  const pr = proje ? byId('projeler', proje.id) || proje : null;
  const rz = ruhsatAyir(o.ruhsat), pz = parselAyir(o.parsel);
  const konum = dosya ? await exifKonum(dosya) : null;
  const ilet = iletisimBul(metin);
  const deger = { ad: o.ad || '', il: o.il || '', adres: o.adres || '', ruhsat_no: rz.no || '', ruhsat_tarihi: rz.tarih || '', ada: pz.ada || '', parsel: pz.parsel || '', yapi_denetim: o.denetim || '' };
  const BILGI = [['ad', 'Proje adı'], ['ruhsat_no', 'Ruhsat no'], ['ruhsat_tarihi', 'Ruhsat tarihi', 'date'], ['ada', 'Ada'], ['parsel', 'Parsel'], ['yapi_denetim', 'Yapı denetim'], ['adres', 'Adres']];
  // Mevcut projede: dolu ve farklı alan "değiştir" sorusuyla, aynıysa gösterilmez
  const mevcut = (alan, yeni) => pr && pr[alan] != null && String(pr[alan]).trim() !== '' ? (String(pr[alan]) === String(yeni) ? 'ayni' : 'farkli') : 'bos';
  const satirBilgi = ([k, l, t]) => { const v = deger[k]; if (!v && !pr) return `<div class="fld"><label for="te-${k}">${l}</label><input id="te-${k}" ${t === 'date' ? 'type="date"' : ''} value="" placeholder="—"></div>`;
    if (!v) return ''; const m = mevcut(k, v); if (m === 'ayni') return '';
    return `<div class="fld"><label for="te-${k}">${l}</label><input id="te-${k}" ${t === 'date' ? 'type="date"' : ''} value="${esc(v)}">${m === 'farkli' ? `<small><label class="chk"><input type="checkbox" data-degistir="${k}"> <span>Kayıtlı “${esc(pr[k])}” yerine yaz</span></label></small>` : ''}</div>`; };
  const firmaSecenek = (k, ad, alan) => {
    const ad0 = firmaAdaylari(ad), kayitli = pr?.[alan] ? byId('firmalar', pr[alan]) : null;
    const varsay = kayitli ? 'koru' : ad0[0]?.p >= 0.85 ? 'f:' + ad0[0].f.id : ad ? 'yeni' : 'atla';
    return `<select data-fsec="${k}" aria-label="Ne yapılsın">${kayitli ? `<option value="koru" ${varsay === 'koru' ? 'selected' : ''}>Kayıtlı kalsın: ${esc(kayitli.ad)}</option>` : ''}
      ${ad0.map(x => `<option value="f:${x.f.id}" ${varsay === 'f:' + x.f.id ? 'selected' : ''}>Bağla: ${esc(x.f.ad)}${x.p < 1 ? ` (benzer %${Math.round(x.p * 100)})` : ''}</option>`).join('')}
      <option value="yeni" ${varsay === 'yeni' ? 'selected' : ''}>Yeni firma oluştur</option><option value="atla" ${varsay === 'atla' ? 'selected' : ''}>Atla</option></select>`;
  };
  const kisiSecenek = (k, ad, alan) => {
    const ad0 = kisiAdaylari(ad), kayitli = pr?.[alan] ? byId('kisiler', pr[alan]) : null;
    const varsay = kayitli ? 'koru' : ad0[0]?.p >= 0.9 ? 'k:' + ad0[0].k.id : ad ? 'yeni' : 'atla';
    return `<select data-ksec="${k}" aria-label="Ne yapılsın">${kayitli ? `<option value="koru" ${varsay === 'koru' ? 'selected' : ''}>Kayıtlı kalsın: ${esc(kayitli.ad_soyad)}</option>` : ''}
      ${ad0.map(x => `<option value="k:${x.k.id}" ${varsay === 'k:' + x.k.id ? 'selected' : ''}>Bağla: ${esc(x.k.ad_soyad)}${x.k.firma_id ? ' · ' + esc(byId('firmalar', x.k.firma_id)?.ad || '') : ''}</option>`).join('')}
      <option value="yeni" ${varsay === 'yeni' ? 'selected' : ''}>Yeni kişi kartı oluştur</option><option value="atla" ${varsay === 'atla' ? 'selected' : ''}>Atla</option></select>`;
  };
  const kisiler = KISI_ROL.map(r => [...r, kisiAyir(o[r[0]])]);
  const muk = pr ? [] : mukerrerProje({ ruhsat_no: deger.ruhsat_no, ada: deger.ada, parsel: deger.parsel, il: deger.il });
  const p = openDrawer(`<header class="dh"><div><p class="muted">${pr ? esc(pr.ad) : 'Yeni proje'}</p><h2 id="drawer-title">${pr ? 'Tabeladan doldur' : 'Tabeladaki bilgileri eşleştir'}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form te">
      ${kirpik || dosya ? `<div class="tb-foto"><img alt="Tabela fotoğrafı" src="${URL.createObjectURL(kirpik || dosya)}"></div>` : ''}
      <p class="hint">Her satırda ne yapılacağını seç: kayıtlı firmaya / kişiye bağla, yeni kayıt aç ya da atla. ${pr ? 'Boş alanlar doldurulur; dolu bir alan yalnız işaretlersen değişir.' : 'Onaylamadan hiçbir şey kaydedilmez.'}</p>
      ${muk.length ? `<div class="warn te-muk"><b>Bu tabelaya benzeyen kayıtlı proje var:</b> ${muk.map(m => `<a href="#/proje/${m.id}" data-close>${esc(m.ad)}</a>`).join(', ')}
        <div class="seg te-mukk" role="group" aria-label="Ne yapılsın"><button type="button" class="on" data-muk="yeni" aria-pressed="true">Yine de yeni proje</button><button type="button" data-muk="alt" aria-pressed="false">“${esc(muk[0].ad)}” altına blok olarak ekle</button></div></div>` : ''}
      <h3>Proje bilgileri</h3>
      ${satirBilgi(BILGI[0])}
      <div class="te-izgara">${BILGI.slice(1).map(satirBilgi).join('')}
      ${!pr || !pr.il ? `<div class="fld"><label for="te-il">İl</label><select id="te-il"><option value="">—</option>${ILLER.map(i => `<option ${deger.il === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div>` : ''}</div>
      ${konum && (!pr || !pr.lat) ? `<label class="chk"><input type="checkbox" id="te-konum" checked> <span>Konumu fotoğraftan al (${konum.lat.toFixed(5)}, ${konum.lng.toFixed(5)})</span></label>` : ''}
      <h3>Firmalar</h3>
      ${FIRMA_ROL.map(([k, l, alan]) => { const ad = o[k] || ''; if (!ad && pr) return ''; return `<div class="te-satir" data-frol="${k}"><label for="te-f-${k}">${l}</label><div class="te-ic"><input id="te-f-${k}" value="${esc(ad)}" placeholder="—">${firmaSecenek(k, ad, alan)}</div><div class="te-yetkili" data-yetkili="${k}"></div></div>`; }).join('')}
      <h3>Kişiler</h3>
      ${kisiler.map(([k, l, alan, , , ka]) => { if (!ka.ad && (pr || !o[k])) return ''; return `<div class="te-satir" data-krol="${k}"><label for="te-k-${k}">${l}</label><div class="te-ic"><input id="te-k-${k}" value="${esc(ka.ad)}" placeholder="Ad soyad"><input class="te-unvan" data-unvan value="${esc(ka.unvan || '')}" placeholder="Ünvan" aria-label="${l} ünvanı">${kisiSecenek(k, ka.ad, alan)}</div></div>`; }).join('') || '<p class="muted">Tabelada kişi adı okunmadı.</p>'}
      <div class="fld"><label for="te-ilgili">Projenin ilgili kişisi</label><select id="te-ilgili"><option value="">—</option></select><small>Seçilen firmaların yetkilileri ve tabeladaki kişiler</small></div>
      ${ilet.tel.length || ilet.web.length || ilet.eposta.length ? `<h3>Tabeladaki iletişim bilgileri</h3>${[...ilet.tel.map(v => ['telefon', v]), ...ilet.eposta.map(v => ['eposta', v]), ...ilet.web.map(v => ['web', v])].map(([t, v], i) => `<div class="te-satir" data-ilet="${i}" data-tur="${t}" data-deger="${esc(v)}"><label>${{ telefon: 'Telefon', eposta: 'E-posta', web: 'Web' }[t]}: <b>${esc(v)}</b></label><select data-ihedef aria-label="Kime eklensin"><option value="">Ekleme</option>${FIRMA_ROL.map(([k, l]) => `<option value="f:${k}" ${k === 'gemut' ? 'selected' : ''}>${l}</option>`).join('')}${KISI_ROL.map(([k, l]) => `<option value="k:${k}">${l}</option>`).join('')}</select></div>`).join('')}` : ''}
      ${EK_BILGI.some(([k]) => o[k]) ? `<div class="fld"><label for="te-not">Tabeladaki diğer bilgiler (notlara)</label><textarea id="te-not" rows="3">${esc(EK_BILGI.filter(([k]) => o[k]).map(([k, l]) => `${l}: ${o[k]}`).join('\n'))}</textarea></div>` : ''}
      ${!pr ? `<label class="chk"><input type="checkbox" id="te-gorev" checked> <span>Takip görevleri oluştur (genel müteahhidi ziyaret et, elektrik projecisiyle görüş)</span></label>` : ''}
      ${dosya || kirpik ? `<label class="chk"><input type="checkbox" id="te-foto" ${kayitliFoto ? '' : 'checked'}> <span>${kayitliFoto ? 'Fotoğrafı projeye yeniden ekle' : 'Tabela fotoğrafını projeye ekle (yüksek çözünürlükte; çerçevelenmiş hâli de)'}</span></label>` : ''}
      <details><summary>Okunan metnin tamamı</summary><pre class="tb-metin">${esc(metin || '—')}</pre></details>
    </div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-uygula>${pr ? 'Projeye uygula' : 'Proje formunu aç'}</button></div>`, { wide: true });
  let mukSecim = 'yeni';
  p.querySelectorAll('[data-muk]').forEach(b => b.onclick = () => { mukSecim = b.dataset.muk; p.querySelectorAll('[data-muk]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
  // Seçilen firmaya göre yetkili önerisi ve "ilgili kişi" listesi
  const firmaSecimi = k => { const v = p.querySelector(`[data-fsec="${k}"]`)?.value || ''; return v.startsWith('f:') ? byId('firmalar', v.slice(2)) : v === 'koru' ? byId('firmalar', pr?.[FIRMA_ROL.find(r => r[0] === k)[2]]) : null; };
  const yenile = () => {
    const sec = p.querySelector('#te-ilgili'), once = sec.value, sec0 = [];
    for (const [k, l] of FIRMA_ROL) {
      const f = firmaSecimi(k), kutu = p.querySelector(`[data-yetkili="${k}"]`); if (!kutu) continue;
      const ks = f ? (S.kisiler || []).filter(x => x.firma_id === f.id) : [];
      kutu.innerHTML = ks.length ? `<small class="muted">Yetkili: ${ks.slice(0, 3).map(x => `${esc(x.ad_soyad)}${x.pozisyon ? ' (' + esc(x.pozisyon) + ')' : ''}`).join(', ')}</small>` : '';
      ks.forEach(x => sec0.push([x.id, `${x.ad_soyad} · ${f.ad}`]));
    }
    for (const [k, l] of KISI_ROL) { const v = p.querySelector(`[data-ksec="${k}"]`)?.value || '', ad = p.querySelector(`#te-k-${k}`)?.value.trim(); if (v.startsWith('k:')) sec0.push([v, `${byId('kisiler', v.slice(2))?.ad_soyad} · ${l}`]); else if (v === 'yeni' && ad) sec0.push(['y:' + k, `${ad} · ${l} (yeni)`]); }
    sec.innerHTML = '<option value="">—</option>' + sec0.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
    sec.value = sec0.some(([v]) => v === once) ? once : (pr?.ilgili_kisi_id ? '' : (sec0.find(([v]) => v === 'y:santiye_sefi' || (String(v).startsWith('k:') && false))?.[0] || ''));
  };
  p.querySelectorAll('[data-fsec], [data-ksec]').forEach(s => s.addEventListener('change', yenile));
  // Ad değişince adaylar yeniden
  p.querySelectorAll('[data-frol] input').forEach(i => i.addEventListener('change', () => { const k = i.closest('[data-frol]').dataset.frol; const alan = FIRMA_ROL.find(r => r[0] === k)[2]; i.nextElementSibling.outerHTML = firmaSecenek(k, i.value.trim(), alan); p.querySelector(`[data-fsec="${k}"]`).addEventListener('change', yenile); yenile(); }));
  p.querySelectorAll('[data-krol] input:not([data-unvan])').forEach(i => i.addEventListener('change', () => { const k = i.closest('[data-krol]').dataset.krol; const alan = KISI_ROL.find(r => r[0] === k)[2]; const s = i.parentElement.querySelector('select'); s.outerHTML = kisiSecenek(k, i.value.trim(), alan); p.querySelector(`[data-ksec="${k}"]`).addEventListener('change', yenile); yenile(); }));
  yenile();

  return new Promise(coz => {
    p.querySelector('[data-uygula]').onclick = async () => {
      const b = p.querySelector('[data-uygula]'); b.disabled = true;
      try {
        const v = id => p.querySelector(id)?.value?.trim() ?? '';
        const il = v('#te-il') || pr?.il || null;
        const sonuc = {}, firmaId = {}, kisiId = {}, olusan = [], yeniKisi = new Map();
        for (const [k, , alan, tip] of FIRMA_ROL) {
          const sec = p.querySelector(`[data-fsec="${k}"]`)?.value, ad = v(`#te-f-${k}`); if (!sec || sec === 'atla') continue;
          if (sec === 'koru') { firmaId[k] = pr[alan]; continue; }
          let id = sec.startsWith('f:') ? sec.slice(2) : null;
          if (sec === 'yeni' && ad) { const f = await app.db.save('firmalar', { id: uuid(), ad: ad.replace(/\s+/g, ' '), tipler: [tip], il, notlar: 'Şantiye tabelasından eklendi' }); id = f.id; olusan.push(f.ad); }
          if (id) { firmaId[k] = id; if (!pr?.[alan]) sonuc[alan] = id; }
        }
        for (const [k, , alan, poz, firmaAlan] of KISI_ROL) {
          const sec = p.querySelector(`[data-ksec="${k}"]`)?.value, ad = v(`#te-k-${k}`), unvan = p.querySelector(`[data-krol="${k}"] [data-unvan]`)?.value.trim() || null; if (!sec || sec === 'atla') continue;
          if (sec === 'koru') { kisiId[k] = pr[alan]; continue; }
          let id = sec.startsWith('k:') ? sec.slice(2) : null;
          // Aynı kişi tabelada iki görevde (ör. şantiye şefi ve statik) geçiyorsa tek kişi kartı açılır
          if (sec === 'yeni' && ad && yeniKisi.has(fold(ad))) id = yeniKisi.get(fold(ad));
          else if (sec === 'yeni' && ad) { const kk = await app.db.save('kisiler', { id: uuid(), firma_id: firmaAlan ? (firmaId.gemut || pr?.gemut_id || null) : null, ad_soyad: ad, unvan, pozisyon: poz, notlar: 'Şantiye tabelasından' + (deger.ad ? ` (${deger.ad})` : '') }); id = kk.id; yeniKisi.set(fold(ad), kk.id); olusan.push(kk.ad_soyad); }
          if (id) { kisiId[k] = id; if (!pr?.[alan]) sonuc[alan] = id; }
        }
        // İletişim bilgileri: seçilen firmaya / kişiye, boş alanına (doluysa notuna)
        for (const r of p.querySelectorAll('[data-ilet]')) {
          const h = r.querySelector('[data-ihedef]').value; if (!h) continue;
          const [tur, k] = h.split(':'), id = tur === 'f' ? firmaId[k] : kisiId[k]; if (!id) continue;
          const tablo = tur === 'f' ? 'firmalar' : 'kisiler', kayit = byId(tablo, id); if (!kayit) continue;
          const alanAd = r.dataset.tur, deg = r.dataset.deger;
          if (!kayit[alanAd]) await app.db.save(tablo, { ...kayit, [alanAd]: deg });
          else if (!String(kayit.notlar || '').includes(deg)) await app.db.save(tablo, { ...kayit, notlar: [kayit.notlar, `Tabelada: ${deg}`].filter(Boolean).join('\n') });
        }
        // Bilgi alanları
        for (const [k] of BILGI) { const el = p.querySelector(`#te-${k}`); if (!el) continue; const yeni = el.value.trim(); if (!yeni) continue;
          const m = mevcut(k, yeni); if (m === 'bos' || (m === 'farkli' && p.querySelector(`[data-degistir="${k}"]`)?.checked)) sonuc[k] = yeni; }
        if (il && !pr?.il) sonuc.il = il;
        if (konum && p.querySelector('#te-konum')?.checked) Object.assign(sonuc, { lat: konum.lat, lng: konum.lng, konum_yaklasik: false });
        const ilgili = v('#te-ilgili'); if (ilgili && !pr?.ilgili_kisi_id) sonuc.ilgili_kisi_id = ilgili.startsWith('k:') ? ilgili.slice(2) : ilgili.startsWith('y:') ? kisiId[ilgili.slice(2)] || null : ilgili;
        const not = v('#te-not');
        let fotolar = [];
        if (p.querySelector('#te-foto')?.checked) { try { if (dosya) fotolar.push(await app.db.upload(dosya, { max: 2560, q: 0.9 })); if (kirpik && kirpik !== dosya) fotolar.push(await app.db.upload(kirpik, { max: 2560, q: 0.92 })); } catch (e) { toast('Fotoğraf eklenemedi: ' + e.message, 'err'); } }
        if (pr) {
          const g = byId('projeler', pr.id) || pr;
          const yeni = { ...g, ...sonuc, fotolar: [...(g.fotolar || []), ...fotolar], notlar: not && !String(g.notlar || '').includes(not) ? [g.notlar, not].filter(Boolean).join('\n') : g.notlar };
          await app.db.save('projeler', yeni);
          const n = Object.keys(sonuc).length;
          toast(n ? `${n} alan tabeladan dolduruldu${olusan.length ? `; yeni: ${olusan.join(', ')}` : ''}.` : 'Yeni bilgi yok; alanlar zaten dolu.');
          closeDrawer(); app.refresh?.(); coz(yeni); return;
        }
        const init = { ...sonuc, durum: 'Proje', santiye_asamasi: null, fotolar, notlar: ['Şantiye tabelasından', not].filter(Boolean).join('\n') };
        if (mukSecim === 'alt' && muk[0]) Object.assign(init, altProjeAlanlari(muk[0]), { ust_proje_id: muk[0].id, ad: init.ad && init.ad !== muk[0].ad ? init.ad : muk[0].ad + ' – Blok' });
        const gorev = p.querySelector('#te-gorev')?.checked;
        closeDrawer();
        (await import('./views/projeler.js')).yeniProje(init, gorev ? async kayit => takipGorevleri(kayit) : null);
        coz(init);
      } catch (e) { b.disabled = false; toast('Olmadı: ' + e.message, 'err'); }
    };
  });
}

// Alt proje (blok) ana projeden ortak bilgileri alır; teklif, tutar, aşama, tarih, Emüt kendine ait
export const ORTAK_ALANLAR = ['yatirimci_id', 'gemut_id', 'projeci_id', 'danisman_id', 'il', 'ilce', 'belde', 'osb', 'lokasyon', 'adres', 'lat', 'lng', 'konum_yaklasik', 'ruhsat_no', 'ruhsat_tarihi', 'ada', 'parsel', 'yapi_denetim', 'santiye_sefi_id', 'mimar_id', 'statik_id', 'mekanik_id', 'elektrik_projeci_id', 'sektor', 'alt_sektor', 'bayi_id', 'kanal', 'takip_yili', 'emut_id'];
export const altProjeAlanlari = ana => Object.fromEntries(ORTAK_ALANLAR.filter(k => ana[k] != null && ana[k] !== '').map(k => [k, ana[k]]));

// Yeni projede takip görevleri: genel müteahhidi ziyaret, elektrik projecisiyle görüşme (bir hafta içinde)
export async function takipGorevleri(p) {
  if (!p?.id) return 0;
  const hafta = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); let n = 0;
  const g = p.gemut_id && byId('firmalar', p.gemut_id), e = p.elektrik_projeci_id && byId('kisiler', p.elektrik_projeci_id);
  if (g) { await app.db.save('gorevler', { baslik: `Genel müteahhidi ziyaret et: ${g.ad} (${p.ad})`, son_tarih: hafta, durum: 'Açık', oncelik: 'Normal', firma_id: g.id, proje_id: p.id, kaynak: 'tabela' }); n++; }
  if (e) { await app.db.save('gorevler', { baslik: `Elektrik projecisiyle görüş: ${e.ad_soyad} (${p.ad})`, son_tarih: hafta, durum: 'Açık', oncelik: 'Normal', kisi_id: e.id, proje_id: p.id, kaynak: 'tabela' }); n++; }
  if (n) toast(`${n} takip görevi eklendi.`);
  return n;
}
export { today };
