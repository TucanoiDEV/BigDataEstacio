import { Suspense } from "react";
import { Heart } from "lucide-react";
import { CardListSkeleton, EmptyState, PageHeader } from "@/components/common/states";
import { JobCard } from "@/components/jobs/job-card";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { jobCardSelect } from "@/server/services/search";

export const metadata = { title: "Vagas salvas" };

export default function SavedJobsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Vagas salvas" description="Vagas que você marcou para ver depois. Vagas encerradas saem da lista automaticamente." />
      <Suspense fallback={<CardListSkeleton count={3} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUser({ returnTo: "/minha-conta/favoritas", allowUnverified: true });
  const rows = await db.savedJob.findMany({
    where: { userId: user.id, job: { status: "ACTIVE", org: { verificationStatus: "VERIFIED" } } },
    orderBy: { createdAt: "desc" },
    select: { job: { select: jobCardSelect } },
  });
  const now = new Date();
  if (!rows.length) return <EmptyState icon={Heart} title="Nenhuma vaga salva" description="Use o ícone de marcador nas vagas para salvá-las aqui." action={{ href: "/vagas", label: "Explorar vagas" }} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ job }) => <JobCard key={job.id} job={job} now={now} canSave saved />)}
    </div>
  );
}
