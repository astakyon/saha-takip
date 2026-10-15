-- =====================================================================
--  Saha Satış Takip — Supabase şeması
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

-- ---------- RLS + tetikleyiciler ----------
do $$
declare t text;
begin
  foreach t in array array['firmalar','kisiler','projeler','proje_gecmis','ziyaretler','gorevler',
                           'urunler','stok_gecmis','rakip_fiyatlar','siparisler','hedefler'] loop
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
