import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { EmptyState, PageHeader, SectionSkeleton } from "@/components/common/states";
import { OrgStatusBadge } from "@/components/common/application-status-badge";
import { OrgLogo } from "@/components/jobs/org-logo";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { ORG_ROLE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "Minhas empresas", robots: { index: false } };

export default function MyOrgsPage() {
  return (
    <div className="container-page space-y-6 py-8 lg:py-10">
      <PageHeader
        eyebrow="Área de recrutamento"
        title="Minhas empresas"
        actions={<Link href="/empresa/nova" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" aria-hidden /> Cadastrar empresa</Link>}
      />
      <Suspense fallback={<SectionSkeleton rows={4} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUser({ returnTo: "/empresa" });
  const memberships = await db.orgMembership.findMany({
    where: { userId: user.id },
    select: { role: true, org: { select: { id: true, tradeName: true, verificationStatus: true, logoFileId: true, _count: { select: { jobs: { where: { status: "ACTIVE" } } } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (!memberships.length) {
    return <EmptyState icon={Building2} title="Você ainda não participa de nenhuma empresa" description="Cadastre sua empresa para publicar vagas ou peça um convite a quem já administra o perfil dela." action={{ href: "/empresa/nova", label: "Cadastrar empresa" }} />;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {memberships.map(({ role, org }) => (
        <li key={org.id}>
          <Link href={`/empresa/${org.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm">
            <OrgLogo name={org.tradeName} fileId={org.logoFileId} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{org.tradeName}</p>
              <p className="text-sm text-muted-foreground">{ORG_ROLE_LABEL[role]} · {org._count.jobs} vaga(s) ativa(s)</p>
              <div className="mt-1"><OrgStatusBadge status={org.verificationStatus} /></div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
