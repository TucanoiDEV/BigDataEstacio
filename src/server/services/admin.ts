import "server-only";
import type { IncidentSeverity, IncidentStatus, PrivacyRequestStatus, ReportStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { conflict, forbidden, notFound } from "@/server/errors";
import type { CurrentUser } from "@/server/auth/dal";
import { invalidateAllSessions } from "@/server/auth/session";
import { notify, notifyMany } from "@/server/services/notifications";
import { sendMailSafe } from "@/server/mail/mailer";
import { mail } from "@/server/mail/templates";

export type OrgDecision = "verify" | "reject" | "suspend" | "reinstate";

export async function decideOrganization(admin: CurrentUser, orgId: string, decision: OrgDecision, notes: string | null) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true, tradeName: true, contactEmail: true, verificationStatus: true } });
  if (!org) throw notFound();
  const allowed: Record<OrgDecision, string[]> = {
    verify: ["PENDING", "REJECTED"],
    reject: ["PENDING"],
    suspend: ["VERIFIED", "PENDING"],
    reinstate: ["SUSPENDED"],
  };
  if (!allowed[decision].includes(org.verificationStatus)) throw conflict("Ação incompatível com o status atual.");
  const to = { verify: "VERIFIED", reject: "REJECTED", suspend: "SUSPENDED", reinstate: "VERIFIED" }[decision] as "VERIFIED" | "REJECTED" | "SUSPENDED";

  await db.organization.update({
    where: { id: orgId },
    data: {
      verificationStatus: to,
      verificationNotes: notes,
      ...(to === "VERIFIED" ? { verifiedAt: new Date(), verifiedById: admin.id } : {}),
    },
  });
  // Ao suspender, vagas ativas deixam de aparecer (a busca exige empresa verificada) e são pausadas.
  if (to === "SUSPENDED") await db.job.updateMany({ where: { orgId, status: "ACTIVE" }, data: { status: "PAUSED" } });

  const members = await db.orgMembership.findMany({ where: { orgId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
  await notifyMany(members.map((m) => m.userId), {
    type: "ORG_STATUS",
    title: to === "VERIFIED" ? "Empresa verificada" : to === "REJECTED" ? "Verificação recusada" : "Empresa suspensa",
    body: notes ?? `Status de ${org.tradeName}: ${to}`,
    link: `/empresa/${orgId}`,
  });
  if (decision === "verify" || decision === "reject") await sendMailSafe(mail.orgVerification(org.contactEmail, org.tradeName, decision === "verify", notes));
  await audit({ actorUserId: admin.id, action: `admin.org_${decision}`, targetType: "Organization", targetId: orgId, orgId, metadata: { from: org.verificationStatus, to } });
}

export async function moderateJob(admin: CurrentUser, jobId: string, decision: "approve" | "remove", notes: string | null) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { id: true, status: true, title: true, orgId: true, publishedAt: true, createdById: true, org: { select: { verificationStatus: true } } } });
  if (!job) throw notFound();
  if (decision === "approve") {
    if (job.status !== "PENDING_REVIEW") throw conflict("A vaga não está em moderação.");
    if (job.org.verificationStatus !== "VERIFIED") throw conflict("A empresa não está verificada.");
    await db.job.update({ where: { id: jobId }, data: { status: "ACTIVE", moderationNotes: notes, publishedAt: job.publishedAt ?? new Date() } });
  } else {
    if (job.status === "REMOVED") throw conflict("A vaga já foi removida.");
    await db.job.update({ where: { id: jobId }, data: { status: "REMOVED", moderationNotes: notes, closedAt: new Date() } });
  }
  if (job.createdById) {
    await notify({
      userId: job.createdById,
      type: "JOB_MODERATION",
      title: decision === "approve" ? "Vaga aprovada na moderação" : "Vaga removida pela moderação",
      body: `"${job.title}"${notes ? ` — ${notes}` : ""}`,
      link: `/empresa/${job.orgId}/vagas/${job.id}`,
    });
  }
  await audit({ actorUserId: admin.id, action: `admin.job_${decision}`, targetType: "Job", targetId: jobId, orgId: job.orgId, metadata: { from: job.status } });
}

export async function resolveReport(admin: CurrentUser, reportId: string, status: ReportStatus, resolution: string | null) {
  const res = await db.report.updateMany({
    where: { id: reportId },
    data: { status, resolution, handledById: admin.id, resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null },
  });
  if (res.count === 0) throw notFound();
  await audit({ actorUserId: admin.id, action: "admin.report_updated", targetType: "Report", targetId: reportId, metadata: { status } });
}

export async function setUserStatus(admin: CurrentUser, userId: string, status: "ACTIVE" | "SUSPENDED") {
  if (userId === admin.id) throw forbidden("Você não pode alterar a própria conta por aqui.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status === "DELETED") throw notFound();
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") await invalidateAllSessions(userId);
  await audit({ actorUserId: admin.id, action: status === "SUSPENDED" ? "admin.user_suspended" : "admin.user_reactivated", targetType: "User", targetId: userId });
}

export async function revokeUserSessions(admin: CurrentUser, userId: string) {
  const n = await invalidateAllSessions(userId);
  await audit({ actorUserId: admin.id, action: "admin.user_sessions_revoked", targetType: "User", targetId: userId, metadata: { count: n } });
}

export async function updatePrivacyRequest(admin: CurrentUser, id: string, status: PrivacyRequestStatus, response: string | null) {
  const req = await db.privacyRequest.findUnique({ where: { id }, select: { userId: true, protocol: true } });
  if (!req) throw notFound();
  await db.privacyRequest.update({
    where: { id },
    data: { status, response, handledById: admin.id, completedAt: status === "COMPLETED" || status === "REJECTED" ? new Date() : null },
  });
  if (req.userId && response) {
    await notify({ userId: req.userId, type: "SYSTEM", title: `Solicitação ${req.protocol} atualizada`, body: response.slice(0, 300), link: "/minha-conta/privacidade" });
  }
  await audit({ actorUserId: admin.id, action: "admin.privacy_request_updated", targetType: "PrivacyRequest", targetId: id, metadata: { status } });
}

export type IncidentInput = {
  id?: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedAt: Date;
  personalDataAffected: boolean;
  dataCategories: string[];
  estimatedSubjects: number | null;
  riskAssessment: string | null;
  anpdNotificationRequired: boolean | null;
  anpdNotifiedAt: Date | null;
  subjectsNotifiedAt: Date | null;
  actionsTaken: string | null;
};

export async function saveIncident(admin: CurrentUser, input: IncidentInput) {
  const { id, ...data } = input;
  const now = new Date();
  const existing = id ? await db.securityIncident.findUnique({ where: { id }, select: { containedAt: true, resolvedAt: true } }) : null;
  if (id && !existing) throw notFound();
  // Registra o PRIMEIRO momento de contenção/resolução (linha do tempo para a ANPD).
  const containedAt = data.status === "OPEN" ? null : (existing?.containedAt ?? now);
  const resolvedAt = data.status === "RESOLVED" ? (existing?.resolvedAt ?? now) : null;
  const saved = id
    ? await db.securityIncident.update({ where: { id }, data: { ...data, containedAt, resolvedAt } })
    : await db.securityIncident.create({ data: { ...data, createdById: admin.id, containedAt, resolvedAt } });
  await audit({ actorUserId: admin.id, action: id ? "admin.incident_updated" : "admin.incident_created", targetType: "SecurityIncident", targetId: saved.id, metadata: { severity: data.severity, status: data.status } });
  return saved;
}

export async function setDatasetStatus(admin: CurrentUser, datasetId: string, status: "PUBLISHED" | "ARCHIVED") {
  const ds = await db.statDataset.findUnique({ where: { id: datasetId }, select: { id: true, source: true, status: true } });
  if (!ds) throw notFound();
  await db.$transaction(async (tx) => {
    if (status === "PUBLISHED") {
      // Apenas um conjunto publicado por fonte: o anterior é arquivado.
      await tx.statDataset.updateMany({ where: { source: ds.source, status: "PUBLISHED", NOT: { id: ds.id } }, data: { status: "ARCHIVED" } });
    }
    await tx.statDataset.update({ where: { id: ds.id }, data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined } });
  });
  await audit({ actorUserId: admin.id, action: `admin.dataset_${status.toLowerCase()}`, targetType: "StatDataset", targetId: datasetId });
}
