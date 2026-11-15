// Yardım: her ekranda “?” ile o ekranın kısa açıklaması; ilk açılışta 4 adımlık tanıtım
import { esc, openDrawer } from './ui.js';

const Y = {
  bugun: ['Bugün', 'Günün planı, uyarılar ve hatırlatmalar tek ekranda. Planlı ziyaretlerini en kısa rotaya dizer; “Yapıldı” ile kapatırsın. Uzun süredir gidilmeyen firmalar, zamanı gelen projeler ve vadesi geçen tahsilatlar burada çıkar. Kartların sırasını “⋯ → Düzenle” ile değiştirebilirsin.'],
  harita: ['Harita', 'Projeler, firmalar ve sanayi bölgeleri haritada. Katmanlar: il, aşamalar, harita görüntüsü. Araçlar: konumu olmayan kayıtları yerleştir (Konum ata), raptiyeyi sürükle, bölge çiz, Google\'da işletme ara. Raptiyeye dokununca Aç / Ziyaret ekle / Yol tarifi.'],
  bolgeler: ['Sanayi bölgeleri', 'OSB ve sanayi sitelerinin listesi; her bölgedeki proje sayısı ve potansiyel. Sınırları haritada çizebilir ya da bilinen OSB\'leri otomatik getirebilirsin.'],
  projeler: ['Projeler', 'Takip ettiğin bütün projeler. Durum çipleriyle süz, Tablo / Kart / Satış hunisi arasında geç. “⋯” menüsünde Sütunlar, Toplu düzelt, Adaylar (ihale ve ruhsatlar) ve Excel. Bir projeye dokununca bilgiler, ziyaretler, teklif ve siparişler, belgeler, yorumlar ve geçmiş sekmeleri açılır.'],
  referanslar: ['Referanslar', 'Bitmiş ve fotoğraflı projelerin; müşteriye göstermek için tek dokunuşla sunum.'],
  firmalar: ['Firmalar', 'Emüt, Gemüt, proje büroları, bayiler ve müşteriler. Telefonda satırı sola kaydırınca Ara, WhatsApp, Ziyaret ekle. Firma kartında kişiler, projeler, ilişki ağı, yorumlar ve tahsilat özeti var.'],
  kisiler: ['Kişiler', 'Firmalardaki temas kişilerin. Kartvizitin fotoğrafını çekince bilgiler kendiliğinden okunur. Satırı sola kaydırınca hızlı işlemler.'],
  plan: ['Haftalık saha planı', 'Haftanın günlerine bölge seç, öneri listesinden firmaları güne sürükle ya da gün düğmesine dokun. Otomatik dağıt, bölgesi seçili günlere o ildeki en önemli önerileri koyar. Her gün için rota Google Haritalar\'da açılır. Planlar yalnızca uygulamada kalır.'],
  talepler: ['Bayi talepleri', 'Bayiler (dış kullanıcılar) buradan yeni proje bildirir, teklif ister, stok sorar; her talep sana görev olarak düşer. Talebi yanıtla, projeye dönüştür ya da teklif hazırla. Bayi yalnızca kendi firmasının taleplerini ve yanıtlarını görür.'],
  ekiphar: ['Ekip haritası', 'Seçilen gün ekibin ziyaret noktaları haritada (renk kişiye göre, kesikli çizgi güzergâh), şu an içeride olanlar, saat sırasıyla giriş, çıkış, ziyaret, teklif ve tamamlanan görevler, kişi başına ziyaret sayısı, içeride geçen süre ve tahmini yol. Konum yalnızca giriş ve çıkış anında alınır.'],
  rakipanaliz: ['Kayıp ve rakip', 'Hangi rakibe, hangi nedenle, hangi il ve sektörde kaybettiğin; rakibin bizden ortalama ne kadar ucuz verdiği; o rakibe karşı kazandığın projeler ve çeyreklere göre kayıp gidişatı. Satıra dokununca rakibin projeleri açılır. Veri, kayıp projelerde girdiğin işi alan marka, neden ve fiyatlardan gelir.'],
  takvim: ['Takvim', 'Haftalık ziyaret planı. Bir güne dokunarak ziyaret planla; planlı ziyaretler Bugün ekranında rota olur.'],
  ziyaretler: ['Ziyaretler', 'Yapılan ve planlanan bütün ziyaretler, notları ve sonuçlarıyla. Sahadayken “Ziyaret kaydet” ile konum da eklenir.'],
  gorevler: ['Görevler', 'Yapılacak işler ve hatırlatmalar. Ekipten birine atayabilirsin; o kişiye bildirim gider, tamamlayınca sana haber gelir.'],
  teklifler: ['Teklifler', 'Hazırladığın teklifler; PDF ya da WhatsApp ile gönderilir. “Revize et” ile -R2, -R3… sürümleri tutulur, kazanma oranı hesaplanır.'],
  siparisler: ['Siparişler', 'SAP sipariş listesinden yüklenen siparişler. Çeyrek, cari ve proje bazında görünümler; projeye ve firmaya bağlanmamış olanları Raporlar → Veri kontrolü bulur.'],
  tahsilat: ['Tahsilat', 'Açık faturalar ve vadeleri. Cari ekstresi Excel\'ini yükleyebilir ya da elle ekleyebilirsin; vadesi geçenler Bugün ekranında uyarı olur.'],
  numuneler: ['Numuneler', 'Müşteriye bıraktığın deneme ürünleri; geri alma tarihi gelince hatırlatılır.'],
  servis: ['Servis ve şikayet', 'Arıza, garanti ve iade kayıtları; çözülene kadar açık görünür.'],
  urunler: ['Stok ve fiyat', 'Bayinin stok Excel\'inden gelen ürünler, adetleri ve birim fiyatları. “Kodu oku” ile etiket ya da barkoddan ürünü bulursun.'],
  bayi: ['Bayi paneli', 'Bayi stok adetlerini hızlıca güncelle, bayinin siparişlerini ve projelerini gör.'],
  katalog: ['Katalog', 'Ürün aileleri, kataloglar ve ürün sayfaları.'],
  rakip: ['Rakip fiyatları', 'Sahada duyduğun rakip fiyatları; Analiz görünümünde kayıp nedenleri ve fiyat eğilimi.'],
  araclar: ['Hesap araçları', 'Aydınlatma hesabı ve enerji tasarrufu; tasarrufu PowerPoint sunum olarak indirebilirsin.'],
  panel: ['Panel', 'Çeyrek hedefleri, gerçekleşen, olasılıklı tahmin, geçen yılla karşılaştırma ve firma karnesi. Toplantı için hazır sunum tabloları.'],
  rapor: ['Haftalık rapor', 'Geçen haftanın ziyaretleri, yeni projeler, siparişler ve kayıplar; PDF, Excel ya da WhatsApp özeti.'],
  kontrol: ['Veri kontrolü', 'Eksik, çelişkili ya da mükerrer kayıtları bulur; çoğunu tek dokunuşla düzeltirsin (birleştir, bağla, tarihi güncelle).'],
  masraflar: ['Masraf ve km', 'Yakıt, yemek, otopark… Fişin fotoğrafını ekleyebilirsin; günlük km ziyaret noktalarından hesaplanır.'],
  dosyalar: ['Dosyalar', 'Yüklediğin belgeler, fotoğraflar, Excel ve PowerPoint çıktıları gruplar halinde.'],
  ayarlar: ['Ayarlar', 'Hesap ve güvenlik, görünüm ve menü, ekip, listeler, veri ve yedek, bağlantılar, mesaj şablonları. Telefonda önce bölümü seç.'],
};
const rota = () => (location.hash.replace(/^#\/?/, '') || 'bugun').split('/')[0];
export function yardimAc(k = rota()) {
  const [t, m] = Y[k] || ['Saha Takip', 'Bu ekranla ilgili açıklama yok.'];
  openDrawer(`<header class="dh"><div><p class="muted">Yardım</p><h2 id="drawer-title">${esc(t)}</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><p class="yardim-m">${esc(m)}</p>
    <h3>Her yerde</h3><ul class="yardim-l"><li><b>+</b> düğmesi: ziyaret, görev, kişi, proje… hızlıca ekle.</li><li><b>Ara</b> (bilgisayarda “/”): bütün kayıtlarda; yazım hatası sorun değil.</li><li>Telefonda satırı <b>sola kaydır</b>: hızlı işlemler. Sayfanın en üstünde <b>aşağı çek</b>: yenile.</li><li>İnternet yokken de çalışır; bekleyen kayıtlar rozette görünür.</li></ul>
    <div class="btnrow"><button type="button" class="btn ghost" data-tanitim>Tanıtımı yeniden göster</button><button type="button" class="btn ghost" data-yenilik>Yenilikler</button></div></div>`);
  document.querySelector('.drawer.open [data-yenilik]').onclick = () => { document.querySelector('.drawer.open [data-close]').click(); setTimeout(() => yenilikleriGoster(true), 300); };
  document.querySelector('.drawer.open [data-tanitim]').onclick = () => { document.querySelector('.drawer.open [data-close]').click(); setTimeout(tanitimGoster, 300); };
}

const ADIM = [
  ['Saha Takip\'e hoş geldin', 'Her sabah <b>Bugün</b> ekranından başla: günün planı, uyarılar ve unutulmaması gerekenler burada.'],
  ['Hızlı ekle', 'Sağ alttaki sarı <b>+</b> düğmesiyle ziyaret, görev, sesli not, kartvizit, proje ya da firma birkaç saniyede eklenir.'],
  ['Menü', 'İlgili ekranlar aynı başlıkta toplanır; örneğin Satış içinde Teklifler, Siparişler, Tahsilat sekmeleri var. Kullanmadıklarını Ayarlar → Görünüm ve menü\'den gizleyebilirsin.'],
  ['Arama ve yardım', 'Büyüteçle bütün kayıtlarda ara. Her ekranın başlığındaki <b>?</b> o ekranın ne işe yaradığını anlatır. Telefonda satırı sola kaydırınca hızlı işlemler çıkar.'],
];
export function tanitimGoster() {
  document.querySelector('.tanitim')?.remove();
  let i = 0;
  const d = document.createElement('div'); d.className = 'tanitim'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Tanıtım');
  const bitir = () => { try { localStorage.setItem('saha-tanitim', '1'); } catch {} d.classList.remove('acik'); setTimeout(() => d.remove(), 200); };
  const ciz = () => {
    const [t, m] = ADIM[i];
    d.innerHTML = `<div class="tn-kutu"><div class="tn-nokta">${ADIM.map((_, j) => `<span class="${j === i ? 'on' : ''}"></span>`).join('')}</div><h2>${t}</h2><p>${m}</p>
      <div class="tn-alt"><button type="button" class="linkbtn" data-atla>${i === ADIM.length - 1 ? '' : 'Atla'}</button><span>${i ? '<button type="button" class="btn ghost" data-geri>Geri</button>' : ''}<button type="button" class="btn primary" data-ileri>${i === ADIM.length - 1 ? 'Başla' : 'İleri'}</button></span></div></div>`;
    d.querySelector('[data-atla]').onclick = bitir;
    d.querySelector('[data-geri]')?.addEventListener('click', () => { i--; ciz(); });
    d.querySelector('[data-ileri]').onclick = () => { if (i === ADIM.length - 1) return bitir(); i++; ciz(); };
    d.querySelector('[data-ileri]').focus();
  };
  document.body.appendChild(d); ciz(); requestAnimationFrame(() => d.classList.add('acik'));
}
export function tanitimGerekirse() { try { if (localStorage.getItem('saha-tanitim')) return; } catch { return; } setTimeout(tanitimGoster, 800); }

// ---------- Yenilikler ----------
// Yeni sürüm ilk açıldığında bir kez: son eklenenler, her birinden ilgili ekrana geçiş. Yardım penceresinden de açılır.
export const YENILIKLER = [
  { s: 74, t: 'Fırsat radarı', m: 'Kaçmak üzere olan işler tek listede: sessiz kalan sıcak projeler, karar vericisi belirsiz projeler, süresi dolan teklifler, uzun süredir gidilmeyen A müşterileri.', r: '#/bugun', d: 'Bugün ve Panel' },
  { s: 75, t: 'Haftalık saha planı', m: 'Günlere bölge seç, önerilerden firmaları güne sürükle ya da "Otomatik dağıt". Her gün için rota.', r: '#/plan', d: 'Bugün → Hafta planı' },
  { s: 76, t: 'Teklif onay bağlantısı', m: 'Teklifi bağlantıyla gönder; müşteri telefonundan onaylar ya da revize ister, teklif kendiliğinden güncellenir.', r: '#/teklifler', d: 'Teklif → Onay bağlantısı' },
  { s: 77, t: 'Bayi portalı', m: 'Bayiler kendi kullanıcısıyla proje bildirir, teklif ister, stok sorar; sana görev olarak düşer.', r: '#/talepler', d: 'Satış → Bayi talepleri' },
  { s: 78, t: 'Konuşarak kaydet', m: '"Yıldız Elektrik\'te Ali Bey\'le görüştüm, teklif istedi, perşembe ara" de: ziyaret ve görev kendiliğinden ayrılır.', r: null, hizli: true, d: '+ → Konuşarak kaydet' },
  { s: 79, t: 'Ekip haritası', m: 'Gün içinde kim nerede giriş yaptı, saat sırasıyla olanlar ve kişi başına özet.', r: '#/ekiphar', d: 'Raporlar → Ekip haritası' },
  { s: 80, t: 'Pazartesi özeti', m: 'Haftanın ilk açılışında geçen hafta, bu hafta ve dikkat edilecekler tek kartta. İstersen pazartesi sabahı bildirim olarak da gelir.', r: '#/bugun', d: 'Bugün' },
  { s: 81, t: 'Kayıp ve rakip', m: 'Hangi rakibe, hangi nedenle, hangi il ve sektörde kaybettiğin; fiyat farkı ve rakibe karşı kazandıkların.', r: '#/rakipanaliz', d: 'Raporlar → Kayıp ve rakip' },
  { s: 83, t: 'Daha hızlı', m: 'Çok kayıt olduğunda Ziyaretler, Teklifler, Panel ve Bugün ekranları belirgin biçimde daha hızlı açılıyor.', r: null, d: '' },
  { s: 86, t: 'Aynı anda düzenleme', m: 'Bir kaydı iki kişi aynı anda değiştirirse farklı alanlar sormadan birleşir; aynı alan değiştiyse yalnızca o alan iki değeriyle sorulur. İnternetsiz değişiklikler de böyle birleşir.', r: null, d: '' },
  { s: 87, t: 'Bugünün soruları', m: 'Bugün ekranında her gün en fazla 3 kısa soru: kayıp nedeni, proje tutarı, gecikmiş tarih, firma segmenti. Yerinde cevapla; radar ve analizler doğru çalışsın.', r: '#/bugun', d: 'Bugün' },
];
const SON_YENILIK = () => Math.max(...YENILIKLER.map(x => x.s));
export function yenilikleriGoster(hepsi = false) {
  let gor = 0; try { gor = +localStorage.getItem('saha-gorulen-surum') || 0; } catch {}
  const l = YENILIKLER.filter(x => hepsi || x.s > gor).sort((a, b) => b.s - a.s);
  if (!l.length) return false;
  const p = openDrawer(`<header class="dh"><div><p class="muted">Sürüm ${SON_YENILIK()}</p><h2 id="drawer-title">Yenilikler</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody"><ul class="yenilik-l">${l.map((x, i) => `<li><div><b>${esc(x.t)}</b>${x.d ? `<small class="muted">${esc(x.d)}</small>` : ''}<p>${esc(x.m)}</p></div>${x.r || x.hizli ? `<button type="button" class="btn sm ghost" data-yi="${i}">Göster</button>` : ''}</li>`).join('')}</ul></div>
    <div class="dfoot sticky"><button type="button" class="btn primary" data-close>Tamam</button></div>`, { onClose: () => { try { localStorage.setItem('saha-gorulen-surum', String(SON_YENILIK())); } catch {} } });
  p.querySelectorAll('[data-yi]').forEach(b => b.onclick = async () => {
    const x = l[+b.dataset.yi]; p.querySelector('[data-close]').click();
    // Pencere kapanırken geçmişte bir adım geri gidilir; yönlendirme ondan sonra
    setTimeout(async () => { if (x.hizli) (await import('./hizli.js')).sesliNot(); else location.hash = x.r; }, 350);
  });
  return true;
}
// Açılışta: tanıtımı hiç görmemişse tanıtım; görmüşse ve yeni sürüm varsa yenilikler (bir kez)
export function acilisYardimi() {
  let tanitim = null, gor = null; try { tanitim = localStorage.getItem('saha-tanitim'); gor = localStorage.getItem('saha-gorulen-surum'); } catch { return; }
  if (!tanitim) { try { localStorage.setItem('saha-gorulen-surum', String(SON_YENILIK())); } catch {} return tanitimGerekirse(); }
  if (gor === null) { try { localStorage.setItem('saha-gorulen-surum', '73'); } catch {} }   // eski kullanıcı: 74 ve sonrasını göster
  setTimeout(() => { if (!document.querySelector('.drawer.open, .tanitim')) yenilikleriGoster(); }, 1200);
}
