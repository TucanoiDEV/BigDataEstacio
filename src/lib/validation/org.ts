import { z } from "zod";
import { COMPANY_SIZES, SECTORS } from "@/lib/constants";
import { isValidCnpj, onlyDigits } from "@/lib/cnpj";
import { emailSchema } from "@/lib/validation/auth";
import { optionalText, optionalUf, optionalUrl, text } from "@/lib/validation/common";

export const ORG_ROLES = ["OWNER", "ADMIN", "RECRUITER", "VIEWER"] as const;

const orgProfileFields = {
  tradeName: text(2, 120, "Nome fantasia"),
  website: optionalUrl,
  contactEmail: emailSchema,
  description: optionalText(3000, "Descrição"),
  sector: z.enum(SECTORS).nullish().transform((v) => v ?? null),
  sizeRange: z.enum(COMPANY_SIZES).nullish().transform((v) => v ?? null),
  city: optionalText(80, "Cidade"),
  state: optionalUf,
};

export const createOrgSchema = z.object({
  legalName: text(3, 200, "Razão social"),
  cnpj: z
    .string()
    .transform(onlyDigits)
    .refine(isValidCnpj, "CNPJ inválido. Confira os dígitos."),
  ...orgProfileFields,
  declaration: z.literal(true, { error: "Confirme que você representa esta empresa." }),
});
export type CreateOrgInput = z.input<typeof createOrgSchema>;

export const updateOrgSchema = z.object(orgProfileFields);
export type UpdateOrgInput = z.input<typeof updateOrgSchema>;

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ORG_ROLES),
});

export const changeRoleSchema = z.object({
  membershipId: z.string().min(10).max(40),
  role: z.enum(ORG_ROLES),
});
