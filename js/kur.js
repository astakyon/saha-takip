// Döviz kuru: günde bir kez çekilir (TCMB fonksiyonu kuruluysa TCMB döviz satış, yoksa Avrupa Merkez Bankası referans kuru); elle de girilebilir.
import { getConfig } from './db.js';
import { app } from './state.js';
import { ayar, ayarYaz } from './ayar.js';
import { today, esc } from './ui.js';

const LS = 'saha-kur';
const oku = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const yaz = k => { try { localStorage.setItem(LS, JSON.stringify(k)); } catch {} };

// Geçerli kur: elle girilen (bugün için) > son çekilen
export function kur() {
  const e = ayar('kur_elle');
  if (e && e.USD && e.tarih === today()) return { ...e, kaynak: 'elle' };
  return oku() || (e?.USD ? { ...e, kaynak: 'elle (' + e.tarih + ')' } : null);
}
export const tl = (v, pb = 'USD') => { const k = kur(); if (!k || v == null) return null; if (pb === 'TRY' || pb === 'TL') return +v; const o = k[pb]; return o ? +v * o : null; };
const k4 = v => (+v).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
export const kurYazi = (k = kur()) => k ? `USD ${k4(k.USD)} ₺${k.EUR ? ` · EUR ${k4(k.EUR)} ₺` : ''}${/TCMB/.test(k.kaynak || '') ? ' (TCMB)' : ''}` : '';

// TCMB döviz satış kuru: önce Supabase veritabanındaki tcmb_kur() fonksiyonu (schema.sql ile gelir), sonra isteğe bağlı tcmb-kur fonksiyonu
async function tcmb() {
  const c = getConfig(); if (c?.mode !== 'supabase' || !c.url) return null;
  try {
    const { data } = await app.db.c.rpc('tcmb_kur');
    if (data?.USD) return { USD: +data.USD, EUR: +data.EUR || null, USD_alis: +data.USD_alis || null, EUR_alis: +data.EUR_alis || null, tarih: data.tarih || today(), kaynak: 'TCMB döviz satış' };
  } catch {}
  try {
    const r = await fetch(`${c.url}/functions/v1/tcmb-kur`, { headers: { apikey: c.key, Authorization: 'Bearer ' + (app.db.session?.access_token || c.key) } });
    if (!r.ok) return null; const j = await r.json(); return j.USD ? { USD: +j.USD, EUR: +j.EUR || null, tarih: j.tarih || today(), kaynak: 'TCMB döviz satış' } : null;
  } catch { return null; }
}
async function ecb() {
  for (const u of ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR', 'https://api.frankfurter.app/latest?from=USD&to=TRY,EUR']) {
    try {
      const r = await fetch(u); if (!r.ok) continue; const j = await r.json();
      const t = j.rates?.TRY, e = j.rates?.EUR; if (!t) continue;
      return { USD: +t.toFixed(4), EUR: e ? +(t / e).toFixed(4) : null, tarih: j.date || today(), kaynak: 'ECB referans' };
    } catch {}
  }
  return null;
}
// Gerekirse kuru yeniler (günde bir kez); zorla = true her durumda dener
export async function kurGuncelle(zorla = false) {
  const k = oku();
  if (!zorla && k && k.alindi === today() && /TCMB/.test(k.kaynak || '') && Date.now() - (k.zaman || 0) < 3 * 3600e3) return k;
  if (!zorla && k && k.alindi === today() && !/TCMB/.test(k.kaynak || '') && Date.now() - (k.zaman || 0) < 3600e3) return k;
  if (!navigator.onLine) return k;
  let y = null;
  try { y = await tcmb(); } catch {}
  if (!y) y = await ecb();
  if (!y) return k;
  y.alindi = today(); y.zaman = Date.now(); yaz(y);
  window.dispatchEvent(new CustomEvent('kur', { detail: y }));
  return y;
}
export async function kurElle(USD, EUR) { await ayarYaz('kur_elle', USD ? { USD: +USD, EUR: EUR ? +EUR : null, tarih: today() } : null); }

// Ayarlar kartı
export function kurAyarlari(root) {
  const ciz = () => {
    const k = kur();
    root.innerHTML = `${k ? `<table class="tbl kur-tbl"><thead><tr><th></th><th class="r">Alış</th><th class="r">Satış</th></tr></thead><tbody>
        <tr><td><b>USD</b></td><td class="r num">${k.USD_alis ? k4(k.USD_alis) : '—'}</td><td class="r num"><b>${k4(k.USD)}</b></td></tr>
        ${k.EUR ? `<tr><td><b>EUR</b></td><td class="r num">${k.EUR_alis ? k4(k.EUR_alis) : '—'}</td><td class="r num"><b>${k4(k.EUR)}</b></td></tr>` : ''}</tbody></table>
        <p class="muted">${esc(k.kaynak || '')}${k.tarih ? ' · ' + k.tarih.split('-').reverse().join('.') : ''}</p>` : '<p>Kur henüz alınmadı.</p>'}
      <div class="btnrow"><button type="button" class="btn" data-yenile>Kuru şimdi güncelle</button></div>
      <details><summary>Kuru elle gir (bugün için)</summary><div class="grid"><div class="fld"><label for="k-usd">1 USD (TL)</label><input id="k-usd" type="number" step="0.0001" inputmode="decimal" value="${k?.USD || ''}"></div><div class="fld"><label for="k-eur">1 EUR (TL)</label><input id="k-eur" type="number" step="0.0001" inputmode="decimal" value="${k?.EUR || ''}"></div></div>
        <div class="btnrow"><button type="button" class="btn primary" data-elle>Kaydet</button><button type="button" class="btn ghost" data-sil>Otomatik kura dön</button></div></details>
      <p class="hint">TCMB döviz kuru, schema.sql çalıştırıldıktan sonra Supabase üzerinden saatlik alınır. Deneme modunda ya da TCMB'ye ulaşılamazsa Avrupa Merkez Bankası kuru kullanılır. Teklif toplamlarında, tasarruf hesabında ve Bugün ekranında görünür.</p>`;
    root.querySelector('[data-yenile]').onclick = async () => { const y = await kurGuncelle(true); const { toast } = await import('./ui.js'); toast(y ? 'Kur güncellendi: ' + kurYazi(y) : 'Kur alınamadı; internet bağlantını kontrol et.', y ? '' : 'err'); ciz(); };
    root.querySelector('[data-elle]').onclick = async () => { await kurElle(root.querySelector('#k-usd').value, root.querySelector('#k-eur').value); ciz(); };
    root.querySelector('[data-sil]').onclick = async () => { await kurElle(null); ciz(); };
  };
  ciz();
}
