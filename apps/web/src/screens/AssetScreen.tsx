/**
 * Tek ekran.
 *
 * Kullanicinin telefonda tek bakista gormesi gereken sira:
 *   nerede -> kacta calisti -> kac saat calisti -> kim kullaniyor ->
 *   goruntu -> yakit/calisma -> gunluk hakedis
 * Kartlarin sirasi bilincli olarak bu akisi izler.
 */

import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import type { AssetDetailDto, CameraDto, PurposeDto } from '../api.js';
import { CameraDialog } from '../components/CameraDialog.js';
import { MapView } from '../components/MapView.js';
import { eventLabel, formatAge, formatDateTime, formatHours, formatMoney, formatTime, STATUS_LABEL } from '../format.js';

interface Props {
  assetId: string;
  purposes: PurposeDto[];
  onBack: () => void;
}

export function AssetScreen({ assetId, purposes, onBack }: Props): JSX.Element {
  const [data, setData] = useState<AssetDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraDto | null>(null);
  const [showLines, setShowLines] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const result = await api.get<AssetDetailDto>(`/api/dashboard/${assetId}`);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Veri alinamadi');
      }
    };

    void load();
    // Canli takip: 20 saniyede bir yenile.
    const timer = setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [assetId]);

  if (error) {
    return (
      <div className="content">
        <div className="notice error">{error}</div>
        <button className="btn block" onClick={onBack}>
          Geri
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="content">
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  const { asset, billing, sessions, track } = data;
  const tz = data.timezone;

  return (
    <div className="content">
      {/* 1) Makine nerede */}
      <MapView
        tall
        markers={
          asset.position
            ? [
                {
                  id: asset.id,
                  lat: asset.position.lat,
                  lon: asset.position.lon,
                  label: asset.code,
                  status: asset.status,
                },
              ]
            : []
        }
        track={track.map((p) => ({ lat: p.lat, lon: p.lon }))}
      />

      <div className="card">
        <div className="spread">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{asset.name}</div>
            <div className="muted small">
              {asset.typeLabel}
              {asset.plate ? ` · ${asset.plate}` : ''}
              {asset.project ? ` · ${asset.project}` : ''}
            </div>
          </div>
          <span className={`pill ${asset.status}`}>
            <span className="dot" />
            {STATUS_LABEL[asset.status]}
          </span>
        </div>

        <div className="card-row" style={{ marginTop: 10 }}>
          <span className="label">Konum</span>
          <span className="value">
            {asset.geofences.length > 0
              ? asset.geofences.map((g) => g.name).join(', ')
              : asset.position
                ? `${asset.position.lat.toFixed(5)}, ${asset.position.lon.toFixed(5)}`
                : 'bilinmiyor'}
          </span>
        </div>
        <div className="card-row">
          <span className="label">Son sinyal</span>
          <span className="value">{formatAge(asset.position?.ageSec ?? null)}</span>
        </div>
      </div>

      {/* 2-3) Kacta calisti / kac saat calisti */}
      <div className="card">
        <h2>Bugunku calisma</h2>
        <div className="metrics">
          <div className="metric">
            <span className="big">{formatTime(asset.today.firstStartAt, tz)}</span>
            <span className="cap">ilk calistirma</span>
          </div>
          <div className="metric">
            <span className="big">{formatHours(asset.today.engineHours)}</span>
            <span className="cap">motor calisma</span>
          </div>
          <div className="metric">
            <span className="big">{formatHours(asset.today.idleHours)}</span>
            <span className="cap">rolanti</span>
          </div>
        </div>
        <div className="card-row" style={{ marginTop: 10 }}>
          <span className="label">Efektif calisma</span>
          <span className="value">{formatHours(asset.today.workingHours)}</span>
        </div>
        <div className="card-row">
          <span className="label">Son durdurma</span>
          <span className="value">
            {asset.today.running ? 'hala calisiyor' : formatTime(asset.today.lastStopAt, tz)}
          </span>
        </div>

        {sessions.length > 0 && (
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Oturum</th>
                <th className="num">Sure</th>
                <th className="num">Rolanti</th>
                <th className="num">km</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {formatTime(s.startedAt, tz)} - {s.open ? '...' : formatTime(s.endedAt, tz)}
                  </td>
                  <td className="num">{formatHours(s.durationSec / 3600)}</td>
                  <td className="num">{formatHours(s.idleSec / 3600)}</td>
                  <td className="num">{s.distanceKm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4) Kim kullaniyor */}
      <div className="card">
        <h2>Kim kullaniyor</h2>
        {asset.operator ? (
          <div className="spread">
            <div>
              <div style={{ fontWeight: 650 }}>{asset.operator.name}</div>
              <div className="muted small">
                {asset.operator.source === 'roster' ? 'Vardiya plani' : 'Elle atama'}
              </div>
            </div>
            {asset.operator.phone && (
              <a className="btn" href={`tel:${asset.operator.phone}`}>
                Ara
              </a>
            )}
          </div>
        ) : (
          <div className="notice warn">
            Bu makineye vardiya atamasi yapilmamis. Hakedis ve sorumluluk takibi icin operator
            atayin.
          </div>
        )}
      </div>

      {/* 5) Goruntu */}
      <div className="card">
        <h2>Goruntu</h2>
        {asset.cameras.length === 0 ? (
          <div className="muted small">Bu makinede kamera tanimli degil.</div>
        ) : (
          <>
            <div className="camera-grid">
              {asset.cameras.map((cam) => {
                const cabin = cam.position === 'cabin';
                return (
                  <button
                    key={cam.id}
                    className={`camera-tile${!cabin && !cam.liveAllowed ? ' blocked' : ''}`}
                    onClick={() => setCamera(cam)}
                  >
                    <span className="name">{cam.positionLabel}</span>
                    <span className="hint">
                      {cabin
                        ? 'Olay bazli · canli izleme kapali'
                        : cam.liveAllowed
                          ? 'Canli izle'
                          : (cam.liveBlockedReason ?? 'Su anda erisilemez')}
                    </span>
                    <span className="row tiny muted">
                      {cam.sdRecording && <span>SD kayit</span>}
                      <span>{cam.recordsAudio ? 'ses acik' : 'ses kapali'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="notice info" style={{ marginTop: 10 }}>
              Her goruntuleme amac ve gerekce ile kayit altina alinir, operatore bildirilir. Kabin
              ici kamera canli izlenemez.
            </div>
          </>
        )}
      </div>

      {/* 6) Yakit ve calisma verisi */}
      <div className="card">
        <h2>Yakit ve makine verisi</h2>
        <div className="card-row">
          <span className="label">Yakit seviyesi</span>
          <span className="value">
            {asset.fuel.levelPct !== null ? `%${Math.round(asset.fuel.levelPct)}` : '-'}
            {asset.fuel.tankLiters && asset.fuel.levelPct !== null
              ? ` (~${Math.round((asset.fuel.levelPct * asset.fuel.tankLiters) / 100)} lt)`
              : ''}
          </span>
        </div>
        <div className="card-row">
          <span className="label">Bugunku tuketim</span>
          <span className="value">{asset.fuel.usedLitersToday.toFixed(1)} lt</span>
        </div>
        <div className="card-row">
          <span className="label">Toplam motor saati</span>
          <span className="value">
            {asset.fuel.engineHoursTotal !== null ? `${Math.round(asset.fuel.engineHoursTotal)} saat` : '-'}
          </span>
        </div>
        {asset.fuel.odometerKm !== null && (
          <div className="card-row">
            <span className="label">Kilometre</span>
            <span className="value">{asset.fuel.odometerKm.toLocaleString('tr-TR')} km</span>
          </div>
        )}
      </div>

      {/* 7) Gunluk hakedis */}
      <div className="card">
        <h2>Gunluk hakedis</h2>
        {billing ? (
          <>
            <div className="spread">
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatMoney(billing.amountTotal, billing.currency)}
                </div>
                <div className="muted small">
                  {billing.billableHours} saat faturalanabilir
                  {billing.overtimeHours > 0 ? ` (${billing.overtimeHours} saat mesai)` : ''}
                </div>
              </div>
              <span className={`pill ${billing.status === 'draft' ? 'idle' : 'working'}`}>
                {billing.status === 'draft' ? 'Taslak' : billing.status === 'approved' ? 'Onayli' : 'Faturalandi'}
              </span>
            </div>

            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setShowLines((v) => !v)}>
              {showLines ? 'Dokumu gizle' : 'Hesap dokumunu gor'}
            </button>

            {showLines && (
              <table className="table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Kalem</th>
                    <th className="num">Miktar</th>
                    <th className="num">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.lines.map((line) => (
                    <tr key={line.code}>
                      <td>{line.label}</td>
                      <td className="num">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="num">{formatMoney(line.amount, billing.currency)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="muted">KDV</td>
                    <td />
                    <td className="num">{formatMoney(billing.amountVat, billing.currency)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div className="muted small">Bu gun icin hakedis hesaplanmadi.</div>
        )}
      </div>

      {asset.alerts.length > 0 && (
        <div className="card">
          <h2>Uyarilar</h2>
          {asset.alerts.slice(0, 8).map((alert) => (
            <div className="card-row" key={alert.id}>
              <span className="label">
                <span className={`pill ${alert.severity === 'critical' ? 'danger' : 'idle'}`}>
                  {eventLabel(alert.type)}
                </span>
              </span>
              <span className="value small muted">{formatDateTime(alert.ts, tz)}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn block" onClick={onBack}>
        Filo listesine don
      </button>

      {camera && (
        <CameraDialog
          assetId={asset.id}
          assetName={asset.name}
          camera={camera}
          purposes={purposes}
          onClose={() => setCamera(null)}
        />
      )}
    </div>
  );
}
