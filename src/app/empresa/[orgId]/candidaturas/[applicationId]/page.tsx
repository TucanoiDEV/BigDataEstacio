import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, FileWarning, Lock, Mail, MapPin, Phone } from "lucide-react";
import { SectionSkeleton } from "@/components/common/states";
import { ApplicationStatusBadge } from "@/components/common/application-status-badge";
import { StatusChangeForm } from "@/components/company/status-change-form";
import { requireOrgPermission } from "@/server/auth/dal";
import { roleCan } from "@/server/authz/permissions";
import { getOrgApplication, type ProfileSnapshot } from "@/server/services/applications";
import { isDownloadable } from "@/server/storage/files";
import { APPLICATION_STATUS_LABEL } from "@/lib/constants";
import { companyNextStatuses } from "@/lib/application-status";
import { formatDateTime } from "@/lib/format";
import { paragraphs } from "@/lib/text";

export const metadata = { title: "Candidatura" };

export default function OrgApplicationPage(props: PageProps<"/empresa/[orgId]/candidaturas/[applicationId]">) {
  return (
    <Suspense fallback={<SectionSkeleton rows={12} />}>
      <Detail params={props.params} />
    </Suspense>
  );
}

function ym(v: string | null) {
  if (!v) return "";
  const [y, m] = v.split("-");
  return `${m}/${y}`;
}

async function Detail({ params }: { params: PageProps<"/empresa/[orgId]/candidaturas/[applicationId]">["params"] }) {
  const { orgId, applicationId } = await params;
  const access = await requireOrgPermission(orgId, "applications.view");
  const app = await getOrgApplication(access, applicationId);
  if (!app) notFound();
  const s = app.profileSnapshot as unknown as ProfileSnapshot & { removed?: boolean };
  const canUpdate = roleCan(access.membership.role, "applications.update");
  const next = companyNextStatuses(app.status).filter((x) => x !== "WITHDRAWN");

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/empresa/${orgId}/vagas/${app.job.id}`} className="hover:underline">{app.job.title}</Link> / candidatura
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-petroleum">{s.removed ? "Dados removidos pelo titular" : s.name}</h1>
            <ApplicationStatusBadge status={app.status} />
          </div>
          {!s.removed && <p className="text-muted-foreground">{s.headline}</p>}
        </div>

        {s.removed ? (
          <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">O(a) candidato(a) excluiu a conta. Os dados compartilhados foram removidos da plataforma.</div>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-6" aria-labelledby="contato">
              <h2 id="contato" className="font-semibold text-petroleum">Contato e localização</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" aria-hidden />{[s.city, s.state].filter(Boolean).join(" – ") || "Não informado"}</li>
                <li className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" aria-hidden />{s.email ?? <span className="text-muted-foreground">E-mail não compartilhado</span>}</li>
                <li className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" aria-hidden />{s.phone ?? <span className="text-muted-foreground">Telefone não compartilhado</span>}</li>
                {s.linkedinUrl && <li><a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">LinkedIn <ExternalLink className="size-3.5" aria-hidden /></a></li>}
                {s.portfolioUrl && <li><a href={s.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">Portfólio <ExternalLink className="size-3.5" aria-hidden /></a></li>}
              </ul>
            </section>

            {app.coverLetter && (
              <section className="rounded-2xl border bg-card p-6" aria-labelledby="mensagem">
                <h2 id="mensagem" className="font-semibold text-petroleum">Mensagem do(a) candidato(a)</h2>
                <div className="mt-2 space-y-2 text-sm">{paragraphs(app.coverLetter).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
              </section>
            )}

            <section className="rounded-2xl border bg-card p-6" aria-labelledby="perfil">
              <h2 id="perfil" className="font-semibold text-petroleum">Perfil</h2>
              {s.about && <div className="mt-2 space-y-2 text-sm">{paragraphs(s.about).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
              {s.skills.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">{s.skills.map((k) => <li key={k} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{k}</li>)}</ul>
              )}
              <h3 className="mt-6 text-sm font-semibold">Experiências</h3>
              {s.experiences.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma informada.</p> : (
                <ul className="mt-2 space-y-3">
                  {s.experiences.map((e, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium">{e.title} · {e.company}</p>
                      <p className="text-xs text-muted-foreground">{ym(e.startDate)} – {e.isCurrent ? "atual" : ym(e.endDate)}</p>
                      {e.description && <p className="mt-1 whitespace-pre-line text-muted-foreground">{e.description}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-6 text-sm font-semibold">Formação</h3>
              {s.educations.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma informada.</p> : (
                <ul className="mt-2 space-y-2 text-sm">
                  {s.educations.map((e, i) => <li key={i}><span className="font-medium">{e.degree}</span>{e.field ? ` — ${e.field}` : ""} · {e.institution} {e.inProgress ? "(em andamento)" : e.endDate ? `(${ym(e.endDate)})` : ""}</li>)}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">Recorte do perfil compartilhado pelo(a) candidato(a) em {formatDateTime(s.capturedAt)}.</p>
            </section>
          </>
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold text-petroleum">Currículo</h2>
          {app.resume ? (
            isDownloadable(app.resume.file.scanStatus) ? (
              <a href={`/api/arquivos/${app.resume.fileId}`} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
                <Download className="size-4" aria-hidden /> Baixar {app.resume.label} ({Math.round(app.resume.file.sizeBytes / 1024)} KB)
              </a>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><FileWarning className="size-4" aria-hidden /> Arquivo indisponível (verificação de segurança).</p>
            )
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Candidatura enviada sem currículo.</p>
          )}
          <p className="mt-3 flex gap-1.5 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Downloads são registrados. Use os dados apenas para este processo seletivo, conforme os Termos de Uso.</p>
        </section>

        {canUpdate && next.length > 0 && (
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold text-petroleum">Mover candidatura</h2>
            <StatusChangeForm orgId={orgId} applicationId={app.id} options={next.map((v) => ({ value: v, label: APPLICATION_STATUS_LABEL[v] }))} />
          </section>
        )}

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold text-petroleum">Histórico</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {app.history.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/40 pl-3">
                <p className="font-medium">{h.fromStatus ? `${APPLICATION_STATUS_LABEL[h.fromStatus]} → ` : ""}{APPLICATION_STATUS_LABEL[h.toStatus]}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}{h.changedBy ? ` · ${h.changedBy.name}` : ""}</p>
                {h.messageToCandidate && <p className="mt-1 text-xs">Mensagem enviada: {h.messageToCandidate}</p>}
                {h.internalNote && <p className="mt-1 rounded bg-amber-50 p-1.5 text-xs text-amber-950">Nota interna: {h.internalNote}</p>}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
