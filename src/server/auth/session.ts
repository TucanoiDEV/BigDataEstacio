import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { randomToken, sha256 } from "@/server/security/crypto";

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY;
export const SESSION_ABSOLUTE_MAX_MS = 90 * DAY;
export const MFA_PENDING_TTL_MS = 10 * 60 * 1000;

export function sessionCookieName(): string {
  // Prefixo __Host- exige Secure, Path=/ e ausência de Domain (bloqueia sobrescrita por subdomínios).
  return env().isProduction ? "__Host-ea_session" : "ea_session";
}

export type SessionWithUser = NonNullable<Awaited<ReturnType<typeof findSession>>>;

function findSession(id: string) {
  return db.session.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
          status: true,
          emailVerifiedAt: true,
          mfaEnabledAt: true,
        },
      },
    },
  });
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: env().isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: env().isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Cria sessão e grava o cookie. Se `mfaPending`, a sessão dura 10 minutos e
 * só permite concluir o segundo fator.
 */
export async function createSession(
  userId: string,
  opts: { mfaPending: boolean; mfaVerified: boolean; ipHash?: string; userAgent?: string | null },
): Promise<void> {
  const token = randomToken(32);
  const now = Date.now();
  const expiresAt = new Date(now + (opts.mfaPending ? MFA_PENDING_TTL_MS : SESSION_TTL_MS));
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      mfaVerifiedAt: opts.mfaVerified ? new Date(now) : null,
      ipHash: opts.ipHash,
      userAgent: opts.userAgent ?? null,
    },
  });
  await setSessionCookie(token, opts.mfaPending ? new Date(now + SESSION_TTL_MS) : expiresAt);
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  return token && token.length >= 32 && token.length <= 64 ? token : null;
}

/**
 * Valida o token: expiração deslizante (30 dias) com teto absoluto (90 dias),
 * e invalida sessões de contas suspensas/excluídas.
 */
export async function validateSessionToken(token: string): Promise<SessionWithUser | null> {
  const id = sha256(token);
  const session = await findSession(id);
  if (!session) return null;
  const now = Date.now();
  const absoluteExpired = now - session.createdAt.getTime() > SESSION_ABSOLUTE_MAX_MS;
  if (session.expiresAt.getTime() <= now || absoluteExpired || session.user.status !== "ACTIVE") {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  const isPending = session.user.mfaEnabledAt !== null && session.mfaVerifiedAt === null;
  // Renova no banco quando faltar menos da metade do prazo (sessões completas).
  if (!isPending && session.expiresAt.getTime() - now < SESSION_TTL_MS / 2) {
    const expiresAt = new Date(Math.min(now + SESSION_TTL_MS, session.createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS));
    await db.session.update({ where: { id }, data: { expiresAt, lastSeenAt: new Date(now) } });
    session.expiresAt = expiresAt;
  } else if (now - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.session.update({ where: { id }, data: { lastSeenAt: new Date(now) } });
  }
  return session;
}

export async function markSessionMfaVerified(token: string): Promise<void> {
  const now = Date.now();
  await db.session.update({
    where: { id: sha256(token) },
    data: { mfaVerifiedAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
  });
}

export async function invalidateSessionByToken(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sha256(token) } });
}

export async function invalidateAllSessions(userId: string, exceptToken?: string): Promise<number> {
  const res = await db.session.deleteMany({
    where: { userId, ...(exceptToken ? { NOT: { id: sha256(exceptToken) } } : {}) },
  });
  return res.count;
}

export function currentSessionId(token: string): string {
  return sha256(token);
}
