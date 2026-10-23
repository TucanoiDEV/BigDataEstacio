import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { MfaForm } from "@/components/auth/auth-forms";
import { SectionSkeleton } from "@/components/common/states";
import { getSessionState } from "@/server/auth/dal";
import { safeNextPath } from "@/lib/validation/auth";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default function MfaPage(props: PageProps<"/entrar/verificacao">) {
  return (
    <AuthCard
      title="Verificação em duas etapas"
      description="Por segurança, confirme sua identidade com o segundo fator."
      footer={
        <form action={logoutAction}>
          <button type="submit" className="font-medium text-primary hover:underline">
            Cancelar e sair
          </button>
        </form>
      }
    >
      <Suspense fallback={<SectionSkeleton rows={2} />}>
        <MfaContent searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function MfaContent({ searchParams }: { searchParams: PageProps<"/entrar/verificacao">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNextPath.parse(typeof sp.next === "string" ? sp.next : undefined);
  const s = await getSessionState();
  if (s.state === "anonymous") redirect("/entrar");
  if (s.state === "active") redirect(next ?? "/minha-conta");
  return <MfaForm next={next} />;
}
