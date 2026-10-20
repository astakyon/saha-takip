// Saha Takip: TCMB günlük döviz kuru (USD ve EUR döviz satış). Tarayıcı TCMB'ye doğrudan erişemediği (CORS) için gerekir.
// Kurulum (bir kez): Supabase paneli → Edge Functions → "Deploy a new function" → "Via Editor"
// → adı: tcmb-kur → bu dosyanın içeriğini yapıştır → Deploy.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
let onbellek: { zaman: number; veri: Record<string, unknown> } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (onbellek && Date.now() - onbellek.zaman < 30 * 60 * 1000) return new Response(JSON.stringify(onbellek.veri), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const r = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', { headers: { 'User-Agent': 'SahaTakip/1.0' } });
    const xml = await r.text();
    const al = (kod: string) => {
      const m = new RegExp(`<Currency[^>]*CurrencyCode="${kod}"[\\s\\S]*?<ForexSelling>([\\d.]+)</ForexSelling>`).exec(xml);
      return m ? +m[1] : null;
    };
    const t = /Tarih="(\d{2})\.(\d{2})\.(\d{4})"/.exec(xml);
    const veri = { USD: al('USD'), EUR: al('EUR'), tarih: t ? `${t[3]}-${t[2]}-${t[1]}` : null, kaynak: 'TCMB' };
    if (!veri.USD) throw new Error('Kur okunamadı');
    onbellek = { zaman: Date.now(), veri };
    return new Response(JSON.stringify(veri), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ hata: String(e) }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
