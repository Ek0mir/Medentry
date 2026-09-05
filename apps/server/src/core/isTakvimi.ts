import { gunEkle, isoTarih, tarihiCoz, type ISOTarih } from './tarih.js';

/**
 * İş günü takvimi.
 *
 * Hafta sonu ve resmî tatiller iş günü sayılmaz. Bu önemli: "son tarih +24 saat"
 * cuma akşamı işleyip cumartesi Enes'e bildirim düşürmesin; pazartesi düşsün.
 * Tatiller op_tatil tablosundan gelir (db/seed/tatiller.sql).
 */
export class IsTakvimi {
  private readonly tatiller: ReadonlySet<ISOTarih>;

  constructor(tatiller: Iterable<ISOTarih> = []) {
    this.tatiller = new Set(tatiller);
  }

  isGunuMu(t: ISOTarih): boolean {
    const gun = tarihiCoz(t).getDay(); // 0 Pazar, 6 Cumartesi
    if (gun === 0 || gun === 6) return false;
    return !this.tatiller.has(t);
  }

  /** Verilen gün iş günüyse kendisini, değilse sonraki ilk iş gününü verir. */
  ilkIsGunu(t: ISOTarih): ISOTarih {
    let imlec = t;
    for (let i = 0; i < 400; i++) {
      if (this.isGunuMu(imlec)) return imlec;
      imlec = gunEkle(imlec, 1);
    }
    throw new Error(`İş günü bulunamadı: ${t}`);
  }

  /** N iş günü ileri (veya negatifse geri) gider. */
  isGunuEkle(t: ISOTarih, adet: number): ISOTarih {
    const yon = adet >= 0 ? 1 : -1;
    let kalan = Math.abs(adet);
    let imlec = t;
    while (kalan > 0) {
      imlec = gunEkle(imlec, yon);
      if (this.isGunuMu(imlec)) kalan--;
    }
    return imlec;
  }

  /** İki gün arasındaki iş günü sayısı (baslangic hariç, bitis dahil). */
  isGunuFarki(baslangic: ISOTarih, bitis: ISOTarih): number {
    if (baslangic === bitis) return 0;
    const yon = baslangic < bitis ? 1 : -1;
    let sayac = 0;
    let imlec = baslangic;
    while (imlec !== bitis) {
      imlec = gunEkle(imlec, yon);
      if (this.isGunuMu(imlec)) sayac += yon;
    }
    return sayac;
  }

  /**
   * İŞ SAATİ ekler: saatler yalnızca iş günlerinde işler, hafta sonu ve
   * tatilde saat durur.
   *
   * Örnek: cuma 17:00 + 24 iş saati → pazartesi 17:00 (+48 → salı 17:00).
   * Duvar saatini ekleyip sonucu ileri kaydırmak YETMEZ: cuma 17:00 için
   * 24 ve 48 saatlik işaretler aynı pazartesiye düşer, merdiven basamak
   * atlar. Bu yüzden saatler gün gün tüketilir.
   */
  isSaatiEkle(baslangic: Date, saat: number): Date {
    if (saat <= 0) return new Date(baslangic.getTime());

    let imlec = new Date(baslangic.getTime());
    // Başlangıç iş gününde değilse, saat işlemeye sonraki iş gününde başlar.
    if (!this.isGunuMu(isoTarih(imlec))) {
      imlec = this.gunBasinaTasi(this.ilkIsGunu(isoTarih(imlec)));
    }

    let kalan = saat;
    for (let koruma = 0; koruma < 1000; koruma++) {
      const gunSonu = new Date(imlec.getTime());
      gunSonu.setHours(24, 0, 0, 0); // ertesi gün 00:00
      const buGunSaat = (gunSonu.getTime() - imlec.getTime()) / 3_600_000;

      if (kalan <= buGunSaat) return new Date(imlec.getTime() + kalan * 3_600_000);

      kalan -= buGunSaat;
      const sonrakiIsGunu = this.isGunuEkle(isoTarih(imlec), 1);
      imlec = this.gunBasinaTasi(sonrakiIsGunu);
    }
    throw new Error(`İş saati eklenemedi: ${saat} saat`);
  }

  private gunBasinaTasi(t: ISOTarih): Date {
    const d = tarihiCoz(t);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
