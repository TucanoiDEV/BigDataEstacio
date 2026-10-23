import { Suspense } from "react";
import { Database } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { DatasetControls } from "@/components/admin/controls";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const metadata = { title: "Dados oficiais" };

export default function AdminDataPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importações de dados oficiais"
        description={<>Importações são executadas pelo pipeline (<code>data-pipeline/</code>) — nunca pela interface web. Revise os números de validação antes de publicar no observatório.</>}
      />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requirePlatformAdmin();
  const [datasets, imports] = await Promise.all([
    db.statDataset.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { flows: true, indicators: true, stocks: true } }, import: { select: { rowsRead: true, rowsValid: true, rowsRejected: true } } } }),
    db.dataImport.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-8">
      <section aria-labelledby="ds" className="space-y-3">
        <h2 id="ds" className="font-semibold text-petroleum">Conjuntos de dados</h2>
        {datasets.length === 0 ? <EmptyState icon={Database} title="Nenhum conjunto importado" description="Rode o pipeline: python -m emprego_pipeline ibge / pnad / caged." /> : (
          <ul className="space-y-3">
            {datasets.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-muted-foreground">
                    {d.source} · referência {formatDate(d.referenceStart)} a {formatDate(d.referenceEnd)} · {formatNumber(d._count.flows + d._count.indicators + d._count.stocks)} registros agregados
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Linhas lidas {formatNumber(d.import.rowsRead)} · válidas {formatNumber(d.import.rowsValid)} · rejeitadas {formatNumber(d.import.rowsRejected)}
                    {d.import.rowsRead > 0 && ` (${((d.import.rowsRejected / d.import.rowsRead) * 100).toFixed(3)}%)`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge tone={d.status === "PUBLISHED" ? "green" : d.status === "STAGED" ? "amber" : "gray"}>
                    {d.status === "PUBLISHED" ? "Publicado" : d.status === "STAGED" ? "Em revisão" : "Arquivado"}
                  </StatusBadge>
                  <DatasetControls datasetId={d.id} status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="imp" className="space-y-3">
        <h2 id="imp" className="font-semibold text-petroleum">Execuções do pipeline</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2" scope="col">Início</th><th className="px-3 py-2" scope="col">Fonte</th><th className="px-3 py-2" scope="col">Descrição</th><th className="px-3 py-2" scope="col">Status</th><th className="px-3 py-2" scope="col">Arquivos</th></tr>
            </thead>
            <tbody className="divide-y">
              {imports.map((i) => {
                const files = Array.isArray(i.files) ? (i.files as { name: string; sha256: string }[]) : [];
                return (
                  <tr key={i.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(i.startedAt)}</td>
                    <td className="px-3 py-2">{i.source}</td>
                    <td className="px-3 py-2">{i.description}{i.errorSummary && <p className="mt-1 text-xs text-destructive">{i.errorSummary.slice(0, 300)}</p>}</td>
                    <td className="px-3 py-2"><StatusBadge tone={i.status === "SUCCEEDED" ? "green" : i.status === "FAILED" ? "red" : "amber"}>{i.status}</StatusBadge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{files.length} arquivo(s){files[0] ? ` · ex.: ${files[0].name} (${files[0].sha256.slice(0, 10)}…)` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
