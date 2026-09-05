import type { FastifyReply } from 'fastify';

/**
 * Liste ve rapor uçlarının ortak dışa aktarma katmanı.
 *
 * "İleride raporlama ve veri çekme sistemi olacak" kararının karşılığı:
 * dışa aktarma sonradan eklenen bir modül değil, her ucun doğal parçası.
 */
export type Bicim = 'json' | 'csv' | 'xlsx';

export interface Kolon<S> {
  anahtar: string;
  baslik: string;
  deger?: (satir: S) => unknown;
  /** Excel sütun genişliği. */
  genislik?: number;
}

export function bicimCoz(ham: unknown): Bicim {
  const metin = String(ham ?? 'json').toLowerCase();
  return metin === 'csv' || metin === 'xlsx' ? metin : 'json';
}

function hucreDegeri<S>(satir: S, kolon: Kolon<S>): unknown {
  return kolon.deger ? kolon.deger(satir) : (satir as Record<string, unknown>)[kolon.anahtar];
}

function csvKacis(deger: unknown): string {
  if (deger === null || deger === undefined) return '';
  const metin = deger instanceof Date ? deger.toISOString() : String(deger);
  return /[";\n\r]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin;
}

/**
 * CSV üretir.
 *
 * İki Türkçe ayrıntı kasten böyle:
 *   - UTF-8 BOM eklenir; yoksa Excel "İ, ş, ğ, ç" harflerini bozar.
 *   - Ayırıcı ';' — Türkçe yerelde Excel virgülü ondalık ayırıcı sayar ve
 *     tüm satırı tek hücreye sıkıştırır.
 */
export function csvUret<S>(satirlar: readonly S[], kolonlar: readonly Kolon<S>[]): string {
  const basliklar = kolonlar.map((k) => csvKacis(k.baslik)).join(';');
  const govde = satirlar.map((satir) =>
    kolonlar.map((kolon) => csvKacis(hucreDegeri(satir, kolon))).join(';'),
  );
  return '﻿' + [basliklar, ...govde].join('\r\n') + '\r\n';
}

export async function xlsxUret<S>(
  satirlar: readonly S[],
  kolonlar: readonly Kolon<S>[],
  sayfaAdi = 'Rapor',
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const kitap = new ExcelJS.Workbook();
  kitap.creator = 'MİRFİX Operasyon Katmanı';
  kitap.created = new Date();

  const sayfa = kitap.addWorksheet(sayfaAdi.slice(0, 31));
  sayfa.columns = kolonlar.map((k) => ({
    header: k.baslik,
    key: k.anahtar,
    width: k.genislik ?? Math.max(12, Math.min(42, k.baslik.length + 6)),
  }));
  sayfa.getRow(1).font = { bold: true };
  sayfa.views = [{ state: 'frozen', ySplit: 1 }];

  for (const satir of satirlar) {
    const kayit: Record<string, unknown> = {};
    for (const kolon of kolonlar) kayit[kolon.anahtar] = hucreDegeri(satir, kolon);
    sayfa.addRow(kayit);
  }

  return Buffer.from(await kitap.xlsx.writeBuffer());
}

function dosyaAdi(taban: string, uzanti: string): string {
  const damga = new Date().toISOString().slice(0, 10);
  return `${taban}-${damga}.${uzanti}`;
}

/**
 * Biçime göre yanıtı gönderir. JSON'da üst veri (toplam, sayfa) da döner;
 * dosya biçimlerinde yalnızca satırlar.
 */
export async function yanitla<S>(
  yanit: FastifyReply,
  bicim: Bicim,
  satirlar: readonly S[],
  kolonlar: readonly Kolon<S>[],
  ad: string,
  ustVeri: Record<string, unknown> = {},
): Promise<FastifyReply> {
  if (bicim === 'csv') {
    return yanit
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${dosyaAdi(ad, 'csv')}"`)
      .send(csvUret(satirlar, kolonlar));
  }
  if (bicim === 'xlsx') {
    const tampon = await xlsxUret(satirlar, kolonlar, ad);
    return yanit
      .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="${dosyaAdi(ad, 'xlsx')}"`)
      .send(tampon);
  }
  return yanit.send({ ...ustVeri, satirlar });
}
