-- Busca textual por similaridade (pg_trgm) e restrições de integridade
-- que o schema do Prisma não expressa.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN de trigramas sobre o texto normalizado da vaga (busca por "contains").
CREATE INDEX "Job_searchText_trgm_idx" ON "Job" USING GIN ("searchText" gin_trgm_ops);

-- Vagas: faixa salarial coerente, número de posições positivo.
ALTER TABLE "Job"
  ADD CONSTRAINT "Job_salary_nonneg_chk" CHECK (("salaryMin" IS NULL OR "salaryMin" >= 0) AND ("salaryMax" IS NULL OR "salaryMax" >= 0)),
  ADD CONSTRAINT "Job_salary_range_chk" CHECK ("salaryMin" IS NULL OR "salaryMax" IS NULL OR "salaryMin" <= "salaryMax"),
  ADD CONSTRAINT "Job_positions_chk" CHECK ("positions" BETWEEN 1 AND 1000),
  ADD CONSTRAINT "Job_state_chk" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$');

-- Empresas: CNPJ armazenado somente com 14 dígitos.
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_cnpj_digits_chk" CHECK ("cnpj" ~ '^[0-9]{14}$'),
  ADD CONSTRAINT "Organization_state_chk" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$');

ALTER TABLE "CandidateProfile"
  ADD CONSTRAINT "CandidateProfile_state_chk" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "CandidateProfile_salary_chk" CHECK ("desiredSalaryMin" IS NULL OR "desiredSalaryMin" >= 0);

-- Usuários: e-mail sempre minúsculo (unicidade case-insensitive).
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_lower_chk" CHECK ("email" = lower("email"));

-- Experiências e formação: datas coerentes.
ALTER TABLE "Experience"
  ADD CONSTRAINT "Experience_dates_chk" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Education"
  ADD CONSTRAINT "Education_dates_chk" CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");

-- Um currículo padrão por candidato.
CREATE UNIQUE INDEX "Resume_one_default_per_profile" ON "Resume" ("profileId") WHERE "isDefault";

-- Observatório: identidade contábil do saldo e valores não negativos.
ALTER TABLE "StatEmploymentFlow"
  ADD CONSTRAINT "StatEmploymentFlow_nonneg_chk" CHECK ("admissions" >= 0 AND "separations" >= 0),
  ADD CONSTRAINT "StatEmploymentFlow_balance_chk" CHECK ("balance" = "admissions" - "separations"),
  ADD CONSTRAINT "StatEmploymentFlow_wage_chk" CHECK ("avgAdmissionWage" IS NULL OR ("avgAdmissionWage" > 0 AND "wageSampleSize" IS NOT NULL));
ALTER TABLE "StatEmploymentStock"
  ADD CONSTRAINT "StatEmploymentStock_nonneg_chk" CHECK ("activeLinks" >= 0);
ALTER TABLE "StatDataset"
  ADD CONSTRAINT "StatDataset_period_chk" CHECK ("referenceEnd" >= "referenceStart");
