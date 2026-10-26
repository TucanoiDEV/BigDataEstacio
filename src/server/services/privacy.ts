import "server-only";
import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { conflict, invalid } from "@/server/errors";
import { invalidateAllSessions } from "@/server/auth/session";
import { verifyPassword } from "@/server/security/password";
import { enforceRateLimits } from "@/server/security/rate-limit";
import type { RequestContext } from "@/server/security/request";
import { removeStoredContents } from "@/server/storage/files";
import { sendMailSafe } from "@/server/mail/mailer";
import { mail } from "@/server/mail/templates";
import { notifyMany, platformAdminIds } from "@/server/services/notifications";
import { formatDate } from "@/lib/format";
import type { privacyRequestSchema } from "@/lib/validation/privacy";

/** Prazo de referência: 15 dias (art. 19, II, da LGPD para resposta completa). */
const RESPONSE_DAYS = 15;

function protocolNumber() {
  const d = new Date();
  return `LGPD-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createPrivacyRequest(input: z.output<typeof privacyRequestSchema>, userId: string | null, ctx: RequestContext) {
  await enforceRateLimits([
    { key: `privacy-request:ip:${ctx.ipHash}`, limit: 5, windowSeconds: 3600 },
    ...(userId ? [{ key: `privacy-request:user:${userId}`, limit: 10, windowSeconds: 86400 }] : []),
  ]);
  const dueAt = new Date(Date.now() + RESPONSE_DAYS * 86400_000);
  const req = await db.privacyRequest.create({
    data: { ...input, userId, protocol: protocolNumber(), dueAt },
    select: { id: true, protocol: true },
  });
  await audit({ actorUserId: userId, action: "privacy.request_created", targetType: "PrivacyRequest", targetId: req.id, ipHash: ctx.ipHash, metadata: { type: input.type } });
  await notifyMany(await platformAdminIds(), { type: "SYSTEM", title: "Nova solicitação de titular (LGPD)", body: `Protocolo ${req.protocol}`, link: "/admin/privacidade" });
  await sendMailSafe(mail.privacyRequestReceived(input.requesterEmail, req.protocol, formatDate(dueAt)));
  return req;
}

/**
 * Exportação dos dados do titular (portabilidade/acesso) em JSON legível.
 * Não inclui hashes de senha, segredos de MFA, tokens ou dados de terceiros
 * (ex.: notas internas de recrutadores).
 */
export async function exportUserData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      createdAt: true,
      termsVersion: true,
      termsAcceptedAt: true,
      mfaEnabledAt: true,
      candidateProfile: {
        include: {
          experiences: true,
          educations: true,
          skills: { include: { skill: { select: { name: true } } } },
          resumes: { select: { label: true, createdAt: true, file: { select: { originalName: true, sizeBytes: true, sha256: true } } } },
        },
      },
      applications: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          coverLetter: true,
          profileSnapshot: true,
          job: { select: { title: true, org: { select: { tradeName: true, cnpj: true } } } },
          history: { select: { fromStatus: true, toStatus: true, messageToCandidate: true, createdAt: true } },
        },
      },
      savedJobs: { select: { createdAt: true, job: { select: { title: true } } } },
      alerts: { select: { name: true, filters: true, frequency: true, active: true, createdAt: true } },
      notifications: { select: { type: true, title: true, body: true, createdAt: true, readAt: true } },
      commPreference: true,
      consents: { select: { kind: true, version: true, action: true, choices: true, createdAt: true } },
      memberships: { select: { role: true, createdAt: true, org: { select: { tradeName: true } } } },
      privacyRequests: { select: { protocol: true, type: true, status: true, createdAt: true, response: true } },
      sessions: { select: { createdAt: true, lastSeenAt: true, userAgent: true } },
    },
  });
  await audit({ actorUserId: userId, action: "privacy.data_exported" });
  return {
    generatedAt: new Date().toISOString(),
    controller: "Emprego Agora",
    notice:
      "Cópia dos dados pessoais tratados pela plataforma sobre você. Arquivos de currículo podem ser baixados individualmente na área Currículos.",
    data: user,
  };
}

/**
 * Exclusão da conta. Dados do candidato são eliminados ou anonimizados.
 * Registros mínimos podem ser mantidos quando houver base legal (ex.: logs de
 * acesso por 6 meses — Marco Civil, art. 15; registros de auditoria de segurança),
 * já desvinculados de dados identificáveis quando possível.
 */
export async function deleteAccount(userId: string, password: string, ctx: RequestContext) {
  await enforceRateLimits([{ key: `delete-account:user:${userId}`, limit: 5, windowSeconds: 3600 }]);
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true, platformRole: true, memberships: { where: { role: "OWNER" }, select: { orgId: true } } },
  });
  if (!(await verifyPassword(user.passwordHash, password))) throw invalid("Senha incorreta.");
  if (user.platformRole === "PLATFORM_ADMIN") throw conflict("Contas de administração devem ser desativadas por outro administrador.");

  // Ordem: (1) tudo no banco numa transação — conferência de propriedade, anonimização e marcação
  // dos arquivos como excluídos; (2) só depois de confirmada, remoção dos arquivos do disco.
  // Uma falha no meio desfaz a transação e mantém a conta intacta, com os arquivos.
  const anonymizedEmail = `excluido+${randomBytes(8).toString("hex")}@anonimo.invalid`;
  const storageKeys = await db.$transaction(async (tx) => {
    // Mesma trava das alterações de vínculos (organizations.ts): nunca sobram zero proprietários(as).
    for (const m of user.memberships) {
      await tx.$queryRaw`SELECT 1 FROM "Organization" WHERE "id" = ${m.orgId} FOR UPDATE`;
      const owners = await tx.orgMembership.count({ where: { orgId: m.orgId, role: "OWNER" } });
      if (owners <= 1) throw conflict("Você é o(a) único(a) proprietário(a) de uma empresa. Transfira a propriedade antes de excluir a conta.");
    }

    // Logo em uso pertence à empresa, não à pessoa: só perde o vínculo com quem enviou.
    await tx.storedFile.updateMany({ where: { ownerUserId: userId, deletedAt: null, orgLogo: { isNot: null } }, data: { ownerUserId: null } });
    const files = await tx.storedFile.findMany({ where: { ownerUserId: userId, deletedAt: null }, select: { storageKey: true } });
    await tx.storedFile.updateMany({ where: { ownerUserId: userId, deletedAt: null }, data: { deletedAt: new Date() } });

    // Candidaturas em andamento são retiradas; o recorte de perfil é apagado.
    const open = await tx.application.findMany({ where: { candidateUserId: userId, status: { in: ["SUBMITTED", "IN_REVIEW", "INTERVIEW"] } }, select: { id: true, status: true } });
    for (const a of open) {
      await tx.application.update({ where: { id: a.id }, data: { status: "WITHDRAWN" } });
      await tx.applicationStatusChange.create({ data: { applicationId: a.id, fromStatus: a.status, toStatus: "WITHDRAWN" } });
    }
    await tx.application.updateMany({ where: { candidateUserId: userId }, data: { profileSnapshot: { removed: true, reason: "Conta excluída pelo titular" }, coverLetter: null, resumeId: null } });
    await tx.candidateProfile.deleteMany({ where: { userId } });
    await tx.savedJob.deleteMany({ where: { userId } });
    await tx.jobAlert.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.orgMembership.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.communicationPreference.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: "Conta excluída",
        passwordHash: "!",
        status: "DELETED",
        deletedAt: new Date(),
        mfaSecretEnc: null,
        mfaEnabledAt: null,
        emailVerifiedAt: null,
      },
    });
    return files.map((f) => f.storageKey);
  });
  const failed = await removeStoredContents(storageKeys);
  if (failed.length) console.error("[privacy] arquivos marcados como excluídos, mas não removidos do disco:", failed.length);
  await invalidateAllSessions(userId);
  await audit({ actorUserId: userId, action: "privacy.account_deleted", ipHash: ctx.ipHash });
}
