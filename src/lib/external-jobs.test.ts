import { describe, expect, it } from "vitest";
import { buildPlaceIndex, htmlToText, monthlySalaryRange, parseLocationLabel, safeExternalUrl, snippetOf, ufFromText } from "@/lib/external-jobs";
import { ADZUNA_HOSTS, normalizeAdzuna, normalizeGreenhouse, parseGreenhouseBoards } from "@/server/services/external-sources";

const NOW = new Date("2026-10-26T12:00:00Z");

describe("localização de vagas externas", () => {
  // Índice como o do IBGE, com homônimos: Belém (PA, PB, AL), Barcelona (RN), Flórida (PR), Paraná (RN).
  const places = buildPlaceIndex([
    { name: "Belém", uf: "PB" }, { name: "Belém", uf: "AL" }, { name: "Paranaguá", uf: "PR" }, { name: "Jundiaí", uf: "SP" },
    { name: "Osasco", uf: "SP" }, { name: "Barcelona", uf: "RN" }, { name: "Flórida", uf: "PR" }, { name: "Paraná", uf: "RN" },
    { name: "Porto Alegre", uf: "RS" },
  ]);

  it.each([
    ["Sao Paulo, Sao Paulo, Brasil", { city: "São Paulo", state: "SP", workModel: null }],
    ["Teresina, Piaui, Brasil", { city: "Teresina", state: "PI", workModel: null }],
    ["Belem, Para, Brasil", { city: "Belém", state: "PA", workModel: null }],
    ["Belém", { city: "Belém", state: "PA", workModel: null }],
    ["Curitiba, PR", { city: "Curitiba", state: "PR", workModel: null }],
    ["Embu-Guaçu, Sao Paulo, Brasil", { city: "Embu-Guaçu", state: "SP", workModel: null }],
    ["Osasco, Sao Paulo, Brasil", { city: "Osasco", state: "SP", workModel: null }],
    ["Híbrido, Rio de Janeiro", { city: "Rio de Janeiro", state: "RJ", workModel: "HYBRID" }],
    ["Paranaguá", { city: "Paranaguá", state: "PR", workModel: null }],
    ["Paraná", { city: null, state: "PR", workModel: null }],
    ["São Paulo ou Rio de Janeiro", { city: "São Paulo", state: "SP", workModel: null }],
    ["Curitiba or São Paulo | On-site", { city: "Curitiba", state: "PR", workModel: "ON_SITE" }],
    ["Brazil (Remote)", { city: null, state: null, workModel: "REMOTE" }],
    ["Brazil (São Paulo - Hybrid)", { city: "São Paulo", state: "SP", workModel: "HYBRID" }],
    ["Brazil- São Paulo", { city: "São Paulo", state: "SP", workModel: null }],
    ["Brazil - São Paulo/SP or Porto Alegre/POA", { city: "São Paulo", state: "SP", workModel: null }],
    ["São Paulo, Rio de Janeiro ou Teletrabalho", { city: "São Paulo", state: "SP", workModel: "REMOTE" }],
    ["São Paulo-SP / Rio de Janeiro-RJ", { city: "São Paulo", state: "SP", workModel: null }],
    ["Região Sul", { city: null, state: null, workModel: null }],
    ["Remoto", { city: null, state: null, workModel: "REMOTE" }],
    ["Remoto - Brasil", { city: null, state: null, workModel: "REMOTE" }],
    ["Brasil", { city: null, state: null, workModel: null }],
    ["Argentina; São Paulo, São Paulo, Brazil", { city: "São Paulo", state: "SP", workModel: null }],
  ])("%s", (label, expected) => {
    expect(parseLocationLabel(label, places)).toMatchObject(expected);
  });

  it.each([
    "Mexico City, Mexico City, Mexico", "Mexico - Mexico City", "Argentina", "Buenos Aires, Buenos Aires, Argentina",
    "London l Remote", "Germany (Munich - Hybrid)", "Barcelona", "Miami, Florida", "Singapore", "Manhattan, New York", "",
  ])("descarta fora do Brasil: %s", (label) => {
    expect(parseLocationLabel(label, places)).toBeNull();
  });

  it("reconhece UF por nome ou sigla, com ou sem acento", () => {
    expect(ufFromText("São Paulo")).toBe("SP");
    expect(ufFromText("piaui")).toBe("PI");
    expect(ufFromText("df")).toBe("DF");
    expect(ufFromText("Mexico")).toBeNull();
  });
});

describe("saneamento de conteúdo externo", () => {
  it("remove tags de HTML escapado duas vezes (Greenhouse) e scripts", () => {
    expect(htmlToText("&lt;p&gt;Olá &amp;amp; bem-vindo&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;")).toBe("Olá & bem-vindo");
    expect(htmlToText("<strong>Analista</strong>&nbsp;de&#32;dados")).toBe("Analista de dados");
  });

  it("aceita apenas https dos domínios permitidos", () => {
    expect(safeExternalUrl("https://www.adzuna.com.br/land/ad/1", ADZUNA_HOSTS)).toBe("https://www.adzuna.com.br/land/ad/1");
    expect(safeExternalUrl("javascript:alert(1)", /./)).toBeNull();
    expect(safeExternalUrl("http://www.adzuna.com.br/x", ADZUNA_HOSTS)).toBeNull();
    expect(safeExternalUrl("https://adzuna.com.br.golpe.test/x", ADZUNA_HOSTS)).toBeNull();
  });

  it("converte faixa anual inteira para mensal e corrige ordem", () => {
    expect(monthlySalaryRange(48000, 72000)).toEqual({ salaryMin: 4000, salaryMax: 6000 });
    expect(monthlySalaryRange("3500", "5000")).toEqual({ salaryMin: 3500, salaryMax: 5000 });
    expect(monthlySalaryRange(6000, 4000)).toEqual({ salaryMin: 4000, salaryMax: 6000 });
    expect(monthlySalaryRange(0, null)).toEqual({ salaryMin: null, salaryMax: null });
  });

  it("resumo corta em palavra inteira", () => {
    const s = snippetOf("palavra ".repeat(100), 50);
    expect(s.length).toBeLessThanOrEqual(51);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("adaptadores das fontes", () => {
  it("Adzuna: normaliza, ignora salário estimado e descarta golpe", () => {
    const base = {
      id: "123",
      title: "<strong>Analista</strong> de Dados",
      description: "Atuar com SQL e Python.",
      redirect_url: "https://www.adzuna.com.br/land/ad/123",
      created: "2026-10-20T10:00:00Z",
      company: { display_name: "Empresa X" },
      location: { display_name: "Teresina, Piauí", area: ["Brasil", "Piauí", "Teresina"] },
      salary_min: 4000,
      salary_max: 6000,
      salary_is_predicted: "0",
    };
    expect(normalizeAdzuna(base, NOW)).toMatchObject({ title: "Analista de Dados", companyName: "Empresa X", state: "PI", city: "Teresina", salaryMin: 4000, feed: "adzuna:br" });
    expect(normalizeAdzuna({ ...base, salary_is_predicted: "1" }, NOW)).toMatchObject({ salaryMin: null, salaryMax: null });
    expect(normalizeAdzuna({ ...base, description: "Pague a taxa de inscrição via Pix para garantir a vaga." }, NOW)).toBe("flagged");
    expect(normalizeAdzuna({ ...base, redirect_url: "javascript:alert(1)" }, NOW)).toBe("skip");
  });

  it("Greenhouse: usa o nome configurado, descarta fora do Brasil e lê a modalidade no título", () => {
    const board = { token: "stone", name: "Stone" };
    const job = { id: 8040000003, title: "Account Executive - Hunter (Hibrido/SP)", absolute_url: "https://job-boards.greenhouse.io/stone/jobs/8040000003", location: { name: "Sao Paulo, Sao Paulo, Brasil" }, first_published: "2026-10-21T09:30:06-04:00", company_name: "Stone - Linkedin", content: "&lt;p&gt;Sobre&lt;/p&gt;" };
    expect(normalizeGreenhouse(job, board, NOW)).toMatchObject({ externalId: "stone:8040000003", companyName: "Stone", state: "SP", workModel: "HYBRID", text: "Sobre" });
    expect(normalizeGreenhouse({ ...job, location: { name: "Mexico City, Mexico City, Mexico" } }, board, NOW)).toBe("skip");
    expect(normalizeGreenhouse({ ...job, absolute_url: "javascript:x" }, board, NOW)).toMatchObject({ url: "https://job-boards.greenhouse.io/stone/jobs/8040000003" });
  });

  it("lê a lista de quadros do Greenhouse e ignora tokens inválidos", () => {
    expect(parseGreenhouseBoards(" stone:Stone , quintoandar , ../etc, :Sem token")).toEqual([
      { token: "stone", name: "Stone" },
      { token: "quintoandar", name: null },
    ]);
  });
});
