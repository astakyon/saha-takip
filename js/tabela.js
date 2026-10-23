// Şantiye tabelasından proje: tabelanın fotoğrafındaki yazı okunur (kartvizitteki okuma motoru),
// proje adı, yapı sahibi / yatırımcı, müteahhit, proje müellifi, elektrik yüklenicisi, yapı denetim, ruhsat ve ada-parsel ayrılır.
// Firmalar kayıtlı firmalarla eşleştirilir; olmayanlar istenirse oluşturulur, sonra yeni proje formu dolu açılır.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, closeDrawer, pickFiles, fold } from './ui.js';

const ETIKET = [
  ['ad', /^(proje(nin)?\s*ad[ıi]|i[şs]in\s*ad[ıi]|yap[ıi]n[ıi]n\s*ad[ıi]|proje|tesis\s*ad[ıi])\b/],
  ['yatirimci', /^(yap[ıi]\s*sahib[ıi]|i[şs]veren|yat[ıi]r[ıi]mc[ıi]|mal\s*sahib[ıi]|idare|ruhsat\s*sahib[ıi])\b/],
  ['emut', /^(elektrik\s*(tesisat[ıi]?\s*)?(y[üu]klenici(si)?|m[üu]teahhid?i?|uygulama)|elektrik\s*taahh[üu]t)\b/],
  ['gemut', /^(y[üu]klenici(\s*firma)?|m[üu]teahhit|m[üu]teahhid[ıi]|ana\s*y[üu]klenici|genel\s*m[üu]teahhit|uygulay[ıi]c[ıi]|yap[ıi]mc[ıi])\b/],
  ['elektrik_proje', /^(elektrik\s*proje(si)?(\s*m[üu]ellif[ıi])?)\b/],
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
const ILLER = ['Adana', 'Mersin', 'Hatay', 'Osmaniye'];
const temizle = s => String(s || '').replace(/[|_~•·“”"]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

export function tabelaAyristir(metin) {
  const satirlar = String(metin || '').split(/\n+/).map(temizle).filter(s => s.length > 1);
  const o = {};
  const etiketi = s => { const f = fold(s); for (const [k, re] of ETIKET) { const m = re.exec(f); if (m) return [k, m[0].length]; } return null; };
  for (let i = 0; i < satirlar.length; i++) {
    const sat = satirlar[i], e = etiketi(sat); if (!e || o[e[0]]) continue;
    let deger = sat.slice(e[1]).replace(/^[\s:;=\-–.]+/, '').trim();
    if (deger.length < 2) { const s2 = satirlar[i + 1]; if (s2 && !etiketi(s2)) { deger = s2; i++; } else deger = ''; }
    if (deger) o[e[0]] = temizle(deger);
  }
  // Proje adı etiketsiz yazılmışsa: en büyük harfli, firma ya da adres olmayan ilk satır
  if (!o.ad) o.ad = satirlar.find(s => s.length >= 8 && s === s.toLocaleUpperCase('tr') && !/(ltd|şti|a\.ş|inşaat|insaat|tel|www|@|\d{3}\s?\d{3})/i.test(s) && !etiketi(s)) || '';
  o.ad = o.ad ? o.ad.toLocaleLowerCase('tr').replace(/(^|\s)\S/g, c => c.toLocaleUpperCase('tr')) : '';
  const tum = satirlar.join(' ');
  o.il = ILLER.find(il => new RegExp(il, 'i').test(fold(tum)) || fold(tum).includes(fold(il))) || '';
  return o;
}

// Kayıtlı firmayla eşleştir (unvan eklerini yok sayarak)
const EK = /\b(ltd|sti|şti|a ?s|anonim|limited|sirketi|şirketi|san|sanayi|tic|ticaret|insaat|inşaat|muh|muhendislik|mühendislik|taahhut|taahhüt|elektrik|enerji|yapi|yapı|ve|ins|ltd sti)\b/g;
const cekirdek = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(EK, ' ').replace(/\s+/g, ' ').trim();
export function firmaEslestir(ad) {
  const c = cekirdek(ad); if (c.length < 3) return null;
  return S.firmalar.find(f => cekirdek(f.ad) === c) || S.firmalar.find(f => { const x = cekirdek(f.ad); return x.length >= 4 && (x.startsWith(c) || c.startsWith(x)); }) || null;
}

const ROLLER = [['yatirimci', 'Yatırımcı / yapı sahibi', 'yatirimci_id', 'Yatırımcı'], ['gemut', 'Müteahhit (Gemüt)', 'gemut_id', 'Gemüt'], ['emut', 'Elektrik yüklenicisi (Emüt)', 'emut_id', 'Emüt'], ['projeci', 'Proje müellifi', 'projeci_id', 'Proje Bürosu'], ['elektrik_proje', 'Elektrik projesi', 'projeci_id', 'Proje Bürosu'], ['danisman', 'Kontrollük / danışman', 'danisman_id', 'Danışman']];
const BILGI = [['denetim', 'Yapı denetim'], ['ruhsat', 'Ruhsat'], ['parsel', 'Ada / parsel'], ['baslama', 'Başlama'], ['bitis', 'Bitiş'], ['bedel', 'Bedel'], ['alan', 'İnşaat alanı'], ['adres', 'Adres']];

export async function tabeladanProje() {
  const [file] = await pickFiles({ capture: true, multiple: false }); if (!file) return;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Yeni proje</p><h2 id="drawer-title">Şantiye tabelası</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><div class="tb-foto"><img alt="Tabela fotoğrafı" src="${URL.createObjectURL(file)}"></div><div data-durum aria-live="polite"><p class="hint">Tabeladaki yazı okunuyor… (ilk seferde okuma motoru indirilir, ~15 MB)</p><progress max="1" value="0"></progress></div><div data-alanlar></div></div>`, { wide: true });
  let o, metin = '';
  try { const { metinOku } = await import('./ocr.js'); metin = await metinOku(file, (s, v) => { const pr = p.querySelector('progress'); if (pr && v != null) pr.value = v; }); o = tabelaAyristir(metin); }
  catch (e) { p.querySelector('[data-durum]').innerHTML = `<p class="warn">Okunamadı: ${esc(e.message)}. Alanları elle doldurabilirsin.</p>`; o = {}; }
  if (!p.isConnected) return;
  const bulunan = ROLLER.filter(([k]) => o[k]).length + (o.ad ? 1 : 0);
  p.querySelector('[data-durum]').innerHTML = `<p class="hint">${bulunan ? `${bulunan} alan okundu. Kontrol et, yanlışları düzelt.` : 'Tabeladan alan ayrılamadı. Fotoğraf net değilse yeniden çek ya da alanları elle doldur.'}</p>`;
  p.querySelector('[data-alanlar]').innerHTML = `
    <div class="fld"><label for="tb-ad">Proje adı</label><input id="tb-ad" value="${esc(o.ad || '')}"></div>
    ${ROLLER.map(([k, l]) => { const f = o[k] ? firmaEslestir(o[k]) : null; return `<div class="fld tb-rol" data-rol="${k}"><label for="tb-${k}">${l}</label><input id="tb-${k}" value="${esc(o[k] || '')}" placeholder="—">
      <small data-esles>${f ? `Kayıtlı firma: <b>${esc(f.ad)}</b>` : o[k] ? '<label class="chk"><input type="checkbox" data-olustur checked> <span>Firmalara yeni firma olarak ekle</span></label>' : ''}</small></div>`; }).join('')}
    <div class="grid"><div class="fld"><label for="tb-il">İl</label><select id="tb-il"><option value="">—</option>${ILLER.map(i => `<option ${o.il === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div></div>
    ${BILGI.some(([k]) => o[k]) ? `<div class="fld"><label>Tabeladaki diğer bilgiler (projenin notlarına eklenir)</label><textarea id="tb-not" rows="4">${esc(BILGI.filter(([k]) => o[k]).map(([k, l]) => `${l}: ${o[k]}`).join('\n'))}</textarea></div>` : '<textarea id="tb-not" hidden></textarea>'}
    <label class="chk"><input type="checkbox" id="tb-foto" checked> <span>Tabela fotoğrafını projeye ekle</span></label>
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
      const not = p.querySelector('#tb-not').value.trim();
      init.notlar = ['Şantiye tabelasından', not].filter(Boolean).join('\n');
      if (p.querySelector('#tb-foto').checked) { try { init.fotolar = [await app.db.upload(file)]; } catch (e) { toast('Fotoğraf eklenemedi: ' + e.message, 'err'); } }
      closeDrawer();
      (await import('./views/projeler.js')).yeniProje(init);
    } catch (e) { b.disabled = false; toast('Olmadı: ' + e.message, 'err'); }
  };
}
