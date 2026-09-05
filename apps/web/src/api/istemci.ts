/**
 * API istemcisi.
 *
 * Panel doğrudan veritabanına değil, /api/v1'e konuşur — dışarıdan veri
 * çekecek olanla aynı sözleşme. Ekrana özel uç yok.
 */

export class ApiHatasi extends Error {
  constructor(
    readonly durum: number,
    message: string,
    readonly hatalar?: string[],
  ) {
    super(message);
    this.name = 'ApiHatasi';
  }
}

async function istek<S>(yol: string, secenekler: RequestInit = {}): Promise<S> {
  const yanit = await fetch(`/api/v1${yol}`, {
    credentials: 'same-origin',
    headers: secenekler.body ? { 'content-type': 'application/json' } : {},
    ...secenekler,
  });

  if (!yanit.ok) {
    let mesaj = `İstek başarısız (${yanit.status})`;
    let hatalar: string[] | undefined;
    try {
      const govde = await yanit.json();
      mesaj = govde.hata ?? mesaj;
      hatalar = govde.hatalar;
    } catch {
      /* gövde JSON değilse varsayılan mesaj kalır */
    }
    throw new ApiHatasi(yanit.status, mesaj, hatalar);
  }

  if (yanit.status === 204) return undefined as S;
  return (await yanit.json()) as S;
}

export const api = {
  al: <S>(yol: string) => istek<S>(yol),
  gonder: <S>(yol: string, govde?: unknown) =>
    istek<S>(yol, { method: 'POST', body: JSON.stringify(govde ?? {}) }),
  yamala: <S>(yol: string, govde: unknown) =>
    istek<S>(yol, { method: 'PATCH', body: JSON.stringify(govde) }),
  koy: <S>(yol: string, govde: unknown) =>
    istek<S>(yol, { method: 'PUT', body: JSON.stringify(govde) }),
  sil: <S>(yol: string) => istek<S>(yol, { method: 'DELETE' }),
};

/** Dosya indirme: tarayıcıyı doğrudan uca yönlendirir, çerez taşınır. */
export function indir(yol: string, bicim: 'csv' | 'xlsx'): void {
  const ayirici = yol.includes('?') ? '&' : '?';
  window.location.href = `/api/v1${yol}${ayirici}format=${bicim}`;
}

// --- paylaşılan tipler ------------------------------------------------------

export type Rol = 'YONETICI' | 'UST_ONAY' | 'SATIS' | 'MUHASEBE' | 'SEVKIYAT';

export interface Oturum {
  kullaniciId: number | null;
  ad: string;
  rol: Rol;
  kaynak: 'oturum' | 'api-anahtari';
}

export interface Gorev {
  id: number;
  tip: string;
  cari_kod: string | null;
  unvan: string | null;
  sorumlu_id: number;
  sorumlu_ad: string;
  aciklama: string;
  son_tarih: string;
  is_gunu: string;
  durum: 'ACIK' | 'KAPALI' | 'IPTAL';
  sonuc: string | null;
  sonuc_notu: string | null;
  oncelik_sira: number | null;
  gerekce: string | null;
  eskalasyon_seviyesi: number;
  kaynak: string;
  olusma_ts: string;
  kapanma_ts: string | null;
  gecikmis: boolean;
  skor: number | null;
  kademe: number | null;
  kademe_ad: string | null;
  vadesi_gecen: number | null;
  telefon: string | null;
}

export interface CariRisk {
  kod: string;
  unvan: string;
  telefon: string | null;
  temsilci: string | null;
  il: string | null;
  risk_limiti: number;
  vade_gun: number;
  skor: number;
  kademe: number;
  kademe_ad: string;
  bilesenler_json: BilesenKatkisi[];
  b_0_30: number;
  b_31_60: number;
  b_61_90: number;
  b_91_180: number;
  b_180_plus: number;
  vadesi_gelmemis: number;
  toplam_bakiye: number;
  vadesi_gecen: number;
  en_eski_gun: number;
  oncelik_sira: number | null;
  oncelik_gerekce: string | null;
  limit_kullanim_yuzde: number | null;
  son_arama_ts: string | null;
  acik_gorev_adedi: number;
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

export interface SonucSecenegi {
  deger: string;
  etiket: string;
}
