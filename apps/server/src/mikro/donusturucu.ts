import type { ISOTarih } from '../core/tarih.js';

/**
 * Mikro export'larından gelen ham metinleri normalize eder.
 *
 * Türkçe Excel çıktıları "1.234.567,89" ve "05.09.2026" biçiminde gelir;
 * İngilizce yerelde alınmış bir export "1234567.89" ve "2026-09-05" verir.
 * İkisini de kabul ediyoruz — hangi makineden export alındığı bizim sorunumuz
 * olmasın diye.
 */

export function sayiyaCevir(ham: unknown, varsayilan = 0): number {
  if (typeof ham === 'number') return Number.isFinite(ham) ? ham : varsayilan;
  if (ham === null || ham === undefined) return varsayilan;

  let metin = String(ham).trim();
  if (metin === '') return varsayilan;

  metin = metin.replace(/\s/g, '').replace(/₺|TL|TRY/gi, '');
  const eksi = metin.startsWith('-') || (metin.startsWith('(') && metin.endsWith(')'));
  metin = metin.replace(/[()\-+]/g, '');

  const noktaVar = metin.includes('.');
  const virgulVar = metin.includes(',');

  if (noktaVar && virgulVar) {
    // Hangisi sonda ise ondalık ayırıcıdır.
    metin =
      metin.lastIndexOf(',') > metin.lastIndexOf('.')
        ? metin.replace(/\./g, '').replace(',', '.')
        : metin.replace(/,/g, '');
  } else if (virgulVar) {
    metin = metin.replace(',', '.');
  } else if (noktaVar) {
    // Tek nokta: son parça 3 haneliyse ve öncesi varsa binlik ayırıcıdır.
    const parcalar = metin.split('.');
    const son = parcalar[parcalar.length - 1]!;
    if (parcalar.length > 2 || (son.length === 3 && parcalar[0]!.length > 0 && parcalar.length === 2 && metin.length > 4)) {
      metin = parcalar.join('');
    }
  }

  const sayi = Number(metin);
  if (!Number.isFinite(sayi)) return varsayilan;
  return eksi ? -sayi : sayi;
}

export function tariheCevir(ham: unknown): ISOTarih | null {
  if (ham === null || ham === undefined) return null;
  if (ham instanceof Date) {
    if (Number.isNaN(ham.getTime())) return null;
    return `${ham.getFullYear()}-${String(ham.getMonth() + 1).padStart(2, '0')}-${String(ham.getDate()).padStart(2, '0')}`;
  }

  const metin = String(ham).trim();
  if (metin === '') return null;

  // 2026-09-05 veya 2026-09-05T00:00:00
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(metin);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 05.09.2026 · 05/09/2026 · 5-9-2026
  const gunOnce = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(metin);
  if (gunOnce) {
    const [, g, a, y] = gunOnce;
    return `${y}-${a!.padStart(2, '0')}-${g!.padStart(2, '0')}`;
  }

  return null;
}

export function metneCevir(ham: unknown): string | null {
  if (ham === null || ham === undefined) return null;
  const metin = String(ham).trim();
  return metin === '' ? null : metin;
}

export function mantiksalaCevir(ham: unknown, varsayilan = true): boolean {
  if (typeof ham === 'boolean') return ham;
  if (ham === null || ham === undefined) return varsayilan;
  const metin = String(ham).trim().toLocaleLowerCase('tr');
  if (['1', 'true', 'evet', 'e', 'aktif', 'x', 'var'].includes(metin)) return true;
  if (['0', 'false', 'hayır', 'hayir', 'h', 'pasif', 'yok'].includes(metin)) return false;
  return varsayilan;
}

/**
 * RFC 4180 uyumlu, ayırıcıyı kendi bulan CSV çözümleyici.
 * Türkçe Excel ';' kullanır, İngilizce ',' — ikisini de destekliyoruz.
 */
export function csvCoz(icerik: string, ayirici?: string): Record<string, string>[] {
  let metin = icerik;
  if (metin.charCodeAt(0) === 0xfeff) metin = metin.slice(1); // BOM

  const sec = ayirici && ayirici !== 'auto' ? ayirici : ayiriciBul(metin);
  const satirlar = satirlariCoz(metin, sec);
  if (satirlar.length === 0) return [];

  const basliklar = satirlar[0]!.map((b) => b.trim());
  const sonuc: Record<string, string>[] = [];
  for (let i = 1; i < satirlar.length; i++) {
    const hucreler = satirlar[i]!;
    if (hucreler.length === 1 && (hucreler[0] ?? '').trim() === '') continue;
    const kayit: Record<string, string> = {};
    basliklar.forEach((baslik, j) => {
      kayit[baslik] = hucreler[j] ?? '';
    });
    sonuc.push(kayit);
  }
  return sonuc;
}

function ayiriciBul(metin: string): string {
  const ilkSatir = metin.split(/\r?\n/, 1)[0] ?? '';
  const adaylar = [';', ',', '\t', '|'];
  let enIyi = ',';
  let enCok = -1;
  for (const aday of adaylar) {
    const adet = ilkSatir.split(aday).length - 1;
    if (adet > enCok) {
      enCok = adet;
      enIyi = aday;
    }
  }
  return enIyi;
}

function satirlariCoz(metin: string, ayirici: string): string[][] {
  const satirlar: string[][] = [];
  let hucreler: string[] = [];
  let hucre = '';
  let tirnakli = false;

  for (let i = 0; i < metin.length; i++) {
    const k = metin[i]!;
    if (tirnakli) {
      if (k === '"') {
        if (metin[i + 1] === '"') {
          hucre += '"';
          i++;
        } else {
          tirnakli = false;
        }
      } else {
        hucre += k;
      }
      continue;
    }
    if (k === '"') {
      tirnakli = true;
    } else if (k === ayirici) {
      hucreler.push(hucre);
      hucre = '';
    } else if (k === '\n') {
      hucreler.push(hucre);
      satirlar.push(hucreler);
      hucreler = [];
      hucre = '';
    } else if (k !== '\r') {
      hucre += k;
    }
  }
  if (hucre !== '' || hucreler.length > 0) {
    hucreler.push(hucre);
    satirlar.push(hucreler);
  }
  return satirlar;
}
