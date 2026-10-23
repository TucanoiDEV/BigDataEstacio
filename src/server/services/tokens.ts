import "server-only";
import type { TokenPurpose } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { randomToken, sha256 } from "@/server/security/crypto";

const TTL_MS: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/** Emite token de uso único; tokens anteriores do mesmo propósito são invalidados. */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomToken(32);
  await db.$transaction([
    db.verificationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.verificationToken.create({
      data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS[purpose]) },
    }),
  ]);
  return token;
}

/** Consome o token atomicamente. Retorna o userId se válido. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const tokenHash = sha256(token);
  const res = await db.verificationToken.updateManyAndReturn({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
    select: { userId: true },
  });
  return res[0]?.userId ?? null;
}

/** Verifica sem consumir (para exibir o formulário de nova senha). */
export async function peekToken(token: string, purpose: TokenPurpose): Promise<boolean> {
  const found = await db.verificationToken.findFirst({
    where: { tokenHash: sha256(token), purpose, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(found);
}
