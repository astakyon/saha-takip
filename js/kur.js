// Döviz kuru: günde bir kez çekilir (TCMB fonksiyonu kuruluysa TCMB döviz satış, yoksa Avrupa Merkez Bankası referans kuru); elle de girilebilir.
import { getConfig } from './db.js';
import { app } from './state.js';
import { ayar, ayarYaz } from './ayar.js';
import { today } from './ui.js';

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
export const kurYazi = (k = kur()) => k ? `1 $ = ${k.USD.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺${k.EUR ? ` · 1 € = ${k.EUR.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺` : ''}` : '';

async function tcmb() {
  const c = getConfig(); if (c?.mode !== 'supabase' || !c.url) return null;
  const r = await fetch(`${c.url}/functions/v1/tcmb-kur`, { headers: { apikey: c.key, Authorization: 'Bearer ' + (app.db.session?.access_token || c.key) } });
  if (!r.ok) return null; const j = await r.json(); return j.USD ? { USD: +j.USD, EUR: +j.EUR || null, tarih: j.tarih || today(), kaynak: 'TCMB döviz satış' } : null;
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
  if (!zorla && k && k.alindi === today()) return k;
  if (!navigator.onLine) return k;
  let y = null;
  try { y = await tcmb(); } catch {}
  if (!y) y = await ecb();
  if (!y) return k;
  y.alindi = today(); yaz(y);
  window.dispatchEvent(new CustomEvent('kur', { detail: y }));
  return y;
}
export async function kurElle(USD, EUR) { await ayarYaz('kur_elle', USD ? { USD: +USD, EUR: EUR ? +EUR : null, tarih: today() } : null); }

// Ayarlar kartı
export function kurAyarlari(root) {
  const ciz = () => {
    const k = kur();
    root.innerHTML = `<p>${k ? `<b>${kurYazi(k)}</b> <span class="muted">· ${k.kaynak || ''}${k.tarih ? ' · ' + k.tarih.split('-').reverse().join('.') : ''}</span>` : 'Kur henüz alınmadı.'}</p>
      <div class="btnrow"><button type="button" class="btn" data-yenile>Kuru şimdi güncelle</button></div>
      <details><summary>Kuru elle gir (bugün için)</summary><div class="grid"><div class="fld"><label for="k-usd">1 USD (TL)</label><input id="k-usd" type="number" step="0.0001" inputmode="decimal" value="${k?.USD || ''}"></div><div class="fld"><label for="k-eur">1 EUR (TL)</label><input id="k-eur" type="number" step="0.0001" inputmode="decimal" value="${k?.EUR || ''}"></div></div>
        <div class="btnrow"><button type="button" class="btn primary" data-elle>Kaydet</button><button type="button" class="btn ghost" data-sil>Otomatik kura dön</button></div></details>
      <p class="hint">Teklif toplamlarında TL karşılığı, tasarruf hesabında dolar dönüşümü ve Bugün ekranında kullanılır. Kesin TCMB kuru için Supabase'e <code>tcmb-kur</code> fonksiyonunu ekleyebilirsin (README'de anlatıldı); eklenmezse Avrupa Merkez Bankası referans kuru kullanılır, TCMB kurundan biraz farklı olabilir.</p>`;
    root.querySelector('[data-yenile]').onclick = async () => { const y = await kurGuncelle(true); const { toast } = await import('./ui.js'); toast(y ? 'Kur güncellendi: ' + kurYazi(y) : 'Kur alınamadı; internet bağlantını kontrol et.', y ? '' : 'err'); ciz(); };
    root.querySelector('[data-elle]').onclick = async () => { await kurElle(root.querySelector('#k-usd').value, root.querySelector('#k-eur').value); ciz(); };
    root.querySelector('[data-sil]').onclick = async () => { await kurElle(null); ciz(); };
  };
  ciz();
}
