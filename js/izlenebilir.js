// İzlenebilirlik ve paylaşım: seri / parti numaraları (garanti ve servis takibine bağlı) ve müşteriye / projeciye fiyatsız, salt okunur stok bağlantısı.
import { S, uuid, getConfig } from './db.js';
import { app } from './state.js';
import { esc, num, tarih, today, gunEkle, toast, openDrawer, closeDrawer, confirmBox, fold, firmaAd, waLink } from './ui.js';
import { firmaAdi } from './profil.js';
import { depoAdi } from './stok.js';

// ---------- Seri ve parti ----------
export const SERI_DURUM = ['Stokta', 'Satıldı', 'Serviste', 'İade'];
export const seriler = (firma_id, kod, depo) => (S.stok_seri || []).filter(x => x.firma_id === firma_id && x.kod === kod && (depo === undefined || (x.depo || null) === (depo || null)))
  .sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')) || String(a.no).localeCompare(String(b.no), 'tr', { numeric: true }));
// Seri / parti numarasından kalem ve servis kayıtları (garanti / servis sorgusu)
export const seriBul = no => { const k = fold(String(no || '').trim()); return k ? (S.stok_seri || []).filter(x => fold(String(x.no)) === k) : []; };
export const seriServisleri = no => { const k = fold(String(no || '').trim()); return k ? (S.servis_kayitlari || []).filter(s => s.seri_no && fold(String(s.seri_no)) === k) : []; };
export const garantiBitis = x => x.garanti_ay && x.tarih ? (d => { d.setMonth(d.getMonth() + +x.garanti_ay); return d.toISOString().slice(0, 10); })(new Date(String(x.tarih).slice(0, 10) + 'T00:00')) : null;
export async function seriKaydet(o) {
  const no = String(o.no || '').trim(); if (!no) throw new Error('Seri / parti numarasını yaz.');
  const ayni = (S.stok_seri || []).find(x => x.id !== o.id && x.firma_id === o.firma_id && x.kod === o.kod && fold(String(x.no)) === fold(no));
  if (ayni) throw new Error(`${no} bu üründe zaten kayıtlı.`);
  const r = { id: o.id || uuid(), firma_id: o.firma_id, kod: o.kod, depo: o.depo || null, tur: o.tur || 'Parti', no, adet: o.tur === 'Seri' ? 1 : (+o.adet || null), tarih: o.tarih || today(), durum: o.durum || 'Stokta',
    musteri_id: o.musteri_id || null, proje_id: o.proje_id || null, garanti_ay: o.garanti_ay === '' || o.garanti_ay == null ? null : +o.garanti_ay, notlar: o.notlar || null, uretim_tarihi: o.uretim_tarihi || null, son_tarih: o.son_tarih || null };
  await app.db.save('stok_seri', r); return r;
}
// Önce eski parti: çıkış / sevkte okutulan partiden daha eski (üretim ya da giriş tarihi) stokta parti varsa onu döndürür
export function eskiParti(firma_id, kod, no) {
  const l = (S.stok_seri || []).filter(x => x.firma_id === firma_id && x.kod === kod && x.tur !== 'Seri' && x.durum === 'Stokta' && (x.adet == null || +x.adet > 0));
  const yas = x => String(x.uretim_tarihi || x.tarih || '9999'), bu = l.find(x => fold(String(x.no)) === fold(String(no || '')));
  if (!bu) return null; return l.filter(x => x !== bu && yas(x) < yas(bu)).sort((a, b) => yas(a).localeCompare(yas(b)))[0] || null;
}
// Etiketle giriş / çıkışta parti miktarı: girişte parti yoksa açılır, varsa artar; çıkışta azalır
export async function partiHareketi(firma_id, kod, depo, no, adet) {
  if (!no || !adet) return;
  const x = (S.stok_seri || []).find(y => y.firma_id === firma_id && y.kod === kod && fold(String(y.no)) === fold(String(no)));
  if (x) { const yeni = Math.max(0, (+x.adet || 0) + adet); await app.db.save('stok_seri', { ...x, adet: yeni, durum: yeni > 0 ? 'Stokta' : x.durum === 'Stokta' ? 'Satıldı' : x.durum }); }
  else if (adet > 0) await seriKaydet({ firma_id, kod, depo, tur: 'Parti', no, adet });
}
// Kalem kartının altındaki bölüm
export function seriBolumu(s) {
  const l = seriler(s.firma_id, s.kod, s.depo ?? null);
  return `<section class="sr-bolum" data-sr="${s.id}"><h3>Seri / parti numaraları <small class="muted">${l.length || ''}</small></h3>
    ${l.length ? `<ul class="list">${l.map(x => { const sv = seriServisleri(x.no), gb = garantiBitis(x); return `<li><span><b class="mono">${esc(x.no)}</b> <small class="muted">${esc(x.tur)}${x.tur !== 'Seri' && x.adet ? ' · ' + num(x.adet) : ''} · ${tarih(x.tarih)}${x.uretim_tarihi ? ` · üretim ${tarih(x.uretim_tarihi)}` : ''}${x.son_tarih ? ` · son tarih ${String(x.son_tarih) < today() ? `<span class="neg">${tarih(x.son_tarih)} (geçti)</span>` : tarih(x.son_tarih)}` : ''}${gb ? ` · garanti ${gb < today() ? '<span class="neg">bitti</span>' : tarih(gb) + "'e kadar"}` : ''}${x.musteri_id ? ' · ' + esc(firmaAd(x.musteri_id) || '') : ''}</small>${sv.length ? ` <em class="flag soft">${sv.length} servis kaydı</em>` : ''}</span>
      <span class="btnrow"><select data-srdurum="${x.id}" aria-label="${esc(x.no)} durum">${SERI_DURUM.map(d => `<option ${d === x.durum ? 'selected' : ''}>${d}</option>`).join('')}</select><button type="button" class="btn sm ghost" data-srservis="${x.id}">Servis kaydı</button><button type="button" class="btn sm ghost danger" data-srsil="${x.id}" aria-label="${esc(x.no)} sil">Sil</button></span></li>`; }).join('')}</ul>` : '<p class="muted">Kayıtlı seri ya da parti numarası yok.</p>'}
    <div class="sr-ekle"><select data-srtur aria-label="Tür"><option>Parti</option><option>Seri</option></select><input data-srno placeholder="Parti / seri no" aria-label="Seri ya da parti numarası" autocomplete="off"><input data-sradet type="number" inputmode="decimal" placeholder="Miktar" aria-label="Partideki miktar"><input data-srgar type="number" inputmode="numeric" placeholder="Garanti (ay)" aria-label="Garanti süresi, ay"><label class="sr-t"><small>Üretim</small><input data-sruret type="date" aria-label="Üretim tarihi"></label><label class="sr-t"><small>Son tarih</small><input data-srson type="date" aria-label="Son kullanma ya da raf ömrü bitişi"></label><button type="button" class="btn sm" data-srekle>Ekle</button></div>
    <p class="hint">Armatürde parti, sürücüde seri numarası. Üretim tarihi girilen partilerde çıkışta önce eski parti önerilir; son tarihi yaklaşan parti stok listesinde işaretlenir. Servis kaydında aynı seri numarası girilince bu kalemle eşleşir.</p></section>`;
}
export function seriBolumuBagla(kok, s, yenile) {
  const b = kok.querySelector(`[data-sr="${s.id}"]`); if (!b) return;
  b.querySelector('[data-srekle]').onclick = async () => {
    try { await seriKaydet({ firma_id: s.firma_id, kod: s.kod, depo: s.depo ?? null, tur: b.querySelector('[data-srtur]').value, no: b.querySelector('[data-srno]').value, adet: b.querySelector('[data-sradet]').value, garanti_ay: b.querySelector('[data-srgar]').value, uretim_tarihi: b.querySelector('[data-sruret]').value || null, son_tarih: b.querySelector('[data-srson]').value || null }); toast('Seri / parti eklendi.'); yenile(); }
    catch (er) { toast(er.message, 'err'); } };
  b.querySelectorAll('[data-srdurum]').forEach(x => x.onchange = async () => { const r = S.stok_seri.find(y => y.id === x.dataset.srdurum); await app.db.save('stok_seri', { ...r, durum: x.value }); toast(`${r.no}: ${x.value}`); });
  b.querySelectorAll('[data-srsil]').forEach(x => x.onclick = async () => { const r = S.stok_seri.find(y => y.id === x.dataset.srsil); if (!confirmBox(`${r.no} silinsin mi?`)) return; await app.db.del('stok_seri', r.id); yenile(); });
  b.querySelectorAll('[data-srservis]').forEach(x => x.onclick = async () => { const r = S.stok_seri.find(y => y.id === x.dataset.srservis); const { servisForm } = await import('./views/kayitlar.js');
    closeDrawer(true); servisForm({ seri_no: r.no, urun: [s.kod, s.aciklama].filter(Boolean).join(' – '), firma_id: r.musteri_id || null, proje_id: r.proje_id || null, adet: r.tur === 'Seri' ? 1 : null, tip: 'Garanti' }); });
}

// ---------- Stok paylaşım bağlantısı (fiyatsız, salt okunur) ----------
const bulutMu = () => app.db?.mode === 'supabase' && !!app.db?.c;
function rastgeleAnahtar() { const b = new Uint8Array(24); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }
export function paylasimAdresi(anahtar) {
  const c = getConfig() || {}, ref = (String(c.url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1];
  if (!ref || !c.key) throw new Error('Supabase bağlantı bilgisi bulunamadı.');
  const kok = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
  return `${kok}stok.html#a=${anahtar}&p=${ref}&k=${encodeURIComponent(c.key)}`;
}
export async function paylasimOlustur({ firma_id, depo, grup_id, miktar = 'tam', gun = 30, baslik }) {
  if (!bulutMu()) throw new Error('Paylaşım bağlantısı yalnızca bulut hesabında (Supabase) çalışır.');
  const o = { id: uuid(), anahtar: rastgeleAnahtar(), firma_id, depo: depo === undefined ? null : depo, tum_depolar: depo === undefined, grup_id: grup_id || null, miktar, son_tarih: gun ? gunEkle(today(), +gun) : null, baslik: baslik || null, gonderen: firmaAdi() || null };
  await app.db.save('stok_paylasimlari', o); return { ...o, adres: paylasimAdresi(o.anahtar) };
}
export function paylasimPenceresi({ b, firma_id, depo, grup_id = null, grupAd = null, bayiAdi = '' }) {
  const ciz = () => {
    const l = (S.stok_paylasimlari || []).filter(x => x.firma_id === firma_id && !x.iptal).sort((a, c) => String(c.created_at || '').localeCompare(String(a.created_at || '')));
    return `<header class="dh"><div><p class="muted">${esc(bayiAdi)}</p><h2 id="drawer-title">Stok paylaş</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate><p>Müşteriye ya da projeciye <b>fiyatsız, salt okunur</b> bir stok listesi bağlantısı gönder: “bu ürün hemen var mı” sorusu biter. Liste her açılışta güncel stoğu gösterir; maliyet, fiyat ve iç notlar gitmez.</p>
      <p class="hint">Kapsam: ${esc(depo === undefined ? 'bütün depolar' : depoAdi(depo))}${grupAd ? ' · ' + esc(grupAd) + ' grubu' : ''}</p>
      <label class="fld"><span>Başlık</span><input name="baslik" value="${esc(bayiAdi + ' stok listesi')}"></label>
      <fieldset class="sg-sec"><legend>Miktar</legend><label class="chk"><input type="radio" name="miktar" value="tam" checked> <span>Miktarı göster</span></label><label class="chk"><input type="radio" name="miktar" value="var"> <span>Yalnız “var / az” göster</span></label></fieldset>
      <label class="fld"><span>Geçerlilik (gün)</span><input name="gun" type="number" inputmode="numeric" value="30"></label>
      <div class="btnrow"><button type="submit" class="btn primary">Bağlantı oluştur</button></div>
      <div data-sonuc></div>
      ${l.length ? `<h3>Açık bağlantılar</h3><ul class="list">${l.map(x => `<li><span><b>${esc(x.baslik || 'Stok listesi')}</b><small class="muted"> · ${x.son_tarih ? tarih(x.son_tarih) + "'e kadar" : 'süresiz'} · ${+x.acilma || 0} kez açıldı${x.son_acilma ? ' · son ' + tarih(String(x.son_acilma).slice(0, 10)) : ''}</small></span><button type="button" class="btn sm ghost danger" data-piptal="${x.id}">İptal et</button></li>`).join('')}</ul>` : ''}
    </form>`;
  };
  const p = openDrawer(ciz());
  const bagla = () => {
    p.querySelector('form').onsubmit = async e => { e.preventDefault();
      try { const o = await paylasimOlustur({ firma_id, depo, grup_id, miktar: p.querySelector('[name=miktar]:checked').value, gun: p.querySelector('[name=gun]').value, baslik: p.querySelector('[name=baslik]').value.trim() });
        p.querySelector('[data-sonuc]').innerHTML = `<div class="card"><p><b>Bağlantı hazır.</b></p><input readonly value="${esc(o.adres)}" aria-label="Bağlantı" onclick="this.select()"><div class="btnrow"><button type="button" class="btn sm" data-pkopya>Kopyala</button><a class="btn sm" target="_blank" rel="noopener" href="${esc(waLink('', `${o.baslik || 'Stok listesi'}: ${o.adres}`))}">WhatsApp ile gönder</a></div></div>`;
        p.querySelector('[data-pkopya]').onclick = () => { navigator.clipboard?.writeText(o.adres).then(() => toast('Bağlantı kopyalandı.'), () => toast('Kopyalanamadı; bağlantıyı seçip kopyala.', 'err')); };
      } catch (er) { toast(/does not exist|schema cache|Could not find/i.test(er.message || '') ? 'Paylaşım için Supabase\'de güncel schema.sql dosyasını çalıştır (sürüm 56).' : er.message, 'err'); } };
    p.querySelectorAll('[data-piptal]').forEach(x => x.onclick = async () => { const r = S.stok_paylasimlari.find(y => y.id === x.dataset.piptal); await app.db.save('stok_paylasimlari', { ...r, iptal: true }); toast('Bağlantı iptal edildi; artık açılmaz.'); p.innerHTML = ciz(); bagla(); });
  };
  bagla();
}
