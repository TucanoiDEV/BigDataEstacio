import "server-only";
import type { JobStatus } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { conflict, forbidden, invalid, notFound } from "@/server/errors";
import type { OrgAccess } from "@/server/auth/dal";
import { roleCan } from "@/server/authz/permissions";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { notifyMany, platformAdminIds } from "@/server/services/notifications";
import { upsertSkills } from "@/server/services/skills";
import { detectFraudSignals } from "@/lib/fraud";
import { normalizeText, slugify } from "@/lib/text";
import type { JobData } from "@/lib/validation/job";

export function buildSearchText(job: { title: string; description: string; requirements?: string | null; sector: string; city?: string | null; state?: string | null }, orgName: string, skills: string[]): string {
  return normalizeText([job.title, orgName, job.sector, job.city ?? "", job.state ?? "", skills.join(" "), job.requirements ?? "", job.description].join(" ")).slice(0, 20000);
}

async function writeSkills(tx: Tx, jobId: string, data: JobData) {
  await tx.jobSkill.deleteMany({ where: { jobId } });
  const skills = await upsertSkills(tx, data.skills);
  const requiredSlugs = new Set(data.requiredSkills.map((s) => slugify(s, 40)));
  if (skills.length) {
    await tx.jobSkill.createMany({
      data: skills.map((s) => ({ jobId, skillId: s.id, required: requiredSlugs.size === 0 ? true : requiredSlugs.has(s.slug) })),
    });
  }
}

function assertCanManage(access: OrgAccess) {
  if (!roleCan(access.membership.role, "jobs.manage")) throw forbidden();
}

/** Decide o status ao publicar: empresa verificada + sem sinais de fraude => ACTIVE. */
function publishStatus(orgStatus: string, signals: string[]): JobStatus {
  if (orgStatus !== "VERIFIED") throw invalid("Sua empresa precisa estar verificada para publicar vagas. Você pode salvar como rascunho.");
  return signals.length ? "PENDING_REVIEW" : "ACTIVE";
}

async function warnModeration(jobId: string, title: string, signals: string[]) {
  if (!signals.length) return;
  await notifyMany(await platformAdminIds(), {
    type: "JOB_MODERATION",
    title: "Vaga retida para moderação",
    body: `"${title}" — sinais: ${signals.join(", ")}`,
    link: `/admin/vagas?id=${jobId}`,
  });
}

export async function createJob(access: OrgAccess, data: JobData) {
  assertCanManage(access);
  await enforceRateLimits([{ key: `job-create:org:${access.org.id}`, limit: 50, windowSeconds: 86400 }]);
  const signals = detectFraudSignals(data);
  const status: JobStatus = data.publish ? publishStatus(access.org.verificationStatus, signals) : "DRAFT";

  const job = await db.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        orgId: access.org.id,
        createdById: access.user.id,
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        benefits: data.benefits,
        sector: data.sector,
        seniority: data.seniority,
        contractType: data.contractType,
        workModel: data.workModel,
        city: data.city,
        state: data.state,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryVisible: data.salaryVisible,
        positions: data.positions,
        status,
        fraudSignals: signals,
        publishedAt: status === "ACTIVE" ? new Date() : null,
        searchText: buildSearchText(data, access.org.tradeName, data.skills),
      },
      select: { id: true, title: true, status: true },
    });
    await writeSkills(tx, created.id, data);
    return created;
  });
  await audit({ actorUserId: access.user.id, action: "job.created", orgId: access.org.id, targetType: "Job", targetId: job.id, metadata: { status, signals } });
  if (status === "PENDING_REVIEW") await warnModeration(job.id, job.title, signals);
  return job;
}

async function loadOrgJob(access: OrgAccess, jobId: string) {
  // Escopo por orgId impede IDOR: o ID da vaga sozinho não basta.
  const job = await db.job.findFirst({ where: { id: jobId, orgId: access.org.id }, select: { id: true, status: true, title: true, publishedAt: true, fraudSignals: true } });
  if (!job) throw notFound("Vaga não encontrada.");
  return job;
}

export async function updateJob(access: OrgAccess, jobId: string, data: JobData) {
  assertCanManage(access);
  const current = await loadOrgJob(access, jobId);
  if (current.status === "REMOVED") throw forbidden("Esta vaga foi removida pela moderação e não pode ser editada.");
  if (current.status === "CLOSED") throw invalid("Vagas encerradas não podem ser editadas.");

  const signals = detectFraudSignals(data);
  let status: JobStatus = current.status;
  if (data.publish && (current.status === "DRAFT" || current.status === "PAUSED")) status = publishStatus(access.org.verificationStatus, signals);
  if (current.status === "ACTIVE" && signals.length) status = "PENDING_REVIEW";

  await db.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        benefits: data.benefits,
        sector: data.sector,
        seniority: data.seniority,
        contractType: data.contractType,
        workModel: data.workModel,
        city: data.city,
        state: data.state,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryVisible: data.salaryVisible,
        positions: data.positions,
        status,
        fraudSignals: signals,
        publishedAt: status === "ACTIVE" && !current.publishedAt ? new Date() : undefined,
        searchText: buildSearchText(data, access.org.tradeName, data.skills),
      },
    });
    await writeSkills(tx, jobId, data);
  });
  await audit({ actorUserId: access.user.id, action: "job.updated", orgId: access.org.id, targetType: "Job", targetId: jobId, metadata: { from: current.status, to: status, signals } });
  if (status === "PENDING_REVIEW" && current.status !== "PENDING_REVIEW") await warnModeration(jobId, data.title, signals);
  return { status };
}

export type JobLifecycleAction = "pause" | "resume" | "close";

export async function changeJobLifecycle(access: OrgAccess, jobId: string, action: JobLifecycleAction) {
  assertCanManage(access);
  const job = await loadOrgJob(access, jobId);
  const allowed: Record<JobLifecycleAction, JobStatus[]> = {
    pause: ["ACTIVE"],
    resume: ["PAUSED"],
    close: ["ACTIVE", "PAUSED", "DRAFT", "PENDING_REVIEW"],
  };
  if (!allowed[action].includes(job.status)) throw conflict("Essa ação não está disponível para o status atual da vaga.");
  if (action === "resume" && access.org.verificationStatus !== "VERIFIED") throw invalid("A empresa precisa estar verificada.");

  // Retomar passa pela mesma regra de publicação: conteúdo editado com sinais de fraude
  // enquanto pausado vai para moderação em vez de voltar ao ar.
  const to: JobStatus = action === "pause" ? "PAUSED" : action === "resume" ? publishStatus(access.org.verificationStatus, job.fraudSignals) : "CLOSED";
  const res = await db.job.updateMany({
    where: { id: jobId, orgId: access.org.id, status: job.status },
    data: { status: to, closedAt: to === "CLOSED" ? new Date() : undefined },
  });
  if (res.count === 0) throw conflict("A vaga foi alterada por outra pessoa. Recarregue a página.");
  await audit({ actorUserId: access.user.id, action: `job.${action}`, orgId: access.org.id, targetType: "Job", targetId: jobId, metadata: { from: job.status, to } });
  if (to === "PENDING_REVIEW") await warnModeration(jobId, job.title, job.fraudSignals);
  return { status: to };
}

export async function getOrgJobForEdit(access: OrgAccess, jobId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, orgId: access.org.id },
    include: { skills: { include: { skill: true } } },
  });
  if (!job) return null;
  return job;
}

/** Condição pública: vaga ativa de empresa verificada e dentro do prazo. */
export function publicJobWhere(now: Date) {
  return {
    status: "ACTIVE" as const,
    org: { verificationStatus: "VERIFIED" as const },
    OR: [{ closesAt: null }, { closesAt: { gt: now } }],
  };
}

export async function getPublicJob(id: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return null;
  const job = await db.job.findFirst({
    where: { id, status: { in: ["ACTIVE", "CLOSED", "PAUSED"] }, org: { verificationStatus: "VERIFIED" } },
    include: {
      org: { select: { id: true, slug: true, tradeName: true, description: true, website: true, sector: true, sizeRange: true, city: true, state: true, logoFileId: true, isDemo: true } },
      skills: { include: { skill: { select: { slug: true, name: true } } }, orderBy: { required: "desc" } },
    },
  });
  return job;
}
