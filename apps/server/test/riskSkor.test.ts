import { describe, expect, it } from 'vitest';
import {
  kademeBul,
  riskSkoruHesapla,
  VARSAYILAN_RISK_AYARLARI,
  type RiskGirdisi,
} from '../src/core/riskSkor.js';

const temiz: RiskGirdisi = {
  enEskiGun: 0,
  toplamBakiye: 0,
  riskLimiti: 100_000,
  ortalamaGecikmeGun: 0,
  karsiliksizAdet: 0,
  karsiliksizTutar: 0,
  ciroSon90: 500_000,
  ciroOnceki90: 480_000,
};

describe('risk skoru', () => {
  it('sorunsuz cari sıfıra yakın skor alır ve 1. kademededir', () => {
    const s = riskSkoruHesapla(temiz);
    expect(s.skor).toBeLessThan(5);
    expect(s.kademe).toBe(1);
    expect(s.kademeAd).toBe('Sorunsuz');
  });

  it('en kötü senaryo 100 puana yaklaşır ve 8. kademeye düşer', () => {
    const s = riskSkoruHesapla({
      enEskiGun: 400,
      toplamBakiye: 300_000,
      riskLimiti: 100_000,
      ortalamaGecikmeGun: 120,
      karsiliksizAdet: 5,
      karsiliksizTutar: 200_000,
      ciroSon90: 0,
      ciroOnceki90: 400_000,
    });
    expect(s.skor).toBeGreaterThan(95);
    expect(s.kademe).toBe(8);
    expect(s.kademeAd).toBe('Hukuki değerlendirme');
  });

  it('ağırlıklar masterbook Bölüm 06 ile birebir aynıdır', () => {
    const s = riskSkoruHesapla(temiz);
    const agirliklar = Object.fromEntries(s.bilesenler.map((b) => [b.anahtar, b.agirlik]));
    expect(agirliklar).toEqual({
      vadeAsim: 40,
      limitAsim: 25,
      odemeGecmisi: 15,
      karsiliksiz: 10,
      ciroTrend: 10,
    });
    expect(Object.values(agirliklar).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('her bileşen skora katkısını ve gerekçesini taşır', () => {
    const s = riskSkoruHesapla({ ...temiz, enEskiGun: 95, toplamBakiye: 90_000 });
    const vade = s.bilesenler.find((b) => b.anahtar === 'vadeAsim')!;
    expect(vade.hamDeger).toBe(95);
    expect(vade.katki).toBeGreaterThan(0);
    expect(vade.aciklama).toContain('95 gün');
    // Katkıların toplamı skora eşit olmalı (yuvarlama toleransıyla).
    const toplam = s.bilesenler.reduce((t, b) => t + b.katki, 0);
    expect(Math.abs(toplam - s.skor)).toBeLessThan(0.1);
  });

  it('skor vade aşımıyla monoton artar', () => {
    const gunler = [0, 15, 30, 60, 90, 180, 365];
    const skorlar = gunler.map((g) => riskSkoruHesapla({ ...temiz, enEskiGun: g }).skor);
    for (let i = 1; i < skorlar.length; i++) {
      expect(skorlar[i]!).toBeGreaterThanOrEqual(skorlar[i - 1]!);
    }
  });

  it('limit tanımsız ama bakiye varsa risk sayılır', () => {
    const limitsiz = riskSkoruHesapla({ ...temiz, riskLimiti: 0, toplamBakiye: 50_000 });
    const bilesen = limitsiz.bilesenler.find((b) => b.anahtar === 'limitAsim')!;
    expect(bilesen.normalize).toBeGreaterThan(0);
    expect(bilesen.aciklama).toContain('Risk limiti tanımlı değil');
  });

  it('limiti aşan cari, limitin altındakinden daha yüksek skor alır', () => {
    const altinda = riskSkoruHesapla({ ...temiz, toplamBakiye: 50_000 }).skor;
    const asmis = riskSkoruHesapla({ ...temiz, toplamBakiye: 150_000 }).skor;
    expect(asmis).toBeGreaterThan(altinda);
  });

  it('düşen ciro skoru yükseltir', () => {
    const artan = riskSkoruHesapla({ ...temiz, ciroSon90: 600_000, ciroOnceki90: 400_000 }).skor;
    const dusen = riskSkoruHesapla({ ...temiz, ciroSon90: 100_000, ciroOnceki90: 400_000 }).skor;
    expect(dusen).toBeGreaterThan(artan);
  });

  it('karşılıksız çek geçmişi skoru yükseltir', () => {
    const yok = riskSkoruHesapla(temiz).skor;
    const var_ = riskSkoruHesapla({ ...temiz, karsiliksizAdet: 3, karsiliksizTutar: 40_000 }).skor;
    expect(var_ - yok).toBeGreaterThan(5);
  });
});

describe('kademe eşikleri', () => {
  it('8 kademe ve 7 eşik tanımlıdır', () => {
    expect(VARSAYILAN_RISK_AYARLARI.kademeAdlari).toHaveLength(8);
    expect(VARSAYILAN_RISK_AYARLARI.kademeEsikleri).toHaveLength(7);
  });

  it('eşik sınırlarında doğru kademeyi verir', () => {
    expect(kademeBul(0).kademe).toBe(1);
    expect(kademeBul(9.99).kademe).toBe(1);
    expect(kademeBul(10).kademe).toBe(2);
    expect(kademeBul(84.99).kademe).toBe(7);
    expect(kademeBul(85).kademe).toBe(8);
    expect(kademeBul(100).kademe).toBe(8);
  });
});
