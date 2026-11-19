-- Saha Takip veritabanı güncellemesi: şema 60 → 63 (uygulama sürüm 125)
-- Kalem resmi / teknik / koli / raf, parti tarihleri, hasarlı ürünler, projeye ayırma. İki kez çalıştırmak zarar vermez.
do $g$ declare v int; begin execute 'select public.yetki_surum()' into v; if v < 60 then raise exception 'Veritabanı şema 60''tan eski (%): önce guncelleme-49-58.sql ve sonraki adımlar.', v; end if; end $g$;
alter table public.bayi_stok add column if not exists resimler jsonb default '[]'::jsonb;   -- fotoğraf yolları (fotograflar deposu)
alter table public.bayi_stok add column if not exists detay text;                           -- ayrıntılı açıklama
alter table public.bayi_stok add column if not exists guc_w numeric;
alter table public.bayi_stok add column if not exists lumen numeric;
alter table public.bayi_stok add column if not exists renk_k numeric;
alter table public.bayi_stok add column if not exists ip text;
alter table public.bayi_stok add column if not exists koli_agirlik numeric;                 -- kg
alter table public.bayi_stok add column if not exists koli_olcu text;                       -- ör. 125 × 30 × 20 cm
alter table public.bayi_stok add column if not exists raf text;                             -- depodaki raf / göz: A-03-2
alter table public.stok_seri add column if not exists uretim_tarihi date;
alter table public.stok_seri add column if not exists son_tarih date;                       -- raf ömrü / son kullanma

create table if not exists public.stok_hasar (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,   -- hangi bayinin deposu
  kod text not null, aciklama text, depo text,
  adet numeric default 1,
  tur text default 'Hasarlı geldi',          -- Hasarlı geldi / Depoda hasar / Müşteri iadesi
  durum text default 'Açık',                 -- Açık / Üreticiye bildirildi / Değişim geldi / İade edildi / Kapandı
  tarih date default current_date,
  tedarikci text, belge_no text,             -- gelen irsaliye / sevk numarası
  notlar text, fotolar jsonb default '[]'::jsonb,
  stoktan_dustu boolean default false,
  kaydeden text default public.benim_epostam(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists stok_hasar_kod_idx on public.stok_hasar (owner, firma_id, kod);
do $$ declare t text; begin
  foreach t in array array['stok_hasar'] loop
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

create table if not exists public.stok_rezerv (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  firma_id uuid not null references public.firmalar(id) on delete cascade,   -- stoğun bulunduğu bayi
  kod text not null, depo text,
  adet numeric not null default 1,
  proje_id uuid references public.projeler(id) on delete set null,
  musteri_id uuid references public.firmalar(id) on delete set null,
  son_tarih date,                             -- bu tarihe kadar ayrılı; geçince uyarı
  durum text default 'Aktif',                 -- Aktif / Sevk edildi / İptal
  notlar text, ayiran text default public.benim_epostam(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists stok_rezerv_kod_idx on public.stok_rezerv (owner, firma_id, kod);
do $$ declare t text; begin
  foreach t in array array['stok_rezerv'] loop
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

create or replace function public.yetki_surum() returns int language sql stable as $f$ select 63 $f$;
select public.hassas_izinleri_yenile();
notify pgrst, 'reload schema';
