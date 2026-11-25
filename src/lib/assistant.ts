import { z } from "zod";

/**
 * Partes do assistente de IA compartilhadas entre servidor e navegador
 * (validação do histórico e marcação de vagas citadas na resposta).
 */

/** Versão do aviso de uso do assistente. Mudou o texto do aviso? Mude a versão: o consentimento é pedido de novo. */
export const ASSISTANT_CONSENT_VERSION = "2026-11-25";

export const ASSISTANT_MAX_MESSAGE_CHARS = 1500;
export const ASSISTANT_MAX_HISTORY = 20;

/** Histórico enviado pelo navegador: só texto, alternando candidato/assistente, terminando no candidato. */
export const assistantRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(ASSISTANT_MAX_HISTORY)
    .refine((msgs) => msgs[0].role === "user" && msgs[msgs.length - 1].role === "user", "O histórico deve começar e terminar com uma mensagem do candidato.")
    .refine((msgs) => msgs.every((m, i) => i === 0 || m.role !== msgs[i - 1].role), "Mensagens devem alternar entre candidato e assistente.")
    .refine((msgs) => msgs[msgs.length - 1].content.length <= ASSISTANT_MAX_MESSAGE_CHARS, `A mensagem deve ter até ${ASSISTANT_MAX_MESSAGE_CHARS} caracteres.`),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

/** Vaga citada pelo assistente, já com o link pronto. Só vagas devolvidas pelas ferramentas entram aqui. */
export type AssistantJobRef = {
  key: string; // "vaga:<id>" (plataforma) ou "externa:<id>" (outros sites)
  title: string;
  company: string;
  location: string;
  href: string;
  external: boolean;
  score?: number;
};

export type AssistantResponse = { reply: string; jobs: AssistantJobRef[] };

/** Estado do assistente para quem está navegando. */
export type AssistantStatus = "unavailable" | "anonymous" | "unverified" | "consent" | "ready";

/** Marcador que o modelo usa para citar uma vaga: [[vaga:ID]] ou [[externa:ID]]. */
export const JOB_TOKEN_RE = /\[\[((?:vaga|externa):[A-Za-z0-9_-]{1,64})\]\]/g;

export type ReplyPart = { type: "text"; text: string } | { type: "job"; job: AssistantJobRef };

/**
 * Divide a resposta em texto e vagas citadas. Marcadores de vagas que as ferramentas não
 * devolveram (o modelo inventou ou errou o código) são removidos, nunca viram link.
 */
export function splitReply(reply: string, jobs: AssistantJobRef[]): ReplyPart[] {
  const byKey = new Map(jobs.map((j) => [j.key, j]));
  const parts: ReplyPart[] = [];
  let last = 0;
  for (const m of reply.matchAll(JOB_TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ type: "text", text: reply.slice(last, idx) });
    const job = byKey.get(m[1]);
    if (job) parts.push({ type: "job", job });
    last = idx + m[0].length;
  }
  if (last < reply.length) parts.push({ type: "text", text: reply.slice(last) });
  return parts;
}

/** Vagas citadas na resposta, na ordem em que aparecem e sem repetição. */
export function citedJobs(reply: string, jobs: AssistantJobRef[]): AssistantJobRef[] {
  const byKey = new Map(jobs.map((j) => [j.key, j]));
  const seen = new Set<string>();
  const out: AssistantJobRef[] = [];
  for (const m of reply.matchAll(JOB_TOKEN_RE)) {
    const job = byKey.get(m[1]);
    if (job && !seen.has(job.key)) {
      seen.add(job.key);
      out.push(job);
    }
  }
  return out;
}
