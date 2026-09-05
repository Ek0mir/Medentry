import { createHash } from 'node:crypto';
import { VARSAYILAN_ESKALASYON_AYARLARI } from '../core/eskalasyon.js';
import { VARSAYILAN_ONCELIK_AYARLARI } from '../core/oncelik.js';
import { VARSAYILAN_RISK_AYARLARI } from '../core/riskSkor.js';
import { rastgeleParola, sifreOzetle } from '../kimlik/sifre.js';
import { gecisleriCalistir } from './gecisler.js';
import { havuzuKapat, sorgu, tekSatir } from './havuz.js';
import { ayarYaz } from './yardimcilar.js';

/**
 * Başlangıç verisi: kullanıcılar, ayar eşikleri, resmî tatiller.
 * Tekrar çalıştırılabilir — var olan kaydın üstüne yazmaz.
 */

interface TohumKullanici {
  ad: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'UST_ONAY' | 'SATIS' | 'MUHASEBE' | 'SEVKIYAT';
}

// Masterbook Bölüm 11 — roller ve yetki matrisi.
const KULLANICILAR: TohumKullanici[] = [
  { ad: 'Enes', kullaniciAdi: 'enes', rol: 'YONETICI' },
  { ad: 'Ali Bey', kullaniciAdi: 'ali', rol: 'UST_ONAY' },
  { ad: 'Ferhat Bey', kullaniciAdi: 'ferhat', rol: 'SATIS' },
  { ad: 'Ayşe Hanım', kullaniciAdi: 'ayse', rol: 'MUHASEBE' },
  { ad: 'Hanifi Bey', kullaniciAdi: 'hanifi', rol: 'SEVKIYAT' },
];

/**
 * Sabit tarihli resmî tatiller.
 *
 * DİKKAT: Ramazan ve Kurban Bayramı hicri takvime göre kaydığı için buraya
 * yazılmadı — her yıl Yönetim ekranından eklenmeli. Yanlış bir tarih
 * yazmaktansa eksik bırakmak doğru: eskalasyon saatleri buna göre işliyor.
 */
const SABIT_TATILLER: [string, string][] = [
  ['01-01', 'Yılbaşı'],
  ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'],
  ['05-01', 'Emek ve Dayanışma Günü'],
  ['05-19', 'Atatürk’ü Anma, Gençlik ve Spor Bayramı'],
  ['07-15', 'Demokrasi ve Millî Birlik Günü'],
  ['08-30', 'Zafer Bayramı'],
  ['10-29', 'Cumhuriyet Bayramı'],
];

export async function tohumla(demoSifre?: string): Promise<{ olusturulan: [string, string][] }> {
  await gecisleriCalistir();

  const olusturulan: [string, string][] = [];
  for (const k of KULLANICILAR) {
    const mevcut = await tekSatir('SELECT id FROM op_kullanici WHERE kullanici_adi = $1', [
      k.kullaniciAdi,
    ]);
    if (mevcut) continue;
    const parola = demoSifre ?? rastgeleParola();
    await sorgu(
      'INSERT INTO op_kullanici (ad, kullanici_adi, sifre_hash, rol) VALUES ($1, $2, $3, $4)',
      [k.ad, k.kullaniciAdi, await sifreOzetle(parola), k.rol],
    );
    olusturulan.push([k.kullaniciAdi, parola]);
  }

  await ayarYaz('risk.ayarlar', VARSAYILAN_RISK_AYARLARI,
    'Risk skoru bileşen ağırlıkları ve 8 kademe eşikleri (masterbook Bölüm 06).');
  await ayarYaz('oncelik.ayarlar', VARSAYILAN_ONCELIK_AYARLARI,
    'Günlük arama listesi: kaç cari görev olarak açılacak ve tutulmayan söz cezası.');
  await ayarYaz('eskalasyon.ayarlar', VARSAYILAN_ESKALASYON_AYARLARI,
    'Eskalasyon merdiveni: seviye 2 ve 3 için iş saati eşikleri.');
  await ayarYaz('gorev.aramaSonSaati', 17,
    'ARAMA görevlerinin son tarihi: açıldığı günün bu saati.');

  const yil = new Date().getFullYear();
  for (const y of [yil, yil + 1]) {
    for (const [gunAy, ad] of SABIT_TATILLER) {
      await sorgu('INSERT INTO op_tatil (tarih, ad) VALUES ($1, $2) ON CONFLICT (tarih) DO NOTHING', [
        `${y}-${gunAy}`,
        ad,
      ]);
    }
  }

  return { olusturulan };
}

/** API anahtarları düz metin saklanmaz; yalnızca özeti tutulur. */
export function anahtarOzetle(anahtar: string): string {
  return createHash('sha256').update(anahtar).digest('hex');
}

// CLI olarak çalıştırıldığında
if (import.meta.url === `file://${process.argv[1]}`) {
  const demoBayrak = process.argv.indexOf('--demo-sifre');
  const demoSifre = demoBayrak >= 0 ? process.argv[demoBayrak + 1] : undefined;

  const { olusturulan } = await tohumla(demoSifre);
  if (olusturulan.length === 0) {
    console.log('Kullanıcılar zaten mevcut; ayarlar ve tatiller güncellendi.');
  } else {
    console.log('Kullanıcılar oluşturuldu. Parolaları bir kere gösteriliyor:\n');
    for (const [kullanici, parola] of olusturulan) {
      console.log(`  ${kullanici.padEnd(8)} ${parola}`);
    }
    console.log('\nBu parolaları not alın ve ilk girişten sonra değiştirin.');
  }
  await havuzuKapat();
}
