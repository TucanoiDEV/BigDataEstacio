import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";
import { keyedHash } from "@/server/security/crypto";

export type RequestContext = { ip: string; ipHash: string; userAgent: string | null };

/**
 * Determina o IP do cliente. Com TRUST_PROXY=true (atrás de proxy reverso confiável),
 * usa o primeiro IP de X-Forwarded-For; caso contrário, o último salto (adicionado
 * pelo próprio servidor), que não pode ser forjado pelo cliente.
 */
export function clientIpFrom(h: Headers, trustProxy: boolean): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const ip = trustProxy ? parts[0] : parts[parts.length - 1];
    if (ip) return ip;
  }
  return h.get("x-real-ip") ?? "unknown";
}

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const ip = clientIpFrom(h, env().TRUST_PROXY ?? false);
  const ua = h.get("user-agent");
  return { ip, ipHash: keyedHash(ip), userAgent: ua ? ua.slice(0, 200) : null };
}

/**
 * Proteção CSRF para Route Handlers que alteram estado: exige Origin igual ao APP_URL.
 * (Server Actions já fazem essa verificação nativamente no Next.js.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(env().APP_URL).origin;
  } catch {
    return false;
  }
}
