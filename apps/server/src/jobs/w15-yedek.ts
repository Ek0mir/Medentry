import { execFile } from 'node:child_process';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { ayarlar } from '../ayarlar.js';
import { sistemLogu } from '../db/yardimcilar.js';
import type { IsSonucu, IsTanimi } from './tipler.js';

const calistir = promisify(execFile);

/**
 * W-15 — Yedekleme ve doğrulama (her gün 03:30).
 *
 * Masterbook Bölüm 02: "geri yükleme testi bir kez fiilen yapılır". Bu iş
 * yedeği alır ve dosyanın gerçekten okunabilir olduğunu doğrular — boyutu
 * sıfır olmayan, pg_restore'un listeleyebildiği bir arşiv üretilmediyse
 * yedek alınmış sayılmaz.
 */
export const w15: IsTanimi = {
  kod: 'W-15',
  ad: 'Yedekleme ve doğrulama',
  zamanlama: '30 3 * * *',
  aciklama: 'pg_dump ile yedek alır, arşivin okunabilirliğini doğrular, eskileri temizler.',

  async calistir(): Promise<IsSonucu> {
    const dizin = resolve(ayarlar.YEDEK_DIZIN);
    await mkdir(dizin, { recursive: true });

    const damga = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dosya = join(dizin, `mirfix-${damga}.dump`);

    // -Fc: sıkıştırılmış özel biçim; pg_restore ile seçmeli geri yükleme yapılabilir.
    try {
      await calistir('pg_dump', ['-Fc', '-f', dosya, ayarlar.DATABASE_URL], {
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (hata) {
      const mesaj = (hata as Error).message;
      await sistemLogu('yedek.hata', 'HATA', { mesaj });
      throw new Error(`pg_dump başarısız: ${mesaj}`);
    }

    const bilgi = await stat(dosya);
    if (bilgi.size === 0) throw new Error(`Yedek dosyası boş: ${dosya}`);

    // Bütünlük kontrolü: arşiv listelenebiliyor mu?
    try {
      await calistir('pg_restore', ['--list', dosya], { maxBuffer: 32 * 1024 * 1024 });
    } catch (hata) {
      await sistemLogu('yedek.bozuk', 'HATA', { dosya, mesaj: (hata as Error).message });
      throw new Error(`Yedek doğrulanamadı (pg_restore --list): ${(hata as Error).message}`);
    }

    // Saklama süresi dolanları sil.
    let silinen = 0;
    const sinir = Date.now() - ayarlar.YEDEK_SAKLAMA_GUN * 86_400_000;
    for (const ad of await readdir(dizin)) {
      if (!ad.startsWith('mirfix-') || !ad.endsWith('.dump')) continue;
      const yol = join(dizin, ad);
      const durum = await stat(yol);
      if (durum.mtimeMs < sinir) {
        await unlink(yol);
        silinen++;
      }
    }

    const mb = (bilgi.size / 1_048_576).toFixed(1);
    return {
      ozet: `Yedek alındı ve doğrulandı: ${dosya} (${mb} MB)${silinen > 0 ? `, ${silinen} eski yedek silindi` : ''}.`,
      sayilar: { boyutBayt: bilgi.size, silinen },
    };
  },
};
