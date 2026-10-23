"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Série única (sem legenda; o título nomeia a série). Barras finas, cantos 4px, tooltip por barra. */
export function WeeklyColumns({ data, label }: { data: { week: string; value: number }[]; label: string }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`${label}: ${data.map((d) => `${d.week} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={40} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
            formatter={(v) => [String(v), label]}
            labelFormatter={(l) => `Semana de ${l}`}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
