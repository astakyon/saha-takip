// Şirket profili: ayarlardan bağımsız, geniş sayfa. Firma bilgileri, kayıt özeti ve ekip (ağaç + liste).
import { S } from '../db.js';
import { app } from '../state.js';
import { esc, toast, confirmBox, num } from '../ui.js';
import { ayarYaz } from '../ayar.js';
import { sahipMi } from '../yetki.js';

// Sekmeler: Genel · Ekip ve yetkiler · Mesaj ve teklif şablonları · Döviz kuru. Seçili sekme adreste: #/sirket/<sekme>
export async function sirketView(el) {
  const { profil, profilVar, SEKTOR, ESKI } = await import('../profil.js');
  const p = profil(), yetkili = sahipMi();
  const bugun = new Date(), ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1).toISOString().slice(0, 10);
  const acik = (S.projeler || []).filter(x => !['Sipariş', 'Kayıp', 'İptal'].includes(x.durum)).length;
  const kart = (ad, deger, alt = '') => `<div class="sk-sayi"><b>${deger}</b><span>${ad}</span>${alt ? `<small>${alt}</small>` : ''}</div>`;
  const SEKMELER = [['genel', 'Genel', true], ['ekip', 'Ekip ve yetkiler', yetkili], ['sablon', 'Mesaj ve teklif şablonları', yetkili], ['kur', 'Döviz kuru', true]].filter(x => x[2]);
  el.innerHTML = `<div class="fs-sayfa sk-sayfa"><header class="vh sk-bas"><div class="sk-kimlik"><span class="sk-logo" aria-hidden="true">${esc((p.firma || 'Ş').slice(0, 1).toLocaleUpperCase('tr'))}</span>
      <div><p class="muted">Şirket profili</p><h1>${esc(p.firma || 'Şirketin')}</h1><p class="sum">${esc([SEKTOR[p.sektor], p.marka ? 'Temsil: ' + p.marka : '', (p.iller || []).join(', ')].filter(Boolean).join(' · '))}</p></div></div>
      <div class="vh-act">${yetkili ? '<button class="btn primary" data-pduz>Profili düzenle</button>' : ''}</div></header>
    <div class="p-sekme fs-sekme" role="tablist" aria-label="Şirket profili bölümleri">${SEKMELER.map(([k, t]) => `<button type="button" role="tab" data-fsk="${k}" aria-selected="false">${t}</button>`).join('')}</div>

    <div class="fs-ic" data-fs="genel" role="tabpanel" hidden><div class="sk-izgara">
      <section class="card sk-profil"><h2>Bilgiler</h2>
        <dl class="profil-dl"><dt>Firma</dt><dd>${esc(p.firma || '—')}</dd><dt>Sektör</dt><dd>${esc(SEKTOR[p.sektor] || '—')}</dd>${p.marka ? `<dt>Temsil edilen marka</dt><dd>${esc(p.marka)}</dd>` : ''}
          <dt>Çalışılan iller</dt><dd>${esc((p.iller || []).join(', ') || '—')}</dd><dt>Ana bayi</dt><dd>${esc(p.bayi || '—')}</dd></dl>
        ${p.katalog === 'eae' || p.katalog === 'kendi' ? `<div class="fld"><label>Ürün kataloğu</label><div class="seg" role="group" aria-label="Ürün kataloğu"><button type="button" data-kat="eae" class="${p.katalog === 'eae' ? 'on' : ''}" ${yetkili ? '' : 'disabled'}>Hazır EAE kataloğu</button><button type="button" data-kat="kendi" class="${p.katalog === 'kendi' ? 'on' : ''}" ${yetkili ? '' : 'disabled'}>Kendi kataloğum</button></div><small class="muted">Hazır katalogda EAE ürün aileleri, ürün önerisi ve şartname karşılaştırması açıktır.</small></div>` : ''}
        <p class="hint">Bu bilgiler ekipteki herkes için geçerlidir. Rakip markaları ve diğer seçim listeleri Ayarlar → Listeler'de.</p></section>
      <section class="card sk-ozet"><h2>Kayıtlar</h2><div class="sk-sayilar">
        ${kart('Firma', num((S.firmalar || []).length))}${kart('Kişi', num((S.kisiler || []).length))}${kart('Açık proje', num(acik), 'toplam ' + num((S.projeler || []).length))}
        ${kart('Bu ay ziyaret', num((S.ziyaretler || []).filter(z => (z.tarih || '') >= ayBasi).length))}${kart('Teklif', num((S.teklifler || []).length))}${kart('Sipariş', num((S.siparisler || []).length))}</div></section>
      <section class="card sk-ekip" data-ekip><h2>Ekibim</h2><p class="hint">Yükleniyor…</p></section>
    </div></div>

    ${yetkili ? `<div class="fs-ic" data-fs="ekip" role="tabpanel" hidden>
      <section class="card"><h2>Kullanıcılar ve yetkiler</h2><div data-kullanici></div></section>
      <section class="card" data-sondeg></section>
    </div>
    <div class="fs-ic" data-fs="sablon" role="tabpanel" hidden><div class="sk-izgara">
      <section class="card"><h2>WhatsApp mesaj şablonları</h2><p class="hint">Kişi, firma ve proje sayfasındaki WhatsApp düğmesi bu şablonları kullanır.</p><div data-sablon></div></section>
      <section class="card"><h2>Teklif bilgileri</h2><p class="hint">PDF teklifin üst bilgisi ve alt koşulları.</p><div data-teklifb></div></section>
    </div></div>` : ''}

    <div class="fs-ic" data-fs="kur" role="tabpanel" hidden><section class="card sk-kur"><h2>Döviz kuru</h2><p class="hint">Tutarların TL ve USD karşılıkları bu kurla hesaplanır; ekipteki herkes aynı kuru görür.</p><div data-kur></div></section></div>
  </div>`;
  el.querySelector('[data-pduz]')?.addEventListener('click', async () => (await import('../sihirbaz.js')).sihirbazAc({ duzenle: true, sonra: () => { app.refresh?.(); } }));
  el.querySelectorAll('[data-kat]').forEach(b => b.onclick = async () => {
    if (b.classList.contains('on')) return;
    if (b.dataset.kat === 'kendi' && !confirmBox('Hazır EAE kataloğu, ürün önerisi ve şartname karşılaştırması kapatılsın mı? Kendi girdiğin ürün aileleri kalır.')) return;
    await ayarYaz('firma_profil', { ...(profilVar() ? profil() : ESKI), eski: undefined, katalog: b.dataset.kat }); toast('Kaydedildi.'); sirketView(el);
  });
  const { sekmeKur } = await import('../sayfa.js');
  sekmeKur(el, { taban: 'sirket', ilk: 'genel', sekme: location.hash.replace(/^#\/?/, '').split('/')[1], KUR: {
    genel: () => ekibim(el.querySelector('[data-ekip]'), p),
    ekip: async () => { (await import('./kullanicilar.js')).kullaniciAyarlari(el.querySelector('[data-kullanici]')); (await import('../gecmis.js')).sonDegisiklikler(el.querySelector('[data-sondeg]')); },
    sablon: async () => { (await import('../sablon.js')).sablonDuzenleyici(el.querySelector('[data-sablon]')); (await import('./teklif.js')).teklifAyarlari(el.querySelector('[data-teklifb]')); },
    kur: async () => (await import('../kur.js')).kurAyarlari(el.querySelector('[data-kur]')),
  } });
}

async function ekibim(kok, p) {
  if (app.db.mode !== 'supabase') { kok.innerHTML = '<h2>Ekibim</h2><p class="hint">Ekip, bulut bağlantısı kurulunca görünür (Ayarlar → Hesap ve güvenlik).</p>'; return; }
  if (!sahipMi()) { kok.innerHTML = `<h2>Ekibim</h2><p class="hint">Ekibi şirket yöneticileri görür.</p>`; return; }
  try {
    const [{ data: b }, { data: uyeler, error }] = await Promise.all([app.db.c.rpc('sirket_bilgisi'), app.db.c.from('ekip_uyeleri').select('eposta,ad,aktif,yonetici,yetkiler').eq('owner', app.db.sahip)]);
    if (error) throw error;
    const aktif = (uyeler || []).filter(u => u.aktif), pasif = (uyeler || []).filter(u => !u.aktif);
    const kurucu = b && !b.kurucu_ayrildi ? { eposta: b.kurucu_eposta, ad: b.ben_kurucu ? 'Sen (kurucu)' : b.kurucu_eposta } : null;
    const rolu = u => u.yonetici ? 'Şirket yöneticisi' : (u.yetkiler?._rol || 'Rolü girilmemiş');
    const roller = new Map(); for (const u of aktif) roller.set(rolu(u), (roller.get(rolu(u)) || 0) + 1);
    const { ekipSemasi } = await import('../orgsema.js');
    const satir = (ad, eposta, rol) => `<tr><td><b>${esc(ad)}</b></td><td>${esc(eposta || '')}</td><td>${esc(rol)}</td></tr>`;
    kok.innerHTML = `<div class="sk-ekip-bas"><h2>Ekibim</h2><button type="button" class="btn sm ghost" data-git="ekip">Kullanıcı ekle, rol ve yetki ver</button></div>
      <div class="org-ozet"><b>${aktif.length + (kurucu ? 1 : 0)} kişi</b>${kurucu ? '<span class="chip">Kurucu · 1</span>' : ''}${[...roller].map(([r, n]) => `<span class="chip">${esc(r)} · ${n}</span>`).join('')}${pasif.length ? `<span class="chip">Pasif · ${pasif.length}</span>` : ''}</div>
      ${ekipSemasi({ firma: b?.ad || p.firma, kurucu, yoneticiler: aktif.filter(u => u.yonetici), uyeler: aktif })}
      <div class="tablo-kap"><table class="tbl sk-tablo"><thead><tr><th>Kişi</th><th>E-posta</th><th>Rol</th></tr></thead><tbody>
        ${kurucu ? satir(kurucu.ad, kurucu.eposta, 'Kurucu') : ''}${aktif.sort((a, c) => rolu(a).localeCompare(rolu(c), 'tr') || (a.ad || a.eposta).localeCompare(c.ad || c.eposta, 'tr')).map(u => satir(u.ad || u.eposta, u.eposta, rolu(u))).join('')}
        ${pasif.map(u => `<tr class="muted"><td>${esc(u.ad || u.eposta)}</td><td>${esc(u.eposta)}</td><td>Pasif</td></tr>`).join('')}</tbody></table></div>`;
    kok.querySelector('[data-git="ekip"]').onclick = () => app.sayfaSekme?.('ekip');
  } catch (e) { kok.innerHTML = `<h2>Ekibim</h2><p class="warn">Ekip okunamadı: ${esc(e.message || String(e))}</p>`; }
}
