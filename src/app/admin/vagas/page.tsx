import { Suspense } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { JobStatusBadge } from "@/components/common/application-status-badge";
import { JobDecision } from "@/components/admin/controls";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { FRAUD_SIGNAL_LABEL, type FraudSignal } from "@/lib/fraud";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Moderação de vagas" };

export default function AdminJobsPage(props: PageProps<"/admin/vagas">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Moderação de vagas" description="Vagas retidas por sinais automáticos de fraude aguardam revisão humana. Também é possível remover qualquer vaga publicada." />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/vagas">["searchParams"] }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const id = typeof sp.id === "string" && /^[a-z0-9]{20,40}$/i.test(sp.id) ? sp.id : undefined;
  const view = sp.ver === "publicadas" ? "ACTIVE" : "PENDING_REVIEW";
  const jobs = await db.job.findMany({
    where: id ? { id } : { status: view },
    orderBy: { updatedAt: "asc" },
    take: 50,
    include: { org: { select: { tradeName: true, verificationStatus: true } }, _count: { select: { reports: true } } },
  });
  return (
    <div className="space-y-4">
      <nav className="flex gap-2" aria-label="Filas">
        <Link href="/admin/vagas" aria-current={view === "PENDING_REVIEW" ? "page" : undefined} className={`rounded-full border px-3 py-1 text-sm ${view === "PENDING_REVIEW" && !id ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>Em moderação</Link>
        <Link href="/admin/vagas?ver=publicadas" aria-current={view === "ACTIVE" ? "page" : undefined} className={`rounded-full border px-3 py-1 text-sm ${view === "ACTIVE" && !id ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>Publicadas</Link>
      </nav>
      {jobs.length === 0 ? <EmptyState icon={Briefcase} title="Nenhuma vaga nesta fila" /> : (
        <ul className="space-y-4">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{j.title}</p>
                  <p className="text-sm text-muted-foreground">{j.org.tradeName} · atualizada em {formatDate(j.updatedAt)} · {j._count.reports} denúncia(s)</p>
                </div>
                <JobStatusBadge status={j.status} />
              </div>
              {j.fraudSignals.length > 0 && (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
                  {(j.fraudSignals as FraudSignal[]).map((s) => <li key={s}>{FRAUD_SIGNAL_LABEL[s] ?? s}</li>)}
                </ul>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-primary">Ver texto do anúncio</summary>
                <div className="mt-2 space-y-2 whitespace-pre-line rounded-lg bg-muted/50 p-3">
                  <p>{j.description}</p>
                  {j.requirements && <p>{j.requirements}</p>}
                  {j.benefits && <p>{j.benefits}</p>}
                </div>
              </details>
              <div className="mt-4"><JobDecision jobId={j.id} status={j.status} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
