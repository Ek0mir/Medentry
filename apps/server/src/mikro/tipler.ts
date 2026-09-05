import type { ISOTarih } from '../core/tarih.js';

/**
 * Mikro'dan okunan verinin normalize edilmiş biçimi.
 *
 * Bu arayüz kasten dar tutuldu: operasyon katmanının ihtiyacı olan alanlar
 * kadar. Mikro'nun tablo yapısı değişse bile burası sabit kalır — değişen,
 * adapterların içi ve docs/mikro-eslesme.json olur.
 */

export interface MikroCari {
  kod: string;
  unvan: string;
  telefon: string | null;
  eposta: string | null;
  temsilci: string | null;
  riskLimiti: number;
  vadeGun: number;
  il: string | null;
  aktif: boolean;
}

export interface MikroFatura {
  faturaNo: string;
  cariKod: string;
  tarih: ISOTarih;
  vade: ISOTarih;
  tutar: number;
  kalan: number;
  paraBirimi: string;
  tip: string;
}

export interface MikroTahsilat {
  kaynakNo: string | null;
  cariKod: string;
  tarih: ISOTarih;
  tutar: number;
  tip: string; // NAKIT | HAVALE | CEK | KREDI_KARTI
}

export interface MikroCek {
  cekNo: string;
  cariKod: string;
  vade: ISOTarih;
  tutar: number;
  kesideci: string | null;
  banka: string | null;
  durum: string; // PORTFOYDE | TAHSIL | KARSILIKSIZ | IADE
}

export interface MikroOdemeGecmisi {
  cariKod: string;
  ortalamaGecikmeGun: number;
  odenenFaturaAdedi: number;
  gecikmeliAdet: number;
  pencereAy: number;
}

export interface MikroKarsiliksiz {
  cariKod: string;
  adet: number;
  tutar: number;
  sonTarih: ISOTarih | null;
}

export interface MikroCiro {
  cariKod: string;
  son90Gun: number;
  onceki90Gun: number;
}

/** Mikro veri kaynağı sözleşmesi. Üç uygulaması var: seed, csv, mssql. */
export interface MikroAdapter {
  readonly ad: 'seed' | 'csv' | 'mssql';
  /** Bağlantı/kaynak erişilebilir mi? Senkron öncesi kontrol edilir (W-14). */
  saglikKontrolu(): Promise<{ saglikli: boolean; mesaj: string }>;
  cariler(): Promise<MikroCari[]>;
  acikFaturalar(): Promise<MikroFatura[]>;
  tahsilatlar(gunGeriye: number): Promise<MikroTahsilat[]>;
  cekler(): Promise<MikroCek[]>;
  odemeGecmisi(): Promise<MikroOdemeGecmisi[]>;
  karsiliksizlar(): Promise<MikroKarsiliksiz[]>;
  cirolar(): Promise<MikroCiro[]>;
  kapat?(): Promise<void>;
}
