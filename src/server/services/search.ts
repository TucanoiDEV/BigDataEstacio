import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { PAGE_SIZE } from "@/lib/constants";
import { normalizeText } from "@/lib/text";
import type { JobSearch } from "@/lib/validation/search";

/** Escapa curingas do LIKE para que a entrada do usuário seja tratada literalmente. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const jobCardSelect = {
  id: true,
  title: true,
  city: true,
  state: true,
  workModel: true,
  contractType: true,
  seniority: true,
  sector: true,
  salaryMin: true,
  salaryMax: true,
  salaryVisible: true,
  publishedAt: true,
  org: { select: { id: true, slug: true, tradeName: true, logoFileId: true } },
} satisfies Prisma.JobSelect;

export type JobCardData = Prisma.JobGetPayload<{ select: typeof jobCardSelect }>;

/**
 * Busca de vagas públicas. Todos os valores são passados como parâmetros
 * (Prisma.sql), nunca concatenados ao SQL.
 */
export async function searchJobs(filters: JobSearch, pageSize = PAGE_SIZE, opts: { publishedAfter?: Date } = {}): Promise<{ jobs: JobCardData[]; total: number; page: number; pages: number }> {
  const page = filters.pagina ?? 1;
  const conds: Prisma.Sql[] = [
    Prisma.sql`j."status" = 'ACTIVE'`,
    Prisma.sql`o."verificationStatus" = 'VERIFIED'`,
    Prisma.sql`(j."closesAt" IS NULL OR j."closesAt" > now())`,
  ];

  const terms = filters.q ? normalizeText(filters.q).split(" ").filter((t) => t.length > 1).slice(0, 8) : [];
  for (const t of terms) conds.push(Prisma.sql`j."searchText" LIKE ${`%${escapeLike(t)}%`}`);
  if (filters.uf) conds.push(Prisma.sql`j."state" = ${filters.uf}`);
  if (filters.city) conds.push(Prisma.sql`j."city" ILIKE ${escapeLike(filters.city)}`);
  if (filters.modalidade.length) conds.push(Prisma.sql`j."workModel"::text = ANY(${filters.modalidade})`);
  if (filters.contrato.length) conds.push(Prisma.sql`j."contractType"::text = ANY(${filters.contrato})`);
  if (filters.senioridade.length) conds.push(Prisma.sql`j."seniority"::text = ANY(${filters.senioridade})`);
  if (filters.setor) conds.push(Prisma.sql`j."sector" = ${filters.setor}`);
  if (filters.salarioMin) conds.push(Prisma.sql`j."salaryVisible" AND COALESCE(j."salaryMax", j."salaryMin") >= ${filters.salarioMin}`);
  if (filters.empresa) conds.push(Prisma.sql`o."slug" = ${filters.empresa}`);
  if (opts.publishedAfter) conds.push(Prisma.sql`j."publishedAt" > ${opts.publishedAfter}`);

  const sort = filters.ordem ?? (terms.length ? "relevance" : "recent");
  const orderBy =
    sort === "salary"
      ? Prisma.sql`CASE WHEN j."salaryVisible" THEN COALESCE(j."salaryMax", j."salaryMin") END DESC NULLS LAST, j."publishedAt" DESC`
      : sort === "relevance" && terms.length
        ? Prisma.sql`similarity(j."searchText", ${terms.join(" ")}) DESC, j."publishedAt" DESC`
        : Prisma.sql`j."publishedAt" DESC NULLS LAST`;

  const where = Prisma.join(conds, " AND ");
  const rows = await db.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT j."id", count(*) OVER() AS total
    FROM "Job" j
    JOIN "Organization" o ON o."id" = j."orgId"
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

  const total = rows.length ? Number(rows[0].total) : page > 1 ? await countOnly(where) : 0;
  const ids = rows.map((r) => r.id);
  const jobs = ids.length ? await db.job.findMany({ where: { id: { in: ids } }, select: jobCardSelect }) : [];
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return {
    jobs: ids.map((id) => byId.get(id)).filter((j): j is JobCardData => Boolean(j)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function countOnly(where: Prisma.Sql): Promise<number> {
  const r = await db.$queryRaw<{ total: bigint }[]>`
    SELECT count(*) AS total FROM "Job" j JOIN "Organization" o ON o."id" = j."orgId" WHERE ${where}`;
  return Number(r[0]?.total ?? 0);
}

/** Setores com mais vagas ativas (para a página inicial). */
export async function trendingSectors(limit = 8) {
  const rows = await db.job.groupBy({
    by: ["sector"],
    where: { status: "ACTIVE", org: { verificationStatus: "VERIFIED" } },
    _count: { _all: true },
    orderBy: { _count: { sector: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ sector: r.sector, count: r._count._all }));
}
