// Geri bildirim: kullanıcı uygulamanın içinden "şu çalışmadı / şu olsa iyi olur" yazar, isterse ekran görüntüsü ekler.
// Bildirimler uygulama yöneticisinin (schema.sql → uygulama_yoneticileri) listesinde toplanır; ekran, sürüm ve telefon türü otomatik eklenir.
import { uuid, getConfig } from './db.js';
import { app, SURUM } from './state.js';
import { esc, toast, openDrawer, closeDrawer, pickFiles, confirmBox } from './ui.js';
import { profil } from './profil.js';

const TUR = [['hata', 'Bir şey çalışmadı'], ['oneri', 'Önerim var'], ['soru', 'Sorum var'], ['begendim', 'Beğendim']];
const tarayici = () => { const u = navigator.userAgent; return (/Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Diğer') + ' · ' + (/SamsungBrowser/.test(u) ? 'Samsung' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : '?') + (matchMedia('(display-mode: standalone)').matches ? ' · yüklü' : ''); };

export function geriBildirimAc() {
  const ekran = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'bugun');
  let tur = 'hata', foto = null;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Uygulamayı birlikte iyileştirelim</p><h2 id="drawer-title">Geri bildirim</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>
      <div class="chips" role="radiogroup" aria-label="Tür">${TUR.map(([k, t]) => `<button type="button" role="radio" class="chip ${k === tur ? 'on' : ''}" aria-checked="${k === tur}" data-tur="${k}">${t}</button>`).join('')}</div>
      <div class="fld"><label for="gb-m">Ne oldu, ne istersin?</label><textarea id="gb-m" rows="6" maxlength="4000" placeholder="Örn. Proje kaydederken hata verdi. / Teklifte iskonto alanı yukarıda olsa daha kolay olur."></textarea></div>
      <div class="fld"><label>Ekran görüntüsü (isteğe bağlı)</label><div class="btnrow"><button type="button" class="btn sm" data-foto>Görüntü ekle</button><span data-fotoad class="muted"></span></div></div>
      <p class="hint">Gönderilenle birlikte bulunduğun ekran (${esc(ekran)}), uygulama sürümü (${SURUM}) ve telefon türü eklenir. Kayıtlarının içeriği gönderilmez.</p>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Gönder</button></div></form>`);
  p.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { tur = b.dataset.tur; p.querySelectorAll('[data-tur]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); });
  p.querySelector('[data-foto]').onclick = async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (f) { foto = f; p.querySelector('[data-fotoad]').textContent = f.name; } };
  p.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const metin = p.querySelector('#gb-m').value.trim(); if (metin.length < 3) return toast('Birkaç kelimeyle anlat.', 'err');
    const b = p.querySelector('[type=submit]'); b.disabled = true;
    const kayit = { tur, metin, ekran, surum: SURUM, tarayici: tarayici(), firma: profil().firma || null };
    try {
      if (app.db.mode !== 'supabase') throw new Error('Deneme modunda geri bildirim gönderilemez; bulut bağlantısı gerekir.');
      if (foto) {
        const { shrink } = await import('./db.js');
        const yol = `${app.db.sahip || app.db.user().id}/geri/${uuid()}.jpg`;
        const blob = shrink ? await shrink(foto, 1600, 0.8) : foto;
        const { error } = await app.db.c.storage.from('fotograflar').upload(yol, blob, { contentType: 'image/jpeg' });
        if (!error) kayit.foto = yol;
      }
      const { error } = await app.db.c.from('geri_bildirim').insert(kayit);
      if (error) throw new Error(/does not exist|schema cache|Could not find/i.test(error.message) ? 'Sunucu henüz hazır değil (schema.sql sürüm 18).' : error.message);
      closeDrawer(); toast('Teşekkürler! Geri bildirimin iletildi.');
    } catch (err) { b.disabled = false; toast('Gönderilemedi: ' + err.message, 'err'); }
  };
}

// ---------- Yönetici: gelen geri bildirimler ve test davetleri ----------
export async function yoneticiMi() {
  if (app.db?.mode !== 'supabase') return false;
  try { const { data, error } = await app.db.c.rpc('yonetici_mi'); return !error && data === true; } catch { return false; }
}
export async function geriBildirimListesi(kok) {
  if (!kok) return;
  kok.innerHTML = '<p class="hint">Yükleniyor…</p>';
  const { data, error } = await app.db.c.from('geri_bildirim').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { kok.innerHTML = `<p class="warn">Okunamadı: ${esc(error.message)}</p>`; return; }
  let filtre = 'Yeni';
  const ciz = () => {
    const l = (data || []).filter(g => filtre === 'Tümü' || (g.durum || 'Yeni') === filtre);
    const say = d => (data || []).filter(g => (g.durum || 'Yeni') === d).length;
    kok.innerHTML = `<div class="seg" role="group" aria-label="Durum">${['Yeni', 'İnceleniyor', 'Tamam', 'Tümü'].map(d => `<button type="button" data-f="${d}" class="${filtre === d ? 'on' : ''}">${d}${d !== 'Tümü' ? ` (${say(d)})` : ''}</button>`).join('')}</div>
      ${l.length ? `<ul class="list gb-l">${l.map(g => `<li data-id="${g.id}"><span class="grow"><b>${esc(TUR.find(t => t[0] === g.tur)?.[1] || g.tur)}</b> <small class="muted">· ${esc(g.kim || '')}${g.firma ? ' (' + esc(g.firma) + ')' : ''} · ${new Date(g.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ekran ${esc(g.ekran || '')} · sürüm ${esc(g.surum || '')} · ${esc(g.tarayici || '')}</small>
        <span class="gb-m">${esc(g.metin).replace(/\n/g, '<br>')}</span></span>
        <span class="btnrow">${g.foto ? '<button type="button" class="btn sm ghost" data-gfoto>Görüntü</button>' : ''}<a class="btn sm ghost" href="mailto:${esc(g.kim || '')}?subject=${encodeURIComponent('Saha Takip geri bildiriminiz')}&body=${encodeURIComponent('Merhaba,\n\n“' + g.metin.slice(0, 300) + '”\n\n')}">Yanıtla</a>
          <select data-gd aria-label="Durum">${['Yeni', 'İnceleniyor', 'Tamam'].map(d => `<option ${(g.durum || 'Yeni') === d ? 'selected' : ''}>${d}</option>`).join('')}</select></span></li>`).join('')}</ul>` : '<p class="hint">Bu durumda geri bildirim yok.</p>'}`;
    kok.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; ciz(); });
    kok.querySelectorAll('[data-id]').forEach(li => {
      const g = data.find(x => x.id === li.dataset.id);
      li.querySelector('[data-gd]').onchange = async e => { const { error: er } = await app.db.c.from('geri_bildirim').update({ durum: e.target.value }).eq('id', g.id); if (er) return toast(er.message, 'err'); g.durum = e.target.value; ciz(); };
      li.querySelector('[data-gfoto]')?.addEventListener('click', async () => { const { data: u } = await app.db.c.storage.from('fotograflar').createSignedUrl(g.foto, 600); if (u?.signedUrl) window.open(u.signedUrl, '_blank', 'noopener'); else toast('Görüntü açılamadı.', 'err'); });
    });
  };
  ciz();
}
// Yeni hesap açtıracak test daveti (e-posta içermez; kişi "İlk giriş" ekranında kendi hesabını açar)
export function testDavetLinki() {
  const c = getConfig() || {};
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.origin + location.pathname + '?davet=' + b64(JSON.stringify({ u: c.url, k: c.key, y: 1 }));
}
export function testDavetKarti(kok) {
  if (!kok) return;
  const l = testDavetLinki();
  const metin = `Merhaba, geliştirdiğim saha satış uygulaması Saha Takip'i denemeni isterim.\n1) Bu bağlantıyı telefonunda aç: ${l}\n2) "İlk giriş" sekmesinde e-postanla kendine bir şifre belirle.\n3) Açılan kısa kurulumu tamamla.\nBir şey takılırsa ya da aklına bir öneri gelirse + menüsündeki "Geri bildirim"den yazman yeterli. Teşekkürler!`;
  kok.innerHTML = `<p class="hint">Bu bağlantıyı açan kişi bu veritabanında <b>kendi hesabını</b> açar; kendi verisini girer, başkasının verisini görmez. Test için ayrı bir Supabase projesi kullanman önerilir (README'de adımlar var).</p>
    <input readonly value="${esc(l)}" aria-label="Test davet bağlantısı">
    <div class="btnrow"><button type="button" class="btn sm" data-tk>Kopyala</button><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(metin)}">WhatsApp ile gönder</a></div>`;
  kok.querySelector('[data-tk]').onclick = async () => { try { await navigator.clipboard.writeText(l); toast('Kopyalandı.'); } catch { kok.querySelector('input').select(); } };
}
