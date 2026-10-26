import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BadgeCheck, Building2 } from "lucide-react";
import { CardListSkeleton, EmptyState, PageHeader } from "@/components/common/states";
import { OrgLogo } from "@/components/jobs/org-logo";
import { db } from "@/server/db";
import { publicJobWhere } from "@/server/services/jobs";

export const metadata: Metadata = {
  title: "Empresas verificadas",
  description: "Conheça as empresas verificadas que publicam vagas no Emprego Agora.",
};

export default function CompaniesPage() {
  return (
    <div className="container-page space-y-6 py-8 lg:py-10">
      <PageHeader
        title="Empresas verificadas"
        description="Somente empresas que passaram pela verificação da equipe aparecem aqui e podem publicar vagas."
        actions={<Link href="/empresa/nova" className="inline-flex h-9 items-center rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted">Cadastrar empresa</Link>}
      />
      <Suspense fallback={<CardListSkeleton count={6} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await connection();
  const now = new Date();
  const orgs = await db.organization.findMany({
    where: { verificationStatus: "VERIFIED" },
    orderBy: { tradeName: "asc" },
    take: 200,
    select: { id: true, slug: true, tradeName: true, sector: true, city: true, state: true, logoFileId: true, _count: { select: { jobs: { where: publicJobWhere(now) } } } },
  });
  if (!orgs.length) return <EmptyState icon={Building2} title="Nenhuma empresa verificada ainda" description="Assim que empresas forem verificadas, elas aparecerão aqui." />;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {orgs.map((o) => (
        <li key={o.id}>
          <Link href={`/empresas/${o.slug}`} className="flex h-full items-center gap-4 rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm">
            <OrgLogo name={o.tradeName} fileId={o.logoFileId} size={52} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-semibold">{o.tradeName} <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verificada" /></p>
              <p className="truncate text-sm text-muted-foreground">{[o.sector, [o.city, o.state].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "Local não informado"}</p>
              <p className="mt-1 text-sm font-medium text-primary">{o._count.jobs} vaga{o._count.jobs === 1 ? "" : "s"} aberta{o._count.jobs === 1 ? "" : "s"}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
