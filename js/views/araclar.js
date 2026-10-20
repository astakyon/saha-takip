// Aydınlatma araçları: enerji tasarrufu, hızlı aydınlatma hesabı, rakip muadil eşleştirme
import { S } from '../db.js';
import { F, saveFilters } from '../state.js';
import { esc, num, usd, urunBilgi, fold, toast, RAKIPLER, waLink } from '../ui.js';
import { ayar, ayarYaz } from '../ayar.js';
import { teklifForm } from './teklif.js';
import { kur } from '../kur.js';

const n = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(x) ? 0 : x; };
// Armatür sayılabilecek ürünler (açıklamada güç ve ışık akısı olanlar)
export function armaturler() {
  return S.urunler.map(u => ({ u, ...urunBilgi(u.aciklama) })).filter(x => x.w && x.lm).sort((a, b) => a.lm - b.lm);
}
const urunSecenek = (sec) => armaturler().map(x => `<option value="${esc(x.u.kod)}" ${x.u.kod === sec ? 'selected' : ''}>${esc(x.u.aciklama)} · ${x.w} W · ${num(x.lm)} lm${x.u.stok > 0 ? ' · stokta ' + num(x.u.stok) : ''}</option>`).join('');
const urun = kod => armaturler().find(x => x.u.kod === kod);

// Oda indeksine göre kullanım faktörü (endüstriyel yüksek tavan armatürü, yansıtma 50/30/20 için yaklaşık değerler)
const UF_TABLO = [[0.6, 0.40], [0.8, 0.48], [1, 0.53], [1.25, 0.58], [1.5, 0.62], [2, 0.67], [2.5, 0.71], [3, 0.73], [4, 0.76], [5, 0.78]];
export function kullanimFaktoru(k) {
  if (k <= UF_TABLO[0][0]) return UF_TABLO[0][1];
  for (let i = 1; i < UF_TABLO.length; i++) if (k <= UF_TABLO[i][0]) { const [k0, u0] = UF_TABLO[i - 1], [k1, u1] = UF_TABLO[i]; return u0 + (u1 - u0) * (k - k0) / (k1 - k0); }
  return UF_TABLO.at(-1)[1];
}
// N = E·A / (Φ·UF·MF)
export function aydinlatmaHesabi({ en, boy, h, lux, lm, mf = 0.8, uf }) {
  const A = en * boy, K = (en * boy) / (h * (en + boy));
  const UF = uf || kullanimFaktoru(K);
  const N = Math.max(1, Math.ceil(lux * A / (lm * UF * mf)));
  // En/boy oranına göre satır × sütun yerleşimi
  let sat = Math.max(1, Math.round(Math.sqrt(N * boy / en))), sut = Math.ceil(N / sat);
  if (sat * sut < N) sut++;
  const toplam = sat * sut;
  return { A, K, UF, N, sat, sut, toplam, araX: en / sut, araY: boy / sat, lux: toplam * lm * UF * mf / A };
}
export const LUX_HEDEF = [['Depo / raf arası', 150], ['Genel üretim', 300], ['Hassas üretim / montaj', 500], ['Ofis', 500], ['Kapalı otopark', 75], ['Spor salonu', 300], ['Market / mağaza', 500], ['Dış saha / yol', 20]];

export function araclarView(el) {
  const f = F('araclar', { sekme: 'tasarruf' });
  el.innerHTML = `<header class="vh"><div><h1>Aydınlatma araçları</h1><p class="sum">Sahada hızlı hesap: tasarruf, armatür adedi, rakip muadili</p></div></header>
    <div class="seg" role="tablist">${[['tasarruf', 'Enerji tasarrufu'], ['hesap', 'Armatür adedi'], ['muadil', 'Rakip muadili']].map(([k, t]) => `<button type="button" role="tab" data-s="${k}" class="${f.sekme === k ? 'on' : ''}" aria-selected="${f.sekme === k}">${t}</button>`).join('')}</div>
    <div class="tool" data-body></div>`;
  const ciz = () => ({ tasarruf, hesap, muadil })[f.sekme](el.querySelector('[data-body]'));
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { f.sekme = b.dataset.s; saveFilters(); el.querySelectorAll('[data-s]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); ciz(); });
  ciz();
}

// ---------- Enerji tasarrufu ----------
function tasarruf(box) {
  const v = { adet: 50, eskiW: 400, yeniKod: '', yeniW: 150, saat: 16, gun: 300, kwh: ayar('elektrik_tl_kwh', ''), kur: kur()?.USD ? Math.round(kur().USD * 100) / 100 : ayar('usd_kur', ''), fiyat: '', montaj: 0, ...(ayar('tasarruf_son') || {}) };
  box.innerHTML = `<div class="tool-grid"><form class="card form" data-f>
      <h2>Mevcut sistem</h2>
      <div class="grid"><div class="fld"><label for="t-adet">Armatür adedi</label><input id="t-adet" name="adet" type="number" inputmode="numeric" value="${v.adet}"></div>
      <div class="fld"><label for="t-ew">Mevcut armatür gücü (W)</label><input id="t-ew" name="eskiW" type="number" inputmode="decimal" value="${v.eskiW}"><small>Balast kaybı dahil. Örn. 400 W metal halide ≈ 440 W</small></div></div>
      <div class="chips">${[['250 W MH', 280], ['400 W MH', 440], ['1000 W MH', 1080], ['2×58 W floresan', 135], ['4×18 W floresan', 85], ['150 W sodyum', 170]].map(([t, w]) => `<button type="button" class="chip" data-eski="${w}">${t}</button>`).join('')}</div>
      <h2>Yeni sistem</h2>
      <div class="fld"><label for="t-u">Önerilen ürün</label><select id="t-u" name="yeniKod"><option value="">Elle gir</option>${urunSecenek(v.yeniKod)}</select></div>
      <div class="grid"><div class="fld"><label for="t-yw">Yeni armatür gücü (W)</label><input id="t-yw" name="yeniW" type="number" inputmode="decimal" value="${v.yeniW}"></div>
      <div class="fld"><label for="t-f">Yeni armatür birim fiyatı (USD)</label><input id="t-f" name="fiyat" type="number" inputmode="decimal" value="${v.fiyat}"></div>
      <div class="fld"><label for="t-m">Montaj / armatür (USD)</label><input id="t-m" name="montaj" type="number" inputmode="decimal" value="${v.montaj}"></div></div>
      <h2>Kullanım ve tarife</h2>
      <div class="grid"><div class="fld"><label for="t-s">Günlük çalışma (saat)</label><input id="t-s" name="saat" type="number" inputmode="decimal" value="${v.saat}"></div>
      <div class="fld"><label for="t-g">Yılda çalışılan gün</label><input id="t-g" name="gun" type="number" inputmode="numeric" value="${v.gun}"></div>
      <div class="fld"><label for="t-k">Elektrik birim fiyatı (TL/kWh)</label><input id="t-k" name="kwh" type="number" inputmode="decimal" step="0.01" value="${v.kwh}" placeholder="Faturadaki vergiler dahil"></div>
      <div class="fld"><label for="t-kur">Dolar kuru (TL)</label><input id="t-kur" name="kur" type="number" inputmode="decimal" step="0.01" value="${v.kur}"></div></div>
    </form>
    <section class="card result" data-r aria-live="polite"></section></div>`;
  const form = box.querySelector('[data-f]'), r = box.querySelector('[data-r]');
  const oku = () => Object.fromEntries([...new FormData(form)].map(([k, x]) => [k, k === 'yeniKod' ? x : n(x)]));
  const hesap = () => {
    const o = oku();
    const u = urun(o.yeniKod);
    const eskiKwh = o.adet * o.eskiW * o.saat * o.gun / 1000, yeniKwh = o.adet * o.yeniW * o.saat * o.gun / 1000, fark = eskiKwh - yeniKwh;
    const tl = fark * o.kwh, usdT = o.kur ? tl / o.kur : 0;
    const yatirim = o.adet * (o.fiyat + o.montaj);
    const ay = usdT > 0 && yatirim ? yatirim / usdT * 12 : null;
    const co2 = fark * 0.44 / 1000; // ton; Türkiye şebekesi için yaklaşık 0,44 kg CO₂/kWh
    const ozet = `${o.adet} adet ${o.eskiW} W armatür yerine ${u ? u.u.aciklama + ' (' + o.yeniW + ' W)' : o.yeniW + ' W LED'}: yılda ${num(Math.round(fark))} kWh (%${num(Math.round(fark / eskiKwh * 100))}) daha az tüketim` + (o.kwh ? `, yaklaşık ${num(Math.round(tl))} TL${usdT ? ' (' + usd(usdT) + ')' : ''} tasarruf` : '') + (ay ? `. Yatırım kendini yaklaşık ${num(Math.round(ay * 10) / 10)} ayda öder.` : '.') + ` Yıllık ${num(Math.round(co2 * 10) / 10)} ton daha az CO₂.`;
    r.innerHTML = `<h2>Sonuç</h2>
      <dl class="big-kv"><div><dt>Yıllık enerji tasarrufu</dt><dd>${num(Math.round(fark))} kWh</dd><small>%${eskiKwh ? num(Math.round(fark / eskiKwh * 100)) : 0} daha az · ${num(Math.round(eskiKwh))} → ${num(Math.round(yeniKwh))} kWh</small></div>
      <div><dt>Yıllık para tasarrufu</dt><dd>${o.kwh ? num(Math.round(tl)) + ' TL' : '—'}</dd><small>${usdT ? usd(usdT) : o.kwh ? 'Dolar karşılığı için kuru gir' : 'Elektrik birim fiyatını gir'}</small></div>
      <div><dt>Geri dönüş süresi</dt><dd>${ay ? num(Math.round(ay * 10) / 10) + ' ay' : '—'}</dd><small>${yatirim ? 'Yatırım ' + usd(yatirim) : 'Birim fiyatı girersen hesaplanır'}</small></div>
      <div><dt>Karbon azaltımı</dt><dd>${num(Math.round(co2 * 10) / 10)} ton/yıl</dd><small>0,44 kg CO₂/kWh ile yaklaşık</small></div></dl>
      ${u ? `<p class="hint">${esc(u.u.aciklama)}: ${num(u.lm)} lm, ${u.verim} lm/W${u.u.stok > 0 ? ', bayide ' + num(u.u.stok) + ' adet stokta' : ''}.</p>` : ''}
      <p class="ozet" data-ozet>${esc(ozet)}</p>
      <div class="btnrow"><button type="button" class="btn" data-kopya>Özeti kopyala</button><a class="btn ghost" target="_blank" rel="noopener" href="${waLink('', ozet)}">WhatsApp'ta paylaş</a>${u ? '<button type="button" class="btn primary" data-teklif>Bu ürünle teklif hazırla</button>' : ''}</div>`;
    r.querySelector('[data-kopya]').onclick = async () => { try { await navigator.clipboard.writeText(ozet); toast('Özet kopyalandı.'); } catch { toast('Kopyalanamadı.', 'err'); } };
    r.querySelector('[data-teklif]')?.addEventListener('click', () => teklifForm({ kalemler: [{ kod: u.u.kod, ad: u.u.aciklama, adet: o.adet, birim_fiyat: o.fiyat || u.u.birim_fiyat_usd || 0 }], notlar: ozet }));
    clearTimeout(hesap.t); hesap.t = setTimeout(() => { ayarYaz('tasarruf_son', { adet: o.adet, eskiW: o.eskiW, yeniKod: o.yeniKod, yeniW: o.yeniW, saat: o.saat, gun: o.gun, fiyat: o.fiyat, montaj: o.montaj }); if (o.kwh) ayarYaz('elektrik_tl_kwh', o.kwh); if (o.kur) ayarYaz('usd_kur', o.kur); }, 1500);
  };
  form.oninput = hesap;
  form.querySelector('[name=yeniKod]').onchange = e => { const u = urun(e.target.value); if (u) { form.yeniW.value = u.w; if (u.u.birim_fiyat_usd) form.fiyat.value = u.u.birim_fiyat_usd; } hesap(); };
  box.querySelectorAll('[data-eski]').forEach(b => b.onclick = () => { form.eskiW.value = b.dataset.eski; hesap(); });
  hesap();
}

// ---------- Armatür adedi (lümen yöntemi) ----------
function hesap(box) {
  const v = { en: 40, boy: 60, h: 10, lux: 300, kod: '', lm: 20000, mf: 0.8, ...(ayar('hesap_son') || {}) };
  box.innerHTML = `<div class="tool-grid"><form class="card form" data-f>
      <h2>Alan</h2>
      <div class="grid"><div class="fld"><label for="h-en">En (m)</label><input id="h-en" name="en" type="number" inputmode="decimal" value="${v.en}"></div>
      <div class="fld"><label for="h-boy">Boy (m)</label><input id="h-boy" name="boy" type="number" inputmode="decimal" value="${v.boy}"></div>
      <div class="fld"><label for="h-h">Montaj yüksekliği (m)</label><input id="h-h" name="h" type="number" inputmode="decimal" value="${v.h}"><small>Çalışma düzlemi (0,8 m) ile armatür arası</small></div>
      <div class="fld"><label for="h-l">Hedef aydınlık düzeyi (lüks)</label><input id="h-l" name="lux" type="number" inputmode="numeric" value="${v.lux}"></div></div>
      <div class="chips">${LUX_HEDEF.map(([t, l]) => `<button type="button" class="chip" data-lux="${l}">${t} · ${l} lx</button>`).join('')}</div>
      <h2>Armatür</h2>
      <div class="fld"><label for="h-u">Ürün</label><select id="h-u" name="kod"><option value="">Elle gir</option>${urunSecenek(v.kod)}</select></div>
      <div class="grid"><div class="fld"><label for="h-lm">Armatür ışık akısı (lm)</label><input id="h-lm" name="lm" type="number" inputmode="numeric" value="${v.lm}"></div>
      <div class="fld"><label for="h-mf">Bakım faktörü</label><select id="h-mf" name="mf">${[[0.8, '0,80 · temiz ortam'], [0.7, '0,70 · normal sanayi'], [0.6, '0,60 · tozlu / kirli']].map(([x, t]) => `<option value="${x}" ${+v.mf === x ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    </form>
    <section class="card result" data-r aria-live="polite"></section></div>`;
  const form = box.querySelector('[data-f]'), r = box.querySelector('[data-r]');
  const ciz = () => {
    const o = Object.fromEntries([...new FormData(form)].map(([k, x]) => [k, k === 'kod' ? x : n(x)]));
    if (!(o.en > 0 && o.boy > 0 && o.h > 0 && o.lux > 0 && o.lm > 0)) { r.innerHTML = '<p class="hint">Ölçüleri ve armatür ışık akısını gir.</p>'; return; }
    const x = aydinlatmaHesabi(o), u = urun(o.kod);
    const sut = Math.min(x.sut, 24), sat = Math.min(x.sat, 16);
    const W = u ? u.w : null;
    r.innerHTML = `<h2>Sonuç</h2>
      <dl class="big-kv"><div><dt>Gereken armatür</dt><dd>${x.toplam} adet</dd><small>Hesaplanan ${x.N}; ${x.sat} sıra × ${x.sut} armatür yerleşim</small></div>
      <div><dt>Ortalama aydınlık düzeyi</dt><dd>${num(Math.round(x.lux))} lx</dd><small>Hedef ${num(o.lux)} lx</small></div>
      <div><dt>Armatür aralığı</dt><dd>${num(Math.round(x.araX * 10) / 10)} × ${num(Math.round(x.araY * 10) / 10)} m</dd><small>${Math.max(x.araX, x.araY) > o.h * 1.5 ? 'Aralık yüksekliğin 1,5 katından fazla: düzgünlük düşebilir, daha düşük güçte daha çok armatür düşün.' : 'Aralık / yükseklik oranı uygun'}</small></div>
      <div><dt>Toplam güç</dt><dd>${W ? num(x.toplam * W / 1000) + ' kW' : '—'}</dd><small>${W ? num(Math.round(x.toplam * W / x.A * 10) / 10) + ' W/m²' : 'Ürün seçersen hesaplanır'}</small></div></dl>
      <svg class="yerlesim" viewBox="0 0 ${o.en} ${o.boy}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${x.sat} sıra × ${x.sut} armatür yerleşim planı"><rect x="0" y="0" width="${o.en}" height="${o.boy}" class="oda"/>
        ${Array.from({ length: sat }, (_, i) => Array.from({ length: sut }, (_, j) => `<circle cx="${(j + 0.5) * o.en / sut}" cy="${(i + 0.5) * o.boy / sat}" r="${Math.min(o.en, o.boy) / 60 + 0.2}"/>`).join('')).join('')}</svg>
      <p class="hint">Alan ${num(x.A)} m² · oda indeksi ${num(Math.round(x.K * 100) / 100)} · kullanım faktörü ${num(Math.round(x.UF * 100) / 100)}. Lümen yöntemiyle ön hesaptır; kesin proje için DIALux / Relux hesabı yapılmalı.</p>
      ${u ? '<div class="btnrow"><button type="button" class="btn primary" data-teklif>Bu adetle teklif hazırla</button></div>' : ''}`;
    r.querySelector('[data-teklif]')?.addEventListener('click', () => teklifForm({ kalemler: [{ kod: u.u.kod, ad: u.u.aciklama, adet: x.toplam, birim_fiyat: u.u.birim_fiyat_usd || 0 }], notlar: `${num(o.en)} × ${num(o.boy)} m alan, ${num(o.h)} m montaj yüksekliği, hedef ${num(o.lux)} lx: hesaplanan ortalama ${num(Math.round(x.lux))} lx.` }));
    clearTimeout(ciz.t); ciz.t = setTimeout(() => ayarYaz('hesap_son', o), 1500);
  };
  form.oninput = ciz;
  form.querySelector('[name=kod]').onchange = e => { const u = urun(e.target.value); if (u) form.lm.value = u.lm; ciz(); };
  box.querySelectorAll('[data-lux]').forEach(b => b.onclick = () => { form.lux.value = b.dataset.lux; ciz(); });
  ciz();
}

// ---------- Rakip muadili ----------
export function muadilBul({ w, lm, k, aile } = {}) {
  const hedef = lm || (w ? w * 140 : 0);
  if (!hedef) return [];
  return armaturler().filter(x => Math.abs(x.lm - hedef) / hedef <= 0.2 && (!k || !x.k || Math.abs(x.k - k) <= 1000) && (!aile || fold(x.u.aile) === fold(aile)))
    .map(x => ({ ...x, fark: (x.lm - hedef) / hedef, gucFark: w ? (x.w - w) / w : null }))
    .sort((a, b) => (b.u.stok > 0) - (a.u.stok > 0) || Math.abs(a.fark) - Math.abs(b.fark) || b.verim - a.verim);
}
function muadil(box) {
  const v = { marka: '', model: '', w: '', lm: '', k: '', fiyat: '', aile: '', ...(ayar('muadil_son') || {}) };
  const aileler = [...new Set(armaturler().map(x => x.u.aile))].sort();
  box.innerHTML = `<div class="tool-grid"><form class="card form" data-f>
      <h2>Rakip ürün</h2>
      <div class="grid"><div class="fld"><label for="m-m">Marka</label><input id="m-m" name="marka" list="m-ml" value="${esc(v.marka)}"><datalist id="m-ml">${RAKIPLER.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="fld"><label for="m-mo">Model</label><input id="m-mo" name="model" value="${esc(v.model)}" placeholder="Örn. BY698P"></div>
      <div class="fld"><label for="m-w">Güç (W)</label><input id="m-w" name="w" type="number" inputmode="decimal" value="${v.w}"></div>
      <div class="fld"><label for="m-lm">Işık akısı (lm)</label><input id="m-lm" name="lm" type="number" inputmode="numeric" value="${v.lm}"><small>Bilinmiyorsa boş bırak; güçten 140 lm/W ile tahmin edilir</small></div>
      <div class="fld"><label for="m-k">Renk sıcaklığı (K)</label><select id="m-k" name="k"><option value="">Fark etmez</option>${[3000, 4000, 5000, 5700, 6500].map(x => `<option ${+v.k === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="fld"><label for="m-f">Rakip birim fiyatı (USD)</label><input id="m-f" name="fiyat" type="number" inputmode="decimal" value="${v.fiyat}"></div>
      <div class="fld"><label for="m-a">Bizim ürün ailesi</label><select id="m-a" name="aile"><option value="">Tümü</option>${aileler.map(a => `<option ${a === v.aile ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div></div>
    </form>
    <section class="card result" data-r aria-live="polite"></section></div>`;
  const form = box.querySelector('[data-f]'), r = box.querySelector('[data-r]');
  const ciz = () => {
    const o = Object.fromEntries(new FormData(form)); const w = n(o.w), lm = n(o.lm), k = n(o.k), rf = n(o.fiyat);
    if (!w && !lm) { r.innerHTML = '<p class="hint">Rakip ürünün gücünü ya da ışık akısını gir; ürün listemizden en yakın muadilleri bulayım.</p>'; return; }
    const l = muadilBul({ w, lm, k, aile: o.aile });
    const rp = S.rakip_fiyatlar.filter(x => o.marka && fold(x.marka) === fold(o.marka));
    r.innerHTML = `<h2>Muadil ürünlerimiz <span class="muted">${l.length}</span></h2>
      ${l.length ? `<ul class="list muadil">${l.slice(0, 12).map(x => `<li><span><b>${esc(x.u.aciklama)}</b><small class="muted">${x.w} W · ${num(x.lm)} lm · ${x.verim} lm/W${x.k ? ' · ' + x.k + ' K' : ''} · ışık ${Math.round(x.fark * 100) ? (x.fark > 0 ? '+' : '') + num(Math.round(x.fark * 100)) + '%' : 'aynı'}${x.gucFark != null ? ` · güç ${Math.round(x.gucFark * 100) ? (x.gucFark > 0 ? '+' : '') + num(Math.round(x.gucFark * 100)) + '%' : 'aynı'}` : ''}</small></span>
        <span class="r"><b class="num">${x.u.birim_fiyat_usd ? num(x.u.birim_fiyat_usd) + ' $' : '—'}</b><small class="${x.u.stok > 0 ? 'pos' : 'muted'}">${x.u.stok > 0 ? 'stokta ' + num(x.u.stok) : 'stok yok'}</small>${rf && x.u.birim_fiyat_usd ? `<small>${x.u.birim_fiyat_usd <= rf ? 'rakipten %' + num(Math.round((rf - x.u.birim_fiyat_usd) / rf * 100)) + ' ucuz' : 'rakipten %' + num(Math.round((x.u.birim_fiyat_usd - rf) / rf * 100)) + ' pahalı'}</small>` : ''}</span>
        <button type="button" class="btn sm" data-t="${esc(x.u.kod)}">Teklif</button></li>`).join('')}</ul>`
      : '<p class="hint">±%20 ışık akısı aralığında ürünümüz bulunamadı. Aile filtresini kaldırmayı ya da renk sıcaklığını “Fark etmez” yapmayı dene.</p>'}
      ${rp.length ? `<h3>${esc(o.marka)} için kayıtlı rakip fiyatları</h3><ul class="list">${rp.slice(0, 6).map(x => `<li><span>${esc([x.urun_adi, x.aile, x.lumen_aralik].filter(Boolean).join(' · '))}</span><b class="num">${esc(x.fiyat_metin || (x.birim_fiyat + ' ' + (x.para_birimi || '')))}</b></li>`).join('')}</ul>` : ''}
      ${o.marka && rf ? '<div class="btnrow"><button type="button" class="btn ghost" data-kaydet>Rakip fiyatını kaydet</button></div>' : ''}
      <p class="hint">Eşleştirme açıklamadaki güç ve lümen bilgisine göre yapılır; optik açı, IP ve sürücü özelliklerini ayrıca kontrol et.</p>`;
    r.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const x = urun(b.dataset.t); teklifForm({ kalemler: [{ kod: x.u.kod, ad: x.u.aciklama, adet: 1, birim_fiyat: x.u.birim_fiyat_usd || 0 }], notlar: o.marka ? [o.marka, o.model, 'muadili'].filter(Boolean).join(' ') : '' }); });
    r.querySelector('[data-kaydet]')?.addEventListener('click', async () => {
      const { app } = await import('../state.js');
      await app.db.save('rakip_fiyatlar', { marka: o.marka, urun_adi: [o.model, w ? w + ' W' : ''].filter(Boolean).join(' '), aile: l[0]?.u.aile || o.aile || null, birim_fiyat: rf, para_birimi: 'USD', fiyat_metin: rf + ' USD', tarih: new Date().toISOString().slice(0, 10), kaynak: 'Müşteri' });
      toast('Rakip fiyatı kaydedildi.');
    });
    clearTimeout(ciz.t); ciz.t = setTimeout(() => ayarYaz('muadil_son', o), 1500);
  };
  form.oninput = ciz; form.onchange = e => { if (e.target.tagName === 'SELECT') ciz(); };
  ciz();
}
