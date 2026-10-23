import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/server/errors";
import { RateLimitError } from "@/server/security/rate-limit";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/** Executa lógica de ação (ex.: uploads via FormData) com o mesmo tratamento de erros. */
export async function runAction<T = undefined>(fn: () => Promise<ActionResult<T> | void>): Promise<ActionResult<T>> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError || err instanceof RateLimitError) return { ok: false, error: err.message };
    console.error("[action] erro inesperado", err);
    return { ok: false, error: "Não foi possível concluir a operação. Tente novamente." };
  }
}

/**
 * Envolve uma Server Action: valida a entrada com Zod e converte erros
 * conhecidos em respostas seguras (sem stack trace ou detalhes internos).
 */
export function createAction<S extends z.ZodType, T = undefined>(
  schema: S,
  handler: (input: z.infer<S>) => Promise<ActionResult<T> | void>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrorsFrom(parsed.error) };
    }
    try {
      return (await handler(parsed.data)) ?? { ok: true };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof AppError) return { ok: false, error: err.message };
      if (err instanceof RateLimitError) return { ok: false, error: err.message };
      console.error("[action] erro inesperado", err);
      return { ok: false, error: "Não foi possível concluir a operação. Tente novamente." };
    }
  };
}
