import { Suspense } from "react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { OrgLogoUpload, UpdateOrgForm } from "@/components/company/org-forms";
import { OrgLogo } from "@/components/jobs/org-logo";
import { requireOrgPermission } from "@/server/auth/dal";
import { db } from "@/server/db";
import { formatCnpj } from "@/lib/cnpj";

export const metadata = { title: "Perfil da empresa" };

export default function OrgProfilePage(props: PageProps<"/empresa/[orgId]/perfil">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Perfil da empresa" description="Informações exibidas na página pública da empresa e nas vagas." />
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/empresa/[orgId]/perfil">["params"] }) {
  const { orgId } = await params;
  await requireOrgPermission(orgId, "org.edit");
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <OrgLogo name={org.tradeName} fileId={org.logoFileId} size={64} />
        <div className="flex-1 text-sm">
          <p className="font-semibold">{org.legalName}</p>
          <p className="text-muted-foreground">CNPJ {formatCnpj(org.cnpj)} · razão social e CNPJ só podem ser alterados pela moderação.</p>
        </div>
        <OrgLogoUpload orgId={orgId} />
      </section>
      <UpdateOrgForm
        orgId={orgId}
        defaults={{
          tradeName: org.tradeName,
          website: org.website ?? "",
          contactEmail: org.contactEmail,
          description: org.description ?? "",
          sector: (org.sector ?? null) as never,
          sizeRange: (org.sizeRange ?? null) as never,
          city: org.city ?? "",
          state: (org.state ?? null) as never,
        }}
      />
    </div>
  );
}
