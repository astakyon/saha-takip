// Kullanıcılar ve yetkiler (yalnızca veri sahibi görür): ekip üyesi ekleme, bölüm bazında yetki, davet bağlantısı
import { getConfig } from '../db.js';
import { app } from '../state.js';
import { esc, toast, confirmBox, waLink } from '../ui.js';
import { MODULLER, tabloYetkileri, modulSecimi } from '../yetki.js';

const SEVIYE = [[null, 'Yok'], ['oku', 'Görür'], ['yaz', 'Düzenler']];
// Kişinin rolü (Bayi, Ekip arkadaşı…) yetkiler içindeki “_rol” anahtarında saklanır; veritabanı yetki kontrolü bu anahtarı kullanmaz.
export const ROLLER = ['Bayi', 'Ekip arkadaşı', 'Satış temsilcisi', 'Yönetici', 'Proje firması', 'Elektrik müteahhidi', 'Diğer'];
export const rolAl = u => u?.yetkiler?._rol || '';
const rolListesi = () => '';
// Rol seçimi: liste + “Başka…” (serbest yazı)
const rolSecici = (deger, id = '') => { const v = deger || ''; const ozel = v && !ROLLER.includes(v); return `<div class="rol-sec"><select data-rolsec ${id ? `id="${id}"` : ''} aria-label="Rol"><option value="">Rol seç</option>${ROLLER.map(r => `<option ${r === v ? 'selected' : ''}>${r}</option>`).join('')}<option value="__baska" ${ozel ? 'selected' : ''}>Başka (yaz)…</option></select><input data-rolyaz placeholder="Rolü yaz" value="${ozel ? v.replace(/"/g, '&quot;') : ''}" ${ozel ? '' : 'hidden'} maxlength="40"></div>`; };
const rolOku = kok => { const s = kok.querySelector('[data-rolsec]'); return s.value === '__baska' ? kok.querySelector('[data-rolyaz]').value.trim() : s.value; };
const rolBagla = kok => kok.querySelectorAll('[data-rolsec]').forEach(s => s.onchange = () => { const i = s.parentElement.querySelector('[data-rolyaz]'); i.hidden = s.value !== '__baska'; if (!i.hidden) i.focus(); });
const HAZIR_ROL = { 'Bayi': 'Bayi', 'Saha ekibi': 'Ekip arkadaşı', 'Sadece görüntüleme': 'Yönetici', 'Tam yetki': 'Ekip arkadaşı' };
const HAZIR = {
  'Sadece görüntüleme': { projeler: 'oku', firmalar: 'oku', ziyaretler: 'oku', bolgeler: 'oku' },
  'Saha ekibi': { projeler: 'yaz', firmalar: 'yaz', ziyaretler: 'yaz', bolgeler: 'oku', numune: 'yaz', belgeler: 'yaz' },
  'Bayi': { projeler: 'oku', firmalar: 'oku', stok: 'yaz', siparisler: 'oku' },
  'Tam yetki': Object.fromEntries(MODULLER.map(m => [m.k, 'yaz'])),
};
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function davetLinki(eposta) {
  const c = getConfig();
  return location.origin + location.pathname + '?davet=' + b64(JSON.stringify({ u: c.url, k: c.key, e: eposta }));
}

export async function kullaniciAyarlari(root) {
  if (app.db.mode !== 'supabase') { root.innerHTML = '<p class="hint">Başka kişilere yetki vermek için önce Genel sekmesinden bulut (Supabase) bağlantısını kur.</p>'; return; }
  root.innerHTML = '<p class="hint">Yükleniyor…</p>';
  const { data, error } = await app.db.c.from('ekip_uyeleri').select('*').order('created_at');
  if (error) { root.innerHTML = `<p class="warn">Kullanıcı tablosu bulunamadı. Supabase SQL Editor'de güncel <b>schema.sql</b> dosyasını çalıştır.</p>`; return; }
  const uyeler = data || [];
  root.innerHTML = `<p>Eklediğin kişi, bu e-postayla Saha Takip'e giriş yaptığında <b>yalnızca yetki verdiğin bölümleri</b> görür. “Görür” seçtiğin bölümde değişiklik yapamaz; senin ayarlarına, kullanıcı listesine ve diğer bölümlere erişemez.</p>
    ${rolListesi()}<div class="uyeler">${uyeler.slice().sort((a, b) => rolAl(a).localeCompare(rolAl(b), 'tr') || (a.ad || a.eposta).localeCompare(b.ad || b.eposta, 'tr')).map(u => uyeKarti(u)).join('') || '<p class="hint">Henüz kimse eklenmedi.</p>'}</div>
    <details class="card-ic" ${uyeler.length ? '' : 'open'}><summary><b>Kişi ekle</b></summary>
      <form class="form" data-yeni><div class="grid"><div class="fld"><label for="ku-e">E-posta</label><input id="ku-e" type="email" required placeholder="ornek@firma.com"></div><div class="fld"><label for="ku-a">Ad</label><input id="ku-a" placeholder="Örn. Ali (Drv)"></div><div class="fld"><label for="ku-r">Rol / ünvan</label>${rolSecici('', 'ku-r')}</div></div>
      <div class="fld"><label>Hazır yetki</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
      ${modulTablosu('yeni', {})}
      <div class="btnrow"><button type="submit" class="btn primary">Ekle ve davet bağlantısı oluştur</button></div></form></details>`;
  rolBagla(root);
  const yeni = root.querySelector('[data-yeni]');
  yeni.querySelectorAll('[data-hazir]').forEach(b => b.onclick = () => { const h = HAZIR[b.dataset.hazir]; yeni.querySelectorAll('select[data-m]').forEach(s => s.value = h[s.dataset.m] || ''); const r = yeni.querySelector('#ku-r'); if (!rolOku(yeni) && HAZIR_ROL[b.dataset.hazir]) { r.value = HAZIR_ROL[b.dataset.hazir]; r.dispatchEvent(new Event('change')); } yeni.querySelectorAll('[data-hazir]').forEach(x => x.classList.toggle('on', x === b)); });
  yeni.onsubmit = async e => {
    e.preventDefault();
    const eposta = yeni.querySelector('#ku-e').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(eposta)) return toast('Geçerli bir e-posta yaz.', 'err');
    if (eposta === (app.db.user()?.email || '').toLowerCase()) return toast('Kendini ekleyemezsin; sen zaten veri sahibisin.', 'err');
    const secim = secimOku(yeni); if (!Object.values(secim).some(Boolean)) return toast('En az bir bölüm için yetki seç.', 'err');
    const { error } = await app.db.c.from('ekip_uyeleri').insert({ eposta, ad: yeni.querySelector('#ku-a').value.trim() || null, yetkiler: rolEkle(tabloYetkileri(secim), rolOku(yeni)), aktif: true });
    if (error) return toast(/duplicate|unique/i.test(error.message) ? 'Bu e-posta zaten ekli.' : 'Eklenemedi: ' + error.message, 'err');
    toast('Kişi eklendi. Davet bağlantısını gönder.'); await kullaniciAyarlari(root); root.querySelector(`[data-uye="${CSS.escape(eposta)}"] [data-davet]`)?.click();
  };
  root.querySelectorAll('[data-uye]').forEach(k => {
    const u = uyeler.find(x => x.eposta === k.dataset.uye);
    k.querySelector('[data-kaydet]').onclick = async () => {
      const { error } = await app.db.c.from('ekip_uyeleri').update({ ad: k.querySelector('[data-ad]').value.trim() || null, aktif: k.querySelector('[data-aktif]').checked, yetkiler: rolEkle(tabloYetkileri(secimOku(k)), rolOku(k)) }).eq('id', u.id);
      if (!error) { const y = rolOku(k); const rb = k.querySelector('.rol-r'); if (rb) { rb.textContent = y; rb.hidden = !y; } }
      toast(error ? 'Kaydedilemedi: ' + error.message : 'Yetkiler kaydedildi. Kişi uygulamayı yeniden açınca geçerli olur.', error ? 'err' : '');
    };
    k.querySelector('[data-sil]').onclick = async () => { if (!confirmBox(`${u.eposta} kullanıcılardan çıkarılsın mı? Artık verilerini göremez.`)) return; await app.db.c.from('ekip_uyeleri').delete().eq('id', u.id); toast('Kullanıcı çıkarıldı.'); kullaniciAyarlari(root); };
    k.querySelector('[data-davet]').onclick = () => {
      const l = davetLinki(u.eposta), metin = `Merhaba${u.ad ? ' ' + u.ad : ''}, Saha Takip uygulamasına davetlisin. Bağlantıyı aç, ${u.eposta} adresinle bir şifre belirleyip "Hesap oluştur"a dokun:\n${l}`;
      const kutu = k.querySelector('[data-link]'); kutu.hidden = false;
      kutu.innerHTML = `<input readonly value="${esc(l)}" aria-label="Davet bağlantısı"><div class="btnrow"><button type="button" class="btn sm" data-kopya>Kopyala</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink('', metin)}">WhatsApp ile gönder</a><a class="btn sm ghost" href="mailto:${esc(u.eposta)}?subject=${encodeURIComponent('Saha Takip daveti')}&body=${encodeURIComponent(metin)}">E-posta</a></div>
        <p class="hint">Bağlantı yalnızca uygulamanın adresini ve veritabanı adresini içerir; şifre içermez. Kişi kendi şifresini belirler ve sadece yetki verdiğin bölümleri görür.</p>`;
      kutu.querySelector('[data-kopya]').onclick = async () => { try { await navigator.clipboard.writeText(l); toast('Bağlantı kopyalandı.'); } catch { kutu.querySelector('input').select(); } };
    };
  });
}
function modulTablosu(id, secim) {
  return `<table class="tbl yetki-tbl"><thead><tr><th>Bölüm</th><th>Yetki</th></tr></thead><tbody>${MODULLER.map(m => `<tr><td>${esc(m.ad)}</td><td><select data-m="${m.k}" aria-label="${esc(m.ad)} yetkisi">${SEVIYE.map(([v, t]) => `<option value="${v || ''}" ${(secim[m.k] || null) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`;
}
const secimOku = kok => Object.fromEntries([...kok.querySelectorAll('select[data-m]')].map(s => [s.dataset.m, s.value || null]));
const rolEkle = (y, rol) => { const r = String(rol || '').trim(); return r ? { ...y, _rol: r.slice(0, 40) } : y; };
function uyeKarti(u) {
  const secim = modulSecimi(u.yetkiler);
  const ozet = MODULLER.filter(m => secim[m.k]).map(m => m.ad + (secim[m.k] === 'yaz' ? '' : ' (görür)')).join(', ');
  return `<details class="uye" data-uye="${esc(u.eposta)}"><summary><span class="uye-ad"><b>${esc(u.ad || u.eposta)}</b><em class="rol-r" ${rolAl(u) ? '' : 'hidden'}>${esc(rolAl(u))}</em><small class="muted">${esc(u.eposta)}${u.aktif ? '' : ' · pasif'}</small></span><small class="muted">${esc(ozet || 'yetki yok')}</small></summary>
    <div class="grid"><div class="fld"><label>Ad</label><input data-ad value="${esc(u.ad || '')}"></div><div class="fld"><label>Rol / ünvan</label>${rolSecici(rolAl(u))}</div><div class="fld is-chk"><label class="chk"><input type="checkbox" data-aktif ${u.aktif ? 'checked' : ''}> <span>Erişimi açık</span></label></div></div>
    ${modulTablosu(u.id, secim)}
    <div class="btnrow"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button><button type="button" class="btn sm" data-davet>Davet bağlantısı</button><button type="button" class="btn sm ghost danger" data-sil>Çıkar</button></div>
    <div data-link class="davet-kutu" hidden></div></details>`;
}
