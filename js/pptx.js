// Tek tuşla çeyrek toplantı sunumu (.pptx): şirketin çeyrek sunum düzeninde, düzenlenebilir tablolarla
import { S } from './db.js';
import { byId, firmaAd, today, download, toast, openDrawer, closeDrawer, ACIK, num } from './ui.js';
import { zipYaz } from './zip.js';
import { TEMA } from './pptx-tema.js';
import { benimAdim } from './sablon.js';
import { yilGercek } from './ceyrek.js';
import { disaAktarabilir } from './yetki.js';

const W = 12192000, H = 6858000, CM = 360000;
const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const RENK = { ink: '1D2B36', lumen: 'F5B700', gri: '66757F', acik: 'F4F6F8', cizgi: 'D0D7DE', yesil: '15803D', kirmizi: 'B91C1C', mor: '7C3AED' };
const usdT = v => v ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v) + ' $' : '';

// ---------- Şekiller ----------
let sid = 2;
const run = (t, { sz = 1400, b = false, renk = RENK.ink } = {}) => `<a:r><a:rPr lang="tr-TR" sz="${sz}" b="${b ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${renk}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${x(t)}</a:t></a:r>`;
const para = (t, o = {}) => `<a:p><a:pPr algn="${o.algn || 'l'}"/>${String(t ?? '') === '' ? '' : run(t, o)}<a:endParaRPr lang="tr-TR" sz="${o.sz || 1400}"/></a:p>`;
function kutu({ x: X, y: Y, w, h, metin = '', satirlar, dolgu, cizgi, sz = 1400, b = false, renk = RENK.ink, algn = 'l', anchor = 't', geom = 'rect' }) {
  const ps = (satirlar || String(metin).split('\n')).map(s => typeof s === 'string' ? para(s, { sz, b, renk, algn }) : para(s.t, { sz, b, renk, algn, ...s })).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${sid++}" name="Kutu ${sid}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(X)}" y="${Math.round(Y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${dolgu ? `<a:solidFill><a:srgbClr val="${dolgu}"/></a:solidFill>` : '<a:noFill/>'}${cizgi ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${cizgi}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}</p:spPr>
    <p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${ps}</p:txBody></p:sp>`;
}
function tablo({ x: X, y: Y, w, basliklar, satirlar, oranlar, sz = 1000, satirH = 0.85 * CM, sag = [] }) {
  const top = oranlar.reduce((a, b) => a + b, 0), gen = oranlar.map(o => Math.round(w * o / top));
  const ln = `<a:lnL w="6350"><a:solidFill><a:srgbClr val="${RENK.cizgi}"/></a:solidFill></a:lnL><a:lnR w="6350"><a:solidFill><a:srgbClr val="${RENK.cizgi}"/></a:solidFill></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="${RENK.cizgi}"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="${RENK.cizgi}"/></a:solidFill></a:lnB>`;
  const hucre = (t, i, bas, zebra) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${String(t ?? '').split('\n').map(s => para(s, { sz, b: bas, renk: bas ? 'FFFFFF' : RENK.ink, algn: sag.includes(i) && !bas ? 'r' : 'l' })).join('')}</a:txBody><a:tcPr marL="54864" marR="54864" marT="27432" marB="27432" anchor="ctr">${ln}<a:solidFill><a:srgbClr val="${bas ? RENK.ink : zebra ? RENK.acik : 'FFFFFF'}"/></a:solidFill></a:tcPr></a:tc>`;
  const rows = [`<a:tr h="${Math.round(satirH * 1.1)}">${basliklar.map((t, i) => hucre(t, i, true)).join('')}</a:tr>`, ...satirlar.map((r, j) => `<a:tr h="${Math.round(satirH)}">${r.map((t, i) => hucre(t, i, false, j % 2)).join('')}</a:tr>`)];
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${sid++}" name="Tablo ${sid}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
    <p:xfrm><a:off x="${Math.round(X)}" y="${Math.round(Y)}"/><a:ext cx="${gen.reduce((a, b) => a + b, 0)}" cy="${Math.round(satirH * (satirlar.length + 1.1))}"/></p:xfrm>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${gen.map(g => `<a:gridCol w="${g}"/>`).join('')}</a:tblGrid>${rows.join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
const baslik = t => kutu({ x: 0.9 * CM, y: 0.5 * CM, w: W - 1.8 * CM, h: 1.4 * CM, metin: t, sz: 2400, b: true, anchor: 'ctr' }) + kutu({ x: 0.9 * CM, y: 1.95 * CM, w: 3 * CM, h: 0.12 * CM, dolgu: RENK.lumen });
const altbilgi = (n, t) => kutu({ x: 0.9 * CM, y: H - 1.0 * CM, w: W - 1.8 * CM, h: 0.7 * CM, satirlar: [{ t: `${t} · ${n}`, sz: 900, renk: RENK.gri, algn: 'r' }] });

// ---------- Slayt üreticileri ----------
function bolumSlayti(t) { return kutu({ x: 0, y: 0, w: W, h: H, dolgu: RENK.ink }) + kutu({ x: 1.5 * CM, y: H / 2 - 1.6 * CM, w: W - 3 * CM, h: 2.4 * CM, metin: t, sz: 4000, b: true, renk: 'FFFFFF', anchor: 'ctr' }) + kutu({ x: 1.5 * CM, y: H / 2 + 1.0 * CM, w: 4 * CM, h: 0.18 * CM, dolgu: RENK.lumen }); }
function tabloSlaytlari(t, basliklar, satirlar, oranlar, { sag = [], bos = 'Kayıt yok', sayfa = 12 } = {}) {
  if (!satirlar.length) return [baslik(t) + kutu({ x: 0.9 * CM, y: 2.6 * CM, w: W - 1.8 * CM, h: 1.2 * CM, metin: bos, sz: 1400, renk: RENK.gri })];
  const out = [];
  for (let i = 0; i < satirlar.length; i += sayfa) {
    const parca = satirlar.slice(i, i + sayfa);
    out.push(baslik(t + (satirlar.length > sayfa ? ` (${i / sayfa + 1}/${Math.ceil(satirlar.length / sayfa)})` : '')) + tablo({ x: 0.9 * CM, y: 2.5 * CM, w: W - 1.8 * CM, basliklar, satirlar: parca, oranlar, sag }));
  }
  return out;
}
function cubukGrafik({ X, Y, w, h, gruplar, seriler }) { // gruplar: etiketler, seriler: [{ad, renk, degerler}]
  const max = Math.max(1, ...seriler.flatMap(s => s.degerler)), gw = w / gruplar.length, bw = gw * 0.7 / seriler.length;
  let s = kutu({ x: X, y: Y + h, w, h: 0.03 * CM, dolgu: RENK.cizgi });
  gruplar.forEach((g, i) => {
    seriler.forEach((se, j) => {
      const v = se.degerler[i] || 0, bh = Math.max(v ? 0.05 * CM : 0, (h - 0.8 * CM) * v / max), bx = X + i * gw + gw * 0.15 + j * bw;
      s += kutu({ x: bx, y: Y + h - bh, w: bw * 0.92, h: bh, dolgu: se.renk });
      if (v) s += kutu({ x: bx - 0.3 * CM, y: Y + h - bh - 0.65 * CM, w: bw + 0.6 * CM, h: 0.6 * CM, satirlar: [{ t: usdT(v), sz: 900, algn: 'ctr', renk: RENK.gri }] });
    });
    s += kutu({ x: X + i * gw, y: Y + h + 0.1 * CM, w: gw, h: 0.6 * CM, satirlar: [{ t: g, sz: 1100, b: true, algn: 'ctr' }] });
  });
  s += kutu({ x: X, y: Y - 0.8 * CM, w, h: 0.6 * CM, satirlar: [{ t: seriler.map(se => '■ ' + se.ad).join('     '), sz: 1000, renk: RENK.gri }] });
  return s;
}

// ---------- Veri ----------
const ceyrekOf = d => Math.floor(new Date(d).getMonth() / 3) + 1;
const sum = (a, f) => a.reduce((s, v) => s + (+f(v) || 0), 0);
const lumenAralik = lm => lm < 5000 ? '0-5.000 lm' : lm < 10000 ? '5.000-10.000 lm' : lm < 15000 ? '10.000-15.000 lm' : lm < 20000 ? '15.000-20.000 lm' : lm < 30000 ? '20.000-30.000 lm' : '30.000 ve daha yüksek lm';

export function sunumVerisi(Y, C) {
  const tem = (benimAdim() || 'Bölge Satış').split(/\s*[·|,-]\s*/)[0];
  const G = yilGercek(Y);
  const hed = G.map(g => g.hedef);
  const ger = G.map((g, i) => i + 1 <= C ? g.gercek : 0);
  const yP = S.projeler.filter(p => +p.takip_yili === Y);
  const projeSip = p => sum(S.siparisler.filter(s => s.proje_id === p.id && s.para_birimi === 'USD' && !s.rapor_disi && s.tarih?.startsWith(String(Y))), s => s.net_deger) || +p.siparis_tutari_usd || 0;
  const musteri = p => firmaAd(p.alici_id) || firmaAd(p.emut_id) || firmaAd(p.gemut_id) || firmaAd(p.yatirimci_id);
  // Uzun listeler en büyük 22 kayıtla sınırlanır, kalanlar tek satırda toplanır (sunum 2 slaytı geçmesin)
  const kirp = (rows, val, n = 22, ozet) => rows.length <= n + 2 ? rows : [...rows.slice(0, n), ozet(rows.length - n, rows.slice(n).reduce((s, r) => s + val(r), 0))];
  const pot = ps => { const l = ps.filter(p => p.tutar_usd || ps.length < 25).sort((a, b) => (b.tutar_usd || 0) - (a.tutar_usd || 0)); return kirp(l, p => +p.tutar_usd || 0, 22, (k, t) => ({ _ozet: [tem, '', `Diğer ${k} proje`, '', '', usdT(t), '', ''] })).map(p => p._ozet || [tem, musteri(p), p.ad, p.yeni_refit || '', p.sektor || '', usdT(p.tutar_usd), (p.urun_gruplari || []).join(' - '), p.rakip_marka || '']); };
  const potansiyel = pot(yP.filter(p => ACIK.includes(p.durum)));
  const stratejik = pot(S.projeler.filter(p => +p.takip_yili === Y + 1 && ACIK.includes(p.durum)));
  const kz = S.projeler.filter(p => p.durum === 'Sipariş' && (+p.takip_yili === Y || projeSip(p))).map(p => [p, projeSip(p) || +p.tutar_usd || 0]).sort((a, b) => b[1] - a[1]);
  const kazanilan = kirp(kz, r => r[1], 22, (k, t) => [{ ad: `Diğer ${k} proje`, _o: 1 }, t]).map(([p, v]) => [tem, p.ad, p._o ? '' : p.yeni_refit || '', p._o ? '' : p.sektor || '', usdT(v), p._o ? '' : p.rakip_marka || '']);
  const kayip = yP.filter(p => p.durum === 'Kayıp').sort((a, b) => (b.bizim_teklif_usd || b.tutar_usd || 0) - (a.bizim_teklif_usd || a.tutar_usd || 0))
    .map(p => [tem, musteri(p), p.ad, [p.kayip_nedeni, p.kayip_aciklama].filter(Boolean).join(': '), p.sektor || '', p.bizim_urun || (p.urun_gruplari || []).join(' - '), usdT(p.bizim_teklif_usd || p.tutar_usd), [p.rakip_marka, p.rakip_urun].filter(Boolean).join(' · ')]);
  // Bayi ziyaretleri çeyrek bazında
  const bayiler = S.firmalar.filter(f => (f.tipler || []).includes('Bayi') || S.projeler.some(p => p.bayi_id === f.id));
  const zy = S.ziyaretler.filter(z => (z.durum || 'Yapıldı') === 'Yapıldı' && z.tarih?.startsWith(String(Y)));
  const bayiZ = bayiler.map(f => [f.ad, tem, ...[1, 2, 3, 4].map(c => { const n = zy.filter(z => z.firma_id === f.id && ceyrekOf(z.tarih) === c).length; return c <= C ? String(n) : ''; })]).filter(r => r.slice(2).some(v => v && v !== '0') || bayiler.length <= 8);
  // Stratejik firmalar: açık / kazanılan projelerde rolü olanlar
  const aktif = S.projeler.filter(p => ACIK.includes(p.durum) || p.durum === 'Sipariş');
  const rolFirmalar = keys => { const m = new Map(); for (const p of aktif) for (const k of keys) if (p[k]) m.set(p[k], (m.get(p[k]) || 0) + (+p.tutar_usd || 0)); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([id]) => byId('firmalar', id)).filter(Boolean)
    .map(f => [tem, f.ad, S.kisiler.filter(k => k.firma_id === f.id).slice(0, 2).map(k => [k.ad_soyad, k.unvan, k.telefon].filter(Boolean).join(' · ')).join('\n')]); };
  // Rakip fiyatları aile bazında
  const aileler = {};
  for (const r of S.rakip_fiyatlar) { const a = r.aile || 'Diğer'; (aileler[a] ||= {}); const m = (aileler[a][r.marka] ||= {}); const k = r.lumen_aralik || 'Belirtilmemiş'; m[k] = [m[k], [r.urun_adi, r.fiyat_metin || (r.birim_fiyat != null ? r.birim_fiyat + ' ' + (r.para_birimi || 'USD') : '')].filter(Boolean).join(' · ')].filter(Boolean).join('\n'); }
  return { tem, hed, ger, potansiyel, stratejik, kazanilan, kayip, bayiZ, yatirimci: rolFirmalar(['yatirimci_id']), muteahhit: rolFirmalar(['gemut_id', 'emut_id', 'alici_id']), danisman: rolFirmalar(['danisman_id', 'projeci_id']), aileler, lumenAralik };
}

export function sunumOlustur(Y, C) {
  sid = 2;
  const d = sunumVerisi(Y, C);
  const slaytlar = [];
  const ek = s => Array.isArray(s) ? slaytlar.push(...s) : slaytlar.push(s);
  // Kapak
  ek(kutu({ x: 0, y: 0, w: W, h: H, dolgu: RENK.ink }) + kutu({ x: 1.5 * CM, y: 4.2 * CM, w: W - 3 * CM, h: 2.6 * CM, satirlar: [{ t: `${Y} ${C}. ÇEYREK DEĞERLENDİRME`, sz: 4000, b: true, renk: 'FFFFFF' }] })
    + kutu({ x: 1.5 * CM, y: 7.0 * CM, w: 5 * CM, h: 0.2 * CM, dolgu: RENK.lumen })
    + kutu({ x: 1.5 * CM, y: 7.6 * CM, w: W - 3 * CM, h: 3 * CM, satirlar: [{ t: 'Adana · Mersin · Hatay · Osmaniye', sz: 2000, renk: 'FFFFFF' }, { t: d.tem, sz: 1600, renk: 'B6C2CA' }, { t: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }), sz: 1400, renk: 'B6C2CA' }] }));
  // Hedef ve gerçekleşen
  const topH = d.hed.reduce((a, b) => a + b, 0), topG = d.ger.reduce((a, b) => a + b, 0);
  ek(baslik(`${Y} / SATIŞ HEDEFLERİMİZ & GERÇEKLEŞEN SATIŞLAR`)
    + tablo({ x: 0.9 * CM, y: 2.5 * CM, w: W - 1.8 * CM, basliklar: ['MÜŞTERİ TEMSİLCİSİ', `${Y} Satış Hedefi`, ...[1, 2, 3, 4].map(c => `${c}. ÇEYREK Hedef / Gerçekleşen`)], oranlar: [2.2, 1.6, 2, 2, 2, 2], sag: [1, 2, 3, 4, 5],
      satirlar: [[d.tem, usdT(topH), ...[0, 1, 2, 3].map(i => i < C ? `${usdT(d.hed[i]) || '—'} / ${usdT(d.ger[i]) || '0 $'}${d.hed[i] ? ` (%${num(Math.round(d.ger[i] / d.hed[i] * 100))})` : ''}` : `${usdT(d.hed[i]) || '—'} / —`)],
        ['Toplam gerçekleşen', usdT(topG), ...[0, 1, 2, 3].map(() => ''), ].slice(0, 6)] })
    + cubukGrafik({ X: 2 * CM, Y: 7.6 * CM, w: W - 4 * CM, h: 8.6 * CM, gruplar: ['1. Çeyrek', '2. Çeyrek', '3. Çeyrek', '4. Çeyrek'], seriler: [{ ad: 'Hedef', renk: 'B6C2CA', degerler: d.hed }, { ad: 'Gerçekleşen', renk: RENK.lumen, degerler: d.ger }] }));
  ek(bolumSlayti('POTANSİYEL PROJELER'));
  ek(tabloSlaytlari(`${Y} / SATIŞ HEDEFLERİMİZ / POTANSİYEL PROJELER`, ['MÜŞTERİ TEMSİLCİSİ', 'MÜŞTERİ', 'PROJE', 'YENİ/REFİT', 'SEKTÖR', 'TUTAR', 'PROJEDE KULLANILAN ÜRÜNLER', 'RAKİP FİRMA'], d.potansiyel, [1.5, 2.2, 2.8, 1, 1.4, 1.2, 1.8, 1.2], { sag: [5] }));
  if (d.stratejik.length) ek(tabloSlaytlari(`${Y + 1} / POTANSİYEL VE STRATEJİK PROJELER`, ['MÜŞTERİ TEMSİLCİSİ', 'MÜŞTERİ', 'PROJE', 'YENİ/REFİT', 'SEKTÖR', 'TUTAR', 'PROJEDE KULLANILAN ÜRÜNLER', 'RAKİP FİRMA'], d.stratejik, [1.5, 2.2, 2.8, 1, 1.4, 1.2, 1.8, 1.2], { sag: [5] }));
  ek(bolumSlayti('GERÇEKLEŞEN / PROJELER'));
  ek(tabloSlaytlari(`${Y} / SATIŞ YAPILAN PROJELER`, ['MÜŞTERİ TEMSİLCİSİ', 'PROJE', 'YENİ/REFİT', 'SEKTÖR', 'SATIŞ YAPILAN TUTAR', 'RAKİP FİRMA'], d.kazanilan, [1.5, 3.5, 1, 1.6, 1.5, 1.5], { sag: [4] }));
  ek(bolumSlayti('KAYIP / PROJELER'));
  ek(tabloSlaytlari(`${Y} / KAYIP PROJELER`, ['MÜŞTERİ TEMSİLCİSİ', 'MÜŞTERİ ADI', 'PROJE', 'KAYIP NEDENİ', 'SEKTÖR', 'PROJEDE KULLANILAN ÜRÜN', 'TUTAR', 'İŞİ ALAN FİRMA'], d.kayip, [1.4, 1.8, 2.2, 2.2, 1.2, 1.5, 1.1, 1.5], { sag: [6], sayfa: 8 }));
  ek(bolumSlayti('BAYİLER & ZİYARETLER'));
  ek(tabloSlaytlari(`${Y} / BAYİLER / ZİYARETLER`, ['BAYİ İSMİ', 'MÜŞTERİ TEMSİLCİSİ', '1. ÇEYREK', '2. ÇEYREK', '3. ÇEYREK', '4. ÇEYREK'], d.bayiZ, [3, 2, 1, 1, 1, 1], { sag: [2, 3, 4, 5] }));
  for (const [b1, b2, l] of [['STRATEJİK YATIRIMCILAR & İŞLETMELER', 'STRATEJİK YATIRIMCILAR ve İŞLETMELER', d.yatirimci], ['STRATEJİK MÜTEAHHİTLER', 'STRATEJİK MÜTEAHHİTLER', d.muteahhit], ['STRATEJİK DANIŞMANLAR & TASARIMCILAR', 'STRATEJİK DANIŞMANLAR & TASARIMCILAR', d.danisman]]) {
    ek(bolumSlayti(b1)); ek(tabloSlaytlari(`${Y} / ${b2}`, ['MÜŞTERİ TEMSİLCİSİ', 'FİRMA İSMİ', 'FİRMA KONTAK KİŞİ'], l, [1.5, 3, 4], { sayfa: 10 }));
  }
  ek(bolumSlayti('BEKLENTİLER / TEHLİKELER / RAKİPLER'));
  ek(baslik(`${Y} / BEKLENTİLER - TEHLİKELER - RAKİPLER`) + tablo({ x: 0.9 * CM, y: 2.5 * CM, w: W - 1.8 * CM, basliklar: ['MÜŞTERİ TEMSİLCİSİ', 'AÇIKLAMA'], oranlar: [1.5, 6], satirlar: [[d.tem, 'Beklentiler: '], ['', 'Tehlikeler: '], ['', 'Rakipler: ']], satirH: 2.6 * CM, sz: 1200 }));
  ek(bolumSlayti('STRATEJİ / ODAKLARI'));
  ek(baslik(`${Y} / STRATEJİ ODAKLARIMIZ`) + tablo({ x: 0.9 * CM, y: 2.5 * CM, w: W - 1.8 * CM, basliklar: ['MÜŞTERİ TEMSİLCİSİ', 'AÇIKLAMA'], oranlar: [1.5, 6], satirlar: [[d.tem, '']], satirH: 7 * CM, sz: 1200 }));
  // Rakip fiyatları
  for (const [aile, markalar] of Object.entries(d.aileler)) {
    const araliklar = [...new Set(Object.values(markalar).flatMap(m => Object.keys(m)))].sort((a, b) => parseFloat(a.replace('.', '')) - parseFloat(b.replace('.', '')) || a.localeCompare(b));
    ek(tabloSlaytlari(`${aile} Rakipleri`, ['Rakip Adı', ...araliklar.map(a => a + ' ürün ve fiyatı')], Object.entries(markalar).map(([m, v]) => [m, ...araliklar.map(a => v[a] || '')]), [1.4, ...araliklar.map(() => 2)], { sayfa: 8 }));
  }
  const toplam = slaytlar.length;
  return slaytlar.map((s, i) => i === 0 ? s : s + altbilgi(`${i + 1} / ${toplam}`, `${Y} ${C}. Çeyrek · ${d.tem}`));
}

export function pptxPaketle(slaytlar) {
  const n = slaytlar.length;
  const files = [
    ['[Content_Types].xml', `${XH}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slaytlar.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
    ['docProps/core.xml', `${XH}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Çeyrek değerlendirme</dc:title><dc:creator>${x(benimAdim() || 'Saha Takip')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['docProps/app.xml', `${XH}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Saha Takip</Application><Slides>${n}</Slides></Properties>`],
    ['ppt/presentation.xml', `${XH}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slaytlar.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr lang="tr-TR"/></a:lvl1pPr></p:defaultTextStyle></p:presentation>`],
    ['ppt/_rels/presentation.xml.rels', `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>${slaytlar.map((_, i) => `<Relationship Id="rId${i + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`],
    ['ppt/theme/theme1.xml', TEMA],
    ['ppt/slideMasters/slideMaster1.xml', `${XH}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`],
    ['ppt/slideLayouts/slideLayout1.xml', `${XH}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Boş"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`],
  ];
  slaytlar.forEach((s, i) => {
    files.push([`ppt/slides/slide${i + 1}.xml`, `${XH}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${s}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`]);
    files.push([`ppt/slides/_rels/slide${i + 1}.xml.rels`, `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`]);
  });
  return new Blob([zipYaz(files)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

// Panelden çağrılır: çeyrek seçimi ve indirme
export function ceyrekSunumu(Y) {
  if (!disaAktarabilir()) { toast('Sunum çıktısı alma yetkin yok. Gerekirse veri sahibinden iste.', 'err'); return 0; }
  const buC = +Y === new Date().getFullYear() ? Math.floor(new Date().getMonth() / 3) + 1 : 4;
  const p = openDrawer(`<header class="dh"><div><p class="muted">PowerPoint</p><h2 id="drawer-title">${Y} çeyrek sunumu</h2></div><button class="x" data-close aria-label="Kapat">×</button></header>
    <div class="dbody form"><div class="fld"><label for="pp-c">Hangi çeyreğin sonu itibarıyla?</label><select id="pp-c">${[1, 2, 3, 4].map(c => `<option value="${c}" ${c === buC ? 'selected' : ''}>${c}. çeyrek</option>`).join('')}</select></div>
      <p class="hint">Şirket sunum düzeninde: hedef ve gerçekleşen, potansiyel, satış yapılan ve kayıp projeler, bayi ziyaretleri, stratejik firmalar, beklentiler ve rakip fiyatları. Tablolar PowerPoint'te düzenlenebilir; beklenti ve strateji slaytları boş gelir.</p>
      <div class="dfoot"><button type="button" class="btn primary" data-indir>Sunumu indir</button></div></div>`);
  p.querySelector('[data-indir]').onclick = () => {
    try {
      const C = +p.querySelector('#pp-c').value;
      const s = sunumOlustur(+Y, C);
      const bl = pptxPaketle(s), ad = `${Y}-${C}-ceyrek-sunumu.pptx`; download(ad, bl);
      import('./belgeler.js').then(m => m.ciktiKaydet(bl, ad, 'PowerPoint', `${Y} ${C}. çeyrek, ${s.length} slayt`));
      toast(`${s.length} slaytlık sunum indirildi.`); closeDrawer();
    } catch (e) { console.error(e); toast('Sunum oluşturulamadı: ' + e.message, 'err'); }
  };
}

// Enerji tasarrufu önerisi (Aydınlatma araçları → Enerji tasarrufu): 3 slaytlık, müşteriye gönderilecek sunum
export function tasarrufSunumu(v) {
  if (!disaAktarabilir()) { toast('Sunum çıktısı alma yetkin yok. Gerekirse veri sahibinden iste.', 'err'); return 0; }
  sid = 2;
  const sayi = n => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n || 0);
  const kartlar = (liste, Y) => { const w = (W - 1.8 * CM - 3 * 0.5 * CM) / 4; return liste.map(([b, d, a], i) => kutu({ x: 0.9 * CM + i * (w + 0.5 * CM), y: Y, w, h: 4.2 * CM, dolgu: i === 0 ? RENK.ink : RENK.acik, satirlar: [{ t: b, sz: 1200, renk: i === 0 ? 'B6C2CA' : RENK.gri }, { t: d, sz: 2600, b: true, renk: i === 0 ? 'FFFFFF' : RENK.ink }, { t: a, sz: 1000, renk: i === 0 ? 'B6C2CA' : RENK.gri }] })).join(''); };
  const s1 = kutu({ x: 0, y: 0, w: W, h: H, dolgu: RENK.ink })
    + kutu({ x: 1.5 * CM, y: 4.2 * CM, w: W - 3 * CM, h: 2.6 * CM, satirlar: [{ t: 'ENERJİ TASARRUFU ÖNERİSİ', sz: 4000, b: true, renk: 'FFFFFF' }] })
    + kutu({ x: 1.5 * CM, y: 7.0 * CM, w: 5 * CM, h: 0.2 * CM, dolgu: RENK.lumen })
    + kutu({ x: 1.5 * CM, y: 7.6 * CM, w: W - 3 * CM, h: 4 * CM, satirlar: [{ t: v.musteri || 'LED dönüşüm değerlendirmesi', sz: 2200, renk: 'FFFFFF' }, { t: `${sayi(v.adet)} adet ${sayi(v.eskiW)} W → ${v.yeniAd || sayi(v.yeniW) + ' W LED'}`, sz: 1600, renk: 'B6C2CA' }, { t: [benimAdim(), new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })].filter(Boolean).join(' · '), sz: 1400, renk: 'B6C2CA' }] });
  const s2 = baslik('MEVCUT SİSTEM VE ÖNERİLEN SİSTEM')
    + tablo({ x: 0.9 * CM, y: 2.6 * CM, w: W - 1.8 * CM, basliklar: ['', 'Mevcut sistem', 'Önerilen LED sistem', 'Fark'], oranlar: [2.4, 2, 2, 2], sz: 1300, satirH: 1.0 * CM, sag: [1, 2, 3], satirlar: [
      ['Armatür', `${sayi(v.adet)} × ${sayi(v.eskiW)} W`, `${sayi(v.adet)} × ${v.yeniAd ? v.yeniAd + ' (' + sayi(v.yeniW) + ' W)' : sayi(v.yeniW) + ' W'}`, `%${sayi(v.eskiW ? (v.eskiW - v.yeniW) / v.eskiW * 100 : 0)} daha az güç`],
      ['Kurulu güç', `${sayi(v.adet * v.eskiW / 1000)} kW`, `${sayi(v.adet * v.yeniW / 1000)} kW`, `${sayi(v.adet * (v.eskiW - v.yeniW) / 1000)} kW`],
      ['Çalışma', `${sayi(v.saat)} saat/gün · ${sayi(v.gun)} gün/yıl`, 'Aynı', ''],
      ['Yıllık tüketim', `${sayi(v.eskiKwh)} kWh`, `${sayi(v.yeniKwh)} kWh`, `${sayi(v.eskiKwh - v.yeniKwh)} kWh`],
      ['Yıllık elektrik gideri', v.kwh ? `${sayi(v.eskiKwh * v.kwh)} TL` : '—', v.kwh ? `${sayi(v.yeniKwh * v.kwh)} TL` : '—', v.kwh ? `${sayi((v.eskiKwh - v.yeniKwh) * v.kwh)} TL` : '—'],
    ] })
    + kutu({ x: 0.9 * CM, y: 10.6 * CM, w: W - 1.8 * CM, h: 1.4 * CM, satirlar: [{ t: `Elektrik birim fiyatı ${v.kwh ? v.kwh.toLocaleString('tr-TR') + ' TL/kWh' : 'girilmedi'}${v.kur ? ' · dolar kuru ' + v.kur.toLocaleString('tr-TR') + ' TL' : ''}. Hesaplar yaklaşıktır; sahadaki ölçüme göre değişebilir.`, sz: 1000, renk: RENK.gri }] });
  const s3 = baslik('KAZANIM')
    + kartlar([['Yıllık para tasarrufu', v.kwh ? `${sayi(v.tl)} TL` : '—', v.usd ? `≈ ${sayi(v.usd)} $` : ''], ['Yıllık enerji tasarrufu', `${sayi(v.eskiKwh - v.yeniKwh)} kWh`, `%${sayi(v.eskiKwh ? (v.eskiKwh - v.yeniKwh) / v.eskiKwh * 100 : 0)} daha az`], ['Geri dönüş süresi', v.ay ? `${(Math.round(v.ay * 10) / 10).toLocaleString('tr-TR')} ay` : '—', v.yatirim ? `Yatırım ≈ ${sayi(v.yatirim)} $` : 'Birim fiyat girilmedi'], ['Karbon azaltımı', `${(Math.round(v.co2 * 10) / 10).toLocaleString('tr-TR')} ton/yıl`, '0,44 kg CO₂/kWh ile']], 2.8 * CM)
    + kutu({ x: 0.9 * CM, y: 7.8 * CM, w: W - 1.8 * CM, h: 3.5 * CM, satirlar: [{ t: 'Ek kazanımlar', sz: 1500, b: true }, { t: '• Daha uzun ömür, daha az bakım ve lamba değişimi', sz: 1300 }, { t: '• Anında tam ışık, titreşimsiz ve daha iyi renk', sz: 1300 }, { t: '• Ayrıntılı teklif ve fotometrik çalışma için iletişime geçin', sz: 1300 }] });
  const sl = [s1, s2 + altbilgi('2 / 3', 'Enerji tasarrufu önerisi'), s3 + altbilgi('3 / 3', 'Enerji tasarrufu önerisi')];
  const bl = pptxPaketle(sl), ad = `enerji-tasarrufu-${today()}.pptx`;
  download(ad, bl);
  import('./belgeler.js').then(m => m.ciktiKaydet(bl, ad, 'PowerPoint', 'Enerji tasarrufu önerisi'));
  return sl.length;
}
