import "server-only";
import type { ApplicationStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import type { CurrentUser, OrgAccess } from "@/server/auth/dal";
import { roleCan } from "@/server/authz/permissions";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { isDownloadable } from "@/server/storage/files";
import { ensureProfile } from "@/server/services/profile";
import { notify, notifyMany } from "@/server/services/notifications";
import { sendMailSafe } from "@/server/mail/mailer";
import { mail } from "@/server/mail/templates";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { candidateCanWithdraw, companyCanTransition } from "@/lib/application-status";

export type ProfileSnapshot = {
  name: string;
  email: string | null;
  phone: string | null;
  headline: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  skills: string[];
  experiences: { title: string; company: string; startDate: string; endDate: string | null; isCurrent: boolean; description: string | null }[];
  educations: { institution: string; degree: string; field: string | null; endDate: string | null; inProgress: boolean }[];
  capturedAt: string;
};

/**
 * Monta o recorte do perfil compartilhado com a empresa. Respeita as escolhas
 * de privacidade do candidato (e-mail/telefone) e NÃO inclui foto.
 */
async function buildSnapshot(userId: string, share: { email: boolean; phone: boolean }): Promise<ProfileSnapshot> {
  await ensureProfile(userId);
  const p = await db.candidateProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true } },
      experiences: { orderBy: { startDate: "desc" }, take: 15 },
      educations: { orderBy: { endDate: "desc" }, take: 10 },
      skills: { include: { skill: true } },
    },
  });
  if (!p) throw invalid("Complete seu perfil antes de se candidatar.");
  return {
    name: p.user.name,
    email: share.email ? p.user.email : null,
    phone: share.phone ? p.phone : null,
    headline: p.headline,
    about: p.about,
    city: p.city,
    state: p.state,
    linkedinUrl: p.linkedinUrl,
    portfolioUrl: p.portfolioUrl,
    skills: p.skills.map((s) => s.skill.name),
    experiences: p.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      startDate: e.startDate.toISOString().slice(0, 7),
      endDate: e.endDate ? e.endDate.toISOString().slice(0, 7) : null,
      isCurrent: e.isCurrent,
      description: e.description,
    })),
    educations: p.educations.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      endDate: e.endDate ? e.endDate.toISOString().slice(0, 7) : null,
      inProgress: e.inProgress,
    })),
    capturedAt: new Date().toISOString(),
  };
}

export async function applyToJob(
  user: CurrentUser,
  input: { jobId: string; resumeId: string | null; coverLetter: string | null; shareEmail: boolean; sharePhone: boolean },
) {
  await enforceRateLimits([{ key: `apply:user:${user.id}`, limit: 40, windowSeconds: 86400 }]);

  const job = await db.job.findFirst({
    where: { id: input.jobId, status: "ACTIVE", org: { verificationStatus: "VERIFIED" }, OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
    select: { id: true, title: true, orgId: true, createdById: true, org: { select: { tradeName: true } } },
  });
  if (!job) throw notFound("Esta vaga não está mais recebendo candidaturas.");

  const isMember = await db.orgMembership.findUnique({ where: { orgId_userId: { orgId: job.orgId, userId: user.id } }, select: { id: true } });
  if (isMember) throw forbidden("Membros da empresa não podem se candidatar às vagas dela.");

  if (input.resumeId) {
    const resume = await db.resume.findFirst({ where: { id: input.resumeId, profileId: user.id }, select: { file: { select: { scanStatus: true } } } });
    if (!resume) throw notFound("Currículo não encontrado.");
    if (!isDownloadable(resume.file.scanStatus)) throw invalid("Este currículo ainda não foi liberado pela verificação de segurança.");
  }

  const snapshot = await buildSnapshot(user.id, { email: input.shareEmail, phone: input.sharePhone });

  let applicationId: string;
  try {
    applicationId = await db.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          jobId: job.id,
          candidateUserId: user.id,
          resumeId: input.resumeId,
          coverLetter: input.coverLetter,
          profileSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          history: { create: { toStatus: "SUBMITTED", changedById: user.id } },
        },
        select: { id: true },
      });
      return app.id;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("Você já se candidatou a esta vaga.");
    }
    throw err;
  }

  const recruiters = await db.orgMembership.findMany({ where: { orgId: job.orgId, role: { in: ["OWNER", "ADMIN", "RECRUITER"] } }, select: { userId: true } });
  const link = `/empresa/${job.orgId}/candidaturas/${applicationId}`;
  await notifyMany(recruiters.map((r) => r.userId), { type: "APPLICATION_RECEIVED", title: "Nova candidatura", body: `Nova candidatura para "${job.title}".`, link });
  if (job.createdById) {
    const creator = await db.user.findUnique({ where: { id: job.createdById }, select: { email: true, status: true } });
    if (creator?.status === "ACTIVE") await sendMailSafe(mail.applicationReceived(creator.email, job.title, new URL(link, env().APP_URL).toString()));
  }
  await audit({ actorUserId: user.id, action: "application.submitted", orgId: job.orgId, targetType: "Application", targetId: applicationId, metadata: { jobId: job.id, withResume: Boolean(input.resumeId) } });
  return applicationId;
}

export async function withdrawApplication(user: CurrentUser, applicationId: string) {
  const app = await db.application.findFirst({
    where: { id: applicationId, candidateUserId: user.id },
    select: { id: true, status: true, job: { select: { title: true, orgId: true } } },
  });
  if (!app) throw notFound();
  if (!candidateCanWithdraw(app.status)) throw conflict("Esta candidatura já foi finalizada.");
  // Status e histórico juntos: uma falha no histórico reverte a retirada.
  await db.$transaction(async (tx) => {
    const res = await tx.application.updateMany({ where: { id: app.id, status: app.status }, data: { status: "WITHDRAWN" } });
    if (res.count === 0) throw conflict("A candidatura foi atualizada. Recarregue a página.");
    await tx.applicationStatusChange.create({ data: { applicationId: app.id, fromStatus: app.status, toStatus: "WITHDRAWN", changedById: user.id } });
  });
  const recruiters = await db.orgMembership.findMany({ where: { orgId: app.job.orgId, role: { in: ["OWNER", "ADMIN", "RECRUITER"] } }, select: { userId: true } });
  await notifyMany(recruiters.map((r) => r.userId), { type: "APPLICATION_STATUS", title: "Candidatura retirada", body: `Uma candidatura para "${app.job.title}" foi retirada pelo(a) candidato(a).`, link: `/empresa/${app.job.orgId}/candidaturas/${app.id}` });
  await audit({ actorUserId: user.id, action: "application.withdrawn", orgId: app.job.orgId, targetType: "Application", targetId: app.id });
}

/** Alteração de status pela empresa. Valida vínculo, permissão e transição. */
export async function updateApplicationStatus(
  access: OrgAccess,
  input: { applicationId: string; to: ApplicationStatus; messageToCandidate: string | null; internalNote: string | null },
) {
  if (!roleCan(access.membership.role, "applications.update")) throw forbidden();
  // A candidatura precisa pertencer a uma vaga DESTA empresa (bloqueia IDOR).
  const app = await db.application.findFirst({
    where: { id: input.applicationId, job: { orgId: access.org.id } },
    select: { id: true, status: true, candidateUserId: true, job: { select: { title: true } } },
  });
  if (!app) throw notFound("Candidatura não encontrada.");
  if (!companyCanTransition(app.status, input.to)) {
    throw invalid(`Não é possível mudar de "${APPLICATION_STATUS_LABEL[app.status]}" para "${APPLICATION_STATUS_LABEL[input.to]}".`);
  }

  await db.$transaction(async (tx) => {
    // Atualização condicional: evita sobrescrever alteração concorrente.
    const res = await tx.application.updateMany({ where: { id: app.id, status: app.status }, data: { status: input.to } });
    if (res.count === 0) throw conflict("Outra pessoa alterou esta candidatura. Recarregue a página.");
    await tx.applicationStatusChange.create({
      data: {
        applicationId: app.id,
        fromStatus: app.status,
        toStatus: input.to,
        changedById: access.user.id,
        messageToCandidate: input.messageToCandidate,
        internalNote: input.internalNote,
      },
    });
    await notify(
      {
        userId: app.candidateUserId,
        type: "APPLICATION_STATUS",
        title: `Candidatura: ${APPLICATION_STATUS_LABEL[input.to]}`,
        body: `Sua candidatura para "${app.job.title}" em ${access.org.tradeName} foi atualizada.`,
        link: `/minha-conta/candidaturas/${app.id}`,
      },
      tx,
    );
  });

  const candidate = await db.user.findUnique({
    where: { id: app.candidateUserId },
    select: { email: true, status: true, commPreference: { select: { emailApplicationUpdates: true } } },
  });
  if (candidate?.status === "ACTIVE" && (candidate.commPreference?.emailApplicationUpdates ?? true)) {
    await sendMailSafe(
      mail.applicationStatus(
        candidate.email,
        app.job.title,
        access.org.tradeName,
        APPLICATION_STATUS_LABEL[input.to],
        new URL(`/minha-conta/candidaturas/${app.id}`, env().APP_URL).toString(),
        input.messageToCandidate,
      ),
    );
  }
  await audit({ actorUserId: access.user.id, action: "application.status_changed", orgId: access.org.id, targetType: "Application", targetId: app.id, metadata: { from: app.status, to: input.to } });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listCandidateApplications(userId: string) {
  return db.application.findMany({
    where: { candidateUserId: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      job: { select: { id: true, title: true, city: true, state: true, workModel: true, status: true, org: { select: { tradeName: true, slug: true } } } },
    },
  });
}

export async function getCandidateApplication(userId: string, applicationId: string) {
  return db.application.findFirst({
    where: { id: applicationId, candidateUserId: userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      coverLetter: true,
      resume: { select: { label: true } },
      job: { select: { id: true, title: true, city: true, state: true, workModel: true, org: { select: { tradeName: true, slug: true } } } },
      // Nota interna da empresa NUNCA é exposta ao candidato.
      history: { orderBy: { createdAt: "asc" }, select: { id: true, toStatus: true, fromStatus: true, messageToCandidate: true, createdAt: true } },
    },
  });
}

export async function listJobApplications(access: OrgAccess, jobId: string, status?: ApplicationStatus) {
  if (!roleCan(access.membership.role, "applications.view")) throw forbidden();
  return db.application.findMany({
    where: { jobId, job: { orgId: access.org.id }, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, updatedAt: true, profileSnapshot: true, resumeId: true },
  });
}

export async function getOrgApplication(access: OrgAccess, applicationId: string) {
  if (!roleCan(access.membership.role, "applications.view")) return null;
  return db.application.findFirst({
    where: { id: applicationId, job: { orgId: access.org.id } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      coverLetter: true,
      profileSnapshot: true,
      resume: { select: { id: true, label: true, fileId: true, file: { select: { scanStatus: true, sizeBytes: true } } } },
      job: { select: { id: true, title: true } },
      history: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStatus: true, toStatus: true, messageToCandidate: true, internalNote: true, createdAt: true, changedBy: { select: { name: true } } },
      },
    },
  });
}
