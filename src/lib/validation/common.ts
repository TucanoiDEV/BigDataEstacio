import { z } from "zod";
import { UF_CODES } from "@/lib/constants";
import { cleanText } from "@/lib/text";

export const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/i, "Identificador inválido.");

export const text = (min: number, max: number, label = "Campo") =>
  z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} é obrigatório.` : `${label}: mínimo de ${min} caracteres.`)
        .max(max, `${label}: máximo de ${max} caracteres.`),
    );

export const optionalText = (max: number, label = "Campo") =>
  z
    .string()
    .nullish()
    .transform((v) => (v ? cleanText(v) : null))
    .pipe(z.string().max(max, `${label}: máximo de ${max} caracteres.`).nullable())
    .transform((v) => (v ? v : null));

export const ufSchema = z.enum(UF_CODES, { error: "Selecione uma UF válida." });
export const optionalUf = ufSchema.nullish().transform((v) => v ?? null);

export const optionalUrl = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(
    z
      .url({ protocol: /^https?$/, error: "Informe uma URL começando com https://" })
      .max(300)
      .nullable(),
  );

export const optionalMoney = z
  .number({ error: "Informe um valor numérico." })
  .nullish()
  .transform((v) => (v == null ? null : Math.round(v)))
  .pipe(z.number().int().min(0, "Valor inválido.").max(1_000_000, "Valor muito alto.").nullable());

export const phoneSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v.replace(/[^\d+]/g, "") : null))
  .pipe(z.string().regex(/^\+?\d{10,13}$/, "Telefone inválido (inclua o DDD).").nullable());
