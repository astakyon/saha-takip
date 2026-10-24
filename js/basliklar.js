// Menü başlıkları: ilgili ekranlar tek başlık altında toplanır, başlığın içinde üstte sekme olarak görünür.
export const BASLIKLAR = [
  { k: 'bugun', t: 'Bugün', ico: 'sun', r: ['bugun'] },
  { k: 'harita', t: 'Harita', ico: 'map', r: ['harita', 'bolgeler'] },
  { k: 'projeler', t: 'Projeler', ico: 'folder', r: ['projeler', 'referanslar'] },
  { k: 'firmalar', t: 'Firmalar', ico: 'building', r: ['firmalar', 'kisiler'] },
  { k: 'takvim', t: 'Takvim', ico: 'cal', r: ['takvim', 'ziyaretler', 'gorevler'] },
  { k: 'satis', t: 'Satış', ico: 'receipt', r: ['teklifler', 'siparisler', 'tahsilat', 'numuneler', 'servis'] },
  { k: 'urunler', t: 'Ürünler', ico: 'box', r: ['urunler', 'bayi', 'katalog', 'rakip', 'araclar'] },
  { k: 'raporlar', t: 'Raporlar', ico: 'chart', r: ['panel', 'rapor', 'kontrol'] },
  { k: 'masraflar', t: 'Masraf ve km', ico: 'wallet', r: ['masraflar'] },
  { k: 'dosyalar', t: 'Dosyalar', ico: 'doc', r: ['dosyalar'] },
  { k: 'yonetim', t: 'Yönetim', ico: 'building', r: ['yonetim'] },
  { k: 'ayarlar', t: 'Ayarlar', ico: 'gear', r: ['ayarlar'] },
];
// Başlık içindeki sekme adları (kısa)
export const SEKME_AD = { harita: 'Harita', bolgeler: 'Sanayi bölgeleri', projeler: 'Projeler', referanslar: 'Referanslar', firmalar: 'Firmalar', kisiler: 'Kişiler',
  takvim: 'Takvim', ziyaretler: 'Ziyaretler', gorevler: 'Görevler', teklifler: 'Teklifler', siparisler: 'Siparişler', tahsilat: 'Tahsilat', numuneler: 'Numuneler', servis: 'Servis',
  urunler: 'Stok ve fiyat', bayi: 'Bayi paneli', katalog: 'Katalog', rakip: 'Rakip fiyatları', araclar: 'Hesap araçları', panel: 'Panel', rapor: 'Haftalık rapor', kontrol: 'Veri kontrolü', masraflar: 'Masraf ve km', dosyalar: 'Dosyalar', yonetim: 'Yönetim' };
export const baslikOf = rota => BASLIKLAR.find(b => b.r.includes(rota)) || null;
export const VARS_ANA = ['bugun', 'harita', 'projeler', 'takvim', 'firmalar'];
