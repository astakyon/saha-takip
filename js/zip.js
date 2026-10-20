// Sıkıştırmasız (store) ZIP yazıcı: PowerPoint / Office dosyaları için yeterli, dış kütüphane gerektirmez.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// dosyalar: [[ad, string | Uint8Array], ...]
export function zipYaz(dosyalar, tarih = new Date()) {
  const enc = new TextEncoder();
  const dt = ((tarih.getHours() << 11) | (tarih.getMinutes() << 5) | (tarih.getSeconds() >> 1)) & 0xFFFF;
  const dd = (((tarih.getFullYear() - 1980) << 9) | ((tarih.getMonth() + 1) << 5) | tarih.getDate()) & 0xFFFF;
  const parcalar = [], merkez = []; let ofs = 0;
  for (const [ad, icerik] of dosyalar) {
    const veri = typeof icerik === 'string' ? enc.encode(icerik) : icerik, adB = enc.encode(ad), crc = crc32(veri);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, veri.length, true); h.setUint32(22, veri.length, true);
    h.setUint16(26, adB.length, true); h.setUint16(28, 0, true);
    parcalar.push(new Uint8Array(h.buffer), adB, veri);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, veri.length, true); c.setUint32(24, veri.length, true);
    c.setUint16(28, adB.length, true); c.setUint32(42, ofs, true);
    merkez.push(new Uint8Array(c.buffer), adB);
    ofs += 30 + adB.length + veri.length;
  }
  const mBoy = merkez.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, dosyalar.length, true); e.setUint16(10, dosyalar.length, true); e.setUint32(12, mBoy, true); e.setUint32(16, ofs, true);
  return new Blob([...parcalar, ...merkez, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
