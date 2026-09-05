import { tatilleriOku } from '../db/yardimcilar.js';
import { IsTakvimi } from '../core/isTakvimi.js';
import { bugun } from '../core/tarih.js';
import { eskalasyonTara } from '../gorev/servis.js';
import type { IsBaglami, IsSonucu, IsTanimi } from './tipler.js';

/**
 * W-05 — Aranmayan kayıt eskalasyonu (her iş günü 17:00).
 *
 * Günün arama listesinden kapatılmayanlar merdivende yükselir. Masterbook
 * Bölüm 05: "kapanmayan iş kendiliğinden görünür hale gelir" — kimsenin
 * hatırlaması gerekmez, kimse listeye bakmak zorunda değildir.
 */
export const w05: IsTanimi = {
  kod: 'W-05',
  ad: 'Aranmayan kayıt eskalasyonu',
  zamanlama: '0 17 * * 1-5',
  sadeceIsGunu: true,
  aciklama: 'Gün sonunda kapatılmamış ARAMA görevlerini eskalasyon merdivenine sokar.',

  async calistir(baglam: IsBaglami = {}): Promise<IsSonucu> {
    const takvim = new IsTakvimi(await tatilleriOku());
    if (!takvim.isGunuMu(baglam.gun ?? bugun()) && !baglam.zorla) {
      return { ozet: 'İş günü değil, eskalasyon taraması yapılmadı.', sayilar: { yukseltilen: 0 } };
    }

    const rapor = await eskalasyonTara(['ARAMA']);
    return {
      ozet:
        rapor.yukseltilen === 0
          ? `Süresi geçen ${rapor.incelenen} arama görevi incelendi, yeni eskalasyon yok.`
          : `${rapor.yukseltilen} arama görevi yükseltildi (S1: ${rapor.seviyeler['1']}, S2: ${rapor.seviyeler['2']}, S3: ${rapor.seviyeler['3']}).`,
      sayilar: {
        incelenen: rapor.incelenen,
        yukseltilen: rapor.yukseltilen,
        seviye1: rapor.seviyeler['1'] ?? 0,
        seviye2: rapor.seviyeler['2'] ?? 0,
        seviye3: rapor.seviyeler['3'] ?? 0,
      },
    };
  },
};
