import { createHash, randomBytes } from 'node:crypto';
// @fastify/cookie'nin tip genişletmesi (request.cookies / unsignCookie) için gerekli.
import '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ayarlar } from '../ayarlar.js';
import { sorgu, tekSatir } from '../db/havuz.js';

/**
 * İki kimlik yolu:
 *   1. Panel  → imzalı oturum çerezi (op_oturum)
 *   2. Otomasyon / veri çekme → X-API-Key başlığı (op_api_anahtari)
 *
 * İkisi de aynı yetki modeline (Bölüm 11 rol matrisi) bağlanır; API'nin
 * dışarıya açılması ayrı bir yetki sistemi doğurmaz.
 */

export const OTURUM_CEREZI = 'mirfix_oturum';
const OTURUM_OMRU_SAAT = 12;

export type Rol = 'YONETICI' | 'UST_ONAY' | 'SATIS' | 'MUHASEBE' | 'SEVKIYAT';

export interface Kimlik {
  kullaniciId: number | null;
  ad: string;
  rol: Rol;
  kaynak: 'oturum' | 'api-anahtari';
  /** Mikro cari kartındaki temsilci karşılığı; boşsa portföy süzgeci uygulanmaz. */
  mikroTemsilci?: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    kimlik?: Kimlik;
  }
}

export function anahtarOzetle(anahtar: string): string {
  return createHash('sha256').update(anahtar).digest('hex');
}

export async function oturumAc(kullaniciId: number): Promise<{ id: string; bitis: Date }> {
  const id = randomBytes(32).toString('hex');
  const bitis = new Date(Date.now() + OTURUM_OMRU_SAAT * 3_600_000);
  await sorgu('INSERT INTO op_oturum (id, kullanici_id, bitis_ts) VALUES ($1, $2, $3)', [
    id,
    kullaniciId,
    bitis,
  ]);
  return { id, bitis };
}

export async function oturumKapat(id: string): Promise<void> {
  await sorgu('DELETE FROM op_oturum WHERE id = $1', [id]);
}

/** Süresi dolmuş oturumları temizler (girişte tetiklenir, ayrı iş gerektirmez). */
export async function eskiOturumlariSil(): Promise<void> {
  await sorgu('DELETE FROM op_oturum WHERE bitis_ts < now()');
}

async function cerezdenKimlik(istek: FastifyRequest): Promise<Kimlik | null> {
  const ham = istek.cookies[OTURUM_CEREZI];
  if (!ham) return null;

  const cozulmus = istek.unsignCookie(ham);
  if (!cozulmus.valid || !cozulmus.value) return null;

  const satir = await tekSatir<{
    kullanici_id: number;
    ad: string;
    rol: Rol;
    mikro_temsilci: string | null;
  }>(
    `SELECT o.kullanici_id, k.ad, k.rol, k.mikro_temsilci
       FROM op_oturum o JOIN op_kullanici k ON k.id = o.kullanici_id
      WHERE o.id = $1 AND o.bitis_ts > now() AND k.aktif`,
    [cozulmus.value],
  );
  if (!satir) return null;

  await sorgu('UPDATE op_oturum SET son_erisim_ts = now() WHERE id = $1', [cozulmus.value]);
  return {
    kullaniciId: satir.kullanici_id,
    ad: satir.ad,
    rol: satir.rol,
    kaynak: 'oturum',
    mikroTemsilci: satir.mikro_temsilci ?? satir.ad,
  };
}

async function anahtardanKimlik(istek: FastifyRequest): Promise<Kimlik | null> {
  const ham = istek.headers['x-api-key'];
  const anahtar = Array.isArray(ham) ? ham[0] : ham;
  if (!anahtar) return null;

  const satir = await tekSatir<{ id: number; ad: string; rol: Rol }>(
    'SELECT id, ad, rol FROM op_api_anahtari WHERE anahtar_hash = $1 AND aktif',
    [anahtarOzetle(anahtar)],
  );
  if (!satir) return null;

  await sorgu('UPDATE op_api_anahtari SET son_kullanim_ts = now() WHERE id = $1', [satir.id]);
  return { kullaniciId: null, ad: `API: ${satir.ad}`, rol: satir.rol, kaynak: 'api-anahtari' };
}

/** Her istekte kimliği çözer; yetki kontrolü ayrı yapılır. */
export async function kimligiCoz(istek: FastifyRequest): Promise<void> {
  istek.kimlik = (await cerezdenKimlik(istek)) ?? (await anahtardanKimlik(istek)) ?? undefined;
}

/**
 * Rol kontrolü. Roller verilmezse yalnızca giriş yapılmış olması yeterli.
 * Masterbook Bölüm 11 matrisi bu fonksiyona verilen rollerle kurulur.
 */
export function yetkiGerek(roller?: readonly Rol[]) {
  return async (istek: FastifyRequest, yanit: FastifyReply) => {
    if (!istek.kimlik) {
      return yanit.code(401).send({ hata: 'Giriş yapılmamış.' });
    }
    if (roller && roller.length > 0 && !roller.includes(istek.kimlik.rol)) {
      return yanit
        .code(403)
        .send({ hata: `Bu işlem için yetkiniz yok (gereken rol: ${roller.join(', ')}).` });
    }
  };
}

export function cerezSecenekleri(bitis: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    // LAN içinde HTTP kullanılıyor; HTTPS'e geçilirse burası true olmalı.
    secure: ayarlar.NODE_ENV === 'production' && process.env.HTTPS === '1',
    signed: true,
    expires: bitis,
  };
}

/**
 * SATIS rolü yalnızca kendi portföyünü görür (Bölüm 11). Yönetici ve üst onay
 * her şeyi görür; diğer roller görev üzerinden çalıştığı için süzülmez.
 *
 * Eşleme tutmuyorsa (Mikro'daki temsilci adı panel kullanıcısının adından
 * farklıysa) süzgeç UYGULANMAZ ve çağıran tarafa uyarı döner. Sessizce boş
 * liste göstermek, kullanıcının sistemin bozuk olduğunu düşünmesine yol açar.
 */
export function temsilciSuzgeci(kimlik: Kimlik): string | null {
  if (kimlik.rol !== 'SATIS' || kimlik.kaynak !== 'oturum') return null;
  return kimlik.mikroTemsilci?.trim() || null;
}
