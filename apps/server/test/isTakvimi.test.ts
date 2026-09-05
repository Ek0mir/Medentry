import { describe, expect, it } from 'vitest';
import { IsTakvimi } from '../src/core/isTakvimi.js';
import { gunFarki, gunEkle, isoTarih, tarihiCoz } from '../src/core/tarih.js';

// 2026-09-05 Cumartesi, 2026-09-07 Pazartesi.
const takvim = new IsTakvimi(['2026-10-29']); // Cumhuriyet Bayramı, Perşembe

describe('tarih yardımcıları', () => {
  it('gün farkını doğru hesaplar', () => {
    expect(gunFarki('2026-09-01', '2026-09-05')).toBe(4);
    expect(gunFarki('2026-09-05', '2026-09-01')).toBe(-4);
    expect(gunFarki('2026-09-05', '2026-09-05')).toBe(0);
  });

  it('ay ve yıl sınırını aşar', () => {
    expect(gunEkle('2026-12-31', 1)).toBe('2027-01-01');
    expect(gunEkle('2026-03-01', -1)).toBe('2026-02-28');
    expect(gunFarki('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('isoTarih ve tarihiCoz birbirinin tersidir', () => {
    expect(isoTarih(tarihiCoz('2026-09-05'))).toBe('2026-09-05');
  });
});

describe('iş günü takvimi', () => {
  it('hafta sonunu iş günü saymaz', () => {
    expect(takvim.isGunuMu('2026-09-04')).toBe(true); // Cuma
    expect(takvim.isGunuMu('2026-09-05')).toBe(false); // Cumartesi
    expect(takvim.isGunuMu('2026-09-06')).toBe(false); // Pazar
    expect(takvim.isGunuMu('2026-09-07')).toBe(true); // Pazartesi
  });

  it('resmî tatili iş günü saymaz', () => {
    expect(takvim.isGunuMu('2026-10-29')).toBe(false);
    expect(takvim.isGunuMu('2026-10-30')).toBe(true);
  });

  it('ilkIsGunu hafta sonunu pazartesiye taşır', () => {
    expect(takvim.ilkIsGunu('2026-09-05')).toBe('2026-09-07');
    expect(takvim.ilkIsGunu('2026-09-07')).toBe('2026-09-07');
  });

  it('isGunuEkle tatilleri atlar', () => {
    // Cuma + 1 iş günü = Pazartesi
    expect(takvim.isGunuEkle('2026-09-04', 1)).toBe('2026-09-07');
    // Çarşamba + 2 iş günü, araya 29 Ekim tatili giriyor
    expect(takvim.isGunuEkle('2026-10-28', 2)).toBe('2026-10-31' > '2026-10-30' ? '2026-11-02' : '');
  });

  it('isGunuFarki iki gün arasındaki iş günü sayısını verir', () => {
    // Cuma → Pazartesi = 1 iş günü
    expect(takvim.isGunuFarki('2026-09-04', '2026-09-07')).toBe(1);
    // Pazartesi → Cuma = 4 iş günü
    expect(takvim.isGunuFarki('2026-09-07', '2026-09-11')).toBe(4);
  });

  it('isSaatiEkle hafta sonunda durur: cuma 17:00 + 24 iş saati = pazartesi 17:00', () => {
    // Cuma 17:00 + 24 saat → Cumartesi değil, Pazartesi 17:00
    const cuma17 = new Date(2026, 8, 4, 17, 0, 0);
    const sonuc = takvim.isSaatiEkle(cuma17, 24);
    expect(isoTarih(sonuc)).toBe('2026-09-07');
    expect(sonuc.getHours()).toBe(17);
  });

  it('isSaatiEkle iş günü içinde normal saat gibi işler', () => {
    const sali10 = new Date(2026, 8, 8, 10, 0, 0);
    const sonuc = takvim.isSaatiEkle(sali10, 24);
    expect(isoTarih(sonuc)).toBe('2026-09-09');
    expect(sonuc.getHours()).toBe(10);
  });
});

describe('iş saati aritmetiği monotondur', () => {
  it('24 ve 48 iş saati işaretleri hafta sonunda üst üste binmez', () => {
    const cuma17 = new Date(2026, 8, 4, 17, 0, 0);
    const yirmiDort = takvim.isSaatiEkle(cuma17, 24);
    const kirkSekiz = takvim.isSaatiEkle(cuma17, 48);
    expect(isoTarih(yirmiDort)).toBe('2026-09-07'); // Pazartesi
    expect(isoTarih(kirkSekiz)).toBe('2026-09-08'); // Salı
    expect(kirkSekiz.getTime()).toBeGreaterThan(yirmiDort.getTime());
    expect(yirmiDort.getHours()).toBe(17);
    expect(kirkSekiz.getHours()).toBe(17);
  });

  it('artan saat girdisi hep artan zaman verir', () => {
    const baslangic = new Date(2026, 8, 4, 17, 0, 0);
    let onceki = baslangic.getTime();
    for (const saat of [1, 6, 12, 24, 36, 48, 72, 120]) {
      const an = takvim.isSaatiEkle(baslangic, saat).getTime();
      expect(an).toBeGreaterThan(onceki);
      onceki = an;
    }
  });
});
