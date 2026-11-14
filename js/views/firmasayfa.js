// Firma kartı: kendi sayfası (#/firma/<id>[/<sekme>]). Üstte geri dönüş, başlık ve işlemler; altında sekmeler.
// Düzenleme pencerede açılır (firmaFormu); kişi, ziyaret, teklif gibi kayıtlar da pencerede açılıp sayfayı yeniler.
import { S } from '../db.js';
import { app } from '../state.js';
import { rotaYazilabilir, gerekUygula } from '../yetki.js';
import { POZISYONLAR, esc, usd, num, pill, tarih, today, byId, firmaAd, match, toast, confirmBox, directionsUrl, ACIK } from '../ui.js';
import { sayfadanDon, sayfaOncesiAd } from '../main.js';
import { IK, acilirKur, sekmeKur, araciTemizle } from '../sayfa.js';
import { firmaFormu, firmaProjeleri, ciftUyarisi, kisiDetay } from './firmalar.js';
import { projeRolleri } from './projeler.js';
import { ziyaretForm, gorevForm } from './ziyaret.js';
import { waGonder } from '../sablon.js';
import { teklifForm } from './teklif.js';
import { numuneForm, servisForm } from './kayitlar.js';
import { belgeBolumu, belgeleri } from '../belgeler.js';
import { googleBul, aramaMetni } from '../google.js';

const SEKMELER = [
  ['ozet', 'Özet', ''],
  ['kisiler', 'Kişiler ve şema', 'kisiler'],
  ['projeler', 'Projeler', 'projeler'],
  ['ziyaret', 'Ziyaret ve görevler', 'ziyaretler,gorevler'],
  ['satis', 'Teklif ve sipariş', 'teklifler,siparisler,numuneler,servis_kayitlari,tahsilatlar'],
  ['belgeler', 'Belgeler', 'belgeler'],
  ['notlar', 'Notlar', ''],
];
const sekmeAdi = k => SEKMELER.some(s => s[0] === k) ? k : 'ozet';
const pozSira = k => { const i = POZISYONLAR.indexOf(k.pozisyon); return (k.rol === 'Karar verici' ? -1 : 0) + (i < 0 ? 50 : i); };

export function firmaSayfa(el, id, sekme0) {
  const x = byId('firmalar', id);
  if (!x) { el.innerHTML = `<div class="empty"><p>Firma bulunamadı. Silinmiş ya da görme yetkin olmayabilir.</p><p><a class="btn" href="#/firmalar">Firmalara dön</a></p></div>`; return; }
  document.title = x.ad + ' · Saha Takip'; app.sayfaAd = x.ad;
  const projeler = firmaProjeleri(x.id);
  const kisiler = S.kisiler.filter(k => k.firma_id === x.id).sort((a, b) => pozSira(a) - pozSira(b) || a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
  const eskiler = S.kisiler.filter(k => k.firma_id !== x.id && (k.eski_firmalar || []).some(g => g.firma_id === x.id));
  const ziy = S.ziyaretler.filter(z => z.firma_id === x.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const yapilan = ziy.filter(z => (z.durum || 'Yapıldı') === 'Yapıldı'), planli = ziy.filter(z => z.durum === 'Planlandı').sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  const gor = (S.gorevler || []).filter(g => g.firma_id === x.id).sort((a, b) => (a.durum === 'Tamam') - (b.durum === 'Tamam') || (a.son_tarih || '9').localeCompare(b.son_tarih || '9'));
  const acikGor = gor.filter(g => g.durum !== 'Tamam');
  const tek = (S.teklifler || []).filter(t => t.firma_id === x.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const sip = (S.siparisler || []).filter(s => s.firma_id === x.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const num_ = (S.numuneler || []).filter(n => n.firma_id === x.id), srv = (S.servis_kayitlari || []).filter(n => n.firma_id === x.id);
  const tah = (S.tahsilatlar || []).filter(t => t.firma_id === x.id && (+t.tutar || 0) > (+t.odenen || 0));
  const belgeN = belgeleri({ firma_id: x.id }).length, yorumN = (S.yorumlar || []).filter(y => y.kayit_id === x.id).length;
  const acik = projeler.filter(p => ACIK.includes(p.durum)), acikT = acik.reduce((a, p) => a + (+p.tutar_usd || 0), 0);
  const won = projeler.filter(p => p.durum === 'Sipariş').length, lost = projeler.filter(p => p.durum === 'Kayıp').length;
  const sipT = sip.filter(s => s.para_birimi === 'USD').reduce((a, s) => a + +s.net_deger, 0);
  const gun = yapilan[0] ? Math.round((new Date(today()) - new Date(yapilan[0].tarih)) / 864e5) : null;
  const stok = (x.tipler || []).includes('Bayi') ? S.urunler.filter(u => u.depo && x.ad.toLowerCase().startsWith(u.depo.toLowerCase().split(' ')[0])) : [];
  const sayi = { kisiler: kisiler.length, projeler: projeler.length, ziyaret: ziy.length + acikGor.length, satis: tek.length + sip.length + num_.length + srv.length, belgeler: belgeN, notlar: yorumN + (x.notlar ? 1 : 0) + (x.fotolar || []).length };
  const sekme = sekmeAdi(sekme0 || location.hash.split('/')[3]);
  const onceki = sayfaOncesiAd();
  const web = x.web ? (/^https?:\/\//i.test(x.web) ? x.web : 'https://' + x.web) : '';
  const dlk = ic => ic.trim() ? `<dl class="profil-dl">${ic}</dl>` : '';
  const dd = (ad, v) => v ? `<dt>${ad}</dt><dd>${v}</dd>` : '';
  const kisiSatir = k => `<li class="kisi-bag"><a href="#/kisi/${k.id}" class="pcard"><span class="avatar" data-kv="${esc(k.kartvizit_on || '')}">${esc(k.ad_soyad.slice(0, 1))}</span><span><b>${esc(k.ad_soyad)}</b><small>${esc([k.unvan || k.pozisyon, k.telefon].filter(Boolean).join(' · '))}</small></span></a>`;
  const projeSatir = p => `<li><a href="#/proje/${p.id}"><b>${esc(p.ad)}</b><span class="muted">${esc(projeRolleri(p, x.id).join(', '))} · ${usd(p.tutar_usd)}</span></a>${pill(p.durum)}</li>`;
  const ziySatir = z => `<li><span class="muted">${tarih(z.tarih)}${z.durum === 'Planlandı' ? ' · planlı' : ''}</span><button type="button" class="linkrow" data-zid="${z.id}"><span>${esc([byId('kisiler', z.kisi_id)?.ad_soyad, z.amac].filter(Boolean).join(' · '))}${z.notlar ? ` <span class="muted">${esc(z.notlar.slice(0, 140))}</span>` : ''}${!z.kisi_id && !z.amac && !z.notlar ? '<span class="muted">Ziyaret</span>' : ''}</span></button></li>`;
  const gorSatir = g => `<li><button type="button" class="linkrow" data-gid="${g.id}"><span>${g.durum === 'Tamam' ? '✓' : '○'} ${esc(g.baslik)}</span></button><span class="muted ${g.durum !== 'Tamam' && g.son_tarih && g.son_tarih < today() ? 'neg' : ''}">${tarih(g.son_tarih)}</span></li>`;
  const tumu = (k, n) => `<button type="button" class="linkbtn fs-tumu" data-git="${k}">Tümü (${n}) →</button>`;

  el.innerHTML = `<div class="fs-sayfa" data-firma="${esc(x.id)}">
    <button type="button" class="geri-lnk" data-geri>← ${esc(onceki || 'Firmalar')}</button>
    <header class="fs-bas">
      <span class="sk-logo fs-logo" aria-hidden="true">${esc((x.ad || 'F').slice(0, 1).toLocaleUpperCase('tr'))}</span>
      <div class="fs-kim"><p class="muted">${esc([(x.tipler || []).join(', ') || 'Firma', [x.ilce, x.il].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}</p>
        <h1>${esc(x.ad)}${x.key_account ? ' <em class="flag soft">Key account</em>' : ''}</h1>
        <div class="dh-meta"><span data-gerek="projeler">${acik.length} açık proje${acikT ? ' · ' + usd(acikT) : ''}</span><span data-gerek="projeler">${won} sipariş · ${lost} kayıp</span>${sip.length ? `<span data-gerek="siparisler">${usd(sipT)} SAP sipariş</span>` : ''}<span data-gerek="ziyaretler" class="${gun == null || gun > 60 ? 'neg' : ''}">${gun == null ? 'hiç ziyaret yok' : gun === 0 ? 'bugün ziyaret edildi' : `son ziyaret ${gun} gün önce`}</span>${tah.length ? `<span class="neg" data-gerek="tahsilatlar">${tah.length} açık fatura</span>` : ''}${x.segment ? `<span>Segment ${esc(x.segment)}</span>` : ''}</div></div>
      <div class="fs-arac" role="toolbar" aria-label="Firma işlemleri">
        <div class="fs-grp" data-grp="iletisim">${x.telefon ? `<a href="tel:${esc(x.telefon)}" data-ipucu="Ara" aria-label="Ara: ${esc(x.telefon)}">${IK.tel}</a>` : ''}<button type="button" data-a="wa" data-ipucu="WhatsApp" aria-label="WhatsApp" class="fs-wa">${IK.wa}</button>${x.lat != null ? `<a target="_blank" rel="noopener" href="${directionsUrl(x.lat, x.lng)}" data-ipucu="Yol tarifi" aria-label="Yol tarifi" class="fs-yol">${IK.yol}</a>` : ''}</div>
        <div class="fs-grp" data-grp="ekle"><button type="button" data-a="ziyaret" data-gerek="yaz:ziyaretler" data-ipucu="Ziyaret ekle" aria-label="Ziyaret ekle">${IK.pin}</button><button type="button" data-a="kisi" data-gerek="yaz:kisiler" data-ipucu="Kişi ekle" aria-label="Kişi ekle">${IK.kisi}</button><button type="button" data-a="gorev" data-gerek="yaz:gorevler" data-ipucu="Görev ekle" aria-label="Görev ekle">${IK.gor}</button><button type="button" data-a="teklif" data-gerek="yaz:teklifler" data-ipucu="Teklif hazırla" aria-label="Teklif hazırla">${IK.tek}</button></div>
        <div class="fs-grp fs-acilir" data-acilir="daha"><button type="button" class="fs-daha" aria-haspopup="menu" aria-expanded="false" aria-label="Diğer işlemler" data-ipucu="Diğer">⋯</button>
          <div class="fs-menu fs-menu-sag" role="menu" hidden>
            <button type="button" role="menuitem" data-a="numune" data-gerek="yaz:numuneler">${IK.num}<span>Numune ver</span></button><button type="button" role="menuitem" data-a="servis" data-gerek="yaz:servis_kayitlari">${IK.srv}<span>Servis kaydı</span></button>
            <hr><button type="button" role="menuitem" data-a="google" data-gerek="yaz:firmalar">${IK.ara}<span>Google'dan bilgi al</span></button>${x.google_url ? `<a role="menuitem" href="${esc(x.google_url)}" target="_blank" rel="noopener">${IK.yol}<span>Google Haritalar'da aç</span></a>` : ''}
            <hr><button type="button" role="menuitem" class="fs-sil" data-a="sil" data-gerek="yaz:firmalar">${IK.sil}<span>Firmayı sil</span></button></div></div>
      </div>
    </header>
    <div class="fs-act" data-gerek="yaz:firmalar"><button class="btn sm primary" data-a="duzenle">Düzenle</button></div>
    <div data-cift></div>
    <div class="p-sekme fs-sekme" role="tablist" aria-label="Firma bölümleri">${SEKMELER.map(([k, t, g]) => `<button type="button" role="tab" data-fsk="${k}" ${g ? `data-gerek="${g}"` : ''} aria-selected="${k === sekme}" class="${k === sekme ? 'on' : ''}">${t}${sayi[k] ? ` <i>${sayi[k]}</i>` : ''}</button>`).join('')}</div>

    <div class="fs-ic" data-fs="ozet" role="tabpanel" ${sekme === 'ozet' ? '' : 'hidden'}><div class="fs-izgara">
      <section class="card"><h2>İletişim ve konum</h2>${dlk(`
        ${dd('Telefon', x.telefon ? `<a href="tel:${esc(x.telefon)}">${esc(x.telefon)}</a>` : '')}${dd('E-posta', x.eposta ? `<a href="mailto:${esc(x.eposta)}">${esc(x.eposta)}</a>` : '')}${dd('Web', web ? `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(x.web)}</a>` : '')}
        ${dd('İl / ilçe', esc([x.il, x.ilce].filter(Boolean).join(' / ')))}${dd('OSB', esc(x.osb || ''))}${dd('Belde', esc(x.belde || ''))}${dd('Adres', esc(x.adres || ''))}
        ${dd('Sektör', esc(x.sektor || ''))}${dd('Segment', esc(x.segment || ''))}${dd('Vergi no', esc(x.vergi_no || ''))}${dd('Sorumlu', esc((app.ekipTum || []).find(k => k.eposta === x.sorumlu)?.ad || x.sorumlu || ''))}
`)}${!x.telefon && !x.eposta && !x.il && !x.adres ? '<p class="hint">İletişim bilgisi girilmemiş.</p>' : ''}
        <div class="btnrow" data-gerek="yaz:firmalar"><button type="button" class="btn sm ghost" data-a="duzenle">Bilgileri düzenle</button></div></section>
      <section class="card" data-gerek="kisiler"><div class="fs-kb"><h2>Kişiler <span class="muted">${kisiler.length}</span></h2>${kisiler.length > 4 ? tumu('kisiler', kisiler.length) : ''}</div>
        ${kisiler.length ? `<ul class="cards">${kisiler.slice(0, 4).map(k => kisiSatir(k) + '</li>').join('')}</ul>` : '<p class="hint">Henüz kişi eklenmedi.</p>'}
        ${kisiler.length >= 2 ? `<button type="button" class="linkbtn" data-git="kisiler">Organizasyon şemasını gör →</button>` : ''}</section>
      <section class="card" data-gerek="projeler"><div class="fs-kb"><h2>Açık projeler <span class="muted">${acik.length}</span></h2>${projeler.length > acik.slice(0, 5).length ? tumu('projeler', projeler.length) : ''}</div>
        ${acik.length ? `<ul class="list">${acik.slice(0, 5).map(projeSatir).join('')}</ul>` : `<p class="hint">${projeler.length ? 'Açık proje yok.' : 'Bu firmanın yer aldığı proje yok.'}</p>`}</section>
      <section class="card" data-gerek="ziyaretler"><div class="fs-kb"><h2>Ziyaretler</h2>${ziy.length > 3 ? tumu('ziyaret', ziy.length) : ''}</div>
        ${planli.length ? `<p class="fs-plan"><b>Planlı:</b> ${tarih(planli[0].tarih)}${planli[0].amac ? ' · ' + esc(planli[0].amac) : ''}</p>` : ''}
        ${yapilan.length ? `<ul class="list">${yapilan.slice(0, 3).map(ziySatir).join('')}</ul>` : '<p class="hint">Ziyaret kaydı yok.</p>'}
        ${acikGor.length ? `<h3>Açık görevler <span class="muted">${acikGor.length}</span></h3><ul class="list">${acikGor.slice(0, 3).map(gorSatir).join('')}</ul>` : ''}</section>
      ${x.notlar ? `<section class="card fs-not"><div class="fs-kb"><h2>Notlar</h2><button type="button" class="linkbtn fs-tumu" data-git="notlar">Notlar →</button></div><p class="fs-notmetin">${esc(x.notlar.length > 400 ? x.notlar.slice(0, 400) + '…' : x.notlar)}</p></section>` : ''}
      ${stok.length ? `<section class="card"><h2>Depo stoğu</h2><p class="hint">${stok.filter(u => u.stok > 0).length} kalem stokta. <a href="#/urunler">Stok ve fiyat ekranında aç</a></p></section>` : ''}
    </div></div>

    <div class="fs-ic" data-fs="kisiler" role="tabpanel" ${sekme === 'kisiler' ? '' : 'hidden'}>
      <section class="card" data-gerek="kisiler"><div class="fs-kb"><h2>Kişiler <span class="muted">${kisiler.length}</span></h2></div>
        ${kisiler.length ? `<ul class="cards">${kisiler.map(k => kisiSatir(k) + `<button type="button" class="btn sm ghost" data-ayir="${k.id}" data-gerek="yaz:kisiler" aria-label="${esc(k.ad_soyad)} kişisini bu firmadan ayır">Ayır</button></li>`).join('')}</ul>` : '<p class="hint">Henüz kişi eklenmedi.</p>'}
        <div class="btnrow" data-gerek="yaz:kisiler"><button type="button" class="btn sm" data-a="kisi">Yeni kişi</button><button type="button" class="btn sm ghost" data-a="bagla">Kayıtlı kişiyi bu firmaya ata</button></div>
        <div class="kisi-sec" data-kisi-sec hidden><input type="search" placeholder="Kişi adı, telefon ya da e-posta…" aria-label="Atanacak kişiyi ara" data-kisi-ara><ul class="list" data-kisi-sonuc></ul></div>
        ${eskiler.length ? `<h3 class="eski-baslik">Eski çalışanlar <span class="muted">${eskiler.length}</span></h3><ul class="list">${eskiler.map(k => { const g = k.eski_firmalar.find(g => g.firma_id === x.id); return `<li><a href="#/kisi/${k.id}"><b>${esc(k.ad_soyad)}</b></a><small class="muted">${esc([g.unvan, g.bitis ? tarih(g.bitis) + ' tarihine kadar' : '', k.firma_id ? 'şimdi: ' + firmaAd(k.firma_id) : ''].filter(Boolean).join(' · '))}</small></li>`; }).join('')}</ul>` : ''}</section>
      ${kisiler.length >= 2 || eskiler.length ? `<section class="card org-bolum" data-gerek="kisiler" data-org><h2>Organizasyon şeması</h2></section>` : ''}
    </div>

    <div class="fs-ic" data-fs="projeler" role="tabpanel" ${sekme === 'projeler' ? '' : 'hidden'}>
      <section class="card" data-iliski data-gerek="projeler !iliski"></section>
      <section class="card" data-gerek="projeler"><h2>Projeler <span class="muted">${projeler.length}</span></h2>
        ${projeler.length ? `<ul class="list" data-projeler>${projeler.sort((a, b) => ACIK.includes(b.durum) - ACIK.includes(a.durum) || (+b.tutar_usd || 0) - (+a.tutar_usd || 0)).map((p, i) => i < 10 ? projeSatir(p) : projeSatir(p).replace('<li>', '<li hidden data-fazla>')).join('')}</ul>
          ${projeler.length > 10 ? `<button type="button" class="btn sm ghost fs-devam" data-devam>Devamını göster (${projeler.length - 10} proje daha)</button>` : ''}` : '<p class="hint">Bu firmanın yer aldığı proje yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="ziyaret" role="tabpanel" ${sekme === 'ziyaret' ? '' : 'hidden'}>
      <section class="card" data-gerek="ziyaretler"><div class="fs-kb"><h2>Ziyaretler <span class="muted">${ziy.length}</span></h2><button type="button" class="btn sm" data-a="ziyaret" data-gerek="yaz:ziyaretler">Ziyaret ekle</button></div>
        ${ziy.length ? `<ul class="list">${ziy.map(ziySatir).join('')}</ul>` : '<p class="hint">Ziyaret kaydı yok.</p>'}</section>
      <section class="card" data-gerek="gorevler"><div class="fs-kb"><h2>Görevler <span class="muted">${gor.length}</span></h2><button type="button" class="btn sm" data-a="gorev" data-gerek="yaz:gorevler">Görev ekle</button></div>
        ${gor.length ? `<ul class="list">${gor.map(gorSatir).join('')}</ul>` : '<p class="hint">Bu firmaya bağlı görev yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="satis" role="tabpanel" ${sekme === 'satis' ? '' : 'hidden'}>
      <section class="card" data-gerek="teklifler"><div class="fs-kb"><h2>Teklifler <span class="muted">${tek.length}</span></h2><button type="button" class="btn sm" data-a="teklif" data-gerek="yaz:teklifler">Teklif hazırla</button></div>
        ${tek.length ? `<ul class="list">${tek.map(t => `<li><button type="button" class="linkbtn" data-tk="${t.id}">${esc(t.teklif_no || 'Teklif')}</button><span class="muted">${tarih(t.tarih)} · ${esc(t.durum || '')}</span><b class="num">${num(t.toplam)} ${esc(t.para_birimi || '')}</b></li>`).join('')}</ul>` : '<p class="hint">Teklif yok.</p>'}</section>
      <section class="card" data-gerek="siparisler"><h2>Siparişler <span class="muted">${sip.length}</span></h2>
        ${sip.length ? `<ul class="list">${sip.map(s => `<li class="${s.rapor_disi ? 'disi' : ''}"><span class="muted">${tarih(s.tarih)}</span><button type="button" class="linkrow" data-sp="${s.id}"><b>${esc(s.siparis_no || 'Sipariş')} · ${esc(s.referans || s.musteri_adi || '')}</b></button><b class="num">${num(s.net_deger)} ${esc(s.para_birimi)}</b></li>`).join('')}</ul><p class="hint">Toplam: ${usd(sipT)}</p>` : '<p class="hint">Sipariş listesinde bu firmaya bağlı kayıt yok.</p>'}</section>
      <section class="card" data-tahsilat data-gerek="tahsilatlar"></section>
      <section class="card" data-gerek="numuneler"><div class="fs-kb"><h2>Numuneler <span class="muted">${num_.length}</span></h2><button type="button" class="btn sm ghost" data-a="numune" data-gerek="yaz:numuneler">Numune ver</button></div>
        ${num_.length ? `<ul class="list">${num_.map(n => `<li><button type="button" class="linkrow" data-nm="${n.id}"><b>${esc([n.urun_kod, n.urun_ad].filter(Boolean).join(' · ') || 'Numune')}</b></button><span class="muted">${tarih(n.verilis)} · ${esc(n.durum || '')}</span></li>`).join('')}</ul>` : '<p class="hint">Numune kaydı yok.</p>'}</section>
      <section class="card" data-gerek="servis_kayitlari"><div class="fs-kb"><h2>Servis kayıtları <span class="muted">${srv.length}</span></h2><button type="button" class="btn sm ghost" data-a="servis" data-gerek="yaz:servis_kayitlari">Servis kaydı</button></div>
        ${srv.length ? `<ul class="list">${srv.map(n => `<li><button type="button" class="linkrow" data-sv="${n.id}"><b>${esc([n.tip, n.urun].filter(Boolean).join(' · '))}</b></button><span class="muted">${tarih(n.tarih)} · ${esc(n.durum || '')}</span></li>`).join('')}</ul>` : '<p class="hint">Servis kaydı yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="belgeler" role="tabpanel" ${sekme === 'belgeler' ? '' : 'hidden'}><section class="card" data-belgeler data-gerek="belgeler"></section></div>

    <div class="fs-ic" data-fs="notlar" role="tabpanel" ${sekme === 'notlar' ? '' : 'hidden'}>
      <section class="card"><div class="fs-kb"><h2>Notlar</h2><button type="button" class="btn sm ghost" data-a="not" data-gerek="yaz:firmalar">${x.notlar ? 'Notu düzenle' : 'Not ekle'}</button></div>
        ${x.notlar ? `<p class="fs-notmetin">${esc(x.notlar)}</p>` : '<p class="hint">Not yok.</p>'}
        ${(x.fotolar || []).length ? `<h3>Fotoğraflar <span class="muted">${x.fotolar.length}</span></h3><div class="ph-list fs-foto">${x.fotolar.map(p => `<figure class="thumb"><img alt="" data-path="${esc(p)}"></figure>`).join('')}</div>` : ''}</section>
      <section class="card" data-yorumlar data-gerek="yorumlar"></section>
      <section class="card" data-gecmis></section>
    </div>
  </div>`;

  gerekUygula(el);
  acilirKur(el); araciTemizle(el);
  ciftUyarisi(el, 'firmalar', x);
  el.querySelector('[data-geri]').onclick = () => sayfadanDon('firmalar');
  el.querySelectorAll('.avatar[data-kv]').forEach(async a => { if (a.dataset.kv) { const u = await app.db.url(a.dataset.kv, true); if (u) { a.style.backgroundImage = `url("${u}")`; a.textContent = ''; } } });

  // Sekmeler: içerik ilk açılışta kurulur (şema ve listeler görünürken ölçülsün)
  const KUR = {
    kisiler: () => orgKur(el, x, kisiler, eskiler),
    projeler: () => import('../iliski.js').then(m => m.iliskiBolumu(el.querySelector('[data-iliski]'), x)),
    satis: () => import('./tahsilat.js').then(m => m.tahsilatOzeti(el.querySelector('[data-tahsilat]'), x)),
    belgeler: () => belgeBolumu(el.querySelector('[data-belgeler]'), { firma_id: x.id }),
    notlar: () => {
      import('../yorum.js').then(m => m.yorumBolumu(el.querySelector('[data-yorumlar]'), 'firmalar', x));
      import('../gecmis.js').then(m => m.kayitGecmisi(el.querySelector('[data-gecmis]'), 'firmalar', x.id));
      el.querySelectorAll('.fs-foto img[data-path]').forEach(async img => { const u = await app.db.url(img.dataset.path, true); if (u) { img.src = u; img.onclick = () => window.open(u, '_blank'); } });
    },
  };
  sekmeKur(el, { taban: 'firma/' + x.id, sekme, KUR });

  // Kayıt bağlantıları
  el.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
  el.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.gid }));
  el.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => teklifForm({ id: b.dataset.tk }));
  el.querySelectorAll('[data-sp]').forEach(b => b.onclick = async () => (await import('./panel.js')).siparisForm({ id: b.dataset.sp }));
  el.querySelectorAll('[data-nm]').forEach(b => b.onclick = () => numuneForm({ id: b.dataset.nm }));
  el.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => servisForm({ id: b.dataset.sv }));

  // Kayıtlı bir kişiyi bu firmaya ata / firmadan ayır
  const kisiAra = () => {
    const q = el.querySelector('[data-kisi-ara]')?.value || '', ul = el.querySelector('[data-kisi-sonuc]'); if (!ul) return;
    const l = S.kisiler.filter(k => k.firma_id !== x.id && match(q, k.ad_soyad, k.telefon, k.eposta, firmaAd(k.firma_id))).sort((a, b) => (a.firma_id ? 1 : 0) - (b.firma_id ? 1 : 0) || a.ad_soyad.localeCompare(b.ad_soyad, 'tr')).slice(0, 8);
    ul.innerHTML = l.length ? l.map(k => `<li><button type="button" class="linkrow" data-ata="${k.id}"><b>${esc(k.ad_soyad)}</b><small class="muted">${esc(k.firma_id ? 'şu an: ' + (firmaAd(k.firma_id) || '?') : 'firması yok')}${k.telefon ? ' · ' + esc(k.telefon) : ''}</small></button></li>`).join('') : '<li class="hint">Eşleşen kişi yok. “Yeni kişi” ile ekleyebilirsin.</li>';
    ul.querySelectorAll('[data-ata]').forEach(b => b.onclick = async () => {
      const k = S.kisiler.find(z => z.id === b.dataset.ata); if (!k) return;
      if (k.firma_id && !confirmBox(`${k.ad_soyad} şu an “${firmaAd(k.firma_id)}” firmasında. Bu firmaya taşınsın mı?`)) return;
      try { await app.db.save('kisiler', { ...k, firma_id: x.id }); toast(`${k.ad_soyad} bu firmaya atandı.`); app.refresh(); } catch (e) { toast(e.message, 'err'); }
    });
  };
  el.querySelector('[data-kisi-ara]')?.addEventListener('input', kisiAra);
  el.querySelectorAll('[data-ayir]').forEach(b => b.onclick = async () => {
    const k = S.kisiler.find(z => z.id === b.dataset.ayir); if (!k || !confirmBox(`${k.ad_soyad} bu firmadan ayrılsın mı? Kişi silinmez, firması boş kalır.`)) return;
    try { await app.db.save('kisiler', { ...k, firma_id: null }); toast('Kişi firmadan ayrıldı.'); app.refresh(); } catch (e) { toast(e.message, 'err'); }
  });

  el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'duzenle') firmaFormu(x.id);
    if (a === 'not') firmaFormu(x.id, null, { odak: 'notlar' });
    if (a === 'kisi') kisiDetay(null, { firma_id: x.id });
    if (a === 'bagla') { const k = el.querySelector('[data-kisi-sec]'); k.hidden = !k.hidden; if (!k.hidden) { kisiAra(); k.querySelector('input').focus(); } }
    if (a === 'wa') waGonder({ firma: x, kisi: kisiler.find(k => k.telefon) || null });
    if (a === 'gorev') gorevForm({ firma_id: x.id });
    if (a === 'teklif') teklifForm({ firma_id: x.id, kisi_id: kisiler[0]?.id || null });
    if (a === 'numune') numuneForm({ firma_id: x.id, kisi_id: kisiler[0]?.id || null });
    if (a === 'servis') servisForm({ firma_id: x.id });
    if (a === 'ziyaret') ziyaretForm({ firma_id: x.id });
    if (a === 'google') googleBul({ q: aramaMetni(x), hedef: { table: 'firmalar', rec: x }, sonra: () => app.refresh() });
    if (a === 'sil' && confirmBox(`“${x.ad}” silinsin mi? Projelerdeki bağlantıları boşaltılır.`)) {
      await app.db.del('firmalar', x.id);
      for (const p of S.projeler) { const ch = {}; for (const k of ['yatirimci_id', 'projeci_id', 'danisman_id', 'gemut_id', 'emut_id', 'alici_id', 'bayi_id']) if (p[k] === x.id) ch[k] = null; if (Object.keys(ch).length) await app.db.save('projeler', { ...p, ...ch }); }
      toast('Firma silindi.'); location.hash = '#/firmalar';
    }
  });
}

// Organizasyon şeması (Kişiler ve şema sekmesi)
function orgKur(el, x, kisiler, eskiler) {
  const orgKok = el.querySelector('[data-org]'); if (!orgKok) return;
  return import('../orgsema.js').then(({ orgSemasi, orgSurukle, orgYakinlastir, orgHizliDuzen }) => {
    const o = orgSemasi(kisiler, { firmaAd: x.ad, eskiler, firmaId: x.id, firmaAdiOf: firmaAd });
    const yazar = rotaYazilabilir('kisiler');
    orgKok.insertAdjacentHTML('beforeend', o.ozet + o.html + `<p class="hint">${yazar ? 'Kişiye dokun: unvanını, bölümünü ve kime bağlı olduğunu değiştir. Bir kişiyi başka bir kişinin üstüne sürükle (telefonda basılı tutup sürükle): o kişiye bağlanır. Bir yöneticinin altındaki bölüm etiketine bırakınca o bölüme geçer. Ctrl ile tıklayınca kişi kartı açılır.' : 'Kişi kartında “Bağlı olduğu kişi” seçilerek ağaç kurulur.'}</p>`);
    requestAnimationFrame(() => { const k = orgKok.querySelector('.org-kaydir'); if (k && k.scrollWidth > k.clientWidth) k.scrollLeft = (k.scrollWidth - k.clientWidth) / 2; });
    const kaydetK = async (id, d) => { const k = byId('kisiler', id); if (!k) return; try { await app.db.save('kisiler', { ...k, ...d }); toast('ust_kisi_id' in d && Object.keys(d).length <= 2 && d.ust_kisi_id ? `${k.ad_soyad} → ${byId('kisiler', d.ust_kisi_id)?.ad_soyad} altına bağlandı.` : `${k.ad_soyad} güncellendi.`); app.refresh(); } catch (e) { toast(e.message, 'err'); } };
    orgYakinlastir(orgKok, { anahtar: 'org-zoom-' + x.id });
    if (yazar) orgSurukle(orgKok, { kisiler, kaydet: kaydetK, duzenle: id => orgHizliDuzen(byId('kisiler', id), { kisiler, POZ: POZISYONLAR, kaydet: kaydetK, kartiAc: kid => { location.hash = '#/kisi/' + kid; } }) });
  });
}
