import type { WorkModel } from "@/generated/prisma/browser";
import { UFS } from "@/lib/constants";
import { normalizeText } from "@/lib/text";

// Normalização de vagas vindas de outros sites. Funções puras (testadas em unidade):
// o texto externo NUNCA é confiável — tags removidas, entidades decodificadas e URLs restritas a https.

const UF_BY_KEY = new Map<string, string>([
  ...UFS.map((u) => [normalizeText(u.name), u.code] as [string, string]),
  ...UFS.map((u) => [u.code.toLowerCase(), u.code] as [string, string]),
]);

/** "Sao Paulo", "São Paulo" ou "SP" -> "SP". */
export function ufFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  return UF_BY_KEY.get(normalizeText(value)) ?? null;
}

// ---------------------------------------------------------------------------
// Localização
// ---------------------------------------------------------------------------

export type Place = { name: string; uf: string };
/** Municípios por nome normalizado (um nome pode existir em várias UFs: "Belém" está em PA, PB e AL). */
export type PlaceIndex = Map<string, Place[]>;

const CAPITALS: Place[] = [
  ["Rio Branco", "AC"], ["Maceió", "AL"], ["Macapá", "AP"], ["Manaus", "AM"], ["Salvador", "BA"], ["Fortaleza", "CE"],
  ["Brasília", "DF"], ["Vitória", "ES"], ["Goiânia", "GO"], ["São Luís", "MA"], ["Cuiabá", "MT"], ["Campo Grande", "MS"],
  ["Belo Horizonte", "MG"], ["Belém", "PA"], ["João Pessoa", "PB"], ["Curitiba", "PR"], ["Recife", "PE"], ["Teresina", "PI"],
  ["Rio de Janeiro", "RJ"], ["Natal", "RN"], ["Porto Alegre", "RS"], ["Porto Velho", "RO"], ["Boa Vista", "RR"],
  ["Florianópolis", "SC"], ["São Paulo", "SP"], ["Aracaju", "SE"], ["Palmas", "TO"],
].map(([name, uf]) => ({ name, uf }));
const CAPITAL_KEYS = new Set(CAPITALS.map((c) => `${normalizeText(c.name)}|${c.uf}`));

/** Índice de municípios. Sem a lista do IBGE (observatório não importado), usa só as capitais. */
export function buildPlaceIndex(places: Place[] = []): PlaceIndex {
  const index: PlaceIndex = new Map();
  for (const p of [...CAPITALS, ...places]) {
    const key = normalizeText(p.name);
    const list = index.get(key) ?? [];
    if (!list.some((x) => x.uf === p.uf)) list.push(p);
    index.set(key, list);
  }
  return index;
}
const DEFAULT_PLACES = buildPlaceIndex();

// País ou regiões brasileiras citadas sem cidade ("Região Sul", "ABC Paulista").
const BRAZIL = /\b(brasil|brazil|regiao (norte|nordeste|sul|sudeste|centro-oeste)|abc paulista)\b/;
// Países e cidades estrangeiras frequentes em quadros de empresas brasileiras. Sem "Brasil" no
// rótulo, eles descartam o trecho — inclusive homônimos de municípios ("Barcelona", "Miami, Florida").
const FOREIGN = new RegExp(
  String.raw`\b(${[
    "mexico", "argentina", "chile", "colombia", "peru", "uruguay", "uruguai", "paraguay", "paraguai", "ecuador", "bolivia", "venezuela",
    "usa", "united states", "estados unidos", "eua", "us", "canada", "new york", "miami", "florida", "california", "texas", "manhattan", "san francisco", "toronto",
    "uk", "united kingdom", "england", "london", "londres", "ireland", "dublin", "portugal", "lisboa", "lisbon", "porto, portugal",
    "spain", "espanha", "madrid", "barcelona", "france", "franca", "paris", "germany", "alemanha", "berlin", "munich", "netherlands", "amsterdam",
    "italy", "italia", "milan", "poland", "warsaw", "romania", "bucharest", "switzerland", "zurich", "sweden", "stockholm",
    "india", "bangalore", "china", "shanghai", "beijing", "singapore", "singapura", "japan", "tokyo", "israel", "tel aviv", "dubai", "uae",
    "saudi", "riyadh", "australia", "sydney", "medellin", "bogota", "montevideo", "buenos aires", "cdmx", "guadalajara",
    "monterrey", "queretaro", "latam", "emea", "apac",
  ].join("|")})\b`, // String.raw: "\b" é limite de palavra, não backspace
);

function workModelOf(normalized: string): WorkModel | null {
  if (/\b(remoto|remote|home ?office|teletrabalho|anywhere)\b/.test(normalized)) return "REMOTE";
  if (/\b(hibrido|hybrid)\b/.test(normalized)) return "HYBRID";
  if (/\b(presencial|on-?site|in office)\b/.test(normalized)) return "ON_SITE";
  return null;
}

// Separadores de lista: vírgula, barra, parênteses, "|", " ou ", " or ", " e ", " and ", " l " e hífen
// com espaço de algum lado ("Brazil- São Paulo") ou antes de sigla de UF ("São Paulo-SP"),
// preservando nomes como "Embu-Guaçu".
const SPLIT = /\s*(?:[,/()|]|\s(?:ou|or|e|and|l)\s|\s[-–]\s?|[-–]\s|-(?=[a-z]{2}(?:$|[\s,/|)])))\s*/i;
const NOISE = /^(brasil|brazil|br|100% remoto|remoto|remote|home ?office|teletrabalho|hibrido|hybrid|presencial|on-?site|anywhere|regiao|region|capital|grande)$/;

export type ParsedLocation = { city: string | null; state: string | null; workModel: WorkModel | null; label: string };

/**
 * Interpreta rótulos livres de localização ("Sao Paulo, Sao Paulo, Brasil", "Curitiba or São Paulo | On-site",
 * "Brazil (São Paulo - Hybrid)", "São Paulo/SP", "Paranaguá", "Remoto"). Cidades são reconhecidas pela lista
 * de municípios; devolve null quando não há indício de que a vaga é no Brasil ("Mexico City, Mexico",
 * "London l Remote"). Vagas só "remotas", sem país, são aceitas.
 */
export function parseLocationLabel(label: string, places: PlaceIndex = DEFAULT_PLACES): ParsedLocation | null {
  for (const segment of label.split(";").map((s) => s.trim()).filter(Boolean)) {
    const n = normalizeText(segment);
    const hasBrazil = BRAZIL.test(n);
    if (FOREIGN.test(n) && !hasBrazil) continue;
    const workModel = workModelOf(n);

    const tokens = segment.split(SPLIT).map((t) => t.trim()).filter(Boolean)
      .map((original) => ({ original, key: normalizeText(original) }))
      .filter((t) => !NOISE.test(t.key));
    const ufTokens = tokens.map((t) => ufFromText(t.key)).filter((u): u is string => Boolean(u));

    let city: string | null = null;
    let state: string | null = null;
    // "Cidade, Estado" com cidade fora do índice ("Embu-Guaçu, Sao Paulo"): a posição decide.
    const [first, second] = tokens;
    if (first && second && !places.has(first.key) && !ufFromText(first.key) && ufFromText(second.key)) {
      return { city: first.original, state: ufFromText(second.key), workModel, label: segment };
    }
    for (const t of tokens) {
      const matches = places.get(t.key);
      if (!matches?.length) continue;
      // Nome de UF que também é município de OUTRA UF ("Paraná", RN) vale como UF.
      const asUf = ufFromText(t.key);
      if (asUf && !matches.some((m) => m.uf === asUf)) continue;
      const pick =
        matches.length === 1 ? matches[0]
        : matches.find((m) => ufTokens.includes(m.uf)) ?? matches.find((m) => CAPITAL_KEYS.has(`${t.key}|${m.uf}`)) ?? null;
      city = pick?.name ?? t.original;
      state = pick?.uf ?? null;
      break;
    }
    if (!city) state = ufTokens[0] ?? null;

    if (city || state || hasBrazil || (workModel === "REMOTE" && tokens.length === 0)) {
      return { city, state, workModel, label: segment };
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** HTML (possivelmente escapado duas vezes, como no Greenhouse) -> texto simples. */
export function htmlToText(html: string): string {
  const once = decodeEntities(html);
  return decodeEntities(once.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function snippetOf(text: string, max = 400): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40))}…`;
}

/** Aceita apenas URLs https dos domínios esperados da fonte (bloqueia javascript:, http:, etc.). */
export function safeExternalUrl(value: unknown, allowedHosts: RegExp): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.test(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

const num = (v: unknown) => (typeof v === "string" && v.trim() ? Number(v) : typeof v === "number" ? v : NaN);

/**
 * Faixa salarial mensal plausível em reais. Fontes às vezes informam valores anuais:
 * se o maior valor passa de R$ 60 mil, a faixa inteira é convertida (nunca só um dos lados).
 */
export function monthlySalaryRange(min: unknown, max: unknown): { salaryMin: number | null; salaryMax: number | null } {
  const values = [num(min), num(max)].map((n) => (Number.isFinite(n) && n >= 500 ? n : null));
  const top = Math.max(values[0] ?? 0, values[1] ?? 0);
  const factor = top > 60_000 ? 1 / 12 : 1;
  const [a, b] = values.map((n) => (n === null ? null : Math.round(n * factor)));
  if ((a ?? 0) > 100_000 || (b ?? 0) > 100_000) return { salaryMin: null, salaryMax: null };
  if (a !== null && b !== null && a > b) return { salaryMin: b, salaryMax: a };
  return { salaryMin: a, salaryMax: b };
}
