// Proje ve firmalara belge ekleme (PDF, Excel, Word, çizim, fotoğraf…)
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, pickFiles, confirmBox, tarih } from './ui.js';

export const boyutYaz = b => !b ? '' : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
const TUR = [[/pdf/, 'PDF'], [/sheet|excel|csv/, 'Excel'], [/word|document/, 'Word'], [/presentation|powerpoint/, 'Sunum'], [/image/, 'Görsel'], [/dwg|dxf|acad/, 'Çizim'], [/zip|rar|7z/, 'Arşiv']];
export const turAd = (t, ad = '') => (TUR.find(([r]) => r.test(t || '') || r.test(ad.split('.').pop().toLowerCase())) || [0, (ad.split('.').pop() || 'Dosya').toUpperCase()])[1];

export const belgeleri = ({ proje_id, firma_id }) => S.belgeler.filter(b => (proje_id && b.proje_id === proje_id) || (firma_id && b.firma_id === firma_id)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

// Detay panelindeki “Belgeler” bölümü. hedef: { proje_id } veya { firma_id }
export function belgeBolumu(kutu, hedef) {
  const ciz = () => {
    const l = belgeleri(hedef);
    kutu.innerHTML = `<h3>Belgeler <span class="muted">${l.length}</span></h3>
      ${l.length ? `<ul class="list belge-list">${l.map(b => `<li><button type="button" class="linkrow" data-ac="${b.id}"><b>${esc(b.ad)}</b><span class="muted">${esc(turAd(b.tur, b.ad))}${b.boyut ? ' · ' + boyutYaz(b.boyut) : ''} · ${tarih((b.created_at || '').slice(0, 10))}${b.notlar ? ' · ' + esc(b.notlar) : ''}</span></button><button type="button" class="x" data-sil="${b.id}" aria-label="${esc(b.ad)} belgesini sil">×</button></li>`).join('')}</ul>` : '<p class="hint">Teklif, şartname, proje çizimi, sözleşme gibi dosyaları buraya ekleyebilirsin.</p>'}
      <div class="btnrow"><button type="button" class="btn sm" data-ekle>Belge ekle</button><button type="button" class="btn sm ghost" data-cek>Belgenin fotoğrafını çek</button></div>`;
    kutu.querySelector('[data-ekle]').onclick = () => ekle(false);
    kutu.querySelector('[data-cek]').onclick = () => ekle(true);
    kutu.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => belgeAc(S.belgeler.find(x => x.id === b.dataset.ac)));
    kutu.querySelectorAll('[data-sil]').forEach(b => b.onclick = async () => {
      const x = S.belgeler.find(y => y.id === b.dataset.sil); if (!x || !confirmBox(`“${x.ad}” silinsin mi?`)) return;
      await app.db.del('belgeler', x.id); try { await app.db.removePhoto(x.yol); } catch {} toast('Belge silindi.'); ciz();
    });
  };
  const ekle = async kamera => {
    const files = await pickFiles({ accept: kamera ? 'image/*' : '*/*', multiple: !kamera, capture: kamera });
    if (!files.length) return;
    try {
      for (const f of files) {
        toast(`${f.name} yükleniyor…`);
        const yol = kamera ? await app.db.upload(f) : await app.db.uploadFile(f);
        await app.db.save('belgeler', { ...hedef, kategori: 'Belge', ad: kamera ? `Fotoğraf ${new Date().toLocaleDateString('tr-TR')}` : f.name, yol, tur: kamera ? 'image/jpeg' : f.type, boyut: f.size });
      }
      toast(files.length > 1 ? `${files.length} belge eklendi.` : 'Belge eklendi.'); ciz();
    } catch (e) { console.error(e); toast('Yüklenemedi: ' + e.message, 'err'); }
  };
  ciz();
}

export async function belgeAc(b) {
  if (!b) return;
  const u = await app.db.url(b.yol);
  if (!u) return toast('Belge açılamadı. İnternet bağlantını kontrol et.', 'err');
  const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
  if (u.startsWith('blob:') && !/pdf|image/.test(b.tur || '')) a.download = b.ad;
  a.click();
}

// İçe aktarılan dosyanın (Excel, JSON, KML…) bir kopyasını “Yüklenen dosyalar” arasına kaydeder. Hata olursa yüklemeyi bozmaz.
export async function yuklemeKaydet(file, tur, ozet) {
  try {
    if (!file || file.size > 40 * 1024 * 1024) return;
    const yol = await app.db.uploadFile(file);
    await app.db.save('belgeler', { ad: file.name, yol, tur: file.type || null, boyut: file.size, kategori: 'Yükleme: ' + tur, notlar: ozet || null });
  } catch (e) { console.warn('yükleme kaydı', e); }
}
