// Yönetim paneli (yalnızca uygulama yöneticisi): bütün hesaplar, kim ne ekledi, hesaba salt okunur bakma,
// geri bildirimler, bütün kullanıcıların hata günlüğü ve test daveti. Yönetici kayıtları görür, değiştiremez.
import { app, F, saveFilters } from '../state.js';
import { esc, toast, openDrawer, closeDrawer, confirmBox, fold, tarih } from '../ui.js';

const TUR = { ic: 'Kendi kullanımım', test: 'Test', musteri: 'Müşteri' };
const TUR_RENK = { ic: '#2563EB', test: '#CA8A04', musteri: '#15803D' };
const TABLO = { projeler: 'proje', firmalar: 'firma', kisiler: 'kişi', ziyaretler: 'ziyaret', gorevler: 'görev', siparisler: 'sipariş', teklifler: 'teklif', urunler: 'ürün', tahsilatlar: 'tahsilat', numuneler: 'numune', servis_kayitlari: 'servis kaydı', belgeler: 'belge', bolgeler: 'bölge', hedefler: 'hedef' };
const ISLEM = { 'ekleme': 'ekledi', 'değişiklik': 'değiştirdi', 'silme': 'sildi' };
const zaman = t => { if (!t) return '—'; const d = new Date(t), g = (Date.now() - d) / 864e5; return g < 1 && d.getDate() === new Date().getDate() ? 'bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : g < 2 ? 'dün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
const tpill = t => `<span class="pill" style="--c:${TUR_RENK[t] || '#64748B'}">${esc(TUR[t] || t)}</span>`;
let HESAP = [];
const hesapAd = o => { const h = HESAP.find(x => x.owner === o); return h ? (h.firma || h.eposta) : 'Hesap'; };

export async function yonetimView(el) {
  const f = F('yonetim', { sekme: 'hesaplar', tur: 'Tümü', q: '' });
  el.innerHTML = `<header class="vh"><div><h1>Yönetim</h1><p class="sum" data-sum>Yükleniyor…</p></div></header>
    <div class="seg yon-sekme" role="tablist" aria-label="Yönetim bölümleri">${[['hesaplar', 'Hesaplar'], ['akis', 'Kim ne ekledi'], ['geri', 'Geri bildirim'], ['hata', 'Hatalar'], ['davet', 'Test daveti']].map(([k, t]) => `<button type="button" role="tab" data-ys="${k}" class="${f.sekme === k ? 'on' : ''}" aria-selected="${f.sekme === k}">${t}</button>`).join('')}</div>
    <div data-yicerik></div>`;
  const icerik = el.querySelector('[data-yicerik]');
  const { data, error } = await app.db.c.rpc('yonetim_hesaplar');
  if (error) { el.querySelector('[data-sum]').textContent = ''; icerik.innerHTML = `<p class="warn">Yönetim bilgileri alınamadı: ${esc(error.message)}. Supabase'de güncel <b>schema.sql</b> dosyasını çalıştır (sürüm 19) ve kendini <b>uygulama_yoneticileri</b> tablosuna ekle.</p>`; return; }
  HESAP = data || [];
  const hafta = Date.now() - 7 * 864e5;
  el.querySelector('[data-sum]').textContent = `${HESAP.length} hesap · ${HESAP.filter(h => h.tur === 'musteri').length} müşteri · ${HESAP.filter(h => h.tur === 'test').length} test · son 7 günde ${HESAP.filter(h => h.son_islem && new Date(h.son_islem) > hafta).length} hesapta işlem`;
  const goster = () => {
    el.querySelectorAll('[data-ys]').forEach(b => { b.classList.toggle('on', b.dataset.ys === f.sekme); b.setAttribute('aria-selected', b.dataset.ys === f.sekme); });
    if (f.sekme === 'hesaplar') hesaplar(icerik, f);
    else if (f.sekme === 'akis') akis(icerik, {});
    else if (f.sekme === 'geri') import('../geribildirim.js').then(m => m.geriBildirimListesi(icerik));
    else if (f.sekme === 'hata') { icerik.innerHTML = '<div data-h></div>'; import('../saglik.js').then(m => m.hataGunluguKarti(icerik.querySelector('[data-h]'), { tum: true })); }
    else { icerik.innerHTML = '<section class="card"><div data-d></div></section>'; import('../geribildirim.js').then(m => m.testDavetKarti(icerik.querySelector('[data-d]'))); }
  };
  el.querySelectorAll('[data-ys]').forEach(b => b.onclick = () => { f.sekme = b.dataset.ys; saveFilters(); goster(); });
  goster();
}

function hesaplar(kok, f) {
  const ciz = () => {
    const l = HESAP.filter(h => (f.tur === 'Tümü' || h.tur === f.tur) && (!f.q || fold([h.firma, h.eposta, h.notlar].join(' ')).includes(fold(f.q))));
    kok.innerHTML = `<div class="filters"><input type="search" data-q placeholder="Firma ya da e-posta ara" value="${esc(f.q)}" aria-label="Hesap ara">
      <div class="seg" role="group" aria-label="Tür">${[['Tümü', 'Tümü'], ...Object.entries(TUR)].map(([k, t]) => `<button type="button" data-tur="${k}" class="${f.tur === k ? 'on' : ''}">${t} (${k === 'Tümü' ? HESAP.length : HESAP.filter(h => h.tur === k).length})</button>`).join('')}</div></div>
      <ul class="cards grid-cards yon-hesap">${l.map(h => `<li><button type="button" class="card-btn" data-h="${h.owner}">
        <span class="cb-top"><b>${esc(h.firma || h.eposta)}</b>${tpill(h.tur)}${h.durum === 'askida' ? '<span class="pill" style="--c:#B91C1C">Askıda</span>' : ''}</span>
        <small class="muted">${esc(h.eposta)}${h.ekip ? ` · ${h.ekip} ekip üyesi` : ''}${h.kurulum ? '' : ' · kurulum yapılmadı'}</small>
        <span class="yon-say"><span><b>${h.projeler}</b> proje</span><span><b>${h.firmalar}</b> firma</span><span><b>${h.kisiler}</b> kişi</span><span><b>${h.ziyaretler}</b> ziyaret</span><span><b>${h.teklifler}</b> teklif</span></span>
        <small class="muted">Kayıt ${zaman(h.kayit)} · son giriş ${zaman(h.son_giris)} · son işlem ${zaman(h.son_islem)}</small></button></li>`).join('') || '<li class="empty"><p>Hesap yok.</p></li>'}</ul>`;
    const q = kok.querySelector('[data-q]'); let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value; saveFilters(); ciz(); kok.querySelector('[data-q]').focus(); const y = kok.querySelector('[data-q]'); y.setSelectionRange(y.value.length, y.value.length); }, 250); };
    kok.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { f.tur = b.dataset.tur; saveFilters(); ciz(); });
    kok.querySelectorAll('[data-h]').forEach(b => b.onclick = () => hesapDetay(b.dataset.h, ciz));
  };
  ciz();
}

async function hesapDetay(owner, sonra) {
  const h = HESAP.find(x => x.owner === owner); if (!h) return;
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(h.eposta)}</p><h2 id="drawer-title">${esc(h.firma || h.eposta)}</h2><div class="dh-meta">${tpill(h.tur)}<span>Kayıt ${zaman(h.kayit)}</span><span>Son giriş ${zaman(h.son_giris)}</span><span>Son işlem ${zaman(h.son_islem)}</span></div></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dh-actions"><button class="btn sm primary" data-bak>Hesaba bak (salt okunur)</button></div>
    <div class="dbody form">
      <div class="yon-say buyuk">${[['projeler', 'proje'], ['firmalar', 'firma'], ['kisiler', 'kişi'], ['ziyaretler', 'ziyaret'], ['gorevler', 'görev'], ['teklifler', 'teklif'], ['siparisler', 'sipariş'], ['belgeler', 'belge']].map(([k, t]) => `<span><b>${h[k]}</b> ${t}</span>`).join('')}</div>
      <h3>Hesap bilgisi</h3>
      <div class="grid"><div class="fld"><label for="yh-tur">Tür</label><select id="yh-tur">${Object.entries(TUR).map(([k, t]) => `<option value="${k}" ${h.tur === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="fld"><label for="yh-durum">Durum</label><select id="yh-durum"><option value="aktif" ${h.durum !== 'askida' ? 'selected' : ''}>Aktif</option><option value="askida" ${h.durum === 'askida' ? 'selected' : ''}>Askıda (salt okunur)</option></select></div>
        <div class="fld"><label for="yh-paket">Paket</label><input id="yh-paket" value="${esc(h.paket || '')}" placeholder="Örn. Tek kişi, Ekip"></div>
        <div class="fld"><label for="yh-den">Deneme / abonelik bitişi</label><input id="yh-den" type="date" value="${esc(h.deneme_bitis || '')}"></div></div>
      <div class="fld"><label for="yh-not">Not (yalnızca sen görürsün)</label><textarea id="yh-not" rows="2">${esc(h.notlar || '')}</textarea></div>
      <div class="btnrow"><button type="button" class="btn" data-kaydet>Kaydet</button></div>
      <h3>Ekip</h3><div data-ekip><p class="hint">Yükleniyor…</p></div>
      <h3>Son işlemler</h3><div data-akis></div>
    </div>`, { wide: true });
  p.querySelector('[data-bak]').onclick = () => hesabaBak(h);
  p.querySelector('[data-kaydet]').onclick = async () => {
    const yeni = { owner, eposta: h.eposta, firma: h.firma, tur: p.querySelector('#yh-tur').value, durum: p.querySelector('#yh-durum').value, paket: p.querySelector('#yh-paket').value.trim() || null, deneme_bitis: p.querySelector('#yh-den').value || null, notlar: p.querySelector('#yh-not').value.trim() || null };
    if (yeni.durum === 'askida' && h.durum !== 'askida' && !confirmBox(`${h.firma || h.eposta} askıya alınsın mı? Hesap sahibi ve ekibi kayıtlarını görür ama hiçbir şey ekleyemez, değiştiremez.`)) return;
    const { error } = await app.db.c.from('hesaplar').upsert(yeni);
    if (error) return toast('Kaydedilemedi: ' + error.message, 'err');
    Object.assign(h, yeni); toast('Hesap bilgisi kaydedildi.'); sonra?.();
  };
  app.db.c.rpc('yonetim_ekip', { p_owner: owner }).then(({ data, error }) => {
    const k = p.querySelector('[data-ekip]'); if (!k) return;
    k.innerHTML = error ? `<p class="hint">${esc(error.message)}</p>` : data?.length ? `<ul class="list">${data.map(u => `<li><span class="grow"><b>${esc(u.ad || u.eposta)}</b><small class="muted"> · ${esc(u.eposta)}${u.rol ? ' · ' + esc(u.rol) : ''}${u.aktif ? '' : ' · pasif'}</small></span><small class="muted">son giriş ${zaman(u.son_giris)} · son kullanım ${zaman(u.son_gorulme)}</small></li>`).join('')}</ul>` : '<p class="hint">Ekip üyesi yok.</p>';
  });
  akis(p.querySelector('[data-akis]'), { owner, kisa: true });
}

// Kim ne ekledi: değişiklik geçmişinden bütün hesapların akışı (ya da tek hesap)
async function akis(kok, { owner = null, kisa = false }) {
  const s = { owner, tablo: '', islem: '', kim: '', gun: 7 };
  const ciz = async () => {
    kok.innerHTML = `${kisa ? '' : `<div class="filters"><div class="frow">
        <label>Hesap <select data-a="owner"><option value="">Tümü</option>${HESAP.map(h => `<option value="${h.owner}" ${s.owner === h.owner ? 'selected' : ''}>${esc(h.firma || h.eposta)}</option>`).join('')}</select></label>
        <label>Kayıt <select data-a="tablo"><option value="">Tümü</option>${Object.entries(TABLO).map(([k, t]) => `<option value="${k}" ${s.tablo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>İşlem <select data-a="islem"><option value="">Tümü</option>${Object.entries(ISLEM).map(([k, t]) => `<option value="${k}" ${s.islem === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Dönem <select data-a="gun">${[[1, 'Bugün'], [7, 'Son 7 gün'], [30, 'Son 30 gün'], [90, 'Son 90 gün']].map(([v, t]) => `<option value="${v}" ${s.gun === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>`}
      <div data-ozet></div><div data-liste><p class="hint">Yükleniyor…</p></div>`;
    kok.querySelectorAll('[data-a]').forEach(x => x.onchange = () => { s[x.dataset.a] = x.dataset.a === 'gun' ? +x.value : x.value || null; ciz(); });
    let q = app.db.c.from('degisiklikler').select('id,owner,tablo,kayit_id,islem,kim,zaman,ozet').order('zaman', { ascending: false }).limit(kisa ? 40 : 1000);
    if (s.owner) q = q.eq('owner', s.owner);
    if (s.tablo) q = q.eq('tablo', s.tablo);
    if (s.islem) q = q.eq('islem', s.islem);
    if (!kisa) q = q.gte('zaman', new Date(Date.now() - s.gun * 864e5).toISOString());
    const { data, error } = await q;
    const liste = kok.querySelector('[data-liste]'); if (!liste) return;
    if (error) { liste.innerHTML = `<p class="warn">${esc(error.message)}</p>`; return; }
    const l = data || [];
    // Özet: kişi başına eklenen / değiştirilen
    if (!kisa) {
      const kisi = new Map();
      for (const d of l) { const k = (d.owner) + '|' + (d.kim || '?'); const o = kisi.get(k) || { owner: d.owner, kim: d.kim, ekleme: 0, 'değişiklik': 0, silme: 0, son: d.zaman }; o[d.islem] = (o[d.islem] || 0) + 1; kisi.set(k, o); }
      const ks = [...kisi.values()].sort((a, b) => (b.ekleme + b['değişiklik']) - (a.ekleme + a['değişiklik']));
      kok.querySelector('[data-ozet]').innerHTML = ks.length ? `<section class="card"><h2>Kişi bazında</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kişi</th><th>Hesap</th><th class="r">Ekledi</th><th class="r">Değiştirdi</th><th class="r">Sildi</th><th>Son işlem</th></tr></thead><tbody>
        ${ks.map(o => `<tr><td>${esc(o.kim || '?')}</td><td>${esc(hesapAd(o.owner))}</td><td class="r num">${o.ekleme}</td><td class="r num">${o['değişiklik']}</td><td class="r num">${o.silme}</td><td>${zaman(o.son)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
    }
    const gunler = new Map(); for (const d of l) { const g = d.zaman.slice(0, 10); (gunler.get(g) || gunler.set(g, []).get(g)).push(d); }
    liste.innerHTML = l.length ? [...gunler].map(([g, ds]) => `<h3 class="yon-gun">${tarih(g)} <span class="muted">${ds.length}</span></h3><ul class="list yon-akis">${ds.map(d => `<li><span class="muted">${new Date(d.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span><span class="grow">${owner ? '' : `<b>${esc(hesapAd(d.owner))}</b> · `}${esc(d.kim || '?')} ${esc(TABLO[d.tablo] || d.tablo)} ${esc(ISLEM[d.islem] || d.islem)}${d.ozet ? `: “${esc(d.ozet)}”` : ''}</span></li>`).join('')}</ul>`).join('')
      + (l.length >= 1000 ? '<p class="hint">İlk 1000 işlem gösteriliyor; dönemi daralt ya da hesap seç.</p>' : '')
      : '<p class="hint">Bu dönemde işlem yok.</p>';
  };
  ciz();
}

// Hesaba bak: uygulama o hesabın kayıtlarıyla salt okunur açılır
export function hesabaBak(h) {
  try { sessionStorage.setItem('saha-bak', JSON.stringify({ owner: h.owner, firma: h.firma || '', eposta: h.eposta })); } catch {}
  location.hash = '#/bugun'; location.reload();
}
export function bakmayiBitir() { try { sessionStorage.removeItem('saha-bak'); } catch {} location.hash = '#/yonetim'; location.reload(); }
