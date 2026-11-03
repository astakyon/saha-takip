# Sunucudan günlük yedek — kurulum

Uygulamanın kendi otomatik yedeği (Ayarlar → Veri ve yedek → Otomatik yedek) kayıtları yine Supabase'e yazar ve
yalnızca sen uygulamayı açtığında çalışır. Bu kurulum ise **her gece, kimse uygulamayı açmasa da** veritabanının
tamamını Supabase'in **dışına**, senin gizli GitHub deponda şifreli olarak saklar. Supabase projesi silinse ya da
bozulsa bile veriler kurtarılır.

Ücretsiz: gizli depolarda ayda 2.000 dakika GitHub Actions hakkı var; bir yedek 1–2 dakika sürer.

## Bir kerelik kurulum (10 dakika)

1. **Gizli depo aç.** GitHub → New repository → ad: `saha-takip-yedek` → **Private** seç → Create.
2. **Dosyayı koy.** Yeni depoda *Add file → Create new file*, ad olarak
   `.github/workflows/gunluk-yedek.yml` yaz, bu klasördeki `gunluk-yedek.yml` dosyasının içeriğini yapıştır, *Commit*.
3. **Veritabanı adresini al.** Supabase → projen → üstteki **Connect** → **Session pooler** satırındaki adresi kopyala
   (`postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`).
   `[YOUR-PASSWORD]` yerine veritabanı şifreni yaz. Şifreyi bilmiyorsan Project Settings → Database → *Reset database password*
   (uygulama bu şifreyi kullanmaz, sıfırlamak uygulamayı bozmaz).
   *Direct connection* adresini kullanma: GitHub sunucularından ulaşılamaz.
4. **İki gizli değer ekle.** Yedek deposu → Settings → Secrets and variables → Actions → *New repository secret*:
   - `SUPABASE_DB_URL` → 3. adımdaki adres
   - `YEDEK_SIFRE` → en az 16 karakterlik, uzun bir parola. **Bunu bir kağıda ya da parola yöneticine yaz:**
     kaybedersen yedekler açılamaz.
5. **Dene.** Actions → *Günlük yedek* → *Run workflow*. 1–2 dakika sonra yeşil tik ve altta
   `saha-yedek-YYYY-AA-GG` dosyası görünmeli.

Bundan sonra her gece 04:17'de kendiliğinden çalışır. Bir gece hata verirse GitHub e-posta atar.

Bu adres veritabanına tam erişim verir. Yalnızca bu gizli deponun *Secrets* kısmına yaz; uygulama koduna,
herkese açık depoya ya da mesajlara asla yazma.

## Geri yükleme

1. Actions → istediğin günün çalışması → *Artifacts* → dosyayı indir, zip'ten çıkar.
2. Şifreyi çöz ve aç (bilgisayarda gpg kurulu olmalı; Windows'ta Gpg4win):
   ```
   gpg -d saha-yedek-2026-11-03.tar.gz.gpg > yedek.tar.gz
   tar -xzf yedek.tar.gz
   ```
3. Boş bir Supabase projesine yükle (Session pooler adresiyle):
   ```
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql --dbname "YENI_PROJENIN_ADRESI"
   ```
4. Uygulamada Ayarlar → Bağlantı'dan yeni projenin adresini ve anon anahtarını gir.

**Not:** Bu yedek veritabanını (bütün kayıtlar, kullanıcı hesapları, ayarlar) kapsar. Fotoğraf ve belgeler
Supabase depolamasındadır; onlar için ayda bir Ayarlar → Veri ve yedek → **Tam yedek indir (ZIP)** al.

Ayda bir, rastgele bir günün yedeğini indirip 2. adıma kadar açmayı dene: açılmayan yedek, yedek sayılmaz.
