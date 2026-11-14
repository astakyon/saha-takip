// Organizasyon şeması: bir firmanın kişileri ağaç olarak. Kişi kartındaki "Bağlı olduğu kişi" ağacı kurar;
// bağlantısı olmayanlar pozisyonlarına göre gruplanır, yönetim (sahip / genel müdür) en üste konur.
// Her kutuda karar rolü ve son temas (ziyaret) bilgisi görünür; eksik pozisyonlar ipucu olarak yazılır.
import { S } from './db.js';
import { esc, POZISYONLAR } from './ui.js';

const YONETIM = ['Firma sahibi / Ortak', 'Genel müdür / Yönetim'];
// Satış için önemli görevler: firmada kayıtlı kimse yoksa uyarı verilir
const ONEMLI = ['Satınalma', 'Proje / Tasarım', 'Mühendis / Teknik'];
const sira = p => { const i = POZISYONLAR.indexOf(p); return i < 0 ? 99 : i; };
const gun = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;

function sonTemas(id) {
  let son = null;
  for (const z of S.ziyaretler || []) if (z.kisi_id === id && z.tarih && (!son || z.tarih > son)) son = z.tarih;
  return son;
}
function kutu(k, { link }) {
  const g = gun(sonTemas(k.id));
  const temas = g == null ? '<span class="org-temas yok" title="Kayıtlı ziyaret yok">temas yok</span>'
    : `<span class="org-temas ${g <= 30 ? 'iyi' : g <= 90 ? 'orta' : 'eski'}" title="Son ziyaret">${g === 0 ? 'bugün' : g + ' gün önce'}</span>`;
  const karar = k.rol === 'Karar verici' ? '<span class="org-rozet" title="Karar verici">★ karar verici</span>' : k.rol ? `<span class="org-rozet hafif">${esc(k.rol)}</span>` : '';
  return `<a class="org-kutu" href="${link(k)}"><span class="avatar sm" aria-hidden="true">${esc((k.ad_soyad || '?').slice(0, 1))}</span>
    <span class="org-metin"><b>${esc(k.ad_soyad)}</b><small>${esc(k.unvan || k.pozisyon || 'Görevi girilmemiş')}</small><span class="org-alt">${karar}${temas}</span></span></a>`;
}
function dal(k, cocuk, ops, ziyaret = new Set()) {
  if (ziyaret.has(k.id)) return '';   // döngüye karşı
  ziyaret.add(k.id);
  const c = (cocuk.get(k.id) || []).sort((a, b) => sira(a.pozisyon) - sira(b.pozisyon) || a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
  return `<li>${kutu(k, ops)}${c.length ? `<ul>${c.map(x => dal(x, cocuk, ops, ziyaret)).join('')}</ul>` : ''}</li>`;
}

// kisiler: aynı firmanın kişileri. Döner: { html, ozet }
export function orgSemasi(kisiler, { link = k => `#/kisi/${k.id}`, firmaAd = 'Firma' } = {}) {
  const ids = new Set(kisiler.map(k => k.id)), cocuk = new Map(), kok = [];
  for (const k of kisiler) {
    if (k.ust_kisi_id && ids.has(k.ust_kisi_id) && k.ust_kisi_id !== k.id) (cocuk.get(k.ust_kisi_id) || cocuk.set(k.ust_kisi_id, []).get(k.ust_kisi_id)).push(k);
    else kok.push(k);
  }
  const ops = { link }, ziyaret = new Set();
  const yonetim = kok.filter(k => YONETIM.includes(k.pozisyon)).sort((a, b) => sira(a.pozisyon) - sira(b.pozisyon));
  const gruplar = new Map();
  for (const k of kok.filter(k => !YONETIM.includes(k.pozisyon))) { const p = k.pozisyon || 'Görevi girilmemiş'; (gruplar.get(p) || gruplar.set(p, []).get(p)).push(k); }
  const grupHtml = [...gruplar.entries()].sort((a, b) => sira(a[0]) - sira(b[0])).map(([p, l]) =>
    `<li><span class="org-grup">${esc(p)} <small>${l.length}</small></span><ul>${l.sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr')).map(k => dal(k, cocuk, ops, ziyaret)).join('')}</ul></li>`).join('');
  // Üst düğüm: tek yönetici varsa o, birden çok ya da hiç yoksa firma adı
  let agac;
  if (yonetim.length === 1) {
    const y = yonetim[0], c = (cocuk.get(y.id) || []);
    ziyaret.add(y.id);
    const alt = c.map(x => dal(x, cocuk, ops, ziyaret)).join('') + grupHtml;
    agac = `<li>${kutu(y, ops)}${alt ? `<ul>${alt}</ul>` : ''}</li>`;
  } else {
    const alt = yonetim.map(k => dal(k, cocuk, ops, ziyaret)).join('') + grupHtml;
    agac = `<li><span class="org-firma">${esc(firmaAd)}</span>${alt ? `<ul>${alt}</ul>` : ''}</li>`;
  }
  const sayac = new Map(); for (const k of kisiler) sayac.set(k.pozisyon || 'Görevi girilmemiş', (sayac.get(k.pozisyon || 'Görevi girilmemiş') || 0) + 1);
  const eksik = ONEMLI.filter(p => !sayac.has(p));
  const ozet = `<div class="org-ozet"><b>${kisiler.length} kişi</b>${[...sayac.entries()].sort((a, b) => sira(a[0]) - sira(b[0])).map(([p, n]) => `<span class="chip">${esc(p)} · ${n}</span>`).join('')}</div>
    ${eksik.length && kisiler.length ? `<p class="hint">Bu firmada kayıtlı ${eksik.map(esc).join(', ')} kişisi yok. Teklif ve karar sürecinde kimin olduğunu öğrenmek işine yarar.</p>` : ''}`;
  return { html: `<div class="org-kaydir" tabindex="0" aria-label="Organizasyon şeması"><ul class="org">${agac}</ul></div>`, ozet };
}

// Kendi şirketin: kurucu ve yöneticiler üstte, diğer kullanıcılar rollerine göre
export function ekipSemasi({ firma, kurucu, yoneticiler = [], uyeler = [] }) {
  const kisi = (ad, alt, rozet = '') => `<div class="org-kutu"><span class="avatar sm" aria-hidden="true">${esc((ad || '?').slice(0, 1).toLocaleUpperCase('tr'))}</span><span class="org-metin"><b>${esc(ad)}</b><small>${esc(alt)}</small>${rozet ? `<span class="org-alt">${rozet}</span>` : ''}</span></div>`;
  const gruplar = new Map();
  for (const u of uyeler.filter(u => u.aktif && !u.yonetici)) { const r = u.yetkiler?._rol || 'Rolü girilmemiş'; (gruplar.get(r) || gruplar.set(r, []).get(r)).push(u); }
  const ust = [kurucu && kisi(kurucu.ad || kurucu.eposta, 'Kurucu', '<span class="org-rozet">yönetici</span>'), ...yoneticiler.map(y => kisi(y.ad || y.eposta, y.eposta, '<span class="org-rozet">yönetici</span>'))].filter(Boolean);
  const alt = [...gruplar.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr')).map(([r, l]) => `<li><span class="org-grup">${esc(r)} <small>${l.length}</small></span><ul>${l.map(u => `<li>${kisi(u.ad || u.eposta, u.eposta)}</li>`).join('')}</ul></li>`).join('');
  return `<div class="org-kaydir" tabindex="0" aria-label="Ekip şeması"><ul class="org"><li><span class="org-firma">${esc(firma || 'Şirketin')}</span><ul>${ust.map(x => `<li>${x}</li>`).join('')}${alt ? `<li><span class="org-grup">Ekip</span><ul>${alt}</ul></li>` : ''}</ul></li></ul></div>`;
}
