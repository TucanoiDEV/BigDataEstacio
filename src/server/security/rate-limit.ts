import "server-only";
import { db } from "@/server/db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Limitador de janela fixa persistido no PostgreSQL (funciona com múltiplas
 * instâncias sem Redis). A operação é atômica (INSERT ... ON CONFLICT).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, now(), now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN now() ELSE "RateLimitBucket"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  const { count, expiresAt } = rows[0];
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}

export async function purgeExpiredRateLimits(): Promise<number> {
  const res = await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return res.count;
}

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
}

/** Aplica vários limites; lança RateLimitError se algum for excedido. */
export async function enforceRateLimits(rules: { key: string; limit: number; windowSeconds: number }[]) {
  for (const rule of rules) {
    const res = await rateLimit(rule.key, rule.limit, rule.windowSeconds);
    if (!res.allowed) throw new RateLimitError(res.retryAfterSeconds);
  }
}
