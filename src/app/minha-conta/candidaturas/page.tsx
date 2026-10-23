import { Suspense } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { ApplicationStatusBadge } from "@/components/common/application-status-badge";
import { requireUser } from "@/server/auth/dal";
import { listCandidateApplications } from "@/server/services/applications";
import { WORK_MODEL_LABEL } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/format";

export const metadata = { title: "Candidaturas" };

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Minhas candidaturas" description="Acompanhe cada etapa: Enviada, Em análise, Entrevista, Aprovada, Recusada ou Retirada." />
      <Suspense fallback={<SectionSkeleton rows={5} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUser({ returnTo: "/minha-conta/candidaturas" });
  const apps = await listCandidateApplications(user.id);
  const now = new Date();
  if (!apps.length) return <EmptyState icon={Send} title="Nenhuma candidatura ainda" description="Quando você se candidatar, o andamento aparecerá aqui." action={{ href: "/vagas", label: "Explorar vagas" }} />;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de candidaturas</caption>
        <thead className="hidden bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground md:table-header-group">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Vaga</th>
            <th scope="col" className="px-4 py-3 font-medium">Enviada em</th>
            <th scope="col" className="px-4 py-3 font-medium">Última atualização</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {apps.map((a) => (
            <tr key={a.id} className="flex flex-col gap-1 px-4 py-3 md:table-row md:p-0">
              <td className="md:px-4 md:py-3">
                <Link href={`/minha-conta/candidaturas/${a.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{a.job.title}</Link>
                <p className="text-muted-foreground">{a.job.org.tradeName} · {a.job.workModel === "REMOTE" ? WORK_MODEL_LABEL.REMOTE : [a.job.city, a.job.state].filter(Boolean).join("/")}</p>
              </td>
              <td className="text-muted-foreground md:px-4 md:py-3">{formatDate(a.createdAt)}</td>
              <td className="text-muted-foreground md:px-4 md:py-3">{formatRelative(a.updatedAt, now)}</td>
              <td className="md:px-4 md:py-3"><ApplicationStatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
