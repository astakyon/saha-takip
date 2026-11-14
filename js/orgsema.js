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
  return `<li>${kutu(k, ops)}${c.length ? `<ul>${bolumler(c, k.id, cocuk, ops, ziyaret)}</ul>` : ''}</li>`;
}
// Bir yöneticinin altındakiler: birden fazla kişi varsa pozisyonlarına göre bölümlere ayrılır
// (yönetim pozisyonundakiler, ör. altındaki müdür, bölüm etiketsiz doğrudan bağlanır)
function bolumler(c, ustId, cocuk, ops, ziyaret) {
  if (c.length < 2) return c.map(x => dal(x, cocuk, ops, ziyaret)).join('');
  const dogrudan = c.filter(x => YONETIM.includes(x.pozisyon)), g = new Map();
  for (const x of c.filter(x => !YONETIM.includes(x.pozisyon))) { const p = x.pozisyon || 'Görevi girilmemiş'; (g.get(p) || g.set(p, []).get(p)).push(x); }
  return dogrudan.map(x => dal(x, cocuk, ops, ziyaret)).join('') + [...g.entries()].sort((a, b) => sira(a[0]) - sira(b[0])).map(([p, l]) =>
    `<li><span class="org-grup" data-grup="${esc(p)}" data-gust="${ustId}">${esc(p)} <small>${l.length}</small></span><ul>${l.map(x => dal(x, cocuk, ops, ziyaret)).join('')}</ul></li>`).join('');
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
    const alt = (c.length ? bolumler(c, y.id, cocuk, ops, ziyaret) : '') + grupHtml;
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
  const arac = kisiler.length ? `<div class="org-arac" role="toolbar" aria-label="Şema yakınlaştırma"><button type="button" class="btn sm ghost" data-zoom="-" aria-label="Uzaklaştır">−</button><span data-zoomyuzde>100%</span><button type="button" class="btn sm ghost" data-zoom="+" aria-label="Yakınlaştır">+</button><button type="button" class="btn sm ghost" data-zoom="sigdir">Sığdır</button><small class="muted">Fare tekerleğiyle yakınlaştır, boş yerden tutup kaydır</small><span class="grow"></span><button type="button" class="btn sm ghost" data-indir>İndir (resim / PDF)</button></div>` : '';
  return { html: `<div class="org-yan">${arac}<div class="org-kaydir" tabindex="0" aria-label="Organizasyon şeması">${kisiler.length ? `<ul class="org">${agac}</ul>` : '<p class="hint">Firmada kayıtlı kişi yok.</p>'}</div>${eskiHtml}</div>`, ozet };
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
export function orgSurukle(kok, { kisiler, kaydet, duzenle }) {
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
      else { const p = hedef.dataset.grup; await kaydet(id, { ust_kisi_id: hedef.dataset.gust || null, ...(p && p !== 'Görevi girilmemiş' ? { pozisyon: p } : {}) }); }
    });
    kutu.addEventListener('touchmove', e => { if (s?.aktif) e.preventDefault(); }, { passive: false });   // sürüklerken sayfa kaymasın
    kutu.addEventListener('pointercancel', () => { bitir(); s = null; });
    kutu.addEventListener('click', e => { if (s?.engel) { e.preventDefault(); e.stopPropagation(); return; } if (duzenle && !e.ctrlKey && !e.metaKey) { e.preventDefault(); duzenle(kutu.dataset.kid); } }, true);
    kutu.addEventListener('contextmenu', e => { if (s) e.preventDefault(); });
  });
}

// ---------- Yakınlaştırma: fare tekerleği, + / − / Sığdır, boş yerden tutup kaydırma, iki parmakla ---------
export function orgYakinlastir(kok, { anahtar = 'org-zoom' } = {}) {
  const kap = kok.querySelector('.org-kaydir'), agac = kap?.querySelector('.org'), yuzde = kok.querySelector('[data-zoomyuzde]');
  if (!kap || !agac) return;
  let z = 1; try { z = +sessionStorage.getItem(anahtar) || 1; } catch {}
  const uygula = (yeni, mx = kap.clientWidth / 2, my = 0) => {
    yeni = Math.max(0.35, Math.min(1.8, yeni)); const oran = yeni / z;
    const sx = kap.scrollLeft, sy = kap.scrollTop;
    z = yeni; agac.style.zoom = z; if (yuzde) yuzde.textContent = Math.round(z * 100) + '%';
    kap.scrollLeft = (sx + mx) * oran - mx; kap.scrollTop = (sy + my) * oran - my;
    try { sessionStorage.setItem(anahtar, z); } catch {}
  };
  const sigdir = () => { agac.style.zoom = 1; const w = agac.scrollWidth; z = 1; uygula(Math.min(1, (kap.clientWidth - 8) / w)); kap.scrollLeft = (kap.scrollWidth - kap.clientWidth) / 2; };
  agac.style.zoom = z; if (yuzde) yuzde.textContent = Math.round(z * 100) + '%';
  kok.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => b.dataset.zoom === 'sigdir' ? sigdir() : uygula(z * (b.dataset.zoom === '+' ? 1.2 : 1 / 1.2)));
  kap.addEventListener('wheel', e => { e.preventDefault(); const r = kap.getBoundingClientRect(); uygula(z * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  // Boş yerden tutup kaydır (fare)
  let tut = null;
  kap.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.org-kutu,[data-grup]')) return; tut = { x: e.clientX, y: e.clientY, sl: kap.scrollLeft, st: kap.scrollTop }; kap.classList.add('tutuldu'); kap.setPointerCapture(e.pointerId); });
  kap.addEventListener('pointermove', e => { if (!tut) return; kap.scrollLeft = tut.sl - (e.clientX - tut.x); kap.scrollTop = tut.st - (e.clientY - tut.y); });
  const birak = () => { tut = null; kap.classList.remove('tutuldu'); };
  kap.addEventListener('pointerup', birak); kap.addEventListener('pointercancel', birak);
  // İki parmakla yakınlaştır (dokunmatik)
  const parmak = new Map(); let ilk = null;
  kap.addEventListener('touchstart', e => { if (e.touches.length === 2) { const [a, b] = e.touches; ilk = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z }; } }, { passive: true });
  kap.addEventListener('touchmove', e => { if (e.touches.length === 2 && ilk) { e.preventDefault(); const [a, b] = e.touches, r = kap.getBoundingClientRect(); uygula(ilk.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / ilk.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top); } }, { passive: false });
  kap.addEventListener('touchend', () => { ilk = null; parmak.clear(); });
  if (agac.scrollWidth * z > kap.clientWidth && !sessionStorage.getItem?.(anahtar)) sigdir();
}

// ---------- Kişiye dokununca: görevini hızlı değiştir ----------
export function orgHizliDuzen(k, { kisiler, POZ, kaydet, kartiAc }) {
  const d = document.createElement('dialog'); d.className = 'org-dlg';
  const ustler = kisiler.filter(x => x.id !== k.id).sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
  d.innerHTML = `<form method="dialog" class="form"><h3>${esc(k.ad_soyad)}</h3>
    <div class="fld"><label for="od-u">Unvan</label><input id="od-u" value="${esc(k.unvan || '')}" placeholder="ör. Satınalma Müdürü"></div>
    <div class="fld"><label for="od-p">Pozisyon (bölüm)</label><select id="od-p"><option value="">Seç</option>${POZ.map(p => `<option ${k.pozisyon === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
    <div class="fld"><label for="od-b">Bağlı olduğu kişi</label><select id="od-b"><option value="">Yok (en üstte)</option>${ustler.map(x => `<option value="${x.id}" ${k.ust_kisi_id === x.id ? 'selected' : ''}>${esc(x.ad_soyad)}${x.unvan ? ' — ' + esc(x.unvan) : ''}</option>`).join('')}</select></div>
    <div class="fld"><label for="od-r">Karar sürecindeki rolü</label><select id="od-r"><option value="">Seç</option>${['Karar verici', 'Etkileyici', 'Teknik', 'Satınalma', 'Saha'].map(r => `<option ${k.rol === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="btnrow"><button type="button" class="btn ghost" data-kart>Kişi kartını aç</button><span class="grow"></span><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="submit" class="btn primary" data-kay>Kaydet</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  const kapat = () => { d.close(); d.remove(); };
  d.querySelector('[data-vaz]').onclick = kapat;
  d.querySelector('[data-kart]').onclick = () => { kapat(); kartiAc(k.id); };
  d.addEventListener('cancel', () => d.remove());
  d.querySelector('form').onsubmit = async e => { e.preventDefault();
    const o = { unvan: d.querySelector('#od-u').value.trim() || null, pozisyon: d.querySelector('#od-p').value || null, ust_kisi_id: d.querySelector('#od-b').value || null, rol: d.querySelector('#od-r').value || null };
    kapat(); await kaydet(k.id, o); };
  d.querySelector('#od-u').focus();
}

// ---------- Şemayı resim (PNG) ya da PDF olarak indir ----------
// Ekrandaki ağacın kutularının yerleri ölçülür, temiz bir SVG çizilir (bağlantı çizgileri, isim, görev, rozetler).
// PNG: SVG tuvale çizilir. PDF: yazdırma penceresi açılır ("PDF olarak kaydet").
function semaSvg(kok, { baslik = '', alt = '', ayrilanlar = true } = {}) {
  const agac = kok.querySelector('.org'); if (!agac) return null;
  const eskiZoom = agac.style.zoom; agac.style.zoom = 1;
  const k0 = agac.getBoundingClientRect();
  const kutular = [], cizgiler = [];
  const yer = el => { const r = el.getBoundingClientRect(); return { x: r.left - k0.left, y: r.top - k0.top, w: r.width, h: r.height }; };
  const ana = li => li.querySelector(':scope > .org-kutu, :scope > .org-grup, :scope > .org-firma');
  for (const li of agac.querySelectorAll('li')) {
    const el = ana(li); if (!el) continue;
    const r = yer(el), tur = el.classList.contains('org-kutu') ? 'kisi' : el.classList.contains('org-firma') ? 'firma' : 'grup';
    const b = el.querySelector('b')?.textContent || el.childNodes[0]?.textContent?.trim() || '', sm = el.querySelector('.org-metin > small, :scope > small')?.textContent || '';
    const rozet = [...el.querySelectorAll('.org-rozet')].map(x => x.textContent.trim()).filter(Boolean);   // son temas ("temas yok", "26 gün önce") çıktıya girmez
    const kayit = { ...r, tur, b, sm, rozet, harf: el.querySelector('.avatar')?.textContent || '' };
    if (tur === 'kisi') kayit.h = Math.min(r.h, rozet.length ? 62 : 46);   // temas satırı yok: kutu kısalır
    kutular.push(kayit); el._svgK = kayit;
    const ust = li.parentElement?.closest('li'), ue = ust && ana(ust);
    if (ue?._svgK) { const u = ue._svgK; cizgiler.push([u.x + u.w / 2, u.y + u.h, r.x + r.w / 2, r.y]); }
  }
  agac.querySelectorAll('.org-kutu, .org-grup, .org-firma').forEach(e => delete e._svgK);
  agac.style.zoom = eskiZoom;
  const eskiler = !ayrilanlar ? [] : [...kok.querySelectorAll('.org-eski .org-kutu')].map(el => ({ b: el.querySelector('b')?.textContent || '', sm: el.querySelector('small')?.textContent || '', rozet: [...el.querySelectorAll('.org-rozet')].map(x => x.textContent.trim()) }));
  const P = 32, UST = baslik ? 70 : 20;
  const gen = Math.max(...kutular.map(k => k.x + k.w), 300), yuk = Math.max(...kutular.map(k => k.y + k.h), 100);
  const eskiY = UST + yuk + 40, eskiYuk = eskiler.length ? 34 + Math.ceil(eskiler.length / Math.max(1, Math.floor(gen / 230))) * 74 : 0;
  const W = gen + P * 2, H = eskiY + eskiYuk + P - (eskiler.length ? 0 : 20);
  const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kes = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const ox = P, oy = UST;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Roboto, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  if (baslik) svg += `<text x="${P}" y="38" font-size="22" font-weight="700" fill="#1D2B36">${x(baslik)}</text><text x="${P}" y="58" font-size="12.5" fill="#5E6E7A">${x(alt)}</text>`;
  svg += `<g fill="none" stroke="#B9C4CB" stroke-width="1.5">${cizgiler.map(([x1, y1, x2, y2]) => { const m = (y1 + y2) / 2; return `<path d="M${ox + x1} ${oy + y1}V${oy + m}H${ox + x2}V${oy + y2}"/>`; }).join('')}</g>`;
  const kutuCiz = (k, X, Y, W2, H2, soluk) => {
    let g = `<rect x="${X}" y="${Y}" width="${W2}" height="${H2}" rx="10" fill="${soluk ? '#F6F8F9' : '#fff'}" stroke="${soluk ? '#DCE2E6' : '#C9D2D8'}"${soluk ? ' stroke-dasharray="4 3"' : ''}/>`;
    g += `<circle cx="${X + 20}" cy="${Y + 22}" r="11" fill="${soluk ? '#93A4AF' : '#1D2B36'}"/><text x="${X + 20}" y="${Y + 26.5}" font-size="12" font-weight="700" fill="#F5B800" text-anchor="middle">${x((k.harf || k.b).slice(0, 1))}</text>`;
    const mx = Math.floor((W2 - 44) / 6.6);
    g += `<text x="${X + 38}" y="${Y + 20}" font-size="13" font-weight="700" fill="${soluk ? '#5E6E7A' : '#1D2B36'}">${x(kes(k.b, mx))}</text><text x="${X + 38}" y="${Y + 36}" font-size="11.5" fill="#5E6E7A">${x(kes(k.sm, mx + 2))}</text>`;
    if (k.rozet?.length) g += `<text x="${X + 38}" y="${Y + 52}" font-size="10.5" fill="${/karar/.test(k.rozet[0]) ? '#8A6100' : '#5E6E7A'}">${x(kes(k.rozet.join(' · '), mx + 4))}</text>`;
    return g;
  };
  for (const k of kutular) {
    const X = ox + k.x, Y = oy + k.y;
    if (k.tur === 'kisi') svg += kutuCiz(k, X, Y, k.w, k.h);
    else svg += `<rect x="${X}" y="${Y}" width="${k.w}" height="${k.h}" rx="${k.h / 2}" fill="${k.tur === 'firma' ? '#F5B800' : '#1D2B36'}"/><text x="${X + k.w / 2}" y="${Y + k.h / 2 + 4.5}" font-size="12.5" font-weight="700" fill="${k.tur === 'firma' ? '#10181D' : '#fff'}" text-anchor="middle">${x(k.b)}</text>`;
  }
  if (eskiler.length) {
    svg += `<line x1="${P}" y1="${eskiY - 16}" x2="${W - P}" y2="${eskiY - 16}" stroke="#DCE2E6" stroke-dasharray="5 4"/><text x="${P}" y="${eskiY + 6}" font-size="12.5" font-weight="700" fill="#5E6E7A">Firmadan ayrılanlar (${eskiler.length})</text>`;
    const sut = Math.max(1, Math.floor(gen / 230));
    eskiler.forEach((k, i) => { svg += kutuCiz(k, P + (i % sut) * 230, eskiY + 20 + Math.floor(i / sut) * 74, 216, 62, true); });
  }
  return { svg: svg + '</svg>', W, H };
}
// Dosya adı ASCII: bazı tarayıcılar Türkçe harfli indirme adını yok sayıp "download" diye kaydediyor
const dosyaAdi = s => (s || 'sema').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c])).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sema';
export function orgIndir(kok, { baslik = '' } = {}) {
  const tarihStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const btn = kok.querySelector('[data-indir]'); if (!btn) return;
  btn.onclick = () => {
    const eskiN = kok.querySelectorAll('.org-eski .org-kutu').length;
    const d = document.createElement('dialog'); d.className = 'org-dlg';
    d.innerHTML = `<form method="dialog" class="form"><h3>Şemayı indir</h3>
      <div class="fld"><label>Biçim</label><div class="seg" role="group" aria-label="Biçim"><button type="button" data-bc="png" class="on">Resim (PNG)</button><button type="button" data-bc="pdf">PDF</button></div></div>
      ${eskiN ? `<label class="chk"><input type="checkbox" data-ayr> <span>Firmadan ayrılanlar da çıksın (${eskiN} kişi)</span></label>` : ''}
      <p class="hint">Son görüşme bilgisi (temas yok, … gün önce) çıktıya girmez; isim, görev ve karar rolü görünür.</p>
      <div class="btnrow"><span class="grow"></span><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="submit" class="btn primary" data-indirgit>İndir</button></div></form>`;
    document.body.appendChild(d); d.showModal(); d.addEventListener('close', () => d.remove());
    d.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => d.querySelectorAll('[data-bc]').forEach(x => x.classList.toggle('on', x === b)));
    d.querySelector('[data-vaz]').onclick = () => d.close();
    d.querySelector('form').onsubmit = e => { e.preventDefault();
      const bicim = d.querySelector('[data-bc].on').dataset.bc, ayrilanlar = !!d.querySelector('[data-ayr]')?.checked; d.close();
      indir(bicim, ayrilanlar); };
  };
  const indir = (bicim, ayrilanlar) => {
    const s = semaSvg(kok, { baslik: baslik ? baslik + ' · Organizasyon şeması' : 'Organizasyon şeması', alt: tarihStr + ' · Saha Takip', ayrilanlar }); if (!s) return;
    const ad = dosyaAdi(baslik) + '-organizasyon';
    if (bicim === 'png') {
      const img = new Image(), url = URL.createObjectURL(new Blob([s.svg], { type: 'image/svg+xml' }));
      img.onload = () => {
        const olcek = Math.min(2, 8000 / Math.max(s.W, s.H)), c = document.createElement('canvas'); c.width = Math.round(s.W * olcek); c.height = Math.round(s.H * olcek);
        const g = c.getContext('2d'); g.scale(olcek, olcek); g.drawImage(img, 0, 0); URL.revokeObjectURL(url);
        c.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ad + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }, 'image/png');
      };
      img.src = url;
    } else {
      const yatay = s.W > s.H;
      const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
      fr.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${ad}</title><style>@page { size: A4 ${yatay ? 'landscape' : 'portrait'}; margin: 10mm; } html, body { margin: 0; } svg { width: 100%; height: auto; max-height: ${yatay ? '186mm' : '273mm'}; display: block; }</style></head><body>${s.svg}</body></html>`;
      fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch {} setTimeout(() => fr.remove(), 60000); };
      document.body.appendChild(fr);
    }
  };
}
export const _semaSvg = semaSvg;   // test için
