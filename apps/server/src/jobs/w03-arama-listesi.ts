import { sorgu, tekSatir } from '../db/havuz.js';
import { ayarOku, sistemLogu, tatilleriOku } from '../db/yardimcilar.js';
import { VARSAYILAN_ONCELIK_AYARLARI, type OncelikAyarlari } from '../core/oncelik.js';
import { IsTakvimi } from '../core/isTakvimi.js';
import { bugun } from '../core/tarih.js';
import { gorevAc, yerelSonTarih } from '../gorev/servis.js';
import type { IsBaglami, IsSonucu, IsTanimi } from './tipler.js';

/**
 * W-03 — Günlük öncelikli arama listesi (her iş günü 08:00).
 *
 * Masterbook Bölüm 06: bu bir RAPOR DEĞİL, görev kuyruğudur. Liste üretilmez,
 * görev açılır; bakılıp geçilemez, kapatılması gerekir.
 *
 * Aynı gün ikinci kez çalışsa mükerrer görev açmaz: kaynak anahtarı
 * ARAMA:<cari>:<gün> üzerindeki UNIQUE kısıt bunu garanti eder.
 */
export const w03: IsTanimi = {
  kod: 'W-03',
  ad: 'Günlük arama listesi',
  zamanlama: '0 8 * * 1-5',
  sadeceIsGunu: true,
  aciklama: 'Risk sıralamasına göre ilk N cari için ARAMA görevi açar ve sorumlusuna atar.',

  async calistir(baglam: IsBaglami = {}): Promise<IsSonucu> {
    const gun = baglam.gun ?? bugun();
    const takvim = new IsTakvimi(await tatilleriOku());
    if (!takvim.isGunuMu(gun) && !baglam.zorla) {
      return { ozet: `${gun} iş günü değil, arama listesi üretilmedi.`, sayilar: { acilan: 0 } };
    }

    const ayar = await ayarOku<OncelikAyarlari>('oncelik.ayarlar', VARSAYILAN_ONCELIK_AYARLARI);
    const sonSaat = await ayarOku<number>('gorev.aramaSonSaati', 17);

    // Varsayılan sorumlu: satış rolü (masterbook Bölüm 05 tablosu).
    // Cari temsilcisi bir kullanıcıya birebir eşleşiyorsa o kişiye atanır.
    const satisci = await tekSatir<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE aktif AND rol = 'SATIS' ORDER BY id LIMIT 1`,
    );
    const yonetici = await tekSatir<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE aktif AND rol = 'YONETICI' ORDER BY id LIMIT 1`,
    );
    const varsayilanSorumlu = satisci?.id ?? yonetici?.id;
    if (!varsayilanSorumlu) {
      throw new Error('Görev atanacak aktif kullanıcı yok. Önce `npm run tohum` çalıştırın.');
    }

    const adaylar = await sorgu<{
      cari_kod: string;
      unvan: string;
      sira: number;
      gerekce: string;
      vadesi_gecen: number;
      temsilci_id: number | null;
    }>(
      `SELECT o.cari_kod, r.unvan, o.sira, o.gerekce, r.vadesi_gecen,
              (SELECT k.id FROM op_kullanici k
                WHERE k.aktif AND k.ad = r.temsilci LIMIT 1) AS temsilci_id
         FROM an_oncelik o
         JOIN rpt_cari_risk r ON r.kod = o.cari_kod
        WHERE o.tarih = $1
        ORDER BY o.sira
        LIMIT $2`,
      [gun, ayar.gunlukAdet],
    );

    if (adaylar.length === 0) {
      await sistemLogu('is.W-03.bos_liste', 'UYARI', { gun });
      return {
        ozet: `${gun} için öncelik listesi boş — W-02 çalıştı mı, açık vadesi geçen bakiye var mı kontrol edin.`,
        sayilar: { aday: 0, acilan: 0 },
      };
    }

    const sonTarih = yerelSonTarih(gun, sonSaat);
    let acilan = 0;
    let mevcut = 0;

    for (const aday of adaylar) {
      const gorev = await gorevAc({
        tip: 'ARAMA',
        cariKod: aday.cari_kod,
        sorumluId: aday.temsilci_id ?? varsayilanSorumlu,
        aciklama: `${aday.unvan} — vadesi geçen ${Math.round(aday.vadesi_gecen).toLocaleString('tr-TR')} ₺ için arama.`,
        sonTarih,
        isGunu: gun,
        oncelikSira: aday.sira,
        gerekce: aday.gerekce,
        kaynak: 'W-03',
        kaynakAnahtar: `ARAMA:${aday.cari_kod}:${gun}`,
      });
      if (gorev) acilan++;
      else mevcut++;
    }

    return {
      ozet: `${acilan} arama görevi açıldı${mevcut > 0 ? `, ${mevcut} tanesi zaten açıktı` : ''} (son tarih ${gun} ${sonSaat}:00).`,
      sayilar: { aday: adaylar.length, acilan, mevcut },
    };
  },
};
