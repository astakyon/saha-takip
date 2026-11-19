-- =====================================================================
--  Saha Satış Takip — Supabase şeması (sürüm 19)
--  Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını
--  yapıştır → Run. Tekrar çalıştırmak güvenlidir.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Ortak: owner (kaydı oluşturan kullanıcı), zaman damgaları
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- FİRMALAR ----------
create table if not exists public.firmalar (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ad text not null,
  tipler text[] not null default '{}',          -- Emüt, Gemüt, Proje Bürosu, Danışman, Bayi, Yatırımcı, Malzeme Alıcısı, Müşteri, Panocu
  il text, ilce text, adres text,
  lat double precision, lng double precision, konum_yaklasik boolean default true,
  telefon text, eposta text, web text, vergi_no text,
  segment text, sektor text, key_account boolean default false,
  notlar text, fotolar text[] not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- KİŞİLER ----------
create table if not exists public.kisiler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid references public.firmalar(id) on delete set null,
  ad_soyad text not null, unvan text, telefon text, eposta text,
  rol text,                                      -- Karar verici / Etkileyici / Teknik / Satınalma
  kartvizit_on text, kartvizit_arka text,        -- storage yolu
  dogum_gunu date, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- PROJELER ----------
create table if not exists public.projeler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ad text not null,
  durum text not null default 'Proje',           -- Proje, İhale, Teklif Verildi, Sıcak, Beklemede, Sipariş, Kayıp, İptal
  durum_alt text, kritik boolean default false,
  takip_yili int default 2026, hedef_listesi boolean default false, baska_bolge boolean default false,
  il text, ilce text, osb text, lokasyon text, adres text,
  lat double precision, lng double precision, konum_yaklasik boolean default true,
  icerik text, kanal text,                        -- Bayi / Direkt
  bayi_id uuid references public.firmalar(id) on delete set null,
  takipci text, takipci_tel text, calisildi text,
  tutar_usd numeric, olasilik int, beklenen_tarih date, teklif_no text, crm_kodu text,
  urun_gruplari text[] not null default '{}',
  sektor text, alt_sektor text, yeni_refit text,
  yatirimci_id uuid references public.firmalar(id) on delete set null,
  projeci_id   uuid references public.firmalar(id) on delete set null,
  danisman_id  uuid references public.firmalar(id) on delete set null,
  gemut_id     uuid references public.firmalar(id) on delete set null,
  emut_id      uuid references public.firmalar(id) on delete set null,
  alici_id     uuid references public.firmalar(id) on delete set null,
  ilgili_kisi_id uuid references public.kisiler(id) on delete set null,
  ziyaret_edilecek boolean default false, sorulacak text, notlar text,
  fotolar text[] not null default '{}',
  -- kazanılırsa
  siparis_tutari_usd numeric, siparis_tarihi date,
  -- kaybedilirse
  bizim_teklif_usd numeric, bizim_urun text,
  rakip_marka text, rakip_urun text, rakip_birim_fiyat numeric, rakip_miktar numeric, rakip_toplam_usd numeric,
  kayip_nedeni text, kayip_aciklama text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.proje_gecmis (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proje_id uuid references public.projeler(id) on delete cascade,
  tarih timestamptz default now(), eski_durum text, yeni_durum text, notlar text
);

-- ---------- ZİYARETLER ----------
create table if not exists public.ziyaretler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarih date not null default current_date,
  firma_id uuid references public.firmalar(id) on delete set null,
  kisi_id uuid references public.kisiler(id) on delete set null,
  proje_id uuid references public.projeler(id) on delete set null,
  amac text, notlar text, lat double precision, lng double precision,
  fotolar text[] not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- GÖREVLER ----------
create table if not exists public.gorevler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  baslik text not null, son_tarih date, oncelik text default 'Normal', durum text default 'Açık',
  firma_id uuid references public.firmalar(id) on delete set null,
  proje_id uuid references public.projeler(id) on delete set null,
  kisi_id uuid references public.kisiler(id) on delete set null,
  notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- ÜRÜNLER / STOK / FİYAT ----------
create table if not exists public.urunler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kod text not null, aciklama text, aciklama2 text, aile text, birim text,
  stok numeric default 0, birim_fiyat_usd numeric, stok_tarihi date, depo text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, kod)
);

create table if not exists public.stok_gecmis (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kod text not null, stok numeric, birim_fiyat_usd numeric, tarih date default current_date, depo text
);

create table if not exists public.rakip_fiyatlar (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aile text, lumen_aralik text, marka text not null, urun_adi text,
  fiyat_metin text, birim_fiyat numeric, para_birimi text default 'USD',
  tarih date default current_date, kaynak text,
  proje_id uuid references public.projeler(id) on delete set null, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- SİPARİŞLER / HEDEF ----------
create table if not exists public.siparisler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  siparis_no text, belge_no text, belge_turu text, musteri_no text, musteri_adi text,
  firma_id uuid references public.firmalar(id) on delete set null,
  tarih date, teslim_tarihi date, referans text,
  net_deger numeric default 0, para_birimi text default 'USD', proje_tanimi text,
  proje_id uuid references public.projeler(id) on delete set null, drv boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.hedefler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  yil int not null, ceyrek int not null, tutar_usd numeric not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, yil, ceyrek)
);

-- ---------- SANAYİ BÖLGELERİ (sürüm 2) ----------
create table if not exists public.bolgeler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ad text not null,
  tip text default 'OSB',                        -- OSB, Sanayi sitesi, Serbest bölge, Liman, Diğer
  grup text, il text, ilce text, renk text,
  geojson jsonb,                                 -- çizilen sınır (GeoJSON Polygon)
  notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- Sürüm 2 sütunları (eski kurulumlara eklenir) ----------
alter table public.projeler   add column if not exists belde text;
alter table public.projeler   add column if not exists bolge_id uuid references public.bolgeler(id) on delete set null;
alter table public.firmalar   add column if not exists belde text;
alter table public.firmalar   add column if not exists osb text;
alter table public.firmalar   add column if not exists bolge_id uuid references public.bolgeler(id) on delete set null;
alter table public.ziyaretler add column if not exists saat text;
alter table public.ziyaretler add column if not exists durum text default 'Yapıldı';
alter table public.ziyaretler add column if not exists sonuc_tipi text;
alter table public.ziyaretler add column if not exists sonuc text;

-- ---------- Sürüm 3 sütunları: Google Haritalar bağlantısı ----------
alter table public.firmalar add column if not exists google_place_id text;
alter table public.firmalar add column if not exists google_url text;
alter table public.projeler add column if not exists google_place_id text;
alter table public.projeler add column if not exists google_url text;

-- ---------- Sürüm 4: şantiye takibi, referans, teklif, numune, servis, masraf, katalog, ayarlar ----------
alter table public.projeler add column if not exists santiye_asamasi text;
alter table public.projeler add column if not exists alim_tarihi date;
alter table public.projeler add column if not exists referans boolean default false;

create table if not exists public.teklifler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proje_id uuid references public.projeler(id) on delete set null,
  firma_id uuid references public.firmalar(id) on delete set null,
  kisi_id uuid references public.kisiler(id) on delete set null,
  teklif_no text, tarih date default current_date, gecerlilik date,
  para_birimi text default 'USD', iskonto numeric default 0, kdv numeric default 20,
  kalemler jsonb not null default '[]',          -- [{kod, aciklama, adet, birim, birim_fiyat}]
  toplam numeric, durum text default 'Taslak', notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.numuneler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  urun_kod text, urun_ad text, adet numeric default 1,
  firma_id uuid references public.firmalar(id) on delete set null,
  kisi_id uuid references public.kisiler(id) on delete set null,
  proje_id uuid references public.projeler(id) on delete set null,
  verilis date default current_date, iade_tarihi date, durum text default 'Müşteride', notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.servis_kayitlari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarih date default current_date, tip text default 'Arıza',
  firma_id uuid references public.firmalar(id) on delete set null,
  kisi_id uuid references public.kisiler(id) on delete set null,
  proje_id uuid references public.projeler(id) on delete set null,
  urun text, adet numeric, aciklama text, durum text default 'Açık', cozum text, cozum_tarihi date,
  fotolar text[] not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.masraflar (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarih date not null default current_date, tip text default 'Yakıt', tutar numeric, km numeric, aciklama text, fis text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- Sürüm 6: sipariş notu, rapor dışı bırakma, çeyrek resmi rakamları
alter table public.siparisler add column if not exists siparis_notu text;
alter table public.siparisler add column if not exists rapor_disi boolean default false;
alter table public.hedefler add column if not exists resmi_usd numeric;
alter table public.hedefler add column if not exists resmi_tl numeric;
alter table public.hedefler add column if not exists kur numeric;
alter table public.hedefler add column if not exists notlar text;
alter table public.hedefler alter column tutar_usd drop not null;

-- Sürüm 5: tahsilat takibi ve belgeler
create table if not exists public.tahsilatlar (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid references public.firmalar(id) on delete set null, cari text, belge_no text,
  tarih date, vade date, tutar numeric, para_birimi text default 'USD', odenen numeric default 0,
  durum text default 'Açık', odeme_tarihi date, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.belgeler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proje_id uuid references public.projeler(id) on delete cascade, firma_id uuid references public.firmalar(id) on delete cascade,
  ad text not null, yol text not null, tur text, boyut bigint, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- Sürüm 7: belge türü (yüklenen Excel dosyaları vb.)
alter table public.belgeler add column if not exists kategori text;

create table if not exists public.urun_aileleri (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aile text not null, ad text, aciklama text, ozellikler text, datasheet_url text,
  fotolar text[] not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.ayarlar (               -- cihazlar arasında eşitlenen ayarlar (Google anahtarı, mesaj şablonları…)
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  anahtar text not null, deger jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- Sürüm 8: kullanıcılar ve yetkiler ----------
-- Veri sahibi (sen) ekip_uyeleri tablosuna bir e-posta ve yetkiler ekler. O e-postayla giriş yapan kişi
-- yalnızca yetki verilen bölümleri görür ("oku") ya da düzenler ("yaz"). Yetkiler tablo adlarıyla tutulur.
create table if not exists public.ekip_uyeleri (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eposta text not null, ad text, aktif boolean not null default true,
  yetkiler jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, eposta)
);
create or replace function public.benim_epostam() returns text language sql stable as $f$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$f$;
-- Giriş yapan kişinin çalıştığı verinin sahibi: ekip üyesiyse ekibin sahibi, değilse kendisi
create or replace function public.veri_sahibi() returns uuid language sql stable security definer set search_path = public as $f$
  select coalesce((select u.owner from public.ekip_uyeleri u where u.aktif and lower(u.eposta) = public.benim_epostam() and u.owner <> auth.uid() order by u.created_at limit 1), auth.uid())
$f$;
create or replace function public.yetki(sahip uuid, tablo text, islem text) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip = auth.uid() or exists (
    select 1 from public.ekip_uyeleri u
    where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam()
      and (u.yetkiler ->> tablo = 'yaz' or (islem = 'oku' and u.yetkiler ->> tablo = 'oku')))
$f$;
create or replace function public.ekipte(sahip_metin text) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip_metin = auth.uid()::text or exists (
    select 1 from public.ekip_uyeleri u where u.owner::text = sahip_metin and u.aktif and lower(u.eposta) = public.benim_epostam())
$f$;
create or replace function public.benim_yetkilerim() returns jsonb language sql stable security definer set search_path = public as $f$
  select case when public.veri_sahibi() = auth.uid()
    then jsonb_build_object('sahip', auth.uid(), 'ben_sahip', true)
    else (select jsonb_build_object('sahip', u.owner, 'ben_sahip', false, 'yetkiler', u.yetkiler, 'ad', u.ad)
          from public.ekip_uyeleri u where u.owner = public.veri_sahibi() and lower(u.eposta) = public.benim_epostam() limit 1)
  end
$f$;
alter table public.ekip_uyeleri enable row level security;
drop policy if exists "ekip_sahip" on public.ekip_uyeleri;
drop policy if exists "ekip_kendim" on public.ekip_uyeleri;
create policy "ekip_sahip" on public.ekip_uyeleri for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "ekip_kendim" on public.ekip_uyeleri for select to authenticated using (lower(eposta) = public.benim_epostam());
drop trigger if exists touch on public.ekip_uyeleri;
create trigger touch before update on public.ekip_uyeleri for each row execute function public.touch_updated_at();

-- ---------- Sürüm 8: TCMB döviz kuru (Supabase içinden, ayrı fonksiyon kurmadan) ----------
do $x$ begin
  create extension if not exists http with schema extensions;
exception when others then raise notice 'http eklentisi kurulamadı: %', sqlerrm;
end $x$;
create table if not exists public.kur_onbellek (id int primary key default 1, veri jsonb, zaman timestamptz);
alter table public.kur_onbellek enable row level security;
create or replace function public.tcmb_ayristir(x text) returns jsonb language sql immutable as $f$
  with d as (select xmlparse(document regexp_replace(x, '^\s*<\?xml[^>]*\?>', '')) as doc)
  select jsonb_build_object(
    'USD', ((xpath('/Tarih_Date/Currency[@CurrencyCode="USD"]/ForexSelling/text()', doc))[1])::text::numeric,
    'USD_alis', ((xpath('/Tarih_Date/Currency[@CurrencyCode="USD"]/ForexBuying/text()', doc))[1])::text::numeric,
    'EUR', ((xpath('/Tarih_Date/Currency[@CurrencyCode="EUR"]/ForexSelling/text()', doc))[1])::text::numeric,
    'EUR_alis', ((xpath('/Tarih_Date/Currency[@CurrencyCode="EUR"]/ForexBuying/text()', doc))[1])::text::numeric,
    'tarih', to_char(to_date(((xpath('/Tarih_Date/@Tarih', doc))[1])::text, 'DD.MM.YYYY'), 'YYYY-MM-DD'),
    'kaynak', 'TCMB')
  from d
$f$;
create or replace function public.tcmb_kur() returns jsonb language plpgsql security definer set search_path = public, extensions as $f$
declare c record; r jsonb; icerik text;
begin
  select * into c from public.kur_onbellek where id = 1;
  if c.zaman is not null and c.zaman > now() - interval '1 hour' then return c.veri; end if;
  begin
    execute 'select content from extensions.http_get($1)' into icerik using 'https://www.tcmb.gov.tr/kurlar/today.xml';
    r := public.tcmb_ayristir(icerik);
    if (r ->> 'USD') is null then raise exception 'kur okunamadı'; end if;
    insert into public.kur_onbellek (id, veri, zaman) values (1, r, now()) on conflict (id) do update set veri = excluded.veri, zaman = excluded.zaman;
    return r;
  exception when others then
    return coalesce(c.veri, jsonb_build_object('hata', sqlerrm));
  end;
end $f$;
revoke all on function public.tcmb_kur() from public;
grant execute on function public.tcmb_kur() to authenticated;

-- ---------- RLS + tetikleyiciler (sahip ve yetkili ekip üyeleri) ----------
do $$
declare t text;
begin
  foreach t in array array['firmalar','kisiler','projeler','proje_gecmis','ziyaretler','gorevler',
                           'urunler','stok_gecmis','rakip_fiyatlar','siparisler','hedefler','bolgeler',
                           'teklifler','numuneler','servis_kayitlari','masraflar','urun_aileleri',
                           'tahsilatlar','belgeler'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "sahibi" on public.%I', t);
    execute format('drop policy if exists "oku" on public.%I', t);
    execute format('drop policy if exists "ekle" on public.%I', t);
    execute format('drop policy if exists "degistir" on public.%I', t);
    execute format('drop policy if exists "sil" on public.%I', t);
    execute format('create policy "oku" on public.%I for select to authenticated using (public.yetki(owner, %L, %L))', t, t, 'oku');
    execute format('create policy "ekle" on public.%I for insert to authenticated with check (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('create policy "degistir" on public.%I for update to authenticated using (public.yetki(owner, %L, %L)) with check (public.yetki(owner, %L, %L))', t, t, 'yaz', t, 'yaz');
    execute format('create policy "sil" on public.%I for delete to authenticated using (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('alter table public.%I alter column owner set default public.veri_sahibi()', t);
    execute format('create index if not exists %I on public.%I (owner)', t || '_owner_idx', t);
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at') then
      execute format('drop trigger if exists touch on public.%I', t);
      execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    end if;
  end loop;
end $$;
-- Ayarlar kişiseldir: herkes kendi ayarını yazar; ekip üyesi sahibin ayarlarını (Google anahtarı, şablonlar) okuyabilir
alter table public.ayarlar enable row level security;
drop policy if exists "sahibi" on public.ayarlar;
drop policy if exists "ayar_oku" on public.ayarlar;
drop policy if exists "ayar_yaz" on public.ayarlar;
create policy "ayar_oku" on public.ayarlar for select to authenticated using (owner = auth.uid() or public.ekipte(owner::text));
create policy "ayar_yaz" on public.ayarlar for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create index if not exists ayarlar_owner_idx on public.ayarlar (owner);
drop trigger if exists touch on public.ayarlar;
create trigger touch before update on public.ayarlar for each row execute function public.touch_updated_at();

-- ---------- Fotoğraf ve belge deposu (özel) ----------
insert into storage.buckets (id, name, public) values ('fotograflar', 'fotograflar', false)
on conflict (id) do nothing;

drop policy if exists "foto_oku" on storage.objects;
drop policy if exists "foto_yaz" on storage.objects;
drop policy if exists "foto_sil" on storage.objects;
create policy "foto_oku" on storage.objects for select to authenticated
  using (bucket_id = 'fotograflar' and public.ekipte((storage.foldername(name))[1]));
create policy "foto_yaz" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotograflar' and (storage.foldername(name))[1] = public.veri_sahibi()::text);
create policy "foto_sil" on storage.objects for delete to authenticated
  using (bucket_id = 'fotograflar' and (storage.foldername(name))[1] = public.veri_sahibi()::text);

-- ---------- Sürüm 9: görev atama ----------
-- Görev bir ekip üyesine atanabilir; atanan kişi, görevler bölümüne yetkisi olmasa da kendi görevini görür ve tamamlar.
alter table public.gorevler add column if not exists atanan text;
alter table public.gorevler add column if not exists tamamlayan text;
drop policy if exists "atanan_oku" on public.gorevler;
drop policy if exists "atanan_degistir" on public.gorevler;
create policy "atanan_oku" on public.gorevler for select to authenticated
  using (atanan is not null and lower(atanan) = public.benim_epostam() and public.ekipte(owner::text));
create policy "atanan_degistir" on public.gorevler for update to authenticated
  using (atanan is not null and lower(atanan) = public.benim_epostam() and public.ekipte(owner::text))
  with check (lower(atanan) = public.benim_epostam() and public.ekipte(owner::text));

-- ---------- Sürüm 9: değişiklik geçmişi (kim, neyi, ne zaman değiştirdi) ----------
create table if not exists public.degisiklikler (
  id bigserial primary key,
  owner uuid not null,
  tablo text not null, kayit_id uuid, islem text not null,
  kim text, kim_id uuid, zaman timestamptz not null default now(),
  ozet text, degisen jsonb
);
create index if not exists degisiklikler_kayit_idx on public.degisiklikler (owner, tablo, kayit_id, zaman desc);
create index if not exists degisiklikler_zaman_idx on public.degisiklikler (owner, zaman desc);
alter table public.degisiklikler enable row level security;
drop policy if exists "gecmis_oku" on public.degisiklikler;
create policy "gecmis_oku" on public.degisiklikler for select to authenticated using (owner = auth.uid());

create or replace function public.degisiklik_yaz() returns trigger language plpgsql security definer set search_path = public as $f$
declare eski jsonb; yeni jsonb; r jsonb; fark jsonb := '{}'::jsonb; k text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then eski := to_jsonb(old);
  elsif tg_op = 'INSERT' then yeni := to_jsonb(new);
  else
    eski := to_jsonb(old); yeni := to_jsonb(new);
    for k in select jsonb_object_keys(yeni) loop
      if k not in ('updated_at', 'created_at') and (eski -> k) is distinct from (yeni -> k) then
        fark := fark || jsonb_build_object(k, jsonb_build_object('e', eski -> k, 'y', yeni -> k));
      end if;
    end loop;
    if fark = '{}'::jsonb then return null; end if;
  end if;
  r := coalesce(yeni, eski);
  insert into public.degisiklikler (owner, tablo, kayit_id, islem, kim, kim_id, ozet, degisen)
  values ((r ->> 'owner')::uuid, tg_table_name, (r ->> 'id')::uuid,
          case tg_op when 'INSERT' then 'ekleme' when 'UPDATE' then 'değişiklik' else 'silme' end,
          public.benim_epostam(), auth.uid(),
          left(coalesce(r ->> 'ad', r ->> 'baslik', r ->> 'ad_soyad', r ->> 'kod', r ->> 'siparis_no', r ->> 'teklif_no', r ->> 'cari', r ->> 'urun_ad', ''), 200),
          case when tg_op = 'UPDATE' then fark else null end);
  -- bir yıldan eski kayıtları ara sıra temizle
  if random() < 0.002 then delete from public.degisiklikler where zaman < now() - interval '365 days'; end if;
  return null;
end $f$;

do $$
declare t text;
begin
  foreach t in array array['projeler','firmalar','kisiler','ziyaretler','gorevler','siparisler','teklifler','urunler',
                           'tahsilatlar','numuneler','servis_kayitlari','belgeler','bolgeler','hedefler'] loop
    execute format('drop trigger if exists gecmis on public.%I', t);
    execute format('create trigger gecmis after insert or update or delete on public.%I for each row execute function public.degisiklik_yaz()', t);
  end loop;
end $$;

-- ---------- Sürüm 10: anlık bildirim abonelikleri (Web Push) ----------
-- Her cihaz bir satır; kişi yalnızca kendi cihazlarını görür ve yönetir. Bildirimleri “bildir” Edge Function'ı gönderir.
create table if not exists public.push_abonelikleri (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eposta text default public.benim_epostam(),
  endpoint text not null unique,
  p256dh text not null, auth text not null,
  cihaz text, created_at timestamptz default now()
);
create index if not exists push_abonelikleri_eposta_idx on public.push_abonelikleri (eposta);
alter table public.push_abonelikleri enable row level security;
drop policy if exists "kendi_cihazim" on public.push_abonelikleri;
create policy "kendi_cihazim" on public.push_abonelikleri for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Sürüm 11: ekip üyelerinin son girişi ----------
-- Üye uygulamayı açtığında "gorundum()" kendi satırına zamanı yazar; veri sahibi "ekip_son_giris()" ile
-- üyelerinin son giriş (Supabase oturum) ve son kullanım zamanlarını görür. Başka hiçbir kullanıcı bilgisi dönmez.
alter table public.ekip_uyeleri add column if not exists son_gorulme timestamptz;
create or replace function public.gorundum() returns void language sql security definer set search_path = public as $f$
  update public.ekip_uyeleri set son_gorulme = now() where aktif and lower(eposta) = public.benim_epostam() and owner <> auth.uid()
$f$;
create or replace function public.ekip_son_giris() returns table (eposta text, son_giris timestamptz, son_gorulme timestamptz)
language sql stable security definer set search_path = public, auth as $f$
  select e.eposta, u.last_sign_in_at, e.son_gorulme
  from public.ekip_uyeleri e left join auth.users u on lower(u.email) = lower(e.eposta)
  where e.owner = auth.uid()
$f$;
revoke all on function public.ekip_son_giris() from public, anon;
revoke all on function public.gorundum() from public, anon;
grant execute on function public.ekip_son_giris() to authenticated;
grant execute on function public.gorundum() to authenticated;

-- ---------- Sürüm 12: yorumlar ve etiketleme, aday projeler (ihale / ruhsat) ----------
-- Proje ve firma kartına yorum: kaydı görebilen herkes yazabilir; yorumu yalnızca yazanı ya da veri sahibi siler.
create table if not exists public.yorumlar (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi() references auth.users(id) on delete cascade,
  tablo text not null check (tablo in ('projeler', 'firmalar')),
  kayit_id uuid not null,
  metin text not null,
  yazan text not null default public.benim_epostam(),
  yazan_ad text,
  etiketler text[] not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists yorumlar_kayit_idx on public.yorumlar (kayit_id);
create index if not exists yorumlar_owner_idx on public.yorumlar (owner);
alter table public.yorumlar enable row level security;
drop policy if exists "yorum_oku" on public.yorumlar;
drop policy if exists "yorum_ekle" on public.yorumlar;
drop policy if exists "yorum_degistir" on public.yorumlar;
drop policy if exists "yorum_sil" on public.yorumlar;
create policy "yorum_oku" on public.yorumlar for select to authenticated using (public.yetki(owner, tablo, 'oku'));
create policy "yorum_ekle" on public.yorumlar for insert to authenticated with check (public.yetki(owner, tablo, 'oku') and lower(yazan) = public.benim_epostam());
create policy "yorum_degistir" on public.yorumlar for update to authenticated using (lower(yazan) = public.benim_epostam()) with check (lower(yazan) = public.benim_epostam() and public.yetki(owner, tablo, 'oku'));
create policy "yorum_sil" on public.yorumlar for delete to authenticated using (owner = auth.uid() or lower(yazan) = public.benim_epostam());
drop trigger if exists touch on public.yorumlar;
create trigger touch before update on public.yorumlar for each row execute function public.touch_updated_at();
-- Etiketlenebilecek kişiler: veri sahibi ve aktif ekip üyeleri (yalnızca e-posta ve ad)
create or replace function public.ekip_listesi() returns table (eposta text, ad text, sahip boolean)
language sql stable security definer set search_path = public, auth as $f$
  select lower(u.email), 'Veri sahibi', true from auth.users u where u.id = public.veri_sahibi()
  union all
  select lower(e.eposta), e.ad, false from public.ekip_uyeleri e where e.owner = public.veri_sahibi() and e.aktif
$f$;
revoke all on function public.ekip_listesi() from public, anon;
grant execute on function public.ekip_listesi() to authenticated;
-- Aday projeler: ihale ilanı ya da inşaat ruhsatından gelen, henüz takibe alınmamış projeler
alter table public.projeler add column if not exists aday boolean default false;
alter table public.projeler add column if not exists aday_kaynak text;
alter table public.projeler add column if not exists ihale_tarihi date;

-- ---------- Sürüm 13: otomatik yedek klasörü yalnızca veri sahibine açık ----------
-- Yedekler fotograflar/<sahip>/yedek/ altında durur; ekip üyeleri fotoğraf ve belgeleri görür ama bu klasörü göremez.
drop policy if exists "foto_oku" on storage.objects;
create policy "foto_oku" on storage.objects for select to authenticated
  using (bucket_id = 'fotograflar' and public.ekipte((storage.foldername(name))[1])
         and ((storage.foldername(name))[2] is distinct from 'yedek' or (storage.foldername(name))[1] = auth.uid()::text));
create or replace function public.yedek_guvenli() returns boolean language sql stable as $f$ select true $f$;
grant execute on function public.yedek_guvenli() to authenticated;

-- ---------- Sürüm 14: cihaz başına bildirim tercihleri ----------
-- { "atandi": false } gibi: kişi o türü kapattıysa bildir fonksiyonu o cihaza göndermez.
alter table public.push_abonelikleri add column if not exists tercihler jsonb not null default '{}'::jsonb;

-- ---------- Sürüm 15: ayrıntılı yetkiler — kapalı bölümün dosyası ve ayarı da ekip üyesine gitmez ----------
-- 1) Ekip üyesi, veri sahibinin ayarlarından yalnızca ortak kullanılanları okur (Google anahtarı, şablonlar, listeler, kur…).
--    Proje bazlı ayarlar (ör. sartname:<proje>) yalnızca projeleri görebilen üyeye açıktır.
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip = auth.uid() or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
drop policy if exists "ayar_oku" on public.ayarlar;
create policy "ayar_oku" on public.ayarlar for select to authenticated using (public.ayar_paylasilir(owner, anahtar));

-- 2) Fotoğraf ve belgeler: ekip üyesi bir dosyayı ancak o dosyanın bağlı olduğu kaydı görebiliyorsa açar
--    (ör. firmalar kapalıysa firma fotoğrafları, dosyalar kapalıysa belgeler açılmaz). Yedek klasörü yalnızca veri sahibinde.
create or replace function public.foto_izinli(yol text) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare s text := split_part(yol, '/', 1); o uuid; y text;
begin
  if s = auth.uid()::text then return true; end if;
  if not public.ekipte(s) then return false; end if;
  if split_part(yol, '/', 2) = 'yedek' then return false; end if;
  o := s::uuid;
  y := regexp_replace(yol, '_k\.jpg$', '.jpg');   -- küçük önizleme, asıl fotoğrafla aynı izni alır
  if public.yetki(o, 'belgeler', 'oku') and exists (select 1 from public.belgeler b where b.owner = o and b.yol = y) then return true; end if;
  if split_part(yol, '/', 2) = 'belge' then return false; end if;
  if public.yetki(o, 'projeler', 'oku') and exists (select 1 from public.projeler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'firmalar', 'oku') and exists (select 1 from public.firmalar t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'kisiler', 'oku') and exists (select 1 from public.kisiler t where t.owner = o and (t.kartvizit_on = y or t.kartvizit_arka = y)) then return true; end if;
  if public.yetki(o, 'ziyaretler', 'oku') and exists (select 1 from public.ziyaretler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'servis_kayitlari', 'oku') and exists (select 1 from public.servis_kayitlari t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'urun_aileleri', 'oku') and exists (select 1 from public.urun_aileleri t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'masraflar', 'oku') and exists (select 1 from public.masraflar t where t.owner = o and t.fis = y) then return true; end if;
  return false;
exception when others then return false;
end $f$;
revoke all on function public.foto_izinli(text) from public, anon;
grant execute on function public.foto_izinli(text) to authenticated;
drop policy if exists "foto_oku" on storage.objects;
create policy "foto_oku" on storage.objects for select to authenticated
  using (bucket_id = 'fotograflar' and public.foto_izinli(name));
-- Uygulama bu fonksiyonla sunucu kurallarının güncel olduğunu anlar
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 15 $f$;
grant execute on function public.yetki_surum() to authenticated;

-- ---------- Sürüm 16: kullanıcı adıyla giriş ----------
-- Her e-postanın en fazla bir kullanıcı adı olur. Kişi kendi adını, veri sahibi kendi ekip üyelerinin adını belirler.
-- Giriş ekranı adı e-postaya çevirmek için yalnızca giris_epostasi() fonksiyonunu kullanır; tablo herkese kapalıdır.
create table if not exists public.kullanici_adlari (
  ad text primary key check (ad ~ '^[a-z0-9._-]{3,30}$'),
  eposta text not null unique,
  ekleyen uuid default auth.uid(),
  created_at timestamptz default now()
);
alter table public.kullanici_adlari enable row level security;
create or replace function public.kad_yonetebilir(e text) returns boolean language sql stable security definer set search_path = public as $f$
  select lower(e) = public.benim_epostam()
      or exists (select 1 from public.ekip_uyeleri u where u.owner = auth.uid() and lower(u.eposta) = lower(e))
$f$;
drop policy if exists "kad_oku" on public.kullanici_adlari;
drop policy if exists "kad_ekle" on public.kullanici_adlari;
drop policy if exists "kad_sil" on public.kullanici_adlari;
create policy "kad_oku" on public.kullanici_adlari for select to authenticated using (public.kad_yonetebilir(eposta));
create policy "kad_ekle" on public.kullanici_adlari for insert to authenticated with check (public.kad_yonetebilir(eposta) and eposta = lower(eposta));
create policy "kad_sil" on public.kullanici_adlari for delete to authenticated using (public.kad_yonetebilir(eposta));
create or replace function public.giris_epostasi(ad text) returns text language sql stable security definer set search_path = public as $f$
  select k.eposta from public.kullanici_adlari k where k.ad = lower(trim($1)) limit 1
$f$;
revoke all on function public.giris_epostasi(text) from public;
grant execute on function public.giris_epostasi(text) to anon, authenticated;

-- ---------- Sürüm 17: hata günlüğü ----------
-- Telefonda oluşan hatalar (metin, ekran, sürüm, telefon türü) veri sahibinin günlüğüne yazılır. Kayıt içeriği yazılmaz.
-- Ekip üyesi yalnızca ekleyebilir; okumak ve silmek veri sahibine aittir.
create table if not exists public.hata_gunlugu (
  id bigserial primary key,
  owner uuid not null default public.veri_sahibi() references auth.users(id) on delete cascade,
  kim text default public.benim_epostam(),
  zaman timestamptz not null default now(),
  surum text, ekran text, mesaj text not null, yer text, tarayici text, adet int default 1
);
create index if not exists hata_gunlugu_owner_idx on public.hata_gunlugu (owner, zaman desc);
alter table public.hata_gunlugu enable row level security;
drop policy if exists "hata_ekle" on public.hata_gunlugu;
drop policy if exists "hata_oku" on public.hata_gunlugu;
drop policy if exists "hata_sil" on public.hata_gunlugu;
create policy "hata_ekle" on public.hata_gunlugu for insert to authenticated
  with check (owner = public.veri_sahibi() and kim = public.benim_epostam() and length(mesaj) <= 500);
create policy "hata_oku" on public.hata_gunlugu for select to authenticated using (owner = auth.uid());
create policy "hata_sil" on public.hata_gunlugu for delete to authenticated using (owner = auth.uid());
-- Günlük şişmesin: 90 günden eski kayıtlar, yenisi eklenirken silinir
create or replace function public.hata_temizle() returns trigger language plpgsql security definer set search_path = public as $f$
begin delete from public.hata_gunlugu where owner = new.owner and zaman < now() - interval '90 days'; return new; end $f$;
drop trigger if exists hata_temizle on public.hata_gunlugu;
create trigger hata_temizle after insert on public.hata_gunlugu for each row execute function public.hata_temizle();

-- ---------- Sürüm 18: genel sürüm — firma profili, geri bildirim, uygulama yöneticisi ----------
-- Firma profili (sektör, bölge, bayi) ekip üyeleriyle paylaşılır.
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip = auth.uid() or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
-- Uygulama yöneticisi: geri bildirimleri ve bütün kullanıcıların hata günlüğünü görür.
-- Kendini eklemek için SQL Editor'de bir kez çalıştır:  insert into public.uygulama_yoneticileri values ('senin@epostan.com');
create table if not exists public.uygulama_yoneticileri (eposta text primary key);
alter table public.uygulama_yoneticileri enable row level security;   -- uygulamadan okunamaz/yazılamaz; yalnızca SQL Editor
create or replace function public.yonetici_mi() returns boolean language sql stable security definer set search_path = public as $f$
  select exists (select 1 from public.uygulama_yoneticileri y where lower(y.eposta) = public.benim_epostam())
$f$;
revoke all on function public.yonetici_mi() from public, anon;
grant execute on function public.yonetici_mi() to authenticated;
-- Geri bildirimler: herkes kendi gönderdiğini görür; yönetici hepsini görür ve durumunu değiştirir.
create table if not exists public.geri_bildirim (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kim text default public.benim_epostam(),
  firma text, tur text, metin text not null check (length(metin) <= 4000),
  ekran text, surum text, tarayici text, foto text,
  durum text default 'Yeni',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists geri_bildirim_zaman_idx on public.geri_bildirim (created_at desc);
alter table public.geri_bildirim enable row level security;
drop policy if exists "gb_ekle" on public.geri_bildirim;
drop policy if exists "gb_oku" on public.geri_bildirim;
drop policy if exists "gb_degistir" on public.geri_bildirim;
drop policy if exists "gb_sil" on public.geri_bildirim;
create policy "gb_ekle" on public.geri_bildirim for insert to authenticated with check (user_id = auth.uid() and kim = public.benim_epostam());
create policy "gb_oku" on public.geri_bildirim for select to authenticated using (user_id = auth.uid() or public.yonetici_mi());
create policy "gb_degistir" on public.geri_bildirim for update to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
create policy "gb_sil" on public.geri_bildirim for delete to authenticated using (user_id = auth.uid() or public.yonetici_mi());
drop trigger if exists touch on public.geri_bildirim;
create trigger touch before update on public.geri_bildirim for each row execute function public.touch_updated_at();
-- Yönetici bütün kullanıcıların hata günlüğünü okur (kayıt içeriği yoktur; hata metni, ekran, sürüm)
drop policy if exists "hata_oku_yonetici" on public.hata_gunlugu;
create policy "hata_oku_yonetici" on public.hata_gunlugu for select to authenticated using (public.yonetici_mi());
-- Geri bildirime eklenen ekran görüntüleri (<sahip>/geri/…) yöneticiye de açılır
create or replace function public.foto_izinli(yol text) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare s text := split_part(yol, '/', 1); o uuid; y text;
begin
  if s = auth.uid()::text then return true; end if;
  if split_part(yol, '/', 2) = 'geri' then return public.yonetici_mi(); end if;
  if not public.ekipte(s) then return false; end if;
  if split_part(yol, '/', 2) = 'yedek' then return false; end if;
  o := s::uuid;
  y := regexp_replace(yol, '_k\.jpg$', '.jpg');
  if public.yetki(o, 'belgeler', 'oku') and exists (select 1 from public.belgeler b where b.owner = o and b.yol = y) then return true; end if;
  if split_part(yol, '/', 2) = 'belge' then return false; end if;
  if public.yetki(o, 'projeler', 'oku') and exists (select 1 from public.projeler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'firmalar', 'oku') and exists (select 1 from public.firmalar t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'kisiler', 'oku') and exists (select 1 from public.kisiler t where t.owner = o and (t.kartvizit_on = y or t.kartvizit_arka = y)) then return true; end if;
  if public.yetki(o, 'ziyaretler', 'oku') and exists (select 1 from public.ziyaretler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'servis_kayitlari', 'oku') and exists (select 1 from public.servis_kayitlari t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'urun_aileleri', 'oku') and exists (select 1 from public.urun_aileleri t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'masraflar', 'oku') and exists (select 1 from public.masraflar t where t.owner = o and t.fis = y) then return true; end if;
  return false;
exception when others then return false;
end $f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 18 $f$;

-- ---------- Sürüm 19: hesap türleri ve yönetim paneli ----------
-- Hesap = verinin sahibi olan kullanıcı (firma). Ekip üyeleri sahibin hesabında çalışır, ayrı hesap sayılmaz.
-- tur: 'ic' (kendi kullanımım), 'test', 'musteri'. durum: 'aktif' ya da 'askida' (askıdaki hesap salt okunurdur).
create table if not exists public.hesaplar (
  owner uuid primary key references auth.users(id) on delete cascade,
  eposta text, firma text,
  tur text not null default 'test' check (tur in ('ic', 'test', 'musteri')),
  durum text not null default 'aktif' check (durum in ('aktif', 'askida')),
  paket text, deneme_bitis date, notlar text,
  son_gorulme timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.uygulama_yoneticileri add column if not exists rol text not null default 'yonetici';
alter table public.hesaplar enable row level security;
drop policy if exists "hesap_oku" on public.hesaplar;
drop policy if exists "hesap_yonet" on public.hesaplar;
create policy "hesap_oku" on public.hesaplar for select to authenticated using (owner = auth.uid() or public.yonetici_mi());
create policy "hesap_yonet" on public.hesaplar for update to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop trigger if exists touch on public.hesaplar;
create trigger touch before update on public.hesaplar for each row execute function public.touch_updated_at();
-- Uygulama her açılışta çağırır: hesap kaydını oluşturur, firma adını ve son görülmeyi günceller (yalnızca veri sahibi için)
create or replace function public.hesap_kaydol(p_firma text default null) returns jsonb language plpgsql security definer set search_path = public as $f$
declare r public.hesaplar;
begin
  if auth.uid() is null or public.veri_sahibi() <> auth.uid() then return null; end if;
  insert into public.hesaplar (owner, eposta, firma, son_gorulme) values (auth.uid(), public.benim_epostam(), nullif(trim(p_firma), ''), now())
  on conflict (owner) do update set eposta = excluded.eposta, firma = coalesce(excluded.firma, public.hesaplar.firma), son_gorulme = now()
  returning * into r;
  return jsonb_build_object('tur', r.tur, 'durum', r.durum, 'paket', r.paket, 'deneme_bitis', r.deneme_bitis);
end $f$;
revoke all on function public.hesap_kaydol(text) from public, anon;
grant execute on function public.hesap_kaydol(text) to authenticated;
create or replace function public.hesap_askida(sahip uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select exists (select 1 from public.hesaplar h where h.owner = sahip and h.durum = 'askida')
$f$;
-- Yazma yetkisi: askıdaki hesapta kimse (sahibi dahil) değişiklik yapamaz, okuma serbest
create or replace function public.yetki(sahip uuid, tablo text, islem text) returns boolean language sql stable security definer set search_path = public as $f$
  select (sahip = auth.uid() or exists (
    select 1 from public.ekip_uyeleri u
    where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam()
      and (u.yetkiler ->> tablo = 'yaz' or (islem = 'oku' and u.yetkiler ->> tablo = 'oku'))))
    and (islem = 'oku' or not public.hesap_askida(sahip))
$f$;

-- Yönetici bütün hesapların kayıtlarını OKUR (değiştiremez): "hesaba bak" ve "kim ne ekledi"
do $$
declare t text;
begin
  foreach t in array array['firmalar','kisiler','projeler','proje_gecmis','ziyaretler','gorevler',
                           'urunler','stok_gecmis','rakip_fiyatlar','siparisler','hedefler','bolgeler',
                           'teklifler','numuneler','servis_kayitlari','masraflar','urun_aileleri',
                           'tahsilatlar','belgeler','ayarlar','yorumlar','ekip_uyeleri','degisiklikler'] loop
    execute format('drop policy if exists "yonetici_oku" on public.%I', t);
    execute format('create policy "yonetici_oku" on public.%I for select to authenticated using (public.yonetici_mi())', t);
  end loop;
end $$;
-- Yönetici bütün dosyaları da açabilir (hesaba bakarken fotoğraf ve belgeler)
create or replace function public.foto_izinli(yol text) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare s text := split_part(yol, '/', 1); o uuid; y text;
begin
  if s = auth.uid()::text then return true; end if;
  if public.yonetici_mi() then return true; end if;
  if split_part(yol, '/', 2) = 'geri' then return false; end if;
  if not public.ekipte(s) then return false; end if;
  if split_part(yol, '/', 2) = 'yedek' then return false; end if;
  o := s::uuid;
  y := regexp_replace(yol, '_k\.jpg$', '.jpg');
  if public.yetki(o, 'belgeler', 'oku') and exists (select 1 from public.belgeler b where b.owner = o and b.yol = y) then return true; end if;
  if split_part(yol, '/', 2) = 'belge' then return false; end if;
  if public.yetki(o, 'projeler', 'oku') and exists (select 1 from public.projeler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'firmalar', 'oku') and exists (select 1 from public.firmalar t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'kisiler', 'oku') and exists (select 1 from public.kisiler t where t.owner = o and (t.kartvizit_on = y or t.kartvizit_arka = y)) then return true; end if;
  if public.yetki(o, 'ziyaretler', 'oku') and exists (select 1 from public.ziyaretler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'servis_kayitlari', 'oku') and exists (select 1 from public.servis_kayitlari t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'urun_aileleri', 'oku') and exists (select 1 from public.urun_aileleri t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'masraflar', 'oku') and exists (select 1 from public.masraflar t where t.owner = o and t.fis = y) then return true; end if;
  return false;
exception when others then return false;
end $f$;

-- Yönetim paneli: bütün hesaplar, kayıt sayıları, son giriş ve son işlem (yalnızca yönetici çağırabilir)
create or replace function public.yonetim_hesaplar() returns table (
  owner uuid, eposta text, firma text, tur text, durum text, paket text, deneme_bitis date, notlar text,
  kayit timestamptz, son_giris timestamptz, son_islem timestamptz, kurulum boolean, ekip int,
  projeler int, firmalar int, kisiler int, ziyaretler int, gorevler int, teklifler int, siparisler int, belgeler int)
language plpgsql stable security definer set search_path = public, auth as $f$
begin
  if not public.yonetici_mi() then raise exception 'yetkisiz'; end if;
  return query
  select u.id, lower(u.email)::text, coalesce(h.firma, (select a.deger ->> 'firma' from public.ayarlar a where a.owner = u.id and a.anahtar = 'firma_profil' limit 1))::text,
    coalesce(h.tur, 'test')::text, coalesce(h.durum, 'aktif')::text, h.paket, h.deneme_bitis, h.notlar,
    u.created_at, u.last_sign_in_at,
    (select max(d.zaman) from public.degisiklikler d where d.owner = u.id),
    exists (select 1 from public.ayarlar a where a.owner = u.id and a.anahtar = 'firma_profil'),
    (select count(*)::int from public.ekip_uyeleri e where e.owner = u.id and e.aktif),
    (select count(*)::int from public.projeler x where x.owner = u.id),
    (select count(*)::int from public.firmalar x where x.owner = u.id),
    (select count(*)::int from public.kisiler x where x.owner = u.id),
    (select count(*)::int from public.ziyaretler x where x.owner = u.id),
    (select count(*)::int from public.gorevler x where x.owner = u.id),
    (select count(*)::int from public.teklifler x where x.owner = u.id),
    (select count(*)::int from public.siparisler x where x.owner = u.id),
    (select count(*)::int from public.belgeler x where x.owner = u.id)
  from auth.users u
  left join public.hesaplar h on h.owner = u.id
  where not exists (select 1 from public.ekip_uyeleri e where e.aktif and lower(e.eposta) = lower(u.email) and e.owner <> u.id)
  order by coalesce(h.son_gorulme, u.last_sign_in_at, u.created_at) desc nulls last;
end $f$;
revoke all on function public.yonetim_hesaplar() from public, anon;
grant execute on function public.yonetim_hesaplar() to authenticated;
-- Bir hesabın ekip üyeleri ve son girişleri (yönetici)
create or replace function public.yonetim_ekip(p_owner uuid) returns table (eposta text, ad text, aktif boolean, rol text, son_giris timestamptz, son_gorulme timestamptz)
language plpgsql stable security definer set search_path = public, auth as $f$
begin
  if not public.yonetici_mi() then raise exception 'yetkisiz'; end if;
  return query select e.eposta, e.ad, e.aktif, (e.yetkiler ->> '_rol')::text, u.last_sign_in_at, e.son_gorulme
    from public.ekip_uyeleri e left join auth.users u on lower(u.email) = lower(e.eposta) where e.owner = p_owner order by e.created_at;
end $f$;
revoke all on function public.yonetim_ekip(uuid) from public, anon;
grant execute on function public.yonetim_ekip(uuid) to authenticated;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 19 $f$;
drop policy if exists "hesap_yonet_ekle" on public.hesaplar;
create policy "hesap_yonet_ekle" on public.hesaplar for insert to authenticated with check (public.yonetici_mi());
drop policy if exists "hata_sil" on public.hata_gunlugu;
create policy "hata_sil" on public.hata_gunlugu for delete to authenticated using (owner = auth.uid() or public.yonetici_mi());

-- ===================== Sürüm 20: kişilerde ad ve soyad ayrı =====================
alter table public.kisiler add column if not exists ad text;
alter table public.kisiler add column if not exists soyad text;
-- Eski kayıtlar: son kelime soyad, öncesi ad
update public.kisiler set
  ad = case when position(' ' in btrim(ad_soyad)) > 0 then regexp_replace(btrim(ad_soyad), '\s+\S+$', '') else btrim(ad_soyad) end,
  soyad = case when position(' ' in btrim(ad_soyad)) > 0 then substring(btrim(ad_soyad) from '\S+$') else null end
where ad is null and soyad is null and ad_soyad is not null;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 20 $f$;

-- ===================== Sürüm 21: kişilerde internet sitesi ve adres =====================
alter table public.kisiler add column if not exists web text;
alter table public.kisiler add column if not exists adres text;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 21 $f$;

-- ===================== Sürüm 22: benzer kayıtlarda "farklı kayıtlar" listesi ekiple paylaşılır =====================
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip = auth.uid() or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil', 'cift_farkli')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 22 $f$;

-- ===================== Sürüm 23: kişinin eski firmaları =====================
-- [{ firma_id, firma_ad, unvan, bitis }] — firma değişince uygulama ekler
alter table public.kisiler add column if not exists eski_firmalar jsonb;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 23 $f$;

-- ===================== Sürüm 24: kişinin pozisyonu (görev alanı) =====================
alter table public.kisiler add column if not exists pozisyon text;
-- Eski kayıtlar: unvandan tahmin (uygulamadaki kurallarla aynı sırada)
update public.kisiler set pozisyon = case
  when unvan ~* '(sahib|ortak|kurucu|owner|founder|partner)' then 'Firma sahibi / Ortak'
  when unvan ~* '(satın ?alma|satinalma|tedarik|purchas|procure)' then 'Satınalma'
  when unvan ~* '(genel müdür|genel mudur|yönetim kurulu|ceo|direkt|başkan|general manager)' then 'Genel müdür / Yönetim'
  when unvan ~* '(şantiye|santiye|saha|şef|ustabaşı)' then 'Saha / Şantiye'
  when unvan ~* '(proje|tasarım|tasarim|design|mimar)' then 'Proje / Tasarım'
  when unvan ~* '(satış|satis|pazarlama|ş geliştirme|s gelistirme|sales|business development|marketing|temsilci)' then 'Satış / Pazarlama'
  when unvan ~* '(muhasebe|finans|mali|account|finance)' then 'Muhasebe / Finans'
  when unvan ~* '(mühendis|muhendis|tekniker|teknisyen|teknik|engineer|elektrik)' then 'Mühendis / Teknik'
  when unvan ~* '(asistan|sekreter|idari|ofis|assistant)' then 'İdari / Asistan'
  when unvan ~* '(müdür|mudur|manager|yönetici)' then 'Genel müdür / Yönetim'
end
where pozisyon is null and unvan is not null and btrim(unvan) <> '';
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 24 $f$;

-- ===================== Sürüm 25: Şirket (K1) =====================
-- Kayıtlardaki "owner" artık bir ŞİRKETİ gösterir (değeri, şirketi kuran kişinin kimliğiyle aynı kalır).
-- Şirketin birden fazla yöneticisi olabilir: kurucu ve "şirket yöneticisi" işaretli kullanıcılar her şeyi görür,
-- düzenler, kullanıcıları ve şirket ayarlarını yönetir. Kurucu ayrılırsa şirket ve verileri yaşamaya devam eder.
alter table public.ekip_uyeleri add column if not exists yonetici boolean not null default false;
alter table public.hesaplar add column if not exists kurucu_ayrildi boolean not null default false;

-- Kurucunun kullanıcı hesabı silinse de şirketin verileri silinmesin: owner → auth.users bağı kaldırılır
do $$ declare r record; begin
  for r in select c.conrelid::regclass as tablo, c.conname from pg_constraint c
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
      and c.conkey = array[(select a.attnum from pg_attribute a where a.attrelid = c.conrelid and a.attname = 'owner')]
  loop execute format('alter table %s drop constraint %I', r.tablo, r.conname); end loop;
end $$;

-- Şirketin yetkilisi mi: kurucu (ayrılmadıysa) ya da aktif şirket yöneticisi
create or replace function public.sirket_yetkilisi(sahip uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select (sahip = auth.uid() and not exists (select 1 from public.hesaplar h where h.owner = sahip and h.kurucu_ayrildi))
      or exists (select 1 from public.ekip_uyeleri u where u.owner = sahip and u.aktif and u.yonetici and lower(u.eposta) = public.benim_epostam())
$f$;
revoke all on function public.sirket_yetkilisi(uuid) from public, anon;
grant execute on function public.sirket_yetkilisi(uuid) to authenticated;

-- Kullanıcının çalıştığı şirket: şirket yöneticiliği önce, sonra ekip üyeliği, yoksa kendi şirketi
create or replace function public.veri_sahibi() returns uuid language sql stable security definer set search_path = public as $f$
  select coalesce(
    (select u.owner from public.ekip_uyeleri u where u.aktif and u.yonetici and lower(u.eposta) = public.benim_epostam() and u.owner <> auth.uid() order by u.created_at limit 1),
    (select u.owner from public.ekip_uyeleri u where u.aktif and lower(u.eposta) = public.benim_epostam() and u.owner <> auth.uid() order by u.created_at limit 1),
    auth.uid())
$f$;
create or replace function public.yetki(sahip uuid, tablo text, islem text) returns boolean language sql stable security definer set search_path = public as $f$
  select (public.sirket_yetkilisi(sahip) or exists (
    select 1 from public.ekip_uyeleri u
    where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam()
      and (u.yetkiler ->> tablo = 'yaz' or (islem = 'oku' and u.yetkiler ->> tablo = 'oku'))))
    and (islem = 'oku' or not public.hesap_askida(sahip))
$f$;
create or replace function public.ekipte(sahip_metin text) returns boolean language sql stable security definer set search_path = public as $f$
  select (sahip_metin ~ '^[0-9a-f-]{36}$' and public.sirket_yetkilisi(sahip_metin::uuid)) or exists (
    select 1 from public.ekip_uyeleri u where u.owner::text = sahip_metin and u.aktif and lower(u.eposta) = public.benim_epostam())
$f$;
create or replace function public.benim_yetkilerim() returns jsonb language sql stable security definer set search_path = public as $f$
  select case
    when public.veri_sahibi() = auth.uid() and public.sirket_yetkilisi(auth.uid())
      then jsonb_build_object('sahip', auth.uid(), 'ben_sahip', true, 'kurucu', true)
    when public.veri_sahibi() = auth.uid()
      then jsonb_build_object('sahip', auth.uid(), 'ben_sahip', false, 'yetkiler', '{}'::jsonb, 'ayrildi', true)
    when public.sirket_yetkilisi(public.veri_sahibi())
      then (select jsonb_build_object('sahip', u.owner, 'ben_sahip', true, 'sirket_yoneticisi', true, 'ad', u.ad)
            from public.ekip_uyeleri u where u.owner = public.veri_sahibi() and lower(u.eposta) = public.benim_epostam() limit 1)
    else (select jsonb_build_object('sahip', u.owner, 'ben_sahip', false, 'yetkiler', u.yetkiler, 'ad', u.ad)
          from public.ekip_uyeleri u where u.owner = public.veri_sahibi() and lower(u.eposta) = public.benim_epostam() limit 1)
  end
$f$;
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil', 'cift_farkli')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
create or replace function public.kad_yonetebilir(e text) returns boolean language sql stable security definer set search_path = public as $f$
  select lower(e) = public.benim_epostam()
      or exists (select 1 from public.ekip_uyeleri u where public.sirket_yetkilisi(u.owner) and lower(u.eposta) = lower(e))
$f$;

-- Kurucuya özel kalan kuralları şirket yetkilisine aç
alter table public.ekip_uyeleri alter column owner set default public.veri_sahibi();
alter table public.ayarlar alter column owner set default public.veri_sahibi();
drop policy if exists "ekip_sahip" on public.ekip_uyeleri;
create policy "ekip_sahip" on public.ekip_uyeleri for all to authenticated using (public.sirket_yetkilisi(owner)) with check (public.sirket_yetkilisi(owner));
drop policy if exists "ayar_yaz" on public.ayarlar;
create policy "ayar_yaz" on public.ayarlar for all to authenticated using (public.sirket_yetkilisi(owner)) with check (public.sirket_yetkilisi(owner));
drop policy if exists "gecmis_oku" on public.degisiklikler;
create policy "gecmis_oku" on public.degisiklikler for select to authenticated using (public.sirket_yetkilisi(owner));
drop policy if exists "yorum_sil" on public.yorumlar;
create policy "yorum_sil" on public.yorumlar for delete to authenticated using (public.sirket_yetkilisi(owner) or lower(yazan) = public.benim_epostam());
drop policy if exists "hata_oku" on public.hata_gunlugu;
create policy "hata_oku" on public.hata_gunlugu for select to authenticated using (public.sirket_yetkilisi(owner));
drop policy if exists "hata_sil" on public.hata_gunlugu;
create policy "hata_sil" on public.hata_gunlugu for delete to authenticated using (public.sirket_yetkilisi(owner) or public.yonetici_mi());
drop policy if exists "hesap_oku" on public.hesaplar;
create policy "hesap_oku" on public.hesaplar for select to authenticated using (public.sirket_yetkilisi(owner) or public.yonetici_mi());

-- Dosyalar: şirket yetkilisi şirketin bütün dosyalarını açar (yedekler dahil)
create or replace function public.foto_izinli(yol text) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare s text := split_part(yol, '/', 1); o uuid; y text;
begin
  if s = auth.uid()::text and public.sirket_yetkilisi(auth.uid()) then return true; end if;
  if public.yonetici_mi() then return true; end if;
  if split_part(yol, '/', 2) = 'geri' then return s = auth.uid()::text; end if;
  if s !~ '^[0-9a-f-]{36}$' then return false; end if;
  if public.sirket_yetkilisi(s::uuid) then return true; end if;
  if not public.ekipte(s) then return false; end if;
  if split_part(yol, '/', 2) = 'yedek' then return false; end if;
  o := s::uuid;
  y := regexp_replace(yol, '_k\.jpg$', '.jpg');
  if public.yetki(o, 'belgeler', 'oku') and exists (select 1 from public.belgeler b where b.owner = o and b.yol = y) then return true; end if;
  if split_part(yol, '/', 2) = 'belge' then return false; end if;
  if public.yetki(o, 'projeler', 'oku') and exists (select 1 from public.projeler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'firmalar', 'oku') and exists (select 1 from public.firmalar t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'kisiler', 'oku') and exists (select 1 from public.kisiler t where t.owner = o and (t.kartvizit_on = y or t.kartvizit_arka = y)) then return true; end if;
  if public.yetki(o, 'ziyaretler', 'oku') and exists (select 1 from public.ziyaretler t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'servis_kayitlari', 'oku') and exists (select 1 from public.servis_kayitlari t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'urun_aileleri', 'oku') and exists (select 1 from public.urun_aileleri t where t.owner = o and y = any(t.fotolar)) then return true; end if;
  if public.yetki(o, 'masraflar', 'oku') and exists (select 1 from public.masraflar t where t.owner = o and t.fis = y) then return true; end if;
  return false;
end $f$;

-- Şirket ayarları ekranı
create or replace function public.sirket_bilgisi() returns jsonb language sql stable security definer set search_path = public, auth as $f$
  select case when not public.sirket_yetkilisi(public.veri_sahibi()) then null else jsonb_build_object(
    'id', public.veri_sahibi(),
    'ad', (select h.firma from public.hesaplar h where h.owner = public.veri_sahibi()),
    'kurucu_eposta', (select lower(u.email) from auth.users u where u.id = public.veri_sahibi()),
    'kurucu_ayrildi', coalesce((select h.kurucu_ayrildi from public.hesaplar h where h.owner = public.veri_sahibi()), false),
    'ben_kurucu', public.veri_sahibi() = auth.uid(),
    'kurulus', (select h.created_at from public.hesaplar h where h.owner = public.veri_sahibi()),
    'yoneticiler', coalesce((select jsonb_agg(jsonb_build_object('eposta', e.eposta, 'ad', e.ad) order by e.created_at) from public.ekip_uyeleri e where e.owner = public.veri_sahibi() and e.aktif and e.yonetici), '[]'::jsonb),
    'kullanici_sayisi', (select count(*) from public.ekip_uyeleri e where e.owner = public.veri_sahibi() and e.aktif)) end
$f$;
revoke all on function public.sirket_bilgisi() from public, anon;
grant execute on function public.sirket_bilgisi() to authenticated;
create or replace function public.sirket_adi(p_ad text) returns void language plpgsql security definer set search_path = public as $f$
begin
  if not public.sirket_yetkilisi(public.veri_sahibi()) then raise exception 'Şirket ayarlarını yalnızca şirket yöneticisi değiştirebilir.'; end if;
  insert into public.hesaplar (owner, firma) values (public.veri_sahibi(), nullif(btrim(p_ad), ''))
  on conflict (owner) do update set firma = excluded.firma;
end $f$;
revoke all on function public.sirket_adi(text) from public, anon;
grant execute on function public.sirket_adi(text) to authenticated;
-- Kurucu şirketten ayrıldı: yalnızca başka bir şirket yöneticisi işaretleyebilir (şirket yöneticisiz kalmasın diye)
create or replace function public.kurucu_ayrildi(p_ayrildi boolean) returns void language plpgsql security definer set search_path = public as $f$
declare s uuid := public.veri_sahibi();
begin
  if s = auth.uid() then raise exception 'Kurucu kendini ayrıldı olarak işaretleyemez; önce başka bir şirket yöneticisi ata.'; end if;
  if not public.sirket_yetkilisi(s) then raise exception 'Bunu yalnızca şirket yöneticisi yapabilir.'; end if;
  update public.hesaplar set kurucu_ayrildi = p_ayrildi where owner = s;
  if not found then insert into public.hesaplar (owner, kurucu_ayrildi) values (s, p_ayrildi); end if;
end $f$;
revoke all on function public.kurucu_ayrildi(boolean) from public, anon;
grant execute on function public.kurucu_ayrildi(boolean) to authenticated;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 25 $f$;

-- ===================== Sürüm 26: kişinin bağlı olduğu kişi (firma organizasyon şeması) =====================
alter table public.kisiler add column if not exists ust_kisi_id uuid references public.kisiler(id) on delete set null;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 26 $f$;

-- ===================== Sürüm 27: Roller (K2) =====================
-- Şirket kendi rollerini tanımlar (Muhasebe, Satış, Satış destek, Proje, Bayi…). Kullanıcı bir rol alır;
-- rolün ekran yetkileri değişince o roldeki herkes güncellenir. "Kişiye özel" işaretli kullanıcı kendi ayarını korur.
create table if not exists public.roller (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi(),
  ad text not null, aciklama text,
  yetkiler jsonb not null default '{}'::jsonb,
  sira int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, ad)
);
create index if not exists roller_owner_idx on public.roller (owner);
alter table public.roller enable row level security;
drop policy if exists "rol_yonet" on public.roller;
create policy "rol_yonet" on public.roller for all to authenticated using (public.sirket_yetkilisi(owner)) with check (public.sirket_yetkilisi(owner));
drop policy if exists "yonetici_oku" on public.roller;
create policy "yonetici_oku" on public.roller for select to authenticated using (public.yonetici_mi());
drop trigger if exists touch on public.roller;
create trigger touch before update on public.roller for each row execute function public.touch_updated_at();

alter table public.ekip_uyeleri add column if not exists rol_id uuid references public.roller(id) on delete set null;
alter table public.ekip_uyeleri add column if not exists ozel boolean not null default false;

-- Kullanıcıya rol verilince (kişiye özel değilse) yetkileri rolden gelir
create or replace function public.uye_rolden() returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.rol_id is not null and not new.ozel then
    select r.yetkiler || jsonb_build_object('_rol', r.ad) into new.yetkiler from public.roller r where r.id = new.rol_id and r.owner = new.owner;
    if new.yetkiler is null then new.yetkiler := '{}'::jsonb; end if;
  end if;
  return new;
end $f$;
drop trigger if exists uye_rolden on public.ekip_uyeleri;
create trigger uye_rolden before insert or update on public.ekip_uyeleri for each row execute function public.uye_rolden();
-- Rol değişince o roldeki herkes güncellenir
create or replace function public.rol_yay() returns trigger language plpgsql security definer set search_path = public as $f$
begin
  update public.ekip_uyeleri set yetkiler = new.yetkiler || jsonb_build_object('_rol', new.ad)
  where rol_id = new.id and not ozel and owner = new.owner;
  return new;
end $f$;
drop trigger if exists rol_yay on public.roller;
create trigger rol_yay after insert or update on public.roller for each row execute function public.rol_yay();

-- Taşıma: rolü olmayan kullanıcıların bugünkü yetkileri role çevrilir; aynı yetkilere sahip olanlar aynı rolü paylaşır
do $$
declare u record; r_id uuid; y jsonb; ad0 text; ad1 text; n int;
begin
  for u in select * from public.ekip_uyeleri where rol_id is null and not ozel and not yonetici and yetkiler <> '{}'::jsonb order by owner, created_at loop
    y := u.yetkiler - '_rol';
    select id into r_id from public.roller where owner = u.owner and yetkiler = y limit 1;
    if r_id is null then
      ad0 := coalesce(nullif(btrim(u.yetkiler ->> '_rol'), ''), 'Rol'); ad1 := ad0; n := 1;
      while exists (select 1 from public.roller where owner = u.owner and ad = ad1) loop n := n + 1; ad1 := ad0 || ' ' || n; end loop;
      insert into public.roller (owner, ad, yetkiler) values (u.owner, ad1, y) returning id into r_id;
    end if;
    update public.ekip_uyeleri set rol_id = r_id where id = u.id;
  end loop;
end $$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 27 $f$;

-- ===================== Sürüm 28: Ekipler ve kayıt kapsamı (K3) =====================
-- Ekip ağacı (Satış → Satış Adana), ekip yöneticisi. Kayıtlarda "sorumlu" (e-posta) ve "ekip".
-- Rolün kapsamı (_kapsam): tum = şirketin bütün kayıtları, ekip = kendi ekibi ve alt ekipleri, kendi = sorumlusu olduğu kayıtlar.
-- Ekip yöneticisi, rolü ne olursa olsun ekibinin kayıtlarını görür ve düzenler. Şirket yöneticileri her şeyi görür.
create table if not exists public.ekipler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi(),
  ad text not null, ust_ekip_id uuid references public.ekipler(id) on delete set null,
  yonetici_eposta text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, ad)
);
create index if not exists ekipler_owner_idx on public.ekipler (owner);
alter table public.ekipler enable row level security;
drop policy if exists "ekip_yonet" on public.ekipler;
create policy "ekip_yonet" on public.ekipler for all to authenticated using (public.sirket_yetkilisi(owner)) with check (public.sirket_yetkilisi(owner));
drop policy if exists "ekip_oku" on public.ekipler;
create policy "ekip_oku" on public.ekipler for select to authenticated using (public.ekipte(owner::text));
drop trigger if exists touch on public.ekipler;
create trigger touch before update on public.ekipler for each row execute function public.touch_updated_at();
alter table public.ekip_uyeleri add column if not exists ekip_id uuid references public.ekipler(id) on delete set null;

-- Kayıtlara sorumlu ve ekip
do $$ declare t text; begin
  foreach t in array array['firmalar','kisiler','projeler','ziyaretler','gorevler','teklifler','siparisler','numuneler','servis_kayitlari','tahsilatlar'] loop
    execute format('alter table public.%I add column if not exists sorumlu text', t);
    execute format('alter table public.%I add column if not exists ekip_id uuid references public.ekipler(id) on delete set null', t);
    execute format('create index if not exists %I on public.%I (owner, sorumlu)', t || '_sorumlu_idx', t);
  end loop;
end $$;

-- Benim ekiplerim: üyesi olduğum ekip ve yönettiğim ekipler, alt ekipleriyle
create or replace function public.benim_ekiplerim() returns uuid[] language sql stable security definer set search_path = public as $f$
  with recursive bas as (
    select u.ekip_id as id from public.ekip_uyeleri u where u.owner = public.veri_sahibi() and u.aktif and lower(u.eposta) = public.benim_epostam() and u.ekip_id is not null
    union select e.id from public.ekipler e where e.owner = public.veri_sahibi() and lower(e.yonetici_eposta) = public.benim_epostam()
  ), agac as (
    select id from bas union select e.id from public.ekipler e join agac a on e.ust_ekip_id = a.id
  ) select coalesce(array_agg(id), '{}') from agac
$f$;
-- Yönettiğim ekipler (alt ekipleriyle): kapsamı ne olursa olsun bu ekiplerin kayıtları görünür
create or replace function public.yonettigim_ekipler() returns uuid[] language sql stable security definer set search_path = public as $f$
  with recursive agac as (
    select e.id from public.ekipler e where e.owner = public.veri_sahibi() and lower(e.yonetici_eposta) = public.benim_epostam()
    union select e.id from public.ekipler e join agac a on e.ust_ekip_id = a.id
  ) select coalesce(array_agg(id), '{}') from agac
$f$;
-- Kapsamım: şirket yetkilisi ya da üye kaydı olmayan (kendi şirketi) = tum
create or replace function public.benim_kapsamim() returns text language sql stable security definer set search_path = public as $f$
  select case when public.sirket_yetkilisi(public.veri_sahibi()) then 'tum'
    else coalesce((select nullif(u.yetkiler ->> '_kapsam', '') from public.ekip_uyeleri u where u.owner = public.veri_sahibi() and u.aktif and lower(u.eposta) = public.benim_epostam() limit 1), 'tum') end
$f$;
-- Bir kayıt kapsamımda mı (owner'ın yetki kontrolü ayrıca yapılır)
create or replace function public.kapsamda(sahip uuid, sorumlu text, ekip uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip <> public.veri_sahibi() or public.benim_kapsamim() = 'tum'
    or lower(coalesce(sorumlu, '')) = public.benim_epostam()
    or (ekip is not null and ekip = any(public.yonettigim_ekipler()))
    or (public.benim_kapsamim() = 'ekip' and ekip is not null and ekip = any(public.benim_ekiplerim()))
$f$;
revoke all on function public.kapsamda(uuid, text, uuid) from public, anon;
grant execute on function public.kapsamda(uuid, text, uuid) to authenticated;

-- Yeni kayıt: sorumlu boşsa ekleyen kişi, ekip boşsa ekleyenin ekibi
create or replace function public.kayit_sorumlu() returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.sorumlu is null or new.sorumlu = '' then new.sorumlu := nullif(public.benim_epostam(), ''); end if;
  if new.ekip_id is null then
    select u.ekip_id into new.ekip_id from public.ekip_uyeleri u where u.owner = new.owner and lower(u.eposta) = lower(new.sorumlu) and u.aktif limit 1;
  end if;
  return new;
end $f$;

do $$ declare t text; begin
  foreach t in array array['firmalar','kisiler','projeler','ziyaretler','gorevler','teklifler','siparisler','numuneler','servis_kayitlari','tahsilatlar'] loop
    execute format('drop trigger if exists kayit_sorumlu on public.%I', t);
    execute format('create trigger kayit_sorumlu before insert on public.%I for each row execute function public.kayit_sorumlu()', t);
    execute format('drop policy if exists "oku" on public.%I', t);
    execute format('drop policy if exists "ekle" on public.%I', t);
    execute format('drop policy if exists "degistir" on public.%I', t);
    execute format('drop policy if exists "sil" on public.%I', t);
    execute format('create policy "oku" on public.%I for select to authenticated using (public.yetki(owner, %L, %L) and public.kapsamda(owner, sorumlu, ekip_id))', t, t, 'oku');
    execute format('create policy "ekle" on public.%I for insert to authenticated with check (public.yetki(owner, %L, %L) and public.kapsamda(owner, sorumlu, ekip_id))', t, t, 'yaz');
    execute format('create policy "degistir" on public.%I for update to authenticated using (public.yetki(owner, %L, %L) and public.kapsamda(owner, sorumlu, ekip_id)) with check (public.yetki(owner, %L, %L) and public.kapsamda(owner, sorumlu, ekip_id))', t, t, 'yaz', t, 'yaz');
    execute format('create policy "sil" on public.%I for delete to authenticated using (public.yetki(owner, %L, %L) and public.kapsamda(owner, sorumlu, ekip_id))', t, t, 'yaz');
  end loop;
end $$;

-- Taşıma: sorumlusu boş eski kayıtlar → kaydı ilk ekleyen (değişiklik geçmişinden), bulunamazsa şirketin kurucusu
do $$ declare t text; begin
  foreach t in array array['firmalar','kisiler','projeler','ziyaretler','gorevler','teklifler','siparisler','numuneler','servis_kayitlari','tahsilatlar'] loop
    execute format($q$update public.%I x set sorumlu = coalesce(
        (select d.kim from public.degisiklikler d where d.owner = x.owner and d.tablo = %L and d.kayit_id = x.id and d.kim is not null and d.kim <> '' order by d.zaman limit 1),
        (select lower(u.email) from auth.users u where u.id = x.owner))
      where x.sorumlu is null$q$, t, t);
  end loop;
end $$;

-- Kapsam dışında kalan firmalar: yalnızca adı ve sorumlusu (aynı firmaya iki satışçı gitmesin)
create or replace function public.baska_satiscida(q text) returns table (ad text, sorumlu text, sorumlu_ad text) language sql stable security definer set search_path = public as $f$
  select f.ad, f.sorumlu, coalesce((select e.ad from public.ekip_uyeleri e where e.owner = f.owner and lower(e.eposta) = lower(f.sorumlu) limit 1), f.sorumlu)
  from public.firmalar f
  where f.owner = public.veri_sahibi() and public.ekipte(f.owner::text) and length(btrim(q)) >= 3
    and lower(f.ad) like '%' || lower(btrim(q)) || '%'
    and not public.kapsamda(f.owner, f.sorumlu, f.ekip_id)
  order by f.ad limit 5
$f$;
revoke all on function public.baska_satiscida(text) from public, anon;
grant execute on function public.baska_satiscida(text) to authenticated;

-- Kayıt devri: bir kişinin sorumlu olduğu bütün kayıtlar başka birine geçer; hedef boşsa kişinin ekip yöneticisine, o da yoksa kurucuya
create or replace function public.kayit_devret(p_kimden text, p_kime text default null) returns jsonb language plpgsql security definer set search_path = public, auth as $f$
declare s uuid := public.veri_sahibi(); hedef text := lower(nullif(btrim(coalesce(p_kime, '')), '')); t text; n int; toplam int := 0; sonuc jsonb := '{}'::jsonb;
begin
  if not public.sirket_yetkilisi(s) then raise exception 'Kayıt devrini yalnızca şirket yöneticisi yapabilir.'; end if;
  if hedef is null then
    -- kişinin ekibinden yukarı doğru ilk ekip yöneticisi
    with recursive yukari as (
      select e.id, e.ust_ekip_id, e.yonetici_eposta, 0 as d from public.ekip_uyeleri u join public.ekipler e on e.id = u.ekip_id
        where u.owner = s and lower(u.eposta) = lower(p_kimden)
      union all select e.id, e.ust_ekip_id, e.yonetici_eposta, y.d + 1 from public.ekipler e join yukari y on e.id = y.ust_ekip_id where y.d < 20
    ) select lower(yonetici_eposta) into hedef from yukari where yonetici_eposta is not null and lower(yonetici_eposta) <> lower(p_kimden) order by d limit 1;
  end if;
  if hedef is null then select lower(u.email) into hedef from auth.users u where u.id = s; end if;
  foreach t in array array['firmalar','kisiler','projeler','ziyaretler','gorevler','teklifler','siparisler','numuneler','servis_kayitlari','tahsilatlar'] loop
    execute format('update public.%I set sorumlu = $1 where owner = $2 and lower(sorumlu) = lower($3)', t) using hedef, s, p_kimden;
    get diagnostics n = row_count; toplam := toplam + n; if n > 0 then sonuc := sonuc || jsonb_build_object(t, n); end if;
  end loop;
  return jsonb_build_object('kime', hedef, 'toplam', toplam, 'tablolar', sonuc);
end $f$;
revoke all on function public.kayit_devret(text, text) from public, anon;
grant execute on function public.kayit_devret(text, text) to authenticated;
-- Firmanın sorumlusu değişince, aynı sorumluya bağlı kişileri de yeni sorumluya geçer
create or replace function public.firma_sorumlu_yay() returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.sorumlu is distinct from old.sorumlu then
    update public.kisiler set sorumlu = new.sorumlu, ekip_id = coalesce(new.ekip_id, ekip_id)
    where owner = new.owner and firma_id = new.id and (sorumlu is null or lower(sorumlu) = lower(coalesce(old.sorumlu, '')));
  end if;
  return new;
end $f$;
drop trigger if exists firma_sorumlu_yay on public.firmalar;
create trigger firma_sorumlu_yay after update of sorumlu on public.firmalar for each row execute function public.firma_sorumlu_yay();
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 28 $f$;

-- ===================== Sürüm 29: projede satış haritası (karar grubu) =====================
-- [{ kisi_id, rol, tutum, etki, not }] — rol: Onaylayan / Teknik değerlendiren / Satınalma / Etkileyici / Kullanıcı;
-- tutum: Destekliyor / Tarafsız / Bilinmiyor / Rakipçi; etki: Yüksek / Orta / Düşük
alter table public.projeler add column if not exists karar_grubu jsonb;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 29 $f$;

-- ===================== Sürüm 30: hassas alanlar sunucuda (K4) =====================
-- Rolünde "Tutar, fiyat, cari ve hedefler" ya da "Kişilerin telefon ve e-postası" gizli olan ekip üyesine bu sütunlar
-- hiç gönderilmez. Sütunların doğrudan okunması kapatılır (sütun izni); değerler yalnızca hassas_degerler()
-- üzerinden ve yalnızca görme hakkı olana döner. Gizli alanı göremeyen kişi kaydı değiştirirken o alanlar korunur.
-- Biçim: { tablo: [ { grup, kol: [...] }, ... ] }  (bir tabloda birden çok grup olabilir)
create or replace function public.hassas_kolonlar() returns jsonb language sql immutable as $f$
  select '{
    "projeler":       [{"grup": "tutar", "kol": ["tutar_usd", "siparis_tutari_usd", "bizim_teklif_usd", "rakip_birim_fiyat", "rakip_toplam_usd"]},
                       {"grup": "harita", "kol": ["karar_grubu"]}],
    "teklifler":      [{"grup": "tutar", "kol": ["kalemler", "toplam", "iskonto"]}],
    "siparisler":     [{"grup": "tutar", "kol": ["net_deger"]}],
    "urunler":        [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "stok_gecmis":    [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "hedefler":       [{"grup": "tutar", "kol": ["tutar_usd", "resmi_usd", "resmi_tl"]}],
    "rakip_fiyatlar": [{"grup": "tutar", "kol": ["birim_fiyat", "fiyat_metin"]}],
    "tahsilatlar":    [{"grup": "tutar", "kol": ["tutar", "odenen"]}],
    "kisiler":        [{"grup": "iletisim", "kol": ["telefon", "eposta", "kartvizit_on", "kartvizit_arka", "dogum_gunu"]}]
  }'::jsonb
$f$;
grant execute on function public.hassas_kolonlar() to authenticated;
-- Bir tablonun bütün hassas sütunları
create or replace function public.hassas_tum(p_tablo text) returns text[] language sql immutable as $f$
  select coalesce(array_agg(k), '{}') from jsonb_array_elements(public.hassas_kolonlar() -> p_tablo) g, jsonb_array_elements_text(g -> 'kol') k
$f$;

-- Dış kullanıcı (K5, sürüm 31): ekip üyesi kaydında dis_firma_id doluysa o kişi bir bayi ya da proje firmasındandır
alter table public.ekip_uyeleri add column if not exists dis_firma_id uuid;
create or replace function public.dis_firmam(sahip uuid) returns uuid language sql stable security definer set search_path = public as $f$
  select case when public.sirket_yetkilisi(sahip) then null else
    (select u.dis_firma_id from public.ekip_uyeleri u where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam() limit 1) end
$f$;
revoke all on function public.dis_firmam(uuid) from public, anon;
grant execute on function public.dis_firmam(uuid) to authenticated;

-- Kullanıcı bu şirketin bu gruptaki hassas alanlarını görebilir mi (kurucu ve şirket yöneticisi her zaman)
create or replace function public.hassas_acik(sahip uuid, grup text) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or exists (
    select 1 from public.ekip_uyeleri u where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam()
      and not coalesce(u.yetkiler -> '_gizli', '[]'::jsonb) ? grup
      and not (grup = 'harita' and u.dis_firma_id is not null))
$f$;
revoke all on function public.hassas_acik(uuid, text) from public, anon;
grant execute on function public.hassas_acik(uuid, text) to authenticated;

-- Sütun izinleri: hassas sütunlar dışındaki her sütun okunabilir (schema.sql her çalıştırıldığında en sonda yenilenir)
create or replace function public.hassas_izinleri_yenile() returns void language plpgsql security definer set search_path = public as $f$
declare t text; kols text;
begin
  for t in select jsonb_object_keys(public.hassas_kolonlar()) loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('revoke select on public.%I from authenticated, anon', t);
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into kols
      from information_schema.columns c where c.table_schema = 'public' and c.table_name = t and not c.column_name = any(public.hassas_tum(t));
    execute format('grant select (%s) on public.%I to authenticated', kols, t);
  end loop;
end $f$;
revoke all on function public.hassas_izinleri_yenile() from public, anon, authenticated;

-- Uygulama için: her tablonun okunabilir sütunları, hassas sütunları ve grupları
create or replace function public.hassas_semasi() returns jsonb language sql stable security definer set search_path = public as $f$
  select jsonb_object_agg(t, jsonb_build_object(
    'grup', h -> t -> 0 ->> 'grup',
    'hassas', to_jsonb(public.hassas_tum(t)),
    'gruplar', (select jsonb_object_agg(g ->> 'grup', g -> 'kol') from jsonb_array_elements(h -> t) g),
    'okunur', (select jsonb_agg(c.column_name order by c.ordinal_position) from information_schema.columns c
               where c.table_schema = 'public' and c.table_name = t and not c.column_name = any(public.hassas_tum(t)))))
  from (select public.hassas_kolonlar() h) x, jsonb_object_keys(x.h) t where to_regclass('public.' || t) is not null
$f$;
revoke all on function public.hassas_semasi() from public, anon;
grant execute on function public.hassas_semasi() to authenticated;

-- Dış kullanıcı bu kaydı görebilir mi: firmasının herhangi bir rolde yer aldığı projeler ve onlara bağlı kayıtlar,
-- firmanın kendisi ve kişileri, ürün ve stok. İç kullanıcı için her zaman evet.
create or replace function public.dis_proje(p uuid, f uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select p is not null and exists (select 1 from public.projeler x where x.id = p and f in (x.yatirimci_id, x.projeci_id, x.danisman_id, x.gemut_id, x.emut_id, x.alici_id, x.bayi_id))
$f$;
create or replace function public.dis_uygun(sahip uuid, tablo text, kayit uuid) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare f uuid := public.dis_firmam(sahip);
begin
  if f is null then return true; end if;
  case tablo
    when 'projeler' then return public.dis_proje(kayit, f);
    when 'firmalar' then return kayit = f;
    when 'kisiler' then return exists (select 1 from public.kisiler k where k.id = kayit and k.firma_id = f);
    when 'proje_gecmis' then return exists (select 1 from public.proje_gecmis g where g.id = kayit and public.dis_proje(g.proje_id, f));
    when 'teklifler' then return exists (select 1 from public.teklifler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'siparisler' then return exists (select 1 from public.siparisler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'numuneler' then return exists (select 1 from public.numuneler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'servis_kayitlari' then return exists (select 1 from public.servis_kayitlari x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'tahsilatlar' then return exists (select 1 from public.tahsilatlar x where x.id = kayit and x.firma_id = f);
    when 'belgeler' then return exists (select 1 from public.belgeler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'urunler', 'stok_gecmis', 'urun_aileleri' then return true;
    else return false;   -- ziyaretler, görevler, masraflar, hedefler, rakip fiyatları, bölgeler: dış kullanıcıya kapalı
  end case;
end $f$;
revoke all on function public.dis_uygun(uuid, text, uuid) from public, anon;
grant execute on function public.dis_uygun(uuid, text, uuid) to authenticated;
-- Dış kullanıcının kapsamı: rolündeki "Kendi / Ekibi" yerine dis_uygun karar verir
create or replace function public.kapsamda(sahip uuid, sorumlu text, ekip uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select sahip <> public.veri_sahibi() or public.benim_kapsamim() = 'tum'
    or lower(coalesce(sorumlu, '')) = public.benim_epostam()
    or (ekip is not null and ekip = any(public.yonettigim_ekipler()))
    or (public.benim_kapsamim() = 'ekip' and ekip is not null and ekip = any(public.benim_ekiplerim()))
    or public.dis_firmam(sahip) is not null
$f$;
-- Kısıtlayıcı kural: diğer kurallara ek olarak (VE) uygulanır
do $$ declare t text; begin
  foreach t in array array['firmalar','kisiler','projeler','proje_gecmis','ziyaretler','gorevler','urunler','stok_gecmis','rakip_fiyatlar','siparisler',
                           'hedefler','bolgeler','teklifler','numuneler','servis_kayitlari','masraflar','urun_aileleri','tahsilatlar','belgeler'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists "dis_oku" on public.%I', t);
    execute format('drop policy if exists "dis_degistir" on public.%I', t);
    execute format('drop policy if exists "dis_sil" on public.%I', t);
    execute format('create policy "dis_oku" on public.%I as restrictive for select to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_degistir" on public.%I as restrictive for update to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_sil" on public.%I as restrictive for delete to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
  end loop;
end $$;

-- Hassas değerler: yalnızca görebildiği kayıtlar (okuma yetkisi, kapsam, dış kullanıcı kuralı) ve açık gruplar
create or replace function public.hassas_degerler(p_tablo text, p_sonra timestamptz default null, p_idler uuid[] default null)
returns table(id uuid, deger jsonb) language plpgsql stable security definer set search_path = public as $f$
declare h jsonb := public.hassas_kolonlar() -> p_tablo; kosul text; secim text; herhangi text;
begin
  if h is null then return; end if;
  select string_agg(format('%L, case when public.hassas_acik(t.owner, %L) then to_jsonb(t.%I) end', k, g ->> 'grup', k), ', '),
         string_agg(distinct format('public.hassas_acik(t.owner, %L)', g ->> 'grup'), ' or ')
    into secim, herhangi from jsonb_array_elements(h) g, jsonb_array_elements_text(g -> 'kol') k;
  kosul := format('public.yetki(t.owner, %L, %L) and public.dis_uygun(t.owner, %L, t.id) and (%s)', p_tablo, 'oku', p_tablo, herhangi);
  if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_tablo and c.column_name = 'sorumlu') then
    kosul := kosul || ' and public.kapsamda(t.owner, t.sorumlu, t.ekip_id)'; end if;
  if p_sonra is not null and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_tablo and c.column_name = 'updated_at') then
    kosul := kosul || format(' and t.updated_at > %L', p_sonra); end if;
  if p_idler is not null then kosul := kosul || format(' and t.id = any(%L::uuid[])', p_idler); end if;
  return query execute format('select t.id, jsonb_strip_nulls(jsonb_build_object(%s)) from public.%I t where %s', secim, p_tablo, kosul);
end $f$;
revoke all on function public.hassas_degerler(text, timestamptz, uuid[]) from public, anon;
grant execute on function public.hassas_degerler(text, timestamptz, uuid[]) to authenticated;

-- Göremeyen kişi kaydı güncellerken o gruptaki hassas alanlar eski değerinde kalır
create or replace function public.hassas_koru() returns trigger language plpgsql security definer set search_path = public as $f$
declare g jsonb;
begin
  if auth.uid() is null then return new; end if;
  for g in select * from jsonb_array_elements(coalesce(public.hassas_kolonlar() -> tg_table_name, '[]')) loop
    if not public.hassas_acik(new.owner, g ->> 'grup') then
      new := jsonb_populate_record(new, (select jsonb_object_agg(k, to_jsonb(old) -> k) from jsonb_array_elements_text(g -> 'kol') k));
    end if;
  end loop;
  return new;
end $f$;
do $$ declare t text; begin
  for t in select jsonb_object_keys(public.hassas_kolonlar()) loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists hassas_koru on public.%I', t);
    execute format('create trigger hassas_koru before update on public.%I for each row execute function public.hassas_koru()', t);
  end loop;
end $$;

-- Kaydetme: hassas sütunu olan tablolarda "upsert" (ON CONFLICT DO UPDATE ... = excluded.x) sütunu okuma izni ister.
-- Bu fonksiyon çağıranın yetkisiyle çalışır (RLS ve sütun izinleri aynen geçerli): önce günceller, kayıt yoksa ekler.
create or replace function public.kaydet_toplu(p_tablo text, p_satirlar jsonb)
returns table(id uuid, updated_at timestamptz) language plpgsql security invoker set search_path = public as $f$
declare r jsonb; kols text; n int; var_upd boolean;
begin
  if public.hassas_kolonlar() -> p_tablo is null then raise exception 'kaydet_toplu: % desteklenmiyor', p_tablo; end if;
  var_upd := exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_tablo and c.column_name = 'updated_at');
  for r in select * from jsonb_array_elements(case when jsonb_typeof(p_satirlar) = 'array' then p_satirlar else jsonb_build_array(p_satirlar) end) loop
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into kols
      from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_tablo and r ? c.column_name and c.column_name <> 'id';
    n := 0;
    if kols is not null then
      execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where t.id = ($1 ->> ''id'')::uuid', p_tablo, kols, kols, p_tablo) using r;
      get diagnostics n = row_count;
    end if;
    if n = 0 then
      execute format('insert into public.%I (id%s) select id%s from jsonb_populate_record(null::public.%I, $1)', p_tablo, coalesce(', ' || kols, ''), coalesce(', ' || kols, ''), p_tablo) using r;
    end if;
    if var_upd then return query execute format('select t.id, t.updated_at from public.%I t where t.id = ($1 ->> ''id'')::uuid', p_tablo) using r;
    else id := (r ->> 'id')::uuid; updated_at := null; return next; end if;
  end loop;
end $f$;
revoke all on function public.kaydet_toplu(text, jsonb) from public, anon;
grant execute on function public.kaydet_toplu(text, jsonb) to authenticated;

-- Uygulamaya: kullanıcı dış kullanıcıysa firması (benim_yetkilerim'e ek)
create or replace function public.dis_bilgim() returns jsonb language sql stable security definer set search_path = public as $f$
  select case when public.dis_firmam(public.veri_sahibi()) is null then null
    else jsonb_build_object('firma_id', public.dis_firmam(public.veri_sahibi()), 'firma_ad', (select f.ad from public.firmalar f where f.id = public.dis_firmam(public.veri_sahibi()))) end
$f$;
revoke all on function public.dis_bilgim() from public, anon;
grant execute on function public.dis_bilgim() to authenticated;
-- ===================== Sürüm 32: çok şirketli kişi — şirketler arası geçiş (K5) =====================
-- Aynı e-postayla birden fazla şirketin ekibinde olan kişi çalışacağı şirketi seçer; seçim kişiye özel saklanır.
create table if not exists public.secili_sirket (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  owner uuid not null, updated_at timestamptz default now()
);
alter table public.secili_sirket enable row level security;
drop policy if exists "kendi_secimim" on public.secili_sirket;
create policy "kendi_secimim" on public.secili_sirket for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Bu şirkete erişimim var mı: kurucusu (ayrılmadıysa), yöneticisi ya da aktif üyesi
create or replace function public.sirkete_erisim(sahip uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or exists (select 1 from public.ekip_uyeleri u where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam())
$f$;
revoke all on function public.sirkete_erisim(uuid) from public, anon;
grant execute on function public.sirkete_erisim(uuid) to authenticated;
-- Çalıştığım şirket: önce seçtiğim (hâlâ erişimim varsa), sonra eski kural
create or replace function public.veri_sahibi() returns uuid language sql stable security definer set search_path = public as $f$
  select coalesce(
    (select s.owner from public.secili_sirket s where s.user_id = auth.uid() and public.sirkete_erisim(s.owner)),
    (select u.owner from public.ekip_uyeleri u where u.aktif and u.yonetici and lower(u.eposta) = public.benim_epostam() and u.owner <> auth.uid() order by u.created_at limit 1),
    (select u.owner from public.ekip_uyeleri u where u.aktif and lower(u.eposta) = public.benim_epostam() and u.owner <> auth.uid() order by u.created_at limit 1),
    auth.uid())
$f$;
-- Erişebildiğim şirketler (geçiş listesi)
create or replace function public.sirketlerim() returns jsonb language sql stable security definer set search_path = public, auth as $f$
  with s as (
    select auth.uid() as owner where public.sirket_yetkilisi(auth.uid()) and exists (select 1 from public.hesaplar h where h.owner = auth.uid())
    union select u.owner from public.ekip_uyeleri u where u.aktif and lower(u.eposta) = public.benim_epostam()
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'owner', s.owner,
    'ad', coalesce((select h.firma from public.hesaplar h where h.owner = s.owner), (select lower(x.email) from auth.users x where x.id = s.owner)),
    'rol', case when s.owner = auth.uid() then 'Kurucu' when public.sirket_yetkilisi(s.owner) then 'Şirket yöneticisi'
               when (select u.dis_firma_id from public.ekip_uyeleri u where u.owner = s.owner and lower(u.eposta) = public.benim_epostam() limit 1) is not null then 'Dış kullanıcı'
               else coalesce((select nullif(u.yetkiler ->> '_rol', '') from public.ekip_uyeleri u where u.owner = s.owner and lower(u.eposta) = public.benim_epostam() limit 1), 'Ekip üyesi') end,
    'secili', s.owner = public.veri_sahibi()) order by (s.owner = public.veri_sahibi()) desc), '[]'::jsonb)
  from s
$f$;
revoke all on function public.sirketlerim() from public, anon;
grant execute on function public.sirketlerim() to authenticated;
create or replace function public.sirket_sec(p_owner uuid) returns void language plpgsql security definer set search_path = public as $f$
begin
  if p_owner <> auth.uid() and not public.sirkete_erisim(p_owner) then raise exception 'Bu şirkete erişimin yok.'; end if;
  insert into public.secili_sirket (user_id, owner) values (auth.uid(), p_owner)
  on conflict (user_id) do update set owner = excluded.owner, updated_at = now();
end $f$;
revoke all on function public.sirket_sec(uuid) from public, anon;
grant execute on function public.sirket_sec(uuid) to authenticated;
-- Kapsam her şirket için ayrı hesaplanır (önceden yalnızca çalışılan şirket için)
create or replace function public.kapsam_of(sahip uuid) returns text language sql stable security definer set search_path = public as $f$
  select case when public.sirket_yetkilisi(sahip) then 'tum'
    else coalesce((select nullif(u.yetkiler ->> '_kapsam', '') from public.ekip_uyeleri u where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam() limit 1), 'tum') end
$f$;
create or replace function public.ekiplerim_of(sahip uuid) returns uuid[] language sql stable security definer set search_path = public as $f$
  with recursive bas as (
    select u.ekip_id as id from public.ekip_uyeleri u where u.owner = sahip and u.aktif and lower(u.eposta) = public.benim_epostam() and u.ekip_id is not null
    union select e.id from public.ekipler e where e.owner = sahip and lower(e.yonetici_eposta) = public.benim_epostam()
  ), agac as (select id from bas union select e.id from public.ekipler e join agac a on e.ust_ekip_id = a.id)
  select coalesce(array_agg(id), '{}') from agac
$f$;
create or replace function public.yonettigim_of(sahip uuid) returns uuid[] language sql stable security definer set search_path = public as $f$
  with recursive agac as (
    select e.id from public.ekipler e where e.owner = sahip and lower(e.yonetici_eposta) = public.benim_epostam()
    union select e.id from public.ekipler e join agac a on e.ust_ekip_id = a.id
  ) select coalesce(array_agg(id), '{}') from agac
$f$;
create or replace function public.kapsamda(sahip uuid, sorumlu text, ekip uuid) returns boolean language sql stable security definer set search_path = public as $f$
  select public.kapsam_of(sahip) = 'tum'
    or lower(coalesce(sorumlu, '')) = public.benim_epostam()
    or (ekip is not null and ekip = any(public.yonettigim_of(sahip)))
    or (public.kapsam_of(sahip) = 'ekip' and ekip is not null and ekip = any(public.ekiplerim_of(sahip)))
    or public.dis_firmam(sahip) is not null
$f$;
revoke all on function public.kapsamda(uuid, text, uuid) from public, anon;
grant execute on function public.kapsamda(uuid, text, uuid) to authenticated;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 32 $f$;

-- ===================== Sürüm 33: ziyarette giriş-çıkış =====================
-- giris / cikis: zaman damgası; giris_mesafe: girişte firmanın kayıtlı konumuna uzaklık (metre); giriş konumu lat/lng'de
alter table public.ziyaretler add column if not exists giris timestamptz;
alter table public.ziyaretler add column if not exists cikis timestamptz;
alter table public.ziyaretler add column if not exists giris_mesafe numeric;
alter table public.ziyaretler add column if not exists cikis_lat double precision;
alter table public.ziyaretler add column if not exists cikis_lng double precision;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 33 $f$;

-- ===================== Sürüm 34: yinelenen görevler ve otomasyon =====================
-- tekrar: gun / hafta / 2hafta / ay / 3ay / yil — tamamlanınca uygulama bir sonrakini açar
-- kaynak: otomatik ya da tekrarlanan görevin anahtarı (ör. oto:teklif_sure:<id>, tekrar:<ilk görev>) — aynı görev iki kez açılmasın
alter table public.gorevler add column if not exists tekrar text;
alter table public.gorevler add column if not exists kaynak text;
create index if not exists gorevler_kaynak on public.gorevler (owner, kaynak) where kaynak is not null;
-- Otomasyon kuralları şirket ayarıdır: ekip de okur
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil', 'cift_farkli', 'otomasyon', 'oto_silinen')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 34 $f$;

-- ===================== Sürüm 35: teklif onay bağlantısı =====================
-- Teklif müşteriye bağlantıyla gider. Bağlantı oluşturulurken teklifin müşteriye gösterilecek hali (icerik) donmuş kopya olarak
-- saklanır; müşteri teklifler tablosuna hiç erişmez. Anahtar 32+ karakterlik rastgele dizgedir; iptal edilebilir, son tarihi vardır.
-- Müşteri (giriş yapmadan) yalnızca iki işlev çağırabilir: teklif_goster ve teklif_yanitla.
create table if not exists public.teklif_baglantilari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi() references auth.users(id) on delete cascade,
  teklif_id uuid not null references public.teklifler(id) on delete cascade,
  anahtar text not null unique check (length(anahtar) >= 32),
  son_tarih date, iptal boolean not null default false,
  icerik jsonb not null default '{}',
  olusturan text default public.benim_epostam(),
  acilma int not null default 0, ilk_acilma timestamptz, son_acilma timestamptz,
  yanit text check (yanit in ('Onay', 'Revize')), yanit_not text, yanit_ad text, yanit_zaman timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.teklif_baglantilari enable row level security;
create index if not exists teklif_baglantilari_owner_idx on public.teklif_baglantilari (owner);
create index if not exists teklif_baglantilari_teklif_idx on public.teklif_baglantilari (teklif_id);
drop trigger if exists touch on public.teklif_baglantilari;
create trigger touch before update on public.teklif_baglantilari for each row execute function public.touch_updated_at();
-- Ekipte teklifleri gören ve tutarları görebilen okur; teklif yazabilen oluşturur ve iptal eder
drop policy if exists "oku" on public.teklif_baglantilari;
drop policy if exists "ekle" on public.teklif_baglantilari;
drop policy if exists "degistir" on public.teklif_baglantilari;
drop policy if exists "sil" on public.teklif_baglantilari;
create policy "oku" on public.teklif_baglantilari for select to authenticated using (public.yetki(owner, 'teklifler', 'oku') and public.hassas_acik(owner, 'tutar'));
create policy "ekle" on public.teklif_baglantilari for insert to authenticated with check (public.yetki(owner, 'teklifler', 'yaz') and public.hassas_acik(owner, 'tutar'));
create policy "degistir" on public.teklif_baglantilari for update to authenticated using (public.yetki(owner, 'teklifler', 'yaz')) with check (public.yetki(owner, 'teklifler', 'yaz'));
create policy "sil" on public.teklif_baglantilari for delete to authenticated using (public.yetki(owner, 'teklifler', 'yaz'));
revoke all on public.teklif_baglantilari from anon;

-- Müşteri teklifi açar: geçerli bağlantıysa donmuş kopyayı döndürür ve açılmayı sayar
create or replace function public.teklif_goster(p_anahtar text) returns jsonb language plpgsql security definer set search_path = public as $f$
declare b public.teklif_baglantilari;
begin
  if p_anahtar is null or length(p_anahtar) < 32 then return jsonb_build_object('hata', 'gecersiz'); end if;
  select * into b from public.teklif_baglantilari where anahtar = p_anahtar;
  if not found then return jsonb_build_object('hata', 'gecersiz'); end if;
  if b.iptal then return jsonb_build_object('hata', 'iptal'); end if;
  if b.son_tarih is not null and b.son_tarih < current_date and b.yanit is null then return jsonb_build_object('hata', 'sure', 'son_tarih', b.son_tarih, 'gonderen', b.icerik -> 'gonderen'); end if;
  update public.teklif_baglantilari set acilma = acilma + 1, ilk_acilma = coalesce(ilk_acilma, now()), son_acilma = now() where id = b.id;
  return b.icerik || jsonb_build_object('son_tarih', b.son_tarih, 'yanit', b.yanit, 'yanit_zaman', b.yanit_zaman, 'yanit_ad', b.yanit_ad);
end $f$;
revoke all on function public.teklif_goster(text) from public;
grant execute on function public.teklif_goster(text) to anon, authenticated;

-- Müşteri yanıtlar: Onay → teklif Kabul olur. Onayda da revizede de bağlantıyı oluşturana görev açılır (notu ve adıyla).
-- Teklifin kendi notlarına yazılmaz (notlar PDF'te müşteriye görünür).
create or replace function public.teklif_yanitla(p_anahtar text, p_yanit text, p_not text default null, p_ad text default null) returns jsonb language plpgsql security definer set search_path = public as $f$
declare b public.teklif_baglantilari; t public.teklifler; v_baslik text;
begin
  if p_yanit not in ('Onay', 'Revize') then return jsonb_build_object('hata', 'gecersiz'); end if;
  select * into b from public.teklif_baglantilari where anahtar = p_anahtar and length(p_anahtar) >= 32 for update;
  if not found or b.iptal then return jsonb_build_object('hata', 'gecersiz'); end if;
  if b.son_tarih is not null and b.son_tarih < current_date then return jsonb_build_object('hata', 'sure'); end if;
  if b.yanit is not null then return jsonb_build_object('hata', 'yanitlandi', 'yanit', b.yanit); end if;
  update public.teklif_baglantilari set yanit = p_yanit, yanit_not = left(nullif(trim(p_not), ''), 2000), yanit_ad = left(nullif(trim(p_ad), ''), 120), yanit_zaman = now() where id = b.id;
  select * into t from public.teklifler where id = b.teklif_id;
  if found then
    if p_yanit = 'Onay' then
      update public.teklifler set durum = 'Kabul' where id = t.id;
      v_baslik := 'Teklif onaylandı: ' || coalesce(t.teklif_no, '') || ' · siparişi takip et';
    else
      v_baslik := 'Revize istendi: ' || coalesce(t.teklif_no, '');
    end if;
    insert into public.gorevler (owner, baslik, son_tarih, oncelik, durum, firma_id, proje_id, kisi_id, notlar, atanan, sorumlu, ekip_id, kaynak)
    values (b.owner, v_baslik, current_date, 'Yüksek', 'Açık', t.firma_id, t.proje_id, t.kisi_id,
      nullif(concat_ws(E'\n', case when p_ad is not null and trim(p_ad) <> '' then 'Yanıtlayan: ' || left(trim(p_ad), 120) end, left(nullif(trim(p_not), ''), 2000)), ''),
      b.olusturan, t.sorumlu, t.ekip_id, 'baglanti:' || b.id);
    insert into public.degisiklikler (owner, tablo, kayit_id, islem, kim, ozet)
    values (b.owner, 'teklifler', t.id, 'UPDATE', 'Müşteri (onay bağlantısı)', case when p_yanit = 'Onay' then 'Teklif bağlantıdan onaylandı' else 'Bağlantıdan revize istendi' end);
  end if;
  return jsonb_build_object('tamam', true, 'yanit', p_yanit);
end $f$;
revoke all on function public.teklif_yanitla(text, text, text, text) from public;
grant execute on function public.teklif_yanitla(text, text, text, text) to anon, authenticated;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 35 $f$;

-- ===================== Sürüm 36: bayi portalı (dış kullanıcı talepleri) =====================
-- Dış kullanıcı (bayi ya da proje firması) yeni proje bildirir, teklif ister, stok sorar. Talep firmasına bağlanır;
-- dış kullanıcı yalnızca kendi firmasının taleplerini görür. Her yeni talep şirkete görev olarak düşer.
create table if not exists public.bayi_talepleri (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi() references auth.users(id) on delete cascade,
  dis_firma_id uuid references public.firmalar(id) on delete set null,
  tur text not null default 'Yeni proje' check (tur in ('Yeni proje', 'Teklif isteği', 'Stok sorusu', 'Diğer')),
  baslik text not null, aciklama text,
  proje_id uuid references public.projeler(id) on delete set null,
  il text, ilce text, muteahhit text, tahmini_tutar numeric, beklenen_tarih date,
  urun text, adet numeric,
  durum text not null default 'Yeni' check (durum in ('Yeni', 'İnceleniyor', 'Yanıtlandı', 'Projeye dönüştü', 'Kapandı')),
  yanit text, yanit_zaman timestamptz, yanitlayan text,
  acan text default public.benim_epostam(), acan_ad text,
  sonuc_proje_id uuid, sonuc_teklif_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.bayi_talepleri enable row level security;
create index if not exists bayi_talepleri_owner_idx on public.bayi_talepleri (owner, durum);
drop trigger if exists touch on public.bayi_talepleri;
create trigger touch before update on public.bayi_talepleri for each row execute function public.touch_updated_at();

-- Dış kullanıcının talebi her zaman kendi firmasına bağlanır; durumu ve yanıtı o değiştiremez
create or replace function public.talep_hazirla() returns trigger language plpgsql security definer set search_path = public as $f$
declare f uuid := public.dis_firmam(new.owner);
begin
  if f is not null then
    new.dis_firma_id := f;
    if tg_op = 'INSERT' then
      new.durum := 'Yeni'; new.yanit := null; new.yanit_zaman := null; new.yanitlayan := null; new.sonuc_proje_id := null; new.sonuc_teklif_id := null;
      new.acan := public.benim_epostam();
      if new.proje_id is not null and not public.dis_proje(new.proje_id, f) then new.proje_id := null; end if;
    end if;
  elsif tg_op = 'UPDATE' and new.yanit is distinct from old.yanit then
    new.yanit_zaman := now(); new.yanitlayan := public.benim_epostam();
  end if;
  return new;
end $f$;
drop trigger if exists talep_hazirla on public.bayi_talepleri;
create trigger talep_hazirla before insert or update on public.bayi_talepleri for each row execute function public.talep_hazirla();

-- Yeni talep şirkete görev olarak düşer: firmanın sorumlusuna (yoksa atanmamış)
create or replace function public.talep_gorev() returns trigger language plpgsql security definer set search_path = public as $f$
declare fa text; so text; ek uuid;
begin
  select ad, sorumlu, ekip_id into fa, so, ek from public.firmalar where id = new.dis_firma_id;
  insert into public.gorevler (owner, baslik, son_tarih, oncelik, durum, firma_id, proje_id, notlar, atanan, sorumlu, ekip_id, kaynak)
  values (new.owner, 'Bayi talebi · ' || new.tur || ': ' || left(new.baslik, 120) || coalesce(' (' || fa || ')', ''),
    current_date + case when new.tur = 'Teklif isteği' then 1 else 2 end, case when new.tur = 'Teklif isteği' then 'Yüksek' else 'Normal' end, 'Açık',
    new.dis_firma_id, new.proje_id, left(new.aciklama, 2000), so, so, ek, 'talep:' || new.id);
  return null;
end $f$;
drop trigger if exists talep_gorev on public.bayi_talepleri;
create trigger talep_gorev after insert on public.bayi_talepleri for each row when (new.dis_firma_id is not null) execute function public.talep_gorev();

drop policy if exists "oku" on public.bayi_talepleri;
drop policy if exists "ekle" on public.bayi_talepleri;
drop policy if exists "degistir" on public.bayi_talepleri;
drop policy if exists "sil" on public.bayi_talepleri;
-- İç kullanıcı: projeleri görebilen okur, projeleri yazabilen yanıtlar. Dış kullanıcı: yalnızca kendi firmasının talepleri.
create policy "oku" on public.bayi_talepleri for select to authenticated using (
  case when public.dis_firmam(owner) is not null then dis_firma_id = public.dis_firmam(owner) else public.yetki(owner, 'projeler', 'oku') end);
create policy "ekle" on public.bayi_talepleri for insert to authenticated with check (
  owner = public.veri_sahibi() and (public.dis_firmam(owner) is not null or public.yetki(owner, 'projeler', 'yaz')));
create policy "degistir" on public.bayi_talepleri for update to authenticated using (public.dis_firmam(owner) is null and public.yetki(owner, 'projeler', 'yaz'))
  with check (public.dis_firmam(owner) is null and public.yetki(owner, 'projeler', 'yaz'));
create policy "sil" on public.bayi_talepleri for delete to authenticated using (
  (public.dis_firmam(owner) is null and public.yetki(owner, 'projeler', 'yaz'))
  or (dis_firma_id = public.dis_firmam(owner) and durum = 'Yeni' and acan = public.benim_epostam()));
revoke all on public.bayi_talepleri from anon;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 36 $f$;

-- ===================== Sürüm 37: kullanıcı adı ve şifreyle hesap =====================
-- "kullanici" Edge Function'ı şirket yetkilisinin isteğiyle ekip üyesine hesap açar ve şifresini sıfırlar.
-- Bunun için hesabın kimliğini e-postasından bulur; bu işlev yalnızca sunucu tarafında (service_role) çağrılabilir,
-- uygulamadan çağrılamaz.
create or replace function public.kullanici_kimligi(p_eposta text) returns uuid language sql stable security definer set search_path = public, auth as $f$
  select id from auth.users where lower(email) = lower(trim(p_eposta)) limit 1
$f$;
revoke all on function public.kullanici_kimligi(text) from public, anon, authenticated;
grant execute on function public.kullanici_kimligi(text) to service_role;
-- Ekip listesinde "henüz giriş yapmadı" ile "kullanıcı adı yok" ayrımı için: şirket yetkilisi, üyelerinin hesabı var mı görür
create or replace function public.uye_hesaplari(p_sahip uuid) returns table (eposta text, hesap_var boolean, son_giris timestamptz, kad text) language sql stable security definer set search_path = public, auth as $f$
  select lower(e.eposta), u.id is not null, u.last_sign_in_at, k.ad
  from public.ekip_uyeleri e
  left join auth.users u on lower(u.email) = lower(e.eposta)
  left join public.kullanici_adlari k on lower(k.eposta) = lower(e.eposta)
  where e.owner = p_sahip and public.sirket_yetkilisi(p_sahip)
$f$;
revoke all on function public.uye_hesaplari(uuid) from public, anon;
grant execute on function public.uye_hesaplari(uuid) to authenticated;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 37 $f$;

-- ---------- Sürüm 38: Finans (tahsilat kaydının türü: fatura / ödeme / iade) ----------
alter table public.tahsilatlar add column if not exists tur text default 'Fatura';
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 38 $f$;

-- ---------- Sürüm 39: Bayi ve partner ağı (atama kartı), siparişte bayi ----------
create table if not exists public.bayiler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,
  tur text default 'Bayi', il text, bolge text, sorumlu text, baslangic date, bitis date, durum text default 'Aktif',
  iskonto numeric, vade_gun int, kredi_limiti numeric, para_birimi text default 'USD', hedef_yil numeric, depo text, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, firma_id)
);
alter table public.siparisler add column if not exists bayi_id uuid references public.firmalar(id) on delete set null;
do $$ declare t text; begin
  foreach t in array array['bayiler'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "oku" on public.%I', t);
    execute format('drop policy if exists "ekle" on public.%I', t);
    execute format('drop policy if exists "degistir" on public.%I', t);
    execute format('drop policy if exists "sil" on public.%I', t);
    execute format('create policy "oku" on public.%I for select to authenticated using (public.yetki(owner, %L, %L))', t, t, 'oku');
    execute format('create policy "ekle" on public.%I for insert to authenticated with check (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('create policy "degistir" on public.%I for update to authenticated using (public.yetki(owner, %L, %L)) with check (public.yetki(owner, %L, %L))', t, t, 'yaz', t, 'yaz');
    execute format('create policy "sil" on public.%I for delete to authenticated using (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('alter table public.%I alter column owner set default public.veri_sahibi()', t);
    execute format('create index if not exists %I on public.%I (owner)', t || '_owner_idx', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('drop policy if exists "yonetici_oku" on public.%I', t);
    execute format('create policy "yonetici_oku" on public.%I for select to authenticated using (public.yonetici_mi())', t);
    execute format('drop policy if exists "dis_oku" on public.%I', t);
    execute format('drop policy if exists "dis_degistir" on public.%I', t);
    execute format('drop policy if exists "dis_sil" on public.%I', t);
    execute format('create policy "dis_oku" on public.%I as restrictive for select to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_degistir" on public.%I as restrictive for update to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_sil" on public.%I as restrictive for delete to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
  end loop;
end $$;
-- Dış kullanıcı (bayi): kendi bayi kaydını görür (koşulları, hedefi)
create or replace function public.dis_uygun(sahip uuid, tablo text, kayit uuid) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare f uuid := public.dis_firmam(sahip);
begin
  if f is null then return true; end if;
  case tablo
    when 'projeler' then return public.dis_proje(kayit, f);
    when 'firmalar' then return kayit = f;
    when 'kisiler' then return exists (select 1 from public.kisiler k where k.id = kayit and k.firma_id = f);
    when 'proje_gecmis' then return exists (select 1 from public.proje_gecmis g where g.id = kayit and public.dis_proje(g.proje_id, f));
    when 'teklifler' then return exists (select 1 from public.teklifler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'siparisler' then return exists (select 1 from public.siparisler x where x.id = kayit and (x.firma_id = f or x.bayi_id = f or public.dis_proje(x.proje_id, f)));
    when 'numuneler' then return exists (select 1 from public.numuneler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'servis_kayitlari' then return exists (select 1 from public.servis_kayitlari x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'tahsilatlar' then return exists (select 1 from public.tahsilatlar x where x.id = kayit and x.firma_id = f);
    when 'belgeler' then return exists (select 1 from public.belgeler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'urunler', 'stok_gecmis', 'urun_aileleri' then return true;
    when 'bayiler' then return exists (select 1 from public.bayiler x where x.id = kayit and x.firma_id = f);
    else return false;
  end case;
end $f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 39 $f$;

-- ---------- Sürüm 40: Plan ve gerçekleşen (planlı ziyaret işareti, yapılmama nedeni) ----------
alter table public.ziyaretler add column if not exists planli boolean;
alter table public.ziyaretler add column if not exists mazeret text;
-- Eski kayıtlar: hâlâ "Planlandı" olanlar planlıdır
update public.ziyaretler set planli = true where planli is null and durum = 'Planlandı';
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 40 $f$;

-- ---------- Sürüm 41: Bayi stokları ve bayinin sattıkları (sell-out) ----------
create table if not exists public.bayi_stok (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,
  kod text not null, aciklama text, adet numeric default 0, birim_fiyat numeric, son_hareket date, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner, firma_id, kod)
);
create table if not exists public.bayi_satis (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,
  tarih date default current_date, kod text, urun text, adet numeric, tutar numeric, para_birimi text default 'USD',
  musteri text, proje_id uuid references public.projeler(id) on delete set null, il text, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists bayi_satis_firma_idx on public.bayi_satis (firma_id, tarih);
do $$ declare t text; begin
  foreach t in array array['bayi_stok','bayi_satis'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "oku" on public.%I', t);
    execute format('drop policy if exists "ekle" on public.%I', t);
    execute format('drop policy if exists "degistir" on public.%I', t);
    execute format('drop policy if exists "sil" on public.%I', t);
    execute format('create policy "oku" on public.%I for select to authenticated using (public.yetki(owner, %L, %L))', t, t, 'oku');
    execute format('create policy "ekle" on public.%I for insert to authenticated with check (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('create policy "degistir" on public.%I for update to authenticated using (public.yetki(owner, %L, %L)) with check (public.yetki(owner, %L, %L))', t, t, 'yaz', t, 'yaz');
    execute format('create policy "sil" on public.%I for delete to authenticated using (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('alter table public.%I alter column owner set default public.veri_sahibi()', t);
    execute format('create index if not exists %I on public.%I (owner)', t || '_owner_idx', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('drop policy if exists "yonetici_oku" on public.%I', t);
    execute format('create policy "yonetici_oku" on public.%I for select to authenticated using (public.yonetici_mi())', t);
    execute format('drop policy if exists "dis_oku" on public.%I', t);
    execute format('drop policy if exists "dis_degistir" on public.%I', t);
    execute format('drop policy if exists "dis_sil" on public.%I', t);
    execute format('drop policy if exists "dis_ekle" on public.%I', t);
    execute format('create policy "dis_ekle" on public.%I as restrictive for insert to authenticated with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner))', t);
    execute format('create policy "dis_oku" on public.%I as restrictive for select to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_degistir" on public.%I as restrictive for update to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_sil" on public.%I as restrictive for delete to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
  end loop;
end $$;
-- Dış kullanıcı (bayi) yalnızca kendi stoğunu ve satış bildirimlerini görür, ekler, değiştirir
create or replace function public.dis_uygun(sahip uuid, tablo text, kayit uuid) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare f uuid := public.dis_firmam(sahip);
begin
  if f is null then return true; end if;
  case tablo
    when 'projeler' then return public.dis_proje(kayit, f);
    when 'firmalar' then return kayit = f;
    when 'kisiler' then return exists (select 1 from public.kisiler k where k.id = kayit and k.firma_id = f);
    when 'proje_gecmis' then return exists (select 1 from public.proje_gecmis g where g.id = kayit and public.dis_proje(g.proje_id, f));
    when 'teklifler' then return exists (select 1 from public.teklifler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'siparisler' then return exists (select 1 from public.siparisler x where x.id = kayit and (x.firma_id = f or x.bayi_id = f or public.dis_proje(x.proje_id, f)));
    when 'numuneler' then return exists (select 1 from public.numuneler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'servis_kayitlari' then return exists (select 1 from public.servis_kayitlari x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'tahsilatlar' then return exists (select 1 from public.tahsilatlar x where x.id = kayit and x.firma_id = f);
    when 'belgeler' then return exists (select 1 from public.belgeler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'urunler', 'stok_gecmis', 'urun_aileleri' then return true;
    when 'bayi_stok' then return exists (select 1 from public.bayi_stok x where x.id = kayit and x.firma_id = f);
    when 'bayi_satis' then return exists (select 1 from public.bayi_satis x where x.id = kayit and x.firma_id = f);
    when 'bayiler' then return exists (select 1 from public.bayiler x where x.id = kayit and x.firma_id = f);
    else return false;
  end case;
end $f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 41 $f$;

-- ---------- Sürüm 42: Finans 2 (çek ve senet portföyü, masraf onayı) ----------
create table if not exists public.cekler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  yon text default 'Alınan', tur text default 'Çek', belge_no text, firma_id uuid references public.firmalar(id) on delete set null,
  kesideci text, banka text, tarih date default current_date, vade date, tutar numeric, para_birimi text default 'TRY',
  durum text default 'Portföyde', ciro text, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['cekler'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "oku" on public.%I', t);
    execute format('drop policy if exists "ekle" on public.%I', t);
    execute format('drop policy if exists "degistir" on public.%I', t);
    execute format('drop policy if exists "sil" on public.%I', t);
    execute format('create policy "oku" on public.%I for select to authenticated using (public.yetki(owner, %L, %L))', t, t, 'oku');
    execute format('create policy "ekle" on public.%I for insert to authenticated with check (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('create policy "degistir" on public.%I for update to authenticated using (public.yetki(owner, %L, %L)) with check (public.yetki(owner, %L, %L))', t, t, 'yaz', t, 'yaz');
    execute format('create policy "sil" on public.%I for delete to authenticated using (public.yetki(owner, %L, %L))', t, t, 'yaz');
    execute format('alter table public.%I alter column owner set default public.veri_sahibi()', t);
    execute format('create index if not exists %I on public.%I (owner)', t || '_owner_idx', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('drop policy if exists "yonetici_oku" on public.%I', t);
    execute format('create policy "yonetici_oku" on public.%I for select to authenticated using (public.yonetici_mi())', t);
    execute format('drop policy if exists "dis_oku" on public.%I', t);
    execute format('drop policy if exists "dis_degistir" on public.%I', t);
    execute format('drop policy if exists "dis_sil" on public.%I', t);
    execute format('create policy "dis_oku" on public.%I as restrictive for select to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_degistir" on public.%I as restrictive for update to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
    execute format('create policy "dis_sil" on public.%I as restrictive for delete to authenticated using (public.dis_uygun(owner, %L, id))', t, t);
  end loop;
end $$;
alter table public.masraflar add column if not exists kim text default public.benim_epostam();
alter table public.masraflar add column if not exists onay text;
alter table public.masraflar add column if not exists onaylayan text;
alter table public.masraflar add column if not exists onay_tarih date;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 42 $f$;

-- ---------- Sürüm 43: Yönetici görünümü (KVKK konum onay kayıtları) ----------
-- Kim, ne zaman, hangi konum aydınlatma metnini onayladı (ya da onaylamadı). Herkes yalnızca kendi adına ekler.
create table if not exists public.konum_onaylari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi() references auth.users(id) on delete cascade,
  eposta text default public.benim_epostam(), metin_ozu text, metin text, onay boolean default true, tarih timestamptz default now(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.konum_onaylari enable row level security;
drop policy if exists "oku" on public.konum_onaylari;
drop policy if exists "ekle" on public.konum_onaylari;
drop policy if exists "sil" on public.konum_onaylari;
create policy "oku" on public.konum_onaylari for select to authenticated using (lower(eposta) = public.benim_epostam() or public.sirket_yetkilisi(owner) or public.yonetici_mi());
create policy "ekle" on public.konum_onaylari for insert to authenticated with check (owner = public.veri_sahibi() and lower(eposta) = public.benim_epostam());
create policy "sil" on public.konum_onaylari for delete to authenticated using (public.sirket_yetkilisi(owner));
create index if not exists konum_onaylari_owner_idx on public.konum_onaylari (owner);
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 43 $f$;

-- ---------- Sürüm 44: Veri kalitesi (kaynak ve "bilgiler doğru" onayı, firmanın teklif e-postası) ----------
alter table public.firmalar add column if not exists kaynak text;
alter table public.firmalar add column if not exists dogrulandi text;
alter table public.firmalar add column if not exists teklif_eposta text;
alter table public.projeler add column if not exists kaynak text;
alter table public.projeler add column if not exists dogrulandi text;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 44 $f$;

-- ---------- Sürüm 45: Planlama (plan onayı, tekrarlayan ziyaret kuralı) ----------
alter table public.firmalar add column if not exists tekrar_gun int;
alter table public.firmalar add column if not exists tekrar_haftagun int;
create table if not exists public.plan_onaylari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default public.veri_sahibi() references auth.users(id) on delete cascade,
  kim text not null default public.benim_epostam(), hafta date not null, durum text default 'Gönderildi', adet int,
  yanit text, onaylayan text, onay_tarih date,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.plan_onaylari enable row level security;
drop policy if exists "oku" on public.plan_onaylari;
drop policy if exists "ekle" on public.plan_onaylari;
drop policy if exists "degistir" on public.plan_onaylari;
drop policy if exists "sil" on public.plan_onaylari;
create policy "oku" on public.plan_onaylari for select to authenticated using (lower(kim) = public.benim_epostam() or public.sirket_yetkilisi(owner) or public.yonetici_mi());
create policy "ekle" on public.plan_onaylari for insert to authenticated with check (owner = public.veri_sahibi() and (lower(kim) = public.benim_epostam() or public.sirket_yetkilisi(owner)));
-- Ekip üyesi yalnızca kendi planını yeniden gönderebilir; onaylamak / düzeltme istemek şirket yetkilisinin
create policy "degistir" on public.plan_onaylari for update to authenticated using (lower(kim) = public.benim_epostam() or public.sirket_yetkilisi(owner))
  with check (public.sirket_yetkilisi(owner) or (lower(kim) = public.benim_epostam() and durum = 'Gönderildi'));
create policy "sil" on public.plan_onaylari for delete to authenticated using (public.sirket_yetkilisi(owner));
create index if not exists plan_onaylari_owner_idx on public.plan_onaylari (owner, hafta);
drop trigger if exists touch on public.plan_onaylari;
create trigger touch before update on public.plan_onaylari for each row execute function public.touch_updated_at();
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 45 $f$;

-- ---------- Sürüm 46: Onay kuyruğu (ekibin yeni siparişi de "ekip kaydı" olarak işaretlenir) ----------
alter table public.siparisler add column if not exists kaynak text;
alter table public.siparisler add column if not exists dogrulandi text;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 46 $f$;

-- ---------- Sürüm 47: Stok tek yerde (bayi depoları; stok geçmişi bayiye bağlı) ----------
-- Ürünler bizim ürün ve fiyat listemizdir; bayinin deposu bayi_stok'ta tutulur. Stok geçmişi bayi (firma) ile işaretlenir.
alter table public.stok_gecmis add column if not exists firma_id uuid references public.firmalar(id) on delete cascade;
create index if not exists stok_gecmis_firma_idx on public.stok_gecmis (firma_id, kod);
-- Bayi kullanıcısı yalnız kendi deposunun stok geçmişini görür ve ekler
drop policy if exists "dis_ekle" on public.stok_gecmis;
create policy "dis_ekle" on public.stok_gecmis as restrictive for insert to authenticated with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create or replace function public.dis_uygun(sahip uuid, tablo text, kayit uuid) returns boolean language plpgsql stable security definer set search_path = public as $f$
declare f uuid := public.dis_firmam(sahip);
begin
  if f is null then return true; end if;
  case tablo
    when 'projeler' then return public.dis_proje(kayit, f);
    when 'firmalar' then return kayit = f;
    when 'kisiler' then return exists (select 1 from public.kisiler k where k.id = kayit and k.firma_id = f);
    when 'proje_gecmis' then return exists (select 1 from public.proje_gecmis g where g.id = kayit and public.dis_proje(g.proje_id, f));
    when 'teklifler' then return exists (select 1 from public.teklifler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'siparisler' then return exists (select 1 from public.siparisler x where x.id = kayit and (x.firma_id = f or x.bayi_id = f or public.dis_proje(x.proje_id, f)));
    when 'numuneler' then return exists (select 1 from public.numuneler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'servis_kayitlari' then return exists (select 1 from public.servis_kayitlari x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'tahsilatlar' then return exists (select 1 from public.tahsilatlar x where x.id = kayit and x.firma_id = f);
    when 'belgeler' then return exists (select 1 from public.belgeler x where x.id = kayit and (x.firma_id = f or public.dis_proje(x.proje_id, f)));
    when 'urunler', 'urun_aileleri' then return true;
    when 'stok_gecmis' then return exists (select 1 from public.stok_gecmis x where x.id = kayit and x.firma_id = f);
    when 'bayi_stok' then return exists (select 1 from public.bayi_stok x where x.id = kayit and x.firma_id = f);
    when 'bayi_satis' then return exists (select 1 from public.bayi_satis x where x.id = kayit and x.firma_id = f);
    when 'bayiler' then return exists (select 1 from public.bayiler x where x.id = kayit and x.firma_id = f);
    else return false;
  end case;
end $f$;
-- "Bayi paneli" ekranı kalktı: o ekranı gören / düzenleyen kişi ve rollere "Bayi stokları" ekranı ve tablosu aynı düzeyde verilir
do $$ declare t text; begin
  foreach t in array array['ekip_uyeleri','roller'] loop
    execute format($q$update public.%I set yetkiler = jsonb_set(jsonb_set(jsonb_set(yetkiler, '{_ekran,bayistok}', yetkiler->'_ekran'->'bayi'), '{bayi_stok}', coalesce(yetkiler->'bayi_stok', yetkiler->'_ekran'->'bayi')), '{stok_gecmis}', coalesce(yetkiler->'stok_gecmis', yetkiler->'_ekran'->'bayi'))
      where jsonb_typeof(yetkiler->'_ekran') = 'object' and jsonb_typeof(yetkiler->'_ekran'->'bayi') = 'string' and not (yetkiler->'_ekran') ? 'bayistok'$q$, t);
  end loop;
end $$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 47 $f$;

-- ---------- Sürüm 48: Cari ve vergi bilgisi (unvan, vergi dairesi, fatura adresi, koşullar, şube; şirket içinde tekil vergi no) ----------
alter table public.firmalar add column if not exists unvan text;
alter table public.firmalar add column if not exists vergi_dairesi text;
alter table public.firmalar add column if not exists fatura_adresi text;
alter table public.firmalar add column if not exists cari_kodu text;
alter table public.firmalar add column if not exists efatura text;
alter table public.firmalar add column if not exists vade_gun int;
alter table public.firmalar add column if not exists iskonto numeric;
alter table public.firmalar add column if not exists kredi_limiti numeric;
alter table public.firmalar add column if not exists para_birimi text;
alter table public.firmalar add column if not exists sube_ana_id uuid references public.firmalar(id) on delete set null;
-- Vergi numarasının yalnız rakamları (boşluk, nokta, tire temizlenmiş); tekillik bunun üzerinden denetlenir
alter table public.firmalar add column if not exists vergi_no_temiz text generated always as (nullif(regexp_replace(coalesce(vergi_no, ''), '\D', '', 'g'), '')) stored;
-- Şirket içinde aynı vergi no iki firmada olamaz (şube olarak işaretlenenler hariç).
-- Aynı numaralı firmalar varken kural kurulmaz: önce Raporlar → Veri kontrolü → "Aynı vergi numaralı firmalar"dan birleştir ya da şube işaretle, sonra bu dosyayı yeniden çalıştır.
do $$ begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'firmalar_vergi_tekil') then null;
  elsif exists (select 1 from public.firmalar where vergi_no_temiz is not null and sube_ana_id is null group by owner, vergi_no_temiz having count(*) > 1) then
    raise notice 'Aynı vergi numaralı firmalar var; tekil vergi no kuralı kurulmadı. Veri kontrolünden birleştirip bu dosyayı yeniden çalıştır.';
  else
    create unique index firmalar_vergi_tekil on public.firmalar (owner, vergi_no_temiz) where vergi_no_temiz is not null and sube_ana_id is null;
  end if;
end $$;
-- Durum sorgusu: select public.vergi_tekil_kurulu();
create or replace function public.vergi_tekil_kurulu() returns boolean language sql stable as $f$ select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'firmalar_vergi_tekil') $f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 48 $f$;

-- ---------- Sürüm 49: Kişilerde iletişim izni; "tutarları gizle" bayi, çek, bayi stok ve satış tutarlarına da uygulanır ----------
alter table public.kisiler add column if not exists iletisim_izni text;     -- KVKK aydınlatma: Verildi / Verilmedi
alter table public.kisiler add column if not exists ticari_ileti text;      -- ticari ileti (e-posta, SMS, WhatsApp tanıtım) onayı: Evet / Hayır
alter table public.kisiler add column if not exists izin_tarihi date;
alter table public.kisiler add column if not exists izin_kanali text;
create or replace function public.hassas_kolonlar() returns jsonb language sql immutable as $f$
  select '{
    "projeler":       [{"grup": "tutar", "kol": ["tutar_usd", "siparis_tutari_usd", "bizim_teklif_usd", "rakip_birim_fiyat", "rakip_toplam_usd"]},
                       {"grup": "harita", "kol": ["karar_grubu"]}],
    "teklifler":      [{"grup": "tutar", "kol": ["kalemler", "toplam", "iskonto"]}],
    "siparisler":     [{"grup": "tutar", "kol": ["net_deger"]}],
    "urunler":        [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "stok_gecmis":    [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "hedefler":       [{"grup": "tutar", "kol": ["tutar_usd", "resmi_usd", "resmi_tl"]}],
    "rakip_fiyatlar": [{"grup": "tutar", "kol": ["birim_fiyat", "fiyat_metin"]}],
    "tahsilatlar":    [{"grup": "tutar", "kol": ["tutar", "odenen"]}],
    "cekler":         [{"grup": "tutar", "kol": ["tutar"]}],
    "bayiler":        [{"grup": "tutar", "kol": ["iskonto", "kredi_limiti", "hedef_yil"]}],
    "bayi_stok":      [{"grup": "tutar", "kol": ["birim_fiyat"]}],
    "bayi_satis":     [{"grup": "tutar", "kol": ["tutar"]}],
    "kisiler":        [{"grup": "iletisim", "kol": ["telefon", "eposta", "kartvizit_on", "kartvizit_arka", "dogum_gunu"]}]
  }'::jsonb
$f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 49 $f$;

-- ---------- Sürüm 50: Bayi stok kalem kartı (firma stok kodu, üretici kodu/açıklaması, birim, para birimi, aktif/pasif) ve stok hareket kaydı ----------
alter table public.bayi_stok add column if not exists firma_kodu text;          -- bayinin kendi stok kodu (ürün kodu ana anahtar kalır)
alter table public.bayi_stok add column if not exists uretici_kodu text;
alter table public.bayi_stok add column if not exists uretici_aciklama text;
alter table public.bayi_stok add column if not exists birim text;               -- Adet, Metre, Kg, Rulo… (şirket kendi birimini ekler)
alter table public.bayi_stok add column if not exists para_birimi text default 'USD';
alter table public.bayi_stok add column if not exists aktif boolean default true;  -- pasif kalem listeden ve toplamlardan çıkar, geçmişi durur
alter table public.stok_gecmis add column if not exists hareket text;           -- giris / cikis / excel / duzeltme / sayim / silme / pasif / aktif
alter table public.stok_gecmis add column if not exists fark numeric;
alter table public.stok_gecmis add column if not exists kullanici uuid default auth.uid();
alter table public.stok_gecmis add column if not exists aciklama text;
alter table public.stok_gecmis add column if not exists birim text;
create index if not exists stok_gecmis_tarih_idx on public.stok_gecmis (firma_id, tarih);
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 50 $f$;

-- ---------- Sürüm 51: Stok grupları (şirket grupları + bayinin kendi grupları; kalem birden fazla grupta olabilir) ----------
create table if not exists public.stok_gruplari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ad text not null,
  firma_id uuid references public.firmalar(id) on delete cascade,   -- boş: şirket grubu; dolu: yalnız o bayinin grubu
  tum_bayiler boolean default true,                                  -- şirket grubu bütün bayilerde mi
  bayiler uuid[] default '{}',                                       -- tum_bayiler değilse görüneceği bayiler (firma id)
  sira int default 0, renk text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists stok_gruplari_owner_idx on public.stok_gruplari (owner);
alter table public.bayi_stok add column if not exists gruplar uuid[] default '{}';
alter table public.stok_gruplari enable row level security;
alter table public.stok_gruplari alter column owner set default public.veri_sahibi();
drop policy if exists "oku" on public.stok_gruplari;
drop policy if exists "ekle" on public.stok_gruplari;
drop policy if exists "degistir" on public.stok_gruplari;
drop policy if exists "sil" on public.stok_gruplari;
drop policy if exists "yonetici_oku" on public.stok_gruplari;
drop policy if exists "dis_oku" on public.stok_gruplari;
drop policy if exists "dis_ekle" on public.stok_gruplari;
drop policy if exists "dis_degistir" on public.stok_gruplari;
drop policy if exists "dis_sil" on public.stok_gruplari;
-- Yetki bayi stoğununkiyle aynı: stoğu gören grupları görür, stoğa yazan grup açar
create policy "oku" on public.stok_gruplari for select to authenticated using (public.yetki(owner, 'bayi_stok', 'oku'));
create policy "ekle" on public.stok_gruplari for insert to authenticated with check (public.yetki(owner, 'bayi_stok', 'yaz'));
create policy "degistir" on public.stok_gruplari for update to authenticated using (public.yetki(owner, 'bayi_stok', 'yaz')) with check (public.yetki(owner, 'bayi_stok', 'yaz'));
create policy "sil" on public.stok_gruplari for delete to authenticated using (public.yetki(owner, 'bayi_stok', 'yaz'));
create policy "yonetici_oku" on public.stok_gruplari for select to authenticated using (public.yonetici_mi());
-- Bayi (dış kullanıcı): kendi gruplarını ve kendisine açılmış şirket gruplarını görür; yalnız kendi gruplarını açar, değiştirir, siler
create policy "dis_oku" on public.stok_gruplari as restrictive for select to authenticated using (
  public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner) or (firma_id is null and (tum_bayiler or public.dis_firmam(owner) = any(bayiler))));
create policy "dis_ekle" on public.stok_gruplari as restrictive for insert to authenticated with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_degistir" on public.stok_gruplari as restrictive for update to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner)) with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_sil" on public.stok_gruplari as restrictive for delete to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
drop trigger if exists touch on public.stok_gruplari;
create trigger touch before update on public.stok_gruplari for each row execute function public.touch_updated_at();
-- Şirket ayarları ekiple paylaşılır: stok birimleri, "farklı sipariş" işaretleri, kendi depo seçeneği, zorunlu alanlar
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil', 'cift_farkli', 'otomasyon', 'oto_silinen',
                'stok_birimleri', 'sip_farkli', 'kendi_depo', 'zorunlu_alanlar')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 51 $f$;

-- ---------- Sürüm 52: Bayi stoğunda kritik seviye ----------
alter table public.bayi_stok add column if not exists kritik numeric;    -- miktar bu sınıra ya da altına düşünce uyarı
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 52 $f$;

-- ---------- Sürüm 53: Stok sayımı (taslak sayım, fark raporu, onayla stok güncellenir, geçmiş sayımlar) ----------
create table if not exists public.stok_sayimlari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,
  grup_id uuid references public.stok_gruplari(id) on delete set null,
  durum text default 'Açık',                     -- Açık / Onaylandı / İptal
  baslangic timestamptz default now(), onay_tarihi timestamptz, sayan text, onaylayan text,
  sayilan jsonb default '{}'::jsonb,              -- taslak: kod → sayılan miktar
  satirlar jsonb default '[]'::jsonb,             -- onayda: kod, sistem, sayılan, fark, tutar
  eksik_tutar numeric, fazla_tutar numeric, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists stok_sayimlari_firma_idx on public.stok_sayimlari (owner, firma_id);
alter table public.stok_sayimlari enable row level security;
alter table public.stok_sayimlari alter column owner set default public.veri_sahibi();
drop policy if exists "oku" on public.stok_sayimlari;
drop policy if exists "ekle" on public.stok_sayimlari;
drop policy if exists "degistir" on public.stok_sayimlari;
drop policy if exists "sil" on public.stok_sayimlari;
drop policy if exists "yonetici_oku" on public.stok_sayimlari;
drop policy if exists "dis_oku" on public.stok_sayimlari;
drop policy if exists "dis_ekle" on public.stok_sayimlari;
drop policy if exists "dis_degistir" on public.stok_sayimlari;
drop policy if exists "dis_sil" on public.stok_sayimlari;
create policy "oku" on public.stok_sayimlari for select to authenticated using (public.yetki(owner, 'bayi_stok', 'oku'));
create policy "ekle" on public.stok_sayimlari for insert to authenticated with check (public.yetki(owner, 'bayi_stok', 'yaz'));
create policy "degistir" on public.stok_sayimlari for update to authenticated using (public.yetki(owner, 'bayi_stok', 'yaz')) with check (public.yetki(owner, 'bayi_stok', 'yaz'));
create policy "sil" on public.stok_sayimlari for delete to authenticated using (public.yetki(owner, 'bayi_stok', 'yaz'));
create policy "yonetici_oku" on public.stok_sayimlari for select to authenticated using (public.yonetici_mi());
-- Bayi (dış kullanıcı) yalnız kendi deposunun sayımlarını görür ve yapar
create policy "dis_oku" on public.stok_sayimlari as restrictive for select to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_ekle" on public.stok_sayimlari as restrictive for insert to authenticated with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_degistir" on public.stok_sayimlari as restrictive for update to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner)) with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_sil" on public.stok_sayimlari as restrictive for delete to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
drop trigger if exists touch on public.stok_sayimlari;
create trigger touch before update on public.stok_sayimlari for each row execute function public.touch_updated_at();
create or replace function public.hassas_kolonlar() returns jsonb language sql immutable as $f$
  select '{
    "projeler":       [{"grup": "tutar", "kol": ["tutar_usd", "siparis_tutari_usd", "bizim_teklif_usd", "rakip_birim_fiyat", "rakip_toplam_usd"]},
                       {"grup": "harita", "kol": ["karar_grubu"]}],
    "teklifler":      [{"grup": "tutar", "kol": ["kalemler", "toplam", "iskonto"]}],
    "siparisler":     [{"grup": "tutar", "kol": ["net_deger"]}],
    "urunler":        [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "stok_gecmis":    [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "hedefler":       [{"grup": "tutar", "kol": ["tutar_usd", "resmi_usd", "resmi_tl"]}],
    "rakip_fiyatlar": [{"grup": "tutar", "kol": ["birim_fiyat", "fiyat_metin"]}],
    "tahsilatlar":    [{"grup": "tutar", "kol": ["tutar", "odenen"]}],
    "cekler":         [{"grup": "tutar", "kol": ["tutar"]}],
    "bayiler":        [{"grup": "tutar", "kol": ["iskonto", "kredi_limiti", "hedef_yil"]}],
    "bayi_stok":      [{"grup": "tutar", "kol": ["birim_fiyat"]}],
    "bayi_satis":     [{"grup": "tutar", "kol": ["tutar"]}],
    "stok_sayimlari": [{"grup": "tutar", "kol": ["eksik_tutar", "fazla_tutar"]}],
    "kisiler":        [{"grup": "iletisim", "kol": ["telefon", "eposta", "kartvizit_on", "kartvizit_arka", "dogum_gunu"]}]
  }'::jsonb
$f$;
do $$ declare t text; begin
  for t in select jsonb_object_keys(public.hassas_kolonlar()) loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists hassas_koru on public.%I', t);
    execute format('create trigger hassas_koru before update on public.%I for each row execute function public.hassas_koru()', t);
  end loop;
end $$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 53 $f$;

-- ---------- Sürüm 54: Bir bayiye birden fazla depo (merkez, şube, şantiye) ve transfer ----------
alter table public.bayi_stok add column if not exists depo text;               -- boş: ana depo
alter table public.bayiler add column if not exists depolar text[] default '{}'; -- bayinin depo adları
alter table public.stok_sayimlari add column if not exists depo text;
-- Kalem anahtarı artık bayi + ürün kodu + depo: aynı ürün iki depoda ayrı satır olabilir
alter table public.bayi_stok drop constraint if exists bayi_stok_owner_firma_id_kod_key;
create unique index if not exists bayi_stok_tekil on public.bayi_stok (owner, firma_id, kod, coalesce(depo, ''));
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 54 $f$;

-- ---------- Sürüm 55: Stok planlama: kampanya işareti (uzun bekleyen / yavaş eriyen kalemler) ----------
alter table public.bayi_stok add column if not exists kampanya boolean default false;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 55 $f$;

-- ---------- Sürüm 56: Seri / parti takibi (servis kaydına bağlı) ve fiyatsız stok paylaşım bağlantısı ----------
create table if not exists public.stok_seri (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,
  kod text not null, depo text,
  tur text default 'Parti',                 -- Parti / Seri
  no text not null, adet numeric, tarih date default current_date,
  durum text default 'Stokta',              -- Stokta / Satıldı / Serviste / İade
  musteri_id uuid references public.firmalar(id) on delete set null,
  proje_id uuid references public.projeler(id) on delete set null,
  garanti_ay int, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists stok_seri_no_idx on public.stok_seri (owner, no);
create index if not exists stok_seri_kod_idx on public.stok_seri (owner, firma_id, kod);
alter table public.servis_kayitlari add column if not exists seri_no text;   -- seri / parti numarası: stok_seri ile eşleşir (garanti)

create table if not exists public.stok_paylasimlari (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  anahtar text not null unique,
  firma_id uuid not null references public.firmalar(id) on delete cascade,
  depo text, tum_depolar boolean default true, grup_id uuid references public.stok_gruplari(id) on delete set null,
  miktar text default 'tam',                -- tam: miktar görünür; var: yalnız var / az
  son_tarih date, baslik text, gonderen text, iptal boolean default false,
  acilma int default 0, ilk_acilma timestamptz, son_acilma timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['stok_seri','stok_paylasimlari'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I alter column owner set default public.veri_sahibi()', t);
    execute format('create index if not exists %I on public.%I (owner)', t || '_owner_idx', t);
    execute format('drop policy if exists "oku" on public.%I', t);
    execute format('drop policy if exists "ekle" on public.%I', t);
    execute format('drop policy if exists "degistir" on public.%I', t);
    execute format('drop policy if exists "sil" on public.%I', t);
    execute format('drop policy if exists "yonetici_oku" on public.%I', t);
    execute format('drop policy if exists "dis_oku" on public.%I', t);
    execute format('drop policy if exists "dis_ekle" on public.%I', t);
    execute format('drop policy if exists "dis_degistir" on public.%I', t);
    execute format('drop policy if exists "dis_sil" on public.%I', t);
    execute format('create policy "oku" on public.%I for select to authenticated using (public.yetki(owner, ''bayi_stok'', ''oku''))', t);
    execute format('create policy "ekle" on public.%I for insert to authenticated with check (public.yetki(owner, ''bayi_stok'', ''yaz''))', t);
    execute format('create policy "degistir" on public.%I for update to authenticated using (public.yetki(owner, ''bayi_stok'', ''yaz'')) with check (public.yetki(owner, ''bayi_stok'', ''yaz''))', t);
    execute format('create policy "sil" on public.%I for delete to authenticated using (public.yetki(owner, ''bayi_stok'', ''yaz''))', t);
    execute format('create policy "yonetici_oku" on public.%I for select to authenticated using (public.yonetici_mi())', t);
    execute format('create policy "dis_oku" on public.%I as restrictive for select to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner))', t);
    execute format('create policy "dis_ekle" on public.%I as restrictive for insert to authenticated with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner))', t);
    execute format('create policy "dis_degistir" on public.%I as restrictive for update to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner)) with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner))', t);
    execute format('create policy "dis_sil" on public.%I as restrictive for delete to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner))', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
-- Bağlantıyı açan (giriş yapmamış) kişi: geçerli bağlantıysa güncel stok listesi, fiyatsız
create or replace function public.stok_paylasim_goster(p_anahtar text) returns jsonb language plpgsql security definer set search_path = public as $f$
declare b public.stok_paylasimlari; k jsonb;
begin
  if p_anahtar is null or length(p_anahtar) < 32 then return jsonb_build_object('hata', 'gecersiz'); end if;
  select * into b from public.stok_paylasimlari where anahtar = p_anahtar;
  if not found then return jsonb_build_object('hata', 'gecersiz'); end if;
  if b.iptal then return jsonb_build_object('hata', 'iptal', 'gonderen', b.gonderen); end if;
  if b.son_tarih is not null and b.son_tarih < current_date then return jsonb_build_object('hata', 'sure', 'son_tarih', b.son_tarih, 'gonderen', b.gonderen); end if;
  update public.stok_paylasimlari set acilma = acilma + 1, ilk_acilma = coalesce(ilk_acilma, now()), son_acilma = now() where id = b.id;
  select coalesce(jsonb_agg(jsonb_build_object('kod', s.kod, 'aciklama', s.aciklama, 'birim', s.birim, 'depo', s.depo,
           'adet', case when b.miktar = 'tam' then s.adet else null end,
           'durum', case when s.adet > coalesce(s.kritik, 5) then 'Var' else 'Az' end) order by s.kod), '[]'::jsonb) into k
    from public.bayi_stok s
   where s.owner = b.owner and s.firma_id = b.firma_id and s.aktif is not false and coalesce(s.adet, 0) > 0
     and (b.tum_depolar or coalesce(s.depo, '') = coalesce(b.depo, ''))
     and (b.grup_id is null or b.grup_id = any(s.gruplar));
  return jsonb_build_object('baslik', b.baslik, 'gonderen', b.gonderen, 'tarih', now(), 'son_tarih', b.son_tarih, 'miktar', b.miktar, 'kalemler', k);
end $f$;
revoke all on function public.stok_paylasim_goster(text) from public;
grant execute on function public.stok_paylasim_goster(text) to anon, authenticated;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 56 $f$;

-- ---------- Sürüm 57: Sevk ve irsaliye (sevk belgesi, iade, taşıma bilgileri, teslim imzası, kısmi sevk) ----------
create table if not exists public.sevkler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  belge_no text, tur text default 'Sevk',                    -- Sevk / İade
  durum text default 'Taslak',                               -- Taslak / Hazırlanıyor / Yolda / Teslim edildi / İptal
  plan_tarih date, tarih date,
  firma_id uuid references public.firmalar(id) on delete set null,   -- çıkış: bayi stoğu
  depo text,
  alici_id uuid references public.firmalar(id) on delete set null,
  proje_id uuid references public.projeler(id) on delete set null,
  teklif_id uuid references public.teklifler(id) on delete set null,
  siparis_id uuid references public.siparisler(id) on delete set null,
  teslim_yeri text, kalemler jsonb default '[]'::jsonb,       -- kod, aciklama, birim, adet, siparis_adet
  gonderim text, tasiyici text, takip_no text, tasima_ucreti numeric, tasima_pb text default 'TRY', odeyen text,
  palet int, koli int, agirlik numeric, desi numeric, plaka text, sofor text, sofor_tel text,
  teslim_alan text, teslim_imza text, teslim_foto jsonb default '[]'::jsonb, teslim_konum text, teslim_zaman timestamptz,
  stok_dustu boolean default false, notlar text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists sevkler_owner_idx on public.sevkler (owner);
create index if not exists sevkler_tarih_idx on public.sevkler (owner, plan_tarih);
create unique index if not exists sevkler_belge_tekil on public.sevkler (owner, belge_no) where belge_no is not null;
alter table public.sevkler enable row level security;
alter table public.sevkler alter column owner set default public.veri_sahibi();
drop policy if exists "oku" on public.sevkler;
drop policy if exists "ekle" on public.sevkler;
drop policy if exists "degistir" on public.sevkler;
drop policy if exists "sil" on public.sevkler;
drop policy if exists "yonetici_oku" on public.sevkler;
drop policy if exists "dis_oku" on public.sevkler;
drop policy if exists "dis_ekle" on public.sevkler;
drop policy if exists "dis_degistir" on public.sevkler;
drop policy if exists "dis_sil" on public.sevkler;
create policy "oku" on public.sevkler for select to authenticated using (public.yetki(owner, 'sevkler', 'oku'));
create policy "ekle" on public.sevkler for insert to authenticated with check (public.yetki(owner, 'sevkler', 'yaz'));
create policy "degistir" on public.sevkler for update to authenticated using (public.yetki(owner, 'sevkler', 'yaz')) with check (public.yetki(owner, 'sevkler', 'yaz'));
create policy "sil" on public.sevkler for delete to authenticated using (public.yetki(owner, 'sevkler', 'yaz'));
create policy "yonetici_oku" on public.sevkler for select to authenticated using (public.yonetici_mi());
-- Bayi (dış kullanıcı): kendi stoğundan çıkan ya da kendisine gelen belgeleri görür; yalnız kendi stoğundan çıkan belgeyi açar / değiştirir
create policy "dis_oku" on public.sevkler as restrictive for select to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner) or alici_id = public.dis_firmam(owner));
create policy "dis_ekle" on public.sevkler as restrictive for insert to authenticated with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_degistir" on public.sevkler as restrictive for update to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner)) with check (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
create policy "dis_sil" on public.sevkler as restrictive for delete to authenticated using (public.dis_firmam(owner) is null or firma_id = public.dis_firmam(owner));
drop trigger if exists touch on public.sevkler;
create trigger touch before update on public.sevkler for each row execute function public.touch_updated_at();
revoke all on public.sevkler from anon;
create or replace function public.hassas_kolonlar() returns jsonb language sql immutable as $f$
  select '{
    "projeler":       [{"grup": "tutar", "kol": ["tutar_usd", "siparis_tutari_usd", "bizim_teklif_usd", "rakip_birim_fiyat", "rakip_toplam_usd"]},
                       {"grup": "harita", "kol": ["karar_grubu"]}],
    "teklifler":      [{"grup": "tutar", "kol": ["kalemler", "toplam", "iskonto"]}],
    "siparisler":     [{"grup": "tutar", "kol": ["net_deger"]}],
    "urunler":        [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "stok_gecmis":    [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "hedefler":       [{"grup": "tutar", "kol": ["tutar_usd", "resmi_usd", "resmi_tl"]}],
    "rakip_fiyatlar": [{"grup": "tutar", "kol": ["birim_fiyat", "fiyat_metin"]}],
    "tahsilatlar":    [{"grup": "tutar", "kol": ["tutar", "odenen"]}],
    "cekler":         [{"grup": "tutar", "kol": ["tutar"]}],
    "bayiler":        [{"grup": "tutar", "kol": ["iskonto", "kredi_limiti", "hedef_yil"]}],
    "bayi_stok":      [{"grup": "tutar", "kol": ["birim_fiyat"]}],
    "bayi_satis":     [{"grup": "tutar", "kol": ["tutar"]}],
    "stok_sayimlari": [{"grup": "tutar", "kol": ["eksik_tutar", "fazla_tutar"]}],
    "sevkler":        [{"grup": "tutar", "kol": ["tasima_ucreti"]}],
    "kisiler":        [{"grup": "iletisim", "kol": ["telefon", "eposta", "kartvizit_on", "kartvizit_arka", "dogum_gunu"]}]
  }'::jsonb
$f$;
do $$ declare t text; begin
  for t in select jsonb_object_keys(public.hassas_kolonlar()) loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists hassas_koru on public.%I', t);
    execute format('create trigger hassas_koru before update on public.%I for each row execute function public.hassas_koru()', t);
  end loop;
end $$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 57 $f$;
-- ---------- Sürüm 58: Teklif şablonları, mahal ve alternatifli kalemler, teslim ve kur şartları, kayıp nedeni, iskonto onayı ----------
alter table public.teklifler add column if not exists sablon_id text;
alter table public.teklifler add column if not exists dil text default 'tr';
alter table public.teklifler add column if not exists secim text;                 -- alternatifli teklifte seçili seçenek (A, B…)
alter table public.teklifler add column if not exists teslim_suresi text;
alter table public.teklifler add column if not exists teslim_yeri text;
alter table public.teklifler add column if not exists teslim_sekli text;          -- EXW, DAP, şantiye teslim…
alter table public.teklifler add column if not exists kur numeric;                -- teklif kuru (1 USD/EUR = ? TL)
alter table public.teklifler add column if not exists kur_tarihi date;
alter table public.teklifler add column if not exists kur_maddesi boolean default false;
alter table public.teklifler add column if not exists ekler jsonb default '[]'::jsonb;   -- [{ad, url}]
alter table public.teklifler add column if not exists onay text;                  -- iskonto sınırı aşılınca: Bekliyor / Onaylandı / Reddedildi
alter table public.teklifler add column if not exists onaylayan text;
alter table public.teklifler add column if not exists kayip_neden text;
alter table public.teklifler add column if not exists kayip_rakip text;
alter table public.teklifler add column if not exists kayip_fiyat numeric;
alter table public.teklifler add column if not exists gonderim_tarihi date;
alter table public.teklifler add column if not exists yanit_tarihi date;
alter table public.teklifler add column if not exists olusturan text default public.benim_epostam();
alter table public.urunler add column if not exists maliyet_usd numeric;
alter table public.urunler add column if not exists foy_url text;
alter table public.urunler add column if not exists sertifika_url text;
alter table public.urunler add column if not exists fotometri_url text;
alter table public.urunler add column if not exists gorsel text;
alter table public.teklif_baglantilari add column if not exists yanit_secim text;

-- Şablonlar, numara düzeni ve hazır metinler ekipçe paylaşılır
create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil', 'cift_farkli', 'otomasyon', 'oto_silinen',
                'stok_birimleri', 'sip_farkli', 'kendi_depo', 'zorunlu_alanlar', 'teklif_sablonlari', 'teklif_no_duzen', 'teklif_metinleri', 'teklif_iskonto_siniri')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;

-- Müşteri bağlantıdan yanıtlar; alternatifli teklifte seçtiği seçenek (p_secim) teklife yazılır.
-- İlk açılışta teklifi gönderene "teklif görüntülendi" görevi düşer (bir kez).
drop function if exists public.teklif_yanitla(text, text, text, text);
create or replace function public.teklif_yanitla(p_anahtar text, p_yanit text, p_not text default null, p_ad text default null, p_secim text default null) returns jsonb language plpgsql security definer set search_path = public as $f$
declare b public.teklif_baglantilari; t public.teklifler; v_baslik text; v_secim text := left(nullif(trim(p_secim), ''), 8);
begin
  if p_yanit not in ('Onay', 'Revize') then return jsonb_build_object('hata', 'gecersiz'); end if;
  select * into b from public.teklif_baglantilari where anahtar = p_anahtar and length(p_anahtar) >= 32 for update;
  if not found or b.iptal then return jsonb_build_object('hata', 'gecersiz'); end if;
  if b.son_tarih is not null and b.son_tarih < current_date then return jsonb_build_object('hata', 'sure'); end if;
  if b.yanit is not null then return jsonb_build_object('hata', 'yanitlandi', 'yanit', b.yanit); end if;
  if v_secim is not null and not coalesce(b.icerik -> 'secenekler', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('ad', v_secim)) then v_secim := null; end if;
  update public.teklif_baglantilari set yanit = p_yanit, yanit_not = left(nullif(trim(p_not), ''), 2000), yanit_ad = left(nullif(trim(p_ad), ''), 120), yanit_zaman = now(), yanit_secim = v_secim where id = b.id;
  select * into t from public.teklifler where id = b.teklif_id;
  if found then
    if p_yanit = 'Onay' then
      update public.teklifler set durum = 'Kabul', yanit_tarihi = current_date, secim = coalesce(v_secim, secim) where id = t.id;
      v_baslik := 'Teklif onaylandı: ' || coalesce(t.teklif_no, '') || coalesce(' · Seçenek ' || v_secim, '') || ' · siparişi takip et';
    else
      v_baslik := 'Revize istendi: ' || coalesce(t.teklif_no, '');
    end if;
    insert into public.gorevler (owner, baslik, son_tarih, oncelik, durum, firma_id, proje_id, kisi_id, notlar, atanan, sorumlu, ekip_id, kaynak)
    values (b.owner, v_baslik, current_date, 'Yüksek', 'Açık', t.firma_id, t.proje_id, t.kisi_id,
      nullif(concat_ws(E'\n', case when p_ad is not null and trim(p_ad) <> '' then 'Yanıtlayan: ' || left(trim(p_ad), 120) end, left(nullif(trim(p_not), ''), 2000)), ''),
      b.olusturan, t.sorumlu, t.ekip_id, 'baglanti:' || b.id);
    insert into public.degisiklikler (owner, tablo, kayit_id, islem, kim, ozet)
    values (b.owner, 'teklifler', t.id, 'UPDATE', 'Müşteri (onay bağlantısı)', case when p_yanit = 'Onay' then 'Teklif bağlantıdan onaylandı' || coalesce(' (Seçenek ' || v_secim || ')', '') else 'Bağlantıdan revize istendi' end);
  end if;
  return jsonb_build_object('tamam', true, 'yanit', p_yanit, 'secim', v_secim);
end $f$;
revoke all on function public.teklif_yanitla(text, text, text, text, text) from public;
grant execute on function public.teklif_yanitla(text, text, text, text, text) to anon, authenticated;

create or replace function public.teklif_goster(p_anahtar text) returns jsonb language plpgsql security definer set search_path = public as $f$
declare b public.teklif_baglantilari; t public.teklifler;
begin
  if p_anahtar is null or length(p_anahtar) < 32 then return jsonb_build_object('hata', 'gecersiz'); end if;
  select * into b from public.teklif_baglantilari where anahtar = p_anahtar;
  if not found then return jsonb_build_object('hata', 'gecersiz'); end if;
  if b.iptal then return jsonb_build_object('hata', 'iptal'); end if;
  if b.son_tarih is not null and b.son_tarih < current_date and b.yanit is null then return jsonb_build_object('hata', 'sure', 'son_tarih', b.son_tarih, 'gonderen', b.icerik -> 'gonderen'); end if;
  update public.teklif_baglantilari set acilma = acilma + 1, ilk_acilma = coalesce(ilk_acilma, now()), son_acilma = now() where id = b.id;
  if b.ilk_acilma is null and b.yanit is null then
    select * into t from public.teklifler where id = b.teklif_id;
    if found then
      insert into public.gorevler (owner, baslik, son_tarih, oncelik, durum, firma_id, proje_id, kisi_id, atanan, sorumlu, ekip_id, kaynak)
      values (b.owner, 'Teklif görüntülendi: ' || coalesce(t.teklif_no, '') || ' · müşteriyi ara', current_date, 'Normal', 'Açık', t.firma_id, t.proje_id, t.kisi_id, b.olusturan, t.sorumlu, t.ekip_id, 'goruntulendi:' || b.id);
    end if;
  end if;
  return b.icerik || jsonb_build_object('son_tarih', b.son_tarih, 'yanit', b.yanit, 'yanit_zaman', b.yanit_zaman, 'yanit_ad', b.yanit_ad, 'yanit_secim', b.yanit_secim);
end $f$;
revoke all on function public.teklif_goster(text) from public;
grant execute on function public.teklif_goster(text) to anon, authenticated;

create or replace function public.hassas_kolonlar() returns jsonb language sql immutable as $f$
  select '{
    "projeler":       [{"grup": "tutar", "kol": ["tutar_usd", "siparis_tutari_usd", "bizim_teklif_usd", "rakip_birim_fiyat", "rakip_toplam_usd"]},
                       {"grup": "harita", "kol": ["karar_grubu"]}],
    "teklifler":      [{"grup": "tutar", "kol": ["kalemler", "toplam", "iskonto", "kayip_fiyat", "kur"]}],
    "siparisler":     [{"grup": "tutar", "kol": ["net_deger"]}],
    "urunler":        [{"grup": "tutar", "kol": ["birim_fiyat_usd", "maliyet_usd"]}],
    "stok_gecmis":    [{"grup": "tutar", "kol": ["birim_fiyat_usd"]}],
    "hedefler":       [{"grup": "tutar", "kol": ["tutar_usd", "resmi_usd", "resmi_tl"]}],
    "rakip_fiyatlar": [{"grup": "tutar", "kol": ["birim_fiyat", "fiyat_metin"]}],
    "tahsilatlar":    [{"grup": "tutar", "kol": ["tutar", "odenen"]}],
    "cekler":         [{"grup": "tutar", "kol": ["tutar"]}],
    "bayiler":        [{"grup": "tutar", "kol": ["iskonto", "kredi_limiti", "hedef_yil"]}],
    "bayi_stok":      [{"grup": "tutar", "kol": ["birim_fiyat"]}],
    "bayi_satis":     [{"grup": "tutar", "kol": ["tutar"]}],
    "stok_sayimlari": [{"grup": "tutar", "kol": ["eksik_tutar", "fazla_tutar"]}],
    "sevkler":        [{"grup": "tutar", "kol": ["tasima_ucreti"]}],
    "kisiler":        [{"grup": "iletisim", "kol": ["telefon", "eposta", "kartvizit_on", "kartvizit_arka", "dogum_gunu"]}]
  }'::jsonb
$f$;
do $$ declare t text; begin
  for t in select jsonb_object_keys(public.hassas_kolonlar()) loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists hassas_koru on public.%I', t);
    execute format('create trigger hassas_koru before update on public.%I for each row execute function public.hassas_koru()', t);
  end loop;
end $$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 58 $f$;
-- ---------- Sürüm 59: Stokta ek sütunlar (Marka, Raf…), barkod, koli içi adet (koli / ürün etiketi) ----------
alter table public.bayi_stok add column if not exists ozel jsonb default '{}'::jsonb;   -- kullanıcının eklediği sütunlar: {"Marka": "Pelsan"}
alter table public.bayi_stok add column if not exists barkod text;                     -- üreticinin barkodu (EAN); okutunca kalem bulunur
alter table public.bayi_stok add column if not exists koli_ici numeric;                -- koli etiketindeki adet

create or replace function public.ayar_paylasilir(sahip uuid, anahtar text) returns boolean language sql stable security definer set search_path = public as $f$
  select public.sirket_yetkilisi(sahip) or (public.ekipte(sahip::text) and (
    anahtar in ('google_key', 'wa_sablonlar', 'teklif_firma', 'listeler', 'kataloglar_ek', 'ziyaret_siklik', 'usd_kur', 'kur_elle', 'elektrik_tl_kwh', 'firma_profil', 'cift_farkli', 'otomasyon', 'oto_silinen',
                'stok_birimleri', 'sip_farkli', 'kendi_depo', 'zorunlu_alanlar', 'teklif_sablonlari', 'teklif_no_duzen', 'teklif_metinleri', 'teklif_iskonto_siniri', 'teklif_min_marj', 'stok_sutunlari')
    or (anahtar like 'sartname:%' and public.yetki(sahip, 'projeler', 'oku'))))
$f$;
create or replace function public.yetki_surum() returns int language sql stable as $f$ select 59 $f$;


-- (her zaman en sonda kalsın) sütun izinlerini güncel sütunlara göre yenile
select public.hassas_izinleri_yenile();

-- API'nin yeni tabloları hemen görmesi için şema önbelleğini yenile
notify pgrst, 'reload schema';
