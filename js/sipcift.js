// Aynı sipariş numaralı kayıtlar: gruplar, ana sipariş seçimi, birleştir / diğerlerini sil / farklı siparişler.
// Birleştirmede ana sipariş kalır; boş alanları diğerlerinden dolar, diğerlerinin yorumları anaya taşınır, diğerleri silinir.
import { S } from './db.js';
import { app } from './state.js';
import { esc, num, tarih, toast, confirmBox, firmaAd, byId, openDrawer, closeDrawer } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

export const sipNo = v => String(v ?? '').trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
const grupAnahtar = (no, l) => no + ':' + l.map(s => s.id).sort().join(',');
const farkliSet = () => new Set(ayar('sip_farkli', []) || []);
const ALAN = [['tarih', 'Tarih', v => tarih(v)], ['net_deger', 'Net değer', (v, s) => `${num(v)} ${s.para_birimi || ''}`], ['belge_no', 'Satış belgesi'], ['belge_turu', 'Belge türü'],
  ['musteri_adi', 'Cari (SAP)'], ['firma_id', 'Firma', v => firmaAd(v)], ['proje_id', 'Proje', v => byId('projeler', v)?.ad], ['referans', 'SAS notu'], ['teslim_tarihi', 'Teslim', v => tarih(v)], ['rapor_disi', 'Rapor', v => v ? 'rapor dışı' : 'raporda']];
const bos = v => v == null || v === '';

// Ana sipariş önerisi: doğrulanmış, belge numaralı, firmaya ve projeye bağlı, dolu alanı çok olan
export function anaOner(l) {
  const puan = s => (s.dogrulandi ? 8 : 0) + (s.belge_no ? 4 : 0) + (s.proje_id ? 3 : 0) + (s.firma_id ? 3 : 0) + (s.rapor_disi ? 0 : 1) + Object.values(s).filter(v => !bos(v)).length / 100;
  return [...l].sort((a, b) => puan(b) - puan(a))[0];
}
// Kesin aynı: tutar ve para birimi aynı, belge numaraları çelişmiyor (aynı ya da biri boş)
export function kesinAyni(l) {
  const b = new Set(l.map(s => s.belge_no).filter(Boolean));
  return b.size <= 1 && new Set(l.map(s => (+s.net_deger || 0).toFixed(2) + (s.para_birimi || 'USD'))).size === 1;
}
export function farkliAlanlar(l) {
  return ALAN.filter(([k]) => new Set(l.map(s => k === 'net_deger' ? (+s[k] || 0).toFixed(2) : String(s[k] ?? ''))).size > 1).map(a => a[1]);
}
export function siparisCiftGruplari() {
  const g = new Map(), farkli = farkliSet();
  for (const s of S.siparisler || []) { const no = sipNo(s.siparis_no); if (no) (g.get(no) || g.set(no, []).get(no)).push(s); }
  return [...g.entries()].filter(([no, l]) => l.length > 1 && !farkli.has(grupAnahtar(no, l)))
    .map(([no, l]) => ({ no, l: l.sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '')), ad: 'Sipariş ' + no, kesin: kesinAyni(l), farklar: farkliAlanlar(l) }))
    .sort((a, b) => b.kesin - a.kesin || (b.l[0].tarih || '').localeCompare(a.l[0].tarih || ''));
}

export async function siparisBirlestir(anaId, digerIds) {
  const ana = { ...byId('siparisler', anaId) }, digerler = digerIds.map(i => byId('siparisler', i)).filter(Boolean);
  for (const d of digerler) for (const [k, v] of Object.entries(d)) if (!['id', 'rapor_disi', 'dogrulandi', 'created_at', 'updated_at'].includes(k) && bos(ana[k]) && !bos(v)) ana[k] = v;
  const notlar = digerler.map(d => d.siparis_notu).filter(n => n && n !== ana.siparis_notu);
  if (notlar.length) ana.siparis_notu = [ana.siparis_notu, ...notlar].filter(Boolean).join('\n');
  ana.dogrulandi = true;
  await app.db.save('siparisler', ana);
  const y = (S.yorumlar || []).filter(r => r.tablo === 'siparisler' && digerIds.includes(r.kayit_id));
  if (y.length) await app.db.bulk('yorumlar', y.map(r => ({ ...r, kayit_id: anaId })));
  for (const d of digerler) await app.db.del('siparisler', d.id);
  return digerler.length;
}
export async function farkliSiparisler(no, l) {
  const s = ayar('sip_farkli', []) || []; s.push(grupAnahtar(sipNo(no), l)); await ayarYaz('sip_farkli', [...new Set(s)]);
  const g = l.map(x => byId('siparisler', x.id)).filter(x => x && !x.dogrulandi);
  if (g.length) await app.db.bulk('siparisler', g.map(x => ({ ...x, dogrulandi: true })));
}
// Kesin aynı olan bütün grupları birleştirir (ana: önerilen)
export async function kesinleriBirlestir() {
  let n = 0, g = 0;
  for (const x of siparisCiftGruplari().filter(x => x.kesin)) { const a = anaOner(x.l); n += await siparisBirlestir(a.id, x.l.filter(s => s.id !== a.id).map(s => s.id)); g++; }
  return { n, g };
}

// İnceleme ekranı: grubun siparişleri yan yana, ana sipariş seçilir
export function siparisCiftIncele(no, sonra) {
  const x = siparisCiftGruplari().find(g => g.no === sipNo(no)); if (!x) return toast('Bu sipariş numarasında birden fazla kayıt kalmadı.');
  let ana = anaOner(x.l).id;
  const goster = (k, f, s) => { const v = s[k]; return esc(f ? (f(v, s) ?? '') : (v ?? '')) || '<span class="muted">—</span>'; };
  const panel = openDrawer(`<header class="dh"><div><p class="muted">Aynı sipariş numarası · ${x.l.length} kayıt</p><h2 id="drawer-title">Sipariş ${esc(x.no)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody">
      <p class="hint">${x.kesin ? 'Tutarları aynı ve satış belgeleri çelişmiyor: büyük ihtimalle aynı sipariş iki kez kaydedilmiş.' : '<b>Dikkat:</b> tutar ya da satış belgesi farklı. Aynı müşteri sipariş numarasıyla SAP\'de birden fazla satış belgesi açılmış olabilir; o zaman hepsi gerçektir, “Farklı siparişler” de.'}
      Ana siparişi seç: birleştirince ana kalır, boş alanları diğerlerinden dolar, diğerleri silinir.</p>
      <div class="tbl-wrap"><table class="ptable sipcift"><thead><tr><th>Ana</th>${ALAN.map(a => `<th>${a[1]}</th>`).join('')}</tr></thead><tbody>
      ${x.l.map(s => `<tr data-sid="${s.id}"><td><label class="radio"><input type="radio" name="ana" value="${s.id}" ${s.id === ana ? 'checked' : ''} aria-label="Ana sipariş"></label></td>${ALAN.map(([k, l, f]) => `<td data-l="${l}" class="${x.farklar.includes(l) ? 'fark' : ''}">${goster(k, f, s)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      ${x.farklar.length ? `<p class="hint">Farklı alanlar: <b>${esc(x.farklar.join(', '))}</b></p>` : '<p class="hint">Bütün alanlar aynı.</p>'}
    </div>
    <div class="dfoot sticky"><button type="button" class="btn ghost" data-farkli>Farklı siparişler</button><button type="button" class="btn ghost" data-disi>Diğerlerini rapor dışı yap</button><button type="button" class="btn primary" data-birlestir>Birleştir, diğerlerini sil</button></div>`, { wide: true });
  panel.querySelectorAll('input[name=ana]').forEach(r => r.onchange = () => { ana = r.value; });
  const diger = () => x.l.filter(s => s.id !== ana);
  panel.querySelector('[data-birlestir]').onclick = async e => {
    const d = diger();
    if (!confirmBox(`Sipariş ${x.no}: ana kayıt kalacak, ${d.length} kayıt silinecek:\n${d.map(s => `• ${tarih(s.tarih)} · ${num(s.net_deger)} ${s.para_birimi || ''}${s.belge_no ? ' · belge ' + s.belge_no : ''}`).join('\n')}\n\nSilinen kayıtlar geri gelmez. Devam edilsin mi?`)) return;
    e.target.disabled = true;
    try { const n = await siparisBirlestir(ana, d.map(s => s.id)); toast(`${n} kopya silindi, sipariş ${x.no} tek kayıt ve doğrulandı.`); closeDrawer(); app.refresh?.(); sonra?.(); } catch (er) { e.target.disabled = false; toast('Birleştirilemedi: ' + er.message, 'err'); }
  };
  panel.querySelector('[data-disi]').onclick = async () => {
    await app.db.bulk('siparisler', [...diger().map(s => ({ ...s, rapor_disi: true })), { ...byId('siparisler', ana), dogrulandi: true }]);
    await farkliSiparisler(x.no, x.l);
    toast('Diğerleri rapor dışı bırakıldı; kayıtlar silinmedi.'); closeDrawer(); app.refresh?.(); sonra?.();
  };
  panel.querySelector('[data-farkli]').onclick = async () => { await farkliSiparisler(x.no, x.l); toast('Hepsi ayrı sipariş olarak doğrulandı; bir daha gösterilmeyecek.'); closeDrawer(); app.refresh?.(); sonra?.(); };
}
