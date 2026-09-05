import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useCikis, useOturum } from './api/kancalar.js';
import { Yukleniyor } from './bilesenler/Ortak.jsx';
import { AramaListesi } from './ekranlar/AramaListesi.jsx';
import { CariDetay } from './ekranlar/CariDetay.jsx';
import { Cariler } from './ekranlar/Cariler.jsx';
import { Eskalasyonlar } from './ekranlar/Eskalasyonlar.jsx';
import { Giris } from './ekranlar/Giris.jsx';
import { Gorevler } from './ekranlar/Gorevler.jsx';
import { Raporlar } from './ekranlar/Raporlar.jsx';
import { Yonetim } from './ekranlar/Yonetim.jsx';

const MENU = [
  { yol: '/', etiket: 'Arama listesi', son: true },
  { yol: '/gorevler', etiket: 'Görevler' },
  { yol: '/cariler', etiket: 'Cari risk' },
  { yol: '/eskalasyonlar', etiket: 'Eskalasyon', roller: ['YONETICI', 'UST_ONAY'] },
  { yol: '/raporlar', etiket: 'Raporlar' },
  { yol: '/yonetim', etiket: 'Yönetim', roller: ['YONETICI'] },
];

export function Uygulama() {
  const oturum = useOturum();
  const cikis = useCikis();

  if (oturum.isLoading) return <Yukleniyor metin="Oturum kontrol ediliyor…" />;
  if (!oturum.data) return <Giris />;

  const rol = oturum.data.rol;
  const menu = MENU.filter((m) => !m.roller || m.roller.includes(rol));

  return (
    <div className="kabuk">
      <nav className="kenar">
        <div className="kenar-marka">
          <b>MİRFİX</b>
          <span>operasyon katmanı</span>
        </div>
        {menu.map((m) => (
          <NavLink
            key={m.yol}
            to={m.yol}
            end={m.son}
            className={({ isActive }) => (isActive ? 'etkin' : '')}
          >
            {m.etiket}
          </NavLink>
        ))}
        <div className="kenar-alt">
          <div style={{ color: '#dfe8ec', fontWeight: 600 }}>{oturum.data.ad}</div>
          <div style={{ marginBottom: 8 }}>{rol.toLocaleLowerCase('tr')}</div>
          <button
            className="dugme ikincil kucuk"
            style={{ color: '#cfe0e6', borderColor: 'rgba(255,255,255,.3)', background: 'transparent' }}
            onClick={() => cikis.mutate()}
          >
            Çıkış
          </button>
        </div>
      </nav>

      <main className="govde">
        <Routes>
          <Route path="/" element={<AramaListesi />} />
          <Route path="/gorevler" element={<Gorevler />} />
          <Route path="/cariler" element={<Cariler />} />
          <Route path="/cariler/:kod" element={<CariDetay />} />
          <Route
            path="/eskalasyonlar"
            element={rol === 'YONETICI' || rol === 'UST_ONAY' ? <Eskalasyonlar /> : <Navigate to="/" replace />}
          />
          <Route path="/raporlar" element={<Raporlar />} />
          <Route path="/yonetim" element={rol === 'YONETICI' ? <Yonetim /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
