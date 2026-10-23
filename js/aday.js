// Aday projeler: kamu ihale ilanları (EKAP), inşaat ruhsatları ve duyumlar. Elle ya da Excel'den eklenir,
// projeler listesini kalabalıklaştırmadan ayrı bekler; "Takibe al" ile gerçek projeye dönüşür.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, closeDrawer, confirmBox, tarih, today, usd, num, fold, pickFiles, ILLER, byId } from './ui.js';
import { kur } from './kur.js';

const KAYNAKLAR = ['EKAP ihale ilanı', 'İnşaat ruhsatı', 'OSB yer tahsisi', 'Gazete / haber', 'Duyum (sahadan)', 'Diğer'];
const adaylar = () => S.projeler.filter(p => p.aday).sort((a, b) => (a.ihale_tarihi || '9').localeCompare(b.ihale_tarihi || '9') || (b.created_at || '').localeCompare(a.created_at || ''));
const benzer = (ad, haric) => { const k = fold(ad).replace(/[^a-z0-9]/g, ''); return k.length >= 6 ? S.projeler.find(p => p.id !== haric && !p.aday && fold(p.ad).replace(/[^a-z0-9]/g, '') === k) : null; };

export function adaylarPaneli(sonra) {
  const p = openDrawer(`<header class="dh"><div><p class="muted">İhale, ruhsat, duyum</p><h2 id="drawer-title">Aday projeler</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><div class="btnrow"><button type="button" class="btn primary" data-ekle>Aday ekle</button><button type="button" class="btn" data-xls>Excel'den yükle</button></div>
      <p class="hint">Aday projeler ana listede, haritada ve raporlarda görünmez. Görüşmeye değer bulduğunu “Takibe al” ile projeye çevir; ilgilenmediğini sil.</p>
      <div data-l></div></div>`, { wide: true, onClose: () => sonra?.() });
  const ciz = () => {
    const l = adaylar(), bugun = today();
    p.querySelector('[data-l]').innerHTML = l.length ? `<ul class="list aday-l">${l.map(a => { const gec = a.ihale_tarihi && a.ihale_tarihi < bugun, b = benzer(a.ad, a.id); return `<li data-a="${a.id}"><span class="grow"><b>${esc(a.ad)}</b>
        <small class="muted">${esc([a.aday_kaynak, [a.ilce, a.il].filter(Boolean).join(', '), a.ihale_tarihi ? (gec ? 'ihale geçti: ' : 'ihale: ') + tarih(a.ihale_tarihi) : '', a.tutar_usd ? '≈ ' + usd(a.tutar_usd) : ''].filter(Boolean).join(' · '))}</small>
        ${a.notlar ? `<small>${esc(a.notlar.slice(0, 160))}</small>` : ''}${b ? `<small class="warn">Benzer adla proje zaten var: <a href="#/proje/${b.id}">${esc(b.ad)}</a></small>` : ''}</span>
        <span class="aday-act"><button type="button" class="btn sm primary" data-takip>Takibe al</button><button type="button" class="btn sm ghost" data-duz>Düzenle</button><button type="button" class="btn sm ghost danger" data-sil>Sil</button></span></li>`; }).join('')}</ul>`
      : '<div class="empty"><p>Bekleyen aday proje yok.</p><p class="hint">EKAP\'ta bölgendeki aydınlatma, elektrik ya da bina yapım ihalelerini, belediyelerin ruhsat listelerini buraya ekleyebilirsin.</p></div>';
    p.querySelectorAll('li[data-a]').forEach(li => {
      const a = byId('projeler', li.dataset.a);
      li.querySelector('[data-takip]').onclick = async () => {
        try {
          const durum = a.ihale_tarihi && a.ihale_tarihi >= today() ? 'İhale' : 'Proje';
          await app.db.save('projeler', { ...a, aday: false, durum, takip_yili: a.takip_yili || new Date().getFullYear() });
          await app.db.save('proje_gecmis', { proje_id: a.id, tarih: new Date().toISOString(), eski_durum: null, yeni_durum: durum, notlar: 'Adaydan takibe alındı' + (a.aday_kaynak ? ' (' + a.aday_kaynak + ')' : '') });
          toast(`“${a.ad}” takibe alındı.`); closeDrawer();
          const { projeDetay } = await import('./views/projeler.js'); projeDetay(a.id);
        } catch (e) { toast('Kaydedilemedi: ' + e.message, 'err'); }
      };
      li.querySelector('[data-duz]').onclick = () => adayForm(a, () => adaylarPaneli(sonra));
      li.querySelector('[data-sil]').onclick = async () => { if (!confirmBox(`“${a.ad}” aday listesinden silinsin mi?`)) return; await app.db.del('projeler', a.id); ciz(); };
    });
  };
  p.querySelector('[data-ekle]').onclick = () => adayForm({}, () => adaylarPaneli(sonra));
  p.querySelector('[data-xls]').onclick = () => excelden(() => adaylarPaneli(sonra));
  ciz();
}

function adayForm(a, sonra) {
  const yeni = !a.id, k = kur()?.USD;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Aday proje</p><h2 id="drawer-title">${yeni ? 'Aday ekle' : esc(a.ad)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" data-f><div class="fld"><label for="ad-ad">Proje / ihale adı <span class="req">*</span></label><input id="ad-ad" required value="${esc(a.ad || '')}" placeholder="Örn. Ceyhan Devlet Hastanesi ek bina yapım işi"></div>
      <div class="grid"><div class="fld"><label for="ad-k">Kaynak</label><select id="ad-k">${KAYNAKLAR.map(x => `<option ${a.aday_kaynak === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="fld"><label for="ad-t">İhale / başlangıç tarihi</label><input id="ad-t" type="date" value="${esc(a.ihale_tarihi || '')}"></div>
        <div class="fld"><label for="ad-il">İl</label><select id="ad-il"><option value="">—</option>${[...ILLER, 'Diğer'].map(x => `<option ${a.il === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="fld"><label for="ad-ilce">İlçe</label><input id="ad-ilce" value="${esc(a.ilce || '')}"></div>
        <div class="fld"><label for="ad-b">Yaklaşık bedel (TL)</label><input id="ad-b" type="number" inputmode="decimal" placeholder="${k ? 'USD\'ye çevrilir' : ''}"></div>
        <div class="fld"><label for="ad-u">ya da tutar (USD)</label><input id="ad-u" type="number" inputmode="decimal" value="${a.tutar_usd ?? ''}"></div></div>
      <div class="fld"><label for="ad-n">Not (idare, ilan no, bağlantı…)</label><textarea id="ad-n" rows="3">${esc(a.notlar || '')}</textarea></div>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`);
  p.querySelector('[data-f]').onsubmit = async e => {
    e.preventDefault();
    const v = id => p.querySelector(id).value.trim(), ad = v('#ad-ad'); if (!ad) return toast('Adı yaz.', 'err');
    const b = +v('#ad-b'), u = v('#ad-u') !== '' ? +v('#ad-u') : (b && k ? Math.round(b / k) : a.tutar_usd ?? null);
    const dup = yeni && benzer(ad); if (dup && !confirmBox(`“${dup.ad}” adında bir proje zaten var. Yine de aday olarak eklensin mi?`)) return;
    try {
      await app.db.save('projeler', { ...a, ad, aday: true, aday_kaynak: v('#ad-k'), ihale_tarihi: v('#ad-t') || null, il: v('#ad-il') || null, ilce: v('#ad-ilce') || null, tutar_usd: u, notlar: [v('#ad-n'), b && !v('#ad-u') ? `Yaklaşık bedel: ${num(b)} TL` : ''].filter(Boolean).join('\n') || null, durum: a.durum || 'Proje', takip_yili: null });
      toast('Aday kaydedildi.'); closeDrawer(); sonra?.();
    } catch (err) { toast('Kaydedilemedi: ' + err.message, 'err'); }
  };
}

// Excel: EKAP arama sonucu ya da kendi listen. Sütunlar ilk yüklemede sorulur ve hatırlanır.
async function excelden(sonra) {
  const [file] = await pickFiles({ accept: '.xls,.xlsx,.csv', multiple: false }); if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 2); if (hi < 0) return toast('Dosyada başlık satırı bulunamadı.', 'err');
    const h = rows[hi].map(c => String(c ?? '').trim()), bul = re => h.findIndex(x => re.test(x.toLocaleLowerCase('tr')));
    const oto = { ad: bul(/(ihale|iş|proje).*(ad|adı|tanım)|^ad[ıi]?$|konu/), il: bul(/^il$|^il |şehir/), ilce: bul(/ilçe/), idare: bul(/idare|kurum|yatırımcı|işveren|sahibi/), tarih: bul(/ihale tarihi|tarih/), bedel: bul(/bedel|maliyet|tutar/), no: bul(/ikn|ilan no|kayıt no|ruhsat no/), not: bul(/not|açıklama/) };
    const { sutunlariEsle, onizleOnay } = await import('./esle.js');
    const C = await sutunlariEsle('aday', 'Aday proje listesi', h, rows.slice(hi + 1, hi + 4), [
      { k: 'ad', l: 'İhale / proje adı', zorunlu: true }, { k: 'il', l: 'İl' }, { k: 'ilce', l: 'İlçe' }, { k: 'idare', l: 'İdare / yatırımcı' },
      { k: 'tarih', l: 'İhale tarihi' }, { k: 'bedel', l: 'Yaklaşık bedel (TL)' }, { k: 'no', l: 'İhale kayıt no (İKN) / ruhsat no' }, { k: 'not', l: 'Not' }], oto);
    if (!C) return toast('Yükleme iptal edildi.');
    const al = (r, k) => C[k] >= 0 ? r[C[k]] : null, metin = v => v == null ? '' : String(v).trim();
    const dt = v => v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : (typeof v === 'string' && /\d{1,2}\.\d{1,2}\.\d{4}/.test(v) ? (([d, m, y]) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)(v.match(/\d{1,2}\.\d{1,2}\.\d{4}/)[0].split('.')) : null);
    const kaynak = /ruhsat/i.test(file.name + h.join(' ')) ? 'İnşaat ruhsatı' : 'EKAP ihale ilanı', k = kur()?.USD;
    const mevcut = new Set(S.projeler.map(p => fold(p.ad).replace(/[^a-z0-9]/g, '')));
    const out = [], atla = [];
    for (const r of rows.slice(hi + 1)) {
      const ad = metin(al(r, 'ad')); if (!ad) continue;
      const anahtar = fold(ad).replace(/[^a-z0-9]/g, '');
      if (mevcut.has(anahtar)) { atla.push(ad); continue; } mevcut.add(anahtar);
      const il = ILLER.find(x => fold(x) === fold(metin(al(r, 'il')))) || (metin(al(r, 'il')) ? 'Diğer' : null);
      const bedel = +String(al(r, 'bedel') ?? '').replace(/\./g, '').replace(',', '.') || +al(r, 'bedel') || 0;
      out.push({ id: uuid(), ad: ad.slice(0, 200), aday: true, aday_kaynak: kaynak, durum: 'Proje', takip_yili: null, il, ilce: metin(al(r, 'ilce')) || null, ihale_tarihi: dt(al(r, 'tarih')),
        tutar_usd: bedel && k ? Math.round(bedel / k) : null,
        notlar: [metin(al(r, 'idare')) && 'İdare / yatırımcı: ' + metin(al(r, 'idare')), metin(al(r, 'no')) && 'No: ' + metin(al(r, 'no')), bedel ? `Yaklaşık bedel: ${num(bedel)} TL` : '', metin(al(r, 'not'))].filter(Boolean).join('\n') || null });
    }
    const on = await onizleOnay({ baslik: 'Aday proje listesi', sayilar: [['yeni aday', out.length, 'yeni'], ['zaten var (atlanacak)', atla.length, '']], ornekBaslik: ['Ad', 'İl', 'İhale tarihi', 'Not'], ornek: out.slice(0, 5).map(o => [o.ad, o.il || '', o.ihale_tarihi ? tarih(o.ihale_tarihi) : '', (o.notlar || '').split('\n')[0]]) });
    if (!on.ok) return toast('İçe aktarma iptal edildi.');
    if (out.length) await app.db.bulk('projeler', out);
    toast(`${out.length} aday eklendi${atla.length ? `, ${atla.length} tanesi zaten vardı` : ''}.`); sonra?.();
  } catch (e) { console.error(e); toast('Dosya okunamadı: ' + e.message, 'err'); }
}
