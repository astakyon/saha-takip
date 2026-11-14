// Kişi kartı: kendi sayfası (#/kisi/<id>[/<sekme>]). Firma sayfasıyla aynı düzen: geri, başlık, simge çubuğu, sekmeler.
// Düzenleme (kartvizit, eski firmalar dahil) pencerede açılır (kisiFormu).
import { S, adBol } from '../db.js';
import { app } from '../state.js';
import { gerekUygula } from '../yetki.js';
import { esc, usd, num, pill, tarih, today, byId, firmaAd, toast, confirmBox, download } from '../ui.js';
import { sayfadanDon, sayfaOncesiAd } from '../main.js';
import { IK, acilirKur, sekmeKur, araciTemizle } from '../sayfa.js';
import { kisiFormu, ciftUyarisi } from './firmalar.js';
import { ziyaretForm, gorevForm } from './ziyaret.js';
import { waGonder } from '../sablon.js';
import { teklifForm } from './teklif.js';
import { numuneForm, servisForm } from './kayitlar.js';

const SEKMELER = [
  ['ozet', 'Özet', ''],
  ['projeler', 'Projeler', 'projeler'],
  ['ziyaret', 'Ziyaret ve görevler', 'ziyaretler,gorevler'],
  ['satis', 'Teklif ve numune', 'teklifler,numuneler,servis_kayitlari'],
  ['notlar', 'Notlar', ''],
];
const webAdr = w => w ? (/^https?:\/\//i.test(w) ? w : 'https://' + w) : '';

export function kisiSayfa(el, id) {
  const k = byId('kisiler', id);
  if (!k) { el.innerHTML = `<div class="empty"><p>Kişi bulunamadı. Silinmiş ya da görme yetkin olmayabilir.</p><p><a class="btn" href="#/kisiler">Kişilere dön</a></p></div>`; return; }
  document.title = k.ad_soyad + ' · Saha Takip'; app.sayfaAd = k.ad_soyad;
  const firma = byId('firmalar', k.firma_id), ust = byId('kisiler', k.ust_kisi_id);
  const altlar = S.kisiler.filter(x => x.ust_kisi_id === k.id).sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
  const projeler = S.projeler.filter(p => p.ilgili_kisi_id === k.id).sort((a, b) => (['Sipariş', 'Kayıp', 'İptal'].includes(a.durum) - ['Sipariş', 'Kayıp', 'İptal'].includes(b.durum)) || (+b.tutar_usd || 0) - (+a.tutar_usd || 0));
  const ziy = S.ziyaretler.filter(z => z.kisi_id === k.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const yapilan = ziy.filter(z => (z.durum || 'Yapıldı') === 'Yapıldı'), planli = ziy.filter(z => z.durum === 'Planlandı').sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  const gor = (S.gorevler || []).filter(g => g.kisi_id === k.id).sort((a, b) => (a.durum === 'Tamam') - (b.durum === 'Tamam') || (a.son_tarih || '9').localeCompare(b.son_tarih || '9'));
  const acikGor = gor.filter(g => g.durum !== 'Tamam');
  const tek = (S.teklifler || []).filter(t => t.kisi_id === k.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const nmn = (S.numuneler || []).filter(n => n.kisi_id === k.id), srv = (S.servis_kayitlari || []).filter(n => n.kisi_id === k.id);
  const eski = k.eski_firmalar || [];
  const gun = yapilan[0] ? Math.round((new Date(today()) - new Date(yapilan[0].tarih)) / 864e5) : null;
  const sayi = { projeler: projeler.length, ziyaret: ziy.length + acikGor.length, satis: tek.length + nmn.length + srv.length, notlar: k.notlar ? 1 : 0 };
  const onceki = sayfaOncesiAd();
  const dlk = ic => ic.trim() ? `<dl class="profil-dl">${ic}</dl>` : '';
  const dd = (ad, v) => v ? `<dt>${ad}</dt><dd>${v}</dd>` : '';
  const projeSatir = p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${esc(firmaAd(p.yatirimci_id) || '')} · ${usd(p.tutar_usd)}</span></a>${pill(p.durum)}</li>`;
  const ziySatir = z => `<li><span class="muted">${tarih(z.tarih)}${z.durum === 'Planlandı' ? ' · planlı' : ''}</span><button type="button" class="linkrow" data-zid="${z.id}"><span>${esc([z.firma_id !== k.firma_id ? firmaAd(z.firma_id) : '', z.amac].filter(Boolean).join(' · ') || 'Ziyaret')}${z.notlar ? ` <span class="muted">${esc(z.notlar.slice(0, 140))}</span>` : ''}</span></button></li>`;
  const gorSatir = g => `<li><button type="button" class="linkrow" data-gid="${g.id}"><span>${g.durum === 'Tamam' ? '✓' : '○'} ${esc(g.baslik)}</span></button><span class="muted ${g.durum !== 'Tamam' && g.son_tarih && g.son_tarih < today() ? 'neg' : ''}">${tarih(g.son_tarih)}</span></li>`;
  const kisiLink = x => `<li><a href="#/kisi/${x.id}"><b>${esc(x.ad_soyad)}</b><span class="muted">${esc(x.unvan || x.pozisyon || '')}</span></a></li>`;
  const ilk = (k.ad || adBol(k.ad_soyad).ad || '?').slice(0, 1).toLocaleUpperCase('tr');
  const sirali = (l, satir) => l.map((x, i) => i < 10 ? satir(x) : satir(x).replace('<li>', '<li hidden data-fazla>')).join('');

  el.innerHTML = `<div class="fs-sayfa ks-sayfa" data-kisi="${esc(k.id)}">
    <button type="button" class="geri-lnk" data-geri>← ${esc(onceki || 'Kişiler')}</button>
    <header class="fs-bas">
      <span class="sk-logo fs-logo ks-foto" aria-hidden="true" data-kv="${esc(k.kartvizit_on || '')}">${esc(ilk)}</span>
      <div class="fs-kim"><p class="muted">${firma ? `<a href="#/firma/${firma.id}" class="ks-firma">${esc(firma.ad)}</a>` : 'Firması yok'}${k.unvan ? ' · ' + esc(k.unvan) : ''}</p>
        <h1>${esc(k.ad_soyad)}${k.rol === 'Karar verici' ? ' <em class="flag soft">★ Karar verici</em>' : ''}</h1>
        <div class="dh-meta">${k.pozisyon ? `<span>${esc(k.pozisyon)}</span>` : ''}${k.rol && k.rol !== 'Karar verici' ? `<span>${esc(k.rol)}</span>` : ''}<span data-gerek="projeler">${projeler.length} proje</span><span data-gerek="ziyaretler" class="${gun == null || gun > 90 ? 'neg' : ''}">${gun == null ? 'hiç görüşülmedi' : gun === 0 ? 'bugün görüşüldü' : `son görüşme ${gun} gün önce`}</span></div></div>
      <div class="fs-arac" role="toolbar" aria-label="Kişi işlemleri">
        <div class="fs-grp" data-grp="iletisim">${k.telefon ? `<a href="tel:${esc(k.telefon)}" data-ipucu="Ara" aria-label="Ara: ${esc(k.telefon)}">${IK.tel}</a><button type="button" data-a="wa" data-ipucu="WhatsApp" aria-label="WhatsApp" class="fs-wa">${IK.wa}</button>` : ''}${k.eposta ? `<a href="mailto:${esc(k.eposta)}" data-ipucu="E-posta" aria-label="E-posta: ${esc(k.eposta)}">${IK.mail}</a>` : ''}</div>
        <div class="fs-grp" data-grp="ekle"><button type="button" data-a="ziyaret" data-gerek="yaz:ziyaretler" data-ipucu="Ziyaret ekle" aria-label="Ziyaret ekle">${IK.pin}</button><button type="button" data-a="gorev" data-gerek="yaz:gorevler" data-ipucu="Görev ekle" aria-label="Görev ekle">${IK.gor}</button><button type="button" data-a="teklif" data-gerek="yaz:teklifler" data-ipucu="Teklif hazırla" aria-label="Teklif hazırla">${IK.tek}</button></div>
        <div class="fs-grp fs-acilir" data-acilir="daha"><button type="button" class="fs-daha" aria-haspopup="menu" aria-expanded="false" aria-label="Diğer işlemler" data-ipucu="Diğer">⋯</button>
          <div class="fs-menu fs-menu-sag" role="menu" hidden>
            <button type="button" role="menuitem" data-a="vcf">${IK.rehber}<span>Rehbere kaydet</span></button>${k.web ? `<a role="menuitem" href="${esc(webAdr(k.web))}" target="_blank" rel="noopener">${IK.web}<span>İnternet sitesi</span></a>` : ''}${k.adres ? `<a role="menuitem" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k.adres)}" target="_blank" rel="noopener">${IK.yol}<span>Adresi haritada aç</span></a>` : ''}
            <hr><button type="button" role="menuitem" data-a="numune" data-gerek="yaz:numuneler">${IK.num}<span>Numune ver</span></button><button type="button" role="menuitem" data-a="servis" data-gerek="yaz:servis_kayitlari">${IK.srv}<span>Servis kaydı</span></button>
            <hr><button type="button" role="menuitem" class="fs-sil" data-a="sil" data-gerek="yaz:kisiler">${IK.sil}<span>Kişiyi sil</span></button></div></div>
      </div>
    </header>
    <div class="fs-act" data-gerek="yaz:kisiler"><button class="btn sm primary" data-a="duzenle">Düzenle</button></div>
    <div data-cift></div>
    <div class="p-sekme fs-sekme" role="tablist" aria-label="Kişi bölümleri">${SEKMELER.map(([s, t, g]) => `<button type="button" role="tab" data-fsk="${s}" ${g ? `data-gerek="${g}"` : ''} aria-selected="false">${t}${sayi[s] ? ` <i>${sayi[s]}</i>` : ''}</button>`).join('')}</div>

    <div class="fs-ic" data-fs="ozet" role="tabpanel" hidden><div class="fs-izgara">
      <section class="card"><h2>İletişim</h2>${dlk(`
        ${dd('Cep telefonu', k.telefon ? `<a href="tel:${esc(k.telefon)}">${esc(k.telefon)}</a>` : '')}${dd('E-posta', k.eposta ? `<a href="mailto:${esc(k.eposta)}">${esc(k.eposta)}</a>` : '')}${dd('İnternet sitesi', k.web ? `<a href="${esc(webAdr(k.web))}" target="_blank" rel="noopener">${esc(k.web)}</a>` : '')}
        ${dd('Adres', esc(k.adres || ''))}${dd('Doğum günü', k.dogum_gunu ? tarih(k.dogum_gunu) : '')}`)}
        ${!k.telefon && !k.eposta && !k.adres ? '<p class="hint">İletişim bilgisi girilmemiş.</p>' : ''}
        <div class="btnrow" data-gerek="yaz:kisiler"><button type="button" class="btn sm ghost" data-a="duzenle">Bilgileri düzenle</button></div></section>
      <section class="card"><h2>Firmada</h2><dl class="profil-dl">
        ${dd('Firma', firma ? `<a href="#/firma/${firma.id}">${esc(firma.ad)}</a>` : '<span class="muted">—</span>')}${dd('Unvan', esc(k.unvan || ''))}${dd('Pozisyon', esc(k.pozisyon || ''))}${dd('Karar rolü', esc(k.rol || ''))}
        ${dd('Bağlı olduğu', ust ? `<a href="#/kisi/${ust.id}">${esc(ust.ad_soyad)}</a>${ust.unvan ? ` <span class="muted">${esc(ust.unvan)}</span>` : ''}` : '')}</dl>
        ${altlar.length ? `<h3>Ona bağlı olanlar <span class="muted">${altlar.length}</span></h3><ul class="list">${altlar.map(kisiLink).join('')}</ul>` : ''}
        ${firma ? `<button type="button" class="linkbtn" data-sema>Firmanın organizasyon şeması →</button>` : ''}</section>
      ${k.kartvizit_on || k.kartvizit_arka ? `<section class="card"><h2>Kartvizit</h2><div class="ks-kv">${['kartvizit_on', 'kartvizit_arka'].filter(s => k[s]).map(s => `<button type="button" class="ks-kv-r" data-kvy="${esc(k[s])}" aria-label="${s === 'kartvizit_on' ? 'Ön yüz' : 'Arka yüz'}: büyüt"></button>`).join('')}</div></section>` : ''}
      <section class="card"><div class="fs-kb"><h2>Eski firmaları <span class="muted">${eski.length || ''}</span></h2></div>
        ${eski.length ? `<ul class="list">${eski.map(g => `<li><span class="grow">${g.firma_id && byId('firmalar', g.firma_id) ? `<a href="#/firma/${g.firma_id}"><b>${esc(firmaAd(g.firma_id))}</b></a>` : `<b>${esc(g.firma_ad || '—')}</b>`}<small class="muted"> ${esc([g.unvan, g.bitis ? tarih(g.bitis) + ' tarihine kadar' : ''].filter(Boolean).join(' · '))}</small></span></li>`).join('')}</ul>` : '<p class="hint">Kayıtlı eski firma yok.</p>'}
        <div class="btnrow" data-gerek="yaz:kisiler"><button type="button" class="btn sm ghost" data-a="eski">Yeni firmaya geçti / eski firma ekle</button></div></section>
      <section class="card" data-gerek="ziyaretler"><div class="fs-kb"><h2>Görüşmeler</h2>${ziy.length > 3 ? `<button type="button" class="linkbtn fs-tumu" data-git="ziyaret">Tümü (${ziy.length}) →</button>` : ''}</div>
        ${planli.length ? `<p class="fs-plan"><b>Planlı:</b> ${tarih(planli[0].tarih)}${planli[0].amac ? ' · ' + esc(planli[0].amac) : ''}</p>` : ''}
        ${yapilan.length ? `<ul class="list">${yapilan.slice(0, 3).map(ziySatir).join('')}</ul>` : '<p class="hint">Bu kişiyle ziyaret kaydı yok.</p>'}
        ${acikGor.length ? `<h3>Açık görevler <span class="muted">${acikGor.length}</span></h3><ul class="list">${acikGor.slice(0, 3).map(gorSatir).join('')}</ul>` : ''}</section>
      ${k.notlar ? `<section class="card fs-not"><div class="fs-kb"><h2>Notlar</h2><button type="button" class="linkbtn fs-tumu" data-git="notlar">Notlar →</button></div><p class="fs-notmetin">${esc(k.notlar.length > 400 ? k.notlar.slice(0, 400) + '…' : k.notlar)}</p></section>` : ''}
    </div></div>

    <div class="fs-ic" data-fs="projeler" role="tabpanel" hidden>
      <section class="card" data-gerek="projeler"><h2>Projeler <span class="muted">${projeler.length}</span></h2><p class="hint">Bu kişinin ilgili kişi olarak seçildiği projeler.</p>
        ${projeler.length ? `<ul class="list" data-projeler>${sirali(projeler, projeSatir)}</ul>${projeler.length > 10 ? `<button type="button" class="btn sm ghost fs-devam" data-devam>Devamını göster (${projeler.length - 10} proje daha)</button>` : ''}` : '<p class="hint">Proje yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="ziyaret" role="tabpanel" hidden>
      <section class="card" data-gerek="ziyaretler"><div class="fs-kb"><h2>Ziyaretler <span class="muted">${ziy.length}</span></h2><button type="button" class="btn sm" data-a="ziyaret" data-gerek="yaz:ziyaretler">Ziyaret ekle</button></div>
        ${ziy.length ? `<ul class="list">${ziy.map(ziySatir).join('')}</ul>` : '<p class="hint">Ziyaret kaydı yok.</p>'}</section>
      <section class="card" data-gerek="gorevler"><div class="fs-kb"><h2>Görevler <span class="muted">${gor.length}</span></h2><button type="button" class="btn sm" data-a="gorev" data-gerek="yaz:gorevler">Görev ekle</button></div>
        ${gor.length ? `<ul class="list">${gor.map(gorSatir).join('')}</ul>` : '<p class="hint">Bu kişiye bağlı görev yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="satis" role="tabpanel" hidden>
      <section class="card" data-gerek="teklifler"><div class="fs-kb"><h2>Teklifler <span class="muted">${tek.length}</span></h2><button type="button" class="btn sm" data-a="teklif" data-gerek="yaz:teklifler">Teklif hazırla</button></div>
        ${tek.length ? `<ul class="list">${tek.map(t => `<li><button type="button" class="linkbtn" data-tk="${t.id}">${esc(t.teklif_no || 'Teklif')}</button><span class="muted">${tarih(t.tarih)} · ${esc(t.durum || '')}</span><b class="num">${num(t.toplam)} ${esc(t.para_birimi || '')}</b></li>`).join('')}</ul>` : '<p class="hint">Teklif yok.</p>'}</section>
      <section class="card" data-gerek="numuneler"><div class="fs-kb"><h2>Numuneler <span class="muted">${nmn.length}</span></h2><button type="button" class="btn sm ghost" data-a="numune" data-gerek="yaz:numuneler">Numune ver</button></div>
        ${nmn.length ? `<ul class="list">${nmn.map(n => `<li><button type="button" class="linkrow" data-nm="${n.id}"><b>${esc([n.urun_kod, n.urun_ad].filter(Boolean).join(' · ') || 'Numune')}</b></button><span class="muted">${tarih(n.verilis)} · ${esc(n.durum || '')}</span></li>`).join('')}</ul>` : '<p class="hint">Numune kaydı yok.</p>'}</section>
      <section class="card" data-gerek="servis_kayitlari"><div class="fs-kb"><h2>Servis kayıtları <span class="muted">${srv.length}</span></h2></div>
        ${srv.length ? `<ul class="list">${srv.map(n => `<li><button type="button" class="linkrow" data-sv="${n.id}"><b>${esc([n.tip, n.urun].filter(Boolean).join(' · '))}</b></button><span class="muted">${tarih(n.tarih)} · ${esc(n.durum || '')}</span></li>`).join('')}</ul>` : '<p class="hint">Servis kaydı yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="notlar" role="tabpanel" hidden>
      <section class="card"><div class="fs-kb"><h2>Notlar</h2><button type="button" class="btn sm ghost" data-a="not" data-gerek="yaz:kisiler">${k.notlar ? 'Notu düzenle' : 'Not ekle'}</button></div>
        ${k.notlar ? `<p class="fs-notmetin">${esc(k.notlar)}</p>` : '<p class="hint">Not yok.</p>'}</section>
      <section class="card" data-gecmis></section>
    </div>
  </div>`;

  gerekUygula(el);
  acilirKur(el); araciTemizle(el);
  ciftUyarisi(el, 'kisiler', k);
  el.querySelector('[data-geri]').onclick = () => sayfadanDon('kisiler');
  // Kartvizit: başlıkta küçük resim, özette ön ve arka yüz
  const foto = el.querySelector('.ks-foto');
  if (foto?.dataset.kv) app.db.url(foto.dataset.kv, true).then(u => { if (u) { foto.style.backgroundImage = `url("${u}")`; foto.classList.add('var'); foto.textContent = ''; } });
  el.querySelectorAll('[data-kvy]').forEach(async b => { const u = await app.db.url(b.dataset.kvy); if (u) { b.style.backgroundImage = `url("${u}")`; b.onclick = () => window.open(u, '_blank'); } });
  el.querySelector('[data-sema]')?.addEventListener('click', () => { location.hash = '#/firma/' + k.firma_id + '/kisiler'; });

  sekmeKur(el, { taban: 'kisi/' + k.id, KUR: { notlar: () => import('../gecmis.js').then(m => m.kayitGecmisi(el.querySelector('[data-gecmis]'), 'kisiler', k.id)) } });

  el.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
  el.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.gid }));
  el.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => teklifForm({ id: b.dataset.tk }));
  el.querySelectorAll('[data-nm]').forEach(b => b.onclick = () => numuneForm({ id: b.dataset.nm }));
  el.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => servisForm({ id: b.dataset.sv }));

  const bag = { firma_id: k.firma_id || null, kisi_id: k.id };
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'duzenle') kisiFormu(k.id);
    if (a === 'not') kisiFormu(k.id, null, { odak: 'notlar' });
    if (a === 'eski') { kisiFormu(k.id); setTimeout(() => document.querySelector('.drawer.open [data-eski-firma]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150); }
    if (a === 'wa') waGonder({ kisi: k });
    if (a === 'ziyaret') ziyaretForm(bag);
    if (a === 'gorev') gorevForm(bag);
    if (a === 'teklif') teklifForm(bag);
    if (a === 'numune') numuneForm(bag);
    if (a === 'servis') servisForm(bag);
    if (a === 'vcf') {
      const fa = firmaAd(k.firma_id);
      const v = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${k.ad_soyad}`, `N:${k.soyad || adBol(k.ad_soyad).soyad};${k.ad || adBol(k.ad_soyad).ad};;;`, fa && `ORG:${fa}`, k.unvan && `TITLE:${k.unvan}`, k.telefon && `TEL;TYPE=CELL:${k.telefon}`, k.eposta && `EMAIL:${k.eposta}`, k.web && `URL:${k.web}`, k.adres && `ADR;TYPE=WORK:;;${String(k.adres).replace(/[\n;]/g, ' ')};;;;`, 'END:VCARD'].filter(Boolean).join('\r\n');
      download(`${k.ad_soyad}.vcf`, v, 'text/vcard');
    }
    if (a === 'sil' && confirmBox(`${k.ad_soyad} silinsin mi?`)) { await app.db.del('kisiler', k.id); toast('Kişi silindi.'); sayfadanDon('kisiler'); }
  });
}
