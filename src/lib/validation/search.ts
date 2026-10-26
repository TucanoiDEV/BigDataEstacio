import { z } from "zod";
import { SECTORS, UF_CODES } from "@/lib/constants";
import { CONTRACT_TYPES, SENIORITIES, WORK_MODELS } from "@/lib/validation/job";

const multi = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : v.split(",")))
    .transform((arr) => arr.filter((x): x is T[number] => (values as readonly string[]).includes(x)));

// Parâmetro escalar repetido na URL (?q=a&q=b) chega como array: vale o primeiro valor.
const optionalString = (max: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, max) || undefined)
    .catch(undefined);

export const SORTS = ["recent", "salary", "relevance"] as const;

/** Filtros de busca de vagas (vindos da URL — nunca confiáveis). */
export const jobSearchSchema = z.object({
  q: optionalString(100),
  uf: z.enum(UF_CODES).optional().catch(undefined),
  city: optionalString(80),
  modalidade: multi(WORK_MODELS),
  contrato: multi(CONTRACT_TYPES),
  senioridade: multi(SENIORITIES),
  setor: z.enum(SECTORS).optional().catch(undefined),
  salarioMin: z.coerce.number().int().min(0).max(1_000_000).optional().catch(undefined),
  empresa: optionalString(80),
  ordem: z.enum(SORTS).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(500).optional().catch(1),
});
export type JobSearch = z.output<typeof jobSearchSchema>;

export function parseJobSearch(sp: Record<string, string | string[] | undefined>): JobSearch {
  const parsed = jobSearchSchema.safeParse(sp);
  return parsed.success ? parsed.data : jobSearchSchema.parse({});
}

/** Serializa filtros de volta para query string (para paginação e alertas). */
export function jobSearchToParams(s: Partial<JobSearch>): URLSearchParams {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.uf) p.set("uf", s.uf);
  if (s.city) p.set("city", s.city);
  if (s.modalidade?.length) p.set("modalidade", s.modalidade.join(","));
  if (s.contrato?.length) p.set("contrato", s.contrato.join(","));
  if (s.senioridade?.length) p.set("senioridade", s.senioridade.join(","));
  if (s.setor) p.set("setor", s.setor);
  if (s.salarioMin) p.set("salarioMin", String(s.salarioMin));
  if (s.empresa) p.set("empresa", s.empresa);
  if (s.ordem && s.ordem !== "recent") p.set("ordem", s.ordem);
  if (s.pagina && s.pagina > 1) p.set("pagina", String(s.pagina));
  return p;
}

/** Filtros persistidos em alertas: mesmo schema, sem paginação/ordem. */
export const alertFiltersSchema = jobSearchSchema.omit({ pagina: true, ordem: true });
export type AlertFilters = z.output<typeof alertFiltersSchema>;
