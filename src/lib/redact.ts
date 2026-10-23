// Remove dados sensíveis antes de gravar logs/auditoria.

const SENSITIVE_KEY = /(pass(word)?|senha|token|secret|segredo|otp|code|codigo|cpf|rg|document|resume|curriculo|cover|authorization|cookie|session)/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const MAX_STRING = 300;
const MAX_DEPTH = 4;

/** Mascara e-mails: "maria.silva@x.com" -> "m***@x.com". */
export function maskEmail(value: string): string {
  return value.replace(EMAIL, (_m, first: string, domain: string) => `${first}***@${domain}`);
}

export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return "[truncado]";
  if (typeof value === "string") {
    const masked = maskEmail(value);
    return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}…` : masked;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[removido]" : redact(v, depth + 1);
    }
    return out;
  }
  return "[não serializável]";
}
