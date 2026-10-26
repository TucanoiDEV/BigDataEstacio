import { z } from "zod";
import { SECTORS } from "@/lib/constants";
import { optionalMoney, optionalText, optionalUf, optionalUrl, phoneSchema, text } from "@/lib/validation/common";
import { CONTRACT_TYPES, SENIORITIES, WORK_MODELS, skillListSchema } from "@/lib/validation/job";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato mês/ano.")
  .transform((v) => new Date(`${v}-01T00:00:00.000Z`));

const optionalMonth = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(monthSchema.nullable());

export const profileSchema = z.object({
  name: text(2, 120, "Nome"),
  headline: optionalText(140, "Título profissional"),
  about: optionalText(3000, "Sobre"),
  city: optionalText(80, "Cidade"),
  state: optionalUf,
  phone: phoneSchema,
  linkedinUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  desiredTitle: optionalText(100, "Cargo desejado"),
  desiredWorkModels: z.array(z.enum(WORK_MODELS)).max(3).default([]),
  desiredContractTypes: z.array(z.enum(CONTRACT_TYPES)).max(6).default([]),
  desiredSeniority: z.enum(SENIORITIES, { error: "Selecione uma senioridade válida." }).nullish().transform((v) => v ?? null),
  desiredSalaryMin: optionalMoney,
  desiredSectors: z.array(z.enum(SECTORS)).max(5, "Escolha até 5 setores.").default([]),
  openToRelocation: z.boolean().default(false),
  skills: skillListSchema.default([]),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const experienceSchema = z
  .object({
    id: z.string().optional(),
    title: text(2, 120, "Cargo"),
    company: text(2, 120, "Empresa"),
    city: optionalText(80, "Cidade"),
    startDate: monthSchema,
    endDate: optionalMonth,
    isCurrent: z.boolean().default(false),
    description: optionalText(2000, "Descrição"),
  })
  .refine((v) => v.isCurrent || v.endDate, { path: ["endDate"], message: "Informe o término ou marque como atual." })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "O término deve ser após o início." });
export type ExperienceInput = z.input<typeof experienceSchema>;

export const educationSchema = z
  .object({
    id: z.string().optional(),
    institution: text(2, 160, "Instituição"),
    degree: text(2, 120, "Curso / nível"),
    field: optionalText(120, "Área"),
    startDate: optionalMonth,
    endDate: optionalMonth,
    inProgress: z.boolean().default(false),
  })
  .refine((v) => !v.endDate || !v.startDate || v.endDate >= v.startDate, { path: ["endDate"], message: "O término deve ser após o início." });
export type EducationInput = z.input<typeof educationSchema>;

export const privacySettingsSchema = z.object({
  visibility: z.enum(["PRIVATE", "VERIFIED_COMPANIES"], { error: "Escolha a visibilidade." }),
  showEmailToCompanies: z.boolean(),
  showPhoneToCompanies: z.boolean(),
  recommendationsEnabled: z.boolean(),
  emailApplicationUpdates: z.boolean(),
  emailJobAlerts: z.boolean(),
  emailProductNews: z.boolean(),
});
export type PrivacySettingsInput = z.input<typeof privacySettingsSchema>;
