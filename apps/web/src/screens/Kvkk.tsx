/**
 * KVKK ekrani.
 *
 * Iki farkli kullaniciya hizmet eder:
 *  - Operator: kendi verisine kimin eristigini gorur, bildirimlerini okur,
 *    aydinlatma metnini teyit eder, basvuru yapar. (KVKK m.11)
 *  - Yonetim / KVKK irtibat kisisi: uyum panosunu ve denetim kaydini gorur.
 */

import { useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import type { AccessLogDto, ComplianceDto, Me, NotificationDto } from '../api.js';
import { formatDateTime } from '../format.js';

interface Props {
  me: Me;
  onReload: () => void;
}

interface NoticeRow {
  id: string;
  kind: string;
  version: string;
  title: string;
  acknowledged: boolean;
  granted_at: string | null;
}

export function Kvkk({ me, onReload }: Props): JSX.Element {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [compliance, setCompliance] = useState<ComplianceDto | null>(null);
  const [noticeBody, setNoticeBody] = useState<{ title: string; body: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dsrText, setDsrText] = useState('');
  const [dsrType, setDsrType] = useState('access');

  const isManagement = ['owner', 'manager', 'dpo'].includes(me.role);

  async function load(): Promise<void> {
    const [n, log, notif] = await Promise.all([
      api.get<NoticeRow[]>('/api/kvkk/notices').catch(() => []),
      api.get<AccessLogDto[]>('/api/kvkk/my-access-log').catch(() => []),
      api.get<NotificationDto[]>('/api/notifications').catch(() => []),
    ]);
    setNotices(n);
    setAccessLog(log);
    setNotifications(notif);
    if (isManagement) {
      setCompliance(await api.get<ComplianceDto>('/api/kvkk/compliance').catch(() => null));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openNotice(id: string): Promise<void> {
    const notice = await api.get<{ title: string; body_md: string }>(`/api/kvkk/notices/${id}`);
    setNoticeBody({ title: notice.title, body: notice.body_md });
  }

  async function acknowledge(id: string): Promise<void> {
    try {
      await api.post(`/api/kvkk/notices/${id}/acknowledge`, { kind: 'ack', method: 'app' });
      setMessage('Aydinlatma metnini okudugunuz kayit altina alindi.');
      await load();
      onReload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Teyit kaydedilemedi');
    }
  }

  async function submitDsr(): Promise<void> {
    try {
      const result = await api.post<{ dueAt: string; note: string }>('/api/kvkk/dsr', {
        requestType: dsrType,
        description: dsrText,
      });
      setMessage(result.note);
      setDsrText('');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Basvuru gonderilemedi');
    }
  }

  return (
    <div className="content">
      {message && <div className="notice ok">{message}</div>}

      {isManagement && compliance && (
        <div className="card">
          <h2>Uyum panosu</h2>
          <div className="spread" style={{ marginBottom: 10 }}>
            <span className="muted small">Uyum skoru</span>
            <span style={{ fontSize: 24, fontWeight: 700 }}>%{compliance.score}</span>
          </div>
          {compliance.checks.map((check) => (
            <div className="card-row" key={check.code}>
              <span className="label">
                <span className={`pill ${check.ok ? 'working' : 'danger'}`}>
                  {check.ok ? 'tamam' : 'eksik'}
                </span>{' '}
                {check.label}
              </span>
              <span className="value tiny muted">{check.detail}</span>
            </div>
          ))}
          <div className="tiny muted" style={{ marginTop: 8 }}>
            Son 30 gun: {compliance.stats.cameraViewsLast30d} kamera goruntuleme,{' '}
            {compliance.stats.deniedLast30d} reddedilen erisim.
          </div>
        </div>
      )}

      <div className="card">
        <h2>Aydinlatma metinleri</h2>
        {notices.length === 0 && <div className="muted small">Yayimlanmis metin yok.</div>}
        {notices.map((notice) => (
          <div className="card-row" key={notice.id}>
            <span className="label">
              <button className="btn ghost" style={{ padding: '4px 0', minHeight: 0, border: 0 }} onClick={() => void openNotice(notice.id)}>
                {notice.title}
              </button>
              <span className="tiny muted"> v{notice.version}</span>
            </span>
            <span className="value">
              {notice.acknowledged ? (
                <span className="pill working">okundu</span>
              ) : (
                <button className="btn" onClick={() => void acknowledge(notice.id)}>
                  Okudum, onayliyorum
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Verime kim eristi</h2>
        {accessLog.length === 0 ? (
          <div className="muted small">
            Kamera goruntunuze veya kaydinza yapilmis bir erisim bulunmuyor.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kim</th>
                <th>Amac</th>
              </tr>
            </thead>
            <tbody>
              {accessLog.slice(0, 20).map((row, index) => (
                <tr key={`${row.ts}-${index}`}>
                  <td>{formatDateTime(row.ts)}</td>
                  <td>
                    {row.viewer_name ?? '-'}
                    <div className="tiny muted">{row.asset_name ?? ''}</div>
                  </td>
                  <td>
                    {row.purposeLabel}
                    <div className="tiny muted">{row.reason ?? ''}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Bildirimler</h2>
        {notifications.length === 0 ? (
          <div className="muted small">Bildirim yok.</div>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <div className="card-row" key={notification.id}>
              <span className="label">
                <strong>{notification.title}</strong>
                <div className="tiny muted">{notification.body}</div>
              </span>
              <span className="value tiny muted">{formatDateTime(notification.created_at)}</span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>KVKK basvurusu</h2>
        <label className="field">
          <span className="lab">Talep turu</span>
          <select value={dsrType} onChange={(e) => setDsrType(e.target.value)}>
            <option value="access">Verilerime erisim / bilgi talebi</option>
            <option value="rectification">Yanlis veriyi duzeltme</option>
            <option value="erasure">Silme / yok etme</option>
            <option value="objection">Islemeye itiraz</option>
            <option value="restriction">Islemenin sinirlandirilmasi</option>
          </select>
        </label>
        <label className="field">
          <span className="lab">Aciklama</span>
          <textarea
            value={dsrText}
            onChange={(e) => setDsrText(e.target.value)}
            placeholder="Talebinizi tarih araligi ve makine bilgisiyle aciklayin."
          />
        </label>
        <button className="btn primary block" onClick={() => void submitDsr()} disabled={dsrText.trim().length < 10}>
          Basvuruyu gonder
        </button>
        <p className="tiny muted">
          Basvurunuz KVKK m.13 uyarinca en gec 30 gun icinde yanitlanir. Iletisim:{' '}
          {me.company.kvkkContact ?? 'KVKK irtibat kisisi'}
        </p>
      </div>

      {noticeBody && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setNoticeBody(null)}>
          <div className="modal">
            <h3>{noticeBody.title}</h3>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 13.5,
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {noticeBody.body}
            </pre>
            <div className="modal-actions">
              <button className="btn block" onClick={() => setNoticeBody(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
