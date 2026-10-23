import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export function fixtures(): { orgId: string; password: string } {
  return JSON.parse(readFileSync("tests/e2e/.fixtures.json", "utf8"));
}

/** Responde ao banner de cookies (necessário antes de interagir com o rodapé da página). */
export async function rejectOptionalCookies(page: Page) {
  const banner = page.getByRole("region", { name: "Aviso de cookies" });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: "Rejeitar opcionais" }).click();
    await expect(banner).toBeHidden();
  }
}

export async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await rejectOptionalCookies(page);
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="password"]').fill(fixtures().password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/minha-conta/);
}

/** Seleciona uma opção em um Select (Radix) pelo rótulo do campo. */
export async function pick(page: Page, label: string, option: string) {
  // Rótulos de campos obrigatórios terminam com "*" (marcador visual).
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByLabel(new RegExp(`^${escaped}( \\*)?$`)).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
