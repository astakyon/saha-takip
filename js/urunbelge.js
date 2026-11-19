// Ürün belgeleri: veri sayfası (datasheet), sertifikalar, fotometrik dosya, montaj kılavuzu, üretici sayfası.
// Belgeler ürün koduna bağlıdır: aynı ürün hangi bayide olursa olsun aynı belgeler görünür. Seçilen belgeler WhatsApp, e-posta ya da telefonun paylaşım menüsüyle gönderilir.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, confirmBox, pickFiles, fold } from './ui.js';
import { disKullanici } from './yetki.js';

export const BELGE_TUR = ['Veri sayfası', 'Sertifika', 'Fotometrik dosya', 'Montaj kılavuzu', 'Üretici sayfası', 'Diğer'];
const IKON = { 'Veri sayfası': '📄', Sertifika: '🏅', 'Fotometrik dosya': '💡', 'Montaj kılavuzu': '🔧', 'Üretici sayfası': '🌐', Diğer: '📎' };
// Kalemin belgeleri: ürün belgeleri + Ürünler kartındaki föy / sertifika / fotometrik bağlantıları
export function urunBelgeleri(kod) {
  if (!kod) return [];
  const l = (S.urun_belgeleri || []).filter(b => b.kod === kod).map(b => ({ ...b, kaynak: 'belge' }));
  const u = (S.urunler || []).find(x => x.kod === kod);
  if (u) for (const [alan, tur] of [['foy_url', 'Veri sayfası'], ['sertifika_url', 'Sertifika'], ['fotometri_url', 'Fotometrik dosya']]) if (u[alan] && !l.some(b => b.url === u[alan])) l.push({ id: 'u:' + alan, kod, tur, ad: tur, url: u[alan], kaynak: 'urun' });
  return l.sort((a, b) => BELGE_TUR.indexOf(a.tur) - BELGE_TUR.indexOf(b.tur));
}
export const belgeSayisi = kod => urunBelgeleri(kod).filter(b => b.tur !== 'Üretici sayfası').length;
// Paylaşılacak bağlantı: yüklenen dosya için 7 gün geçerli bağlantı
async function paylasimUrl(b) {
  if (b.url) return b.url;
  if (!b.yol) return null;
  try { if (app.db?.c?.storage) { const { data } = await app.db.c.storage.from('fotograflar').createSignedUrl(b.yol, 7 * 86400); if (data?.signedUrl) return data.signedUrl; } } catch {}
  return app.db.url(b.yol);
}
export function belgePenceresi({ s, marka = '', sonra } = {}) {
  const kod = s.kod, yazabilir = app.db && !app.db.onizleme;
  const p = openDrawer('<div class="dbody"></div>', { wide: true, onClose: () => sonra?.() });
  const ciz = async () => {
    const { ureticideAra, markaSitesi } = await import('./ureticietiket.js');
    const l = urunBelgeleri(kod), sayfa = l.find(b => b.tur === 'Üretici sayfası');
    p.innerHTML = `<header class="dh"><div><p class="muted">${esc(kod)}${marka ? ' · ' + esc(marka) : ''}</p><h2 id="drawer-title">Ürün belgeleri</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><p class="muted">${esc(s.aciklama || '')}</p>
      ${l.length ? `<ul class="list ub-liste">${l.map(b => `<li><label class="chk"><input type="checkbox" data-ubsec="${esc(b.id)}" ${b.tur !== 'Üretici sayfası' ? 'checked' : ''}> <span>${IKON[b.tur] || '📎'} <b>${esc(b.ad || b.tur)}</b> <small class="muted">${esc(b.tur)}${b.yol ? ' · yüklenen dosya' : ''}${b.kaynak === 'urun' ? ' · Ürünler kartından' : ''}</small></span></label>
        <span class="btnrow"><button type="button" class="btn sm" data-ubac="${esc(b.id)}">Aç</button>${b.kaynak === 'belge' && yazabilir ? `<button type="button" class="btn sm ghost danger" data-ubsil="${esc(b.id)}" aria-label="${esc(b.ad || b.tur)} sil">Sil</button>` : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Bu ürüne belge eklenmemiş.</p>'}
      ${!sayfa ? `<p><a class="btn sm ghost" href="${esc(ureticideAra(marka, kod, s.aciklama || ''))}" target="_blank" rel="noopener">🌐 Üreticide ara${markaSitesi(marka) ? ' (' + esc(markaSitesi(marka)) + ')' : ''}</a> <small class="muted">Bulduğun sayfanın adresini aşağıya “Üretici sayfası” olarak ekle.</small></p>` : ''}
      ${l.length ? `<h3>Paylaş</h3><p class="hint">İşaretli belgelerin bağlantıları gönderilir. Yüklenen dosyaların bağlantısı 7 gün geçerlidir.</p>
        <div class="btnrow">${navigator.share ? '<button type="button" class="btn primary" data-ubpay="sistem">Paylaş…</button>' : ''}<button type="button" class="btn" data-ubpay="wa">WhatsApp</button><button type="button" class="btn" data-ubpay="eposta">E-posta</button><button type="button" class="btn ghost" data-ubpay="kopya">Bağlantıları kopyala</button></div>` : ''}
      ${yazabilir ? `<h3>Belge ekle</h3>
        <div class="frow"><label class="fld"><span>Tür</span><select data-ubtur>${BELGE_TUR.map(t => `<option>${t}</option>`).join('')}</select></label><label class="fld"><span>Adı</span><input data-ubad placeholder="ör. CE sertifikası, ENEC belgesi"></label></div>
        <label class="fld"><span>Bağlantı</span><input data-uburl inputmode="url" placeholder="https://… (üreticinin sayfası ya da PDF bağlantısı)"></label>
        <div class="btnrow"><button type="button" class="btn" data-ubekle>Bağlantıyı ekle</button><button type="button" class="btn ghost" data-ubdosya>PDF / dosya yükle</button></div>
        <p class="hint">Belge bu ürün koduna bağlanır; ürün hangi bayide olursa olsun görünür.</p>` : ''}
    </div>`;
    const bul = id => l.find(b => String(b.id) === String(id));
    p.querySelectorAll('[data-ubac]').forEach(x => x.onclick = async () => { const b = bul(x.dataset.ubac), u = b.url || await app.db.url(b.yol); if (u) window.open(u, '_blank', 'noopener'); else toast('Belge açılamadı.', 'err'); });
    p.querySelectorAll('[data-ubsil]').forEach(x => x.onclick = async () => { const b = bul(x.dataset.ubsil); if (!confirmBox(`“${b.ad || b.tur}” belgesi silinsin mi?`)) return; await app.db.del('urun_belgeleri', b.id); toast('Belge silindi.'); ciz(); });
    const ekle = async o => { const d = disKullanici(); await app.db.save('urun_belgeleri', { id: uuid(), kod, firma_id: d ? d.firma_id : null, ...o }); toast('Belge eklendi.'); ciz(); };
    p.querySelector('[data-ubekle]')?.addEventListener('click', () => { const url = p.querySelector('[data-uburl]').value.trim(), tur = p.querySelector('[data-ubtur]').value;
      if (!/^https?:\/\/\S+\.\S+/i.test(url)) return toast('Bağlantı https:// ile başlamalı.', 'err'); ekle({ tur, ad: p.querySelector('[data-ubad]').value.trim() || tur, url }); });
    p.querySelector('[data-ubdosya]')?.addEventListener('click', async () => { const [f] = await pickFiles({ accept: '.pdf,.ies,.ldt,.zip,image/*', multiple: false }); if (!f) return;
      try { toast('Yükleniyor…'); const yol = await app.db.uploadFile(f); ekle({ tur: p.querySelector('[data-ubtur]').value, ad: p.querySelector('[data-ubad]').value.trim() || f.name.replace(/\.[^.]+$/, ''), yol }); } catch (e) { toast('Yüklenemedi: ' + e.message, 'err'); } });
    p.querySelectorAll('[data-ubpay]').forEach(x => x.onclick = async () => {
      const sec = [...p.querySelectorAll('[data-ubsec]:checked')].map(c => bul(c.dataset.ubsec)); if (!sec.length) return toast('Paylaşılacak belgeyi işaretle.', 'err');
      const satir = []; for (const b of sec) { const u = await paylasimUrl(b); if (u) satir.push(`• ${b.ad || b.tur}: ${u}`); }
      const metin = [`${kod}${s.aciklama ? ' – ' + s.aciklama : ''}`, ...satir].join('\n'), a = x.dataset.ubpay;
      if (a === 'sistem') { try { await navigator.share({ title: `${kod} belgeleri`, text: metin }); } catch {} }
      else if (a === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(metin)}`, '_blank', 'noopener');
      else if (a === 'eposta') location.href = `mailto:?subject=${encodeURIComponent(`${kod} ürün belgeleri`)}&body=${encodeURIComponent(metin)}`;
      else { try { await navigator.clipboard.writeText(metin); toast('Bağlantılar kopyalandı.'); } catch { toast('Kopyalanamadı.', 'err'); } }
    });
  };
  ciz();
}
