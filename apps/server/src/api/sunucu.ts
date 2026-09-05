import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { ayarlar } from '../ayarlar.js';
import { sistemLogu } from '../db/yardimcilar.js';
import { kimligiCoz } from './kimlik.js';
import { cariRotalari } from './v1/cariler.js';
import { gorevRotalari } from './v1/gorevler.js';
import { oturumRotalari } from './v1/oturum.js';
import { raporRotalari } from './v1/raporlar.js';
import { yonetimRotalari } from './v1/yonetim.js';

const buDosya = dirname(fileURLToPath(import.meta.url));

/** Derlenmiş paneli bulur; yoksa API tek başına çalışır (geliştirmede Vite ayrı sunar). */
function panelDizini(): string | null {
  const adaylar = [
    resolve(buDosya, '../../../web/dist'),
    resolve(buDosya, '../../../../apps/web/dist'),
    resolve(process.cwd(), 'apps/web/dist'),
  ];
  return adaylar.find((a) => existsSync(resolve(a, 'index.html'))) ?? null;
}

export async function sunucuKur(): Promise<FastifyInstance> {
  const sunucu = Fastify({
    logger: { level: ayarlar.NODE_ENV === 'production' ? 'info' : 'warn' },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await sunucu.register(cookie, { secret: ayarlar.OTURUM_SIRRI });

  await sunucu.register(swagger, {
    openapi: {
      info: {
        title: 'MİRFİX Operasyon Katmanı API',
        description:
          'Mikro üzerine kurulu operasyon katmanının API’si. Panel bu uçlardan beslenir; ' +
          'otomasyon ve veri çekme de aynı uçları kullanır (X-API-Key ile). ' +
          'Liste ve rapor uçları ?format=json|csv|xlsx destekler.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          apiAnahtari: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
          oturumCerezi: { type: 'apiKey', name: 'mirfix_oturum', in: 'cookie' },
        },
      },
    },
  });
  await sunucu.register(swaggerUi, { routePrefix: '/api/belgeler' });

  // Her istekte kimlik çözülür; yetki kontrolü rotalarda yapılır.
  sunucu.addHook('preHandler', kimligiCoz);

  sunucu.setErrorHandler(async (ham, istek, yanit) => {
    const hata = ham as Error & { statusCode?: number };
    const durum = hata.statusCode ?? 500;
    if (durum >= 500) {
      sunucu.log.error({ hata, yol: istek.url }, 'İstek hatası');
      await sistemLogu('api.hata', 'HATA', {
        yol: istek.url,
        yontem: istek.method,
        mesaj: hata.message,
      }).catch(() => {});
    }
    // İç hata ayrıntısı dışarı sızmaz.
    return yanit.code(durum).send({
      hata: durum >= 500 ? 'Sunucu hatası. Sistem kaydına bakın.' : hata.message,
    });
  });

  await sunucu.register(
    async (v1) => {
      await oturumRotalari(v1);
      await cariRotalari(v1);
      await gorevRotalari(v1);
      await raporRotalari(v1);
      await yonetimRotalari(v1);
    },
    { prefix: '/api/v1' },
  );

  // Derlenmiş panel varsa aynı porttan sunulur: mini PC'de tek servis, tek adres.
  const panel = panelDizini();
  if (panel) {
    await sunucu.register(fastifyStatic, { root: panel, prefix: '/' });
    // SPA yönlendirmesi: bilinmeyen yol API değilse index.html'e düşer.
    sunucu.setNotFoundHandler(async (istek, yanit) => {
      if (istek.url.startsWith('/api/')) {
        return yanit.code(404).send({ hata: 'Böyle bir uç yok.' });
      }
      return yanit.sendFile('index.html');
    });
  } else {
    sunucu.get('/', async () => ({
      ad: 'MİRFİX Operasyon Katmanı',
      not: 'Panel derlenmemiş. Geliştirmede: npm run dev:web — üretimde: npm run build',
      api: '/api/v1',
      belgeler: '/api/belgeler',
    }));
  }

  return sunucu;
}
