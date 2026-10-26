import { expect, test } from "@playwright/test";
import { rejectOptionalCookies } from "./helpers";

// Executado no projeto "mobile" (Pixel 7).
for (const path of ["/", "/vagas", "/mercado-de-trabalho", "/entrar", "/privacidade"]) {
  test(`sem rolagem horizontal no celular: ${path}`, async ({ page }) => {
    await page.goto(path);
    await rejectOptionalCookies(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("menu móvel abre e navega", async ({ page }) => {
  await page.goto("/");
  await rejectOptionalCookies(page);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("navigation", { name: "Menu móvel" }).getByRole("link", { name: "Explorar vagas" }).click();
  await expect(page).toHaveURL(/\/vagas/);
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();
});
