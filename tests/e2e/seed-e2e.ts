// Prepara o banco de TESTE para os cenários E2E (dados fictícios, somente teste).
import { writeFileSync } from "node:fs";
import { db } from "@/server/db";
import { hashPassword } from "@/server/security/password";

export const E2E_PASSWORD = "senha-e2e-bem-longa-2026";

async function main() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"public"."${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

  const passwordHash = await hashPassword(E2E_PASSWORD);
  const mk = (email: string, name: string, admin = false) =>
    db.user.create({ data: { email, name, passwordHash, emailVerifiedAt: new Date(), platformRole: admin ? "PLATFORM_ADMIN" : "USER", commPreference: { create: {} } } });

  const recruiter = await mk("recrutadora.e2e@exemplo.test", "Rita Recrutadora");
  const candidate = await mk("candidato.e2e@exemplo.test", "Caio Candidato");
  await mk("admin.e2e@exemplo.test", "Ana Admin", true);
  await db.candidateProfile.create({ data: { userId: candidate.id, headline: "Analista de suporte", city: "Recife", state: "PE" } });

  const org = await db.organization.create({
    data: {
      slug: "empresa-e2e",
      legalName: "Empresa E2E Ltda (teste)",
      tradeName: "Empresa E2E",
      cnpj: "11222333000181",
      contactEmail: "rh@exemplo.test",
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      members: { create: { userId: recruiter.id, role: "OWNER" } },
    },
  });

  writeFileSync("tests/e2e/.fixtures.json", JSON.stringify({ orgId: org.id, password: E2E_PASSWORD }, null, 2));
  console.log("[e2e] banco de teste preparado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
