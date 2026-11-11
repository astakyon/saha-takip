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
  await p.goto(U + '#/proje/' + pid); await w(600); kontrol('Proje kartı açılıyor', await p.isVisible('.drawer.open'));
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
  const sekmeler = await p.evaluate(() => [...document.querySelectorAll('.drawer.open [role=tab]')].map(x => x.textContent));
  kontrol('Proje kartında kapalı sekme yok', !sekmeler.some(s => /Ziyaret/.test(s)), sekmeler.join(' | '));
  kontrol('Görür yetkisinde düzenleme düğmesi yok', !(await p.evaluate(() => [...document.querySelectorAll('.drawer.open .dh-actions button')].some(b => /Ziyaret ekle|Sil|Teklif/.test(b.textContent)))));
  kontrol('Tutarlar gizli', /•••/.test(await p.textContent('.drawer.open .dh-meta')));
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
  kontrol('Kırpmada hata yok', !hatalar.filter(h => !/Okuma motoru indirilemedi/.test(h)).length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

await tarayici.close(); sunucu.close();
console.log(sonuc.join('\n'));
console.log(basarisiz ? `\n${basarisiz} test başarısız.` : `\nTüm testler geçti (${sonuc.length}).`);
process.exit(basarisiz ? 1 : 0);
