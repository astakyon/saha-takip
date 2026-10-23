// Kayıtlı filtreler: liste ekranlarındaki filtre ayarlarını adıyla saklar, tek dokunuşla geri getirir. Cihazlar arasında eşitlenir.
import { app, saveFilters } from './state.js';
import { ayar, ayarYaz } from './ayar.js';
import { esc, toast } from './ui.js';

const EKRANLAR = ['projeler', 'firmalar', 'kisiler', 'ziyaretler', 'gorevler', 'siparisler', 'teklifler', 'tahsilat', 'numuneler', 'servis', 'urunler', 'rakip', 'dosyalar', 'bolgeler', 'katalog', 'referanslar'];
const HARIC = ['gun', 'ay', 'hafta', 'acik'];   // tarihe bağlı geçici alanlar saklanmaz (ay filtresi hariç ekranlarda)
const tum = () => ayar('kayitli_filtreler', {}) || {};
const temiz = (v, f) => Object.fromEntries(Object.entries(f).filter(([k]) => !(HARIC.includes(k) && v === 'gorevler')));
const GORUNUM = ['gor', '_gorSecim', '_v', '_ilk', 'sk', 'sd'];   // görünüm tercihleri filtre sayılmaz
const esit = (a, b) => Object.keys(a).filter(k => !GORUNUM.includes(k)).every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));

export function filtreCubugu(kok, ekran) {
  if (!EKRANLAR.includes(ekran)) return;
  const fl = kok.querySelector('.filters'); if (!fl || fl.querySelector('.kfiltre')) return;
  const cur = app.filters[ekran] || {}, vars = app.filtreVars?.[ekran] || {};
  const l = tum()[ekran] || [];
  const degisti = !esit(vars, cur);
  const d = document.createElement('div'); d.className = 'kfiltre';
  if (!l.length && !degisti) d.hidden = true;   // kayıtlı filtre yoksa ve filtre değişmediyse yer kaplamasın
  d.innerHTML = `${l.length ? '<span class="kf-l">Kayıtlı:</span>' : ''}${l.map((x, i) => `<span class="kf ${esit(x.f, cur) ? 'on' : ''}"><button type="button" data-kf="${i}">${esc(x.ad)}</button><button type="button" class="kf-x" data-kfsil="${i}" aria-label="${esc(x.ad)} filtresini sil">×</button></span>`).join('')}
    ${degisti && !l.some(x => esit(x.f, cur)) ? `<button type="button" class="kf-yeni" data-kfyeni>+ Filtreyi kaydet</button>` : ''}
    ${degisti ? `<button type="button" class="kf-temiz" data-kftemiz>Filtreleri temizle</button>` : ''}
    `;
  fl.prepend(d);
  if (!fl.dataset.kfb) {   // görünüm yalnızca listeyi yeniden çizdiğinde çubuğu güncelle
    fl.dataset.kfb = '1'; let t;
    const tazele = e => { if (e.target.closest('.kfiltre')) return; clearTimeout(t); t = setTimeout(() => { if (!fl.isConnected) return; const s = JSON.stringify(app.filters[ekran]); if (s === fl.dataset.kfs) return; fl.querySelector('.kfiltre')?.remove(); filtreCubugu(kok, ekran); }, 350); };
    ['click', 'change', 'input'].forEach(o => fl.addEventListener(o, tazele));
  }
  fl.dataset.kfs = JSON.stringify(cur);
  const yenile = () => { const y = window.scrollY; app.refresh(); window.scrollTo(0, y); };
  d.querySelectorAll('[data-kf]').forEach(b => b.onclick = () => { app.filters[ekran] = { ...vars, ...l[+b.dataset.kf].f }; saveFilters(); yenile(); });
  d.querySelectorAll('[data-kfsil]').forEach(b => b.onclick = async () => { const t = tum(); const x = (t[ekran] || []).splice(+b.dataset.kfsil, 1)[0]; await ayarYaz('kayitli_filtreler', t); toast(`“${x?.ad}” silindi.`); yenile(); });
  d.querySelector('[data-kftemiz]')?.addEventListener('click', () => { app.filters[ekran] = { ...vars }; saveFilters(); yenile(); });
  d.querySelector('[data-kfyeni]')?.addEventListener('click', e => {
    const b = e.currentTarget;
    const f = document.createElement('form'); f.className = 'kf-form';
    f.innerHTML = `<input required maxlength="40" placeholder="Ad, örn. Bu ayın açık projeleri" aria-label="Filtre adı"><button type="submit" class="btn sm primary">Kaydet</button><button type="button" class="btn sm ghost" data-iptal>Vazgeç</button>`;
    b.replaceWith(f); f.querySelector('input').focus();
    f.querySelector('[data-iptal]').onclick = yenile;
    f.onsubmit = async ev => {
      ev.preventDefault(); const ad = f.querySelector('input').value.trim(); if (!ad) return;
      const t = tum(); (t[ekran] ||= []).push({ ad, f: temiz(ekran, app.filters[ekran] || {}) }); await ayarYaz('kayitli_filtreler', t);
      toast(`“${ad}” kaydedildi.`); yenile();
    };
  });
}
// #view içinde filtre alanı çizildikçe çubuğu ekle (görünümler kendini yeniden çizdiğinde de)
export function filtreIzle(view, ekranAl) {
  new MutationObserver(() => { const fl = view.querySelector('.filters'); if (fl && !fl.querySelector('.kfiltre')) filtreCubugu(view, ekranAl()); }).observe(view, { childList: true, subtree: true });
}
