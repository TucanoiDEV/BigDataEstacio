import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config();
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("Defina TEST_DATABASE_URL para rodar os testes E2E.");

// E2E contra o build de PRODUÇÃO (next start) usando o banco de TESTE.
// Rode `npm run build` antes (o script test:e2e faz isso).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive.spec.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: testDb,
      APP_URL: baseURL,
      SMTP_HOST: "",
      STORAGE_DIR: "./storage-test",
      NODE_ENV: "production",
      // E2E roda em http://localhost; MFA de admin e cookies Secure exigiriam HTTPS.
      REQUIRE_ADMIN_MFA: "false",
    },
  },
});
