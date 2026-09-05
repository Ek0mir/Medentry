import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sorgu, tekSatir } from '../../db/havuz.js';
import { GOREV_TIPLERI, IZINLI_SONUCLAR, SONUCLAR, SONUC_ETIKETLERI } from '../../core/gorevKurallari.js';
import { bugun } from '../../core/tarih.js';
import { gorevAc, gorevKapat } from '../../gorev/servis.js';
import { bicimCoz, yanitla, type Kolon } from '../disaAktarma.js';
import { yetkiGerek } from '../kimlik.js';

const listeSemasi = z.object({
  durum: z.enum(['ACIK', 'KAPALI', 'IPTAL']).optional(),
  tip: z.enum(GOREV_TIPLERI).optional(),
  sorumluId: z.coerce.number().int().optional(),
  cariKod: z.string().optional(),
  isGunu: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gecikmis: z.coerce.boolean().optional(),
  eskalasyonEnAz: z.coerce.number().int().min(0).max(3).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  ofset: z.coerce.number().int().min(0).default(0),
  format: z.string().optional(),
});

const acmaSemasi = z.object({
  tip: z.enum(GOREV_TIPLERI),
  cariKod: z.string().optional().nullable(),
  sorumluId: z.number().int(),
  aciklama: z.string().min(3, 'Açıklama en az 3 karakter olmalı.'),
  sonTarih: z.string().datetime({ offset: true }),
  gerekce: z.string().optional().nullable(),
});

const kapatmaSemasi = z.object({
  sonuc: z.enum(SONUCLAR).optional(),
  sonucNotu: z.string().optional().nullable(),
  sozTarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sozTutari: z.number().positive().optional().nullable(),
});

const KOLONLAR: Kolon<Record<string, unknown>>[] = [
  { anahtar: 'id', baslik: 'Görev no' },
  { anahtar: 'tip', baslik: 'Tip' },
  { anahtar: 'cari_kod', baslik: 'Cari kodu' },
  { anahtar: 'unvan', baslik: 'Unvan', genislik: 34 },
  { anahtar: 'sorumlu_ad', baslik: 'Sorumlu' },
  { anahtar: 'aciklama', baslik: 'Açıklama', genislik: 46 },
  { anahtar: 'son_tarih', baslik: 'Son tarih' },
  { anahtar: 'durum', baslik: 'Durum' },
  { anahtar: 'sonuc', baslik: 'Sonuç' },
  { anahtar: 'sonuc_notu', baslik: 'Sonuç notu', genislik: 40 },
  { anahtar: 'eskalasyon_seviyesi', baslik: 'Eskalasyon' },
  { anahtar: 'gerekce', baslik: 'Gerekçe', genislik: 52 },
  { anahtar: 'kapanma_ts', baslik: 'Kapanma' },
];

const SECIM = `
  g.id, g.tip, g.cari_kod, c.unvan, g.sorumlu_id, k.ad AS sorumlu_ad, g.aciklama,
  g.son_tarih, g.is_gunu, g.durum, g.sonuc, g.sonuc_notu, g.oncelik_sira, g.gerekce,
  g.eskalasyon_seviyesi, g.kaynak, g.olusma_ts, g.kapanma_ts,
  (g.durum = 'ACIK' AND g.son_tarih < now()) AS gecikmis,
  r.skor, r.kademe, r.kademe_ad, r.vadesi_gecen, r.telefon`;

const KAYNAK = `
  FROM op_gorev g
  JOIN op_kullanici k ON k.id = g.sorumlu_id
  LEFT JOIN stg_cari c ON c.kod = g.cari_kod
  LEFT JOIN rpt_cari_risk r ON r.kod = g.cari_kod`;

export async function gorevRotalari(sunucu: FastifyInstance): Promise<void> {
  /** Sonuç seçeneklerini panel buradan okur — liste tek yerde tanımlı. */
  sunucu.get('/gorevler/sonuc-secenekleri', { preHandler: yetkiGerek() }, async () => ({
    tipler: Object.fromEntries(
      Object.entries(IZINLI_SONUCLAR).map(([tip, sonuclar]) => [
        tip,
        sonuclar.map((s) => ({ deger: s, etiket: SONUC_ETIKETLERI[s] })),
      ]),
    ),
  }));

  sunucu.get('/gorevler', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const cozum = listeSemasi.safeParse(istek.query);
    if (!cozum.success) {
      return yanit.code(400).send({ hata: 'Geçersiz sorgu parametresi.', ayrinti: cozum.error.issues });
    }
    const s = cozum.data;
    const kimlik = istek.kimlik!;

    const kosullar: string[] = [];
    const degerler: unknown[] = [];
    const ekle = (sablon: string, deger: unknown) => {
      degerler.push(deger);
      kosullar.push(sablon.replace('?', `$${degerler.length}`));
    };

    // Yönetici ve üst onay her görevi görür; diğerleri kendi görevlerini.
    const hepsiniGorur = kimlik.rol === 'YONETICI' || kimlik.rol === 'UST_ONAY';
    if (!hepsiniGorur && kimlik.kullaniciId) {
      ekle('g.sorumlu_id = ?', kimlik.kullaniciId);
    } else if (s.sorumluId) {
      ekle('g.sorumlu_id = ?', s.sorumluId);
    }

    if (s.durum) ekle('g.durum = ?', s.durum);
    if (s.tip) ekle('g.tip = ?', s.tip);
    if (s.cariKod) ekle('g.cari_kod = ?', s.cariKod);
    if (s.isGunu) ekle('g.is_gunu = ?', s.isGunu);
    if (s.eskalasyonEnAz !== undefined) ekle('g.eskalasyon_seviyesi >= ?', s.eskalasyonEnAz);
    if (s.gecikmis) kosullar.push(`g.durum = 'ACIK' AND g.son_tarih < now()`);

    const nerede = kosullar.length > 0 ? `WHERE ${kosullar.join(' AND ')}` : '';
    const toplamSatiri = await tekSatir<{ adet: number }>(
      `SELECT count(*)::int AS adet ${KAYNAK} ${nerede}`,
      degerler,
    );

    const bicim = bicimCoz(s.format);
    const limitVerildi = Object.hasOwn(istek.query as object, 'limit');
    const limit = bicim === 'json' || limitVerildi ? s.limit : 100_000;
    const ofset = bicim === 'json' ? s.ofset : 0;

    const satirlar = await sorgu<Record<string, unknown>>(
      `SELECT ${SECIM} ${KAYNAK} ${nerede}
        ORDER BY (g.durum = 'ACIK') DESC, g.oncelik_sira NULLS LAST, g.son_tarih
        LIMIT $${degerler.length + 1} OFFSET $${degerler.length + 2}`,
      [...degerler, limit, ofset],
    );

    return yanitla(yanit, bicim, satirlar, KOLONLAR, 'gorevler', {
      toplam: toplamSatiri?.adet ?? 0,
      limit: s.limit,
      ofset: s.ofset,
    });
  });

  /** Bugünün arama kuyruğu — panelin ana ekranı. */
  sunucu.get('/arama-listesi/bugun', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const kimlik = istek.kimlik!;
    const gun = bugun();
    const kendisi = kimlik.rol !== 'YONETICI' && kimlik.rol !== 'UST_ONAY' && kimlik.kullaniciId;

    const satirlar = await sorgu<Record<string, unknown>>(
      `SELECT ${SECIM} ${KAYNAK}
        WHERE g.tip = 'ARAMA' AND g.is_gunu = $1 ${kendisi ? 'AND g.sorumlu_id = $2' : ''}
        ORDER BY (g.durum = 'ACIK') DESC, g.oncelik_sira`,
      kendisi ? [gun, kimlik.kullaniciId] : [gun],
    );

    const acik = satirlar.filter((s) => s.durum === 'ACIK').length;
    return yanit.send({
      gun,
      toplam: satirlar.length,
      acik,
      kapanan: satirlar.length - acik,
      kapanmaOrani: satirlar.length === 0 ? null : Math.round(((satirlar.length - acik) / satirlar.length) * 1000) / 10,
      satirlar,
    });
  });

  sunucu.get<{ Params: { id: string } }>(
    '/gorevler/:id',
    { preHandler: yetkiGerek() },
    async (istek, yanit) => {
      const id = Number(istek.params.id);
      if (!Number.isInteger(id)) return yanit.code(400).send({ hata: 'Geçersiz görev no.' });

      const gorev = await tekSatir<Record<string, unknown>>(
        `SELECT ${SECIM} ${KAYNAK} WHERE g.id = $1`,
        [id],
      );
      if (!gorev) return yanit.code(404).send({ hata: 'Görev bulunamadı.' });

      const [hareketler, eskalasyonlar] = await Promise.all([
        sorgu(
          `SELECT h.id, h.aksiyon, h.notu, h.ayrinti, h.ts, k.ad AS kullanici_ad
             FROM op_gorev_hareket h LEFT JOIN op_kullanici k ON k.id = h.kullanici_id
            WHERE h.gorev_id = $1 ORDER BY h.ts`,
          [id],
        ),
        sorgu(
          `SELECT e.seviye, e.gerekce, e.ts, k.ad AS hedef_ad
             FROM op_eskalasyon e LEFT JOIN op_kullanici k ON k.id = e.hedef_id
            WHERE e.kaynak_tip = 'GOREV' AND e.kaynak_id = $1 ORDER BY e.seviye`,
          [id],
        ),
      ]);

      return yanit.send({ gorev, hareketler, eskalasyonlar });
    },
  );

  sunucu.post('/gorevler', { preHandler: yetkiGerek(['YONETICI', 'UST_ONAY']) }, async (istek, yanit) => {
    const cozum = acmaSemasi.safeParse(istek.body);
    if (!cozum.success) {
      return yanit.code(422).send({
        hata: 'Görev açılamadı.',
        hatalar: cozum.error.issues.map((h) => h.message),
      });
    }
    const g = cozum.data;

    const sorumlu = await tekSatir('SELECT id FROM op_kullanici WHERE id = $1 AND aktif', [g.sorumluId]);
    if (!sorumlu) return yanit.code(422).send({ hata: 'Sorumlu kullanıcı bulunamadı veya pasif.' });

    const gorev = await gorevAc({
      tip: g.tip,
      cariKod: g.cariKod ?? null,
      sorumluId: g.sorumluId,
      aciklama: g.aciklama,
      sonTarih: new Date(g.sonTarih),
      gerekce: g.gerekce ?? null,
      kaynak: 'ELLE',
      olusturanId: istek.kimlik!.kullaniciId,
    });
    return yanit.code(201).send({ gorev });
  });

  /**
   * Görev kapatma. SONUÇ ZORUNLUDUR — eksikse 422 ve nedenleri döner.
   * Panelin kapatma modalı bu hataları olduğu gibi gösterir.
   */
  sunucu.post<{ Params: { id: string } }>(
    '/gorevler/:id/kapat',
    { preHandler: yetkiGerek() },
    async (istek, yanit) => {
      const id = Number(istek.params.id);
      if (!Number.isInteger(id)) return yanit.code(400).send({ hata: 'Geçersiz görev no.' });

      const kimlik = istek.kimlik!;
      if (!kimlik.kullaniciId) {
        return yanit.code(403).send({ hata: 'Görev kapatma yalnızca panelden yapılabilir.' });
      }

      const cozum = kapatmaSemasi.safeParse(istek.body ?? {});
      if (!cozum.success) {
        return yanit.code(422).send({
          hata: 'Görev kapatılamadı.',
          hatalar: cozum.error.issues.map((h) => `${h.path.join('.')}: ${h.message}`),
        });
      }

      const mevcut = await tekSatir<{ sorumlu_id: number }>(
        'SELECT sorumlu_id FROM op_gorev WHERE id = $1',
        [id],
      );
      if (!mevcut) return yanit.code(404).send({ hata: 'Görev bulunamadı.' });

      // Kendi görevini ya da yöneticiysen herhangi birini kapatabilirsin.
      if (mevcut.sorumlu_id !== kimlik.kullaniciId && kimlik.rol !== 'YONETICI') {
        return yanit.code(403).send({ hata: 'Bu görev size atanmamış.' });
      }

      const sonuc = await gorevKapat({
        gorevId: id,
        kullaniciId: kimlik.kullaniciId,
        sonuc: cozum.data.sonuc ?? null,
        sonucNotu: cozum.data.sonucNotu ?? null,
        sozTarihi: cozum.data.sozTarihi ?? null,
        sozTutari: cozum.data.sozTutari ?? null,
      });

      switch (sonuc.durum) {
        case 'kapandi':
          return yanit.send({ gorev: sonuc.gorev, takipGoreviId: sonuc.takipGoreviId });
        case 'gecersiz':
          return yanit.code(422).send({ hata: 'Görev kapatılamadı.', hatalar: sonuc.hatalar });
        case 'zaten_kapali':
          return yanit.code(409).send({ hata: 'Görev zaten kapatılmış.' });
        case 'bulunamadi':
          return yanit.code(404).send({ hata: 'Görev bulunamadı.' });
      }
    },
  );

  /** Eskalasyon panosu — Enes'in ekranı. */
  sunucu.get('/eskalasyonlar', { preHandler: yetkiGerek(['YONETICI', 'UST_ONAY']) }, async (istek, yanit) => {
    const bicim = bicimCoz((istek.query as Record<string, unknown>).format);
    const satirlar = await sorgu<Record<string, unknown>>(
      `SELECT e.id, e.seviye, e.gerekce, e.ts,
              g.id AS gorev_id, g.tip, g.cari_kod, c.unvan, g.aciklama, g.son_tarih, g.durum,
              s.ad AS sorumlu_ad, h.ad AS hedef_ad
         FROM op_eskalasyon e
         JOIN op_gorev g ON g.id = e.kaynak_id AND e.kaynak_tip = 'GOREV'
         JOIN op_kullanici s ON s.id = g.sorumlu_id
         LEFT JOIN op_kullanici h ON h.id = e.hedef_id
         LEFT JOIN stg_cari c ON c.kod = g.cari_kod
        ORDER BY e.ts DESC LIMIT 500`,
    );
    return yanitla(
      yanit,
      bicim,
      satirlar,
      [
        { anahtar: 'ts', baslik: 'Zaman' },
        { anahtar: 'seviye', baslik: 'Seviye' },
        { anahtar: 'gorev_id', baslik: 'Görev no' },
        { anahtar: 'tip', baslik: 'Tip' },
        { anahtar: 'cari_kod', baslik: 'Cari kodu' },
        { anahtar: 'unvan', baslik: 'Unvan', genislik: 34 },
        { anahtar: 'sorumlu_ad', baslik: 'Sorumlu' },
        { anahtar: 'hedef_ad', baslik: 'Bildirilen' },
        { anahtar: 'durum', baslik: 'Görev durumu' },
        { anahtar: 'gerekce', baslik: 'Gerekçe', genislik: 56 },
      ],
      'eskalasyonlar',
      { toplam: satirlar.length },
    );
  });
}
