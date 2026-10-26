import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import type { FileKind, FileScanStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { invalid } from "@/server/errors";
import { randomToken } from "@/server/security/crypto";
import { scanWithClamd } from "@/server/storage/clamav";
import { ALLOWED_MIME, MAX_BYTES, inspectPdf, sanitizeFileName } from "@/lib/file-validation";

function storageRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().STORAGE_DIR);
}

/** Resolve a chave para um caminho dentro do diretório privado (bloqueia path traversal). */
function resolveKey(storageKey: string): string {
  if (!/^[a-z_]+\/\d{4}\/[A-Za-z0-9_-]{16,64}$/.test(storageKey)) throw new Error("Chave de armazenamento inválida");
  const root = storageRoot();
  const full = path.resolve(/*turbopackIgnore: true*/ root, storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error("Caminho fora do armazenamento");
  return full;
}

async function antivirus(buffer: Buffer): Promise<{ status: FileScanStatus; detail?: string }> {
  const e = env();
  if (!e.CLAMAV_HOST) {
    // Em produção, sem antivírus, o upload é recusado (falha fechada).
    if (e.isProduction) throw invalid("O envio de arquivos está temporariamente indisponível. Tente mais tarde.");
    return { status: "SKIPPED", detail: "Antivírus não configurado (ambiente de desenvolvimento)" };
  }
  const res = await scanWithClamd(buffer, e.CLAMAV_HOST, e.CLAMAV_PORT);
  if (res.status === "clean") return { status: "CLEAN" };
  if (res.status === "infected") return { status: "INFECTED", detail: res.signature };
  if (e.isProduction) throw invalid("Não foi possível verificar o arquivo agora. Tente novamente em instantes.");
  console.warn("[storage] falha no antivírus (dev):", res.message);
  return { status: "FAILED", detail: res.message };
}

/**
 * Valida (tamanho, tipo real pelo conteúdo, regras de PDF), escaneia e grava
 * o arquivo em armazenamento privado. Retorna o registro StoredFile.
 */
export async function storeUpload(opts: { kind: FileKind; file: File; ownerUserId: string | null; orgId?: string }) {
  const { kind, file } = opts;
  if (!(file instanceof File) || file.size === 0) throw invalid("Selecione um arquivo.");
  if (file.size > MAX_BYTES[kind]) throw invalid(`Arquivo muito grande. Limite: ${Math.round(MAX_BYTES[kind] / 1024 / 1024)} MB.`);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES[kind]) throw invalid("Arquivo muito grande.");

  // Tipo determinado pelos bytes do arquivo, não pela extensão/MIME declarados.
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME[kind].includes(detected.mime)) {
    throw invalid(kind === "RESUME" ? "Envie o currículo em PDF." : "Envie uma imagem JPG, PNG ou WebP.");
  }
  if (detected.mime === "application/pdf") {
    const pdf = inspectPdf(buffer);
    if (!pdf.ok) throw invalid(pdf.reason);
  }

  const scan = await antivirus(buffer);
  if (scan.status === "INFECTED") {
    await audit({ actorUserId: opts.ownerUserId, action: "file.malware_blocked", orgId: opts.orgId, metadata: { kind, signature: scan.detail } });
    throw invalid("O arquivo foi bloqueado pelo antivírus.");
  }

  const storageKey = `${kind.toLowerCase()}/${new Date().getUTCFullYear()}/${randomToken(24)}`;
  const full = resolveKey(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer, { mode: 0o600 });

  return db.storedFile.create({
    data: {
      ownerUserId: opts.ownerUserId,
      kind,
      storageKey,
      originalName: sanitizeFileName(file.name, kind === "RESUME" ? "curriculo.pdf" : "imagem"),
      mimeType: detected.mime,
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      scanStatus: scan.status,
      scanDetail: scan.detail,
    },
  });
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  return readFile(resolveKey(storageKey));
}

/** Remove fisicamente o arquivo e marca o registro como excluído. */
export async function deleteStoredFile(fileId: string): Promise<void> {
  const file = await db.storedFile.findUnique({ where: { id: fileId }, select: { storageKey: true } });
  if (!file) return;
  await rm(resolveKey(file.storageKey), { force: true });
  await db.storedFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
}

/**
 * Remove do disco o conteúdo de arquivos já marcados como excluídos no banco. Usado depois que a
 * transação foi confirmada: uma falha aqui deixa só bytes órfãos (sem acesso pela aplicação),
 * nunca um registro apontando para um arquivo inexistente. Devolve as chaves que falharam.
 */
export async function removeStoredContents(storageKeys: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const key of storageKeys) {
    try {
      await rm(resolveKey(key), { force: true });
    } catch {
      failed.push(key);
    }
  }
  return failed;
}

export function isDownloadable(scanStatus: FileScanStatus): boolean {
  return scanStatus === "CLEAN" || (scanStatus === "SKIPPED" && !env().isProduction);
}
