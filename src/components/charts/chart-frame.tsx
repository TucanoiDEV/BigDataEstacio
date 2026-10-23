"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Moldura com alternância Gráfico/Tabela (a tabela é a alternativa acessível). */
export function ChartFrame(props: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string; dashed?: boolean }[];
  table: { headers: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="rounded-2xl border bg-card p-5" aria-label={props.title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-petroleum">{props.title}</h3>
          {props.subtitle && <p className="text-xs text-muted-foreground">{props.subtitle}</p>}
        </div>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Modo de visualização">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", view === v ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}
            >
              {v === "chart" ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
              {v === "chart" ? "Gráfico" : "Tabela"}
            </button>
          ))}
        </div>
      </div>
      {props.legend && view === "chart" && (
        <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legenda">
          {props.legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: l.color }} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        {view === "chart" ? (
          props.children
        ) : (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr>{props.table.headers.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {props.table.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5", typeof c === "number" || j > 0 ? "text-right tabular-nums" : "")}>{typeof c === "number" ? c.toLocaleString("pt-BR") : c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {props.footer && <div className="mt-3 text-xs text-muted-foreground">{props.footer}</div>}
    </section>
  );
}
