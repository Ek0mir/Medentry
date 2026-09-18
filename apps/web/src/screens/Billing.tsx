import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { formatMoney } from '../format.js';

interface BillingRow {
  id: string;
  assetCode: string;
  assetName: string;
  date: string;
  billableHours: number;
  engineHours: number;
  idleHours: number;
  overtimeHours: number;
  amountTotal: number;
  currency: string;
  status: string;
}

interface Props {
  canApprove: boolean;
}

function isoDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function Billing({ canApprove }: Props): JSX.Element {
  const [from, setFrom] = useState(isoDate(14));
  const [to, setTo] = useState(isoDate(0));
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.get<{ rows: BillingRow[] }>(`/api/billing?from=${from}&to=${to}`);
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Hakedis alinamadi');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function approve(id: string): Promise<void> {
    try {
      await api.post(`/api/billing/${id}/approve`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Onaylanamadi');
    }
  }

  const total = rows.reduce((sum, r) => sum + r.amountTotal, 0);
  const hours = rows.reduce((sum, r) => sum + r.billableHours, 0);
  const currency = rows[0]?.currency ?? 'TRY';

  return (
    <div className="content">
      <div className="card">
        <h2>Donem</h2>
        <div className="row">
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="lab">Baslangic</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="lab">Bitis</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Toplam</h2>
        <div className="metrics">
          <div className="metric">
            <span className="big">{rows.length}</span>
            <span className="cap">gun-makine</span>
          </div>
          <div className="metric">
            <span className="big">{Math.round(hours * 10) / 10}</span>
            <span className="cap">faturalik saat</span>
          </div>
          <div className="metric">
            <span className="big">{formatMoney(total, currency)}</span>
            <span className="cap">tutar</span>
          </div>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {busy && rows.length === 0 && <div className="skeleton" />}

      {rows.map((row) => (
        <div className="card" key={row.id}>
          <div className="spread">
            <div>
              <div style={{ fontWeight: 650 }}>
                {row.assetCode} · {row.date}
              </div>
              <div className="muted small">
                {row.billableHours} saat faturalik · {row.idleHours} saat rolanti
                {row.overtimeHours > 0 ? ` · ${row.overtimeHours} saat mesai` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{formatMoney(row.amountTotal, row.currency)}</div>
              <span className={`pill ${row.status === 'draft' ? 'idle' : 'working'}`}>
                {row.status === 'draft' ? 'Taslak' : row.status === 'approved' ? 'Onayli' : 'Faturalandi'}
              </span>
            </div>
          </div>
          {canApprove && row.status === 'draft' && (
            <button className="btn block" style={{ marginTop: 10 }} onClick={() => void approve(row.id)}>
              Onayla
            </button>
          )}
        </div>
      ))}

      {!busy && rows.length === 0 && (
        <div className="card center muted">Bu donemde hakedis kaydi yok.</div>
      )}
    </div>
  );
}
