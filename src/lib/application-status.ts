import type { ApplicationStatus } from "@/generated/prisma/browser";

export const FINAL_STATUSES: readonly ApplicationStatus[] = ["APPROVED", "REJECTED", "WITHDRAWN"];

/** Transições permitidas para a empresa (recrutamento). */
const COMPANY_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  SUBMITTED: ["IN_REVIEW", "INTERVIEW", "REJECTED"],
  IN_REVIEW: ["INTERVIEW", "APPROVED", "REJECTED"],
  INTERVIEW: ["IN_REVIEW", "APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function companyCanTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return COMPANY_TRANSITIONS[from].includes(to);
}

export function companyNextStatuses(from: ApplicationStatus): readonly ApplicationStatus[] {
  return COMPANY_TRANSITIONS[from];
}

/** O candidato pode retirar a candidatura enquanto ela não estiver finalizada. */
export function candidateCanWithdraw(from: ApplicationStatus): boolean {
  return !FINAL_STATUSES.includes(from);
}

/** Etapas exibidas na linha do tempo do candidato. */
export const PIPELINE_STEPS: readonly ApplicationStatus[] = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "APPROVED"];
