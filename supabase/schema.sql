-- =====================================================================
--  Saha Satış Takip — Supabase şeması (sürüm 6)
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

-- ---------- RLS + tetikleyiciler ----------
do $$
declare t text;
begin
  foreach t in array array['firmalar','kisiler','projeler','proje_gecmis','ziyaretler','gorevler',
                           'urunler','stok_gecmis','rakip_fiyatlar','siparisler','hedefler','bolgeler',
                           'teklifler','numuneler','servis_kayitlari','masraflar','urun_aileleri','ayarlar',
                           'tahsilatlar','belgeler'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "sahibi" on public.%I', t);
    execute format('create policy "sahibi" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
    execute format('create index if not exists %I on public.%I (owner)', t || '_owner_idx', t);
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at') then
      execute format('drop trigger if exists touch on public.%I', t);
      execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    end if;
  end loop;
end $$;

-- ---------- Fotoğraf deposu (özel) ----------
insert into storage.buckets (id, name, public) values ('fotograflar', 'fotograflar', false)
on conflict (id) do nothing;

drop policy if exists "foto_oku" on storage.objects;
drop policy if exists "foto_yaz" on storage.objects;
drop policy if exists "foto_sil" on storage.objects;
create policy "foto_oku" on storage.objects for select to authenticated
  using (bucket_id = 'fotograflar' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "foto_yaz" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotograflar' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "foto_sil" on storage.objects for delete to authenticated
  using (bucket_id = 'fotograflar' and (storage.foldername(name))[1] = auth.uid()::text);
