# Saha Takip

Aydınlatma satışı için saha uygulaması: Adana, Mersin, Hatay ve Osmaniye haritasında proje ve firma raptiyeleri, il sınırları ve çizilebilen sanayi bölgeleri; tüm paydaşların (yatırımcı, projeci, danışman, Gemüt, Emüt, alıcı, bayi) tek tabloda göründüğü proje listesi; haftalık ziyaret takvimi ve ziyaret sonuçları; firma ve kişi kartları (kartvizit fotoğrafıyla); bayi stok tutarları ve birim fiyatlar; cari, proje ve SAS numarasına göre siparişler ve hedef paneli.

Telefonda ve bilgisayarda çalışır, telefona uygulama olarak eklenebilir. Veriler Supabase'de tutulur; bu depoda yalnızca uygulamanın kodu var, müşteri verisi yok.

**Adres:** https://astakyon.github.io/saha-takip/

## Kurulum

### 1. GitHub Pages'i aç (bir kez)

Depoda **Settings → Pages → Build and deployment**:
- Source: **Deploy from a branch**
- Branch: **main**, klasör **/ (root)** → **Save**

1–2 dakika sonra uygulama yukarıdaki adreste açılır. Bundan sonra `main` dalına gelen her değişiklik siteyi kendiliğinden günceller.

### 2. Supabase'i hazırla (bir kez)

1. Supabase projende **SQL Editor → New query**: [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yapıştır, **Run**. Tekrar çalıştırmak zarar vermez.
2. **Authentication → Sign In / Providers → Email**: tek kullanıcıyken en kolayı **Confirm email** seçeneğini kapatmak. Açık bırakacaksan **Authentication → URL Configuration → Site URL** alanına `https://astakyon.github.io/saha-takip/` yaz ki onay bağlantısı doğru sayfaya dönsün.
3. **Project Settings → API**: **Project URL** ve **anon public** anahtarını kopyala. `service_role` anahtarını hiçbir yere girme.

### 3. İlk açılış

1. Uygulamayı aç; **Ayarlar** ekranına Project URL ve anon public anahtarı yapıştır → **Supabase'e bağlan**.
2. E-posta ve şifreyle **Hesap oluştur**, sonra **Giriş yap**.
3. **Başlangıç verisi dosyasını seç** → sana ayrıca verilen `baslangic-verisi.json` (233 proje, 191 firma, 166 sipariş, 252 ürün). Bu dosya müşteri bilgisi içerdiği için **depoya yüklenmez**; `.gitignore` bunu engeller.
4. Telefonda aynı adresi açıp aynı hesapla giriş yap, sonra uygulamayı yükle:
   - Android/Chrome: alttaki **“Saha Takip'i telefona yükle”** şeridinde **Yükle** (ya da **Diğer → Telefona yükle**, ya da Chrome menüsü → **Uygulamayı yükle**)
   - iPhone/Safari: paylaş → **Ana Ekrana Ekle**
   - Simgeye uzun basınca **Ziyaret kaydet · Harita · Takvim · Projeler** kısayolları çıkar. APK dosyası ve Play Store için: [`docs/ANDROID.md`](docs/ANDROID.md)

## Güncelleme notu (sürüm 37): genel sürüm, kurulum sihirbazı, geri bildirim
**Bir kez:** Supabase SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (şema sürüm 18).

- **Firma profili:** uygulama artık tek bir firmaya bağlı değil. Firma adı, sektör (aydınlatma, elektrik malzemesi ve tesisat, diğer), temsil edilen marka, çalışılan iller (Türkiye'nin 81 ili), ana bayi ve rakip markalar profilden gelir. Harita, il filtreleri, konum bulma, sanayi bölgesi arama, teklif başlığı, sipariş kanalı ("bayi üzerinden / harici") ve proje formu bu profile göre çalışır. Ekip üyeleri veri sahibinin profilini kullanır.
- **Kurulum sihirbazı:** yeni bir hesap ilk açıldığında beş adımlık kısa kurulum gelir (firma, sektör, iller, bayi ve rakipler, özet). Aydınlatma dışı sektörde aydınlatma hesap araçları menüde gizli başlar. Sonradan Ayarlar → Firma profili → Düzenle.
- **Eski kurulum değişmez:** profili olmayan ve kaydı bulunan hesap (bu uygulamanın ilk sahibi) eskisi gibi EAE kataloğu, Çukurova bölgesi ve Drv Elektrik ile çalışır. Ayarlar → Firma profili'nden "Hazır EAE kataloğu / Kendi kataloğum" seçilebilir.
- **Katalog:** hazır EAE kataloğu, ürün önerisi ve şartname karşılaştırması yalnızca EAE kataloğunu kullanan hesapta açıktır. Diğerleri kendi ürün ailelerini ve katalog bağlantılarını ekler.
- **Geri bildirim:** + menüsü ve Ayarlar → Uygulama'dan "Geri bildirim". Tür (hata, öneri, soru, beğendim), açıklama ve isteğe bağlı ekran görüntüsü; ekran, sürüm ve telefon türü otomatik eklenir.
- **Uygulama yöneticisi:** SQL Editor'de kendini yönetici olarak eklersin. Yönetici Ayarlar → Uygulama'da gelen bütün geri bildirimleri (durumunu değiştirerek, e-postayla yanıtlayarak) ve bütün kullanıcıların hata günlüğünü görür, test davet bağlantısı oluşturur.

### Test edecek kişiler için ayrı veritabanı (önerilen)
Test edenler senin müşteri verilerinle aynı veritabanında olmasın:
1. supabase.com'da yeni bir proje aç (ör. `saha-takip-deneme`, ücretsiz plan yeterli).
2. SQL Editor'de `supabase/schema.sql` dosyasının tamamını çalıştır.
3. Aynı yerde kendini yönetici olarak ekle (e-postanı yaz): `insert into public.uygulama_yoneticileri values ('senin@epostan.com');`
4. Authentication → URL Configuration: Site URL ve Redirect URLs'e `https://astakyon.github.io/saha-takip/` yaz. Authentication ayarlarında e-postayla girişin (Email) ve yeni kullanıcı kaydının ("Allow new users to sign up") açık olduğunu kontrol et. E-posta onayı açıksa test edenler gelen onay bağlantısına dokunur.
5. Bilgisayarda başka bir tarayıcıda (ya da gizli pencerede) uygulamayı aç, Ayarlar → Hesap → Bağlantı ayarları'na yeni projenin adresini ve anon anahtarını gir, kendine bir hesap aç.
6. Ayarlar → Uygulama → Test daveti'ndeki bağlantıyı test edenlere gönder. Bağlantıyı açan kişi "İlk giriş"te kendi hesabını açar, kurulum sihirbazını doldurur ve kendi verisini girer; birbirlerinin verisini görmezler.
7. Geri bildirimler ve hatalar aynı tarayıcıda Ayarlar → Uygulama'da toplanır.

## Güncelleme notu (sürüm 36): satış araçları
- **Hedefe kalan (Panel):** bu çeyreğin hedefine kalan tutar, kalan gün ve hafta, haftada gereken sipariş. Altında bunu karşılayabilecek projeler sıralanır: bu çeyrekte beklenenler ve Sıcak olanlar önce gelir, olasılıkla ağırlıklı toplam da hesaplanır. Hedef girilmemişse kart doğrudan hedef formunu açar.
- **EAE fiyat listesi (Teklifler ve Stok ekranında "Fiyat listesi"):** yeni liste Excel'i yüklenir; sütunlar ilk seferde sorulur ve hatırlanır. Açık teklifler (Taslak ve Gönderildi) kalem kalem yeni fiyatlarla karşılaştırılır: eski ve yeni toplam, fark ve yüzde gösterilir. Her teklif tek dokunuşla ya da hepsi birlikte yeni fiyatlara çekilir; adet ve iskontolar korunur, teklif notuna tarih düşülür. Stok listesindeki fiyatlar da istenirse güncellenir. Fark tablosu Excel'e alınabilir.
- **Şantiye tabelasından proje (Projeler → "Tabeladan proje" ve + menüsü):** tabelanın fotoğrafındaki yazı okunur. Proje adı, yapı sahibi, müteahhit, elektrik yüklenicisi, proje müellifi, kontrollük ve il ayrılır. Ruhsat, ada-parsel, yapı denetim ve bitiş tarihi notlara yazılır. Firmalar kayıtlı firmalarla eşleşir; olmayanlar istenirse yeni firma olarak eklenir. Tabela fotoğrafı projeye eklenir ve yeni proje formu dolu açılır. Okuma motoru kartvizit okumada kullanılanla aynıdır.

## Güncelleme notu (sürüm 35): uygulamanın sağlığı
**Bir kez:** Supabase SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (şema sürüm 17).
- **Hata günlüğü:** senin ya da ekibinin telefonunda bir hata olursa kısa bir kayıt otomatik olarak Supabase'e yazılır. Kayıtta hata metni, ekran, sürüm ve telefon türü bulunur; kayıtların içeriği yazılmaz. Günlüğü yalnızca sen görürsün: Ayarlar → Uygulama → Hata günlüğü. Aynı hatalar gruplanır, "Kopyala" ile bildirebilirsin. 90 günden eski kayıtlar kendiliğinden silinir. İnternet yokken kayıt telefonda bekler.
- **Kullanım ölçümü:** hangi ekranı ne sıklıkla açtığın yalnızca o cihazda sayılır, hiçbir yere gönderilmez. Ayarlar → Görünüm ve menü → Kullanım. 3 hafta sonra hiç açmadığın ekranlar menüden kaldırılmak üzere önerilir.
- **Otomatik testler:** GitHub her gönderimde `tests/calistir.mjs` testlerini çalıştırır. Sonuç depodaki Actions sekmesinde görünür. Testler kodu, çevrimdışı dosya listesini, her ekranın açılmasını, ekip üyesi yetkilerini, girişi ve hata günlüğünü denetler. Gerçek müşteri verisi kullanılmaz.

## Güncelleme notu (sürüm 34): giriş ve kullanıcı adı
**Bir kez:**
1. Supabase SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (şema sürüm 16).
2. Supabase → Authentication → URL Configuration ekranında **Site URL** olarak `https://astakyon.github.io/saha-takip/` yaz. Aynı adresi **Redirect URLs** listesine de ekle. Bu ayar yapılmazsa e-postadaki bağlantılar uygulamaya dönmez.

Giriş ekranında üç sekme var:
- **Şifreyle:** e-posta ya da kullanıcı adıyla girilir. Şifre "Göster" ile görünür olur. Ad bu cihazda hatırlanır. "Şifremi unuttum" e-postaya yenileme bağlantısı gönderir; bağlantı uygulamayı yeni şifre ekranıyla açar.
- **Bağlantıyla:** şifresiz giriş. E-postaya tek kullanımlık bir giriş bağlantısı gelir. Yalnızca zaten hesabı olan kişiler kullanabilir.
- **İlk giriş:** davet edilen kişi şifresini iki kez yazarak belirler. Şifre en az 8 karakter olmalı, harf ve rakam içermeli.

Diğer değişiklikler:
- Ayarlar → Hesap → Giriş bilgileri: kendi kullanıcı adını belirlersin ve şifreni değiştirirsin.
- Ekip ve yetkiler: her kişiye kullanıcı adı verilebilir. Davet mesajı adım adım yazıldı.
- Not: giriş ekranı kullanıcı adını e-postaya kendisi çevirir. Bu yüzden veritabanı adresini ve herkese açık anahtarı bilen biri (örneğin davet bağlantısını gören), bir kullanıcı adının e-posta adresini öğrenebilir ve o adrese giriş ya da yenileme bağlantısı gönderilmesini isteyebilir. Şifre ve kayıtlar açılmaz.

## Güncelleme notu (sürüm 33): ayrıntılı yetkiler
**Bir kez:** Supabase SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (şema sürüm 15).
- Ayarlar → Ekip ve yetkiler: her kişi için 23 ekranın her biri ayrı ayrı **Kapalı / Görür / Düzenler** olarak ayarlanır. Ekranlar menü başlıklarına göre gruplanmıştır. Bir başlığın tamamı tek dokunuşla açılıp kapatılabilir.
- Hazır şablonlar: Bayi, Saha ekibi, Proje firması, Sadece görüntüleme, Tam yetki.
- Açık ekranlarda da gizlenebilecekler: tutar ve fiyatlar, kişilerin telefon ve e-postası, yorumlar, firma ilişki ağı.
- Kapalı ekran şu yerlerin hiçbirinde görünmez: menü, arama, + menüsü, Bugün kartları, proje ve firma kartındaki sekmeler, bölümler ve düğmeler, harita katmanları. Adres çubuğuna yazılsa da açılmaz.
- Sunucu tarafı: kapalı ekranın kayıtları, fotoğrafları, belgeleri ve proje ayarları kişinin telefonuna hiç gönderilmez. Ayarlarından yalnızca ortak olanlar paylaşılır: Google anahtarı, şablonlar, listeler, kur.
- **Bu kişi gibi gör:** kişinin ekranını kendi telefonunda önizlersin. Önizlemede değişiklik kaydedilmez.
- Not: "Tutar gizli" ve "telefon gizli" yalnızca görüntüyü gizler; o ekranın verisi kişinin telefonuna yine gelir. Bayinin yalnızca kendi siparişlerini görmesi gibi kayıt bazında süzme şu an yok.

## Güncelleme notu (sürüm 32) — yardım, bildirim tercihleri, son kontrol

**Supabase'de bir kez (bildirim tercihleri için):** SQL Editor'de güncel `schema.sql` (sürüm 14), sonra Edge Functions → bildir → Code'a güncel `supabase/functions/bildir/index.ts` → Deploy. Sıra önemli: önce SQL.

- **Tanıtım:** ilk açılışta 4 adımlık kısa tanıtım (Bugün, + düğmesi, menü, arama ve yardım). Yardım penceresinden yeniden gösterilebilir.
- **Ekran yardımı:** her ekranın başlığındaki **?** o ekranın ne işe yaradığını ve her yerde geçerli kısayolları anlatır.
- **Boş ekranlar:** kayıt yoksa ekranın ana düğmesi (Yeni teklif, Yeni firma…), filtre yüzünden boşsa “Filtreleri temizle” düğmesi.
- **Bildirim tercihleri (Ayarlar → Bağlantılar → Bildirimler):** bu cihaza hangi anlık bildirimlerin geleceği (görev atandı, görev tamamlandı, yorumda etiketlendim) ve günlük özete hangi başlıkların gireceği (ziyaretler, görevler, doğum günleri, tahsilat, teklifler, dünkü siparişler).
- **Son kontrol:** bütün ekranlar telefon ve bilgisayarda; açık, koyu tema ve büyük yazıyla tek tek gözden geçirildi.

## Güncelleme notu (sürüm 31) — formlar, veri kalitesi, arama, çıktılar

- **Kaydedilmemiş değişiklik uyarısı:** formda bir şey değiştirip kaydetmeden kapatınca (çarpı, Esc ya da telefonun geri tuşu) sorulur.
- **Telefon biçimi:** numaralar tek biçime getirilir (5321112233 → 0532 111 22 33); hane sayısı tutmazsa altında uyarı çıkar.
- **Kayıt anında mükerrer uyarısı:** aynı firmada aynı adlı ya da aynı telefonlu kişi, aynı adlı proje kaydedilirken sorulur. Konumsuz kaydedilen projede “Konum ata” hatırlatması.
- **Sipariş–firma eşleştirme:** Veri kontrolü → “Carisi firma listesinde olmayan siparişler” artık cari adına göre firma önerir; “Bağla” o carinin bütün siparişlerini bağlar ve sonraki SAS yüklemelerinde aynı cari kendiliğinden bağlanır.
- **Arama:** Türkçe karakter farkı ve tek harflik yazım hatası sorun değil (cukurva → Çukurova); genel aramada son açılan kayıtlar listelenir.
- **Excel çıktıları:** tarihler Excel'de tarih, tutarlar sayı olarak açılır (sıralama ve toplam alınabilir).
- **PDF teklif ve rapor:** tablo başlığı her sayfada tekrar eder, satırlar sayfa arasında bölünmez, renkler yazıcıda da çıkar.

## Güncelleme notu (sürüm 30) — Bugün, pencereler, telefon

- **Bugün özeti:** boş kartlar (plan, görev, yapılanlar, yarın) tek “Bugün özeti” kartında; uyarılar üstte; uzun listeler ilk 5 satır + “Tümünü gör”.
- **Proje ve firma pencereleri:** üstte üç ana düğme, kalanı ve Sil “⋯ Diğer” menüsünde; sekmeler kaydırınca başlığın altında yapışık kalır.
- **Geri tuşu:** telefonun geri tuşu açık pencereyi kapatır, uygulamadan çıkmaz.
- **Sola kaydır:** Firmalar ve Kişiler listesinde satırı sola kaydırınca Ara, WhatsApp, Ziyaret ekle, Yol tarifi.
- **Aşağı çek:** sayfanın en üstünde aşağı çekince buluttaki yeni kayıtlar alınır ve ekran yenilenir.

## Güncelleme notu (sürüm 29) — Ayarlar

- **Bölüm listesi:** Hesap ve güvenlik · Görünüm ve menü · Ekip ve yetkiler · Listeler · Veri ve yedek · Bağlantılar (Google, döviz kuru, bildirimler) · Mesaj ve teklif · Uygulama (sürüm, telefona yükle, araç, gizli mod) · Dikkat (tüm verileri silme). Bilgisayarda solda liste, sağda bölüm; telefonda önce liste, dokununca bölüm (‹ Ayarlar ile geri).
- Menü düzeni tablosu katlanır; tüm verileri silme ayrı “Dikkat” bölümünde.

## Güncelleme notu (sürüm 28) — harita

- **Üst çubuk tek satır:** arama, Katmanlar ve Araçlar. Seçili il, aramanın yanında sarı bir etiket olarak görünür; dokununca kaldırılır.
- **Araçlar menüsü:** Konum ata (bekleyen sayısıyla), Raptiye taşı, Bölge çiz, Google'da ara, İçe aktar, Sanayi bölgeleri listesi — her birinin ne yaptığı altında yazar.
- **Katmanlar:** il, haritada gösterilecekler, aşamalar ve takip yılı, harita görüntüsü (Google uydu / Google harita / Esri uydu / sokak haritası) ve çevrimdışı bilgisi tek pencerede. Telefonda alttan açılır.
- **Raptiye balonu:** üç eşit düğme (Aç, Ziyaret ekle, Yol tarifi); Konumu taşı, Google'da bul ve firmada Ara küçük bağlantı olarak altta.

## Güncelleme notu (sürüm 27) — menü ve ortak ekran düzeni

- **Menü 11 başlıkta:** Bugün · Harita (+ Sanayi bölgeleri) · Projeler (+ Referanslar) · Firmalar (+ Kişiler) · Takvim (+ Ziyaretler, Görevler) · Satış (Teklifler, Siparişler, Tahsilat, Numuneler, Servis) · Ürünler (Stok ve fiyat, Bayi paneli, Katalog, Rakip fiyatları, Hesap araçları) · Raporlar (Panel, Haftalık rapor, Veri kontrolü) · Masraf ve km · Dosyalar · Ayarlar. Başlığın içindeki ekranlar üstte sekme olarak durur; başlık en son açtığın sekmeyi hatırlar.
- **Menüyü düzenle:** ekranlar tek tek gizlenir, ana çubuk (telefonda alt çubuk) başlıklardan seçilir; eski ayarların otomatik çevrilir.
- **Sade başlıklar:** her ekranda ana düğme (Yeni …) ve görünüm seçici görünür, Excel'e aktar, Toplu düzelt, Sütunlar gibi ikincil işler “⋯ Diğer” menüsünde.
- **Arama düğmesi** artık listelerin üstüne binmiyor: telefonda sayfanın sağ üstünde; ekranda yalnızca + kaldı.
- **Kayıtlı filtre çubuğu** yalnızca kayıtlı filtre varken ya da filtre değiştirildiğinde görünür.
- **Telefonda Projeler kart görünümüyle açılır** (Tablo'yu seçersen hatırlanır); Firmalar listesinde boş “—” alanları kalktı; bildirim kutusu + düğmesinin altında kalmaz; bekleyen kayıt rozeti telefonda + düğmesinin üstünde.

## Güncelleme notu (sürüm 26) — hız

- **Anında açılış:** uygulama dosyaları ve kütüphaneler telefonda saklanır, açılışta internetten indirilmez; kayıtlar önce telefondaki kopyadan gösterilir, buluttaki yenisi arkada gelir. Yeni sürüm yayınlanınca kendiliğinden kurulur (uygulama arka plandayken yenilenir ya da “yeni sürüm hazır” yazar).
- **Ekranlar ve Excel aracı ancak açılınca yüklenir:** ilk yükleme ~2 MB'tan birkaç yüz KB'a iner.
- **Hızlı eşitleme:** tablolar aynı anda iner; yenilemede yalnızca son değişen kayıtlar çekilir, başka cihazda silinenler ayıklanır.
- **Aynı anda düzenleme:** bir kaydı sen açtıktan sonra başkası değiştirdiyse kaydederken sorulur; üzerine yazma ile veri kaybı olmaz.
- **Bekleyen kayıtlar:** sağ üstteki rozete dokununca internet yokken yapılan ve henüz gönderilmeyen değişiklikler, gönderilemeyenlerin nedeni, “Şimdi gönder”.
- **Uzun listeler parça parça:** Firmalar, Kişiler, Stok ve fiyat, Siparişler kaydırdıkça gelir; ekranlar arası geçişte kaydırma konumu korunur.
- **Harita bir kez kurulur:** sekmeye dönünce anında açılır; yalnızca değişen raptiyeler yeniden çizilir.
- **Fotoğraf önizlemeleri:** yeni yüklenen fotoğrafların küçük kopyası da saklanır; listelerde o gösterilir, kişi avatarları ekrana gelince yüklenir.
- **Otomatik yedek (Ayarlar → Veri ve yedek):** açarsan haftada bir bütün kayıtlar Supabase'de yalnızca senin görebildiğin klasöre yedeklenir, son 8 yedek tutulur. Açmak için SQL Editor'de güncel `schema.sql` dosyasını bir kez çalıştır (sürüm 13).

## Güncelleme notu (sürüm 23)

**Supabase'de bir kez:** SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 12: yorumlar tablosu, etiketlenecek kişi listesi, aday proje alanları). Etiketlenen kişiye anlık bildirim için `bildir` Edge Function'ını güncel `supabase/functions/bildir/index.ts` ile yeniden yayınla (Edge Functions → bildir → Code → yapıştır → Deploy).

- **Yorumlar ve etiketleme:** Proje kartında “Yorumlar” sekmesi, firma kartında Yorumlar bölümü. Ekipten kişileri seçerek etiketle; etiketlenen kişi Bugün ekranında “Seni etiketlediler” kartını ve (kuruluysa) bildirim görür. Kaydı görebilen herkes yorum yazabilir, yorumu yazanı ya da veri sahibi siler.
- **Aday projeler (Projeler → Adaylar):** EKAP ihale ilanları, inşaat ruhsatları, duyumlar elle ya da Excel'den eklenir (sütunlar ilk yüklemede sorulur, aynı adlı olanlar atlanır). Adaylar ana listede, haritada ve raporlarda görünmez; “Takibe al” ile projeye dönüşür.
- **Kart / tablo görünümü ve sütunlar (Projeler):** Tablo, Kart ve Satış hunisi arasında geçiş; “Sütunlar” ile tabloda görünecek sütunları seç (olasılık, beklenen tarih, şantiye aşaması, son güncelleme de eklenebilir); sütun başlığına dokunarak sırala.
- **Firma ilişki ağı (firma kartı):** Aynı projelerde yer alan firmalar şema ve listeyle; “Bir firmaya kimin üzerinden ulaşırım?” ile hedef firmaya giden en kısa tanıdık zinciri.
- **Geçen yılla karşılaştırma (Panel):** Çeyrek ve firma bazında bu yıl / geçen yıl, geçen yılın aynı gününe kadar karşılaştırma, geçen yıl alıp bu yıl sipariş vermeyenler. Geçen yılın SAS sipariş raporunu Siparişler'den yükleyince dolar.
- **Ürün kodu okuma (Stok ve fiyat → Kodu oku, + menüsü):** Android Chrome'da kamerayla canlı barkod / QR; iPhone'da etiketin fotoğrafından yazı okuma. Stok kodu ya da açıklama eşleşirse Drv stoğu, fiyat ve EAE ürün sayfası.
- **Çevrimdışı harita:** Gezdiğin harita karoları kaydedilir (en fazla ~8000). Haritada bir sanayi bölgesinin balonundan “Çevrimdışı için indir” ile o OSB'nin karoları önceden indirilir (yakınlaştırma 13–16, en fazla ~300 karo; Google katmanı koşulları gereği indirilmez, Esri uydu ya da sokak haritası indirilir).

## Güncelleme notu (sürüm 22)

**Supabase'de bir kez:** SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 11). Ekip üyelerinin son girişi bunun için gerekir. İki adımlı doğrulama için Authentication → Multi-Factor'da **TOTP** açık olmalı (varsayılan açık).

- **Ayarlar → Listeler:** firma tipleri, rakip markaları, kayıp nedenleri, ziyaret amaçları, sektörler, ürün aileleri, masraf ve servis türleri eklenir, sıralanır, yeniden adlandırılır; ad değişince eski kayıtlar da istenirse yeni adla güncellenir. Proje aşamalarının rengi ve varsayılan kazanma olasılığı da buradan.
- **Güvenlik (Ayarlar → Genel):** son giriş zamanı; iki adımlı doğrulama (Google/Microsoft Authenticator); bu cihazda kullanılmayınca otomatik çıkış (15 dk – 1 gün, çıkışta cihazdaki kayıt kopyası silinir); “Tüm cihazlarda çıkış yap” (telefon kaybolursa).
- **Kullanıcılar:** her üyenin son kullanım zamanı; “Excel'e aktarabilir ve sunum çıktısı alabilir” izni (varsayılan kapalı). Yedek alma yalnızca veri sahibinde.

## Güncelleme notu (sürüm 21)

- **Ürün önerisi (Proje → Satış):** proje adı/notundan alan tahmini (üretim, depo, nemli alan, Ex, ofis, çevre, AVM/hastane, kanopi); uygun EAE aileleri, Drv stoğu ve ürün sayfası bağlantısı. Alan elle değiştirilebilir.
- **Şartname kontrolü (Proje → Satış):** IP, IK, lm/W, CRI, renk sıcaklığı, garanti, sertifika, DALI gir; son revizyon teklif kalemleri ✓ / ✗ / ? olarak karşılaştırılır.
- **Şantiye fotoğrafları (Proje → Belgeler):** “Şantiye fotoğrafı çek” → aşama sorulur, ziyaret olarak kaydedilir, tarih sırasıyla zaman çizelgesi.
- **Toplu duyuru (Firmalar → Toplu duyuru):** tip/il/segment/key account süzgeci, şablon ya da kendi mesajın ({ad}, {firma}); her alıcı için hazır WhatsApp mesajı, “Sıradakini aç”; gönderim firmanın ziyaret geçmişine not düşer.
- **Rakip fiyat eğilimi (Rakip fiyatları → Analiz):** aynı aile ve markada ilk ve son USD fiyatı, % değişim.
- **Ziyaret yoğunluğu (Harita → Katmanlar):** sanayi bölgeleri son 90 gündeki ziyaret sayısına göre, firmalar son ziyaret tarihine göre renklenir.

## Güncelleme notu (sürüm 20)

- **Toplu düzeltme (Projeler → Toplu düzelt):** satırlara dokunarak seç; aşama, takip yılı, il, kanal/bayi, hedef listesi, kritik tek seferde değişir; aşama değişikliği durum geçmişine “Toplu düzeltme” notuyla yazılır.
- **Para karşılığı:** USD tutar alanlarının altında TL karşılığı; para birimi seçilen formlarda (sipariş, tahsilat) diğer para birimi.
- **Bugün kartları:** Bugün → Düzenle: kartları sırala, istemediğini gizle.
- **Sesli not (+ menüsü):** konuşarak not; firma/proje seçilirse ziyaret notu, seçilmezse görev.
- **Kişi birleştirme (Veri kontrolü → Kişiler):** aynı ad ya da telefonlu kişiler; bağlı ziyaret, görev, teklif taşınır.
- **İçe aktarma önizlemesi:** sipariş, cari ekstresi ve stok Excel'inde kaç kayıt ekleneceği/güncelleneceği önce gösterilir; stokta listede olmayanları sıfırlama seçimi.

## Güncelleme notu (sürüm 19) — kısmen yapılanlar tamamlandı

- **Bekleyen kayıt rozeti:** İnternetsizken girilen kayıt sayısı menüde (telefonda sağ üstte) görünür; gönderilince “Bekleyen kayıtlar gönderildi”.
- **Teklif revizyonu ve kazanma oranı:** Teklifte “Revize et” → aynı numaraya -R2, -R3…; teklifte revizyon listesi; Teklifler ekranında kazanma oranı (her teklifin son revizyonu sayılır).
- **Günlük bildirime teklif ve sipariş:** Sabah özetinde geçerliliği 2 gün içinde dolan teklifler ve dün gelen siparişler.
- **Değişiklik geçmişinde “Geri al”:** Değişen alanlar eski haline döner.
- **Enerji tasarrufu PowerPoint:** Aydınlatma araçları → Enerji tasarrufu → “PowerPoint sunumu” (3 slayt).
- **Km → masraf:** Bugün ekranında “Masrafa yaz”; dünün yolu yazılmadıysa Uyarılar'da hatırlatma. Tutar için Ayarlar → Genel → Araç (litre/100 km, litre fiyatı).
- **Harita:** Proje ve firma raptiyesinden doğrudan “Ziyaret ekle”.
- **Yazı boyutu:** Ayarlar → Genel → Görünüm → Normal / Büyük / Çok büyük.
- **Hız:** Projeler listesi 80'er satır çizilir, “daha fazla göster”.

## Güncelleme notu (sürüm 18) — anlık bildirim (bir kez kurulum)

1. Supabase SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (şema sürüm 10: `push_abonelikleri`).
2. Uygulamada Ayarlar → Genel → Bildirimler → **Anahtar üret**; üç değeri (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) Supabase → Edge Functions → **Secrets**'a ekle.
3. Edge Functions → Deploy a new function → Via Editor → adı **bildir** → `supabase/functions/bildir/index.ts` içeriğini yapıştır → Deploy.
4. Uygulamada “Kurulumu kontrol et” → “Bu cihazda aç”. Ekip üyeleri de kendi telefonlarında “Bu cihazda aç”a dokunur.

Görev bir ekip üyesine atanınca ona, ekip üyesi görevi tamamlayınca veri sahibine bildirim gider. iPhone'da yalnızca ana ekrana eklenmiş uygulamada (iOS 16.4+) çalışır.

## Güncelleme notu (sürüm 17)

- **Koyu tema (Ayarlar → Genel → Görünüm):** Açık · Koyu · Cihaza göre. Seçim hesapta saklanır, tüm cihazlarda geçerli olur.

## Güncelleme notu (sürüm 16)

- **Bayi paneli (Satış → Bayi paneli):** bayinin stok adetleri −/+ ya da yazarak tek tek güncellenir (anında kaydedilir, stok geçmişine işlenir); tekliflere yetmeyen stok, bayinin siparişleri ve bayi üzerinden giden açık projeler. Rolü “Bayi” olan ekip üyesinin ana çubuğunda ikinci sırada çıkar. Stok yetkisi “Görür” ise yalnızca görüntüler.
- **Rol / ünvan:** Ayarlar → Kullanıcılar'da açılır listeden seçilir ya da “Başka (yaz)”.
- **Uygulama sürümü ve “Şimdi güncelle”:** Ayarlar → Genel.

## Güncelleme notu (sürüm 15)

- **Proje sayfasında sekmeler:** Bilgiler · Ziyaret ve görev · Teklif ve sipariş · Belgeler · Geçmiş. Sekmede kayıt sayısı görünür; aynı proje yeniden açılınca son sekme hatırlanır. Kaydet her sekmede çalışır.
- **Görevler:** takvimde ve listede atanan kişi, tamamlanma durumu ve tarihi; kişiye göre süzgeç.

## Güncelleme notu (sürüm 14) — SQL gerekir

1. **Önce SQL:** Supabase → SQL Editor → güncel `supabase/schema.sql` dosyasının tamamını yapıştır → Run (şema sürüm 9).
2. **Görev atama:** Görev formunda “Kime atandı”. Atanan ekip üyesi görevi kendi Bugün ekranında görür (görevler bölümüne yetkisi olmasa da) ve tamamlar; tamamlayınca senin Bugün → Uyarılar'da görünür.
3. **Değişiklik geçmişi:** Proje ve firma kartının altında “Kim, ne zaman değiştirdi?”; Ayarlar → Kullanıcılar'da son 60 değişiklik, kişiye göre süzülebilir. Yalnızca veri sahibi görür; bir yıldan eski kayıtlar silinir.
4. **Salt okunur bölümler:** Ekip üyesi “Görür” yetkili bölümde ekleme/düzenleme düğmelerini görmez.

## Güncelleme notu (sürüm 13)

- **Kayıtlı filtreler:** Liste ekranlarında (projeler, firmalar, kişiler, ziyaretler, görevler, siparişler, teklifler, tahsilat, numune, servis, stok, rakip, dosyalar, bölgeler, katalog, referanslar) filtreleri ayarla, “Bu filtreyi kaydet” ile adlandır; üstteki “Kayıtlı” satırından tek dokunuşla aç. “Filtreleri temizle” her şeyi varsayılana döndürür. Telefon ve bilgisayarda aynı.

## Güncelleme notu (sürüm 12)

- **Excel sütun eşleştirmesi hatırlanır:** Sipariş, cari ekstresi ve stok Excel'i ilk yüklendiğinde algılanan sütunlar gösterilir; düzeltip kaydedersin. Sonraki yüklemelerde başlıklar aynıysa soru sorulmaz. Başlıklar değişirse ekran yeniden açılır. Sıfırlamak için Ayarlar → Veri ve yedek.

## Güncelleme notu (sürüm 11)

- **Gizli mod (Ayarlar → Genel → Gizlilik):** Google katmanları ve firma araması, OpenStreetMap adres bulma ve sesle yazma kapanır; kayıt ve konum dış servislere gitmez.
- **Geri al:** Ziyaret, görev ve belge silince 10 saniye içinde “Geri al”.
- **Dosya adı, etiket ve not:** Dosyalar'da önizlemeden yeniden adlandır, etiketle (Şartname, Teklif, Proje çizimi…), not ekle.
- **Firma özeti:** Firma kartının üstünde açık proje ve tutarı, sipariş/kayıp, SAP sipariş, son ziyaretten bu yana gün, açık fatura, segment.

## Güncelleme notu (sürüm 10)

- **Kayıp analizi (Panel):** işi alan marka, neden ve il bazında adet ve tutar; kaç kayıpta bilgi eksik olduğu görünür. “Eksikleri tamamla” ile tüm kayıp projelerde marka ve nedeni tek ekrandan doldurursun.
- **Kayıp'a çekilen proje:** hunide ya da listede Kayıp'a taşınınca marka, neden, rakip fiyatı ve açıklama sorulur.
- **Pazartesi raporu:** Pazartesi–Çarşamba Bugün ekranında geçen haftanın özeti ve “Raporu aç” kartı.

## Güncelleme notu (sürüm 9)

- **Hızlı ekle (+):** Her ekranda sağ altta; ziyaret, plan, görev, kartvizit, kişi, proje, firma, teklif, masraf.
- **Genel arama:** Bilgisayarda sol menüdeki “Ara” ya da klavyede `/` (Ctrl+K); telefonda + düğmesinin üstündeki büyüteç. Proje, firma, kişi, telefon, sipariş no, SAS notu, teklif, ziyaret notu, görev, ürün kodu ve dosya adında arar.
- **Menü düzeni:** Ayarlar → Genel → Menü: ekranları göster/gizle, ana çubuğu seç.
- **Tarih kısayolları:** İleri tarihli alanlarda Bugün / Yarın / 3 gün / 1 hafta / 2 hafta / 1 ay.
- **Son seçilen il, bayi ve kanal** yeni kayıtta hazır gelir.
- **Ziyaret sıklığı segmente göre:** A 30, B 60, C 90 gün, segmentsiz 45 gün (Bugün → Uzun süredir gidilmeyenler).
- **Yedek hatırlatması:** 7 günden eski ya da hiç alınmamış tam yedek Bugün → Uyarılar'da görünür.

## Güncelleme notu (sürüm 8)

1. **Önce SQL:** Supabase → SQL Editor → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**. Dosya önceki tüm sürümlerin değişikliklerini içerir; bir kez çalıştırman yeterli, tekrar çalıştırmak zarar vermez.
2. **TCMB kuru (USD ve EUR):** SQL çalıştıktan sonra kur, veritabanı üzerinden TCMB'den saatlik alınır (alış/satış). Ulaşılamazsa Avrupa Merkez Bankası kuru kullanılır.
3. **Harita altlığı:** Haritadaki seçiciden Google Uydu (güncel görüntü), Google Harita, Esri Uydu veya OpenStreetMap seçilebilir. Google katmanları için Ayarlar → Google'da API anahtarı gerekir.
4. **OSB'ler otomatik:** Bölgeler → “OSB'leri otomatik getir”, OpenStreetMap'teki organize sanayi bölgesi sınırlarını önizleyip ekler.
5. **Dosyalar:** Yüklemeler, Excel/PowerPoint çıktıları, belgeler ve fotoğraflar ayrı gruplarda, türe göre süzülebilir.
6. **Excel çıktısı:** Listelerin çoğunda “Excel” düğmesi var. Çıktının bir kopyası Dosyalar → Çıktılar'a kaydedilir (Ayarlar → Veri'den kapatılabilir).
7. **Tüm veriyi al ve taşı:** Ayarlar → Veri ve yedek → “Tam yedek (ZIP)”: tüm tablolar (JSON + CSV), tüm dosyalar ve veritabanı şeması tek dosyada. Başka bir Supabase hesabına ya da başka bir sunucuya aynı ekrandan geri yüklenir.
8. **Kullanıcılar:** Ayarlar → Kullanıcılar'dan kişi ekle, bölüm bazında “Görür / Düzenler” yetkisi ver, davet bağlantısını gönder. Davetli kişi kendi şifresiyle hesap açar ve yalnızca izin verdiğin bölümleri görür.

## Güncelleme notu (sürüm 7)

Belgelere tür alanı eklendi: [`supabase/schema.sql`](supabase/schema.sql) dosyasını bir kez yeniden çalıştır.

- **Dosyalar** ekranı: eklediğin her belge, fotoğraf, kartvizit, fiş ve yüklediğin her Excel / yedek dosyası tek tek; önizleme, indirme, ilgili kayda gitme.
- **Ayarlar** sekmelere ayrıldı: Genel, Veri ve yedek, Google ve harita, Mesaj ve teklif.
- **Yeni proje, yeni kişi ve yeni firma** formları sadeleşti: önce gerekli alanlar, ayrıntılar açılır bölümlerde; yeni kişide tek dokunuşla kartvizit okuma.

## Güncelleme notu (sürüm 6)

Siparişlere **sipariş notu** ve **rapor dışı** alanları, çeyreklere **resmi rakam** (USD satış, TL satış, kur) eklendi: [`supabase/schema.sql`](supabase/schema.sql) dosyasını bir kez yeniden çalıştır.

- Siparişler: *Sipariş no* (SAP, 2000…), *SAS no* (sipariş açıklamasına yazılan not), *Sipariş notu* (özel / ekstra içerik). Her sipariş düzenlenebilir, elle eklenebilir, toplamlardan çıkarılabilir.
- Siparişler → *Çeyrek özeti*: siparişlerden hesaplanan ile resmi rakamın farkı. Resmi rakam girilen çeyrekte panel, tahmin ve sunum onu kullanır.
- Rapor → *Veri kontrolü*: eksik, çelişkili ve mükerrer kayıtlar; siparişi projeye bağlama ve firma birleştirme.

## Güncelleme notu (sürüm 5)

Veritabanına **tahsilat** ve **belge** tabloları eklendi: bir kez **Supabase → SQL Editor**'de [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yeniden çalıştır.

- **Tahsilat takibi:** açık faturalar, vade ve gecikme, ödeme kaydı, cari bakiyeleri, cari ekstresini Excel'den yükleme, WhatsApp hatırlatması; vadesi geçenler Bugün ekranında.
- **Belgeler:** proje ve firma kartlarına PDF, Excel, Word, çizim ya da belgenin fotoğrafı.
- **Kartvizit okuma:** Kişiler → *Kartvizitten ekle* ya da kişi kartında *Kartviziti oku*. Ad, unvan, telefon, e-posta ve firma forma yazılır (Tesseract.js, telefonda çalışır; ilk kullanımda ~15 MB indirilir).
- **Sesle yazma:** not alanlarındaki mikrofon düğmesi (Android Chrome; “nokta”, “virgül”, “yeni satır” komutları).
- **Haftalık rapor:** PDF, WhatsApp metni ve Excel.
- **Rakip analizi:** Rakip fiyatları → *Analiz* (markaya ve nedene göre kayıplar, aile bazında fiyat karşılaştırması).
- **Firma karnesi:** Panelde Bayi, Emüt, Gemüt, alıcı, projeci, danışman ve yatırımcı için.
- **Döviz kuru:** günde bir kez otomatik; teklif toplamlarında TL karşılığı. Kesin **TCMB** kuru için Supabase → Edge Functions'a [`supabase/functions/tcmb-kur/index.ts`](supabase/functions/tcmb-kur/index.ts) fonksiyonunu `tcmb-kur` adıyla ekle; eklenmezse Avrupa Merkez Bankası referans kuru kullanılır.
- **Günlük hatırlatma bildirimi:** Ayarlar → Bildirimler. Telefona yüklü uygulamada sabah o günün ziyaretleri, görevleri, doğum günleri ve vadesi geçen faturalar.

## Güncelleme notu (sürüm 4)

Bu sürüm veritabanına teklif, numune, servis, masraf, ürün kataloğu ve ayar tablolarını ve projelere *şantiye aşaması*, *aydınlatma alım tarihi* ve *referans* alanlarını ekliyor. Bir kez **Supabase → SQL Editor**'de [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yeniden çalıştır; mevcut verilerin silinmez.

Yenilikler:

- **Bugün** ekranı (açılış ekranı): günün planlı ziyaretleri, Google Haritalar'da tek tuşla günün rotası, gecikmiş görevler, zamanı gelen projeler, uzun süredir gidilmeyen firmalar, doğum günleri, stok / numune / servis / teklif uyarıları, yaklaşık günlük kilometre ve **Yakınımdakiler**.
- **Aydınlatma araçları:** enerji tasarrufu ve geri dönüş süresi, lümen yöntemiyle armatür adedi ve yerleşim, rakip ürüne muadil bulma.
- **Teklifler:** ürün kalemleri, iskonto ve KDV, yazdırılabilir PDF, WhatsApp özeti; teklif gönderilince proje “Teklif Verildi”ye geçer.
- **Satış hunisi** (Projeler → Satış hunisi): sürükle-bırak; panelde **olasılıklı tahmin** ve **bayi karnesi**.
- **Çeyrek sunumu:** Panel → *Çeyrek sunumu (PowerPoint)*, şirket sunum düzeninde düzenlenebilir .pptx.
- **Ürün kataloğu**, **referans galerisi** ve tam ekran **sunum modu**; **numune takibi**, **servis ve şikayet kayıtları**, **masraf ve kilometre**.
- **Hazır WhatsApp mesajları** (Ayarlar → Mesaj şablonları), kişi ve firma kartlarında.
- **Google Haritalar → Paylaş → Saha Takip** ile yer kaydetme ve haritayı **KML** olarak dışa aktarma.
- Google API anahtarı artık hesabında saklanır; telefonda ve bilgisayarda bir kez girmen yeter.

**Kısa bağlantılar için (isteğe bağlı):** Google Haritalar paylaşımda `maps.app.goo.gl` kısa bağlantısı gönderir. Konumu bu bağlantıdan okumak için Supabase paneli → **Edge Functions** → *Deploy a new function* → *Via Editor* → adı `kisa-link` → [`supabase/functions/kisa-link/index.ts`](supabase/functions/kisa-link/index.ts) içeriğini yapıştır → *Deploy*. Kurmazsan konum ad ve adresten bulunur.

## Güncelleme notu (sürüm 3)

Bu sürüm veritabanına Google Haritalar alanlarını ekliyor. Bir kez **Supabase → SQL Editor**'de [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yeniden çalıştır; mevcut verilerin silinmez. Çalıştırmazsan uygulama açılır ama Google bilgileri kaydedilmez ve uygulama seni uyarır.

**Başlangıç verisi yeniden yüklenebilir:** kayıtlar ada göre eşleştirilir, kopya oluşmaz. Haritada yerleştirdiğin konumlar, fotoğraflar, kartvizitler ve çizdiğin bölge sınırları korunur. Yüklerken iki seçenek sorulur: *Dosyadaki bilgilerle güncelle* (Excel daha güncelse) veya *Yalnızca eksikleri tamamla*.

## Harita kullanımı

- **Konum ata:** Sağ üstteki “Konum ata” listesinde yerini bekleyen projeler var. Birini seç, haritada gerçek yerine dokun. İl, ilçe, belde ve sanayi bölgesi otomatik yazılır; yanlışsa bildirimdeki “Geri al”a bas.
- **Raptiye taşı:** Açınca raptiyeleri basılı tutup sürükleyerek yerini düzeltebilirsin. Bitince tekrar bas.
- **Proje adları:** Yakınlaştırınca (sokak seviyesi) raptiyelerin üstünde proje adı görünür. Raptiyeye dokununca fotoğraf, durum ve paydaşlar açılır.
- **İl sınırları:** Üstten il seçince o ilin sınırı kalın çizgiyle gösterilir ve harita o ile odaklanır.
- **Uydu:** Haritanın üstündeki **Uydu** düğmesi uydu görüntüsü (yer adları ve yollarla) ile sokak haritası arasında geçiş yapar. Varsayılan uydu.
- **Google'da ara:** Firma adını yazınca Google'daki sonuçlar Google haritasında çıkar; işletme simgelerine dokunarak da seçebilirsin. Seçtiğin yerin adres, telefon, web sitesi ve konumu yeni firma/proje olarak kaydedilir ya da var olan kayda aktarılır. Firma ve proje detayındaki **Google'dan bilgi al** düğmesi aynı işi o kayıt için yapar. Bunun için bir kez Google API anahtarı girmen gerekir (Ayarlar → Google Haritalar; adımlar orada yazıyor).
- **İçe aktar:** Google Benim Haritalarım'dan KML/KMZ, Google Takeout'tan kaydedilen yerler (JSON, CSV) ya da Google Haritalar bağlantıları. Noktalar firma/projelerle ada göre eşleştirilir; çizilmiş alanlar sanayi bölgesi olur. Anahtar gerekmez.
- **Bölge çiz:** OSB veya sanayi sitesinin köşelerine sırayla dokun, “Bitir”. Bölgeye ad ve grup ver (örn. “Tarsus hattı”). İçinde kalan projelere bölge otomatik yazılır. **Sanayi bölgeleri** ekranında gruplar, proje sayıları ve açık potansiyel listelenir.
- Konum algılama: il sınırı ve en yakın ilçe cihazda hesaplanır; belde ve mahalle internet varken OpenStreetMap adres hizmetinden alınır.

## Bilmen gerekenler

- **Yaklaşık konumlar:** Excel'den gelen projelerin konumu yaklaşık (ilçe veya OSB merkezi) olduğu için haritada varsayılan olarak gizli ve “Konum ata” listesinde bekliyor. Görmek istersen Katmanlar → “Yaklaşık konumlu projeler”.
- **2026 / 2027 listeleri:** Her projede "Takip yılı" var; Projeler ekranında üstten seçilir.
- **Stok:** Bayinin depo Excel'ini **Stok ve fiyat → Stok Excel'i yükle** ile ekle. Eski stok geçmişte saklanır.
- **Siparişler:** SAP sipariş listesini **Siparişler → Sipariş Excel'i yükle** ile ekle; aynı sipariş iki kez eklenmez.
- **Güvenlik:** Her kayıt yalnızca kendi hesabınla görülür (Supabase satır güvenliği). Fotoğraf ve kartvizitler özel depoda. Supabase anahtarı kodda değil, uygulamaya girdiğin ayarda durur.
- **Çevrimdışı:** İnternet yokken son yüklenen veriler görünür, değişiklikler bağlantı gelince gönderilir.
- **Yedek:** Ayarlar → **Yedek indir (JSON)** ve **Tümünü Excel'e aktar**.

## Dosya yapısı

| Yol | İçerik |
| --- | --- |
| `index.html`, `styles.css` | Sayfa ve görünüm |
| `js/db.js` | Veri katmanı (Supabase veya tarayıcıda deneme modu) |
| `js/views/` | Bugün, harita, projeler, firmalar, ziyaretler, teklifler, araçlar, katalog, kayıtlar (numune, servis, masraf), stok, panel, ayarlar ekranları |
| `js/pptx.js`, `js/zip.js`, `js/pptx-tema.js` | Çeyrek sunumu (.pptx) üretimi, dış kütüphane olmadan |
| `js/paylas.js`, `supabase/functions/kisa-link/` | Google Haritalar'dan paylaşım, kısa bağlantı çözme, KML dışa aktarma |
| `js/sablon.js`, `js/ayar.js`, `js/sunum.js` | WhatsApp şablonları, eşitlenen ayarlar, tam ekran sunum |
| `js/ocr.js`, `js/ses.js`, `js/belgeler.js`, `js/kur.js`, `js/bildirim.js`, `js/grafik.js` | Kartvizit okuma, sesle yazma, belgeler, döviz kuru, bildirimler, grafikler |
| `supabase/functions/tcmb-kur/` | TCMB döviz kuru (isteğe bağlı) |
| `js/google.js`, `js/views/ice-aktar.js` | Google'da arama ve Google'dan konum içe aktarma |
| `js/birlestir.js` | İçe aktarmada ada göre eşleştirme ve birleştirme |
| `js/geo.js`, `js/data/iller.js` | Konum algılama ve il sınırları (Turkey-Maps-GeoJSON, Apache-2.0) |
| `sw.js`, `manifest.json`, `icons/`, `js/kurulum.js` | Telefona kurulum, kısayollar ve çevrimdışı çalışma |
| `twa-manifest.json`, `docs/ANDROID.md` | Android APK / Play Store paketi (Bubblewrap) |
| `supabase/schema.sql` | Veritabanı tabloları, güvenlik kuralları, fotoğraf deposu |

Kütüphaneler: Leaflet 1.9.4 ve MarkerCluster 1.5.3 (harita, OpenStreetMap), supabase-js 2.45.4, SheetJS 0.18.5 (Excel). Derleme adımı yoktur; dosyalar olduğu gibi yayınlanır.
