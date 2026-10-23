import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { sha256 } from "@/server/security/crypto";
import { base32Decode, hotp, totpCounter } from "@/server/security/totp";
import { decryptSecret } from "@/server/security/crypto";
import * as auth from "@/server/services/auth";
import { issueToken } from "@/server/services/tokens";
import { getSessionState } from "@/server/auth/dal";
import { rateLimit } from "@/server/security/rate-limit";
import { cookieJar } from "../support/integration-env";
import { createUser, PASSWORD, resetDb } from "./helpers";

const ctx = { ip: "203.0.113.10", ipHash: "iphash-test", userAgent: "vitest" };

beforeEach(resetDb);

describe("cadastro", () => {
  it("cria conta com Argon2id e registra aceite/ciência dos documentos", async () => {
    await auth.signUp({ name: "Joana Teste", email: "joana@exemplo.test", password: "frase longa e unica 2026" }, ctx);
    const u = await db.user.findUniqueOrThrow({ where: { email: "joana@exemplo.test" }, include: { consents: true } });
    expect(u.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(u.emailVerifiedAt).toBeNull();
    expect(u.consents.map((c) => c.kind).sort()).toEqual(["PRIVACY_NOTICE", "TERMS_OF_USE"]);
  });

  it("não revela e-mail existente (mesma resposta, nenhuma conta duplicada)", async () => {
    await auth.signUp({ name: "Joana", email: "dup@exemplo.test", password: "frase longa e unica 2026" }, ctx);
    await expect(auth.signUp({ name: "Segunda Pessoa", email: "dup@exemplo.test", password: "girassol azul montanha 2026" }, { ...ctx, ipHash: "x2" })).resolves.toBeUndefined();
    expect(await db.user.count({ where: { email: "dup@exemplo.test" } })).toBe(1);
  });

  it("token de verificação é de uso único", async () => {
    const u = await createUser({ verified: false });
    const token = await issueToken(u.id, "EMAIL_VERIFICATION");
    expect(await auth.verifyEmail(token)).toBe(true);
    expect(await auth.verifyEmail(token)).toBe(false);
    const stored = await db.verificationToken.findFirstOrThrow({ where: { userId: u.id } });
    expect(stored.tokenHash).toBe(sha256(token));
    expect(stored.tokenHash).not.toBe(token);
  });
});

describe("login e sessão", () => {
  it("mensagem genérica para e-mail inexistente e senha errada", async () => {
    const u = await createUser();
    await expect(auth.login("nao-existe@exemplo.test", PASSWORD, ctx)).rejects.toThrow("E-mail ou senha incorretos.");
    await expect(auth.login(u.email, "senha-errada-qualquer", ctx)).rejects.toThrow("E-mail ou senha incorretos.");
  });

  it("cria sessão com cookie e armazena só o hash do token", async () => {
    const u = await createUser();
    await auth.login(u.email, PASSWORD, ctx);
    const token = cookieJar.get("ea_session")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const session = await db.session.findUniqueOrThrow({ where: { id: sha256(token) } });
    expect(session.userId).toBe(u.id);
    const state = await getSessionState();
    expect(state.state).toBe("active");
  });

  it("bloqueia temporariamente após 10 falhas", async () => {
    const u = await createUser();
    for (let i = 0; i < 10; i++) {
      await expect(auth.login(u.email, `errada-${i}-xxxxx`, { ...ctx, ipHash: `ip-${i}` })).rejects.toThrow();
    }
    await expect(auth.login(u.email, PASSWORD, { ...ctx, ipHash: "ip-ok" })).rejects.toThrow(/bloqueada|Muitas tentativas/);
  });

  it("conta suspensa não entra e sessões existentes são invalidadas", async () => {
    const u = await createUser();
    await auth.login(u.email, PASSWORD, ctx);
    await db.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    expect((await getSessionState()).state).toBe("anonymous");
  });

  it("redefinição de senha invalida todas as sessões", async () => {
    const u = await createUser();
    await auth.login(u.email, PASSWORD, ctx);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(1);
    const token = await issueToken(u.id, "PASSWORD_RESET");
    await auth.resetPassword(token, "nova frase secreta e longa", ctx);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    await expect(auth.resetPassword(token, "outra frase secreta longa", ctx)).rejects.toThrow(/inválido ou expirado/);
  });
});

describe("verificação em duas etapas", () => {
  it("configura TOTP, exige 2º fator no login e impede reutilização do código", async () => {
    const u = await createUser();
    await auth.login(u.email, PASSWORD, ctx);
    await auth.startMfaSetup(u.id);
    const enc = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).mfaSecretEnc!;
    const secret = decryptSecret(enc);
    const codeAt = (ms: number) => hotp(base32Decode(secret), totpCounter(ms));
    const recovery = await auth.confirmMfaSetup(u.id, codeAt(Date.now()), ctx);
    expect(recovery).toHaveLength(10);

    cookieJar.clear();
    const outcome = await auth.login(u.email, PASSWORD, { ...ctx, ipHash: "mfa" });
    expect(outcome.status).toBe("mfa_required");
    expect((await getSessionState()).state).toBe("mfa_pending");

    await expect(auth.completeMfa("000000", ctx)).rejects.toThrow();
    // Código da próxima janela (ainda não usado) é aceito; o mesmo código não pode ser reutilizado.
    const next = codeAt(Date.now() + 30_000);
    await auth.completeMfa(next, ctx);
    expect((await getSessionState()).state).toBe("active");

    cookieJar.clear();
    await auth.login(u.email, PASSWORD, { ...ctx, ipHash: "mfa2" });
    await expect(auth.completeMfa(next, ctx)).rejects.toThrow();
    // Código de recuperação funciona uma única vez.
    await auth.completeMfa(recovery[0], ctx);
    expect((await getSessionState()).state).toBe("active");
    const used = await db.mfaRecoveryCode.count({ where: { userId: u.id, usedAt: { not: null } } });
    expect(used).toBe(1);
  });
});

describe("limitação de taxa", () => {
  it("bloqueia após o limite na janela", async () => {
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await rateLimit("test:key", 3, 60));
    expect(r.map((x) => x.allowed)).toEqual([true, true, true, false]);
    expect(r[3].retryAfterSeconds).toBeGreaterThan(0);
  });
});
