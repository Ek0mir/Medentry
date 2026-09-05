import { gunFarki, type ISOTarih } from './tarih.js';

/**
 * Yaşlandırma bantları — Masterbook Bölüm 06.
 *
 *   0–30    izleme
 *   31–60   hatırlatma
 *   61–90   arama zorunlu
 *   91–180  sevk durdurma önerisi
 *   180+    hukuki değerlendirme
 *
 * Bant geçişi otomatik görev üretir; sevk durdurma kararını sistem değil insan verir.
 */
export const BANTLAR = [
  { anahtar: 'b_0_30', ad: '0–30 gün', alt: 0, ust: 30, aksiyon: 'izleme' },
  { anahtar: 'b_31_60', ad: '31–60 gün', alt: 31, ust: 60, aksiyon: 'hatırlatma' },
  { anahtar: 'b_61_90', ad: '61–90 gün', alt: 61, ust: 90, aksiyon: 'arama zorunlu' },
  { anahtar: 'b_91_180', ad: '91–180 gün', alt: 91, ust: 180, aksiyon: 'sevk durdurma' },
  { anahtar: 'b_180_plus', ad: '180+ gün', alt: 181, ust: Infinity, aksiyon: 'hukuki değerlendirme' },
] as const;

export type BantAnahtari = (typeof BANTLAR)[number]['anahtar'];

export interface AcikFatura {
  faturaNo: string;
  vade: ISOTarih;
  kalan: number;
}

export interface Yaslandirma {
  b_0_30: number;
  b_31_60: number;
  b_61_90: number;
  b_91_180: number;
  b_180_plus: number;
  vadesiGelmemis: number;
  toplam: number;
  /** En eski açık faturanın vade aşım günü. Vadesi geçen yoksa 0. */
  enEskiGun: number;
}

/** Vade aşım gününe göre bant anahtarı. Gecikme negatifse null (vadesi gelmemiş). */
export function bantAnahtari(gecikmeGun: number): BantAnahtari | null {
  if (gecikmeGun < 0) return null;
  for (const bant of BANTLAR) {
    if (gecikmeGun >= bant.alt && gecikmeGun <= bant.ust) return bant.anahtar;
  }
  return 'b_180_plus';
}

export function bantAdi(anahtar: BantAnahtari): string {
  return BANTLAR.find((b) => b.anahtar === anahtar)?.ad ?? anahtar;
}

/**
 * Açık faturaları referans tarihe göre bantlara dağıtır.
 * Kalanı sıfır veya negatif olan fatura hesaba katılmaz.
 */
export function yaslandirmaHesapla(
  faturalar: readonly AcikFatura[],
  referans: ISOTarih,
): Yaslandirma {
  const sonuc: Yaslandirma = {
    b_0_30: 0,
    b_31_60: 0,
    b_61_90: 0,
    b_91_180: 0,
    b_180_plus: 0,
    vadesiGelmemis: 0,
    toplam: 0,
    enEskiGun: 0,
  };

  for (const fatura of faturalar) {
    if (fatura.kalan <= 0) continue;
    const gecikme = gunFarki(fatura.vade, referans);
    const anahtar = bantAnahtari(gecikme);
    if (anahtar === null) {
      sonuc.vadesiGelmemis += fatura.kalan;
    } else {
      sonuc[anahtar] += fatura.kalan;
      if (gecikme > sonuc.enEskiGun) sonuc.enEskiGun = gecikme;
    }
    sonuc.toplam += fatura.kalan;
  }

  return yuvarla(sonuc);
}

/** Vadesi geçen toplam (vadesi gelmemiş hariç). */
export function vadesiGecen(y: Yaslandirma): number {
  return kurusYuvarla(y.b_0_30 + y.b_31_60 + y.b_61_90 + y.b_91_180 + y.b_180_plus);
}

function kurusYuvarla(n: number): number {
  return Math.round(n * 100) / 100;
}

function yuvarla(y: Yaslandirma): Yaslandirma {
  return {
    b_0_30: kurusYuvarla(y.b_0_30),
    b_31_60: kurusYuvarla(y.b_31_60),
    b_61_90: kurusYuvarla(y.b_61_90),
    b_91_180: kurusYuvarla(y.b_91_180),
    b_180_plus: kurusYuvarla(y.b_180_plus),
    vadesiGelmemis: kurusYuvarla(y.vadesiGelmemis),
    toplam: kurusYuvarla(y.toplam),
    enEskiGun: y.enEskiGun,
  };
}
