import { gecisleriCalistir } from './gecisler.js';
import { havuzuKapat } from './havuz.js';

const yeniler = await gecisleriCalistir();
if (yeniler.length === 0) {
  console.log('Veritabanı güncel — uygulanacak yeni geçiş yok.');
} else {
  console.log(`${yeniler.length} geçiş uygulandı:`);
  for (const ad of yeniler) console.log(`  ✓ ${ad}`);
}
await havuzuKapat();
