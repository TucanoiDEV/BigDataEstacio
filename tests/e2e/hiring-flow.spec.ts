import { expect, test } from "@playwright/test";
import { fixtures, login, pick, waitForStreamedContent } from "./helpers";

// Fluxo obrigatório: empresa verificada publica vaga → candidato encontra e se candidata →
// empresa acompanha e altera o status → candidato visualiza a atualização.
test("fluxo completo de contratação", async ({ browser }) => {
  // Fluxo longo com duas sessões: o limite padrão de 30 s fica no limiar nesta máquina.
  test.setTimeout(90_000);
  const { orgId } = fixtures();
  const title = `Analista de Suporte E2E ${Date.now()}`;

  // 1. Empresa publica a vaga
  const company = await (await browser.newContext()).newPage();
  await login(company, "recrutadora.e2e@exemplo.test");
  await company.goto(`/empresa/${orgId}/vagas/nova`);
  await waitForStreamedContent(company);
  await company.getByLabel("Título").fill(title);
  await pick(company, "Setor", "Tecnologia da informação");
  await pick(company, "Senioridade", "Júnior");
  await pick(company, "Contratação", "CLT");
  await pick(company, "Modalidade", "Remoto");
  await company.getByLabel("Salário mínimo (R$/mês)").fill("2800");
  await company.getByLabel("Salário máximo (R$/mês)").fill("3500");
  await company.getByLabel("Descrição da vaga").fill(
    "Atendimento a usuários internos, registro de chamados, documentação de procedimentos e apoio à equipe de infraestrutura.",
  );
  await company.getByRole("button", { name: "Publicar vaga" }).click();
  await expect(company.getByText("Vaga publicada e visível na busca.")).toBeVisible();

  // 2. Candidato encontra a vaga e se candidata
  const candidate = await (await browser.newContext()).newPage();
  await login(candidate, "candidato.e2e@exemplo.test");
  await candidate.goto(`/vagas?q=${encodeURIComponent("suporte e2e")}`);
  await candidate.getByRole("link", { name: title }).click();
  await expect(candidate.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await candidate.getByRole("link", { name: "Candidatar-se" }).click();
  await candidate.getByRole("checkbox", { name: /Concordo em compartilhar/ }).click();
  await candidate.getByRole("button", { name: "Enviar candidatura" }).click();
  await expect(candidate.getByText("Candidatura enviada!")).toBeVisible();
  await expect(candidate.getByText("Enviada", { exact: true }).first()).toBeVisible();

  // 3. Empresa acompanha e altera o status
  await company.goto(`/empresa/${orgId}/vagas`);
  await company.getByRole("link", { name: title }).click();
  await company.getByRole("link", { name: /Caio Candidato/ }).click();
  await expect(company.getByRole("heading", { name: "Caio Candidato" })).toBeVisible();
  await pick(company, "Nova etapa", "Em análise");
  await company.getByLabel("Mensagem para o(a) candidato(a) (opcional)").fill("Recebemos seu perfil e estamos analisando.");
  await company.getByRole("button", { name: "Atualizar etapa" }).click();
  await expect(company.getByText("Status atualizado e candidato(a) notificado(a).")).toBeVisible();

  // 4. Candidato vê a atualização e a mensagem
  await candidate.goto("/minha-conta/candidaturas");
  await expect(candidate.getByRole("row", { name: new RegExp(title) }).getByText("Em análise")).toBeVisible();
  await candidate.getByRole("link", { name: title }).click();
  await expect(candidate.getByText("Recebemos seu perfil e estamos analisando.")).toBeVisible();
  await candidate.goto("/minha-conta/notificacoes");
  await expect(candidate.getByText("Candidatura: Em análise").first()).toBeVisible();
});
