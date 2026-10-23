// Uygulama genel durumu
export const SURUM = '33';   // her yayında artırılır; Ayarlar → Genel'de görünür
export const app = {
  db: null,
  filters: {},          // görünüm bazlı filtreler (oturum boyunca)
  refresh: () => {},    // geçerli görünümü yeniden çiz
};

export function loadFilters() {
  try { app.filters = JSON.parse(localStorage.getItem('saha-filters') || '{}'); } catch { app.filters = {}; }
}
export function saveFilters() {
  try { localStorage.setItem('saha-filters', JSON.stringify(app.filters)); } catch {}
}
export function F(view, defaults) {
  (app.filtreVars ||= {})[view] ||= { ...defaults };
  app.filters[view] = { ...defaults, ...(app.filters[view] || {}) };
  return app.filters[view];
}
