// Sesle yazdırma: not alanlarındaki mikrofon düğmesi (Chrome / Android'de Google konuşma tanıma, Türkçe)
import { toast } from './ui.js';

const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const sesDestek = () => !!SR();
let aktif = null;

export function sesleYaz(alan, dugme) {
  if (aktif) { const a = aktif; aktif = null; a.stop(); return; }
  const R = SR(); if (!R) return toast('Bu tarayıcı sesle yazmayı desteklemiyor. Android\'de Chrome ile dene.', 'err');
  const r = new R(); r.lang = 'tr-TR'; r.continuous = true; r.interimResults = true;
  const bas = alan.value && !/\s$/.test(alan.value) ? alan.value + ' ' : alan.value;
  let kesin = '';
  const ara = document.createElement('small'); ara.className = 'mic-ara'; ara.setAttribute('aria-live', 'polite'); alan.after(ara);
  r.onresult = e => {
    let gecici = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) kesin += t.trim() + ' '; else gecici += t; }
    alan.value = bas + duzelt(kesin).trimEnd(); ara.textContent = gecici ? '… ' + gecici : '';
    alan.dispatchEvent(new Event('input', { bubbles: true }));
  };
  r.onerror = e => toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Mikrofon izni verilmedi. Tarayıcı ayarlarından izin ver.' : e.error === 'network' ? 'Sesle yazma için internet gerekiyor.' : e.error === 'no-speech' ? 'Ses algılanmadı.' : 'Sesle yazma durdu: ' + e.error, 'err');
  r.onend = () => { dugme.classList.remove('on'); dugme.setAttribute('aria-pressed', 'false'); ara.remove(); if (aktif === r) aktif = null; alan.dispatchEvent(new Event('change', { bubbles: true })); };
  try { r.start(); } catch (e) { return toast('Sesle yazma başlatılamadı.', 'err'); }
  aktif = r; dugme.classList.add('on'); dugme.setAttribute('aria-pressed', 'true');
  toast('Dinliyorum… Bitirince mikrofona tekrar dokun.');
}
// "nokta", "virgül", "yeni satır" komutları ve cümle başı büyük harf
export function duzelt(t) {
  let s = ' ' + t + ' ';
  s = s.replace(/\s+(nokta)\s+/gi, '. ').replace(/\s+(virgül)\s+/gi, ', ').replace(/\s+(soru işareti)\s+/gi, '? ').replace(/\s+(yeni satır|alt satır)\s+/gi, '\n');
  s = s.trim().replace(/(^|[.?!]\s+|\n)([a-zçğıöşü])/g, (m, a, b) => a + b.toLocaleUpperCase('tr'));
  return s + ' ';
}
// Form içindeki mikrofon düğmelerini bağlar
export function mikBagla(root) {
  root.querySelectorAll('[data-mic]').forEach(b => b.onclick = () => { const a = b.parentElement.querySelector('textarea'); if (a) sesleYaz(a, b); });
}
export const mikDugme = () => sesDestek() ? '<button type="button" class="mic" data-mic aria-label="Sesle yaz" aria-pressed="false" title="Sesle yaz"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>' : '';
