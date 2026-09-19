import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { ApiError, api } from '../api.js';
import type { CameraDto, LiveStreamDto, PurposeDto } from '../api.js';

interface Props {
  assetName: string;
  camera: CameraDto;
  purposes: PurposeDto[];
  /** Tek kullanici modu: gerekce ve kabin kisitlari uygulanmaz. */
  soloMode: boolean;
  onClose: () => void;
}

/** Kabin kamerasi icin canli izleme secenegi hic gosterilmez. */
const CABIN_PURPOSES = new Set(['kaza_inceleme', 'is_guvenligi', 'hukuki_talep']);

export function CameraDialog({ assetName, camera, purposes, soloMode, onClose }: Props): JSX.Element {
  // Kabin kisitlari calisan mahremiyeti icindir; kisi kendi goruntusune
  // bakiyorsa uygulanmaz.
  const isCabin = camera.position === 'cabin' && !soloMode;
  const [purpose, setPurpose] = useState(isCabin ? 'kaza_inceleme' : 'is_guvenligi');
  const [reason, setReason] = useState('');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<LiveStreamDto | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const available = purposes.filter((p) => (isCabin ? CABIN_PURPOSES.has(p.code) : true));

  async function start(): Promise<void> {
    setError(null);
    if (!soloMode && reason.trim().length < 15) {
      setError('Gerekce en az 15 karakter olmalidir. Bu metin denetim kaydina yazilir.');
      return;
    }
    if (isCabin && !eventId.trim()) {
      setError('Kabin ici goruntu icin olay kaydi numarasi zorunludur.');
      return;
    }

    setBusy(true);
    try {
      const result = isCabin
        ? await api.post<LiveStreamDto>('/api/media/playback', {
            cameraId: camera.id,
            purpose,
            reason: reason.trim(),
            eventId: eventId.trim(),
            // Olay referansi verildiginde sunucu pencereyi olayin +/- 30 sn'sine
            // sabitler; buradaki degerler yalnizca dogrulamayi gecmek icindir.
            from: new Date(Date.now() - 60_000).toISOString(),
            to: new Date().toISOString(),
          })
        : await api.post<LiveStreamDto>('/api/media/live', {
            cameraId: camera.id,
            purpose,
            reason: reason.trim(),
          });

      setStream(result);
      setRemaining(result.maxDurationSec ?? 300);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Goruntu acilamadi');
    } finally {
      setBusy(false);
    }
  }

  async function stop(): Promise<void> {
    if (stream) {
      await api.post(`/api/media/${stream.sessionId}/stop`).catch(() => undefined);
    }
    onClose();
  }

  // Yayin adresi geldiginde oynaticiyi kur.
  // hls.js yalnizca goruntu acildiginda indirilir: mobil veride ilk acilisi
  // ~300 kB hafifletir.
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    let disposed = false;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS HLS'i yerel olarak oynatir.
      video.src = stream.playbackUrl;
    } else {
      void import('hls.js').then(({ default: HlsCtor }) => {
        if (disposed || !HlsCtor.isSupported()) return;
        const hls = new HlsCtor({ lowLatencyMode: true, liveSyncDurationCount: 2 });
        hls.loadSource(stream.playbackUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      });
    }

    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [stream]);

  // Izleme suresi sinirli: sure dolunca oturum kendiliginden kapanir.
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      void stop();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && void stop()}>
      <div className="modal">
        <h3>
          {camera.positionLabel} - {assetName}
        </h3>
        <p className="modal-sub">
          {isCabin
            ? 'Kabin ici kamera - olaya bagli kayit incelemesi'
            : 'Dis kamera - canli goruntu'}
        </p>

        {isCabin && (
          <div className="notice warn">
            <strong>Kabin ici kamera canli izlenemez.</strong> Yalnizca sisteme dusen bir olayin
            (kaza, sert fren, acil durum) +/- 30 saniyelik kaydi acilabilir. Bu erisim kayit altina
            alinir, operatore bildirilir ve ikinci bir yetkilinin onayina tabidir.
          </div>
        )}

        {!stream && (
          <>
            {soloMode ? (
              <div className="notice info">
                Bu goruntuleme <strong>denetim kaydina</strong> yazilir. Tek kullanici modunda
                oldugunuz icin gerekce istenmez.
              </div>
            ) : (
              <div className="notice info">
                Bu goruntuleme <strong>denetim kaydina</strong> yazilacak ve aracin operatorune
                <strong> bildirim gonderilecektir</strong>. Goruntu yalnizca sectiginiz amac icin
                kullanilabilir.
              </div>
            )}

            <label className="field">
              <span className="lab">Isleme amaci</span>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {available.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="tiny muted">
                {available.find((p) => p.code === purpose)?.legalBasis}
              </span>
            </label>

            {isCabin && (
              <label className="field">
                <span className="lab">Olay kaydi no (zorunlu)</span>
                <input
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  inputMode="numeric"
                  placeholder="or. 1423"
                />
              </label>
            )}

            {!soloMode && (
              <label className="field">
                <span className="lab">Gerekce (en az 15 karakter)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Neden bu goruntuye erismeniz gerekiyor?"
                />
                <span className="tiny muted">{reason.trim().length} karakter</span>
              </label>
            )}

            {error && <div className="notice error">{error}</div>}

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => void stop()}>
                Vazgec
              </button>
              <button className="btn primary" onClick={() => void start()} disabled={busy}>
                {busy ? 'Aciliyor...' : isCabin ? 'Kaydi ac' : 'Canli izle'}
              </button>
            </div>
          </>
        )}

        {stream && (
          <>
            <video ref={videoRef} controls autoPlay playsInline muted={!stream.audio} />
            <div className="notice ok" style={{ marginTop: 12 }}>
              {stream.notice}
            </div>
            {stream.note && <div className="notice info">{stream.note}</div>}
            <div className="spread small muted">
              <span>Ses: {stream.audio ? 'acik' : 'kapali'}</span>
              <span>
                Kalan sure: {remaining !== null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '-'}
              </span>
            </div>
            <div className="modal-actions">
              <button className="btn block" onClick={() => void stop()}>
                Izlemeyi bitir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
