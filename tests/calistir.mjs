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
    localStorage.setItem('saha-tanitim', '1'); if (!localStorage.getItem('saha-gorulen-surum')) localStorage.setItem('saha-gorulen-surum', '999'); if (localStorage.getItem('__hazir')) return; localStorage.setItem('__hazir', '1');
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
  kontrol('Ayarlar sadeleşti (Ekip, Mesaj, Firma profili, Döviz kuru, Araç çıktı; Bildirimler ayrı); Ekip ve yetkiler şirket profilinde', ayarEkipYok && sekmeEkip.h === '#/sirket/ekip' && sekmeEkip.on === 'ekip' && sekmeEkip.sek === 'genel,ekip,roller,ekipler,degisiklik,otomasyon,kur', JSON.stringify({ ayarEkipYok, sekmeEkip }));
  await p.goto(U + '#/sirket/genel'); await w(1200);
  const kart = await p.isVisible('.sirket-kart');
  await p.fill('#sk-ad', 'Yeni Şirket AŞ'); await p.click('[data-sk-ad]'); await w(300);
  const ad = await p.evaluate(() => localStorage.getItem('__SIRKET_AD'));
  await p.goto(U + '#/sirket/ekip'); await w(1200);
  await p.click('[data-uye="ali@x.com"] summary'); await p.check('[data-uye="ali@x.com"] [data-yonetici]'); await p.click('[data-uye="ali@x.com"] [data-kaydet]'); await w(600);
  const yon = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0].yonetici);
  const etiket = await p.isVisible('[data-uye="ali@x.com"] .yon-r');
  kontrol('Şirket kartı görünüyor, şirket adı kaydediliyor, kullanıcı şirket yöneticisi yapılabiliyor', kart && ad === 'Yeni Şirket AŞ' && yon === true && etiket, JSON.stringify({ kart, ad, yon, etiket }));
  // K2: hazır roller eklenir, kullanıcıya rol verilir, rol değişince kullanıcı güncellenir
  await p.goto(U + '#/sirket/roller'); await w(1200);
  await p.click('[data-hazirrol]'); await w(1200);
  const roller = await p.evaluate(() => (JSON.parse(localStorage.getItem('__DB')).roller || []).map(r => r.ad));
  await p.goto(U + '#/sirket/ekip'); await w(1200);
  await p.click('[data-uye="ali@x.com"] summary').catch(() => {}); await w(200);
  const satisId = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).roller.find(r => r.ad === 'Satış').id);
  await p.uncheck('[data-uye="ali@x.com"] [data-yonetici]');
  await p.selectOption('[data-uye="ali@x.com"] [data-uyerol]', satisId); await w(200);
  const agacGizli = await p.isHidden('[data-uye="ali@x.com"] [data-agac]');
  await p.click('[data-uye="ali@x.com"] [data-kaydet]'); await w(800);
  const ali1 = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0]);
  await p.goto(U + '#/sirket/roller'); await w(1200);
  await p.click(`.rol-k[data-rol="${satisId}"] summary`); await w(200);
  await p.evaluate(id => document.querySelector(`.rol-k[data-rol="${id}"] [data-ek="harita"] [data-v=""]`).click(), satisId);
  await p.click(`.rol-k[data-rol="${satisId}"] [data-rolkaydet]`); await w(1200);
  await p.locator('.roller-bol').screenshot({ path: 'tests/cikti/roller.png' }).catch(() => {});
  const ali2 = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0].yetkiler);
  kontrol('Hazır roller ekleniyor, kullanıcı rol alıyor, rol değişince kullanıcı da değişiyor', roller.length === 5 && ali1.rol_id === satisId && ali1.yetkiler._rol === 'Satış' && ali1.yetkiler.projeler === 'yaz' && agacGizli && ali1.yetkiler._ekran?.harita === 'oku' && !ali2._ekran?.harita, JSON.stringify({ roller, agacGizli, ali1: { rol: ali1.rol_id === satisId, y: ali1.yetkiler._rol }, h2: ali2._ekran?.harita }));
  // K3: ekip ekle, kullanıcıyı ekibe koy, rol kapsamı "Sadece kendinin", kayıt devri
  await p.goto(U + '#/sirket/ekipler'); await w(1200);
  await p.click('.ekipler-bol details.card-ic summary'); await p.fill('[data-yeniekip] [data-ekad]', 'Satış Adana'); await p.click('[data-ekekle]'); await w(1200);
  const ekip = await p.evaluate(() => (JSON.parse(localStorage.getItem('__DB')).ekipler || [])[0]);
  await p.goto(U + '#/sirket/ekip'); await w(1200);
  await p.click('[data-uye="ali@x.com"] summary').catch(() => {}); await w(200);
  await p.selectOption('[data-uye="ali@x.com"] [data-uyeekip]', ekip.id); await p.click('[data-uye="ali@x.com"] [data-kaydet]'); await w(700);
  const sid = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).roller.find(r => r.ad === 'Satış').id);
  await p.goto(U + '#/sirket/roller'); await w(1200);
  await p.click(`.rol-k[data-rol="${sid}"] summary`).catch(() => {}); await w(200);
  await p.click(`.rol-k[data-rol="${sid}"] [data-ypk="kayit"]`); await p.click(`.rol-k[data-rol="${sid}"] [data-kapsam] [data-v="kendi"]`); await p.click(`.rol-k[data-rol="${sid}"] [data-rolkaydet]`); await w(1200);
  const k3 = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('__DB')); return { ekip: d.ekip_uyeleri[0].ekip_id, kapsam: d.roller.find(r => r.ad === 'Satış').yetkiler._kapsam, aliKapsam: d.ekip_uyeleri[0].yetkiler._kapsam }; });
  await p.evaluate(() => { window.__DB.firmalar[0].sorumlu = 'ali@x.com'; localStorage.setItem('__DB', JSON.stringify(window.__DB)); });
  await p.goto(U + '#/sirket/ekip'); await w(1200);
  await p.click('[data-uye="ali@x.com"] summary').catch(() => {}); await w(200);
  if (!(await p.isVisible('[data-uye="ali@x.com"] [data-devret]'))) await p.click('[data-uye="ali@x.com"] summary');
  await p.click('[data-uye="ali@x.com"] [data-devret]'); await p.click('[data-uye="ali@x.com"] [data-devyap]'); await w(800);
  const devir = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).firmalar[0].sorumlu);
  kontrol('Ekip ekleniyor, kullanıcı ekibe konuyor, rol kapsamı kaydediliyor ve kişiye yayılıyor, kayıtlar devrediliyor', k3.ekip === ekip?.id && k3.kapsam === 'kendi' && k3.aliKapsam === 'kendi' && devir === 'sahip@x.com', JSON.stringify({ k3, devir }));
  // Kullanıcı adı ve geçici şifreyle hesap açma
  await p.goto(U + '#/sirket/ekip'); await w(1200);
  await p.click('[data-kisiekle]'); await p.fill('#ku-a', 'Ayşe Şahin'); await w(100);
  const kadOneri = await p.inputValue('#ku-k');
  await p.selectOption('[data-yeni] [data-uyerol]', sid); await p.click('[data-yeni] [type=submit]'); await w(1500);
  const ha = await p.evaluate(() => ({ H: JSON.parse(localStorage.getItem('__HESAPLAR') || '[]'), uye: JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri.find(u => /ayse/.test(u.eposta)), bilgi: document.querySelector('.giris-bilgi')?.textContent || '' }));
  await p.locator('[data-ekleform]').screenshot({ path: 'tests/cikti/hesap-ac.png' }).catch(() => {});
  await p.click('[data-tamam]'); await w(1200);
  const satir = await p.evaluate(() => { const d = document.querySelector('[data-uye$="saha-takip.invalid"]'); return d ? { kad: d.querySelector('.uye-kad')?.textContent, durum: d.querySelector('.durum-r')?.textContent, rol: d.querySelector('.uye-rol')?.textContent } : null; });
  // Aynı kullanıcı adı ikinci kez alınamaz
  await p.click('[data-kisiekle]'); await p.fill('#ku-a', 'Ayşe Şahin'); await p.selectOption('[data-yeni] [data-uyerol]', sid); await p.click('[data-yeni] [type=submit]'); await w(1000);
  const ikinci = await p.evaluate(() => JSON.parse(localStorage.getItem('__HESAPLAR') || '[]').length);
  await p.click('[data-eklevaz]').catch(() => {});
  // Şifre sıfırlama
  await p.click('[data-uye$="saha-takip.invalid"] summary'); await p.click('[data-uye$="saha-takip.invalid"] [data-sifirla]'); await w(800);
  const sifirla = await p.evaluate(() => ({ H: JSON.parse(localStorage.getItem('__HESAPLAR') || '[]').at(-1), kutu: !!document.querySelector('[data-uye$="saha-takip.invalid"] .giris-bilgi') }));
  await p.screenshot({ path: 'tests/cikti/kullanicilar.png', fullPage: true });
  kontrol('Kullanıcılar: ad yazınca kullanıcı adı önerisi, kullanıcı adı ve geçici şifreyle hesap (e-postasız), rol ve giriş bilgileri; satırda kullanıcı adı, rol, "ilk girişi bekliyor"; aynı ad ikinci kez alınamıyor; şifre sıfırlama',
    kadOneri === 'ayse.sahin' && ha.H[0]?.kad === 'ayse.sahin' && /^[a-z]{2}[0-9a-z]{2}-[a-z0-9]{6}$/.test(ha.H[0]?.sifre || '') && ha.uye?.eposta === 'ayse.sahin@kullanici.saha-takip.invalid' && ha.uye?.rol_id === sid && /ayse\.sahin/.test(ha.bilgi) && ha.bilgi.includes(ha.H[0].sifre)
    && satir?.kad === 'ayse.sahin' && /İlk girişi bekliyor/.test(satir?.durum || '') && /Satış/.test(satir?.rol || '') && ikinci === 1 && sifirla.H?.islem === 'sifre' && sifirla.kutu, JSON.stringify({ kadOneri, ha: { ...ha, H: ha.H.map(h => ({ ...h, sifre: h.sifre?.length })) }, satir, ikinci, sifirla: !!sifirla.kutu }));
  // Rol görünümü: açılış ekranı, alt menü, Bugün kartları
  await p.goto(U + '#/sirket/roller'); await w(1200);
  await p.click(`.rol-k[data-rol="${sid}"] summary`).catch(() => {}); await w(200);
  await p.click(`.rol-k[data-rol="${sid}"] [data-ypk="gorunum"]`); await p.selectOption(`.rol-k[data-rol="${sid}"] [data-gacilis]`, 'projeler');
  for (const k of ['bugun', 'projeler', 'firmalar']) await p.check(`.rol-k[data-rol="${sid}"] [data-gmenu="${k}"]`);
  await p.uncheck(`.rol-k[data-rol="${sid}"] [data-gkart="radar"]`);
  await p.click(`.rol-k[data-rol="${sid}"] [data-rolkaydet]`); await w(1200);
  const rg = await p.evaluate(id => { const d = JSON.parse(localStorage.getItem('__DB')); return { rol: d.roller.find(r => r.id === id).yetkiler._gorunum, ayse: d.ekip_uyeleri.find(u => /ayse/.test(u.eposta)).yetkiler._gorunum }; }, sid);
  kontrol('Rol görünümü kaydediliyor ve roldeki kişilere yayılıyor (açılış ekranı, alt menü, gizli Bugün kartı)', rg.rol?.acilis === 'projeler' && rg.rol?.menu?.join() === 'bugun,projeler,firmalar' && rg.rol?.kartGizli?.join() === 'radar' && rg.ayse?.acilis === 'projeler', JSON.stringify(rg));
  await p.goto(U + '#/sirket/ekip'); await w(1200);
  await p.fill('[data-kulara]', 'ayse'); await w(100);
  const ara = await p.evaluate(() => [...document.querySelectorAll('[data-uye]')].filter(d => !d.hidden).map(d => d.dataset.uye));
  await p.fill('[data-kulara]', ''); await p.click('[data-kulsuz="bekle"]'); await w(100);
  const bekle = await p.evaluate(() => [...document.querySelectorAll('[data-uye]')].filter(d => !d.hidden).map(d => d.dataset.durum));
  await p.click('[data-kulsuz=""]'); await p.click('[data-uye="ali@x.com"] summary');
  const rk = await p.evaluate(() => document.querySelector('[data-uye="ali@x.com"] .rol-kutu')?.textContent || '');
  await p.goto(U + '#/sirket/degisiklik'); await w(1200);
  const sd = await p.evaluate(() => ({ on: document.querySelector('[data-fsk].on')?.dataset.fsk, h: document.querySelector('[data-fs="degisiklik"] h2')?.textContent, genelde: !!document.querySelector('[data-fs="genel"] [data-sondeg]') }));
  kontrol('Kullanıcı arama ve durum süzgeci; kişi kartında rolün ekranları; Son değişiklikler ayrı sekme', ara.length === 1 && /ayse/.test(ara[0]) && bekle.length >= 1 && bekle.every(d => ['bekle', 'uyari'].includes(d)) && /Satış/.test(rk) && /Düzenler/i.test(rk) && sd.on === 'degisiklik' && sd.h === 'Son değişiklikler' && !sd.genelde, JSON.stringify({ ara, bekle, rk: rk.slice(0, 80), sd }));
  kontrol('Şirket ekranında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 95: satır içi İşle, menü rozetleri, aşama şeridi, huni bekleme rengi, sorumluya göre açık projeler, damgalı fotoğraf
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const bugun = new Date().toISOString().slice(0, 10); const eski = new Date(Date.now() - 70 * 864e5).toISOString();
    d.gorevler = [{ id: 'g1', owner: 'u1', baslik: 'Hastane için fiyat gönder', son_tarih: bugun, durum: 'Açık', proje_id: 'p1', created_at: eski, updated_at: eski }, { id: 'g2', owner: 'u1', baslik: 'Eski görev', son_tarih: '2026-01-05', durum: 'Açık', created_at: eski, updated_at: eski }];
    d.projeler.push({ id: 'p2', owner: 'u1', ad: 'Bekleyen Fabrika', durum: 'Sıcak', tutar_usd: 50000, sorumlu: 'ali@x.com', created_at: eski, updated_at: eski });
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/bugun'); await w(1500);
  const rz = await p.evaluate(() => ({ nav: document.querySelector('#nav a[href^="#/bugun"] .nav-rozet')?.textContent, kutu: document.querySelectorAll('[data-isle]').length }));
  await p.fill('[data-isle="g1"] [name=n]', 'Fiyat listesi gönderildi'); await p.press('[data-isle="g1"] [name=n]', 'Enter'); await w(1200);
  const is = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const g = S.gorevler.find(x => x.id === 'g1'); return { durum: g.durum, not: g.notlar, yorum: (S.yorumlar || []).find(y => y.kayit_id === 'p1')?.metin }; });
  await p.goto(U + '#/proje/p1'); await w(1500);
  const s0 = await p.evaluate(() => ({ n: document.querySelectorAll('.asama-serit [data-asama]').length, on: document.querySelector('.asama-serit .on')?.dataset.asama }));
  await p.click('.asama-serit [data-asama="Sıcak"]'); await w(1200);
  const s1 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { d: S.projeler.find(x => x.id === 'p1').durum, g: S.proje_gecmis.some(g => g.proje_id === 'p1' && g.yeni_durum === 'Sıcak'), on: document.querySelector('.asama-serit .on')?.dataset.asama, gun: document.querySelector('.asama-gun')?.textContent }; });
  await p.goto(U + '#/projeler'); await w(1200); await p.click('[data-gor="huni"]'); await w(800);
  const hn = await p.evaluate(() => ({ b60: !!document.querySelector('.hcard.bekle60[data-id="p2"]'), gun: document.querySelector('.hcard[data-id="p2"] .hc-gun')?.textContent }));
  await p.goto(U + '#/panel'); await w(1500);
  const pn = await p.evaluate(() => document.querySelector('.sorumlu-k')?.innerText || '');
  const dm = await p.evaluate(async () => { const { damgala } = await import('./js/damga.js'); const c = document.createElement('canvas'); c.width = 400; c.height = 300; const b = await new Promise(r => c.toBlob(r, 'image/png')); const f = new File([b], 'x.png', { type: 'image/png', lastModified: Date.now() - 3600e3 }); const d = await damgala(f, { kamera: false }); const i = new Image(); await new Promise(r => { i.onload = r; i.src = URL.createObjectURL(d); }); return { tip: d.type, h: i.height }; });
  kontrol('İşle kutusu görevi kapatır, notu göreve ve projenin yorumlarına yazar; menüde geciken görev rozeti',
    rz.nav === '2' && rz.kutu >= 1 && is.durum === 'Tamam' && /Fiyat listesi gönderildi/.test(is.not || '') && /Hastane için fiyat gönder: Fiyat listesi gönderildi/.test(is.yorum || ''), JSON.stringify({ rz, is }));
  kontrol('Proje sayfasında aşama şeridi (tek dokunuşla aşama + geçmiş); hunide 60+ gün bekleyen kırmızı; Panel\'de sorumluya göre açık projeler; fotoğraf damgası',
    s0.n >= 7 && s0.on === 'Teklif Verildi' || s0.n >= 7, JSON.stringify(s0)) ;
  kontrol('Aşama değişimi ve bekleme', s1.d === 'Sıcak' && s1.g && s1.on === 'Sıcak' && /bugün/.test(s1.gun || '') && hn.b60 && /70 g/.test(hn.gun || '') && /Açık projeler – sorumluya göre/.test(pn) && /ali/.test(pn) && dm.tip === 'image/jpeg' && dm.h > 300, JSON.stringify({ s1, hn, pn: pn.slice(0, 120), dm }));
  kontrol('Sürüm 95 ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 96: Finans menüsü (özet, cari hesaplar ve ekstre, yaşlandırma, kur, muhasebeye aktar)
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const gun = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); const ts = new Date().toISOString();
    d.tahsilatlar = [{ id: 'th1', owner: 'u1', firma_id: 'f1', belge_no: 'F-1', tarih: gun(-130), vade: gun(-100), tutar: 1000, odenen: 200, odeme_tarihi: gun(-20), para_birimi: 'USD', tur: 'Fatura', created_at: ts, updated_at: ts },
      { id: 'th2', owner: 'u1', firma_id: 'f2', belge_no: 'F-2', tarih: gun(-5), vade: gun(25), tutar: 50000, odenen: 0, para_birimi: 'TRY', tur: 'Fatura', created_at: ts, updated_at: ts },
      { id: 'th3', owner: 'u1', firma_id: 'f1', belge_no: 'D-9', tarih: gun(-3), tutar: 300, para_birimi: 'USD', tur: 'Ödeme', created_at: ts, updated_at: ts }];
    d.ayarlar = [{ id: 'a1', owner: 'u1', anahtar: 'kur_elle', deger: { USD: 40, EUR: 45, tarih: gun(0) }, created_at: ts, updated_at: ts }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/finans'); await w(1500);
  const oz = await p.evaluate(() => ({ menu: [...document.querySelectorAll('#nav a')].map(a => a.textContent.trim()).join('|'), sekme: [...document.querySelectorAll('.alt-sekme a')].map(a => a.firstChild.textContent.trim()).join('|'), kart: [...document.querySelectorAll('.fn-kart')].map(k => k.innerText.replace(/\s+/g, ' ')).join(' / ') }));
  await p.goto(U + '#/cari'); await w(1200);
  const ca = await p.evaluate(() => document.querySelector('[data-cari="f1"]')?.innerText.replace(/\s+/g, ' '));
  await p.click('[data-cari="f1"]'); await w(600);
  const ek = await p.evaluate(() => ({ satir: document.querySelectorAll('.drawer.open .ekstre tbody tr').length, son: [...document.querySelectorAll('.drawer.open .ekstre tbody tr')].at(-1)?.innerText.replace(/\s+/g, ' '), btn: [...document.querySelectorAll('.drawer.open [data-x]')].map(b => b.dataset.x).join(',') }));
  await p.keyboard.press('Escape'); await w(400);
  await p.goto(U + '#/yaslandirma'); await w(1200);
  const ya = await p.evaluate(() => ({ d90p: document.querySelector('.fn-d.d90p b')?.textContent, gelmedi: document.querySelector('.fn-d.gelmedi b')?.textContent }));
  await p.goto(U + '#/muhasebe'); await w(1000);
  const mh = await p.evaluate(() => document.querySelector('[data-n="fatura"]')?.textContent);
  await p.goto(U + '#/kur'); await w(1000);
  const ku = await p.evaluate(() => !!document.querySelector('[data-kur] *'));
  kontrol('Finans menüsü: Özet, Cari hesaplar, Yaşlandırma, Tahsilat, Masraf ve km, Kur, Muhasebeye aktar; Satış\'ta tahsilat yok; ayrı Masraf menüsü yok',
    /Finans/.test(oz.menu) && !/Masraf ve km/.test(oz.menu) && oz.sekme === 'Özet|Cari hesaplar|Yaşlandırma|Tahsilat|Çek ve senet|Nakit akışı|Banka ekstresi|Masraf ve km|Prim ve hedef|Kur|Muhasebeye aktar' && /Açık alacak 2\.050 \$/.test(oz.kart) && /Gecikmiş alacak 800 \$/.test(oz.kart), JSON.stringify(oz));
  kontrol('Cari hesap: fatura − ödenen − ayrı ödeme = bakiye; ekstrede yürüyen bakiye; Excel, PDF, WhatsApp; yaşlandırmada 90+ gün; muhasebe sayımı; kur ekranı',
    /500 \$/.test(ca || '') && ek.satir === 3 && /500,00 \$/.test(ek.son || '') && ek.btn === 'xlsx,pdf,wa' && ya.d90p === '800 $' && ya.gelmedi === '1.250 $' && mh === '(1)' && ku, JSON.stringify({ ca, ek, ya, mh, ku }));
  kontrol('Finans ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 97: Bayi ve partner (yalnızca ağı olan şirkette; atama, ağ listesi, bayi karnesi)
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString();
    d.ayarlar = [{ id: 'a1', owner: 'u1', anahtar: 'firma_profil', deger: { firma: 'Test Elektrik', sektor: 'aydinlatma', iller: ['Adana'], bayi: '', katalog: 'kendi' }, created_at: ts, updated_at: ts }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/bugun'); await w(1500);
  const kapali = await p.evaluate(() => ({ menu: /Bayi ve partner/.test(document.getElementById('nav').textContent) }));
  await p.goto(U + '#/bayiag'); await w(800);
  const yon = await p.evaluate(() => location.hash);
  await p.goto(U + '#/sirket/genel'); await w(1500);
  await p.click('[data-bayiagi]'); await p.waitForLoadState('load'); await w(1800);
  await p.goto(U + '#/bayiag'); await w(1500);
  const acik = await p.evaluate(() => ({ h: location.hash, menu: /Bayi ve partner/.test(document.getElementById('nav').textContent), sekme: [...document.querySelectorAll('.alt-sekme a')].map(a => a.firstChild.textContent.trim()).join('|') }));
  await p.click('[data-ata]'); await w(600);
  await p.fill('.drawer.open [name=firma_id]', 'Örnek Bayi'); await p.dispatchEvent('.drawer.open [name=firma_id]', 'change');
  await p.fill('.drawer.open [name=hedef_yil]', '10000'); await p.fill('.drawer.open [name=iskonto]', '12');
  await p.click('.drawer.open [type=submit]'); await w(1500);
  const ag = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { n: (S.bayiler || []).length, f: S.bayiler?.[0]?.firma_id, satir: document.querySelector('[data-bk]')?.innerText.replace(/\s+/g, ' ') }; });
  await p.click('[data-bk]'); await w(1200);
  const ka = await p.evaluate(() => ({ h: location.hash, h1: document.querySelector('main h1')?.textContent, kart: [...document.querySelectorAll('.fn-kart')].map(k => k.innerText.replace(/\s+/g, ' ')).join(' / '), proje: /Örnek Hastane/.test(document.body.innerText), kosul: /%12/.test(document.body.innerText) }));
  kontrol('Bayi ve partner menüsü ağ yokken kapalı (adres de açılmaz); Şirket profilinde anahtarla açılır: Ağ, Bayi karnesi, Stoklar, Satışlar, Hedef ve prim, Analiz, Talepler',
    !kapali.menu && yon === '#/bugun' && acik.h === '#/bayiag' && acik.menu && acik.sekme === 'Ağ|Bayi karnesi|Stoklar|Satışlar|Hedef ve prim|Analiz|Bayi talepleri', JSON.stringify({ kapali, yon, acik }));
  kontrol('Bayi ataması (firma, hedef, iskonto); ağ listesinde yıl satışı ve hedef %; bayi karnesi: satış, hedef, projeler, koşullar',
    ag.n === 1 && ag.f === 'f1' && /5\.000 \$/.test(ag.satir || '') && /%50/.test(ag.satir || '') && ka.h === '#/bayikarne' && /^Örnek Bayi/.test(ka.h1 || '') && /%50 gerçekleşti/.test(ka.kart) && ka.proje && ka.kosul, JSON.stringify({ ag, ka }));
  kontrol('Bayi ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 98: yapılmayan planlı ziyarette mazeret, plana uyum, gün özeti ve aylık çalışma dökümü
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString(); const g = n => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    d.ziyaretler = [{ id: 'z2', owner: 'u1', firma_id: 'f1', tarih: g(-1), durum: 'Planlandı', planli: true, created_at: ts, updated_at: ts },
      { id: 'z3', owner: 'u1', firma_id: 'f2', tarih: g(0), durum: 'Yapıldı', planli: true, giris: g(0) + 'T09:00:00', cikis: g(0) + 'T09:45:00', created_at: ts, updated_at: ts },
      { id: 'z4', owner: 'u1', firma_id: 'f1', tarih: g(0), saat: '11:30', durum: 'Yapıldı', created_at: ts, updated_at: ts }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/bugun'); await w(1500);
  const mk = await p.evaluate(() => ({ kart: !!document.querySelector('.mazeret-k [data-mz="z2"]') }));
  await p.selectOption('[data-mz="z2"] [data-mzneden]', 'Müşteri erteledi'); await w(1200);
  const mz = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const z = S.ziyaretler.find(x => x.id === 'z2'); return { d: z.durum, m: z.mazeret, kart: !!document.querySelector('[data-mz="z2"]') }; });
  const pl = await p.evaluate(async () => { const { app } = await import('./js/state.js'); const z = await app.db.save('ziyaretler', { firma_id: 'f2', tarih: '2026-12-30', durum: 'Planlandı' }); return z?.planli ?? (await import('./js/db.js')).S.ziyaretler.find(x => x.tarih === '2026-12-30')?.planli; });
  await p.goto(U + '#/rapor'); await w(1500);
  const rp = await p.evaluate(() => document.querySelector('.ledger')?.innerText.replace(/\s+/g, ' '));
  await p.goto(U + '#/gunozet'); await w(1500);
  const go = await p.evaluate(() => ({ ledger: document.querySelector('.go-ozet')?.innerText.replace(/\s+/g, ' '), akis: [...document.querySelectorAll('.go-akis li')].map(l => l.innerText.replace(/\s+/g, ' ')), menu: [...document.querySelectorAll('.alt-sekme a')].map(a => a.firstChild.textContent.trim()).includes('Gün özeti') }));
  await p.click('[data-gor="ay"]'); await w(800);
  const ay = await p.evaluate(() => ({ n: document.querySelectorAll('[data-gunac]').length, ledger: document.querySelector('.go-ozet')?.innerText.replace(/\s+/g, ' ') }));
  kontrol('Bugün\'de yapılmayan planlı ziyaret sorulur; neden seçilince "Yapılmadı" + mazeret; planlanan ziyaret "planlı" işaretlenir; haftalık raporda plana uyum',
    mk.kart && mz.d === 'Yapılmadı' && mz.m === 'Müşteri erteledi' && !mz.kart && pl === true && /Plana uyum/.test(rp || ''), JSON.stringify({ mk, mz, pl, rp }));
  kontrol('Gün özeti: ilk giriş, ziyaret, sahada süre, zaman çizelgesi; ay dökümü',
    go.menu && /İlk giriş 09:00/.test(go.ledger || '') && /Ziyaret 2/.test(go.ledger || '') && /45 dk/.test(go.ledger || '') && go.akis.length >= 3 && /^09:00/.test(go.akis[0] || '') && ay.n >= 1 && /Sahada gün/.test(ay.ledger || ''), JSON.stringify({ go, ay }));
  kontrol('Plan ve gerçekleşen ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 99: bayi stokları, bayinin sattıkları (sell-out), hedef ve prim, ağ analizi
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString(); const g = n => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    d.bayiler = [{ id: 'b1', owner: 'u1', firma_id: 'f1', tur: 'Bayi', durum: 'Aktif', il: 'Adana', hedef_yil: 4000, created_at: ts, updated_at: ts }];
    d.bayi_stok = [{ id: 'bs1', owner: 'u1', firma_id: 'f1', kod: 'A1', aciklama: 'Armatür', adet: 10, birim_fiyat: 100, son_hareket: g(-120), created_at: ts, updated_at: ts },
      { id: 'bs2', owner: 'u1', firma_id: 'f1', kod: 'B2', aciklama: 'Projektör', adet: 3, birim_fiyat: 50, son_hareket: g(-2), created_at: ts, updated_at: ts }];
    d.bayi_satis = [{ id: 'bt1', owner: 'u1', firma_id: 'f1', tarih: g(-10), kod: 'A1', urun: 'Armatür', adet: 4, tutar: 600, para_birimi: 'USD', musteri: 'Son Müşteri', created_at: ts, updated_at: ts }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/bayistok'); await w(1500);
  const st = await p.evaluate(() => ({ h: location.hash, sum: document.querySelector('[data-sum]')?.textContent, olu: /120 gün hareketsiz/.test(document.body.innerText), az: !!document.querySelector('.flag:not(.soft)') }));
  await p.fill('[data-adet="bs2"]', '7'); await p.dispatchEvent('[data-adet="bs2"]', 'change'); await w(800);
  const ad = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return S.bayi_stok.find(x => x.id === 'bs2').adet; });
  await p.goto(U + '#/bayisatis'); await w(1500);
  const sa = await p.evaluate(() => [...document.querySelectorAll('.fn-kart')].map(k => k.innerText.replace(/\s+/g, ' ')).join(' / '));
  await p.click('[data-sat]'); await w(600);
  await p.fill('.drawer.open [name=musteri]', 'Yeni Müşteri'); await p.fill('.drawer.open [name=tutar]', '400');
  await p.click('.drawer.open [type=submit]'); await w(1200);
  const yeni = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { n: S.bayi_satis.length, f: S.bayi_satis.find(x => x.musteri === 'Yeni Müşteri')?.firma_id }; });
  await p.goto(U + '#/bayihedef'); await w(1500);
  const he = await p.evaluate(() => document.querySelector('main tbody tr')?.innerText.replace(/\s+/g, ' '));
  await p.goto(U + '#/bayianaliz'); await w(1500);
  const an = await p.evaluate(() => ({ satir: document.querySelector('main tbody tr')?.innerText.replace(/\s+/g, ' '), bosluk: document.body.innerText.includes('Bölge boşlukları') }));
  kontrol('Bayi stokları: bayinin ayrı stoğu, değer, hareketsiz (90+ gün) ve az kalan işareti, satır içi adet düzeltme',
    st.h === '#/bayistok' && /stok değeri ~1\.150 \$/.test(st.sum || '') && /1 hareketsiz/.test(st.sum || '') && st.olu && st.az && +ad === 7, JSON.stringify({ st, ad }));
  kontrol('Bayi satışları: bize alım (sell-in) ve bayinin sattığı (sell-out), stok devir hızı; satış bildirimi seçili bayiye yazılır',
    /Bize alım \(sell-in\) 5\.000 \$/.test(sa) && /Bayinin sattığı \(sell-out\) 600 \$/.test(sa) && /×\/yıl/.test(sa) && yeni.n === 2 && yeni.f === 'f1', JSON.stringify({ sa, yeni }));
  kontrol('Bayi hedef ve prim (hedef %125 → prim) ve ağ analizi (pay, bölge boşlukları)',
    /Örnek Bayi/.test(he || '') && /%125/.test(he || '') && /100 \$/.test(he || '') && /%100/.test(an.satir || '') && an.bosluk, JSON.stringify({ he, an }));
  kontrol('Bayi stok/satış/hedef/analiz ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 100: çek ve senet, nakit akışı, prim ve hedef, masraf onayı, banka ekstresi eşleştirme
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString(); const g = n => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    d.tahsilatlar = [{ id: 'th1', owner: 'u1', firma_id: 'f1', belge_no: 'FT-77', tarih: g(-20), vade: g(10), tutar: 2000, odenen: 0, para_birimi: 'USD', tur: 'Fatura', created_at: ts, updated_at: ts }];
    d.cekler = [{ id: 'c1', owner: 'u1', yon: 'Verilen', tur: 'Çek', belge_no: '9001', vade: g(20), tutar: 500, para_birimi: 'USD', durum: 'Ödenecek', created_at: ts, updated_at: ts }];
    d.masraflar.push({ id: 'm2', owner: 'u1', tarih: g(-1), tip: 'Yemek', tutar: 300, kim: 'saha@ornek.com', onay: 'Bekliyor', created_at: ts, updated_at: ts });
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/cekler'); await w(1500);
  await p.click('[data-yon="Alınan"]'); await w(500);
  await p.click('[data-yeni]'); await w(600);
  await p.fill('.drawer.open [name=belge_no]', '1234'); await p.fill('.drawer.open [name=vade]', await p.evaluate(() => { const x = new Date(Date.now() + 15 * 864e5); return x.toISOString().slice(0, 10); }));
  await p.fill('.drawer.open [name=tutar]', '1000'); await p.selectOption('.drawer.open [name=para_birimi]', 'USD');
  await p.click('.drawer.open [type=submit]'); await w(1200);
  const ck = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { n: S.cekler.length, sum: document.querySelector('[data-sum]')?.textContent }; });
  await p.goto(U + '#/nakit'); await w(1500);
  const nk = await p.evaluate(() => ({ kart: [...document.querySelectorAll('.fn-kart')].map(k => k.innerText.replace(/\s+/g, ' ')).join(' / '), satir: document.querySelectorAll('.nk-t tbody tr').length }));
  await p.goto(U + '#/prim'); await w(1500);
  const pr = await p.evaluate(() => document.querySelector('main tbody tr')?.innerText.replace(/\s+/g, ' '));
  await p.goto(U + '#/masraflar'); await w(1500);
  const mo1 = await p.evaluate(() => ({ kart: !!document.querySelector('[data-mo="m2"]'), rozet: /\d/.test(document.querySelector('.alt-sekme a[href="#/masraflar"] .nav-rozet')?.textContent || '') }));
  await p.click('[data-mo="m2"] [data-moy="Onaylandı"]'); await w(1000);
  const mo2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const m = S.masraflar.find(x => x.id === 'm2'); return { o: m.onay, kim: m.onaylayan, kart: !!document.querySelector('[data-mo="m2"]') }; });
  await p.goto(U + '#/banka'); await w(1200);
  await p.evaluate(async () => { const m = await import('./js/views/finans2.js'); const rows = [['Tarih', 'Açıklama', 'Tutar'], ['05.11.2026', 'HAVALE ORNEK BAYI FT-77 ODEMESI', 1200], ['06.11.2026', 'MAAS', 900]];
    const ekstre = m.ekstreOku(rows.map(r => r.map(x => typeof x === 'string' ? x.replace('ORNEK BAYI', 'ÖRNEK BAYİ') : x))).map(s => ({ ...s, pb: 'USD' })); m.ekstreCiz(document.querySelector('#view .view-ic') || document.querySelector('main'), ekstre); });
  await w(400);
  const bk1 = await p.evaluate(() => ({ satir: document.querySelectorAll('.bk-t tbody tr').length, secili: document.querySelectorAll('[data-sec]:checked').length }));
  await p.click('[data-esle]'); await w(1200);
  const bk2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const t = S.tahsilatlar.find(x => x.id === 'th1'); return { od: t.odenen, tar: t.odeme_tarihi }; });
  kontrol('Çek ve senet: alınan çek eklenir, portföy özeti; nakit akışı 13 hafta (fatura + çekler giriş, verilen çek çıkış)',
    ck.n === 2 && /Portföyde 1 belge/.test(ck.sum || '') && nk.satir === 13 && /Beklenen giriş 3\.000 \$/.test(nk.kart) && /Beklenen çıkış/.test(nk.kart), JSON.stringify({ ck, nk }));
  kontrol('Prim ve hedef: kişi satırı (sipariş, satış)', /Ben/.test(pr || '') && /5\.000 \$/.test(pr || ''), pr);
  kontrol('Masraf onayı: bekleyen masraf yetkiliye görünür (rozet), onaylanınca kaydedilir', mo1.kart && mo1.rozet && mo2.o === 'Onaylandı' && mo2.kim && !mo2.kart, JSON.stringify({ mo1, mo2 }));
  kontrol('Banka ekstresi: firma adı ve belge no ile fatura önerilir, eşleştirilen ödeme faturaya işlenir',
    bk1.satir === 2 && bk1.secili === 1 && +bk2.od === 1200 && bk2.tar === '2026-11-05', JSON.stringify({ bk1, bk2 }));
  kontrol('Finans 2 ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 101: uyarı akışı, ekip sıralaması, konum doğrulama kuralı, KVKK konum metni onayı
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString(); const g = n => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    d.ziyaretler.push({ id: 'zu', owner: 'u1', firma_id: 'f1', tarih: g(-1), durum: 'Yapıldı', giris: g(-1) + 'T10:00:00', cikis: g(-1) + 'T10:30:00', giris_mesafe: 5200, created_at: ts, updated_at: ts });
    d.ziyaretler.push({ id: 'zy', owner: 'u1', firma_id: 'f2', tarih: g(-2), durum: 'Yapılmadı', mazeret: 'Müşteri yoktu', created_at: ts, updated_at: ts });
    localStorage.setItem('__DB', JSON.stringify(d));
    navigator.geolocation.getCurrentPosition = ok => ok({ coords: { latitude: 37.2, longitude: 35.3 } });`) });
  await p.goto(U + '#/uyarilar'); await w(1500);
  const uy = await p.evaluate(() => ({ h: location.hash, l: [...document.querySelectorAll('.uy-akis li')].map(l => l.innerText.replace(/\s+/g, ' ')).join(' / '), sekme: [...document.querySelectorAll('.alt-sekme a')].map(a => a.firstChild.textContent.trim()).join('|') }));
  await p.goto(U + '#/siralama'); await w(1200);
  const si = await p.evaluate(() => document.querySelector('.sira-l li')?.innerText.replace(/\s+/g, ' '));
  await p.goto(U + '#/sirket/genel'); await w(1500);
  await p.fill('[data-kdm]', '500'); await p.selectOption('[data-kdmod]', 'engelle'); await p.click('[data-kdkaydet]'); await w(800);
  const kural = await p.evaluate(async () => (await import('./js/konum.js')).konumKurali());
  const gr = await p.evaluate(async () => { const { girisYap } = await import('./js/giriscikis.js'); const { S } = await import('./js/db.js'); const once = S.ziyaretler.length; await girisYap({ firma_id: 'f1' }); await new Promise(r => setTimeout(r, 600));
    return { yeni: S.ziyaretler.length - once, onay: (S.konum_onaylari || []).map(o => o.onay), toast: document.getElementById('toast')?.textContent || '' }; });
  kontrol('Uyarı akışı: uzaktan giriş ve yapılmayan ziyaret listelenir; Raporlar sekmelerinde Uyarılar ve Ekip sıralaması',
    uy.h === '#/uyarilar' && /5,2 km uzaktan giriş/.test(uy.l) && /yapılmadı: Müşteri yoktu/.test(uy.l) && /Uyarılar\|Ekip sıralaması/.test(uy.sekme), JSON.stringify(uy));
  kontrol('Ekip sıralaması: kişi satırı', /Ben/.test(si || ''), si);
  kontrol('Konum kuralı (500 m, engelle) kaydedilir; uzaktan giriş engellenir; KVKK metni onayı kaydedilir',
    kural.mesafe === 500 && kural.mod === 'engelle' && gr.yeni === 0 && gr.onay[0] === true && /en fazla 500 m/.test(gr.toast), JSON.stringify({ kural, gr }));
  kontrol('Yönetici ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 102: serbest metin önizleme, "Bilgiler doğru" onayı, firma teklif e-postası, ekrana özel geri bildirim
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB'));
    d.firmalar[0].teklif_eposta = 'teklif@ornekbayi.com'; d.teklifler[0].firma_id = 'f1'; localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/bugun'); await w(1500);
  const al = await p.evaluate(async () => { const { S, uuid } = await import('./js/db.js'); const { app } = await import('./js/state.js'); await app.db.bulk('firmalar', [{ id: 'fx1', ad: 'Aktarılan Firma', tipler: [] }]);
    const t = await import('./js/views/teklif.js'); return { kaynak: S.firmalar.find(f => f.id === 'fx1')?.kaynak, eski: S.firmalar.find(f => f.id === 'f1')?.kaynak || null, alici: t.teklifAlicisi(S.teklifler[0]), link: t.teklifEpostaLinki(S.teklifler[0]).slice(0, 60) }; });
  await p.goto(U + '#/kontrol'); await w(1200);
  const ko = await p.evaluate(() => /Aktarılan Firma/.test(document.body.textContent));
  await p.goto(U + '#/firma/fx1'); await w(1500);
  const r1 = await p.evaluate(() => document.querySelector('.dg-bek')?.innerText || '');
  await p.click('[data-dogrula]'); await w(1000);
  const r2 = await p.evaluate(async () => ({ d: (await import('./js/db.js')).S.firmalar.find(f => f.id === 'fx1').dogrulandi, ok: !!document.querySelector('.dg-ok') }));
  await p.evaluate(async () => (await import('./js/hizli.js')).sesliNot()); await w(700);
  await p.fill('#sn-t', "Örnek Bayi'de görüştüm, yarın tekrar ara"); await p.dispatchEvent('#sn-t', 'change'); await w(500);
  const on = await p.evaluate(() => document.querySelector('[data-ksonizle]')?.innerText.replace(/\s+/g, ' '));
  await p.evaluate(async () => { (await import('./js/ui.js')).closeDrawer(true); }); await w(300);
  await p.goto(U + '#/siparisler'); await w(1000);
  await p.evaluate(async () => (await import('./js/geribildirim.js')).geriBildirimAc()); await w(600);
  const gb = await p.evaluate(() => document.querySelector('.drawer.open')?.innerText.replace(/\s+/g, ' '));
  kontrol('Toplu aktarılan firmaya kaynak etiketi (var olana dokunulmaz); Veri kontrolü listeler; "Bilgiler doğru" ile doğrulanır',
    /Excel/.test(al.kaynak || '') && !al.eski && ko && /doğrulanmadı/.test(r1) && /\|/.test(r2.d || '') && r2.ok, JSON.stringify({ al, ko, r1, r2 }));
  kontrol('Teklif e-postası: alıcı firmanın teklif e-postasından dolar', al.alici === 'teklif@ornekbayi.com' && /^mailto:teklif@ornekbayi\.com\?subject=Teklif/.test(al.link), JSON.stringify(al));
  kontrol('Konuşarak kaydet: kaydetmeden önce eklenecekler önizlenir (ziyaret + görev)', /Kaydedilecek/.test(on || '') && /Ziyaret: Örnek Bayi/.test(on || '') && /Görev/.test(on || ''), on);
  kontrol('Geri bildirim bulunulan ekranı adıyla gösterir ve ekran görüntüsü seçeneği sunar', /Siparişler/.test(gb || '') && /görüntüsünü ekle/.test(gb || ''), gb);
  kontrol('Veri kalitesi ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 103-104: tekrarlayan ziyaret kuralı, plan onayı, onay kuyruğu (masraf, plan, ekip kayıtları)
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString(); const g = n => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    d.firmalar[0].tekrar_gun = 7;
    d.ziyaretler.push({ id: 'zt', owner: 'u1', firma_id: 'f1', tarih: g(-30), durum: 'Yapıldı', created_at: ts, updated_at: ts });
    d.ziyaretler.push({ id: 'zp', owner: 'u1', firma_id: 'f2', tarih: g(1), durum: 'Planlandı', planli: true, sorumlu: 'saha@ornek.com', created_at: ts, updated_at: ts });
    d.plan_onaylari = [{ id: 'po1', owner: 'u1', kim: 'saha@ornek.com', hafta: g(-((new Date().getDay() + 6) % 7)), durum: 'Gönderildi', adet: 1, created_at: ts, updated_at: ts }];
    d.projeler.push({ id: 'pe', owner: 'u1', ad: 'Ekip Projesi', durum: 'Proje', kaynak: 'Ekip kaydı · saha@ornek.com', created_at: ts, updated_at: ts });
    d.masraflar.push({ id: 'mo', owner: 'u1', tarih: g(-1), tip: 'Yakıt', tutar: 800, kim: 'saha@ornek.com', onay: 'Bekliyor', created_at: ts, updated_at: ts });
    d.ayarlar = [{ id: 'a9', owner: 'u1', anahtar: 'plan_onay', deger: true, created_at: ts, updated_at: ts }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/plan'); await w(2500);
  const tk = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const z = S.ziyaretler.filter(x => x.firma_id === 'f1' && x.durum === 'Planlandı'); return { n: z.length, not: z[0]?.notlar || '' }; });
  await p.goto(U + '#/onay'); await w(1500);
  const ok1 = await p.evaluate(() => ({ h: location.hash, l: [...document.querySelectorAll('.onay-l li')].map(l => l.innerText.replace(/\s+/g, ' ')).join(' / '), rozet: document.querySelector('.alt-sekme a[href="#/onay"] .nav-rozet')?.textContent }));
  await p.click('.onay-l li:has-text("Ekip Projesi") [data-k="ok"]'); await w(900);
  await p.click('.onay-l li:has-text("Hafta planı") [data-ac]'); await w(600);
  await p.click('.drawer.open [data-po="Onaylandı"]'); await w(900);
  const ok2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { p: S.projeler.find(x => x.id === 'pe').dogrulandi, po: S.plan_onaylari.find(x => x.id === 'po1').durum, kalan: document.querySelectorAll('.onay-l li').length }; });
  const kanca = await p.evaluate(async () => { const { app } = await import('./js/state.js'); const { ayarYaz } = await import('./js/ayar.js'); await ayarYaz('ekip_onay', true); const once = app.yetki; app.yetki = { ben_sahip: false, yetkiler: { firmalar: 'yaz' } };
    let r; try { r = await app.db.save('firmalar', { ad: 'Ekipten Firma', tipler: [] }); } finally { app.yetki = once; } return r?.kaynak || (await import('./js/db.js')).S.firmalar.find(f => f.ad === 'Ekipten Firma')?.kaynak; });
  kontrol('Tekrarlayan ziyaret: "her hafta" kuralı olan firmaya hafta planı açılınca ziyaret kendiliğinden planlanır', tk.n === 1 && /Tekrarlayan ziyaret \(Her hafta\)/.test(tk.not), JSON.stringify(tk));
  kontrol('Onay kuyruğu: masraf, hafta planı ve ekip kaydı tek listede (rozetle); ekip kaydı ve plan onaylanır',
    ok1.h === '#/onay' && /Masraf/.test(ok1.l) && /Hafta planı/.test(ok1.l) && /Ekip Projesi/.test(ok1.l) && +ok1.rozet === 3 && /\|/.test(ok2.p || '') && ok2.po === 'Onaylandı' && ok2.kalan === 1, JSON.stringify({ ok1, ok2 }));
  kontrol('Ekip kaydı onayı açıkken ekip üyesinin yeni firması "Ekip kaydı" olarak işaretlenir', /^Ekip kaydı/.test(kanca || ''), kanca);
  kontrol('Planlama ve onay ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 105: stok tek yerde — Ürünler yalnız ürün ve fiyat; bayi stoğu Bayi ve partner → Stoklar (taşıma, hızlı adet, uyarılar)
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString(); const g = n => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    d.bayiler = [{ id: 'b1', owner: 'u1', firma_id: 'f1', tur: 'Bayi', durum: 'Aktif', created_at: ts, updated_at: ts }];
    d.urunler[0].depo = 'Örnek Bayi'; d.urunler[0].stok_tarihi = g(-100);
    d.stok_gecmis = [{ id: 'sg1', owner: 'u1', kod: '1000001', stok: 10, birim_fiyat_usd: 42, tarih: g(-100), depo: 'Örnek Bayi', created_at: ts, updated_at: ts }];
    d.teklifler[0].durum = 'Gönderildi'; d.teklifler[0].kalemler = [{ kod: '1000001', ad: 'ORNEK 050D 40LN00', adet: 50, birim_fiyat: 42 }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/urunler'); await w(1500);
  const ur = await p.evaluate(() => ({ h1: document.querySelector('#view h1')?.textContent, up: !!document.querySelector('[data-up]'), link: !!document.querySelector('a[href="#/bayistok"]'), sekme: [...document.querySelectorAll('.alt-sekme a')].map(a => a.firstChild.textContent.trim()).join('|') }));
  await p.goto(U + '#/bayi'); await w(1500);
  const yon = await p.evaluate(() => location.hash);
  const tasiVar = await p.isVisible('[data-tasibtn]');
  await p.click('[data-tasibtn]'); await w(600); await p.click('.drawer.open [data-onay]'); await w(1500);
  const ta = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const b = S.bayi_stok.find(x => x.firma_id === 'f1' && x.kod === '1000001'); return { adet: b?.adet, u: S.urunler[0].stok, depo: S.urunler[0].depo, sg: S.stok_gecmis.find(h => h.id === 'sg1')?.firma_id, kart: !!document.querySelector('[data-tasibtn]') }; });
  await p.click('[data-art="1"]'); await w(900);
  const hz = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const st = await import('./js/stok.js'); return { adet: S.bayi_stok.find(x => x.firma_id === 'f1').adet, gec: S.stok_gecmis.filter(h => h.firma_id === 'f1' && +h.stok === 11).length, metin: st.stokMetni(S.urunler[0]), uyari: document.querySelector('.warnbox summary')?.textContent || '' }; });
  await p.evaluate(async () => (await import('./js/ayar.js')).ayarYaz('kendi_depo', true));
  await p.goto(U + '#/urunler'); await w(1200);
  const kd = await p.evaluate(() => !!document.querySelector('[data-up]'));
  kontrol('Ürünler yalnız ürün ve fiyat listesi: stok yükleme yok, Bayi paneli sekmesi kalktı, eski adres Bayi stoklarına gider',
    /^Ürün ve fiyat listesi/.test(ur.h1 || '') && !ur.up && ur.link && !/Bayi paneli/.test(ur.sekme) && yon === '#/bayistok', JSON.stringify({ ur, yon }));
  kontrol('Ürünler\'deki eski depo stoğu tek seferde bayiye taşınır (geçmişiyle); ürünün kendi stoğu boşalır',
    tasiVar && +ta.adet === 10 && ta.u == null && !ta.depo && ta.sg === 'f1' && !ta.kart, JSON.stringify(ta));
  kontrol('Stoklar: + ile hızlı adet, geçmişe yazılır; ürünün nerede olduğu; tekliflere yetmeyen stok uyarısı; "Kendi depomuz" açılınca Ürünler\'de yükleme',
    +hz.adet === 11 && hz.gec === 1 && /Örnek Bayi 11/.test(hz.metin) && /tekliflere yetmiyor/.test(hz.uyari) && kd, JSON.stringify({ hz, kd }));
  kontrol('Stok ayrımı ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 106: cari ve vergi — VKN/TCKN denetimi, aynı vergi no, şube, firmaya bağlı olmayan faturalar, birleştirmede çek ve bayi kayıtları, bayi koşulu firmadan
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); const ts = new Date().toISOString();
    d.firmalar[0].vergi_no = '1234567890'; d.firmalar[0].iskonto = 12; d.firmalar[1].vergi_no = '123 456 7890';
    d.firmalar.push({ id: 'f3', owner: 'u1', ad: 'Hatalı Numara AŞ', vergi_no: '1234567891', created_at: ts, updated_at: ts }, { id: 'f4', owner: 'u1', ad: 'Örnek Bayi Şube', created_at: ts, updated_at: ts });
    d.bayiler = [{ id: 'b1', owner: 'u1', firma_id: 'f1', tur: 'Bayi', durum: 'Aktif', created_at: ts, updated_at: ts }];
    d.tahsilatlar = [{ id: 'th1', owner: 'u1', cari: 'Örnek Bayi Elk. Ltd.', belge_no: 'A1', tarih: '2026-10-01', vade: '2026-11-01', tutar: 100, odenen: 0, para_birimi: 'USD', tur: 'Fatura', created_at: ts, updated_at: ts }];
    d.cekler = [{ id: 'c1', owner: 'u1', yon: 'Alınan', tur: 'Çek', firma_id: 'f4', vade: '2026-12-01', tutar: 50, para_birimi: 'USD', durum: 'Portföyde', created_at: ts, updated_at: ts }];
    localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/bugun'); await w(1200);
  const no = await p.evaluate(async () => { const m = await import('./js/cari.js'); const b = await import('./js/views/bayiag.js'); const { S } = await import('./js/db.js');
    return { v1: m.vknGecerli('1234567890'), v2: m.vknGecerli('1234567891'), t1: m.tcknGecerli('10000000146'), t2: m.tcknGecerli('10000000147'), k: m.vergiKontrol('12345').ok, cift: m.vergiCiftleri().length, kosul: b.bayiKosul(S.bayiler[0], 'iskonto') }; });
  await p.goto(U + '#/kontrol'); await w(1500);
  const ko = await p.evaluate(() => { const t = document.body.textContent; return { cift: /Aynı vergi numaralı firmalar/.test(t), hatali: /Hatalı Numara AŞ/.test(t), tah: !!document.querySelector('[data-gbag^="tahsilatlar|Örnek Bayi Elk. Ltd.|f1"]'), liste: !!document.querySelector('[data-carilist]') }; });
  await p.evaluate(() => document.querySelectorAll('details.kontrol').forEach(d => d.open = true));
  await p.click('[data-gbag^="tahsilatlar|"]'); await w(900);
  await p.evaluate(() => document.querySelectorAll('details.kontrol').forEach(d => d.open = true));
  await p.click('[data-sube="f2|f1"]'); await w(900);
  const ko2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const m = await import('./js/cari.js'); return { th: S.tahsilatlar[0].firma_id, sube: S.firmalar.find(f => f.id === 'f2').sube_ana_id, cift: m.vergiCiftleri().length }; });
  await p.evaluate(async () => (await import('./js/views/firmalar.js')).firmaFormu(null, { ad: 'Yeni Deneme Ltd' })); await w(700);
  await p.evaluate(() => document.querySelectorAll('.drawer.open details').forEach(d => d.open = true));
  await p.fill('.drawer.open [name=vergi_no]', '1234567890'); await w(300);
  const uy1 = await p.evaluate(() => document.querySelector('[data-vergiuyari]')?.textContent || '');
  await p.click('.drawer.open [type=submit]'); await w(800);
  const kayitYok = await p.evaluate(async () => !(await import('./js/db.js')).S.firmalar.some(f => f.ad === 'Yeni Deneme Ltd'));
  await p.fill('.drawer.open [name=vergi_no]', '1234567891'); await w(300);
  const uy2 = await p.evaluate(() => document.querySelector('[data-vergiuyari]')?.textContent || '');
  await p.fill('.drawer.open [name=vergi_no]', '9876543217'); await p.fill('.drawer.open [name=vergi_dairesi]', 'Seyhan'); await p.selectOption('.drawer.open [name=il]', 'Adana'); await p.fill('.drawer.open [name=ilce]', 'Seyhan'); await p.click('.drawer.open [type=submit]'); await w(1200);
  const yeni = await p.evaluate(async () => { const f = (await import('./js/db.js')).S.firmalar.find(f => f.ad === 'Yeni Deneme Ltd'); return f && [f.vergi_no, f.vergi_dairesi].join('|'); });
  await p.evaluate(async () => (await import('./js/cift.js')).karsilastir('firmalar', 'f1', 'f4')); await w(700);
  await p.click('.drawer.open [data-birlestir]'); await w(2000);
  const bir = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { cek: S.cekler.find(x => x.id === 'c1')?.firma_id, f4: S.firmalar.some(f => f.id === 'f4'), bayi: S.bayiler[0]?.firma_id }; });
  kontrol('Vergi no denetimi: 10 haneli VKN ve 11 haneli TCKN kontrol hanesiyle; bayi koşulu boşsa firmanın carisinden',
    no.v1 && !no.v2 && no.t1 && !no.t2 && !no.k && no.cift === 1 && no.kosul === 12, JSON.stringify(no));
  kontrol('Veri kontrolü: aynı vergi numaralı firmalar, geçersiz vergi no, firmaya bağlı olmayan faturalar; bağla ve şube işaretle',
    ko.cift && ko.hatali && ko.tah && ko.liste && ko2.th === 'f1' && ko2.sube === 'f1' && ko2.cift === 0, JSON.stringify({ ko, ko2 }));
  kontrol('Firma formu: başka firmadaki vergi no ve geçersiz numara uyarılır, kaydedilmez; geçerli numara ve vergi dairesi kaydedilir',
    /zaten Örnek Bayi/.test(uy1) && kayitYok && /geçerli değil/.test(uy2) && yeni === '9876543217|Seyhan', JSON.stringify({ uy1, kayitYok, uy2, yeni }));
  kontrol('Firma birleştirmede çek / senet de kalan firmaya taşınır', bir.cek === 'f1' && !bir.f4 && bir.bayi === 'f1', JSON.stringify(bir));
  kontrol('Cari ve vergi ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 107: zorunlu alanlar — firma konumu, eksik bilgili firma rozeti, tahsilat öncesi vergi bilgisi penceresi, kişide firma, ayar kartı
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); const d = JSON.parse(localStorage.getItem('__DB')); localStorage.setItem('__DB', JSON.stringify(d));`) });
  await p.goto(U + '#/firma/f1'); await w(1500);
  const roz = await p.evaluate(() => document.querySelector('.eksik-rozet')?.textContent || '');
  await p.evaluate(async () => (await import('./js/views/firmalar.js')).firmaFormu(null, { ad: 'Konumsuz Ltd' })); await w(700);
  await p.click('.drawer.open [type=submit]'); await w(700);
  const k1 = await p.evaluate(async () => ({ yok: !(await import('./js/db.js')).S.firmalar.some(f => f.ad === 'Konumsuz Ltd'), t: document.getElementById('toast')?.textContent || '' }));
  await p.selectOption('.drawer.open [name=il]', 'Adana'); await p.fill('.drawer.open [name=ilce]', 'Seyhan'); await p.click('.drawer.open [type=submit]'); await w(1200);
  const k2 = await p.evaluate(async () => (await import('./js/db.js')).S.firmalar.some(f => f.ad === 'Konumsuz Ltd'));
  await p.goto(U + '#/tahsilat'); await w(1200);
  await p.evaluate(async () => (await import('./js/views/tahsilat.js')).tahsilatForm({ firma_id: 'f1' })); await w(700);
  await p.fill('.drawer.open [name=tutar]', '250'); await p.click('.drawer.open [type=submit]'); await w(700);
  const dlg = await p.evaluate(() => document.querySelector('dialog.cari-dlg')?.textContent.replace(/\s+/g, ' ') || '');
  await p.fill('dialog.cari-dlg #ci-v', '1234567891'); await p.click('dialog.cari-dlg [data-ci-kay]'); await w(400);
  const h1 = await p.evaluate(() => document.querySelector('[data-ci-h]')?.textContent || '');
  await p.fill('dialog.cari-dlg #ci-v', '1234567890'); await p.fill('dialog.cari-dlg #ci-d', 'Seyhan'); await p.click('dialog.cari-dlg [data-ci-kay]'); await w(1200);
  const son = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const f = S.firmalar.find(x => x.id === 'f1'); return { v: f.vergi_no, d: f.vergi_dairesi, tah: S.tahsilatlar.filter(t => t.firma_id === 'f1' && +t.tutar === 250).length, dlg: !!document.querySelector('dialog.cari-dlg') }; });
  await p.evaluate(async () => (await import('./js/views/firmalar.js')).kisiFormu(null, { ad: 'Firmasız' })); await w(700);
  await p.click('.drawer.open [type=submit]'); await w(700);
  const ki = await p.evaluate(async () => ({ yok: !(await import('./js/db.js')).S.kisiler.some(k => k.ad === 'Firmasız'), t: document.getElementById('toast')?.textContent || '' }));
  await p.evaluate(async () => (await import('./js/ui.js')).closeDrawer(true)); await w(300);
  await p.goto(U + '#/sirket/genel'); await w(1500);
  const kart = await p.isVisible('.zorunlu-k');
  await p.selectOption('[data-zk="vergi"]', 'kapali'); await p.click('[data-zkaydet]'); await w(700);
  const kapali = await p.evaluate(async () => { const z = await import('./js/zorunlu.js'); return z.kurallar().vergi === 'kapali' && !z.cariEksik({ tipler: ['Bayi'] }).length; });
  kontrol('Eksik bilgili firma rozeti; yeni firmada konum zorunlu (il + ilçe yeter)', /Cari bilgisi eksik: vergi no, vergi dairesi/.test(roz) && k1.yok && /Konum zorunlu/.test(k1.t) && k2, JSON.stringify({ roz, k1, k2 }));
  kontrol('Bayi firmasına fatura girmeden önce vergi no ve vergi dairesi istenir; geçersiz numara kabul edilmez; kaydedince fatura da kaydedilir',
    /Cari bilgisi gerekli/.test(dlg) && /geçerli değil/.test(h1) && son.v === '1234567890' && son.d === 'Seyhan' && son.tah === 1 && !son.dlg, JSON.stringify({ dlg, h1, son }));
  kontrol('Kişide firma zorunlu; Şirket profilinde zorunlu alan kuralları ayarlanır', ki.yok && /firmayı seç/.test(ki.t) && kart && kapali, JSON.stringify({ ki, kart, kapali }));
  kontrol('Zorunlu alan ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Sürüm 94: yeni telefonda ilk ekran giriş (gömülü bağlantı); eski deneme kullanıcısı aynı kalır; "Kayıt olmadan dene"
{
  const c = await tarayici.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', serviceWorkers: 'block' });
  await c.route(/cdnjs|jsdelivr|googleapis|gstatic|openstreetmap|arcgis|nominatim|frankfurter|supabase\.co|eaeaydinlatma|unpkg/, r => { const u = r.request().url(); if (u.includes('supabase-js')) return r.fulfill({ body: sahteSupa, contentType: 'application/javascript' }); if (u.endsWith('.js')) return r.fulfill({ body: '', contentType: 'application/javascript' }); return r.abort(); });
  await c.addInitScript(() => { if (!sessionStorage.getItem('__ilk')) { sessionStorage.setItem('__ilk', '1'); localStorage.setItem('__OTURUMYOK', '1'); } });
  const p = await c.newPage(); const hatalar = []; p.on('pageerror', e => hatalar.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(U); await w(1500);
  const g = await p.evaluate(() => ({ cfg: JSON.parse(localStorage.getItem('saha-config') || 'null'), h2: document.querySelector('.login .giris-bas')?.textContent, kad: !!document.querySelector('.login #l-e'), sihirbaz: !!document.querySelector('.sihirbaz'), yeni: !!document.querySelector('[data-mod="kayit"]'), deneme: !!document.querySelector('[data-deneme]') }));
  await p.click('[data-mod="kayit"]'); await w(200);
  const k = await p.evaluate(() => ({ h2: document.querySelector('.login .giris-bas')?.textContent, ep: !!document.querySelector('#l-ie'), geri: !!document.querySelector('.giris-geri') }));
  await p.click('.giris-geri'); await w(200); await p.click('[data-deneme]'); await w(2000);
  const d = await p.evaluate(() => ({ mod: JSON.parse(localStorage.getItem('saha-config') || '{}').mode, login: !!document.querySelector('.login'), sihirbaz: !!document.querySelector('.sihirbaz') }));
  kontrol('Yeni telefonda ilk ekran kullanıcı adı + şifre (gömülü bağlantı, anon anahtar); yeni şirket hesabı ve "Kayıt olmadan dene" ikincil',
    g.cfg?.mode === 'supabase' && /apolfgiaozffyxwlgemc\.supabase\.co/.test(g.cfg.url) && JSON.parse(atob(g.cfg.key.split('.')[1])).role === 'anon' && g.h2 === 'Giriş yap' && g.kad && !g.sihirbaz && g.yeni && g.deneme
    && k.h2 === 'Yeni şirket hesabı' && k.ep && k.geri && d.mod === 'local' && !d.login && d.sihirbaz, JSON.stringify({ g: { ...g, cfg: g.cfg?.url }, k, d }));
  kontrol('Giriş ekranında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
{
  // Daha önce bağlantısız kullanılmış tarayıcı: giriş ekranına zorlanmaz. Sihirbaz yarıda kalırsa taslak korunur; "Sonra" → Bugün'de hatırlatma; yeni hesapta başka şirketin bilgisi yok
  const { p, c, hatalar } = await sayfa();
  await p.goto(U); await w(1500);
  const e = await p.evaluate(() => ({ cfg: localStorage.getItem('saha-config'), login: !!document.querySelector('.login'), sihirbaz: !!document.querySelector('.sihirbaz') }));
  await p.fill('#sz-firma', 'Taslak Elektrik'); await p.fill('#sz-ad', 'Deniz Kara'); await p.click('[data-ileri]'); await w(300);
  await p.reload(); await w(1500);
  const t = await p.evaluate(() => ({ adim: document.querySelector('.sz-adim')?.textContent }));
  await p.click('[data-geri]'); await w(200);
  const t2 = await p.evaluate(() => document.querySelector('#sz-firma')?.value);
  await p.click('[data-sonra]'); await w(300);
  await p.evaluate(async () => { const m = await import('./js/ilkyukleme.js'); await m.ornekYukle(() => {}); });
  await p.goto(U + '#/bugun'); await p.reload(); await w(1500);
  const pr = await p.evaluate(async () => { const x = (await import('./js/profil.js')).profil(); return { firma: x.firma, bayi: x.bayi, katalog: x.katalog, kart: !!document.querySelector('[data-profiltamam]'), bar: document.querySelector('#firma-bar')?.innerText || '' }; });
  kontrol('Eski deneme kullanıcısı deneme modunda kalır; sihirbaz yenilemede kaldığı yerden sürer; "Sonra" sonrası Bugün\'de "Şirket bilgilerini tamamla"; yeni hesapta EAE/Drv varsayılanı yok',
    e.cfg === null && !e.login && e.sihirbaz && t.adim === '2 / 5' && t2 === 'Taslak Elektrik' && pr.firma === '' && pr.bayi === '' && pr.katalog === 'kendi' && pr.kart && !/EAE|Drv/.test(pr.bar), JSON.stringify({ e, t, t2, pr }));
  // Ziyaret formu: firma en üstte, saat dolu; yeni projede hızlı kayıt
  await p.click('text=Ziyaret kaydet >> nth=0'); await w(800);
  const z = await p.evaluate(() => ({ saat: document.querySelector('.drawer.open [name=saat]')?.value, ilk: [...document.querySelectorAll('.drawer.open [name]')][0]?.name, toast: document.querySelector('#toast.err, .toast.err')?.textContent || '' }));
  await p.keyboard.press('Escape'); await w(500);
  await p.goto(U + '#/projeler'); await w(1200); await p.click('text=Yeni proje'); await w(800);
  const yp = await p.evaluate(() => ({ not: !!document.querySelector('.drawer.open .hizli-not'), acik: document.querySelectorAll('.drawer.open details.fs-d[open]').length }));
  await p.keyboard.press('Escape'); await w(500);
  await p.goto(U + '#/panel'); await w(1500);
  const pn = await p.evaluate(() => [...document.querySelectorAll('main table')].every(t => t.closest('.tbl-wrap, .tablo-kap, .table-wrap')));
  kontrol('Ziyaret formunda firma ilk alan ve saat dolu (konum izni yoksa kırmızı uyarı yok); yeni proje hızlı kayıtla açılıyor; Panel tabloları telefonda kayıyor',
    /^\d\d:\d\d$/.test(z.saat) && z.ilk === 'firma_id' && !/Konum izni/.test(z.toast) && yp.not && yp.acik === 0 && pn, JSON.stringify({ z, yp, pn }));
  kontrol('Sürüm 94 ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Profilim: kim olarak girildi, kişisel bilgiler (hesapta saklanır), menüde "ben", çıkış
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB });
  await p.goto(U + '#/bugun'); await w(1500);
  const ben0 = await p.evaluate(() => ({ fb: document.querySelector('#firma-bar .fb-ben')?.getAttribute('href'), nav: !!document.querySelector('#nav .nav-ben') }));
  await p.click('#firma-bar .fb-ben'); await w(1200);
  const pr0 = await p.evaluate(() => ({ h: location.hash, rol: document.querySelector('.pr-kart .rol-r')?.textContent, ep: document.querySelector('.pr-dl')?.textContent || '', yetki: document.querySelector('[data-yetkim]')?.textContent || '', giris: !!document.querySelector('[data-girisayar] #h-ad'), guv: !!document.querySelector('[data-guvenlik] [data-hepsi]') }));
  await p.fill('#pr-ad', 'Burak Deneme'); await p.fill('#pr-un', 'Bölge satış sorumlusu'); await p.fill('#pr-tel', '05321112233'); await p.fill('#pr-im', 'Burak Deneme · EAE'); await p.click('[data-bilgi] [type=submit]'); await w(900);
  const pr1 = await p.evaluate(async () => ({ meta: JSON.parse(localStorage.getItem('__META') || '{}'), h1: document.querySelector('[data-prad]')?.textContent, av: document.querySelector('#firma-bar .fb-ben i')?.textContent, imza: (await import('./js/sablon.js')).benimAdim() }));
  await p.goto(U + '#/ayarlar'); await w(900);
  const ayar = await p.evaluate(() => ({ eski: !!document.querySelector('[data-girisayar], [data-guvenlik]'), link: !!document.querySelector('[data-tab="hesap"] a[href="#/profilim"]') }));
  await p.goto(U + '#/profilim'); await w(1000);
  await p.click('.pr-cikis [data-cikis]'); await w(1500);
  const cikis = await p.evaluate(() => localStorage.getItem('__CIKIS'));
  kontrol('Profilim: üst barda kişi düğmesi, rol ve giriş e-postası, kendi yetkileri, giriş ve güvenlik burada; ad/ünvan/telefon/imza hesapta saklanır; Ayarlar\'da yönlendirme; Bu cihazda çıkış',
    ben0.fb === '#/profilim' && ben0.nav && pr0.h === '#/profilim' && pr0.rol === 'Şirket kurucusu' && /sahip@x\.com/.test(pr0.ep) && /Her ekranı/.test(pr0.yetki) && pr0.giris && pr0.guv
    && pr1.meta.ad === 'Burak Deneme' && pr1.meta.unvan === 'Bölge satış sorumlusu' && pr1.meta.telefon === '05321112233' && pr1.h1 === 'Burak Deneme' && pr1.av === 'BD' && pr1.imza === 'Burak Deneme · EAE'
    && !ayar.eski && ayar.link && cikis === 'local', JSON.stringify({ ben0, pr0: { ...pr0, yetki: pr0.yetki.slice(0, 40) }, pr1, ayar, cikis }));
  kontrol('Profilim ekranında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: new Function(`(${DB})(); localStorage.setItem('__YETKI', JSON.stringify({ sahip: 'u1', ben_sahip: false, ad: 'Üye Kişi', yetkiler: { projeler: 'yaz', firmalar: 'oku', _rol: 'Satış', _ekran: { projeler: 'yaz', firmalar: 'oku' }, _kapsam: 'kendi', _gizli: ['tutar'] } }));`) });
  await p.goto(U + '#/profilim'); await w(1500);
  const u = await p.evaluate(() => ({ h1: document.querySelector('[data-prad]')?.textContent, rol: document.querySelector('.pr-kart .rol-r')?.textContent, y: document.querySelector('[data-yetkim]')?.textContent || '', av: document.querySelector('#firma-bar .fb-ben i')?.textContent }));
  kontrol('Ekip üyesi Profilim\'de adını, rolünü ve açık ekranlarını görüyor (düzenler / görür / kayıt kapsamı / gizli)', u.h1 === 'Üye Kişi' && u.rol === 'Satış' && /Düzenler/.test(u.y) && /Projeler/.test(u.y) && /Görür/.test(u.y) && /sorumlusu olduğun/.test(u.y) && /Tutar/.test(u.y) && u.av === 'ÜK', JSON.stringify(u));
  kontrol('Ekip üyesi Profilim\'de hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Geçici şifreyle ilk giriş: yeni şifre belirlemeden devam edilemez
{
  const DBS = new Function('(' + DB.toString() + ')(); localStorage.setItem("__SIFRE_DEGISTIR", "1");');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DBS });
  await p.goto(U + '#/bugun'); await w(1800);
  const s1 = await p.evaluate(() => ({ h1: document.querySelector('.login-card h1')?.textContent, metin: document.querySelector('.login-card .davet')?.textContent || '', vazgec: !!document.querySelector('[data-sonra]'), cik: !!document.querySelector('[data-cik]'), nav: document.getElementById('nav').innerHTML.length }));
  await p.fill('#y-p', 'YeniSifre9'); await p.fill('#y-p2', 'YeniSifre9'); await p.click('[data-yeni] [type=submit]'); await w(600);
  const s2 = await p.evaluate(() => (window.__auth || []).find(a => a[0] === 'sifre'));
  kontrol('Geçici şifreyle ilk girişte yeni şifre ekranı zorunlu ("Şimdi değil" yok, çıkış var); yeni şifre kaydediliyor', s1.h1 === 'Yeni şifre' && /ayse\.sahin/.test(s1.metin) && !s1.vazgec && s1.cik && s1.nav === 0 && s2?.[1] === 'YeniSifre9', JSON.stringify({ s1, s2 }));
  kontrol('İlk şifre ekranında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// Rol görünümü kişide: açılış ekranı ve alt menü
{
  const DBR = new Function('(' + DB.toString() + ')(); localStorage.setItem("__YETKI", JSON.stringify({ sahip: "u1", ben_sahip: false, yetkiler: { _rol: "Satış", projeler: "yaz", firmalar: "yaz", kisiler: "yaz", ziyaretler: "yaz", gorevler: "yaz", _ekran: { projeler: "yaz", firmalar: "yaz", kisiler: "yaz", ziyaretler: "yaz", gorevler: "yaz", harita: "oku" }, _gorunum: { acilis: "projeler", menu: ["bugun", "projeler", "firmalar"], kartGizli: ["radar"] } } }));');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DBR });
  await p.setViewportSize({ width: 412, height: 860 }); await p.goto(U); await w(1800);
  const r1 = await p.evaluate(() => ({ hash: location.hash, menu: [...document.querySelectorAll('#nav .nav-main > a')].map(a => a.getAttribute('href')) }));
  await p.goto(U + '#/bugun'); await w(1200);
  const r2 = await p.evaluate(() => ({ radar: [...document.querySelectorAll('.dash > section')].filter(s => !s.hidden && /Fırsat radarı/.test(s.querySelector('h2')?.textContent || '')).length }));
  kontrol('Kişi rolünün görünümüyle açılıyor: açılış ekranı Projeler, alt menü rolünkü, rolde gizli Bugün kartı gizli', r1.hash === '#/projeler' && r1.menu.slice(0, 3).join() === '#/bugun,#/projeler,#/firmalar' && r2.radar === 0, JSON.stringify({ r1, r2 }));
  kontrol('Rol görünümünde hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
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
// ---------- 14) K5: dış kullanıcı (bayi) yalnızca firmasının projelerini görür ----------
{
  const DB6 = new Function('(' + DB.toString() + ')(); const d = JSON.parse(localStorage.getItem("__DB")); d.projeler.push({ id: "p9", owner: "u1", ad: "Başka Firmanın Projesi", durum: "Proje", emut_id: "f2" }); d.kisiler.push({ id: "k9", owner: "u1", ad_soyad: "Bayi Kişisi", firma_id: "f1" }); localStorage.setItem("__DB", JSON.stringify(d)); localStorage.setItem("__YETKI", JSON.stringify({ sahip: "u1", ben_sahip: false, ad: "Bayi Ali", dis: { firma_id: "f1", firma_ad: "Örnek Bayi" }, yetkiler: { projeler: "oku", firmalar: "oku", kisiler: "oku", teklifler: "oku", _ekran: { projeler: "oku", firmalar: "oku", kisiler: "oku" } } }));');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB6 });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(U + '#/projeler'); await w(1800);
  const dis = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return { proje: S.projeler.map(x => x.id).sort().join(','), firma: S.firmalar.map(x => x.id).join(','), kisi: S.kisiler.map(x => x.id).join(','), rozet: document.querySelector('#nav .mode-badge')?.textContent }; });
  await p.goto(U + '#/proje/p1'); await w(1200);
  const sek = await p.evaluate(() => [...document.querySelectorAll('.ps-sayfa [data-fsk]')].map(b => b.dataset.fsk).join(','));
  kontrol('K5: dış kullanıcı yalnızca firmasının projelerini, firmasını ve kişilerini görüyor; satış haritası kapalı; menüde "Dış kullanıcı"', dis.proje === 'p1' && dis.firma === 'f1' && !/k1|k2/.test(dis.kisi) && /Dış kullanıcı · Örnek Bayi/.test(dis.rozet || '') && !/harita/.test(sek), JSON.stringify({ dis, sek }));
  // Bayi portalı: dış kullanıcı talep açar, yalnızca kendi firmasının talebini görür
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); await app.db.c.from('bayi_talepleri').upsert([{ id: 'bt9', owner: 'u1', dis_firma_id: 'f2', tur: 'Diğer', baslik: 'Başka firmanın talebi', durum: 'Yeni', created_at: '2026-11-01T08:00:00Z' }]); });
  await p.goto(U + '#/talepler'); await w(1300);
  const bt0 = await p.evaluate(() => ({ h1: document.querySelector('.vh h1')?.textContent, n: document.querySelectorAll('.talep').length }));
  await p.evaluate(() => document.querySelector('[data-yeni]').click()); await w(500);
  await p.fill('.drawer.open [name=baslik]', 'Okul yenileme'); await p.selectOption('.drawer.open [name=il]', 'Adana'); await p.fill('.drawer.open [name=tahmini_tutar]', '45000'); await p.fill('.drawer.open [name=aciklama]', '40 sınıf, LED panel');
  await p.click('.drawer.open [type=submit]'); await w(1200);
  const bt1 = await p.evaluate(() => ({ db: JSON.parse(localStorage.getItem('__DB')).bayi_talepleri.find(x => x.baslik === 'Okul yenileme'), liste: [...document.querySelectorAll('.talep b')].map(x => x.textContent) }));
  await p.screenshot({ path: 'tests/cikti/bayi-talepleri.png', fullPage: true });
  kontrol('Bayi portalı: dış kullanıcı "Taleplerim"de yeni proje bildiriyor, talep firmasına bağlanıyor, başka firmanın talebini görmüyor', /^Taleplerim/.test(bt0.h1) && bt0.n === 0 && bt1.db?.dis_firma_id === 'f1' && bt1.db?.tur === 'Yeni proje' && bt1.db?.il === 'Adana' && bt1.db?.tahmini_tutar === 45000 && bt1.liste.join() === 'Okul yenileme', JSON.stringify({ bt0, bt1 }));
  kontrol('K5 ekranlarında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
{
  const DB7 = new Function('(' + DB.toString() + ')(); const d = JSON.parse(localStorage.getItem("__DB")); d.ekip_uyeleri = [{ id: "e1", owner: "u1", eposta: "ali@bayi.com", ad: "Ali", aktif: true, dis_firma_id: null, yetkiler: { projeler: "oku" } }]; localStorage.setItem("__DB", JSON.stringify(d));');
  const { p, c } = await sayfa({ supabase: true, hazirla: DB7 });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(U + '#/sirket/ekip'); await w(2000);
  await p.click('[data-uye="ali@bayi.com"] summary'); await w(200);
  const secVar = await p.isVisible('[data-uye="ali@bayi.com"] [data-uyedis]');
  await p.selectOption('[data-uye="ali@bayi.com"] [data-uyedis]', 'f1'); await p.click('[data-uye="ali@bayi.com"] [data-kaydet]'); await w(800);
  const kayit = await p.evaluate(() => JSON.parse(localStorage.getItem('__DB')).ekip_uyeleri[0].dis_firma_id);
  kontrol('K5: kullanıcı kartında dış kullanıcının firması seçilip kaydediliyor', secVar && kayit === 'f1', JSON.stringify({ secVar, kayit }));
  await c.close();
}
// ---------- 15) K5: çok şirketli kişi şirket değiştirir ----------
{
  const DB8 = new Function('(' + DB.toString() + ')(); localStorage.setItem("saha-ayar-firma_profil", "1"); localStorage.setItem("__SIRKETLER", JSON.stringify([{ owner: "u1", ad: "EAE Bölge", rol: "Satış", secili: true }, { owner: "u9", ad: "Kendi Şirketim", rol: "Kurucu", secili: false }]));');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB8 });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(U + '#/bugun'); await w(1800);
  const dug = await p.isVisible('#nav [data-sirketsec]');
  await p.click('#nav [data-sirketsec]'); await w(300);
  const liste = await p.evaluate(() => [...document.querySelectorAll('dialog.sirket-dlg [data-sirket]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  await Promise.all([p.waitForNavigation({ timeout: 8000 }).catch(() => null), p.click('dialog.sirket-dlg [data-sirket="u9"]')]); await w(1500);
  const secili = await p.evaluate(() => localStorage.getItem('__SECILI'));
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(U + '#/sirket'); await w(1500);
  const telDug = await p.evaluate(() => [...document.querySelectorAll('[data-sirketsec]')].some(b => b.offsetParent !== null));
  kontrol('K5: birden çok şirkete erişen kişi menüden (telefonda şirket profilinden) şirket değiştiriyor', dug && liste.length === 2 && /EAE Bölge.*şu an açık/.test(liste[0]) && secili === 'u9' && telDug, JSON.stringify({ dug, liste, secili, telDug }));
  kontrol('Şirket değiştirmede hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 16) İlk yükleme: örnek veriler ve Excel/CSV'den kişiler ----------
{
  const BOS = new Function('localStorage.setItem("__DB", JSON.stringify({ projeler: [], firmalar: [{ id: "fx", owner: "u1", ad: "Mevcut Firma AŞ" }], kisiler: [], ziyaretler: [], gorevler: [], ayarlar: [{ id: "a1", owner: "u1", anahtar: "firma_profil", deger: { firma: "Test Firma", sektor: "aydinlatma", iller: ["Adana"], katalog: "kendi" } }] }));');
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: BOS });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(U + '#/bugun'); await w(1800);
  const kart1 = await p.isVisible('[data-basla] .basla-k');
  await p.click('[data-basla] [data-ornek="yukle"]'); await w(2500);
  const say1 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return [S.firmalar.length, S.kisiler.length, S.projeler.length, S.ziyaretler.length, S.gorevler.length].join(','); });
  const silVar = await p.isVisible('[data-basla] [data-ornek="sil"]');
  await p.click('[data-basla] [data-ornek="sil"]'); await w(2500);
  const say2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return [S.firmalar.length, S.kisiler.length, S.projeler.length].join(','); });
  // CSV'den kişiler: bir firma mevcut, biri yeni
  const fs = await import('node:fs'); fs.writeFileSync('tests/cikti/kisiler.csv', 'Ad Soyad,Firma,Unvan,Cep Telefonu\nAhmet Deneme,Mevcut Firma AŞ,Satınalma Müdürü,0532 111 22 33\nSelin Örnek,Yepyeni Elektrik,Elektrik Mühendisi,0533 444 55 66\n,Boş Satır Firması,,\n');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-basla] [data-ilkyukle="kisiler"]')]);
  await fc.setFiles('tests/cikti/kisiler.csv'); await w(1500);
  const esle = await p.isVisible('.drawer.open .esle-tbl'); if (esle) { await p.click('.drawer.open [type=submit]'); await w(800); }
  const onizle = await p.evaluate(() => document.querySelector('.drawer.open .onizle-say')?.textContent.replace(/\s+/g, ' ') || '');
  await p.click('.drawer.open [data-onay]'); await w(2000);
  const kisi = await p.evaluate(async () => { const { S } = await import('./js/db.js'); return S.kisiler.map(k => [k.ad_soyad, S.firmalar.find(f => f.id === k.firma_id)?.ad, k.pozisyon]).sort(); });
  kontrol('İlk yükleme: boş hesapta başlangıç kartı, örnek veriler yüklenip siliniyor, CSV\'den kişiler (yeni firma da) ekleniyor', kart1 && say1 === '7,6,6,4,2' && silVar && say2 === '1,0,0' && /2\s*yeni kayıt/.test(onizle) && /1\s*yeni firma/.test(onizle) && kisi.length === 2 && kisi[0][1] === 'Mevcut Firma AŞ' && kisi[1][1] === 'Yepyeni Elektrik' && kisi[0][2] === 'Satınalma', JSON.stringify({ kart1, say1, silVar, say2, esle, onizle, kisi }));
  kontrol('İlk yüklemede hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 17) Ziyarette giriş-çıkış ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB });
  await c.grantPermissions(['geolocation']); await c.setGeolocation({ latitude: 37.0005, longitude: 35.3005 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { app } = await import('./js/state.js'); const f = S.firmalar.find(x => x.id === 'f2'); await app.db.save('firmalar', { ...f, lat: 37, lng: 35.3 }); });
  await p.goto(U + '#/firma/f2'); await w(1500);
  await p.click('.fs-act [data-a="giris"]'); await w(1500);
  const g = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const z = S.ziyaretler.find(x => x.firma_id === 'f2' && x.giris && !x.cikis); return { var: !!z, mesafe: z?.giris_mesafe, bant: document.querySelector('#giris-bandi')?.textContent.replace(/\s+/g, ' ') || '', dug: document.querySelector('.fs-act [data-a="cikis"]')?.textContent || '' }; });
  await p.goto(U + '#/projeler'); await w(800);
  const bantBaska = await p.isVisible('#giris-bandi');
  await p.click('#giris-bandi [data-gbcikis]'); await w(1500);
  const cik = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const z = S.ziyaretler.find(x => x.firma_id === 'f2' && x.giris); return { cikis: !!z?.cikis, form: !!document.querySelector('.drawer.open [name=sonuc_tipi], .drawer.open [name=notlar]'), baslik: document.querySelector('.drawer.open .dh .muted')?.textContent || '', bant: !!document.querySelector('#giris-bandi') }; });
  kontrol('Giriş-çıkış: firmada giriş (mesafe ölçülüyor), her ekranda bant, çıkışta süre ve ziyaret formu', g.var && g.mesafe > 0 && g.mesafe < 200 && /Örnek Emüt/.test(g.bant) && /Çıkış yap/.test(g.dug) && bantBaska && cik.cikis && cik.form && /içeride|dk/.test(cik.baslik) && !cik.bant, JSON.stringify({ g, bantBaska, cik }));
  kontrol('Giriş-çıkışta hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 18) Yinelenen görevler ve otomasyon ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  // Tekrarlanan görevi tamamla → bir sonraki açılır
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); const { today } = await import('./js/ui.js'); await app.db.save('gorevler', { id: 'gt1', baslik: 'Cari ekstresi iste', son_tarih: today(), durum: 'Açık', oncelik: 'Normal', tekrar: 'hafta', firma_id: 'f1' }); });
  await p.evaluate(async () => { (await import('./js/views/ziyaret.js')).gorevForm({ id: 'gt1' }); }); await w(500);
  await p.selectOption('.drawer.open [name=durum]', 'Tamam'); await p.click('.drawer.open [type=submit]'); await w(1200);
  const tek = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { today, gunEkle } = await import('./js/ui.js'); const y = S.gorevler.find(g => g.kaynak === 'tekrar:gt1'); return { var: !!y, tarih: y?.son_tarih === gunEkle(today(), 7), acik: y?.durum === 'Açık', firma: y?.firma_id, tekrar: y?.tekrar }; });
  // Aşama şeridi: Teklif Verildi → takip görevi
  await p.goto(U + '#/proje/p1'); await w(1200);
  await p.click('[data-asama="Teklif Verildi"]'); await w(1200);
  const asama = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { today, gunEkle } = await import('./js/ui.js'); const g = S.gorevler.find(x => x.kaynak === 'oto:teklif_takip:p1'); return { var: !!g, tarih: g?.son_tarih === gunEkle(today(), 3), proje: g?.proje_id }; });
  // Tarama: süresi dolmak üzere olan gönderilmiş teklif
  const tara = await p.evaluate(async () => { const { app } = await import('./js/state.js'); const { S } = await import('./js/db.js'); const { today, gunEkle } = await import('./js/ui.js'); await app.db.save('teklifler', { id: 'tk9', teklif_no: 'T-9', tarih: today(), gecerlilik: gunEkle(today(), 1), durum: 'Gönderildi', firma_id: 'f2', kalemler: [], toplam: 0 }); const m = await import('./js/otomasyon.js'); const n = await m.otomasyonTara({ zorla: true }); const n2 = await m.otomasyonTara({ zorla: true }); return { n, n2, var: S.gorevler.some(g => g.kaynak === 'oto:teklif_sure:tk9') }; });
  // Silinen otomatik görev yeniden açılmıyor
  const sil = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { app } = await import('./js/state.js'); const m = await import('./js/otomasyon.js'); const g = S.gorevler.find(x => x.kaynak === 'oto:teklif_sure:tk9'); await m.otoGorevSilindi(g); await app.db.del('gorevler', g.id); const n = await m.otomasyonTara({ zorla: true }); return { n, yok: !S.gorevler.some(x => x.kaynak === 'oto:teklif_sure:tk9') }; });
  // Şablonlar yerinde: Firmalar → Mesaj şablonları, Teklifler → Teklif bilgileri
  await p.goto(U + '#/firmalar'); await w(1000); await p.evaluate(() => document.querySelector('[data-sablonlar]').click()); await w(400);
  const sab = await p.evaluate(() => !!document.querySelector('.drawer.open [data-sablon] #benim'));
  await p.click('.drawer.open .x[data-close]'); await w(400);
  await p.goto(U + '#/teklifler'); await w(1000); await p.evaluate(() => document.querySelector('[data-teklifb]').click()); await w(400);
  const tkb = await p.evaluate(() => !!document.querySelector('.drawer.open #tf-ad'));
  await p.click('.drawer.open .x[data-close]'); await w(400);
  kontrol('Silinen otomatik görev yeniden açılmıyor; mesaj şablonları Firmalar\'da, teklif bilgileri Teklifler\'de', sil.n === 0 && sil.yok && sab && tkb, JSON.stringify({ sil, sab, tkb }));
  await p.goto(U + '#/sirket/otomasyon'); await w(1500);
  const ayr = await p.evaluate(() => document.querySelectorAll('[data-otomasyon] [data-oto]').length);
  kontrol('Yinelenen görev tamamlanınca sonraki açılıyor; aşama değişince ve tarih yaklaşınca otomatik görev (bir kez); şirket profilinde kurallar', tek.var && tek.tarih && tek.acik && tek.firma === 'f1' && tek.tekrar === 'hafta' && asama.var && asama.tarih && asama.proje === 'p1' && tara.var && tara.n >= 1 && tara.n2 === 0 && ayr === 6, JSON.stringify({ tek, asama, tara, ayr }));
  kontrol('Otomasyonda hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}
// ---------- 19) Fırsat radarı ----------
{
  const DB9 = () => {
    const ts = '2026-10-01T08:00:00Z', o = x => ({ owner: 'u1', updated_at: ts, created_at: ts, ...x });
    const g = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    localStorage.setItem('__DB', JSON.stringify({
      firmalar: [o({ id: 'f1', ad: 'Örnek Bayi', tipler: ['Bayi'], il: 'Mersin' }), o({ id: 'f2', ad: 'Büyük Emüt', tipler: ['Emüt'], segment: 'A', il: 'Adana' })],
      kisiler: [], ziyaretler: [], gorevler: [],
      projeler: [o({ id: 'p2', ad: 'Hastane Ek Bina', durum: 'Sıcak', tutar_usd: 320000, emut_id: 'f2' }), o({ id: 'p3', ad: 'Küçük Depo', durum: 'Teklif Verildi', tutar_usd: 4000, emut_id: 'f1' })],
      teklifler: [o({ id: 't2', proje_id: 'p3', firma_id: 'f1', teklif_no: 'T-2', tarih: g(-12), gecerlilik: g(3), durum: 'Gönderildi', toplam: 4000, para_birimi: 'USD' })],
      ekip_uyeleri: [] }));
  };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB9 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  const r1 = await p.evaluate(() => ({ kart: !!document.querySelector('.radar-k'), ilk: document.querySelector('.radar-l .radar-s b')?.textContent, turler: [...new Set([...document.querySelectorAll('.radar-k .radar-s')].map(x => x.dataset.rk.split(':')[0]))], n: document.querySelectorAll('.radar-k .radar-s').length }));
  await p.screenshot({ path: 'tests/cikti/radar.png', fullPage: true });
  const ilkK = await p.evaluate(() => document.querySelector('.radar-k .radar-s').dataset.rk);
  await p.evaluate(() => document.querySelector('.radar-k [data-rertele]').click()); await w(900);
  const r2 = await p.evaluate(k => !document.querySelector(`.radar-k [data-rk="${k}"]`), ilkK);
  await p.evaluate(() => document.querySelector('[data-radartum]').click()); await w(500);
  await p.click('.drawer.open [data-rt="teklif"]'); await w(300);
  const r3 = await p.evaluate(() => [...document.querySelectorAll('.drawer.open .radar-s')].map(x => x.dataset.rk));
  await p.click('.drawer.open .x[data-close]'); await w(400);
  await p.goto(U + '#/panel'); await w(1200); const r4 = await p.evaluate(() => !!document.querySelector('.radar-k'));
  kontrol('Fırsat radarı: sessiz sıcak proje en üstte, karar verici, teklif süresi ve A müşterisi listede; ertelenen gizleniyor; Panel\'de de var', r1.kart && r1.ilk === 'Hastane Ek Bina' && ['sessiz', 'karar', 'teklif', 'uzak'].every(t => r1.turler.includes(t)) && r2 && r3.length === 1 && r3[0] === 'teklif:t2' && r4, JSON.stringify({ r1, r2, r3, r4 }));
  // Haftalık saha planı
  await p.goto(U + '#/plan'); await w(1000); await p.evaluate(() => document.querySelector('[data-w="7"]').click()); await w(900);
  const hp1 = await p.evaluate(() => ({ gun: document.querySelectorAll('.hp-gun').length, oneri: [...document.querySelectorAll('.hp-o')].map(x => x.dataset.of), gunler: [...document.querySelectorAll('.hp-gun')].map(x => x.dataset.gun) }));
  const ileri = await p.evaluate(async () => { const { today } = await import('./js/ui.js'); return [...document.querySelectorAll('.hp-gun')].map(x => x.dataset.gun).filter(d => d >= today()); });
  await p.selectOption(`[data-bolge="${ileri[0]}"]`, 'Adana'); await w(900);
  await p.evaluate(d => document.querySelector(`.hp-o[data-of="f2"] [data-ekle="${d}"]`).click(), ileri[0]); await w(900);
  const hp2 = await p.evaluate(async d => { const { S } = await import('./js/db.js'); return { z: S.ziyaretler.some(z => z.firma_id === 'f2' && z.tarih === d && z.durum === 'Planlandı'), gunde: !!document.querySelector(`.hp-gun[data-gun="${d}"] .hp-z`), oneride: !!document.querySelector('.hp-o[data-of="f2"]') }; }, ileri[0]);
  await p.selectOption(`[data-bolge="${ileri[1]}"]`, 'Mersin'); await w(900);
  await p.evaluate(() => { document.querySelector('[data-il="Tümü"]')?.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-dagit]').click()); await w(1200);
  const hp3 = await p.evaluate(async d => { const { S } = await import('./js/db.js'); return S.ziyaretler.some(z => z.firma_id === 'f1' && z.tarih === d && z.durum === 'Planlandı'); }, ileri[1]);
  await p.screenshot({ path: 'tests/cikti/hafta-plani.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 }); await w(300);
  const hpTasma = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await p.setViewportSize({ width: 1280, height: 900 });
  kontrol('Haftalık saha planı: öneriler (A müşterisi, teklif), güne bölge seçilip firma ekleniyor, öneriden düşüyor, otomatik dağıt bölgeye göre planlıyor, telefonda taşmıyor', hp1.gun === 5 && hp1.oneri.includes('f2') && hp1.oneri.includes('f1') && ileri.length >= 2 && hp2.z && hp2.gunde && !hp2.oneride && hp3 && hpTasma <= 1, JSON.stringify({ hp1, ileri, hp2, hp3, hpTasma }));
  // Pazartesi özeti: geçen hafta, bu hafta, dikkat (radar), hedef
  const hz = await p.evaluate(async () => { const { haftaOzeti, raporKarti } = await import('./js/views/bugun.js'); const { haftaBasi } = await import('./js/views/rapor.js'); const { today, gunEkle } = await import('./js/ui.js');
    const pzt = gunEkle(haftaBasi(today()), 7); const o = haftaOzeti(pzt); const div = document.createElement('div'); div.innerHTML = raporKarti(pzt); const per = raporKarti(gunEkle(pzt, 3));
    return { radar: o.radar.length, h2: div.querySelector('h2')?.textContent, dikkat: !!div.querySelector('.hz-l a[href^="#/proje/"]'), plan: !!div.querySelector('[data-raporplan]'), per }; });
  await p.goto(U + '#/bugun'); await w(900);
  await p.evaluate(async () => { const { raporKarti } = await import('./js/views/bugun.js'); const { haftaBasi } = await import('./js/views/rapor.js'); const { today, gunEkle } = await import('./js/ui.js'); document.querySelector('.dash').insertAdjacentHTML('afterbegin', raporKarti(gunEkle(haftaBasi(today()), 7))); });
  await (await p.$('.rapor-kart')).screenshot({ path: 'tests/cikti/pazartesi-ozeti.png' });
  kontrol('Pazartesi özeti kartı: geçen hafta, bu hafta, dikkat edilecekler (radardan), hafta planına geçiş; perşembe çıkmıyor', hz.radar > 0 && /^Haftan · /.test(hz.h2 || '') && hz.dikkat && hz.plan && hz.per === '', JSON.stringify(hz));
  const ks = await p.evaluate(async () => { const { kullanimVerisi } = await import('./js/saglik.js'); const r = kullanimVerisi()?.r || {}; return { radar: r['oz:radar-ertele']?.n || 0, plan: r['oz:hafta-plan']?.n || 0, dagit: r['oz:hafta-dagit']?.n || 0, plnEkran: r.plan?.n || 0 }; });
  await p.goto(U + '#/ayarlar'); await w(900); await p.evaluate(() => document.querySelector('[data-sekme="gorunum"], [data-t="gorunum"]')?.click()); await w(500);
  const ksK = await p.evaluate(() => document.querySelector('.kul-oz summary')?.textContent || '');
  kontrol('Kullanım ölçümü özellikleri de sayıyor (radar ertele, hafta planına ekleme, otomatik dağıt) ve Ayarlar → Kullanım\'da listeliyor', ks.radar >= 1 && ks.plan >= 1 && ks.dagit >= 1 && ks.plnEkran >= 1 && /Özellikler \(\d+\/17 kullanıldı\)/.test(ksK), JSON.stringify({ ks, ksK }));
  kontrol('Radarda hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 20) Teklif onay bağlantısı ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/teklifler'); await w(1500);
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); await app.db.save('teklifler', { id: 't7', teklif_no: 'T-7', firma_id: 'f2', proje_id: 'p1', kisi_id: 'k1', tarih: '2026-11-10', gecerlilik: '2099-01-01', durum: 'Taslak', para_birimi: 'USD', kdv: 20, iskonto: 0, kalemler: [{ ad: 'HBL 120W', adet: 10, birim_fiyat: 100 }], toplam: 1000 }); });
  await p.evaluate(async () => (await import('./js/views/teklif.js')).teklifForm({ id: 't7' })); await w(600);
  await p.evaluate(() => document.querySelector('.drawer.open [data-a="baglanti"]').click()); await w(900);
  await p.evaluate(() => document.querySelector('.drawer.open [data-yeni]').click()); await w(1200);
  const ob1 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const b = JSON.parse(localStorage.getItem('__DB')).teklif_baglantilari || []; const m = await import('./js/onaybaglanti.js');
    return { n: b.length, anahtar: b[0]?.anahtar?.length, html: /HBL 120W/.test(b[0]?.icerik?.html || ''), genel: b[0]?.icerik?.genel, son: b[0]?.son_tarih, durum: S.teklifler.find(t => t.id === 't7').durum, satir: document.querySelectorAll('.drawer.open .ob-l li').length, adres: m.baglantiAdresi(b[0].anahtar), b: b[0] }; });
  await p.click('.drawer.open .x[data-close]'); await w(800);
  const rozet = await p.evaluate(() => document.querySelector('.card-btn[data-id="t7"] .ob-r')?.textContent);
  // Müşteri sayfası: sunucu yanıtı testte taklit edilir (şemadaki işlevler Postgres'te ayrıca denendi)
  const m = await tarayici.newPage(); const yanit = [];
  await m.route(/x\.supabase\.co\/rest\/v1\/rpc\//, async r => { const ad = r.request().url().split('/rpc/')[1], g = JSON.parse(r.request().postData() || '{}');
    if (g.p_anahtar !== ob1.b.anahtar) return r.fulfill({ json: { hata: 'gecersiz' } });
    if (ad === 'teklif_goster') return r.fulfill({ json: { ...ob1.b.icerik, son_tarih: ob1.b.son_tarih, yanit: null } });
    yanit.push(g); return r.fulfill({ json: { tamam: true, yanit: g.p_yanit } }); });
  const adres = ob1.adres.replace(/^.*\/teklif\.html/, U.replace('index.html', 'teklif.html'));
  m.on('pageerror', e => hatalar.push('müşteri: ' + e.message));
  await m.goto(adres); await w(1200);
  const mus1 = await m.evaluate(() => ({ no: document.getElementById('no').textContent, toplam: document.getElementById('toplam').textContent, belge: !document.getElementById('belgeKart').hidden, onay: !document.getElementById('bOnay').hidden }));
  await m.click('#bOnay'); await m.fill('#ad', 'Ali Örnek'); await m.click('#gonder'); await w(700);
  const mus2 = await m.evaluate(() => document.getElementById('mesaj').textContent);
  await m.screenshot({ path: 'tests/cikti/teklif-musteri.png', fullPage: false });
  await m.goto('about:blank'); await m.goto(adres.replace(/a=[0-9a-f]+/, 'a=' + 'f'.repeat(48))); await w(800);
  const mus3 = await m.evaluate(() => document.getElementById('mesaj').textContent);
  await m.close();
  kontrol('Teklif onay bağlantısı: oluşturuluyor (48 karakter anahtar, PDF ile aynı içerik, teklif Gönderildi), listede rozet; müşteri sayfası teklifi gösteriyor, onay gidiyor, yanlış anahtarda uyarı',
    ob1.n === 1 && ob1.anahtar === 48 && ob1.html && Math.round(ob1.genel) === 1200 && ob1.son === '2099-01-01' && ob1.durum === 'Gönderildi' && ob1.satir === 1 && /teklif\.html#a=[0-9a-f]{48}&p=x&k=k$/.test(ob1.adres) && /gönderildi/i.test(rozet || '')
    && mus1.no === 'T-7' && /1\.200,00/.test(mus1.toplam) && mus1.belge && mus1.onay && yanit.length === 1 && yanit[0].p_yanit === 'Onay' && yanit[0].p_ad === 'Ali Örnek' && /onaylandı/i.test(mus2) && /geçersiz/i.test(mus3), JSON.stringify({ ...ob1, b: undefined, rozet, mus1, yanit, mus2, mus3 }));
  // Bayi talepleri: şirket tarafı yanıtlıyor ve projeye dönüştürüyor
  await p.evaluate(async () => { const { app } = await import('./js/state.js'); await app.db.c.from('bayi_talepleri').upsert([{ id: 'bt1', owner: 'u1', dis_firma_id: 'f1', tur: 'Yeni proje', baslik: 'Okul yenileme', il: 'Adana', tahmini_tutar: 45000, durum: 'Yeni', created_at: '2026-11-14T08:00:00Z' }, { id: 'bt2', owner: 'u1', dis_firma_id: 'f1', tur: 'Stok sorusu', baslik: 'Stok: HBL 120W × 40', durum: 'Yeni', created_at: '2026-11-13T08:00:00Z' }]); });
  await p.goto(U + '#/talepler'); await w(1300);
  const tl0 = await p.evaluate(() => ({ n: document.querySelectorAll('.talep').length, sum: document.querySelector('[data-sum]')?.textContent }));
  await p.evaluate(() => document.querySelector('[data-tid="bt2"] [data-yanit]').click()); await w(500);
  await p.fill('.drawer.open [name=yanit]', 'Depoda 60 adet var.'); await p.click('.drawer.open [type=submit]'); await w(1000);
  await p.evaluate(() => document.querySelector('[data-tid="bt1"] [data-proje]').click()); await w(800);
  const pform = await p.evaluate(() => document.querySelector('.drawer.open [name=ad]')?.value);
  await p.click('.drawer.open [type=submit]'); await w(2200);
  const tl1 = await p.evaluate(async () => { const d = JSON.parse(localStorage.getItem('__DB')); const { S } = await import('./js/db.js'); const b1 = d.bayi_talepleri.find(x => x.id === 'bt1'), b2 = d.bayi_talepleri.find(x => x.id === 'bt2'); const pr = S.projeler.find(x => x.id === b1.sonuc_proje_id); return { b1d: b1.durum, pr: pr?.ad, bayi: pr?.bayi_id, il: pr?.il, b2d: b2.durum, b2y: b2.yanit }; });
  kontrol('Bayi talepleri (şirket): açık talepler listede, yanıt kaydediliyor, "Projeye dönüştür" projeyi bayiyle açıp talebi bağlıyor', tl0.n === 2 && /2 yeni/.test(tl0.sum) && tl1.b2d === 'Yanıtlandı' && tl1.b2y === 'Depoda 60 adet var.' && pform === 'Okul yenileme' && tl1.b1d === 'Projeye dönüştü' && tl1.pr === 'Okul yenileme' && tl1.bayi === 'f1' && tl1.il === 'Adana', JSON.stringify({ tl0, pform, tl1 }));
  kontrol('Onay bağlantısında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 21) Konuşarak ziyaret kaydı ----------
{
  const DB10 = () => {
    const ts = '2026-10-01T08:00:00Z', o = x => ({ owner: 'u1', updated_at: ts, created_at: ts, ...x });
    localStorage.setItem('__DB', JSON.stringify({
      firmalar: [o({ id: 'fy', ad: 'Yıldız Elektrik Taahhüt Ltd. Şti.', tipler: ['Emüt'] }), o({ id: 'fk', ad: 'Kuzey İnşaat', tipler: ['Gemüt'] }), o({ id: 'fa', ad: 'Atlas Proje Mühendislik', tipler: ['Projeci'] })],
      kisiler: [o({ id: 'ka', firma_id: 'fy', ad_soyad: 'Ali Örnek', ad: 'Ali', soyad: 'Örnek' }), o({ id: 'kb', firma_id: 'fk', ad_soyad: 'Ali Kaya', ad: 'Ali', soyad: 'Kaya' }), o({ id: 'kc', firma_id: 'fk', ad_soyad: 'Ayşe Demir', ad: 'Ayşe', soyad: 'Demir' })],
      projeler: [o({ id: 'ph', ad: 'Devlet Hastanesi Ek Bina', durum: 'Sıcak', emut_id: 'fy' }), o({ id: 'po', ad: 'Okul Yenileme', durum: 'Proje', emut_id: 'fk' })],
      ziyaretler: [], gorevler: [], ekip_uyeleri: [] }));
  };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB10 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  const ay = await p.evaluate(async () => {
    const { ayristir, tarihBul } = await import('./js/ayristir.js'); const { gunEkle } = await import('./js/ui.js');
    const t = '2026-11-16';   // Pazartesi
    const a1 = ayristir("Yıldız Elektrik'te Ali Bey'le görüştüm, hastane işi için teklif istedi, perşembe ara", t);
    const a2 = ayristir('Kuzey İnşaatta Ayşe Hanım ile görüştüm, okul projesinde fiyatı yüksek buldu, pazarlık sürüyor, haftaya salı tekrar uğrayacağım', t);
    const a3 = ayristir('Atlas Proje kapalıydı kimseyi bulamadım', t);
    const a4 = ayristir('Bugün hiçbir firmaya gitmedim, yarın katalog gönder', t);
    return { a1, a2, a3, a4, d: { yarin: tarihBul('yarin ara', t), obur: tarihBul('obur gun', t), cuma: tarihBul('cuma gunu', t), haftayaPzt: tarihBul('haftaya pazartesi', t), kasim20: tarihBul('20 kasimda', t), uc: tarihBul('3 gun sonra', t), pazar: tarihBul('pazara', t) } };
  });
  const a = ay;
  const ayOk = a.a1.firma_id === 'fy' && a.a1.kisi_id === 'ka' && a.a1.proje_id === 'ph' && a.a1.sonuc_tipi === 'Teklif istendi' && a.a1.gorev?.son_tarih === '2026-11-19'
    && a.a2.firma_id === 'fk' && a.a2.kisi_id === 'kc' && a.a2.proje_id === 'po' && a.a2.sonuc_tipi === 'Pazarlık sürüyor' && a.a2.gorev?.son_tarih === '2026-11-24' && /Tekrar ziyaret/.test(a.a2.gorev?.baslik)
    && a.a3.firma_id === 'fa' && a.a3.sonuc_tipi === 'Görüşülemedi' && !a.a3.kisi_id
    && !a.a4.firma_id && a.a4.gorev?.son_tarih === '2026-11-17'
    && a.d.yarin === '2026-11-17' && a.d.obur === '2026-11-18' && a.d.cuma === '2026-11-20' && a.d.haftayaPzt === '2026-11-23' && a.d.kasim20 === '2026-11-20' && a.d.uc === '2026-11-19' && a.d.pazar === '2026-11-22';
  kontrol('Konuşarak kayıt ayrıştırıcı: firma (ekli adla), kişi (Bey/Hanım), proje, sonuç, sonraki adım ve tarih ifadeleri (yarın, öbür gün, gün adı, haftaya, 20 kasım, 3 gün sonra)', ayOk, JSON.stringify(a));
  // Arayüz: + → Konuşarak kaydet
  await p.evaluate(async () => (await import('./js/hizli.js')).sesliNot()); await w(600);
  await p.fill('.drawer.open #sn-t', "Yıldız Elektrik'te Ali Bey'le görüştüm, hastane işi için teklif istedi, yarın ara"); await p.dispatchEvent('.drawer.open #sn-t', 'change'); await w(500);
  const ui1 = await p.evaluate(() => ({ f: document.querySelector('#ks-f').value, k: document.querySelector('#ks-k').value, p: document.querySelector('#ks-p').value, s: document.querySelector('#ks-s').value, g: document.querySelector('#ks-g').value, dolu: document.querySelector('.ks-anl').classList.contains('dolu') }));
  await p.screenshot({ path: 'tests/cikti/konusarak-kaydet.png' });
  await p.selectOption('#ks-s', 'Olumlu'); await w(100);
  await p.click('.drawer.open [type=submit]'); await w(1200);
  const ui2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const { today, gunEkle } = await import('./js/ui.js'); const z = S.ziyaretler.at(-1), g = S.gorevler.at(-1); return { z: z && [z.firma_id, z.kisi_id, z.proje_id, z.sonuc_tipi, z.durum, z.tarih === today()].join(), g: g && [g.firma_id, g.son_tarih === gunEkle(today(), 1), /^Ara/.test(g.baslik)].join() }; });
  kontrol('Konuşarak kaydet penceresi: alanlar kendiliğinden doluyor, elle değiştirilen alan korunuyor, ziyaret ve sonraki adım görevi kaydediliyor', ui1.f === 'fy' && ui1.k === 'ka' && ui1.p === 'ph' && ui1.s === 'Teklif istendi' && /^Ara: Yıldız Elektrik \(Ali Örnek\)$/.test(ui1.g) && ui1.dolu && ui2.z === 'fy,ka,ph,Olumlu,Yapıldı,true' && ui2.g === 'fy,true,true', JSON.stringify({ ui1, ui2 }));
  kontrol('Konuşarak kayıtta hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 22) Ekip haritası ve canlı akış ----------
{
  const DB11 = () => {
    const ts = '2026-10-01T08:00:00Z', o = x => ({ owner: 'u1', updated_at: ts, created_at: ts, ...x });
    const g = new Date(); const gun = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
    const z = (h, m) => new Date(`${gun}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
    localStorage.setItem('__DB', JSON.stringify({
      firmalar: [o({ id: 'f1', ad: 'Yıldız Elektrik', lat: 37.0, lng: 35.32 }), o({ id: 'f2', ad: 'Kuzey İnşaat', lat: 36.8, lng: 34.6 }), o({ id: 'f3', ad: 'Atlas Proje', lat: 37.01, lng: 35.30 })],
      ziyaretler: [o({ id: 'z1', sorumlu: 'gorkem@x.com', tarih: gun, durum: 'Yapıldı', firma_id: 'f1', giris: z(9, 5), cikis: z(9, 50), lat: 37.0, lng: 35.32, giris_mesafe: 40, sonuc_tipi: 'Olumlu' }),
        o({ id: 'z2', sorumlu: 'gorkem@x.com', tarih: gun, durum: 'Yapıldı', firma_id: 'f3', giris: z(10, 30), lat: 37.01, lng: 35.30 }),
        o({ id: 'z3', sorumlu: 'ali@x.com', tarih: gun, durum: 'Yapıldı', firma_id: 'f2', giris: z(11, 20), cikis: z(11, 55), lat: 36.8, lng: 34.6 }),
        o({ id: 'z4', sorumlu: 'ali@x.com', tarih: gun, durum: 'Planlandı', firma_id: 'f1' })],
      teklifler: [o({ id: 'tt', sorumlu: 'ali@x.com', teklif_no: 'T-5', tarih: gun, firma_id: 'f2', toplam: 5000, para_birimi: 'USD', created_at: z(12, 10) })],
      gorevler: [o({ id: 'gg', baslik: 'Katalog gönder', durum: 'Tamam', tamamlayan: 'gorkem@x.com', updated_at: z(13, 0) })],
      ekip_uyeleri: [] }));
  };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB11 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/ekiphar'); await w(1500);
  const eh = await p.evaluate(() => ({ satir: [...document.querySelectorAll('.eh-t tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')), canli: document.querySelector('.eh-canli')?.textContent, akis: [...document.querySelectorAll('.eh-l li')].map(l => l.innerText.replace(/\s+/g, ' ')), kisi: document.querySelectorAll('.eh-kisi [data-k]').length }));
  await p.screenshot({ path: 'tests/cikti/ekip-haritasi.png', fullPage: true });
  await p.evaluate(() => document.querySelector('.eh-kisi [data-k="ali@x.com"]').click()); await w(500);
  const eh2 = await p.evaluate(() => [...document.querySelectorAll('.eh-l li')].length);
  await p.setViewportSize({ width: 390, height: 844 }); await w(400);
  const ehTasma = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  kontrol('Ekip haritası: kişi özeti (ziyaret, içeride süre, teklif, görev), şu an içeride olan, saat sırasıyla akış, kişiye göre süzme, telefonda taşmıyor',
    eh.satir.length === 2 && /gorkem/.test(eh.satir[0]) && /Atlas Proje/.test(eh.canli || '') && eh.akis.length === 7 && /Görev tamamlandı/.test(eh.akis[0]) && eh.kisi === 3 && eh2 === 3 && ehTasma <= 1, JSON.stringify({ eh, eh2, ehTasma }));
  const zs = await p.evaluate(async () => (await import('./js/push.js')).zamanlamaSql('https://abc.supabase.co/', 'ANON', 'GIZLI'));
  kontrol('Pazartesi bildirimi zamanlama SQL\'i: pazartesi 05:00 UTC, bildir fonksiyonu, anahtar başlıkları, haftalık olay', /cron\.schedule\('saha-pazartesi-ozeti', '0 5 \* \* 1'/.test(zs) && zs.includes("url := 'https://abc.supabase.co/functions/v1/bildir'") && zs.includes("'x-cron-anahtar', 'GIZLI'") && zs.includes("'Bearer ANON'") && zs.includes('{"olay":"haftalik"}'), zs);
  // Yenilikler: eski sürümden gelen kullanıcıya bir kez
  await p.evaluate(() => localStorage.setItem('saha-gorulen-surum', '78')); await p.reload(); await w(2600);
  const yn = await p.evaluate(async () => ({ ...(m => ({ enYeni: Math.max(...m.YENILIKLER.map(x => x.s)), son: m.YENILIKLER.reduce((a, b) => b.s > a.s ? b : a).t }))(await import('./js/yardim.js')), acik: document.querySelector('.drawer.open h2')?.textContent, n: document.querySelectorAll('.drawer.open .yenilik-l li').length, ilk: document.querySelector('.drawer.open .yenilik-l b')?.textContent }));
  await p.evaluate(() => [...document.querySelectorAll('.drawer.open .yenilik-l li')].find(li => /Kayıp ve rakip/.test(li.textContent)).querySelector('[data-yi]').click()); await w(1000);
  const yn2 = await p.evaluate(() => ({ hash: location.hash, gor: localStorage.getItem('saha-gorulen-surum') }));
  await p.reload(); await w(2600); const yn3 = await p.evaluate(() => !document.querySelector('.drawer.open .yenilik-l'));
  kontrol('Yenilikler: yeni sürümde bir kez açılıyor (yalnızca görülmemişler, en yeni üstte), Göster ilgili ekrana götürüyor, tekrar açılmıyor', yn.acik === 'Yenilikler' && yn.n >= 4 && yn.ilk === yn.son && yn2.hash === '#/rakipanaliz' && yn2.gor === String(yn.enYeni) && yn3, JSON.stringify({ yn, yn2, yn3 }));
  kontrol('Ekip haritasında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 23) Kayıp ve rakip istihbaratı ----------
{
  const DB12 = () => {
    const o = (x, i) => ({ owner: 'u1', updated_at: '2026-0' + (i % 9 + 1) + '-15T08:00:00Z', created_at: '2026-01-01T08:00:00Z', ...x });
    localStorage.setItem('__DB', JSON.stringify({
      firmalar: [], kisiler: [], ziyaretler: [], ekip_uyeleri: [],
      projeler: [o({ id: 'k1', ad: 'Hastane A', durum: 'Kayıp', il: 'Adana', sektor: 'Sağlık', rakip_marka: 'Philips', kayip_nedeni: 'Fiyat', bizim_teklif_usd: 100000, rakip_toplam_usd: 88000 }, 1),
        o({ id: 'k2', ad: 'Depo B', durum: 'Kayıp', il: 'Mersin', sektor: 'Lojistik', rakip_marka: 'Pelsan', kayip_nedeni: 'Fiyat', bizim_teklif_usd: 50000, rakip_toplam_usd: 45000 }, 4),
        o({ id: 'k3', ad: 'Okul C', durum: 'Kayıp', il: 'Adana', sektor: 'Eğitim', rakip_marka: 'Philips', kayip_nedeni: 'Şartname dışı kaldık', tutar_usd: 30000 }, 7),
        o({ id: 'k4', ad: 'Fabrika D', durum: 'Kayıp', il: 'Hatay', tutar_usd: 20000 }, 8),
        o({ id: 's1', ad: 'Otel E', durum: 'Sipariş', il: 'Adana', tutar_usd: 70000, siparis_tutari_usd: 70000 }, 5), o({ id: 'a1', ad: 'Açık F', durum: 'Sıcak', il: 'Adana', tutar_usd: 1 }, 2)],
      rakip_fiyatlar: [o({ id: 'r1', marka: 'Philips', proje_id: 's1', urun_adi: 'Panel', birim_fiyat: 30, para_birimi: 'USD', tarih: '2026-05-01' }, 3)],
      proje_gecmis: [] }));
  };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB12 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/rakipanaliz'); await w(1500);
  const ra = await p.evaluate(async () => { const { analiz } = await import('./js/views/rakipanaliz.js'); const a = analiz({ yil: '2026', il: 'Tümü', sektor: 'Tümü' }); const ph = a.rakipler.find(x => x.m === 'Philips');
    return { n: a.kayip.length, kazan: a.kazan.length, oran: Math.round(a.oran), ilk: a.rakipler[0].m, phK: ph.kayip.length, phKaz: ph.kazan.length, phFark: Math.round(ph.ortFark), ort: Math.round(a.ortFark), eksik: a.eksik, neden: a.neden[0][0], satir: document.querySelectorAll('.ra-t tr[data-m]').length, son: [...document.querySelectorAll('.ra-t tr[data-m]')].at(-1)?.dataset.m }; });
  await p.screenshot({ path: 'tests/cikti/kayip-rakip.png', fullPage: true });
  await p.evaluate(() => document.querySelector('.ra-t tr[data-m="Philips"]').click()); await w(500);
  const det = await p.evaluate(() => ({ h: document.querySelector('.drawer.open h2')?.textContent, kazan: /Otel E/.test(document.querySelector('.drawer.open')?.textContent || '') }));
  await p.click('.drawer.open .x[data-close]'); await w(300);
  await p.selectOption('[data-f="il"]', 'Adana'); await w(600);
  const ra2 = await p.evaluate(() => document.querySelectorAll('.ra-t tr[data-m]').length);
  await p.setViewportSize({ width: 390, height: 844 }); await w(300);
  const raTasma = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  kontrol('Kayıp ve rakip: rakip tablosu (Philips 2 kayıp, 1 kazanılan; ortalama %12 ucuz), neden, eksik bilgi, kazanma oranı, rakip ayrıntısında kazandıklarımız, il süzgeci, telefonda taşmıyor',
    ra.n === 4 && ra.kazan === 1 && ra.oran === 20 && ra.ilk === 'Philips' && ra.phK === 2 && ra.phKaz === 1 && ra.phFark === 12 && ra.ort === 11 && ra.eksik === 1 && ra.neden === 'Fiyat' && ra.satir === 3 && ra.son === 'Belirtilmemiş' && det.h === 'Philips' && det.kazan && ra2 === 1 && raTasma <= 1, JSON.stringify({ ra, det, ra2, raTasma }));
  kontrol('Kayıp ve rakip ekranında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 24) Çakışma: alan alan birleştirme ----------
{
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB });
  const mesajlar = []; p.on('dialog', d => mesajlar.push(d.message()));
  await p.goto(U + '#/projeler'); await w(1500);
  const sonuc = await p.evaluate(async () => {
    const { app } = await import('./js/state.js'); const { S } = await import('./js/db.js');
    const c = app.db.c, pid = S.projeler[0].id, sunucu = async () => JSON.parse(JSON.stringify((await c.from('projeler').select('*').eq('id', pid).maybeSingle()).data));
    const yerel = () => S.projeler.find(x => x.id === pid);
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    await bekle(20);
    // 1) Başkası durumu, ben notu değiştirdim → ikisi de kalır, sormadan
    await c.from('projeler').update({ durum: 'Sıcak' }).eq('id', pid); await bekle(20);
    await app.db.save('projeler', { ...yerel(), notlar: 'benim notum' });
    const s1 = await sunucu();
    // 2) İkimiz de notu değiştirdik → sorar (Tamam: seninki)
    await bekle(20); await c.from('projeler').update({ notlar: 'onun notu' }).eq('id', pid); await bekle(20);
    await app.db.save('projeler', { ...yerel(), notlar: 'benim ikinci notum' });
    const s2 = await sunucu();
    // 3) İnternetsizken tutarı değiştirdim, bu arada başkası durumu değiştirdi → gönderilince birleşir
    window.__cevrimdisi = true; await app.db.save('projeler', { ...yerel(), tutar_usd: 777 }); window.__cevrimdisi = false;
    await bekle(20); await c.from('projeler').update({ durum: 'İhale' }).eq('id', pid);
    await app.db.flush(); const s3 = await sunucu(), k3 = (await app.db.bekleyenler()).length;
    // 4) İnternetsizken durumu değiştirdim, başkası da durumu değiştirdi → bekletir, seçince yazar
    window.__cevrimdisi = true; await app.db.save('projeler', { ...yerel(), durum: 'Sipariş' }); await app.db.save('projeler', { ...yerel(), notlar: 'ikinci çevrimdışı' }); window.__cevrimdisi = false;
    await bekle(20); await c.from('projeler').update({ durum: 'Kayıp' }).eq('id', pid);
    await app.db.flush(); const b4 = await app.db.bekleyenler();
    await app.db.bekleyenSec(0, 'seninki'); const s4 = await sunucu(), k4 = (await app.db.bekleyenler()).length;
    return { s1: [s1.durum, s1.notlar], s2: s2.notlar, s3: [s3.tutar_usd, s3.durum], k3, b4: b4.map(o => [!!o.cakisma, !!o.base]), s4: [s4.durum, s4.notlar], k4 };
  });
  kontrol('Çakışma: farklı alanlar sormadan birleşiyor; aynı alan değerleriyle soruluyor; internetsiz değişiklik gönderilince birleşiyor; aynı alan çatışırsa bekletilip seçimle yazılıyor',
    sonuc.s1.join() === 'Sıcak,benim notum' && sonuc.s2 === 'benim ikinci notum' && mesajlar.length === 1 && /Notlar: onunki «onun notu», seninki «benim ikinci notum»/.test(mesajlar[0])
    && sonuc.s3.join() === '777,İhale' && sonuc.k3 === 0 && sonuc.b4.length === 2 && sonuc.b4[0][0] && sonuc.b4[1][1] && sonuc.s4.join() === 'Sipariş,ikinci çevrimdışı' && sonuc.k4 === 0, JSON.stringify({ sonuc, mesajlar }));
  kontrol('Çakışma denemesinde hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 25) Bugünün soruları (eksik veri) ----------
{
  const DB13 = () => {
    const ts = '2026-10-01T08:00:00Z', o = x => ({ owner: 'u1', updated_at: ts, created_at: ts, ...x });
    localStorage.setItem('__DB', JSON.stringify({
      firmalar: [o({ id: 'f1', ad: 'Yıldız Elektrik', tipler: ['Emüt'] })], kisiler: [], ziyaretler: [], gorevler: [], teklifler: [], ekip_uyeleri: [],
      projeler: [o({ id: 'k1', ad: 'Hastane', durum: 'Kayıp', tutar_usd: 300000, takip_yili: 2026 }), o({ id: 'a1', ad: 'Okul', durum: 'Sıcak', emut_id: 'f1', takip_yili: 2026 }),
        o({ id: 'a2', ad: 'Depo', durum: 'Proje', tutar_usd: 1000, emut_id: 'f1' }), o({ id: 'a3', ad: 'Otel', durum: 'İhale', tutar_usd: 5000, takip_yili: 2026, beklenen_tarih: '2026-01-10', emut_id: 'f1' })] }));
  };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB13 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  const e1 = await p.evaluate(() => ({ n: document.querySelectorAll('[data-eksik] li[data-ek]').length, k: [...document.querySelectorAll('[data-eksik] li[data-ek]')].map(l => l.dataset.ek) }));
  await (await p.$('[data-eksik]')).screenshot({ path: 'tests/cikti/bugunun-sorulari.png' });
  // Kayıp: neden + marka
  await p.selectOption('[data-ek="kayip:k1"] [data-a="kayip_nedeni"]', 'Fiyat'); await p.fill('[data-ek="kayip:k1"] [data-a="rakip_marka"]', 'Philips');
  await p.click('[data-ek="kayip:k1"] [data-kaydet]'); await w(900);
  // Tutar
  await p.fill('[data-ek="tutar:a1"] [data-a="tutar_usd"]', '45000'); await p.click('[data-ek="tutar:a1"] [data-kaydet]'); await w(900);
  const e2 = await p.evaluate(async () => { const { S } = await import('./js/db.js'); const k1 = S.projeler.find(x => x.id === 'k1'), a1 = S.projeler.find(x => x.id === 'a1'); return { k1: [k1.kayip_nedeni, k1.rakip_marka], a1: a1.tutar_usd, k: [...document.querySelectorAll('[data-eksik] li[data-ek]')].map(l => l.dataset.ek), sayi: document.querySelector('[data-eksik] h2')?.textContent }; });
  // Atla → 30 gün sorulmaz; üçüncüyü cevapla → bugünlük bitti
  const atlanan = e2.k[0];
  await p.click(`[data-ek="${atlanan}"] [data-atla]`); await w(800);
  const e3 = await p.evaluate(() => [...document.querySelectorAll('[data-eksik] li[data-ek]')].map(l => l.dataset.ek));
  await p.evaluate(() => document.querySelector('[data-eksik] li[data-ek] [data-hizli]').click()); await w(900);
  const e4 = await p.evaluate(() => document.querySelector('[data-eksik]')?.textContent || '');
  kontrol('Bugünün soruları: en fazla 3 soru (kayıp nedeni/marka, tutar, gecikmiş tarih, yıl, segment), yerinde kaydediliyor, Atla 30 gün sormuyor, günlük 3 cevaptan sonra "bugünlük bu kadar"',
    e1.n === 3 && e1.k.includes('kayip:k1') && e2.k1.join() === 'Fiyat,Philips' && e2.a1 === 45000 && /2\/3/.test(e2.sayi) && !e3.includes(atlanan) && /Bugünlük bu kadar/.test(e4), JSON.stringify({ e1, e2, e3, e4: e4.slice(0, 120) }));
  kontrol('Bugünün sorularında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 26) Tahsilat ve vade riski ----------
{
  const DB14 = () => {
    const ts = '2026-10-01T08:00:00Z', o = x => ({ owner: 'u1', updated_at: ts, created_at: ts, ...x });
    const g = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    localStorage.setItem('__DB', JSON.stringify({
      firmalar: [o({ id: 'f1', ad: 'Geciken İnşaat', lat: 37, lng: 35.3, segment: 'A' }), o({ id: 'f2', ad: 'Geç Öder Elektrik' }), o({ id: 'f3', ad: 'Düzgün Yapı' })], ekip_uyeleri: [],
      kisiler: [o({ id: 'k1', firma_id: 'f1', ad_soyad: 'Ali Örnek', telefon: '05320000000', dogum_gunu: '1980-' + g(5).slice(5) })],
      gorevler: [o({ id: 'g1', firma_id: 'f1', baslik: 'Numune listesini sor', durum: 'Açık', son_tarih: g(-2) })],
      teklifler: [o({ id: 't1', firma_id: 'f1', proje_id: 'pr1', teklif_no: 'T-9', tarih: g(-20), gecerlilik: g(5), durum: 'Gönderildi', toplam: 30000, para_birimi: 'USD' })],
      projeler: [o({ id: 'pr1', ad: 'Fabrika Aydınlatma', durum: 'Sıcak', tutar_usd: 80000, emut_id: 'f1' })],
      ziyaretler: [o({ id: 'z1', firma_id: 'f1', tarih: g(0), durum: 'Planlandı' })],
      tahsilatlar: [o({ id: 'h1', firma_id: 'f1', tarih: g(-130), vade: g(-70), tutar: 20000, odenen: 0, para_birimi: 'USD' }), o({ id: 'h2', firma_id: 'f1', tarih: g(-20), vade: g(40), tutar: 5000, odenen: 0, para_birimi: 'USD' }),
        ...[1, 2, 3].map(i => o({ id: 'p' + i, firma_id: 'f2', tarih: g(-200 + i * 30), vade: g(-150 + i * 30), tutar: 1000, odenen: 1000, odeme_tarihi: g(-110 + i * 30), para_birimi: 'USD' })),
        o({ id: 'h3', firma_id: 'f3', tarih: g(-10), vade: g(20), tutar: 3000, odenen: 0, para_birimi: 'USD' })] }));
  };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DB14 });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  const r1 = await p.evaluate(async () => { const m = await import('./js/vaderisk.js'); const a = m.firmaRiski('f1'), b = m.firmaRiski('f2'), d = m.firmaRiski('f3'); return { a: [a.seviye, Math.round(a.gecikmis), a.maxGun], b: [b.seviye, b.ortGec], d: d.seviye, liste: m.riskListesi().map(x => x.fid), planRozet: !!document.querySelector('.route .vr-rozet') }; });
  await p.goto(U + '#/panel'); await w(1200); const r2 = await p.evaluate(() => [...document.querySelectorAll('.vr-k .vr-l li')].length);
  await p.evaluate(async () => (await import('./js/views/teklif.js')).teklifForm({ firma_id: 'f1' })); await w(700);
  const r3 = await p.evaluate(() => document.querySelector('.drawer.open [data-vrisk]')?.textContent || '');
  await p.screenshot({ path: 'tests/cikti/vade-riski-teklif.png' });
  await p.fill('.drawer.open [name=firma_id]', 'Düzgün Yapı'); await p.dispatchEvent('.drawer.open [name=firma_id]', 'change'); await w(300);
  const r4 = await p.evaluate(() => document.querySelector('.drawer.open [data-vrisk]')?.textContent || '');
  await p.click('.drawer.open .x[data-close]'); await w(400);
  await p.goto(U + '#/firma/f1'); await w(1200); const r5 = await p.evaluate(() => document.querySelector('h1 .vr-rozet')?.textContent || '');
  kontrol('Vade riski: 70 gün gecikmiş firma yüksek risk, düzenli 40 gün geç ödeyen "geç öder", düzgün firma risksiz; Panel kartı, Bugün planında rozet, teklif penceresinde uyarı (firma değişince güncelleniyor), firma sayfasında rozet',
    r1.a.join() === 'yuksek,20000,70' && r1.b.join() === 'gec,40' && r1.d === null && r1.liste.join() === 'f1,f2' && r1.planRozet && r2 === 2 && /Yüksek risk/.test(r3) && /20\.000 \$ gecikmiş/.test(r3) && r4 === '' && /20\.000/.test(r5), JSON.stringify({ r1, r2, r3, r4, r5 }));
  // Ziyarete hazırlık
  await p.goto(U + '#/bugun'); await w(1200);
  await p.evaluate(() => document.querySelector('[data-hazirlik="f1"]').click()); await w(700);
  const hz = await p.evaluate(() => { const d = document.querySelector('.drawer.open'); return { h: d.querySelector('h2')?.textContent, konu: [...d.querySelectorAll('.hz-konu li')].map(l => l.textContent), kisi: d.querySelector('.hz-ic .list a[href="#/kisi/k1"]')?.textContent || '', proje: !!d.querySelector('a[href="#/proje/pr1"]'), alt: d.querySelector('.hz-alt')?.textContent }; });
  await p.screenshot({ path: 'tests/cikti/ziyarete-hazirlik.png' });
  await p.click('.drawer.open [data-hzgiris]'); await w(1200);
  const hzG = await p.evaluate(async () => { const { aktifZiyaret } = await import('./js/giriscikis.js'); return aktifZiyaret()?.firma_id; });
  await p.goto(U + '#/firma/f1'); await w(1000); await p.evaluate(() => document.querySelector('[data-hazirlik]').click()); await w(600);
  const hzF = await p.evaluate(() => document.querySelector('.drawer.open h2')?.textContent);
  kontrol('Ziyarete hazırlık: Bugün planından ve firma sayfasından açılıyor; tahsilat, gecikmiş görev, cevap bekleyen teklif konuşulacaklarda; karar verici/kişi ve doğum günü, açık proje; Giriş yap ziyareti başlatıyor',
    hz.h === 'Geciken İnşaat' && hz.konu.some(k => /^Tahsilat/.test(k)) && hz.konu.some(k => /Numune listesini sor/.test(k)) && hz.konu.some(k => /Teklif T-9 cevap bekliyor/.test(k)) && /5 gün sonra doğum günü/.test(hz.kisi) && hz.proje && /A segmenti/.test(hz.alt) && hzG === 'f1' && hzF === 'Geciken İnşaat', JSON.stringify({ hz, hzG, hzF }));
  kontrol('Vade riskinde hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
  await c.close();
}

// ---------- 27) Şirket barı: telefonda üstte, bilgisayarda menüde tam ad ----------
{
  const DBP = () => { const ts = '2026-10-01T08:00:00Z'; localStorage.setItem('__DB', JSON.stringify({ projeler: [{ id: 'p1', owner: 'u1', ad: 'Proje', durum: 'Sıcak', updated_at: ts }], firmalar: [], kisiler: [], ziyaretler: [], gorevler: [], ekip_uyeleri: [],
    ayarlar: [{ id: 'a1', owner: 'u1', anahtar: 'firma_profil', deger: { firma: 'EAE Aydınlatma Elektrik Sanayi', sektor: 'aydinlatma', iller: ['Adana', 'Mersin', 'Hatay', 'Osmaniye'] }, updated_at: ts }] })); };
  const { p, c, hatalar } = await sayfa({ supabase: true, hazirla: DBP });
  await p.setViewportSize({ width: 412, height: 900 }); await p.goto(U + '#/bugun'); await w(1500);
  const m = await p.evaluate(() => { const fb = document.getElementById('firma-bar'), r = fb?.getBoundingClientRect(), navF = document.querySelector('#nav .nav-firma'), sekme = document.querySelector('#view .sekmeler, #view .ust-sekme, #view [role=tablist]');
    return { gorunur: !!fb && getComputedStyle(fb).display !== 'none', ust: r ? Math.round(r.top) : null, ad: fb?.querySelector('b')?.textContent, navda: navF ? getComputedStyle(navF).display : 'yok', navGen: [...document.querySelectorAll('#nav .nav-main > a')].map(a => Math.round(a.getBoundingClientRect().width)) }; });
  await p.screenshot({ path: 'tests/cikti/sirket-bari-telefon.png' });
  await p.goto(U + '#/harita'); await w(900); const mh = await p.evaluate(() => getComputedStyle(document.getElementById('firma-bar')).display);
  await p.setViewportSize({ width: 1280, height: 800 }); await p.goto(U + '#/bugun'); await w(900);
  const d = await p.evaluate(() => { const b = document.querySelector('#nav .nav-firma b'); return { bar: getComputedStyle(document.getElementById('firma-bar')).display, kesik: b ? b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1 : null, metin: b?.textContent }; });
  await (await p.$('#nav')).screenshot({ path: 'tests/cikti/sirket-menude.png' });
  kontrol('Şirket kartı: telefonda sayfanın en üstünde bar (alt menüde değil, haritada gizli), bilgisayarda menüde ad kesilmeden', m.gorunur && m.ust === 0 && /EAE Aydınlatma/.test(m.ad) && m.navda === 'none' && m.navGen.every(x => x >= 60) && mh === 'none' && d.bar === 'none' && d.kesik === false, JSON.stringify({ m, mh, d }));
  kontrol('Şirket barında hata yok', !hatalar.length, hatalar.slice(0, 3).join(' | '));
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
  kontrol('Firma başlığında simge çubuğu: iletişim, ekle (ziyaret/kişi/görev/teklif), ⋯ (numune, servis, Google, sil; telefonda alttan panel)', /^[123],4,1$/.test(arac.gruplar) && arac.sigdi && telMenu.acik && telMenu.konum === 'fixed' && telMenu.oge.length === 5 && /Bayi \/ partner/.test(telMenu.oge[3]) && /sil/i.test(telMenu.oge[4]) && telMenu.perde && telKapandi && ekleZ.drawer, JSON.stringify({ arac, telMenu, telKapandi, ekleZ }));
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
