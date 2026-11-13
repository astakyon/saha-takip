// Uygulama içi kartvizit kamerası: yalnızca arka kamera açılır, ekranda kartvizit biçiminde bir çerçeve görünür.
// Kart canlı olarak aranır; bulununca çerçeve yeşile döner ve kart sabit durunca kendiliğinden çekilir.
// Kartın kenarları bulunamazsa çerçevenin içi kesilir. Kamera açılamazsa telefonun kendi kamerasına dönülür.
import { koseBul, gorselYukle, dondur } from './kirp.js';

const ORAN = 1.6;   // kartvizit en/boy (85 × 55 mm)

export const kameraVarMi = () => !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

async function akisAc() {
  const istek = ex => ({ audio: false, video: { facingMode: ex ? { exact: 'environment' } : 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } } });
  try { return await navigator.mediaDevices.getUserMedia(istek(true)); }
  catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e;
    return await navigator.mediaDevices.getUserMedia(istek(false));   // arka kamerası olmayan cihaz (bilgisayar)
  }
}

// Döner: { tuval, koseler, kilavuz } ya da null (vazgeçildi). Kamera açılamazsa hata fırlatır (çağıran yedek yola geçer).
export async function kartvizitCek() {
  const akis = await akisAc();
  return new Promise(res => {
    const kap = document.createElement('div'); kap.className = 'kam'; kap.setAttribute('role', 'dialog'); kap.setAttribute('aria-modal', 'true'); kap.setAttribute('aria-label', 'Kartvizit çek');
    kap.innerHTML = `<video playsinline muted autoplay></video><canvas class="kam-ust" data-ust></canvas>
      <div class="kam-ipucu" data-ipucu aria-live="polite">Kartı çerçeveye yerleştir · telefonu ~20 cm uzak tut</div>
      <div class="kam-alt"><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="button" class="kam-dek" data-cek aria-label="Fotoğraf çek"></button><button type="button" class="btn ghost" data-isik hidden aria-label="Işık">Işık</button></div>`;
    document.body.appendChild(kap); document.body.classList.add('kirp-acik');
    const v = kap.querySelector('video'), ust = kap.querySelector('[data-ust]'), ipucu = kap.querySelector('[data-ipucu]');
    v.srcObject = akis;
    const iz = akis.getVideoTracks()[0];
    let bitti = false, son = null, sabit = 0, zaman = null, isik = false; const netler = [];
    const kapat = sonuc => { if (bitti) return; bitti = true; clearTimeout(zaman); akis.getTracks().forEach(t => t.stop()); kap.remove(); document.body.classList.remove('kirp-acik'); res(sonuc); };
    // Sürekli otomatik odak (destekleyen telefonlarda)
    try { const yet = iz.getCapabilities?.() || {}; if ((yet.focusMode || []).includes('continuous')) iz.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}); } catch {}
    try { if (iz.getCapabilities?.().torch) { const b = kap.querySelector('[data-isik]'); b.hidden = false; b.onclick = async () => { isik = !isik; try { await iz.applyConstraints({ advanced: [{ torch: isik }] }); b.classList.toggle('on', isik); } catch {} }; } } catch {}

    // Ekran ↔ görüntü eşlemesi (video ekranı kaplar, taşan kısım kesilir)
    const eslem = () => { const W = kap.clientWidth, H = kap.clientHeight, vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, H / vh); return { W, H, s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2 }; };
    const kilavuz = () => { const { W, H } = eslem(), alt = 150, ustB = 70, enW = W * 0.72, enH = (H - alt - ustB) * 0.9;
      let w = enW, h = w / ORAN; if (h > enH) { h = enH; w = h * ORAN; } const x = (W - w) / 2, y = ustB + (H - alt - ustB - h) / 2; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; };
    const ekrandanGoruntuye = q => { const m = eslem(); return q.map(([a, b]) => [Math.max(0, Math.min(v.videoWidth, (a - m.ox) / m.s)), Math.max(0, Math.min(v.videoHeight, (b - m.oy) / m.s))]); };
    const goruntudenEkrana = q => { const m = eslem(); return q.map(([a, b]) => [a * m.s + m.ox, b * m.s + m.oy]); };
    const ciz = bulunan => {
      const { W, H } = eslem(), dpr = Math.min(2, devicePixelRatio || 1);
      if (ust.width !== Math.round(W * dpr)) { ust.width = Math.round(W * dpr); ust.height = Math.round(H * dpr); }
      const x = ust.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      const k = kilavuz();
      x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.rect(0, 0, W, H); x.moveTo(...k[0]); k.slice(1).forEach(p => x.lineTo(...p)); x.closePath(); x.fill('evenodd');
      x.strokeStyle = bulunan ? 'rgba(255,255,255,.5)' : '#fff'; x.lineWidth = 2; x.setLineDash(bulunan ? [6, 6] : []); x.strokeRect(k[0][0], k[0][1], k[1][0] - k[0][0], k[3][1] - k[0][1]); x.setLineDash([]);
      if (bulunan) { const q = goruntudenEkrana(bulunan); x.strokeStyle = '#2ECC71'; x.lineWidth = 4; x.fillStyle = 'rgba(46,204,113,.15)'; x.beginPath(); q.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fill(); x.stroke(); }
    };
    const kare = (enBuyuk = 0) => { const c = document.createElement('canvas'), sc = enBuyuk ? Math.min(1, enBuyuk / Math.max(v.videoWidth, v.videoHeight)) : 1; c.width = Math.round(v.videoWidth * sc); c.height = Math.round(v.videoHeight * sc); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); c.olcek = sc; return c; };
    // Çekim: önce kameranın asıl fotoğraf modu (tam çözünürlük, odaklanarak); olmazsa birkaç video karesinden en keskini
    let cekiliyor = false;
    const cek = async () => {
      if (bitti || cekiliyor || !v.videoWidth) return; cekiliyor = true;
      ipucu.textContent = 'Çekiliyor, kıpırdatma…'; kap.classList.add('cekiyor');
      const ref = kare(); let t = null;
      try {
        if ('ImageCapture' in window) {
          const ic = new window.ImageCapture(iz);
          let blob = null; try { blob = await ic.takePhoto(isik ? { fillLightMode: 'flash' } : {}); } catch { blob = await ic.takePhoto(); }
          const foto = yonEsle(await gorselYukle(blob, 3200), ref);
          if (foto && Math.max(foto.width, foto.height) > Math.max(ref.width, ref.height)) t = foto;
        }
      } catch (e) { console.warn('takePhoto', e); }
      if (!t) {   // video karelerinden en keskini
        let en = ref, enK = keskinlik(ref);
        for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 110)); const k = kare(), d = keskinlik(k); if (d > enK) { en = k; enK = d; } }
        t = en;
      }
      if (bitti) return;
      // Video koordinatları → fotoğraf koordinatları (fotoğraf genelde daha geniş açılı ve daha büyük)
      const s2 = Math.min(t.width / v.videoWidth, t.height / v.videoHeight), ox = (t.width - v.videoWidth * s2) / 2, oy = (t.height - v.videoHeight * s2) / 2;
      const donustur = q => q.map(([a, b]) => [a * s2 + ox, b * s2 + oy]);
      let koseler = null; try { koseler = koseBul(t); } catch {}
      if (!koseler && son) koseler = donustur(son);
      kapat(koseler ? { tuval: t, koseler, kilavuz: false } : { tuval: t, koseler: donustur(ekrandanGoruntuye(kilavuz())), kilavuz: true });
    };
    kap.querySelector('[data-cek]').onclick = cek;
    kap.querySelector('[data-vaz]').onclick = () => kapat(null);
    kap.addEventListener('keydown', e => { if (e.key === 'Escape') kapat(null); });
    // Canlı arama: kart bulunup ~1 saniye kıpırdamazsa kendiliğinden çek
    const ara = () => {
      if (bitti) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const k = kare(360); let q = null;
        try { q = koseBul(k, { M: 360 }); } catch {}
        q = q && q.map(([a, b]) => [a / k.olcek, b / k.olcek]);
        if (q) {
          const kayma = son ? Math.max(...q.map((p, i) => Math.hypot(p[0] - son[i][0], p[1] - son[i][1]))) / Math.max(v.videoWidth, v.videoHeight) : 1;
          const net = keskinlik(k); netler.push(net); if (netler.length > 8) netler.shift();
          const odakta = net >= Math.max(...netler) * 0.8;   // odak arıyorsa bekle
          sabit = kayma < 0.025 && odakta ? sabit + 1 : 0;
          ipucu.textContent = sabit >= 2 ? 'Kart bulundu, kıpırdatma…' : odakta ? 'Kart bulundu' : 'Netleşiyor…';
        } else { sabit = 0; ipucu.textContent = 'Kartı çerçeveye yerleştir · telefonu ~20 cm uzak tut'; }
        son = q; ciz(q);
        if (sabit >= 3) { cek(); return; }
      } else ciz(null);
      zaman = setTimeout(ara, 280);
    };
    v.addEventListener('loadedmetadata', () => { ciz(null); zaman = setTimeout(ara, 600); }, { once: true });
    window.addEventListener('resize', () => !bitti && ciz(son), { passive: true });
    kap.querySelector('[data-cek]').focus();
  });
}

// Keskinlik: gri tonda Laplace değerlerinin varyansı (bulanık görüntüde düşük)
export function keskinlik(kaynak) {
  const M = 320, sc = Math.min(1, M / Math.max(kaynak.width, kaynak.height)), w = Math.max(4, Math.round(kaynak.width * sc)), h = Math.max(4, Math.round(kaynak.height * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(kaynak, 0, 0, w, h);
  const p = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * p[i * 4] + 0.587 * p[i * 4 + 1] + 0.114 * p[i * 4 + 2];
  let t = 0, t2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx, l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]; t += l; t2 += l * l; n++; }
  return n ? t2 / n - (t / n) ** 2 : 0;
}
// Fotoğraf modunun verdiği görüntü, ekrandaki video ile aynı yönde olmayabilir: küçük kopyaları karşılaştırıp doğru yöne çevir
function yonEsle(foto, ref) {
  const kucuk = (src, d) => { const r = dondur(src, d), c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d', { willReadFrequently: true });
    const s = Math.min(r.width, r.height), sx = (r.width - s) / 2, sy = (r.height - s) / 2; x.drawImage(r, sx, sy, s, s, 0, 0, 48, 48);
    const p = x.getImageData(0, 0, 48, 48).data, g = new Float32Array(48 * 48); let m = 0; for (let i = 0; i < g.length; i++) { g[i] = p[i * 4] + p[i * 4 + 1] + p[i * 4 + 2]; m += g[i]; } m /= g.length; for (let i = 0; i < g.length; i++) g[i] -= m; return g; };
  const yatayRef = ref.width >= ref.height, a = kucuk(ref, 0);
  const kucukFoto = document.createElement('canvas'); { const sc = 160 / Math.max(foto.width, foto.height); kucukFoto.width = Math.round(foto.width * sc); kucukFoto.height = Math.round(foto.height * sc); kucukFoto.getContext('2d').drawImage(foto, 0, 0, kucukFoto.width, kucukFoto.height); }
  let en = 0, enD = -Infinity;
  for (const d of [0, 90, 180, 270]) {
    const yatay = (d % 180 === 0) === (foto.width >= foto.height); if (yatay !== yatayRef) continue;
    const b = kucuk(kucukFoto, d); let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    if (s > enD) { enD = s; en = d; }
  }
  return dondur(foto, en);
}
