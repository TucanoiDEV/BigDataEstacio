import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("Informe um e-mail válido."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);

/** Aceita apenas caminhos internos para evitar open redirect. */
export const safeNextPath = z
  .string()
  .optional()
  .transform((v) => (v && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) && !v.startsWith("/\\") ? v : undefined));

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "É preciso aceitar os Termos de Uso e ciência da Política de Privacidade." }),
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(PASSWORD_MAX_LENGTH),
  next: safeNextPath,
});
export type LoginInput = z.input<typeof loginSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(100),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual."),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s|-/g, ""))
    .pipe(z.string().regex(/^(\d{6}|[a-z0-9]{10})$/i, "Código inválido.")),
});

export const disableMfaSchema = z.object({
  password: z.string().min(1, "Informe sua senha."),
  code: z.string().trim().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
});
