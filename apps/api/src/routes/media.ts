/**
 * Kamera uclari: canli izleme, SD karttan geri oynatma, olay klibi cekme.
 *
 * Her istek once KVKK erisim politikasindan gecer (guardAccess), sonra
 * denetim kaydi yazilir, sonra cihaza komut gonderilir. Politika izin
 * vermezse cihaza hicbir komut gitmez.
 *
 * Seffaflik: izin verilen her goruntuleme, ilgili operatorun bildirim
 * kutusuna dusürulur. "Gizli kamera yok" ilkesi burada isletilir.
 */

import type { FastifyInstance } from 'fastify';
import { EVENT_CLIP_AFTER_SEC, EVENT_CLIP_BEFORE_SEC } from '@medentry/domain';
import { CAMERA_POSITION_LABELS } from '@medentry/shared';
import type { CameraPosition } from '@medentry/shared';
import { HttpError, currentUser, requireAuth, requestMeta } from '../auth/context.js';
import { createStreamToken } from '../auth/jwt.js';
import { config } from '../config.js';
import { query, queryOne } from '../db/pool.js';
import { guardAccess, notifyOperatorOfAccess } from '../kvkk/guard.js';
import { mediaProvider } from '../media/index.js';
import type { CameraTarget } from '../media/provider.js';
import { date, optionalStr, str, uuid } from './validate.js';

interface CameraRow {
  id: string;
  company_id: string;
  asset_id: string;
  asset_name: string;
  channel_no: number;
  position: string;
  privacy_class: string;
  records_audio: boolean;
  event_only: boolean;
  retrieval: string;
  device_ident: string;
  device_model: string | null;
  protocol: string;
  utc_offset_minutes: number;
  clock_offset_sec: number;
}

async function loadCamera(companyId: string, cameraId: string): Promise<CameraRow> {
  const row = await queryOne<CameraRow>(
    `SELECT c.id, c.company_id, d.asset_id, a.name AS asset_name, c.channel_no, c.position,
            c.privacy_class, c.records_audio, c.event_only, c.retrieval,
            d.ident AS device_ident, d.model AS device_model, d.protocol,
            d.utc_offset_minutes, d.clock_offset_sec
       FROM device_cameras c
       JOIN devices d ON d.id = c.device_id
       JOIN assets a ON a.id = d.asset_id
      WHERE c.id = $1 AND c.company_id = $2 AND c.is_active`,
    [cameraId, companyId],
  );
  if (!row) throw new HttpError(404, 'Kamera bulunamadi');
  return row;
}

/**
 * Bagimsiz kayit cihazi (SD kart) platform uzerinden akis veremez.
 * Kullaniciya bos bir oynatici yerine, kaydi cihazda nerede bulacagini soyleriz.
 */
function assertIntegrated(camera: CameraRow): void {
  if (camera.retrieval === 'manual') {
    throw new HttpError(
      409,
      `Bu kamera bagimsiz bir kayit cihazina bagli (${camera.device_model ?? 'kayit cihazi'}). ` +
        'Goruntu platform uzerinden akmaz; SD karttan elle alinir. ' +
        'Olay listesindeki "SD kayit araligi" bilgisini kullanin.',
      'MANUAL_RETRIEVAL',
    );
  }
}

function target(camera: CameraRow): CameraTarget {
  return {
    deviceIdent: camera.device_ident,
    protocol: camera.protocol,
    channelNo: camera.channel_no,
    utcOffsetMinutes: camera.utc_offset_minutes,
  };
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  /** Varliga bagli kameralar. */
  app.get('/api/assets/:assetId/cameras', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const assetId = uuid((request.params as Record<string, unknown>)['assetId'], 'assetId');

    const rows = await query<{
      id: string;
      channel_no: number;
      position: string;
      label: string | null;
      privacy_class: string;
      records_audio: boolean;
      event_only: boolean;
      sd_recording: boolean;
      retrieval: string;
      device_model: string | null;
    }>(
      `SELECT c.id, c.channel_no, c.position, c.label, c.privacy_class, c.records_audio,
              c.event_only, c.sd_recording, c.retrieval, d.model AS device_model
         FROM device_cameras c
         JOIN devices d ON d.id = c.device_id
        WHERE d.asset_id = $1 AND c.company_id = $2 AND c.is_active
        ORDER BY c.channel_no`,
      [assetId, user.companyId],
    );

    return rows.map((row) => ({
      id: row.id,
      channelNo: row.channel_no,
      position: row.position,
      positionLabel: CAMERA_POSITION_LABELS[row.position as CameraPosition] ?? row.position,
      label: row.label,
      privacyClass: row.privacy_class,
      recordsAudio: row.records_audio,
      eventOnly: row.event_only,
      sdRecording: row.sd_recording,
      retrieval: row.retrieval,
      deviceModel: row.device_model,
      // Bagimsiz kayit cihazindan ve kabinden canli yayin alinmaz.
      liveCapable: row.retrieval !== 'manual' && row.position !== 'cabin',
    }));
  });

  /** Canli izleme baslat. */
  app.post('/api/media/live', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const body = request.body as Record<string, unknown>;
    const cameraId = uuid(body['cameraId'], 'cameraId');
    const purpose = str(body, 'purpose');
    // Gerekce zorunlulugunu politika katmani belirler (tek kullanici modunda
    // kisi kendi goruntusune bakarken gerekce istenmez).
    const reason = optionalStr(body, 'reason') ?? '';

    const camera = await loadCamera(user.companyId, cameraId);
    assertIntegrated(camera);
    const guard = await guardAccess({
      user,
      purpose,
      dataType: 'camera_live',
      action: 'camera_live_start',
      assetId: camera.asset_id,
      cameraPosition: camera.position as CameraPosition,
      reason,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    // Ayni kullanicinin ayni kamerada acik oturumu varsa yenisi acilmaz.
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM media_sessions
        WHERE camera_id = $1 AND user_id = $2 AND mode = 'live' AND ended_at IS NULL`,
      [cameraId, user.id],
    );
    if (existing) {
      await query(`UPDATE media_sessions SET ended_at = now() WHERE id = $1`, [existing.id]);
    }

    const session = await queryOne<{ id: string }>(
      `INSERT INTO media_sessions
         (company_id, asset_id, camera_id, user_id, mode, purpose, reason, ip, user_agent)
       VALUES ($1,$2,$3,$4,'live',$5,$6,$7,$8)
       RETURNING id`,
      [
        user.companyId,
        camera.asset_id,
        cameraId,
        user.id,
        purpose,
        reason || 'Tek kullanici modu - gerekce istenmedi',
        meta.ip,
        meta.userAgent,
      ],
    );
    if (!session) throw new HttpError(500, 'Izleme oturumu olusturulamadi');

    const streamToken = createStreamToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      mediaSessionId: session.id,
      cameraId,
    });

    const handle = await mediaProvider().startLive({
      ...target(camera),
      mediaSessionId: session.id,
      streamToken,
      // Ses yalnizca kamera icin acikca tanimlanmissa aktarilir.
      audio: camera.records_audio,
      substream: true,
    });

    // Seffaflik yukumlulugu: operatore bildirim birak.
    if (guard.subjectUserId) {
      await notifyOperatorOfAccess({
        companyId: user.companyId,
        operatorId: guard.subjectUserId,
        assetName: camera.asset_name,
        viewerName: user.name,
        purpose: purpose as Parameters<typeof notifyOperatorOfAccess>[0]['purpose'],
        reason,
        mode: 'live',
      });
      await query(`UPDATE media_sessions SET operator_notified_at = now() WHERE id = $1`, [session.id]);
    }

    return {
      sessionId: session.id,
      playbackUrl: handle.playbackUrl,
      protocol: handle.protocol,
      expiresAt: handle.expiresAt,
      maxDurationSec: config.media.liveSessionMaxSeconds,
      audio: camera.records_audio,
      note: handle.note,
      obligations: guard.decision.obligations,
      notice:
        'Bu goruntuleme kayit altina alindi ve ilgili operatore bildirildi. ' +
        'Goruntu yalnizca belirttiginiz amac icin kullanilabilir.',
    };
  });

  /** Canli izlemeyi sonlandir. */
  app.post('/api/media/:sessionId/stop', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const sessionId = uuid((request.params as Record<string, unknown>)['sessionId'], 'sessionId');

    const session = await queryOne<{ camera_id: string; user_id: string }>(
      `SELECT camera_id, user_id FROM media_sessions
        WHERE id = $1 AND company_id = $2 AND ended_at IS NULL`,
      [sessionId, user.companyId],
    );
    if (!session) return { ok: true, alreadyClosed: true };

    const camera = await loadCamera(user.companyId, session.camera_id);
    await mediaProvider().stopLive({ ...target(camera), mediaSessionId: sessionId });
    await query(`UPDATE media_sessions SET ended_at = now() WHERE id = $1`, [sessionId]);

    return { ok: true };
  });

  /** SD karttaki kaydi geri oynat. */
  app.post('/api/media/playback', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const body = request.body as Record<string, unknown>;
    const cameraId = uuid(body['cameraId'], 'cameraId');
    const purpose = str(body, 'purpose');
    const reason = optionalStr(body, 'reason') ?? '';
    const eventId = optionalStr(body, 'eventId');

    const camera = await loadCamera(user.companyId, cameraId);
    assertIntegrated(camera);

    let from = date(body['from'], 'from');
    let to = date(body['to'], 'to');

    // Kabin goruntusu yalnizca olaya bagli ve dar bir pencerede acilir.
    if (camera.position === 'cabin') {
      if (!eventId) {
        throw new HttpError(
          400,
          'Kabin ici goruntu icin olay kaydi referansi zorunludur',
          'CABIN_EVENT_REQUIRED',
        );
      }
      const event = await queryOne<{ ts: Date }>(
        `SELECT ts FROM device_events WHERE id = $1 AND company_id = $2`,
        [Number(eventId), user.companyId],
      );
      if (!event) throw new HttpError(404, 'Olay kaydi bulunamadi');
      from = new Date(new Date(event.ts).getTime() - EVENT_CLIP_BEFORE_SEC * 1000);
      to = new Date(new Date(event.ts).getTime() + EVENT_CLIP_AFTER_SEC * 1000);
    }

    if (to.getTime() <= from.getTime()) {
      throw new HttpError(400, 'Bitis zamani baslangictan sonra olmalidir', 'INVALID_RANGE');
    }
    const windowMinutes = (to.getTime() - from.getTime()) / 60_000;
    if (windowMinutes > 60) {
      throw new HttpError(400, 'Tek seferde en fazla 60 dakikalik kayit izlenebilir', 'RANGE_TOO_WIDE');
    }

    const guard = await guardAccess({
      user,
      purpose,
      dataType: 'camera_playback',
      action: 'camera_playback',
      assetId: camera.asset_id,
      cameraPosition: camera.position as CameraPosition,
      reason,
      linkedEventId: eventId,
      ts: from,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const session = await queryOne<{ id: string }>(
      `INSERT INTO media_sessions
         (company_id, asset_id, camera_id, user_id, mode, purpose, reason, linked_event_id,
          window_start, window_end, ip, user_agent)
       VALUES ($1,$2,$3,$4,'playback',$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        user.companyId,
        camera.asset_id,
        cameraId,
        user.id,
        purpose,
        reason || 'Tek kullanici modu - gerekce istenmedi',
        eventId ? Number(eventId) : null,
        from,
        to,
        meta.ip,
        meta.userAgent,
      ],
    );
    if (!session) throw new HttpError(500, 'Izleme oturumu olusturulamadi');

    const streamToken = createStreamToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      mediaSessionId: session.id,
      cameraId,
      ttlSeconds: Math.max(config.media.streamTokenTtlSeconds, Math.ceil(windowMinutes * 60) + 120),
    });

    const handle = await mediaProvider().startPlayback({
      ...target(camera),
      mediaSessionId: session.id,
      streamToken,
      from,
      to,
    });

    if (guard.subjectUserId) {
      await notifyOperatorOfAccess({
        companyId: user.companyId,
        operatorId: guard.subjectUserId,
        assetName: camera.asset_name,
        viewerName: user.name,
        purpose: purpose as Parameters<typeof notifyOperatorOfAccess>[0]['purpose'],
        reason,
        mode: 'playback',
      });
      await query(`UPDATE media_sessions SET operator_notified_at = now() WHERE id = $1`, [session.id]);
    }

    return {
      sessionId: session.id,
      playbackUrl: handle.playbackUrl,
      protocol: handle.protocol,
      from,
      to,
      expiresAt: handle.expiresAt,
      note: handle.note,
      obligations: guard.decision.obligations,
    };
  });

  /** SD karttaki kayit listesi. */
  app.get('/api/media/sd', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const q = request.query as Record<string, unknown>;
    const cameraId = uuid(q['cameraId'], 'cameraId');
    const from = date(q['from'], 'from');
    const to = date(q['to'], 'to');
    const purpose = typeof q['purpose'] === 'string' ? q['purpose'] : 'is_guvenligi';

    const camera = await loadCamera(user.companyId, cameraId);
    assertIntegrated(camera);
    await guardAccess({
      user,
      purpose,
      dataType: 'camera_playback',
      action: 'sd_list',
      assetId: camera.asset_id,
      cameraPosition: camera.position as CameraPosition,
      reason: 'SD kart kayit listesi sorgulandi (goruntu acilmadi)',
      // Kabin kanalinin listesi de olay referansi ister; liste sorgusu
      // goruntu acmaz ama yine de kayit altina alinir.
      linkedEventId: typeof q['eventId'] === 'string' ? q['eventId'] : undefined,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const items = await mediaProvider().listSdRecordings({ ...target(camera), from, to });
    return {
      cameraId,
      items: items.map((item) => ({
        startTime: item.startTime,
        endTime: item.endTime,
        sizeMb: Math.round(item.sizeBytes / (1024 * 1024)),
        channel: item.channel,
      })),
    };
  });

  /** Olay klibini sunucuya cektir (SD -> bulut). */
  app.post('/api/media/clip', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const body = request.body as Record<string, unknown>;
    const cameraId = uuid(body['cameraId'], 'cameraId');
    const purpose = str(body, 'purpose');
    const reason = optionalStr(body, 'reason') ?? '';
    const eventId = optionalStr(body, 'eventId');

    const camera = await loadCamera(user.companyId, cameraId);
    assertIntegrated(camera);

    let from = date(body['from'], 'from');
    let to = date(body['to'], 'to');
    if (eventId) {
      const event = await queryOne<{ ts: Date }>(
        `SELECT ts FROM device_events WHERE id = $1 AND company_id = $2`,
        [Number(eventId), user.companyId],
      );
      if (!event) throw new HttpError(404, 'Olay kaydi bulunamadi');
      from = new Date(new Date(event.ts).getTime() - EVENT_CLIP_BEFORE_SEC * 1000);
      to = new Date(new Date(event.ts).getTime() + EVENT_CLIP_AFTER_SEC * 1000);
    }

    await guardAccess({
      user,
      purpose,
      dataType: 'recording_download',
      action: 'clip_request',
      assetId: camera.asset_id,
      cameraPosition: camera.position as CameraPosition,
      reason,
      linkedEventId: eventId,
      ts: from,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const requestRow = await queryOne<{ id: string }>(
      `INSERT INTO media_requests
         (company_id, asset_id, camera_id, requested_by, event_id, window_start, window_end, purpose, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        user.companyId,
        camera.asset_id,
        cameraId,
        user.id,
        eventId ? Number(eventId) : null,
        from,
        to,
        purpose,
        reason || 'Tek kullanici modu - gerekce istenmedi',
      ],
    );

    await mediaProvider().requestUpload({
      ...target(camera),
      from,
      to,
      path: `/kayitlar/${camera.asset_id}/${requestRow?.id ?? 'manuel'}`,
    });
    await query(`UPDATE media_requests SET status = 'sent', updated_at = now() WHERE id = $1`, [
      requestRow?.id ?? null,
    ]);

    return { id: requestRow?.id, status: 'sent', from, to };
  });

  /**
   * Bagimsiz kayit cihazi icin "bu olayi SD kartta nerede bulurum" yaniti.
   *
   * Kayit cihazlarinin saati gercek saatten kayar; bu sapma (clock_offset_sec)
   * uygulanarak cihazda aranacak zaman araligi verilir.
   */
  app.get('/api/events/:id/clip-window', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const meta = requestMeta(request);
    const q = request.query as Record<string, unknown>;
    const eventId = Number((request.params as Record<string, unknown>)['id']);
    if (!Number.isInteger(eventId)) throw new HttpError(400, 'Gecersiz olay kimligi');

    const event = await queryOne<{
      id: number;
      ts: Date;
      event_type: string;
      severity: string;
      asset_id: string;
      asset_name: string;
      timezone: string;
    }>(
      `SELECT e.id, e.ts, e.event_type, e.severity, e.asset_id, a.name AS asset_name, c.timezone
         FROM device_events e
         JOIN assets a ON a.id = e.asset_id
         JOIN companies c ON c.id = e.company_id
        WHERE e.id = $1 AND e.company_id = $2`,
      [eventId, user.companyId],
    );
    if (!event) throw new HttpError(404, 'Olay kaydi bulunamadi');

    // Olay penceresini serbestce genisletebilmek icin (or. 2 dakika once).
    const beforeSec = Math.min(600, Math.max(EVENT_CLIP_BEFORE_SEC, Number(q['beforeSec'] ?? 0) || 0));
    const afterSec = Math.min(600, Math.max(EVENT_CLIP_AFTER_SEC, Number(q['afterSec'] ?? 0) || 0));

    await guardAccess({
      user,
      purpose: typeof q['purpose'] === 'string' ? q['purpose'] : 'kaza_inceleme',
      dataType: 'camera_playback',
      action: 'clip_window_lookup',
      assetId: event.asset_id,
      reason: `Olay ${eventId} icin kayit cihazinda aranacak zaman araligi soruldu`,
      linkedEventId: eventId,
      ts: new Date(event.ts),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const eventAt = new Date(event.ts);
    const from = new Date(eventAt.getTime() - beforeSec * 1000);
    const to = new Date(eventAt.getTime() + afterSec * 1000);

    const recorders = await query<{
      camera_id: string;
      label: string | null;
      position: string;
      retrieval: string;
      device_model: string | null;
      clock_offset_sec: number;
    }>(
      `SELECT c.id AS camera_id, c.label, c.position, c.retrieval,
              d.model AS device_model, d.clock_offset_sec
         FROM device_cameras c
         JOIN devices d ON d.id = c.device_id
        WHERE d.asset_id = $1 AND c.company_id = $2 AND c.is_active AND c.sd_recording
        ORDER BY c.channel_no`,
      [event.asset_id, user.companyId],
    );

    const local = (date: Date, offsetSec: number): string =>
      new Date(date.getTime() + offsetSec * 1000).toLocaleString('tr-TR', {
        timeZone: event.timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

    return {
      eventId: event.id,
      eventType: event.event_type,
      severity: event.severity,
      assetName: event.asset_name,
      eventAt,
      timezone: event.timezone,
      windowFrom: from,
      windowTo: to,
      recorders: recorders.map((r) => ({
        cameraId: r.camera_id,
        label: r.label ?? r.position,
        retrieval: r.retrieval,
        deviceModel: r.device_model,
        clockOffsetSec: r.clock_offset_sec,
        /** Kayit cihazinin kendi saatine gore aranacak aralik. */
        searchFrom: local(from, r.clock_offset_sec),
        searchTo: local(to, r.clock_offset_sec),
        note:
          r.clock_offset_sec === 0
            ? 'Cihaz saati gercek saatle ayni kabul edildi.'
            : `Cihaz saati ${Math.abs(r.clock_offset_sec)} sn ${r.clock_offset_sec > 0 ? 'ileri' : 'geri'}; aralik buna gore kaydirildi.`,
      })),
    };
  });

  /** Kayit cekme taleplerinin durumu. */
  app.get('/api/media/requests', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const rows = await query(
      `SELECT r.id, r.asset_id, a.name AS asset_name, r.camera_id, c.position AS camera_position,
              r.window_start, r.window_end, r.status, r.purpose, r.reason, r.created_at,
              u.full_name AS requested_by_name
         FROM media_requests r
         JOIN assets a ON a.id = r.asset_id
         LEFT JOIN device_cameras c ON c.id = r.camera_id
         LEFT JOIN users u ON u.id = r.requested_by
        WHERE r.company_id = $1
        ORDER BY r.created_at DESC
        LIMIT 100`,
      [user.companyId],
    );
    return rows;
  });
}
