import { Suspense } from "react";
import Link from "next/link";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { requirePlatformAdmin } from "@/server/auth/dal";
import { db } from "@/server/db";
import { requestNow } from "@/server/time";

export const metadata = { title: "Visão geral" };

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administração da plataforma" title="Visão geral" description="Filas de moderação, privacidade e segurança. Todas as ações são registradas na auditoria." />
      <Suspense fallback={<SectionSkeleton rows={6} />}>
        <Counters />
      </Suspense>
    </div>
  );
}

async function Counters() {
  await requirePlatformAdmin();
  const now = await requestNow();
  const soon = new Date(now.getTime() + 3 * 86400_000);
  const [orgs, jobs, reports, privacy, privacyDue, incidents, users, activeJobs, staged] = await Promise.all([
    db.organization.count({ where: { verificationStatus: "PENDING" } }),
    db.job.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.privacyRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.privacyRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lte: soon } } }),
    db.securityIncident.count({ where: { status: { not: "RESOLVED" } } }),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.job.count({ where: { status: "ACTIVE" } }),
    db.statDataset.count({ where: { status: "STAGED" } }),
  ]);
  const cards = [
    { label: "Empresas aguardando verificação", value: orgs, href: "/admin/empresas", urgent: orgs > 0 },
    { label: "Vagas em moderação", value: jobs, href: "/admin/vagas", urgent: jobs > 0 },
    { label: "Denúncias abertas", value: reports, href: "/admin/denuncias", urgent: reports > 0 },
    { label: "Solicitações LGPD abertas", value: privacy, href: "/admin/privacidade", urgent: privacyDue > 0, note: privacyDue ? `${privacyDue} vencem em até 3 dias` : undefined },
    { label: "Incidentes não resolvidos", value: incidents, href: "/admin/incidentes", urgent: incidents > 0 },
    { label: "Conjuntos de dados aguardando publicação", value: staged, href: "/admin/dados", urgent: false },
    { label: "Usuários ativos", value: users, href: "/admin/usuarios", urgent: false },
    { label: "Vagas publicadas", value: activeJobs, href: "/admin/vagas", urgent: false },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className={`rounded-xl border bg-card p-5 hover:shadow-sm ${c.urgent ? "border-amber-300" : ""}`}>
          <p className="text-sm text-muted-foreground">{c.label}</p>
          <p className="mt-2 text-3xl font-bold text-petroleum">{c.value}</p>
          {c.note && <p className="mt-1 text-xs font-medium text-amber-800">{c.note}</p>}
        </Link>
      ))}
    </div>
  );
}
