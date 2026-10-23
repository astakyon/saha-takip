// Bekleyen kayıtlar: internet yokken yapılan ve henüz buluta gitmemiş değişiklikler; gönderilemeyenlerin nedeni
import { S } from './db.js';
import { app } from './state.js';
import { esc, toast, openDrawer, confirmBox } from './ui.js';

const TABLO = { projeler: 'Proje', firmalar: 'Firma', kisiler: 'Kişi', ziyaretler: 'Ziyaret', gorevler: 'Görev', teklifler: 'Teklif', siparisler: 'Sipariş', masraflar: 'Masraf', numuneler: 'Numune', servis_kayitlari: 'Servis kaydı', tahsilatlar: 'Tahsilat', belgeler: 'Belge', bolgeler: 'Sanayi bölgesi', urunler: 'Ürün', yorumlar: 'Yorum', ayarlar: 'Ayar', proje_gecmis: 'Proje geçmişi', rakip_fiyatlar: 'Rakip fiyatı', hedefler: 'Hedef' };
const ad = (t, r, id) => { const x = r || S[t]?.find(k => k.id === id) || {}; return x.ad || x.baslik || x.ad_soyad || x.teklif_no || x.siparis_no || x.anahtar || (x.metin || x.notlar || '').slice(0, 50) || '—'; };

export async function bekleyenPaneli() {
  if (!app.db?.bekleyenler) return toast('Bu modda bekleyen kayıt olmaz; veriler bu cihazda.');
  const p = openDrawer(`<header class="dh"><div><p class="muted">Eşitleme</p><h2 id="drawer-title">Bekleyen kayıtlar</h2></div><button class="x" data-close aria-label="Kapat">×</button></header><div class="dbody" data-l></div>`);
  const ciz = async () => {
    const l = await app.db.bekleyenler();
    const hatali = l.filter(o => o.hata).length;
    p.querySelector('[data-l]').innerHTML = !l.length ? '<div class="empty"><p>Bekleyen kayıt yok; her şey buluta gönderildi.</p></div>' : `
      <p class="hint">${navigator.onLine ? 'İnternet var.' : 'İnternet yok; bağlantı gelince kendiliğinden gönderilir.'} ${hatali ? `<b class="neg">${hatali} kayıt gönderilemedi</b>; nedeni altında yazıyor.` : ''}</p>
      <ul class="list bekleyen-l">${l.map((o, i) => { const t = o.t; return `<li><span class="grow"><b>${esc(TABLO[t] || t)}: ${esc(ad(t, o.row, o.id))}</b>
        <small class="muted">${o.op === 'del' ? 'silme' : o.op === 'upd' ? 'güncelleme' : 'kaydetme'}${o.zaman ? ' · ' + new Date(o.zaman).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}${o.deneme ? ` · ${o.deneme} deneme` : ''}</small>
        ${o.hata ? `<small class="neg">${esc(o.hata)}</small>` : ''}</span><button type="button" class="btn sm ghost danger" data-vaz="${i}">Vazgeç</button></li>`; }).join('')}</ul>
      <div class="btnrow"><button type="button" class="btn primary" data-gonder ${navigator.onLine ? '' : 'disabled'}>Şimdi gönder</button></div>`;
    p.querySelector('[data-gonder]')?.addEventListener('click', async e => { e.target.disabled = true; e.target.textContent = 'Gönderiliyor…'; await app.db.flush(); const k = (await app.db.bekleyenler()).length; toast(k ? `${k} kayıt hâlâ bekliyor.` : 'Hepsi gönderildi.'); ciz(); });
    p.querySelectorAll('[data-vaz]').forEach(b => b.onclick = async () => { if (!confirmBox('Bu değişiklik buluta hiç gönderilmeyecek. Bu cihazda görünmeye devam eder ama diğer cihazlarda olmaz; uygulama yenilenince kaybolur. Vazgeçilsin mi?')) return; await app.db.bekleyenSil(+b.dataset.vaz); ciz(); });
  };
  ciz();
}
