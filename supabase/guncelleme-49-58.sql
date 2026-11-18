-- Saha Takip veritabanı güncellemesi: şema 49 → 58 (uygulama sürüm 111–122)
-- Bayi stok yol haritası (kalem kartı, gruplar, kritik seviye, sayım, depolar, planlama, seri / paylaşım, sevk) ve teklif şablonları.
-- Bu dosya yalnızca veritabanı şema 49 ya da sonrasındaysa çalışır. Emin değilsen önce şunu çalıştır:  select public.yetki_surum();
-- 49'dan küçükse önce supabase/guncelleme-37-49.sql (ya da tam supabase/schema.sql) dosyasını çalıştır. İki kez çalıştırmak zarar vermez.
do $g$ declare v int; begin
  if to_regprocedure('public.yetki_surum()') is not null then execute 'select public.yetki_surum()' into v; end if;
  if v is null or v < 49 then
    raise exception 'Veritabanı şema 49''dan eski (%): önce guncelleme-37-49.sql ya da tam schema.sql dosyasını çalıştır.', coalesce(v::text, 'kurulu değil');
  end if;
end $g$;

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

-- sütun izinlerini güncel sütunlara göre yenile
select public.hassas_izinleri_yenile();

-- API'nin yeni tabloları hemen görmesi için şema önbelleğini yenile
notify pgrst, 'reload schema';
