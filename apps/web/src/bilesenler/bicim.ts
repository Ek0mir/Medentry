/** Ortak biçimlendiriciler. Tüm ekranlar aynı sayıyı aynı şekilde gösterir. */

const paraBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const paraKurusBicimi = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tarihBicimi = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const tarihSaatBicimi = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function para(deger: number | null | undefined, kurus = false): string {
  if (deger === null || deger === undefined) return '—';
  return `${(kurus ? paraKurusBicimi : paraBicimi).format(deger)} ₺`;
}

/** Büyük tutarları kısaltır: 1.250.000 ₺ → 1,25 mn ₺ */
export function paraKisa(deger: number | null | undefined): string {
  if (deger === null || deger === undefined) return '—';
  const mutlak = Math.abs(deger);
  if (mutlak >= 1_000_000) return `${(deger / 1_000_000).toFixed(2).replace('.', ',')} mn ₺`;
  if (mutlak >= 1_000) return `${Math.round(deger / 1_000)} bin ₺`;
  return para(deger);
}

export function sayi(deger: number | null | undefined, basamak = 0): string {
  if (deger === null || deger === undefined) return '—';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak,
  }).format(deger);
}

export function tarih(deger: string | Date | null | undefined): string {
  if (!deger) return '—';
  const d = typeof deger === 'string' ? new Date(deger) : deger;
  return Number.isNaN(d.getTime()) ? '—' : tarihBicimi.format(d);
}

export function tarihSaat(deger: string | Date | null | undefined): string {
  if (!deger) return '—';
  const d = typeof deger === 'string' ? new Date(deger) : deger;
  return Number.isNaN(d.getTime()) ? '—' : tarihSaatBicimi.format(d);
}

/** "3 gün gecikmiş" / "2 saat kaldı" gibi insan diliyle kalan süre. */
export function kalanSure(sonTarih: string | null | undefined): string {
  if (!sonTarih) return '—';
  const fark = new Date(sonTarih).getTime() - Date.now();
  const mutlak = Math.abs(fark);
  const gun = Math.floor(mutlak / 86_400_000);
  const saat = Math.floor((mutlak % 86_400_000) / 3_600_000);

  const parca = gun > 0 ? `${gun} gün` : saat > 0 ? `${saat} saat` : 'birkaç dakika';
  return fark < 0 ? `${parca} gecikti` : `${parca} kaldı`;
}

/** Risk kademesini durum rozetine eşler. Renk asla tek başına anlam taşımaz. */
export function kademeDurumu(kademe: number | null | undefined): {
  sinif: string;
  renk: string;
} {
  if (!kademe || kademe <= 2) return { sinif: 'rozet-iyi', renk: 'var(--durum-iyi)' };
  if (kademe <= 4) return { sinif: 'rozet-uyari', renk: 'var(--durum-uyari)' };
  if (kademe <= 6) return { sinif: 'rozet-ciddi', renk: 'var(--durum-ciddi)' };
  return { sinif: 'rozet-kritik', renk: 'var(--durum-kritik)' };
}

export const BANT_TANIMLARI = [
  { anahtar: 'b_0_30', ad: '0–30 gün', aksiyon: 'izleme', renk: 'var(--bant-1)' },
  { anahtar: 'b_31_60', ad: '31–60 gün', aksiyon: 'hatırlatma', renk: 'var(--bant-2)' },
  { anahtar: 'b_61_90', ad: '61–90 gün', aksiyon: 'arama zorunlu', renk: 'var(--bant-3)' },
  { anahtar: 'b_91_180', ad: '91–180 gün', aksiyon: 'sevk durdurma', renk: 'var(--bant-4)' },
  { anahtar: 'b_180_plus', ad: '180+ gün', aksiyon: 'hukuki değerlendirme', renk: 'var(--bant-5)' },
] as const;
