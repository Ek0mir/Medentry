import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sorgu, tekSatir } from '../../db/havuz.js';
import { ayarYaz } from '../../db/yardimcilar.js';
import { rastgeleParola, sifreOzetle } from '../../kimlik/sifre.js';
import { ISLER, isBul, isiCalistir } from '../../jobs/kayit.js';
import { saglikDurumu } from '../../jobs/w14-saglik.js';
import { anahtarOzetle, yetkiGerek } from '../kimlik.js';

const ROLLER = ['YONETICI', 'UST_ONAY', 'SATIS', 'MUHASEBE', 'SEVKIYAT'] as const;

const kullaniciSemasi = z.object({
  ad: z.string().min(2),
  kullaniciAdi: z.string().min(2).regex(/^[a-z0-9_.]+$/, 'Küçük harf, rakam, nokta ve alt çizgi.'),
  rol: z.enum(ROLLER),
  telefon: z.string().optional().nullable(),
  eposta: z.string().email().optional().nullable(),
  /** Mikro cari kartındaki temsilci adı; boşsa kullanıcının adı denenir. */
  mikroTemsilci: z.string().optional().nullable(),
});

const isCalistirmaSemasi = z.object({
  gun: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  zorla: z.boolean().optional(),
});

export async function yonetimRotalari(sunucu: FastifyInstance): Promise<void> {
  // --- sağlık (kimlik istemez: izleme aracı da çağırabilsin) ---------------
  sunucu.get('/saglik', async (_istek, yanit) => {
    const rapor = await saglikDurumu();
    return yanit.code(rapor.saglikli ? 200 : 503).send(rapor);
  });

  // --- işler ---------------------------------------------------------------
  sunucu.get('/isler', { preHandler: yetkiGerek(['YONETICI']) }, async () => ({
    isler: ISLER.map((i) => ({
      kod: i.kod,
      ad: i.ad,
      zamanlama: i.zamanlama,
      aciklama: i.aciklama,
      sadeceIsGunu: i.sadeceIsGunu ?? false,
    })),
  }));

  /**
   * İşi elle tetikler. Otomasyonun (n8n, cron, izleme) tutunacağı uç burası —
   * zamanlayıcıyı beklemeden dışarıdan çalıştırılabilir.
   */
  sunucu.post<{ Params: { kod: string } }>(
    '/isler/:kod/calistir',
    { preHandler: yetkiGerek(['YONETICI']) },
    async (istek, yanit) => {
      const is = isBul(istek.params.kod);
      if (!is) return yanit.code(404).send({ hata: `Bilinmeyen iş kodu: ${istek.params.kod}` });

      const cozum = isCalistirmaSemasi.safeParse(istek.body ?? {});
      if (!cozum.success) return yanit.code(422).send({ hata: 'Geçersiz parametre.' });

      const kayit = await isiCalistir(is, cozum.data);
      return yanit.code(kayit.basarili ? 200 : 500).send(kayit);
    },
  );

  sunucu.get('/isler/gecmis', { preHandler: yetkiGerek(['YONETICI']) }, async () => ({
    senkron: await sorgu(
      `SELECT calisma_id, kaynak, baslangic, bitis, kayit_sayisi, durum, hata, ayrinti
         FROM stg_senkron_log ORDER BY calisma_id DESC LIMIT 30`,
    ),
    kayitlar: await sorgu(
      `SELECT id, olay, seviye, detay, ts FROM op_sistem_log
        WHERE olay LIKE 'is.%' OR seviye <> 'BILGI'
        ORDER BY ts DESC LIMIT 100`,
    ),
  }));

  // --- kullanıcılar --------------------------------------------------------
  sunucu.get('/kullanicilar', { preHandler: yetkiGerek() }, async (istek) => {
    // Görev atarken herkesin listeyi görmesi gerekir; parola özeti asla dönmez.
    const hepsi = istek.kimlik!.rol === 'YONETICI';
    return {
      kullanicilar: await sorgu(
        `SELECT id, ad, kullanici_adi, rol, telefon, eposta, aktif, mikro_temsilci${hepsi ? ', olusma_ts' : ''}
           FROM op_kullanici WHERE aktif OR $1 ORDER BY id`,
        [hepsi],
      ),
    };
  });

  sunucu.post('/kullanicilar', { preHandler: yetkiGerek(['YONETICI']) }, async (istek, yanit) => {
    const cozum = kullaniciSemasi.safeParse(istek.body);
    if (!cozum.success) {
      return yanit.code(422).send({ hatalar: cozum.error.issues.map((h) => h.message) });
    }
    const k = cozum.data;

    const mevcut = await tekSatir('SELECT id FROM op_kullanici WHERE kullanici_adi = $1', [
      k.kullaniciAdi,
    ]);
    if (mevcut) return yanit.code(409).send({ hata: 'Bu kullanıcı adı zaten var.' });

    // Parola bir kez gösterilir, saklanmaz.
    const parola = rastgeleParola();
    const satir = await tekSatir<{ id: number }>(
      `INSERT INTO op_kullanici (ad, kullanici_adi, sifre_hash, rol, telefon, eposta, mikro_temsilci)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [k.ad, k.kullaniciAdi, await sifreOzetle(parola), k.rol, k.telefon ?? null, k.eposta ?? null,
       k.mikroTemsilci ?? null],
    );
    return yanit.code(201).send({ id: satir!.id, kullaniciAdi: k.kullaniciAdi, gecici: parola });
  });

  sunucu.patch<{ Params: { id: string } }>(
    '/kullanicilar/:id',
    { preHandler: yetkiGerek(['YONETICI']) },
    async (istek, yanit) => {
      const id = Number(istek.params.id);
      const govde = z
        .object({
          ad: z.string().min(2).optional(),
          rol: z.enum(ROLLER).optional(),
          telefon: z.string().nullable().optional(),
          eposta: z.string().email().nullable().optional(),
          mikroTemsilci: z.string().nullable().optional(),
          aktif: z.boolean().optional(),
          parolayiSifirla: z.boolean().optional(),
        })
        .safeParse(istek.body);
      if (!govde.success) return yanit.code(422).send({ hatalar: govde.error.issues.map((h) => h.message) });

      const g = govde.data;
      let gecici: string | undefined;
      if (g.parolayiSifirla) {
        gecici = rastgeleParola();
        await sorgu('UPDATE op_kullanici SET sifre_hash = $2 WHERE id = $1', [
          id,
          await sifreOzetle(gecici),
        ]);
        await sorgu('DELETE FROM op_oturum WHERE kullanici_id = $1', [id]);
      }

      const satir = await tekSatir(
        `UPDATE op_kullanici SET
           ad      = COALESCE($2, ad),
           rol     = COALESCE($3, rol),
           telefon = COALESCE($4, telefon),
           eposta  = COALESCE($5, eposta),
           aktif   = COALESCE($6, aktif),
           mikro_temsilci = COALESCE($7, mikro_temsilci)
         WHERE id = $1
         RETURNING id, ad, kullanici_adi, rol, telefon, eposta, aktif, mikro_temsilci`,
        [id, g.ad ?? null, g.rol ?? null, g.telefon ?? null, g.eposta ?? null, g.aktif ?? null,
         g.mikroTemsilci ?? null],
      );
      if (!satir) return yanit.code(404).send({ hata: 'Kullanıcı bulunamadı.' });
      return yanit.send({ kullanici: satir, gecici });
    },
  );

  // --- ayarlar (risk ağırlıkları, eşikler) ---------------------------------
  sunucu.get('/ayarlar', { preHandler: yetkiGerek(['YONETICI']) }, async () => ({
    ayarlar: await sorgu('SELECT anahtar, deger, aciklama, guncelleme_ts FROM op_ayar ORDER BY anahtar'),
  }));

  sunucu.put<{ Params: { anahtar: string } }>(
    '/ayarlar/:anahtar',
    { preHandler: yetkiGerek(['YONETICI']) },
    async (istek, yanit) => {
      const govde = z.object({ deger: z.unknown() }).safeParse(istek.body);
      if (!govde.success || govde.data.deger === undefined) {
        return yanit.code(422).send({ hata: '"deger" alanı zorunlu.' });
      }
      await ayarYaz(istek.params.anahtar, govde.data.deger);
      return yanit.send({ anahtar: istek.params.anahtar, deger: govde.data.deger });
    },
  );

  // --- tatiller (dinî bayramlar her yıl elle eklenir) ----------------------
  sunucu.get('/tatiller', { preHandler: yetkiGerek() }, async () => ({
    tatiller: await sorgu('SELECT tarih, ad FROM op_tatil ORDER BY tarih'),
  }));

  sunucu.post('/tatiller', { preHandler: yetkiGerek(['YONETICI']) }, async (istek, yanit) => {
    const govde = z
      .object({ tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ad: z.string().min(2) })
      .safeParse(istek.body);
    if (!govde.success) return yanit.code(422).send({ hatalar: govde.error.issues.map((h) => h.message) });

    await sorgu(
      `INSERT INTO op_tatil (tarih, ad) VALUES ($1, $2)
       ON CONFLICT (tarih) DO UPDATE SET ad = EXCLUDED.ad`,
      [govde.data.tarih, govde.data.ad],
    );
    return yanit.code(201).send(govde.data);
  });

  sunucu.delete<{ Params: { tarih: string } }>(
    '/tatiller/:tarih',
    { preHandler: yetkiGerek(['YONETICI']) },
    async (istek, yanit) => {
      await sorgu('DELETE FROM op_tatil WHERE tarih = $1', [istek.params.tarih]);
      return yanit.send({ durum: 'silindi' });
    },
  );

  // --- API anahtarları (otomasyon ve veri çekme erişimi) -------------------
  sunucu.get('/api-anahtarlari', { preHandler: yetkiGerek(['YONETICI']) }, async () => ({
    // anahtar_hash asla dönmez.
    anahtarlar: await sorgu(
      'SELECT id, ad, rol, aktif, son_kullanim_ts, olusma_ts FROM op_api_anahtari ORDER BY id',
    ),
  }));

  sunucu.post('/api-anahtarlari', { preHandler: yetkiGerek(['YONETICI']) }, async (istek, yanit) => {
    const govde = z.object({ ad: z.string().min(2), rol: z.enum(ROLLER) }).safeParse(istek.body);
    if (!govde.success) return yanit.code(422).send({ hatalar: govde.error.issues.map((h) => h.message) });

    // Anahtar yalnızca burada, bir kez görünür; veritabanında özeti tutulur.
    const anahtar = `mrf_${randomBytes(24).toString('base64url')}`;
    const satir = await tekSatir<{ id: number }>(
      'INSERT INTO op_api_anahtari (ad, anahtar_hash, rol) VALUES ($1, $2, $3) RETURNING id',
      [govde.data.ad, anahtarOzetle(anahtar), govde.data.rol],
    );
    return yanit.code(201).send({
      id: satir!.id,
      ad: govde.data.ad,
      rol: govde.data.rol,
      anahtar,
      uyari: 'Bu anahtar bir daha gösterilmeyecek. Şimdi kopyalayın.',
    });
  });

  sunucu.delete<{ Params: { id: string } }>(
    '/api-anahtarlari/:id',
    { preHandler: yetkiGerek(['YONETICI']) },
    async (istek, yanit) => {
      await sorgu('UPDATE op_api_anahtari SET aktif = false WHERE id = $1', [Number(istek.params.id)]);
      return yanit.send({ durum: 'kapatıldı' });
    },
  );

  // --- olay outbox (WhatsApp/n8n buraya abone olur) ------------------------
  sunucu.get('/olaylar', { preHandler: yetkiGerek(['YONETICI']) }, async (istek) => {
    const s = z
      .object({
        islenmemis: z.coerce.boolean().optional(),
        tur: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(100),
      })
      .parse(istek.query);

    return {
      olaylar: await sorgu(
        `SELECT id, tur, konu_tip, konu_id, veri, ts, islendi_ts FROM op_olay
          WHERE ($1::boolean IS NOT TRUE OR islendi_ts IS NULL)
            AND ($2::text IS NULL OR tur = $2)
          ORDER BY id DESC LIMIT $3`,
        [s.islenmemis ?? null, s.tur ?? null, s.limit],
      ),
    };
  });

  /** Olayları işlendi olarak işaretler — tüketici bunu çağırır. */
  sunucu.post('/olaylar/islendi', { preHandler: yetkiGerek(['YONETICI']) }, async (istek, yanit) => {
    const govde = z.object({ idler: z.array(z.number().int()).min(1).max(1000) }).safeParse(istek.body);
    if (!govde.success) return yanit.code(422).send({ hata: '"idler" dizisi zorunlu.' });

    const sonuc = await sorgu(
      'UPDATE op_olay SET islendi_ts = now() WHERE id = ANY($1) AND islendi_ts IS NULL RETURNING id',
      [govde.data.idler],
    );
    return yanit.send({ islenen: sonuc.length });
  });
}
