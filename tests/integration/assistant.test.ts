import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import * as jobs from "@/server/services/jobs";
import * as apps from "@/server/services/applications";
import { askAssistant, hasAssistantConsent, setAssistantConsent } from "@/server/services/assistant";
import { accessFor, createOrg, createUser, JOB_INPUT, resetDb } from "./helpers";

// O SDK é simulado: o teste roda as ferramentas de verdade (banco de teste) sem chamar a Anthropic.
const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic extends actual.default {
    constructor(opts: ConstructorParameters<typeof actual.default>[0]) {
      super(opts);
      (this as unknown as { messages: { create: typeof create } }).messages = { create };
    }
  }
  return { ...actual, default: FakeAnthropic };
});

function toolUse(name: string, input: Record<string, unknown>, id = "toolu_1") {
  return { id: "msg", type: "message", role: "assistant", model: "m", stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }], usage: {} };
}
function text(t: string) {
  return { id: "msg", type: "message", role: "assistant", model: "m", stop_reason: "end_turn", content: [{ type: "text", text: t }], usage: {} };
}
/** Conteúdo do tool_result enviado ao modelo na chamada `n` (0-based). */
function toolResultSent(n: number): string {
  const params = create.mock.calls[n][0] as { messages: Anthropic.MessageParam[] };
  const last = params.messages[params.messages.length - 1];
  const block = (last.content as Anthropic.ToolResultBlockParam[])[0];
  return block.content as string;
}

beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
  resetEnvCache();
});
afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  resetEnvCache();
});
beforeEach(async () => {
  await resetDb();
  create.mockReset();
});

describe("assistente de IA", () => {
  it("consentimento é explícito, versionado e revogável", async () => {
    const user = await createUser();
    expect(await hasAssistantConsent(user.id)).toBe(false);
    await setAssistantConsent(user.id, true, null);
    expect(await hasAssistantConsent(user.id)).toBe(true);
    await setAssistantConsent(user.id, false, null);
    expect(await hasAssistantConsent(user.id)).toBe(false);
  });

  it("recomenda vagas pelo serviço de recomendação e só cita vagas devolvidas pelas ferramentas", async () => {
    const recruiter = await createUser();
    const candidate = await createUser({ name: "Maria Candidata", email: "maria@exemplo.test" });
    const org = await createOrg(recruiter, "VERIFIED");
    const job = await jobs.createJob(await accessFor(recruiter, org.id), JOB_INPUT);
    await db.candidateProfile.create({ data: { userId: candidate.id, desiredTitle: "Analista de Suporte", phone: "81999990000" } });

    create
      .mockResolvedValueOnce(toolUse("vagas_recomendadas", {}))
      .mockResolvedValueOnce(text(`Encontrei esta: [[vaga:${job.id}]]. E esta outra: [[vaga:inventada123]].`));

    const out = await askAssistant(candidate.id, { messages: [{ role: "user", content: "Quais vagas combinam comigo?" }] });

    expect(create).toHaveBeenCalledTimes(2);
    const sent = toolResultSent(1);
    expect(sent).toContain(job.id);
    expect(sent).toContain("Analista de Suporte");
    // Dados pessoais de contato nunca vão para o provedor.
    expect(sent).not.toContain("Maria");
    expect(sent).not.toContain("maria@exemplo.test");
    expect(sent).not.toContain("81999990000");

    expect(out.jobs.map((j) => j.key)).toEqual([`vaga:${job.id}`]);
    expect(out.jobs[0]).toMatchObject({ href: `/vagas/${job.id}`, external: false });
    expect(out.jobs[0].score).toBeGreaterThan(0);
  });

  it("minhas_candidaturas mostra só as candidaturas do próprio candidato", async () => {
    const recruiter = await createUser();
    const org = await createOrg(recruiter, "VERIFIED");
    const access = await accessFor(recruiter, org.id);
    const mine = await jobs.createJob(access, { ...JOB_INPUT, title: "Vaga que eu quero" });
    const theirs = await jobs.createJob(access, { ...JOB_INPUT, title: "Vaga de outra pessoa" });
    const me = await createUser();
    const other = await createUser();
    await apps.applyToJob(me, { jobId: mine.id, resumeId: null, coverLetter: null, shareEmail: false, sharePhone: false });
    await apps.applyToJob(other, { jobId: theirs.id, resumeId: null, coverLetter: null, shareEmail: false, sharePhone: false });

    create.mockResolvedValueOnce(toolUse("minhas_candidaturas", {})).mockResolvedValueOnce(text("Você tem uma candidatura enviada."));
    await askAssistant(me.id, { messages: [{ role: "user", content: "Como estão minhas candidaturas?" }] });

    const sent = toolResultSent(1);
    expect(sent).toContain("Vaga que eu quero");
    expect(sent).toContain("Enviada");
    expect(sent).not.toContain("Vaga de outra pessoa");
  });

  it("entrada inválida de ferramenta vira erro para o modelo, sem derrubar a conversa", async () => {
    const user = await createUser();
    create.mockResolvedValueOnce(toolUse("detalhes_vaga", { vaga_id: 42 })).mockResolvedValueOnce(text("Não consegui abrir essa vaga."));
    const out = await askAssistant(user.id, { messages: [{ role: "user", content: "Detalhes da vaga 42" }] });
    const params = create.mock.calls[1][0] as { messages: Anthropic.MessageParam[] };
    const result = (params.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(result.is_error).toBe(true);
    expect(out.reply).toBe("Não consegui abrir essa vaga.");
  });

  it("recusa do modelo vira resposta segura", async () => {
    const user = await createUser();
    create.mockResolvedValueOnce({ ...text(""), stop_reason: "refusal", content: [] });
    const out = await askAssistant(user.id, { messages: [{ role: "user", content: "algo fora do tema" }] });
    expect(out.reply).toMatch(/Não consigo ajudar/);
    expect(out.jobs).toEqual([]);
  });
});
