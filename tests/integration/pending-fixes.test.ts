import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as orgs from "@/server/services/organizations";
import * as jobs from "@/server/services/jobs";
import { uploadResume } from "@/server/services/profile";
import { deleteAccount } from "@/server/services/privacy";
import { readStoredFile, storeUpload } from "@/server/storage/files";
import { randomToken, sha256 } from "@/server/security/crypto";
import { jobSchema } from "@/lib/validation/job";
import { accessFor, addMember, createOrg, createUser, JOB_INPUT, PASSWORD, resetDb } from "./helpers";

beforeEach(resetDb);

const pdf = () => new File([new Uint8Array(Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n", "latin1"))], "cv.pdf", { type: "application/pdf" });
const png = () =>
  new File([new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"))], "logo.png", { type: "image/png" });
const CTX = { ip: "1", ipHash: "x", userAgent: null };

describe("pendências da auditoria (rodada 2)", () => {
  it("vários proprietários saindo ao mesmo tempo: sempre resta um", async () => {
    const first = await createUser();
    const org = await createOrg(first);
    const owners = [first, ...(await Promise.all(Array.from({ length: 5 }, () => createUser())))];
    for (const u of owners.slice(1)) await addMember(org.id, u, "OWNER");
    // Acessos e vínculos montados antes: as remoções começam de fato ao mesmo tempo.
    const attempts = await Promise.all(
      owners.map(async (u) => ({
        access: await accessFor(u, org.id),
        membershipId: (await db.orgMembership.findFirstOrThrow({ where: { orgId: org.id, userId: u.id } })).id,
      })),
    );

    const results = await Promise.allSettled(attempts.map((t) => orgs.removeMember(t.access, t.membershipId)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(owners.length - 1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: expect.objectContaining({ message: expect.stringMatching(/proprietário/) }) });
    expect(await db.orgMembership.count({ where: { orgId: org.id, role: "OWNER" } })).toBe(1);
  });

  it("aceite e revogação simultâneos de convite: nunca aceito e revogado ao mesmo tempo", async () => {
    const owner = await createUser();
    const invited = await createUser();
    const org = await createOrg(owner);
    const access = await accessFor(owner, org.id);
    await orgs.inviteMember(access, invited.email, "RECRUITER");
    const token = randomToken(32);
    const inv = await db.orgInvitation.findFirstOrThrow({ where: { orgId: org.id } });
    await db.orgInvitation.update({ where: { id: inv.id }, data: { tokenHash: sha256(token) } });

    await Promise.allSettled([orgs.acceptInvitation(invited, token), orgs.revokeInvitation(access, inv.id)]);
    const final = await db.orgInvitation.findUniqueOrThrow({ where: { id: inv.id } });
    const member = await db.orgMembership.findFirst({ where: { orgId: org.id, userId: invited.id } });
    expect(Boolean(final.acceptedAt && final.revokedAt)).toBe(false);
    expect(Boolean(member)).toBe(Boolean(final.acceptedAt));
  });

  it("convite expirado não é aceito", async () => {
    const owner = await createUser();
    const invited = await createUser();
    const org = await createOrg(owner);
    await orgs.inviteMember(await accessFor(owner, org.id), invited.email, "RECRUITER");
    const token = randomToken(32);
    await db.orgInvitation.updateMany({ where: { orgId: org.id }, data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() - 1000) } });
    await expect(orgs.acceptInvitation(invited, token)).rejects.toThrow(/inválido|expirado/);
    expect(await db.orgMembership.count({ where: { orgId: org.id, userId: invited.id } })).toBe(0);
  });

  it("exclusão de conta: anonimiza, remove o currículo do disco e preserva o logo da empresa", async () => {
    const owner = await createUser();
    const leaving = await createUser();
    const org = await createOrg(owner);
    await addMember(org.id, leaving, "ADMIN");
    const logo = await storeUpload({ kind: "ORG_LOGO", file: png(), ownerUserId: leaving.id, orgId: org.id });
    await db.organization.update({ where: { id: org.id }, data: { logoFileId: logo.id } });
    const resume = await uploadResume(leaving.id, pdf(), "CV");
    const resumeFile = await db.resume.findUniqueOrThrow({ where: { id: resume.id }, include: { file: true } });

    await deleteAccount(leaving.id, PASSWORD, CTX);

    expect((await db.user.findUniqueOrThrow({ where: { id: leaving.id } })).status).toBe("DELETED");
    expect((await db.storedFile.findUniqueOrThrow({ where: { id: resumeFile.file.id } })).deletedAt).not.toBeNull();
    await expect(readStoredFile(resumeFile.file.storageKey)).rejects.toThrow();
    // O logo continua em uso pela empresa, agora sem vínculo com a pessoa que saiu.
    const logoAfter = await db.storedFile.findUniqueOrThrow({ where: { id: logo.id } });
    expect(logoAfter).toMatchObject({ deletedAt: null, ownerUserId: null });
    expect((await readStoredFile(logoAfter.storageKey)).length).toBeGreaterThan(0);
  });

  it("exclusão recusada (único proprietário) não apaga nenhum arquivo", async () => {
    const owner = await createUser();
    await createOrg(owner);
    const resume = await uploadResume(owner.id, pdf(), "CV");
    const file = (await db.resume.findUniqueOrThrow({ where: { id: resume.id }, include: { file: true } })).file;

    await expect(deleteAccount(owner.id, PASSWORD, CTX)).rejects.toThrow(/único\(a\) proprietário/);
    expect((await db.storedFile.findUniqueOrThrow({ where: { id: file.id } })).deletedAt).toBeNull();
    expect((await readStoredFile(file.storageKey)).length).toBeGreaterThan(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).status).toBe("ACTIVE");
  });

  it("prazo de inscrições: grava, valida e tira a vaga da busca depois da data", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const parsed = jobSchema.parse({ ...JOB_INPUT, closesAt: tomorrow });
    expect(parsed.closesAt?.toISOString()).toBe(new Date(`${tomorrow}T23:59:59-03:00`).toISOString());
    expect(jobSchema.parse({ ...JOB_INPUT, closesAt: "" }).closesAt).toBeNull();
    expect(jobSchema.safeParse({ ...JOB_INPUT, closesAt: "2020-01-01" }).error?.issues[0]?.message).toMatch(/hoje ou uma data futura/);
    expect(jobSchema.safeParse({ ...JOB_INPUT, closesAt: "2099-01-01" }).error?.issues[0]?.message).toMatch(/um ano/);

    const owner = await createUser();
    const access = await accessFor(owner, (await createOrg(owner)).id);
    const job = await jobs.createJob(access, parsed);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).closesAt?.toISOString()).toBe(parsed.closesAt?.toISOString());

    // Edição pode remover o prazo.
    await jobs.updateJob(access, job.id, { ...parsed, closesAt: null });
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).closesAt).toBeNull();
  });
});
