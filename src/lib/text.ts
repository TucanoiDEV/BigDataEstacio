/** Remove acentos e normaliza para comparação/busca ("São Paulo" -> "sao paulo"). */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Gera slug estável para URLs a partir de texto livre. */
export function slugify(value: string, maxLength = 60): string {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLength).replace(/-+$/g, "") || "item";
}

/** Iniciais para avatares ("Maria da Silva" -> "MS"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p));
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/** Divide texto livre em parágrafos para renderização segura (sem HTML). */
export function paragraphs(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Remove caracteres de controle e espaços extras de entradas de texto.
 * O conteúdo é sempre renderizado como texto pelo React (escapado), nunca como HTML.
 */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}
