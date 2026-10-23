// Kurulum sihirbazı: yeni hesabın ilk açılışında firma, sektör, bölge, bayi ve rakipler sorulur; uygulama buna göre ayarlanır.
// Ayarlar → Firma profili'nden aynı bilgiler sonradan değiştirilebilir.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, fold } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';
import { profil, profilVar, SEKTOR, SEKTOR_LISTE, TUM_ILLER } from './profil.js';
import { listeleriUygula } from './listeler.js';

// Gösterilmeli mi: veri sahibi, profili yok, henüz kaydı yok
export const sihirbazGerekli = () => !profilVar() && (!app.yetki || app.yetki.ben_sahip !== false) && !(S.projeler.length || S.firmalar.length || S.ziyaretler.length);

const ADIM = ['Firma', 'Sektör', 'Bölge', 'Bayi ve rakipler', 'Hazır'];
export function sihirbazAc({ sonra, duzenle = false } = {}) {
  const p0 = duzenle || profilVar() ? profil() : null, tf = ayar('teklif_firma') || {};
  const d = {
    firma: p0?.firma || tf.ad || '', ad: ayar('benim_adim') || '', tel: '', eposta: /@/.test(app.db?.user?.()?.email || '') ? app.db.user().email : '',
    sektor: p0?.sektor || '', marka: p0?.marka || '', iller: [...(p0?.iller || [])], bayi: p0?.bayi || '',
    rakipler: ayar('listeler', {})?.RAKIPLER ? [...ayar('listeler', {}).RAKIPLER] : null,
  };
  const ilet = String(tf.iletisim || ''); d.tel = (/(\+?\d[\d\s()-]{8,})/.exec(ilet) || [''])[0].trim(); if (!d.eposta) d.eposta = (/\S+@\S+/.exec(ilet) || [''])[0];
  let adim = 0, ara = '';
  const kok = document.createElement('div'); kok.className = 'sihirbaz'; kok.setAttribute('role', 'dialog'); kok.setAttribute('aria-modal', 'true'); kok.setAttribute('aria-label', 'Kurulum');
  document.body.appendChild(kok);
  const kapat = () => { kok.remove(); document.body.classList.remove('sihirbaz-acik'); };
  document.body.classList.add('sihirbaz-acik');

  const govde = () => {
    if (adim === 0) return `<h2>${duzenle ? 'Firma bilgilerin' : 'Hoş geldin! Önce seni tanıyalım'}</h2><p class="muted">Bu bilgiler tekliflerde, WhatsApp mesajlarında ve sunumlarda kullanılır.</p>
      <div class="fld"><label for="sz-firma">Firma adı *</label><input id="sz-firma" value="${esc(d.firma)}" placeholder="Örn. Yıldız Elektrik" autocomplete="organization"></div>
      <div class="fld"><label for="sz-ad">Adın soyadın</label><input id="sz-ad" value="${esc(d.ad)}" placeholder="Örn. Ali Yılmaz" autocomplete="name"></div>
      <div class="grid"><div class="fld"><label for="sz-tel">Telefon</label><input id="sz-tel" type="tel" value="${esc(d.tel)}" autocomplete="tel"></div><div class="fld"><label for="sz-ep">E-posta</label><input id="sz-ep" type="email" value="${esc(d.eposta)}" autocomplete="email"></div></div>`;
    if (adim === 1) return `<h2>Ne satıyorsun?</h2><p class="muted">Seçimine göre rakip markalar, ürün grupları ve araçlar hazırlanır.</p>
      <div class="sz-kartlar" role="radiogroup" aria-label="Sektör">${Object.entries(SEKTOR).map(([k, t]) => `<button type="button" role="radio" aria-checked="${d.sektor === k}" class="sz-kart ${d.sektor === k ? 'on' : ''}" data-sektor="${k}"><b>${t}</b><small>${k === 'aydinlatma' ? 'Armatür, LED, proje aydınlatması' : k === 'elektrik' ? 'Kablo, şalt, pano, anahtar-priz, tesisat' : 'Listeleri kendin oluşturursun'}</small></button>`).join('')}</div>
      <div class="fld"><label for="sz-marka">Temsil ettiğin marka ya da üretici</label><input id="sz-marka" value="${esc(d.marka)}" placeholder="Örn. bir üreticinin bölge temsilcisiysen markası"><small>Birçok markayı satan bir bayiysen boş bırak.</small></div>`;
    if (adim === 2) { const q = fold(ara); const liste = TUM_ILLER.filter(il => !q || fold(il).includes(q)); return `<h2>Hangi illerde çalışıyorsun?</h2><p class="muted">Harita, il filtreleri ve konum bulma bu illere göre çalışır. Sonra değiştirebilirsin.</p>
      <div class="sz-secili">${d.iller.length ? d.iller.map(il => `<button type="button" class="chip on" data-ilsil="${esc(il)}">${esc(il)} ×</button>`).join('') : '<span class="hint">Henüz il seçmedin.</span>'}</div>
      <input type="search" id="sz-ara" placeholder="İl ara" value="${esc(ara)}" aria-label="İl ara">
      <div class="sz-iller chips">${liste.map(il => `<button type="button" class="chip ${d.iller.includes(il) ? 'on' : ''}" data-il="${esc(il)}">${esc(il)}</button>`).join('')}</div>`; }
    if (adim === 3) { const r = d.rakipler ?? [...(SEKTOR_LISTE[d.sektor] || SEKTOR_LISTE.diger).RAKIPLER]; d.rakipler = r; return `<h2>Bayin ve rakiplerin</h2>
      <div class="fld"><label for="sz-bayi">Ürünleri bir bayi üzerinden mi satıyorsun?</label><input id="sz-bayi" value="${esc(d.bayi)}" placeholder="Ana bayinin adı (isteğe bağlı)"><small>Yazarsan firmalara eklenir, yeni projelerde varsayılan bayi olur ve siparişleri "bayi üzerinden / harici" diye ayırabilirsin.</small></div>
      <div class="fld"><label>Rakip markalar</label><div class="chips sz-rakip">${r.map((m, i) => `<button type="button" class="chip on" data-rsil="${i}">${esc(m)} ×</button>`).join('') || '<span class="hint">Liste boş.</span>'}</div>
        <div class="liste-ekle"><input id="sz-rakip" placeholder="Rakip marka ekle"><button type="button" class="btn sm" data-rekle>Ekle</button></div><small>Kaybedilen projelerde ve rakip fiyat takibinde bu liste çıkar.</small></div>`; }
    return `<h2>Hazır</h2><ul class="sz-ozet">
      <li><b>${esc(d.firma)}</b>${d.ad ? ' · ' + esc(d.ad) : ''}</li>
      <li>${esc(SEKTOR[d.sektor] || '')}${d.marka ? ' · ' + esc(d.marka) : ''}</li>
      <li>${esc(d.iller.join(', '))}</li>
      ${d.bayi ? `<li>Ana bayi: ${esc(d.bayi)}</li>` : ''}<li>${d.rakipler.length} rakip marka</li></ul>
      <p class="muted">${duzenle ? 'Kaydedince uygulama yeni bilgilere göre ayarlanır.' : 'Başladıktan sonra ilk iş olarak firmalarını ve projelerini ekleyebilir, elindeki Excel listelerini Ayarlar → Veri bölümünden içe aktarabilirsin.'}</p>`;
  };
  const ciz = () => {
    kok.innerHTML = `<div class="sz-kutu"><div class="sz-ust"><span class="bulb" aria-hidden="true"></span><b>Saha Takip</b><span class="sz-adim">${adim + 1} / ${ADIM.length}</span>${duzenle ? '<button type="button" class="x" data-kapat aria-label="Kapat">×</button>' : ''}</div>
      <ol class="sz-cizgi" aria-hidden="true">${ADIM.map((a, i) => `<li class="${i < adim ? 'bitti' : i === adim ? 'simdi' : ''}">${a}</li>`).join('')}</ol>
      <div class="sz-govde form">${govde()}</div>
      <div class="sz-alt">${adim ? '<button type="button" class="btn ghost" data-geri>Geri</button>' : '<span></span>'}<button type="button" class="btn primary" data-ileri>${adim === ADIM.length - 1 ? (duzenle ? 'Kaydet' : 'Başla') : 'Devam'}</button></div></div>`;
    kok.querySelector('[data-kapat]')?.addEventListener('click', kapat);
    kok.querySelector('[data-geri]')?.addEventListener('click', () => { oku(); adim--; ciz(); });
    kok.querySelector('[data-ileri]').onclick = ileri;
    kok.querySelectorAll('[data-sektor]').forEach(b => b.onclick = () => { if (d.sektor !== b.dataset.sektor) d.rakipler = null; d.sektor = b.dataset.sektor; oku(); ciz(); });
    kok.querySelectorAll('[data-il]').forEach(b => b.onclick = () => { const il = b.dataset.il; d.iller = d.iller.includes(il) ? d.iller.filter(x => x !== il) : [...d.iller, il]; ciz(); kok.querySelector('#sz-ara')?.focus(); });
    kok.querySelectorAll('[data-ilsil]').forEach(b => b.onclick = () => { d.iller = d.iller.filter(x => x !== b.dataset.ilsil); ciz(); });
    const a = kok.querySelector('#sz-ara'); if (a) { a.oninput = () => { ara = a.value; const pos = a.selectionStart; ciz(); const y = kok.querySelector('#sz-ara'); y.focus(); y.setSelectionRange(pos, pos); }; a.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const ilk = kok.querySelector('[data-il]:not(.on)'); ilk?.click(); ara = ''; ciz(); kok.querySelector('#sz-ara')?.focus(); } }; }
    kok.querySelectorAll('[data-rsil]').forEach(b => b.onclick = () => { oku(); d.rakipler.splice(+b.dataset.rsil, 1); ciz(); });
    const rEkle = () => { const i = kok.querySelector('#sz-rakip'); const v = i.value.trim(); oku(); if (v && !d.rakipler.some(x => fold(x) === fold(v))) d.rakipler.push(v); ciz(); kok.querySelector('#sz-rakip')?.focus(); };
    kok.querySelector('[data-rekle]')?.addEventListener('click', rEkle);
    kok.querySelector('#sz-rakip')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); rEkle(); } });
    kok.querySelector('.sz-govde input:not([type=search])')?.focus({ preventScroll: true });
  };
  const deger = id => kok.querySelector(id)?.value.trim();
  const oku = () => {
    if (adim === 0) { d.firma = deger('#sz-firma') ?? d.firma; d.ad = deger('#sz-ad') ?? d.ad; d.tel = deger('#sz-tel') ?? d.tel; d.eposta = deger('#sz-ep') ?? d.eposta; }
    if (adim === 1) d.marka = deger('#sz-marka') ?? d.marka;
    if (adim === 3) d.bayi = deger('#sz-bayi') ?? d.bayi;
  };
  async function ileri() {
    oku();
    if (adim === 0 && !d.firma) return toast('Firma adını yaz.', 'err');
    if (adim === 1 && !d.sektor) return toast('Ne sattığını seç.', 'err');
    if (adim === 2 && !d.iller.length) return toast('En az bir il seç.', 'err');
    if (adim < ADIM.length - 1) { adim++; ara = ''; return ciz(); }
    const b = kok.querySelector('[data-ileri]'); b.disabled = true;
    try { await kaydet(d, duzenle); kapat(); toast(duzenle ? 'Firma profili kaydedildi.' : 'Hazırsın! Uygulama senin için ayarlandı.'); sonra?.(); }
    catch (e) { b.disabled = false; toast('Kaydedilemedi: ' + e.message, 'err'); }
  }
  ciz();
}

async function kaydet(d, duzenle) {
  const eski = duzenle || profilVar() ? profil() : null;
  await ayarYaz('firma_profil', { firma: d.firma, marka: d.marka || '', sektor: d.sektor, iller: d.iller, bayi: d.bayi || '', katalog: eski?.katalog || 'kendi', kurulum: eski?.kurulum || new Date().toISOString().slice(0, 10) });
  const l = { ...(ayar('listeler', {}) || {}) }; l.RAKIPLER = d.rakipler; await ayarYaz('listeler', l);
  if (d.ad) await ayarYaz('benim_adim', d.ad);
  const tf = ayar('teklif_firma') || {};
  await ayarYaz('teklif_firma', { ...tf, ad: d.firma, iletisim: tf.iletisim && duzenle ? tf.iletisim : [d.ad, d.tel, d.eposta].filter(Boolean).join('\n') });
  if (d.bayi && !S.firmalar.some(f => fold(f.ad) === fold(d.bayi))) await app.db.save('firmalar', { id: uuid(), ad: d.bayi, tipler: ['Bayi'], il: d.iller[0] || null, notlar: 'Kurulumda ana bayi olarak eklendi' });
  // Aydınlatma dışı sektörde aydınlatma hesap araçları menüde gizli başlar
  if (!duzenle) { const m = ayar('menu') || {}; const gizli = new Set(m.gizli || []); if (d.sektor !== 'aydinlatma') gizli.add('araclar'); await ayarYaz('menu', { ...m, gizli: [...gizli] }); }
  listeleriUygula();
  window.dispatchEvent(new CustomEvent('menu'));
}
