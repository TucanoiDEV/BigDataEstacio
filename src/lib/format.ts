const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pt-BR");
const signed = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" });

export function formatCurrency(value: number): string {
  return brl.format(value);
}

export function formatNumber(value: number): string {
  return num.format(value);
}

export function formatSigned(value: number): string {
  return signed.format(value);
}

export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min && max) return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
  if (min) return `A partir de ${formatCurrency(min)}`;
  if (max) return `Até ${formatCurrency(max)}`;
  return null;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(d: Date | string): string {
  return dateFmt.format(new Date(d));
}

export function formatDateTime(d: Date | string): string {
  return dateTimeFmt.format(new Date(d));
}

/** Competência mensal (datas armazenadas como 1º dia do mês, UTC). */
export function formatMonth(d: Date | string): string {
  return monthFmt.format(new Date(d)).replace(".", "");
}

/** Trimestre ("3T/2023") a partir da data de início armazenada em UTC. */
export function formatQuarter(d: Date | string): string {
  const date = new Date(d);
  return `${Math.floor(date.getUTCMonth() / 3) + 1}T/${date.getUTCFullYear()}`;
}

/** "há 3 dias" relativo a `now` (passado explicitamente para evitar não determinismo na renderização). */
export function formatRelative(d: Date | string, now: Date): string {
  const diffMs = now.getTime() - new Date(d).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "há 1 mês" : `há ${months} meses`;
  const years = Math.round(months / 12);
  return years === 1 ? "há 1 ano" : `há ${years} anos`;
}
