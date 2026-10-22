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
