import { gunFarki, type ISOTarih } from './tarih.js';

/**
 * Görev yaşam döngüsü kuralları — Masterbook Bölüm 05.
 *
 * KRİTİK TASARIM KARARI: arama görevi kapatılırken SONUÇ GİRMEK ZORUNLUDUR.
 * Boş kapatma engellenir. Aksi halde sistem "kapatıldı" der ama hiçbir şey
 * öğrenilmemiş olur — bugünkü sorunun aynısı dijital hale gelir.
 */

export const GOREV_TIPLERI = [
  'ARAMA',
  'ODEME_SOZU',
  'CEK_VADE',
  'SEVKIYAT',
  'ONAY',
  'SERBEST',
] as const;
export type GorevTipi = (typeof GOREV_TIPLERI)[number];

export const SONUCLAR = [
  'ULASILDI',
  'ULASILAMADI',
  'ODEME_SOZU',
  'ITIRAZ',
  'TAMAMLANDI',
  'GEREKSIZ',
] as const;
export type Sonuc = (typeof SONUCLAR)[number];

export const SONUC_ETIKETLERI: Record<Sonuc, string> = {
  ULASILDI: 'Ulaşıldı',
  ULASILAMADI: 'Ulaşılamadı',
  ODEME_SOZU: 'Ödeme sözü alındı',
  ITIRAZ: 'İtiraz var',
  TAMAMLANDI: 'Tamamlandı',
  GEREKSIZ: 'Gereksiz / iptal',
};

/** Hangi görev tipinde hangi sonuçlar seçilebilir. */
export const IZINLI_SONUCLAR: Record<GorevTipi, readonly Sonuc[]> = {
  ARAMA: ['ULASILDI', 'ULASILAMADI', 'ODEME_SOZU', 'ITIRAZ'],
  ODEME_SOZU: ['TAMAMLANDI', 'ULASILAMADI', 'ODEME_SOZU', 'ITIRAZ'],
  CEK_VADE: ['TAMAMLANDI', 'ITIRAZ', 'GEREKSIZ'],
  SEVKIYAT: ['TAMAMLANDI', 'GEREKSIZ'],
  ONAY: ['TAMAMLANDI', 'GEREKSIZ'],
  SERBEST: ['TAMAMLANDI', 'GEREKSIZ'],
};

export interface KapatmaGirdisi {
  tip: GorevTipi;
  sonuc?: string | null;
  sonucNotu?: string | null;
  sozTarihi?: ISOTarih | null;
  sozTutari?: number | null;
}

export interface DogrulamaSonucu {
  gecerli: boolean;
  hatalar: string[];
}

/**
 * Kapatma isteğini doğrular. API bu sonucu 422 olarak döndürür —
 * kural veritabanı CHECK'iyle de ayrıca korunur (iki kat emniyet).
 */
export function kapatmayiDogrula(
  girdi: KapatmaGirdisi,
  bugunTarih: ISOTarih,
): DogrulamaSonucu {
  const hatalar: string[] = [];
  const izinli = IZINLI_SONUCLAR[girdi.tip];

  if (!girdi.sonuc) {
    hatalar.push('Sonuç girmeden görev kapatılamaz.');
  } else if (!izinli.includes(girdi.sonuc as Sonuc)) {
    const etiketler = izinli.map((s) => SONUC_ETIKETLERI[s]).join(', ');
    hatalar.push(`"${girdi.sonuc}" bu görev tipi için geçerli bir sonuç değil. Seçenekler: ${etiketler}.`);
  }

  if (girdi.sonuc === 'ODEME_SOZU') {
    if (!girdi.sozTarihi) {
      hatalar.push('Ödeme sözü için söz tarihi zorunludur.');
    } else if (gunFarki(bugunTarih, girdi.sozTarihi) < 0) {
      hatalar.push('Ödeme sözü tarihi geçmiş bir gün olamaz.');
    } else if (gunFarki(bugunTarih, girdi.sozTarihi) > 180) {
      hatalar.push('Ödeme sözü tarihi en fazla 180 gün ileri olabilir.');
    }
    if (girdi.sozTutari === null || girdi.sozTutari === undefined) {
      hatalar.push('Ödeme sözü için söz tutarı zorunludur.');
    } else if (!(girdi.sozTutari > 0)) {
      hatalar.push('Ödeme sözü tutarı sıfırdan büyük olmalıdır.');
    }
  }

  if (girdi.sonuc === 'ITIRAZ' && !girdi.sonucNotu?.trim()) {
    hatalar.push('İtiraz sonucunda neye itiraz edildiği not olarak yazılmalıdır.');
  }

  return { gecerli: hatalar.length === 0, hatalar };
}

/** Görev tipinin varsayılan sorumlusu hangi rol. Masterbook Bölüm 05 tablosu. */
export const TIP_VARSAYILAN_ROL: Record<GorevTipi, string> = {
  ARAMA: 'SATIS',
  ODEME_SOZU: 'SATIS',
  CEK_VADE: 'MUHASEBE',
  SEVKIYAT: 'SEVKIYAT',
  ONAY: 'YONETICI',
  SERBEST: 'YONETICI',
};
