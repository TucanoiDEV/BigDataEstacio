"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CONTRACT_TYPE_LABEL, SECTORS, SENIORITY_LABEL, UFS, WORK_MODEL_LABEL } from "@/lib/constants";
import type { JobSearch } from "@/lib/validation/search";

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

/**
 * Filtros como formulário GET comum (funciona sem JavaScript); com JS,
 * aplica automaticamente ao marcar opções.
 */
export function JobFilters({ filters }: { filters: JobSearch }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

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
    router.push(`/vagas${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  // Radix Checkbox atualiza o input oculto após o evento; aguarda o próximo frame.
  const onChange = () => requestAnimationFrame(submit);

  return (
    <form
      ref={formRef}
      action="/vagas"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6 rounded-xl border bg-card p-5"
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
        <select id="f-ordem" name="ordem" defaultValue={filters.ordem ?? ""} onChange={submit} className={selectCls}>
          <option value="">Mais recentes</option>
          <option value="relevance">Relevância</option>
          <option value="salary">Maior salário</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="f-uf" className="text-sm font-semibold text-petroleum">UF</Label>
          <select id="f-uf" name="uf" defaultValue={filters.uf ?? ""} onChange={submit} className={selectCls}>
            <option value="">Todas</option>
            {UFS.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-city" className="text-sm font-semibold text-petroleum">Município</Label>
          <input id="f-city" name="city" defaultValue={filters.city ?? ""} placeholder="Ex.: Recife" className={selectCls} onBlur={submit} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="f-salario" className="text-sm font-semibold text-petroleum">Salário mínimo (R$/mês)</Label>
        <select id="f-salario" name="salarioMin" defaultValue={filters.salarioMin ? String(filters.salarioMin) : ""} onChange={submit} className={selectCls}>
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
        <select id="f-setor" name="setor" defaultValue={filters.setor ?? ""} onChange={submit} className={selectCls}>
          <option value="">Todos os setores</option>
          {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Button type="submit" variant="outline" className="h-9 w-full">Aplicar filtros</Button>
    </form>
  );
}
