import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Sem fallback: `prisma generate` não precisa do banco (ex.: build Docker, clone novo);
    // comandos que precisam (migrate, db) falham com erro explícito se DATABASE_URL faltar.
    url: process.env.DATABASE_URL ?? "",
  },
});
