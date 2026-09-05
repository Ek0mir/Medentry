import { mantiksalaCevir, metneCevir, sayiyaCevir, tariheCevir } from './donusturucu.js';
import { eslesmeyiOku, type KumeAdi } from './eslesme.js';
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
 * Mikro MSSQL veritabanından SALT-OKUNUR okuma.
 *
 * İki kural:
 *   1. Bağlantı yalnızca SELECT yetkisi olan bir kullanıcıyla kurulur.
 *      Uygulama Mikro'ya hiçbir koşulda yazmaz.
 *   2. Sorgular burada değil docs/mikro-eslesme.json içinde durur; sonuç
 *      kolonları normalize adlarımıza takma adla döndürülür. Mikro sürüm
 *      atladığında düzeltilecek yer tek: o dosya.
 *
 * `mssql` paketi isteğe bağlı bağımlılıktır; yalnızca bu adapter seçilirse
 * yüklenir, böylece seed/csv ile çalışan kurulumlar onu taşımak zorunda kalmaz.
 */
export interface MssqlSecenekleri {
  sunucu: string;
  port: number;
  veritabani: string;
  kullanici: string;
  parola: string;
  sifreli: boolean;
  eslesmeYolu?: string;
}

type MssqlModulu = {
  connect: (yapilandirma: unknown) => Promise<{
    request: () => { query: (metin: string) => Promise<{ recordset: Record<string, unknown>[] }> };
    close: () => Promise<void>;
  }>;
};

export class MssqlAdapter implements MikroAdapter {
  readonly ad = 'mssql' as const;
  private havuz: Awaited<ReturnType<MssqlModulu['connect']>> | null = null;

  constructor(private readonly secenekler: MssqlSecenekleri) {}

  private async baglan() {
    if (this.havuz) return this.havuz;

    let mssql: MssqlModulu;
    try {
      mssql = (await import('mssql')).default as unknown as MssqlModulu;
    } catch {
      throw new Error(
        'mssql paketi kurulu değil. MIKRO_ADAPTER=mssql kullanmak için: npm i mssql -w apps/server',
      );
    }

    const eksik = (['sunucu', 'veritabani', 'kullanici'] as const).filter(
      (a) => !this.secenekler[a],
    );
    if (eksik.length > 0) {
      throw new Error(`Mikro MSSQL ayarları eksik: ${eksik.join(', ')} (.env dosyasına bakın)`);
    }

    this.havuz = await mssql.connect({
      server: this.secenekler.sunucu,
      port: this.secenekler.port,
      database: this.secenekler.veritabani,
      user: this.secenekler.kullanici,
      password: this.secenekler.parola,
      options: {
        encrypt: this.secenekler.sifreli,
        trustServerCertificate: !this.secenekler.sifreli,
      },
      pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
      requestTimeout: 120_000,
    });
    return this.havuz;
  }

  private async kumeCalistir(kume: KumeAdi, degistir: Record<string, string> = {}) {
    const eslesme = await eslesmeyiOku(this.secenekler.eslesmeYolu);
    const tanim = eslesme.mssql.kumeler[kume];
    if (!tanim?.sorgu) {
      throw new Error(`MSSQL eşlemesinde "${kume}" sorgusu tanımlı değil.`);
    }
    let sorgu = tanim.sorgu;
    for (const [anahtar, deger] of Object.entries(degistir)) {
      sorgu = sorgu.replaceAll(`{${anahtar}}`, deger);
    }
    const havuz = await this.baglan();
    const sonuc = await havuz.request().query(sorgu);
    return sonuc.recordset;
  }

  async saglikKontrolu() {
    try {
      const havuz = await this.baglan();
      await havuz.request().query('SELECT 1 AS kontrol');
      return {
        saglikli: true,
        mesaj: `Mikro MSSQL erişilebilir: ${this.secenekler.sunucu}/${this.secenekler.veritabani}`,
      };
    } catch (hata) {
      return { saglikli: false, mesaj: `Mikro MSSQL bağlantısı kurulamadı: ${(hata as Error).message}` };
    }
  }

  async cariler(): Promise<MikroCari[]> {
    const satirlar = await this.kumeCalistir('cari');
    return satirlar.map((s) => ({
      kod: String(s.kod ?? '').trim(),
      unvan: metneCevir(s.unvan) ?? '(unvan yok)',
      telefon: metneCevir(s.telefon),
      eposta: metneCevir(s.eposta),
      temsilci: metneCevir(s.temsilci),
      riskLimiti: sayiyaCevir(s.riskLimiti),
      vadeGun: Math.round(sayiyaCevir(s.vadeGun)),
      il: metneCevir(s.il),
      aktif: mantiksalaCevir(s.aktif),
    }));
  }

  async acikFaturalar(): Promise<MikroFatura[]> {
    const satirlar = await this.kumeCalistir('fatura');
    return satirlar
      .map((s) => ({
        faturaNo: String(s.faturaNo ?? '').trim(),
        cariKod: String(s.cariKod ?? '').trim(),
        tarih: tariheCevir(s.tarih) ?? '',
        vade: tariheCevir(s.vade) ?? '',
        tutar: sayiyaCevir(s.tutar),
        kalan: sayiyaCevir(s.kalan),
        paraBirimi: metneCevir(s.paraBirimi) ?? 'TRY',
        tip: metneCevir(s.tip) ?? 'SATIS',
      }))
      .filter((f) => f.faturaNo !== '' && f.vade !== '');
  }

  async tahsilatlar(gunGeriye: number): Promise<MikroTahsilat[]> {
    const satirlar = await this.kumeCalistir('tahsilat', { gunGeriye: String(gunGeriye) });
    return satirlar.map((s) => ({
      kaynakNo: metneCevir(s.kaynakNo),
      cariKod: String(s.cariKod ?? '').trim(),
      tarih: tariheCevir(s.tarih) ?? '',
      tutar: sayiyaCevir(s.tutar),
      tip: metneCevir(s.tip) ?? 'HAVALE',
    }));
  }

  async cekler(): Promise<MikroCek[]> {
    const satirlar = await this.kumeCalistir('cek');
    return satirlar.map((s) => ({
      cekNo: String(s.cekNo ?? '').trim(),
      cariKod: String(s.cariKod ?? '').trim(),
      vade: tariheCevir(s.vade) ?? '',
      tutar: sayiyaCevir(s.tutar),
      kesideci: metneCevir(s.kesideci),
      banka: metneCevir(s.banka),
      durum: (metneCevir(s.durum) ?? 'PORTFOYDE').toLocaleUpperCase('tr'),
    }));
  }

  async odemeGecmisi(): Promise<MikroOdemeGecmisi[]> {
    const satirlar = await this.kumeCalistir('odemeGecmisi');
    return satirlar.map((s) => ({
      cariKod: String(s.cariKod ?? '').trim(),
      ortalamaGecikmeGun: sayiyaCevir(s.ortalamaGecikmeGun),
      odenenFaturaAdedi: Math.round(sayiyaCevir(s.odenenFaturaAdedi)),
      gecikmeliAdet: Math.round(sayiyaCevir(s.gecikmeliAdet)),
      pencereAy: Math.round(sayiyaCevir(s.pencereAy, 24)),
    }));
  }

  async karsiliksizlar(): Promise<MikroKarsiliksiz[]> {
    const satirlar = await this.kumeCalistir('karsiliksiz');
    return satirlar.map((s) => ({
      cariKod: String(s.cariKod ?? '').trim(),
      adet: Math.round(sayiyaCevir(s.adet)),
      tutar: sayiyaCevir(s.tutar),
      sonTarih: tariheCevir(s.sonTarih),
    }));
  }

  async cirolar(): Promise<MikroCiro[]> {
    const satirlar = await this.kumeCalistir('ciro');
    return satirlar.map((s) => ({
      cariKod: String(s.cariKod ?? '').trim(),
      son90Gun: sayiyaCevir(s.son90Gun),
      onceki90Gun: sayiyaCevir(s.onceki90Gun),
    }));
  }

  async kapat(): Promise<void> {
    if (this.havuz) {
      await this.havuz.close();
      this.havuz = null;
    }
  }
}
