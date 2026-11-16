// Ziyarette giriş-çıkış: firmaya varınca "Giriş yap" (saat ve konum, firmaya uzaklık), ayrılırken "Çıkış yap" (süre).
// Giriş yapılmış ama çıkılmamış ziyaret her ekranda üstte bir bantla görünür. Bugün için planlı ziyaret varsa o kayıt kullanılır.
import { ozellikSay } from './saglik.js';
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, confirmBox, today, byId, firmaAd, myLocation } from './ui.js';
import { km } from './geo.js';
import { konumKurali, kvkkSor } from './konum.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const saatStr = d => new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const sureDk = z => z?.giris && z?.cikis ? Math.max(0, Math.round((new Date(z.cikis) - new Date(z.giris)) / 6e4)) : null;
export const sureYaz = dk => dk == null ? '' : dk < 60 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60 ? dk % 60 + ' dk' : ''}`.trim();
export const mesafeYaz = m => m == null ? '' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;

// Şu an içeride olduğum ziyaret (en son giriş yapılan, çıkılmamış)
export const aktifZiyaret = () => (S.ziyaretler || []).filter(z => z.giris && !z.cikis && (!z.sorumlu || z.sorumlu.toLowerCase() === ben() || !ben()))
  .sort((a, b) => String(b.giris).localeCompare(String(a.giris)))[0] || null;

const konumAl = async () => { if (!(await kvkkSor())) { toast('Konum paylaşımını onaylamadın; kayıt konumsuz tutulur.'); return null; } try { return await myLocation(); } catch (e) { toast(e.message + ' Giriş konumsuz kaydedilir.', 'err'); return null; } };

export async function girisYap({ firma_id, proje_id = null, kisi_id = null } = {}) {
  ozellikSay('giris');
  const a = aktifZiyaret();
  if (a) {
    if (a.firma_id === firma_id) return toast(`${firmaAd(firma_id)} için zaten giriş yaptın (${saatStr(a.giris)}).`);
    if (!confirmBox(`${firmaAd(a.firma_id) || 'Önceki ziyaret'} için çıkış yapmadın. Önce oradan çıkış yapılsın mı?`)) return;
    await cikisYap(a, { formAc: false });
  }
  const f = byId('firmalar', firma_id), konum = await konumAl(), simdi = new Date();
  const mesafe = konum && f?.lat != null ? Math.round(km(konum, [f.lat, f.lng]) * 1000) : null;
  const kural = konumKurali();
  if (kural.mod !== 'kapali' && mesafe != null && mesafe > kural.mesafe) {
    if (kural.mod === 'engelle') return toast(`Firmanın kayıtlı konumuna ${mesafeYaz(mesafe)} uzaktasın; şirket kuralı gereği en fazla ${mesafeYaz(kural.mesafe)} uzaktan giriş yapılabilir.`, 'err');
    if (!confirmBox(`Firmanın kayıtlı konumuna ${mesafeYaz(mesafe)} uzaktasın. Yine de giriş yapılsın mı? (Yöneticiye uyarı olarak görünür.)`)) return;
  }
  // Bugün bu firmaya planlı ziyaret varsa onu kullan
  const plan = (S.ziyaretler || []).find(z => z.firma_id === firma_id && z.durum === 'Planlandı' && z.tarih === today() && !z.giris);
  const z = { ...(plan || { fotolar: [] }), firma_id, proje_id: plan?.proje_id || proje_id, kisi_id: plan?.kisi_id || kisi_id, tarih: today(), saat: saatStr(simdi), durum: 'Yapıldı',
    giris: simdi.toISOString(), giris_mesafe: mesafe, ...(konum ? { lat: konum[0], lng: konum[1] } : {}) };
  try {
    await app.db.save('ziyaretler', z);
    toast(`Giriş: ${f?.ad || 'Ziyaret'} · ${saatStr(simdi)}${mesafe != null ? ' · firmaya ' + mesafeYaz(mesafe) : ''}`);
    girisBandi(); app.refresh?.();
  } catch (e) { toast('Giriş kaydedilemedi: ' + e.message, 'err'); }
}

export async function cikisYap(z, { formAc = true } = {}) {
  ozellikSay('cikis');
  z = byId('ziyaretler', z?.id) || z; if (!z) return;
  const konum = await konumAl(), simdi = new Date();
  const o = { ...z, cikis: simdi.toISOString(), ...(konum ? { cikis_lat: konum[0], cikis_lng: konum[1] } : {}) };
  try {
    await app.db.save('ziyaretler', o);
    toast(`Çıkış: ${firmaAd(z.firma_id) || 'Ziyaret'} · ${sureYaz(sureDk(o))}`);
    girisBandi();
    if (formAc) { const { ziyaretForm } = await import('./views/ziyaret.js'); ziyaretForm({ id: z.id }); setTimeout(() => document.querySelector('.drawer.open [name=sonuc_tipi], .drawer.open [name=notlar]')?.focus(), 350); }
    else app.refresh?.();
  } catch (e) { toast('Çıkış kaydedilemedi: ' + e.message, 'err'); }
}

// Üst bant: içerideyken her ekranda
let sayac = null;
export function girisBandi() {
  let b = document.getElementById('giris-bandi');
  const a = aktifZiyaret();
  clearInterval(sayac);
  if (!a) { b?.remove(); document.body.classList.remove('giris-var'); return; }
  if (!b) { b = document.createElement('div'); b.id = 'giris-bandi'; b.className = 'giris-bandi'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
  document.body.classList.add('giris-var');
  const yaz = () => { const dk = Math.max(0, Math.round((Date.now() - new Date(a.giris)) / 6e4));
    b.innerHTML = `<span class="gb-nokta" aria-hidden="true"></span><a href="#/firma/${esc(a.firma_id || '')}" class="gb-ad"><b>${esc(firmaAd(a.firma_id) || 'Ziyaret')}</b><small>giriş ${saatStr(a.giris)} · ${sureYaz(dk) || '0 dk'}</small></a><button type="button" class="btn sm" data-gbcikis>Çıkış yap</button>`;
    b.querySelector('[data-gbcikis]').onclick = () => cikisYap(a); };
  yaz(); sayac = setInterval(yaz, 60000);
}

// Ziyaret kartında (form ve listeler) giriş-çıkış özeti
export function girisOzeti(z) {
  if (!z?.giris) return '';
  return `${saatStr(z.giris)}${z.cikis ? '–' + saatStr(z.cikis) + ' · ' + sureYaz(sureDk(z)) : ' · içeride'}${z.giris_mesafe != null ? ' · firmaya ' + mesafeYaz(z.giris_mesafe) : ''}`;
}
