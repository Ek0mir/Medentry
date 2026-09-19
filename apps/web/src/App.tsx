import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, getToken, setToken } from './api.js';
import type { DashboardDto, Me, PurposeDto, SettingsDto } from './api.js';
import { AssetScreen } from './screens/AssetScreen.js';
import { Billing } from './screens/Billing.js';
import { Fleet } from './screens/Fleet.js';
import { Kvkk } from './screens/Kvkk.js';
import { Login } from './screens/Login.js';

type Tab = 'fleet' | 'asset' | 'billing' | 'kvkk';

/** Tek ekran verisi bu araliklarla tazelenir. */
const REFRESH_MS = 20_000;

export function App(): JSX.Element {
  const [authed, setAuthed] = useState(() => getToken() !== null);
  const [me, setMe] = useState<Me | null>(null);
  const [purposes, setPurposes] = useState<PurposeDto[]>([]);
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('fleet');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async (): Promise<void> => {
    try {
      const [profile, purposeList, companySettings] = await Promise.all([
        api.get<Me>('/api/auth/me'),
        api.get<PurposeDto[]>('/api/kvkk/purposes'),
        api.get<SettingsDto>('/api/settings').catch(() => null),
      ]);
      setMe(profile);
      setPurposes(purposeList);
      setSettings(companySettings);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthed(false);
        setMe(null);
      }
    }
  }, []);

  const loadDashboard = useCallback(async (): Promise<void> => {
    try {
      setDashboard(await api.get<DashboardDto>('/api/dashboard'));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthed(false);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Baglanti kurulamadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void loadMe();
    void loadDashboard();
    const timer = setInterval(() => {
      // Ayrintili makine ekrani kendi verisini yeniler; listede degilken
      // gereksiz istek atmayalim.
      if (tab === 'fleet') void loadDashboard();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [authed, tab, loadMe, loadDashboard]);

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          setAuthed(true);
          setLoading(true);
        }}
      />
    );
  }

  const selected = dashboard?.assets.find((a) => a.id === assetId) ?? null;
  const canApprove = me ? ['owner', 'manager', 'site_chief'].includes(me.role) : false;

  const title =
    tab === 'asset' && selected
      ? selected.code
      : tab === 'billing'
        ? 'Hakedis'
        : tab === 'kvkk'
          ? 'KVKK'
          : (me?.company.name ?? 'Filo');

  const soloMode = settings?.solo_mode === true;
  // Tek kullanici modunda "aydinlatma metnini okuyun" uyarisi anlamsizdir:
  // bilgilendirilecek bir calisan yoktur.
  const pendingNotices = soloMode ? 0 : (me?.pendingNotices.length ?? 0);

  return (
    <div className="app">
      <header className="app-header">
        {tab === 'asset' && (
          <button
            className="btn ghost"
            style={{ minHeight: 36, padding: '4px 10px' }}
            onClick={() => setTab('fleet')}
            aria-label="Geri"
          >
            ‹
          </button>
        )}
        <h1>
          {title}
          <span className="sub">
            {tab === 'asset' && selected
              ? selected.name
              : me
                ? `${me.name} · ${me.roleLabel}`
                : ''}
          </span>
        </h1>
        <button
          className="btn ghost"
          style={{ minHeight: 36, padding: '4px 10px' }}
          onClick={() => {
            setToken(null);
            setAuthed(false);
          }}
        >
          Cikis
        </button>
      </header>

      {error && (
        <div className="content" style={{ paddingBottom: 0 }}>
          <div className="notice error">{error}</div>
        </div>
      )}

      {pendingNotices > 0 && tab !== 'kvkk' && (
        <div className="content" style={{ paddingBottom: 0 }}>
          <div className="notice warn">
            Okumaniz gereken {pendingNotices} aydinlatma metni var.{' '}
            <button
              className="btn ghost"
              style={{ minHeight: 0, padding: 0, border: 0, textDecoration: 'underline' }}
              onClick={() => setTab('kvkk')}
            >
              KVKK sekmesine git
            </button>
          </div>
        </div>
      )}

      {tab === 'fleet' && (
        <Fleet
          data={dashboard}
          loading={loading}
          onSelect={(id) => {
            setAssetId(id);
            setTab('asset');
          }}
        />
      )}

      {tab === 'asset' && assetId && (
        <AssetScreen
          assetId={assetId}
          purposes={purposes}
          soloMode={soloMode}
          onBack={() => setTab('fleet')}
        />
      )}

      {tab === 'billing' && <Billing canApprove={canApprove} />}

      {tab === 'kvkk' && me && <Kvkk me={me} onReload={() => void loadMe()} />}

      <nav className="bottom-nav">
        <button className={tab === 'fleet' ? 'active' : ''} onClick={() => setTab('fleet')}>
          <span className="icon">🗺️</span>
          Filo
        </button>
        <button
          className={tab === 'asset' ? 'active' : ''}
          onClick={() => {
            if (assetId) setTab('asset');
            else setTab('fleet');
          }}
          disabled={!assetId}
        >
          <span className="icon">🚜</span>
          Makine
        </button>
        <button className={tab === 'billing' ? 'active' : ''} onClick={() => setTab('billing')}>
          <span className="icon">🧾</span>
          Hakedis
        </button>
        <button className={tab === 'kvkk' ? 'active' : ''} onClick={() => setTab('kvkk')}>
          <span className="icon">🔒</span>
          {soloMode ? 'Kayit' : 'KVKK'}
          {pendingNotices > 0 ? ' •' : ''}
        </button>
      </nav>
    </div>
  );
}
