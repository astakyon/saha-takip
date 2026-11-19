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

## Güncelleme notu (sürüm 123)

- **Ek sütunlar** (`js/stoksutun.js`, ayar `stok_sutunlari`, `bayi_stok.ozel`): Excel mantığında kullanıcının eklediği sütunlar (Marka, Raf yeri, Renk…). Tablodaki “+ Sütun” ya da “Sütunlar” ile eklenir, adı değiştirilir (değerler taşınır), silinir (değerleri de silinir). Hücreye yazınca kaydedilir (Enter / ↑↓ ile alttaki satıra geçer); seçili kalemlere “Sütuna yaz” ile toplu değer; kalem kartında “Ek sütunlar”; aramada bulunur; Excel'e ve boş şablona çıkar. Excel yüklemede eşlenmeyen başlıklar listelenir, işaretlenenler ek sütun olur. Şirket kullanıcısının sütunu bütün bayilerde, bayinin sütunu yalnız kendisinde görünür.
- **Grup silme**: ürünü olmayan gruplar da sekmede durur; grup sekmesi seçilince “Adını değiştir” ve “Grubu sil” (kalemler silinmez, grupsuz kalır); sekmelerin sonunda “Grupları düzenle”.
- **Etiketler** (`js/etiket.js`, `js/vendor/qrcode.js` MIT): seçili kalemlere ürün etiketi (okutunca 1 adet) ya da koli etiketi (okutunca kolideki adet) yazdırılır; QR içeriği `STK1|kod|adet|parti`. Boyutlar: 50×25, 70×40, 100×50, 100×150 mm termal ve A4 yapışkan yaprak (3×8). Koli etiketinde etiket sayısı stok / koli içi adetten gelir, koli içi adet kalem kartına kaydedilir; parti / lot no isteğe bağlı. Kalem kartına barkod (EAN) ve koli içi adet eklendi; üreticinin barkodu okutulunca kalem bulunur.
- **Etiketle giriş / çıkış**: okuyucu tabanca, kamera ya da elle (“kod x 12”) okutulanlar listede toplanır; Kaydet ile stoğa girer ya da depodan düşer, hareket kaydına açıklamayla yazılır. Girişte bilinmeyen kod yeni kalem olur, çıkışta reddedilir; stok 0'ın altına inmez.
- **Sevk ve sayımda etiket**: sevk belgesinde etiket okutunca kalem eklenir ya da miktarı artar (koli = kolideki adet); sayımda koli etiketi kolideki adedi ekler.
- Şema 59: `bayi_stok.ozel` (jsonb), `barkod`, `koli_ici`; `stok_sutunlari` ekipçe paylaşılan ayar.

## Güncelleme notu (sürüm 122)

- **Şablonlar** (`js/teklif2.js`, ayar `teklif_sablonlari`): logo (küçültülüp saklanır), firma adı ve iletişim (antet), ana ve vurgu rengi, banka bilgileri, standart koşullar, alt bilgi, imza, sütunlar (sıra no, kod, üretici kodu, ürün, görsel, birim, miktar, birim fiyat, iskonto, KDV, tutar; sıralanabilir) ve belge dili (Türkçe / English). Kapsam: şirket (herkes), kişisel (yalnız oluşturan) ya da bayi (bayinin kendi müşterisine). Teklifte şablon ve dil seçilir.
- **Numara düzeni** (ayar `teklif_no_duzen`): önek, yıl, sayaç hanesi, her kullanıcıya ayrı seri (baş harfler); revizyonlar `-R2`, `-R3`. Varsayılan T-YYYY-NNN.
- **Proje teklifi**: kaleme mahal / kat yazılır, belgede gruplanır ve ara toplam alır. Kalem "Seçenek A / B / C"ye bağlanırsa alternatifli teklif olur; toplama yalnız seçili seçenek girer, belgede her seçeneğin genel toplamı ayrı yazar. Onay bağlantısında müşteri seçeneğini seçerek onaylar (`teklif_yanitla` p_secim).
- **Şartlar ve ekler**: teslim süresi, yeri, şekli (EXW, DAP… ya da şantiye teslim), teklif kuru, kur tarihi ve "kur farkı alıcıya aittir" maddesi; hazır metin blokları (ödeme, teslim, garanti, geçerlilik; düzenlenebilir); ek bağlantılar ve ürün kartındaki föy, sertifika, fotometrik dosya kendiliğinden eklenir. Formda anında önizleme.
- **Fiyat ve kâr**: ürün kartında maliyet (USD, "tutarları gizle"ye dahil); teklifte kalem maliyeti ve kâr marjı yalnız içeride görünür, en düşük marjın altı kırmızı. Bayi firmaya ürün eklenince bayi iskontosu uygulanır; bu firmaya son verilen fiyat tek tuşla uygulanır. Kalem altına rakip fiyatı yazılır, fark yüzdesi görünür.
- **İskonto onayı**: şirketin iskonto sınırını aşan ekip üyesinin teklifi "onay bekliyor" olur, Gönderildi yapılamaz, PDF / WhatsApp / bağlantı kapalı kalır; Onay kuyruğunda onaylanır ya da reddedilir.
- **Takip ve kapanış**: Red'de kayıp nedeni zorunlu (fiyat, teslim, teknik, rakip marka…), kazanan rakip ve fiyatı; gönderim ve yanıt tarihleri kendiliğinden yazılır. Müşteri bağlantıyı ilk açınca "Teklif görüntülendi · müşteriyi ara" görevi düşer. Otomasyon: gönderilen teklife 7 gün içinde yanıt gelmezse "Teklifin sonucunu sor" görevi. "Sipariş oldu" teklifi Kabul, projeyi Sipariş yapar ve sipariş kaydını açar; "Sevk belgesi" kalemlerle sevk oluşturur. "Karşılaştır" önceki revizyonla farkı gösterir.
- **Teklif raporu**: kazanma oranı, ortalama iskonto ve yanıt süresi; firma, ürün grubu, proje türü ve kullanıcı bazında (her teklifin son revizyonu sayılır).
- Şema 58: `teklifler` yeni sütunlar (şablon, dil, seçim, teslim, kur, ekler, onay, kayıp, gönderim / yanıt tarihi, oluşturan), `urunler` maliyet ve teknik ek bağlantıları, `teklif_baglantilari.yanit_secim`; `teklif_yanitla` ve `teklif_goster` güncellendi.

## Güncelleme notu (sürüm 121)

- **Sevk ve irsaliye** (`js/views/sevk.js`, `sevkler`): sevk belgesi ve iade belgesi; numara düzeni şirketçe ayarlanır (önek, yıl, sayaç; ör. SVK-2026-0001, IAD-2026-0001). Çıkış bayi ve deposu, alıcı, proje, teslim yeri, kalemler. Tekliften (Kabul / Gönderildi) ya da siparişten oluşturulur; kısmi sevkte önceki sevkler düşülüp kalan gelir, teklif "Kısmen sevk edildi" görünür.
- **Stok**: belge "Yolda" ya da "Teslim edildi" olunca kalemler çıkış stoğundan bir kez düşer (iade belgesi ekler), "İptal" geri alır; hareket kaydına belge numarasıyla `sevk` / `iade`. Stok yetmezse uyarır.
- **Taşıma**: gönderim şekli (kargo, ambar, kendi aracımız, müşteri teslim aldı), kargo / ambar firması (liste kendiliğinden büyür), taşıma ücreti ve para birimi, ödeyen, palet, koli, ağırlık, desi, plaka, şoför, takip no.
- **Gönderme ve teslim**: PDF (irsaliye taslağı, fiyatsız), WhatsApp, e-posta, "Yola çıktı" mesajı (belgeyi Yolda yapar); "Teslim alındı": teslim alan, parmakla imza, fotoğraf, konum.
- **Takvim ve rapor**: güne göre planlı sevkler ve Google Haritalar'da rota; ay, bayi, proje ve taşıyıcı bazında sevk ve taşıma maliyeti; bekleyen ve geciken teslimler. "Muhasebe için Excel" belge ve kalem sayfalarıyla.
- Resmî e-İrsaliye entegratör ya da muhasebe programı üzerinden kesilir; belge bunu belirtir. Şema 57: `sevkler` (bayi kullanıcısı kendi stoğundan çıkan ve kendisine gelen belgeleri görür); taşıma ücreti "tutarları gizle"ye dahil.

## Güncelleme notu (sürüm 120)

- **Seri / parti** (`js/izlenebilir.js`, `stok_seri`): kalem kartında parti (miktarlı) ya da seri (tekil) numarası, garanti süresi (ay), durum (Stokta, Satıldı, Serviste, İade); aynı ürüne aynı numara iki kez girilmez. "Servis kaydı" seri no ve ürünle dolu servis formu açar; servis kaydında `seri_no` alanı (bilinen numaralar önerilir). Stok aramasında seri / parti no ile kalem bulunur.
- **Stok paylaşım bağlantısı** (`stok.html`, `stok_paylasimlari`, `stok_paylasim_goster`): seçili bayi / depo / grup için fiyatsız, salt okunur liste; miktar ya da yalnız "Var / Az" gösterimi; geçerlilik günü; WhatsApp ile gönderme; açılma sayısı ve iptal. Sayfa her açılışta güncel stoğu gösterir; fiyat, maliyet ve iç notlar gitmez; sıfır ve pasif kalemler görünmez. Bağlantı tablosu girişsiz kullanıcıya kapalıdır, liste yalnız 48 karakterlik anahtarla açılır.
- Şema 56: `stok_seri`, `servis_kayitlari.seri_no`, `stok_paylasimlari`, `stok_paylasim_goster()`.

## Güncelleme notu (sürüm 119)

- **Sipariş önerisi** (`js/stokanaliz.js`): bayinin aktif kalemlerinde öneri = en büyüğü (kritik seviye − stok, açık tekliflerdeki miktar − bütün bayilerdeki stok). Miktar düzeltilir; "Teklif taslağı oluştur" bayiye teklif formunu kalemlerle açar; Excel.
- **Stok yaşı ve devir hızı**: son 90 günün çıkışı (bayinin sell-out kaydı varsa o, yoksa stok geçmişindeki çıkış / Excel düşüşleri; sayım, silme, transfer hariç) ile aylık çıkış ve erime günü. 90+ gün hareketsiz ya da 180+ günde eriyecek kalem kampanya adayı; kalem kalem ya da topluca "kampanya" işaretlenir (`bayi_stok.kampanya`), stok listesinde rozetle görünür.
- Şema 55: `bayi_stok.kampanya`.

## Güncelleme notu (sürüm 118)

- **Depolar**: kalem anahtarı bayi + ürün kodu + depo (`bayi_stok.depo`, boş = ana depo); aynı ürün iki depoda ayrı satırdır. Bayinin depoları: ana depo + bayi kartındaki `depolar` + stokta geçen depo adları. Stok ekranında depo seçici (Bütün depolar, Ana depo, …, "+ Depo ekle"); bütün depolarda Depo sütunu ve özetin altında depo depo değer. Ürün eklerken depo seçilir; Excel yükleme ve sayım depo depo yapılır.
- **Transfer**: işaretli kalemler "Transfer" ile hedef bayi ve hedef depoya, kalem kalem miktarla (varsayılan hepsi). Kaynak azalır; hedefte satır yoksa kalem kartı bilgileriyle (açıklama, kodlar, birim, fiyat) açılır. İki taraf da stok geçmişine `transfer` hareketi olarak (→ hedef / ← kaynak) yazılır. Bayi kullanıcısı yalnız kendi depoları arasında aktarır.
- Şema 54: `bayi_stok.depo`, `bayiler.depolar`, `stok_sayimlari.depo`; benzersizlik (owner, firma_id, kod, depo).

## Güncelleme notu (sürüm 117)

- **Stok sayımı** (`js/sayim.js`, `stok_sayimlari`): bayi (grup sekmesi açıksa yalnız o grup) için sayım başlatılır. Sayılan miktar elle girilir ya da kod okutulur: arama kutusu barkod okuyucunun yazdığı kodu (ürün kodu, firma stok kodu, üretici kodu) bulup satıra götürür; "her okutma +1" her okutmada bir sayar; tarayıcı destekliyorsa kamerayla okutma. Sayım taslak olarak kaydedilir; "Sayıma devam" ile kalınan yerden sürülür.
- **Fark raporu**: eksik / fazla / aynı, adet ve USD tutar; "Sayılmadı" ve "Farklı" süzgeçleri; Excel'e aktarılır.
- **Onay**: sayılan kalemlerin stoğu sayılana çekilir (isteğe bağlı: sayılmayanlar 0); farklar stok geçmişine `sayim` hareketi olarak, kim ve ne zaman sayıldı bilgisiyle yazılır. Sayım satırları ve eksik / fazla tutarı saklanır.
- **Geçmiş sayımlar** ve **sürekli fark çıkan ürünler** (en az iki onaylı sayımda farkı olan kodlar) sayım penceresinde.
- Şema 53: `stok_sayimlari` (bayi kullanıcısı yalnız kendi sayımlarını görür / yapar); "tutarları gizle" sayım tutarlarına da uygulanır; hassas sütun koruması bütün listelenen tablolara kurulur.

## Güncelleme notu (sürüm 116)

- **Kritik seviye** (`bayi_stok.kritik`): kalem kartından girilir; miktar sınırda ya da altındaysa satırda "kritik" bayrağı, stok uyarılarında "kritik seviyenin altında" listesi. "Kritik / az" sekmesi: kritik seviyesi olanlar ona göre, olmayanlar 1–5 adet.
- **Teklif rezervi**: açık tekliflerdeki (Taslak, Gönderildi) miktar ürün koduna göre "teklifte" sayılır; satırda "teklifte N · serbest M" (M = bütün bayilerdeki aktif stok − teklifte; eksi ise kırmızı).
- **Stok hareketleri**: "Hareketler" penceresi ve kalem kartının altı; tarih, bayi, kod, hareket (giriş, çıkış, Excel, düzeltme, sayım, silme, pasif/aktif), fark, kalan, açıklama (dosya adı, kim). Excel'e aktarılır.
- **Toplam değer**: EUR ve TL fiyatlar güncel kurla USD'ye çevrilip toplanır; özetteki değere dokununca USD → EUR → TL gösterimi.
- Şema 52: `bayi_stok.kritik`.

## Güncelleme notu (sürüm 115)

- **Stok grupları** (`js/stokgrup.js`, "favori kanal" mantığı): iki katman. Şirket grupları (`stok_gruplari.firma_id` boş) bütün bayilerde ya da seçili bayilerde (`tum_bayiler`, `bayiler`) görünür; yeni bayiye "tüm bayiler" grupları kendiliğinden gelir. Bayinin kendi grupları (`firma_id` dolu) yalnız o bayide görünür. Bir kalem birden fazla grupta olabilir (`bayi_stok.gruplar`).
- Stok ekranının üstünde sekmeler: Tümü, şirket grupları, bayinin grupları (kesik çizgili), Grupsuz; ürünü olmayan grubun sekmesi gizlenir. Kalemler işaretlenip "Grupla" (var olan gruba ya da yeni gruba) ve "Gruptan çıkar". "Gruplar" penceresinde ad değiştirme, ↑↓ ile sıralama, şirket grubunun bayileri, silme (kalemler grupsuz kalır).
- Excel yüklemede hedef grup sorulur (grup sekmesi açıksa o grup): yüklenen ürünler gruba eklenir, listede olmayanları sıfırlama yalnız o grubun içinde yapılır. Grup sekmesindeyken "Bu gruptaki stoğu sil" grubun adı yazılarak onaylanır. "Bütün bayiler" görünümünde (hangi bayide var araması) şirket grupları süzgeç olarak kullanılır.
- Gizlilik: bayi kullanıcısı yalnız kendi gruplarını ve kendisine açık şirket gruplarını görür; yalnız kendi gruplarını açar, değiştirir, siler (veritabanı kuralı).
- Şema 51: `stok_gruplari` tablosu, `bayi_stok.gruplar`; stok birimleri, "farklı sipariş" işaretleri, kendi depo ve zorunlu alan ayarları ekiple paylaşılır.

## Güncelleme notu (sürüm 114)

- **Stok kalem kartı** (Bayi → Stoklar, koda dokun): ürün kodu (ana anahtar), firma stok kodu (bayinin kendi kodu), açıklama, üretici kodu ve açıklaması, birim (şirket listesi + yeni birim; `stok_birimleri` ayarı), miktar, birim fiyat ve para birimi (USD/EUR/TRY), aktif. Değer güncel kurla USD'ye çevrilir.
- **Silme ve pasife alma**: satırlar işaretlenir; seçim çubuğundan "Pasife al", "Aktif yap", "Sil". "Bütün stoğu sil" bayinin adı yazılınca açılır. Pasif kalem listeden, toplamlardan ve "hangi bayide var"dan çıkar; "Pasif" sekmesinde görünür. Silmede ve pasife almada stok geçmişine hareket yazılır, geçmiş raporlarda kalır. Sıfıra düşen kalemler silinmez.
- **Stok hareket kaydı**: `stok_gecmis`e hareket türü (giris, cikis, excel, duzeltme, silme, pasif, aktif), fark, birim, kim ve açıklama yazılır.
- **Excel**: "Boş şablon" ve "Excel" aynı sütunları kullanır (Ürün kodu, Firma stok kodu, Açıklama, Üretici kodu, Üretici açıklaması, Birim, Miktar, Birim fiyat, Para birimi, Aktif); dışa aktarılan dosya düzenlenip geri yüklenebilir. Sütunlar başlıktan tanınır; "1.250,50" gibi TR sayıları okunur; € / TL / $ para birimine çevrilir. Listede olmayan kalemlerin miktarı sıfırlanır, kayıtları silinmez.
- Şema 50: `bayi_stok` firma_kodu, uretici_kodu, uretici_aciklama, birim, para_birimi, aktif; `stok_gecmis` hareket, fark, kullanici, aciklama, birim.

## Güncelleme notu (sürüm 113)

- **Bayi stok Excel'i kod denetimi**: sütun eşlemesi (kayıtlı olsa bile) içerikle doğrulanır. Kod sütunu 1, 2, 3… diye artan sıra numarasıysa ya da başka bir sütun ürün listesindeki kodlarla daha çok eşleşiyorsa kod o sütundan alınır; açıklama sütunu kodlardan oluşuyorsa açıklama boş bırakılır ve tanım ürün listesinden gelir. Düzeltilen eşleme kaydedilir. Açıklaması kod gibi olan satırlar ürün listesine eklenmez.
- **Kodları düzelt**: kodu sıra no, açıklaması ürün kodu olan eski bayi stok satırları stok ekranında uyarılır; tek dokunuşla kod açıklamadan alınır (aynı kod varsa yeni adet geçerli olur), tanım ürün listesinden gelir, o yüklemenin açtığı "1, 2, 3…" kodlu sahte ürünler silinir. Tanımı ürün listesinde olmayan kodlar tabloda "ürün listesinde tanımı yok" diye görünür.

## Güncelleme notu (sürüm 112)

- **Aynı sipariş numarası** (`js/sipcift.js`): Veri kontrolü → Siparişler → "Aynı sipariş numarasıyla birden fazla kayıt". Sipariş no'ya göre gruplar ("4500001" ile "4500001.0" aynı sayılır). "İncele" kayıtları yan yana gösterir, farklı alanları vurgular; ana sipariş seçilir. "Birleştir, diğerlerini sil": ana kalır, boş alanları diğerlerinden dolar, sipariş notları ve yorumlar taşınır, ana doğrulanır, kopyalar silinir. "Diğerlerini rapor dışı yap" silmeden toplamlardan çıkarır. "Farklı siparişler" hepsini doğrular ve grubu bir daha göstermez (gruba yeni kayıt eklenirse yeniden çıkar). Tutar ve para birimi aynı, satış belgesi çelişmeyen gruplar "kesin kopya"dır; hepsi tek düğmeyle birleştirilir. Numarası farklı ama aynı gün, cari ve tutarlı siparişler ayrı başlıkta ("Doğru" ile işaretlenir).
- Kopya önleme: SAP listesi yüklenirken aynı sipariş no'lu, satış belgesi boş ya da aynı olan kayıt güncellenir (yeni kayıt açılmaz); veri paketi böyle siparişi atlar; elle girişte aynı numara varsa uyarı çıkar.

## Güncelleme notu (sürüm 111)

- **Veri paketi (.json)** (`js/paket.js`): Ayarlar → Veri → "Veri paketi yükle". Paket CRM/SAP/plan dosyalarından hazırlanır; kayıtlar geçici anahtarlarla (`_k`, `firma_k`, `yatirimci_k`…) birbirine bağlıdır. Firma eşleştirme cari kodu ya da şirket türü eklerinden arınmış ada göre (kesilmiş SAP adları baştan eşleşir); eşleşen kayıtta yalnızca boş alanlar dolar, tipler birleşir, notlar eklenir. Proje aşaması yalnızca kayıt "Proje"deyse ya da paket siparişe döndüğünü söylüyorsa ilerler ve proje geçmişine yazılır. Siparişler satış belgesi + sipariş no ile tekil; geçmiş ziyaret o tarihte ya da sonrasında ziyaret varsa eklenmez; çeyrek hedefi yalnızca boşsa yazılır. Aynı paket ikinci kez yüklenirse yeni kayıt çıkmaz.
- Proje sayfasında üstteki ikinci aşama şeridi kaldırıldı; aşama alttaki şeritten değişir.

## Güncelleme notu (sürüm 110)

- **Kısa güncelleme dosyası:** `supabase/guncelleme-37-49.sql` yalnızca şema 37'deki bir veritabanını 49'a taşır (340 satır; telefondan yapıştırmak için). Veritabanı 37'den eskiyse çalışmaz ve tam `schema.sql`'i ister.
- **İletişim izni** (kişi formu): KVKK aydınlatma (verildi / verilmedi), tanıtım mesajı onayı (evet / hayır), tarih, kanal; kişi sayfasında uyarı; Eksik bilgiler'de "Tanıtım mesajı izni" (ek).
- **Rol bazlı hazır menü** (`js/menu.js` `ROL_MENU`): Saha ekibi, Satış, Satış destek, Muhasebe, Bayi, Dış kullanıcı, Proje, Proje firması, Yönetici rollerinde alt çubuk hazır gelir; rolün kendi menüsü ya da kişinin seçimi önceliklidir.
- **schema.sql 49:** `kisiler.iletisim_izni`, `ticari_ileti`, `izin_tarihi`, `izin_kanali`; `hassas_kolonlar` "tutar" grubuna `cekler.tutar`, `bayiler.iskonto / kredi_limiti / hedef_yil`, `bayi_stok.birim_fiyat`, `bayi_satis.tutar` eklendi (kayıt `kaydet_toplu` ile, okuma `hassas_degerler` ile).

## Güncelleme notu (sürüm 109)

- **Önem puanı**: eksik alan ağırlıkları × (1 + kaydın değerinin büyüklüğü); varsayılan sıra "en çok etki eden önce".
- **Öneriler**: firma konumu (ziyaret giriş konumlarının ortalaması), il / ilçe (adres ya da projesi), telefon / e-posta (bağlı kişiler), proje ili (paydaş firma), kişinin firması (e-posta alan adı), sipariş / fatura / çek firması (ad benzerliği).
- **Doluluk**: firma sayfasında % çubuğu; Eksik bilgiler'de haftalık genel doluluk grafiği (şirket ayarında saklanır), kişi bazında doluluk, değiştirilebilir hedef (varsayılan %90).
- **Günlük eksik veri kartı**: satışı ya da açık işi olan firmaların vergi no, vergi dairesi, telefon gibi eksikleri ve öneriler soruluyor (vergi no denetlenir).
- **Uyarı akışı**: büyük açık projede (eşik üstü) il, paydaş, tarih gibi önemli alan eksikse "Önemli kayıtta eksik".

## Güncelleme notu (sürüm 108)

- **Alan kuralları** (`js/alanlar.js`): her kayıt türü için alan, etiket, önem (zorunlu / önemli / ek; Zorunlu alanlar ayarından), eksiklik ölçütü, doldurma şekli ve "neden önemli" metni. Doluluk, veri kontrol merkezi, günlük kart ve uyarılar bu tanımı kullanır.
- **Raporlar → Eksik bilgiler** (`js/views/eksikler.js`): 7 sekme (firmalar ve cari, kişiler, projeler, teklif ve sipariş, finans, bayiler, ürünler), her birinde doluluk %, eksik kayıt sayısı ve alan süzgeçleri; satırda yerinde doldurma (metin, sayı, tarih, seçim, il + ilçe, firma seç, sorumlu), "yok" işareti, seçilenlere toplu değer, seçilenler için görev, Excel'e aktar / Excel'den doldur.
- Şema değişikliği yok ("yok" işaretleri şirket ayarında tutulur).

## Güncelleme notu (sürüm 107)

- **Zorunlu alanlar** (`js/zorunlu.js`): firma konumu, vergi bilgisi (teklif / sipariş / tahsilat / çek öncesi, her kayıtta ya da kapalı) ve hangi firma tiplerinde istendiği, projenin ili, açık projede tutar ve tarih, kişinin firması ve iletişim bilgisi; her biri zorunlu / önemli / denetlenmesin. Ayar: Şirket profili → Genel → Zorunlu alanlar.
- **Eksik bilgili firma**: firma sayfasında "Cari bilgisi eksik" rozeti ve Tamamla. Teklif, sipariş, fatura ve alınan çek girilirken eksik vergi no ve vergi dairesi ayrı bir pencerede istenir (geçersiz numara kabul edilmez); şirket yetkilisi "Şimdilik geç" diyebilir, bu uyarı akışına düşer.
- **Veri kontrolü**: cari bilgisi eksik müşteriler (satışı olanlar önce), firması seçilmemiş kişiler, ili ve konumu olmayan projeler. Excel firma içe aktarmada konumu eksik yeni firmalar önizlemede sayılır.
- Şema değişikliği yok.

## Güncelleme notu (sürüm 106)

- **Cari bilgileri** (firma formu): unvan, vergi no, vergi dairesi (girilenlerden öneri), fatura adresi, cari kodu, e-Fatura, vade, iskonto, kredi limiti, para birimi, şubesi olduğu firma. Firma sayfasında görünür.
- **Vergi no denetimi** (`js/cari.js`): VKN (10 hane) ve TCKN (11 hane) kontrol haneleri; yazarken "bu numara zaten X firmasında" uyarısı, Birleştir ve "Bu firma onun şubesi". Geçersiz ya da başka firmadaki numara kaydedilmez; Excel içe aktarmada boş bırakılır ve önizlemede sayılır.
- **Veri kontrolü**: aynı vergi numaralı firmalar (Karşılaştır / şube), geçersiz vergi no, firmaya bağlı olmayan faturalar (Bağla / Firma seç), siparişlerde "Firma seç". Finans → Cari hesaplar'da bağlanmamış fatura uyarısı.
- **Cari listesi yükle**: herhangi bir Excel (unvan, vergi no, vergi dairesi, adres, il, cari kodu, telefon, e-posta); vergi no ya da unvanla eşleştirir, yalnız boş alanları doldurur, eşleşmeyenleri istenirse yeni firma ekler.
- **Birleştirme** artık çek / senet, bayi ataması, bayi stok ve satışları, stok geçmişi, siparişte bayi ve şubeleri de taşır. Bayi kartındaki koşullar boşsa firmanın carisinden okunur.
- **schema.sql 48:** firmalara cari sütunları ve `vergi_no_temiz`; şirket içinde tekil vergi no kuralı yalnız aynı numaralı firma yoksa kurulur (varsa uyarı verir; temizledikten sonra dosyayı yeniden çalıştır). Durum: `select public.vergi_tekil_kurulu();`

## Güncelleme notu (sürüm 105)

- **Ürünler → Ürün ve fiyat listesi** (`js/views/urunler.js`): bizim ürün ve fiyat listemiz; stok sütunu bütün bayi depolarının toplamını ve nerede olduğunu gösterir. "Bayi paneli" kaldırıldı; eski bağlantı Stoklar'a gider.
- **Stok tek yerde** (`js/stok.js`): `stokAdet`, `stokNerede`, `stokUyarilariHesapla`, `bayiStokYaz` (adet değişince `stok_gecmis`e bayi ile satır). Katalog, araçlar, kod okuma, öneriler, hızlı arama ve teklif satırı bu yardımcıları kullanır.
- **Bayi ve partner → Stoklar**: Excel'den yükleme (sütun eşleme, önizleme, listede olmayanları sıfırlama, yeni kodları ürün listesine ekleme), + / − ve Enter ile hızlı adet, stok uyarıları; Ürünler'deki eski depo stoğunu bayiye taşıma kartı (önizlemeli, geçmişiyle).
- **Kendi depomuz**: Şirket profili → Genel'de seçenek (varsayılan kapalı); açıkken Ürünler'de kendi depo stoğu yüklenir.
- Uyarı akışında "Stok yetersiz". "Bayi paneli" yetkisi olan kişi ve rollere "Bayi stokları" verilir.
- **schema.sql 47:** `stok_gecmis.firma_id`; bayi kullanıcısı yalnız kendi deposunun stok geçmişini görür ve ekler.

## Güncelleme notu (sürüm 104)

- **Onay kuyruğu** (`js/views/onaykuyrugu.js`, `js/onay.js`): yalnız şirket yetkilisi; masraf (Onayla / Reddet), hafta planı (İncele), ekip kayıtları (Onayla / Düzeltilecek notu). Menü rozeti bekleyen sayısını gösterir. "Ekibin açtığı yeni firma, proje ve siparişler" açıkken ekip üyesinin yeni kaydı "Ekip kaydı" olarak işaretlenir.
- E-postadan iş üretme (Gmail) ve muhasebe programı entegrasyonu (Logo / Mikro / Paraşüt) bu sürümde yok: ikisi de sunucu tarafında yetkili bağlantı (OAuth / API anahtarı) ister. Şimdilik Finans → Muhasebeye aktar ile Excel verilir.
- **schema.sql 46:** `siparisler.kaynak`, `dogrulandi`.

## Güncelleme notu (sürüm 103)

- **Tekrarlayan ziyaret** (`js/tekrar.js`): firma formunda "Düzenli ziyaret" ve "Tercih edilen gün"; Hafta planı açılınca son ziyaretten bu yana süre dolmuş firmalar o haftaya "Rutin ziyaret" olarak eklenir (plandan çıkarılan aynı hafta yeniden eklenmez).
- **Plan onayı** (`js/planonay.js`): Şirket profili → "Ekibin haftalık planı onayımdan geçsin"; ekip üyesi "Onaya gönder", durum Hafta planı başlığında; yetkili Onay kuyruğunda haftanın ziyaretlerini görüp Onayla / Düzeltme iste (not ile).
- **schema.sql 45:** `firmalar.tekrar_gun`, `tekrar_haftagun`; `plan_onaylari` (üye yalnız kendi planını gönderir; onay yetkilide).

## Güncelleme notu (sürüm 102)

- **Kaynak ve "Bilgiler doğru"** (`js/dogrula.js`): toplu içe aktarmayla gelen yeni firma/projeye kaynak etiketi (Excel'den / haritadan aktarıldı); firma ve proje sayfasında rozet ve "Bilgiler doğru, onaylıyorum" (kim ve tarih yazılır); Veri kontrolünde iki yeni başlık.
- **Firma teklif e-postası**: firma formunda "Teklif e-postası"; teklifte **E-posta** düğmesi (alıcı: teklif e-postası → ilgili kişi → firma e-postası; konu ve metin hazır).
- **Serbest metin önizleme**: Konuşarak kaydet'te "Kaydedilecek" kutusu (ziyaret, görev ya da not görevi), düğme "Onayla ve kaydet".
- **Ekrana özel geri bildirim**: ekranın adı, bu oturumdaki son hata metinleri ve isteğe bağlı ekran görüntüsü (html2canvas, yalnız işaretlenirse).
- **schema.sql 44:** `firmalar.kaynak`, `dogrulandi`, `teklif_eposta`; `projeler.kaynak`, `dogrulandi`.

## Güncelleme notu (sürüm 101)

- **Raporlar → Uyarılar** (`js/views/yonetici.js`): son 7/14/30 gün; tür süzgeci; kayda tek dokunuşla gidiş; "Müdahale edildi" işareti (60 gün saklanır).
- **Raporlar → Ekip sıralaması**: bu hafta / ay / yıl; ziyaret, farklı firma, teklif, sipariş, yeni proje, plana uyum ölçüleri; Excel.
- **Konum doğrulama** (Şirket profili → Genel): en fazla uzaklık (m) ve kural (uyar / engelle / kapalı). Uzaktan girişler uyarı akışına düşer.
- **KVKK konum metni** (`js/konum.js`): hazır ya da şirketin yazdığı metin; ilk girişte gösterilir, onay (kim, ne zaman, hangi metin) `konum_onaylari`na yazılır; metin değişince yeniden sorulur; onaylanmazsa giriş konumsuz kaydedilir.
- **schema.sql 43:** `konum_onaylari` (herkes yalnız kendi adına ekler; yetkili okur).

## Güncelleme notu (sürüm 100)

- **Finans → Çek ve senet** (`js/views/finans2.js`): alınan / verilen, keşideci, banka, vade, tutar, durum (portföyde, bankada tahsilde, tahsil edildi, ciro edildi, karşılıksız, ödenecek, ödendi), ciro; vadesi geçen işareti, Excel. Muhasebeye aktar'da çekler de seçilebilir.
- **Nakit akışı**: önümüzdeki 13 hafta; giriş = açık faturaların kalanı (vadesine göre) + alınan çekler; çıkış = verilen çekler + son 90 günün haftalık masraf ortalaması + isteğe bağlı sabit gider; başlangıç bakiyesiyle haftalık bakiye; satıra dokununca kalemler.
- **Banka ekstresi**: Excel ekstre (Tarih, Açıklama, Tutar/Alacak) yüklenir; açıklamadaki firma adı, belge no ve tutara göre açık fatura önerilir; seçilenlerin ödemesi faturaya işlenir. Ekstrenin kendisi kaydedilmez.
- **Prim ve hedef**: siparişin sorumlusuna göre kişi bazında satış, tahsilat, yıllık hedef (tablodan girilir), çeyrek seçimi, prim kuralı.
- **Masraf onayı**: "Ekibin girdiği masraflar onayımdan geçsin" açıkken ekip masrafı "Bekliyor" olur; yetkili Onayla / Reddet.
- **schema.sql 42:** `cekler`; `masraflar.kim`, `onay`, `onaylayan`, `onay_tarih`.

## Güncelleme notu (sürüm 99)

- **Bayi ve partner → Stoklar** (`js/views/bayiag2.js`): bayi başına stok (`bayi_stok`), Excel'den yükleme (Kod + Stok/Miktar/Adet, isteğe bağlı Fiyat), satır içi adet düzeltme, stok değeri, 90+ gün hareketsiz ve az kalan işareti; "Bütün bayiler" ile hangi bayide hangi ürün var araması. Atamada depo adı girilmişse Stok ve fiyat listesindeki o deponun ürünleri de görünür.
- **Satışlar**: bize alım (sell-in, siparişler) ve bayinin sattıkları (sell-out, `bayi_satis`) aylık grafik, ürün aileleri, stok devir hızı; "Satış bildir" formu.
- **Hedef ve prim**: çeyrek çeyrek satış, yıllık hedef, gerçekleşme %, yıl sonu tahmini, prim kuralı (hedefin %X'i ve üstünde satışın %Y'si).
- **Analiz**: pay, büyüme, ortalama ödeme gecikmesi, kayıp oranı, açık proje, stok; çalışılan illerde bayisi olmayanlar.
- Bayi karnesindeki stok kartı artık bayi stoklarını da sayar. Dış kullanıcı şablonu Stoklar ve Satışlar'a yazabilir.
- **schema.sql 41:** `bayi_stok`, `bayi_satis` (RLS; dış kullanıcı yalnız kendi firmasının satırlarını görür ve ekler).

## Güncelleme notu (sürüm 98)

- **Yapılmayan planlı ziyaretler** (Bugün kartı, `js/mazeret.js`): tarihi geçmiş ama "Planlandı" kalan ziyaretler; "Yapıldı" (formu açar), neden seçimi (müşteri yoktu, müşteri erteledi, ben erteledim, yetişemedim, acil iş, hava/yol, diğer) → durum **Yapılmadı** + mazeret, "Yarına ertele".
- Ziyaret durumlarına **Yapılmadı** ve formda "Yapılmadıysa nedeni" eklendi. Planlanarak açılan ziyaret `planli` işaretlenir (yapıldığında da kalır).
- **Plana uyum** (Haftalık rapor özeti, metni ve kartı): planlı ziyaretlerden yapılanların oranı; plansız ziyaret sayısı; yapılmama nedenleri.
- **Raporlar → Gün özeti** (`js/views/gunozet.js`): kişi ve gün seçimi; ilk giriş / son çıkış, ziyaret, sahada süre, tahmini yol, teklif ve görev; saat sıralı zaman çizelgesi. **Ay dökümü**: gün gün ilk giriş, son çıkış, ziyaret, sahada süre, yol, teklif, görev; Excel.
- **schema.sql 40:** `ziyaretler.planli`, `ziyaretler.mazeret`; eski "Planlandı" kayıtlar planlı işaretlenir.

## Güncelleme notu (sürüm 97)

- Yeni menü başlığı **Bayi ve partner** (`js/views/bayiag.js`): **Ağ** (liste, il dağılımı, tür ve durum süzgeci, Excel), **Bayi karnesi**, **Bayi talepleri** (Satış'tan taşındı).
- Yalnızca bayi/partner ağı olan şirkette görünür: Şirket profili → Genel'de "Bayi ve partner ağımız var" açıksa, en az bir bayi atanmışsa ya da şirket profilinde ana bayi yazılıysa. Ağ yokken bu ekranlar adresle de açılmaz. Dış kullanıcı (bayi) her zaman kendi taleplerini görür.
- **Atama kartı** (`bayiler` tablosu): firma, tür (Bayi, Alt bayi, Distribütör, Çözüm ortağı, Proje ortağı), durum, ana il, bölge, bizden sorumlu kişi, başlangıç ve sözleşme bitişi, iskonto, ödeme vadesi, kredi limiti, para birimi, yıllık hedef, stok deposu adı. Firma sayfası → ⋯ → "Bayi / partner olarak ata".
- **Bayinin satışı (bize alım):** firmanın siparişleri + siparişte "Bayi / partner (üzerinden)" seçilenler + ana bayi ise eski "ana bayi üzerinden" işaretli siparişler. Ana bayi ağa atanmamışsa Ağ ekranı tek dokunuşla atamayı önerir.
- **Bayi karnesi:** yıl satışı ve geçen yıl, hedef gerçekleşme, açık alacak ve risk, projeler (açık, kazanılan, kaybedilen ve kaybedilen markalar), stok değeri (depo adıyla), aylık satış grafiği, koşullar (kredi limiti aşımı uyarısı), son ziyaretler, kişiler.
- **schema.sql 39:** `bayiler` tablosu ve kuralları, `siparisler.bayi_id`, dış kullanıcı kendi bayi kaydını ve kendi üzerinden geçen siparişleri görür.

## Güncelleme notu (sürüm 96)

- Yeni menü başlığı **Finans** (`js/views/finans.js`): **Özet** (yıl/ay seçimi; satış, tahsil edilen, açık ve gecikmiş alacak, masraf, net; aylık satış-tahsilat-masraf grafiği; en çok borcu olan cariler), **Cari hesaplar** (firma bazında fatura, ödenen, bakiye, gecikmiş, en uzun gecikme, ortalama ödeme günü; dokununca ekstre: yürüyen bakiye, Excel, PDF/yazdır, WhatsApp), **Yaşlandırma** (vadesi gelmemiş, 0–30, 31–60, 61–90, 90+ gün; firmaya ya da sorumluya göre; Excel), **Tahsilat** (Satış'tan taşındı), **Masraf ve km** (ayrı menüden taşındı), **Kur** (Şirket profilinde de duruyor), **Muhasebeye aktar** (dönem seçip siparişler, faturalar, tahsilatlar, masraflar Excel'de).
- Tahsilat kaydına **Tür**: Fatura / Ödeme / İade. Ödeme ve iade faturaya bağlı olmadan cari bakiyeyi düşürür, açık alacak sayılmaz.
- Rol ayarında yeni ekranlar: Finans özeti, Cari hesaplar, Yaşlandırma, Kur, Muhasebeye aktar. Hazır "Muhasebe" rolü bunları içerir. Varsayılan olarak yalnız şirket yöneticisi görür.
- Menüde Finans'ın yanında vadesi geçmiş fatura sayısı.
- **schema.sql 38:** `tahsilatlar.tur`. Çalıştırılmazsa uygulama çalışır; tür kaydedilmez.

## Güncelleme notu (sürüm 95)

- **Satır içi İşle:** Bugün ve Görevler listesinde her açık görevin altında kutu; yazıp Enter → görev tamamlanır, not tarihle görevin notuna ve bağlı proje (yoksa firma) yorumlarına yazılır (`js/isle.js`).
- **Menü rozetleri:** başlık ve üst sekmede bekleyen sayısı (bugün ve öncesi son tarihli açık görevler, yeni bayi talepleri) (`js/rozet.js`).
- **Aşama şeridi:** proje sayfasının üstünde tıklanabilir aşamalar; değişiklik aşama geçmişine yazılır; "X gündür bu aşamada".
- **Bekleme rengi:** satış hunisinde açık projeler aynı aşamada 30+ gün turuncu, 60+ gün kırmızı kenarlı; kartta gün sayısı. Aşamaya giriş tarihi `proje_gecmis`ten, yoksa kayıt tarihinden.
- **Panel → Açık projeler – sorumluya göre:** kişi başına açık, sıcak, potansiyel, ağırlıklı tutar ve 30+ gün güncellenmeyen.
- **Damgalı fotoğraf:** ziyaret fotoğrafının altına çekim zamanı, konum (alınabildiyse) ve galeriden seçildiyse "Galeriden" şeridi (`js/damga.js`).
- Veritabanı değişikliği yok.

## Güncelleme notu (sürüm 94)

- **Giriş:** şirketin Supabase adresi ve `anon` (herkese açık) anahtarı `js/db.js` içinde `VARSAYILAN_BAGLANTI` olarak gömülü. Hiç kullanılmamış bir tarayıcıda uygulama doğrudan **kullanıcı adı + şifre** ekranıyla açılır; davet bağlantısı gerekmez. Ekranın altında "Yeni şirket hesabı oluştur" ve "Kayıt olmadan dene" (deneme modu) var; e-posta bağlantısı ve e-posta daveti küçük bağlantılar olarak duruyor. Daha önce bağlantısız (deneme modunda) kullanılmış tarayıcılar olduğu gibi kalır. `service_role` anahtarı uygulamada yoktur; veriyi veritabanı kuralları (RLS) korur.
- **Varsayılan şirket profili:** profil kaydedilmemiş yeni hesaplarda firma, bayi ve katalog boş gelir (eskiden EAE / Drv Elektrik görünüyordu). 13 Kasım 2026'dan önce kurulmuş, profili kaydedilmemiş eski hesaplar aynen çalışır. Profil eksikse Bugün'de "Şirket bilgilerini tamamla" kartı çıkar.
- **Sihirbaz:** girilenler taslak olarak saklanır; sayfa yenilenirse kaldığı adımdan sürer. "Sonra" ile ertelenebilir. Sihirbaz, pencere ya da giriş ekranı açıkken uygulama güncellemesi sayfayı kendiliğinden yenilemez.
- **Ziyaret formu:** firma, kişi ve not en üstte; yeni "yapıldı" ziyarette saat şimdiki saatle dolu. Otomatik konum alınamazsa kırmızı uyarı çıkmaz, konum alanında yazar.
- **Yeni proje:** hızlı kayıt; yalnızca temel alanlar açık, firmalar / konum / ayrıntılar kapalı başlıklarda.
- **Telefon düzeni:** üstteki sekme şeridi arama düğmesinin altına girmiyor ve açık sekme görünür kaydırılıyor; Panel'deki "En çok çalıştığın firmalar" tablosu kayıyor; dokunmatik ekranda küçük düğmeler, etiketler ve durum seçicileri en az 40 piksel.

## Güncelleme notu (sürüm 93)

- **Profilim** (`#/profilim`), şirket profilinden ayrı kişisel sayfa: kişi kartı (ad, ünvan, rol, şirket, kullanıcı adı, giriş e-postası, telefon), "Kartvizitimi gönder", **Ne görebilirim?** (rolün düzenlediği / gördüğü ekranlar, kayıt kapsamı, gizli bilgiler), **Bilgilerim** (ad, ünvan, telefon, iletişim e-postası, imza), **Giriş ve şifre**, **Güvenlik**, **Çıkış**.
- Kişisel bilgiler Supabase hesabının `user_metadata` alanında saklanır (her kişiye özel; şema değişikliği yok). Mesajlardaki `{benim}` imzası önce buradan okunur.
- Menüde kim olarak girdiğin: bilgisayarda sol menünün en altında ad, rol ve çıkış düğmesi; telefonda üst barın sağında baş harfli yuvarlak.
- Ayarlar → Hesap'taki giriş bilgileri ve güvenlik Profilim'e taşındı; orada yönlendirme kaldı. Çıkış, bu cihazdaki kayıt kopyasını siler, gönderilmeyi bekleyen kayıtları korur.

## Güncelleme notu (sürüm 92)

- Şirket profili → **Son değişiklikler** ayrı sekme oldu (Genel'den taşındı).
- **Kullanıcılar** sadeleşti: arama ve durum süzgeci (Aktif / Bekleyen / Pasif), baş harfli satırlar, rol altında ekip. Kişi kartı dört bölüm: Kişi · Rol ve ekip · Ne görür? · Giriş. "Ne görür?" rolün düzenlediği ve gördüğü ekranları etiketlerle gösterir; ekran ağacı yalnızca "Bu kişiye özel ayar" ya da rolsüz kişide açılır. Yeni kullanıcıda ilk rol hazır seçili gelir.
- **Roller** sadeleşti: rol listesi kişi sayısıyla; rol ayarı sekmeli (Ekranlar · Kayıtlar ve gizlilik · Açılış ve menü · Özet). Ekranlar başlık başlık kutularda, her başlığa "tümü" seçimi; hazır şablonlar tek bir "Şablondan doldur" listesinde.
- Veritabanı değişikliği yok (schema.sql sürüm 37 olarak kalır).

## Güncelleme notu (sürüm 91): kullanıcı adı ve şifreyle giriş, roller, sekmeli şirket profili

**Supabase'de: (1) güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 37), (2) Edge Functions → "Deploy a new function" → "Via Editor" → adı `kullanici` → `supabase/functions/kullanici/index.ts` içeriğini yapıştır → Deploy.** (service_role anahtarı uygulamaya girmez; fonksiyon onu Supabase'in içinde kendiliğinden kullanır.)

- **Şirket profili sekmeli:** Genel (şirket adı, yöneticiler, ekip şeması, son değişiklikler) · **Kullanıcılar** · **Roller** · **Ekipler** · Otomasyonlar · Döviz kuru.
- **Kullanıcılar:** "Kişi ekle" → ad soyad (kullanıcı adı kendiliğinden önerilir: Ayşe Şahin → ayse.sahin), rol, ekip, **geçici şifre** (kendiliğinden üretilir), e-posta isteğe bağlı. **Hesabı aç** deyince giriş bilgileri çıkar; **WhatsApp ile gönder** mesajında uygulama bağlantısı (telefonu şirketin veritabanına bağlar ve kullanıcı adını doldurur), kullanıcı adı ve geçici şifre olur. Kişi ilk girişte kendi şifresini belirlemeden devam edemez.
- Liste satırında ad, kullanıcı adı, rol ve durum: **Aktif**, **İlk girişi bekliyor**, **Hesabı yok**, **Pasif**; son giriş. Kişiyi açınca **Şifreyi sıfırla** (yeni geçici şifre) ya da **Kullanıcı adıyla hesap aç**. E-postası olmayan hesaplarda "Şifremi unuttum" yerine yönetici sıfırlar.
- **Giriş ekranı** kullanıcı adı öncelikli; e-postalı eski hesaplar e-postayla da girer.
- **Roller:** istediğin kadar rol ekle (ad, açıklama, ekranlar Kapalı/Görür/Düzenler, kayıt kapsamı, gizli alanlar). Yeni **Görünüm** bölümü: **açılış ekranı**, **alt menü** (en fazla 5 başlık) ve **Bugün kartları**. Rolü kaydedince o roldeki herkes birlikte güncellenir; kişi kendi menüsünü sonradan değiştirebilir. **Bu rol gibi gör** ile önizlenir.

## Güncelleme notu (sürüm 90): şirket barı

- **Telefonda** şirket (profil) kartı alt menüden çıktı; sayfanın **en üstünde ince bir bar** olarak duruyor (şirket adı, sektör ve iller; dokununca Şirket profili; birden çok şirket varsa yanında Şirket değiştir). Sayfa kayınca kaybolur, sekmeler üstte kalır; haritada gizlenir. Alt menü düğmeleri tam genişliği kullanıyor.
- **Bilgisayarda** soldaki menüde şirket adı kesilmeden, gerekirse iki satırda yazılıyor.

## Güncelleme notu (sürüm 89): Ziyarete hazırlık

- Bugün'ün planındaki her ziyarette **Hazırlık**, firma sayfasında **Ziyarete hazırlık**: firmanın son 12 ayı (ziyaret, teklif ve tutarı, sipariş ve tutarı, kazanılan/kaybedilen), **konuşulacaklar** (vade riski, açık ve gecikmiş görevler, cevap bekleyen teklifler, sessiz sıcak projeler, satış haritası uyarıları, müşteride bekleyen numune, açık servis kaydı), açık projeler, **kiminle** (karar vericiler önce, telefon, 14 gün içindeki doğum günü), son iki görüşmenin notları, bu firmada kaybedilen markalar. Altta Yol, Firma sayfası, **Giriş yap**.

## Güncelleme notu (sürüm 88): tahsilat ve vade riski

- Firma bazında risk, Satış → Tahsilat kayıtlarından: gecikmiş alacak (yaklaşık USD), en uzun gecikme ve geçmişte vadeden ortalama kaç gün sonra ödediği.
  - **Yüksek risk:** 60 günden uzun ya da 50.000 $ üstü gecikme. **Dikkat:** 15 günden uzun gecikme. **Geç öder:** en az 3 kapanmış faturada ortalama 30+ gün geç ödeme.
- Nerede görünür: **teklif penceresinde** uyarı (firma değişince güncellenir; "vade ve ödeme koşulunu buna göre belirle"), **ziyaret penceresinde** ("tahsilatı da konuş"), **firma sayfası** başlığında ve **Bugün'ün planında** rozet, **Panel'de Vade riski** kartı.
- Tahsilat kaydı olmayan firmada hiçbir şey çıkmaz; cari ekstresi Tahsilat ekranından Excel ile yüklenebilir. Şema değişikliği yok.

## Güncelleme notu (sürüm 87): Bugünün soruları

- Bugün ekranında yeni kart: her gün en fazla **3 kısa soru**, yerinde cevaplanır: kayıp projede neden ve işi alan marka, açık projede tutar, beklenen tarihi 60 günden çok geçmiş projede durum (1 ay ileri at / Beklemede / Kaybettik), takip yılı, aktif firmanın segmenti (A/B/C). Bir firmada içerideyken firmanın konumu yoksa giriş konumunu firmaya kaydetmeyi sorar.
- Sorular önem sırasıyla gelir (sıcak ve büyük projeler önce), her gün değişir. **Atla** o soruyu 30 gün sormaz; 3 cevaptan sonra "Bugünlük bu kadar" der, istersen **Bir tane daha**. Tamamı Veri kontrolü ekranında.
- Bugün kartları düzenle menüsünden kapatılabilir.

## Güncelleme notu (sürüm 86): aynı anda düzenlemede alan alan birleştirme

- Bir kaydı sen açtıktan sonra başka biri (ya da öbür cihazın) değiştirdiyse artık "seninki mi onunki mi" diye bütün kaydı sormuyor:
  - **Farklı alanları** değiştirdiyseniz (sen notu, o durumu) ikisi de kalır, hiçbir şey sorulmaz.
  - **Aynı alanı** farklı değiştirdiyseniz yalnızca o alan, iki değer yan yana sorulur ("Notlar: onunki «…», seninki «…»"); diğer değişikliklerin her durumda kaydedilir.
- **İnternetsizken** yapılan değişiklik bağlantı gelince eskiden körlemesine yazılıyordu; arada başkası değiştirdiyse onunki siliniyordu. Artık aynı şekilde birleştiriliyor. Aynı alan çatışırsa kayıt **Bekleyen kayıtlar**da "Benimki kalsın / Onunki kalsın" seçimiyle bekliyor.
- Aynı kayıt internetsizken birkaç kez değiştirilirse ilk değişikliğin çıkış noktası korunuyor.

## Güncelleme notu (sürüm 85): özellik kullanımı ölçümü

- Ayarlar → Görünüm → **Kullanım** kartı artık ekranların yanında ekran içindeki özellikleri de sayıyor: radar Planla/Ertele, hafta planına ekleme ve Otomatik dağıt, ziyarete giriş-çıkış, Konuşarak kaydet, onay bağlantısı, teklif PDF/WhatsApp, bayi talebi, Pazartesi özeti, firma/proje/kişi sayfaları. "Özellikler" bölümünde hangisinin hiç kullanılmadığı görünür.
- Ölçüm yalnızca bu cihazda tutulur, hiçbir yere gönderilmez. 21 gün sonra hiç açılmayan ekranları menüden kaldırma önerisi (önceden de vardı) sürüyor.

## Güncelleme notu (sürüm 84): Yenilikler penceresi

- Yeni sürüm ilk açıldığında bir kez **Yenilikler** penceresi: o güne kadar görmediğin yeni özellikler, en yenisi üstte; her birinde ilgili ekrana götüren **Göster** düğmesi. Sonra her ekrandaki **?** → **Yenilikler** ile yeniden açılır.
- Uygulamayı ilk kez kullanan yalnızca 4 adımlık tanıtımı görür, yenilikler listesini görmez.

## Güncelleme notu (sürüm 83): hız ve telefon düzeni

- Büyük veriyle (400 firma, 1.800 proje, 6.000 ziyaret, 1.200 teklif, 2.500 görev; yavaş telefon benzetimi) ölçüldü ve hızlandırıldı: Ziyaretler ekranı yaklaşık 10 kat (1,1 sn → 0,1 sn), Teklifler 25 kat (1,7 sn → 0,07 sn), Panel 4 kat, Hafta planı 2,5 kat, Bugün 2 kat hızlı açılıyor.
- Nasıl: kayda kimlikle erişim dizinli yapıldı, tarih ve para biçimlendiriciler bir kez kuruluyor, firma başına tekrar tekrar tüm projeleri tarayan hesaplar tek geçişe indirildi, Ziyaretler ve Teklifler listesi ilk 150/200 kayıtla açılıp "Daha fazla göster" ile uzuyor.
- Tüm ekranlar telefonda (390 px) tarandı: taşma ve hata yok. Ekip haritası ve Kayıp ve rakip tabloları dar ekranda sıkışmak yerine yana kayıyor; sayfa sonu + düğmesinin altında kalmıyor.

## Güncelleme notu (sürüm 82): Pazartesi özeti bildirimi

- Her pazartesi 08:00'de (Türkiye) telefona bildirim: geçen hafta kaç ziyaret, teklif ve sipariş; bu hafta kaç planlı ziyaret, süresi dolan teklif ve açık görev. Uygulama kapalıyken de gelir; dokununca uygulama açılır ("Haftan" kartı ya da plan yoksa Hafta planı).
- Herkese kendi özeti gider: veri sahibine şirketin tamamı, ekip üyesine yalnızca kendi kayıtları. **Tutar ve müşteri adı gönderilmez.**
- Ayarlar → Genel → Bildirimler: "Pazartesi sabahı haftalık özet" seçeneği (cihaz başına kapatılabilir) ve **Şimdi bir özet gönder** düğmesi.
- **Kurulum (bir kez, veri sahibi):** Ayarlar → Bildirimler → **Zamanlamayı kur**. (1) `supabase/functions/bildir/index.ts` dosyasının güncel halini bildir fonksiyonuna yeniden yükle, (2) üretilen **CRON_ANAHTAR** değerini Edge Functions → Secrets'a ekle, (3) gösterilen SQL'i SQL Editor'de çalıştır (pg_cron ve pg_net ile pazartesi 05:00 UTC). service_role anahtarı kullanılmaz.

## Güncelleme notu (sürüm 81): Kayıp ve rakip istihbaratı

- **Raporlar → Kayıp ve rakip:** yıl, il ve sektöre göre süzülen pano. Üstte kaybedilen ve kazanılan tutar, kazanma oranı, en çok kaybettiğimiz rakip ve rakibin ortalama fiyat farkı.
- **Rakipler tablosu:** her rakip için kaybettiğimiz proje ve tutar, o rakibe karşı kazandıklarımız, rakibin kazandığı pay, en sık kayıp nedeni, ortalama fiyat farkı (bizim teklif ile rakip toplamı girili kayıplarda) ve çeyreklere göre kayıp gidişatı. Satıra dokununca rakibin kaybettiğimiz ve kazandığımız projeleri açılır.
- **Neden, il, sektör** dağılımları ve **il × rakip**, **sektör × rakip** tabloları ("Mersin'de lojistikte Pelsan'a kaybediyoruz").
- "Kazandıklarımız": Ürünler → Rakip fiyatları ekranında projeye bağlanan rakip kaydı ya da projede yazılı rakip markası olan siparişler. Eksik kayıp bilgisi tek dokunuşla tamamlanır; Excel çıktısı var. Panel'deki kayıp kartından da bu ekrana geçilir. Şema değişikliği yok.

## Güncelleme notu (sürüm 80): Pazartesi özeti

- Haftanın ilk açılışında (Pazartesi–Çarşamba) Bugün ekranının üstünde **Haftan** kartı: geçen hafta (ziyaret ve gün sayısı, teklif ve tutarı, sipariş ve tutarı, kazanılan, kaybedilen), bu hafta (planlı ziyaret, geçerliliği dolan teklif, açık görev, çeyrek hedefinin yüzdesi ve kalan), **Dikkat** (Fırsat radarının ilk üçü). Ekibi olan yöneticiye ekibin geçen haftaki ziyaret sayıları da yazılır.
- **Geçen haftanın raporu** (PDF, Excel, WhatsApp) ve **Hafta planı** kartın içinden açılır. Kapatınca o hafta bir daha çıkmaz.
- Özet telefonda hesaplanır, hiçbir yere gönderilmez. (Uygulama kapalıyken pazartesi sabahı bildirim göndermek için sunucuda zamanlanmış görev gerekir; ayrıca istenirse eklenebilir.)

## Güncelleme notu (sürüm 79): Ekip haritası ve canlı akış

- **Raporlar → Ekip haritası:** seçilen gün ekibin ziyaret noktaları haritada (renk kişiye göre, kesikli çizgi o günün güzergâhı; içeride olan nabız atar), **kişi özeti** (yapılan/planlı ziyaret, içeride geçen süre, tahmini yol, teklif, tamamlanan görev; "şu an Atlas Proje'de, 10:30'dan beri") ve saat sırasıyla **akış** (giriş, çıkış ve süre, ziyaret sonucu, teklif, tamamlanan görev). Kişiye göre süzülür, önceki günlere gidilir.
- Giriş-çıkış (sürüm 71) verisinin üstüne kuruludur. Konum yalnızca giriş ve çıkış anında alınır; sürekli takip yoktur. Herkes yalnızca kendi yetki kapsamındaki kayıtları görür (yönetici kendi ekibini). Şema değişikliği yok.

## Güncelleme notu (sürüm 78): Konuşarak ziyaret kaydı

- **+ → Konuşarak kaydet** (eski "Sesli not"): mikrofona dokun, anlat. Örnek: "Yıldız Elektrik'te Ali Bey'le görüştüm, hastane işi için teklif istedi, perşembe ara".
- Cümleden ayrılanlar: **firma** (ekli adla da: Yıldız'da, Kuzey İnşaatta), **kişi** (Ali Bey, Ayşe Hanım ya da ad soyad; firmanın kişileri önce), **proje** (firmanın projeleri önce; "hastane işi" → Devlet Hastanesi Ek Bina), **sonuç** (teklif istendi, pazarlık, olumlu, olumsuz, görüşülemedi, sipariş…), **amaç**, **ziyaret tarihi** ("dün") ve **sonraki adım** (ara, teklif gönder, numune götür, tekrar uğra, katalog gönder) ile tarihi (bugün, yarın, öbür gün, gün adı, haftaya salı, 3 gün sonra, 20 kasım, ayın 5'i, ay sonu).
- Alanlar yazdıkça dolar; elle değiştirdiğin alan bir daha üzerine yazılmaz. Kaydedince bugünün ziyareti ve sonraki adım görevi açılır. Firma bulunmazsa not görevlerine düşer.
- Ayrıştırma kurala dayalıdır ve telefonda yapılır; yazılan metin başka bir servise gönderilmez. Mikrofon kullanılırsa sesi yazıya tarayıcının konuşma tanıması çevirir; Chrome'da bu Google'ın hizmetidir (sesli yazma uygulamada zaten böyle çalışıyordu). Bunu istemezsen cümleyi yazarak gir.

## Güncelleme notu (sürüm 77): Bayi portalı

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 36: bayi_talepleri tablosu).**

- **Satış → Bayi talepleri.** Dış kullanıcı (bayi ya da proje firması) girişte doğrudan **Taleplerim** ekranını görür: **Yeni proje** (ad, il/ilçe, müteahhit, tahmini tutar, beklenen alım), **Teklif isteği** (görebildiği bir proje için ya da yeni), **Stok sorusu** (ürün ve adet) ya da **Diğer**. Yanıtı aynı ekranda görür; henüz işlenmemiş talebini geri çekebilir.
- Her yeni talep sunucuda **görev** olarak açılır: firmanın sorumlusuna atanır (teklif isteği yarına yüksek öncelikli, diğerleri 2 gün sonraya).
- Şirket tarafında talepler durumlarıyla (Yeni, İnceleniyor, Yanıtlandı, Projeye dönüştü, Kapandı): **Yanıtla** (bayi görür), **Projeye dönüştür** (proje formu bayi, il, tutar ve notlarla dolu açılır; kaydedince talep projeye bağlanır), **Teklif hazırla**, **Kapat**. Bayi telefonla ilettiyse **Talep kaydet** ile bayi adına girilebilir.
- Güvenlik sunucuda: dış kullanıcının talebi her zaman kendi firmasına bağlanır, başka firmanın talebini göremez, durumu ve yanıtı değiştiremez, görevleri görmez.

## Güncelleme notu (sürüm 76): Teklif onay bağlantısı

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 35: teklif_baglantilari tablosu, teklif_goster ve teklif_yanitla işlevleri).**

- Teklif penceresinde **Onay bağlantısı**: bağlantı oluştur, kopyala ya da WhatsApp ile gönder. Müşteri bağlantıyı telefonunda açar, teklifi PDF'teki haliyle görür; **Onaylıyorum**, **Revize istiyorum** ya da **PDF indir** der.
- Onaylarsa teklif kendiliğinden **Kabul** olur. Onayda da revize isteğinde de bağlantıyı oluşturana o güne yüksek öncelikli görev düşer (müşterinin adı ve notuyla). Değişiklik geçmişinde "Müşteri (onay bağlantısı)" olarak görünür.
- Bağlantı penceresinde her bağlantının durumu: kaç kez açıldı, son açılma, yanıt. Teklifler listesinde rozet: "Bağlantı gönderildi", "Açıldı 2×", "Bağlantıdan onaylandı", "Revize istendi". Taslak teklif bağlantı oluşturulunca Gönderildi olur.
- Güvenlik: müşteri teklifler tablosuna hiç erişmez; bağlantı oluşturulurken teklifin müşteriye gidecek hali (PDF ile aynı) donmuş kopya olarak saklanır. Anahtar 48 karakterlik rastgele dizgedir, tahmin edilemez. Bağlantı teklifin geçerlilik tarihinde (yoksa 30 gün sonra) kapanır, istediğin an **İptal et** ile kapatılır, yanıt bir kez verilir. Teklifi sonra değiştirirsen yeni bağlantı oluştur. Tutarları göremeyen ekip üyeleri bağlantıları da göremez.
- Bağlantı adresinde Supabase proje kodu ve herkese açık (anon) anahtar bulunur; bu anahtar zaten uygulamanın tarayıcıda kullandığı anahtardır ve veriler satır güvenliğiyle korunur.

## Güncelleme notu (sürüm 75): Haftalık saha planı

- **Bugün → Hafta planı** sekmesi: haftanın her gününe bölge seç (Adana, Mersin, Hatay, Osmaniye…), soldaki **öneri listesinden** firmayı güne sürükle ya da gün düğmesine dokun. Sarı gün düğmesi, o gün seçtiğin bölgeyle aynı ildeki günü gösterir.
- Öneriler: Fırsat radarı, ziyaret aralığı geçen firmalar ve zamanı gelen projeler; firma başına bir satır, ile göre süzülür. Bu hafta zaten planlanmış firma listede çıkmaz.
- **Otomatik dağıt:** bölgesi seçili günlere o ildeki en önemli önerileri koyar (günde en fazla 4).
- Planlı ziyaretler günler arasında sürüklenerek taşınır, × ile plandan çıkarılır. Her gün için **Rotayı aç** Google Haritalar'da sıralı rota açar. Üstte haftanın özeti: plan, yapıldı, kaçan.
- Planlar uygulamadaki planlı ziyaretlerdir; Google Takvim'e gönderilmez. Şema değişikliği yok.

## Güncelleme notu (sürüm 74): Fırsat radarı

- **Bugün** ve **Panel** ekranında yeni kart: kaçmak üzere olan işler tek listede, önem sırasıyla. Dört tür: uzun süredir hareket olmayan sıcak projeler (varsayılan 14 gün), karar vericisi belirsiz, ulaşılmamış ya da rakipçi olan projeler, geçerliliği dolan ve cevap gelmemiş teklifler, ziyaret aralığı geçmiş A ve key account müşteriler.
- Sıra, projenin tutarı × olasılığı ve ne kadar süredir sessiz kaldığıyla belirlenir. Her satırda **Planla** (yarına planlı ziyaret) ya da **Haritaya** (satış haritası) ve **Ertele** (7 gün gösterme) var. **Tümü** penceresinde türe göre süzme ve sessizlik süresi ayarı.
- Hesap telefonda yapılır, yeni tablo ya da şema değişikliği gerekmez.

## Güncelleme notu (sürüm 73): Şablonlar yerinde, Excel'den proje yüklemesi genişledi

- **Mesaj şablonları** Firmalar ve Kişiler ekranının üstünde ("Mesaj şablonları") ve WhatsApp penceresinde ("Şablonları düzenle"). **Teklif bilgileri** (PDF üst bilgisi ve koşullar) Teklifler ekranının üstünde. Şirket profilindeki "Mesaj ve teklif şablonları" sekmesi kalktı.
- **Excel'den proje yüklemesi:** uygulamanın kendi proje çıktısı (Projeler → Excel'e aktar) olduğu gibi geri yüklenebiliyor. Yeni tanınan sütunlar: Malzeme alıcısı, Danışman, Kanal (bayi ya da "Direkt"), OSB, Lokasyon, Sektör, Olasılık, Takip yılı, Takip eden, Teklif no, Şantiye aşaması, Sipariş tutarı, Kayıp nedeni, İşi alan marka, Enlem ve Boylam (konum). Başlık bulma daha sıkı ("İl" artık "Takip yılı"na karışmıyor).
- Ayarlar → Veri ve yedek'te yükleme bittikten sonra kartın kaybolması düzeltildi.
- Silinen otomatik görev bir sonraki taramada yeniden açılmıyor.

## Güncelleme notu (sürüm 72): Yinelenen görevler ve otomasyon

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 34: görevlere tekrar ve kaynak sütunları).**

- **Tekrarlanan görev:** görev penceresinde "Tekrar" (her iş günü, her hafta, 2 haftada bir, her ay, 3 ayda bir, her yıl). Görev tamamlanınca bir sonraki aynı firma, proje, kişi ve atananla kendiliğinden açılır (ör. "her ayın 1'i cari ekstresi iste"). Ayın 31'i gibi günler kısa aylarda ayın son gününe kayar. Listede "↻ Her ay" yazar.
- **Otomasyonlar** (Şirket profili → Otomasyonlar; her kural açılıp kapatılabilir, gün sayısı değiştirilebilir):
  - Proje "Teklif Verildi" olunca 3 gün sonra "Teklifi takip et".
  - Proje "Sıcak" olunca 2 gün içinde "Karar vericiyle görüş" (yüksek öncelik).
  - Proje "Sipariş" olunca 14 gün sonra "Teslimat ve montajı takip et".
  - Gönderilmiş teklifin geçerliliği bitmeden 2 gün kala "Teklif süresi doluyor".
  - Müşterideki numunenin iade günü gelince "Numuneyi geri al".
  - Vadesi 1 gün geçen açık fatura için "Tahsilat".
- Tarih kuralları uygulama açılınca günde bir kez taranır ("Şimdi tara" ile hemen). Her otomatik görev bir kez açılır; tamamlansa ya da silinse de tekrar açılmaz.

## Güncelleme notu (sürüm 71): Ziyarette giriş-çıkış

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 33: ziyaretlere giriş, çıkış ve mesafe sütunları).**

- Firma sayfasında **Giriş yap** (Düzenle'nin yanında) ve Bugün ekranındaki planlı ziyaretlerde **Giriş** düğmesi. Girişte saat ve konum kaydedilir, firmanın kayıtlı konumuna uzaklık ölçülür (1 km'den uzaksa sorulur). O gün o firmaya planlı ziyaret varsa yeni kayıt açılmaz, planlı ziyaret kullanılır.
- İçerideyken her ekranın üstünde yeşil bant: firma adı, giriş saati, geçen süre ve **Çıkış yap**. Bant firmaya dokununca firma sayfasını açar.
- Çıkışta saat ve konum kaydedilir, ziyaret formu açılır (sonuç ve notlar için). Ziyaretlerde "10:05–10:48 · 43 dk · firmaya 80 m" görünür.
- Başka bir firmaya giriş yapmadan önce çıkış yapılmamış ziyaret varsa önce oradan çıkılması önerilir.

## Güncelleme notu (sürüm 70): Excel'den ilk yükleme ve örnek veriler

- **Excel'den yükle (firmalar, kişiler, projeler):** Bugün ekranında (hesap boşken) ve Ayarlar → Veri ve yedek'te. Excel ya da CSV seçilir; sütunlar başlık adından tanınır, ilk seferde kontrol için sorulur ve hatırlanır. Önizlemede kaç yeni, kaç güncellenecek ve kaç değişmeyecek kayıt olduğu görünür.
  - Aynı adlı firma / proje ya da aynı telefonlu kişi varsa yeni kayıt açılmaz, yalnızca **boş alanları** doldurulur.
  - Kişi ve proje listesindeki firma adları kayıtlı değilse firma olarak da eklenir (projelerde rolüne göre tipiyle: Emüt, Gemüt, Bayi…).
  - Kişilerde ad soyad tek sütun ya da ayrı sütun olabilir; pozisyon unvandan tahmin edilir. Projelerde aşama yazısı (ör. "teklif verildi", "kaybedildi") uygulamanın aşamalarına çevrilir.
  - Her tür için **boş şablon** (örnek satırlı Excel) indirilebilir.
  - CSV dosyaları (noktalı virgül, virgül ya da sekme ayraçlı) internet olmadan da okunur.
- **Örnek verilerle dene:** kurgusal 6 firma, 6 kişi, 6 proje (farklı aşamalarda), 4 ziyaret ve 2 görev eklenir; adlarında "(örnek)" yazar. **Örnek verileri sil** yalnızca bunları siler, senin eklediklerine dokunmaz.

## Güncelleme notu (sürüm 69): Çok şirketli kişi, şirketler arası geçiş (K5)

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 32).**

- Aynı e-postayla birden fazla şirketin ekibinde olan (ya da kendi şirketi de olan) kişinin menüsünde, şirket adının yanında **⇄ Şirket değiştir** düğmesi çıkar; telefonda Şirket profili sayfasının üstünde.
- Listede her şirketin adı ve oradaki rolü (Kurucu, Şirket yöneticisi, Satış, Dış kullanıcı…) görünür. Seçilen şirket sunucuda kişiye özel saklanır; bir sonraki girişte de o şirket açılır.
- Geçişte önceki şirketin telefondaki kopyası silinir, yeni şirketin kayıtları baştan yüklenir. Buluta gönderilmemiş değişiklik varsa önce sorulur.
- Kayıt kapsamı (Kendi / Ekibi / Tüm şirket) artık her şirket için ayrı hesaplanır: bir şirketteki "yalnızca kendi kayıtları" kısıtı, o şirket seçili olmasa da geçerlidir.

## Güncelleme notu (sürüm 68): Dış kullanıcı: bayi ve proje firması (K5)

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 31).**

- Şirket profili → Ekip ve yetkiler → kullanıcı kartında yeni alan: **Dış kullanıcı (bayi / proje firması)**. Firma seçilince o kişi:
  - yalnızca **firmasının herhangi bir rolde** (bayi, emüt, alıcı, projeci, danışman…) yer aldığı projeleri görür;
  - bu projelere ya da firmasına bağlı teklif, sipariş, numune, servis ve belgeleri görür;
  - firmalardan yalnızca kendi firmasını, kişilerden yalnızca kendi firmasının kişilerini görür;
  - ürün, stok ve katalog açıktır (ekranı rolünde açıksa);
  - **satış haritası, ziyaretler, görevler, masraflar, hedefler, rakip fiyatları ve diğer firmalar kapalıdır.**
- Kurallar sunucuda uygulanır (kısıtlayıcı RLS kuralı `dis_uygun`); dış kullanıcının telefonuna başka kayıt gelmez. Hangi ekranları göreceği ve tutarların gizlenip gizlenmeyeceği yine rolünden seçilir; yeni hazır şablon: **Dış kullanıcı**.
- Dış kullanıcının menüsünde "Dış kullanıcı · Firma adı" yazar.
- Hassas alanlar artık gruplu: projelerde satış haritası (karar grubu) ayrı bir grup; dış kullanıcıya hiç gönderilmez.

## Güncelleme notu (sürüm 67): Hassas alanlar sunucuda (K4)

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 30).**

- Kullanıcının rolünde (Şirket profili → Ekip ve yetkiler → "Gizli bölümler") **Tutar, fiyat, cari ve hedefler** ya da **Kişilerin telefon ve e-postası** kapalıysa bu değerler artık **sunucuda** gizlenir: o kişinin telefonuna hiç gönderilmez (önceden yalnızca ekranda "•••" gösteriliyordu, veri telefona yine geliyordu).
- Gizlenen sütunlar: projelerde tutar, sipariş tutarı, bizim teklif, rakip fiyat ve toplam · teklif kalemleri ve toplamı · sipariş net değeri · stok ve stok geçmişi fiyatı · hedefler · rakip fiyatları · tahsilat tutarı ve ödenen · kişilerde telefon, e-posta, kartvizit fotoğrafı, doğum günü.
- Bu alanları göremeyen kişi kaydı düzenleyip kaydettiğinde gizli değerler değişmez ya da silinmez (sunucu korur).
- Kurucu ve şirket yöneticileri her şeyi görür. Teknik: sütunların doğrudan okunması kapatıldı; değerler `hassas_degerler()` ile yalnızca hakkı olana döner, kayıtlar `kaydet_toplu()` ile yazılır.
- Şema çalıştırılmazsa uygulama eskisi gibi çalışır (gizleme yalnızca ekranda).

## Güncelleme notu (sürüm 66): Bugün ve Takvim tek başlıkta, şirket profili sekmeli, Ayarlar sadeleşti

- **Bugün ve Takvim birleşti:** menüde tek "Bugün" başlığı; üstte sekmeler Bugün · Takvim · Ziyaretler · Görevler. Menüde bir yer boşaldı (varsayılan ana menüye Satış geldi).
- **Şirket profili** tam genişlikte, sekmeli: **Genel** (bilgiler, kayıt sayıları, ekip ağacı) · **Ekip ve yetkiler** (kullanıcılar, roller, ekipler, son değişiklikler; Ayarlar'dan taşındı) · **Mesaj ve teklif şablonları** (WhatsApp şablonları ve teklif PDF bilgileri; Ayarlar'dan taşındı) · **Döviz kuru** (Bağlantılar'dan taşındı). Seçili sekme adreste: `#/sirket/ekip`.
- **Ayarlar:** "Firma profili", "Ekip ve yetkiler", "Mesaj ve teklif" kalktı. **Bildirimler** kendi bölümünde. Bağlantılar'da yalnızca Google anahtarı ve konum aktarma kaldı.
- **Araç bilgisi** (yakıt tüketimi ve litre fiyatı) Ayarlar → Uygulama'dan **Masraf ve km** ekranına taşındı (açılır kutu, kapalıyken özeti görünür).
- **Şema indirme:** tek "İndir" düğmesi; açılan pencerede biçim (Resim / PDF) ve "Firmadan ayrılanlar da çıksın" seçimi. Son görüşme bilgisi (temas yok, … gün önce) çıktıya artık girmez; kutular kısaldı.

## Güncelleme notu (sürüm 65): Organizasyon şemasını resim ya da PDF olarak indir

- Firma sayfası → Kişiler ve şema → şemanın üstünde **Resim indir** ve **PDF** düğmeleri.
- Resim: başlıkta firma adı ve tarih, kutular, bağlantı çizgileri, bölüm etiketleri, karar verici ve son temas rozetleri; altta firmadan ayrılanlar. Yüksek çözünürlüklü PNG, WhatsApp'tan ya da e-postayla paylaşılabilir.
- PDF: yazdırma penceresi açılır, "PDF olarak kaydet" seçilir. Şema genişse sayfa kendiliğinden yatay olur ve sayfaya sığdırılır.
- Ekrandaki yakınlaştırma ne olursa olsun indirilen şema tam boyutta çizilir.

## Güncelleme notu (sürüm 64): Satış haritası (projenin karar grubu)

**Supabase'de güncel `supabase/schema.sql` dosyasını çalıştır (sürüm 29: projelere `karar_grubu` sütunu).** Çalıştırılmazsa harita yalnızca bu cihazda kalır.

- Proje sayfasında **Satış haritası** sekmesi ("Firmalar ve kişiler"in yerine): projedeki kişiler, hangi firmadan olursa olsun, tutumlarına göre dört sütunda: **Destekliyor · Tarafsız · Bilinmiyor · Rakipçi**.
- Her kişinin bu projedeki **rolü** (Onaylayan, Teknik değerlendiren, Satınalma, Etkileyici, Kullanıcı / saha), **etkisi** (Yüksek / Orta / Düşük, üç çubuk), son görüşme tarihi ve kısa not. Karta dokununca değiştirilir; masaüstünde sütunlar arasında sürüklenebilir.
- **Kişi ekle:** projedeki firmaların kişileri işaretlenip topluca eklenir; başka kişiler de aranabilir. Kişi kartında rolü "Karar verici" olan Onaylayan ve yüksek etkili gelir.
- **Uyarılar:** karar verici yok · karar vericiye ulaşılmadı (hiç görüşme kaydı yok) · karar vericiyle 90 günden uzun süredir görüşülmedi · karar verici ya da yüksek etkili biri rakipçi · seni destekleyen kimse yok · teknik değerlendiren eklenmemiş.
- Özet sekmesinde kısa kart: tutuma göre sayılar ve en önemli uyarı.
- Kişi sayfasının Projeler sekmesinde, kişinin haritada yer aldığı projeler o projedeki rolü ve tutumuyla görünür.

## Güncelleme notu (sürüm 63): Proje kartı kendi sayfasında

- Projeye dokununca firma ve kişi gibi **kendi sayfası** açılır; üstte projenin aşama renginde ince şerit, "←" ile gelinen yere dönülür.
- Başlık: aşama, tutar, olasılık, beklenen sipariş ayı, son ziyaret. Simge çubuğu: **iletişim** (Ara ve WhatsApp proje ilgilisine, Yol tarifi şantiyeye) · **ekle** (Ziyaret, Görev, Teklif, Numune; proje, firma ve ilgili kişi seçili gelir) · **⋯** (Google'dan konum al, Google Haritalar, Projeyi kopyala, Projeyi sil).
- **Aşama şeridi:** Proje → İhale → Teklif Verildi → Sıcak → Sipariş; yanında Beklemede, Kayıp, İptal. Dokununca aşama değişir ve geçmişe yazılır. Sipariş ve Kayıp ek bilgi istediği için pencere açılır (tutar/tarih ya da neden, işi alan marka, rakip fiyat).
- **Sekmeler:** Özet · Firmalar ve kişiler · Ziyaret ve görevler · Teklif ve sipariş · Ürün ve şartname (EAE kataloğunda) · Belgeler ve şantiye · Yorumlar · Geçmiş.
- **Özet:** projedeki firmalar (Yatırımcı, Projeci, Danışman, Gemüt, Emüt, Malzeme alıcısı, Bayi, ilgili kişi; dokununca sayfasına gider), konum, sıradaki iş (açık görev, planlı ve son ziyaret, son teklif), kayıp/sipariş bilgisi, proje bilgileri ve notlar.
- **Firmalar ve kişiler:** her firmanın rolü, son ziyaret tarihi ve o firmadaki kişiler (ilgili kişi ★).
- Düzenleme ve yeni proje pencerede. Projeler listesinden eklenen yeni proje kaydedilince kendi sayfasına geçer.

## Güncelleme notu (sürüm 62): Kişi kartı kendi sayfasında

- Kişiye dokununca firma gibi **kendi sayfası** açılır. "←" geri düğmesi gelinen yeri yazar: firmadan geldiysen firma adı, listeden geldiysen "Kişiler". Firma → kişi → geri → geri sırasıyla adım adım dönülür.
- Başlıkta kartvizit fotoğrafı (yoksa baş harf), firma (dokununca firmaya gider), unvan, pozisyon, karar rolü ve son görüşme.
- Simge çubuğu: **iletişim** (Ara, WhatsApp, E-posta) · **ekle** (Ziyaret, Görev, Teklif; firma ve kişi seçili gelir) · **⋯** (Rehbere kaydet, İnternet sitesi, Adresi haritada aç, Numune ver, Servis kaydı, Kişiyi sil).
- Sekmeler: Özet · Projeler · Ziyaret ve görevler · Teklif ve numune · Notlar.
- Özet: iletişim, firmadaki yeri (bağlı olduğu kişi, ona bağlı olanlar, şemaya git), kartvizit ön/arka yüz, eski firmaları, son görüşmeler ve açık görevler.
- Düzenle pencerede açılır (kartvizit okuma, "Yeni firmaya geçti" dahil). Yeni kişi yine pencerede eklenir; Kişiler listesinden eklenince kaydettikten sonra kişinin sayfasına geçilir.

## Güncelleme notu (sürüm 61): Firma başlığında simge çubuğu

- "Ekle" menüsü kaldırıldı. Firma adının sağında üç kutu: **iletişim** (Ara, WhatsApp, Yol tarifi) · **ekle** (Ziyaret, Kişi, Görev, Teklif) · **⋯** (Numune ver, Servis kaydı, Google'dan bilgi al, Google Haritalar'da aç, Firmayı sil).
- Simgenin üstüne gelince adı yazar. Telefonda çubuk adın altına iner, "⋯" alttan açılan panel olur.
- Düzenle düğmesi başlığın altında tek başına.

## Güncelleme notu (sürüm 60): Firma başlığında gruplu düğmeler, projelerde ilişki ağı üstte

- **İletişim:** Ara, WhatsApp ve Yol tarifi firma adının yanında yuvarlak simgeler (telefonda adın altında).
- **Ekle ▾:** Ziyaret, Kişi, Görev · Teklif, Numune, Servis kaydı tek menüde, simgeli. Telefonda alttan açılan büyük düğmeli panel.
- **⋯:** Yalnızca Google'dan bilgi al, Google Haritalar'da aç ve Firmayı sil.
- **Projeler sekmesi:** İlişki ağı en üstte, projeler altında. İlk 10 proje görünür, kalanı "Devamını göster" ile açılır.

## Güncelleme notu (sürüm 59): Firma kartı kendi sayfasında, sekmeli

- Firmaya dokununca yan pencere yerine **firmanın kendi sayfası** açılır. Üstte "← Firmalar" (ya da gelinen ekranın adı) ile geri dönülür; menüde Firmalar seçili kalır.
- Başlıkta firma adı, tipi, ili, açık proje / sipariş / son ziyaret özeti ve işlemler: **Düzenle**, Ziyaret ekle, Kişi ekle; diğerleri (Ara, WhatsApp, Yol tarifi, Görev, Teklif, Numune, Servis, Google, Sil) "Diğer" menüsünde.
- **Sekmeler:** Özet · Kişiler ve şema · Projeler · Ziyaret ve görevler · Teklif ve sipariş · Belgeler · Notlar. Seçili sekme adres çubuğuna yazılır (ör. `#/firma/…/kisiler`), sayfa yenilenince ya da bağlantı paylaşılınca aynı sekmede açılır. Yetkin olmayan sekmeler görünmez.
- **Özet:** iletişim ve konum, önemli kişiler (karar vericiler önce), açık projeler, planlı ve son ziyaretler, açık görevler, not.
- **Düzenleme** pencerede açılır; kaydedince sayfa aynı sekmede yenilenir. Kişi, ziyaret, teklif, görev kartları da sayfanın üstünde pencere olarak açılır, kapatınca firmaya dönülür.
- Yeni firma Firmalar listesinden eklenince kaydettikten sonra doğrudan firmanın sayfasına geçilir.
- Veritabanı değişikliği yok.

## Güncelleme notu (sürüm 58): Firma şemasında bölümler, hızlı görev değişikliği, yakınlaştırma

- **Bölümler:** Bir müdürün altında birden fazla kişi varsa, pozisyonlarına göre bölüm başlıklarıyla (Satınalma, Proje / Tasarım…) ayrılır. Yönetim pozisyonundakiler doğrudan müdürün altına bağlanır. Bir kişiyi bir bölüm başlığının üstüne sürükleyince hem pozisyonu hem bağlı olduğu müdür ayarlanır.
- **Kişiye tıklayınca:** Küçük bir pencere açılır; unvan, pozisyon, bağlı olduğu kişi ve karar rolü buradan değiştirilir. "Kişi kartını aç" ile tam karta geçilir.
- **Yakınlaştırma:** Şemanın üstündeki −/+ ve "Sığdır" düğmeleri, fare tekerleği (imlecin olduğu yere göre) ve telefonda iki parmakla yakınlaştırma. Boş alanı fareyle tutup sürükleyerek şema kaydırılır. Seçilen yakınlık o firma için oturum boyunca hatırlanır.
- Veritabanı değişikliği yok.

## Güncelleme notu (sürüm 57): Ekipler ve kayıt kapsamı (K3)

- **Ekipler:** Ayarlar → Ekip ve yetkiler'de ekip/departman ağacı (ör. Satış → Satış Adana), her ekibe yönetici. Kullanıcı kartından ekibe konur.
- **Kayıt kapsamı** (rolde ya da kişiye özel ayarda): *Tüm şirketin*, *Ekibinin* (kendi ekibi ve alt ekipleri), *Sadece kendinin* (sorumlusu olduğu kayıtlar). Ekip yöneticisi, rolü ne olursa olsun yönettiği ekiplerin kayıtlarını görür. Şirket yöneticileri her şeyi görür. Kural sunucuda (RLS) uygulanır: kapsam dışındaki kayıt telefona hiç gelmez.
- **Sorumlu:** firma, kişi, proje, ziyaret, görev, teklif, sipariş, numune, servis ve tahsilat kayıtlarında. Yeni kayıtta ekleyen kişi ve ekibi kendiliğinden yazılır; firma ve proje formunda şirket yöneticisi değiştirebilir. Firmanın sorumlusu değişince aynı sorumludaki kişileri de geçer.
- **Başka satışçıda:** kapsamı dar kullanıcı Firmalar'da arama yapınca, kendi görmediği eşleşen firmalar yalnızca adı ve sorumlusuyla “Başka satışçıda” olarak gösterilir.
- **Kayıt devri:** kullanıcı kartında “Kayıtlarını devret”; hedef seçilmezse kişinin ekibinden yukarı doğru ilk ekip yöneticisine, o da yoksa kurucuya. Kullanıcı pasife alınınca devretmek isteyip istemediği sorulur.
- **Taşıma:** mevcut kayıtların sorumlusu, değişiklik geçmişinden kaydı ilk ekleyen kişi olur; bulunamazsa kurucu. Bütün roller başta “Tüm şirketin” kapsamındadır; kimse bugün gördüğünden azını görmez.
- Organizasyon şemasında **firmadan ayrılanlar artık ağacın altında** ayrı bir bölümde; geniş şema ortadan başlar ve iki yana kaydırılır (kutular kesilmez).
- Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 28).

## Güncelleme notu (sürüm 56): şemada sürükle-bırak, ayrılanlar

- **Organizasyon şemasında sürükle-bırak:** bir kişiyi başka bir kişinin kutusuna bırakınca “bağlı olduğu kişi” olur. Telefonda kutuya basılı tut (yaklaşık 0,3 sn, kısa titreşim), sonra sürükle. Pozisyon grubu etiketine bırakınca bağlantı kalkar ve kişinin pozisyonu o grup olur; firma adına bırakınca yalnızca bağlantı kalkar. Kendi altındaki birine bağlanamaz (döngü olmaz). Kısa dokunuş eskisi gibi kişi kartını açar. Yalnızca kişileri düzenleme yetkisi olanlarda açık.
- **Ayrılanlar:** firmadan ayrılmış kişiler şemanın yanında soluk kutularla, ne zaman ayrıldıkları ve şimdi hangi firmada oldukları yazılı (telefonda şemanın altında). Firmada hiç güncel kişi olmasa da ayrılanlar varsa şema bölümü görünür.

## Güncelleme notu (sürüm 55): Roller (K2)

- Ayarlar → Ekip ve yetkiler'de **Roller** bölümü: şirket kendi rollerini tanımlar. “Hazır rolleri ekle” ile Muhasebe, Satış, Satış destek, Proje ve Bayi rolleri tek dokunuşla gelir; her rol açılıp ekran ağacıyla (Kapalı / Görür / Düzenler), gizlenen alanlarla ve Excel izniyle düzenlenir. “Yeni rol” ile istenen ad verilir (ör. “Satış Adana”).
- **Rol değişince o roldeki herkes birlikte güncellenir** (sunucuda tetikleyiciyle; uygulama da ayrıca yazar). Rol kartında kaç kişinin etkileneceği sorulur.
- **Kullanıcı kartı:** “Rol” seçilir; rol seçiliyse ekran ağacı gizlenir ve rolün yetkileri özetlenir. “Bu kişiye özel ayar yap” işaretlenirse ağaç açılır ve o kişi rol değişikliklerinden etkilenmez. Rol yoksa eskisi gibi kişiye özel ayar.
- **Bu rol gibi gör:** rolün gördüğü uygulamayı kendi telefonunda önizler.
- Rol silinirse o roldeki kişiler şimdiki yetkilerini korur, kişiye özel olarak kalır.
- **Taşıma:** şema çalıştırılınca rolü olmayan mevcut kullanıcıların yetkileri role çevrilir; aynı yetkilere sahip olanlar aynı rolü paylaşır (rol adı eski rol etiketinden gelir).
- Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 27).

## Güncelleme notu (sürüm 54): şirket profili kendi sayfasında

- Firma profili ayarlardan çıktı; **Şirket profili** artık geniş, ayrı bir sayfa (`#/sirket`). Menüde logonun altındaki firma kartına dokununca açılır; Ayarlar'daki “Firma profili” de buraya götürür.
- Sayfada: firma bilgileri ve ürün kataloğu seçimi, **kayıt özeti** (firma, kişi, açık proje, bu ay ziyaret, teklif, sipariş), **Ekibim** (kişi sayısı, rollere göre dağılım, ağaç ve kişi/e-posta/rol tablosu; pasif kullanıcılar ayrı).
- Ağacın sayfayı yana taşırması düzeltildi; şema kendi içinde kayar.

## Güncelleme notu (sürüm 53): menüde firma ve sürüm, organizasyon şemaları

- Menüde logonun yanında **sürüm numarası**, altında **firma kartı** (firma adı, sektör, iller); dokununca Ayarlar → Firma profili açılır.
- **Firma profili → Ekibim:** şirkette kaç kişi çalıştığı, rollere göre sayılar ve ağaç (kurucu ve yöneticiler üstte, kullanıcılar rollerine göre).
- **Firma kartında organizasyon şeması** (2+ kişi varsa): firmanın kişileri ağaç olarak; kişi kartındaki yeni **“Bağlı olduğu kişi (yöneticisi)”** alanıyla kurulur, seçilmeyenler pozisyonlarına göre gruplanır, sahip/genel müdür en üstte. Her kutuda karar rolü (★ karar verici) ve son ziyaretten bu yana geçen süre (yeşil ≤30 gün, sarı ≤90, kırmızı daha eski); firmada Satınalma, Proje veya Mühendis kişisi yoksa uyarı.
- Kişi başka firmaya geçince “bağlı olduğu kişi” bağlantısı kalkar.
- Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 26).

## Güncelleme notu (sürüm 52): Şirket (K1) — şirket kişiden bağımsız, birden fazla yönetici

- Kayıtlar artık bir **şirkete** aittir (değeri kurucunun kimliğiyle aynı kalır; mevcut veriye dokunulmaz, taşıma gerekmez). Kurucunun kullanıcı hesabı silinse de şirketin kayıtları silinmez.
- **Şirket yöneticisi:** Ayarlar → Ekip ve yetkiler'de bir kullanıcının kartında “Şirket yöneticisi” işaretlenince o kişi kurucu gibi her şeyi görür ve düzenler, kullanıcıları ekler/çıkarır, yetki verir ve şirket ayarlarını yönetir. Birden fazla yönetici olabilir.
- **Şirket kartı** (Ekip ve yetkiler'in üstünde): şirket adı, kurucu, yöneticiler, aktif kullanıcı sayısı.
- **Kurucu ayrılırsa:** başka bir şirket yöneticisi “Kurucu şirketten ayrıldı” der; kurucu artık şirkete giremez, kayıtlar şirkette kalır. Geri alınabilir. Kurucu kendini ayrıldı yapamaz (şirket yöneticisiz kalmasın diye).
- Sunucu kuralları (RLS): yetki, dosyalar, ayarlar, değişiklik geçmişi, hata günlüğü ve kullanıcı adları şirket yöneticilerine de açıldı. Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 25).

## Güncelleme notu (sürüm 51): kartvizit okuma ve pozisyonlar

- **Kartvizit okuma:** e-posta adresinin başı kişinin adıyla, alan adı firmayla karşılaştırılıyor; logodaki büyük firma adı (ör. MERKON) artık ad soyad sanılmıyor, firma olarak alınıyor. Logo/simgeden kalan baştaki kısa harfler atılıyor, “I$” gibi okuma hataları “İş” olarak düzeltiliyor. Kayıtlı firma, web ya da e-posta alan adından da eşleştiriliyor.
- **Pozisyon:** kişiye görev alanı seçilir (Firma sahibi / Ortak, Genel müdür / Yönetim, Satınalma, Proje / Tasarım, Mühendis / Teknik, Saha / Şantiye, Satış / Pazarlama, Muhasebe / Finans, İdari / Asistan, Diğer). Boş bırakılırsa unvandan tahmin edilir; kartvizitten de tahmin edilir. Liste Ayarlar → Listeler'den değiştirilebilir.
- Eski firmalara pozisyon da yazılır (firma değişince kendiliğinden, elle eklerken seçilerek).
- **Kişiler listesinde pozisyon süzgeci**; “Eski firmalarındaki pozisyonlar dahil” işaretlenirse, örneğin daha önce satınalmada çalışmış kişiler de listelenir (“eskiden: …” yazar). Excel'e Pozisyon sütunu eklendi.
- Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 24); mevcut kişilerin pozisyonu unvanlarından doldurulur.

## Güncelleme notu (sürüm 50): kişinin eski firmaları

- Kişi kartında **“Eski firmaları”** bölümü: kişinin firması değiştirilince (ya da firmadan ayrılınca) önceki firma, oradaki unvanı ve ayrılış tarihiyle kendiliğinden eklenir.
- **“Yeni firmaya geçti”** düğmesi formdaki firma ve unvanı boşaltır; yeni firmayı yazıp kaydedince eskisi geçmişe geçer.
- **“Eski firma ekle”** ile uygulamadan önceki firmalar elle eklenir; her satır “Kaldır” ile silinir.
- Firma kartında **“Eski çalışanlar”**: o firmadan ayrılmış kişiler, şimdi hangi firmada oldukları ile.
- Benzer kayıtları birleştirirken iki kişinin eski firmaları birleşir; firmalar birleşince eski firma kayıtları kalan firmaya çevrilir. Birleştirme eski firma eklemez.
- Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 23).

## Güncelleme notu (sürüm 49): benzer kayıtlar (karşılaştır, birleştir, düzelt)

- **Benzer kişiler:** aynı telefon, aynı e-posta ya da aynı ad soyad. **Benzer firmalar:** benzer ad (Ltd., Şti., Elektrik, Aydınlatma gibi ekler yok sayılır), aynı telefon, aynı vergi no, aynı web/e-posta alan adı, aynı Google kaydı.
- Nerede görünür: Kişiler ve Firmalar listesinde **“Benzer kayıtlar (n)”** düğmesi; kişi ya da firma kartının üstünde sarı **“Benzer kayıt: … Karşılaştır”** uyarısı; Veri kontrolü ekranında.
- **Karşılaştır** ekranı iki kaydı alan alan gösterir: farklı alanlarda kalacak değere dokunulur ya da kutudaki değer elle düzeltilir. Sonra:
  - **Birleştir:** seçilen değerler kalır, 2 numaralı kaydın bağlı kayıtları (ziyaret, görev, teklif, proje, kişi, sipariş, belge…) 1 numaraya taşınır, notlar, kartvizitler/fotoğraflar birleşir, seçilmeyen farklı telefon notlara eklenir, 2 numara silinir.
  - **Yalnız 1'i güncelle:** seçilen değerleri 1 numaraya yazar, iki kayıt da kalır.
  - **Farklı kayıtlar:** bu ikili bir daha benzer olarak gösterilmez (ekiple paylaşılır).
  - **Kartı aç:** kaydı açıp normal şekilde düzenlemek için.
- Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 22; “Farklı kayıtlar” listesinin ekiple paylaşılması için).

## Güncelleme notu (sürüm 48): kişide adres ve internet sitesi, firmaya kişi atama

- Kişi kartında **İnternet sitesi** ve **Adres** alanları var; kartvizitten okunan web ve adres artık notlara değil bu alanlara yazılır. Kişi ekranında “İnternet sitesi” ve “Adresi haritada aç” düğmeleri çıkar; rehbere kaydederken de eklenir, Excel'e çıkar. Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 21).
- **Firmaya kişi atama:** firma ekranındaki Kişiler bölümünde “Kayıtlı kişiyi bu firmaya ata” ile mevcut bir kişi aranıp atanır (başka firmadaysa taşınması sorulur); her kişinin yanındaki “Ayır” ile firmadan ayrılır (kişi silinmez). “Yeni kişi” bu firmaya bağlı yeni kişi açar.

## Güncelleme notu (sürüm 47): kartvizit okuma iyileştirmesi

- Kart **dağınık yazı düzeninde** okunuyor: kartın bir köşesindeki büyük isim, logo ve iletişim blokları artık atlanmıyor.
- QR kod, logo ve desenden çıkan anlamsız harfler (düşük güvenli kelimeler) ayıklanıyor.
- **Ad soyad, kartta en büyük yazılan uygun satırdan** alınıyor.
- Logonun alt yazısı (“Elektrik | Mühendislik” gibi) artık unvan sanılmıyor; unvan yalnızca Müdür, Mühendis, Sorumlu, Uzman, Tekniker… gibi görev sözcüklerinden çıkıyor.
- Soyaddaki “TAŞ” gibi harfler şirket eki (A.Ş.) sanılmıyor; firma adında yasal ekler düzgün yazılıyor (San. ve Tic. Ltd. Şti.).

## Güncelleme notu (sürüm 46): doğru lens seçimi

- Çok kameralı telefonlarda (Samsung vb.) tarayıcı “arka kamera” isteyince çoğu zaman **geniş açı lensini** açıyordu; bu lensin odağı sabit olduğu için kartvizit yakından hep bulanık çıkıyordu. Artık **ana arka kamera** (otomatik odaklı olan) seçiliyor.
- Kamerada **“Lens 1/3”** düğmesi arka lensler arasında geçer; seçilen lens hatırlanır.

## Güncelleme notu (sürüm 45): dokununca odak, yakınlaştırma, telefonun kamerası

- Kartvizit kamerasında **ekrana dokunulan noktaya odaklanılır** (sarı halka görünür). Tarayıcısı buna izin vermeyen telefonlarda uyarı çıkar.
- Destekleyen telefonlarda **2×** düğmesi: telefonu uzak tutup yakınlaştırarak çekmek, yakına odaklanamayan kameralarda netliği artırır.
- **“Telefonun kamerası”** düğmesi telefonun kendi kamera uygulamasını açar (en iyi odak); çekilen fotoğraf yine kırpma ekranına gelir.

## Güncelleme notu (sürüm 44): net kartvizit fotoğrafı

- Fotoğraf artık video görüntüsünden değil, **kameranın asıl fotoğraf modundan** alınıyor (tam çözünürlük, odaklanarak çekim). Bunu desteklemeyen telefonlarda art arda birkaç kare alınıp **en keskini** seçiliyor.
- Kamera netleşirken kendiliğinden çekim yapılmıyor (“Netleşiyor…”); görüntü net olunca çekiyor. Destekleyen telefonlarda sürekli otomatik odak açılıyor.
- Ekrandaki çerçeve küçültüldü: telefon karta çok yaklaştırılınca kamera odaklayamıyordu; artık ~20 cm uzaktan çekiliyor, yüksek çözünürlük sayesinde kart yine büyük çıkıyor.

## Güncelleme notu (sürüm 43): kartvizitte iptal ve yeniden çek

- Kartvizit çekildikten sonra açılan ekranın üstünde **“✕ İptal”** (hiçbir şey kaydetmeden kapatır) ve **“↺ Yeniden çek”** (kamerayı tekrar açar) düğmeleri var. Galeriden seçince ikincisi **“Başka fotoğraf”** olur.

## Güncelleme notu (sürüm 42): uygulama içi kartvizit kamerası

- **“Çek” artık uygulamanın kendi kamerasını açar ve yalnızca arka kamerayı kullanır** (telefonun kamera uygulaması ve ön kamera açılmaz). Ekranda kartvizit biçiminde bir çerçeve görünür.
- **Kart canlı aranır:** bulununca yeşil çerçeveyle gösterilir, kart bir saniye kıpırdamazsa kendiliğinden çekilir (beklemeden çekmek için deklanşöre dokunulabilir). Karanlıkta “Işık” düğmesi flaşı yakar (destekleyen telefonlarda).
- Çekimden sonra doğrudan **kesilmiş kart** gösterilir; köşeler gerekirse “Köşeleri düzelt” ile düzeltilir. Kartın kenarları bulunamazsa ekrandaki çerçevenin içi kesilir, yani kart çerçeveye yerleştirildiyse yine düzgün çıkar.
- Kamera izni verilmezse ya da açılamazsa telefonun kendi kamerasına dönülür. “Galeri” eskisi gibi çalışır.
- Köşe bulmaya ikinci, daha hassas bir çizgi araması eklendi (soluk kenarlı, bulanık, yuvarlak köşeli kartlar ve desenli zemin için).

## Güncelleme notu (sürüm 41): ad ve soyad ayrı, kartvizit köşeleri daha iyi bulunuyor

- **Kişilerde ad ve soyad ayrı alan.** Eski kayıtlarda son kelime soyad, öncesi ad sayılır (“Mehmet Ali Yılmaz” → Ad: Mehmet Ali, Soyad: Yılmaz). Listeler, arama ve Excel tam adı kullanmaya devam eder; Excel'e Ad ve Soyad ayrı sütun olarak çıkar, rehbere kaydetmede soyad doğru alana yazılır, mesaj şablonlarına {soyad} eklendi. Supabase'de güncel **schema.sql** çalıştırılmalı (sürüm 20); çalıştırılana kadar uygulama yalnızca tam adı kaydeder.
- **Kartvizit köşeleri çok daha güvenilir bulunuyor.** Kartın düz kenarları çizgi olarak aranıyor (Hough), adaylar dört kenarın gerçekten kenar olup olmadığına, kartvizit oranına ve ortaya yakınlığa göre puanlanıyor, sonra kenarlar hassas olarak oturtuluyor. Dağınık masada, perspektifli çekimde, koyu renk kartta, beyaz masada beyaz kartta, parmak bir köşeyi kapatınca ve kart fotoğrafın kenarından taştığında da buluyor.
- **Köşe düzeltmek kolaylaştı:** sürüklerken parmağın altını gösteren büyüteç çıkar; köşe parmağa zıplamaz, olduğu yerden kayar; kenar ortasındaki noktalarla bütün kenar kaydırılır; “Otomatik çerçeveye dön” ile bulunan çerçeveye geri dönülür.

## Güncelleme notu (sürüm 40): kartvizit kırpma ve daha iyi okuma

- **Kartvizit fotoğrafı artık yalnızca kartı kaydeder.** Fotoğraf çekilince ya da galeriden seçilince kartın köşeleri kendiliğinden bulunur; gerekirse köşeler parmakla sürüklenir. Kart düzleştirilir (eğik çekimde perspektif düzeltilir), zemin kesilip atılır ve yatay olarak kaydedilir.
- **Yön sorunu çözüldü.** Kart yan ya da ters çekildiyse okuma sırasında kart döndürülerek denenir; en iyi okunan yön seçilir ve kayıtlı fotoğraf da o yöne çevrilir. Kayıtlı eski kartvizitler kişi ekranındaki **↻** düğmesiyle döndürülebilir.
- **Okuma iyileşti:** telefonun yön bilgisi uygulanıyor, küçük fotoğraflar büyütülüyor, kontrast otomatik ayarlanıyor; logonun yanlış okunan harfleri firma adından ayıklanıyor.

## Güncelleme notu (sürüm 39): günlük yedek

- **Uygulama içi otomatik yedek artık her gün** alınabiliyor (Ayarlar → Veri ve yedek → Otomatik yedek → “Her gün” / “Haftada bir”). Günlükte son 30 gün tutulur. Yedek, gün içinde uygulama ilk açıldığında alınır.
- **Sunucudan günlük yedek (Supabase'den bağımsız kopya):** `araclar/yedek-deposu/` klasöründeki iş akışı gizli bir GitHub deposunda her gece 04:17'de veritabanının tamamını şifreli olarak saklar; uygulamayı kimse açmasa da çalışır. Kurulum ve geri yükleme: `araclar/yedek-deposu/KURULUM.md`. Bu dosya bu (herkese açık) depoda çalışmaz; veritabanı adresi asla bu depoya yazılmaz.

## Güncelleme notu (sürüm 38): hesap türleri ve yönetim paneli
**Bir kez:** Supabase SQL Editor'de güncel `supabase/schema.sql` dosyasını çalıştır (şema sürüm 19). Yönetici olacağın her Supabase projesinde kendini ekle: `insert into public.uygulama_yoneticileri (eposta) values ('senin@epostan.com');`

Hesap türleri:
- **Uygulama yöneticisi:** sen. Bütün hesapları görür; kayıtları okur ama değiştiremez.
- **Hesap (veri sahibi / firma):** kendi kaydını açan her kullanıcı. Türü Kendi kullanımım, Test ya da Müşteri olabilir; durumu Aktif ya da Askıda. Askıdaki hesapta sahibi ve ekibi kayıtlarını görür ama hiçbir şey ekleyemez, değiştiremez (sunucuda zorunlu). Paket ve deneme bitiş tarihi şimdilik bilgi amaçlı; abonelik eklendiğinde kullanılacak.
- **Ekip üyesi:** bir hesabın içinde, sahibinin verdiği yetkilerle çalışır; ayrı hesap sayılmaz.

Yönetim paneli (menüde "Yönetim", yalnızca yöneticide görünür):
- **Hesaplar:** her hesabın firması, türü, kayıt tarihi, son girişi, son işlemi, kurulumu yapıp yapmadığı, ekip sayısı ve kayıt sayıları (proje, firma, kişi, ziyaret, teklif…). Hesaba dokununca tür, durum, paket, bitiş tarihi ve özel not düzenlenir; ekip üyeleri ve son işlemler görünür.
- **Hesaba bak:** uygulama o hesabın kayıtlarıyla salt okunur açılır; üstteki çubuktan "Çık" ile kendi hesabına dönülür.
- **Kim ne ekledi:** bütün hesaplarda kimin hangi kaydı eklediği, değiştirdiği, sildiği; hesap, kayıt türü, işlem ve döneme göre süzülür; kişi bazında özet tablosu.
- **Geri bildirim, Hatalar, Test daveti** de bu panelde.
- Kendi ekranında yalnızca kendi hesabının kayıtları görünür; yönetici olman başka hesapların verisini kendi listelerine karıştırmaz.
- Not: yöneticinin bütün hesapların kayıtlarını görebildiği, kullanıcı sözleşmesinde ve KVKK aydınlatma metninde açıkça yazılmalıdır.

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
