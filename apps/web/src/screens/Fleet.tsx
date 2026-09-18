import { MapView } from '../components/MapView.js';
import type { MapMarker } from '../components/MapView.js';
import { formatAge, formatHours, formatMoney, STATUS_LABEL } from '../format.js';
import type { DashboardDto } from '../api.js';

interface Props {
  data: DashboardDto | null;
  loading: boolean;
  onSelect: (assetId: string) => void;
}

export function Fleet({ data, loading, onSelect }: Props): JSX.Element {
  if (loading && !data) {
    return (
      <div className="content">
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }
  if (!data) return <div className="content">Veri alinamadi.</div>;

  const markers: MapMarker[] = data.assets
    .filter((a) => a.position)
    .map((a) => ({
      id: a.id,
      lat: a.position!.lat,
      lon: a.position!.lon,
      label: a.code,
      status: a.status,
    }));

  return (
    <div className="content">
      <MapView markers={markers} onMarkerClick={onSelect} />

      <div className="card">
        <h2>Bugun</h2>
        <div className="metrics">
          <div className="metric">
            <span className="big">{data.totals.working}</span>
            <span className="cap">calisiyor</span>
          </div>
          <div className="metric">
            <span className="big">{formatHours(data.totals.engineHours)}</span>
            <span className="cap">toplam motor</span>
          </div>
          <div className="metric">
            <span className="big">{formatMoney(data.totals.amountTotal, data.totals.currency)}</span>
            <span className="cap">gunluk hakedis</span>
          </div>
        </div>
      </div>

      {data.assets.map((asset) => (
        <button key={asset.id} className="asset-item" onClick={() => onSelect(asset.id)}>
          <div className="body">
            <div className="title">
              {asset.code}
              <span className={`pill ${asset.status}`}>
                <span className="dot" />
                {STATUS_LABEL[asset.status]}
              </span>
              {asset.alerts.length > 0 && (
                <span className="pill danger">{asset.alerts.length} uyari</span>
              )}
            </div>
            <div className="meta">
              {asset.typeLabel}
              {asset.operator?.name ? ` · ${asset.operator.name}` : ' · operator atanmamis'}
              {asset.geofences[0] ? ` · ${asset.geofences[0].name}` : ''}
            </div>
          </div>
          <div className="right">
            <div>
              <strong>{formatHours(asset.today.engineHours)}</strong>
            </div>
            <div className="muted tiny">{formatAge(asset.position?.ageSec ?? null)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
