// Hazır WhatsApp mesajları: {ad}, {firma}, {proje}, {tarih}, {benim} alanları kendiliğinden dolar.
import { S } from './db.js';
import { esc, byId, firmaAd, toast, openDrawer, closeDrawer, waLink, tarih, today } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

export const VARSAYILAN_SABLON = [
  { ad: 'Ziyaret sonrası teşekkür', metin: 'Merhaba {ad} Bey/Hanım, bugün zaman ayırdığınız için teşekkür ederim. {proje} ile ilgili konuştuğumuz konuları takip edip size en kısa sürede dönüş yapacağım. İyi çalışmalar, {benim}' },
  { ad: 'Teklif takibi', metin: 'Merhaba {ad} Bey/Hanım, {proje} için ilettiğimiz aydınlatma teklifini değerlendirme fırsatınız oldu mu? Sorularınız ya da revize talebiniz olursa memnuniyetle yardımcı olurum. {benim}' },
  { ad: 'Ziyaret randevusu', metin: 'Merhaba {ad} Bey/Hanım, {firma} ziyareti için bu hafta size uygun bir gün ve saat var mı? Yeni ürünlerimizi ve {proje} için önerilerimizi paylaşmak isterim. {benim}' },
  { ad: 'Numune hatırlatma', metin: 'Merhaba {ad} Bey/Hanım, bıraktığımız numune ürünle ilgili görüşlerinizi almak isterim. Uygun olduğunuzda kısa bir görüşme yapabilir miyiz? {benim}' },
  { ad: 'Doğum günü', metin: 'Merhaba {ad} Bey/Hanım, doğum gününüzü kutlar, sağlıklı ve mutlu bir yıl dilerim. {benim}' },
  { ad: 'Tahsilat hatırlatma', metin: 'Merhaba {ad} Bey/Hanım, {belge} numaralı {vade} vadeli {tutar} tutarındaki ödemeyle ilgili bilgi rica ederim. Ödeme yapıldıysa dekontu iletebilir misiniz? Teşekkürler, {benim}' },
  { ad: 'Bayram tebriği', metin: 'Merhaba {ad} Bey/Hanım, bayramınızı en içten dileklerimle kutlarım. Sevdiklerinizle birlikte sağlıklı ve huzurlu bir bayram geçirmenizi dilerim. {benim}' },
];
export const sablonlar = () => { const s = ayar('wa_sablonlar'); return Array.isArray(s) && s.length ? s : VARSAYILAN_SABLON; };
export const benimAdim = () => ayar('benim_adim') || '';

export function doldur(metin, { kisi, firma, proje, alanlar = {} } = {}) {
  const ilk = (kisi?.ad_soyad || '').replace(/\s*(Bey|Hanım)$/i, '').split(/\s+/)[0] || '';
  if (!ilk) metin = String(metin).replace(/\s*\{ad\}\s*Bey\/Hanım/g, '').replace(/\{ad\}\s*/g, '');
  return String(metin)
    .replace(/\{ad\}/g, ilk).replace(/\{adsoyad\}/g, kisi?.ad_soyad || '')
    .replace(/\{firma\}/g, firma?.ad || '').replace(/\{proje\}/g, proje?.ad || 'projeniz')
    .replace(/\{tarih\}/g, tarih(today())).replace(/\{benim\}/g, benimAdim())
    .replace(/\{(\w+)\}/g, (m, k) => alanlar[k] != null ? alanlar[k] : m)
    .replace(/\s+([,.])/g, '$1').replace(/ {2,}/g, ' ').trim();
}

// Şablon seçme paneli. ctx: { kisi, firma, proje, sablonAdi }
export function waGonder(ctx = {}) {
  const kisi = ctx.kisi, firma = ctx.firma || (kisi && byId('firmalar', kisi.firma_id)), proje = ctx.proje;
  const tel = kisi?.telefon || firma?.telefon || '';
  let list = sablonlar();
  if (ctx.sablonAdi && !list.some(x => x.ad === ctx.sablonAdi)) { const v = VARSAYILAN_SABLON.find(x => x.ad === ctx.sablonAdi); if (v) list = [...list, v]; }
  const p = openDrawer(`<header class="dh"><div><p class="muted">WhatsApp</p><h2 id="drawer-title">${esc(kisi?.ad_soyad || firma?.ad || 'Mesaj gönder')}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      ${tel ? `<p class="hint">Numara: ${esc(tel)}</p>` : '<p class="warn">Bu kişinin telefonu kayıtlı değil. WhatsApp açılınca alıcıyı kendin seçersin.</p>'}
      <div class="fld"><label for="wa-s">Şablon</label><select id="wa-s">${list.map((s, i) => `<option value="${i}" ${s.ad === ctx.sablonAdi ? 'selected' : ''}>${esc(s.ad)}</option>`).join('')}</select></div>
      ${S.projeler.length && !proje ? `<div class="fld"><label for="wa-p">Proje (isteğe bağlı)</label><input id="wa-p" list="wa-pl" placeholder="Proje adı"><datalist id="wa-pl">${S.projeler.filter(x => !firma || [x.emut_id, x.gemut_id, x.alici_id, x.bayi_id, x.yatirimci_id, x.projeci_id].includes(firma.id)).map(x => `<option value="${esc(x.ad)}">`).join('')}</datalist></div>` : ''}
      <div class="fld"><label for="wa-m">Mesaj</label><textarea id="wa-m" rows="6"></textarea><small>Göndermeden önce düzenleyebilirsin. ${benimAdim() ? '' : 'İmzan için Ayarlar → Mesaj şablonları bölümüne adını yaz.'}</small></div>
      <div class="dfoot"><button type="button" class="btn ghost" data-copy>Kopyala</button><a class="btn primary" data-wa target="_blank" rel="noopener">WhatsApp'ta aç</a></div>
    </div>`);
  const sel = p.querySelector('#wa-s'), ta = p.querySelector('#wa-m'), pin = p.querySelector('#wa-p'), a = p.querySelector('[data-wa]');
  const prj = () => proje || (pin && S.projeler.find(x => x.ad === pin.value)) || null;
  const yaz = () => { ta.value = doldur(list[+sel.value].metin, { kisi, firma, proje: prj(), alanlar: ctx.alanlar }); link(); };
  const link = () => { a.href = waLink(tel, ta.value); };
  sel.onchange = yaz; pin && (pin.onchange = yaz); ta.oninput = link;
  a.onclick = () => setTimeout(closeDrawer, 300);
  p.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Mesaj kopyalandı.'); } catch { toast('Kopyalanamadı; metni seçip kopyala.', 'err'); } };
  yaz();
}

// Ayarlar ekranındaki düzenleyici
export function sablonDuzenleyici(root) {
  let list = sablonlar().map(x => ({ ...x }));
  const ciz = () => {
    root.innerHTML = `<div class="fld"><label for="benim">İmzan (mesajların sonunda {benim} yerine geçer)</label><input id="benim" value="${esc(benimAdim())}" placeholder="Örn. Ali Yılmaz · Yıldız Elektrik"></div>
      ${list.map((s, i) => `<div class="sab"><div class="sab-h"><input data-ad="${i}" value="${esc(s.ad)}" aria-label="Şablon adı"><button type="button" class="x" data-sil="${i}" aria-label="Şablonu sil">×</button></div><textarea data-metin="${i}" rows="3">${esc(s.metin)}</textarea></div>`).join('')}
      <p class="hint">Kullanılabilir alanlar: {ad} kişinin adı, {adsoyad}, {firma}, {proje}, {tarih}, {benim}.</p>
      <div class="btnrow"><button type="button" class="btn" data-ekle>Şablon ekle</button><button type="button" class="btn primary" data-kaydet>Kaydet</button><button type="button" class="btn ghost" data-sifirla>Varsayılanlara dön</button></div>`;
    root.querySelectorAll('[data-ad]').forEach(x => x.oninput = () => list[+x.dataset.ad].ad = x.value);
    root.querySelectorAll('[data-metin]').forEach(x => x.oninput = () => list[+x.dataset.metin].metin = x.value);
    root.querySelectorAll('[data-sil]').forEach(x => x.onclick = () => { list.splice(+x.dataset.sil, 1); ciz(); });
    root.querySelector('[data-ekle]').onclick = () => { list.push({ ad: 'Yeni şablon', metin: 'Merhaba {ad} Bey/Hanım, ' }); ciz(); };
    root.querySelector('[data-sifirla]').onclick = () => { list = VARSAYILAN_SABLON.map(x => ({ ...x })); ciz(); };
    root.querySelector('[data-kaydet]').onclick = async () => {
      await ayarYaz('benim_adim', root.querySelector('#benim').value.trim() || null);
      await ayarYaz('wa_sablonlar', list.filter(x => x.ad.trim() && x.metin.trim()));
      toast('Mesaj şablonları kaydedildi.');
    };
  };
  ciz();
}
