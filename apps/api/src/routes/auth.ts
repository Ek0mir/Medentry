/** Kimlik dogrulama uclari. */

import type { FastifyInstance } from 'fastify';
import type { UserRole } from '@medentry/shared';
import { ROLE_LABELS } from '@medentry/shared';
import { HttpError, currentUser, requireAuth, requestMeta } from '../auth/context.js';
import { createToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { query, queryOne } from '../db/pool.js';
import { str } from './validate.js';

interface UserRow {
  id: string;
  company_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const email = str(body, 'email').toLowerCase();
    const password = str(body, 'password');

    const user = await queryOne<UserRow>(
      `SELECT id, company_id, email, password_hash, full_name, role, is_active
         FROM users WHERE lower(email) = $1`,
      [email],
    );

    // Kullanici bulunamasa bile parola dogrulamasi calistirilir: yanit
    // suresinden hesap varligi cikarilmasini zorlastirir.
    const valid = user
      ? await verifyPassword(password, user.password_hash)
      : await verifyPassword(password, 'scrypt$16384$8$1$AAAA$AAAA');

    if (!user || !valid || !user.is_active) {
      request.log.warn({ email, ip: request.ip }, 'basarisiz giris denemesi');
      throw new HttpError(401, 'E-posta veya parola hatali', 'INVALID_CREDENTIALS');
    }

    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    const token = createToken({
      sub: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
      name: user.full_name,
      scope: 'api',
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role],
        companyId: user.company_id,
      },
    });
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    const row = await queryOne<{
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
      phone: string | null;
      company_name: string;
      kvkk_contact_email: string | null;
      timezone: string;
    }>(
      `SELECT u.id, u.email, u.full_name, u.role, u.phone,
              c.name AS company_name, c.kvkk_contact_email, c.timezone
         FROM users u JOIN companies c ON c.id = u.company_id
        WHERE u.id = $1`,
      [user.id],
    );
    if (!row) throw new HttpError(404, 'Kullanici bulunamadi');

    // Aydinlatma metnini teyit etmemis kullanicilara arayuzde uyari cikar.
    const pending = await query<{ id: string; kind: string; title: string; version: string }>(
      `SELECT n.id, n.kind, n.title, n.version
         FROM privacy_notices n
        WHERE n.company_id = $1
          AND n.published_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM notice_acknowledgements a
             WHERE a.notice_id = n.id AND a.user_id = $2 AND a.granted AND a.withdrawn_at IS NULL
          )`,
      [user.companyId, user.id],
    );

    return {
      id: row.id,
      email: row.email,
      name: row.full_name,
      role: row.role,
      roleLabel: ROLE_LABELS[row.role],
      phone: row.phone,
      company: { name: row.company_name, timezone: row.timezone, kvkkContact: row.kvkk_contact_email },
      pendingNotices: pending,
    };
  });

  app.post('/api/auth/change-password', { preHandler: requireAuth }, async (request, reply) => {
    const user = currentUser(request);
    const body = request.body as Record<string, unknown>;
    const currentPassword = str(body, 'currentPassword');
    const newPassword = str(body, 'newPassword', { min: 8 });

    const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [
      user.id,
    ]);
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      throw new HttpError(400, 'Mevcut parola hatali', 'INVALID_PASSWORD');
    }

    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
      user.id,
      await hashPassword(newPassword),
    ]);

    const meta = requestMeta(request);
    request.log.info({ userId: user.id, ip: meta.ip }, 'parola degistirildi');
    return reply.send({ ok: true });
  });
}
