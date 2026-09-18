/** Kimlik dogrulama ve rol kontrolu (Fastify eklentisi). */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@medentry/shared';
import { verifyToken } from './jwt.js';

export interface AuthUser {
  id: string;
  companyId: string;
  role: UserRole;
  email: string;
  name: string;
  scope: 'api' | 'stream';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Authorization: Bearer <token> basligini cozer. */
export function readToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  // Video etiketleri Authorization basligi gonderemez; yayin jetonu sorgu
  // parametresiyle de kabul edilir (kisa omurlu ve tek kameraya baglidir).
  const queryToken = (request.query as Record<string, unknown> | undefined)?.['token'];
  return typeof queryToken === 'string' ? queryToken : null;
}

export async function authenticate(request: FastifyRequest): Promise<AuthUser> {
  const token = readToken(request);
  if (!token) throw new HttpError(401, 'Oturum acmaniz gerekiyor', 'NO_TOKEN');

  const result = verifyToken(token);
  if (!result.ok) {
    const message =
      result.reason === 'expired' ? 'Oturum suresi doldu, tekrar giris yapin' : 'Gecersiz oturum jetonu';
    throw new HttpError(401, message, result.reason.toUpperCase());
  }

  const user: AuthUser = {
    id: result.payload.sub,
    companyId: result.payload.companyId,
    role: result.payload.role,
    email: result.payload.email,
    name: result.payload.name,
    scope: result.payload.scope ?? 'api',
  };
  request.user = user;
  return user;
}

/** API uclari icin: yayin jetonu ile API cagrilamaz. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = await authenticate(request);
  if (user.scope !== 'api') {
    throw new HttpError(403, 'Bu jeton yalnizca goruntu yayini icin gecerlidir', 'WRONG_SCOPE');
  }
}

/** Rol kisiti: preHandler olarak kullanilir. */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    const user = request.user!;
    if (!roles.includes(user.role)) {
      throw new HttpError(403, 'Bu islem icin yetkiniz bulunmuyor', 'ROLE_FORBIDDEN', {
        required: roles,
        actual: user.role,
      });
    }
  };
}

export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw new HttpError(401, 'Oturum bulunamadi', 'NO_SESSION');
  return request.user;
}

/** Istegin IP ve tarayici bilgisi - denetim kaydina yazilir. */
export function requestMeta(request: FastifyRequest): { ip: string; userAgent: string } {
  return {
    ip: request.ip,
    userAgent: String(request.headers['user-agent'] ?? ''),
  };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send({
        error: 'Gecersiz istek govdesi',
        details: error instanceof Error ? error.message : String(error),
      });
    }
    request.log.error({ err: error }, 'beklenmeyen hata');
    return reply.status(500).send({ error: 'Sunucu hatasi' });
  });
}
