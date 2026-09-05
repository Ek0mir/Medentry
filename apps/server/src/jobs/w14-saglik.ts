import { sorgu, tekSatir } from '../db/havuz.js';
import { sistemLogu } from '../db/yardimcilar.js';
import { mikroAdapterOlustur } from '../mikro/index.js';
import type { IsSonucu, IsTanimi } from './tipler.js';

export interface SaglikBulgusu {
  ad: string;
  saglikli: boolean;
  mesaj: string;
}

export interface SaglikRaporu {
  saglikli: boolean;
  bulgular: SaglikBulgusu[];
  ts: string;
}

/**
 * Sistem sağlık kontrolü. Hem W-14 hem /api/v1/saglik bu fonksiyonu çağırır —
 * "sağlıklı" tanımı tek yerde durur.
 */
export async function saglikDurumu(): Promise<SaglikRaporu> {
  const bulgular: SaglikBulgusu[] = [];

  try {
    await sorgu('SELECT 1');
    bulgular.push({ ad: 'veritabani', saglikli: true, mesaj: 'PostgreSQL erişilebilir.' });
  } catch (hata) {
    bulgular.push({ ad: 'veritabani', saglikli: false, mesaj: (hata as Error).message });
    return { saglikli: false, bulgular, ts: new Date().toISOString() };
  }

  // Mikro kaynağına erişim
  const adapter = mikroAdapterOlustur();
  try {
    const sonuc = await adapter.saglikKontrolu();
    bulgular.push({ ad: `mikro:${adapter.ad}`, saglikli: sonuc.saglikli, mesaj: sonuc.mesaj });
  } catch (hata) {
    bulgular.push({ ad: `mikro:${adapter.ad}`, saglikli: false, mesaj: (hata as Error).message });
  } finally {
    await adapter.kapat?.().catch(() => {});
  }

  // Senkron tazeliği: 26 saati aşan veri bayattır (gece 02:00 + tolerans).
  const sonSenkron = await tekSatir<{ bitis: Date | null; durum: string; saat: number }>(
    `SELECT bitis, durum, EXTRACT(EPOCH FROM (now() - bitis)) / 3600 AS saat
       FROM stg_senkron_log
      WHERE durum = 'BASARILI'
      ORDER BY bitis DESC NULLS LAST
      LIMIT 1`,
  );
  if (!sonSenkron?.bitis) {
    bulgular.push({
      ad: 'senkron',
      saglikli: false,
      mesaj: 'Henüz başarılı bir senkron yok. W-01 çalıştırılmalı.',
    });
  } else {
    const saat = Number(sonSenkron.saat);
    bulgular.push({
      ad: 'senkron',
      saglikli: saat <= 26,
      mesaj: `Son başarılı senkron ${saat.toFixed(1)} saat önce.`,
    });
  }

  // Son 24 saatte hata kaydı
  const hataSatiri = await tekSatir<{ adet: number }>(
    `SELECT count(*)::int AS adet FROM op_sistem_log
      WHERE seviye = 'HATA' AND ts > now() - interval '24 hours'`,
  );
  const hataAdedi = hataSatiri?.adet ?? 0;
  bulgular.push({
    ad: 'hata_kaydi',
    saglikli: hataAdedi === 0,
    mesaj:
      hataAdedi === 0
        ? 'Son 24 saatte hata kaydı yok.'
        : `Son 24 saatte ${hataAdedi} hata kaydı var.`,
  });

  return {
    saglikli: bulgular.every((b) => b.saglikli),
    bulgular,
    ts: new Date().toISOString(),
  };
}

/**
 * W-14 — Sistem sağlık kontrolü (her 30 dakika).
 *
 * Masterbook Bölüm 14: Mikro sürüm güncellemesi tablo yapısını bozarsa
 * kırılmayı AYNI GÜN haber vermesi gereken iş budur.
 */
export const w14: IsTanimi = {
  kod: 'W-14',
  ad: 'Sistem sağlık kontrolü',
  zamanlama: '*/30 * * * *',
  aciklama: 'Veritabanı, Mikro erişimi, senkron tazeliği ve hata kayıtlarını denetler.',

  async calistir(): Promise<IsSonucu> {
    const rapor = await saglikDurumu();
    const sorunlular = rapor.bulgular.filter((b) => !b.saglikli);

    if (sorunlular.length > 0) {
      await sistemLogu('saglik.sorun', 'UYARI', { bulgular: sorunlular });
    }

    return {
      ozet:
        sorunlular.length === 0
          ? `Sistem sağlıklı (${rapor.bulgular.length} kontrol).`
          : `${sorunlular.length} sorun: ${sorunlular.map((b) => `${b.ad} — ${b.mesaj}`).join(' | ')}`,
      sayilar: { kontrol: rapor.bulgular.length, sorun: sorunlular.length },
    };
  },
};
