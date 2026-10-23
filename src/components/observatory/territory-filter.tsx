"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";

const cls = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Filtro territorial (Brasil → UF → município). Formulário GET: funciona sem JavaScript. */
export function TerritoryFilter(props: { ufs: { code: string; name: string }[]; municipalities: { code: string; name: string }[]; uf: string | null; mun: string | null }) {
  const router = useRouter();
  const go = (uf: string, mun?: string) => {
    const p = new URLSearchParams();
    if (uf) p.set("uf", uf);
    if (mun) p.set("mun", mun);
    router.push(`/mercado-de-trabalho${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  return (
    <form action="/mercado-de-trabalho" method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Filtro territorial">
      <div className="space-y-1.5">
        <Label htmlFor="obs-uf">Unidade da Federação</Label>
        <select id="obs-uf" name="uf" defaultValue={props.uf ?? ""} className={cls} onChange={(e) => go(e.target.value)}>
          <option value="">Brasil (todas as UFs)</option>
          {props.ufs.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="obs-mun">Município</Label>
        <select id="obs-mun" name="mun" defaultValue={props.mun ?? ""} disabled={!props.uf} className={cls} onChange={(e) => go(props.uf ?? "", e.target.value)}>
          <option value="">{props.uf ? "Todos os municípios da UF" : "Selecione uma UF primeiro"}</option>
          {props.municipalities.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
        </select>
      </div>
      <button type="submit" className="h-10 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted">Aplicar</button>
    </form>
  );
}
