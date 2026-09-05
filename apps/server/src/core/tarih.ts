/**
 * Tarih yardımcıları.
 *
 * Kural: gün bazlı değerler her yerde 'YYYY-MM-DD' metni olarak taşınır.
 * Türkiye 2016'dan beri yaz saati uygulamıyor (sabit UTC+03), bu yüzden
 * süreç TZ=Europe/Istanbul ile çalıştığında yerel Date işlemleri güvenlidir.
 */
export type ISOTarih = string; // 'YYYY-MM-DD'

const GUN_MS = 86_400_000;

export function bugun(simdi: Date = new Date()): ISOTarih {
  return isoTarih(simdi);
}

export function isoTarih(d: Date): ISOTarih {
  const yil = d.getFullYear();
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  const gun = String(d.getDate()).padStart(2, '0');
  return `${yil}-${ay}-${gun}`;
}

/** 'YYYY-MM-DD' → yerel gün başlangıcı (00:00). */
export function tarihiCoz(t: ISOTarih): Date {
  const [y, a, g] = t.split('-').map(Number);
  if (!y || !a || !g) throw new Error(`Geçersiz tarih: ${t}`);
  return new Date(y, a - 1, g);
}

/** İki gün arasındaki fark (b - a), tam gün. */
export function gunFarki(a: ISOTarih, b: ISOTarih): number {
  const baslangic = tarihiCoz(a).getTime();
  const bitis = tarihiCoz(b).getTime();
  return Math.round((bitis - baslangic) / GUN_MS);
}

export function gunEkle(t: ISOTarih, gun: number): ISOTarih {
  const d = tarihiCoz(t);
  d.setDate(d.getDate() + gun);
  return isoTarih(d);
}

/** Verilen günün belirli saatinde bir zaman damgası üretir (yerel saat). */
export function gunSaat(t: ISOTarih, saat: number, dakika = 0): Date {
  const d = tarihiCoz(t);
  d.setHours(saat, dakika, 0, 0);
  return d;
}
