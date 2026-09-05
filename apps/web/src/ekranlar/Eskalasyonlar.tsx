import { Link } from 'react-router-dom';
import { indir } from '../api/istemci.js';
import { useEskalasyonlar } from '../api/kancalar.js';
import { BosDurum, Hata, Yukleniyor } from '../bilesenler/Ortak.jsx';
import { sayi, tarihSaat } from '../bilesenler/bicim.js';

/**
 * Eskalasyon panosu — Enes'in ekranı.
 * "Hangi iş nereye, ne zaman, neden çıktı" sorusunun tek cevabı burası.
 */
export function Eskalasyonlar() {
  const liste = useEskalasyonlar();

  if (liste.isLoading) return <Yukleniyor />;
  if (liste.isError) return <Hata hata={liste.error} />;

  const satirlar = liste.data!.satirlar;
  const acikOlanlar = satirlar.filter((s) => s.durum === 'ACIK');

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>Eskalasyon panosu</h1>
          <p className="alt-metin">
            {sayi(satirlar.length)} kayıt · {sayi(acikOlanlar.length)} tanesinin görevi hâlâ açık
          </p>
        </div>
        <button className="dugme ikincil kucuk" onClick={() => indir('/eskalasyonlar', 'xlsx')}>
          Excel indir
        </button>
      </div>

      <div className="kart" style={{ padding: 0 }}>
        {satirlar.length === 0 ? (
          <BosDurum
            baslik="Hiç eskalasyon yok."
            aciklama="Görevler süresi içinde kapanıyor — sistemin hedefi tam olarak bu."
          />
        ) : (
          <div className="tablo-sar">
            <table>
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Seviye</th>
                  <th>Görev</th>
                  <th>Cari</th>
                  <th>Sorumlu</th>
                  <th>Bildirilen</th>
                  <th>Gerekçe</th>
                  <th>Görev durumu</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((e) => {
                  const seviye = Number(e.seviye);
                  const sinif = seviye >= 3 ? 'rozet-kritik' : seviye === 2 ? 'rozet-ciddi' : 'rozet-uyari';
                  return (
                    <tr key={String(e.id)} className={e.durum === 'ACIK' ? 'gecikmis' : undefined}>
                      <td style={{ fontSize: 12.5 }}>{tarihSaat(String(e.ts))}</td>
                      <td>
                        <span className={`rozet ${sinif}`}>Seviye {seviye}</span>
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        #{String(e.gorev_id)} {String(e.tip)}
                      </td>
                      <td>
                        {e.cari_kod ? (
                          <Link to={`/cariler/${encodeURIComponent(String(e.cari_kod))}`}>
                            {String(e.unvan ?? e.cari_kod)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ fontSize: 12.5 }}>{String(e.sorumlu_ad)}</td>
                      <td style={{ fontSize: 12.5 }}>{String(e.hedef_ad ?? '—')}</td>
                      <td style={{ fontSize: 12, color: 'var(--gri)', maxWidth: 300 }}>
                        {String(e.gerekce ?? '')}
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {e.durum === 'ACIK' ? (
                          <span className="rozet rozet-kritik">Hâlâ açık</span>
                        ) : (
                          <span className="rozet rozet-iyi">Kapandı</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
