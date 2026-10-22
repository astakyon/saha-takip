// Excel sütun eşleştirme: ilk yüklemede algılanan sütunları gösterir, düzeltmeni ister ve başlık adlarına göre hatırlar.
// Sonraki yüklemelerde aynı başlıklar varsa soru sormadan devam eder.
import { ayar, ayarYaz } from './ayar.js';
import { esc, openDrawer, closeDrawer, toast } from './ui.js';

const kayitli = () => ayar('excel_esle', {}) || {};
const goster = v => v instanceof Date ? v.toLocaleDateString('tr-TR') : v == null ? '' : String(v).slice(0, 40);

/**
 * @param anahtar  'siparis' | 'tahsilat' | 'stok'
 * @param baslik   panel başlığı
 * @param h        başlık satırı (metin dizisi)
 * @param ornek    veri satırlarından birkaçı
 * @param alanlar  [{ k, l, zorunlu }]
 * @param oto      { k: sütunNo } otomatik algılanan (-1 = yok)
 * @returns { k: sütunNo } ya da null (vazgeçildi)
 */
export function sutunlariEsle(anahtar, baslik, h, ornek, alanlar, oto) {
  const ad = h.map(x => String(x ?? '').trim());
  const s = kayitli()[anahtar];
  const map = {};
  for (const a of alanlar) map[a.k] = oto[a.k] ?? -1;
  let tamKayit = !!s;
  if (s) for (const a of alanlar) {
    if (!(a.k in s)) continue;
    if (s[a.k] === null) { map[a.k] = -1; continue; }
    const i = ad.indexOf(s[a.k]); if (i >= 0) map[a.k] = i; else tamKayit = false;
  }
  const eksik = () => alanlar.filter(a => a.zorunlu && !(map[a.k] >= 0));
  if (tamKayit && !eksik().length) { return Promise.resolve(map); }
  return new Promise(res => {
    let bitti = false;
    const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(baslik)}</p><h2 id="drawer-title">Sütunları kontrol et</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <form class="dbody form"><p class="hint">${s ? 'Dosyanın başlıkları geçen seferkinden farklı.' : 'Bu dosya türünü ilk kez yüklüyorsun.'} Algılanan sütunları kontrol et; seçimin hatırlanır ve bir sonraki yüklemede bu ekran açılmaz.</p>
      <table class="tbl esle-tbl"><thead><tr><th>Uygulamadaki alan</th><th>Dosyadaki sütun</th><th>Örnek</th></tr></thead><tbody>
      ${alanlar.map(a => `<tr data-k="${a.k}"><td>${esc(a.l)}${a.zorunlu ? ' <span class="req">*</span>' : ''}</td><td><select aria-label="${esc(a.l)} sütunu"><option value="-1">— yok —</option>${ad.map((x, i) => `<option value="${i}" ${map[a.k] === i ? 'selected' : ''}>${esc(x || `Sütun ${i + 1}`)}</option>`).join('')}</select></td><td class="muted" data-ornek></td></tr>`).join('')}
      </tbody></table>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet ve devam et</button></div></form>`, { wide: true, onClose: () => { if (!bitti) { bitti = true; res(null); } } });
    const ornekYaz = tr => { const i = +tr.querySelector('select').value; tr.querySelector('[data-ornek]').textContent = i >= 0 ? ornek.map(r => goster(r[i])).filter(Boolean).slice(0, 2).join(' · ') : ''; };
    p.querySelectorAll('tr[data-k]').forEach(tr => { ornekYaz(tr); tr.querySelector('select').onchange = () => { map[tr.dataset.k] = +tr.querySelector('select').value; ornekYaz(tr); }; });
    p.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const ek = eksik(); if (ek.length) return toast('Zorunlu alan için sütun seç: ' + ek.map(a => a.l).join(', '), 'err');
      const k = kayitli(); k[anahtar] = Object.fromEntries(alanlar.map(a => [a.k, map[a.k] >= 0 ? ad[map[a.k]] : null]));
      await ayarYaz('excel_esle', k);
      bitti = true; closeDrawer(); res(map);
    };
  });
}
export async function eslemeleriSifirla() { await ayarYaz('excel_esle', null); }

/**
 * İçe aktarma önizlemesi: kaç kayıt eklenecek / güncellenecek / değişmeyecek; örnek satırlar. İsteğe bağlı bir onay kutusu.
 * @returns Promise<{ ok: boolean, secim: boolean }>
 */
export function onizleOnay({ baslik, sayilar, ornekBaslik = [], ornek = [], secenek = null }) {
  return new Promise(res => {
    let bitti = false;
    const p = openDrawer(`<header class="dh"><div><p class="muted">İçe aktarma önizlemesi</p><h2 id="drawer-title">${esc(baslik)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody"><div class="onizle-say">${sayilar.map(([t, n, cls]) => `<div class="${cls || ''}"><b>${n}</b><span>${esc(t)}</span></div>`).join('')}</div>
      ${ornek.length ? `<h3>İlk satırlar</h3><div class="tbl-wrap"><table class="tbl"><thead><tr>${ornekBaslik.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${ornek.map(r => `<tr>${r.map(v => `<td>${esc(goster(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${secenek ? `<label class="chk"><input type="checkbox" data-sec ${secenek.varsayilan ? 'checked' : ''}> <span>${esc(secenek.metin)}</span></label>` : ''}
      <p class="hint">Hiçbir kayıt silinmez. Onaylamazsan hiçbir şey değişmez.</p></div>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="button" class="btn primary" data-onay>İçe aktar</button></div>`, { wide: true, onClose: () => { if (!bitti) { bitti = true; res({ ok: false, secim: false }); } } });
    p.querySelector('[data-onay]').onclick = () => { bitti = true; const secim = !!p.querySelector('[data-sec]')?.checked; closeDrawer(); res({ ok: true, secim }); };
  });
}
