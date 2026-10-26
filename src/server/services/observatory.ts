import "server-only";
import type { StatDataset, TerritoryLevel } from "@/generated/prisma/client";
import { db } from "@/server/db";

// Observatório: lê SOMENTE conjuntos de dados oficiais PUBLICADOS por um
// administrador. Nunca mistura com vagas anunciadas na plataforma.

export type Territory = { level: TerritoryLevel; code: string; name: string; ufCode: string | null; ufName: string | null };

export async function getPublishedDatasets() {
  const rows = await db.statDataset.findMany({ where: { status: "PUBLISHED" }, include: { import: { select: { finishedAt: true, files: true } } } });
  return {
    caged: rows.find((r) => r.source === "NOVO_CAGED") ?? null,
    pnad: rows.find((r) => r.source === "IBGE") ?? null,
    rais: rows.find((r) => r.source === "RAIS") ?? null,
  };
}

export type PublishedDataset = NonNullable<Awaited<ReturnType<typeof getPublishedDatasets>>["caged"]>;

export async function listUfs() {
  return db.statTerritory.findMany({ where: { level: "UF" }, orderBy: { name: "asc" }, select: { code: true, name: true, ufAbbr: true } });
}

export async function listMunicipalities(ufCode: string) {
  if (!/^\d{2}$/.test(ufCode)) return [];
  return db.statTerritory.findMany({ where: { level: "MUNICIPALITY", ufCode }, orderBy: { name: "asc" }, select: { code: true, name: true } });
}

/** Resolve o território a partir dos parâmetros (validados contra a tabela oficial). */
export async function resolveTerritory(uf?: string, mun?: string): Promise<Territory> {
  if (mun && /^\d{7}$/.test(mun)) {
    const t = await db.statTerritory.findFirst({ where: { code: mun, level: "MUNICIPALITY" } });
    if (t) {
      const uf = t.ufCode ? await db.statTerritory.findFirst({ where: { code: t.ufCode, level: "UF" }, select: { name: true } }) : null;
      return { level: "MUNICIPALITY", code: t.code, name: `${t.name} (${t.ufAbbr})`, ufCode: t.ufCode, ufName: uf?.name ?? null };
    }
  }
  if (uf && /^\d{2}$/.test(uf)) {
    const t = await db.statTerritory.findFirst({ where: { code: uf, level: "UF" } });
    if (t) return { level: "UF", code: t.code, name: t.name, ufCode: t.code, ufName: t.name };
  }
  return { level: "BR", code: "BR", name: "Brasil", ufCode: null, ufName: null };
}

const n = (v: unknown) => (v == null ? null : Number(v));

export type MonthlyPoint = { period: string; admissions: number; separations: number; balance: number; wage: number | null; wageN: number | null };

export async function monthlySeries(ds: StatDataset, t: Territory): Promise<MonthlyPoint[]> {
  const rows = await db.statEmploymentFlow.findMany({
    where: { datasetId: ds.id, territoryLevel: t.level, territoryCode: t.code, sectorCode: "*", occupationCode: "*" },
    orderBy: { period: "asc" },
    select: { period: true, admissions: true, separations: true, balance: true, medianAdmissionWage: true, wageSampleSize: true },
  });
  return rows.map((r) => ({
    period: r.period.toISOString().slice(0, 10),
    admissions: r.admissions,
    separations: r.separations,
    balance: r.balance,
    wage: n(r.medianAdmissionWage),
    wageN: r.wageSampleSize,
  }));
}

export type Breakdown = { code: string; title: string; admissions: number; separations: number; balance: number };

async function breakdown(ds: StatDataset, t: Territory, dim: "sector" | "occupation"): Promise<Breakdown[]> {
  if (t.level === "MUNICIPALITY") return [];
  const rows = await db.statEmploymentFlow.groupBy({
    by: [dim === "sector" ? "sectorCode" : "occupationCode"],
    where: {
      datasetId: ds.id,
      territoryLevel: t.level,
      territoryCode: t.code,
      ...(dim === "sector" ? { sectorCode: { not: "*" }, occupationCode: "*" } : { occupationCode: { not: "*" }, sectorCode: "*" }),
    },
    _sum: { admissions: true, separations: true, balance: true },
  });
  const system = dim === "sector" ? "CNAE2_SECAO" : "CBO2002_GRANDE_GRUPO";
  const titles = new Map((await db.statClassification.findMany({ where: { system } })).map((c) => [c.code, c.title]));
  return rows
    .map((r) => {
      const code = (dim === "sector" ? (r as { sectorCode: string }).sectorCode : (r as { occupationCode: string }).occupationCode) as string;
      return {
        code,
        title: titles.get(code) ?? (code === "Z" || code === "IGNORADO" ? "Atividade/ocupação não identificada" : `Código ${code}`),
        admissions: r._sum.admissions ?? 0,
        separations: r._sum.separations ?? 0,
        balance: r._sum.balance ?? 0,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

export const sectorBreakdown = (ds: StatDataset, t: Territory) => breakdown(ds, t, "sector");
export const occupationBreakdown = (ds: StatDataset, t: Territory) => breakdown(ds, t, "occupation");

export type UfValue = { code: string; abbr: string; name: string; admissions: number; separations: number; balance: number };

/** Saldo acumulado no período publicado, por UF (comparação territorial / mapa). */
export async function ufComparison(ds: StatDataset): Promise<UfValue[]> {
  const [rows, ufs] = await Promise.all([
    db.statEmploymentFlow.groupBy({
      by: ["territoryCode"],
      where: { datasetId: ds.id, territoryLevel: "UF", sectorCode: "*", occupationCode: "*" },
      _sum: { admissions: true, separations: true, balance: true },
    }),
    listUfs(),
  ]);
  const byCode = new Map(rows.map((r) => [r.territoryCode, r._sum]));
  return ufs.map((u) => {
    const s = byCode.get(u.code);
    return { code: u.code, abbr: u.ufAbbr ?? u.code, name: u.name, admissions: s?.admissions ?? 0, separations: s?.separations ?? 0, balance: s?.balance ?? 0 };
  });
}

export async function municipalityRanking(ds: StatDataset, ufCode: string, take = 10) {
  const rows = await db.statEmploymentFlow.groupBy({
    by: ["territoryCode"],
    where: { datasetId: ds.id, territoryLevel: "MUNICIPALITY", territoryCode: { startsWith: ufCode }, sectorCode: "*", occupationCode: "*" },
    _sum: { admissions: true, separations: true, balance: true },
  });
  const names = new Map(
    (await db.statTerritory.findMany({ where: { code: { in: rows.map((r) => r.territoryCode) } }, select: { code: true, name: true } })).map((t) => [t.code, t.name]),
  );
  const list = rows.map((r) => ({
    code: r.territoryCode,
    name: names.get(r.territoryCode) ?? r.territoryCode,
    admissions: r._sum.admissions ?? 0,
    separations: r._sum.separations ?? 0,
    balance: r._sum.balance ?? 0,
  }));
  const sorted = [...list].sort((a, b) => b.balance - a.balance);
  return { top: sorted.slice(0, take), bottom: sorted.slice(-5).reverse().filter((x) => x.balance < 0), count: list.length };
}

/** Mediana do salário de admissão por seção (último mês), só onde há amostra suficiente. */
export async function wageBySector(ds: StatDataset, t: Territory, period: Date) {
  if (t.level === "MUNICIPALITY") return [];
  const rows = await db.statEmploymentFlow.findMany({
    where: { datasetId: ds.id, territoryLevel: t.level, territoryCode: t.code, period, occupationCode: "*", sectorCode: { not: "*" }, medianAdmissionWage: { not: null } },
    select: { sectorCode: true, medianAdmissionWage: true, wageSampleSize: true },
  });
  const titles = new Map((await db.statClassification.findMany({ where: { system: "CNAE2_SECAO" } })).map((c) => [c.code, c.title]));
  return rows
    .map((r) => ({ code: r.sectorCode, title: titles.get(r.sectorCode) ?? r.sectorCode, wage: Number(r.medianAdmissionWage), n: r.wageSampleSize ?? 0 }))
    .sort((a, b) => b.wage - a.wage);
}

export type IndicatorPoint = { periodCode: string; label: string; br: number | null; local: number | null };

export async function unemploymentSeries(ds: StatDataset, ufCode: string | null): Promise<IndicatorPoint[]> {
  const rows = await db.statIndicator.findMany({
    where: {
      datasetId: ds.id,
      indicator: "PNADC_TAXA_DESOCUPACAO",
      OR: [{ territoryLevel: "BR" }, ...(ufCode ? [{ territoryLevel: "UF" as const, territoryCode: ufCode }] : [])],
    },
    orderBy: { periodStart: "asc" },
  });
  const map = new Map<string, IndicatorPoint>();
  for (const r of rows) {
    const p = map.get(r.periodCode) ?? { periodCode: r.periodCode, label: r.periodLabel, br: null, local: null };
    if (r.territoryLevel === "BR") p.br = Number(r.value);
    else p.local = Number(r.value);
    map.set(r.periodCode, p);
  }
  return [...map.values()];
}

/** Destaque para a página inicial: saldo do último mês no Brasil. */
export async function headlineBalance() {
  const { caged } = await getPublishedDatasets();
  if (!caged) return null;
  const last = await db.statEmploymentFlow.findFirst({
    where: { datasetId: caged.id, territoryLevel: "BR", territoryCode: "BR", sectorCode: "*", occupationCode: "*" },
    orderBy: { period: "desc" },
  });
  if (!last) return null;
  return { period: last.period, admissions: last.admissions, separations: last.separations, balance: last.balance, dataset: caged };
}
