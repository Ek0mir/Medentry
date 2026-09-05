import { useState } from 'react';
import { Link } from 'react-router-dom';
import { indir, type Gorev } from '../api/istemci.js';
import { useGorevler } from '../api/kancalar.js';
import {
  BosDurum,
  DurumRozeti,
  EskalasyonRozeti,
  Hata,
  Yukleniyor,
} from '../bilesenler/Ortak.jsx';
import { kalanSure, para, sayi, tarih } from '../bilesenler/bicim.js';
import { KapatmaPenceresi } from './KapatmaPenceresi.jsx';

const TIPLER = ['ARAMA', 'ODEME_SOZU', 'CEK_VADE', 'SEVKIYAT', 'ONAY', 'SERBEST'];

export function Gorevler() {
  const [durum, setDurum] = useState('ACIK');
  const [tip, setTip] = useState('');
  const [gecikmis, setGecikmis] = useState(false);
  const [kapatilan, setKapatilan] = useState<Gorev | null>(null);

  const sorgu = { durum, tip, gecikmis: gecikmis ? 'true' : undefined, limit: 200 };
  const liste = useGorevler(sorgu);
  const sorguMetni = new URLSearchParams(
    Object.entries({ durum, tip, gecikmis: gecikmis ? 'true' : '' }).filter(([, d]) => d !== ''),
  ).toString();

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>Görevler</h1>
          <p className="alt-metin">
            {liste.data ? `${sayi(liste.data.toplam)} görev` : '…'} · süresi geçen her görev kendiliğinden yukarı çıkar
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dugme ikincil kucuk" onClick={() => indir(`/gorevler?${sorguMetni}`, 'csv')}>
            CSV indir
          </button>
          <button className="dugme ikincil kucuk" onClick={() => indir(`/gorevler?${sorguMetni}`, 'xlsx')}>
            Excel indir
          </button>
        </div>
      </div>

      <div className="arac-satiri">
        <select value={durum} onChange={(o) => setDurum(o.target.value)}>
          <option value="">Tüm durumlar</option>
          <option value="ACIK">Açık</option>
          <option value="KAPALI">Kapalı</option>
        </select>
        <select value={tip} onChange={(o) => setTip(o.target.value)}>
          <option value="">Tüm tipler</option>
          {TIPLER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}>
          <input type="checkbox" checked={gecikmis} onChange={(o) => setGecikmis(o.target.checked)} />
          Yalnızca gecikmiş
        </label>
      </div>

      {liste.isLoading && <Yukleniyor />}
      {liste.isError && <Hata hata={liste.error} />}

      {liste.data && (
        <div className="kart" style={{ padding: 0 }}>
          {liste.data.satirlar.length === 0 ? (
            <BosDurum baslik="Bu süzgeçle görev yok." />
          ) : (
            <div className="tablo-sar">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tip</th>
                    <th>Cari</th>
                    <th>Sorumlu</th>
                    <th>İş günü</th>
                    <th>Süre</th>
                    <th className="sayi">Vadesi geçen</th>
                    <th>Durum</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {liste.data.satirlar.map((g) => (
                    <tr key={g.id} className={g.gecikmis ? 'gecikmis' : undefined}>
                      <td className="mono" style={{ color: 'var(--gri)' }}>{g.id}</td>
                      <td style={{ fontSize: 12 }}>{g.tip}</td>
                      <td>
                        {g.cari_kod ? (
                          <Link to={`/cariler/${encodeURIComponent(g.cari_kod)}`}>{g.unvan ?? g.cari_kod}</Link>
                        ) : (
                          <span style={{ color: 'var(--gri)' }}>—</span>
                        )}
                        <div style={{ fontSize: 11.5, color: 'var(--gri)', maxWidth: 320 }}>{g.aciklama}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{g.sorumlu_ad}</td>
                      <td style={{ fontSize: 12.5 }}>{tarih(g.is_gunu)}</td>
                      <td style={{ fontSize: 12, color: g.gecikmis ? 'var(--kirmizi)' : 'var(--gri)' }}>
                        {g.durum === 'ACIK' ? kalanSure(g.son_tarih) : tarih(g.kapanma_ts)}
                      </td>
                      <td className="sayi">{g.vadesi_gecen ? para(g.vadesi_gecen) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <DurumRozeti durum={g.durum} sonuc={g.sonuc} />
                          <EskalasyonRozeti seviye={g.eskalasyon_seviyesi} />
                        </div>
                      </td>
                      <td>
                        {g.durum === 'ACIK' && (
                          <button className="dugme kucuk" onClick={() => setKapatilan(g)}>
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
      )}

      {kapatilan && <KapatmaPenceresi gorev={kapatilan} kapat={() => setKapatilan(null)} />}
    </>
  );
}
