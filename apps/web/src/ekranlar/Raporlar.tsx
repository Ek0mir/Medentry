import { indir } from '../api/istemci.js';
import { useOzet, useRapor } from '../api/kancalar.js';
import { CubukListesi, TrendCizgisi, YaslandirmaCubugu } from '../bilesenler/Grafikler.jsx';
import { BosDurum, Hata, Olcu, Yukleniyor } from '../bilesenler/Ortak.jsx';
import { BANT_TANIMLARI, para, paraKisa, sayi, tarih } from '../bilesenler/bicim.js';

/**
 * Raporlar ekranı — masterbook Bölüm 15'teki başarı kriterlerini ölçen sayılar.
 * Her rapor CSV/Excel olarak da indirilebilir; aynı veriyi dışarıdan API ile
 * çekmek de mümkün (Yönetim → API anahtarları).
 */
export function Raporlar() {
  const ozet = useOzet();
  const yaslandirma = useRapor<Record<string, number | string>>('yaslandirma');
  const kapanma = useRapor<Record<string, number | string>>('kapanma-orani');
  const dso = useRapor<Record<string, number | string>>('dso');

  if (ozet.isLoading) return <Yukleniyor />;
  if (ozet.isError) return <Hata hata={ozet.error} />;

  const y = ozet.data?.yaslandirma;
  const d = ozet.data?.dso;
  const k = ozet.data?.kademe;

  // Trendler eskiden yeniye çizilsin.
  const bakiyeTrend = [...(yaslandirma.data?.satirlar ?? [])]
    .reverse()
    .map((s) => ({ tarih: String(s.tarih), etiket: tarih(String(s.tarih)), deger: Number(s.toplam) }));
  const dsoTrend = [...(dso.data?.satirlar ?? [])]
    .reverse()
    .filter((s) => s.dso_gun !== null)
    .map((s) => ({ tarih: String(s.tarih), etiket: tarih(String(s.tarih)), deger: Number(s.dso_gun) }));

  // Kapanma oranı: gün bazında topla (tip ve kişi kırılımını birleştir).
  const gunlukKapanma = new Map<string, { acilan: number; kapanan: number }>();
  for (const satir of kapanma.data?.satirlar ?? []) {
    const gun = String(satir.is_gunu);
    const mevcut = gunlukKapanma.get(gun) ?? { acilan: 0, kapanan: 0 };
    mevcut.acilan += Number(satir.acilan);
    mevcut.kapanan += Number(satir.kapanan);
    gunlukKapanma.set(gun, mevcut);
  }
  const kapanmaTrend = [...gunlukKapanma.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gun, s]) => ({
      tarih: gun,
      etiket: tarih(gun),
      deger: s.acilan === 0 ? 0 : Math.round((s.kapanan / s.acilan) * 1000) / 10,
    }));

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>Raporlar</h1>
          <p className="alt-metin">
            Masterbook Bölüm 15’teki beş başarı göstergesi. Faz 1 sonunda başlangıç değerleri kaydedilir.
          </p>
        </div>
      </div>

      <div className="olcu-serit">
        <Olcu
          etiket="Ortalama tahsilat süresi"
          deger={d?.dso_gun ? `${sayi(d.dso_gun, 1)} gün` : '—'}
          not="13. hafta hedefi: −%10"
        />
        <Olcu
          etiket="90 gün üzeri bakiye"
          deger={paraKisa(y?.doksan_gun_ustu)}
          not="Hedef: azalış"
          vurgu="uyari"
        />
        <Olcu
          etiket="Sevk durdurma ve üstü"
          deger={sayi(k?.sevk_durdurma_ustu)}
          not={`${sayi(k?.toplam_cari)} cari içinde`}
          vurgu={k?.sevk_durdurma_ustu ? 'kritik' : 'iyi'}
        />
        <Olcu
          etiket="Toplam açık bakiye"
          deger={paraKisa(y?.toplam)}
          not={y ? `${sayi(y.cari_adedi)} cari` : undefined}
        />
      </div>

      <div className="kart">
        <div className="baslik-satiri" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Yaşlandırma dağılımı</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="dugme ikincil kucuk" onClick={() => indir('/raporlar/yaslandirma', 'csv')}>
              CSV
            </button>
            <button className="dugme ikincil kucuk" onClick={() => indir('/raporlar/yaslandirma', 'xlsx')}>
              Excel
            </button>
          </div>
        </div>
        {y ? <YaslandirmaCubugu veri={y} /> : <BosDurum baslik="Henüz yaşlandırma verisi yok." />}

        {/* Grafiğin tablo karşılığı: sayıyı okumak isteyen grafiğe muhtaç kalmasın. */}
        {y && (
          <div className="tablo-sar" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Bant</th>
                  <th>Gerektirdiği aksiyon</th>
                  <th className="sayi">Tutar</th>
                  <th className="sayi">Pay</th>
                </tr>
              </thead>
              <tbody>
                {BANT_TANIMLARI.map((b) => {
                  const tutar = y[b.anahtar];
                  const vadesiGecen =
                    y.b_0_30 + y.b_31_60 + y.b_61_90 + y.b_91_180 + y.b_180_plus;
                  return (
                    <tr key={b.anahtar}>
                      <td>
                        <span
                          className="gosterge-kutu"
                          style={{ background: b.renk, display: 'inline-block', marginRight: 7 }}
                          aria-hidden="true"
                        />
                        {b.ad}
                      </td>
                      <td style={{ color: 'var(--gri)' }}>{b.aksiyon}</td>
                      <td className="sayi">{para(tutar)}</td>
                      <td className="sayi">
                        {vadesiGecen > 0 ? `%${((tutar / vadesiGecen) * 100).toFixed(1)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="kart">
          <h2>Görev kapanma oranı</h2>
          {kapanmaTrend.length >= 2 ? (
            <TrendCizgisi noktalar={kapanmaTrend} bicimlendir={(n) => sayi(n, 1)} birim="%" />
          ) : (
            <p className="alt-metin">
              Trend için en az iki iş günü verisi gerekli. Şu an{' '}
              {kapanmaTrend.length === 1 ? `%${sayi(kapanmaTrend[0]!.deger, 1)}` : 'veri yok'}.
            </p>
          )}
          <p className="alt-metin" style={{ marginTop: 8 }}>Hedef: %85 ve üzeri.</p>
        </div>

        <div className="kart">
          <h2>Toplam açık bakiye trendi</h2>
          {bakiyeTrend.length >= 2 ? (
            <TrendCizgisi noktalar={bakiyeTrend} bicimlendir={(n) => paraKisa(n)} />
          ) : (
            <p className="alt-metin">Trend için en az iki günlük veri gerekli.</p>
          )}
        </div>

        <div className="kart">
          <h2>Ortalama tahsilat süresi (DSO)</h2>
          {dsoTrend.length >= 2 ? (
            <TrendCizgisi noktalar={dsoTrend} bicimlendir={(n) => sayi(n, 1)} birim=" gün" />
          ) : (
            <p className="alt-metin">Trend için en az iki günlük veri gerekli.</p>
          )}
        </div>
      </div>

      <div className="kart">
        <div className="baslik-satiri" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Kişi bazlı kapanma</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="dugme ikincil kucuk" onClick={() => indir('/raporlar/kapanma-orani', 'csv')}>
              CSV
            </button>
            <button className="dugme ikincil kucuk" onClick={() => indir('/raporlar/kapanma-orani', 'xlsx')}>
              Excel
            </button>
          </div>
        </div>
        {(kapanma.data?.satirlar.length ?? 0) === 0 ? (
          <BosDurum baslik="Henüz kapanma verisi yok." />
        ) : (
          <CubukListesi
            satirlar={(kapanma.data?.satirlar ?? []).slice(0, 12).map((s) => ({
              etiket: `${String(s.sorumlu_ad)} · ${tarih(String(s.is_gunu))}`,
              deger: Number(s.kapanma_orani ?? 0),
              not: `${s.kapanan}/${s.acilan} ${s.tip}`,
              renk:
                Number(s.kapanma_orani) >= 85
                  ? 'var(--durum-iyi)'
                  : Number(s.kapanma_orani) >= 50
                    ? 'var(--durum-uyari)'
                    : 'var(--durum-kritik)',
            }))}
            bicimlendir={(n) => `%${sayi(n, 1)}`}
          />
        )}
      </div>
    </>
  );
}
