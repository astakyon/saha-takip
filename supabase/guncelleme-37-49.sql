-- Saha Takip veritabanı güncellemesi: şema 37 → 49 (uygulama sürüm 96–110)
-- Bu dosya yalnızca veritabanı şema 37'deyse çalışır. Emin değilsen önce şunu çalıştır:  select public.yetki_surum();
-- 37'den küçükse bu dosya yerine tam supabase/schema.sql dosyasını çalıştır. İki kez çalıştırmak zarar vermez.
do $g$ declare v int; begin
  if to_regprocedure('public.yetki_surum()') is not null then execute 'select public.yetki_surum()' into v; end if;
  if v is null or v < 37 then
    raise exception 'Veritabanı şema 37''den eski (%): bu kısa dosya yerine tam schema.sql dosyasını çalıştır.', coalesce(v::text, 'kurulu değil');
  end if;
end $g$;

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


-- (her zaman en sonda kalsın) sütun izinlerini güncel sütunlara göre yenile
select public.hassas_izinleri_yenile();
