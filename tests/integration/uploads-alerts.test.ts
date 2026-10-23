import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { storeUpload, readStoredFile } from "@/server/storage/files";
import { uploadResume } from "@/server/services/profile";
import * as jobs from "@/server/services/jobs";
import { createAlert } from "@/server/services/saved-and-alerts";
import { runJobAlerts } from "@/server/services/alerts-job";
import { accessFor, createOrg, createUser, JOB_INPUT, resetDb } from "./helpers";

beforeEach(resetDb);

const pdfBytes = (body = "1 0 obj << /Type /Catalog >> endobj") => Buffer.from(`%PDF-1.7\n${body}\ntrailer << >>\n%%EOF\n`, "latin1");
const file = (bytes: Buffer, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

describe("upload seguro", () => {
  it("aceita PDF real, guarda fora de public/ e permite reler o conteúdo", async () => {
    const u = await createUser();
    const r = await uploadResume(u.id, file(pdfBytes(), "../../meu cv.pdf", "application/pdf"), "CV");
    const resume = await db.resume.findUniqueOrThrow({ where: { id: r.id }, include: { file: true } });
    expect(resume.file.originalName).toBe("meu cv.pdf");
    expect(resume.file.scanStatus).toBe("SKIPPED"); // ambiente de teste, sem ClamAV
    expect(resume.file.storageKey).not.toContain("public");
    expect(existsSync(path.resolve("storage-test", resume.file.storageKey))).toBe(true);
    expect((await readStoredFile(resume.file.storageKey)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("recusa executável com extensão .pdf e PDF com JavaScript", async () => {
    const u = await createUser();
    await expect(storeUpload({ kind: "RESUME", ownerUserId: u.id, file: file(Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"), "cv.pdf", "application/pdf") })).rejects.toThrow(/PDF/);
    await expect(storeUpload({ kind: "RESUME", ownerUserId: u.id, file: file(pdfBytes("<< /S /JavaScript /JS (app.alert(1)) >>"), "cv.pdf", "application/pdf") })).rejects.toThrow(/conteúdo ativo/);
    await expect(storeUpload({ kind: "RESUME", ownerUserId: u.id, file: file(Buffer.alloc(6 * 1024 * 1024, 1), "grande.pdf", "application/pdf") })).rejects.toThrow(/muito grande/);
    expect(await db.storedFile.count()).toBe(0);
  });
});

describe("alertas de vagas", () => {
  it("notifica vagas novas compatíveis com o alerta e não repete na mesma janela", async () => {
    const candidate = await createUser();
    const owner = await createUser();
    const org = await createOrg(owner);
    const alert = await createAlert(candidate.id, { name: "Suporte remoto", frequency: "DAILY", filters: { q: "suporte", modalidade: ["REMOTE"], contrato: [], senioridade: [] } as never });
    // Alerta criado há 2 dias; vaga publicada depois disso.
    await db.jobAlert.update({ where: { id: alert.id }, data: { createdAt: new Date(Date.now() - 2 * 86400_000) } });
    await jobs.createJob(await accessFor(owner, org.id), JOB_INPUT);

    const first = await runJobAlerts();
    expect(first.sent).toBe(1);
    expect(await db.notification.count({ where: { userId: candidate.id, type: "JOB_ALERT" } })).toBe(1);

    const second = await runJobAlerts();
    expect(second.sent).toBe(0);
  });
});
