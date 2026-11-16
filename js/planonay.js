// Plan onayı: ekip üyesi haftalık planını onaya gönderir; şirket yetkilisi onaylar ya da düzeltme ister.
// Şirket profilinde "Haftalık planlar onayımdan geçsin" açıksa Hafta planı'nda düğme görünür; bekleyenler Onay kuyruğuna düşer.
import { S } from './db.js';
import { app } from './state.js';
import { esc, tarih, today, gunEkle, firmaAd, toast, openDrawer, closeDrawer } from './ui.js';
import { ayar } from './ayar.js';
import { onayTuru } from './onay.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
export const planOnayAcik = () => ayar('plan_onay') === true;
export const planKaydi = (kim, hafta) => (S.plan_onaylari || []).filter(x => (x.kim || '').toLowerCase() === kim && x.hafta === hafta).sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0] || null;
export const planZiyaretleri = (kim, hafta) => (S.ziyaretler || []).filter(z => z.tarih >= hafta && z.tarih <= gunEkle(hafta, 6) && (z.planli || z.durum === 'Planlandı') && ((z.sorumlu || ben()).toLowerCase() === kim)).sort((a, b) => a.tarih.localeCompare(b.tarih));
const kisaAd = e => (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === e)?.ad || String(e || '').split('@')[0];

onayTuru({ k: 'plan', ad: 'Hafta planı', rota: 'plan', tablo: 'plan_onaylari',
  liste: () => (S.plan_onaylari || []).filter(x => x.durum === 'Gönderildi').map(x => ({ id: x.id, baslik: `${kisaAd(x.kim)} · ${tarih(x.hafta)} haftası · ${x.adet || planZiyaretleri((x.kim || '').toLowerCase(), x.hafta).length} ziyaret`, kim: x.kim, tarih: x.hafta, kayit: x, ac: () => planOnayPenceresi(x) })) });

export function planDurumHtml(hafta) {
  if (!planOnayAcik()) return '';
  const r = planKaydi(ben(), hafta);
  if (!r) return `<span class="po-d">Plan onaya gönderilmedi</span>`;
  return `<span class="po-d po-${r.durum === 'Onaylandı' ? 'ok' : r.durum === 'Düzeltme istendi' ? 'neg' : 'bek'}">${esc(r.durum)}${r.onaylayan && r.durum !== 'Gönderildi' ? ' · ' + esc(kisaAd(r.onaylayan)) : ''}${r.yanit ? ': ' + esc(r.yanit) : ''}</span>`;
}
export async function planGonder(hafta) {
  const z = planZiyaretleri(ben(), hafta);
  if (!z.length) return toast('Bu hafta planlı ziyaret yok.', 'err');
  const eski = planKaydi(ben(), hafta);
  await app.db.save('plan_onaylari', { ...(eski || {}), kim: ben(), hafta, durum: 'Gönderildi', adet: z.length, yanit: null, onaylayan: null, onay_tarih: null });
  toast(`Plan onaya gönderildi (${z.length} ziyaret).`);
}
export function planOnayPenceresi(r) {
  const kim = (r.kim || '').toLowerCase(), z = planZiyaretleri(kim, r.hafta);
  const p = openDrawer(`<header class="dh"><div><p class="muted">Plan onayı · ${esc(kisaAd(kim))}</p><h2 id="drawer-title">${tarih(r.hafta)} haftası</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><ul class="list">${z.map(x => `<li><span class="grow"><b>${esc(firmaAd(x.firma_id) || 'Ziyaret')}</b><small class="muted"> ${new Date(x.tarih + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' })}${x.amac ? ' · ' + esc(x.amac) : ''}</small></span></li>`).join('') || '<li>Planlı ziyaret yok</li>'}</ul>
    <div class="fld"><label for="po-y">Not (düzeltme isteğinde gerekli)</label><textarea id="po-y" rows="3" placeholder="Örn. Salı Mersin yerine Adana'ya git"></textarea></div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-po="Düzeltme istendi">Düzeltme iste</button><button type="button" class="btn primary" data-po="Onaylandı">Onayla</button></div></div>`);
  p.querySelectorAll('[data-po]').forEach(b => b.onclick = async () => {
    const yanit = p.querySelector('#po-y').value.trim() || null;
    if (b.dataset.po === 'Düzeltme istendi' && !yanit) return toast('Neyin düzeltilmesini istediğini yaz.', 'err');
    await app.db.save('plan_onaylari', { ...r, durum: b.dataset.po, yanit, onaylayan: ben(), onay_tarih: today() });
    toast(`Plan: ${b.dataset.po}.`); closeDrawer(); app.refresh?.();
  });
}
