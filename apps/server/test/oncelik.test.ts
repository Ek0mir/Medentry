import { describe, expect, it } from 'vitest';
import { adayMi, oncelikListesi, gerekceUret, type OncelikAdayi } from '../src/core/oncelik.js';

const BUGUN = '2026-09-07';

function aday(ustune: Partial<OncelikAdayi> = {}): OncelikAdayi {
  return {
    cariKod: 'C001',
    unvan: 'Örnek Yapı Ltd. Şti.',
    skor: 40,
    kademe: 4,
    kademeAd: 'Belirgin gecikme',
    vadesiGecen: 50_000,
    b_0_30: 0,
    b_31_60: 0,
    b_61_90: 50_000,
    b_91_180: 0,
    b_180_plus: 0,
    enEskiGun: 75,
    riskLimiti: 100_000,
    toplamBakiye: 50_000,
    acikAramaVar: false,
    bekleyenSozTarihi: null,
    tutulmayanSozAdedi: 0,
    sonAramaGunu: null,
    ...ustune,
  };
}

describe('aday eleme', () => {
  it('vadesi geçen borcu olmayan aranmaz', () => {
    expect(adayMi(aday({ vadesiGecen: 0 }), BUGUN)).toBe(false);
  });

  it('zaten açık arama görevi olan iki kez kuyruğa girmez', () => {
    expect(adayMi(aday({ acikAramaVar: true }), BUGUN)).toBe(false);
  });

  it('ileri tarihli ödeme sözü olan cari o güne kadar aranmaz', () => {
    expect(adayMi(aday({ bekleyenSozTarihi: '2026-09-20' }), BUGUN)).toBe(false);
  });

  it('söz tarihi geldiyse yeniden aday olur', () => {
    expect(adayMi(aday({ bekleyenSozTarihi: BUGUN }), BUGUN)).toBe(true);
    expect(adayMi(aday({ bekleyenSozTarihi: '2026-09-01' }), BUGUN)).toBe(true);
  });
});

describe('sıralama', () => {
  it('yüksek riskli ve büyük tutarlı cari başa gelir', () => {
    const liste = oncelikListesi(
      [
        aday({ cariKod: 'DUSUK', skor: 12, vadesiGecen: 5_000 }),
        aday({ cariKod: 'YUKSEK', skor: 78, vadesiGecen: 400_000 }),
        aday({ cariKod: 'ORTA', skor: 45, vadesiGecen: 60_000 }),
      ],
      BUGUN,
    );
    expect(liste.map((s) => s.cariKod)).toEqual(['YUKSEK', 'ORTA', 'DUSUK']);
    expect(liste[0]!.sira).toBe(1);
  });

  it('aynı skorda büyük tutarlı önce gelir', () => {
    const liste = oncelikListesi(
      [
        aday({ cariKod: 'KUCUK', vadesiGecen: 5_000 }),
        aday({ cariKod: 'BUYUK', vadesiGecen: 500_000 }),
      ],
      BUGUN,
    );
    expect(liste[0]!.cariKod).toBe('BUYUK');
  });

  it('tutulmayan söz cezası sıralamayı öne taşır', () => {
    const [ilk] = oncelikListesi(
      [
        aday({ cariKod: 'SOZUNU_TUTMAYAN', tutulmayanSozAdedi: 2 }),
        aday({ cariKod: 'TEMIZ', tutulmayanSozAdedi: 0 }),
      ],
      BUGUN,
    );
    expect(ilk!.cariKod).toBe('SOZUNU_TUTMAYAN');
  });

  it('elenen cariler listede yer almaz ve sıra numaraları kesintisizdir', () => {
    const liste = oncelikListesi(
      [
        aday({ cariKod: 'A' }),
        aday({ cariKod: 'B', acikAramaVar: true }),
        aday({ cariKod: 'C' }),
      ],
      BUGUN,
    );
    expect(liste).toHaveLength(2);
    expect(liste.map((s) => s.sira)).toEqual([1, 2]);
  });

  it('sıralama deterministiktir — aynı girdi aynı çıktıyı verir', () => {
    const girdi = [aday({ cariKod: 'X' }), aday({ cariKod: 'Y' }), aday({ cariKod: 'Z' })];
    expect(oncelikListesi(girdi, BUGUN)).toEqual(oncelikListesi([...girdi].reverse(), BUGUN));
  });
});

describe('gerekçe metni', () => {
  it('en ağır bandı, kademeyi ve limit aşımını yazar', () => {
    const g = gerekceUret(
      aday({ b_91_180: 145_000, b_61_90: 20_000, toplamBakiye: 130_000, riskLimiti: 100_000 }),
      BUGUN,
    );
    expect(g).toContain('91–180 gün');
    expect(g).toContain('risk kademesi 4');
    expect(g).toContain('limit %130');
  });

  it('hiç aranmamış cariyi işaretler', () => {
    expect(gerekceUret(aday({ sonAramaGunu: null }), BUGUN)).toContain('hiç aranmamış');
  });

  it('uzun süredir aranmamışsa gün sayısını yazar', () => {
    expect(gerekceUret(aday({ sonAramaGunu: '2026-08-01' }), BUGUN)).toContain('gündür aranmamış');
  });

  it('tutulmayan sözü gerekçeye ekler', () => {
    expect(gerekceUret(aday({ tutulmayanSozAdedi: 1 }), BUGUN)).toContain('ödeme sözü tutulmadı');
  });
});
