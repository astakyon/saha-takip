// Proje kartı: kendi sayfası (#/proje/<id>[/<sekme>]). Firma ve kişi sayfasıyla aynı düzen; ek olarak aşama şeridi
// ve "Projedeki firmalar" özeti. Düzenleme ve aşama değişikliğinin ek bilgisi (sipariş, kayıp) pencerede (projeFormu).
import { S } from '../db.js';
import { app } from '../state.js';
import { gerekUygula, rotaYazilabilir } from '../yetki.js';
import { esc, usd, num, pill, tarih, today, byId, firmaAd, toast, confirmBox, directionsUrl, DURUMLAR, durumRenk } from '../ui.js';
import { eaeKatalog } from '../profil.js';
import { sayfadanDon, sayfaOncesiAd } from '../main.js';
import { IK, acilirKur, sekmeKur, araciTemizle } from '../sayfa.js';
import { projeFormu, santiyeBolumu } from './projeler.js';
import { ziyaretForm, gorevForm } from './ziyaret.js';
import { waGonder } from '../sablon.js';
import { teklifForm } from './teklif.js';
import { numuneForm } from './kayitlar.js';
import { belgeBolumu, belgeleri } from '../belgeler.js';
import { googleBul, aramaMetni } from '../google.js';
import { grubu, haritaOzeti, haritaBolumu, kisiSec } from '../satisharitasi.js';

export const ROLLER = [['yatirimci_id', 'Yatırımcı'], ['projeci_id', 'Projeci'], ['danisman_id', 'Danışman'], ['gemut_id', 'Gemüt'], ['emut_id', 'Emüt'], ['alici_id', 'Malzeme alıcısı'], ['bayi_id', 'Bayi']];
const SERIT = ['Proje', 'İhale', 'Teklif Verildi', 'Sıcak', 'Sipariş'], YAN = ['Beklemede', 'Kayıp', 'İptal'];
const KLASOR = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>';
const ayAd = d => d ? new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : '';

export function projeSayfa(el, id) {
  const p = byId('projeler', id);
  if (!p) { el.innerHTML = `<div class="empty"><p>Proje bulunamadı. Silinmiş ya da görme yetkin olmayabilir.</p><p><a class="btn" href="#/projeler">Projelere dön</a></p></div>`; return; }
  document.title = p.ad + ' · Saha Takip'; app.sayfaAd = p.ad;
  const renk = durumRenk(p.durum);
  const ziy = S.ziyaretler.filter(z => z.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const yapilan = ziy.filter(z => (z.durum || 'Yapıldı') === 'Yapıldı'), planli = ziy.filter(z => z.durum === 'Planlandı').sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  const gor = (S.gorevler || []).filter(g => g.proje_id === p.id).sort((a, b) => (a.durum === 'Tamam') - (b.durum === 'Tamam') || (a.son_tarih || '9').localeCompare(b.son_tarih || '9'));
  const acikGor = gor.filter(g => g.durum !== 'Tamam');
  const tek = (S.teklifler || []).filter(x => x.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const sip = (S.siparisler || []).filter(s => s.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const gec = (S.proje_gecmis || []).filter(g => g.proje_id === p.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const yorumN = (S.yorumlar || []).filter(y => y.kayit_id === p.id).length, belgeN = belgeleri({ proje_id: p.id }).length;
  const ilgili = byId('kisiler', p.ilgili_kisi_id);
  const tel = ilgili?.telefon || p.takipci_tel || '';
  const roller = ROLLER.filter(([r]) => p[r]).map(([r, ad]) => ({ r, ad, f: byId('firmalar', p[r]) })).filter(x => x.f);
  const firmaIdleri = [...new Set(roller.map(x => x.f.id))];
  const gun = yapilan[0] ? Math.round((new Date(today()) - new Date(yapilan[0].tarih)) / 864e5) : null;
  const kg = grubu(p);
  const sayi = { harita: kg.length, ziyaret: ziy.length + acikGor.length, satis: tek.length + sip.length, belgeler: belgeN, yorum: yorumN, gecmis: gec.length };
  const SEKMELER = [['ozet', 'Özet', ''], ['harita', 'Satış haritası', 'kisiler'], ['ziyaret', 'Ziyaret ve görevler', 'ziyaretler,gorevler'], ['satis', 'Teklif ve sipariş', 'teklifler,siparisler'],
    ...(eaeKatalog() ? [['urun', 'Ürün ve şartname', 'teklifler']] : []), ['belgeler', 'Belgeler ve şantiye', ''], ['yorum', 'Yorumlar', 'yorumlar'], ['gecmis', 'Geçmiş', '']];
  const onceki = sayfaOncesiAd();
  const yazar = rotaYazilabilir('projeler');
  const dlk = ic => ic.trim() ? `<dl class="profil-dl">${ic}</dl>` : '';
  const dd = (ad, v) => v ? `<dt>${ad}</dt><dd>${v}</dd>` : '';
  const ziySatir = z => `<li><span class="muted">${tarih(z.tarih)}${z.durum === 'Planlandı' ? ' · planlı' : ''}</span><button type="button" class="linkrow" data-zid="${z.id}"><span>${esc([firmaAd(z.firma_id), byId('kisiler', z.kisi_id)?.ad_soyad, z.amac].filter(Boolean).join(' · ') || 'Ziyaret')}${z.notlar ? ` <span class="muted">${esc(z.notlar.slice(0, 140))}</span>` : ''}</span></button></li>`;
  const gorSatir = g => `<li><button type="button" class="linkrow" data-gid="${g.id}"><span>${g.durum === 'Tamam' ? '✓' : '○'} ${esc(g.baslik)}</span></button><span class="muted ${g.durum !== 'Tamam' && g.son_tarih && g.son_tarih < today() ? 'neg' : ''}">${tarih(g.son_tarih)}</span></li>`;
  const seritI = SERIT.indexOf(p.durum);
  const asama = `<div class="ps-serit" role="group" aria-label="Aşama" data-gerek="yaz:projeler">${SERIT.map((d, i) => `<button type="button" data-asama="${d}" class="${d === p.durum ? 'on' : i < seritI ? 'gec' : ''}" style="--c:${durumRenk(d)}" aria-pressed="${d === p.durum}">${esc(d)}</button>`).join('')}</div>
    <div class="ps-yan" data-gerek="yaz:projeler">${YAN.map(d => `<button type="button" data-asama="${d}" class="${d === p.durum ? 'on' : ''}" style="--c:${durumRenk(d)}" aria-pressed="${d === p.durum}">${esc(d)}</button>`).join('')}</div>`;

  const bilgiIc = dlk(dd('Sektör', esc([p.sektor, p.alt_sektor].filter(Boolean).join(' · '))) + dd('İçerik', esc(p.icerik || '')) + dd('Ürün grupları', esc((p.urun_gruplari || []).join(', '))) + dd('Yeni / yenileme', esc(p.yeni_refit || '')) + dd('Satış kanalı', esc(p.kanal || '')) + dd('Takip eden', esc([p.takipci, p.takipci_tel].filter(Boolean).join(' · '))) + dd('Teklif no', esc(p.teklif_no || '')) + dd('İhale tarihi', p.ihale_tarihi ? tarih(p.ihale_tarihi) : '') + dd('Şantiye aşaması', esc(p.santiye_asamasi || '')) + dd('Takip yılı', esc(p.takip_yili || '')) + dd('Sorulacak', esc(p.sorulacak || '')) + dd('Sorumlu', esc((app.ekipTum || []).find(k => k.eposta === p.sorumlu)?.ad || p.sorumlu || ''))) + (p.notlar ? `<h3>Notlar</h3><p class="fs-notmetin">${esc(p.notlar)}</p>` : '');
  const bilgiKart = bilgiIc.trim() ? `<section class="card fs-not"><h2>Proje bilgileri</h2>${bilgiIc}</section>` : '';
  el.innerHTML = `<div class="fs-sayfa ps-sayfa" data-proje="${esc(p.id)}" style="--durum:${renk}">
    <button type="button" class="geri-lnk" data-geri>← ${esc(onceki || 'Projeler')}</button>
    <header class="fs-bas">
      <span class="fs-logo ps-logo" aria-hidden="true">${KLASOR}</span>
      <div class="fs-kim"><p class="muted">${esc(['Proje', [p.ilce, p.il].filter(Boolean).join(', '), p.osb].filter(Boolean).join(' · '))}</p>
        <h1>${esc(p.ad)}${p.kritik ? ' <em class="flag">Kritik</em>' : ''}${p.referans ? ' <em class="flag soft">Referans</em>' : ''}</h1>
        <div class="dh-meta">${pill(p.durum)}${p.tutar_usd ? `<b class="ps-tutar">${usd(p.tutar_usd)}</b>` : ''}${p.olasilik != null && p.olasilik !== '' ? `<span>olasılık %${num(p.olasilik)}</span>` : ''}${p.beklenen_tarih ? `<span>beklenen sipariş ${esc(ayAd(p.beklenen_tarih))}</span>` : ''}<span data-gerek="ziyaretler" class="${gun == null || gun > 60 ? 'neg' : ''}">${gun == null ? 'hiç ziyaret yok' : gun === 0 ? 'bugün ziyaret edildi' : `son ziyaret ${gun} gün önce`}</span></div></div>
      <div class="fs-arac" role="toolbar" aria-label="Proje işlemleri">
        <div class="fs-grp" data-grp="iletisim">${tel ? `<a href="tel:${esc(tel)}" data-ipucu="${ilgili?.telefon ? 'Ara: ' + esc(ilgili.ad_soyad) : 'Takip edeni ara'}" aria-label="Ara">${IK.tel}</a>` : ''}${ilgili?.telefon ? `<button type="button" data-a="wa" data-ipucu="WhatsApp: ${esc(ilgili.ad_soyad)}" aria-label="WhatsApp" class="fs-wa">${IK.wa}</button>` : ''}${p.lat != null ? `<a target="_blank" rel="noopener" href="${directionsUrl(p.lat, p.lng)}" data-ipucu="Şantiyeye yol tarifi" aria-label="Yol tarifi" class="fs-yol">${IK.yol}</a>` : ''}</div>
        <div class="fs-grp" data-grp="ekle"><button type="button" data-a="ziyaret" data-gerek="yaz:ziyaretler" data-ipucu="Ziyaret ekle" aria-label="Ziyaret ekle">${IK.pin}</button><button type="button" data-a="gorev" data-gerek="yaz:gorevler" data-ipucu="Görev ekle" aria-label="Görev ekle">${IK.gor}</button><button type="button" data-a="teklif" data-gerek="yaz:teklifler" data-ipucu="Teklif hazırla" aria-label="Teklif hazırla">${IK.tek}</button><button type="button" data-a="numune" data-gerek="yaz:numuneler" data-ipucu="Numune ver" aria-label="Numune ver">${IK.num}</button></div>
        <div class="fs-grp fs-acilir" data-acilir="daha"><button type="button" class="fs-daha" aria-haspopup="menu" aria-expanded="false" aria-label="Diğer işlemler" data-ipucu="Diğer">⋯</button>
          <div class="fs-menu fs-menu-sag" role="menu" hidden>
            <button type="button" role="menuitem" data-a="google" data-gerek="yaz:projeler">${IK.ara}<span>Google'dan konum al</span></button>${p.google_url ? `<a role="menuitem" href="${esc(p.google_url)}" target="_blank" rel="noopener">${IK.yol}<span>Google Haritalar'da aç</span></a>` : ''}
            <button type="button" role="menuitem" data-a="kopya" data-gerek="yaz:projeler">${IK.tek}<span>Projeyi kopyala</span></button>
            <hr><button type="button" role="menuitem" class="fs-sil" data-a="sil" data-gerek="yaz:projeler">${IK.sil}<span>Projeyi sil</span></button></div></div>
      </div>
    </header>
    <div class="fs-act" data-gerek="yaz:projeler"><button class="btn sm primary" data-a="duzenle">Düzenle</button></div>
    ${yazar ? `<div class="ps-asama">${asama}</div>` : ''}
    <div class="p-sekme fs-sekme" role="tablist" aria-label="Proje bölümleri">${SEKMELER.map(([s, t, g]) => `<button type="button" role="tab" data-fsk="${s}" ${g ? `data-gerek="${g}"` : ''} aria-selected="false">${t}${sayi[s] ? ` <i>${sayi[s]}</i>` : ''}</button>`).join('')}</div>

    <div class="fs-ic" data-fs="ozet" role="tabpanel" hidden><div class="fs-izgara ps-izgara">
      <section class="card" data-gerek="firmalar"><div class="fs-kb"><h2>Projedeki firmalar</h2>${roller.length ? `<button type="button" class="linkbtn fs-tumu" data-git="harita">Kişilerle →</button>` : ''}</div>
        <div class="ps-pay">${ROLLER.map(([r, ad]) => { const f = byId('firmalar', p[r]); if (r === 'bayi_id' && p.kanal === 'Direkt' && !f) return ''; return f ? `<a href="#/firma/${f.id}"><small>${ad}</small><b>${esc(f.ad)}</b></a>` : `<span class="bos"><small>${ad}</small><b>—</b></span>`; }).join('')}
          ${ilgili ? `<a href="#/kisi/${ilgili.id}"><small>İlgili kişi</small><b>${esc(ilgili.ad_soyad)}</b>${ilgili.firma_id ? `<span class="muted">${esc(firmaAd(ilgili.firma_id))}</span>` : ''}</a>` : ''}</div>
        ${!roller.length ? `<p class="hint">Projeye firma eklenmemiş. <button type="button" class="linkbtn" data-a="duzenle">Düzenle</button> ile Emüt, alıcı, bayi… seç.</p>` : ''}</section>
      <div class="ps-sag">
        <section class="card sh-ozet" data-gerek="kisiler"><div class="fs-kb"><h2>Satış haritası</h2><button type="button" class="linkbtn fs-tumu" data-git="harita">Haritayı aç →</button></div>${haritaOzeti(p)}</section>
        <section class="card"><h2>Konum</h2>${dlk(dd('İl / ilçe', esc([p.il, p.ilce].filter(Boolean).join(' / '))) + dd('OSB', esc(p.osb || '')) + dd('Belde', esc(p.belde || '')) + dd('Adres', esc(p.adres || '')) + dd('Not', esc(p.lokasyon || '')))}
          ${p.lat != null ? `<div class="btnrow"><a class="btn sm ghost" target="_blank" rel="noopener" href="${directionsUrl(p.lat, p.lng)}">Yol tarifi</a><a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}">Haritada gör</a></div>${p.konum_yaklasik ? '<p class="hint">Konum yaklaşık.</p>' : ''}` : `<p class="hint">Haritada yeri işaretlenmemiş.</p>`}</section>
        <section class="card"><h2>Sıradaki</h2><ul class="list">
          ${acikGor.slice(0, 3).map(gorSatir).join('')}
          ${planli[0] ? `<li><span>Planlı ziyaret${planli[0].firma_id ? ' · ' + esc(firmaAd(planli[0].firma_id)) : ''}</span><span class="muted">${tarih(planli[0].tarih)}</span></li>` : ''}
          ${yapilan[0] ? `<li><button type="button" class="linkrow" data-zid="${yapilan[0].id}"><span>Son ziyaret${yapilan[0].kisi_id ? ' · ' + esc(byId('kisiler', yapilan[0].kisi_id)?.ad_soyad || '') : yapilan[0].firma_id ? ' · ' + esc(firmaAd(yapilan[0].firma_id)) : ''}</span></button><span class="muted">${tarih(yapilan[0].tarih)}</span></li>` : ''}
          ${tek[0] ? `<li><button type="button" class="linkrow" data-tk="${tek[0].id}"><span>Teklif ${esc(tek[0].teklif_no || '')} · ${num(tek[0].toplam)} ${esc(tek[0].para_birimi || '')}</span></button><span class="muted">${esc(tek[0].durum || '')}</span></li>` : ''}
          ${!acikGor.length && !planli.length && !yapilan.length && !tek.length ? '<li class="hint">Görev, ziyaret ya da teklif yok.</li>' : ''}</ul></section>
      </div>
      ${p.durum === 'Kayıp' ? `<section class="card fs-not ps-kayip"><h2>Kayıp bilgisi</h2>${dlk(dd('Neden', esc(p.kayip_nedeni || '')) + dd('İşi alan marka', esc(p.rakip_marka || '')) + dd('Rakip ürün', esc(p.rakip_urun || '')) + dd('Rakip birim fiyat', p.rakip_birim_fiyat ? usd(p.rakip_birim_fiyat) : '') + dd('Bizim teklif', p.bizim_teklif_usd ? usd(p.bizim_teklif_usd) : '') + dd('Açıklama', esc(p.kayip_aciklama || '')))}</section>` : ''}
      ${p.durum === 'Sipariş' ? `<section class="card fs-not ps-siparis"><h2>Sipariş</h2>${dlk(dd('Tutar', p.siparis_tutari_usd ? usd(p.siparis_tutari_usd) : '') + dd('Tarih', p.siparis_tarihi ? tarih(p.siparis_tarihi) : ''))}</section>` : ''}
      ${bilgiKart}
    </div></div>

    <div class="fs-ic" data-fs="harita" role="tabpanel" hidden>
      <section class="card sh-kutu" data-harita></section>
      ${roller.length ? '<h2 class="ps-ara-baslik">Projedeki firmalar ve kişileri</h2>' : ''}
      ${roller.length ? firmaIdleri.map(fid => { const f = byId('firmalar', fid), rl = roller.filter(x => x.f.id === fid).map(x => x.ad), ks = S.kisiler.filter(k => k.firma_id === fid), sz = S.ziyaretler.filter(z => z.firma_id === fid && (z.durum || 'Yapıldı') === 'Yapıldı').sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))[0];
        return `<section class="card ps-firma"><div class="fs-kb"><h2><a href="#/firma/${f.id}">${esc(f.ad)}</a></h2><span class="chip">${esc(rl.join(', '))}</span></div>
          <p class="muted ps-firma-alt">${esc([f.telefon, f.il].filter(Boolean).join(' · '))}${sz ? ` · son ziyaret ${tarih(sz.tarih)}` : ' · ziyaret kaydı yok'}</p>
          ${ks.length ? `<ul class="cards ps-kisiler">${ks.slice(0, 8).map(k => `<li><a href="#/kisi/${k.id}" class="pcard"><span class="avatar">${esc(k.ad_soyad.slice(0, 1))}</span><span><b>${esc(k.ad_soyad)}${k.id === p.ilgili_kisi_id ? ' ★' : ''}</b><small>${esc([k.unvan || k.pozisyon, k.telefon].filter(Boolean).join(' · '))}</small></span></a>${kg.some(x => x.kisi_id === k.id) ? '<span class="chip sh-var">haritada</span>' : `<button type="button" class="btn sm ghost" data-shekle1="${k.id}" data-gerek="yaz:projeler">Haritaya ekle</button>`}</li>`).join('')}</ul>${ks.length > 8 ? `<p class="hint"><a href="#/firma/${f.id}/kisiler">${ks.length - 8} kişi daha →</a></p>` : ''}` : '<p class="hint">Bu firmada kayıtlı kişi yok.</p>'}</section>`; }).join('') : '<section class="card"><p class="hint">Projeye firma eklenmemiş.</p></section>'}
    </div>

    <div class="fs-ic" data-fs="ziyaret" role="tabpanel" hidden>
      <section class="card" data-gerek="ziyaretler"><div class="fs-kb"><h2>Ziyaretler <span class="muted">${ziy.length}</span></h2><button type="button" class="btn sm" data-a="ziyaret" data-gerek="yaz:ziyaretler">Ziyaret ekle</button></div>
        ${ziy.length ? `<ul class="list">${ziy.map(ziySatir).join('')}</ul>` : '<p class="hint">Bu projeye bağlı ziyaret yok.</p>'}</section>
      <section class="card" data-gerek="gorevler"><div class="fs-kb"><h2>Görevler <span class="muted">${gor.length}</span></h2><button type="button" class="btn sm" data-a="gorev" data-gerek="yaz:gorevler">Görev ekle</button></div>
        ${gor.length ? `<ul class="list">${gor.map(gorSatir).join('')}</ul>` : '<p class="hint">Bu projeye bağlı görev yok.</p>'}</section>
    </div>

    <div class="fs-ic" data-fs="satis" role="tabpanel" hidden>
      <section class="card" data-gerek="teklifler"><div class="fs-kb"><h2>Teklifler <span class="muted">${tek.length}</span></h2><button type="button" class="btn sm" data-a="teklif" data-gerek="yaz:teklifler">Teklif hazırla</button></div>
        ${tek.length ? `<ul class="list">${tek.map(x => `<li><button type="button" class="linkbtn" data-tk="${x.id}">${esc(x.teklif_no || 'Teklif')}</button><span class="muted">${tarih(x.tarih)} · ${esc(x.durum || '')}</span><b class="num">${num(x.toplam)} ${esc(x.para_birimi || '')}</b></li>`).join('')}</ul>` : '<p class="hint">Teklif yok.</p>'}</section>
      <section class="card" data-gerek="siparisler"><h2>Siparişler <span class="muted">${sip.length}</span></h2>
        ${sip.length ? `<ul class="list">${sip.map(s => `<li class="${s.rapor_disi ? 'disi' : ''}"><span class="muted">${tarih(s.tarih)}</span><button type="button" class="linkrow" data-sp="${s.id}"><b>${esc(s.siparis_no || 'Sipariş')} · ${esc(s.referans || s.musteri_adi || '')}</b>${s.siparis_notu ? `<span class="muted">Not: ${esc(s.siparis_notu.slice(0, 80))}</span>` : ''}</button><b class="num">${num(s.net_deger)} ${esc(s.para_birimi)}</b></li>`).join('')}</ul>
          <p class="hint">Toplam: ${usd(sip.filter(s => s.para_birimi === 'USD').reduce((a, s) => a + +s.net_deger, 0))}</p>` : '<p class="hint">Sipariş listesinde bu projeye bağlı kayıt yok.</p>'}</section>
    </div>

    ${eaeKatalog() ? `<div class="fs-ic" data-fs="urun" role="tabpanel" hidden><section class="card" data-oneri data-gerek="teklifler"></section><section class="card" data-sartname data-gerek="teklifler"></section></div>` : ''}

    <div class="fs-ic" data-fs="belgeler" role="tabpanel" hidden><section class="card" data-santiye></section><section class="card" data-belgeler data-gerek="belgeler"></section></div>

    <div class="fs-ic" data-fs="yorum" role="tabpanel" hidden><section class="card" data-yorumlar data-gerek="yorumlar"></section></div>

    <div class="fs-ic" data-fs="gecmis" role="tabpanel" hidden>
      <section class="card"><h2>Aşama geçmişi</h2>${gec.length ? `<ul class="list">${gec.map(g => `<li><span class="muted">${tarih(g.tarih)}</span><span>${g.eski_durum ? esc(g.eski_durum) + ' → ' : ''}${esc(g.yeni_durum)}${g.notlar ? ' · ' + esc(g.notlar) : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Aşama değişikliği kaydı yok.</p>'}</section>
      <section class="card" data-gecmis></section>
    </div>
  </div>`;

  gerekUygula(el);
  acilirKur(el); araciTemizle(el);
  el.querySelector('[data-geri]').onclick = () => sayfadanDon('projeler');
  sekmeKur(el, { taban: 'proje/' + p.id, KUR: {
    harita: () => haritaBolumu(el.querySelector('[data-harita]'), p, { yazar }),
    urun: () => import('../oneri.js').then(m => { m.oneriBolumu(el.querySelector('[data-oneri]'), p); m.sartnameBolumu(el.querySelector('[data-sartname]'), p); }),
    belgeler: () => { santiyeBolumu(el.querySelector('[data-santiye]'), p); belgeBolumu(el.querySelector('[data-belgeler]'), { proje_id: p.id }); },
    yorum: () => import('../yorum.js').then(m => m.yorumBolumu(el.querySelector('[data-yorumlar]'), 'projeler', p)),
    gecmis: () => import('../gecmis.js').then(m => m.kayitGecmisi(el.querySelector('[data-gecmis]'), 'projeler', p.id)),
  } });

  // Aşama şeridi: Sipariş ve Kayıp ek bilgi ister (pencerede); diğerleri hemen kaydedilir
  el.querySelectorAll('[data-asama]').forEach(b => b.onclick = async () => {
    const d = b.dataset.asama; if (d === p.durum) return;
    if (d === 'Sipariş' || d === 'Kayıp') return projeFormu(p.id, null, { durum: d });
    try {
      await app.db.save('projeler', { ...p, durum: d });
      await app.db.save('proje_gecmis', { proje_id: p.id, tarih: new Date().toISOString(), eski_durum: p.durum, yeni_durum: d });
      toast(`Aşama: ${p.durum} → ${d}`); app.refresh();
    } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
  });

  el.querySelectorAll('[data-shekle1]').forEach(b => b.onclick = () => kisiSec(p, kg, async liste => { try { await app.db.save('projeler', { ...p, karar_grubu: liste }); app.refresh(); } catch (e) { toast(e.message, 'err'); } }, [b.dataset.shekle1]));
  el.querySelectorAll('[data-zid]').forEach(b => b.onclick = () => ziyaretForm({ id: b.dataset.zid }));
  el.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => gorevForm({ id: b.dataset.gid }));
  el.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => teklifForm({ id: b.dataset.tk }));
  el.querySelectorAll('[data-sp]').forEach(b => b.onclick = async () => (await import('./panel.js')).siparisForm({ id: b.dataset.sp }));

  const firma = p.emut_id || p.alici_id || p.bayi_id || null;
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'duzenle') projeFormu(p.id);
    if (a === 'wa') waGonder({ kisi: ilgili, proje: p });
    if (a === 'ziyaret') ziyaretForm({ proje_id: p.id, firma_id: firma, kisi_id: p.ilgili_kisi_id || null });
    if (a === 'gorev') gorevForm({ proje_id: p.id, firma_id: firma, baslik: '' });
    if (a === 'teklif') teklifForm({ proje_id: p.id, firma_id: firma, kisi_id: p.ilgili_kisi_id || null });
    if (a === 'numune') numuneForm({ proje_id: p.id, firma_id: p.emut_id || p.alici_id || null });
    if (a === 'google') googleBul({ q: aramaMetni(p), hedef: { table: 'projeler', rec: p }, sonra: () => app.refresh() });
    if (a === 'kopya') { const { id: _, created_at, updated_at, owner, ...k } = p; projeFormu(null, { ...k, ad: p.ad + ' (kopya)', durum: 'Proje', fotolar: [], google_place_id: null, google_url: null }); }
    if (a === 'sil' && confirmBox(`“${p.ad}” silinsin mi? Bu işlem geri alınamaz.`)) { await app.db.del('projeler', p.id); toast('Proje silindi.'); sayfadanDon('projeler'); }
  });
}
