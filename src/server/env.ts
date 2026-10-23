import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v === "true" || v === "1"));

const base64Key = z
  .string()
  .min(1)
  .refine((v) => Buffer.from(v, "base64").length === 32, "deve ter 32 bytes em base64");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    ENCRYPTION_KEY: base64Key,
    HASH_PEPPER: base64Key,
    SMTP_HOST: z.string().optional().default(""),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: boolish,
    SMTP_USER: z.string().optional().default(""),
    SMTP_PASSWORD: z.string().optional().default(""),
    MAIL_FROM: z.string().default("Emprego Agora <nao-responda@localhost>"),
    STORAGE_DIR: z.string().default("./storage"),
    CLAMAV_HOST: z.string().optional().default(""),
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
    REQUIRE_ADMIN_MFA: boolish,
    TRUST_PROXY: boolish,
  })
  .superRefine((env, ctx) => {
    // Exceção apenas para testes locais do build de produção (APP_URL em localhost).
    const isLoopback = ["localhost", "127.0.0.1"].includes(new URL(env.APP_URL).hostname);
    if (env.NODE_ENV === "production" && !isLoopback) {
      if (!env.APP_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "deve usar https em produção" });
      }
      if (!env.SMTP_HOST) {
        ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "obrigatório em produção" });
      }
    }
  });

export type Env = z.infer<typeof schema> & {
  isProduction: boolean;
  requireAdminMfa: boolean;
};

let cached: Env | undefined;

/**
 * Lê e valida variáveis de ambiente sob demanda (não no import),
 * para que o build não exija segredos de produção.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${issues}\nVeja .env.example.`);
  }
  const isProduction = parsed.data.NODE_ENV === "production";
  cached = {
    ...parsed.data,
    isProduction,
    requireAdminMfa: parsed.data.REQUIRE_ADMIN_MFA ?? isProduction,
  };
  return cached;
}

/** Apenas para testes. */
export function resetEnvCache() {
  cached = undefined;
}
