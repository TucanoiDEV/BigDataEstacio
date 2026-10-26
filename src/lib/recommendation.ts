import { normalizeText } from "@/lib/text";
import { CONTRACT_TYPE_LABEL, SENIORITY_LABEL, WORK_MODEL_LABEL } from "@/lib/constants";
import type { ContractType, Seniority, WorkModel } from "@/generated/prisma/browser";

/**
 * Mecanismo de recomendação EXPLICÁVEL e determinístico.
 *
 * Usa apenas: competências, interesses declarados (cargo e setores), experiência,
 * localização e modalidade/contratação/pretensão salarial informadas pelo candidato.
 * NÃO usa idade, gênero, raça, deficiência, estado civil, foto ou qualquer dado
 * sensível — esses dados nem são coletados. O resultado apenas ORDENA sugestões
 * para o candidato; jamais filtra ou rejeita candidaturas.
 */

export type RecProfile = {
  skills: string[]; // slugs
  desiredTitle: string | null;
  desiredSectors: string[];
  desiredWorkModels: WorkModel[];
  desiredContractTypes: ContractType[];
  desiredSeniority: Seniority | null;
  desiredSalaryMin: number | null;
  city: string | null;
  state: string | null;
  openToRelocation: boolean;
  yearsExperience: number;
};

/** Sem competências nem interesses declarados, a recomendação fica genérica. */
export function isSparseProfile(p: RecProfile): boolean {
  return p.skills.length === 0 && !p.desiredTitle && p.desiredSectors.length === 0;
}

export type RecJob = {
  title: string;
  sector: string;
  workModel: WorkModel;
  contractType: ContractType;
  seniority: Seniority;
  city: string | null;
  state: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: { slug: string; name: string; required: boolean }[];
};

export type RecResult = { score: number; reasons: string[]; gaps: string[]; breakdown: Record<string, number> };

export const WEIGHTS = { skills: 40, interest: 15, location: 20, seniority: 12, contract: 6, salary: 7 } as const;

const SENIORITY_ORDER: Seniority[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "SPECIALIST", "MANAGER", "DIRECTOR"];
const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o", "com", "vaga", "pessoa", "profissional"]);

function tokens(value: string): Set<string> {
  return new Set(normalizeText(value).split(/[^a-z0-9+#]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

/** Senioridade inferida de anos de experiência (usada só quando o candidato não declara). */
export function seniorityFromYears(years: number): Seniority {
  if (years < 1) return "JUNIOR";
  if (years < 3) return "JUNIOR";
  if (years < 6) return "MID";
  return "SENIOR";
}

function listNames(names: string[], max = 3) {
  return names.length > max ? `${names.slice(0, max).join(", ")} e mais ${names.length - max}` : names.join(", ");
}

export function scoreJob(profile: RecProfile, job: RecJob): RecResult {
  const reasons: string[] = [];
  const gaps: string[] = [];
  const b: Record<string, number> = {};
  const have = new Set(profile.skills);

  // 1. Competências
  const required = job.skills.filter((s) => s.required);
  const optional = job.skills.filter((s) => !s.required);
  if (job.skills.length === 0) {
    b.skills = WEIGHTS.skills * 0.5;
  } else {
    const reqHit = required.filter((s) => have.has(s.slug));
    const optHit = optional.filter((s) => have.has(s.slug));
    const reqRatio = required.length ? reqHit.length / required.length : optHit.length / Math.max(1, optional.length);
    const optRatio = optional.length ? optHit.length / optional.length : reqRatio;
    b.skills = WEIGHTS.skills * (0.75 * reqRatio + 0.25 * optRatio);
    const hits = [...reqHit, ...optHit];
    // Nenhuma competência exigida em comum não é motivo de recomendação: aparece só como lacuna.
    if (reqHit.length) {
      reasons.push(`Você tem ${reqHit.length} de ${required.length} competências exigidas (${listNames(reqHit.map((s) => s.name))}).`);
    } else if (!required.length && hits.length) {
      reasons.push(`Competências em comum: ${listNames(hits.map((s) => s.name))}.`);
    }
    const missing = required.filter((s) => !have.has(s.slug));
    if (missing.length) gaps.push(`Competências exigidas não informadas no seu perfil: ${listNames(missing.map((s) => s.name), 5)}.`);
  }

  // 2. Interesses declarados (cargo desejado e setores)
  let interest = 0;
  if (profile.desiredTitle) {
    const want = tokens(profile.desiredTitle);
    const got = tokens(job.title);
    const overlap = [...want].filter((t) => got.has(t)).length;
    if (want.size && overlap) {
      interest += (WEIGHTS.interest * 0.7 * overlap) / want.size;
      reasons.push(`O título combina com o cargo que você procura (“${profile.desiredTitle}”).`);
    }
  }
  if (profile.desiredSectors.includes(job.sector)) {
    interest += WEIGHTS.interest * 0.3;
    reasons.push(`Setor de interesse: ${job.sector}.`);
  }
  b.interest = Math.min(WEIGHTS.interest, interest);

  // 3. Localização e modalidade
  const modalityOk = profile.desiredWorkModels.length === 0 || profile.desiredWorkModels.includes(job.workModel);
  let location: number;
  if (job.workModel === "REMOTE") {
    location = WEIGHTS.location;
  } else if (profile.city && job.city && normalizeText(profile.city) === normalizeText(job.city) && profile.state === job.state) {
    location = WEIGHTS.location;
    reasons.push(`A vaga é na sua cidade (${job.city}).`);
  } else if (profile.state && profile.state === job.state) {
    location = WEIGHTS.location * 0.7;
    reasons.push(`A vaga é no seu estado (${job.state}).`);
  } else if (profile.openToRelocation) {
    location = WEIGHTS.location * 0.4;
  } else {
    location = profile.state ? 0 : WEIGHTS.location * 0.3;
  }
  if (modalityOk) {
    if (profile.desiredWorkModels.length) reasons.push(`Modalidade desejada: ${WORK_MODEL_LABEL[job.workModel]}.`);
  } else {
    location *= 0.4;
    gaps.push(`Modalidade ${WORK_MODEL_LABEL[job.workModel].toLowerCase()} não está entre suas preferências.`);
  }
  b.location = location;

  // 4. Senioridade / experiência
  const target = profile.desiredSeniority ?? seniorityFromYears(profile.yearsExperience);
  const dist = Math.abs(SENIORITY_ORDER.indexOf(target) - SENIORITY_ORDER.indexOf(job.seniority));
  b.seniority = dist === 0 ? WEIGHTS.seniority : dist === 1 ? WEIGHTS.seniority * 0.5 : 0;
  if (dist === 0) reasons.push(`Nível compatível: ${SENIORITY_LABEL[job.seniority]}.`);

  // 5. Tipo de contratação
  const contractOk = profile.desiredContractTypes.length === 0 || profile.desiredContractTypes.includes(job.contractType);
  b.contract = contractOk ? WEIGHTS.contract : 0;
  if (!contractOk) gaps.push(`Contratação ${CONTRACT_TYPE_LABEL[job.contractType]} fora das suas preferências.`);

  // 6. Pretensão salarial
  const top = job.salaryMax ?? job.salaryMin;
  if (!profile.desiredSalaryMin || top == null) {
    b.salary = WEIGHTS.salary * 0.5;
  } else if (top >= profile.desiredSalaryMin) {
    b.salary = WEIGHTS.salary;
    reasons.push("A faixa salarial atende à sua pretensão.");
  } else {
    b.salary = 0;
    gaps.push("A faixa salarial informada está abaixo da sua pretensão.");
  }

  const score = Math.round(Object.values(b).reduce((a, x) => a + x, 0));
  return { score: Math.max(0, Math.min(100, score)), reasons, gaps, breakdown: b };
}

export function yearsOfExperience(exps: { startDate: Date; endDate: Date | null; isCurrent: boolean }[], now: Date): number {
  // Une intervalos sobrepostos para não contar duas vezes o mesmo período.
  const ranges = exps
    .map((e) => [e.startDate.getTime(), (e.isCurrent || !e.endDate ? now : e.endDate).getTime()] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of ranges) {
    if (s > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else curEnd = Math.max(curEnd, e);
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return Math.round((total / (365.25 * 86400_000)) * 10) / 10;
}
