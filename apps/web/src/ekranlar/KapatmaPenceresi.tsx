import { useState } from 'react';
import { ApiHatasi, type Gorev } from '../api/istemci.js';
import { useGorevKapat, useSonucSecenekleri } from '../api/kancalar.js';
import { Pencere } from '../bilesenler/Ortak.jsx';
import { para, tarih } from '../bilesenler/bicim.js';

/**
 * Görev kapatma penceresi.
 *
 * Sistemin en kritik kuralı burada görünür hale gelir: SONUÇ SEÇMEDEN
 * kapatılamaz. Sunucu 422 ile reddeder ve gerekçeyi döner; burada o gerekçe
 * olduğu gibi gösterilir — kullanıcı neyi eksik bıraktığını görsün.
 */
export function KapatmaPenceresi({ gorev, kapat }: { gorev: Gorev; kapat: () => void }) {
  const secenekler = useSonucSecenekleri();
  const kapatma = useGorevKapat();

  const [sonuc, setSonuc] = useState('');
  const [notu, setNotu] = useState('');
  const [sozTarihi, setSozTarihi] = useState('');
  const [sozTutari, setSozTutari] = useState('');

  const izinli = secenekler.data?.tipler[gorev.tip] ?? [];
  const sozGerekli = sonuc === 'ODEME_SOZU';
  const hata = kapatma.error;
  const hatalar =
    hata instanceof ApiHatasi ? (hata.hatalar ?? [hata.message]) : hata ? [(hata as Error).message] : [];

  const yarin = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  function gonder() {
    kapatma.mutate(
      {
        gorevId: gorev.id,
        sonuc,
        sonucNotu: notu.trim() || undefined,
        sozTarihi: sozGerekli ? sozTarihi || undefined : undefined,
        sozTutari: sozGerekli && sozTutari ? Number(sozTutari) : undefined,
      },
      { onSuccess: kapat },
    );
  }

  return (
    <Pencere
      baslik={`Görev #${gorev.id} — kapat`}
      kapat={kapat}
      alt={
        <>
          <button className="dugme ikincil" onClick={kapat}>
            Vazgeç
          </button>
          <button className="dugme" onClick={gonder} disabled={kapatma.isPending || !sonuc}>
            {kapatma.isPending ? 'Kapatılıyor…' : 'Görevi kapat'}
          </button>
        </>
      }
      cocuklar={
        <>
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--cizgi-ince)' }}>
            <div style={{ fontWeight: 600 }}>{gorev.unvan ?? gorev.cari_kod ?? 'Cari yok'}</div>
            <div className="alt-metin">{gorev.aciklama}</div>
            {gorev.gerekce && (
              <div className="alt-metin" style={{ marginTop: 6 }}>
                <strong>Neden listede:</strong> {gorev.gerekce}
              </div>
            )}
            {gorev.telefon && (
              <div className="mono alt-metin" style={{ marginTop: 6 }}>
                ☎ {gorev.telefon}
              </div>
            )}
            {gorev.vadesi_gecen ? (
              <div className="alt-metin">Vadesi geçen bakiye: <strong>{para(gorev.vadesi_gecen)}</strong></div>
            ) : null}
          </div>

          {hatalar.length > 0 && (
            <div className="hata-kutusu">
              <strong>Görev kapatılamadı.</strong>
              <ul>
                {hatalar.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="alan">
            <label>Görüşme sonucu — zorunlu</label>
            <div style={{ display: 'grid', gap: 5 }}>
              {izinli.map((s) => (
                <label
                  key={s.deger}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '7px 10px',
                    border: `1px solid ${sonuc === s.deger ? 'var(--mavi-acik)' : 'var(--cizgi-ince)'}`,
                    background: sonuc === s.deger ? 'var(--yuzey-2)' : 'transparent',
                    borderRadius: 3,
                    cursor: 'pointer',
                    color: 'var(--murekkep)',
                    fontSize: 13.5,
                    marginBottom: 0,
                  }}
                >
                  <input
                    type="radio"
                    name="sonuc"
                    value={s.deger}
                    checked={sonuc === s.deger}
                    onChange={() => setSonuc(s.deger)}
                  />
                  {s.etiket}
                </label>
              ))}
            </div>
          </div>

          {sozGerekli && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="alan">
                <label htmlFor="soz-tarihi">Söz verilen tarih</label>
                <input
                  id="soz-tarihi"
                  type="date"
                  min={yarin}
                  style={{ width: '100%' }}
                  value={sozTarihi}
                  onChange={(o) => setSozTarihi(o.target.value)}
                />
              </div>
              <div className="alan">
                <label htmlFor="soz-tutari">Söz verilen tutar (₺)</label>
                <input
                  id="soz-tutari"
                  type="number"
                  min={1}
                  step={100}
                  style={{ width: '100%' }}
                  value={sozTutari}
                  onChange={(o) => setSozTutari(o.target.value)}
                />
              </div>
            </div>
          )}

          {sozGerekli && sozTarihi && (
            <div className="bilgi-kutusu">
              {tarih(sozTarihi)} tarihinde söz alınmış olacak. Takip görevi ertesi gün
              kendiliğinden açılır — sözün tutulup tutulmadığı unutulmaz.
            </div>
          )}

          <div className="alan">
            <label htmlFor="notu">
              Not {sonuc === 'ITIRAZ' ? '— itiraz sonucunda zorunlu' : '(isteğe bağlı)'}
            </label>
            <textarea
              id="notu"
              rows={3}
              style={{ width: '100%' }}
              placeholder="Kiminle görüşüldü, ne söylendi?"
              value={notu}
              onChange={(o) => setNotu(o.target.value)}
            />
          </div>
        </>
      }
    />
  );
}
