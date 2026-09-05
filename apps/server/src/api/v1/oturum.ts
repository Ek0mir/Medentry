import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sorgu, tekSatir } from '../../db/havuz.js';
import { sifreDogrula, sifreOzetle } from '../../kimlik/sifre.js';
import {
  cerezSecenekleri,
  eskiOturumlariSil,
  OTURUM_CEREZI,
  oturumAc,
  oturumKapat,
  yetkiGerek,
  type Rol,
} from '../kimlik.js';

const girisSemasi = z.object({
  kullaniciAdi: z.string().min(1),
  parola: z.string().min(1),
});

const parolaSemasi = z.object({
  mevcutParola: z.string().min(1),
  yeniParola: z.string().min(8, 'Yeni parola en az 8 karakter olmalı.'),
});

export async function oturumRotalari(sunucu: FastifyInstance): Promise<void> {
  sunucu.post('/oturum', async (istek, yanit) => {
    const cozum = girisSemasi.safeParse(istek.body);
    if (!cozum.success) return yanit.code(400).send({ hata: 'Kullanıcı adı ve parola gerekli.' });

    const kullanici = await tekSatir<{ id: number; ad: string; rol: Rol; sifre_hash: string }>(
      'SELECT id, ad, rol, sifre_hash FROM op_kullanici WHERE kullanici_adi = $1 AND aktif',
      [cozum.data.kullaniciAdi.toLocaleLowerCase('tr')],
    );

    // Kullanıcı yoksa da parola doğrulama maliyeti ödenir: yanıt süresinden
    // kullanıcı adının var olup olmadığı anlaşılmasın.
    const gecerli = kullanici
      ? await sifreDogrula(cozum.data.parola, kullanici.sifre_hash)
      : await sifreDogrula(cozum.data.parola, await sifreOzetle('sahte'));

    if (!kullanici || !gecerli) {
      return yanit.code(401).send({ hata: 'Kullanıcı adı veya parola hatalı.' });
    }

    await eskiOturumlariSil();
    const oturum = await oturumAc(kullanici.id);
    return yanit
      .setCookie(OTURUM_CEREZI, oturum.id, cerezSecenekleri(oturum.bitis))
      .send({ id: kullanici.id, ad: kullanici.ad, rol: kullanici.rol });
  });

  sunucu.delete('/oturum', async (istek, yanit) => {
    const ham = istek.cookies[OTURUM_CEREZI];
    if (ham) {
      const cozulmus = istek.unsignCookie(ham);
      if (cozulmus.valid && cozulmus.value) await oturumKapat(cozulmus.value);
    }
    return yanit.clearCookie(OTURUM_CEREZI, { path: '/' }).send({ durum: 'çıkış yapıldı' });
  });

  /** Panelin açılışta "kimim, neyi görebilirim" sorusunu sorduğu uç. */
  sunucu.get('/oturum/ben', { preHandler: yetkiGerek() }, async (istek) => ({
    kullaniciId: istek.kimlik!.kullaniciId,
    ad: istek.kimlik!.ad,
    rol: istek.kimlik!.rol,
    kaynak: istek.kimlik!.kaynak,
  }));

  sunucu.post('/oturum/parola', { preHandler: yetkiGerek() }, async (istek, yanit) => {
    const kimlik = istek.kimlik!;
    if (kimlik.kaynak !== 'oturum' || !kimlik.kullaniciId) {
      return yanit.code(403).send({ hata: 'Parola yalnızca panelden değiştirilebilir.' });
    }

    const cozum = parolaSemasi.safeParse(istek.body);
    if (!cozum.success) {
      return yanit.code(422).send({ hata: cozum.error.issues[0]?.message ?? 'Geçersiz istek.' });
    }

    const kullanici = await tekSatir<{ sifre_hash: string }>(
      'SELECT sifre_hash FROM op_kullanici WHERE id = $1',
      [kimlik.kullaniciId],
    );
    if (!kullanici || !(await sifreDogrula(cozum.data.mevcutParola, kullanici.sifre_hash))) {
      return yanit.code(401).send({ hata: 'Mevcut parola hatalı.' });
    }

    await sorgu('UPDATE op_kullanici SET sifre_hash = $2 WHERE id = $1', [
      kimlik.kullaniciId,
      await sifreOzetle(cozum.data.yeniParola),
    ]);
    // Parola değişince diğer oturumlar düşsün.
    await sorgu('DELETE FROM op_oturum WHERE kullanici_id = $1', [kimlik.kullaniciId]);
    return yanit.clearCookie(OTURUM_CEREZI, { path: '/' }).send({ durum: 'parola değiştirildi' });
  });
}
