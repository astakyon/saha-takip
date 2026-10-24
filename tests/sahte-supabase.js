// Test için bellek içi sahte Supabase istemcisi. Gerçek veri içermez.
(function () {
  const DB = window.__DB = JSON.parse(localStorage.getItem('__DB') || '{}');
  let saat = Date.parse('2026-10-23T08:00:00Z');
  const simdi = () => new Date(saat += 1000).toISOString();
  window.__simdi = simdi;
  const kaydet = () => localStorage.setItem('__DB', JSON.stringify(DB));
  window.__kaydet = kaydet;
  const UPD = t => !['proje_gecmis', 'stok_gecmis'].includes(t);
  window.__istek = 0;
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.alan = '*'; this.r = null; this.cnt = null; }
    select(a = '*', o) { if (this.op === 'select') this.alan = a; else this.donus = a; if (o?.count) { this.cnt = true; this.head = o.head; } return this; }
    gt(k, v) { this.f.push(r => r[k] > v); return this; }
    gte(k, v) { this.f.push(r => r[k] >= v); return this; }
    eq(k, v) { this.f.push(r => r[k] === v); return this; }
    in(k, v) { this.f.push(r => v.includes(r[k])); return this; }
    not() { return this; }
    order() { return this; }
    limit() { return this; }
    range(a, b) { this.r = [a, b]; return this; }
    upsert(rows) { this.op = 'upsert'; this.rows = rows; return this; }
    insert(rows) { this.op = 'upsert'; this.rows = [].concat(rows).map(r => ({ id: r.id || crypto.randomUUID(), ...r })); return this; }
    update(row) { this.op = 'update'; this.row = row; return this; }
    delete() { this.op = 'delete'; return this; }
    maybeSingle() { this.tek = true; return this; }
    then(res, rej) { try { return Promise.resolve(this.calis()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } }
    catch(f) { return this.then(x => x, f); }
    calis() {
      window.__istek++;
      if (window.__cevrimdisi) return { data: null, error: { message: 'Failed to fetch' } };
      const T = DB[this.t] ||= [];
      if (this.op === 'select') {
        let l = T.filter(r => this.f.every(f => f(r)));
        const Y = JSON.parse(localStorage.getItem('__YETKI') || 'null');
        if (Y && Y.ben_sahip === false && !['ayarlar', 'yorumlar', 'ekip_uyeleri'].includes(this.t) && !Y.yetkiler?.[this.t]) l = this.t === 'gorevler' ? l.filter(r => r.atanan === 'uye@x.com') : [];
        if (this.cnt) return { data: this.head ? null : l, count: l.length, error: null };
        if (this.tek) return { data: l[0] || null, error: null };
        if (this.r) l = l.slice(this.r[0], this.r[1] + 1);
        if (this.alan === 'id') l = l.map(r => ({ id: r.id }));
        return { data: JSON.parse(JSON.stringify(l)), error: null };
      }
      if (this.op === 'upsert') {
        const out = [];
        for (const row of [].concat(this.rows)) { const i = T.findIndex(r => r.id === row.id); const n = { ...(i >= 0 ? T[i] : { created_at: simdi(), owner: (JSON.parse(localStorage.getItem('__YETKI') || 'null')?.sahip) || (localStorage.getItem('__YETKI') ? 'u2' : 'u1') }), ...row }; if (UPD(this.t)) n.updated_at = simdi(); if (i >= 0) T[i] = n; else T.push(n); out.push(n); }
        kaydet(); return { data: this.donus ? out.map(r => ({ updated_at: r.updated_at })) : null, error: null };
      }
      if (this.op === 'update') {
        const l = T.filter(r => this.f.every(f => f(r))); for (const r of l) { Object.assign(r, this.row); if (UPD(this.t)) r.updated_at = simdi(); }
        kaydet(); return { data: l.map(r => ({ id: r.id, updated_at: r.updated_at })), error: null };
      }
      if (this.op === 'delete') { DB[this.t] = T.filter(r => !this.f.every(f => f(r))); kaydet(); return { data: null, error: null }; }
    }
  }
  const user = { id: localStorage.getItem('__YETKI') ? 'u2' : 'u1', email: localStorage.getItem('__YETKI') ? 'uye@x.com' : 'sahip@x.com', last_sign_in_at: new Date().toISOString() };
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: localStorage.getItem('__OTURUMYOK') ? null : { user } } }),
      signInWithPassword: async ({ email, password }) => { (window.__auth ||= []).push(['giris', email]); if (password !== 'dogru123') return { data: {}, error: { message: 'Invalid login credentials' } }; localStorage.removeItem('__OTURUMYOK'); return { data: { session: { user } }, error: null }; },
      signInWithOtp: async o => { (window.__auth ||= []).push(['otp', o.email, o.options?.emailRedirectTo]); return { error: null }; },
      resetPasswordForEmail: async (e, o) => { (window.__auth ||= []).push(['reset', e, o?.redirectTo]); return { error: null }; },
      signUp: async o => { (window.__auth ||= []).push(['kayit', o.email]); return { data: { user: { identities: [{}] }, session: null }, error: null }; },
      updateUser: async o => { (window.__auth ||= []).push(['sifre', o.password]); return { data: {}, error: null }; }, onAuthStateChange: () => {}, mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }), listFactors: async () => ({ data: { totp: [], all: [] } }) }, signOut: async () => ({}) },
    from: t => new Q(t),
    rpc: async (n, a) => n === 'yonetici_mi' ? { data: !!localStorage.getItem('__YONETICI'), error: null }
      : n === 'yonetim_hesaplar' ? { data: [...new Set(Object.values(DB).flat().map(r => r?.owner).filter(Boolean))].map(o => ({ owner: o, eposta: o + '@x.com', firma: o === 'u1' ? 'Sahip Firma' : 'Firma ' + o, tur: 'test', durum: 'aktif', kayit: '2026-10-01', son_giris: '2026-10-23', son_islem: '2026-10-23', kurulum: true, ekip: 0, projeler: (DB.projeler || []).filter(r => r.owner === o).length, firmalar: (DB.firmalar || []).filter(r => r.owner === o).length, kisiler: 0, ziyaretler: (DB.ziyaretler || []).filter(r => r.owner === o).length, gorevler: 0, teklifler: 0, siparisler: 0, belgeler: 0 })), error: null }
      : n === 'yonetim_ekip' ? { data: [], error: null }
      : n === 'hesap_kaydol' ? { data: { tur: 'test', durum: localStorage.getItem('__ASKIDA') ? 'askida' : 'aktif' }, error: null } : n === 'benim_yetkilerim' ? { data: JSON.parse(localStorage.getItem('__YETKI') || 'null') || { sahip: 'u1', ben_sahip: true }, error: null } : n === 'yetki_surum' ? { data: 15, error: null } : n === 'giris_epostasi' ? { data: a?.ad === 'burak' ? 'sahip@x.com' : null, error: null } : n === 'yedek_guvenli' ? { data: true, error: null } : { data: [], error: null },
    storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null, error: { message: 'yok' } }), list: async () => ({ data: [], error: null }), remove: async () => ({}) }) },
    functions: { invoke: async () => ({ data: null }) },
  }) };
})();
