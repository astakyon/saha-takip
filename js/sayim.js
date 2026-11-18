// Stok sayımı: sistemdeki miktar ile depoda sayılan yan yana; fark raporu (eksik / fazla, adet ve tutar); onaylanınca stok sayılana çekilir,
// fark hareket kaydına "sayım düzeltmesi" olarak (kim, ne zaman) yazılır. Sayım taslağı kaydedilir: telefonla depoda gezerken kaybolmaz.
import { S, uuid } from './db.js';
import { app } from './state.js';
import { esc, num, usd, tarih, today, toast, openDrawer, closeDrawer, confirmBox, fold, firmaAd, exportXlsx } from './ui.js';
import { ayar } from './ayar.js';
import { bayiStokYaz, satirFiyat, usdCevir, aktifMi } from './stok.js';
import { sekmede } from './stokgrup.js';

const kimAdi = () => { try { const u = app.db?.user?.(); return u?.user_metadata?.imza || ayar('benim_adim') || u?.email || null; } catch { return null; } };
export const acikSayim = (firma_id, grup_id = null) => (S.stok_sayimlari || []).find(x => x.firma_id === firma_id && (x.grup_id || null) === (grup_id || null) && x.durum === 'Açık');
export const sayimlar = firma_id => (S.stok_sayimlari || []).filter(x => !firma_id || x.firma_id === firma_id).sort((a, b) => String(b.baslangic || b.created_at || '').localeCompare(String(a.baslangic || a.created_at || '')));
// Sayılacak kalemler: bayinin aktif stoğu (grup seçiliyse o grup)
export const sayimKalemleri = (firma_id, grup_id) => (S.bayi_stok || []).filter(s => s.firma_id === firma_id && aktifMi(s) && (!grup_id || sekmede(s, grup_id, firma_id)))
  .sort((a, b) => String(a.kod).localeCompare(String(b.kod), 'tr', { numeric: true }));
// Fark: sayılan girilmiş kalemler için sayılan − sistem; tutar birim fiyattan (USD)
export function sayimFarki(say, kalemler) {
  const sayilan = say?.sayilan || {};
  const l = kalemler.map(s => { const v = sayilan[s.kod]; const girildi = v !== undefined && v !== null && v !== ''; const fark = girildi ? (+v || 0) - (+s.adet || 0) : null; const { fiyat, pb } = satirFiyat(s);
    return { s, sayilan: girildi ? +v || 0 : null, fark, tutar: fark ? usdCevir(fark * fiyat, pb) : 0 }; });
  const g = l.filter(x => x.sayilan != null);
  return { l, sayilanN: g.length, eksik: g.filter(x => x.fark < 0), fazla: g.filter(x => x.fark > 0), esit: g.filter(x => x.fark === 0),
    eksikTutar: g.filter(x => x.fark < 0).reduce((a, x) => a + x.tutar, 0), fazlaTutar: g.filter(x => x.fark > 0).reduce((a, x) => a + x.tutar, 0) };
}
export async function sayimBaslat(firma_id, grup_id = null) {
  const var_ = acikSayim(firma_id, grup_id); if (var_) return var_;
  const o = { id: uuid(), firma_id, grup_id: grup_id || null, durum: 'Açık', baslangic: new Date().toISOString(), sayan: kimAdi(), sayilan: {}, satirlar: [] };
  await app.db.save('stok_sayimlari', o); return o;
}
export async function sayimYaz(say, kod, deger) {
  const o = { ...say, sayilan: { ...(say.sayilan || {}) } };
  if (deger === '' || deger == null) delete o.sayilan[kod]; else o.sayilan[kod] = +deger;
  await app.db.save('stok_sayimlari', o); return o;
}
// Onay: sayılan kalemlerin stoğu sayılana çekilir (sayılmayanlar isteğe bağlı 0); fark hareket kaydına "sayim" olarak yazılır
export async function sayimOnayla(say, { sayilmayanSifir = false } = {}) {
  const kalemler = sayimKalemleri(say.firma_id, say.grup_id), F = sayimFarki(say, kalemler);
  const yaz = F.l.filter(x => x.sayilan != null ? x.fark !== 0 : sayilmayanSifir && +x.s.adet !== 0).map(x => ({ ...x.s, adet: x.sayilan != null ? x.sayilan : 0 }));
  const etiket = `Sayım ${tarih(String(say.baslangic || '').slice(0, 10) || today())}${say.sayan ? ' · ' + say.sayan : ''}`;
  if (yaz.length) await bayiStokYaz(yaz, { hareket: 'sayim', aciklama: etiket });
  const satirlar = F.l.map(x => ({ kod: x.s.kod, aciklama: x.s.aciklama || null, birim: x.s.birim || null, sistem: +x.s.adet || 0, sayilan: x.sayilan, fark: x.sayilan != null ? x.fark : (sayilmayanSifir ? -(+x.s.adet || 0) : null), tutar: Math.round((x.tutar || 0) * 100) / 100 }));
  await app.db.save('stok_sayimlari', { ...say, durum: 'Onaylandı', onay_tarihi: new Date().toISOString(), onaylayan: kimAdi(), satirlar, eksik_tutar: Math.round(F.eksikTutar), fazla_tutar: Math.round(F.fazlaTutar) });
  return yaz.length;
}
// Sürekli fark çıkan ürünler: onaylı sayımların en az ikisinde farkı olan kodlar
export function surekliFark(firma_id) {
  const m = new Map();
  for (const x of sayimlar(firma_id).filter(x => x.durum === 'Onaylandı')) for (const r of x.satirlar || []) if (r.fark) { const e = m.get(r.kod) || { kod: r.kod, aciklama: r.aciklama, n: 0, toplam: 0 }; e.n++; e.toplam += +r.fark || 0; m.set(r.kod, e); }
  return [...m.values()].filter(e => e.n >= 2).sort((a, b) => b.n - a.n || Math.abs(b.toplam) - Math.abs(a.toplam));
}

// ---------- Ekran ----------
export function sayimPenceresi({ b, firma_id, grup_id = null, grupAd = null, bayiAdi = '', sonra }) {
  let say = acikSayim(firma_id, grup_id);
  const p = openDrawer('<div class="dbody"><p>Yükleniyor…</p></div>', { wide: true, onClose: () => sonra?.() });
  const ciz = () => {
    if (!say) {
      const gec = sayimlar(firma_id).filter(x => x.durum === 'Onaylandı'), sf = surekliFark(firma_id);
      p.innerHTML = `<header class="dh"><div><p class="muted">${esc(bayiAdi)}${grupAd ? ' · ' + esc(grupAd) : ''}</p><h2 id="drawer-title">Stok sayımı</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
        <div class="dbody"><p>${sayimKalemleri(firma_id, grup_id).length} aktif kalem sayılacak${grupAd ? ` (yalnız “${esc(grupAd)}” grubu)` : ''}. Sayım taslak olarak kaydedilir; telefonla depoda gezerken kaldığın yerden devam edersin. Onaylayana kadar stok değişmez.</p>
        <button type="button" class="btn primary" data-basla>Sayımı başlat</button>
        ${gec.length ? `<h3>Geçmiş sayımlar</h3><ul class="list">${gec.slice(0, 20).map(x => { const fk = (x.satirlar || []).filter(r => r.fark); return `<li><span><b>${tarih(String(x.onay_tarihi || x.baslangic).slice(0, 10))}</b><span class="muted"> · ${esc(x.sayan || '')} · ${(x.satirlar || []).filter(r => r.sayilan != null).length} kalem sayıldı · ${fk.length} farklı</span></span><span class="num">${x.eksik_tutar ? `<span class="neg">−${usd(Math.abs(x.eksik_tutar))}</span> ` : ''}${x.fazla_tutar ? `<span class="pos">+${usd(x.fazla_tutar)}</span>` : ''}</span></li>`; }).join('')}</ul>` : ''}
        ${sf.length ? `<h3>Sürekli fark çıkan ürünler</h3><ul class="list">${sf.slice(0, 20).map(e => `<li><span><b class="mono">${esc(e.kod)}</b><span class="muted"> ${esc(e.aciklama || '')} · ${e.n} sayımda fark</span></span><b class="num ${e.toplam < 0 ? 'neg' : 'pos'}">${e.toplam > 0 ? '+' : ''}${num(e.toplam)}</b></li>`).join('')}</ul>` : ''}</div>`;
      p.querySelector('[data-basla]').onclick = async () => { say = await sayimBaslat(firma_id, grup_id); ciz(); };
      return;
    }
    const kalemler = sayimKalemleri(firma_id, grup_id), F = sayimFarki(say, kalemler);
    p.innerHTML = `<header class="dh"><div><p class="muted">${esc(bayiAdi)}${grupAd ? ' · ' + esc(grupAd) : ''} · ${tarih(String(say.baslangic).slice(0, 10))}${say.sayan ? ' · ' + esc(say.sayan) : ''}</p><h2 id="drawer-title">Sayım</h2></div><div class="dh-actions"><button type="button" class="btn sm ghost" data-sxlsx>Fark raporu (Excel)</button><button type="button" class="btn sm ghost danger" data-siptal>Sayımı iptal et</button></div><button class="x" data-close aria-label="Kapat">×</button></header>
      <div class="dbody">
        <div class="sy-ozet" data-ozet></div>
        <div class="frow"><input type="search" data-sara placeholder="Kodu okut ya da yaz, Enter" aria-label="Kod okut ya da ara" autocomplete="off" enterkeyhint="go">${'BarcodeDetector' in window ? '<button type="button" class="btn" data-kamera>Kamerayla okut</button>' : ''}
          <label class="chk"><input type="checkbox" data-arti> <span>Her okutma +1</span></label></div>
        <div class="seg" role="group" aria-label="Göster">${[['hepsi', 'Hepsi'], ['sayilmadi', 'Sayılmadı'], ['fark', 'Farklı']].map(([k, t], i) => `<button type="button" data-sg="${k}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div>
        <video data-vid playsinline hidden></video>
        <div class="tbl-wrap"><table class="tbl sy-t"><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Sistem</th><th class="r">Sayılan</th><th class="r">Fark</th></tr></thead><tbody data-tb></tbody></table></div>
      </div>
      <div class="dfoot sticky"><label class="chk"><input type="checkbox" data-sifir> <span>Sayılmayanları 0 kabul et</span></label><button type="button" class="btn primary" data-onay>Onayla ve stoğu güncelle</button></div>`;
    let sg = 'hepsi', q = '';
    const ozet = () => { const F = sayimFarki(say, kalemler);
      p.querySelector('[data-ozet]').innerHTML = `<b>${F.sayilanN}/${kalemler.length}</b> kalem sayıldı · <span class="neg">${F.eksik.length} eksik${F.eksikTutar ? ' (' + usd(Math.round(Math.abs(F.eksikTutar))) + ')' : ''}</span> · <span class="pos">${F.fazla.length} fazla${F.fazlaTutar ? ' (' + usd(Math.round(F.fazlaTutar)) + ')' : ''}</span> · ${F.esit.length} aynı`; };
    const satir = x => `<tr data-k="${esc(x.s.kod)}" class="${x.fark ? (x.fark < 0 ? 'eksik' : 'fazla') : ''}"><td class="mono">${esc(x.s.kod)}${x.s.firma_kodu ? `<br><small class="muted">${esc(x.s.firma_kodu)}</small>` : ''}</td><td>${esc(x.s.aciklama || '')}</td><td class="r num">${num(x.s.adet)}${x.s.birim ? ' <small class="muted">' + esc(x.s.birim) + '</small>' : ''}</td>
      <td class="r"><input type="number" inputmode="decimal" step="any" class="sy-say" data-say="${esc(x.s.kod)}" value="${x.sayilan ?? ''}" aria-label="${esc(x.s.kod)} sayılan"></td><td class="r num" data-fk>${x.fark == null ? '' : (x.fark > 0 ? '+' : '') + num(x.fark)}</td></tr>`;
    const liste = () => { const F = sayimFarki(say, kalemler);
      const g = F.l.filter(x => (!q || fold([x.s.kod, x.s.firma_kodu, x.s.uretici_kodu, x.s.aciklama].join(' ')).includes(fold(q))) && (sg === 'hepsi' || (sg === 'sayilmadi' ? x.sayilan == null : x.fark)));
      p.querySelector('[data-tb]').innerHTML = g.slice(0, 500).map(satir).join('') || '<tr><td colspan="5" class="muted">Kalem yok.</td></tr>';
      p.querySelectorAll('[data-say]').forEach(i => { i.onchange = async () => { say = await sayimYaz(say, i.dataset.say, i.value); const x = sayimFarki(say, kalemler).l.find(y => y.s.kod === i.dataset.say); const tr = i.closest('tr'); tr.className = x.fark ? (x.fark < 0 ? 'eksik' : 'fazla') : ''; tr.querySelector('[data-fk]').textContent = x.fark == null ? '' : (x.fark > 0 ? '+' : '') + num(x.fark); ozet(); };
        i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); p.querySelector('[data-sara]').focus(); } }; });
      ozet(); };
    const okut = async kod => { const k = fold(String(kod).trim()); if (!k) return;
      const x = kalemler.find(s => [s.kod, s.firma_kodu, s.uretici_kodu].some(v => v && fold(String(v)) === k));
      if (!x) return toast(`${kod}: bu sayımda böyle bir kalem yok.`, 'err');
      if (p.querySelector('[data-arti]').checked) { const v = (+say.sayilan?.[x.kod] || 0) + 1; say = await sayimYaz(say, x.kod, v); q = ''; p.querySelector('[data-sara]').value = ''; liste(); toast(`${x.kod}: ${num(v)}`); return; }
      q = x.kod; liste(); const i = p.querySelector(`[data-say="${CSS.escape(x.kod)}"]`); i?.focus(); i?.select(); };
    p.querySelector('[data-sara]').oninput = e => { q = e.target.value; liste(); };
    p.querySelector('[data-sara]').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); okut(e.target.value); } };
    p.querySelectorAll('[data-sg]').forEach(x => x.onclick = () => { sg = x.dataset.sg; p.querySelectorAll('[data-sg]').forEach(y => y.classList.toggle('on', y === x)); liste(); });
    p.querySelector('[data-kamera]')?.addEventListener('click', async e => {
      const v = p.querySelector('[data-vid]');
      if (!v.hidden) { v.srcObject?.getTracks().forEach(t => t.stop()); v.hidden = true; e.target.textContent = 'Kamerayla okut'; return; }
      try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); v.srcObject = st; v.hidden = false; await v.play(); e.target.textContent = 'Kamerayı kapat';
        const det = new BarcodeDetector(); let son = '', zaman = 0;
        const tara = async () => { if (v.hidden || !p.isConnected) { st.getTracks().forEach(t => t.stop()); return; } try { const r = await det.detect(v); const kod = r[0]?.rawValue; if (kod && (kod !== son || Date.now() - zaman > 1500)) { son = kod; zaman = Date.now(); await okut(kod); } } catch {} setTimeout(tara, 300); };
        tara();
      } catch (er) { toast('Kamera açılamadı: ' + er.message, 'err'); }
    });
    p.querySelector('[data-sxlsx]').onclick = () => { const F = sayimFarki(say, kalemler); exportXlsx(`sayim-farki-${today()}`, { 'Fark raporu': F.l.map(x => ({ Kod: x.s.kod, 'Firma kodu': x.s.firma_kodu || null, Ürün: x.s.aciklama, Birim: x.s.birim || null, Sistem: +x.s.adet || 0, Sayılan: x.sayilan, Fark: x.fark, 'Fark tutarı (USD)': x.fark ? Math.round(x.tutar * 100) / 100 : null, Durum: x.sayilan == null ? 'Sayılmadı' : x.fark < 0 ? 'Eksik' : x.fark > 0 ? 'Fazla' : 'Aynı' })) }); };
    p.querySelector('[data-siptal]').onclick = async () => { if (!confirmBox('Sayım iptal edilsin mi? Girilen sayılar silinir, stok değişmez.')) return; await app.db.save('stok_sayimlari', { ...say, durum: 'İptal' }); say = null; toast('Sayım iptal edildi.'); ciz(); };
    p.querySelector('[data-onay]').onclick = async e => {
      const F = sayimFarki(say, kalemler), sifir = p.querySelector('[data-sifir]').checked, sayilmayan = kalemler.length - F.sayilanN;
      if (!F.sayilanN && !sifir) return toast('Henüz hiçbir kalem sayılmadı.', 'err');
      if (!confirmBox(`Sayım onaylanacak:\n• ${F.eksik.length} kalem eksik${F.eksikTutar ? ' (' + usd(Math.round(Math.abs(F.eksikTutar))) + ')' : ''}\n• ${F.fazla.length} kalem fazla${F.fazlaTutar ? ' (' + usd(Math.round(F.fazlaTutar)) + ')' : ''}\n• ${sayilmayan} kalem sayılmadı${sayilmayan ? (sifir ? ' → 0 yapılacak' : ' → değişmeyecek') : ''}\n\nStok sayılan miktarlara çekilir; farklar hareket kaydına “Sayım düzeltmesi” olarak yazılır. Devam edilsin mi?`)) return;
      e.target.disabled = true;
      try { const n = await sayimOnayla(say, { sayilmayanSifir: sifir }); toast(`Sayım onaylandı; ${n} kalemin stoğu güncellendi.`); say = null; ciz(); } catch (er) { e.target.disabled = false; toast('Onaylanamadı: ' + er.message, 'err'); }
    };
    liste(); setTimeout(() => p.querySelector('[data-sara]')?.focus(), 50);
  };
  ciz();
}
