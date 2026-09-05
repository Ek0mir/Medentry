import type { PoolClient } from 'pg';
import { sorgu, tekSatir, type Sorgulanabilir } from './havuz.js';

/**
 * Çok satırlı toplu ekleme. Parametre sayısı PostgreSQL'in 65535 sınırını
 * aşmasın diye satırlar parçalara bölünür.
 */
export async function topluEkle(
  istemci: PoolClient,
  tablo: string,
  kolonlar: readonly string[],
  satirlar: readonly (readonly unknown[])[],
  ekBolum = '',
): Promise<number> {
  if (satirlar.length === 0) return 0;

  const satirBasiParametre = kolonlar.length;
  const parcaBoyu = Math.max(1, Math.floor(60_000 / satirBasiParametre));
  let toplam = 0;

  for (let bas = 0; bas < satirlar.length; bas += parcaBoyu) {
    const parca = satirlar.slice(bas, bas + parcaBoyu);
    const degerler: unknown[] = [];
    const yerTutucular = parca
      .map((satir, i) => {
        const parametreler = satir.map((deger, j) => {
          degerler.push(deger);
          return `$${i * satirBasiParametre + j + 1}`;
        });
        return `(${parametreler.join(',')})`;
      })
      .join(',');

    const metin = `INSERT INTO ${tablo} (${kolonlar.join(',')}) VALUES ${yerTutucular} ${ekBolum}`;
    const sonuc = await istemci.query(metin, degerler);
    toplam += sonuc.rowCount ?? parca.length;
  }
  return toplam;
}

/** op_ayar'dan tek bir değer okur; kayıt yoksa varsayılanı verir. */
export async function ayarOku<S>(anahtar: string, varsayilan: S, istemci?: Sorgulanabilir): Promise<S> {
  const satir = await tekSatir<{ deger: S }>(
    'SELECT deger FROM op_ayar WHERE anahtar = $1',
    [anahtar],
    istemci,
  );
  return satir ? satir.deger : varsayilan;
}

export async function ayarYaz(anahtar: string, deger: unknown, aciklama?: string): Promise<void> {
  await sorgu(
    `INSERT INTO op_ayar (anahtar, deger, aciklama) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (anahtar) DO UPDATE SET deger = EXCLUDED.deger,
       aciklama = COALESCE(EXCLUDED.aciklama, op_ayar.aciklama)`,
    [anahtar, JSON.stringify(deger), aciklama ?? null],
  );
}

/** Resmî tatiller — iş günü takvimi bunları okur. */
export async function tatilleriOku(istemci?: Sorgulanabilir): Promise<string[]> {
  const satirlar = await sorgu<{ tarih: string }>('SELECT tarih FROM op_tatil', [], istemci);
  return satirlar.map((s) => s.tarih);
}

export async function sistemLogu(
  olay: string,
  seviye: 'BILGI' | 'UYARI' | 'HATA',
  detay?: unknown,
  istemci?: Sorgulanabilir,
): Promise<void> {
  await sorgu(
    'INSERT INTO op_sistem_log (olay, seviye, detay) VALUES ($1, $2, $3::jsonb)',
    [olay, seviye, JSON.stringify(detay ?? {})],
    istemci,
  );
}

/**
 * Olay outbox'ına yazar. WhatsApp, n8n veya başka bir otomasyon buraya
 * abone olur — iş mantığının içine gömülmez.
 */
export async function olayYaz(
  tur: string,
  konuTip: string,
  konuId: string | number,
  veri: unknown,
  istemci?: Sorgulanabilir,
): Promise<void> {
  await sorgu(
    'INSERT INTO op_olay (tur, konu_tip, konu_id, veri) VALUES ($1, $2, $3, $4::jsonb)',
    [tur, konuTip, String(konuId), JSON.stringify(veri ?? {})],
    istemci,
  );
}
