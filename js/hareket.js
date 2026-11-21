// Kullanıcı hareketleri: giriş / çıkış, uygulamanın açık ve etkin olduğu süre, gezilen ekranlar, çıktılar (Excel, PDF, indirme, yazdırma),
// paylaşım ve iletişim (WhatsApp, e-posta, arama), içe aktarma, okutma (tabela, kartvizit, etiket). Ekleme / değişiklik / silme
// sunucudaki değişiklik geçmişine (degisiklikler) zaten yazılır; burada yazılmaz.
// Olaylar kuyrukta birikir, 20 sn'de bir ya da uygulama arka plana geçince toplu gönderilir; gönderilemeyenler cihazda bekler.
// Kaydedilmeyenler: arama metinleri, şifreler, sürekli konum.
import { app, SURUM } from './state.js';
import { S } from './db.js';

const K = 'saha-hareket-kuyruk', OTURUM = (() => { try { let o = sessionStorage.getItem('saha-oturum'); if (!o) { o = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('saha-oturum', o); } return o; } catch { return Math.random().toString(36).slice(2, 10); } })();
let kuyruk = [], zaman = null, basladi = false, sonEkran = '', sonEkranT = 0, etkinBas = null, gonderiliyor = false;
const yaz = () => { try { localStorage.setItem(K, JSON.stringify(kuyruk.slice(-500))); } catch {} };
const oku = () => { try { return JSON.parse(localStorage.getItem(K) || '[]'); } catch { return []; } };
export const cihaz = () => { const u = navigator.userAgent; const tur = /iPad|Tablet/i.test(u) ? 'Tablet' : /Mobi|Android|iPhone/i.test(u) ? 'Telefon' : 'Bilgisayar';
  const isl = /Android/i.test(u) ? 'Android' : /iPhone|iPad|iOS/i.test(u) ? 'iOS' : /Windows/i.test(u) ? 'Windows' : /Mac OS/i.test(u) ? 'macOS' : /Linux/i.test(u) ? 'Linux' : '';
  const tar = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '';
  const pwa = matchMedia?.('(display-mode: standalone)')?.matches ? ' · uygulama' : '';
  return [tur, isl, tar].filter(Boolean).join(' · ') + pwa; };
const kayitli = () => app.db?.mode === 'supabase' && app.db.user?.() && !app.db.bakilan && app.db.sahip;

// Olay kaydı: tur + { ekran, tablo, kayit_id, ozet, ayrinti }
export function iz(tur, o = {}) {
  try {
    if (!app.db || app.db.bakilan) return;
    kuyruk.push({ tur, zaman: new Date().toISOString(), ekran: o.ekran ?? ekranAdi(), tablo: o.tablo || null, kayit_id: o.kayit_id != null ? String(o.kayit_id) : null, ozet: o.ozet ? String(o.ozet).slice(0, 300) : null, ayrinti: o.ayrinti || null, oturum: OTURUM, surum: SURUM, cihaz: cihaz() });
    window.__hareketler?.push(kuyruk[kuyruk.length - 1]);   // testler için
    yaz(); planla();
  } catch {}
}
const planla = (ms = 20000) => { if (!zaman) zaman = setTimeout(() => { zaman = null; gonder(); }, ms); };
export async function gonder() {
  if (gonderiliyor || !kuyruk.length || !kayitli()) return;
  gonderiliyor = true;
  const parti = kuyruk.slice(0, 200), owner = app.db.sahip;
  try {
    const u = app.db.user();   // kişi sunucuda da kesinleşir (başkası adına yazılamaz)
    const { error } = await app.db.c.from('kullanici_hareketleri').insert(parti.map(x => ({ ...x, owner, kim_id: u?.id, kim: (u?.email || '').toLowerCase() })));
    if (error) throw error;
    kuyruk = kuyruk.slice(parti.length); yaz();
    if (kuyruk.length) planla(1000);
  } catch (e) {
    // Tablo yoksa (sunucu eski) kuyruğu büyütme; ağ hatasında sonra yeniden dene
    if (/kullanici_hareketleri|schema cache|does not exist/i.test(e?.message || '')) { kuyruk = []; yaz(); }
    else planla(60000);
  } finally { gonderiliyor = false; }
}

// Ekran adı: "#/proje/123/teklif" → "proje/:id/teklif"
export function ekranAdi(h = location.hash) {
  const p = (h.replace(/^#\/?/, '') || 'bugun').split('?')[0].split('/');
  return p.map((x, i) => i > 0 && /^[0-9a-f-]{8,}$|^\d+$/i.test(x) ? ':id' : x).join('/');
}
export function ekran() {
  const e = ekranAdi(), t = Date.now();
  if (e === sonEkran && t - sonEkranT < 30000) return;
  sonEkran = e; sonEkranT = t;
  const p = location.hash.replace(/^#\/?/, '').split('/'), id = p.find((x, i) => i > 0 && /^[0-9a-f-]{8,}$/i.test(x));
  const tablo = { proje: 'projeler', firma: 'firmalar', kisi: 'kisiler', teklif: 'teklifler', siparis: 'siparisler' }[p[0]] || null;
  let ozet = null; try { ozet = id && tablo ? (S[tablo] || []).find(x => x.id === id)?.ad || null : null; } catch {}
  iz('ekran', { ekran: e, tablo: id ? tablo : null, kayit_id: id || null, ozet: ozet || document.querySelector('#view h1')?.textContent?.trim()?.slice(0, 120) || null });
}

// Etkin süre: uygulama görünürken geçen süre; arka plana geçince ya da kapanınca "aktif" olayı (sn) yazılır
function etkinBitir(neden) {
  if (!etkinBas) return; const sn = Math.round((Date.now() - etkinBas) / 1000); etkinBas = null;
  if (sn >= 5) iz('aktif', { ozet: neden, ayrinti: { sn } });
}
function etkinBasla() { if (!etkinBas) etkinBas = Date.now(); }

// Uygulama açılınca (oturum açık): giriş ya da oturum; dinleyiciler bir kez kurulur
export function basla() {
  if (basladi || !app.db || app.db.mode !== 'supabase') return; basladi = true;
  kuyruk = [...oku(), ...kuyruk];
  let giris = false; try { giris = sessionStorage.getItem('saha-giris-yeni') === '1'; sessionStorage.removeItem('saha-giris-yeni'); } catch {}
  iz(giris ? 'giris' : 'oturum', { ozet: giris ? 'Giriş yapıldı' : 'Uygulama açıldı', ayrinti: { ekran: `${screen.width}×${screen.height}`, dil: navigator.language } });
  etkinBasla(); setTimeout(ekran, 900); planla(3000); setTimeout(bilgilendir, 1500);
  addEventListener('hashchange', () => setTimeout(ekran, 900));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { etkinBitir('arka plana geçti'); gonder(); } else { etkinBasla(); planla(3000); } });
  addEventListener('pagehide', () => { etkinBitir('kapandı'); yaz(); gonder(); });
  // Yazdırma (teklif, rapor, etiket…)
  addEventListener('beforeprint', () => iz('yazdirma', { ozet: document.title || ekranAdi() }));
  // İletişim bağlantıları: WhatsApp, e-posta, arama, harita yol tarifi
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[href]'); if (!a) return; const h = a.getAttribute('href') || '';
    const tur = /^(https?:\/\/)?(wa\.me|api\.whatsapp|web\.whatsapp)/i.test(h) ? 'WhatsApp' : /^mailto:/i.test(h) ? 'E-posta' : /^tel:/i.test(h) ? 'Arama' : /^sms:/i.test(h) ? 'SMS' : /google\.[a-z.]+\/maps|maps\.apple|yandex\.[a-z.]+\/maps/i.test(h) ? 'Yol tarifi' : '';
    if (tur) iz('iletisim', { ozet: `${tur}: ${(a.textContent || '').trim().slice(0, 60) || h.replace(/^(mailto:|tel:|sms:)/, '').slice(0, 60)}`, ayrinti: { tur } });
  }, true);
  // Sistem paylaşımı
  if (navigator.share && !navigator.share.__iz) { const orj = navigator.share.bind(navigator); const s = d => { iz('paylasim', { ozet: d?.title || d?.text?.slice(0, 80) || d?.url || 'Paylaşım', ayrinti: { dosya: (d?.files || []).map(f => f.name) } }); return orj(d); }; s.__iz = true; try { navigator.share = s; } catch {} }
  // Çıkış: önce bekleyenler gönderilir
  const auth = app.db.c?.auth;
  if (auth?.signOut && !auth.signOut.__iz) { const orj = auth.signOut.bind(auth); const s = async (...a) => { etkinBitir('çıkış'); iz('cikis', { ozet: a[0]?.scope === 'global' ? 'Bütün cihazlardan çıkış' : 'Çıkış yapıldı' }); try { await gonder(); } catch {} return orj(...a); }; s.__iz = true; auth.signOut = s; }
}
// Bilgilendirme (KVKK): ekip üyesine bir kez gösterilir; okunduğu hareket olarak kaydedilir
function bilgilendir() {
  try {
    const u = app.db.user(), y = app.yetki || app.db.yetki; if (!u || y?.ben_sahip !== false) return;
    const k = 'saha-hareket-bilgi-' + u.id; if (localStorage.getItem(k)) return;
    const d = document.createElement('div'); d.className = 'hk-bilgi'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Hareket kaydı bilgilendirmesi');
    d.innerHTML = '<p><b>Bilgilendirme:</b> Uygulamadaki işlemlerin (giriş ve çıkış, uygulamanın açık olduğu süre, gezilen ekranlar, alınan çıktılar, eklenen, değiştirilen ve silinen kayıtlar) şirket yöneticin tarafından görülebilecek şekilde kaydedilir ve 12 ay saklanır. Arama metinleri, şifreler ve sürekli konum kaydedilmez. Kendi kaydını Profilim → Hareketlerim\'de görebilirsin.</p><button type="button" class="btn sm primary">Anladım</button>';
    d.querySelector('button').onclick = () => { try { localStorage.setItem(k, new Date().toISOString()); } catch {} iz('islem', { ozet: 'Hareket kaydı bilgilendirmesi okundu' }); d.remove(); };
    document.body.append(d);
  } catch {}
}
// Giriş ekranında başarılı girişten sonra çağrılır (açılış "giriş" olarak yazılsın)
export function girisYapildi() { try { sessionStorage.setItem('saha-giris-yeni', '1'); } catch {} }
