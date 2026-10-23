// Google Haritalar'dan "Paylaş → Saha Takip" ile gelen yeri kaydetme, kısa bağlantı çözme ve KML dışa aktarma
import { S, getConfig } from './db.js';
import { app } from './state.js';
import { esc, fold, toast, openDrawer, closeDrawer, download, today, byId, ACIK } from './ui.js';
import { linkCoz } from './views/ice-aktar.js';
import { konumAlgila, konumMetni } from './geo.js';
import { googleKey, adaGoreBul } from './google.js';
import { disaAktarabilir } from './yetki.js';

// Paylaşım parametrelerini (manifest share_target) okur ve adres çubuğunu temizler
export function paylasimAl() {
  let q; try { q = new URLSearchParams(location.search); } catch { return null; }
  const baslik = q.get('paylas_baslik') || '', metin = q.get('paylas_metin') || '', url = q.get('paylas_url') || '';
  if (!baslik && !metin && !url) return null;
  try { history.replaceState(null, '', location.pathname + '#/harita'); } catch {}
  return { baslik, metin, url };
}

// Paylaşılan metni ad / adres / bağlantıya ayırır.
// Android Google Haritalar örneği: "Akkuş Elektrik\nYeşilyurt, 01170 Seyhan/Adana\nhttps://maps.app.goo.gl/AbCd"
export function paylasimCoz({ baslik = '', metin = '', url = '' } = {}) {
  const tum = [baslik, metin, url].filter(Boolean).join('\n');
  const link = (/(https?:\/\/\S+)/.exec(url) || /(https?:\/\/\S+)/.exec(tum) || [])[1] || null;
  const satirlar = tum.split(/\n+/).map(s => s.replace(/https?:\/\/\S+/g, '').trim()).filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i && !/^(google haritalar|google maps)$/i.test(s));
  const lc = link ? linkCoz(link) : { lat: null, lng: null, kisa: false, ad: null };
  const koord = /(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/.exec(tum);
  let ad = satirlar[0] || lc.ad || null, adres = satirlar.slice(1).join(', ') || null;
  if (ad && koord && ad.includes(koord[0])) ad = null;
  return { ad, adres, url: link, lat: lc.lat ?? (koord ? +koord[1] : null), lng: lc.lng ?? (koord ? +koord[2] : null), kisa: lc.kisa };
}

// maps.app.goo.gl kısa bağlantısını Supabase Edge Function üzerinden açar (tarayıcı yönlendirmeyi CORS nedeniyle göremez)
export async function kisaLinkAc(url) {
  const c = getConfig();
  if (!c?.url || !c?.key || c.mode !== 'supabase') return null;
  try {
    const tok = app.db.session?.access_token || c.key;
    const r = await fetch(`${c.url}/functions/v1/kisa-link?u=${encodeURIComponent(url)}`, { headers: { apikey: c.key, Authorization: 'Bearer ' + tok } });
    if (!r.ok) return null;
    return (await r.json()).url || null;
  } catch { return null; }
}
async function adrestenKonum(q) {
  if ((await import('./gizli.js')).gizliMod()) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tr&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'tr' } });
    const [h] = await r.json(); return h ? { lat: +(+h.lat).toFixed(6), lng: +(+h.lon).toFixed(6), yaklasik: true } : null;
  } catch { return null; }
}

// Konumu bulmak için sırasıyla: bağlantıdaki koordinat → kısa bağlantıyı açma → Google Places (anahtar varsa) → adres araması
export async function konumBul(v, durum = () => {}) {
  if (v.lat != null) return { ...v, kaynak: 'bağlantı' };
  if (v.kisa && v.url) {
    durum('Kısa bağlantı açılıyor…');
    const uzun = await kisaLinkAc(v.url);
    if (uzun) { const lc = linkCoz(uzun); if (lc.lat != null) return { ...v, lat: lc.lat, lng: lc.lng, ad: v.ad || lc.ad, url: uzun, kaynak: 'bağlantı' }; }
  }
  if (googleKey() && (v.ad || v.adres)) {
    durum('Google\'da aranıyor…');
    try { const g = await adaGoreBul([v.ad, v.adres].filter(Boolean).join(' ')); if (g?.lat != null) return { ...v, ...g, ad: v.ad || g.ad, adres: v.adres || g.adres, kaynak: 'Google' }; } catch {}
  }
  if (v.adres || v.ad) {
    durum('Adres aranıyor…');
    const n = (v.adres && await adrestenKonum(v.adres)) || (v.ad && await adrestenKonum(v.ad));
    if (n) return { ...v, ...n, kaynak: 'adres (yaklaşık)' };
  }
  return { ...v, kaynak: null };
}

const toks = s => fold(s || '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !/^(ltd|sti|san|tic|elk|elektrik|insaat|muhendislik|osb)$/.test(w));
function benzerler(ad) {
  const nt = toks(ad); if (!nt.length) return [];
  const out = [];
  for (const t of ['firmalar', 'projeler']) for (const r of S[t]) { const rt = toks(r.ad); const o = rt.filter(w => nt.includes(w)).length; if (o) out.push({ t, r, sc: o / Math.max(rt.length, nt.length) }); }
  return out.sort((a, b) => b.sc - a.sc).slice(0, 5);
}

// Paylaşılan yer için kayıt paneli
export async function paylasimPaneli(gelen) {
  const v0 = paylasimCoz(gelen);
  const p = openDrawer(`<header class="dh"><div><p class="muted">Google Haritalar'dan paylaşıldı</p><h2 id="drawer-title">${esc(v0.ad || 'Yeni yer')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><div class="fld"><label for="pl-ad">Ad</label><input id="pl-ad" value="${esc(v0.ad || '')}"></div>
      <div class="fld"><label for="pl-adr">Adres</label><input id="pl-adr" value="${esc(v0.adres || '')}"></div>
      <p class="hint" data-durum aria-live="polite">Konum bulunuyor…</p><div data-secim></div></div>`);
  const durum = t => { p.querySelector('[data-durum]').textContent = t; };
  const v = await konumBul(v0, durum);
  let k = {};
  if (v.lat != null) { k = await konumAlgila(v.lat, v.lng); durum(`Konum: ${konumMetni(k) || `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`} · kaynak ${v.kaynak}`); }
  else durum(v0.kisa ? 'Kısa bağlantıdan konum çıkarılamadı (Supabase “kisa-link” fonksiyonu kurulu değil olabilir). Kaydı oluşturup haritada raptiyeyi elle yerleştirebilirsin.' : 'Konum bulunamadı. Kaydı oluşturup haritada raptiyeyi elle yerleştirebilirsin.');
  const bz = benzerler(v0.ad);
  p.querySelector('[data-secim]').innerHTML = `<div class="btnrow"><button type="button" class="btn primary" data-yeni="firmalar">Yeni firma olarak kaydet</button><button type="button" class="btn" data-yeni="projeler">Yeni proje olarak kaydet</button></div>
    ${bz.length ? `<h3>Ya da mevcut kayda ${v.lat != null ? 'konum ata' : 'bağla'}</h3><ul class="list">${bz.map(x => `<li><span><b>${esc(x.r.ad)}</b><span class="muted"> · ${x.t === 'firmalar' ? 'firma' : 'proje'}${x.r.lat != null && !x.r.konum_yaklasik ? ' · konumu var' : ''}</span></span><button type="button" class="btn sm" data-mevcut="${x.t}:${x.r.id}">Seç</button></li>`).join('')}</ul>` : ''}`;
  const alanlar = () => {
    const ad = p.querySelector('#pl-ad').value.trim(), adres = p.querySelector('#pl-adr').value.trim() || null;
    const o = { adres, google_url: v.url || v.google_url || null, ...(v.google_place_id ? { google_place_id: v.google_place_id } : {}) };
    if (v.lat != null) Object.assign(o, { lat: v.lat, lng: v.lng, konum_yaklasik: !!v.yaklasik, il: k.il || null, ilce: k.ilce || null, belde: k.belde || null, osb: k.osb || null, bolge_id: k.bolge_id || null });
    if (v.telefon) o.telefon = v.telefon;
    if (v.web) o.web = v.web;
    return { ad, o };
  };
  p.querySelectorAll('[data-yeni]').forEach(b => b.onclick = async () => {
    const { ad, o } = alanlar(); if (!ad) return toast('Ad yaz.', 'err');
    const t = b.dataset.yeni;
    const rec = t === 'firmalar' ? { ad, tipler: [], fotolar: [], ...o } : { ad, durum: 'Proje', takip_yili: new Date().getFullYear(), kanal: 'Bayi', fotolar: [], urun_gruplari: [], ...o };
    const s = await app.db.save(t, rec);
    if (t === 'projeler') await app.db.save('proje_gecmis', { proje_id: s.id, tarih: new Date().toISOString(), eski_durum: null, yeni_durum: 'Proje', notlar: 'Google Haritalar\'dan paylaşıldı' });
    toast(`${ad} kaydedildi.`); closeDrawer();
    location.hash = `#/${t === 'firmalar' ? 'firma' : 'proje'}/${s.id}`;
  });
  p.querySelectorAll('[data-mevcut]').forEach(b => b.onclick = async () => {
    const [t, id] = b.dataset.mevcut.split(':'); const r = byId(t, id); const { o } = alanlar();
    const yeni = { ...r };
    for (const [kk, vv] of Object.entries(o)) if (vv != null && (['lat', 'lng', 'konum_yaklasik', 'il', 'ilce', 'belde', 'osb', 'bolge_id'].includes(kk) ? (r.lat == null || r.konum_yaklasik) : !r[kk])) yeni[kk] = vv;
    await app.db.save(t, yeni); toast(`${r.ad} güncellendi.`); closeDrawer();
    location.hash = `#/${t === 'firmalar' ? 'firma' : 'proje'}/${id}`;
  });
}

// ---------- KML dışa aktarma (Google Benim Haritalarım / Google Earth) ----------
const kx = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const RENK = { 'Proje': 'ff8b7464', 'İhale': 'ffeb6325', 'Teklif Verildi': 'ffed3a7c', 'Sıcak': 'ff0c58ea', 'Beklemede': 'ffaaa1a1', 'Sipariş': 'ff3d8015', 'Kayıp': 'ff1c1cb9', 'İptal': 'ff5b5252', firma: 'ff905d0e' };
export function kmlUret({ projeler = true, firmalar = true, sadeceAcik = false } = {}) {
  const pm = (r, stil, ac) => `<Placemark><name>${kx(r.ad)}</name><styleUrl>#${stil}</styleUrl><description>${kx(ac)}</description><Point><coordinates>${r.lng},${r.lat},0</coordinates></Point></Placemark>`;
  const stiller = Object.entries(RENK).map(([k, c], i) => `<Style id="s${i}"><IconStyle><color>${c}</color><scale>1.1</scale><Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle></Style>`).join('');
  const sid = k => 's' + Object.keys(RENK).indexOf(k);
  let klasor = '';
  if (projeler) {
    const gr = {};
    for (const p of S.projeler) if (p.lat != null && (!sadeceAcik || ACIK.includes(p.durum))) (gr[p.durum || 'Proje'] ||= []).push(p);
    for (const [d, ps] of Object.entries(gr)) klasor += `<Folder><name>Projeler · ${kx(d)} (${ps.length})</name>${ps.map(p => pm(p, sid(d), [p.durum, p.tutar_usd ? Math.round(p.tutar_usd) + ' USD' : '', [p.osb, p.ilce, p.il].filter(Boolean).join(', '), p.konum_yaklasik ? 'konum yaklaşık' : '', p.notlar].filter(Boolean).join('\n'))).join('')}</Folder>`;
  }
  if (firmalar) {
    const fs = S.firmalar.filter(f => f.lat != null);
    if (fs.length) klasor += `<Folder><name>Firmalar (${fs.length})</name>${fs.map(f => pm(f, sid('firma'), [(f.tipler || []).join(', '), f.adres, f.telefon].filter(Boolean).join('\n'))).join('')}</Folder>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Saha Takip ${today()}</name>${stiller}${klasor}</Document></kml>`;
}
export function kmlIndir(opts) { if (!disaAktarabilir()) return toast('Dışa aktarma yetkin yok.', 'err'); download(`saha-takip-${today()}.kml`, kmlUret(opts), 'application/vnd.google-earth.kml+xml'); toast('KML dosyası indirildi. Google Benim Haritalarım → İçe aktar ile açabilirsin.'); }
