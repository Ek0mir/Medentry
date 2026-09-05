import { eskalasyonTara } from '../gorev/servis.js';
import type { IsSonucu, IsTanimi } from './tipler.js';

/**
 * W-11 — Genel görev eskalasyonu (saatlik).
 *
 * W-05 yalnızca ARAMA'ya bakar; bu iş tüm görev tiplerini tarar. Saatlik
 * çalışması, süresi gün içinde dolan işlerin ertesi güne kalmamasını sağlar.
 */
export const w11: IsTanimi = {
  kod: 'W-11',
  ad: 'Genel görev eskalasyonu',
  zamanlama: '15 * * * *',
  aciklama: 'Tüm görev tipleri için eskalasyon merdivenini işletir.',

  async calistir(): Promise<IsSonucu> {
    const rapor = await eskalasyonTara();
    return {
      ozet:
        rapor.yukseltilen === 0
          ? `Süresi geçen ${rapor.incelenen} görev incelendi, yeni eskalasyon yok.`
          : `${rapor.yukseltilen} görev yükseltildi (S1: ${rapor.seviyeler['1']}, S2: ${rapor.seviyeler['2']}, S3: ${rapor.seviyeler['3']}).`,
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
