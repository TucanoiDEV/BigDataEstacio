import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, MessageSquare, PartyPopper, XCircle } from "lucide-react";
import { SectionSkeleton } from "@/components/common/states";
import { ApplicationStatusBadge } from "@/components/common/application-status-badge";
import { WithdrawButton } from "@/components/candidate/withdraw-button";
import { requireUser } from "@/server/auth/dal";
import { getCandidateApplication } from "@/server/services/applications";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { PIPELINE_STEPS, candidateCanWithdraw } from "@/lib/application-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Candidatura" };

export default function ApplicationDetailPage(props: PageProps<"/minha-conta/candidaturas/[id]">) {
  return (
    <Suspense fallback={<SectionSkeleton rows={8} />}>
      <Detail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Detail({ params, searchParams }: { params: PageProps<"/minha-conta/candidaturas/[id]">["params"]; searchParams: PageProps<"/minha-conta/candidaturas/[id]">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser({ returnTo: `/minha-conta/candidaturas/${id}` });
  const app = await getCandidateApplication(user.id, id);
  if (!app) notFound();

  const reached = new Set(app.history.map((h) => h.toStatus));
  const final = app.status === "REJECTED" || app.status === "WITHDRAWN";
  const messages = app.history.filter((h) => h.messageToCandidate);

  return (
    <div className="space-y-6">
      {sp.enviada === "1" && (
        <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <PartyPopper className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Candidatura enviada!</p>
            <p className="text-sm">Você será avisado(a) por aqui{" "}e por e-mail (se ativado) quando a empresa atualizar o status.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Candidatura para</p>
          <h1 className="text-2xl font-bold text-petroleum">
            <Link href={`/vagas/${app.job.id}`} className="hover:underline">{app.job.title}</Link>
          </h1>
          <p className="text-muted-foreground">{app.job.org.tradeName}</p>
          <p className="mt-2 text-sm text-muted-foreground">Enviada em {formatDateTime(app.createdAt)}{app.resume ? ` · Currículo: ${app.resume.label}` : " · Sem currículo anexado"}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <ApplicationStatusBadge status={app.status} />
          {candidateCanWithdraw(app.status) && <WithdrawButton applicationId={app.id} />}
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-6" aria-labelledby="etapas">
        <h2 id="etapas" className="mb-5 font-semibold text-petroleum">Etapas</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {PIPELINE_STEPS.map((step) => {
            const done = reached.has(step);
            const current = app.status === step;
            return (
              <li key={step} className="flex items-center gap-3 sm:flex-col sm:text-center">
                {done ? (
                  <CheckCircle2 className={cn("size-7", current ? "text-primary" : "text-emerald-400")} aria-hidden />
                ) : (
                  <Circle className="size-7 text-muted-foreground/40" aria-hidden />
                )}
                <span className={cn("text-sm", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {APPLICATION_STATUS_LABEL[step]}
                  <span className="sr-only">{done ? " (concluída)" : " (pendente)"}{current ? " — etapa atual" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
        {final && (
          <p className="mt-5 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
            <XCircle className="size-4 text-muted-foreground" aria-hidden />
            Processo encerrado: {APPLICATION_STATUS_LABEL[app.status]}.
          </p>
        )}
      </section>

      {messages.length > 0 && (
        <section className="rounded-2xl border bg-card p-6" aria-labelledby="mensagens">
          <h2 id="mensagens" className="mb-4 flex items-center gap-2 font-semibold text-petroleum"><MessageSquare className="size-4" aria-hidden /> Mensagens da empresa</h2>
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="whitespace-pre-line">{m.messageToCandidate}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(m.createdAt)} · {APPLICATION_STATUS_LABEL[m.toStatus]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-6" aria-labelledby="historico">
        <h2 id="historico" className="mb-4 font-semibold text-petroleum">Histórico</h2>
        <ol className="relative space-y-4 border-l pl-5">
          {app.history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-card bg-primary" aria-hidden />
              <p className="text-sm font-medium">{h.fromStatus ? `${APPLICATION_STATUS_LABEL[h.fromStatus]} → ` : ""}{APPLICATION_STATUS_LABEL[h.toStatus]}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
