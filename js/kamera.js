// Uygulama içi kartvizit kamerası: yalnızca arka kamera açılır, ekranda kartvizit biçiminde bir çerçeve görünür.
// Kart canlı olarak aranır; bulununca çerçeve yeşile döner ve kart sabit durunca kendiliğinden çekilir.
// Kartın kenarları bulunamazsa çerçevenin içi kesilir. Kamera açılamazsa telefonun kendi kamerasına dönülür.
import { koseBul } from './kirp.js';

const ORAN = 1.6;   // kartvizit en/boy (85 × 55 mm)

export const kameraVarMi = () => !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

async function akisAc() {
  const istek = ex => ({ audio: false, video: { facingMode: ex ? { exact: 'environment' } : 'environment', width: { ideal: 2560 }, height: { ideal: 1440 } } });
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
      <div class="kam-ipucu" data-ipucu aria-live="polite">Kartı çerçevenin içine yerleştir</div>
      <div class="kam-alt"><button type="button" class="btn ghost" data-vaz>Vazgeç</button><button type="button" class="kam-dek" data-cek aria-label="Fotoğraf çek"></button><button type="button" class="btn ghost" data-isik hidden aria-label="Işık">Işık</button></div>`;
    document.body.appendChild(kap); document.body.classList.add('kirp-acik');
    const v = kap.querySelector('video'), ust = kap.querySelector('[data-ust]'), ipucu = kap.querySelector('[data-ipucu]');
    v.srcObject = akis;
    const iz = akis.getVideoTracks()[0];
    let bitti = false, son = null, sabit = 0, zaman = null, isik = false;
    const kapat = sonuc => { if (bitti) return; bitti = true; clearTimeout(zaman); akis.getTracks().forEach(t => t.stop()); kap.remove(); document.body.classList.remove('kirp-acik'); res(sonuc); };
    try { if (iz.getCapabilities?.().torch) { const b = kap.querySelector('[data-isik]'); b.hidden = false; b.onclick = async () => { isik = !isik; try { await iz.applyConstraints({ advanced: [{ torch: isik }] }); b.classList.toggle('on', isik); } catch {} }; } } catch {}

    // Ekran ↔ görüntü eşlemesi (video ekranı kaplar, taşan kısım kesilir)
    const eslem = () => { const W = kap.clientWidth, H = kap.clientHeight, vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, H / vh); return { W, H, s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2 }; };
    const kilavuz = () => { const { W, H } = eslem(), alt = 150, ustB = 70, enW = W * 0.88, enH = (H - alt - ustB) * 0.9;
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
    const cek = () => {
      if (bitti || !v.videoWidth) return;
      const t = kare();
      let koseler = null; try { koseler = koseBul(t); } catch {}
      // Canlıda bulunan çerçeve büyük görüntüde bulunamadıysa canlı sonucu kullan
      if (!koseler && son) koseler = son.map(p => [...p]);
      kapat(koseler ? { tuval: t, koseler, kilavuz: false } : { tuval: t, koseler: ekrandanGoruntuye(kilavuz()), kilavuz: true });
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
          sabit = kayma < 0.025 ? sabit + 1 : 0;
          ipucu.textContent = sabit >= 2 ? 'Kart bulundu, kıpırdatma…' : 'Kart bulundu';
        } else { sabit = 0; ipucu.textContent = 'Kartı çerçevenin içine yerleştir'; }
        son = q; ciz(q);
        if (sabit >= 3) return cek();
      } else ciz(null);
      zaman = setTimeout(ara, 280);
    };
    v.addEventListener('loadedmetadata', () => { ciz(null); zaman = setTimeout(ara, 600); }, { once: true });
    window.addEventListener('resize', () => !bitti && ciz(son), { passive: true });
    kap.querySelector('[data-cek]').focus();
  });
}
