import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { conflict, forbidden, invalid } from "@/server/errors";
import { LEGAL_VERSIONS } from "@/lib/constants";
import { checkPasswordPolicy } from "@/lib/password-policy";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/security/password";
import { decryptSecret, encryptSecret, keyedHash, sha256 } from "@/server/security/crypto";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { generateTotpSecret, totpUri, verifyTotp } from "@/server/security/totp";
import type { RequestContext } from "@/server/security/request";
import {
  createSession,
  invalidateAllSessions,
  markSessionMfaVerified,
  readSessionToken,
  validateSessionToken,
} from "@/server/auth/session";
import { consumeToken, issueToken } from "@/server/services/tokens";
import { sendMail, sendMailSafe } from "@/server/mail/mailer";
import { mail } from "@/server/mail/templates";

const MAX_FAILED_LOGINS = 10;
const LOCK_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "E-mail ou senha incorretos.";

function appUrl(path: string) {
  return new URL(path, env().APP_URL).toString();
}

// ---------------------------------------------------------------------------
// Cadastro e verificação de e-mail
// ---------------------------------------------------------------------------

/**
 * Cria a conta. Para impedir enumeração de usuários, a resposta é idêntica
 * quando o e-mail já existe — nesse caso o titular recebe um aviso por e-mail.
 */
export async function signUp(
  input: { name: string; email: string; password: string },
  ctx: RequestContext,
): Promise<void> {
  await enforceRateLimits([
    { key: `signup:ip:${ctx.ipHash}`, limit: 10, windowSeconds: 3600 },
    { key: `signup:email:${keyedHash(input.email)}`, limit: 3, windowSeconds: 3600 },
  ]);

  const policy = checkPasswordPolicy(input.password, [input.name, input.email]);
  if (!policy.ok) throw invalid(policy.reason);

  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true, status: true } });
  if (existing) {
    // Mesmo custo computacional do caminho normal (evita diferença de tempo).
    await hashPassword(input.password);
    if (existing.status !== "DELETED") {
      await sendMailSafe(mail.signupAttemptExisting(input.email, appUrl("/entrar"), appUrl("/esqueci-a-senha")));
    }
    return;
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      passwordChangedAt: now,
      termsVersion: LEGAL_VERSIONS.terms,
      termsAcceptedAt: now,
      commPreference: { create: {} },
      consents: {
        create: [
          { kind: "TERMS_OF_USE", version: LEGAL_VERSIONS.terms, action: "ACCEPT", choices: { accepted: true }, ipHash: ctx.ipHash },
          // Ciência da política de privacidade (não é consentimento como base legal).
          { kind: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacy, action: "ACKNOWLEDGE", choices: { acknowledged: true }, ipHash: ctx.ipHash },
        ],
      },
    },
    select: { id: true, name: true, email: true },
  });

  await audit({ actorUserId: user.id, action: "auth.signup", targetType: "User", targetId: user.id, ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await sendVerificationEmail(user.id, user.email, user.name);
}

async function sendVerificationEmail(userId: string, email: string, name: string) {
  const token = await issueToken(userId, "EMAIL_VERIFICATION");
  await sendMailSafe(mail.verifyEmail(email, name, appUrl(`/verificar-email/confirmar?token=${token}`)));
}

export async function resendVerification(email: string, ctx: RequestContext): Promise<void> {
  await enforceRateLimits([
    { key: `verify-resend:ip:${ctx.ipHash}`, limit: 10, windowSeconds: 3600 },
    { key: `verify-resend:email:${keyedHash(email)}`, limit: 3, windowSeconds: 3600 },
  ]);
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, emailVerifiedAt: true, status: true } });
  if (!user || user.emailVerifiedAt || user.status !== "ACTIVE") return;
  await sendVerificationEmail(user.id, email, user.name);
}

export async function verifyEmail(token: string): Promise<boolean> {
  const userId = await consumeToken(token, "EMAIL_VERIFICATION");
  if (!userId) return false;
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await audit({ actorUserId: userId, action: "auth.email_verified", targetType: "User", targetId: userId });
  return true;
}

// ---------------------------------------------------------------------------
// Login, MFA e logout
// ---------------------------------------------------------------------------

export type LoginOutcome = { status: "ok"; verified: boolean } | { status: "mfa_required" };

export async function login(email: string, password: string, ctx: RequestContext): Promise<LoginOutcome> {
  await enforceRateLimits([
    { key: `login:ip:${ctx.ipHash}`, limit: 30, windowSeconds: 900 },
    { key: `login:email:${keyedHash(email)}`, limit: 10, windowSeconds: 900 },
  ]);

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true, lockedUntil: true, failedLoginCount: true, mfaEnabledAt: true, emailVerifiedAt: true },
  });

  if (!user) {
    await burnPasswordCheck(password);
    throw invalid(GENERIC_LOGIN_ERROR);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await burnPasswordCheck(password);
    await audit({ actorUserId: user.id, action: "auth.login_blocked_locked", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
    throw invalid("Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em alguns minutos ou redefina sua senha.");
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok || user.status !== "ACTIVE") {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MS) : undefined,
      },
    });
    await audit({ actorUserId: user.id, action: "auth.login_failed", ipHash: ctx.ipHash, userAgent: ctx.userAgent, metadata: { reason: ok ? "inactive" : "password" } });
    throw invalid(GENERIC_LOGIN_ERROR);
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  const mfaPending = user.mfaEnabledAt !== null;
  await createSession(user.id, { mfaPending, mfaVerified: false, ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await audit({ actorUserId: user.id, action: mfaPending ? "auth.login_password_ok_mfa_pending" : "auth.login", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  return mfaPending ? { status: "mfa_required" } : { status: "ok", verified: user.emailVerifiedAt !== null };
}

/** Conclui o segundo fator (TOTP ou código de recuperação) de uma sessão pendente. */
export async function completeMfa(code: string, ctx: RequestContext): Promise<void> {
  const token = await readSessionToken();
  const session = token ? await validateSessionToken(token) : null;
  if (!token || !session || !session.user.mfaEnabledAt) throw invalid("Sessão expirada. Entre novamente.");
  if (session.mfaVerifiedAt) return;

  await enforceRateLimits([{ key: `mfa:user:${session.user.id}`, limit: 6, windowSeconds: 300 }]);
  const ok = await checkSecondFactor(session.user.id, code);
  if (!ok) {
    await audit({ actorUserId: session.user.id, action: "auth.mfa_failed", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
    throw invalid("Código inválido ou já utilizado.");
  }
  await markSessionMfaVerified(token);
  await audit({ actorUserId: session.user.id, action: "auth.login", ipHash: ctx.ipHash, userAgent: ctx.userAgent, metadata: { mfa: true } });
}

async function checkSecondFactor(userId: string, rawCode: string): Promise<boolean> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaSecretEnc: true, mfaLastCounter: true } });
  if (!user.mfaSecretEnc) return false;

  if (/^\d{6}$/.test(rawCode)) {
    const counter = verifyTotp(decryptSecret(user.mfaSecretEnc), rawCode, { nowMs: Date.now(), lastUsedCounter: user.mfaLastCounter });
    if (counter === null) return false;
    // Atualização condicional impede reuso concorrente do mesmo código.
    const res = await db.user.updateMany({
      where: { id: userId, OR: [{ mfaLastCounter: null }, { mfaLastCounter: { lt: counter } }] },
      data: { mfaLastCounter: counter },
    });
    return res.count === 1;
  }

  const codeHash = sha256(rawCode.toLowerCase());
  const res = await db.mfaRecoveryCode.updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: new Date() } });
  if (res.count === 1) await audit({ actorUserId: userId, action: "auth.mfa_recovery_code_used" });
  return res.count === 1;
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------

export async function requestPasswordReset(email: string, ctx: RequestContext): Promise<void> {
  await enforceRateLimits([
    { key: `reset:ip:${ctx.ipHash}`, limit: 10, windowSeconds: 3600 },
    { key: `reset:email:${keyedHash(email)}`, limit: 3, windowSeconds: 3600 },
  ]);
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await sendMail(mail.passwordReset(email, appUrl(`/redefinir-senha?token=${token}`)));
  await audit({ actorUserId: user.id, action: "auth.password_reset_requested", ipHash: ctx.ipHash });
}

export async function resetPassword(token: string, password: string, ctx: RequestContext): Promise<void> {
  await enforceRateLimits([{ key: `reset-confirm:ip:${ctx.ipHash}`, limit: 20, windowSeconds: 3600 }]);
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw invalid("Link inválido ou expirado. Solicite uma nova redefinição.");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
  const policy = checkPasswordPolicy(password, [user.name, user.email]);
  if (!policy.ok) throw invalid(policy.reason);

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  // Quem recebeu o link comprovou acesso ao e-mail.
  await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  await invalidateAllSessions(userId);
  await audit({ actorUserId: userId, action: "auth.password_reset", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await sendMailSafe(mail.passwordChanged(user.email));
}

export async function changePassword(userId: string, current: string, password: string, ctx: RequestContext): Promise<void> {
  await enforceRateLimits([{ key: `change-password:user:${userId}`, limit: 5, windowSeconds: 900 }]);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, email: true, name: true } });
  if (!(await verifyPassword(user.passwordHash, current))) throw invalid("Senha atual incorreta.");
  const policy = checkPasswordPolicy(password, [user.name, user.email]);
  if (!policy.ok) throw invalid(policy.reason);
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
  const token = await readSessionToken();
  await invalidateAllSessions(userId, token ?? undefined);
  await audit({ actorUserId: userId, action: "auth.password_changed", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  await sendMailSafe(mail.passwordChanged(user.email));
}

// ---------------------------------------------------------------------------
// Configuração de MFA (TOTP)
// ---------------------------------------------------------------------------

export async function startMfaSetup(userId: string): Promise<{ secret: string; uri: string }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, mfaEnabledAt: true } });
  if (user.mfaEnabledAt) throw conflict("A verificação em duas etapas já está ativa.");
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: userId }, data: { mfaSecretEnc: encryptSecret(secret), mfaLastCounter: null } });
  return { secret, uri: totpUri(secret, user.email) };
}

export async function confirmMfaSetup(userId: string, code: string, ctx: RequestContext): Promise<string[]> {
  await enforceRateLimits([{ key: `mfa-setup:user:${userId}`, limit: 10, windowSeconds: 900 }]);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaSecretEnc: true, mfaEnabledAt: true } });
  if (user.mfaEnabledAt) throw conflict("A verificação em duas etapas já está ativa.");
  if (!user.mfaSecretEnc) throw invalid("Inicie a configuração novamente.");
  const counter = verifyTotp(decryptSecret(user.mfaSecretEnc), code, { nowMs: Date.now() });
  if (counter === null) throw invalid("Código inválido. Confira o horário do seu celular e tente novamente.");

  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { mfaEnabledAt: new Date(), mfaLastCounter: counter } }),
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
    db.mfaRecoveryCode.createMany({ data: recoveryCodes.map((c) => ({ userId, codeHash: sha256(c) })) }),
  ]);
  const token = await readSessionToken();
  if (token) await markSessionMfaVerified(token);
  // Demais sessões precisam refazer login com o segundo fator.
  await invalidateAllSessions(userId, token ?? undefined);
  await audit({ actorUserId: userId, action: "auth.mfa_enabled", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
  return recoveryCodes;
}

export async function disableMfa(userId: string, password: string, code: string, ctx: RequestContext): Promise<void> {
  await enforceRateLimits([{ key: `mfa-disable:user:${userId}`, limit: 5, windowSeconds: 900 }]);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, platformRole: true, mfaEnabledAt: true } });
  if (!user.mfaEnabledAt) return;
  if (user.platformRole === "PLATFORM_ADMIN" && env().requireAdminMfa) {
    throw forbidden("Administradores não podem desativar a verificação em duas etapas.");
  }
  if (!(await verifyPassword(user.passwordHash, password))) throw invalid("Senha incorreta.");
  if (!(await checkSecondFactor(userId, code))) throw invalid("Código inválido.");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { mfaEnabledAt: null, mfaSecretEnc: null, mfaLastCounter: null } }),
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await audit({ actorUserId: userId, action: "auth.mfa_disabled", ipHash: ctx.ipHash, userAgent: ctx.userAgent });
}
