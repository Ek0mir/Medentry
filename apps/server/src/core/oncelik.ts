import { gunFarki, type ISOTarih } from './tarih.js';

/**
 * Günlük öncelikli arama listesi — Masterbook Bölüm 06.
 *
 * Bu bir rapor değil, GÖREV KUYRUĞUDUR. Bakılıp geçilemez; kapatılması gerekir.
 * Buradaki sıralama W-03'ün hangi carileri kuyruğa alacağını belirler.
 */

export interface OncelikAdayi {
  cariKod: string;
  unvan: string;
  skor: number;
  kademe: number;
  kademeAd: string;
  vadesiGecen: number;
  b_0_30: number;
  b_31_60: number;
  b_61_90: number;
  b_91_180: number;
  b_180_plus: number;
  enEskiGun: number;
  riskLimiti: number;
  toplamBakiye: number;
  /** Halihazırda açık bir ARAMA görevi var mı? */
  acikAramaVar: boolean;
  /** Bekleyen (henüz vadesi gelmemiş) ödeme sözünün tarihi. */
  bekleyenSozTarihi: ISOTarih | null;
  /** Tutulmayan ödeme sözü adedi — sistem öğrenir, ceza puanı olur. */
  tutulmayanSozAdedi: number;
  /** Son kapatılan arama görevinin günü. */
  sonAramaGunu: ISOTarih | null;
}

export interface OncelikSatiri {
  cariKod: string;
  sira: number;
  puan: number;
  gerekce: string;
}

export interface OncelikAyarlari {
  /** Kaç cari görev olarak açılacak. */
  gunlukAdet: number;
  /** Tutulmayan söz başına ceza puanı. */
  sozCezasi: number;
}

export const VARSAYILAN_ONCELIK_AYARLARI: OncelikAyarlari = {
  gunlukAdet: 15,
  sozCezasi: 8,
};

const paraBicim = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const para = (n: number) => `${paraBicim.format(n)} ₺`;

/** Vadesi geçen tutarı 0..1 aralığına oturtur. Mutlak ölçek — gün gün karşılaştırılabilir. */
function tutarAgirligi(tutar: number): number {
  const capalar: [number, number][] = [
    [0, 0],
    [10_000, 0.2],
    [50_000, 0.5],
    [250_000, 0.8],
    [1_000_000, 1],
  ];
  if (tutar <= 0) return 0;
  for (let i = 0; i < capalar.length - 1; i++) {
    const [x0, y0] = capalar[i]!;
    const [x1, y1] = capalar[i + 1]!;
    if (tutar >= x0 && tutar <= x1) return y0 + ((tutar - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

/** Aday listeden bugün aranmayacak olanları eler. */
export function adayMi(aday: OncelikAdayi, bugunTarih: ISOTarih): boolean {
  // Vadesi geçen borcu yoksa aranacak bir şey yok.
  if (aday.vadesiGecen <= 0) return false;
  // Zaten kuyrukta olan cari iki kez açılmaz.
  if (aday.acikAramaVar) return false;
  // Ödeme sözü verilmiş ve tarihi henüz gelmemişse söze saygı duyulur;
  // söz tarihinde ODEME_SOZU görevi olarak zaten geri gelecek.
  if (aday.bekleyenSozTarihi && gunFarki(bugunTarih, aday.bekleyenSozTarihi) > 0) return false;
  return true;
}

export function oncelikPuani(aday: OncelikAdayi, ayar: OncelikAyarlari): number {
  let puan = aday.skor;
  puan += tutarAgirligi(aday.vadesiGecen) * 20;
  puan += aday.tutulmayanSozAdedi * ayar.sozCezasi;
  // 61 gün ve üzeri bantta arama masterbook'a göre zorunlu — öne alınır.
  if (aday.enEskiGun >= 61) puan += 5;
  return Math.round(puan * 100) / 100;
}

/** Ekranda ve WhatsApp mesajında görünecek "neden bu cari" metni. */
export function gerekceUret(aday: OncelikAdayi, bugunTarih: ISOTarih): string {
  const parcalar: string[] = [];

  const bantlar: [number, string][] = [
    [aday.b_180_plus, '180+ gün'],
    [aday.b_91_180, '91–180 gün'],
    [aday.b_61_90, '61–90 gün'],
    [aday.b_31_60, '31–60 gün'],
    [aday.b_0_30, '0–30 gün'],
  ];
  const enAgir = bantlar.find(([tutar]) => tutar > 0);
  if (enAgir) parcalar.push(`${enAgir[1]} bandında ${para(enAgir[0])}`);

  parcalar.push(`risk kademesi ${aday.kademe} (${aday.kademeAd})`);

  if (aday.riskLimiti > 0 && aday.toplamBakiye > aday.riskLimiti) {
    const oran = Math.round((aday.toplamBakiye / aday.riskLimiti) * 100);
    parcalar.push(`limit %${oran} kullanılmış`);
  }
  if (aday.tutulmayanSozAdedi > 0) {
    parcalar.push(
      aday.tutulmayanSozAdedi === 1
        ? 'verilen ödeme sözü tutulmadı'
        : `${aday.tutulmayanSozAdedi} ödeme sözü tutulmadı`,
    );
  }
  if (aday.sonAramaGunu) {
    const gun = gunFarki(aday.sonAramaGunu, bugunTarih);
    if (gun >= 7) parcalar.push(`${gun} gündür aranmamış`);
  } else {
    parcalar.push('hiç aranmamış');
  }

  return parcalar.slice(0, 4).join(' · ');
}

/**
 * Adayları eler, puanlar, sıralar. `gunlukAdet` kadarı görev olarak açılır;
 * kalanı liste olarak görünür kalır.
 */
export function oncelikListesi(
  adaylar: readonly OncelikAdayi[],
  bugunTarih: ISOTarih,
  ayar: OncelikAyarlari = VARSAYILAN_ONCELIK_AYARLARI,
): OncelikSatiri[] {
  return adaylar
    .filter((a) => adayMi(a, bugunTarih))
    .map((a) => ({ aday: a, puan: oncelikPuani(a, ayar) }))
    .sort((x, y) => y.puan - x.puan || x.aday.cariKod.localeCompare(y.aday.cariKod, 'tr'))
    .map(({ aday, puan }, i) => ({
      cariKod: aday.cariKod,
      sira: i + 1,
      puan,
      gerekce: gerekceUret(aday, bugunTarih),
    }));
}
