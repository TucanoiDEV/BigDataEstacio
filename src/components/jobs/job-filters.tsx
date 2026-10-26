"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CONTRACT_TYPE_LABEL, SECTORS, SENIORITY_LABEL, UFS, WORK_MODEL_LABEL } from "@/lib/constants";
import type { JobSearch } from "@/lib/validation/search";
import { cn } from "@/lib/utils";

const selectCls = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function CheckGroup({ name, legend, options, selected, onChange }: {
  name: string;
  legend: string;
  options: Record<string, string>;
  selected: string[];
  onChange: () => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-petroleum">{legend}</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {Object.entries(options).map(([value, label]) => {
          const id = `${name}-${value}`;
          return (
            <div key={value} className="flex items-center gap-2">
              <Checkbox id={id} name={name} value={value} defaultChecked={selected.includes(value)} onCheckedChange={onChange} />
              <Label htmlFor={id} className="text-sm font-normal text-foreground/90">{label}</Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Mesmo ponto de quebra do layout em duas colunas (lg). */
const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

function activeCount(f: JobSearch): number {
  return [f.uf, f.city, f.salarioMin, f.setor].filter(Boolean).length + f.modalidade.length + f.contrato.length + f.senioridade.length;
}

/**
 * Filtros como formulário GET comum. No desktop, aplica automaticamente ao marcar opções.
 * No celular, fica recolhido atrás do botão "Filtros" (para a lista aparecer logo) e só aplica
 * em "Aplicar filtros": aplicar a cada toque recarregaria a lista e fecharia o painel.
 */
export function JobFilters({ filters }: { filters: JobSearch }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const count = activeCount(filters);

  const submit = () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["q", "uf", "city", "setor", "salarioMin", "ordem", "empresa"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) params.set(key, v);
    }
    for (const key of ["modalidade", "contrato", "senioridade"]) {
      const vals = fd.getAll(key).map(String).filter(Boolean);
      if (vals.length) params.set(key, vals.join(","));
    }
    // No celular, volta ao topo: o painel fecha e os resultados aparecem logo abaixo da busca.
    router.push(`/vagas${params.size ? `?${params}` : ""}`, { scroll: !isDesktop() });
  };

  const autoApply = () => {
    if (isDesktop()) submit();
  };
  // Radix Checkbox atualiza o input oculto após o evento; aguarda o próximo frame.
  const onChange = () => requestAnimationFrame(autoApply);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filtros-vagas"
        className="flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-semibold text-petroleum lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden /> Filtros
          {count > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
              {count} <span className="sr-only">{count === 1 ? "filtro ativo" : "filtros ativos"}</span>
            </span>
          )}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <form
        ref={formRef}
        id="filtros-vagas"
        action="/vagas"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn("space-y-6 rounded-xl border bg-card p-5 lg:block", open ? "mt-2 block" : "hidden")}
        aria-label="Filtros de vagas"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-petroleum">
            <SlidersHorizontal className="size-4" aria-hidden /> Filtros
          </h2>
          <Link href="/vagas" className="text-sm font-medium text-primary hover:underline">Limpar</Link>
        </div>

        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.empresa && <input type="hidden" name="empresa" value={filters.empresa} />}

        <div className="space-y-2">
          <Label htmlFor="f-ordem" className="text-sm font-semibold text-petroleum">Ordenar por</Label>
          <select id="f-ordem" name="ordem" defaultValue={filters.ordem ?? ""} onChange={autoApply} className={selectCls}>
            <option value="">Mais recentes</option>
            <option value="relevance">Relevância</option>
            <option value="salary">Maior salário</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="f-uf" className="text-sm font-semibold text-petroleum">UF</Label>
            <select id="f-uf" name="uf" defaultValue={filters.uf ?? ""} onChange={autoApply} className={selectCls}>
              <option value="">Todas</option>
              {UFS.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-city" className="text-sm font-semibold text-petroleum">Município</Label>
            <input id="f-city" name="city" defaultValue={filters.city ?? ""} placeholder="Ex.: Recife" className={selectCls} onBlur={autoApply} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-salario" className="text-sm font-semibold text-petroleum">Salário mínimo (R$/mês)</Label>
          <select id="f-salario" name="salarioMin" defaultValue={filters.salarioMin ? String(filters.salarioMin) : ""} onChange={autoApply} className={selectCls}>
            <option value="">Qualquer</option>
            {[1500, 2500, 4000, 6000, 8000, 12000, 18000].map((v) => (
              <option key={v} value={v}>A partir de R$ {v.toLocaleString("pt-BR")}</option>
            ))}
          </select>
        </div>

        <CheckGroup name="modalidade" legend="Modalidade" options={WORK_MODEL_LABEL} selected={filters.modalidade} onChange={onChange} />
        <CheckGroup name="contrato" legend="Contratação" options={CONTRACT_TYPE_LABEL} selected={filters.contrato} onChange={onChange} />
        <CheckGroup name="senioridade" legend="Senioridade" options={SENIORITY_LABEL} selected={filters.senioridade} onChange={onChange} />

        <div className="space-y-2">
          <Label htmlFor="f-setor" className="text-sm font-semibold text-petroleum">Setor</Label>
          <select id="f-setor" name="setor" defaultValue={filters.setor ?? ""} onChange={autoApply} className={selectCls}>
            <option value="">Todos os setores</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <Button type="submit" variant="outline" className="h-9 w-full">Aplicar filtros</Button>
      </form>
    </>
  );
}
