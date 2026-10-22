// Saha Takip: anlık bildirim (Web Push). Görev atanınca atanan kişiye, ekip üyesi görevi tamamlayınca veri sahibine bildirim gönderir.
// Kurulum (bir kez):
//   1) Uygulamada Ayarlar → Genel → Bildirimler → “Anahtar üret” ile iki anahtar al.
//   2) Supabase paneli → Edge Functions → Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ve VAPID_SUBJECT (ör. mailto:adresin@ornek.com) ekle.
//   3) Edge Functions → “Deploy a new function” → “Via Editor” → adı: bildir → bu dosyanın içeriğini yapıştır → Deploy.
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından fonksiyona kendiliğinden verilir; hiçbir yere yazman gerekmez.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!PUB || !PRIV) return json({ hata: 'VAPID anahtarları tanımlı değil (Edge Functions → Secrets).' }, 500);
  if (req.method === 'GET') return json({ anahtar: PUB });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: ud } = await admin.auth.getUser(jwt);
  const user = ud?.user;
  if (!user) return json({ hata: 'Oturum bulunamadı.' }, 401);
  const ben = (user.email || '').toLowerCase();
  const { olay, gorev_id } = await req.json().catch(() => ({} as Record<string, string>));

  let alici: { tur: 'id' | 'eposta'; deger: string[] } | null = null;
  let mesaj = { baslik: 'Saha Takip', govde: '', hedef: '#/bugun', tag: '' };

  if (olay === 'deneme') {
    alici = { tur: 'id', deger: [user.id] };
    mesaj = { baslik: 'Saha Takip', govde: 'Deneme bildirimi: bu cihaza bildirim geliyor.', hedef: '#/bugun', tag: 'deneme' };
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

  const q = admin.from('push_abonelikleri').select('id, endpoint, p256dh, auth');
  const { data: abonelikler, error } = alici.tur === 'id' ? await q.in('user_id', alici.deger) : await q.in('eposta', alici.deger);
  if (error) return json({ hata: 'Abonelik tablosu okunamadı: ' + error.message }, 500);
  webpush.setVapidDetails(SUBJ, PUB, PRIV);
  let gonderilen = 0;
  for (const s of abonelikler || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(mesaj), { TTL: 86400 });
      gonderilen++;
    } catch (e) {
      const kod = (e as { statusCode?: number }).statusCode;
      if (kod === 404 || kod === 410) await admin.from('push_abonelikleri').delete().eq('id', s.id);   // artık geçersiz cihaz
    }
  }
  return json({ gonderilen, abone: (abonelikler || []).length });
});
