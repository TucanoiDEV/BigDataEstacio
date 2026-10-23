import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function globalSetup() {
  config();
  const url = process.env.TEST_DATABASE_URL!;
  if (!/test/i.test(new URL(url).pathname)) throw new Error("TEST_DATABASE_URL deve apontar para um banco de teste.");
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx --conditions=react-server tests/e2e/seed-e2e.ts", { stdio: "inherit", env });
}
