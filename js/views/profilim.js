// Profilim: giriş yapan kişinin kartı (kim olarak girdin, rolün, şirketin), kişisel bilgilerin, giriş ve güvenlik, çıkış.
// Şirket profilinden ayrıdır: buradaki bilgiler yalnızca seni ilgilendirir ve hesabında saklanır.
import { app } from '../state.js';
import { esc, toast, confirmBox, waLink } from '../ui.js';
import { sahipMi, EKRANLAR, GIZLENEBILIR, ekranSecimi } from '../yetki.js';
import { SEKME_AD } from '../basliklar.js';
import { benBilgisi, basHarfleri } from '../ben.js';
import { ayar } from '../ayar.js';

const zaman = t => t ? new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export async function cikisSor() {
  if (app.db.mode !== 'supabase') return toast('Deneme modunda giriş yok; çıkış gerekmez.');
  const bekleyen = await app.db.pending?.().catch(() => 0) || 0;
  if (!confirmBox(`Bu cihazda çıkış yapılsın mı?${bekleyen ? `\n\n${bekleyen} kayıt henüz buluta gönderilmedi; silinmez, yeniden girince gönderilir.` : ''}\n\nTekrar girmek için kullanıcı adın ve şifren gerekir.`)) return;
  (await import('../guvenlik.js')).oturumuKapat('Çıkış yaptın. Tekrar görüşmek üzere.');
}

export async function profilimView(el) {
  const b = benBilgisi(), sup = !b.yerel, sahip = sahipMi(), y = app.yetki || {};
  const { profil } = await import('../profil.js'); const p = profil();
  const sirket = (app.db?.sirketler || []).find(s => s.secili)?.ad || p.firma || '';
  const satir = (dt, dd) => dd ? `<dt>${dt}</dt><dd>${dd}</dd>` : '';
  el.innerHTML = `<div class="fs-sayfa pr-sayfa">
    <section class="card pr-kart"><div class="pr-ust"><span class="pr-av" aria-hidden="true">${esc(basHarfleri(b.ad))}</span>
      <div class="pr-kim"><p class="muted">Profilim · giriş yapan</p><h1 data-prad>${esc(b.ad)}</h1>${b.unvan ? `<p class="pr-unvan">${esc(b.unvan)}</p>` : ''}
        <div class="chips"><em class="rol-r">${esc(b.rol)}</em>${sirket ? `<a class="pr-sirket" href="#/sirket">${esc(sirket)} ›</a>` : ''}</div></div></div>
      <dl class="profil-dl pr-dl">${satir('Kullanıcı adı', b.kad ? `<b>${esc(b.kad)}</b>` : '')}${satir('Giriş e-postası', esc(b.eposta))}${satir('Telefon', b.telefon ? `<a href="tel:${esc(b.telefon)}">${esc(b.telefon)}</a>` : '')}${satir('İletişim e-postası', esc(b.iletisim))}${sup ? satir('Bu girişin zamanı', zaman(b.sonGiris)) : ''}</dl>
      ${sup ? '' : '<p class="hint">Deneme modundasın: giriş yok, veriler yalnızca bu tarayıcıda. Bulut bağlantısını Ayarlar → Hesap\'tan kurarsın.</p>'}
      <div class="btnrow pr-btn">${b.telefon || b.iletisim || b.eposta ? '<button type="button" class="btn sm" data-kartvizit>Kartvizitimi gönder</button>' : ''}${sup ? '<button type="button" class="btn sm ghost danger" data-cikis>Çıkış yap</button>' : '<a class="btn sm" href="#/ayarlar">Bulut bağlantısı</a>'}</div></section>

    <div class="pr-izgara">
    <section class="card"><h2>Bilgilerim</h2><p class="hint">Yalnızca seninle ilgili: teklif ve mesajlarda adın, ünvanın ve imzan olarak kullanılır. Şirket bilgileri Şirket profilinde.</p>
      <form class="form" data-bilgi novalidate><div class="grid">
        <div class="fld"><label for="pr-ad">Ad soyad</label><input id="pr-ad" value="${esc(b.meta.ad || (!sahip && y.ad) || '')}" placeholder="ör. Ali Yılmaz" autocomplete="name" ${sup ? '' : 'disabled'}></div>
        <div class="fld"><label for="pr-un">Ünvan</label><input id="pr-un" value="${esc(b.unvan)}" placeholder="ör. Bölge satış sorumlusu" ${sup ? '' : 'disabled'}></div>
        <div class="fld"><label for="pr-tel">Telefon</label><input id="pr-tel" type="tel" inputmode="tel" value="${esc(b.telefon)}" autocomplete="tel" ${sup ? '' : 'disabled'}></div>
        <div class="fld"><label for="pr-ep">İletişim e-postası</label><input id="pr-ep" type="email" value="${esc(b.iletisim || b.eposta)}" autocomplete="email" ${sup ? '' : 'disabled'}><small>Kartvizitte görünür; girişi değiştirmez.</small></div>
        <div class="fld wide"><label for="pr-im">İmza <span class="muted">(mesajların sonunda {benim})</span></label><input id="pr-im" value="${esc(b.imza || ayar('benim_adim') || '')}" placeholder="ör. Ali Yılmaz · Bölge satış sorumlusu" ${sup ? '' : 'disabled'}></div></div>
        ${sup ? '<div class="btnrow"><button type="submit" class="btn primary">Kaydet</button></div>' : ''}</form></section>

    <section class="card"><h2>Ne görebilirim?</h2><div data-yetkim>${yetkim(sahip, y)}</div></section>
    </div>
    ${sup ? `<section class="card"><h2>Giriş ve şifre</h2><div data-girisayar><p class="hint">Yükleniyor…</p></div></section>
    <section class="card"><h2>Güvenlik</h2><div data-guvenlik></div></section>
    <section class="card pr-cikis"><h2>Çıkış</h2><p>Bu cihazdan çıkınca kayıtların telefondaki kopyası silinir; gönderilmeyi bekleyen kayıtlar korunur. Tekrar girince veriler buluttan iner.</p>
      <div class="btnrow"><button type="button" class="btn danger" data-cikis>Bu cihazda çıkış yap</button></div><p class="hint">Telefonun kaybolduysa başka bir cihazdan girip Güvenlik → <b>Tüm cihazlarda çıkış yap</b>'ı kullan.</p></section>` : ''}
  </div>`;
  el.querySelectorAll('[data-cikis]').forEach(x => x.onclick = cikisSor);
  el.querySelector('[data-kartvizit]')?.addEventListener('click', () => {
    const g = benBilgisi(), metin = [g.ad, g.unvan, sirket, g.telefon ? 'Tel: ' + g.telefon : '', (g.iletisim || g.eposta) ? 'E-posta: ' + (g.iletisim || g.eposta) : ''].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ title: g.ad, text: metin }).catch(() => {}); else window.open(waLink('', metin), '_blank', 'noopener');
  });
  const f = el.querySelector('[data-bilgi]');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); if (!sup) return;
    const v = id => f.querySelector(id).value.trim();
    const ep = v('#pr-ep').toLowerCase(); if (ep && !/^\S+@\S+\.\S+$/.test(ep)) return toast('E-posta geçersiz.', 'err');
    const yeni = { ...b.meta, ad: v('#pr-ad') || null, unvan: v('#pr-un') || null, telefon: v('#pr-tel') || null, iletisim_eposta: ep && ep !== b.eposta ? ep : null, imza: v('#pr-im') || null };
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const { data, error } = await app.db.c.auth.updateUser({ data: yeni });
      if (error) return toast('Kaydedilemedi: ' + error.message, 'err');
      const u = data?.user || app.db.user(); if (u) { u.user_metadata = { ...(u.user_metadata || {}), ...yeni }; if (app.db.session?.user) app.db.session.user.user_metadata = u.user_metadata; }
      toast('Bilgilerin kaydedildi.'); window.dispatchEvent(new CustomEvent('menu')); profilimView(el);
    } finally { if (btn.isConnected) btn.disabled = false; }
  };
  if (sup) {
    (await import('../giris.js')).hesapGirisAyarlari(el.querySelector('[data-girisayar]'));
    import('../guvenlik.js').then(m => m.guvenlikAyarlari(el.querySelector('[data-guvenlik]')));
  }
}

// Kişinin kendi yetkileri: hangi ekranları düzenler, hangilerini görür
function yetkim(sahip, y) {
  if (app.db?.mode !== 'supabase') return '<p class="hint">Deneme modunda her şey açık.</p>';
  if (sahip) return `<p><b>Her ekranı görür ve düzenlersin.</b> ${y.sirket_yoneticisi ? 'Şirket yöneticisisin' : 'Şirketin kurucususun'}: kullanıcıları, rolleri ve şirket ayarlarını yönetirsin.</p><div class="btnrow"><a class="btn sm ghost" href="#/sirket/ekip">Kullanıcılar ve roller</a></div>`;
  const s = ekranSecimi(y.yetkiler || {}), tum = Object.keys(EKRANLAR), ad = k => esc(SEKME_AD[k] || k);
  const yaz = tum.filter(k => s[k] === 'yaz'), oku = tum.filter(k => s[k] === 'oku');
  const kp = { ekip: 'Ekibinin kayıtları', kendi: 'Yalnızca sorumlusu olduğun kayıtlar' }[y.yetkiler?._kapsam] || (y.dis ? 'Firmanın yer aldığı projeler' : 'Şirketin bütün kayıtları');
  const gz = (y.yetkiler?._gizli || []).map(k => GIZLENEBILIR.find(x => x.k === k)?.ad).filter(Boolean);
  return `<div class="rol-kutu">${yaz.length ? `<div class="rk-satir"><span>Düzenler</span><div class="chips">${yaz.map(k => `<em class="ck yaz">${ad(k)}</em>`).join('')}</div></div>` : ''}
    ${oku.length ? `<div class="rk-satir"><span>Görür</span><div class="chips">${oku.map(k => `<em class="ck oku">${ad(k)}</em>`).join('')}</div></div>` : ''}
    <div class="rk-satir"><span>Kayıtlar</span><div>${esc(kp)}</div></div>${gz.length ? `<div class="rk-satir"><span>Gizli</span><div>${esc(gz.join(', '))}</div></div>` : ''}</div>
    <p class="hint">Başka bir ekran ya da yetki gerekiyorsa şirket yöneticinden iste.</p>`;
}
