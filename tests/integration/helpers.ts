import { db } from "@/server/db";
import { hashPassword } from "@/server/security/password";
import type { CurrentUser, OrgAccess } from "@/server/auth/dal";
import type { OrgRole, OrgVerificationStatus } from "@/generated/prisma/client";
import { cookieJar } from "../support/integration-env";

/** Limpa todas as tabelas do banco de TESTE. */
export async function resetDb() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  cookieJar.clear();
}

let seq = 0;
export const PASSWORD = "uma-senha-bem-longa-2026";

export async function createUser(opts: { email?: string; name?: string; verified?: boolean } = {}) {
  seq++;
  const user = await db.user.create({
    data: {
      email: opts.email ?? `user${seq}-${Date.now()}@exemplo.test`,
      name: opts.name ?? `Pessoa Teste ${seq}`,
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      commPreference: { create: {} },
    },
  });
  return asCurrent(user.id);
}

export async function asCurrent(userId: string): Promise<CurrentUser> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, platformRole: true, status: true, emailVerifiedAt: true, mfaEnabledAt: true },
  });
  return { ...u, sessionId: "test", mfaVerified: true };
}

export async function createOrg(owner: CurrentUser, status: OrgVerificationStatus = "VERIFIED") {
  seq++;
  const cnpjBase = String(10_000_000_0000 + seq).padStart(12, "0").slice(-12);
  const calc = (s: string, w: number[]) => {
    const r = s.split("").reduce((a, d, i) => a + Number(d) * w[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpjBase, w1);
  const cnpj = `${cnpjBase}${d1}${calc(cnpjBase + d1, [6, ...w1])}`;
  return db.organization.create({
    data: {
      slug: `org-${seq}-${Date.now()}`,
      legalName: `Org Teste ${seq} Ltda`,
      tradeName: `Org Teste ${seq}`,
      cnpj,
      contactEmail: `rh${seq}@exemplo.test`,
      verificationStatus: status,
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
  });
}

export async function addMember(orgId: string, user: CurrentUser, role: OrgRole) {
  return db.orgMembership.create({ data: { orgId, userId: user.id, role } });
}

/** Constrói o mesmo objeto que a DAL entrega após validar o vínculo. */
export async function accessFor(user: CurrentUser, orgId: string): Promise<OrgAccess> {
  const m = await db.orgMembership.findUniqueOrThrow({
    where: { orgId_userId: { orgId, userId: user.id } },
    select: { id: true, role: true, org: { select: { id: true, slug: true, tradeName: true, verificationStatus: true } } },
  });
  return { user, membership: { id: m.id, role: m.role }, org: m.org };
}

export const JOB_INPUT = {
  title: "Analista de Suporte",
  description: "Atendimento a usuários, abertura de chamados e documentação de procedimentos internos da equipe.",
  requirements: null,
  benefits: null,
  sector: "Tecnologia da informação" as const,
  seniority: "JUNIOR" as const,
  contractType: "CLT" as const,
  workModel: "REMOTE" as const,
  city: null,
  state: null,
  salaryMin: 2500,
  salaryMax: 3200,
  salaryVisible: true,
  positions: 1,
  skills: ["Atendimento", "Windows"],
  requiredSkills: [],
  publish: true,
};
