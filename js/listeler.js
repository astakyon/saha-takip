// Ayarlar → Listeler: firma tipleri, rakip markaları, kayıp nedenleri gibi seçim listelerini kod değiştirmeden düzenleme.
// Listeler ui.js'deki dizilerin içeriği değiştirilerek uygulanır; böylece bütün formlar ve süzgeçler yeni listeyi kullanır.
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, confirmBox, FIRMA_TIPLERI, RAKIPLER, KAYIP_NEDENLERI, ZIYARET_AMAC, URUN_AILELERI, SEKTORLER, MASRAF_TIP, SERVIS_TIP, DURUMLAR, OLASILIK } from './ui.js';
import { ayar, ayarYaz } from './ayar.js';

export const LISTELER = [
  { k: 'FIRMA_TIPLERI', ad: 'Firma tipleri', arr: FIRMA_TIPLERI, kul: [['firmalar', 'tipler', true]] },
  { k: 'RAKIPLER', ad: 'Rakip markaları', arr: RAKIPLER, kul: [['projeler', 'rakip_marka'], ['rakip_fiyatlar', 'marka']] },
  { k: 'KAYIP_NEDENLERI', ad: 'Kayıp nedenleri', arr: KAYIP_NEDENLERI, kul: [['projeler', 'kayip_nedeni']] },
  { k: 'ZIYARET_AMAC', ad: 'Ziyaret amaçları', arr: ZIYARET_AMAC, kul: [['ziyaretler', 'amac']] },
  { k: 'SEKTORLER', ad: 'Sektörler', arr: SEKTORLER, kul: [['firmalar', 'sektor'], ['projeler', 'sektor']] },
  { k: 'URUN_AILELERI', ad: 'Ürün aileleri (rakip fiyatları için)', arr: URUN_AILELERI, kul: [['rakip_fiyatlar', 'aile']] },
  { k: 'MASRAF_TIP', ad: 'Masraf türleri', arr: MASRAF_TIP, kul: [['masraflar', 'tip']] },
  { k: 'SERVIS_TIP', ad: 'Servis kaydı türleri', arr: SERVIS_TIP, kul: [['servis_kayitlari', 'tip']] },
];
const VARSAYILAN = Object.fromEntries(LISTELER.map(l => [l.k, [...l.arr]]));
const VARS_DURUM = Object.fromEntries(DURUMLAR.map(d => [d.k, { c: d.c, o: OLASILIK[d.k] }]));

export function listeleriUygula() {
  const s = ayar('listeler', {}) || {};
  for (const l of LISTELER) { const v = Array.isArray(s[l.k]) && s[l.k].length ? s[l.k] : VARSAYILAN[l.k]; l.arr.splice(0, l.arr.length, ...v); }
  for (const d of DURUMLAR) { const x = s.durum?.[d.k] || {}; d.c = x.c || VARS_DURUM[d.k].c; OLASILIK[d.k] = x.o != null && x.o !== '' ? +x.o : VARS_DURUM[d.k].o; }
}

const kullanim = (l, deger) => l.kul.reduce((n, [t, k, dizi]) => n + (S[t] || []).filter(r => dizi ? (r[k] || []).includes(deger) : r[k] === deger).length, 0);

export function listeAyarlari(root) {
  const s = () => ({ ...(ayar('listeler', {}) || {}) });
  root.innerHTML = `<p class="hint">Formlardaki seçim listelerini buradan düzenle. Bir maddenin adını değiştirince, istersen o adı taşıyan kayıtlar da yeni adla güncellenir. Listeden çıkardığın madde eski kayıtlarda olduğu gibi kalır.</p>
    <div class="liste-kartlar">${LISTELER.map(l => `<details class="card-ic liste-k" data-liste="${l.k}"><summary><b>${esc(l.ad)}</b> <small class="muted">${l.arr.length} madde${s()[l.k] ? ' · düzenlendi' : ''}</small></summary><div data-ic></div></details>`).join('')}
    <details class="card-ic liste-k" data-durumlar><summary><b>Proje aşamaları</b> <small class="muted">renk ve kazanma olasılığı</small></summary><div data-ic></div></details></div>`;
  root.querySelectorAll('[data-liste]').forEach(d => d.addEventListener('toggle', () => { if (d.open) liste(d, LISTELER.find(l => l.k === d.dataset.liste)); }, { once: true }));
  const dd = root.querySelector('[data-durumlar]'); dd.addEventListener('toggle', () => { if (dd.open) durumlar(dd); }, { once: true });

  function liste(d, l) {
    const ic = d.querySelector('[data-ic]');
    let satir = l.arr.map(v => ({ orj: v, v }));
    const ciz = () => {
      ic.innerHTML = `<ul class="liste-ed">${satir.map((x, i) => { const n = x.orj ? kullanim(l, x.orj) : 0; return `<li data-i="${i}"><input value="${esc(x.v)}" aria-label="Madde ${i + 1}" maxlength="60"><small class="muted" title="Bu değeri taşıyan kayıt sayısı">${n ? n + ' kayıt' : ''}</small>
        <button type="button" class="ic-btn" data-yukari aria-label="Yukarı" ${i ? '' : 'disabled'}>↑</button><button type="button" class="ic-btn" data-asagi aria-label="Aşağı" ${i < satir.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="ic-btn" data-cikar aria-label="Listeden çıkar">×</button></li>`; }).join('')}</ul>
        <div class="liste-ekle"><input data-yeni placeholder="Yeni madde ekle" maxlength="60"><button type="button" class="btn sm" data-ekle>Ekle</button></div>
        <div class="btnrow"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button><button type="button" class="btn sm ghost" data-vars>Varsayılana dön</button></div>`;
      ic.querySelectorAll('li input').forEach(i => i.oninput = () => { satir[+i.closest('li').dataset.i].v = i.value; });
      ic.querySelectorAll('[data-yukari],[data-asagi]').forEach(b => b.onclick = () => { const i = +b.closest('li').dataset.i, j = i + (b.hasAttribute('data-yukari') ? -1 : 1); [satir[i], satir[j]] = [satir[j], satir[i]]; ciz(); });
      ic.querySelectorAll('[data-cikar]').forEach(b => b.onclick = () => { satir.splice(+b.closest('li').dataset.i, 1); ciz(); });
      const ekle = () => { const i = ic.querySelector('[data-yeni]'), v = i.value.trim(); if (!v) return; if (satir.some(x => x.v.trim().toLocaleLowerCase('tr') === v.toLocaleLowerCase('tr'))) return toast('Bu madde zaten listede.', 'err'); satir.push({ orj: null, v }); ciz(); ic.querySelector('[data-yeni]').focus(); };
      ic.querySelector('[data-ekle]').onclick = ekle;
      ic.querySelector('[data-yeni]').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } };
      ic.querySelector('[data-vars]').onclick = async () => { if (!confirmBox(`${l.ad} varsayılan listeye dönsün mü? Kayıtlar değişmez.`)) return; const y = s(); delete y[l.k]; await ayarYaz('listeler', y); listeleriUygula(); satir = l.arr.map(v => ({ orj: v, v })); ciz(); toast('Varsayılan liste geri geldi.'); };
      ic.querySelector('[data-kaydet]').onclick = async () => {
        const temiz = satir.map(x => ({ ...x, v: x.v.trim() })).filter(x => x.v);
        const adlar = temiz.map(x => x.v);
        if (new Set(adlar.map(a => a.toLocaleLowerCase('tr'))).size !== adlar.length) return toast('Aynı ad iki kez yazılmış.', 'err');
        const degisen = temiz.filter(x => x.orj && x.orj !== x.v && kullanim(l, x.orj));
        let guncelle = false;
        if (degisen.length) guncelle = confirmBox(`Adı değişen ${degisen.length} madde var (${degisen.map(x => `${x.orj} → ${x.v}`).join(', ')}). Bu adları taşıyan ${degisen.reduce((a, x) => a + kullanim(l, x.orj), 0)} kayıt da yeni adla güncellensin mi?`);
        const y = s(); y[l.k] = adlar; await ayarYaz('listeler', y); listeleriUygula();
        if (guncelle) {
          let n = 0;
          for (const [t, k, dizi] of l.kul) {
            const rows = [];
            for (const r of S[t] || []) {
              let v = r[k], deg = false;
              for (const x of degisen) {
                if (dizi && (v || []).includes(x.orj)) { v = [...new Set(v.map(a => a === x.orj ? x.v : a))]; deg = true; }
                else if (!dizi && v === x.orj) { v = x.v; deg = true; }
              }
              if (deg) rows.push({ ...r, [k]: v });
            }
            if (rows.length) { try { await app.db.bulk(t, rows); n += rows.length; } catch (e) { toast('Bazı kayıtlar güncellenemedi: ' + e.message, 'err'); } }
          }
          toast(`Liste kaydedildi, ${n} kayıt yeni adla güncellendi.`);
        } else toast('Liste kaydedildi.');
        satir = l.arr.map(v => ({ orj: v, v })); ciz();
        d.querySelector('summary small').textContent = `${l.arr.length} madde · düzenlendi`;
      };
    };
    ciz();
  }

  function durumlar(d) {
    const ic = d.querySelector('[data-ic]');
    ic.innerHTML = `<table class="tbl liste-durum"><thead><tr><th>Aşama</th><th>Renk</th><th class="r">Varsayılan kazanma olasılığı (%)</th></tr></thead><tbody>
      ${DURUMLAR.map(x => `<tr data-d="${esc(x.k)}"><td><span class="pill" style="--c:${x.c}">${esc(x.k)}</span></td><td><input type="color" value="${x.c}" aria-label="${esc(x.k)} rengi"></td><td class="r"><input type="number" min="0" max="100" step="5" inputmode="numeric" value="${OLASILIK[x.k] ?? ''}" aria-label="${esc(x.k)} olasılığı"></td></tr>`).join('')}</tbody></table>
      <p class="hint">Aşama adları raporlara, hedeflere ve geçmişe bağlı olduğu için sabit. Renk harita raptiyelerinde ve listelerde, olasılık ise kazanma oranı girilmemiş projelerin beklenen satış hesabında kullanılır.</p>
      <div class="btnrow"><button type="button" class="btn sm primary" data-kaydet>Kaydet</button><button type="button" class="btn sm ghost" data-vars>Varsayılana dön</button></div>`;
    ic.querySelectorAll('input[type=color]').forEach(i => i.oninput = () => i.closest('tr').querySelector('.pill').style.setProperty('--c', i.value));
    ic.querySelector('[data-kaydet]').onclick = async () => {
      const durum = {};
      ic.querySelectorAll('tr[data-d]').forEach(tr => { const k = tr.dataset.d, c = tr.querySelector('[type=color]').value, o = tr.querySelector('[type=number]').value; const x = {}; if (c.toLowerCase() !== VARS_DURUM[k].c.toLowerCase()) x.c = c; if (o !== '' && +o !== VARS_DURUM[k].o) x.o = Math.max(0, Math.min(100, +o)); if (Object.keys(x).length) durum[k] = x; });
      const y = s(); if (Object.keys(durum).length) y.durum = durum; else delete y.durum; await ayarYaz('listeler', y); listeleriUygula(); toast('Aşama ayarları kaydedildi.');
    };
    ic.querySelector('[data-vars]').onclick = async () => { const y = s(); delete y.durum; await ayarYaz('listeler', y); listeleriUygula(); durumlar(d); toast('Varsayılan renkler ve olasılıklar geri geldi.'); };
  }
}
