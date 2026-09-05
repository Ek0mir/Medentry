import { useState } from 'react';
import { Link } from 'react-router-dom';
import { indir } from '../api/istemci.js';
import { useCariler } from '../api/kancalar.js';
import { YaslandirmaCubugu } from '../bilesenler/Grafikler.jsx';
import { BosDurum, Hata, KademeRozeti, Yukleniyor } from '../bilesenler/Ortak.jsx';
import { para, sayi } from '../bilesenler/bicim.js';

const SIRALAMALAR = [
  { deger: 'skor', etiket: 'Risk skoru' },
  { deger: 'vadesi_gecen', etiket: 'Vadesi geçen' },
  { deger: 'toplam_bakiye', etiket: 'Toplam bakiye' },
  { deger: 'en_eski_gun', etiket: 'En eski gecikme' },
  { deger: 'unvan', etiket: 'Unvan' },
];

export function Cariler() {
  const [arama, setArama] = useState('');
  const [kademeEnAz, setKademeEnAz] = useState('');
  const [sirala, setSirala] = useState('skor');
  const [sayfa, setSayfa] = useState(0);
  const limit = 50;

  const sorgu = { arama, kademeEnAz, sirala, limit, ofset: sayfa * limit };
  const liste = useCariler(sorgu);

  const sorguMetni = new URLSearchParams(
    Object.entries({ arama, kademeEnAz, sirala }).filter(([, d]) => d !== ''),
  ).toString();

  return (
    <>
      <div className="baslik-satiri">
        <div>
          <h1>Cari risk</h1>
          <p className="alt-metin">
            {liste.data ? `${sayi(liste.data.toplam)} cari` : '…'} · risk skoru 5 bileşenden hesaplanır
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dugme ikincil kucuk" onClick={() => indir(`/cariler?${sorguMetni}`, 'csv')}>
            CSV indir
          </button>
          <button className="dugme ikincil kucuk" onClick={() => indir(`/cariler?${sorguMetni}`, 'xlsx')}>
            Excel indir
          </button>
        </div>
      </div>

      {liste.data?.uyari && <div className="bilgi-kutusu">{liste.data.uyari}</div>}

      <div className="arac-satiri">
        <input
          type="text"
          placeholder="Unvan veya cari kodu ara…"
          value={arama}
          onChange={(o) => {
            setArama(o.target.value);
            setSayfa(0);
          }}
          style={{ minWidth: 240 }}
        />
        <select
          value={kademeEnAz}
          onChange={(o) => {
            setKademeEnAz(o.target.value);
            setSayfa(0);
          }}
        >
          <option value="">Tüm kademeler</option>
          {[3, 5, 6, 7, 8].map((k) => (
            <option key={k} value={k}>
              {k}. kademe ve üstü
            </option>
          ))}
        </select>
        <select value={sirala} onChange={(o) => setSirala(o.target.value)}>
          {SIRALAMALAR.map((s) => (
            <option key={s.deger} value={s.deger}>
              {s.etiket}’na göre sırala
            </option>
          ))}
        </select>
      </div>

      {liste.isLoading && <Yukleniyor />}
      {liste.isError && <Hata hata={liste.error} />}

      {liste.data && (
        <div className="kart" style={{ padding: 0 }}>
          {liste.data.satirlar.length === 0 ? (
            <BosDurum baslik="Bu süzgeçle cari bulunamadı." />
          ) : (
            <div className="tablo-sar">
              <table>
                <thead>
                  <tr>
                    <th>Cari</th>
                    <th>Risk</th>
                    <th className="sayi">Skor</th>
                    <th className="sayi">Vadesi geçen</th>
                    <th style={{ minWidth: 180 }}>Yaşlandırma</th>
                    <th className="sayi">Limit kul.</th>
                    <th className="sayi">Gecikme</th>
                    <th className="sayi">Açık görev</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.data.satirlar.map((c) => (
                    <tr key={c.kod}>
                      <td>
                        <Link to={`/cariler/${encodeURIComponent(c.kod)}`}>{c.unvan}</Link>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--gri)' }}>
                          {c.kod}
                          {c.temsilci ? ` · ${c.temsilci}` : ''}
                        </div>
                      </td>
                      <td>
                        <KademeRozeti kademe={c.kademe} ad={c.kademe_ad} />
                      </td>
                      <td className="sayi">{sayi(c.skor, 1)}</td>
                      <td className="sayi">{para(c.vadesi_gecen)}</td>
                      <td style={{ minWidth: 180 }}>
                        <YaslandirmaCubugu veri={c} yukseklik={12} etiketGoster={false} />
                      </td>
                      <td className="sayi">
                        {c.limit_kullanim_yuzde === null ? '—' : `%${sayi(c.limit_kullanim_yuzde, 0)}`}
                      </td>
                      <td className="sayi">{c.en_eski_gun > 0 ? `${c.en_eski_gun} gün` : '—'}</td>
                      <td className="sayi">{c.acik_gorev_adedi || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {liste.data && liste.data.toplam > limit && (
        <div className="arac-satiri" style={{ marginTop: 12, justifyContent: 'center' }}>
          <button className="dugme ikincil kucuk" disabled={sayfa === 0} onClick={() => setSayfa((s) => s - 1)}>
            ← Önceki
          </button>
          <span style={{ fontSize: 12.5, color: 'var(--gri)' }}>
            {sayfa * limit + 1}–{Math.min((sayfa + 1) * limit, liste.data.toplam)} / {sayi(liste.data.toplam)}
          </span>
          <button
            className="dugme ikincil kucuk"
            disabled={(sayfa + 1) * limit >= liste.data.toplam}
            onClick={() => setSayfa((s) => s + 1)}
          >
            Sonraki →
          </button>
        </div>
      )}
    </>
  );
}
