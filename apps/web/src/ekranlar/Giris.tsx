import { useState, type FormEvent } from 'react';
import { useGiris } from '../api/kancalar.js';

export function Giris() {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [parola, setParola] = useState('');
  const giris = useGiris();

  function gonder(olay: FormEvent) {
    olay.preventDefault();
    giris.mutate({ kullaniciAdi: kullaniciAdi.trim().toLocaleLowerCase('tr'), parola });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--mavi)',
        padding: 16,
      }}
    >
      <form
        onSubmit={gonder}
        className="kart"
        style={{ width: 'min(380px, 100%)', padding: '26px 26px 22px' }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
            MİRFİX Operasyon Katmanı
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--gri)' }}>
            görev · risk · eskalasyon
          </div>
        </div>

        {giris.isError && (
          <div className="hata-kutusu">{(giris.error as Error).message}</div>
        )}

        <div className="alan">
          <label htmlFor="kullanici">Kullanıcı adı</label>
          <input
            id="kullanici"
            type="text"
            autoComplete="username"
            autoFocus
            style={{ width: '100%' }}
            value={kullaniciAdi}
            onChange={(o) => setKullaniciAdi(o.target.value)}
          />
        </div>

        <div className="alan">
          <label htmlFor="parola">Parola</label>
          <input
            id="parola"
            type="password"
            autoComplete="current-password"
            style={{ width: '100%' }}
            value={parola}
            onChange={(o) => setParola(o.target.value)}
          />
        </div>

        <button
          className="dugme"
          type="submit"
          style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
          disabled={giris.isPending || !kullaniciAdi || !parola}
        >
          {giris.isPending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
