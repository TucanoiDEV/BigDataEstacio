import { Suspense } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { JobStatusBadge } from "@/components/common/application-status-badge";
import { JobLifecycleMenu } from "@/components/company/job-lifecycle-menu";
import { requireOrgPermission } from "@/server/auth/dal";
import { roleCan } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Vagas" };

export default function OrgJobsPage(props: PageProps<"/empresa/[orgId]/vagas">) {
  return (
    <Suspense fallback={<SectionSkeleton rows={8} />}>
      <List params={props.params} />
    </Suspense>
  );
}

async function List({ params }: { params: PageProps<"/empresa/[orgId]/vagas">["params"] }) {
  const { orgId } = await params;
  const access = await requireOrgPermission(orgId, "jobs.view");
  const canManage = roleCan(access.membership.role, "jobs.manage");
  const jobs = await db.job.findMany({
    where: { orgId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      fraudSignals: true,
      moderationNotes: true,
      _count: { select: { applications: true } },
      applications: { where: { status: "SUBMITTED" }, select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vagas e candidaturas"
        description="Gerencie o ciclo de cada vaga: rascunho, publicação, pausa e encerramento."
        actions={canManage ? <Link href={`/empresa/${orgId}/vagas/nova`} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Nova vaga</Link> : undefined}
      />
      {jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="Nenhuma vaga criada" description="Crie sua primeira vaga. Ela pode ficar como rascunho até a empresa ser verificada." action={canManage ? { href: `/empresa/${orgId}/vagas/nova`, label: "Criar vaga" } : undefined} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/empresa/${orgId}/vagas/${j.id}`} className="font-medium hover:text-primary hover:underline">{j.title}</Link>
                  <JobStatusBadge status={j.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {j._count.applications} candidatura(s){j.applications.length ? ` · ${j.applications.length} nova(s)` : ""} · {j.publishedAt ? `publicada em ${formatDate(j.publishedAt)}` : `atualizada em ${formatDate(j.updatedAt)}`}
                </p>
                {j.status === "PENDING_REVIEW" && <p className="text-xs text-amber-800">Em moderação: a vaga contém termos que exigem revisão humana antes da publicação.</p>}
                {j.status === "REMOVED" && j.moderationNotes && <p className="text-xs text-destructive">Removida pela moderação: {j.moderationNotes}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/empresa/${orgId}/vagas/${j.id}`} className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">Candidaturas</Link>
                {canManage && <JobLifecycleMenu orgId={orgId} jobId={j.id} status={j.status} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
