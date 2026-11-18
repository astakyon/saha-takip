// Stok grupları ("favori kanal" mantığı): stok ekranının üstünde sekmeler.
// İki katman: şirket grupları (şirket tanımlar; tüm bayilerde ya da seçili bayilerde görünür) ve bayinin kendi grupları (yalnız o bayide).
// Bir kalem birden fazla grupta olabilir (bayi_stok.gruplar = grup id listesi). Grup silinince kalemler silinmez, grupsuz kalır.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, closeDrawer, confirmBox, fold, firmaAd } from './ui.js';

export const GRUPSUZ = '_grupsuz';
const sirali = l => [...l].sort((a, b) => (+a.sira || 0) - (+b.sira || 0) || String(a.ad).localeCompare(String(b.ad), 'tr'));
export const sirketGruplari = () => sirali((S.stok_gruplari || []).filter(g => !g.firma_id));
export const bayiGruplari = firma_id => sirali((S.stok_gruplari || []).filter(g => g.firma_id && g.firma_id === firma_id));
// Şirket grubu bu bayide görünür mü: "tüm bayiler" ya da bayi seçili bayilerden
export const sirketGrubuBayide = (g, firma_id) => g.tum_bayiler !== false || (g.bayiler || []).includes(firma_id);
// Bayinin stok ekranındaki gruplar (şirket grupları önce, bayinin kendi grupları sonra); firma_id yoksa (bütün bayiler) yalnız şirket grupları
export function gorunenGruplar(firma_id) {
  const sg = sirketGruplari().filter(g => !firma_id || sirketGrubuBayide(g, firma_id)).map(g => ({ ...g, katman: 'sirket' }));
  return firma_id ? [...sg, ...bayiGruplari(firma_id).map(g => ({ ...g, katman: 'bayi' }))] : sg;
}
export const kalemGruplari = s => Array.isArray(s?.gruplar) ? s.gruplar : [];
// Kalem bu sekmede mi: Tümü (''), Grupsuz ya da bir grup
export function sekmede(s, sekme, firma_id) {
  if (!sekme) return true;
  const gecerli = new Set(gorunenGruplar(firma_id || s.firma_id).map(g => g.id));
  const gs = kalemGruplari(s).filter(id => gecerli.has(id));
  return sekme === GRUPSUZ ? !gs.length : gs.includes(sekme);
}
export async function grupKaydet(g) {
  const o = { id: g.id || uuid(), ad: String(g.ad || '').trim(), firma_id: g.firma_id || null, tum_bayiler: g.firma_id ? null : g.tum_bayiler !== false, bayiler: g.firma_id ? [] : (g.tum_bayiler !== false ? [] : g.bayiler || []), sira: g.sira ?? ((S.stok_gruplari || []).length + 1), renk: g.renk || null };
  if (!o.ad) throw new Error('Grup adını yaz.');
  const ayni = (S.stok_gruplari || []).find(x => x.id !== o.id && (x.firma_id || null) === o.firma_id && fold(x.ad) === fold(o.ad));
  if (ayni) throw new Error(`“${o.ad}” adlı grup zaten var.`);
  await app.db.save('stok_gruplari', o); return o;
}
// Grup silinir; kalemlerden grup işareti kalkar (kalemler silinmez)
export async function grupSil(g) {
  const etk = (S.bayi_stok || []).filter(s => kalemGruplari(s).includes(g.id));
  if (etk.length) await app.db.bulk('bayi_stok', etk.map(s => ({ ...s, gruplar: kalemGruplari(s).filter(x => x !== g.id) })));
  await app.db.del('stok_gruplari', g.id); return etk.length;
}
export async function grupSirala(liste) { await app.db.bulk('stok_gruplari', liste.map((g, i) => ({ ...(S.stok_gruplari.find(x => x.id === g.id) || g), sira: i + 1 }))); }
export async function grubaEkle(kalemler, grupIdleri) {
  const l = kalemler.map(s => ({ ...s, gruplar: [...new Set([...kalemGruplari(s), ...grupIdleri])] })).filter((s, i) => s.gruplar.length !== kalemGruplari(kalemler[i]).length);
  if (l.length) await app.db.bulk('bayi_stok', l); return l.length;
}
export async function gruptanCikar(kalemler, grupId) {
  const l = kalemler.filter(s => kalemGruplari(s).includes(grupId)).map(s => ({ ...s, gruplar: kalemGruplari(s).filter(x => x !== grupId) }));
  if (l.length) await app.db.bulk('bayi_stok', l); return l.length;
}

// "Grupla" penceresi: işaretli kalemleri var olan gruplara ekle ya da yeni grup aç
export function gruplaPenceresi({ firma_id, kalemler, sirketYazar, sonra }) {
  const gl = gorunenGruplar(firma_id);
  const p = openDrawer(`<header class="dh"><div><p class="muted">${kalemler.length} kalem</p><h2 id="drawer-title">Grupla</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <form class="dbody form" novalidate>
      ${gl.length ? `<fieldset class="sg-sec"><legend>Gruplar</legend>${gl.map(g => `<label class="chk"><input type="checkbox" value="${g.id}" ${kalemler.every(s => kalemGruplari(s).includes(g.id)) ? 'checked disabled' : ''}> <span>${esc(g.ad)}</span> <small class="muted">${g.katman === 'sirket' ? 'şirket grubu' : 'bu bayiye özel'}</small></label>`).join('')}</fieldset>` : '<p class="hint">Henüz grup yok. Aşağıdan ilk grubu aç: örneğin Aydınlatma, Kablo kanalı, Busbar, Şarj.</p>'}
      <fieldset class="sg-yeni"><legend>Yeni grup</legend><label class="fld"><span>Grup adı</span><input name="yeni" placeholder="Örn. Aydınlatma stoğu" autocomplete="off"></label>
        ${sirketYazar ? `<label class="chk"><input type="radio" name="kapsam" value="bayi" checked> <span>Yalnız bu bayide</span></label><label class="chk"><input type="radio" name="kapsam" value="sirket"> <span>Şirket grubu (bütün bayilerde)</span></label>` : ''}</fieldset>
      <div class="dfoot sticky"><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Grupla</button></div></form>`);
  p.querySelector('form').onsubmit = async e => { e.preventDefault();
    const sec = [...p.querySelectorAll('.sg-sec input:checked:not(:disabled)')].map(i => i.value), ad = p.querySelector('[name=yeni]').value.trim();
    try {
      if (ad) { const kapsam = p.querySelector('[name=kapsam]:checked')?.value || 'bayi'; const g = await grupKaydet({ ad, firma_id: kapsam === 'sirket' ? null : firma_id, tum_bayiler: true }); sec.push(g.id); }
      if (!sec.length) return toast('Bir grup seç ya da yeni grup adı yaz.', 'err');
      const n = await grubaEkle(kalemler, sec); toast(`${n} kalem gruplandı.`); closeDrawer(); sonra?.();
    } catch (er) { toast(er.message, 'err'); } };
}

// Grupları yönet: şirket grupları (yönetici) ve bu bayinin grupları; ad değiştir, sırala, kapsam (tüm / seçili bayiler), sil
export function gruplarPenceresi({ firma_id, bayiListesi = [], sirketYazar, sonra }) {
  const ciz = () => {
    const sg = sirketGruplari(), bg = firma_id ? bayiGruplari(firma_id) : [];
    const satir = (g, l, i, sirket) => `<li class="sg-satir" data-g="${g.id}"><span class="sg-sira"><button type="button" class="btn sm ghost" data-yuk="${g.id}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(g.ad)} yukarı">↑</button><button type="button" class="btn sm ghost" data-asa="${g.id}" ${i === l.length - 1 ? 'disabled' : ''} aria-label="${esc(g.ad)} aşağı">↓</button></span>
      <input data-ad="${g.id}" value="${esc(g.ad)}" aria-label="Grup adı" ${sirket && !sirketYazar ? 'disabled' : ''}>
      ${sirket ? `<small class="muted">${g.tum_bayiler !== false ? 'tüm bayiler' : `${(g.bayiler || []).length} bayi`}</small>${sirketYazar ? `<button type="button" class="btn sm ghost" data-kapsam="${g.id}">Bayiler</button>` : ''}` : ''}
      <small class="muted">${(S.bayi_stok || []).filter(s => kalemGruplari(s).includes(g.id) && (!firma_id || s.firma_id === firma_id || sirket)).length} kalem</small>
      ${!sirket || sirketYazar ? `<button type="button" class="btn sm ghost danger" data-gsil="${g.id}" aria-label="${esc(g.ad)} sil">Sil</button>` : ''}</li>`;
    return `<header class="dh"><div><h2 id="drawer-title">Stok grupları</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><div class="dbody">
      <h3>Şirket grupları</h3><p class="hint">Şirket tanımlar; her grup bütün bayilerde ya da seçtiğin bayilerde sekme olarak görünür. Yeni bayiye “tüm bayiler” grupları kendiliğinden gelir.</p>
      ${sg.length ? `<ul class="sg-liste">${sg.map((g, i) => satir(g, sg, i, true)).join('')}</ul>` : '<p class="muted">Şirket grubu yok.</p>'}
      ${sirketYazar ? `<div class="frow"><input data-yenisirket placeholder="Yeni şirket grubu" aria-label="Yeni şirket grubu adı"><button type="button" class="btn sm" data-ekles>Ekle</button></div>` : ''}
      ${firma_id ? `<h3>${esc(firmaAd(firma_id) || 'Bayinin')} grupları</h3><p class="hint">Yalnız bu bayide görünür.</p>${bg.length ? `<ul class="sg-liste">${bg.map((g, i) => satir(g, bg, i, false)).join('')}</ul>` : '<p class="muted">Bu bayinin kendi grubu yok.</p>'}
      <div class="frow"><input data-yenibayi placeholder="Yeni bayi grubu" aria-label="Yeni bayi grubu adı"><button type="button" class="btn sm" data-ekleb>Ekle</button></div>` : ''}
      <p class="hint">Grup silinince içindeki kalemler silinmez, grupsuz kalır.</p></div>`;
  };
  const p = openDrawer(ciz());
  const bagla = () => {
    const yeniden = () => { p.innerHTML = ciz(); bagla(); };
    p.querySelectorAll('[data-ad]').forEach(i => i.onchange = async () => { const g = S.stok_gruplari.find(x => x.id === i.dataset.ad); try { await grupKaydet({ ...g, ad: i.value }); toast('Grup adı değişti.'); sonra?.(); } catch (er) { toast(er.message, 'err'); i.value = g.ad; } });
    const tasi = async (id, yon) => { const g = S.stok_gruplari.find(x => x.id === id), l = g.firma_id ? bayiGruplari(g.firma_id) : sirketGruplari(), i = l.findIndex(x => x.id === id), j = i + yon; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; await grupSirala(l); yeniden(); sonra?.(); };
    p.querySelectorAll('[data-yuk]').forEach(b => b.onclick = () => tasi(b.dataset.yuk, -1));
    p.querySelectorAll('[data-asa]').forEach(b => b.onclick = () => tasi(b.dataset.asa, 1));
    p.querySelectorAll('[data-gsil]').forEach(b => b.onclick = async () => { const g = S.stok_gruplari.find(x => x.id === b.dataset.gsil); if (!confirmBox(`“${g.ad}” grubu silinsin mi? İçindeki kalemler silinmez, grupsuz kalır.`)) return; const n = await grupSil(g); toast(`Grup silindi; ${n} kalem grupsuz kaldı.`); yeniden(); sonra?.(); });
    const ekle = async (inp, firma) => { try { await grupKaydet({ ad: inp.value, firma_id: firma, tum_bayiler: true }); toast('Grup eklendi.'); yeniden(); sonra?.(); } catch (er) { toast(er.message, 'err'); } };
    p.querySelector('[data-ekles]')?.addEventListener('click', () => ekle(p.querySelector('[data-yenisirket]'), null));
    p.querySelector('[data-ekleb]')?.addEventListener('click', () => ekle(p.querySelector('[data-yenibayi]'), firma_id));
    p.querySelectorAll('[data-kapsam]').forEach(b => b.onclick = () => { const g = S.stok_gruplari.find(x => x.id === b.dataset.kapsam); const li = b.closest('li');
      if (li.nextElementSibling?.classList.contains('sg-kapsam')) { li.nextElementSibling.remove(); return; }
      const k = document.createElement('li'); k.className = 'sg-kapsam';
      k.innerHTML = `<label class="chk"><input type="checkbox" data-tum ${g.tum_bayiler !== false ? 'checked' : ''}> <span>Tüm bayiler</span></label><div class="sg-bayiler" ${g.tum_bayiler !== false ? 'hidden' : ''}>${bayiListesi.map(x => `<label class="chk"><input type="checkbox" value="${x.firma_id}" ${(g.bayiler || []).includes(x.firma_id) ? 'checked' : ''}> <span>${esc(x.ad)}</span></label>`).join('')}</div><button type="button" class="btn sm primary" data-kkaydet>Kaydet</button>`;
      li.after(k);
      k.querySelector('[data-tum]').onchange = e => { k.querySelector('.sg-bayiler').hidden = e.target.checked; };
      k.querySelector('[data-kkaydet]').onclick = async () => { const tum = k.querySelector('[data-tum]').checked; await grupKaydet({ ...g, tum_bayiler: tum, bayiler: tum ? [] : [...k.querySelectorAll('.sg-bayiler input:checked')].map(i => i.value) }); toast('Grubun bayileri kaydedildi.'); yeniden(); sonra?.(); };
    });
  };
  bagla();
}
