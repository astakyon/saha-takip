// Otomatik testler: GitHub her yayında çalıştırır (.github/workflows/testler.yml). Elle: node tests/calistir.mjs
// Gerçek müşteri verisi kullanılmaz; her test kendi uydurma kayıtlarını oluşturur.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import('playwright').catch(() => import('/opt/npm-tools/node_modules/playwright/index.mjs'));
const sahteSupa = fs.readFileSync(path.join(KOK, 'tests/sahte-supabase.js'), 'utf8');
const sahteLeaflet = fs.readFileSync(path.join(KOK, 'tests/sahte-leaflet.js'), 'utf8');
const sonuc = []; let basarisiz = 0;
const kontrol = (ad, kosul, ayrinti = '') => { sonuc.push(`${kosul ? '✔' : '✘'} ${ad}${!kosul && ayrinti ? ' — ' + ayrinti : ''}`); if (!kosul) basarisiz++; };
const w = ms => new Promise(r => setTimeout(r, ms));

// ---------- 1) Kaynak dosyalar ----------
const jsler = []; const gez = d => { for (const f of fs.readdirSync(path.join(KOK, d), { withFileTypes: true })) { const y = path.join(d, f.name); if (f.isDirectory()) gez(y); else if (f.name.endsWith('.js')) jsler.push(y.replace(/\\/g, '/')); } };
gez('js');
let sozdizimi = [];
for (const f of [...jsler, 'sw.js']) { try { execFileSync(process.execPath, ['--check', path.join(KOK, f)], { stdio: 'pipe' }); } catch (e) { sozdizimi.push(f + ': ' + String(e.stderr).split('\n').find(l => /Error/.test(l))); } }
kontrol(`Söz dizimi (${jsler.length + 1} dosya)`, !sozdizimi.length, sozdizimi.join('; '));
const sw = fs.readFileSync(path.join(KOK, 'sw.js'), 'utf8');
const eksik = jsler.filter(f => !sw.includes(`'${f}'`));
kontrol('Çevrimdışı önbellek listesi tüm dosyaları içeriyor', !eksik.length, eksik.join(', '));
const surum = /SURUM = '(\d+)'/.exec(fs.readFileSync(path.join(KOK, 'js/state.js'), 'utf8'))?.[1];
kontrol('Sürüm numarası README\'de anlatılmış', fs.readFileSync(path.join(KOK, 'README.md'), 'utf8').includes(`(sürüm ${surum})`), 'sürüm ' + surum);
kontrol('Depoda müşteri verisi dosyası yok', !fs.existsSync(path.join(KOK, 'baslangic-verisi.json')) && !fs.existsSync(path.join(KOK, 'dist')));

// ---------- Sunucu ----------
const TUR = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const sunucu = http.createServer((q, r) => { const y = path.join(KOK, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!y.startsWith(KOK) || !fs.existsSync(y) || fs.statSync(y).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TUR[path.extname(y)] || 'application/octet-stream' }); fs.createReadStream(y).pipe(r); });
await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
const U = `http://127.0.0.1:${sunucu.address().port}/index.html`;
const tarayici = await chromium.launch();

async function sayfa({ supabase = false, hazirla } = {}) {
  const c = await tarayici.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', serviceWorkers: 'block' });
  await c.route(/cdnjs|jsdelivr|googleapis|gstatic|openstreetmap|arcgis|nominatim|frankfurter|supabase\.co|eaeaydinlatma|unpkg/, r => { const u = r.request().url(); if (u.includes('supabase-js')) return r.fulfill({ body: sahteSupa, contentType: 'application/javascript' }); if (u.includes('leaflet')) return r.fulfill({ body: sahteLeaflet, contentType: 'application/javascript' }); if (u.endsWith('.js')) return r.fulfill({ body: '', contentType: 'application/javascript' }); return r.abort(); });
  await c.addInitScript(({ supabase, hazirla }) => {
    localStorage.setItem('saha-tanitim', '1'); if (localStorage.getItem('__hazir')) return; localStorage.setItem('__hazir', '1');
    if (supabase) localStorage.setItem('saha-config', JSON.stringify({ mode: 'supabase', url: 'https://x.supabase.co', key: 'k' }));
    if (hazirla) (0, eval)('(' + hazirla + ')')();
  }, { supabase, hazirla: hazirla ? hazirla.toString() : null });
  const p = await c.newPage(); const hatalar = [];
  p.on('pageerror', e => hatalar.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load|ERR_/.test(m.text())) hatalar.push(m.text()); });
  p.on('dialog', d => d.accept());
  return { p, c, hatalar };
}
const DB = () => {
  const ts = i => new Date(Date.parse('2026-10-20T08:00:00Z') + i * 1000).toISOString();
  const o = (x, i) => ({ owner: 'u1', updated_at: ts(i), created_at: ts(i), ...x });
  localStorage.setItem('__DB', JSON.stringify({
    firmalar: [o({ id: 'f1', ad: 'Örnek Bayi', tipler: ['Bayi'], lat: 37, lng: 35.3 }, 1), o({ id: 'f2', ad: 'Örnek Emüt', tipler: ['Emüt'] }, 2)],
    kisiler: [o({ id: 'k1', firma_id: 'f2', ad_soyad: 'Deneme Kişi', telefon: '05320000000', eposta: 'k@ornek.com' }, 3)],
    projeler: [o({ id: 'p1', ad: 'Örnek Hastane', durum: 'Teklif', tutar_usd: 125000, emut_id: 'f2', bayi_id: 'f1', lat: 37, lng: 35.3 }, 4)],
    ziyaretler: [o({ id: 'z1', firma_id: 'f2', proje_id: 'p1', tarih: '2026-10-22', notlar: 'GIZLI_ZIYARET' }, 5)],
    teklifler: [o({ id: 't1', proje_id: 'p1', teklif_no: 'T-1', tarih: '2026-10-01' }, 6)],
    siparisler: [o({ id: 's1', firma_id: 'f1', proje_id: 'p1', tarih: '2026-10-02', net_deger: 5000, para_birimi: 'USD' }, 7)],
    urunler: [o({ id: 'u1', kod: '1000001', aciklama: 'ORNEK 050D 40LN00', stok: 10, birim_fiyat_usd: 42 }, 8)],
    masraflar: [o({ id: 'm1', tarih: '2026-10-22', tutar: 500, aciklama: 'GIZLI_MASRAF' }, 9)],
    ekip_uyeleri: [] }));
};

// ---------- 2) Her ekran açılıyor (deneme modu) ----------
{
  const { p, c, hatalar } = await sayfa();
  await p.goto(U + '#/bugun'); await w(1200);
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); const f = await app.db.save('firmalar', { ad: 'Örnek Firma', tipler: ['Emüt'], lat: 37, lng: 35.3 }); await app.db.save('projeler', { ad: 'Örnek Proje', durum: 'Teklif', tutar_usd: 1000, emut_id: f.id, lat: 37, lng: 35.3 }); await app.db.save('ziyaretler', { firma_id: f.id, tarih: '2026-10-22' }); });
  const rotalar = await p.evaluate(async () => Object.keys((await import('./js/state.js')).app.rotalar));
  const bos = [];
  for (const r of rotalar) { await p.goto(U + '#/' + r); await w(500); const t = await p.evaluate(() => document.querySelector('#view .view-ic')?.innerText.trim().length || 0); if (!t) bos.push(r); }
  kontrol(`${rotalar.length} ekranın hepsi açılıyor`, !bos.length && rotalar.length > 20, 'boş: ' + bos.join(', '));
  await p.goto(U + '#/projeler'); await w(500); const pid = await p.evaluate(async () => (await import('./js/db.js')).S.projeler[0].id);
  await p.goto(U + '#/proje/' + pid); await w(800); kontrol('Proje kartı açılıyor', await p.isVisible('.ps-sayfa'));
  kontrol('Ekranlarda hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 3) Ayrıntılı yetkiler: ekip üyesi kapalı bölümleri hiç görmez ----------
{
  const hazirla = DB.toString().replace(/^\(\) => \{/, '() => {') ;
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${hazirla})(); localStorage.setItem('__YETKI', JSON.stringify({ sahip: 'u1', ben_sahip: false, ad: 'Üye', yetkiler: { projeler: 'oku', proje_gecmis: 'oku', firmalar: 'oku', kisiler: 'oku', siparisler: 'oku', urunler: 'yaz', stok_gecmis: 'yaz', _ekran: { projeler: 'oku', firmalar: 'oku', siparisler: 'oku', urunler: 'yaz', bayi: 'yaz' }, _gizli: ['tutar'] } }));`) });
  await p.goto(U + '#/bugun'); await w(1800);
  const nav = await p.evaluate(() => [...document.querySelectorAll('#nav a[href^="#/"]')].map(a => a.getAttribute('href').slice(2)));
  kontrol('Üye menüsünde yalnızca açık ekranlar var', !nav.some(r => ['takvim', 'masraflar', 'harita', 'panel', 'dosyalar'].includes(r)) && nav.includes('projeler'), nav.join(' '));
  await p.goto(U + '#/masraflar'); await w(500); kontrol('Kapalı ekran adres çubuğundan açılmıyor', (await p.evaluate(() => location.hash)) === '#/bugun');
  await p.goto(U + '#/proje/p1'); await w(800);
  const sekmeler = await p.evaluate(() => [...document.querySelectorAll('.ps-sayfa [role=tab]')].map(x => x.textContent));
  kontrol('Proje kartında kapalı sekme yok', sekmeler.length && !sekmeler.some(s => /Ziyaret/.test(s)), sekmeler.join(' | '));
  { const yd = await p.evaluate(() => [...document.querySelectorAll('.ps-sayfa button:not([role=tab])')].filter(b => /Ziyaret ekle|sil|Teklif|Düzenle/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))).map(b => b.outerHTML.slice(0, 120)).concat(document.querySelector('.ps-sayfa [data-asama]') ? ['asama'] : [])); kontrol('Görür yetkisinde düzenleme düğmesi yok', !yd.length, yd.join(' / ')); }
  kontrol('Tutarlar gizli', /•••/.test(await p.textContent('.ps-sayfa .dh-meta')));
  kontrol('Kapalı verilerin hiçbiri ekranda yok', !/GIZLI_ZIYARET|GIZLI_MASRAF|125\.000/.test(await p.evaluate(() => document.body.innerText)));
  const kayit = await p.evaluate(async () => { const { app } = await import('./js/state.js'); try { await app.db.save('projeler', { id: 'p1', ad: 'x' }); return 'kaydetti'; } catch (e) { return e.message; } });
  kontrol('Görür yetkisinde kayıt reddediliyor', kayit !== 'kaydetti', kayit);
  kontrol('Üye ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 4) Giriş ekranı ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`localStorage.setItem('__OTURUMYOK', '1'); localStorage.setItem('__DB', '{}');`) });
  await p.goto(U + '#/bugun'); await w(1200);
  kontrol('Oturum yokken giriş ekranı açılıyor', await p.isVisible('[data-giris]'));
  await p.fill('#l-e', 'burak'); await p.fill('#l-p', 'yanlis1'); await p.click('[data-giris] [type=submit]'); await w(500);
  kontrol('Yanlış şifrede anlaşılır uyarı', /hatalı/.test(await p.textContent('#toast')));
  await p.click('[data-unuttum]'); await w(400); kontrol('Şifremi unuttum bağlantı gönderiyor', await p.isVisible('.login-card .davet.ok'));
  await p.fill('#l-e', 'burak'); await p.fill('#l-p', 'dogru123'); await p.click('[data-giris] [type=submit]'); await w(1500);
  kontrol('Kullanıcı adıyla giriş yapılıyor', !(await p.isVisible('.login')));
  await p.goto(U + '#access_token=x&type=recovery'); await p.reload(); await w(1500);
  kontrol('Şifre yenileme bağlantısı yeni şifre ekranını açıyor', await p.isVisible('#y-p'));
  kontrol('Girişte hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 5) Hata günlüğü ----------
{
  const { p, c } = await sayfa({ supabase: true, hazirla: new Function(`localStorage.setItem('__DB', '{}');`) });
  await p.goto(U + '#/bugun'); await w(1200);
  await p.evaluate(() => setTimeout(() => { throw new Error('deneme hatası'); }, 0)); await w(300);
  await p.evaluate(async () => (await import('./js/saglik.js')).hataGonder()); await w(300);
  const kayit = await p.evaluate(() => window.__DB.hata_gunlugu || []);
  kontrol('Hata günlüğe yazılıyor', kayit.some(h => /deneme hatası/.test(h.mesaj) && h.surum), JSON.stringify(kayit).slice(0, 200));
  await c.close();
}

// ---------- 6) Satış araçları: tabela okuma, hedefe kalan, fiyat listesi karşılaştırması ----------
{
  const { p, c, hatalar } = await sayfa();
  await p.clock.setFixedTime(new Date('2026-10-23T10:00:00'));
  await p.goto(U + '#/bugun'); await w(1000);
  const tb = await p.evaluate(async () => (await import('./js/tabela.js')).tabelaAyristir('İŞİN ADI : ÖRNEK HASTANE EK BİNA\nYAPI SAHİBİ: Örnek Bakanlık\nYÜKLENİCİ FİRMA : ÖRNEK İNŞAAT LTD. ŞTİ.\nELEKTRİK YÜKLENİCİSİ: Örnek Elektrik\nADA/PARSEL: 12/3\nMERSİN'));
  kontrol('Tabeladan proje adı ve firmalar ayrılıyor', tb.ad === 'Örnek Hastane Ek Bina' && tb.yatirimci === 'Örnek Bakanlık' && /İNŞAAT/.test(tb.gemut || '') && tb.emut === 'Örnek Elektrik' && tb.parsel === '12/3' && tb.il === 'Mersin', JSON.stringify(tb));
  await p.evaluate(async () => { const { app } = await import('./js/state.js');
    await app.db.save('hedefler', { yil: 2026, ceyrek: 4, tutar_usd: 200000 }); await app.db.save('siparisler', { tarih: '2026-10-05', net_deger: 50000, para_birimi: 'USD' });
    await app.db.save('projeler', { id: 'hs', ad: 'Sıcak Proje', durum: 'Sıcak', tutar_usd: 80000, beklenen_tarih: '2026-11-15' });
    await app.db.save('teklifler', { id: 'tf', teklif_no: 'T-1', durum: 'Gönderildi', para_birimi: 'USD', iskonto: 10, kalemler: [{ kod: '1000001', ad: 'ORNEK', adet: 100, birim_fiyat: 40, iskonto: 5 }] }); });
  const h = await p.evaluate(async () => { const r = (await import('./js/hedef.js')).hedefDurumu('2026-10-23'); return { kalan: r.kalan, hafta: r.hafta, liste: r.liste.map(x => x.p.id) }; });
  kontrol('Hedefe kalan ve haftalık ihtiyaç hesaplanıyor', h.kalan === 150000 && h.hafta === 10 && h.liste.includes('hs'), JSON.stringify(h));
  await p.goto(U + '#/panel'); await w(600); kontrol('Panelde hedefe kalan kartı var', /150\.000/.test(await p.textContent('.hedef-k').catch(() => '')));
  const fk = await p.evaluate(async () => { const m = await import('./js/fiyatlistesi.js'); return m.karsilastir({ liste: new Map([['1000001', { kod: '1000001', fiyat: 44, pb: 'USD' }]]), acMap: new Map() }).map(x => [x.degisen, Math.round(x.eski), Math.round(x.yeni)]); });
  kontrol('Fiyat listesi açık teklifi doğru karşılaştırıyor', JSON.stringify(fk) === '[[1,3420,3762]]', JSON.stringify(fk));
  kontrol('Satış araçlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 7) Genel sürüm: kurulum sihirbazı ve firma profili; eski kurulum değişmez ----------
{
  const { p, c, hatalar } = await sayfa({ hazirla: new Function(`localStorage.removeItem('saha-tanitim');`) });
  await p.goto(U); await w(1500);
  kontrol('Yeni hesapta kurulum sihirbazı açılıyor', await p.isVisible('.sihirbaz'));
  await p.fill('#sz-firma', 'Deneme Elektrik'); await p.click('[data-ileri]'); await w(150);
  await p.click('[data-sektor="elektrik"]'); await p.click('[data-ileri]'); await w(150);
  await p.click('[data-il="Konya"]'); await p.click('[data-il="İzmir"]'); await p.click('[data-ileri]'); await w(150);
  await p.fill('#sz-bayi', 'Örnek Bayi'); await p.click('[data-ileri]'); await w(150); await p.click('[data-ileri]'); await w(1200);
  const st = await p.evaluate(async () => { const ui = await import('./js/ui.js'); const { S } = await import('./js/db.js'); return { iller: ui.ILLER.join(','), rakip: ui.RAKIPLER[0], bayi: S.firmalar.some(f => f.ad === 'Örnek Bayi'), eae: (await import('./js/profil.js')).eaeKatalog() }; });
  kontrol('Sihirbaz bölgeyi, rakipleri ve bayiyi ayarlıyor', st.iller === 'Konya,İzmir' && st.rakip === 'Schneider' && st.bayi && !st.eae, JSON.stringify(st));
  await p.goto(U + '#/katalog'); await w(500); kontrol('Genel sürümde EAE kataloğu yok', !(await p.isVisible('[data-eae]')));
  kontrol('Sihirbazda hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
{
  const { p, c } = await sayfa({ supabase: true, hazirla: DB });
  await p.goto(U + '#/bugun'); await w(1500);
  const st = await p.evaluate(async () => ({ iller: (await import('./js/ui.js')).ILLER.join(','), eae: (await import('./js/profil.js')).eaeKatalog() }));
  kontrol('Profilsiz eski kurulum aynen çalışıyor (sihirbaz yok, bölge ve katalog aynı)', !(await p.isVisible('.sihirbaz')) && st.iller === 'Adana,Mersin,Hatay,Osmaniye' && st.eae, JSON.stringify(st));
  await c.close();
}

// ---------- 8) Yönetici: bütün hesaplar, kim ne ekledi, hesaba salt okunur bakma; kendi verisi karışmaz ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`localStorage.setItem('__YONETICI', '1'); localStorage.setItem('__DB', JSON.stringify({
    projeler: [{ id: 'p1', owner: 'u1', ad: 'KENDI_PROJEM', durum: 'Teklif', updated_at: '2026-10-23T08:00:00Z' }, { id: 'p9', owner: 'u9', ad: 'MUSTERI_PROJESI', durum: 'Proje', updated_at: '2026-10-23T08:01:00Z' }],
    degisiklikler: [{ id: 1, owner: 'u9', tablo: 'projeler', islem: 'ekleme', kim: 'ali@ornek.com', zaman: new Date().toISOString(), ozet: 'MUSTERI_PROJESI' }] }));`) });
  await p.goto(U + '#/projeler'); await w(1500);
  kontrol('Yöneticinin kendi ekranında başka hesabın verisi yok', JSON.stringify(await p.evaluate(async () => (await import('./js/db.js')).S.projeler.map(x => x.id))) === '["p1"]');
  await p.goto(U + '#/yonetim'); await w(1000);
  kontrol('Yönetim panelinde hesaplar listeleniyor', (await p.locator('.yon-hesap [data-h]').count()) === 2);
  await p.click('[data-ys="akis"]'); await w(700);
  kontrol('Kim ne ekledi akışı görünüyor', /ali@ornek\.com/.test(await p.textContent('[data-yicerik]')));
  await p.click('[data-ys="hesaplar"]'); await w(300); await p.click('[data-h="u9"]'); await w(500); await p.click('[data-bak]'); await w(2000);
  const bak = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { app } = await import('./js/state.js'); let k; try { await app.db.save('projeler', { id: 'p9', ad: 'x' }); k = 'kaydetti'; } catch (e) { k = e.message; } return { p: S.projeler.map(x => x.id), k }; });
  kontrol('Hesaba bakınca yalnızca o hesabın verisi, değişiklik yapılamıyor', JSON.stringify(bak.p) === '["p9"]' && bak.k !== 'kaydetti' && await p.isVisible('#onizleme-bar'), JSON.stringify(bak));
  await p.click('#onizleme-bar button'); await w(1800);
  kontrol('Bakıştan çıkınca kendi verisine dönüyor', JSON.stringify(await p.evaluate(async () => (await import('./js/db.js')).S.projeler.map(x => x.id))) === '["p1"]');
  kontrol('Yönetim panelinde hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 9) Kartvizit kırpma: kart bulunuyor, düz ve yatay kesiliyor; kırpma ekranı çalışıyor ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB });
  await p.goto(U + '#/kisiler'); await w(1000);
  const r = await p.evaluate(async () => {
    const K = await import('./js/kirp.js'), out = [];
    for (const [aci, zemin, dikey] of [[7, '#7a5534', 0], [-20, '#2b3138', 0], [93, '#7a5534', 1], [3, '#e4e2dc', 0]]) {
      const W = dikey ? 1500 : 2000, H = dikey ? 2000 : 1500, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
      x.fillStyle = zemin; x.fillRect(0, 0, W, H); x.save(); x.translate(W / 2, H / 2); x.rotate(aci * Math.PI / 180);
      x.fillStyle = '#fbfbf8'; x.fillRect(-680, -440, 1360, 880); x.fillStyle = '#222'; x.font = 'bold 90px Arial'; x.fillText('Deneme Kişi', -560, -60); x.restore();
      const k = K.koseBul(cv), kes = K.kartiKes(cv, k || K.icKoseler(cv));
      const rr = aci * Math.PI / 180, ger = K.siraliKoseler([[-680, -440], [680, -440], [680, 440], [-680, 440]].map(([a, b]) => [W / 2 + a * Math.cos(rr) - b * Math.sin(rr), H / 2 + a * Math.sin(rr) + b * Math.cos(rr)]));
      out.push({ bulundu: !!k, hata: k ? Math.max(...k.map((q, i) => Math.hypot(q[0] - ger[i][0], q[1] - ger[i][1]))) / W : 1, oran: kes.width / kes.height });
    }
    return out;
  });
  kontrol('Kartvizitin köşeleri bulunuyor (eğik, yan duran, beyaz zeminde)', r.every(x => x.bulundu && x.hata < 0.03), JSON.stringify(r));
  kontrol('Kart yatay ve doğru oranda kesiliyor', r.every(x => x.oran > 1.4 && x.oran < 1.7), JSON.stringify(r.map(x => x.oran.toFixed(2))));
  await p.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900; const x = cv.getContext('2d'); x.fillStyle = '#444'; x.fillRect(0, 0, 1200, 900); x.fillStyle = '#fff'; x.fillRect(200, 200, 800, 500);
    const b = await new Promise(r => cv.toBlob(r, 'image/jpeg')); window.__kirp = (await import('./js/kirp.js')).kartvizitKirp(b); });
  await p.waitForSelector('.kirp [data-kes]'); await p.click('[data-kes]'); await w(200); await p.click('[data-don]'); await p.click('[data-kul]');
  const son = await p.evaluate(async () => { const v = await window.__kirp; const i = await createImageBitmap(v.blob); return { w: i.width, h: i.height, acik: !!document.querySelector('.kirp') }; });
  kontrol('Kırpma ekranı kartı döndürüp veriyor', son.h > son.w && !son.acik, JSON.stringify(son));
  // Kişi formunda: galeriden seç → kırp → kart kutuya yükleniyor
  await p.evaluate(() => { window.__TESS_YOL = { betik: '/yok.js' }; });   // okuma motoru testte indirilmez
  await p.click('[data-new]'); await w(500);
  const kart = await p.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900; const x = cv.getContext('2d'); x.fillStyle = '#444'; x.fillRect(0, 0, 1200, 900); x.fillStyle = '#fff'; x.fillRect(200, 200, 800, 500); return cv.toDataURL('image/jpeg'); });
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-kv-hizli="gal"]')]);
  await fc.setFiles({ name: 'kart.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(kart.split(',')[1], 'base64') });
  await p.waitForSelector('.kirp [data-kes]'); await p.click('[data-kes]'); await w(200); await p.click('[data-kul]'); await w(1500);
  const kv = await p.evaluate(() => ({ yol: document.querySelector('[data-kvs="kartvizit_on"]')?.dataset.val, don: document.querySelector('[data-kvs="kartvizit_on"] [data-kv-don]')?.hidden, ocr: !!document.querySelector('[data-ocr] .warn, [data-ocr] .ocr-box') }));
  kontrol('Kişi formunda kırpılan kartvizit kaydediliyor ve okumaya gönderiliyor', !!kv.yol && kv.don === false && kv.ocr, JSON.stringify(kv));
  // Uygulama içi kamera: yalnızca arka kamera istenir, kart canlı bulunup kendiliğinden çekilir, kırpılmış kart döner
  const kam = await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 1280; const x = cv.getContext('2d');
    const boya = () => { x.fillStyle = '#6b4a2e'; x.fillRect(0, 0, 720, 1280); x.save(); x.translate(360, 640); x.rotate(0.06); x.fillStyle = '#f7f7f2'; x.fillRect(-300, -190, 600, 380); x.fillStyle = '#222'; x.fillRect(-240, -100, 330, 30); x.restore(); };
    boya(); const zam = setInterval(boya, 100);
    const istekler = [];
    navigator.mediaDevices.getUserMedia = async k => { istekler.push(k.video.facingMode); return cv.captureStream(15); };
    const K = await import('./js/kirp.js'); const s = K.kartvizitFotografi(true);
    const t0 = Date.now(); while (!document.querySelector('.kirp [data-kul]:not([hidden])') && Date.now() - t0 < 12000) await new Promise(r => setTimeout(r, 200));
    const bekle = async f => { const t = Date.now(); while (!f() && Date.now() - t < 12000) await new Promise(r => setTimeout(r, 200)); return f(); };
    // Yeniden çek: kamera tekrar açılır, ikinci çekim kullanılır
    document.querySelector('.kirp [data-tekrar]')?.click();
    const yenidenAcildi = await bekle(() => document.querySelector('.kam'));
    await bekle(() => document.querySelector('.kirp [data-kul]:not([hidden])'));
    const kamKapandi = !!yenidenAcildi && !document.querySelector('.kam');
    document.querySelector('.kirp [data-kul]')?.click();
    const r = await s; window.__zam = zam; const i = r && await createImageBitmap(r.dosya);
    return { istek: JSON.stringify(istekler[0]), kamKapandi, boyut: i ? [i.width, i.height] : null };
  });
  // Çok kameralı telefonda ana (odaklı) arka kamera seçiliyor, geniş açı lensi değil
  const lens = await p.evaluate(async () => {
    const eskiG = navigator.mediaDevices.getUserMedia, eskiE = navigator.mediaDevices.enumerateDevices, istek = [];
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'gen', label: 'camera2 2, facing back' }, { kind: 'videoinput', deviceId: 'on', label: 'camera2 1, facing front' }, { kind: 'videoinput', deviceId: 'ana', label: 'camera2 0, facing back' }];
    navigator.mediaDevices.getUserMedia = async k => { istek.push(k.video.deviceId?.exact || 'facing'); const st = cv.captureStream(); const t = st.getVideoTracks()[0]; const id = k.video.deviceId?.exact || 'gen'; t.getSettings = () => ({ deviceId: id }); return st; };
    try { localStorage.removeItem('saha-kam-lens'); } catch {}
    const K = await import('./js/kirp.js'); const s = K.kartvizitFotografi(true);
    const t = Date.now(); while (!document.querySelector('.kam') && Date.now() - t < 5000) await new Promise(r => setTimeout(r, 100));
    const lensDugme = document.querySelector('.kam [data-lens]')?.textContent;
    document.querySelector('.kam [data-vaz]')?.click(); await s;
    navigator.mediaDevices.getUserMedia = eskiG; navigator.mediaDevices.enumerateDevices = eskiE;
    return { istek, lensDugme };
  });
  kontrol('Ana arka kamera (camera2 0) seçiliyor, lens değiştirilebiliyor', lens.istek.join(',') === 'facing,ana' && lens.lensDugme === 'Lens 2/2', JSON.stringify(lens));
  const iptal = await p.evaluate(async () => { const K = await import('./js/kirp.js'); const s = K.kartvizitFotografi(true); const t = Date.now(); while (!document.querySelector('.kirp [data-iptal]') && Date.now() - t < 12000) await new Promise(r => setTimeout(r, 200)); document.querySelector('.kirp [data-iptal]')?.click(); return { sonuc: await s, acik: !!document.querySelector('.kirp, .kam') }; });
  kontrol('Önizlemede İptal hiçbir şey kaydetmeden kapatıyor', iptal.sonuc === null && !iptal.acik, JSON.stringify(iptal));
  await p.evaluate(() => clearInterval(window.__zam));
  kontrol('Kamera yalnızca arka kamerayı istiyor, kartı kendiliğinden çekip kırpıyor, yeniden çekilebiliyor', kam.istek === '{"exact":"environment"}' && kam.kamKapandi && kam.boyut && Math.abs(kam.boyut[0] / kam.boyut[1] - 600 / 380) < 0.12, JSON.stringify(kam));
  // Kartvizit ayrıştırma: büyük yazılan satır ad; logo alt yazısı unvan sayılmaz; soyaddaki "TAŞ" şirket eki sanılmaz
  const ayr = await p.evaluate(async () => { const O = await import('./js/ocr.js');
    const sat = [{ metin: 'Ahmet KARTAŞ', boy: 52 }, { metin: 'Elektrik | Mühendislik', boy: 19 }, { metin: 'ÖRNEKKENT AYDINLATMA ELEKTRİK SAN. VE TİC.LTD. ŞTİ.', boy: 26 }, { metin: 'Telefon: 0507 000 1122', boy: 20 }];
    return O.kartvizitAyristir(sat.map(x => x.metin).join('\n'), sat); });
  kontrol('Kartvizitte ad, firma ve unvan doğru ayrılıyor', ayr.ad_soyad === 'Ahmet Kartaş' && ayr.unvan === null && ayr.firma === 'Örnekkent Aydınlatma Elektrik San. ve Tic. Ltd. Şti.' && ayr.telefon === '0507 000 11 22', JSON.stringify(ayr));
  // Logo adı kişi adı sanılmıyor: e-postanın başı kişiyi, alan adı firmayı gösteriyor; "I$" → "İş"
  const ayr2 = await p.evaluate(async () => { const O = await import('./js/ocr.js');
    const sat = [{ metin: 'vs TEKNOVA', boy: 60 }, { metin: 'Ayla KORKMAZ', boy: 30 }, { metin: 'I$ Geliştirme Mühendisi', boy: 20 }, { metin: '+90 (532) 111 22 33', boy: 18 }, { metin: 'aylakorkmaz@teknovaotomasyon.com', boy: 18 }];
    const r = O.kartvizitAyristir(sat.map(x => x.metin).join('\n'), sat); const { pozisyonTahmin } = await import('./js/ui.js'); return { ...r, poz: pozisyonTahmin(r.unvan) }; });
  kontrol('Kartvizitte logo ad sanılmıyor, firma alan adından bulunuyor, pozisyon tahmin ediliyor', ayr2.ad_soyad === 'Ayla Korkmaz' && ayr2.firma === 'Teknova' && ayr2.unvan === 'İş Geliştirme Mühendisi' && ayr2.poz === 'Satış / Pazarlama', JSON.stringify(ayr2));
  // Ad ve soyad ayrı: eski kayıt bölünüyor, kaydedince tam ad ikisinden oluşuyor
  await p.goto(U + '#/kisiler'); await p.reload(); await w(1500); await p.click('a[href="#/kisi/k1"]'); await w(800); await p.click('.fs-act [data-a="duzenle"]'); await w(500);
  const ad0 = await p.evaluate(() => [document.querySelector('.drawer.open [name=ad]')?.value, document.querySelector('.drawer.open [name=soyad]')?.value]);
  await p.fill('.drawer.open [name=ad]', 'Ayşe Nur'); await p.fill('.drawer.open [name=soyad]', 'Kaya'); await p.click('.drawer.open [type=submit]'); await w(800);
  const ad1 = await p.evaluate(async () => { const k = (await import('./js/db.js')).S.kisiler.find(x => x.id === 'k1'); return [k.ad, k.soyad, k.ad_soyad]; });
  kontrol('Ad ve soyad ayrı alanlarda; tam ad ikisinden oluşuyor', JSON.stringify(ad0) === '["Deneme","Kişi"]' && JSON.stringify(ad1) === '["Ayşe Nur","Kaya","Ayşe Nur Kaya"]', JSON.stringify([ad0, ad1]));
  // Firmaya kayıtlı kişi atama ve ayırma
  await p.goto(U + '#/firmalar'); await p.reload(); await w(1500); await p.click('a[href="#/firma/f1"]'); await w(800); await p.click('[data-fsk="kisiler"]'); await w(300);
  await p.click('.fs-sayfa [data-a="bagla"]'); await p.fill('.fs-sayfa [data-kisi-ara]', 'Ayşe'); await w(200);
  await p.click('.fs-sayfa [data-ata="k1"]'); await w(800);
  const atandi = await p.evaluate(async () => (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k1').firma_id);
  await p.click('.fs-sayfa [data-ayir="k1"]'); await w(800);
  const ayrildi = await p.evaluate(async () => (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k1').firma_id);
  kontrol('Firmaya kayıtlı kişi atanıyor ve ayrılabiliyor', atandi === 'f1' && !ayrildi, JSON.stringify([atandi, ayrildi]));
  // Firmadan ayrılan kişinin eski firması kartında ve firmanın "Eski çalışanlar"ında görünüyor; elle eski firma eklenebiliyor
  const ef = await p.evaluate(async () => (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k1').eski_firmalar);
  const eskiCalisan = await p.isVisible('.fs-sayfa .eski-baslik');
  await p.goto(U + '#/kisiler'); await p.reload(); await w(1500); await p.click('a[href="#/kisi/k1"]'); await w(800); await p.click('.fs-act [data-a="duzenle"]'); await w(500);
  const efGorunur = await p.textContent('.drawer.open [data-eski-firma]');
  await p.click('.drawer.open [data-ef-ekle]'); await p.fill('.drawer.open [data-ef-firma]', 'Eski Usta Ltd'); await p.fill('.drawer.open [data-ef-unvan]', 'Şef'); await p.fill('.drawer.open [data-ef-tarih]', '2020-05-01'); await p.click('.drawer.open [data-ef-kaydet]'); await w(600);
  const ef2 = await p.evaluate(async () => (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k1').eski_firmalar.map(g => g.firma_ad));
  kontrol('Eski firmalar kişi kartında ve firmanın eski çalışanlarında görünüyor, elle eklenebiliyor', ef?.[0]?.firma_id === 'f1' && eskiCalisan && /tarihine kadar/.test(efGorunur) && ef2.includes('Eski Usta Ltd'), JSON.stringify({ ef, eskiCalisan, ef2 }));
  // Kişide internet sitesi ve adres
  await p.goto(U + '#/kisiler'); await p.reload(); await w(1500); await p.click('a[href="#/kisi/k1"]'); await w(800); await p.click('.fs-act [data-a="duzenle"]'); await w(500);
  await p.fill('.drawer.open [name=web]', 'www.ornek.com'); await p.fill('.drawer.open [name=adres]', 'Örnek Mah. 1. Sok. No:2 Mersin'); await p.click('.drawer.open [type=submit]'); await w(800);
  const wa = await p.evaluate(async () => { const k = (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k1'); return [k.web, k.adres]; });
  kontrol('Kişide internet sitesi ve adres kaydediliyor', wa[0] === 'www.ornek.com' && /Mersin/.test(wa[1]), JSON.stringify(wa));
  // Benzer kayıtlar: aynı telefonlu ikinci kişi bulunuyor, karşılaştırılıp birleştiriliyor; "Farklı kayıtlar" bir daha göstermiyor
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); await app.db.save('kisiler', { id: 'k9', ad_soyad: 'Deneme KİŞİ', ad: 'Deneme', soyad: 'KİŞİ', telefon: '0532 000 00 00', unvan: 'Satınalma' }); await app.db.save('kisiler', { id: 'k8', ad_soyad: 'Başka Biri', telefon: '0555 111 22 33' }); await app.db.save('kisiler', { id: 'k7', ad_soyad: 'Başka Biri', telefon: '0555 999 88 77' }); });
  await p.goto(U + '#/kisiler'); await p.reload(); await w(1500);
  const dug = await p.textContent('[data-benzer]');
  await p.evaluate(() => document.querySelector('[data-benzer]').click()); await w(400);
  await p.click('.drawer.open [data-kars="k1|k9"], .drawer.open [data-kars="k9|k1"]'); await w(400);
  await p.screenshot({ path: 'tests/cikti/benzer.png' });
  await p.click('.drawer.open .cift-alan[data-alan="soyad"] [data-v="a"]').catch(() => {});
  await p.click('.drawer.open [data-birlestir]'); await w(1200);
  const bir = await p.evaluate(async () => { const S = (await import('./js/db.js')).S; return { k9: !!S.kisiler.find(k => k.id === 'k9'), k1: S.kisiler.find(k => k.id === 'k1') }; });
  await p.evaluate(() => document.querySelector('[data-benzer]').click()); await w(400);
  await p.click('.drawer.open [data-kars="k7|k8"], .drawer.open [data-kars="k8|k7"]'); await w(400);
  await p.click('.drawer.open [data-farkli]'); await w(600);
  const kalan = await p.evaluate(async () => (await import('./js/cift.js')).benzerSayisi('kisiler'));
  kontrol('Benzer kişiler bulunuyor, alan seçilerek birleştiriliyor, “Farklı kayıtlar” bir daha gösterilmiyor', /Benzer kayıtlar \(2\)/.test(dug) && !bir.k9 && bir.k1 && bir.k1.unvan === 'Satınalma' && kalan === 0, JSON.stringify({ dug, bir, kalan }));
  // Pozisyona göre süzme (eski firmalardaki pozisyon dahil)
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); await app.db.save('kisiler', { id: 'k6', ad_soyad: 'Poz Deneme', pozisyon: 'Satış / Pazarlama', eski_firmalar: [{ firma_ad: 'Eski AŞ', pozisyon: 'Satınalma', bitis: '2021-01-01' }] }); });
  await p.goto(U + '#/kisiler'); await p.reload(); await w(1500);
  await p.selectOption('[data-poz]', 'Satınalma'); await w(300);
  const s1 = await p.textContent('[data-sum]');
  await p.check('[data-eskidahil]'); await w(300);
  const s2 = await p.textContent('[data-sum]'), eskiYazi = await p.isVisible('text=eskiden: Eski AŞ');
  await p.selectOption('[data-poz]', ''); await w(200);
  kontrol('Kişiler pozisyona göre, eski firmalardaki pozisyonlar dahil süzülüyor', parseInt(s2) === parseInt(s1) + 1 && eskiYazi, JSON.stringify({ s1, s2, eskiYazi }));
  kontrol('Kırpmada hata yok', !hatalar.filter(h => !/Okuma motoru indirilemedi/.test(h)).length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 10) Şirket: şirket kartı, ad değiştirme, kullanıcıyı şirket yöneticisi yapma ----------
{
  const DB2 = new Function('(' + DB.toString() + ')(); const d = JSON.parse(localStorage.getItem("__DB")); d.ekip_uyeleri = [{ id: "e1", owner: "u1", eposta: "ali@x.com", ad: "Ali", aktif: true, yetkiler: { projeler: "oku" }, yonetici: false, created_at: "2026-10-01" }]; localStorage.setItem("__DB", JSON.stringify(d));');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB2 });
  await p.goto(U + '#/ayarlar'); await w(1200);
  const ayarEkipYok = await p.evaluate(() => !document.querySelector('[data-sekme="ekip"], [data-sekme="mesaj"], [data-sekme="profil"]') && !!document.querySelector('[data-sekme="bildirim"]') && !/Döviz kuru|Araç/.test([...document.querySelectorAll('[data-tab="baglanti"] h2, [data-tab="uygulama"] h2')].map(h => h.textContent).join('|')));
  await p.goto(U + '#/sirket/ekip'); await w(1500);
  const sekmeEkip = await p.evaluate(() => ({ h: location.hash, on: document.querySelector('[data-fsk].on')?.dataset.fsk, sek: [...document.querySelectorAll('[data-fsk]')].map(b => b.dataset.fsk).join(',') }));
  await p.screenshot({ path: 'tests/cikti/sirket-ekip.png', fullPage: true });
  kontrol('Ayarlar sadeleşti (Ekip, Mesaj, Firma profili, Döviz kuru, Araç çıktı; Bildirimler ayrı); Ekip ve yetkiler şirket profilinde', ayarEkipYok && sekmeEkip.h === '#/sirket/ekip' && sekmeEkip.on === 'ekip' && sekmeEkip.sek === 'genel,ekip,sablon,kur', JSON.stringify({ ayarEkipYok, sekmeEkip }));
  const kart = await p.isVisible('.sirket-kart');
  await p.fill('#sk-ad', 'Yeni Şirket AŞ'); await p.click('[data-sk-ad]'); await w(300);
  const ad = await p.evaluate(() => localStorage.getItem('__SIRKET_AD'));
  await p.click('[data-uye="ali@x.com"] summary'); await p.check('[data-uye="ali@x.com"] [data-yonetici]'); await p.click('[data-uye="ali@x.com"] [data-kaydet]'); await w(600);
  const yon = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0].yonetici);
  const etiket = await p.isVisible('[data-uye="ali@x.com"] .yon-r');
  kontrol('Şirket kartı görünüyor, şirket adı kaydediliyor, kullanıcı şirket yöneticisi yapılabiliyor', kart && ad === 'Yeni Şirket AŞ' && yon === true && etiket, JSON.stringify({ kart, ad, yon, etiket }));
  // K2: hazır roller eklenir, kullanıcıya rol verilir, rol değişince kullanıcı güncellenir
  await p.click('[data-hazirrol]'); await w(1200);
  const roller = await p.evaluate(() => (JSON.parse(localStorage.getItem('__DB')).roller || []).map(r => r.ad));
  await p.click('[data-uye="ali@x.com"] summary').catch(() => {}); await w(200);
  const satisId = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).roller.find(r => r.ad === 'Satış').id);
  await p.uncheck('[data-uye="ali@x.com"] [data-yonetici]');
  await p.selectOption('[data-uye="ali@x.com"] [data-uyerol]', satisId); await w(200);
  const agacGizli = await p.isHidden('[data-uye="ali@x.com"] [data-agac]');
  await p.click('[data-uye="ali@x.com"] [data-kaydet]'); await w(800);
  const ali1 = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0]);
  await p.click(`.rol-k[data-rol="${satisId}"] summary`); await w(200);
  await p.evaluate(id => document.querySelector(`.rol-k[data-rol="${id}"] [data-ek="harita"] [data-v=""]`).click(), satisId);
  await p.click(`.rol-k[data-rol="${satisId}"] [data-rolkaydet]`); await w(1200);
  await p.locator('.roller-bol').screenshot({ path: 'tests/cikti/roller.png' }).catch(() => {});
  const ali2 = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0].yetkiler);
  kontrol('Hazır roller ekleniyor, kullanıcı rol alıyor, rol değişince kullanıcı da değişiyor', roller.length === 5 && ali1.rol_id === satisId && ali1.yetkiler._rol === 'Satış' && ali1.yetkiler.projeler === 'yaz' && agacGizli && ali1.yetkiler._ekran?.harita === 'oku' && !ali2._ekran?.harita, JSON.stringify({ roller, agacGizli, ali1: { rol: ali1.rol_id === satisId, y: ali1.yetkiler._rol }, h2: ali2._ekran?.harita }));
  // K3: ekip ekle, kullanıcıyı ekibe koy, rol kapsamı "Sadece kendinin", kayıt devri
  await p.click('.ekipler-bol details.card-ic summary'); await p.fill('[data-yeniekip] [data-ekad]', 'Satış Adana'); await p.click('[data-ekekle]'); await w(1200);
  const ekip = await p.evaluate(() => (JSON.parse(localStorage.getItem('__DB')).ekipler || [])[0]);
  await p.click('[data-uye="ali@x.com"] summary').catch(() => {}); await w(200);
  await p.selectOption('[data-uye="ali@x.com"] [data-uyeekip]', ekip.id); await p.click('[data-uye="ali@x.com"] [data-kaydet]'); await w(700);
  const sid = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).roller.find(r => r.ad === 'Satış').id);
  await p.click(`.rol-k[data-rol="${sid}"] summary`).catch(() => {}); await w(200);
  await p.click(`.rol-k[data-rol="${sid}"] [data-kapsam] [data-v="kendi"]`); await p.click(`.rol-k[data-rol="${sid}"] [data-rolkaydet]`); await w(1200);
  const k3 = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('__DB')); return { ekip: d.ekip_uyeleri[0].ekip_id, kapsam: d.roller.find(r => r.ad === 'Satış').yetkiler._kapsam, aliKapsam: d.ekip_uyeleri[0].yetkiler._kapsam }; });
  await p.evaluate(() => { window.__DB.firmalar[0].sorumlu = 'ali@x.com'; localStorage.setItem('__DB', JSON.stringify(window.__DB)); });
  await p.click('[data-uye="ali@x.com"] summary').catch(() => {}); await w(200);
  if (!(await p.isVisible('[data-uye="ali@x.com"] [data-devret]'))) await p.click('[data-uye="ali@x.com"] summary');
  await p.click('[data-uye="ali@x.com"] [data-devret]'); await p.click('[data-uye="ali@x.com"] [data-devyap]'); await w(800);
  const devir = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).firmalar[0].sorumlu);
  kontrol('Ekip ekleniyor, kullanıcı ekibe konuyor, rol kapsamı kaydediliyor ve kişiye yayılıyor, kayıtlar devrediliyor', k3.ekip === ekip?.id && k3.kapsam === 'kendi' && k3.aliKapsam === 'kendi' && devir === 'sahip@x.com', JSON.stringify({ k3, devir }));
  kontrol('Şirket ekranında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 13) K4: hassas alanlar sunucuda (tutar gizli üyeye hiç gelmez, kaydetmek silmez) ----------
{
  const DB5 = new Function('(' + DB.toString() + ')(); localStorage.setItem("__HASSAS", "1"); localStorage.setItem("__YETKI", JSON.stringify({ sahip: "u1", ben_sahip: false, yetkiler: { projeler: "yaz", firmalar: "oku", _ekran: { projeler: "yaz" }, _gizli: ["tutar"] } }));');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB5 });
  await p.goto(U + '#/proje/p1'); await w(1800);
  const uye = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { app } = await import('./js/state.js'); return { tutar: S.projeler.find(x => x.id === 'p1')?.tutar_usd, meta: document.querySelector('.ps-sayfa .dh-meta')?.textContent || '', gizli: JSON.stringify(app.db.gizliAlan) }; });
  await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { app } = await import('./js/state.js'); await app.db.save('projeler', { ...S.projeler.find(x => x.id === 'p1'), ad: 'Örnek Hastane (üye)', tutar_usd: null }); });
  await w(400);
  const sunucu = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).projeler.find(x => x.id === 'p1'));
  // Sahip: aynı veri, tutarı görür
  await p.evaluate(() => { localStorage.removeItem('__YETKI'); }); await p.goto(U + '#/proje/p1'); await p.reload(); await w(1800);
  const sahip = await p.evaluate(async () => (await import('./js/db.js')).S.projeler.find(x => x.id === 'p1')?.tutar_usd);
  kontrol('K4: tutar gizli üyeye sunucudan hiç gelmiyor, kaydettiğinde silinmiyor; sahip görüyor', uye.tutar === undefined && !/125/.test(uye.meta) && /tutar_usd/.test(uye.gizli) && sunucu.ad === 'Örnek Hastane (üye)' && sunucu.tutar_usd === 125000 && sahip === 125000, JSON.stringify({ uye, sunucu: { ad: sunucu.ad, t: sunucu.tutar_usd }, sahip }));
  kontrol('K4 ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 12) Kapsamı dar kullanıcı aramada "başka satışçıda" görür ----------
{
  const DB4 = new Function('(' + DB.toString() + ')(); localStorage.setItem("__YETKI", JSON.stringify({ sahip: "u1", ben_sahip: false, yetkiler: { firmalar: "yaz", kisiler: "yaz", _ekran: { firmalar: "yaz" }, _kapsam: "kendi" } })); localStorage.setItem("__BASKA", "1");');
  const { p, c } = await sayfa({ supabase: true, hazirla: DB4 });
  await p.goto(U + '#/firmalar'); await w(1500);
  await p.fill('[data-q]', 'Gizli'); await w(900);
  const t = await p.textContent('[data-baska]').catch(() => '');
  kontrol('Kapsamı dar kullanıcı aradığı firmanın başka satışçıda olduğunu görüyor', /Başka satışçıda:.*Gizli Firma AŞ.*Veli/.test(t || ''), t);
  await c.close();
}

// ---------- 11) Firma organizasyon şeması ve menüde firma/sürüm ----------
{
  const DB3 = new Function('(' + DB.toString() + ')(); const d = JSON.parse(localStorage.getItem("__DB")); const o = x => ({ owner: "u1", firma_id: "f2", ...x }); d.kisiler.push(o({ id: "k2", ad_soyad: "Ahmet Yılmaz", unvan: "Genel Müdür", pozisyon: "Genel müdür / Yönetim", rol: "Karar verici" }), o({ id: "k3", ad_soyad: "Zeynep Ak", unvan: "Satınalma Uzmanı", pozisyon: "Satınalma", ust_kisi_id: "k2" }), o({ id: "k4", ad_soyad: "Can Öz", unvan: "Proje Mühendisi", pozisyon: "Proje / Tasarım" }), o({ id: "k5", ad_soyad: "Ece Su", unvan: "Satınalma Asistanı", pozisyon: "Satınalma", ust_kisi_id: "k3" }), o({ id: "k7", firma_id: "f1", ad_soyad: "Eski Çalışan", eski_firmalar: [{ firma_id: "f2", firma_ad: "Örnek Emüt", unvan: "Satınalma Müdürü", bitis: "2024-03-01" }] })); d.ziyaretler.push({ id: "z9", owner: "u1", firma_id: "f2", kisi_id: "k3", tarih: new Date().toISOString().slice(0, 10) }); localStorage.setItem("__DB", JSON.stringify(d)); localStorage.setItem("saha-ayar-firma_profil", "1");');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB3 });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(U + '#/firma/f2/kisiler'); await p.reload(); await w(1800);
  const org = await p.evaluate(() => { const r = document.querySelector('.fs-sayfa .org'); return r && { kutu: r.querySelectorAll('.org-kutu').length, ust: r.querySelector(':scope > li > .org-kutu b')?.textContent, ic: !!r.querySelector('li li li .org-kutu') }; });
  await p.locator('.fs-sayfa [data-org]').screenshot({ path: 'tests/cikti/org.png' }).catch(() => {});
  const eski = await p.evaluate(() => [...document.querySelectorAll('.fs-sayfa .org-eski .org-kutu')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  // Sürükle-bırak: Can Öz'ü Ahmet Yılmaz'ın üstüne bırak
  const kaynak = await p.locator('.fs-sayfa .org [data-kid="k4"]').boundingBox(), hedef = await p.locator('.fs-sayfa .org [data-kid="k2"]').boundingBox();
  await p.mouse.move(kaynak.x + 30, kaynak.y + 20); await p.mouse.down(); await p.mouse.move(kaynak.x + 60, kaynak.y + 10, { steps: 4 }); await p.mouse.move(hedef.x + 40, hedef.y + 20, { steps: 8 }); await p.mouse.up(); await w(1000);
  const bag = await p.evaluate(async () => (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k4').ust_kisi_id);
  // Bölümler: Ahmet'in altındaki Zeynep (Satınalma) bölüm etiketiyle; kişiye tıklayınca hızlı düzenleme; yakınlaştırma
  const bolum = await p.evaluate(() => !!document.querySelector('.fs-sayfa .org [data-gust="k2"][data-grup="Satınalma"]') && !!document.querySelector('.fs-sayfa .org [data-gust="k2"][data-grup="Proje / Tasarım"]'));
  await p.click('.fs-sayfa .org [data-kid="k4"]'); await w(300);
  const dlg = await p.isVisible('dialog.org-dlg');
  await p.selectOption('dialog.org-dlg #od-p', 'Mühendis / Teknik'); await p.fill('dialog.org-dlg #od-u', 'Elektrik Mühendisi'); await p.click('dialog.org-dlg [data-kay]'); await w(1000);
  const k4 = await p.evaluate(async () => { const k = (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k4'); return [k.pozisyon, k.unvan]; });
  const z0 = await p.textContent('.fs-sayfa [data-zoomyuzde]'); await p.click('.fs-sayfa [data-zoom="+"]'); const z1 = await p.textContent('.fs-sayfa [data-zoomyuzde]');
  const kb = await p.locator('.fs-sayfa .org-kaydir').boundingBox(); await p.mouse.move(kb.x + 20, kb.y + 20); await p.mouse.wheel(0, 200); await w(200); const z2 = await p.textContent('.fs-sayfa [data-zoomyuzde]');
  await p.click('.fs-sayfa [data-zoom="sigdir"]');
  await p.click('.fs-sayfa [data-indir]'); await w(300);
  const indirDlg = await p.evaluate(() => ({ ayr: !!document.querySelector('dialog.org-dlg [data-ayr]') }));
  const [indirme] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('dialog.org-dlg [data-indirgit]')]);
  let pngBoyut = 0; if (indirme) { await indirme.saveAs('tests/cikti/sema-indir.png'); pngBoyut = (await import('node:fs')).statSync('tests/cikti/sema-indir.png').size; }
  await p.click('.fs-sayfa [data-indir]'); await w(300); await p.click('dialog.org-dlg [data-bc="pdf"]'); await p.check('dialog.org-dlg [data-ayr]'); await p.click('dialog.org-dlg [data-indirgit]'); await w(500);
  const pdf = await p.evaluate(() => { const f = [...document.querySelectorAll('iframe')].find(f => /<svg/.test(f.srcdoc || '')); return f ? { svg: (f.srcdoc.match(/<rect/g) || []).length, ad: /Ahmet Yılmaz/.test(f.srcdoc), baslik: /Organizasyon şeması/.test(f.srcdoc), ayr: /Firmadan ayrılanlar/.test(f.srcdoc), temas: /temas yok|gün önce|bugün/.test(f.srcdoc) } : null; });
  kontrol('Şema resim (PNG) ve PDF olarak indiriliyor; ayrılanlar isteğe bağlı, temas bilgisi çıktıda yok', indirDlg.ayr && indirme && /organizasyon\.png$/.test(indirme.suggestedFilename()) && pngBoyut > 5000 && pdf?.svg >= 5 && pdf.ad && pdf.baslik && pdf.ayr && !pdf.temas, JSON.stringify({ indirDlg, ad: indirme?.suggestedFilename(), pngBoyut, pdf }));
  kontrol('Şemada yönetici altında bölümler, kişiye tıklayınca görev değişiyor, yakınlaştırma çalışıyor', bolum && dlg && k4[0] === 'Mühendis / Teknik' && k4[1] === 'Elektrik Mühendisi' && parseInt(z1) > parseInt(z0) && parseInt(z2) < parseInt(z1), JSON.stringify({ bolum, dlg, k4, z0, z1, z2 }));
  // Telefonda: basılı tut (0,3 sn) ve sürükle — Ece Su'yu Ahmet Yılmaz'ın altına
  await p.setViewportSize({ width: 820, height: 1000 }); await p.goto(U + '#/firmalar'); await p.reload(); await w(1800); await p.click('a[href="#/firma/f2"]'); await w(1200); await p.click('[data-fsk="kisiler"]'); await w(500);
  await p.evaluate(() => document.querySelector('.fs-sayfa [data-org]').scrollIntoView({ block: 'start' })); await w(300);
  const tk = await p.locator('.fs-sayfa .org [data-kid="k5"]').boundingBox(), th = await p.locator('.fs-sayfa .org [data-kid="k2"]').boundingBox();
  const cdp = await c.newCDPSession(p), nokta = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  if (tk && th && tk.y > 0 && th.y > 0) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: nokta(tk.x + 20, tk.y + 15) }); await w(450);
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: nokta(tk.x + 20 + (th.x - tk.x) * i / 10, tk.y + 15 + (th.y - tk.y) * i / 10) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await w(1000);
  }
  const bag2 = await p.evaluate(async () => (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k5').ust_kisi_id);
  kontrol('Telefonda basılı tutup sürükleyerek de bağlanıyor', bag2 === 'k2', JSON.stringify({ bag2, tk: !!tk, th: !!th }));
  kontrol('Şemada sürükle-bırak ile bağlı olduğu kişi ayarlanıyor; ayrılanlar yanda, nereye geçtikleriyle', bag === 'k2' && eski.length === 1 && /şimdi: Örnek Bayi/.test(eski[0]), JSON.stringify({ bag, eski }));
  // Firma sayfası: sekmeler adres çubuğunda, düzenleme pencerede, kişi kartı sayfanın üstünde, geri listeye
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(U + '#/firmalar'); await p.reload(); await w(1500); await p.click('a[href="#/firma/f2"]'); await w(1000);
  const fs1 = await p.evaluate(() => ({ h: location.hash, sek: [...document.querySelectorAll('.fs-sayfa [data-fsk]')].map(b => b.dataset.fsk).join(','), ad: document.querySelector('.fs-kim h1')?.textContent, drawer: !!document.querySelector('.drawer.open') }));
  await p.screenshot({ path: 'tests/cikti/firma-sayfa.png', fullPage: true });
  await p.click('.fs-sayfa .pcard[href="#/kisi/k2"]'); await w(800);
  const kd = await p.evaluate(() => ({ drawer: !document.querySelector('.drawer.open'), sayfa: !!document.querySelector('.ks-sayfa'), h: location.hash, geri: document.querySelector('[data-geri]')?.textContent, ad: document.querySelector('.ks-sayfa h1')?.textContent, sek: [...document.querySelectorAll('.ks-sayfa [data-fsk]')].map(b => b.dataset.fsk).join(',') }));
  await p.screenshot({ path: 'tests/cikti/kisi-sayfa.png', fullPage: true });
  await p.click('.ks-sayfa [data-fsk="notlar"]'); await w(200);
  await p.click('.ks-sayfa .fs-act [data-a="duzenle"]'); await w(500); await p.fill('.drawer.open [name=unvan]', 'Genel Müdür Yardımcısı'); await p.click('.drawer.open [type=submit]'); await w(1000);
  const kd3 = await p.evaluate(async () => ({ unvan: (await import('./js/db.js')).S.kisiler.find(k => k.id === 'k2').unvan, h: location.hash, drawer: !!document.querySelector('.drawer.open'), metin: document.querySelector('.ks-sayfa')?.textContent.includes('Genel Müdür Yardımcısı') }));
  await p.click('[data-geri]'); await w(800);
  const kd2 = await p.evaluate(() => ({ h: location.hash, sayfa: !!document.querySelector('.fs-sayfa:not(.ks-sayfa)') }));
  kontrol('Kişi kendi sayfasında açılıyor (geri: firma adı), düzenleme pencerede, kaydedince sekmede kalıyor, geri firmaya dönüyor', kd.drawer && kd.sayfa && kd.h === '#/kisi/k2' && /Örnek Emüt/.test(kd.geri) && /Ahmet Yılmaz/.test(kd.ad) && kd.sek === 'ozet,projeler,ziyaret,satis,notlar' && kd3.unvan === 'Genel Müdür Yardımcısı' && kd3.h === '#/kisi/k2/notlar' && !kd3.drawer && kd3.metin, JSON.stringify({ kd, kd3, kd2 }));
  await p.click('[data-fsk="ziyaret"]'); await w(200); const h2 = await p.evaluate(() => location.hash);
  await p.click('.fs-act [data-a="duzenle"]'); await w(500); await p.fill('.drawer.open [name=telefon]', '0322 111 22 33'); await p.click('.drawer.open [type=submit]'); await w(1200);
  const fs2 = await p.evaluate(async () => ({ tel: (await import('./js/db.js')).S.firmalar.find(f => f.id === 'f2').telefon, h: location.hash, drawer: !!document.querySelector('.drawer.open'), sekme: document.querySelector('[data-fsk].on')?.dataset.fsk, metin: document.querySelector('.fs-sayfa')?.textContent.includes('0322 111 22 33') }));
  await p.setViewportSize({ width: 390, height: 844 }); await w(300);
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await p.screenshot({ path: 'tests/cikti/firma-sayfa-tel.png' });
  const arac = await p.evaluate(() => { const r = document.querySelector('.fs-arac').getBoundingClientRect(); return { gruplar: [...document.querySelectorAll('.fs-arac .fs-grp')].map(g => g.querySelectorAll(':scope > a, :scope > button').length).join(','), sigdi: r.right <= innerWidth + 1 }; });
  await p.click('.fs-daha'); await w(300);
  const telMenu = await p.evaluate(() => { const m = [...document.querySelectorAll('.fs-menu')].find(m => !m.hidden); if (!m) return {}; return { acik: m.parentElement === document.body, konum: getComputedStyle(m).position, oge: [...m.querySelectorAll('[role=menuitem]')].map(b => b.textContent.trim()), perde: !!document.querySelector('.fs-perde') }; });
  await p.screenshot({ path: 'tests/cikti/firma-daha-tel.png' });
  await p.mouse.click(195, 100); await w(300);
  const telKapandi = await p.evaluate(() => document.querySelector('[data-acilir="daha"] .fs-menu').hidden && !document.querySelector('.fs-perde'));
  await p.setViewportSize({ width: 1280, height: 900 }); await w(200);
  await p.hover('.fs-arac [data-a="ziyaret"]'); await w(200); await p.locator('.fs-bas').screenshot({ path: 'tests/cikti/firma-arac.png' });
  await p.click('.fs-arac [data-a="ziyaret"]'); await w(600);
  const ekleZ = await p.evaluate(() => ({ drawer: !!document.querySelector('.drawer.open'), firma: document.querySelector('.drawer.open [name=firma_id]')?.value }));
  await p.click('.drawer.open .x[data-close]'); await w(500);
  kontrol('Firma başlığında simge çubuğu: iletişim, ekle (ziyaret/kişi/görev/teklif), ⋯ (numune, servis, Google, sil; telefonda alttan panel)', /^[123],4,1$/.test(arac.gruplar) && arac.sigdi && telMenu.acik && telMenu.konum === 'fixed' && telMenu.oge.length === 4 && /sil/i.test(telMenu.oge[3]) && telMenu.perde && telKapandi && ekleZ.drawer, JSON.stringify({ arac, telMenu, telKapandi, ekleZ }));
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); for (let i = 0; i < 12; i++) await app.db.save('projeler', { id: 'pz' + i, ad: 'Ek proje ' + i, durum: 'Proje', emut_id: 'f2' }); app.refresh(); }); await w(600);
  await p.click('[data-fsk="projeler"]'); await w(500);
  const pj = await p.evaluate(() => { const c = document.querySelector('[data-fs="projeler"]'); return { ilk: c.querySelector('.card')?.matches('[data-iliski]'), gorunen: [...c.querySelectorAll('[data-projeler] li')].filter(l => !l.hidden).length, toplam: c.querySelectorAll('[data-projeler] li').length }; });
  await p.click('[data-devam]'); const pj2 = await p.evaluate(() => [...document.querySelectorAll('[data-projeler] li')].filter(l => !l.hidden).length);
  kontrol('Firma projeler sekmesinde ilişki ağı üstte, ilk 10 proje görünüyor, "Devamını göster" kalanı açıyor', pj.ilk && pj.gorunen === 10 && pj.toplam > 10 && pj2 === pj.toplam, JSON.stringify({ pj, pj2 }));
  await p.click('[data-geri]'); await w(800); const h3 = await p.evaluate(() => location.hash);
  kontrol('Firma kendi sayfasında sekmeli açılıyor; kişi kartı üstünde açılıp kapanıyor; düzenleme pencerede, kayıttan sonra aynı sekmede; geri listeye dönüyor',
    fs1.h === '#/firma/f2' && fs1.sek === 'ozet,kisiler,projeler,ziyaret,satis,belgeler,notlar' && fs1.ad && !fs1.drawer && kd.drawer && kd.sayfa && kd2.h === '#/firma/f2' && kd2.sayfa && h2 === '#/firma/f2/ziyaret' && fs2.tel === '0322 111 22 33' && !fs2.drawer && fs2.sekme === 'ziyaret' && fs2.metin && tasma <= 1 && h3 === '#/firmalar',
    JSON.stringify({ fs1, kd, kd2, h2, fs2, tasma, h3 }));
  // Proje sayfası: aşama şeridi, projedeki firmalar, kayıpta form, geri
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); await app.db.save('projeler', { id: 'pq', ad: 'Spor Salonu', durum: 'İhale', tutar_usd: 250000, emut_id: 'f2', ilgili_kisi_id: 'k2', il: 'Mersin' }); });
  await p.goto(U + '#/projeler'); await w(800); await p.goto(U + '#/proje/pq'); await w(1000);
  const ps1 = await p.evaluate(() => ({ sayfa: !!document.querySelector('.ps-sayfa'), pay: [...document.querySelectorAll('.ps-pay a')].map(a => a.getAttribute('href')).join(','), on: document.querySelector('.ps-serit .on')?.dataset.asama, geri: document.querySelector('[data-geri]')?.textContent }));
  await p.screenshot({ path: 'tests/cikti/proje-sayfa.png', fullPage: true });
  await p.click('[data-asama="Sıcak"]'); await w(800);
  const ps2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { durum: S.projeler.find(x => x.id === 'pq').durum, gec: S.proje_gecmis.some(g => g.proje_id === 'pq' && g.yeni_durum === 'Sıcak'), on: document.querySelector('.ps-serit .on')?.dataset.asama, gecti: [...document.querySelectorAll('.ps-serit .gec')].length }; });
  await p.click('[data-asama="Kayıp"]'); await w(700);
  const ps3 = await p.evaluate(() => ({ drawer: !!document.querySelector('.drawer.open'), durum: document.querySelector('.drawer.open [name=durum]')?.value, kayip: !document.querySelector('.drawer.open [data-show="kayip"]')?.hidden }));
  await p.click('.drawer.open .x[data-close]'); await w(500);
  await p.click('[data-fsk="harita"]'); await w(400);
  const ps4 = await p.evaluate(() => ({ h: location.hash, kisi: !!document.querySelector('[data-fs="harita"] a[href="#/kisi/k2"]'), bos: /Satış haritası boş/.test(document.querySelector('[data-harita]')?.textContent || '') }));
  // Satış haritası: kişi ekle (karar verici → Onaylayan), uyarı, tutum değiştir
  await p.click('[data-shekle1="k2"]'); await w(300);
  const shSecili = await p.evaluate(() => !!document.querySelector('dialog.sh-dlg input[value="k2"]:checked'));
  await p.click('dialog.sh-dlg [type=submit]'); await w(900);
  const sh1 = await p.evaluate(async () => ({ g: (await import('./js/db.js')).S.projeler.find(x => x.id === 'pq').karar_grubu, uyari: document.querySelector('.sh-uyarilar')?.textContent || '', bil: document.querySelector('[data-sht="Bilinmiyor"] [data-shk="k2"]') ? 1 : 0 }));
  await p.screenshot({ path: 'tests/cikti/satis-haritasi.png', fullPage: true });
  await p.click('[data-shk="k2"]'); await w(300); await p.click('dialog.sh-dlg [data-tt="Destekliyor"]'); await p.fill('dialog.sh-dlg #sh-n', 'EAE istiyor'); await p.click('dialog.sh-dlg [data-kay]'); await w(900);
  const sh2 = await p.evaluate(async () => ({ g: (await import('./js/db.js')).S.projeler.find(x => x.id === 'pq').karar_grubu?.[0], des: !!document.querySelector('[data-sht="Destekliyor"] [data-shk="k2"]') }));
  await p.click('[data-fsk="ozet"]'); await w(200); const shOzet = await p.textContent('.sh-ozet');
  kontrol('Satış haritası: kişi ekleniyor (karar verici Onaylayan olur), "karar vericiye ulaşılmadı" uyarısı, tutum değişiyor, özette sayaç', ps4.bos && shSecili && sh1.g?.[0]?.kisi_id === 'k2' && sh1.g[0].rol === 'Onaylayan' && sh1.g[0].etki === 'Yüksek' && /Karar vericiye ulaşılmadı/.test(sh1.uyari) && sh1.bil && sh2.g?.tutum === 'Destekliyor' && sh2.g?.not === 'EAE istiyor' && sh2.des && /1\s*Destekliyor/.test(shOzet), JSON.stringify({ ps4, shSecili, sh1, sh2, shOzet }));
  await p.click('[data-fsk="harita"]'); await w(200);
  await p.setViewportSize({ width: 390, height: 844 }); await w(300);
  const ptasma = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await p.screenshot({ path: 'tests/cikti/proje-sayfa-tel.png' });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.click('[data-geri]'); await w(700); const ph = await p.evaluate(() => location.hash);
  kontrol('Proje kendi sayfasında: projedeki firmalar, aşama şeridiyle durum değişiyor (kayıpta form açılıyor), sekme adreste, geri listeye', ps1.sayfa && /#\/firma\/f2/.test(ps1.pay) && /#\/kisi\/k2/.test(ps1.pay) && ps1.on === 'İhale' && /Projeler/.test(ps1.geri) && ps2.durum === 'Sıcak' && ps2.gec && ps2.on === 'Sıcak' && ps2.gecti === 3 && ps3.drawer && ps3.durum === 'Kayıp' && ps3.kayip && ps4.h === '#/proje/pq/harita' && ps4.kisi && ptasma <= 1 && ph === '#/projeler', JSON.stringify({ ps1, ps2, ps3, ps4, ptasma, ph }));
  const surum = await p.textContent('#nav .surum-rozet').catch(() => null);
  await p.screenshot({ path: 'tests/cikti/nav.png' });
  kontrol('Firmanın organizasyon şeması çiziliyor (genel müdür üstte, bağlı kişiler altında)', org && org.kutu === 5 && org.ust === 'Ahmet Yılmaz' && org.ic, JSON.stringify(org));
  kontrol('Menüde sürüm numarası görünüyor', /^v\d+/.test(surum || ''), surum);
  await p.goto(U + '#/bugun'); await w(400); await p.click('#nav [data-navfirma]'); await w(1500);
  const sk = await p.evaluate(() => ({ h: location.hash, baslik: document.querySelector('.sk-kimlik h1')?.textContent, sayi: document.querySelectorAll('.sk-sayi').length, ekip: !!document.querySelector('[data-ekip] .org'), tasma: document.documentElement.scrollWidth - innerWidth }));
  await p.screenshot({ path: 'tests/cikti/sirket.png', fullPage: true });
  kontrol('Şirket profili kendi geniş sayfasında açılıyor, ekip ağacı var, sayfa yana taşmıyor', sk.h === '#/sirket' && sk.sayi === 6 && sk.ekip && sk.tasma <= 1, JSON.stringify(sk));
  kontrol('Organizasyon şemasında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

await tarayici.close(); sunucu.close();
console.log(sonuc.join('\n'));
console.log(basarisiz ? `\n${basarisiz} test başarısız.` : `\nTüm testler geçti (${sonuc.length}).`);
process.exit(basarisiz ? 1 : 0);
