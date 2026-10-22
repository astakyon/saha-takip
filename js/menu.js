// Menü düzeni: hangi ekranlar menüde görünsün, hangileri ana çubukta (telefonda alt çubuk) dursun. Ayarlar → Genel → Menü.
import { ayar, ayarYaz } from './ayar.js';
import { app } from './state.js';
import { esc, toast } from './ui.js';
import { rotaIzinli } from './yetki.js';

export const SABIT = ['bugun', 'ayarlar'];     // gizlenemez
export const ANA_EN_COK = 5;                   // telefondaki alt çubuğa sığan sayı (+ “Diğer”)
const GRUPLAR = ['Saha', 'Satış', 'Rapor'];

export function menuDuzeni(R = app.rotalar || {}) {
  const m = ayar('menu') || {};
  const gizli = new Set((m.gizli || []).filter(k => R[k] && !SABIT.includes(k)));
  let vars = Object.keys(R).filter(k => R[k].main);
  if (app.yetki?.yetkiler?._rol === 'Bayi' && R.bayi) vars = ['bugun', 'bayi', ...vars.filter(k => k !== 'bugun')];   // bayi rolündeki üyeye ana çubukta Bayi paneli
  const ana = (Array.isArray(m.ana) && m.ana.length ? m.ana : vars).filter(k => R[k] && !gizli.has(k)).slice(0, ANA_EN_COK);
  return { gizli, ana, ozel: !!(m.gizli?.length || m.ana?.length) };
}
async function kaydet(gizli, ana) {
  await ayarYaz('menu', { gizli: [...gizli], ana });
  window.dispatchEvent(new CustomEvent('menu'));
}

// Ayarlar kartı
export function menuAyarlari(root) {
  const R = app.rotalar || {};
  const ciz = () => {
    const { gizli, ana, ozel } = menuDuzeni(R);
    const satir = k => {
      const r = R[k], sabit = SABIT.includes(k), gor = !gizli.has(k), anada = ana.includes(k);
      return `<tr data-k="${k}"><td>${esc(r.t)}</td>
        <td class="c"><label class="tg" title="${sabit ? 'Bu ekran her zaman görünür' : 'Menüde göster'}"><input type="checkbox" data-gor ${gor ? 'checked' : ''} ${sabit ? 'disabled' : ''} aria-label="${esc(r.t)} menüde görünsün"><span></span></label></td>
        <td class="c"><label class="tg"><input type="checkbox" data-ana ${anada ? 'checked' : ''} ${gor ? '' : 'disabled'} aria-label="${esc(r.t)} ana çubukta dursun"><span></span></label></td></tr>`;
    };
    root.innerHTML = `<p>Kullanmadığın ekranları kapat; menüden kalkar, verileri silinmez. İstediğin zaman buradan geri açarsın. Telefonda ve bilgisayarda aynı düzen kullanılır.</p>
      <table class="tbl menu-tbl"><thead><tr><th>Ekran</th><th class="c">Menüde</th><th class="c">Ana çubukta <small class="muted">(en çok ${ANA_EN_COK})</small></th></tr></thead>
      <tbody>${GRUPLAR.map(g => `<tr class="grp"><td colspan="3">${g}</td></tr>` + Object.keys(R).filter(k => (R[k].g || 'Saha') === g && rotaIzinli(k)).map(satir).join('')).join('')}</tbody></table>
      <p class="hint">Ana çubuk: telefonda alttaki sabit çubuk, bilgisayarda sol menünün üst kısmı. Diğer açık ekranlar “Diğer” altında durur.</p>
      <div class="btnrow"><button type="button" class="btn ghost" data-varsayilan ${ozel ? '' : 'disabled'}>Varsayılan düzene dön</button></div>`;
    root.querySelectorAll('[data-gor]').forEach(c => c.onchange = async () => {
      const k = c.closest('tr').dataset.k; const { gizli, ana } = menuDuzeni(R);
      if (c.checked) gizli.delete(k); else gizli.add(k);
      await kaydet(gizli, ana.filter(x => x !== k || c.checked)); toast(c.checked ? `${R[k].t} menüye eklendi.` : `${R[k].t} menüden kaldırıldı.`); ciz();
    });
    root.querySelectorAll('[data-ana]').forEach(c => c.onchange = async () => {
      const k = c.closest('tr').dataset.k; const { gizli, ana } = menuDuzeni(R);
      if (c.checked) { if (ana.length >= ANA_EN_COK) { c.checked = false; return toast(`Ana çubukta en çok ${ANA_EN_COK} ekran olabilir. Önce birini çıkar.`, 'err'); } ana.push(k); }
      else { if (ana.length <= 1) { c.checked = true; return toast('Ana çubukta en az bir ekran kalmalı.', 'err'); } ana.splice(ana.indexOf(k), 1); }
      // Varsayılan sırayı koru
      const sira = Object.keys(R); ana.sort((a, b) => sira.indexOf(a) - sira.indexOf(b));
      await kaydet(gizli, ana); ciz();
    });
    root.querySelector('[data-varsayilan]').onclick = async () => { await ayarYaz('menu', null); window.dispatchEvent(new CustomEvent('menu')); toast('Menü varsayılan düzene döndü.'); ciz(); };
  };
  ciz();
}
