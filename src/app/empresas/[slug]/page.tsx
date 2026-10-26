import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, MapPin, Users } from "lucide-react";
import { CardListSkeleton, EmptyState } from "@/components/common/states";
import { JobCard } from "@/components/jobs/job-card";
import { OrgLogo } from "@/components/jobs/org-logo";
import { db } from "@/server/db";
import { publicJobWhere } from "@/server/services/jobs";
import { jobCardSelect } from "@/server/services/search";
import { paragraphs } from "@/lib/text";

async function getOrg(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return db.organization.findFirst({
    where: { slug, verificationStatus: "VERIFIED" },
    select: { id: true, tradeName: true, description: true, website: true, sector: true, sizeRange: true, city: true, state: true, logoFileId: true },
  });
}

export async function generateMetadata(props: PageProps<"/empresas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const org = await getOrg(slug);
  if (!org) return { title: "Empresa não encontrada", robots: { index: false } };
  return { title: `${org.tradeName}: vagas e perfil`, description: org.description?.slice(0, 160) ?? `Vagas abertas em ${org.tradeName}.` };
}

export default function CompanyPage(props: PageProps<"/empresas/[slug]">) {
  return (
    <div className="container-page space-y-8 py-8 lg:py-10">
      <Suspense fallback={<CardListSkeleton count={3} />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/empresas/[slug]">["params"] }) {
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org) notFound();
  const now = new Date();
  const jobs = await db.job.findMany({ where: { ...publicJobWhere(now), orgId: org.id }, orderBy: { publishedAt: "desc" }, select: jobCardSelect });
  return (
    <>
      <header className="flex flex-col gap-5 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
        <OrgLogo name={org.tradeName} fileId={org.logoFileId} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-petroleum sm:text-3xl">{org.tradeName} <BadgeCheck className="size-6 text-primary" aria-label="Empresa verificada" /></h1>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {org.sector && <li>{org.sector}</li>}
            {(org.city || org.state) && <li className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{[org.city, org.state].filter(Boolean).join("/")}</li>}
            {org.sizeRange && <li className="flex items-center gap-1"><Users className="size-3.5" aria-hidden />{org.sizeRange} pessoas</li>}
            {org.website && <li><a href={org.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">Site <ExternalLink className="size-3.5" aria-hidden /></a></li>}
          </ul>
        </div>
      </header>
      {org.description && (
        <section className="rounded-2xl border bg-card p-6" aria-labelledby="sobre">
          <h2 id="sobre" className="text-lg font-semibold text-petroleum">Sobre</h2>
          <div className="mt-2 space-y-3 text-foreground/90">{paragraphs(org.description).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
        </section>
      )}
      <section aria-labelledby="vagas-org" className="space-y-4">
        <h2 id="vagas-org" className="text-lg font-semibold text-petroleum">Vagas abertas ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <EmptyState title="Nenhuma vaga aberta no momento" description="Volte em breve ou crie um alerta para esta empresa na busca de vagas." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} job={j} now={now} />)}</div>
        )}
      </section>
    </>
  );
}
