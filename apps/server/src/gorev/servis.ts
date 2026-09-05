import type { PoolClient } from 'pg';
import { islem, sorgu, tekSatir, type Sorgulanabilir } from '../db/havuz.js';
import { ayarOku, olayYaz, tatilleriOku } from '../db/yardimcilar.js';
import { hedefSeviye, SEVIYE_ROLU, VARSAYILAN_ESKALASYON_AYARLARI, type EskalasyonAyarlari, type Seviye } from '../core/eskalasyon.js';
import { kapatmayiDogrula, type GorevTipi } from '../core/gorevKurallari.js';
import { IsTakvimi } from '../core/isTakvimi.js';
import { bugun, gunEkle, type ISOTarih } from '../core/tarih.js';

/**
 * Görev motoru — açma, kapatma, eskalasyon.
 *
 * Hem işler hem API buradan geçer; kural tek yerde durur. Sonuçsuz kapatma
 * burada da, veritabanı CHECK'inde de engellenir (iki kat emniyet).
 */

export interface GorevSatiri {
  id: number;
  tip: GorevTipi;
  cari_kod: string | null;
  sorumlu_id: number;
  aciklama: string;
  son_tarih: Date;
  is_gunu: string;
  durum: 'ACIK' | 'KAPALI' | 'IPTAL';
  sonuc: string | null;
  sonuc_notu: string | null;
  oncelik_sira: number | null;
  gerekce: string | null;
  eskalasyon_seviyesi: number;
  kaynak: string;
  kaynak_anahtar: string | null;
  olusma_ts: Date;
  kapanma_ts: Date | null;
}

export interface GorevAcmaGirdisi {
  tip: GorevTipi;
  cariKod?: string | null;
  sorumluId: number;
  aciklama: string;
  sonTarih: Date;
  isGunu?: ISOTarih;
  oncelikSira?: number | null;
  gerekce?: string | null;
  kaynak?: string;
  /** Doğal anahtar — aynı iş tekrar çalışsa da mükerrer görev açılmaz. */
  kaynakAnahtar?: string | null;
  olusturanId?: number | null;
}

/** Sahipsiz veya son tarihsiz görev açılamaz (masterbook Bölüm 04 değişmez kuralı). */
export async function gorevAc(
  girdi: GorevAcmaGirdisi,
  istemci?: Sorgulanabilir,
): Promise<GorevSatiri | null> {
  const satir = await tekSatir<GorevSatiri>(
    `INSERT INTO op_gorev
       (tip, cari_kod, sorumlu_id, aciklama, son_tarih, is_gunu, oncelik_sira,
        gerekce, kaynak, kaynak_anahtar, olusturan_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (kaynak_anahtar) DO NOTHING
     RETURNING *`,
    [
      girdi.tip,
      girdi.cariKod ?? null,
      girdi.sorumluId,
      girdi.aciklama,
      girdi.sonTarih,
      girdi.isGunu ?? bugun(),
      girdi.oncelikSira ?? null,
      girdi.gerekce ?? null,
      girdi.kaynak ?? 'ELLE',
      girdi.kaynakAnahtar ?? null,
      girdi.olusturanId ?? null,
    ],
    istemci,
  );

  if (!satir) return null; // aynı kaynak anahtarıyla zaten açılmış

  await sorgu(
    `INSERT INTO op_gorev_hareket (gorev_id, kullanici_id, aksiyon, notu, ayrinti)
     VALUES ($1, $2, 'ACILDI', $3, $4::jsonb)`,
    [satir.id, girdi.olusturanId ?? null, girdi.gerekce ?? null, JSON.stringify({ kaynak: girdi.kaynak ?? 'ELLE' })],
    istemci,
  );
  await olayYaz('GOREV_ACILDI', 'GOREV', satir.id, {
    tip: satir.tip,
    cariKod: satir.cari_kod,
    sorumluId: satir.sorumlu_id,
    sonTarih: satir.son_tarih,
  }, istemci);

  return satir;
}

export interface KapatmaGirdisi {
  gorevId: number;
  kullaniciId: number;
  sonuc?: string | null;
  sonucNotu?: string | null;
  sozTarihi?: ISOTarih | null;
  sozTutari?: number | null;
}

export type KapatmaSonucu =
  | { durum: 'kapandi'; gorev: GorevSatiri; takipGoreviId?: number }
  | { durum: 'gecersiz'; hatalar: string[] }
  | { durum: 'bulunamadi' }
  | { durum: 'zaten_kapali' };

/**
 * Görevi kapatır. SONUÇ ZORUNLUDUR — masterbook Bölüm 05'teki kritik tasarım
 * kararı. Ödeme sözü alındıysa söz kaydı açılır ve söz tarihinden sonrası için
 * takip görevi kurulur; böylece söz görünmez olmaz.
 */
export async function gorevKapat(girdi: KapatmaGirdisi): Promise<KapatmaSonucu> {
  return islem(async (istemci) => {
    const gorev = await tekSatir<GorevSatiri>(
      'SELECT * FROM op_gorev WHERE id = $1 FOR UPDATE',
      [girdi.gorevId],
      istemci,
    );
    if (!gorev) return { durum: 'bulunamadi' } as const;
    if (gorev.durum !== 'ACIK') return { durum: 'zaten_kapali' } as const;

    const dogrulama = kapatmayiDogrula(
      {
        tip: gorev.tip,
        sonuc: girdi.sonuc,
        sonucNotu: girdi.sonucNotu,
        sozTarihi: girdi.sozTarihi,
        sozTutari: girdi.sozTutari,
      },
      bugun(),
    );
    if (!dogrulama.gecerli) return { durum: 'gecersiz', hatalar: dogrulama.hatalar } as const;

    const kapatilmis = await tekSatir<GorevSatiri>(
      `UPDATE op_gorev
          SET durum = 'KAPALI', sonuc = $2, sonuc_notu = $3,
              kapanma_ts = now(), kapatan_id = $4
        WHERE id = $1
      RETURNING *`,
      [gorev.id, girdi.sonuc, girdi.sonucNotu ?? null, girdi.kullaniciId],
      istemci,
    );

    await sorgu(
      `INSERT INTO op_gorev_hareket (gorev_id, kullanici_id, aksiyon, notu, ayrinti)
       VALUES ($1, $2, 'KAPATILDI', $3, $4::jsonb)`,
      [
        gorev.id,
        girdi.kullaniciId,
        girdi.sonucNotu ?? null,
        JSON.stringify({ sonuc: girdi.sonuc, sozTarihi: girdi.sozTarihi, sozTutari: girdi.sozTutari }),
      ],
      istemci,
    );

    let takipGoreviId: number | undefined;
    if (girdi.sonuc === 'ODEME_SOZU' && girdi.sozTarihi && girdi.sozTutari) {
      await sorgu(
        `INSERT INTO op_odeme_sozu (cari_kod, gorev_id, soz_tarihi, soz_tutari)
         VALUES ($1, $2, $3, $4)`,
        [gorev.cari_kod, gorev.id, girdi.sozTarihi, girdi.sozTutari],
        istemci,
      );

      // Söz tarihinin ertesi günü takip görevi. Bunu ayrı bir işe bırakmıyoruz:
      // söz verildiği anda takibi de kurulmalı, arada görünmez kalmamalı.
      const takipGunu = gunEkle(girdi.sozTarihi, 1);
      const takip = await gorevAc(
        {
          tip: 'ODEME_SOZU',
          cariKod: gorev.cari_kod,
          sorumluId: gorev.sorumlu_id,
          aciklama: `Ödeme sözü takibi — ${girdi.sozTarihi} tarihinde ${girdi.sozTutari} ₺ sözü verildi.`,
          sonTarih: yerelSonTarih(takipGunu, 17),
          isGunu: takipGunu,
          kaynak: 'GOREV_KAPATMA',
          kaynakAnahtar: `ODEME_SOZU:${gorev.id}`,
          olusturanId: girdi.kullaniciId,
        },
        istemci,
      );
      takipGoreviId = takip?.id;
    }

    await olayYaz('GOREV_KAPANDI', 'GOREV', gorev.id, {
      tip: gorev.tip,
      cariKod: gorev.cari_kod,
      sonuc: girdi.sonuc,
      kapatanId: girdi.kullaniciId,
      takipGoreviId,
    }, istemci);

    return { durum: 'kapandi', gorev: kapatilmis!, takipGoreviId } as const;
  });
}

/** Verilen günün belirli saatinde son tarih üretir (yerel saat). */
export function yerelSonTarih(gun: ISOTarih, saat: number): Date {
  const [y, a, g] = gun.split('-').map(Number);
  return new Date(y!, a! - 1, g!, saat, 0, 0, 0);
}

// --- eskalasyon -------------------------------------------------------------

export interface EskalasyonHedefi {
  yoneticiId: number | null;
  ustOnayId: number | null;
}

export async function eskalasyonHedefleri(istemci?: Sorgulanabilir): Promise<EskalasyonHedefi> {
  const satirlar = await sorgu<{ id: number; rol: string }>(
    `SELECT id, rol FROM op_kullanici WHERE aktif AND rol IN ('YONETICI','UST_ONAY') ORDER BY id`,
    [],
    istemci,
  );
  return {
    yoneticiId: satirlar.find((s) => s.rol === 'YONETICI')?.id ?? null,
    ustOnayId: satirlar.find((s) => s.rol === 'UST_ONAY')?.id ?? null,
  };
}

export interface EskalasyonRaporu {
  incelenen: number;
  yukseltilen: number;
  seviyeler: Record<string, number>;
}

/**
 * Süresi geçmiş açık görevleri tarar ve merdivende bulundukları basamağın
 * üstüne çıkanları yükseltir. Aynı seviyeye iki kez çıkılmaz (op_eskalasyon
 * üzerindeki UNIQUE kısıt bunu garanti eder).
 *
 * `tipler` verilirse yalnızca o görev tipleri taranır (W-05 sadece ARAMA'ya bakar).
 */
export async function eskalasyonTara(tipler?: readonly GorevTipi[]): Promise<EskalasyonRaporu> {
  const ayar = await ayarOku<EskalasyonAyarlari>('eskalasyon.ayarlar', VARSAYILAN_ESKALASYON_AYARLARI);
  const takvim = new IsTakvimi(await tatilleriOku());
  const hedefler = await eskalasyonHedefleri();
  const simdi = new Date();

  const kosul = tipler && tipler.length > 0 ? 'AND g.tip = ANY($1)' : '';
  const gorevler = await sorgu<{
    id: number;
    tip: GorevTipi;
    cari_kod: string | null;
    sorumlu_id: number;
    son_tarih: Date;
    eskalasyon_seviyesi: number;
    limit_ustu: boolean;
  }>(
    `SELECT g.id, g.tip, g.cari_kod, g.sorumlu_id, g.son_tarih, g.eskalasyon_seviyesi,
            COALESCE(r.toplam_bakiye > r.risk_limiti AND r.risk_limiti > 0, false) AS limit_ustu
       FROM op_gorev g
       LEFT JOIN rpt_cari_risk r ON r.kod = g.cari_kod
      WHERE g.durum = 'ACIK' AND g.son_tarih < now() ${kosul}`,
    tipler && tipler.length > 0 ? [tipler] : [],
  );

  const seviyeler: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
  let yukseltilen = 0;

  for (const gorev of gorevler) {
    const hedef = hedefSeviye(
      { sonTarih: new Date(gorev.son_tarih), simdi, limitUstu: gorev.limit_ustu },
      takvim,
      ayar,
    );
    if (hedef <= gorev.eskalasyon_seviyesi) continue;

    // Atlanan basamaklar da kayda geçer: "hangi iş nereye, ne zaman, neden çıktı"
    // sorusunun cevabı eksiksiz olmalı.
    for (let seviye = gorev.eskalasyon_seviyesi + 1; seviye <= hedef; seviye++) {
      await eskalasyonYaz(gorev, seviye as Exclude<Seviye, 0>, hedefler);
      seviyeler[String(seviye)] = (seviyeler[String(seviye)] ?? 0) + 1;
    }

    await sorgu('UPDATE op_gorev SET eskalasyon_seviyesi = $2 WHERE id = $1', [gorev.id, hedef]);
    yukseltilen++;
  }

  return { incelenen: gorevler.length, yukseltilen, seviyeler };
}

async function eskalasyonYaz(
  gorev: { id: number; tip: string; cari_kod: string | null; sorumlu_id: number },
  seviye: Exclude<Seviye, 0>,
  hedefler: EskalasyonHedefi,
): Promise<void> {
  const rol = SEVIYE_ROLU[seviye];
  const hedefId =
    rol === 'SORUMLU' ? gorev.sorumlu_id : rol === 'YONETICI' ? hedefler.yoneticiId : hedefler.ustOnayId;

  const gerekce =
    seviye === 1
      ? 'Görev süresi doldu, sorumluya hatırlatıldı.'
      : seviye === 2
        ? 'Görev 24 iş saati içinde kapatılmadı, yöneticiye bildirildi.'
        : 'Görev 48 iş saati içinde kapatılmadı (veya cari limit üstü), üst onaya bildirildi.';

  await sorgu(
    `INSERT INTO op_eskalasyon (kaynak_tip, kaynak_id, seviye, hedef_id, gerekce)
     VALUES ('GOREV', $1, $2, $3, $4)
     ON CONFLICT (kaynak_tip, kaynak_id, seviye) DO NOTHING`,
    [gorev.id, seviye, hedefId, gerekce],
  );
  await sorgu(
    `INSERT INTO op_gorev_hareket (gorev_id, aksiyon, notu, ayrinti)
     VALUES ($1, 'ESKALASYON', $2, $3::jsonb)`,
    [gorev.id, gerekce, JSON.stringify({ seviye, hedefId, rol })],
  );
  await olayYaz('ESKALASYON', 'GOREV', gorev.id, {
    seviye,
    rol,
    hedefId,
    tip: gorev.tip,
    cariKod: gorev.cari_kod,
    gerekce,
  });
}

export type { PoolClient };
