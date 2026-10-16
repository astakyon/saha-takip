# Android uygulaması

Saha Takip bir **PWA** (telefona yüklenebilen web uygulaması): `manifest.json` ve `sw.js` hazır. Ay Yıldız: Hedef Kızıl Elma ile aynı yapı.

## 1. Telefona yükle (hemen, ücretsiz)

- Android'de Chrome ile https://astakyon.github.io/saha-takip/ adresini aç. Alttaki **“Saha Takip'i telefona yükle”** şeridinde ya da **Diğer → Telefona yükle** menüsünde **Yükle**'ye bas. Şerit çıkmazsa Chrome menüsünden (⋮) **Uygulamayı yükle** seçeneğini kullan.
- Chrome uygulamayı gerçek bir Android uygulaması gibi kurar (WebAPK): uygulama listesinde görünür, tam ekran açılır, internet yokken de çalışır.
- Ana ekran simgesine uzun basınca **Ziyaret kaydet**, **Harita**, **Takvim** ve **Projeler** kısayolları çıkar.
- Uygulama, GitHub'a yeni sürüm gönderildikçe kendiliğinden güncellenir.
- iPhone'da Safari → Paylaş → **Ana Ekrana Ekle**.

## 2. APK dosyası (TWA): Play Store'a koymak ya da dosyayla paylaşmak için

Uygulama, Pages'teki siteyi Chrome motoruyla tam ekran açan küçük bir Android kabuğudur. Site güncellenince APK'yı yeniden yüklemek gerekmez.

### Bilgisayardan (Bubblewrap)

1. Node.js 18+ ve JDK 17 kur.
2. `npm i -g @bubblewrap/cli`
3. Boş bir klasöre depodaki `twa-manifest.json` dosyasını kopyala, orada `bubblewrap update` çalıştır.
   - Paket adı `tr.ayyildiz.sahatakip`; simgeler, renkler, kısayollar ve konum izni (location delegation) dosyada hazır.
   - İlk derlemede sorulan imza anahtarını (`android.keystore`) oluştur ve **yedekle**. Kaybolursa Play'de güncelleme yapılamaz. Bu dosyayı depoya koyma.
4. `bubblewrap build` → `app-release-signed.apk` (telefona kurulur) ve `app-release-bundle.aab` (Play Store için).

### Bilgisayarsız (PWABuilder)

1. pwabuilder.com adresine site adresini yaz: `https://astakyon.github.io/saha-takip/`
2. **Package for stores → Android → Generate**. İndirilen zip'te imzalı APK, AAB ve imza anahtarı bulunur. Anahtarı yedekle.

### Adres çubuğunun gizlenmesi (Digital Asset Links)

TWA'nın üstte adres çubuğu göstermemesi için alan adının kökünde `/.well-known/assetlinks.json` gerekir. Proje sayfası (`astakyon.github.io/saha-takip`) kök değildir; dosya `astakyon.github.io` adlı **kullanıcı sitesi deposunun** köküne konur. Ay Yıldız için de aynı dosya gerektiğinden iki uygulama tek dosyada birlikte tanımlanabilir:

```json
[
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "tr.ayyildiz.sahatakip", "sha256_cert_fingerprints": ["<bubblewrap fingerprint çıktısı>"] } },
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "tr.ayyildiz.hedefkizilelma", "sha256_cert_fingerprints": ["<Ay Yıldız anahtarının parmak izi>"] } }
]
```

Parmak izini `bubblewrap fingerprint` (ya da PWABuilder'ın verdiği `assetlinks.json`) üretir. Bu dosya yokken de APK çalışır; yalnızca üstte ince bir adres çubuğu görünür.

### Play Store

Play Console'da yeni uygulama → `.aab` dosyasını yükle → içerik derecelendirmesi, ekran görüntüleri ve gizlilik politikası. Müşteri verisi Supabase'de, yalnızca giriş yapan kullanıcıya açık; gizlilik metninde bu belirtilmeli.
