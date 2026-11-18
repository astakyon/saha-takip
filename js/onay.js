// Onay bekleyen işler: şirket yetkilisinin onayına düşen kayıtlar (ekip masrafları, hafta planları, ekibin yeni firma / proje / siparişleri).
// Sayı menü rozetinde görünür; Onay kuyruğu ekranı hepsini tek listede toplar.
import { S, yeniKayitKancasi } from './db.js';
import { app } from './state.js';
import { sahipMi } from './yetki.js';
import { ayar } from './ayar.js';

export const ONAY_TURLERI = [];
// Her tür: { k, ad, rota, tablo, liste: () => [{ id, baslik, kim, tarih, tutar, kayit, ac? }] }
export function onayTuru(t) { if (!ONAY_TURLERI.some(x => x.k === t.k)) ONAY_TURLERI.push(t); }
onayTuru({ k: 'masraf', ad: 'Masraf', rota: 'masraflar', tablo: 'masraflar',
  liste: () => (S.masraflar || []).filter(m => m.onay === 'Bekliyor').map(m => ({ id: m.id, baslik: [m.tip, m.aciklama].filter(Boolean).join(' · '), kim: m.kim, tarih: m.tarih, tutar: (+m.tutar || 0).toLocaleString('tr-TR') + ' TL', kayit: m })) });

// Teklif iskontosu: ekip üyesi şirketin iskonto sınırını aşınca teklif "Bekliyor" olur; onaylanınca müşteriye gönderilebilir
onayTuru({ k: 'teklif-iskonto', ad: 'Teklif iskontosu', rota: 'teklifler', tablo: 'teklifler',
  liste: () => (S.teklifler || []).filter(t => t.onay === 'Bekliyor').map(t => ({ id: t.id, baslik: [t.teklif_no, byIdAd(t.firma_id)].filter(Boolean).join(' · '), kim: t.olusturan || t.sorumlu || '', tarih: t.tarih, tutar: new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(+t.toplam || 0) + ' ' + (t.para_birimi || 'USD') + (t.iskonto ? ` · genel isk. %${t.iskonto}` : ''), kayit: t, git: '#/teklifler' })),
  karar: async (x, ok) => { const { app: a } = await import('./state.js'); await a.db.save('teklifler', { ...x.kayit, onay: ok ? 'Onaylandı' : 'Reddedildi', onaylayan: ben() }); } });
const byIdAd = id => (S.firmalar || []).find(f => f.id === id)?.ad || '';

// Ekip kayıtları: "Ekibin yeni kayıtları onayımdan geçsin" açıksa ekip üyesinin yeni firma, proje ve siparişi "Ekip kaydı" olarak işaretlenir
export const EKIP_TABLOLARI = { firmalar: ['Yeni firma', f => f.ad, f => '#/firma/' + f.id], projeler: ['Yeni proje', p => p.ad, p => '#/proje/' + p.id], siparisler: ['Yeni sipariş', s => [s.siparis_no || s.belge_no, s.musteri_adi].filter(Boolean).join(' · ') || 'Sipariş', () => '#/siparisler'] };
export const ekipKaydiOnayi = () => ayar('ekip_onay') === true;
const ben = () => (app.db?.user?.()?.email || '').toLowerCase();
yeniKayitKancasi((t, row) => (EKIP_TABLOLARI[t] && ekipKaydiOnayi() && !sahipMi() && !row.kaynak) ? { ...row, kaynak: 'Ekip kaydı · ' + ben() } : row);
for (const [t, [ad, baslik, git]] of Object.entries(EKIP_TABLOLARI))
  onayTuru({ k: 'ekip-' + t, ad, tablo: t, rota: t === 'siparisler' ? 'siparisler' : t,
    liste: () => (S[t] || []).filter(x => String(x.kaynak || '').startsWith('Ekip kaydı') && !x.dogrulandi).map(x => ({ id: x.id, baslik: baslik(x), kim: String(x.kaynak).split('· ')[1] || '', tarih: String(x.created_at || x.tarih || '').slice(0, 10), kayit: x, git: git(x) })) });

export function onayListesi() {
  if (!sahipMi()) return [];
  return ONAY_TURLERI.flatMap(t => { try { return t.liste().map(x => ({ ...x, tur: t })); } catch { return []; } });
}
export function onaySay() { app.onayBekleyen = onayListesi().length; return app.onayBekleyen; }
