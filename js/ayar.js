// Cihazlar arasında eşitlenen ayarlar ("ayarlar" tablosu). Tablo yoksa (eski şema) bu cihazda saklanır.
import { S } from './db.js';
import { app } from './state.js';

const LS = 'saha-ayar:';
const satir = k => (S.ayarlar || []).filter(r => r.anahtar === k).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
export function ayar(k, varsayilan = null) {
  const r = satir(k);
  if (r && r.deger !== undefined && r.deger !== null) return r.deger;
  try { const v = localStorage.getItem(LS + k); if (v !== null) return JSON.parse(v); } catch {}
  return varsayilan;
}
export async function ayarYaz(k, deger) {
  try { if (deger === null || deger === undefined) localStorage.removeItem(LS + k); else localStorage.setItem(LS + k, JSON.stringify(deger)); } catch {}
  const r0 = satir(k), ben = app.db?.user?.()?.id;
  const r = r0 && (!r0.owner || !ben || r0.owner === ben) ? r0 : null; // ekip üyesi sahibin ayarını değiştirmez, kendi ayarını yazar
  try { await app.db.save('ayarlar', { ...(r || {}), anahtar: k, deger }); } catch (e) { console.warn('ayar buluta yazılamadı', e); }
}
