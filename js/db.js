// Veri katmanı: Supabase (bulut) veya Deneme (bu cihazın tarayıcısı)
export const TABLES = {
  firmalar: ['id','ad','tipler','il','ilce','adres','lat','lng','konum_yaklasik','telefon','eposta','web','vergi_no','segment','sektor','key_account','notlar','fotolar'],
  kisiler: ['id','firma_id','ad_soyad','unvan','telefon','eposta','rol','kartvizit_on','kartvizit_arka','dogum_gunu','notlar'],
  projeler: ['id','ad','durum','durum_alt','kritik','takip_yili','hedef_listesi','baska_bolge','il','ilce','osb','lokasyon','adres','lat','lng','konum_yaklasik','icerik','kanal','bayi_id','takipci','takipci_tel','calisildi','tutar_usd','olasilik','beklenen_tarih','teklif_no','crm_kodu','urun_gruplari','sektor','alt_sektor','yeni_refit','yatirimci_id','projeci_id','danisman_id','gemut_id','emut_id','alici_id','ilgili_kisi_id','ziyaret_edilecek','sorulacak','notlar','fotolar','siparis_tutari_usd','siparis_tarihi','bizim_teklif_usd','bizim_urun','rakip_marka','rakip_urun','rakip_birim_fiyat','rakip_miktar','rakip_toplam_usd','kayip_nedeni','kayip_aciklama'],
  proje_gecmis: ['id','proje_id','tarih','eski_durum','yeni_durum','notlar'],
  ziyaretler: ['id','tarih','firma_id','kisi_id','proje_id','amac','notlar','lat','lng','fotolar'],
  gorevler: ['id','baslik','son_tarih','oncelik','durum','firma_id','proje_id','kisi_id','notlar'],
  urunler: ['id','kod','aciklama','aciklama2','aile','birim','stok','birim_fiyat_usd','stok_tarihi','depo'],
  stok_gecmis: ['id','kod','stok','birim_fiyat_usd','tarih','depo'],
  rakip_fiyatlar: ['id','aile','lumen_aralik','marka','urun_adi','fiyat_metin','birim_fiyat','para_birimi','tarih','kaynak','proje_id','notlar'],
  siparisler: ['id','siparis_no','belge_no','belge_turu','musteri_no','musteri_adi','firma_id','tarih','teslim_tarihi','referans','net_deger','para_birimi','proje_tanimi','proje_id','drv'],
  hedefler: ['id','yil','ceyrek','tutar_usd'],
};
const ARRAYS = new Set(['tipler','fotolar','urun_gruplari']);

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
  async url(path) {
    if (!path) return null;
    if (this.urlCache.has(path)) return this.urlCache.get(path);
    const b = await idbGet(path, 'photos'); if (!b) return null;
    const u = URL.createObjectURL(b); this.urlCache.set(path, u); return u;
  }
  async removePhoto(path) { await idbDel(path, 'photos'); }
  async clearAll() { for (const t of Object.keys(TABLES)) { S[t] = []; await this.persist(t); } }
}

// ---------- Supabase ----------
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
  async loadAll() {
    try {
      for (const t of Object.keys(TABLES)) {
        let all = [], from = 0;
        for (;;) {
          const { data, error } = await this.c.from(t).select('*').range(from, from + 999);
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
        const r = op.op === 'del' ? await this.c.from(op.t).delete().eq('id', op.id) : await this.c.from(op.t).upsert(op.row);
        if (r.error) throw r.error;
      } catch (e) { rest.push(op); }
    }
    await idbSet('outbox', rest);
    window.dispatchEvent(new CustomEvent('outbox', { detail: rest.length }));
  }
  async pending() { return ((await idbGet('outbox')) || []).length; }
  async save(t, obj) {
    const row = pick(t, obj); if (!row.id) row.id = uuid();
    const i = S[t].findIndex(x => x.id === row.id);
    const full = { ...(i >= 0 ? S[t][i] : {}), ...row, updated_at: new Date().toISOString() };
    if (i >= 0) S[t][i] = full; else S[t].push(full);
    this.cache();
    try {
      const { error } = await this.c.from(t).upsert(row);
      if (error) throw error;
    } catch (e) {
      if (e && e.message && /fetch|network|Failed/i.test(e.message)) { await this.queue({ op: 'up', t, row }); window.dispatchEvent(new CustomEvent('outbox', { detail: 1 })); }
      else throw e;
    }
    return full;
  }
  async del(t, id) {
    S[t] = S[t].filter(x => x.id !== id); this.cache();
    const { error } = await this.c.from(t).delete().eq('id', id);
    if (error) { if (/fetch|network/i.test(error.message)) await this.queue({ op: 'del', t, id }); else throw error; }
  }
  async bulk(t, rows, onProgress) {
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400).map(r => pick(t, r));
      const { error } = await this.c.from(t).upsert(chunk);
      if (error) throw new Error(`${t}: ${error.message}`);
      onProgress && onProgress(Math.min(i + 400, rows.length));
    }
    const byId = new Map(S[t].map(x => [x.id, x]));
    for (const r of rows) byId.set(r.id, { ...(byId.get(r.id) || {}), ...pick(t, r) });
    S[t] = [...byId.values()]; this.cache();
  }
  async upload(file) {
    if (!navigator.onLine) throw new Error('Fotoğraf yüklemek için internet bağlantısı gerekiyor.');
    const blob = await shrink(file);
    const path = `${this.user().id}/${uuid()}.jpg`;
    const { error } = await this.c.storage.from('fotograflar').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error; return path;
  }
  async url(path) {
    if (!path) return null;
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
