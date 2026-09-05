import type { IsTakvimi } from './isTakvimi.js';

/**
 * Kademeli eskalasyon merdiveni — Masterbook Bölüm 05.
 *
 *   Görev açılır → süre doldu → S1 sorumluya hatırlatma
 *                → +24 saat   → S2 Enes'e bildirim
 *                → +48 saat / limit üstü → S3 Ali Bey
 *
 * Sistemin özü budur: kapanmayan iş kendiliğinden yukarı çıkar, kimsenin
 * hatırlamasına gerek kalmaz. Görev kapanınca merdiven durur.
 */

export type Seviye = 0 | 1 | 2 | 3;

export interface EskalasyonAyarlari {
  seviye2SaatSonra: number;
  seviye3SaatSonra: number;
}

export const VARSAYILAN_ESKALASYON_AYARLARI: EskalasyonAyarlari = {
  seviye2SaatSonra: 24,
  seviye3SaatSonra: 48,
};

/** Seviyeleri hangi rolün üstlendiği. */
export const SEVIYE_ROLU: Record<Exclude<Seviye, 0>, 'SORUMLU' | 'YONETICI' | 'UST_ONAY'> = {
  1: 'SORUMLU',
  2: 'YONETICI',
  3: 'UST_ONAY',
};

export interface EskalasyonGirdisi {
  sonTarih: Date;
  simdi: Date;
  /** Cari risk limitini aşmışsa merdiven bir basamak hızlanır. */
  limitUstu?: boolean;
}

/**
 * Görevin ŞU AN hangi seviyede olması gerektiğini söyler.
 * Süresi dolmamışsa 0. Kayıtlı seviyeden büyükse yeni eskalasyon üretilir.
 */
export function hedefSeviye(
  girdi: EskalasyonGirdisi,
  takvim: IsTakvimi,
  ayar: EskalasyonAyarlari = VARSAYILAN_ESKALASYON_AYARLARI,
): Seviye {
  const { sonTarih, simdi, limitUstu = false } = girdi;
  if (simdi <= sonTarih) return 0;

  const s2An = takvim.isSaatiEkle(sonTarih, ayar.seviye2SaatSonra);
  const s3An = takvim.isSaatiEkle(sonTarih, ayar.seviye3SaatSonra);

  if (simdi > s3An) return 3;
  // Limit üstü cariler S2'de beklemez, doğrudan üst onaya çıkar.
  if (limitUstu && simdi > s2An) return 3;
  if (simdi > s2An) return 2;
  return 1;
}

export function seviyeAciklamasi(seviye: Seviye): string {
  switch (seviye) {
    case 0:
      return 'Süresi dolmadı';
    case 1:
      return 'Seviye 1 — sorumluya hatırlatma';
    case 2:
      return 'Seviye 2 — yöneticiye bildirim';
    case 3:
      return 'Seviye 3 — üst onaya bildirim';
  }
}
