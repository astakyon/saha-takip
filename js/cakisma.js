// Aynı kaydı iki kişi (ya da iki cihaz) aynı anda değiştirdiğinde: alan alan birleştirme.
// onceki = senin düzenlemeye başladığın hal, benim = senin kaydettiğin, guncel = sunucudaki şimdiki hal.
// Farklı alanları değiştirdiyseniz ikisi de kalır; aynı alanı farklı değerle değiştirdiyseniz o alan "çatışan"dır.
const META = new Set(['id', 'owner', 'created_at', 'updated_at', 'sorumlu_ad']);
export const esit = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null) || ((a ?? '') === '' && (b ?? '') === '');

export function birlestir(onceki, benim, guncel) {
  const o = onceki || {}, g = guncel || {};
  const benimAlan = Object.keys(benim).filter(k => !META.has(k) && !esit(benim[k], o[k]));
  const onlarinAlan = Object.keys(g).filter(k => !META.has(k) && k in o && !esit(g[k], o[k]));
  const catisan = benimAlan.filter(k => onlarinAlan.includes(k) && !esit(benim[k], g[k]));
  const yaz = (alanlar) => Object.fromEntries([['id', benim.id], ...alanlar.map(k => [k, benim[k]])]);
  return {
    benimAlan, onlarinAlan, catisan,
    seninki: yaz(benimAlan),                                          // çatışanlarda benim değerim
    onunki: yaz(benimAlan.filter(k => !catisan.includes(k))),         // çatışanlarda onun değeri (yazılmaz)
  };
}

const AD = { ad: 'Ad', durum: 'Durum', tutar_usd: 'Tutar', notlar: 'Notlar', telefon: 'Telefon', eposta: 'E-posta', adres: 'Adres', il: 'İl', ilce: 'İlçe', sorumlu: 'Sorumlu',
  olasilik: 'Olasılık', baslik: 'Başlık', son_tarih: 'Son tarih', gecerlilik: 'Geçerlilik', toplam: 'Toplam', kalemler: 'Kalemler', sonuc_tipi: 'Sonuç', amac: 'Amaç', tarih: 'Tarih',
  saat: 'Saat', segment: 'Segment', tipler: 'Türler', unvan: 'Unvan', ad_soyad: 'Ad soyad', firma_id: 'Firma', proje_id: 'Proje', kisi_id: 'Kişi', emut_id: 'Emüt', gemut_id: 'Gemüt',
  bayi_id: 'Bayi', alici_id: 'Alıcı', iskonto: 'İskonto', kdv: 'KDV', para_birimi: 'Para birimi', atanan: 'Atanan', oncelik: 'Öncelik', kayip_nedeni: 'Kayıp nedeni', rakip_marka: 'Rakip marka',
  karar_grubu: 'Satış haritası', etiketler: 'Etiketler', lat: 'Konum', lng: 'Konum', siparis_tutari_usd: 'Sipariş tutarı', bizim_teklif_usd: 'Bizim teklif', rakip_toplam_usd: 'Rakip toplamı' };
export const alanAdi = k => AD[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_id$/, '').replace(/_/g, ' ');
export const degerYaz = v => v == null || v === '' ? '(boş)' : Array.isArray(v) ? `${v.length} öğe` : typeof v === 'object' ? '(ayrıntılı)' : String(v).length > 40 ? String(v).slice(0, 38) + '…' : String(v);

// Kullanıcıya sorulacak metin: çatışan alanlar, iki değer yan yana
export function cakismaMetni(r, benim, guncel, saat) {
  const alanlar = [...new Set(r.catisan.map(alanAdi))];
  const satir = r.catisan.filter((k, i, a) => a.findIndex(x => alanAdi(x) === alanAdi(k)) === i).slice(0, 6)
    .map(k => `• ${alanAdi(k)}: onunki «${degerYaz(guncel[k])}», seninki «${degerYaz(benim[k])}»`).join('\n');
  const diger = r.benimAlan.length - r.catisan.length;
  return `Bu kaydı sen açtıktan sonra başka biri de değiştirdi (${saat}). ${alanlar.length === 1 ? 'Aynı alanı' : 'Aynı alanları'} ikiniz de farklı değiştirdiniz:\n\n${satir}\n\nTamam: bu ${alanlar.length === 1 ? 'alanda' : 'alanlarda'} seninki kalsın.\nİptal: bu ${alanlar.length === 1 ? 'alanda' : 'alanlarda'} onunki kalsın.${diger ? `\n\nDiğer ${diger} değişikliğin her iki durumda da kaydedilir.` : ''}`;
}
