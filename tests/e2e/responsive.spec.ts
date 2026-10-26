import { expect, test } from "@playwright/test";
import { login, rejectOptionalCookies } from "./helpers";

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

test("filtros recolhidos no celular: resultados aparecem logo e o painel aplica ao confirmar", async ({ page }) => {
  await page.goto("/vagas");
  await rejectOptionalCookies(page);
  const toggle = page.getByRole("button", { name: /^Filtros/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("form", { name: "Filtros de vagas" })).toBeHidden();
  // O título dos resultados fica na primeira tela, sem rolar pelo formulário inteiro.
  const box = await page.locator("#resultados").boundingBox();
  expect(box!.y).toBeLessThan(page.viewportSize()!.height);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Remoto").click();
  await expect(page).not.toHaveURL(/modalidade=/); // no celular, só aplica ao confirmar
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/modalidade=REMOTE/);
  await expect(page.getByRole("button", { name: /^Filtros/ })).toContainText("1");
  await expect(page.getByRole("form", { name: "Filtros de vagas" })).toBeHidden();
});

test("menu móvel com sessão mostra a conta e não oferece entrar", async ({ page }) => {
  await login(page, "candidato.e2e@exemplo.test");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("navigation", { name: "Menu móvel" });
  await expect(menu.getByRole("link", { name: "Minha conta" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Sair" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Entrar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fechar" })).toBeVisible();
});
