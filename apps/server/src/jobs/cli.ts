import { havuzuKapat } from '../db/havuz.js';
import { ISLER, isBul, isiCalistir } from './kayit.js';
import type { IsBaglami } from './tipler.js';

/**
 * İşleri komut satırından çalıştırır — zamanlayıcıyı beklemeden.
 *
 *   npm run is -w apps/server -- W-01
 *   npm run is -w apps/server -- W-01 W-02 W-03
 *   npm run is -w apps/server -- W-03 --gun 2026-09-07     (belirli bir gün için)
 *   npm run is -w apps/server -- W-03 --zorla              (iş günü kontrolünü atla)
 *   npm run is -w apps/server -- --liste
 */
const hepsi = process.argv.slice(2);

const baglam: IsBaglami = {};
const kodlar: string[] = [];
for (let i = 0; i < hepsi.length; i++) {
  const arg = hepsi[i]!;
  if (arg === '--gun') {
    const deger = hepsi[++i];
    if (!deger || !/^\d{4}-\d{2}-\d{2}$/.test(deger)) {
      console.error('--gun için YYYY-MM-DD biçiminde bir tarih verin.');
      process.exit(2);
    }
    baglam.gun = deger;
  } else if (arg === '--zorla') {
    baglam.zorla = true;
  } else {
    kodlar.push(arg);
  }
}

if (kodlar.length === 0 || kodlar.includes('--liste')) {
  console.log('Tanımlı işler:\n');
  for (const is of ISLER) {
    const zaman = is.zamanlama ? is.zamanlama.padEnd(14) : 'elle'.padEnd(14);
    console.log(`  ${is.kod}  ${zaman}${is.ad}`);
    console.log(`         ${is.aciklama}\n`);
  }
  await havuzuKapat();
  process.exit(0);
}

let hataVar = false;
for (const kod of kodlar) {
  const is = isBul(kod);
  if (!is) {
    console.error(`Bilinmeyen iş kodu: ${kod}`);
    hataVar = true;
    continue;
  }
  process.stdout.write(`${is.kod} ${is.ad}... `);
  const kayit = await isiCalistir(is, baglam);
  if (kayit.basarili) {
    console.log(`bitti (${kayit.sureMs} ms)\n  ${kayit.ozet}`);
  } else {
    console.log(`HATA (${kayit.sureMs} ms)\n  ${kayit.ozet}`);
    hataVar = true;
  }
}

await havuzuKapat();
process.exit(hataVar ? 1 : 0);
