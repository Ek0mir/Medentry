import { sistemLogu } from '../db/yardimcilar.js';
import type { IsBaglami, IsSonucu, IsTanimi } from './tipler.js';
import { w01 } from './w01-mikro-senkron.js';
import { w02 } from './w02-yaslandirma-risk.js';
import { w03 } from './w03-arama-listesi.js';
import { w05 } from './w05-aranmayan-eskalasyon.js';
import { w11 } from './w11-genel-eskalasyon.js';
import { w14 } from './w14-saglik.js';
import { w15 } from './w15-yedek.js';

/**
 * İş kataloğu — Masterbook Bölüm 09.
 *
 * İlk teslimde 7 iş var; kalan kodlar (W-04, W-06, W-07, W-08, W-09, W-10,
 * W-12, W-13) sonraki tesliml er için rezerve edildi. Numaralar masterbook ile
 * birebir tutuluyor ki belge ve kod aynı dili konuşsun.
 */
export const ISLER: readonly IsTanimi[] = [w01, w02, w03, w05, w11, w14, w15];

export function isBul(kod: string): IsTanimi | undefined {
  return ISLER.find((i) => i.kod.toLocaleUpperCase('tr') === kod.toLocaleUpperCase('tr'));
}

export interface CalismaKaydi {
  kod: string;
  ad: string;
  basarili: boolean;
  ozet: string;
  sureMs: number;
  sayilar?: Record<string, number>;
}

/**
 * Bir işi çalıştırır, sonucu op_sistem_log'a yazar.
 * Hata fırlatmaz — çağıran taraf (zamanlayıcı ya da API) sonucu okur.
 */
export async function isiCalistir(is: IsTanimi, baglam?: IsBaglami): Promise<CalismaKaydi> {
  const baslangic = Date.now();
  try {
    const sonuc: IsSonucu = await is.calistir(baglam);
    const sureMs = Date.now() - baslangic;
    await sistemLogu(`is.${is.kod}`, 'BILGI', { ozet: sonuc.ozet, sayilar: sonuc.sayilar, sureMs, baglam });
    return { kod: is.kod, ad: is.ad, basarili: true, ozet: sonuc.ozet, sureMs, sayilar: sonuc.sayilar };
  } catch (hata) {
    const sureMs = Date.now() - baslangic;
    const mesaj = (hata as Error).message;
    await sistemLogu(`is.${is.kod}`, 'HATA', { mesaj, sureMs }).catch(() => {});
    return { kod: is.kod, ad: is.ad, basarili: false, ozet: mesaj, sureMs };
  }
}
