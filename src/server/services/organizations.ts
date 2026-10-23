import "server-only";
import type { OrgRole } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import { canManageRole } from "@/server/authz/permissions";
import type { CurrentUser, OrgAccess } from "@/server/auth/dal";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { randomToken, sha256 } from "@/server/security/crypto";
import { sendMailSafe } from "@/server/mail/mailer";
import { mail } from "@/server/mail/templates";
import { notifyMany, platformAdminIds } from "@/server/services/notifications";
import { ORG_ROLE_LABEL } from "@/lib/constants";
import { slugify } from "@/lib/text";
import type { z } from "zod";
import type { createOrgSchema, updateOrgSchema } from "@/lib/validation/org";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base, 50);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const exists = await db.organization.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${root}-${randomToken(4).toLowerCase()}`;
}

export async function createOrganization(user: CurrentUser, input: z.output<typeof createOrgSchema>) {
  await enforceRateLimits([{ key: `org-create:user:${user.id}`, limit: 5, windowSeconds: 86400 }]);
  const data = { legalName: input.legalName, cnpj: input.cnpj, tradeName: input.tradeName, website: input.website, contactEmail: input.contactEmail, description: input.description, sector: input.sector, sizeRange: input.sizeRange, city: input.city, state: input.state };
  try {
    const org = await db.organization.create({
      data: {
        ...data,
        slug: await uniqueSlug(data.tradeName),
        members: { create: { userId: user.id, role: "OWNER" } },
      },
      select: { id: true, tradeName: true },
    });
    await audit({ actorUserId: user.id, action: "org.created", targetType: "Organization", targetId: org.id, orgId: org.id });
    await notifyMany(await platformAdminIds(), {
      type: "ORG_STATUS",
      title: "Nova empresa aguardando verificação",
      body: `${org.tradeName} solicitou verificação.`,
      link: "/admin/empresas",
    });
    return org;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("Já existe uma empresa com esse CNPJ na plataforma. Peça um convite a quem administra o perfil dela.");
    }
    throw err;
  }
}

export async function updateOrganization(access: OrgAccess, input: z.output<typeof updateOrgSchema>) {
  await db.organization.update({ where: { id: access.org.id }, data: input });
  await audit({ actorUserId: access.user.id, action: "org.updated", targetType: "Organization", targetId: access.org.id, orgId: access.org.id, metadata: { fields: Object.keys(input) } });
}

/** Reenvia para análise uma empresa recusada (após corrigir os dados). */
export async function requestReverification(access: OrgAccess) {
  const res = await db.organization.updateMany({
    where: { id: access.org.id, verificationStatus: "REJECTED" },
    data: { verificationStatus: "PENDING" },
  });
  if (res.count === 0) throw invalid("Apenas empresas recusadas podem solicitar nova análise.");
  await audit({ actorUserId: access.user.id, action: "org.reverification_requested", orgId: access.org.id, targetType: "Organization", targetId: access.org.id });
}

// ---------------------------------------------------------------------------
// Membros e convites
// ---------------------------------------------------------------------------

export async function inviteMember(access: OrgAccess, email: string, role: OrgRole) {
  if (!canManageRole(access.membership.role, role)) throw forbidden("Você não pode conceder esse papel.");
  await enforceRateLimits([{ key: `org-invite:org:${access.org.id}`, limit: 30, windowSeconds: 86400 }]);

  const existingMember = await db.orgMembership.findFirst({ where: { orgId: access.org.id, user: { email } }, select: { id: true } });
  if (existingMember) throw conflict("Essa pessoa já participa da empresa.");

  const token = randomToken(32);
  await db.$transaction([
    db.orgInvitation.updateMany({ where: { orgId: access.org.id, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.orgInvitation.create({
      data: { orgId: access.org.id, email, role, tokenHash: sha256(token), invitedById: access.user.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    }),
  ]);
  await sendMailSafe(mail.orgInvite(email, access.org.tradeName, ORG_ROLE_LABEL[role], new URL(`/convite/${token}`, env().APP_URL).toString()));
  await audit({ actorUserId: access.user.id, action: "org.member_invited", orgId: access.org.id, metadata: { role, email } });
}

export async function revokeInvitation(access: OrgAccess, invitationId: string) {
  const res = await db.orgInvitation.updateMany({
    where: { id: invitationId, orgId: access.org.id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) throw notFound("Convite não encontrado.");
  await audit({ actorUserId: access.user.id, action: "org.invitation_revoked", orgId: access.org.id, targetId: invitationId, targetType: "OrgInvitation" });
}

export async function getInvitation(token: string) {
  return db.orgInvitation.findFirst({
    where: { tokenHash: sha256(token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, org: { select: { id: true, tradeName: true } } },
  });
}

export async function acceptInvitation(user: CurrentUser, token: string): Promise<string> {
  const inv = await getInvitation(token);
  if (!inv) throw notFound("Convite inválido ou expirado.");
  // O convite só vale para o e-mail convidado (impede uso de link vazado).
  if (inv.email !== user.email) throw forbidden("Este convite foi enviado para outro e-mail. Entre com a conta correspondente.");

  await db.$transaction(async (tx) => {
    const claimed = await tx.orgInvitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count === 0) throw conflict("Convite já utilizado.");
    await tx.orgMembership.upsert({
      where: { orgId_userId: { orgId: inv.org.id, userId: user.id } },
      create: { orgId: inv.org.id, userId: user.id, role: inv.role },
      update: {},
    });
  });
  await audit({ actorUserId: user.id, action: "org.invitation_accepted", orgId: inv.org.id, metadata: { role: inv.role } });
  return inv.org.id;
}

async function ownerCount(orgId: string) {
  return db.orgMembership.count({ where: { orgId, role: "OWNER" } });
}

export async function changeMemberRole(access: OrgAccess, membershipId: string, role: OrgRole) {
  const target = await db.orgMembership.findFirst({ where: { id: membershipId, orgId: access.org.id }, select: { id: true, role: true, userId: true } });
  if (!target) throw notFound("Membro não encontrado.");
  if (target.userId === access.user.id) throw forbidden("Você não pode alterar o próprio papel.");
  if (!canManageRole(access.membership.role, target.role) || !canManageRole(access.membership.role, role)) {
    throw forbidden("Você não pode alterar esse papel.");
  }
  if (target.role === "OWNER" && role !== "OWNER" && (await ownerCount(access.org.id)) <= 1) {
    throw conflict("A empresa precisa de pelo menos um(a) proprietário(a).");
  }
  await db.orgMembership.update({ where: { id: target.id }, data: { role } });
  await audit({ actorUserId: access.user.id, action: "org.member_role_changed", orgId: access.org.id, targetType: "User", targetId: target.userId, metadata: { from: target.role, to: role } });
}

export async function removeMember(access: OrgAccess, membershipId: string) {
  const target = await db.orgMembership.findFirst({ where: { id: membershipId, orgId: access.org.id }, select: { id: true, role: true, userId: true } });
  if (!target) throw notFound("Membro não encontrado.");
  const self = target.userId === access.user.id;
  if (!self && !canManageRole(access.membership.role, target.role)) throw forbidden("Você não pode remover esse membro.");
  if (target.role === "OWNER" && (await ownerCount(access.org.id)) <= 1) {
    throw conflict("A empresa precisa de pelo menos um(a) proprietário(a).");
  }
  await db.orgMembership.delete({ where: { id: target.id } });
  await audit({ actorUserId: access.user.id, action: self ? "org.member_left" : "org.member_removed", orgId: access.org.id, targetType: "User", targetId: target.userId });
}
