import { ayarlar } from './ayarlar.js';
import { sunucuKur } from './api/sunucu.js';
import { gecisleriCalistir } from './db/gecisler.js';
import { havuzuKapat } from './db/havuz.js';
import { sistemLogu } from './db/yardimcilar.js';
import { zamanlayiciyiKur } from './jobs/zamanlayici.js';

/**
 * Uygulama girişi.
 *
 * Açılışta geçişler uygulanır: mini PC'de `docker compose up` tek komut olsun,
 * ayrıca migration çalıştırmak gerekmesin.
 */
const yeniGecisler = await gecisleriCalistir();
if (yeniGecisler.length > 0) {
  console.log(`Veritabanı güncellendi: ${yeniGecisler.join(', ')}`);
}

const sunucu = await sunucuKur();
zamanlayiciyiKur();

try {
  await sunucu.listen({ port: ayarlar.PORT, host: '0.0.0.0' });
  console.log(
    `MİRFİX Operasyon Katmanı çalışıyor:\n` +
      `  Panel     http://localhost:${ayarlar.PORT}\n` +
      `  API       http://localhost:${ayarlar.PORT}/api/v1\n` +
      `  Belgeler  http://localhost:${ayarlar.PORT}/api/belgeler\n` +
      `  Mikro     ${ayarlar.MIKRO_ADAPTER}   İşler: ${ayarlar.ISLER_ACIK ? 'açık' : 'kapalı'}`,
  );
  await sistemLogu('uygulama.basladi', 'BILGI', {
    port: ayarlar.PORT,
    adapter: ayarlar.MIKRO_ADAPTER,
    islerAcik: ayarlar.ISLER_ACIK,
  });
} catch (hata) {
  console.error('Sunucu başlatılamadı:', hata);
  process.exit(1);
}

async function kapat(sinyal: string) {
  console.log(`\n${sinyal} alındı, kapatılıyor...`);
  await sunucu.close();
  await havuzuKapat();
  process.exit(0);
}
process.on('SIGINT', () => void kapat('SIGINT'));
process.on('SIGTERM', () => void kapat('SIGTERM'));
