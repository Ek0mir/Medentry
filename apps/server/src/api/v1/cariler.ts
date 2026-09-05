import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sorgu, tekSatir } from '../../db/havuz.js';
import { bicimCoz, yanitla, type Kolon } from '../disaAktarma.js';
import { temsilciSuzgeci, yetkiGerek } from '../kimlik.js';

const listeSemasi = z.object({
  arama: z.string().optional(),
  kademeEnAz: z.coerce.number().int().min(1).max(8).optional(),
  bant: z.enum(['b_0_30', 'b_31_60', 'b_61_90', 'b_91_180', 'b_180_plus']).optional(),
  temsilci: z.string().optional(),
  sirala: z.enum(['skor', 'vadesi_gecen', 'toplam_bakiye', 'en_eski_gun', 'unvan']).default('skor'),
  yon: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  ofset: z.coerce.number().int().min(0).default(0),
  format: z.string().optional(),
});

const KOLONLAR: Kolon<Record<string, unknown>>[] = [
  { anahtar: 'kod', baslik: 'Cari kodu' },
  { anahtar: 'unvan', baslik: 'Unvan', genislik: 38 },
  { anahtar: 'temsilci', baslik: 'Temsilci' },
  { anahtar: 'il', baslik: 'İl' },
  { anahtar: 'skor', baslik: 'Risk skoru' },
  { anahtar: 'kademe', baslik: 'Kademe' },
  { anahtar: 'kademe_ad', baslik: 'Kademe adı', genislik: 22 },
  { anahtar: 'risk_limiti', baslik: 'Risk limiti' },
  { anahtar: 'toplam_bakiye', baslik: 'Toplam bakiye' },
  { anahtar: 'vadesi_gecen', baslik: 'Vadesi geçen' },
  { anahtar: 'b_0_30', baslik: '0-30 gün' },
  { anahtar: 'b_31_60', baslik: '31-60 gün' },
  { anahtar: 'b_61_90', baslik: '61-90 gün' },
  { anahtar: 'b_91_180', baslik: '91-180 gün' },
  { anahtar: 'b_180_plus', baslik: '180+ gün' },
  { anahtar: 'en_eski_gun', baslik: 'En eski gecikme (gün)' },
  { anahtar: 'limit_kullanim_yuzde', baslik: 'Limit kullanımı %' },
  { anahtar: 'acik_gorev_adedi', baslik: 'Açık görev' },
];

export async function cariRotalari(sunucu: FastifyInstance): Promise<void> {
  sunucu.get('/cariler', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const cozum = listeSemasi.safeParse(istek.query);
    if (!cozum.success) {
      return yanit.code(400).send({ hata: 'Geçersiz sorgu parametresi.', ayrinti: cozum.error.issues });
    }
    const s = cozum.data;

    const kosullar: string[] = [];
    const degerler: unknown[] = [];
    const ekle = (kosul: string, deger: unknown) => {
      degerler.push(deger);
      kosullar.push(kosul.replace('?', `$${degerler.length}`));
    };

    // SATIS rolü yalnızca kendi portföyünü görür (Bölüm 11 yetki matrisi).
    const zorunluTemsilci = temsilciSuzgeci(istek.kimlik!);
    let portfoyUyarisi: string | null = null;
    if (zorunluTemsilci) {
      const [eslesen] = await sorgu<{ adet: number }>(
        'SELECT count(*)::int AS adet FROM stg_cari WHERE temsilci = $1',
        [zorunluTemsilci],
      );
      if ((eslesen?.adet ?? 0) > 0) {
        ekle('temsilci = ?', zorunluTemsilci);
      } else {
        // Mikro'daki temsilci adı bu kullanıcıya eşlenmemiş. Boş liste yerine
        // tümünü gösterip durumu söylüyoruz; eşleme Yönetim ekranından yapılır.
        portfoyUyarisi =
          `"${zorunluTemsilci}" adına kayıtlı cari bulunamadı, tüm liste gösteriliyor. ` +
          'Yönetim → Kullanıcılar ekranından Mikro temsilci eşlemesini yapın.';
      }
    } else if (s.temsilci) {
      ekle('temsilci = ?', s.temsilci);
    }

    if (s.arama) {
      // Tek parametreyi iki kolonda kullanıyoruz. Türkçe büyük/küçük harf
      // (İ/ı) sorunundan kaçınmak için iki tarafı da aynı yerelde küçültüyoruz.
      degerler.push(`%${s.arama.toLocaleLowerCase('tr')}%`);
      kosullar.push(`(lower(unvan) LIKE $${degerler.length} OR lower(kod) LIKE $${degerler.length})`);
    }
    if (s.kademeEnAz) ekle('kademe >= ?', s.kademeEnAz);
    if (s.bant) kosullar.push(`${s.bant} > 0`);

    const nerede = kosullar.length > 0 ? `WHERE ${kosullar.join(' AND ')}` : '';
    const siraKolonu = s.sirala === 'unvan' ? 'unvan' : s.sirala;
    const yon = s.yon === 'asc' ? 'ASC' : 'DESC';

    const toplamSatiri = await tekSatir<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM rpt_cari_risk ${nerede}`,
      degerler,
    );

    const bicim = bicimCoz(s.format);
    // Dosya indirilirken varsayılan sayfalama kalkar ("veri çekme" tam liste
    // ister), ama çağıran limit'i AÇIKÇA verdiyse ona uyulur.
    const limitVerildi = Object.hasOwn(istek.query as object, 'limit');
    const limit = bicim === 'json' || limitVerildi ? s.limit : 100_000;
    const ofset = bicim === 'json' ? s.ofset : 0;

    const satirlar = await sorgu<Record<string, unknown>>(
      `SELECT * FROM rpt_cari_risk ${nerede}
        ORDER BY ${siraKolonu} ${yon} NULLS LAST, kod
        LIMIT $${degerler.length + 1} OFFSET $${degerler.length + 2}`,
      [...degerler, limit, ofset],
    );

    return yanitla(yanit, bicim, satirlar, KOLONLAR, 'cari-risk', {
      toplam: toplamSatiri?.adet ?? 0,
      limit: s.limit,
      ofset: s.ofset,
      ...(portfoyUyarisi ? { uyari: portfoyUyarisi } : {}),
    });
  });

  /** Cari detayı: risk kırılımı, açık faturalar, çekler, görev geçmişi. */
  sunucu.get<{ Params: { kod: string } }>(
    '/cariler/:kod',
    { preHandler: yetkiGerek() },
    async (istek, yanit) => {
      const { kod } = istek.params;

      const cari = await tekSatir<Record<string, unknown>>(
        'SELECT * FROM rpt_cari_risk WHERE kod = $1',
        [kod],
      );
      if (!cari) return yanit.code(404).send({ hata: 'Cari bulunamadı.' });

      // Portföy süzgeci yalnızca eşleme GERÇEKTEN kuruluysa uygulanır;
      // aksi halde kullanıcı kendi carisini de göremez hale gelir.
      const zorunluTemsilci = temsilciSuzgeci(istek.kimlik!);
      if (zorunluTemsilci && cari.temsilci !== zorunluTemsilci) {
        const [eslesen] = await sorgu<{ adet: number }>(
          'SELECT count(*)::int AS adet FROM stg_cari WHERE temsilci = $1',
          [zorunluTemsilci],
        );
        if ((eslesen?.adet ?? 0) > 0) {
          return yanit.code(403).send({ hata: 'Bu cari sizin portföyünüzde değil.' });
        }
      }

      const [faturalar, cekler, gorevler, sozler, yaslandirmaGecmisi] = await Promise.all([
        sorgu(
          `SELECT fatura_no, tarih, vade, tutar, kalan,
                  (CURRENT_DATE - vade) AS gecikme_gun
             FROM stg_fatura WHERE cari_kod = $1 AND kalan > 0
            ORDER BY vade`,
          [kod],
        ),
        sorgu(
          `SELECT cek_no, vade, tutar, banka, durum, (vade - CURRENT_DATE) AS kalan_gun
             FROM stg_cek WHERE cari_kod = $1 ORDER BY vade`,
          [kod],
        ),
        sorgu(
          `SELECT g.id, g.tip, g.durum, g.sonuc, g.sonuc_notu, g.son_tarih, g.is_gunu,
                  g.eskalasyon_seviyesi, g.gerekce, g.kapanma_ts, k.ad AS sorumlu_ad
             FROM op_gorev g JOIN op_kullanici k ON k.id = g.sorumlu_id
            WHERE g.cari_kod = $1 ORDER BY g.olusma_ts DESC LIMIT 50`,
          [kod],
        ),
        sorgu(
          `SELECT id, soz_tarihi, soz_tutari, gerceklesti, tahsil_tutar
             FROM op_odeme_sozu WHERE cari_kod = $1 ORDER BY soz_tarihi DESC LIMIT 20`,
          [kod],
        ),
        sorgu(
          `SELECT tarih, b_0_30, b_31_60, b_61_90, b_91_180, b_180_plus, toplam
             FROM an_yaslandirma WHERE cari_kod = $1 ORDER BY tarih DESC LIMIT 60`,
          [kod],
        ),
      ]);

      return yanit.send({
        cari,
        faturalar,
        cekler,
        gorevler,
        odemeSozleri: sozler,
        yaslandirmaGecmisi,
      });
    },
  );
}
