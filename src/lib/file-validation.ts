// Validações de arquivo independentes de I/O (testáveis).

export type UploadKind = "RESUME" | "PHOTO" | "ORG_LOGO";

export const ALLOWED_MIME: Record<UploadKind, readonly string[]> = {
  RESUME: ["application/pdf"],
  PHOTO: ["image/jpeg", "image/png", "image/webp"],
  ORG_LOGO: ["image/jpeg", "image/png", "image/webp"],
};

export const MAX_BYTES: Record<UploadKind, number> = {
  RESUME: 5 * 1024 * 1024,
  PHOTO: 2 * 1024 * 1024,
  ORG_LOGO: 2 * 1024 * 1024,
};

/**
 * PDFs com conteúdo ativo são recusados: scripts, ações automáticas,
 * arquivos embutidos e formulários XFA são vetores comuns de malware.
 */
const PDF_ACTIVE_CONTENT = /\/(JavaScript|JS|Launch|EmbeddedFile|EmbeddedFiles|RichMedia|XFA|OpenAction\s*<<[^>]*\/S\s*\/JavaScript)\b/;

export function inspectPdf(buf: Buffer): { ok: true } | { ok: false; reason: string } {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, reason: "O arquivo não é um PDF válido." };
  const tail = buf.subarray(Math.max(0, buf.length - 2048)).toString("latin1");
  if (!tail.includes("%%EOF")) return { ok: false, reason: "PDF incompleto ou corrompido." };
  if (PDF_ACTIVE_CONTENT.test(buf.toString("latin1"))) {
    return { ok: false, reason: "O PDF contém conteúdo ativo (scripts, anexos ou ações automáticas). Exporte-o novamente como PDF simples." };
  }
  if (/\/Encrypt\b/.test(buf.toString("latin1"))) return { ok: false, reason: "PDFs protegidos por senha não são aceitos." };
  return { ok: true };
}

/** Nome exibível e seguro (sem caminhos, caracteres de controle ou tamanho excessivo). */
export function sanitizeFileName(name: string, fallback = "arquivo"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}
