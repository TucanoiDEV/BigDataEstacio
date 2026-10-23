// Seed de DEMONSTRAÇÃO para desenvolvimento local.
// - Recusa execução em produção.
// - Todo conteúdo é identificado como fictício ("demonstração").
// - NÃO cria dados do observatório: estatísticas só vêm do pipeline oficial.
import "dotenv/config";
import { randomInt } from "node:crypto";
import { db } from "@/server/db";
import { hashPassword } from "@/server/security/password";
import { buildSearchText } from "@/server/services/jobs";
import { upsertSkills } from "@/server/services/skills";
import { LEGAL_VERSIONS } from "@/lib/constants";
import type { ContractType, Seniority, WorkModel } from "@/generated/prisma/client";

function fakeCnpj(): string {
  // Base aleatória iniciada por "99" (improvável de colidir com empresa real) + dígitos verificadores válidos.
  const base = "99" + Array.from({ length: 10 }, () => randomInt(10)).join("");
  const calc = (s: string, w: number[]) => {
    const r = s.split("").reduce((a, d, i) => a + Number(d) * w[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(base, w1);
  const d2 = calc(base + d1, [6, ...w1]);
  return `${base}${d1}${d2}`;
}

const NOTE = "\n\n⚠️ Vaga de DEMONSTRAÇÃO criada pelo seed de desenvolvimento. Não é uma oportunidade real.";

const JOBS: { title: string; sector: string; seniority: Seniority; contractType: ContractType; workModel: WorkModel; city?: string; state?: string; salaryMin?: number; salaryMax?: number; skills: string[]; description: string }[] = [
  { title: "Desenvolvedor(a) Front-end Júnior", sector: "Tecnologia da informação", seniority: "JUNIOR", contractType: "CLT", workModel: "REMOTE", salaryMin: 3500, salaryMax: 5000, skills: ["React", "TypeScript", "CSS", "Git"], description: "Construa interfaces acessíveis em React e TypeScript junto a um time de produto." },
  { title: "Analista de Dados Pleno", sector: "Tecnologia da informação", seniority: "MID", contractType: "CLT", workModel: "HYBRID", city: "São Paulo", state: "SP", salaryMin: 7000, salaryMax: 9500, skills: ["SQL", "Python", "Power BI", "Estatística"], description: "Modele dados, construa painéis e apoie decisões com análises reprodutíveis." },
  { title: "Assistente Administrativo", sector: "Administração", seniority: "JUNIOR", contractType: "CLT", workModel: "ON_SITE", city: "Recife", state: "PE", salaryMin: 1900, salaryMax: 2300, skills: ["Excel", "Atendimento", "Organização"], description: "Rotinas administrativas, controle de documentos e apoio às equipes internas." },
  { title: "Estágio em Marketing Digital", sector: "Marketing e comunicação", seniority: "INTERN", contractType: "INTERNSHIP", workModel: "HYBRID", city: "Belo Horizonte", state: "MG", salaryMin: 1400, salaryMax: 1400, skills: ["Redes sociais", "Canva", "Comunicação"], description: "Apoie o planejamento de conteúdo e a análise de campanhas digitais." },
  { title: "Enfermeiro(a) Assistencial", sector: "Saúde", seniority: "MID", contractType: "CLT", workModel: "ON_SITE", city: "Porto Alegre", state: "RS", salaryMin: 4800, salaryMax: 6000, skills: ["COREN ativo", "Atendimento ao paciente"], description: "Assistência de enfermagem em unidade de internação, escala 12x36." },
  { title: "Analista de Logística Sênior", sector: "Logística e transporte", seniority: "SENIOR", contractType: "PJ", workModel: "REMOTE", salaryMin: 9000, salaryMax: 12000, skills: ["Supply chain", "Excel", "Negociação"], description: "Planejamento de malha logística e indicadores de nível de serviço." },
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed de demonstração não pode ser executado em produção.");
  const password = process.env.DEMO_PASSWORD ?? "senha-demo-local-2026";
  const passwordHash = await hashPassword(password);

  const mk = (email: string, name: string) =>
    db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash, emailVerifiedAt: new Date(), termsVersion: LEGAL_VERSIONS.terms, termsAcceptedAt: new Date(), commPreference: { create: {} } },
    });
  const candidate = await mk("candidata.demo@exemplo.test", "Ana Demonstração");
  const recruiter = await mk("recrutador.demo@exemplo.test", "Bruno Demonstração");

  await db.candidateProfile.upsert({
    where: { userId: candidate.id },
    update: {},
    create: { userId: candidate.id, headline: "Desenvolvedora front-end (perfil fictício)", city: "Recife", state: "PE", desiredTitle: "Desenvolvedora Front-end", desiredWorkModels: ["REMOTE", "HYBRID"], desiredSectors: ["Tecnologia da informação"] },
  });
  const profileSkills = await db.$transaction((tx) => upsertSkills(tx, ["React", "TypeScript", "Git", "CSS"]));
  await db.profileSkill.createMany({ data: profileSkills.map((s) => ({ profileId: candidate.id, skillId: s.id })), skipDuplicates: true });

  let org = await db.organization.findFirst({ where: { slug: "empresa-demonstracao" } });
  if (!org) {
    org = await db.organization.create({
      data: {
        slug: "empresa-demonstracao",
        legalName: "Empresa Demonstração Ltda. (fictícia)",
        tradeName: "Empresa Demonstração",
        cnpj: fakeCnpj(),
        contactEmail: "rh@exemplo.test",
        website: "https://exemplo.test",
        description: "Empresa FICTÍCIA criada pelo seed de desenvolvimento para testar a plataforma.",
        sector: "Tecnologia da informação",
        city: "Recife",
        state: "PE",
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        members: { create: { userId: recruiter.id, role: "OWNER" } },
      },
    });
  }

  const existing = await db.job.count({ where: { orgId: org.id } });
  if (existing === 0) {
    for (const j of JOBS) {
      const description = j.description + NOTE;
      await db.$transaction(async (tx) => {
        const job = await tx.job.create({
          data: {
            orgId: org!.id,
            createdById: recruiter.id,
            title: j.title,
            description,
            sector: j.sector,
            seniority: j.seniority,
            contractType: j.contractType,
            workModel: j.workModel,
            city: j.city ?? null,
            state: j.state ?? null,
            salaryMin: j.salaryMin ?? null,
            salaryMax: j.salaryMax ?? null,
            status: "ACTIVE",
            publishedAt: new Date(Date.now() - randomInt(1, 10) * 86400_000),
            searchText: buildSearchText({ ...j, description }, org!.tradeName, j.skills),
          },
        });
        const skills = await upsertSkills(tx, j.skills);
        await tx.jobSkill.createMany({ data: skills.map((s) => ({ jobId: job.id, skillId: s.id, required: true })) });
      });
    }
  }

  console.log("Seed de demonstração concluído (dados fictícios).");
  console.log(`  Candidata:  candidata.demo@exemplo.test`);
  console.log(`  Recrutador: recrutador.demo@exemplo.test`);
  console.log(`  Senha:      ${process.env.DEMO_PASSWORD ? "(DEMO_PASSWORD)" : password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
