// Basit, erişilebilir yatay çubuk grafikler (HTML). Renkler: seri 1 mavi (biz / kazanılan), seri 2 turuncu (rakip / kaybedilen).
import { esc } from './ui.js';

export const SERI = ['#2a78d6', '#eb6834'];

// satirlar: [{ etiket, deger, yazi?, seri? (0|1), alt? }]
export function cubuklar(satirlar, { bos = 'Veri yok', yazi = v => v, tablo = true, baslik = '' } = {}) {
  if (!satirlar.length) return `<p class="hint">${esc(bos)}</p>`;
  const max = Math.max(...satirlar.map(s => +s.deger || 0), 1);
  return `<div class="cg" role="list" aria-label="${esc(baslik)}">${satirlar.map(s => {
    const w = Math.max((+s.deger || 0) / max * 100, s.deger ? 1.5 : 0), t = s.yazi ?? yazi(s.deger);
    return `<div class="cg-r" role="listitem" tabindex="0" title="${esc(s.etiket)}: ${esc(t)}${s.alt ? ' · ' + esc(s.alt) : ''}"><span class="cg-e">${esc(s.etiket)}</span>
      <span class="cg-b"><i style="width:${w}%;background:${SERI[s.seri || 0]}"></i></span><span class="cg-v">${esc(t)}${s.alt ? `<small>${esc(s.alt)}</small>` : ''}</span></div>`;
  }).join('')}</div>${tablo ? `<details class="cg-t"><summary>Tablo olarak gör</summary><table class="tbl"><tbody>${satirlar.map(s => `<tr><td>${esc(s.etiket)}</td><td class="r">${esc(s.yazi ?? yazi(s.deger))}</td>${s.alt ? `<td>${esc(s.alt)}</td>` : ''}</tr>`).join('')}</tbody></table></details>` : ''}`;
}

// İki serili gruplu çubuk: gruplar: [{ etiket, a, b }], seriler: ['Kazanılan', 'Kaybedilen']
export function ikili(gruplar, seriler, { yazi = v => v, bos = 'Veri yok' } = {}) {
  if (!gruplar.some(g => g.a || g.b)) return `<p class="hint">${esc(bos)}</p>`;
  const max = Math.max(...gruplar.flatMap(g => [+g.a || 0, +g.b || 0]), 1);
  const bar = (v, i, e) => `<div class="cg-r sub" tabindex="0" title="${esc(e)} · ${esc(seriler[i])}: ${esc(yazi(v))}"><span class="cg-e">${i ? '' : esc(e)}</span><span class="cg-b"><i style="width:${Math.max((+v || 0) / max * 100, v ? 1.5 : 0)}%;background:${SERI[i]}"></i></span><span class="cg-v">${esc(yazi(v))}</span></div>`;
  return `<p class="cg-leg">${seriler.map((s, i) => `<span><i style="background:${SERI[i]}"></i>${esc(s)}</span>`).join('')}</p>
    <div class="cg">${gruplar.map(g => `<div class="cg-g">${bar(g.a, 0, g.etiket)}${bar(g.b, 1, g.etiket)}</div>`).join('')}</div>
    <details class="cg-t"><summary>Tablo olarak gör</summary><table class="tbl"><thead><tr><th></th>${seriler.map(s => `<th class="r">${esc(s)}</th>`).join('')}</tr></thead><tbody>${gruplar.map(g => `<tr><td>${esc(g.etiket)}</td><td class="r">${esc(yazi(g.a))}</td><td class="r">${esc(yazi(g.b))}</td></tr>`).join('')}</tbody></table></details>`;
}
