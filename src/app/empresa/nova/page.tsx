import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader, SectionSkeleton } from "@/components/common/states";
import { CreateOrgForm } from "@/components/company/org-forms";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Cadastrar empresa", robots: { index: false } };

export default function NewOrgPage() {
  return (
    <div className="container-page max-w-3xl space-y-6 py-8 lg:py-10">
      <PageHeader
        eyebrow="Área de recrutamento"
        title="Cadastrar empresa"
        description="Toda empresa passa por verificação antes de publicar vagas. Isso protege candidatos contra golpes e anúncios falsos."
      />
      <div className="flex gap-3 rounded-xl border bg-secondary/60 p-4 text-sm text-secondary-foreground">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        <p>
          Os dígitos do CNPJ são validados automaticamente. Em seguida, a equipe de moderação confere manualmente a situação
          cadastral em fonte oficial e a coerência entre razão social, site e domínio do e-mail de contato. Você pode preparar
          vagas como rascunho enquanto a análise acontece.
        </p>
      </div>
      <Suspense fallback={<SectionSkeleton rows={8} />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  const user = await requireUser({ returnTo: "/empresa/nova" });
  return <CreateOrgForm contactEmail={user.email} />;
}
