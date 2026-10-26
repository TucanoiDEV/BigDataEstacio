import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { fetchAdzuna, fetchGreenhouseBoard, parseGreenhouseBoards, type FeedResult, type NormalizedExternalJob } from "@/server/services/external-sources";
import { buildPlaceIndex, snippetOf } from "@/lib/external-jobs";
import { normalizeText } from "@/lib/text";

const DAY = 86_400_000;
/** A Adzuna só devolve as mais recentes: some do feed sem ser revista em 7 dias, ou publicada há mais de 45, sai do ar. */
const ADZUNA_STALE_MS = 7 * DAY;
const ADZUNA_MAX_AGE_MS = 45 * DAY;
/** Vagas inativas são apagadas depois de 90 dias (minimização). */
const PURGE_AFTER_MS = 90 * DAY;

export async function saveFeed(result: FeedResult, now: Date): Promise<{ upserted: number; deactivated: number }> {
  let upserted = 0;
  for (const j of result.jobs) {
    const data = toRow(j);
    await db.externalJob.upsert({
      where: { source_externalId: { source: j.source, externalId: j.externalId } },
      create: { ...data, firstSeenAt: now, lastSeenAt: now },
      update: { ...data, lastSeenAt: now, active: true },
    });
    upserted++;
  }
  // Quadro completo (Greenhouse): o que não veio nesta leitura foi retirado pela empresa.
  const deactivated = result.complete && result.feed.startsWith("greenhouse:")
    ? (await db.externalJob.updateMany({ where: { feed: result.feed, active: true, lastSeenAt: { lt: now } }, data: { active: false } })).count
    : 0;
  return { upserted, deactivated };
}

function toRow(j: NormalizedExternalJob) {
  return {
    source: j.source,
    feed: j.feed,
    externalId: j.externalId,
    title: j.title.slice(0, 300),
    companyName: j.companyName.slice(0, 200),
    snippet: snippetOf(j.text),
    city: j.city?.slice(0, 120) ?? null,
    cityNormalized: j.city ? normalizeText(j.city) : null,
    state: j.state,
    locationLabel: j.locationLabel.slice(0, 200),
    workModel: j.workModel,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    url: j.url,
    postedAt: j.postedAt,
    searchText: normalizeText([j.title, j.companyName, j.city ?? "", j.state ?? "", j.locationLabel, j.text].join(" ")).slice(0, 20000),
  };
}

export type ExternalSourcesConfig = {
  adzuna: { appId: string; appKey: string; queries: string[]; maxPages: number } | null;
  greenhouseBoards: { token: string; name: string | null }[];
};

/** Fontes ativas segundo o .env: sem credenciais, a Adzuna fica de fora. */
export function externalSourcesConfig(): ExternalSourcesConfig {
  const e = env();
  return {
    adzuna: e.ADZUNA_APP_ID && e.ADZUNA_APP_KEY
      ? { appId: e.ADZUNA_APP_ID, appKey: e.ADZUNA_APP_KEY, queries: e.ADZUNA_QUERIES.split(",").map((q) => q.trim()).filter(Boolean).slice(0, 20), maxPages: e.ADZUNA_MAX_PAGES }
      : null,
    greenhouseBoards: parseGreenhouseBoards(e.GREENHOUSE_BOARDS),
  };
}

/**
 * Importa vagas das fontes configuradas (`npm run jobs:external`). Uma fonte com
 * falha não interrompe as demais e não desativa as vagas que já estavam gravadas.
 */
export async function runExternalJobsImport(now = new Date(), config: ExternalSourcesConfig = externalSourcesConfig()) {
  const tasks: { feed: string; run: () => Promise<FeedResult> }[] = [];
  const { adzuna } = config;
  // Municípios do IBGE (importados pelo observatório) para reconhecer cidades citadas sem UF.
  const places = buildPlaceIndex(
    (await db.statTerritory.findMany({ where: { level: "MUNICIPALITY", ufAbbr: { not: null } }, select: { name: true, ufAbbr: true } }))
      .map((t) => ({ name: t.name, uf: t.ufAbbr! })),
  );
  if (adzuna) tasks.push({ feed: "adzuna:br", run: () => fetchAdzuna(adzuna, now) });
  for (const board of config.greenhouseBoards) {
    tasks.push({ feed: `greenhouse:${board.token}`, run: () => fetchGreenhouseBoard(board, now, places) });
  }

  const feeds: Record<string, { imported: number; skipped: number; flagged: number; deactivated: number } | { error: string }> = {};
  for (const task of tasks) {
    try {
      const result = await task.run();
      const saved = await saveFeed(result, now);
      feeds[task.feed] = { imported: saved.upserted, skipped: result.skipped, flagged: result.flagged, deactivated: saved.deactivated };
    } catch (err) {
      feeds[task.feed] = { error: err instanceof Error ? err.message : String(err) };
      console.error("[external-jobs] falha na fonte", task.feed, feeds[task.feed]);
    }
  }

  const expired = await db.externalJob.updateMany({
    where: { source: "ADZUNA", active: true, OR: [{ lastSeenAt: { lt: new Date(now.getTime() - ADZUNA_STALE_MS) } }, { postedAt: { lt: new Date(now.getTime() - ADZUNA_MAX_AGE_MS) } }] },
    data: { active: false },
  });
  const purged = await db.externalJob.deleteMany({ where: { active: false, lastSeenAt: { lt: new Date(now.getTime() - PURGE_AFTER_MS) } } });
  return { feeds, expired: expired.count, purged: purged.count };
}

/** Campos exibidos no card (a busca unificada fica em search.ts). */
export const externalJobCardSelect = {
  id: true,
  source: true,
  title: true,
  companyName: true,
  snippet: true,
  city: true,
  state: true,
  locationLabel: true,
  workModel: true,
  salaryMin: true,
  salaryMax: true,
  url: true,
  postedAt: true,
} satisfies Prisma.ExternalJobSelect;

export type ExternalJobCardData = Prisma.ExternalJobGetPayload<{ select: typeof externalJobCardSelect }>;
