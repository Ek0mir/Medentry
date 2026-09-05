import { Link, useParams } from 'react-router-dom';
import { useCariDetay } from '../api/kancalar.js';
import { SkorKirilimi, TrendCizgisi, YaslandirmaCubugu } from '../bilesenler/Grafikler.jsx';
import { BosDurum, Hata, KademeRozeti, Olcu, Yukleniyor } from '../bilesenler/Ortak.jsx';
import { para, paraKisa, sayi, tarih, tarihSaat } from '../bilesenler/bicim.js';

export function CariDetay() {
  const { kod } = useParams<{ kod: string }>();
  const detay = useCariDetay(kod);

  if (detay.isLoading) return <Yukleniyor />;
  if (detay.isError) return <Hata hata={detay.error} />;

  const { cari, faturalar, cekler, gorevler, odemeSozleri, yaslandirmaGecmisi } = detay.data!;

  // Trend eskiden yeniye çizilsin (API en yeniyi başa koyuyor).
  const trend = [...yaslandirmaGecmisi]
    .reverse()
    .map((s) => ({ tarih: String(s.tarih), etiket: tarih(String(s.tarih)), deger: Number(s.toplam) }));

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>{cari.unvan}</h1>
          <p className="alt-metin mono">
            {cari.kod}
            {cari.temsilci ? ` · ${cari.temsilci}` : ''}
            {cari.il ? ` · ${cari.il}` : ''}
            {cari.telefon ? ` · ${cari.telefon}` : ''}
          </p>
        </div>
        <Link to="/cariler" className="dugme ikincil kucuk">
          ← Cari listesi
        </Link>
      </div>

      <div className="olcu-serit">
        <Olcu
          etiket="Risk skoru"
          deger={sayi(cari.skor, 1)}
          not={<KademeRozeti kademe={cari.kademe} ad={cari.kademe_ad} />}
          vurgu={cari.kademe >= 7 ? 'kritik' : cari.kademe >= 5 ? 'uyari' : 'iyi'}
        />
        <Olcu etiket="Vadesi geçen" deger={paraKisa(cari.vadesi_gecen)} not={para(cari.vadesi_gecen)} />
        <Olcu
          etiket="Risk limiti"
          deger={paraKisa(cari.risk_limiti)}
          not={
            cari.limit_kullanim_yuzde === null
              ? 'Limit tanımsız'
              : `%${sayi(cari.limit_kullanim_yuzde, 0)} kullanılmış`
          }
          vurgu={cari.limit_kullanim_yuzde !== null && cari.limit_kullanim_yuzde > 100 ? 'kritik' : undefined}
        />
        <Olcu
          etiket="En eski gecikme"
          deger={cari.en_eski_gun > 0 ? `${cari.en_eski_gun} gün` : '—'}
          not={cari.son_arama_ts ? `Son arama ${tarih(cari.son_arama_ts)}` : 'Hiç aranmamış'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,340px)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="kart">
            <h2>Yaşlandırma</h2>
            <YaslandirmaCubugu veri={cari} />
            {cari.vadesi_gelmemis > 0 && (
              <p className="alt-metin" style={{ marginTop: 10 }}>
                Ayrıca vadesi gelmemiş <strong>{para(cari.vadesi_gelmemis)}</strong> bakiye var (grafiğe dahil değil).
              </p>
            )}
          </div>

          {trend.length >= 2 && (
            <div className="kart">
              <h2>Toplam bakiye trendi</h2>
              <TrendCizgisi noktalar={trend} bicimlendir={(n) => paraKisa(n)} />
            </div>
          )}

          <div className="kart" style={{ padding: 0 }}>
            <h2 style={{ padding: '16px 18px 0' }}>Açık faturalar</h2>
            {faturalar.length === 0 ? (
              <BosDurum baslik="Açık fatura yok." />
            ) : (
              <div className="tablo-sar">
                <table>
                  <thead>
                    <tr>
                      <th>Fatura no</th>
                      <th>Tarih</th>
                      <th>Vade</th>
                      <th className="sayi">Gecikme</th>
                      <th className="sayi">Tutar</th>
                      <th className="sayi">Kalan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturalar.map((f) => {
                      const gecikme = Number(f.gecikme_gun);
                      return (
                        <tr key={String(f.fatura_no)}>
                          <td className="mono">{String(f.fatura_no)}</td>
                          <td>{tarih(String(f.tarih))}</td>
                          <td>{tarih(String(f.vade))}</td>
                          <td className="sayi" style={{ color: gecikme > 0 ? 'var(--kirmizi)' : 'var(--gri)' }}>
                            {gecikme > 0 ? `${gecikme} gün` : 'vadesi gelmedi'}
                          </td>
                          <td className="sayi">{para(Number(f.tutar))}</td>
                          <td className="sayi">
                            <strong>{para(Number(f.kalan))}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="kart" style={{ padding: 0 }}>
            <h2 style={{ padding: '16px 18px 0' }}>Görev geçmişi</h2>
            {gorevler.length === 0 ? (
              <BosDurum baslik="Bu cari için henüz görev açılmamış." />
            ) : (
              <div className="tablo-sar">
                <table>
                  <thead>
                    <tr>
                      <th>Tip</th>
                      <th>İş günü</th>
                      <th>Sorumlu</th>
                      <th>Durum / sonuç</th>
                      <th>Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gorevler.map((g) => (
                      <tr key={String(g.id)}>
                        <td>{String(g.tip)}</td>
                        <td>{tarih(String(g.is_gunu))}</td>
                        <td>{String(g.sorumlu_ad)}</td>
                        <td>
                          {String(g.durum)}
                          {g.sonuc ? ` · ${String(g.sonuc).toLocaleLowerCase('tr')}` : ''}
                          {Number(g.eskalasyon_seviyesi) > 0 ? ` · S${g.eskalasyon_seviyesi}` : ''}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--gri)', maxWidth: 280 }}>
                          {g.sonuc_notu ? String(g.sonuc_notu) : (g.gerekce ? String(g.gerekce) : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="kart">
            <h2>Risk skoru neden {sayi(cari.skor, 1)}?</h2>
            <SkorKirilimi bilesenler={cari.bilesenler_json ?? []} />
          </div>

          {odemeSozleri.length > 0 && (
            <div className="kart">
              <h2>Ödeme sözleri</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {odemeSozleri.map((s) => (
                  <div key={String(s.id)} style={{ fontSize: 12.5, borderBottom: '1px solid var(--cizgi-ince)', paddingBottom: 6 }}>
                    <strong>{para(Number(s.soz_tutari))}</strong> · {tarih(String(s.soz_tarihi))}
                    <div style={{ color: 'var(--gri)' }}>
                      {s.gerceklesti === null
                        ? 'Henüz kontrol edilmedi'
                        : s.gerceklesti
                          ? 'Tutuldu'
                          : 'TUTULMADI — risk skoruna ceza puanı eklendi'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cekler.length > 0 && (
            <div className="kart">
              <h2>Çekler</h2>
              <div style={{ display: 'grid', gap: 6 }}>
                {cekler.slice(0, 12).map((c) => (
                  <div key={String(c.cek_no)} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>
                      {tarih(String(c.vade))}
                      <span className="mono" style={{ color: 'var(--gri)' }}> · {String(c.banka ?? '')}</span>
                    </span>
                    <span className="sayi">
                      {para(Number(c.tutar))}
                      <span style={{ color: c.durum === 'KARSILIKSIZ' ? 'var(--kirmizi)' : 'var(--gri)', marginLeft: 6 }}>
                        {String(c.durum).toLocaleLowerCase('tr')}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="kart">
            <h2>Mikro bilgileri</h2>
            <div style={{ fontSize: 12.5, display: 'grid', gap: 4, color: 'var(--gri)' }}>
              <div>Vade günü: <strong style={{ color: 'var(--murekkep)' }}>{cari.vade_gun} gün</strong></div>
              <div>Toplam bakiye: <strong style={{ color: 'var(--murekkep)' }}>{para(cari.toplam_bakiye)}</strong></div>
              <div>Açık görev: <strong style={{ color: 'var(--murekkep)' }}>{cari.acik_gorev_adedi}</strong></div>
              <div style={{ marginTop: 6, fontSize: 11.5 }}>
                Cari, fatura ve çek verisi Mikro’dan okunur. Bu ekran Mikro’ya yazmaz.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
