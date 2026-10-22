// Projeye göre EAE ürün ailesi önerisi ve şartname kontrol listesi
import { S } from './db.js';
import { app } from './state.js';
import { esc, fold, num, toast, urunBilgi } from './ui.js';
import { AILELER, EAE_LINKLER } from './data/eae-katalog.js';
import { ayar, ayarYaz } from './ayar.js';

// ---------- Ürün önerisi ----------
export const ALANLAR = [
  { k: 'uretim', ad: 'Yüksek tavanlı üretim', re: /fabrika|uretim|tesis|metal|celik|demir|dokum|tekstil|kagit|ambalaj|plastik|cimento|makine|otomotiv|endustri|hangar/, aileler: ['HBL', 'RVX', 'SRD', 'TORNADO'], not: '8 m üzeri tavanda 60° optik, daha alçakta 90°.' },
  { k: 'depo', ad: 'Depo ve lojistik', re: /depo|lojistik|antrepo|raf|dagitim|soguk hava|kargo/, aileler: ['RVX', 'GARLED', 'HBL', 'SRD'], not: 'Raf aralarında lineer / asimetrik optik (Revoled-X, Garled) verimli.' },
  { k: 'nemli', ad: 'Gıda, nemli ve tozlu alan', re: /gida|un|sut|et |mezbaha|yikama|nem|kimya|ilac|soguk|dondur|toz|kumes|tarim|sera/, aileler: ['RER', 'GLS', 'YPB', 'LNG', 'RVX'], not: 'IP65/IP66 ve gıdaya uygun gövde; soğuk oda için Revoled-X COLD.' },
  { k: 'ex', ad: 'Patlama riskli (Ex-proof)', re: /rafineri|akaryakit depo|petrol|boya|patlay|\bex\b|atex|maden|gaz|kimya/, aileler: [], not: 'Ex-proof ürün gamı ayrı katalogda.', link: EAE_LINKLER.find(l => /Ex-Proof/i.test(l.ad)) },
  { k: 'ofis', ad: 'Ofis, idari bina, data center', re: /ofis|idari|data|bilgi islem|merkez bina|yonetim|banka|bina/, aileler: ['INFINOO', 'PLANO', 'DWL', 'AKUSTIK'], not: 'UGR<19 ofis armatürleri; data center için Infinoo.' },
  { k: 'cevre', ad: 'Otopark, yol ve çevre', re: /otopark|cevre|yol|saha|liman|stadyum|meydan|park |site |kampus|osb yol/, aileler: ['RA', 'HORUS', 'OSIRIS', 'ALB', 'PRL'], not: 'Yol armatürü + projektör; liman için Liman Çözümleri kataloğu.' },
  { k: 'ticari', ad: 'AVM, otel, hastane, okul', re: /avm|magaza|otel|hastane|okul|universite|cami|muze|restoran|kafe|ticari/, aileler: ['DWL', 'STL', 'PLANO', 'KRZ', 'BLM'], not: 'Mimari iç aydınlatma; koridor ve ortak alanlar için downlight.' },
  { k: 'kanopi', ad: 'Akaryakıt istasyonu, kanopi', re: /akaryakit|istasyon|kanopi|benzin/, aileler: ['KANOLED', 'PRL'], not: '' },
];
export function alanTahmini(p) {
  const metin = fold([p.ad, p.sektor, p.alt_sektor, p.notlar, p.osb, (p.urun_gruplari || []).join(' ')].filter(Boolean).join(' '));
  const l = ALANLAR.filter(a => a.re.test(metin));
  return l.length ? l : (/endustri|osb|sanayi/.test(metin) || p.osb ? [ALANLAR[0]] : []);
}
const aileBul = k => AILELER.find(a => a.aile === k);
const stokta = k => S.urunler.filter(u => fold(u.aile || '').replace(/\s/g, '') === fold(k).replace(/\s/g, '') || fold(u.aciklama || '').startsWith(fold(k) + ' ')).reduce((s, u) => s + (+u.stok || 0), 0);

export function oneriBolumu(kutu, p) {
  if (!kutu) return;
  let secili = alanTahmini(p).map(a => a.k);
  const ciz = () => {
    const alanlar = ALANLAR.filter(a => secili.includes(a.k));
    kutu.innerHTML = `<h3>Önerilen ürün aileleri</h3>
      <div class="chips">${ALANLAR.map(a => `<button type="button" class="chip ${secili.includes(a.k) ? 'on' : ''}" data-alan="${a.k}">${esc(a.ad)}</button>`).join('')}</div>
      ${alanlar.length ? alanlar.map(a => `<div class="oneri"><b>${esc(a.ad)}</b>${a.not ? `<small class="muted"> · ${esc(a.not)}</small>` : ''}
        <ul class="list">${a.aileler.map(aileBul).filter(Boolean).map(x => { const st = stokta(x.aile); return `<li><span class="grow"><b>${esc(x.ad)}</b><small class="muted"> · ${esc(x.kategori)}${st ? ` · Drv stokta ${num(st)} adet` : ''}</small><br><small>${esc(x.aciklama)}</small></span><a class="btn sm ghost" href="${x.url || 'https://www.eaeaydinlatma.com/urun/' + x.yol}" target="_blank" rel="noopener">Ürün sayfası</a></li>`; }).join('')}
        ${a.link ? `<li><a href="${a.link.url}" target="_blank" rel="noopener">${esc(a.link.ad)}</a></li>` : ''}</ul></div>`).join('')
      : '<p class="hint">Projenin adı, sektörü ve notlarından alan tipi çıkarılamadı. Yukarıdan alan tipini seç.</p>'}`;
    kutu.querySelectorAll('[data-alan]').forEach(b => b.onclick = () => { const k = b.dataset.alan; secili = secili.includes(k) ? secili.filter(x => x !== k) : [...secili, k]; ciz(); });
  };
  ciz();
}

// ---------- Şartname kontrol listesi ----------
// Şartname değerleri ayarlarda proje bazında saklanır (sartname:<proje id>); teklifteki her kalem aile özellikleriyle karşılaştırılır.
const ALAN = [
  ['ip', 'En az IP', 'num', 'örn. 65'], ['ik', 'En az IK', 'num', 'örn. 08'], ['lmw', 'En az verim (lm/W)', 'num', 'örn. 140'],
  ['cri', 'En az CRI (Ra)', 'num', 'örn. 80'], ['cct', 'Renk sıcaklığı (K)', 'num', 'örn. 4000'], ['garanti', 'Garanti (yıl)', 'num', 'örn. 5'],
  ['sertifika', 'Sertifikalar', 'text', 'örn. ENEC, CE'], ['dali', 'DALI / dimmable', 'chk', ''],
];
const ozellik = aile => {
  const oz = (aile?.oz || []).join(' · ');
  const ip = Math.max(0, ...[...oz.matchAll(/IP\s?(\d{2})/g)].map(m => +m[1]));
  const ik = Math.max(0, ...[...oz.matchAll(/IK\s?(\d{2})/g)].map(m => +m[1]));
  const cri = (/CRI\s?[>≥]\s?(\d{2})/.exec(oz) || [])[1];
  const cct = [...oz.matchAll(/(\d{4})\s?[–-]\s?(\d{4})\s?K/g)].map(m => [+m[1], +m[2]])[0] || null;
  const garanti = (/(\d)\s?yıl garanti/i.exec(oz) || [])[1];
  return { ip: ip || null, ik: ik || null, cri: cri ? +cri : null, cct, garanti: garanti ? +garanti : null, metin: oz };
};
const kalemAilesi = k => { const ad = fold((k.kod || '') + ' ' + (k.ad || '')); return AILELER.slice().sort((a, b) => b.aile.length - a.aile.length).find(a => ad.split(/\s+/).some(w => w === fold(a.aile).replace(/\s/g, '')) || ad.includes(fold(a.ad))); };
function kontrol(s, k) {
  const a = kalemAilesi(k), o = ozellik(a), b = urunBilgi(k.ad);
  const sonuc = [];
  const ekle = (ad, gerek, var_, ok) => sonuc.push({ ad, gerek, var_, ok });
  if (s.ip) ekle('IP', 'IP' + s.ip, o.ip ? 'IP' + o.ip : '?', o.ip ? o.ip >= +s.ip : null);
  if (s.ik) ekle('IK', 'IK' + String(s.ik).padStart(2, '0'), o.ik ? 'IK' + String(o.ik).padStart(2, '0') : '?', o.ik ? o.ik >= +s.ik : null);
  if (s.lmw) ekle('Verim', s.lmw + ' lm/W', b.verim ? b.verim + ' lm/W' : '?', b.verim ? b.verim >= +s.lmw : null);
  if (s.cri) ekle('CRI', '≥' + s.cri, o.cri ? '>' + o.cri : '?', o.cri ? o.cri >= +s.cri : null);
  if (s.cct) { const v = b.k || null; ekle('Renk sıcaklığı', s.cct + ' K', v ? v + ' K' : o.cct ? o.cct.join('–') + ' K' : '?', v ? Math.abs(v - +s.cct) <= 300 : o.cct ? +s.cct >= o.cct[0] && +s.cct <= o.cct[1] : null); }
  if (s.garanti) ekle('Garanti', s.garanti + ' yıl', o.garanti ? o.garanti + ' yıl' : '?', o.garanti ? o.garanti >= +s.garanti : null);
  if (s.sertifika) for (const c of String(s.sertifika).split(/[,;/ ]+/).filter(Boolean)) ekle(c.toUpperCase(), 'var', o.metin ? (o.metin.toUpperCase().includes(c.toUpperCase()) ? 'var' : 'katalogda yok') : '?', o.metin ? o.metin.toUpperCase().includes(c.toUpperCase()) : null);
  if (s.dali) ekle('DALI', 'gerekli', /dali|dimm/i.test(o.metin) ? 'var' : '?', /dali|dimm/i.test(o.metin) ? true : null);
  return { aile: a, sonuc };
}
export function sartnameBolumu(kutu, p) {
  if (!kutu) return;
  const anahtar = 'sartname:' + p.id;
  const ciz = () => {
    const s = ayar(anahtar, {}) || {};
    const kok = no => String(no || '').replace(/-R\d+$/i, '');
    const sonT = new Map(); for (const t of S.teklifler.filter(t => t.proje_id === p.id)) { const k = kok(t.teklif_no); if (!sonT.has(k) || (t.teklif_no || '') > (sonT.get(k).teklif_no || '')) sonT.set(k, t); }
    const kalemler = [...sonT.values()].flatMap(t => (t.kalemler || []).map(k => ({ ...k, _t: t.teklif_no })));
    const dolu = Object.values(s).some(v => v !== '' && v != null && v !== false);
    kutu.innerHTML = `<h3>Şartname kontrolü</h3>
      <details ${dolu ? '' : 'open'}><summary>Şartnamede istenenler${dolu ? ` <small class="muted">· ${ALAN.filter(([k]) => s[k]).map(([k, l]) => l.replace(/^En az /, '') + ' ' + (s[k] === true ? '✓' : s[k])).join(', ')}</small>` : ''}</summary>
        <div class="grid sart-g">${ALAN.map(([k, l, t, ph]) => t === 'chk' ? `<div class="fld is-chk"><label class="chk"><input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}> <span>${l}</span></label></div>` : `<div class="fld"><label>${l}</label><input data-s="${k}" ${t === 'num' ? 'type="number" inputmode="numeric"' : ''} value="${esc(s[k] ?? '')}" placeholder="${esc(ph)}"></div>`).join('')}</div>
        <div class="btnrow"><button type="button" class="btn sm" data-skaydet>Kaydet ve kontrol et</button></div></details>
      ${!dolu ? '<p class="hint">Şartnamedeki değerleri gir; projedeki tekliflerin her kalemi EAE ürün ailesi bilgileriyle karşılaştırılır.</p>'
        : !kalemler.length ? '<p class="hint">Bu projede ürün kalemi olan teklif yok. Teklif hazırlayınca burada kontrol edilir.</p>'
        : `<div class="tbl-wrap"><table class="tbl sart-t"><thead><tr><th>Teklif kalemi</th>${kontrol(s, kalemler[0]).sonuc.map(x => `<th>${esc(x.ad)}<small>${esc(x.gerek)}</small></th>`).join('')}</tr></thead><tbody>
          ${kalemler.map(k => { const r = kontrol(s, k); return `<tr><td><b>${esc(k.ad || k.kod || '')}</b><small class="muted">${esc(k._t || '')}${r.aile ? ' · ' + esc(r.aile.ad) : ' · aile bulunamadı'}</small></td>${r.sonuc.map(x => `<td class="sk ${x.ok === true ? 'ok' : x.ok === false ? 'yok' : 'bilinmez'}">${x.ok === true ? '✓' : x.ok === false ? '✗' : '?'} <small>${esc(x.var_)}</small></td>`).join('')}</tr>`; }).join('')}
        </tbody></table></div><p class="hint">✓ uygun · ✗ uygun değil · ? katalogda bilgi yok, ürün föyünden kontrol et. Değerler EAE web sitesindeki aile özelliklerinden ve ürün kodundan (güç, lümen, renk sıcaklığı) okunur.</p>`}`;
    kutu.querySelector('[data-skaydet]').onclick = async () => {
      const yeni = Object.fromEntries([...kutu.querySelectorAll('[data-s]')].map(i => [i.dataset.s, i.type === 'checkbox' ? i.checked : i.value.trim()]).filter(([, v]) => v !== '' && v !== false));
      await ayarYaz(anahtar, Object.keys(yeni).length ? yeni : null); toast('Şartname kaydedildi.'); ciz();
    };
  };
  ciz();
}
