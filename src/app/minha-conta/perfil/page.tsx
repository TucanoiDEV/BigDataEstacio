import { Suspense } from "react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { ProfileForm } from "@/components/candidate/profile-form";
import { ExperienceSection, EducationSection } from "@/components/candidate/history-sections";
import { PhotoUpload } from "@/components/candidate/photo-upload";
import { requireUser } from "@/server/auth/dal";
import { getFullProfile } from "@/server/services/profile";

export const metadata = { title: "Perfil" };

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil profissional"
        description="Essas informações aparecem para as empresas às quais você se candidata e alimentam suas recomendações. Não pedimos CPF, idade, gênero ou outros dados sensíveis."
      />
      <Suspense fallback={<SectionSkeleton rows={10} />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

const month = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : null);

async function ProfileContent() {
  const user = await requireUser({ returnTo: "/minha-conta/perfil", allowUnverified: true });
  const p = await getFullProfile(user.id);
  return (
    <div className="space-y-6">
      <PhotoUpload name={p.user.name} photoFileId={p.photoFileId} />
      <ProfileForm
        defaults={{
          name: p.user.name,
          headline: p.headline ?? "",
          about: p.about ?? "",
          city: p.city ?? "",
          state: p.state ?? null,
          phone: p.phone ?? "",
          linkedinUrl: p.linkedinUrl ?? "",
          portfolioUrl: p.portfolioUrl ?? "",
          desiredTitle: p.desiredTitle ?? "",
          desiredWorkModels: p.desiredWorkModels,
          desiredContractTypes: p.desiredContractTypes,
          desiredSeniority: p.desiredSeniority,
          desiredSalaryMin: p.desiredSalaryMin,
          desiredSectors: p.desiredSectors as never,
          openToRelocation: p.openToRelocation,
          skills: p.skills.map((s) => s.skill.name),
        }}
      />
      <ExperienceSection
        items={p.experiences.map((e) => ({
          id: e.id,
          title: e.title,
          company: e.company,
          city: e.city,
          startDate: month(e.startDate)!,
          endDate: month(e.endDate),
          isCurrent: e.isCurrent,
          description: e.description,
        }))}
      />
      <EducationSection
        items={p.educations.map((e) => ({
          id: e.id,
          institution: e.institution,
          degree: e.degree,
          field: e.field,
          startDate: month(e.startDate),
          endDate: month(e.endDate),
          inProgress: e.inProgress,
        }))}
      />
    </div>
  );
}
