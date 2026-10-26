import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import * as jobs from "@/server/services/jobs";
import * as apps from "@/server/services/applications";
import * as orgs from "@/server/services/organizations";
import { createAlert } from "@/server/services/saved-and-alerts";
import { runJobAlerts } from "@/server/services/alerts-job";
import { searchJobs, trendingSectors } from "@/server/services/search";
import { createSession, SESSION_ABSOLUTE_MAX_MS } from "@/server/auth/session";
import { parseJobSearch } from "@/lib/validation/search";
import { cookieOptions } from "../support/integration-env";
import { accessFor, createOrg, createUser, JOB_INPUT, resetDb } from "./helpers";

// Falhas simuladas de canal: notificação interna e SMTP.
const failures = vi.hoisted(() => ({ notify: false, mail: false }));
vi.mock("@/server/services/notifications", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/services/notifications")>();
  return {
    ...mod,
    notify: async (...args: Parameters<typeof mod.notify>) => {
      if (failures.notify) throw new Error("falha simulada na notificação");
      return mod.notify(...args);
    },
  };
});
vi.mock("@/server/mail/mailer", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/mail/mailer")>();
  return { ...mod, sendMailSafe: async (...args: Parameters<typeof mod.sendMailSafe>) => (failures.mail ? false : mod.sendMailSafe(...args)) };
});

beforeEach(async () => {
  failures.notify = false;
  failures.mail = false;
  await resetDb();
});

const SHADY = "Pague a taxa de inscrição via Pix para receber o material do treinamento antes de começar.";

describe("regressões da auditoria (26/10/2026)", () => {
  it("#1 retomar vaga pausada editada com sinal de fraude vai para moderação", async () => {
    const owner = await createUser();
    const org = await createOrg(owner);
    const access = await accessFor(owner, org.id);
    const job = await jobs.createJob(access, JOB_INPUT);
    await jobs.changeJobLifecycle(access, job.id, "pause");
    const saved = await jobs.updateJob(access, job.id, { ...JOB_INPUT, description: SHADY, publish: false });
    expect(saved.status).toBe("PAUSED");

    const res = await jobs.changeJobLifecycle(access, job.id, "resume");
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("PENDING_REVIEW");
    expect(res.status).toBe("PENDING_REVIEW");

    // Conteúdo limpo continua retomando normalmente.
    const clean = await jobs.createJob(access, { ...JOB_INPUT, title: "Analista Limpo" });
    await jobs.changeJobLifecycle(access, clean.id, "pause");
    expect((await jobs.changeJobLifecycle(access, clean.id, "resume")).status).toBe("ACTIVE");
  });

  describe("#2 alertas", () => {
    async function setup() {
      const candidate = await createUser();
      const owner = await createUser();
      const org = await createOrg(owner);
      const alert = await createAlert(candidate.id, { name: "Suporte", frequency: "DAILY", filters: { q: "suporte", modalidade: [], contrato: [], senioridade: [] } as never });
      await db.jobAlert.update({ where: { id: alert.id }, data: { createdAt: new Date(Date.now() - 2 * 86400_000) } });
      await jobs.createJob(await accessFor(owner, org.id), JOB_INPUT);
      return { candidate, alert };
    }

    it("falha na notificação não avança o cursor e a próxima execução entrega", async () => {
      const { candidate, alert } = await setup();
      failures.notify = true;
      const first = await runJobAlerts();
      expect(first).toMatchObject({ sent: 0, failed: 1 });
      expect((await db.jobAlert.findUniqueOrThrow({ where: { id: alert.id } })).lastSentAt).toBeNull();

      failures.notify = false;
      expect((await runJobAlerts()).sent).toBe(1);
      expect(await db.notification.count({ where: { userId: candidate.id, type: "JOB_ALERT" } })).toBe(1);
    });

    it("falha SMTP é contada separadamente do envio", async () => {
      await setup();
      failures.mail = true;
      expect(await runJobAlerts()).toMatchObject({ sent: 1, emailed: 0, emailFailed: 1 });
    });
  });

  it("#3 parâmetros repetidos não derrubam a busca", () => {
    expect(parseJobSearch({ q: ["analista", "dados"], city: ["Teresina", "Parnaíba"], empresa: ["a", "b"] })).toMatchObject({ q: "analista", city: "Teresina", empresa: "a" });
  });

  it("#5 salário 'a partir de' compara o piso da faixa", async () => {
    const owner = await createUser();
    const access = await accessFor(owner, (await createOrg(owner)).id);
    const crossing = await jobs.createJob(access, { ...JOB_INPUT, title: "Faixa cruzando", salaryMin: 3500, salaryMax: 5000 });
    const above = await jobs.createJob(access, { ...JOB_INPUT, title: "Faixa acima", salaryMin: 4500, salaryMax: 6000 });
    const onlyMax = await jobs.createJob(access, { ...JOB_INPUT, title: "Só teto", salaryMin: null, salaryMax: 4200 });
    const hidden = await jobs.createJob(access, { ...JOB_INPUT, title: "Oculto", salaryMin: 9000, salaryMax: 9500, salaryVisible: false });
    const ids = (await searchJobs(parseJobSearch({ salarioMin: "4000" }))).jobs.map((j) => j.id);
    expect(ids).toContain(above.id);
    expect(ids).toContain(onlyMax.id);
    expect(ids).not.toContain(crossing.id);
    expect(ids).not.toContain(hidden.id);
  });

  it("#8/#9 trocar domínio volta para verificação; renomear reindexa a busca", async () => {
    const owner = await createUser();
    const org = await createOrg(owner);
    const access = await accessFor(owner, org.id);
    const job = await jobs.createJob(access, JOB_INPUT);
    const base = { tradeName: org.tradeName, website: "https://exemplo.test/sobre", contactEmail: org.contactEmail, description: null, sector: null, sizeRange: null, city: null, state: null };

    // Primeira definição do site em empresa verificada também conta como troca de domínio.
    const first = await orgs.updateOrganization(access, base);
    expect((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).verificationStatus).toBe("PENDING");
    expect(first.reverification).toBe(true);
    await db.organization.update({ where: { id: org.id }, data: { verificationStatus: "VERIFIED" } });

    // Mesmo domínio (só muda o caminho) e renomeação não exigem nova verificação.
    const renamed = await orgs.updateOrganization(access, { ...base, website: "https://www.exemplo.test/carreiras", tradeName: "Zebraverde Tecnologia" });
    expect(renamed.reverification).toBe(false);
    expect((await searchJobs(parseJobSearch({ q: "zebraverde" }))).jobs.map((j) => j.id)).toContain(job.id);

    expect((await orgs.updateOrganization(access, { ...base, tradeName: "Zebraverde Tecnologia", website: "https://outro-dominio.test" })).reverification).toBe(true);
    expect((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).verificationStatus).toBe("PENDING");
  });

  it("#10 cookie de sessão dura até o teto absoluto", async () => {
    const user = await createUser();
    const before = Date.now();
    await createSession(user.id, { mfaPending: false, mfaVerified: false });
    const expires = cookieOptions.get("ea_session")?.expires?.getTime() ?? 0;
    expect(expires).toBeGreaterThanOrEqual(before + SESSION_ABSOLUTE_MAX_MS);
    expect(expires).toBeLessThanOrEqual(Date.now() + SESSION_ABSOLUTE_MAX_MS);
  });

  it("#11 vaga expirada não conta em 'áreas em alta'", async () => {
    const owner = await createUser();
    const access = await accessFor(owner, (await createOrg(owner)).id);
    const job = await jobs.createJob(access, JOB_INPUT);
    await db.job.update({ where: { id: job.id }, data: { closesAt: new Date(Date.now() - 86400_000) } });
    expect(await trendingSectors()).toEqual([]);
  });

  it("retirada da candidatura grava status e histórico juntos", async () => {
    const owner = await createUser();
    const candidate = await createUser();
    const job = await jobs.createJob(await accessFor(owner, (await createOrg(owner)).id), JOB_INPUT);
    const appId = await apps.applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null, shareEmail: false, sharePhone: false });
    await apps.withdrawApplication(candidate, appId);
    const mine = await apps.getCandidateApplication(candidate.id, appId);
    expect(mine!.status).toBe("WITHDRAWN");
    expect(mine!.history.map((h) => h.toStatus)).toEqual(["SUBMITTED", "WITHDRAWN"]);
  });
});
