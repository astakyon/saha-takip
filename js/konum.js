// Konum doğrulama kuralı ve KVKK konum aydınlatma metni.
// Konum yalnızca ziyarette giriş ve çıkış anında alınır. Kullanıcı ilk kez konum paylaşmadan önce metni görür ve onaylar;
// onay, kim / ne zaman / hangi metin olarak saklanır. Onaylamazsa giriş konumsuz kaydedilir.
import { S } from './db.js';
import { app } from './state.js';
import { ayar } from './ayar.js';
import { profil } from './profil.js';

export const KONUM_MODLARI = { uyar: 'Uzaktaysa uyar, onaylarsa giriş yapılsın', engelle: 'Uzaktaysa giriş yapılamasın', kapali: 'Mesafe denetlenmesin' };
export const konumKurali = () => ({ mesafe: 1000, mod: 'uyar', ...(ayar('konum_dogrulama') || {}) });
export const varsayilanKvkk = () => `${profil().firma || 'Şirketimiz'}, saha ziyaretlerinin doğrulanması amacıyla yalnızca ziyarette "Giriş" ve "Çıkış" yaptığın anda cihazının konumunu alır ve ziyaret kaydıyla birlikte saklar. Gün boyu sürekli konum takibi yapılmaz. Bu veriler yalnızca şirket içindeki yetkililer tarafından görülür ve ziyaret kayıtları silindiğinde birlikte silinir. 6698 sayılı KVKK kapsamındaki haklarını (bilgi talebi, düzeltme, silme) şirket yetkilisine başvurarak kullanabilirsin.`;
export const kvkkMetni = () => (ayar('kvkk_konum_metni') || '').trim() || varsayilanKvkk();
const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const anahtar = () => 'kvkk_konum:' + ben();
const metinOzu = m => { let h = 0; for (const c of m) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
export function kvkkOnayli() {
  const oz = metinOzu(kvkkMetni());
  try { if (localStorage.getItem(anahtar()) === oz) return true; } catch {}
  return (S.konum_onaylari || []).some(o => (o.eposta || '').toLowerCase() === ben() && o.metin_ozu === oz && o.onay !== false);
}
// true: konum alınabilir, false: kullanıcı onaylamadı
export async function kvkkSor() {
  if (kvkkOnayli()) return true;
  const evet = window.confirm('Konum aydınlatma metni\n\n' + kvkkMetni() + '\n\nOkudum, giriş ve çıkışta konumumun alınmasını onaylıyorum.');
  const oz = metinOzu(kvkkMetni());
  if (evet) { try { localStorage.setItem(anahtar(), oz); } catch {} }
  try { await app.db.save('konum_onaylari', { eposta: ben() || null, metin_ozu: oz, metin: kvkkMetni(), onay: evet, tarih: new Date().toISOString() }); } catch {}
  return evet;
}
