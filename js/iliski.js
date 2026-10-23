// Firma ilişki ağı: aynı projede yer alan firmalar birbirine bağlıdır (yatırımcı, projeci, danışman, Gemüt, Emüt, alıcı, bayi).
// Firma kartında çevresindeki firmalar ve "bir kapıdan diğerine yol": hedef firmaya hangi tanıdık firmalar ve projeler üzerinden ulaşılır.
import { S } from './db.js';
import { esc, byId } from './ui.js';

const ROLLER = [['yatirimci_id', 'Yatırımcı'], ['projeci_id', 'Projeci'], ['danisman_id', 'Danışman'], ['gemut_id', 'Gemüt'], ['emut_id', 'Emüt'], ['alici_id', 'Alıcı'], ['bayi_id', 'Bayi']];
const RENK = { 'Emüt': '#0E7490', 'Gemüt': '#7C3AED', 'Proje Bürosu': '#2563EB', 'Danışman': '#A16207', 'Bayi': '#EA580C', 'Yatırımcı': '#15803D', 'Malzeme Alıcısı': '#DB2777' };
const renk = f => RENK[(f?.tipler || []).find(t => RENK[t])] || '#5E6E7A';

// firma → (komşu firma → ortak projeler)
export function ag() {
  const g = new Map();
  const ekle = (a, b, p) => { if (!g.has(a)) g.set(a, new Map()); const m = g.get(a); if (!m.has(b)) m.set(b, []); m.get(b).push(p); };
  for (const p of S.projeler) {
    const ids = [...new Set(ROLLER.map(([k]) => p[k]).filter(Boolean))];
    for (const a of ids) for (const b of ids) if (a !== b) ekle(a, b, p);
  }
  return g;
}
const rol = (p, fid) => ROLLER.filter(([k]) => p[k] === fid).map(([, l]) => l).join('/');
// En kısa yol (BFS): [{f, p}] — p: önceki firmayla ortak proje
export function yol(g, kaynak, hedef) {
  if (kaynak === hedef) return [{ f: kaynak }];
  const once = new Map([[kaynak, null]]), q = [kaynak];
  while (q.length) {
    const a = q.shift();
    for (const [b, ps] of g.get(a) || []) {
      if (once.has(b)) continue;
      once.set(b, { a, p: ps[0] });
      if (b === hedef) { const r = [{ f: b, p: ps[0] }]; let c = a; while (c !== kaynak) { const o = once.get(c); r.unshift({ f: c, p: o.p }); c = o.a; } r.unshift({ f: kaynak }); return r; }
      q.push(b);
    }
  }
  return null;
}

export function iliskiBolumu(kutu, firma) {
  if (!kutu) return;
  const g = ag(), komsu = [...(g.get(firma.id) || new Map())].map(([id, ps]) => ({ f: byId('firmalar', id), ps })).filter(x => x.f).sort((a, b) => b.ps.length - a.ps.length || a.f.ad.localeCompare(b.f.ad, 'tr'));
  if (!komsu.length) { kutu.innerHTML = ''; return; }
  const N = Math.min(komsu.length, 14), W = 340, H = 240, cx = W / 2, cy = H / 2, R = 92;
  const noktalar = komsu.slice(0, N).map((x, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return { ...x, x: cx + R * Math.cos(a) * 1.35, y: cy + R * Math.sin(a) }; });
  const kisa = s => s.length > 16 ? s.slice(0, 15) + '…' : s;
  kutu.innerHTML = `<h3>İlişki ağı <span class="muted">${komsu.length} firma</span></h3>
    <div class="iliski-g"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(firma.ad)} ile aynı projelerde yer alan firmalar">
      ${noktalar.map(n => `<line x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="var(--line)" stroke-width="${Math.min(1 + n.ps.length, 5)}"/>`).join('')}
      <circle cx="${cx}" cy="${cy}" r="9" fill="${renk(firma)}"/><text x="${cx}" y="${cy + 22}" text-anchor="middle" class="ig-merkez">${esc(kisa(firma.ad))}</text>
      ${noktalar.map(n => `<a href="#/firma/${n.f.id}"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="6" fill="${renk(n.f)}"><title>${esc(n.f.ad)} · ${n.ps.length} ortak proje</title></circle><text x="${n.x.toFixed(1)}" y="${(n.y + (n.y < cy ? -9 : 15)).toFixed(1)}" text-anchor="middle">${esc(kisa(n.f.ad))}</text></a>`).join('')}
    </svg></div>
    <p class="iliski-lej">${Object.entries(RENK).map(([t, c]) => `<span style="--c:${c}">${t}</span>`).join('')}</p>
    <ul class="list iliski-l">${komsu.slice(0, 10).map(x => `<li><a href="#/firma/${x.f.id}"><b>${esc(x.f.ad)}</b><small class="muted">${esc((x.f.tipler || []).join(', '))} · ${x.ps.length} ortak proje: ${esc(x.ps.slice(0, 3).map(p => p.ad).join(', '))}${x.ps.length > 3 ? '…' : ''}</small></a></li>`).join('')}</ul>
    <details class="iliski-yol"><summary>Bir firmaya kimin üzerinden ulaşırım?</summary>
      <div class="fld"><label for="il-h">Ulaşmak istediğin firma</label><input id="il-h" list="il-hl" placeholder="Firma adı yaz"><datalist id="il-hl">${S.firmalar.filter(f => f.id !== firma.id && g.has(f.id)).map(f => `<option value="${esc(f.ad)}">`).join('')}</datalist></div>
      <div data-yol></div></details>`;
  const inp = kutu.querySelector('#il-h'), out = kutu.querySelector('[data-yol]');
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.dispatchEvent(new Event('change')); } });
  inp.addEventListener('change', () => {
    const h = S.firmalar.find(f => f.ad.toLocaleLowerCase('tr') === inp.value.trim().toLocaleLowerCase('tr'));
    if (!h) { out.innerHTML = inp.value ? '<p class="hint">Bu adla firma bulunamadı.</p>' : ''; return; }
    const r = yol(g, firma.id, h.id);
    out.innerHTML = !r ? `<p class="hint">${esc(h.ad)} ile ortak projesi olan bir zincir yok. Projelere yatırımcı, Gemüt, Emüt, projeci bilgilerini girdikçe bağlantılar çoğalır.</p>`
      : `<ol class="yol-z">${r.map((x, i) => { const f = byId('firmalar', x.f); return `<li>${i ? `<small class="muted">${esc(x.p.ad)} projesinde ${esc(rol(x.p, r[i - 1].f) || '—')} ↔ ${esc(rol(x.p, x.f) || '—')}</small>` : ''}<a href="#/firma/${x.f}"><b>${esc(f?.ad || '')}</b></a></li>`; }).join('')}</ol>
        <p class="hint">${r.length - 2 <= 0 ? 'Doğrudan bağlantın var.' : `${r.length - 2} firma üzerinden ulaşılıyor. Aradaki firmadaki kişiden tanıştırma isteyebilirsin.`}</p>`;
  });
}
