import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sorgu } from '../../db/havuz.js';
import { BANTLAR } from '../../core/yaslandirma.js';
import { bicimCoz, yanitla, type Kolon } from '../disaAktarma.js';
import { yetkiGerek } from '../kimlik.js';

/**
 * Raporlama uçları.
 *
 * Hepsi rpt_* view'larını okur: rapor mantığı SQL'de tek yerde durur, panel de
 * dışarıdan veri çeken de (Excel, Power BI, n8n) aynı tanımı görür.
 * Hepsi ?format=json|csv|xlsx destekler.
 */
const araligSemasi = z.object({
  baslangic: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bitis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.string().optional(),
});

const PARA: Kolon<Record<string, unknown>>[] = BANTLAR.map((b) => ({
  anahtar: b.anahtar,
  baslik: b.ad,
}));

export async function raporRotalari(sunucu: FastifyInstance): Promise<void> {
  /** Panelin üst şeridindeki sayılar. */
  sunucu.get('/raporlar/ozet', { preHandler: yetkiGerek() }, async () => {
    const [yaslandirma] = await sorgu<Record<string, number>>(
      'SELECT * FROM rpt_yaslandirma_ozet ORDER BY tarih DESC LIMIT 1',
    );
    const [dso] = await sorgu<Record<string, number>>(
      'SELECT * FROM rpt_dso ORDER BY tarih DESC LIMIT 1',
    );
    const [gorev] = await sorgu<Record<string, number>>(
      `SELECT count(*) FILTER (WHERE durum = 'ACIK')::int AS acik,
              count(*) FILTER (WHERE durum = 'ACIK' AND son_tarih < now())::int AS gecikmis,
              count(*) FILTER (WHERE durum = 'ACIK' AND eskalasyon_seviyesi >= 2)::int AS eskalasyonda,
              count(*) FILTER (WHERE is_gunu = CURRENT_DATE)::int AS bugun_acilan,
              count(*) FILTER (WHERE is_gunu = CURRENT_DATE AND durum = 'KAPALI')::int AS bugun_kapanan
         FROM op_gorev`,
    );
    const [kademe] = await sorgu<Record<string, number>>(
      `SELECT count(*) FILTER (WHERE kademe >= 7)::int AS sevk_durdurma_ustu,
              count(*) FILTER (WHERE kademe >= 5)::int AS riskli_ve_ustu,
              count(*)::int AS toplam_cari
         FROM rpt_cari_risk`,
    );

    return {
      yaslandirma: yaslandirma ?? null,
      dso: dso ?? null,
      gorev: gorev ?? null,
      kademe: kademe ?? null,
    };
  });

  sunucu.get('/raporlar/yaslandirma', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const s = araligSemasi.parse(istek.query);
    const satirlar = await sorgu<Record<string, unknown>>(
      `SELECT * FROM rpt_yaslandirma_ozet
        WHERE ($1::date IS NULL OR tarih >= $1) AND ($2::date IS NULL OR tarih <= $2)
        ORDER BY tarih DESC LIMIT 400`,
      [s.baslangic ?? null, s.bitis ?? null],
    );
    return yanitla(
      yanit,
      bicimCoz(s.format),
      satirlar,
      [
        { anahtar: 'tarih', baslik: 'Tarih' },
        { anahtar: 'cari_adedi', baslik: 'Cari adedi' },
        ...PARA,
        { anahtar: 'vadesi_gelmemis', baslik: 'Vadesi gelmemiş' },
        { anahtar: 'doksan_gun_ustu', baslik: '90 gün üstü' },
        { anahtar: 'toplam', baslik: 'Toplam' },
      ],
      'yaslandirma',
      { toplam: satirlar.length },
    );
  });

  /** Kişi bazlı kapanma oranı — başarı kriteri #1 (Bölüm 15). */
  sunucu.get('/raporlar/kapanma-orani', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const s = araligSemasi.parse(istek.query);
    const satirlar = await sorgu<Record<string, unknown>>(
      `SELECT * FROM rpt_gorev_kapanma
        WHERE ($1::date IS NULL OR is_gunu >= $1) AND ($2::date IS NULL OR is_gunu <= $2)
        ORDER BY is_gunu DESC, tip, sorumlu_ad LIMIT 2000`,
      [s.baslangic ?? null, s.bitis ?? null],
    );
    return yanitla(
      yanit,
      bicimCoz(s.format),
      satirlar,
      [
        { anahtar: 'is_gunu', baslik: 'İş günü' },
        { anahtar: 'tip', baslik: 'Görev tipi' },
        { anahtar: 'sorumlu_ad', baslik: 'Sorumlu' },
        { anahtar: 'acilan', baslik: 'Açılan' },
        { anahtar: 'kapanan', baslik: 'Kapanan' },
        { anahtar: 'acik', baslik: 'Açık' },
        { anahtar: 'kapanma_orani', baslik: 'Kapanma oranı %' },
        { anahtar: 'odeme_sozu', baslik: 'Ödeme sözü' },
        { anahtar: 'ulasilamadi', baslik: 'Ulaşılamadı' },
        { anahtar: 'eskalasyona_giden', baslik: 'Eskalasyona giden' },
      ],
      'kapanma-orani',
      { toplam: satirlar.length },
    );
  });

  /** Eskalasyon trendi — başarı kriteri #4: azalan trend beklenir. */
  sunucu.get('/raporlar/eskalasyon', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const s = araligSemasi.parse(istek.query);
    const satirlar = await sorgu<Record<string, unknown>>(
      'SELECT * FROM rpt_eskalasyon_haftalik ORDER BY hafta DESC, seviye LIMIT 200',
    );
    return yanitla(
      yanit,
      bicimCoz(s.format),
      satirlar,
      [
        { anahtar: 'hafta', baslik: 'Hafta' },
        { anahtar: 'seviye', baslik: 'Seviye' },
        { anahtar: 'adet', baslik: 'Adet' },
        { anahtar: 'ayrik_kayit', baslik: 'Ayrık görev' },
      ],
      'eskalasyon',
      { toplam: satirlar.length },
    );
  });

  /** DSO — başarı kriteri #2: 13. haftada %10 düşüş hedefi. */
  sunucu.get('/raporlar/dso', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const s = araligSemasi.parse(istek.query);
    const satirlar = await sorgu<Record<string, unknown>>(
      'SELECT * FROM rpt_dso ORDER BY tarih DESC LIMIT 400',
    );
    return yanitla(
      yanit,
      bicimCoz(s.format),
      satirlar,
      [
        { anahtar: 'tarih', baslik: 'Tarih' },
        { anahtar: 'acik_bakiye', baslik: 'Açık bakiye' },
        { anahtar: 'ciro_90_gun', baslik: '90 gün cirosu' },
        { anahtar: 'dso_gun', baslik: 'DSO (gün)' },
      ],
      'dso',
      { toplam: satirlar.length },
    );
  });

  /** Çek vade takvimi — muhasebe ekranı ve W-08'in temeli. */
  sunucu.get('/raporlar/cek-takvimi', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const s = z.object({ gun: z.coerce.number().int().min(1).max(365).default(30), format: z.string().optional() })
      .parse(istek.query);
    const satirlar = await sorgu<Record<string, unknown>>(
      'SELECT * FROM rpt_cek_takvimi WHERE kalan_gun <= $1 ORDER BY vade',
      [s.gun],
    );
    return yanitla(
      yanit,
      bicimCoz(s.format),
      satirlar,
      [
        { anahtar: 'vade', baslik: 'Vade' },
        { anahtar: 'kalan_gun', baslik: 'Kalan gün' },
        { anahtar: 'cek_no', baslik: 'Çek no' },
        { anahtar: 'cari_kod', baslik: 'Cari kodu' },
        { anahtar: 'unvan', baslik: 'Unvan', genislik: 34 },
        { anahtar: 'tutar', baslik: 'Tutar' },
        { anahtar: 'banka', baslik: 'Banka' },
      ],
      'cek-takvimi',
      { toplam: satirlar.length },
    );
  });
}
