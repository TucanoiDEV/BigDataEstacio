import { z } from "zod";
import { LEGAL_VERSIONS } from "@/lib/constants";

export const CONSENT_COOKIE = "ea_consent";
export const CONSENT_MAX_AGE_DAYS = 180;

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export const consentChoiceSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  action: z.enum(["GRANT_ALL", "REJECT_OPTIONAL", "CUSTOM", "REVOKE"]),
});
export type ConsentChoice = z.infer<typeof consentChoiceSchema>;

const storedSchema = z.object({
  v: z.string(),
  a: z.boolean(),
  m: z.boolean(),
  t: z.number(),
  id: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});
export type StoredConsent = z.infer<typeof storedSchema>;

// Valor em base64url (JSON ASCII): não sofre re-codificação pelo serializador de cookies.
export function encodeConsent(c: StoredConsent): string {
  return btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(v: string): string {
  const b64 = v.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

/** Lê o cookie; consentimento de versão anterior ou expirado é tratado como ausente. */
export function decodeConsent(raw: string | undefined | null, nowMs: number): StoredConsent | null {
  if (!raw || !/^[A-Za-z0-9_-]{10,400}$/.test(raw)) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(decodeBase64Url(raw)));
    if (!parsed.success) return null;
    if (parsed.data.v !== LEGAL_VERSIONS.cookies) return null;
    if (nowMs - parsed.data.t > CONSENT_MAX_AGE_DAYS * 86400_000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Inventário dos cookies EFETIVAMENTE utilizados pela plataforma.
 * Mantenha esta lista sincronizada com o código (é exibida na Política de Cookies).
 */
export const COOKIE_INVENTORY: {
  name: string;
  category: ConsentCategory;
  purpose: string;
  duration: string;
  provider: string;
  activeWhen?: string;
}[] = [
  {
    name: "__Host-ea_session (produção) / ea_session (desenvolvimento)",
    category: "necessary",
    purpose: "Mantém você conectado(a) com segurança. HttpOnly, Secure e SameSite=Lax; o valor é um identificador aleatório sem dados pessoais.",
    duration: "Até 30 dias de inatividade (máximo 90 dias)",
    provider: "Emprego Agora (primeira parte)",
  },
  {
    name: "ea_consent",
    category: "necessary",
    purpose: "Registra suas escolhas de cookies para que o banner não reapareça e para respeitarmos sua decisão.",
    duration: `${CONSENT_MAX_AGE_DAYS} dias`,
    provider: "Emprego Agora (primeira parte)",
  },
  {
    name: "Cookies do serviço de análise configurado",
    category: "analytics",
    purpose: "Medição agregada de audiência para melhorar o serviço.",
    duration: "Conforme o fornecedor",
    provider: "Definido em NEXT_PUBLIC_ANALYTICS_SCRIPT_URL",
    activeWhen: "Somente se um serviço de análise estiver configurado E você consentir. Na configuração padrão, nenhum é carregado.",
  },
];
