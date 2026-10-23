// Veri katmanı: Supabase (bulut) veya Deneme (bu cihazın tarayıcısı)
export const TABLES = {
  firmalar: ['id','ad','tipler','il','ilce','belde','osb','bolge_id','adres','lat','lng','konum_yaklasik','telefon','eposta','web','vergi_no','segment','sektor','key_account','notlar','fotolar','google_place_id','google_url'],
  kisiler: ['id','firma_id','ad_soyad','unvan','telefon','eposta','rol','kartvizit_on','kartvizit_arka','dogum_gunu','notlar'],
  projeler: ['id','ad','durum','durum_alt','kritik','takip_yili','hedef_listesi','baska_bolge','il','ilce','belde','bolge_id','osb','lokasyon','adres','lat','lng','konum_yaklasik','icerik','kanal','bayi_id','takipci','takipci_tel','calisildi','tutar_usd','olasilik','beklenen_tarih','teklif_no','crm_kodu','urun_gruplari','sektor','alt_sektor','yeni_refit','yatirimci_id','projeci_id','danisman_id','gemut_id','emut_id','alici_id','ilgili_kisi_id','ziyaret_edilecek','sorulacak','notlar','fotolar','siparis_tutari_usd','siparis_tarihi','bizim_teklif_usd','bizim_urun','rakip_marka','rakip_urun','rakip_birim_fiyat','rakip_miktar','rakip_toplam_usd','kayip_nedeni','kayip_aciklama','google_place_id','google_url','santiye_asamasi','alim_tarihi','referans','aday','aday_kaynak','ihale_tarihi'],
  proje_gecmis: ['id','proje_id','tarih','eski_durum','yeni_durum','notlar'],
  ziyaretler: ['id','tarih','saat','durum','firma_id','kisi_id','proje_id','amac','notlar','sonuc_tipi','sonuc','lat','lng','fotolar'],
  gorevler: ['id','baslik','son_tarih','oncelik','durum','firma_id','proje_id','kisi_id','notlar','atanan','tamamlayan'],
  urunler: ['id','kod','aciklama','aciklama2','aile','birim','stok','birim_fiyat_usd','stok_tarihi','depo'],
  stok_gecmis: ['id','kod','stok','birim_fiyat_usd','tarih','depo'],
  rakip_fiyatlar: ['id','aile','lumen_aralik','marka','urun_adi','fiyat_metin','birim_fiyat','para_birimi','tarih','kaynak','proje_id','notlar'],
  siparisler: ['id','siparis_no','belge_no','belge_turu','musteri_no','musteri_adi','firma_id','tarih','teslim_tarihi','referans','net_deger','para_birimi','proje_tanimi','proje_id','drv','siparis_notu','rapor_disi'],
  hedefler: ['id','yil','ceyrek','tutar_usd','resmi_usd','resmi_tl','kur','notlar'],
  bolgeler: ['id','ad','tip','grup','il','ilce','renk','geojson','notlar'],
  teklifler: ['id','proje_id','firma_id','kisi_id','teklif_no','tarih','gecerlilik','para_birimi','iskonto','kdv','kalemler','toplam','durum','notlar'],
  numuneler: ['id','urun_kod','urun_ad','adet','firma_id','kisi_id','proje_id','verilis','iade_tarihi','durum','notlar'],
  servis_kayitlari: ['id','tarih','tip','firma_id','kisi_id','proje_id','urun','adet','aciklama','durum','cozum','cozum_tarihi','fotolar'],
  masraflar: ['id','tarih','tip','tutar','km','aciklama','fis'],
  urun_aileleri: ['id','aile','ad','aciklama','ozellikler','datasheet_url','fotolar'],
  ayarlar: ['id','anahtar','deger'],
  tahsilatlar: ['id','firma_id','cari','belge_no','tarih','vade','tutar','para_birimi','odenen','durum','odeme_tarihi','notlar'],
  belgeler: ['id','proje_id','firma_id','ad','yol','tur','boyut','notlar','kategori'],
  yorumlar: ['id','tablo','kayit_id','metin','yazan','yazan_ad','etiketler','created_at'],
};
const ARRAYS = new Set(['tipler','fotolar','urun_gruplari','etiketler']);

export const S = Object.fromEntries(Object.keys(TABLES).map(t => [t, []]));
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

export function pick(table, obj) {
  const o = {};
  for (const k of TABLES[table]) {
    let v = obj[k];
    if (v === undefined) continue;
    if (v === '') v = null;
    if (ARRAYS.has(k) && !Array.isArray(v)) v = v ? [v] : [];
    o[k] = v;
  }
  return o;
}

// ---------- IndexedDB yardımcıları ----------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('saha-takip', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of ['kv', 'photos']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function kv(store, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, mode); const st = tx.objectStore(store);
    const req = fn(st); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error);
  });
}
export const idbGet = (k, store = 'kv') => kv(store, 'readonly', s => s.get(k));
export const idbSet = (k, v, store = 'kv') => kv(store, 'readwrite', s => s.put(v, k));
export const idbDel = (k, store = 'kv') => kv(store, 'readwrite', s => s.delete(k));

// Depo yolu için dosya adı (Türkçe karakter ve boşluk temizlenir)
export const guvenliAd = n => String(n || 'dosya').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);

// ---------- Görsel küçültme ----------
export async function shrink(file, max = 1600, q = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
}

// ---------- Deneme modu (tarayıcıda) ----------
class LocalAdapter {
  mode = 'local';
  urlCache = new Map();
  async init() { return true; }
  user() { return { email: 'Deneme modu (bu cihaz)' }; }
  async loadAll() {
    for (const t of Object.keys(TABLES)) S[t] = (await idbGet('t:' + t)) || [];
  }
  async persist(t) { await idbSet('t:' + t, S[t]); }
  async save(t, obj) {
    const row = pick(t, obj); if (!row.id) row.id = uuid();
    const i = S[t].findIndex(x => x.id === row.id);
    const full = { ...(i >= 0 ? S[t][i] : { created_at: new Date().toISOString() }), ...row, updated_at: new Date().toISOString() };
    if (i >= 0) S[t][i] = full; else S[t].push(full);
    await this.persist(t); return full;
  }
  async del(t, id) { S[t] = S[t].filter(x => x.id !== id); await this.persist(t); }
  async bulk(t, rows, onProgress) {
    const now = new Date().toISOString();
    const byId = new Map(S[t].map(x => [x.id, x]));
    for (const r of rows) { const p = pick(t, r); byId.set(p.id, { ...(byId.get(p.id) || { created_at: now }), ...p, updated_at: now }); }
    S[t] = [...byId.values()]; await this.persist(t); onProgress && onProgress(rows.length);
  }
  async upload(file) {
    const blob = await shrink(file); const path = 'local/' + uuid() + '.jpg';
    await idbSet(path, blob, 'photos'); return path;
  }
  async uploadFile(file) {
    const path = 'local/belge/' + uuid() + '-' + guvenliAd(file.name);
    await idbSet(path, file, 'photos'); return path;
  }
  async url(path) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    if (this.urlCache.has(path)) return this.urlCache.get(path);
    const b = await idbGet(path, 'photos'); if (!b) return null;
    const u = URL.createObjectURL(b); this.urlCache.set(path, u); return u;
  }
  async removePhoto(path) { await idbDel(path, 'photos'); }
  async clearAll() { for (const t of Object.keys(TABLES)) { S[t] = []; await this.persist(t); } }
}

// ---------- Supabase ----------
// Veritabanında henüz olmayan (yeni sürüm) sütunlar: hata alınca o sütun çıkarılıp yeniden denenir, kullanıcı bir kez uyarılır.
const MISSING = new Set();
const strip = (t, row) => { if (!MISSING.size) return row; const r = { ...row }; for (const k of Object.keys(r)) if (MISSING.has(t + '.' + k)) delete r[k]; return r; };
const missingCol = (e, t) => { const m = /Could not find the '(\w+)' column/i.exec(e?.message || ''); return m ? t + '.' + m[1] : null; };
let warned = false;
const warnOld = () => { if (warned) return; warned = true; window.dispatchEvent(new CustomEvent('schema-old')); };
function schemaErr(e, t) {
  const m = e?.message || String(e);
  if (/row-level security|permission denied/i.test(m)) return new Error('Bu bölümde düzenleme yetkin yok. Veri sahibinden yetki iste.');
  if (/column|schema cache|does not exist|Could not find/i.test(m)) return new Error('Veritabanı eski sürümde. Supabase SQL Editor\'de supabase/schema.sql dosyasını yeniden çalıştır. (' + m + ')');
  return new Error((t ? t + ': ' : '') + m);
}
async function upsertSafe(c, t, rows) {
  for (let i = 0; i < 12; i++) {
    const { error } = await c.from(t).upsert(Array.isArray(rows) ? rows.map(r => strip(t, r)) : strip(t, rows));
    if (!error) return;
    const col = missingCol(error, t);
    if (!col || MISSING.has(col)) throw error;
    MISSING.add(col); warnOld();
  }
}
class SupaAdapter {
  mode = 'supabase';
  urlCache = new Map();
  constructor(url, key) { this.c = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }); }
  async init() {
    const { data } = await this.c.auth.getSession();
    this.session = data.session;
    this.c.auth.onAuthStateChange((_e, s) => { this.session = s; });
    window.addEventListener('online', () => this.flush());
    return !!this.session;
  }
  user() { return this.session?.user || null; }
  async signIn(email, password) { const { data, error } = await this.c.auth.signInWithPassword({ email, password }); if (error) throw error; this.session = data.session; }
  async signUp(email, password) { const { data, error } = await this.c.auth.signUp({ email, password }); if (error) throw error; this.session = data.session; return data; }
  async signOut() { await this.c.auth.signOut(); this.session = null; }
  // Ekip yetkileri: veri sahibi mi, ekip üyesiyse hangi tablolar (schema.sql sürüm 8 gerekir; yoksa sahip sayılır)
  async yetkiYukle() {
    try { const { data, error } = await this.c.rpc('benim_yetkilerim'); if (error) throw error; this.yetki = data || { ben_sahip: true }; }
    catch { this.yetki = { ben_sahip: true }; }
    this.sahip = this.yetki?.sahip || this.user()?.id;
    return this.yetki;
  }
  async loadAll() {
    try {
      await this.yetkiYukle();
      for (const t of Object.keys(TABLES)) {
        let all = [], from = 0;
        for (;;) {
          const { data, error } = await this.c.from(t).select('*').range(from, from + 999);
          if (error && /does not exist|schema cache|Could not find/i.test(error.message)) { this.schemaOld = true; break; }
          if (error) throw error;
          all = all.concat(data); if (data.length < 1000) break; from += 1000;
        }
        S[t] = all;
      }
      await idbSet('cache:' + this.user()?.id, S);
      await this.flush();
    } catch (e) {
      const cached = await idbGet('cache:' + this.user()?.id);
      if (cached) { Object.assign(S, cached); this.offline = true; return; }
      throw e;
    }
  }
  async cache() { clearTimeout(this._ct); this._ct = setTimeout(() => idbSet('cache:' + this.user()?.id, S), 400); }
  async queue(op) { const q = (await idbGet('outbox')) || []; q.push(op); await idbSet('outbox', q); }
  async flush() {
    const q = (await idbGet('outbox')) || []; if (!q.length || !navigator.onLine) return;
    const rest = [];
    for (const op of q) {
      try {
        if (op.op === 'del') { const r = await this.c.from(op.t).delete().eq('id', op.id); if (r.error) throw r.error; }
        else if (op.op === 'upd') { const r = await this.c.from(op.t).update(strip(op.t, op.row)).eq('id', op.row.id); if (r.error) throw r.error; }
        else await upsertSafe(this.c, op.t, op.row);
      } catch (e) { rest.push(op); }
    }
    await idbSet('outbox', rest);
    window.dispatchEvent(new CustomEvent('outbox', { detail: rest.length }));
  }
  async pending() { return ((await idbGet('outbox')) || []).length; }
  async save(t, obj) {
    if (this.yazamaz(t, obj)) throw new Error('Bu bölümde düzenleme yetkin yok. Veri sahibinden yetki iste.');
    const row = pick(t, obj); if (!row.id) row.id = uuid();
    const i = S[t].findIndex(x => x.id === row.id), onceki = i >= 0 ? S[t][i] : null;
    // Ekleme yetkisi olmayan ekip üyesi (ör. kendisine atanan görev) yalnızca var olan kaydı günceller; upsert ekleme izni de ister
    const sadeceGuncelle = this.yetki?.ben_sahip === false && this.yetki.yetkiler?.[t] !== 'yaz' && i >= 0;
    const full = { ...(i >= 0 ? S[t][i] : {}), ...row, updated_at: new Date().toISOString() };
    if (i >= 0) S[t][i] = full; else S[t].push(full);
    this.cache();
    try {
      if (this.schemaOld && t === 'bolgeler') throw new Error('Bölgeleri kaydetmek için Supabase SQL Editor\'de supabase/schema.sql dosyasını yeniden çalıştır.');
      if (sadeceGuncelle) { const r = await this.c.from(t).update(strip(t, row)).eq('id', row.id).select('id'); if (r.error) throw r.error; if (!r.data?.length) throw new Error('row-level security: güncelleme yetkisi yok'); }
      else await upsertSafe(this.c, t, row);
    } catch (e) {
      if (e && e.message && /fetch|network|Failed/i.test(e.message)) { await this.queue({ op: sadeceGuncelle ? 'upd' : 'up', t, row }); window.dispatchEvent(new CustomEvent('outbox', { detail: 1 })); }
      else {
        // Kaydedilemeyen değişikliği ekrandan geri al
        const j = S[t].findIndex(x => x.id === row.id);
        if (onceki) S[t][j] = onceki; else if (j >= 0) S[t].splice(j, 1);
        this.cache();
        throw schemaErr(e);
      }
    }
    return full;
  }
  yazamaz(t, row) {
    if (this.yetki?.ben_sahip !== false || t === 'ayarlar' || t === 'yorumlar' || this.yetki.yetkiler?.[t] === 'yaz') return false;
    // kendisine atanan görevi güncelleyebilir
    if (t === 'gorevler' && row?.atanan && row.atanan.toLowerCase() === (this.user()?.email || '').toLowerCase() && S.gorevler.some(g => g.id === row.id)) return false;
    return true;
  }
  async del(t, id) {
    if (this.yazamaz(t)) throw new Error('Bu bölümde silme yetkin yok.');
    S[t] = S[t].filter(x => x.id !== id); this.cache();
    const { error } = await this.c.from(t).delete().eq('id', id);
    if (error) { if (/fetch|network/i.test(error.message)) await this.queue({ op: 'del', t, id }); else throw error; }
  }
  async bulk(t, rows, onProgress) {
    if (this.yazamaz(t)) throw new Error('Bu bölümde düzenleme yetkin yok.');
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400).map(r => pick(t, r));
      try { await upsertSafe(this.c, t, chunk); } catch (error) { throw schemaErr(error, t); }
      onProgress && onProgress(Math.min(i + 400, rows.length));
    }
    const byId = new Map(S[t].map(x => [x.id, x]));
    for (const r of rows) byId.set(r.id, { ...(byId.get(r.id) || {}), ...pick(t, r) });
    S[t] = [...byId.values()]; this.cache();
  }
  async upload(file) {
    if (!navigator.onLine) throw new Error('Fotoğraf yüklemek için internet bağlantısı gerekiyor.');
    const blob = await shrink(file);
    const path = `${this.sahip || this.user().id}/${uuid()}.jpg`;
    const { error } = await this.c.storage.from('fotograflar').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error; return path;
  }
  async uploadFile(file) {
    if (!navigator.onLine) throw new Error('Belge yüklemek için internet bağlantısı gerekiyor.');
    if (file.size > 45 * 1024 * 1024) throw new Error('Dosya 45 MB\'tan büyük.');
    const path = `${this.sahip || this.user().id}/belge/${uuid()}-${guvenliAd(file.name)}`;
    const { error } = await this.c.storage.from('fotograflar').upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (error) throw error; return path;
  }
  async url(path) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    const c = this.urlCache.get(path); if (c && c.exp > Date.now()) return c.u;
    const { data, error } = await this.c.storage.from('fotograflar').createSignedUrl(path, 3600);
    if (error) return null;
    this.urlCache.set(path, { u: data.signedUrl, exp: Date.now() + 3500e3 }); return data.signedUrl;
  }
  async removePhoto(path) { await this.c.storage.from('fotograflar').remove([path]); }
  async clearAll() {
    for (const t of Object.keys(TABLES).reverse()) {
      const { error } = await this.c.from(t).delete().not('id', 'is', null);
      if (error) throw error; S[t] = [];
    }
    this.cache();
  }
}

export function getConfig() {
  try { return JSON.parse(localStorage.getItem('saha-config') || 'null'); } catch { return null; }
}
export function setConfig(c) { try { localStorage.setItem('saha-config', JSON.stringify(c)); } catch {} }

export function makeAdapter() {
  const c = getConfig();
  if (c && c.mode === 'supabase' && c.url && c.key && window.supabase) return new SupaAdapter(c.url, c.key);
  return new LocalAdapter();
}
