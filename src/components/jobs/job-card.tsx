import Link from "next/link";
import { Check, Clock, MapPin } from "lucide-react";
import { OrgLogo } from "@/components/jobs/org-logo";
import { SaveJobButton } from "@/components/jobs/save-job-button";
import { CONTRACT_TYPE_LABEL, SENIORITY_LABEL, WORK_MODEL_LABEL } from "@/lib/constants";
import { formatRelative, formatSalaryRange } from "@/lib/format";
import type { JobCardData } from "@/server/services/search";
import { cn } from "@/lib/utils";

export function JobTag({ children, tone }: { children: React.ReactNode; tone: "sky" | "violet" | "amber" | "emerald" | "rose" }) {
  const tones = {
    sky: "bg-sky-50 text-sky-800",
    violet: "bg-violet-50 text-violet-800",
    amber: "bg-amber-50 text-amber-900",
    emerald: "bg-emerald-50 text-emerald-800",
    rose: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
  };
  return <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function JobCard({ job, now, saved, canSave, reasons }: { job: JobCardData; now: Date; saved?: boolean; canSave?: boolean; reasons?: string[] }) {
  const salary = job.salaryVisible ? formatSalaryRange(job.salaryMin, job.salaryMax) : null;
  const location = job.workModel === "REMOTE" ? "Remoto" : [job.city, job.state].filter(Boolean).join(" – ");
  return (
    <article className="group relative flex min-w-0 flex-col rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(11,59,70,0.04)] transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <OrgLogo name={job.org.tradeName} fileId={job.org.logoFileId} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            <Link href={`/vagas/${job.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
              {job.title}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted-foreground">{job.org.tradeName}</p>
        </div>
        {canSave && (
          <div className="relative z-10">
            <SaveJobButton jobId={job.id} initialSaved={Boolean(saved)} compact />
          </div>
        )}
      </div>
      <div className="mt-4 mb-4 flex flex-wrap gap-1.5">
        {job.org.isDemo && <JobTag tone="rose">Demonstração</JobTag>}
        <JobTag tone="sky">{CONTRACT_TYPE_LABEL[job.contractType]}</JobTag>
        <JobTag tone="violet">{WORK_MODEL_LABEL[job.workModel]}</JobTag>
        <JobTag tone="amber">{SENIORITY_LABEL[job.seniority]}</JobTag>
      </div>
      {reasons && reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {reasons.slice(0, 2).map((r) => (
            <li key={r} className="flex gap-1.5">
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden /> {r}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
        <div className="min-w-0">
          {salary ? (
            <p className="truncate text-sm font-bold text-petroleum">{salary}<span className="font-normal text-muted-foreground">/mês</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">Salário a combinar</p>
          )}
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {location || "Local não informado"}
          </p>
        </div>
        {job.publishedAt && (
          <p className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            <time dateTime={job.publishedAt.toISOString()}>{formatRelative(job.publishedAt, now)}</time>
          </p>
        )}
      </div>
    </article>
  );
}
