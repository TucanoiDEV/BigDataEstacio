import { Suspense } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton, StatusBadge } from "@/components/common/states";
import { ReportDecision } from "@/components/admin/controls";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Denúncias" };

const REASON = { SCAM: "Possível golpe", PAYMENT_REQUEST: "Cobrança de taxa", MISLEADING: "Enganosa", DISCRIMINATORY: "Discriminatória", DUPLICATE: "Duplicada", OTHER: "Outro" } as const;

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Denúncias" description="A identidade de quem denunciou nunca é revelada à empresa." />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await requirePlatformAdmin();
  const reports = await db.report.findMany({
    where: { status: { in: ["OPEN", "REVIEWING"] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { job: { select: { id: true, title: true, status: true } }, org: { select: { tradeName: true } } },
  });
  if (!reports.length) return <EmptyState icon={Flag} title="Nenhuma denúncia aberta" />;
  return (
    <ul className="space-y-4">
      {reports.map((r) => (
        <li key={r.id} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{REASON[r.reason]}: {r.org?.tradeName}</p>
            <StatusBadge tone={r.status === "OPEN" ? "amber" : "blue"}>{r.status === "OPEN" ? "Aberta" : "Em análise"}</StatusBadge>
          </div>
          {r.job && (
            <p className="text-sm text-muted-foreground">
              Vaga: <Link href={`/admin/vagas?id=${r.job.id}`} className="text-primary hover:underline">{r.job.title}</Link> ({r.job.status}) · {formatDateTime(r.createdAt)}
            </p>
          )}
          <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{r.details}</p>
          <div className="mt-4"><ReportDecision reportId={r.id} /></div>
        </li>
      ))}
    </ul>
  );
}
