/**
 * Alacak risk skoru — Masterbook Bölüm 06.
 *
 * Beş bileşen, toplam 100 puan:
 *   Vade aşım günü ................ 40
 *   Aşım tutarı / risk limiti ..... 25
 *   Ödeme geçmişi düzenliliği ..... 15
 *   Karşılıksız / iade geçmişi .... 10
 *   Ciro trendi (90 gün) .......... 10
 *
 * Her bileşen önce 0..1 aralığına normalize edilir, sonra ağırlığıyla çarpılır.
 * Skorun NEDEN o olduğu `bilesenler` içinde taşınır ve ekranda gösterilir —
 * personelin sisteme güvenmesi buna bağlı.
 *
 * Ağırlıklar ve kademe eşikleri op_ayar'dan gelir; buradaki değerler varsayılandır.
 */

export interface RiskGirdisi {
  /** En eski açık faturanın vade aşım günü (an_yaslandirma.en_eski_gun). */
  enEskiGun: number;
  /** Toplam açık bakiye. */
  toplamBakiye: number;
  /** Mikro'daki risk limiti. 0 = limit tanımsız. */
  riskLimiti: number;
  /** Son 24 ayın ortalama gecikme günü. */
  ortalamaGecikmeGun: number;
  karsiliksizAdet: number;
  karsiliksizTutar: number;
  ciroSon90: number;
  ciroOnceki90: number;
}

export interface BilesenKatkisi {
  anahtar: string;
  ad: string;
  agirlik: number;
  hamDeger: number | string;
  normalize: number;
  katki: number;
  aciklama: string;
}

export interface RiskSonucu {
  skor: number;
  kademe: number;
  kademeAd: string;
  bilesenler: BilesenKatkisi[];
}

export interface RiskAyarlari {
  agirliklar: {
    vadeAsim: number;
    limitAsim: number;
    odemeGecmisi: number;
    karsiliksiz: number;
    ciroTrend: number;
  };
  /** 8 kademeye ayıran 7 eşik; artan sırada. */
  kademeEsikleri: number[];
  kademeAdlari: string[];
}

export const VARSAYILAN_RISK_AYARLARI: RiskAyarlari = {
  agirliklar: {
    vadeAsim: 40,
    limitAsim: 25,
    odemeGecmisi: 15,
    karsiliksiz: 10,
    ciroTrend: 10,
  },
  // AÇIK MADDE: MİRFİX OS masterbook'undaki 8 kademenin resmî eşikleri
  // teyit edilecek. Bu değerler op_ayar'dan tek noktadan güncellenir.
  kademeEsikleri: [10, 20, 32, 45, 58, 72, 85],
  kademeAdlari: [
    'Sorunsuz',
    'İzlemede',
    'Hafif gecikme',
    'Belirgin gecikme',
    'Riskli',
    'Yüksek riskli',
    'Sevk durdurma',
    'Hukuki değerlendirme',
  ],
};

/**
 * Çapa noktaları arasında doğrusal ara değer.
 * Çapalar [x, y] çiftleri, x artan sırada; y değerleri 0..1.
 */
function araDeger(x: number, capalar: readonly (readonly [number, number])[]): number {
  const ilk = capalar[0]!;
  const son = capalar[capalar.length - 1]!;
  if (x <= ilk[0]) return ilk[1];
  if (x >= son[0]) return son[1];
  for (let i = 0; i < capalar.length - 1; i++) {
    const [x0, y0] = capalar[i]!;
    const [x1, y1] = capalar[i + 1]!;
    if (x >= x0 && x <= x1) {
      const oran = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + oran * (y1 - y0);
    }
  }
  return son[1];
}

const yuzde = (n: number) => `%${(n * 100).toFixed(0)}`;
const para = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺';

export function riskSkoruHesapla(
  girdi: RiskGirdisi,
  ayar: RiskAyarlari = VARSAYILAN_RISK_AYARLARI,
): RiskSonucu {
  const bilesenler: BilesenKatkisi[] = [];
  const { agirliklar } = ayar;

  // 1) Vade aşım günü — çapalar yaşlandırma bantlarıyla hizalı.
  {
    const gun = Math.max(0, girdi.enEskiGun);
    const n = araDeger(gun, [
      [0, 0],
      [30, 0.25],
      [60, 0.45],
      [90, 0.65],
      [180, 1],
    ]);
    bilesenler.push({
      anahtar: 'vadeAsim',
      ad: 'Vade aşım günü',
      agirlik: agirliklar.vadeAsim,
      hamDeger: gun,
      normalize: n,
      katki: n * agirliklar.vadeAsim,
      aciklama:
        gun === 0 ? 'Vadesi geçen fatura yok' : `En eski açık fatura ${gun} gün gecikmiş`,
    });
  }

  // 2) Limit kullanımı. Limit tanımsızken bakiye varsa "bilinmeyen risk" sayılır.
  {
    let n: number;
    let aciklama: string;
    let ham: number | string;
    if (girdi.riskLimiti > 0) {
      const oran = girdi.toplamBakiye / girdi.riskLimiti;
      ham = Math.round(oran * 1000) / 1000;
      n = araDeger(oran, [
        [0, 0],
        [0.8, 0.4],
        [1, 0.7],
        [1.5, 1],
      ]);
      aciklama = `Limitin ${yuzde(oran)}'i kullanılmış (${para(girdi.toplamBakiye)} / ${para(girdi.riskLimiti)})`;
    } else if (girdi.toplamBakiye > 0) {
      ham = 'limit tanımsız';
      n = 0.6;
      aciklama = `Risk limiti tanımlı değil ama ${para(girdi.toplamBakiye)} bakiye var`;
    } else {
      ham = 'limit tanımsız';
      n = 0;
      aciklama = 'Risk limiti tanımlı değil, bakiye yok';
    }
    bilesenler.push({
      anahtar: 'limitAsim',
      ad: 'Aşım tutarı / risk limiti',
      agirlik: agirliklar.limitAsim,
      hamDeger: ham,
      normalize: n,
      katki: n * agirliklar.limitAsim,
      aciklama,
    });
  }

  // 3) Ödeme geçmişi düzenliliği.
  {
    const gecikme = Math.max(0, girdi.ortalamaGecikmeGun);
    const n = araDeger(gecikme, [
      [0, 0],
      [15, 0.35],
      [30, 0.6],
      [60, 0.85],
      [90, 1],
    ]);
    bilesenler.push({
      anahtar: 'odemeGecmisi',
      ad: 'Ödeme geçmişi düzenliliği',
      agirlik: agirliklar.odemeGecmisi,
      hamDeger: Math.round(gecikme * 10) / 10,
      normalize: n,
      katki: n * agirliklar.odemeGecmisi,
      aciklama: `Son 24 ayda ortalama ${gecikme.toFixed(0)} gün gecikmeli ödeme`,
    });
  }

  // 4) Karşılıksız / iade geçmişi. Adet ve tutar birlikte değerlendirilir.
  {
    const adetSkor = araDeger(girdi.karsiliksizAdet, [
      [0, 0],
      [1, 0.5],
      [2, 0.75],
      [3, 1],
    ]);
    const tutarSkor =
      girdi.toplamBakiye > 0
        ? araDeger(girdi.karsiliksizTutar / Math.max(girdi.toplamBakiye, 1), [
            [0, 0],
            [0.25, 0.5],
            [0.5, 0.8],
            [1, 1],
          ])
        : girdi.karsiliksizTutar > 0
          ? 1
          : 0;
    const n = Math.max(adetSkor, tutarSkor);
    bilesenler.push({
      anahtar: 'karsiliksiz',
      ad: 'Karşılıksız / iade geçmişi',
      agirlik: agirliklar.karsiliksiz,
      hamDeger: girdi.karsiliksizAdet,
      normalize: n,
      katki: n * agirliklar.karsiliksiz,
      aciklama:
        girdi.karsiliksizAdet === 0
          ? 'Karşılıksız çek/iade kaydı yok'
          : `${girdi.karsiliksizAdet} adet, toplam ${para(girdi.karsiliksizTutar)}`,
    });
  }

  // 5) Ciro trendi — düşen ciro + duran bakiye erken uyarıdır.
  {
    let n: number;
    let aciklama: string;
    let ham: number | string;
    if (girdi.ciroOnceki90 > 0) {
      const degisim = (girdi.ciroSon90 - girdi.ciroOnceki90) / girdi.ciroOnceki90;
      ham = Math.round(degisim * 1000) / 1000;
      n = araDeger(degisim, [
        [-1, 1],
        [-0.75, 1],
        [-0.5, 0.75],
        [-0.25, 0.5],
        [0, 0.2],
        [0.25, 0],
      ]);
      const yon = degisim >= 0 ? 'arttı' : 'düştü';
      aciklama = `Son 90 gün cirosu önceki döneme göre ${yuzde(Math.abs(degisim))} ${yon}`;
    } else if (girdi.ciroSon90 > 0) {
      ham = 'yeni cari';
      n = 0.2;
      aciklama = 'Önceki dönemde ciro yok — yeni veya uzun süre durmuş cari';
    } else {
      ham = 'ciro yok';
      n = 0.5;
      aciklama = 'Son 180 günde hiç ciro yok, bakiye duruyor';
    }
    bilesenler.push({
      anahtar: 'ciroTrend',
      ad: 'Ciro trendi (90 gün)',
      agirlik: agirliklar.ciroTrend,
      hamDeger: ham,
      normalize: n,
      katki: n * agirliklar.ciroTrend,
      aciklama,
    });
  }

  const skor = Math.round(bilesenler.reduce((t, b) => t + b.katki, 0) * 100) / 100;
  const { kademe, kademeAd } = kademeBul(skor, ayar);

  return {
    skor,
    kademe,
    kademeAd,
    bilesenler: bilesenler.map((b) => ({
      ...b,
      normalize: Math.round(b.normalize * 1000) / 1000,
      katki: Math.round(b.katki * 100) / 100,
    })),
  };
}

/** Skoru 8 kademeden birine oturtur (1 = en iyi, 8 = hukuki değerlendirme). */
export function kademeBul(
  skor: number,
  ayar: RiskAyarlari = VARSAYILAN_RISK_AYARLARI,
): { kademe: number; kademeAd: string } {
  let kademe = ayar.kademeEsikleri.length + 1;
  for (let i = 0; i < ayar.kademeEsikleri.length; i++) {
    if (skor < ayar.kademeEsikleri[i]!) {
      kademe = i + 1;
      break;
    }
  }
  return { kademe, kademeAd: ayar.kademeAdlari[kademe - 1] ?? `Kademe ${kademe}` };
}
