/**
 * Escala divergente do mapa (7 classes): negativo escuro→claro | neutro | positivo claro→escuro.
 * Polos derivados do par divergente validado (#c2410c / #047857, CVD ΔE 9.9).
 */
export const BIN_COLORS = ["#9a3412", "#c2410c", "#f2b48c", "#dfe6e9", "#a7d9c3", "#3f9c7a", "#047857"] as const;

export type MapShape = { code: string; abbr: string; name: string; d: string; value: number; admissions: number; separations: number; bin: number };
