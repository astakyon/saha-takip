// Teklif onay bağlantısı: müşteri teklifi telefonundan açar, "Onaylıyorum" ya da "Revize istiyorum" der.
// Bağlantı oluşturulurken teklifin müşteriye gösterilecek hali (PDF ile aynı) donmuş kopya olarak saklanır;
// müşteri yalnızca bu kopyayı görür, maliyet ve iç kayıtlar hiç gitmez. Yanıt gelince teklif Kabul olur ve sana görev düşer.
import { ozellikSay } from './saglik.js';
import { app } from './state.js';
import { esc, tarih, today, gunEkle, byId, firmaAd, toast, openDrawer, confirmBox, waLink } from './ui.js';
import { getConfig } from './db.js';
import { benimAdim } from './sablon.js';
import { ayar } from './ayar.js';
import { firmaAdi } from './profil.js';

const bulutMu = () => app.db?.mode === 'supabase' && !!app.db?.c;
const tablo = () => app.db.c.from('teklif_baglantilari');
const eskiSema = e => /does not exist|schema cache|Could not find/i.test(e?.message || '');
const SEMA_UYARI = 'Onay bağlantısı için Supabase\'de güncel schema.sql dosyasını çalıştır (sürüm 35).';

function rastgeleAnahtar() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');   // 48 karakter
}
export function baglantiAdresi(anahtar) {
  const c = getConfig() || {}, ref = (String(c.url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1];
  if (!ref || !c.key) throw new Error('Supabase bağlantı bilgisi bulunamadı.');
  const kok = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
  return `${kok}teklif.html#a=${anahtar}&p=${ref}&k=${encodeURIComponent(c.key)}`;
}

export async function baglantilar(teklif_id) {
  if (!bulutMu()) return [];
  let q = tablo().select('*').order('created_at', { ascending: false });
  if (teklif_id) q = q.eq('teklif_id', teklif_id);
  const { data, error } = await q;
  if (error) { if (eskiSema(error)) return null; throw error; }
  return data || [];
}

export async function baglantiOlustur(t) {
  if (!bulutMu()) throw new Error('Onay bağlantısı yalnızca bulut hesabında (Supabase) çalışır.');
  const { hesapla, teklifHtml } = await import('./views/teklif.js');
  const h = hesapla(t), bilgi = ayar('teklif_firma') || {}, p = byId('projeler', t.proje_id), k = byId('kisiler', t.kisi_id);
  const icerik = { gonderen: bilgi.ad || firmaAdi(), hazirlayan: benimAdim(), musteri: firmaAd(t.firma_id) || '', kisi: k?.ad_soyad || '', proje: p?.ad || '',
    teklif_no: t.teklif_no || '', tarih: t.tarih, gecerlilik: t.gecerlilik || null, para_birimi: t.para_birimi || 'USD', net: h.net, genel: h.genel, html: teklifHtml(t), ...(await (async () => { const m = await import('./teklif2.js'), ss = m.secenekler(t); return ss.length > 1 ? { secenekler: ss.map(x => ({ ad: x, net: m.hesapla2(t, x).net, genel: m.hesapla2(t, x).genel })), secim: m.secim(t) } : {}; })()) };
  const kayit = { teklif_id: t.id, anahtar: rastgeleAnahtar(), son_tarih: t.gecerlilik && t.gecerlilik >= today() ? t.gecerlilik : gunEkle(today(), 30), icerik };
  ozellikSay('onay-baglanti');
  const { data, error } = await tablo().insert(kayit).select().single();
  if (error) throw new Error(eskiSema(error) ? SEMA_UYARI : error.message);
  if (t.durum === 'Taslak') { try { await app.db.save('teklifler', { ...t, durum: 'Gönderildi' }); } catch {} }
  return data;
}

const durumYazi = b => b.iptal ? '<span class="tag-s neg">İptal</span>'
  : b.yanit === 'Onay' ? `<span class="tag-s ok">Onaylandı ${esc(tarih(String(b.yanit_zaman).slice(0, 10)))}</span>`
  : b.yanit === 'Revize' ? `<span class="tag-s warn">Revize istendi</span>`
  : b.son_tarih && b.son_tarih < today() ? '<span class="tag-s">Süresi doldu</span>'
  : b.acilma ? `<span class="tag-s">Açıldı · ${b.acilma} kez</span>` : '<span class="tag-s">Henüz açılmadı</span>';

export async function baglantiPenceresi(t, sonra) {
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(t.teklif_no || 'Teklif')} · ${esc(firmaAd(t.firma_id) || '')}</p><h2 id="drawer-title">Onay bağlantısı</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="hint">Müşteri bağlantıyı telefonunda açar, teklifi görür ve <b>Onaylıyorum</b> ya da <b>Revize istiyorum</b> der. Onaylarsa teklif Kabul olur; iki durumda da sana görev düşer. Müşteri yalnızca bu teklifin o anki halini görür; teklifi sonra değiştirirsen yeni bağlantı oluştur.</p>
    <div data-liste><p class="hint">Yükleniyor…</p></div>
    <div class="btnrow"><button type="button" class="btn primary" data-yeni>Yeni bağlantı oluştur</button></div></div>`, { onClose: () => sonra?.() });
  const ciz = async () => {
    const kutu = p.querySelector('[data-liste]');
    let l; try { l = await baglantilar(t.id); } catch (e) { kutu.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    if (l === null) { kutu.innerHTML = `<p class="warn">${esc(SEMA_UYARI)}</p>`; p.querySelector('[data-yeni]').disabled = true; return; }
    kutu.innerHTML = l.length ? `<ul class="list ob-l">${l.map(b => `<li data-bid="${b.id}"><div class="grow"><b>${esc(tarih(String(b.created_at).slice(0, 10)))}</b> ${durumYazi(b)}
        <small class="muted">${b.son_acilma ? 'son açılma ' + esc(new Date(b.son_acilma).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })) + ' · ' : ''}${b.son_tarih ? 'geçerli ' + esc(tarih(b.son_tarih)) + ' tarihine kadar' : ''}</small>
        ${b.yanit_not || b.yanit_ad ? `<small class="ob-not">${esc([b.yanit_ad, b.yanit_not].filter(Boolean).join(': '))}</small>` : ''}</div>
        ${b.iptal ? '' : `<span class="ra"><button type="button" class="btn sm ghost" data-kopya>Kopyala</button><button type="button" class="btn sm ghost" data-wa>WhatsApp</button>${b.yanit ? '' : '<button type="button" class="btn sm ghost danger" data-iptal>İptal et</button>'}</span>`}</li>`).join('')}</ul>`
      : '<p class="hint">Bu teklif için henüz bağlantı yok.</p>';
    kutu.querySelectorAll('li[data-bid]').forEach(li => {
      const b = l.find(x => x.id === li.dataset.bid), adres = () => baglantiAdresi(b.anahtar);
      li.querySelector('[data-kopya]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(adres()); toast('Bağlantı kopyalandı.'); } catch { prompt('Bağlantıyı kopyala:', adres()); } });
      li.querySelector('[data-wa]')?.addEventListener('click', () => waGonderBaglanti(t, adres()));
      li.querySelector('[data-iptal]')?.addEventListener('click', async () => {
        if (!confirmBox('Bağlantı iptal edilsin mi? Müşteri bağlantıyı açtığında teklifi göremez.')) return;
        const { error } = await tablo().update({ iptal: true }).eq('id', b.id); if (error) return toast('İptal edilemedi: ' + error.message, 'err');
        toast('Bağlantı iptal edildi.'); ciz();
      });
    });
  };
  p.querySelector('[data-yeni]').onclick = async e => {
    e.target.disabled = true;
    try { const b = await baglantiOlustur(byId('teklifler', t.id) || t); toast('Bağlantı oluşturuldu.'); await ciz(); try { await navigator.clipboard.writeText(baglantiAdresi(b.anahtar)); toast('Bağlantı oluşturuldu ve kopyalandı.'); } catch {} }
    catch (err) { toast(err.message, 'err'); }
    e.target.disabled = false;
  };
  ciz();
}

function waGonderBaglanti(t, adres) {
  const k = byId('kisiler', t.kisi_id), pr = byId('projeler', t.proje_id);
  const metin = [`Merhaba${k ? ' ' + k.ad_soyad.split(' ')[0] + ' Bey/Hanım' : ''},`, `${pr ? pr.ad + ' için ' : ''}teklifimizi (${t.teklif_no}) aşağıdaki bağlantıdan inceleyip onaylayabilir ya da revize isteyebilirsiniz:`, adres, t.gecerlilik ? `Geçerlilik: ${tarih(t.gecerlilik)}` : '', '', benimAdim()].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  window.open(waLink(k?.telefon || byId('firmalar', t.firma_id)?.telefon || '', metin), '_blank', 'noopener');
}

// Teklifler listesi için: teklif başına en son bağlantının durumu
export async function durumHaritasi() {
  try { const l = await baglantilar(); if (!l) return new Map(); const m = new Map(); for (const b of l) if (!m.has(b.teklif_id)) m.set(b.teklif_id, b); return m; }
  catch { return new Map(); }
}
export const durumRozeti = b => !b ? '' : b.iptal ? '' : b.yanit === 'Onay' ? '<em class="ob-r ok">Bağlantıdan onaylandı</em>' : b.yanit === 'Revize' ? '<em class="ob-r warn">Revize istendi</em>' : b.acilma ? `<em class="ob-r">Açıldı ${b.acilma}×</em>` : '<em class="ob-r">Bağlantı gönderildi</em>';
