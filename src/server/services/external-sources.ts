import "server-only";
import type { ExternalJobSource, WorkModel } from "@/generated/prisma/client";
import { detectFraudSignals } from "@/lib/fraud";
import { buildPlaceIndex, htmlToText, monthlySalaryRange, parseLocationLabel, safeExternalUrl, ufFromText, type PlaceIndex } from "@/lib/external-jobs";

// Adaptadores das fontes de vagas externas. Cada um devolve vagas já normalizadas;
// a gravação e a desativação ficam em external-jobs.ts.

export type NormalizedExternalJob = {
  source: ExternalJobSource;
  feed: string;
  externalId: string;
  title: string;
  companyName: string;
  text: string;
  city: string | null;
  state: string | null;
  locationLabel: string;
  workModel: WorkModel | null;
  salaryMin: number | null;
  salaryMax: number | null;
  url: string;
  postedAt: Date;
};

export type FeedResult = { feed: string; jobs: NormalizedExternalJob[]; skipped: number; flagged: number; complete: boolean };

/** Domínios exatos para onde a Adzuna redireciona (sem curingas: "adzuna.com.br.golpe.test" não passa). */
export const ADZUNA_HOSTS = /^(www\.)?adzuna\.(com\.br|com)$/;

const USER_AGENT = "EmpregoAgora/1.0 (+observatorio de vagas)";
const TIMEOUT_MS = 30_000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).hostname}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const dateOr = (v: unknown, fallback: Date) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 86_400_000 ? d : fallback;
};

// ---------------------------------------------------------------------------
// Adzuna — API oficial (https://developer.adzuna.com). Termos: cada vaga exibida
// leva o crédito "Adzuna" com link para adzuna.com.br. Limite padrão: 25 chamadas/min.
// ---------------------------------------------------------------------------

type AdzunaResult = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  redirect_url?: unknown;
  created?: unknown;
  company?: { display_name?: unknown };
  location?: { display_name?: unknown; area?: unknown };
  salary_min?: unknown;
  salary_max?: unknown;
  salary_is_predicted?: unknown;
};

export function normalizeAdzuna(r: AdzunaResult, now: Date): NormalizedExternalJob | "skip" | "flagged" {
  const url = safeExternalUrl(r.redirect_url, ADZUNA_HOSTS);
  const externalId = str(String(r.id ?? ""));
  const title = htmlToText(str(r.title));
  if (!url || !externalId || !title) return "skip";
  const text = htmlToText(str(r.description));
  // Salário estimado pela Adzuna exigiria o selo "Adzuna Jobsworth": exibimos só salários informados.
  const predicted = String(r.salary_is_predicted ?? "0") === "1";
  const salary = predicted ? { salaryMin: null, salaryMax: null } : monthlySalaryRange(r.salary_min, r.salary_max);
  // Agregador aberto: aplica a mesma triagem contra golpes das vagas publicadas na plataforma.
  if (detectFraudSignals({ title, description: text, seniority: "MID", ...salary }).length) return "flagged";

  const label = str(r.location?.display_name);
  const area = Array.isArray(r.location?.area) ? r.location.area.map(str) : [];
  const stateIdx = area.findIndex((a, i) => i > 0 && ufFromText(a));
  const state = stateIdx > 0 ? ufFromText(area[stateIdx]) : null;
  const city = stateIdx > 0 && area.length - 1 > stateIdx ? area[area.length - 1] : null;
  const modeText = `${title} ${label}`;
  const workModel: WorkModel | null = /remot|home ?office/i.test(modeText) ? "REMOTE" : /h[ií]brid/i.test(modeText) ? "HYBRID" : null;
  return {
    source: "ADZUNA",
    feed: "adzuna:br",
    externalId,
    title,
    companyName: htmlToText(str(r.company?.display_name)) || "Empresa não informada",
    text,
    city,
    state,
    locationLabel: label || "Brasil",
    workModel,
    ...salary,
    url,
    postedAt: dateOr(r.created, now),
  };
}

export async function fetchAdzuna(cfg: { appId: string; appKey: string; queries: string[]; maxPages: number }, now = new Date()): Promise<FeedResult> {
  const out: FeedResult = { feed: "adzuna:br", jobs: [], skipped: 0, flagged: 0, complete: true };
  const queries = cfg.queries.length ? cfg.queries : [""];
  let calls = 0;
  for (const what of queries) {
    for (let page = 1; page <= cfg.maxPages; page++) {
      if (calls++ > 0) await sleep(2_600); // respeita 25 chamadas/minuto
      const params = new URLSearchParams({ app_id: cfg.appId, app_key: cfg.appKey, results_per_page: "50", max_days_old: "30", sort_by: "date" });
      if (what) params.set("what", what);
      const data = (await getJson(`https://api.adzuna.com/v1/api/jobs/br/search/${page}?${params}`)) as { results?: AdzunaResult[] };
      const results = Array.isArray(data.results) ? data.results : [];
      for (const r of results) {
        const n = normalizeAdzuna(r, now);
        if (n === "skip") out.skipped++;
        else if (n === "flagged") out.flagged++;
        else out.jobs.push(n);
      }
      if (results.length < 50) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Greenhouse — quadros públicos oficiais de cada empresa
// (https://developers.greenhouse.io/job-board.html). Lista completa por quadro:
// o que some do quadro é desativado aqui.
// ---------------------------------------------------------------------------

const DEFAULT_INDEX = buildPlaceIndex();

type GreenhouseJob = {
  id?: unknown;
  title?: unknown;
  absolute_url?: unknown;
  location?: { name?: unknown };
  first_published?: unknown;
  updated_at?: unknown;
  company_name?: unknown;
  content?: unknown;
};

export function parseGreenhouseBoards(value: string): { token: string; name: string | null }[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [token, ...name] = entry.split(":");
      return { token: token.trim().toLowerCase(), name: name.join(":").trim() || null };
    })
    .filter((b) => /^[a-z0-9_-]{2,60}$/.test(b.token));
}

export function normalizeGreenhouse(j: GreenhouseJob, board: { token: string; name: string | null }, now: Date, places: PlaceIndex = DEFAULT_INDEX): NormalizedExternalJob | "skip" {
  const externalId = String(j.id ?? "");
  const title = htmlToText(str(j.title));
  if (!/^\d+$/.test(externalId) || !title) return "skip";
  const location = parseLocationLabel(str(j.location?.name), places);
  if (!location) return "skip"; // fora do Brasil
  const url = safeExternalUrl(j.absolute_url, /./) ?? `https://job-boards.greenhouse.io/${board.token}/jobs/${externalId}`;
  return {
    source: "GREENHOUSE",
    feed: `greenhouse:${board.token}`,
    externalId: `${board.token}:${externalId}`,
    title,
    companyName: board.name ?? (htmlToText(str(j.company_name)) || board.token),
    text: htmlToText(str(j.content)),
    city: location.city,
    state: location.state,
    locationLabel: location.label,
    // Sem modalidade no local, o título costuma trazê-la ("Account Executive (Hibrido/SP)").
    workModel: location.workModel ?? parseLocationLabel(`Brasil, ${title.replace(/[()[\]/|]/g, ",")}`)?.workModel ?? null,
    salaryMin: null,
    salaryMax: null,
    url,
    postedAt: dateOr(j.first_published ?? j.updated_at, now),
  };
}

export async function fetchGreenhouseBoard(board: { token: string; name: string | null }, now = new Date(), places: PlaceIndex = DEFAULT_INDEX): Promise<FeedResult> {
  const data = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`)) as { jobs?: GreenhouseJob[] };
  const out: FeedResult = { feed: `greenhouse:${board.token}`, jobs: [], skipped: 0, flagged: 0, complete: Array.isArray(data.jobs) };
  for (const j of data.jobs ?? []) {
    const n = normalizeGreenhouse(j, board, now, places);
    if (n === "skip") out.skipped++;
    else out.jobs.push(n);
  }
  return out;
}
