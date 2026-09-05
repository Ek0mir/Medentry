import { bugun, gunEkle, type ISOTarih } from '../core/tarih.js';
import type {
  MikroAdapter,
  MikroCari,
  MikroCek,
  MikroCiro,
  MikroFatura,
  MikroKarsiliksiz,
  MikroOdemeGecmisi,
  MikroTahsilat,
} from './tipler.js';

/**
 * Gerçekçi sahte veri üreteci.
 *
 * Neden var: Mikro'ya erişim olmadan da zincirin tamamı çalıştırılabilsin,
 * demo edilebilsin ve testler GERÇEK sayılar üzerinde doğrulama yapabilsin.
 * Üretilen veri tohuma bağlı ve deterministiktir — aynı tohum aynı carileri,
 * aynı faturaları, aynı yaşlandırma dağılımını verir.
 *
 * Faz 1'de manuel export'la başlanacaksa CsvAdapter'a geçilir; bu adapter
 * geliştirme ve eğitim ortamında kalır.
 */

/** mulberry32 — küçük, hızlı, tohumlanabilir rastgele sayı üreteci. */
function uretec(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ONCULLER = [
  'Anadolu', 'Ege', 'Marmara', 'Toros', 'Fırat', 'Uludağ', 'Erciyes', 'Akdeniz',
  'Karadeniz', 'Başak', 'Öz', 'Yıldız', 'Güven', 'Birlik', 'Şafak', 'Doruk',
  'Bereket', 'Umut', 'Zirve', 'Atlas', 'Efe', 'Meriç', 'Sakarya', 'Kervan',
  'Nurlu', 'Sistem', 'Modern', 'Kale', 'Çınar', 'Ada',
];
const SEKTORLER = [
  'Yapı', 'İnşaat', 'Yapı Market', 'Hırdavat', 'Boya', 'İzolasyon', 'Zemin',
  'Prefabrik', 'Beton', 'Mühendislik', 'Teknik Yapı', 'Yalıtım', 'Dekorasyon',
  'Yapı Malzemeleri', 'Tadilat',
];
const TURLER = ['Ltd. Şti.', 'A.Ş.', 'San. Tic. Ltd. Şti.', 'İnş. Taah. Ltd. Şti.'];
const ILLER = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya', 'Adana', 'Gaziantep',
  'Kayseri', 'Kocaeli', 'Mersin', 'Samsun', 'Trabzon', 'Denizli', 'Eskişehir',
];
const BANKALAR = [
  'Ziraat Bankası', 'İş Bankası', 'Garanti BBVA', 'Yapı Kredi', 'Akbank',
  'Halkbank', 'VakıfBank', 'QNB', 'DenizBank', 'TEB',
];
const TEMSILCILER = ['Ferhat Yılmaz', 'Enes Demir'];

/**
 * Cari profilleri. Dağılım kasıtlı: çoğunluk sağlıklı, azınlık sorunlu —
 * gerçek bir alacak portföyü böyle görünür. Arama listesinin anlamlı
 * olması buna bağlı: her cari kırmızıysa öncelik diye bir şey kalmaz.
 */
interface Profil {
  ad: string;
  pay: number;
  gecikmeGunAraligi: [number, number];
  acikFaturaAdedi: [number, number];
  ortalamaGecikme: [number, number];
  karsiliksizAdet: [number, number];
  ciroTrend: [number, number];
}

const PROFILLER: Profil[] = [
  { ad: 'saglikli',  pay: 0.46, gecikmeGunAraligi: [-30, 20],  acikFaturaAdedi: [1, 5],  ortalamaGecikme: [0, 6],    karsiliksizAdet: [0, 0], ciroTrend: [-0.05, 0.35] },
  { ad: 'gecikmeli', pay: 0.24, gecikmeGunAraligi: [10, 70],   acikFaturaAdedi: [2, 7],  ortalamaGecikme: [8, 22],   karsiliksizAdet: [0, 0], ciroTrend: [-0.2, 0.15] },
  { ad: 'riskli',    pay: 0.16, gecikmeGunAraligi: [55, 150],  acikFaturaAdedi: [3, 9],  ortalamaGecikme: [25, 50],  karsiliksizAdet: [0, 1], ciroTrend: [-0.5, 0] },
  { ad: 'agir',      pay: 0.09, gecikmeGunAraligi: [120, 420], acikFaturaAdedi: [3, 12], ortalamaGecikme: [55, 110], karsiliksizAdet: [1, 4], ciroTrend: [-0.9, -0.3] },
  { ad: 'pasif',     pay: 0.05, gecikmeGunAraligi: [200, 700], acikFaturaAdedi: [1, 4],  ortalamaGecikme: [40, 90],  karsiliksizAdet: [0, 2], ciroTrend: [-1, -1] },
];

export interface SeedSecenekleri {
  tohum?: number;
  cariAdedi?: number;
  /** Referans gün. Verilmezse bugün — demo her zaman güncel görünür. */
  referans?: ISOTarih;
}

interface UretilmisCari {
  cari: MikroCari;
  profil: Profil;
  rnd: () => number;
}

export class SeedAdapter implements MikroAdapter {
  readonly ad = 'seed' as const;

  private readonly tohum: number;
  private readonly cariAdedi: number;
  private readonly referans: ISOTarih;
  private onbellek: UretilmisCari[] | null = null;

  constructor(secenekler: SeedSecenekleri = {}) {
    this.tohum = secenekler.tohum ?? 20260905;
    this.cariAdedi = secenekler.cariAdedi ?? 120;
    this.referans = secenekler.referans ?? bugun();
  }

  async saglikKontrolu() {
    return { saglikli: true, mesaj: `Sahte veri üreteci (tohum ${this.tohum})` };
  }

  private cariUret(): UretilmisCari[] {
    if (this.onbellek) return this.onbellek;

    const kok = uretec(this.tohum);
    const liste: UretilmisCari[] = [];

    for (let i = 0; i < this.cariAdedi; i++) {
      // Her cari kendi alt üretecini alır → cari sayısı değişse bile
      // mevcut carilerin verisi kaymaz.
      const rnd = uretec(this.tohum + i * 7919);
      const profil = profilSec(kok());

      const oncul = sec(ONCULLER, rnd);
      const sektor = sec(SEKTORLER, rnd);
      const tur = sec(TURLER, rnd);
      const kod = `120.${String(i + 1).padStart(4, '0')}`;

      // Limit büyüklüğü segmentlere ayrılır: küçük bayi ↔ büyük müteahhit.
      const buyukluk = rnd();
      const riskLimiti =
        buyukluk < 0.55
          ? yuvarlaBin(araligaSerp(75_000, 400_000, rnd()))
          : buyukluk < 0.9
            ? yuvarlaBin(araligaSerp(400_000, 1_200_000, rnd()))
            : yuvarlaBin(araligaSerp(1_200_000, 3_000_000, rnd()));

      liste.push({
        profil,
        rnd,
        cari: {
          kod,
          unvan: `${oncul} ${sektor} ${tur}`,
          telefon: `05${Math.floor(30 + rnd() * 20)}${String(Math.floor(rnd() * 10_000_000)).padStart(7, '0')}`,
          eposta: null,
          temsilci: sec(TEMSILCILER, rnd),
          // Limit tanımsız cariler kasten bırakıldı: risk skoru bunu
          // "bilinmeyen risk" olarak işaretliyor mu, görülsün.
          riskLimiti: rnd() < 0.06 ? 0 : riskLimiti,
          vadeGun: sec([30, 45, 60, 60, 90, 120], rnd),
          il: sec(ILLER, rnd),
          aktif: true,
        },
      });
    }

    this.onbellek = liste;
    return liste;
  }

  async cariler(): Promise<MikroCari[]> {
    return this.cariUret().map((u) => u.cari);
  }

  async acikFaturalar(): Promise<MikroFatura[]> {
    const faturalar: MikroFatura[] = [];
    for (const { cari, profil, rnd } of this.cariUret()) {
      const adet = tamsayi(profil.acikFaturaAdedi, rnd);
      for (let i = 0; i < adet; i++) {
        const gecikme = tamsayi(profil.gecikmeGunAraligi, rnd);
        const vade = gunEkle(this.referans, -gecikme);
        const tarih = gunEkle(vade, -cari.vadeGun);
        const tutar = yuvarlaKurus(araligaSerp(12_000, 380_000, rnd() ** 1.6));
        // Kısmi tahsilat gerçek hayatta sık: faturaların bir kısmı yarım kapanır.
        const kalanOran = rnd() < 0.22 ? 0.25 + rnd() * 0.5 : 1;
        faturalar.push({
          faturaNo: `MRF${this.referans.slice(2, 4)}${cari.kod.slice(-4)}${String(i + 1).padStart(2, '0')}`,
          cariKod: cari.kod,
          tarih,
          vade,
          tutar,
          kalan: yuvarlaKurus(tutar * kalanOran),
          paraBirimi: 'TRY',
          tip: 'SATIS',
        });
      }
    }
    return faturalar;
  }

  async tahsilatlar(gunGeriye: number): Promise<MikroTahsilat[]> {
    const tahsilatlar: MikroTahsilat[] = [];
    for (const { cari, profil, rnd } of this.cariUret()) {
      if (profil.ad === 'pasif') continue;
      const adet = Math.max(0, Math.round(gunGeriye / 30) * (profil.ad === 'saglikli' ? 2 : 1));
      for (let i = 0; i < adet; i++) {
        const gunOnce = Math.floor(rnd() * gunGeriye);
        tahsilatlar.push({
          kaynakNo: `THS${cari.kod.slice(-4)}${i}`,
          cariKod: cari.kod,
          tarih: gunEkle(this.referans, -gunOnce),
          tutar: yuvarlaKurus(araligaSerp(8_000, 220_000, rnd())),
          tip: sec(['HAVALE', 'HAVALE', 'CEK', 'NAKIT'], rnd),
        });
      }
    }
    return tahsilatlar;
  }

  async cekler(): Promise<MikroCek[]> {
    const cekler: MikroCek[] = [];
    for (const { cari, profil, rnd } of this.cariUret()) {
      if (rnd() < 0.45) continue; // her cari çekle çalışmaz
      const adet = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < adet; i++) {
        // Vadeler ağırlıklı olarak ileri tarihli; bir kısmı yakın vadeli
        // ki W-08 çek takvimi ve muhasebe ekranı dolu görünsün.
        const gunSonra = Math.floor(-20 + rnd() * 120);
        const karsiliksizOlasilik = profil.ad === 'agir' ? 0.25 : profil.ad === 'riskli' ? 0.08 : 0.01;
        const durum =
          gunSonra < 0
            ? rnd() < karsiliksizOlasilik
              ? 'KARSILIKSIZ'
              : 'TAHSIL'
            : 'PORTFOYDE';
        cekler.push({
          cekNo: `CK${cari.kod.slice(-4)}${String(i + 1).padStart(2, '0')}`,
          cariKod: cari.kod,
          vade: gunEkle(this.referans, gunSonra),
          tutar: yuvarlaKurus(araligaSerp(15_000, 300_000, rnd())),
          kesideci: cari.unvan,
          banka: sec(BANKALAR, rnd),
          durum,
        });
      }
    }
    return cekler;
  }

  async odemeGecmisi(): Promise<MikroOdemeGecmisi[]> {
    return this.cariUret().map(({ cari, profil, rnd }) => {
      const odenen = 8 + Math.floor(rnd() * 60);
      const ortalama = araligaSerp(profil.ortalamaGecikme[0], profil.ortalamaGecikme[1], rnd());
      return {
        cariKod: cari.kod,
        ortalamaGecikmeGun: Math.round(ortalama * 10) / 10,
        odenenFaturaAdedi: odenen,
        gecikmeliAdet: Math.round(odenen * Math.min(1, ortalama / 45)),
        pencereAy: 24,
      };
    });
  }

  async karsiliksizlar(): Promise<MikroKarsiliksiz[]> {
    return this.cariUret().map(({ cari, profil, rnd }) => {
      const adet = tamsayi(profil.karsiliksizAdet, rnd);
      return {
        cariKod: cari.kod,
        adet,
        tutar: adet === 0 ? 0 : yuvarlaKurus(adet * araligaSerp(20_000, 180_000, rnd())),
        sonTarih: adet === 0 ? null : gunEkle(this.referans, -Math.floor(rnd() * 500)),
      };
    });
  }

  async cirolar(): Promise<MikroCiro[]> {
    return this.cariUret().map(({ cari, profil, rnd }) => {
      if (profil.ad === 'pasif') {
        return { cariKod: cari.kod, son90Gun: 0, onceki90Gun: yuvarlaKurus(araligaSerp(150_000, 900_000, rnd())) };
      }
      const onceki = yuvarlaKurus(araligaSerp(120_000, 2_400_000, rnd() ** 1.4));
      const trend = araligaSerp(profil.ciroTrend[0], profil.ciroTrend[1], rnd());
      return {
        cariKod: cari.kod,
        son90Gun: yuvarlaKurus(Math.max(0, onceki * (1 + trend))),
        onceki90Gun: onceki,
      };
    });
  }
}

// --- küçük yardımcılar ------------------------------------------------------

function sec<T>(dizi: readonly T[], rnd: () => number): T {
  return dizi[Math.floor(rnd() * dizi.length)] ?? dizi[0]!;
}

function araligaSerp(alt: number, ust: number, oran: number): number {
  return alt + (ust - alt) * oran;
}

function tamsayi(aralik: readonly [number, number], rnd: () => number): number {
  return Math.round(araligaSerp(aralik[0], aralik[1], rnd()));
}

function yuvarlaKurus(n: number): number {
  return Math.round(n * 100) / 100;
}

function yuvarlaBin(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function profilSec(oran: number): Profil {
  let toplam = 0;
  for (const profil of PROFILLER) {
    toplam += profil.pay;
    if (oran <= toplam) return profil;
  }
  return PROFILLER[0]!;
}
