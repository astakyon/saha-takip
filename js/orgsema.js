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
  return `<a class="org-kutu" href="${link(k)}" data-kid="${k.id}"><span class="avatar sm" aria-hidden="true">${esc((k.ad_soyad || '?').slice(0, 1))}</span>
    <span class="org-metin"><b>${esc(k.ad_soyad)}</b><small>${esc(k.unvan || k.pozisyon || 'Görevi girilmemiş')}</small><span class="org-alt">${karar}${temas}</span></span></a>`;
}
function dal(k, cocuk, ops, ziyaret = new Set()) {
  if (ziyaret.has(k.id)) return '';   // döngüye karşı
  ziyaret.add(k.id);
  const c = (cocuk.get(k.id) || []).sort((a, b) => sira(a.pozisyon) - sira(b.pozisyon) || a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
  return `<li>${kutu(k, ops)}${c.length ? `<ul>${c.map(x => dal(x, cocuk, ops, ziyaret)).join('')}</ul>` : ''}</li>`;
}

// kisiler: aynı firmanın kişileri. Döner: { html, ozet }
export function orgSemasi(kisiler, { link = k => `#/kisi/${k.id}`, firmaAd = 'Firma', eskiler = [], firmaId = null, firmaAdiOf = () => '' } = {}) {
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
    `<li><span class="org-grup" data-grup="${esc(p)}">${esc(p)} <small>${l.length}</small></span><ul>${l.sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr')).map(k => dal(k, cocuk, ops, ziyaret)).join('')}</ul></li>`).join('');
  // Üst düğüm: tek yönetici varsa o, birden çok ya da hiç yoksa firma adı
  let agac;
  if (yonetim.length === 1) {
    const y = yonetim[0], c = (cocuk.get(y.id) || []);
    ziyaret.add(y.id);
    const alt = c.map(x => dal(x, cocuk, ops, ziyaret)).join('') + grupHtml;
    agac = `<li>${kutu(y, ops)}${alt ? `<ul>${alt}</ul>` : ''}</li>`;
  } else {
    const alt = yonetim.map(k => dal(k, cocuk, ops, ziyaret)).join('') + grupHtml;
    agac = `<li><span class="org-firma" data-grup="">${esc(firmaAd)}</span>${alt ? `<ul>${alt}</ul>` : ''}</li>`;
  }
  const sayac = new Map(); for (const k of kisiler) sayac.set(k.pozisyon || 'Görevi girilmemiş', (sayac.get(k.pozisyon || 'Görevi girilmemiş') || 0) + 1);
  const eksik = ONEMLI.filter(p => !sayac.has(p));
  const ozet = `<div class="org-ozet"><b>${kisiler.length} kişi</b>${[...sayac.entries()].sort((a, b) => sira(a[0]) - sira(b[0])).map(([p, n]) => `<span class="chip">${esc(p)} · ${n}</span>`).join('')}</div>
    ${eksik.length && kisiler.length ? `<p class="hint">Bu firmada kayıtlı ${eksik.map(esc).join(', ')} kişisi yok. Teklif ve karar sürecinde kimin olduğunu öğrenmek işine yarar.</p>` : ''}`;
  // Ayrılanlar: ağacın yanında soluk, şimdi nerede oldukları yazılı
  const eskiHtml = eskiler.length ? `<aside class="org-eski" aria-label="Firmadan ayrılanlar"><h4>Firmadan ayrılanlar <small>${eskiler.length}</small></h4>${eskiler.map(k => { const g = (k.eski_firmalar || []).find(g => g.firma_id === firmaId) || {};
    return `<a class="org-kutu eski" href="${link(k)}"><span class="avatar sm" aria-hidden="true">${esc((k.ad_soyad || '?').slice(0, 1))}</span><span class="org-metin"><b>${esc(k.ad_soyad)}</b><small>${esc([g.unvan || g.pozisyon, g.bitis ? g.bitis.slice(0, 4) + "'te ayrıldı" : 'ayrıldı'].filter(Boolean).join(' · '))}</small><span class="org-alt"><span class="org-rozet hafif">${k.firma_id ? 'şimdi: ' + esc(firmaAdiOf(k.firma_id) || '?') : 'firması yok'}</span></span></span></a>`; }).join('')}</aside>` : '';
  return { html: `<div class="org-yan"><div class="org-kaydir" tabindex="0" aria-label="Organizasyon şeması">${kisiler.length ? `<ul class="org">${agac}</ul>` : '<p class="hint">Firmada kayıtlı kişi yok.</p>'}</div>${eskiHtml}</div>`, ozet };
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

// ---------- Sürükle-bırak: kişiyi başka bir kişinin üstüne bırakınca "bağlı olduğu kişi" olur ----------
// Telefonda basılı tutup (0,3 sn) sürükle; bilgisayarda doğrudan sürükle. Grup etiketine bırakınca bağlantı kalkar,
// pozisyon grubuysa kişinin pozisyonu o grup olur. Kısa dokunuş kartı açar.
export function orgSurukle(kok, { kisiler, kaydet }) {
  const byId = new Map(kisiler.map(k => [k.id, k]));
  const altindaMi = (ust, id) => { let k = byId.get(id), n = 0; while (k?.ust_kisi_id && n++ < 50) { if (k.ust_kisi_id === ust) return true; k = byId.get(k.ust_kisi_id); } return false; };
  let s = null;
  const bitir = () => { if (!s) return; clearTimeout(s.zaman); s.hayalet?.remove(); kok.querySelectorAll('.org-hedef').forEach(x => x.classList.remove('org-hedef')); kok.classList.remove('org-suruklen'); s.kutu.classList.remove('org-tasinan'); };
  const hedefBul = (x, y) => { const el = document.elementFromPoint(x, y)?.closest('[data-kid],[data-grup]'); if (!el || !kok.contains(el) || el === s.kutu) return null; if (el.dataset.kid && (el.dataset.kid === s.id || altindaMi(s.id, el.dataset.kid))) return null; return el; };
  kok.querySelectorAll('.org .org-kutu[data-kid]').forEach(kutu => {
    kutu.setAttribute('draggable', 'false');
    kutu.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      s = { id: kutu.dataset.kid, kutu, x0: e.clientX, y0: e.clientY, aktif: false, tasindi: false, pid: e.pointerId };
      const basla = () => { if (!s || s.aktif) return; s.aktif = true; kutu.setPointerCapture?.(s.pid); kok.classList.add('org-suruklen'); kutu.classList.add('org-tasinan');
        s.hayalet = kutu.cloneNode(true); s.hayalet.className = 'org-kutu org-hayalet'; document.body.appendChild(s.hayalet); konum(s.x0, s.y0); navigator.vibrate?.(15); };
      const konum = (x, y) => { if (s?.hayalet) { s.hayalet.style.left = x + 'px'; s.hayalet.style.top = y + 'px'; } };
      s.basla = basla; s.konum = konum;
      if (e.pointerType === 'mouse') s.fare = true; else s.zaman = setTimeout(basla, 300);
    });
    kutu.addEventListener('pointermove', e => {
      if (!s || s.kutu !== kutu) return;
      const d = Math.hypot(e.clientX - s.x0, e.clientY - s.y0);
      if (!s.aktif) { if (s.fare && d > 6) s.basla(); else if (!s.fare && d > 10) { clearTimeout(s.zaman); s = null; } return; }
      e.preventDefault(); s.tasindi = true; s.konum(e.clientX, e.clientY);
      kok.querySelectorAll('.org-hedef').forEach(x => x.classList.remove('org-hedef'));
      hedefBul(e.clientX, e.clientY)?.classList.add('org-hedef');
    });
    kutu.addEventListener('pointerup', async e => {
      if (!s || s.kutu !== kutu) return;
      const aktif = s.aktif, id = s.id, hedef = aktif ? hedefBul(e.clientX, e.clientY) : null; bitir(); s = aktif ? { engel: true } : null;
      if (!aktif) return;
      setTimeout(() => { s = null; }, 50);
      if (!hedef) return;
      const k = byId.get(id);
      if (hedef.dataset.kid) { if (k.ust_kisi_id !== hedef.dataset.kid) await kaydet(id, { ust_kisi_id: hedef.dataset.kid }); }
      else { const p = hedef.dataset.grup; await kaydet(id, { ust_kisi_id: null, ...(p && p !== 'Görevi girilmemiş' ? { pozisyon: p } : {}) }); }
    });
    kutu.addEventListener('touchmove', e => { if (s?.aktif) e.preventDefault(); }, { passive: false });   // sürüklerken sayfa kaymasın
    kutu.addEventListener('pointercancel', () => { bitir(); s = null; });
    kutu.addEventListener('click', e => { if (s?.engel) { e.preventDefault(); e.stopPropagation(); } }, true);
    kutu.addEventListener('contextmenu', e => { if (s) e.preventDefault(); });
  });
}
