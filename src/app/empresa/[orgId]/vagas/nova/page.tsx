import { Suspense } from "react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { JobForm } from "@/components/company/job-form";
import { requireOrgPermission } from "@/server/auth/dal";

export const metadata = { title: "Nova vaga" };

export default function NewJobPage(props: PageProps<"/empresa/[orgId]/vagas/nova">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Nova vaga" description="Descreva a oportunidade com clareza. Campos com * são obrigatórios." />
      <Suspense fallback={<SectionSkeleton rows={10} />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/empresa/[orgId]/vagas/nova">["params"] }) {
  const { orgId } = await params;
  const access = await requireOrgPermission(orgId, "jobs.manage");
  return <JobForm orgId={orgId} orgVerified={access.org.verificationStatus === "VERIFIED"} />;
}
