import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const buDosya = dirname(fileURLToPath(import.meta.url));

/**
 * Mikro alan eşlemesi.
 *
 * Masterbook Bölüm 14'teki "Mikro sürüm güncellemesi tablo yapısını bozar"
 * riskinin karşılığı: tablo/kolon adları KODA GÖMÜLMEZ, bu dosyada veri
 * olarak durur. Mikro sürüm atlarsa kod değil eşleme güncellenir.
 */

export type KumeAdi =
  | 'cari'
  | 'fatura'
  | 'tahsilat'
  | 'cek'
  | 'odemeGecmisi'
  | 'karsiliksiz'
  | 'ciro';

export interface CsvKumeEslemesi {
  dosya: string;
  alanlar: Record<string, string>;
}

export interface MssqlKumeEslemesi {
  /** Sonuç kolonları normalize adlarımıza takma adla döndürülmeli. */
  sorgu: string;
}

export interface MikroEslesmesi {
  csv: { ayirici: string; kumeler: Record<KumeAdi, CsvKumeEslemesi> };
  mssql: { kumeler: Record<KumeAdi, MssqlKumeEslemesi> };
}

let onbellek: MikroEslesmesi | null = null;

export async function eslesmeyiOku(yol?: string): Promise<MikroEslesmesi> {
  if (onbellek && !yol) return onbellek;
  const adaylar = yol
    ? [yol]
    : [
        resolve(buDosya, '../../../../docs/mikro-eslesme.json'),
        resolve(buDosya, '../../../docs/mikro-eslesme.json'),
        resolve(process.cwd(), 'docs/mikro-eslesme.json'),
      ];

  for (const aday of adaylar) {
    try {
      const icerik = await readFile(aday, 'utf8');
      const cozulmus = JSON.parse(icerik) as MikroEslesmesi;
      if (!yol) onbellek = cozulmus;
      return cozulmus;
    } catch (hata) {
      if ((hata as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Eşleme dosyası okunamadı (${aday}): ${(hata as Error).message}`);
      }
    }
  }
  throw new Error(
    'docs/mikro-eslesme.json bulunamadı. csv veya mssql adapter kullanmadan önce ' +
      'Faz 0 tablo keşfi tamamlanıp bu dosya doldurulmalı.',
  );
}
