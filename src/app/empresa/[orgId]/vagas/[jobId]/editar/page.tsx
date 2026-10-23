import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { JobForm } from "@/components/company/job-form";
import { requireOrgPermission } from "@/server/auth/dal";
import { getOrgJobForEdit } from "@/server/services/jobs";

export const metadata = { title: "Editar vaga" };

export default function EditJobPage(props: PageProps<"/empresa/[orgId]/vagas/[jobId]/editar">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Editar vaga" description="Alterações em vagas publicadas passam novamente pela verificação automática de sinais de fraude." />
      <Suspense fallback={<SectionSkeleton rows={10} />}>
        <Content params={props.params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/empresa/[orgId]/vagas/[jobId]/editar">["params"] }) {
  const { orgId, jobId } = await params;
  const access = await requireOrgPermission(orgId, "jobs.manage");
  const job = await getOrgJobForEdit(access, jobId);
  if (!job || job.status === "CLOSED" || job.status === "REMOVED") notFound();
  return (
    <JobForm
      orgId={orgId}
      jobId={jobId}
      orgVerified={access.org.verificationStatus === "VERIFIED"}
      defaults={{
        title: job.title,
        description: job.description,
        requirements: job.requirements ?? "",
        benefits: job.benefits ?? "",
        sector: job.sector as never,
        seniority: job.seniority,
        contractType: job.contractType,
        workModel: job.workModel,
        city: job.city ?? "",
        state: (job.state ?? null) as never,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryVisible: job.salaryVisible,
        positions: job.positions,
        skills: job.skills.map((s) => s.skill.name),
        requiredSkills: job.skills.filter((s) => s.required).map((s) => s.skill.name),
      }}
    />
  );
}
