// Menü başlıkları: ilgili ekranlar tek başlık altında toplanır, başlığın içinde üstte sekme olarak görünür.
export const BASLIKLAR = [
  { k: 'bugun', t: 'Bugün', ico: 'sun', r: ['bugun', 'takvim', 'plan', 'ziyaretler', 'gorevler', 'onay'] },
  { k: 'harita', t: 'Harita', ico: 'map', r: ['harita', 'bolgeler'] },
  { k: 'projeler', t: 'Projeler', ico: 'folder', r: ['projeler', 'referanslar'] },
  { k: 'firmalar', t: 'Firmalar', ico: 'building', r: ['firmalar', 'kisiler'] },
  { k: 'satis', t: 'Satış', ico: 'receipt', r: ['teklifler', 'siparisler', 'numuneler', 'servis'] },
  { k: 'bayiler', t: 'Bayi ve partner', ico: 'box', r: ['bayiag', 'bayikarne', 'bayistok', 'sevk', 'bayisatis', 'bayihedef', 'bayianaliz', 'talepler'] },
  { k: 'finans', t: 'Finans', ico: 'wallet', r: ['finans', 'cari', 'yaslandirma', 'tahsilat', 'cekler', 'nakit', 'banka', 'masraflar', 'prim', 'kur', 'muhasebe'] },
  { k: 'urunler', t: 'Ürünler', ico: 'box', r: ['urunler', 'katalog', 'rakip', 'araclar'] },
  { k: 'raporlar', t: 'Raporlar', ico: 'chart', r: ['panel', 'uyarilar', 'siralama', 'gunozet', 'ekiphar', 'rakipanaliz', 'rapor', 'eksikler', 'kontrol'] },
  { k: 'dosyalar', t: 'Dosyalar', ico: 'doc', r: ['dosyalar'] },
  { k: 'yonetim', t: 'Yönetim', ico: 'building', r: ['yonetim'] },
  { k: 'ayarlar', t: 'Ayarlar', ico: 'gear', r: ['ayarlar'] },
];
// Başlık içindeki sekme adları (kısa)
export const SEKME_AD = { bugun: 'Bugün', harita: 'Harita', bolgeler: 'Sanayi bölgeleri', projeler: 'Projeler', referanslar: 'Referanslar', firmalar: 'Firmalar', kisiler: 'Kişiler',
  takvim: 'Takvim', rakipanaliz: 'Kayıp ve rakip', ekiphar: 'Ekip haritası', talepler: 'Bayi talepleri', plan: 'Hafta planı', ziyaretler: 'Ziyaretler', gorevler: 'Görevler', teklifler: 'Teklifler', siparisler: 'Siparişler', tahsilat: 'Tahsilat', numuneler: 'Numuneler', servis: 'Servis',
  sirket: 'Şirket profili', profilim: 'Profilim', gunozet: 'Gün özeti', bayiag: 'Ağ', bayikarne: 'Bayi karnesi', onay: 'Onay kuyruğu', uyarilar: 'Uyarılar', siralama: 'Ekip sıralaması', cekler: 'Çek ve senet', nakit: 'Nakit akışı', banka: 'Banka ekstresi', prim: 'Prim ve hedef', bayistok: 'Stoklar', sevk: 'Sevk', bayisatis: 'Satışlar', bayihedef: 'Hedef ve prim', bayianaliz: 'Analiz', finans: 'Özet', cari: 'Cari hesaplar', yaslandirma: 'Yaşlandırma', kur: 'Kur', muhasebe: 'Muhasebeye aktar', urunler: 'Ürün ve fiyat', bayi: 'Bayi stokları', katalog: 'Katalog', rakip: 'Rakip fiyatları', araclar: 'Hesap araçları', panel: 'Panel', rapor: 'Haftalık rapor', eksikler: 'Eksik bilgiler', kontrol: 'Veri kontrolü', masraflar: 'Masraf ve km', dosyalar: 'Dosyalar', yonetim: 'Yönetim' };
export const baslikOf = rota => BASLIKLAR.find(b => b.r.includes(rota)) || null;
export const VARS_ANA = ['bugun', 'harita', 'projeler', 'firmalar', 'satis'];

// Bugün ekranının kartları (rol görünümü ve kart düzeni için)
export const BUGUN_KARTLAR = [['ozet', 'Bugün özeti'], ['mazeret', 'Yapılmayan planlı ziyaretler'], ['etiket', 'Seni etiketlediler'], ['plan', 'Bugünün planı'], ['radar', 'Fırsat radarı'], ['eksik', 'Bugünün soruları'], ['uyari', 'Uyarılar'], ['gorev', 'Görevler'], ['yapilan', 'Bugün yapılanlar'], ['zaman', 'Zamanı gelen projeler'], ['gidilmeyen', 'Uzun süredir gidilmeyenler'], ['yarin', 'Yarın'], ['dogum', 'Doğum günleri'], ['rapor', 'Pazartesi özeti']];
