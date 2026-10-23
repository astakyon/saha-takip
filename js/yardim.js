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
  katalog: ['Katalog', 'EAE ürün aileleri, kataloglar ve ürün sayfaları.'],
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
    <div class="btnrow"><button type="button" class="btn ghost" data-tanitim>Tanıtımı yeniden göster</button></div></div>`);
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
