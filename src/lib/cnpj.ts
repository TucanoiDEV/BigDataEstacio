/** Mantém apenas dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida CNPJ numérico pelos dígitos verificadores (módulo 11). */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const d1 = calcDigit(cnpj.slice(0, 12), w1);
  const d2 = calcDigit(cnpj.slice(0, 12) + d1, w2);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).padEnd(14, " ").slice(0, 14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`.trim();
}
