/**
 * Bagimsiz kayit cihazi icin "bu olayi SD kartta nerede bulurum" penceresi.
 *
 * Goruntu platform uzerinden akmadiginda yapilacak is bellidir: kayit cihazinin
 * kartini cikarip dogru zaman araligina gitmek. Buradaki tek katma deger,
 * cihazin saat sapmasi uygulanmis dogru araligi vermektir.
 */

import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import type { ClipWindowDto } from '../api.js';
import { eventLabel, formatDateTime } from '../format.js';

interface Props {
  eventId: number;
  onClose: () => void;
}

const SPANS = [
  { label: '±30 sn', value: 30 },
  { label: '±2 dk', value: 120 },
  { label: '±5 dk', value: 300 },
];

export function ClipWindowDialog({ eventId, onClose }: Props): JSX.Element {
  const [span, setSpan] = useState(30);
  const [data, setData] = useState<ClipWindowDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ClipWindowDto>(`/api/events/${eventId}/clip-window?beforeSec=${span}&afterSec=${span}`)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Bilgi alinamadi');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, span]);

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Panoya kopyalanamadi');
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Kayit cihazinda ara</h3>
        <p className="modal-sub">
          {data ? `${eventLabel(data.eventType)} · ${formatDateTime(data.eventAt, data.timezone)}` : 'Yukleniyor...'}
        </p>

        {error && <div className="notice error">{error}</div>}

        <div className="row" style={{ marginBottom: 12 }}>
          {SPANS.map((option) => (
            <button
              key={option.value}
              className={`btn${span === option.value ? ' primary' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setSpan(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {data?.recorders.length === 0 && (
          <div className="notice warn">
            Bu makinede kayit yapan kamera tanimli degil. Kayit cihazini sisteme
            tanitirsaniz olay saatini burada gosterebilirim.
          </div>
        )}

        {data?.recorders.map((recorder) => (
          <div className="card" key={recorder.cameraId} style={{ marginBottom: 10 }}>
            <div className="spread">
              <strong>{recorder.label}</strong>
              {recorder.retrieval === 'manual' && <span className="pill idle">SD kart</span>}
            </div>
            {recorder.deviceModel && <div className="tiny muted">{recorder.deviceModel}</div>}

            <div className="card-row" style={{ marginTop: 8 }}>
              <span className="label">Baslangic</span>
              <span className="value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {recorder.searchFrom}
              </span>
            </div>
            <div className="card-row">
              <span className="label">Bitis</span>
              <span className="value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {recorder.searchTo}
              </span>
            </div>

            <div className="tiny muted" style={{ marginTop: 6 }}>
              {recorder.note}
            </div>

            <button
              className="btn block"
              style={{ marginTop: 10 }}
              onClick={() => void copy(`${recorder.searchFrom} - ${recorder.searchTo}`)}
            >
              {copied ? 'Kopyalandi' : 'Zaman araligini kopyala'}
            </button>
          </div>
        ))}

        {data && data.recorders.some((r) => r.clockOffsetSec === 0) && (
          <div className="notice info">
            Kayit cihazinin saati zamanla kayar. Bir kez olcup{' '}
            <strong>cihaz ayarlarindan saat sapmasini</strong> girerseniz, aradiginiz an her
            seferinde dogru cikar.
          </div>
        )}

        <div className="modal-actions">
          <button className="btn block" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
