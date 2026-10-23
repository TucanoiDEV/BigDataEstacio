import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as auth from "@/server/services/auth";
import * as jobs from "@/server/services/jobs";
import * as apps from "@/server/services/applications";
import * as orgs from "@/server/services/organizations";
import { assertOrgPermission } from "@/server/auth/dal";
import { invalidateAllSessions } from "@/server/auth/session";
import { cookieJar } from "../support/integration-env";
import { accessFor, addMember, createOrg, createUser, JOB_INPUT, PASSWORD, resetDb } from "./helpers";

beforeEach(resetDb);

async function scenario() {
  const ownerA = await createUser();
  const ownerB = await createUser();
  const candidate = await createUser();
  const orgA = await createOrg(ownerA);
  const orgB = await createOrg(ownerB);
  const jobB = await jobs.createJob(await accessFor(ownerB, orgB.id), JOB_INPUT);
  const appB = await apps.applyToJob(candidate, { jobId: jobB.id, resumeId: null, coverLetter: null, shareEmail: true, sharePhone: false });
  return { ownerA, ownerB, candidate, orgA, orgB, jobB, appB };
}

describe("isolamento entre empresas (IDOR)", () => {
  it("empresa A não lê nem altera candidaturas da empresa B", async () => {
    const s = await scenario();
    const accessA = await accessFor(s.ownerA, s.orgA.id);
    expect(await apps.getOrgApplication(accessA, s.appB)).toBeNull();
    expect(await apps.listJobApplications(accessA, s.jobB.id)).toEqual([]);
    await expect(apps.updateApplicationStatus(accessA, { applicationId: s.appB, to: "IN_REVIEW", messageToCandidate: null, internalNote: null })).rejects.toThrow(/não encontrada/);
    expect((await db.application.findUniqueOrThrow({ where: { id: s.appB } })).status).toBe("SUBMITTED");
  });

  it("empresa A não edita, pausa ou encerra vaga da empresa B", async () => {
    const s = await scenario();
    const accessA = await accessFor(s.ownerA, s.orgA.id);
    await expect(jobs.updateJob(accessA, s.jobB.id, { ...JOB_INPUT, title: "Invadida" })).rejects.toThrow(/não encontrada/);
    await expect(jobs.changeJobLifecycle(accessA, s.jobB.id, "close")).rejects.toThrow(/não encontrada/);
    expect(await jobs.getOrgJobForEdit(accessA, s.jobB.id)).toBeNull();
  });

  it("a DAL nega acesso a quem não é membro, mesmo com sessão válida", async () => {
    const s = await scenario();
    await auth.login(s.ownerA.email, PASSWORD, { ip: "1", ipHash: "a", userAgent: null });
    await expect(assertOrgPermission(s.orgB.id, "applications.view")).rejects.toThrow(/permissão/);
    await expect(assertOrgPermission(s.orgA.id, "applications.view")).resolves.toBeTruthy();
    await invalidateAllSessions(s.ownerA.id);
    cookieJar.clear();
  });

  it("leitor (VIEWER) não altera status; recrutador sim", async () => {
    const s = await scenario();
    const viewer = await createUser();
    const recruiter = await createUser();
    await addMember(s.orgB.id, viewer, "VIEWER");
    await addMember(s.orgB.id, recruiter, "RECRUITER");
    await expect(apps.updateApplicationStatus(await accessFor(viewer, s.orgB.id), { applicationId: s.appB, to: "IN_REVIEW", messageToCandidate: null, internalNote: null })).rejects.toThrow(/permissão/);
    await apps.updateApplicationStatus(await accessFor(recruiter, s.orgB.id), { applicationId: s.appB, to: "IN_REVIEW", messageToCandidate: null, internalNote: null });
    expect((await db.application.findUniqueOrThrow({ where: { id: s.appB } })).status).toBe("IN_REVIEW");
  });

  it("candidato não retira candidatura de outra pessoa", async () => {
    const s = await scenario();
    const other = await createUser();
    await expect(apps.withdrawApplication(other, s.appB)).rejects.toThrow(/não encontrado/i);
    expect(await apps.getCandidateApplication(other.id, s.appB)).toBeNull();
  });
});

describe("elevação de privilégio em organizações", () => {
  it("ADMIN não promove ninguém a OWNER e não se altera; último OWNER é protegido", async () => {
    const owner = await createUser();
    const admin = await createUser();
    const recruiter = await createUser();
    const org = await createOrg(owner);
    const mAdmin = await addMember(org.id, admin, "ADMIN");
    const mRec = await addMember(org.id, recruiter, "RECRUITER");
    const adminAccess = await accessFor(admin, org.id);
    await expect(orgs.changeMemberRole(adminAccess, mRec.id, "OWNER")).rejects.toThrow(/não pode/);
    await expect(orgs.changeMemberRole(adminAccess, mAdmin.id, "OWNER")).rejects.toThrow(/próprio papel/);
    const ownerMembership = await db.orgMembership.findFirstOrThrow({ where: { orgId: org.id, userId: owner.id } });
    await expect(orgs.removeMember(await accessFor(owner, org.id), ownerMembership.id)).rejects.toThrow(/proprietário/);
    await orgs.changeMemberRole(adminAccess, mRec.id, "VIEWER");
    expect((await db.orgMembership.findUniqueOrThrow({ where: { id: mRec.id } })).role).toBe("VIEWER");
  });

  it("convite só pode ser aceito pelo e-mail convidado", async () => {
    const owner = await createUser();
    const org = await createOrg(owner);
    const invited = await createUser({ email: "convidada@exemplo.test" });
    const intruder = await createUser();
    await orgs.inviteMember(await accessFor(owner, org.id), invited.email, "RECRUITER");
    // O token é enviado por e-mail; aqui recriamos um convite com token conhecido para testar a regra.
    const { randomToken, sha256 } = await import("@/server/security/crypto");
    const token = randomToken(32);
    await db.orgInvitation.updateMany({ where: { orgId: org.id }, data: { tokenHash: sha256(token) } });
    await expect(orgs.acceptInvitation(intruder, token)).rejects.toThrow(/outro e-mail/);
    await orgs.acceptInvitation(invited, token);
    await expect(orgs.acceptInvitation(invited, token)).rejects.toThrow();
    expect(await db.orgMembership.count({ where: { orgId: org.id, userId: invited.id, role: "RECRUITER" } })).toBe(1);
  });
});
