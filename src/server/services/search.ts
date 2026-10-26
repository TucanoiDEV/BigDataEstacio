import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { publicJobWhere } from "@/server/services/jobs";
import { externalJobCardSelect, type ExternalJobCardData } from "@/server/services/external-jobs";
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
  org: { select: { id: true, slug: true, tradeName: true, logoFileId: true, isDemo: true } },
} satisfies Prisma.JobSelect;

export type JobCardData = Prisma.JobGetPayload<{ select: typeof jobCardSelect }>;

/** Item da busca unificada: vaga publicada na plataforma ou agregada de outro site. */
export type SearchItem = { kind: "internal"; job: JobCardData } | { kind: "external"; job: ExternalJobCardData };

// Comparação de cidade sem acento e sem caixa nos dois lados ("Sao Paulo" = "São Paulo").
const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "aaaaaeeeeiiiiooooouuuucn";

type SearchOpts = { publishedAfter?: Date };

function searchTerms(filters: JobSearch): string[] {
  return filters.q ? normalizeText(filters.q).split(" ").filter((t) => t.length > 1).slice(0, 8) : [];
}

/** Condições das vagas da plataforma (alias j = Job, o = Organization). */
function internalConditions(filters: JobSearch, terms: string[], opts: SearchOpts): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [
    Prisma.sql`j."status" = 'ACTIVE'`,
    Prisma.sql`o."verificationStatus" = 'VERIFIED'`,
    Prisma.sql`(j."closesAt" IS NULL OR j."closesAt" > now())`,
  ];
  for (const t of terms) conds.push(Prisma.sql`j."searchText" LIKE ${`%${escapeLike(t)}%`}`);
  if (filters.uf) conds.push(Prisma.sql`j."state" = ${filters.uf}`);
  if (filters.city) conds.push(Prisma.sql`translate(lower(j."city"), ${ACCENTED}, ${PLAIN}) = ${normalizeText(filters.city)}`);
  if (filters.modalidade.length) conds.push(Prisma.sql`j."workModel"::text = ANY(${filters.modalidade})`);
  if (filters.contrato.length) conds.push(Prisma.sql`j."contractType"::text = ANY(${filters.contrato})`);
  if (filters.senioridade.length) conds.push(Prisma.sql`j."seniority"::text = ANY(${filters.senioridade})`);
  if (filters.setor) conds.push(Prisma.sql`j."sector" = ${filters.setor}`);
  if (filters.salarioMin) conds.push(Prisma.sql`j."salaryVisible" AND COALESCE(j."salaryMin", j."salaryMax") >= ${filters.salarioMin}`);
  if (filters.empresa) conds.push(Prisma.sql`o."slug" = ${filters.empresa}`);
  if (opts.publishedAfter) conds.push(Prisma.sql`j."publishedAt" > ${opts.publishedAfter}`);
  return conds;
}

/**
 * Condições das vagas externas (alias e = ExternalJob). Mesmos filtros: um dado que a fonte não
 * informa (contratação, senioridade, setor) não satisfaz o filtro, como uma vaga com salário
 * oculto não entra no filtro de salário.
 */
function externalConditions(filters: JobSearch, terms: string[], opts: SearchOpts): Prisma.Sql[] {
  if (filters.contrato.length || filters.senioridade.length || filters.setor || filters.empresa) return [Prisma.sql`FALSE`];
  const conds: Prisma.Sql[] = [Prisma.sql`e."active"`];
  for (const t of terms) conds.push(Prisma.sql`e."searchText" LIKE ${`%${escapeLike(t)}%`}`);
  if (filters.uf) conds.push(Prisma.sql`e."state" = ${filters.uf}`);
  if (filters.city) conds.push(Prisma.sql`e."cityNormalized" = ${normalizeText(filters.city)}`);
  if (filters.modalidade.length) conds.push(Prisma.sql`e."workModel"::text = ANY(${filters.modalidade})`);
  if (filters.salarioMin) conds.push(Prisma.sql`COALESCE(e."salaryMin", e."salaryMax") >= ${filters.salarioMin}`);
  // Para alertas, "nova" é a vaga que chegou à plataforma depois do último aviso.
  if (opts.publishedAfter) conds.push(Prisma.sql`e."firstSeenAt" > ${opts.publishedAfter}`);
  return conds;
}

/** Une as duas origens numa só relação (kind, id, ts, salary, sim): base da listagem e da contagem. */
function unionSql(filters: JobSearch, terms: string[], opts: SearchOpts): Prisma.Sql {
  const sim = (col: Prisma.Sql) => (terms.length ? Prisma.sql`similarity(${col}, ${terms.join(" ")})` : Prisma.sql`0`);
  return Prisma.sql`
    SELECT 'internal' AS kind, j."id", j."publishedAt" AS ts,
           CASE WHEN j."salaryVisible" THEN COALESCE(j."salaryMax", j."salaryMin") END AS salary,
           ${sim(Prisma.sql`j."searchText"`)} AS sim
    FROM "Job" j JOIN "Organization" o ON o."id" = j."orgId"
    WHERE ${Prisma.join(internalConditions(filters, terms, opts), " AND ")}
    UNION ALL
    SELECT 'external' AS kind, e."id", e."postedAt" AS ts,
           COALESCE(e."salaryMax", e."salaryMin") AS salary,
           ${sim(Prisma.sql`e."searchText"`)} AS sim
    FROM "ExternalJob" e
    WHERE ${Prisma.join(externalConditions(filters, terms, opts), " AND ")}`;
}

/**
 * Busca de vagas públicas: as da plataforma e as de outros sites numa lista só, com a mesma
 * ordenação, paginação e contagem. Todos os valores são passados como parâmetros (Prisma.sql),
 * nunca concatenados ao SQL.
 */
export async function searchJobs(filters: JobSearch, pageSize = PAGE_SIZE, opts: SearchOpts = {}): Promise<{ items: SearchItem[]; total: number; page: number; pages: number }> {
  const page = filters.pagina ?? 1;
  const terms = searchTerms(filters);
  const sort = filters.ordem ?? (terms.length ? "relevance" : "recent");
  const orderBy =
    sort === "salary"
      ? Prisma.sql`salary DESC NULLS LAST, ts DESC NULLS LAST`
      : sort === "relevance" && terms.length
        ? Prisma.sql`sim DESC, ts DESC NULLS LAST`
        : Prisma.sql`ts DESC NULLS LAST`;

  const union = unionSql(filters, terms, opts);
  const rows = await db.$queryRaw<{ kind: SearchItem["kind"]; id: string; total: bigint }[]>`
    SELECT kind, id, count(*) OVER() AS total
    FROM (${union}) r
    ORDER BY ${orderBy}, kind, id
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

  const total = rows.length ? Number(rows[0].total) : page > 1 ? await countUnion(union) : 0;
  const internalIds = rows.filter((r) => r.kind === "internal").map((r) => r.id);
  const externalIds = rows.filter((r) => r.kind === "external").map((r) => r.id);
  const [internal, external] = await Promise.all([
    internalIds.length ? db.job.findMany({ where: { id: { in: internalIds } }, select: jobCardSelect }) : [],
    externalIds.length ? db.externalJob.findMany({ where: { id: { in: externalIds } }, select: externalJobCardSelect }) : [],
  ]);
  const internalById = new Map(internal.map((j) => [j.id, j]));
  const externalById = new Map(external.map((j) => [j.id, j]));
  const items = rows.flatMap((r): SearchItem[] => {
    if (r.kind === "internal") {
      const job = internalById.get(r.id);
      return job ? [{ kind: "internal", job }] : [];
    }
    const job = externalById.get(r.id);
    return job ? [{ kind: "external", job }] : [];
  });
  return { items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function countUnion(union: Prisma.Sql): Promise<number> {
  const r = await db.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM (${union}) r`;
  return Number(r[0]?.total ?? 0);
}

/** Contagens da página inicial, somando as duas origens com a mesma regra de "vaga aberta". */
export async function publicJobStats(now = new Date()): Promise<{ jobs: number; companies: number; states: number }> {
  const [row] = await db.$queryRaw<{ jobs: bigint; companies: bigint; states: bigint }[]>`
    SELECT count(*) AS jobs, count(DISTINCT company) AS companies, count(DISTINCT state) AS states FROM (
      SELECT 'org:' || j."orgId" AS company, j."state" FROM "Job" j JOIN "Organization" o ON o."id" = j."orgId"
      WHERE j."status" = 'ACTIVE' AND o."verificationStatus" = 'VERIFIED' AND NOT o."isDemo" AND (j."closesAt" IS NULL OR j."closesAt" > ${now})
      UNION ALL
      SELECT 'ext:' || lower(e."companyName"), e."state" FROM "ExternalJob" e WHERE e."active"
    ) s`;
  return { jobs: Number(row?.jobs ?? 0), companies: Number(row?.companies ?? 0), states: Number(row?.states ?? 0) };
}

/** Setores com mais vagas ativas (para a página inicial). Vagas de demonstração não entram na contagem. */
export async function trendingSectors(limit = 8, now = new Date()) {
  const rows = await db.job.groupBy({
    by: ["sector"],
    where: { ...publicJobWhere(now), org: { verificationStatus: "VERIFIED", isDemo: false } },
    _count: { _all: true },
    orderBy: { _count: { sector: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ sector: r.sector, count: r._count._all }));
}
