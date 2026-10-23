import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Briefcase, CalendarCheck, CheckCircle2, Clock, Inbox, PartyPopper } from "lucide-react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { ApplicationStatusBadge } from "@/components/common/application-status-badge";
import { WeeklyColumns } from "@/components/charts/weekly-columns";
import { ReverifyButton } from "@/components/company/reverify-button";
import { requireOrgPermission } from "@/server/auth/dal";
import { db } from "@/server/db";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import type { ApplicationStatus } from "@/generated/prisma/client";

export const metadata = { title: "Visão geral" };

export default function OrgDashboard(props: PageProps<"/empresa/[orgId]">) {
  return (
    <Suspense fallback={<SectionSkeleton rows={10} />}>
      <Dashboard params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

const WEEK = 7 * 86400_000;

async function Dashboard({ params, searchParams }: { params: PageProps<"/empresa/[orgId]">["params"]; searchParams: PageProps<"/empresa/[orgId]">["searchParams"] }) {
  const { orgId } = await params;
  const sp = await searchParams;
  const access = await requireOrgPermission(orgId, "org.view");
  const now = new Date();
  const since = new Date(now.getTime() - 8 * WEEK);

  const [org, activeJobs, byStatus, recentApps, last8w] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { verificationStatus: true, verificationNotes: true } }),
    db.job.count({ where: { orgId, status: "ACTIVE" } }),
    db.application.groupBy({ by: ["status"], where: { job: { orgId } }, _count: { _all: true } }),
    db.application.findMany({
      where: { job: { orgId } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, status: true, createdAt: true, profileSnapshot: true, job: { select: { title: true } } },
    }),
    db.application.findMany({ where: { job: { orgId }, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  const count = (s: ApplicationStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((a, b) => a + b._count._all, 0);
  const kpis = [
    { label: "Vagas ativas", value: activeJobs, icon: Briefcase },
    { label: "Candidaturas recebidas", value: total, icon: Inbox },
    { label: "Aguardando análise", value: count("SUBMITTED"), icon: Clock },
    { label: "Em entrevista", value: count("INTERVIEW"), icon: CalendarCheck },
    { label: "Aprovadas", value: count("APPROVED"), icon: CheckCircle2 },
  ];

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(since.getTime() + i * WEEK);
    return { start, week: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }), value: 0 };
  });
  for (const a of last8w) {
    const idx = Math.min(7, Math.floor((a.createdAt.getTime() - since.getTime()) / WEEK));
    if (idx >= 0) weeks[idx].value++;
  }
  const funnel: ApplicationStatus[] = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "APPROVED", "REJECTED", "WITHDRAWN"];
  const maxFunnel = Math.max(1, ...funnel.map(count));

  return (
    <div className="space-y-6">
      {sp.criada === "1" && (
        <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <PartyPopper className="size-5 shrink-0" aria-hidden /> Empresa cadastrada! A verificação costuma levar até 2 dias úteis. Enquanto isso, você pode criar vagas como rascunho.
        </div>
      )}
      {org.verificationStatus !== "VERIFIED" && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {org.verificationStatus === "PENDING" && "Verificação em andamento"}
                {org.verificationStatus === "REJECTED" && "Verificação recusada"}
                {org.verificationStatus === "SUSPENDED" && "Empresa suspensa"}
              </p>
              <p>Vagas só são publicadas após a verificação.{org.verificationNotes ? ` Observação da moderação: ${org.verificationNotes}` : ""}</p>
            </div>
          </div>
          {org.verificationStatus === "REJECTED" && access.membership.role !== "VIEWER" && access.membership.role !== "RECRUITER" && <ReverifyButton orgId={orgId} />}
        </div>
      )}

      <PageHeader title="Visão geral" description="Indicadores básicos do recrutamento da empresa nesta plataforma." actions={
        <Link href={`/empresa/${orgId}/vagas/nova`} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Publicar vaga</Link>
      } />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <k.icon className="size-4 text-primary" aria-hidden />
            </div>
            <p className="mt-2 text-3xl font-bold text-petroleum">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5" aria-labelledby="semanal">
          <h2 id="semanal" className="font-semibold text-petroleum">Candidaturas por semana</h2>
          <p className="mb-3 text-xs text-muted-foreground">Últimas 8 semanas</p>
          <WeeklyColumns data={weeks.map(({ week, value }) => ({ week, value }))} label="Candidaturas" />
        </section>
        <section className="rounded-xl border bg-card p-5" aria-labelledby="funil">
          <h2 id="funil" className="mb-4 font-semibold text-petroleum">Etapas das candidaturas</h2>
          <ul className="space-y-3">
            {funnel.map((s) => (
              <li key={s} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{APPLICATION_STATUS_LABEL[s]}</span>
                <span className="h-2.5 rounded-full bg-muted" aria-hidden>
                  <span className="block h-2.5 rounded-full bg-[var(--chart-1)]" style={{ width: `${(count(s) / maxFunnel) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{count(s)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border bg-card p-5" aria-labelledby="ultimas">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="ultimas" className="font-semibold text-petroleum">Candidaturas recentes</h2>
          <Link href={`/empresa/${orgId}/vagas`} className="text-sm font-medium text-primary hover:underline">Ver por vaga</Link>
        </div>
        {recentApps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma candidatura recebida ainda.</p>
        ) : (
          <ul className="divide-y">
            {recentApps.map((a) => {
              const snap = a.profileSnapshot as { name?: string; headline?: string };
              return (
                <li key={a.id}>
                  <Link href={`/empresa/${orgId}/candidaturas/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{snap.name ?? "Candidato(a)"}</p>
                      <p className="truncate text-sm text-muted-foreground">{a.job.title} · {formatRelative(a.createdAt, now)}</p>
                    </div>
                    <ApplicationStatusBadge status={a.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
