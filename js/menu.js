// Menü düzeni: hangi ekranlar menüde görünsün, hangileri ana çubukta (telefonda alt çubuk) dursun. Ayarlar → Genel → Menü.
import { ayar, ayarYaz } from './ayar.js';
import { app } from './state.js';
import { esc, toast } from './ui.js';
import { rotaIzinli } from './yetki.js';
import { BASLIKLAR, SEKME_AD, baslikOf, VARS_ANA } from './basliklar.js';

export const SABIT = ['bugun', 'ayarlar'];     // gizlenemez
export const ANA_EN_COK = 5;                   // telefondaki alt çubuğa sığan başlık sayısı (+ “Diğer”)

// gizli: kapatılan ekranlar (rota). ana: alt çubuktaki başlıklar. Eski ayarlarda ana rota adlarıyla tutuluyordu; başlığa çevrilir.
export function menuDuzeni(R = app.rotalar || {}) {
  const m = ayar('menu') || {};
  const gizli = new Set((m.gizli || []).filter(k => R[k] && !SABIT.includes(k)));
  const gorunur = b => b.r.some(r => R[r] && !gizli.has(r) && rotaIzinli(r));
  let ana = Array.isArray(m.ana) && m.ana.length ? [...new Set(m.ana.map(k => BASLIKLAR.find(b => b.k === k) ? k : baslikOf(k)?.k).filter(Boolean))] : [...VARS_ANA];
  if (app.yetki?.yetkiler?._rol === 'Bayi' && !m.ana?.length) ana = ['bugun', 'urunler', ...ana.filter(k => !['bugun', 'urunler'].includes(k))];   // bayi rolündeki üyeye ana çubukta Ürünler (Bayi paneli)
  ana = ana.filter(k => { const b = BASLIKLAR.find(x => x.k === k); return b && gorunur(b); }).slice(0, ANA_EN_COK);
  return { gizli, ana, gorunur, ozel: !!(m.gizli?.length || m.ana?.length) };
}
async function kaydet(gizli, ana) {
  await ayarYaz('menu', { gizli: [...gizli], ana });
  window.dispatchEvent(new CustomEvent('menu'));
}

// Ayarlar kartı
export function menuAyarlari(root) {
  const R = app.rotalar || {};
  const ciz = () => {
    const { gizli, ana, ozel, gorunur } = menuDuzeni(R);
    const satir = k => {
      const sabit = SABIT.includes(k), gor = !gizli.has(k);
      return `<tr data-k="${k}"><td class="alt">${esc(SEKME_AD[k] || R[k].t)}</td>
        <td class="c"><label class="tg" title="${sabit ? 'Bu ekran her zaman görünür' : 'Menüde göster'}"><input type="checkbox" data-gor ${gor ? 'checked' : ''} ${sabit ? 'disabled' : ''} aria-label="${esc(R[k].t)} menüde görünsün"><span></span></label></td><td></td></tr>`;
    };
    const baslik = b => { const rs = b.r.filter(r => R[r] && rotaIzinli(r)); if (!rs.length) return ''; const tek = rs.length === 1, anada = ana.includes(b.k), gor = gorunur(b);
      return `<tr class="grp" data-b="${b.k}" ${tek ? `data-k="${rs[0]}"` : ''}><td><b>${esc(b.t)}</b></td>
        <td class="c">${tek ? `<label class="tg"><input type="checkbox" data-gor ${gor ? 'checked' : ''} ${SABIT.includes(rs[0]) ? 'disabled' : ''} aria-label="${esc(b.t)} menüde görünsün"><span></span></label>` : ''}</td>
        <td class="c"><label class="tg"><input type="checkbox" data-ana ${anada ? 'checked' : ''} ${gor ? '' : 'disabled'} aria-label="${esc(b.t)} ana çubukta dursun"><span></span></label></td></tr>${tek ? '' : rs.map(satir).join('')}`; };
    root.innerHTML = `<p>Kullanmadığın ekranları kapat; menüden kalkar, verileri silinmez. İstediğin zaman buradan geri açarsın. Telefonda ve bilgisayarda aynı düzen kullanılır.</p>
      <details class="menu-d"><summary>Ekranları göster / gizle ve ana çubuğu seç</summary>
      <table class="tbl menu-tbl"><thead><tr><th>Başlık / ekran</th><th class="c">Menüde</th><th class="c">Ana çubukta <small class="muted">(en çok ${ANA_EN_COK})</small></th></tr></thead>
      <tbody>${BASLIKLAR.map(baslik).join('')}</tbody></table>
      <p class="hint">Ana çubuk: telefonda alttaki sabit çubuk, bilgisayarda sol menünün üst kısmı. Diğer başlıklar “Diğer” altında durur. Bir başlığın içindeki ekranlar o başlıkta üstte sekme olarak görünür.</p>
      <div class="btnrow"><button type="button" class="btn ghost" data-varsayilan ${ozel ? '' : 'disabled'}>Varsayılan düzene dön</button></div></details>`;
    root.querySelectorAll('[data-gor]').forEach(c => c.onchange = async () => {
      const k = c.closest('[data-k]').dataset.k; const { gizli, ana } = menuDuzeni(R);
      if (c.checked) gizli.delete(k); else gizli.add(k);
      await kaydet(gizli, ana); toast(c.checked ? `${SEKME_AD[k] || R[k].t} menüye eklendi.` : `${SEKME_AD[k] || R[k].t} menüden kaldırıldı.`); ciz(); root.querySelector('.menu-d').open = true;
    });
    root.querySelectorAll('[data-ana]').forEach(c => c.onchange = async () => {
      const k = c.closest('tr').dataset.b; const { gizli, ana } = menuDuzeni(R);
      if (c.checked) { if (ana.length >= ANA_EN_COK) { c.checked = false; return toast(`Ana çubukta en çok ${ANA_EN_COK} başlık olabilir. Önce birini çıkar.`, 'err'); } ana.push(k); }
      else { if (ana.length <= 1) { c.checked = true; return toast('Ana çubukta en az bir başlık kalmalı.', 'err'); } ana.splice(ana.indexOf(k), 1); }
      const sira = BASLIKLAR.map(b => b.k); ana.sort((a, b) => sira.indexOf(a) - sira.indexOf(b));
      await kaydet(gizli, ana); ciz(); root.querySelector('.menu-d').open = true;
    });
    root.querySelector('[data-varsayilan]').onclick = async () => { await ayarYaz('menu', null); window.dispatchEvent(new CustomEvent('menu')); toast('Menü varsayılan düzene döndü.'); ciz(); };
  };
  ciz();
}
