import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Instância única por processo (evita esgotar conexões no hot reload). */
function client(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Cliente criado sob demanda (no primeiro uso), e não na importação do módulo:
 * o `next build` importa as rotas sem acesso ao banco (ex.: build em Docker).
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
