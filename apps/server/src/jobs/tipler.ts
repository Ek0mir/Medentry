import type { ISOTarih } from '../core/tarih.js';

/**
 * İş (job) sözleşmesi.
 *
 * Masterbook Bölüm 09'daki W-01…W-15 kodları korunur; her biri versiyonlanan,
 * test edilebilir bir dosyadır. n8n JSON'u yerine kod olmasının sebebi:
 * "görev sonuçsuz kapatılamaz" gibi değişmez kuralları bir iş akışı motoru
 * garanti edemez.
 */
export interface IsSonucu {
  ozet: string;
  sayilar?: Record<string, number>;
}

/**
 * İşi çalıştırırken verilebilen bağlam.
 *
 * `gun`: hangi güne ait çalıştırıldığı. Sistem kapalı kaldıysa geçmiş bir günün
 *        listesi elle üretilebilsin diye var — varsayılan bugündür.
 * `zorla`: iş günü kontrolünü atlar. Yalnızca elle tetiklemede kullanılır;
 *          zamanlayıcı asla zorlamaz, yoksa cumartesi arama listesi düşer.
 */
export interface IsBaglami {
  gun?: ISOTarih;
  zorla?: boolean;
}

export interface IsTanimi {
  kod: string;
  ad: string;
  /** 5 alanlı cron ifadesi; null ise yalnızca elle tetiklenir. */
  zamanlama: string | null;
  aciklama: string;
  /** Yalnızca iş günlerinde anlamlı olan işler (tatilde çalışmaz). */
  sadeceIsGunu?: boolean;
  calistir(baglam?: IsBaglami): Promise<IsSonucu>;
}
