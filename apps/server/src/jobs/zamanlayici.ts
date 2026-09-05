import cron from 'node-cron';
import { ayarlar, SAAT_DILIMI } from '../ayarlar.js';
import { tatilleriOku } from '../db/yardimcilar.js';
import { IsTakvimi } from '../core/isTakvimi.js';
import { bugun } from '../core/tarih.js';
import { ISLER, isiCalistir } from './kayit.js';

/**
 * Zamanlanmış işleri kurar.
 *
 * Saat dilimi açıkça veriliyor: 08:00 listesi ve 17:00 eskalasyonu yerel
 * saate göre çalışmalı, sunucunun UTC'de olması sonucu değiştirmemeli.
 *
 * ISLER_ACIK=0 ile tamamen kapatılabilir — test ve geliştirme ortamında
 * arka planda iş çalışmasını istemiyoruz.
 */
export function zamanlayiciyiKur(): { kurulan: string[] } {
  if (!ayarlar.ISLER_ACIK) {
    console.log('Zamanlanmış işler kapalı (ISLER_ACIK=0).');
    return { kurulan: [] };
  }

  const kurulan: string[] = [];
  for (const is of ISLER) {
    if (!is.zamanlama) continue;

    cron.schedule(
      is.zamanlama,
      async () => {
        // Tatil günü kontrolü cron ifadesiyle yapılamaz (resmî tatiller
        // veritabanında), bu yüzden çalışma anında bakılıyor.
        if (is.sadeceIsGunu) {
          const takvim = new IsTakvimi(await tatilleriOku());
          if (!takvim.isGunuMu(bugun())) return;
        }
        const kayit = await isiCalistir(is);
        const durum = kayit.basarili ? '✓' : '✗';
        console.log(`${durum} ${kayit.kod} ${kayit.ad}: ${kayit.ozet}`);
      },
      { timezone: SAAT_DILIMI },
    );
    kurulan.push(`${is.kod} (${is.zamanlama})`);
  }

  console.log(`Zamanlanmış işler kuruldu [${SAAT_DILIMI}]: ${kurulan.join(', ')}`);
  return { kurulan };
}
