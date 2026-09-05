import { useState } from 'react';
import { api } from '../api/istemci.js';
import { useIsCalistir, useIsler, useKullanicilar, useSaglik } from '../api/kancalar.js';
import { Hata, Yukleniyor } from '../bilesenler/Ortak.jsx';
import { tarihSaat } from '../bilesenler/bicim.js';

/**
 * Yönetim ekranı (yalnızca YONETICI).
 * İşleri elle çalıştırma, sistem sağlığı, kullanıcı/temsilci eşlemesi,
 * tatil takvimi ve otomasyon için API anahtarı üretimi.
 */
export function Yonetim() {
  const saglik = useSaglik();
  const isler = useIsler();
  const kullanicilar = useKullanicilar();
  const calistir = useIsCalistir();

  const [gun, setGun] = useState('');
  const [zorla, setZorla] = useState(false);
  const [yeniAnahtar, setYeniAnahtar] = useState<string | null>(null);
  const [anahtarAdi, setAnahtarAdi] = useState('');

  async function anahtarUret() {
    const sonuc = await api.gonder<{ anahtar: string }>('/api-anahtarlari', {
      ad: anahtarAdi || 'Otomasyon',
      rol: 'YONETICI',
    });
    setYeniAnahtar(sonuc.anahtar);
    setAnahtarAdi('');
  }

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>Yönetim</h1>
          <p className="alt-metin">İşler, sistem sağlığı, kullanıcılar ve otomasyon erişimi.</p>
        </div>
      </div>

      <div className="kart">
        <h2>Sistem sağlığı</h2>
        {saglik.isLoading && <Yukleniyor />}
        {saglik.isError && <Hata hata={saglik.error} />}
        {saglik.data && (
          <>
            <div style={{ marginBottom: 10 }}>
              <span className={`rozet ${saglik.data.saglikli ? 'rozet-iyi' : 'rozet-kritik'}`}>
                {saglik.data.saglikli ? 'Sistem sağlıklı' : 'Sorun var'}
              </span>
              <span className="alt-metin" style={{ marginLeft: 10 }}>
                {tarihSaat(saglik.data.ts)}
              </span>
            </div>
            <div className="tablo-sar">
              <table>
                <thead>
                  <tr>
                    <th>Kontrol</th>
                    <th>Durum</th>
                    <th>Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {saglik.data.bulgular.map((b) => (
                    <tr key={b.ad}>
                      <td className="mono" style={{ fontSize: 12 }}>{b.ad}</td>
                      <td>
                        <span className={`rozet ${b.saglikli ? 'rozet-iyi' : 'rozet-kritik'}`}>
                          {b.saglikli ? 'tamam' : 'sorun'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--gri)' }}>{b.mesaj}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="kart">
        <h2>Zamanlanmış işler</h2>
        <p className="alt-metin" style={{ marginBottom: 12 }}>
          Normalde kendi saatlerinde çalışır. Buradan elle de tetiklenebilir — sistem kapalı
          kaldıysa geçmiş bir günün listesini üretmek için tarih verin.
        </p>

        <div className="arac-satiri">
          <div>
            <label htmlFor="is-gun">Hangi gün için (boşsa bugün)</label>
            <input id="is-gun" type="date" value={gun} onChange={(o) => setGun(o.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '18px 0 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={zorla} onChange={(o) => setZorla(o.target.checked)} />
            İş günü kontrolünü atla
          </label>
        </div>

        {calistir.data && (
          <div className={calistir.data.basarili ? 'bilgi-kutusu' : 'hata-kutusu'}>
            <strong>{calistir.data.kod}</strong> ({calistir.data.sureMs} ms) — {calistir.data.ozet}
          </div>
        )}
        {calistir.isError && <Hata hata={calistir.error} />}

        {isler.isLoading && <Yukleniyor />}
        {isler.data && (
          <div className="tablo-sar">
            <table>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>İş</th>
                  <th>Zamanlama</th>
                  <th>Açıklama</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {isler.data.isler.map((is) => (
                  <tr key={is.kod}>
                    <td className="mono">{is.kod}</td>
                    <td>{is.ad}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--gri)' }}>
                      {is.zamanlama ?? 'elle'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gri)', maxWidth: 380 }}>{is.aciklama}</td>
                    <td>
                      <button
                        className="dugme kucuk"
                        disabled={calistir.isPending}
                        onClick={() =>
                          calistir.mutate({
                            kod: is.kod,
                            ...(gun ? { gun } : {}),
                            ...(zorla ? { zorla: true } : {}),
                          })
                        }
                      >
                        Çalıştır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kart">
        <h2>Kullanıcılar</h2>
        <p className="alt-metin" style={{ marginBottom: 12 }}>
          <strong>Mikro temsilci</strong> alanı, satış rolündeki kullanıcıyı Mikro’daki cari
          temsilcisine bağlar. Boş bırakılırsa kullanıcının adı denenir; o da tutmazsa portföy
          süzgeci uygulanmaz ve cari listesinde uyarı görünür.
        </p>
        {kullanicilar.isLoading && <Yukleniyor />}
        {kullanicilar.data && (
          <div className="tablo-sar">
            <table>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kullanıcı adı</th>
                  <th>Rol</th>
                  <th>Mikro temsilci</th>
                  <th>Telefon</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {kullanicilar.data.kullanicilar.map((k) => (
                  <tr key={String(k.id)}>
                    <td>{String(k.ad)}</td>
                    <td className="mono">{String(k.kullanici_adi)}</td>
                    <td>{String(k.rol)}</td>
                    <td style={{ color: k.mikro_temsilci ? undefined : 'var(--gri)' }}>
                      {k.mikro_temsilci ? String(k.mikro_temsilci) : `(adı kullanılıyor: ${String(k.ad)})`}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(k.telefon ?? '—')}</td>
                    <td>
                      <span className={`rozet ${k.aktif ? 'rozet-iyi' : 'rozet-notr'}`}>
                        {k.aktif ? 'aktif' : 'pasif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kart">
        <h2>Otomasyon ve veri çekme</h2>
        <p className="alt-metin" style={{ marginBottom: 12 }}>
          API anahtarıyla panel dışından da veri çekilebilir — Excel, Power BI, n8n veya başka bir
          araç aynı uçları kullanır. Anahtar yalnızca bir kez gösterilir; veritabanında düz metin
          saklanmaz.
        </p>
        <div className="arac-satiri">
          <input
            type="text"
            placeholder="Anahtarın adı (örn. Power BI raporlama)"
            value={anahtarAdi}
            onChange={(o) => setAnahtarAdi(o.target.value)}
            style={{ minWidth: 260 }}
          />
          <button className="dugme kucuk" onClick={() => void anahtarUret()}>
            Anahtar üret
          </button>
        </div>
        {yeniAnahtar && (
          <div className="bilgi-kutusu">
            <strong>Bu anahtar bir daha gösterilmeyecek — şimdi kopyalayın:</strong>
            <div className="mono" style={{ marginTop: 6, wordBreak: 'break-all', fontSize: 12.5 }}>
              {yeniAnahtar}
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Kullanımı: <code>curl -H "X-API-Key: …" http://192.168.1.50:8080/api/v1/cariler?format=xlsx</code>
            </div>
          </div>
        )}
        <p className="alt-metin">
          Uçların tam listesi ve şeması: <a href="/api/belgeler" target="_blank" rel="noreferrer">/api/belgeler</a>
        </p>
      </div>
    </>
  );
}
