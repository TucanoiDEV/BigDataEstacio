import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { OrgRole } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { readSessionToken, validateSessionToken, type SessionWithUser } from "@/server/auth/session";
import { roleCan, type OrgPermission } from "@/server/authz/permissions";
import { forbidden, unauthenticated } from "@/server/errors";

// Camada de acesso a dados (DAL): toda decisão de autenticação/autorização
// passa por aqui, no servidor. Nada vindo do cliente define identidade ou papel.

export type CurrentUser = SessionWithUser["user"] & { sessionId: string; mfaVerified: boolean };

type SessionState =
  | { state: "anonymous" }
  | { state: "mfa_pending"; userId: string }
  | { state: "active"; user: CurrentUser };

/** Memoizado por requisição (React cache). */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const token = await readSessionToken();
  if (!token) return { state: "anonymous" };
  const session = await validateSessionToken(token);
  if (!session) return { state: "anonymous" };
  const mfaVerified = session.mfaVerifiedAt !== null;
  if (session.user.mfaEnabledAt && !mfaVerified) return { state: "mfa_pending", userId: session.user.id };
  return { state: "active", user: { ...session.user, sessionId: session.id, mfaVerified } };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await getSessionState();
  return s.state === "active" ? s.user : null;
}

/** Para páginas: redireciona para login quando necessário. */
export async function requireUser(opts: { returnTo?: string; allowUnverified?: boolean } = {}): Promise<CurrentUser> {
  const s = await getSessionState();
  if (s.state === "mfa_pending") redirect("/entrar/verificacao");
  if (s.state === "anonymous") {
    const next = opts.returnTo ? `?next=${encodeURIComponent(opts.returnTo)}` : "";
    redirect(`/entrar${next}`);
  }
  if (!opts.allowUnverified && !s.user.emailVerifiedAt) redirect("/verificar-email");
  return s.user;
}

/** Para Server Actions/Route Handlers: lança erro em vez de redirecionar. */
export async function assertUser(opts: { allowUnverified?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  if (!opts.allowUnverified && !user.emailVerifiedAt) throw forbidden("Confirme seu e-mail para continuar.");
  return user;
}

function adminMfaSatisfied(user: CurrentUser): boolean {
  if (!env().requireAdminMfa) return true;
  return user.mfaEnabledAt !== null && user.mfaVerified;
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser({ returnTo: "/admin" });
  if (user.platformRole !== "PLATFORM_ADMIN") notFound();
  if (!adminMfaSatisfied(user)) redirect("/minha-conta/seguranca?mfa=obrigatorio");
  return user;
}

export async function assertPlatformAdmin(): Promise<CurrentUser> {
  const user = await assertUser();
  if (user.platformRole !== "PLATFORM_ADMIN") throw forbidden();
  if (!adminMfaSatisfied(user)) throw forbidden("Ative a verificação em duas etapas para acessar a administração.");
  return user;
}

export type OrgAccess = {
  user: CurrentUser;
  membership: { id: string; role: OrgRole };
  org: { id: string; slug: string; tradeName: string; verificationStatus: string };
};

async function loadMembership(userId: string, orgId: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(orgId)) return null;
  return db.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: {
      id: true,
      role: true,
      org: { select: { id: true, slug: true, tradeName: true, verificationStatus: true } },
    },
  });
}

/**
 * Exige vínculo com a organização e a permissão pedida. Para não revelar a
 * existência de recursos de outras empresas, responde 404 (página) ou FORBIDDEN (ação).
 */
export async function requireOrgPermission(orgId: string, permission: OrgPermission): Promise<OrgAccess> {
  const user = await requireUser({ returnTo: `/empresa/${orgId}` });
  const m = await loadMembership(user.id, orgId);
  if (!m || !roleCan(m.role, permission)) notFound();
  return { user, membership: { id: m.id, role: m.role }, org: m.org };
}

export async function assertOrgPermission(orgId: string, permission: OrgPermission): Promise<OrgAccess> {
  const user = await assertUser();
  const m = await loadMembership(user.id, orgId);
  if (!m || !roleCan(m.role, permission)) throw forbidden();
  return { user, membership: { id: m.id, role: m.role }, org: m.org };
}
