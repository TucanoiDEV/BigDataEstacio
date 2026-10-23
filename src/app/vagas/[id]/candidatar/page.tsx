import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SectionSkeleton } from "@/components/common/states";
import { ApplyForm } from "@/components/jobs/apply-form";
import { OrgLogo } from "@/components/jobs/org-logo";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { getPublicJob } from "@/server/services/jobs";
import { isDownloadable } from "@/server/storage/files";

export const metadata: Metadata = { title: "Candidatar-se", robots: { index: false } };

export default function ApplyPage(props: PageProps<"/vagas/[id]/candidatar">) {
  return (
    <div className="container-page max-w-3xl py-8 lg:py-10">
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <ApplyContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function ApplyContent({ params }: { params: PageProps<"/vagas/[id]/candidatar">["params"] }) {
  const { id } = await params;
  const user = await requireUser({ returnTo: `/vagas/${id}/candidatar` });
  const job = await getPublicJob(id);
  if (!job) notFound();
  if (job.status !== "ACTIVE") redirect(`/vagas/${id}`);

  const existing = await db.application.findUnique({ where: { jobId_candidateUserId: { jobId: id, candidateUserId: user.id } }, select: { id: true } });
  if (existing) redirect(`/minha-conta/candidaturas/${existing.id}`);

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: {
      headline: true,
      phone: true,
      showEmailToCompanies: true,
      showPhoneToCompanies: true,
      _count: { select: { experiences: true, skills: true } },
      resumes: { select: { id: true, label: true, isDefault: true, file: { select: { scanStatus: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  const resumes = (profile?.resumes ?? []).filter((r) => isDownloadable(r.file.scanStatus)).map((r) => ({ id: r.id, label: r.label, isDefault: r.isDefault }));
  const incomplete = !profile || (!profile.headline && profile._count.experiences === 0 && profile._count.skills === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <OrgLogo name={job.org.tradeName} fileId={job.org.logoFileId} size={48} />
        <div>
          <p className="text-sm text-muted-foreground">Candidatura para</p>
          <h1 className="text-xl font-bold text-petroleum sm:text-2xl">{job.title}</h1>
          <p className="text-sm text-muted-foreground">{job.org.tradeName}</p>
        </div>
      </div>
      {incomplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Seu perfil está incompleto. Você pode se candidatar mesmo assim, mas a empresa verá poucas informações.{" "}
          <Link href="/minha-conta/perfil" className="font-semibold underline">Completar perfil</Link>
        </div>
      )}
      <ApplyForm
        jobId={job.id}
        orgName={job.org.tradeName}
        resumes={resumes}
        email={user.email}
        phone={profile?.phone ?? null}
        defaultShareEmail={profile?.showEmailToCompanies ?? true}
        defaultSharePhone={profile?.showPhoneToCompanies ?? false}
      />
    </div>
  );
}
