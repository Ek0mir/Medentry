import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Gorev } from '../api/istemci.js';
import { useAramaListesi, useOzet } from '../api/kancalar.js';
import { YaslandirmaCubugu } from '../bilesenler/Grafikler.jsx';
import {
  BosDurum,
  DurumRozeti,
  EskalasyonRozeti,
  Hata,
  KademeRozeti,
  Olcu,
  Yukleniyor,
} from '../bilesenler/Ortak.jsx';
import { kalanSure, para, paraKisa, sayi, tarih } from '../bilesenler/bicim.js';
import { KapatmaPenceresi } from './KapatmaPenceresi.jsx';

/**
 * Bugünün arama kuyruğu — panelin ana ekranı.
 *
 * Masterbook Bölüm 06: bu bir rapor değil, GÖREV KUYRUĞUDUR. Bakılıp
 * geçilemez, kapatılması gerekir. Ekran da öyle davranıyor: her satırın tek
 * bir eylemi var ve kapatma sonuç ister.
 */
export function AramaListesi() {
  const liste = useAramaListesi();
  const ozet = useOzet();
  const [kapatilan, setKapatilan] = useState<Gorev | null>(null);

  if (liste.isLoading) return <Yukleniyor />;
  if (liste.isError) return <Hata hata={liste.error} />;

  const veri = liste.data!;
  const y = ozet.data?.yaslandirma;
  const g = ozet.data?.gorev;

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>Bugünün arama listesi</h1>
          <p className="alt-metin">
            {tarih(veri.gun)} · risk sıralamasına göre üretildi · kapatmak için sonuç girmek zorunlu
          </p>
        </div>
      </div>

      <div className="olcu-serit">
        <Olcu
          etiket="Kuyruk"
          deger={`${veri.kapanan} / ${veri.toplam}`}
          not={veri.acik === 0 ? 'Kuyruk temiz' : `${veri.acik} arama bekliyor`}
          vurgu={veri.acik === 0 ? 'iyi' : undefined}
        />
        <Olcu
          etiket="Kapanma oranı"
          deger={veri.kapanmaOrani === null ? '—' : `%${sayi(veri.kapanmaOrani, 1)}`}
          not="Hedef: %85+"
          vurgu={veri.kapanmaOrani !== null && veri.kapanmaOrani >= 85 ? 'iyi' : 'uyari'}
        />
        <Olcu
          etiket="Gecikmiş görev"
          deger={sayi(g?.gecikmis)}
          not={g?.eskalasyonda ? `${g.eskalasyonda} tanesi eskalasyonda` : 'Eskalasyon yok'}
          vurgu={g?.gecikmis ? 'kritik' : 'iyi'}
        />
        <Olcu
          etiket="Vadesi geçen"
          deger={paraKisa(
            y ? y.b_0_30 + y.b_31_60 + y.b_61_90 + y.b_91_180 + y.b_180_plus : null,
          )}
          not={y ? `90 gün üstü ${paraKisa(y.doksan_gun_ustu)}` : undefined}
          vurgu="uyari"
        />
      </div>

      {y && (
        <div className="kart" style={{ marginBottom: 16 }}>
          <h2>Portföyün yaşlandırma dağılımı</h2>
          <YaslandirmaCubugu veri={y} />
        </div>
      )}

      <div className="kart" style={{ padding: 0 }}>
        {veri.satirlar.length === 0 ? (
          <BosDurum
            baslik="Bugün için arama görevi yok."
            aciklama="W-03 işi henüz çalışmadıysa Yönetim ekranından elle çalıştırabilirsiniz."
          />
        ) : (
          <div className="tablo-sar">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 38 }}>#</th>
                  <th>Cari</th>
                  <th className="sayi">Vadesi geçen</th>
                  <th>Risk</th>
                  <th>Neden listede</th>
                  <th>Süre</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {veri.satirlar.map((satir) => (
                  <tr key={satir.id} className={satir.gecikmis ? 'gecikmis' : undefined}>
                    <td className="mono" style={{ color: 'var(--gri)' }}>
                      {satir.oncelik_sira ?? '—'}
                    </td>
                    <td>
                      <Link to={`/cariler/${encodeURIComponent(satir.cari_kod ?? '')}`}>
                        {satir.unvan ?? satir.cari_kod}
                      </Link>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--gri)' }}>
                        {satir.cari_kod}
                        {satir.telefon ? ` · ${satir.telefon}` : ''}
                      </div>
                    </td>
                    <td className="sayi">{para(satir.vadesi_gecen)}</td>
                    <td>
                      <KademeRozeti kademe={satir.kademe} ad={satir.kademe_ad} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gri)', maxWidth: 320 }}>
                      {satir.gerekce ?? '—'}
                    </td>
                    <td style={{ fontSize: 12, color: satir.gecikmis ? 'var(--kirmizi)' : 'var(--gri)' }}>
                      {satir.durum === 'ACIK' ? kalanSure(satir.son_tarih) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <DurumRozeti durum={satir.durum} sonuc={satir.sonuc} />
                        <EskalasyonRozeti seviye={satir.eskalasyon_seviyesi} />
                      </div>
                    </td>
                    <td>
                      {satir.durum === 'ACIK' && (
                        <button className="dugme kucuk" onClick={() => setKapatilan(satir)}>
                          Kapat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {kapatilan && <KapatmaPenceresi gorev={kapatilan} kapat={() => setKapatilan(null)} />}
    </>
  );
}
