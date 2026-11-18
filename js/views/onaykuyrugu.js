// Onay kuyruğu: şirket yetkilisinin onayını bekleyen her şey tek listede (masraflar, hafta planları, ekibin yeni kayıtları).
import { app, F, saveFilters } from '../state.js';
import { esc, tarih, today, toast } from '../ui.js';
import { ayar, ayarYaz } from '../ayar.js';
import { onayListesi, onaySay, ekipKaydiOnayi } from '../onay.js';
import '../planonay.js';

const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
const adOf = e => !e ? '' : e === ben() ? 'Ben' : (app.ekip || []).find(u => (u.eposta || '').toLowerCase() === String(e).toLowerCase())?.ad || String(e).split('@')[0];
export function onayView(el) {
  const f = F('onay', { tur: '' });
  const hepsi = onayListesi(), l = hepsi.filter(x => !f.tur || x.tur.k === f.tur);
  const turler = [...new Map(hepsi.map(x => [x.tur.k, x.tur])).values()];
  el.innerHTML = `<header class="vh"><div><h1>Onay kuyruğu</h1><p class="sum">${hepsi.length ? hepsi.length + ' iş onayını bekliyor' : 'Onay bekleyen iş yok'}</p></div></header>
    ${turler.length > 1 ? `<div class="frow">${[{ k: '', ad: 'Hepsi' }, ...turler].map(t => `<button type="button" class="chip-s ${f.tur === t.k ? 'on' : ''}" data-tur="${t.k}">${esc(t.ad)} <i>${t.k ? hepsi.filter(x => x.tur.k === t.k).length : hepsi.length}</i></button>`).join('')}</div>` : ''}
    ${l.length ? `<ul class="list big onay-l">${l.map((x, i) => `<li data-i="${i}"><span class="grow"><small class="muted">${esc(x.tur.ad)}</small><br><b>${esc(x.baslik)}</b><small class="muted"> · ${esc(adOf(x.kim))}${x.tarih ? ' · ' + tarih(x.tarih) : ''}${x.tutar ? ' · ' + esc(x.tutar) : ''}</small></span>
      ${x.ac ? '<button class="btn sm primary" data-ac>İncele</button>' : `${x.git ? '<button class="btn sm ghost" data-git>Aç</button>' : ''}<button class="btn sm ghost danger" data-k="red">${x.tur.k === 'masraf' ? 'Reddet' : 'Düzeltilecek'}</button><button class="btn sm primary" data-k="ok">Onayla</button>`}</li>`).join('')}</ul>`
      : '<div class="empty"><p>Her şey onaylı.</p></div>'}
    <section class="card"><h2>Neler onaya düşer</h2>
      <label class="chk"><input type="checkbox" data-ay="masraf_onay" ${ayar('masraf_onay') === true ? 'checked' : ''}> Ekibin girdiği masraflar</label>
      <label class="chk"><input type="checkbox" data-ay="plan_onay" ${ayar('plan_onay') === true ? 'checked' : ''}> Ekibin haftalık planları</label>
      <label class="chk"><input type="checkbox" data-ay="ekip_onay" ${ekipKaydiOnayi() ? 'checked' : ''}> Ekibin açtığı yeni firma, proje ve siparişler</label>
      <p class="hint">Onaya düşen kayıt beklerken de kullanılır; onay, kaydın kontrol edildiğini işaretler.</p></section>`;
  el.querySelectorAll('[data-tur]').forEach(b => b.onclick = () => { f.tur = b.dataset.tur; saveFilters(); onayView(el); });
  el.querySelectorAll('[data-ay]').forEach(c => c.onchange = async () => { await ayarYaz(c.dataset.ay, c.checked); toast('Kaydedildi.'); });
  el.querySelectorAll('.onay-l [data-i]').forEach(li => {
    const x = l[+li.dataset.i];
    li.querySelector('[data-ac]')?.addEventListener('click', () => x.ac());
    li.querySelector('[data-git]')?.addEventListener('click', () => { location.hash = x.git; });
    li.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
      const ok = b.dataset.k === 'ok', t = x.tur.tablo;
      try {
        if (x.tur.karar) await x.tur.karar(x, ok);
        else if (x.tur.k === 'masraf') await app.db.save(t, { ...x.kayit, onay: ok ? 'Onaylandı' : 'Reddedildi', onaylayan: ben(), onay_tarih: today() });
        else if (ok) await app.db.save(t, { ...x.kayit, dogrulandi: `${ben()}|${today()}` });
        else { const not = prompt('Ne düzeltilmeli? (kaydın notuna eklenir)'); if (!not) return; await app.db.save(t, { ...x.kayit, notlar: [x.kayit.notlar, `Düzeltilecek (${tarih(today())}): ${not}`].filter(Boolean).join('\n') }); toast('Not eklendi; kayıt kuyrukta kalır.'); onayView(el); return; }
        toast(ok ? 'Onaylandı.' : 'Reddedildi.'); onaySay(); onayView(el);
      } catch (e) { toast(e.message, 'err'); }
    });
  });
}
