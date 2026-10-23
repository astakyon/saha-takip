-- =====================================================================
--  Saha Satış Takip — Supabase şeması (sürüm 15)
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
