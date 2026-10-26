import "server-only";
import { db } from "@/server/db";
import { jobCardSelect, type JobCardData } from "@/server/services/search";
import { publicJobWhere } from "@/server/services/jobs";
import { isSparseProfile, scoreJob, yearsOfExperience, type RecJob, type RecProfile, type RecResult } from "@/lib/recommendation";

export async function loadRecProfile(userId: string, now: Date): Promise<RecProfile | null> {
  const p = await db.candidateProfile.findUnique({
    where: { userId },
    include: { skills: { include: { skill: { select: { slug: true } } } }, experiences: { select: { startDate: true, endDate: true, isCurrent: true } } },
  });
  if (!p || !p.recommendationsEnabled) return null;
  return {
    skills: p.skills.map((s) => s.skill.slug),
    desiredTitle: p.desiredTitle,
    desiredSectors: p.desiredSectors,
    desiredWorkModels: p.desiredWorkModels,
    desiredContractTypes: p.desiredContractTypes,
    desiredSeniority: p.desiredSeniority,
    desiredSalaryMin: p.desiredSalaryMin,
    city: p.city,
    state: p.state,
    openToRelocation: p.openToRelocation,
    yearsExperience: yearsOfExperience(p.experiences, now),
  };
}

const recSelect = {
  ...jobCardSelect,
  skills: { select: { required: true, skill: { select: { slug: true, name: true } } } },
} as const;

function toRecJob(j: { title: string; sector: string; workModel: RecJob["workModel"]; contractType: RecJob["contractType"]; seniority: RecJob["seniority"]; city: string | null; state: string | null; salaryMin: number | null; salaryMax: number | null; salaryVisible: boolean; skills: { required: boolean; skill: { slug: string; name: string } }[] }): RecJob {
  return {
    title: j.title,
    sector: j.sector,
    workModel: j.workModel,
    contractType: j.contractType,
    seniority: j.seniority,
    city: j.city,
    state: j.state,
    salaryMin: j.salaryVisible ? j.salaryMin : null,
    salaryMax: j.salaryVisible ? j.salaryMax : null,
    skills: j.skills.map((s) => ({ slug: s.skill.slug, name: s.skill.name, required: s.required })),
  };
}

/** Recomenda vagas ativas para o candidato, com justificativas. Não altera candidaturas. */
export async function recommendJobs(userId: string, now: Date, limit = 6): Promise<{ items: { job: JobCardData; rec: RecResult }[]; sparseProfile: boolean }> {
  const profile = await loadRecProfile(userId, now);
  if (!profile) return { items: [], sparseProfile: false };
  const applied = await db.application.findMany({ where: { candidateUserId: userId }, select: { jobId: true } });
  const exclude = applied.map((a) => a.jobId);
  const jobs = await db.job.findMany({
    where: { ...publicJobWhere(now), id: { notIn: exclude } },
    orderBy: { publishedAt: "desc" },
    take: 300,
    select: recSelect,
  });
  const items = jobs
    .map((j) => ({ job: j as JobCardData, rec: scoreJob(profile, toRecJob(j)) }))
    .filter((x) => x.rec.score >= 35)
    .sort((a, b) => b.rec.score - a.rec.score)
    .slice(0, limit);
  return { items, sparseProfile: isSparseProfile(profile) };
}

export async function explainJobForUser(userId: string, jobId: string, now: Date): Promise<RecResult | null> {
  const profile = await loadRecProfile(userId, now);
  if (!profile) return null;
  const job = await db.job.findUnique({ where: { id: jobId }, select: recSelect });
  if (!job) return null;
  return scoreJob(profile, toRecJob(job));
}
