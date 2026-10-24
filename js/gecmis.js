// Değişiklik geçmişi (yalnızca veri sahibi): kim, neyi, ne zaman değiştirdi. Veriler veritabanındaki tetikleyiciden gelir.
import { app } from './state.js';
import { esc, tarih, toast } from './ui.js';
import { S } from './db.js';
import { sahipMi } from './yetki.js';

const TABLO = { projeler: 'Proje', firmalar: 'Firma', kisiler: 'Kişi', ziyaretler: 'Ziyaret', gorevler: 'Görev', siparisler: 'Sipariş', teklifler: 'Teklif', urunler: 'Ürün/stok', tahsilatlar: 'Tahsilat', numuneler: 'Numune', servis_kayitlari: 'Servis', belgeler: 'Belge', bolgeler: 'Bölge', hedefler: 'Hedef' };
const ALAN = { ad: 'ad', durum: 'durum', tutar_usd: 'tutar', olasilik: 'olasılık', beklenen_tarih: 'beklenen tarih', stok: 'stok', birim_fiyat_usd: 'fiyat', notlar: 'not', baslik: 'başlık', son_tarih: 'son tarih', atanan: 'atanan', telefon: 'telefon', eposta: 'e-posta', rakip_marka: 'işi alan marka', kayip_nedeni: 'kayıp nedeni', il: 'il', ilce: 'ilçe', lat: 'konum', lng: 'konum', tamamlayan: 'tamamlayan', odenen: 'ödenen', vade: 'vade' };
export const gecmisVar = () => app.db?.mode === 'supabase' && sahipMi();
const kisa = v => v == null || v === '' ? '—' : typeof v === 'object' ? (Array.isArray(v) ? v.length + ' öğe' : '…') : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v);
const kimAd = e => { const u = (app.ekip || []).find(x => x.eposta === e); return u?.ad || (e === (app.db.user()?.email || '').toLowerCase() ? 'Sen' : e || '?'); };
function satir(d, tabloGoster) {
  const zaman = new Date(d.zaman), z = `${tarih(d.zaman.slice(0, 10))} ${zaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  const alanlar = d.degisen ? [...new Set(Object.keys(d.degisen).map(k => ALAN[k] ? k : null).filter(Boolean))].filter((k, i, a) => !(k === 'lng' && a.includes('lat'))) : [];
  const ayr = alanlar.slice(0, 3).map(k => `${ALAN[k]}: ${esc(kisa(d.degisen[k].e))} → <b>${esc(kisa(d.degisen[k].y))}</b>`).join(' · ');
  const diger = d.degisen ? Object.keys(d.degisen).length - alanlar.length : 0;
  const geriAl = d.islem === 'değişiklik' && d.degisen && S[d.tablo]?.some(r => r.id === d.kayit_id) ? `<button type="button" class="btn sm ghost" data-gerial="${d.id}">Geri al</button>` : '';
  return `<li data-gid="${d.id}"><span class="muted">${z}${geriAl ? '<br>' + geriAl : ''}</span><span><b>${esc(kimAd(d.kim))}</b> ${tabloGoster ? esc(TABLO[d.tablo] || d.tablo) + ' ' : ''}${d.ozet ? `“${esc(d.ozet)}” ` : ''}${d.islem === 'ekleme' ? 'ekledi' : d.islem === 'silme' ? 'sildi' : 'değiştirdi'}${ayr ? `<br><small>${ayr}${diger > 0 ? ` · +${diger} alan` : ''}</small>` : ''}</span></li>`;
}
// “Geri al”: değişen alanları eski değerlerine döndürür (yeni bir değişiklik olarak kaydedilir)
const ATLA = new Set(['owner', 'id', 'created_at', 'updated_at']);
function gecmisBagla(kutu, data) {
  kutu.onclick = async e => {
    const b = e.target.closest('[data-gerial]'); if (!b) return;
    const d = (data || []).find(x => String(x.id) === b.dataset.gerial); if (!d) return;
    const r = S[d.tablo]?.find(x => x.id === d.kayit_id); if (!r) return toast('Kayıt bulunamadı.', 'err');
    const eski = Object.fromEntries(Object.entries(d.degisen).filter(([k]) => !ATLA.has(k)).map(([k, v]) => [k, v.e]));
    if (!confirm(`Bu değişiklik geri alınsın mı? (${Object.keys(eski).length} alan eski haline döner)`)) return;
    try { await app.db.save(d.tablo, { ...r, ...eski }); toast('Değişiklik geri alındı.'); b.replaceWith(Object.assign(document.createElement('small'), { textContent: 'geri alındı', className: 'muted' })); }
    catch (err) { toast('Geri alınamadı: ' + err.message, 'err'); }
  };
}
// Tek kaydın geçmişi (detay paneli altında, istenince yüklenir)
export function kayitGecmisi(kutu, tablo, id) {
  if (!gecmisVar() || !kutu) return;
  kutu.innerHTML = `<h3>Değişiklik geçmişi</h3><button type="button" class="btn sm ghost" data-gyukle>Kim, ne zaman değiştirdi?</button>`;
  kutu.querySelector('[data-gyukle]').onclick = async () => {
    kutu.innerHTML = '<h3>Değişiklik geçmişi</h3><p class="hint">Yükleniyor…</p>';
    const { data, error } = await app.db.c.from('degisiklikler').select('*').eq('owner', app.db.sahip).eq('tablo', tablo).eq('kayit_id', id).order('zaman', { ascending: false }).limit(30);
    gecmisBagla(kutu, data);
    kutu.innerHTML = `<h3>Değişiklik geçmişi</h3>${error ? '<p class="hint">Geçmiş tablosu yok; güncel schema.sql dosyasını çalıştır.</p>' : data.length ? `<ul class="list gecmis">${data.map(d => satir(d, false)).join('')}</ul>` : '<p class="hint">Bu kayıt için kayıtlı değişiklik yok (geçmiş, sürüm 14 SQL güncellemesinden sonra tutuluyor).</p>'}`;
  };
}
// Ayarlar → Kullanıcılar: son değişiklikler (kişiye göre süzülebilir)
export async function sonDegisiklikler(kutu) {
  if (!gecmisVar() || !kutu) return;
  let kim = '';
  const ciz = async () => {
    let q = app.db.c.from('degisiklikler').select('*').eq('owner', app.db.sahip).order('zaman', { ascending: false }).limit(60);
    if (kim) q = q.eq('kim', kim);
    const { data, error } = await q;
    const kisiler = [['', 'Herkes'], [(app.db.user()?.email || '').toLowerCase(), 'Sen'], ...(app.ekip || []).map(u => [u.eposta, u.ad || u.eposta])];
    gecmisBagla(kutu, data);
    kutu.innerHTML = `<div class="card-h"><h2>Son değişiklikler</h2><select data-gkim aria-label="Kişi">${kisiler.map(([v, t]) => `<option value="${esc(v)}" ${v === kim ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      ${error ? '<p class="hint">Geçmiş tablosu yok; güncel schema.sql dosyasını çalıştır.</p>' : data.length ? `<ul class="list gecmis">${data.map(d => satir(d, true)).join('')}</ul>` : '<p class="hint">Henüz kayıtlı değişiklik yok.</p>'}`;
    kutu.querySelector('[data-gkim]').onchange = e => { kim = e.target.value; ciz(); };
  };
  kutu.innerHTML = '<p class="hint">Yükleniyor…</p>'; ciz();
}
