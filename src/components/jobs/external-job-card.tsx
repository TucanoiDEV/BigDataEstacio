import { Clock, ExternalLink, MapPin } from "lucide-react";
import { JobTag } from "@/components/jobs/job-card";
import { OrgLogo } from "@/components/jobs/org-logo";
import { WORK_MODEL_LABEL } from "@/lib/constants";
import { formatRelative, formatSalaryRange } from "@/lib/format";
import type { ExternalJobCardData } from "@/server/services/external-jobs";

/**
 * Crédito exigido pelos termos de cada fonte. Adzuna: o nome "Adzuna" com no mínimo
 * 116 × 23 px, com link para o domínio local (https://developer.adzuna.com/docs/terms_of_service).
 */
function SourceCredit({ source }: { source: ExternalJobCardData["source"] }) {
  if (source === "ADZUNA") {
    return (
      <a
        href="https://www.adzuna.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 inline-flex min-h-[23px] min-w-[116px] items-center justify-center rounded-md border px-2 text-xs font-semibold text-petroleum hover:bg-muted"
      >
        Vagas por Adzuna
      </a>
    );
  }
  return <span className="text-xs text-muted-foreground">via quadro oficial da empresa (Greenhouse)</span>;
}

export function ExternalJobCard({ job, now }: { job: ExternalJobCardData; now: Date }) {
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax);
  const location = [job.city, job.state].filter(Boolean).join(" – ") || job.locationLabel;
  return (
    <article className="group relative flex min-w-0 flex-col rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(11,59,70,0.04)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <OrgLogo name={job.companyName} fileId={null} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
            >
              {job.title}
              <span className="sr-only"> (abre o site de origem em nova aba)</span>
            </a>
          </h3>
          <p className="truncate text-sm text-muted-foreground">{job.companyName}</p>
        </div>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-4 mb-4 flex flex-wrap gap-1.5">
        <JobTag tone="sky">Vaga externa</JobTag>
        {job.workModel && <JobTag tone="violet">{WORK_MODEL_LABEL[job.workModel]}</JobTag>}
      </div>
      <div className="mt-auto space-y-3 border-t pt-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {salary ? (
              <p className="truncate text-sm font-bold text-petroleum">{salary}<span className="font-normal text-muted-foreground">/mês</span></p>
            ) : (
              <p className="text-sm text-muted-foreground">Salário não informado</p>
            )}
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {job.workModel === "REMOTE" && !job.state ? "Remoto" : location}
            </p>
          </div>
          <p className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            <time dateTime={job.postedAt.toISOString()}>{formatRelative(job.postedAt, now)}</time>
          </p>
        </div>
        <SourceCredit source={job.source} />
      </div>
    </article>
  );
}
