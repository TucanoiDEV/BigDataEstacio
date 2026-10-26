import { BookOpen } from "lucide-react";
import type { PublishedDataset } from "@/server/services/observatory";
import { formatDateTime, formatMonth, formatQuarter } from "@/lib/format";

const SOURCE_NAME = { NOVO_CAGED: "Novo CAGED, Ministério do Trabalho e Emprego (PDET)", RAIS: "RAIS, Ministério do Trabalho e Emprego", IBGE: "IBGE" } as const;

/** Bloco obrigatório de procedência: fonte, referência, atualização e metodologia. */
export function SourceNote({ dataset }: { dataset: PublishedDataset }) {
  return (
    <aside className="rounded-2xl border border-dashed bg-muted/40 p-5 text-sm" aria-label={`Fonte e metodologia: ${dataset.title}`}>
      <h3 className="flex items-center gap-2 font-semibold text-petroleum"><BookOpen className="size-4" aria-hidden /> Fonte e metodologia</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Fonte</dt><dd>{SOURCE_NAME[dataset.source]}: {dataset.title}</dd></div>
        <div>
          <dt className="text-xs text-muted-foreground">Período de referência</dt>
          <dd>{dataset.source === "IBGE" ? `${formatQuarter(dataset.referenceStart)} a ${formatQuarter(dataset.referenceEnd)}` : `${formatMonth(dataset.referenceStart)} a ${formatMonth(dataset.referenceEnd)}`}</dd>
        </div>
        <div><dt className="text-xs text-muted-foreground">Importado em</dt><dd>{dataset.import.finishedAt ? formatDateTime(dataset.import.finishedAt) : "-"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Publicado no observatório</dt><dd>{dataset.publishedAt ? formatDateTime(dataset.publishedAt) : "-"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Metodologia</dt><dd className="text-muted-foreground">{dataset.methodologyNotes}</dd></div>
        <div className="sm:col-span-2 flex flex-wrap gap-x-4 gap-y-1">
          <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Página oficial da fonte</a>
          {dataset.methodologyUrl.startsWith("http") ? (
            <a href={dataset.methodologyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Documentação metodológica</a>
          ) : (
            <span className="break-all text-muted-foreground">Documentação: {dataset.methodologyUrl}</span>
          )}
          <span className="text-muted-foreground">{dataset.license}</span>
        </div>
      </dl>
    </aside>
  );
}
