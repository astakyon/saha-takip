// Telefona uygulama olarak yükleme ("Uygulamayı yükle") ve ana ekran kısayolları (?act=...)
import { toast } from './ui.js';

export const INST = { evt: null, standalone: false };
try { INST.standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches || navigator.standalone === true; } catch {}
const ua = navigator.userAgent || '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

const listeners = new Set();
export const onInstallChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => { listeners.forEach(f => { try { f(); } catch {} }); banner(); };

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST.evt = e; changed(); });
window.addEventListener('appinstalled', () => { INST.evt = null; INST.standalone = true; changed(); toast('Yüklendi. Ana ekranında “Saha Takip” simgesi var.'); });

// Yüklenebilir mi (Android Chrome / bilgisayarda Chrome-Edge istemi var ya da iPhone'da elle eklenebilir)
export const canInstall = () => !INST.standalone && (!!INST.evt || isIOS);

export async function install() {
  if (INST.standalone) return toast('Uygulama zaten yüklü; ana ekrandaki simgeden açıyorsun.');
  if (INST.evt) {
    const e = INST.evt; INST.evt = null;
    try { e.prompt(); const c = await e.userChoice; if (c?.outcome === 'accepted') toast('Yükleniyor. Ana ekranında “Saha Takip” simgesi çıkacak.'); } catch {}
    changed(); return;
  }
  if (isIOS) return toast(isIOSSafari ? 'iPhone: alttaki Paylaş düğmesine dokun → “Ana Ekrana Ekle”.' : 'iPhone\'da yüklemek için bu adresi Safari\'de aç, sonra Paylaş → “Ana Ekrana Ekle”.');
  toast('Chrome menüsünden (⋮) “Uygulamayı yükle” veya “Ana ekrana ekle”yi seç.');
}

// İlk açılışta bir kez görünen, kapatılabilen yükleme şeridi
const KEY = 'saha-kurulum-kapat';
function banner() {
  let b = document.getElementById('inst-banner');
  let dismissed = false; try { dismissed = localStorage.getItem(KEY) === '1'; } catch {}
  const show = canInstall() && !dismissed && !document.querySelector('.login');
  if (!show) { b?.remove(); return; }
  if (b) return;
  b = document.createElement('div'); b.id = 'inst-banner'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Uygulamayı yükle');
  b.innerHTML = `<img src="icons/icon-96.png" alt="" width="40" height="40"><span><b>Saha Takip'i telefona yükle</b><small>Ana ekrandan tam ekran açılır, internet yokken de çalışır.</small></span>
    <button type="button" class="btn sm primary" data-ib>Yükle</button><button type="button" class="x" data-ix aria-label="Kapat">×</button>`;
  document.body.appendChild(b);
  b.querySelector('[data-ib]').onclick = () => install();
  b.querySelector('[data-ix]').onclick = () => { try { localStorage.setItem(KEY, '1'); } catch {} b.remove(); };
}
setTimeout(banner, 1500);

// Ana ekran simgesine uzun basınca çıkan kısayollar: ?act=ziyaret | harita | takvim | projeler
export function kisayolAl() {
  let act = null; try { act = new URLSearchParams(location.search).get('act'); } catch {}
  if (!act || !/^(ziyaret|harita|takvim|projeler)$/.test(act)) return null;
  try { history.replaceState(null, '', location.pathname + (act === 'ziyaret' ? '#/ziyaretler' : '#/' + act)); } catch {}
  return act;
}
