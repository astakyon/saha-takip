// Saha Takip: kullanıcı adı ve şifreyle hesap. Şirket yetkilisi (kurucu ya da şirket yöneticisi) ekip üyesine
// kullanıcı adı ve geçici şifreyle hesap açar, unutulan şifreyi sıfırlar. Kişi ilk girişte kendi şifresini belirler.
// E-posta gerekmez: e-postası olmayan kişiye "<kullanıcı adı>@kullanici.saha-takip.invalid" biçiminde, hiçbir zaman
// e-posta gönderilmeyen bir giriş kimliği verilir.
// Kurulum (bir kez): Supabase paneli → Edge Functions → "Deploy a new function" → "Via Editor" → adı: kullanici →
// bu dosyanın içeriğini yapıştır → Deploy. SUPABASE_URL, SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY Supabase
// tarafından fonksiyona kendiliğinden verilir; hiçbir yere yazman gerekmez ve uygulamaya hiç gelmez.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const KAD = /^[a-z0-9._-]{3,30}$/;
const ALAN = 'kullanici.saha-takip.invalid';
const sifreUygun = (p: string) => typeof p === 'string' && p.length >= 8 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p) && /\d/.test(p);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ hata: 'Yalnızca POST.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, servis = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ hata: 'Giriş yapılmamış.' }, 401);
  // Çağıran kişi, kendi oturumuyla: yetkisi veritabanındaki kurallarla denetlenir
  const ben = createClient(url, anon, { global: { headers: { Authorization: 'Bearer ' + jwt } }, auth: { persistSession: false } });
  const { data: u } = await ben.auth.getUser(jwt);
  if (!u?.user) return json({ hata: 'Oturum geçersiz. Yeniden giriş yap.' }, 401);
  let g: Record<string, unknown> = {};
  try { g = await req.json(); } catch { return json({ hata: 'Geçersiz istek.' }, 400); }
  const sahip = String(g.sahip || '');
  const { data: yetkili, error: ye } = await ben.rpc('sirket_yetkilisi', { sahip });
  if (ye) return json({ hata: /function|schema cache/i.test(ye.message) ? 'Sunucu güncel değil: schema.sql (sürüm 37) çalıştırılmalı.' : ye.message }, 500);
  if (!yetkili) return json({ hata: 'Bu işlemi yalnızca şirket yetkilisi yapabilir.' }, 403);
  const admin = createClient(url, servis, { auth: { persistSession: false } });

  if (g.islem === 'olustur') {
    const kad = String(g.kad || '').trim().toLowerCase(), sifre = String(g.sifre || '');
    let eposta = String(g.eposta || '').trim().toLowerCase();
    if (!KAD.test(kad)) return json({ hata: 'Kullanıcı adı 3–30 karakter olmalı: küçük harf, rakam, nokta, tire.' }, 400);
    if (!sifreUygun(sifre)) return json({ hata: 'Geçici şifre en az 8 karakter olmalı, harf ve rakam içermeli.' }, 400);
    if (eposta && !/^\S+@\S+\.\S+$/.test(eposta)) return json({ hata: 'E-posta geçersiz.' }, 400);
    const { data: var_ } = await admin.from('kullanici_adlari').select('eposta').eq('ad', kad).maybeSingle();
    if (var_) return json({ hata: 'Bu kullanıcı adı alınmış. Başka bir ad dene.' }, 409);
    if (!eposta) eposta = `${kad}@${ALAN}`;
    const { data: yeni, error } = await admin.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true, user_metadata: { sifre_degistir: true, kullanici_adi: kad } });
    if (error) return json({ hata: /already|registered|exists/i.test(error.message) ? 'Bu e-postayla zaten bir hesap var. Kişiyi e-postasıyla ekle; mevcut şifresiyle girer.' : error.message }, 409);
    const { error: ke } = await admin.from('kullanici_adlari').insert({ ad: kad, eposta, ekleyen: u.user.id });
    if (ke) { await admin.auth.admin.deleteUser(yeni.user!.id); return json({ hata: 'Kullanıcı adı kaydedilemedi: ' + ke.message }, 500); }
    return json({ tamam: true, eposta, kad });
  }

  if (g.islem === 'sifre') {
    const eposta = String(g.eposta || '').trim().toLowerCase(), sifre = String(g.sifre || '');
    if (!sifreUygun(sifre)) return json({ hata: 'Geçici şifre en az 8 karakter olmalı, harf ve rakam içermeli.' }, 400);
    // Yalnızca kendi şirketinin üyesi; kurucu ya da başka bir şirket yetkilisinin şifresi değiştirilemez
    const { data: uye } = await admin.from('ekip_uyeleri').select('id,yonetici').eq('owner', sahip).ilike('eposta', eposta).maybeSingle();
    if (!uye) return json({ hata: 'Bu kişi şirketinde değil.' }, 404);
    if (uye.yonetici && eposta !== (u.user.email || '').toLowerCase() && sahip !== u.user.id) return json({ hata: 'Şirket yöneticisinin şifresini yalnızca kurucu sıfırlayabilir.' }, 403);
    const { data: kim, error: ie } = await admin.rpc('kullanici_kimligi', { p_eposta: eposta });
    if (ie) return json({ hata: ie.message }, 500);
    if (!kim) return json({ hata: 'Bu kişinin henüz hesabı yok. Önce hesap aç.' }, 404);
    const { data: eski } = await admin.auth.admin.getUserById(kim);
    const { error } = await admin.auth.admin.updateUserById(kim, { password: sifre, user_metadata: { ...(eski?.user?.user_metadata || {}), sifre_degistir: true } });
    if (error) return json({ hata: error.message }, 500);
    return json({ tamam: true });
  }

  return json({ hata: 'Bilinmeyen işlem.' }, 400);
});
