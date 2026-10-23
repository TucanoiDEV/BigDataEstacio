import { z } from "zod";
import { emailSchema } from "@/lib/validation/auth";
import { text } from "@/lib/validation/common";

export const PRIVACY_REQUEST_TYPES = [
  "ACCESS",
  "CORRECTION",
  "EXPORT",
  "DELETION",
  "ANONYMIZATION",
  "CONSENT_REVOCATION",
  "OPPOSITION",
  "INFORMATION",
] as const;

export const PRIVACY_REQUEST_LABEL: Record<(typeof PRIVACY_REQUEST_TYPES)[number], string> = {
  ACCESS: "Confirmação e acesso aos dados",
  CORRECTION: "Correção de dados incompletos, inexatos ou desatualizados",
  EXPORT: "Portabilidade / cópia dos dados",
  DELETION: "Eliminação de dados",
  ANONYMIZATION: "Anonimização, bloqueio ou eliminação de dados desnecessários",
  CONSENT_REVOCATION: "Revogação de consentimento",
  OPPOSITION: "Oposição a tratamento",
  INFORMATION: "Informação sobre compartilhamento com terceiros",
};

export const privacyRequestSchema = z.object({
  requesterName: text(2, 120, "Nome"),
  requesterEmail: emailSchema,
  type: z.enum(PRIVACY_REQUEST_TYPES),
  description: text(10, 3000, "Descrição"),
});
export type PrivacyRequestInput = z.input<typeof privacyRequestSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Informe sua senha."),
  confirmation: z.literal("EXCLUIR", { error: 'Digite EXCLUIR para confirmar.' }),
});

export const contactSchema = z.object({
  name: text(2, 120, "Nome"),
  email: emailSchema,
  subject: z.enum(["DUVIDA", "EMPRESA", "SEGURANCA", "IMPRENSA", "OUTRO"]),
  message: text(10, 3000, "Mensagem"),
});
