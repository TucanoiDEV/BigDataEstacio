import "server-only";
import type { AlertFrequency, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { invalid, notFound } from "@/server/errors";
import { enforceRateLimits } from "@/server/security/rate-limit";
import { publicJobWhere } from "@/server/services/jobs";
import { alertFiltersSchema, type AlertFilters } from "@/lib/validation/search";

export async function toggleSavedJob(userId: string, jobId: string): Promise<boolean> {
  await enforceRateLimits([{ key: `save:user:${userId}`, limit: 200, windowSeconds: 3600 }]);
  const existing = await db.savedJob.findUnique({ where: { userId_jobId: { userId, jobId } } });
  if (existing) {
    await db.savedJob.delete({ where: { userId_jobId: { userId, jobId } } });
    return false;
  }
  const job = await db.job.findFirst({ where: { id: jobId, ...publicJobWhere(new Date()) }, select: { id: true } });
  if (!job) throw notFound("Vaga não disponível.");
  await db.savedJob.create({ data: { userId, jobId } });
  return true;
}

export async function savedJobIds(userId: string, jobIds: string[]): Promise<Set<string>> {
  if (!jobIds.length) return new Set();
  const rows = await db.savedJob.findMany({ where: { userId, jobId: { in: jobIds } }, select: { jobId: true } });
  return new Set(rows.map((r) => r.jobId));
}

export async function createAlert(userId: string, input: { name: string; frequency: AlertFrequency; filters: AlertFilters }) {
  const count = await db.jobAlert.count({ where: { userId } });
  if (count >= 10) throw invalid("Você pode ter até 10 alertas.");
  const filters = alertFiltersSchema.parse(input.filters);
  if (!filters.q && !filters.uf && !filters.setor && !filters.modalidade.length && !filters.contrato.length && !filters.senioridade.length) {
    throw invalid("Defina pelo menos um filtro (palavra-chave, UF, setor, modalidade...).");
  }
  return db.jobAlert.create({
    data: { userId, name: input.name, frequency: input.frequency, filters: filters as unknown as Prisma.InputJsonValue },
  });
}

export async function updateAlert(userId: string, alertId: string, data: { active?: boolean; frequency?: AlertFrequency }) {
  const res = await db.jobAlert.updateMany({ where: { id: alertId, userId }, data });
  if (res.count === 0) throw notFound();
}

export async function deleteAlert(userId: string, alertId: string) {
  const res = await db.jobAlert.deleteMany({ where: { id: alertId, userId } });
  if (res.count === 0) throw notFound();
}
