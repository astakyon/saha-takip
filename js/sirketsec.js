// K5: birden fazla şirketin ekibinde olan kişi çalışacağı şirketi seçer (sunucuda kişiye özel saklanır)
import { app } from './state.js';
import { esc, toast, confirmBox } from './ui.js';
import { idbSet } from './db.js';

export const cokSirketli = () => (app.db?.sirketler || []).length > 1;

export function sirketSecAc() {
  const l = app.db?.sirketler || []; if (l.length < 2) return;
  const d = document.createElement('dialog'); d.className = 'org-dlg sirket-dlg';
  d.innerHTML = `<form method="dialog" class="form"><h3>Şirket değiştir</h3><p class="muted">Bu hesapla ${l.length} şirkete erişimin var. Seçtiğin şirketin kayıtları yüklenir.</p>
    <ul class="list sirket-liste">${l.map(s => `<li><button type="button" class="linkrow ${s.secili ? 'on' : ''}" data-sirket="${esc(s.owner)}" ${s.secili ? 'aria-current="true"' : ''}><b>${esc(s.ad || 'Şirket')}</b><span class="muted">${esc(s.rol || '')}${s.secili ? ' · şu an açık' : ''}</span></button></li>`).join('')}</ul>
    <div class="btnrow"><span class="grow"></span><button type="button" class="btn ghost" data-vaz>Kapat</button></div></form>`;
  document.body.appendChild(d); d.showModal(); d.addEventListener('close', () => d.remove());
  d.querySelector('[data-vaz]').onclick = () => d.close();
  d.querySelectorAll('[data-sirket]').forEach(b => b.onclick = async () => {
    const s = l.find(x => x.owner === b.dataset.sirket); if (!s || s.secili) return d.close();
    const bekleyen = await app.db.pending?.() || 0;
    if (bekleyen && !confirmBox(`${bekleyen} değişiklik henüz buluta gönderilmedi. Şirket değiştirirsen bu değişiklikler kaybolabilir. Yine de geçilsin mi?`)) return;
    b.disabled = true;
    try {
      const { error } = await app.db.c.rpc('sirket_sec', { p_owner: s.owner }); if (error) throw error;
      // Önceki şirketin telefondaki kopyası silinir; yeni şirket baştan yüklenir
      const uid = app.db.user()?.id;
      await Promise.all(['cache:', 'senk:', 'yetki:'].map(k => idbSet(k + uid, null)));
      try { sessionStorage.clear(); } catch {}
      toast(`${s.ad} açılıyor…`);
      location.hash = '#/bugun'; location.reload();
    } catch (e) { b.disabled = false; toast('Geçilemedi: ' + (e.message || e), 'err'); }
  });
}
