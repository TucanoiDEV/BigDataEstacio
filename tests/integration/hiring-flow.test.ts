import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as jobs from "@/server/services/jobs";
import * as apps from "@/server/services/applications";
import { searchJobs } from "@/server/services/search";
import { exportUserData, deleteAccount } from "@/server/services/privacy";
import { parseJobSearch } from "@/lib/validation/search";
import { accessFor, createOrg, createUser, JOB_INPUT, PASSWORD, resetDb } from "./helpers";

beforeEach(resetDb);

describe("fluxo principal de contratação", () => {
  it("empresa verificada publica → candidato encontra e se candidata → empresa avança → candidato vê a atualização", async () => {
    const recruiter = await createUser();
    const candidate = await createUser();
    const org = await createOrg(recruiter, "VERIFIED");
    const access = await accessFor(recruiter, org.id);

    const job = await jobs.createJob(access, { ...JOB_INPUT, title: "Analista de Suporte Júnior" });
    expect(job.status).toBe("ACTIVE");

    const found = await searchJobs(parseJobSearch({ q: "suporte", modalidade: "REMOTE" }));
    expect(found.jobs.map((j) => j.id)).toContain(job.id);

    const appId = await apps.applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: "Tenho interesse.", shareEmail: false, sharePhone: false });
    await expect(apps.applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null, shareEmail: false, sharePhone: false })).rejects.toThrow(/já se candidatou/);

    // Empresa vê a candidatura, sem o e-mail (não autorizado pelo candidato).
    const seen = await apps.getOrgApplication(access, appId);
    expect((seen!.profileSnapshot as { email: string | null }).email).toBeNull();

    // Transição inválida é recusada; fluxo válido avança.
    await expect(apps.updateApplicationStatus(access, { applicationId: appId, to: "APPROVED", messageToCandidate: null, internalNote: null })).rejects.toThrow(/Não é possível/);
    await apps.updateApplicationStatus(access, { applicationId: appId, to: "IN_REVIEW", messageToCandidate: null, internalNote: "perfil bom" });
    await apps.updateApplicationStatus(access, { applicationId: appId, to: "INTERVIEW", messageToCandidate: "Vamos agendar uma conversa.", internalNote: null });

    const mine = await apps.getCandidateApplication(candidate.id, appId);
    expect(mine!.status).toBe("INTERVIEW");
    expect(mine!.history.map((h) => h.toStatus)).toEqual(["SUBMITTED", "IN_REVIEW", "INTERVIEW"]);
    expect(mine!.history.some((h) => h.messageToCandidate === "Vamos agendar uma conversa.")).toBe(true);
    // Nota interna nunca é exposta ao candidato.
    expect(JSON.stringify(mine)).not.toContain("perfil bom");
    expect(await db.notification.count({ where: { userId: candidate.id, type: "APPLICATION_STATUS" } })).toBe(2);
    expect(await db.auditLog.count({ where: { action: "application.status_changed", orgId: org.id } })).toBe(2);
  });

  it("empresa não verificada não publica; vaga com sinais de fraude fica fora da busca", async () => {
    const pendingOwner = await createUser();
    const pendingOrg = await createOrg(pendingOwner, "PENDING");
    await expect(jobs.createJob(await accessFor(pendingOwner, pendingOrg.id), JOB_INPUT)).rejects.toThrow(/verificada/);
    const draft = await jobs.createJob(await accessFor(pendingOwner, pendingOrg.id), { ...JOB_INPUT, publish: false });
    expect(draft.status).toBe("DRAFT");

    const owner = await createUser();
    const org = await createOrg(owner);
    const shady = await jobs.createJob(await accessFor(owner, org.id), { ...JOB_INPUT, title: "Digitador", description: "Ganhe R$ 300 por dia em casa! Pague a taxa de inscrição via Pix para receber o material." });
    expect(shady.status).toBe("PENDING_REVIEW");
    const res = await searchJobs(parseJobSearch({ q: "digitador" }));
    expect(res.total).toBe(0);
  });

  it("busca trata entrada maliciosa como texto literal", async () => {
    const owner = await createUser();
    const org = await createOrg(owner);
    await jobs.createJob(await accessFor(owner, org.id), JOB_INPUT);
    const evil = await searchJobs(parseJobSearch({ q: `'; DROP TABLE "Job"; --`, city: "%" }));
    expect(evil.total).toBe(0);
    expect(await db.job.count()).toBe(1);
  });
});

describe("privacidade do titular", () => {
  it("exportação não inclui segredos e exclusão anonimiza e retira candidaturas", async () => {
    const owner = await createUser();
    const org = await createOrg(owner);
    const job = await jobs.createJob(await accessFor(owner, org.id), JOB_INPUT);
    const candidate = await createUser({ email: "titular@exemplo.test" });
    const appId = await apps.applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: "olá", shareEmail: true, sharePhone: false });

    const exported = JSON.stringify(await exportUserData(candidate.id));
    expect(exported).toContain("titular@exemplo.test");
    expect(exported).not.toMatch(/passwordHash|mfaSecretEnc|tokenHash|argon2/);

    await deleteAccount(candidate.id, PASSWORD, { ip: "1", ipHash: "x", userAgent: null });
    const u = await db.user.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(u.status).toBe("DELETED");
    expect(u.email).not.toContain("titular");
    const app = await db.application.findUniqueOrThrow({ where: { id: appId } });
    expect(app.status).toBe("WITHDRAWN");
    expect(JSON.stringify(app.profileSnapshot)).not.toContain("titular@exemplo.test");
    expect(app.coverLetter).toBeNull();
  });
});
