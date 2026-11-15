// Saha Takip: anlık bildirim (Web Push). Görev atanınca atanan kişiye, ekip üyesi görevi tamamlayınca veri sahibine,
// bir yorumda etiketlenen kişilere bildirim gönderir. Her pazartesi sabahı (zamanlanmış görevle) haftalık özet gönderir.
// Kurulum (bir kez):
//   1) Uygulamada Ayarlar → Genel → Bildirimler → “Anahtar üret” ile iki anahtar al.
//   2) Supabase paneli → Edge Functions → Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ve VAPID_SUBJECT (ör. mailto:adresin@ornek.com) ekle.
//   3) Edge Functions → “Deploy a new function” → “Via Editor” → adı: bildir → bu dosyanın içeriğini yapıştır → Deploy.
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından fonksiyona kendiliğinden verilir; hiçbir yere yazman gerekmez.
// Pazartesi özeti için ayrıca: Secrets'a CRON_ANAHTAR ekle ve uygulamadaki SQL'i SQL Editor'de bir kez çalıştır
// (Ayarlar → Genel → Bildirimler → Pazartesi özeti → Kurulum bilgisini hazırla).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const PUB = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const PRIV = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const SUBJ = Deno.env.get('VAPID_SUBJECT') || 'mailto:saha-takip@example.com';
const tarihTR = (d?: string | null) => d ? d.slice(0, 10).split('-').reverse().join('.') : '';
const CRON = Deno.env.get('CRON_ANAHTAR') || '';
// deno-lint-ignore no-explicit-any
type Db = any;

// ---------- Haftalık özet (pazartesi) ----------
// Türkiye saatine göre bugün, geçen haftanın ve bu haftanın pazartesi–pazar aralığı
function haftalar() {
  const tr = new Date(Date.now() + 3 * 3600e3), iso = (d: Date) => d.toISOString().slice(0, 10);
  const bugun = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
  const g = (bugun.getUTCDay() + 6) % 7, pzt = new Date(bugun.getTime() - g * 864e5);
  const ek = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
  return { bugun: iso(bugun), buB: iso(pzt), buS: iso(ek(pzt, 6)), buCum: iso(ek(pzt, 4)), gecB: iso(ek(pzt, -7)), gecS: iso(ek(pzt, -1)) };
}
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const gunAy = (d: string) => `${+d.slice(8, 10)} ${AY[+d.slice(5, 7) - 1]}`;
// Kişinin kapsamı: veri sahibiyse kendi verisinin tamamı, ekip üyesiyse sahibinin verisinde yalnızca kendi kayıtları
async function kapsam(admin: Db, userId: string, eposta: string) {
  const { count } = await admin.from('projeler').select('id', { count: 'exact', head: true }).eq('owner', userId);
  const { count: zc } = await admin.from('ziyaretler').select('id', { count: 'exact', head: true }).eq('owner', userId);
  if ((count || 0) + (zc || 0) > 0) return { owner: userId, kendi: null as string | null };
  const { data: u } = await admin.from('ekip_uyeleri').select('owner').ilike('eposta', eposta).eq('aktif', true).limit(1).maybeSingle();
  return u ? { owner: u.owner as string, kendi: eposta } : null;
}
async function haftaOzeti(admin: Db, userId: string, eposta: string) {
  const k = await kapsam(admin, userId, eposta); if (!k) return null;
  const h = haftalar();
  const say = async (t: string, f: (q: Db) => Db) => { const { count } = await f(admin.from(t).select('id', { count: 'exact', head: true }).eq('owner', k.owner)); return count || 0; };
  const benim = (q: Db, kol = 'sorumlu') => k.kendi ? q.eq(kol, k.kendi) : q;
  const [ziy, tek, sip, plan, sure, gor] = await Promise.all([
    say('ziyaretler', q => benim(q.gte('tarih', h.gecB).lte('tarih', h.gecS).or('durum.is.null,durum.eq.Yapıldı'))),
    say('teklifler', q => benim(q.gte('tarih', h.gecB).lte('tarih', h.gecS))),
    say('siparisler', q => benim(q.gte('tarih', h.gecB).lte('tarih', h.gecS))),
    say('ziyaretler', q => benim(q.gte('tarih', h.bugun).lte('tarih', h.buS).eq('durum', 'Planlandı'))),
    say('teklifler', q => benim(q.eq('durum', 'Gönderildi').gte('gecerlilik', h.bugun).lte('gecerlilik', h.buS))),
    say('gorevler', q => benim(q.neq('durum', 'Tamam').lte('son_tarih', h.buS), 'atanan')),
  ]);
  if (!ziy && !tek && !sip && !plan && !sure && !gor) return null;
  const parca = (l: [number, string][]) => l.filter(([n]) => n).map(([n, t]) => `${n} ${t}`).join(', ');
  const gecen = parca([[ziy, 'ziyaret'], [tek, 'teklif'], [sip, 'sipariş']]);
  const bu = parca([[plan, 'planlı ziyaret'], [sure, 'teklifin süresi doluyor'], [gor, 'açık görev']]);
  // Tutar ya da müşteri adı gönderilmez; ayrıntı uygulamadaki "Haftan" kartında
  return { baslik: `Haftan · ${gunAy(h.buB)} – ${gunAy(h.buCum)}`, govde: [gecen && `Geçen hafta ${gecen}.`, bu ? `Bu hafta ${bu}.` : 'Bu hafta için henüz plan yok, haftayı planla.'].filter(Boolean).join(' '),
    hedef: plan ? '#/bugun' : '#/plan', tag: 'haftalik-' + h.buB };
}
async function gonderToplu(admin: Db, subs: Db[], mesaj: unknown) {
  webpush.setVapidDetails(SUBJ, PUB, PRIV);
  let n = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(mesaj), { TTL: 6 * 3600 }); n++; }
    catch (e) { const kod = (e as { statusCode?: number }).statusCode; if (kod === 404 || kod === 410) await admin.from('push_abonelikleri').delete().eq('id', s.id); }
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!PUB || !PRIV) return json({ hata: 'VAPID anahtarları tanımlı değil (Edge Functions → Secrets).' }, 500);
  if (req.method === 'GET') return json({ anahtar: PUB });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Zamanlanmış görev (pazartesi 08:00): CRON_ANAHTAR ile gelir, haftalık özeti açık olan her cihaza kendi özeti gider
  const cronAnahtar = req.headers.get('x-cron-anahtar') || '';
  if (cronAnahtar) {
    if (!CRON || cronAnahtar !== CRON) return json({ hata: 'Geçersiz zamanlama anahtarı.' }, 401);
    const { data: subs, error } = await admin.from('push_abonelikleri').select('*');
    if (error) return json({ hata: error.message }, 500);
    const kisi = new Map<string, Db[]>();
    for (const s of (subs || []).filter((s: Db) => s.tercihler?.haftalik !== false)) (kisi.get(s.user_id) || kisi.set(s.user_id, []).get(s.user_id))!.push(s);
    let gonderilen = 0, kisiSay = 0;
    for (const [uid, l] of kisi) {
      const m = await haftaOzeti(admin, uid, (l[0].eposta || '').toLowerCase()).catch(() => null);
      if (m) { gonderilen += await gonderToplu(admin, l, m); kisiSay++; }
    }
    return json({ gonderilen, kisi: kisiSay });
  }
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: ud } = await admin.auth.getUser(jwt);
  const user = ud?.user;
  if (!user) return json({ hata: 'Oturum bulunamadı.' }, 401);
  const ben = (user.email || '').toLowerCase();
  const { olay, gorev_id, yorum_id } = await req.json().catch(() => ({} as Record<string, string>));

  let alici: { tur: 'id' | 'eposta'; deger: string[] } | null = null;
  let mesaj = { baslik: 'Saha Takip', govde: '', hedef: '#/bugun', tag: '' };

  if (olay === 'haftalik_deneme') {
    const m = await haftaOzeti(admin, user.id, ben);
    if (!m) return json({ gonderilen: 0, not: 'Özetlenecek bir şey yok (geçen hafta kayıt yok, bu hafta plan yok).' });
    const { data: subs } = await admin.from('push_abonelikleri').select('*').eq('user_id', user.id);
    return json({ gonderilen: await gonderToplu(admin, subs || [], m) });
  }
  if (olay === 'deneme') {
    alici = { tur: 'id', deger: [user.id] };
    mesaj = { baslik: 'Saha Takip', govde: 'Deneme bildirimi: bu cihaza bildirim geliyor.', hedef: '#/bugun', tag: 'deneme' };
  } else if (olay === 'yorum') {
    const { data: y } = await admin.from('yorumlar').select('id, owner, tablo, kayit_id, metin, yazan, yazan_ad, etiketler').eq('id', yorum_id).maybeSingle();
    if (!y) return json({ hata: 'Yorum bulunamadı.' }, 404);
    if ((y.yazan || '').toLowerCase() !== ben) return json({ hata: 'Bu yorum için yetkin yok.' }, 403);
    // Yalnızca aynı ekipteki kişiler (veri sahibi ve aktif üyeler) etiketlenebilir
    const { data: uyeler } = await admin.from('ekip_uyeleri').select('eposta').eq('owner', y.owner).eq('aktif', true);
    const { data: sahipU } = await admin.auth.admin.getUserById(y.owner);
    const ekip = new Set([...(uyeler || []).map((u: { eposta: string }) => u.eposta.toLowerCase()), (sahipU?.user?.email || '').toLowerCase()]);
    const kime = (y.etiketler || []).map((e: string) => e.toLowerCase()).filter((e: string) => ekip.has(e) && e !== ben);
    if (!kime.length) return json({ gonderilen: 0, not: 'Etiketlenen ekip üyesi yok.' });
    const { data: k } = await admin.from(y.tablo).select('ad').eq('id', y.kayit_id).maybeSingle();
    alici = { tur: 'eposta', deger: kime };
    mesaj = { baslik: `${y.yazan_ad || ben} seni etiketledi`, govde: (k?.ad ? k.ad + ': ' : '') + String(y.metin).slice(0, 160), hedef: (y.tablo === 'projeler' ? '#/proje/' : '#/firma/') + y.kayit_id, tag: 'yorum-' + y.id };
  } else {
    const { data: g } = await admin.from('gorevler').select('id, owner, baslik, son_tarih, atanan, durum').eq('id', gorev_id).maybeSingle();
    if (!g) return json({ hata: 'Görev bulunamadı.' }, 404);
    const sahip = g.owner === user.id, atanan = (g.atanan || '').toLowerCase() === ben;
    if (!sahip && !atanan) return json({ hata: 'Bu görev için yetkin yok.' }, 403);
    if (olay === 'atandi' && sahip && g.atanan) {
      alici = { tur: 'eposta', deger: [g.atanan.toLowerCase()] };
      mesaj = { baslik: 'Sana yeni görev atandı', govde: g.baslik + (g.son_tarih ? ' · son tarih ' + tarihTR(g.son_tarih) : ''), hedef: '#/bugun', tag: 'gorev-' + g.id };
    } else if (olay === 'tamamlandi' && atanan && g.durum === 'Tamam') {
      const { data: u } = await admin.from('ekip_uyeleri').select('ad').eq('owner', g.owner).ilike('eposta', ben).maybeSingle();
      alici = { tur: 'id', deger: [g.owner] };
      mesaj = { baslik: 'Görev tamamlandı', govde: `${u?.ad || ben}: ${g.baslik}`, hedef: '#/gorevler', tag: 'gorev-' + g.id };
    } else return json({ gonderilen: 0, not: 'Bu değişiklik için bildirim gerekmiyor.' });
  }

  const q = admin.from('push_abonelikleri').select('*');
  const { data: abonelikler, error } = alici.tur === 'id' ? await q.in('user_id', alici.deger) : await q.in('eposta', alici.deger);
  if (error) return json({ hata: 'Abonelik tablosu okunamadı: ' + error.message }, 500);
  webpush.setVapidDetails(SUBJ, PUB, PRIV);
  let gonderilen = 0;
  // Cihaz tercihleri: kişi bu tür bildirimi kapattıysa o cihaza gönderilmez (deneme her zaman gider)
  const izinli = (abonelikler || []).filter((s: { tercihler?: Record<string, boolean> }) => olay === 'deneme' || s.tercihler?.[olay] !== false);
  for (const s of izinli) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(mesaj), { TTL: 86400 });
      gonderilen++;
    } catch (e) {
      const kod = (e as { statusCode?: number }).statusCode;
      if (kod === 404 || kod === 410) await admin.from('push_abonelikleri').delete().eq('id', s.id);   // artık geçersiz cihaz
    }
  }
  return json({ gonderilen, abone: izinli.length });
});
