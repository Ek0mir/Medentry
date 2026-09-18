import { useState } from 'react';
import { ApiError, api, setToken } from '../api.js';

interface Props {
  onSuccess: () => void;
}

export function Login({ onSuccess }: Props): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ token: string }>('/api/auth/login', { email, password });
      setToken(result.token);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Giris yapilamadi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={(e) => void submit(e)}>
        <div className="brand">
          <div className="logo">🏗️</div>
          <h1>Medentry Filo</h1>
          <div className="muted small">Makine ve arac takip</div>
        </div>

        <div className="card">
          <label className="field">
            <span className="lab">E-posta</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              required
            />
          </label>
          <label className="field">
            <span className="lab">Parola</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="notice error">{error}</div>}

          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? 'Giris yapiliyor...' : 'Giris yap'}
          </button>
        </div>

        <p className="tiny muted center">
          Bu sistem calisma saati, konum ve kamera verisi isler. Kullanmadan once size teblig edilen
          aydinlatma metinlerini okuyunuz.
        </p>
      </form>
    </div>
  );
}
