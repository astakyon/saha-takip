// Yorumlar ve etiketleme: proje ve firma kartında ekip içi not; etiketlenen kişi Bugün ekranında ve (kuruluysa) anlık bildirimle görür.
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, confirmBox, byId } from './ui.js';
import { sahipMi } from './yetki.js';

let ekipOnbellek = null;
const benimEpostam = () => (app.db?.user?.()?.email || '').toLowerCase();
// Etiketlenebilecek kişiler: veri sahibi + aktif ekip üyeleri (kendisi hariç)
export async function ekipListesi() {
  if (app.db?.mode !== 'supabase') return [];
  if (!ekipOnbellek) {
    ekipOnbellek = (async () => {
      try { const { data, error } = await app.db.c.rpc('ekip_listesi'); if (error) throw error; return (data || []).map(r => ({ eposta: r.eposta, ad: r.sahip ? (r.ad || 'Veri sahibi') : (r.ad || r.eposta.split('@')[0]), sahip: r.sahip })); }
      catch { return sahipMi() ? (app.ekip || []).map(u => ({ eposta: u.eposta.toLowerCase(), ad: u.ad || u.eposta.split('@')[0] })) : []; }
    })();
  }
  return (await ekipOnbellek).filter(k => k.eposta !== benimEpostam());
}
const benimAdim = async () => { if (sahipMi()) return 'Veri sahibi'; return app.yetki?.ad || benimEpostam().split('@')[0]; };
const zaman = t => { if (!t) return ''; const d = new Date(t), fark = (Date.now() - d) / 6e4; if (fark < 1) return 'şimdi'; if (fark < 60) return Math.round(fark) + ' dk önce'; if (fark < 1440) return Math.round(fark / 60) + ' saat önce'; return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); };
export const yorumlari = (tablo, id) => (S.yorumlar || []).filter(y => y.tablo === tablo && y.kayit_id === id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
// Metni güvenle göster; @etiketleri vurgula
const metinHtml = (m, ekip) => { let h = esc(m).replace(/\n/g, '<br>'); for (const k of ekip) { const ad = esc(k.ad); if (ad) h = h.split('@' + ad).join(`<b class="etiket">@${ad}</b>`); } return h; };

export async function yorumBolumu(kutu, tablo, kayit) {
  if (!kutu) return;
  const ekip = await ekipListesi();
  const ben = benimEpostam();
  let secili = new Set();
  const ciz = () => {
    const l = yorumlari(tablo, kayit.id);
    kutu.innerHTML = `<h3>Yorumlar <span class="muted">${l.length || ''}</span></h3>
      ${l.length ? `<ul class="yorumlar">${l.map(y => { const benim = (y.yazan || '').toLowerCase() === ben || app.db.mode !== 'supabase'; return `<li class="${benim ? 'benim' : ''}"><div class="y-ust"><b>${esc(y.yazan_ad || (y.yazan || '').split('@')[0] || 'Ben')}</b><small class="muted">${zaman(y.created_at)}</small>${benim || sahipMi() ? `<button type="button" class="ic-sil" data-ysil="${y.id}" aria-label="Yorumu sil">×</button>` : ''}</div><p>${metinHtml(y.metin, ekip)}</p></li>`; }).join('')}</ul>` : '<p class="hint">Henüz yorum yok. Ekipten birine not bırakmak için yaz ve etiketle.</p>'}
      <div class="y-yaz"><textarea data-ymetin rows="2" placeholder="${ekip.length ? 'Yorum yaz… Aşağıdan kişi seçersen ona haber gider.' : 'Yorum yaz…'}" aria-label="Yorum"></textarea>
        ${ekip.length ? `<div class="chips y-etiket" role="group" aria-label="Etiketle">${ekip.map(k => `<button type="button" class="chip ${secili.has(k.eposta) ? 'on' : ''}" data-yet="${esc(k.eposta)}">@${esc(k.ad)}</button>`).join('')}</div>` : ''}
        <div class="btnrow"><button type="button" class="btn sm primary" data-ygonder>Yorumu ekle</button></div></div>`;
    const ta = kutu.querySelector('[data-ymetin]');
    kutu.querySelectorAll('[data-yet]').forEach(b => b.onclick = () => {
      const e = b.dataset.yet, k = ekip.find(x => x.eposta === e);
      if (secili.has(e)) { secili.delete(e); ta.value = ta.value.replace('@' + k.ad + ' ', '').replace('@' + k.ad, ''); }
      else { secili.add(e); if (!ta.value.includes('@' + k.ad)) ta.value = (ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' : ta.value) + '@' + k.ad + ' '; }
      b.classList.toggle('on', secili.has(e)); ta.focus();
    });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); gonder(); } });
    kutu.querySelector('[data-ygonder]').onclick = gonder;
    kutu.querySelectorAll('[data-ysil]').forEach(b => b.onclick = async () => { if (!confirmBox('Yorum silinsin mi?')) return; try { await app.db.del('yorumlar', b.dataset.ysil); ciz(); } catch (e) { toast('Silinemedi: ' + e.message, 'err'); } });
    async function gonder() {
      const metin = ta.value.trim(); if (!metin) return toast('Yorumu yaz.', 'err');
      // metinde @ad yazılmışsa o kişiyi de etiketle
      for (const k of ekip) if (metin.includes('@' + k.ad)) secili.add(k.eposta);
      const etiketler = [...secili].filter(e => metin.includes('@' + (ekip.find(k => k.eposta === e)?.ad || '')));
      try {
        const y = await app.db.save('yorumlar', { tablo, kayit_id: kayit.id, metin, yazan: ben || 'ben', yazan_ad: await benimAdim(), etiketler, created_at: new Date().toISOString() });
        if (etiketler.length && app.db.mode === 'supabase') app.db.c.functions.invoke('bildir', { body: { olay: 'yorum', yorum_id: y.id } }).catch(() => {});
        secili = new Set(); ciz(); toast(etiketler.length ? `Yorum eklendi, ${etiketler.length} kişi etiketlendi.` : 'Yorum eklendi.');
      } catch (e) { toast('Yorum eklenemedi: ' + e.message, 'err'); }
    }
  };
  ciz();
}

// Bugün ekranı: son 14 günde beni etiketleyen yorumlar
export function etiketlendiklerim() {
  const ben = benimEpostam(); if (!ben) return [];
  const sinir = new Date(Date.now() - 14 * 864e5).toISOString();
  return (S.yorumlar || []).filter(y => (y.etiketler || []).map(e => e.toLowerCase()).includes(ben) && String(y.created_at) >= sinir)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(y => ({ y, kayit: byId(y.tablo, y.kayit_id), link: y.tablo === 'projeler' ? '#/proje/' + y.kayit_id : '#/firma/' + y.kayit_id }));
}
export const etiketKarti = () => {
  const l = etiketlendiklerim(); if (!l.length) return '';
  return `<section class="card" data-kart="etiket"><h2>Seni etiketlediler <span class="muted">${l.length}</span></h2><ul class="list">${l.slice(0, 8).map(({ y, kayit, link }) => `<li><a href="${link}"><b>${esc(kayit?.ad || 'Kayıt')}</b><small class="muted">${esc(y.yazan_ad || y.yazan)} · ${zaman(y.created_at)}</small><span>${esc(y.metin.slice(0, 140))}</span></a></li>`).join('')}</ul></section>`;
};
