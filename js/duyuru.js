// Toplu duyuru: seçilen firmalara şablonla hazırlanmış WhatsApp mesajı; her biri tek tek açılır (WhatsApp toplu göndermeye izin vermez)
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, waLink, ILLER, FIRMA_TIPLERI, today } from './ui.js';
import { sablonlar, doldur } from './sablon.js';

const telefon = f => { const k = S.kisiler.filter(k => k.firma_id === f.id && k.telefon).sort((a, b) => (/^0?5/.test(b.telefon.replace(/\D/g, '')) ? 1 : 0) - (/^0?5/.test(a.telefon.replace(/\D/g, '')) ? 1 : 0))[0]; return { kisi: k || null, tel: k?.telefon || f.telefon || '' }; };
export function topluDuyuru() {
  const s = { tip: 'Tümü', il: 'Tümü', segment: 'Tümü', key: false, sadeceTel: true };
  let gonderilen = new Set();
  const p = openDrawer(`<header class="dh"><div><p class="muted">WhatsApp</p><h2 id="drawer-title">Toplu duyuru</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form">
      <div class="grid"><div class="fld"><label>Firma tipi</label><select data-f="tip">${['Tümü', ...FIRMA_TIPLERI].map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="fld"><label>İl</label><select data-f="il">${['Tümü', ...ILLER].map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="fld"><label>Segment</label><select data-f="segment">${['Tümü', 'A', 'B', 'C'].map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="fld is-chk"><label class="chk"><input type="checkbox" data-f="key"> <span>Yalnızca key account</span></label></div></div>
      <div class="fld"><label for="dy-s">Şablon</label><select id="dy-s"><option value="">Kendim yazacağım</option>${sablonlar().map((x, i) => `<option value="${i}">${esc(x.ad)}</option>`).join('')}</select></div>
      <div class="fld"><label for="dy-m">Mesaj</label><textarea id="dy-m" rows="5" placeholder="Merhaba {ad} Bey/Hanım, yeni HBL serimiz stokta…"></textarea><small>{ad} kişinin adı, {firma} firma adı ile değişir.</small></div>
      <div data-liste></div></div>`, { wide: true });
  const ta = p.querySelector('#dy-m');
  p.querySelector('#dy-s').onchange = e => { if (e.target.value !== '') ta.value = sablonlar()[+e.target.value].metin; ciz(); };
  ta.oninput = () => { clearTimeout(ta._t); ta._t = setTimeout(ciz, 300); };
  p.querySelectorAll('[data-f]').forEach(i => i.onchange = () => { s[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value; ciz(); });
  function ciz() {
    const l = S.firmalar.filter(f => (s.tip === 'Tümü' || (f.tipler || []).includes(s.tip)) && (s.il === 'Tümü' || f.il === s.il) && (s.segment === 'Tümü' || f.segment === s.segment) && (!s.key || f.key_account))
      .map(f => ({ f, ...telefon(f) })).sort((a, b) => !!b.tel - !!a.tel || a.f.ad.localeCompare(b.f.ad, 'tr'));
    const telli = l.filter(x => x.tel);
    const kutu = p.querySelector('[data-liste]');
    kutu.innerHTML = `<div class="card-h"><h3>${telli.length} alıcı <span class="muted">${l.length - telli.length ? `· ${l.length - telli.length} firmanın telefonu yok` : ''} · ${gonderilen.size} gönderildi</span></h3>
      ${telli.length ? `<button type="button" class="btn sm primary" data-sirada>Sıradakini aç</button>` : ''}</div>
      <ul class="list duyuru">${l.slice(0, 200).map(x => { const m = doldur(ta.value || '', { kisi: x.kisi, firma: x.f }); return `<li class="${gonderilen.has(x.f.id) ? 'gitti' : ''}"><span class="grow"><b>${esc(x.f.ad)}</b><small class="muted">${esc([x.kisi?.ad_soyad, x.tel || 'telefon yok', x.f.il].filter(Boolean).join(' · '))}</small></span>
        ${x.tel && ta.value.trim() ? `<a class="btn sm ${gonderilen.has(x.f.id) ? 'ghost' : ''}" target="_blank" rel="noopener" data-gonder="${x.f.id}" href="${waLink(x.tel, m)}">${gonderilen.has(x.f.id) ? 'Tekrar' : 'Gönder'}</a>` : ''}</li>`; }).join('')}</ul>
      ${!ta.value.trim() ? '<p class="hint">Mesajı yaz ya da şablon seç; her alıcı için “Gönder” WhatsApp\'ı o kişiye hazır mesajla açar.</p>' : ''}`;
    kutu.querySelectorAll('[data-gonder]').forEach(a => a.addEventListener('click', () => { gonderilen.add(a.dataset.gonder); kayit(a.dataset.gonder); setTimeout(ciz, 300); }));
    kutu.querySelector('[data-sirada]')?.addEventListener('click', () => { if (!ta.value.trim()) return toast('Önce mesajı yaz.', 'err'); const x = telli.find(x => !gonderilen.has(x.f.id)); if (!x) return toast('Hepsine gönderildi.'); const a = kutu.querySelector(`[data-gonder="${x.f.id}"]`); a?.click(); window.open(a?.href, '_blank', 'noopener'); });
  }
  // Gönderimi firmanın ziyaret geçmişine not olarak düş
  async function kayit(fid) { try { await app.db.save('ziyaretler', { tarih: today(), durum: 'Yapıldı', amac: 'Ürün sunumu', firma_id: fid, notlar: 'WhatsApp duyurusu: ' + ta.value.trim().slice(0, 300), fotolar: [] }); } catch {} }
  ciz();
}
