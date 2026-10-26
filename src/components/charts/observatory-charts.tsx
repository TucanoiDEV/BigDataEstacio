"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR");
const signed = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const monthLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(". de ", "/").replace(".", "");

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 12, fill: "var(--muted-foreground)" } } as const;
const tooltipStyle = { borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, boxShadow: "0 4px 16px rgba(11,59,70,.08)" };

type Monthly = { period: string; admissions: number; separations: number; balance: number };

/** Admissões x desligamentos: 2 séries categóricas (paleta validada), legenda + rótulo direto no último ponto. */
export function FlowsChart({ data, territory }: { data: Monthly[]; territory: string }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.period) }));
  const last = rows.length - 1;
  return (
    <ChartFrame
      title={`Admissões e desligamentos: ${territory}`}
      subtitle="Movimentações mensais de emprego formal (Novo CAGED, com ajustes)"
      legend={[{ label: "Admissões", color: "var(--chart-1)" }, { label: "Desligamentos", color: "var(--chart-2)" }]}
      table={{ headers: ["Competência", "Admissões", "Desligamentos", "Saldo"], rows: rows.map((r) => [r.label, r.admissions, r.separations, r.balance]) }}
    >
      <div className="h-72" role="img" aria-label={`Gráfico de linhas de admissões e desligamentos em ${territory}; use a visualização em tabela para os valores.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 104, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axis} minTickGap={16} />
            <YAxis {...axis} width={56} tickFormatter={(v) => compact.format(v)} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              formatter={(v, name) => [full.format(Number(v)), name === "admissions" ? "Admissões" : "Desligamentos"]}
            />
            <Line type="monotone" dataKey="admissions" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false}>
              <LabelList dataKey="admissions" content={(p) => (p.index === last ? <text x={Number(p.x) + 6} y={Number(p.y) - 6} fontSize={11} fill="var(--foreground)">Admissões</text> : null)} />
            </Line>
            <Line type="monotone" dataKey="separations" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false}>
              <LabelList dataKey="separations" content={(p) => (p.index === last ? <text x={Number(p.x) + 6} y={Number(p.y) + 14} fontSize={11} fill="var(--foreground)">Desligamentos</text> : null)} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Saldo mensal: barras divergentes (positivo/negativo) a partir da linha de zero. */
export function BalanceChart({ data, territory }: { data: Monthly[]; territory: string }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.period) }));
  return (
    <ChartFrame
      title={`Saldo de empregos formais: ${territory}`}
      subtitle="Admissões menos desligamentos, por competência"
      legend={[{ label: "Saldo positivo", color: "var(--chart-pos)" }, { label: "Saldo negativo", color: "var(--chart-neg)" }]}
      table={{ headers: ["Competência", "Saldo"], rows: rows.map((r) => [r.label, r.balance]) }}
    >
      <div className="h-64" role="img" aria-label={`Gráfico de barras do saldo mensal em ${territory}; use a tabela para os valores.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axis} minTickGap={16} />
            <YAxis {...axis} width={56} tickFormatter={(v) => compact.format(v)} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => [signed.format(Number(v)), "Saldo"]} />
            <Bar dataKey="balance" radius={[4, 4, 4, 4]} maxBarSize={32} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.period} fill={r.balance >= 0 ? "var(--chart-pos)" : "var(--chart-neg)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

type Quarterly = { periodCode: string; label: string; br: number | null; local: number | null };

/** Taxa de desocupação (PNAD Contínua): Brasil x UF selecionada, mesmo eixo (%). */
export function UnemploymentChart({ data, ufName }: { data: Quarterly[]; ufName: string | null }) {
  const rows = data.map((d) => ({ ...d, short: d.label.replace(/º trimestre /, "T/") }));
  const legend = [{ label: "Brasil", color: "var(--chart-1)" }, ...(ufName ? [{ label: ufName, color: "var(--chart-2)" }] : [])];
  return (
    <ChartFrame
      title="Taxa de desocupação (PNAD Contínua/IBGE)"
      subtitle="Pessoas de 14 anos ou mais, % da força de trabalho, trimestral. Pesquisa amostral, sujeita a erro amostral"
      legend={legend}
      table={{ headers: ["Trimestre", "Brasil (%)", ...(ufName ? [`${ufName} (%)`] : [])], rows: rows.map((r) => [r.label, r.br != null ? pct.format(r.br) : "-", ...(ufName ? [r.local != null ? pct.format(r.local) : "-"] : [])]) }}
    >
      <div className="h-64" role="img" aria-label="Gráfico de linhas da taxa de desocupação; use a tabela para os valores.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="short" {...axis} minTickGap={12} />
            <YAxis {...axis} width={40} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${pct.format(Number(v))}%`, name === "br" ? "Brasil" : ufName ?? ""]} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
            <Line type="monotone" dataKey="br" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
            {ufName && <Line type="monotone" dataKey="local" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Barras horizontais divergentes em HTML (seções CNAE / grupos CBO). */
export function DivergingList({ title, subtitle, items, valueLabel = "Saldo" }: { title: string; subtitle?: string; items: { code: string; title: string; admissions: number; separations: number; balance: number }[]; valueLabel?: string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.balance)));
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={[{ label: "Saldo positivo", color: "var(--chart-pos)" }, { label: "Saldo negativo", color: "var(--chart-neg)" }]}
      table={{ headers: ["Categoria", "Admissões", "Desligamentos", valueLabel], rows: items.map((i) => [i.title, i.admissions, i.separations, i.balance]) }}
    >
      <ul className="space-y-1.5">
        {items.map((i) => {
          const w = (Math.abs(i.balance) / max) * 50;
          const pos = i.balance >= 0;
          return (
            <li key={i.code} className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4.5rem] items-center gap-3 rounded-md px-1 py-0.5 text-xs hover:bg-muted/60" title={`${i.title}: admissões ${full.format(i.admissions)}, desligamentos ${full.format(i.separations)}, saldo ${signed.format(i.balance)}`}>
              <span className="truncate text-foreground/90">{i.title}</span>
              <span className="relative h-3" aria-hidden>
                <span className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/40" />
                <span
                  className="absolute inset-y-0 rounded-[4px]"
                  style={{ background: pos ? "var(--chart-pos)" : "var(--chart-neg)", left: pos ? "50%" : `${50 - w}%`, width: `${Math.max(w, 0.5)}%` }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{signed.format(i.balance)}</span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}
