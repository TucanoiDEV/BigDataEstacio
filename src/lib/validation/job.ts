import { z } from "zod";
import { SECTORS } from "@/lib/constants";
import { optionalMoney, optionalText, optionalUf, text } from "@/lib/validation/common";

export const WORK_MODELS = ["REMOTE", "HYBRID", "ON_SITE"] as const;
export const CONTRACT_TYPES = ["CLT", "PJ", "INTERNSHIP", "TEMPORARY", "APPRENTICE", "FREELANCE"] as const;
export const SENIORITIES = ["INTERN", "JUNIOR", "MID", "SENIOR", "SPECIALIST", "MANAGER", "DIRECTOR"] as const;

/**
 * Data de encerramento das inscrições ("AAAA-MM-DD", do campo de data). Vale até o fim do dia
 * no horário de Brasília; vazio = sem prazo.
 */
const closesAtSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T23:59:59-03:00`).getTime())) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return new Date(`${v}T23:59:59-03:00`);
  });

export const skillListSchema = z
  .array(z.string().trim().min(2, "Competência muito curta.").max(40, "Competência muito longa."))
  .max(20, "Máximo de 20 competências.")
  .transform((list) => {
    const seen = new Set<string>();
    return list.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

export const jobSchema = z
  .object({
    title: text(3, 120, "Título"),
    description: text(50, 10000, "Descrição"),
    requirements: optionalText(5000, "Requisitos"),
    benefits: optionalText(3000, "Benefícios"),
    sector: z.enum(SECTORS, { error: "Selecione o setor." }),
    seniority: z.enum(SENIORITIES, { error: "Selecione a senioridade." }),
    contractType: z.enum(CONTRACT_TYPES, { error: "Selecione o tipo de contratação." }),
    workModel: z.enum(WORK_MODELS, { error: "Selecione a modalidade." }),
    city: optionalText(80, "Cidade"),
    state: optionalUf,
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    salaryVisible: z.boolean().default(true),
    positions: z.coerce.number().int().min(1).max(1000).default(1),
    closesAt: closesAtSchema,
    skills: skillListSchema.default([]),
    requiredSkills: z.array(z.string()).max(20).default([]),
    publish: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.workModel !== "REMOTE" && (!v.city || !v.state)) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Informe cidade e UF para vagas presenciais ou híbridas." });
    }
    if (v.closesAt && v.closesAt.getTime() < Date.now()) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "A data de encerramento precisa ser hoje ou uma data futura." });
    }
    if (v.closesAt && v.closesAt.getTime() > Date.now() + 366 * 86_400_000) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "O prazo de inscrições pode ser de no máximo um ano." });
    }
    if (v.salaryMin != null && v.salaryMax != null && v.salaryMin > v.salaryMax) {
      ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "O salário máximo deve ser maior ou igual ao mínimo." });
    }
  });
export type JobInput = z.input<typeof jobSchema>;
export type JobData = z.output<typeof jobSchema>;
