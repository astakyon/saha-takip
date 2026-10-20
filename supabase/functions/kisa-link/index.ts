// Saha Takip: Google Haritalar kısa bağlantısını (maps.app.goo.gl/…) açıp uzun adresi döndürür.
// Tarayıcı CORS nedeniyle yönlendirmeyi okuyamadığı için bu küçük fonksiyon gerekir.
// Yalnızca Google Haritalar alan adlarına istek atar; başka adresleri reddeder.
//
// Kurulum (bir kez): Supabase paneli → Edge Functions → "Deploy a new function" → "Via Editor"
// → adı: kisa-link → bu dosyanın içeriğini yapıştır → Deploy.
// ("Verify JWT" açık kalabilir; uygulama giriş anahtarıyla çağırır.)

const IZINLI = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|www\.google\.[a-z.]+|google\.[a-z.]+)$/i;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const yanit = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url).searchParams.get('u') || '';
  let adres: URL;
  try { adres = new URL(u); } catch { return yanit({ hata: 'Geçersiz bağlantı' }, 400); }
  if (adres.protocol !== 'https:' || !IZINLI.test(adres.hostname)) return yanit({ hata: 'Yalnızca Google Haritalar bağlantıları açılabilir' }, 400);
  let simdiki = adres.toString();
  for (let i = 0; i < 6; i++) {
    const r = await fetch(simdiki, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) SahaTakip/1.0', 'Accept-Language': 'tr' } });
    const yer = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && yer) {
      const sonraki = new URL(yer, simdiki);
      if (!IZINLI.test(sonraki.hostname)) return yanit({ url: sonraki.toString() });
      simdiki = sonraki.toString();
      // Uzun Google Haritalar adresine ulaşıldıysa dur
      if (/\/maps\/(place|search|dir)\/|[?&](q|ll|center)=/.test(simdiki) && !/goo\.gl/.test(sonraki.hostname)) break;
      continue;
    }
    // Bazı bağlantılar sayfa içinde yönlendirir: içerikteki ilk Haritalar adresini ara
    if (r.ok && /goo\.gl/.test(new URL(simdiki).hostname)) {
      const html = (await r.text()).slice(0, 200000);
      const m = /https:\/\/(?:www\.)?google\.[a-z.]+\/maps[^"'\s<>]+/.exec(html);
      if (m) simdiki = m[0].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
    } else await r.body?.cancel();
    break;
  }
  return yanit({ url: simdiki });
});
