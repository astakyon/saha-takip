// Giriş yapan kişi: ad, kullanıcı adı, rol ve şirket. Menüdeki "ben" kartı ve Profilim sayfası buradan okur.
// Kişisel bilgiler (ad, ünvan, telefon, imza) girişin kendisinde (Supabase hesap bilgisi) durur; şirket ayarlarından ayrıdır.
import { app } from './state.js';
import { ayar } from './ayar.js';
import { sahipMi } from './yetki.js';

export const SENTETIK_EPOSTA = /@kullanici\.saha-takip\.invalid$/;
export function benBilgisi() {
  const yerel = app.db?.mode !== 'supabase';
  const u = yerel ? null : app.db?.user?.() || null, m = u?.user_metadata || {}, y = app.yetki || {};
  const eposta = (u?.email || '').toLowerCase(), sentetik = SENTETIK_EPOSTA.test(eposta);
  const kad = m.kullanici_adi || (sentetik ? eposta.split('@')[0] : '') || (() => { try { return localStorage.getItem('saha-son-giris') || ''; } catch { return ''; } })();
  const imzaAd = String(ayar('benim_adim') || '').split(/\s*[·|,-]\s*/)[0].trim();
  const ad = m.ad || (!sahipMi() && y.ad) || (sahipMi() ? imzaAd : '') || kad || (sentetik ? '' : eposta.split('@')[0]) || (yerel ? 'Deneme kullanıcısı' : 'Ben');
  const rol = yerel ? 'Deneme modu' : y.dis ? 'Dış kullanıcı · ' + (y.dis.firma_ad || '') : sahipMi() ? (y.sirket_yoneticisi ? 'Şirket yöneticisi' : 'Şirket kurucusu') : (y.yetkiler?._rol || 'Ekip üyesi');
  return { yerel, ad, kad: /@/.test(kad) ? '' : kad, eposta: sentetik ? '' : eposta, rol, unvan: m.unvan || '', telefon: m.telefon || '', iletisim: m.iletisim_eposta || '', imza: m.imza || '', sonGiris: u?.last_sign_in_at || null, meta: m };
}
export const basHarfleri = t => String(t || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toLocaleUpperCase('tr') || '?';
