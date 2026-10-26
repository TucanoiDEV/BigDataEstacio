import type {
  ApplicationStatus,
  ContractType,
  JobStatus,
  OrgRole,
  OrgVerificationStatus,
  ProfileVisibility,
  Seniority,
  WorkModel,
} from "@/generated/prisma/browser";

export const UFS = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
] as const;

export const UF_CODES = UFS.map((u) => u.code) as [string, ...string[]];

/** Setores de atuação usados para classificar vagas (rótulos da plataforma, não CNAE). */
export const SECTORS = [
  "Administração",
  "Agronegócio",
  "Atendimento ao cliente",
  "Comercial e vendas",
  "Construção civil",
  "Educação",
  "Engenharia",
  "Finanças e contabilidade",
  "Indústria e produção",
  "Jurídico",
  "Logística e transporte",
  "Marketing e comunicação",
  "Recursos humanos",
  "Saúde",
  "Serviços gerais",
  "Tecnologia da informação",
  "Turismo e hotelaria",
  "Varejo",
] as const;

export const WORK_MODEL_LABEL: Record<WorkModel, string> = {
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
  ON_SITE: "Presencial",
};

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  CLT: "CLT",
  PJ: "PJ",
  INTERNSHIP: "Estágio",
  TEMPORARY: "Temporário",
  APPRENTICE: "Jovem aprendiz",
  FREELANCE: "Freelancer",
};

export const SENIORITY_LABEL: Record<Seniority, string> = {
  INTERN: "Estágio",
  JUNIOR: "Júnior",
  MID: "Pleno",
  SENIOR: "Sênior",
  SPECIALIST: "Especialista",
  MANAGER: "Gestão",
  DIRECTOR: "Diretoria",
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: "Enviada",
  IN_REVIEW: "Em análise",
  INTERVIEW: "Entrevista",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  WITHDRAWN: "Retirada",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em moderação",
  ACTIVE: "Publicada",
  PAUSED: "Pausada",
  CLOSED: "Encerrada",
  REMOVED: "Removida",
};

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: "Proprietário(a)",
  ADMIN: "Administrador(a)",
  RECRUITER: "Recrutador(a)",
  VIEWER: "Leitor(a)",
};

export const ORG_STATUS_LABEL: Record<OrgVerificationStatus, string> = {
  PENDING: "Verificação pendente",
  VERIFIED: "Verificada",
  REJECTED: "Recusada",
  SUSPENDED: "Suspensa",
};

export const VISIBILITY_LABEL: Record<ProfileVisibility, string> = {
  PRIVATE: "Privado: só empresas para as quais me candidatei",
  VERIFIED_COMPANIES: "Visível para recrutadores de empresas verificadas",
};

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"] as const;

/** Versões vigentes dos documentos legais (alterar exige novo aceite/consentimento). */
export const LEGAL_VERSIONS = {
  terms: "2026-10-23",
  privacy: "2026-10-23",
  cookies: "2026-10-23",
} as const;

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const PAGE_SIZE = 12;
