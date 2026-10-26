import { config } from "dotenv";
import { vi } from "vitest";

config();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_URL = "http://localhost:3000";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.HASH_PEPPER = Buffer.alloc(32, 9).toString("base64");
process.env.SMTP_HOST = "";
process.env.STORAGE_DIR = "./storage-test";

/**
 * Simula `cookies()`/`headers()` do Next.js com um armazenamento em memória,
 * permitindo testar o fluxo real de sessão fora de uma requisição HTTP.
 */
export const cookieJar = new Map<string, string>();
/** Opções do último `set` de cada cookie (para conferir expiração). */
export const cookieOptions = new Map<string, { expires?: Date; maxAge?: number }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    has: (name: string) => cookieJar.has(name),
    set: (name: string, value: string, opts?: { maxAge?: number; expires?: Date }) => {
      if (opts?.maxAge === 0 || value === "") cookieJar.delete(name);
      else cookieJar.set(name, value);
      cookieOptions.set(name, { expires: opts?.expires, maxAge: opts?.maxAge });
    },
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message.startsWith("NEXT_")) throw err;
  },
}));
