// Kartvizit kırpma: fotoğrafta kartın köşelerini kendiliğinden bulur, kullanıcı köşeleri sürükleyerek düzeltir,
// perspektif düzeltilir ve yalnızca kart (yatay, düz) kaydedilir. Hiçbir dış kütüphane kullanmaz.

// ---------- Görseli yükleme (telefonun EXIF yön bilgisi uygulanır) ----------
export async function gorselYukle(blob, enBuyuk = 3000) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Fotoğraf açılamadı.')); i.src = URL.createObjectURL(blob); });
  const sc = Math.min(1, enBuyuk / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c;
}
export const blobYap = (c, q = 0.9) => new Promise(r => c.toBlob(r, 'image/jpeg', q));

// ---------- Kart köşelerini bulma ----------
// İki yoldan aday dörtgenler çıkarılır: (1) Hough ile bulunan düz kenar çizgilerinin oluşturduğu dörtgenler,
// (2) kenarlardan arka planı doldurup kalan en büyük parça. Her aday, dört kenarı boyunca fotoğrafta gerçekten
// bir kenar olup olmadığına, oranına (kartvizit ~1,6), büyüklüğüne ve ortaya yakınlığına göre puanlanır.
export function koseBul(kaynak, { M = 480 } = {}) {
  const sc = Math.min(1, M / Math.max(kaynak.width, kaynak.height));
  const w = Math.max(8, Math.round(kaynak.width * sc)), h = Math.max(8, Math.round(kaynak.height * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(kaynak, 0, 0, w, h);
  const g = egim(x.getImageData(0, 0, w, h).data, w, h);
  const adaylar = [];
  for (const kat of [1, 0.55, 0.3]) { const q = dortgenBul(kenarHaritasi(g, w, h, kat), w, h); if (q) adaylar.push(q); }
  adaylar.push(...houghAdaylari(g, w, h, 0.7));
  let en = null;
  const dene = l => { for (const q of l) { const p = puanla(q, g, w, h); if (p > (en ? en.p : 0)) en = { q, p }; } };
  dene(adaylar);
  // Kartın kenarı yazılardan zayıfsa (soluk kenar, desenli zemin) daha hassas çizgi aramasıyla tekrar dene
  if (!en || en.p < 0.55) { const ek = houghAdaylari(g, w, h, 0.35); adaylar.push(...ek); dene(ek); }
  koseBul.son = { aday: adaylar.length, puan: en ? +en.p.toFixed(3) : 0 };
  if (!en || en.p < 0.3) return null;
  return inceAyar(siraliKoseler(en.q), g, w, h).map(([a, b]) => [Math.max(0, Math.min(kaynak.width, a / sc)), Math.max(0, Math.min(kaynak.height, b / sc))]);
}

function egim(p, w, h) {
  const n = w * h, kanal = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) { kanal[0][i] = p[i * 4]; kanal[1][i] = p[i * 4 + 1]; kanal[2][i] = p[i * 4 + 2]; }
  const bul = k => { const t = new Float32Array(n), o = new Float32Array(n), r = 1;   // 3x3 kutu bulanıklığı, iki kez
    for (let tekrar = 0; tekrar < 2; tekrar++) {
      const kk = tekrar ? o : k;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, m = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += kk[y * w + xx]; m++; } } t[y * w + x] = s / m; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, m = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += t[yy * w + x]; m++; } } o[y * w + x] = s / m; }
    }
    return o; };
  const b = kanal.map(bul), g = new Float32Array(n), GX = new Float32Array(n), GY = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let enb = 0, bx = 0, by = 0;
    for (const k of b) {
      const gx = k[i - w + 1] + 2 * k[i + 1] + k[i + w + 1] - k[i - w - 1] - 2 * k[i - 1] - k[i + w - 1];
      const gy = k[i + w - 1] + 2 * k[i + w] + k[i + w + 1] - k[i - w - 1] - 2 * k[i - w] - k[i - w + 1];
      const m = Math.abs(gx) + Math.abs(gy); if (m > enb) { enb = m; bx = gx; by = gy; }
    }
    g[i] = enb; GX[i] = bx; GY[i] = by;
  }
  g.otsu = otsu(g, n); g.GX = GX; g.GY = GY;
  return g;
}

// Her kenar için, kenar boyunca bulunan gerçek kenar noktalarına doğru uydurulur (Hough'un 1° adımlı açısından daha hassas)
function inceAyar(q, g, w, h) {
  const esik = Math.max(g.otsu * 0.22, 8), dogrular = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
    const nok = [];
    for (let k = 0; k < 80; k++) {
      const t = 0.08 + 0.84 * k / 79, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      let en = 0, ep = null;
      for (let o = -4; o <= 4; o++) {
        const x = Math.round(px + o * nx), y = Math.round(py + o * ny); if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const j = y * w + x, m = g[j]; if (m < esik || m <= en) continue;
        const gx = g.GX[j], gy = g.GY[j]; if (Math.abs(gx * nx + gy * ny) / (Math.hypot(gx, gy) || 1) < 0.7) continue;
        en = m; ep = [x, y];
      }
      if (ep) nok.push(ep);
    }
    if (nok.length < 20) { dogrular.push(null); continue; }
    // Toplam en küçük kareler (ana eksen)
    const mx = nok.reduce((s, p) => s + p[0], 0) / nok.length, my = nok.reduce((s, p) => s + p[1], 0) / nok.length;
    let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of nok) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const ac = 0.5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(ac), dy = Math.sin(ac);
    if (Math.abs(dx * ux + dy * uy) < 0.97) { dogrular.push(null); continue; }   // çok saptıysa güvenme
    dogrular.push({ p: [mx, my], d: [dx, dy] });
  }
  const kes = (A, B) => { const det = A.d[0] * B.d[1] - A.d[1] * B.d[0]; if (Math.abs(det) < 1e-6) return null; const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / det; return [A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]; };
  return q.map((k, i) => {
    const A = dogrular[(i + 3) % 4], B = dogrular[i];   // köşe i: önceki kenar ile sonraki kenarın kesişimi
    const p = A && B && kes(A, B);
    return p && Math.hypot(p[0] - k[0], p[1] - k[1]) < Math.min(w, h) * 0.06 ? p : k;
  });
}

// Dörtgenin dört kenarı boyunca fotoğrafta gerçek bir kenar var mı (kenara dik yönde değişim)
function puanla(q0, g, w, h) {
  const q = siraliKoseler(q0), n = w * h, A = Math.abs(alan(q));
  if (!(A > n * 0.02 && A < n * 0.985)) return 0;
  const L = [0, 1, 2, 3].map(i => Math.hypot(q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]));
  if (Math.min(...L) < Math.min(w, h) * 0.07) return 0;
  let isaret = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[(i + 3) % 4], o = q[i], b = q[(i + 1) % 4];
    const v1 = [a[0] - o[0], a[1] - o[1]], v2 = [b[0] - o[0], b[1] - o[1]];
    const aci = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1)))) * 180 / Math.PI;
    if (aci < 50 || aci > 130) return 0;
    const cr = Math.sign(v1[0] * v2[1] - v1[1] * v2[0]); if (isaret && cr !== isaret) return 0; isaret = cr;
  }
  const esik = Math.max(g.otsu * 0.22, 8), destek = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], ux = (b[0] - a[0]) / L[i], uy = (b[1] - a[1]) / L[i], nx = -uy, ny = ux;
    const sinirda = (Math.abs(a[0]) < 3 && Math.abs(b[0]) < 3) || (Math.abs(a[0] - w + 1) < 3 && Math.abs(b[0] - w + 1) < 3) || (Math.abs(a[1]) < 3 && Math.abs(b[1]) < 3) || (Math.abs(a[1] - h + 1) < 3 && Math.abs(b[1] - h + 1) < 3);
    if (sinirda) { destek.push(0.5); continue; }   // kart fotoğrafın kenarından taşmış
    const N = 40; let say = 0;
    for (let k = 0; k < N; k++) {
      const t = 0.07 + 0.86 * k / (N - 1), px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      for (let o = -3; o <= 3; o++) {
        const x = Math.round(px + o * nx), y = Math.round(py + o * ny); if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const j = y * w + x; if (g[j] < esik) continue;
        const gx = g.GX[j], gy = g.GY[j], m = Math.hypot(gx, gy) || 1;
        if (Math.abs(gx * nx + gy * ny) / m > 0.7) { say++; break; }
      }
    }
    destek.push(say / N);
  }
  const sirali = [...destek].sort((u, v) => u - v);
  if (sirali[0] < 0.2 || sirali[1] < 0.45) return 0;   // bir kenar parmakla kapanmış olabilir, ikisi olamaz
  const ort = destek.reduce((s, v) => s + v, 0) / 4;
  const W = (L[0] + L[2]) / 2, H = (L[1] + L[3]) / 2, r = Math.max(W, H) / Math.min(W, H);
  const oran = r >= 1.3 && r <= 2.05 ? 1 : r >= 1.1 && r <= 2.5 ? 0.8 : 0.55;
  const buyukluk = 0.55 + 0.45 * Math.min(1, Math.sqrt(A / n / 0.3));
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const orta = 1 - 0.3 * Math.min(1, Math.hypot(cx - w / 2, cy - h / 2) / Math.hypot(w / 2, h / 2));
  return ort * oran * buyukluk * orta;
}

// Hough dönüşümü: güçlü düz çizgiler → karşılıklı paralele yakın iki çift → dörtgen adayları
function houghAdaylari(g, w, h, kat = 0.7) {
  const esik = Math.max(g.otsu * kat, 10), T = 180, R = Math.ceil(Math.hypot(w, h)), RB = 2 * R + 1;
  const cs = new Float32Array(T), sn = new Float32Array(T);
  for (let t = 0; t < T; t++) { cs[t] = Math.cos(t * Math.PI / T); sn[t] = Math.sin(t * Math.PI / T); }
  const acc = new Uint16Array(T * RB);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x, m = g[i]; if (m < esik) continue;
    const gx = g.GX[i], gy = g.GY[i], ax = Math.abs(gx), ay = Math.abs(gy);
    // İnceltme: kenara dik yönde komşulardan zayıfsa atla
    let a, b;
    if (ax > 2.4 * ay) { a = g[i - 1]; b = g[i + 1]; } else if (ay > 2.4 * ax) { a = g[i - w]; b = g[i + w]; }
    else if (gx * gy > 0) { a = g[i - w - 1]; b = g[i + w + 1]; } else { a = g[i - w + 1]; b = g[i + w - 1]; }
    if (m < a || m < b) continue;
    let t0 = Math.round(Math.atan2(gy, gx) * T / Math.PI);
    for (let d = -8; d <= 8; d++) { const t = (((t0 + d) % T) + T) % T; const r = Math.round(x * cs[t] + y * sn[t]) + R; acc[t * RB + r]++; }
  }
  const cizgiler = [], enAz = Math.max(16, Math.min(w, h) * 0.1);
  for (let k = 0; k < 26; k++) {
    let en = 0, et = 0, er = 0;
    for (let i = 0; i < acc.length; i++) if (acc[i] > en) { en = acc[i]; et = (i / RB) | 0; er = i % RB; }
    if (en < enAz) break;
    cizgiler.push({ t: et, r: er - R });
    for (let d = -7; d <= 7; d++) {
      const tt = et + d, sar = tt < 0 || tt >= T, t = ((tt % T) + T) % T, rr = sar ? -(er - R) + R : er;
      for (let e = -12; e <= 12; e++) { const r = rr + e; if (r >= 0 && r < RB) acc[t * RB + r] = 0; }
    }
  }
  // Fotoğrafın kendi kenarları (kart taşmışsa)
  cizgiler.push({ t: 0, r: 0, s: 1 }, { t: 0, r: w - 1, s: 1 }, { t: 90, r: 0, s: 1 }, { t: 90, r: h - 1, s: 1 });
  const merkez = l => (w / 2) * cs[l.t] + (h / 2) * sn[l.t] - l.r;
  const ciftler = [];
  for (let i = 0; i < cizgiler.length; i++) for (let j = i + 1; j < cizgiler.length; j++) {
    const A = cizgiler[i], B = cizgiler[j], fark = Math.abs(A.t - B.t), d = Math.min(fark, T - fark);
    if (d > 25) continue;
    const ara = fark > 90 ? Math.abs(merkez(A) + merkez(B)) : Math.abs(merkez(A) - merkez(B));
    if (ara < Math.min(w, h) * 0.12) continue;
    ciftler.push([A, B, fark > 90 ? (A.t + B.t + T) / 2 % T : (A.t + B.t) / 2]);
  }
  const kes = (A, B) => { const det = cs[A.t] * sn[B.t] - sn[A.t] * cs[B.t]; if (Math.abs(det) < 1e-6) return null; return [(A.r * sn[B.t] - sn[A.t] * B.r) / det, (cs[A.t] * B.r - A.r * cs[B.t]) / det]; };
  const pay = 0.03, icinde = p => p && p[0] > -w * pay && p[0] < w * (1 + pay) && p[1] > -h * pay && p[1] < h * (1 + pay);
  const kirp = p => [Math.max(0, Math.min(w - 1, p[0])), Math.max(0, Math.min(h - 1, p[1]))];
  const sonuc = [];
  for (let i = 0; i < ciftler.length; i++) for (let j = i + 1; j < ciftler.length; j++) {
    const [A1, A2, ta] = ciftler[i], [B1, B2, tb] = ciftler[j], fark = Math.abs(ta - tb), d = Math.min(fark, T - fark);
    if (d < 45) continue;
    if (new Set([A1, A2, B1, B2]).size < 4) continue;
    const k = [kes(A1, B1), kes(A1, B2), kes(A2, B2), kes(A2, B1)];
    if (!k.every(icinde)) continue;
    sonuc.push(k.map(kirp));
  }
  return sonuc;
}
function otsu(g, n) {
  // Otsu eşiği (çok düşük eşik gürültüyü kenar sanmasın diye alt sınırlı)
  let mx = 0; for (let i = 0; i < n; i++) if (g[i] > mx) mx = g[i];
  const hist = new Float64Array(256); for (let i = 0; i < n; i++) hist[Math.min(255, Math.floor(g[i] / (mx || 1) * 255))]++;
  let top = 0; for (let i = 0; i < 256; i++) top += i * hist[i];
  let wB = 0, sB = 0, en = 0, esik = 40;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (top - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > en) { en = v; esik = t; } }
  return esik / 255 * mx;
}
function kenarHaritasi(g, w, h, kat) {
  const n = w * h, kesim = Math.max(g.otsu * kat, 10);
  const e = new Uint8Array(n); for (let i = 0; i < n; i++) e[i] = g[i] > kesim ? 1 : 0;
  // 1 piksel genişlet (kenar çizgisindeki kopukluklar kapanır)
  const d = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1) && !v; yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) if (e[yy * w + xx]) { v = 1; break; } d[y * w + x] = v; }
  return d;
}

function dortgenBul(kenar, w, h) {
  const n = w * h, bg = new Uint8Array(n), yigin = [];
  const it = i => { if (!bg[i] && !kenar[i]) { bg[i] = 1; yigin.push(i); } };
  for (let x = 0; x < w; x++) { it(x); it((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { it(y * w); it(y * w + w - 1); }
  while (yigin.length) { const i = yigin.pop(), x = i % w, y = (i / w) | 0; if (x > 0) it(i - 1); if (x < w - 1) it(i + 1); if (y > 0) it(i - w); if (y < h - 1) it(i + w); }
  // Arka plan olmayan en büyük parça
  const etiket = new Int32Array(n), boy = [0]; let en = 0, enId = 0;
  for (let s = 0; s < n; s++) {
    if (bg[s] || etiket[s]) continue;
    const id = boy.length; let say = 0; etiket[s] = id; yigin.push(s);
    while (yigin.length) { const i = yigin.pop(); say++; const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !bg[j] && !etiket[j]) { etiket[j] = id; yigin.push(j); } }
    boy.push(say); if (say > en) { en = say; enId = id; }
  }
  if (!enId || en < n * 0.08) return null;
  // Parçanın sınır noktaları
  const nok = [], kenarda = { s: 0, a: 0, l: 0, r: 0 };
  for (let y = 0; y < h; y++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (etiket[y * w + x] === enId) { if (a < 0) a = x; b = x; } if (a >= 0) { nok.push([a, y], [b, y]); if (a <= 1) kenarda.l++; if (b >= w - 2) kenarda.r++; } }
  for (let x = 0; x < w; x++) { if (etiket[x] === enId || etiket[w + x] === enId) kenarda.s++; if (etiket[(h - 1) * w + x] === enId || etiket[(h - 2) * w + x] === enId) kenarda.a++; }
  // Kart fotoğrafın kenarlarına yayılmışsa (çok yakından çekim ya da karışık zemin) güvenilir değil
  if (kenarda.l > h * 0.3 || kenarda.r > h * 0.3 || kenarda.s > w * 0.3 || kenarda.a > w * 0.3) return null;
  const zarf = disbukeyZarf(nok); if (zarf.length < 4) return null;
  const alanZ = Math.abs(alan(zarf));
  if (alanZ > n * 0.97) return null;
  // Zarfı saran en küçük dikdörtgen; köşelerine en yakın zarf noktaları
  let enIyi = null;
  for (let i = 0; i < zarf.length; i++) {
    const [ax, ay] = zarf[i], [bx, by] = zarf[(i + 1) % zarf.length], t = Math.atan2(by - ay, bx - ax), co = Math.cos(t), si = Math.sin(t);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of zarf) { const u = px * co + py * si, v = -px * si + py * co; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
    const a = (x1 - x0) * (y1 - y0); if (!enIyi || a < enIyi.a) enIyi = { a, co, si, x0, x1, y0, y1 };
  }
  const { co, si, x0, x1, y0, y1 } = enIyi;
  const geri = (u, v) => [u * co - v * si, u * si + v * co];
  const dk = [geri(x0, y0), geri(x1, y0), geri(x1, y1), geri(x0, y1)];
  let dort = dk.map(([cx, cy]) => zarf.reduce((m, p) => (p[0] - cx) ** 2 + (p[1] - cy) ** 2 < (m[0] - cx) ** 2 + (m[1] - cy) ** 2 ? p : m, zarf[0]));
  if (Math.abs(alan(dort)) < alanZ * 0.8) dort = dk;   // köşeler yuvarlaksa dikdörtgenin kendisi daha iyi
  return siraliKoseler(dort);
}
function disbukeyZarf(p) {
  const a = [...new Map(p.map(q => [q[0] + ',' + q[1], q])).values()].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  if (a.length < 3) return a;
  const cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  const alt = [], ust = [];
  for (const q of a) { while (alt.length >= 2 && cr(alt[alt.length - 2], alt[alt.length - 1], q) <= 0) alt.pop(); alt.push(q); }
  for (const q of [...a].reverse()) { while (ust.length >= 2 && cr(ust[ust.length - 2], ust[ust.length - 1], q) <= 0) ust.pop(); ust.push(q); }
  return alt.slice(0, -1).concat(ust.slice(0, -1));
}
const alan = p => p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;
// Sol üst, sağ üst, sağ alt, sol alt
export function siraliKoseler(p) {
  const m = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  const s = [...p].sort((a, b) => Math.atan2(a[1] - m[1], a[0] - m[0]) - Math.atan2(b[1] - m[1], b[0] - m[0]));
  let i0 = 0; s.forEach((q, i) => { if (q[0] + q[1] < s[i0][0] + s[i0][1]) i0 = i; });
  return [0, 1, 2, 3].map(k => s[(i0 + k) % 4]);
}
export const tumKoseler = c => [[0, 0], [c.width, 0], [c.width, c.height], [0, c.height]];
export const icKoseler = c => { const a = c.width * 0.08, b = c.height * 0.12; return [[a, b], [c.width - a, b], [c.width - a, c.height - b], [a, c.height - b]]; };

// ---------- Perspektif düzeltme ----------
export function homografi(kaynak, hedef) {   // hedef → kaynak eşlemesi (8 bilinmeyenli doğrusal sistem)
  const A = [], B = [];
  for (let i = 0; i < 4; i++) { const [x, y] = hedef[i], [u, v] = kaynak[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  return B.map((b, i) => b / A[i][i]);
}
export function duzle(kaynak, koseler, uzun = 1600) {
  const [tl, tr, br, bl] = koseler, u = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = (u(tl, tr) + u(bl, br)) / 2, H = (u(tl, bl) + u(tr, br)) / 2;
  const sc = uzun / Math.max(W, H); W = Math.max(40, Math.round(W * sc)); H = Math.max(40, Math.round(H * sc));
  const Hm = homografi(koseler, [[0, 0], [W, 0], [W, H], [0, H]]);
  const sx = kaynak.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, kaynak.width, kaynak.height), sp = sx.data, sw = kaynak.width, sh = kaynak.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d'), out = cx.createImageData(W, H), op = out.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Hm[6] * x + Hm[7] * y + 1, fx = (Hm[0] * x + Hm[1] * y + Hm[2]) / z, fy = (Hm[3] * x + Hm[4] * y + Hm[5]) / z;
    const x0 = Math.max(0, Math.min(sw - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(sh - 2, Math.floor(fy))), ax = Math.max(0, Math.min(1, fx - x0)), ay = Math.max(0, Math.min(1, fy - y0));
    const i = (y0 * sw + x0) * 4, o = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) op[o + k] = (sp[i + k] * (1 - ax) + sp[i + 4 + k] * ax) * (1 - ay) + (sp[i + sw * 4 + k] * (1 - ax) + sp[i + sw * 4 + 4 + k] * ax) * ay;
    op[o + 3] = 255;
  }
  cx.putImageData(out, 0, 0);
  return c;
}
export function dondur(kaynak, derece) {
  const d = ((derece % 360) + 360) % 360; if (!d) return kaynak;
  const c = document.createElement('canvas'); const yan = d === 90 || d === 270;
  c.width = yan ? kaynak.height : kaynak.width; c.height = yan ? kaynak.width : kaynak.height;
  const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(d * Math.PI / 180); x.drawImage(kaynak, -kaynak.width / 2, -kaynak.height / 2);
  return c;
}
// Fotoğraftan kartı kes; dikey çıkarsa yatay çevir (kartların çoğu yataydır, yön okuma sırasında ayrıca denetlenir)
export function kartiKes(kaynak, koseler) {
  // Kenarlarda zemin kalmasın diye çerçeveyi çok az içeri al
  const m = [koseler.reduce((s, q) => s + q[0], 0) / 4, koseler.reduce((s, q) => s + q[1], 0) / 4];
  const k = duzle(kaynak, koseler.map(([a, b]) => [a + (m[0] - a) * 0.012, b + (m[1] - b) * 0.012]));
  return k.height > k.width * 1.1 ? dondur(k, 90) : k;
}

// ---------- Kırpma ekranı ----------
// Döner: { blob } (kırpılmış kart), ya da null (vazgeçildi)
// Köşeler parmağın altında kalmasın diye sürüklerken büyüteç gösterilir; köşe parmağa zıplamaz, olduğu yerden kayar.
// Kenarların ortasındaki tutamaçlarla bütün bir kenar birlikte kaydırılabilir.
export async function kartvizitKirp(girdi, { koseler: verilen = null, onizle = false, kilavuz = false, tekrar = '' } = {}) {
  const kaynak = girdi instanceof HTMLCanvasElement ? girdi : await gorselYukle(girdi);
  let bulunan = verilen; if (!bulunan) try { bulunan = koseBul(kaynak); } catch (e) { console.warn('Köşe bulma', e); }
  let koseler = (bulunan || icKoseler(kaynak)).map(p => [...p]);
  return new Promise(res => {
    const kap = document.createElement('div'); kap.className = 'kirp'; kap.setAttribute('role', 'dialog'); kap.setAttribute('aria-modal', 'true'); kap.setAttribute('aria-label', 'Kartviziti çerçevele');
    kap.innerHTML = `<div class="kirp-ust-bar"><button type="button" class="btn sm ghost" data-iptal aria-label="İptal et">✕ İptal</button>${tekrar ? `<button type="button" class="btn sm ghost" data-tekrar>↺ ${tekrar}</button>` : ''}</div><div class="kirp-ust"><b data-baslik>Kartı çerçevele</b><small data-ipucu>${bulunan ? 'Kart bulundu. Çerçeve doğruysa “Kırp”a dokun.' : 'Kart bulunamadı. Sarı köşeleri kartın köşelerine sürükle.'}</small>${bulunan ? '<button type="button" class="linkbtn" data-yeniden hidden>Otomatik çerçeveye dön</button>' : ''}</div>
      <div class="kirp-sahne" data-sahne><canvas data-c></canvas><svg data-svg><polygon data-poli></polygon>${[0, 1, 2, 3].map(i => `<g data-o="${i}" class="kirp-orta"><circle r="9"></circle></g>`).join('')}${[0, 1, 2, 3].map(i => `<g data-k="${i}" class="kirp-kose"><circle r="18"></circle><circle r="3" class="nokta"></circle></g>`).join('')}</svg><canvas class="kirp-lup" data-lup width="260" height="260" hidden></canvas></div>
      <div class="kirp-alt" data-adim1><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="button" class="btn ghost" data-tum>Tüm fotoğraf</button><button type="button" class="btn primary" data-kes>Kırp</button></div>
      <div class="kirp-alt" data-adim2 hidden><button type="button" class="btn ghost" data-geri>Köşeleri düzelt</button><button type="button" class="btn ghost" data-don aria-label="90 derece döndür">↻ Döndür</button><button type="button" class="btn primary" data-kul>Kullan</button></div>`;
    document.body.appendChild(kap); document.body.classList.add('kirp-acik');
    const cv = kap.querySelector('[data-c]'), svg = kap.querySelector('[data-svg]'), sahne = kap.querySelector('[data-sahne]'), lup = kap.querySelector('[data-lup]');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let goster = kaynak, olcek = 1, sonuc = null, aci = 0;
    const ciz = () => {
      const r = sahne.getBoundingClientRect(); olcek = Math.min(r.width / goster.width, r.height / goster.height, 1.5);
      const gw = Math.round(goster.width * olcek), gh = Math.round(goster.height * olcek);
      cv.width = Math.round(gw * dpr); cv.height = Math.round(gh * dpr); cv.style.width = gw + 'px'; cv.style.height = gh + 'px';
      const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(goster, 0, 0, cv.width, cv.height);
      svg.setAttribute('width', gw); svg.setAttribute('height', gh); svg.style.display = goster === kaynak ? '' : 'none';
      cerceve();
    };
    const orta = i => { const a = koseler[i], b = koseler[(i + 1) % 4]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const cerceve = () => {
      kap.querySelector('[data-poli]').setAttribute('points', koseler.map(([a, b]) => `${a * olcek},${b * olcek}`).join(' '));
      kap.querySelectorAll('[data-k]').forEach((k, i) => k.setAttribute('transform', `translate(${koseler[i][0] * olcek},${koseler[i][1] * olcek})`));
      kap.querySelectorAll('[data-o]').forEach((k, i) => { const [a, b] = orta(i); k.setAttribute('transform', `translate(${a * olcek},${b * olcek})`); });
    };
    // Büyüteç: sürüklenen noktanın çevresi 3 kat büyük, köşenin tam yeri artı işaretiyle
    const buyutec = nokta => {
      const r = svg.getBoundingClientRect(), sag = nokta[0] * olcek < r.width / 2;
      lup.hidden = false; lup.style.left = sag ? '' : '8px'; lup.style.right = sag ? '8px' : '';
      const x = lup.getContext('2d'), L = lup.width, z = 3 * olcek * dpr, kw = L / z;
      x.fillStyle = '#10181E'; x.fillRect(0, 0, L, L);
      x.drawImage(kaynak, nokta[0] - kw / 2, nokta[1] - kw / 2, kw, kw, 0, 0, L, L);
      x.strokeStyle = '#FFC400'; x.lineWidth = 3; x.beginPath();
      koseler.forEach((p, i) => { const px = (p[0] - nokta[0]) * z + L / 2, py = (p[1] - nokta[1]) * z + L / 2; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); x.stroke();
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(L / 2 - 18, L / 2); x.lineTo(L / 2 + 18, L / 2); x.moveTo(L / 2, L / 2 - 18); x.lineTo(L / 2, L / 2 + 18); x.stroke();
    };
    let surukle = null;
    const konum = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / olcek, (e.clientY - r.top) / olcek]; };
    svg.addEventListener('pointerdown', e => {
      const p = konum(e); let en = Infinity, sec = null;
      koseler.forEach((k, i) => { const d = Math.hypot(k[0] - p[0], k[1] - p[1]) * olcek; if (d < en) { en = d; sec = { tur: 'k', i }; } });
      [0, 1, 2, 3].forEach(i => { const o = orta(i), d = Math.hypot(o[0] - p[0], o[1] - p[1]) * olcek + 12; if (d < en) { en = d; sec = { tur: 'o', i }; } });   // köşe öncelikli
      if (en > 64) return;
      surukle = { ...sec, bas: p, eski: koseler.map(k => [...k]) };
      svg.setPointerCapture(e.pointerId); e.preventDefault();
      kap.querySelectorAll('.etkin').forEach(x => x.classList.remove('etkin'));
      kap.querySelector(sec.tur === 'k' ? `[data-k="${sec.i}"]` : `[data-o="${sec.i}"]`).classList.add('etkin');
      buyutec(sec.tur === 'k' ? koseler[sec.i] : orta(sec.i));
    });
    const sinir = ([a, b]) => [Math.max(0, Math.min(kaynak.width, a)), Math.max(0, Math.min(kaynak.height, b))];
    svg.addEventListener('pointermove', e => {
      if (!surukle) return; e.preventDefault();
      const p = konum(e), dx = p[0] - surukle.bas[0], dy = p[1] - surukle.bas[1], es = surukle.eski;
      if (surukle.tur === 'k') { koseler[surukle.i] = sinir([es[surukle.i][0] + dx, es[surukle.i][1] + dy]); buyutec(koseler[surukle.i]); }
      else { const i = surukle.i, j = (i + 1) % 4; koseler[i] = sinir([es[i][0] + dx, es[i][1] + dy]); koseler[j] = sinir([es[j][0] + dx, es[j][1] + dy]); buyutec(orta(i)); }
      cerceve();
      const y = kap.querySelector('[data-yeniden]'); if (y) y.hidden = false;
    });
    const birak = () => { if (surukle) koseler = siraliKoseler(koseler); surukle = null; lup.hidden = true; kap.querySelectorAll('.etkin').forEach(x => x.classList.remove('etkin')); cerceve(); };
    svg.addEventListener('pointerup', birak); svg.addEventListener('pointercancel', birak);
    const kapat = v => { window.removeEventListener('resize', ciz); kap.remove(); document.body.classList.remove('kirp-acik'); res(v); };
    const adim = n => { kap.querySelector('[data-adim1]').hidden = n !== 1; kap.querySelector('[data-adim2]').hidden = n !== 2;
      kap.querySelector('[data-baslik]').textContent = n === 1 ? 'Kartı çerçevele' : 'Kart böyle kaydedilecek';
      kap.querySelector('[data-ipucu]').textContent = n === 1 ? 'Sarı köşeleri kartın köşelerine sürükle. Kenar ortasındaki noktalar bütün kenarı kaydırır.' : 'Yazılar ters ya da yan duruyorsa “Döndür”e dokun.'; };
    kap.querySelector('[data-yeniden]')?.addEventListener('click', e => { koseler = bulunan.map(p => [...p]); e.target.hidden = true; cerceve(); });
    kap.querySelector('[data-vaz]').onclick = () => kapat(null);
    kap.querySelector('[data-iptal]').onclick = () => kapat(null);
    kap.querySelector('[data-tekrar]')?.addEventListener('click', () => kapat({ tekrar: true }));
    kap.querySelector('[data-tum]').onclick = () => { koseler = tumKoseler(kaynak); cerceve(); const y = kap.querySelector('[data-yeniden]'); if (y) y.hidden = false; };
    kap.querySelector('[data-kes]').onclick = () => { sonuc = kartiKes(kaynak, koseler); aci = 0; goster = sonuc; adim(2); ciz(); };
    kap.querySelector('[data-geri]').onclick = () => { goster = kaynak; adim(1); ciz(); };
    kap.querySelector('[data-don]').onclick = () => { aci = (aci + 90) % 360; goster = dondur(sonuc, aci); ciz(); };
    kap.querySelector('[data-kul]').onclick = async e => { e.target.disabled = true; const blob = await blobYap(goster); kapat({ blob, elle: aci !== 0 }); };
    kap.addEventListener('keydown', e => { if (e.key === 'Escape') kapat(null); });
    window.addEventListener('resize', ciz);
    requestAnimationFrame(() => { ciz(); if (onizle) { kap.querySelector('[data-kes]').click(); if (kilavuz) kap.querySelector('[data-ipucu]').textContent = 'Kartın kenarları bulunamadı, çerçevenin içi kesildi. Gerekirse “Köşeleri düzelt”e dokun.'; } });
    kap.querySelector('[data-kes]').focus();
  });
}
// Fotoğraf seç/çek → kırp → yüklenecek dosya (vazgeçilirse null)
export async function kartvizitFotografi(capture) {
  const { pickFiles, toast } = await import('./ui.js');
  const dosyaYap = r => r && { dosya: new File([r.blob], 'kartvizit.jpg', { type: 'image/jpeg' }), elle: r.elle };
  // Çek: uygulamanın kendi kamerası (yalnızca arka kamera, kart çerçevesi, kendiliğinden çekim).
  // Önizlemede “Yeniden çek” kameraya geri döner, “İptal” hiçbir şey kaydetmeden kapatır.
  if (capture) {
    const { kameraVarMi, kartvizitCek } = await import('./kamera.js');
    if (kameraVarMi()) {
      for (;;) {
        let c = null;
        try { c = await kartvizitCek(); }
        catch (e) {
          document.querySelector('.kam')?.remove(); document.body.classList.remove('kirp-acik');
          toast(e?.name === 'NotAllowedError' ? 'Kamera izni verilmedi; telefonun kamerası açılıyor. İzni tarayıcı ayarlarından açabilirsin.' : 'Kamera açılamadı; telefonun kamerası kullanılacak.', 'err');
          break;
        }
        if (!c) return null;
        if (c.yerli) break;   // telefonun kendi kamera uygulamasıyla çek
        const r = await kartvizitKirp(c.tuval, { koseler: c.koseler, onizle: true, kilavuz: c.kilavuz, tekrar: 'Yeniden çek' });
        if (r?.tekrar) continue;
        return dosyaYap(r);
      }
    }
  }
  for (;;) {
    const [file] = await pickFiles({ capture, multiple: false }); if (!file) return null;
    try { const r = await kartvizitKirp(file, { tekrar: capture ? 'Yeniden çek' : 'Başka fotoğraf' }); if (r?.tekrar) continue; return dosyaYap(r); }
    catch (e) { toast('Kırpılamadı, fotoğraf olduğu gibi kullanılacak: ' + e.message, 'err'); return { dosya: file, elle: false }; }
  }
}
