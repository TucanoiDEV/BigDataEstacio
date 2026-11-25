import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { isSameOrigin } from "@/server/security/request";
import { rateLimit } from "@/server/security/rate-limit";
import { AssistantError, askAssistant, assistantConfigured, hasAssistantConsent } from "@/server/services/assistant";
import { assistantRequestSchema, type AssistantStatus } from "@/lib/assistant";

const NO_STORE = { "Cache-Control": "private, no-store" };

function fail(message: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error: message }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Estado do assistente para quem está navegando (usado pelo botão flutuante). */
export async function GET() {
  let state: AssistantStatus;
  const user = await getCurrentUser();
  if (!assistantConfigured()) state = "unavailable";
  else if (!user) state = "anonymous";
  else if (!user.emailVerifiedAt) state = "unverified";
  else state = (await hasAssistantConsent(user.id)) ? "ready" : "consent";
  return NextResponse.json({ state }, { headers: NO_STORE });
}

// Assistente de IA do candidato. Cada chamada responde à última mensagem do histórico enviado.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("Origem não permitida.", 403);
  const user = await getCurrentUser();
  if (!user) return fail("Entre na sua conta para usar o assistente.", 401);
  if (!user.emailVerifiedAt) return fail("Confirme seu e-mail para usar o assistente.", 403);
  if (!assistantConfigured()) return fail("O assistente não está disponível no momento.", 503);
  if (!(await hasAssistantConsent(user.id))) return fail("Aceite o aviso de uso do assistente para continuar.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Requisição inválida.", 400);
  }
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Requisição inválida.", 400);

  // Limita o custo por pessoa: 30 mensagens por hora e 150 por dia.
  for (const [key, limit, windowSeconds] of [
    [`assistant:user:${user.id}:h`, 30, 3600],
    [`assistant:user:${user.id}:d`, 150, 86400],
  ] as const) {
    const res = await rateLimit(key, limit, windowSeconds);
    if (!res.allowed) return fail("Você enviou muitas mensagens seguidas. Aguarde um pouco e tente de novo.", 429, { "Retry-After": String(res.retryAfterSeconds) });
  }

  try {
    const answer = await askAssistant(user.id, parsed.data);
    return NextResponse.json(answer, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AssistantError) return fail(err.message, err.status);
    console.error("[assistente] erro inesperado", err);
    return fail("O assistente não conseguiu responder agora. Tente novamente.", 500);
  }
}
