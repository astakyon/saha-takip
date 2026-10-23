// Leaflet + markercluster + XLSX taklitleri (CDN erişilemediği için)
(function () {
  class Evented { constructor() { this._h = {}; } on(e, f) { (this._h[e] ||= []).push(f); return this; } fire(e, d) { (this._h[e] || []).forEach(f => f(d)); return this; } }
  class Layer extends Evented {
    addTo(m) { m.addLayer(this); return this; }
    bindPopup(c) { this._popup = c; return this; } bindTooltip(t) { this._tip = t; return this; }
    openPopup() { const c = typeof this._popup === 'function' ? this._popup(this) : this._popup; let host = document.getElementById('__popup'); if (!host) { host = document.createElement('div'); host.id = '__popup'; document.body.appendChild(host); } host.innerHTML = ''; host.className = 'leaflet-popup-content'; host.style.cssText = 'position:fixed;top:120px;left:40%;z-index:2000;background:#fff;padding:14px;border-radius:12px;width:280px;box-shadow:0 8px 30px rgba(0,0,0,.25)'; if (c instanceof Node) host.appendChild(c); else host.innerHTML = c; return this; }
  }
  class Marker extends Layer { constructor(ll, o = {}) { super(); this.ll = ll; this.o = o; } setLatLng(ll) { this.ll = ll; return this; } getLatLng() { return { lat: this.ll[0], lng: this.ll[1] }; } }
  class Group extends Layer { constructor(a) { super(); this.items = []; } addLayer(l) { this.items.push(l); return this; } clearLayers() { this.items = []; return this; } }
  class Map extends Evented {
    constructor(el) { super(); this.el = typeof el === 'string' ? document.getElementById(el) : el; this.layers = []; this.c = { lat: 36.9, lng: 35.3 }; this.z = 8; this.el.classList.add('leaflet-container'); this.el.style.background = 'repeating-linear-gradient(0deg,#e8eef1,#e8eef1 39px,#d5dde2 40px),repeating-linear-gradient(90deg,#e8eef1,#e8eef1 39px,#d5dde2 40px)'; window.__maps = (window.__maps || []).concat(this); }
    addLayer(l) { if (!this.layers.includes(l)) this.layers.push(l); return this; } removeLayer(l) { this.layers = this.layers.filter(x => x !== l); return this; } hasLayer(l) { return this.layers.includes(l); }
    setView(c, z) { this.c = Array.isArray(c) ? { lat: c[0], lng: c[1] } : c; this.z = z ?? this.z; this.fire('moveend'); return this; }
    fitBounds() { this.fire('moveend'); return this; } getCenter() { return this.c; } getZoom() { return this.z; }
    invalidateSize() { return this; } remove() { this.removed = true; } getContainer() { return this.el; } closePopup() { document.getElementById('__popup')?.remove(); }
  }
  class Cluster extends Group { constructor() { super(); this.isCluster = true; } }
  window.L = {
    map: el => new Map(el), tileLayer: (u) => Object.assign(new Layer(), { url: u }), marker: (ll, o) => new Marker(ll, o), circleMarker: (ll, o) => new Marker(ll, o),
    divIcon: o => o, markerClusterGroup: () => new Cluster(), layerGroup: a => new Group(a),
    polygon: (ll, o) => Object.assign(new Layer(), { ll, o }), polyline: (ll, o) => Object.assign(new Layer(), { ll }),
    popup: () => { const p = new Layer(); p.setLatLng = () => p; p.setContent = c => { p._popup = c; return p; }; p.openOn = () => { p.openPopup(); return p; }; return p; },
    control: { zoom: () => new Layer(), layers: () => new Layer() }, DomEvent: { stop: () => {} },
  };
  window.__written = [];
  window.XLSX = { utils: { book_new: () => ({ s: {} }), json_to_sheet: r => r, book_append_sheet: (wb, s, n) => { wb.s[n] = s; }, sheet_to_json: s => s },
    write: wb => { window.__written.push({ n: 'write', sheets: Object.fromEntries(Object.entries(wb.s).map(([k, v]) => [k, v.length])) }); return new Uint8Array([80, 75, 3, 4]); },
    writeFile: (wb, n) => window.__written.push({ n, sheets: Object.fromEntries(Object.entries(wb.s).map(([k, v]) => [k, v.length])) }), read: () => ({ SheetNames: ['S'], Sheets: { S: window.__xlsxRows || [] } }) };
})();
