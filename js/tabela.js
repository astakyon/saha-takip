// Şantiye tabelasından proje: tabelanın fotoğrafındaki yazı okunur (kartvizitteki okuma motoru),
// proje adı, yapı sahibi / yatırımcı, müteahhit, proje müellifi, elektrik yüklenicisi, yapı denetim, ruhsat ve ada-parsel ayrılır.
// Firmalar kayıtlı firmalarla eşleştirilir; olmayanlar istenirse oluşturulur, sonra yeni proje formu dolu açılır.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, closeDrawer, pickFiles, fold, ILLER } from './ui.js';

const ETIKET = [
  ['ad', /^(proje(nin)?\s*ad[ıi]|i[şs]in\s*ad[ıi]|yap[ıi]n[ıi]n\s*ad[ıi]|proje|tesis\s*ad[ıi])\b/],
  ['yatirimci', /^(yap[ıi]\s*sahib[ıi]|i[şs]veren|yat[ıi]r[ıi]mc[ıi]|mal\s*sahib[ıi]|idare|ruhsat\s*sahib[ıi])\b/],
  ['emut', /^(elektrik\s*(tesisat[ıi]?\s*)?(y[üu]klenici(si)?|m[üu]teahhid?i?|uygulama)|elektrik\s*taahh[üu]t)\b/],
  ['gemut', /^(y[üu]klenici(\s*firma)?|m[üu]teahhit|m[üu]teahhid[ıi]|ana\s*y[üu]klenici|genel\s*m[üu]teahhit|uygulay[ıi]c[ıi]|yap[ıi]mc[ıi])\b/],
  ['elektrik_proje', /^(elektrik\s*(t\b\.?|tes\b\.?|tesisat(\s*proje(si)?)?|proje(si)?|m[üu]hendis[ıi]?|m[üu]ellif[ıi]?)(\s*m[üu]ellif[ıi])?)/],
  ['santiye_sefi', /^([şs]antiye\s*(sef[ıi]|m[üu]hendis[ıi]|sorumlusu)|teknik\s*sorumlu|fenni\s*mesul)\b/],
  ['statik', /^(statik|betonarme)(\s*proje(si)?)?\b/],
  ['mekanik', /^(mekanik|tesisat)(\s*(t\b\.?|tesisat|proje(si)?))*/],
  ['_projeler', /^(projeler|proje\s*m[üu]ellifleri|m[üu]ellifler)\b/],
  ['projeci', /^(proje\s*m[üu]ellif[ıi]|mimar[iı]?\s*proje|m[üu]ellif|mimar|proje\s*b[üu]rosu|tasar[ıi]m)\b/],
  ['danisman', /^(kontrol(l[üu]k)?|m[üu][şs]avir|dan[ıi][şs]man|proje\s*y[öo]netim[ıi])\b/],
  ['denetim', /^(yap[ıi]\s*denet[ıi]m(\s*(firmas[ıi]|kurulu[şs]u))?)\b/],
  ['ruhsat', /^(yap[ıi]\s*ruhsat[ıi]?|ruhsat)(\s*(tarih[ıi]?|no|say[ıi]s[ıi]))*\b/],
  ['parsel', /^(ada\s*\/?\s*parsel|pafta|ada|parsel)\b/],
  ['bitis', /^(i[şs]in\s*bit(i[şs]|im)(\s*tarih[ıi])?|bit(i[şs]|im)\s*tarih[ıi]|tamamlanma|teslim\s*tarih[ıi])\b/],
  ['baslama', /^(i[şs]e\s*ba[şs]lama|ba[şs]lama\s*tarih[ıi]|yer\s*teslim)\b/],
  ['bedel', /^(s[öo]zle[şs]me\s*bedel[ıi]|ke[şs]if\s*bedel[ıi]|ihale\s*bedel[ıi]|yakla[şs][ıi]k\s*maliyet)\b/],
  ['alan', /^(in[şs]aat\s*alan[ıi]|toplam\s*alan|yap[ıi]\s*alan[ıi])\b/],
  ['adres', /^(adres|yer[ıi]|il\s*\/\s*il[çc]e|konum)\b/],
];
const temizle = s => String(s || '').replace(/[|_~•·“”"„«»]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
// Okunan değerin kenar gürültüsü: sondaki tek harf / iki nokta, yapışık “A.Ş.”, kelime sonundaki fazla nokta, ünvan ile ad arasındaki “:”
const degerTemizle = s => temizle(s).replace(/(\p{L}{3,})(A\.?\s?Ş\.?)$/u, '$1 $2').replace(/(\p{L}{4,})\.(\s)/gu, '$1$2').replace(/\s+[:;]\s+/g, ' ').replace(/(\s+[^\s\d]|[\s:;,\-–]+)$/u, '').replace(/(\s+[^\s\d])$/u, '').replace(/(\s[^\s.]{4,})\.$/u, '$1').trim();

const etiketi = s => { const f = fold(s); for (const [k, re] of ETIKET) { const m = re.exec(f); if (m) return [k, m[0].length]; } return null; };
const COKLU = new Set(['ruhsat', 'parsel', 'adres']);
// Firma unvanının devamı olan satır (ör. “TİC. SAN. A.Ş.”, “İNŞAAT A.Ş.”) ya da kişinin adı ünvanından sonra gelir
const DEVAM = /^(tic|san|a\.?\s?[şs]|ltd|[şs]ti|in[şs]aat|insaat|taahh|m[üu]h|elektrik|enerji|yap[ıi]|ve\b|&)/i;
export function tabelaAyristir(metin) {
  const satirlar = String(metin || '').split(/\n+/).map(temizle).filter(s => s.length > 1);
  const o = {};
  for (let i = 0; i < satirlar.length; i++) {
    const sat = satirlar[i], e = etiketi(sat); if (!e) continue;
    const [k] = e; if (o[k] && !COKLU.has(k)) continue;
    let deger = sat.slice(e[1]).replace(/^[\s:;=\-–.]+/, '').replace(/^(proje(si)?|m[üu]ellif[ıi]?)\b[\s:]*/i, '').trim();
    if (deger.length < 2) { const s2 = satirlar[i + 1]; if (s2 && !etiketi(s2)) { deger = s2; i++; } else deger = ''; }
    while (deger && satirlar[i + 1] && !etiketi(satirlar[i + 1]) && DEVAM.test(fold(satirlar[i + 1])) && k !== '_projeler') { deger += ' ' + satirlar[i + 1]; i++; }
    if (!deger || k === '_projeler') continue;
    if (COKLU.has(k)) { const ek = fold(sat.slice(0, e[1])).replace(/^(yapi\s*)?ruhsati?|^pafta|^adres|^ada\s*\/?\s*parsel/, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); const parca = (ek ? ek.replace(/^\S/, c => c.toLocaleUpperCase('tr')) + ' ' : '') + degerTemizle(deger); o[k] = o[k] ? o[k] + ' · ' + parca : parca; }
    else o[k] = degerTemizle(deger);
  }
  // Proje adı etiketsiz yazılmışsa: tabelada yapı sahibi / işveren varsa onun adı (ör. “Armada Gıda”), yoksa büyük harfli, firma ya da adres olmayan ilk satır
  const UNVAN = new Set(['tic', 'ticaret', 'san', 'sanayi', 'as', 'ltd', 'sti', 'anonim', 'limited', 'sirketi', 've', 'a', 's']);
  const cekirdekAd = a => temizle(String(a)).split(/\s+/).filter(t => !UNVAN.has(fold(t).replace(/[^a-z]/g, ''))).join(' ');
  if (!o.ad) o.ad = satirlar.find(s => s.length >= 8 && s === s.toLocaleUpperCase('tr') && !/(ltd|şti|a\.ş|inşaat|insaat|tic\.|san\.|tel|www|@|\d{3}\s?\d{3})/i.test(s) && !/:/.test(s) && !etiketi(s) && !Object.values(o).some(v => String(v).includes(s))) || (o.yatirimci ? cekirdekAd(o.yatirimci) : '');
  o.ad = o.ad ? o.ad.toLocaleLowerCase('tr').replace(/(^|\s)\S/g, c => c.toLocaleUpperCase('tr')) : '';
  const tum = satirlar.join(' ');
  o.il = ILLER.find(il => new RegExp(il, 'i').test(fold(tum)) || fold(tum).includes(fold(il))) || '';
  return o;
}
// Hücre hücre okunan tabeladan “etiket değer” metni: etiket kutusunda birden çok etiket varsa (ör. Ruhsat tarih / Ruhsat no) değerlerle satır satır eşlenir;
// değer alanında kendi etiketi olan satırlar (ör. Projeler: “Mimar: …”, “Elektrik T: …”) ayrı ayrı kalır
// Etiket kutusundaki yazı bir harf eksik / yanlış okunduysa (“ROJELER”, “DUHSAT NO”) en yakın bilinen etikete düzeltilir
const BILINEN = ['İşveren', 'Yüklenici', 'Pafta', 'Ruhsat tarih', 'Ruhsat no', 'Şantiye şefi', 'Projeler', 'Yapı sahibi', 'Yapı denetim', 'Müteahhit', 'Proje müellifi', 'Elektrik yüklenicisi', 'İşin adı', 'Proje adı', 'Kontrollük', 'Ada parsel', 'Başlama tarihi', 'Bitiş tarihi', 'Sözleşme bedeli', 'Adres', 'Yapı ruhsatı', 'Fenni mesul', 'Yatırımcı'];
const harf = s => fold(s).replace(/[^a-z]/g, '');
const mesafe = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let o = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, o + (a[i - 1] === b[j - 1] ? 0 : 1)); o = t; } } return d[b.length]; };
export function etiketDuzelt(s) {
  if (etiketi(temizle(s))) return s;
  const h = harf(s); if (h.length < 4) return s;
  let en = null, enD = Infinity; for (const b of BILINEN) { const d = mesafe(h, harf(b)); if (d < enD) { enD = d; en = b; } }
  return enD <= Math.max(1, Math.floor(harf(en).length * 0.25)) ? en + ':' : s;
}
export function tabelaHucreMetni({ hucreler = [], ust = [] } = {}) {
  const out = [...ust];
  for (const { etiket = [], degerler = [] } of hucreler) {
    const E = [].concat(etiket).filter(Boolean).map(etiketDuzelt);
    if (degerler.some(d => etiketi(temizle(d)))) out.push(E.join(' '), ...degerler);
    else if (E.length > 1 && E.length === degerler.length && E.every(e => etiketi(temizle(e)))) E.forEach((e, i) => out.push(e + ' ' + degerler[i]));
    else out.push([E.join(' '), ...degerler].join(' '));
  }
  return out.join('\n');
}
// Konumlu satırlardan “etiket değer” metni: tabelada etiket sol hücrede, değeri sağ hücrede (birkaç satır olabilir).
// Etiketsiz her satır, solunda kalan etiketlerden dikeyde en yakınına bağlanır; kendi etiketi olan satır (ör. “MİMAR: …”) kendi başına kalır.
export function tabelaSatirlari(satirlar) {
  if (!satirlar?.length) return '';
  const L = satirlar.map(s => ({ ...s, e: etiketi(temizle(s.metin)), yc: (s.y0 + s.y1) / 2 })).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const boy = (b => b[b.length >> 1] || 20)(L.map(s => s.y1 - s.y0).sort((a, b) => a - b));
  const etiketler = L.filter(s => s.e);
  if (!etiketler.length) return L.map(s => s.metin).join('\n');
  const bagli = new Map(etiketler.map(e => [e, []])), serbest = [];
  for (const s of L) {
    if (s.e) continue;
    let en = null, enD = Infinity;
    for (const e of etiketler) {
      const solda = e.x1 <= s.x0 + boy, kendiDegeri = temizle(e.metin).length - e.e[1] > 3, altinda = s.y0 >= e.y0 && Math.abs(e.x0 + (e.x1 - e.x0) * 0.3 - s.x0) < (e.x1 - e.x0);
      if (!solda && !(kendiDegeri && altinda)) continue;
      const d = Math.abs(s.yc - e.yc) + (kendiDegeri ? boy : 0);
      if (d < enD) { enD = d; en = e; }
    }
    if (en && enD < boy * 5) bagli.get(en).push(s); else serbest.push(s);
  }
  return [...serbest.map(s => s.metin), ...etiketler.map(e => [e.metin, ...bagli.get(e).sort((a, b) => a.y0 - b.y0).map(s => s.metin)].join(' '))].join('\n');
}

// Kayıtlı firmayla eşleştir (unvan eklerini yok sayarak)
const EK = /\b(ltd|sti|şti|a ?s|anonim|limited|sirketi|şirketi|san|sanayi|tic|ticaret|insaat|inşaat|muh|muhendislik|mühendislik|taahhut|taahhüt|elektrik|enerji|yapi|yapı|ve|ins|ltd sti)\b/g;
const cekirdek = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(EK, ' ').replace(/\s+/g, ' ').trim();
export function firmaEslestir(ad) {
  const c = cekirdek(ad); if (c.length < 3) return null;
  return S.firmalar.find(f => cekirdek(f.ad) === c) || S.firmalar.find(f => { const x = cekirdek(f.ad); return x.length >= 4 && (x.startsWith(c) || c.startsWith(x)); }) || null;
}

const ROLLER = [['yatirimci', 'Yatırımcı / yapı sahibi', 'yatirimci_id', 'Yatırımcı'], ['gemut', 'Müteahhit (Gemüt)', 'gemut_id', 'Gemüt'], ['emut', 'Elektrik yüklenicisi (Emüt)', 'emut_id', 'Emüt'], ['elektrik_proje', 'Elektrik projesi (müellif)', 'projeci_id', 'Proje Bürosu'], ['projeci', 'Mimari proje (müellif)', 'projeci_id', 'Proje Bürosu'], ['danisman', 'Kontrollük / danışman', 'danisman_id', 'Danışman']];
const BILGI = [['statik', 'Statik proje'], ['mekanik', 'Mekanik proje'], ['denetim', 'Yapı denetim'], ['ruhsat', 'Ruhsat'], ['parsel', 'Ada / parsel'], ['baslama', 'Başlama'], ['bitis', 'Bitiş'], ['bedel', 'Bedel'], ['alan', 'İnşaat alanı'], ['adres', 'Adres']];

export async function tabeladanProje() {
  const [file] = await pickFiles({ capture: true, multiple: false }); if (!file) return;
  // Önce tabelayı çerçevele: zemin, duvar ve çevredeki yazılar okunmaz; eğik çekilen tabela düzlenir, yüksek çözünürlükte kesilir
  let okunacak = file;
  try { const { kartvizitKirp } = await import('./kirp.js'); const r = await kartvizitKirp(file, { ad: 'Tabela', yatay: false, uzun: 2400, kalite: 0.92, otomatik: false }); if (!r) return; if (r.blob) okunacak = r.blob; }
  catch (e) { console.warn('Tabela çerçeveleme', e); }
  const p = openDrawer(`<header class="dh"><div><p class="muted">Yeni proje</p><h2 id="drawer-title">Şantiye tabelası</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><div class="tb-foto"><img alt="Tabela fotoğrafı" src="${URL.createObjectURL(okunacak)}"></div><div data-durum aria-live="polite"><p class="hint">Tabeladaki yazı okunuyor… (ilk seferde okuma motoru indirilir, ~15 MB)</p><progress max="1" value="0"></progress></div><div data-alanlar></div></div>`, { wide: true });
  let o, metin = '';
  try { const { tabelaOku } = await import('./ocr.js'); const r = await tabelaOku(okunacak, (s, v) => { const pr = p.querySelector('progress'); if (pr && v != null) pr.value = v; }); metin = r.hucreler ? tabelaHucreMetni(r) : tabelaSatirlari(r.satirlar) || r.metin; o = tabelaAyristir(metin); }
  catch (e) { p.querySelector('[data-durum]').innerHTML = `<p class="warn">Okunamadı: ${esc(e.message)}. Alanları elle doldurabilirsin.</p>`; o = {}; }
  if (!p.isConnected) return;
  const bulunan = ROLLER.filter(([k]) => o[k]).length + BILGI.filter(([k]) => o[k]).length + (o.ad ? 1 : 0) + (o.santiye_sefi ? 1 : 0);
  p.querySelector('[data-durum]').innerHTML = `<p class="hint">${bulunan ? `${bulunan} alan okundu. Kontrol et, yanlışları düzelt.` : 'Tabeladan alan ayrılamadı. Fotoğraf net değilse yeniden çek ya da alanları elle doldur.'}</p>`;
  p.querySelector('[data-alanlar]').innerHTML = `
    <div class="fld"><label for="tb-ad">Proje adı</label><input id="tb-ad" value="${esc(o.ad || '')}"></div>
    ${ROLLER.map(([k, l]) => { const f = o[k] ? firmaEslestir(o[k]) : null; return `<div class="fld tb-rol" data-rol="${k}"><label for="tb-${k}">${l}</label><input id="tb-${k}" value="${esc(o[k] || '')}" placeholder="—">
      <small data-esles>${f ? `Kayıtlı firma: <b>${esc(f.ad)}</b>` : o[k] ? '<label class="chk"><input type="checkbox" data-olustur checked> <span>Firmalara yeni firma olarak ekle</span></label>' : ''}</small></div>`; }).join('')}
    ${(sef => `<div class="fld"><label for="tb-sef">Şantiye şefi</label><input id="tb-sef" value="${esc(sef)}" placeholder="—"><small>${sef ? '<label class="chk"><input type="checkbox" id="tb-sefkisi" checked> <span>Kişilere ekle (müteahhit firmasına bağlı)</span></label>' : ''}</small></div>`)(o.santiye_sefi || '')}
    <div class="grid"><div class="fld"><label for="tb-il">İl</label><select id="tb-il"><option value="">—</option>${ILLER.map(i => `<option ${o.il === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div></div>
    ${BILGI.some(([k]) => o[k]) ? `<div class="fld"><label>Tabeladaki diğer bilgiler (projenin notlarına eklenir)</label><textarea id="tb-not" rows="4">${esc(BILGI.filter(([k]) => o[k]).map(([k, l]) => `${l}: ${o[k]}`).join('\n'))}</textarea></div>` : '<textarea id="tb-not" hidden></textarea>'}
    <label class="chk"><input type="checkbox" id="tb-foto" checked> <span>Tabela fotoğrafını projeye ekle (yüksek çözünürlükte; çerçevelenmiş hâli de)</span></label>
    <details><summary>Okunan metnin tamamı</summary><pre class="tb-metin">${esc(metin || '—')}</pre></details>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-devam>Proje formunu aç</button></div>`;
  // Firma adı değişince eşleşmeyi yenile
  p.querySelectorAll('.tb-rol input[id^="tb-"]').forEach(inp => inp.addEventListener('change', () => {
    const f = inp.value.trim() ? firmaEslestir(inp.value) : null, sm = inp.parentElement.querySelector('[data-esles]');
    sm.innerHTML = f ? `Kayıtlı firma: <b>${esc(f.ad)}</b>` : inp.value.trim() ? '<label class="chk"><input type="checkbox" data-olustur checked> <span>Firmalara yeni firma olarak ekle</span></label>' : '';
  }));
  p.querySelector('[data-devam]').onclick = async () => {
    const b = p.querySelector('[data-devam]'); b.disabled = true;
    try {
      const init = { ad: p.querySelector('#tb-ad').value.trim(), il: p.querySelector('#tb-il').value || null, durum: 'Proje', santiye_asamasi: null };
      for (const [k, , alan, tip] of ROLLER) {
        const kutu = p.querySelector(`[data-rol="${k}"]`), ad = kutu.querySelector('input').value.trim(); if (!ad || init[alan]) continue;
        let f = firmaEslestir(ad);
        if (!f && kutu.querySelector('[data-olustur]')?.checked) f = await app.db.save('firmalar', { id: uuid(), ad: ad.replace(/\s+/g, ' '), tipler: [tip], il: init.il, notlar: 'Şantiye tabelasından eklendi' });
        if (f) init[alan] = f.id;
      }
      // Aynı alana düşen ikinci müellif (ör. mimar, elektrik projecisi bağlandıysa) notlarda kalır
      const ekNot = ROLLER.filter(([k, , alan]) => { const ad = p.querySelector(`[data-rol="${k}"] input`).value.trim(); return ad && !(firmaEslestir(ad)?.id === init[alan]) && ROLLER.find(r => r[2] === alan)[0] !== k && init[alan]; }).map(([k, l]) => `${l}: ${p.querySelector(`[data-rol="${k}"] input`).value.trim()}`);
      const sef = p.querySelector('#tb-sef')?.value.trim();
      if (sef && p.querySelector('#tb-sefkisi')?.checked) {
        const m = /^((in[şs]aat|elektrik|makin[ae]|mimar|harita|jeoloji)\s*(y\.?\s*)?(m[üu]hendis[ıi]|tekn[ıi]ker)|mimar)\s*/i.exec(sef), adSoyad = sef.slice(m ? m[0].length : 0).trim() || sef;
        try { await app.db.save('kisiler', { id: uuid(), firma_id: init.gemut_id || null, ad_soyad: adSoyad.toLocaleLowerCase('tr').replace(/(^|[\s.])\S/g, c => c.toLocaleUpperCase('tr')), unvan: m ? m[0].trim().toLocaleLowerCase('tr').replace(/(^|\s)\S/g, c => c.toLocaleUpperCase('tr')) : null, pozisyon: 'Şantiye şefi', notlar: 'Şantiye tabelasından' }); }
        catch (e) { toast('Şantiye şefi kişilere eklenemedi: ' + e.message, 'err'); }
      }
      if (sef) ekNot.unshift(`Şantiye şefi: ${sef}`);
      const not = p.querySelector('#tb-not').value.trim();
      init.notlar = ['Şantiye tabelasından', ...ekNot, not].filter(Boolean).join('\n');
      if (p.querySelector('#tb-foto').checked) { try { init.fotolar = [await app.db.upload(file, { max: 2560, q: 0.9 }), ...(okunacak !== file ? [await app.db.upload(okunacak, { max: 2560, q: 0.92 })] : [])]; } catch (e) { toast('Fotoğraf eklenemedi: ' + e.message, 'err'); } }
      closeDrawer();
      (await import('./views/projeler.js')).yeniProje(init);
    } catch (e) { b.disabled = false; toast('Olmadı: ' + e.message, 'err'); }
  };
}
