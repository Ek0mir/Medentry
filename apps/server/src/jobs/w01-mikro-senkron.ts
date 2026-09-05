import { islem, sorgu, tekSatir } from '../db/havuz.js';
import { sistemLogu, topluEkle } from '../db/yardimcilar.js';
import { mikroAdapterOlustur } from '../mikro/index.js';
import type { IsSonucu, IsTanimi } from './tipler.js';

/**
 * W-01 — Mikro senkron (her gün 02:00).
 *
 * stg_* tabloları BÜTÜNÜYLE yeniden yazılır: tek doğruluk kaynağı Mikro'dur,
 * bizim tarafta artık kayıt birikmez. Tamamı tek işlemde yapılır — senkron
 * yarıda kalırsa eski veri olduğu gibi kalır, yarım veriyle rapor üretilmez.
 */
export const w01: IsTanimi = {
  kod: 'W-01',
  ad: 'Mikro senkron',
  zamanlama: '0 2 * * *',
  aciklama: 'Mikro’dan cari, fatura, tahsilat, çek ve geçmiş verisini stg_* tablolarına yazar.',

  async calistir(): Promise<IsSonucu> {
    const adapter = mikroAdapterOlustur();
    const kayit = await tekSatir<{ calisma_id: number }>(
      `INSERT INTO stg_senkron_log (kaynak, durum) VALUES ($1, 'CALISIYOR') RETURNING calisma_id`,
      [adapter.ad],
    );
    if (!kayit) throw new Error('Senkron log kaydı oluşturulamadı.');
    const calismaId = kayit.calisma_id;

    try {
      const saglik = await adapter.saglikKontrolu();
      if (!saglik.saglikli) throw new Error(`Mikro kaynağına erişilemedi: ${saglik.mesaj}`);

      const [cariler, faturalar, tahsilatlar, cekler, odemeGecmisi, karsiliksizlar, cirolar] =
        await Promise.all([
          adapter.cariler(),
          adapter.acikFaturalar(),
          adapter.tahsilatlar(730),
          adapter.cekler(),
          adapter.odemeGecmisi(),
          adapter.karsiliksizlar(),
          adapter.cirolar(),
        ]);

      // Cari kodu olmayan alt kayıtlar yabancı anahtar gibi davranan
      // raporları bozar; senkronda süzülür ve sayısı loglanır.
      const gecerliKodlar = new Set(cariler.map((c) => c.kod));
      const suz = <S extends { cariKod: string }>(kayitlar: S[]) =>
        kayitlar.filter((k) => gecerliKodlar.has(k.cariKod));

      const suzulmusFaturalar = suz(faturalar);
      const suzulmusTahsilatlar = suz(tahsilatlar);
      const suzulmusCekler = suz(cekler);
      const oksuz =
        faturalar.length - suzulmusFaturalar.length +
        (tahsilatlar.length - suzulmusTahsilatlar.length) +
        (cekler.length - suzulmusCekler.length);

      const sayilar = await islem(async (istemci) => {
        await istemci.query(
          `TRUNCATE stg_cari, stg_fatura, stg_tahsilat, stg_cek,
                    stg_odeme_gecmisi, stg_karsiliksiz, stg_ciro`,
        );

        const cariAdedi = await topluEkle(
          istemci,
          'stg_cari',
          ['kod', 'unvan', 'telefon', 'eposta', 'temsilci', 'risk_limiti', 'vade_gun', 'il', 'aktif'],
          cariler.map((c) => [c.kod, c.unvan, c.telefon, c.eposta, c.temsilci, c.riskLimiti, c.vadeGun, c.il, c.aktif]),
          'ON CONFLICT (kod) DO NOTHING',
        );

        const faturaAdedi = await topluEkle(
          istemci,
          'stg_fatura',
          ['fatura_no', 'cari_kod', 'tarih', 'vade', 'tutar', 'kalan', 'para_birimi', 'tip'],
          suzulmusFaturalar.map((f) => [f.faturaNo, f.cariKod, f.tarih, f.vade, f.tutar, f.kalan, f.paraBirimi, f.tip]),
          'ON CONFLICT (fatura_no) DO NOTHING',
        );

        const tahsilatAdedi = await topluEkle(
          istemci,
          'stg_tahsilat',
          ['kaynak_no', 'cari_kod', 'tarih', 'tutar', 'tip'],
          suzulmusTahsilatlar.map((t) => [t.kaynakNo, t.cariKod, t.tarih, t.tutar, t.tip]),
        );

        const cekAdedi = await topluEkle(
          istemci,
          'stg_cek',
          ['cek_no', 'cari_kod', 'vade', 'tutar', 'kesideci', 'banka', 'durum'],
          suzulmusCekler.map((c) => [c.cekNo, c.cariKod, c.vade, c.tutar, c.kesideci, c.banka, c.durum]),
          'ON CONFLICT (cek_no) DO NOTHING',
        );

        const gecmisAdedi = await topluEkle(
          istemci,
          'stg_odeme_gecmisi',
          ['cari_kod', 'ortalama_gecikme_gun', 'odenen_fatura_adedi', 'gecikmeli_adet', 'pencere_ay'],
          suz(odemeGecmisi).map((o) => [o.cariKod, o.ortalamaGecikmeGun, o.odenenFaturaAdedi, o.gecikmeliAdet, o.pencereAy]),
          'ON CONFLICT (cari_kod) DO NOTHING',
        );

        const karsiliksizAdedi = await topluEkle(
          istemci,
          'stg_karsiliksiz',
          ['cari_kod', 'adet', 'tutar', 'son_tarih'],
          suz(karsiliksizlar).map((k) => [k.cariKod, k.adet, k.tutar, k.sonTarih]),
          'ON CONFLICT (cari_kod) DO NOTHING',
        );

        const ciroAdedi = await topluEkle(
          istemci,
          'stg_ciro',
          ['cari_kod', 'son_90_gun', 'onceki_90_gun'],
          suz(cirolar).map((c) => [c.cariKod, c.son90Gun, c.onceki90Gun]),
          'ON CONFLICT (cari_kod) DO NOTHING',
        );

        return {
          cari: cariAdedi,
          fatura: faturaAdedi,
          tahsilat: tahsilatAdedi,
          cek: cekAdedi,
          odemeGecmisi: gecmisAdedi,
          karsiliksiz: karsiliksizAdedi,
          ciro: ciroAdedi,
          oksuzKayit: oksuz,
        };
      });

      const toplam = sayilar.cari + sayilar.fatura + sayilar.tahsilat + sayilar.cek;
      await sorgu(
        `UPDATE stg_senkron_log
            SET bitis = now(), durum = 'BASARILI', kayit_sayisi = $2, ayrinti = $3::jsonb
          WHERE calisma_id = $1`,
        [calismaId, toplam, JSON.stringify(sayilar)],
      );

      if (oksuz > 0) {
        await sistemLogu('senkron.oksuz_kayit', 'UYARI', { adet: oksuz, kaynak: adapter.ad });
      }

      return {
        ozet: `${sayilar.cari} cari, ${sayilar.fatura} açık fatura, ${sayilar.cek} çek senkronlandı (${adapter.ad}).`,
        sayilar,
      };
    } catch (hata) {
      await sorgu(
        `UPDATE stg_senkron_log SET bitis = now(), durum = 'HATA', hata = $2 WHERE calisma_id = $1`,
        [calismaId, (hata as Error).message],
      );
      await sistemLogu('senkron.hata', 'HATA', { mesaj: (hata as Error).message });
      throw hata;
    } finally {
      await adapter.kapat?.();
    }
  },
};
