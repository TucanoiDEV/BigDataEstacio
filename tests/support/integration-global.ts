import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Aplica as migrações no banco de TESTE (nunca no banco de desenvolvimento). */
export default function setup() {
  config();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL para rodar os testes de integração.");
  if (!/test/i.test(new URL(url).pathname)) throw new Error("TEST_DATABASE_URL deve apontar para um banco cujo nome contenha 'test'.");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
