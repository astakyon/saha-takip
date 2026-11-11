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
// Kenar haritası → kenarlardan arka planı doldur → kenarlara değmeyen en büyük parça kart → dışbükey zarf → en küçük dikdörtgene en yakın 4 köşe.
export function koseBul(kaynak) {
  const M = 420, sc = Math.min(1, M / Math.max(kaynak.width, kaynak.height));
  const w = Math.max(8, Math.round(kaynak.width * sc)), h = Math.max(8, Math.round(kaynak.height * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(kaynak, 0, 0, w, h);
  const g = egim(x.getImageData(0, 0, w, h).data, w, h);
  // Önce belirgin kenarlarla; kart zemine yakın renkteyse (beyaz kart, açık masa) daha hassas eşiklerle tekrar dene
  for (const kat of [1, 0.55, 0.3]) {
    const sonuc = dortgenBul(kenarHaritasi(g, w, h, kat), w, h);
    if (sonuc) return sonuc.map(([a, b]) => [a / sc, b / sc]);
  }
  return null;
}

function egim(p, w, h) {
  const n = w * h, kanal = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) { kanal[0][i] = p[i * 4]; kanal[1][i] = p[i * 4 + 1]; kanal[2][i] = p[i * 4 + 2]; }
  const bul = k => { const t = new Float32Array(n), o = new Float32Array(n), r = 2;   // 5x5 kutu bulanıklığı (ayrılabilir)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, m = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += k[y * w + xx]; m++; } } t[y * w + x] = s / m; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, m = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += t[yy * w + x]; m++; } } o[y * w + x] = s / m; }
    return o; };
  const b = kanal.map(bul), g = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let enb = 0;
    for (const k of b) {
      const gx = k[i - w + 1] + 2 * k[i + 1] + k[i + w + 1] - k[i - w - 1] - 2 * k[i - 1] - k[i + w - 1];
      const gy = k[i + w - 1] + 2 * k[i + w] + k[i + w + 1] - k[i - w - 1] - 2 * k[i - w] - k[i - w + 1];
      const m = Math.abs(gx) + Math.abs(gy); if (m > enb) enb = m;
    }
    g[i] = enb;
  }
  g.otsu = otsu(g, n);
  return g;
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
function homografi(kaynak, hedef) {   // hedef → kaynak eşlemesi (8 bilinmeyenli doğrusal sistem)
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
export async function kartvizitKirp(dosya) {
  const kaynak = await gorselYukle(dosya);
  let koseler = null; try { koseler = koseBul(kaynak); } catch (e) { console.warn('Köşe bulma', e); }
  const bulundu = !!koseler; koseler ||= icKoseler(kaynak);
  return new Promise(res => {
    const kap = document.createElement('div'); kap.className = 'kirp'; kap.setAttribute('role', 'dialog'); kap.setAttribute('aria-modal', 'true'); kap.setAttribute('aria-label', 'Kartviziti çerçevele');
    kap.innerHTML = `<div class="kirp-ust"><b data-baslik>Kartı çerçevele</b><small data-ipucu>${bulundu ? 'Kartı bulduk. Gerekirse köşeleri sürükleyerek düzelt.' : 'Kartı bulamadık. Dört köşeyi kartın köşelerine sürükle.'}</small></div>
      <div class="kirp-sahne" data-sahne><canvas data-c></canvas><svg data-svg><polygon data-poli></polygon>${[0, 1, 2, 3].map(i => `<circle data-k="${i}" r="14"></circle>`).join('')}</svg></div>
      <div class="kirp-alt" data-adim1><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="button" class="btn ghost" data-tum>Tüm fotoğraf</button><button type="button" class="btn primary" data-kes>Kırp</button></div>
      <div class="kirp-alt" data-adim2 hidden><button type="button" class="btn ghost" data-geri>Geri</button><button type="button" class="btn ghost" data-don aria-label="90 derece döndür">↻ Döndür</button><button type="button" class="btn primary" data-kul>Kullan</button></div>`;
    document.body.appendChild(kap); document.body.classList.add('kirp-acik');
    const cv = kap.querySelector('[data-c]'), svg = kap.querySelector('[data-svg]'), sahne = kap.querySelector('[data-sahne]');
    let goster = kaynak, olcek = 1, sonuc = null, aci = 0;
    const ciz = () => {
      const r = sahne.getBoundingClientRect(); olcek = Math.min(r.width / goster.width, r.height / goster.height, 1.5);
      cv.width = Math.round(goster.width * olcek); cv.height = Math.round(goster.height * olcek);
      cv.getContext('2d').drawImage(goster, 0, 0, cv.width, cv.height);
      svg.setAttribute('width', cv.width); svg.setAttribute('height', cv.height); svg.style.display = goster === kaynak ? '' : 'none';
      cerceve();
    };
    const cerceve = () => {
      kap.querySelector('[data-poli]').setAttribute('points', koseler.map(([a, b]) => `${a * olcek},${b * olcek}`).join(' '));
      kap.querySelectorAll('[data-k]').forEach((k, i) => { k.setAttribute('cx', koseler[i][0] * olcek); k.setAttribute('cy', koseler[i][1] * olcek); });
    };
    let surukle = -1;
    svg.addEventListener('pointerdown', e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / olcek, py = (e.clientY - r.top) / olcek;
      let en = Infinity; koseler.forEach(([a, b], i) => { const d = Math.hypot(a - px, b - py); if (d < en) { en = d; surukle = i; } });
      if (en * olcek > 60) { surukle = -1; return; }
      svg.setPointerCapture(e.pointerId); e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (surukle < 0) return; const r = svg.getBoundingClientRect();
      koseler[surukle] = [Math.max(0, Math.min(kaynak.width, (e.clientX - r.left) / olcek)), Math.max(0, Math.min(kaynak.height, (e.clientY - r.top) / olcek))]; cerceve();
    });
    const birak = () => { if (surukle >= 0) koseler = siraliKoseler(koseler); surukle = -1; cerceve(); };
    svg.addEventListener('pointerup', birak); svg.addEventListener('pointercancel', birak);
    const kapat = v => { window.removeEventListener('resize', ciz); kap.remove(); document.body.classList.remove('kirp-acik'); res(v); };
    const adim = n => { kap.querySelector('[data-adim1]').hidden = n !== 1; kap.querySelector('[data-adim2]').hidden = n !== 2;
      kap.querySelector('[data-baslik]').textContent = n === 1 ? 'Kartı çerçevele' : 'Kart böyle kaydedilecek';
      kap.querySelector('[data-ipucu]').textContent = n === 1 ? 'Köşeleri kartın köşelerine sürükle.' : 'Yazılar ters ya da yan duruyorsa “Döndür”e dokun.'; };
    kap.querySelector('[data-vaz]').onclick = () => kapat(null);
    kap.querySelector('[data-tum]').onclick = () => { koseler = tumKoseler(kaynak); cerceve(); };
    kap.querySelector('[data-kes]').onclick = () => { sonuc = kartiKes(kaynak, koseler); aci = 0; goster = sonuc; adim(2); ciz(); };
    kap.querySelector('[data-geri]').onclick = () => { goster = kaynak; adim(1); ciz(); };
    kap.querySelector('[data-don]').onclick = () => { aci = (aci + 90) % 360; goster = dondur(sonuc, aci); ciz(); };
    kap.querySelector('[data-kul]').onclick = async e => { e.target.disabled = true; const blob = await blobYap(goster); kapat({ blob, elle: aci !== 0 }); };
    kap.addEventListener('keydown', e => { if (e.key === 'Escape') kapat(null); });
    window.addEventListener('resize', ciz);
    requestAnimationFrame(ciz);
    kap.querySelector('[data-kes]').focus();
  });
}
// Fotoğraf seç/çek → kırp → yüklenecek dosya (vazgeçilirse null)
export async function kartvizitFotografi(capture) {
  const { pickFiles, toast } = await import('./ui.js');
  const [file] = await pickFiles({ capture, multiple: false }); if (!file) return null;
  try { const r = await kartvizitKirp(file); return r && { dosya: new File([r.blob], 'kartvizit.jpg', { type: 'image/jpeg' }), elle: r.elle }; }
  catch (e) { toast('Kırpılamadı, fotoğraf olduğu gibi kullanılacak: ' + e.message, 'err'); return { dosya: file, elle: false }; }
}
