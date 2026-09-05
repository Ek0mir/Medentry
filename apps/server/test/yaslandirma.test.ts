import { describe, expect, it } from 'vitest';
import {
  bantAnahtari,
  vadesiGecen,
  yaslandirmaHesapla,
  type AcikFatura,
} from '../src/core/yaslandirma.js';

describe('bant sınırları', () => {
  it('vadesi gelmemiş fatura hiçbir banda girmez', () => {
    expect(bantAnahtari(-1)).toBeNull();
    expect(bantAnahtari(-90)).toBeNull();
  });

  it('sınır günleri doğru banda düşer', () => {
    expect(bantAnahtari(0)).toBe('b_0_30');
    expect(bantAnahtari(30)).toBe('b_0_30');
    expect(bantAnahtari(31)).toBe('b_31_60');
    expect(bantAnahtari(60)).toBe('b_31_60');
    expect(bantAnahtari(61)).toBe('b_61_90');
    expect(bantAnahtari(90)).toBe('b_61_90');
    expect(bantAnahtari(91)).toBe('b_91_180');
    expect(bantAnahtari(180)).toBe('b_91_180');
    expect(bantAnahtari(181)).toBe('b_180_plus');
    expect(bantAnahtari(2000)).toBe('b_180_plus');
  });
});

describe('yaşlandırma hesabı', () => {
  const referans = '2026-09-05';

  it('faturaları bantlara dağıtır ve en eski gecikmeyi bulur', () => {
    const faturalar: AcikFatura[] = [
      { faturaNo: 'A1', vade: '2026-09-20', kalan: 1000 }, // vadesi gelmemiş
      { faturaNo: 'A2', vade: '2026-08-20', kalan: 2000 }, // 16 gün
      { faturaNo: 'A3', vade: '2026-07-20', kalan: 3000 }, // 47 gün
      { faturaNo: 'A4', vade: '2026-06-20', kalan: 4000 }, // 77 gün
      { faturaNo: 'A5', vade: '2026-03-20', kalan: 5000 }, // 169 gün
      { faturaNo: 'A6', vade: '2025-09-20', kalan: 6000 }, // 350 gün
    ];
    const y = yaslandirmaHesapla(faturalar, referans);

    expect(y.vadesiGelmemis).toBe(1000);
    expect(y.b_0_30).toBe(2000);
    expect(y.b_31_60).toBe(3000);
    expect(y.b_61_90).toBe(4000);
    expect(y.b_91_180).toBe(5000);
    expect(y.b_180_plus).toBe(6000);
    expect(y.toplam).toBe(21000);
    expect(y.enEskiGun).toBe(350);
    expect(vadesiGecen(y)).toBe(20000);
  });

  it('kalanı sıfır olan faturayı saymaz', () => {
    const y = yaslandirmaHesapla(
      [
        { faturaNo: 'B1', vade: '2026-01-01', kalan: 0 },
        { faturaNo: 'B2', vade: '2026-01-01', kalan: -50 },
      ],
      referans,
    );
    expect(y.toplam).toBe(0);
    expect(y.enEskiGun).toBe(0);
  });

  it('vadesi bugün olan fatura 0–30 bandındadır, gecikme 0 gündür', () => {
    const y = yaslandirmaHesapla([{ faturaNo: 'C1', vade: referans, kalan: 500 }], referans);
    expect(y.b_0_30).toBe(500);
    expect(y.enEskiGun).toBe(0);
    expect(y.vadesiGelmemis).toBe(0);
  });

  it('hiç fatura yoksa her şey sıfırdır', () => {
    const y = yaslandirmaHesapla([], referans);
    expect(y.toplam).toBe(0);
    expect(vadesiGecen(y)).toBe(0);
  });
});
