import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgStatusBadge } from "@/components/common/application-status-badge";
import { OrgLogo } from "@/components/jobs/org-logo";
import { OrgNav } from "@/app/empresa/[orgId]/org-nav";
import { requireOrgPermission } from "@/server/auth/dal";
import { db } from "@/server/db";

export const metadata: Metadata = {
  title: { default: "Painel da empresa", template: "%s · Empresa · Emprego Agora" },
  robots: { index: false, follow: false },
};

export default function OrgLayout(props: LayoutProps<"/empresa/[orgId]">) {
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:py-10">
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Suspense fallback={<Skeleton className="h-20 w-full rounded-xl" />}>
          <OrgHeader params={props.params} />
        </Suspense>
      </aside>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

async function OrgHeader({ params }: { params: LayoutProps<"/empresa/[orgId]">["params"] }) {
  const { orgId } = await params;
  const access = await requireOrgPermission(orgId, "org.view");
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { logoFileId: true } });
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <OrgLogo name={access.org.tradeName} fileId={org.logoFileId} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{access.org.tradeName}</p>
          <OrgStatusBadge status={access.org.verificationStatus as never} />
        </div>
      </div>
      <OrgNav orgId={orgId} canManageMembers={["OWNER", "ADMIN"].includes(access.membership.role)} />
    </>
  );
}
