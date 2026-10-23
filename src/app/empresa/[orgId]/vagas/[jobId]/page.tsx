import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Info, MapPin } from "lucide-react";
import { SectionSkeleton } from "@/components/common/states";
import { JobStatusBadge } from "@/components/common/application-status-badge";
import { JobLifecycleMenu } from "@/components/company/job-lifecycle-menu";
import { requireOrgPermission } from "@/server/auth/dal";
import { roleCan } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { listJobApplications, type ProfileSnapshot } from "@/server/services/applications";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { FRAUD_SIGNAL_LABEL, type FraudSignal } from "@/lib/fraud";
import { formatRelative } from "@/lib/format";
import { initials } from "@/lib/text";
import type { ApplicationStatus } from "@/generated/prisma/client";

export const metadata = { title: "Candidaturas da vaga" };

const COLUMNS: { status: ApplicationStatus; hint: string; accent: string }[] = [
  { status: "SUBMITTED", hint: "Recebidas, ainda não analisadas", accent: "border-t-sky-500" },
  { status: "IN_REVIEW", hint: "Em análise pelo time", accent: "border-t-amber-500" },
  { status: "INTERVIEW", hint: "Em etapa de entrevista", accent: "border-t-violet-500" },
  { status: "APPROVED", hint: "Aprovadas", accent: "border-t-emerald-600" },
  { status: "REJECTED", hint: "Não seguiram no processo", accent: "border-t-slate-400" },
  { status: "WITHDRAWN", hint: "Retiradas pelo candidato", accent: "border-t-slate-300" },
];

export default function JobPipelinePage(props: PageProps<"/empresa/[orgId]/vagas/[jobId]">) {
  return (
    <Suspense fallback={<SectionSkeleton rows={10} />}>
      <Pipeline params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Pipeline({ params, searchParams }: { params: PageProps<"/empresa/[orgId]/vagas/[jobId]">["params"]; searchParams: PageProps<"/empresa/[orgId]/vagas/[jobId]">["searchParams"] }) {
  const { orgId, jobId } = await params;
  const sp = await searchParams;
  const access = await requireOrgPermission(orgId, "applications.view");
  const job = await db.job.findFirst({ where: { id: jobId, orgId }, select: { id: true, title: true, status: true, fraudSignals: true, city: true, state: true, workModel: true } });
  if (!job) notFound();
  const apps = await listJobApplications(access, jobId);
  const now = new Date();

  return (
    <div className="space-y-6">
      {sp.status === "ACTIVE" && <Notice ok>Vaga publicada e visível na busca.</Notice>}
      {sp.status === "DRAFT" && <Notice>Rascunho salvo. Publique quando estiver pronto(a).</Notice>}
      {sp.status === "PENDING_REVIEW" && (
        <Notice>
          A vaga foi retida para revisão humana pelos motivos:{" "}
          {(job.fraudSignals as FraudSignal[]).map((s) => FRAUD_SIGNAL_LABEL[s] ?? s).join("; ")}. Você será notificado(a) do resultado.
        </Notice>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground"><Link href={`/empresa/${orgId}/vagas`} className="hover:underline">Vagas</Link> / candidaturas</p>
          <h1 className="text-2xl font-bold text-petroleum">{job.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <JobStatusBadge status={job.status} />
            <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{job.workModel === "REMOTE" ? "Remoto" : [job.city, job.state].filter(Boolean).join("/")}</span>
            <span>· {apps.length} candidatura(s)</span>
          </div>
        </div>
        {roleCan(access.membership.role, "jobs.manage") && <JobLifecycleMenu orgId={orgId} jobId={job.id} status={job.status} />}
      </div>

      <p className="text-sm text-muted-foreground">
        Abra uma candidatura para analisar o perfil, baixar o currículo e mover para a próxima etapa. O(a) candidato(a) é notificado(a) a cada mudança.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        <div className="grid min-w-[72rem] grid-cols-6 gap-3">
          {COLUMNS.map((col) => {
            const items = apps.filter((a) => a.status === col.status);
            return (
              <section key={col.status} className={`rounded-xl border border-t-4 bg-muted/40 p-3 ${col.accent}`} aria-labelledby={`col-${col.status}`}>
                <div className="mb-1 flex items-center justify-between">
                  <h2 id={`col-${col.status}`} className="text-xs font-bold uppercase tracking-wide text-petroleum">{APPLICATION_STATUS_LABEL[col.status]}</h2>
                  <span className="rounded-full bg-card px-2 text-xs font-semibold tabular-nums">{items.length}</span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{col.hint}</p>
                <ul className="space-y-2">
                  {items.map((a) => {
                    const s = a.profileSnapshot as unknown as ProfileSnapshot;
                    return (
                      <li key={a.id}>
                        <Link href={`/empresa/${orgId}/candidaturas/${a.id}`} className="block rounded-lg border bg-card p-3 hover:border-primary/50 hover:shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground" aria-hidden>{initials(s.name ?? "?")}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{s.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.headline ?? "Sem título profissional"}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{[s.city, s.state].filter(Boolean).join("/") || "Local não informado"} · {formatRelative(a.createdAt, now)}</p>
                          {a.resumeId && <p className="mt-1 text-xs font-medium text-primary">Currículo anexado</p>}
                        </Link>
                      </li>
                    );
                  })}
                  {items.length === 0 && <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Vazio</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Notice({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <div role="status" className={`flex gap-3 rounded-xl border p-4 text-sm ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      {ok ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <Info className="size-5 shrink-0" aria-hidden />}
      <p>{children}</p>
    </div>
  );
}
