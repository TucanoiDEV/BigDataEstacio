import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { runExternalJobsImport as runImport, type ExternalSourcesConfig } from "@/server/services/external-jobs";
import { searchJobs } from "@/server/services/search";
import { createAlert } from "@/server/services/saved-and-alerts";
import { runJobAlerts } from "@/server/services/alerts-job";
import * as jobs from "@/server/services/jobs";
import { parseJobSearch } from "@/lib/validation/search";
import { accessFor, createOrg, createUser, JOB_INPUT, resetDb } from "./helpers";

const ghJob = (id: number, title: string, location: string) => ({
  id,
  title,
  absolute_url: `https://job-boards.greenhouse.io/acme/jobs/${id}`,
  location: { name: location },
  first_published: "2026-10-20T10:00:00-03:00",
  company_name: "ACME - Linkedin",
  content: "&lt;p&gt;Trabalhe com dados.&lt;/p&gt;",
});

const GREENHOUSE: ExternalSourcesConfig = { adzuna: null, greenhouseBoards: [{ token: "acme", name: "ACME" }] };
const ADZUNA: ExternalSourcesConfig = { adzuna: { appId: "id", appKey: "key", queries: [], maxPages: 1 }, greenhouseBoards: [] };
const NONE: ExternalSourcesConfig = { adzuna: null, greenhouseBoards: [] };
const runExternalJobsImport = (now: Date, config = GREENHOUSE) => runImport(now, config);

let board: unknown[] = [];
let failBoard = false;

function mockFetch() {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "boards-api.greenhouse.io") {
      if (failBoard) return new Response("erro", { status: 503 });
      return Response.json({ jobs: board });
    }
    if (url.hostname === "api.adzuna.com") {
      return Response.json({
        results: [
          { id: "a1", title: "Analista de Suporte", description: "Atendimento.", redirect_url: "https://www.adzuna.com.br/land/ad/a1", created: "2026-10-22T10:00:00Z", company: { display_name: "Beta" }, location: { display_name: "Teresina, Piauí", area: ["Brasil", "Piauí", "Teresina"] }, salary_min: 3000, salary_max: 4000, salary_is_predicted: "0" },
          { id: "a2", title: "Digitador", description: "Pague a taxa de inscrição via Pix para receber o kit.", redirect_url: "https://www.adzuna.com.br/land/ad/a2", created: "2026-10-22T10:00:00Z", company: { display_name: "Golpe" }, location: { display_name: "Brasil", area: ["Brasil"] } },
        ],
      });
    }
    throw new Error(`fetch inesperado: ${url}`);
  }));
}

beforeEach(async () => {
  await resetDb();
  board = [ghJob(1, "Engenheiro(a) de Dados", "Sao Paulo, Sao Paulo, Brasil"), ghJob(2, "Analista de BI", "Remoto"), ghJob(3, "Data Engineer", "Mexico City, Mexico City, Mexico")];
  failBoard = false;
  mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vagas externas", () => {
  it("importa o quadro, descarta fora do Brasil e desativa o que saiu do quadro", async () => {
    const first = await runExternalJobsImport(new Date("2026-10-25T10:00:00Z"));
    expect(first.feeds["greenhouse:acme"]).toMatchObject({ imported: 2, skipped: 1, deactivated: 0 });
    const sp = await db.externalJob.findFirstOrThrow({ where: { externalId: "acme:1" } });
    expect(sp).toMatchObject({ companyName: "ACME", state: "SP", cityNormalized: "sao paulo", snippet: "Trabalhe com dados.", active: true });

    board = [ghJob(1, "Engenheiro(a) de Dados", "Sao Paulo, Sao Paulo, Brasil")];
    const second = await runExternalJobsImport(new Date("2026-10-26T10:00:00Z"));
    expect(second.feeds["greenhouse:acme"]).toMatchObject({ imported: 1, deactivated: 1 });
    expect((await db.externalJob.findFirstOrThrow({ where: { externalId: "acme:2" } })).active).toBe(false);
  });

  it("falha na fonte não desativa as vagas já gravadas", async () => {
    await runExternalJobsImport(new Date("2026-10-25T10:00:00Z"));
    failBoard = true;
    const res = await runExternalJobsImport(new Date("2026-10-26T10:00:00Z"));
    expect(res.feeds["greenhouse:acme"]).toMatchObject({ error: expect.stringMatching(/503/) });
    expect(await db.externalJob.count({ where: { active: true } })).toBe(2);
  });

  it("Adzuna: importa com crédito de origem, barra golpe e expira vagas antigas", async () => {
    const res = await runExternalJobsImport(new Date("2026-10-25T10:00:00Z"), ADZUNA);
    expect(res.feeds["adzuna:br"]).toMatchObject({ imported: 1, flagged: 1 });
    expect(await db.externalJob.findFirstOrThrow({ where: { externalId: "a1" } })).toMatchObject({ source: "ADZUNA", state: "PI", salaryMin: 3000 });

    // Sem ser revista por mais de 7 dias, sai do ar.
    const later = await runExternalJobsImport(new Date("2026-11-03T10:00:00Z"), NONE);
    expect(later.expired).toBe(1);
  });

  it("busca unificada: as duas origens na mesma lista, contagem e filtros", async () => {
    await runExternalJobsImport(new Date("2026-10-25T10:00:00Z"));
    const owner = await createUser();
    const access = await accessFor(owner, (await createOrg(owner)).id);
    await jobs.createJob(access, { ...JOB_INPUT, title: "Analista de Dados Júnior", workModel: "ON_SITE", city: "São Paulo", state: "SP" });

    const titles = async (sp: Record<string, string>) => (await searchJobs(parseJobSearch(sp))).items.map((i) => `${i.kind}:${i.job.title}`);
    const all = await searchJobs(parseJobSearch({}));
    expect(all.total).toBe(3); // 1 da plataforma + 2 externas, contadas juntas
    expect(new Set(all.items.map((i) => i.kind))).toEqual(new Set(["internal", "external"]));

    expect(await titles({ q: "engenheiro" })).toEqual(["external:Engenheiro(a) de Dados"]);
    expect((await titles({ q: "dados" })).sort()).toEqual(["external:Analista de BI", "external:Engenheiro(a) de Dados", "internal:Analista de Dados Júnior"]);
    // Cidade sem acento vale para as duas origens.
    expect((await titles({ city: "Sao Paulo" })).sort()).toEqual(["external:Engenheiro(a) de Dados", "internal:Analista de Dados Júnior"]);
    expect(await titles({ modalidade: "REMOTE" })).toEqual(["external:Analista de BI"]);
    // Dado que a fonte externa não informa não satisfaz o filtro.
    expect(await titles({ contrato: "CLT" })).toEqual(["internal:Analista de Dados Júnior"]);
    expect(await titles({ uf: "PI" })).toEqual([]);

    // Paginação sobre o total combinado.
    const page2 = await searchJobs(parseJobSearch({ pagina: "2" }), 2);
    expect(page2).toMatchObject({ total: 3, page: 2, pages: 2 });
    expect(page2.items).toHaveLength(1);
  });

  it("alertas avisam vagas externas novas, com link para o site de origem", async () => {
    const candidate = await createUser();
    const alert = await createAlert(candidate.id, { name: "Dados", frequency: "DAILY", filters: { q: "engenheiro", modalidade: [], contrato: [], senioridade: [] } as never });
    await db.jobAlert.update({ where: { id: alert.id }, data: { createdAt: new Date(Date.now() - 2 * 86400_000) } });
    await runExternalJobsImport(new Date());

    expect((await runJobAlerts()).sent).toBe(1);
    const n = await db.notification.findFirstOrThrow({ where: { userId: candidate.id, type: "JOB_ALERT" } });
    expect(n.body).toBe("Engenheiro(a) de Dados");
  });
});
