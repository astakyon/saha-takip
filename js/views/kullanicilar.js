// Kullanıcılar ve yetkiler (yalnızca veri sahibi görür): ekip üyesi ekleme, bölüm bazında yetki, davet bağlantısı
import { getConfig } from '../db.js';
import { app } from '../state.js';
import { esc, toast, confirmBox, waLink } from '../ui.js';
import { EKRANLAR, GIZLENEBILIR, ekranSecimi, ekranTablolari, yetkiNesnesi, onizlemeBaslat } from '../yetki.js';
import { BASLIKLAR, SEKME_AD } from '../basliklar.js';
import { kullaniciAdiKaydet, adNormal, kullaniciAdiGecerli } from '../giris.js';

// Kişinin rolü (Bayi, Ekip arkadaşı…) yetkiler içindeki “_rol” anahtarında saklanır; veritabanı yetki kontrolü bu anahtarı kullanmaz.
export const ROLLER = ['Bayi', 'Ekip arkadaşı', 'Satış temsilcisi', 'Yönetici', 'Proje firması', 'Elektrik müteahhidi', 'Diğer'];
export const rolAl = u => u?.yetkiler?._rol || '';
const rolListesi = () => '';
// Rol seçimi: liste + “Başka…” (serbest yazı)
const rolSecici = (deger, id = '') => { const v = deger || ''; const ozel = v && !ROLLER.includes(v); return `<div class="rol-sec"><select data-rolsec ${id ? `id="${id}"` : ''} aria-label="Rol"><option value="">Rol seç</option>${ROLLER.map(r => `<option ${r === v ? 'selected' : ''}>${r}</option>`).join('')}<option value="__baska" ${ozel ? 'selected' : ''}>Başka (yaz)…</option></select><input data-rolyaz placeholder="Rolü yaz" value="${ozel ? v.replace(/"/g, '&quot;') : ''}" ${ozel ? '' : 'hidden'} maxlength="40"></div>`; };
const rolOku = kok => { const s = kok.querySelector('[data-rolsec]'); return s.value === '__baska' ? kok.querySelector('[data-rolyaz]').value.trim() : s.value; };
const rolBagla = kok => kok.querySelectorAll('[data-rolsec]').forEach(s => s.onchange = () => { const i = s.parentElement.querySelector('[data-rolyaz]'); i.hidden = s.value !== '__baska'; if (!i.hidden) i.focus(); });
const TUM = Object.keys(EKRANLAR);
const HAZIR = {
  'Bayi': { e: { urunler: 'yaz', bayi: 'yaz', katalog: 'oku', araclar: 'oku', siparisler: 'oku', projeler: 'oku', firmalar: 'oku', harita: 'oku' }, g: [] },
  'Saha ekibi': { e: { harita: 'oku', bolgeler: 'oku', projeler: 'yaz', firmalar: 'yaz', kisiler: 'yaz', takvim: 'yaz', ziyaretler: 'yaz', gorevler: 'yaz', numuneler: 'yaz', servis: 'yaz', katalog: 'oku', araclar: 'oku', referanslar: 'oku', dosyalar: 'yaz' }, g: [] },
  'Proje firması': { e: { projeler: 'oku', referanslar: 'oku', katalog: 'oku', araclar: 'oku' }, g: ['tutar', 'iletisim', 'yorum', 'iliski'] },
  'Sadece görüntüleme': { e: { harita: 'oku', projeler: 'oku', firmalar: 'oku', kisiler: 'oku', takvim: 'oku', ziyaretler: 'oku' }, g: [] },
  'Tam yetki': { e: Object.fromEntries(TUM.map(k => [k, EKRANLAR[k].salt ? 'oku' : 'yaz'])), g: [] },
};
const HAZIR_ROL = { 'Bayi': 'Bayi', 'Saha ekibi': 'Ekip arkadaşı', 'Proje firması': 'Proje firması', 'Sadece görüntüleme': 'Yönetici', 'Tam yetki': 'Ekip arkadaşı' };
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
  const KAD = new Map(); let kadVar = true;
  try { const r = await app.db.c.from('kullanici_adlari').select('ad,eposta'); if (r.error) throw r.error; for (const x of r.data || []) KAD.set(x.eposta.toLowerCase(), x.ad); } catch { kadVar = false; }
  for (const u of uyeler) u._kad = KAD.get(u.eposta.toLowerCase()) || '';
  root.innerHTML = `<p>Eklediğin kişi bu e-postayla giriş yaptığında <b>yalnızca açtığın ekranları</b> görür. Her ekran için <b>Kapalı</b>, <b>Görür</b> ya da <b>Düzenler</b> seç. Kapalı ekranın kayıtları, fotoğrafları ve belgeleri kişinin telefonuna hiç gönderilmez. Senin ayarlarını, kullanıcı listesini ve Veri kontrolünü hiçbir üye görmez. Kaydettikten sonra <b>Bu kişi gibi gör</b> ile kişinin ekranını kendi telefonunda deneyebilirsin.</p>
    ${rolListesi()}<div class="uyeler">${uyeler.slice().sort((a, b) => rolAl(a).localeCompare(rolAl(b), 'tr') || (a.ad || a.eposta).localeCompare(b.ad || b.eposta, 'tr')).map(u => uyeKarti(u, kadVar)).join('') || '<p class="hint">Henüz kimse eklenmedi.</p>'}</div>
    <details class="card-ic" ${uyeler.length ? '' : 'open'}><summary><b>Kişi ekle</b></summary>
      <form class="form" data-yeni><div class="grid"><div class="fld"><label for="ku-e">E-posta</label><input id="ku-e" type="email" required placeholder="ornek@firma.com"></div><div class="fld"><label for="ku-a">Ad</label><input id="ku-a" placeholder="Örn. Ali (Bayi)"></div>${kadVar ? '<div class="fld"><label for="ku-k">Kullanıcı adı (isteğe bağlı)</label><input id="ku-k" autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. ali.drv"><small>Kişi girişte e-posta yerine bunu yazabilir.</small></div>' : ''}<div class="fld"><label for="ku-r">Rol / ünvan</label>${rolSecici('', 'ku-r')}</div></div>
      <div class="fld"><label>Hazır şablon</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
      ${yetkiDuzeni({})}
      <div class="btnrow"><button type="submit" class="btn primary">Ekle ve davet bağlantısı oluştur</button></div></form></details>`;
  rolBagla(root);
  import('../guvenlik.js').then(async g => {
    const sg = await g.sonGirisler();
    root.querySelectorAll('[data-uye]').forEach(k => { const s = k.querySelector('[data-songiris]'); if (!s) return; if (!sg) { s.remove(); return; } s.textContent = g.sonGirisMetni(sg[k.dataset.uye.toLowerCase()]); });
    if (!sg && uyeler.length) root.querySelector('.uyeler')?.insertAdjacentHTML('afterend', '<p class="hint">Son giriş tarihlerini görmek için Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 11).</p>');
  });
  app.db.c.rpc('yetki_surum').then(({ data, error }) => { if (error || (data || 0) < 15) root.insertAdjacentHTML('afterbegin', '<p class="warn">Sunucu kuralları eski: kapalı ekranların fotoğrafları, belgeleri ve ayarları ekip üyesine hâlâ açılabilir. Supabase SQL Editor\'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 15).</p>'); }, () => {});
  const yeni = root.querySelector('[data-yeni]');
  yeni.querySelectorAll('[data-hazir]').forEach(b => b.onclick = () => { const h = HAZIR[b.dataset.hazir]; secimYaz(yeni, h.e, h.g); const r = yeni.querySelector('#ku-r'); if (!rolOku(yeni) && HAZIR_ROL[b.dataset.hazir]) { r.value = HAZIR_ROL[b.dataset.hazir]; r.dispatchEvent(new Event('change')); } yeni.querySelectorAll('[data-hazir]').forEach(x => x.classList.toggle('on', x === b)); });
  yetkiBagla(yeni);
  yeni.onsubmit = async e => {
    e.preventDefault();
    const eposta = yeni.querySelector('#ku-e').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(eposta)) return toast('Geçerli bir e-posta yaz.', 'err');
    if (eposta === (app.db.user()?.email || '').toLowerCase()) return toast('Kendini ekleyemezsin; sen zaten veri sahibisin.', 'err');
    const secim = secimOku(yeni); if (!Object.values(secim).some(Boolean)) return toast('En az bir ekranı aç (Görür ya da Düzenler).', 'err');
    const { error } = await app.db.c.from('ekip_uyeleri').insert({ eposta, ad: yeni.querySelector('#ku-a').value.trim() || null, yetkiler: yetkiOku(yeni, secim), aktif: true });
    if (error) return toast(/duplicate|unique/i.test(error.message) ? 'Bu e-posta zaten ekli.' : 'Eklenemedi: ' + error.message, 'err');
    const kh = await kadKaydet(eposta, yeni.querySelector('#ku-k')?.value, ''); if (kh) toast(kh, 'err');
    toast('Kişi eklendi. Davet bağlantısını gönder.'); await kullaniciAyarlari(root); root.querySelector(`[data-uye="${CSS.escape(eposta)}"] [data-davet]`)?.click();
  };
  root.querySelectorAll('[data-uye]').forEach(k => {
    const u = uyeler.find(x => x.eposta === k.dataset.uye);
    k.querySelector('[data-kaydet]').onclick = async () => {
      const { error } = await app.db.c.from('ekip_uyeleri').update({ ad: k.querySelector('[data-ad]').value.trim() || null, aktif: k.querySelector('[data-aktif]').checked, yetkiler: yetkiOku(k) }).eq('id', u.id);
      if (!error && k.querySelector('[data-kad]')) { const kh = await kadKaydet(u.eposta, k.querySelector('[data-kad]').value, u._kad); if (kh) return toast(kh, 'err'); u._kad = adNormal(k.querySelector('[data-kad]').value); }
      if (!error) { const y = rolOku(k); const rb = k.querySelector('.rol-r'); if (rb) { rb.textContent = y; rb.hidden = !y; } }
      toast(error ? 'Kaydedilemedi: ' + error.message : 'Yetkiler kaydedildi. Kişi uygulamayı yeniden açınca geçerli olur.', error ? 'err' : '');
    };
    yetkiBagla(k);
    k.querySelectorAll('[data-hazir]').forEach(b => b.onclick = () => { const h = HAZIR[b.dataset.hazir]; secimYaz(k, h.e, h.g); k.querySelectorAll('[data-hazir]').forEach(x => x.classList.toggle('on', x === b)); });
    k.querySelector('[data-onizle]').onclick = () => { if (!confirmBox(`${u.ad || u.eposta} bu ayarlarla ne görüyor, bunu kendi telefonunda göreceksin. Önizlemede değişiklik kaydedilmez; alttaki düğmeyle çıkarsın. Başlansın mı?`)) return; onizlemeBaslat({ ...u, yetkiler: yetkiOku(k) }); };
    k.querySelector('[data-sil]').onclick = async () => { if (!confirmBox(`${u.eposta} kullanıcılardan çıkarılsın mı? Artık verilerini göremez.`)) return; await app.db.c.from('ekip_uyeleri').delete().eq('id', u.id); toast('Kullanıcı çıkarıldı.'); kullaniciAyarlari(root); };
    k.querySelector('[data-davet]').onclick = () => {
      const l = davetLinki(u.eposta), metin = `Merhaba${u.ad ? ' ' + u.ad : ''}, Saha Takip uygulamasına davetlisin.\n1) Bu bağlantıyı telefonunda aç: ${l}\n2) "İlk giriş" sekmesinde ${u.eposta} adresin için kendine bir şifre belirle.\n3) E-postana onay bağlantısı gelirse ona dokun.\nSonraki girişlerde ${u._kad ? `kullanıcı adın "${u._kad}" ya da ` : ''}e-postan ve şifrenle girersin. Şifreni unutursan giriş ekranındaki "Şifremi unuttum"u kullan.`;
      const kutu = k.querySelector('[data-link]'); kutu.hidden = false;
      kutu.innerHTML = `<input readonly value="${esc(l)}" aria-label="Davet bağlantısı"><div class="btnrow"><button type="button" class="btn sm" data-kopya>Kopyala</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink('', metin)}">WhatsApp ile gönder</a><a class="btn sm ghost" href="mailto:${esc(u.eposta)}?subject=${encodeURIComponent('Saha Takip daveti')}&body=${encodeURIComponent(metin)}">E-posta</a></div>
        <p class="hint">Bağlantı yalnızca uygulamanın adresini ve veritabanı adresini içerir; şifre içermez. Kişi kendi şifresini belirler ve sadece yetki verdiğin bölümleri görür.</p>`;
      kutu.querySelector('[data-kopya]').onclick = async () => { try { await navigator.clipboard.writeText(l); toast('Bağlantı kopyalandı.'); } catch { kutu.querySelector('input').select(); } };
    };
  });
}
// ---------- Ekran ağacı: başlık → ekranlar, her biri Kapalı / Görür / Düzenler ----------
const GRUPLAR = BASLIKLAR.map(b => ({ ...b, r: b.r.filter(r => EKRANLAR[r]) })).filter(b => b.r.length);
const seg3 = (k, v) => `<span class="seg3" role="group" data-ek="${k}" aria-label="${esc(SEKME_AD[k] || k)}">${[['', 'Kapalı'], ['oku', 'Görür'], ...(EKRANLAR[k]?.salt ? [] : [['yaz', 'Düzenler']])].map(([d, t]) => `<button type="button" data-v="${d}" class="${(v || '') === d ? 'on' : ''}" aria-pressed="${(v || '') === d}">${t}</button>`).join('')}</span>`;
const grupSeg = g => `<span class="seg3" role="group" data-grup="${g.k}" aria-label="${esc(g.t)} tümü">${[['', 'Hepsi kapalı'], ['oku', 'Görür'], ['yaz', 'Düzenler']].map(([d, t]) => `<button type="button" data-v="${d}">${t}</button>`).join('')}</span>`;
function yetkiDuzeni(y) {
  const secim = ekranSecimi(y), gizli = y?._gizli || [];
  return `<div class="fld"><label>Hangi ekranları görsün?</label>
    <p class="hint">Kapalı ekran kişinin menüsünde, aramasında, + menüsünde ve diğer ekranların içinde hiç görünmez; verisi telefonuna gelmez. Bugün ekranı ve kendi Ayarlar'ı herkeste açıktır, içinde yalnızca açık ekranların kayıtları görünür.</p>
    <div class="ekran-agac">${GRUPLAR.map(g => `<details data-g="${g.k}"><summary><b>${esc(g.t)}</b><small data-gsay></small></summary>
      <div class="ek-satir"><span><b>Tümü</b></span>${grupSeg(g)}</div>
      ${g.r.map(r => `<div class="ek-satir"><span>${esc(SEKME_AD[r] || r)}</span><small>${esc(EKRANLAR[r].d || '')}</small>${seg3(r, secim[r])}</div>`).join('')}</details>`).join('')}</div></div>
    <div class="fld"><label>Açık ekranlarda da gizlensin</label>${GIZLENEBILIR.map(x => `<label class="chk"><input type="checkbox" data-gz="${x.k}" ${gizli.includes(x.k) ? 'checked' : ''}> <span><b>${esc(x.ad)}</b><small class="muted"> · ${esc(x.d)}</small></span></label>`).join('')}</div>
    ${disaKutusu(y?._disa === true)}<p class="hint">Kapalıyken kişi ekranda görebildiği kayıtları Excel'e ya da sunuma aktaramaz. Yedek alma her zaman yalnızca sende.</p>
    <div class="yetki-ozet" data-yozet aria-live="polite"></div>`;
}
const secimOku = kok => Object.fromEntries([...kok.querySelectorAll('[data-ek]')].map(s => [s.dataset.ek, s.querySelector('button.on')?.dataset.v || null]).filter(([, v]) => v));
const gizliOku = kok => [...kok.querySelectorAll('[data-gz]:checked')].map(i => i.dataset.gz);
const yetkiOku = (kok, secim = secimOku(kok)) => yetkiNesnesi(secim, { rol: rolOku(kok), disa: kok.querySelector('[data-disa]')?.checked, gizli: gizliOku(kok) });
function secimYaz(kok, e, g) {
  kok.querySelectorAll('[data-ek]').forEach(s => { const v = e[s.dataset.ek] || ''; s.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-pressed', b.dataset.v === v); }); });
  if (g) kok.querySelectorAll('[data-gz]').forEach(i => i.checked = g.includes(i.dataset.gz));
  ozetYaz(kok);
}
const TABLO_AD = { projeler: 'Projeler', proje_gecmis: 'Proje durum geçmişi', firmalar: 'Firmalar', kisiler: 'Kişiler', ziyaretler: 'Ziyaretler', gorevler: 'Görevler', bolgeler: 'Sanayi bölgeleri', siparisler: 'Siparişler', hedefler: 'Hedefler', teklifler: 'Teklifler', urunler: 'Stok ve fiyatlar', stok_gecmis: 'Stok geçmişi', urun_aileleri: 'Ürün aileleri', rakip_fiyatlar: 'Rakip fiyatları', tahsilatlar: 'Tahsilat', numuneler: 'Numuneler', servis_kayitlari: 'Servis kayıtları', masraflar: 'Masraflar', belgeler: 'Dosyalar' };
function ozetYaz(kok) {
  const secim = secimOku(kok), kutu = kok.querySelector('[data-yozet]'); if (!kutu) return;
  kok.querySelectorAll('details[data-g]').forEach(d => { const rs = [...d.querySelectorAll('[data-ek]')], acik = rs.filter(s => secim[s.dataset.ek]).length; d.querySelector('[data-gsay]').textContent = acik ? `${acik}/${rs.length} açık` : 'kapalı'; });
  const ad = k => SEKME_AD[k] || k, tum = Object.keys(EKRANLAR);
  const yaz = tum.filter(k => secim[k] === 'yaz'), oku = tum.filter(k => secim[k] === 'oku'), kapali = tum.filter(k => !secim[k]);
  const tablolar = ekranTablolari(secim), tl = Object.entries(tablolar);
  const g = gizliOku(kok).map(k => GIZLENEBILIR.find(x => x.k === k)?.ad).filter(Boolean);
  kutu.innerHTML = !yaz.length && !oku.length ? '<b>Henüz hiçbir ekran açık değil.</b> Kişi giriş yapınca yalnızca boş bir Bugün ekranı görür.'
    : `${yaz.length ? `<div><b>Düzenler:</b> ${esc(yaz.map(ad).join(', '))}</div>` : ''}${oku.length ? `<div><b>Yalnızca görür:</b> ${esc(oku.map(ad).join(', '))}</div>` : ''}
      <div class="kapali"><b>Hiç görmez:</b> ${esc(kapali.map(ad).join(', ') || '—')}, Veri kontrolü, kullanıcılar ve senin ayarların</div>
      ${g.length ? `<div><b>Ayrıca gizli:</b> ${esc(g.join(', '))}</div>` : ''}
      <details><summary>Telefonuna gelen kayıtlar (${tl.length})</summary><p class="hint">Açık ekranların çalışması için gereken kayıtlar sunucudan bu kişiye gönderilir; listede olmayanlar hiçbir şekilde gönderilmez.</p>${esc(tl.map(([t, v]) => (TABLO_AD[t] || t) + (v === 'yaz' ? ' (düzenler)' : ' (görür)')).join(', '))}</details>`;
}
function yetkiBagla(kok) {
  kok.querySelectorAll('[data-ek] button').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); kok.querySelectorAll('[data-hazir]').forEach(x => x.classList.remove('on')); ozetYaz(kok); });
  kok.querySelectorAll('[data-grup] button').forEach(b => b.onclick = () => {
    const d = b.closest('details'); d.querySelectorAll('[data-ek]').forEach(s => { const v = b.dataset.v === 'yaz' && EKRANLAR[s.dataset.ek]?.salt ? 'oku' : b.dataset.v; s.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.v === v); x.setAttribute('aria-pressed', x.dataset.v === v); }); });
    ozetYaz(kok);
  });
  kok.querySelectorAll('[data-gz]').forEach(i => i.onchange = () => ozetYaz(kok));
  ozetYaz(kok);
}
const disaKutusu = v => `<label class="chk"><input type="checkbox" data-disa ${v ? 'checked' : ''}> <span>Excel'e aktarabilir ve sunum çıktısı alabilir</span></label>`;
// Kullanıcı adı değiştiyse kaydeder; hata metni döner
async function kadKaydet(eposta, deger, eski) {
  const ad = adNormal(deger || '');
  if (ad === (eski || '')) return null;
  if (!ad) { await app.db.c.from('kullanici_adlari').delete().eq('eposta', eposta.toLowerCase()); return null; }
  if (!kullaniciAdiGecerli(ad)) return 'Kullanıcı adı 3–30 karakter olmalı: küçük harf, rakam, nokta, tire.';
  return kullaniciAdiKaydet(eposta, ad);
}
function uyeKarti(u, kadVar) {
  const secim = ekranSecimi(u.yetkiler);
  const ozet = Object.keys(EKRANLAR).filter(k => secim[k]).map(k => (SEKME_AD[k] || k) + (secim[k] === 'yaz' ? '' : ' (görür)')).join(', ');
  return `<details class="uye" data-uye="${esc(u.eposta)}"><summary><span class="uye-ad"><b>${esc(u.ad || u.eposta)}</b><em class="rol-r" ${rolAl(u) ? '' : 'hidden'}>${esc(rolAl(u))}</em><small class="muted">${esc(u.eposta)}${u.aktif ? '' : ' · pasif'} · <span data-songiris>…</span></small></span><small class="muted">${esc(ozet || 'yetki yok')}</small></summary>
    <div class="grid"><div class="fld"><label>Ad</label><input data-ad value="${esc(u.ad || '')}"></div>${kadVar ? `<div class="fld"><label>Kullanıcı adı</label><input data-kad autocapitalize="none" spellcheck="false" maxlength="30" placeholder="ör. ali.drv" value="${esc(u._kad || '')}"></div>` : ''}<div class="fld"><label>Rol / ünvan</label>${rolSecici(rolAl(u))}</div><div class="fld is-chk"><label class="chk"><input type="checkbox" data-aktif ${u.aktif ? 'checked' : ''}> <span>Erişimi açık</span></label></div></div>
    <div class="fld"><label>Hazır şablon</label><div class="chips">${Object.keys(HAZIR).map(h => `<button type="button" class="chip" data-hazir="${h}">${h}</button>`).join('')}</div></div>
    ${yetkiDuzeni(u.yetkiler)}
    <div class="btnrow"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button><button type="button" class="btn sm" data-davet>Davet bağlantısı</button><button type="button" class="btn sm ghost" data-onizle>Bu kişi gibi gör</button><button type="button" class="btn sm ghost danger" data-sil>Çıkar</button></div>
    <div data-link class="davet-kutu" hidden></div></details>`;
}
