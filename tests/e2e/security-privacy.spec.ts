import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fixtures, login, rejectOptionalCookies } from "./helpers";

test.describe("segurança", () => {
  test("cabeçalhos de segurança presentes", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("áreas privadas exigem login", async ({ page }) => {
    await page.goto("/minha-conta/candidaturas");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fminha-conta%2Fcandidaturas/);
  });

  test("cookie de sessão é HttpOnly, SameSite=Lax e Secure", async ({ page, context }) => {
    await login(page, "candidato.e2e@exemplo.test");
    const session = (await context.cookies()).find((c) => c.name.includes("ea_session"));
    expect(session).toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
    expect(session!.secure).toBe(true);
    expect(session!.name).toBe("__Host-ea_session");
  });

  test("candidato não acessa painel de empresa da qual não é membro (sem revelar existência)", async ({ page }) => {
    await login(page, "candidato.e2e@exemplo.test");
    const res = await page.goto(`/empresa/${fixtures().orgId}/vagas`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    expect(res?.status()).toBe(200); // streaming: o 404 é renderizado no corpo após o shell
  });

  test("usuário comum não acessa a administração", async ({ page }) => {
    await login(page, "candidato.e2e@exemplo.test");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("download de arquivo inexistente ou alheio responde 404", async ({ request }) => {
    const res = await request.get("/api/arquivos/cabcdefghijklmnopqrstuvwx");
    expect(res.status()).toBe(404);
  });
});

test.describe("cookies e privacidade", () => {
  test("banner com três opções equivalentes e sem scripts opcionais antes da escolha", async ({ page, context }) => {
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Aviso de cookies" });
    await expect(banner).toBeVisible();
    for (const name of ["Rejeitar opcionais", "Personalizar", "Aceitar opcionais"]) {
      await expect(banner.getByRole("button", { name })).toBeVisible();
    }
    expect((await context.cookies()).some((c) => c.name === "ea_consent")).toBe(false);

    await banner.getByRole("button", { name: "Personalizar" }).click();
    const dialog = page.getByRole("dialog", { name: "Preferências de cookies" });
    await expect(dialog.getByRole("switch", { name: /Análise/ })).not.toBeChecked();
    await expect(dialog.getByRole("switch", { name: /Marketing/ })).not.toBeChecked();
    await dialog.getByRole("button", { name: "Salvar escolhas" }).click();
    await expect(dialog).toBeHidden();
    await expect(banner).toBeHidden();

    const consent = (await context.cookies()).find((c) => c.name === "ea_consent");
    expect(Buffer.from(consent!.value, "base64url").toString("utf8")).toContain('"a":false');

    // Revogação/alteração acessível pelo rodapé
    await page.getByRole("button", { name: "Preferências de cookies" }).click();
    await expect(page.getByRole("dialog", { name: "Preferências de cookies" })).toBeVisible();
  });

  test("páginas legais sinalizam revisão jurídica", async ({ page }) => {
    for (const path of ["/privacidade", "/termos", "/cookies", "/seguranca"]) {
      await page.goto(path);
      await expect(page.getByText("Minuta: requer revisão jurídica antes da publicação.")).toBeVisible();
    }
  });
});

test.describe("acessibilidade (axe)", () => {
  for (const path of ["/", "/vagas", "/entrar", "/criar-conta", "/mercado-de-trabalho", "/central-de-privacidade"]) {
    test(`sem violações graves em ${path}`, async ({ page }) => {
      await page.goto(path);
      await rejectOptionalCookies(page);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    });
  }
});
