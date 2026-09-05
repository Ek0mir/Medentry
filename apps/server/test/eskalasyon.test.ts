import { describe, expect, it } from 'vitest';
import { hedefSeviye, seviyeAciklamasi } from '../src/core/eskalasyon.js';
import { IsTakvimi } from '../src/core/isTakvimi.js';
import { kapatmayiDogrula, IZINLI_SONUCLAR } from '../src/core/gorevKurallari.js';

const takvim = new IsTakvimi();
// 2026-09-08 Salı 17:00 — tipik bir arama görevi son tarihi.
const sonTarih = new Date(2026, 8, 8, 17, 0, 0);
const saatSonra = (s: number) => new Date(sonTarih.getTime() + s * 3_600_000);

describe('eskalasyon merdiveni', () => {
  it('süresi dolmadan eskalasyon olmaz', () => {
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(-1) }, takvim)).toBe(0);
    expect(hedefSeviye({ sonTarih, simdi: sonTarih }, takvim)).toBe(0);
  });

  it('süre dolar dolmaz seviye 1', () => {
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(0.1) }, takvim)).toBe(1);
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(23) }, takvim)).toBe(1);
  });

  it('24 saat sonra seviye 2 — yöneticiye çıkar', () => {
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(25) }, takvim)).toBe(2);
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(47) }, takvim)).toBe(2);
  });

  it('48 saat sonra seviye 3 — üst onaya çıkar', () => {
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(49) }, takvim)).toBe(3);
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(500) }, takvim)).toBe(3);
  });

  it('limit üstü cari seviye 2de beklemez, doğrudan 3e çıkar', () => {
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(25), limitUstu: true }, takvim)).toBe(3);
    // Ama süresi henüz 24 saati geçmediyse yine seviye 1.
    expect(hedefSeviye({ sonTarih, simdi: saatSonra(5), limitUstu: true }, takvim)).toBe(1);
  });

  it('hafta sonu merdiveni durdurur — cuma akşamı biten iş pazartesi yükselir', () => {
    const cuma17 = new Date(2026, 8, 4, 17, 0, 0);
    // Cumartesi öğlen: 19 saat geçti, henüz seviye 1.
    expect(hedefSeviye({ sonTarih: cuma17, simdi: new Date(2026, 8, 5, 12, 0) }, takvim)).toBe(1);
    // Pazar akşamı: takvim 24 saati pazartesi 17:00'ye taşıdığı için hâlâ seviye 1.
    expect(hedefSeviye({ sonTarih: cuma17, simdi: new Date(2026, 8, 6, 20, 0) }, takvim)).toBe(1);
    // Pazartesi 18:00: artık seviye 2.
    expect(hedefSeviye({ sonTarih: cuma17, simdi: new Date(2026, 8, 7, 18, 0) }, takvim)).toBe(2);
  });

  it('seviye açıklamaları insan tarafından okunabilir', () => {
    expect(seviyeAciklamasi(2)).toContain('Seviye 2');
    expect(seviyeAciklamasi(0)).toContain('dolmadı');
  });
});

describe('görev kapatma kuralları', () => {
  const BUGUN = '2026-09-08';

  it('sonuçsuz kapatma reddedilir', () => {
    const s = kapatmayiDogrula({ tip: 'ARAMA' }, BUGUN);
    expect(s.gecerli).toBe(false);
    expect(s.hatalar[0]).toContain('Sonuç girmeden');
  });

  it('geçerli sonuçla kapanır', () => {
    expect(kapatmayiDogrula({ tip: 'ARAMA', sonuc: 'ULASILDI' }, BUGUN).gecerli).toBe(true);
  });

  it('görev tipine uymayan sonuç reddedilir', () => {
    const s = kapatmayiDogrula({ tip: 'ARAMA', sonuc: 'TAMAMLANDI' }, BUGUN);
    expect(s.gecerli).toBe(false);
    expect(s.hatalar[0]).toContain('geçerli bir sonuç değil');
  });

  it('ödeme sözü tarih ve tutar ister', () => {
    expect(kapatmayiDogrula({ tip: 'ARAMA', sonuc: 'ODEME_SOZU' }, BUGUN).hatalar).toEqual([
      'Ödeme sözü için söz tarihi zorunludur.',
      'Ödeme sözü için söz tutarı zorunludur.',
    ]);
  });

  it('geçmiş tarihli ödeme sözü kabul edilmez', () => {
    const s = kapatmayiDogrula(
      { tip: 'ARAMA', sonuc: 'ODEME_SOZU', sozTarihi: '2026-09-01', sozTutari: 5000 },
      BUGUN,
    );
    expect(s.gecerli).toBe(false);
    expect(s.hatalar[0]).toContain('geçmiş bir gün olamaz');
  });

  it('sıfır tutarlı ödeme sözü kabul edilmez', () => {
    const s = kapatmayiDogrula(
      { tip: 'ARAMA', sonuc: 'ODEME_SOZU', sozTarihi: '2026-09-20', sozTutari: 0 },
      BUGUN,
    );
    expect(s.gecerli).toBe(false);
  });

  it('geçerli ödeme sözü kabul edilir', () => {
    const s = kapatmayiDogrula(
      { tip: 'ARAMA', sonuc: 'ODEME_SOZU', sozTarihi: '2026-09-20', sozTutari: 25_000 },
      BUGUN,
    );
    expect(s.gecerli).toBe(true);
  });

  it('itiraz sonucunda not zorunludur', () => {
    expect(kapatmayiDogrula({ tip: 'ARAMA', sonuc: 'ITIRAZ' }, BUGUN).gecerli).toBe(false);
    expect(
      kapatmayiDogrula({ tip: 'ARAMA', sonuc: 'ITIRAZ', sonucNotu: 'Fatura tutarına itiraz' }, BUGUN)
        .gecerli,
    ).toBe(true);
  });

  it('her görev tipinin en az bir geçerli sonucu vardır', () => {
    for (const [tip, sonuclar] of Object.entries(IZINLI_SONUCLAR)) {
      expect(sonuclar.length, `${tip} için sonuç tanımlı olmalı`).toBeGreaterThan(0);
    }
  });
});
