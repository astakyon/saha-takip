// Bayi portalı: dış kullanıcı (bayi, proje firması) yeni proje bildirir, teklif ister, stok sorar; yalnızca kendi firmasının taleplerini görür.
// Şirket tarafı aynı ekranda talepleri görür, yanıtlar, projeye ya da teklife dönüştürür. Her yeni talep sunucuda görev olarak açılır.
import { S, uuid } from '../db.js';
import { app, F, saveFilters } from '../state.js';
import { esc, num, usd, tarih, today, byId, firmaAd, toast, openDrawer, closeDrawer, confirmBox, ILLER, ILCELER, match } from '../ui.js';
import { sahipMi, izin } from '../yetki.js';

export const TURLER = ['Yeni proje', 'Teklif isteği', 'Stok sorusu', 'Diğer'];
export const DURUMLAR = [{ k: 'Yeni', c: '#2563EB' }, { k: 'İnceleniyor', c: '#7C3AED' }, { k: 'Yanıtlandı', c: '#15803D' }, { k: 'Projeye dönüştü', c: '#0F766E' }, { k: 'Kapandı', c: '#52525B' }];
const dpill = d => `<span class="pill" style="--c:${(DURUMLAR.find(x => x.k === d) || DURUMLAR[0]).c}">${esc(d)}</span>`;
const disMi = () => !sahipMi() && !!app.yetki?.dis;
const bulut = () => app.db?.mode === 'supabase' && !!app.db?.c;
const tablo = () => app.db.c.from('bayi_talepleri');
const eskiSema = e => /does not exist|schema cache|Could not find/i.test(e?.message || '');
const SEMA = 'Bayi talepleri için Supabase\'de güncel schema.sql dosyasını çalıştır (sürüm 36).';

export async function talepleriGetir() {
  if (!bulut()) return null;
  const { data, error } = await tablo().select('*').order('created_at', { ascending: false });
  if (error) { if (eskiSema(error)) throw new Error(SEMA); throw error; }
  return data || [];
}

// ---------- Dış kullanıcı: yeni talep formu ----------
function talepFormu(init = {}, sonra) {
  const dis = app.yetki?.dis, projeler = S.projeler.filter(p => !p.aday);
  const firmalar = disMi() ? [] : S.firmalar.filter(f => (f.tipler || []).some(t => ['Bayi', 'Emüt', 'Malzeme Alıcısı'].includes(t))).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(disMi() ? dis?.firma_ad || 'Bayi' : 'Bayi adına')}</p><h2 id="drawer-title">Yeni talep</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody tf-form" novalidate>
      <div class="seg tf-tur" role="group" aria-label="Talep türü">${TURLER.map(t => `<button type="button" data-tur="${t}" class="${(init.tur || 'Yeni proje') === t ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${disMi() ? '' : `<label class="fld">Bayi / firma<select name="dis_firma_id" required><option value="">Seç</option>${firmalar.map(f => `<option value="${f.id}" ${init.dis_firma_id === f.id ? 'selected' : ''}>${esc(f.ad)}</option>`).join('')}</select></label>`}
      <label class="fld" data-g="Yeni proje,Teklif isteği,Diğer"><span data-baslik-l>Proje adı</span><input name="baslik" maxlength="160" value="${esc(init.baslik || '')}" required></label>
      <label class="fld" data-g="Teklif isteği">Hangi proje için (varsa)<select name="proje_id"><option value="">Listede yok / yeni</option>${projeler.map(x => `<option value="${x.id}" ${init.proje_id === x.id ? 'selected' : ''}>${esc(x.ad)}</option>`).join('')}</select></label>
      <div class="frow2" data-g="Yeni proje"><label class="fld">İl<select name="il"><option value=""></option>${ILLER.map(i => `<option>${esc(i)}</option>`).join('')}</select></label><label class="fld">İlçe<input name="ilce" list="tf-ilce" maxlength="60"><datalist id="tf-ilce"></datalist></label></div>
      <label class="fld" data-g="Yeni proje">Müteahhit / yatırımcı<input name="muteahhit" maxlength="160"></label>
      <div class="frow2" data-g="Yeni proje"><label class="fld">Tahmini aydınlatma tutarı (USD)<input name="tahmini_tutar" type="number" min="0" step="1000" inputmode="numeric"></label><label class="fld">Beklenen alım tarihi<input name="beklenen_tarih" type="date"></label></div>
      <div class="frow2" data-g="Stok sorusu,Teklif isteği"><label class="fld">Ürün<input name="urun" list="tf-urun" maxlength="160" placeholder="kod ya da açıklama"><datalist id="tf-urun">${S.urunler.slice(0, 400).map(u => `<option value="${esc(u.kod + ' · ' + (u.aciklama || ''))}">`).join('')}</datalist></label><label class="fld">Adet<input name="adet" type="number" min="0" inputmode="numeric"></label></div>
      <label class="fld">Açıklama<textarea name="aciklama" rows="4" maxlength="2000" placeholder="Ayrıntılar, iletişim kişisi, şartname…">${esc(init.aciklama || '')}</textarea></label>
      <div class="btnrow"><button type="submit" class="btn primary">Gönder</button></div>
      <p class="hint">${disMi() ? 'Talebin şirkete görev olarak iletilir; yanıtı bu ekranda görürsün.' : 'Bayi telefonla ilettiyse buradan kaydedebilirsin; görev olarak düşer.'}</p>
    </form>`, { onClose: () => sonra?.() });
  const form = p.querySelector('form');
  let tur = init.tur || 'Yeni proje';
  const goster = () => {
    p.querySelectorAll('[data-tur]').forEach(b => b.classList.toggle('on', b.dataset.tur === tur));
    p.querySelectorAll('[data-g]').forEach(x => x.hidden = !x.dataset.g.split(',').includes(tur));
    p.querySelector('[data-baslik-l]').textContent = { 'Yeni proje': 'Proje adı', 'Teklif isteği': 'Ne için teklif istiyorsun', 'Diğer': 'Konu' }[tur] || 'Konu';
  };
  p.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { tur = b.dataset.tur; goster(); });
  form.il.onchange = () => { p.querySelector('#tf-ilce').innerHTML = (ILCELER[form.il.value] || []).map(x => `<option value="${esc(x)}">`).join(''); };
  goster();
  form.onsubmit = async e => {
    e.preventDefault();
    const v = n => form[n] && !form[n].closest('[hidden]') ? form[n].value.trim() : '';
    const baslik = tur === 'Stok sorusu' ? (v('urun') ? `Stok: ${v('urun')}${v('adet') ? ' × ' + v('adet') : ''}` : '') : v('baslik');
    if (!baslik) return toast(tur === 'Stok sorusu' ? 'Ürünü yaz.' : 'Başlığı yaz.', 'err');
    if (!disMi() && !form.dis_firma_id.value) return toast('Bayiyi seç.', 'err');
    const o = { id: uuid(), tur, baslik, aciklama: v('aciklama') || null, proje_id: v('proje_id') || null, il: v('il') || null, ilce: v('ilce') || null, muteahhit: v('muteahhit') || null,
      tahmini_tutar: v('tahmini_tutar') ? +v('tahmini_tutar') : null, beklenen_tarih: v('beklenen_tarih') || null, urun: v('urun') || null, adet: v('adet') ? +v('adet') : null,
      acan_ad: app.profil?.ad || null, ...(disMi() ? {} : { dis_firma_id: form.dis_firma_id.value }) };
    form.querySelector('[type=submit]').disabled = true;
    const { error } = await tablo().insert(o);
    if (error) { form.querySelector('[type=submit]').disabled = false; return toast(eskiSema(error) ? SEMA : 'Gönderilemedi: ' + error.message, 'err'); }
    toast('Talep gönderildi.'); closeDrawer();
  };
}

// ---------- Şirket tarafı: talebi işle ----------
async function guncelle(t, alan, mesaj) {
  const { error } = await tablo().update(alan).eq('id', t.id);
  if (error) { toast('Kaydedilemedi: ' + error.message, 'err'); return false; }
  if (mesaj) toast(mesaj); return true;
}
function yanitPenceresi(t, sonra) {
  const p = openDrawer(`<header class="dh"><div><p class="muted">${esc(firmaAd(t.dis_firma_id) || '')} · ${esc(t.tur)}</p><h2 id="drawer-title">${esc(t.baslik)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody"><label class="fld">Yanıtın (bayi görür)<textarea name="yanit" rows="5" maxlength="2000">${esc(t.yanit || '')}</textarea></label>
    <label class="fld">Durum<select name="durum">${DURUMLAR.map(d => `<option ${d.k === (t.durum === 'Yeni' ? 'Yanıtlandı' : t.durum) ? 'selected' : ''}>${d.k}</option>`).join('')}</select></label>
    <div class="btnrow"><button type="submit" class="btn primary">Kaydet</button></div></form>`, { onClose: () => sonra?.() });
  p.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = e.target; if (await guncelle(t, { yanit: f.yanit.value.trim() || null, durum: f.durum.value }, 'Yanıt kaydedildi.')) closeDrawer(); };
}
async function projeyeDonustur(t, sonra) {
  const { projeFormu } = await import('./projeler.js');
  const id = uuid();
  projeFormu(null, { id, ad: t.baslik, durum: 'Proje', il: t.il || undefined, ilce: t.ilce || undefined, bayi_id: t.dis_firma_id || undefined, kanal: undefined,
    tutar_usd: t.tahmini_tutar || undefined, alim_tarihi: t.beklenen_tarih || undefined,
    notlar: [`Bayi talebi (${firmaAd(t.dis_firma_id) || ''}, ${tarih(String(t.created_at).slice(0, 10))})`, t.muteahhit && 'Müteahhit/yatırımcı: ' + t.muteahhit, t.aciklama].filter(Boolean).join('\n') });
  // Proje kaydedilince talep "Projeye dönüştü" olur (pencere kapanana kadar bekler)
  const bekle = setInterval(async () => {
    if (byId('projeler', id)) { clearInterval(bekle); await guncelle(t, { durum: 'Projeye dönüştü', sonuc_proje_id: id, yanit: t.yanit || 'Projeyi kaydettik, takibe aldık. Teşekkürler.' }, 'Talep projeye bağlandı.'); sonra?.(); }
    else if (!document.querySelector('.drawer.open')) clearInterval(bekle);
  }, 700);
}
async function teklifHazirla(t, sonra) {
  const { teklifForm } = await import('./teklif.js');
  await guncelle(t, { durum: 'İnceleniyor' });
  teklifForm({ firma_id: t.dis_firma_id, proje_id: t.proje_id || null, notlar: t.aciklama ? 'Talep: ' + t.aciklama : '' }, sonra);
}

// ---------- Ekran ----------
export async function taleplerView(el) {
  const f = F('talepler', { durum: 'Açık', q: '' }), dis = disMi(), yaz = dis || izin('projeler') === 'yaz';
  el.innerHTML = `<header class="vh"><div><h1>${dis ? 'Taleplerim' : 'Bayi talepleri'}</h1><p class="sum" data-sum>${dis ? esc(app.yetki.dis.firma_ad || '') : 'Bayilerden gelen proje bildirimleri, teklif istekleri ve stok soruları'}</p></div>
    <div class="vh-act">${yaz ? `<button class="btn primary" data-yeni>${dis ? 'Yeni talep' : 'Talep kaydet'}</button>` : ''}</div></header>
    ${dis ? '' : `<div class="frow"><input type="search" placeholder="Ara" value="${esc(f.q)}" data-q aria-label="Ara"><div class="seg" role="group" aria-label="Durum">${['Açık', 'Tümü', ...DURUMLAR.map(d => d.k)].map(d => `<button type="button" data-d="${d}" class="${f.durum === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>`}
    <div data-l><p class="hint">Yükleniyor…</p></div>`;
  const yenile = () => taleplerView(el);
  el.querySelector('[data-yeni]')?.addEventListener('click', () => talepFormu({}, yenile));
  if (!bulut()) { el.querySelector('[data-l]').innerHTML = '<div class="empty"><p>Bayi talepleri bulut hesabında (Supabase) çalışır: bayi kendi kullanıcısıyla girip talep açar.</p></div>'; el.querySelector('[data-yeni]')?.remove(); return; }
  let l;
  try { l = await talepleriGetir(); } catch (e) { el.querySelector('[data-l]').innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
  const ciz = () => {
    const g = dis ? l : l.filter(t => (f.durum === 'Tümü' || (f.durum === 'Açık' ? ['Yeni', 'İnceleniyor'].includes(t.durum) : t.durum === f.durum)) && match(f.q, t.baslik, t.aciklama, firmaAd(t.dis_firma_id), t.il, t.urun));
    if (!dis) el.querySelector('[data-sum]').textContent = `${l.filter(t => t.durum === 'Yeni').length} yeni · ${l.filter(t => t.durum === 'İnceleniyor').length} inceleniyor · toplam ${l.length}`;
    el.querySelector('[data-l]').innerHTML = g.length ? `<ul class="cards talep-l">${g.map(t => `<li class="talep" data-tid="${t.id}"><div class="talep-ust"><b>${esc(t.baslik)}</b>${dpill(t.durum)}</div>
      <p class="muted">${esc([t.tur, !dis && firmaAd(t.dis_firma_id), tarih(String(t.created_at).slice(0, 10)), t.acan_ad || (!dis && t.acan)].filter(Boolean).join(' · '))}</p>
      ${[t.il || t.ilce ? esc([t.ilce, t.il].filter(Boolean).join(', ')) : '', t.muteahhit ? 'Müteahhit: ' + esc(t.muteahhit) : '', t.tahmini_tutar ? 'Tahmini ' + usd(t.tahmini_tutar) : '', t.beklenen_tarih ? 'Alım ' + tarih(t.beklenen_tarih) : '', t.proje_id && byId('projeler', t.proje_id) ? 'Proje: ' + esc(byId('projeler', t.proje_id).ad) : '', t.urun && t.tur !== 'Stok sorusu' ? esc(t.urun) + (t.adet ? ' × ' + num(t.adet) : '') : ''].filter(Boolean).map(x => `<span class="talep-e">${x}</span>`).join('')}
      ${t.aciklama ? `<p class="talep-a">${esc(t.aciklama)}</p>` : ''}
      ${t.yanit ? `<p class="talep-y"><small>${esc(dis ? 'Yanıt' : 'Yanıtın')}${t.yanit_zaman ? ' · ' + tarih(String(t.yanit_zaman).slice(0, 10)) : ''}</small>${esc(t.yanit)}</p>` : ''}
      ${t.sonuc_proje_id && byId('projeler', t.sonuc_proje_id) ? `<p><a href="#/proje/${t.sonuc_proje_id}">Projeye git →</a></p>` : ''}
      ${dis ? (t.durum === 'Yeni' ? '<div class="btnrow"><button type="button" class="btn sm ghost danger" data-geri>Geri çek</button></div>' : '')
        : yaz ? `<div class="btnrow">${t.tur === 'Yeni proje' && !t.sonuc_proje_id ? '<button type="button" class="btn sm primary" data-proje>Projeye dönüştür</button>' : ''}${['Teklif isteği', 'Yeni proje'].includes(t.tur) ? '<button type="button" class="btn sm" data-teklif>Teklif hazırla</button>' : ''}<button type="button" class="btn sm" data-yanit>Yanıtla</button>${t.durum !== 'Kapandı' ? '<button type="button" class="btn sm ghost" data-kapat>Kapat</button>' : ''}</div>` : ''}
    </li>`).join('')}</ul>`
      : `<div class="empty"><p>${dis ? 'Henüz talebin yok. "Yeni talep" ile proje bildirebilir, teklif isteyebilir ya da stok sorabilirsin.' : f.durum === 'Açık' ? 'Açık talep yok.' : 'Bu durumda talep yok.'}</p>${dis ? '' : '<p class="hint">Bayi kullanıcısı eklemek için Şirket profili → Ekip → kişide "Dış kullanıcı" olarak firmasını seç.</p>'}</div>`;
    el.querySelectorAll('li[data-tid]').forEach(li => {
      const t = l.find(x => x.id === li.dataset.tid);
      li.querySelector('[data-yanit]')?.addEventListener('click', () => yanitPenceresi(t, yenile));
      li.querySelector('[data-proje]')?.addEventListener('click', () => projeyeDonustur(t, yenile));
      li.querySelector('[data-teklif]')?.addEventListener('click', () => teklifHazirla(t, yenile));
      li.querySelector('[data-kapat]')?.addEventListener('click', async () => { if (await guncelle(t, { durum: 'Kapandı' }, 'Talep kapatıldı.')) yenile(); });
      li.querySelector('[data-geri]')?.addEventListener('click', async () => { if (!confirmBox('Talep geri çekilsin mi?')) return; const { error } = await tablo().delete().eq('id', t.id); if (error) return toast('Silinemedi: ' + error.message, 'err'); toast('Talep geri çekildi.'); yenile(); });
    });
  };
  if (!dis) {
    let qt; el.querySelector('[data-q]').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; saveFilters(); ciz(); }, 200); };
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.durum = b.dataset.d; saveFilters(); el.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); ciz(); });
  }
  ciz();
}
