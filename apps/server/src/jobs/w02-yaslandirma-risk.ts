import { islem, sorgu } from '../db/havuz.js';
import { ayarOku, olayYaz, topluEkle } from '../db/yardimcilar.js';
import { oncelikListesi, type OncelikAdayi, VARSAYILAN_ONCELIK_AYARLARI } from '../core/oncelik.js';
import { riskSkoruHesapla, VARSAYILAN_RISK_AYARLARI, type RiskAyarlari } from '../core/riskSkor.js';
import { bugun, type ISOTarih } from '../core/tarih.js';
import { vadesiGecen, yaslandirmaHesapla, type AcikFatura } from '../core/yaslandirma.js';
import type { IsBaglami, IsSonucu, IsTanimi } from './tipler.js';

interface CariSatiri {
  kod: string;
  unvan: string;
  risk_limiti: number;
  ortalama_gecikme_gun: number;
  karsiliksiz_adet: number;
  karsiliksiz_tutar: number;
  ciro_son_90: number;
  ciro_onceki_90: number;
  acik_arama_var: boolean;
  bekleyen_soz_tarihi: string | null;
  tutulmayan_soz_adedi: number;
  son_arama_gunu: string | null;
}

/**
 * W-02 — Yaşlandırma + risk skorlama (her gün 02:30).
 *
 * stg_* ham verisinden an_yaslandirma, an_risk_skor ve an_oncelik üretilir.
 * Aynı gün için yeniden çalıştırılabilir: o günün satırları silinip yeniden
 * yazılır, mükerrer kayıt oluşmaz.
 */
export const w02: IsTanimi = {
  kod: 'W-02',
  ad: 'Yaşlandırma ve risk skorlama',
  zamanlama: '30 2 * * *',
  aciklama: 'Açık faturaları bantlara ayırır, 5 bileşenli risk skorunu ve günlük öncelik sırasını üretir.',

  async calistir(baglam: IsBaglami = {}): Promise<IsSonucu> {
    const gun = baglam.gun ?? bugun();
    const riskAyarlari = await ayarOku<RiskAyarlari>('risk.ayarlar', VARSAYILAN_RISK_AYARLARI);
    const oncelikAyarlari = await ayarOku('oncelik.ayarlar', VARSAYILAN_ONCELIK_AYARLARI);

    const cariler = await sorgu<CariSatiri>(`
      SELECT c.kod, c.unvan, c.risk_limiti,
             COALESCE(og.ortalama_gecikme_gun, 0)         AS ortalama_gecikme_gun,
             COALESCE(kz.adet, 0)                          AS karsiliksiz_adet,
             COALESCE(kz.tutar, 0)                         AS karsiliksiz_tutar,
             COALESCE(ci.son_90_gun, 0)                    AS ciro_son_90,
             COALESCE(ci.onceki_90_gun, 0)                 AS ciro_onceki_90,
             EXISTS (SELECT 1 FROM op_gorev g
                      WHERE g.cari_kod = c.kod AND g.tip = 'ARAMA' AND g.durum = 'ACIK')
                                                           AS acik_arama_var,
             (SELECT min(os.soz_tarihi) FROM op_odeme_sozu os
               WHERE os.cari_kod = c.kod AND os.gerceklesti IS NULL
                 AND os.soz_tarihi >= CURRENT_DATE)        AS bekleyen_soz_tarihi,
             (SELECT count(*) FROM op_odeme_sozu os
               WHERE os.cari_kod = c.kod AND os.gerceklesti = false)::int
                                                           AS tutulmayan_soz_adedi,
             (SELECT max(g.is_gunu) FROM op_gorev g
               WHERE g.cari_kod = c.kod AND g.tip = 'ARAMA' AND g.durum = 'KAPALI')
                                                           AS son_arama_gunu
        FROM stg_cari c
        LEFT JOIN stg_odeme_gecmisi og ON og.cari_kod = c.kod
        LEFT JOIN stg_karsiliksiz    kz ON kz.cari_kod = c.kod
        LEFT JOIN stg_ciro           ci ON ci.cari_kod = c.kod
       WHERE c.aktif
    `);

    const faturalar = await sorgu<{ cari_kod: string; fatura_no: string; vade: string; kalan: number }>(
      'SELECT cari_kod, fatura_no, vade, kalan FROM stg_fatura WHERE kalan > 0',
    );

    const cariFaturalari = new Map<string, AcikFatura[]>();
    for (const f of faturalar) {
      const liste = cariFaturalari.get(f.cari_kod) ?? [];
      liste.push({ faturaNo: f.fatura_no, vade: f.vade, kalan: f.kalan });
      cariFaturalari.set(f.cari_kod, liste);
    }

    const yaslandirmaSatirlari: unknown[][] = [];
    const riskSatirlari: unknown[][] = [];
    const adaylar: OncelikAdayi[] = [];

    for (const cari of cariler) {
      const y = yaslandirmaHesapla(cariFaturalari.get(cari.kod) ?? [], gun);
      const gecen = vadesiGecen(y);

      const risk = riskSkoruHesapla(
        {
          enEskiGun: y.enEskiGun,
          toplamBakiye: y.toplam,
          riskLimiti: cari.risk_limiti,
          ortalamaGecikmeGun: cari.ortalama_gecikme_gun,
          karsiliksizAdet: cari.karsiliksiz_adet,
          karsiliksizTutar: cari.karsiliksiz_tutar,
          ciroSon90: cari.ciro_son_90,
          ciroOnceki90: cari.ciro_onceki_90,
        },
        riskAyarlari,
      );

      yaslandirmaSatirlari.push([
        cari.kod, gun, y.b_0_30, y.b_31_60, y.b_61_90, y.b_91_180, y.b_180_plus,
        y.vadesiGelmemis, y.toplam, y.enEskiGun,
      ]);
      riskSatirlari.push([
        cari.kod, gun, risk.skor, risk.kademe, risk.kademeAd, JSON.stringify(risk.bilesenler),
      ]);

      adaylar.push({
        cariKod: cari.kod,
        unvan: cari.unvan,
        skor: risk.skor,
        kademe: risk.kademe,
        kademeAd: risk.kademeAd,
        vadesiGecen: gecen,
        b_0_30: y.b_0_30,
        b_31_60: y.b_31_60,
        b_61_90: y.b_61_90,
        b_91_180: y.b_91_180,
        b_180_plus: y.b_180_plus,
        enEskiGun: y.enEskiGun,
        riskLimiti: cari.risk_limiti,
        toplamBakiye: y.toplam,
        acikAramaVar: cari.acik_arama_var,
        bekleyenSozTarihi: cari.bekleyen_soz_tarihi as ISOTarih | null,
        tutulmayanSozAdedi: cari.tutulmayan_soz_adedi,
        sonAramaGunu: cari.son_arama_gunu as ISOTarih | null,
      });
    }

    const oncelikler = oncelikListesi(adaylar, gun, oncelikAyarlari);

    await islem(async (istemci) => {
      await istemci.query('DELETE FROM an_yaslandirma WHERE tarih = $1', [gun]);
      await istemci.query('DELETE FROM an_risk_skor  WHERE tarih = $1', [gun]);
      await istemci.query('DELETE FROM an_oncelik    WHERE tarih = $1', [gun]);

      await topluEkle(
        istemci,
        'an_yaslandirma',
        ['cari_kod', 'tarih', 'b_0_30', 'b_31_60', 'b_61_90', 'b_91_180', 'b_180_plus', 'vadesi_gelmemis', 'toplam', 'en_eski_gun'],
        yaslandirmaSatirlari,
      );
      await topluEkle(
        istemci,
        'an_risk_skor',
        ['cari_kod', 'tarih', 'skor', 'kademe', 'kademe_ad', 'bilesenler_json'],
        riskSatirlari,
      );
      await topluEkle(
        istemci,
        'an_oncelik',
        ['cari_kod', 'tarih', 'sira', 'gerekce'],
        oncelikler.map((o) => [o.cariKod, gun, o.sira, o.gerekce]),
      );
    });

    // Bant geçişleri: dün 61 günün altındayken bugün üstüne çıkanlar.
    // Otomasyon (WhatsApp/n8n) bu olaya abone olur.
    const gecisler = await sorgu<{ cari_kod: string; onceki: number; simdiki: number }>(
      `SELECT b.cari_kod, a.en_eski_gun AS onceki, b.en_eski_gun AS simdiki
         FROM an_yaslandirma b
         JOIN an_yaslandirma a
           ON a.cari_kod = b.cari_kod
          AND a.tarih = (SELECT max(tarih) FROM an_yaslandirma WHERE tarih < $1)
        WHERE b.tarih = $1
          AND ((a.en_eski_gun < 61 AND b.en_eski_gun >= 61)
            OR (a.en_eski_gun < 91 AND b.en_eski_gun >= 91)
            OR (a.en_eski_gun < 181 AND b.en_eski_gun >= 181))`,
      [gun],
    );
    for (const g of gecisler) {
      await olayYaz('BANT_GECISI', 'CARI', g.cari_kod, {
        oncekiGun: g.onceki,
        simdikiGun: g.simdiki,
        tarih: gun,
      });
    }

    return {
      ozet: `${cariler.length} cari için yaşlandırma ve risk skoru hesaplandı; ${oncelikler.length} cari arama listesinde, ${gecisler.length} bant geçişi.`,
      sayilar: {
        cari: cariler.length,
        acikFatura: faturalar.length,
        oncelikAdayi: oncelikler.length,
        bantGecisi: gecisler.length,
      },
    };
  },
};
