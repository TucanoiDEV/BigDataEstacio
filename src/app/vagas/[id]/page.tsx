import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, ExternalLink, MapPin, ShieldAlert, Sparkles, Users, Wallet } from "lucide-react";
import { OrgLogo } from "@/components/jobs/org-logo";
import { JobTag } from "@/components/jobs/job-card";
import { SaveJobButton } from "@/components/jobs/save-job-button";
import { ReportDialog } from "@/components/jobs/report-dialog";
import { SectionSkeleton } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getPublicJob } from "@/server/services/jobs";
import { explainJobForUser } from "@/server/services/recommendations";
import { CONTRACT_TYPE_LABEL, SENIORITY_LABEL, WORK_MODEL_LABEL } from "@/lib/constants";
import { formatDate, formatRelative, formatSalaryRange } from "@/lib/format";
import { paragraphs } from "@/lib/text";

export async function generateMetadata(props: PageProps<"/vagas/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const job = await getPublicJob(id);
  if (!job) return { title: "Vaga não encontrada", robots: { index: false } };
  const where = job.workModel === "REMOTE" ? "Remoto" : [job.city, job.state].filter(Boolean).join("/");
  return {
    title: `${job.title} — ${job.org.tradeName}`,
    description: `${job.title} em ${job.org.tradeName} (${where}). ${CONTRACT_TYPE_LABEL[job.contractType]}, ${WORK_MODEL_LABEL[job.workModel]}.`,
    alternates: { canonical: `/vagas/${job.id}` },
    robots: job.status === "ACTIVE" ? undefined : { index: false },
  };
}

export default function JobPage(props: PageProps<"/vagas/[id]">) {
  return (
    <div className="container-page py-8 lg:py-10">
      <Suspense fallback={<JobSkeleton />}>
        <JobContent params={props.params} />
      </Suspense>
    </div>
  );
}

const CONTRACT_SCHEMA: Record<string, string> = {
  CLT: "FULL_TIME",
  PJ: "CONTRACTOR",
  INTERNSHIP: "INTERN",
  TEMPORARY: "TEMPORARY",
  APPRENTICE: "OTHER",
  FREELANCE: "CONTRACTOR",
};

/** Dados estruturados JobPosting — somente para vagas reais e ativas (nunca as de demonstração). */
function JobPostingJsonLd({ job }: { job: NonNullable<Awaited<ReturnType<typeof getPublicJob>>> }) {
  if (job.status !== "ACTIVE" || !job.publishedAt || job.org.isDemo) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [job.description, job.requirements, job.benefits].filter(Boolean).join("\n\n"),
    datePosted: job.publishedAt.toISOString(),
    ...(job.closesAt ? { validThrough: job.closesAt.toISOString() } : {}),
    employmentType: CONTRACT_SCHEMA[job.contractType],
    hiringOrganization: { "@type": "Organization", name: job.org.tradeName, ...(job.org.website ? { sameAs: job.org.website } : {}) },
    ...(job.workModel === "REMOTE"
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "BR" } }
      : {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: job.city, addressRegion: job.state, addressCountry: "BR" },
          },
        }),
    ...(job.salaryVisible && (job.salaryMin || job.salaryMax)
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "BRL",
            value: { "@type": "QuantitativeValue", minValue: job.salaryMin ?? job.salaryMax, maxValue: job.salaryMax ?? job.salaryMin, unitText: "MONTH" },
          },
        }
      : {}),
    directApply: true,
    url: new URL(`/vagas/${job.id}`, env().APP_URL).toString(),
  };
  // Escapa "<" para impedir fechamento prematuro da tag <script>.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

async function JobContent({ params }: { params: PageProps<"/vagas/[id]">["params"] }) {
  const { id } = await params;
  const job = await getPublicJob(id);
  if (!job) notFound();
  const now = new Date();
  const user = await getCurrentUser();
  const [savedRow, application] = user
    ? await Promise.all([
        db.savedJob.findUnique({ where: { userId_jobId: { userId: user.id, jobId: job.id } } }),
        db.application.findUnique({ where: { jobId_candidateUserId: { jobId: job.id, candidateUserId: user.id } }, select: { id: true } }),
      ])
    : [null, null];

  const salary = job.salaryVisible ? formatSalaryRange(job.salaryMin, job.salaryMax) : null;
  const location = job.workModel === "REMOTE" ? "Remoto (Brasil)" : [job.city, job.state].filter(Boolean).join(" – ");
  const required = job.skills.filter((s) => s.required);
  const desired = job.skills.filter((s) => !s.required);
  const isOpen = job.status === "ACTIVE" && (!job.closesAt || job.closesAt > now);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <JobPostingJsonLd job={job} />
      <article className="space-y-6">
        <nav aria-label="Trilha" className="text-sm text-muted-foreground">
          <Link href="/vagas" className="hover:underline">Vagas</Link> <span aria-hidden>/</span> <span>{job.title}</span>
        </nav>

        {!isOpen && (
          <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            Esta vaga {job.status === "PAUSED" ? "está pausada" : "foi encerrada"} e não está recebendo candidaturas.
          </div>
        )}

        <header className="rounded-2xl border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <OrgLogo name={job.org.tradeName} fileId={job.org.logoFileId} size={60} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-petroleum sm:text-3xl">{job.title}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <Link href={`/empresas/${job.org.slug}`} className="font-medium text-foreground hover:underline">{job.org.tradeName}</Link>
                {!job.org.isDemo && <CheckCircle2 className="size-4 text-primary" aria-label="Empresa verificada" />}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.org.isDemo && <JobTag tone="rose">Demonstração — vaga fictícia</JobTag>}
                <JobTag tone="sky">{CONTRACT_TYPE_LABEL[job.contractType]}</JobTag>
                <JobTag tone="violet">{WORK_MODEL_LABEL[job.workModel]}</JobTag>
                <JobTag tone="amber">{SENIORITY_LABEL[job.seniority]}</JobTag>
                <JobTag tone="emerald">{job.sector}</JobTag>
              </div>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-4 border-t pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex gap-2"><Wallet className="size-4 text-primary" aria-hidden /><div><dt className="text-muted-foreground">Salário</dt><dd className="font-semibold">{salary ? `${salary}/mês` : "A combinar"}</dd></div></div>
            <div className="flex gap-2"><MapPin className="size-4 text-primary" aria-hidden /><div><dt className="text-muted-foreground">Local</dt><dd className="font-semibold">{location || "Não informado"}</dd></div></div>
            <div className="flex gap-2"><Users className="size-4 text-primary" aria-hidden /><div><dt className="text-muted-foreground">Posições</dt><dd className="font-semibold">{job.positions}</dd></div></div>
            <div className="flex gap-2"><CalendarDays className="size-4 text-primary" aria-hidden /><div><dt className="text-muted-foreground">Publicada</dt><dd className="font-semibold">{job.publishedAt ? formatRelative(job.publishedAt, now) : "—"}</dd></div></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {application ? (
              <Link href={`/minha-conta/candidaturas/${application.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground">
                <CheckCircle2 className="size-4" aria-hidden /> Você já se candidatou — acompanhar
              </Link>
            ) : isOpen ? (
              <Link href={`/vagas/${job.id}/candidatar`} className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Candidatar-se
              </Link>
            ) : null}
            {user && isOpen && <SaveJobButton jobId={job.id} initialSaved={Boolean(savedRow)} />}
            <ReportDialog jobId={job.id} signedIn={Boolean(user)} />
          </div>
          {job.closesAt && isOpen && <p className="mt-3 text-xs text-muted-foreground">Inscrições até {formatDate(job.closesAt)}.</p>}
        </header>

        <section className="rounded-2xl border bg-card p-6" aria-labelledby="sobre-vaga">
          <h2 id="sobre-vaga" className="text-lg font-semibold text-petroleum">Sobre a vaga</h2>
          <div className="mt-3 space-y-3 leading-relaxed text-foreground/90">
            {paragraphs(job.description).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
          {job.requirements && (
            <>
              <h2 className="mt-6 text-lg font-semibold text-petroleum">Requisitos</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-foreground/90">
                {paragraphs(job.requirements).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
              </div>
            </>
          )}
          {job.benefits && (
            <>
              <h2 className="mt-6 text-lg font-semibold text-petroleum">Benefícios</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-foreground/90">
                {paragraphs(job.benefits).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
              </div>
            </>
          )}
          {job.skills.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-semibold text-petroleum">Competências</h2>
              {required.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-medium">Exigidas</p>
                  <ul className="flex flex-wrap gap-2">{required.map((s) => <li key={s.skillId} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{s.skill.name}</li>)}</ul>
                </div>
              )}
              {desired.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-medium">Desejáveis</p>
                  <ul className="flex flex-wrap gap-2">{desired.map((s) => <li key={s.skillId} className="rounded-full border px-3 py-1 text-sm">{s.skill.name}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </section>
      </article>

      <aside className="space-y-4">
        {user && (
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
            <MatchCard userId={user.id} jobId={job.id} />
          </Suspense>
        )}
        <section className="rounded-2xl border bg-card p-5" aria-labelledby="sobre-empresa">
          <h2 id="sobre-empresa" className="flex items-center gap-2 font-semibold text-petroleum"><Building2 className="size-4" aria-hidden /> Sobre a empresa</h2>
          <p className="mt-2 line-clamp-6 text-sm text-muted-foreground">{job.org.description ?? "A empresa ainda não adicionou uma descrição."}</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link href={`/empresas/${job.org.slug}`} className="font-medium text-primary hover:underline">Ver perfil e outras vagas</Link>
            {job.org.website && (
              <a href={job.org.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
                Site oficial <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" aria-hidden /> Proteja-se de golpes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Nenhuma empresa séria cobra taxa para candidatura, curso ou material.</li>
            <li>Desconfie de pedidos de dados bancários, senhas ou fotos de documentos antes da contratação.</li>
            <li>Viu algo suspeito? Use “Denunciar vaga”.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

async function MatchCard({ userId, jobId }: { userId: string; jobId: string }) {
  const rec = await explainJobForUser(userId, jobId, new Date());
  if (!rec) {
    return (
      <section className="rounded-2xl border bg-card p-5 text-sm">
        <h2 className="flex items-center gap-2 font-semibold text-petroleum"><Sparkles className="size-4" aria-hidden /> Compatibilidade</h2>
        <p className="mt-2 text-muted-foreground">
          Complete seu perfil (ou ative recomendações em Privacidade) para ver por que esta vaga combina com você.
        </p>
        <Link href="/minha-conta/perfil" className="mt-3 inline-block font-medium text-primary hover:underline">Completar perfil</Link>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border bg-card p-5 text-sm" aria-labelledby="match">
      <h2 id="match" className="flex items-center gap-2 font-semibold text-petroleum"><Sparkles className="size-4" aria-hidden /> Compatibilidade com seu perfil</h2>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rec.score} aria-label="Pontuação de compatibilidade">
          <div className="h-2 rounded-full bg-primary" style={{ width: `${rec.score}%` }} />
        </div>
        <span className="font-semibold">{rec.score}/100</span>
      </div>
      {rec.reasons.length > 0 && <ul className="mt-3 space-y-1.5">{rec.reasons.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{r}</li>)}</ul>}
      {rec.gaps.length > 0 && <ul className="mt-3 space-y-1.5 text-muted-foreground">{rec.gaps.map((g) => <li key={g}>• {g}</li>)}</ul>}
      <p className="mt-3 text-xs text-muted-foreground">
        Estimativa baseada apenas nas informações do seu perfil e preferências. Não é usada pelas empresas para filtrar candidaturas.
      </p>
    </section>
  );
}

function JobSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <SectionSkeleton rows={8} />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
