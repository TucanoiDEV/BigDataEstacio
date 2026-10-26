"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartFrame } from "@/components/charts/chart-frame";
import { BIN_COLORS, type MapShape } from "@/lib/map-colors";

const signed = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" });
const full = new Intl.NumberFormat("pt-BR");

export function UfMap(props: { shapes: MapShape[]; viewBox: string; bins: { label: string; color: string }[]; selected: string | null; period: string }) {
  const [hover, setHover] = useState<MapShape | null>(null);
  const sorted = [...props.shapes].sort((a, b) => b.value - a.value);
  return (
    <ChartFrame
      title="Saldo acumulado por UF"
      subtitle={`Comparação territorial em ${props.period}. Clique em uma UF para filtrar o painel.`}
      table={{ headers: ["UF", "Admissões", "Desligamentos", "Saldo"], rows: sorted.map((s) => [`${s.name} (${s.abbr})`, s.admissions, s.separations, s.value]) }}
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Legenda de cores">
          {props.bins.map((b) => (
            <span key={b.label} className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-sm border border-black/10" style={{ background: b.color }} aria-hidden />
              {b.label}
            </span>
          ))}
        </div>
      }
    >
      <div className="relative">
        <svg viewBox={props.viewBox} className="mx-auto h-auto w-full max-w-xl" role="img" aria-label="Mapa do Brasil por UF colorido pelo saldo de empregos; a tabela traz os valores">
          {props.shapes.map((s) => (
            <Link key={s.code} href={`/mercado-de-trabalho?uf=${s.code}`} aria-label={`${s.name}: saldo ${signed.format(s.value)}`}>
              <path
                d={s.d}
                fill={BIN_COLORS[s.bin]}
                stroke={props.selected === s.code ? "var(--petroleum)" : "var(--card)"}
                strokeWidth={props.selected === s.code ? 2.5 : 1}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s)}
                onBlur={() => setHover(null)}
                className="cursor-pointer transition-opacity hover:opacity-85"
              />
            </Link>
          ))}
        </svg>
        {hover && (
          <div role="status" className="pointer-events-none absolute left-2 top-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
            <p className="font-semibold">{hover.name}</p>
            <p>Saldo: <strong>{signed.format(hover.value)}</strong></p>
            <p className="text-muted-foreground">Admissões {full.format(hover.admissions)} · Desligamentos {full.format(hover.separations)}</p>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
