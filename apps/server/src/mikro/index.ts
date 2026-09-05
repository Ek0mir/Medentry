import { ayarlar } from '../ayarlar.js';
import { CsvAdapter } from './csvAdapter.js';
import { MssqlAdapter } from './mssqlAdapter.js';
import { SeedAdapter } from './seedAdapter.js';
import type { MikroAdapter } from './tipler.js';

export * from './tipler.js';
export { SeedAdapter } from './seedAdapter.js';
export { CsvAdapter } from './csvAdapter.js';
export { MssqlAdapter } from './mssqlAdapter.js';

/**
 * MIKRO_ADAPTER ortam değişkenine göre veri kaynağını seçer.
 * Uygulamanın geri kalanı hangi kaynağın kullanıldığını bilmez.
 */
export function mikroAdapterOlustur(): MikroAdapter {
  switch (ayarlar.MIKRO_ADAPTER) {
    case 'seed':
      return new SeedAdapter();
    case 'csv':
      return new CsvAdapter({ dizin: ayarlar.MIKRO_CSV_DIZIN });
    case 'mssql':
      return new MssqlAdapter({
        sunucu: ayarlar.MIKRO_MSSQL_SUNUCU ?? '',
        port: ayarlar.MIKRO_MSSQL_PORT,
        veritabani: ayarlar.MIKRO_MSSQL_VERITABANI ?? '',
        kullanici: ayarlar.MIKRO_MSSQL_KULLANICI ?? '',
        parola: ayarlar.MIKRO_MSSQL_PAROLA ?? '',
        sifreli: ayarlar.MIKRO_MSSQL_SIFRELI,
      });
  }
}
