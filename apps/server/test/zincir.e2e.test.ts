import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/**
 * Uçtan uca zincir testi — Masterbook Bölüm 16'daki prototip zinciri.
 *
 *   Mikro → senkron → yaşlandırma → risk → görev üretimi
 *         → sonuç zorunlu kapatma → eskalasyon merdiveni
 *
 * Gerçek bir PostgreSQL ister:
 *   TEST_DATABASE_URL=postgres://mirfix:mirfix@localhost:5432/mirfix_test npm test
 * Verilmezse bu dosya atlanır (çekirdek testler veritabanına dokunmaz).
 */
const testVeritabani = process.env.TEST_DATABASE_URL;

describe.skipIf(!testVeritabani)('prototip zinciri', () => {
  // İş günü olduğu bilinen sabit bir gün: 2026-09-07 Pazartesi.
  const IS_GUNU = '2026-09-07';

  let havuzuKapat: () => Promise<void>;
  let sorgu: <S extends Record<string, unknown>>(m: string, d?: unknown[]) => Promise<S[]>;
  let isBul: (kod: string) => { calistir(b?: unknown): Promise<{ ozet: string }> } | undefined;
  let gorevKapat: (g: Record<string, unknown>) => Promise<Record<string, unknown>>;
  let eskalasyonTara: (t?: readonly string[]) => Promise<{ yukseltilen: number }>;

  beforeAll(async () => {
    if (!testVeritabani!.includes('test')) {
      throw new Error(
        `Güvenlik: TEST_DATABASE_URL adında "test" geçmeli. Zincir testi veritabanını SIFIRLAR. Verilen: ${testVeritabani}`,
      );
    }

    const havuzModulu = await import('../src/db/havuz.js');
    sorgu = havuzModulu.sorgu as typeof sorgu;
    havuzuKapat = havuzModulu.havuzuKapat;

    // Temiz sayfa: şemayı düşür, geçişleri baştan uygula, tohumla.
    await havuzModulu.sorgu('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const { tohumla } = await import('../src/db/tohum.js');
    await tohumla('test1234');

    ({ isBul } = (await import('../src/jobs/kayit.js')) as unknown as { isBul: typeof isBul });
    const gorevModulu = await import('../src/gorev/servis.js');
    gorevKapat = gorevModulu.gorevKapat as unknown as typeof gorevKapat;
    eskalasyonTara = gorevModulu.eskalasyonTara as unknown as typeof eskalasyonTara;
  });

  afterAll(async () => {
    await havuzuKapat?.();
  });

  async function isiCalistir(kod: string, baglam?: unknown) {
    const is = isBul(kod);
    expect(is, `${kod} tanımlı olmalı`).toBeTruthy();
    return is!.calistir(baglam);
  }

  it('W-01 Mikro’dan veri çeker ve stg_* tablolarını doldurur', async () => {
    await isiCalistir('W-01');

    const [cari] = await sorgu<{ adet: number }>('SELECT count(*)::int AS adet FROM stg_cari');
    const [fatura] = await sorgu<{ adet: number }>('SELECT count(*)::int AS adet FROM stg_fatura');
    expect(cari!.adet).toBeGreaterThan(50);
    expect(fatura!.adet).toBeGreaterThan(100);

    const [log] = await sorgu<{ durum: string }>(
      'SELECT durum FROM stg_senkron_log ORDER BY calisma_id DESC LIMIT 1',
    );
    expect(log!.durum).toBe('BASARILI');
  });

  it('W-01 tekrar çalışınca stg_* birikmez — Mikro tek doğruluk kaynağıdır', async () => {
    const [once] = await sorgu<{ adet: number }>('SELECT count(*)::int AS adet FROM stg_fatura');
    await isiCalistir('W-01');
    const [sonra] = await sorgu<{ adet: number }>('SELECT count(*)::int AS adet FROM stg_fatura');
    expect(sonra!.adet).toBe(once!.adet);
  });

  it('W-02 yaşlandırma, risk skoru ve öncelik sırası üretir', async () => {
    await isiCalistir('W-02', { gun: IS_GUNU });

    const [y] = await sorgu<{ adet: number }>(
      'SELECT count(*)::int AS adet FROM an_yaslandirma WHERE tarih = $1',
      [IS_GUNU],
    );
    expect(y!.adet).toBeGreaterThan(50);

    // Skor 0–100 aralığında ve kademe 1–8 arasında olmalı.
    const [sinir] = await sorgu<{ min_skor: number; max_skor: number; min_k: number; max_k: number }>(
      `SELECT min(skor) min_skor, max(skor) max_skor, min(kademe) min_k, max(kademe) max_k
         FROM an_risk_skor WHERE tarih = $1`,
      [IS_GUNU],
    );
    expect(sinir!.min_skor).toBeGreaterThanOrEqual(0);
    expect(sinir!.max_skor).toBeLessThanOrEqual(100);
    expect(sinir!.min_k).toBeGreaterThanOrEqual(1);
    expect(sinir!.max_k).toBeLessThanOrEqual(8);

    // Her skorun gerekçesi taşınmalı — ekranda "neden bu skor" gösterilebilsin.
    const [bilesen] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM an_risk_skor
        WHERE tarih = $1 AND jsonb_array_length(bilesenler_json) = 5`,
      [IS_GUNU],
    );
    expect(bilesen!.adet).toBe(y!.adet);
  });

  it('W-02 aynı gün tekrar çalışınca mükerrer satır yazmaz', async () => {
    await isiCalistir('W-02', { gun: IS_GUNU });
    const [y] = await sorgu<{ adet: number }>(
      'SELECT count(*)::int AS adet FROM an_yaslandirma WHERE tarih = $1',
      [IS_GUNU],
    );
    const [c] = await sorgu<{ adet: number }>('SELECT count(*)::int AS adet FROM stg_cari');
    expect(y!.adet).toBe(c!.adet);
  });

  it('W-03 arama görevlerini açar ve hepsinin sorumlusu ile son tarihi vardır', async () => {
    await isiCalistir('W-03', { gun: IS_GUNU });

    const gorevler = await sorgu<{ id: number; sorumlu_id: number; son_tarih: Date }>(
      `SELECT id, sorumlu_id, son_tarih FROM op_gorev WHERE tip = 'ARAMA' AND is_gunu = $1`,
      [IS_GUNU],
    );
    expect(gorevler.length).toBe(15); // op_ayar varsayılanı
    for (const g of gorevler) {
      expect(g.sorumlu_id).toBeTruthy();
      expect(g.son_tarih).toBeTruthy();
    }

    // Görev açılışı iz bırakmalı.
    const [hareket] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_gorev_hareket WHERE aksiyon = 'ACILDI'`,
    );
    expect(hareket!.adet).toBe(15);

    // Otomasyon dikişi: her açılan görev outbox'a düşmeli.
    const [olay] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_olay WHERE tur = 'GOREV_ACILDI'`,
    );
    expect(olay!.adet).toBe(15);
  });

  it('W-03 ikinci kez çalışınca mükerrer görev açmaz', async () => {
    await isiCalistir('W-03', { gun: IS_GUNU });
    const [g] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_gorev WHERE tip = 'ARAMA' AND is_gunu = $1`,
      [IS_GUNU],
    );
    expect(g!.adet).toBe(15);
  });

  it('SONUÇSUZ KAPATMA REDDEDİLİR — sistemin en kritik kuralı', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE durum = 'ACIK' ORDER BY id LIMIT 1`,
    );
    const [enes] = await sorgu<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE rol = 'YONETICI' LIMIT 1`,
    );

    const sonuc = await gorevKapat({ gorevId: gorev!.id, kullaniciId: enes!.id });
    expect(sonuc.durum).toBe('gecersiz');
    expect((sonuc.hatalar as string[])[0]).toContain('Sonuç girmeden');

    // Görev hâlâ açık olmalı.
    const [durum] = await sorgu<{ durum: string }>('SELECT durum FROM op_gorev WHERE id = $1', [
      gorev!.id,
    ]);
    expect(durum!.durum).toBe('ACIK');
  });

  it('veritabanı da sonuçsuz kapatmayı reddeder (ikinci emniyet katmanı)', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE durum = 'ACIK' ORDER BY id LIMIT 1`,
    );
    await expect(
      sorgu(`UPDATE op_gorev SET durum = 'KAPALI' WHERE id = $1`, [gorev!.id]),
    ).rejects.toThrow(/op_gorev_kapali_sonuc_zorunlu/);
  });

  it('sonuçla kapatınca görev kapanır ve iz bırakır', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE durum = 'ACIK' ORDER BY id LIMIT 1`,
    );
    const [ferhat] = await sorgu<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE rol = 'SATIS' LIMIT 1`,
    );

    const sonuc = await gorevKapat({
      gorevId: gorev!.id,
      kullaniciId: ferhat!.id,
      sonuc: 'ULASILDI',
      sonucNotu: 'Muhasebe ile görüşüldü, hafta içi ödeyecekler.',
    });
    expect(sonuc.durum).toBe('kapandi');

    const [kapali] = await sorgu<{ durum: string; sonuc: string; kapanma_ts: Date }>(
      'SELECT durum, sonuc, kapanma_ts FROM op_gorev WHERE id = $1',
      [gorev!.id],
    );
    expect(kapali!.durum).toBe('KAPALI');
    expect(kapali!.sonuc).toBe('ULASILDI');
    expect(kapali!.kapanma_ts).toBeTruthy();

    const [hareket] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_gorev_hareket WHERE gorev_id = $1 AND aksiyon = 'KAPATILDI'`,
      [gorev!.id],
    );
    expect(hareket!.adet).toBe(1);
  });

  it('ödeme sözü kaydedilir ve takip görevi kendiliğinden açılır', async () => {
    const [gorev] = await sorgu<{ id: number; cari_kod: string }>(
      `SELECT id, cari_kod FROM op_gorev WHERE durum = 'ACIK' AND tip = 'ARAMA' ORDER BY id LIMIT 1`,
    );
    const [ferhat] = await sorgu<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE rol = 'SATIS' LIMIT 1`,
    );

    const bugunIso = new Date().toISOString().slice(0, 10);
    const sozTarihi = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

    const sonuc = await gorevKapat({
      gorevId: gorev!.id,
      kullaniciId: ferhat!.id,
      sonuc: 'ODEME_SOZU',
      sozTarihi,
      sozTutari: 75_000,
      sonucNotu: `Görüşme ${bugunIso}, ${sozTarihi} tarihinde ödeme sözü.`,
    });
    expect(sonuc.durum).toBe('kapandi');
    expect(sonuc.takipGoreviId).toBeTruthy();

    const [soz] = await sorgu<{ soz_tutari: number; gerceklesti: boolean | null }>(
      'SELECT soz_tutari, gerceklesti FROM op_odeme_sozu WHERE gorev_id = $1',
      [gorev!.id],
    );
    expect(soz!.soz_tutari).toBe(75_000);
    expect(soz!.gerceklesti).toBeNull(); // henüz kontrol edilmedi

    // Takip görevi söz tarihinin ertesi gününe kurulmalı — söz görünmez kalmasın.
    const [takip] = await sorgu<{ tip: string; is_gunu: string; cari_kod: string }>(
      'SELECT tip, is_gunu, cari_kod FROM op_gorev WHERE id = $1',
      [sonuc.takipGoreviId],
    );
    expect(takip!.tip).toBe('ODEME_SOZU');
    expect(takip!.cari_kod).toBe(gorev!.cari_kod);
    const ertesi = new Date(new Date(sozTarihi).getTime() + 86_400_000).toISOString().slice(0, 10);
    expect(takip!.is_gunu).toBe(ertesi);
  });

  it('geçmiş tarihli ödeme sözü reddedilir', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE durum = 'ACIK' AND tip = 'ARAMA' ORDER BY id LIMIT 1`,
    );
    const [ferhat] = await sorgu<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE rol = 'SATIS' LIMIT 1`,
    );
    const sonuc = await gorevKapat({
      gorevId: gorev!.id,
      kullaniciId: ferhat!.id,
      sonuc: 'ODEME_SOZU',
      sozTarihi: '2020-01-01',
      sozTutari: 1000,
    });
    expect(sonuc.durum).toBe('gecersiz');
  });

  it('süresi geçen görev merdivenden yükselir ve her basamak kaydedilir', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE durum = 'ACIK' AND tip = 'ARAMA' ORDER BY id DESC LIMIT 1`,
    );

    // Son tarihi 2 saat geriye al → seviye 1.
    await sorgu(`UPDATE op_gorev SET son_tarih = now() - interval '2 hours' WHERE id = $1`, [
      gorev!.id,
    ]);
    await eskalasyonTara(['ARAMA']);

    let [durum] = await sorgu<{ eskalasyon_seviyesi: number }>(
      'SELECT eskalasyon_seviyesi FROM op_gorev WHERE id = $1',
      [gorev!.id],
    );
    expect(durum!.eskalasyon_seviyesi).toBe(1);

    // 10 GÜN geriye al → seviye 3.
    //
    // Neden duvar saatiyle "30 saat" değil: eskalasyon İŞ SAATİ sayar, hafta
    // sonu merdiveni durdurur. Cuma akşamı biten bir iş için 30 duvar saati
    // ~20 iş saatidir ve seviye 2'ye HENÜZ ulaşmaz — bu kasıtlı davranış.
    // Testin haftanın hangi gününde koştuğundan bağımsız olması için, eşiği
    // her koşulda aşan bir aralık seçiyoruz. Eşiklerin tam sınırları
    // eskalasyon.test.ts'te sabit tarihlerle ayrıca doğrulanıyor.
    await sorgu(`UPDATE op_gorev SET son_tarih = now() - interval '10 days' WHERE id = $1`, [
      gorev!.id,
    ]);
    await eskalasyonTara(['ARAMA']);

    [durum] = await sorgu<{ eskalasyon_seviyesi: number }>(
      'SELECT eskalasyon_seviyesi FROM op_gorev WHERE id = $1',
      [gorev!.id],
    );
    expect(durum!.eskalasyon_seviyesi).toBe(3);

    // Atlanan basamaklar da kayda geçer: "hangi iş nereye, ne zaman, neden
    // çıktı" sorusunun cevabı eksiksiz olmalı.
    const seviyeler = await sorgu<{ seviye: number; hedef_id: number; gerekce: string }>(
      `SELECT seviye, hedef_id, gerekce FROM op_eskalasyon
        WHERE kaynak_tip = 'GOREV' AND kaynak_id = $1 ORDER BY seviye`,
      [gorev!.id],
    );
    expect(seviyeler.map((s) => s.seviye)).toEqual([1, 2, 3]);
    expect(seviyeler[1]!.gerekce).toContain('24 iş saati');

    // Seviye 2 yöneticiye, seviye 3 üst onaya gitmeli (Bölüm 05 merdiveni).
    const [yonetici] = await sorgu<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE rol = 'YONETICI' LIMIT 1`,
    );
    const [ustOnay] = await sorgu<{ id: number }>(
      `SELECT id FROM op_kullanici WHERE rol = 'UST_ONAY' LIMIT 1`,
    );
    expect(seviyeler[1]!.hedef_id).toBe(yonetici!.id);
    expect(seviyeler[2]!.hedef_id).toBe(ustOnay!.id);

    // Her yükselme görev geçmişine de yazılmalı.
    const [hareket] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_gorev_hareket
        WHERE gorev_id = $1 AND aksiyon = 'ESKALASYON'`,
      [gorev!.id],
    );
    expect(hareket!.adet).toBe(3);
  });

  it('aynı seviyeye iki kez çıkılmaz', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE eskalasyon_seviyesi = 3 ORDER BY id LIMIT 1`,
    );
    const [once] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_eskalasyon WHERE kaynak_id = $1`,
      [gorev!.id],
    );
    await eskalasyonTara(['ARAMA']);
    const [sonra] = await sorgu<{ adet: number }>(
      `SELECT count(*)::int AS adet FROM op_eskalasyon WHERE kaynak_id = $1`,
      [gorev!.id],
    );
    expect(sonra!.adet).toBe(once!.adet);
  });

  it('kapatılan görev merdivende yükselmez — merdiven kapanınca durur', async () => {
    const [gorev] = await sorgu<{ id: number }>(
      `SELECT id FROM op_gorev WHERE durum = 'KAPALI' ORDER BY id LIMIT 1`,
    );
    await sorgu(`UPDATE op_gorev SET son_tarih = now() - interval '100 hours' WHERE id = $1`, [
      gorev!.id,
    ]);
    await eskalasyonTara();

    const [durum] = await sorgu<{ eskalasyon_seviyesi: number }>(
      'SELECT eskalasyon_seviyesi FROM op_gorev WHERE id = $1',
      [gorev!.id],
    );
    expect(durum!.eskalasyon_seviyesi).toBe(0);
  });

  it('raporlama view’ları çalışır', async () => {
    const risk = await sorgu<{ kod: string; skor: number }>(
      'SELECT kod, skor FROM rpt_cari_risk ORDER BY skor DESC LIMIT 5',
    );
    expect(risk.length).toBe(5);
    expect(risk[0]!.skor).toBeGreaterThanOrEqual(risk[4]!.skor);

    const kapanma = await sorgu<{ kapanma_orani: number }>(
      'SELECT kapanma_orani FROM rpt_gorev_kapanma WHERE is_gunu = $1',
      [IS_GUNU],
    );
    expect(kapanma.length).toBeGreaterThan(0);
  });
});
