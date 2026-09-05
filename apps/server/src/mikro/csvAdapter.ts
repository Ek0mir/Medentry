import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { csvCoz, mantiksalaCevir, metneCevir, sayiyaCevir, tariheCevir } from './donusturucu.js';
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
 * Mikro'dan alınan CSV/Excel export'larını okur.
 *
 * Masterbook Bölüm 16'daki başlangıç kuralının karşılığı: Faz 1'de veri manuel
 * export ile beslenebilir, sunucu erişimi beklenmez. Ama bu kalıcı hale
 * gelmemeli — Faz 2'den önce mssql adapter'a geçilir.
 */
export interface CsvSecenekleri {
  dizin: string;
  eslesmeYolu?: string;
}

export class CsvAdapter implements MikroAdapter {
  readonly ad = 'csv' as const;

  constructor(private readonly secenekler: CsvSecenekleri) {}

  async saglikKontrolu() {
    try {
      const eslesme = await eslesmeyiOku(this.secenekler.eslesmeYolu);
      const eksikler: string[] = [];
      for (const [kume, tanim] of Object.entries(eslesme.csv.kumeler)) {
        try {
          await readFile(join(this.secenekler.dizin, tanim.dosya), 'utf8');
        } catch {
          eksikler.push(`${kume} (${tanim.dosya})`);
        }
      }
      return eksikler.length === 0
        ? { saglikli: true, mesaj: `CSV dizini okunabilir: ${this.secenekler.dizin}` }
        : { saglikli: false, mesaj: `Eksik export dosyaları: ${eksikler.join(', ')}` };
    } catch (hata) {
      return { saglikli: false, mesaj: (hata as Error).message };
    }
  }

  private async kumeOku(kume: KumeAdi): Promise<{ satir: (alan: string) => string }[]> {
    const eslesme = await eslesmeyiOku(this.secenekler.eslesmeYolu);
    const tanim = eslesme.csv.kumeler[kume];
    if (!tanim) throw new Error(`CSV eşlemesinde "${kume}" kümesi tanımlı değil.`);

    const yol = join(this.secenekler.dizin, tanim.dosya);
    let icerik: string;
    try {
      icerik = await readFile(yol, 'utf8');
    } catch (hata) {
      throw new Error(`Export dosyası okunamadı: ${yol} — ${(hata as Error).message}`);
    }

    const satirlar = csvCoz(icerik, eslesme.csv.ayirici);
    return satirlar.map((satir) => ({
      satir: (alan: string) => {
        const kolon = tanim.alanlar[alan];
        if (!kolon) return '';
        return satir[kolon] ?? '';
      },
    }));
  }

  async cariler(): Promise<MikroCari[]> {
    const satirlar = await this.kumeOku('cari');
    return satirlar
      .map(({ satir }) => ({
        kod: String(satir('kod')).trim(),
        unvan: metneCevir(satir('unvan')) ?? '(unvan yok)',
        telefon: metneCevir(satir('telefon')),
        eposta: metneCevir(satir('eposta')),
        temsilci: metneCevir(satir('temsilci')),
        riskLimiti: sayiyaCevir(satir('riskLimiti')),
        vadeGun: Math.round(sayiyaCevir(satir('vadeGun'))),
        il: metneCevir(satir('il')),
        aktif: mantiksalaCevir(satir('aktif')),
      }))
      .filter((c) => c.kod !== '');
  }

  async acikFaturalar(): Promise<MikroFatura[]> {
    const satirlar = await this.kumeOku('fatura');
    return satirlar
      .map(({ satir }) => {
        const tarih = tariheCevir(satir('tarih'));
        const vade = tariheCevir(satir('vade'));
        return {
          faturaNo: String(satir('faturaNo')).trim(),
          cariKod: String(satir('cariKod')).trim(),
          tarih: tarih ?? vade ?? '',
          vade: vade ?? tarih ?? '',
          tutar: sayiyaCevir(satir('tutar')),
          kalan: sayiyaCevir(satir('kalan')),
          paraBirimi: metneCevir(satir('paraBirimi')) ?? 'TRY',
          tip: metneCevir(satir('tip')) ?? 'SATIS',
        };
      })
      .filter((f) => f.faturaNo !== '' && f.cariKod !== '' && f.vade !== '');
  }

  async tahsilatlar(gunGeriye: number): Promise<MikroTahsilat[]> {
    const satirlar = await this.kumeOku('tahsilat');
    const sinir = new Date();
    sinir.setDate(sinir.getDate() - gunGeriye);
    const sinirIso = sinir.toISOString().slice(0, 10);

    return satirlar
      .map(({ satir }) => ({
        kaynakNo: metneCevir(satir('kaynakNo')),
        cariKod: String(satir('cariKod')).trim(),
        tarih: tariheCevir(satir('tarih')) ?? '',
        tutar: sayiyaCevir(satir('tutar')),
        tip: metneCevir(satir('tip')) ?? 'HAVALE',
      }))
      .filter((t) => t.cariKod !== '' && t.tarih >= sinirIso);
  }

  async cekler(): Promise<MikroCek[]> {
    const satirlar = await this.kumeOku('cek');
    return satirlar
      .map(({ satir }) => ({
        cekNo: String(satir('cekNo')).trim(),
        cariKod: String(satir('cariKod')).trim(),
        vade: tariheCevir(satir('vade')) ?? '',
        tutar: sayiyaCevir(satir('tutar')),
        kesideci: metneCevir(satir('kesideci')),
        banka: metneCevir(satir('banka')),
        durum: (metneCevir(satir('durum')) ?? 'PORTFOYDE').toLocaleUpperCase('tr'),
      }))
      .filter((c) => c.cekNo !== '' && c.vade !== '');
  }

  async odemeGecmisi(): Promise<MikroOdemeGecmisi[]> {
    const satirlar = await this.kumeOku('odemeGecmisi');
    return satirlar
      .map(({ satir }) => ({
        cariKod: String(satir('cariKod')).trim(),
        ortalamaGecikmeGun: sayiyaCevir(satir('ortalamaGecikmeGun')),
        odenenFaturaAdedi: Math.round(sayiyaCevir(satir('odenenFaturaAdedi'))),
        gecikmeliAdet: Math.round(sayiyaCevir(satir('gecikmeliAdet'))),
        pencereAy: Math.round(sayiyaCevir(satir('pencereAy'), 24)),
      }))
      .filter((s) => s.cariKod !== '');
  }

  async karsiliksizlar(): Promise<MikroKarsiliksiz[]> {
    const satirlar = await this.kumeOku('karsiliksiz');
    return satirlar
      .map(({ satir }) => ({
        cariKod: String(satir('cariKod')).trim(),
        adet: Math.round(sayiyaCevir(satir('adet'))),
        tutar: sayiyaCevir(satir('tutar')),
        sonTarih: tariheCevir(satir('sonTarih')),
      }))
      .filter((s) => s.cariKod !== '');
  }

  async cirolar(): Promise<MikroCiro[]> {
    const satirlar = await this.kumeOku('ciro');
    return satirlar
      .map(({ satir }) => ({
        cariKod: String(satir('cariKod')).trim(),
        son90Gun: sayiyaCevir(satir('son90Gun')),
        onceki90Gun: sayiyaCevir(satir('onceki90Gun')),
      }))
      .filter((s) => s.cariKod !== '');
  }
}
