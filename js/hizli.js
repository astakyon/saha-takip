// Hızlı ekle (+) düğmesi ve genel arama. Her ekranda sağ altta; bilgisayarda “/” ya da Ctrl+K ile arama açılır.
import { S } from './db.js';
import { app } from './state.js';
import { esc, fold, byId, firmaAd, tarih, today, gunEkle, openDrawer, closeDrawer, usd, toast, kelimeUyar } from './ui.js';
import { izin, rotaIzinli } from './yetki.js';
import { menuDuzeni } from './menu.js';

const yazabilir = t => izin(t) === 'yaz';
const gorunur = r => [].concat(r).some(k => k === 'bugun' || (!menuDuzeni().gizli.has(k) && rotaIzinli(k)));

function ogeler() {
  const y = gunEkle(today(), 1);
  return [
    { ad: 'Ziyaret kaydet', alt: 'yapılan görüşme', t: 'ziyaretler', r: ['ziyaretler', 'takvim'], f: async () => (await import('./views/ziyaret.js')).ziyaretForm({}) },
    { ad: 'Ziyaret planla', alt: 'yarın için', t: 'ziyaretler', r: ['ziyaretler', 'takvim'], f: async () => (await import('./views/ziyaret.js')).ziyaretForm({ durum: 'Planlandı', tarih: y }) },
    { ad: 'Sesli not', alt: 'konuş, sonra firmaya bağla', t: 'gorevler', r: 'bugun', f: () => sesliNot() },
    { ad: 'Görev', alt: 'yapılacak iş, hatırlatma', t: 'gorevler', r: ['gorevler', 'takvim'], f: async () => (await import('./views/ziyaret.js')).gorevForm({}) },
    { ad: 'Kartvizit', alt: 'fotoğrafla kişi ekle', t: 'kisiler', r: ['kisiler', 'firmalar'], f: async () => (await import('./views/firmalar.js')).kartvizittenKisi() },
    { ad: 'Ürün kodu oku', alt: 'etiket, barkod → stok ve fiyat', t: 'urunler', oku: true, r: ['urunler', 'bayi'], f: async () => (await import('./barkod.js')).kodOku() },
    { ad: 'Kişi', alt: 'elle', t: 'kisiler', r: ['kisiler', 'firmalar'], f: async () => (await import('./views/firmalar.js')).kisiDetay(null, {}) },
    { ad: 'Şantiye tabelası', alt: 'fotoğrafla yeni proje', t: 'projeler', r: 'projeler', f: async () => (await import('./tabela.js')).tabeladanProje() },
    { ad: 'Proje', alt: 'yeni proje', t: 'projeler', r: 'projeler', f: async () => (await import('./views/projeler.js')).yeniProje({}) },
    { ad: 'Firma', alt: 'yeni firma', t: 'firmalar', r: 'firmalar', f: async () => (await import('./views/firmalar.js')).yeniFirma({}) },
    { ad: 'Teklif', alt: 'yeni teklif', t: 'teklifler', r: 'teklifler', f: async () => (await import('./views/teklif.js')).teklifForm({}) },
    { ad: 'Masraf', alt: 'yakıt, yemek, km', t: 'masraflar', r: 'masraflar', f: async () => (await import('./views/kayitlar.js')).masrafForm({}) },
  ].filter(o => (o.oku ? !!izin(o.t) : yazabilir(o.t)) && gorunur(o.r));
}

export function hizliKur() {
  if (document.getElementById('fab')) return;
  const b = document.createElement('div'); b.id = 'fab';
  b.innerHTML = `<div class="fab-menu" role="menu" aria-label="Hızlı ekle" hidden></div>
    <button type="button" class="fab-btn" aria-label="Hızlı ekle" aria-expanded="false" title="Hızlı ekle"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`;
  document.body.appendChild(b);
  const menu = b.querySelector('.fab-menu'), btn = b.querySelector('.fab-btn');
  const kapat = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); b.classList.remove('acik'); };
  btn.onclick = e => {
    e.stopPropagation();
    if (!menu.hidden) return kapat();
    const l = ogeler();
    menu.innerHTML = l.map((o, i) => `<button type="button" role="menuitem" data-i="${i}"><b>${esc(o.ad)}</b><small>${esc(o.alt)}</small></button>`).join('') || '<p class="hint">Ekleme yetkin olan bölüm yok.</p>';
    menu.querySelectorAll('[data-i]').forEach(x => x.onclick = () => { kapat(); l[+x.dataset.i].f(); });
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); b.classList.add('acik');
    menu.querySelector('button')?.focus();
  };
  document.addEventListener('click', e => { if (!b.contains(e.target)) kapat(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') kapat();
    const yaziyor = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !yaziyor) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); aramaAc(); }
  });
  // Haritada kendi düğmeleri var; orada gizle
  const guncelle = () => { b.hidden = /^#\/harita/.test(location.hash) || !!document.querySelector('.login'); };
  window.addEventListener('hashchange', guncelle); guncelle();
}

// ---------- Sesli hızlı not ----------
// Konuşarak not al; firma/proje seçilirse ziyaret notu, seçilmezse görev olarak kaydedilir (sonra bağlanabilir)
export async function sesliNot() {
  const { mikDugme, mikBagla, sesDestek } = await import('./ses.js');
  const dl = (id, t, k) => `<datalist id="${id}">${S[t].map(x => `<option value="${esc(x[k])}">`).join('')}</datalist>`;
  const p = openDrawer(`<header class="dh"><div><p class="muted">${sesDestek() ? 'Mikrofona dokun ve konuş' : 'Yaz'}</p><h2 id="drawer-title">Hızlı not</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form"><div class="fld full"><label for="sn-t">Not</label><div class="area-wrap"><textarea id="sn-t" rows="5" placeholder="Örn. Medcem şantiyesinde elektrik ihalesi kasımda, Ahmet Bey teklif istiyor"></textarea>${mikDugme()}</div></div>
      <div class="grid"><div class="fld"><label for="sn-f">Firma (isteğe bağlı)</label><input id="sn-f" list="sn-fl" autocomplete="off">${dl('sn-fl', 'firmalar', 'ad')}</div>
      <div class="fld"><label for="sn-p">Proje (isteğe bağlı)</label><input id="sn-p" list="sn-pl" autocomplete="off">${dl('sn-pl', 'projeler', 'ad')}</div></div>
      <p class="hint">Firma ya da proje seçersen bugünün ziyaret notu olarak kaydedilir; seçmezsen görevlerine düşer, sonra ilgili firmaya bağlarsın.</p>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  mikBagla(p);
  const ta = p.querySelector('#sn-t');
  setTimeout(() => { const m = p.querySelector('[data-mic]'); if (m) m.click(); else ta.focus(); }, 250);
  p.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    p.querySelector('[data-mic].on')?.click();
    const metin = ta.value.trim(); if (!metin) return toast('Notu yaz ya da söyle.', 'err');
    const bul = (t, k, v) => v ? S[t].find(x => fold(x[k]) === fold(v)) : null;
    const f = bul('firmalar', 'ad', p.querySelector('#sn-f').value.trim()), pr = bul('projeler', 'ad', p.querySelector('#sn-p').value.trim());
    try {
      if (f || pr) { await app.db.save('ziyaretler', { tarih: today(), durum: 'Yapıldı', amac: 'Genel ziyaret', firma_id: f?.id || pr?.emut_id || pr?.alici_id || null, proje_id: pr?.id || null, notlar: metin, fotolar: [] }); toast('Ziyaret notu kaydedildi.'); }
      else { await app.db.save('gorevler', { baslik: metin.length > 70 ? metin.slice(0, 70) + '…' : metin, notlar: metin, durum: 'Açık', oncelik: 'Normal', son_tarih: today() }); toast('Not görevlerine eklendi.'); }
      closeDrawer(); app.refresh();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

// ---------- Genel arama ----------
const pAd = id => byId('projeler', id)?.ad;
const KAYNAK = [
  { t: 'projeler', g: 'Projeler', alan: p => [p.ad, p.il, p.ilce, p.osb, p.notlar, p.teklif_no, p.crm_kodu, p.icerik, p.takipci, firmaAd(p.emut_id), firmaAd(p.gemut_id), firmaAd(p.alici_id)], baslik: p => p.ad, alt: p => [p.durum, p.il, p.tutar_usd ? usd(p.tutar_usd) : ''].filter(Boolean).join(' · '), ac: p => { location.hash = '#/proje/' + p.id; } },
  { t: 'firmalar', g: 'Firmalar', alan: f => [f.ad, f.il, f.ilce, f.osb, f.telefon, f.eposta, f.vergi_no, f.notlar], baslik: f => f.ad, alt: f => [(f.tipler || []).join(', '), f.il, f.telefon].filter(Boolean).join(' · '), ac: f => { location.hash = '#/firma/' + f.id; } },
  { t: 'kisiler', g: 'Kişiler', alan: k => [k.ad_soyad, k.telefon, k.eposta, k.unvan, firmaAd(k.firma_id), k.notlar], baslik: k => k.ad_soyad, alt: k => [k.unvan, firmaAd(k.firma_id), k.telefon].filter(Boolean).join(' · '), ac: k => { location.hash = '#/kisi/' + k.id; } },
  { t: 'siparisler', g: 'Siparişler', alan: s => [s.siparis_no, s.belge_no, s.referans, s.siparis_notu, s.musteri_adi, s.proje_tanimi, firmaAd(s.firma_id), pAd(s.proje_id)], baslik: s => `${s.siparis_no || s.belge_no || 'Sipariş'} · ${firmaAd(s.firma_id) || s.musteri_adi || ''}`, alt: s => [tarih(s.tarih), s.referans, s.siparis_notu].filter(Boolean).join(' · '), ac: async s => (await import('./views/panel.js')).siparisForm({ id: s.id }) },
  { t: 'teklifler', g: 'Teklifler', alan: x => [x.teklif_no, x.notlar, pAd(x.proje_id), firmaAd(x.firma_id)], baslik: x => `${x.teklif_no || 'Teklif'} · ${pAd(x.proje_id) || firmaAd(x.firma_id) || ''}`, alt: x => [tarih(x.tarih), x.durum].filter(Boolean).join(' · '), ac: async x => (await import('./views/teklif.js')).teklifForm({ id: x.id }) },
  { t: 'ziyaretler', g: 'Ziyaretler', alan: z => [z.notlar, z.sonuc, z.amac, z.sonuc_tipi, firmaAd(z.firma_id), byId('kisiler', z.kisi_id)?.ad_soyad, pAd(z.proje_id)], baslik: z => `${firmaAd(z.firma_id) || 'Ziyaret'} · ${tarih(z.tarih)}`, alt: z => [z.amac, (z.notlar || '').slice(0, 80)].filter(Boolean).join(' · '), ac: async z => (await import('./views/ziyaret.js')).ziyaretForm({ id: z.id }) },
  { t: 'gorevler', g: 'Görevler', alan: g => [g.baslik, g.notlar, firmaAd(g.firma_id), pAd(g.proje_id)], baslik: g => g.baslik, alt: g => [g.durum, g.son_tarih ? tarih(g.son_tarih) : ''].filter(Boolean).join(' · '), ac: async g => (await import('./views/ziyaret.js')).gorevForm({ id: g.id }) },
  { t: 'urunler', g: 'Ürünler', alan: u => [u.kod, u.aciklama, u.aciklama2, u.aile], baslik: u => `${u.kod || ''} ${u.aciklama || ''}`.trim(), alt: u => [u.stok != null ? `stok ${u.stok} ${u.birim || ''}` : '', u.birim_fiyat_usd ? usd(u.birim_fiyat_usd) : ''].filter(Boolean).join(' · '), ac: () => { location.hash = '#/urunler'; } },
  { t: 'belgeler', g: 'Dosyalar', alan: b => [b.ad, b.notlar, b.kategori, pAd(b.proje_id), firmaAd(b.firma_id)], baslik: b => b.ad, alt: b => [b.kategori, pAd(b.proje_id) || firmaAd(b.firma_id)].filter(Boolean).join(' · '), ac: async b => (await import('./belgeler.js')).belgeAc(b) },
];
export function ara(q, enCok = 6) {
  const w = fold(q).trim().split(/\s+/).filter(Boolean); if (!w.length) return [];
  return KAYNAK.filter(k => izin(k.t) && (S[k.t] || []).length).map(k => {
    const l = [];
    for (const r of S[k.t]) {
      const hay = fold(k.alan(r).filter(Boolean).join(' '));
      const tam = w.every(x => hay.includes(x)); if (!tam && !w.every(x => kelimeUyar(x, hay))) continue;
      const bas = fold(k.baslik(r) || ''); l.push({ r, p: (bas.startsWith(w[0]) ? 0 : bas.includes(w[0]) ? 1 : 2) + (tam ? 0 : 3) });
    }
    l.sort((a, b) => a.p - b.p);
    return { k, n: l.length, l: l.slice(0, enCok).map(x => x.r) };
  }).filter(x => x.n);
}
export function aramaAc(q0 = '') {
  const p = openDrawer(`<header class="dh"><div><p class="muted">Tüm kayıtlarda</p><h2 id="drawer-title">Ara</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><input type="search" class="ara-kutu" data-q placeholder="Proje, firma, kişi, telefon, sipariş no, SAS notu…" value="${esc(q0)}" autofocus aria-label="Ara" enterkeyhint="search">
    <div data-sonuc class="ara-sonuc"><p class="hint">En az 2 harf yaz. Sipariş numarası (2000…), SAS notu, telefonun bir kısmı, ürün kodu ile de arayabilirsin.</p></div></div>`, { wide: true });
  const inp = p.querySelector('[data-q]'), out = p.querySelector('[data-sonuc]');
  let zam, son = [];
  // Son açılanlar (bu cihazda): arama boşken listelenir
  const SON = 'saha-son-acilan', sonOku = () => { try { return JSON.parse(localStorage.getItem(SON) || '[]'); } catch { return []; } };
  const sonYaz = (k, r) => { try { const l = sonOku().filter(x => !(x.t === k.t && x.id === r.id)); l.unshift({ t: k.t, id: r.id }); localStorage.setItem(SON, JSON.stringify(l.slice(0, 8))); } catch {} };
  const bosHal = () => {
    const l = sonOku().map(x => { const k = KAYNAK.find(k => k.t === x.t), r = k && (S[x.t] || []).find(y => y.id === x.id); return k && r && izin(k.t) ? [k, r] : null; }).filter(Boolean);
    son = l;
    out.innerHTML = (l.length ? `<section><h3>Son açılanlar</h3><ul class="list">${l.map(([k, r], i) => `<li><button type="button" class="linkrow" data-s="${i}"><b>${esc(k.baslik(r) || '')}</b><span class="muted">${esc(k.g)}</span></button></li>`).join('')}</ul></section>` : '')
      + '<p class="hint">En az 2 harf yaz. Sipariş numarası (2000…), SAS notu, telefonun bir kısmı, ürün kodu ile de arayabilirsin. Küçük yazım hataları ve Türkçe karakter farkı sorun değil.</p>';
    out.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const [k, r] = son[+b.dataset.s]; sonYaz(k, r); closeDrawer(); setTimeout(() => k.ac(r), 60); });
  };
  const ciz = () => {
    const q = inp.value.trim();
    if (q.length < 2) return bosHal();
    const g = ara(q); son = [];
    out.innerHTML = g.length ? g.map(({ k, n, l }) => `<section><h3>${esc(k.g)} <span class="muted">${n}</span></h3><ul class="list">${l.map(r => { son.push([k, r]); return `<li><button type="button" class="linkrow" data-s="${son.length - 1}"><b>${esc(k.baslik(r) || '—')}</b><span class="muted">${esc(k.alt(r) || '')}</span></button></li>`; }).join('')}</ul>${n > l.length ? `<p class="hint">+${n - l.length} sonuç daha; aramayı daralt.</p>` : ''}</section>`).join('')
      : `<p class="hint">“${esc(q)}” için sonuç yok.</p>`;
    out.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const [k, r] = son[+b.dataset.s]; sonYaz(k, r); closeDrawer(); setTimeout(() => k.ac(r), 60); });
  };
  inp.addEventListener('input', () => { clearTimeout(zam); zam = setTimeout(ciz, 120); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); out.querySelector('[data-s]')?.click(); } });
  if (q0) ciz(); else bosHal();
  setTimeout(() => inp.focus(), 80);
}
